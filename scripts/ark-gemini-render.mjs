// Only rendering, PCM extraction and encoding. No hand-authored scene or soundtrack.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='tmp/ark-gemini';await mkdir(out,{recursive:true});
const proof=JSON.parse(await readFile(out+'/generation.json','utf8'));
const code=await readFile(out+'/gemini-scene.js');
assert.equal(proof.ok,true);assert.equal(proof.attempts,1);assert.equal(createHash('sha256').update(code).digest('hex'),proof.codeSHA256);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1150},acceptDownloads:true});
const errors=[];let providerRequests=0,stage='open';
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/generativelanguage.googleapis.com|ai.gateway.lovable.dev/.test(r.url()))providerRequests++;});
try{
 await page.goto('http://127.0.0.1:4198/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#code3d-import').waitFor({timeout:60000});await page.locator('#code3d-quality').selectOption('hd');
 await page.locator('#code3d-import').setInputFiles({name:'arca-gemini.js',mimeType:'text/javascript',buffer:code});
 await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:90000});
 assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));
 assert.equal(Number(await page.getByRole('slider',{name:'Linha do tempo'}).getAttribute('max')),20);
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
 const frame=page.frames().find(f=>f.url()==='about:srcdoc');assert.ok(frame);
 const seek=async(t,save=true)=>{t=Number(Math.max(0,Math.min(19.95,Math.round(t*20)/20)).toFixed(2));await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));await page.waitForTimeout(100);const image=await frame.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]);if(save)await writeFile(out+'/frame-'+t.toFixed(2)+'.png',Buffer.from(image,'base64'));return image;};
 stage='samples';const times=new Set([0,.2,19.95]);for(let t=1;t<20;t++)times.add(t);for(const s of proof.direction.shots)for(const t of [s.start-.05,s.start+.05,s.end-.05])times.add(t);for(const t of [...times].sort((a,b)=>a-b))await seek(t);
 const repeated=await seek(15,false);await seek(1,false);await seek(18,false);assert.equal(await seek(15,false),repeated);
 stage='soundtrack';
 const audio=await page.evaluate(async()=>{
  const iframe=document.querySelector('iframe'),match=/const TOKEN=("[a-f0-9]+")/.exec(iframe.srcdoc);if(!match)throw Error('Missing bridge token.');const token=JSON.parse(match[1]);
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{removeEventListener('message',listener);reject(Error('Soundtrack extraction timed out.'));},60000);
   function listener(e){if(e.source!==iframe.contentWindow||e.origin!=='null'||e.data?.token!==token)return;const d=e.data;if(d.type==='error'){clearTimeout(timer);removeEventListener('message',listener);reject(Error(d.message));return;}if(d.type!=='soundtrack'||d.seq!==12001)return;clearTimeout(timer);removeEventListener('message',listener);resolve({sampleRate:d.sampleRate,channels:d.channels.map(channel=>{const bytes=new Uint8Array(channel.buffer,channel.byteOffset,channel.byteLength);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);})});}
   addEventListener('message',listener);iframe.contentWindow.postMessage({type:'soundtrack',token,seq:12001},'*');
  });
 });
 assert.ok(audio.sampleRate>=8000&&audio.sampleRate<=48000);const pcm=audio.channels.map(b64=>Buffer.from(b64,'base64'));const frames=pcm[0].length/4;assert.equal(frames,audio.sampleRate*20);const channels=pcm.length;
 const wav=Buffer.alloc(44+frames*channels*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(channels,22);wav.writeUInt32LE(audio.sampleRate,24);wav.writeUInt32LE(audio.sampleRate*channels*2,28);wav.writeUInt16LE(channels*2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 let peak=0,energy=0,choirEnergy=0;for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const value=pcm[c].readFloatLE(i*4);assert.ok(Number.isFinite(value)&&Math.abs(value)<=1);peak=Math.max(peak,Math.abs(value));energy+=value*value;if(i>=audio.sampleRate*14)choirEnergy+=value*value;wav.writeInt16LE(Math.round(value*32767),44+(i*channels+c)*2);}
 assert.ok(peak>.01&&choirEnergy>.01,'The choir must have audible PCM.');await writeFile(out+'/gemini-soundtrack.wav',wav);
 stage='native export';console.log('NATIVE_EXPORT_START');const pending=page.waitForEvent('download',{timeout:600000});const failure=page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=alert]')).some(e=>/Exportação falhou/.test(e.textContent||'')),undefined,{timeout:600000}).then(()=>{throw Error('Native video export failed.');});await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();const d=await Promise.race([pending,failure]);assert.ok(d.suggestedFilename().endsWith('.mp4'));await d.saveAs(out+'/Arca_Gemini_Sem_Audio.mp4');console.log('NATIVE_EXPORT_DONE');
 assert.equal(providerRequests,0);assert.deepEqual(errors,[]);
 await writeFile(out+'/render.json',JSON.stringify({passed:true,duration:20,width:720,height:1280,fps:30,frames:600,providerRequests,actualGeminiCalls:proof.attempts,manualAnimationChanges:false,manualAudioChanges:false,codeSHA256:proof.codeSHA256,soundtrack:{sampleRate:audio.sampleRate,channels,frames,peak,rms:Math.sqrt(energy/(frames*channels)),choirRms:Math.sqrt(choirEnergy/(audio.sampleRate*6*channels))},errors,limitation:'Code imported through actual native player; production login is not exercised. Original audio and animation are synthesized by Gemini code inside the opaque iframe.'},null,2));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({stage,error:String(e),errors,visible:await page.locator('main').innerText().catch(()=> '')},null,2));throw e;}finally{await browser.close();}
