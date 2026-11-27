import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compileSceneProgram } from '../score';
import { SceneProgram3D } from '../stage3d';
import { approvedModel, type ApprovedModelId } from '../modelRegistry';
import { loadProgramModels } from '../modelAssets';
import { buildMoneyWithdrawalDemo } from './moneyWithdrawal';

const fromDisk = (async (url: string) => {
  const bytes = readFileSync(path.resolve(__dirname, '../../../../../public', String(url).replace(/^\//, '')));
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}) as unknown as typeof fetch;

describe('"E se o Elon Musk sacasse tudo?" — 7 scenes in the real engine', () => {
  it('compiles with seven shots, 52s and a matching narration beat per scene', () => {
    const clip = buildMoneyWithdrawalDemo();
    const score = compileSceneProgram(clip.program, clip.sources);
    expect(clip.duration).toBe(52);
    expect(score.duration).toBe(52);
    expect(clip.program.shots).toHaveLength(7);
    expect(clip.presentation!.beats.map((b) => [b.start, b.end])).toEqual([[0, 5], [5, 13], [13, 21], [21, 30], [30, 36], [36, 46], [46, 52]]);
    for (const n of clip.program.nodes.filter((n) => n.kind === 'model')) expect(approvedModel(n.assetId as ApprovedModelId)).toBeTruthy();
  });
  it('renders every second without errors, with the safe door, wheels and coin really moving', async () => {
    const clip = buildMoneyWithdrawalDemo();
    const models = await loadProgramModels(clip.program, fromDisk);
    expect(models.size).toBe(5);
    const stage = new SceneProgram3D(clip.program, clip.sources, models, 'technical');
    try {
      const part = (n: string, p: string) => stage.nodes.get(n)!.getObjectByName(p)!;
      for (let t = 0; t < clip.duration; t += .5) stage.update(t);
      stage.update(4.9); expect(part('safe', 'porta').rotation.y).toBeCloseTo(2.0, 1);
      stage.update(12.9); expect(part('safe', 'porta').rotation.y).toBeCloseTo(2.0, 5); // stays open through the middle
      stage.update(49 + 5); expect(part('safe', 'porta').rotation.y).toBeLessThan(.3); // closes in the last scene
      stage.update(36 + 9); expect(Math.abs(part('truck1', 'roda_1').rotation.x)).toBeGreaterThan(40);
      stage.update(30 + 5); expect(stage.nodes.get('coin')!.position.x).toBeGreaterThan(7);
      stage.validateContacts();
    } finally { stage.dispose(); }
  });
});
