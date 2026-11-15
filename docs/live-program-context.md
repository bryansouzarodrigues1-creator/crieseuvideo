# Live scene-program context and rejected-proposal repair

The first of three authorized real programming requests reached Gemini on
15 November 2026. The v11 application rejected its program because at least one
object did not contain an exact literal source quote in `evidence`. The full
provider proposal was not retained, so its exact offending quote cannot be
identified or reconstructed. No render was produced from that first response.

The director now asks for a real `contextSourceId` on each node. The application
derives that node's literal context from the original source instead of making
the model repeat quotations. Existing programs with literal evidence remain
compatible. Unknown source IDs are still rejected. This is context binding, not
automated proof that the visual meaning is correct.

A rejected JSON program is returned to the caller as bounded, source-bound
feedback data. It is never rendered or executed, and does not appear in error
serialization or the fixed-field failure logs. A separate explicit correction
request may send that proposal and its validation error back to the model.
Cross-script candidates and oversized inputs are rejected before inference.
If an earlier full proposal was not retained, diagnostic-only correction is also
supported and explicitly identifies that limitation in the prompt.

Tests cover context derivation, invalid source IDs, source-bound candidates,
non-enumerable error data, private-log exclusion and the ordinary mobile
reject→correct flow. Provider responses in these regression tests are fixtures;
they do not invoke a model.

## Results of the three authorized requests

All three requests have now been used. The exact script was
`Ele conseguiu escalar o monte Everest mas...`, with a 15-second target and
9:16 output. No ending was invented, and narration was not requested.

| Request | Observed result |
| --- | --- |
| 1 | Gemini generated a proposal, but literal object evidence failed local validation; no usable program was retained. |
| 2 | Gemini returned a valid structured program with eight nodes and seven animation curves. The all-frame rig audit found a maximum hand/foot reach error of 0.4668 metres. |
| 3 | Gemini corrected the prior program using the measured rig feedback. Its eight nodes and seven curves passed the reach audit across all 450 frames, with maximum error below 1e-14 metres. |

The model reported for requests 2 and 3 was `gemini-3.6-flash`.
The server-normalized programs are retained under `scripts/live/`; their
animation values have not been manually corrected. Request 3 has SHA-256
`e940e70c2c68f05016cf88d44d63db94996a5b1f9cec9c9fcf108429e44567f4`.

Request 2 exposed a renderer bug: only explicit contact constraints caused
unreachable targets to reject a program. Authored free-standing hand and foot
targets could be silently clamped by IK. Preflight and every rendered frame now
check all solved effectors, including programs with no explicit contacts.
Captured requests 2 and 3 provide regression cases for rejection and acceptance.

The captured-program render workflow replays request 3 at the browser HTTP
boundary through the ordinary creation UI and exporter. It performs zero model
requests. It checks source and program identity, both aspect ratios, random
timeline seeks, 450 exported frames, H.264 output, and preview/export last-frame
agreement. It saves raster frames and the MP4 for visual review.

Reach validation is not proof of convincing climbing, terrain contact,
collision handling, visual storytelling or reference-quality art. The captured
program contains no explicit contact intervals. Those limits must remain visible
when reporting the rendered result; test counts alone do not approve animation
quality. No additional inference request is authorized by this workflow.
