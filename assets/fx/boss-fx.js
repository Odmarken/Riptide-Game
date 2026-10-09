/* 🐉 Boss effects (2026-10-09, "nu när vi kan göra sådär bra effekter, då borde vi ju kunna göra enchancements på alla bossar
   abilites också"). What the bosses' abilities look like, as SpellFx recipes under 'boss:<name>':
     telegraph(g,h,p,now,H) - the warning on the ground while a blow charges (game.js hazards: h.x, h.y, h.rad, p 0 -> 1)
     hit(o,fx)              - what bursts where it lands (o.x, o.y, o.r the reach)
     boltTick / bolt        - a boss's missiles (game.js ebolts: x, y, vx, vy)
     cast(o,fx)             - a moment: a teleport, a charge, an enrage, a quake, Mjolnir's bolt
     draw(g,o,now,H)        - the shapes a boss keeps in its own state: the Soulbeam, the Reaping, Thor's storm
   Only the look changes. Every hitbox, timing and number stays in game.js, and every warning still shows its whole reach,
   its edge and the ring filling in, so a fight reads as it always did - now with the ground cracking, ice and bone thrust up,
   meteors falling, fel beams and lightning out of the sky. */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const TAU=Math.PI*2,PI=Math.PI,E=FX.E,clamp01=E.clamp01;
 const FLAT=.72;   /* the warnings' ellipse, as game.js always drew them */
 const hash=(i,s)=>{const v=Math.sin(i*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
 const VIOLET='160,107,208',LILAC='201,160,255',DEEPV='62,26,110',
  GREEN='154,223,58',MOSS='46,74,24',BARK='72,50,30',
  WATER='106,192,224',FOAM='224,246,255',DEEPW='24,62,104',
  BONE='214,220,232',IVORY='238,232,216',ASH='92,92,98',
  FIRE='255,134,36',GOLD='255,212,116',EMBER='222,70,18',SOOT='46,36,32',DEEPRED='128,26,8',
  BLOOD='232,106,74',STEEL='240,240,244',DUST='150,120,85',
  FEL='182,255,122',FELD='40,110,34',FELG='122,223,154',
  ICE='160,224,255',FROST='218,246,255',DEEPI='34,82,146',
  STORM='127,208,255',BOLTW='236,248,255',CLOUD='30,36,62',
  HELL='255,90,58',HELLG='255,184,96';

 /* ---------- shared pieces ---------- */
 /* a pool laid on as paint (it shows over any ground): an ellipse x,y, R wide */
 function pool(g,x,y,R,c,a){
  if(!(a>0&&R>0))return;
  g.save();g.globalAlpha=Math.min(1,a);g.fillStyle='rgb('+c+')';g.beginPath();g.ellipse(x,y,R,R*FLAT,0,0,TAU);g.fill();g.restore();
 }
 /* the warning every hazard shares: the reach (soft, as paint), its edge, the ring filling in, and a white flash on the edge
    in the last moment before it lands */
 function zone(g,H,h,p,body,lit,o={}){
  const x=h.x,y=h.y,R=h.rad,w=o.w||2.2;
  H.haze(g,x,y,R*1.06,body,(o.fill??.32)+p*(o.rise??.28),FLAT,false);
  H.ring(g,x,y,R,w,lit,.6+.4*p,FLAT);
  H.ring(g,x,y,Math.max(2,R*p),1.5,lit,.45+.45*p,FLAT);
  if(p>.8)H.ring(g,x,y,R,w*1.4,'255,255,255',(p-.8)/.2*.55,FLAT);
 }
 /* a spike thrust up out of the ground at (x,y): h tall, w wide at its foot, leaning; a body, a darker flank, a lit edge */
 function spike(g,x,y,h,w,lean,body,flank,edge,a){
  if(!(a>0&&h>.6&&w>0))return;
  const tx=x+Math.sin(lean)*h,ty=y-Math.cos(lean)*h;
  g.save();g.globalAlpha=Math.min(1,a);g.lineJoin='round';
  g.fillStyle=body;g.beginPath();g.moveTo(x-w/2,y);g.lineTo(tx,ty);g.lineTo(x+w/2,y);g.closePath();g.fill();
  g.fillStyle=flank;g.beginPath();g.moveTo(x+w*.08,y);g.lineTo(tx,ty);g.lineTo(x+w/2,y);g.closePath();g.fill();
  g.strokeStyle=edge;g.lineWidth=.9;g.beginPath();g.moveTo(x-w/2,y);g.lineTo(tx,ty);g.stroke();
  g.restore();
 }
 /* a tongue of flame from its root out along ang: L long, w wide, bent at the tip; a dark fringe, the body, a white heart */
 function flame(g,x,y,ang,L,w,a,bend=0){
  if(!(a>0&&L>.5&&w>0))return;
  const ca=Math.cos(ang),sa=Math.sin(ang),nx=-sa,ny=ca;
  g.save();g.globalCompositeOperation='lighter';
  for(const [k,al,c,lk] of [[1.8,.26,EMBER,1.05],[1,.8,FIRE,1],[.42,.9,'255,238,186',.55]]){
   const hw=w*k*.5,l=L*lk,tx=x+ca*l+nx*bend*lk,ty=y+sa*l+ny*bend*lk,bx=x+ca*l*.36,by=y+sa*l*.36;
   g.globalAlpha=Math.min(1,a*al);g.fillStyle='rgb('+c+')';g.beginPath();
   g.moveTo(x+nx*hw*.5,y+ny*hw*.5);g.quadraticCurveTo(bx+nx*hw,by+ny*hw,tx,ty);g.quadraticCurveTo(bx-nx*hw,by-ny*hw,x-nx*hw*.5,y-ny*hw*.5);g.closePath();g.fill();
  }
  g.restore();
 }
 /* a bolt of lightning from (x1,y1) to (x2,y2): a fresh fork every frame, a glow round it and a white-hot thread */
 function lightning(g,H,x1,y1,x2,y2,w,c,a,segs=14,amp=18){
  const pts=H.jag(x1,y1,x2,y2,segs,amp);H.line(g,pts,w,c,a);
  if(a>.3&&Math.random()<.6){const i=1+Math.floor(Math.random()*(pts.length-3)),p=pts[i],ang=Math.atan2(y2-y1,x2-x1)+(Math.random()-.5)*1.6,L=20+Math.random()*40;
   H.line(g,H.jag(p[0],p[1],p[0]+Math.cos(ang)*L,p[1]+Math.sin(ang)*L,4,6),w*.55,c,a*.8);}
 }
 /* a trail point every D units flown; tr[0] rides with the missile */
 function trail(tr,x,y,most,D=7){
  if(!tr.length){tr.push([x,y],[x,y]);return;}
  let lx=tr[1][0],ly=tr[1][1],d=Math.hypot(x-lx,y-ly);
  while(d>=D){const k=D/d;lx+=(x-lx)*k;ly+=(y-ly)*k;tr.splice(1,0,[lx,ly]);d=Math.hypot(x-lx,y-ly);}
  tr[0][0]=x;tr[0][1]=y;if(tr.length>most)tr.length=most;
 }
 /* a band through pts (head first), w at the head, thinning to nothing: as light, or as paint (body) */
 function band(g,pts,w,c,a,body){
  const n=pts.length;if(n<2||!(a>0&&w>0))return;
  g.save();g.globalCompositeOperation=body?'source-over':'lighter';g.globalAlpha=Math.min(1,a);g.fillStyle='rgb('+c+')';g.beginPath();
  for(let s=0;s<2;s++)for(let j=0;j<n;j++){
   const i=s?n-1-j:j,p=pts[i],q=pts[i>0?i-1:0],r=pts[i<n-1?i+1:n-1];
   let dx=q[0]-r[0],dy=q[1]-r[1];const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
   const hw=w*.5*Math.pow(1-i/(n-1),.8)*(s?-1:1);
   if(!s&&!j)g.moveTo(p[0]-dy*hw,p[1]+dx*hw);else g.lineTo(p[0]-dy*hw,p[1]+dx*hw);
  }
  g.closePath();g.fill();g.restore();
 }
 /* a column of light rising out of the ground (a pillar of soulfire, fel, hellfire): the column, a flash at its foot, the
    shock running out over the ground, motes going up - and its light on the ground round it */
 function pillar(fx,x,y,R,c,lit,o={}){
  const life=o.life||.6,W=o.w||R*.55,top=o.top||300;
  fx.spawn({life,layer:'glow',reach:R+40,light:{colour:o.light||c,reach:R*2.2+80,head:R+60,h:40,peak:o.peak||1,env:p=>p<.05?p/.05:Math.pow(1-p,1.4)},draw(g,e,p,H){
   const up=E.out(Math.min(1,p/.12)),fade=Math.pow(1-p,1.3),wd=W*(1-.35*p)*(.8+.2*up);
   H.beam(g,x,y-top*up,y,wd*1.6,c,.45*fade);H.beam(g,x,y-top*up,y,wd,lit,.9*fade);H.beam(g,x,y-top*up*.9,y,wd*.32,'255,255,255',.85*fade);
   H.glow(g,x,y-6,R*.55*(1-.3*p),lit,fade);
   H.flare(g,x,y-10,R*.9,lit,Math.max(0,1-p/.3),0);
  }},{x,y});
  fx.spawn({life:life+.25,layer:'ground',reach:R+60,draw(g,e,p,H){
   const run=E.out(Math.min(1,p/.4));H.ring(g,x,y,R*(.35+.75*run),2.6*(1-p),lit,(1-p)*.9,FLAT);H.haze(g,x,y,R*1.1,c,.5*(1-E.in(p)),FLAT);
  }},{x,y});
  fx.emit({x,y:y-8,n:o.motes??10,kind:o.kind||'ember',speed:[30,110],life:[.5,1],size:[1.6,3],c:lit,drag:1.8,up:60,grav:-50,spread:R*.35,flat:FLAT});
 }
 /* the burst of something heavy landing: billows of fire laid on as paint (so it is fire by day), light over them, the shock
    and the cinders - for meteors, eruptions and hellfire */
 function blast(fx,x,y,R,o={}){
  const k=R/140,seed=Math.random()*TAU,body=o.body||['190,52,14','236,118,30'],lit=o.lit||FIRE,glow=o.glow||GOLD;
  fx.spawn({life:.8,layer:'air',reach:R+40,draw(g,e,p,H){
   const bl=E.out(Math.min(1,p/.4)),fade=Math.pow(1-p,1.6);
   for(let i=0;i<8;i++){const t=i/8*TAU+seed,d=R*.45*bl;H.haze(g,x+Math.cos(t)*d,y-14+Math.sin(t)*d*.55-p*24*k,(22+20*bl)*k,body[i%2],.7*fade,1,false);}
   H.haze(g,x,y-20-p*20*k,(30+16*bl)*k,'110,26,8',.5*fade,1,false);
  }},{x,y});
  fx.spawn({life:.6,layer:'glow',reach:R+60,light:{colour:'255,150,60',reach:R*2.6+60,head:R+80,h:36,peak:1.2,env:p=>p<.05?p/.05:Math.pow(1-p,1.5)},draw(g,e,p,H){
   const fl=Math.max(0,1-p/.25),lick=E.out(Math.min(1,p/.15))*(1-E.in(p/.6));
   for(let i=0;i<10;i++){const t=i/10*TAU+seed;flame(g,x+Math.cos(t)*6*k,y-12+Math.sin(t)*4*k,Math.atan2(Math.sin(t)*.6-.5,Math.cos(t)),(30+26*hash(i,seed))*k*lick,13*k,Math.max(0,1-p/.6));}
   H.glow(g,x,y-14,R*.6*(.8+.2*fl),lit,fl);H.glow(g,x,y-14,R*.3,'255,255,240',fl);
   H.flare(g,x,y-14,R*1.1,glow,fl*.9,0);
  }},{x,y});
  fx.spawn({life:3,layer:'ground',reach:R+40,draw(g,e,p,H){
   const w=E.out(Math.min(1,p/.1)),rf=1-clamp01(p/.12);
   H.haze(g,x,y,R*.85,SOOT,.6*(1-E.in(p)),FLAT,false);
   H.ring(g,x,y,R*(.5+.7*w),3*rf,lit,rf*.95,FLAT);
   for(let i=0;i<6;i++){const t=hash(i,seed)*TAU,d=R*.5*hash(i+7,seed);H.glow(g,x+Math.cos(t)*d,y+Math.sin(t)*d*FLAT,3,lit,(1-clamp01(p/.6))*(.6+.4*Math.sin(p*40+i)));}
  }},{x,y});
  fx.emit({x,y:y-14,n:Math.round(10+8*k),kind:'ember',speed:[80,240],life:[.4,.9],size:[1.8,3.6],c:glow,drag:2.6,grav:-30});
  fx.emit({x,y:y-14,n:Math.round(5+4*k),kind:'spark',speed:[200,360],life:[.2,.34],size:[1.6,2.6],c:lit,drag:5});
  fx.emit({x,y:y-18,n:4,kind:'smoke',c:SOOT,speed:[14,40],life:[.9,1.3],size:[10,16],up:26,grow:1.9,layer:'air',alpha:.8});
 }
 /* spikes thrust up round (x,y) inside R: n of them, grown fast, held, sunk - roots, bone or ice by their colours */
 function spikes(fx,x,y,R,n,cols,o={}){
  const seed=Math.random()*TAU,life=o.life||.75,tall=o.tall||1;
  fx.spawn({life,layer:'air',reach:R+40,draw(g,e,p,H){
   const t=p*life,grow=E.back(clamp01(t/.12)),gone=clamp01((t-life*.55)/(life*.45)),sc=grow*(1-E.in(gone));
   const list=[];
   for(let i=0;i<n;i++){const th=hash(i,seed)*TAU,d=(o.ring?R*(o.ring+.12*(hash(i+3,seed)-.5)):R*.85*Math.sqrt(hash(i+5,seed)));list.push([x+Math.cos(o.ring?i/n*TAU+seed:th)*d,y+Math.sin(o.ring?i/n*TAU+seed:th)*d*FLAT,i]);}
   list.sort((a,b)=>a[1]-b[1]);   /* the far ones first */
   for(const [sx,sy,i] of list){const h=(22+20*hash(i+9,seed))*tall*sc,w=(7+5*hash(i+11,seed))*Math.min(1.4,tall),lean=(hash(i+13,seed)-.5)*.6+(o.ring?Math.cos(i/n*TAU+seed)*.35:0);
    spike(g,sx,sy,h,w,lean,cols[0],cols[1],cols[2],1-gone);}
  }},{x,y});
 }

 /* ================= THE FORSAKEN ONE ================= */
 /* Runes of Ruin: a solid violet pool, as it always read, a rune circle turning in it, the soul gathering as it fills; then
    a column of soulfire bursts out of it */
 FX.recipe('boss:runes',{
  telegraph(g,h,p,now,H){
   pool(g,h.x,h.y,h.rad,DEEPV,.42+p*.3);
   H.runes(g,h.x,h.y,h.rad*.86,LILAC,.5+.5*p,{flat:FLAT,rot:now*1.1+h.x*.013,star:5,w:1.8,inner:.62,ticks:18});
   H.ring(g,h.x,h.y,h.rad,4,LILAC,.95,FLAT);H.ring(g,h.x,h.y,Math.max(2,h.rad*p),2,LILAC,.7,FLAT);
   if(p>.55)H.glow(g,h.x,h.y-6,h.rad*.45*(p-.55)/.45,LILAC,(p-.55)*1.5,FLAT);
   if(p>.8)H.ring(g,h.x,h.y,h.rad,6,'255,255,255',(p-.8)/.2*.5,FLAT);
  },
  hit(o,fx){pillar(fx,o.x,o.y,o.r,VIOLET,LILAC,{top:340,motes:12,kind:'mote'});},
 });
 /* soul embers: a violet wisp with a ghostly tail */
 FX.recipe('boss:soulember',{
  boltTick(b,dt,fx){const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,12,6);if(Math.random()<dt*18)fx.emit({x:b.x,y:b.y,n:1,kind:'mote',speed:[5,25],life:[.3,.6],size:[1.1,1.8],c:LILAC,drag:2,spread:3});},
  bolt(g,b,now,H){const tr=b._tr||[];band(g,tr,12,DEEPV,.5,true);band(g,tr,9,VIOLET,.8);H.glow(g,b.x,b.y,15,VIOLET,.9);H.glow(g,b.x,b.y,6,'250,236,255',1);H.flare(g,b.x,b.y,14,LILAC,.8,now*6);return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:6,kind:'mote',speed:[40,120],life:[.3,.6],size:[1.3,2.2],c:LILAC,drag:3});fx.spawn({life:.3,layer:'glow',reach:40,draw(g,e,p,H){H.glow(g,o.x,o.y,20*(1-.4*p),LILAC,1-p);}},{x:o.x,y:o.y});},
 });
 /* the Soulbeam: its hitbox laid down true to size as a deep violet lane, and over it a beam of soulfire - a wide glow, the
    body, a white-hot core - flickering, with ripples running out along it and a blaze where it leaves his hand */
 FX.recipe('boss:soulbeam',{
  draw(g,o,now,H){
   const a=Math.atan2(o.uy,o.ux),L=o.len,hw=o.half,fl=.85+.15*Math.sin(now*43);
   g.translate(o.x,o.y);g.rotate(a);
   g.globalAlpha=.4;g.fillStyle='rgb('+DEEPV+')';g.fillRect(0,-hw,L,hw*2);
   g.globalAlpha=.85;g.strokeStyle='rgb('+LILAC+')';g.lineWidth=2.5;g.strokeRect(0,-hw,L,hw*2);g.globalAlpha=1;
   const lane=(w,c,al)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,al);const gr=g.createLinearGradient(0,-w,0,w);
    gr.addColorStop(0,'rgba('+c+',0)');gr.addColorStop(.5,'rgba('+c+',1)');gr.addColorStop(1,'rgba('+c+',0)');g.fillStyle=gr;g.fillRect(0,-w,L,w*2);g.restore();};
   lane(hw*1.35,VIOLET,.55);lane(hw*.85,LILAC,.75*fl);lane(hw*.3,'255,244,255',.95*fl);
   for(let i=0;i<9;i++){const u=(now*.9+i/9)%1;H.glow(g,u*L,Math.sin(now*7+i*2)*hw*.4,hw*.9,LILAC,.5*(1-u));}
   H.glow(g,0,0,hw*2.2,LILAC,.95);H.glow(g,0,0,hw,'255,255,255',.9);H.flare(g,0,0,hw*4,LILAC,.8,now*3);
  },
 });
 /* the Reaping: the killing cone as a deep violet field filling toward the swing, its edge burning, a rune arc turning at its
    rim - and the swing itself, a scythe of light through the whole cone */
 FX.recipe('boss:reaping',{
  draw(g,o,now,H){
   const a0=o.a-o.half,a1=o.a+o.half,R=o.range,p=o.p;
   g.save();g.globalAlpha=.3+p*.4;g.fillStyle='rgb('+DEEPV+')';g.beginPath();g.moveTo(o.x,o.y);g.arc(o.x,o.y,R,a0,a1);g.closePath();g.fill();g.restore();
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=.4*p;g.fillStyle='rgb('+VIOLET+')';g.beginPath();g.moveTo(o.x,o.y);g.arc(o.x,o.y,R*p,a0,a1);g.closePath();g.fill();g.restore();
   H.line(g,[[o.x,o.y],[o.x+Math.cos(a0)*R,o.y+Math.sin(a0)*R]],2.4,LILAC,.75+.25*Math.sin(now*14));
   H.line(g,[[o.x,o.y],[o.x+Math.cos(a1)*R,o.y+Math.sin(a1)*R]],2.4,LILAC,.75+.25*Math.sin(now*14));
   const arc=[];for(let i=0;i<=24;i++){const t=a0+(a1-a0)*i/24;arc.push([o.x+Math.cos(t)*R,o.y+Math.sin(t)*R]);}H.line(g,arc,3,LILAC,.9);
   for(let i=0;i<6;i++){const t=a0+(a1-a0)*((i+.5)/6),rr=R*(.35+.5*((now*.6+i*.17)%1));H.flare(g,o.x+Math.cos(t)*rr,o.y+Math.sin(t)*rr,10,LILAC,.6,t);}
   if(p>.82){g.save();g.globalCompositeOperation='lighter';g.globalAlpha=(p-.82)/.18*.35;g.fillStyle='#fff';g.beginPath();g.moveTo(o.x,o.y);g.arc(o.x,o.y,R,a0,a1);g.closePath();g.fill();g.restore();}
  },
  cast(o,fx){   /* the swing: a crescent of light sweeping the cone, souls torn loose along it */
   fx.spawn({life:.45,layer:'glow',reach:o.range+40,light:{colour:'190,130,255',reach:o.range*1.4,head:200,h:40,peak:1.2,env:p=>p<.05?p/.05:Math.pow(1-p,1.5)},draw(g,e,p,H){
    const lead=E.out(Math.min(1,p/.35)),fade=1-E.in(p);
    H.crescent(g,o.x,o.y,o.range*.62,o.a-o.half,o.a+o.half,o.range*.5,VIOLET,fade*.8,{lead,flat:1});
    H.crescent(g,o.x,o.y,o.range*.8,o.a-o.half,o.a+o.half,o.range*.18,LILAC,fade,{lead,flat:1});
   }},{x:o.x,y:o.y});
   for(let i=0;i<12;i++){const t=o.a+(Math.random()-.5)*2*o.half,d=o.range*(.3+.6*Math.random());fx.emit({x:o.x+Math.cos(t)*d,y:o.y+Math.sin(t)*d,n:1,kind:'mote',speed:[20,60],life:[.5,.9],size:[1.4,2.4],c:LILAC,up:40,grav:-40,drag:1.5});}
   fx.shake(.2);
  },
 });
 /* Between Worlds: a rift tears open where he leaves and where he arrives */
 FX.recipe('boss:blink',{
  cast(o,fx){
   const r=o.r||60;
   fx.spawn({life:.6,layer:'glow',reach:r+60,light:{colour:'190,130,255',reach:260,head:150,h:40,peak:1,env:p=>Math.pow(1-p,1.4)},draw(g,e,p,H){
    const open=p<.25?E.out(p/.25):1-E.in((p-.25)/.75),x=o.x,y=o.y-r*.9;
    g.save();g.globalCompositeOperation='lighter';g.translate(x,y);
    g.globalAlpha=.9*open;g.fillStyle='rgb('+VIOLET+')';g.beginPath();g.ellipse(0,0,r*.28*open,r*1.1,0,0,TAU);g.fill();
    g.globalAlpha=open;g.fillStyle='rgb(250,236,255)';g.beginPath();g.ellipse(0,0,r*.08*open,r*.95,0,0,TAU);g.fill();g.restore();
    H.glow(g,x,y,r*1.4*open,LILAC,open*.8);
    H.ring(g,o.x,o.y,r*(.6+1.4*E.out(p)),2,LILAC,(1-p)*.9,FLAT);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-r*.9,n:14,kind:'mote',speed:[60,180],life:[.4,.8],size:[1.4,2.4],c:LILAC,drag:2.6,spread:10});
  },
 });

 /* ================= ROOTFIEND ================= */
 /* the ground splitting in green-lit cracks, then thorned roots bursting up through it */
 FX.recipe('boss:roots',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,MOSS,GREEN);
   const seed=(h.seed??=Math.random()*99),n=7;
   for(let i=0;i<n;i++){const th=(i+hash(i,seed)*.6)/n*TAU,L=h.rad*.95*E.out(Math.min(1,p*1.25)),pts=[[h.x,h.y]];
    for(let j=1;j<=5;j++){const u=j/5,w=(hash(i*7+j,seed)-.5)*.5;pts.push([h.x+Math.cos(th+w*.4)*L*u,h.y+Math.sin(th+w*.4)*L*u*FLAT]);}
    H.line(g,pts,1.4,GREEN,.35+.55*p);}
  },
  hit(o,fx){
   spikes(fx,o.x,o.y,o.r,9,['rgb(86,62,34)','rgb(48,34,20)','rgba(190,240,120,.9)'],{tall:1.25});
   fx.emit({x:o.x,y:o.y,n:8,kind:'dust',speed:[40,110],flat:.45,life:[.5,.8],size:[6,10],layer:'air'});
   fx.emit({x:o.x,y:o.y-10,n:8,kind:'mote',speed:[30,90],life:[.4,.8],size:[1.4,2.2],c:GREEN,up:40,grav:-20});
   fx.spawn({life:.6,layer:'ground',reach:o.r+20,draw(g,e,p,H){H.ring(g,o.x,o.y,o.r*(.4+.7*E.out(p)),2.4*(1-p),GREEN,(1-p)*.9,FLAT);}},{x:o.x,y:o.y});
  },
 });

 /* ================= MAW OF THE DEEP ================= */
 /* ripples running in, then a geyser where he bursts out */
 FX.recipe('boss:splash',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,DEEPW,WATER,{fill:.36});
   for(let i=0;i<3;i++){const u=(now*1.6+i/3)%1;H.ring(g,h.x,h.y,h.rad*(1-u),1.4,FOAM,.6*u,FLAT);}
  },
  hit(o,fx){
   fx.spawn({life:.6,layer:'glow',reach:o.r+40,draw(g,e,p,H){
    const up=E.out(Math.min(1,p/.15)),fade=Math.pow(1-p,1.3);
    H.beam(g,o.x,o.y-170*up,o.y,o.r*.7,WATER,.6*fade);H.beam(g,o.x,o.y-150*up,o.y,o.r*.32,FOAM,.85*fade);
    H.ring(g,o.x,o.y,o.r*(.5+.9*E.out(p)),2.6*(1-p),FOAM,(1-p),FLAT);
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-30,n:22,kind:'glow',speed:[90,220],angle:[-PI*.95,-PI*.05],life:[.4,.8],size:[1.8,3.2],c:FOAM,grav:520,drag:.6,layer:'air'});
   fx.emit({x:o.x,y:o.y,n:5,kind:'smoke',c:'200,230,245',speed:[30,70],flat:.45,life:[.6,.9],size:[10,16],grow:1.5,layer:'air',alpha:.55});
  },
 });
 /* where he dives: the water closing over him */
 FX.recipe('boss:dive',{
  cast(o,fx){
   fx.spawn({life:.8,layer:'ground',reach:120,draw(g,e,p,H){for(let i=0;i<3;i++){const q=clamp01(p*1.3-i*.15);H.ring(g,o.x,o.y,20+90*E.out(q),2.2*(1-q),FOAM,(1-q)*.85,FLAT);}}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-10,n:16,kind:'glow',speed:[80,180],angle:[-PI*.9,-PI*.1],life:[.4,.7],size:[1.6,2.8],c:FOAM,grav:500,drag:.6,layer:'air'});
  },
 });
 /* his water bolts: an orb of sea with a spray behind it */
 FX.recipe('boss:waterbolt',{
  boltTick(b,dt,fx){const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,9,6);if(Math.random()<dt*24)fx.emit({x:b.x,y:b.y,n:1,kind:'glow',speed:[10,40],life:[.25,.45],size:[1.2,2],c:FOAM,grav:240,drag:1,layer:'air'});},
  bolt(g,b,now,H){const tr=b._tr||[];band(g,tr,10,DEEPW,.55,true);band(g,tr,8,WATER,.75);H.glow(g,b.x,b.y,13,WATER,.9);
   g.save();g.globalAlpha=.9;g.fillStyle='rgb(70,150,200)';g.beginPath();g.arc(b.x,b.y,5,0,TAU);g.fill();g.fillStyle='rgba(240,250,255,.9)';g.beginPath();g.arc(b.x-1.6,b.y-1.6,1.8,0,TAU);g.fill();g.restore();return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:10,kind:'glow',speed:[60,150],life:[.3,.55],size:[1.4,2.4],c:FOAM,grav:420,drag:1,layer:'air'});},
 });

 /* ================= THE KING BELOW ================= */
 /* Bone Nova: a grave-pale circle round him, bone shards drawn in toward him as it charges; then a ring of bone spears
    thrust up all round and a shock of grave dust */
 FX.recipe('boss:bonenova',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,ASH,BONE,{fill:.26,rise:.22});
   H.runes(g,h.x,h.y,h.rad*.55,BONE,.35+.5*p,{flat:FLAT,rot:-now*.8,star:0,ticks:20,w:1.4});
   for(let i=0;i<14;i++){const th=i/14*TAU+now*.7,d=h.rad*(1-((p*1.2+i*.07)%1));H.glow(g,h.x+Math.cos(th)*d,h.y+Math.sin(th)*d*FLAT,3,IVORY,.7*p);}
  },
  hit(o,fx){
   spikes(fx,o.x,o.y,o.r,20,['rgb(232,226,208)','rgb(166,160,146)','rgba(255,255,255,.95)'],{ring:.82,tall:1.15,life:.85});
   spikes(fx,o.x,o.y,o.r,10,['rgb(222,216,200)','rgb(150,144,130)','rgba(255,255,255,.9)'],{ring:.5,tall:.8,life:.75});
   fx.spawn({life:.9,layer:'ground',reach:o.r+40,draw(g,e,p,H){const run=E.out(Math.min(1,p/.45));H.haze(g,o.x,o.y,o.r*(.3+.9*run),DUST,.55*(1-p),FLAT,false);H.ring(g,o.x,o.y,o.r*(.25+.85*run),3*(1-p),IVORY,(1-p)*.9,FLAT);}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-10,n:14,kind:'shard',speed:[120,260],flat:.6,life:[.35,.6],size:[2.4,3.6],c:IVORY,drag:2,spin:[-9,9],layer:'air'});
   fx.emit({x:o.x,y:o.y,n:8,kind:'dust',speed:[80,180],flat:.45,life:[.6,.9],size:[10,16],layer:'air'});
   fx.shake(.08);
  },
 });

 /* ================= FIRE: the Rekindled and the Firelord ================= */
 /* their burning trail: a smouldering patch that flares up - small, there are many */
 FX.recipe('boss:embertrail',{
  telegraph(g,h,p,now,H){
   H.haze(g,h.x,h.y,h.rad*1.1,DEEPRED,.4+.3*p,FLAT,false);
   H.ring(g,h.x,h.y,h.rad,1.4,FIRE,.5+.4*p,FLAT);
   const n=h.rad>40?4:2,seed=(h.seed??=Math.random()*99);
   for(let i=0;i<n;i++){const th=hash(i,seed)*TAU,d=h.rad*.5*hash(i+3,seed);flame(g,h.x+Math.cos(th)*d,h.y+Math.sin(th)*d*FLAT,-PI/2,(6+h.rad*.25)*(.6+.4*Math.abs(Math.sin(now*9+i*2))),5,.75);}
  },
  hit(o,fx){
   fx.spawn({life:.35,layer:'glow',reach:o.r+20,draw(g,e,p,H){const fl=1-p;for(let i=0;i<5;i++)flame(g,o.x+(i-2)*o.r*.3,o.y,-PI/2+(i-2)*.25,(10+o.r*.5)*fl,7,fl);H.glow(g,o.x,o.y-6,o.r*.8,FIRE,fl*.8);}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-6,n:2,kind:'ember',speed:[20,60],life:[.3,.6],size:[1.4,2.4],c:GOLD,grav:-40,drag:2});
  },
 });
 /* Meteors: a fiery mark with a shadow growing in it, and the meteor itself coming down out of the sky to hit it */
 FX.recipe('boss:meteor',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,DEEPRED,FIRE);
   H.haze(g,h.x,h.y,h.rad*.8*p,'20,10,6',.5*p,FLAT,false);
   const q=clamp01((p-.45)/.55);
   if(q>0){const e=E.in(q),sx=h.x+170,sy=h.y-460,x=sx+(h.x-sx)*e,y=sy+(h.y-sy)*e,ux=(h.x-sx)/Math.hypot(h.x-sx,h.y-sy),uy=(h.y-sy)/Math.hypot(h.x-sx,h.y-sy);
    H.streak(g,x-ux*120,y-uy*120,x,y,22,EMBER,.55);H.streak(g,x-ux*80,y-uy*80,x,y,14,FIRE,.9);H.streak(g,x-ux*36,y-uy*36,x,y,7,'255,240,200',1);
    H.glow(g,x,y,26,FIRE,.95);H.glow(g,x,y,12,'255,250,230',1);}
  },
  hit(o,fx){blast(fx,o.x,o.y,o.r);fx.shake(.08);},
 });
 /* the Firelord's Eruption: lava cracks glowing open, then a column of fire and a blast */
 FX.recipe('boss:eruption',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,DEEPRED,FIRE,{fill:.38});
   const seed=(h.seed??=Math.random()*99);
   for(let i=0;i<6;i++){const th=(i+hash(i,seed)*.5)/6*TAU,L=h.rad*.9*E.out(Math.min(1,p*1.3));H.line(g,H.jag(h.x,h.y,h.x+Math.cos(th)*L,h.y+Math.sin(th)*L*FLAT,5,6,H.rng((seed*997+i*13)>>>0)),2.2,FIRE,.5+.5*p);}
   H.glow(g,h.x,h.y-4,h.rad*.4*p,GOLD,.7*p,FLAT);
  },
  hit(o,fx){pillar(fx,o.x,o.y,o.r,EMBER,FIRE,{top:260,light:'255,150,60',motes:6});blast(fx,o.x,o.y,o.r*.85);fx.shake(.06);},
 });
 /* the Firelord's fire bolts: little comets */
 FX.recipe('boss:firebolt',{
  boltTick(b,dt,fx){const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,10,6);if(Math.random()<dt*30)fx.emit({x:b.x,y:b.y,n:1,kind:'ember',speed:[10,40],life:[.25,.45],size:[1.3,2.3],c:Math.random()<.5?GOLD:FIRE,grav:-40,drag:2,spread:3});},
  bolt(g,b,now,H){const tr=b._tr||[],a=Math.atan2(b.vy,b.vx);band(g,tr,11,'150,34,10',.55,true);band(g,tr,8,FIRE,.85);
   flame(g,b.x,b.y,a+PI,16,7,.9,Math.sin(now*23)*2.5);H.glow(g,b.x,b.y,13,FIRE,.9);H.glow(g,b.x,b.y,5.5,'255,248,230',1);return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:8,kind:'ember',speed:[50,150],life:[.3,.55],size:[1.4,2.6],c:GOLD,drag:3,grav:-20});fx.spawn({life:.3,layer:'glow',reach:40,draw(g,e,p,H){H.glow(g,o.x,o.y,22*(1-.3*p),FIRE,1-p);}},{x:o.x,y:o.y});},
 });

 /* ================= THE WARLORD ================= */
 /* Whirlwind: blades of light wheeling round him faster and faster, then one great spinning cut and a ring of dust */
 FX.recipe('boss:whirlwind',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,'110,30,20',BLOOD,{fill:.28});
   const spin=now*(4+10*p);
   for(let i=0;i<3;i++){const a0=spin+i*TAU/3;H.crescent(g,h.x,h.y-8,h.rad*.62,a0,a0+1.1,8+10*p,BLOOD,.35+.5*p,{flat:FLAT,taper:.6});}
  },
  hit(o,fx){
   fx.spawn({life:.42,layer:'glow',reach:o.r+40,draw(g,e,p,H){
    const spin=p*TAU*2.2,fade=1-E.in(p);
    for(let i=0;i<4;i++){const a0=spin+i*TAU/4;H.crescent(g,o.x,o.y-8,o.r*.78,a0,a0+1.4,26,BLOOD,fade*.8,{flat:FLAT,taper:.5});H.crescent(g,o.x,o.y-8,o.r*.85,a0,a0+1.4,8,STEEL,fade,{flat:FLAT,taper:.5});}
   }},{x:o.x,y:o.y});
   fx.spawn({life:.7,layer:'ground',reach:o.r+40,draw(g,e,p,H){const run=E.out(Math.min(1,p/.5));H.haze(g,o.x,o.y,o.r*(.4+.7*run),DUST,.5*(1-p),FLAT,false);H.ring(g,o.x,o.y,o.r*(.5+.6*run),2.6*(1-p),BLOOD,(1-p)*.8,FLAT);}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y,n:10,kind:'dust',speed:[120,220],flat:.45,life:[.5,.8],size:[8,13],layer:'air'});
   fx.emit({x:o.x,y:o.y-10,n:12,kind:'spark',speed:[200,340],life:[.15,.3],size:[1.4,2.2],c:STEEL,drag:5});
   fx.shake(.07);
  },
 });
 /* the Charge: the lane he will run, burning brighter as he winds up - and the dust and speed of the run itself */
 FX.recipe('boss:chargelane',{
  draw(g,o,now,H){
   const L=o.len||240,w=o.half||22,x2=o.x+o.dx*L,y2=o.y+o.dy*L,nx=-o.dy*w,ny=o.dx*w,p=o.p;
   g.save();g.globalAlpha=.3+.35*p;g.fillStyle='rgb(110,30,20)';g.beginPath();g.moveTo(o.x+nx,o.y+ny);g.lineTo(x2+nx,y2+ny);g.lineTo(x2-nx,y2-ny);g.lineTo(o.x-nx,o.y-ny);g.closePath();g.fill();g.restore();
   H.line(g,[[o.x+nx,o.y+ny],[x2+nx,y2+ny]],1.8,BLOOD,.6+.4*p);H.line(g,[[o.x-nx,o.y-ny],[x2-nx,y2-ny]],1.8,BLOOD,.6+.4*p);
   for(let i=0;i<3;i++){const u=((now*2.4+i/3)%1)*p,cx=o.x+o.dx*L*u,cy=o.y+o.dy*L*u;H.line(g,[[cx-o.dx*14+nx*.7,cy-o.dy*14+ny*.7],[cx,cy],[cx-o.dx*14-nx*.7,cy-o.dy*14-ny*.7]],2.2,BLOOD,.8);}
   const ax=x2,ay=y2;H.line(g,[[ax-o.dx*20+nx,ay-o.dy*20+ny],[ax,ay],[ax-o.dx*20-nx,ay-o.dy*20-ny]],3,BLOOD,.95);
  },
  cast(o,fx){   /* the run: dust thrown up behind him the whole way */
   fx.spawn({life:.6,layer:'air',reach:120,update(e,dt,fx2){if(e.t<.55&&Math.random()<dt*40){const f=o.follow&&o.follow();if(f)fx2.emit({x:f.x-o.dx*14,y:f.y+8,n:1,kind:'dust',speed:[20,60],angle:[Math.atan2(-o.dy,-o.dx)-.6,Math.atan2(-o.dy,-o.dx)+.6],flat:.5,life:[.35,.6],size:[6,10],layer:'air'});}},
    draw(g,e,p,H){const f=o.follow&&o.follow();if(!f||p>.9)return;for(let i=0;i<3;i++){const k=i-1;H.streak(g,f.x-o.dx*70+(-o.dy)*k*12,f.y-10-o.dy*70+o.dx*k*12,f.x-o.dx*12+(-o.dy)*k*12,f.y-10-o.dy*12+o.dx*k*12,3,'255,200,170',.6*(1-p));}}},{x:o.x,y:o.y});
  },
 });

 /* ================= THE BETRAYER ================= */
 /* Eye Beam: a fel mark turning on the ground and a thin beam reaching down to it - then the beam falls in full */
 FX.recipe('boss:eyebeam',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,FELD,FEL);
   H.runes(g,h.x,h.y,h.rad*.7,FEL,.4+.5*p,{flat:FLAT,rot:now*1.8,star:3,ticks:12,w:1.4,inner:.7});
   H.beam(g,h.x,h.y-420,h.y,6+16*p,FEL,.2+.45*p);
  },
  hit(o,fx){pillar(fx,o.x,o.y,o.r,FELD,FEL,{top:460,w:o.r*.5,light:'150,255,120',motes:12});
   fx.spawn({life:2.2,layer:'ground',reach:o.r,draw(g,e,p,H){H.haze(g,o.x,o.y,o.r*.7,'20,40,14',.5*(1-E.in(p)),FLAT,false);for(let i=0;i<5;i++){const t=i/5*TAU,d=o.r*.35;H.glow(g,o.x+Math.cos(t)*d,o.y+Math.sin(t)*d*FLAT,3,FEL,(1-clamp01(p/.6))*(.6+.4*Math.sin(p*30+i)));}}},{x:o.x,y:o.y});},
 });
 /* his thrown Fel Glaives: a spinning green blade with a fel wake */
 FX.recipe('boss:felglaive',{
  boltTick(b,dt,fx){b._spin=(b._spin||0)+dt*22;const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,10,6);if(Math.random()<dt*16)fx.emit({x:b.x,y:b.y,n:1,kind:'ember',speed:[10,30],life:[.25,.45],size:[1.2,2],c:FEL,grav:-20,drag:2});},
  bolt(g,b,now,H){const tr=b._tr||[];band(g,tr,10,FELD,.5,true);band(g,tr,7,FELG,.75);H.glow(g,b.x,b.y,15,FEL,.75);
   const s=b._spin||0;H.crescent(g,b.x,b.y,9,s,s+2.2,6,FEL,1,{flat:1});H.crescent(g,b.x,b.y,9,s+PI,s+PI+2.2,6,FEL,1,{flat:1});H.glow(g,b.x,b.y,4,'240,255,230',1);return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:8,kind:'spark',speed:[90,200],life:[.15,.3],size:[1.3,2],c:FEL,drag:4});},
 });

 /* ================= THE FROST KING ================= */
 /* Ring of Frost: frost spreading over the mark with crystals glinting at its rim, then ice spears bursting up */
 FX.recipe('boss:frostring',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,DEEPI,ICE,{fill:.3});
   const seed=(h.seed??=Math.random()*99);
   for(let i=0;i<5;i++){const th=hash(i,seed)*TAU,d=h.rad*(.4+.5*hash(i+2,seed));H.flare(g,h.x+Math.cos(th)*d,h.y+Math.sin(th)*d*FLAT,5+7*p,FROST,(.3+.6*p)*(.6+.4*Math.sin(now*8+i*2)),th);}
  },
  hit(o,fx){
   spikes(fx,o.x,o.y,o.r,6,['rgb(206,236,255)','rgb(70,130,210)','rgba(255,255,255,1)'],{tall:1.3,life:.9});
   fx.emit({x:o.x,y:o.y-10,n:6,kind:'shard',speed:[80,180],life:[.3,.55],size:[2,3.2],c:ICE,drag:2,grav:200,up:40,layer:'glow'});
   fx.emit({x:o.x,y:o.y,n:2,kind:'smoke',c:'210,236,250',speed:[30,60],flat:.45,life:[.6,.9],size:[10,14],grow:1.4,layer:'air',alpha:.6});
   fx.spawn({life:.4,layer:'glow',reach:o.r,draw(g,e,p,H){H.glow(g,o.x,o.y-8,o.r*.6,ICE,1-p,FLAT);}},{x:o.x,y:o.y});
  },
 });
 /* his frost volleys: a shard of ice with a trail of frost */
 FX.recipe('boss:frostbolt',{
  boltTick(b,dt,fx){const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,9,6);if(Math.random()<dt*14)fx.emit({x:b.x,y:b.y,n:1,kind:'mote',speed:[5,20],life:[.3,.5],size:[1,1.6],c:FROST,drag:2});},
  bolt(g,b,now,H){const tr=b._tr||[],a=Math.atan2(b.vy,b.vx);band(g,tr,9,DEEPI,.45,true);band(g,tr,7,ICE,.8);H.glow(g,b.x,b.y,13,ICE,.85);
   g.save();g.translate(b.x,b.y);g.rotate(a);g.fillStyle='rgba(214,240,255,.95)';g.beginPath();g.moveTo(9,0);g.lineTo(0,-3.6);g.lineTo(-7,0);g.lineTo(0,3.6);g.closePath();g.fill();
   g.globalCompositeOperation='lighter';g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.moveTo(9,0);g.lineTo(0,-1.6);g.lineTo(-3,0);g.closePath();g.fill();g.restore();return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:7,kind:'shard',speed:[60,140],life:[.25,.45],size:[1.6,2.6],c:ICE,drag:3,layer:'glow'});},
 });

 /* ================= THOR ================= */
 /* Thunderstrike: the storm's shadow gathering over the mark with sparks running round it - then lightning out of the sky */
 FX.recipe('boss:thunder',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,CLOUD,STORM,{fill:.34});
   if(Math.random()<.25+.5*p){const th=Math.random()*TAU,x=h.x+Math.cos(th)*h.rad,y=h.y+Math.sin(th)*h.rad*FLAT;lightning(g,H,x,y,x+(Math.random()-.5)*40,y-10-Math.random()*30,1.2,STORM,.7,4,6);}
   if(p>.7)lightning(g,H,h.x+(Math.random()-.5)*30,h.y-420,h.x,h.y-40,1.4,STORM,(p-.7)/.3*.5,10,26);
  },
  hit(o,fx){
   fx.spawn({life:.42,layer:'glow',reach:o.r+60,light:{colour:'150,210,255',reach:o.r*2.6+60,head:o.r+80,h:60,peak:1.3,env:p=>p<.04?p/.04:Math.pow(1-p,2)},draw(g,e,p,H){
    const fl=Math.max(0,1-p/.5);
    lightning(g,H,o.x+(Math.random()-.5)*20,o.y-460,o.x,o.y-6,3.4*fl+1,STORM,fl,16,30);
    lightning(g,H,o.x+(Math.random()-.5)*60,o.y-460,o.x+(Math.random()-.5)*30,o.y-6,1.6,BOLTW,fl*.8,14,24);
    H.glow(g,o.x,o.y-8,o.r*.7*(.7+.3*fl),STORM,fl);H.glow(g,o.x,o.y-8,o.r*.25,'255,255,255',fl);H.flare(g,o.x,o.y-10,o.r*1.2,BOLTW,fl,0);
   }},{x:o.x,y:o.y});
   fx.spawn({life:.6,layer:'ground',reach:o.r+40,draw(g,e,p,H){H.ring(g,o.x,o.y,o.r*(.4+.8*E.out(p)),2.6*(1-p),STORM,(1-p),FLAT);H.haze(g,o.x,o.y,o.r*.6,'20,24,40',.5*(1-p),FLAT,false);}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-8,n:14,kind:'spark',speed:[160,340],life:[.15,.32],size:[1.3,2.2],c:BOLTW,drag:4});
   fx.shake(.07);
  },
 });
 /* his thrown bolts: a ball of lightning crackling */
 FX.recipe('boss:stormbolt',{
  boltTick(b,dt,fx){const tr=b._tr||(b._tr=[]);trail(tr,b.x,b.y,8,7);},
  bolt(g,b,now,H){const tr=b._tr||[];band(g,tr,8,STORM,.6);H.glow(g,b.x,b.y,16,STORM,.9);H.glow(g,b.x,b.y,6,'255,255,255',1);
   for(let i=0;i<2;i++){const a=Math.random()*TAU;lightning(g,H,b.x,b.y,b.x+Math.cos(a)*16,b.y+Math.sin(a)*16,.9,BOLTW,.9,3,4);}return true;},
  hit(o,fx){fx.emit({x:o.x,y:o.y,n:8,kind:'spark',speed:[100,220],life:[.15,.28],size:[1.2,1.9],c:BOLTW,drag:4});},
 });
 /* the storm: three lanes of lightning turning round the hall - each lane's reach laid down as a dark band so it can be read,
    two forks living along it and a bright core; and sparks where it touches the ground */
 FX.recipe('boss:thorstorm',{
  draw(g,o,now,H){
   for(let i=0;i<(o.n||3);i++){
    const a=o.a+i*TAU/(o.n||3),ux=Math.cos(a),uy=Math.sin(a),x0=o.cx+ux*30,y0=o.cy+uy*30,x1=o.cx+ux*o.len,y1=o.cy+uy*o.len,nx=-uy*o.half,ny=ux*o.half;
    g.save();g.globalAlpha=.22;g.fillStyle='rgb('+CLOUD+')';g.beginPath();g.moveTo(x0+nx,y0+ny);g.lineTo(x1+nx,y1+ny);g.lineTo(x1-nx,y1-ny);g.lineTo(x0-nx,y0-ny);g.closePath();g.fill();g.restore();
    H.line(g,[[x0+nx,y0+ny],[x1+nx,y1+ny]],1,STORM,.35);H.line(g,[[x0-nx,y0-ny],[x1-nx,y1-ny]],1,STORM,.35);
    H.streak(g,x1,y1-8,x0,y0-8,o.half*.9,STORM,.25);
    lightning(g,H,x0,y0-10,x1,y1-10,2.4,STORM,.85,Math.max(12,Math.round(o.len/38)),16);
    lightning(g,H,x0,y0-10,x1,y1-10,1.2,BOLTW,.9,Math.max(10,Math.round(o.len/50)),10);
   }
   H.glow(g,o.cx,o.cy-10,60,STORM,.8);H.glow(g,o.cx,o.cy-10,22,'255,255,255',.9);
  },
 });
 /* Mjolnir calls: a bolt from Thor to you and another out of the sky onto you */
 FX.recipe('boss:mjolnir',{
  cast(o,fx){
   fx.spawn({life:.4,layer:'glow',reach:600,light:{colour:'150,210,255',reach:260,head:160,h:50,peak:1.2,env:p=>Math.pow(1-p,2)},draw(g,e,p,H){
    const fl=1-p,t=o.target&&o.target();const tx=t?t.x:o.tx,ty=t?t.y-10:o.ty;
    lightning(g,H,o.x,o.y,tx,ty,3*fl+1,STORM,fl,18,22);lightning(g,H,o.x,o.y,tx,ty,1.3,BOLTW,fl,14,12);
    lightning(g,H,tx+(Math.random()-.5)*30,ty-420,tx,ty,2.2*fl+.8,STORM,fl*.9,12,24);
    H.glow(g,tx,ty,40*fl,STORM,fl);H.flare(g,tx,ty,60,BOLTW,fl,0);H.glow(g,o.x,o.y,30*fl,STORM,fl);
   }},{x:o.x,y:o.y});
  },
 });

 /* ================= ODIN ================= */
 /* Hellfire: a great burning sigil with flames running round its rim - then a ring of fire bursting out and a column of it */
 FX.recipe('boss:hellfire',{
  telegraph(g,h,p,now,H){
   zone(g,H,h,p,DEEPRED,HELL,{fill:.3});
   H.runes(g,h.x,h.y,h.rad*.8,HELLG,.4+.55*p,{flat:FLAT,rot:now*.9+h.x*.01,star:6,ticks:24,w:1.8,inner:.66});
   const n=16;for(let i=0;i<n;i++){const th=i/n*TAU+now*.3,x=h.x+Math.cos(th)*h.rad,y=h.y+Math.sin(th)*h.rad*FLAT;flame(g,x,y,-PI/2,(10+16*p)*(.6+.4*Math.abs(Math.sin(now*8+i*1.7))),7,.5+.45*p);}
  },
  hit(o,fx){
   blast(fx,o.x,o.y,o.r*.6,{lit:HELL,glow:HELLG});
   fx.spawn({life:.7,layer:'glow',reach:o.r+60,draw(g,e,p,H){const run=E.out(Math.min(1,p/.5)),fade=1-E.in(p);
    H.ring(g,o.x,o.y,o.r*(.3+.8*run),10*fade,HELL,fade*.85,FLAT);H.ring(g,o.x,o.y,o.r*(.3+.8*run),3*fade,'255,240,200',fade,FLAT);
    for(let i=0;i<14;i++){const th=i/14*TAU,x=o.x+Math.cos(th)*o.r*(.3+.8*run),y=o.y+Math.sin(th)*o.r*(.3+.8*run)*FLAT;flame(g,x,y,-PI/2,26*fade,10,fade);}
   }},{x:o.x,y:o.y});
   fx.shake(.1);
  },
 });
 /* the Ground Shake: the earth heaving out from his feet - a wave of dust, cracks running, stones thrown up */
 FX.recipe('boss:groundshake',{
  cast(o,fx){
   const R=o.r||220,seed=Math.random()*TAU;
   fx.spawn({life:1.1,layer:'ground',reach:R+60,draw(g,e,p,H){
    const run=E.out(Math.min(1,p/.5)),fade=1-E.in(p);
    H.haze(g,o.x,o.y,R*(.3+.9*run),DUST,.55*fade,FLAT,false);
    H.ring(g,o.x,o.y,R*(.2+.9*run),5*fade,'242,217,138',fade*.8,FLAT);
    for(let i=0;i<10;i++){const th=(i+hash(i,seed)*.5)/10*TAU,L=R*.9*run;H.line(g,H.jag(o.x,o.y,o.x+Math.cos(th)*L,o.y+Math.sin(th)*L*FLAT,6,7,H.rng((seed*991+i*17)>>>0)),2,'60,44,28',fade*.8);}
   }},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y,n:14,kind:'dust',speed:[120,240],flat:.45,life:[.6,1],size:[12,18],layer:'air'});
   fx.emit({x:o.x,y:o.y-6,n:12,kind:'shard',speed:[90,200],life:[.4,.7],size:[2.2,3.4],c:'150,130,100',grav:420,up:120,drag:1,spin:[-8,8],layer:'air'});
  },
 });

 /* ================= every boss's own blow (2026-10-09, "gör det på alla bossar ... dungeon osv") ================= */
 /* a boss's swing landing on you: a SLASH (a blade's arc of light across you, from where it came) or a SMASH (the ground
    cracking under you, a shock and what it throws up - stone, thorns, cinders or ice by the boss) - in the boss's colours.
    The dungeon guardians, who only fight with their clubs, smash in their dungeon's colours */
 const DEBRIS={briarhollow:['spark','159,189,104','thorn'],cindervein:['ember','255,170,90','cinder'],frostveil:['shard','190,226,255','ice']};
 FX.recipe('boss:slam',{
  cast(o,fx){
   const c=o.c||'255,214,156',a=Math.atan2(o.y-(o.sy??o.y),o.x-(o.sx??o.x-1)),x=o.x,y=o.y,seed=Math.random()*TAU;
   if(o.style==='slash'){
    fx.spawn({life:.3,layer:'glow',reach:70,draw(g,e,p,H){
     const lead=E.out(Math.min(1,p/.4)),fade=1-E.in(p);
     H.crescent(g,x,y-16,30,a-1.25,a+1.25,13,c,fade*.85,{lead,flat:.8});H.crescent(g,x,y-16,34,a-1.25,a+1.25,4,'255,255,255',fade,{lead,flat:.8});
     H.glow(g,x,y-14,18*(1-p),c,fade);
    }},{x,y});
    fx.emit({x,y:y-14,n:6,kind:'spark',speed:[120,240],angle:[a-.7,a+.7],life:[.12,.25],size:[1.2,2],c,drag:5});
    return;
   }
   const d=DEBRIS[o.dungeon]||null;
   fx.spawn({life:.5,layer:'ground',reach:70,draw(g,e,p,H){
    const run=E.out(Math.min(1,p/.35)),fade=1-E.in(p);
    H.haze(g,x,y+4,26+18*run,DUST,.45*fade,FLAT,false);
    H.ring(g,x,y+4,12+34*run,2.4*(1-p),c,fade*.9,FLAT);
    for(let i=0;i<5;i++){const th=(i+hash(i,seed)*.6)/5*TAU,L=(18+14*hash(i+3,seed))*run;H.line(g,H.jag(x,y+4,x+Math.cos(th)*L,y+4+Math.sin(th)*L*FLAT,3,3,H.rng((seed*983+i*11)>>>0)),1.3,'50,38,26',fade*.85);}
   }},{x,y});
   fx.spawn({life:.22,layer:'glow',reach:50,draw(g,e,p,H){H.glow(g,x,y-8,24*(1-p*.4),c,1-p);H.flare(g,x,y-8,34,c,(1-p)*.8,0);}},{x,y});
   fx.emit({x,y,n:4,kind:'dust',speed:[50,110],flat:.45,life:[.35,.6],size:[6,10],layer:'air'});
   if(d)fx.emit({x,y:y-8,n:7,kind:d[0],speed:[80,180],life:[.3,.55],size:[1.6,2.8],c:d[1],grav:d[0]==='ember'?-30:300,up:60,drag:2,spin:[-9,9],layer:d[0]==='shard'?'glow':undefined});
   else fx.emit({x,y:y-6,n:6,kind:'shard',speed:[80,170],life:[.35,.6],size:[1.6,2.6],c:'150,130,100',grav:380,up:90,drag:1,spin:[-8,8],layer:'air'});
  },
 });

 /* ================= every boss ================= */
 /* an enrage or a transformation: a column of power, two shockwaves, motes thrown up - in the boss's own colours */
 FX.recipe('boss:enrage',{
  cast(o,fx){
   const c=o.c||'255,90,30',lit=o.lit||c,R=o.r||120;
   pillar(fx,o.x,o.y,R,c,lit,{top:380,w:R*.6,motes:18,kind:o.kind||'ember',peak:1.3});
   fx.spawn({life:1,layer:'ground',reach:R*2.4,draw(g,e,p,H){for(let i=0;i<2;i++){const q=clamp01(p*1.4-i*.25);H.ring(g,o.x,o.y,R*(.4+1.6*E.out(q)),4*(1-q),lit,(1-q)*.9,FLAT);}}},{x:o.x,y:o.y});
   fx.shake(.18);
  },
 });
 /* a summoning: a circle opening on the ground and the shape stepping out of a column of light */
 FX.recipe('boss:summon',{
  cast(o,fx){
   const c=o.c||'200,120,255';
   fx.spawn({life:.8,layer:'ground',reach:70,draw(g,e,p,H){const open=E.back(Math.min(1,p/.25)),fade=1-E.in(p);H.runes(g,o.x,o.y,32*open,c,fade,{flat:FLAT,rot:p*4,star:5,w:1.4,ticks:12});}},{x:o.x,y:o.y});
   fx.spawn({life:.5,layer:'glow',reach:60,draw(g,e,p,H){const f=1-p;H.beam(g,o.x,o.y-120,o.y,26*f,c,.8*f);H.glow(g,o.x,o.y-10,30*f,c,f);}},{x:o.x,y:o.y});
   fx.emit({x:o.x,y:o.y-10,n:8,kind:'mote',speed:[30,90],life:[.4,.7],size:[1.3,2.2],c,up:30,grav:-30,drag:2});
  },
 });
})();
