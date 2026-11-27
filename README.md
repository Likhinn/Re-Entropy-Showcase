# Re-Entropy interactive viewer

A 3D showcase of the Re-Entropy FRC robot: orbit it, isolate subsystems, explode it, and watch the intake and hood move.
Made for the 1002 2026 Off-season robot, Re-Entropy.

## Two robots

The landing page lets visitors pick between **Re-Entropy** (off-season competition robot) and **Entropy** (main season robot). Each robot has its own page, `?robot=entropy` for Entropy.

- Text, specs and camera angles: `src/robots/re-entropy.js` and `src/robots/entropy.js`.
- Models: put the Onshape export in the project folder, then build it:
  - `npm run model` builds `Kentropy Main.glb` into `public/model/robot.glb` (Re-Entropy).
  - `npm run model -- entropy` builds `Entropy.glb` into `public/model/entropy.glb`.
  - Add a path to build from a different file, e.g. `npm run model -- entropy "My Export.glb"`.
- A robot whose model hasn't been built yet shows as "coming soon" on the landing page.

### Entropy's events

In the interactive view, Entropy has a timeline of its competitions: Dalton, Albany, DCMP and Worlds. Worlds (the Championship robot) is shown by default; `?event=albany` opens another one. Clicking an event swaps the robot in place. A point on the line before an event shows what was changed for it: every change is highlighted, and clicking a highlighted part tells that change.

- Each event has its own CAD export, built into its own model:
  - `npm run model -- entropy-dalton` builds `Dalton boty.glb` into `public/model/entropy-dalton.glb`.
  - `npm run model -- entropy-albany` builds `Albany Bot.glb` into `public/model/entropy-albany.glb`.
  - `npm run model -- entropy` builds `Entropy.glb` (Worlds) into `public/model/entropy.glb`.
- Every event is built with Albany's hopper in place of its own. Albany also gets Dalton's battery, and Dalton gets Albany's ThriftyCam (`BORROW` in `tools/build-model.mjs`), so all three exports must be in the project folder.
- After building, run `node tools/changes.mjs`. It compares the events part by part and writes `public/model/entropy-changes.json`, which drives the highlight.
- The events, each one's own subsystem text, and its changes are in `EVENTS` at the bottom of `src/robots/entropy.js`.
- To add DCMP: add its export and a `ROBOTS` entry in `tools/build-model.mjs` (with `ALIGN` set if the CAD faces the other way, like Dalton and Albany), give its `EVENTS` entry a `model`, add it to `EVENTS` in `tools/changes.mjs`, then rebuild and rerun `tools/changes.mjs`.
- Only the Worlds robot is rigged: on the earlier ones only the swerve modules move.
