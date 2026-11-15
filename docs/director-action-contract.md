# Source-bound director actions

A real `/api/direct` failure reported `unsupported_action` at the staging
validation boundary. The original provider body was not retained. Regression
tests reproduced the same error with an otherwise valid response containing
`staging: null`; `story: null` was rejected similarly. These values mean absence,
not an unsupported action. `production: null` could also erase a valid legacy
story before validation. All three are now handled consistently.

The version-7 structured-output request was rejected by the connected Google
account with HTTP 400. Gemini requests now use the previously accepted
`responseMimeType: application/json` and `maxOutputTokens: 8192`, without
`responseFormat`, `responseSchema` or `responseJsonSchema`. No automatic retry
is made. Source IDs, literal text, action capabilities, actor roles and physical
contacts remain validated on the server. The prompt still includes each source's
allowed staging action or null. Pride/laughter and mechanism controls belong to
the production graph; presenter poses have their own vocabulary. The Lovable
gateway keeps its existing JSON-object transport.

The request includes an explicit staging contract per source. When a production
baseline is available it asks for a complete graph, including assets, rather than
suggesting tracks without the definitions needed to execute them.

Schema constraints do not replace validation. Unknown actions, reversed actors,
negations, changed source text, unreachable contacts and invalid graphs remain
rejections. Failures identify the source and field, with known action IDs and the
expected staging action. Unknown model strings are not echoed or logged. Logs
contain no source text, provider body, credentials or actor names. No automatic
retry, paid-provider switch or silent replacement was added.

`directionContract.test.ts` runs the actual director and provider adapter with
intercepted network transport. `director-response-qa.mjs` exercises the mobile UI
through the real built Worker/controller, applying nullable actions as 3D acting
and preserving the existing plan/pixels when a contradictory action is rejected.
These provider responses are fixtures. A new live Google generation is not part
of this verification.

`directionSchema` is a reference/test description of the renderer's vocabulary,
not a schema sent to the provider. `director-schema-qa.mjs` checks that reference
with an independent Draft 2020-12 validator. Its fixtures cover nullable enums, source/action swaps, source
order, a complete mechanism graph, legacy drawings and null story performance.
Schema validity alone does not establish upstream request compatibility.

Connection verification calls Google's non-generating `countTokens` endpoint
with the shared JSON request builder. It checks the key/model and token service;
it does not establish that a complete generated scene will pass validation.

The laboratory starts without applying any preview, including old cached demo
plans. It restores draft text/settings separately and offers an explicit resume
button for a matching user project. Editing text hides stale images and export
controls. Legacy project records are preserved, and the hardcoded Lia/Caio demo
button is removed. Rehearsal, project imports and video export remain available.

Primary API reference:
https://ai.google.dev/gemini-api/docs/generate-content/structured-output
