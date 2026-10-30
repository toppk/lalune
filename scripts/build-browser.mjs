import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
// Keep the verbatim dependency notices with the standalone bundles. Astronomy
// Engine embeds its MIT license in the published source rather than LICENSE.
const astronomy = await readFile('node_modules/astronomy-engine/astronomy.js', 'utf8');
const start = astronomy.indexOf('    MIT License');
const end = astronomy.indexOf('*/', start);
if (start < 0 || end < 0) throw new Error('Could not locate Astronomy Engine MIT notice');
const astronomyNotice = astronomy.slice(start, end).replace(/^    /gm, '').trim();
const notices = [
  ['La Lune', await readFile('LICENSE', 'utf8')],
  ['three.js', await readFile('node_modules/three/LICENSE', 'utf8')],
  ['Astronomy Engine', astronomyNotice],
].map(([name, license]) => `${name}\n${'-'.repeat(name.length)}\n\n${license.trim()}\n`).join('\n');
await writeFile('THIRD_PARTY_NOTICES.txt', notices);

for (const [entry, globalName, outfile] of [
  ['src/core.ts', 'LaLuneCore', 'dist/lalune-core.iife.min.js'],
  ['src/index.ts', 'LaLune', 'dist/lalune.iife.min.js'],
]) {
  const result = await build({
    entryPoints: [entry], outfile, globalName,
    bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'es2022',
    legalComments: 'none', metafile: true,
    plugins: [{
      name: 'side-effect-free-three-entry',
      setup(build) {
        build.onResolve({filter: /^three$/}, () => ({path: resolve('scripts/three-browser-entry.mjs')}));
      },
    }],
    banner: { js: `/*! ${pkg.name} ${pkg.version} | MIT | Bundled dependency licenses: THIRD_PARTY_NOTICES.txt | NASA assets: ASSETS.md */` },
  });
  if (globalName === 'LaLuneCore' && Object.keys(result.metafile.inputs).some(path => /node_modules\/three\//.test(path))) {
    throw new Error('Calculations-only bundle unexpectedly includes three.js');
  }
  console.log(`${outfile}: ${result.metafile.outputs[outfile].bytes} bytes (${globalName})`);
}
