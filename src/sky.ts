/** Solar-altitude-driven display palette. See docs/SCIENCE.md, "Sky colors". */
export interface SkyAppearance {
  color: string;
  /** Artistic reduction in lunar contrast, 0 at night to 1 in daylight. */
  daylight: number;
  period: 'Night' | 'Astronomical twilight' | 'Nautical twilight' | 'Civil twilight' | 'Daytime';
}

// USNO defines twilight using the geometric Sun center at −6°, −12°, −18°:
// https://aa.usno.navy.mil/faq/RST_defs
// Colors and the 10°/45° daylight stops are aesthetic choices, not measured
// sky radiance. No weather/aerosol or directional scattering model is implied.
const stops: readonly (readonly [number, readonly [number, number, number]])[] = [
  [-18, [8, 11, 17]], [-12, [16, 26, 48]], [-6, [40, 57, 91]],
  [0, [59, 86, 133]], [10, [68, 106, 169]], [45, [80, 126, 193]],
];
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };

export function calculateSky(sunAltitudeDeg: number): SkyAppearance {
  if (!Number.isFinite(sunAltitudeDeg) || Math.abs(sunAltitudeDeg) > 90) {
    throw new RangeError('Sun altitude must be between -90 and 90 degrees');
  }
  let rgb = stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [lo, from] = stops[i-1], [hi, to] = stops[i];
    const t = smooth((sunAltitudeDeg-lo)/(hi-lo));
    rgb = from.map((v, channel) => Math.round(v + t*(to[channel]-v))) as [number, number, number];
    if (sunAltitudeDeg <= hi) break;
  }
  return {
    color: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''),
    daylight: smooth((sunAltitudeDeg+6)/16),
    period: sunAltitudeDeg <= -18 ? 'Night' : sunAltitudeDeg <= -12 ? 'Astronomical twilight'
      : sunAltitudeDeg <= -6 ? 'Nautical twilight' : sunAltitudeDeg < 0 ? 'Civil twilight' : 'Daytime',
  };
}
