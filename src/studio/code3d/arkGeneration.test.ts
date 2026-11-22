import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractCode} from './contract';
import {prepareDirectedProgram} from '../server/directedProgram';
import {checkGeneratedCode} from './validation';
import {normalizeDirection} from './direction';
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
 it('validates the revised metadata without pretending the stricter provider accepted its independently timed code',()=>{
  const answer=readFileSync('scripts/fixtures/ark-gemini-reviewed.original.txt','utf8');
  const provenance=JSON.parse(readFileSync('scripts/fixtures/ark-gemini-reviewed.provenance.json','utf8'));
  expect(createHash('sha256').update(answer).digest('hex')).toBe(provenance.originalSHA256);
  const code=extractCode(answer)!;const match=/^\/\*CRIESEUVIDEO_DIRECTION_V1\s*([\s\S]*?)\*\//.exec(code)!;
  expect(normalizeDirection(JSON.parse(match[1]),provenance.script).duration).toBe(20);
  expect(checkGeneratedCode(code).ok).toBe(true);
  expect(()=>prepareDirectedProgram(code,provenance.script)).toThrow(/ignorou/);
  expect(code).not.toContain('DIRECTOR_SCORE.');
 });
});
