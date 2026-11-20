// Imports the reference through the real studio UI, never a replacement renderer.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.MINECRAFT_PROOF_URL||'http://127.0.0.1:4198';
const out=path.resolve('tmp/minecraft-code3d-proof');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:1050},acceptDownloads:true});
const errors=[],providerRequests=[],generationRequests=[],consoleErrors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,1000));});
page.on('request',r=>{
 if(/ai.gateway.lovable.dev|generativelanguage.googleapis.com/.test(r.url()))providerRequests.push(r.url().split('?')[0]);
 if(r.method()==='POST'&&/_serverFn/.test(r.url()))generationRequests.push(r.url().split('?')[0]);
});
const source=await readFile('scripts/fixtures/code3d-minecraft-cottage.js','utf8');
const provenance=JSON.parse(await readFile('scripts/fixtures/code3d-minecraft-cottage.provenance.json','utf8'));
let stage='load studio';
try{
 await page.goto(base+'/motor-3d/codigo',{waitUntil:'domcontentloaded',timeout:60000});
 const input=page.locator('#code3d-import');await input.waitFor({timeout:60000});
 assert.equal(await page.locator('iframe').count(),0,'Studio should start without an unsolicited demo');
 stage='import Minecraft scene';
 await input.setInputFiles({name:'minecraft-cottage.js',mimeType:'text/javascript',buffer:Buffer.from(source)});
 await page.waitForFunction(()=>/estado: (pronto|falhou)/.test(document.querySelector('main')?.textContent||''),undefined,{timeout:60000});
 assert.match(await page.locator('main').innerText(),/estado: pronto/,(await page.getByRole('alert').allTextContents()).join('\n'));
 assert.match(await page.locator('main').innerText(),/Código importado · nenhuma chamada à IA/);
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
 assert.equal(Number(await page.getByRole('slider',{name:'Linha do tempo'}).getAttribute('max')),10);
 const frame=()=>page.frames().find(f=>f.url()==='about:srcdoc');
 const seek=async t=>{
  await page.getByRole('slider',{name:'Linha do tempo'}).fill(String(t));
  await page.waitForTimeout(200);
  return frame().evaluate(()=>{const src=document.querySelector('canvas'),c=document.createElement('canvas');c.width=54;c.height=96;const x=c.getContext('2d');x.drawImage(src,0,0,54,96);return Array.from(x.getImageData(0,0,54,96).data);});
 };
 const snapshots=[];
 stage='review staged frames';
 for(const t of [0,.8,1.7,3.8,5.8,6.75,7.1,8.4,9.9]){
  const pixels=await seek(t);snapshots.push({t,pixels});
  await page.locator('iframe').screenshot({path:path.join(out,`minecraft-${t.toFixed(2)}s.png`)});
 }
 const first=snapshots[0].pixels,middle=snapshots[3].pixels,last=snapshots.at(-1).pixels;
 assert.notDeepEqual(first,middle,'The house should assemble');assert.notDeepEqual(middle,last,'The roof, lighting and smoke should change');
 assert.ok(new Set(last).size>80,'Do not approve an empty frame');
 const repeated=await seek(3.8);let maxDiff=0;for(let i=0;i<repeated.length;i++)maxDiff=Math.max(maxDiff,Math.abs(repeated[i]-middle[i]));
 assert.ok(maxDiff<=3,`Replay diverged: ${maxDiff}`);
 stage='export through the studio button';
 const downloading=page.waitForEvent('download',{timeout:600000});
 await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).click();
 const download=await downloading;
 const ext=download.suggestedFilename().endsWith('.mp4')?'mp4':'webm';
 const filename=`CrieSeuVideo_Minecraft_Motor_10s.${ext}`;await download.saveAs(path.join(out,filename));
 await page.getByRole('button',{name:'Exportar vídeo (experimental)',exact:true}).waitFor({timeout:15000});
 await seek(8.4);await page.screenshot({path:path.join(out,'studio-minecraft-exported.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(providerRequests,[]);assert.deepEqual(generationRequests,[]);
 await writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,source:provenance,renderer:'Actual Code3DStudio UI, opaque WebGL sandbox, fixed-frame studio export',route:'/motor-3d/codigo',filename,frames:240,fps:24,duration:10,width:432,height:768,maxReplayDiff:maxDiff,providerRequests:providerRequests.length,generationRequests:generationRequests.length,errors,consoleErrors,commit:process.env.GITHUB_SHA||null,narration:false,limitation:'Imported skill scene adapted by ChatGPT, not autonomous Gemini generation; repository test instance, not a production deployment'},null,2));
 console.log(`PASS: Minecraft scene rendered and exported by the studio: ${filename}; 240 frames; no model requests`);
}catch(error){
 await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(path.join(out,'failure.json'),JSON.stringify({stage,error:String(error),errors,consoleErrors,visible:await page.locator('main').innerText().catch(()=>''),providerRequests,generationRequests},null,2));throw error;
}finally{await browser.close();}
