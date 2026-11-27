// The robots on the site, in the order the landing page lists them (oldest first). ?robot=<id> picks one;
// without it the site opens on DEFAULT. A robot with EVENTS (Entropy) has a CAD per competition:
// ?event=<id> picks one, else its CURRENT; the viewer switches between them in place.
import * as reEntropy from './re-entropy.js';
import * as entropy from './entropy.js';

// file name -> content hash, for every model in public/model (vite.config.js); a robot whose model
// hasn't been built yet is listed as coming soon
const MODELS = JSON.parse(import.meta.env.VITE_MODELS || '{}');
const params = new URLSearchParams(location.search);

const DEFAULT = 're-entropy';

// a robot as of one of its events: that event's model, settings and subsystem list
function resolve(mod, asked) {
  const base = { ...mod.ROBOT, explode: mod.EXPLODE, subsystems: mod.SUBSYSTEMS };
  if (!mod.EVENTS) return { ...base, ready: base.model in MODELS };
  const events = mod.EVENTS.map((e) => ({ ...e, ready: !!e.model && e.model in MODELS }));
  const event = events.find((e) => e.id === asked && e.ready) || events.find((e) => e.id === mod.CURRENT);
  return {
    ...base,
    ...event.robot,
    model: event.model,
    subsystems: event.subsystems ? event.subsystems(mod.SUBSYSTEMS) : mod.SUBSYSTEMS,
    events,
    event,
    current: mod.CURRENT,
    ready: event.ready,
    at: (id) => resolve(mod, id), // the same robot at another of its events
  };
}

const asked = params.get('robot');
export const ROBOTS = [entropy, reEntropy].map((m) => resolve(m, m.ROBOT.id === asked ? params.get('event') : null));
const home = ROBOTS.find((r) => r.id === DEFAULT);
export const robot = ROBOTS.find((r) => r.id === asked && r.ready) || (home.ready ? home : ROBOTS.find((r) => r.ready)) || home;
export const modelUrl = (r) => `${import.meta.env.BASE_URL}model/${r.model}?v=${MODELS[r.model]}`;
// a data file built next to the models (tools/changes.mjs)
export const dataUrl = (file) => `${import.meta.env.BASE_URL}model/${file}?v=${MODELS[file]}`;
// r's page, at the event it's showing if that isn't its current one
export function pageFor(r) {
  const q = new URLSearchParams();
  if (r.id !== home.id) q.set('robot', r.id);
  if (r.event && r.event.id !== r.current) q.set('event', r.event.id);
  const s = q.toString();
  return `${location.pathname}${s ? `?${s}` : ''}`;
}
