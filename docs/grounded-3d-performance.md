# Grounded Toon3D performance (development branch)

Opt-in `story.performance: "grounded-v1"` evolves the existing procedural rig;
the editor, legacy storyboard, imported GLB stage, storage and main deployment
are preserved. This capability currently supports a literal lantern pickup and
handoff between two named people. Other actions retain their existing renderer.

## Reproduction without AI credits

1. Install repository dependencies and run `npm test` and `npx tsc --noEmit`.
2. Run `node lab/build.mjs` and `npx tsc --noEmit -p lab/tsconfig.json`.
3. Install Playwright Chromium and FFmpeg on the render runner.
4. Run `node scripts/export-grounded-mp4.mjs --samples` for contact sheets.
5. Run `node scripts/export-grounded-mp4.mjs` for both 18s H.264/AAC MP4s.

`CRIESEUVIDEO_CHROME` optionally selects an already-installed Chromium.
The export blocks AI/TTS/connection endpoints and external requests. Output is
under ignored `tmp/grounded-performance/`. No credentials are needed.

## Timeline in seconds

| Time | Action |
| --- | --- |
| 0.4–3.8 | Enter with a distance-driven planted-foot gait |
| 4.05–5.65 | Crouch, reach and contact the lantern handle |
| 5.65 | Parent lantern to giver's hand socket |
| 5.9–7.35 | Lift and stand up, feet remain planted |
| 7.5–11.2 | Walk while carrying the attached lantern |
| 11.7–13.35 | Present the lantern and reach with receiver's hand |
| 13.35–13.95 | Both hands contact separate points on the handle |
| 13.65 | Change parent to receiver with continuous world transform |
| 13.95–15.6 | Release, raise the gift and acknowledge it |

The arm/leg solver uses true world-space two-bone IK and a bend pole. Foot
stance anchors are functions of distance, independent of wall-clock speed.
Each frame resets every controlled channel. Object parenting is reconstructed
from absolute time; it cannot retain the wrong owner after backward seeking.
The lantern mesh has a handle, frame, transparent glass, warm emissive core
and local light. Camera shots follow the event and fit the chosen aspect.

## Verified locally

- Original 123 tests pass; 7 new tests also pass (130 total).
- 1,081 actual-rig samples at 60 fps verify hand contacts, foot targets and floor
  clearance to less than 1 mm. No bone stretching is used.
- Pickup and handoff ownership boundaries have less than 0.1 mm displacement
  across a 20-microsecond sample interval.
- Fresh, forward and backward seek transforms match to numerical tolerance.
- Three different giver/receiver name pairs retain literal roles and words.
- Main/lab TypeScript and builds pass.

## Pending visual approval

Mathematical contacts alone do not certify natural acting. Inspect the full
18-second video, silhouettes, soles, palms, framing and shot changes. The
isolated export records frame count, codec, dimensions, duration, browser errors,
AI request count and identical-frame seek verification. Android device playback
and visual comparison with the supplied references require separate approval.

This is a procedural toon rig, not a new GLB motion-capture library, a physics
simulator, unrestricted AI choreography or photorealistic animation. Audio is
original procedural foley, with no paid TTS/narration. No visual-approval item
is marked complete in advance.
