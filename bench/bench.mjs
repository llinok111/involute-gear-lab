// 1 cold run + 5 warm samples; closed form vs 200k-point scan.
import fs from 'node:fs';
import { gearProfile, extrudeProfile, meshVolume, contactRatio, meshEdgeStats } from '../src/core.mjs';
import { numericContactRatio } from '../baseline/naive.mjs';

const TEETH = 24, MODULE = 2, FLANK = 64, THICKNESS = 6, SAMPLES = 5;
function job() {
  const { points, params } = gearProfile({ teeth: TEETH, module: MODULE, pressureAngle: 20, flankSamples: FLANK });
  const mesh = extrudeProfile(points, THICKNESS);
  return { points: points.length, tris: mesh.faces.length, volume: meshVolume(mesh), boundary: meshEdgeStats(mesh).boundary, params };
}
const t0 = performance.now();
const cold = job();
const coldMs = performance.now() - t0;
job();
const times = [];
for (let i = 0; i < SAMPLES; i++) {
  const t = performance.now(); job(); times.push(performance.now() - t);
}
const sorted = [...times].sort((a, b) => a - b);
const median = sorted[sorted.length >> 1];
const mean = times.reduce((a, b) => a + b, 0) / times.length;
const stddev = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / (times.length - 1));
const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * SAMPLES) - 1)];

const opts = { teeth1: 20, teeth2: 40, module: 2, pressureAngle: 20 };
const closed = contactRatio(opts);
let t = performance.now();
for (let i = 0; i < 10000; i++) contactRatio(opts);
const closedUs = ((performance.now() - t) * 1000) / 10000;
const t1 = performance.now();
const numeric = numericContactRatio(opts, 200000);
const numericMs = performance.now() - t1;

const result = {
  generated_at: new Date().toISOString(),
  node: process.version,
  mesh: { teeth: TEETH, module: MODULE, flankSamples: FLANK, thickness: THICKNESS, points: cold.points, triangles: cold.tris },
  cold_ms: +coldMs.toFixed(3),
  samples: times.map((x) => +x.toFixed(3)),
  sample_count: SAMPLES,
  min_ms: +sorted[0].toFixed(3),
  median_ms: +median.toFixed(3),
  mean_ms: +mean.toFixed(3),
  p95_ms: +p95.toFixed(3),
  stddev_ms: +stddev.toFixed(3),
  rsd_pct: +(100 * stddev / mean).toFixed(2),
  volume: +cold.volume.toFixed(6),
  boundary_edges: cold.boundary,
  contact_ratio: { closed_form: +closed.toFixed(9), numeric_200k: +numeric.ratio.toFixed(9), rel_err: +(Math.abs(closed - numeric.ratio) / closed).toExponential(2), closed_us: +closedUs.toFixed(4), numeric_ms: +numericMs.toFixed(3), speedup_per_call: +(numericMs * 1000 / closedUs).toFixed(0) },
};
fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
