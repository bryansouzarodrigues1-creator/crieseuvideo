import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {cooldownSecondsRemaining,ai3dCooldownMessage} from './ai3dCooldown';
import {
  CODE2D_MIN_SCRIPT_CHARS,CODE2D_MAX_SCRIPT_CHARS,
  CODE2D_MIN_DURATION,CODE2D_MAX_DURATION,
} from './code2d/contract';

const input=z.object({
  topic:z.string().trim().min(CODE2D_MIN_SCRIPT_CHARS).max(CODE2D_MAX_SCRIPT_CHARS),
  aspect:z.enum(['9:16','16:9']),
  duration:z.number().int().min(CODE2D_MIN_DURATION).max(CODE2D_MAX_DURATION),
  mode:z.enum(['solo','team']).default('solo'),
  useLovableReview:z.boolean().default(false),
}).strict();
const inFlight=new Set<string>();
const lastRequest=new Map<string,number>();
/** Solo: one Gemini call. Team: up to 3 free-tier provider calls per explicit user action.
 * Never contacts Lovable and never retries automatically. */
export const generateCode2D=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator((data:unknown)=>input.parse(data))
  .handler(async ({data,context})=>{
    const id=context.userId,now=Date.now();
    if(inFlight.has(id))return {ok:false as const,failure:'busy',model:'',thinkingLevel:'HIGH' as const,message:'Sua geração anterior ainda está em execução.'};
    const retry=cooldownSecondsRemaining(lastRequest.get(id)||0,now);
    if(retry>0)return {ok:false as const,failure:'cooldown',model:'',thinkingLevel:'HIGH' as const,message:ai3dCooldownMessage(retry)};
    inFlight.add(id);lastRequest.set(id,now);
    try{
      if(data.mode==='team'){
        const {generateMultiAgentCode2D}=await import('./server/code2dMultiAgent');
        return await generateMultiAgentCode2D(data.topic,data.aspect,data.duration,data.useLovableReview);
      }
      const {generateCode2DWithGemini}=await import('./server/code2dGemini');
      return await generateCode2DWithGemini(data.topic,data.aspect,data.duration);
    }finally{
      inFlight.delete(id);if(lastRequest.size>2000)lastRequest.clear();
    }
  });
