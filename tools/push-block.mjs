// Hopper push block: the side profile in push-block.json (inches, from the team's drawing) extruded 1 in
// along X, clamped on the intake cross bar. CAD mm in, metres out.
// The profile's origin sits where Worlds' push blocks put it: on the cross bar, 3.7 mm above its centre.
import fs from 'node:fs';
import { ExtrudeGeometry, Path, Shape } from 'three';
import { weightedNormals } from './normals.mjs';
import { PUSH_GREEN } from './subsystems.mjs';

const PROFILE = JSON.parse(fs.readFileSync(new URL('./push-block.json', import.meta.url)));
const IN = 25.4, WIDTH = 1; // in
const BAR = [-585, 270.7]; // [y, z] of the profile origin, CAD mm
const GREEN = [...PUSH_GREEN, 1]; // printed, like Worlds' push blocks

let shape; // the extruded profile, built once: x along the bar, then y, z in the profile's plane (in)
function extruded() {
  if (shape) return shape;
  const s = new Shape(PROFILE.outline.map(([x, y]) => ({ x, y })));
  const { centre: [cx, cy], radius } = PROFILE.hole;
  s.holes.push(new Path().absarc(cx, cy, radius, 0, Math.PI * 2, true));
  const g = new ExtrudeGeometry(s, { depth: WIDTH, bevelEnabled: false, curveSegments: 48 });
  return (shape = g.attributes.position.array);
}

// one block centred at x (mm) across the robot
export function pushBlock(x) {
  const src = extruded(), p = [], c = [], idx = [];
  for (let v = 0; v < src.length; v += 3) {
    // profile x -> CAD y (forward is -y), profile y -> CAD z, extrusion -> CAD x: a rotation, so the faces keep their winding
    p.push((x + (src[v + 2] - WIDTH / 2) * IN) / 1000, (BAR[0] + src[v] * IN) / 1000, (BAR[1] + src[v + 1] * IN) / 1000);
    c.push(...GREEN);
    idx.push(v / 3);
  }
  return { solid: weightedNormals(p, c, idx) };
}

// across the robot, in mm: Dalton's three, 1 in apart; Albany's six, in pairs 1 in apart
const gap = (n, w, space) => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * (w + space) * IN);
export const PUSH_BLOCKS = {
  'entropy-dalton': gap(3, 1, 1),
  'entropy-albany': gap(3, 2, 1).flatMap((g) => [g - IN / 2, g + IN / 2]),
};
