import '@fontsource-variable/inter-tight';
import '@fontsource/geist-mono/500.css';
import './style.css';
import * as THREE from 'three';
import { Stage } from './stage.js';
import { scramble } from './scramble.js';
import { RUNS as FUEL_RUNS } from './fuel.js';
import { ROBOTS, robot, modelUrl, dataUrl, pageFor } from './robots/index.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
// the robot as shown: for a robot with events, as of the event on screen (switchEvent changes it)
let R = robot;
const runsOf = (r) => (r.runs ? r.kit?.RUNS || FUEL_RUNS : {});
const HOME_DIR = robot.home;
const EGG_DIR = [-8, 9]; // front-left: the loose flywheel runs off into the distance behind the robot
let exploded = false, current = -1, view = 'loading';

// ---- which robot -------------------------------------------------------------------------
document.title = `${robot.name} | Interactive 3D View`;
$('.hero h1').textContent = robot.name.toUpperCase();
$('.brand').textContent = robot.name;
$('#pname').textContent = `${robot.name}:`;
$('#prole').textContent = robot.role.replace(/\b\w/g, (c) => c.toUpperCase());
$('#stage').ariaLabel = `3D model of the ${robot.name} robot. Drag to rotate.`;
for (const r of ROBOTS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.setAttribute('aria-pressed', r === robot);
  b.disabled = !r.ready;
  b.innerHTML = '<b></b><span></span>';
  b.querySelector('b').textContent = r.name;
  b.querySelector('span').textContent = r.ready ? r.role : `${r.role} · coming soon`;
  // the other robot is a page of its own: fade out, then load it
  b.onclick = () => {
    if (r === robot || view !== 'hero') return;
    body.dataset.leaving = '';
    setTimeout(() => { location.href = pageFor(r); }, 650);
  };
  $('#robots').append(b);
}
addEventListener('pageshow', (e) => { if (e.persisted) delete body.dataset.leaving; }); // back button

// ---- list + hotspots, for the robot as shown ----------------------------------------------
let items = [];
function buildItems() {
  $('#list').replaceChildren();
  $('#spots').replaceChildren();
  const RUNS = runsOf(R);
  items = R.subsystems.map((s, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', i);
    li.innerHTML = `<button class="row" type="button" aria-expanded="false" aria-controls="b-${s.id}">
        <span>${String(i + 1).padStart(2, '0')}</span><span class="t"></span><em></em></button>
      <div class="body" id="b-${s.id}"><div><p></p><dl></dl></div></div>`;
    const btn = li.querySelector('button'), title = li.querySelector('.t');
    title.textContent = s.title;
    btn.ariaLabel = s.title;
    btn.onclick = () => { const k = items.indexOf(it); select(current === k ? -1 : k); };
    li.querySelector('p').textContent = s.text;
    for (const [k, val] of s.specs) {
      const d = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd');
      a.textContent = k;
      b.textContent = val;
      d.append(a, b);
      li.querySelector('dl').append(d);
    }
    const acts = document.createElement('div');
    acts.className = 'acts';
    const act = (icon, label, fn) => {
      const b = document.createElement('button');
      b.className = 'play';
      b.type = 'button';
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${label}`;
      b.onclick = () => assembled(s.id, fn);
      acts.append(b);
    };
    if (R.animated.includes(s.id)) act('<path d="M7 4.5v15l12-7.5z" />', 'Actuate', () => stage.play(s.id, true));
    if (RUNS[s.id]) act('<circle cx="12" cy="12" r="8" />', 'Run subsystem', () => stage.run(s.id));
    if (acts.children.length) li.querySelector('dl').before(acts);
    $('#list').append(li);

    const spot = document.createElement('button');
    spot.className = 'spot';
    spot.type = 'button';
    spot.ariaLabel = `Focus ${s.title}`;
    spot.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><g><circle cx="20" cy="20" r="18.5" stroke-dasharray="25.06 4" stroke-dashoffset="-2"/></g><circle class="d" cx="20" cy="20" r="4.5"/></svg><b></b>';
    spot.querySelector('b').textContent = s.label.join('\n');
    spot.onclick = () => select(items.indexOf(it));
    $('#spots').append(spot);
    const it = { li, btn, title, spot, s, pos: null };
    return it;
  });
}

// once the model is in: drop anything its CAD doesn't have, and pin each hotspot
function placeItems() {
  items = items.filter((it) => {
    if (stage.subs.has(it.s.id)) return true;
    it.li.remove();
    it.spot.remove();
    return false;
  });
  items.forEach((it, i) => {
    it.li.style.setProperty('--i', i);
    it.li.querySelector('.row span').textContent = String(i + 1).padStart(2, '0');
    it.pos = it.s.anchor ? new THREE.Vector3(...it.s.anchor) : stage.subs.get(it.s.id).box.getCenter(new THREE.Vector3());
  });
}

// ---- view state --------------------------------------------------------------------------
const stackedMq = matchMedia('(max-width:820px),(max-aspect-ratio:1/1)');
const stacked = () => stackedMq.matches;

function frame(dur) {
  if (view === 'loading') return;
  const s = items[current]?.s;
  const shift = view === 'view'
    ? (stacked() ? { x: 0, y: 0.24 } : { x: 0.195, y: 0 })
    : { x: 0, y: stacked() ? 0 : -0.075 };
  stage.controls.enableZoom = view === 'view';
  if (s) stage.fly({ box: stage.boxOf(s.id), dir: stage.eggT !== undefined ? EGG_DIR : s.dir, zoom: s.zoom, shift, dur });
  else stage.fly({ box: stage.boxOf(), dir: stage.eggT !== undefined ? EGG_DIR : HOME_DIR, zoom: exploded ? 1.25 : stage.eggT !== undefined ? 1.1 : view === 'hero' && !stacked() ? 1.2 : 1, shift, dur });
}

function setView(v, dur = 1500) {
  view = v;
  body.dataset.view = v;
  for (const el of [$('#panel'), $('#close'), $('.arrows'), $('.tools')]) el.inert = v !== 'view';
  $('.hero.front').inert = v === 'view';
  if (v === 'view') items.forEach((it, i) => scramble(it.title, it.s.title, { delay: 850 + i * 80 }));
  else { mark(-1); stage.stopRun(); stage.isolate(null); setExploded(false); showChange(null); }
  frame(dur);
}

function setExploded(on) {
  exploded = on;
  stage.explode(on);
  $('#explode').setAttribute('aria-pressed', on);
  $('#explode span').textContent = on ? 'Reassemble' : 'Explode';
}
function toggleExploded() {
  setExploded(!exploded);
  frame(2000);
}

// mechanisms only move on the assembled robot, so put it back together first
function assembled(id, fn) {
  if (!exploded) return fn();
  toggleExploded();
  stage.afterAssembly = () => items[current]?.s.id === id && fn();
}

function mark(i) {
  current = i;
  items.forEach((it, k) => {
    it.li.classList.toggle('on', k === i);
    it.spot.classList.toggle('on', k === i);
    it.btn.setAttribute('aria-expanded', k === i);
  });
  if (i >= 0) body.dataset.focus = '';
  else delete body.dataset.focus;
  history.replaceState(null, '', `${pageFor(R)}${i >= 0 ? `#${items[i].s.id}` : ''}`);
}

function select(i) {
  if (view === 'loading' || swapping) return;
  stage.stopRun();
  if (R.animated.includes(items[i]?.s.id)) stage.play(items[i].s.id);
  mark(i);
  stage.isolate(i >= 0 ? items[i].s.id : null);
  if (view !== 'view') setView('view');
  else frame(1400);
  if (i >= 0) setTimeout(() => items[i].li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 600);
}
const step = (d) => select(current < 0 ? (d > 0 ? 0 : items.length - 1) : (current + d + items.length) % items.length);

$('#launch').onclick = () => setView('view');
$('#close').onclick = () => setView('hero');
$('#zoomin').onclick = () => stage.zoomBy(0.75);
$('#zoomout').onclick = () => stage.zoomBy(1 / 0.75);
$('#explode').onclick = toggleExploded;
$('#prev').onclick = () => step(-1);
$('#next').onclick = () => step(1);
addEventListener('keydown', (e) => {
  // easter egg on the landing page and the shooter-side pages
  if (e.key === ' ' && R.egg && !exploded && (view === 'hero' || ['indexer', 'shooter', 'hood'].includes(items[current]?.s.id))) {
    e.preventDefault();
    if (!e.repeat) stage.egg();
    return;
  }
  // Entropy's: the intake blows apart, on the landing page and the intake's page
  if (e.key === ' ' && R.crash && !exploded && !swapping && (view === 'hero' || items[current]?.s.id === 'intake')) {
    e.preventDefault();
    if (!e.repeat) stage.crash();
    return;
  }
  if (view !== 'view') return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) stage.zoomBy(0.75);
  else if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.metaKey) stage.zoomBy(1 / 0.75);
  else if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleExploded();
  else if (e.key === 'Escape') {
    if (shownChange) showChange(null);
    else if (current >= 0) select(-1);
    else setView('hero');
  }
});

// ---- event timeline (interactive view): the robot at each competition it went to -----------
// One line through every event: the one shown is a filled dot the line breaks around, the others
// rings. On the line before an event, one point for what was changed for it: clicking it shows that
// event's robot with every change picked out, and clicking a picked-out part tells that one change.
const DOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="12" r="5.6" /><path d="M20.46 9A9 9 0 0 0 3.54 9M3.54 15A9 9 0 0 0 20.46 15" /></svg>';
const RING = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" /></svg>';
let swapping = false, shownChange = null, changeData = null;
const eventIndex = (id) => R.events.findIndex((e) => e.id === id);

function renderTimeline() {
  const nav = $('#events');
  nav.hidden = false;
  nav.replaceChildren();
  const seg = (e) => {
    const s = document.createElement('span');
    s.className = 'seg';
    if (e?.changes?.length) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp';
      b.title = `What changed for ${e.name}`;
      b.ariaLabel = b.title;
      b.setAttribute('aria-pressed', shownChange?.e.id === e.id);
      b.onclick = () => (shownChange?.e.id === e.id ? showChange(null) : showChange(e));
      s.append(b);
    }
    return s;
  };
  nav.append(seg());
  R.events.forEach((e, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ev';
    b.disabled = !e.ready;
    const on = e.id === R.event.id;
    if (on) b.setAttribute('aria-current', 'step');
    b.innerHTML = `${on ? DOT : RING}<b></b>`;
    b.querySelector('b').textContent = e.name;
    b.title = e.ready ? `${e.name}${e.label ? ` (${e.label})` : ''}` : `${e.name}: coming soon`;
    b.ariaLabel = `${robot.name} at ${e.name}${e.ready ? '' : ', coming soon'}`;
    b.onclick = () => { showChange(null); switchEvent(e.id); };
    nav.append(b, seg(R.events[i + 1]));
  });
}

// what was changed for event e, on its robot (switching to it): every change it made picked out
async function showChange(e) {
  shownChange = e ? { e, parts: [], k: 0 } : null;
  const pick = shownChange;
  for (const b of document.querySelectorAll('.cp')) b.setAttribute('aria-pressed', false);
  const note = $('#evnote');
  if (!e) {
    stage?.showChanges(false);
    note.classList.remove('on');
    return;
  }
  const evs = R.events, before = evs.slice(0, eventIndex(e.id)).reverse().find((x) => x.ready);
  pick.before = before;
  pick.parts = e.changes.filter((c) => c.on !== 'before');
  pick.told = e.changes.filter((c) => c.on === 'before');
  if (R.event.id !== e.id) await switchEvent(e.id, true);
  if (shownChange !== pick) return; // something else was picked meanwhile
  for (const b of document.querySelectorAll('.cp')) b.setAttribute('aria-pressed', b.title === `What changed for ${e.name}`);
  changeData ||= await fetch(dataUrl(robot.changes)).then((r) => r.json());
  const diff = changeData[`${before.id}>${e.id}`] || [];
  stage.markChanged(pick.parts.map((c) => diff.filter(([sub, name]) => c.subs.includes(sub) && (!c.name || c.name.test(name))).map((p) => p.slice(2))));
  stage.showChanges(true);
  tellChange(0);
}

// the note under the timeline: all of the changes (k 0), or the one picked (1..n)
function tellChange(k) {
  const pick = shownChange;
  pick.k = k;
  stage.pickChange(k);
  const note = $('#evnote'), n = pick.parts.length;
  note.querySelector('span').textContent = k ? `${pick.before.name} → ${pick.e.name} · ${k} of ${n}` : `${pick.before.name} → ${pick.e.name}`;
  note.querySelector('b').textContent = k
    ? pick.parts[k - 1].text
    : [`${n} changes, highlighted: click one to see what it was.`, ...pick.told.map((c) => c.text)].join(' ');
  note.classList.add('on');
}

// put the robot as of another event on screen: the one shown drops away and the other comes in,
// downward when moving forward in time, upward when going back
async function switchEvent(id, keepChange) {
  const e = R.events.find((x) => x.id === id);
  if (swapping || !e?.ready || e.id === R.event.id) return;
  if (!keepChange) showChange(null);
  swapping = true;
  body.dataset.swapping = '';
  const dir = eventIndex(id) > eventIndex(R.event.id) ? 1 : -1, keep = items[current]?.s.id;
  stage.stopRun();
  if (exploded) setExploded(false);
  mark(-1);
  R = R.at(id);
  renderTimeline();
  history.replaceState(null, '', pageFor(R) + (keep ? `#${keep}` : ''));
  try {
    stage.withCone = R.cone;
    await stage.swap(modelUrl(R), R.explode, dir);
  } finally {
    buildItems();
    placeItems();
    items.forEach((it, i) => scramble(it.title, it.s.title, { delay: i * 50 }));
    delete body.dataset.swapping;
    swapping = false;
  }
  const k = items.findIndex((it) => it.s.id === keep);
  if (k >= 0) {
    mark(k);
    stage.isolate(keep);
  }
  frame(900);
}

// ---- loading screen ------------------------------------------------------------------------
// the title waits mid-screen filling with light, then its letters fly up into place
const h1 = $('.hero h1'), letters = [...h1.textContent.trim()].map((c, i) => {
  const s = document.createElement('span');
  s.textContent = s.dataset.c = c;
  s.style.setProperty('--n', i);
  s.setAttribute('aria-hidden', true);
  return s;
});
h1.ariaLabel = h1.textContent.trim();
h1.replaceChildren(...letters);

let goal = 0, shown = 0, full;
const filled = new Promise((r) => { full = r; });
const MIN_LOAD = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1500; // ms, so a cached load still plays
const t0 = performance.now();
let lastTick = t0;
function tick(now) {
  if ($('#loader').classList.contains('err')) return;
  const dt = Math.min(50, now - lastTick);
  lastTick = now;
  const cap = Math.min(goal, (now - t0) / MIN_LOAD);
  shown = Math.min(1, shown + Math.max(0, cap - shown) * (1 - Math.exp(-dt / 90)) + (goal >= 1 ? dt / 6000 : 0));
  $('#pct').textContent = Math.floor(shown * 100);
  $('#loader').style.setProperty('--p', shown);
  letters.forEach((s, i) => s.style.setProperty('--f', `${Math.max(0, Math.min(1, shown * letters.length - i)) * 100}%`));
  if (shown >= 1) full();
  else requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---- boot --------------------------------------------------------------------------------
let stage;
function fail(err) {
  console.error(err);
  $('#loader').classList.add('err');
  $('#loader span').textContent = 'The 3D model could not be loaded. Check that WebGL is enabled, then reload.';
}

function wire() {
  let rz;
  // widen the shot while the flywheel easter egg runs, then settle back
  stage.onEgg = (on) => { if (!stage.tween || !on) frame(on ? 1100 : 1600); };
  stage.onResize = () => { clearTimeout(rz); rz = setTimeout(() => frame(300), 120); };

  // clicking the model itself
  const cv = $('#stage');
  let down = null, hoverQueued = false;
  cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, performance.now()]; });
  addEventListener('pointerup', (e) => {
    if (!down || view === 'loading' || swapping) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), t = performance.now() - down[2];
    down = null;
    if (moved > 5 || t > 400) return;
    // while an event's changes are shown, a click on one of them tells it; anywhere else, all of them again
    if (shownChange?.parts.length) {
      const k = stage.changeAt(e.clientX, e.clientY);
      if (k || shownChange.k) return tellChange(k === shownChange.k ? 0 : k);
    }
    const id = stage.pick(e.clientX, e.clientY), i = items.findIndex((it) => it.s.id === id);
    if (i >= 0 && i !== current) select(i);
    else if (i < 0 && current >= 0) select(-1);
  });
  cv.addEventListener('pointermove', (e) => {
    if (down || hoverQueued || e.pointerType !== 'mouse' || view === 'loading') return;
    hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; cv.classList.toggle('hit', !!stage.pick(e.clientX, e.clientY)); });
  });

  // hotspot projection
  const v = new THREE.Vector3();
  stage.onFrame = () => {
    for (const it of items) {
      if (!it.pos) continue;
      stage.displaced(it.s.id, it.pos, v, R.stillSpots).project(stage.camera);
      const x = (v.x * 0.5 + 0.5) * stage.w, y = (-v.y * 0.5 + 0.5) * stage.h;
      it.spot.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      const covered = view === 'view' && (stacked() ? y > stage.h * 0.48 : x > stage.w * 0.59);
      it.spot.style.visibility = covered || v.z > 1 ? 'hidden' : '';
      it.spot.classList.toggle('flip', x > stage.w * (view === 'view' && !stacked() ? 0.48 : 0.85));
    }
  };
  setInterval(() => { if (view === 'hero' && !stage.tween && !down) stage.idle = true; }, 2500);
}

try {
  stage = new Stage($('#stage'));
  window.__stage = stage;
  stage.withCone = R.cone;
  if (R.kit) stage.kit = R.kit;
  buildItems();
  await stage.load(modelUrl(R), R.explode, (e) => {
    const total = e.lengthComputable ? e.total : 3.6e6;
    goal = Math.min(0.92, e.loaded / total);
  });
  $('#loader span').textContent = 'Preparing view';
  placeItems();
  if (R.events) renderTimeline();
  const deep = items.findIndex((it) => `#${it.s.id}` === location.hash);
  wire();
  stage.setMech(...(deep >= 0 || !R.mechanisms ? [1, 1, 1] : stage.stowed));
  stage.warmUp(new THREE.Vector3(-3.9, 2.6, -1.2));
  goal = 1;
  await filled;
  await new Promise((r) => setTimeout(r, 180));
  body.dataset.intro = '';
  setTimeout(() => delete body.dataset.intro, 2600);
  setView('hero', 2800);
  stage.start();
  if (deep >= 0) select(deep);
  else if (R.mechanisms) stage.play('boot');
  // fetch the other events' models in the background, so switching to them is quick
  if (R.events) setTimeout(() => R.events.filter((e) => e.ready && e.id !== R.event.id).forEach((e) => stage.prefetch(modelUrl(R.at(e.id)))), 4000);
} catch (err) {
  fail(err);
}
