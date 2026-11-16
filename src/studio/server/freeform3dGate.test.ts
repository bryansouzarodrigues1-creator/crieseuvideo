import { describe, expect, it, vi } from 'vitest';
import {
  authorizeFreeform3D, Freeform3DGateError,
  type Freeform3DGateDependencies, type Freeform3DGateEnv,
} from './freeform3dGate';

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174099';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzaWduZWQifQ.verifiedonlyattheauthserver';
const config: Freeform3DGateEnv = {
  FREEFORM_3D_ENABLED: 'true', FREEFORM_3D_OWNER_USER_ID: OWNER,
  GEMINI_API_KEY: 'server-only-qa-key', FREEFORM_3D_DAILY_LIMIT: '1',
};
const request = (token = TOKEN) => ({ headers: new Headers({ authorization: 'Bearer ' + token }) });
const deps = (user = OWNER, quota = true): Freeform3DGateDependencies => ({
  verifyUser: vi.fn(async () => user),
  consumeDailyQuota: vi.fn(async () => quota),
});
const assertDenied = async (run: Promise<unknown>, code: string) => {
  await expect(run).rejects.toMatchObject({ name: 'Freeform3DGateError', code });
};

describe('owner-only, opt-in Gemini 3D budget gate', () => {
  it('defaults to OFF even when a Gemini API key exists (no authentication or DB calls)', async () => {
    const d = deps();
    await assertDenied(authorizeFreeform3D(request(), { GEMINI_API_KEY: 'private' }, d), 'freeform_3d_disabled');
    expect(d.verifyUser).not.toHaveBeenCalled();
    expect(d.consumeDailyQuota).not.toHaveBeenCalled();
  });
  it('rejects missing owner or Gemini key and refuses malformed daily caps', async () => {
    for (const change of [
      { FREEFORM_3D_OWNER_USER_ID: '' },
      { FREEFORM_3D_OWNER_USER_ID: 'owner@email.invalid' },
      { GEMINI_API_KEY: '' },
      { FREEFORM_3D_DAILY_LIMIT: '4' },
      { FREEFORM_3D_DAILY_LIMIT: '0' },
      { FREEFORM_3D_DAILY_LIMIT: 'NaN' },
    ]) {
      const d=deps();
      await assertDenied(authorizeFreeform3D(request(), { ...config, ...change }, d), 'freeform_3d_disabled');
      expect(d.verifyUser).not.toHaveBeenCalled();
    }
  });
  it('requires signed-in Supabase JWT (cannot use a spoofed user ID header)', async () => {
    const d=deps();
    await assertDenied(authorizeFreeform3D({headers:new Headers({'x-user-id':OWNER})},config,d),'sign_in_required');
    await assertDenied(authorizeFreeform3D(request('arbitraryplaintext'),config,d),'sign_in_required');
    expect(d.verifyUser).not.toHaveBeenCalled();
  });
  it('does not trust an unverified, expired or unrecognized token', async () => {
    const d = deps(null as unknown as string);
    await assertDenied(authorizeFreeform3D(request(),config,d),'invalid_session');
    expect(d.consumeDailyQuota).not.toHaveBeenCalled();
    const failing = deps();
    vi.mocked(failing.verifyUser).mockRejectedValueOnce(new Error('auth server unavailable'));
    await assertDenied(authorizeFreeform3D(request(),config,failing),'invalid_session');
  });
  it('rejects valid accounts other than the configured owner before consuming quota', async () => {
    const d=deps(OTHER);
    await assertDenied(authorizeFreeform3D(request(),config,d),'owner_only');
    expect(d.consumeDailyQuota).not.toHaveBeenCalled();
  });
  it('reserves exactly one durable slot on the desired UTC day before any AI call', async () => {
    const d=deps();
    const value=await authorizeFreeform3D(request(),config,d,new Date('2026-11-16T23:58:00.000Z'));
    expect(value).toEqual({userId:OWNER,dailyLimit:1});
    expect(d.verifyUser).toHaveBeenCalledWith(TOKEN);
    expect(d.consumeDailyQuota).toHaveBeenCalledExactlyOnceWith(OWNER,'2026-11-16',1);
  });
  it('blocks a second attempt after the daily cap, including explicit repair calls', async () => {
    const d=deps(OWNER,false);
    await assertDenied(authorizeFreeform3D(request(),config,d),'daily_limit');
    expect(d.consumeDailyQuota).toHaveBeenCalledTimes(1);
  });
  it('fails closed if migration is missing or the persistent database fails', async () => {
    const d=deps();
    vi.mocked(d.consumeDailyQuota).mockRejectedValueOnce(new Error('missing quota RPC'));
    await assertDenied(authorizeFreeform3D(request(),config,d),'quota_unavailable');
  });
  it('never includes a user token or server key in gate errors', async () => {
    const d=deps(OTHER);
    let error: unknown;
    try { await authorizeFreeform3D(request(),config,d); } catch(e) { error=e; }
    expect(error).toBeInstanceOf(Freeform3DGateError);
    expect(JSON.stringify(error)).not.toContain(TOKEN);
    expect((error as Error).message).not.toContain(config.GEMINI_API_KEY);
  });
});
