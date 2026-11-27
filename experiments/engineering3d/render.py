import json, subprocess, sys, io
from PIL import Image, ImageChops, ImageStat
from pathlib import Path
from playwright.sync_api import sync_playwright

source, three, output = map(Path, sys.argv[1:])
output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox'])
    try:
        page = browser.new_page(viewport={'width':1080,'height':1920},device_scale_factor=1)
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/three.min.js',lambda route:route.fulfill(path=three.resolve(),content_type='application/javascript'))
        page.set_content(source.read_text(encoding='utf-8'),wait_until='load',timeout=60000)
        page.wait_for_function('window.studioReady || window.studioError', timeout=60000)
        assert not page.evaluate('window.studioError || null'),page.evaluate('window.studioError')
        assert page.evaluate('THREE.REVISION')=='128'
        page.evaluate("document.body.classList.add('capture')")
        assert page.evaluate('window.duration')==18
        stage=page.locator('#stage')
        assert stage.bounding_box()['width']==1080 and stage.bounding_box()['height']==1920
        def snap(n):
            page.evaluate('(n)=>{window.renderFrame(n);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}',n)
            return stage.screenshot(type='png',animations='disabled')
        def canvas_pixels():
            import base64
            data=page.evaluate("document.querySelector('canvas').toDataURL('image/png').split(',')[1]")
            return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB')
        snap(0)
        snap(0)
        replay=[]
        for n in [0,135,270,405,539]:
            a=snap(n)
            ca=canvas_pixels()
            snap((n+211)%540)
            b=snap(n)
            cb=canvas_pixels()
            (output/f'frame-{n:03}.png').write_bytes(a)
            diff=ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))
            maxdiff=max(v[1] for v in diff.getextrema())
            canvasdiff=ImageChops.difference(ca,cb)
            canvasmax=max(v[1] for v in canvasdiff.getextrema())
            # Composited Chromium screenshots can differ at a handful of HUD antialias pixels.
            # Keep WebGL pixels independently checked; never tolerate large or widespread changes.
            channels=diff.split()
            peak=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
            changed=sum(peak.histogram()[4:])
            fraction=changed/(1080*1920)
            replay.append({'frame':n,'maxPixelDiff':maxdiff,'canvasMaxDiff':canvasmax,'changedPixelsAbove3':changed,'changedFraction':fraction,'meanRGBDiff':ImageStat.Stat(diff).mean})
            (output/'replay.json').write_text(json.dumps(replay,indent=2))
            if canvasmax>3 or maxdiff>32 or fraction>0.00001:
                (output/f'replay-{n:03}.png').write_bytes(b)
                raise AssertionError(f'Non deterministic seek: {n}, pixel difference {maxdiff}, canvas {canvasmax}, changed pixels {changed}')
        assert not errors,errors
        tmp=output/'render-incomplete.mp4'
        cmd=['ffmpeg','-v','error','-y','-f','image2pipe','-vcodec','png','-framerate','30','-i','-','-c:v','libx264','-threads','3','-preset','fast','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',str(tmp)]
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
        try:
            for n in range(540):
                proc.stdin.write(snap(n))
                if n%30==0: print(f'{n}/540',flush=True)
            proc.stdin.close()
            assert proc.wait()==0
            assert not errors,errors
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(tmp)]))
            s=info['streams'][0]
            assert (s['width'],s['height'],int(s['nb_read_frames']),s['r_frame_rate'])==(1080,1920,540,'30/1'),s
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(tmp),'-f','null','-'],check=True)
            tmp.rename(output/'Casa_Forno_Engineering3D.mp4')
            (output/'validation.json').write_text(json.dumps(info,indent=2))
        except BaseException:
            if proc.poll() is None: proc.kill()
            proc.wait()
            tmp.unlink(missing_ok=True)
            raise
    finally:
        browser.close()
