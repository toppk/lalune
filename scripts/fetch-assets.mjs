import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Source files are cached so conversions can be repeated without downloading.
const base = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/';
await mkdir('.asset-cache', { recursive: true });
await mkdir('assets', { recursive: true });
const sources = ['lroc_color_16bit_srgb_4k.tif', 'ldem_16_uint.tif'];
const manifest = { sourcePage: 'https://svs.gsfc.nasa.gov/4720/', files: [] };
for (const name of sources) {
  let input;
  try { input = await readFile(`.asset-cache/${name}`); }
  catch {
    console.log(`Downloading ${name}`);
    const response = await fetch(base + name);
    if (!response.ok) throw new Error(`${response.status}: ${base + name}`);
    input = Buffer.from(await response.arrayBuffer());
    await writeFile(`.asset-cache/${name}`, input);
  }
  const color = name.startsWith('lroc');
  // uint LOLA elevation is half-meters above radius 1727.4 km.
  // Converting the full 16-bit range to 8 bits preserves this linear mapping.
  for (const width of [4096, 2048]) {
    const size = width === 4096 ? '4k' : '2k';
    const output = color ? `moon-color-${size}.jpg` : `moon-height-${size}.png`;
    const pipeline = sharp(input).resize({ width });
    if (color) await pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(`assets/${output}`);
    else await pipeline.toColourspace('b-w').png().toFile(`assets/${output}`);
    const result = await readFile(`assets/${output}`);
    manifest.files.push({ file: output, source: base + name,
      sourceSha256: createHash('sha256').update(input).digest('hex'),
      sha256: createHash('sha256').update(result).digest('hex') });
  }
}
await writeFile('assets/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
