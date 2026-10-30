/**
 * Observer geometry, independent of the DOM and renderer. Units and frames are
 * explicit: Astronomy Engine vectors are EQJ (mean equator/equinox J2000), AU.
 * Lunar body vectors below use +X = longitude 0, +Y = 90° east, +Z = north.
 * Scientific references and precision limits: ../docs/SCIENCE.md.
 */
import {
  Body, GeoMoon, GeoVector, Observer, ObserverVector, RotationAxis,
  RotateVector, Rotation_EQJ_HOR, Rotation_HOR_EQJ, Rotation_EQD_EQJ,
  HorizonFromVector, Vector, KM_PER_AU, MoonPhase,
} from 'astronomy-engine';
export { calculateSky, type SkyAppearance } from './sky.js';

export type Vec3 = readonly [number, number, number];
export interface Location { latitude: number; longitude: number; elevation?: number }
export type Orientation = 'horizon' | 'north';
export interface MoonOptions {
  date?: Date;
  observer: Location;
  /** horizon: local zenith up; north: celestial north of date up. */
  orientation?: Orientation;
}
export interface MoonState {
  date: Date;
  observer: Required<Location>;
  orientation: Orientation;
  distanceKm: number;
  angularDiameterDeg: number;
  /** Geometric center altitude; no atmospheric refraction. */
  altitudeDeg: number;
  azimuthDeg: number;
  /** Topocentric geometric solar center altitude, without refraction. */
  sunAltitudeDeg: number;
  illuminatedFraction: number;
  phaseAngleDeg: number;
  phaseLongitudeDeg: number;
  phaseName: string;
  subObserver: { longitudeDeg: number; latitudeDeg: number };
  subSolar: { longitudeDeg: number; latitudeDeg: number };
  /** Unit vectors in the Moon's rotating body frame. */
  viewDirection: Vec3;
  sunDirection: Vec3;
  upDirection: Vec3;
}

const RAD = Math.PI / 180;
/** LRO reference sphere radius (km), NASA SVS CGI Moon Kit / LOLA. */
export const MOON_RADIUS_KM = 1737.4;
export const dot = (a: Vec3, b: Vec3): number => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const tuple = (v: {x: number; y: number; z: number}): Vec3 => [v.x, v.y, v.z];
export function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(...v);
  if (n < 1e-14) throw new RangeError('Cannot normalize a zero-length vector');
  return [v[0]/n, v[1]/n, v[2]/n];
}
const clamp = (n: number): number => Math.max(-1, Math.min(1, n));

/**
 * IAU WGCCRE 2015 lunar pole and prime meridian (α₀, δ₀, W), evaluated by
 * Astronomy Engine RotationAxis. The W=0 node lies at RA=α₀+90°, Dec=0.
 * Rotate this node by W about the lunar north pole to obtain longitude zero.
 * See Archinal et al. (2018), DOI:10.1007/s10569-017-9805-5, Table 2.
 */
export function lunarAxes(date: Date): readonly [Vec3, Vec3, Vec3] {
  const axis = RotationAxis(Body.Moon, date);
  const alpha = axis.ra * 15 * RAD;
  const w = (axis.spin % 360) * RAD;
  const north = normalize(tuple(axis.north));
  const node: Vec3 = [-Math.sin(alpha), Math.cos(alpha), 0];
  const perpendicular = cross(north, node);
  const prime: Vec3 = node.map((v, i) => v*Math.cos(w) + perpendicular[i]*Math.sin(w)) as unknown as Vec3;
  return [prime, cross(north, prime), north];
}

export function surfaceDirection(latitudeDeg: number, longitudeDeg: number): Vec3 {
  const lat = latitudeDeg * RAD, lon = longitudeDeg * RAD;
  return [Math.cos(lat)*Math.cos(lon), Math.cos(lat)*Math.sin(lon), Math.sin(lat)];
}
function coordinates(v: Vec3) {
  return { longitudeDeg: Math.atan2(v[1], v[0])/RAD, latitudeDeg: Math.asin(clamp(v[2]))/RAD };
}

export function calculateMoon(options: MoonOptions): MoonState {
  const date = new Date((options.date ?? new Date()).getTime());
  const { latitude, longitude, elevation = 0 } = options.observer;
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError('Latitude must be between -90 and 90 degrees');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new RangeError('Longitude must be between -180 and 180 degrees (east positive)');
  if (!Number.isFinite(elevation)) throw new RangeError('Elevation must be finite meters above sea level');
  const orientation = options.orientation ?? 'horizon';
  if (orientation !== 'horizon' && orientation !== 'north') throw new RangeError('Unknown orientation');
  const observer = new Observer(latitude, longitude, elevation);
  const moon = GeoMoon(date);
  const sun = GeoVector(Body.Sun, date, false);
  const location = ObserverVector(date, observer, false);
  // Subtract the actual terrestrial observer, rather than merely rotating a
  // geocentric image: this includes diurnal parallax in the visible surface.
  const toObserver = subtract(tuple(location), tuple(moon));
  const toSun = subtract(tuple(sun), tuple(moon));
  const distanceKm = Math.hypot(...toObserver) * KM_PER_AU;
  const axes = lunarAxes(date);
  const inBody = (v: Vec3): Vec3 => [dot(v, axes[0]), dot(v, axes[1]), dot(v, axes[2])];
  const viewDirection = normalize(inBody(toObserver));
  const sunDirection = normalize(inBody(toSun));
  // HOR has x=north, y=west, z=zenith, so (0,0,1) is the local vertical.
  const skyUp = orientation === 'horizon'
    ? RotateVector(Rotation_HOR_EQJ(date, observer), new Vector(0, 0, 1, moon.t))
    : RotateVector(Rotation_EQD_EQJ(date), new Vector(0, 0, 1, moon.t));
  let up = inBody(tuple(skyUp));
  // At exact zenith/nadir the horizon's roll is undefined. Choose celestial
  // north as a stable fallback instead of producing NaNs in the camera frame.
  if (Math.abs(dot(normalize(up), viewDirection)) > 0.99999999) {
    up = inBody(tuple(RotateVector(Rotation_EQD_EQJ(date), new Vector(0, 0, 1, moon.t))));
  }
  const projection = dot(up, viewDirection);
  const upDirection = normalize(up.map((v, i) => v - projection*viewDirection[i]) as unknown as Vec3);
  const toMoon = new Vector(-toObserver[0], -toObserver[1], -toObserver[2], moon.t);
  const horizonRotation = Rotation_EQJ_HOR(date, observer);
  const horizon = HorizonFromVector(RotateVector(horizonRotation, toMoon), '');
  // Use the same topocentric EQJ → HOR transform for the Sun, with geometric
  // center altitude so the USNO twilight definitions apply (docs/SCIENCE.md).
  const topocentricSun = subtract(tuple(sun), tuple(location));
  const solarHorizon = HorizonFromVector(RotateVector(horizonRotation,
    new Vector(...topocentricSun, moon.t)), '');
  // Phase angle is Sun–Moon–observer. The projected illuminated fraction of a
  // smooth sphere is (1 + cos(i))/2; it is independent of the shading model.
  const cosPhase = clamp(dot(viewDirection, sunDirection));
  const phaseLongitudeDeg = MoonPhase(date);
  const names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return {
    date, observer: {latitude, longitude, elevation}, orientation, distanceKm,
    angularDiameterDeg: 2*Math.asin(MOON_RADIUS_KM / distanceKm)/RAD,
    altitudeDeg: horizon.lat, azimuthDeg: horizon.lon,
    sunAltitudeDeg: solarHorizon.lat,
    illuminatedFraction: (1+cosPhase)/2, phaseAngleDeg: Math.acos(cosPhase)/RAD,
    phaseLongitudeDeg, phaseName: names[Math.round(phaseLongitudeDeg/45)%8],
    subObserver: coordinates(viewDirection), subSolar: coordinates(sunDirection),
    viewDirection, sunDirection, upDirection,
  };
}
