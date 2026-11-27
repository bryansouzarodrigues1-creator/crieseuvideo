import json, subprocess, threading, io
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops

d=Path('tmp/engineering-live')
payload={'code':(d/'generated.js').read_text(),'core':Path('node_modules/three/build/three.core.js').read_text(),'module':Path('node_modules/three/build/three.module.js').read_text(),'width':1080,'height':1920,'token':'a'*32,'type':'init'}
shell=(d/'sandbox.html').read_text()
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path!='/': self.send_error(404); return
        self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
        self.wfile.write(b'<!doctype html><style>html,body{margin:0;background:black}iframe{border:0;width:1080px;height:1920px;display:block}</style>')
server=ThreadingHTTPServer(('127.0.0.1',4872),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1080,'height':1920},device_scale_factor=1)
    page.goto('http://127.0.0.1:4872')
    # Block all external browser requests, including iframe self-navigation.
    page.route('**/*',lambda route:route.abort() if not route.request.url.startswith(('http://127.0.0.1:4872/','blob:','data:','about:')) else route.continue_())
    ready=page.evaluate("""({shell,payload})=>new Promise((resolve,reject)=>{
      const iframe=document.createElement('iframe');iframe.setAttribute('sandbox','allow-scripts');window.frame=iframe;
      const timeout=setTimeout(()=>reject(Error('sandbox init timeout')),120000);
      window.addEventListener('message',function on(ev){
        if(ev.source!==iframe.contentWindow||ev.origin!=='null'||ev.data?.token!==payload.token)return;
        if(ev.data.type==='boot')iframe.contentWindow.postMessage(payload,'*');
        if(ev.data.type==='ready'||ev.data.type==='error'){clearTimeout(timeout);window.removeEventListener('message',on);resolve(ev.data);}
      });iframe.srcdoc=shell;document.body.append(iframe);
    })""",{'shell':shell,'payload':payload})
    (d/'browser.json').write_text(json.dumps(ready,indent=2))
    assert ready.get('type')=='ready' and ready.get('deterministic'), 'Sandbox rejected scene or non-deterministic'
    duration=ready['duration'];count=round(duration*30)
    def frame(n):
        # Transfer frames using the production sandbox's frame protocol.
        result=page.evaluate("""({t,seq,token})=>new Promise((resolve,reject)=>{
          const iframe=window.frame;const timeout=setTimeout(()=>reject(Error('frame timeout')),20000);
          function on(ev){const m=ev.data;if(ev.source!==iframe.contentWindow||ev.origin!=='null'||m?.token!==token)return;
          if(m.type==='error'){clearTimeout(timeout);window.removeEventListener('message',on);reject(Error('sandbox runtime error'));return;}
          if(m.type!=='frame'||m.seq!==seq)return;clearTimeout(timeout);window.removeEventListener('message',on);
          const c=document.createElement('canvas');c.width=1080;c.height=1920;c.getContext('2d').drawImage(m.bitmap,0,0);m.bitmap.close();resolve(c.toDataURL('image/png').split(',')[1]);}
          window.addEventListener('message',on);iframe.contentWindow.postMessage({type:'frame',t,seq,token},'*');
        })""",{'t':n/30,'seq':n,'token':'a'*32})
        import base64
        return base64.b64decode(result)
    for n in [0,count//3,2*count//3,count-1]:
        a=frame(n);frame((n+count//2)%count);b=frame(n)
        (d/f'frame-{n:03}.png').write_bytes(a)
        diff=ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(b)).convert('RGB'))
        assert max(x[1] for x in diff.getextrema())<=3,'Full frame replay mismatch'
    out=d/'Bomba_Centrifuga_Gemini.mp4'
    proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-vcodec','png','-framerate','30','-i','-','-c:v','libx264','-preset','fast','-threads','3','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
    try:
        for n in range(count):
            proc.stdin.write(frame(n))
            if n%30==0: print(f'{n}/{count}',flush=True)
        proc.stdin.close();assert proc.wait()==0
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(out)]))
        s=info['streams'][0];assert (s['width'],s['height'],int(s['nb_read_frames']),s['r_frame_rate'])==(1080,1920,count,'30/1')
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
        (d/'video-validation.json').write_text(json.dumps(info,indent=2))
    except BaseException:
        if proc.poll() is None:proc.kill()
        proc.wait();out.unlink(missing_ok=True);raise
    finally:browser.close();server.shutdown()
