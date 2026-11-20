# Minecraft reference through the Code 3D engine

The supplied voxel cottage is adapted to the existing `createScene(THREE, canvas, width, height)` contract. The 10-second scene assembles the foundation, walls and roof, seats the chimney, lights the windows and emits smoke. Every texture is drawn procedurally. Portuguese bitmap captions stay inside the rendered canvas and require no font download.

Source: `artemnovitckii/claude-animation-skills`, `skills/minecraft/template.html`, MIT, copyright 2026 Artem Novitckii. The full license remains in the scene source. The companion provenance JSON records the supplied snapshot and adapted source hashes. No Mojang texture, logo or character is included.

This is imported reference code adapted by ChatGPT. It makes no Gemini request and is not evidence of autonomous model generation.

## Reproduce

Start the actual Vite app on `127.0.0.1:4198`, then run `bun scripts/code3d-minecraft-browser-proof.mjs` with Playwright/Chromium installed. The script opens `/motor-3d/codigo`, uses the existing file-import control, checks the sandbox and sampled replay, captures staged frames, and clicks the studio's actual export button. Neither the renderer, export resolution, isolation policy nor authentication rules are changed.

The dedicated workflow targets pull requests into the existing reviewed Code 3D branch. It uses no secrets, has read-only repository permissions and uploads the original MP4/WebM, screenshots and `report.json`. A successful report establishes an imported scene rendered by that repository test instance; it does not establish production deployment or a new Gemini response. A failure preserves its stage and visible diagnostics instead of claiming a successful export.
