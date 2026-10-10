/* 🔥 Mage: Fireball, Frost Nova, Arcane Barrage - fire, ice and violet glass. (SpellFx recipes)
   Each spell has three beats: what goes off round the mage, the spell itself on its way, and where it lands. */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const TAU=Math.PI*2,PI=Math.PI,E=FX.E;
 /* fire runs from a white-hot heart through gold and orange to ember red; ice from white through frost to deep blue;
    arcane from pale lilac through violet and pink to indigo */
 const WHITE='255,248,230',GOLD='255,212,116',FIRE='255,134,36',EMBER='222,70,18',SOOT='46,36,32',
  FROST='216,245,255',ICE='126,202,255',LILAC='242,212,255',ARC='174,104,255',PINK='255,118,220',INDIGO='100,62,210',
  MIST='204,232,250';
 const C=c=>'rgba('+c+',1)';
 /* the layers of anything that burns: [width, alpha, colour, length] - a wide dim fringe, the body, a white heart */
 const FIRE3=[[1.8,.24,C(EMBER),1.05],[1,.8,C(FIRE),1],[.42,.92,C('255,238,186'),.55]];
 const ARC3=[[2.1,.26,C(INDIGO),1],[1,.75,C(ARC),.9],[.42,.95,C(LILAC),.5]];
 const hash=(i,s)=>{const v=Math.sin(i*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
 /* the way he faces: game.js hands over the x of his look at the target (south is near 0), the sprite turns by its sign */
 const side=o=>(o.fx||1)<0?-1:1;
 const handOf=o=>({x:o.x+side(o)*13,y:o.y-12});   /* about where the casting hand is */
 const aimOf=(o,h)=>Math.atan2((o.ty??o.y)-10-h.y,(o.tx??o.x+side(o)*100)-h.x);

 /* ---------- drawing helpers of our own ---------- */
 /* a tongue of flame from its root (x,y) out along ang: L long, w wide, the tip bent sideways by bend */
 function tongue(g,x,y,ang,L,w,layers,a,bend){
  if(!(a>0&&L>.5&&w>0))return;
  const ca=Math.cos(ang),sa=Math.sin(ang),nx=-sa,ny=ca,b=bend||0;
  g.save();g.globalCompositeOperation='lighter';
  for(const [k,al,c,lk] of layers){
   const hw=w*k*.5,m=lk||1,l=L*m,tx=x+ca*l+nx*b*m,ty=y+sa*l+ny*b*m,bx=x+ca*l*.36,by=y+sa*l*.36;
   g.globalAlpha=Math.min(1,a*al);g.fillStyle=c;g.beginPath();
   g.moveTo(x+nx*hw*.5,y+ny*hw*.5);g.quadraticCurveTo(bx+nx*hw,by+ny*hw,tx,ty);
   g.quadraticCurveTo(bx-nx*hw,by-ny*hw,x-nx*hw*.5,y-ny*hw*.5);g.closePath();g.fill();
  }
  g.restore();
 }
 /* a trail through pts (its head first), w wide at the head and tapering to nothing at the tail; a layer's length
    share keeps the white heart up near the head, so a trail reads as fire and not as a beam */
 function ribbon(g,pts,w,layers,a,most,body){
  const N=Math.min(pts.length,most||99);if(N<2||!(a>0&&w>0))return;
  g.save();g.globalCompositeOperation=body?'source-over':'lighter';   /* body: laid on as paint, so the colour holds over bright ground by day */
  for(const [k,al,c,lk] of layers){
   const n=Math.max(2,Math.min(N,Math.round(N*(lk||1))));
   g.globalAlpha=Math.min(1,a*al);g.fillStyle=c;g.beginPath();
   for(let s=0;s<2;s++)for(let j=0;j<n;j++){   /* down one side, back up the other */
    const i=s?n-1-j:j,p=pts[i],q=pts[i>0?i-1:0],r=pts[i<n-1?i+1:n-1];
    let dx=q[0]-r[0],dy=q[1]-r[1];const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
    const hw=w*k*.5*Math.pow(1-i/(n-1),.85)*(s?-1:1),px=p[0]-dy*hw,py=p[1]+dx*hw;
    if(!s&&!j)g.moveTo(px,py);else g.lineTo(px,py);
   }
   g.closePath();g.fill();
  }
  g.restore();
 }
 /* the four-pointed star squashed flat along rot: a lens streak that leaves what is above it (the number) clear */
 function streakFlare(g,H,x,y,r,c,a,flat,rot){
  if(!(a>0&&r>0))return;
  g.save();g.translate(x,y);if(rot)g.rotate(rot);g.scale(1,flat);H.flare(g,0,0,r,c,a);g.restore();
 }
 /* an ice crystal standing on the ground at (x,y): h tall, w wide at its foot, leaning by lean - a pale body, a
    shaded flank, a dark outline that holds by day and a white edge where the light catches it */
 function crystal(g,x,y,h,w,lean,a){
  if(!(a>0&&h>.8&&w>0))return;
  const cl=Math.cos(lean),sx=Math.sin(lean)*h,tx=x+sx,ty=y-cl*h,hw=w*.5,mx=x+sx*.55,my=y-h*.55*cl;
  g.save();g.lineJoin='round';
  g.globalAlpha=Math.min(1,a*.85);g.fillStyle='rgba(200,236,255,1)';
  g.beginPath();g.moveTo(x-hw,y);g.lineTo(mx-hw*.8,my);g.lineTo(tx,ty);g.lineTo(mx+hw*.8,my);g.lineTo(x+hw,y);g.closePath();g.fill();
  g.globalAlpha=Math.min(1,a*.62);g.fillStyle='rgba(56,116,204,1)';
  g.beginPath();g.moveTo(x+hw*.12,y);g.lineTo(mx+hw*.08,my);g.lineTo(tx,ty);g.lineTo(mx+hw*.8,my);g.lineTo(x+hw,y);g.closePath();g.fill();
  if(h>7){g.globalAlpha=Math.min(1,a*.85);g.strokeStyle='rgba(28,66,146,1)';g.lineWidth=.75;
   g.beginPath();g.moveTo(x-hw,y);g.lineTo(mx-hw*.8,my);g.lineTo(tx,ty);g.lineTo(mx+hw*.8,my);g.lineTo(x+hw,y);g.stroke();}
  g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.strokeStyle='rgba(255,255,255,1)';g.lineWidth=.9;
  g.beginPath();g.moveTo(mx-hw*.8,my);g.lineTo(tx,ty);g.lineTo(mx+hw*.08,my);g.lineTo(x+hw*.12,y);g.stroke();
  g.restore();
 }
 /* a splinter of violet glass at (x,y), s long, turned by rot: a glow behind it, the pane, a white glint down its edge */
 function glass(g,H,x,y,s,rot,a,dim){
  if(!(a>0&&s>0))return;
  H.glow(g,x,y,s*2.3,ARC,a*.55);
  g.save();g.translate(x,y);g.rotate(rot);
  g.globalAlpha=Math.min(1,a*(dim?.5:.85));g.fillStyle='rgba(204,156,255,1)';
  g.beginPath();g.moveTo(0,-s);g.lineTo(s*.42,0);g.lineTo(0,s*.8);g.lineTo(-s*.42,0);g.closePath();g.fill();
  g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.strokeStyle='rgba(255,240,255,1)';g.lineWidth=.8;
  g.beginPath();g.moveTo(-s*.42,0);g.lineTo(0,-s);g.lineTo(s*.42,0);g.stroke();
  g.restore();
 }
 /* a star that blinks as it drifts: arcane sparkles */
 const twinkle=c=>(g,p,k,a,H)=>{H.flare(g,p.x,p.y,p.s*3.4*(.65+.35*Math.sin(p.t*28+p.seed)),c,a,p.rot);H.glow(g,p.x,p.y,p.s*1.5,c,a*.8);};
 const TW_LILAC=twinkle(LILAC),TW_PINK=twinkle(PINK);
 /* a pane of violet glass flung off a burst, spinning */
 const PANE=(g,p,k,a,H)=>glass(g,H,p.x,p.y,p.s*(1-.4*k),p.rot,a,false);

 /* what flies is drawn by an effect riding along with the bolt in the glow pass, so it burns as bright by night and
    lights the ground under it. The bolt ticks it every update; once the bolt stops ticking it has landed or gone,
    and the rider goes with it. */
 function ride(b,fx,def){
  b._n=(b._n||0)+1;
  const e=b._fe;
  if(e&&e.o.miss<2&&b._n-e.o.seen<=2){e.o.miss=0;return;}
  b._fe=fx.spawn(def,{x:b._dx??b.x,y:b._dy??b.y,gy:26,b,miss:0,seen:b._n,follow:()=>({x:b._dx??b.x,y:b._dy??b.y})});
 }
 const riding=b=>!!(b._fe&&b._fe.o.miss<2&&b._n-b._fe.o.seen<=2);
 const rider=(draw,light)=>({life:3,layer:'glow',reach:90,light,draw,
  update(e){e.o.miss++;e.o.seen=e.o.b._n;if(e.o.miss>=2)e.life=Math.min(e.life,e.t);}});
 /* the bolt's own heading, from how it moved (or where it is going, on its first tick) */
 function heading(b){
  if(b._px!=null){const dx=b.x-b._px,dy=b.y-b._py;if(dx*dx+dy*dy>.01)b._ra=Math.atan2(dy,dx);}
  else b._ra=Math.atan2(b.tgt.y-10-b.y,b.tgt.x-b.x);
  b._px=b.x;b._py=b.y;
 }
 /* a trail point every 6 units flown, the head always where the bolt is: as long at 240 frames a second as at 60 */
 function trail(tr,x,y,most,D=7){   /* tr[0] rides with the bolt; behind it points are laid exactly D apart along its way */
  if(!tr.length){tr.push([x,y],[x,y]);return;}
  let lx=tr[1][0],ly=tr[1][1],d=Math.hypot(x-lx,y-ly);
  while(d>=D){const k=D/d;lx+=(x-lx)*k;ly+=(y-ly)*k;tr.splice(1,0,[lx,ly]);d=Math.hypot(x-lx,y-ly);}
  tr[0][0]=x;tr[0][1]=y;if(tr.length>most)tr.length=most;
 }
 /* where the bolt is drawn: out of the hand at first, easing onto its true line */
 function launch(b){
  const k=1-Math.min(1,(b._age||0)/.1);
  return k>0?{x:b.x+Math.cos(b._ra||0)*13*k,y:b.y-2*k}:{x:b.x,y:b.y};
 }

 /* ---------- Fireball: flames burst up round him, a comet of fire leaves his hand, and it bursts where it lands ---------- */
 /* flames leaping up round his feet: the far half (behind him) or the near half (in front of him) */
 function footFlames(g,x,y,p,seed,near){
  for(let i=0;i<10;i++){
   const t=(i+.5)/10*TAU+seed,s=Math.sin(t);if((s>0)!==near)continue;
   const h=hash(i,seed),q=E.clamp01(p*1.55-h*.14),grow=q<.18?E.out(q/.18):1-E.in((q-.18)/.82);
   tongue(g,x+Math.cos(t)*(near?22:19),y+s*8,-PI/2+Math.cos(t)*.6,(11+10*h)*grow*(near?.7:1),6,FIRE3,grow*(near?.9:.85),Math.sin(p*14+i)*2.5);
  }
 }
 /* the paint under the light: deep red and orange laid on as colour, so the fire stays fire over sunlit grass (2026-10-09,
    "lite mer episka": a bigger comet, a long burning wake, smoke and sparks thrown off it) */
 const FIRE_BODY=[[1.5,.38,C('150,34,10'),1],[1,.62,C(EMBER),.85],[.55,.7,C(FIRE),.6]];
 function drawFireball(g,H,b,t){
  const s=1.3*Math.min(1,.35+(b._age||0)/.07)*(b.big||1),a=b._ra||0,tr=b._tr||[],x=b._dx??b.x,y=b._dy??b.y;   /* big: 🌳 Searing Fire, Pyroblast */
  ribbon(g,tr,22*s,FIRE_BODY,.85,14,true);   /* the burning wake, as paint */
  ribbon(g,tr,17*s,FIRE3,.8,14);             /* and as light */
  H.haze(g,x,y,22*s,'170,40,12',.55,1,false); /* the fire's own red under its light */
  H.haze(g,x,y,40*s,FIRE,.55);               /* the heat round it */
  for(let i=0;i<8;i++){                      /* tongues of flame streaming back off it, each flickering on its own */
   const fl=.62+.38*Math.abs(Math.sin(t*19+i*2.3)),m=1-Math.abs(i-3.5)/3.5;
   tongue(g,x,y,a+PI+(i-3.5)*.26+Math.sin(t*13+i)*.16,(20+20*m)*fl*s,10*s,FIRE3,.92,Math.sin(t*23+i*1.7)*5);
  }
  for(const sd of [-1,1])tongue(g,x+Math.cos(a)*3,y+Math.sin(a)*3,a+sd*(2.1+.15*Math.sin(t*29)),13*s,8*s,FIRE3,.85,-sd*3);   /* licking round its front */
  H.glow(g,x,y,20*s,FIRE,.95);H.glow(g,x,y,11*s,GOLD,1);H.glow(g,x,y,6*s,WHITE,1);
  H.flare(g,x,y,26*s,GOLD,.5+.2*Math.sin(t*21),a);   /* a glint that flickers across its heart */
 }
 const FB_FLY=rider((g,e,p,H)=>drawFireball(g,H,e.o.b,e.t+e.seed%7),{colour:'255,150,60',reach:240,head:130,h:26,peak:1,env:()=>1});
 FX.recipe('fireball',{
  cast(o,fx){
   const f=side(o),gy=o.gy||16,hd=handOf(o),aim=aimOf(o,hd),seed=Math.random()*TAU;
   /* under him: fire runes snapping open in a pool of warm light, a hot ring running out, the far flames */
   fx.spawn({life:.62,layer:'ground',reach:70,draw(g,e,p,H){
    const x=e.x,y=e.y+gy,open=E.back(Math.min(1,p/.26)),fade=Math.pow(1-p,1.4),run=E.clamp01(p/.5);
    H.haze(g,x,y,52*open,FIRE,.6*fade,.42);
    H.runes(g,x,y,34*open,FIRE,fade,{rot:p*2.4*f,star:5,w:1.6,inner:.66,ticks:15});
    H.ring(g,x,y,30+18*E.out(run),1.4,GOLD,.75*(1-run),.42);
    footFlames(g,x,y,p,seed,false);
   }},{x:o.x,y:o.y,follow:o.follow});
   /* over him: the near flames, and the flash where the fire leaves his hand with flame licking after it */
   fx.spawn({life:.5,layer:'glow',reach:70,light:{colour:'255,150,60',reach:230,head:140,h:30,peak:.9,env:p=>p<.06?p/.06:Math.pow(1-p,1.6)},draw(g,e,p,H){
    footFlames(g,e.x,e.y+gy,p,seed,true);
    const hx=e.x+f*13,hy=e.y-12,fl=p<.05?p/.05:Math.pow(Math.max(0,1-(p-.05)/.4),2);
    H.glow(g,hx,hy,16+12*fl,FIRE,fl);H.glow(g,hx,hy,8,WHITE,fl);
    streakFlare(g,H,hx,hy,46,GOLD,fl*fl*.9,.32,aim);
    for(let i=-1;i<=1;i++)tongue(g,hx,hy,aim+i*.42,22*fl*(1-.3*Math.abs(i)),7,FIRE3,fl,i*3);
   }},{x:o.x,y:o.y,follow:o.follow});
   fx.emit({x:hd.x,y:hd.y,n:5,kind:'ember',speed:[70,170],angle:[aim-.55,aim+.55],life:[.25,.5],size:[1.4,2.6],c:GOLD,drag:4.5,grav:-30});
   fx.emit({x:o.x,y:o.y+gy-3,n:4,kind:'ember',speed:[25,60],flat:.4,life:[.45,.75],size:[1.3,2.3],c:FIRE,drag:2,up:35,grav:-25,spread:14});
  },
  boltTick(b,dt,fx){
   b._age=(b._age||0)+dt;heading(b);
   const L=launch(b),tr=b._tr||(b._tr=[]);b._dx=L.x;b._dy=L.y;
   trail(tr,L.x,L.y,16);
   ride(b,fx,FB_FLY);
   if(Math.random()<dt*70)fx.emit({x:L.x,y:L.y,n:1,kind:'ember',speed:[15,65],life:[.3,.6],size:[1.8,3.4],c:Math.random()<.5?GOLD:FIRE,drag:2,grav:-45,spread:6});
   if(Math.random()<dt*14)fx.emit({x:L.x,y:L.y,n:1,kind:'spark',speed:[90,170],angle:[b._ra+PI-1.1,b._ra+PI+1.1],life:[.14,.26],size:[1.3,2],c:GOLD,drag:4});
   if(Math.random()<dt*18)fx.emit({x:L.x-Math.cos(b._ra)*14,y:L.y-Math.sin(b._ra)*14,n:1,kind:'smoke',c:SOOT,speed:[5,18],life:[.55,.9],size:[5,8],up:16,grow:1.8,layer:'air',alpha:.75});
  },
  bolt(g,b,now,H){if(!riding(b))drawFireball(g,H,b,now);return true;},
  hit(o,fx){
   const r=o.r||16,k=(o.crit?1.3:1)*1.25*(o.k||1),x=o.x,cy=o.y-r*.6,gy=o.y+r*.55,seed=Math.random()*TAU;   /* o.k: 🌳 as big as the talents make it */
   /* the body of the blast laid on as paint - red and orange billows rolling out and up - so it reads as fire by day */
   fx.spawn({life:.75,layer:'air',reach:130,draw(g,e,p,H){
    const bl=E.out(Math.min(1,p/.45)),fade=Math.pow(1-p,1.6);
    for(let i=0;i<7;i++){const t=i/7*TAU+seed*.7,d=(8+r*.5)*k*bl;H.haze(g,x+Math.cos(t)*d,cy+Math.sin(t)*d*.65-p*14,(10+11*bl)*k,i%2?'190,52,14':'236,118,30',.7*fade,1,false);}
    H.haze(g,x,cy-p*8,(14+8*bl)*k,'120,30,10',.5*fade,1,false);
   }},{x,y:o.y});
   /* the blast: a white-hot flash, billows of fire thrown out and up, tongues of flame all round */
   fx.spawn({life:.6,layer:'glow',reach:140,light:{colour:'255,150,60',reach:340*k,head:190,h:30,peak:1.25,env:p=>p<.06?p/.06:Math.pow(1-p,1.5)},draw(g,e,p,H){
    const fl=Math.max(0,1-p/.22),bl=E.out(Math.min(1,p/.4)),fade=Math.pow(1-p,1.3),lick=E.out(Math.min(1,p/.18))*(1-E.in(p/.6));
    for(let i=0;i<6;i++){const t=i/6*TAU+seed,d=(10+r*.45)*k*bl;H.haze(g,x+Math.cos(t)*d,cy+Math.sin(t)*d*.6-p*10,(11+9*bl)*k,i%2?FIRE:GOLD,.75*fade);}
    for(let i=0;i<9;i++){const t=i/9*TAU+seed*.5;   /* flatter up and down, so the number above stays clear */
     tongue(g,x+Math.cos(t)*4,cy+Math.sin(t)*3,Math.atan2(Math.sin(t)*.65,Math.cos(t)),(16+r*.55)*k*lick*(.8+.4*hash(i,seed)),8*k,FIRE3,.95*Math.max(0,1-p/.6),0);}
    H.glow(g,x,cy,(24+r*.6)*k*(.8+.2*fl),FIRE,fl);H.glow(g,x,cy,13*k,WHITE,fl);
    streakFlare(g,H,x,cy,(64+r)*k,GOLD,fl*.9,.3,0);
   }},{x,y:o.y});
   /* on the ground: the shockwave, the fire's light thrown round, and a scorch with cinders glowing in it */
   fx.spawn({life:3,layer:'ground',reach:110,draw(g,e,p,H){
    const w=E.out(Math.min(1,p/.14)),rf=1-E.clamp01(p/.15),q=E.clamp01((p-.02)/.2);
    H.haze(g,x,gy,(26+r*.8)*k,SOOT,.62*(1-E.in(p)),.42,false);
    H.ring(g,x,gy,(r+14+60*E.out(q))*k,1.6,GOLD,(1-q)*.75,.42);   /* the second, wider shock */
    H.haze(g,x,gy,(30+r)*k,FIRE,.7*rf,.42);
    H.ring(g,x,gy,(r+8+34*w)*k,2.6*k,FIRE,rf*.95,.42);
    if(o.crit){const q=E.clamp01((p-.05)/.3);H.ring(g,x,gy,(r+4+52*E.out(q))*k,1.6,GOLD,(1-q)*.8,.42);}
    for(let i=0;i<5;i++){const t=hash(i,seed)*TAU,d=(6+12*hash(i+9,seed))*k;H.glow(g,x+Math.cos(t)*d,gy+Math.sin(t)*d*.42,2.2,FIRE,(1-E.clamp01(p/.55))*(.6+.4*Math.sin(p*40+i)));}
   }},{x,y:o.y});
   fx.emit({x,y:cy,n:o.crit?22:14,kind:'ember',speed:[80,240],life:[.4,.9],size:[1.8,3.6],c:GOLD,drag:2.6,grav:-20});
   fx.emit({x,y:cy,n:o.crit?14:9,kind:'spark',speed:[220,380],life:[.2,.34],size:[1.7,2.6],c:FIRE,drag:5});
   fx.emit({x,y:cy-4,n:o.crit?7:5,kind:'smoke',c:SOOT,speed:[14,40],life:[.8,1.2],size:[9,14],up:26,grow:1.9,layer:'air',alpha:.8});
   if(!o.peer)fx.shake(o.crit?.18:.05);
  },
 });

 /* ---------- the mage's own shot (the basic attack, 2026-10-09): a small comet of fire with a short wake, a puff where it
    lands - small, since it flies every second ---------- */
 FX.recipe('firebolt',{
  boltTick(b,dt,fx){
   b._age=(b._age||0)+dt;heading(b);
   const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,7);
   if(Math.random()<dt*22)fx.emit({x:b.x,y:b.y,n:1,kind:'ember',speed:[10,40],life:[.2,.4],size:[1.2,2.2],c:Math.random()<.5?GOLD:FIRE,drag:2,grav:-40,spread:3});
  },
  bolt(g,b,now,H){
   const tr=b._tr||[],a=b._ra||0;
   ribbon(g,tr,8,FIRE_BODY,.7,7,true);ribbon(g,tr,6,FIRE3,.85,7);
   H.haze(g,b.x,b.y,9,'170,40,12',.45,1,false);
   tongue(g,b.x,b.y,a+PI,13,5.5,FIRE3,.9,Math.sin(now*23)*2);
   H.glow(g,b.x,b.y,10,FIRE,.9);H.glow(g,b.x,b.y,4.5,WHITE,1);
   return true;
  },
  hit(o,fx){
   const r=o.r||16,x=o.x,cy=o.y-r*.6;
   fx.spawn({life:.3,layer:'glow',reach:50,draw(g,e,p,H){const fl=1-p;H.glow(g,x,cy,15*(1-.3*p),FIRE,fl);H.glow(g,x,cy,6,WHITE,fl*fl);}},{x,y:o.y});
   fx.emit({x,y:cy,n:o.crit?7:4,kind:'ember',speed:[50,140],life:[.25,.5],size:[1.4,2.4],c:GOLD,drag:3,grav:-20});
  },
 });

 /* ---------- Frost Nova: a crown of ice bursts up round him and a ring of frost races out, freezing what it catches ---------- */
 const NOVA_T=.42,NOVA_F=.5,NOVA_R=115;   /* how long the ring runs, how flat it lies, how far it goes */
 const novaR=(t,R)=>18+(R-18)*E.out(t/NOVA_T);
 /* when the ring reaches a foe standing dx,dy from the mage */
 function novaAt(dx,dy,R){
  const u=E.clamp01((Math.hypot(dx,dy/NOVA_F)-18)/((R-18)||1));
  return NOVA_T*(1-Math.cbrt(1-u));
 }
 /* the crown of ice round his feet, t seconds in: the far crystals or the near ones */
 function crown(g,x,y,t,seed,near){
  const grow=E.back(E.clamp01(t/.1)),gone=E.clamp01((t-.36)/.2);if(gone>=1)return;
  for(let i=0;i<11;i++){
   const th=(i+.5)/11*TAU+seed,s=Math.sin(th);if((s>0)!==near)continue;
   const h=hash(i,seed),sc=grow*(1-E.in(gone));
   crystal(g,x+Math.cos(th)*(near?26:21+5*h),y+s*9,(13+10*h)*sc*(near?.7:1),5.5+2.5*h,Math.cos(th)*.55,1-gone);
  }
 }
 /* frost veins spreading over the ground behind the ring: precomputed jags, scaled to the ring as it runs */
 function makeVeins(seed){
  const rnd=FX.H.rng((seed*1e6)>>>0),out=[];
  for(let i=0;i<9;i++){const th=(i+rnd()*.7)/9*TAU,len=.35+.35*rnd(),pts=[],at=[];for(let j=0;j<=5;j++){pts.push([.2+len*j/5,(rnd()-.5)*.16*(j?1:0)]);at.push([0,0]);}out.push({th,pts,at});}
  return out;
 }
 function veins(g,H,x,y,r,vs,a){
  if(!(a>0))return;
  for(const v of vs){
   const c=Math.cos(v.th),s=Math.sin(v.th);
   v.pts.forEach(([u,w],j)=>{v.at[j][0]=x+(c*u-s*w)*r;v.at[j][1]=y+(s*u+c*w)*r*NOVA_F;});
   H.line(g,v.at,.8,ICE,a);
  }
 }
 /* ice spikes riding the crest of the ring, tall at first and worn down as it runs out: the far ones or the near ones */
 function crest(g,x,y,r,t,seed,near,n){
  const run=E.clamp01(t/NOVA_T),a=1-E.in(E.clamp01((t-.2)/.28));if(!(a>0))return;
  for(let i=0;i<n;i++){
   const th=(i+hash(i,seed)*.5)/n*TAU,s=Math.sin(th);if((s>0)!==near)continue;
   const h=hash(i+22,seed);
   crystal(g,x+Math.cos(th)*r,y+s*r*NOVA_F,(8+9*h)*(1-.5*run)*E.clamp01(t/.04),4+2*h,Math.cos(th)*.75,a);
  }
 }
 /* a flat burst of frost light: where the cold strikes a foe */
 const FROST_FLASH=(g,p,k,a,H)=>{streakFlare(g,H,p.x,p.y,p.s*2.6,FROST,a,.3,0);H.glow(g,p.x,p.y,p.s*.55,ICE,a*.7);};
 FX.recipe('frostnova',{
  cast(o,fx){
   const R=o.rad||NOVA_R,gy=o.gy||16,seed=Math.random()*TAU,tg=(o.targets||[]).slice(0,8),vs=makeVeins(seed),nc=Math.max(10,Math.round(20*fx.quality));
   /* on the ground: the ice sigil, the frost racing out under its ring, the veins it leaves, frost under every foe
      it caught, and the far half of the crown */
   fx.spawn({life:1.3,layer:'ground',reach:R+40,draw(g,e,p,H){
    const t=p*1.3,x=e.x,y=e.y+gy,run=E.clamp01(t/NOVA_T),r=novaR(t,R),edge=1-E.in(E.clamp01((t-.18)/.42)),fade=1-E.in(p);
    H.haze(g,x,y,r,ICE,.42*fade*(1-.4*run),NOVA_F);
    H.runes(g,x,y,36*E.back(E.clamp01(t/.2)),FROST,1-E.in(E.clamp01(t/.75)),{rot:-t*1.6,star:6,ticks:24,w:1.6,inner:.62});
    veins(g,H,x,y,r,vs,edge*.32);
    H.ring(g,x,y,r,2.8,ICE,edge*.9,NOVA_F);
    H.ring(g,x,y,Math.max(4,novaR(t-.07,R)*.94),1.2,FROST,edge*.4,NOVA_F);
    crest(g,x,y,r,t,seed,false,nc);
    for(const f of tg){const fr=f.r||16,q=(t-novaAt(f.x-e.x,f.y-e.y,R))/.9;if(q<0||q>1)continue;H.haze(g,f.x,f.y+fr*.55,fr+14,FROST,.55*(1-E.in(q)),.42);}
    crown(g,x,y,t,seed,false);
   }},{x:o.x,y:o.y});
   /* the near half of the crown, in front of him */
   fx.spawn({life:.6,layer:'air',reach:R+40,draw(g,e,p,H){const t=p*.6;crown(g,e.x,e.y+gy,t,seed,true);crest(g,e.x,e.y+gy,novaR(t,R),t,seed,true,nc);}},{x:o.x,y:o.y});
   /* the burst of cold light at his feet, and glints riding the ring */
   fx.spawn({life:.5,layer:'glow',reach:R,light:{colour:'150,210,255',reach:320,head:170,h:30,peak:1.05,env:p=>p<.05?p/.05:Math.pow(1-p,1.4)},draw(g,e,p,H){
    const t=p*.5,x=e.x,y=e.y+gy,fl=Math.max(0,1-t/.2),r=novaR(t,R),edge=1-E.clamp01((t-.15)/.3);
    H.glow(g,x,y-6,46*(.7+.3*E.out(t/.1)),ICE,fl*.9,.55);
    streakFlare(g,H,x,y-4,70,FROST,fl*.8,.28,0);
    for(let i=0;i<6;i++){const th=hash(i,seed)*TAU;H.flare(g,x+Math.cos(th)*r,y+Math.sin(th)*r*NOVA_F,9,FROST,edge*(.6+.4*Math.sin(t*30+i)),th);}
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y+gy-4,n:10,kind:'shard',speed:[280,360],flat:NOVA_F,life:[.3,.42],size:[2.2,3.4],c:ICE,drag:1.5,spin:[-8,8],layer:'glow'});
   fx.emit({x:o.x,y:o.y+gy-2,n:4,kind:'smoke',c:MIST,speed:[50,110],flat:.5,life:[.7,1],size:[9,14],grow:1.5,drag:2.5,layer:'air',alpha:.75});
  },
  hit(o,fx){
   const r=o.r||16,k=o.crit?1.25:1,x=o.x,gy=o.y+r*.55,cy=o.y-r*.6,seed=Math.random()*TAU;
   const delay=o.sx==null?0:novaAt(o.x-o.sx,o.y-o.sy,NOVA_R);
   /* once the ring gets there: crystals jut up in front of its feet, a flat flash of frost and splinters of ice */
   fx.spawn({life:.8,layer:'air',reach:60,update(e,dt,fx){
    if(e.o.done)return;e.o.done=1;
    fx.emit({x,y:cy,n:1,speed:[0,0],life:[.26,.26],size:[(12+r*.4)*k,(12+r*.4)*k],c:FROST,draw:FROST_FLASH,layer:'glow'});
    fx.emit({x,y:cy,n:o.crit?7:4,kind:'shard',speed:[50,130],life:[.3,.55],size:[1.6,2.6],c:FROST,drag:3,grav:160,up:40,layer:'glow'});
   },draw(g,e,p,H){
    const t=p*.8,grow=E.back(E.clamp01(t/.09)),gone=E.clamp01((t-.42)/.3),sc=grow*(1-E.in(gone)),n=o.crit?5:3;
    for(let i=0;i<n;i++){const th=PI*(.18+.64*(i+.5)/n)+(hash(i,seed)-.5)*.3,h=hash(i+3,seed);
     crystal(g,x+Math.cos(th)*(r*.85+4),gy+Math.sin(th)*r*.35,(10+r*.5+8*h)*k*sc,5+2*h,Math.cos(th)*.6,1-gone);}
   }},{x,y:o.y,delay});
  },
 });

 /* ---------- Arcane Barrage: violet glass whirls round him and three missiles weave out to their marks ---------- */
 const BAR_GAP=.09;   /* the missiles leave 90 ms apart */
 let peerK=0;
 /* six panes of glass whirling round his chest, faster and faster, then flung apart - the far ones or the near ones */
 function orbit(g,H,x,y,t,seed,near){
  const burst=E.clamp01((t-.4)/.25),spin=seed+t*7+t*t*9,rad=24+40*E.out(burst),a=(1-burst)*E.clamp01(t/.06);
  if(!(a>0))return;
  for(let i=0;i<6;i++){
   const th=spin+i/6*TAU,s=Math.sin(th);if((s>0)!==near)continue;
   glass(g,H,x+Math.cos(th)*rad,y+s*rad*.36,7*(1-.45*burst),th+PI/2+t*5,a*(near?1:.7),!near);
  }
 }
 const ARC_BODY=[[1.6,.4,C(INDIGO),1],[1,.55,C('128,64,214'),.8]];
 function drawMissile(g,H,b,t){   /* bigger since 2026-10-09 ("lite mer episka"): a violet body that holds by day, a seal turning round it */
  const s=1.3*Math.min(1,.4+(b._age||0)/.06),tr=b._tr||[],x=b._dx??b.x,y=b._dy??b.y,k=b._k||0;
  ribbon(g,tr,11*s,ARC_BODY,.8,16,true);
  ribbon(g,tr,9*s,ARC3,.95,16);
  H.haze(g,x,y,14*s,'96,44,186',.5,1,false);
  H.glow(g,x,y,20*s,ARC,.95);
  H.runes(g,x,y,10*s,PINK,.85,{flat:1,rot:t*9+k,star:0,ticks:8,w:.9});
  H.flare(g,x,y,24*s,LILAC,.95,t*7+k);
  H.glow(g,x,y,7.5*s,LILAC,1);
 }
 const BAR_FLY=rider((g,e,p,H)=>drawMissile(g,H,e.o.b,e.t+e.seed%7),{colour:'190,130,255',reach:180,head:100,h:26,peak:.75,env:()=>1});
 FX.recipe('barrage',{
  cast(o,fx){
   const f=side(o),gy=o.gy||16,seed=Math.random()*TAU,n=Math.max(1,Math.min(3,(o.targets||[]).length||3));
   /* under him: a wide arcane circle with a second one turning inside it, and the far panes of the whirl */
   fx.spawn({life:.8,layer:'ground',reach:70,draw(g,e,p,H){
    const t=p*.8,x=e.x,y=e.y+gy,open=E.back(E.clamp01(t/.2)),fade=1-E.in(E.clamp01((t-.3)/.5));
    H.haze(g,x,y,54*open,ARC,.55*fade,.42);
    H.runes(g,x,y,40*open,ARC,fade,{rot:t*2.2*f,star:8,ticks:20,w:1.6,inner:.6});
    H.runes(g,x,y,23*open,PINK,fade*.85,{rot:-t*3.4*f,star:0,ticks:12,w:1.2});
    orbit(g,H,e.x,e.y-12,t,seed,false);
   }},{x:o.x,y:o.y,follow:o.follow});
   /* over him: the near panes, and a flash at his hand as each missile leaves */
   fx.spawn({life:.7,layer:'glow',reach:70,light:{colour:'190,130,255',reach:240,head:140,h:30,peak:.9,env:p=>p<.05?p/.05:Math.pow(1-p,1.3)},draw(g,e,p,H){
    const t=p*.7,hx=e.x+f*13,hy=e.y-12;
    orbit(g,H,e.x,e.y-12,t,seed,true);
    for(let k=0;k<n;k++){const q=(t-k*BAR_GAP)/.16;if(q<0||q>1)continue;
     const fl=Math.pow(1-q,1.6);H.glow(g,hx,hy,18*fl+6,PINK,fl);H.flare(g,hx,hy,30*fl+8,LILAC,fl,k*.6+q);
     H.ring(g,hx,hy,3+9*E.out(q),1.1,LILAC,fl*.7,1);}
   }},{x:o.x,y:o.y,follow:o.follow});
   fx.emit({x:o.x,y:o.y-14,n:6,kind:'mote',speed:[30,80],life:[.4,.7],size:[1.1,1.8],c:LILAC,drag:2.5,draw:TW_LILAC,spread:10});
  },
  boltTick(b,dt,fx){
   if(b._sx==null){b._sx=b.x;b._sy=b.y;b._k=b.k??(peerK=(peerK+1)%3);}
   b._age=(b._age||0)+dt;heading(b);
   /* it weaves: bowed off the straight line, most at mid-flight and none at either end - the first up, the next down */
   const gx=b.tgt.x,gy=b.tgt.y-10,dx=gx-b._sx,dy=gy-b._sy,D=Math.hypot(dx,dy)||1,ux=dx/D,uy=dy/D;
   const u=E.clamp01(1-Math.hypot(gx-b.x,gy-b.y)/D);
   let px=-uy,py=ux;if(py>0){px=-px;py=-py;}
   const off=Math.sin(PI*u)*Math.min(38,D*.22)*[1,-1,.55][b._k%3],L=launch(b),x=L.x+px*off,y=L.y+py*off,tr=b._tr||(b._tr=[]);
   b._dx=x;b._dy=y;trail(tr,x,y,16);
   ride(b,fx,BAR_FLY);
   if(Math.random()<dt*24)fx.emit({x,y,n:1,kind:'mote',speed:[5,30],life:[.3,.6],size:[1.1,1.9],c:LILAC,draw:Math.random()<.5?TW_LILAC:TW_PINK,drag:2,spread:3});
   if(Math.random()<dt*5)fx.emit({x,y,n:1,kind:'shard',speed:[30,70],life:[.3,.5],size:[3.5,5],c:ARC,drag:3,spin:[-9,9],draw:PANE,layer:'glow'});
  },
  bolt(g,b,now,H){if(!riding(b))drawMissile(g,H,b,now);return true;},
  hit(o,fx){
   const r=o.r||16,k=(o.crit?1.3:1)*1.2,x=o.x,cy=o.y-r*.6,gy=o.y+r*.55,seed=Math.random()*TAU;
   fx.spawn({life:.45,layer:'air',reach:80,draw(g,e,p,H){   /* the burst's violet laid on as colour, so it shows by day */
    const pop=E.out(Math.min(1,p/.3));H.haze(g,x,cy,(14+10*pop)*k,'110,52,200',.6*Math.pow(1-p,1.5),1,false);
   }},{x,y:o.y});
   /* the glass bursts: a violet flash, a tilted star, a rune seal stamped on it, rays and panes flung off, and its
      touch on the ground */
   fx.spawn({life:.42,layer:'glow',reach:90,light:{colour:'190,130,255',reach:210*k,head:130,h:30,peak:.85,env:p=>p<.06?p/.06:Math.pow(1-p,1.5)},draw(g,e,p,H){
    const fl=Math.max(0,1-p/.28),pop=E.out(Math.min(1,p/.4)),fade=1-p;
    H.glow(g,x,cy,(18+r*.5)*k,ARC,fl);H.glow(g,x,cy,8*k,LILAC,fl);
    H.flare(g,x,cy,(34+r*.6)*k*(.7+.3*pop),LILAC,fl,PI/4+(seed-3)*.15);
    const seal=p<.22?E.back(p/.22):1-.35*E.in((p-.22)/.78);   /* it pops on, then sinks back as it fades */
    H.runes(g,x,cy,(9+9*seal)*k,PINK,(1-E.in(Math.min(1,p*1.25)))*.95,{flat:1,rot:p*5,star:6,ticks:12,w:1.1,inner:.62});
    for(let i=0;i<7;i++){const th=i/7*TAU+seed,l0=(8+4*pop)*k,l1=l0+(14+r*.4)*k*E.out(Math.min(1,p/.3));H.streak(g,x+Math.cos(th)*l0,cy+Math.sin(th)*l0*.8,x+Math.cos(th)*l1,cy+Math.sin(th)*l1*.8,2.2*k,ARC,fl*.9);}
    if(o.crit){const q=E.clamp01((p-.05)/.5);H.runes(g,x,cy,(14+22*E.out(q))*k,LILAC,(1-q)*.7,{flat:1,rot:-p*4,star:0,ticks:16,w:.9});}
    H.ring(g,x,gy,(r+2+10*pop)*k,1.2,ARC,fade*.45,.42);
   }},{x,y:o.y});
   fx.emit({x,y:cy,n:o.crit?12:8,kind:'shard',speed:[80,200],life:[.34,.55],size:[4.5,7],c:ARC,drag:3.2,spin:[-9,9],draw:PANE,layer:'glow'});
   fx.emit({x,y:cy,n:o.crit?7:4,kind:'mote',speed:[30,80],life:[.4,.7],size:[1.2,2.1],c:LILAC,draw:TW_LILAC,drag:2});
   if(o.crit&&!o.peer)fx.shake(.06);
  },
 });
})();
