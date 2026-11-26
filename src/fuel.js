// "Run subsystem" animations: fuel fades in, travels the real path through a subsystem, and fades out.
// Paths are [t, y, z] in CAD mm (y = back(+)/front(-), z = up); t in seconds from that ball's start.
import * as THREE from 'three';

const R = 0.075; // fuel radius, m
const COLOR = 0xf0cc1c;
const LANES = [-225, -75, 75, 225];
const DRUM = [278, 443], ARC = 112; // shooter drum centre, radius the ball centre follows around it

// ---- paths -------------------------------------------------------------------------------
const INTAKE = [[0, -930, 77], [0.35, -760, 77], [0.65, -610, 80], [0.85, -520, 125], [1.05, -445, 232], [1.25, -370, 285], [1.45, -286, 296], [1.75, -205, 283]];
const INDEXER = [[0, -330, 310], [0.3, -229, 288], [0.6, -111, 256], [0.9, 9, 224], [1.1, 78, 214], [1.3, 125, 224], [1.5, 160, 278], [1.7, 171, 345], [1.9, 169, 405], [2.05, 166, 443]];

// feed up the channel, wrap the drum under the hood, then fly; drop = hood angle below fully raised, degrees
function shot(drop) {
  const v0 = 300, v = 5600; // mm/s: feed speed, launch speed
  const path = [[0, 163, 272], [0.25, 172, 345]]; // fed by the indexer
  const exit = 34 - drop * 0.65;
  const on = (deg) => [DRUM[0] - ARC * Math.cos((deg * Math.PI) / 180), DRUM[1] + ARC * Math.sin((deg * Math.PI) / 180)];
  // the drum takes over where the ball first touches it (about z = 375) and accelerates it all the way to the hood
  const pull = [[172, 360], [171, 375], [170, 388], [169, 402], [168, 416], [167, 430]];
  for (let k = 0; k <= 8; k++) pull.push(on((exit * k) / 8));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let total = 0, s = 0, t = 0.25, last = [172, 345];
  for (let k = 2; k < pull.length; k++) total += dist(pull[k - 1], pull[k]);
  pull.forEach((p, k) => {
    const d = dist(last, p);
    if (k > 1) s += d;
    const speed = k < 2 ? v0 : v0 + (v - v0) * Math.pow((s - d / 2) / total, 0.6);
    path.push([(t += d / speed), ...p]);
    last = p;
  });
  const [y0, z0] = on(exit), a = (exit * Math.PI) / 180;
  for (let k = 1; k <= 6; k++) {
    const s = k * 0.055;
    path.push([t + s, y0 + v * Math.sin(a) * s, z0 + v * Math.cos(a) * s - 4900 * s * s]);
  }
  return path;
}

const HOOD_STEPS = [0, 12, 24, 34]; // hood drop for each volley

// volleys of fuel across the robot's width
export const volleys = (path, n, gap, lanes = LANES) => Array.from({ length: n * lanes.length }, (_, k) => {
  const row = Math.floor(k / lanes.length);
  return { at: row * gap + ((k * 7) % 4) * 0.07, x: lanes[k % lanes.length], path: typeof path === 'function' ? path(row) : path };
});

// spin: rad/s of the rollers per subsystem. hood: where the hood should be at time t (0..1 raised)
export const RUNS = {
  intake: { balls: () => volleys(INTAKE, 4, 0.55), spin: { intake: 14, indexer: 8 } },
  indexer: { balls: () => volleys(INDEXER, 4, 0.62), spin: { indexer: 9 } },
  shooter: { balls: () => volleys(() => shot(0), 4, 0.6), spin: { shooter: 20, hood: 26, indexer: 6 } },
  hood: {
    balls: () => volleys((row) => shot(HOOD_STEPS[row]), HOOD_STEPS.length, 1.15).map((b) => ({ ...b, at: b.at + 0.3 })),
    spin: { shooter: 18, hood: 24 },
    hood: (t, end) => {
      if (t > end - 0.6) return null; // raise again
      // move between volleys: each one is away by about 0.95 s, the next is touched at about 1.8 s
      const x = Math.max(0, (t - 1) / 1.15), i = Math.min(HOOD_STEPS.length - 1, Math.floor(x)), k = t < 1 ? 0 : Math.min(1, ((x - i) * 1.15) / 0.45);
      const a = HOOD_STEPS[i], b = HOOD_STEPS[Math.min(HOOD_STEPS.length - 1, i + 1)];
      return 1 - (a + (b - a) * k * k * (3 - 2 * k)) / 34;
    },
  },
};

// ---- player ------------------------------------------------------------------------------
// smooth position at time t through timestamped points
function sample(path, t, out) {
  let i = 0;
  while (i < path.length - 2 && t > path[i + 1][0]) i++;
  const a = path[i], b = path[i + 1], h = b[0] - a[0], s = Math.min(1, Math.max(0, (t - a[0]) / h));
  const prev = path[i - 1] || a, next = path[i + 2] || b;
  const tan = (p, q, k) => (q[0] > p[0] ? (q[k] - p[k]) / (q[0] - p[0]) : 0) * h;
  const held = (k) => a[k] === b[k];
  for (const k of [1, 2]) {
    const m0 = held(k) ? 0 : tan(prev, b, k), m1 = held(k) ? 0 : tan(a, next, k), s2 = s * s, s3 = s2 * s;
    out[k] = (2 * s3 - 3 * s2 + 1) * a[k] + (s3 - 2 * s2 + s) * m0 + (3 * s2 - 2 * s3) * b[k] + (s3 - s2) * m1;
  }
  return out;
}

export class Fuel {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geo = new THREE.SphereGeometry(R, 40, 28);
    this.active = null;
    this.p = [0, 0, 0];
  }

  start(run) {
    this.clear();
    const balls = run.balls();
    for (const b of balls) {
      b.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ color: COLOR, roughness: 0.82, metalness: 0, envMapIntensity: 0.7, transparent: true }));
      b.mesh.renderOrder = 11.5; // after the focused parts, before the ghosts (see Stage.applyAlpha)
      b.mesh.visible = false;
      b.mesh.receiveShadow = true;
      b.end = b.path[b.path.length - 1][0];
      this.group.add(b.mesh);
    }
    this.active = { run, balls, t: 0, end: Math.max(...balls.map((b) => b.at + b.end)) + 0.3, gain: 1, stopping: false };
  }

  // fade out early
  stop() { if (this.active) this.active.stopping = true; }

  clear() {
    for (const m of this.group.children) m.material.dispose();
    this.group.clear();
    this.active = null;
  }

  // returns false once finished
  step(dt) {
    const a = this.active;
    a.t += dt;
    if (a.stopping) a.gain = Math.max(0, a.gain - dt * 4);
    for (const b of a.balls) {
      const t = a.t - b.at, fade = Math.min(1, t / 0.25, (b.end - t) / 0.22) * a.gain;
      b.mesh.visible = fade > 0.01;
      if (!b.mesh.visible) { b.mesh.castShadow = false; continue; }
      const [, y, z] = sample(b.path, t, this.p), Z = -y / 1000;
      if (b.last !== undefined) b.mesh.rotation.x += (Z - b.last) / R;
      b.last = Z;
      b.mesh.position.set(b.x / 1000, z / 1000, Z);
      b.mesh.material.opacity = fade;
      b.mesh.castShadow = fade > 0.6;
    }
    if (a.t < a.end && a.gain > 0) return true;
    this.clear();
    return false;
  }
}
