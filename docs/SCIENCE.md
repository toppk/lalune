# Scientific models and rendering conventions

Calculation reference for `src/core.ts`, the terrain shader in `src/view.ts`,
and the tests. Comments at each nontrivial calculation identify its model.
Ordinary vector operations derive from the conventions below rather than
introducing additional empirical models.

## References

1. [Astronomy Engine source and validation](https://github.com/cosinekitty/astronomy),
   Don Cross, MIT. [JavaScript API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md).
   Provides lunar/solar ephemerides, timescale conversion, terrestrial observer
   vectors, precession/nutation, and horizon transforms. Exact dependency
   versions are in `package-lock.json`. Its source comments identify the lunar
   series and validation against NOVAS and JPL Horizons.
2. Archinal et al. (2018), *Report of the IAU Working Group on Cartographic
   Coordinates and Rotational Elements: 2015*, Celestial Mechanics and
   Dynamical Astronomy 130, 22. [DOI:10.1007/s10569-017-9805-5](https://doi.org/10.1007/s10569-017-9805-5).
   [USGS report](https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf).
   Source of the pole / prime-meridian convention in `RotationAxis`.
3. [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), map conventions,
   reference radius, and DEM units; see [asset provenance](../ASSETS.md).
4. [NASA Moon Phase and Libration, 2026](https://svs.gsfc.nasa.gov/5587/),
   independent geocentric reference. The test fixture records its source table,
   selection method, and original SHA-256 digest.
5. [USGS ISIS photomet: Lambert model](https://isis.astrogeology.usgs.gov/8.3.0/Application/presentation/Tabbed/photomet/photomet.html),
   reference for the diffuse display law. [JPL NAIF illumination geometry](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/illumf_c.html)
   defines phase, incidence, and emission angles and explains apparent-geometry
   corrections. These references describe conventions; this renderer does not
   call SPICE or implement all of its corrections.

## Calculation path

Input is an absolute JavaScript `Date`, latitude in degrees north, longitude
in degrees east, elevation in meters above sea level. Astronomy Engine manages
the timescales used by its models. No fixed UTC-to-TT offset or daily table is
introduced here.

`GeoMoon`, `GeoVector(Sun, ..., false)`, and `ObserverVector(..., false)` return
Earth-centered J2000 mean equatorial vectors (EQJ) in AU. The Moon is geometric;
the Sun call includes the dependency's light-time behavior but disables stellar
aberration. The Moon and rotation are evaluated at the supplied instant; we do
not iterate lunar emission time (roughly one second). This is a display model,
not a full apparent-place astrometry implementation.

Subtract Moon from terrestrial observer to get Moon-to-observer. Its length
times the dependency's `KM_PER_AU` is topocentric distance. Subtract Moon from
Sun to get illumination direction. Parallax changes both pointing and the
visible surface; a location is more than a roll angle.

For IAU pole right ascension α, declination δ, and prime-meridian angle W, let
**n** be the EQJ north vector, **a** = (−sin α, cos α, 0), **b** = **n** × **a**.
The longitude-zero axis is **x** = **a** cos W + **b** sin W; east is **y** =
**n** × **x**. Dot products with (**x**, **y**, **n**) transform EQJ directions
into the lunar body frame (reference 2). Periodic terms are evaluated by
`RotationAxis`. Changes in Earth direction in this rotating frame give libration.

For unit body vectors, longitude = `atan2(y,x)` and latitude = `asin(z)`. +X
points to longitude zero, +Y to 90° east, +Z north. With flipped image-v in
WebGL, texture `(u,v)` means longitude `360u − 180`, latitude `180v − 90` degrees.
Three.js sphere coordinates map body `(x,y,z)` to `(x,z,−y)`, preserving handedness.

`Rotation_EQJ_HOR` and `HorizonFromVector(..., '')` transform observer-to-Moon
into altitude/azimuth. HOR is north, west, zenith; returned azimuth increases
eastward from north. Refraction is disabled. Horizon orientation projects local
zenith onto the image plane for camera up. At zenith/nadir that roll is
undefined; code falls back to celestial north. North orientation projects the
true north pole of date, transformed back into EQJ.

Angular diameter is `2 asin(R/d)` for radius R, distance d. Phase angle i =
`acos(dot(unitSun, unitObserver))`; illuminated projected area fraction =
`(1 + cos(i))/2`, obtained by projecting the day hemisphere onto the image plane.
This is an area fraction independent of brightness law. Names are nearest 45°
bins of `MoonPhase` geocentric ecliptic elongation, not exact event times.

## Display approximations

The shader uses linear-light Lambert diffuse `max(0, normal · sun)` followed
by display colorspace conversion. This is a simple diffuse approximation,
not a fitted lunar photometric law. The NASA color product is already processed
for aesthetics. No absolute radiance or magnitude is claimed. Surface normals
use central finite differences of LOLA height divided by physical radius;
longitude slope divides by cos(latitude). A polar clamp avoids a singularity.
There is no artistic terrain exaggeration.

`darkSide` is optional constant fill for visibility, default 0.015; use zero for
an unlit night side. It does not calculate earthshine. There is no displacement,
terrain cast-shadow tracing, penumbra, physically modeled atmospheric extinction/refraction,
eclipse obscuration, or horizon/terrain masking. Disk size fits the container;
the true angular diameter is returned as data. Perspective keeps the actual
distance/radius ratio. The 82% fit, pixel-ratio cap 2, anisotropy cap 8, sphere
tessellation, and terminator smoothing width are display/performance choices,
not scientific constants. Annotation limb visibility is the sphere tangent
condition `surfaceNormal · viewDirection > R/d`; illumination uses a smooth sphere.

### Sky colors

`sunAltitudeDeg` uses the topocentric Sun vector and the same geometric horizon
transform as the Moon. `calculateSky` classifies twilight by the geometric solar
center at −6°, −12°, and −18°, following the [U.S. Naval Observatory definitions](https://aa.usno.navy.mil/faq/RST_defs).
Daytime means the center is at or above zero; it is not a prediction of observed
sunrise, which also depends on refraction and the Sun's angular radius.

Short-wavelength atmospheric scattering explains blue sky; see [NASA's
explanation](https://spaceplace.nasa.gov/blue-sky/en/). This implementation uses
that qualitative motivation, not a numerical Rayleigh/Mie scattering model.
The sRGB palette, additional 10°/45° stops, and cubic smooth interpolation are
display choices. Hue is not calibrated to measurements.

When `sky: true`, the shader uses `observed = lunarRadiance * transmission +
skyRadiance` in linear light, with the same sky color as its opaque background.
This adds foreground airlight even across the unlit lunar surface, avoiding a
black disk cutout in daytime. Transmission decreases smoothly from 1 to 0.55 as
the Sun rises from −6° to +10°; those endpoints and attenuation are aesthetic
choices. There is no dependence on weather, aerosols, view altitude, or angular
distance from the Sun. With `sky: false` (the library default) airlight is zero,
transmission is one, and the background is transparent. The demo enables sky
colors initially and supplies a toggle. No star catalog is loaded or drawn.

## Validation and limits

Tests compare 53 weekly samples throughout 2026 against NASA's independent
table. Tested geocentric quantities: distance, sub-Earth and subsolar longitude
and latitude, illuminated fraction. Thresholds are 60 km, 0.02 degrees, and
0.03 percentage points respectively. These are sample regression thresholds,
not universal accuracy guarantees. NASA's geocentric distance is not directly
comparable to the public API's topocentric distance.

Other tests compare topocentric altitude/azimuth to `Equator` + `Horizon`, check
frame handedness/orthonormality, both locations and hemispheres, and IANA DST
display. Same-dependency checks catch integration errors rather than validating
the underlying model independently. Tests run offline; expected values do not
regenerate themselves.

There is no precision guarantee outside the sampled year or for scientific
use. Higher fidelity requires JPL ephemerides/SPICE, matched lunar reference
frames, apparent-place corrections, original elevation data, and validated
photometric / shadow models.
