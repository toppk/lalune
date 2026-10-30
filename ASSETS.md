# Image and data provenance

Credit: **NASA's Scientific Visualization Studio**; visualization by Ernie
Wright (USRA), with LRO instrument-team data. Source:
[NASA CGI Moon Kit, item 4720](https://svs.gsfc.nasa.gov/4720/).

[SVS usage terms](https://svs.gsfc.nasa.gov/help/) place its content in the public
domain unless noted otherwise. These map items carry no contrary notice.
La Lune's MIT software license does not relicense NASA imagery or imply NASA
endorsement. Keep the credit and provenance with redistributed copies.

| Bundled file | Source | Conversion |
| --- | --- | --- |
| `assets/moon-color-4k.jpg` | [2025 LROC color map, 16-bit sRGB, 4096 × 2048](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif) | 8-bit JPEG, quality 95, 4:4:4 chroma; no artistic recoloring |
| `assets/moon-height-4k.png` | [LOLA unsigned 16-bit DEM, 5760 × 2880](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif) | Resize to 4096 × 2048; linear 8-bit grayscale PNG, no contrast normalization |
| `assets/moon-color-2k.jpg` | Same NASA 2025 LROC TIFF as the 4K map | Resize to 2048 × 1024; JPEG quality 95, 4:4:4 chroma |
| `assets/moon-height-2k.png` | Same NASA LOLA TIFF as the 4K map | Resize to 2048 × 1024; linear 8-bit grayscale PNG; same elevation encoding |
| `tests/fixtures/nasa-2026.json` | [2026 hourly ephemeris](https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/mooninfo_2026.json), [context](https://svs.gsfc.nasa.gov/5587/) | Every 168th hourly record, unmodified; metadata added outside records |
| `tests/fixtures/usno-events-2026.json` | [USNO phase events](https://aa.usno.navy.mil/api/moon/phases/date?date=2026-10-01&nump=12) and [New York rise/set reference](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-30&coords=40.7142778,-74.0059722&tz=0) | Unmodified JSON responses inside source/hash wrappers; test reference only |

The color product derives from the LROC WAC Hapke-normalized mosaic. It is an
aesthetic visualization product rather than a calibrated scientific image.
LOLA provides measured topography. Both maps are equirectangular: longitude
zero at the center, north at the top, east to the right.

The unsigned source DEM encodes `radius_m = 1727400 + 0.5 * uint16`. For the
8-bit derivative the shader uses `height_m = normalizedPixel * 32767.5 - 10000`,
relative to the 1737.4 km sphere. Quantization is approximately 128.5 m per step;
this display texture does not replace original elevation data. Terrain only
perturbs normals; it does not displace the silhouette or trace cast shadows.

`scripts/fetch-assets.mjs` records original/output SHA-256 digests in
`assets/manifest.json`. It downloads explicit NASA URLs, caches TIFFs, and
converts with lockfile-pinned Sharp/libvips. Run `npm run assets:fetch` to
reproduce. Review manifest changes if NASA replaces a source. Keep the lockfile
when reproducing conversions.

Original instrument data and documentation:

- [LROC WAC normalized mosaic](https://wms.lroc.asu.edu/lroc/view_rdr/WAC_HAPKE_NORMALIZED)
- [NASA PDS LRO LOLA archive](https://pds-geosciences.wustl.edu/missions/lro/lola.htm)

No imagery from TheSkyLive is included. All bundled maps were downloaded
directly from the NASA URLs above. The demo's other marks are text/CSS.
