import {mkdir,writeFile} from 'node:fs/promises';
import {directEditorialPlan} from '../src/studio/server/editorialDirector';
import {askGeminiForEditorial} from '../src/studio/server/ai';
const dir='tmp/editorial-live-proof';
await mkdir(dir,{recursive:true});
const script='O quarto está quente. O ar-condicionado puxa o ar do ambiente. O fluido refrigerante absorve calor e o leva para fora. O ar volta mais frio. O aparelho não cria frio, ele transporta calor.';
let calls=0;
if(process.env.EDITORIAL_LIVE_APPROVAL!=='ONE_FREE_TIER_GEMINI_CALL'||!process.env.GEMINI_API_KEY){
 await writeFile(dir+'/provider.json',JSON.stringify({status:'blocked',calls:0,reason:'Explicit free-tier approval and GitHub secret required.'}));
 throw Error('Live proof blocked: approval or key missing.');
}
const response=await directEditorialPlan({mode:'creative'},script,'9:16',true,async prompt=>{
 if(++calls!==1)throw Error('Second provider call blocked.');
 return askGeminiForEditorial(prompt);
});
const result=await response.json();
await writeFile(dir+'/provider.json',JSON.stringify({status:response.ok?'accepted':'rejected',calls,httpStatus:response.status,code:result.code??null,model:result.model??null,thinkingLevel:result.thinkingLevel??null},null,2));
if(!response.ok||calls!==1||result.source!=='gemini')throw Error('Gemini did not produce an accepted plan; no fallback.');
await writeFile(dir+'/plan.json',JSON.stringify({script,plan:result.plan},null,2));
