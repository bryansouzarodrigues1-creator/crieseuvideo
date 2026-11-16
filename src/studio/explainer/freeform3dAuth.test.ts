import { afterEach, describe, expect, it, vi } from 'vitest';
import { freeform3dAuthHeaders } from './freeform3dAuth';

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: session } }));
afterEach(() => session.getSession.mockReset());

describe('client Gemini 3D authorization', () => {
  it('passes only the short-lived user token and never a Google or Lovable key', async () => {
    session.getSession.mockResolvedValueOnce({ data: { session: { access_token: 'signed.jwt.session' } }, error: null });
    const headers=await freeform3dAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer signed.jwt.session' });
    expect(JSON.stringify(headers)).not.toContain('GEMINI_API_KEY');
    expect(session.getSession).toHaveBeenCalledTimes(1);
  });
  it('refuses unauthenticated requests before contacting the generation endpoint', async () => {
    session.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(freeform3dAuthHeaders()).rejects.toThrow(/entre primeiro na sua conta autorizada/i);
  });
  it('refuses auth storage/network failures without an insecure fallback', async () => {
    session.getSession.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(freeform3dAuthHeaders()).rejects.toThrow(/Não houve chamada de IA/);
  });
});
