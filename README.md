# La Lune

The Moon, from where you stand. A TypeScript library for rendering an
observer-aware Moon on any website, with a small interactive demo.

[Explore the live demo](https://toppk.github.io/lalune/) ·
[View on npm](https://www.npmjs.com/package/@toppk/lalune)

Code is MIT licensed. Bundled NASA assets have separate public-domain
provenance and credits in [ASSETS.md](ASSETS.md). No API key or daily ephemeris
download is required. Calculations run locally; images can be self-hosted.

For integration, see the [programming guide](docs/PROGRAMMING.md): complete
setup, asset serving, all options/defaults, API results, lifecycle, and examples.

Version 0.2.0 adds standalone classic-script bundles, narrower
phase names, rise/set and next-phase APIs, tint/brightness, and optional 2K maps.
See [what changed](CHANGELOG.md) and the [classic-script example](examples/classic.html).

## Run the demo

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the printed local URL. Choose New York City, Los Angeles, or Paris, enter manual
coordinates, or use browser geolocation. All presets use the supplied exact
DMS coordinates. Local time uses IANA timezone rules; the date editor is
explicitly UTC, avoiding ambiguous times at daylight-saving transitions.

Time travel advances one simulated day every 20 seconds at approximately
12 updates per second, looping from +14 days back to −14 days. Playback pauses
while the tab is hidden and resumes without catching up on time spent away.

## Embed

Install the public package:

```sh
npm install @toppk/lalune
```

For local development, build it with `npm run build:lib`, use a local package
link or `npm pack`, then import `@toppk/lalune` in your consuming project.

Without a build tool, copy `dist/lalune-core.iife.min.js` (global `LaLuneCore`)
and `dist/lalune.iife.min.js` (global `LaLune`) from the package. They can load
core first and full on demand; full also exports the core API. Keep
`THIRD_PARTY_NOTICES.txt` and `ASSETS.md` with vendored copies.

```ts
import { MoonView } from '@toppk/lalune';
// Bundlers can import asset URLs via @toppk/lalune/assets/moon-color-4k.jpg.

const moon = new MoonView(document.querySelector<HTMLElement>('#moon')!, {
  observer: { latitude: 40.7142778, longitude: -74.0059722, elevation: 0 },
  date: new Date(),
  orientation: 'horizon',
  textureUrl: '/assets/moon-color-4k.jpg',
  heightUrl: '/assets/moon-height-4k.png', // optional terrain normal shading
  darkSide: 0, // unlit night side
  // Optional display styling: tint: '#C08A6C', brightness: 0.55
});
await moon.ready; // handle rejection if an image cannot load

moon.update({ date: new Date('2026-10-30T11:00:00Z') });
console.log(moon.state.altitudeDeg);
// On unmount:
moon.dispose();
```

Give the container explicit dimensions, e.g. `width: 400px; height: 400px`.
The canvas is transparent by default and renders on updates/resizes. It does not own an animation
loop or advance time automatically. Update it at your desired cadence. Use a
WebGL2-capable browser and catch constructor errors to show a fallback.
Asset URLs are fixed per instance. Updating options accepts a complete
replacement observer, plus date, orientation, dark-side fill, `sky`, `tint`, and `brightness`.

Set `sky: true` for a Sun-driven sky background and approximate daylight haze;
`moon.update({ sky: false })` restores transparency. The demo's **Sky colors**
toggle enables this effect by default. Solar altitude is calculated for the
observer; the colors and haze are illustrative, not a weather simulation.
`calculateSky(state.sunAltitudeDeg)` is also exported from `@toppk/lalune/core` for
matching your own container background to the renderer.

`horizon` puts local zenith up; `north` puts celestial north of date up. The
camera fits the disk to the container, so its on-screen diameter is constant;
the returned angular diameter reflects the actual observer distance. The
library still returns and renders the Moon below the horizon; a host can hide
it based on `state.altitudeDeg`.

For overlays, `moon.project(latitudeDeg, eastLongitudeDeg)` returns CSS pixel
coordinates and limb visibility / illumination flags. Data for annotations
should have its own scientific provenance.

## Calculations without a renderer

```ts
import { calculateMoon } from '@toppk/lalune/core';

const state = calculateMoon({
  date: new Date(),
  observer: { latitude: 34.0522222, longitude: -118.2436667 },
});
```

For phase-only calls, use `phaseName(date)` without an observer. `nextPhases(date,
count = 4)` returns chronological `{ name, quarter, date }` events. `riseSet({
observer, date, days = 1 })` returns upcoming `{ rise, set }` Dates or `null` for
each event not found in the elapsed-day search window. These are separate
functions, so a widget can query events when its caption changes rather than
on every rendered frame.

This import has no DOM or Three.js dependency. Results include geometric
altitude, azimuth, distance, angular diameter, illuminated fraction, phase,
sub-observer/subsolar coordinates, and body-frame camera/light directions.
Latitude and longitude are degrees (east positive), elevation is meters above
sea level, and `Date` is an absolute instant. Timezones belong to display, not
orbital geometry. See [scientific models and limits](docs/SCIENCE.md).

## Development

```sh
npm run check
npm test
npm run build        # dist/ library; demo-dist/ static demo
npm run test:bundles # classic script loading and combined notices
npm pack --dry-run
npm run assets:fetch # optional; assets are already bundled
```

Tests use committed NASA 2026 ephemeris records with source URL/checksum and
run offline. Source TIFFs are cached in ignored `.asset-cache/`; generated
browser maps are tracked. The demo deploys to [GitHub Pages](https://toppk.github.io/lalune/)
from `master` using `.github/workflows/pages.yml`.

All bundled maps come directly from NASA, with source URLs and checksums in
[ASSETS.md](ASSETS.md). See [release instructions](docs/RELEASING.md) for packaging
and npm publication.
