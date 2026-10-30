import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

test('classic scripts load core first and full later without DOM, network, GPU, or other global changes', () => {
  const sandbox = {Date, AbortController, URL, console};
  sandbox.window = sandbox;
  for (const name of ['document','fetch','XMLHttpRequest','WebGL2RenderingContext']) {
    Object.defineProperty(sandbox,name,{get(){throw new Error(`Eager ${name} access`);},configurable:true});
  }
  const context = createContext(sandbox);
  const evaluate = path => {
    try { runInContext(readFileSync(path,'utf8'),context); }
    catch (error) { assert.fail(error.message); }
  };
  const before = new Set(Object.keys(sandbox));
  evaluate('dist/lalune-core.iife.min.js');
  assert.equal(typeof sandbox.LaLuneCore.phaseName,'function');
  assert.equal(sandbox.LaLuneCore.MoonView,undefined);
  assert.equal(sandbox.LaLuneCore.phaseName(new Date('2026-10-31T08:00:00Z')),'Waning gibbous');
  const core = sandbox.LaLuneCore;
  evaluate('dist/lalune.iife.min.js');
  assert.equal(sandbox.LaLuneCore,core);
  assert.equal(typeof sandbox.LaLune.MoonView,'function');
  for (const name of ['calculateMoon','phaseName','riseSet','nextPhases','calculateSky']) {
    assert.equal(typeof sandbox.LaLune[name],'function');
  }
  for (const api of [sandbox.LaLuneCore,sandbox.LaLune]) {
    for (const event of api.nextPhases(new Date('2026-10-01T00:00:00Z'))) {
      assert.equal(event.name,['New Moon','First quarter','Full Moon','Last quarter'][event.quarter]);
      assert.equal(event.name,api.phaseName(event.date));
    }
  }
  assert.deepEqual(Object.keys(sandbox).filter(key=>!before.has(key)).sort(),['LaLune','LaLuneCore']);
});

test('standalone distribution includes all three copyright and MIT notices', () => {
  const notices = readFileSync('THIRD_PARTY_NOTICES.txt','utf8');
  for (const marker of ['La Lune contributors','three.js authors','Don Cross']) assert.ok(notices.includes(marker));
  assert.equal(notices.match(/Permission is hereby granted/g).length,3);
});
