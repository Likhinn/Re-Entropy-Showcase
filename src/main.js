import '@fontsource-variable/inter-tight';
import '@fontsource/geist-mono/500.css';
import './style.css';
import * as THREE from 'three';
import { Stage } from './stage.js';
import { scramble } from './scramble.js';
import { RUNS } from './fuel.js';
import { EXPLODE, SUBSYSTEMS } from './content.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const HOME_DIR = [-139, 25];
const ANIMATED = ['intake', 'hopper', 'hood', 'drive']; // subsystems with a clip in mechanism.js
let exploded = false, current = -1, view = 'loading';

// ---- build list + hotspots ---------------------------------------------------------------
const items = SUBSYSTEMS.map((s, i) => {
  const li = document.createElement('li');
  li.style.setProperty('--i', i);
  li.innerHTML = `<button class="row" type="button" aria-expanded="false" aria-controls="b-${s.id}">
      <span>${String(i + 1).padStart(2, '0')}</span><span class="t"></span><em></em></button>
    <div class="body" id="b-${s.id}"><div><p></p><dl></dl></div></div>`;
  const btn = li.querySelector('button'), title = li.querySelector('.t');
  title.textContent = s.title;
  btn.ariaLabel = s.title;
  btn.onclick = () => select(current === i ? -1 : i);
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
  if (ANIMATED.includes(s.id)) act('<path d="M7 4.5v15l12-7.5z" />', 'Actuate', () => stage.play(s.id, true));
  if (RUNS[s.id]) act('<circle cx="12" cy="12" r="8" />', 'Run subsystem', () => stage.run(s.id));
  if (acts.children.length) li.querySelector('dl').before(acts);
  $('#list').append(li);

  const spot = document.createElement('button');
  spot.className = 'spot';
  spot.type = 'button';
  spot.ariaLabel = `Focus ${s.title}`;
  spot.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><g><circle cx="20" cy="20" r="18.5" stroke-dasharray="25.06 4" stroke-dashoffset="-2"/></g><circle class="d" cx="20" cy="20" r="4.5"/></svg><b></b>';
  spot.querySelector('b').textContent = s.label.join('\n');
  spot.onclick = () => select(i);
  $('#spots').append(spot);
  return { li, btn, title, spot, s, pos: null };
});

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
  if (s) stage.fly({ box: stage.boxOf(s.id), dir: s.dir, zoom: s.zoom, shift, dur });
  else stage.fly({ box: stage.boxOf(), dir: HOME_DIR, zoom: exploded ? 1.25 : view === 'hero' && !stacked() ? 1.2 : 1, shift, dur });
}

function setView(v, dur = 1500) {
  view = v;
  body.dataset.view = v;
  for (const el of [$('#panel'), $('#close'), $('.arrows'), $('.tools')]) el.inert = v !== 'view';
  $('.hero.front').inert = v === 'view';
  if (v === 'view') items.forEach((it, i) => scramble(it.title, it.s.title, { delay: 850 + i * 80 }));
  else { mark(-1); stage.stopRun(); stage.isolate(null); setExploded(false); }
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
  history.replaceState(null, '', i >= 0 ? `#${items[i].s.id}` : location.pathname + location.search);
}

function select(i) {
  if (view === 'loading') return;
  stage.stopRun();
  if (ANIMATED.includes(items[i]?.s.id)) stage.play(items[i].s.id);
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
  if (view !== 'view') return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) stage.zoomBy(0.75);
  else if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.metaKey) stage.zoomBy(1 / 0.75);
  else if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleExploded();
  else if (e.key === 'Escape') current >= 0 ? select(-1) : setView('hero');
});

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
  stage.onResize = () => { clearTimeout(rz); rz = setTimeout(() => frame(300), 120); };

  // clicking the model itself
  const cv = $('#stage');
  let down = null, hoverQueued = false;
  cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, performance.now()]; });
  addEventListener('pointerup', (e) => {
    if (!down || view === 'loading') return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), t = performance.now() - down[2];
    down = null;
    if (moved > 5 || t > 400) return;
    const id = stage.pick(e.clientX, e.clientY), i = SUBSYSTEMS.findIndex((s) => s.id === id);
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
      stage.displaced(it.s.id, it.pos, v).project(stage.camera);
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
  await stage.load(`${import.meta.env.BASE_URL}model/robot.glb?v=${import.meta.env.VITE_MODEL_VERSION}`, EXPLODE, (e) => {
    const total = e.lengthComputable ? e.total : 3.6e6;
    goal = Math.min(0.92, e.loaded / total);
  });
  $('#loader span').textContent = 'Preparing view';
  for (const it of items) it.pos = it.s.anchor ? new THREE.Vector3(...it.s.anchor) : stage.subs.get(it.s.id).box.getCenter(new THREE.Vector3());
  const deep = SUBSYSTEMS.findIndex((s) => `#${s.id}` === location.hash);
  wire();
  stage.setMech(...(deep >= 0 ? [1, 1, 1] : [0, 0, 0]));
  stage.warmUp(new THREE.Vector3(-3.9, 2.6, -1.2));
  goal = 1;
  await filled;
  await new Promise((r) => setTimeout(r, 180));
  body.dataset.intro = '';
  setTimeout(() => delete body.dataset.intro, 2600);
  setView('hero', 2800);
  stage.start();
  if (deep >= 0) select(deep);
  else stage.play('boot');
} catch (err) {
  fail(err);
}
