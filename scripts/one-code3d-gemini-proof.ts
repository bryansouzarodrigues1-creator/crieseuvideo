// Explicit one-call proof only. No production auth bypass, no retry or fallback.
import { mkdir, writeFile } from 'node:fs/promises';
import { generateCode3DWithGemini, code3dModel } from '../src/studio/server/code3dGemini';

if (process.env.CODE3D_ONE_CALL !== 'ONE_AUTHORIZED_CALL_20261120') throw new Error('Missing explicit one-call run marker.');
const out = 'tmp/unified-3d-qa/code3d-real';
await mkdir(out, { recursive: true });
const realFetch = globalThis.fetch;
let attempts = 0;
globalThis.fetch = (async (url, init) => {
  if (attempts !== 0 || String(url) !== `https://generativelanguage.googleapis.com/v1beta/models/${code3dModel()}:generateContent` || init?.method !== 'POST') {
    throw new Error('One-call request boundary rejected an additional/unexpected request.');
  }
  attempts++;
  return realFetch(url, init);
}) as typeof fetch;
const script = 'Um guindaste amarelo levanta um contêiner na obra, gira a lança e posiciona o contêiner no caminhão. Mostre a carga presa ao gancho e aos cabos durante todo o içamento e giro, soltando apenas depois do contato com a carroceria. A câmera acompanha o mecanismo, com edifícios e operários no fundo.';
try {
  const result = await generateCode3DWithGemini(script, '9:16');
  await writeFile(`${out}/generation.json`, JSON.stringify({
    ok: result.ok, attempts, model: result.model,
    source: 'Real Gemini API, one request, no retries, no fallback',
    script, ...(result.ok ? { codeCharacters: result.code.length, warnings: result.warnings }
      : { failure: result.failure, message: result.message }),
    productionAuthVerified: false,
  }, null, 2));
  if (!result.ok) { console.error(`Real Code 3D proof failed: ${result.failure}; requests=${attempts}`); process.exitCode = 1; }
  else {
    await writeFile(`${out}/gemini-scene.js`, result.code);
    console.log(`Real Code 3D response parsed: ${result.code.length} characters; requests=${attempts}`);
  }
} finally { globalThis.fetch = realFetch; }
