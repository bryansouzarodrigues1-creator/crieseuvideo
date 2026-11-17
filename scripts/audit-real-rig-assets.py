#!/usr/bin/env python3
"""Inspect external CC0 skinned GLB without trusting its rendered appearance.
Temporary QA only; never automatically registers it as a production model.
"""
import argparse, hashlib, json, pathlib, struct

def audit(filepath, gitsha):
    p = pathlib.Path(filepath)
    data = p.read_bytes()
    actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if actual != gitsha:
        raise SystemExit(f'Git blob SHA mismatch: got {actual} expected {gitsha}')
    magic, version, total = struct.unpack_from('<III', data, 0)
    if magic != 0x46546c67 or version != 2 or total != len(data):
        raise SystemExit('Invalid GLB header')
    length, typ = struct.unpack_from('<II', data, 12)
    if typ != 0x4E4F534A or length > 2000000:
        raise SystemExit('Unexpected GLB JSON payload')
    j = json.loads(data[20:20+length])
    clips = [a.get('name','') for a in j.get('animations', [])]
    nodes = j.get('nodes', [])
    skins = j.get('skins', [])
    joints = [nodes[n].get('name','') for skin in skins for n in skin.get('joints', [])]
    extra = [x.get('uri') for x in j.get('images', []) if x.get('uri')]
    report = dict(
        model=p.name, bytes=len(data), git_blob_sha=actual, clip_count=len(clips),
        clips=clips, skin_count=len(skins), joint_count=len(joints),
        palm_candidates=[n for n in joints if any(word in n.lower() for word in ('hand', 'palm', 'wrist'))],
        clip_target_node_ids=len(set(ch['target']['node'] for a in j.get('animations', []) for ch in a.get('channels',[]) if 'node' in ch.get('target',{}))),
        image_uris=extra,
        triangles_estimate=sum((j['accessors'][prim['indices']]['count'] // 3 if 'indices' in prim else j['accessors'][prim['attributes']['POSITION']]['count'] // 3) for mesh in j.get('meshes',[]) for prim in mesh.get('primitives',[])),
    )
    if not skins or not clips or not report['palm_candidates']:
        raise SystemExit('Asset is not a rigged, animated humanoid with usable hand bones: ' + str(report))
    if len(data) > 16_000_000:
        raise SystemExit('Model exceeds existing SceneProgram asset transfer budget')
    return report

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('files', nargs='+', help='path:expected_git_sha')
    args = ap.parse_args()
    result=[audit(*pair.split(':',1)) for pair in args.files]
    pathlib.Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(args.out).write_text(json.dumps(result,indent=2,ensure_ascii=False))
    print(json.dumps(result,indent=2,ensure_ascii=False))
