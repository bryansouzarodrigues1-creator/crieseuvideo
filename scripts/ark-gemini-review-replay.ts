// Explicitly import the unchanged model revision; do not weaken the production provider gate.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractCode} from '../src/studio/code3d/contract';
import {normalizeDirection} from '../src/studio/code3d/direction';
import {checkGeneratedCode} from '../src/studio/code3d/validation';
const out='tmp/ark-gemini';await mkdir(out,{recursive:true});
const answer=await readFile('scripts/fixtures/ark-gemini-reviewed.original.txt','utf8');
const provenance=JSON.parse(await readFile('scripts/fixtures/ark-gemini-reviewed.provenance.json','utf8'));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
if(sha(answer)!==provenance.originalSHA256)throw Error('Model revision changed.');
const code=extractCode(answer);if(!code)throw Error('Missing model program.');
const checked=checkGeneratedCode(code);if(!checked.ok)throw Error(checked.failure);
const match=/^\/\*CRIESEUVIDEO_DIRECTION_V1\s*([\s\S]*?)\*\//.exec(code);if(!match)throw Error('Missing direction data.');
const direction=normalizeDirection(JSON.parse(match[1]),provenance.script);if(direction.duration!==20)throw Error('Incorrect duration.');
// The revision times its own shots and does not consume DIRECTOR_SCORE. It is
// not accepted as a directed provider result; the user requested its actual video,
// so it can be explicitly imported through the existing isolated-code route.
if(code.includes('DIRECTOR_SCORE.'))throw Error('This explicit import expects a self-contained original program.');
const {failure,message,...retained}=provenance;
await writeFile(out+'/original-response.txt',answer);
await writeFile(out+'/gemini-scene.js',code);
await writeFile(out+'/generation.json',JSON.stringify({...retained,ok:true,providerAccepted:false,executionMode:'explicit_import_of_unchanged_gemini_response',scoreConsumed:false,providerValidation:{failure,message},direction,codeSHA256:sha(code),warnings:[...checked.warnings,'The model uses its own timing; not accepted by the stricter production direction-consumption gate.'],replayProviderRequests:0},null,2));
console.log('Explicit import of the original Gemini revision prepared; no provider request or creative source edits.');
