"""Verify native segments, join them and mux supplied voice with short captions.

python scripts/quintal-assemble.py --native-dir NATIVE --voice VOICE.mp3
    --captions CAPTIONS.ass --output FINAL.mp4 [--replacement-dir NATIVE_PATCH]
No audio, account data or generated media are embedded in the public source.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--native-dir", type=Path, required=True)
parser.add_argument("--replacement-dir", type=Path)
parser.add_argument("--voice", type=Path, required=True)
parser.add_argument("--captions", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
work = args.output.parent.parent / "production" / "assembly"
work.mkdir(parents=True, exist_ok=True)


def probe(p):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)]))


def sha(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1024*1024), b""):
            h.update(b)
    return h.hexdigest()


sources = {}
evidence = []
for folder, replacement in [(args.native_dir, False), (args.replacement_dir, True)]:
    if folder is None:
        continue
    reports = sorted(folder.rglob("report.json"))
    assert reports, f"Missing native report in {folder}"
    for report_path in reports:
        report = json.loads(report_path.read_text())
        assert report["passed"] and not report["preview"]
        assert (report["width"], report["height"], report["fps"]) == (720, 1280, 30)
        assert report["providerRequests"] == report["generationRequests"] == 0
        assert not report["errors"]
        evidence.append({"report": str(report_path), "commit": report["commit"],
                         "sceneSHA256": report["sceneSHA256"], "replacement": replacement})
        for item in report["exports"]:
            path = report_path.parent / (item["name"] + ".mp4")
            i = int(item["name"].rsplit("_", 1)[1])
            assert path.is_file()
            if not replacement:
                assert i not in sources, f"Repeated source {i}"
            sources[i] = {"path": path, "duration": item["duration"], "frames": item["frames"],
                          "offset": item["offset"], "replacement": replacement}

assert sorted(sources) == list(range(24)), f"Expected all 24 native segments, found {sorted(sources)}"
native = []
for i, entry in sorted(sources.items()):
    meta = probe(entry["path"])
    video = next(s for s in meta["streams"] if s["codec_type"] == "video")
    assert (video["codec_name"], video["width"], video["height"], video["r_frame_rate"]) == ("h264", 720, 1280, "30/1")
    expected = 8 if i == 23 else 10
    assert entry["offset"] == i*10 and entry["duration"] == expected
    assert int(video["nb_frames"]) == expected*30
    native.append({"index": i, "path": str(entry["path"]), "frames": int(video["nb_frames"]),
                   "sha256": sha(entry["path"]), "replacement": entry["replacement"]})

listing = work / "native-concat.txt"
listing.write_text("\n".join("file '"+str(x["path"])+"'" for x in native) + "\n")
silent = work / "native-silent.mp4"
with (work/"concat.log").open("w") as log:
    subprocess.run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(silent)],
                   check=True, stdout=subprocess.DEVNULL, stderr=log)

first = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(args.voice), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
(work/"voice-loudness.log").write_text(first.stderr)
loud = json.loads(re.search(r'\{\s*"input_i".*?\}', first.stderr, re.S)[0])
af = ("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I="+loud["input_i"]+
      ":measured_TP="+loud["input_tp"]+":measured_LRA="+loud["input_lra"]+
      ":measured_thresh="+loud["input_thresh"]+":offset="+loud["target_offset"]+
      ":linear=true:print_format=json,afade=t=out:st=231.70:d=0.06,apad=pad_dur=1")
filtergraph = "[0:v]ass="+str(args.captions)+"[v];[1:a]"+af+"[a]"
cmd = ["ffmpeg", "-hide_banner", "-y", "-i", str(silent), "-i", str(args.voice),
       "-filter_complex", filtergraph, "-map", "[v]", "-map", "[a]", "-t", "231.8", "-r", "30",
       "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", str(args.output)]
print("ASSEMBLING", args.output, flush=True)
with (work/"final-encode.log").open("w") as log:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=log)

metadata = probe(args.output)
v = next(s for s in metadata["streams"] if s["codec_type"] == "video")
a = next(s for s in metadata["streams"] if s["codec_type"] == "audio")
assert (v["width"], v["height"], v["r_frame_rate"], v["pix_fmt"]) == (720,1280,"30/1","yuv420p")
assert int(v["nb_frames"]) == 6954
assert a["codec_name"] == "aac"
assert abs(float(metadata["format"]["duration"])-231.8) < .1
report = {"output": str(args.output), "duration": metadata["format"]["duration"], "frames": v["nb_frames"],
          "nativeResolution": [720,1280], "deliveredResolution": [720,1280], "fps": 30,
          "sourceVoice": args.voice.name, "voiceSHA256": sha(args.voice), "captionSHA256": sha(args.captions),
          "native": native, "nativeEvidence": evidence, "sha256": sha(args.output), "bytes": args.output.stat().st_size,
          "notes": "Actual native Code 3D exports, separately edited with supplied voice and ASR-based captions. Last native segment's unused tail is trimmed, preserving the complete recorded narration. No upscale or autonomous-generation claim."}
(work/"final-metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
(work/"assembly-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({k:report[k] for k in ["output","duration","frames","nativeResolution","fps","bytes","sha256"]}, ensure_ascii=False))
