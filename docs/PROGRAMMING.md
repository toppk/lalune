# La Lune programming guide

La Lune calculates and renders the Moon for a time and an observer on Earth.
It is an ESM JavaScript package with TypeScript declarations. A framework is
optional; a bundler such as Vite is the easiest way to use the renderer and maps.
There is no separate script-tag/UMD build at present.

This guide covers the 0.1.0 API. The npm package name is `@toppk/lalune`.
Install a published release with `npm install @toppk/lalune`, or use a local
tarball as described below.

## Install from this repository

In the library checkout:

```sh
npm ci
npm pack
```

`npm pack` builds the library and writes `toppk-lalune-0.1.0.tgz`. In your application:

```sh
npm install /absolute/path/to/toppk-lalune-0.1.0.tgz
```

The tarball contains compiled JavaScript, declarations, maps, documentation,
and license/provenance notices. Consumers do not need the source TIFFs, Sharp,
or the asset download script.

## Complete browser example (Vite)

Add a container to your application's HTML. Its height must be nonzero:

```html
<div id="moon" style="width: min(100%, 480px); height: 480px"></div>
<p id="status" role="status"></p>
```

In your application's JavaScript module:

```js
import { MoonView } from '@toppk/lalune';
import textureUrl from '@toppk/lalune/assets/moon-color-4k.jpg?url';
import heightUrl from '@toppk/lalune/assets/moon-height-4k.png?url';

const container = document.querySelector('#moon');
const status = document.querySelector('#status');
let moon;
let timer;

async function start() {
  try {
    status.textContent = 'Loading lunar maps…';
    moon = new MoonView(container, {
      observer: {
        latitude: 48.8534167,
        longitude: 2.3488056, // east is positive; west is negative
        elevation: 0,       // meters above sea level
      },
      date: new Date(),
      textureUrl,
      heightUrl,            // optional; omit for a smaller download
      orientation: 'horizon',
      sky: false,           // transparent background
      darkSide: 0,          // no artificial night-side fill
    });
    await moon.ready;
    status.textContent = '';

    // The library has no clock/animation loop. Advance time explicitly.
    timer = setInterval(() => {
      const state = moon.update({ date: new Date() });
      status.textContent = `${state.phaseName}, ${
        (100 * state.illuminatedFraction).toFixed(1)
      }% illuminated`;
    }, 60_000);
  } catch (error) {
    moon?.dispose();
    status.textContent = 'The Moon could not load. Check WebGL2 and asset URLs.';
    console.error(error);
  }
}

// Call when removing this widget or unmounting its owning component.
function stop() {
  clearInterval(timer);
  moon?.dispose();
}

void start();
```

Call `stop()` from your application's lifecycle cleanup. Instantiate only on
the client when using server-rendered frameworks. TypeScript/Vite projects
should include Vite's usual `vite/client` ambient types for `?url` imports.

## Serving the images

Installing an npm package does **not** create public `/assets/` URLs on your
website. Choose one of these approaches:

- **Vite asset imports**, as above. The bundler copies and fingerprints the
  files and returns working URLs, including a configured deployment base path.
- **Copy to your public directory.** Copy the files from
  `node_modules/@toppk/lalune/assets/` to your application's static directory. Pass
  URLs matching your deployment, such as `/assets/moon-color-4k.jpg`. Account
  for any subdirectory prefix in your site's URL.

Both maps together are approximately 6.4 MB. The color map alone is about
3.3 MB. Only files your application imports/serves and the viewer requests are
needed by the browser. `@toppk/lalune/core` loads no textures. Use ordinary HTTP cache
headers and versioned URLs when serving the images yourself. A different origin
must permit CORS, because WebGL uploads the images as textures. Self-hosting
avoids relying on NASA's servers at runtime.

## Constructor options

`new MoonView(container, options)` accepts an `HTMLElement` and:

| Option | Required/default | Meaning |
| --- | --- | --- |
| `observer` | Required | `{ latitude, longitude, elevation? }`; degrees north/east, meters above sea level; elevation defaults to 0 |
| `textureUrl` | Required | URL of an sRGB, equirectangular lunar color map with longitude zero at the center |
| `heightUrl` | Omitted | Optional linear height map using the bundled LOLA derivative's encoding; arbitrary grayscale pictures are incompatible |
| `date` | Current time | JavaScript `Date`, an absolute instant |
| `orientation` | `'horizon'` | `'horizon'`: local zenith up; `'north'`: celestial north up |
| `sky` | `false` | Sun-driven opaque sky and illustrative foreground haze; `false` restores transparency |
| `darkSide` | `0.015` | Artificial night-side fill, 0–0.2; 0 disables it; not modeled earthshine |
| `pixelRatio` | Device ratio, capped at 2 | Rendering resolution; set 1 for lower GPU/memory cost |

`ready` resolves when the requested textures load, and rejects if loading fails.
WebGL setup or invalid inputs may throw synchronously in the constructor.

## Updating and lifecycle

```js
moon.update({ date: new Date('2026-10-30T11:41:22Z') });
moon.update({ observer: { latitude: 34.0522222, longitude: -118.2436667 } });
moon.update({ orientation: 'north', sky: true, darkSide: 0 });
const snapshot = moon.state;
moon.dispose();
```

`update()` returns a fresh state snapshot and retains unspecified options.
Supply the whole `observer` object when replacing a location; its properties
are not merged individually. Texture URLs and pixel ratio are fixed at
construction; create a new instance to change them. Do not update after
`dispose()`. Disposal removes the canvas, disconnects resize observation, and
releases WebGL resources; repeated disposal is harmless.

The viewer observes container size changes automatically and renders on demand.
There are no update events or frame callbacks; read the return value of
`update()` and refresh your own text/overlays then. Reproject overlays after
container resizes too. Keep references to the instance and any timer you create
so you can release both when the widget is removed.

## Dates and local time

Use a `Date` with an explicit timezone offset or `Z` when parsing a string.
`new Date('2026-10-30T11:41:22Z')` is unambiguous. A timezone does not belong in
`observer`: it affects display, not the physical instant used by the ephemeris.

```js
const localTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris',
}).format(moon.state.date);
```

The same UTC instant can be daytime in Paris and nighttime in Los Angeles.
Timezone conversion must not change that instant. Latitude and longitude
determine the Moon's orientation and solar altitude independently of timezone.

## Calculations without WebGL

```js
import { calculateMoon, calculateSky } from '@toppk/lalune/core';

const state = calculateMoon({
  observer: { latitude: 40.7142778, longitude: -74.0059722 },
  date: new Date('2026-10-30T11:41:22Z'),
});
const sky = calculateSky(state.sunAltitudeDeg);
console.log(state.altitudeDeg, sky.period);
```

`@toppk/lalune/core` works in Node or the browser without the DOM or loading Three.js.
The npm package still declares Three.js as a dependency, so npm installs it
even when your application imports only the calculation entry point.

| State fields | Meaning |
| --- | --- |
| `date`, `observer`, `orientation` | Time and normalized observer/options used |
| `distanceKm` | Observer-to-Moon-center distance in km, not Earth-center distance |
| `angularDiameterDeg` | Actual angular diameter in degrees; the drawn disk is fitted to its container |
| `altitudeDeg`, `azimuthDeg` | Geometric center altitude; azimuth increases eastward from north, in degrees |
| `sunAltitudeDeg` | Geometric Sun-center altitude for the observer, in degrees |
| `illuminatedFraction` | Fraction of the projected disk illuminated, 0–1; not a brightness measurement |
| `phaseAngleDeg` | Sun–Moon–observer angle, in degrees |
| `phaseLongitudeDeg`, `phaseName` | Geocentric phase elongation, in degrees, and a coarse phase label |
| `subObserver`, `subSolar` | `{ longitudeDeg, latitudeDeg }` on the lunar surface, east/north positive |
| `viewDirection`, `sunDirection`, `upDirection` | Unit vectors in the lunar body frame; conventions in SCIENCE.md |

`calculateSky()` returns an illustrative CSS hex `color`, a 0–1 `daylight`
display weight, and `period`. To extend an enabled sky beyond the canvas, set
the parent background to `calculateSky(moon.state.sunAltitudeDeg).color`.

Advanced exported geometry helpers are `lunarAxes(date)` (EQJ body basis),
`surfaceDirection(latitudeDeg, longitudeDeg)` (lunar body unit vector), `dot`,
`cross`, and `normalize`; `MOON_RADIUS_KM` is the LRO reference radius.

## Surface annotations

```js
const point = moon.project(lunarLatitude, lunarEastLongitude);
label.hidden = !point.visible || !point.illuminated;
label.style.left = `${point.x}px`;
label.style.top = `${point.y}px`;
```

Coordinates are CSS pixels relative to the viewer container. Use a positioned
parent and absolutely positioned labels. `visible` and `illuminated` are separate
flags: the method does not hide DOM elements for you. Feature names and
coordinates are not bundled; cite your own data sources when adding them.

## Expectations and troubleshooting

- If the widget is blank, check container dimensions, WebGL2, and `ready`
  rejection. Inspect network errors and CORS for the textures.
- If updates stop, make sure your application still calls `update()` with a
  new date. The viewer deliberately has no automatic clock.
- If the Moon is below the horizon, it is still rendered for exploration.
  Your application can hide it when `state.altitudeDeg < 0`.
- The disk is enlarged to fit its container; it is not drawn at its apparent
  angular size against a surrounding sky chart.
- Daylight tint and dark-side fill are illustrative. There are no stars,
  eclipse shadows, terrain cast shadows, or weather simulation.
- Tests compare weekly samples during 2026. This is a visualization library,
  not a precision scientific measurement or navigation instrument.

See [scientific models, derivations, and limits](SCIENCE.md) and
[image provenance and NASA credits](../ASSETS.md). Code is MIT licensed;
NASA assets have their separately documented public-domain status. Include
the MIT copyright/license notice when distributing the code, and preserve
the asset provenance and requested NASA credit with the maps.
