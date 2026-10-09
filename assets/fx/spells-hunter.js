/* 🏹 Hunter: Aimed Shot, Multi-Shot, Rapid Fire - a marksman's wind: green-gold light, white air and torn leaves. Arrows
   crack the air as they leave the bow, ride a wake of light and punch through what they hit. (SpellFx recipes) */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const TAU=Math.PI*2,E=FX.E,clamp01=E.clamp01,
  GOLD='255,214,112',GOLDL='240,228,150',LEAF='170,235,120',SAP='118,214,96',WIND='226,246,236';
 const LEAFC=['rgb(112,186,62)','rgb(160,212,80)','rgb(222,192,78)','rgb(86,160,58)'];

 /* ---------- local helpers ---------- */
 /* which way a shot goes: his bow height to the mark's (the bolt flies anchor-10 to anchor-10), his facing without one */
 function aim(o,t){
  const tx=t?t.x:o.tx,ty=t?t.y:o.ty,f=o.fx||1;
  const dx=tx-o.x,dy=ty-o.y,d=Math.hypot(dx,dy);
  if(!(d>1))return {ux:f,uy:0,a:f>0?0:Math.PI,d:0};
  return {ux:dx/d,uy:dy/d,a:Math.atan2(dy,dx),d};
 }
 /* a ring of air seen from the side, square on to the line of flight: the crack an arrow makes going through it */
 function vring(g,x,y,r,w,c,a,rot,flat,a0=0,a1=TAU){
  if(!(a>0&&r>0&&w>0))return;
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';g.beginPath();g.ellipse(x,y,r*flat,r,rot,a0,a1);
  g.strokeStyle='rgb('+c+')';g.globalAlpha=Math.min(1,a*.3);g.lineWidth=w*3;g.stroke();
  g.globalAlpha=Math.min(1,a);g.lineWidth=w;g.stroke();
  g.strokeStyle='#fff';g.globalAlpha=Math.min(1,a*.85);g.lineWidth=Math.max(.5,w*.32);g.stroke();
  g.restore();
 }
 /* a glowing band through pts [x,y,width]: a soft wide halo, the colour, and a white-hot thread down its middle */
 const BAND=[[2.4,.3,0],[1,1,0],[.36,.9,1]];
 function band(g,pts,c,a){
  const n=pts.length;if(n<2||!(a>0))return;
  const nx=new Array(n),ny=new Array(n);
  for(let i=0;i<n;i++){const p0=pts[i?i-1:0],p1=pts[i<n-1?i+1:n-1],dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy)||1;nx[i]=-dy/L;ny[i]=dx/L;}
  g.save();g.globalCompositeOperation='lighter';
  for(const [k,al,white] of BAND){
   g.globalAlpha=Math.min(1,a*al);g.fillStyle=white?'#fff':'rgb('+c+')';g.beginPath();
   for(let i=0;i<n;i++){const h=pts[i][2]*k*.5;if(i)g.lineTo(pts[i][0]+nx[i]*h,pts[i][1]+ny[i]*h);else g.moveTo(pts[i][0]+nx[i]*h,pts[i][1]+ny[i]*h);}
   for(let i=n-1;i>=0;i--){const h=pts[i][2]*k*.5;g.lineTo(pts[i][0]-nx[i]*h,pts[i][1]-ny[i]*h);}
   g.closePath();g.fill();
  }
  g.restore();
 }
 /* a ribbon of wind on a ring round him, thin at both ends, climbing 'rise' units over its sweep. side -1 draws only the
    stretch behind him (the far half, before his sprite), +1 the stretch in front of him (after it), 0 all of it */
 function ribbon(g,cx,cy,rx,ry,t0,t1,w,c,a,side,rise=0){
  if(!(a>0&&w>0&&rx>0))return;
  const N=18,span=t1-t0,pts=[];
  const at=t=>{const u=(t-t0)/span;return [cx+Math.cos(t)*rx,cy+Math.sin(t)*ry-u*rise,w*Math.pow(Math.max(0,Math.sin(Math.PI*u)),.8)];};
  const ins=t=>!side||Math.sin(t)*side>=0;
  let prev=t0;
  for(let i=0;i<=N;i++){
   const t=t0+span*i/N,inside=ins(t);
   if(i&&side&&ins(prev)!==inside){   /* it passes his side: both halves meet exactly there */
    const lo=Math.min(prev,t),m=Math.ceil(lo/Math.PI)*Math.PI,pc=at(m);
    if(inside)pts.push(pc);else{pts.push(pc);band(g,pts,c,a);pts.length=0;}
   }
   if(inside)pts.push(at(t));
   prev=t;
  }
  band(g,pts,c,a);
 }
 /* a leaf: a painted blade with a pale vein, flattened as it turns over */
 function leafAt(g,x,y,rot,s,col,a,turn,rim){
  if(!(a>0))return;
  g.save();g.translate(x,y);g.rotate(rot);g.scale(1,.3+.7*Math.abs(Math.cos(turn)));
  g.globalAlpha=Math.min(1,a);g.fillStyle=col;
  g.beginPath();g.moveTo(-s,0);g.quadraticCurveTo(-s*.1,-s*.72,s,0);g.quadraticCurveTo(-s*.1,s*.72,-s,0);g.fill();
  if(rim){g.strokeStyle='rgba(255,255,215,.55)';g.lineWidth=.7;g.stroke();}
  g.globalAlpha=Math.min(1,a*.7);g.strokeStyle='rgb(250,255,220)';g.lineWidth=.55;g.beginPath();g.moveTo(-s*.85,0);g.lineTo(s*.8,0);g.stroke();
  g.restore();
 }
 /* leaves torn off in the gust, tumbling and fluttering down (pool particles drawn as leaves) */
 const leafDraw=(g,p,k,a)=>leafAt(g,p.x+Math.sin(p.t*7+p.seed)*1.6,p.y,p.rot,p.s,LEAFC[(p.seed|0)%4],a,p.t*11+p.seed);
 const leaves=(fx,o)=>fx.emit({drag:2.4,grav:70,size:[2.6,3.8],spin:[-9,9],...o,kind:'leaf',layer:'air',draw:leafDraw});
 /* a ring of air flattened on the ground where a shot lands: one particle, p.s its reach */
 const groundRing=(g,p,k,a,H)=>H.ring(g,p.x,p.y,3+p.s*E.out(k),2.2*(1-k*.5),p.c,Math.min(1,a*1.6),.42);
 /* the arrow itself: a dark shaft with a lit edge, a steel broadhead with a glint, two feathers in the hunter's colours */
 function arrow(g,x,y,a,L,fl){
  g.save();g.translate(x,y);g.rotate(a);g.lineCap='round';
  g.strokeStyle='#5b3c20';g.lineWidth=2.3;g.beginPath();g.moveTo(-L*.6,0);g.lineTo(L*.3,0);g.stroke();
  g.strokeStyle='#dcb57c';g.lineWidth=.8;g.beginPath();g.moveTo(-L*.56,-.6);g.lineTo(L*.28,-.6);g.stroke();
  g.fillStyle='#8f9ca3';g.beginPath();g.moveTo(L*.6,0);g.lineTo(L*.25,-3.9);g.lineTo(L*.31,0);g.lineTo(L*.25,3.9);g.closePath();g.fill();
  g.fillStyle='#f6faf8';g.beginPath();g.moveTo(L*.6,0);g.lineTo(L*.27,-3.3);g.lineTo(L*.33,-.3);g.closePath();g.fill();
  g.fillStyle=fl;
  g.beginPath();g.moveTo(-L*.34,0);g.lineTo(-L*.5,-4.6);g.lineTo(-L*.64,-4.4);g.lineTo(-L*.58,0);g.closePath();g.fill();
  g.beginPath();g.moveTo(-L*.34,0);g.lineTo(-L*.5,4.6);g.lineTo(-L*.64,4.4);g.lineTo(-L*.58,0);g.closePath();g.fill();
  g.restore();
 }
 const boltAng=b=>Math.atan2((b.tgt.y-10)-b.y,b.tgt.x-b.x);
 /* a tapered streak laid on as paint, not light: the colour of a shot's wake still shows over sunlit grass (2026-10-09) */
 function bodyStreak(g,x1,y1,x2,y2,w,c,a){
  if(!(a>0&&w>0))return;
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*w/2,ny=dx/L*w/2;
  g.save();g.globalAlpha=Math.min(1,a);g.fillStyle='rgb('+c+')';
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2+nx,y2+ny);g.arc(x2,y2,w/2,Math.atan2(ny,nx),Math.atan2(ny,nx)+Math.PI,true);g.closePath();g.fill();
  g.restore();
 }

 /* ---------- the wake: the light an arrow leaves in the air ----------
    It rides the arrow while it flies. Once the arrow is in (it was not ticked since the last update) the tail runs on
    into the mark and fades, so no trail blinks out with the arrow. S: len, drain (u/s), fade (s), rings (distances
    flown at which the air cracks round the shaft), paint(g,e,f,H) */
 function wakeUpdate(e,dt){
  const b=e.b,S=e.S;
  if(e.end<0&&b._n===e.seen){e.end=e.t;e.life=Math.min(e.life,e.t+S.fade);}
  if(e.end<0){
   e.seen=b._n;
   const dx=b.x-e.hx,dy=b.y-e.hy,d=Math.hypot(dx,dy);
   if(d>.5){e.run+=d;e.ang=Math.atan2(dy,dx);}
   e.hx=b.x;e.hy=b.y;e.len=Math.min(S.len,e.run+8);
   const R=S.rings;
   while(e.rings.length<R.length&&e.run>=R[e.rings.length]){
    const back=e.run-R[e.rings.length];e.rings.push([e.hx-Math.cos(e.ang)*back,e.hy-Math.sin(e.ang)*back,e.t,e.ang]);
   }
  }else e.len=Math.max(0,e.len-S.drain*dt);
  e.x=e.hx;e.y=e.hy;
 }
 function wakeDraw(g,e,p,H){
  const f=e.end<0?1:clamp01(1-(e.t-e.end)/e.S.fade);
  for(const r of e.rings){const q=(e.t-r[2])/.4;if(q<1)vring(g,r[0],r[1],4+12*E.out(q),1.4*(1-q*.4),GOLDL,(1-q)*.95,r[3],.3);}
  e.S.paint(g,e,f,H);
 }
 const wakeLight=(p,e)=>e.end<0?Math.min(1,e.t*14):clamp01(1-(e.t-e.end)/e.S.fade);
 function wake(b,fx,S){
  const e=fx.spawn({life:2,layer:'glow',reach:280,light:S.light,update:wakeUpdate,draw:wakeDraw},{x:b.x,y:b.y,gy:26});
  e.b=b;e.S=S;e.seen=-1;e.hx=b.x;e.hy=b.y;e.ang=boltAng(b);e.run=0;e.len=0;e.end=-1;e.rings=[];
  return e;
 }

 /* ================= Aimed Shot ================= */
 const AIMED={len:92,drain:720,fade:.32,rings:[0,40,80,120,160,200],   /* longer and louder since 2026-10-09 ("lite mer episka") */
  light:{colour:'232,242,170',reach:190,head:110,h:26,peak:1,env:wakeLight},
  paint(g,e,f,H){   /* a gold lance of light with the wind wound round it, fixed in the air where the arrow passed */
   const c=Math.cos(e.ang),s=Math.sin(e.ang),hx=e.hx-c*5,hy=e.hy-s*5,L=e.len;
   if(L>2&&f>0){
    bodyStreak(g,hx-c*L*1.2,hy-s*L*1.2,hx,hy,7,'176,150,40',.55*f);
    H.streak(g,hx-c*L*1.7,hy-s*L*1.7,hx,hy,4.4,SAP,.5*f);
    H.streak(g,hx-c*L,hy-s*L,hx,hy,7.2,GOLD,f);
    for(let k=0;k<2;k++){
     const pts=[];
     for(let i=0;i<=12;i++){
      const u=i/12,d=L*u,amp=4.8*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.12)),.8),off=amp*Math.sin((e.run-d)*.2+k*Math.PI-e.t*9);
      pts.push([hx-c*d-s*off,hy-s*d+c*off]);
     }
     H.line(g,pts,1.1,WIND,.75*f);
    }
   }
   if(e.end<0){const tx=e.hx+c*17,ty=e.hy+s*17;H.glow(g,tx,ty,12,GOLD,.9);H.flare(g,tx,ty,24,GOLDL,.9,e.ang);H.glow(g,tx,ty,5,'255,255,240',.9);}
  }};
 FX.recipe('aimed',{
  cast(o,fx){
   const A=aim(o),ux=A.ux,uy=A.uy,fy=o.y+(o.gy||16),mx=o.x+ux*13,my=o.y-10+uy*13;
   /* the release: a white-hot snap at the bow, a star laid along the shot and the air cracking round it */
   fx.spawn({life:.42,layer:'glow',reach:150,light:{colour:'232,242,170',reach:170,head:110,h:30,peak:.9,env:p=>p<.06?p/.06:Math.pow(1-p,2)},
    draw(g,e,p,H){
     const q=E.out(p);
     H.glow(g,mx,my,14*(1-p*.5),GOLD,clamp01(1-p*2.4));
     H.flare(g,mx,my,40*(.75+.25*q),GOLDL,clamp01(1-p*2.2),A.a);
     vring(g,mx+ux*6*q,my+uy*6*q,6+20*q,2.2*(1-p*.6),GOLDL,(1-p)*1.1,A.a,.36);
     vring(g,mx+ux*22*q,my+uy*22*q,4+11*q,1.4,WIND,(1-E.out(p*1.3))*.8,A.a,.36);
    }},{x:o.x,y:o.y,gy:o.gy});
   /* the stance: a ring snapping out from his feet and the recoil's gust swept back behind him */
   const FL=.42,back=Math.atan2(-uy/FL,-ux);
   fx.spawn({life:.6,layer:'ground',reach:90,light:{colour:'220,240,160',reach:110,head:60,h:20,peak:.45,env:p=>Math.pow(1-p,1.5)},draw(g,e,p,H){
    const q=E.out(p);
    H.ring(g,o.x,fy,10+26*q,2*(1-p*.5),GOLDL,(1-p)*.75,FL);
    H.haze(g,o.x,fy,26,LEAF,(1-p)*.35,FL);
    H.crescent(g,o.x,fy,16+16*q,back-1.1,back+1.1,6*(1-p*.4),WIND,(1-p)*.55,{flat:FL});
   }},{x:o.x,y:o.y,gy:o.gy});
   /* the mark: four corner brackets closing on the foe and turning square to it as the arrow arrives */
   const tg=o.targets&&o.targets[0],tr=(tg&&tg.r)||18,tx=o.tx??o.x+(o.fx||1)*120,ty=o.ty??o.y,ty2=ty-tr*.6,T=Math.max(.1,(A.d-12)/470);
   fx.spawn({life:T+.14,layer:'glow',reach:80,draw(g,e,p,H){
    const t=e.t,q=clamp01(t/T),R=tr+6+28*(1-E.inOut(q)),rot=(1-E.out(q))*Math.PI/4;
    const al=t<T?Math.min(1,t*10)*(.6+.4*q):clamp01(1-(t-T)/.14),arm=5+4*(1-q);
    for(let k=0;k<4;k++){
     const th=rot+Math.PI/4+k*Math.PI/2,cx=tx+Math.cos(th)*R,cy=ty2+Math.sin(th)*R*.85,a1=th+Math.PI*.75,a2=th-Math.PI*.75;
     H.line(g,[[cx+Math.cos(a1)*arm,cy+Math.sin(a1)*arm*.85],[cx,cy],[cx+Math.cos(a2)*arm,cy+Math.sin(a2)*arm*.85]],1.5,GOLD,al);
    }
   }},{x:tx,y:ty});
   fx.emit({x:mx,y:my,n:5,kind:'spark',speed:[260,460],angle:[A.a-.06,A.a+.06],life:[.16,.3],size:[1.2,2],c:WIND,drag:6,spread:4});
   fx.emit({x:mx,y:my,n:5,kind:'spark',speed:[90,200],angle:[A.a-.9,A.a+.9],life:[.15,.3],size:[1.4,2.2],c:GOLD,drag:4});
   leaves(fx,{x:mx,y:my,n:3,speed:[50,120],angle:[A.a-1.2,A.a+1.2],up:40,life:[.5,.8]});
   fx.emit({x:o.x-ux*6,y:fy,n:3,kind:'dust',speed:[30,70],angle:[A.a+Math.PI-.7,A.a+Math.PI+.7],flat:.45,life:[.4,.65],size:[4,7],layer:'air'});
  },
  boltTick(b,dt,fx){
   b._n=(b._n||0)+1;
   if(!b._w)b._w=wake(b,fx,AIMED);
   if(Math.random()<dt*34)fx.emit({x:b.x,y:b.y,n:1,kind:'mote',speed:[8,28],life:[.3,.6],size:[1.2,2],c:Math.random()<.5?LEAF:GOLDL,grav:-20,spread:4});
   if(Math.random()<dt*10)fx.emit({x:b.x,y:b.y,n:1,kind:'spark',speed:[80,160],angle:[boltAng(b)+Math.PI-.7,boltAng(b)+Math.PI+.7],life:[.12,.22],size:[1.2,1.8],c:GOLD,drag:4});
  },
  bolt(g,b,now,H){const a=boltAng(b);H.haze(g,b.x,b.y,13,'200,170,50',.45,1,false);H.haze(g,b.x,b.y,18,GOLD,.45);arrow(g,b.x,b.y,a,32,'#e6c35c');},
  hit(o,fx){
   const r=o.r||16,cy=o.y-r*.6,a=Math.atan2(cy-((o.sy??o.y)-10),o.x-(o.sx??o.x-1)),c=Math.cos(a),s=Math.sin(a),k=(o.crit?1.4:1)*1.2;
   /* the punch: a white-hot flash, a star along the flight, the wind ring it tears through and its force carrying on out */
   fx.spawn({life:.5,layer:'glow',reach:170,light:{colour:'236,242,170',reach:200,head:120,h:28,peak:o.crit?1:.8,env:p=>p<.05?p/.05:Math.pow(1-p,1.8)},
    draw(g,e,p,H){
     const q=E.out(p);
     H.glow(g,e.x,cy,(13+5*k)*(1-p*.5),GOLD,clamp01(1-p*2.4));
     H.haze(g,e.x,cy,(24+8*k),LEAF,clamp01(1-p*1.8)*.5);
     H.flare(g,e.x,cy,(44+8*k)*(o.crit?1.2:1)*(.75+.25*q),GOLDL,clamp01(1-p*2.4),a);
     vring(g,e.x+c*6*q,cy+s*6*q,6+22*k*q,2.4*(1-p*.5),GOLDL,clamp01(1-p*1.6)*1.05,a,.36);
     if(o.crit)vring(g,e.x+c*18*q,cy+s*18*q,4+14*q,1.6,WIND,clamp01(1-p*1.4),a,.36);
     const L0=10+(70+20*k)*E.out(Math.min(1,p*1.8)),L1=Math.max(0,L0-46);
     H.streak(g,e.x+c*L1,cy+s*L1,e.x+c*L0,cy+s*L0,4.2*k*(1-p),GOLDL,1-p);
    }},{x:o.x,y:o.y});
   fx.spawn({life:.7,layer:'ground',reach:80,draw(g,e,p,H){   /* the shock on the ground under it */
    const q=E.out(p);H.ring(g,e.x,e.y+4,6+r*2.1*k*q,2.6*(1-p*.6),GOLDL,(1-p)*.95,.42);H.haze(g,e.x,e.y+4,r*1.8,LEAF,(1-p)*.45,.42);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:cy,n:o.crit?20:13,kind:'spark',speed:[160,340],angle:[a-.55,a+.55],life:[.22,.4],size:[1.6,2.6],c:GOLDL,drag:3.2,grav:120});
   leaves(fx,{x:o.x,y:cy,n:o.crit?6:4,speed:[60,150],angle:[a-1.4,a+1.4],up:40,life:[.55,.9]});
   fx.emit({x:o.x,y:o.y+4,n:3,kind:'dust',speed:[20,60],flat:.45,life:[.4,.7],size:[4,8],layer:'air'});
   if(!o.peer)fx.shake(o.crit?.16:.05);
  },
 });

 /* ================= the hunter's own shot (the basic attack, 2026-10-09): a faint streak of air behind the arrow, sparks where it bites ================= */
 const SHOT={len:34,drain:520,fade:.2,rings:[],light:null,
  paint(g,e,f,H){const c=Math.cos(e.ang),s=Math.sin(e.ang),hx=e.hx-c*6,hy=e.hy-s*6,L=e.len;if(L>2&&f>0)H.streak(g,hx-c*L,hy-s*L,hx,hy,2.4,WIND,.6*f);}};
 FX.recipe('shot',{
  boltTick(b,dt,fx){b._n=(b._n||0)+1;if(!b._w)b._w=wake(b,fx,SHOT);},
  bolt(g,b,now,H){arrow(g,b.x,b.y,boltAng(b),22,'#c9a35a');return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y-(o.r||16)*.6,n:o.crit?6:3,kind:'spark',speed:[90,200],life:[.14,.26],size:[1.2,1.9],c:GOLDL,drag:4});},
 });

 /* ================= Multi-Shot ================= */
 const MULTI={len:62,drain:640,fade:.26,rings:[0,70],
  light:{colour:'200,240,150',reach:120,head:70,h:24,peak:.55,env:wakeLight},
  paint(g,e,f,H){   /* a green-gold streak behind each arrow, laid on as colour too */
   const c=Math.cos(e.ang),s=Math.sin(e.ang),hx=e.hx-c*4,hy=e.hy-s*4,L=e.len;
   if(L>2&&f>0){bodyStreak(g,hx-c*L,hy-s*L,hx,hy,5,'92,150,46',.5*f);H.streak(g,hx-c*L*1.5,hy-s*L*1.5,hx,hy,3.2,SAP,.5*f);H.streak(g,hx-c*L,hy-s*L,hx,hy,4.6,GOLDL,.95*f);}
   if(e.end<0){const tx=e.hx+c*13,ty=e.hy+s*13;H.glow(g,tx,ty,9,LEAF,.85);H.flare(g,tx,ty,15,GOLDL,.7,e.ang);}
  }};
 FX.recipe('multishot',{
  cast(o,fx){
   const fy=o.y+(o.gy||16),list=(o.targets&&o.targets.length?o.targets:[{x:o.tx??o.x+(o.fx||1)*120,y:o.ty??o.y}]).slice(0,3);
   const dirs=list.map(t=>aim(o,t));
   let sx=0,sy=0;for(const d of dirs){sx+=d.ux;sy+=d.uy;}
   const sl=Math.hypot(sx,sy),mux=sl>.2?sx/sl:(o.fx||1),muy=sl>.2?sy/sl:0,ma=Math.atan2(muy,mux),mx=o.x+mux*13,my=o.y-10+muy*13;
   /* the fan on the ground: a sweep of wind spread over the marks, and a ring at his feet */
   const FL=.42,ea=(ux,uy)=>Math.atan2(uy/FL,ux),m0=ea(mux,muy);let lo=0,hi=0;
   for(const d of dirs){const r=Math.atan2(Math.sin(ea(d.ux,d.uy)-m0),Math.cos(ea(d.ux,d.uy)-m0));lo=Math.min(lo,r);hi=Math.max(hi,r);}
   fx.spawn({life:.55,layer:'ground',reach:150,draw(g,e,p,H){
    const q=E.out(Math.min(1,p*1.5)),al=1-E.in(p);
    H.crescent(g,o.x,fy,22+34*q,m0+lo-.4,m0+hi+.4,8*(1-p*.5),WIND,al*.6,{flat:FL});
    H.ring(g,o.x,fy,9+22*q,1.8,GOLDL,al*.7,FL);
    H.haze(g,o.x,fy,24,LEAF,al*.3,FL);
   }},{x:o.x,y:o.y});
   /* the gust off the bow: a star at the string and a bow-shaped wave of air thrown out toward them */
   fx.spawn({life:.4,layer:'glow',reach:130,light:{colour:'200,240,150',reach:160,head:100,h:30,peak:.75,env:p=>p<.08?p/.08:Math.pow(1-p,2)},
    draw(g,e,p,H){
     const q=E.out(p);
     H.flare(g,mx,my,32*(.8+.2*q),GOLDL,clamp01(1-p*2.4),ma);
     H.glow(g,mx,my,10,GOLD,clamp01(1-p*2.6));
     H.crescent(g,o.x,o.y-10,20+34*q,ma-1,ma+1,6*(1-p*.5),WIND,(1-p)*.85,{flat:.85});
    }},{x:o.x,y:o.y,gy:o.gy});
   leaves(fx,{x:mx,y:my,n:4,speed:[60,140],angle:[ma-1,ma+1],up:30,life:[.5,.8]});
   fx.emit({x:mx,y:my,n:5,kind:'spark',speed:[120,240],angle:[ma-.8,ma+.8],life:[.14,.26],size:[1.3,2],c:GOLDL,drag:4});
   fx.emit({x:o.x,y:fy,n:2,kind:'dust',speed:[25,55],angle:[ma+Math.PI-.8,ma+Math.PI+.8],flat:.45,life:[.4,.6],size:[4,6],layer:'air'});
  },
  boltTick(b,dt,fx){
   b._n=(b._n||0)+1;
   if(!b._w){   /* each arrow's own snap off the string */
    b._w=wake(b,fx,MULTI);const a=boltAng(b);
    fx.emit({x:b.x+Math.cos(a)*6,y:b.y+Math.sin(a)*6,n:1,speed:0,life:.16,size:16,c:GOLDL,drag:0,draw:(g,p,k,al,H)=>H.flare(g,p.x,p.y,p.s*(1-k*.4),p.c,al,a)});
    fx.emit({x:b.x,y:b.y,n:2,kind:'spark',speed:[140,260],angle:[a-.5,a+.5],life:[.12,.22],size:[1.2,1.8],c:WIND,drag:5});
   }
   if(Math.random()<dt*8)fx.emit({x:b.x,y:b.y,n:1,kind:'mote',speed:[6,20],life:[.25,.45],size:[1,1.6],c:LEAF,grav:-16,spread:3});
  },
  bolt(g,b,now,H){const a=boltAng(b);H.haze(g,b.x,b.y,15,LEAF,.4);arrow(g,b.x,b.y,a,26,'#7cc552');},
  hit(o,fx){
   const r=o.r||16,cy=o.y-r*.6,a=Math.atan2(cy-((o.sy??o.y)-10),o.x-(o.sx??o.x-1)),c=Math.cos(a),s=Math.sin(a),k=(o.crit?1.3:1)*1.15;
   fx.spawn({life:.36,layer:'glow',reach:100,draw(g,e,p,H){   /* a green flash, a short star and the ring it punches */
    H.glow(g,e.x,cy,11*k*(1-p*.4),LEAF,clamp01(1-p*2));
    H.haze(g,e.x,cy,18*k,LEAF,clamp01(1-p*1.6)*.45);
    H.flare(g,e.x,cy,38*k,GOLDL,clamp01(1-p*2.2),a);
    vring(g,e.x+c*4*p,cy+s*4*p,5+14*k*E.out(p),1.6,GOLDL,(1-p)*.9,a,.36);
    const L0=6+34*k*E.out(Math.min(1,p*1.6)),L1=Math.max(0,L0-26);H.streak(g,e.x+c*L1,cy+s*L1,e.x+c*L0,cy+s*L0,2.6*(1-p),GOLDL,(1-p)*.8);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y+4,n:1,speed:0,life:[.4,.4],size:[r*1.4,r*1.4],c:LEAF,layer:'ground',draw:groundRing});
   fx.emit({x:o.x,y:cy,n:o.crit?8:4,kind:'spark',speed:[110,230],angle:[a-.6,a+.6],life:[.16,.3],size:[1.3,2.1],c:GOLDL,drag:3.5});
   leaves(fx,{x:o.x,y:cy,n:o.crit?3:1,speed:[50,110],angle:[a-1.3,a+1.3],up:30,life:[.5,.8]});
  },
 });

 /* ================= Rapid Fire ================= */
 /* how far along it is: el seconds in, q the eruption (0 -> 1 over its first .7 s), on the steady wind's share */
 function haste(a){
  const el=Math.max(0,a.dur-a.left),fout=clamp01(a.left/.6);
  return {el,q:clamp01((el-.06)/.64),on:clamp01((el-.3)/.4)*fout,fout};
 }
 /* the eruption: three ribbons of wind spiralling up round him from his boots - to his knees, his waist, his chest -
    opening as they climb and thinning out at the top, never a halo over his head */
 function vortex(g,a,side){
  const s=haste(a);if(s.q>=1)return;
  const al=(s.q<.08?.35+s.q*8:1)*(1-E.in(s.q));
  for(let k=0;k<3;k++){
   const h=E.out(clamp01(s.q*1.6-k*.2)),R=12+(13+5*k)*h,y=a.gy-3-(18+11*k)*h,t0=-s.el*TAU*2.3+k*TAU/3;
   ribbon(g,0,y,R,R*.36,t0,t0+2.5,5.2*(1-h*.35),k===1?LEAF:WIND,al*(1-h*.35),side,7);
  }
 }
 /* the steady wind: a ring spinning at his boots, a thread of air round his hips, two leaves caught in it, and quick
    streaks of air sliding past him as if he were running - none of it above his chest */
 function steady(g,a,now,H,side){
  const s=haste(a);if(!(s.on>0))return;
  const spin=-now*TAU*1.4,on=s.on;
  if(side<0)H.ring(g,0,a.gy,19,1.2,LEAF,.35*on,.38);
  for(let k=0;k<2;k++){const t0=spin+k*Math.PI;ribbon(g,0,a.gy,19,7.2,t0,t0+2,3.6,k?LEAF:GOLDL,.9*on,side);}
  const t1=-now*TAU*2+1;ribbon(g,0,a.gy-17,22,7.9,t1,t1+1.6,2.8,WIND,.8*on,side,4);
  for(let k=0;k<2;k++){
   const th=now*3.4+k*Math.PI+.6,sn=Math.sin(th);if(sn*side<0)continue;
   leafAt(g,Math.cos(th)*24,a.gy-11+sn*8.6+Math.sin(now*5+k)*2.5,th+Math.PI/2+Math.sin(now*6+k)*.5,4.2,LEAFC[k?2:0],on,now*11+k,true);
  }
  if(side>0){
   const f=a.fx||1;
   for(let k=0;k<2;k++){
    const c=now*2.3+k*.5,ph=c-Math.floor(c),n=Math.floor(c)*7.31+k*3.7,hy=a.gy-10-((n*13.7)%22),sx=f*(16+((n*5.3)%8));
    if(ph<.4){const u=ph/.4,x0=sx-f*44*E.out(u),L=16*(1-u)+4;H.streak(g,x0+f*L,hy,x0,hy,1.6,WIND,Math.sin(Math.PI*u)*.8*on);}
   }
  }
 }
 /* a leaf caught in the cast's whirl: it climbs round him and is flung out (its own path, not the pool's push) */
 const swirlLeaf=(cx,cy)=>(g,p,k,a)=>{const th=p.seed-k*7.5,R=10+46*E.out(k);
  leafAt(g,cx+Math.cos(th)*R,cy-8-44*E.out(k)+Math.sin(th)*R*.4,th-Math.PI/2,p.s,LEAFC[(p.seed|0)%4],a,p.t*11+p.seed);};
 FX.recipe('rapidfire',{
  cast(o,fx){
   const fy=o.y+(o.gy||16),cy=fy-28,f=o.fx||1,gy=o.gy||16;
   /* the breath in: streaks of air drawn into him from all round */
   for(let i=0;i<6;i++){
    const th=i/6*TAU+Math.random()*.5,sx=o.x+Math.cos(th)*36,sy=cy+Math.sin(th)*22,a=Math.atan2(cy-sy,o.x-sx),d=Math.hypot(cy-sy,o.x-sx)||1;
    fx.emit({x:sx,y:sy,n:1,kind:'spark',speed:d/.12,angle:a,life:.12,size:[1.2,1.6],c:WIND,drag:0});
   }
   /* the gust bursting out along the ground - and at that moment the leaves whirl up and light is flung skyward */
   fx.spawn({life:.7,layer:'ground',reach:120,light:{colour:'190,240,140',reach:170,head:80,h:22,peak:.55,env:p=>Math.pow(1-p,1.4)},
    update(e,dt,fx){
     if(e.fired)return;e.fired=1;
     for(const sd of [-1,1])fx.emit({x:e.x+sd*15,y:e.y-4,n:4,kind:'spark',speed:[260,420],angle:[-Math.PI/2+sd*.12,-Math.PI/2+sd*.6],life:[.22,.38],size:[1.4,2.2],c:GOLDL,drag:3.5,spread:5});
     fx.emit({x:e.x,y:e.y+gy,n:8,speed:0,life:[.6,.8],size:[3,4.2],layer:'air',draw:swirlLeaf(e.x,e.y+gy)});
     fx.emit({x:e.x,y:e.y+gy,n:4,kind:'dust',speed:[50,110],flat:.45,life:[.45,.7],size:[5,8],layer:'air'});
    },
    draw(g,e,p,H){
     const q=E.out(p),y=e.y+gy;
     H.ring(g,e.x,y,14+52*q,3*(1-p*.6),GOLDL,(1-p)*.95,.42);
     H.ring(g,e.x,y,10+38*E.out(p*1.3),1.8,WIND,(1-E.out(p*1.3))*.8,.42);
     H.haze(g,e.x,y,42,LEAF,(1-p)*.45,.42);
     for(let k=0;k<10;k++){const th=k/10*TAU+.3,c=Math.cos(th),s=Math.sin(th)*.42,r0=14+34*q,r1=r0+13*(1-p);
      H.streak(g,e.x+c*r0,y+s*r0,e.x+c*r1,y+s*r1,2.2*(1-p),WIND,(1-p)*.7);}
    }},{x:o.x,y:o.y,gy:o.gy,follow:o.follow,delay:.07});
   /* the flash: the bow charged with a star, green light off him (no white over his face) */
   fx.spawn({life:.55,layer:'glow',reach:110,light:{colour:'190,240,140',reach:230,head:140,h:40,peak:1,env:p=>p<.12?p/.12:Math.pow(1-p,1.6)},
    draw(g,e,p,H){
     const q=E.out(p);
     H.haze(g,e.x,e.y-8,36*(.6+.4*q),LEAF,(1-p)*.45);
     H.glow(g,e.x+f*13,e.y-7,12*(1-p*.5),GOLD,clamp01(1-p*2));
     H.flare(g,e.x+f*13,e.y-7,42*(.7+.3*q),GOLDL,clamp01(1-p*1.8),.3);
    }},{x:o.x,y:o.y,gy:o.gy,follow:o.follow,delay:.07});
  },
  aura:{key:'haste',
   back(g,a,now,H){vortex(g,a,-1);steady(g,a,now,H,-1);},
   front(g,a,now,H){   /* and the bow humming with it, quick as the shots */
    vortex(g,a,1);steady(g,a,now,H,1);
    const s=haste(a);if(s.on>0){const f=a.fx||1,tw=.5+.5*Math.sin(now*TAU*3);H.haze(g,f*13,-7,14,LEAF,(.3+.25*tw)*s.on);H.flare(g,f*13,-7,7+3*tw,GOLDL,(.45+.4*tw)*s.on,now*2);}
   },
   glow(g,a,now,H){   /* what of it shines at night: the whirl's light, the ring's, the bow's */
    const s=haste(a);
    if(s.q<1)H.haze(g,0,a.gy-24,34,LEAF,.3*(1-s.q));
    if(s.on>0){H.haze(g,0,a.gy,24,LEAF,.25*s.on,.4);H.haze(g,(a.fx||1)*13,-7,9,GOLD,(.22+.15*Math.sin(now*TAU*3))*s.on);}
   },
   tick(a,dt,fx){
    const s=haste(a);if(!(s.on>0))return;
    if(Math.random()<dt*5)fx.emit({x:a.x+(Math.random()-.5)*30,y:a.y+a.gy-2,n:1,kind:'mote',speed:[6,20],up:24,life:[.45,.75],size:[1.1,1.9],c:LEAF,grav:-26});
    if(a.moving&&Math.random()<dt*16){   /* running: streaks of air left behind him */
     const f=a.fx||1;
     fx.emit({x:a.x-f*6+(Math.random()-.5)*8,y:a.y+a.gy-8-Math.random()*26,n:1,kind:'spark',speed:[90,150],angle:f>0?Math.PI:0,life:[.16,.26],size:[.9,1.4],c:WIND,drag:3});
    }
   },
  },
 });
})();
