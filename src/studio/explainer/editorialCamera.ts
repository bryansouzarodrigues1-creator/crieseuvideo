/** Bounded, seekable camera direction for layered editorial compositions. */
export const EDITORIAL_SHOTS=['static','slide_left','slide_right','push_in','pull_out'] as const;
export type EditorialShot=typeof EDITORIAL_SHOTS[number];
export type DepthLayer='back'|'middle'|'front';
export function normalizeEditorialShot(value:unknown):EditorialShot|undefined{
  return EDITORIAL_SHOTS.includes(value as EditorialShot)?value as EditorialShot:undefined;
}
export function editorialCameraPose(shot:EditorialShot,layer:DepthLayer,time:number,duration:number,depth:boolean){
  const p=Number.isFinite(time)&&Number.isFinite(duration)&&duration>0?Math.min(1,Math.max(0,time/duration)):0;
  const eased=p*p*(3-2*p);
  const factor=depth?({back:.24,middle:.7,front:1.35}[layer]):1;
  const base=depth?({back:.96,middle:1,front:1.04}[layer]):1;
  const direction=shot==='slide_left'?-1:shot==='slide_right'?1:0;
  const zoom=shot==='push_in'?eased:shot==='pull_out'?1-eased:0;
  return {x:direction*(eased-.5)*80*factor,y:0,scale:base+zoom*.075*factor};
}
/** Conservative bound for all layers and times, in drawing units. */
export const EDITORIAL_CAMERA_MAX_SCALE=1.15;
export const EDITORIAL_CAMERA_MAX_SHIFT=54;
