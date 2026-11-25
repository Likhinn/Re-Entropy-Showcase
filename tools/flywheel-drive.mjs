// Real flywheel pulleys (61T drum, 15T flywheel) in place of the 54T / 18T in the CAD, plus a belt built to fit.
// The pulley meshes were extracted from a separate Onshape export; mm, axis along X, centred.
import fs from 'node:fs';
import { weightedNormals } from './normals.mjs';

const PULLEYS = JSON.parse(fs.readFileSync(new URL('./flywheel-pulleys.json', import.meta.url)));
const PITCH = 5, WIDTH = 9; // HTD 5M
const LAND = 0.5715, BACK = 1.15, TOOTH = 2.0; // mm from the pitch line
const GRAY = [0.22, 0.22, 0.22, 1];

// CAD parts that mark where the new pulleys go, and the belt they replace
export const OLD = { big: /^54t Custom HTD/, small: /^18t Custom HTD/, belt: /^87T 5M 9mm/ };

const solid = (p, i) => ({ solid: weightedNormals(p.map((v) => v / 1000), Array.from({ length: p.length / 3 }, () => GRAY).flat(), i) });

function pulley(teeth, [cx, cy, cz], grooveAt) {
  const { p, i, groove } = PULLEYS[teeth], c = Math.cos(grooveAt - groove), s = Math.sin(grooveAt - groove), out = [];
  for (let v = 0; v < p.length; v += 3) out.push(cx + p[v], cy + p[v + 1] * c - p[v + 2] * s, cz + p[v + 1] * s + p[v + 2] * c);
  return solid(out, i);
}

// toothed belt around two HTD 5M pulleys; tooth 0 sits at firstAt (angle on the big pulley, default mid-wrap)
function belt(big, small, T, t, firstAt) {
  const R = (T * PITCH) / 2 / Math.PI, r = (t * PITCH) / 2 / Math.PI;
  const C = Math.hypot(small[1] - big[1], small[2] - big[2]), phi = Math.atan2(small[2] - big[2], small[1] - big[1]);
  const beta = Math.acos((R - r) / C), run = C * Math.sin(beta);
  const wrapR = R * 2 * (Math.PI - beta), wrapr = r * 2 * beta, len = wrapR + wrapr + 2 * run, teeth = Math.round(len / PITCH);
  // point on the pitch line at distance s, pushed outward by o; s = 0 where the belt enters the big pulley
  const at = (s, o) => {
    let a, y, z, along = 0, d = big, q = R;
    if (s < wrapR) a = phi + beta + s / R;
    else if (s < wrapR + run) { a = phi - beta; along = s - wrapR; }
    else if (s < wrapR + run + wrapr) { a = phi - beta + (s - wrapR - run) / r; d = small; q = r; }
    else { a = phi + beta; along = s - wrapR - run - wrapr; d = small; q = r; }
    y = d[1] + (q + o) * Math.cos(a) - along * Math.sin(a);
    z = d[2] + (q + o) * Math.sin(a) + along * Math.cos(a);
    return [y, z];
  };
  const turn = 2 * Math.PI, from = phi + beta, first = firstAt === undefined ? wrapR / 2 : ((((firstAt - from) % turn) + turn) % turn) * R;
  const step = len / teeth;
  const shape = [[-1.65, 0], [-1.4, 0.5], [-0.95, 0.87], [-0.4, 1], [0.4, 1], [0.95, 0.87], [1.4, 0.5], [1.65, 0]];
  const p = [], idx = [], x = (big[0] + small[0]) / 2, n = teeth * shape.length;
  for (let k = 0; k < teeth; k++) for (const [ds, h] of shape) {
    const s = (first + k * step + ds + len) % len;
    const I = at(s, -LAND - TOOTH * h), O = at(s, BACK);
    p.push(x - WIDTH / 2, ...I, x + WIDTH / 2, ...I, x - WIDTH / 2, ...O, x + WIDTH / 2, ...O);
  }
  for (let k = 0; k < n; k++) {
    const a = k * 4, b = ((k + 1) % n) * 4;
    idx.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3); // back
    idx.push(a, b + 1, b, a, a + 1, b + 1); // toothed side
    idx.push(a + 1, a + 3, b + 3, a + 1, b + 3, b + 1); // edges
    idx.push(a, b + 2, a + 2, a, b, b + 2);
  }
  const mid = wrapR + run + wrapr / 2, near = first + Math.round((mid - first) / step) * step;
  console.log(`belt ${T}T-${t}T: ${teeth}T, loop ${len.toFixed(1)} mm for ${teeth * PITCH} mm belt`);
  return { name: `${teeth}T 5M 9mm Wide Belt`, pm: solid(p, idx), phi, grooveOnSmall: phi + (near - mid) / r };
}

// big, small: pulley centres in CAD mm -> [{ name, pm }]
export function flywheelDrive(big, small, T = 61, t = 15) {
  const b = belt(big, small, T, t);
  return [
    { name: `${T}T Custom HTD 5mm Pulley`, pm: pulley(T, big, b.phi + Math.PI) },
    { name: `${t}T Custom HTD 5mm Pulley`, pm: pulley(t, small, b.grooveOnSmall) },
    b,
  ];
}

// Intake roller drive, one side: 18T on the Kraken to 18T on the roller (called 28T in the CAD).
export const intakeBelt = (side) => belt([side * 306.4, -574.84, 248.37], [side * 306.4, -583.75, 169.37], 18, 18);
