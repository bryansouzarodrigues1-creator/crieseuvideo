# Live scene-program context and rejected-proposal repair

One of the three authorized real programming requests reached Gemini on
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
they consume none of the remaining live-call authorization.
