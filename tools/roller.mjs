// Silicone sleeve: a tube along X, outer radius r over a core of radius bore. mm in, metres out.
import { weightedNormals } from './normals.mjs';

const SIDES = 48;
const SILICONE = [0.05, 0.05, 0.055, 1];

export function roller(x0, x1, y, z, r, bore) {
  const p = [], c = [], idx = [];
  const ring = (x, rad) => { const base = p.length / 3; for (let k = 0; k < SIDES; k++) { const a = (k / SIDES) * 2 * Math.PI; p.push(x / 1000, (y + rad * Math.cos(a)) / 1000, (z + rad * Math.sin(a)) / 1000); c.push(...SILICONE); } return base; };
  const band = (a, b, flip) => { for (let k = 0; k < SIDES; k++) { const n = (k + 1) % SIDES, q = [a + k, b + k, a + n, a + n, b + k, b + n]; idx.push(...(flip ? [q[0], q[2], q[1], q[3], q[5], q[4]] : q)); } };
  // outside, then the two end faces with their own vertices so the edges stay crisp
  band(ring(x0, r), ring(x1, r), true);
  band(ring(x0, bore), ring(x0, r), true);
  band(ring(x1, bore), ring(x1, r), false);
  return { solid: weightedNormals(p, c, idx) };
}
