// Easter egg (space bar): the shooter spins up until the flywheel lets go. It drops onto the bumper and
// bounces off it out the back of the robot, the way the shooter fires. Every time it touches the floor
// its stored spin (6,500 rpm) grabs and kicks it faster; after four bounces it is rolling, races off into
// the distance, slows, and spirals down onto its side like a coin. A few seconds later it fades back in.
import * as THREE from 'three';

export const HOME = new THREE.Vector3(-0.339, 0.321, -0.253); // flywheel centre, viewer metres
const R = 0.076; // flywheel radius
const BUMPER = 0.228; // centre height when it sits on the bumper's top edge
const G = 9.8;
const OFF = 1.9, LAND = 2.2; // lets go, hits the bumper

// after the bumper: simulated once, up front
const KICK = 0.45; // share of the gap to top speed made up at each floor contact
const VMAX = 5.5; // m/s the spin can drive it to
const BOUNCES = [0.62, 0.55, 0.48, 0.4]; // share of upward speed kept at each of the four bounces
const CRUISE = 1.4, BRAKE = 2.2; // seconds at speed once rolling, then slowing in m/s^2
const ASTERN = -Math.PI; // heading straight out the back (heading 0 = +Z)
const DT = 1 / 240;
const path = []; // samples every DT from the bumper: { x, y, z, roll, lean, yaw }
let ROLLING = 0; // seconds after the bumper when it stops bouncing
{
  let x = HOME.x - 0.013, y = BUMPER, z = HOME.z - 0.01, vy = 1.7, s = 0.78, h = Math.atan2(-0.2, -0.75), roll = 0, bounce = 0, whirl = 0;
  for (let t = 0, rolling = false; t < 30; t += DT) {
    let lean = 0.08 + 0.1 * Math.sin(t * 7);
    if (!rolling) {
      vy -= G * DT;
      y += vy * DT;
      if (y <= R) {
        // the spin grabs the floor: a kick of speed, and it straightens up
        y = R;
        s += (VMAX - s) * KICK;
        h += (ASTERN - h) * 0.5;
        if (bounce < BOUNCES.length) vy = -vy * BOUNCES[bounce++];
        else { vy = 0; rolling = true; ROLLING = t; }
      }
      roll -= 56 * DT; // still turning freely in the air
    } else {
      const g = t - ROLLING;
      s = g < CRUISE ? s + (VMAX - 0.5 * g - s) * Math.min(1, DT * 4) : Math.max(0, s - BRAKE * DT);
      h += (ASTERN - h) * Math.min(1, DT * 3);
      roll -= (s / R) * DT;
      // the coin finish: once slow it leans over, whirling faster and faster, until it lies flat
      const fall = Math.min(1, Math.max(0, (1.4 - s) / 1.4)) ** 1.6;
      whirl += fall * 14 * DT;
      lean = 0.12 + 0.06 * Math.sin(t * 11) * (1 - fall) + (Math.PI / 2 - 0.12) * fall;
      y = R * Math.cos(lean) + 0.003 * Math.sin(lean);
    }
    x += Math.sin(h) * s * DT;
    z += Math.cos(h) * s * DT;
    path.push({ x, y, z, roll, lean, yaw: h + Math.PI + whirl });
    if (rolling && s === 0) break;
  }
}
const STILL = LAND + (path.length - 1) * DT; // lying flat
const OUT = STILL + 0.8, GONE = OUT + 0.5, RETURN = GONE + 1.5;
export const EGG_SECONDS = RETURN + 0.7;
// what the camera keeps in view: the robot's side, the bounces and the start of the run
export const EGG_AREA = new THREE.Box3();

const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const smooth = (k) => k * k * (3 - 2 * k);
const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YZX'), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
const toHome = new THREE.Matrix4().makeTranslation(-HOME.x, -HOME.y, -HOME.z);

// flywheel turned about its own axle by spin (rad), otherwise where it rests
export function spunInPlace(spin, out) {
  return out.compose(HOME, q.setFromEuler(e.set(spin, 0, 0)), one).multiply(toHome);
}

// t seconds into the egg -> fills out with the flywheel's move from home;
// returns { alpha, pos: its centre, rollers: 0..1 spin-up of the shooter }
export function egg(t, out) {
  // spin while still on the shaft (it turns with the drum): 0 -> 70 rad/s
  const spinUp = Math.min(t, OFF);
  let roll = -(70 * spinUp * spinUp) / (2 * OFF) - 56 * Math.max(0, Math.min(t, LAND) - OFF), lean = 0, yaw = 0;
  p.copy(HOME);
  if (t < OFF) {
    // shaking itself loose
    const shake = 0.0018 * smooth(ramp(t, 1.3, OFF));
    p.x += shake * Math.sin(t * 97);
    p.y += shake * Math.cos(t * 83);
  } else if (t < LAND) {
    // slides off the shaft and drops onto the bumper
    const k = ramp(t, OFF, LAND);
    p.set(HOME.x - 0.013 * k, HOME.y - (HOME.y - BUMPER) * k * k, HOME.z - 0.01 * k);
    lean = 0.08 * k;
  } else {
    const f = Math.min(path.length - 1, (t - LAND) / DT), i = Math.floor(f), k = f - i, a = path[i], b = path[Math.min(path.length - 1, i + 1)];
    const mix = (key) => a[key] + (b[key] - a[key]) * k;
    p.set(mix('x'), mix('y'), mix('z'));
    roll += mix('roll');
    lean = mix('lean');
    yaw = mix('yaw') * smooth(ramp(t, LAND, LAND + 0.4)); // turns to face where it is going
  }
  const back = t >= RETURN;
  out.compose(back ? HOME : p, q.setFromEuler(e.set(back ? 0 : roll, back ? 0 : yaw, back ? 0 : lean)), one).multiply(toHome);
  const alpha = t < OUT ? 1 : t < GONE ? 1 - smooth(ramp(t, OUT, GONE)) : t < RETURN ? 0 : smooth(ramp(t, RETURN, EGG_SECONDS));
  return { alpha, pos: back ? HOME : p, rollers: t < OFF ? smooth(ramp(t, 0, 0.9)) : 0 };
}

{
  const m = new THREE.Matrix4();
  for (let t = OFF; t < LAND + ROLLING; t += 0.05) EGG_AREA.expandByPoint(egg(t, m).pos);
  EGG_AREA.expandByScalar(R);
  EGG_AREA.min.y = 0;
}
