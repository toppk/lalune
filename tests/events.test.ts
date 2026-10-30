import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateMoon, phaseName, nextPhases, riseSet} from '../src/core.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/usno-events-2026.json', import.meta.url), 'utf8'));
const observer = {latitude: 40.7142778, longitude: -74.0059722};
const DAY = 86400000;
test('nextPhases agrees with 12 independent USNO event times within two minutes', () => {
  const reference = fixtures.phases.data.phasedata;
  const events = nextPhases(new Date('2026-10-01T00:00:00Z'), reference.length);
  const quarters: Record<string, number> = {'New Moon':0,'First Quarter':1,'Full Moon':2,'Last Quarter':3};
  reference.forEach((expected: {year:number;month:number;day:number;time:string;phase:string}, index: number) => {
    const [hour,minute] = expected.time.split(':').map(Number);
    const time = Date.UTC(expected.year, expected.month-1, expected.day, hour, minute);
    assert.ok(Math.abs(events[index].date.getTime()-time) < 120000, `${expected.phase}: ${events[index].date.toISOString()}`);
    assert.equal(events[index].quarter, quarters[expected.phase]);
    if (index) assert.ok(events[index].date > events[index-1].date);
  });
});

test('nextPhases is strictly future, supports count, and isolates mutable Dates', () => {
  const start = new Date('2026-10-30T00:00:00Z');
  const first = nextPhases(start,1)[0];
  assert.equal(first.name, 'Last quarter');
  assert.equal(nextPhases(first.date,1)[0].quarter,0);
  assert.equal(nextPhases(start).length,4);
  assert.deepEqual(nextPhases(start,0),[]);
  first.date.setUTCFullYear(1900);
  assert.equal(nextPhases(start,1)[0].date.getUTCFullYear(),2026);
  assert.throws(()=>nextPhases(start,-1), /count/);
  assert.throws(()=>nextPhases(start,1.5), /count/);
  assert.throws(()=>nextPhases(new Date(NaN)), /date/);
});

test('principal phase names apply only within 24 hours of the calculated event', () => {
  const events = nextPhases(new Date('2026-10-01T00:00:00Z'));
  const names = ['New Moon','First quarter','Full Moon','Last quarter'];
  for (const event of events) {
    for (const offset of [-DAY+2000,0,DAY-2000]) {
      assert.equal(phaseName(new Date(event.date.getTime()+offset)),names[event.quarter]);
    }
    for (const offset of [-DAY-2000, DAY+2000]) {
      assert.notEqual(phaseName(new Date(event.date.getTime()+offset)),names[event.quarter]);
    }
  }
});

test('the reported 68%-lit regression is waning gibbous in both APIs', () => {
  const date = new Date('2026-10-31T08:00:00Z');
  const moon = calculateMoon({date,observer});
  assert.ok(moon.illuminatedFraction>0.66 && moon.illuminatedFraction<0.69);
  assert.equal(phaseName(date),'Waning gibbous');
  assert.equal(moon.phaseName,phaseName(date));
});

test('riseSet agrees with the independent USNO upper-limb reference within 90 seconds', () => {
  const expected = fixtures.riseSet.data.properties.data;
  const start = new Date(Date.UTC(expected.year,expected.month-1,expected.day));
  const times = riseSet({observer,date:start});
  for (const [key, phenomenon] of [['rise','Rise'], ['set','Set']] as const) {
    const [hour,minute] = expected.moondata.find((r: {phen:string})=>r.phen===phenomenon).time.split(':').map(Number);
    assert.ok(times[key]);
    assert.ok(Math.abs(times[key]!.getTime()-start.getTime()-hour*3600000-minute*60000)<90000);
  }
});

test('riseSet selects the next event, respects the window, and handles polar non-events', () => {
  const date = new Date('2026-10-30T12:00:00Z');
  const events = riseSet({observer,date});
  assert.ok(events.rise!>date && events.set!>date);
  assert.equal(events.rise!.getUTCDate(),31);
  assert.equal(events.set!.getUTCDate(),30);
  assert.deepEqual(riseSet({observer,date,days:0.001}),{rise:null,set:null});
  assert.deepEqual(riseSet({observer:{latitude:90,longitude:0},date}),{rise:null,set:null});
  assert.throws(()=>riseSet({observer,date,days:0}), /days/);
  assert.throws(()=>riseSet({observer:{latitude:91,longitude:0},date}), /Latitude/);
  assert.throws(()=>riseSet({observer:{...observer,elevation:-501},date}), /elevation/);
});

test('riseSet upper-limb crossings include refraction and have the correct direction', () => {
  const events = riseSet({observer,date:new Date('2026-10-30T00:00:00Z')});
  for (const [key,direction] of [['rise',1],['set',-1]] as const) {
    const date = events[key]!;
    const moon = calculateMoon({observer,date});
    // Geometric altitude + lunar angular radius + standard 34′ refraction ≈ 0.
    assert.ok(Math.abs(moon.altitudeDeg+moon.angularDiameterDeg/2+34/60)<0.02);
    const before = calculateMoon({observer,date:new Date(date.getTime()-30000)}).altitudeDeg;
    const after = calculateMoon({observer,date:new Date(date.getTime()+30000)}).altitudeDeg;
    assert.ok(direction*(after-before)>0);
  }
});
