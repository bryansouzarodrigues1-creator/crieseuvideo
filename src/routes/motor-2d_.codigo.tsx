import {ClientOnly,createFileRoute} from '@tanstack/react-router';
import {lazy,Suspense} from 'react';
const Code2DStudio=lazy(()=>import('@/studio/components/Code2DStudio'));

export const Route=createFileRoute('/motor-2d_/codigo')({
  ssr:false,
  head:()=>({meta:[
    {title:'Gemini High — Código 2D experimental | CrieSeuVideo'},
    {name:'description',content:'O Gemini programa desenhos e movimentos 2D para um vídeo completo de 30–60 segundos, executado isoladamente e exportado com o motor do CrieSeuVideo.'},
  ]}),
  component:()=>(
    <ClientOnly fallback={<p>Iniciando Code2D…</p>}>
      <Suspense fallback={<p>Preparando motor de animação 2D…</p>}>
        <Code2DStudio/>
      </Suspense>
    </ClientOnly>
  ),
});
