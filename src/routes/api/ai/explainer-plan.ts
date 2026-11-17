import { createFileRoute } from '@tanstack/react-router';
import { directExplainer, DirectorError, validateDirectorInput } from '@/studio/server/director';

export const Route = createFileRoute('/api/ai/explainer-plan')({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const body = await request.json().catch(() => null);
      validateDirectorInput(body?.script);
      let lessons = '';
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data } = await supabaseAdmin.from('explainer_generations').select('reason').eq('rating', 'no').not('reason', 'is', null).order('rated_at', { ascending: false }).limit(12);
        if (data?.length) lessons = `ERROS QUE USUÁRIOS JÁ REPORTARAM (nunca repita): ${data.map((d) => d.reason).join(' | ')}`;
      } catch { /* Feedback is optional; a missing database does not block direction. */ }
      return Response.json(await directExplainer({ ...body, lessons }));
    } catch (error) {
      if (error instanceof DirectorError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
      return Response.json({ error: 'Não foi possível concluir a direção. Seu roteiro foi preservado.' }, { status: 503 });
    }
  } } },
});
