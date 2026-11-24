import { createFileRoute, ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const StudioApp = lazy(() => import('@/studio/App'));

/**
 * Public, unlisted compatibility lab for the existing browser QA workflows.
 * Provider-backed requests remain protected by their original server auth
 * and billing gates; this route changes no provider configuration.
 * Account-required access for regular users is available at /estudio.
 */
export const Route = createFileRoute('/laboratorio')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'CrieSeuVideo — Laboratório experimental' },
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'description', content: 'Ambiente demonstrativo de animação. Recursos em desenvolvimento.' },
  ] }),
  component: Lab,
});

function Lab() {
  return <ClientOnly fallback={<div className="studio-loading">Carregando laboratório…</div>}>
    <Suspense fallback={<div className="studio-loading">Preparando motores…</div>}>
      <StudioApp />
    </Suspense>
  </ClientOnly>;
}
