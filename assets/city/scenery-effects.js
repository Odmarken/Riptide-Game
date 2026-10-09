(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityScenery=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function shadow(g,x,y,rx,ry,alpha=.24){
  if(!(rx>0&&ry>0))return;
  g.save();g.translate(x,y);g.scale(rx,ry);
  const grad=g.createRadialGradient(0,0,0,0,0,1);
  grad.addColorStop(0,'rgba(0,0,0,'+alpha+')');grad.addColorStop(.48,'rgba(0,0,0,'+(alpha*.8)+')');
  grad.addColorStop(.8,'rgba(0,0,0,'+(alpha*.3)+')');grad.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grad;g.fillRect(-1,-1,2,2);g.restore();
 }
 const puffs=new Map(),glows=new Map();
 const fract=v=>v-Math.floor(v);
 function flicker(time,seed=0){
  const t=time+seed*.37;
  return .91+.045*Math.sin(t*2.7)+.025*Math.sin(t*6.3)+.02*Math.sin(t*11.9+Math.sin(t*1.7));
 }
 function smokePuff(dark,variant=0){
  const key=dark+':'+variant;
  if(puffs.has(key))return puffs.get(key);
  const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(96,96):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!c)return null;c.width=c.height=96;const g=c.getContext('2d');
  if(g.createImageData&&g.putImageData){
   const im=g.createImageData(96,96);
   for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const nx=(x-48)/43,ny=(y-48)/43;
    const n=noise(x*.085+variant*7,y*.085)*.65+noise(x*.19,y*.19+variant*3)*.35;
    const density=smooth((1-Math.hypot(nx,ny)+(n-.5)*.65)*(dark?1.45:1)),i=(y*96+x)*4;
    const tone=dark?32+n*52:205+n*28;
    im.data[i]=tone;im.data[i+1]=tone+(dark?-2:2);im.data[i+2]=tone+(dark?-4:1);
    im.data[i+3]=Math.round(density*(.55+n*.4)*230);
   }
   g.putImageData(im,0,0);puffs.set(key,c);return c;
  }
  const rgb=dark?'38,35,32':'218,220,216';
  for(const [x,y,r,a] of [[47,49,39,.55],[30,41,26,.32],[62,31,24,.3],[63,63,25,.26],[33,66,21,.23]]){
   const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba('+rgb+','+a+')');grad.addColorStop(.5,'rgba('+rgb+','+(a*.55)+')');grad.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=grad;g.fillRect(0,0,96,96);
  }
  puffs.set(key,c);return c;
 }
 /* 📱 how many puffs a plume is drawn with (1 = all; game.js gives phones half, 2026-10-10 - a port's smoke was a thirtieth of a
    phone's frame); the fewer are a little denser, so a plume reads the same */
 let detail=1;
 function setDetail(k){detail=Math.max(.25,Math.min(1,+k||1));}
 function smoke(g,x0,y0,k,time=0,phase=0,cold=false,dark=false){
  if(!(k>0))return;
  const n=Math.max(4,Math.round((dark?18:cold?15:12)*detail)),thick=detail<1?Math.min(1.6,1/Math.sqrt(detail)):1,rise=(dark?220:cold?165:135)*k,speed=dark?.14:.105;
  g.save();g.globalCompositeOperation='source-over';
  for(let i=0;i<n;i++){
   const im=smokePuff(dark,i%3);
   const p=fract(time*speed+i/n+phase),birth=(time-p/speed)*.24+phase;
   const wind=30+Math.sin(birth*.7)*12,x=x0+(p*p*wind+Math.sin(p*7+birth)*p*10)*k,y=y0-rise*(p*.8+p*p*.2);
   const r=(dark?16:7)+(p*30+p*p*12),radius=r*k,alpha=Math.min(1,Math.min(1,p*16)*Math.pow(1-p,dark?1.05:1.5)*(dark?1:cold?.90:.72)*thick);
   g.save();g.globalAlpha*=alpha;g.translate(x,y);g.rotate(Math.sin(birth+p*2)*.35);g.scale(1+.18*p,.86+.16*p);
   if(im)g.drawImage(im,-radius,-radius,radius*2,radius*2);
   else{const rgb=dark?'38,35,32':'218,220,216',grad=g.createRadialGradient(0,0,0,0,0,radius);grad.addColorStop(0,'rgba('+rgb+',.7)');grad.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=grad;g.fillRect(-radius,-radius,radius*2,radius*2);}
   g.restore();
  }
  g.restore();
 }
 /* Cached falloff keeps a row of lamps cheap; screen avoids bleaching the painted metal. */
 function glow(g,x,y,r,strength=1,tint=[255,194,112]){
  if(!(r>0&&strength>0))return;
  const rgb=tint.join(','),paint=(ctx,cx,cy,R)=>{
   const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
   for(const [p,a] of [[0,.48],[.08,.32],[.22,.13],[.5,.035],[1,0]])gr.addColorStop(p,'rgba('+rgb+','+a+')');
   return gr;
  };
  let im=glows.get(rgb);
  if(!im){
   const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(128,128):typeof document!=='undefined'?document.createElement('canvas'):null;
   if(c){c.width=c.height=128;const a=c.getContext('2d');a.fillStyle=paint(a,64,64,64);a.fillRect(0,0,128,128);glows.set(rgb,im=c);}
  }
  g.save();g.globalCompositeOperation='screen';g.globalAlpha*=Math.min(1,strength);
  if(im)g.drawImage(im,x-r,y-r,r*2,r*2);
  else{g.fillStyle=paint(g,x,y,r);g.fillRect(x-r,y-r,r*2,r*2);}
  g.restore();
 }
 /* A small, looping density atlas. Upward-advected noise breaks the silhouette into
    curling tongues, with transparent cool edges and a yellow-white fuel bed.
    Each of the 32 frames is made once, shared by every fire at its own phase. */
 const flameFrames=new Map(),sat=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=sat(v);return v*v*(3-2*v);};
 function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
  const h=(a,b)=>{let n=(Math.imul(a,374761393)+Math.imul(b&15,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const a=h(ix,iy),b=h(ix+1,iy),c=h(ix,iy+1),d=h(ix+1,iy+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
 }
 function flameFrame(frame){
  if(flameFrames.has(frame))return flameFrames.get(frame);
  const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(64,128):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!c)return null;c.width=64;c.height=128;
  const g=c.getContext('2d');if(!g.createImageData||!g.putImageData)return null;
  const im=g.createImageData(64,128),t=frame/32;
  for(let y=0;y<128;y++){
   const v=y/127,width=.015+.29*Math.pow(v,.72),ends=smooth(v*9)*smooth((1-v)*17);
   const curl=(noise(v*5,t*16)-.5)*.22*(1-v);
   for(let x=0;x<64;x++){
   const u=x/63-.5;
   const n=noise(u*8+4,v*7+t*16)*.65+noise(u*19+8,v*17+t*32)*.35;
   const body=1-Math.abs(u-curl)/width;
   const density=body+(n-.5)*(1.2-v*.5)-.14;
   const alpha=smooth(density*2.6)*ends;
   const heat=sat(density*.7+v*.45),i=(y*64+x)*4;
   im.data[i]=255;im.data[i+1]=Math.round(70+185*smooth(heat));im.data[i+2]=Math.round(12+180*Math.pow(heat,4));im.data[i+3]=Math.round(alpha*240);
   }
  }
  g.putImageData(im,0,0);flameFrames.set(frame,c);return c;
 }
 /* Fuel stays anchored; different turbulence frequencies move only the upper flame.
    Narrow hot core, orange body and transparent tips, without additive white blobs. */
 function flame(g,x,y,size,time=0,seed=0){
  if(!(size>0))return;
  const phase=fract(time*.7+seed*.137)*32,index=Math.floor(phase),im=flameFrame(index);
  if(im){
   const next=flameFrame((index+1)%32),blend=phase-index,height=(39+5*flicker(time,seed))*size;
   g.save();g.globalCompositeOperation='source-over';const alpha=g.globalAlpha;
   g.globalAlpha=alpha*(1-blend);g.drawImage(im,x-17*size,y-height,34*size,height+3*size);
   g.globalAlpha=alpha*blend;g.drawImage(next,x-17*size,y-height,34*size,height+3*size);g.restore();return;
  }
  g.save();g.translate(x,y);g.scale(size,size);g.globalCompositeOperation='source-over';
  const f=flicker(time,seed),lean=Math.sin(time*3.1+seed)*3+Math.sin(time*7.7+seed*2)*1.2;
  const tongue=(cx,bw,h,bend,core)=>{
   const gr=g.createLinearGradient(0,0,0,-h);
   gr.addColorStop(0,core?'rgba(255,246,204,.96)':'rgba(255,193,69,.88)');
   gr.addColorStop(.32,core?'rgba(255,222,135,.9)':'rgba(255,150,32,.8)');
   gr.addColorStop(.72,core?'rgba(255,184,55,.55)':'rgba(231,75,16,.48)');gr.addColorStop(1,'rgba(175,48,12,0)');
   g.fillStyle=gr;g.beginPath();g.moveTo(cx-bw,1);
   g.bezierCurveTo(cx-bw*1.3,-h*.28,cx+bend-bw*.55,-h*.6,cx+bend,-h);
   g.bezierCurveTo(cx+bend+bw*.25,-h*.62,cx+bw*1.3,-h*.24,cx+bw,1);g.closePath();g.fill();
  };
  tongue(-3,5,26*f+3*Math.sin(time*9.2+seed),lean-3,false);
  tongue(3,4.5,23*f+4*Math.sin(time*8.1+seed+2),lean+3,false);
  tongue(0,6,37*f+3*Math.sin(time*5.3+seed),lean,false);
  tongue(0,2.5,18*f,lean*.32,true);
  g.restore();
 }
 /* 🔥 heat (2026-10-09, "värmedis över eld"): where each fire is drawn on the screen this frame, in device px - the GPU's heat
    haze shimmers above them (game.js heatBegin/heatTake round the world pass). Only the screen's own canvas counts */
 const heat=[];let heatOn=false;
 function noteHeat(g,x,y,size){
  if(!heatOn||heat.length>=32||!g||!g.canvas||g.canvas.id!=='game'||typeof g.getTransform!=='function')return;
  const m=g.getTransform();heat.push({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,r:size*34*Math.hypot(m.a,m.b),k:1});
 }
 function heatBegin(){heat.length=0;heatOn=true;}
 function heatTake(){heatOn=false;return heat;}
 function fire(g,x,y,size,time=0,seed=0){
  if(!(size>0))return;
  noteHeat(g,x,y-12*size,size);
  smoke(g,x,y-26*size,size*.42,time,seed*.13,false,true);
  glow(g,x,y-8*size,60*size,.65*flicker(time,seed));
  flame(g,x-5*size,y,size*.75,time,seed+1.7);
  flame(g,x+5*size,y,size*.65,time,seed+4.3);
  flame(g,x,y,size,time,seed);
  g.save();g.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){
   const p=fract(time*(.36+i*.035)+i*.237+seed*.17),a=Math.sin(Math.PI*p)*Math.pow(1-p,1.5);
   g.fillStyle='rgba(255,177,66,'+a+')';
   const px=x+(Math.sin(i*3+seed+p*6)*7+p*p*15)*size,py=y-(12+p*90)*size;
   g.beginPath();g.ellipse(px,py,(.45+.55*(1-p))*size,(.8+1.2*(1-p))*size,.2,0,Math.PI*2);g.fill();
  }
  g.restore();
 }
 /* Animate the original painted fire, with its fuel bed and metal kept fixed.
    Removing the original patch first prevents a second, stationary flame. */
 function paintedFlame(g,im,W,H,top,patch,time=0,seed=0){
  const sw=im.naturalWidth||im.width,sh=im.naturalHeight||im.height;
  const [u0,v0,u1,v1]=patch,x=-W/2+u0*W,y=top+v0*H,w=(u1-u0)*W,h=(v1-v0)*H;
  if(!(sw>0&&sh>0&&w>0&&h>0))return;
  noteHeat(g,x+w/2,y+h*.35,Math.max(w,h)/36);
  g.save();g.beginPath();g.rect(-W/2,top,W,H);g.rect(x,y,w,h);g.clip('evenodd');
  g.drawImage(im,-W/2,top,W,H);g.restore();
  g.save();g.beginPath();g.rect(x,y-h*.12,w,h*1.12);g.clip();
  const t=time+seed*.37,bands=24,stretch=1+.045*Math.sin(t*3.7)+.025*Math.sin(t*7.3);
  const row=p=>y+h-h*(1-p)*stretch+h*.014*Math.sin(Math.PI*p)*Math.sin(t*6.1-p*8);
  for(let i=0;i<bands;i++){
   const p=i/bands,q=(i+1)/bands,k=(1-p)*(1-p),dy=row(p),dh=row(q)-dy;
   const dx=w*.055*k*(Math.sin(t*4.3-p*8)+.4*Math.sin(t*9.1-p*13));
   const width=w*(1+.04*k*Math.sin(t*5.9-p*10));
   g.drawImage(im,u0*sw,(v0+p*(v1-v0))*sh,(u1-u0)*sw,(v1-v0)*sh/bands,x+dx+(w-width)*.5,dy,width,dh+.12);
  }
  g.restore();
 }
 /* A few cooling embers and faint smoke above an existing flame, never another fire. */
 function fireAir(g,x,tip,size,time=0,seed=0){
  if(!(size>0))return;
  g.save();g.globalAlpha*=.2;smoke(g,x,tip-2,size*.3,time,seed,false,true);g.restore();
  g.save();g.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){
   const p=fract(time*(.28+i*.031)+seed*.17+i*.237),a=Math.sin(Math.PI*p)*Math.pow(1-p,1.8)*.65;
   const px=x+size*(Math.sin(seed+i*3+p*7)*(3+p*8)+p*p*12),py=tip+size*(9-p*67);
   g.fillStyle='rgba(255,190,92,'+a+')';g.beginPath();
   g.ellipse(px,py,size*(.45+.35*(1-p)),size*(.7+.6*(1-p)),.2,0,Math.PI*2);g.fill();
  }
  g.restore();
 }
 return Object.freeze({shadow,smoke,glow,flame,fire,flicker,paintedFlame,fireAir,heatBegin,heatTake,setDetail});
});
