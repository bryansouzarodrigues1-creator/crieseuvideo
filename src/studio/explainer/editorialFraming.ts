/** Fixed authored coordinates prevent the automatic fit from cancelling moves. */
export type EditorialFraming={x:number;y:number;zoom:number};
export function normalizeEditorialFraming(value:unknown):EditorialFraming|undefined{
 if(!value||typeof value!=='object')return;
 const v=value as Record<string,unknown>;
 const valid=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(!valid(v.x,-240,240)||!valid(v.y,-320,320)||!valid(v.zoom,.5,1.5))return;
 return {x:v.x,y:v.y,zoom:v.zoom};
}
export function fixedEditorialPose(frame:EditorialFraming,zone:{x0:number;y0:number;x1:number;y1:number},u:number){
 const scale=Math.min((zone.x1-zone.x0)/(840*u),(zone.y1-zone.y0)/(720*u))*frame.zoom;
 return {scale,x:(zone.x0+zone.x1)/2+frame.x*u*scale,y:(zone.y0+zone.y1)/2-70*u*scale+frame.y*u*scale};
}
