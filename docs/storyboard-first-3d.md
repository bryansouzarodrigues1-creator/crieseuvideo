# CrieSeuVideo — storytelling before 3D rendering

## What the user noticed

The first 30 seconds of the user-provided construction reference
`1000857556.mp4` have **many distinct narrated visual actions**: carrying
cement bags up scaffolding to the fifth floor, physical exhaustion and a
large remaining stock, the introduction of a rope and pulley, a suspended
loaded pallet and a blue mechanical winch. The film also uses synchronized
voice/subtitles, explanatory overlays, and cuts to show causes and results.

Our 30s laboratory reused one long source paragraph, 5 camera cuts, no
narration or subtitles, and a mechanically generic 3D model. It animated the
worker, platform and motor, but **did not animate the transition from the
problem to a solution**. The rope was later attached correctly, yet a pixel
motion test that passes on a spinning gear still cannot prove a meaningful
story. An AI that only fills geometries and keyframes will reproduce the
problem.

## Correct architecture (topic-independent)

1. **Script grounding:** preserve the user's narration and break it into
   logical, temporally bounded story beats, keeping original claims intact.
2. **Editorial storyboard:** for each beat, identify the starting state,
   action, affected object, causal link to the previous beat, and resulting
   state *before* writing any mesh geometry.
3. **Persistent 3D objects:** one identity for the same bag/platform/vehicle
   between beats; attach objects to real parent groups, mechanisms and
   constraints. Do not instantiate a brand-new item to represent the same
   named cargo unless a pickup/handoff event truly occurs.
4. **Choreography:** move or transform only what advances the beat. A
   mechanic's rotation alone is not enough when the story is about what that
   mechanism achieves. Show input and output together or in immediately
   adjoining cuts.
5. **Cinematography:** alternate context, cause, detail and consequence.
   Do not leave a portrait camera on essentially the same frame for six
   seconds. Do not enforce arbitrary cuts during a single expressive action.
6. **Validation:** movement, endpoint contact, framing and 3D physics
   heuristics are separate from narrative QA. Inspect actual pixel frames
   and compare to the source audio/script; do not label an animation
   professional simply because 400+ unit tests passed.
7. **Correction loop:** regenerate the deficient STORY BEAT (assets,
   animation and direction) instead of repeating the entire scene with
   slightly different geometry coordinates.

## Construction video: editorial plan for testing (not a production preset)

The rough sections below come from user-provided reference imagery, not a
certified word-for-word transcript. Do not substitute them for actual narration.

| Time (sec) | Visual question being answered | Required visible state change |
| --- | --- | --- |
| 0–2 | What are workers carrying? | One specific cement bag is picked up/carried |
| 2–4 | Where must it go? | Same bag travels upward via visible stairs/scaffold |
| 4–6 | Why is this inefficient? | Fifth-floor arrival, worker stops from effort |
| 6–8 | How much work remains? | Large stockpile and unfinished building revealed |
| 8–10 | What is the proposed solution? | Rope introduced at correct edge of building |
| 10–12 | How is the rope routed? | Upper worker positions rope over a support |
| 12–14 | What does the pulley do? | Spinning pulley and *real* supported rope shown |
| 14–16 | Where is the load attached? | Rope hook engages platform, load becomes suspended |
| 16–18 | What moves first? | Pallet lifts off the ground |
| 18–20 | Where does it move? | Same loaded platform rises beside the façade |
| 20–22 | What changes on arrival? | Load reaches upper level while staying supported |
| 22–24 | Why use a motor? | Winch is introduced with cable/drum continuity |
| 24–26 | Which part turns? | Blue motor drives shaft and small gear |
| 26–28 | How does it multiply force? | Big gear responds, movement/force demonstrated |
| 28–30 | What was accomplished? | Drum/cable lift shown as clear mechanical result |

This plan is **reference-specific evaluation data**. The engine must not
turn it into a generic crane/cement template or use it as an answer for
different topics. A cooking clip, weather phenomenon, car crash or animal
story requires a different storyboard and original scene assets.

## Current test instruments

- `storyContinuity.ts`: independent audit of unusually long cuts,
  repeated framing, weak shared-focus transitions and rotations lacking
  positional/scale progression. These are evidence-based **warnings**,
  not proof of true story meaning. A valid dramatic shot can be long.
- `cutActivity.ts`: numerical curve activity of objects framed by the cut.
- `scripts/cement-hoist-30s-qa.mjs`: visible pixel differences, moving
  winch pieces, cable endpoints, camera crop, real MP4 export.
- `SCENE_PROGRAM_GUIDE`: Gemini now instructed to plan causes and
  consequences before writing sceneProgram JSON.

## Release gate

Do not merge or deploy merely because new audits pass. The next
deliverable is **multiple unseen story topics** generated with the actual
connected Gemini provider, with coherent beats, synchronized narration and
captions, appropriate objects, animation, and visual human review. The
current 30-second construction laboratory was authored by an agent and
does not prove autonomous video generation.
