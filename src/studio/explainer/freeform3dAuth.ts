/**
 * Explicit 3D Gemini calls require an authenticated owner's session.
 * This is NOT a secret API key: the browser only sends a short-lived Supabase
 * access token. Ownership is verified by the server before any model call.
 */
export async function freeform3dAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new Error('missing session');
    return { Authorization: 'Bearer ' + token };
  } catch {
    throw new Error(
      'Para testar a criação 3D com Gemini, entre primeiro na sua conta autorizada do estúdio. Não houve chamada de IA.',
    );
  }
}
