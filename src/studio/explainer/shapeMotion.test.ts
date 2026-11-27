import {describe,expect,it} from 'vitest';
import {normalizeDrawing} from './drawing';
import {foregroundExtent,laidOut} from './layout';
import {normalizeShapeMotion,sampleShapeMotion} from './shapeMotion';

describe('Gemini-directed Motion 2D keyframes',()=>{
  it('interpolates two positions at absolute scene time and holds the last pose',()=>{
    const tracks=normalizeShapeMotion([
      {time:0,dx:-200,dy:100,opacity:0,scale:.5,rotation:-45,ease:'linear'},
      {time:2,dx:0,dy:0,opacity:1,scale:1,rotation:0,ease:'linear'},
      {time:4,dx:130,dy:-80,opacity:1,rotation:30,scale:1,ease:'smooth'}
    ])!;
    expect(sampleShapeMotion(tracks,1)).toMatchObject({dx:-100,dy:50,opacity:.5,scale:.75,rotation:-22.5});
    expect(sampleShapeMotion(tracks,2)).toMatchObject({dx:0,dy:0,opacity:1,rotation:0});
    expect(sampleShapeMotion(tracks,999)).toMatchObject({dx:130,dy:-80,rotation:30});
    expect(sampleShapeMotion(tracks,4)).toEqual(sampleShapeMotion(tracks,999));
  });
  it('seeking backwards reproduces exact state without a previous-frame dependency',()=>{
    const tracks=normalizeShapeMotion([{time:0,dx:0},{time:2,dx:200},{time:4,dx:0}])!;
    const a=sampleShapeMotion(tracks,1.23);
    sampleShapeMotion(tracks,3.72);
    expect(sampleShapeMotion(tracks,1.23)).toEqual(a);
  });
  it('applies step easing only at the target key time',()=>{
    const tracks=normalizeShapeMotion([{time:0,opacity:0},{time:3,opacity:1,ease:'step'}])!;
    expect(sampleShapeMotion(tracks,2.999).opacity).toBe(0);
    expect(sampleShapeMotion(tracks,3).opacity).toBe(1);
  });
  it('bounds Gemini JSON, sorts keys, resolves duplicates and ignores nonsense',()=>{
    const tracks=normalizeShapeMotion([
      {time:2,dx:999999,scale:999,opacity:-4,ease:'linear'},
      {time:2,dx:-100,scale:.75,opacity:1},
      {time:1,dx:40},
      {time:NaN,dx:120},
      {},
    ])!;
    expect(tracks.map(t=>t.time)).toEqual([0,1,2]);
    expect(tracks[0]).toMatchObject({dx:0,dy:0,scale:1,opacity:1});
    expect(tracks[2]).toMatchObject({dx:-100,scale:.75,opacity:1});
    expect(normalizeShapeMotion([{time:NaN}])).toBeUndefined();
    expect(sampleShapeMotion([],2)).toMatchObject({dx:0,dy:0,scale:1,opacity:1});
  });
  it('normalizes motion fields with the existing scene shape normalizer',()=>{
    const drawing=normalizeDrawing([{type:'coin',x:0,y:60,anim:'none',delay:0,motion:[
      {time:0,dx:-120,opacity:0},{time:1,dx:0,opacity:1},
    ]}])!;
    expect(drawing[0].motion).toHaveLength(2);
    expect(sampleShapeMotion(drawing[0].motion,1).dx).toBe(0);
  });
  it('includes the whole path in the real Motion 2D framing extent',()=>{
    const base=normalizeDrawing([{type:'circle',x:0,y:30,r:70,anim:'none',delay:0}])!;
    const animated=normalizeDrawing([{type:'circle',x:0,y:30,r:70,anim:'none',delay:0,motion:[
      {time:0,dx:-320,dy:-100},{time:3,dx:300,dy:100,rotation:90,scale:1.3}
    ]}])!;
    const a=foregroundExtent(laidOut(base))!;
    const b=foregroundExtent(laidOut(animated))!;
    expect(b.x0).toBeLessThan(a.x0-200);
    expect(b.x1).toBeGreaterThan(a.x1+200);
    expect(b.y0).toBeLessThan(a.y0-50);
    expect(b.y1).toBeGreaterThan(a.y1+50);
  });
  it('keeps three valid depth layers through normalization and layout',()=>{
    const shapes=normalizeDrawing([
      {type:'circle',x:-250,y:0,r:35,depth:'back'},
      {type:'rect',x:0,y:0,w:60,h:60,depth:'middle'},
      {type:'circle',x:250,y:0,r:35,depth:'front'},
    ])!;
    expect(laidOut(shapes).map(s=>s.depth)).toEqual(['back','middle','front']);
    expect(normalizeDrawing([{type:'circle',depth:'invalid'}])![0].depth).toBe('middle');
  });
  it('keeps old saved drawings without motion compatible',()=>{
    const drawing=normalizeDrawing([{type:'coin',x:0,y:0,anim:'pop',delay:0}])!;
    expect(drawing[0].motion).toBeUndefined();
    expect(sampleShapeMotion(drawing[0].motion,.7)).toMatchObject({dx:0,dy:0,rotation:0,scale:1,opacity:1});
  });
});
