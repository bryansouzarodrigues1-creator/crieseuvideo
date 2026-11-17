import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve('tmp/rig-pose-audit');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:720,height:1280}});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('http://127.0.0.1:4189/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.dataset.ready==='ok',{timeout:35000})
  .catch(async error=>{throw new Error('Rig audit did not initialize: '+errors.join(' / ')+' '+error);});
 const data=await page.evaluate(()=>(window).__rigMatrixAudit.report);
 const image=await page.evaluate(()=>(window).__rigMatrixAudit.snapshot().split(',')[1]);
 await fs.writeFile(path.join(out,'sample.png'),Buffer.from(image,'base64'));
 await fs.writeFile(path.join(out,'matrix-report.json'),JSON.stringify({data,errors},null,2));
 console.log('Audit completed:',JSON.stringify({
   total:data.cases.length,warnings:data.warnings,
   isolated:data.cases.filter(x=>x.label==='isolated-mixer').map(x=>({clip:x.clip,t:x.time,y:x.wrist[1]})),
   sequential:data.cases.filter(x=>x.label==='sequential-player').map(x=>({clip:x.clip,t:x.time,y:x.wrist[1]})),
 }));
 if(errors.length)process.exitCode=2;
}finally{await browser.close();}
