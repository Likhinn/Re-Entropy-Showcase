// How Entropy moves, measured from its CAD. Same shape as src/mechanism.js and src/fuel.js:
// viewer pivots are [y, z] in metres (Y up, +Z = robot front); fuel paths are [t, y, z] in CAD mm
// (y = back(+)/front(-), z = up).
import { volleys } from '../fuel.js';

const rad = (d) => (d * Math.PI) / 180;

const INTAKE_STOW = 120; // degrees the intake folds up and back, to rest against the sign on the shooter's face
const HOPPER_TRAVEL = 0.305; // m the hopper slides back: its front wall ends up at the frame
const HOOD_TRAVEL = 25; // degrees the hood swings over the drum: 20 to 45 degrees of elevation
const RACK = 223 / 18; // rack pitch radius over pinion pitch radius

export const PIVOT = {
  intake: { main: [0.1905, 0.305], spin: [0.136, 0.112] }, // driven sprocket on the intake, 12T chain sprocket
  hood: { main: [0.451, -0.083], spin: [0.408, -0.322] }, // the hood swings about the drum axle; pinion shaft
  hopper: { main: [0, 0] }, // slides only
};

// d: 0 stowed .. 1 deployed, h: 0 hood swung up .. 1 down, as in the CAD, l: 0 hopper in .. 1 out (p unused)
export function pose(d, h, l) {
  const a = rad(INTAKE_STOW * (1 - d)), drop = rad(HOOD_TRAVEL * (1 - h));
  return {
    intake: [-a, 0, -a * 3], // #25 chain, 12T to 36T
    hood: [drop, 0, -drop * RACK],
    hopper: [0, -HOPPER_TRAVEL * (1 - l), 0],
  };
}

// Folded in before the boot clip. The hood is already down: the CAD pose is the bottom of its travel.
export const STOWED = { h: 1 };

// Keyframes. The hopper only slides in with the intake folded up; coming down, the cams on the intake push it back out.
export const CLIPS = {
  boot: () => [{ ms: 1800 }, { ms: 900, d: 0.5, l: 0.85 }, { ms: 1100, d: 1, l: 1 }],
  intake: (now) => [{ ms: now.l < 1 ? 1100 : 1, l: 1 }, { ms: 1500, d: 0 }, { ms: 350 }, { ms: 1800, d: 1 }],
  hopper: (now) => [{ ms: now.d > 0 ? 1500 : 1, d: 0 }, { ms: 250 }, { ms: 1300, l: 0 }, { ms: 400 }, { ms: 900, d: 0.5, l: 0.85 }, { ms: 1100, d: 1, l: 1 }],
  hood: (now) => [{ ms: now.l < 1 ? 900 : 1, l: 1 }, { ms: now.d < 1 ? 900 : 1, d: 1 }, { ms: 900, h: 0 }, { ms: 300 }, { ms: 1200, h: 1 }],
  rest: (now) => [{ ms: now.l < 1 ? 900 : 1, l: 1 }, { ms: now.d < 1 ? 900 : 1, d: 1 }, { ms: now.h < 1 ? 600 : 1, h: 1 }],
};

// Camera fields of view: lens position and four corner rays, viewer axes, length in metres.
// The ThriftyCam is the same part as Re-Entropy's, so its cone is Re-Entropy's carried over through the part's
// pose in this CAD. The ELP camera's lens window faces out the back, tilted 20 degrees up; its field of view
// isn't in the CAD, so it uses a typical 70 x 55 degrees.
export const CONES = [
  { lens: [0, 0.5345, 0.012], rays: [[0.0181, 0.0014, 0.0278], [0.0181, 0.0216, 0.0175], [-0.0182, 0.0216, 0.0175], [-0.0182, 0.0014, 0.0278]], length: 0.5 },
  { lens: [-0.233, 0.303, -0.309], rays: [[-0.7002, -0.1472, -1.1177], [-0.7002, 0.8312, -0.7617], [0.7002, 0.8312, -0.7617], [0.7002, -0.1472, -1.1177]], length: 0.5 },
];

// ---- fuel --------------------------------------------------------------------------------
const WIDE = [-225, -75, 75, 225], NARROW = [-75, 75]; // intake width, indexer and drum width
const DRUM = [83, 451], ARC = 122; // drum axle, radius the ball centre follows around it

// over the bumper, under the intake roller and up onto the indexer floor
const INTAKE = [[0, -900, 75], [0.35, -720, 75], [0.6, -600, 82], [0.8, -500, 118], [1.0, -420, 165], [1.2, -330, 232], [1.45, -250, 234]];
// back across the silicone floor, then up the curved back ramp, pushed by the kicker wheels
const RAMP = [[0, 78, 216], [0.15, 112, 231], [0.3, 141, 251], [0.45, 163, 292], [0.6, 178, 320], [0.75, 191, 395]];
const INDEXER = [[0, -330, 237], [0.3, -232, 233], [0.6, -110, 227], [0.9, 8, 221], ...RAMP.map(([t, y, z]) => [1.05 + t, y, z])];

// up the back of the drum, over the top under the hood, and out the front.
// drop: degrees the hood has swung over the drum, which releases the ball later and flatter
function shot(drop) {
  const v0 = 400, v = 5600; // mm/s: feed speed, launch speed
  const path = RAMP.slice(3).map(([t, y, z]) => [t - 0.45, y, z]);
  const on = (deg) => [DRUM[0] + ARC * Math.cos(rad(deg)), DRUM[1] + ARC * Math.sin(rad(deg))];
  const from = -27, exit = 35 + drop, steps = 10, arc = [];
  for (let k = 1; k <= steps; k++) arc.push(on(from + ((exit - from) * k) / steps));
  let t = path[path.length - 1][0], last = path[path.length - 1].slice(1);
  arc.forEach((p, k) => {
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    t += d / (v0 + (v - v0) * Math.pow((k + 0.5) / steps, 0.6));
    path.push([t, ...p]);
    last = p;
  });
  // released along the drum's surface
  const [y0, z0] = on(exit), dy = -Math.sin(rad(exit)), dz = Math.cos(rad(exit));
  for (let k = 1; k <= 6; k++) {
    const s = k * 0.055;
    path.push([t + s, y0 + v * dy * s, z0 + v * dz * s - 4900 * s * s]);
  }
  return path;
}

const HOOD_STEPS = [0, 8, 17, 25]; // hood swing for each volley, up from stowed

export const RUNS = {
  intake: { balls: () => volleys(INTAKE, 4, 0.55, WIDE), spin: { intake: 14 } },
  indexer: { balls: () => volleys(INDEXER, 4, 0.62, NARROW), spin: { indexer: 9 } },
  shooter: { balls: () => volleys(() => shot(0), 4, 0.6, NARROW), spin: { shooter: 20, hood: 26, indexer: 6 } },
  hood: {
    balls: () => volleys((row) => shot(HOOD_STEPS[row]), HOOD_STEPS.length, 1.15, NARROW).map((b) => ({ ...b, at: b.at + 0.3 })),
    spin: { shooter: 18, hood: 24, indexer: 5 },
    hood: (t, end) => {
      if (t > end - 0.6) return null; // back to stowed
      const x = Math.max(0, (t - 1) / 1.15), i = Math.min(HOOD_STEPS.length - 1, Math.floor(x)), k = t < 1 ? 0 : Math.min(1, ((x - i) * 1.15) / 0.45);
      const a = HOOD_STEPS[i], b = HOOD_STEPS[Math.min(HOOD_STEPS.length - 1, i + 1)];
      return 1 - (a + (b - a) * k * k * (3 - 2 * k)) / HOOD_TRAVEL;
    },
  },
};
