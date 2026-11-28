import {describe,it,expect} from 'vitest';
import {validateAlexManifest} from './alexBrowser';
const manifest={version:1,voice:'pm_alex',worker:'assets/voice.worker-BixcPnGi.js',modelBytes:295000000};
describe('Alex optional local bundle',()=>{
 it('accepts only the expected same-origin worker manifest',()=>{
  expect(validateAlexManifest(manifest)).toBe(manifest.worker);
  for(const worker of ['https://other.example/worker.js','../worker.js','assets/../../worker.js','assets/voice.worker-a.js?x=1'])expect(()=>validateAlexManifest({...manifest,worker})).toThrow();
  expect(()=>validateAlexManifest({...manifest,voice:'other'})).toThrow();
  expect(()=>validateAlexManifest({...manifest,modelBytes:1})).toThrow();
 });
});