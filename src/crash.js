// Entropy's easter egg (space bar): the intake blows apart. Every CAD part flies off, tumbles and bounces
// on the floor in front of the robot, lies there a moment, then flies back into place.
// The fall is simulated once, up front, so the camera can frame where the parts will land.
import * as THREE from 'three';

const G = 9.8, DT = 1 / 240, SAMPLE = 4; // physics step; keep every 4th step (60 per second)
const SHAKE = 0.35; // s of rattling before it goes
const LIE = 1.6; // s the parts lie still before flying home
const HOME = 1.3, STAGGER = 0.7; // s each part takes to fly back, spread of their start times
const BOUNCE = 0.3, SLIDE = 0.55, SPIN_KEPT = 0.6; // kept at each floor contact: upward speed, sliding, spin

const smooth = (k) => k * k * (3 - 2 * k);
const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// a seeded random, so the same parts fly the same way each time it's set off with the same seed
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// the meshes of one subsystem, split into one mesh per CAD part (vertices that share a _center)
function split(parts) {
  const out = [];
  const w = new THREE.Vector3();
  for (const { m } of parts) {
    const g = m.geometry, c = g.attributes._center, pos = g.attributes.position;
    const index = g.index ? g.index.array : null, n = index ? index.length : pos.count;
    const groups = new Map();
    for (let i = 0; i < n; i += 3) {
      const v = index ? index[i] : i;
      const key = `${c.getX(v)},${c.getY(v)},${c.getZ(v)},${c.getW(v)}`;
      let a = groups.get(key);
      if (!a) groups.set(key, (a = []));
      a.push(index ? index[i] : i, index ? index[i + 1] : i + 1, index ? index[i + 2] : i + 2);
    }
    for (const tris of groups.values()) {
      const pg = new THREE.BufferGeometry();
      for (const name in g.attributes) pg.setAttribute(name, g.attributes[name]);
      pg.setIndex(tris);
      // the part's box in world space, at rest
      const box = new THREE.Box3();
      for (const v of tris) box.expandByPoint(w.fromBufferAttribute(pos, v).applyMatrix4(m.matrixWorld));
      out.push({ src: m, geometry: pg, box });
    }
  }
  return out;
}

// throw the parts and record where they go; returns the area they cover
function simulate(pieces, floor, seed) {
  const rand = rng(seed);
  const origin = new THREE.Vector3(), all = new THREE.Box3();
  for (const p of pieces) all.union(p.box);
  all.getCenter(origin);
  origin.y = all.min.y + 0.25 * (all.max.y - all.min.y);
  origin.z -= 0.12;
  const area = all.clone();
  const q = new THREE.Quaternion(), dq = new THREE.Quaternion(), axis = new THREE.Vector3(), corner = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0), flat = new THREE.Quaternion(), local = new THREE.Vector3();
  let longest = 0;
  for (const p of pieces) {
    const c = p.box.getCenter(new THREE.Vector3()), h = p.box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const size = h.length();
    const out = c.clone().sub(origin).setY(0);
    if (out.lengthSq() < 1e-6) out.set(rand() - 0.5, 0, 1);
    out.normalize();
    const v = out.multiplyScalar(0.35 + rand() * 0.55);
    v.y = 1.3 + rand() * 0.9;
    v.z = Math.max(v.z, 0) + 0.45 + rand() * 0.35; // out the front, clear of the bumper
    const w = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar((5 + rand() * 9) / (1 + size * 6));
    const x = c.clone();
    q.identity();
    const track = [];
    let still = 0;
    for (let i = 0, t = 0; t < 6; i++, t += DT) {
      v.y -= G * DT;
      x.addScaledVector(v, DT);
      const a = w.length();
      if (a > 1e-6) q.premultiply(dq.setFromAxisAngle(axis.copy(w).divideScalar(a), a * DT));
      // lowest corner of the part's box against the floor
      let low = Infinity;
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? h.x : -h.x, k & 2 ? h.y : -h.y, k & 4 ? h.z : -h.z).applyQuaternion(q);
        low = Math.min(low, corner.y);
      }
      const ground = floor - low;
      if (x.y < ground) {
        x.y = ground;
        if (v.y < 0) v.y = v.y < -0.6 ? -v.y * BOUNCE : 0;
        v.x *= SLIDE;
        v.z *= SLIDE;
        w.multiplyScalar(SPIN_KEPT);
        // nearly stopped: tip over onto its flattest side
        if (Math.hypot(v.x, v.y, v.z) < 0.25 && w.length() < 2) {
          v.set(0, 0, 0);
          w.set(0, 0, 0);
          // lie on its biggest face: the axis through its thinnest side points down
          const ax = h.x <= h.y && h.x <= h.z ? 0 : h.y <= h.z ? 1 : 2;
          local.set(0, 0, 0).setComponent(ax, 1).applyQuaternion(q);
          if (local.dot(down) < 0) local.negate();
          flat.setFromUnitVectors(local, down);
          q.slerp(flat.multiply(q), Math.min(1, DT * 8));
          still += DT;
        }
      }
      if (i % SAMPLE === 0) {
        track.push(x.x, x.y, x.z, q.x, q.y, q.z, q.w);
        area.expandByPoint(corner.copy(x).addScaledVector(h, 1)).expandByPoint(corner.copy(x).addScaledVector(h, -1));
      }
      if (still > 0.4) break;
    }
    // finish lying exactly flat on the floor, whatever it was still doing
    const ax = h.x <= h.y && h.x <= h.z ? 0 : h.y <= h.z ? 1 : 2;
    local.set(0, 0, 0).setComponent(ax, 1).applyQuaternion(q);
    if (local.dot(down) < 0) local.negate();
    const rest = flat.setFromUnitVectors(local, down).multiply(q).clone();
    let low = Infinity;
    for (let k = 0; k < 8; k++) low = Math.min(low, corner.set(k & 1 ? h.x : -h.x, k & 2 ? h.y : -h.y, k & 4 ? h.z : -h.z).applyQuaternion(rest).y);
    const from = x.clone(), q0 = q.clone();
    for (let k = 1; k <= 15; k++) {
      const s = smooth(k / 15);
      x.copy(from).setY(from.y + (floor - low - from.y) * s);
      q.copy(q0).slerp(rest, s);
      track.push(x.x, x.y, x.z, q.x, q.y, q.z, q.w);
    }
    longest = Math.max(longest, track.length / 7);
    Object.assign(p, { centre: c, half: h, track });
  }
  return { area, frames: longest };
}

export class Crash {
  // stage: the Stage; sub: the subsystem that blows apart
  constructor(stage, sub) {
    this.stage = stage;
    this.sub = sub;
    this.pieces = split(sub.parts);
    this.seed = 1;
    this.t = undefined;
    this.blob = blobTexture();
  }

  get running() { return this.t !== undefined; }

  start() {
    const floor = this.stage.box.min.y;
    const { area, frames } = simulate(this.pieces, floor, this.seed++);
    this.area = area;
    this.fall = (frames - 1) * DT * SAMPLE; // s until the last part comes to rest
    this.back = SHAKE + this.fall + LIE;
    this.end = this.back + STAGGER + HOME;
    const order = this.pieces.map((p, i) => i).sort(() => 0.5 - Math.random());
    this.pieces.forEach((p, i) => { p.delay = (order.indexOf(i) / Math.max(1, this.pieces.length - 1)) * STAGGER; });
    if (!this.meshes) {
      this.group = new THREE.Group();
      this.meshes = this.pieces.map((p) => {
        const m = new THREE.Mesh(p.geometry, p.src.material);
        Object.assign(m, { matrixAutoUpdate: false, frustumCulled: false, receiveShadow: true, customDepthMaterial: p.src.customDepthMaterial });
        m.raycast = () => {};
        m.userData.blob = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false, opacity: 0 }),
        );
        m.userData.blob.renderOrder = 4;
        this.group.add(m, m.userData.blob);
        return m;
      });
      this.stage.scene.add(this.group);
    }
    this.group.visible = true;
    for (const p of this.sub.parts) p.m.visible = false;
    this.t = 0;
    this.step(0);
  }

  stop() {
    if (!this.running) return;
    this.t = this.end;
    this.step(0);
  }

  // advance by dt seconds; returns false once everything is back in place
  step(dt) {
    this.t += dt;
    const t = this.t, floor = this.stage.box.min.y;
    const x = new THREE.Vector3(), q = new THREE.Quaternion(), home = new THREE.Quaternion(), toPart = new THREE.Matrix4();
    const jolt = 0.004 * smooth(ramp(t, 0, SHAKE));
    this.pieces.forEach((p, i) => {
      const mesh = this.meshes[i], tr = p.track, n = tr.length / 7;
      // where the fall has it now
      const f = Math.max(0, t - SHAKE) / (DT * SAMPLE), k = Math.min(n - 1, Math.floor(f)), j = Math.min(n - 1, k + 1), a = Math.min(1, f - k);
      x.set(tr[k * 7], tr[k * 7 + 1], tr[k * 7 + 2]).lerp(new THREE.Vector3(tr[j * 7], tr[j * 7 + 1], tr[j * 7 + 2]), a);
      q.set(tr[k * 7 + 3], tr[k * 7 + 4], tr[k * 7 + 5], tr[k * 7 + 6]).slerp(new THREE.Quaternion(tr[j * 7 + 3], tr[j * 7 + 4], tr[j * 7 + 5], tr[j * 7 + 6]), a);
      if (t < SHAKE) {
        // rattling loose
        x.copy(p.centre).add(new THREE.Vector3(Math.sin(t * 90 + i), Math.sin(t * 77 + i * 2), Math.sin(t * 83 + i * 3)).multiplyScalar(jolt));
      }
      // flying home: up and over in an arc, turning back to how it sat
      const r = smooth(ramp(t, this.back + p.delay, this.back + p.delay + HOME));
      if (r > 0) {
        const lift = Math.sin(Math.PI * r) * 0.22;
        x.lerp(p.centre, r).y += lift;
        q.slerp(home, r);
      }
      toPart.makeTranslation(-p.centre.x, -p.centre.y, -p.centre.z);
      mesh.matrix.compose(x, q, new THREE.Vector3(1, 1, 1)).multiply(toPart).multiply(p.src.matrixWorld);
      mesh.matrixWorld.copy(mesh.matrix);
      mesh.renderOrder = p.src.renderOrder;
      mesh.castShadow = p.src.castShadow;
      // contact shadow on the floor, darker the closer it is
      const b = mesh.userData.blob, high = Math.max(0, x.y - p.half.y - floor);
      const flying = t >= SHAKE && r < 1;
      b.visible = flying;
      b.position.set(x.x, floor + 0.001, x.z);
      b.scale.set(p.half.x * 3 + 0.04, 1, p.half.z * 3 + 0.04);
      b.material.opacity = flying ? 0.7 * Math.max(0, 1 - high / 0.4) : 0;
    });
    if (t < this.end) return true;
    this.group.visible = false;
    for (const p of this.sub.parts) p.m.visible = true;
    this.t = undefined;
    return false;
  }
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
