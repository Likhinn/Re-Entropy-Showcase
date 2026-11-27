// What changed on Entropy from one event to another, for the viewer's event timeline.
// Usage: node tools/changes.mjs   (after npm run model -- entropy, entropy-albany and entropy-dalton)
// Reads the part listings the model builds write, matches parts between every two events by where they
// sit and how big they are (the CADs name the same part differently), and writes, for every pair, the
// parts that are new or different in the second one: public/model/entropy-changes.json
//   { "albany>worlds": [[subsystem, part name, x, y, z], ...] }
// x, y, z: the part's centre exactly as the model stores it per vertex (int16), so the viewer can find it;
// the viewer picks the parts each change on the timeline touched (src/robots/entropy.js EVENTS).
import fs from 'node:fs';

const EVENTS = { dalton: 'tools/parts-entropy-dalton.tsv', albany: 'tools/parts-entropy-albany.tsv', worlds: 'tools/parts-entropy.tsv' };
const NEAR = 3; // mm: same place, same size
// fasteners come and go with the CAD's level of detail; the parts they hold show the change
const FASTENER = /screw|SHCS|BHCS|FHCS|bolt|\bnut\b|locknut|jam nut|washer|rivet|rivnut|grommet|zip ?tie/i;

const load = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => {
  const [sub, name, c, size, key] = l.split('\t');
  return { sub, name, c: c.split(',').map(Number), size: size.split(',').map(Number), key: key.split(',').map(Number) };
}).filter((p) => !FASTENER.test(p.name));
const parts = Object.fromEntries(Object.entries(EVENTS).filter(([, f]) => fs.existsSync(f)).map(([id, f]) => [id, load(f)]));

// parts bucketed by rounded position so matching stays fast
const index = (list) => {
  const m = new Map();
  for (const p of list) {
    const k = p.c.map((v) => Math.round(v / 10)).join();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  return m;
};
const close = (a, b) => a.every((v, d) => Math.abs(v - b[d]) <= NEAR);
function found(p, idx) {
  const [x, y, z] = p.c.map((v) => Math.round(v / 10));
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++)
    if (idx.get(`${x + i},${y + j},${z + k}`)?.some((q) => close(p.c, q.c) && close(p.size, q.size))) return true;
  return false;
}
const count = (list) => list.reduce((o, p) => ((o[p.sub] = (o[p.sub] || 0) + 1), o), {});

const out = {};
for (const a in parts) for (const b in parts) {
  if (a === b) continue;
  const ia = index(parts[a]), ib = index(parts[b]);
  const added = parts[b].filter((p) => !found(p, ia)), removed = parts[a].filter((p) => !found(p, ib));
  out[`${a}>${b}`] = added.map((p) => [p.sub, p.name, ...p.key]);
  console.log(`${a} > ${b}: ${added.length} new or changed, ${removed.length} gone`, JSON.stringify(count(added)), JSON.stringify(count(removed)));
}
fs.writeFileSync('public/model/entropy-changes.json', JSON.stringify(out));
