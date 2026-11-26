// Entropy: the main season robot. Same layout as re-entropy.js; see the notes at the top of that file.
// Text and specs from the 2026 tech binder, checked against the CAD.
// Hotspots without an anchor sit at the centre of their subsystem. Pivots, clips and fuel runs: entropy-mech.js.
import * as kit from './entropy-mech.js';

export const ROBOT = {
  id: 'entropy', name: 'Entropy', role: 'Main season robot', model: 'entropy.glb',
  home: [41, 25], // from the front: Entropy intakes and shoots over the same side
  animated: ['intake', 'hopper', 'hood', 'drive'], runs: true, mechanisms: true, egg: false, crash: true, cone: true, kit,
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
};

export const SUBSYSTEMS = [
  {
    id: 'intake', title: 'Over-Bumper Intake', label: ['Over-bumper', 'intake'], dir: [38, 20], anchor: [0.055, 0.188, 0.591],
    text: 'Built to survive high-speed collisions with other robots. The intake mounts on 1/4 in aluminum plates for a stable base, and its two 1/4 in polycarbonate side plates are strong but flexible enough to absorb hits. Flexible 4 in compliant wheels replaced the original star wheels, which pushed balls away and tore off their hubs. A hex-stock kicker bar sets the compression, and a secondary shaft with 2 in compliant wheels pushes balls up over the bumper. One motor drives the pivot on both sides through a long axle to prevent misalignment, the intake rests on the bumpers to cushion impacts, and it comes off with two bolts so an identical spare can be swapped in.',
    specs: [['Roller drive', '2× Kraken X60'], ['Wheels', '4 in compliant, 2 in on the secondary shaft'], ['Pivot drive', 'Kraken X60, both sides through one axle'], ['Plates', '1/4 in polycarbonate on 1/4 in aluminum mounts'], ['Removal', '2 bolts']],
  },
  {
    id: 'hopper', title: 'Extending Hopper', label: ['Extending', 'hopper'], dir: [-42, 30], anchor: [0, 0.48, 0.3],
    text: 'The hopper is made of lightened 1/4 in polycarbonate panels, balancing weight and flexibility. They slide in and out on 10-32 shoulder bolts, with fender washers on the inside that keep the panels from popping off their rails. Cams on the intake push the hopper out and hold it there whenever the intake is down.',
    specs: [['Panels', 'Lightened 1/4 in polycarbonate'], ['Rails', '10-32 shoulder bolts with fender washers'], ['Extension', 'Pushed out by cams on the intake']],
  },
  {
    id: 'indexer', title: 'Indexer and Kicker Rollers', label: ['Indexer &', 'kicker rollers'], dir: [28, 40],
    text: 'The hopper floor fits into the drivebase around the swerve modules and shooter, as large as it can be without interfering with other subsystems, and into the gaps left by the intake. Inspired by FRC 254’s 2017 robot, it drives five tube rollers off one belted Kraken X44: 3D printed live-axle hubs with integrated pulleys, polycarbonate tubes for low weight, and silicone tubing for grip. Solid wheels on the outside fill the small gaps. At the back, an integrated kicker driven by two more Kraken X44s feeds the drum; the second one was added later for an extra external kicker wheel, which raised the feed rate and prevents jams.',
    specs: [['Floor drive', 'Kraken X44, belted'], ['Rollers', '5 polycarbonate tubes with silicone tubing'], ['Kicker', '2× Kraken X44'], ['Inspiration', 'FRC 254, 2017']],
  },
  {
    id: 'shooter', title: 'Drum Shooter', label: ['Drum', 'shooter'], dir: [30, 22], anchor: [0, 0.451, -0.083],
    text: 'Entropy started the season with a dual shooter and switched to a drum, powered by two Kraken X60s for long-range shots and very high throughput. It shoots over the hopper for better packaging, and is built as its own module that bolts onto the drivebase for fast assembly, repair and changes. The main wheels are solid urethane. The custom flywheels come in two parts: a tapped hub machined in house from 1/4 in 6061 aluminum, held to tight tolerances so the hex shaft doesn’t round out under heavy torque, and a 1/2 in mild steel rim cut by SendCutSend to maximize moment of inertia. 3D printed ramps can be swapped in the pits.',
    specs: [['Drive', '2× Kraken X60'], ['Wheels', 'Solid urethane'], ['Flywheels', '1/4 in 6061 hub, 1/2 in steel rim'], ['Mounting', 'Separate module on the drivebase']],
  },
  {
    id: 'hood', title: 'Adjustable Hood', label: ['Adjustable', 'hood'], dir: [-38, 30], anchor: [0, 0.488, -0.28],
    text: 'The 3D printed aiming system sets the shot anywhere from 20 to 45 degrees of elevation through a sector gear on the hood. Its herringbone gears add lateral stability and strength, and run on bushings instead of bearings to save weight and space. Backspin rollers made of 2 in sushi rollers, driven by a custom gearbox on the moving part of the hood, transfer more force in the short contact time and squeeze each ball 0.9 in at release.',
    specs: [['Elevation', '20° to 45°'], ['Drive', 'Kraken X44 to a hood-mounted sector gear'], ['Gears', '3D printed herringbone on bushings'], ['Backspin', '2 in sushi rollers, 0.9 in compression']],
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
    text: 'The bumpers mount on 1/4-20 rivnuts for very rigid mounting. A slot in the bumper was designed to grip the Tower upright for a more reliable climb, but the climber has since been removed to prioritize fuel throughput.',
    specs: [['Footprint', '33.5 × 33.5 in'], ['Mounting', '1/4-20 rivnuts'], ['Construction', 'Foam on wood backing']],
  },
];
