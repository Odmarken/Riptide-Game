/* ✨ Spell effects - what a spell looks like around the hero, on its way and where it lands.
   The core keeps the live effects and a particle pool, paints glow sprites once, and offers the drawing helpers. Each
   class's file (assets/fx/spells-<class>.js) gives one recipe per spell, under the spell's fx id in CLASSES:
     SpellFx.recipe(id,{
      cast(o,fx)          - the spell goes off. o: x,y the hero's anchor, gy his ground (feet at y+gy), fx facing (1|-1),
                            tx,ty the target (st/multi), targets [{x,y,r}] (aoe/multi), rad, dur, peer (another player's hero)
      hit(o,fx)           - it lands on one foe. o: x,y the foe's anchor, r its radius, crit, sx,sy where it came from
      boltTick(b,dt,fx)   - its projectile moved (in update: trails and sparks belong here, never in a draw)
      bolt(g,b,now,H)     - draw its projectile at b.x,b.y flying at b.tgt; return false to let the game draw it
      aura:{key,          - 'atk' | 'haste' | 'hot': drawn round the hero while that runs. a: gy, left, dur, fx, moving
            back(g,a,now,H), front(g,a,now,H), glow(g,a,now,H)  - behind him, in front of him, and lit at night
            tick(a,dt,fx)}  - in update, in world space (a.x,a.y): motes and embers that stay behind as he walks
     })
   Layers: 'ground' under every figure, 'air' over them, 'glow' after the night is laid over the world, so whatever
   burns or shines stays bright in the dark. Lights (an effect's light) are added to the night's light map as well.
   Everything is in world units in the world's transform. Nothing here reads or writes game state. */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 let makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const sprites=new Map();
 function sprite(key,size,paint){
  let s=sprites.get(key);if(s)return s;
  s=makeCanvas(size,size);paint(s.getContext('2d'),size);sprites.set(key,s);return s;
 }
 const rgba=(c,a)=>'rgba('+c+','+(+a).toFixed(3)+')';
 const clamp01=v=>v<0?0:v>1?1:v;
 /* a light with a white-hot heart: the core of every spark, bolt and flash */
 const glowSprite=c=>sprite('glow|'+c,128,(g,S)=>{
  const R=S/2,gr=g.createRadialGradient(R,R,0,R,R,R);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.1,'rgba(255,255,255,.9)');gr.addColorStop(.22,rgba(c,.75));
  gr.addColorStop(.45,rgba(c,.28));gr.addColorStop(.72,rgba(c,.08));gr.addColorStop(1,rgba(c,0));
  g.fillStyle=gr;g.fillRect(0,0,S,S);
 });
 /* a coloured haze with no white in it: auras, ground light, smoke-light */
 const hazeSprite=c=>sprite('haze|'+c,96,(g,S)=>{
  const R=S/2,gr=g.createRadialGradient(R,R,0,R,R,R);
  gr.addColorStop(0,rgba(c,.75));gr.addColorStop(.35,rgba(c,.38));gr.addColorStop(.7,rgba(c,.1));gr.addColorStop(1,rgba(c,0));
  g.fillStyle=gr;g.fillRect(0,0,S,S);
 });
 /* a four-pointed star: two long thin rays and two short ones over a small round heart */
 const flareSprite=c=>sprite('flare|'+c,160,(g,S)=>{
  const R=S/2;g.translate(R,R);g.globalCompositeOperation='lighter';
  const ray=(len,w,a)=>{
   const gr=g.createLinearGradient(-len,0,len,0);
   gr.addColorStop(0,rgba(c,0));gr.addColorStop(.42,rgba(c,a*.55));gr.addColorStop(.5,'rgba(255,255,255,'+a+')');gr.addColorStop(.58,rgba(c,a*.55));gr.addColorStop(1,rgba(c,0));
   g.fillStyle=gr;g.beginPath();g.moveTo(-len,0);g.quadraticCurveTo(0,-w,len,0);g.quadraticCurveTo(0,w,-len,0);g.fill();
  };
  ray(R,R*.07,1);g.rotate(Math.PI/2);ray(R,R*.07,1);g.rotate(Math.PI/4);ray(R*.5,R*.045,.7);g.rotate(Math.PI/2);ray(R*.5,R*.045,.7);
  const gr=g.createRadialGradient(0,0,0,0,0,R*.3);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(.35,rgba(c,.5));gr.addColorStop(1,rgba(c,0));
  g.fillStyle=gr;g.beginPath();g.arc(0,0,R*.3,0,TAU);g.fill();
 });

 /* a beam's cross-section (white down the middle) times its height (nothing at the top, full at the foot), stretched to fit */
 const beamSprite=c=>sprite('beam|'+c,256,(g,S)=>{
  const gr=g.createLinearGradient(0,0,S,0);
  gr.addColorStop(0,rgba(c,0));gr.addColorStop(.26,rgba(c,.28));gr.addColorStop(.43,rgba(c,.8));gr.addColorStop(.5,'rgba(255,255,255,1)');
  gr.addColorStop(.57,rgba(c,.8));gr.addColorStop(.74,rgba(c,.28));gr.addColorStop(1,rgba(c,0));
  g.fillStyle=gr;g.fillRect(0,0,S,S);
  g.globalCompositeOperation='destination-in';
  const v=g.createLinearGradient(0,0,0,S);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.45,'rgba(0,0,0,.8)');v.addColorStop(.9,'rgba(0,0,0,1)');v.addColorStop(1,'rgba(0,0,0,.55)');
  g.fillStyle=v;g.fillRect(0,0,S,S);
 });

 const E={
  out:p=>1-Math.pow(1-clamp01(p),3),
  in:p=>Math.pow(clamp01(p),3),
  inOut:p=>{p=clamp01(p);return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;},
  back:p=>{p=clamp01(p);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);},
  pulse:p=>Math.sin(Math.PI*clamp01(p)),
  /* 0 -> 1 by i, 1 until o, back to 0 at the end */
  fade:(p,i,o)=>{p=clamp01(p);return p<i?p/i:p>o?(1-p)/(1-o):1;},
  clamp01,
 };
 function rng(seed){let s=(seed>>>0)||0x9e3779b9;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
 const lerp=(a,b,t)=>a+(b-a)*t;

 /* ---------- drawing helpers: g in world space, c a colour 'r,g,b', a an alpha. Each leaves g as it found it. ---------- */
 const H={
  TAU,E,rng,lerp,rgba,clamp01,
  sprite:{glow:glowSprite,haze:hazeSprite,flare:flareSprite,beam:beamSprite},
  /* additive glow with a white heart, r its radius */
  glow(g,x,y,r,c,a,flat=1){
   if(!(a>0&&r>0))return;
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.drawImage(glowSprite(c),x-r,y-r*flat,r*2,r*2*flat);g.restore();
  },
  /* soft coloured light, no white: flat < 1 lays it on the ground */
  haze(g,x,y,r,c,a,flat=1,add=true){
   if(!(a>0&&r>0))return;
   g.save();if(add)g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.drawImage(hazeSprite(c),x-r,y-r*flat,r*2,r*2*flat);g.restore();
  },
  flare(g,x,y,r,c,a,rot=0){
   if(!(a>0&&r>0))return;
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.translate(x,y);if(rot)g.rotate(rot);
   g.drawImage(flareSprite(c),-r,-r,r*2,r*2);g.restore();
  },
  /* a glowing ring lying on the ground: a wide soft band, the line itself, and a white-hot thread in it */
  ring(g,x,y,r,w,c,a,flat=.5){
   if(!(a>0&&r>0))return;
   g.save();g.globalCompositeOperation='lighter';g.beginPath();g.ellipse(x,y,r,r*flat,0,0,TAU);
   g.strokeStyle=rgba(c,1);g.globalAlpha=Math.min(1,a*.3);g.lineWidth=w*3.2;g.stroke();
   g.globalAlpha=Math.min(1,a);g.lineWidth=w;g.stroke();
   g.strokeStyle='rgba(255,255,255,1)';g.globalAlpha=Math.min(1,a*.85);g.lineWidth=Math.max(.6,w*.32);g.stroke();
   g.restore();
  },
  /* a magic circle on the ground: a double ring, a band of rune marks, and a star inside turning the other way.
     o: flat (.5), rot (turn of the band), w (line width), ticks (16), star (points, 0 = none), inner (star radius share) */
  runes(g,x,y,r,c,a,o={}){
   if(!(a>0&&r>0))return;
   const flat=o.flat??.5,w=o.w||1.6,n=o.ticks||16,star=o.star??6,rot=o.rot||0;
   g.save();g.globalCompositeOperation='lighter';g.translate(x,y);g.scale(1,flat);
   g.strokeStyle=rgba(c,1);g.lineCap='round';g.lineJoin='round';
   g.globalAlpha=Math.min(1,a*.28);g.lineWidth=w*3.4;g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
   g.globalAlpha=Math.min(1,a);g.lineWidth=w;g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
   g.lineWidth=w*.6;g.beginPath();g.arc(0,0,r*.8,0,TAU);g.stroke();
   g.save();g.rotate(rot);g.lineWidth=w*.85;g.beginPath();
   for(let i=0;i<n;i++){   /* rune marks between the rings: a stroke, a hook, a chevron, a cross - in turn */
    const t=i/n*TAU,ca=Math.cos(t),sa=Math.sin(t),r0=r*.84,r1=r*.96,rm=(r0+r1)/2,tx=-sa,ty=ca,k=r*.035;
    switch(i%4){
     case 0:g.moveTo(ca*r0,sa*r0);g.lineTo(ca*r1,sa*r1);break;
     case 1:g.moveTo(ca*r0+tx*k,sa*r0+ty*k);g.lineTo(ca*rm,sa*rm);g.lineTo(ca*r1+tx*k,sa*r1+ty*k);break;
     case 2:g.moveTo(ca*r0-tx*k,sa*r0-ty*k);g.lineTo(ca*r1,sa*r1);g.lineTo(ca*r0+tx*k,sa*r0+ty*k);break;
     default:g.moveTo(ca*rm-tx*k,sa*rm-ty*k);g.lineTo(ca*rm+tx*k,sa*rm+ty*k);g.moveTo(ca*r0,sa*r0);g.lineTo(ca*r1,sa*r1);
    }
   }
   g.stroke();g.restore();
   if(star>1){
    const ri=r*(o.inner??.74);g.save();g.rotate(-rot*1.6);g.lineWidth=w*.75;g.beginPath();
    const step=star%2?2:1;   /* odd stars are drawn as one line through every second point */
    for(let i=0;i<=star;i++){const t=(i*step/star)*TAU-Math.PI/2;const px=Math.cos(t)*ri,py=Math.sin(t)*ri;if(i)g.lineTo(px,py);else g.moveTo(px,py);}
    if(star%2===0){g.closePath();g.stroke();g.beginPath();for(let i=0;i<=star;i++){const t=((i+.5)/star)*TAU-Math.PI/2;const px=Math.cos(t)*ri,py=Math.sin(t)*ri;if(i)g.lineTo(px,py);else g.moveTo(px,py);}g.closePath();}
    g.stroke();g.restore();
   }
   g.restore();
  },
  /* a tapered glowing streak from its tail (x1,y1) to its head (x2,y2), w the width at the head */
  streak(g,x1,y1,x2,y2,w,c,a){
   if(!(a>0&&w>0))return;
   const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
   g.save();g.globalCompositeOperation='lighter';
   for(const [k,al,col] of [[2.6,.28,rgba(c,1)],[1,1,rgba(c,1)],[.38,.9,'rgba(255,255,255,1)']]){
    const hw=w*k/2;g.globalAlpha=Math.min(1,a*al);g.fillStyle=col;
    g.beginPath();g.moveTo(x1,y1);g.lineTo(x2+nx*hw,y2+ny*hw);g.arc(x2,y2,hw,Math.atan2(ny,nx),Math.atan2(ny,nx)+Math.PI,true);g.closePath();g.fill();
   }
   g.restore();
  },
  /* a slash: a band along an arc, thick in the middle and thin at both ends - the swept edge of a blade.
     a0 -> a1 the sweep, w its thickest, flat squashes it toward the ground, lead (0-1) how far the edge has run */
  crescent(g,x,y,r,a0,a1,w,c,a,o={}){
   if(!(a>0&&w>0))return;
   const flat=o.flat??1,lead=o.lead??1,n=24,end=a0+(a1-a0)*lead,pts=[];
   for(let i=0;i<=n;i++){const u=i/n,t=a0+(end-a0)*u,th=w*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.08)),.8)*(o.taper?Math.pow(u,o.taper):1);pts.push([t,th]);}
   const path=k=>{g.beginPath();pts.forEach(([t,th],i)=>{const rr=r+th*k*.5,px=x+Math.cos(t)*rr,py=y+Math.sin(t)*rr*flat;if(i)g.lineTo(px,py);else g.moveTo(px,py);});
    for(let i=pts.length-1;i>=0;i--){const [t,th]=pts[i],rr=r-th*k*.5,px=x+Math.cos(t)*rr,py=y+Math.sin(t)*rr*flat;g.lineTo(px,py);}g.closePath();};
   g.save();g.globalCompositeOperation='lighter';
   g.fillStyle=rgba(c,1);g.globalAlpha=Math.min(1,a*.3);path(2.4);g.fill();
   g.globalAlpha=Math.min(1,a);path(1);g.fill();
   g.fillStyle='rgba(255,255,255,1)';g.globalAlpha=Math.min(1,a*.9);path(.36);g.fill();
   g.restore();
  },
  /* points of a jagged line - lightning, cracks - from (x1,y1) to (x2,y2) */
  jag(x1,y1,x2,y2,segs,amp,rnd=Math.random){
   const pts=[[x1,y1]],dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
   for(let i=1;i<segs;i++){const t=i/segs,o=(rnd()-.5)*2*amp*Math.sin(Math.PI*t);pts.push([x1+dx*t+nx*o,y1+dy*t+ny*o]);}
   pts.push([x2,y2]);return pts;
  },
  /* a glowing polyline through pts */
  line(g,pts,w,c,a){
   if(!(a>0&&w>0)||pts.length<2)return;
   g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
   g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));
   g.strokeStyle=rgba(c,1);g.globalAlpha=Math.min(1,a*.3);g.lineWidth=w*3;g.stroke();
   g.globalAlpha=Math.min(1,a);g.lineWidth=w;g.stroke();
   g.strokeStyle='rgba(255,255,255,1)';g.globalAlpha=Math.min(1,a*.9);g.lineWidth=Math.max(.5,w*.35);g.stroke();
   g.restore();
  },
  /* a column of light from y0 (its top, lost in the sky) to y1 (its foot), w wide, white down its middle */
  beam(g,x,y0,y1,w,c,a){
   if(!(a>0&&w>0&&y1>y0))return;
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.drawImage(beamSprite(c),x-w/2,y0,w,y1-y0);g.restore();
  },
 };

 /* ---------- particles ---------- */
 const P=[];let MAXP=900;
 /* kinds: 'glow' a soft light, 'spark' a streak along its flight, 'ember' a flickering light that rises, 'mote' a light
    that drifts and wobbles, 'shard' a spinning splinter (ice, arcane glass), 'smoke' a growing grey puff (not lit),
    'dust' a brown puff kicked off the ground. o: x,y, n, speed [a,b], angle [a0,a1] (radians, 0 = east), life [a,b],
    size [a,b], c, kind, drag (per second), grav (+ falls), up (initial lift), flat (squash of the spread: .5 lies on
    the ground), spread (start jitter), layer ('glow' for anything lit, 'air' for the rest), spin, draw (custom) */
 const pick=(v,r)=>Array.isArray(v)?v[0]+(v[1]-v[0])*r():v;
 function emit(o){
  const n=Math.max(0,Math.round((o.n??1)*api.quality));if(!n)return;
  const r=Math.random,kind=o.kind||'glow',lit=kind==='glow'||kind==='spark'||kind==='ember'||kind==='mote';
  for(let i=0;i<n;i++){
   const a=pick(o.angle??[0,TAU],r),v=pick(o.speed??[20,60],r),sp=o.spread||0;
   P.push({x:o.x+(r()-.5)*2*sp,y:o.y+(r()-.5)*2*sp*(o.flat??1),vx:Math.cos(a)*v,vy:Math.sin(a)*v*(o.flat??1)-(o.up||0),
    t:0,life:Math.max(.05,pick(o.life??[.4,.8],r)),s:pick(o.size??[2,4],r),c:o.c||'255,255,255',k:kind,
    drag:o.drag??2.2,g:o.grav||0,rot:r()*TAU,spin:pick(o.spin??[-6,6],r),seed:r()*100,
    layer:o.layer||(lit?'glow':'air'),draw:o.draw||null,grow:o.grow??0,a:o.alpha??1});
  }
  if(P.length>MAXP)P.splice(0,P.length-MAXP);
 }
 function drawParticle(g,p){
  const k=p.t/p.life,a=Math.min(1,k*9)*(1-k)*p.a;if(a<=0)return;
  if(p.draw){p.draw(g,p,k,a,H);return;}
  switch(p.k){
   case 'spark':{const sp=Math.hypot(p.vx,p.vy),L=Math.min(28,4+sp*.06);if(sp<1){H.glow(g,p.x,p.y,p.s*2,p.c,a);break;}
    H.streak(g,p.x-p.vx/sp*L,p.y-p.vy/sp*L,p.x,p.y,p.s*.8,p.c,a);break;}
   case 'ember':H.glow(g,p.x,p.y,p.s*(1.7+.3*Math.sin(p.t*31+p.seed)),p.c,a*(.75+.25*Math.sin(p.t*23+p.seed*3)));break;
   case 'mote':H.glow(g,p.x+Math.sin(p.t*5+p.seed)*3,p.y,p.s*1.8,p.c,a);break;
   case 'shard':{g.save();g.translate(p.x,p.y);g.rotate(p.rot);const s=p.s;
    g.globalAlpha=a;g.fillStyle=rgba(p.c,.9);g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(s*.55,0);g.lineTo(0,s*1.8);g.lineTo(-s*.55,0);g.closePath();g.fill();
    g.globalCompositeOperation='lighter';g.fillStyle='rgba(255,255,255,.75)';g.beginPath();g.moveTo(0,-s*1.5);g.lineTo(s*.2,0);g.lineTo(0,s*.6);g.closePath();g.fill();
    g.restore();H.glow(g,p.x,p.y,s*2.4,p.c,a*.45);break;}
   case 'smoke':case 'dust':{const s=p.s*(1+k*(p.grow||1.6));H.haze(g,p.x,p.y,s,p.k==='dust'?(p.c||'150,120,85'):(p.c||'90,90,96'),a*.55,1,false);break;}
   default:H.glow(g,p.x,p.y,p.s*2*(1+k*p.grow),p.c,a);
  }
 }

 /* ---------- effects ---------- */
 const L=[];let MAXE=180;
 const recipes=new Map();
 /* def: {life, layer ('ground'|'air'|'glow'), draw(g,e,p,H), update(e,dt,fx), light:{colour,reach,head,h,peak,env(p)}, reach}
    at: {x,y, follow:()=>({x,y}) to stay on someone, ...anything the draw needs} */
 function spawn(def,at={}){
  const seed=(Math.random()*4294967296)>>>0;
  const e={def,x:at.x||0,y:at.y||0,t:-(at.delay||0),life:def.life||.5,layer:def.layer||'air',o:at,seed,rnd:rng(seed)};
  L.push(e);if(L.length>MAXE)L.splice(0,L.length-MAXE);
  return e;
 }
 const fx={spawn,emit,H,get quality(){return api.quality;},shake:v=>{if(api.onShake)api.onShake(v);}};

 function update(dt){
  if(!(dt>0))return;
  for(let i=L.length-1;i>=0;i--){
   const e=L[i];e.t+=dt;
   if(e.t<0)continue;   /* waiting out its delay */
   if(e.o.follow){const f=e.o.follow();if(f){e.x=f.x;e.y=f.y;}}
   if(e.def.update)try{e.def.update(e,dt,fx);}catch(err){api.faults++;}
   if(e.t>=e.life)L.splice(i,1);
  }
  for(let i=P.length-1;i>=0;i--){
   const p=P[i];p.t+=dt;if(p.t>=p.life){P.splice(i,1);continue;}
   const d=Math.exp(-p.drag*dt);p.vx*=d;p.vy=p.vy*d+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;
  }
 }
 function draw(g,layer,view){
  const x0=view?view.x-300:-Infinity,x1=view?view.x+view.w+300:Infinity,y0=view?view.y-400:-Infinity,y1=view?view.y+view.h+300:Infinity;
  for(const e of L){
   if(e.layer!==layer||e.t<0)continue;
   const R=e.def.reach||0;
   if(e.x<x0-R||e.x>x1+R||e.y<y0-R||e.y>y1+R)continue;
   g.save();
   try{e.def.draw(g,e,Math.min(1,e.t/e.life),H);}catch(err){api.faults++;}
   g.restore();
  }
  g.save();
  for(const p of P){if(p.layer!==layer||p.x<x0||p.x>x1||p.y<y0||p.y>y1)continue;try{drawParticle(g,p);}catch(err){api.faults++;}}
  g.restore();
 }
 /* the lights of the live effects, in the shape the night's light map takes (game.js sunLights) */
 function lights(){
  const out=[];
  for(const e of L){
   const Lt=e.def.light;if(!Lt||e.t<0)continue;
   const p=Math.min(1,e.t/e.life),v=(Lt.peak??1)*(Lt.env?Lt.env(p,e):E.fade(p,.08,.4));
   if(!(v>0.01))continue;
   const gy=e.o.gy||0;
   out.push({x:e.x,y:e.y+gy,fy:e.y-(Lt.h??40),h:Lt.h??40,reach:Lt.reach??240,head:Lt.head??140,colour:Lt.colour||'255,214,156',on:0,ramp:.12,pulse:()=>v});
  }
  return out;
 }

 /* ---------- what game.js calls ---------- */
 function call(fn,o){try{fn(o,fx);return true;}catch(err){api.faults++;return false;}}
 const api={
  quality:1,faults:0,onShake:null,
  setCanvasFactory(f){makeCanvas=f;sprites.clear();},
  recipe(id,def){recipes.set(id,def);return def;},
  has(id){return recipes.has(id);},
  ids(){return [...recipes.keys()];},
  cast(id,o){const r=recipes.get(id);return !!(r&&r.cast&&call(r.cast,o));},
  hit(id,o){const r=recipes.get(id);return !!(r&&r.hit&&call(r.hit,o));},
  boltTick(b,dt){const r=recipes.get(b.fx);if(r&&r.boltTick)try{r.boltTick(b,dt,fx);}catch(err){api.faults++;}},
  drawBolt(g,b,now){
   const r=recipes.get(b.fx);if(!(r&&r.bolt))return false;
   g.save();let drawn=true;try{drawn=r.bolt(g,b,now,H)!==false;}catch(err){api.faults++;drawn=false;}g.restore();return drawn;
  },
  /* a: {gy, fx, moving, x, y (world, for tick), atk|haste|hot: {left, dur}} */
  auras(g,a,layer,now){
   for(const r of recipes.values()){
    const au=r.aura,s=au&&a[au.key];if(!s||!(s.left>0)||!au[layer])continue;
    g.save();try{au[layer](g,{...a,left:s.left,dur:s.dur||s.left},now,H);}catch(err){api.faults++;}g.restore();
   }
  },
  auraTick(a,dt){
   for(const r of recipes.values()){
    const au=r.aura,s=au&&a[au.key];if(!s||!(s.left>0)||!au.tick)continue;
    try{au.tick({...a,left:s.left,dur:s.dur||s.left},dt,fx);}catch(err){api.faults++;}
   }
  },
  update,draw,lights,emit,spawn,H,E,
  clear(){L.length=0;P.length=0;},
  count(){return {effects:L.length,particles:P.length};},
  limits(e,p){if(e)MAXE=e;if(p)MAXP=p;return {effects:MAXE,particles:MAXP};},
 };
 root.SpellFx=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
