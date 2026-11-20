/** Shared user-facing cooldown contract. Does not invoke a model or store account data. */
export const AI3D_COOLDOWN_MS=30_000;
export const cooldownSecondsRemaining=(last:number,now:number):number=>{
  if(!Number.isFinite(last)||!Number.isFinite(now)||last<=0)return 0;
  return Math.max(0,Math.ceil((last+AI3D_COOLDOWN_MS-now)/1000));
};

/** Stable marker survives server-function error serialization as plain text. */
export const ai3dCooldownMessage=(seconds:number):string=>
  `AI3D_COOLDOWN:${Math.max(1,Math.min(30,Math.ceil(seconds)))}: Aguarde para uma nova tentativa 3D. Este pedido foi bloqueado antes de chamar a IA.`;

export const parseAi3DCooldown=(error:unknown):number|null=>{
  const message=error instanceof Error?error.message:String(error);
  const match=message.match(/AI3D_COOLDOWN:(\d{1,2}):/);
  if(!match)return null;
  const n=Number(match[1]);
  return Number.isInteger(n)&&n>=1&&n<=30?n:null;
};
