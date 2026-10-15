/* ✨ THE COW RUN'S LOOK (2026-10-15, "gör effekterna från sakerna man får coolare inspo från den jag har redan"). The run's weapons,
   its level-ups, chests and legendaries drawn with the spell effects' own tools (assets/fx/spell-fx.js: glow, flare, haze, rings,
   rune circles, crescents, lightning, beams and the particle pool), so they read like the class spells. Two halves:
   recipes 'cow:*' for what flashes once (SpellFx.cast / SpellFx.hit), and CowFx.ground/air/glow for what the run keeps on screen -
   Consecration's circle, the axes' and the glaives' trails, the shots - which game.js calls with the run's state every frame.
   Nothing here reads or writes game state. */
(function(root){
 'use strict';
 const FX=root.SpellFx;if(!FX)return;
 const TAU=Math.PI*2,FLAT=.5;
 const C={gold:'255,214,120',sun:'255,236,170',holy:'255,226,140',arcane:'201,160,255',violet:'160,110,255',storm:'130,200,255',
  ice:'170,225,255',frost:'120,190,255',fel:'140,255,90',felDark:'60,200,40',steel:'235,235,245',ember:'255,150,70',blue:'90,200,255',orb:'70,140,255',white:'255,255,255'};
 const cl=v=>v<0?0:v>1?1:v;
 /* a short budget of hit flashes per second, so a herd cut down by Consecration does not drown the screen */
 let budget=0,budgetT=0;
 const spend=n=>{const now=performance.now();if(now-budgetT>100){budgetT=now;budget=6;}if(budget<n)return false;budget-=n;return true;};

 /* ---- what flashes once ---- */
 /* the axes bite: a steel slash across the cow and a spray of sparks */
 FX.recipe('cow:axehit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6,a0=Math.random()*TAU;
  fx.spawn({life:.22,layer:'glow',draw(g,e,p,H){H.crescent(g,e.x,cy,o.r*.9,a0,a0+2.2,7,C.ember,1-p,{lead:H.E.out(p*1.6),flat:.7});}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:o.crit?7:4,kind:'spark',speed:[90,200],life:[.15,.3],size:[1.1,1.8],c:C.ember,drag:3,grav:240});
 }});
 /* an arcane missile lands: a violet star and glass splinters */
 FX.recipe('cow:bolthit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6;
  fx.spawn({life:.3,layer:'glow',draw(g,e,p,H){const a=1-H.E.out(p);H.glow(g,e.x,cy,14+16*p,C.arcane,a*.9);H.flare(g,e.x,cy,22+20*H.E.out(p)*(o.crit?1.4:1),C.violet,a,p*.8);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:5,kind:'shard',speed:[60,150],life:[.25,.45],size:[1.6,2.6],c:C.arcane,drag:3.2,grav:160});
 }});
 /* the missiles leave the hero: a little violet sigil at his chest */
 FX.recipe('cow:boltcast',{cast(o,fx){
  fx.spawn({life:.28,layer:'glow',draw(g,e,p,H){const a=1-p;H.runes(g,e.x,e.y-22,10+8*H.E.out(p),C.arcane,a*.9,{flat:1,ticks:8,star:5,rot:p*2,w:1.1});}},{x:o.x,y:o.y,follow:o.follow});
 }});
 /* Storm Chain: the bolt's jagged path from the hero through every cow it leapt to, a flash at each, and a crackle */
 FX.recipe('cow:chain',{cast(o,fx){
  const pts=o.pts||[];if(pts.length<2)return;
  const segs=[];for(let i=1;i<pts.length;i++)segs.push(FX.H.jag(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],7,14));
  fx.spawn({life:.32,layer:'glow',reach:600,draw(g,e,p,H){
   const a=p<.15?1:1-H.E.in((p-.15)/.85);
   for(const s of segs)H.line(g,s,2.6,C.storm,a);
   if(p<.5)for(const s of segs)H.line(g,H.jag(s[0][0],s[0][1],s[s.length-1][0],s[s.length-1][1],5,9),1.2,C.white,(.5-p)*1.6);
   pts.forEach(([x,y],i)=>{if(i)H.flare(g,x,y,18+10*(1-p),C.storm,a,p+i);H.glow(g,x,y,12,C.storm,a*.7);});
  }},{x:pts[0][0],y:pts[0][1]});
  for(const [x,y] of pts.slice(1))fx.emit({x,y,n:3,kind:'spark',speed:[80,180],life:[.12,.25],size:[1,1.6],c:C.storm,drag:3,grav:120});
 }});
 /* Consecration's pulse: a gold ring runs out over the holy ground and motes rise */
 FX.recipe('cow:aura',{cast(o,fx){
  const R=o.rad;
  fx.spawn({life:.45,layer:'ground',reach:R+20,draw(g,e,p,H){const a=1-H.E.in(p);H.ring(g,e.x,e.y+6,R*(.35+.65*H.E.out(p)),2.4,C.holy,a*.55,FLAT);}},{x:o.x,y:o.y,follow:o.follow});
  fx.emit({x:o.x,y:o.y+4,n:6,kind:'mote',spread:R*.7,flat:FLAT,speed:[6,20],angle:[-Math.PI*.8,-Math.PI*.2],life:[.6,1],size:[1.2,2],c:C.sun,grav:-40,drag:1});
 }});
 /* holy light flares on a cow the ground burns */
 FX.recipe('cow:aurahit',{hit(o,fx){
  if(!spend(1))return;
  const foot=o.y+4;
  fx.spawn({life:.3,layer:'glow',draw(g,e,p,H){const a=Math.pow(1-p,1.5);H.beam(g,e.x,foot-o.r-18,foot+2,(o.r+6)*(1-p*.4),C.holy,a*.5);H.glow(g,e.x,foot,o.r+6,C.holy,a*.5,.42);}},{x:o.x,y:o.y});
 }});
 /* knives: a silver glint where one lands */
 FX.recipe('cow:knifehit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6;
  fx.spawn({life:.16,layer:'glow',draw(g,e,p,H){H.flare(g,e.x,cy,16*(1-p)+6,C.steel,1-p,.7);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:3,kind:'spark',speed:[70,160],life:[.12,.22],size:[.9,1.4],c:C.steel,drag:3,grav:200});
 }});
 /* Frostseeker sends its shards: an ice circle turns under the hero and frost breathes off him */
 FX.recipe('cow:frostcast',{cast(o,fx){
  fx.spawn({life:.5,layer:'ground',reach:120,draw(g,e,p,H){const a=H.E.fade(p,.12,.5);H.runes(g,e.x,e.y+6,52+18*H.E.out(p),C.ice,a*.85,{rot:p*1.4,star:6,ticks:18,w:1.6});H.haze(g,e.x,e.y+6,70,C.frost,a*.3,FLAT);}},{x:o.x,y:o.y,follow:o.follow});
  fx.spawn({life:.3,layer:'glow',draw(g,e,p,H){const a=1-p;H.flare(g,e.x,e.y-24,30+30*H.E.out(p),C.ice,a,p);H.glow(g,e.x,e.y-24,22,C.white,a*.6);}},{x:o.x,y:o.y,follow:o.follow});
  fx.emit({x:o.x,y:o.y-20,n:10,kind:'shard',speed:[80,200],life:[.3,.6],size:[1.6,2.8],c:C.ice,drag:2.6,grav:90});
 }});
 FX.recipe('cow:frosthit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6;
  fx.spawn({life:.4,layer:'glow',draw(g,e,p,H){const a=1-H.E.out(p);H.glow(g,e.x,cy,o.r+10,C.frost,a*.6);H.flare(g,e.x,cy,(o.r+16)*(o.crit?1.4:1),C.ice,a,p*.5);}},{x:o.x,y:o.y});
  fx.spawn({life:.6,layer:'ground',draw(g,e,p,H){H.ring(g,e.x,o.y+4,o.r+6,1.6,C.ice,(1-p)*.6,FLAT);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:4,kind:'shard',speed:[50,130],life:[.3,.5],size:[1.4,2.2],c:C.ice,drag:3,grav:200});
 }});
 /* the Fel Glaives cut: a green crescent and fel embers */
 FX.recipe('cow:felhit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6,a0=Math.random()*TAU;
  fx.spawn({life:.28,layer:'glow',draw(g,e,p,H){const a=1-p;H.crescent(g,e.x,cy,o.r*1.1,a0,a0+2.8,9,C.fel,a,{lead:H.E.out(p*1.5),flat:.75});H.glow(g,e.x,cy,o.r,C.felDark,a*.5);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:o.crit?6:3,kind:'ember',speed:[40,110],life:[.3,.6],size:[1.3,2.2],c:C.fel,drag:2,grav:-60});
 }});
 /* a level: a column of gold light on the hero, a ring at his feet and motes up the beam */
 FX.recipe('cow:levelup',{cast(o,fx){
  fx.spawn({life:1.1,layer:'glow',reach:200,light:{colour:C.gold,reach:260,head:200,h:40,peak:1},draw(g,e,p,H){
   const a=H.E.fade(p,.08,.45),y=e.y+6;
   H.beam(g,e.x,y-260,y,70*(1-p*.5),C.gold,a*.8);
   H.ring(g,e.x,y,40+70*H.E.out(p),3,C.sun,a,FLAT);
   H.runes(g,e.x,y,58,C.gold,a*.8,{rot:p*2,star:5,ticks:20,w:1.8});
   H.flare(g,e.x,e.y-30,40+40*H.E.out(p),C.sun,a,p);
  }},{x:o.x,y:o.y,follow:o.follow});
  fx.emit({x:o.x,y:o.y,n:26,kind:'mote',spread:30,speed:[20,60],angle:[-Math.PI*.7,-Math.PI*.3],life:[.8,1.3],size:[1.4,2.6],c:C.sun,grav:-120,drag:.8});
 }});
 /* a chest bought: a blue pillar out of it and coins of light */
 FX.recipe('cow:chest',{cast(o,fx){
  fx.spawn({life:1,layer:'glow',reach:200,light:{colour:C.blue,reach:240,head:180,h:30,peak:1},draw(g,e,p,H){
   const a=H.E.fade(p,.06,.4);H.beam(g,e.x,e.y-300,e.y,80*(1-p*.4),C.blue,a*.8);H.flare(g,e.x,e.y-20,50+40*H.E.out(p),C.blue,a,p*.7);H.ring(g,e.x,e.y+4,30+90*H.E.out(p),3,C.blue,a,FLAT);
  }},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:o.y-14,n:22,kind:'spark',speed:[120,280],angle:[-Math.PI*.95,-Math.PI*.05],life:[.4,.8],size:[1.4,2.4],c:C.gold,drag:1.6,grav:320});
 }});
 /* a legendary taken: its colour bursts out in a great star over a turning circle */
 FX.recipe('cow:legend',{cast(o,fx){
  const c=o.legend==='felglaives'?C.fel:C.ice;
  fx.spawn({life:1.6,layer:'glow',reach:260,light:{colour:c,reach:340,head:240,h:40,peak:1},draw(g,e,p,H){
   const a=H.E.fade(p,.05,.5),y=e.y+6;
   H.beam(g,e.x,y-340,y,110*(1-p*.5),c,a*.9);
   H.runes(g,e.x,y,90+20*H.E.out(p),c,a,{rot:p*3,star:8,ticks:24,w:2.2});
   H.flare(g,e.x,e.y-30,80+80*H.E.out(p),c,a,p*1.5);H.flare(g,e.x,e.y-30,50,C.gold,a*.8,-p);
  }},{x:o.x,y:o.y,follow:o.follow});
  fx.emit({x:o.x,y:o.y-20,n:40,kind:o.legend==='felglaives'?'ember':'shard',speed:[120,320],life:[.6,1.2],size:[1.6,3],c,drag:1.8,grav:60});
  fx.shake(.25);
 }});

 /* Meteor Storm: the rock bursts where it lands - a fire flash, a ring of flame over the ground, embers and smoke */
 FX.recipe('cow:meteor',{cast(o,fx){
  const R=o.rad||90;
  fx.spawn({life:.5,layer:'glow',reach:R+40,light:{colour:C.ember,reach:R*2.6,head:160,h:20,peak:1},draw(g,e,p,H){
   const a=1-H.E.out(p);H.glow(g,e.x,e.y-10,R*.7*(.6+.6*p),C.ember,a);H.flare(g,e.x,e.y-14,R*(.7+.5*H.E.out(p)),'255,200,120',a,p);
  }},{x:o.x,y:o.y});
  fx.spawn({life:.6,layer:'ground',reach:R+20,draw(g,e,p,H){const a=1-H.E.in(p);H.haze(g,e.x,e.y,R*1.1,C.ember,a*.45,FLAT);H.ring(g,e.x,e.y,R*(.3+.7*H.E.out(p)),4,C.ember,a,FLAT);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:o.y-8,n:14,kind:'ember',speed:[80,220],angle:[-Math.PI,0],life:[.4,.8],size:[1.4,2.6],c:C.ember,drag:2,grav:180});
  fx.emit({x:o.x,y:o.y-6,n:5,kind:'smoke',speed:[20,50],angle:[-Math.PI,0],life:[.7,1.1],size:[10,18],c:'70,60,55',drag:1.5,grav:-30,grow:1.4});
 }});
 /* Cleaving Arc: a wide steel sweep the way the hero faces */
 FX.recipe('cow:cleave',{cast(o,fx){
  const a0=o.a-o.arc/2,a1=o.a+o.arc/2;
  fx.spawn({life:.28,layer:'glow',reach:o.rad+30,draw(g,e,p,H){
   const a=1-H.E.in(p);
   H.crescent(g,e.x,e.y,o.rad*.82,a0,a1,22,C.steel,a,{lead:H.E.out(p*1.8),flat:.8});
   H.crescent(g,e.x,e.y,o.rad*.6,a0+.15,a1-.15,9,'255,220,160',a*.7,{lead:H.E.out(p*1.6),flat:.8});
  }},{x:o.x,y:o.y});
 }});
 /* Plague Cloud: a green puff where the poison bites */
 FX.recipe('cow:plaguehit',{hit(o,fx){
  if(!spend(1))return;
  fx.emit({x:o.x,y:o.y-o.r*.5,n:2,kind:'mote',speed:[10,30],angle:[-Math.PI*.8,-Math.PI*.2],life:[.4,.7],size:[1.4,2.2],c:'150,255,110',grav:-40,drag:1});
 }});
 /* Judgement: a pillar of gold from the sky onto the cow, and a star at its feet */
 FX.recipe('cow:judge',{cast(o,fx){
  const foot=o.y+4;
  fx.spawn({life:.55,layer:'glow',reach:120,light:{colour:C.gold,reach:220,head:200,h:40,peak:1},draw(g,e,p,H){
   const a=p<.12?p/.12:1-H.E.in((p-.12)/.88);
   H.beam(g,e.x,foot-360,foot,(o.r+22)*(1-p*.3),C.holy,a);
   H.flare(g,e.x,foot-o.r*.6,50+30*H.E.out(p),C.sun,a,p);
   H.ring(g,e.x,foot,o.r+10+40*H.E.out(p),2.6,C.gold,a,FLAT);
  }},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:foot-6,n:10,kind:'spark',speed:[90,200],angle:[-Math.PI*.95,-Math.PI*.05],life:[.25,.5],size:[1.2,2],c:C.sun,drag:2.6,grav:260});
 }});

 /* War Totem: planted with a thud of fire, then a burning ring runs out of it with every pulse */
 FX.recipe('cow:totemdrop',{cast(o,fx){
  fx.spawn({life:.45,layer:'glow',draw(g,e,p,H){const a=1-H.E.out(p);H.flare(g,e.x,e.y-40,40+30*H.E.out(p),C.ember,a,p);H.ring(g,e.x,e.y,20+50*H.E.out(p),3,C.ember,a,FLAT);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:o.y-4,n:10,kind:'dust',speed:[40,110],angle:[-Math.PI,0],life:[.4,.7],size:[6,10],flat:FLAT,drag:3});
 }});
 FX.recipe('cow:totempulse',{cast(o,fx){
  fx.spawn({life:.5,layer:'ground',reach:o.rad+20,draw(g,e,p,H){const a=1-H.E.in(p);H.ring(g,e.x,e.y,o.rad*(.2+.8*H.E.out(p)),3,C.ember,a*.75,FLAT);H.haze(g,e.x,e.y,o.rad*.9,C.ember,a*.18,FLAT);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:o.y-58,n:3,kind:'ember',spread:6,speed:[20,60],angle:[-Math.PI*.8,-Math.PI*.2],life:[.4,.8],size:[1.2,2],c:C.ember,grav:-50,drag:1});
 }});
 FX.recipe('cow:totemhit',{hit(o,fx){
  if(!spend(1))return;
  fx.emit({x:o.x,y:o.y-o.r*.4,n:2,kind:'ember',speed:[20,60],angle:[-Math.PI*.8,-Math.PI*.2],life:[.3,.6],size:[1.2,2],c:C.ember,grav:-60,drag:1.5});
 }});
 /* Storm Orb: a blue ball bursting on a cow */
 FX.recipe('cow:orbhit',{hit(o,fx){
  if(!spend(1))return;
  const cy=o.y-o.r*.6;
  fx.spawn({life:.3,layer:'glow',draw(g,e,p,H){const a=1-H.E.out(p);H.glow(g,e.x,cy,16+18*p,C.blue,a);H.flare(g,e.x,cy,(24+16*H.E.out(p))*(o.crit?1.4:1),C.storm,a,p);}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:cy,n:4,kind:'spark',speed:[70,160],life:[.15,.3],size:[1,1.6],c:C.blue,drag:3,grav:120});
 }});

 /* ---- what the run keeps on screen; s: {x,y (the hero's anchor), now, w (weapon levels), leg, axA, glA, shots, ws (weaponStats)} ---- */
 function ground(g,s){
  const H=FX.H;
  if(s.w.aura){
   const st=s.ws('aura',s.w.aura),pu=.75+.25*Math.sin(s.now*4);
   H.haze(g,s.x,s.y+6,st.rad,C.holy,.22*pu,FLAT,false);
   H.runes(g,s.x,s.y+6,st.rad,C.holy,.55*pu,{rot:s.now*.5,star:6,ticks:24,w:1.8});
  }
  if(s.leg&&s.leg.id==='frostseeker')H.runes(g,s.x,s.y+6,34,C.ice,.35+.1*Math.sin(s.now*3),{rot:-s.now*.8,star:6,ticks:12,w:1.1});
  for(const z of s.zones||[]){   /* the plague clouds: a sickly haze with a slow ring, fading at the end */
   const a=Math.min(1,z.t*3)*Math.min(1,(z.dur-z.t)*2);
   H.haze(g,z.x,z.y,z.rad*1.1,'90,200,60',.45*a,.7,false);
   H.haze(g,z.x+Math.sin(s.now*1.3+z.x)*8,z.y-6,z.rad*.7,'150,255,90',.3*a,.7);
   H.ring(g,z.x,z.y,z.rad*(.92+.05*Math.sin(s.now*3+z.y)),1.4,'140,255,90',.35*a,.7);
  }
  for(const b of s.bosses||[]){   /* an Alpha Bull's red ground, wider and hotter every tier */
   const k=Math.min(1,0.25+0.15*b.cowBoss),pu=.8+.2*Math.sin(s.now*5+b.x);
   H.haze(g,b.x,b.y+b.r*.5,b.r*(1.6+.25*b.cowBoss),'255,30,20',.35*k*pu,FLAT);
   H.ring(g,b.x,b.y+b.r*.5,b.r*(1.2+.1*b.cowBoss),2+b.cowBoss*.4,'255,40,30',.5*k*pu,FLAT);
  }
  for(const to of s.totems||[]){   /* the War Totem's ground: a slow burning rune circle that fades as it ends */
   const a=Math.min(1,to.t*4)*Math.min(1,(to.dur-to.t)*2);
   H.runes(g,to.x,to.y,s.totemRad,C.ember,.45*a,{rot:s.now*.4,star:5,ticks:20,w:1.5});
   H.haze(g,to.x,to.y,s.totemRad*.8,C.ember,.12*a,FLAT,false);
  }
  for(const m of s.meteors||[]){   /* where a meteor will land: a red ring closing in */
   if(m.t<0)continue;const k=Math.min(1,m.t/m.fall);
   H.ring(g,m.x,m.y,m.rad*(1.15-.4*k),1.8,'255,90,40',.25+.5*k,FLAT);
  }
 }
 function glow(g,s){
  const H=FX.H,hy=s.y-14;
  if(s.w.axes){   /* a fiery arc runs behind each axe as it circles */
   const st=s.ws('axes',s.w.axes);
   for(let i=0;i<st.n;i++){const a=s.axA+i*TAU/st.n;H.crescent(g,s.x,hy,st.rad,a-1.1,a,8,C.ember,.55,{flat:.8,taper:1.2});
    H.glow(g,s.x+Math.cos(a)*st.rad,hy+Math.sin(a)*st.rad*.8,16,C.ember,.4);}
  }
  if(s.leg&&s.leg.id==='felglaives'){   /* the glaives burn fel-green and leave a wide green wake */
   const st=s.ws('felglaives',s.leg.lvl);
   for(let i=0;i<st.n;i++){const a=s.glA+i*Math.PI;H.crescent(g,s.x,hy,st.rad,a-1.5,a,14,C.fel,.6,{flat:.8,taper:1.4});
    H.glow(g,s.x+Math.cos(a)*st.rad,hy+Math.sin(a)*st.rad*.8,30,C.fel,.55);}
  }
  for(const gm of s.gems||[]){   /* the XP gems shine through the night, and now and then one glints */
   const big=gm.v>=10,y=gm.y-6+Math.sin(s.now*4+gm.x*.05)*2.5,c=big?'125,255,176':'90,190,255';
   H.glow(g,gm.x,y,big?20:13,c,.55);
   const tw=Math.sin(s.now*2.3+gm.x*.13+gm.y*.07);if(tw>.85)H.flare(g,gm.x,y-4,(big?26:18)*(tw-.85)/.15,c,.9,s.now);
  }
  for(const m of s.meteors||[]){   /* the rock in its fall: a burning streak from high up and behind */
   if(m.t<0)continue;const k=Math.min(1,m.t/m.fall),hx=m.x+90*(1-k),hy=m.y-300*(1-k)-6;
   H.streak(g,hx+40,hy-130,hx,hy,10,C.ember,.9);H.glow(g,hx,hy,18,C.ember,1);H.glow(g,hx,hy,8,C.white,.8);
  }
  for(const b of s.bosses||[]){   /* and a red glow on its body, and its eyes */
   const k=Math.min(1,0.25+0.15*b.cowBoss);
   H.glow(g,b.x,b.y-b.r*1.2,b.r*(1.6+.2*b.cowBoss),'255,30,20',.35*k);
  }
  for(const to of s.totems||[]){   /* the totem itself: a dark post with a fire burning in its head */
   const a=Math.min(1,to.t*4)*Math.min(1,(to.dur-to.t)*2),top=to.y-62;
   g.save();g.globalAlpha=a;g.fillStyle='#3a2414';g.fillRect(to.x-6,top,12,62);g.fillStyle='#5a3a20';g.fillRect(to.x-9,top+8,18,8);g.fillRect(to.x-9,top+30,18,6);g.restore();
   H.glow(g,to.x,top,22+3*Math.sin(s.now*9+to.x),C.ember,a);H.glow(g,to.x,top,9,C.white,a*.7);
  }
  for(let i=0;i<(s.orbs||0);i++){   /* the Storm Orbs circling at the hero's shoulder */
   const a=s.orbA+i*Math.PI*2/s.orbs,ox=s.x+Math.cos(a)*34,oy=s.y-46+Math.sin(a)*12;
   H.glow(g,ox,oy,22,C.orb,1);H.glow(g,ox,oy,12,C.orb,1);H.glow(g,ox,oy,6,C.white,.9);
  }
  for(const b of s.shots){
   const sp=Math.hypot(b.vx||0,b.vy||0)||1,ux=(b.vx||0)/sp,uy=(b.vy||0)/sp;
   if(b.kind==='orb'){H.streak(g,b.x-ux*26,b.y-uy*26,b.x,b.y,9,C.orb,.9);H.glow(g,b.x,b.y,20,C.orb,1);H.glow(g,b.x,b.y,10,C.orb,1);H.glow(g,b.x,b.y,5,C.white,.9);}
   else if(b.kind==='bolt'){H.streak(g,b.x-ux*26,b.y-uy*26,b.x,b.y,6,C.arcane,.9);H.glow(g,b.x,b.y,14,C.arcane,.9);H.flare(g,b.x,b.y,14,C.violet,.7,s.now*6);}
   else if(b.kind==='shard'){H.streak(g,b.x-ux*30,b.y-uy*30,b.x,b.y,5,C.ice,.9);H.glow(g,b.x,b.y,10,C.ice,.8);}
   else{H.streak(g,b.x-ux*22,b.y-uy*22,b.x,b.y,3,C.steel,.85);}
  }
 }
 /* the trails a shot leaves (call from update, not from a draw) */
 function trail(b,dt){
  if(Math.random()>dt*30)return;
  const c=b.kind==='bolt'?C.arcane:b.kind==='orb'?C.blue:b.kind==='shard'?C.ice:null;if(!c)return;
  FX.emit({x:b.x,y:b.y,n:1,kind:b.kind==='shard'?'shard':'mote',speed:[5,20],life:[.2,.4],size:[1,1.8],c,drag:3});
 }
 root.CowFx={ground,glow,trail,C};
})(typeof globalThis!=='undefined'?globalThis:this);
