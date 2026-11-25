# Re-Entropy interactive viewer

A 3D showcase of the Re-Entropy FRC robot: orbit it, isolate subsystems, explode it, and watch the intake and hood move.

## Run it

```
npm install
npm run dev
```

Pushing to `main` builds and publishes the site to GitHub Pages.

## Edit it

| To change | Edit |
|---|---|
| Subsystem text, specs, camera angles, explode distances | `src/content.js` |
| Title and tagline | `index.html` |
| Intake and hood motion | `src/mechanism.js` |
| Part grouping, colors, deleted or moved parts | `tools/subsystems.mjs`, then rebuild the model |

## Rebuild the model

The raw Onshape export is not in this repository. Put it in the project root as `Kentropy Main.glb`, then:

```
npm run model
```

This writes `public/model/robot.glb`. Commit that file to publish the change.
