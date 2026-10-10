/* 🌳 The Skill Tree's looks (2026-10-10, asked for with the tree: "även effekten i spelet ska ändras hur den ser ut större osv
   eller laser"). SpellFx recipes for what a talent adds to the fight, set off by game.js's tree code (and by a peer's messages):
     'tree:beam:<style>'  cast - a laser along a line: x,y from, tx,ty to, w its width (styles holy, nature, arcane, ice)
     'tree:sweep'         cast - Arcane Beam: a violet beam turning from a0 to a1 over dur, from the hero (follow)
     'tree:blizzard' 'tree:frosttrap' 'tree:consecration' 'tree:sanctified' 'tree:burning'
                          cast - a patch of ground for dur: x,y its middle, r its reach
     'tree:meteor' 'tree:pillar'  cast - a meteor falling on x,y / a pillar of light: r the blast's reach
     'tree:shock' 'tree:roar'     cast - Thunderclap's shockwave / Taunting Roar's call, round the hero
     'tree:bomb'          cast - Living Bomb's glow on its foe (follow) for dur; 'tree:explode' hit - a burst of fire (r, big)
     'tree:block' 'tree:dodge' 'tree:stun' 'tree:lion' 'tree:angel' 'tree:iceblock'  cast - the moments of a talent
     'tree:crusader' 'tree:hawkstrike'  hit - a holy strike, the hawk's talons
     'tree:frostbolt' 'tree:icespike'   bolt + hit - the mage's frost bolts and Glacial Spike
     'tree:rain'          cast - arrows falling on the targets
   and auras (SpellFx.auras, keys from game.js treeAuraState): shield, wall, spin, embrace, wings, deter, undying, ice, enrage,
   avatar, bear, owl. Looks only: every number is game.js's. Painted parts (assets/tree/fx) are drawn when they have loaded. */
(function(){
 'use strict';
 const FX=globalThis.SpellFx;if(!FX)return;
 const H=FX.H,E=H.E,TAU=Math.PI*2,PI=Math.PI,cl=E.clamp01;
 const img=src=>{if(typeof Image==='undefined')return null;const i=new Image();i.src=src;return i;};
 const ready=i=>i&&i.complete&&i.naturalWidth>0;
 const ART={lion:img('assets/tree/fx/lion.png'),wings:img('assets/tree/fx/wings.png'),ice:img('assets/tree/fx/iceblock.png')};
 const STYLE={
  holy:{c:'255,226,140',hot:'255,250,226',deep:'230,170,60',lit:'255,226,150'},
  nature:{c:'214,240,140',hot:'250,255,220',deep:'140,190,60',lit:'220,240,160'},
  arcane:{c:'190,130,255',hot:'240,226,255',deep:'120,60,210',lit:'190,140,255'},
  ice:{c:'150,215,255',hot:'235,250,255',deep:'70,140,210',lit:'170,220,255'},
  fire:{c:'255,140,60',hot:'255,226,160',deep:'200,60,20',lit:'255,150,60'},
  thunder:{c:'170,200,255',hot:'240,246,255',deep:'90,120,220',lit:'180,210,255'},
  blood:{c:'230,60,60',hot:'255,190,170',deep:'140,20,20',lit:'240,90,70'},
 };
 const FLAT=.45;
 /* ---- a laser: a hot core and a wide glow along the line, motes shed along it, a flare at the hero's end ---- */
 function beamDraw(g,x,y,tx,ty,w,S,a){
  H.line(g,[[x,y],[tx,ty]],w*1.9,S.deep,a*.35);
  H.line(g,[[x,y],[tx,ty]],w,S.c,a);
  H.line(g,[[x,y],[tx,ty]],Math.max(1.5,w*.35),S.hot,a);
 }
 for(const style of ['holy','nature','arcane','ice']){
  const S=STYLE[style];
  FX.recipe('tree:beam:'+style,{cast(o,fx){
   const x=o.x,y=o.y-(o.peer?10:0),tx=o.tx??x+300,ty=o.ty??y,w=(o.w||24)*.55*(o.k||1);
   fx.spawn({life:style==='ice'?.32:.42,layer:'glow',reach:400,light:{colour:S.lit,reach:220,head:120,h:20,peak:.9,env:p=>Math.pow(1-p,1.4)},
    draw(g,e,p,H){
     const a=p<.08?p/.08:Math.pow(1-p,1.3),grow=E.out(Math.min(1,p/.12));
     beamDraw(g,x,y,x+(tx-x)*grow,y+(ty-y)*grow,w*(1-.4*p),S,a);
     H.flare(g,x,y,28,S.hot,a*.9,Math.atan2(ty-y,tx-x));
     H.glow(g,x+(tx-x)*grow,y+(ty-y)*grow,16,S.c,a*.8);
    }},{x,y,delay:o.delay||0});
   const n=8;for(let i=0;i<n;i++){const u=(i+.5)/n;fx.emit({x:x+(tx-x)*u,y:y+(ty-y)*u,n:1,kind:'mote',c:S.hot,speed:[10,40],life:[.3,.6],size:[1.2,2.2],spread:6});}
  }});
 }
 /* ---- Arcane Beam: the beam turns across the foes in front of the mage ---- */
 FX.recipe('tree:sweep',{cast(o,fx){
  const S=STYLE.arcane,len=o.len||260,w=(o.w||30)*.6,dur=o.dur||2;
  let a0=o.a0,a1=o.a1;if(a0===undefined){const a=Math.atan2((o.ty??o.y)-o.y,(o.tx??o.x+1)-o.x);a0=a-.6;a1=a+.6;}
  fx.spawn({life:dur,layer:'glow',reach:len+40,light:{colour:S.lit,reach:260,head:150,h:24,peak:1,env:p=>E.fade(p,.06,.85)},
   update(e,dt,fx){e.acc=(e.acc||0)+dt;if(e.acc>.05){e.acc=0;const a=a0+(a1-a0)*Math.min(1,e.t/dur);fx.emit({x:e.x+Math.cos(a)*len*Math.random(),y:e.y+Math.sin(a)*len*Math.random(),n:2,kind:'spark',c:S.hot,speed:[40,120],life:[.15,.3],size:[1,1.8],drag:3});}},
   draw(g,e,p,H){
    const a=a0+(a1-a0)*Math.min(1,e.t/dur),al=E.fade(p,.06,.85),ux=Math.cos(a),uy=Math.sin(a);
    beamDraw(g,e.x,e.y,e.x+ux*len,e.y+uy*len,w*(.9+.1*Math.sin(e.t*40)),S,al);
    H.glow(g,e.x,e.y,22,S.c,al);H.flare(g,e.x,e.y,34,S.hot,al*.8,a);
    H.runes(g,e.x,e.y+12,26,S.c,al*.6,{rot:e.t*3,star:6,w:1.2,flat:.5});
   }},{x:o.x,y:o.y,follow:o.follow});
 }});
 /* ---- patches of ground ---- */
 function zone(id,make){FX.recipe(id,{cast(o,fx){const r=o.r||o.rad||100,dur=o.dur||4;   /* a peer's frost traps lie under their targets */
  if(o.peer&&id==='tree:frosttrap'&&o.targets&&o.targets.length){for(const t of o.targets)make({...o,x:t.x,y:t.y},fx,60,dur);return;}
  make(o,fx,r,dur);}});}
 zone('tree:blizzard',(o,fx,r,dur)=>{
  const S=STYLE.ice;if(o.peer&&o.tx!=null){o={...o,x:o.tx,y:o.ty};}   /* a peer's blizzard lies over their target */
  fx.spawn({life:dur,layer:'ground',reach:r+30,draw(g,e,p,H){
   const a=E.fade(p,.08,.82);H.haze(g,e.x,e.y,r*1.05,'170,215,255',a*.45,FLAT);
   H.runes(g,e.x,e.y,r*.92,S.c,a*.55,{rot:e.t*.6,ticks:20,star:0,w:1.1,flat:FLAT});
   H.ring(g,e.x,e.y,r,1.6,S.hot,a*.5,FLAT);
  }},{x:o.x,y:o.y});
  fx.spawn({life:dur,layer:'air',reach:r+60,update(e,dt,fx){e.acc=(e.acc||0)+dt;
    if(e.acc>.03&&e.t<dur-.4){e.acc=0;const a=Math.random()*TAU,d=Math.sqrt(Math.random())*r;
     fx.emit({x:e.x+Math.cos(a)*d+30,y:e.y+Math.sin(a)*d*FLAT-150,n:1,kind:'shard',c:'210,240,255',speed:[220,300],angle:[1.85,2.05],life:[.45,.6],size:[1.6,3],drag:.3,layer:'air'});}},
   draw(g,e,p,H){const a=E.fade(p,.08,.82);H.haze(g,e.x,e.y-70,r*.9,'215,235,250',a*.3,.5,false);}},{x:o.x,y:o.y});
 });
 zone('tree:frosttrap',(o,fx,r,dur)=>{
  const S=STYLE.ice;
  fx.spawn({life:dur,layer:'ground',reach:r+20,draw(g,e,p,H){
   const a=E.fade(p,.1,.8),q=E.back(Math.min(1,e.t/.25));
   H.haze(g,e.x,e.y,r*q,S.c,a*.5,FLAT);H.ring(g,e.x,e.y,r*q,2,S.hot,a*.8,FLAT);
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=a*.8;g.fillStyle='rgba(220,245,255,.9)';
   for(let i=0;i<9;i++){const t=i/9*TAU+e.seed%3,px=e.x+Math.cos(t)*r*.7*q,py=e.y+Math.sin(t)*r*.7*q*FLAT,h=9+((i*7)%5);g.beginPath();g.moveTo(px-3,py);g.lineTo(px,py-h);g.lineTo(px+3,py);g.closePath();g.fill();}
   g.restore();
  }},{x:o.x,y:o.y});
 });
 zone('tree:consecration',(o,fx,r,dur)=>{
  const S=STYLE.holy;
  fx.spawn({life:dur,layer:'ground',reach:r+20,update(e,dt,fx){e.acc=(e.acc||0)+dt;if(e.acc>.06&&e.t<dur-.3){e.acc=0;const a=Math.random()*TAU,d=Math.sqrt(Math.random())*r;fx.emit({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d*FLAT,n:1,kind:'ember',c:'255,210,120',speed:[5,20],up:40,grav:-30,life:[.5,.9],size:[1.4,2.6]});}},
   draw(g,e,p,H){const a=E.fade(p,.08,.82),f=.85+.15*Math.sin(e.t*9);
    H.haze(g,e.x,e.y,r,'255,190,90',a*.55*f,FLAT);H.runes(g,e.x,e.y,r*.85,S.c,a*.75,{rot:-e.t*.5,star:8,w:1.3,flat:FLAT});H.ring(g,e.x,e.y,r,2,S.hot,a*.7,FLAT);}},{x:o.x,y:o.y});
 });
 zone('tree:sanctified',(o,fx,r,dur)=>{
  const S=STYLE.holy;
  fx.spawn({life:dur,layer:'ground',reach:r+20,update(e,dt,fx){e.acc=(e.acc||0)+dt;if(e.acc>.12&&e.t<dur-.3){e.acc=0;const a=Math.random()*TAU,d=Math.sqrt(Math.random())*r;fx.emit({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d*FLAT,n:1,kind:'mote',c:'255,250,220',speed:[4,14],up:26,grav:-10,life:[.8,1.3],size:[1.2,2]});}},
   draw(g,e,p,H){const a=E.fade(p,.08,.82);H.haze(g,e.x,e.y,r,'255,244,200',a*.4,FLAT);H.runes(g,e.x,e.y,r*.8,'255,250,226',a*.6,{rot:e.t*.4,star:6,w:1.1,flat:FLAT});}},{x:o.x,y:o.y});
 });
 zone('tree:burning',(o,fx,r,dur)=>{
  fx.spawn({life:dur,layer:'ground',reach:r+20,update(e,dt,fx){e.acc=(e.acc||0)+dt;if(e.acc>.05&&e.t<dur-.3){e.acc=0;const a=Math.random()*TAU,d=Math.sqrt(Math.random())*r;fx.emit({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d*FLAT,n:1,kind:'ember',c:Math.random()<.5?'255,150,60':'255,210,120',speed:[5,25],up:45,grav:-40,life:[.4,.8],size:[1.6,3]});
    if(Math.random()<.3)fx.emit({x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d*FLAT,n:1,kind:'smoke',c:'60,50,46',speed:[4,12],up:20,life:[.8,1.3],size:[6,10],grow:1.6,layer:'air',alpha:.6});}},
   draw(g,e,p,H){const a=E.fade(p,.05,.7),f=.8+.2*Math.sin(e.t*13);H.haze(g,e.x,e.y,r,'255,120,40',a*.5*f,FLAT);H.haze(g,e.x,e.y,r*.55,'90,30,10',a*.6,FLAT,false);}},{x:o.x,y:o.y});
 });
 /* ---- Meteor: it falls out of the sky behind and above, and bursts ---- */
 FX.recipe('tree:meteor',{cast(o,fx){
  const S=STYLE.fire,r=o.r||150,x=o.tx??o.x,y=o.ty??o.y,sx=x+240,sy=y-560,FALL=.52;
  fx.spawn({life:FALL+.9,layer:'glow',reach:r+600,light:{colour:S.lit,reach:r*2.4,head:r*1.4,h:60,peak:1.4,env:p=>{const t=p*(FALL+.9);return t<FALL?.3+.7*t/FALL:Math.pow(1-(t-FALL)/.9,1.4)}},
   update(e,dt,fx){
    const t=e.t;
    if(t<FALL){e.acc=(e.acc||0)+dt;if(e.acc>.02){e.acc=0;const k=E.in(t/FALL),mx=sx+(x-sx)*k,my=sy+(y-sy)*k;fx.emit({x:mx,y:my,n:2,kind:'ember',c:'255,190,90',speed:[20,80],life:[.3,.6],size:[2,3.5],drag:2});fx.emit({x:mx,y:my,n:1,kind:'smoke',c:'60,50,46',speed:[5,15],life:[.6,1],size:[8,12],grow:1.5,layer:'air',alpha:.7});}}
    else if(!e.boom){e.boom=1;fx.shake(.4);
     fx.emit({x,y,n:40,kind:'spark',c:'255,200,110',speed:[160,420],life:[.25,.55],size:[1.6,2.6],drag:3,flat:.6});
     fx.emit({x,y,n:16,kind:'ember',c:'255,150,60',speed:[60,200],up:120,grav:260,life:[.6,1.1],size:[2,4]});
     fx.emit({x,y,n:12,kind:'smoke',c:'70,58,52',speed:[30,90],up:40,life:[1,1.6],size:[12,20],grow:1.6,layer:'air',alpha:.75});
     fx.emit({x,y,n:12,kind:'dust',speed:[60,180],flat:.4,life:[.6,1],size:[8,14],layer:'air'});}
   },
   draw(g,e,p,H){
    const t=e.t;
    if(t<FALL){const k=E.in(t/FALL),mx=sx+(x-sx)*k,my=sy+(y-sy)*k;
     H.streak(g,mx+(sx-x)*.12,my+(sy-y)*.12,mx,my,22,S.c,.85);H.glow(g,mx,my,40,S.c,.95);H.glow(g,mx,my,18,S.hot,1);
     H.haze(g,x,y,r*.5*k,'255,120,40',.25*k,FLAT);return;}
    const q=(t-FALL)/.9,b=E.out(Math.min(1,q/.25)),fade=Math.pow(1-q,1.3);
    H.glow(g,x,y-20,r*1.1*b,S.hot,fade*(q<.15?1:.6));H.haze(g,x,y,r*1.2*b,S.c,fade*.7,FLAT);
    H.ring(g,x,y,r*b*1.1,6*(1-q)+1,S.c,fade,FLAT);H.ring(g,x,y,r*.6*E.out(Math.min(1,q/.4)),3,S.hot,fade*.8,FLAT);
    H.flare(g,x,y-24,r*1.3,S.hot,Math.max(0,1-q*3),0);
   }},{x,y});
 }});
 /* ---- Wrath of Heaven: a pillar of light from the sky ---- */
 FX.recipe('tree:pillar',{cast(o,fx){
  const S=STYLE.holy,r=o.r||130,x=o.tx??o.x,y=o.ty??o.y;
  fx.spawn({life:1,layer:'glow',reach:r+700,light:{colour:S.lit,reach:r*2.2,head:r*1.4,h:80,peak:1.4,env:p=>p<.2?p/.2:Math.pow(1-(p-.2)/.8,1.3)},
   update(e,dt,fx){if(!e.boom&&e.t>.3){e.boom=1;fx.shake(.2);fx.emit({x,y,n:30,kind:'mote',c:S.hot,speed:[60,200],up:80,life:[.5,1],size:[1.4,2.6]});fx.emit({x,y,n:20,kind:'spark',c:S.c,speed:[120,300],flat:.6,life:[.2,.45],size:[1.4,2.2],drag:3});}},
   draw(g,e,p,H){
    const t=e.t,open=E.out(Math.min(1,t/.3)),a=t<.3?open:Math.pow(1-(t-.3)/.7,1.2),w=(r*.95)*(t<.3?.4+.6*open:1-(t-.3)*.6);
    H.beam(g,x,y-760,y+6,w,S.c,a);H.beam(g,x,y-760,y+6,w*.38,S.hot,a);
    H.haze(g,x,y,r*1.1*open,S.c,a*.6,FLAT);H.ring(g,x,y,r*E.out(Math.min(1,t/.45)),3,S.hot,a,FLAT);
    H.runes(g,x,y,r*.75,S.c,a*.8,{rot:t*2,star:8,w:1.4,flat:FLAT});
    if(t>.28&&t<.5)H.flare(g,x,y-30,r*1.4,S.hot,1-(t-.28)/.22,0);
   }},{x,y});
 }});
 /* ---- Thunderclap and the like: a shockwave on the ground, cracks running out ---- */
 FX.recipe('tree:shock',{cast(o,fx){
  const S=STYLE[o.style||'thunder'],r=o.r||o.rad||150,x=o.x,y=o.y+(o.gy||14),rnd=H.rng((Math.random()*1e9)|0),cracks=[];
  for(let i=0;i<9;i++){const a=i/9*TAU+rnd()*.4;cracks.push(H.jag(x,y,x+Math.cos(a)*r*.75,y+Math.sin(a)*r*.75*FLAT,6,10,rnd));}
  fx.spawn({life:.7,layer:'ground',reach:r+30,draw(g,e,p,H){
   const q=E.out(p),a=Math.pow(1-p,1.2);
   H.ring(g,x,y,r*q,6*(1-p)+1,S.c,a,FLAT);H.ring(g,x,y,r*.7*q,3,S.hot,a*.8,FLAT);H.haze(g,x,y,r*q,S.c,a*.35,FLAT);
   for(const c of cracks)H.line(g,c.slice(0,Math.max(2,Math.ceil(c.length*Math.min(1,p*3)))),1.6,S.hot,a*.9);
  }},{x,y:o.y});
  fx.emit({x,y,n:16,kind:'dust',speed:[80,220],flat:.4,life:[.5,.9],size:[7,12],layer:'air'});
  fx.emit({x,y:y-10,n:14,kind:'spark',c:S.hot,speed:[100,260],flat:.5,life:[.2,.4],size:[1.4,2.2],drag:3});
 }});
 FX.recipe('tree:roar',{cast(o,fx){
  const S=STYLE.blood,r=o.r||o.rad||220;
  fx.spawn({life:.8,layer:'glow',reach:r+20,draw(g,e,p,H){
   for(let k=0;k<3;k++){const q=cl(p*1.4-k*.18);if(q<=0||q>=1)continue;H.ring(g,e.x,e.y-14,r*E.out(q),3*(1-q)+.6,S.c,(1-q)*.9,.62);}
   H.glow(g,e.x,e.y-26,30,S.c,Math.pow(1-p,2));
  }},{x:o.x,y:o.y});
 }});
 /* ---- Living Bomb: a glow on the foe that beats faster until it blows; and a burst of fire ---- */
 FX.recipe('tree:bomb',{cast(o,fx){
  const dur=o.dur||2,r=o.r||16;
  fx.spawn({life:dur,layer:'glow',reach:60,draw(g,e,p,H){const beat=.6+.4*Math.sin(e.t*(8+16*p));H.glow(g,e.x,e.y-r*.8,r*(1.1+.5*p)*beat,'255,150,50',.7);H.glow(g,e.x,e.y-r*.8,r*.5,'255,226,160',.9*beat);}},{x:o.x,y:o.y,follow:o.follow});
 }});
 FX.recipe('tree:explode',{hit(o,fx){
  const S=STYLE.fire,r=(o.r||70)*(o.big?1.2:1),x=o.x,y=o.y-10;
  fx.spawn({life:.55,layer:'glow',reach:r+40,light:{colour:S.lit,reach:r*2.4,head:r*1.4,h:30,peak:1,env:p=>Math.pow(1-p,1.5)},draw(g,e,p,H){
   const b=E.out(Math.min(1,p/.3)),a=Math.pow(1-p,1.3);H.glow(g,x,y,r*.9*b,S.hot,a*(p<.2?1:.6));H.haze(g,x,y,r*b,S.c,a*.75);H.ring(g,x,y+8,r*b,3*(1-p)+.5,S.c,a,FLAT);}},{x,y});
  fx.emit({x,y,n:18,kind:'spark',c:'255,200,110',speed:[90,240],life:[.2,.45],size:[1.4,2.4],drag:3});
  fx.emit({x,y,n:8,kind:'ember',c:'255,150,60',speed:[40,120],up:60,grav:200,life:[.5,.9],size:[2,3.4]});
  fx.emit({x,y,n:5,kind:'smoke',c:'64,54,48',speed:[15,50],up:30,life:[.8,1.2],size:[8,14],grow:1.5,layer:'air',alpha:.7});
 }});
 /* ---- the moments ---- */
 FX.recipe('tree:block',{cast(o,fx){
  const f=o.fx<0?-1:1,x=o.x+f*16,y=o.y+(o.gy||14)-30,S=STYLE.holy;
  fx.spawn({life:.35,layer:'glow',reach:50,draw(g,e,p,H){const a=Math.pow(1-p,1.4);H.flare(g,x,y,40*(.6+.4*E.out(p)),S.hot,a,PI/2);H.crescent(g,x-f*10,y,22,-1.1,1.1,7,S.c,a,{flat:1});H.glow(g,x,y,18,S.c,a);}},{x,y});
  fx.emit({x,y,n:10,kind:'spark',c:S.hot,speed:[80,200],angle:f>0?[-.9,.9]:[PI-.9,PI+.9],life:[.15,.35],size:[1.2,2],drag:3});
 }});
 FX.recipe('tree:dodge',{cast(o,fx){
  const f=o.fx<0?-1:1,x=o.x,y=o.y+(o.gy||14)-24,S=STYLE.nature;
  fx.spawn({life:.35,layer:'glow',reach:60,draw(g,e,p,H){const a=Math.pow(1-p,1.5);H.streak(g,x+f*30,y,x-f*10,y,10*(1-p)+2,S.c,a*.7);H.haze(g,x,y,22,S.hot,a*.5);}},{x,y});
 }});
 FX.recipe('tree:stun',{cast(o,fx){
  const r=o.r||16;fx.spawn({life:1,layer:'glow',reach:40,draw(g,e,p,H){const a=E.fade(p,.1,.7);for(let i=0;i<3;i++){const t=e.t*6+i*2.1;H.flare(g,e.x+Math.cos(t)*r,e.y-r*2.6+Math.sin(t)*4,9,'255,226,130',a,t);}}},{x:o.x,y:o.y});
  fx.emit({x:o.x,y:o.y-(o.r||16),n:8,kind:'spark',c:'255,226,130',speed:[60,160],life:[.15,.3],size:[1.2,2],drag:3});
 }});
 /* the golden lion over a warrior who will not fall */
 FX.recipe('tree:lion',{cast(o,fx){
  const dur=o.dur||6,S=STYLE.holy,gy=o.gy||14;
  fx.spawn({life:dur,layer:'glow',reach:140,light:{colour:'255,214,120',reach:220,head:130,h:40,peak:1,env:p=>E.fade(p,.05,.8)},
   draw(g,e,p,H){
    const rise=E.out(Math.min(1,e.t/.5)),a=E.fade(p,.04,.8)*(.85+.15*Math.sin(e.t*4)),y=e.y+gy-90-14*rise;
    H.glow(g,e.x,y,70,S.c,a*.45);
    if(ready(ART.lion)){const w=120*(.8+.2*rise),h=w*ART.lion.naturalHeight/ART.lion.naturalWidth;g.save();g.globalCompositeOperation='lighter';g.globalAlpha=a*.85;g.drawImage(ART.lion,e.x-w/2,y-h/2,w,h);g.restore();}
    else{H.flare(g,e.x,y,90,S.hot,a*.8,0);H.glow(g,e.x,y,34,S.hot,a);}
    if(e.t<.9)for(let k=0;k<3;k++){const q=cl(e.t/.9-k*.2);if(q>0&&q<1)H.ring(g,e.x,y+20,30+120*E.out(q),3*(1-q)+.5,S.c,(1-q)*.8,.6);}
   }},{x:o.x,y:o.y,follow:o.follow});
 }});
 /* the guardian angel's wings, a moment */
 FX.recipe('tree:angel',{cast(o,fx){
  const gy=o.gy||14;
  fx.spawn({life:1.3,layer:'glow',reach:120,draw(g,e,p,H){const a=E.fade(p,.08,.5),y=e.y+gy-44;wingsDraw(g,e.x,y,1.05,a,e.t);H.glow(g,e.x,y,60,'255,250,226',a*.6);}},{x:o.x,y:o.y,follow:o.follow});
  fx.emit({x:o.x,y:o.y-20,n:24,kind:'mote',c:'255,250,226',speed:[40,140],up:60,life:[.6,1.2],size:[1.4,2.6]});
 }});
 function wingsDraw(g,x,y,k,a,t){
  if(!(a>0))return;
  const flap=1+.06*Math.sin(t*2.4);
  if(ready(ART.wings)){const w=150*k,h=w*ART.wings.naturalHeight/ART.wings.naturalWidth;g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a);g.translate(x,y);g.scale(flap,1);g.drawImage(ART.wings,-w/2,-h*.6,w,h);g.restore();return;}
  g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(1,a)*.8;g.translate(x,y);
  for(const sd of [-1,1])for(let i=0;i<5;i++){const L=(70-i*9)*k*flap,an=-.5-i*.18;g.save();g.scale(sd,1);g.rotate(an);H.streak(g,0,0,L,0,(10-i)*k,'255,240,200',.7);g.restore();}
  g.restore();
 }
 /* a mage sealed in ice */
 FX.recipe('tree:iceblock',{cast(o,fx){
  const dur=o.dur||3,gy=o.gy||14,S=STYLE.ice;
  fx.spawn({life:dur,layer:'glow',reach:90,light:{colour:S.lit,reach:160,head:90,h:30,peak:.9,env:p=>E.fade(p,.05,.85)},
   draw(g,e,p,H){
    const a=E.fade(p,.05,.9),foot=e.y+gy+4;
    if(ready(ART.ice)){const w=78,h=w*ART.ice.naturalHeight/ART.ice.naturalWidth;g.save();g.globalAlpha=a*.82;g.drawImage(ART.ice,e.x-w/2,foot-h,w,h);g.restore();}
    else{g.save();g.globalAlpha=a*.6;const gr=g.createLinearGradient(0,foot-96,0,foot);gr.addColorStop(0,'rgba(225,246,255,.9)');gr.addColorStop(1,'rgba(110,180,235,.6)');g.fillStyle=gr;g.strokeStyle='rgba(240,252,255,1)';g.lineWidth=1.5;
     g.beginPath();g.moveTo(e.x-30,foot);g.lineTo(e.x-34,foot-70);g.lineTo(e.x-14,foot-98);g.lineTo(e.x+18,foot-94);g.lineTo(e.x+34,foot-66);g.lineTo(e.x+30,foot);g.closePath();g.fill();g.stroke();g.restore();}
    H.glow(g,e.x,foot-50,44,S.c,a*.35);
   }},{x:o.x,y:o.y,follow:o.follow});
 }});
 /* ---- hits ---- */
 FX.recipe('tree:crusader',{hit(o,fx){
  const S=STYLE.holy,x=o.x,y=o.y-(o.r||16)*.7,f=Math.random()<.5?1:-1;
  fx.spawn({life:.3,layer:'glow',reach:60,draw(g,e,p,H){const a=Math.pow(1-p,1.3);H.crescent(g,x,y,26,f>0?-2.4:-.7,f>0?-.7:-2.4,8,S.c,a,{lead:E.out(Math.min(1,p/.4))});H.flare(g,x,y,34,S.hot,a,.6);}},{x,y});
  fx.emit({x,y,n:8,kind:'mote',c:S.hot,speed:[40,120],life:[.3,.6],size:[1.2,2.2]});
 }});
 FX.recipe('tree:hawkstrike',{hit(o,fx){
  const x=o.x,y=o.y-(o.r||16)*.8;
  fx.spawn({life:.3,layer:'glow',reach:50,draw(g,e,p,H){const a=Math.pow(1-p,1.4);for(let k=-1;k<=1;k++)H.streak(g,x-14+k*6,y-16,x+10+k*6,y+12,3.2,'255,240,200',a);H.glow(g,x,y,18,'255,236,180',a);}},{x,y});
  fx.emit({x,y,n:8,kind:'mote',c:'255,244,220',speed:[30,100],grav:60,life:[.4,.8],size:[1.4,2.4]});
 }});
 /* ---- frost bolts: the mage's basic bolt with Frostbolt, and Glacial Spike ---- */
 function frostBolt(id,size){
  FX.recipe(id,{
   boltTick(b,dt,fx){b._a=(b._a||0)+dt;if(Math.random()<dt*40)fx.emit({x:b.x,y:b.y,n:1,kind:size>1?'shard':'mote',c:'200,236,255',speed:[10,40],life:[.25,.5],size:[1.2,2.2],drag:2});},
   bolt(g,b,now,H){
    const a=Math.atan2((b.tgt.y-10)-b.y,b.tgt.x-b.x),c=Math.cos(a),s=Math.sin(a),L=14*size,W=5*size;
    H.streak(g,b.x-c*L*2.2,b.y-s*L*2.2,b.x,b.y,W*1.3,'120,190,250',.55);
    g.save();g.translate(b.x,b.y);g.rotate(a);g.globalCompositeOperation='lighter';g.fillStyle='rgba(220,246,255,.95)';
    g.beginPath();g.moveTo(L*.9,0);g.lineTo(-L*.5,-W*.7);g.lineTo(-L*.2,0);g.lineTo(-L*.5,W*.7);g.closePath();g.fill();g.restore();
    H.glow(g,b.x,b.y,10*size,'150,215,255',.85);
    return true;
   },
   hit(o,fx){
    const x=o.x,y=o.y-(o.r||16)*.6,r=(o.r||16)*(size>1?1.6:1);
    fx.spawn({life:.4,layer:'glow',reach:60,draw(g,e,p,H){const a=Math.pow(1-p,1.3);H.glow(g,x,y,r*1.3,'200,236,255',a);H.ring(g,x,y+r*.4,r*1.6*E.out(p),2,'230,248,255',a,FLAT);}},{x,y});
    fx.emit({x,y,n:size>1?16:7,kind:'shard',c:'210,240,255',speed:[60,180],life:[.3,.6],size:[1.6,3],grav:220,drag:2});
   }});
 }
 frostBolt('tree:frostbolt',1);frostBolt('tree:icespike',1.9);
 /* ---- Rain of Arrows: arrows falling on each target ---- */
 FX.recipe('tree:rain',{cast(o,fx){
  for(const t of (o.targets||[]).slice(0,10)){
   const n=3;for(let k=0;k<n;k++){
    const ox=(Math.random()-.5)*26,oy=(Math.random()-.5)*12,delay=Math.random()*.25;
    fx.spawn({life:.42,layer:'air',reach:220,draw(g,e,p,H){const q=E.in(Math.min(1,p/.55)),x=t.x+ox,y=t.y+oy,top=y-200;if(p<.55){const yy=top+(y-top)*q;H.streak(g,x+18,yy-34,x,yy,2.4,'230,240,180',.9);}else{const a=1-(p-.55)/.45;H.glow(g,x,y,8,'240,240,200',a*.7);}}},{x:t.x,y:t.y,delay});
   }
  }
 }});
 /* ---- the auras round the hero (a: gy his feet, left/dur of the state, moving) ---- */
 const aura=(key,parts)=>FX.recipe('tree:aura:'+key,{aura:{key,...parts}});
 const fadeOf=a=>Math.min(1,a.left/.35,(a.dur-a.left+.05)/.25);
 aura('shield',{   /* a bubble round him while a shield holds */
  back(g,a,now,H){const k=fadeOf(a)*.8;H.haze(g,0,a.gy-28,46,'170,220,255',k*.28,1,false);},
  front(g,a,now,H){const k=fadeOf(a)*.8;g.save();g.globalCompositeOperation='lighter';g.globalAlpha=k*.55;g.strokeStyle='rgba(200,236,255,1)';g.lineWidth=1.6;g.beginPath();g.ellipse(0,a.gy-30,30,40,0,0,TAU);g.stroke();
   g.globalAlpha=k*.35;g.beginPath();g.ellipse(-8,a.gy-46,10,6,-.6,0,TAU);g.fillStyle='rgba(255,255,255,1)';g.fill();g.restore();}});
 aura('wall',{
  back(g,a,now,H){const k=fadeOf(a);H.ring(g,0,a.gy,40,3,'255,214,120',k*.8,FLAT);for(let i=0;i<8;i++){const t=i/8*TAU+now*.6;H.glow(g,Math.cos(t)*40,a.gy+Math.sin(t)*40*FLAT-16,8,'255,226,150',k*.5);}},
  front(g,a,now,H){const k=fadeOf(a);for(let i=0;i<8;i++){const t=i/8*TAU+now*.6;if(Math.sin(t)<0)continue;H.streak(g,Math.cos(t)*40,a.gy+Math.sin(t)*40*FLAT,Math.cos(t)*40,a.gy+Math.sin(t)*40*FLAT-34,5,'255,214,120',k*.6);}}});
 aura('spin',{front(g,a,now,H){const k=fadeOf(a);for(let i=0;i<3;i++){const t=now*7+i*TAU/3;H.glow(g,Math.cos(t)*30,a.gy-18+Math.sin(t)*30*.4,7,'220,230,240',k*.8);}H.ring(g,0,a.gy-18,30,1.2,'220,230,240',k*.4,.4);}});
 aura('embrace',{back(g,a,now,H){const k=fadeOf(a);H.haze(g,0,a.gy-30,40,'255,244,210',k*.4,1.4);},glow(g,a,now,H){const k=fadeOf(a);H.glow(g,0,a.gy-60,16,'255,250,226',k*.5);}});
 aura('wings',{back(g,a,now,H){wingsDraw(g,0,a.gy-46,1,fadeOf(a)*.9,now);},glow(g,a,now,H){H.glow(g,0,a.gy-40,50,'255,248,220',fadeOf(a)*.3);}});
 aura('deter',{front(g,a,now,H){const k=fadeOf(a);for(let i=0;i<6;i++){const t=now*5+i*TAU/6;H.streak(g,Math.cos(t)*28,a.gy-22+Math.sin(t)*14,Math.cos(t+.5)*28,a.gy-22+Math.sin(t+.5)*14,3,'255,240,190',k*.8);}}});
 aura('undying',{back(g,a,now,H){const k=fadeOf(a),f=.8+.2*Math.sin(now*6);H.haze(g,0,a.gy-30,50,'255,200,90',k*.45*f,1.2);},glow(g,a,now,H){H.flare(g,0,a.gy-34,46,'255,236,170',fadeOf(a)*.5,now);}});
 aura('enrage',{back(g,a,now,H){const k=fadeOf(a),f=.7+.3*Math.sin(now*14);H.haze(g,0,a.gy-26,34,'230,50,40',k*.4*f,1.3);}});
 aura('avatar',{
  back(g,a,now,H){const k=fadeOf(a),f=.85+.15*Math.sin(now*5);H.haze(g,0,a.gy-34,64,'210,40,30',k*.5*f,1.4);H.ring(g,0,a.gy,44+4*Math.sin(now*3),2.4,'255,90,60',k*.6,FLAT);},
  tick(a,dt,fx){if(Math.random()<dt*18)fx.emit({x:a.x+(Math.random()-.5)*40,y:a.y+a.gy-4,n:1,kind:'ember',c:'255,110,60',speed:[5,20],up:60,grav:-30,life:[.5,.9],size:[1.6,2.8]});}});
 aura('bear',{back(g,a,now,H){H.haze(g,0,a.gy-30,46,'190,130,70',fadeOf(a)*.45,1.2);}});
 aura('owl',{glow(g,a,now,H){const k=fadeOf(a);H.glow(g,-4,a.gy-58,8,'210,230,255',k*.9);H.glow(g,6,a.gy-58,8,'210,230,255',k*.9);H.haze(g,0,a.gy-40,40,'200,220,255',k*.25,1.2);}});
})();
