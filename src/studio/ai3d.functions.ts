import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {sourceBriefsFromScript} from './explainer/sceneProgram/planner/aiWorldDirector';
import {compactWorldPrompt,compileCompactWorld} from './explainer/sceneProgram/planner/compactWorldDirector';

const input=z.object({
  script:z.string().min(45).max(750),
  provider:z.enum(['auto','gemini','lovable']),
  confirmCost:z.literal(true),
}).strict();

// A first-line safeguard only; it does not replace durable DB quotas for
// production scale. No anonymous requests, no silent retry or automatic call.
const inFlight=new Set<string>();
const lastRequest=new Map<string,number>();

export const generateAi3DWorld=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator(data=>input.parse(data))
  .handler(async ({data,context})=>{
    const userId=context.userId;
    const now=Date.now();
    if(inFlight.has(userId))throw new Error('Uma cena sua já está sendo planejada.');
    const last=lastRequest.get(userId)||0;
    if(now-last<30000)throw new Error('Espere ao menos 30 segundos entre pedidos para evitar gastos repetidos.');
    const sources=sourceBriefsFromScript(data.script);
    const prompt=compactWorldPrompt(sources);
    inFlight.add(userId);
    lastRequest.set(userId,now);
    try{
      const {ask3DWorldAi,parseJson}=await import('./server/ai');
      const answer=await ask3DWorldAi(prompt,data.provider,(text)=>{
        // Only pay for a second provider in explicitly selected Auto mode.
        // Failure to parse/build is not a successful output; never show a
        // different pre-recorded scene as a silent fallback.
        const json=parseJson(text);
        if(!json)return false;
        try {compileCompactWorld(json,sources);return true;}
        catch {return false;}
      });
      if(!answer)throw new Error('Os provedores não entregaram uma cena 3D válida.');
      const raw=parseJson(answer.text);
      if(!raw)throw new Error('A IA não devolveu JSON válido.');
      const clip=compileCompactWorld(raw,sources);
      return {
        clip,
        provider:answer.provider,
        duration:clip.duration,
        warning:'A IA definiu os objetos e a ação; o motor construiu as peças e as câmeras. A revisão visual e o áudio ainda precisam ser finalizados.',
      };
    }finally{
      inFlight.delete(userId);
      if(lastRequest.size>2000)lastRequest.clear();
    }
  });
