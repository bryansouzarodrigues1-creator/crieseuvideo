/**
 * Motion 2D absolute-time direction. Gemini writes bounded, declarative cues;
 * the renderer evaluates them at a requested scene-local time.
 * No eval, script execution, wall clocks, or additional AI requests.
 */
export type MotionEase = 'smooth' | 'linear' | 'step';
export interface ShapeMotionKey {
  time: number;     // scene-local seconds; 0–30
  dx: number;       // offset from the layout-corrected shape anchor
  dy: number;
  rotation: number; // additive degrees
  scale: number;    // relative factor
  opacity: number;  // 0–1
  ease: MotionEase; // easing for the segment ending AT this key
}
export type ShapeMotionPose = Omit<ShapeMotionKey, 'time' | 'ease'>;
export const MOTION_KEY_LIMIT = 12;
export const MOTION_TIME_LIMIT = 30;

const pose: ShapeMotionPose = {dx:0,dy:0,rotation:0,scale:1,opacity:1};
const finite = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
};

export function normalizeShapeMotion(raw: unknown): ShapeMotionKey[] | undefined {
  if(!Array.isArray(raw) || !raw.length) return undefined;
  const keys: ShapeMotionKey[]=[];
  for(const item of raw.slice(0, MOTION_KEY_LIMIT)){
    if(!item || typeof item !== 'object') continue;
    const m=item as Record<string, unknown>;
    if(typeof m.time !== 'number' || !Number.isFinite(m.time)) continue;
    keys.push({
      time:finite(m.time,0,0,MOTION_TIME_LIMIT),
      dx:finite(m.dx,0,-440,440),
      dy:finite(m.dy,0,-440,440),
      rotation:finite(m.rotation,0,-360,360),
      scale:finite(m.scale,1,0.05,3),
      opacity:finite(m.opacity,1,0,1),
      ease:m.ease==='linear'||m.ease==='step'?'linear'===m.ease?'linear':'step':'smooth',
    });
  }
  if(!keys.length) return undefined;
  keys.sort((a,b)=>a.time-b.time);
  // At a duplicate time the last authored key wins, with stable explicit semantics.
  const ordered:ShapeMotionKey[]=[];
  for(const key of keys){
    if(ordered.length && ordered[ordered.length-1]!.time===key.time) ordered[ordered.length-1]=key;
    else ordered.push(key);
  }
  if(ordered[0]!.time>0)ordered.unshift({time:0,...pose,ease:'smooth'});
  return ordered;
}
const smooth = (x:number)=>x*x*(3-2*x);
export function sampleShapeMotion(motion: readonly ShapeMotionKey[] | undefined, localSeconds:number):ShapeMotionPose {
  if(!motion?.length) return {...pose};
  if(!Number.isFinite(localSeconds)) return {...pose};
  const t=Math.max(0,localSeconds);
  if(t<=motion[0]!.time) return fields(motion[0]!);
  for(let i=1;i<motion.length;i++){
    const right=motion[i]!;
    if(t>right.time)continue;
    const left=motion[i-1]!;
    const duration=right.time-left.time;
    const p=duration>0?Math.max(0,Math.min(1,(t-left.time)/duration)):1;
    const a=right.ease==='step' ? (p>=1?1:0):right.ease==='linear'?p:smooth(p);
    return {
      dx:left.dx+(right.dx-left.dx)*a,
      dy:left.dy+(right.dy-left.dy)*a,
      rotation:left.rotation+(right.rotation-left.rotation)*a,
      scale:left.scale+(right.scale-left.scale)*a,
      opacity:left.opacity+(right.opacity-left.opacity)*a,
    };
  }
  return fields(motion[motion.length-1]!);
}
function fields(k:ShapeMotionKey):ShapeMotionPose {
  return {dx:k.dx,dy:k.dy,rotation:k.rotation,scale:k.scale,opacity:k.opacity};
}

export const MOTION_GUIDE = `
Movimentos originais por objeto: cada forma do desenho pode ter "motion":[{"time":0,"dx":-150,"dy":80,"scale":0.6,"opacity":0,"rotation":-15},{"time":0.8,"dx":0,"dy":0,"scale":1,"opacity":1,"rotation":0},{"time":2.7,"dx":120,"dy":-50,"rotation":40}].
"time" é segundos após o início DA CENA; dx/dy são deslocamentos do objeto a partir da posição do layout, NÃO coordenadas absolutas. O objeto fica parado após a última chave. Interpolação é smooth por padrão, use "ease":"linear" ou "ease":"step" para transições específicas.
Use "anim":"none" no objeto com "motion" para evitar misturar balanço automático com ações dirigidas. Um mesmo objeto deve ter 2 a 6 chaves, 0 a 8 segundos; não mova objetos fora do enquadramento. Crie acontecimentos identificáveis: chegar -> encostar -> mover junto -> soltar; linha com ponta e objeto devem compartilhar os mesmos dx/dy nos instantes de contato. Os elementos sem movimento continuam estáticos.
É proibido escrever JS, SVG, HTML ou fórmulas dentro do JSON: apenas tipos desenháveis, cores e chaves numéricas. Não invente propriedades do motor.
`;
