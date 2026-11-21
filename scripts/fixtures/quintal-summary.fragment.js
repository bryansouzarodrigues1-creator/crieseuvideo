// Inserted inside the existing garden's createScene: reuse its actual models.
// Voice cues come from the supplied recording, cut into a 20-second summary.
const ssKeep=new Set([slab,grass,fence,path,house,beds,cistern,electric,leafFilter,manifold,rain,...trees.map(x=>x.tr)]);
for(const o of scene.children){if(!o.isLight&&!ssKeep.has(o)&&!(o.isMesh&&o.scale.x===250))o.visible=false;}
for(const pair of screens)for(const o of pair)o.visible=false;
for(const o of worldTags)o.visible=false;
cutShell.visible=false;shell.visible=true;
renderer.toneMappingExposure=1.05;hemi.intensity=1.75;sun.intensity=3.15;fill.intensity=.7;
const ssRest=new Map();
function ssSave(o){ssRest.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});return o;}
function ssJoin(o,t,start,duration,dir=[0,1.1,.35],angle=.15){
 const r=ssRest.get(o),u=phase(t,start,start+duration);o.visible=t>=start;
 o.position.copy(r.p).addScaledVector(V(...dir),1-u);o.position.y+=Math.sin(Math.PI*u)*.12;
 const from=r.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(angle,angle*.6,-angle*.4)));
 o.quaternion.copy(from).slerp(r.q,u);o.scale.copy(r.s);
}
const ssWood=bedBoards.map(ssSave),ssSoil=bedSoil.map(ssSave);
const ssBedFixed=beds.children.flatMap(b=>b.children.filter(o=>o.isMesh&&!ssRest.has(o)&&!drippers.includes(o)));
const ssTank=cistern.children.filter(o=>o.isMesh&&o!==cutShell&&o!==tankWater&&o!==surface).map(ssSave);
const ssFilter=leafFilter.children.filter(o=>o.isMesh).map(ssSave);
const ssBattery=electric.children.filter(o=>o.isMesh).map(ssSave);
const ssPump=manifold.children.filter(o=>o.isMesh).map(ssSave);
const ssWater=group(),ssWire=group();
pipe(ssWater,roofRoute,.095,M.navy);
pipe(ssWater,[[-2.73,.32,-5.05],[-2.58,.32,-4.05],[1.72,.32,-4.05],[1.72,.54,-3.35]],.04,M.navy);
const ssWaterParts=ssWater.children.filter(o=>o.isMesh).map(ssSave);
const ssRainFlow=flow(ssWater,roofRoute,15,'#75d9ff',.38,.05);
const ssDripFlow=flow(ssWater,[[-2.73,.32,-5.05],[-2.58,.32,-4.05],[1.72,.32,-4.05],[1.72,.54,-3.35]],12,'#75d9ff',.35,.035);
pipe(ssWire,powerRoute,.028,M.navy);const ssWireParts=ssWire.children.filter(o=>o.isMesh).map(ssSave);
const ssEnergy=flow(ssWire,powerRoute,13,'#f2cf68',.38,.04);
// Re-parent complete panel modules, keeping their frame, glass and grid rigid.
const ssPanelParts=[...panels.children],ssModules=[];
for(let i=0;i<ssPanelParts.length;i+=11){
 const anchor=ssPanelParts[i].position.clone(),g=group(panels,anchor.x,anchor.y,anchor.z);
 for(const o of ssPanelParts.slice(i,i+11)){o.position.sub(anchor);g.add(o);}
 ssModules.push(ssSave(g));
}
const ssTitles=[];
for(const text of ['ÁGUA E LUZ','MONTE A HORTA','GUARDE A CHUVA','ENERGIA NO TELHADO','UM QUINTAL QUE AJUDA','COMENTE QUINTAL']){
 const q=textSprite(text,{w:640,h:82,font:35});q.sp.position.set(width/2,height*.902,0);q.sp.scale.set(width*.88,width*.88*82/640,1);hud.add(q.sp);ssTitles.push(q.sp);
}
function renderSummaryAt(local){
 const t=Math.min(19.999,OFFSET+local);let title=0;
 if(t>=17.32)title=5;else if(t>=14.14)title=4;else if(t>=10.98)title=3;else if(t>=7.05)title=2;else if(t>=4.2)title=1;
 ssTitles.forEach((o,i)=>{o.visible=i===title;});
 if(t<4.2)cam([0,.8,-1.7],[2+t*.05,25,27],25);
 else if(t<7.05)cam([2.8,.6,-.1],[2.6,8.3,10],11.8-(t-4.2)*.12);
 else if(t<10.98)cam([-3,1.5,-5.2],[3.3,6.2,10],8.3-(t-7.05)*.08);
 else if(t<14.14)cam([1.4,3.65,-7.6],[3.8,7.5,8.5],7.0-(t-10.98)*.08);
 else cam([0,.8,-1.7],[2.2,25,27],25-(t-14.14)*.05);
 ssWood.forEach((o,i)=>ssJoin(o,t,4.16+Math.floor(i/4)*.16+(i%4)*.04,.42,[(i%2?1:-1)*.7,.8,.35],(i%2?1:-1)*.23));
 ssSoil.forEach((o,i)=>ssJoin(o,t,4.98+i*.1,.34,[0,.8,0],0));
 ssBedFixed.forEach(o=>{o.visible=t>=5.65;});
 plants.forEach((p,i)=>{const k=phase(t,5.4+(i%10)*.02,6.42+(i%10)*.02);p.visible=k>.002;p.scale.setScalar(p.userData.s*k);p.rotation.z=Math.sin(t*.9+p.userData.phase)*.015;});
 ssTank.forEach((o,i)=>ssJoin(o,t,7.12+Math.min(i,3)*.14,.48,[.35,.9,.3],.08));
 ssFilter.forEach((o,i)=>ssJoin(o,t,7.1+i*.09,.4,[-.5,.5,.1],-.1));
 ssWaterParts.forEach((o,i)=>ssJoin(o,t,7.0+Math.min(i,8)*.055,.42,[0,.7,.15],.08));
 ssBattery.forEach((o,i)=>ssJoin(o,t,8.5+i*.035,.38,[-.25,.6,.35],-.1));
 ssPump.forEach((o,i)=>ssJoin(o,t,7.82+i*.04,.35,[0,.5,.2],.08));
 ssModules.forEach((o,i)=>ssJoin(o,t,12.66+i*.13,.55,[(i%2?1:-1)*.35,2.2,.7],(i%2?1:-1)*.25));
 ssWireParts.forEach((o,i)=>ssJoin(o,t,13.45+i*.025,.32,[0,.4,.1],.04));
 const level=.03+1.4*phase(t,8.85,10.6);tankWater.visible=surface.visible=t>=8.85;
 tankWater.scale.y=level;tankWater.position.y=.18+level/2;surface.position.y=.18+level;M.water.opacity=.73;
 const rainOn=t>=8.13&&t<11.0;rain.visible=rainOn;
 if(rainOn){for(let i=0;i<120;i++){dummy.position.set(-2.85+((i*1.873)%5.7),3+((1-(t*1.2+i*.213)%1)*4.2),-9.6+((i*2.347)%4.1));dummy.rotation.set(0,0,-.14);dummy.scale.set(1,1,1);dummy.updateMatrix();rain.setMatrixAt(i,dummy.matrix);}rain.instanceMatrix.needsUpdate=true;}
 ssRainFlow.active=t>=8.13;ssDripFlow.active=t>=9.3;ssEnergy.active=t>=13.6;
 for(const f of [ssRainFlow,ssDripFlow,ssEnergy])placeFlow(f,t);
 drippers.forEach((o,i)=>{o.visible=t>=9.3;const a=(t*1.4+i*.13)%1;o.position.y=.49-a*.14;});
 porchLight.material.emissiveIntensity=t>=9.3?1.4:.1;backupLight.intensity=t>=9.3?.85:0;
 renderer.autoClear=true;renderer.render(scene,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(hud,hudCamera);
}
