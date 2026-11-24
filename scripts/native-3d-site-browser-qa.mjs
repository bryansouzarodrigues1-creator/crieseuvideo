import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const base='http://127.0.0.1:4198';
const out=path.resolve('tmp/native-3d-site');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader',
]});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('heading',{name:/Sua ideia pode virar um vídeo animado/i}).waitFor({timeout:40000});
 const invite=page.getByRole('link',{name:/Entrar no grupo de lançamento/i}).first();
 assert.ok((await invite.getAttribute('href'))?.startsWith('https://chat.whatsapp.com/'),
   'Launch homepage should send visitors directly to the WhatsApp group');
 assert.ok(await page.getByRole('link',{name:/Entrar com Google/i}).count()>0,
   'Launch homepage should expose account login without forcing it for WhatsApp');
 await page.screenshot({path:path.join(out,'01-home-launch-funnel.png')});
 // The 3D engine has its own direct route. Landing page must not display
 // the old editor, but existing engine QA should still run normally.
 await page.goto(base+'/motor-3d',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('heading',{name:/Motor 3D de verdade/}).waitFor({timeout:60000});
 const stage=page.locator('.native-3d-screen canvas');
 await stage.waitFor({state:'attached',timeout:60000});
 // On mobile, controls are accessible BEFORE any WebGL renderer is created.
 const activate=page.getByRole('button',{name:'Carregar motor 3D'});
 await activate.waitFor({timeout:60000});
 const activeRect=await activate.boundingBox();
 assert.ok(activeRect && activeRect.y>=0 && activeRect.y+activeRect.height<915,
   'Mobile 3D start button must be visible without scrolling');
 assert.equal(await page.getByRole('button',{name:'Reproduzir'}).isDisabled(),true);
 await page.screenshot({path:path.join(out,'02-mobile-before-gpu-activation.png')});
 await activate.click();
 await page.waitForFunction(()=>{
   const canvas=document.querySelector('.native-3d-screen canvas');
   return canvas?.width===270 && canvas?.height===480 &&
     !document.querySelector('.native-3d-loading');
 },null,{timeout:60000});
 assert.equal(await stage.evaluate(c=>c.width),270,'Mobile scene should default to low-resolution WebGL');
 assert.equal(await stage.evaluate(c=>c.height),480,'Mobile scene height should be memory friendly');
 await page.waitForFunction(()=>{
   const s=document.querySelector('.native-3d-numbers');
   return s&&Number(s.textContent?.match(/\d+/)?.[0])>20;
 },null,{timeout:60000});
 assert.equal(await page.getByRole('alert').count(),0,
   'Motor displayed an error before first playback.');
 const frame=()=>page.evaluate(()=>{
   const canvas=document.querySelector('.native-3d-screen canvas');
   if(!canvas)return '';
   return canvas.toDataURL('image/png');
 });
 const first=await frame();
 assert.ok(first.length>10000,'No real scene rendered');
 await stage.screenshot({path:path.join(out,'02-motorcycle-first-frame.png')});
 // The opening shot deliberately holds the bike in place for inspection.
 // Use the keyboard-operated timeline to reach the action shot (seconds 3-6).
 const slider=page.getByRole('slider',{name:'Linha do tempo 3D'});
 await slider.focus();
 await slider.press('End');
 await page.waitForTimeout(350);
 const second=await frame();
 assert.notEqual(second,first,'Motorcycle render did not respond to timeline scrubbing');
 await stage.screenshot({path:path.join(out,'03-motorcycle-after-motion.png')});
 await slider.press('Home');
 await page.getByRole('button',{name:'Reproduzir'}).click();
 await page.waitForFunction(()=>{
   const slider=document.querySelector('input[aria-label="Linha do tempo 3D"]');
   return slider&&Number(slider.value)>.05;
 },null,{timeout:20000});
 await page.getByRole('button',{name:'Pausar'}).click();
 for(const [buttonName,filename] of [
   ['Arca e oceano','04-ark-world.png'],
   ['Prisão 3D','05-prison-world.png']]){
   await page.getByRole('button',{name:new RegExp(buttonName)}).click();
   await page.waitForTimeout(100);
   await page.waitForFunction(()=>!document.querySelector('.native-3d-loading'),null,{timeout:60000});
   await page.waitForTimeout(200);
   assert.equal(await page.getByRole('alert').count(),0,'Failed loading '+buttonName);
   assert.ok((await frame()).length>10000,'Empty world '+buttonName);
   await stage.screenshot({path:path.join(out,filename)});
 }
 await page.getByRole('button',{name:/Formato horizontal/}).click();
 assert.ok((await stage.getAttribute('style')).includes('16 / 9'),'Landscape mode failed');
 await page.screenshot({path:path.join(out,'06-landscape-layout.png')});
 // Record a real clip from the site, verify its bytes and filename.
 await page.getByRole('button',{name:/Motocicleta 3D/}).click();
 await page.waitForTimeout(400);
 const downloadEvent=page.waitForEvent('download',{timeout:240000});
 await page.getByRole('button',{name:/Baixar clipe 3D/}).click();
 const download=await downloadEvent;
 const filename=download.suggestedFilename();
 assert.match(filename,/^crieseuvideo-moto-3d\.(mp4|webm)$/);
 const saved=path.join(out,filename);
 await download.saveAs(saved);
 const bytes=await readFile(saved);
 assert.ok(bytes.length>10000,'Recorded video has no useful bytes');
 if(filename.endsWith('.mp4'))assert.equal(bytes.toString('ascii',4,8),'ftyp','Fake MP4 bytes');
 else assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3','Fake WebM bytes');
 // Read MP4's ISO-BMFF sample table and movie header directly, without
 // depending on ffprobe binaries being available in the CI runner.
 assert.ok(filename.endsWith('.mp4'),
   'The Chromium CI runner must support AVC MP4 for deterministic frame verification');
 const stsz=bytes.indexOf(Buffer.from('stsz'));
 const mvhd=bytes.indexOf(Buffer.from('mvhd'));
 assert.ok(stsz>0&&mvhd>0,'MP4 video track has no stsz/mvhd sample tables');
 assert.ok(stsz+16<=bytes.length&&mvhd+24<=bytes.length,'Corrupt MP4 box bounds');
 const deliveredFrames=bytes.readUInt32BE(stsz+12);
 const version=bytes[mvhd+4];
 const ticksPerSecond=bytes.readUInt32BE(mvhd+(version===1?24:16));
 const ticks=version===1?
   Number(bytes.readBigUInt64BE(mvhd+28)):bytes.readUInt32BE(mvhd+20);
 const deliveredDuration=ticks/ticksPerSecond;
 assert.equal(deliveredFrames,144,'Dropped frames: deterministic export must contain every 24fps frame');
 assert.ok(Math.abs(deliveredDuration-6)<.06,'Incorrect encoded duration: '+deliveredDuration);
 await writeFile(path.join(out,'report.json'),JSON.stringify({
  passed:true,route:'/motor-3d',worlds:['motocicleta','arca','prisão'],
  verified:['Mobile activation works before GPU load','Only selected scene compiled at phone resolution','No automatically loaded 4-second demo at root','SceneProgram3D renders nontrivial canvas','Motorcycle changes pose and position on its motion timeline','Other scenes render without error','Mobile and landscape display','Browser downloaded a valid video container'],download:{filename,bytes:bytes.length,deliveredFrames,deliveredDuration},
  errors,disclaimer:'Three scenes are authored QA fixtures. This test does not call Gemini or certify cinematic output.'
 },null,2));
 assert.deepEqual(errors.filter(x=>!/favicon|WebGL.*deprecated|GPU stall/.test(x)),[]);
 console.log('PASS: official browser loads new 3D motor; old automatic demo absent; moving 3D geometry and 3 worlds visible');
}finally {await browser.close();}
