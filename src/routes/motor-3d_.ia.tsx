import {ClientOnly,createFileRoute} from '@tanstack/react-router';
import {lazy,Suspense} from 'react';

const Ai3DStudio=lazy(()=>import('@/studio/components/Ai3DStudio'));

export const Route=createFileRoute('/motor-3d_/ia')({
  ssr:false,
  head:()=>({meta:[
    {title:'Gerar 3D com Gemini e Lovable — CrieSeuVideo'},
    {name:'description',content:'Planejamento de objetos, ambientes e animações 3D com IA e renderização nativa.'},
  ]}),
  component:()=>(
    <ClientOnly fallback={<p>Iniciando estúdio 3D…</p>}>
      <Suspense fallback={<p>Carregando o gerador 3D…</p>}>
        <Ai3DStudio/>
      </Suspense>
    </ClientOnly>
  ),
});
