import { describe, expect, it } from 'vitest';
import { readApiResponse, readDirectionResponse } from './apiResponse';

describe('direction response safety', () => {
  it.each([200, 502, 503, 504])('handles an HTML response at HTTP %i without leaking the page or parser error', async (status) => {
    const response = new Response('<!DOCTYPE html><html>private-token private-script</html>', { status, headers: { 'Content-Type': 'text/html' } });
    const error = await readDirectionResponse(response).catch((e) => e);
    expect(error).toMatchObject({ name: 'ApiResponseError', code: 'non_json', status });
    for (const text of ['<!DOCTYPE', 'private-token', 'private-script', 'Unexpected token']) expect(error.message).not.toContain(text);
  });
  it('rejects HTML pretending to be JSON and redirected sign-in responses', async () => {
    await expect(readDirectionResponse(new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'application/json' } }))).rejects.toMatchObject({ code: 'invalid_response' });
    const response = Response.json({ plan: { scenes: [{ text: 'Não aplicar.' }] } });
    Object.defineProperty(response, 'redirected', { value: true });
    await expect(readDirectionResponse(response)).rejects.toMatchObject({ code: 'redirected' });
  });
  it('preserves an actionable application failure transported over HTTP 200', async () => {
    await expect(readDirectionResponse(Response.json({ ok: false, status: 502, code: 'unsupported_action', error: 'A ação ainda não tem suporte.', requestId: 'safe-request-id' })))
      .rejects.toMatchObject({ status: 502, code: 'unsupported_action', message: 'A ação ainda não tem suporte.', requestId: 'safe-request-id' });
  });
  it('retains the existing production HTTP error contract', async () => {
    await expect(readDirectionResponse(Response.json({ error: 'A cota acabou.', code: 'quota' }, { status: 429 }))).rejects.toMatchObject({ status: 429, code: 'quota', message: 'A cota acabou.' });
  });
  it.each([{}, { plan: {} }, { plan: { scenes: [] } }, { plan: { scenes: [{ text: '' }] } }, { plan: { scenes: [null] } }])('never turns a missing or malformed AI plan into a successful local preset: %j', async (body) => {
    await expect(readDirectionResponse(Response.json(body))).rejects.toMatchObject({ code: 'invalid_plan' });
  });
  it('reads valid direction and config results', async () => {
    const body = { ok: true, source: 'ai', plan: { scenes: [{ text: 'A peça sobe.' }] } };
    expect(await readDirectionResponse(Response.json(body))).toEqual(body);
    expect(await readApiResponse(Response.json({ configured: true }))).toEqual({ configured: true });
  });
});
