import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const Native3DShowcase = lazy(() => import('@/studio/components/Native3DShowcase'));

export const Route = createFileRoute('/motor-3d')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Motor 3D experimental — CrieSeuVideo' },
      { name: 'description', content: 'Laboratório do motor de animação SceneProgram3D no site oficial CrieSeuVideo.' },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<p>Carregando motor 3D…</p>}>
      <Suspense fallback={<p>Preparando cenas 3D…</p>}>
        <Native3DShowcase />
      </Suspense>
    </ClientOnly>
  ),
});
