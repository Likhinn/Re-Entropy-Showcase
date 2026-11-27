// Entropy's easter egg (space bar): the intake blows apart. Every CAD part flies off, tumbles and bounces
// on the floor in front of the robot, lies there a moment, then flies back into place.
// The fall is simulated once, up front, so the camera can frame where the parts will land.
import * as THREE from 'three';

const G = 9.8, DT = 1 / 240, SAMPLE = 4; // physics step; keep every 4th step (60 per second)
const SHAKE = 0.35; // s of rattling before it goes
const LIE = 1.6; // s the parts lie still before flying home
const HOME = 1.3, STAGGER = 0.7; // s each part takes to fly back, spread of their start times
const RESTITUTION = 0.3, FRICTION = 0.6; // floor: share of the hit speed it bounces back with, grip
const MAX_SPIN = 45; // rad/s
const BUMPER = 0.45; // m from the robot's centre to the front of its bumper

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

// throw the parts and record where they go; returns the area they cover.
// Each part is a rigid box (its rest-pose bounds) with a box's inertia; any corner below the floor gets a
// bounce-and-friction impulse at that corner, so parts catch an edge, flip, and topple onto a face by themselves.
function simulate(pieces, floor, seed) {
  const rand = rng(seed);
  const origin = new THREE.Vector3(), all = new THREE.Box3();
  for (const p of pieces) all.union(p.box);
  all.getCenter(origin);
  origin.y = all.min.y + 0.25 * (all.max.y - all.min.y);
  origin.z -= 0.12;
  const area = all.clone();
  const q = new THREE.Quaternion(), dq = new THREE.Quaternion(), axis = new THREE.Vector3();
  const R = new THREE.Matrix3(), Rt = new THREE.Matrix3(), invI = new THREE.Matrix3(), m4 = new THREE.Matrix4();
  const r = new THREE.Vector3(), vp = new THREE.Vector3(), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let longest = 0;
  for (const p of pieces) {
    const c = p.box.getCenter(new THREE.Vector3()), h = p.box.getSize(new THREE.Vector3()).multiplyScalar(0.5).max(new THREE.Vector3(0.002, 0.002, 0.002));
    const size = h.length();
    // inverse inertia of a solid box, per unit mass, in its own axes
    const inv = [3 / (h.y * h.y + h.z * h.z), 3 / (h.x * h.x + h.z * h.z), 3 / (h.x * h.x + h.y * h.y)];
    const out = c.clone().sub(origin).setY(0);
    if (out.lengthSq() < 1e-6) out.set(rand() - 0.5, 0, 1);
    out.normalize();
    const v = out.multiplyScalar(0.4 + rand() * 0.6);
    v.y = 1.6 + rand() * 1.0;
    // out the front, clear of the bumper: the further back it starts, the harder it's thrown
    v.z = Math.max(v.z, 0) + 0.5 + rand() * 0.4 + Math.max(0, BUMPER - c.z) * 2.5;
    const w = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar((10 + rand() * 18) / (1 + size * 4));
    const x = c.clone();
    q.identity();
    const track = [];
    // an impulse J at r from the centre
    const push = (J) => { v.add(J); w.add(a.copy(r).cross(J).applyMatrix3(invI)); };
    // how hard the corner at r resists being pushed along d
    const stiff = (d) => 1 + d.dot(b.copy(r).cross(d).applyMatrix3(invI).cross(r));
    let still = 0;
    for (let i = 0, time = 0; time < 5; i++, time += DT) {
      v.y -= G * DT;
      x.addScaledVector(v, DT);
      const spin = w.length();
      if (spin > 1e-6) q.premultiply(dq.setFromAxisAngle(axis.copy(w).divideScalar(spin), spin * DT)).normalize();
      R.setFromMatrix4(m4.makeRotationFromQuaternion(q));
      invI.copy(R).multiply(new THREE.Matrix3().set(inv[0], 0, 0, 0, inv[1], 0, 0, 0, inv[2])).multiply(Rt.copy(R).transpose());
      // floor contacts, a few passes so a face landing on four corners comes out even
      let sink = 0;
      for (let pass = 0; pass < 3; pass++) {
        for (let k = 0; k < 8; k++) {
          r.set(k & 1 ? h.x : -h.x, k & 2 ? h.y : -h.y, k & 4 ? h.z : -h.z).applyQuaternion(q);
          const depth = floor - (x.y + r.y);
          if (depth <= 0) continue;
          sink = Math.max(sink, depth);
          vp.copy(w).cross(r).add(v);
          if (vp.y >= 0) continue;
          const jn = (-(1 + (vp.y < -0.6 ? RESTITUTION : 0)) * vp.y) / stiff(UP);
          push(t.set(0, jn, 0));
          // friction against the sliding of that corner, at most FRICTION times the push
          vp.copy(w).cross(r).add(v).setY(0);
          const slip = vp.length();
          if (slip > 1e-6) {
            t.copy(vp).divideScalar(-slip);
            push(t.multiplyScalar(Math.min(slip / stiff(t.clone()), FRICTION * jn)));
          }
        }
      }
      if (sink > 0) {
        x.y += sink;
        w.multiplyScalar(1 - 1.5 * DT); // a little rolling resistance
      }
      if (w.lengthSq() > MAX_SPIN * MAX_SPIN) w.setLength(MAX_SPIN);
      // barely moving on the floor: let it come to rest instead of jittering on its corners
      let fastest = 0;
      if (sink > 0) for (let k = 0; k < 8; k++) {
        r.set(k & 1 ? h.x : -h.x, k & 2 ? h.y : -h.y, k & 4 ? h.z : -h.z).applyQuaternion(q);
        fastest = Math.max(fastest, vp.copy(w).cross(r).add(v).length());
      }
      const slow = sink > 0 && fastest < 0.08;
      if (slow) { v.multiplyScalar(0.9); w.multiplyScalar(0.9); }
      still = slow ? still + DT : 0;
      if (i % SAMPLE === 0) {
        track.push(x.x, x.y, x.z, q.x, q.y, q.z, q.w);
        area.expandByPoint(r.copy(x).add(h)).expandByPoint(r.copy(x).sub(h));
      }
      if (still > 0.3) break;
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
