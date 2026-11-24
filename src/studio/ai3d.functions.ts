import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {sourceBriefsFromScript} from './explainer/sceneProgram/planner/aiWorldDirector';
import {compactWorldPrompt,compileCompactWorld} from './explainer/sceneProgram/planner/compactWorldDirector';
import {cooldownSecondsRemaining,ai3dCooldownMessage} from './ai3dCooldown';
import {gemini3DResponseSchema,parseAi3DScene} from './server/ai3dSchema';

const input=z.object({
  script:z.string().min(45).max(750),
  provider:z.enum(['auto','gemini','lovable']),
  confirmCost:z.literal(true),
  geminiModel:z.enum(['default','gemini-3.5-flash-lite','gemini-3.6-flash','gemini-3.8-flash']).default('default'),
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
    const retryIn=cooldownSecondsRemaining(last,now);
    if(retryIn>0)throw new Error(ai3dCooldownMessage(retryIn));
    const sources=sourceBriefsFromScript(data.script);
    const prompt=compactWorldPrompt(sources);
    inFlight.add(userId);
    // A valid provider attempt starts the anti-double-spend window.
    // Rejected repeats do not extend the window or contact either provider.
    lastRequest.set(userId,now);
    try{
      const {ask3DWorldAi}=await import('./server/ai');
      const schema=gemini3DResponseSchema(sources.map(s=>s.sourceId));
      const answer=await ask3DWorldAi(prompt,data.provider,(text)=>{
        // Validate the exact scene graph, not only syntactically valid JSON.
        // A second provider is called ONLY when "Auto" was explicitly chosen.
        // No paid repairs, hidden retries or demo-video substitutions.
        const json=parseAi3DScene(text);
        if(!json)return {accepted:false,reason:'invalid_json'} as const;
        try{
          compileCompactWorld(json,sources);
          return {accepted:true} as const;
        }catch{
          // No raw model responses, prompts or secrets in logs/errors.
          return {accepted:false,reason:'invalid_scene'} as const;
        }
      },schema,data.geminiModel);
      if(!answer)throw new Error('Os provedores não entregaram uma cena 3D válida.');
      const raw=parseAi3DScene(answer.text);
      if(!raw)throw new Error('A IA não devolveu JSON válido.');
      const clip=compileCompactWorld(raw,sources);
      return {
        clip,
        provider:answer.provider,
        duration:clip.duration,
        warning:'A IA definiu os objetos e as ações; o motor construiu as peças e as câmeras. A revisão visual e o áudio ainda precisam ser finalizados.',
      };
    }finally{
      inFlight.delete(userId);
      if(lastRequest.size>2000)lastRequest.clear();
    }
  });
