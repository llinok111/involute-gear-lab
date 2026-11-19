# involute-gear-lab

One pure `src/core.mjs` turns tooth counts, module and pressure angle into a **watertight involute gear mesh plus a certificate**: closed-form contact ratio, rack undercut verdict, arc tooth thickness, and volume = profile area × thickness. The same module runs in node and in the page; moving a slider recomputes every displayed number.

**Measured** (node v24.19.0, this machine): contact ratio for 20T/40T, m=2, 20° is `1.635185964` closed-form vs `1.635257769` from an independent 200,000-point scan (rel. err `4.39e-5`); the closed form takes `0.8929 µs` vs `11.983 ms` for the scan (**13,421×** per call). Five presets (8,890 profile points, 35,560 triangles) are watertight with **0 boundary and 0 non-manifold edges**; mesh volume matches profile-area × thickness to `7.3e-15` relative. Baseline code: `baseline/naive.mjs`.

Upstream: none

## Run it

```bash
node tools/gen-sample.mjs     # writes data/gears.json (356 KB), deterministic
node bench/verify.mjs         # 24 assertions, exit 0
node bench/bench.mjs          # writes bench/result.json
```

Browser (no build step, pinned CDN importmap, no `node_modules`):

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

Sliders: pinion teeth 10–40, wheel teeth 10–70, module 1–4 mm, pressure angle 14.5–25°. The pair spins at the conjugate ratio; the panel shows the same contact ratio, undercut limit and mesh checks that `bench/verify.mjs` asserts.

## Evidence (from `bench/result.json`)

| measurement | value |
|---|---|
| gear job: 24T, m=2, 64 flank samples | 3,264 points, 13,056 triangles |
| cold (build + first query) | 31.780 ms |
| warm samples (n=5) | min 8.435 / median 14.428 / p95 22.207 ms, stddev 5.438 |
| relative stddev | 38.27% — shared 4-core host, spikes to 22 ms; median and min are reported, not the best run |
| closed-form contact ratio | 0.8929 µs/call (10,000 calls averaged) |
| 200k-point scan | 11.983 ms, ratio 1.635257769 vs 1.635185964 |
| tooth thickness at pitch (20T, m=2) | 3.130466 measured on the polygon vs πm/2 = 3.141593 (`3.54e-3` rel.) |
| undercut limit, 20° | 2/sin²α = 17.0973 teeth; 17 flagged, 18 not |
| volume vs area·t, 5 presets | max rel. error `7.30e-15` |
| watertight, 5 presets | 0 boundary / 0 non-manifold edges (53,340 edges) |
| scale m = 0.1, 1, 10 | contact ratio identical to 12 digits; V/m³ = 919.516093 at every scale |

## 本轮创新

**B 档。** 齿轮本身不新，新的是把“接触比闭式解 + 根切解析阈值 + 齿廓面积/网格体积/水密性”绑在**同一个无依赖 core** 上，并让页面的滑杆与 node 的 `bench/verify.mjs` 复算同一组数字：接触比不是查表、不是 CAD 导出值，而是每次由 `2/sin²α` 和长度作用线现场算出，网格的每条边同时被数一遍。台账里没有齿轮项目；已有 3D 仓库都是网格处理（LOD/修复/剖切/CSG），没有把渐开线运动学证书和网格证书合成一个可交互产品。换个模型/配色搬不走这套断言——接触比与根切阈值换主题就失效。

## What is verified

- `gearProfile` emits a CCW closed polygon inside `[rf, ra]`; 20T/m2 tip is not pointed (`θ_tip = 0.031585 rad`).
- Arc tooth thickness at the pitch circle is measured from the polygon, not copied from the input formula.
- `contactRatio` (closed form) vs `numericContactRatio` (independent 200k sampling of the line of action) agree to `4.39e-5`.
- `undercutLimit(20°) = 17.0973`; `isUndercut(17)` true, `isUndercut(18)` false.
- Extruded mesh: every edge occurs exactly twice; signed volume equals shoelace area × thickness.
- Module scaling `0.1 → 10` leaves the contact ratio invariant and scales thickness/volume exactly.

## Known limitations (read before trusting a number)

- **Root below the base circle is a radial line, not a trochoid.** The undercut *verdict* is analytic, but the generated root geometry is an approximation; do not use it as a machining model.
- No profile shift, no tip chamfer, no backlash input in the UI (the core accepts `backlash`, the page fixes it at 0).
- Tooth thickness is measured on the sampled polygon: with 64 flank samples it reads `3.130466` vs the analytic `3.141593` (0.35% low). Increase `flankSamples` to tighten it.
- The mesh is a straight extrusion; no helix, no crowning, no bore/keyway.
- Timing is wall-clock on a shared 4-core machine: RSD 38.27% is host contention, visible in the p95 spike. The performance claim is “closed form vs sampling”, not a comparison against a CAD kernel.
- The browser animation is visual. The certificate numbers are recomputed in-page by `src/core.mjs`; they do not depend on the animation.

## Layout

```
index.html            importmap, pinned three@0.160.0
main.js               render + sliders only
src/core.mjs          pure gear math (no three, no DOM)
tools/gen-sample.mjs  deterministic preset corpus
bench/verify.mjs      24 assertions
bench/bench.mjs       1 cold + 5 warm samples
bench/result.json     the numbers above
baseline/naive.mjs    independent 200k-point contact-ratio scan
```

MIT © 2026 llinok111. No runtime dependencies; the browser fetches three.js from a pinned CDN importmap.
