// Decides which subsystem every CAD part belongs to.
// path: array of node names from the root down to the part.
// c: part centre in mm, CAD axes (x = left/right, y = back(+)/front(-), z = up).
const inPath = (path, re) => path.some((n) => re.test(n));

export const DROP = /^Origin Cube|^Text$/;

// Parts in the CAD that do not exist on the real robot. Same arguments as classify().
export function removed(path, [x, y, z]) {
  const name = path[path.length - 1];
  // unattached roller adapter and screw floating next to the hood rack
  if (/^3D-Print Adapter/.test(name) && x > 300 && Math.abs(y - 87) < 3 && Math.abs(z - 504) < 3) return true;
  if (/9\/16" L BHCS/.test(name) && x > 300 && Math.abs(y - 67) < 3 && Math.abs(z - 483) < 3) return true;
  // zip tie sticking up through the back of the hopper roof
  if (/^Ziptie/.test(name) && inPath(path, /^Hopper Complete/)) return true;
  // loose pulley floating inside the shooter drum
  if (/^17t Custom HTD/.test(name) && Math.abs(x) < 20 && Math.abs(y - 278) < 3 && Math.abs(z - 443) < 3) return true;
  // stray bushing floating behind the intake pivot gearbox
  if (/Bronze Bushing/.test(name) && Math.abs(x - 227) < 3 && Math.abs(y + 232) < 3) return true;
  // +X camera and its mount
  return x > 200 && y > 280 && z > 340 && path.some((n) => /ThriftyCam|^Part 2-Mirrored$/.test(n));
}

// Parts whose CAD mate is wrong: swing the part about an X-parallel axis so that its
// centroid points from `pivot` toward `toward` ([y, z] in mm).
export const REPOSE = [
  // intake roller (38T) to first indexer roller (25T) belt
  { name: /^55T 5M 6mm Wide Belt$/, pivot: [-285.5, 193.5], toward: [-228.6, 195.1] },
];

// Parts to slide by [x, y, z] mm.
export const MOVE = [
  // pivot Kraken is mated 47 mm too deep: its face belongs on the MAXPlanetary input slice (x = 224)
  { test: (path) => inPath(path, /^Intake Static Assembly/) && inPath(path, /^Kraken X60/), by: [-47, 0, 0] },
];

// Dark tinted polycarbonate is lightened to at least this gray (CAD uses 0.25).
export const POLY_GRAY = 0.4;

// Assemblies that stay in one piece in the exploded view: [test, shared centre]
export const RIGID = [{ test: (path) => inPath(path, /^Orange Pi 5 Case/), centre: [-54, 235, 83] }];

// Unnamed parts to relocate, found by where they sit in the CAD: [from centre, to centre] in mm,
// turn = quarter turns about vertical.
// The two CANivores go side by side on top of the roboRIO (its top face is z = 120.9).
export const PLACE = [
  { from: [44.5, -29.7, 106.4], to: [-11, 217, 130.5], turn: 1 },
  { from: [-44.5, -29.7, 106.4], to: [-11, 269, 130.5], turn: 1 },
];

// Color overrides, sRGB 0..1. Anything not matched keeps its CAD color.
export function recolor(path) {
  const name = path[path.length - 1];
  if (/^Neely Flywheely/.test(name)) return [0.84, 0.69, 0.4]; // brass
  if (/^10-32 Rivnut|^MCM 92311A433/.test(name)) return [0.66, 0.67, 0.69]; // zinc-plated steel
  if (/^Battery Plate|^Gusset \d/.test(name)) return [0.75, 0.76, 0.78]; // bare aluminum
  if (/^LockingOpi5/.test(name)) return [0.06, 0.06, 0.065]; // Orange Pi case
  if (/^Mounting Plate$/.test(name) && inPath(path, /^Hopper Complete/)) return [0.72, 0.725, 0.73]; // hopper triangle plates
  if (/^Part 43$/.test(name)) return [0.25, 0.25, 0.25]; // hood bearing support, same as the other plates
  if (/^Part 11$/.test(name) && inPath(path, /^Intake Moving Assembly/)) return [0.13, 0.84, 0.3]; // printed motor mounts
}

export function classify(path, c) {
  const name = path[path.length - 1];
  const [x, y, z] = c;

  if (inPath(path, /ThriftyCam|Orange Pi|OrangePi|orange pi/i)) return 'vision';
  if (inPath(path, /Robot Radio|RSL|Power Distribution|Robot Battery|Main Breaker|Polulu|step-down|RIO Mount|id1989|id2024|id2066|id2492/i))
    return 'power';

  if (inPath(path, /^Bumpers/)) return 'bumpers';
  // the roller around the intake pivot is the first roller of the indexer
  if (inPath(path, /^Tube Roller System/) || /^55T 5M 6mm/.test(name) || (name === 'Part 3' && Math.abs(y + 286) < 3)) return 'indexer';
  if (inPath(path, /^Intake Master/)) return 'intake';
  if (inPath(path, /^Hopper Complete/)) return 'hopper';
  // the RIO, gyro and CAN devices come through the export without a name
  if (inPath(path, /^Drivebase/)) return name === '' ? 'power' : 'drive';

  if (inPath(path, /^Dynamic Shootdexer/)) return 'hood';
  if (inPath(path, /^Shootdexer/)) {
    // camera brackets
    if (/^Part 2(-Mirrored)?$/.test(name) && z > 340) return 'vision';
    // superstructure shared by indexer and shooter: never focused, only context
    if (/^(Left|Right) Plate$|^PolyCover$|^Tube 1"x1"|^Aluminum Tube Plug|^Nut Strip|MCM 92311A433|^Hopper Backing|poly Backing|^24\.625 in|^Part 5$|^Part 2$/.test(name))
      return 'frame';
    // hood pinion shaft with its gears and drive
    if (y < 110 && z > 380 && /Spur Gear|27\.094|36t Custom|Bronze Bushing|Shaft End/.test(name)) return 'hood';
    if (inPath(path, /Kraken X44/) || /143T|^12t Aluminum Pulley/.test(name)) return 'hood';
    // belt tying each pair of shooter Krakens together, and the pulley stack on the lower motor
    if (Math.abs(y - 307) < 3 && (/^51T 5M/.test(name) || Math.abs(z - 249) < 3)) return 'shooter';
    // feeder rollers + kicker wheels sit above the floor rollers but belong to the indexer
    if (/PolyCarbTube|SILICONE|^NB Plug|53T|51T|^18tDouble|Compliant Wheel|25\.654|30t Custom|32t Aluminum Spur|24t Aluminum Spur/.test(name)) return 'indexer';
    if (inPath(path, /Kraken/) && z < 200) return 'indexer';
    // camera-side tube bolts, radio and nut-strip hardware, hood hard stops
    if (/Rivet Nut|1\/2" L BHCS|9\/16" L BHCS|1-5\/8" L BHCS|^#10 Aluminum Spacer \(1\/4"/.test(name) && y > 300) return 'frame';
    if (Math.abs(y - 228) < 2 && Math.abs(z - 471) < 2) return 'frame';
    if (/1\.25" OD/.test(name)) return 'hood';
    // X44 hood motor hardware
    if (x > 300 && y > 260 && y < 300 && z > 175 && z < 212) return 'hood';
    // third standoff of the side-flywheel plate
    if (x < -330 && Math.abs(y - 270) < 2 && Math.abs(z - 227) < 2) return 'shooter';
    if (/^Little ?Spacer/.test(name)) return 'indexer';
    if (/^Washer/.test(name) && y < 110 && z > 380) return 'hood';
    if (name === '' && Math.abs(x) > 300) return 'frame'; // encoders
    // feeder roller ends, and the pulleys of its own motors
    if (/Stubroller|^0\.375" ID Bearing/.test(name) && z < 380) return 'indexer';
    if (z < 255 && /20t Custom|SplineXS Bore/.test(name)) return 'indexer';
    if (z < 235) return 'indexer';
    if (y < 130 && z < 335) return 'indexer';
    return 'shooter';
  }
  return 'frame';
}

// Moving parts. 1 = moves with the mechanism, 2 = turns on a second pivot, 3 = elastic,
// 4 = swerve turret, 5 = swerve wheel, 6 = the flywheel (moved as one piece by the viewer), 0 = fixed.
// Pivots and travel live in src/mechanism.js.
export function rig(path, sub, [x, y, z]) {
  const name = path[path.length - 1];
  if (/^Neely Flywheely/.test(name)) return 6;
  if (sub === 'drive') return /Turret Assembly/.test(name) ? 4 : /Molded Wheel/.test(name) ? 5 : 0;
  if (sub === 'intake') {
    if (inPath(path, /^Intake Moving Assembly/)) return 1;
    // 12T sprocket shaft that drives the pivot chains
    if (/12t Steel Sprocket|36t Aluminum Spur|^210-004|Clamping Shaft Collar/.test(name)) return 2;
  }
  if (sub === 'hopper') {
    if (inPath(path, /^Dynamic Hopper/)) return 1;
    if (/^Lock Elastic/.test(name)) return 3;
    // lock plate, its bolt stack and the screw that holds the elastic
    const at = (Y, Z) => Math.abs(y - Y) < 4 && Math.abs(z - Z) < 4;
    if (/^Lock Plate/.test(name) || at(-55.5, 250.5) || at(20.5, 252.5)) return 2;
    return 0;
  }
  if (sub === 'hood') {
    if (inPath(path, /^Dynamic Shootdexer/)) return 1;
    // pinion shaft
    if (Math.abs(y - 66) < 3 && Math.abs(z - 403) < 3 && !/Bushing/.test(name)) return 2;
  }
  return 0;
}

// Rollers that spin about their own axis while a subsystem runs: [axis y, axis z, direction].
// 1 / 2 = either direction, 3 = like 2 but at flywheel speed.
const SPINNERS = {
  intake: [[-584, 169.5, 1], [-575, 248.4, 1]],
  indexer: [[-286, 194, 2], [-228.5, 194.5, 2], [-169, 179, 2], [-110, 163, 2], [-51, 147, 2], [9, 131, 2], [70, 120.5, 2], [156.5, 137.5, 2], [225, 192, 2], [260, 272.5, 2], [255, 359.5, 2], [78.5, 304.5, 1]],
  shooter: [[278, 443, 2], [253, 321, 3]],
  hood: [[107, 547, 1], [146, 593, 1], [130, 567, 2]],
};
export function spin(path, sub, [x, y, z]) {
  const name = path[path.length - 1];
  if (/Plate|Kraken|ID Bearing|Belt$|Shoulder Bolt$|^Bearing Hat|^Neely Flywheely/.test(name)) return 0;
  return SPINNERS[sub]?.find(([Y, Z]) => Math.abs(y - Y) < 2.5 && Math.abs(z - Z) < 2.5)?.[2] || 0;
}

// Coarse surface finish, used to pick PBR parameters in the viewer.
export function finish(path) {
  if (/^Neely Flywheely/.test(path[path.length - 1])) return 'brass';
  return path.some((n) =>
    /Tube 2"|Tube 1"|Rounded Hex|ThunderHex|Shaft|Gear|Sprocket|Chain|BHCS|SHCS|FHCS|Screw|Bolt|Locknut|Hex Nut|Rivet|Rivnut|Washer|Bearing|Bushing|Collar|Alum|Gusset|Bellypan|Battery Plate|Intake Tube|Deadaxle|Kraken|Bent .*Bracket|Mounting Plate|Pulley|stud|Hub \(/i.test(n)
  ) ? 'metal' : 'matte';
}
