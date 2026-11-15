# Source-bound director actions

A real `/api/direct` failure reported `unsupported_action` at the staging
validation boundary. The original provider body was not retained. Regression
tests reproduced the same error with an otherwise valid response containing
`staging: null`; `story: null` was rejected similarly. These values mean absence,
not an unsupported action. `production: null` could also erase a valid legacy
story before validation. All three are now handled consistently.

Gemini direction uses the documented GenerateContent structured-output format,
`generationConfig.responseFormat.text`, with a JSON Schema. Ordered `prefixItems`
bind each response scene to its source ID and literal text. Each source receives
only its executable staging action or null. Pride/laughter and mechanism controls
belong to the production graph; presenter poses have their own vocabulary. The
schema preserves the existing 40-shape drawing limit and the bounded production
catalog. The Lovable gateway keeps its existing JSON-object transport.

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

`director-schema-qa.mjs` also checks the actual schema with an independent Draft
2020-12 validator. Its fixtures cover nullable enums, source/action swaps, source
order, a complete mechanism graph, legacy drawings and null story performance.
This catches schema errors that a permissive provider fixture would not detect.

Primary API reference:
https://ai.google.dev/gemini-api/docs/generate-content/structured-output
