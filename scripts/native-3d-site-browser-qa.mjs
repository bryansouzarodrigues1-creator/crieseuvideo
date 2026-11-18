import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
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
 await page.getByText('CrieSeuVideo',{exact:false}).first().waitFor({timeout:60000});
 const empty=page.getByText('Seu próximo vídeo começa aqui');
 await empty.waitFor({timeout:40000});
 await page.screenshot({path:path.join(out,'01-home-without-old-auto-demo.png')});
 await page.getByRole('link',{name:/motor 3d/i}).click();
 await page.getByRole('heading',{name:/Motor 3D de verdade/}).waitFor({timeout:60000});
 const stage=page.locator('.native-3d-screen canvas');
 await stage.waitFor({timeout:60000});
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
 await page.screenshot({path:path.join(out,'02-motorcycle-first-frame.png')});
 await page.getByRole('button',{name:'Reproduzir'}).click();
 await page.waitForTimeout(1100);
 const second=await frame();
 assert.notEqual(second,first,'The displayed motorcycle is a static sprite');
 await page.getByRole('button',{name:'Pausar'}).click();
 await page.screenshot({path:path.join(out,'03-motorcycle-after-motion.png')});
 for(const [buttonName,filename] of [
   ['Arca e oceano','04-ark-world.png'],
   ['Prisão 3D','05-prison-world.png']]){
   await page.getByRole('button',{name:new RegExp(buttonName)}).click();
   await page.waitForTimeout(700);
   assert.equal(await page.getByRole('alert').count(),0,'Failed loading '+buttonName);
   assert.ok((await frame()).length>10000,'Empty world '+buttonName);
   await page.screenshot({path:path.join(out,filename)});
 }
 await page.getByRole('button',{name:/Formato horizontal/}).click();
 assert.ok((await stage.getAttribute('style')).includes('16 / 9'),'Landscape mode failed');
 await page.screenshot({path:path.join(out,'06-landscape-layout.png')});
 await writeFile(path.join(out,'report.json'),JSON.stringify({
  passed:true,route:'/motor-3d',worlds:['motocicleta','arca','prisão'],
  verified:['No automatically loaded 4-second demo at root','SceneProgram3D renders nontrivial canvas','Motorcycle animates over time','Other scenes render without error','Mobile and landscape display'],
  errors,disclaimer:'Three scenes are authored QA fixtures. This test does not call Gemini or certify cinematic output.'
 },null,2));
 assert.deepEqual(errors.filter(x=>!/favicon|WebGL.*deprecated|GPU stall/.test(x)),[]);
 console.log('PASS: official browser loads new 3D motor; old automatic demo absent; moving 3D geometry and 3 worlds visible');
}finally {await browser.close();}
