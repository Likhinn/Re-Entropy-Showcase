// How the moving subsystems travel, measured from the CAD. Viewer axes in metres: Y up, +Z = robot front.
// Everything is at rest in the CAD pose: intake deployed, hopper out, hood raised.
const rad = (d) => (d * Math.PI) / 180;

const INTAKE_STOW = 130; // degrees the intake folds back over the rollers
const HOOD_DOWN = 34; // degrees the hood drops; needed to clear the retracted hopper
// hopper retraction (mm) at every 10 degrees of intake angle: where the intake touches the hopper's front panels
const HOPPER_PUSH = [0, 6, 21, 45, 63, 68, 83, 111, 152, 182, 206, 229, 262, 304];

export const PIVOT = {
  intake: { main: [0.194, 0.286], spin: [0.1095, 0.1255] }, // [y, z]
  hopper: { main: [0, 0], spin: [0, 0] },
  hood: { main: [0.443, -0.278], spin: [0.403, -0.066] },
};

// d: 0 stowed .. 1 deployed, h: 0 down .. 1 raised -> per subsystem [angle, slide along Z, spin angle]
export function pose(d, h) {
  const a = INTAKE_STOW * (1 - d), k = Math.min(HOPPER_PUSH.length - 1.001, a / 10), i = Math.floor(k);
  // Catmull-Rom through the table so the hopper never jerks
  const p = (n) => HOPPER_PUSH[Math.max(0, Math.min(HOPPER_PUSH.length - 1, n))], t = k - i;
  const push = p(i) + 0.5 * t * (p(i + 1) - p(i - 1) + t * (2 * p(i - 1) - 5 * p(i) + 4 * p(i + 1) - p(i + 2) + t * (3 * (p(i) - p(i + 1)) + p(i + 2) - p(i - 1))));
  const drop = rad(HOOD_DOWN * (1 - h));
  return {
    intake: [-rad(a), 0, -rad(a) * 3], // #25 chain, 12T to 36T
    hopper: [0, d >= 1 ? 0 : -Math.max(0, push) / 1000, 0],
    hood: [drop, 0, -drop * 17], // 10T pinion on the hood rack
  };
}

// Keyframes: each eases to d / h over ms. `now` is the current { d, h }.
export const CLIPS = {
  boot: () => [{ ms: 1800 }, { ms: 1700, d: 1 }, { ms: 900, h: 1 }],
  // the hood has to drop before the hopper can slide back over it
  intake: () => [{ ms: 600, h: 0 }, { ms: 1300, d: 0 }, { ms: 350 }, { ms: 1600, d: 1 }, { ms: 800, h: 1 }],
  hood: (now) => [{ ms: now.d < 1 ? 900 : 350, d: 1 }, { ms: 900, h: 0 }, { ms: 300 }, { ms: 1200, h: 1 }],
  rest: (now) => [{ ms: now.d < 1 ? 600 : 1, d: 1 }, { ms: now.h < 1 ? 300 : 1, h: 1 }],
};
