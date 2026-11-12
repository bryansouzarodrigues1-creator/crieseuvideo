<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- The migrated StickStory animation studio lives in `src/studio/` and renders client-only from `/` (it uses WebGL, audio and localStorage); its AI endpoints are server routes under `src/routes/api/ai/` that fall back to deterministic results when AI is unavailable.
- Extra-strict TS flags (exactOptionalPropertyTypes, noUncheckedIndexedAccess, etc.) are off because the migrated studio code was written without them.
- Imported GLB rendering lives in a separate Three.js stage and shares sceneComposition with preview/export; this preserves the legacy cinematic rig and keeps imported animation deterministic by scene time.
- Scene assets are self-contained GLBs or embedded image data; validate GLB headers and reject external resources/unsupported decoders to prevent silent loading failures. Readiness uses data-scene-ready on the player.
- The first screen is the code-rendered 2D explainer studio (src/studio/explainer): AI only writes a validated scene plan and a Canvas renderer draws every frame, so animation costs text credits, not video credits. The AI video workspace and the legacy scene editor stay reachable; the legacy scene editor remains accessible without altering its renderer, because generated MP4s are not editable scene graphs.
- Video creation uses authenticated server functions, owner-scoped production records and private storage; persist gateway failures and never silently substitute presets or resubmit failed jobs.
- Explainer narration is one TTS clip per scene fetched via the `/api/ai/narrate` server route and cached in the browser Cache API by voice+text; scene length and caption timing come from the measured clip, so replays and edits of other scenes never re-bill.
- New explainer props and characters are code-drawn in src/studio/explainer/render.ts rather than stored images/videos, because drawing is free and needs no asset storage or AI generation.
- Explainer projects and the drawing gallery autosave in browser localStorage (src/studio/explainer/library.ts); uploaded narration audio is not persisted, so saved projects drop track timing.
- ElevenLabs narration is a prepared path in /api/ai/narrate (provider "elevenlabs" + voiceId) that activates only when ELEVENLABS_API_KEY is linked via the connector.

- AI drawings are auto-stored in a tagged local asset vault (library.ts) and the most relevant ones are sent to the director so it reuses them instead of redrawing; reuse costs no extra AI output.
- The explainer has two engines: Motion 2D (render.ts) and 3D Toon (toon3d.ts, Three.js cel-shading, lazy-loaded); the 3D frame is drawn into the same 2D canvas with captions on top so preview and MP4 export share one pipeline.
- A keyword bank (src/studio/explainer/keywords.ts) maps script words to required visuals before the AI directs, so meaning (e.g. "link na bio" = profile) doesn't depend on AI guessing.
- Every generation and its yes/no feedback is stored in explainer_generations (service-role only, via /api/ai/feedback); recent "no" reasons are injected into the director prompt so it learns from real misses.
