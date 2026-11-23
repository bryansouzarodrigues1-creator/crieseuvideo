import {createFileRoute} from '@tanstack/react-router';
import {PRICING_CATALOG,formatBrl} from '@/studio/pricing/catalog';

export const Route=createFileRoute('/precos')({
 ssr:false,component:PricingPreview,
});

function PricingPreview(){
 return (
  <main style={{minHeight:'100vh',background:'#08121f',color:'#f8fafc',padding:'44px 18px',fontFamily:'system-ui,sans-serif'}}>
   <div style={{maxWidth:1100,margin:'0 auto'}}>
    <p style={{color:'#93c5fd',letterSpacing:1,textTransform:'uppercase',fontSize:12,fontWeight:750}}>CrieSeuVideo · estudo de preços</p>
    <h1 style={{fontSize:'clamp(28px,4vw,44px)',margin:'12px 0',fontWeight:800}}>Comece por R$ 1. Cresça conforme a animação.</h1>
    <p style={{maxWidth:690,lineHeight:1.7,color:'#bac9dc'}}>
     Preços experimentais. Cada categoria aumenta o esforço de roteiro, direção, programação e validação.
     Nenhum pagamento é cobrado nesta página; o checkout ainda não foi habilitado.
    </p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginTop:30}}>
     {PRICING_CATALOG.map((p,i)=>(
      <article key={p.id} style={{padding:20,borderRadius:16,border:i===0?'2px solid #60a5fa':'1px solid #334155',background:i===0?'#152945':'#0f1d30'}}>
       <p style={{fontSize:12,textTransform:'uppercase',letterSpacing:0.6,color:'#93c5fd'}}>{p.effort} esforço</p>
       <h2 style={{fontSize:20,margin:'12px 0 6px',fontWeight:700}}>{p.name}</h2>
       <p style={{fontSize:31,fontWeight:800,margin:'8px 0'}}>{formatBrl(p.priceCents)}</p>
       <p style={{color:'#e2e8f0',fontSize:14,marginBottom:8}}>{p.credits} {p.credits===1?'vídeo':'vídeos'} · até {p.maxDurationSec} s cada</p>
       <p style={{color:'#cbd5e1',fontSize:13,lineHeight:1.55}}>{p.description}</p>
       <div style={{marginTop:14,fontSize:12,color:'#a8bfdc',lineHeight:1.7}}>Até {p.maxScenes} cenas · {p.maxResolution}
        {p.allowsPremiumAi?' · IA avançada sob orçamento':' · sem IA premium automática'}
       </div>
      </article>
     ))}
    </div>
    <p style={{marginTop:28,fontSize:13,color:'#94a3b8',lineHeight:1.6}}>
     O pacote de entrada usa componentes 2D reutilizáveis e não inclui renderização de 3D.
     O valor final dependerá de medições reais de custo e do teste de pagamentos Pix.
    </p>
    <a href="/teste-gratis" style={{display:'inline-block',marginTop:8,padding:'12px 17px',borderRadius:9,background:'#dbeafe',fontWeight:750,color:'#0f172a'}}>
     Preparar cadastro Google (sem cobrança)
    </a>
   </div>
  </main>
 );
}