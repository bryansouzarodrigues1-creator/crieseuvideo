"""Optional desktop experiment: generate an importable PT-BR WAV locally.
No paid inference, server calls or project secrets. First run downloads model
assets; install dependencies separately. Not bundled into the mobile web app.
"""
import argparse
from pathlib import Path

VOICES = ("pm_alex", "pm_santa", "pf_dora")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path, help="UTF-8 text file")
    parser.add_argument("output", type=Path, help="New .wav file")
    parser.add_argument("--voice", choices=VOICES, default="pm_alex")
    parser.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args()
    if not 0.75 <= args.speed <= 1.25:
        parser.error("Speed must be between 0.75 and 1.25.")
    if args.output.suffix.lower() != ".wav" or args.output.exists():
        parser.error("Choose a new .wav output file.")
    text = args.script.read_text(encoding="utf-8").strip()
    if not text or len(text) > 5000:
        parser.error("Use 1 to 5000 characters.")
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="p", repo_id="hexgrad/Kokoro-82M")
    chunks = []
    for _, _, audio in pipeline(text, voice=args.voice, speed=args.speed):
        if audio is not None:
            chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))
    if not chunks:
        raise RuntimeError("The local model returned no audio.")
    samples = np.concatenate(chunks)
    if not samples.size or not np.isfinite(samples).all():
        raise RuntimeError("The local model returned invalid audio.")
    sf.write(str(args.output), samples, 24000, subtype="PCM_16")
    print(f"{args.output}: {len(samples)/24000:.2f}s, 24 kHz mono")


if __name__ == "__main__":
    main()
