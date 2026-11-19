// Assertions with printed values. Exit 0 only when every check passes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildCorpus, corpusText } from '../tools/gen-sample.mjs';
import {
  gearProfile, gearParams, profileArea, extrudeProfile, meshVolume, meshEdgeStats,
  contactRatio, undercutLimit, isUndercut, toothThicknessAtPitch, meshBounds,
} from '../src/core.mjs';
import { numericContactRatio } from '../baseline/naive.mjs';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`PASS ${name} | ${detail}`); }
  else { failed++; console.log(`FAIL ${name} | ${detail}`); }
}
const near = (a, b, rel) => Math.abs(a - b) <= Math.abs(b) * rel;

const corpus = buildCorpus();
const fileText = fs.readFileSync(new URL('../data/gears.json', import.meta.url), 'utf8');
const sha = crypto.createHash('sha256').update(fileText).digest('hex');
check('G7 deterministic corpus', fileText === corpusText(), `sha256=${sha} bytes=${fileText.length}`);

const thickness = 6;
for (const p of corpus.presets) {
  const mesh = extrudeProfile(p.points, thickness);
  const vol = meshVolume(mesh);
  const exp = p.area * thickness;
  check(`volume ${p.name}`, near(vol, exp, 1e-12), `volume=${vol.toFixed(6)} area*t=${exp.toFixed(6)} relErr=${(Math.abs(vol - exp) / exp).toExponential(2)}`);
  const es = meshEdgeStats(mesh);
  check(`watertight ${p.name}`, es.boundary === 0 && es.nonManifold === 0,
    `edges=${es.edges} boundary=${es.boundary} nonManifold=${es.nonManifold} faces=${mesh.faces.length}`);
  const b = meshBounds(mesh);
  check(`extrusion ${p.name}`, near(b.max[2] - b.min[2], thickness, 1e-12), `z=${b.min[2]}..${b.max[2]} thickness=${(b.max[2] - b.min[2]).toFixed(12)}`);
}

// Geometry invariants of the 20 tooth / module 2 preset.
const base = gearProfile({ teeth: 20, module: 2, pressureAngle: 20, flankSamples: 64, tipSamples: 4, rootSamples: 3 });
const g = base.params;
let radiusBad = 0;
for (const [x, y] of base.points) {
  const r = Math.hypot(x, y);
  if (r < g.rf - 1e-9 || r > g.ra + 1e-9) radiusBad++;
}
check('profile stays inside root/tip radii', radiusBad === 0, `points=${base.points.length} rf=${g.rf.toFixed(4)} ra=${g.ra.toFixed(4)} outside=${radiusBad}`);
const tt = toothThicknessAtPitch(base.points, g);
const ttExp = (Math.PI * 2) / 2;
check('arc tooth thickness at pitch circle', near(tt, ttExp, 5e-3), `measured=${tt.toFixed(6)} analytic=pi*m/2=${ttExp.toFixed(6)} relErr=${(Math.abs(tt - ttExp) / ttExp).toExponential(2)}`);
check('tip is not pointed at 20 teeth', !g.pointed && g.thetaTip > 0, `thetaTip=${g.thetaTip.toFixed(6)} rad ra=${g.ra.toFixed(4)}`);

// Contact ratio: closed form vs an independent 200k point scan.
const opts = { teeth1: 20, teeth2: 40, module: 2, pressureAngle: 20 };
const cr = contactRatio(opts);
const num = numericContactRatio(opts, 200000);
check('contact ratio matches 200k-point scan', near(cr, num.ratio, 1e-4),
  `closed=${cr.toFixed(8)} numeric=${num.ratio.toFixed(8)} relErr=${(Math.abs(cr - num.ratio) / cr).toExponential(2)} samples=${num.samples}`);

// Undercut threshold from the rack formula.
const lim = undercutLimit(20);
check('undercut threshold', Math.abs(lim - 17.0973) < 0.01 && isUndercut(17, 20) && !isUndercut(18, 20),
  `limit=2/sin^2(20deg)=${lim.toFixed(4)} teeth; z=17 -> ${isUndercut(17, 20)}, z=18 -> ${isUndercut(18, 20)}`);

// Scale invariance: module 0.1 .. 10.
const rows = [];
let scaleBad = 0;
for (const m of [0.1, 1, 10]) {
  const gp = gearProfile({ teeth: 20, module: m, pressureAngle: 20, flankSamples: 64 });
  const mesh = extrudeProfile(gp.points, m * 3);
  const t = toothThicknessAtPitch(gp.points, gp.params);
  const vol = meshVolume(mesh);
  const ok = near(contactRatio({ teeth1: 20, teeth2: 40, module: m, pressureAngle: 20 }), cr, 1e-12)
    && near(t / m, tt / 2, 5e-3)
    && near(vol / m ** 3, meshVolume(extrudeProfile(base.points, 6)) / 8, 1e-9);
  if (!ok) scaleBad++;
  rows.push(`m=${m} cr=${contactRatio({ teeth1: 20, teeth2: 40, module: m, pressureAngle: 20 }).toFixed(9)} t/m=${(t / m).toFixed(6)} V/m^3=${(vol / m ** 3).toFixed(6)}`);
}
check('scale invariance m=0.1..10', scaleBad === 0, rows.join(' | '));

// A second pair with a different tooth count still produces a positive ratio > 1.
const cr2 = contactRatio({ teeth1: 12, teeth2: 30, module: 2, pressureAngle: 20 });
check('second pair contact ratio > 1', cr2 > 1 && Number.isFinite(cr2), `12/30 teeth: ratio=${cr2.toFixed(6)}`);
const cr3 = contactRatio({ teeth1: 25, teeth2: 25, module: 1, pressureAngle: 25 });
check('25 degree pressure angle ratio > 1', cr3 > 1, `25/25 teeth @25deg: ratio=${cr3.toFixed(6)}`);

console.log(`\nsummary: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
