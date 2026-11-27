// Entropy: the main season robot. Same layout as re-entropy.js; see the notes at the top of that file.
// Text and specs from the 2026 tech binder, checked against the CAD.
// Hotspots without an anchor sit at the centre of their subsystem. Pivots, clips and fuel runs: entropy-mech.js.
import * as kit from './entropy-mech.js';

export const ROBOT = {
  id: 'entropy', name: 'Entropy', role: 'Main season robot', model: 'entropy.glb',
  home: [41, 25], // from the front: Entropy intakes and shoots over the same side
  animated: ['intake', 'hopper', 'hood', 'drive'], runs: true, mechanisms: true, egg: false, crash: true, cone: true, kit,
  changes: 'entropy-changes.json', // what differs between its events (tools/changes.mjs)
  stillSpots: true, // hotspots stay put while a subsystem actuates (they sit where the parts rest)
};

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
  climber: { shift: [0.6, 0.3, -0.1], spread: [0.3, 0.6, 0.4] },
};

export const SUBSYSTEMS = [
  {
    id: 'intake', title: 'Over-Bumper Intake', label: ['Over-bumper', 'intake'], dir: [38, 20], anchor: [0.055, 0.188, 0.591],
    text: 'Built to survive high-speed collisions with other robots. The intake mounts on 1/4 in aluminum plates for a stable base, and its two 1/4 in polycarbonate side plates are strong but flexible enough to absorb hits. Flexible 4 in compliant wheels grab every ball cleanly, and a hex-stock kicker bar sets the compression. One motor drives the pivot on both sides through a long axle to prevent misalignment, the intake rests on the bumpers to cushion impacts, and it comes off with two bolts so an identical spare can be swapped in.',
    specs: [['Roller drive', '2× Kraken X60'], ['Wheels', '4 in compliant, 2 in on the secondary shaft'], ['Pivot drive', 'Kraken X60, both sides through one axle'], ['Plates', '1/4 in polycarbonate on 1/4 in aluminum mounts'], ['Removal', '2 bolts']],
  },
  {
    id: 'hopper', title: 'Extending Hopper', label: ['Extending', 'hopper'], dir: [-42, 30], anchor: [0, 0.48, 0.3],
    text: 'The hopper is made of lightened 1/4 in polycarbonate panels, balancing weight and flexibility. They slide in and out on 10-32 shoulder bolts, with fender washers on the inside that keep the panels from popping off their rails. Cams on the intake push the hopper out and hold it there whenever the intake is down.',
    specs: [['Panels', 'Lightened 1/4 in polycarbonate'], ['Rails', '10-32 shoulder bolts with fender washers'], ['Extension', 'Pushed out by cams on the intake']],
  },
  {
    id: 'indexer', title: 'Indexer and Kicker Rollers', label: ['Indexer &', 'kicker rollers'], dir: [28, 40],
    text: 'The hopper floor fits into the drivebase around the swerve modules and shooter, as large as it can be without interfering with other subsystems, and into the gaps left by the intake. Inspired by FRC 254’s 2017 robot, it drives five tube rollers off one belted Kraken X44: 3D printed live-axle hubs with integrated pulleys, polycarbonate tubes for low weight, and silicone tubing for grip. Solid wheels on the outside fill the small gaps. At the back, an integrated kicker and an external kicker wheel, driven by two more Kraken X44s, feed the drum at a high rate without jams.',
    specs: [['Floor drive', 'Kraken X44, belted'], ['Rollers', '5 polycarbonate tubes with silicone tubing'], ['Kicker', '2× Kraken X44'], ['Inspiration', 'FRC 254, 2017']],
  },
  {
    id: 'shooter', title: 'Drum Shooter', label: ['Drum', 'shooter'], dir: [30, 22], anchor: [0, 0.451, -0.083],
    text: 'A full-width drum, powered by two Kraken X60s, delivers long-range shots at very high throughput. It shoots over the hopper for better packaging, and is built as its own module that bolts onto the drivebase for fast assembly, repair and changes. The main wheels are solid urethane. The custom flywheels come in two parts: a tapped hub machined in house from 1/4 in 6061 aluminum, held to tight tolerances so the hex shaft doesn’t round out under heavy torque, and a 1/2 in mild steel rim cut by SendCutSend to maximize moment of inertia. 3D printed ramps can be swapped in the pits.',
    specs: [['Drive', '2× Kraken X60'], ['Wheels', 'Solid urethane'], ['Flywheels', '1/4 in 6061 hub, 1/2 in steel rim'], ['Mounting', 'Separate module on the drivebase']],
  },
  {
    id: 'hood', title: 'Adjustable Hood', label: ['Adjustable', 'hood'], dir: [-38, 30], anchor: [0, 0.488, -0.28],
    text: 'The 3D printed aiming system sets the shot anywhere from 20 to 45 degrees of elevation through a sector gear on the hood. Its herringbone gears add lateral stability and strength, and run on bushings instead of bearings to save weight and space. Backspin rollers made of 2 in stealth wheels, driven by a custom gearbox on the moving part of the hood, transfer more force in the short contact time and squeeze each ball 0.9 in at release.',
    specs: [['Elevation', '20° to 45°'], ['Drive', 'Kraken X44 to a hood-mounted sector gear'], ['Gears', '3D printed herringbone on bushings'], ['Backspin', '2 in stealth wheels, 0.9 in compression']],
  },
  {
    id: 'drive', title: 'Swerve Drivetrain', label: ['Swerve', 'drivetrain'], dir: [38, 15], anchor: [0.277, 0.1, -0.277],
    text: 'The drivebase ties the swerve modules and electronics together and carries the intake, shooter and indexer. It is built to be fast and maneuverable, and tough enough for a season of high-speed collisions, drops and jumps. SDS MK4i modules in the L2 ratio use Kraken X60s for both drive and steering, on TTB molded plastic tread whose spikes grip the carpet without damaging it, for better torque transfer.',
    specs: [['Modules', '4× SDS MK4i, L2'], ['Motors', '8× Kraken X60'], ['Tread', 'TTB molded plastic']],
  },
  {
    id: 'vision', title: 'Vision System', label: ['Vision', 'system'], dir: [-112, 16], anchor: [0, 0.524, -0.005],
    text: 'Two cameras running PhotonVision localize the robot anywhere on the field. Vision drives automatic hub alignment, and the robot switches between aiming at the hub and aiming to pass based on where it is. Shooter RPM and hood angle come from interpolated lookup tables, and a time-of-flight calculation lets it shoot while moving, all from one button.',
    specs: [['Cameras', 'ThriftyCam front, ELP USB rear'], ['Software', 'PhotonVision'], ['Coprocessor', 'Orange Pi 5'], ['Autonomous', 'Choreo path following']],
  },
  {
    id: 'power', title: 'Power & Control', label: ['Power &', 'control'], dir: [160, 34],
    text: 'Every motor is a Kraken, so there are no separate motor controllers. The electronics mount under the base plate in a “brain pan”, each device in its own compartment, behind a 1/8 in polycarbonate cover split into segments with finger holes so any one can come off on the cart. Wires are color-coded by subsystem, with heat-shrink labels at the Mini Power Module. The battery sits in a 3D printed tray with a polycarbonate failsafe that keeps it in and protects the electronics from leaks, and batteries are picked by internal resistance and tracked with a battery analyzer.',
    specs: [['Distribution', 'REV PDH'], ['Main breaker', '120 A'], ['Motor control', 'Built into every Kraken'], ['Battery', 'Printed tray, polycarbonate failsafe']],
  },
  {
    id: 'bumpers', title: 'Bumpers', label: ['Bumpers'], dir: [35, 24], anchor: [0.43, 0.1, -0.12],
    text: 'The bumpers mount on 1/4-20 rivnuts for very rigid mounting, so they stay put through a full season of hard hits.',
    specs: [['Footprint', '33.5 × 33.5 in'], ['Mounting', '1/4-20 rivnuts'], ['Construction', 'Foam on wood backing']],
  },
];

// ---- events ------------------------------------------------------------------------------
// One CAD per competition, oldest first. Each is built into its own model (npm run model -- entropy-<id>,
// then tools/changes.mjs for what differs between them), all with Albany's hopper. CURRENT is the robot
// as it stands, shown by default. Each event has its own text for every subsystem; SUBSYSTEMS above is
// Worlds'. changes: what was done since the event before, shown together from one point on the timeline:
// each picks out the parts it touched (subs, and a part-name pattern) on the robot after it; on: 'before'
// marks something taken off, which is only told.
// The earlier robots aren't rigged: only their swerve modules move.
export const CURRENT = 'worlds';

const EARLY = { animated: ['drive'], runs: false, mechanisms: false, cone: false };
// a subsystem list in Worlds' layout (titles, hotspots, camera angles) with this event's own words
const words = (by, add = []) => () => [...SUBSYSTEMS.map((s) => ({ ...s, ...by[s.id] })), ...add];

export const EVENTS = [
  {
    id: 'dalton', name: 'Dalton', model: 'entropy-dalton.glb', robot: EARLY,
    subsystems: words({
      intake: {
        anchor: [-0.038, 0.188, 0.591],
        text: 'The intake reaches over the bumper with a full-width row of 4 in compliant star wheels, backed by a secondary shaft of 2 in Thrifty squish wheels that lifts balls up and over. It sits between 1/4 in polycarbonate side plates on 1/4 in aluminum mounts, with a Kraken X60 on the rollers and another driving the pivot on both sides through a single axle, so both sides always move together.',
        specs: [['Roller drive', 'Kraken X60'], ['Wheels', '4 in compliant stars, 2 in squish wheels'], ['Pivot drive', 'Kraken X60, both sides through one axle'], ['Plates', '1/4 in polycarbonate on 1/4 in aluminum mounts']],
      },
      hopper: {
        text: 'Lightened 1/4 in polycarbonate panels that slide in and out on 10-32 shoulder bolts, with fender washers inside to keep them on their rails. Cams on the intake push the hopper out whenever the intake is down.',
        specs: [['Panels', 'Lightened 1/4 in polycarbonate'], ['Rails', '10-32 shoulder bolts with fender washers']],
      },
      indexer: {
        text: 'Five tube rollers on live-axle hubs carry balls across the hopper floor, driven together off one belted Kraken X44, with 2 in vectored intake wheels steering balls in toward the middle. At the back, a kicker of 2 in flex wheels on two shafts feeds the shooter.',
        specs: [['Floor drive', 'Kraken X44, belted'], ['Floor wheels', '2 in vectored intake wheels'], ['Kicker', 'Kraken X44, 2 in flex wheels on 2 shafts']],
      },
      shooter: {
        title: 'Dual Shooter', label: ['Dual', 'shooter'],
        text: 'A dual shooter: two pairs of 4 in solid rubber wheels on one axle, one pair on each side, each backed by its own flywheel for consistent shots. Two Kraken X60s spin the axle. It shoots over the hopper and is built as its own module that bolts onto the drivebase for fast service.',
        specs: [['Drive', '2× Kraken X60'], ['Wheels', '4× 4 in solid rubber, two pairs'], ['Flywheels', '2'], ['Mounting', 'Separate module on the drivebase']],
      },
      hood: {
        anchor: [0, 0.575, -0.241],
        text: 'A hood over the shooter carries two shafts of 2 in stealth wheels that put a controlled backspin on every shot, driven by a Kraken X44.',
        specs: [['Drive', 'Kraken X44'], ['Backspin', '2 shafts of 2 in stealth wheels']],
      },
      drive: {
        text: 'SDS MK4i swerve modules in the four corners, with Kraken X60s for both drive and steering, make Entropy quick and agile in every direction.',
        specs: [['Modules', '4× SDS MK4i, L2'], ['Motors', '8× Kraken X60']],
      },
      vision: {
        anchor: [-0.259, 0.507, -0.096],
        text: 'A ThriftyCam on a printed mount beside the shooter localizes the robot on the field with PhotonVision AprilTag tracking.',
        specs: [['Cameras', 'ThriftyCam'], ['Software', 'PhotonVision']],
      },
      power: {
        text: 'A REV PDH and the 120 A main breaker sit in the belly pan, with the battery in a printed containment tray at the back. Every motor is a Kraken, so there are no separate motor controllers.',
        specs: [['Distribution', 'REV PDH'], ['Main breaker', '120 A'], ['Battery', 'Printed containment tray']],
      },
      bumpers: {
        text: 'The bumpers mount on 1/4-20 rivnuts for very rigid mounting. A slot in the bumper grips the Tower upright while the climber pulls the robot up.',
        specs: [['Footprint', '33.5 × 33.5 in'], ['Mounting', '1/4-20 rivnuts'], ['Climb', 'Slot grips the Tower upright']],
      },
    }, [{
      id: 'climber', title: 'Climber', label: ['Climber'], dir: [70, 18], anchor: [0.292, 0.35, -0.102],
      text: 'A two-stage AndyMark Climber in a Box beside the shooter: a telescoping tube topped with a three-plate hook, pulled down by a winch spool. A Kraken X44 drives the spool through a 25:1 MAXPlanetary and a 90 degree gearbox.',
      specs: [['Mechanism', 'AndyMark Climber in a Box, 2 stage'], ['Drive', 'Kraken X44'], ['Gearing', '25:1 MAXPlanetary, 90° gearbox'], ['Spool', 'Winch spool for 2 in tube']],
    }]),
  },
  {
    id: 'albany', name: 'Albany', model: 'entropy-albany.glb', robot: EARLY,
    subsystems: words({
      intake: {
        anchor: [0.003, 0.188, 0.591],
        text: 'Flexible 4 in compliant wheels grab balls cleanly across the full width, with softer 35A wheels at the ends, and a secondary shaft of 2 in compliant wheels pushes balls up over the bumper. Two Kraken X60s drive the rollers, one from each side, and a third drives the pivot on both sides through a long axle.',
        specs: [['Roller drive', '2× Kraken X60'], ['Wheels', '4 in compliant, 2 in compliant on the secondary shaft'], ['Pivot drive', 'Kraken X60, both sides through one axle'], ['Plates', '1/4 in polycarbonate on 1/4 in aluminum mounts']],
      },
      hopper: {
        text: 'Lightened 1/4 in polycarbonate panels balance weight and flexibility, sliding in and out on 10-32 shoulder bolts with fender washers inside so they can’t pop off their rails. Cams on the intake push the hopper out and hold it there whenever the intake is down.',
        specs: [['Panels', 'Lightened 1/4 in polycarbonate'], ['Rails', '10-32 shoulder bolts with fender washers'], ['Extension', 'Pushed out by cams on the intake']],
      },
      indexer: {
        text: 'Inspired by FRC 254’s 2017 robot, five tube rollers carry balls across the floor off one belted Kraken X44: printed live-axle hubs with integrated pulleys, polycarbonate tubes, and silicone tubing for grip. 2 in stealth wheels keep balls moving toward the middle. A kicker of 2 in flex wheels on two shafts feeds the drum.',
        specs: [['Floor drive', 'Kraken X44, belted'], ['Floor wheels', '2 in stealth wheels'], ['Kicker', 'Kraken X44, 2 in flex wheels on 2 shafts']],
      },
      shooter: {
        text: 'A full-width drum: six 4 in solid rubber wheels across one axle, spun by two Kraken X60s, for long shots and very high throughput. It shoots over the hopper and bolts onto the drivebase as its own module for fast service.',
        specs: [['Drive', '2× Kraken X60'], ['Wheels', '6× 4 in solid rubber'], ['Mounting', 'Separate module on the drivebase']],
      },
      hood: {
        text: 'The hood wraps the drum and swings about its axle on a printed sector gear, driven by a Kraken X44. Two shafts of 2 in stealth wheels put backspin on each ball as it leaves.',
        specs: [['Drive', 'Kraken X44 to a sector gear'], ['Pivot', 'The drum axle'], ['Backspin', '2 shafts of 2 in stealth wheels']],
      },
      drive: {
        text: 'SDS MK4i swerve modules in the L2 ratio, with Kraken X60s for both drive and steering, built to take a season of hits, drops and jumps.',
        specs: [['Modules', '4× SDS MK4i, L2'], ['Motors', '8× Kraken X60']],
      },
      vision: {
        anchor: [-0.258, 0.519, -0.07],
        text: 'A ThriftyCam on a printed mount beside the shooter localizes the robot with PhotonVision, for aligning to the hub.',
        specs: [['Cameras', 'ThriftyCam, beside the shooter'], ['Software', 'PhotonVision']],
      },
      power: {
        text: 'A REV PDH and the 120 A main breaker in the belly pan, the battery in a printed containment tray at the back, and a robot signal light up top. Every motor is a Kraken, so there are no separate motor controllers.',
        specs: [['Distribution', 'REV PDH'], ['Main breaker', '120 A'], ['Battery', 'Printed containment tray'], ['Status', 'Robot signal light']],
      },
      bumpers: {
        text: 'The bumpers mount on 1/4-20 rivnuts for very rigid mounting, so they stay put through hard hits.',
        specs: [['Footprint', '33.5 × 33.5 in'], ['Mounting', '1/4-20 rivnuts']],
      },
    }),
    changes: [
      { text: 'The climber came off, to make room for more fuel throughput.', subs: ['climber'], on: 'before' },
      { text: 'The dual shooter became a full-width drum of six 4 in solid wheels.', subs: ['shooter'], name: /Rubber|Wheel_Core|Solid/i },
      { text: 'A new hood wraps the drum and swings about its axle.', subs: ['hood'] },
      { text: 'Compliant wheels replaced the intake’s star wheels, which pushed balls away and tore off their hubs.', subs: ['intake'] },
      { text: 'The hopper floor’s vectored wheels became 2 in stealth wheels.', subs: ['indexer'] },
    ],
  },
  { id: 'dcmp', name: 'DCMP', model: null },
  {
    id: 'worlds', name: 'Worlds', model: 'entropy.glb', label: 'Championship',
  },
];
