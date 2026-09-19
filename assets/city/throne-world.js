/* 👑 The Throne Hall above the City. Two rooms: the great hall with its pillars, guards, carpet and
 * the throne on a dais, and the council chamber behind it where the King's Hand keeps the Crown
 * Ledger on a table for six. Painted stone from the existing zone art supplies the surfaces, drawn
 * once into a static layer and lit per frame. The throne, the council table, the pillars and the
 * braziers are paintings (assets/city/throne.png, council_table.png, hall_pillar.png,
 * hall_brazier.png - Higgsfield gpt_image_2_5, 2026-09-19); the canvas versions below them are what
 * shows for the frame or two before a picture has loaded. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.ThroneWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const W=1800,H=3400;
 const HALL=Object.freeze({x:250,y:1150,w:1300,h:2100});          /* the great hall */
 const COUNCIL=Object.freeze({x:300,y:300,w:1200,h:700});          /* the chamber behind the throne */
 const DOORS=Object.freeze([{x:330,y:920,w:130,h:320},{x:1340,y:920,w:130,h:320}]); /* passages past the dais */
 const DAIS=Object.freeze({x:640,y:1160,w:520,h:210});             /* three steps up to the throne */
 const CARPET=Object.freeze({x:790,w:220,y0:1370,y1:3250});
 const THRONE=Object.freeze({x:900,y:1228});
 const KING=Object.freeze({x:900,y:1318});
 const TABLE=Object.freeze({x:900,y:640});
 const HAND=Object.freeze({x:900,y:850});
 const EXIT=Object.freeze({x:900,y:3225,r:70});
 const SPAWN=Object.freeze({x:900,y:3000});
 const PILLAR_X=Object.freeze([520,1280]),PILLAR_Y=Object.freeze([1560,1900,2240,2580,2920]);
 const WINDOW_Y=Object.freeze([1730,2070,2410,2750]);
 const GUARDS=Object.freeze(['Gardist Torvald','Gardist Ulf','Gardist Einar','Gardist Sten','Gardist Ragnar','Gardist Bo','Gardist Arne','Gardist Halvar']);
 const KING_NAME='Kung Alarik Tidvind',HAND_NAME='Eskil Stormark · King’s Hand';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const ready=im=>!!(im&&im.complete!==false&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0);
 const imageTiles=new WeakMap(),contextPatterns=new WeakMap();
 let rememberedImages={};

 /* ---------- the world ---------- */
 function stand(name,skin,x,y,fx,extra){
  return {name,skin,race:'human',cls:'warrior',female:false,big:1.1,pts:[{x,y}],i:0,dir:1,x,y,speed:0,walk:0,fx,pauseT:1e9,moving:false,...extra};
 }
 function create(){
  const npcs=[];
  let g=0;
  for(const row of [0,2,4]){
   npcs.push(stand(GUARDS[g++],'royal_guard',PILLAR_X[0]+78,PILLAR_Y[row]+8,1,{guard:true}));
   npcs.push(stand(GUARDS[g++],'royal_guard',PILLAR_X[1]-78,PILLAR_Y[row]+8,-1,{guard:true}));
  }
  npcs.push(stand(GUARDS[g++],'royal_guard',DAIS.x+70,DAIS.y+DAIS.h+22,1,{guard:true}));
  npcs.push(stand(GUARDS[g++],'royal_guard',DAIS.x+DAIS.w-70,DAIS.y+DAIS.h+22,-1,{guard:true}));
  npcs.push(stand(KING_NAME,'king',KING.x,KING.y,-1,{big:1.5,game:'king',royal:true}));
  npcs.push(stand(HAND_NAME,'kings_hand',HAND.x,HAND.y,1,{big:1.3,game:'ledger',royal:true}));
  const solids=[];
  for(const [side,x] of [[-1,PILLAR_X[0]],[1,PILLAR_X[1]]])for(const y of PILLAR_Y)solids.push({x,y,r:34,type:'throneprop',kind:'pillar',side});
  solids.push({x:THRONE.x,y:THRONE.y,r:40,type:'throneprop',kind:'throne',crx:78,cry:34,cyo:-12});
  solids.push({x:TABLE.x,y:TABLE.y,r:60,type:'throneprop',kind:'table',crx:236,cry:110,cyo:-22});
  solids.push({x:DAIS.x-40,y:DAIS.y+DAIS.h+26,r:20,type:'throneprop',kind:'brazier'});
  solids.push({x:DAIS.x+DAIS.w+40,y:DAIS.y+DAIS.h+26,r:20,type:'throneprop',kind:'brazier'});
  return {key:'thronehall',kind:'thronehall',throne:true,w:W,h:H,
   hall:{...HALL},council:{...COUNCIL},dais:{...DAIS},carpet:{...CARPET},spawn:{...SPAWN},exit:{...EXIT,id:'city'},
   portal:{x:-500,y:-500},npcs,solids,mwalls:[],deco:[],waters:[],paths:[],floors:[],enemySpawns:[],bossRooms:[],entrances:[],pathY:-500,pathH:0};
 }
 const inside=(rc,x,y,rx,ry)=>x>=rc.x+rx&&x<=rc.x+rc.w-rx&&y>=rc.y+ry&&y<=rc.y+rc.h-ry;
 /* An actor disk of radius r fits on the floor: inside one of the rooms, or in a doorway (which
    overlaps both rooms, so only its jambs need the margin). */
 function contains(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  if(inside(HALL,x,y,r,r)||inside(COUNCIL,x,y,r,r))return true;
  for(const d of DOORS)if(inside(d,x,y,r,0))return true;
  return false;
 }

 /* ---------- painting helpers ---------- */
 function canvas(w,h,options){
  const c=options?.createCanvas?options.createCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):null;
  if(c){c.width=w;c.height=h;}return c;
 }
 function tile(im,options){
  if(!ready(im))return null;
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
  let c=imageTiles.get(im);if(c&&c.sourceWidth===iw&&c.sourceHeight===ih)return c.canvas;
  const out=canvas(384,384,options);if(!out)return im;
  const p=out.getContext('2d');
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
   p.save();p.translate((col+.5)*192,(row+.5)*192);p.scale(col?-1:1,row?-1:1);
   p.drawImage(im,iw*.27,ih*.22,iw*.46,ih*.56,-96.5,-96.5,193,193);p.restore();
  }
  imageTiles.set(im,{canvas:out,sourceWidth:iw,sourceHeight:ih});return out;
 }
 function patternFor(g,im,options){
  const source=tile(im,options);if(!source)return null;
  let patterns=contextPatterns.get(g);if(!patterns){patterns=new WeakMap();contextPatterns.set(g,patterns);}
  let pattern=patterns.get(source);if(!pattern){pattern=g.createPattern(source,'repeat');if(pattern)patterns.set(source,pattern);}
  return pattern;
 }
 function texture(g,im,rect,scale=1,options){
  const pattern=patternFor(g,im,options);
  if(!pattern)return false;
  g.save();g.scale(scale,scale);g.fillStyle=pattern;g.fillRect(rect.x/scale,rect.y/scale,rect.w/scale,rect.h/scale);g.restore();
  return true;
 }
 function rect(g,x,y,w,h,fill,stroke,width=1){g.beginPath();g.rect(x,y,w,h);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
 function ellipse(g,x,y,rx,ry,fill,stroke,width=1){
  g.beginPath();g.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
 }
 function light(g,x,y,r,strength=1,tint=[255,194,102]){
  const glow=g.createRadialGradient(x,y,0,x,y,r);
  glow.addColorStop(0,`rgba(${tint[0]},${tint[1]},${tint[2]},${.26*strength})`);glow.addColorStop(.4,`rgba(${tint[0]},${tint[1]-50},${tint[2]-40},${.12*strength})`);glow.addColorStop(1,`rgba(${tint[0]},${tint[1]-80},${tint[2]-60},0)`);
  g.fillStyle=glow;g.fillRect(x-r,y-r,r*2,r*2);
 }
 function flame(g,x,y,size,time,seed){
  const sway=Math.sin(time*4.3+seed)*2.4*size,flick=.9+Math.sin(time*7.1+seed*1.7)*.1;
  g.beginPath();g.moveTo(x-9*size,y);g.bezierCurveTo(x-16*size,y-14*size,x-3*size,y-18*size,x+sway,y-34*size*flick);
  g.bezierCurveTo(x+4*size,y-16*size,x+16*size,y-12*size,x+9*size,y);g.closePath();g.fillStyle='#ea8034';g.fill();
  g.beginPath();g.moveTo(x-5*size,y);g.quadraticCurveTo(x-7*size,y-11*size,x+sway*.6,y-22*size*flick);g.quadraticCurveTo(x+3*size,y-10*size,x+5*size,y);g.closePath();g.fillStyle='#ffd27a';g.fill();
  ellipse(g,x,y-4*size,3*size,5*size,'#fff3c8');
 }
 /* 🔥 A living fire over a painted one. Everything is a pure function of time and a per-prop seed -
    no particle state to keep, so a brazier that scrolls off screen and back is mid-flicker, not
    restarting. Additive tongues and embers of flame, sparks that wander up and die, and a breath of
    smoke above them in the normal blend so it darkens instead of glowing. size 1 is a brazier. */
 function fire(g,x,y,size,time,seed){
  g.save();g.globalCompositeOperation='lighter';
  g.globalAlpha=.34;                       /* over a painted fire: enough to move it, not enough to bleach it */
  flame(g,x-6*size,y,size*.85,time*1.07,seed);
  flame(g,x+7*size,y-1.5*size,size*.75,time*1.19,seed+2.3);
  flame(g,x,y-2*size,size*1.2,time*.93,seed+4.1);
  g.globalAlpha=1;
  for(let i=0;i<11;i++){
   const p=(time*(.62+.06*(i%4))+i*.137+seed*.31)%1,q=1-p;
   const wob=Math.sin(time*3.1+i*2.4+seed)*(3+p*9)*size;
   const px=x+wob+(i%2?-1:1)*q*6*size,py=y-6*size-p*66*size,r=q*q*6.5*size+.6;
   const c=p<.3?'255,196,96':p<.65?'255,132,40':'214,66,26';
   ellipse(g,px,py,r,r*1.7,`rgba(${c},${(q*q*.34).toFixed(3)})`);
  }
  for(let i=0;i<7;i++){
   const p=(time*(.30+.045*i)+i*.211+seed*.17)%1,q=1-p;
   const px=x+Math.sin(time*2.2+i*5.1+seed*3)*(7+p*24)*size,py=y-18*size-p*128*size,r=1.2*size+.5;
   ellipse(g,px,py,r,r,`rgba(255,${Math.round(150+q*80)},${Math.round(60+q*60)},${(q*.95).toFixed(3)})`);
  }
  g.restore();
  for(let i=0;i<4;i++){
   const p=(time*.21+i*.25+seed*.13)%1,r=(7+p*18)*size;
   ellipse(g,x+Math.sin(time*.9+i*1.7+seed)*(5+p*14)*size,y-52*size-p*96*size,r,r*.85,`rgba(52,44,40,${((1-p)*p*.34).toFixed(3)})`);
  }
 }
 function crown(g,x,y,size,color='#e5c05a',line='#6d4d12'){
  g.save();g.translate(x,y);g.scale(size,size);
  g.beginPath();g.moveTo(-12,8);g.lineTo(-14,-6);g.lineTo(-7,0);g.lineTo(0,-11);g.lineTo(7,0);g.lineTo(14,-6);g.lineTo(12,8);g.closePath();
  g.fillStyle=color;g.fill();g.strokeStyle=line;g.lineWidth=1.4;g.stroke();
  g.fillStyle='#c33d4a';ellipse(g,0,2,2.2,2.2,'#c33d4a');ellipse(g,-7,3,1.6,1.6,'#3c7fc4');ellipse(g,7,3,1.6,1.6,'#3c7fc4');
  g.restore();
 }
 function crest(g,x,y,size,color='#e5c05a'){
  /* the city's arms: a crown riding three waves */
  g.save();g.translate(x,y);g.scale(size,size);
  crown(g,0,-6,1,color,'rgba(40,25,5,.8)');
  g.strokeStyle=color;g.lineWidth=2;g.lineCap='round';
  for(let i=0;i<2;i++){g.beginPath();g.moveTo(-16,8+i*6);g.bezierCurveTo(-9,2+i*6,-5,14+i*6,1,8+i*6);g.bezierCurveTo(7,2+i*6,11,14+i*6,16,8+i*6);g.stroke();}
  g.restore();
 }
 function banner(g,x,y,w,h,size=1,tone=['#5b1216','#8d1d24','#4f1014']){
  g.save();g.translate(x,y);g.scale(size,size);
  rect(g,-w/2-6,-4,w+12,8,'#6a5130');rect(g,-w/2-9,-7,7,14,'#c7a252');rect(g,w/2+2,-7,7,14,'#c7a252');
  g.beginPath();g.moveTo(-w/2,0);g.lineTo(w/2,0);g.lineTo(w/2,h*.82);g.lineTo(0,h);g.lineTo(-w/2,h*.82);g.closePath();
  const silk=g.createLinearGradient(-w/2,0,w/2,0);silk.addColorStop(0,tone[0]);silk.addColorStop(.5,tone[1]);silk.addColorStop(1,tone[2]);
  g.fillStyle=silk;g.fill();g.strokeStyle='#d5b25c';g.lineWidth=2.5;g.stroke();
  crest(g,0,h*.42,w/44,'#e8c66a');
  g.restore();
 }
 function stoneFace(g,x,y,w,h,base='#3a3430',mortar='rgba(0,0,0,.42)',course=26){
  rect(g,x,y,w,h,base);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  const shade=g.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(0,0,0,.35)');shade.addColorStop(.5,'rgba(255,240,210,.05)');shade.addColorStop(1,'rgba(0,0,0,.25)');
  g.fillStyle=shade;g.fillRect(x,y,w,h);
  g.strokeStyle=mortar;g.lineWidth=2;
  let row=0;
  for(let yy=y+course;yy<y+h;yy+=course,row++){
   g.beginPath();g.moveTo(x,yy);g.lineTo(x+w,yy);g.stroke();
   for(let xx=x+(row%2?course*1.1:0);xx<x+w;xx+=course*2.2){g.beginPath();g.moveTo(xx,yy-course);g.lineTo(xx,yy);g.stroke();}
  }
  g.restore();
 }
 function archWindow(g,x,y,w,h,warm=false){
  /* a tall arched opening, glass panes lit from outside */
  g.save();g.beginPath();g.moveTo(x-w/2,y+h);g.lineTo(x-w/2,y+w/2);g.arc(x,y+w/2,w/2,Math.PI,0);g.lineTo(x+w/2,y+h);g.closePath();
  g.fillStyle='#1d1a17';g.fill();g.strokeStyle='#8f8672';g.lineWidth=5;g.stroke();g.clip();
  const glass=g.createLinearGradient(x,y,x,y+h);
  if(warm){glass.addColorStop(0,'#ffe2a0');glass.addColorStop(1,'#d78a3a');}else{glass.addColorStop(0,'#d9ecff');glass.addColorStop(.5,'#8fb4d8');glass.addColorStop(1,'#e9d7a4');}
  g.fillStyle=glass;g.fillRect(x-w/2,y,w,h);
  g.strokeStyle='rgba(30,25,20,.75)';g.lineWidth=3;
  g.beginPath();g.moveTo(x,y);g.lineTo(x,y+h);g.stroke();
  for(let yy=y+w/2+20;yy<y+h;yy+=34){g.beginPath();g.moveTo(x-w/2,yy);g.lineTo(x+w/2,yy);g.stroke();}
  g.restore();
 }
 function wallMap(g,x,y,w,h){
  rect(g,x,y,w,h,'#d8c493','#6b5430',4);
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
  g.fillStyle='#8aa2c3';g.fillRect(x,y,w,h);
  g.fillStyle='#c9b487';g.beginPath();g.moveTo(x+w*.1,y+h*.35);g.bezierCurveTo(x+w*.3,y+h*.1,x+w*.6,y+h*.2,x+w*.85,y+h*.4);g.bezierCurveTo(x+w*.95,y+h*.7,x+w*.6,y+h*.95,x+w*.35,y+h*.85);g.bezierCurveTo(x+w*.15,y+h*.8,x+w*.05,y+h*.6,x+w*.1,y+h*.35);g.closePath();g.fill();
  g.strokeStyle='rgba(70,50,20,.55)';g.lineWidth=1.5;
  for(let i=1;i<5;i++){g.beginPath();g.moveTo(x+w*i/5,y);g.lineTo(x+w*i/5,y+h);g.stroke();g.beginPath();g.moveTo(x,y+h*i/5);g.lineTo(x+w,y+h*i/5);g.stroke();}
  crest(g,x+w*.52,y+h*.55,.9,'#7a1b1b');
  g.restore();
 }
 function floorPath(g){
  g.beginPath();
  g.rect(HALL.x,HALL.y,HALL.w,HALL.h);g.rect(COUNCIL.x,COUNCIL.y,COUNCIL.w,COUNCIL.h);
  for(const d of DOORS)g.rect(d.x,d.y,d.w,d.h);
 }

 /* ---------- the static layer: walls, floors, carpet, dais, tapestries, windows ---------- */
 let staticLayer=null,staticKey='';
 function paintStatic(g,images,options){
  rect(g,0,0,W,H,'#0a0909');
  /* the wall mass, then the floors cut out of it */
  const wallRect={x:HALL.x-150,y:COUNCIL.y-150,w:HALL.w+300,h:HALL.y+HALL.h+150-(COUNCIL.y-150)};
  rect(g,wallRect.x,wallRect.y,wallRect.w,wallRect.h,'#2a2724');
  if(!texture(g,images.raidwall||images.cryptwall,wallRect,.7,options))stoneFace(g,wallRect.x,wallRect.y,wallRect.w,wallRect.h,'#2e2a26');
  rect(g,wallRect.x,wallRect.y,wallRect.w,wallRect.h,'rgba(10,8,6,.42)');
  /* floors */
  g.save();floorPath(g);g.clip();
  rect(g,HALL.x,HALL.y,HALL.w,HALL.h,'#4a4540');
  rect(g,COUNCIL.x,COUNCIL.y,COUNCIL.w,COUNCIL.h,'#3d3934');
  for(const d of DOORS)rect(g,d.x,d.y,d.w,d.h,'#433e39');
  /* flagstone checker under the pattern, so the floor reads as laid tiles rather than a smear */
  for(let y=HALL.y;y<HALL.y+HALL.h;y+=100)for(let x=HALL.x;x<HALL.x+HALL.w;x+=100){
   const odd=((x-HALL.x)/100+(y-HALL.y)/100)%2;
   rect(g,x,y,100,100,odd?'rgba(255,240,215,.06)':'rgba(0,0,0,.10)');
  }
  g.save();g.globalAlpha=.55;texture(g,images.raidfloor||images.crypt,{x:0,y:0,w:W,h:H},.95,options);g.restore();
  g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=2;
  for(let y=HALL.y;y<=HALL.y+HALL.h;y+=100){g.beginPath();g.moveTo(HALL.x,y);g.lineTo(HALL.x+HALL.w,y);g.stroke();}
  for(let x=HALL.x;x<=HALL.x+HALL.w;x+=100){g.beginPath();g.moveTo(x,HALL.y);g.lineTo(x,HALL.y+HALL.h);g.stroke();}
  /* the council chamber: darker boards and a rug under the table */
  rect(g,COUNCIL.x,COUNCIL.y,COUNCIL.w,COUNCIL.h,'rgba(20,12,6,.28)');
  ellipse(g,TABLE.x,TABLE.y+14,330,190,'#233a2c','#c2a052',6);ellipse(g,TABLE.x,TABLE.y+14,296,162,null,'rgba(214,180,100,.45)',3);
  /* window light on the hall floor */
  for(const wy of WINDOW_Y){
   for(const side of [-1,1]){
    const x0=side<0?HALL.x:HALL.x+HALL.w;
    const shaft=g.createLinearGradient(x0,0,x0+side*520,0);shaft.addColorStop(0,'rgba(255,236,190,.22)');shaft.addColorStop(1,'rgba(255,236,190,0)');
    g.fillStyle=shaft;g.beginPath();g.moveTo(x0,wy-70);g.lineTo(x0+side*520,wy+60);g.lineTo(x0+side*520,wy+330);g.lineTo(x0,wy+90);g.closePath();g.fill();
   }
  }
  /* the carpet from the doors to the dais, gold-edged, and up the steps */
  const cg=g.createLinearGradient(CARPET.x,0,CARPET.x+CARPET.w,0);cg.addColorStop(0,'#5e1417');cg.addColorStop(.5,'#8a1f27');cg.addColorStop(1,'#5e1417');
  rect(g,CARPET.x,CARPET.y0,CARPET.w,CARPET.y1-CARPET.y0,cg);
  rect(g,CARPET.x+6,CARPET.y0,4,CARPET.y1-CARPET.y0,'#d3ad55');rect(g,CARPET.x+CARPET.w-10,CARPET.y0,4,CARPET.y1-CARPET.y0,'#d3ad55');
  /* the dais: three steps, each riser in shadow, each tread catching the light */
  const steps=[[DAIS.x,DAIS.y+140,DAIS.w,70],[DAIS.x+30,DAIS.y+70,DAIS.w-60,70],[DAIS.x+60,DAIS.y,DAIS.w-120,70]];
  for(const [sx,sy,sw,sh] of steps){
   const tg=g.createLinearGradient(0,sy,0,sy+sh);tg.addColorStop(0,'#8c8375');tg.addColorStop(.75,'#6d665b');tg.addColorStop(1,'#3d3832');
   rect(g,sx,sy,sw,sh,tg);rect(g,sx,sy,sw,4,'rgba(255,245,220,.35)');rect(g,sx,sy+sh-8,sw,8,'rgba(0,0,0,.45)');
   rect(g,sx+sw/2-70,sy,140,sh,'rgba(138,31,39,.85)');rect(g,sx+sw/2-70,sy+sh-8,140,8,'rgba(60,10,14,.8)');
   rect(g,sx+sw/2-66,sy,3,sh,'#d3ad55');rect(g,sx+sw/2+63,sy,3,sh,'#d3ad55');
  }
  g.restore();
  /* an inner shadow all the way round the floor, so the walls have weight */
  g.save();floorPath(g);g.clip();floorPath(g);g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=70;g.stroke();g.restore();
  floorPath(g);g.strokeStyle='#8a8272';g.lineWidth=6;g.stroke();
  /* the north wall of the hall, seen face on: stone, pilasters, the great tapestry and two banners */
  const face={x:HALL.x,y:COUNCIL.y+COUNCIL.h,w:HALL.w,h:HALL.y-(COUNCIL.y+COUNCIL.h)};
  stoneFace(g,face.x,face.y,face.w,face.h,'#3b3531');
  for(const d of DOORS){
   rect(g,d.x,face.y,d.w,face.h,'#2b2724');
   g.save();g.beginPath();g.rect(d.x,face.y,d.w,face.h);g.clip();rect(g,d.x,d.y,d.w,d.h,'#433e39');texture(g,images.raidfloor||images.crypt,{x:d.x,y:d.y,w:d.w,h:d.h},.95,options);g.restore();
   g.beginPath();g.moveTo(d.x-8,face.y+face.h);g.lineTo(d.x-8,face.y+40);g.arc(d.x+d.w/2,face.y+40,d.w/2+8,Math.PI,0);g.lineTo(d.x+d.w+8,face.y+face.h);
   g.strokeStyle='#9a9180';g.lineWidth=10;g.stroke();
  }
  for(const px of [560,700,1100,1240]){rect(g,px-14,face.y,28,face.h,'#4a443f','#221e1b',2);rect(g,px-18,face.y,36,10,'#5c554e');}
  rect(g,face.x,face.y+face.h-10,face.w,10,'#5a534b');rect(g,face.x,face.y+face.h-3,face.w,3,'rgba(255,245,220,.35)');
  banner(g,630,face.y+6,64,130,1);banner(g,1170,face.y+6,64,130,1);
  /* the tapestry behind the throne hangs a little over the top step */
  const tap={x:760,y:face.y+4,w:280,h:face.h+60};
  const tg2=g.createLinearGradient(tap.x,0,tap.x+tap.w,0);tg2.addColorStop(0,'#4d0f13');tg2.addColorStop(.5,'#8f1d26');tg2.addColorStop(1,'#4d0f13');
  rect(g,tap.x,tap.y,tap.w,tap.h,tg2,'#d9b45e',5);rect(g,tap.x+14,tap.y+14,tap.w-28,tap.h-28,null,'rgba(232,198,106,.6)',2);
  for(let x=tap.x;x<tap.x+tap.w;x+=12)rect(g,x+2,tap.y+tap.h,8,14,'#c9a24a');
  crest(g,tap.x+tap.w/2,tap.y+tap.h*.5,3.2,'#f0cf6e');
  rect(g,tap.x-10,tap.y-8,tap.w+20,10,'#6a5130');
  /* the council chamber's north wall: the realm's map between two banners */
  const cface={x:COUNCIL.x,y:COUNCIL.y-150,w:COUNCIL.w,h:150};
  stoneFace(g,cface.x,cface.y,cface.w,cface.h,'#3b3531');
  rect(g,cface.x,cface.y+cface.h-10,cface.w,10,'#5a534b');
  banner(g,560,cface.y+8,60,122,1);banner(g,1240,cface.y+8,60,122,1);
  wallMap(g,740,cface.y+16,320,cface.h-30);
  /* windows in the side walls of the hall */
  for(const wy of WINDOW_Y){archWindow(g,HALL.x-72,wy-120,66,220);archWindow(g,HALL.x+HALL.w+72,wy-120,66,220);}
  /* the way out: open doors onto the City stair */
  const door={x:EXIT.x-95,y:HALL.y+HALL.h,w:190,h:90};
  const sky=g.createLinearGradient(0,door.y,0,door.y+door.h);sky.addColorStop(0,'#9cc6e6');sky.addColorStop(.6,'#e9d9b0');sky.addColorStop(1,'#a58d64');
  rect(g,door.x,door.y,door.w,door.h,sky);
  for(const s of [-1,1]){
   g.save();g.translate(EXIT.x+s*95,door.y);g.transform(1,0,-s*.35,1,0,0);
   rect(g,s<0?0:-46,0,46,door.h,'#4a2d17','#201208',3);
   for(const yy of [14,44,74])rect(g,s<0?4:-42,yy,38,5,'#6d6a68');
   g.restore();
  }
  rect(g,door.x-10,door.y,10,door.h,'#9a9180');rect(g,door.x+door.w,door.y,10,door.h,'#9a9180');
  g.save();g.textAlign='center';g.textBaseline='middle';g.font='bold 19px Georgia, serif';
  g.strokeStyle='rgba(5,5,8,.9)';g.lineWidth=5;g.strokeText('↓ City',EXIT.x,HALL.y+HALL.h-26);g.fillStyle='#e6d6b0';g.fillText('↓ City',EXIT.x,HALL.y+HALL.h-26);g.restore();
 }
 function renderGround(g,world,view,{images={},time=0,...options}={}){
  rememberedImages={...rememberedImages,...images};images=rememberedImages;
  const vx=view?.x||0,vy=view?.y||0,vw=view?.w||W,vh=view?.h||H;
  g.save();g.fillStyle='#0a0909';g.fillRect(vx,vy,vw,vh);
  const key=(ready(images.raidwall)?'w':'-')+(ready(images.raidfloor)?'f':'-');
  if(!staticLayer||staticKey!==key){
   const c=canvas(W,H,options);
   if(c){paintStatic(c.getContext('2d'),images,options);staticLayer=c;staticKey=key;}
   else paintStatic(g,images,options);
  }
  if(staticLayer){
   const sx=clamp(vx,0,W),sy=clamp(vy,0,H),sw=clamp(vx+vw,0,W)-sx,sh=clamp(vy+vh,0,H)-sy;
   if(sw>0&&sh>0)g.drawImage(staticLayer,sx,sy,sw,sh,sx,sy,sw,sh);
  }
  /* the living light: wall sconces between the windows and the pillars, the braziers by the dais,
     candles in the chamber. Pools on the floor breathe with the flames. */
  const seen=(x,y,r)=>x+r>=vx&&x-r<=vx+vw&&y+r>=vy&&y-r<=vy+vh;
  for(const py of PILLAR_Y)for(const [side,x] of [[-1,HALL.x],[1,HALL.x+HALL.w]]){
   if(!seen(x,py,220))continue;
   const f=.9+Math.sin(time*5.3+py*.01+side)*.1;
   light(g,x+side*40,py,210,f*.7);
   rect(g,x-8,py-4,16,44,'#2c2320');rect(g,x-4,py-10,8,10,'#5b4a35');
   flame(g,x,py-8,.9,time,py*.3+side);
  }
  for(const wy of WINDOW_Y)for(const [side,x] of [[-1,HALL.x],[1,HALL.x+HALL.w]]){
   if(!seen(x,wy,600))continue;
   light(g,x+side*180,wy+120,300,.35+Math.sin(time*.6+wy)*.05,[255,236,190]);
  }
  if(seen(TABLE.x,TABLE.y,500))light(g,TABLE.x,TABLE.y+10,420,.55+Math.sin(time*3.7)*.06);
  if(seen(THRONE.x,THRONE.y,400))light(g,THRONE.x,THRONE.y+20,380,.5,[255,214,130]);
  /* motes in the window light */
  if(vw<2600){
   g.fillStyle='rgba(255,230,170,.35)';
   for(let i=0;i<22;i++){
    const wy=WINDOW_Y[i%WINDOW_Y.length],side=i%2?1:-1,x0=side<0?HALL.x:HALL.x+HALL.w;
    const t=((time*.06+i*.137)%1),x=x0+side*(60+t*380),y=wy-40+t*300+Math.sin(time*.8+i)*12;
    if(seen(x,y,4))ellipse(g,x,y,1.6,1.6,'rgba(255,230,170,.35)');
   }
  }
  g.restore();
 }

 /* ---------- props sorted with the actors: pillars, the throne, the council table, braziers ---------- */
 function drawShadow(g,s){
  if(s.kind==='pillar')ellipse(g,10,12,64,22,'rgba(0,0,0,.45)');
  else if(s.kind==='throne')ellipse(g,0,14,84,26,'rgba(0,0,0,.4)');
  else if(s.kind==='table')ellipse(g,0,66,220,44,'rgba(0,0,0,.35)');
  else if(s.kind==='brazier')ellipse(g,0,8,26,10,'rgba(0,0,0,.4)');
 }
 function pillar(g,s,time,images,options){
  const side=s.side||-1;
  rect(g,-52,-6,104,22,'#5a524a','#211d1a',3);rect(g,-52,-6,104,4,'rgba(255,245,220,.3)');
  rect(g,-34,-262,68,258,'#5d574f');
  if(!texture(g,images.raidwall||images.cryptwall,{x:-34,y:-262,w:68,h:258},.6,options))stoneFace(g,-34,-262,68,258,'#5d574f');
  const shade=g.createLinearGradient(-34,0,34,0);shade.addColorStop(0,'rgba(0,0,0,.55)');shade.addColorStop(.32,'rgba(255,236,200,.14)');shade.addColorStop(.6,'rgba(0,0,0,.05)');shade.addColorStop(1,'rgba(0,0,0,.5)');
  g.fillStyle=shade;g.fillRect(-34,-262,68,258);
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=2;
  for(const x of [-20,-7,7,20]){g.beginPath();g.moveTo(x,-250);g.lineTo(x,-14);g.stroke();}
  rect(g,-44,-284,88,24,'#665f56','#211d1a',3);rect(g,-40,-296,80,14,'#736b61','#211d1a',2);rect(g,-44,-284,88,4,'rgba(255,245,220,.35)');
  crest(g,0,-236,.9,'rgba(232,198,106,.55)');
  /* a torch on the side that faces the carpet */
  const tx=side*44;
  rect(g,tx-5,-160,10,34,'#2c2320');rect(g,tx-8,-166,16,8,'#6a5130');
  light(g,tx,-190,150,.9+Math.sin(time*6+s.y*.01)*.1);
  flame(g,tx,-166,1,time,s.y*.13);
 }
 function throne(g,time){
  light(g,0,-80,190,.6,[255,214,130]);
  /* the back: gilded frame, red velvet, a crown finial */
  rect(g,-64,-210,128,200,'#b48a3a','#4a3410',3);
  const velvet=g.createLinearGradient(-50,0,50,0);velvet.addColorStop(0,'#5a1216');velvet.addColorStop(.5,'#9a2430');velvet.addColorStop(1,'#5a1216');
  rect(g,-50,-196,100,170,velvet);rect(g,-50,-196,100,170,null,'rgba(240,205,120,.55)',2);
  g.beginPath();g.moveTo(-64,-210);g.quadraticCurveTo(0,-262,64,-210);g.closePath();g.fillStyle='#b48a3a';g.fill();g.strokeStyle='#4a3410';g.lineWidth=3;g.stroke();
  crown(g,0,-236,1.6);
  crest(g,0,-120,1.3,'rgba(255,220,140,.5)');
  /* armrests and the seat */
  rect(g,-78,-90,18,80,'#9c7630','#4a3410',2);rect(g,60,-90,18,80,'#9c7630','#4a3410',2);
  ellipse(g,-69,-92,11,8,'#d9b45e','#4a3410',2);ellipse(g,69,-92,11,8,'#d9b45e','#4a3410',2);
  rect(g,-64,-36,128,30,'#7d1c24','#3a0d10',2);rect(g,-64,-8,128,12,'#8c6a2a','#4a3410',2);
  for(const x of [-54,54]){rect(g,x-5,4,10,14,'#8c6a2a','#4a3410',2);}
 }
 function chair(g,x,y,back){
  g.save();g.translate(x,y);
  if(back){rect(g,-22,-64,44,50,'#5a3a1e','#2a1a0c',2);rect(g,-18,-60,36,42,'#7d1c24');rect(g,-24,-16,48,14,'#4a2d17','#2a1a0c',2);}
  else{rect(g,-24,-14,48,14,'#4a2d17','#2a1a0c',2);rect(g,-22,-10,44,52,'#5a3a1e','#2a1a0c',2);rect(g,-18,-6,36,44,'#7d1c24');}
  g.restore();
 }
 function councilTable(g,time){
  for(const x of [-160,0,160])chair(g,x,-92,true);
  /* the board: oak, with a thick edge below */
  const wood=g.createLinearGradient(0,-80,0,80);wood.addColorStop(0,'#8a5a2b');wood.addColorStop(.5,'#6b4320');wood.addColorStop(1,'#59361a');
  g.beginPath();g.roundRect?g.roundRect(-250,-80,500,160,40):g.rect(-250,-80,500,160);g.fillStyle='#3a2410';g.fill();
  g.beginPath();g.roundRect?g.roundRect(-250,-94,500,160,40):g.rect(-250,-94,500,160);g.fillStyle=wood;g.fill();g.strokeStyle='#2a1a0c';g.lineWidth=3;g.stroke();
  g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=1.5;
  for(let yy=-80;yy<60;yy+=14){g.beginPath();g.moveTo(-236,yy);g.lineTo(236,yy);g.stroke();}
  /* on it: the Crown Ledger, open, a map, scrolls, goblets and three candles */
  rect(g,-62,-48,124,84,'#e9dcb8','#6b5430',2);rect(g,-2,-48,4,84,'#8a7350');
  g.strokeStyle='rgba(60,40,20,.5)';g.lineWidth=1.2;
  for(let yy=-38;yy<30;yy+=8){g.beginPath();g.moveTo(-54,yy);g.lineTo(-10,yy);g.stroke();g.beginPath();g.moveTo(10,yy);g.lineTo(54,yy);g.stroke();}
  crest(g,32,10,.6,'#7a1b1b');
  g.save();g.translate(-160,-20);g.rotate(-.18);rect(g,-46,-30,92,60,'#d8c493','#6b5430',2);crest(g,0,4,.6,'#7a1b1b');g.restore();
  g.save();g.translate(150,-14);g.rotate(.22);rect(g,-34,-8,68,16,'#e4d6b4','#6b5430',2);rect(g,-38,-10,8,20,'#b48a3a');rect(g,30,-10,8,20,'#b48a3a');g.restore();
  for(const [x,y] of [[-110,40],[-70,52],[90,44]]){ellipse(g,x,y+6,9,4,'#8a6a2a');rect(g,x-4,y-12,8,18,'#c9a24a');ellipse(g,x,y-12,7,3,'#e5c05a');}
  for(const [x,y] of [[-200,20],[0,-72],[200,24]]){
   rect(g,x-6,y-24,12,26,'#f0e6c8','#a89a7a',1);ellipse(g,x,y+2,12,5,'#b48a3a','#4a3410',2);
   light(g,x,y-40,90,.7+Math.sin(time*6.7+x)*.15);flame(g,x,y-24,.55,time,x*.1);
  }
  for(const x of [-160,0,160])chair(g,x,96,false);
 }
 function brazier(g,time,seed){
  rect(g,-3,-30,6,34,'#2c2320');
  for(const a of [-1,0,1])rect(g,a*12-3,-4,6,16,'#2c2320');
  ellipse(g,0,-34,24,10,'#3b302a','#17120f',3);ellipse(g,0,-38,18,6,'#d7602a');
  light(g,0,-60,170,.9+Math.sin(time*5.7+seed)*.1);
  flame(g,-6,-38,.9,time,seed);flame(g,7,-40,.8,time,seed+2);
 }
 /* Where each painting sits on its anchor: drawn height, how far below the anchor its bottom edge
    lands, where its light pools (u, v of the picture, radius) and, for the ones that burn, where the
    living fire stands on the painted one (u, v of the coals or the torch cup, size). */
 const ART={
  pillar:{key:'pillar',h:330,drop:22,glow:[.87,.43,150],fire:[.875,.455,.5]},
  throne:{key:'throne',h:320,drop:26,glow:[.5,.30,200]},
  table:{key:'table',h:286,drop:143,glow:[.47,.30,200]},
  brazier:{key:'brazier',h:104,drop:12,glow:[.5,.20,190],fire:[.5,.30,1]},
 };
 function drawArt(g,s,time,images){
  const a=ART[s.kind],im=a&&images[a.key];
  if(!ready(im))return false;
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,H=a.h,W=H*iw/ih;
  /* the pillar's torch is painted on its right: the east row is mirrored so every torch faces the carpet */
  const flip=s.kind==='pillar'&&s.side>0?-1:1;
  g.save();g.scale(flip,1);
  g.drawImage(im,-W/2,a.drop-H,W,H);
  const [u,v,r]=a.glow,flick=.85+Math.sin(time*5.7+s.x*.01+s.y*.013)*.15;
  light(g,-W/2+u*W,a.drop-H+v*H,r,flick*(s.kind==='throne'?.55:.9),s.kind==='throne'?[255,214,130]:undefined);
  if(a.fire)fire(g,-W/2+a.fire[0]*W,a.drop-H+a.fire[1]*H,a.fire[2],time,s.x*.013+s.y*.007);
  g.restore();
  return true;
 }
 function drawProp(g,s,time=0,images={},options={}){
  rememberedImages={...rememberedImages,...images};
  if(drawArt(g,s,time,rememberedImages))return;
  if(s.kind==='pillar')pillar(g,s,time,rememberedImages,options);
  else if(s.kind==='throne')throne(g,time);
  else if(s.kind==='table')councilTable(g,time);
  else if(s.kind==='brazier')brazier(g,time,s.x*.01);
 }

 return Object.freeze({create,contains,renderGround,drawProp,drawShadow,
  W,H,HALL,COUNCIL,DOORS,DAIS,THRONE,KING,TABLE,HAND,EXIT,SPAWN,PILLAR_X,PILLAR_Y,GUARDS,KING_NAME,HAND_NAME,ART});
});
