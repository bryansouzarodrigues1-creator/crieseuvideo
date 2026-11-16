/**
 * Fail-closed gate for the owner-only Gemini 3D experiment.
 *
 * A Gemini key is never enough to open a public generation endpoint. A real
 * Supabase JWT, an exact owner UID, an explicit server-side enable flag and an
 * atomic daily quota reservation are required before any upstream model call.
 *
 * This DOES NOT protect other legacy paid endpoints. Those also need
 * authentication + billing safeguards before broad public launch.
 */
export interface Freeform3DGateEnv {
  FREEFORM_3D_ENABLED?: string;
  FREEFORM_3D_OWNER_USER_ID?: string;
  FREEFORM_3D_DAILY_LIMIT?: string;
  FREEFORM_3D_GEMINI_API_KEY?: string;
}

export class Freeform3DGateError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) { super(message); this.name = 'Freeform3DGateError'; }
}

export interface Freeform3DGateDependencies {
  /** Must verify the JWT using Supabase Auth, NOT decode it without verifying. */
  verifyUser: (bearerToken: string) => Promise<string | null>;
  /** Must reserve a slot atomically in a persistent database across workers. */
  consumeDailyQuota: (userId: string, utcDay: string, limit: number) => Promise<boolean>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const disabled = () => new Freeform3DGateError(
  503, 'freeform_3d_disabled', 'O 3D livre está em homologação privada. Nenhuma chamada de IA foi feita.',
);

export async function authorizeFreeform3D(
  request: Pick<Request, 'headers'>,
  env: Freeform3DGateEnv,
  deps: Freeform3DGateDependencies,
  now = new Date(),
): Promise<{ userId: string; dailyLimit: number }> {
  // Default is OFF even if the production server already has GEMINI_API_KEY.
  if (env.FREEFORM_3D_ENABLED !== 'true') throw disabled();
  const ownerId = env.FREEFORM_3D_OWNER_USER_ID;
  if (!ownerId || !UUID.test(ownerId) || !env.FREEFORM_3D_GEMINI_API_KEY) throw disabled();
  const limit = Number(env.FREEFORM_3D_DAILY_LIMIT ?? '1');
  if (!Number.isInteger(limit) || limit < 1 || limit > 3) throw disabled();

  const auth = request.headers.get('authorization') ?? '';
  const parts = /^Bearer (.+)$/i.exec(auth);
  const token = parts?.[1] ?? '';
  if (token.length < 20 || token.length > 8192 || !JWT.test(token)) {
    throw new Freeform3DGateError(401, 'sign_in_required',
      'Entre na sua conta autorizada antes de programar o 3D. Nenhuma chamada à IA foi feita.');
  }

  let userId: string | null;
  try { userId = await deps.verifyUser(token); }
  catch { userId = null; }
  if (!userId || !UUID.test(userId)) {
    throw new Freeform3DGateError(401, 'invalid_session',
      'Não foi possível validar sua sessão. Entre novamente; nenhuma chamada à IA foi feita.');
  }
  if (userId.toLowerCase() !== ownerId.toLowerCase()) {
    throw new Freeform3DGateError(403, 'owner_only',
      'O experimento 3D com IA está restrito à conta proprietária.');
  }

  const day = now.toISOString().slice(0, 10);
  let accepted: boolean;
  try { accepted = await deps.consumeDailyQuota(userId, day, limit); }
  catch {
    // If the DB function is absent or unavailable, NEVER fall back to an
    // in-memory counter: serverless instances are not a shared quota.
    throw new Freeform3DGateError(503, 'quota_unavailable',
      'O controle de cota ainda não está disponível. Nenhuma chamada à IA foi feita.');
  }
  if (!accepted) {
    throw new Freeform3DGateError(429, 'daily_limit',
      'A cota diária de testes 3D foi atingida. Nenhuma chamada adicional foi iniciada.');
  }
  return { userId, dailyLimit: limit };
}

export async function authorizeRealFreeform3D(request: Request): Promise<{ userId: string; dailyLimit: number }> {
  const env: Freeform3DGateEnv = typeof process === 'undefined' ? {} : process.env;
  // Do not import supabaseAdmin until the feature is enabled and configured.
  // This is server-only and uses its service role only for the quota RPC.
  return authorizeFreeform3D(request, env, {
    verifyUser: async (token) => {
      const { supabaseAdmin } = await import('../../integrations/supabase/client.server');
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    consumeDailyQuota: async (userId, utcDay, limit) => {
      const { supabaseAdmin } = await import('../../integrations/supabase/client.server');
      // Database type generation runs after applying the pending SQL migration.
      // Until then the function is intentionally absent and this fails closed.
      const rpc = supabaseAdmin.rpc as unknown as (
        name: 'consume_freeform_3d_quota',
        args: { p_user_id: string; p_utc_day: string; p_limit: number },
      ) => Promise<{ data: boolean | null; error: unknown }>;
      const { data, error } = await rpc('consume_freeform_3d_quota', {
        p_user_id: userId, p_utc_day: utcDay, p_limit: limit,
      });
      if (error || typeof data !== 'boolean') throw new Error('quota unavailable');
      return data;
    },
  });
}
