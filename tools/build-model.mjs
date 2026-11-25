// Kentropy Main.glb (raw Onshape export) -> public/model/robot.glb (web-ready).
// Usage: npm run model  [-- path/to/export.glb]
import { NodeIO, Document } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
import { OLD, flywheelDrive } from './flywheel-drive.mjs';
import { weightedNormals } from './normals.mjs';
import { classify, rig, finish, removed, recolor, DROP, REPOSE, MOVE, RIGID, POLY_GRAY } from './subsystems.mjs';

const SRC = process.argv[2] || 'Kentropy Main.glb';
const OUT = 'public/model/robot.glb';
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// ---- minimal GLB reader (the export has ~150k accessors, so skip the generic parser) ----
const raw = fs.readFileSync(SRC);
const jsonLen = raw.readUInt32LE(12);
const g = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
const binOff = 20 + jsonLen + 8;
const COMP = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] };
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3 };
function acc(i) {
  const a = g.accessors[i], v = g.bufferViews[a.bufferView], n = WIDTH[a.type], [sz, fn] = COMP[a.componentType];
  const out = a.componentType === 5126 ? new Float32Array(a.count * n) : new Uint32Array(a.count * n);
  const base = binOff + (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || sz * n;
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = raw[fn](base + k * stride + c * sz);
  return out;
}
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const clean = (n) => (n || '').replace(/^occurrence of /, '');
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const bounds = () => ({ mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] });

// ---- one simplified mesh per unique CAD part --------------------------------------------
const cache = new Map();
let triIn = 0, triOut = 0;
function part(mi) {
  if (cache.has(mi)) return cache.get(mi);
  const fresh = () => ({ p: [], n: [], c: [], i: [], map: new Map() });
  const groups = { solid: fresh(), clear: fresh() };
  for (const pr of g.meshes[mi].primitives) {
    const col = g.materials[pr.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
    const G = col[3] < 0.99 ? groups.clear : groups.solid;
    const P = acc(pr.attributes.POSITION), Nr = acc(pr.attributes.NORMAL);
    const ix = pr.indices != null ? acc(pr.indices) : Uint32Array.from({ length: P.length / 3 }, (_, k) => k);
    const remap = new Uint32Array(P.length / 3);
    for (let k = 0; k < remap.length; k++) {
      const a = k * 3, q = (v, s) => Math.round(v * s);
      const key = [q(P[a], 1e5), q(P[a + 1], 1e5), q(P[a + 2], 1e5), q(Nr[a], 24), q(Nr[a + 1], 24), q(Nr[a + 2], 24), pr.material].join();
      let id = G.map.get(key);
      if (id === undefined) {
        id = G.p.length / 3;
        G.map.set(key, id);
        G.p.push(P[a], P[a + 1], P[a + 2]);
        G.n.push(Nr[a], Nr[a + 1], Nr[a + 2]);
        G.c.push(...col);
      }
      remap[k] = id;
    }
    for (let k = 0; k < ix.length; k += 3) {
      const a = remap[ix[k]], b = remap[ix[k + 1]], c = remap[ix[k + 2]];
      if (a !== b && b !== c && a !== c) G.i.push(a, b, c);
    }
  }
  const out = {};
  for (const k in groups) {
    const G = groups[k];
    if (!G.i.length) continue;
    const pos = new Float32Array(G.p), idx = new Uint32Array(G.i);
    const { mn, mx } = bounds();
    for (let v = 0; v < pos.length; v++) { mn[v % 3] = Math.min(mn[v % 3], pos[v]); mx[v % 3] = Math.max(mx[v % 3], pos[v]); }
    const diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    const err = diag < 0.045 ? 0.0004 : 0.0002; // metres; fasteners get a looser budget
    const [s] = MeshoptSimplifier.simplifyWithAttributes(
      idx, pos, 3, new Float32Array(G.n), 3, [0.0005, 0.0005, 0.0005], null, Math.min(72, idx.length), err, ['ErrorAbsolute', 'Prune']);
    triIn += idx.length / 3;
    triOut += s.length / 3;
    const rm = new Map(), p = [], n = [], c = [], i = new Uint32Array(s.length);
    s.forEach((v, q) => {
      let id = rm.get(v);
      if (id === undefined) {
        id = p.length / 3;
        rm.set(v, id);
        for (let d = 0; d < 3; d++) { p.push(G.p[v * 3 + d]); n.push(G.n[v * 3 + d]); }
        for (let d = 0; d < 4; d++) c.push(G.c[v * 4 + d]);
      }
      i[q] = id;
    });
    if (i.length) out[k] = weightedNormals(p, c, i);
  }
  cache.set(mi, out);
  return out;
}

// ---- walk the assembly and bake every part into a (subsystem, finish) bucket -------------
const buckets = new Map(), stats = {}, listing = [];
const slots = {}; // where the replaced flywheel pulleys sat
function emit(source, M, path) {
  const move = MOVE.find((f) => f.test(path));
  if (move) { M = [...M]; move.by.forEach((v, d) => { M[12 + d] += v / 1000; }); console.log('moved', path[path.length - 1]); }
  const paint = recolor(path);
  const pm = typeof source === 'number' ? part(source) : source, xf = {}, { mn, mx } = bounds();
  for (const k in pm) {
    const { p, n } = pm[k], P = new Float32Array(p.length), Q = new Float32Array(n.length);
    for (let v = 0; v < p.length; v += 3) for (let r = 0; r < 3; r++) {
      P[v + r] = M[r] * p[v] + M[4 + r] * p[v + 1] + M[8 + r] * p[v + 2] + M[12 + r];
      Q[v + r] = M[r] * n[v] + M[4 + r] * n[v + 1] + M[8 + r] * n[v + 2];
      mn[r] = Math.min(mn[r], P[v + r]);
      mx[r] = Math.max(mx[r], P[v + r]);
    }
    xf[k] = { P, Q };
  }
  const centre = mn.map((a, d) => (a + mx[d]) * 500);
  for (const k in OLD) if (typeof source === 'number' && centre[0] < -300 && path.some((n) => /^Shootdexer/.test(n)) && OLD[k].test(path[path.length - 1])) {
    slots[k] = centre;
    return console.log('replaced', path[path.length - 1], centre.map(Math.round).join());
  }
  if (removed(path, centre)) return console.log('removed', path[path.length - 1], centre.map(Math.round).join());
  const fix = REPOSE.find((f) => f.name.test(path[path.length - 1]));
  if (fix) {
    const [py, pz] = fix.pivot.map((v) => v / 1000);
    let sy = 0, sz = 0;
    for (const k in xf) for (let v = 0; v < xf[k].P.length; v += 3) { sy += xf[k].P[v + 1] - py; sz += xf[k].P[v + 2] - pz; }
    const a = Math.atan2(fix.toward[1] - fix.pivot[1], fix.toward[0] - fix.pivot[0]) - Math.atan2(sz, sy);
    const cs = Math.cos(a), sn = Math.sin(a);
    for (const k in xf) for (const [A, oy, oz] of [[xf[k].P, py, pz], [xf[k].Q, 0, 0]]) for (let v = 0; v < A.length; v += 3) {
      const y = A[v + 1] - oy, z = A[v + 2] - oz;
      A[v + 1] = oy + y * cs - z * sn;
      A[v + 2] = oz + y * sn + z * cs;
    }
    console.log('reposed', path[path.length - 1], (a * 180 / Math.PI).toFixed(1) + ' deg');
  }
  // part centre in viewer axes, stored per vertex (int16, +-1 = +-2 m) so the viewer can explode parts
  const hub = RIGID.find((f) => f.test(path))?.centre || centre;
  const home = [hub[0], hub[2], -hub[1], 0].map((v) => Math.round(v / 2000 * 32767));
  const sub = classify(path, centre);
  listing.push([sub, path[path.length - 1], centre.map(Math.round).join()].join('\t'));
  home[3] = rig(path, sub, centre) * 1000;
  const st = (stats[sub] ||= { parts: 0, tris: 0, ...bounds() });
  st.parts++;
  for (let d = 0; d < 3; d++) { st.mn[d] = Math.min(st.mn[d], mn[d]); st.mx[d] = Math.max(st.mx[d], mx[d]); }
  const det = M[0] * (M[5] * M[10] - M[6] * M[9]) - M[4] * (M[1] * M[10] - M[2] * M[9]) + M[8] * (M[1] * M[6] - M[2] * M[5]);
  for (const k in pm) {
    const key = `${sub}__${k === 'clear' ? 'clear' : finish(path.slice(1))}`;
    if (!buckets.has(key)) buckets.set(key, { p: [], n: [], c: [], i: [], o: [] });
    const B = buckets.get(key), off = B.p.length / 3, { P, Q } = xf[k], { c, i } = pm[k];
    for (let v = 0; v < P.length; v += 3) { // Z-up -> Y-up, robot front faces +Z
      B.p.push(P[v], P[v + 2], -P[v + 1]);
      B.n.push(Q[v], Q[v + 2], -Q[v + 1]);
      B.o.push(...home);
    }
    for (let v = 0; v < c.length; v += 4) B.c.push(...(paint || [c[v], c[v + 1], c[v + 2]]).map((x) => toLinear(k === 'clear' ? Math.max(x, POLY_GRAY) : x)), c[v + 3]);
    for (let q = 0; q < i.length; q += 3) {
      if (det < 0) B.i.push(off + i[q], off + i[q + 2], off + i[q + 1]);
      else B.i.push(off + i[q], off + i[q + 1], off + i[q + 2]);
    }
    st.tris += i.length / 3;
  }
}
function walk(ni, M, path) {
  const nd = g.nodes[ni], nm = clean(nd.name);
  if (DROP.test(nm)) return;
  if (nd.rotation || nd.scale) throw new Error(`rotation/scale TRS not handled: ${nm}`);
  let L = nd.matrix || I4;
  if (!nd.matrix && nd.translation) { L = [...I4]; [L[12], L[13], L[14]] = nd.translation; }
  const W = mul(M, L), np = path[path.length - 1] === nm ? path : [...path, nm];
  if (nd.mesh != null) emit(nd.mesh, W, np);
  (nd.children || []).forEach((c) => walk(c, W, np));
}
g.scenes[g.scene || 0].nodes.forEach((n) => walk(n, I4, []));
if (slots.big && slots.small) for (const { name, pm } of flywheelDrive(slots.big, slots.small)) emit(pm, I4, ['robot', 'Shootdexer Complete Assembly <1>', 'Static Shootdexer Assembly <1>', name]);

// ---- write ------------------------------------------------------------------------------
const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('robot'), root = doc.createNode('robot');
scene.addChild(root);
const accessor = (type, array, norm = false) => doc.createAccessor().setType(type).setArray(array).setNormalized(norm).setBuffer(buf);
for (const [key, B] of [...buckets].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(B.p)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(B.n)))
    .setAttribute('COLOR_0', accessor('VEC4', Uint8Array.from(B.c, (x) => Math.round(x * 255)), true))
    .setAttribute('_CENTER', accessor('VEC4', Int16Array.from(B.o), true))
    .setIndices(accessor('SCALAR', new Uint32Array(B.i)))
    .setMaterial(doc.createMaterial(key));
  root.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim)));
}
await doc.transform(
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ pattern: /^(POSITION|NORMAL|COLOR_0)$/, quantizePosition: 16, quantizeNormal: 8, quantizationVolume: 'scene' }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync('public/model', { recursive: true });
await io.write(OUT, doc);
fs.writeFileSync('tools/parts.tsv', listing.sort().join('\n'));
console.log(`unique tris ${triIn} -> ${triOut}; ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB; ${buckets.size} draw calls`);
for (const [k, s] of Object.entries(stats))
  console.log(k.padEnd(9), String(s.parts).padStart(5), 'parts', String(s.tris).padStart(8), 'tris', s.mn.map((x) => x.toFixed(2)).join(), '->', s.mx.map((x) => x.toFixed(2)).join());
