/** Explicit stage mapping: normalized whole-frame coordinates, independent
 * of the automatic artwork bounds. This avoids recentering cancelling edits. */
export type EditorialFraming={x:number;y:number;scale:number};
export function normalizeEditorialFraming(raw:unknown):EditorialFraming|undefined{
 if(!raw||typeof raw!=='object')return;
 const o=raw as Record<string,unknown>;
 if(typeof o.x!=='number'||!Number.isFinite(o.x)||o.x<.15||o.x>.85||
 typeof o.y!=='number'||!Number.isFinite(o.y)||o.y<.15||o.y>.85||
 typeof o.scale!=='number'||!Number.isFinite(o.scale)||o.scale<.25||o.scale>1.8)return;
 return {x:o.x,y:o.y,scale:o.scale};
}
export function editorialStagePose(f:EditorialFraming,w:number,h:number){
 return {x:f.x*w,y:f.y*h,scale:f.scale};
}
export const FRAMING_GUIDE='Opcional framing: {"x":0.5,"y":0.55,"scale":1.2} fixa a origem do desenho em frações da tela inteira (x,y 0.15–0.85), escala 0.25–1.8. Assim o motor não recentraliza o desenho após mover peças. Use para alinhar com o chão do cenário ou controlar o tamanho. Mantenha toda a ação acima das legendas; caso contrário omita framing para enquadramento automático.';
