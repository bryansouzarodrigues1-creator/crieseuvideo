import { createFileRoute } from '@tanstack/react-router';
import { directExplainer, DirectorError, validateDirectorInput } from '@/studio/server/director';
import { supabaseVaultStore } from '@/studio/explainer/sceneProgram/vault/store';
import { authorizeRealFreeform3D, Freeform3DGateError } from '@/studio/server/freeform3dGate';

export const Route = createFileRoute('/api/ai/explainer-plan')({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const body = await request.json().catch(() => null);
      validateDirectorInput(body?.script);
      // Protect the explicit Gemini 3D feature even when the legacy site is public.
      // Reserve one DB-backed request slot BEFORE any potential upstream call.
      if (body?.mode === 'program' && body?.engine !== '2d') await authorizeRealFreeform3D(request);
      let lessons = '';
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data } = await supabaseAdmin.from('explainer_generations').select('reason').eq('rating', 'no').not('reason', 'is', null).order('rated_at', { ascending: false }).limit(12);
        if (data?.length) lessons = `ERROS QUE USUÁRIOS JÁ REPORTARAM (nunca repita): ${data.map((d) => d.reason).join(' | ')}`;
      } catch { /* Feedback is optional; a missing database does not block direction. */ }
      const vault = body?.mode === 'program' && body?.engine !== '2d'
        ? supabaseVaultStore(async () => (await import('@/integrations/supabase/client.server')).supabaseAdmin) : undefined;
      return Response.json(await directExplainer({ ...body, lessons }, undefined, { vault }));
    } catch (error) {
      if (error instanceof Freeform3DGateError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
      if (error instanceof DirectorError) return Response.json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}), ...(error.candidate ? { candidate: error.candidate } : {}) }, { status: error.status });
      return Response.json({ error: 'Não foi possível concluir a direção. Seu roteiro foi preservado.' }, { status: 503 });
    }
  } } },
});
