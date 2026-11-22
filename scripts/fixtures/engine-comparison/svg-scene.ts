// Standalone HTML/SVG/GSAP approach used in the other chat, newly authored here.
import {gsap} from 'gsap';
export function createSvgScene(holder:HTMLElement){
 holder.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
 <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#9bd6e9"/><stop offset="1" stop-color="#e6edce"/></linearGradient><linearGradient id="cell" x2="1" y2="1"><stop stop-color="#244c8b"/><stop offset="1" stop-color="#092b59"/></linearGradient><linearGradient id="roof" x2="0" y2="1"><stop stop-color="#ca8359"/><stop offset="1" stop-color="#a65942"/></linearGradient><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#c0e7f8" stroke-width="1.6" opacity=".5"/></pattern><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#1a3545" flood-opacity=".17"/></filter><radialGradient id="glow"><stop stop-color="#ffda74" stop-opacity=".75"/><stop offset="1" stop-color="#ffda74" stop-opacity="0"/></radialGradient></defs>
 <rect width="720" height="1280" fill="url(#sky)"/><circle cx="582" cy="230" r="63" fill="#ffe28b"/><circle cx="582" cy="230" r="81" fill="none" stroke="#fff3bb" stroke-width="2" opacity=".6"/>
 <g fill="#f1f8ed" opacity=".86"><path d="M70 255c-35-37 7-70 38-48 14-57 93-45 93 8 48-9 61 44 24 56H75z"/><path d="M433 165c-23-24 5-47 26-32 9-38 62-30 62 6 32-6 40 29 15 37h-100z"/></g>
 <path d="M0 660Q170 540 360 665Q580 530 720 640V1280H0Z" fill="#9cbd8e"/><path d="M0 760Q180 680 355 741Q560 693 720 752V1280H0Z" fill="#cfdbc1"/>
 <g id="world">
 <g transform="translate(436 538)" filter="url(#shadow)"><rect x="-110" y="-111" width="220" height="175" rx="8" fill="#f1dfbd" stroke="#314652" stroke-width="5"/><path d="M-138-112L0-214l138 102z" fill="url(#roof)" stroke="#314652" stroke-width="6" stroke-linejoin="round"/><path d="M-110-112l110-80 110 80" fill="none" stroke="#e3a579" stroke-width="5"/><rect x="34" y="-38" width="47" height="102" rx="4" fill="#7d5a42" stroke="#314652" stroke-width="4"/><circle cx="70" cy="13" r="4" fill="#e8bf6d"/>
 <ellipse id="light-halo" cx="-50" cy="-31" rx="112" ry="104" fill="url(#glow)" opacity="0"/><rect x="-91" y="-70" width="83" height="76" rx="4" fill="#f9efd8" stroke="#314652" stroke-width="4"/><rect id="window" x="-83" y="-62" width="67" height="60" fill="#26475b"/><path d="M-50-62V-2M-83-32h67" stroke="#f5ebd0" stroke-width="5"/></g>
 <path d="M348 904Q406 947 465 896Q540 865 500 731L449 604" fill="none" stroke="#354955" stroke-width="10" stroke-linecap="round"/>
 <path id="current" d="M348 904Q406 947 465 896Q540 865 500 731L449 604" fill="none" stroke="#ffd66d" stroke-width="5" stroke-dasharray="9 16" stroke-linecap="round" opacity="0"/>
 <g id="battery" transform="translate(488 853)" filter="url(#shadow)"><rect x="-43" y="-33" width="86" height="110" rx="9" fill="#3b967e" stroke="#314652" stroke-width="5"/><rect x="-49" y="-45" width="98" height="21" rx="5" fill="#314652"/><rect x="22" y="-55" width="14" height="11" rx="3" fill="#e5b95a"/><rect x="-22" y="-4" width="44" height="43" rx="6" fill="#d9eed8"/><path d="M0 3v28M-14 17h28" stroke="#3b967e" stroke-width="6"/></g>
 <g id="plug" transform="translate(390 797)"><rect x="-13" y="-10" width="26" height="20" rx="5" fill="#f1b651" stroke="#314652" stroke-width="4"/><path d="M13-4h9M13 4h9" stroke="#a6b9c2" stroke-width="4"/></g>
 <g transform="translate(292 813)"><ellipse cy="136" rx="171" ry="23" fill="#314652" opacity=".13"/><path d="M-110 40v87M111 40v87" stroke="#738e99" stroke-width="13"/>
 <g id="panel-base"><rect x="-155" y="-98" width="310" height="224" rx="10" fill="#b6cbd7" stroke="#314652" stroke-width="6"/><rect x="-144" y="-87" width="288" height="202" rx="5" fill="#e7e7df"/></g>
 ${Array.from({length:6},(_,i)=>{const x=-134+(i%3)*92,y=-77+Math.floor(i/3)*96;return `<g id="cell-${i}"><rect x="${x}" y="${y}" width="86" height="88" rx="5" fill="url(#cell)" stroke="#759fc6" stroke-width="2"/><path d="M${x+21} ${y+4}v80m21-80v80m21-80v80M${x+4} ${y+44}h78" fill="none" stroke="#72a3ca" stroke-width="1.2"/></g>`;}).join('')}
 <g id="glass"><rect x="-140" y="-83" width="280" height="194" rx="5" fill="#a1d8eb" fill-opacity=".14" stroke="#dcf3f7" stroke-width="2"/><path d="M-111-74L-34 102M-75-74L2 102" fill="none" stroke="#d4f2f6" stroke-width="11" opacity=".20"/></g></g>
 <g id="worker" transform="translate(115 634)"><ellipse cy="223" rx="52" ry="13" fill="#314652" opacity=".14"/><path d="M-24 125l-8 78M25 125l11 78" stroke="#2d4358" stroke-width="22" stroke-linecap="round"/><path d="M-35 211h28M26 211h29" stroke="#ede8d8" stroke-width="17" stroke-linecap="round"/><path d="M-39 51q39-21 78 0l-7 86h-65z" fill="#e89b48" stroke="#314652" stroke-width="5"/><path d="M-38 63l-19 48" stroke="#b98568" stroke-width="17" stroke-linecap="round"/><g id="arm" transform="translate(35 64)"><path d="M0 0L22 30l30-26" fill="none" stroke="#b98568" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/><circle cx="53" cy="3" r="10" fill="#c49574"/></g><rect x="-11" y="29" width="22" height="24" fill="#a9785c"/><ellipse cy="3" rx="35" ry="42" fill="#c49574" stroke="#314652" stroke-width="5"/><path d="M-34-5q-10-50 34-48 40 2 34 42l-13-20q-27 16-55 26z" fill="#44382f"/><path d="M-18 0h6M12 0h6" stroke="#263b4c" stroke-width="5" stroke-linecap="round"/><path id="smile" d="M-10 20q10-6 20 0" fill="none" stroke="#7f5240" stroke-width="3" stroke-linecap="round"/></g>
 <g id="success" transform="translate(594 458)" opacity="0"><circle r="34" fill="#43a480" stroke="#f2efcf" stroke-width="4"/><path d="M-17 1l12 12 23-27" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
 </g></svg>`;
 const q=(id:string)=>holder.querySelector('#'+id)!;
 const tl=gsap.timeline({paused:true});
 for(let i=0;i<6;i++)tl.fromTo(q('cell-'+i),{y:-250,x:(i%2?1:-1)*26,rotation:(i%2?1:-1)*7},{x:0,y:0,rotation:0,duration:.66,ease:'power2.inOut',immediateRender:true},4.3+i*.33);
 tl.fromTo(q('glass'),{y:-350,opacity:0},{y:0,opacity:1,duration:.92,ease:'power2.inOut',immediateRender:true},6.65);
 tl.to(q('world'),{x:-76,y:-180,scale:1.25,transformOrigin:'360px 720px',duration:.55,ease:'power2.inOut'},3.75);
 tl.to(q('world'),{x:0,y:0,scale:1,duration:.6,ease:'power2.inOut'},7.7);
 tl.to(q('plug'),{x:510,y:798,duration:.7,ease:'power2.inOut'},8.15);
 tl.to(q('current'),{opacity:1,strokeDashoffset:-100,duration:1.8,ease:'none'},8.85);
 tl.to(q('window'),{fill:'#ffda7f',duration:.35},10);
 tl.to(q('light-halo'),{opacity:1,duration:.35},10);
 tl.to(q('success'),{opacity:1,duration:.3},10.35);
 tl.to(q('smile'),{attr:{d:'M-10 17q10 12 20 0'},duration:.3},10.15);
 tl.fromTo(q('arm'),{rotation:0},{rotation:-16,duration:.5,transformOrigin:'0px 0px'},1);
 tl.to(q('arm'),{rotation:12,duration:.5},8.7);
 tl.set({}, {}, 12);
 const svg=holder.querySelector('svg')!;
 return {async render(t:number,ctx:CanvasRenderingContext2D){tl.seek(t,false);const src=new XMLSerializer().serializeToString(svg);const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('SVG rasterization failed'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(src);});ctx.drawImage(img,0,0,720,1280);},dispose(){tl.kill();holder.innerHTML='';}};
}
