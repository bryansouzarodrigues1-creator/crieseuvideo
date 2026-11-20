# Gemini — Código 3D

Independent experimental route: `/motor-3d/codigo`. The existing 2D, Toon and declarative SceneProgram3D engines remain separate.

## Scene contract

One complete JavaScript program defines `function createScene(THREE, canvas, width, height)` and returns `{duration, renderAt(t), dispose()}`. Duration is a finite number between 8 and 12 seconds (10 if omitted). `renderAt(t)` is synchronous and derives all positions from absolute seconds. `dispose()` frees geometries, materials, textures and renderer resources. Only core Three.js r187 is supplied; no addon, CDN or external asset is loaded.

The prompt asks for coherent staging, hierarchical mechanisms and contacts, multiple camera compositions and procedural detail. It does not constrain the scene to the old JSON limit of 7 entities / 3 actions. Program size is limited to 80,000 characters and script size to 1,200 characters. These are resource bounds, not a guarantee of artistic quality.

An explicit authenticated generation click makes one server-side request to Gemini. The model comes from `GEMINI_CODE3D_MODEL`, then `GEMINI_AI_MODEL`, then `gemini-3.8-flash`. No hidden retry, repair, provider substitution or automatic generation. Syntax parsing with Acorn does not execute code. Missing key, HTTP refusal, quota and truncation are separate failures. Keys are never sent to the browser.

The user may save a returned program as `.js`, edit it externally and explicitly reopen it without login or another model request. Imported code receives the same syntax check, iframe execution, replay check and export rules. It is identified as imported; it is never labelled a new Gemini generation. HTML documents do not meet this contract and are rejected.

## Execution and lifecycle

- Opaque-origin iframe with `sandbox="allow-scripts"`, without `allow-same-origin`, popups, top navigation, forms or modals.
- CSP blocks connections, external resources, frames, workers, forms and eval. The trusted Three.js copy and supplied program become blob modules inside the iframe. The app does not evaluate the program.
- The bridge checks the exact window, parent/child origin and per-load token. The token prevents accidental cross-talk; it is not a secret from code running in the iframe. No account data is included.
- Duration, message types, sequence numbers and bitmap sizes are checked. Old async initialization cannot target a replacement iframe.
- Replay compares small pixel samples at three timestamps after seeking elsewhere. A divergent result blocks export. Passing is evidence only for those sampled frames; it does not prove every frame, physical realism or script fidelity.
- Cancel, scene replacement, runtime error and unmount reject pending frame requests and remove their timers/abort listeners. Unexpected late bitmaps are closed. Sandbox disposal releases the scene and blob URLs.

An iframe is not a process or CPU/memory sandbox. Unbounded code can exhaust resources or block a renderer before the 25-second watchdog runs. CSP does not by itself govern WebRTC; direct WebRTC/network/worker globals are disabled as defense in depth. These controls do not make arbitrary hostile JavaScript provably safe. Do not claim a hard execution deadline or expand account privileges to accommodate model code.

## Export and evidence

The shared fixed-frame encoder requests each bitmap at `n/24` seconds. It writes H.264 MP4 if supported by the browser, otherwise WebM. Current code-mode canvas is 432×768 vertically or 768×432 horizontally. This route has no narration or captions yet.

Run `bun run test`, `bunx tsc --noEmit`, `bun run build`, then start Vite on port 4198 and run `bun scripts/code3d-browser-qa.mjs` with Playwright/Chromium installed. The existing unified workflow performs these checks and retains `tmp/unified-3d-qa/code3d/`.

The browser script imports `scripts/fixtures/code3d-crane.js`, a **hand-authored technical fixture**. It checks actual WebGL pixels, replay, isolation, cancellation, malformed/divergent code, recovery, aspect replacement and a full 8-second export. Its output is not evidence of live authenticated Gemini generation and is not an approved final video.
