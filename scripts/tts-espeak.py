"""Stand-in narrator for tests and CI: one WAV per sentence with espeak-ng (apt install espeak-ng).

Reads a JSON list of sentences on stdin, writes <out>/s1.wav, s2.wav ... and prints [{file, duration}].
It is a robotic voice used ONLY so the render pipeline can be checked end to end without any paid service;
production narration comes from Gemini TTS or ElevenLabs through /api/ai/narrate.
"""
import ctypes, json, sys, wave
from pathlib import Path

lib = ctypes.CDLL('libespeak-ng.so.1')
rate_hz = lib.espeak_Initialize(2, 0, None, 0)  # synchronous playback = we collect the samples
CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
pcm = bytearray()
def collect(wave_ptr, count, _events):
    if wave_ptr and count > 0: pcm.extend(ctypes.string_at(wave_ptr, count * 2))
    return 0
callback = CALLBACK(collect); lib.espeak_SetSynthCallback(callback)

def say(text, voice=b'pt-br', speed=150, pitch=45):
    pcm.clear(); lib.espeak_SetVoiceByName(voice); lib.espeak_SetParameter(1, speed, 0); lib.espeak_SetParameter(3, pitch, 0)
    data = text.encode('utf-8'); lib.espeak_Synth(data, len(data) + 1, 0, 1, 0, 1 << 12 | 1, None, None); lib.espeak_Synchronize()
    return bytes(pcm)

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
speed = int(sys.argv[2]) if len(sys.argv) > 2 else 150
result = []
for i, sentence in enumerate(json.load(sys.stdin), 1):
    data = say(sentence, speed=speed); path = out / f's{i}.wav'
    with wave.open(str(path), 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate_hz); w.writeframes(data)
    result.append({'file': str(path), 'duration': len(data) / 2 / rate_hz})
print(json.dumps(result))
