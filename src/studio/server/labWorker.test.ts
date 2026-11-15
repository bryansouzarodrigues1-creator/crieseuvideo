import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLabWorker } from '../../../lab/createWorker';
import { directExplainer, DirectorError } from './director';
import { readDirectionResponse } from '../utils/apiResponse';

vi.mock('./director', async (original) => ({ ...(await original<typeof import('./director')>()), directExplainer: vi.fn() }));
afterEach(() => { vi.mocked(directExplainer).mockReset(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const origin = 'https://private-lab.example';
const request = (body: unknown = { script: 'Um roteiro novo.' }, source = origin) => new Request(origin + '/api/direct', {
  method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('private lab direction transport', () => {
  it('returns a rejected proposal to its caller while keeping it out of failure logs', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {}), error = new DirectorError(502, 'invalid_scene_program', 'Programa inválido.');
    const candidate = { sourceSignature: '[["s1","private-source"]]', program: { code: 'private-model-payload' } };
    Object.defineProperty(error, 'candidate', { value: candidate, enumerable: false });
    vi.mocked(directExplainer).mockRejectedValueOnce(error);
    const response = await createLabWorker({}).fetch(request(), {}), data = await response.json();
    expect(data.candidate).toEqual(candidate);
    for (const text of ['private-source', 'private-model-payload']) expect(JSON.stringify(logs.mock.calls)).not.toContain(text);
  });
  it('checks connection using only a real token-count preflight, never generation', async () => {
    const fetchMock = vi.fn(async () => Response.json({ totalTokens: 20 })); vi.stubGlobal('fetch', fetchMock);
    const response = await createLabWorker({}).fetch(new Request(origin + '/api/connect', { method: 'POST', headers: { Origin: origin } }), { GEMINI_API_KEY: 'fixture-only' });
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, preflight: { generationRequested: false, requestFormat: 'json-mime-v1', totalTokens: 20 } });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain(':countTokens');
    expect(directExplainer).not.toHaveBeenCalled();
  });
  it('keeps a rejected direction readable through the RPC boundary without logging private data or retrying', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(directExplainer).mockRejectedValue(new DirectorError(502, 'unsupported_action', 'A ação ainda não tem suporte.'));
    const response = await createLabWorker({}).fetch(request({ script: 'private-script' }), { GEMINI_API_KEY: 'private-key' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(readDirectionResponse(response)).rejects.toMatchObject({ code: 'unsupported_action', status: 502 });
    expect(directExplainer).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.mock.calls)).toContain('unsupported_action');
    for (const secret of ['private-script', 'private-key']) expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
  });
  it('rejects a foreign origin before direction and keeps the access failure as HTTP 403', async () => {
    expect((await createLabWorker({}).fetch(request({}, 'https://another.example'), {})).status).toBe(403);
    expect(directExplainer).not.toHaveBeenCalled();
  });
  it('keeps safe scene/action diagnostics in the readable response and failure log', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const details = { sourceId: 's2', field: 'staging' as const, receivedAction: 'run', expectedAction: 'wait' };
    vi.mocked(directExplainer).mockRejectedValue(new DirectorError(502, 'unsupported_action', 'Cena 2: a frase permite esperar.', details));
    const response = await createLabWorker({}).fetch(request({ script: 'private-script' }), { GEMINI_API_KEY: 'private-key' });
    const result = await response.json();
    expect(result).toMatchObject({ ok: false, status: 502, details });
    expect(JSON.parse(String(logs.mock.calls[0]?.[1]))).toMatchObject({ details });
    for (const secret of ['private-script', 'private-key']) expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
    expect(directExplainer).toHaveBeenCalledTimes(1);
  });
  it('does not request AI for malformed JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await createLabWorker({}).fetch(new Request(origin + '/api/direct', { method: 'POST', headers: { Origin: origin }, body: '<html>' }), {});
    await expect(readDirectionResponse(response)).rejects.toMatchObject({ code: 'invalid_json', status: 400 });
    expect(directExplainer).not.toHaveBeenCalled();
  });
  it('does not submit a second request while one is active or in cooldown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let complete!: (value: any) => void;
    vi.mocked(directExplainer).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const worker = createLabWorker({}), first = worker.fetch(request(), {});
    await vi.waitFor(() => expect(directExplainer).toHaveBeenCalledTimes(1));
    await expect(readDirectionResponse(await worker.fetch(request(), {}))).rejects.toMatchObject({ code: 'busy', status: 429 });
    complete({ source: 'ai', plan: { scenes: [{ text: 'Um roteiro novo.' }] } });
    expect((await readDirectionResponse(await first)).plan.scenes[0].text).toBe('Um roteiro novo.');
    await expect(readDirectionResponse(await worker.fetch(request(), {}))).rejects.toMatchObject({ code: 'busy' });
    expect(directExplainer).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed request bytes even without a Content-Length header', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const oversized = request({ script: 'a'.repeat(130000) });
    expect(oversized.headers.get('Content-Length')).toBeNull();
    await expect(readDirectionResponse(await createLabWorker({}).fetch(oversized, {}))).rejects.toMatchObject({ status: 413, code: 'script_too_large' });
    expect(directExplainer).not.toHaveBeenCalled();
  });
});
