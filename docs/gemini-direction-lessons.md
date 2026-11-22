# Direction learned from the HTML production

This change makes reusable direction instructions part of the **real Code 3D Gemini request**. It does not fine-tune Gemini, change its weights, or certify a scene merely because its plan passes validation. The older 2D presenter and compact JSON world routes are separate and do not gain the new runtime through this change.

## References actually inspected

- The five HTML files in `Como_Sair_da_Media_V3_Documentario_5_Atos.zip`, especially the final act's `show(t)`, `voice.currentTime`, timed captions and nested SVG groups.
- `Plano_de_Revisao_V4_Como_Sair_da_Media.md`: one main idea at a time, unchanged spoken text, literal examples, safe caption space, transition sampling and inspection of the moving MP4.
- The accepted twenty-second garden summary: wooden boards, soil and plants; tank components and water; roof modules. Its direction was manual, not autonomous Gemini learning.

The HTML uses GSAP as a paused master clock and updates SVG state from absolute time. The useful transferable method is the shared timeline, persistent object identity, explicit state changes and separation of placement from animation. Copying its CDN scripts into the isolated Three.js runtime is unnecessary. The reference also has reported bugs; it is evidence for the method, not a flawless quality target.

## The production request now carries the method

`code3dPrompt()` includes the versioned lessons, a compact structural example, and the required `CRIESEUVIDEO_DIRECTION_V1` JSON comment. The same request returns both the direction and the JavaScript. `generateCode3DWithGemini()` parses the direction before accepting the program, injects `DIRECTOR_SCORE` as validated data and requires an AST reference to `DIRECTOR_SCORE.shots`.

Objects have persistent IDs and parts. Each shot states its literal source quote, subjects, focus, camera kind, visible action, before state and after state. Validation rejects unknown subjects, duplicate IDs, invented quotes, gaps, overlaps, reversed intervals and an unsupported timing origin. This checks the structure; semantic agreement between those declarations and actual pixels still needs visual inspection.

Without an alignment the score explicitly says `planned`. With supplied word times it says `provided`: the model selects word indices; the engine derives shot boundaries from those exact timestamps, preserving pauses and the clip duration. Estimated word weights are never promoted to measured alignment. The caller is responsible for supplying a correct alignment; parsing numbers is not speech recognition.

The Code 3D screen can import an optional alignment:

```json
{"duration":10,"words":[{"text":"Monte","start":0.1,"end":0.5},{"text":"a","start":0.6,"end":0.7},{"text":"caixa.","start":0.8,"end":1.4}]}
```

The existing clip limit remains 8–12 seconds. Audio mixing is still separate on this experimental route; the option does not generate or automatically transcribe a voice. The displayed shot list says whether the timing is planned or supplied, and keeps visual review pending.

## Deterministic component assembly

`tools.createAssemblyPart()` snapshots a part's final local position, orientation and scale once. Its `apply(t)` interpolates from the entrance pose to that final pose using absolute time, preserves dimensions and remains correct after seeking backward. A positioned parent group is left intact. The model must still choose valid geometry, supports, entrance paths and camera framing.

Existing imported programs, pinned Three.js sources, opaque iframe origin, CSP, authentication, cooldown and one-request-per-click rules remain. No extra provider, automatic repair, retry, video generation bill or secret in browser code was added.

## Validation and proof

- Offline tests cover direction failures, real request construction with supplied word times, one-call failures without fallback, and assembly dimensions/final fit after out-of-order seeks.
- `gemini-direction-proof.ts` makes at most one explicit real request. It retains the original response, normalized score, source hashes and untouched generated program.
- `gemini-direction-browser.mjs` uses that actual program in the native isolated player, samples every second and both sides of shot boundaries, tests replay and exports an MP4. This test uses explicit code import; it does not establish production login/auth flow.
- The one-call workflow is limited to the `opened` event of the dedicated feature branch. Later code pushes run offline validation without spending another generation.
- Browser success means the program ran and exported. Visual acceptance must be recorded separately after inspecting the frames and MP4; one successful theme is not proof of general generation quality.

Deployment status: feature branch based on the latest garden summary branch; not merged or published by this change alone.

## First real result and feedback

Run `44964365935` made one successful Gemini 3.6 Flash request and returned three valid shots anchored at 0, 3.14 and 7.04 seconds for a 10.2-second clip. The untouched code opened in the actual isolated player. The capture harness then failed because it sent a floating-point range value of `10.149999999999999`; that harness error is corrected by decimal quantization. Subsequent checks reuse the exact response now retained in `scripts/fixtures/gemini-direction-baseline.*`, with original response, provenance and source hashes, rather than depending on expiring artifacts, spending another request or editing the model's program.

Visual review of its first set of frames found real shortcomings: very tight camera framing, dark solar panels without readable cell details, and water hidden inside an opaque tank. Visual quality is **not approved** by the successful plan validation. These observations are now explicit lessons in the real prompt. A deterministic `fitCameraToObjects` helper was added to compute a complete subject frame from actual transformed bounds; portrait and landscape projection tests cover the caption clearance. The saved first generation predates those additional lessons and does not demonstrate their use by Gemini yet.
