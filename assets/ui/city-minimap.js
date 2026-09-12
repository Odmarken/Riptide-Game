/* North-up City navigation. Geometry comes from the live world, never a second map.
 * The small terrain atlas is built once per visit; only the local crop and markers move. */
(function(root){
 'use strict';
 const SIZE=180,CENTER=90,RADIUS=86,RANGE=2600,SCALE=RADIUS/RANGE;
 const PLACES={
  cathedral:{name:'Church',color:'#f4dfaa',path:'M-5 6V-2L0-7L5-2V6ZM0-7V-11M-3-9H3M-1 6V2H1V6'},
  well:{name:'Well',color:'#81d9ea',path:'M-7-2L0-7L7-2M-5-2V6M5-2V6M-6 2H6M-6 6H6M0-2V2M-2 2V5H2V2'},
  smelter:{name:'Furnace',color:'#ffa269',path:'M0-9C1-3 7-2 6 3C5 9-6 9-6 2C-6-1-3-3-3-5C-3-2-1-1 0-9ZM0 1C-4 5-1 7 1 6C4 5 2 3 0 1'},
  minehall:{name:'Mining Hall',color:'#bed6db',path:'M-5 8L4-5M-8-3C-1-9 5-7 8-1M-2-6L3-2'},
  enchanthall:{name:'Enchanting',color:'#d6a8ff',path:'M0-9L6 0L0 9L-6 0ZM-6 0H6M0-9V9M-9-6H-5M-7-8V-4'},
  altarportal:{name:'City gate',color:'#dac294',path:'M-6 7V-7H6V7M-2 7V-1Q0-5 2-1V7M-7-7V-10M0-7V-10M7-7V-10'}
 };
 function project(point,hero){return {x:CENTER+(point.x-hero.x)*SCALE,y:CENTER+(point.y-hero.y)*SCALE};}
 function markers(world,hero){
  const result=(world.solids||[]).filter(s=>PLACES[s.type]).map(s=>{
   const p=project(s,hero),dx=p.x-CENTER,dy=p.y-CENTER,distance=Math.hypot(dx,dy);
   return {...PLACES[s.type],type:s.type,x:p.x,y:p.y,angle:Math.atan2(dy,dx),far:distance>72,
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
 function create(el){
  const canvas=el.querySelector('canvas'),g=canvas.getContext('2d'),tip=el.querySelector('.minimap-tip');
  const paths=Object.fromEntries(Object.entries(PLACES).map(([key,p])=>[key,new Path2D(p.path)]));
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
   const visible=!!(active&&world&&hero);
   if(el.hidden===visible)el.hidden=!visible;
   if(!visible){cachedWorld=null;atlas=null;lastX=lastY=null;lastTime=-Infinity;return;}
   if(world!==cachedWorld){cachedWorld=world;atlas=terrain(world);lastTime=-Infinity;lastX=lastY=null;heading=hero.fx<0?Math.PI:0;}
   if(time-lastTime<50)return;
   lastTime=time;
   const dpr=Math.min(2,root.devicePixelRatio||1),pixels=Math.round(SIZE*dpr);
   if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=canvas.height=pixels;}
   g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,SIZE,SIZE);
   if(lastX!==null&&Math.hypot(hero.x-lastX,hero.y-lastY)>.1)heading=Math.atan2(hero.y-lastY,hero.x-lastX);
   lastX=hero.x;lastY=hero.y;
   g.save();g.beginPath();g.arc(CENTER,CENTER,RADIUS,0,Math.PI*2);g.clip();
   g.fillStyle='#252e27';g.fillRect(0,0,SIZE,SIZE);
   // Draw the cached atlas with an affine transform; the circular clip also
   // handles players at the city wall without stretching a cropped source rect.
   g.drawImage(atlas.canvas,CENTER-hero.x*SCALE,CENTER-hero.y*SCALE,atlas.canvas.width/atlas.scale*SCALE,atlas.canvas.height/atlas.scale*SCALE);
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
