/* North-up local navigation from the live world. City keeps its small terrain
 * atlas; Wasteland's sparse roads stay sharp as vectors at every map position. */
(function(root){
 'use strict';
 const SIZE=180,CENTER=90,RADIUS=86,RANGE=2600,SCALE=RADIUS/RANGE;
 const HOME={name:'Home',color:'#dac294',path:'M-8-1L0-8L8-1M-6-2V7H6V-2M-2 7V1H2V7'};
 const STABLE={name:'Torsten Tygel · Mounts',color:'#e8c681',path:'M-6-8V1C-6 10 6 10 6 1V-8H2V1C2 5-2 5-2 1V-8ZM-6-5H-2M2-5H6'};
 const TRAINING={name:'Tide Training Grounds',color:'#83d7c8',path:'M-8-2L0-9L8-2M-6-3V8H6V-3M-2 6Q-4 4-2 2Q0 0 2 2Q4 4 2 6ZM-3-1H-2M2-1H3M-1-3H1'};
 const BIOMES={
  wasteland:{name:'Wasteland',ground:'#424632',lip:'#2b3024',road:'#c5ae7c',track:'#998565'},
  'wasteland-snow':{name:'Snowfields',ground:'#bacdd1',lip:'#657c85',road:'#eff3e8',track:'#d0dde0'},
  'wasteland-desert':{name:'Desert',ground:'#bda06b',lip:'#80623f',road:'#ead4a1',track:'#d4b981'}
 };
 const CITY_LABEL='City minimap. North is up; the white arrow is you. Symbols show the Church, Well, Furnace, Mining Hall, Enchanting, Throne Hall, Harbour and City gate. Distant places appear along the rim.';
 const WASTELAND_LABEL='Wasteland minimap. North is up; the white arrow is you. Roads, the Home portal, Torsten Tygel’s mounts and the Tide Training Grounds are shown. Distant places appear along the rim.';
 const wasteland=world=>!!BIOMES[world.key]&&!world.dungeon;
 const biome=world=>BIOMES[world.key]||BIOMES.wasteland;
 const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const PLACES={
  cathedral:{name:'Church',color:'#f4dfaa',path:'M-5 6V-2L0-7L5-2V6ZM0-7V-11M-3-9H3M-1 6V2H1V6'},
  well:{name:'Well',color:'#81d9ea',path:'M-7-2L0-7L7-2M-5-2V6M5-2V6M-6 2H6M-6 6H6M0-2V2M-2 2V5H2V2'},
  smelter:{name:'Furnace',color:'#ffa269',path:'M0-9C1-3 7-2 6 3C5 9-6 9-6 2C-6-1-3-3-3-5C-3-2-1-1 0-9ZM0 1C-4 5-1 7 1 6C4 5 2 3 0 1'},
  minehall:{name:'Mining Hall',color:'#bed6db',path:'M-5 8L4-5M-8-3C-1-9 5-7 8-1M-2-6L3-2'},
  enchanthall:{name:'Enchanting',color:'#d6a8ff',path:'M0-9L6 0L0 9L-6 0ZM-6 0H6M0-9V9M-9-6H-5M-7-8V-4'},
  altarportal:{name:'City gate',color:'#dac294',path:'M-6 7V-7H6V7M-2 7V-1Q0-5 2-1V7M-7-7V-10M0-7V-10M7-7V-10'},
  palacestair:{name:'Throne Hall',color:'#ffd27a',path:'M-8 6H8L9-3L4 0L0-7L-4 0L-9-3ZM-6 3H6'},
  harborstair:{name:'Harbour',color:'#8fd0ea',path:'M0-9A2 2 0 1 0 0-5A2 2 0 1 0 0-9M0-5V8M-4-2H4M-8 2C-7 7-3 8 0 8C3 8 7 7 8 2M-8 2L-10 5M8 2L10 5'}
 };
 function project(point,hero){return {x:CENTER+(point.x-hero.x)*SCALE,y:CENTER+(point.y-hero.y)*SCALE};}
 function markers(world,hero){
  if(world.dungeon)return [];
  // Only named public services belong on this map. Never enumerate entrances,
  // enemies or generic travel doors: dungeons must still be discovered on foot.
  const landmarks=wasteland(world)?[
   point(world.exit)?{...world.exit,type:'homeportal'}:null,
   point(world.stable?.vendor)?{...world.stable.vendor,type:'stable'}:null,
   point(world.training?.vendor||world.training?.building)?{...(world.training.vendor||world.training.building),type:'training'}:null
  ].filter(Boolean):
   (world.solids||[]).filter(s=>PLACES[s.type]&&point(s));
  const result=landmarks.map(s=>{
   const p=project(s,hero),dx=p.x-CENTER,dy=p.y-CENTER,distance=Math.hypot(dx,dy);
   return {...(s.type==='homeportal'?HOME:s.type==='stable'?STABLE:s.type==='training'?TRAINING:PLACES[s.type]),type:s.type,x:p.x,y:p.y,angle:Math.atan2(dy,dx),far:distance>72,
    distance:Math.hypot(s.x-hero.x,s.y-hero.y)};
  });
  const placed=result.filter(p=>!p.far);
  // Several halls share almost the same bearing at the west gate. Spread only edge
  // badges; their short bearing lines still point toward the exact world position.
  for(const p of result.filter(p=>p.far)){
   let best=null;
   for(let k=0;k<64;k++){
    const offset=(k%2?1:-1)*Math.ceil(k/2)*Math.PI/32,a=p.angle+offset;
    const x=CENTER+Math.cos(a)*72,y=CENTER+Math.sin(a)*72;
    const clearance=Math.min(...placed.map(q=>Math.hypot(x-q.x,y-q.y)),Infinity);
    if(!best||clearance>best.clearance)best={x,y,clearance};
    if(clearance>=23){best={x,y,clearance};break;}
   }
   p.x=best.x;p.y=best.y;placed.push(p);
  }
  return result;
 }
 function terrain(world){
  if(wasteland(world)){
   // Cache only this visit's finite path geometry. A local vector pass avoids a
   // low-resolution atlas of the 50,400-unit world and needs no growing tile cache.
   const roads=[];
   for(const road of [...(world.paths||[]),...(world.edgePaths||[])]){
    if(!Number.isFinite(road.width)||road.width<=0)continue;
    let points=[];
    const finish=()=>{
     if(points.length>1)roads.push({points,width:road.width,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))});
     points=[];
    };
    for(const p of road.points||[]){if(point(p))points.push({x:p.x,y:p.y});else finish();}finish();
   }
   const regions=Array.isArray(world.regions)?world.regions.filter(r=>point(r)&&r.w>0&&r.h>0).map(r=>({...r,palette:BIOMES[r.key]||biome(world)})):
    [{x:0,y:0,w:world.w,h:world.h,palette:biome(world)}];
   return {roads,w:world.w,h:world.h,regions};
  }
  const atlas=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(world.w,world.h));
  atlas.width=Math.ceil(world.w*scale);atlas.height=Math.ceil(world.h*scale);
  const g=atlas.getContext('2d');g.scale(scale,scale);
  g.fillStyle='#424632';g.fillRect(0,0,world.w,world.h);
  for(const s of world.solids||[]){
   if(s.type!=='cityhouse')continue;
   const w=Math.max(90,s.r*4.2),h=w*.65;
   g.fillStyle='#292c23';g.fillRect(s.x-w/2+18,s.y-h/2+18,w,h);
   g.fillStyle='#73604a';g.fillRect(s.x-w/2,s.y-h/2,w,h);
   g.fillStyle='#907450';g.fillRect(s.x-w/2,s.y-h/2,w,h*.25);
  }
  g.fillStyle='#ae9569';
  for(const p of world.plazas||[]){g.beginPath();g.ellipse(p.x,p.y,p.r,p.r*.82,0,0,Math.PI*2);g.fill();}
  for(const s of world.solids||[]){ // the palace stair: a carpeted flight running east to its gate in the wall
   if(s.type!=='palacestair')continue;
   g.fillStyle='#8f8672';g.fillRect(s.x-600,s.y-105,620,210);
   g.fillStyle='#7a1b1b';g.fillRect(s.x-600,s.y-28,620,56);
  }
  for(const s of world.solids||[]){ // the harbour flight: a blue-carpeted flight running south to its gate in the wall
   if(s.type!=='harborstair')continue;
   g.fillStyle='#8f8672';g.fillRect(s.x-125,s.y-640,250,660);
   g.fillStyle='#22345a';g.fillRect(s.x-34,s.y-640,68,660);
  }
  g.lineCap='round';
  for(const road of world.streets||[]){
   g.beginPath();g.moveTo(road.x0,road.y0);g.lineTo(road.x1,road.y1);
   g.strokeStyle='#2b3024';g.lineWidth=road.w+35;g.stroke();
   g.strokeStyle=road.w>=180?'#c5ae7c':'#998565';g.lineWidth=road.w;g.stroke();
  }
  for(const wall of world.mwalls||[]){
   g.fillStyle='#252b24';g.fillRect(wall.x,wall.y,wall.w,wall.h);
   g.strokeStyle='#8c8970';g.lineWidth=32;g.strokeRect(wall.x,wall.y,wall.w,wall.h);
  }
  return {canvas:atlas,scale};
 }
 function drawTerrain(g,atlas,hero){
  if(atlas.canvas){
   // An affine transform keeps City terrain undistorted near world boundaries.
   g.drawImage(atlas.canvas,CENTER-hero.x*SCALE,CENTER-hero.y*SCALE,atlas.canvas.width/atlas.scale*SCALE,atlas.canvas.height/atlas.scale*SCALE);
   return;
  }
  g.save();g.translate(CENTER-hero.x*SCALE,CENTER-hero.y*SCALE);g.scale(SCALE,SCALE);
  const regions=atlas.regions;
  // Clip the connected L-shaped continent itself, leaving the missing quadrant
  // dark rather than inventing terrain or a false route through it.
  g.beginPath();for(const r of regions)g.rect(r.x,r.y,r.w,r.h);g.clip();
  g.lineCap='round';g.lineJoin='round';
  for(const r of regions){
   if(r.x>hero.x+RANGE||r.y>hero.y+RANGE||r.x+r.w<hero.x-RANGE||r.y+r.h<hero.y-RANGE)continue;
   const palette=r.palette;g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();g.fillStyle=palette.ground;g.fillRect(r.x,r.y,r.w,r.h);
   for(const road of atlas.roads){
    const reach=RANGE+road.width/2+35;
    if(road.maxX<hero.x-reach||road.minX>hero.x+reach||road.maxY<hero.y-reach||road.minY>hero.y+reach)continue;
    g.beginPath();road.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
    g.strokeStyle=palette.lip;g.lineWidth=road.width+35;g.stroke();
    g.strokeStyle=road.width>=180?palette.road:palette.track;g.lineWidth=road.width;g.stroke();
   }
   g.restore();
  }
  g.restore();
 }
 function create(el){
  const canvas=el.querySelector('canvas'),g=canvas.getContext('2d'),tip=el.querySelector('.minimap-tip'),title=el.querySelector('.minimap-title');
  const paths=Object.fromEntries(Object.entries({...PLACES,homeportal:HOME,stable:STABLE,training:TRAINING}).map(([key,p])=>[key,new Path2D(p.path)]));
  let cachedWorld=null,atlas=null,lastTime=-Infinity,lastX=null,lastY=null,heading=0,places=[];
  let pointer=null;
  function tooltip(){
   const p=pointer&&places.find(p=>Math.hypot(p.x-pointer.x,p.y-pointer.y)<12);
   const text=p?p.name+(p.far?' · further away':''):'You · north is up';
   if(tip.textContent!==text)tip.textContent=text;
  }
  canvas.addEventListener('pointermove',e=>{
   const box=canvas.getBoundingClientRect();
   pointer={x:(e.clientX-box.left)*SIZE/box.width,y:(e.clientY-box.top)*SIZE/box.height};tooltip();
  });
  canvas.addEventListener('pointerleave',()=>{pointer=null;tooltip();});
  // The map owns its pointer area. A click or touch must not issue a walk command
  // or start the game canvas's pinch/drag gesture underneath it.
  for(const name of ['pointerdown','click','dblclick','contextmenu','wheel'])el.addEventListener(name,e=>{e.stopPropagation();if(name!=='pointerdown')e.preventDefault();});
  return {update(world,hero,active,time){
   const visible=!!(active&&world&&hero&&!world.dungeon);
   if(el.hidden===visible)el.hidden=!visible;
   if(!visible){cachedWorld=null;atlas=null;places=[];pointer=null;lastX=lastY=null;lastTime=-Infinity;tooltip();return;}
   if(world!==cachedWorld){
    cachedWorld=world;atlas=terrain(world);lastTime=-Infinity;lastX=lastY=null;heading=hero.fx<0?Math.PI:0;
    const landscape=biome(world),name=world.name||landscape.name;
    el.setAttribute('aria-label',wasteland(world)?WASTELAND_LABEL:CITY_LABEL);
    title.textContent=wasteland(world)?name.toUpperCase():'CITY';
   }
   if(time-lastTime<50)return;
   lastTime=time;
   const dpr=Math.min(2,root.devicePixelRatio||1),pixels=Math.round(SIZE*dpr);
   if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=canvas.height=pixels;}
   g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,SIZE,SIZE);
   if(lastX!==null&&Math.hypot(hero.x-lastX,hero.y-lastY)>.1)heading=Math.atan2(hero.y-lastY,hero.x-lastX);
   lastX=hero.x;lastY=hero.y;
   g.save();g.beginPath();g.arc(CENTER,CENTER,RADIUS,0,Math.PI*2);g.clip();
   g.fillStyle='#252e27';g.fillRect(0,0,SIZE,SIZE);
   drawTerrain(g,atlas,hero);
   const shade=g.createRadialGradient(CENTER,CENTER,40,CENTER,CENTER,RADIUS);
   shade.addColorStop(0,'rgba(15,20,15,0)');shade.addColorStop(1,'rgba(15,20,15,.46)');g.fillStyle=shade;g.fillRect(0,0,SIZE,SIZE);
   places=markers(world,hero);
   for(const p of places){
    if(p.far){
     const x=CENTER+Math.cos(p.angle)*84,y=CENTER+Math.sin(p.angle)*84;
     g.strokeStyle=p.color;g.globalAlpha=.55;g.lineWidth=1;
     g.beginPath();g.moveTo(p.x,p.y);g.lineTo(x,y);g.stroke();g.globalAlpha=1;
    }
    g.save();g.translate(p.x,p.y);
    g.shadowColor='#10160e';g.shadowBlur=3;g.fillStyle='#20271f';g.strokeStyle=p.color;g.lineWidth=1;
    g.beginPath();g.arc(0,0,10.5,0,Math.PI*2);g.fill();g.stroke();g.shadowBlur=0;
    g.strokeStyle=p.color;g.lineWidth=1.6;g.lineCap='round';g.lineJoin='round';g.scale(.8,.8);g.stroke(paths[p.type]);g.restore();
   }
   // A white heading arrow and cyan halo stay legible on roads and on venue badges.
   g.save();g.translate(CENTER,CENTER);g.rotate(heading);
   g.shadowColor='#8fe9ef';g.shadowBlur=8;g.fillStyle='rgba(84,215,225,.18)';
   g.beginPath();g.arc(0,0,11,0,Math.PI*2);g.fill();g.shadowBlur=0;
   g.fillStyle='#f1ffff';g.strokeStyle='#183b3b';g.lineWidth=1.5;
   g.beginPath();g.moveTo(8,0);g.lineTo(-5,-5);g.lineTo(-2,0);g.lineTo(-5,5);g.closePath();g.fill();g.stroke();g.restore();
   g.restore();tooltip();
  }};
 }
 root.CityMinimap=Object.freeze({create,project,markers});
})(typeof window==='undefined'?globalThis:window);
