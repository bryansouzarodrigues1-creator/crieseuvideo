import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const Patrick3DPilot = lazy(() => import('@/studio/components/Patrick3DPilot'));

export const Route = createFileRoute('/patrick-lab')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Patrick — Piloto 3D articulado | CrieSeuVídeo' },
      { name: 'description', content: 'Teste técnico de personagem articulado por Three.js, movimentos IK e exportação MP4.' },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<p>Carregando piloto 3D…</p>}>
      <Suspense fallback={<p>Preparando personagem…</p>}>
        <Patrick3DPilot />
      </Suspense>
    </ClientOnly>
  ),
});
