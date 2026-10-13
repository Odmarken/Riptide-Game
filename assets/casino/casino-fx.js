/* 🎰 The casino's show (2026-10-11 - "ändra symbolerna till coolare ... mer effekter och coolare saker som sker på skärmen ... mer
   interaktioner med ljus", then "gör liknande på resten av alla casino spel"): the light bulbs round the cabinets and tables, Lucky 7's
   lever, the glass, the reel stops and the teased third reel, coins, beams, rays, fireworks, the sea's water light, bubbles and
   electric locks, the roulette wheel with its ball, cards that flash as they land, and the banners that count a win up.

   Look only. game.js decides every outcome and tells this what happened through l7Look/seaLook (each call wrapped, so a failure
   here never reaches a spin); nothing here touches gold, saves or the odds, and every entry point is safe with the window shut,
   half-built or never opened. It draws on two canvases inside the window - one behind the cabinet (rays), one in front (bulbs,
   coins, sparks) - and runs only while a machine is open. */
(function(){
'use strict';
const TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const now=()=>performance.now();
const mq=q=>{try{return matchMedia(q).matches;}catch(e){return false;}};
const calmMotion=()=>mq('(prefers-reduced-motion: reduce)');
const scale=()=>mq('(max-width:600px)')?.6:1;                   /* a phone gets fewer coins, the same show */
const hex2=(h,a)=>{const n=parseInt(h.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};

/* sounds go through the game's own SFX bus (blip/noiseHit/noiseSweep), so its volume and mute apply */
const tone=(f0,f1,d,v,t)=>{if(typeof blip==='function')blip(f0,f1,d,v,t);};
const thud=(d,v,f)=>{if(typeof noiseHit==='function')noiseHit(d,v,f);};
const swish=(d,v,a,b)=>{if(typeof noiseSweep==='function')noiseSweep(d,v,a,b);};

/* ---------- sprites, drawn once ---------- */
const SPR=Object.create(null);
function spr(key,size,draw){
 let c=SPR[key];if(c)return c;
 c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);
 return SPR[key]=c;
}
const glowSpr=col=>spr('g'+col,64,(g,s)=>{
 const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
 r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.16,hex2(col,1));r.addColorStop(.42,hex2(col,.32));r.addColorStop(1,hex2(col,0));
 g.fillStyle=r;g.fillRect(0,0,s,s);
});
const coinSpr=back=>spr(back?'coinB':'coinF',56,(g,s)=>{
 const c=s/2,R=s/2-2;
 const gr=g.createRadialGradient(c-R*.35,c-R*.4,R*.1,c,c,R);
 gr.addColorStop(0,back?'#f1cf78':'#fff6c2');gr.addColorStop(.45,back?'#c48a26':'#f7c443');gr.addColorStop(1,back?'#6e440d':'#a36a15');
 g.fillStyle=gr;g.beginPath();g.arc(c,c,R,0,TAU);g.fill();
 g.lineWidth=R*.13;g.strokeStyle=back?'#5e3a0b':'#8a5810';g.beginPath();g.arc(c,c,R*.76,0,TAU);g.stroke();
 g.lineWidth=2;g.strokeStyle='rgba(255,244,200,.85)';g.beginPath();g.arc(c,c,R-1.5,Math.PI*1.08,Math.PI*1.75);g.stroke();
 g.fillStyle=back?'rgba(94,58,11,.55)':'rgba(138,88,16,.55)';g.beginPath();g.arc(c,c,R*.3,0,TAU);g.fill();
 g.fillStyle=back?'rgba(255,220,140,.3)':'rgba(255,252,220,.65)';g.beginPath();g.arc(c-R*.07,c-R*.08,R*.16,0,TAU);g.fill();
});
const gearSpr=()=>spr('gear',48,(g,s)=>{
 const c=s/2,R=s*.46,r=s*.34,n=8;
 g.beginPath();
 for(let i=0;i<n;i++){
  const a=i/n*TAU,w=TAU/n*.26;
  g.lineTo(c+Math.cos(a-w*1.6)*r,c+Math.sin(a-w*1.6)*r);g.lineTo(c+Math.cos(a-w)*R,c+Math.sin(a-w)*R);
  g.lineTo(c+Math.cos(a+w)*R,c+Math.sin(a+w)*R);g.lineTo(c+Math.cos(a+w*1.6)*r,c+Math.sin(a+w*1.6)*r);
 }
 g.closePath();
 const gr=g.createLinearGradient(0,0,s,s);gr.addColorStop(0,'#ffd08a');gr.addColorStop(.5,'#b8742c');gr.addColorStop(1,'#5a330f');
 g.fillStyle=gr;g.fill();g.lineWidth=1.5;g.strokeStyle='#3a2008';g.stroke();
 g.globalCompositeOperation='destination-out';g.beginPath();g.arc(c,c,s*.12,0,TAU);g.fill();
 g.globalCompositeOperation='source-over';g.lineWidth=2;g.strokeStyle='rgba(255,226,170,.7)';g.beginPath();g.arc(c,c,s*.2,Math.PI,Math.PI*1.7);g.stroke();
});
const starSpr=()=>spr('star',64,(g,s)=>{
 const c=s/2;
 const ray=(w,h)=>{const r=g.createRadialGradient(c,c,0,c,c,h);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.beginPath();g.moveTo(c-h,c);g.quadraticCurveTo(c,c-w,c+h,c);g.quadraticCurveTo(c,c+w,c-h,c);g.fill();};
 ray(3.2,c);g.save();g.translate(c,c);g.rotate(Math.PI/2);g.translate(-c,-c);ray(3.2,c);g.restore();
 g.save();g.translate(c,c);g.rotate(Math.PI/4);g.translate(-c,-c);ray(1.6,c*.55);g.rotate(Math.PI/2);g.restore();
 const r=g.createRadialGradient(c,c,0,c,c,c*.3);r.addColorStop(0,'rgba(255,255,255,.95)');r.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=r;g.fillRect(0,0,s,s);
});
const bubbleSpr=()=>spr('bubble',32,(g,s)=>{
 const c=s/2,R=s/2-2;
 const r=g.createRadialGradient(c,c,R*.55,c,c,R);r.addColorStop(0,'rgba(170,230,255,0)');r.addColorStop(.85,'rgba(170,230,255,.35)');r.addColorStop(1,'rgba(220,250,255,.75)');
 g.fillStyle=r;g.beginPath();g.arc(c,c,R,0,TAU);g.fill();
 g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.ellipse(c-R*.35,c-R*.4,R*.22,R*.13,-.6,0,TAU);g.fill();
});
const pearlSpr=()=>spr('pearl',32,(g,s)=>{
 const c=s/2,R=s/2-2;
 const r=g.createRadialGradient(c-R*.35,c-R*.35,1,c,c,R);r.addColorStop(0,'#ffffff');r.addColorStop(.5,'#f2e9f6');r.addColorStop(1,'#a99bb8');
 g.fillStyle=r;g.beginPath();g.arc(c,c,R,0,TAU);g.fill();
});
/* the sea's dancing water light: a seamless Voronoi edge web (F2-F1), bright on the cell borders, as a CSS background */
let causticURL=null;
function caustic(){
 if(causticURL)return causticURL;
 const S=160,c=document.createElement('canvas');c.width=c.height=S;
 const g=c.getContext('2d'),img=g.createImageData(S,S),d=img.data,pts=[];
 for(let i=0;i<13;i++)pts.push([Math.random()*S,Math.random()*S]);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  let f1=1e9,f2=1e9;
  for(const p of pts){let dx=Math.abs(x-p[0]),dy=Math.abs(y-p[1]);if(dx>S/2)dx=S-dx;if(dy>S/2)dy=S-dy;const q=dx*dx+dy*dy;if(q<f1){f2=f1;f1=q;}else if(q<f2)f2=q;}
  const e=Math.sqrt(f2)-Math.sqrt(f1),v=Math.exp(-e*e/14)*.9,i=(y*S+x)*4;
  d[i]=200;d[i+1]=246;d[i+2]=255;d[i+3]=Math.round(v*255);
 }
 g.putImageData(img,0,0);
 try{causticURL=c.toDataURL('image/png');}catch(e){causticURL='';}
 return causticURL;
}

/* ---------- the machines and tables ----------
   box: the cabinet inside the window · reels: its reel windows (the slots) · stage: where coins rise and a banner sits ·
   bulb: the colour of the lights round the box (none at Sebbe's street table) · glint: what catches the light now and then ·
   display: the window is shown by style.display, not by .open (the duel) */
const TABLES={
 slotFx:{box:'.slotmach',reels:'.slotwin',bulb:'#ffcf7a',lever:true,lamp:true},
 seaFx:{box:'.slotmach',reels:'.seacolwin',bulb:'#7fe3ff',water:true},
 bjFx:{box:'.slotmach',stage:'.bjcards',bulb:'#ffd98a',spot:true,glint:'.bjcard:not(.back)'},
 rouFx:{box:'.slotmach',stage:'#rouWheel',bulb:'#ffcf7a',spot:true},
 rtbFx:{box:'.slotmach',stage:'#rtbCards',bulb:'#ffcf7a',spot:true,glint:'#rtbCards .bjcard:not(.back)'},
 sebbeFx:{box:'.slotmach',stage:'#cupRow',bulb:null,lantern:true,glint:'.cupball.show'},
 gvbFx:{box:'.casinobox',stage:'#gvbSides',bulb:'#ffd76a',display:true},
 casinoMenu:{box:'.casinobox',bulb:'#ffcf7a',glint:'.casinopick .cg img'},
 fiveFx:{box:'.slotmach',reels:'.fivecol',bulb:'#ff7a45',embers:true,glint:'.fivecell.fivefive img'},
};
const M=Object.create(null);
let raf=0;
const BULB={sea:'#7fe3ff',gold:'#ffd76a',red:'#ff7a5a'};

function el(tag,cls,parent){const e=document.createElement(tag);if(cls)e.className=cls;if(parent)parent.appendChild(e);return e;}
function retrigger(e,cls){if(!e)return;e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls);}
/* a one-shot animation class, taken off again once it has played - left on, it replayed whenever a later class let go */
function pulse(e,cls,ms){if(!e)return;retrigger(e,cls);clearTimeout(e['_t'+cls]);e['_t'+cls]=setTimeout(()=>e.classList.remove(cls),ms);}

function machine(id){
 let m=M[id];if(m&&m.ov.isConnected)return m;
 const cfg=TABLES[id],ov=cfg&&document.getElementById(id),box=ov&&ov.querySelector(cfg.box);
 if(!box)return null;
 m=M[id]={id,ov,box,cfg,sea:!!cfg.water,live:false,last:0,o:{left:0,top:0,width:0,height:0},
  parts:[],fx:[],mode:'idle',modeUntil:0,lastAct:0,spinning:false,tease:null,shine:null,count:null,banUntil:0,
  mx:-1e4,my:-1e4,mouseT:0,emit:[],known:new WeakSet(),free:false,row:null,nextGlint:now()+3000,clink:0,boltT:0,bolts:null};
 build(m);
 return m;
}
function build(m){
 const {ov,box}=m;
 m.back=el('canvas','sfxcv back');ov.insertBefore(m.back,ov.firstChild);
 m.front=el('canvas','sfxcv front',ov);
 m.bctx=m.back.getContext('2d');m.fctx=m.front.getContext('2d');
 m.ban=el('div','sfxban',ov);el('div','sfxban-t',m.ban);el('div','sfxban-n',m.ban);
 m.flash=el('div','sfxflash',ov);
 box.classList.add('sfxmach');
 el('div','sfxsheen',box);
 const cfg=m.cfg;
 if(cfg.water){
  const w=el('div','sfxwater',box),url=caustic();
  for(const k of ['a','b']){const c=el('div','sfxcaus '+k,w);if(url)c.style.backgroundImage=`url(${url})`;}
  for(let i=0;i<3;i++)el('div','sfxray r'+i,w);
 }
 if(cfg.lamp)el('div','sfxlamp',box);
 if(cfg.spot)el('div','sfxspot',box);       /* a warm light hanging over the cloth */
 if(cfg.lantern)el('div','sfxlantern',box); /* Sebbe's lantern, flickering */
 for(const w of wins(m))el('div','sfxglass',w);
 if(cfg.lever)lever(m);
 /* the light follows the hand: a sheen on the cabinet, the glare on the glass slides the other way, bulbs near it brighten */
 ov.addEventListener('pointermove',e=>{
  const o=ov.getBoundingClientRect(),b=box.getBoundingClientRect();
  m.mx=e.clientX-o.left;m.my=e.clientY-o.top;m.mouseT=now();
  const lx=(e.clientX-b.left)/b.width,ly=(e.clientY-b.top)/b.height;
  box.style.setProperty('--lx',(lx*100).toFixed(1)+'%');box.style.setProperty('--ly',(ly*100).toFixed(1)+'%');
  box.style.setProperty('--gx',(78-clamp(lx,0,1)*56).toFixed(1)+'%');
  box.classList.toggle('sfxlit',lx>-.08&&lx<1.08&&ly>-.08&&ly<1.08);
  if(m.lever&&m.lever.drag)leverDrag(m,e);
 },{passive:true});
 ov.addEventListener('pointerleave',()=>{m.mx=m.my=-1e4;box.classList.remove('sfxlit');});
}
const wins=m=>m.cfg.reels?[...m.box.querySelectorAll(m.cfg.reels)]:[];
const isOpen=m=>m.ov.isConnected&&(m.cfg.display?m.ov.style.display==='flex':m.ov.classList.contains('open'));
const target=(m,at)=>!at?null:typeof at==='string'?m.ov.querySelector(at):at;
function rel(m,e){
 const r=e.getBoundingClientRect(),o=m.o;
 return {x:r.left-o.left,y:r.top-o.top,w:r.width,h:r.height,cx:r.left-o.left+r.width/2,cy:r.top-o.top+r.height/2};
}
/* the cells showing in a Slots column (a strip holds the racing cells too until it lands) */
function seaCells(c){
 const s=document.getElementById('sc'+c);if(!s)return [];
 const rows=+(s.parentElement&&s.parentElement.dataset.rows)||s.children.length;
 return [...s.children].slice(Math.max(0,s.children.length-rows));
}
const l7Cell=i=>{const r=document.getElementById('sr'+i);return r&&r.lastElementChild;};

function start(m){
 m.live=true;m.o=m.ov.getBoundingClientRect();
 if(!raf)raf=requestAnimationFrame(loop);
}
function quiet(m){
 m.parts.length=0;m.fx.length=0;m.emit.length=0;m.shine=null;m.count=null;m.banUntil=0;m.bolts=null;
 teaseEnd(m,true);m.spinning=false;m.mode='idle';m.modeUntil=0;
 m.ban.classList.remove('on','off');m.flash.classList.remove('go');
 m.box.classList.remove('sfx-shake','hard','sfx-spinning','sfxlit');
 for(const w of wins(m))w.classList.remove('sfx-spin','sfx-win','sfx-thunk','sfx-tease','sfx-hold');
 m.box.querySelectorAll('.sfx-hold,.sfx-land').forEach(e=>e.classList.remove('sfx-hold','sfx-land'));
 if(m.lever){m.lever.drag=false;m.lever.mode='rest';m.lever.th=0;leverPose(m,0);}
 if(m.rou){m.rou.spin=null;m.rou.hiT=0;m.rou.idx=null;}
 m.wheels=[];m.deal=null;m.box.classList.remove('sfx-fire');
 for(const c of [m.back,m.front]){const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);}
}
function endWin(m){
 for(const w of wins(m))w.classList.remove('sfx-win');
 m.shine=null;
 if(m.ban.classList.contains('on')){m.ban.classList.remove('on');m.ban.classList.add('off');}
 m.count=null;m.banUntil=0;
 const t=now();for(const f of m.fx)if(f.k==='rays'||f.k==='beam'||f.k==='pillar')f.end=Math.min(f.end,t+450);
 m.emit.length=0;
 if(!m.spinning)m.mode='idle';
 m.ov.querySelectorAll('.fiveimp.cheer').forEach(e=>e.classList.remove('cheer'));
 m.wheels=[];
}

/* ---------- Lucky 7's lever: pull it to spin, or watch it pull itself ---------- */
function lever(m){
 const reels=m.box.querySelector('.slotreels');if(!reels)return;
 const root=el('div','l7lever',reels);root.setAttribute('aria-hidden','true');
 el('div','lv-base',root);el('div','lv-slot',root);
 const rod=el('div','lv-rod',root),knob=el('div','lv-knob',root);
 m.lever={root,rod,knob,th:0,mode:'rest',t0:0,from:0,drag:false,shown:-1,click:0,fired:0};
 const down=e=>{
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();
  const L=m.lever;L.drag=true;L.mode='drag';
  try{knob.setPointerCapture(e.pointerId);}catch(_){}
  leverDrag(m,e);
 };
 const up=()=>{
  const L=m.lever;if(!L.drag)return;
  L.drag=false;L.mode='spring';L.t0=now();L.from=L.th;
  if(L.th>Math.PI*.55){  /* the knob pulled down past the pivot */
   const b=document.getElementById('slotSpinBtn');
   if(b&&!b.disabled){L.fired=now();b.click();thud(.08,.09,260);}
   else{tone(220,180,.12,.04,'square');}  /* locked: a spin in the air, or not enough gold */
  }
 };
 for(const e of [knob,rod]){e.addEventListener('pointerdown',down);e.addEventListener('pointerup',up);e.addEventListener('pointercancel',up);e.addEventListener('lostpointercapture',up);}
 knob.addEventListener('pointermove',e=>{if(m.lever.drag)leverDrag(m,e);});
}
function leverDrag(m,e){
 const L=m.lever,p=L.root.getBoundingClientRect(),len=L.rod.offsetHeight||74;
 const y=clamp(e.clientY-p.top,-len,len),th=Math.acos(clamp(-y/len,-1,1));
 const step=Math.floor(th/(Math.PI/9));
 if(step!==L.click){L.click=step;tone(1700+step*90,1300,.025,.02,'square');}  /* the ratchet */
 L.th=th;
}
function leverPull(m){
 const L=m.lever;if(!L||L.drag||now()-L.fired<500)return;  /* pulled by hand: it is already on its way back */
 L.mode='pull';L.t0=now();
 swish(.18,.03,1200,500);tone(260,150,.1,.05,'square');
}
function leverTick(m,t){
 const L=m.lever;if(!L)return;
 if(L.mode==='pull'){const k=(t-L.t0)/1000;if(k<.2)L.th=Math.PI*.94*ease(k/.2);else{L.mode='spring';L.t0=t;L.from=Math.PI*.94;thud(.07,.07,300);}}
 if(L.mode==='spring'){const k=(t-L.t0)/1000;L.th=L.from*Math.exp(-k*6.2)*Math.cos(k*12.5);if(k>1.1){L.th=0;L.mode='rest';}}
 if(Math.abs(L.th-L.shown)>.002)leverPose(m,L.th);
}
function leverPose(m,th){
 const L=m.lever;if(!L)return;L.shown=th;
 const len=L.rod.offsetHeight||74,c=Math.cos(th),s=Math.sin(Math.abs(th));
 L.rod.style.transform=`scaleY(${c.toFixed(3)})`;
 L.knob.style.transform=`translateY(${(-len*c).toFixed(1)}px) scale(${(1+.3*s).toFixed(3)})`;
 L.root.classList.toggle('low',c<0);
}

/* ---------- particles ---------- */
function add(m,p){if(m.parts.length<900)m.parts.push(p);return p;}
function sparks(m,x,y,n,col,sp=1,up=0){
 n=Math.round(n*scale());
 for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(80,320)*sp;
  add(m,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-up,g:380,life:rnd(.35,.8),t:0,col,w:rnd(1.2,2.4)});}
}
function coins(m,x,y,n,o={}){
 n=Math.round(n*scale());
 for(let i=0;i<n;i++)add(m,{k:o.gear?'gear':o.pearl?'pearl':'coin',x:x+rnd(-(o.spread||10),o.spread||10),y:y+rnd(-6,6),
  vx:rnd(-1,1)*(o.vx||260),vy:-rnd(o.vy0||420,o.vy1||760),g:o.g||1500,life:o.life||3.2,t:0,ph:rnd(0,TAU),spin:rnd(7,15)*(Math.random()<.5?-1:1),
  rot:rnd(0,TAU),vr:rnd(-6,6),size:rnd(.75,1.15)*(o.size||22),bounced:0});
}
function rain(m,n,dur,o={}){m.emit.push({k:'rain',t0:now(),dur,n:Math.round(n*scale()),done:0,o});}
function fountain(m,x,y,n,dur,o={}){m.emit.push({k:'fount',x,y,t0:now(),dur,n:Math.round(n*scale()),done:0,o});}
function glint(m,x,y,s=1,col){add(m,{k:'glint',x,y,life:.65,t:0,size:34*s,rot:rnd(0,1),col});}
function ring(m,x,y,col,r1=90,life=.6,w=4){m.fx.push({k:'ring',x,y,col,r1,w,t0:now(),end:now()+life*1000});}
function floatText(m,x,y,txt,col,size=26){add(m,{k:'text',x,y,vy:-60,life:1.6,t:0,txt,col,size});}
function rockets(m,n,every){for(let i=0;i<n;i++)m.emit.push({k:'rocket',t0:now()+i*every,done:0});}

function step(m,dt,W,H){
 const floor=H-6;
 for(const p of m.parts){
  p.t+=dt;
  switch(p.k){
   case 'coin':case 'gear':case 'pearl':
    p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.ph+=p.spin*dt;p.rot+=p.vr*dt;
    if(m.mx>-1e3){const dx=p.x-m.mx,dy=p.y-m.my,d2=dx*dx+dy*dy;if(d2<4900&&d2>1){const d=Math.sqrt(d2),f=(1-d/70)*1400*dt;p.vx+=dx/d*f;p.vy+=dy/d*f;}} /* bat them with the hand */
    if(p.y>floor&&p.vy>0&&p.bounced<2){p.y=floor;p.vy*=-.38;p.vx*=.7;p.bounced++;p.spin*=.6;
     if(p.k==='coin'&&now()-m.clink>45){m.clink=now();tone(2600+rnd(0,900),2100,.05,.012,'triangle');}}
    break;
   case 'spark':p.vx*=.985;p.vy=p.vy*.985+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;break;
   case 'ember':p.x+=Math.sin(p.t*4+p.ph)*20*dt;p.y+=p.vy*dt;break;
   case 'bubble':{
    p.y+=p.vy*dt;p.x+=Math.sin(p.t*2.2+p.ph)*16*dt;
    if(m.mx>-1e3){const dx=p.x-m.mx,dy=p.y-m.my,d2=dx*dx+dy*dy;if(d2<6400&&d2>1){const d=Math.sqrt(d2);p.x+=dx/d*(1-d/80)*140*dt;p.y+=dy/d*(1-d/80)*60*dt;}}
    if(p.y<p.top)p.t=p.life;break;}
   case 'foam':p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;break;
   case 'text':p.y+=p.vy*dt;p.vy*=.98;break;
   case 'rocket':
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;
    if(Math.random()<.8)add(m,{k:'spark',x:p.x,y:p.y,vx:rnd(-30,30),vy:rnd(10,60),g:120,life:rnd(.2,.45),t:0,col:'#ffd9a0',w:1.4});
    if(p.vy>-40||p.y<p.ty){p.t=p.life;burst(m,p.x,p.y,p.col);}
    break;
  }
 }
 m.parts=m.parts.filter(p=>p.t<p.life&&p.y<H+80&&p.x>-120&&p.x<W+120);
}
function burst(m,x,y,col){
 const n=Math.round(52*scale());
 for(let i=0;i<n;i++){const a=i/n*TAU+rnd(-.05,.05),v=rnd(150,360);
  add(m,{k:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:170,life:rnd(1,1.6),t:0,col:Math.random()<.25?'#fff4d6':col,w:rnd(1.6,2.6)});}
 m.fx.push({k:'pop',x,y,col,t0:now(),end:now()+380});
 thud(.25,.07,420);tone(180,55,.32,.045,'sine');
}
function emitters(m,t,W,H){
 for(const e of m.emit){
  const k=clamp((t-e.t0)/(e.dur||1),0,1);
  if(e.k==='rocket'){
   if(t<e.t0||e.done)continue;e.done=1;
   const cols=['#ffd76a','#ff6f5a','#b88cff','#6fe3ff','#9dff8a'];
   add(m,{k:'rocket',x:rnd(.18,.82)*W,y:H+10,vx:rnd(-40,40),vy:-rnd(.95,1.2)*Math.sqrt(2*260*H*.62),ty:rnd(.12,.42)*H,life:4,t:0,col:cols[Math.floor(rnd(0,cols.length))]});
   swish(.55,.022,700,2600);continue;
  }
  const want=Math.floor(e.n*k);
  for(;e.done<want;e.done++){
   if(e.k==='rain')add(m,{k:e.o.pearl?'pearl':'coin',x:rnd(0,W),y:-24,vx:rnd(-40,40),vy:rnd(160,420),g:900,life:4.5,t:0,ph:rnd(0,TAU),spin:rnd(6,13),rot:rnd(0,TAU),vr:rnd(-4,4),size:rnd(18,28),bounced:0});
   else if(e.k==='fount')coins(m,e.x,e.y,1,e.o);
  }
 }
 m.emit=m.emit.filter(e=>e.k==='rocket'?!e.done:t-e.t0<(e.dur||0));
}

/* ---------- drawing ---------- */
function drawParts(m,g){
 const coinF=coinSpr(false),coinB=coinSpr(true),gear=gearSpr(),star=starSpr(),bub=bubbleSpr(),pearl=pearlSpr();
 for(const p of m.parts){
  const fade=p.life-p.t<.5?(p.life-p.t)/.5:1;
  switch(p.k){
   case 'coin':{const c=Math.cos(p.ph),sx=Math.max(.14,Math.abs(c)),s=p.size;
    g.globalCompositeOperation='source-over';g.globalAlpha=fade;
    g.setTransform(m.dpr,0,0,m.dpr,0,0);g.translate(p.x,p.y);g.rotate(p.rot*.15);g.scale(sx,1);
    g.drawImage(c>=0?coinF:coinB,-s/2,-s/2,s,s);g.setTransform(m.dpr,0,0,m.dpr,0,0);
    if(c>.92){g.globalCompositeOperation='lighter';g.globalAlpha=fade*(c-.92)/.08*.8;g.drawImage(star,p.x-s*.7,p.y-s*.7,s*1.4,s*1.4);} /* the face flashes as it turns to the light */
    break;}
   case 'gear':{const s=p.size;g.globalCompositeOperation='source-over';g.globalAlpha=fade;
    g.translate(p.x,p.y);g.rotate(p.rot);g.drawImage(gear,-s/2,-s/2,s,s);g.setTransform(m.dpr,0,0,m.dpr,0,0);break;}
   case 'pearl':{const s=p.size*.6;g.globalCompositeOperation='source-over';g.globalAlpha=fade;g.drawImage(pearl,p.x-s/2,p.y-s/2,s,s);break;}
   case 'spark':{const a=1-p.t/p.life;g.globalCompositeOperation='lighter';g.globalAlpha=a;g.strokeStyle=p.col;g.lineWidth=p.w;
    g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);g.stroke();break;}
   case 'ember':{const a=Math.sin(Math.PI*p.t/p.life),s=p.size;g.globalCompositeOperation='lighter';g.globalAlpha=a*.9;g.drawImage(glowSpr(p.col),p.x-s/2,p.y-s/2,s,s);break;}
   case 'glint':{const k=p.t/p.life,a=Math.sin(Math.PI*k),s=p.size*(.5+.7*a);g.globalCompositeOperation='lighter';g.globalAlpha=a;
    g.translate(p.x,p.y);g.rotate(p.rot+k*.8);g.drawImage(star,-s/2,-s/2,s,s);g.setTransform(m.dpr,0,0,m.dpr,0,0);
    if(p.col){g.globalAlpha=a*.5;g.drawImage(glowSpr(p.col),p.x-s*.6,p.y-s*.6,s*1.2,s*1.2);}break;}
   case 'bubble':{const s=p.size;g.globalCompositeOperation='source-over';g.globalAlpha=Math.min(1,p.t*3)*fade*p.a;
    if(p.gold){g.globalCompositeOperation='lighter';g.drawImage(glowSpr('#ffd76a'),p.x-s,p.y-s,s*2,s*2);}else g.drawImage(bub,p.x-s/2,p.y-s/2,s,s);break;}
   case 'foam':{const a=(1-p.t/p.life)*.7,s=p.size;g.globalCompositeOperation='lighter';g.globalAlpha=a;g.drawImage(glowSpr('#e8fbff'),p.x-s/2,p.y-s/2,s,s);break;}
   case 'text':{const a=p.t<.15?p.t/.15:1-Math.max(0,(p.t-1)/(p.life-1));g.globalCompositeOperation='source-over';g.globalAlpha=clamp(a,0,1);
    g.font=`bold ${p.size}px 'Iowan Old Style','Palatino Linotype',Georgia,serif`;g.textAlign='center';g.textBaseline='middle';
    g.lineWidth=5;g.strokeStyle='rgba(30,16,4,.85)';g.strokeText(p.txt,p.x,p.y);g.fillStyle=p.col;g.fillText(p.txt,p.x,p.y);break;}
   case 'rocket':{g.globalCompositeOperation='lighter';g.globalAlpha=1;g.drawImage(glowSpr(p.col),p.x-9,p.y-9,18,18);break;}
  }
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
function rrPath(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
/* points round a rounded rectangle, evenly spaced */
function perimeter(x,y,w,h,r,n){
 const sides=[w-2*r,h-2*r,w-2*r,h-2*r],arc=Math.PI*r/2,P=2*(w+h)-8*r+4*arc,out=[];
 for(let i=0;i<n;i++){
  let s=i/n*P,seg=0;const pts=[[x+r,y,1,0],[x+w,y+r,0,1],[x+w-r,y+h,-1,0],[x,y+h-r,0,-1]];
  for(;seg<4;seg++){
   if(s<=sides[seg]){const [px,py,dx,dy]=pts[seg];out.push([px+dx*s,py+dy*s]);break;}
   s-=sides[seg];
   if(s<=arc){const a=s/r,cx=[x+w-r,x+w-r,x+r,x+r][seg],cy=[y+r,y+h-r,y+h-r,y+r][seg],a0=[-Math.PI/2,0,Math.PI/2,Math.PI][seg];out.push([cx+Math.cos(a0+a)*r,cy+Math.sin(a0+a)*r]);break;}
   s-=arc;
  }
  if(seg===4)out.push([x+r,y]);
 }
 return out;
}
function drawBulbs(m,g,t){
 if(!m.cfg.bulb)return;
 const b=rel(m,m.box),inset=7,r=14;
 const n=Math.max(16,Math.round((2*(b.w+b.h))/26));
 const pts=perimeter(b.x+inset,b.y+inset,b.w-inset*2,b.h-inset*2,r,n);
 if(t>m.modeUntil&&['win','big','jackpot','miss','scrap','catch'].includes(m.mode))m.mode='idle';
 if(m.mode==='spin'&&!m.spinning&&!m.tease&&t-m.lastAct>1600)m.mode='idle';
 const mode=m.mode,s=t/1000,idleFor=t-m.lastAct,base=m.free?BULB.gold:m.cfg.bulb;
 g.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){
  const [x,y]=pts[i];let v,col=base;
  if(mode==='spin')v=.22+.78*Math.pow(Math.max(0,Math.cos(TAU*(i/6-s*2.4))),6);
  else if(mode==='tease'){v=.3+.7*Math.pow(.5+.5*Math.sin(s*TAU*2.4),3);col=BULB.gold;}
  else if(mode==='win')v=((i+Math.floor(s*7))%2)?1:.2;
  else if(mode==='scrap'){v=((i+Math.floor(s*9))%3)?.25:1;col='#ffae5a';}
  else if(mode==='big'||mode==='catch'){v=.3+.7*Math.pow(Math.max(0,Math.cos(TAU*(i/4-s*3.2))),3);col=mode==='catch'?(i%2?BULB.sea:BULB.gold):BULB.gold;}
  else if(mode==='jackpot'){const h=(i/n*360+s*260)%360;col=null;v=.55+.45*Math.sin(s*18+i*.9);g.globalAlpha=clamp(v,0,1);
   const c=`hsl(${h|0},100%,62%)`;g.fillStyle=c;g.beginPath();g.arc(x,y,2.6,0,TAU);g.fill();g.globalAlpha=clamp(v,0,1)*.9;g.drawImage(glowSpr(hslHex(h)),x-12,y-12,24,24);continue;}
  else if(mode==='miss')v=.12;
  else if(idleFor>9000)v=.18+.82*Math.max(Math.pow(Math.max(0,Math.cos(TAU*(i/n-s*.22))),40),Math.pow(Math.max(0,Math.cos(TAU*(i/n+s*.31))),40)); /* attract: two comets */
  else v=.3+.7*Math.pow(Math.max(0,Math.cos(TAU*(i/9-s*.35))),8);
  if(m.mx>-1e3){const dx=x-m.mx,dy=y-m.my,d2=dx*dx+dy*dy;if(d2<19600)v=Math.min(1,v+.6*(1-Math.sqrt(d2)/140));} /* the hand lights them */
  g.globalAlpha=clamp(v,0,1);g.drawImage(glowSpr(col),x-14,y-14,28,28);
  g.globalAlpha=.45+.55*clamp(v,0,1);g.fillStyle=v>.55?'#fffaf0':hex2(col,.85);g.beginPath();g.arc(x,y,2.7,0,TAU);g.fill();
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
const HSL=Object.create(null);
function hslHex(h){h=Math.round(h/15)*15%360;if(HSL[h])return HSL[h];const f=n=>{const k=(n+h/30)%12,a=Math.min(.62,1-.62)*1;const c=.62-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(c*255).toString(16).padStart(2,'0');};return HSL[h]='#'+f(0)+f(8)+f(4);}

function drawFx(m,g,bg,t,W,H){
 for(const f of m.fx){
  const k=clamp((t-f.t0)/(f.end-f.t0),0,1);
  if(f.k==='ring'){const r=f.r1*ease(k);g.globalCompositeOperation='lighter';g.globalAlpha=(1-k);g.strokeStyle=f.col;g.lineWidth=f.w*(1-k*.6);
   g.beginPath();g.arc(f.x,f.y,r,0,TAU);g.stroke();}
  else if(f.k==='pop'){const s=140*(.5+k);g.globalCompositeOperation='lighter';g.globalAlpha=(1-k)*.9;g.drawImage(glowSpr(f.col),f.x-s/2,f.y-s/2,s,s);}
  else if(f.k==='beam')drawBeam(m,g,f,t);
  else if(f.k==='rays')drawRays(m,bg,f,t);
  else if(f.k==='pillar'){const fade=Math.min(1,(t-f.t0)/250)*Math.min(1,(f.end-t)/500);
   const gr=g.createLinearGradient(0,f.y,0,f.y-H);gr.addColorStop(0,'rgba(255,214,110,.75)');gr.addColorStop(1,'rgba(255,214,110,0)');
   g.globalCompositeOperation='lighter';g.globalAlpha=fade*(.75+.25*Math.sin(t/90));g.fillStyle=gr;
   const w=f.w*(1+.15*Math.sin(t/140));g.fillRect(f.x-w/2,0,w,f.y);}
  else if(f.k==='wave')drawWave(m,g,f,t,W,H);
  else if(f.k==='dim'){g.globalCompositeOperation='source-over';g.globalAlpha=.3*Math.sin(Math.PI*k);g.fillStyle='#000';g.fillRect(0,0,W,H);}
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
 m.fx=m.fx.filter(f=>t<f.end);
}
function drawBeam(m,g,f,t){
 const pts=f.pts;if(!pts||pts.length<2)return;
 const fade=Math.min(1,(t-f.t0)/200)*Math.min(1,(f.end-t)/350);
 g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
 for(const [w,a] of [[16,.16],[7,.38],[2.4,.95]]){
  g.globalAlpha=a*fade*(.8+.2*Math.sin(t/70));g.strokeStyle=w<3?'#fffbe8':f.col;g.lineWidth=w;
  g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
 }
 /* a bright bead running along the line, over and over */
 let len=0;const seg=[];for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);len+=d;}
 let s=((t-f.t0)/900%1)*len;
 for(let i=0;i<seg.length;i++){if(s<=seg[i]){const q=s/seg[i],x=pts[i][0]+(pts[i+1][0]-pts[i][0])*q,y=pts[i][1]+(pts[i+1][1]-pts[i][1])*q;
  g.globalAlpha=fade;g.drawImage(glowSpr(f.col),x-26,y-26,52,52);break;}s-=seg[i];}
 g.globalAlpha=1;
}
function drawRays(m,g,f,t){
 const fade=Math.min(1,(t-f.t0)/400)*Math.min(1,(f.end-t)/600),R=f.R,n=f.n||18,rot=(t-f.t0)/1000*(f.spin||.25);
 g.globalCompositeOperation='lighter';
 const gr=g.createRadialGradient(f.x,f.y,0,f.x,f.y,R);gr.addColorStop(0,hex2(f.col,.55));gr.addColorStop(.35,hex2(f.col,.22));gr.addColorStop(1,hex2(f.col,0));
 g.fillStyle=gr;g.globalAlpha=fade;
 for(let i=0;i<n;i++){const a=rot+i/n*TAU,w=TAU/n*.32;g.beginPath();g.moveTo(f.x,f.y);g.lineTo(f.x+Math.cos(a-w)*R,f.y+Math.sin(a-w)*R);g.lineTo(f.x+Math.cos(a+w)*R,f.y+Math.sin(a+w)*R);g.closePath();g.fill();}
 const s=R*.9*(1+.05*Math.sin(t/160));g.globalAlpha=fade*.55;g.drawImage(glowSpr(f.col),f.x-s/2,f.y-s/2,s,s);
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
/* 🌊 a wave of sea-light sweeps the room on a big catch */
function drawWave(m,g,f,t,W,H){
 const k=clamp((t-f.t0)/(f.end-f.t0),0,1),xf=-W*.35+W*1.75*ease(k),Ww=W*.55;
 const gr=g.createLinearGradient(xf-Ww,0,xf,0);
 gr.addColorStop(0,'rgba(40,150,200,0)');gr.addColorStop(.7,'rgba(60,180,230,.2)');gr.addColorStop(.94,'rgba(150,230,255,.36)');gr.addColorStop(1,'rgba(235,252,255,.5)');
 g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,(1-k)*2.2);g.fillStyle=gr;
 g.beginPath();g.moveTo(xf-Ww,0);
 const edge=y=>xf+26*Math.sin(y*.018+k*9)-90*Math.pow(1-y/H,2)+40;
 for(let y=0;y<=H;y+=12)g.lineTo(edge(y),y);
 g.lineTo(xf-Ww,H);g.closePath();g.fill();
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
 if(k<.95)for(let i=0;i<4;i++){const y=rnd(0,H);add(m,{k:'foam',x:edge(y),y,vx:rnd(40,160),vy:rnd(-30,30),life:rnd(.5,1),t:0,size:rnd(10,26)});}
}
/* the winning symbols catch the light: a bright band runs across each one, clipped to its own shape */
function drawShine(m,g,t){
 const sh=m.shine;if(!sh)return;
 const k=((t-sh.t0)%1400)/550;if(k>1)return;
 if(!m.sh){m.sh=document.createElement('canvas');m.shg=m.sh.getContext('2d');}
 for(const img of sh.els){
  if(!img||!img.isConnected||!img.complete||!img.naturalWidth)continue;
  const r=rel(m,img);if(r.w<4)continue;
  const w=Math.ceil(r.w*m.dpr),h=Math.ceil(r.h*m.dpr);
  if(m.sh.width<w||m.sh.height<h){m.sh.width=Math.max(w,m.sh.width);m.sh.height=Math.max(h,m.sh.height);}
  const o=m.shg;o.globalCompositeOperation='source-over';o.clearRect(0,0,m.sh.width,m.sh.height);o.drawImage(img,0,0,w,h);
  o.globalCompositeOperation='source-in';
  const x=(-0.4+1.8*k)*w,gr=o.createLinearGradient(x-w*.35,0,x+w*.35,h*.4);
  gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');
  o.fillStyle=gr;o.fillRect(0,0,w,h);
  g.globalCompositeOperation='lighter';g.globalAlpha=.75;g.drawImage(m.sh,0,0,w,h,r.x,r.y,r.w,r.h);
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
/* ⚡ Slots: the locked line hums - jagged links from each locked cell to the nearest one in the next reel */
function drawLocks(m,g,t){
 const box=document.getElementById('seaBuyFx');if(box&&box.style.display==='flex')return;
 const locks=m.box.querySelectorAll('.seastrip > .seacell.lockd');if(!locks.length){m.bolts=null;return;}
 const by=[[],[],[],[]];
 for(const e of locks){const s=e.parentElement,c=+(s.id||'').slice(2);if(c>=0&&c<4){const r=rel(m,e);by[c].push([r.cx,r.cy,r.w]);}}
 if(!m.bolts||t-m.boltT>70){m.boltT=t;m.bolts=[];
  for(let c=0;c<3;c++)for(const a of by[c]){let best=null,bd=1e9;for(const b of by[c+1]){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<bd){bd=d;best=b;}}
   if(best){const pts=[[a[0],a[1]]],n=7;for(let i=1;i<n;i++){const q=i/n,nx=-(best[1]-a[1])/bd,ny=(best[0]-a[0])/bd,j=rnd(-1,1)*Math.min(14,bd*.12);
     pts.push([a[0]+(best[0]-a[0])*q+nx*j,a[1]+(best[1]-a[1])*q+ny*j]);}pts.push([best[0],best[1]]);m.bolts.push(pts);}}
 }
 g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
 for(const pts of m.bolts)for(const [w,a,c] of [[7,.18,'#4aa8ff'],[2.6,.5,'#8fd0ff'],[1.1,.95,'#f0fbff']]){
  g.globalAlpha=a*(.75+.25*Math.sin(t/37));g.strokeStyle=c;g.lineWidth=w;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
 for(const col of by)for(const [x,y,w] of col){const s=w*(1.05+.12*Math.sin(t/120+x));g.globalAlpha=.32;g.drawImage(glowSpr('#5ab4ff'),x-s/2,y-s/2,s,s);}
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
/* 🎁 a chest showing on the reels glows, so the eye finds it */
function drawChests(m,g,t){
 if(m.spinning)return;
 for(const img of m.box.querySelectorAll('.seastrip > .seacell > .ic > img[alt="🎁"]')){
  const r=rel(m,img),s=r.w*(1.6+.2*Math.sin(t/180));
  g.globalCompositeOperation='lighter';g.globalAlpha=.35;g.drawImage(glowSpr('#ffcf5a'),r.cx-s/2,r.cy-s/2,s,s);
 }
 g.globalAlpha=1;g.globalCompositeOperation='source-over';
}
function ambient(m,t,dt){
 const b=rel(m,m.box);
 if(m.cfg.water){
  m.bubT=(m.bubT||0)-dt;
  if(m.bubT<=0&&m.parts.length<500){m.bubT=m.free?.12:.32;
   add(m,{k:'bubble',x:rnd(b.x+16,b.x+b.w-16),y:b.y+b.h-12,vy:-rnd(26,60),life:9,t:0,ph:rnd(0,TAU),size:rnd(4,11),a:rnd(.35,.7),top:b.y+14,gold:m.free});}
 }
 if(m.cfg.embers){
  m.embT=(m.embT||0)-dt;
  if(m.embT<=0&&m.parts.length<400){const fire=m.box.classList.contains('sfx-fire');m.embT=fire?.06:.22;
   add(m,{k:'ember',x:rnd(b.x+10,b.x+b.w-10),y:b.y+b.h-8,vy:-rnd(40,110),life:rnd(1.4,2.8),t:0,ph:rnd(0,TAU),size:rnd(5,fire?13:9),col:Math.random()<.7?'#ff7a35':'#ffc65a'});}
 }
 if(t>m.nextGlint&&!m.spinning){
  m.nextGlint=t+rnd(2600,5200);
  const imgs=m.cfg.glint?[...m.ov.querySelectorAll(m.cfg.glint)].filter(e=>e.getClientRects().length):m.sea?[...m.box.querySelectorAll('.seastrip > .seacell.prize > .ic > img')]:m.cfg.reels?[0,1,2].map(i=>{const c=l7Cell(i);return c&&c.querySelector('img');}).filter(Boolean):[];
  const img=imgs[Math.floor(rnd(0,imgs.length))];
  if(img){const r=rel(m,img);glint(m,r.x+r.w*rnd(.55,.8),r.y+r.h*rnd(.15,.35),.7);}
 }
 if(m.tease){
  const w=wins(m)[m.tease.i];
  if(w){const r=rel(m,w);
   if(Math.random()<.55)add(m,{k:'ember',x:rnd(r.x,r.x+r.w),y:r.y+r.h,vy:-rnd(50,120),life:rnd(.7,1.2),t:0,ph:rnd(0,TAU),size:rnd(8,16),col:'#ffb84a'});
   /* two comets of light chase round the teased window */
   const pts=perimeter(r.x-3,r.y-3,r.w+6,r.h+6,10,64),s=t/1000;
   const g=m.fctx;g.globalCompositeOperation='lighter';
   for(let i=0;i<64;i++){const v=Math.max(Math.pow(Math.max(0,Math.cos(TAU*(i/64-s*1.4))),30),Math.pow(Math.max(0,Math.cos(TAU*(i/64-s*1.4+.5))),30));
    if(v<.05)continue;g.globalAlpha=v;g.drawImage(glowSpr('#ffd76a'),pts[i][0]-10,pts[i][1]-10,20,20);}
   g.globalAlpha=1;g.globalCompositeOperation='source-over';
   /* a heartbeat that quickens */
   if(t>=m.tease.next){const beat=m.tease.beat++;m.tease.next=t+Math.max(170,430-beat*28);
    thud(.08,.06,150);tone(320+beat*45,300+beat*45,.09,.035,'triangle');}
  }
 }
}

function loop(t){
 raf=0;let any=false;
 for(const id in M){const m=M[id];if(m.live&&frame(m,t))any=true;}
 if(any)raf=requestAnimationFrame(loop);
}
function frame(m,t){
 if(!isOpen(m)){quiet(m);m.live=false;return false;}
 const dt=clamp((t-(m.last||t))/1000,0,.05);m.last=t;
 m.o=m.ov.getBoundingClientRect();
 const W=m.o.width,H=m.o.height,dpr=Math.min(window.devicePixelRatio||1,1.5);
 for(const c of [m.back,m.front]){const w=Math.round(W*dpr),h=Math.round(H*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}}
 m.dpr=dpr;
 const bg=m.bctx,g=m.fctx,rays=m.fx.some(f=>f.k==='rays');
 if(rays||m.backDirty){bg.setTransform(1,0,0,1,0,0);bg.clearRect(0,0,m.back.width,m.back.height);bg.setTransform(dpr,0,0,dpr,0,0);m.backDirty=rays;} /* the back layer only holds rays: left alone the rest of the time */
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,m.front.width,m.front.height);g.setTransform(dpr,0,0,dpr,0,0);
 emitters(m,t,W,H);
 step(m,dt,W,H);
 if(m.sea){drawLocks(m,g,t);drawChests(m,g,t);}
 if(m.rou&&m.rou.cv&&m.rou.hiT&&t<m.rou.hiT+3400&&!m.rou.spin)drawWheel(m,m.rou.cv,m.rou.angle);
 if(m.wheels&&m.wheels.length)for(const w of m.wheels)drawPrize(m,g,w,t);
 if(m.deal)drawPrize(m,g,m.deal,t);
 ambient(m,t,dt);
 drawFx(m,g,bg,t,W,H);
 drawBulbs(m,g,t);
 drawShine(m,g,t);
 drawParts(m,g);
 leverTick(m,t);
 counter(m,t);
 return true;
}
function counter(m,t){
 const c=m.count;
 if(c&&t>=c.t0){
  const k=clamp((t-c.t0)/c.dur,0,1),v=c.to*ease(k);
  m.ban.lastChild.textContent=c.fmt(k>=1?c.to:v);
  if(k<1&&t-c.tick>65){c.tick=t;tone(1500+k*900,1700+k*900,.035,.018,'triangle');}
  if(k>=1&&!c.rang){c.rang=1;tone(1046,1046,.3,.06);tone(1568,1568,.35,.045);}
 }
 if(m.banUntil&&t>m.banUntil){m.banUntil=0;m.ban.classList.remove('on');m.ban.classList.add('off');}
}

/* ---------- moments ---------- */
function banner(m,title,tier,amount,countMs,holdMs,fmt){
 const b=m.ban;b.className='sfxban t-'+tier;b.firstChild.textContent=title;b.firstChild.dataset.t=b.firstChild.textContent;   /* 🌍 the shadow layer shows the same words as the face - translated, if a language is on */
 b.style.top=Math.round(reelsCenter(m).cy)+'px';
 m.count={to:amount,t0:now()+260,dur:countMs,fmt:fmt||(v=>'+'+Math.round(v).toLocaleString()+'◉'),tick:0,rang:0};
 b.lastChild.textContent=m.count.fmt(0);
 void b.offsetWidth;b.classList.add('on');
 m.banUntil=now()+holdMs;
}
function flash(m,col,a){if(calmMotion())return;m.flash.style.setProperty('--fc',col);m.flash.style.setProperty('--fo',String(a));retrigger(m.flash,'go');}
function shake(m,hard){if(calmMotion())return;m.box.classList.toggle('hard',!!hard);retrigger(m.box,'sfx-shake');setTimeout(()=>m.box.classList.remove('sfx-shake','hard'),hard?850:600);}
function teaseStart(m,i){
 const ws=wins(m);if(!ws[i])return;
 m.tease={i,t0:now(),next:now(),beat:0};m.mode='tease';
 ws[i].classList.add('sfx-tease');
 if(m.sea){for(const c of [0,1])for(const e of seaCells(c))if(e.querySelector('img[alt="🎁"]'))e.classList.add('sfx-hold');}
 else if(m.id==='fiveFx'){for(const c of [0,2])for(const e of [...ws[c].querySelectorAll('.fivecell.fivefive')].slice(-4))e.classList.add('sfx-hold');}
 else for(const k of [0,1])if(ws[k])ws[k].classList.add('sfx-hold');
 swish(1.4,.025,200,1400);
}
function teaseEnd(m,silent){
 if(!m.tease)return;
 for(const w of wins(m))w.classList.remove('sfx-tease','sfx-hold');
 m.box.querySelectorAll('.sfx-hold').forEach(e=>e.classList.remove('sfx-hold'));
 m.tease=null;if(m.mode==='tease')m.mode='spin';
}
/* the middle of the action: the reels, the table's stage (cards, wheel, cups) or else the box - one rectangle round all of it */
function reelsCenter(m){
 const els=(m.cfg.reels?wins(m):m.cfg.stage?[...m.ov.querySelectorAll(m.cfg.stage)]:[]).filter(e=>e.getClientRects().length);
 if(!els.length)els.push(m.box);
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const e of els){const r=rel(m,e);x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h);}
 return {x:x0,y:y0,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2,bottom:y1};
}

/* ---------- 🎡 the roulette wheel: a turned wooden bowl, a disc of pockets that spins, and a real ball ----------
   game.js still owns the angle and the result (rouAngle, ROU_ORDER); this only draws them. The ball runs the other way round the
   track for most of the spin, drops, rattles over the frets and rides its pocket to the pointer as the wheel coasts in. */
function wheelArt(W,order,red){
 const key=W+'|'+order.join(',');
 if(wheelArt.k===key)return wheelArt.v;
 const R=W/2,seg=TAU/37,mk=()=>{const c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');g.translate(R,R);return [c,g];};
 const [base,b]=mk();
 let gr=b.createRadialGradient(0,0,R*.78,0,0,R);
 gr.addColorStop(0,'#2a1608');gr.addColorStop(.45,'#7a4a22');gr.addColorStop(.78,'#4a2a10');gr.addColorStop(1,'#160b03');
 b.fillStyle=gr;b.beginPath();b.arc(0,0,R-1,0,TAU);b.fill();
 b.lineWidth=R*.02;b.strokeStyle='#e8c46a';b.beginPath();b.arc(0,0,R*.975,0,TAU);b.stroke();
 gr=b.createRadialGradient(0,0,R*.79,0,0,R*.87);gr.addColorStop(0,'#2e1a0a');gr.addColorStop(.55,'#9a6a3a');gr.addColorStop(1,'#4a2c12');
 b.fillStyle=gr;b.beginPath();b.arc(0,0,R*.87,0,TAU);b.arc(0,0,R*.79,0,TAU,true);b.fill();
 b.lineWidth=R*.012;b.strokeStyle='#c9993a';b.beginPath();b.arc(0,0,R*.87,0,TAU);b.stroke();
 for(let i=0;i<8;i++){const a=i/8*TAU+TAU/16;b.save();b.rotate(a);b.translate(R*.83,0);
  const dg=b.createLinearGradient(-R*.03,0,R*.03,0);dg.addColorStop(0,'#7a5410');dg.addColorStop(.5,'#fff0b0');dg.addColorStop(1,'#7a5410');
  b.fillStyle=dg;b.beginPath();b.moveTo(-R*.03,0);b.lineTo(0,-R*.013);b.lineTo(R*.03,0);b.lineTo(0,R*.013);b.closePath();b.fill();b.restore();}
 const [disc,d]=mk();
 for(let i=0;i<37;i++){
  const n=order[i],a0=i*seg,a1=a0+seg,col=n===0?['#0b3f22','#21924f']:red.has(n)?['#5e0d0d','#c8261f']:['#070707','#2f2f2f'];
  const pg=d.createRadialGradient(0,0,R*.55,0,0,R*.79);pg.addColorStop(0,col[0]);pg.addColorStop(.62,col[1]);pg.addColorStop(1,col[0]);
  d.fillStyle=pg;d.beginPath();d.arc(0,0,R*.79,a0,a1);d.arc(0,0,R*.55,a1,a0,true);d.closePath();d.fill();
  d.save();d.rotate(a0+seg/2);d.translate(R*.718,0);d.rotate(Math.PI/2);
  d.fillStyle='#fff6dc';d.font='700 '+Math.max(9,Math.round(R*.066))+'px Georgia,serif';d.textAlign='center';d.textBaseline='middle';d.fillText(String(n),0,0);
  d.restore();
 }
 d.fillStyle='rgba(0,0,0,.3)';d.beginPath();d.arc(0,0,R*.645,0,TAU);d.arc(0,0,R*.55,0,TAU,true);d.fill();
 d.strokeStyle='#e8c46a';d.lineWidth=Math.max(1,R*.008);
 for(let i=0;i<37;i++){const a=i*seg;d.beginPath();d.moveTo(Math.cos(a)*R*.55,Math.sin(a)*R*.55);d.lineTo(Math.cos(a)*R*.79,Math.sin(a)*R*.79);d.stroke();}
 d.lineWidth=R*.011;for(const rr of [.79,.645,.55]){d.beginPath();d.arc(0,0,R*rr,0,TAU);d.stroke();}
 gr=d.createRadialGradient(-R*.12,-R*.14,R*.02,0,0,R*.55);gr.addColorStop(0,'#c08a46');gr.addColorStop(.55,'#6a3f18');gr.addColorStop(1,'#2a1606');
 d.fillStyle=gr;d.beginPath();d.arc(0,0,R*.545,0,TAU);d.fill();
 for(let k=0;k<4;k++){d.save();d.rotate(k*Math.PI/2);
  const sg=d.createLinearGradient(0,-R*.03,0,R*.03);sg.addColorStop(0,'#fff0b0');sg.addColorStop(.5,'#d9a441');sg.addColorStop(1,'#6a4608');
  d.fillStyle=sg;d.beginPath();d.moveTo(R*.07,-R*.024);d.lineTo(R*.34,-R*.012);d.arc(R*.36,0,R*.026,-Math.PI/2,Math.PI/2);d.lineTo(R*.07,R*.024);d.closePath();d.fill();d.restore();}
 gr=d.createRadialGradient(-R*.035,-R*.045,R*.01,0,0,R*.11);gr.addColorStop(0,'#fff8d8');gr.addColorStop(.5,'#e3b44a');gr.addColorStop(1,'#6a4608');
 d.fillStyle=gr;d.beginPath();d.arc(0,0,R*.11,0,TAU);d.fill();
 wheelArt.k=key;wheelArt.v={base,disc};
 return wheelArt.v;
}
const bounce=x=>{const n=7.5625,d=2.75;if(x<1/d)return n*x*x;if(x<2/d)return n*(x-=1.5/d)*x+.75;if(x<2.5/d)return n*(x-=2.25/d)*x+.9375;return n*(x-=2.625/d)*x+.984375;};
function ballAt(st,angle,R,t){
 const seg=TAU/37,rT=R*.83,rP=R*.6,sp=st.spin;
 if(sp){
  const p=clamp((t-sp.t0)/sp.dur,0,1),wAt=q=>sp.from+(sp.to-sp.from)*(1-Math.pow(1-q,3)),P=q=>wAt(q)+(sp.idx+.5)*seg,D=.7;
  if(p<D){const k=p/D;return {a:P(D)-TAU*5*(1-(1-Math.pow(1-k,2.2))),r:rT,fast:1-k};}   /* the other way round the track, five laps, slowing */
  const q=(p-D)/(1-D);
  return {a:P(p)+Math.sin(q*Math.PI*5)*(1-q)*seg*.4,r:rP+(rT-rP)*(1-bounce(q)),fast:0}; /* it drops, rattles over the frets, and rides its pocket */
 }
 return st.idx==null?null:{a:angle+(st.idx+.5)*seg,r:rP,fast:0};
}
function drawWheel(m,cv,angle){
 const st=m.rou,g=cv.getContext('2d'),W=cv.width,R=W/2,seg=TAU/37,t=now(),art=wheelArt(W,st.order,st.red);
 g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,W);
 g.drawImage(art.base,0,0);
 g.save();g.translate(R,R);g.rotate(angle);g.drawImage(art.disc,-R,-R);g.restore();
 if(st.hiT&&!st.spin&&st.idx!=null&&t<st.hiT+3400){ /* the winning pocket glows under the pointer */
  const k=(t-st.hiT)/3400,a=angle+(st.idx+.5)*seg;
  g.save();g.translate(R,R);g.globalCompositeOperation='lighter';g.globalAlpha=(1-k)*(.65+.35*Math.sin(t/85));
  g.strokeStyle='#ffe08a';g.lineWidth=R*.07;g.beginPath();g.arc(0,0,R*.6,a-seg*.5,a+seg*.5);g.stroke();
  const s=R*.42;g.drawImage(glowSpr('#ffd76a'),Math.cos(a)*R*.66-s/2,Math.sin(a)*R*.66-s/2,s,s);g.restore();
 }
 const b=ballAt(st,angle,R,t);
 if(b){
  const br=R*.034;
  if(b.fast>.05){g.globalCompositeOperation='lighter';for(let k=1;k<6;k++){const a=b.a-k*.07*(.4+b.fast);g.globalAlpha=.12*(6-k)/5*b.fast;g.fillStyle='#fffbe8';g.beginPath();g.arc(R+Math.cos(a)*b.r,R+Math.sin(a)*b.r,br*.9,0,TAU);g.fill();}g.globalCompositeOperation='source-over';g.globalAlpha=1;}
  const x=R+Math.cos(b.a)*b.r,y=R+Math.sin(b.a)*b.r;
  g.fillStyle='rgba(0,0,0,.45)';g.beginPath();g.ellipse(x+br*.35,y+br*.45,br*1.05,br*.8,0,0,TAU);g.fill();
  const bg=g.createRadialGradient(x-br*.35,y-br*.4,br*.1,x,y,br);bg.addColorStop(0,'#ffffff');bg.addColorStop(.6,'#ebe7df');bg.addColorStop(1,'#8f8a80');
  g.fillStyle=bg;g.beginPath();g.arc(x,y,br,0,TAU);g.fill();
 }
 /* the light on the lacquer leans away from the hand, as the glass on the slots does */
 let lx=-.35,ly=-.4;
 if(m.mx>-1e3){const r=cv.getBoundingClientRect(),o=m.ov.getBoundingClientRect();lx=clamp(-((m.mx+o.left)-(r.left+r.width/2))/r.width,-.5,.5);ly=clamp(-((m.my+o.top)-(r.top+r.height/2))/r.height,-.5,.5);}
 const hg=g.createRadialGradient(R+lx*R,R+ly*R,R*.05,R+lx*R,R+ly*R,R*.75);hg.addColorStop(0,'rgba(255,248,225,.20)');hg.addColorStop(1,'rgba(255,248,225,0)');
 g.globalCompositeOperation='lighter';g.fillStyle=hg;g.beginPath();g.arc(R,R,R*.97,0,TAU);g.fill();g.globalCompositeOperation='source-over';
 g.fillStyle='#ffd76a';g.strokeStyle='#5e3405';g.lineWidth=1.5;g.beginPath();g.moveTo(R-R*.045,R*.012);g.lineTo(R+R*.045,R*.012);g.lineTo(R,R*.1);g.closePath();g.fill();g.stroke();
 g.globalCompositeOperation='lighter';g.globalAlpha=.5;g.drawImage(glowSpr('#ffd76a'),R-R*.09,-R*.04,R*.18,R*.18);g.globalAlpha=1;g.globalCompositeOperation='source-over';
}

/* ---------- the tables' moments: coins and a banner for a win, a shudder for a loss, a sparkle where something lands ---------- */
function sync(m){m.o=m.ov.getBoundingClientRect();m.lastAct=now();}
function cheer(m,o){
 const t=now(),tier=o.tier||'small',ms=o.ms||(tier==='small'?2200:3600),st=reelsCenter(m),at=target(m,o.at);
 m.ov.querySelectorAll('.fiveimp').forEach(e=>pulse(e,'cheer',1900));
 const r=at&&at.getClientRects().length?rel(m,at):st;
 m.mode=tier==='small'?'win':tier==='jackpot'?'jackpot':'big';m.modeUntil=t+ms;
 coins(m,r.cx,r.cy,tier==='small'?14:26,{vy0:420,vy1:760,vx:260,size:22});
 glint(m,r.x+r.w*.82,r.y+r.h*.18,1,'#ffd76a');sparks(m,r.cx,r.cy,12,'#ffe9a8',1,80);
 if(tier==='small'){if(o.amount>0)floatText(m,r.cx,r.y-8,'+'+Math.round(o.amount).toLocaleString()+'◉',o.color||'#ffe9a8',26);sweet();return true;}
 m.fx.push({k:'rays',x:st.cx,y:st.cy,R:Math.max(m.o.width,m.o.height)*.8,col:tier==='jackpot'?'#ffb347':'#ffd76a',n:tier==='jackpot'?24:18,spin:tier==='jackpot'?.4:.25,t0:t,end:t+ms-200});
 fountain(m,st.cx,st.bottom,tier==='jackpot'?130:70,tier==='jackpot'?2000:1300,{vy0:680,vy1:1000,vx:400,size:24});
 if(tier==='jackpot'){rain(m,150,2800);rockets(m,6,480);}
 banner(m,o.title||'BIG WIN',tier==='jackpot'?'jackpot':'big',o.amount,tier==='jackpot'?2400:1600,ms-300,o.unit==='spins'?(v=>Math.round(v)+' FREE SPINS'):null);
 flash(m,tier==='jackpot'?'rgba(255,250,225,1)':'rgba(255,225,150,.95)',tier==='jackpot'?.6:.35);
 shake(m,tier==='jackpot');
 return true;
}
function sweet(){tone(1318,1318,.12,.035);setTimeout(()=>tone(1760,1760,.16,.03),70);}
function groan(m,o){
 const t=now(),at=target(m,o&&o.at);m.mode='miss';m.modeUntil=t+900;
 if(at&&at.getClientRects().length){
  const r=rel(m,at);pulse(at,'sfx-hit',650);if(o.hard)pulse(at,'sfx-hard',650);
  for(let k=0;k<(o.hard?16:8);k++)add(m,{k:'ember',x:rnd(r.x,r.x+r.w),y:rnd(r.y,r.y+r.h),vy:rnd(30,90),life:rnd(.4,.9),t:0,ph:rnd(0,TAU),size:rnd(6,12),col:'#ff6a4a'});
 }
 if(o&&o.hard){flash(m,'rgba(255,60,40,.9)',.24);thud(.2,.06,140);}
}
function spark(m,o){
 const at=target(m,o.at);if(!at||!at.getClientRects().length)return;
 const r=rel(m,at),col=o.color||'#ffe9a8';
 glint(m,r.x+r.w*rnd(.62,.86),r.y+r.h*rnd(.1,.3),o.size||.8,col);sparks(m,r.cx,r.cy,o.n||8,col,.8,40);
 if(o.ring)ring(m,r.cx,r.cy,col,Math.max(r.w,r.h)*.8,.5,3);
 if(o.text)floatText(m,r.cx,r.y-6,o.text,col,o.textSize||22);
}

/* ---------- 5️⃣ the 555 wheels: one grows out of every 5 and spins to the slice game.js already drew; the Bargain's turns in the middle ---------- */
const FIVE_IMG={};
const fiveImg=red=>{const k=red?'red':'blue';if(!FIVE_IMG[k]){const im=new Image();im.src='assets/casino/f5_five_'+k+'.png';FIVE_IMG[k]=im;}return FIVE_IMG[k];};
function prizeArt(key,D,slices,pal){
 const id=key+'|'+D;prizeArt.c=prizeArt.c||{};if(prizeArt.c[id])return prizeArt.c[id];
 const c=document.createElement('canvas');c.width=c.height=Math.ceil(D);const g=c.getContext('2d'),R=D/2,n=slices.length,seg=TAU/n;
 g.translate(R,R);
 for(let i=0;i<n;i++){
  const lab=slices[i],a0=i*seg,a1=a0+seg,col=pal(lab,i);
  const gr=g.createRadialGradient(0,0,R*.18,0,0,R*.92);gr.addColorStop(0,col[1]);gr.addColorStop(1,col[0]);
  g.fillStyle=gr;g.beginPath();g.moveTo(0,0);g.arc(0,0,R*.92,a0,a1);g.closePath();g.fill();
  g.save();g.rotate(a0+seg/2);g.translate(R*.62,0);g.rotate(Math.PI/2);
  const fs=Math.max(9,Math.round(R*(lab.length>3?.15:.19)));
  g.font='900 '+fs+'px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=Math.max(2,fs*.18);g.strokeStyle='rgba(0,0,0,.75)';
  g.strokeText(lab,0,0);g.fillStyle=lab==='MAX'?'#fff2b0':lab==='5'?'#fff0d8':'#ffffff';g.fillText(lab,0,0);g.restore();
 }
 g.strokeStyle='#e8c46a';g.lineWidth=Math.max(1,R*.012);
 for(let i=0;i<n;i++){const a=i*seg;g.beginPath();g.moveTo(Math.cos(a)*R*.2,Math.sin(a)*R*.2);g.lineTo(Math.cos(a)*R*.92,Math.sin(a)*R*.92);g.stroke();}
 const rg=g.createLinearGradient(-R,-R,R,R);rg.addColorStop(0,'#fff0b0');rg.addColorStop(.5,'#b8862a');rg.addColorStop(1,'#5a3a0c');
 g.strokeStyle=rg;g.lineWidth=R*.1;g.beginPath();g.arc(0,0,R*.94,0,TAU);g.stroke();
 g.fillStyle='#ffe9a0';for(let i=0;i<n;i++){const a=(i+.5)*seg;g.beginPath();g.arc(Math.cos(a)*R*.94,Math.sin(a)*R*.94,R*.022,0,TAU);g.fill();}
 const hg=g.createRadialGradient(-R*.05,-R*.06,R*.02,0,0,R*.22);hg.addColorStop(0,'#3a2a20');hg.addColorStop(1,'#0c0605');
 g.fillStyle=hg;g.beginPath();g.arc(0,0,R*.22,0,TAU);g.fill();g.lineWidth=R*.03;g.strokeStyle='#d9a441';g.stroke();
 return prizeArt.c[id]=c;
}
const PAL={
 blue:lab=>lab==='5'?['#7a1a05','#ff6a1a']:lab==='MAX'?['#6a4608','#f0c040']:lab[0]==='×'?['#2a0f55','#6a3ac8']:['#0b1f52','#2c64d6'],
 red:lab=>lab==='MAX'?['#6a4608','#f0c040']:lab[0]==='×'?['#3a0420','#b0205a']:['#4a0606','#d8261a'],
 deal:(lab,i)=>i===5?['#7a1a05','#ff6a1a']:i%2?['#2a0a2a','#7a2a8a']:['#3a0a14','#a8264a'],
};
function drawPrize(m,g,w,t){
 const col=w.el,box=col&&col.isConnected?rel(m,col):w.at?rel(m,w.at):null;if(!box)return;
 const n=w.slices.length,seg=TAU/n,grow=Math.min(1,(t-w.t0)/350),e=ease(grow);
 const D=w.deal?Math.min(box.w,box.h)*.72:Math.min(box.w*2.15,box.h*.98);
 const cx=w.deal?box.cx:box.cx,cy=w.deal?box.cy:box.y+(w.cellY+.5)/4*box.h+(box.cy-(box.y+(w.cellY+.5)/4*box.h))*e;
 const sc=.25+.75*e,R=D/2*sc;
 const spinMs=Math.max(300,w.ms-800),p=clamp((t-w.t0-350)/spinMs,0,1),q=1-Math.pow(1-p,3.2);
 const ang=w.a0+(w.a1-w.a0)*q;
 const under=((Math.floor((((-Math.PI/2-ang)%TAU)+TAU)%TAU/seg))%n+n)%n;
 if(p>0&&p<1&&under!==w.under){w.under=under;tone(1500+rnd(0,300),1100,.025,.025,'square');}
 if(p>=1&&!w.landed){w.landed=true;thud(.1,.08,260);
  const tx=cx,ty=cy-R*1.02,lab=w.slices[w.land],col=w.deal?'#ffb07a':w.red?'#ff8a5a':'#9fd0ff';
  ring(m,cx,cy,col,R*1.1,.6,4);sparks(m,cx,cy-R*.8,16,col,1,60);
  const up=w.deal&&lab==='';
  floatText(m,tx,ty,w.deal?(up?'THE FIRE RISES':lab+' SPINS'):lab==='5'?'FREE SPINS':lab==='MAX'?'MAX WIN':lab,lab==='MAX'||lab==='5'||up?'#ffd76a':'#fff1e0',w.deal?30:26);
  if(lab==='MAX'||lab==='5'||up){flash(m,'rgba(255,170,90,.95)',.4);}
 }
 g.save();
 g.globalCompositeOperation='lighter';g.globalAlpha=.55*e;const gl=D*1.25*sc;g.drawImage(glowSpr(w.deal?'#ff7a35':w.red?'#ff5a2a':'#4a8cff'),cx-gl/2,cy-gl/2,gl,gl);g.restore();
 g.save();g.globalAlpha=Math.min(1,e*1.4);g.fillStyle='rgba(0,0,0,.45)';g.beginPath();g.arc(cx+R*.05,cy+R*.08,R*.98,0,TAU);g.fill();
 g.translate(cx,cy);g.rotate(ang);const art=prizeArt(w.key,D,w.slices,w.pal);g.drawImage(art,-R,-R,R*2,R*2);
 /* the Bargain's raise is the red 5 itself, riding its slice */
 if(w.deal){const k=w.slices.indexOf(''),im5=fiveImg(true);if(k>=0&&im5.complete&&im5.naturalWidth){const a=(k+.5)*seg,s5=R*.38;g.save();g.rotate(a);g.translate(R*.62,0);g.rotate(Math.PI/2);g.drawImage(im5,-s5/2,-s5/2,s5,s5);g.restore();}}
 g.restore();
 if(w.landed){const a=ang+(w.land+.5)*seg;g.save();g.translate(cx,cy);g.globalCompositeOperation='lighter';g.globalAlpha=.5+.3*Math.sin(t/90);
  g.fillStyle=w.deal?'rgba(255,170,90,.5)':w.red?'rgba(255,120,80,.5)':'rgba(140,200,255,.5)';g.beginPath();g.moveTo(0,0);g.arc(0,0,R*.92,a-seg/2,a+seg/2);g.closePath();g.fill();g.restore();}
 const im=w.deal?fiveImg(true):fiveImg(w.red),hs=R*.42;
 if(im.complete&&im.naturalWidth){g.save();g.globalAlpha=Math.min(1,e*1.4);g.drawImage(im,cx-hs/2,cy-hs/2,hs,hs);g.restore();}
 g.fillStyle='#ffd76a';g.strokeStyle='#5e3405';g.lineWidth=2;g.beginPath();g.moveTo(cx-R*.12,cy-R*1.06);g.lineTo(cx+R*.12,cy-R*1.06);g.lineTo(cx,cy-R*.8);g.closePath();g.fill();g.stroke();
}
function prizeWheel(m,o,deal){
 const n=o.slices.length,seg=TAU/n,turns=deal?4:3+Math.floor(rnd(0,2));
 const a1=-Math.PI/2-(o.land+.5)*seg+rnd(-.32,.32)*seg,a0=a1-turns*TAU;
 return {el:deal?null:wins(m)[o.r],at:deal?m.box:null,cellY:o.y||0,red:!!o.red,deal,slices:o.slices,land:o.land,ms:o.ms,t0:now(),a0,a1,under:-1,landed:false,
  key:(deal?'deal':o.red?'red':'blue')+'|'+o.slices.join(','),pal:deal?PAL.deal:o.red?PAL.red:PAL.blue};
}

const CasinoFX={
 open(id){const m=machine(id);if(!m)return;start(m);if(!m.spinning&&!m.tease)m.mode='idle';m.lastAct=now();},
 reset(id){const m=M[id];if(m)quiet(m);},
 calm(id){const m=M[id];if(m)endWin(m);},
 spin(id,info){
  const m=machine(id);if(!m)return;start(m);
  endWin(m);teaseEnd(m,true);
  m.spinning=true;m.mode='spin';m.lastAct=now();m.known=new WeakSet();m.row=info&&info.row||null;
  for(const w of wins(m)){w.classList.remove('sfx-thunk');w.classList.add('sfx-spin');}
  m.wheels=[];m.deal=null;
  if(m.sea)swish(.5,.03,180,900);else{leverPull(m);swish(.42,.03,300,1500);}
 },
 /* Lucky 7: stop(i, symbol, tease the third reel) · Slots: stop(column, tease the third reel) */
 stop(id,i,a,b){
  const m=M[id];if(!m||!m.live)return;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const ws=wins(m),w=ws[i];if(!w)return;
  w.classList.remove('sfx-spin');pulse(w,'sfx-thunk',480);
  const r=rel(m,w);
  if(m.id==='fiveFx'){
   for(const e of [...w.querySelectorAll('.fivecell')].slice(-4)){
    if(!e.classList.contains('fivefive'))continue;
    const img=e.querySelector('img'),q=rel(m,e),red=e.classList.contains('red');
    pulse(img,'sfx-land',430);ring(m,q.cx,q.cy,red?'#ff6a2a':'#6fb0ff',q.w*.9,.6,3.5);glint(m,q.x+q.w*.75,q.y+q.h*.2,1,red?'#ff8a3a':'#8fc8ff');
    sparks(m,q.cx,q.cy,14,red?'#ffb07a':'#bfe0ff',.9,60);tone(red?330:440,red?660:880,.18,.05,'triangle');
   }
   if(a)teaseStart(m,4);
   if(i===4){if(m.tease)teaseEnd(m);m.spinning=false;m.box.classList.remove('sfx-spinning');}
   return;
  }
  for(let k=0;k<5;k++)add(m,{k:'spark',x:rnd(r.x+6,r.x+r.w-6),y:r.y+r.h-2,vx:rnd(-90,90),vy:-rnd(60,180),g:500,life:rnd(.25,.5),t:0,col:m.sea?'#bfefff':'#ffe2a0',w:1.4});
  if(m.sea){
   const tease=a;
   for(const e of seaCells(i)){
    const img=e.querySelector('img');if(!img)continue;const q=rel(m,img);
    if(img.alt==='🎁'){pulse(img,'sfx-land',430);ring(m,q.cx,q.cy,'#ffd76a',q.w*.9,.55,3);glint(m,q.x+q.w*.75,q.y+q.h*.2,.9,'#ffd76a');sparks(m,q.cx,q.cy,12,'#ffd76a',.8,60);
     tone(520,780,.16,.05,'triangle');setTimeout(()=>tone(780,1170,.2,.04,'triangle'),90);}
    else if(e.classList.contains('prize')){const cc=getComputedStyle(e).getPropertyValue('--cc').trim()||'#8fc3ef';pulse(img,'sfx-land',430);ring(m,q.cx,q.cy,cc,q.w*.7,.45,2.5);
     for(let k=0;k<7;k++)add(m,{k:'spark',x:q.cx,y:q.cy+q.h*.3,vx:rnd(-120,120),vy:-rnd(90,220),g:700,life:rnd(.3,.6),t:0,col:'#cfefff',w:1.6});}
   }
   if(tease)teaseStart(m,2);
   if(i===2&&m.tease){const got=seaCells(2).some(e=>e.querySelector('img[alt="🎁"]'));teaseEnd(m);
    if(got){flash(m,'rgba(255,220,140,.9)',.35);tone(784,1568,.3,.06);}else tone(600,300,.35,.04,'sine');}
   if(i===3){m.spinning=false;m.box.classList.remove('sfx-spinning');}
  }else{
   const sym=a,cell=l7Cell(i),img=cell&&cell.querySelector('img');
   if(img){pulse(img,'sfx-land',430);if(sym==='7️⃣'||sym==='💎'){const q=rel(m,img);glint(m,q.x+q.w*.78,q.y+q.h*.18,1,sym==='7️⃣'?'#ff9a5a':'#9fd8ff');}}
   if(b)teaseStart(m,2);
   if(i===2){
    if(m.tease){const hit=m.row&&m.row[2]===m.row[0];teaseEnd(m);if(!hit){tone(620,310,.4,.045,'sine');for(let k=0;k<14;k++)add(m,{k:'ember',x:rnd(r.x,r.x+r.w),y:rnd(r.y,r.y+r.h),vy:rnd(30,80),life:rnd(.4,.8),t:0,ph:rnd(0,TAU),size:rnd(6,12),col:'#ff9a4a'});}}
    m.spinning=false;m.box.classList.remove('sfx-spinning');
   }
  }
 },
 win(id,info){
  const m=M[id];if(!m||!m.live)return false;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const t=now(),ms=info.ms||3000,mul=info.mul||info.mult||0,c=reelsCenter(m),ws=wins(m);
  if(m.sea){
   const hits=[...m.box.querySelectorAll('.seastrip > .seacell.hit')];
   const tier=mul>=500?'legend':mul>=50?'mega':mul>=10?'big':'small';
   const imgs=hits.map(e=>e.querySelector('.ic img')).filter(Boolean);
   m.shine={els:imgs,t0:t};m.mode=tier==='small'?'win':'catch';m.modeUntil=t+ms;
   /* the line: each reel's hit cells to the nearest in the next reel */
   const by=[[],[],[],[]];for(const e of hits){const col=+(e.parentElement.id||'').slice(2);if(col>=0&&col<4)by[col].push(rel(m,e));}
   for(let k=0;k<3;k++)for(const a of by[k]){let best=null,bd=1e9;for(const b of by[k+1]){const d=Math.hypot(b.cx-a.cx,b.cy-a.cy);if(d<bd){bd=d;best=b;}}
    if(best)m.fx.push({k:'beam',pts:[[a.cx,a.cy],[best.cx,best.cy]],col:'#ffd76a',t0:t,end:t+ms});}
   for(const r of hits.map(e=>rel(m,e)))coins(m,r.cx,r.cy,tier==='small'?3:5,{vy0:380,vy1:680,vx:220,size:20});
   if(tier==='small'){floatText(m,c.cx,c.y-6,'+'+Math.round(info.amount).toLocaleString()+'◉','#ffe9a8',24);return true;}
   m.fx.push({k:'wave',t0:t,end:t+1500});swish(1.3,.06,180,1100);thud(.4,.06,180);
   setTimeout(()=>{if(!m.live)return;fountain(m,c.cx,c.bottom,tier==='big'?60:tier==='mega'?110:150,1300,{vy0:650,vy1:980,vx:380,size:24});},520);
   m.fx.push({k:'rays',x:c.cx,y:c.cy,R:Math.max(m.o.width,m.o.height)*.75,col:'#7fe3ff',n:20,spin:.22,t0:t,end:t+ms-200});
   if(tier!=='big')rain(m,tier==='mega'?90:160,2600);
   if(tier==='legend')rockets(m,6,520);
   banner(m,tier==='legend'?'LEGENDARY CATCH':tier==='mega'?'MEGA CATCH':'BIG CATCH','catch',info.amount,tier==='big'?1700:2400,ms-300);
   flash(m,'rgba(190,240,255,.95)',tier==='big'?.3:.55);shake(m,tier!=='big');
   return true;
  }
  const tier=mul>=100?'jackpot':mul>=10?'big':'small';
  const imgs=[0,1,2].map(i=>{const e=l7Cell(i);return e&&e.querySelector('img');}).filter(Boolean);
  for(const w of ws)w.classList.add('sfx-win');
  m.shine={els:imgs,t0:t};m.mode=tier==='small'?'win':tier;m.modeUntil=t+ms;
  m.fx.push({k:'beam',pts:ws.map(w=>{const r=rel(m,w);return [r.cx,r.cy];}),col:tier==='jackpot'?'#ff9a5a':'#ffd76a',t0:t,end:t+ms});
  if(tier==='small'){
   coins(m,c.cx,c.cy,16,{vy0:420,vy1:720,vx:260,size:22});
   floatText(m,c.cx,c.y-10,'+'+Math.round(info.amount).toLocaleString()+'◉','#ffe9a8',26);
   for(const im of imgs){const q=rel(m,im);glint(m,q.x+q.w*.75,q.y+q.h*.2,.8);}
   return true;
  }
  const R=Math.max(m.o.width,m.o.height)*.8;
  m.fx.push({k:'rays',x:c.cx,y:c.cy,R,col:tier==='jackpot'?'#ffb347':'#ffd76a',n:tier==='jackpot'?24:18,spin:tier==='jackpot'?.4:.25,t0:t,end:t+ms-200});
  fountain(m,c.cx,c.bottom,tier==='jackpot'?150:80,tier==='jackpot'?2200:1400,{vy0:700,vy1:1050,vx:420,size:24});
  for(const w of ws){const r=rel(m,w);ring(m,r.cx,r.cy,'#ffe08a',r.w,.7,4);sparks(m,r.cx,r.cy,14,'#ffe08a',1.2,80);}
  if(tier==='jackpot'){rain(m,170,3000);rockets(m,7,480);setTimeout(()=>{if(m.live)flash(m,'rgba(255,240,200,.95)',.5);},900);}
  banner(m,tier==='jackpot'?'JACKPOT':'BIG WIN',tier,info.amount,tier==='jackpot'?2700:1800,ms-300);
  flash(m,tier==='jackpot'?'rgba(255,250,225,1)':'rgba(255,225,150,.95)',tier==='jackpot'?.75:.38);
  shake(m,tier==='jackpot');
  return true;
 },
 scrap(id,n){
  const m=M[id];if(!m||!m.live)return;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const c=reelsCenter(m);m.mode='scrap';m.modeUntil=now()+1400;
  coins(m,c.cx,c.cy,12,{gear:true,vy0:380,vy1:700,vx:300,size:26});
  for(const w of wins(m)){const r=rel(m,w);sparks(m,r.cx,r.y+r.h,10,'#ffae5a',1,120);}
  floatText(m,c.cx,c.y-10,'+'+n+' ⚙','#ffcf9a',24);
 },
 miss(id){const m=M[id];if(!m||!m.live)return;m.mode='miss';m.modeUntil=now()+650;m.lastAct=now();},
 lock(id){
  const m=M[id];if(!m||!m.live)return;m.o=m.ov.getBoundingClientRect();m.lastAct=now();m.mode='spin';
  for(const e of m.box.querySelectorAll('.seastrip > .seacell.lockd')){const r=rel(m,e);m.known.add(e);ring(m,r.cx,r.cy,'#6fc0ff',r.w*.75,.5,3);sparks(m,r.cx,r.cy,6,'#bfe6ff',.7);}
  swish(.22,.05,3200,900);tone(1250,620,.16,.035,'square');
 },
 respun(id,got){
  const m=M[id];if(!m||!m.live)return;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const all=[...m.box.querySelectorAll('.seastrip > .seacell.lockd')],old=all.filter(e=>m.known.has(e)).map(e=>rel(m,e));
  for(const e of all){
   if(m.known.has(e))continue;m.known.add(e);
   const r=rel(m,e);ring(m,r.cx,r.cy,'#9ad8ff',r.w,.6,3.5);sparks(m,r.cx,r.cy,16,'#d8f2ff',1.1);glint(m,r.cx,r.cy,1.2,'#7fd0ff');
   let best=null,bd=1e9;for(const o of old){const d=Math.hypot(o.cx-r.cx,o.cy-r.cy);if(d<bd){bd=d;best=o;}}
   if(best)m.fx.push({k:'beam',pts:[[best.cx,best.cy],[r.cx,r.cy]],col:'#7fd0ff',t0:now(),end:now()+700});
  }
  if(got){flash(m,'rgba(150,215,255,.9)',.22);swish(.3,.05,900,3600);}
 },
 double(id){
  const m=M[id];if(!m||!m.live)return;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const cells=[...m.box.querySelectorAll('.seastrip > .seacell.lockd')].filter(e=>{const x=e.querySelector('.m');return x&&x.textContent==='x2';});
  const e=cells[cells.length-1]||m.box;const r=rel(m,e);
  ring(m,r.cx,r.cy,'#ffd76a',r.w*1.6,.8,5);sparks(m,r.cx,r.cy,26,'#ffe9a8',1.4,60);coins(m,r.cx,r.cy,14,{vy0:420,vy1:760,vx:260,size:22});
  floatText(m,r.cx,r.y-8,'×2','#ffd76a',40);flash(m,'rgba(255,225,150,.95)',.32);
 },
 bonus(id,n){
  const m=M[id];if(!m||!m.live)return false;m.o=m.ov.getBoundingClientRect();m.lastAct=now();
  const t=now(),chests=[...m.box.querySelectorAll('.seastrip > .seacell > .ic > img[alt="🎁"]')];
  m.mode='big';m.modeUntil=t+2600;
  for(const img of chests){const r=rel(m,img);m.fx.push({k:'pillar',x:r.cx,y:r.cy,w:r.w*.9,t0:t,end:t+2400});ring(m,r.cx,r.cy,'#ffd76a',r.w*1.4,.8,4);
   coins(m,r.cx,r.cy,10,{vy0:500,vy1:820,vx:240,size:20});coins(m,r.cx,r.cy,6,{pearl:true,vy0:450,vy1:760,vx:220,size:22});glint(m,r.cx,r.y,1.3,'#ffd76a');}
  m.shine={els:chests,t0:t};
  const c=reelsCenter(m);
  m.fx.push({k:'rays',x:c.cx,y:c.cy,R:Math.max(m.o.width,m.o.height)*.75,col:'#ffd76a',n:20,spin:.3,t0:t,end:t+2600});
  banner(m,'FREE SPINS','free',n,900,2500,v=>Math.round(v)+' SPINS');
  flash(m,'rgba(255,230,160,.95)',.42);
  return true;
 },
 mode(id,free){const m=M[id];if(!m)return;
  if(m.id==='fiveFx'){const t=free|0;m.box.classList.toggle('sfx-fire',t>0);if(t>0)m.box.dataset.tier=t;else delete m.box.dataset.tier;return;} /* the fire: Ember, Hellfire, Inferno */
  free=!!free;if(m.free!==free){m.free=free;m.box.classList.toggle('sfx-free',free);}},
 /* 5️⃣ a wheel out of a 5, the Bargain's wheel, and the paying lines */
 wheel(id,o){const m=M[id];if(!m||!m.live||!o)return;sync(m);(m.wheels=m.wheels||[]).push(prizeWheel(m,o,false));swish(.5,.04,500,1800);m.mode='tease';m.modeUntil=now()+o.ms;},
 deal(id,o){const m=M[id];if(!m||!m.live||!o)return;sync(m);m.deal=prizeWheel(m,o,true);swish(.7,.05,300,1500);m.mode='tease';m.modeUntil=now()+o.ms;},
 lines(id,list){const m=M[id];if(!m||!m.live||!list)return;sync(m);const ws=wins(m),t=now(),cols=['#ffb07a','#ffd76a','#ff8a5a','#ffe9a8'];
  list.forEach((ln,k)=>{const pts=ln.cells.map((y,c)=>{const e=ws[c]&&[...ws[c].querySelectorAll('.fivecell')].slice(-4)[y];if(!e)return null;const r=rel(m,e);return [r.cx,r.cy];}).filter(Boolean);
   if(pts.length>1)m.fx.push({k:'beam',pts,col:cols[k%cols.length],t0:t+k*90,end:t+2200});});},
 /* ---- the tables ---- */
 busy(id,on){const m=machine(id);if(!m)return;start(m);sync(m);if(on){endWin(m);m.mode='spin';}m.spinning=!!on;},
 cheer(id,o){const m=M[id];if(!m||!m.live)return false;sync(m);return cheer(m,o||{});},
 groan(id,o){const m=M[id];if(!m||!m.live)return;sync(m);groan(m,o||{});},
 spark(id,o){const m=M[id];if(!m||!m.live)return;sync(m);spark(m,o||{});},
 /* a card lands where it was dealt, after its flight */
 dealt(id,card,ms){const m=M[id];if(!m||!m.live||!card)return;setTimeout(()=>{if(m.live&&card.isConnected){sync(m);spark(m,{at:card,n:4,size:.55,color:'#fff4d6'});}},ms||0);},
 /* Ride the Bus: the card just turned - green and its price, or the bus drives off */
 flip(id,o){const m=M[id];if(!m||!m.live)return;sync(m);const card=m.ov.querySelector('#rtbCards .bjcard.flip');
  if(o&&o.ok){spark(m,{at:card,color:'#9dff9a',ring:true,text:o.x,n:12});tone(880,1320,.12,.04,'triangle');}
  else{groan(m,{at:card,hard:true});m.spinning=false;}},
 /* the duel: each reel's card under its marker catches the light, the big ones burst */
 reels(id){const m=M[id];if(!m||!m.live)return;sync(m);m.spinning=false;
  for(const w of m.ov.querySelectorAll('.gvbbigwin.sm')){
   const wr=w.getBoundingClientRect(),cx=wr.left+wr.width/2;
   const card=[...w.querySelectorAll('.gvbbigcard')].find(c=>{const r=c.getBoundingClientRect();return r.left<=cx&&r.right>=cx;});
   if(!card)continue;
   const sc=parseInt(((card.querySelector('.gl')||{}).textContent||'0'),10)||0;
   spark(m,{at:card,color:sc>=10?'#ffd76a':'#cfe6ff',ring:sc>=10,n:sc>=10?16:6,size:sc>=10?1.1:.7});
   if(sc>=20){const r=rel(m,card);coins(m,r.cx,r.cy,10,{vy0:380,vy1:640,vx:220,size:20});}
  }},
 /* 🎡 the wheel itself, and the ball's run */
 rouWheel(id,cv,angle,order,red){const m=machine(id);if(!m||!cv||!order||!red)return false;const st=m.rou||(m.rou={idx:null,spin:null,hiT:0});
  st.cv=cv;st.angle=angle;st.order=order;st.red=red;drawWheel(m,cv,angle);return true;},
 rouSpin(id,o){const m=machine(id);if(!m)return;start(m);sync(m);endWin(m);const st=m.rou||(m.rou={idx:null,spin:null,hiT:0});
  st.spin={t0:o.t0||now(),dur:o.dur,from:o.from,to:o.to,idx:o.idx};st.hiT=0;m.spinning=true;m.mode='spin';swish(.7,.035,2400,700);},
 rouLand(id,o){const m=M[id];if(!m||!m.live)return false;sync(m);const st=m.rou;
  if(st){if(st.spin)st.idx=st.spin.idx;st.spin=null;st.hiT=now();}
  m.spinning=false;
  const cell=m.ov.querySelector('#rouGrid .roucell[data-rn="'+o.res+'"]');if(cell)pulse(cell,'sfx-won',3200);
  const wheel=m.ov.querySelector('#rouWheel'),net=o.win-o.total;
  if(net>0){const big=o.win>=o.total*10;cheer(m,{amount:net,at:wheel,tier:o.win>=o.total*30?'jackpot':big?'big':'small',title:o.num?'STRAIGHT UP':'BIG WIN',ms:big?3400:2200});}
  else if(o.win>0)spark(m,{at:wheel,color:'#cfd8cf',n:6});
  else groan(m,{at:wheel});
  return true;},
};
window.CasinoFX=CasinoFX;
})();
