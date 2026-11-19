// Pure involute-gear geometry. No renderer, no DOM, no third-party imports.
// All lengths are millimetres; angles are radians unless a name ends in Deg.
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export function involute(a) { return Math.tan(a) - a; }

export function undercutLimit(pressureAngleDeg = 20) {
  const s = Math.sin(pressureAngleDeg * DEG);
  return 2 / (s * s);
}

export function isUndercut(teeth, pressureAngleDeg = 20) {
  return teeth < undercutLimit(pressureAngleDeg);
}

export function gearParams({ teeth, module: m, pressureAngle = 20, backlash = 0 }) {
  const alpha = pressureAngle * DEG;
  const r = (m * teeth) / 2;
  const rb = r * Math.cos(alpha);
  const ra0 = r + m;
  const rf = r - 1.25 * m;
  const psi = (Math.PI * m / 2 - backlash) / (2 * r);
  const invA = involute(alpha);
  const thetaAt = (rho) => {
    if (rho <= rb) return psi + invA;
    const ar = Math.acos(Math.min(1, rb / rho));
    return psi + invA - involute(ar);
  };
  let ra = ra0;
  let pointed = false;
  if (thetaAt(ra0) <= 0) {
    pointed = true;
    let lo = rb, hi = ra0;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (thetaAt(mid) > 0) lo = mid; else hi = mid;
    }
    ra = lo;
  }
  return { teeth, module: m, pressureAngle, alpha, backlash, r, rb, ra, rf, psi, invA, thetaAt, thetaBase: psi + invA, thetaTip: thetaAt(ra), pointed };
}

// Closed profile, CCW around the centre, no repeated first point.
export function gearProfile(opts) {
  const g = gearParams(opts);
  const { teeth, rb, rf, ra, thetaBase, thetaTip } = g;
  const flankSamples = Math.max(2, opts.flankSamples ?? 10);
  const tipSamples = Math.max(1, opts.tipSamples ?? 4);
  const rootSamples = Math.max(1, opts.rootSamples ?? 3);
  const pts = [];
  const step = TAU / teeth;
  for (let k = 0; k < teeth; k++) {
    const phi = k * step;
    pts.push([rf * Math.cos(phi - thetaBase), rf * Math.sin(phi - thetaBase)]);
    for (let i = 0; i < flankSamples; i++) {
      const rho = rb + ((ra - rb) * i) / (flankSamples - 1);
      const a = phi - g.thetaAt(rho);
      pts.push([rho * Math.cos(a), rho * Math.sin(a)]);
    }
    if (thetaTip > 1e-12) {
      for (let i = 1; i < tipSamples; i++) {
        const a = phi - thetaTip + (2 * thetaTip * i) / tipSamples;
        pts.push([ra * Math.cos(a), ra * Math.sin(a)]);
      }
    }
    for (let i = flankSamples - 1; i >= 0; i--) {
      const rho = rb + ((ra - rb) * i) / (flankSamples - 1);
      const a = phi + g.thetaAt(rho);
      pts.push([rho * Math.cos(a), rho * Math.sin(a)]);
    }
    pts.push([rf * Math.cos(phi + thetaBase), rf * Math.sin(phi + thetaBase)]);
    for (let i = 1; i <= rootSamples; i++) {
      const a = phi + thetaBase + ((step - 2 * thetaBase) * i) / (rootSamples + 1);
      pts.push([rf * Math.cos(a), rf * Math.sin(a)]);
    }
  }
  return { points: pts, params: g };
}

export function profileArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

export function extrudeProfile(points, thickness) {
  const n = points.length;
  const vertices = [];
  for (const [x, y] of points) vertices.push([x, y, 0]);
  for (const [x, y] of points) vertices.push([x, y, thickness]);
  const cb = vertices.length, ct = cb + 1;
  vertices.push([0, 0, 0], [0, 0, thickness]);
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([cb, j, i]);
    faces.push([ct, n + i, n + j]);
    faces.push([i, j, n + j], [i, n + j, n + i]);
  }
  return { vertices, faces };
}

export function meshEdgeStats(mesh) {
  const counts = new Map();
  for (const f of mesh.faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  let boundary = 0, nonManifold = 0;
  for (const c of counts.values()) {
    if (c === 1) boundary++;
    else if (c > 2) nonManifold++;
  }
  return { edges: counts.size, boundary, nonManifold };
}

export function meshVolume(mesh) {
  let s = 0;
  for (const f of mesh.faces) {
    const a = mesh.vertices[f[0]], b = mesh.vertices[f[1]], c = mesh.vertices[f[2]];
    s += a[0] * (b[1] * c[2] - b[2] * c[1])
       - a[1] * (b[0] * c[2] - b[2] * c[0])
       + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return s / 6;
}

export function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.vertices) for (let k = 0; k < 3; k++) {
    if (p[k] < min[k]) min[k] = p[k];
    if (p[k] > max[k]) max[k] = p[k];
  }
  return { min, max, diag: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) };
}

export function lengthOfAction({ teeth1, teeth2, module: m, pressureAngle = 20 }) {
  const g1 = gearParams({ teeth: teeth1, module: m, pressureAngle });
  const g2 = gearParams({ teeth: teeth2, module: m, pressureAngle });
  const a = g1.r + g2.r;
  return Math.sqrt(Math.max(0, g1.ra ** 2 - g1.rb ** 2))
       + Math.sqrt(Math.max(0, g2.ra ** 2 - g2.rb ** 2))
       - a * Math.sin(g1.alpha);
}

export function contactRatio(opts) {
  const alpha = opts.pressureAngle * DEG;
  return lengthOfAction(opts) / (Math.PI * opts.module * Math.cos(alpha));
}

// A point on a flank, exposed so the renderer and tests use the same construction.
export function flankPoint(g, rho, side = 1, tooth = 0, pitchAngle = 0) {
  const a = tooth * (TAU / g.teeth) + side * g.thetaAt(rho) + pitchAngle;
  return [rho * Math.cos(a), rho * Math.sin(a)];
}

// Arc tooth thickness at the pitch circle, measured from the generated polygon.
export function toothThicknessAtPitch(points, g, tooth = 0) {
  const step = TAU / g.teeth;
  const phi = tooth * step;
  const angles = [];
  for (const [x, y] of points) {
    const rho = Math.hypot(x, y);
    let a = Math.atan2(y, x) - phi;
    while (a <= -Math.PI) a += TAU;
    while (a > Math.PI) a -= TAU;
    if (Math.abs(a) < step / 2 && Math.abs(rho - g.r) < g.module * 0.6) angles.push({ rho, a });
  }
  const near = (p) => Math.abs(p.rho - g.r);
  const left = angles.filter((p) => p.a < 0).sort((p, q) => near(p) - near(q))[0];
  const right = angles.filter((p) => p.a > 0).sort((p, q) => near(p) - near(q))[0];
  if (!left || !right) return NaN;
  return g.r * (right.a - left.a);
}