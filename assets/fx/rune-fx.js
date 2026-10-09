/* ✨ Weapon runes in action (asked for 2026-10-09: "gör så alla vapen enchants har bättre effekt nu när vi har renare effekts").
   The five runes the Enchanting hall cuts already live on the weapon (assets/weapons: the tint, the halo, the marks and the
   drops and embers it sheds). These are what a rune does when the weapon is USED - SpellFx recipes, set off by game.js:
     'rune:swing'  cast  - a melee swing: the rune's colour swept along with the blade, its own bits flung off the edge.
                           o: x,y the hero, gy his feet, fx facing, tx,ty the foe, id the rune
     'rune:<id>'   hit   - where a weapon's blow lands (a basic attack, melee or shot): o: x,y,r the foe, crit, sx,sy the hero,
                           to() where the hero is now (Veinseeker draws the blood back to him), near [{x,y}] foes beside it
                           (Stormetch's lightning jumps to them - a look only, the rune changes no number)
                   boltTick - a shot from a runed bow or staff trails the rune behind it
   Emberbite bursts into flame (its light is warm, so the heat haze rises off it on the GPU), Frostgrip cracks into ice, Veinseeker
   bleeds the foe and draws it home, Stormetch calls lightning down, Goldrune rings with gold. Lights join the night's light map. */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const H=FX.H,E=H.E,TAU=Math.PI*2,PI=Math.PI;
 /* each rune: its colour, its white-hot heart, its deep shade, the light it throws */
 const RUNES={
  emberbite:{c:'255,122,58',hot:'255,214,140',deep:'190,50,16',lit:'255,150,60'},
  frostgrip:{c:'127,216,255',hot:'226,248,255',deep:'60,130,190',lit:'150,215,255'},
  veinseeker:{c:'200,48,72',hot:'255,150,160',deep:'96,10,30',lit:'220,60,80'},
  stormetch:{c:'185,140,255',hot:'240,228,255',deep:'110,60,200',lit:'185,150,255'},
  goldrune:{c:'255,215,106',hot:'255,248,214',deep:'190,130,40',lit:'255,214,120'},
 };
 const drop=(g,p,k,a)=>{   /* a drop of blood, long in its flight */
  const sp=Math.hypot(p.vx,p.vy)||1;g.save();g.globalAlpha=a;g.translate(p.x,p.y);g.rotate(Math.atan2(p.vy,p.vx));
  g.fillStyle='rgba(120,12,32,.95)';g.beginPath();g.ellipse(0,0,p.s*(1+Math.min(1.5,sp/220)),p.s*.72,0,0,TAU);g.fill();
  g.fillStyle='rgba(255,140,150,.55)';g.beginPath();g.arc(p.s*.35,-p.s*.25,p.s*.3,0,TAU);g.fill();g.restore();
 };
 const glint=(g,p,k,a,H)=>H.flare(g,p.x,p.y,p.s*4.2,'255,236,170',a,p.rot);   /* a glint of gold, turning */
 /* the rune's own bits from a point: n how many, dir the way they fly (radians, or null all round) */
 function bits(fx,id,x,y,n,dir=null,k=1){
  const R=RUNES[id],ang=dir==null?[0,TAU]:[dir-.9,dir+.9];
  switch(id){
   case 'emberbite':fx.emit({x,y,n,kind:'ember',c:'255,150,60',speed:[30*k,110*k],angle:ang,life:[.4,.85],size:[1.4,2.8],up:30,grav:-40,drag:2.4});break;
   case 'frostgrip':fx.emit({x,y,n:Math.ceil(n*.6),kind:'shard',c:'190,235,255',speed:[50*k,150*k],angle:ang,life:[.3,.6],size:[1.6,2.8],grav:260,drag:2});
    fx.emit({x,y,n:Math.ceil(n*.5),kind:'mote',c:R.hot,speed:[10*k,40*k],life:[.6,1.1],size:[1,1.8],grav:20});break;
   case 'veinseeker':fx.emit({x,y,n,kind:'glow',draw:drop,speed:[50*k,150*k],angle:ang,life:[.4,.75],size:[1.3,2.3],grav:420,drag:1.2,layer:'air'});break;
   case 'stormetch':fx.emit({x,y,n:n+2,kind:'spark',c:'225,205,255',speed:[140*k,300*k],angle:ang,life:[.1,.25],size:[1.2,2.2],drag:4});break;
   case 'goldrune':fx.emit({x,y,n:Math.ceil(n*.7),kind:'glow',draw:glint,c:R.c,speed:[30*k,100*k],angle:ang,life:[.4,.8],size:[1.2,2.2],grav:60,drag:2.2,spin:[-4,4]});
    fx.emit({x,y,n:Math.ceil(n*.5),kind:'mote',c:R.c,speed:[10*k,50*k],life:[.5,.9],size:[1,1.8],up:20});break;
  }
 }

 /* ---------- the swing ---------- */
 FX.recipe('rune:swing',{
  cast(o,fx){
   const R=RUNES[o.id];if(!R)return;
   const f=o.fx<0?-1:1,F=o.y+(o.gy??8),cx=o.x+f*6,cy=F-26,tx=o.tx??o.x+f*44,ty=(o.ty??o.y)-12;
   const dx=Math.max(16,(tx-cx)*f),dy=Math.max(-40,Math.min(40,ty-cy)),aR=Math.atan2(dy,dx),r=Math.max(34,Math.min(48,Math.hypot(dx,dy)));
   const m=a=>f>0?a:PI-a,a0=m(aR-1.8),a1=m(aR+.85);
   fx.spawn({life:.3,layer:'glow',reach:110,draw(g,e,p,H){
    const t=e.t,lead=E.out(t/.12),al=t<.13?1:Math.max(0,1-(t-.13)/.17),head=a0+(a1-a0)*lead;
    H.crescent(g,cx,cy,r,a0,a1,r*.3,R.c,al*.8,{lead,flat:.9});   /* the rune's colour swept with the edge */
    H.crescent(g,cx,cy,r*1.07,a0,a1,r*.08,R.hot,al*.75,{lead,flat:.9});
    if(o.id==='stormetch'&&t<.2){const rnd=H.rng(e.seed+Math.floor(t*40)),pts=[];for(let i=0;i<=8;i++){const a=a0+(head-a0)*i/8,rr=r*(1.02+(rnd()-.5)*.14);pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.9]);}H.line(g,pts,1.4,R.hot,al*.9);}
    if(t<.12)H.flare(g,cx+Math.cos(head)*r,cy+Math.sin(head)*r*.9,18,R.hot,1-t/.12,head);   /* the tip's glint */
   }},{x:o.x,y:o.y});
   const at=u=>{const a=a0+(a1-a0)*u;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r*.9,a+f*PI/2];};
   for(const u of [.45,.7,.95]){const [x,y,d]=at(u);bits(fx,o.id,x,y,2,d,.8);}
  },
 });

 /* ---------- where the blow lands ---------- */
 const lightOf=(R,crit,reach=200)=>({colour:R.lit,reach:crit?reach*1.3:reach,head:110,h:26,peak:crit?1.15:.85,env:p=>p<.06?p/.06:Math.pow(1-p,1.7)});
 FX.recipe('rune:emberbite',{
  hit(o,fx){
   const R=RUNES.emberbite,r=o.r||18,x=o.x,y=o.y-r*.6,crit=!!o.crit,k=crit?1.35:1,F=o.y+r*.55;
   fx.spawn({life:.55,layer:'glow',reach:120,light:lightOf(R,crit),draw(g,e,p,H){
    const q=E.out(p/.35),fade=Math.pow(1-p,1.3);
    H.haze(g,x,y-10*p,(22+30*q)*k,'255,96,18',fade*.9);   /* the edge's coal bursts into flame */
    H.glow(g,x,y,(16+12*q)*k,R.c,fade);
    for(let i=0;i<5;i++){const a=-PI/2+(i-2)*.42,L=(14+26*q)*k*(1-Math.abs(i-2)*.15);H.streak(g,x,y,x+Math.cos(a)*L,y+Math.sin(a)*L*1.2,4.5*k*(1-p),R.c,fade);}
    if(p<.2)H.flare(g,x,y,34*k,R.hot,1-p/.2,.3);
   }},{x,y});
   fx.spawn({life:.7,layer:'ground',reach:60,draw(g,e,p,H){H.haze(g,x,F,(18+10*p)*k,'40,18,8',(1-p)*.45,.4,false);H.ring(g,x,F,(8+22*E.out(p))*k,2*(1-p),R.c,(1-p)*.8,.4);}},{x,y:F});
   bits(fx,'emberbite',x,y,crit?12:8,-PI/2,1.1);
   fx.emit({x,y:y-6,n:3,kind:'smoke',c:'70,52,44',speed:[10,30],life:[.6,1],size:[8,13],up:30,layer:'air'});
  },
  boltTick(b,dt,fx){if(Math.random()<dt*40)fx.emit({x:b.x,y:b.y,n:1,kind:'ember',c:'255,150,60',speed:[5,25],life:[.3,.55],size:[1.2,2.2],up:20,grav:-20,spread:2});},
 });
 FX.recipe('rune:frostgrip',{
  hit(o,fx){
   const R=RUNES.frostgrip,r=o.r||18,x=o.x,y=o.y-r*.6,crit=!!o.crit,k=crit?1.35:1,F=o.y+r*.55;
   fx.spawn({life:.6,layer:'glow',reach:120,light:lightOf(R,crit,180),draw(g,e,p,H){
    const q=E.out(p/.25),fade=p<.5?1:1-(p-.5)/.5;
    for(let i=0;i<7;i++){const a=i/7*TAU+.4+e.seed%1,L=(10+(i%2?14:24)*q)*k;H.streak(g,x+Math.cos(a)*4,y+Math.sin(a)*4,x+Math.cos(a)*L,y+Math.sin(a)*L,(i%2?3:4.4)*k,'200,240,255',fade*.95);}   /* ice cracks out of it */
    H.glow(g,x,y,(14+10*q)*k,R.c,fade*.85);
    if(p<.18)H.flare(g,x,y,30*k,'255,255,255',1-p/.18,.8);
   }},{x,y});
   fx.spawn({life:.9,layer:'ground',reach:60,draw(g,e,p,H){H.ring(g,x,F,(10+24*E.out(p/.5))*k,1.8,'200,240,255',(1-p)*.8,.4);H.haze(g,x,F,22*k,'170,225,255',(1-p)*.5,.4);}},{x,y:F});
   bits(fx,'frostgrip',x,y,crit?10:7,null,1.1);
   fx.emit({x,y,n:3,kind:'smoke',c:'200,230,245',speed:[8,24],life:[.6,1],size:[8,12],grav:-6,layer:'air'});
  },
  boltTick(b,dt,fx){if(Math.random()<dt*30)fx.emit({x:b.x,y:b.y,n:1,kind:'mote',c:'210,245,255',speed:[4,16],life:[.35,.6],size:[1,1.8],grav:30,spread:2});},
 });
 FX.recipe('rune:veinseeker',{
  hit(o,fx){
   const R=RUNES.veinseeker,r=o.r||18,x=o.x,y=o.y-r*.6,crit=!!o.crit,k=crit?1.35:1,to=typeof o.to==='function'?o.to:null;
   fx.spawn({life:.4,layer:'glow',reach:90,light:lightOf(R,crit,150),draw(g,e,p,H){
    const fade=Math.pow(1-p,1.4);H.glow(g,x,y,(14+14*E.out(p))*k,R.c,fade*.9);H.ring(g,x,y,(8+20*E.out(p))*k,2.2*(1-p),R.hot,fade*.8,1);
   }},{x,y});
   bits(fx,'veinseeker',x,y,crit?11:7,o.x>=(o.sx??o.x-1)?0:PI,1.1);
   /* the hungry edge draws the blood home: beads of red light run from the wound to the hero */
   if(to)fx.spawn({life:.75,layer:'glow',reach:400,draw(g,e,p,H){
    const h=to();if(!h)return;const mx=(x+h.x)/2,my=Math.min(y,h.y)-46;
    for(let i=0;i<6;i++){const u=E.inOut(E.clamp01(p*1.6-i*.11));if(u<=0||u>=1)continue;
     const a=1-u,bx=(a*a)*x+2*a*u*mx+u*u*h.x,by=(a*a)*y+2*a*u*my+u*u*h.y;H.glow(g,bx,by,5+2*Math.sin(i),R.c,.9*Math.sin(PI*u));H.glow(g,bx,by,2.4,R.hot,.8*Math.sin(PI*u));}
    if(p>.55){const q=(p-.55)/.45;H.glow(g,h.x,h.y,16*(1-q)+6,R.c,(1-q)*.7);}
   }},{x,y});
  },
  boltTick(b,dt,fx){if(Math.random()<dt*24)fx.emit({x:b.x,y:b.y,n:1,kind:'glow',draw:drop,speed:[4,20],life:[.3,.5],size:[1,1.6],grav:200,spread:2,layer:'air'});},
 });
 FX.recipe('rune:stormetch',{
  hit(o,fx){
   const R=RUNES.stormetch,r=o.r||18,x=o.x,y=o.y-r*.6,crit=!!o.crit,k=crit?1.3:1,F=o.y+r*.55,near=(o.near||[]).slice(0,2);
   fx.spawn({life:.38,layer:'glow',reach:220,light:lightOf(R,crit,220),draw(g,e,p,H){
    const rnd=H.rng(e.seed+Math.floor(e.t*30)),fade=p<.4?1:1-(p-.4)/.6;
    if(p<.55){const sx=x+(rnd()-.5)*30,pts=H.jag(sx,y-150,x,y,9,14,rnd);H.line(g,pts,3*k,R.c,fade);H.line(g,H.jag(sx,y-150,x,y,7,20,rnd),1.2,R.hot,fade*.7);}   /* the rune calls it down */
    for(const n of near){const ny=n.y-(n.r||16)*.6;H.line(g,H.jag(x,y,n.x,ny,7,12,rnd),2*k,R.c,fade*.9);H.glow(g,n.x,ny,14,R.c,fade*.8);}   /* and it leaps on */
    H.glow(g,x,y,(18+10*E.out(p))*k,R.c,fade);
    if(p<.2)H.flare(g,x,y,36*k,R.hot,1-p/.2,rnd()*PI);
   }},{x,y});
   fx.spawn({life:.5,layer:'ground',reach:70,draw(g,e,p,H){H.ring(g,x,F,(10+28*E.out(p))*k,2*(1-p),R.c,(1-p)*.9,.4);}},{x,y:F});
   bits(fx,'stormetch',x,y,crit?10:7,null,1.1);
  },
  boltTick(b,dt,fx){if(Math.random()<dt*30)fx.emit({x:b.x,y:b.y,n:1,kind:'spark',c:'225,205,255',speed:[60,140],life:[.08,.16],size:[1,1.8],drag:4});},
 });
 FX.recipe('rune:goldrune',{
  hit(o,fx){
   const R=RUNES.goldrune,r=o.r||18,x=o.x,y=o.y-r*.6,crit=!!o.crit,k=crit?1.35:1,F=o.y+r*.55;
   fx.spawn({life:.55,layer:'glow',reach:110,light:lightOf(R,crit,190),draw(g,e,p,H){
    const q=E.out(p/.4),fade=Math.pow(1-p,1.2);
    H.flare(g,x,y,(30+16*q)*k,R.hot,fade,PI/4*q);   /* it rings like struck gold */
    H.glow(g,x,y,(14+10*q)*k,R.c,fade*.9);
    H.ring(g,x,y,(8+26*q)*k,2.4*(1-p),R.c,fade*.85,1);
   }},{x,y});
   fx.spawn({life:.6,layer:'ground',reach:60,draw(g,e,p,H){H.haze(g,x,F,(16+12*p)*k,R.c,(1-p)*.45,.4);}},{x,y:F});
   bits(fx,'goldrune',x,y,crit?11:8,-PI/2,1.1);
  },
  boltTick(b,dt,fx){if(Math.random()<dt*24)fx.emit({x:b.x,y:b.y,n:1,kind:'glow',draw:glint,c:'255,215,106',speed:[4,16],life:[.3,.55],size:[1,1.6],spin:[-4,4]});},
 });
 globalThis.RUNE_FX=Object.freeze(Object.keys(RUNES));
})();
