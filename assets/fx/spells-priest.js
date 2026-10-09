/* ☀ Priest: Smite, Holy Nova, Renew - gold-white light from above and a green-gold breath of healing. (SpellFx recipes) */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const TAU=Math.PI*2,cl=v=>v<0?0:v>1?1:v,rgba=(c,a)=>'rgba('+c+','+(+a).toFixed(3)+')';
 const GOLD='255,184,70',HOLY='255,224,140',SUN='255,240,200',WHITE='255,250,238',
  HEAL='96,220,118',HEAL2='196,255,172',DEEP='46,150,70',LEAF='170,238,104',SPRING='186,238,120',DEW='236,255,208',
  HOLY_LIGHT='255,226,170',HEAL_LIGHT='176,240,160';
 const FLAT=.55;   /* how a ring lies on the ground */

 /* one glowing stroke through every subpath build() lays: a soft band, the line, a white thread */
 function glowStroke(g,build,w,c,a){
  if(!(a>0&&w>0))return;
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
  g.beginPath();build();
  g.strokeStyle=rgba(c,1);g.globalAlpha=cl(a*.3);g.lineWidth=w*3;g.stroke();
  g.globalAlpha=cl(a);g.lineWidth=w;g.stroke();
  g.strokeStyle='rgba(255,255,255,1)';g.globalAlpha=cl(a*.85);g.lineWidth=Math.max(.5,w*.35);g.stroke();
  g.restore();
 }
 /* a painted stroke: its colour laid on (so it stays green on bright ground), a light line and a white thread over it */
 function paintStroke(g,build,w,deep,c,a){
  if(!(a>0&&w>0))return;
  g.save();g.lineCap='round';g.lineJoin='round';g.beginPath();build();
  g.strokeStyle=rgba(deep,1);g.globalAlpha=cl(a*.5);g.lineWidth=w*2.6;g.stroke();
  g.globalCompositeOperation='lighter';g.strokeStyle=rgba(c,1);g.globalAlpha=cl(a*.75);g.lineWidth=w;g.stroke();
  g.strokeStyle='rgba(255,255,255,1)';g.globalAlpha=cl(a*.5);g.lineWidth=Math.max(.5,w*.3);g.stroke();
  g.restore();
 }
 /* a sunburst: n tapered rays round (x,y) from r0 out to r1 (len(i) shortens some), w wide at the root */
 function rays(g,x,y,r0,r1,n,w,c,a,rot=0,flat=1,len=null){
  if(!(a>0&&w>0&&r1>r0))return;
  const path=k=>{g.beginPath();for(let i=0;i<n;i++){const t=rot+i/n*TAU,ca=Math.cos(t),sa=Math.sin(t),L=r0+(r1-r0)*(len?len(i):1),hw=w*k/2,bx=x+ca*r0,by=y+sa*r0*flat;
   g.moveTo(bx-sa*hw,by+ca*hw*flat);g.lineTo(x+ca*L,y+sa*L*flat);g.lineTo(bx+sa*hw,by-ca*hw*flat);g.closePath();}};
  g.save();g.globalCompositeOperation='lighter';
  g.fillStyle=rgba(c,1);g.globalAlpha=cl(a*.3);path(2.6);g.fill();
  g.globalAlpha=cl(a);path(1);g.fill();
  g.fillStyle='rgba(255,255,255,1)';g.globalAlpha=cl(a*.8);path(.4);g.fill();
  g.restore();
 }
 /* a sun lying on the ground: a ring, a thinner one inside and short rays all round */
 function sunSigil(g,H,x,y,r,c,a,rot,flat){
  if(!(a>0&&r>0))return;
  H.ring(g,x,y,r,1.8,c,a,flat);H.ring(g,x,y,r*.58,1.1,c,a*.7,flat);
  glowStroke(g,()=>{for(let i=0;i<12;i++){const t=rot+i/12*TAU,ca=Math.cos(t),sa=Math.sin(t),r1=r*(i%2?1.3:1.52);g.moveTo(x+ca*r*1.1,y+sa*r*1.1*flat);g.lineTo(x+ca*r1,y+sa*r1*flat);}},1.3,c,a*.9);
 }
 /* the petals of a flower lying on the ground, n of them out to r */
 const petalPath=(g,x,y,r,n,rot,flat)=>{for(let i=0;i<n;i++){const t=rot+i/n*TAU,ca=Math.cos(t),sa=Math.sin(t),r0=r*.16,bw=r*.3,px=x+ca*r0,py=y+sa*r0*flat,mx=x+ca*r*.6,my=y+sa*r*.6*flat;
  g.moveTo(px,py);g.quadraticCurveTo(mx-sa*bw,my+ca*bw*flat,x+ca*r,y+sa*r*flat);g.quadraticCurveTo(mx+sa*bw,my-ca*bw*flat,px,py);}};
 /* half a ring lying flat: the near half (front) passes over him, the far half behind */
 function halfRing(g,x,y,r,flat,w,c,a,front){
  if(!(a>0&&r>0))return;
  glowStroke(g,()=>{g.ellipse(x,y,r,r*flat,0,front?0:Math.PI,front?Math.PI:TAU);},w,c,a);
 }
 /* a four-pointed star pressed flat, so its upright ray stays clear of the number over the foe */
 function lowFlare(g,H,x,y,r,c,a,flat,rot){
  if(!(a>0&&r>0))return;
  g.save();g.translate(x,y);g.scale(1,flat);H.flare(g,0,0,r,c,a,rot);g.restore();
 }
 /* a halo: a thin ring of light hanging flat in the air */
 const halo=(g,H,x,y,r,c,a,w=1.5)=>H.ring(g,x,y,r,w,c,a,.3);
 /* a leaf of light that turns over as it rises */
 function leaf(g,p,k,a,H){
  const s=p.s,fl=Math.cos(p.t*7+p.seed);
  g.save();g.translate(p.x,p.y);g.rotate(p.rot);g.scale(.3+.7*Math.abs(fl),1);
  g.beginPath();g.moveTo(0,-s*1.6);g.quadraticCurveTo(s*.95,0,0,s*1.6);g.quadraticCurveTo(-s*.95,0,0,-s*1.6);
  g.globalAlpha=cl(a*.55);g.fillStyle=rgba(DEEP,1);g.fill();
  g.globalCompositeOperation='lighter';g.globalAlpha=cl(a*.6);g.fillStyle=rgba(fl>0?LEAF:HEAL,1);g.fill();
  g.globalAlpha=cl(a*.9);g.strokeStyle='rgba(255,255,255,1)';g.lineWidth=.6;g.beginPath();g.moveTo(0,-s*1.3);g.lineTo(0,s*1.3);g.stroke();
  g.restore();H.glow(g,p.x,p.y,s*2.2,HEAL2,a*.4);
 }

 /* ---------- Smite: light leaps from his hand to the sky, a sun opens over the foe and strikes it with a lance of light ---------- */
 FX.recipe('smite',{
  cast(o,fx){
   const f=o.follow,hx=o.x+o.fx*12,hy=o.y+o.gy-30;
   /* a sun flashes on the ground round his feet */
   fx.spawn({life:.5,layer:'ground',draw(g,e,p,H){
    const y=e.y+o.gy,a=H.E.fade(p,.06,.35);
    H.haze(g,e.x,y,40,GOLD,a*.42,FLAT);
    sunSigil(g,H,e.x,y,15+12*H.E.out(p),HOLY,a,p*.9,FLAT);
   }},{x:o.x,y:o.y,follow:f});
   /* his hand flares white, a streak of light leaps from it to the sky, and a halo rings his head */
   fx.spawn({life:.4,layer:'glow',draw(g,e,p,H){
    const y=e.y+o.gy,x=e.x+o.fx*12,a=1-H.E.in(p),q=H.E.out(cl(p*2.4));
    H.glow(g,x,y-30,18*(1-p*.5),HOLY,a);
    H.flare(g,x,y-30,30*H.E.out(cl(p*4))*(1-p*.4),WHITE,a,p*1.4);
    H.streak(g,x,y-34-q*20,x,y-40-q*78,3.2,SUN,a*(1-p));
    halo(g,H,e.x,e.y-41,9*H.E.back(cl(p*3)),HOLY,a*.9);
   }},{x:o.x,y:o.y,follow:f});
   fx.emit({x:o.x,y:o.y+o.gy-2,n:6,kind:'mote',speed:[10,40],flat:.5,spread:12,up:30,life:[.4,.65],size:[1.3,2.2],c:HOLY,grav:-40});
   fx.emit({x:hx,y:hy,n:4,kind:'spark',speed:[120,200],angle:[-Math.PI/2-.35,-Math.PI/2+.35],life:[.15,.3],size:[1.1,1.8],c:WHITE,drag:4});
  },
  hit(o,fx){
   const foot=o.y+4+o.r*.1,cy=o.y-o.r*.6,k=o.crit?1.25:1,D=.07,SY=foot-92-o.r*1.2;   /* the sun stands clear over any foe */
   /* a small sun opens over the foe - a gold disc, its ring and its rays - then strikes: a lance of light, white down its heart */
   fx.spawn({life:.58,layer:'glow',reach:160,light:{colour:HOLY_LIGHT,reach:240*k,head:160,h:60,peak:1,env:p=>p<.12?p/.12:Math.pow(1-(p-.12)/.88,1.5)},draw(g,e,p,H){
    const t=e.t,after=cl((t-D)/(e.life-D)),sa=t<D?H.E.out(t/D):1-H.E.in(after),q=t<D?H.E.back(t/D):1;
    H.haze(g,e.x,SY,32*k*q,GOLD,sa*.55);
    H.glow(g,e.x,SY,20*k*q,SUN,sa*.9);
    rays(g,e.x,SY,10*k,(21+10*q)*k,12,2,SUN,sa*.6,t*1.1,1,i=>i%2?.5:1);
    halo(g,H,e.x,SY,(17+5*after)*k*q,HOLY,sa,2);
    H.flare(g,e.x,SY,26*k*q,WHITE,sa*.85,t*2);
    if(t<D)return;
    const b=cl((t-D)/.26),w=(1-.8*H.E.out(b))*k,a=1-H.E.in(b);   /* a quick strike, gone before the number climbs through it */
    H.beam(g,e.x,SY,foot,30*w,GOLD,a*.34);
    H.beam(g,e.x,SY,foot,12*w,HOLY,a*.8);
    H.beam(g,e.x,SY,foot,4.5*w,WHITE,a);
    H.glow(g,e.x,foot-2,38*k*(1-b*.5),HOLY,a*.85,.42);   /* where it strikes the ground */
   }},{x:o.x,y:o.y});
   /* it bursts on the foe: a white star in a gold flash */
   fx.spawn({life:.45,layer:'glow',draw(g,e,p,H){
    const a=Math.pow(1-p,1.6),s=(o.r+28)*k;
    H.glow(g,e.x,cy,s*.6*(.6+.4*H.E.out(p)),HOLY,a*.85);
    lowFlare(g,H,e.x,cy,s*(.6+.5*H.E.out(p)),WHITE,a,.6,p*.3);
    if(o.crit)lowFlare(g,H,e.x,cy,s*.85*(.6+.5*H.E.out(p)),HOLY,a*.8,.6,Math.PI/4-p*.3);
   },update(e,dt,fx){if(e.burst)return;e.burst=1;
    fx.emit({x:o.x,y:cy,n:o.crit?16:10,kind:'spark',speed:[90,230],angle:[-Math.PI*.95,-Math.PI*.05],life:[.25,.5],size:[1.3,2.2],c:HOLY,drag:3,grav:300});
    fx.emit({x:o.x,y:cy,n:5,kind:'mote',speed:[10,40],life:[.5,.8],size:[1.4,2.2],c:SUN,grav:-50,spread:o.r*.5});
    if(o.crit&&!o.peer)fx.shake(.1);
   }},{x:o.x,y:o.y,delay:D});
   /* and round it on the ground a ring runs out and sun-rays burn outward */
   fx.spawn({life:.7,layer:'ground',draw(g,e,p,H){
    const a=1-H.E.in(p),q=H.E.out(p);
    H.haze(g,e.x,foot,(o.r+30)*k,GOLD,a*.4,FLAT);
    H.ring(g,e.x,foot,(6+(o.r*1.4+30)*q)*k,2.6,HOLY,a,FLAT);
    if(o.crit)H.ring(g,e.x,foot,(4+(o.r*1.4+30)*H.E.out(p*.8))*k*.7,2,SUN,a*.8,FLAT);
    rays(g,e.x,foot,5,(14+(o.r+22)*q)*k,10,4.5,HOLY,a*.8*(1-p),.2,FLAT,i=>i%2?.6:1);
   }},{x:o.x,y:o.y,delay:D});
  },
 });

 /* ---------- Holy Nova: light bursts out of him and a wall of it races over the ground to every foe in reach ---------- */
 const NOVA_R=115,NOVA_T=.36;   /* its reach, and how long the ring takes to get there */
 const novaR=(R,q)=>10+(R-10)*(1-Math.pow(1-q,3));
 FX.recipe('holynova',{
  cast(o,fx){
   const R=o.rad||NOVA_R,f=o.follow;
   /* gold light bursts out of his chest, with the sun's rays */
   fx.spawn({life:.34,layer:'glow',reach:R+40,light:{colour:HOLY_LIGHT,reach:R*2.4,head:190,h:30,peak:1,env:p=>p<.1?p/.1:Math.pow(1-p,1.2)},draw(g,e,p,H){
    const cy=e.y+o.gy-26,a=1-H.E.out(p),q=H.E.out(cl(p*2.5));
    H.glow(g,e.x,cy,20+18*q,HOLY,a*.8);H.glow(g,e.x,cy,12,WHITE,a*.85);
    H.flare(g,e.x,cy,30+34*q,SUN,a*.85,p*.6);
    rays(g,e.x,cy,14,14+R*.5*q,12,2.2,HOLY,a*.6,p*.35,1,i=>i%2?.5:1);
   }},{x:o.x,y:o.y,gy:o.gy,follow:f});
   /* a ring of air-light bursting round him */
   fx.spawn({life:.3,layer:'glow',draw(g,e,p,H){H.ring(g,e.x,e.y+o.gy-24,18+52*H.E.out(p),2,SUN,(1-p)*.8,.85);}},{x:o.x,y:o.y,follow:f});
   /* the wave of light races over the ground: its soft band and the sun at his feet lie under everyone */
   fx.spawn({life:.62,layer:'ground',reach:R+30,draw(g,e,p,H){
    const y=e.y+o.gy,q=cl(e.t/NOVA_T),r=novaR(R,q),a=1-H.E.in(p);
    H.haze(g,e.x,y,r*1.05,HOLY,a*.3,FLAT);
    H.ring(g,e.x,y,r,5,GOLD,a*.5,FLAT);
    H.ring(g,e.x,y,r*.78,1.6,GOLD,a*.4,FLAT);
    sunSigil(g,H,e.x,y,26+6*q,HOLY,a*.8,-p*.7,FLAT);
   }},{x:o.x,y:o.y});
   /* and its bright edge, with a wall of light rising off it, shines over them by night as by day */
   fx.spawn({life:.62,layer:'glow',reach:R+40,draw(g,e,p,H){
    const y=e.y+o.gy,q=cl(e.t/NOVA_T),r=novaR(R,q),a=1-H.E.in(p),wa=a*.36*cl((r-36)/30);
    H.ring(g,e.x,y,r,2.4,SUN,a,FLAT);
    if(wa>0)for(let i=0;i<36;i++){const t=i/36*TAU,px=e.x+Math.cos(t)*r,py=y+Math.sin(t)*r*FLAT;H.haze(g,px,py-11,10,HOLY,wa,1.7);}
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y+o.gy-4,n:16,kind:'mote',speed:[R*2.2,R*3.3],flat:FLAT,drag:4.5,life:[.45,.7],size:[1.3,2.3],c:SUN,grav:-30});
   fx.emit({x:o.x,y:o.y+o.gy-26,n:6,kind:'spark',speed:[120,220],angle:[-Math.PI*.9,-Math.PI*.1],life:[.2,.4],size:[1.2,2],c:WHITE,drag:3.5,grav:200});
   if(!o.peer)fx.shake(.08);
  },
  hit(o,fx){
   const R=NOVA_R,sx=o.sx??o.x,sy=o.sy??o.y,d=Math.hypot(o.x-sx,(o.y-sy)/FLAT),q=d<=10?0:d>=R?1:1-Math.cbrt(1-(d-10)/(R-10));
   const foot=o.y+4+o.r*.1,cy=o.y-o.r*.6;
   /* as the ring runs over it: light flares up off the ground round it, and a small star */
   fx.spawn({life:.36,layer:'glow',draw(g,e,p,H){
    const a=Math.pow(1-p,1.5);
    H.beam(g,e.x,foot-o.r-14,foot+2,(o.r+8)*(1-p*.4),HOLY,a*.6);
    H.glow(g,e.x,foot,o.r+10,HOLY,a*.7,.42);
    lowFlare(g,H,e.x,cy,(o.r+12)*(.7+.4*H.E.out(p))*(o.crit?1.3:1),SUN,a,.6,p*.4);
   },update(e,dt,fx){if(e.burst)return;e.burst=1;
    fx.emit({x:o.x,y:cy,n:o.crit?6:3,kind:'spark',speed:[70,170],angle:[-Math.PI*.9,-Math.PI*.1],life:[.2,.4],size:[1.2,2],c:HOLY,drag:3,grav:260});
   }},{x:o.x,y:o.y,delay:q*NOVA_T});
  },
 });

 /* ---------- Renew: a ring of blessing slides down over him, a flower of light opens at his feet, and its breath winds round him ---------- */
 const RING_T=.42;   /* when the ring of blessing reaches his feet and the flower opens */
 /* motes whirling up round him: the far side behind him (ground layer), the near side over him (glow layer) */
 function whirl(o,fx,side){
  fx.spawn({life:.7,layer:side<0?'ground':'glow',draw(g,e,p,H){
   const y=e.y+o.gy;
   for(let i=0;i<6;i++){
    const s=i%2,u=cl(p*1.3-(i>>1)*.07),ang=u*7+s*Math.PI+(i>>1)*.5,dep=Math.sin(ang);
    if((dep<0)!==(side<0)||u<=0||u>=1)continue;
    const rad=25-u*12,x=e.x+Math.cos(ang)*rad,yy=y-4-u*64+dep*rad*.42,a=Math.sin(Math.PI*u)*(side<0?.75:1);
    const pu=u-.07,pa=pu*7+s*Math.PI+(i>>1)*.5,pr=25-pu*12;
    H.streak(g,e.x+Math.cos(pa)*pr,y-4-pu*64+Math.sin(pa)*pr*.42,x,yy,3,HEAL2,a*.8);
    H.glow(g,x,yy,5,HEAL2,a);
   }
  }},{x:o.x,y:o.y,follow:o.follow});
 }
 const renewFade=a=>Math.max(0,Math.min(1,(a.dur-a.left)/.3,a.left/.5));
 /* the flower at his feet: it opens as the ring lands (e seconds into the spell), then turns slowly; thread: only its light line */
 function flower(g,H,gy,now,f,e,thread){
  const b=cl((e-RING_T+.04)/.36);if(!(b>0))return;
  const r=5+17*H.E.back(b),rot=now*.35,path=()=>petalPath(g,0,gy,r,6,rot,FLAT);
  if(thread){glowStroke(g,path,.6,HEAL,f*.3);return;}
  g.save();g.beginPath();path();g.globalAlpha=cl(f*.22);g.fillStyle=rgba(DEEP,1);g.fill();   /* the petals painted green, lit from inside */
  g.globalCompositeOperation='lighter';g.globalAlpha=cl(f*.14);g.fillStyle=rgba(HEAL,1);g.fill();g.restore();
  paintStroke(g,path,1.3,DEEP,HEAL2,f*.75);
  if(b<1)H.ring(g,0,gy,20+20*H.E.out(b),2,HEAL2,(1-b)*f,FLAT);   /* the bloom's own breath */
 }
 /* threads of light rising off the petal tips round his feet, beside him and never over his face;
    side -1 the far ones (behind him), 1 the near ones; core: only their white hearts, for the night */
 function breath(g,H,gy,now,f,side,core){
  for(let i=0;i<8;i++){
   const t=i/8*TAU+now*.35,dep=Math.sin(t);if((dep<0)!==(side<0))continue;
   const u=(now*.5+i*.37)%1,x=Math.cos(t)*21,y=gy+dep*21*FLAT-6-u*40,a=f*Math.sin(Math.PI*u)*(side<0?.6:1);
   if(core){H.glow(g,x,y,2.4,WHITE,a*.7);continue;}
   H.streak(g,x,y+15,x,y,2.4,HEAL2,a*.8);H.glow(g,x,y,3.6,HEAL2,a);
  }
 }
 FX.recipe('renew',{
  cast(o,fx){
   const f=o.follow,E=FX.E;
   /* a soft column of spring light behind him, falling from the sky */
   fx.spawn({life:.7,layer:'ground',reach:260,light:{colour:HEAL_LIGHT,reach:220,head:150,h:40,peak:.9},draw(g,e,p,H){
    const y=e.y+o.gy,a=H.E.fade(p,.08,.3),w=1-p*.4;
    H.beam(g,e.x,y-220,y+6,30*w,SPRING,a*.3);
    H.beam(g,e.x,y-220,y+6,9*w,DEW,a*.55);
    H.haze(g,e.x,y,40,HEAL,a*.4,FLAT);
   }},{x:o.x,y:o.y,gy:o.gy,follow:f});
   /* the ring of blessing: from round his head down to his feet, its far half behind him and its near half over him */
   const ring=(e,p)=>{const q=E.inOut(cl(e.t/RING_T));return {y:e.y+o.gy-54+54*q,r:13+13*q};};
   fx.spawn({life:.6,layer:'ground',draw(g,e,p,H){const R=ring(e,p);halfRing(g,e.x,R.y,R.r,.32,2.2,HEAL2,H.E.fade(p,.06,.75),false);}},{x:o.x,y:o.y,follow:f});
   fx.spawn({life:.6,layer:'glow',reach:260,draw(g,e,p,H){
    const R=ring(e,p),a=H.E.fade(p,.06,.75),y=e.y+o.gy,w=1-p*.4;
    halfRing(g,e.x,R.y,R.r,.32,2.2,HEAL2,a,true);
    H.glow(g,e.x-R.r,R.y,5,HEAL2,a*.8);H.glow(g,e.x+R.r,R.y,5,HEAL2,a*.8);
    H.beam(g,e.x,y-220,y-62,9*w,DEW,H.E.fade(p,.1,.35)*.45);   /* the column over his head, bright over the night */
   }},{x:o.x,y:o.y,follow:f});
   whirl(o,fx,-1);whirl(o,fx,1);
   fx.emit({x:o.x-7,y:o.y+o.gy-12,n:3,kind:'mote',speed:[40,80],angle:[-Math.PI*.95,-Math.PI*.7],life:[.5,.8],size:[2,2.8],c:LEAF,drag:2.5,grav:-50,draw:leaf,layer:'glow'});
   fx.emit({x:o.x+7,y:o.y+o.gy-12,n:3,kind:'mote',speed:[40,80],angle:[-Math.PI*.3,-Math.PI*.05],life:[.5,.8],size:[2,2.8],c:LEAF,drag:2.5,grav:-50,draw:leaf,layer:'glow'});
   fx.emit({x:o.x,y:o.y+o.gy-4,n:8,kind:'mote',speed:[10,30],flat:.5,spread:18,up:40,life:[.5,.8],size:[1.3,2.2],c:HEAL2,grav:-30});
  },
  aura:{key:'hot',
   back(g,a,now,H){
    const f=renewFade(a);if(!f)return;
    const y=a.gy,e=a.dur-a.left,u=(e%1)/.55;
    H.haze(g,0,y,26,DEEP,f*.35,FLAT,false);   /* the ground round him greened, and lit */
    H.haze(g,0,y,24,HEAL,f*(.22+.06*Math.sin(now*3)),FLAT);
    flower(g,H,y,now,f,e);
    if(e>1&&u<1)H.ring(g,0,y,10+22*H.E.out(u),1.6,HEAL2,f*(1-u)*.7,FLAT);   /* a breath of it each second */
    breath(g,H,y,now,f,-1);
   },
   front(g,a,now,H){const f=renewFade(a);if(f)breath(g,H,a.gy,now,f,1);},
   glow(g,a,now,H){
    const f=renewFade(a);if(!f)return;
    breath(g,H,a.gy,now,f,1,true);
    flower(g,H,a.gy,now,f,a.dur-a.left,true);
   },
   tick(a,dt,fx){
    const f=renewFade(a);if(!(f>0))return;
    if(Math.random()<dt*(a.moving?7:4)){const t=(Math.random()<.5?0:Math.PI)+(Math.random()-.5)*1.4;   /* beside him, not over his face */
     fx.emit({x:a.x+Math.cos(t)*20,y:a.y+a.gy-4+Math.sin(t)*9,n:1,kind:'mote',speed:[3,10],up:24,life:[.6,1],size:[1.1,1.9],c:HEAL2,grav:-14,layer:'glow'});}
    if(a.moving&&Math.random()<dt*2.5)fx.emit({x:a.x+(Math.random()-.5)*16,y:a.y+a.gy-10,n:1,kind:'mote',speed:[8,20],up:26,life:[.6,.9],size:[1.6,2.4],c:LEAF,grav:-18,draw:leaf,layer:'glow'});
   },
  },
 });
})();
