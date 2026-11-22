import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractCode} from './contract';
import {prepareDirectedProgram} from '../server/directedProgram';
import {checkGeneratedCode} from './validation';
describe('the actual untouched Gemini ark response',()=>{
 it('keeps its original bytes and accepts its full twenty-second direction and code',()=>{
  const original=readFileSync('scripts/fixtures/ark-gemini.original.txt','utf8');
  const provenance=JSON.parse(readFileSync('scripts/fixtures/ark-gemini.provenance.json','utf8'));
  expect(createHash('sha256').update(original).digest('hex')).toBe(provenance.originalSHA256);
  const source=extractCode(original);expect(source).not.toBeNull();
  const prepared=prepareDirectedProgram(source!,provenance.script);
  expect(prepared.direction.duration).toBe(20);
  expect(prepared.direction.shots.map(s=>s.start)).toEqual([0,7,11,14]);
  expect(checkGeneratedCode(prepared.code).ok).toBe(true);
  expect(prepared.code).toContain('getSoundtrack');
  const body=source!.slice(source!.indexOf('*/')+2).trimStart();
  expect(prepared.code.endsWith(body)).toBe(true);
 });
});
