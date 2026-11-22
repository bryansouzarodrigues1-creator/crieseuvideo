"""Common action labels and original procedural sound, applied equally to all arms.

Run only after the real browser exports exist. No visual scene repair, frame
substitution or AI calls: labels are editorial action timings, not speech sync.
"""
from pathlib import Path
import argparse
import json
import math
import subprocess
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ARMS = [
    ('motion2d', '01_Motion_2D_12s.mp4', '01 · MOTION 2D', 'Canvas 2D · formas e transições'),
    ('toon3d', '02_Toon_3D_Classico_12s.mp4', '02 · TOON 3D CLÁSSICO', 'Three.js · apresentador e quadro'),
    ('sceneprogram', '03_SceneProgram_JSON_12s.mp4', '03 · SCENEPROGRAM', 'JSON interpretado · cena 3D'),
    ('code3d', '04_Codigo_3D_12s.mp4', '04 · CÓDIGO 3D', 'Three.js · programa importado'),
    ('htmlsvg', '05_HTML_SVG_GSAP_12s.mp4', '05 · HTML + SVG + GSAP', 'Ilustração vetorial · linha do tempo'),
]
CAPTIONS = ['A casa está\nsem energia.', 'As peças do painel\nse encaixam.', 'A bateria conecta.\nA luz acende!']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def soundtrack(path):
    sr = 48000
    audio = np.zeros((sr * 12, 2), dtype=np.float64)

    def tone(start, duration, hz, gain, pan=0, sweep=0):
        n = int(sr * duration)
        t = np.arange(n) / sr
        env = (1 - np.exp(-t * 75)) * np.exp(-t * 5 / duration)
        signal = gain * env * np.sin(2 * np.pi * (hz * t + .5 * sweep * t * t))
        signal += gain * .12 * env * np.sin(2 * np.pi * hz * 2 * t)
        first = int(sr * start)
        count = min(n, len(audio) - first)
        audio[first:first+count, 0] += signal[:count] * math.sqrt((1-pan)/2)
        audio[first:first+count, 1] += signal[:count] * math.sqrt((1+pan)/2)

    tone(.3, .55, 196, .12)
    for i in range(6):
        tone(4.85 + i * .33, .22, 310 + i * 37, .21, -.4 + i * .16)
    tone(7.48, .35, 740, .10)
    tone(8.78, .18, 510, .20)
    for hz in (261.63, 329.63, 392):
        tone(10.13, 1.5, hz, .16)
    audio[-int(sr*.12):] *= np.linspace(1, 0, int(sr*.12))[:, None]
    peak = float(np.abs(audio).max())
    if peak > .65:
        audio *= .65 / peak
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((audio * 32767).astype('<i2').tobytes())
    return {'sampleRate': sr, 'channels': 2, 'seconds': 12, 'peakDBFS': 20 * math.log10(max(float(np.abs(audio).max()), 1e-10)), 'narration': False}


def card(path, title, subtitle, phase):
    im = Image.new('RGBA', (720, 1280))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((44, 68, 676, 177), radius=22, fill=(13, 30, 43, 241))
    d.rounded_rectangle((44, 948, 676, 1112), radius=22, fill=(13, 30, 43, 239))
    d.text((66, 83), title, font=ImageFont.truetype(BOLD, 28), fill='#fff1ce')
    d.text((66, 130), subtitle, font=ImageFont.truetype(FONT, 20), fill='#b9d6de')
    d.multiline_text((360, 972), CAPTIONS[phase], font=ImageFont.truetype(BOLD, 34), fill='#ffffff', anchor='ma', align='center', spacing=12)
    for i in range(3):
        x = 58 + i * 207
        d.rounded_rectangle((x, 1136, x + 188, 1143), radius=3, fill='#f1bd65' if i == phase else '#a6b2b1')
    d.text((360, 1180), 'MESMA CENA · 12 s · SEM NARRAÇÃO', font=ImageFont.truetype(BOLD, 17), fill='#344c57', anchor='mm', stroke_width=3, stroke_fill='#dfe9dc')
    im.save(path)


def probe(path):
    value = subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_format', '-show_streams', '-of', 'json', str(path)], text=True)
    obj = json.loads(value)
    v = next(s for s in obj['streams'] if s['codec_type'] == 'video')
    a = next(s for s in obj['streams'] if s['codec_type'] == 'audio')
    assert (v['width'], v['height'], v['avg_frame_rate'], int(v['nb_read_frames'])) == (720, 1280, '30/1', 360)
    assert abs(float(obj['format']['duration']) - 12) < .06
    return {'name': path.name, 'width': v['width'], 'height': v['height'], 'fps': v['avg_frame_rate'], 'frames': int(v['nb_read_frames']), 'seconds': float(obj['format']['duration']), 'video': v['codec_name'], 'audio': a['codec_name'], 'bytes': path.stat().st_size}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    work = args.output / 'mastering'
    work.mkdir(exist_ok=True)
    report = {'authorship': 'Programmed renderer comparison; no new Gemini or TTS calls', 'sound': soundtrack(work/'same-sound.wav'), 'results': []}
    for engine, filename, title, subtitle in ARMS:
        native = args.source / (engine + '-native.mp4')
        assert native.is_file(), f'Missing actual native export: {native}'
        overlays = []
        for phase in range(3):
            overlay = work / f'{engine}-{phase}.png'
            card(overlay, title, subtitle, phase)
            overlays.append(overlay)
        dst = args.output / filename
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(native), '-i', str(work/'same-sound.wav')]
        for overlay in overlays:
            cmd += ['-i', str(overlay)]
        filters = "[0:v][2:v]overlay=0:0:enable='lt(t,4)'[a];[a][3:v]overlay=0:0:enable='gte(t,4)*lt(t,8)'[b];[b][4:v]overlay=0:0:enable='gte(t,8)',format=yuv420p[v]"
        cmd += ['-filter_complex', filters, '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-r', '30', '-frames:v', '360', '-c:a', 'aac', '-b:a', '160k', '-t', '12', '-movflags', '+faststart', str(dst)]
        print('MASTER ' + filename, flush=True)
        run(cmd)
        report['results'].append(probe(dst))
    concat = work/'concat.txt'
    concat.write_text(''.join("file '" + str((args.output / filename).resolve()) + "'\n" for _, filename, _, _ in ARMS))
    combined = args.output/'Comparacao_5_Sistemas_60s.mp4'
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-t', '60', '-movflags', '+faststart', str(combined)])
    report['combined'] = {'name': combined.name, 'bytes': combined.stat().st_size}
    (args.output/'mastering-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
