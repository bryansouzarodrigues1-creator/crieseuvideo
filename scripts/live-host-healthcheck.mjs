/**
 * Diagnostic-only browser smoke on real Lovable hosting.
 * No auth, no tokens, no paid providers, no generated videos.
 * Reports sanitized categories and screenshots; never dumps full HTML/errors.
 */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const hosts=[
  ['preview','https://id-preview--034192fc-45e8-4b90-b295-b1c7b97131e1.lovable.app/'],
  ['published','https://crieseuvideo.lovable.app/'],
];
const out=path.resolve('tmp/live-host-qa');
await mkdir(out,{recursive:true});
const classify=(v)=>{
  const s=String(v);
  if(/Missing Supabase environment variable/i.test(s))return 'missing-supabase-environment';
  if(/process is not defined/i.test(s))return 'browser-process-undefined';
  if(/Cannot find module|Failed to fetch dynamically imported module/i.test(s))return 'module-loading-error';
  if(/ChunkLoadError|Loading chunk/i.test(s))return 'chunk-loading-error';
  if(/500|Internal Server Error/i.test(s))return 'server-internal-error';
  if(/401|403|Unauthorized/i.test(s))return 'authorization-error';
  if(/Failed to fetch|NetworkError/i.test(s))return 'network-or-fetch-error';
  return 'other-runtime-error';
};
const browser=await chromium.launch({
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
const reports=[];
try{
  for(const [label,url] of hosts){
    const page=await browser.newPage({
      viewport:{width:412,height:915},deviceScaleFactor:1,
      locale:'pt-BR',
    });
    const runtimeErrors=[],failures=[];
    page.on('pageerror',error=>runtimeErrors.push(classify(error.message)));
    page.on('response',response=>{
      if(response.status()<400)return;
      try{
        const r=new URL(response.url()),site=new URL(url);
        if(r.origin!==site.origin)return;
        failures.push({status:response.status(),path:r.pathname.slice(0,120)});
      }catch{}
    });
    let status=null,networkProblem=null;
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      status=response?.status()??null;
      await page.waitForTimeout(4500);
    }catch(e){networkProblem=classify(e instanceof Error?e.message:e);}
    const title=await page.title().catch(()=>null);
    const body=await page.locator('body').innerText().catch(()=>'');
    const crashed=/This page didn't load|Something went wrong on our end/.test(body);
    const studioVisible=/Do roteiro à animação|CrieSeuVideo|Estúdio de animação/i.test(body);
    const filename=label+'.png';
    try{await page.screenshot({path:path.join(out,filename),fullPage:false});}catch{}
    const report={
      label,status,title,
      studioVisible,crashed,networkProblem,
      runtimeErrors:[...new Set(runtimeErrors)].slice(0,8),
      failedResponses:failures.slice(0,10),
      screenshot:filename,
    };
    reports.push(report);
    console.log('HOST-DIAGNOSTIC',JSON.stringify(report));
    await page.close();
  }
}finally{
  await browser.close();
}
await writeFile(path.join(out,'report.json'),JSON.stringify({generatedAt:new Date().toISOString(),reports},null,2));
if(reports.some(r=>r.crashed))console.warn('One Lovable host renders the app root error boundary');
