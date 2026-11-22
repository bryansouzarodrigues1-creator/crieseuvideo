// Exact saved responses, no generation and no creative source changes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='scripts/fixtures/thinking-ab',out='tmp/thinking-ab';await mkdir(out,{recursive:true});
const experiment=JSON.parse(await readFile(source+'/experiment.json','utf8'));
if(experiment.totalRequests!==2||experiment.arms[0].commonRequestHash!==experiment.arms[1].commonRequestHash)throw Error('A/B controls changed.');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
for(const level of ['low','high']){
 const arm=experiment.arms.find((a:any)=>a.level===level);
 const original=await readFile(`${source}/${level}.original.txt`,'utf8');if(sha(original)!==arm.originalSHA256)throw Error('Original response changed.');
 await writeFile(`${out}/${level}.original.txt`,original);
 await writeFile(`${out}/${level}.generation.json`,JSON.stringify(arm,null,2));
 if(arm.codeReady){const code=await readFile(`${source}/${level}.js`,'utf8');if(sha(code)!==arm.codeSHA256)throw Error('Model program changed.');await writeFile(`${out}/${level}.js`,code);}
}
await writeFile(out+'/experiment.json',JSON.stringify({...experiment,replayProviderRequests:0},null,2));
console.log('Both actual responses restored with matching hashes; new generation calls: 0.');
