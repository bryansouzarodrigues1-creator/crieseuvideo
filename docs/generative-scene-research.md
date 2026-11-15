# CrieSeuVideo: from action selection to authored scenes

Research and implementation: 15 November 2026. This document distinguishes
implemented mechanisms, developer-authored render fixtures and untested live AI
behavior. Technical checks are not artistic acceptance.

## What the original creator actually does

The primary `mromidev/claude-animated-shorts` repository describes a code-authoring
workflow: write a story and shot timeline, build a Three.js world, pose characters
per frame, render selected stills, compare them and revise before exporting. Its
bridge example uses flat character cards in a 3D world. This is a 2.5D approach,
not evidence that the model automatically produces fully rigged 3D films from
any prompt. Its style includes lighting, depth, outlines, camera choices and sound
in addition to motion. The workflow matters more than copying a demo's topic.

Primary source:
https://github.com/mromidev/claude-animated-shorts/blob/main/SKILL.md

Remotion's ThreeCanvas documentation requires animation to derive from the
current frame rather than an independently advancing render loop. That allows
pause, seeking and repeatable frame rendering. Our existing absolute-time preview
and offline encoder already provide this property; replacing the editor with
Remotion would not itself add acting or new scenery. Remotion publishes practices
for several coding agents, including Codex, rather than an exclusive Claude API.

Primary sources:
https://www.remotion.dev/docs/three-canvas
https://www.remotion.dev/docs/ai/skills

Google documents that Gemini can generate code in other languages while its
built-in code-execution tool runs Python. A Three.js application still needs its
own execution/rendering path. Returning JSON is not inherently the limitation:
the content and expressiveness of that JSON contract determine what can be built.

Primary sources:
https://ai.google.dev/gemini-api/docs/code-execution
https://ai.google.dev/gemini-api/docs/structured-output
https://ai.google.dev/gemini-api/docs/function-calling

Three.js supports arbitrary vertex/index geometry. AnimationMixer can play clips
and seek to a specific time; it does not create a missing action clip. Rigged GLB
assets remain a useful future path for visual finish and reusable motion, subject
to actual asset availability and licenses.

Primary sources:
https://threejs.org/docs/pages/BufferGeometry.html
https://threejs.org/docs/pages/AnimationMixer.html

## Root cause in this repository

The old director selected `story`, `staging` or fixed production models/channels.
The renderer deliberately built a presenter and board when no action matched.
Version 10 blocked that fallback but could not create the missing action. That is
why merely asking the same finite action contract to handle climbing could not
solve the reported Everest example.

## Implemented path

`sceneProgram` is a small interpreted scene language. The model can author new
hierarchies, primitives, custom triangle meshes, tubes, seeded mesh repetitions,
body/limb trajectories, physical contact intervals and cameras. It has no climb,
comet or robot action identifier. Those cases require no topic-specific runtime
function and no source-code change per generated story.

The laboratory defaults to **Create new scenes — experimental** in Toon 3D.
An explicit Gemini button requests one complete program for the entire script.
The old catalogue and free local rehearsal remain available. The new request does
not pass through keyword-based action availability. It still preserves source
IDs, literal text, order and selected duration. Unknown/malformed programs are
rejected rather than replaced with a presentation. The provider transport retains
the previously compatible JSON MIME request, with no experimental response schema
and no automatic retries.

The server validates graph structure, geometry/resource limits, curves, source
binding and camera references. The browser validates physical contacts on the
real rig before applying a new program. An unreachable proposal preserves the
previous saved project and preview. Rendering and export use absolute time; a
contact failure during export aborts that export. Model-authored JavaScript,
network URLs and shaders are not executed inside the signed-in application.

## Verification and its limits

The new fixtures are **authored by the developer**, not by Gemini:

- a person climbing a snowy rock face, using alternating limb targets and supports;
- a comet with new composed geometry, a trajectory and a seeded star field;
- a robot made from a hierarchy of meshes, extending an arm and turning a gear.

These programs exercise the actual controller/provider adapter with intercepted
model responses, the ordinary mobile creation UI, seeking, project resume and
native frame export. The videos are silent engine-validation artifacts. None is
evidence that a live Gemini response has passed the new contract or that the
visual references' artistic quality has been reached. CI and render inspection
results are recorded in the pull request after completion.

## Remaining work

A live authorized generation is still needed to evaluate the model's ability to
author this language. Prompt/contract compatibility cannot be established by
fixtures alone. Automatic visual critique/repair by Gemini is not implemented;
render inspection and revision in this change are developer tasks. There is no
general collision/gravity simulator, arbitrary JavaScript execution, automatic
rigged-asset acquisition or guarantee of semantic/artistic completeness. Those
are distinct capabilities and must be evaluated on new scripts through the normal
flow, not inferred from a prepared demonstration.
