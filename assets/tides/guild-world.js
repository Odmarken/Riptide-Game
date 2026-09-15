/* The underground Tides Guild. Existing painted stone art supplies the surfaces;
 * the guild's masonry, inlays and torch light are canvas scenery, not a map-sized bitmap. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TideGuildWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const HALL=Object.freeze({x:1100,y:900,r:780});
 const CORRIDOR=Object.freeze({x:970,y:1550,w:260,h:950});
 const JOIN=Math.acos(CORRIDOR.w/2/HALL.r),JOIN_Y=HALL.y+Math.sin(JOIN)*HALL.r;
 const imageTiles=new WeakMap(),contextPatterns=new WeakMap();
 let rememberedImages={};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const ready=im=>!!(im&&im.complete!==false&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0);
 function create({catalog=[],rng=Math.random,maxLevel=30}={}){
  const pick=list=>list[Math.min(list.length-1,Math.floor(clamp(Number(rng())||0,0,.999999)*list.length))];
  const originals=catalog.filter(s=>s&&typeof s.id==='string'&&!s.hybrid),hybrids=catalog.filter(s=>s&&typeof s.id==='string'&&s.hybrid);
  const level=clamp(Math.floor(Number(maxLevel)||30),1,30);
  const members=[['Arvid',-490,-180],['Milo',-365,-455],['Sigge',365,-455],['Vidar',490,-180],['Filip',-465,300],['Nils',465,300]];
  const npcs=members.map(([name,dx,dy],i)=>{
   const pool=i%2&&hybrids.length?hybrids:originals.length?originals:hybrids;
   const species=pool.length?pick(pool):null;
   return {id:'tides-guild-member-'+i,name,x:HALL.x+dx,y:HALL.y+dy,r:18,big:1.3,
    race:'human',cls:'warrior',female:false,artKey:'sebbe',guildRole:'member',fx:dx<0?1:-1,fy:0,walk:0,moving:false,
    tideSpeciesId:species?.id||null,tideLevel:level,tide:species?{speciesId:species.id,level,xp:0}:null,
    tideSpot:{x:HALL.x+dx+(dx<0?105:-105),y:HALL.y+dy+42}};
  });
  npcs.push({id:'tides-guild-host',name:'Battle',x:HALL.x,y:HALL.y-20,r:20,big:1.5,
   race:'human',cls:'warrior',female:false,artKey:'sebbe',guildRole:'host',game:'tideguild',fx:1,fy:0,walk:0,moving:false});
  return {key:'tidesguild',kind:'tidesguild',guild:true,w:2200,h:2600,
   hall:{...HALL},corridor:{...CORRIDOR},spawn:{x:1100,y:2360},exit:{x:1100,y:2460,r:70,id:'city'},
   portal:{x:-500,y:-500},npcs,solids:[],mwalls:[],deco:[],waters:[],paths:[],floors:[],enemySpawns:[],bossRooms:[],entrances:[],pathY:-500,pathH:0};
 }
 function segmentDistance(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-ax-dx*t,y-ay-dy*t);
 }
 function contains(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  const dx=x-HALL.x,dy=y-HALL.y,d=Math.hypot(dx,dy);
  const inHall=d<=HALL.r,inCorridor=x>=CORRIDOR.x&&x<=CORRIDOR.x+CORRIDOR.w&&y>=CORRIDOR.y&&y<=CORRIDOR.y+CORRIDOR.h;
  if(!inHall&&!inCorridor)return false;
  if(!r)return true;
  // Distance to the exposed perimeter, rather than shrinking the two shapes
  // separately: a full-sized actor can pass smoothly through the round doorway.
  const angle=(Math.atan2(dy,dx)+TAU)%TAU;
  const circleDistance=angle>JOIN&&angle<Math.PI-JOIN
   ? Math.min(Math.hypot(x-CORRIDOR.x,y-JOIN_Y),Math.hypot(x-CORRIDOR.x-CORRIDOR.w,y-JOIN_Y))
   : Math.abs(d-HALL.r);
  const bottom=CORRIDOR.y+CORRIDOR.h;
  return Math.min(circleDistance,
   segmentDistance(x,y,CORRIDOR.x,JOIN_Y,CORRIDOR.x,bottom),
   segmentDistance(x,y,CORRIDOR.x+CORRIDOR.w,JOIN_Y,CORRIDOR.x+CORRIDOR.w,bottom),
   segmentDistance(x,y,CORRIDOR.x,bottom,CORRIDOR.x+CORRIDOR.w,bottom))>=r-.00001;
 }
 function floorPath(g){
  g.beginPath();g.moveTo(CORRIDOR.x+CORRIDOR.w,CORRIDOR.y+CORRIDOR.h);
  g.lineTo(CORRIDOR.x+CORRIDOR.w,JOIN_Y);
  g.arc(HALL.x,HALL.y,HALL.r,JOIN,Math.PI-JOIN,true);
  g.lineTo(CORRIDOR.x,CORRIDOR.y+CORRIDOR.h);g.closePath();
 }
 function canvas(size,options){
  const c=options?.createCanvas?options.createCanvas(size,size):typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):null;
  if(c)c.width=c.height=size;return c;
 }
 function tile(im,options){
  if(!ready(im))return null;
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
  let c=imageTiles.get(im);if(c&&c.sourceWidth===iw&&c.sourceHeight===ih)return c.canvas;
  const out=canvas(384,options);if(!out)return im;
  const p=out.getContext('2d');
  // Mirrored quarters join without the source art's dark outer vignette seams.
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
  if(!pattern)return;
  g.save();g.scale(scale,scale);g.fillStyle=pattern;g.fillRect(rect.x/scale,rect.y/scale,rect.w/scale,rect.h/scale);g.restore();
 }
 function ellipse(g,x,y,rx,ry,fill,stroke,width=1){
  g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
 }
 function light(g,x,y,r,strength=1){
  const glow=g.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(255,194,102,'+.25*strength+')');glow.addColorStop(.4,'rgba(223,139,63,'+.12*strength+')');glow.addColorStop(1,'rgba(191,113,41,0)');
  g.fillStyle=glow;g.fillRect(x-r,y-r,r*2,r*2);
 }
 function torch(g,x,y,time,size=1){
  g.save();g.translate(x,y);g.scale(size,size);
  const sway=Math.sin(time*4.1+x*.035)*2.5,flicker=.92+Math.sin(time*7+y*.021)*.08;
  light(g,0,-22,150,flicker);
  ellipse(g,4,18,28,9,'rgba(0,0,0,.35)');
  const metal=g.createLinearGradient(-10,0,10,0);metal.addColorStop(0,'#211c17');metal.addColorStop(.5,'#79603c');metal.addColorStop(1,'#27221b');
  g.fillStyle=metal;g.fillRect(-7,-7,14,32);ellipse(g,0,24,18,5,'#66503a','#211d18',3);
  g.beginPath();g.moveTo(-21,-12);g.lineTo(-13,3);g.quadraticCurveTo(0,11,13,3);g.lineTo(21,-12);g.closePath();g.fillStyle=metal;g.fill();g.strokeStyle='#ac8450';g.lineWidth=3;g.stroke();
  g.beginPath();g.moveTo(-13,-13);g.bezierCurveTo(-23,-32,-3,-38,sway-2,-61*flicker);g.bezierCurveTo(3,-43,23,-30,12,-13);g.closePath();g.fillStyle='#e98032';g.fill();
  g.beginPath();g.moveTo(-8,-13);g.quadraticCurveTo(-11,-27,sway+2,-45*flicker);g.quadraticCurveTo(4,-25,9,-13);g.closePath();g.fillStyle='#ffd17a';g.fill();
  ellipse(g,0,-15,5,9,'#fff0ba');g.restore();
 }
 function pillar(g,x,y,images,size=1,options){
  g.save();g.translate(x,y);g.scale(size,size);
  ellipse(g,13,10,69,22,'rgba(0,0,0,.48)');
  g.fillStyle='#413e39';g.fillRect(-39,-139,78,135);texture(g,images.raidwall||images.cryptwall,{x:-39,y:-139,w:78,h:135},.65,options);
  const shade=g.createLinearGradient(-39,0,39,0);shade.addColorStop(0,'rgba(0,0,0,.58)');shade.addColorStop(.35,'rgba(239,213,149,.10)');shade.addColorStop(1,'rgba(0,0,0,.42)');g.fillStyle=shade;g.fillRect(-39,-139,78,135);
  for(const yy of [-128,-83,-38]){g.strokeStyle='rgba(13,15,16,.75)';g.lineWidth=3;g.beginPath();g.moveTo(-38,yy);g.lineTo(38,yy);g.stroke();}
  for(const yy of [-146,-13]){g.fillStyle='#524e43';g.fillRect(-48,yy,96,18);texture(g,images.raidwall||images.cryptwall,{x:-48,y:yy,w:96,h:18},.55,options);g.strokeStyle='#242725';g.lineWidth=3;g.strokeRect(-48,yy,96,18);g.fillStyle='rgba(211,193,140,.28)';g.fillRect(-46,yy+2,92,3);}
  ellipse(g,0,-148,47,11,'#6d6553','#292c29',3);
  g.save();g.beginPath();g.ellipse(0,-148,44,9,0,0,TAU);g.clip();texture(g,images.raidfloor,{x:-44,y:-157,w:88,h:18},.45,options);g.fillStyle='rgba(182,164,119,.18)';g.fillRect(-44,-157,88,18);g.restore();g.restore();
 }
 function crest(g,x,y,size,color='#b5a879'){
  g.save();g.translate(x,y);g.scale(size,size);g.strokeStyle=color;g.lineWidth=2.4;g.lineCap='round';
  g.beginPath();g.moveTo(0,-20);g.lineTo(0,20);g.moveTo(-14,-12);g.quadraticCurveTo(-14,6,0,7);g.quadraticCurveTo(14,6,14,-12);g.stroke();
  for(let i=0;i<2;i++){g.beginPath();g.moveTo(-22,12+i*10);g.bezierCurveTo(-12,3+i*10,-6,23+i*10,4,14+i*10);g.bezierCurveTo(12,7+i*10,16,12+i*10,22,13+i*10);g.stroke();}g.restore();
 }
 function banner(g,x,y,size=1){
  g.save();g.translate(x,y);g.scale(size,size);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(-36,7,79,116);
  g.beginPath();g.moveTo(-37,0);g.lineTo(37,0);g.lineTo(37,113);g.lineTo(0,135);g.lineTo(-37,113);g.closePath();
  const silk=g.createLinearGradient(-37,0,37,0);silk.addColorStop(0,'#102c2b');silk.addColorStop(.45,'#29574e');silk.addColorStop(1,'#17342e');g.fillStyle=silk;g.fill();g.strokeStyle='#a1864e';g.lineWidth=3;g.stroke();
  g.strokeStyle='#7d6037';g.lineWidth=7;g.beginPath();g.moveTo(-48,-4);g.lineTo(48,-4);g.stroke();crest(g,0,54,1.25,'#ccb773');g.restore();
 }
 function inlay(g,x,y,r,sy=1){
  g.save();g.translate(x,y);g.scale(1,sy);
  ellipse(g,0,0,r+19,r+19,null,'rgba(8,13,14,.65)',27);
  for(let i=0;i<48;i++){
   const a=i*TAU/48+.011,b=(i+1)*TAU/48-.011;
   g.beginPath();g.arc(0,0,r+23,a,b);g.arc(0,0,r-5,b,a,true);g.closePath();
   g.fillStyle=['#7f7760','#8b8064','#686655','#a29470'][i%4];g.fill();g.strokeStyle='#363b35';g.lineWidth=2;g.stroke();
  }
  ellipse(g,0,0,r-9,r-9,null,'rgba(166,143,82,.65)',3);
  ellipse(g,0,0,r-27,r-27,null,'rgba(114,147,136,.34)',2);
  for(let i=0;i<8;i++){
   g.save();g.rotate(i*TAU/8);g.translate(0,-r+62);g.rotate(-i*TAU/8);
   ellipse(g,0,0,18,18,'rgba(12,34,32,.5)','#877650',2);crest(g,0,0,.43,'#a4b5a0');g.restore();
  }
  crest(g,0,-9,r/90,'rgba(162,166,126,.25)');g.restore();
 }
 function doorwayStairs(g){
  for(let i=0;i<5;i++){
   const y=2424+i*14;g.fillStyle=i%2?'#6a6556':'#766b57';g.fillRect(1018,y,164,13);
   g.fillStyle='rgba(0,0,0,.48)';g.fillRect(1018,y+10,164,3);g.fillStyle='rgba(205,187,135,.24)';g.fillRect(1018,y,164,2);
  }
  ellipse(g,1100,2480,51,8,'rgba(88,183,178,.13)');
  g.save();g.textAlign='center';g.textBaseline='middle';g.font='bold 19px Georgia, serif';
  g.strokeStyle='rgba(5,13,15,.88)';g.lineWidth=5;g.strokeText('↑ City',1100,2406);
  g.fillStyle='#c7ddd0';g.fillText('↑ City',1100,2406);g.restore();
 }
 function renderGround(g,world,view,{images={},time=0,...options}={}){
  rememberedImages={...rememberedImages,...images};images=rememberedImages;
  const v={x:Math.max(-120,view?.x||0),y:Math.max(-180,view?.y||0),w:Math.min(2440,view?.w||2200),h:Math.min(2960,view?.h||2600)};
  g.save();g.fillStyle='#131b1c';g.fillRect(view?.x||0,view?.y||0,view?.w||2200,view?.h||2600);
  // Heavy outer masonry is exposed above the walkable floor, with an unbroken
  // rim around both the circular hall and descending passage.
  floorPath(g);g.strokeStyle='#090e10';g.lineWidth=160;g.stroke();
  g.save();floorPath(g);g.lineWidth=104;g.strokeStyle=patternFor(g,images.raidwall||images.cryptwall,options)||'#4c5149';g.stroke();g.lineWidth=104;g.strokeStyle='rgba(88,91,69,.32)';g.stroke();g.restore();
  g.save();floorPath(g);g.clip();g.fillStyle='#3b4039';g.fillRect(v.x,v.y,v.w,v.h);texture(g,images.raidfloor||images.crypt,v,.95,options);
  g.fillStyle='rgba(134,116,74,.17)';g.fillRect(v.x,v.y,v.w,v.h);
  const pool=g.createRadialGradient(HALL.x,HALL.y,30,HALL.x,HALL.y,HALL.r);pool.addColorStop(0,'rgba(128,169,151,.15)');pool.addColorStop(.7,'rgba(37,54,48,.06)');pool.addColorStop(1,'rgba(3,11,15,.68)');g.fillStyle=pool;g.fillRect(300,100,1600,1600);
  // A restrained gilt route leads the player up from the City well.
  for(const x of [996,1204]){g.fillStyle='#605f4a';g.fillRect(x,JOIN_Y,3,2500-JOIN_Y);}
  for(let y=1730;y<2380;y+=160){ellipse(g,1100,y,14,14,'rgba(120,129,100,.2)','#727259',2);crest(g,1100,y,.31,'#929c7f');}
  inlay(g,HALL.x,HALL.y,290);ellipse(g,HALL.x,HALL.y,654,654,null,'rgba(130,138,107,.30)',4);
  doorwayStairs(g);g.restore();
  // Individual capstones break up the border, rather than a featureless outline.
  floorPath(g);g.lineWidth=10;g.strokeStyle='#a09574';g.stroke();
  for(let i=0;i<68;i++){
   const angle=i*TAU/68;if(angle>JOIN&&angle<Math.PI-JOIN)continue;
   const cs=Math.cos(angle),sn=Math.sin(angle);
   g.beginPath();g.moveTo(HALL.x+cs*784,HALL.y+sn*784);g.lineTo(HALL.x+cs*825,HALL.y+sn*825);g.strokeStyle='#242c2a';g.lineWidth=4;g.stroke();
  }
  for(const x of [CORRIDOR.x,CORRIDOR.x+CORRIDOR.w])for(let y=JOIN_Y+30;y<2500;y+=76){g.fillStyle='#252d2a';g.fillRect(x-46,y,92,4);}
  for(const a of [-Math.PI*.94,-Math.PI*.72,-Math.PI*.5,-Math.PI*.28,-Math.PI*.06,Math.PI*.22,Math.PI*.78]){
   const x=HALL.x+Math.cos(a)*807,y=HALL.y+Math.sin(a)*807;
   if(x+100<v.x||x-100>v.x+v.w||y+60<v.y||y-170>v.y+v.h)continue;
   pillar(g,x,y,images,1,options);torch(g,x,y-42,time,.95);
  }
  for(const y of [1790,2080,2380])for(const x of [947,1253]){
   if(y+180<v.y||y-180>v.y+v.h)continue;
   torch(g,x,y,time,.75);
  }
  banner(g,790,220,1.3);banner(g,1410,220,1.3);
  // Fixed wall lights give resting members their own warm gathering spots.
  for(const n of world.npcs||[])if(n.guildRole==='member')light(g,n.x,n.y+15,150,.45);
  g.restore();
 }
 function renderBattle(g,w,h,time=0,{images={},...options}={}){
  if(!(w>0&&h>0))return;
  rememberedImages={...rememberedImages,...images};images=rememberedImages;
  g.save();g.fillStyle='#172326';g.fillRect(0,0,w,h);
  const wallH=h*.40;
  texture(g,images.raidwall||images.cryptwall,{x:0,y:0,w,h:wallH},1.35,options);
  g.fillStyle='rgba(6,16,19,.46)';g.fillRect(0,0,w,wallH);
  g.save();g.beginPath();g.rect(0,wallH,w,h-wallH);g.clip();
  g.fillStyle='#39413b';g.fillRect(0,wallH,w,h-wallH);texture(g,images.raidfloor||images.crypt,{x:0,y:wallH,w,h:h-wallH},1.2,options);
  g.fillStyle='rgba(91,108,83,.15)';g.fillRect(0,wallH,w,h-wallH);
  const floorShade=g.createLinearGradient(0,wallH,0,h);floorShade.addColorStop(0,'rgba(0,9,13,.55)');floorShade.addColorStop(.45,'rgba(14,30,29,.02)');floorShade.addColorStop(1,'rgba(5,11,16,.63)');g.fillStyle=floorShade;g.fillRect(0,wallH,w,h-wallH);
  inlay(g,w*.50,h*.69,w*.415,Math.min(.5,h/w*.64));g.restore();
  // Actors occupy y=.60-.72h; the hanging standards and braziers stay behind them.
  const unit=clamp(h/730,.65,1.8);
  for(const x of [w*.055,w*.27,w*.73,w*.945]){pillar(g,x,wallH+19*unit,images,1.45*unit,options);torch(g,x,wallH-54*unit,time,1.05*unit);}
  banner(g,w*.38,wallH-204*unit,.94*unit);banner(g,w*.62,wallH-204*unit,.94*unit);
  const glow=g.createRadialGradient(w*.5,h*.63,0,w*.5,h*.63,w*.51);glow.addColorStop(0,'rgba(114,186,172,.10)');glow.addColorStop(.65,'rgba(61,96,91,.02)');glow.addColorStop(1,'rgba(3,9,13,.38)');g.fillStyle=glow;g.fillRect(0,0,w,h);
  // A few slow motes belong to the torch-lit air, independent of battle effects.
  g.fillStyle='rgba(255,215,145,.28)';for(let i=0;i<16;i++){
   const x=(i*.61803398875%1)*w+Math.sin(time*.25+i)*8,y=((i*137-time*7)%(h*.66)+h*.66)%(h*.66);
   ellipse(g,x,y,1.2*unit,1.2*unit,'rgba(255,215,145,.25)');
  }
  g.restore();
 }
 return Object.freeze({create,contains,renderGround,renderBattle,HALL,CORRIDOR});
});
