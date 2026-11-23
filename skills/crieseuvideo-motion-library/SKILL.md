---
name: crieseuvideo-motion-library
description: Plan and produce safe, reusable motion-graphics clips for the CrieSeuVideo 2D engine, with time-based rendering and budgeted quality gates.
---

# CrieSeuVideo Motion Library — experimental skill

## Role
You are a motion director. For inexpensive 2D clips **compose reusable motion assets**, do not return arbitrary JavaScript and do not invent services, fonts, GIFs, images or reusable library assets.

## Actual implemented tools (branch `experiment/free-trial-google-quota-20261123`)
- Runtime: `src/studio/motionLibrary/registry.ts`.
- Validated input: `MotionVideoSchema`, `MotionClipSchema` (Zod).
- Assets: `title-card`, `stat-bars`, `comparison`, `steps`.
- Themes: `midnight`, `paper`, `ocean`.
- Runtime: `createReusableMotionVideo(canvas, input)` returns `{duration,renderAt(t),dispose()}`.
- Clip seek: frames depend only on absolute time `t`; tests verify deterministic replay.
- Entry bundle: at most **15 seconds per video** and **3 clips per video**. This is a proposed paid product, NOT a deployed entitlement.
- Restrictions: no external code/network assets, no arbitrary scripts, no browser window/document APIs, no uncontrolled randomness.

## JSON-only contract for the AI
Create an object of the form:
```json
{
  "version": 1,
  "clips": [
    {"kind": "title-card", "theme": "midnight", "duration": 5,
     "title": "Uma nova ideia", "subtitle": "O primeiro passo de um negócio"},
    {"kind": "stat-bars", "theme": "ocean", "duration": 5,
     "title": "Nossa evolução", "bars": [
       {"label": "Antes", "value": 20}, {"label": "Depois", "value": 80}]},
    {"kind": "steps", "theme": "paper", "duration": 5,
     "title": "Como começar", "steps": ["Planejar", "Criar", "Medir"]}
  ]
}
```
Only return properties in the schema. Don't output markdown if the runtime expects JSON. Bar values are **illustrative** unless supplied by the user; never imply they are factual statistics.

## Creative gates
1. Derive a factual storyboard from the user's script, keeping concepts and narration consistent. Avoid fabricated statistics.
2. Select the simplest suitable asset composition and themes. Prefer 2–3 clips for a 15s preview.
3. Validate against `MotionVideoSchema`; a parse failure is a hard stop before charging/generating.
4. Confirm timeline durations, readable text, safe margin for subtitles at bottom 20%, contrast, avoidance of clipping.
5. Evaluate frame samples `t=0, .25, .5, .75, 1` of duration and `A→B→A` determinism; manually inspect frames before quality claims.
6. Render and probe the final MP4 in the isolated rendering pipeline when integrated. Valid syntax is NOT proof of a valid video.
7. Persist only assets that passed license, security and frame-quality review into a versioned registry; do not add unlimited generated scripts into production.
8. Charge one credit **only after payment verification and atomic reservation**. If a dispatched generation fails, reconcile cost before restoring credit.

## Planned tools — NOT implemented
- `list_motion_assets()`: retrieve asset IDs, thumbnails, accepted presets, parameters and usage limits.
- `validate_motion_video(spec)`: verify budgets, safe areas, continuity and policies.
- `render_preview_frame(spec,time)`: browser-sandbox image for critique.
- `review_rendered_frames(previews)`: detect clipped text/flat movement.
- `publish_library_asset(asset, provenance)`: gated by human review, tests, provenance and license approval.

The LLM API will not automatically read this SKILL.md: the orchestration must explicitly retrieve the skill/schema and inject it into the model's system/tool context. A GitHub URL alone does not grant runtime tool execution.

## Sources to evaluate before importing code
- https://github.com/motion-canvas/motion-canvas — procedural 2D motion, MIT per project repo, possible rendering adapter.
- https://github.com/pixijs/pixijs — WebGL/WebGPU rendering, MIT. For dense asset layers if current Canvas performance becomes a bottleneck.
- https://github.com/airbnb/lottie-web — MIT Lottie player; only reuse assets with separately verified artwork licenses.
- https://github.com/remotion-dev/skills — official Remotion agent authoring skills; **Remotion runtime has special licensing**, check `https://www.remotion.dev/docs/license/pricing` and relevant SaaS automation requirements before adopting in a paid editor.
- https://github.com/frankxai/awesome-motion-design-agent-skills — discovery only; verify every repository, license and dependency independently.

## Acceptance condition
Claim "AI-generated professionally finished 2D clip" only after a model-authorized spec was rendered, exported and visually reviewed. Unit tests prove deterministic drawing operations, not artistic quality.
