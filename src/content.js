// Everything editable about the points of interest.
//   id      subsystem id, matches tools/subsystems.mjs
//   dir     [azimuth, elevation] in degrees the camera looks from (0 = robot front, 90 = its +X side)
//   anchor  optional [x, y, z] in metres for the hotspot (Y up, +Z = front); defaults to subsystem centre
//   zoom    optional, >1 moves closer
export const ROBOT = { name: 'Re-Entropy', lede: 'Explore subsystems. Isolate assemblies. See the full robot.' };

// Exploded view. shift moves a whole subsystem, spread pulls its parts apart from its centre
// (0.5 = half again as far out). Both are [x, y, z] in metres / factors: Y up, +Z = robot front.
export const EXPLODE = {
  frame: { shift: [0, 0, 0], spread: [0.25, 0, 0.1] },
  intake: { shift: [0, 0.12, 0.6], spread: [0.45, 0.2, 0.3] },
  hopper: { shift: [0, 0.6, 0.35], spread: [0.4, 0.4, 0.2] },
  indexer: { shift: [0, 0.22, 0.12], spread: [0.5, 0.5, 0.45] },
  shooter: { shift: [0, 0.4, -0.42], spread: [0.6, 0.35, 0.35] },
  hood: { shift: [0, 0.85, -0.3], spread: [0.5, 0.4, 0.3] },
  drive: { shift: [0, -0.32, 0], spread: [0.55, 0.6, 0.55] },
  vision: { shift: [0, 0.3, -0.85], spread: [0.3, 0.6, 0.6] },
  power: { shift: [0, -0.05, -0.75], spread: [0.4, 0.8, 0.5] },
  bumpers: { shift: [0, -0.6, 0], spread: [0.8, 0.3, 0.3] },
};

export const SUBSYSTEMS = [
  {
    id: 'intake', title: 'Over-Bumper Intake', label: ['Over-bumper', 'intake'], dir: [38, 20], anchor: [0, 0.17, 0.585],
    text: 'A tube roller intake designed for maximum durability and throughput. A robust crash bar at the front takes the force of collisions, and two 1/4 in thick polycarbonate plates absorb that force rather than just transmitting it. Aluminum “wrist” plates attach to the pivot sprocket, so the entire intake can come off by removing 12 bolts, allowing for fast swaps in case of damage.',
    specs: [['Roller drive', '2× Kraken X60'], ['Pivot drive', 'Kraken X60, MAXPlanetary 5:1 × 5:1'], ['Final stage', '#25 chain, 12T to 36T']],
  },
  {
    id: 'hopper', title: 'Hopper', label: ['Hopper'], dir: [-42, 30], anchor: [-0.347, 0.42, 0.35],
    text: 'The polycarbonate hopper is designed to minimize weight while maximizing rigidity. Its chamfered front edge allows our intake to pull upward while shooting, forcing balls through our indexer and giving consistent feeding through our entire 55-ball capacity. To prevent the hopper from moving back in, a lock mechanism on each side uses an elastic pivot to slide a bolt into a slot once the hopper is fully extended. Bent aluminum brackets hold the polycarbonate panels together. A CANrange near the top of the hopper tells the intake when to actuate and compress the hopper.',
    specs: [['Capacity', '55 balls'], ['Panels', 'Polycarbonate on bent aluminum brackets'], ['Extension', '12 in'], ['Lock', 'Elastic-pivot bolt on each side']],
  },
  {
    id: 'indexer', title: 'Roller Floor Indexer', label: ['Roller floor', 'indexer'], dir: [28, 40], anchor: [0, 0.165, 0.12],
    text: 'The roller floor indexer sits at a 15-degree angle and is belted together using a stub roller system, which allows for quick replacement of each roller. The kicker roller uses compliant wheels to grab each ball directly while it is still in the hopper and push it all the way into the shooter while maintaining a firm grip. It is geared to have the same tangential speed under compression as the indexer floor, keeping wear low and throughput high. A CANrange right under the main drum allows up to 8 extra balls to be stored inside the indexer leading up to the shooter.',
    specs: [['Drive', '4× Kraken X60'], ['Rollers', 'Silicone over polycarbonate tube'], ['Kicker', '10× 2.25 in compliant wheels']],
  },
  {
    id: 'shooter', title: 'Flywheel Shooter', label: ['Flywheel', 'shooter'], dir: [-150, 22], anchor: [0.02, 0.443, -0.278],
    text: 'The shooter is a 4-inch-diameter aluminum drum covered with grip tape to ensure the fuel is accelerated instantly. The flywheel has a rotational inertia of 7 lb·in² and is geared up at about 4:1 from the drum to maximize rotational energy.',
    specs: [['Drive', '4× Kraken X60'], ['Reduction', '20T to 30T, HTD 5 mm'], ['Flywheel', 'Geared up 61T to 15T']],
  },
  {
    id: 'hood', title: 'Adjustable Hood', label: ['Adjustable', 'hood'], dir: [142, 30], anchor: [0, 0.593, -0.146],
    text: 'The hood actuates to a variety of angles, allowing for accurate shots at any distance without excessively changing our shooter RPM. The hood rollers are also aluminum tubes covered with grip tape, and are geared to have the same surface speed as the main drum.',
    specs: [['Drive', 'Kraken X44'], ['First stage', '12T to 36T, 143T belt'], ['Output', '10T pinions on twin hood plates']],
  },
  {
    id: 'drive', title: 'Swerve Drivetrain', label: ['Swerve', 'drivetrain'], dir: [38, 32], anchor: [0.276, 0.09, 0.276],
    text: 'Four independently steered modules on a 2 × 1 tube frame, braced by corner gussets.',
    specs: [['Modules', '4× SDS MK5n'], ['Drive', '4× Kraken X60'], ['Steer', '4× Kraken X44']],
  },
  {
    id: 'vision', title: 'Vision System', label: ['Vision', 'system'], dir: [-158, 22], anchor: [-0.242, 0.38, -0.336],
    text: 'A wide-angle camera paired with an onboard coprocessor.',
    specs: [['Camera', 'ThriftyCam, 80° lens'], ['Coprocessor', 'Orange Pi 5'], ['Cooling', '40 mm fan']],
  },
  {
    id: 'power', title: 'Power & Control', label: ['Power &', 'control'], dir: [160, 34], anchor: [-0.066, 0.236, -0.32],
    text: 'Battery, breaker, power distribution and radio, packaged low around the bellypan.',
    specs: [['Distribution', 'REV PDH'], ['Main breaker', '120 A'], ['Radio', 'VH-109']],
  },
  {
    id: 'bumpers', title: 'Bumpers & Armor', label: ['Bumpers', '& armor'], dir: [-35, 24], anchor: [-0.43, 0.095, 0.1],
    text: 'A two-piece bumper wraps the frame, with side panels that protect the belts, gears, and pulleys of the shooter and indexer.',
    specs: [['Footprint', '33.9 × 33.9 in'], ['Construction', 'Foam on wood backing'], ['Armor', 'Polycarb side panels bolted to aluminum brackets']],
  },
];
