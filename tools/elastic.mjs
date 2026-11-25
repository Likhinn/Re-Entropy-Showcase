// Elastic loop of the hopper lock: runs around the top standoff and the screw on the lock plate's tail.
// Built in the unlocked (stretched) pose; the viewer lets the lower end follow the lock plate.
import { weightedNormals } from './normals.mjs';

const POST = [-5, 379.5], PIN = [20.5, 252.5]; // [y, z] mm
const R_POST = 8.6, R_PIN = 4.4, TUBE = 1.8, SIDES = 12; // loop radii at the tube's centreline, tube radius
const COLOR = [0.85, 0.62, 0.3, 1];

export function elastic(x) {
  const C = Math.hypot(PIN[0] - POST[0], PIN[1] - POST[1]), phi = Math.atan2(PIN[1] - POST[1], PIN[0] - POST[0]);
  const beta = Math.acos((R_POST - R_PIN) / C), path = []; // [y, z, outward angle]
  const arc = (c, r, a0, a1, n) => { for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; path.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), a]); } };
  arc(POST, R_POST, phi + beta, phi - beta + 2 * Math.PI, 18);
  const join = (to) => { const f = path[path.length - 1], n = 10; for (let k = 1; k < n; k++) path.push([f[0] + ((to[0] - f[0]) * k) / n, f[1] + ((to[1] - f[1]) * k) / n, f[2]]); };
  join([PIN[0] + R_PIN * Math.cos(phi - beta), PIN[1] + R_PIN * Math.sin(phi - beta)]);
  arc(PIN, R_PIN, phi - beta, phi + beta, 12);
  join([path[0][0], path[0][1]]);

  const p = [], c = [], idx = [], n = path.length;
  for (const [y, z, a] of path) for (let k = 0; k < SIDES; k++) {
    const t = (k / SIDES) * 2 * Math.PI, o = TUBE * Math.cos(t);
    p.push((x + TUBE * Math.sin(t)) / 1000, (y + o * Math.cos(a)) / 1000, (z + o * Math.sin(a)) / 1000);
    c.push(...COLOR);
  }
  for (let k = 0; k < n; k++) for (let s = 0; s < SIDES; s++) {
    const a = k * SIDES + s, b = k * SIDES + ((s + 1) % SIDES), d = ((k + 1) % n) * SIDES + s, e = ((k + 1) % n) * SIDES + ((s + 1) % SIDES);
    idx.push(a, d, b, b, d, e);
  }
  return { solid: weightedNormals(p, c, idx) };
}
