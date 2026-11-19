// Independent sampling oracle for the length of action. Does not import the closed form.
import { gearParams } from '../src/core.mjs';

export function numericContactRatio({ teeth1, teeth2, module: m, pressureAngle = 20 }, samples = 200000) {
  const g1 = gearParams({ teeth: teeth1, module: m, pressureAngle });
  const g2 = gearParams({ teeth: teeth2, module: m, pressureAngle });
  const a = g1.r + g2.r;
  const alpha = pressureAngle * Math.PI / 180;
  const dirX = Math.sin(alpha), dirY = Math.cos(alpha);
  const L = g1.ra + g2.ra;
  let inside = 0;
  for (let i = 0; i <= samples; i++) {
    const t = -L + (2 * L * i) / samples;
    const x = g1.r + t * dirX, y = t * dirY;
    if (Math.hypot(x, y) <= g1.ra && Math.hypot(x - a, y) <= g2.ra) inside++;
  }
  const length = (inside * 2 * L) / (samples + 1);
  return { ratio: length / (Math.PI * m * Math.cos(alpha)), length, samples };
}
