// One authorized real request. No fallback, repair call, or manual source edit.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generateCode3DWithGemini, code3dModel } from '../src/studio/server/code3dGemini';
import { narrationTimingSchema, DIRECTOR_LESSON_VERSION } from '../src/studio/code3d/direction';

if (process.env.DIRECTION_ONE_CALL !== 'ONE_DIRECTED_REQUEST_20261121') throw new Error('Missing explicit one-call marker.');
const out = 'tmp/gemini-direction';
await mkdir(out, { recursive: true });
const narration = narrationTimingSchema.parse(JSON.parse(await readFile('scripts/fixtures/gemini-direction-timing.json', 'utf8')));
const script = 'No mesmo quintal de uma casa, mostre a montagem por etapas: primeiro um canteiro com quatro tábuas, terra e mudas; quando a fala mencionar a chuva, monte reservatório e calha e mostre a água chegando; na menção ao telhado, encaixe quatro painéis solares. Cada peça é rígida, tem apoio e permanece montada entre os planos. Câmera em detalhe da peça ativa, casa com telhado laranja, horta verde e tanque azul. Sem apresentador nem painel de texto. Use as palavras fornecidas como relógio, sem criar outra narração. Inclua 0.3 s de resultado visível após cada montagem.';
const originalFetch = globalThis.fetch;
let attempts = 0;
let original = '';
globalThis.fetch = (async (url, init) => {
  if (attempts || String(url) !== `https://generativelanguage.googleapis.com/v1beta/models/${code3dModel()}:generateContent` || init?.method !== 'POST')
    throw new Error('Unexpected or additional request rejected.');
  attempts++;
  const response = await originalFetch(url, init);
  if (response.ok) {
    const data = await response.clone().json() as any;
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) original = parts.filter((p: any) => typeof p?.text === 'string' && !p.thought).map((p: any) => p.text).join('');
  }
  return response;
}) as typeof fetch;
try {
  const result = await generateCode3DWithGemini(script, '9:16', 'configured', narration);
  if (original) await writeFile(`${out}/original-response.txt`, original);
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  await writeFile(`${out}/generation.json`, JSON.stringify({
    ok: result.ok, attempts, model: result.model, lessonVersion: DIRECTOR_LESSON_VERSION,
    script, narration, manualChanges: false, productionAuthVerified: false,
    originalSHA256: sha(original), commit: process.env.GITHUB_SHA,
    ...(result.ok ? { direction: result.direction, codeSHA256: sha(result.code), warnings: result.warnings }
      : { failure: result.failure, message: result.message }),
  }, null, 2));
  if (!result.ok) throw new Error(`Directed generation failed: ${result.failure}; requests=${attempts}`);
  await writeFile(`${out}/gemini-scene.js`, result.code);
  console.log(`Real Gemini direction received: ${result.direction.shots.length} shots, ${result.code.length} code characters, requests=${attempts}.`);
} finally { globalThis.fetch = originalFetch; }
