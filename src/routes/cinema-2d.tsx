import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
const Storytelling2DStudio=lazy(()=>import('@/studio/editorial2d/Storytelling2DStudio'));

export const Route=createFileRoute('/cinema-2d')({
  ssr:false,
  head:()=>({meta:[
    {title:'Cinema 2D — CrieSeuVideo'},
    {name:'description',content:'Prévia de histórias 2D vetoriais, editor declarativo e controle de timeline.'}
  ]}),
  component:()=>(
    <ClientOnly fallback={<p>Carregando Cinema 2D…</p>}>
      <Suspense fallback={<p>Carregando Cinema 2D…</p>}><Storytelling2DStudio/></Suspense>
    </ClientOnly>
  ),
});
