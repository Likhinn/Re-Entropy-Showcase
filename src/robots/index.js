// The robots on the site, in the order the landing page lists them (oldest first). ?robot=<id> picks one;
// without it the site opens on DEFAULT.
import * as reEntropy from './re-entropy.js';
import * as entropy from './entropy.js';

// file name -> content hash, for every model in public/model (vite.config.js); a robot whose model
// hasn't been built yet is listed as coming soon
const MODELS = JSON.parse(import.meta.env.VITE_MODELS || '{}');

const DEFAULT = 're-entropy';
export const ROBOTS = [entropy, reEntropy].map((r) => ({ ...r.ROBOT, explode: r.EXPLODE, subsystems: r.SUBSYSTEMS, ready: r.ROBOT.model in MODELS }));

const asked = new URLSearchParams(location.search).get('robot');
const home = ROBOTS.find((r) => r.id === DEFAULT);
export const robot = ROBOTS.find((r) => r.id === asked && r.ready) || (home.ready ? home : ROBOTS.find((r) => r.ready)) || home;
export const modelUrl = (r) => `${import.meta.env.BASE_URL}model/${r.model}?v=${MODELS[r.model]}`;
export const pageFor = (r) => `${location.pathname}${r === home ? '' : `?robot=${r.id}`}`;
