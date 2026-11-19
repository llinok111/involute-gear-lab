// Deterministic gear preset generator: node tools/gen-sample.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gearProfile, profileArea, extrudeProfile, meshVolume, meshEdgeStats } from '../src/core.mjs';

const PRESETS = [
  { name: 'spur-20', teeth: 20, module: 2, pressureAngle: 20 },
  { name: 'spur-40', teeth: 40, module: 2, pressureAngle: 20 },
  { name: 'pinion-12-undercut', teeth: 12, module: 2, pressureAngle: 20 },
  { name: 'fine-30', teeth: 30, module: 1, pressureAngle: 20 },
  { name: 'stub-25', teeth: 25, module: 2, pressureAngle: 25 },
];

export function buildCorpus() {
  return {
    format: 'involute-gear-corpus/v1',
    presets: PRESETS.map((p) => {
      const { points, params } = gearProfile({ ...p, flankSamples: 32, tipSamples: 3, rootSamples: 2 });
      const mesh = extrudeProfile(points, 6);
      return {
        name: p.name,
        input: p,
        points,
        radii: { pitch: params.r, base: params.rb, tip: params.ra, root: params.rf },
        area: profileArea(points),
        volume: meshVolume(mesh),
        watertight: meshEdgeStats(mesh).boundary === 0,
      };
    }),
  };
}

export function corpusText() { return JSON.stringify(buildCorpus()); }

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..');
  const text = corpusText();
  const sha = crypto.createHash('sha256').update(text).digest('hex');
  if (process.argv.includes('--check')) {
    const file = path.join(root, 'data', 'gears.json');
    if (!fs.existsSync(file)) { console.error('gen-check: data/gears.json missing'); process.exit(1); }
    if (fs.readFileSync(file, 'utf8') !== text) { console.error('gen-check: NOT byte-identical'); process.exit(1); }
    console.log(`gen-check: byte-identical sha256=${sha}`);
    return;
  }
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'gears.json'), text);
  const c = JSON.parse(text);
  console.log(`wrote data/gears.json presets=${c.presets.length} points=${c.presets.reduce((s, p) => s + p.points.length, 0)} bytes=${Buffer.byteLength(text)} sha256=${sha}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
