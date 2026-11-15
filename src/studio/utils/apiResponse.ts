/** A gateway can return an HTML error/sign-in page even for a JSON API request. */
import { readSceneProgramCandidate, type SceneProgramCandidate } from '../explainer/sceneProgram/candidate';
export class ApiResponseError extends Error {
  declare readonly programCandidate?: SceneProgramCandidate;
  constructor(message: string, public code: string, public status: number, public requestId?: string) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

function transportMessage(status: number) {
  if (status === 401 || status === 403) return 'A sessão ou a permissão de acesso precisa ser conferida. Reabra a página antes de tentar novamente.';
  if (status === 429) return 'O serviço está temporariamente limitado. Aguarde antes de tentar novamente.';
  if (status >= 500) return `O servidor devolveu uma página de erro (HTTP ${status}). Seu roteiro foi preservado; nenhuma tentativa automática será feita.`;
  return 'O servidor não devolveu os dados esperados. Reabra a página. Seu roteiro foi preservado.';
}

/** Read once, never display an HTML body, and accept the private lab's RPC envelope. */
export async function readApiResponse<T extends Record<string, any> = Record<string, any>>(response: Response): Promise<T> {
  const fail = (code = 'invalid_response') => new ApiResponseError(transportMessage(response.status), code, response.status);
  if (response.redirected) throw fail('redirected');
  const type = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json' && !type?.endsWith('+json')) throw fail('non_json');
  let data: T;
  try { data = JSON.parse(await response.text()); }
  catch { throw fail(); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail();
  if (!response.ok || data.ok === false || typeof data.error === 'string') {
    const status = Number.isInteger(data.status) && data.status >= 400 && data.status <= 599 ? data.status : response.status;
    const message = typeof data.error === 'string' && data.error.trim() && data.error.length <= 1000 && !/[<>]/.test(data.error)
      ? data.error : transportMessage(status);
    const requestId = typeof data.requestId === 'string' && /^[\w-]{1,80}$/.test(data.requestId) ? data.requestId : undefined;
    const error = new ApiResponseError(message, typeof data.code === 'string' ? data.code : 'api_failure', status, requestId);
    const candidate = readSceneProgramCandidate(data.candidate);
    if (candidate) Object.defineProperty(error, 'programCandidate', { value: candidate, enumerable: false });
    throw error;
  }
  return data;
}

/** Never normalize a missing plan into a local preset and label it as AI work. */
export async function readDirectionResponse(response: Response) {
  const data = await readApiResponse(response);
  if (!data.plan || !Array.isArray(data.plan.scenes) || !data.plan.scenes.length ||
      !data.plan.scenes.every((scene: unknown) => scene && typeof scene === 'object' &&
        !Array.isArray(scene) && typeof (scene as { text?: unknown }).text === 'string' && (scene as { text: string }).text.trim())) {
    throw new ApiResponseError('A direção chegou sem cenas válidas. A prévia anterior foi preservada.', 'invalid_plan', response.status);
  }
  return data;
}
