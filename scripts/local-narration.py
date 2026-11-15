"""Create reusable narration from an ordinary exported plan, using local Piper.

No API key or external generation service. Install requirements-render.txt and
download a separately licensed pt_BR-faber-medium voice before running.
"""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path
import wave

from piper import PiperVoice, SynthesisConfig


def align_words(text, chunks):
    """Map space-separated Piper phonemes to the original written word tokens.

    Timings come from model sample counts. If tokenization differs, keep the
    audio and explicitly omit exact word timing instead of fabricating it.
    """
    groups = []
    offset = 0.0
    for chunk in chunks:
        if chunk.phoneme_alignments is None:
            return None
        cursor = 0
        current = None
        for item in chunk.phoneme_alignments:
            start = offset + cursor / chunk.sample_rate
            cursor += int(item.num_samples)
            end = min(offset + len(chunk.audio_float_array) / chunk.sample_rate,
                      offset + cursor / chunk.sample_rate)
            symbol = item.phoneme
            boundary = symbol.isspace() or symbol in '^$.,!?;:'
            if boundary:
                if current is not None:
                    groups.append(current)
                    current = None
            else:
                if current is None:
                    current = [start, end]
                else:
                    current[1] = end
        if current is not None:
            groups.append(current)
        offset += len(chunk.audio_float_array) / chunk.sample_rate
    words = text.split()
    if len(groups) != len(words) or any(not math.isfinite(a) or not math.isfinite(b) or b <= a for a, b in groups):
        return None
    return [{'word': word, 'start': a, 'end': b} for word, (a, b) in zip(words, groups)]


def create_manifest(document, voice, model_digest):
    plan = document.get('plan', document)
    scenes = plan.get('scenes')
    if not isinstance(scenes, list) or not scenes or len(scenes) > 120:
        raise ValueError('A plan must contain 1 to 120 scenes.')
    clips = []
    for i, scene in enumerate(scenes):
        text = scene.get('text')
        if not isinstance(text, str) or not text.strip() or len(text) > 6000:
            raise ValueError('A scene has missing or excessive text.')
        chunks = list(voice.synthesize(text, SynthesisConfig(volume=.78, length_scale=1.2,
                          noise_scale=.5, noise_w_scale=.333), include_alignments=True))
        if not chunks:
            raise ValueError('Local speech synthesis produced no audio.')
        sample_rate = chunks[0].sample_rate
        if any(c.sample_rate != sample_rate for c in chunks):
            raise ValueError('Audio chunks have mismatched sample rates.')
        stream = io.BytesIO()
        with wave.open(stream, 'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sample_rate)
            for chunk in chunks:
                wav.writeframes(chunk.audio_int16_bytes)
        duration = sum(len(c.audio_float_array) for c in chunks) / sample_rate
        timings = align_words(text, chunks)
        clips.append({'sourceId': scene.get('sourceId', f's{i + 1}'), 'text': text,
                      'duration': duration, 'start': timings[0]['start'] if timings else 0,
                      'end': timings[-1]['end'] if timings else duration,
                      'timings': timings, 'alignment': 'piper-phoneme-samples' if timings else 'unavailable',
                      'wavBase64': base64.b64encode(stream.getvalue()).decode('ascii')})
    return {'version': 1, 'provider': 'piper-local', 'language': 'pt-BR',
            'model': 'pt_BR-faber-medium', 'modelSha256': model_digest, 'lengthScale': 1.2,
            'script': ' '.join(s['text'] for s in scenes), 'plan': plan, 'clips': clips}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--plan-dir', type=Path)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    if bool(args.plan) == bool(args.plan_dir):
        parser.error('Choose --plan or --plan-dir.')
    files = [args.plan] if args.plan else sorted(args.plan_dir.glob('*.plan.json'))
    if not files:
        raise ValueError('No exported scene plan was found.')
    args.out.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(args.model.read_bytes()).hexdigest()
    voice = PiperVoice.load(str(args.model), include_alignments=True)
    for file in files:
        document = json.loads(file.read_text())
        result = create_manifest(document, voice, digest)
        filename = file.name.removesuffix('.plan.json').removesuffix('.json') + '.narration.json'
        destination = args.out / filename
        if destination.exists():
            raise FileExistsError(f'Refusing to replace {destination}.')
        destination.write_text(json.dumps(result, ensure_ascii=False))
        print(json.dumps({'file': str(destination), 'clips': len(result['clips']),
                          'seconds': round(sum(c['duration'] for c in result['clips']), 3),
                          'wordTimings': all(c['timings'] is not None for c in result['clips']),
                          'provider': 'piper-local', 'paidCalls': 0}), flush=True)


if __name__ == '__main__':
    main()
