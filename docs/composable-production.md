# Composable 3D production

This development branch adds a global production score to the ordinary creation
flow. Geometry, joints, payload ownership and camera state persist between source
sentences. An AI director can compose bounded controls; it no longer has to match
one of ten keyword recipes to animate these assets. A conservative local compiler
uses the same score for supported scripts and supplies the director with a
physically consistent baseline.

## Available catalog

- Tower crane: hoist, trolley, upper slewing assembly, cab and counterweight.
- Cargo: box, sacks or pallet, with base/grip contact points.
- Truck: transport, wheels, bed and cab.
- Construction lift: cabin displacement and opening/closing doors.
- Person: pride, laughter, smile, pointing and talking, with fixed feet.
- Worker: hard hat, gesture and rotation. Walking remains in the previously
  validated narrative renderer; the new program does not expose human translation.

This is a finite catalog. It is not an arbitrary-world, fluid, rigid-body or
photorealistic engine. Original merged geometry and articulated groups are used;
this change does not claim a new GLB/mocap library. Existing GLB support elsewhere
in the editor is preserved. Reference-video frames are not included as assets.

Contacts are validated before applying a plan. A coupling more than 5 mm from its
target is rejected. Generated test choreography uses coincident contacts. The
program samples absolute time, so seeking and exporting do not integrate state
from previous frames. This is kinematic animation, not an engineering safety
simulation or a verification of real crane capacities.

## Complete export path

The laboratory can import narration and export video through its normal controls.
The frame encoder submits every n/30 frame with backpressure, independent of wall
clock rendering speed. It prefers H.264/AAC MP4 when the browser can encode them;
otherwise it offers WebM with the correct extension. The main studio uses this
MP4 path where supported and retains its guarded recorder for compatibility.
Android hardware/browser encoding still requires device testing.

Narration packages include exact source text, decoded WAV clips and sample-based
Piper phoneme timings mapped to original words. Import refuses mismatched text,
scene identity, durations or word arrays. It does not stretch recorded speech.
If phoneme grouping differs from written tokenization, the local tool labels
word timing unavailable rather than inventing it. Plain uploaded continuous audio
uses proportional scene estimates and needs visual checking.

Use **Abrir projeto** to restore a plan and its embedded narration package. Use
**Baixar projeto** to save the scene plan and imported scene clips. Browser
autosave does not retain the audio; a downloaded project does. Editing the script
invalidates imported voice until it is replaced. No paid voice or video API is
called automatically.

## Local voice tool

Piper is an optional separately installed CLI dependency, not a Cloudflare Worker
or frontend TTS service. From an ordinary downloaded project/plan:

```sh
python3 -m pip install -r scripts/requirements-render.txt
python3 -m piper.download_voices --data-dir tmp/piper-voices pt_BR-faber-medium
python3 scripts/local-narration.py --plan my-project.json --model tmp/piper-voices/pt_BR-faber-medium.onnx --out tmp/narration
```

The resulting `.narration.json` also contains its scene plan and can be opened as
a project. It preserves the selected duration unless measured speech/action
minimums require longer. Long durations with very short scripts still need more
source material for good pacing; the system does not invent events to fill time.

Dependencies and provenance:

- Mediabunny 1.66.0, unmodified, MPL-2.0. License and source location are provided
  in `public/third-party/` and copied into the lab build.
- Piper 1.8.0, separately installed, GPL-3.0.
- `pt_BR-faber-medium`: its model card identifies the training dataset as CC0;
  each narration package records the actual model SHA-256 and synthesis setting.
- Production models and environment geometry are original project code.

Primary documentation:

- https://mediabunny.dev/guide/writing-media-files
- https://mediabunny.dev/guide/supported-formats-and-codecs
- https://github.com/OHF-Voice/piper1-gpl
- https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD
- https://threejs.org/manual/pages/animation-system.html

## Verification boundary

The workflow first checks five ordinary inputs, random seeking, physical contacts
and a five-second render. It then verifies the normal video-download control with
a real browser encoder. Full narrated exports run only on an explicit
`render/production-*` branch after samples have been inspected. FFmpeg checks and,
when needed, converts the native browser file to H.264/yuv420p + AAC MP4.

Provider-contract tests use simulated Gemini responses. Live paid Gemini/TTS
generation is not part of CI. A rendered local example proves the shared engine
and export route for its catalog, not unrestricted AI direction or reference-level
artistic quality for every script. Main production is not deployed by this work.
