// Face-weighted normals. Simplification leaves fillet normals on flat faces, which then shade as if
// they were curved. Here every corner averages the faces around it (up to CREASE apart), each
// weighted by the area of the whole flat region it belongs to, so plates stay flat and fillets smooth.
const CREASE = Math.cos((40 * Math.PI) / 180);
const FLAT = Math.cos((1.5 * Math.PI) / 180);

// p: positions, c: RGBA per vertex, idx: triangles -> { p, n, c, i }
export function weightedNormals(p, c, idx) {
  const ids = new Map(), at = new Uint32Array(p.length / 3);
  for (let v = 0; v < at.length; v++) {
    const k = [0, 1, 2].map((d) => Math.round(p[v * 3 + d] * 2e5)).join();
    if (!ids.has(k)) ids.set(k, ids.size);
    at[v] = ids.get(k);
  }
  const F = idx.length / 3, fn = new Float64Array(F * 3), area = new Float64Array(F);
  for (let f = 0; f < F; f++) {
    const [a, b, d] = [0, 1, 2].map((k) => idx[f * 3 + k] * 3);
    const u = [0, 1, 2].map((k) => p[b + k] - p[a + k]), w = [0, 1, 2].map((k) => p[d + k] - p[a + k]);
    const x = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...x);
    area[f] = l / 2;
    if (l) for (let k = 0; k < 3; k++) fn[f * 3 + k] = x[k] / l;
  }
  const dot = (f, g) => fn[f * 3] * fn[g * 3] + fn[f * 3 + 1] * fn[g * 3 + 1] + fn[f * 3 + 2] * fn[g * 3 + 2];

  // flat regions: union faces that share an edge and a plane
  const up = Uint32Array.from({ length: F }, (_, f) => f);
  const root = (f) => { while (up[f] !== f) f = up[f] = up[up[f]]; return f; };
  const edges = new Map(), around = Array.from({ length: ids.size }, () => []);
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const a = at[idx[f * 3 + k]], b = at[idx[f * 3 + ((k + 1) % 3)]];
    around[a].push(f);
    const key = a < b ? a * 4194304 + b : b * 4194304 + a, list = edges.get(key);
    if (!list) edges.set(key, [f]);
    else {
      for (const g of list) if (dot(f, g) > FLAT) up[root(f)] = root(g);
      list.push(f);
    }
  }
  const total = new Float64Array(F);
  for (let f = 0; f < F; f++) total[root(f)] += area[f];

  const out = { p: [], n: [], c: [], i: new Uint32Array(idx.length) }, made = new Map();
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const v = idx[f * 3 + k], n = [0, 0, 0], seen = new Set();
    // sliver triangles have no reliable direction of their own: let their biggest neighbor region decide
    for (const g of around[at[v]]) {
      if (dot(f, g) < CREASE && area[f] > 1e-12) continue;
      const r = root(g);
      if (seen.has(r)) continue;
      seen.add(r);
      for (let d = 0; d < 3; d++) n[d] += fn[g * 3 + d] * total[r];
    }
    const l = Math.hypot(...n) || 1;
    const N = n.map((x) => x / l), key = v + ':' + N.map((x) => Math.round(x * 100)).join();
    let id = made.get(key);
    if (id === undefined) {
      id = out.p.length / 3;
      made.set(key, id);
      out.p.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
      out.n.push(...N);
      out.c.push(c[v * 4], c[v * 4 + 1], c[v * 4 + 2], c[v * 4 + 3]);
    }
    out.i[f * 3 + k] = id;
  }
  return out;
}
