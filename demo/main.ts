import { MoonView, calculateSky, type Orientation, type MoonState } from '../src/index.js';
import colorUrl from '../assets/moon-color-4k.jpg?url';
import heightUrl from '../assets/moon-height-4k.png?url';
import './style.css';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const text = (id: string, value: string) => { element(id).textContent = value; };
const places: Record<string, [number, number, string, string]> = {
  // User-supplied position: 40°42′51.4″ N, 74°00′21.5″ W.
  nyc: [40 + 42/60 + 51.4/3600, -(74 + 21.5/3600), 'NEW YORK', 'America/New_York'],
  // User-supplied position: 34°03′08.0″ N, 118°14′37.2″ W.
  la: [34 + 3/60 + 8/3600, -(118 + 14/60 + 37.2/3600), 'LOS ANGELES', 'America/Los_Angeles'],
  // User-supplied position: 48°51′12.3″ N, 2°20′55.7″ E.
  paris: [48 + 51/60 + 12.3/3600, 2 + 20/60 + 55.7/3600, 'PARIS', 'Europe/Paris'],
};
let anchor = new Date();
let date = new Date(anchor);
let live = true;
let playing = false;
let view: MoonView | undefined;
let elevation = 0;
let timeZone = 'America/New_York';
const dateValue = () => date.toISOString().slice(0, 19);
input('date').value = dateValue();
const snippet = `import { MoonView } from 'lalune';

const moon = new MoonView(container, {
  observer: { latitude: 40.7142778, longitude: -74.0059722 },
  date: new Date(),
  textureUrl: '/assets/moon-color-4k.jpg',
  heightUrl: '/assets/moon-height-4k.png',
});
await moon.ready;

// Change the view. Clean up when unmounting.
moon.update({ date: new Date() });
// moon.dispose();`;
text('snippet', snippet);

function display(state: MoonState) {
  text('phase', state.phaseName);
  text('illumination', `${(state.illuminatedFraction*100).toFixed(1)}%`);
  text('altitude', `${state.altitudeDeg.toFixed(1)}°`);
  text('azimuth', `${state.azimuthDeg.toFixed(1)}°`);
  text('distance', `${Math.round(state.distanceKm).toLocaleString('en-US')} km`);
  text('diameter', `${(state.angularDiameterDeg*60).toFixed(1)}′`);
  text('visibility', state.altitudeDeg >= 0 ? 'Above your horizon' : 'Below your horizon');
  const sky = calculateSky(state.sunAltitudeDeg);
  const skyEnabled = input('sky-colors').checked;
  const skyPanel = element('moon').closest<HTMLElement>('.sky')!;
  skyPanel.style.backgroundColor = skyEnabled ? sky.color : '';
  skyPanel.dataset.skyColors = String(skyEnabled);
  text('sun-altitude', `${state.sunAltitudeDeg.toFixed(1)}°`);
  text('sky-period', sky.period);
  element('visibility').classList.toggle('below', state.altitudeDeg < 0);
  // Intl applies IANA timezone rules, including historical DST transitions.
  // Never derive UTC by subtracting a fixed New York offset.
  const local = date.toLocaleString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short'});
  text('time-label', local);
  text('local-time', `${local} · ${timeZone}`);
  text('mode-label', live ? 'LIVE OBSERVATION' : 'EXPLORING TIME');
  text('orientation-label', state.orientation === 'horizon' ? 'LOCAL ZENITH ↑' : 'CELESTIAL NORTH ↑');
}
function update() {
  if (!(element<HTMLFormElement>('controls')).checkValidity()) return;
  try {
    const options = {
      date, observer: {latitude: Number(input('latitude').value), longitude: Number(input('longitude').value), elevation},
      orientation: input('orientation').value as Orientation,
      darkSide: input('dark-side').checked ? 0.015 : 0,
      sky: input('sky-colors').checked,
    };
    if (!view) {
      view = new MoonView(element('moon'), { ...options, textureUrl: colorUrl, heightUrl });
      view.ready.then(() => {
        element('moon').setAttribute('aria-busy', 'false');
        text('render-status', '');
      }).catch((error: Error) => {
        element('moon').setAttribute('aria-busy', 'false');
        text('render-status', `Could not load lunar maps: ${error.message}`);
      });
    } else view.update(options);
    display(view.state);
    text('message', '');
  } catch (error) {
    text('render-status', `Unable to render the Moon: ${(error as Error).message}. A WebGL2-capable browser is required.`);
  }
}
function stopPlaying() { playing = false; text('play', '▶ Travel through time'); }
function syncDate() {
  input('date').value = dateValue();
  input('time').value = String((date.getTime()-anchor.getTime())/86400000);
  update();
}
element('location').addEventListener('change', () => {
  const place = places[input('location').value];
  if (!place) { timeZone = 'UTC'; text('sky-location', 'CUSTOM LOCATION'); update(); return; }
  input('latitude').value = place[0].toFixed(7); input('longitude').value = place[1].toFixed(7);
  elevation = 0; timeZone = place[3]; text('sky-location', place[2]); update();
});
for (const id of ['latitude', 'longitude']) input(id).addEventListener('input', () => {
  input('location').value = 'custom'; elevation = 0; timeZone = 'UTC'; text('sky-location', 'CUSTOM LOCATION'); update();
});
element('controls').addEventListener('submit', e => e.preventDefault());
function applyPickedDate() {
  if (!input('date').value || !input('date').validity.valid) return;
  const next = new Date(input('date').value + 'Z');
  if (!Number.isFinite(next.getTime())) return;
  live = false; stopPlaying(); date = next; anchor = new Date(date);
  // Apply while the native picker is open. Avoid writing back to its value:
  // that can interrupt the segment the user is currently editing.
  input('time').value = '0';
  update();
}
input('date').addEventListener('input', applyPickedDate);
input('date').addEventListener('change', applyPickedDate);
for (const id of ['orientation', 'dark-side', 'sky-colors']) input(id).addEventListener('change', update);
input('time').addEventListener('input', () => {
  live = false; stopPlaying(); date = new Date(anchor.getTime() + Number(input('time').value)*86400000); syncDate();
});
element('now').addEventListener('click', () => {
  live = true; stopPlaying(); anchor = new Date(); date = new Date(anchor); syncDate();
});
element('play').addEventListener('click', () => {
  live = false; playing = !playing;
  text('play', playing ? 'Ⅱ Pause time travel' : '▶ Travel through time');
});
element('locate').addEventListener('click', () => {
  if (!navigator.geolocation) { text('message', 'Geolocation is unavailable. Enter coordinates above.'); return; }
  text('message', 'Finding your location…');
  navigator.geolocation.getCurrentPosition(position => {
    input('latitude').value = position.coords.latitude.toFixed(5);
    input('longitude').value = position.coords.longitude.toFixed(5);
    elevation = position.coords.altitude ?? 0;
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    input('location').value = 'custom'; text('sky-location', 'YOUR LOCATION'); update();
  }, () => text('message', 'Location unavailable. You can enter coordinates above.'), {timeout: 10000});
});
element('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(snippet); text('copy', 'Copied'); }
  catch { text('copy', 'Select code to copy'); }
});
const timer = window.setInterval(() => {
  if (document.hidden) return;
  if (live) { date = new Date(); anchor = new Date(date); syncDate(); }
  else if (playing) {
    date = new Date(date.getTime() + 3*3600000);
    if ((date.getTime()-anchor.getTime())/86400000 > 14) date = new Date(anchor.getTime()-14*86400000);
    syncDate();
  }
}, 1000);
window.addEventListener('pagehide', event => {
  // A bfcache navigation preserves the page; leave resources for its return.
  if (!event.persisted) { clearInterval(timer); view?.dispose(); }
});
update();
