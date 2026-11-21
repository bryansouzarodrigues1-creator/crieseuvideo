# Construction explainers: reusable direction

This is a manually directed study of a user-supplied vertical construction explainer. It is not evidence of an autonomous Gemini generation. No source video frames, voice, brand assets or advertising are included in this repository.

The reference lasts about 134.29 seconds at 1080×1920, 30 fps. It starts with the finished building, resets to a drawing, reveals foundations, assembles structure, closes the facade, then explains services, finishes and parking. The same footprint persists across every cut. Short captions, anchored labels and a running illustrative counter explain what is currently visible.

## What is reusable in the engine

- `constructionPlan.ts` validates area, floors, footprint, stage intervals, shots, illustrative cost keyframes, edit mapping and clip boundaries.
- `construction.ts` compiles that plan and the original procedural runtime into an isolated `createScene` program. The studio opens the recipe only after an explicit button click; importing, replaying and exporting make no model calls.
- The persistent model includes pile groups, pile caps, columns, beams, floor slabs, partitions, facade fins, a glazed entrance, skylights, services, escalators, simple interiors, cinema seating, parking, cars and trees.
- Assembly is derived from absolute time. Beams wait for their supporting columns. Soil transparency reveals the existing piles; interior shots hide the outer skin and roof instead of loading a second scene.
- Wide shots establish the work area, closer shots explain the active component, and a later wide shot shows the result. Cost amounts are input data, not an engineering estimate produced by the model.
- Explicit HD export uses 720×1280 at 30 fps; the existing default remains 432×768 at 24 fps. The opaque-origin sandbox, CSP and native encoder remain the same.
- The Gemini scene prompt now asks for persistent layered objects, dependency order, piece-by-piece assembly, cuts that explain the current action, and input-grounded counters.

## Validation

The fixture is rebuilt with `node --import tsx scripts/build-construction-study.ts` locally or `bun scripts/build-construction-study.ts`. Browser proof uses the actual `/motor-3d/codigo` recipe button, imports the original program, checks replay and exports with the real studio button. First review a reduced-resolution trial before running all ten 12-second HD segments.

The complete study uses a 120-second edit map. It removes sponsor segments and keeps the construction explanation and estimate qualification. Audio and caption finishing happen privately using the user-provided source; no new narrator is implied. Source caption timing is observed from the video and has approximately one-sixth-second granularity.

## Limits

This is an original, simplified procedural reconstruction, not an identical copy or a universal text-to-building system. People, cars and machinery are stylized. Interior and mechanical detail need further art direction for reference-level fidelity. A passing replay test proves temporal consistency at sampled times; it does not establish visual quality or structural engineering validity. The study branch is reviewable and does not deploy changes to production.
