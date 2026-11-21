# Articulated acting and measured supports in Code 3D

The construction study exposed two gaps: people moved as rigid objects, and interior props used independent height constants. The runtime now provides fixed helpers for articulated people, planted-foot gait, real support surfaces, absolute-time transitions and a first camera obstruction check.

`createScene(THREE, canvas, width, height, tools)` receives the versioned helper object as its optional fifth argument. Existing four-argument scenes keep working. The helper source is shipped with the pinned local Three.js modules, imported only inside the opaque-origin sandbox and never evaluated on the account origin. CSP, source-window/origin/token checks, model billing behavior and fixed-frame export remain in place.

## Main helpers

- `registerSurface`, `surfaceTop`, `supportAt`: vertical ray queries against registered geometry, including holes and moved support meshes.
- `placeOnSurface`: aligns an object's actual world-space lower bounds to the measured surface, including under a transformed parent.
- `walkFeet`: derives support anchors and recovery arcs from distance traveled; supporting feet stay planted while the body advances.
- `createPerson`: a mesh rig with knees, elbows, feet, hands, head and facial details; explicit foot and hand targets use world coordinates.
- `solveTwoBone`: handles coincident targets, unreachable targets and a collinear bend pole; reports residual reach error.
- `cue` and `stagger`: evaluate from absolute time without storing a previous pose.
- `aimCamera`: chooses among directions by a ray test toward the specified target. Optional world-space head/foot/hand points are checked separately, after a native preview exposed a sign covering the head. Framing still needs image review. The study locks a direction per shot after review: switching sides for a brief obstruction caused visible jumps and was rejected by encoded-video QA.

The construction recipe uses measured slab tops, proper finished-floor heights, articulated visitors and furniture with legs, seats and backs. Cafe sets enter in a staggered movement rather than all appearing at one threshold. Major footprint changes still require reviewing the model's fixed interior layout.

## What was learned from the supplied examples

The user-provided crane HTML organizes eight problem/solution chapters, uses articulated workers, procedural materials, nested crane parts, mechanical close-ups and a second camera. These are reusable direction patterns.

Its automatic camera contains frame-to-frame smoothing, so directly copying that loop would make the pose depend on earlier frames. The adaptation evaluates cameras and poses at absolute timestamps. Its on-screen browser speech and Web Audio recorder are separate code paths; the uploaded recording is not proof of a complete exported narration track.

The supplied SVG/GSAP file is a partial update: omitted sections are represented by `existing code` comments and script boundaries are missing. It still shows useful ideas: named act modules, exact cue timings, staggered graphic entries and subtitle zones. Those patterns informed the cue helper and the study's editorial labels; no financial statistics were reused as verified facts.

No uploaded HTML, source recording, speech or brand assets are embedded in this repository. No Three.js/GSAP version swap or network access is required.

## Review scene and limits

An explicit studio button opens an original 12-second lobby scene: a worker looks toward an escalator, walks, stops and reaches its handrail. A second viewport then shows the upper-floor connection. It is a manually directed motion test, not an autonomous Gemini generation. The native encoder outputs silent pictures; any sound mix is an explicit finishing step.

Unit checks cover support holes, transformed props, reach limits, planted feet, world-space actor contacts, camera obstruction and replay. The walking camera is offset outside the moving escalator mechanism: a centered following camera passed through the steps, hiding the feet despite a clear ray to the body. Native review must still verify silhouettes, foot/hand placement, unobstructed cameras, viewport labels and image continuity before the larger export. The helpers do not provide general navigation, a physics engine or a universal building generator.
