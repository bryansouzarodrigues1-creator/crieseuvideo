# CrieSeuVideo: why a good demo does not generalize

Reviewed against the user's 177.66-second crane/construction reference and the
ordinary-script failure reported on 2026-11-14. Visual inspection used frames
throughout the reference; this is not a transcript or an audit of its engineering
claims. Its authoring software cannot be identified from the video alone.

## Current failure

The user's exact input, `Eu sou o maior jogador do mundo hahahaha`, has no
supported `staging` action. `Toon3D` therefore falls back to a presenter beside a
2D board. Adding a keyword for that sentence would improve one case without
solving general direction. The script does not specify which kind of player it
means; inserting football, a game controller or a victory would invent facts.

`staging.ts` exposes ten fixed scene recipes. `normalizeStaging` requires the
model's choice to equal the keyword-based local inference. Even a stronger text
model cannot combine arbitrary actions or animate a missing asset through this
contract. The lantern performance and local workflow videos are code-directed
demonstrations, not evidence that live Gemini can independently produce their
quality for unfamiliar scripts. Preserving text and producing changing frames
is necessary but does not prove meaningful acting.

## What the reference requires

| Visible feature | Reusable capability needed |
| --- | --- |
| Construction site and surrounding city | Licensed or original scene assets with coherent scale, materials and lighting |
| Hoisting, cables and a suspended load | Mechanism rig, attachment points, constraints and a shared motion timeline |
| Workers handling objects | Character rigs, reusable animation clips, contact correction and expressions |
| Wide views and close views of parts | Shot planning, camera targets and continuity across cuts |
| Multiple stages of the explanation | Object state carried between shots and timing tied to the source meaning |

This is stylized 3D animation. Photorealistic diffusion is not a prerequisite.

## Architecture decision

Retain the existing editor, authentication, projects, duration controls and
shared preview/export pipeline. Evolve the production layer incrementally:

1. Introduce an asset/capability registry with stable IDs, licenses, dimensions,
   named joints, contact sockets and supported actions. Characters and machines
   both need articulated parts; humanoid motion clips do not animate a crane.
2. Build or prepare models, skeletons and animation clips in Blender and deliver
   self-contained GLBs. Reuse the existing `importedModelStage.ts` loader and
   deterministic `AnimationMixer.setTime` behavior where appropriate. It is
   currently separate from the ordinary Toon director; that integration remains
   work to implement, not a completed capability.
3. Replace one recipe per sentence with a validated, composable action timeline:
   actor/object IDs, source IDs, start/end, paths, target/contact IDs, object state
   and camera shots. Preserve who acts, who receives, negation and uncertainty.
   The validator checks capability/physical feasibility instead of demanding
   that semantic interpretation equal a regex category. Unsupported requests
   must report the missing capability rather than imply full animation.
4. Let the director select and compose those capabilities. Use schema-constrained
   output plus semantic/physical validation. A model upgrade should be evaluated
   on the same unseen-script set only after both models can use this contract.
5. Validate through the ordinary creation button: new scripts, different names,
   different objects, mechanisms without people, varied durations, both aspect
   ratios, seeking, preview/export agreement and human visual inspection.

Blender supports rigging/IK; Three.js supports skeletal/morph animation, clips,
blending and glTF loading. Neither supplies an automatic cinematic asset library
or a general story director. These still need assets and implementation.

Generative-video APIs are a separate possible production path for some shots.
They require a budget and their own continuity, editability and factual QA.
Do not activate them or switch providers automatically to hide unsupported work.

Primary references:

- https://threejs.org/manual/pages/animation-system.html
- https://threejs.org/manual/pages/loading-3d-models.html
- https://docs.blender.org/manual/en/5.1/animation/armatures/posing/bone_constraints/inverse_kinematics/introduction.html
- https://ai.google.dev/gemini-api/docs/structured-output

## HTTP failure and verification boundary

Live worker logs showed two `/api/direct` responses with HTTP 502 and two with
HTTP 200 during the reported session. The screenshot proves an HTML body was
parsed as JSON. Existing logs do not identify the director rejection code or
establish which layer generated that HTML. Do not call this a Google quota,
model, authentication or timeout diagnosis without further evidence.

The fix validates response types/bodies in the lab and main studio, preserves
the existing plan on failure, rejects empty success plans, and never retries.
The private lab sends application failures in an explicit JSON RPC envelope
(`ok:false`, logical `status`, `code`, `error`, `requestId`) over HTTP 200 so
they do not depend on a gateway forwarding an application 5xx body. Origin and
route failures keep HTTP 4xx; the production API status contract is unchanged.
Sanitized server diagnostics log only request ID, fixed code, status and route.

Tests cover the real response parser, worker boundary, main studio recovery and
ordinary mobile browser interactions with simulated provider responses. These
are failure-recovery tests, not a live Gemini-generation acceptance test or
evidence of animation quality. No paid generation is part of this QA.

## Revised priority: 3D world variety before humanoid photorealism (17 Nov 2026)

The user explicitly prioritizes original, recognizable, entertaining 3D scenes
over maximally realistic human articulation. A red ball labelled "tomato" is
not an acceptable visual result, but a photorealistic tomato is also unnecessary.
The required middle ground is *stylized but specific*: distinctive silhouette,
proportions, 2–3 characteristic parts, coherent material/color and a visible
change of state or motion. Characters are just one asset class among animals,
plants, vehicles, machines, environments and original objects.

### Product acceptance gates

1. **Framing:** a shot contains all its subject movement without clipping. The
   viewer must see the decisive action. Camera motion is locked by default;
   an actual orbit is opt-in. Reframing between shots is okay; wandering
   sideways during a static shot is not.
2. **3D construction:** an object named in the script is identifiable by
   geometry, not a primitive with the correct color. A test tomato, for
   example, needs recognizable silhouette, calyx and stem. This is a visual
   *test fixture*, not a tomato-only generator.
3. **Variety:** test unseen scripts in very different categories (organic
   object, mechanism, vehicle, place and nonhuman character). They must use
   generic geometry/asset tools, not a custom thematic drawing routine for
   each script.
4. **Action and consequence:** the object visibly changes, transforms, rolls,
   operates or interacts as the narration says. A camera orbit alone is not
   evidence of object animation.
5. **Production truthfulness:** real generated Gemini clips need their own
   before/after and visual QA. Local hand-authored fixture videos do not
   demonstrate autonomous generation or production readiness.

### Implemented in isolated PR #46

- SceneProgram3D fits one spatial envelope for a complete shot, with safe
  framing margins and a locked camera target unless `motion:"orbit"` is
  explicitly requested.
- Gemini's 3D authoring guide favors distinct stylized objects and flexible
  sets, and explicitly rejects single primitive placeholders and unnecessary
  human-realism requirements.
- A nonhuman organic fixture (tomato, vine, wooden crate) uses the same generic
  mesh/lathe/hierarchy/tracks engine as the mechanical blender fixture.
- Browser/MP4 QA and CI are isolated. No changes deployed to main/Lovable.

### Not yet proven

- A fresh Gemini generation of multiple *unseen* scene categories with
  convincing visuals and semantic accuracy
- Automatically selecting/generating a reusable library of coherent 3D assets
  for arbitrary named objects with consistent style and licensing
- Multi-location edits and persistent subject identity across a full 2-minute
  video, including sound and exact duration
