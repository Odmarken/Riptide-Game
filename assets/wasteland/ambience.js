/* Sparse painted-ground accents, drawn after terrain and before units/telegraphs.
 * draw(ctx,world,{x,y,w,h},timeSeconds). Geometry is seeded once per world; no
 * images, canvases, particles, collision or gameplay state are allocated/changed. */
(function(root){
 'use strict';
 const cache=new WeakMap(),TAU=Math.PI*2;
 const palettes={briarhollow:true,cindervein:true,frostveil:true};
 function random(seed){return ()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),seed|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const visible=(a,b,p=0)=>a.x+a.w+p>b.x&&a.y+a.h+p>b.y&&a.x-p<b.x+b.w&&a.y-p<b.y+b.h;
 function linePoints(R,x,y,a,length){
  const result=[{x,y}];
  for(let j=1;j<=5;j++){
   const along=length*j/5,side=(R()-.5)*length*.30;
   result.push({x:x+Math.cos(a)*along-Math.sin(a)*side,y:y+Math.sin(a)*along+Math.cos(a)*side});
  }
  return result;
 }
 function ribbon(points,width){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
   const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;
   const w=width*(1-i/(points.length-1)*.93)/2,nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;
   left.push({x:p.x+nx*w,y:p.y+ny*w});right.push({x:p.x-nx*w,y:p.y-ny*w});
  }
  return left.concat(right.reverse());
 }
 function geometry(world){
  if(cache.has(world))return cache.get(world);
  const out=[],R=random((world.seed||13)^world.key.length*1327);
  for(const room of world.rooms||[]){
   const boss=room.kind==='boss',count=boss?11:4;
   for(let i=0;i<count;i++){
    const a=R()*TAU,rad=boss?(i<7?390+R()*180:170+R()*160):100+R()*180;
    const x=room.cx+Math.cos(a)*rad,y=room.cy+Math.sin(a)*rad*.82;
    const direction=a+Math.PI+(R()-.5)*1.1,length=55+R()*(boss?135:75);
    const stem=linePoints(R,x,y,direction,length),branches=[];
    for(let b=0;b<2;b++){
     const p=stem[2+b];branches.push(linePoints(R,p.x,p.y,direction+(b?-.7:.8),length*(.28+R()*.25)));
    }
    const patch=[];for(let j=0;j<9;j++){const angle=j*TAU/9,rr=.65+R()*.35;patch.push({x:x+Math.cos(angle)*length*.58*rr,y:y+Math.sin(angle)*length*.30*rr});}
    out.push({x,y,a,length,stem,branches,patch,ribbons:[stem,...branches].map((p,j)=>ribbon(p,j?3.8:7.5)),phase:R()*TAU,seed:R(),bounds:{x:x-230,y:y-230,w:460,h:460}});
   }
  }
  cache.set(world,out);return out;
 }
 function path(g,points){g.beginPath();g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);}
 function stroke(g,points,width,color,alpha,opacity){path(g,points);g.lineWidth=width;g.strokeStyle=color;g.globalAlpha=alpha*opacity;g.stroke();}
 function fill(g,points,color,alpha,opacity){path(g,points);g.closePath();g.fillStyle=color;g.globalAlpha=alpha*opacity;g.fill();}
 function roots(g,item,opacity,t){
  // Moss stains have broken edges; tapered earth-coloured strands sit within them.
  fill(g,item.patch,'#172b16',.20,opacity);
  for(const [index,points]of [item.stem,...item.branches].entries()){
   fill(g,item.ribbons[index],'#4c412b',.66,opacity);
   g.lineWidth=2;g.strokeStyle='#182017';g.globalAlpha=.34*opacity;g.stroke();
   stroke(g,points,index?.55:.8,'#938258',.30,opacity);
  }
  for(let j=0;j<5;j++){
   const p=item.patch[j],dx=4+item.seed*3,dy=2+item.seed*2;
   fill(g,[{x:p.x-dx,y:p.y},{x:p.x-1,y:p.y-dy},{x:p.x+dx,y:p.y+1},{x:p.x+1,y:p.y+dy}],j%2?'#758349':'#435b32',.50,opacity);
  }
  // A few tiny spores, close to the ground, never shaped like a danger marker.
  if(item.seed>.70){
   g.globalAlpha=opacity*(.20+.10*Math.sin(t*.8+item.phase));g.fillStyle='#c9d890';
   g.fillRect(item.x+Math.sin(t*.27+item.phase)*5,item.y-12-Math.sin(t*.35+item.phase)*7,1.6,1.6);
  }
 }
 function embers(g,item,opacity,t){
  fill(g,item.patch,'#201813',.27,opacity);
  for(const [index,points]of [item.stem,...item.branches].entries()){
   stroke(g,points,index?6:11,'#1c1716',.60,opacity);
   stroke(g,points,index?2.8:4.7,'#a44724',.28,opacity);
   stroke(g,points,index?.7:1.2,'#da8b46',.32+.05*Math.sin(t*.7+item.phase),opacity);
  }
  if(item.seed>.36)for(let j=0;j<2;j++){
   const rise=(t*5+item.phase*8+j*23)%46,x=item.x+Math.sin(item.phase+j)*17+Math.sin(t*.4+j)*3,y=item.y-rise;
   g.globalAlpha=opacity*.38*(1-rise/46);g.fillStyle='#efb878';g.fillRect(x,y,1.6,2.8);
  }
 }
 function ice(g,item,opacity,t){
  // Thin translucent sheets and hairline fractures leave the underlying painted
  // stone visible; asymmetric facets avoid smooth geometric ice puddles.
  fill(g,item.patch,'#a1c9cf',.055,opacity);
  for(const [index,points]of [item.stem,...item.branches].entries()){
   stroke(g,points,index?3.5:5,'#172d3d',.28,opacity);
   stroke(g,points,index?.8:1.3,'#c0dce0',.23,opacity);
  }
  const p=item.patch;
  fill(g,[p[0],p[2],{x:item.x,y:item.y},p[7]],'#b7dce0',.085,opacity);
  stroke(g,[p[2],p[3],p[4]],1.1,'#d5e9e7',.19,opacity);
  if(item.seed>.62){
   const x=item.x+Math.sin(t*.2+item.phase)*7,y=item.y-8;
   g.globalAlpha=opacity*(.14+.05*Math.sin(t*.6+item.phase));g.fillStyle='#d6edeb';g.fillRect(x,y,1.4,1.4);
  }
 }
 function draw(g,world,view,time=0){
  if(!g||!world||!world.dungeon||!palettes[world.key]||!view||
   ![view.x,view.y,view.w,view.h].every(Number.isFinite)||view.w<=0||view.h<=0)return;
  const items=geometry(world).filter(item=>visible(item.bounds,view));if(!items.length)return;
  const t=Number.isFinite(time)?Math.max(0,time)%100000:0,opacity=Number.isFinite(g.globalAlpha)?g.globalAlpha:1;
  g.save();g.globalCompositeOperation='source-over';g.shadowBlur=0;g.lineCap='round';g.lineJoin='round';
  // Clip to the union of actual visible floor rectangles. Accents cannot leak
  // onto the black wall void or create new walkable-looking paths.
  g.beginPath();
  for(const r of world.floors||[])if(visible(r,view)){
   const x=Math.max(view.x,r.x),y=Math.max(view.y,r.y),right=Math.min(view.x+view.w,r.x+r.w),bottom=Math.min(view.y+view.h,r.y+r.h);
   if(right>x&&bottom>y)g.rect(x,y,right-x,bottom-y);
  }
  g.clip();
  const paint=world.key==='briarhollow'?roots:world.key==='cindervein'?embers:ice;
  for(const item of items)paint(g,item,opacity,t);
  g.restore();
 }
 const api=Object.freeze({draw});root.WastelandAmbience=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
