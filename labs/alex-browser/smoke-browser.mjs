import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4199',out='proof';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[],external=[];
try{
  const page=await browser.newPage({viewport:{width:412,height:915},acceptDownloads:true});
  page.on('pageerror',e=>failures.push(e.message));
  page.on('console',m=>{if(m.type()==='error')failures.push(m.text().slice(0,500));});
  await page.route('**/*',route=>{
    const u=route.request().url();
    if(u.startsWith(base+'/')||u.startsWith('blob:')||u.startsWith('data:'))return route.continue();
    external.push(new URL(u).origin);return route.abort();
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#script').fill('Você sabia que pequenas decisões podem mudar sua vida?');
  await page.locator('#generate').click();
  await page.waitForFunction(()=>!document.getElementById('generate').disabled,{},{timeout:240000});
  const status=await page.locator('#status').textContent();
  await page.screenshot({path:out+'/alex.png'});
  await writeFile(out+'/diagnostic.json',JSON.stringify({status,failures,external},null,2));
  assert.equal(status,'Áudio gerado localmente.');
  assert.equal(external.length,0,'Speech must not contact an external endpoint');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
  await download.saveAs(out+'/alex.wav');
  const wav=await readFile(out+'/alex.wav');
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);
  assert.ok(wav.length>48000&&wav.length<48000*30,'Unexpected duration');
  let energy=0;for(let i=44;i<wav.length;i+=2){const n=wav.readInt16LE(i)/32768;energy+=n*n;}
  const rms=Math.sqrt(energy/((wav.length-44)/2));assert.ok(rms>.001,'Silent output');
  let timing=null;
  if(await page.locator('#timestamps').isVisible()){
    const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#timestamps').click()]);
    await d.saveAs(out+'/timing.json');timing=JSON.parse(await readFile(out+'/timing.json','utf8'));
  }
  await writeFile(out+'/report.json',JSON.stringify({voice:'pm_alex',seconds:(wav.length-44)/48000,rms,metrics:await page.locator('#metrics').textContent(),externalRequests:external.length,wordTimestamps:timing?.timestamps?.length??0,caveat:'desktop Chromium with mobile viewport, not a real Android test'},null,2));
}finally{await browser.close();}
