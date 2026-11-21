"""Build short captions from measured Portuguese ASR and the approved script.

Usage: python scripts/quintal-captions.py transcript.json narration.txt output_dir
Keep the voice and transcript outside the public source. Changed spellings use
the original script; multiword ASR substitutions retain their measured span and
are explicitly marked in the timing report, rather than called exact words.
"""
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

asr_path, script_path, output_path = map(Path, sys.argv[1:4])
out = output_path
out.mkdir(parents=True, exist_ok=True)
data = json.loads(asr_path.read_text())
script = re.sub(r"\[[^\]]*\]", "", script_path.read_text()).strip()
canonical = script.split()


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if c.isalnum() and not unicodedata.combining(c))


spoken = []
for segment in data["transcription"]:
    text = segment["text"].strip()
    if not norm(text) or text.startswith("[_"):
        continue
    start = segment["offsets"]["from"] / 1000
    end = segment["offsets"]["to"] / 1000
    tokens = text.split()
    for i, token in enumerate(tokens):
        spoken.append({"text": token, "start": start + (end - start) * i / len(tokens),
                       "end": start + (end - start) * (i + 1) / len(tokens)})

matcher = difflib.SequenceMatcher(None, list(map(norm, canonical)),
                                 [norm(x["text"]) for x in spoken], autojunk=False)
words = [None] * len(canonical)
corrections = []
exact = 0
for op, a0, a1, b0, b1 in matcher.get_opcodes():
    if op == "equal":
        exact += a1 - a0
        for a, b in zip(range(a0, a1), range(b0, b1)):
            words[a] = {"text": canonical[a], "start": spoken[b]["start"],
                        "end": spoken[b]["end"], "timing": "recognized_word"}
    elif a1 > a0:
        start = spoken[b0]["start"] if b0 < len(spoken) else spoken[-1]["end"]
        end = spoken[b1 - 1]["end"] if b1 > b0 else start
        if b1 == b0:
            start = spoken[b0 - 1]["end"] if b0 else 0
            end = spoken[b0]["start"] if b0 < len(spoken) else start + .1
        weights = [max(1, len(norm(w))) for w in canonical[a0:a1]]
        total = sum(weights)
        consumed = 0
        for a, weight in zip(range(a0, a1), weights):
            kind = "recognized_word_script_spelling" if a1-a0 == b1-b0 == 1 else "interpolated_within_recognized_span"
            words[a] = {"text": canonical[a], "start": start + (end-start)*consumed/total,
                        "end": start + (end-start)*(consumed+weight)/total, "timing": kind}
            consumed += weight
        corrections.append({"op": op, "script": " ".join(canonical[a0:a1]),
                            "recognized": " ".join(x["text"] for x in spoken[b0:b1]),
                            "start": start, "end": end})

assert all(w is not None for w in words)
assert exact / len(canonical) > .87, "ASR differs too much from the script for automatic spelling correction"
for i, w in enumerate(words):
    w["start"] = round(max(0, w["start"]), 3)
    w["end"] = round(max(w["start"], w["end"]), 3)
    assert w["end"] <= 232.0
    if i:
        assert w["start"] >= words[i-1]["start"] - .02

groups, current = [], []
for w in words:
    current.append(w)
    if len(current) >= 3 or re.search(r"[.!?]$", w["text"]):
        groups.append(current)
        current = []
if current:
    groups.append(current)


def stamp(t, ass=False):
    n = round(t * (100 if ass else 1000))
    unit = 100 if ass else 1000
    sec, fraction = divmod(n, unit)
    minute, second = divmod(sec, 60)
    hour, minute = divmod(minute, 60)
    return (f"{hour}:{minute:02}:{second:02}.{fraction:02}" if ass else
            f"{hour:02}:{minute:02}:{second:02},{fraction:03}")


srt = []
events = []
cue_info = []
for i, g in enumerate(groups):
    start = g[0]["start"]
    following = groups[i+1][0]["start"] if i+1 < len(groups) else 231.76
    end = min(following, max(g[-1]["end"], start + .25))
    if end <= start:
        end = start + .05
    text = " ".join(x["text"] for x in g)
    # Only one or two lines, within the native 720 px caption area.
    if len(text) > 29 and len(g) > 1:
        k = min(range(1, len(g)), key=lambda j: abs(len(" ".join(x["text"] for x in g[:j])) - len(text)/2))
        text = " ".join(x["text"] for x in g[:k]) + "\n" + " ".join(x["text"] for x in g[k:])
    srt.append(f"{i+1}\n{stamp(start)} --> {stamp(end)}\n{text}\n")
    styled = text.replace("\n", "\\N")
    for key in ["QUINTAL", "água", "cisterna", "horta", "composteira", "aquaponia", "galinheiro", "baterias", "backup"]:
        styled = re.sub(r"\b"+re.escape(key)+r"\b", lambda m: r"{\c&H0078D1F3&}"+m[0]+r"{\c&H00FFFFFF&}", styled, flags=re.I)
    events.append(f"Dialogue: 0,{stamp(start,True)},{stamp(end,True)},Caption,,0,0,0,,{{\\fad(50,50)}}{styled}")
    cue_info.append({"start": start, "end": round(end, 3), "text": text})

header = """[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,42,&H00FFFFFF,&H00FFFFFF,&H00223A2A,&H80000000,-1,0,0,0,100,100,0,0,1,2.7,1.2,2,45,45,226,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
(out/"Quintal_Autossustentavel_Legendas.srt").write_text("\n".join(srt))
(out/"Quintal_Autossustentavel_Legendas.ass").write_text(header + "\n".join(events) + "\n")
(out/"quintal-word-timings.json").write_text(json.dumps(words, ensure_ascii=False, indent=2))
paragraphs = script.split("\n\n")
paragraph_times = []
offset = 0
for paragraph in paragraphs:
    n = len(paragraph.split())
    paragraph_times.append({"text": paragraph, "start": words[offset]["start"], "end": words[offset+n-1]["end"]})
    offset += n
summary = {"recognizer": "whisper.cpp v1.9.5, multilingual base-q5_1, Portuguese, token timestamps", "scriptWords": len(canonical),
           "recognizedWords": len(spoken), "exactNormalizedMatches": exact, "exactMatchFraction": round(exact/len(canonical), 4),
           "scriptCorrections": corrections, "cues": len(groups), "paragraphs": paragraph_times,
           "note": "Known script corrects ASR spellings. Multiword replacements are interpolated only inside the measured ASR phrase span and are labelled in the word data; no claim of frame-exact timing for every word."}
(out/"quintal-caption-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({k:v for k,v in summary.items() if k not in ["scriptCorrections", "paragraphs"]}, ensure_ascii=False))
print(json.dumps([{"start":p["start"], "end":p["end"], "begin":p["text"][:62]} for p in paragraph_times], ensure_ascii=False))
