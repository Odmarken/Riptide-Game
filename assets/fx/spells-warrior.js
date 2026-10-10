/* ⚔ Warrior: Heroic Strike, Whirlwind, Battle Shout - white-hot steel, crimson and ember rage, dust and sparks. (SpellFx recipes) */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const H=FX.H,E=H.E,rgba=H.rgba,TAU=Math.PI*2,PI=Math.PI;
 const STEEL='214,230,255',WHITE='255,248,236',EMBER='255,128,40',RAGE='230,40,28',CRIMSON='168,18,22',DEEP='96,6,10',GOLD='255,204,116';
 const take=k=>(globalThis.__wTake||{})[k];

 /* ---------- local drawing ---------- */
 /* how thick a blade's trail is along its length (0 its tail, 1 its head): a hair at the tail, fullest just behind the tip */
 const prof=u=>Math.pow(Math.sin(PI*E.clamp01(u)),.4)*(.25+.75*u);
 /* the outline of one layer of a blade's trail round (x,y): the edge at radius r, reaching k of its depth w inward */
 function trailPath(g,x,y,r,tail,head,w,k,flat){
  const n=20;g.beginPath();
  for(let i=0;i<=n;i++){const u=i/n,t=tail+(head-tail)*u,rr=r+w*k*prof(u)*.12,px=x+Math.cos(t)*rr,py=y+Math.sin(t)*rr*flat;if(i)g.lineTo(px,py);else g.moveTo(px,py);}
  for(let i=n;i>=0;i--){const u=i/n,t=tail+(head-tail)*u,rr=Math.max(1,r-w*k*prof(u));g.lineTo(x+Math.cos(t)*rr,y+Math.sin(t)*rr*flat);}
  g.closePath();
 }
 /* a blade's swept trail: painted crimson where the blade passed (so it reads on bright ground), hotter toward its
    edge - red, ember, steel - and a white-hot line along the edge itself */
 const TRAIL=[[1.1,DEEP,.3,0],[.8,CRIMSON,.5,0],[.55,RAGE,.35,1],[.32,EMBER,.7,1],[.16,STEEL,.9,1],[.06,WHITE,1,1]];
 /* the whirlwind's blades: more steel in them, less of the red smear, so they read as blades going round */
 const WHIRL=[[1,DEEP,.18,0],[.7,CRIMSON,.32,0],[.5,RAGE,.3,1],[.34,EMBER,.55,1],[.22,STEEL,.95,1],[.09,WHITE,1,1]];
 function trail(g,x,y,r,tail,head,w,a,flat=1,layers=TRAIL){
  if(!(a>0&&w>0)||Math.abs(head-tail)<.02)return;
  g.save();
  for(const [k,c,al,add] of layers){g.globalCompositeOperation=add?'lighter':'source-over';g.globalAlpha=Math.min(1,a*al);g.fillStyle=rgba(c,1);trailPath(g,x,y,r,tail,head,w,k,flat);g.fill();}
  g.restore();
 }
 /* a sword cut: a lens from (x1,y1) to (x2,y2), full on one side and nearly flat on the other */
 function lensPath(g,x1,y1,x2,y2,w){
  const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*w,ny=dx/L*w,mx=(x1+x2)/2,my=(y1+y2)/2;
  g.beginPath();g.moveTo(x1,y1);g.quadraticCurveTo(mx+nx,my+ny,x2,y2);g.quadraticCurveTo(mx-nx*.3,my-ny*.3,x1,y1);g.closePath();
 }
 const CUT=[[1.6,DEEP,.35,0],[1.25,CRIMSON,.55,0],[.8,EMBER,.85,1],[.32,WHITE,1,1]];
 function cut(g,x1,y1,x2,y2,w,a){
  if(!(a>0&&w>0))return;
  g.save();
  for(const [k,c,al,add] of CUT){g.globalCompositeOperation=add?'lighter':'source-over';g.globalAlpha=Math.min(1,a*al);g.fillStyle=rgba(c,1);lensPath(g,x1,y1,x2,y2,w*k);g.fill();}
  g.restore();
 }
 /* a war-crest on the ground: a double ring with blades pointing out of it, long and short in turn */
 function crest(g,x,y,r,c,a,rot,flat){
  if(!(a>0&&r>0))return;
  g.save();g.globalCompositeOperation='lighter';g.translate(x,y);g.scale(1,flat);
  g.strokeStyle=rgba(c,1);g.lineWidth=6;g.globalAlpha=Math.min(1,a*.25);g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
  g.lineWidth=2;g.globalAlpha=Math.min(1,a);g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
  g.lineWidth=1.1;g.beginPath();g.arc(0,0,r*.84,0,TAU);g.stroke();
  g.fillStyle=rgba(c,1);g.beginPath();
  for(let i=0;i<16;i++){const t=rot+i/16*TAU,L=i%2?1.18:1.42,b=.075;
   g.moveTo(Math.cos(t-b)*r*1.02,Math.sin(t-b)*r*1.02);g.lineTo(Math.cos(t)*r*L,Math.sin(t)*r*L);g.lineTo(Math.cos(t+b)*r*1.02,Math.sin(t+b)*r*1.02);g.closePath();}
  g.fill();
  g.globalAlpha=Math.min(1,a*.85);g.fillStyle='rgba(255,236,200,1)';g.beginPath();
  for(let i=0;i<16;i+=2){const t=rot+i/16*TAU,b=.025;g.moveTo(Math.cos(t-b)*r*1.04,Math.sin(t-b)*r*1.04);g.lineTo(Math.cos(t)*r*1.32,Math.sin(t)*r*1.32);g.lineTo(Math.cos(t+b)*r*1.04,Math.sin(t+b)*r*1.04);g.closePath();}
  g.fill();
  g.restore();
 }
 /* a flame tongue rising from (x,y): w wide at its foot, h tall, its tip bent by sway - crimson outside, ember, a pale heart */
 function tonguePath(g,x,y,w,h,sway){
  g.beginPath();g.moveTo(x-w/2,y);g.quadraticCurveTo(x-w*.6+sway*.2,y-h*.55,x+sway,y-h);g.quadraticCurveTo(x+w*.6+sway*.2,y-h*.55,x+w/2,y);g.closePath();
 }
 function flame(g,x,y,w,h,sway,a,painted){
  if(!(a>0&&h>0))return;
  g.save();
  if(painted===true){g.globalAlpha=Math.min(1,a*.4);g.fillStyle=rgba(CRIMSON,1);tonguePath(g,x,y,w*1.15,h*1.06,sway);g.fill();}   /* a painted red body: it reads on grass in daylight */
  g.globalCompositeOperation='lighter';
  g.globalAlpha=Math.min(1,a*.5);g.fillStyle=rgba(RAGE,1);tonguePath(g,x,y,w,h,sway);g.fill();
  g.globalAlpha=Math.min(1,a*.55);g.fillStyle=rgba(EMBER,1);tonguePath(g,x,y,w*.62,h*.72,sway*.7);g.fill();
  g.globalAlpha=Math.min(1,a*.5);g.fillStyle='rgba(255,226,170,1)';tonguePath(g,x,y,w*.3,h*.42,sway*.4);g.fill();
  g.restore();
 }
 /* cracks running out from (x,y) across the ground: jagged lines, scorched dark with an ember glow inside */
 function cracks(x,y,n,len,rnd){
  const out=[];
  for(let i=0;i<n;i++){const a=(i+rnd()*.6)/n*TAU,L=len*(.6+.4*rnd());out.push(H.jag(x,y,x+Math.cos(a)*L,y+Math.sin(a)*L*.45,4,L*.12,rnd));}
  return out;
 }
 function drawCracks(g,list,a,hot){
  g.save();g.lineCap='round';g.lineJoin='round';
  g.strokeStyle='rgba(46,22,12,1)';g.globalAlpha=Math.min(1,a*.8);g.lineWidth=3.8;
  for(const pts of list){g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.stroke();}
  g.restore();
  if(hot>0)for(const pts of list)H.line(g,pts,1.6,EMBER,hot);
 }

 /* a chip of rock knocked off the ground: a small dark stone, lit on its top face, spinning as it flies */
 function chip(g,p,k,a){
  const s=p.s;g.save();g.translate(p.x,p.y);g.rotate(p.rot);g.globalAlpha=a;
  g.fillStyle='rgba(70,50,34,1)';g.beginPath();g.moveTo(-s,-s*.6);g.lineTo(s*.8,-s*.8);g.lineTo(s,s*.5);g.lineTo(-s*.5,s*.8);g.closePath();g.fill();
  g.fillStyle='rgba(160,126,90,1)';g.beginPath();g.moveTo(-s,-s*.6);g.lineTo(s*.8,-s*.8);g.lineTo(0,-s*.1);g.closePath();g.fill();
  g.restore();
 }

 /* ---------- Heroic Strike: an overhead chop, its trail sweeping from over his head down through the foe ---------- */
 const HIT_AT=.05;   /* the blade lands this long after the strike goes off - the impact waits for it */
 FX.recipe('heroic',{
  cast(o,fx){
   const f=o.fx<0?-1:1,F=o.y+o.gy,t0=(o.targets&&o.targets[0])||{r:18};
   const cx=o.x+f*6,cy=F-26,tx=o.tx??o.x+f*44,ty=(o.ty??o.y)-(t0.r||18)*.6;
   const dx=Math.max(16,(tx-cx)*f),dy=Math.max(-40,Math.min(40,ty-cy)),aR=Math.atan2(dy,dx),R=Math.max(40,Math.min(54,Math.hypot(dx,dy)))*(o.k||1);   /* o.k: 🌳 Mighty Blows cut wider */
   const m=a=>f>0?a:PI-a,a0=m(aR-2.1),a1=m(aR+1);
   fx.spawn({life:.36,layer:'glow',reach:160,draw(g,e,p,H){
    const t=e.t,sw=a1-a0,head=a0+sw*E.out(t/.12),tail=a0+sw*.95*E.inOut((t-.025)/.27),al=t<.18?1:1-(t-.18)/.18,rr=R*(1+.05*E.out(p));
    const eh=a0+sw*E.out((t-.04)/.12),et=a0+sw*.95*E.inOut((t-.06)/.25);
    if(t>.04)trail(g,cx,cy,rr+6,et,eh,R*.22,al*.5,1);   /* an echo of the edge, a beat behind */
    trail(g,cx,cy,rr,tail,head,R*.62,al,1);
    if(t<.15)H.flare(g,cx+Math.cos(head)*rr,cy+Math.sin(head)*rr,24,STEEL,(1-t/.15),head);   /* the tip's glint */
   }},{x:o.x,y:o.y});
   /* his front foot stamps: rings of rage on the ground, a pool of red light under him, rage flicking up behind him */
   fx.spawn({life:.45,layer:'ground',reach:70,draw(g,e,p,H){
    const x=e.x+f*6,t=e.t;
    H.haze(g,x,F,40,RAGE,(1-p)*.55,.42);
    if(t<.3){const q=t/.3;for(let i=0;i<5;i++){const u=(i-2)/2;flame(g,e.x+u*15-f*3,F-1,11,(30+14*(1-Math.abs(u)))*E.out(Math.min(1,t/.06))*(1-E.in(q)),Math.sin(t*20+i*2)*3-f*5*q,(1-q)*.9,true);}}
    H.ring(g,x,F,10+38*E.out(p),3.4*(1-p)+.6,EMBER,(1-p)*.95,.42);
    const q=E.clamp01((p-.08)/.7);if(q>0&&q<1)H.ring(g,x,F,6+26*E.out(q),2*(1-q)+.5,RAGE,(1-q)*.8,.42);
   }},{x:o.x,y:o.y});
   /* the grip flares as the blow starts, rage rushing into it */
   fx.spawn({life:.26,layer:'glow',draw(g,e,p,H){
    const hx=e.x+f*13,hy=F-24,t=e.t;
    if(t<.09){const rnd=H.rng(e.seed),k=E.in(t/.09);
     for(let i=0;i<7;i++){const a=(i+rnd()*.5)/7*TAU,r=4+30*(1-k),ca=Math.cos(a),sa=Math.sin(a);H.streak(g,hx+ca*(r+12),hy+sa*(r+12),hx+ca*r,hy+sa*r,2.2,EMBER,1-k*.5);}}
    H.glow(g,hx,hy,26*(1-p*.5),EMBER,Math.pow(1-p,1.5));
    H.flare(g,hx,hy,44*(.6+.4*E.out(p)),GOLD,(1-p)*.9,.3*f);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x+f*8,y:F,n:7,kind:'dust',speed:[30,100],angle:f>0?[-.7,.7]:[PI-.7,PI+.7],flat:.4,life:[.4,.7],size:[5,9],layer:'air'});
   fx.emit({x:o.x-f*4,y:F,n:4,kind:'dust',speed:[20,60],angle:f>0?[PI-.6,PI+.6]:[-.6,.6],flat:.4,life:[.35,.6],size:[4,7],layer:'air'});
  },
  hit(o,fx){
   const r=o.r||18,bx=o.x,by=o.y-r*.6,crit=!!o.crit,f=o.x>=(o.sx??o.x-1)?1:-1,feet=o.y+r*.55;
   const da=f>0?1.2:PI-1.2,L=r*(crit?2:1.6),ux=Math.cos(da)*L,uy=Math.sin(da)*L;   /* the cut runs the way the blade travels */
   fx.spawn({life:.5,layer:'glow',reach:170,light:{colour:'255,168,96',reach:crit?260:200,head:120,h:28,peak:crit?1.25:.95,env:p=>Math.pow(1-p,2)},
    update(e,dt,fx){if(e.k)return;e.k=1;   /* the moment it lands: sparks fly on along the blade's path, dust jumps */
     fx.emit({x:bx,y:by,n:crit?14:12,kind:'spark',speed:[150,400],angle:[da-.9,da+.9],life:[.2,.45],size:[1.6,3.2],c:GOLD,drag:3.2,grav:420});
     fx.emit({x:bx,y:by,n:4,kind:'spark',speed:[80,220],angle:[da+PI-.6,da+PI+.6],life:[.15,.3],size:[1.4,2.4],c:EMBER,drag:3,grav:300});
     fx.emit({x:bx,y:feet,n:crit?6:5,kind:'dust',speed:[30,90],angle:[PI,TAU],flat:.4,life:[.45,.8],size:[6,11],layer:'air'});
     if(crit)fx.emit({x:bx,y:feet-2,n:5,kind:'chip',speed:[90,190],angle:[PI*1.12,PI*1.88],life:[.4,.65],size:[1.6,2.8],grav:560,drag:1,spin:[-14,14],layer:'air',draw:chip});
     if(crit&&!o.peer)fx.shake(.17);
    },
    draw(g,e,p,H){
     const q=E.out(p),k=E.out(e.t/.05),w=r*(crit?.7:.56)*(1-p*.5),ca=Math.min(1,(1-p)*1.8);
     H.glow(g,bx,by,r*2.6*(1-p*.3),EMBER,p<.06?1:Math.pow(1-p,2.2));
     H.flare(g,bx,by,(crit?92:62)*(.55+.45*q),GOLD,Math.pow(1-p,1.6),da);
     if(p<.6){const s=p/.6;H.ring(g,bx,by,r*.6+r*2*E.out(s),2.2*(1-s)+.4,GOLD,1-s,.9);}   /* the blow's shock through the air */
     cut(g,bx-ux,by-uy,bx-ux+2*ux*k,by-uy+2*uy*k,w,ca);
     if(crit){const db=da+(f>0?-1.25:1.25),ex=Math.cos(db)*L*.9,ey=Math.sin(db)*L*.9;cut(g,bx-ex,by-ey,bx+ex,by+ey,w*.85,ca*E.clamp01((e.t-.04)/.04));}
    }},{x:bx,y:by,delay:HIT_AT});
   const cr=crit?cracks(bx,feet,6,r*3.8,H.rng((bx*7+by*13)|0)):null;
   fx.spawn({life:crit?1.3:.5,layer:'ground',reach:120,draw(g,e,p,H){
    const t=e.t,s=E.clamp01(t/.5);
    if(cr)drawCracks(g,cr,1-E.in(p),Math.pow(1-p,1.6));
    if(s<1){H.haze(g,bx,feet,r*2.2,RAGE,(1-s)*.5,.42);H.ring(g,bx,feet,r*.6+r*1.9*E.out(s),3.2*(1-s)+.8,EMBER,(1-s)*.95,.42);}
   }},{x:bx,y:feet,delay:HIT_AT});
  },
 });

 /* ---------- Whirlwind: blades whirling round him on two levels, cutting each foe as one passes it ---------- */
 const SPIN={turns:1.3,T:.5,pow:1.7};
 /* how far the blades have turned t seconds in: fast at first, settling by half a second */
 const turned=t=>TAU*SPIN.turns*(1-Math.pow(1-E.clamp01(t/SPIN.T),SPIN.pow));
 const spins=[];   /* the whirlwinds going round now, so a foe it lands on waits for a blade to reach it */
 function spinFor(x,y){
  for(let i=spins.length-1;i>=0;i--){const s=spins[i];if(s.e.t>s.e.life){spins.splice(i,1);continue;}if(Math.abs(s.x-x)<6&&Math.abs(s.y-y)<6&&s.e.t<.2)return s;}
  return null;
 }
 /* keep what is drawn next out of the strip behind his body above the plane at cy - a blade passing there goes behind him */
 function behind(g,cx,cy,R){g.beginPath();g.rect(cx-R*2,cy-R*2,R*4,R*4);g.rect(cx-15,cy-62,30,62);g.clip('evenodd');}
 FX.recipe('whirlwind',{
  cast(o,fx){
   const f=o.fx<0?-1:1,R=o.rad||100,gy=o.gy,flat=.56,rb=Math.min(R*.55,60)*(o.k||1),r2=rb*.68,a0=f>0?-.75:PI+.75;   /* o.k: 🌳 Bladestorm spins taller */
   const W=fx.spawn({life:.62,layer:'glow',reach:R+60,light:{colour:'255,186,130',reach:R*2.2,head:R*1.2,h:18,peak:.8,env:p=>E.fade(p,.05,.6)},
    update(e,dt,fx){   /* the blades fling sparks and dust off their path as they go */
     e.acc=(e.acc||0)+dt;
     if(e.t<.36&&e.acc>.045){e.acc=0;
      const th=a0+f*(turned(e.t)+Math.floor(e.rnd()*3)*TAU/3),ta=th+f*PI/2,cy=e.y+gy-12;
      fx.emit({x:e.x+Math.cos(th)*rb,y:cy+Math.sin(th)*rb*flat,n:1,kind:'spark',speed:[160,300],angle:[ta-.25,ta+.25],flat,life:[.18,.32],size:[1.4,2.4],c:STEEL,drag:3,grav:200});
      fx.emit({x:e.x+Math.cos(th)*rb*1.1,y:e.y+gy+Math.sin(th)*rb*1.1*flat,n:1,kind:'dust',speed:[60,120],angle:[ta-.3,ta+.3],flat,life:[.4,.7],size:[6,10],layer:'air'});
     }
    },
    draw(g,e,p,H){
     const t=e.t,cx=e.x,cy=e.y+gy-12,c2=e.y+gy-30,al=E.fade(p,.04,.62),hd=turned(t),tl=turned(t-.11);
     g.save();behind(g,cx,cy,R);
     H.ring(g,cx,cy,rb,1.2,STEEL,al*.25,flat);   /* the path the blades cut through the air */
     for(let k=0;k<3;k++){const off=k*TAU/3,head=a0+f*(hd+off);trail(g,cx,cy,rb,a0+f*(tl+off),head,rb*.42,al,flat,WHIRL);
      const ca=Math.cos(head),sa=Math.sin(head)*flat;H.streak(g,cx+ca*rb*.42,cy+sa*rb*.42,cx+ca*rb*1.04,cy+sa*rb*1.04,3.4,STEEL,al*.95);}   /* the blade itself, a ghost of steel at the head of its trail */
     for(let k=0;k<3;k++){const rr=rb*(.55+k*.32),s=a0+f*(hd*1.25+k*2.1);H.crescent(g,cx,cy,rr,s-f*1.1,s,1.6,STEEL,al*.45,{flat});}   /* wind streaks, turning faster than the blades */
     g.restore();
     g.save();behind(g,cx,c2,R);   /* a second pair higher up, a little faster: the whirl has height */
     for(let k=0;k<2;k++){const off=k*PI+.8;trail(g,cx,c2,r2,a0+f*(tl*1.12+off),a0+f*(hd*1.12+off),r2*.4,al*.75,flat,WHIRL);}
     g.restore();
    }},{x:o.x,y:o.y,follow:o.follow});
   spins.push({e:W,x:o.x,y:o.y,f,a0,flat,n:3});if(spins.length>8)spins.shift();
   /* the ground: a ring of rage racing out to the reach, a steel one after it, and a ring of dust kicked up */
   fx.spawn({life:.6,layer:'ground',reach:R+30,draw(g,e,p,H){
    const q=E.out(p);
    H.haze(g,e.x,e.y+gy,R*.7,EMBER,(1-p)*.3,flat);
    H.ring(g,e.x,e.y+gy,20+(R-20)*q,3.4*(1-p)+.8,RAGE,(1-p)*.95,flat);
    H.ring(g,e.x,e.y+gy,14+(R*.8-14)*E.out(Math.max(0,p-.1)/.9),1.6,STEEL,(1-p)*.6,flat);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y+gy,n:12,kind:'dust',speed:[80,170],flat,life:[.5,.85],size:[7,12],layer:'air'});
  },
  hit(o,fx){
   const r=o.r||18,bx=o.x,by=o.y-r*.6,crit=!!o.crit;
   fx.spawn({life:.95,layer:'glow',reach:120,
    update(e,dt,fx){
     if(e.at==null){   /* wait for a blade: when does one pass the angle this foe stands at? */
      const s=spinFor(o.sx??bx,o.sy??o.y);
      if(s){
       const ang=Math.atan2((o.y-s.y)/s.flat,o.x-s.x),step=TAU/s.n;
       const d=(((ang-s.a0)*s.f)%step+step)%step,need=1-Math.pow(1-d/(TAU*SPIN.turns),1/SPIN.pow);
       e.at=e.t+Math.max(0,need*SPIN.T-s.e.t);e.f=s.f;e.ang=ang;e.flat=s.flat;
      }else if(e.t>.05){e.at=e.t;e.f=1;e.ang=Math.atan2(o.y-(o.sy??o.y),o.x-(o.sx??bx-1));e.flat=.56;}
      if(e.at==null)return;
     }
     if(!e.k&&e.t>=e.at){e.k=1;   /* the blade bites: sparks fly on the way it was going */
      const ta=Math.atan2(Math.cos(e.ang)*e.flat*e.f,-Math.sin(e.ang)*e.f);e.ta=ta;
      fx.emit({x:bx,y:by,n:crit?10:6,kind:'spark',speed:[140,320],angle:[ta-.6,ta+.6],life:[.18,.4],size:[1.5,2.8],c:crit?GOLD:STEEL,drag:3.2,grav:320});
      if(crit&&!o.peer)fx.shake(.12);
     }
    },
    draw(g,e,p,H){
     if(e.at==null||e.t<e.at||e.ta==null)return;
     const q=(e.t-e.at)/.42;if(q>=1)return;
     const L=r*(crit?1.5:1.2),ux=Math.cos(e.ta)*L,uy=Math.sin(e.ta)*L,k=E.out(q/.12);
     H.glow(g,bx,by,r*1.6*(1-q*.4),crit?EMBER:STEEL,(1-q)*(1-q)*.9);
     if(crit)H.flare(g,bx,by,58*(.6+.4*E.out(q)),GOLD,Math.pow(1-q,1.5),e.ta);
     cut(g,bx-ux,by-uy,bx-ux+2*ux*k,by-uy+2*uy*k,r*(crit?.42:.32)*(1-q*.6),Math.min(1,(1-q)*1.6));
    }},{x:bx,y:by});
  },
 });

 /* ---------- Battle Shout: a roar that bursts out of him, and the rage it leaves burning round him ---------- */
 FX.recipe('battleshout',{
  cast(o,fx){
   const f=o.fx<0?-1:1,gy=o.gy;
   /* the roar: sound waves bursting from his mouth, a ring of shock through the air round him, rays of rage shooting out */
   fx.spawn({life:.55,layer:'glow',reach:200,light:{colour:'255,96,52',reach:300,head:170,h:36,peak:1.1,env:p=>p<.06?p/.06:Math.pow(1-(p-.06)/.94,1.6)},draw(g,e,p,H){
    const mx=e.x+f*7,my=e.y+gy-44,cx=e.x,cy=e.y+gy-28,c=f>0?0:PI;
    for(let k=0;k<3;k++){const q=E.clamp01((e.t-k*.06)/.38);if(q<=0||q>=1)continue;
     const rr=18+78*E.out(q),span=.5+.4*q;H.crescent(g,mx,my,rr,c-span,c+span,6.5*(1-q)+1.5,[RAGE,EMBER,GOLD][k],(1-q)*(k?.85:1));}
    const q=E.out(Math.min(1,e.t/.4));
    if(e.t<.4)H.ring(g,cx,cy,34+96*q,3*(1-q)+.6,RAGE,(1-q)*.85,.86);
    const rnd=H.rng(e.seed);
    for(let i=0;i<14;i++){const a=i/14*TAU+rnd()*.25;if(Math.sin(a)<-.8)continue;   /* none straight up through his face */
     const r0=28+70*E.out(Math.min(1,e.t/.3)),L=(12+26*rnd())*(1-p),ca=Math.cos(a),sa=Math.sin(a)*.8;
     H.streak(g,cx+ca*r0,cy+sa*r0,cx+ca*(r0+L),cy+sa*(r0+L),2.6,i%2?EMBER:RAGE,(1-p)*.95);}
   }},{x:o.x,y:o.y,follow:o.follow});
   /* the ground: a war-crest stamped round his feet, rage flaring up behind him, two shock rings racing out */
   fx.spawn({life:1.4,layer:'ground',reach:180,draw(g,e,p,H){
    const x=e.x,y=e.y+gy,t=e.t,st=E.clamp01(t/.22),s=1+.4*(1-E.back(st));
    H.haze(g,x,y,52,RAGE,E.fade(p,.02,.3)*.45,.45);
    crest(g,x,y,30*s,RAGE,E.fade(p,.02,.45),t*.4,.45);
    if(t<.6){const fq=t/.6,rnd=H.rng(e.seed);   /* flames rise round him from the ground, his body before them */
     for(let i=0;i<9;i++){const u=(i-4)/4,h=(40+30*(1-Math.abs(u)))*E.out(Math.min(1,t/.12))*(1-E.in(fq))*(.8+.4*rnd());
      flame(g,x+u*24,y-1,14,h,Math.sin(t*14+i*1.9)*6*(1+fq),1-fq*.6);}}
    for(let k=0;k<2;k++){const q=E.clamp01((t-k*.1)/.6);if(q<=0||q>=1)continue;H.ring(g,x,y,18+150*E.out(q),3.6*(1-q)+.6,k?EMBER:RAGE,(1-q)*.9,.45);}
   }},{x:o.x,y:o.y,follow:o.follow});
   fx.emit({x:o.x,y:o.y+gy-6,n:14,kind:'ember',speed:[60,170],angle:[PI*1.05,PI*1.95],life:[.6,1],size:[1.6,3],c:EMBER,drag:1.8,grav:-30});
   fx.emit({x:o.x,y:o.y+gy,n:12,kind:'dust',speed:[110,200],flat:.45,life:[.5,.8],size:[7,12],layer:'air'});
  },
  aura:{key:'atk',
   /* behind him: a red heat his outline burns against, rage flaming up round his legs and sides, the far half of a crest */
   back(g,a,now,H){
    const f=auraFade(a);if(!(f>0))return;
    const y=a.gy,beat=drum(now);
    H.haze(g,0,y-27,36,RAGE,f*(.2+.14*beat));
    for(const [x,h,i] of FLAMES)flame(g,x,y-1,11,h*(.82+.18*Math.sin(now*9+i*1.7))*(.9+.2*beat),Math.sin(now*6+i*2.3)*4,f*.75,true);
    crestHalf(g,0,y,21,f*(.6+.4*beat),-1,now);
   },
   /* in front of him: the near half of the crest, so it rings his feet */
   front(g,a,now,H){const f=auraFade(a);if(f>0)crestHalf(g,0,a.gy,21,f*(.6+.4*drum(now)),1,now);},
   /* lit at night (light added to what is there, so faint by day): the crest's line and glow, the hearts of the flames at
      his sides, and a ripple going out from his feet on every beat of the drum - his body and boots kept clear */
   glow(g,a,now,H){
    const f=auraFade(a);if(!(f>0))return;
    const y=a.gy,beat=drum(now);
    H.haze(g,0,y,34,RAGE,f*(.3+.2*beat),.42);
    g.save();g.beginPath();g.rect(-120,-160,240,320);g.rect(-14,y-70,28,70);g.clip('evenodd');
    H.ring(g,0,y,21,1.4,EMBER,f*(.45+.35*beat),.42);
    const q=(now*1.15)%1;if(q<.7)H.ring(g,0,y,21+22*E.out(q/.7),1.6*(1-q/.7)+.4,RAGE,f*(1-q/.7)*.7,.42);
    for(const [x,h,i] of FLAMES)if(Math.abs(x)>15)flame(g,x,y-1,11,h*(.82+.18*Math.sin(now*9+i*1.7))*(.9+.2*beat),Math.sin(now*6+i*2.3)*4,f*.45,'lit');
    g.restore();
   },
   /* embers rise round him and stay behind as he walks; at night the rage throws a flickering red light round him */
   tick(a,dt,fx){
    const f=auraFade(a);
    if(Math.random()<dt*12*f)fx.emit({x:a.x+(Math.random()-.5)*36,y:a.y+a.gy-4-Math.random()*22,n:1,kind:'ember',speed:[5,20],angle:[-2.2,-.9],up:34,life:[.6,1.1],size:[1.3,2.4],c:EMBER,drag:1,grav:-30});
    if(Math.random()<dt*5*f)fx.spawn(AURA_LIGHT,{x:a.x,y:a.y,gy:a.gy});
   },
  },
 });
 /* the aura's flames: x, height, and a phase - two tall ones each side where his outline shows them, short ones behind him */
 const FLAMES=[[-23,30,0],[-16,40,1],[-7,44,2],[0,46,3],[7,44,4],[16,40,5],[23,30,6]];
 const AURA_LIGHT={life:.5,layer:'glow',draw(){},light:{colour:'255,84,44',reach:170,head:100,h:30,peak:.8,env:p=>Math.sin(PI*p)}};
 /* the buff's strength: in over a third of a second, out over its last half second */
 function auraFade(a){const dur=a.dur||10,left=a.left||0;return E.clamp01(.2+(dur-left)/.35)*E.clamp01(left/.5);}
 /* a war drum: a hard beat a little faster than once a second, dying away */
 function drum(now){const p=(now*1.15)%1;return Math.exp(-p*5);}
 /* half of the crest at his feet - side -1 the far half (behind him), 1 the near half: a glowing ring, blade-marks
    pointing out of it turning slowly */
 function crestHalf(g,x,y,r,a,side,now){
  if(!(a>0))return;
  const flat=.42,a0=side<0?PI:0,a1=side<0?TAU:PI;
  g.save();g.globalCompositeOperation='lighter';g.translate(x,y);g.scale(1,flat);
  g.strokeStyle=rgba(RAGE,1);g.beginPath();g.arc(0,0,r,a0,a1);
  g.globalAlpha=Math.min(1,a*.3);g.lineWidth=7;g.stroke();
  g.globalAlpha=Math.min(1,a);g.lineWidth=2.2;g.stroke();
  g.strokeStyle='rgba(255,220,180,1)';g.globalAlpha=Math.min(1,a*.8);g.lineWidth=.9;g.stroke();
  g.fillStyle=rgba(EMBER,1);g.globalAlpha=Math.min(1,a*.9);g.beginPath();
  for(let i=0;i<12;i++){const t=now*.5+i/12*TAU;if((Math.sin(t)<0)!==(side<0))continue;const b=.09;
   g.moveTo(Math.cos(t-b)*r*1.05,Math.sin(t-b)*r*1.05);g.lineTo(Math.cos(t)*r*1.3,Math.sin(t)*r*1.3);g.lineTo(Math.cos(t+b)*r*1.05,Math.sin(t+b)*r*1.05);g.closePath();}
  g.fill();
  g.restore();
 }
})();
