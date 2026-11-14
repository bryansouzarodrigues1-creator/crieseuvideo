# Ordinary script staging and user duration

The user supplied a screen recording showing the normal Toon3D flow still
rendering a presenter beside an illustration board, while only the special
lantern demo had full acting. The final ordinary topic shown was a short line
about a corruption scheme. Its six-second illustration did not demonstrate
the meaning through action. This change targets the ordinary input path itself.

## Behavior

`buildFallbackPlan` and `normalizePlan` compile supported verbs/concepts into a
shared `staging` score. `Toon3D` creates `Narrative3D` before the presenter/board
path. Ordinary local and AI-directed plans therefore use the same executable
actions even if an older director response supplies only an illustration.

Supported now: receiving/reading a phone message, heartbeat reaction, walking,
running/arrival at friends, computer work, growing bars, money/document flow,
question/reaction, waiting and a clock. Money flow is explicitly a visual
metaphor, without invented named participants or accusations. Unsupported
topics retain the illustration path; this is not an unrestricted animation AI.
The new narrative stage is Toon3D; Motion2D retains its existing renderer.

Rig limbs use world-space IK; locomotion uses stationary support anchors and
distance-based cycles. Phone ownership attaches to the actual hand. Props and
performers share the 3D scene rather than a presentation texture. Named
protagonists continue into following pronoun-led scenes.

## Duration

Both the private lab and the main studio expose Auto / 15 / 30 / 60 / 90 seconds
and a custom 5–600-second field. The score allocates explicit scene lengths;
the same `sceneDuration` drives seeking, captions, narration and export. The
selection persists with the project. Changing it needs no AI request.

Words are preserved and recorded speech is never accelerated/cropped. Minimum
action/speech time wins over an impossible shorter request, with a visible
notice. Short scripts at long requested durations show a pacing notice rather
than inventing extra dialogue. Longer duration alone does not create new facts
or a richer story. Uploaded audio remains a lower bound.

## Verification

160 tests pass locally, including the 144 previous tests and 16 ordinary-flow,
duration, semantic-guard and actual-rig tests. Main/lab TypeScript and builds
pass. Browser QA must fill the ordinary textarea and click local rehearsal;
it never clicks the special demo. It checks 15/30/60/90/custom, persistence,
source words, actual stage selection, hand reach and deterministic seeking.

`node lab/build.mjs`

`node scripts/normal-workflow-qa.mjs --samples`

`node scripts/normal-workflow-qa.mjs --full`

The full script exports a normal five-scene 60s vertical video and a separate
30s landscape object metaphor. Frames come from the actual player canvas.
AI/TTS/connect endpoints and external network calls are blocked. Audio contains
only original soft effects. Real-provider output is covered by simulated
contract tests, not a new paid Gemini call.

The first browser run and 60s/30s exports passed. Sample inspection then
corrected the phone screen orientation (with an over-shoulder reading shot),
restored office context, removed an unintended night interpretation of a street
and kept the growing bars moving through the last frames. The next revision
requires another actual-frame check before visual approval. Keep production main unchanged; use the private lab and a stacked PR.

Further semantic guards reject noun-only prop mentions and negated events;
abstract scenes do not overwrite the named human protagonist. The player starts
at t=0. The phone reading shot also checks that the head does not occlude its
centre ray.
