import { Body, MoonPhase, NextMoonQuarter, Observer, SearchMoonQuarter, SearchRiseSet } from 'astronomy-engine';
import type { Location } from './core.js';

const DAY_MS = 86400000;
// One vocabulary for both standalone labels and event results.
const PHASE_NAMES = ['New Moon', 'First quarter', 'Full Moon', 'Last quarter'] as const;
export interface PhaseEvent {
  name: typeof PHASE_NAMES[number];
  /** 0=new, 1=first quarter, 2=full, 3=last quarter. */
  quarter: 0 | 1 | 2 | 3;
  date: Date;
}
export interface RiseSetOptions {
  observer: Location;
  date?: Date;
  /** Search window in elapsed 24-hour days, not local calendar days. Default 1. */
  days?: number;
}

function instant(date: Date = new Date()): Date {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  return new Date(date.getTime());
}

/**
 * Upcoming geocentric principal phases, strictly after date, in time order.
 * Astronomy Engine searches ecliptic Moon–Sun elongations 0°,90°,180°,270°.
 * Reference: https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#SearchMoonQuarter
 * Definitions: https://aa.usno.navy.mil/faq/moon_phases
 */
export function nextPhases(date: Date = new Date(), count = 4): PhaseEvent[] {
  const start = instant(date);
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Phase count must be a nonnegative safe integer');
  if (!count) return [];
  let event = SearchMoonQuarter(start);
  // A search may converge to the starting event within solver precision.
  // Skip an event at/before the supplied millisecond instead of returning it twice.
  while (event.time.date.getTime() <= start.getTime()) event = NextMoonQuarter(event);
  const result: PhaseEvent[] = [];
  for (let i = 0; i < count; i++) {
    const quarter = event.quarter as PhaseEvent['quarter'];
    result.push({ name: PHASE_NAMES[quarter], quarter, date: new Date(event.time.date.getTime()) });
    if (i+1 < count) event = NextMoonQuarter(event);
  }
  return result;
}

// Labels are a presentation convention: principal phases are exact instants,
// not multi-day bins. Cache just the candidate instants for a UTC day so that
// repeated renders do not repeat the event searches. Bound memory during time
// travel and store numeric timestamps so callers cannot mutate cached Dates.
const labelCandidates = new Map<number, { quarter: number; ms: number }[]>();
export function phaseName(date: Date = new Date()): string {
  const time = instant(date), ms = time.getTime();
  const day = Math.floor(ms / DAY_MS);
  let candidates = labelCandidates.get(day);
  if (!candidates) {
    candidates = nextPhases(new Date(day*DAY_MS - DAY_MS - 1000), 1)
      .filter(event => event.date.getTime() <= (day+2)*DAY_MS)
      .map(event => ({quarter: event.quarter, ms: event.date.getTime()}));
    if (labelCandidates.size >= 32) labelCandidates.delete(labelCandidates.keys().next().value!);
    labelCandidates.set(day, candidates);
  }
  const principal = candidates.find(event => Math.abs(event.ms-ms) <= DAY_MS);
  if (principal) return PHASE_NAMES[principal.quarter];
  const longitude = MoonPhase(time);
  return longitude < 90 ? 'Waxing crescent' : longitude < 180 ? 'Waxing gibbous'
    : longitude < 270 ? 'Waning gibbous' : 'Waning crescent';
}

/**
 * First lunar rise/set strictly after date within days. Each can be null.
 * Upper limb, flat unobstructed horizon, standard 34′ refraction; elevation
 * defaults to 0 m and the eye is on the local ground (no horizon dip).
 * Source: Astronomy Engine SearchRiseSet and USNO rise/set definitions:
 * https://aa.usno.navy.mil/faq/RST_defs
 * Unlike calculateMoon.altitudeDeg, this event model includes refraction.
 */
export function riseSet({ observer, date = new Date(), days = 1 }: RiseSetOptions): { rise: Date | null; set: Date | null } {
  const start = instant(date);
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('Search days must be positive and finite');
  const {latitude, longitude, elevation = 0} = observer;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) throw new RangeError('Latitude must be between -90 and 90 degrees');
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Longitude must be between -180 and 180 degrees');
  // Limits of the dependency's U.S. Standard Atmosphere elevation model.
  if (!Number.isFinite(elevation) || elevation < -500 || elevation > 100000) throw new RangeError('Rise/set elevation must be between -500 and 100000 meters');
  const location = new Observer(latitude, longitude, elevation);
  const end = start.getTime() + days*DAY_MS;
  if (!Number.isFinite(end) || end > 8640000000000000) throw new RangeError('Search window exceeds the supported Date range');
  const find = (direction: number): Date | null => {
    let event = SearchRiseSet(Body.Moon, location, direction, start, days, 0);
    // At an exact event, a numerical search may converge to that same instant.
    // Move one second past it, preserving the caller's original window end.
    if (event && event.date.getTime() <= start.getTime()) {
      const after = new Date(start.getTime()+1000);
      if (after.getTime() >= end) return null;
      event = SearchRiseSet(Body.Moon, location, direction, after, (end-after.getTime())/DAY_MS, 0);
    }
    return event && event.date.getTime() > start.getTime() && event.date.getTime() <= end
      ? new Date(event.date.getTime()) : null;
  };
  return {rise: find(1), set: find(-1)};
}
