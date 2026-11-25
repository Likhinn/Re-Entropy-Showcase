// How the moving subsystems travel, measured from the CAD. Viewer axes in metres: Y up, +Z = robot front.
// Rest pose: intake deployed, hopper out and locked, hood raised. (The CAD has the hopper locks open.)
const rad = (d) => (d * Math.PI) / 180;

const INTAKE_STOW = 130; // degrees the intake folds back over the rollers
const HOOD_DOWN = 34; // degrees the hood drops; needed to clear the retracted hopper
const LOCK_ANGLE = 15; // degrees the hopper lock plates swing down into their notches
const HOPPER_SEAT = 4.3; // mm short of fully out where the panel notches line up with the lock bolts
// the hopper-lock elastic: [y, z] of the top post and of the screw on the lock plate's tail
// camera field of view: lens position and the four corner rays (from the CAD), length in metres
export const CONE = {
  lens: [-0.2423, 0.3867, -0.3413],
  rays: [[-0.0181, 0.0014, -0.0278], [-0.0181, 0.0216, -0.0175], [0.0182, 0.0216, -0.0175], [0.0182, 0.0014, -0.0278]],
  length: 0.5,
};
export const ELASTIC = { post: [0.3795, 0.005], pin: [0.2525, -0.0205] };
// hopper retraction (mm) at every 10 degrees of intake angle: where the intake touches the hopper's front panels
const HOPPER_PUSH = [0, 6, 21, 45, 63, 68, 83, 111, 152, 182, 206, 229, 262, 304];

export const PIVOT = {
  intake: { main: [0.194, 0.286], spin: [0.1095, 0.1255] }, // [y, z]
  hopper: { main: [0, 0], spin: [0.252, 0.005] },
  hood: { main: [0.443, -0.278], spin: [0.403, -0.066] },
};

// d: 0 stowed .. 1 deployed, h: 0 down .. 1 raised, l: 0 hopper unlocked .. 1 locked -> per subsystem [angle, slide along Z, second pivot angle]
export function pose(d, h, l) {
  const a = INTAKE_STOW * (1 - d), k = Math.min(HOPPER_PUSH.length - 1.001, a / 10), i = Math.floor(k);
  // Catmull-Rom through the table so the hopper never jerks
  const p = (n) => HOPPER_PUSH[Math.max(0, Math.min(HOPPER_PUSH.length - 1, n))], t = k - i;
  const push = p(i) + 0.5 * t * (p(i + 1) - p(i - 1) + t * (2 * p(i - 1) - 5 * p(i) + 4 * p(i + 1) - p(i + 2) + t * (3 * (p(i) - p(i + 1)) + p(i + 2) - p(i - 1))));
  const drop = rad(HOOD_DOWN * (1 - h));
  return {
    intake: [-rad(a), 0, -rad(a) * 3], // #25 chain, 12T to 36T
    hopper: [0, -(HOPPER_SEAT + Math.max(0, push) * (1 - HOPPER_SEAT / 304)) / 1000, rad(LOCK_ANGLE) * l],
    hood: [drop, 0, -drop * 17], // 10T pinion on the hood rack
  };
}

// Swerve demo: drive forward, strafe, then turn in place. The wheels' CAD pose is the turning one.
// -> steer (-1 forward .. 0 turning .. 1 strafe) and how far the wheels have rolled in each mode (radians)
export const SWERVE_SECONDS = 6.4;
export function swerve(t) {
  const go = (a, b) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  return { steer: -go(0, 0.6) + 2 * go(2.1, 2.9) - go(4.3, 4.9), roll: [14 * go(0.5, 2.2), 12 * go(2.8, 4.4), 12 * go(4.8, 6.4)] };
}

// Keyframes: each eases to d / h / l over ms. `now` is the current { d, h, l }.
// Order matters: the hood must drop and the locks must open before the hopper can slide back.
export const CLIPS = {
  boot: () => [{ ms: 1800 }, { ms: 1700, d: 1 }, { ms: 260, l: 1 }, { ms: 900, h: 1 }],
  intake: () => [{ ms: 600, h: 0 }, { ms: 300, l: 0 }, { ms: 1300, d: 0 }, { ms: 350 }, { ms: 1600, d: 1 }, { ms: 260, l: 1 }, { ms: 800, h: 1 }],
  hopper: () => [{ ms: 600, h: 0 }, { ms: 700, l: 0 }, { ms: 250 }, { ms: 1400, d: 0 }, { ms: 350 }, { ms: 1700, d: 1 }, { ms: 250 }, { ms: 500, l: 1 }, { ms: 800, h: 1 }],
  hood: (now) => [{ ms: now.d < 1 ? 900 : 1, d: 1 }, { ms: now.l < 1 ? 260 : 350, l: 1 }, { ms: 900, h: 0 }, { ms: 300 }, { ms: 1200, h: 1 }],
  rest: (now) => [{ ms: now.d < 1 ? 600 : 1, d: 1 }, { ms: now.l < 1 ? 200 : 1, l: 1 }, { ms: now.h < 1 ? 300 : 1, h: 1 }],
};
