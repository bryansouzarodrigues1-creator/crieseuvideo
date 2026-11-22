# Controlled renderer comparison

The user requested one animation from each existing path to decide what to keep,
retire or improve. The shared brief is a 12-second portrait solar-panel assembly
and a house receiving power, in three four-second beats.

This is a manually authored, controlled demonstration of renderers, **not** five
autonomous Gemini generations and not a model-quality benchmark. No new model
or TTS requests are made. No production renderer, validator or default changes.

The read-only harness imports the real Motion 2D, Toon3D and SceneProgram3D
implementations. The 2D/Toon plan has no speech text because the comparison has
no spoken audio; its native scene clock is mapped to the shared 12-second score.
Toon retains its presenter and board. The 2D sequence is limited to the current
primitive/layout/animation vocabulary; it is not replaced by custom SVG.

Code 3D imports its hand-authored createScene program into the actual opaque
sandbox via the existing app UI, including replay validation and native export.
The final path is a separately authored SVG with an actual paused GSAP 3.12.5
timeline sampled at absolute time, corresponding to the other chat's approach.

For comparable files, the harness uses the existing fixed-frame encoder for
Motion 2D, Toon, JSON and SVG. This does not certify their original export UIs.
Common action captions and sound effects are applied after export to all arms.
These captions are scheduled action labels, not measured speech alignment.

The browser report records source identity, errors, model-request count and
sample replay equality. Export success is not visual-quality approval. Inspect
the actual frames and MP4s for part visibility, framing, actor anatomy, continuity
and whether the connection and final light are understandable without text.

The first browser run exported Code 3D, but the app router returned a 404 for
the other four fixture HTML requests. They are not renderer failures. The
fixture now has a separately bundled static host, while Code 3D still uses the
original app. The intermediate two-Vite setup served HTML but never initialized
the fixture and is retained as a harness failure, not a renderer outcome. Review
of the first real Code 3D frames also found an over-tight assembly
close-up and front-facing support legs. The authored fixture's camera now fits
the elevated pieces before closing in, and both 3D fixtures put legs behind the
panel. These are documented manual fixture revisions, not Gemini output repairs
or production-engine changes.
