import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {visualReviewInput,reviewVisualScene} from './server/geminiVisualReview';
const last=new Map<string,number>(),inFlight=new Set<string>();
export const reviewAi3DWorld=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator(data=>visualReviewInput.parse(data))
  .handler(async({data,context})=>{
    const user=context.userId,now=Date.now();
    if(inFlight.has(user)||now-(last.get(user)??0)<60000)throw Error('Uma revisão por minuto. Nenhuma chamada adicional realizada.');
    if(last.size>=2000)for(const [id,t] of last)if(now-t>=60000)last.delete(id);
    if(last.size>=2000&&!last.has(user))throw Error('Revisão temporariamente ocupada.');
    last.set(user,now);inFlight.add(user);
    try{
      const result=await reviewVisualScene(data);
      if(result.status==='corrected'){
        const {plan,...rest}=result;
        return {...rest,planJson:JSON.stringify(plan)};
      }
      return result;
    }finally{inFlight.delete(user);}
  });
