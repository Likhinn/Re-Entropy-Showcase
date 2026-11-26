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
