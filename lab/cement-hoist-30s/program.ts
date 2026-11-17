/**
 * Offline scene recreation study of seconds 0..30 of user-supplied
 * 1000857556.mp4 (177.66s, 720x1280). This is original geometry with
 * reference-inspired beats, NOT original footage, a Gemini output or a
 * fixed production preset. It exercises the existing generic SceneProgram.
 */
export const cementLiftScript =
  'Na obra, carregar sacos de cimento ao quinto andar dá muito trabalho. Uma corda e roldana ajudam a içar uma plataforma com sacos. Um motor e engrenagens transformam velocidade em força.';
export const cementLiftSources = [{sourceId:'s1',text:cementLiftScript,duration:30}];
const id='s1';
const node=(id:string,kind:'group'|'mesh',pos:number[],args:Record<string,unknown>={})=>
  ({id,kind,contextSourceId:'s1',position:pos,...args});
const group=(id:string,pos:number[],parent?:string)=>node(id,'group',pos,parent?{parent}:{});
const mesh=(id:string,shape:string,size:number[],color:string,pos:number[],args:Record<string,unknown>={})=>
  node(id,'mesh',pos,{geometry:{shape,size},color,...args});
const key=(phase:number,value:number[])=>({sourceId:'s1',phase,value});
const track=(node:string,channel:string,points:Array<[number,number[]]>,interpolation='smooth')=>
  ({node,channel,interpolation,keys:points.map(([phase,value])=>key(phase,value))});
const size=(w:number,h:number,d:number)=>[w,h,d];

// Compact, distinctive 3D worker costume, no humanoid rig dependency.
// Character movement is deliberately secondary to the hoist mechanism.
function worker(prefix:string,position:number[],shirt:string) {
  const a:any[]=[];
  a.push(group(prefix,position));
  a.push(mesh(prefix+'-torso','capsule',[.32,.52],shirt,[0,1.13,0],{parent:prefix}));
  a.push(mesh(prefix+'-face','sphere',[.26],'#F2C48D',[0,1.88,0],{parent:prefix,scale:[.95,1.02,.84]}));
  a.push(mesh(prefix+'-hardhat','sphere',[.29],'#FFD439',[0,2.10,0],{parent:prefix,scale:[1.10,.42,1.04]}));
  a.push(mesh(prefix+'-brim','cylinder',[.34,.34,.06],'#E5B71F',[0,2.065,.10],{parent:prefix}));
  a.push(mesh(prefix+'-nose','sphere',[.055],'#E6A672',[0,1.85,.245],{parent:prefix}));
  for (const side of ['l','r']) {
    const sign=side==='l'?-1:1;
    a.push(mesh(prefix+'-eye-'+side,'sphere',[.045],'#1D2733',[sign*.105,1.94,.212],{parent:prefix}));
    a.push(group(prefix+'-arm-'+side,[sign*.36,1.53,0],prefix));
    a.push(mesh(prefix+'-sleeve-'+side,'capsule',[.12,.47],shirt,[0,-.30,0],{parent:prefix+'-arm-'+side}));
    a.push(mesh(prefix+'-glove-'+side,'sphere',[.105],'#E4A872',[0,-.58,0],{parent:prefix+'-arm-'+side}));
    a.push(group(prefix+'-leg-'+side,[sign*.16,.90,0],prefix));
    a.push(mesh(prefix+'-pants-'+side,'capsule',[.14,.62],'#174F8F',[0,-.35,0],{parent:prefix+'-leg-'+side}));
    a.push(mesh(prefix+'-shoe-'+side,'box',[.24,.14,.41],'#25435A',[0,-.80,.105],{parent:prefix+'-leg-'+side,geometry:{shape:'box',size:[.24,.14,.41],bevel:.035}}));
  }
  return a;
}
export function cementLift30sProgram(){
  const n:any[] = [
    mesh('site-floor','box',[150,.18,150],'#C6B28D',[0,-.12,0]),
    mesh('site-fence','box',[24,3,.16],'#D8D3C6',[1,1.50,-11.6]),
    mesh('site-fence-stripe','box',[24,.13,.18],'#237ABC',[1,2.25,-11.48]),
  ];
  // Low-poly city skyline and window grids: real depth behind the main set.
  const city=[
    [-11,-12,6,'#C8D6D6'],[-6,-14,9,'#EBC7B4'],[1,-18,12,'#F0D5A9'],
    [9,-15,8,'#BFD7DA'],[15,-13,7,'#D0C7E6'],
  ] as const;
  city.forEach(([x,z,h,c],i)=>{
    n.push(mesh('city-'+i,'box',[4,h,3],c,[x,h/2,z]));
    n.push(mesh('city-roof-'+i,'box',[4.15,.3,3.15],'#C36B4E',[x,h+.14,z]));
    n.push(mesh('city-windows-'+i,'box',[.53,.70,.07],'#EFF5E6',[x-1.10,1.7,z+1.55],
      {repeat:{count:2,step:[2.13,0,0],jitter:[0,0,0],seed:1}}));
  });
  // Five-level building frame. Each level visibly separated by concrete slabs.
  n.push(group('building',[1.1,0,-2.0]));
  for(let level=1;level<=5;level++){
    const y=level*2;
    n.push(mesh('floor-'+level,'box',[5.8,.26,4.4],'#CBD2D8',[0,y,0],{parent:'building'}));
    n.push(mesh('floor-lip-'+level,'box',[5.9,.10,4.5],'#87959C',[0,y-.12,0],{parent:'building'}));
  }
  for(const x of [-2.65,2.65])for(const z of [-1.93,1.93]){
    n.push(mesh('column-'+(x<0?'l':'r')+'-'+(z<0?'b':'f'),'box',[.26,10.1,.26],'#B7BFC6',[x,5.04,z],{parent:'building'}));
  }
  for (let level=0;level<3;level++){
    const y=.75+level*2;
    n.push(mesh('brick-wall-'+level,'box',[5.10,1.50,.16],'#B9503C',[0,y,1.89],{parent:'building'}));
    n.push(mesh('brick-window-'+level,'box',[.92,.84,.17],'#24303A',[.7,y+.12,2.02],{parent:'building'}));
    n.push(mesh('brick-window-b-'+level,'box',[.92,.84,.17],'#293A42',[-1.15,y+.12,2.02],{parent:'building'}));
    n.push(mesh('brick-band-'+level,'box',[5.13,.08,.19],'#E9D3B4',[0,y+.67,2.01],{parent:'building'}));
  }
  // Visible external construction staircase, scaffold and safety rail.
  n.push(group('stair-scaffold',[-2.50,0,1.30]));
  for (const x of [-.53,.55]) n.push(mesh('scaffold-pole-'+(x<0?'l':'r'),'cylinder',[.055,.055,10.7],'#687E82',[x,5.35,0],{parent:'stair-scaffold'}));
  for(let i=0;i<5;i++){
    const y=.55+i*1.95;
    n.push(mesh('stair-flight-'+i,'box',[1.35,.14,2.30],'#8F7958',[0,y+1.05,0],
      {parent:'stair-scaffold',rotation:[-.45,0,0]}));
    n.push(mesh('stair-landing-'+i,'box',[1.37,.16,.92],'#B59B77',[0,y+1.75,-.68],{parent:'stair-scaffold'}));
    n.push(mesh('stair-rail-'+i,'box',[.08,1.25,2.55],'#6D7777',[.72,y+1.65,0],{parent:'stair-scaffold',rotation:[-.45,0,0]}));
  }
  // Stack of cement sacks: double-layer sacks and green brand bands.
  n.push(group('cement-pile',[-5.6,0,-.05]));
  for(let lane=0;lane<4;lane++)for(let level=0;level<3;level++){
    const root='bagrow-'+lane+'-'+level;
    n.push(mesh(root,'box',[1.02,.25,.56],'#E8E6DB',[-.5,.19+level*.26,lane*.72],{
      parent:'cement-pile',geometry:{shape:'box',size:[1.02,.25,.56],bevel:.095},
      repeat:{count:4,step:[1.08,0,0],jitter:[0,0,0],seed:11}}));
    n.push(mesh('band-'+lane+'-'+level,'box',[.18,.265,.58],'#41806A',[-.5,.20+level*.26,lane*.72],{
      parent:'cement-pile',repeat:{count:4,step:[1.08,0,0],jitter:[0,0,0],seed:11}}));
  }
  // Laborers in recognizable safety colors; one at the top of the 5th floor.
  n.push(...worker('worker-ground',[-4.7,0,3.15],'#E9C323'));
  n.push(...worker('worker-upper',[2.20,10.15,-.60],'#4383B0'));
  n.push(mesh('bag-on-shoulder','box',[.95,.37,.5],'#E3E1D4',[.37,1.88,-.02],{
    parent:'worker-ground',rotation:[0,0,.32],geometry:{shape:'box',size:[.95,.37,.5],bevel:.12}}));
  n.push(mesh('bag-shoulder-band','box',[.20,.39,.52],'#4D987B',[.37,1.88,-.02],{
    parent:'worker-ground',rotation:[0,0,.32]}));

  // Functional lift: pallet, load, ropes, pulley and wooden winch stand.
  n.push(group('lift-assembly',[-.45,0,1.35]));
  n.push(group('pallet',[0,.42,0],'lift-assembly'));
  n.push(mesh('pallet-bed','box',[1.65,.18,1.2],'#A87245',[0,0,0],{parent:'pallet'}));
  for(const x of [-.62,0,.62])
    n.push(mesh('pallet-slat-'+(x<0?'l':x>0?'r':'c'),'box',[.39,.10,1.16],'#D1A477',[x,.13,0],{parent:'pallet'}));
  for(let layer=0;layer<2;layer++){
    n.push(mesh('pallet-cement-'+layer,'box',[.48,.31,.54],'#EDEBE1',[-.52,.32+layer*.34,-.26],{
      parent:'pallet',geometry:{shape:'box',size:[.48,.31,.54],bevel:.085},
      repeat:{count:3,step:[.52,0,0],jitter:[0,0,0],seed:17}}));
    n.push(mesh('pallet-stripe-'+layer,'box',[.10,.32,.55],'#3F9F79',[-.52,.32+layer*.34,-.26],{
      parent:'pallet',repeat:{count:3,step:[.52,0,0],jitter:[0,0,0],seed:17}}));
  }
  n.push(group('lifting-yoke',[0,.65,0],'pallet'));
  for(const x of [-.65,.65]){
    n.push(mesh('sling-'+(x<0?'l':'r'),'tube',[.028],'#31619A',[0,0,0],{
      parent:'lifting-yoke',geometry:{shape:'tube',size:[.028],
        points:[[x,-.37,0],[0,.65,0]]}}));
  }
  n.push(mesh('hook','torus',[.11,.045],'#E6AE36',[0,.72,0],{parent:'lifting-yoke'}));

  n.push(group('pulley-stand',[-.45,0,1.35]));
  n.push(mesh('wood-post-l','box',[.24,10.3,.26],'#997047',[-1.28,5.15,0],{parent:'pulley-stand'}));
  n.push(mesh('wood-post-r','box',[.24,10.3,.26],'#997047',[1.30,5.15,0],{parent:'pulley-stand'}));
  n.push(mesh('wood-top','box',[3.1,.25,.36],'#B1844E',[0,10.39,0],{parent:'pulley-stand'}));
  n.push(group('upper-pulley',[0,10.08,0],'pulley-stand'));
  n.push(mesh('upper-wheel','torus',[.27,.10],'#CE3D3D',[0,0,0],{parent:'upper-pulley'}));
  n.push(mesh('upper-hub','cylinder',[.08,.08,.19],'#3D4655',[0,0,.03],{parent:'upper-pulley',rotation:[Math.PI/2,0,0]}));
  n.push(group('lift-rope',[0,10.0,0],'pulley-stand'));
  n.push(mesh('rope-body','cylinder',[.028,.028,1],'#D4B47E',[0,-4.63,0],{parent:'lift-rope',scale:[1,9.26,1]}));
  n.push(mesh('return-rope','cylinder',[.03,.03,9.6],'#D6B27A',[-.5,5.1,.05],{parent:'pulley-stand'}));
  n.push(group('rope-handle',[-.50,1.0,.06],'pulley-stand'));
  n.push(mesh('rope-handle-bar','box',[.48,.09,.15],'#B8925D',[0,0,0],{parent:'rope-handle'}));

  // Winch motor: recognizable finned blue body, drum, power cable,
  // counter-rotating gold/red gears (rather than decorative colored balls).
  n.push(group('motor-system',[5.25,0,2.35]));
  n.push(mesh('motor-foot','box',[3.2,.22,1.9],'#182C46',[0,.15,0],{parent:'motor-system'}));
  n.push(group('motor-body',[-.70,.83,0],'motor-system'));
  n.push(mesh('motor-shell','cylinder',[.72,.72,1.55],'#2160B1',[0,0,0],{
    parent:'motor-body',rotation:[0,0,Math.PI/2]}));
  for(let i=0;i<7;i++)n.push(mesh('motor-fin-'+i,'box',[.085,1.54,1.50],'#154B95',[-.65+i*.21,0,0],{parent:'motor-body'}));
  n.push(mesh('motor-cap','cylinder',[.74,.74,.16],'#18457C',[-.80,0,0],{parent:'motor-body',rotation:[0,0,Math.PI/2]}));
  n.push(group('big-gear',[.91,1.18,.85],'motor-system'));
  n.push(mesh('big-gear-wheel','cylinder',[.99,.99,.21],'#D8A63D',[0,0,0],{parent:'big-gear',rotation:[Math.PI/2,0,0]}));
  n.push(mesh('big-gear-hub','cylinder',[.22,.22,.30],'#5A6A77',[0,0,.16],{parent:'big-gear',rotation:[Math.PI/2,0,0]}));
  for(let i=0;i<16;i++){let a=2*Math.PI*i/16;
    n.push(mesh('big-tooth-'+i,'box',[.25,.29,.27],'#CA9632',
      [Math.cos(a)*.95,Math.sin(a)*.95,.02],{parent:'big-gear',rotation:[0,0,a]}));}
  n.push(group('small-gear',[-.42,.80,1.15],'motor-system'));
  n.push(mesh('small-gear-wheel','cylinder',[.37,.37,.20],'#B64D3B',[0,0,0],{parent:'small-gear',rotation:[Math.PI/2,0,0]}));
  for(let i=0;i<10;i++){let a=2*Math.PI*i/10;
    n.push(mesh('small-tooth-'+i,'box',[.14,.16,.21],'#A64136',
      [Math.cos(a)*.34,Math.sin(a)*.34,.03],{parent:'small-gear',rotation:[0,0,a]}));}
  n.push(group('drum',[1.85,.66,-.15],'motor-system'));
  n.push(mesh('drum-core','cylinder',[.42,.42,1.15],'#1B509C',[0,0,0],{parent:'drum',rotation:[0,0,Math.PI/2]}));
  n.push(mesh('drum-flange-r','cylinder',[.52,.52,.12],'#3069B3',[.52,0,0],{parent:'drum',rotation:[0,0,Math.PI/2]}));
  n.push(mesh('drum-flange-l','cylinder',[.52,.52,.12],'#3069B3',[-.52,0,0],{parent:'drum',rotation:[0,0,Math.PI/2]}));
  n.push(mesh('power-cable','tube',[.06],'#2C394A',[0,0,0],{parent:'motor-system',geometry:{
    shape:'tube',size:[.06],points:[[-1.1,.52,-.44],[-1.8,.32,-.4],[-2.25,.05,-.18]]}}));

  const tracks:any[]=[
    track('worker-ground','position',[[0,[-4.7,0,3.15]],[.035,[-4.7,0,3.15]],[.18,[-2.75,0,2.65]],[.30,[-2.75,0,2.65]]]),
    track('worker-ground','rotation',[[0,[0,0,0]],[.30,[0,0,0]]]),
    track('pallet','position',[[0,[0,.42,0]],[.48,[0,.42,0]],[.54,[0,.42,0]],[.67,[0,5.3,0]],[.77,[0,7.65,0]],[1,[0,7.65,0]]]),
    track('rope-body','scale',[[0,[1,9.26,1]],[.54,[1,9.26,1]],[.67,[1,4.38,1]],[.77,[1,2.03,1]],[1,[1,2.03,1]]]),
    track('rope-body','position',[[0,[0,-4.63,0]],[.54,[0,-4.63,0]],[.67,[0,-2.19,0]],[.77,[0,-1.015,0]],[1,[0,-1.015,0]]]),
    track('upper-pulley','rotation',[[0,[0,0,0]],[.50,[0,0,0]],[.77,[0,0,15]],[1,[0,0,15]]],'linear'),
    track('big-gear','rotation',[[0,[0,0,0]],[.70,[0,0,0]],[1,[0,0,33]]],'linear'),
    track('small-gear','rotation',[[0,[0,0,0]],[.70,[0,0,0]],[1,[0,0,-61]]],'linear'),
    track('drum','rotation',[[0,[0,0,0]],[.70,[0,0,0]],[1,[0,0,45]]],'linear'),
    track('rope-handle','position',[[0,[-.50,1,.06]],[.37,[-.50,1,.06]],[.42,[-.50,.56,.06]],[.46,[-.50,1,.06]],[.52,[-.50,.58,.06]],[.56,[-.50,1,.06]],[1,[-.50,1,.06]]],'smooth'),
  ];
  // A faster gait than our previous robotic walk: physically separate moving
  // legs in the authored scene, while the main machine gets cinematic attention.
  for(const side of ['l','r']){
    const sign=side==='l'?1:-1;
    const pts:Array<[number,number[]]>=[];
    for(let i=0;i<=16;i++)pts.push([i*.012, [Math.sin(i*Math.PI/2)*.50*sign,0,0]]);
    pts.push([.24,[0,0,0]],[1,[0,0,0]]);
    tracks.push(track('worker-ground-leg-'+side,'rotation',pts,'smooth'));
    tracks.push(track('worker-ground-arm-'+side,'rotation',pts.map(([p,v])=>[p,[-v[0]*.68,0,0]]),'smooth'));
  }
  return {
    version:1,background:'#A7DCF0',nodes:n,tracks,
    // Five hard cuts: worker, construction set, pulley, rising pallet, motor.
    shots:[{sourceId:'s1',subjects:['building','pallet'],azimuth:.38,endAzimuth:.38,elevation:.17,distance:1.04,cuts:[
      {phase:0,subjects:['worker-ground','cement-pile','stair-scaffold'],azimuth:.52,elevation:.20,distance:1.06},
      {phase:.24,subjects:['building','worker-upper','cement-pile'],azimuth:.45,elevation:.16,distance:1.04},
      {phase:.40,subjects:['upper-pulley','rope-handle','worker-upper'],azimuth:.65,elevation:.13,distance:1.02},
      {phase:.54,subjects:['pallet','upper-pulley','building'],azimuth:.49,elevation:.14,distance:1.08},
      {phase:.78,subjects:['motor-system','big-gear','small-gear'],azimuth:.28,elevation:.15,distance:1.10},
    ]}],
    contacts:[],
    motionChecks:[
      {sourceId:'s1',node:'worker-ground',channel:'position',kind:'change',startPhase:.035,endPhase:.18,threshold:1.20},
      {sourceId:'s1',node:'pallet',channel:'position',kind:'hold',startPhase:.02,endPhase:.5,threshold:.025},
      {sourceId:'s1',node:'pallet',channel:'position',kind:'change',startPhase:.55,endPhase:.77,threshold:6},
      {sourceId:'s1',node:'big-gear',channel:'rotation',kind:'change',startPhase:.78,endPhase:1,threshold:15},
      {sourceId:'s1',node:'small-gear',channel:'rotation',kind:'change',startPhase:.78,endPhase:1,threshold:25},
    ],
  };
}
