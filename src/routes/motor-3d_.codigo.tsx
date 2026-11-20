import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const Code3DStudio = lazy(() => import('@/studio/components/Code3DStudio'));

export const Route = createFileRoute('/motor-3d_/codigo')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Gemini — Código 3D (experimental) — CrieSeuVideo' },
      { name: 'description', content: 'Protótipo experimental: o Gemini escreve uma cena Three.js que roda isolada no navegador.' },
      { property: 'og:title', content: 'Gemini — Código 3D (experimental)' },
      { property: 'og:description', content: 'O Gemini escreve o código de uma cena 3D animada, executada numa caixa isolada.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<p>Iniciando laboratório de código 3D…</p>}>
      <Suspense fallback={<p>Carregando…</p>}>
        <Code3DStudio />
      </Suspense>
    </ClientOnly>
  ),
});
