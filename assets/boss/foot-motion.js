/* Enemy-only gait. Each pose is still one complete sprite: the short shin band
   compresses from a fixed upper edge while the attached foot lifts intact.
   No time advances here; phase comes from distance actually walked. */
const EnemyFootMotion=(()=>{
 const LIMIT=48*1024*1024,cache=new Map(),ids=new WeakMap();let nextId=1,bytes=0;
 const id=o=>{if(!ids.has(o))ids.set(o,nextId++);return ids.get(o);};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function amount(en){
  if(!en||en.dead||en.hidden||en.dungeonCast||en.lockT>0||en.stunT>0)return 0;
  return Number.isFinite(en.mv)?clamp(en.mv,0,1):0;
 }
 function canvas(w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.naturalWidth=w;c.naturalHeight=h;c.complete=true;return c;
 }
 function take(key){const e=cache.get(key);if(!e)return null;cache.delete(key);cache.set(key,e);return e.image;}
 function keep(key,image){
  const size=image.width*image.height*4;
  while(bytes+size>LIMIT&&cache.size){const [old,e]=cache.entries().next().value;bytes-=e.bytes;cache.delete(old);}
  if(size<=LIMIT){cache.set(key,{image,bytes:size});bytes+=size;}return image;
 }
 function frame(image,profile,phase,strength,deviceWidth){
  if(!image||!profile?.length||!Number.isFinite(phase)||!Number.isFinite(strength)||strength<=0||image.complete===false)return image;
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  if(!iw||!ih||!Number.isFinite(deviceWidth)||deviceWidth<=0)return image;
  // Same oversampling range as mip(): retain fine outlines at normal/close zoom.
  const w=Math.min(iw,Math.max(128,Math.ceil(deviceWidth/64)*128)),h=Math.max(1,Math.round(ih*w/iw));
  const legs=[];
  for(const p of profile){
   if(![p.x0,p.x1,p.root,p.ankle,p.phase].every(Number.isFinite)||p.x0<0||p.x1>1||p.x0>=p.x1||p.root<0||p.root>=p.ankle||p.ankle>=1)continue;
   const x=Math.floor(p.x0*w),right=Math.ceil(p.x1*w),top=Math.round(p.root*h),ankle=Math.round(p.ankle*h);
   if(ankle<=top)continue;
   const peak=Math.min(h*.022,(ankle-top)*.20)*clamp(strength,0,1);
   const quantum=peak<1?.125:.5;
   const lift=Math.round(peak*Math.pow(Math.max(0,Math.sin(phase+p.phase)),1.35)/quantum)*quantum;
   legs.push({x,right,top,ankle,lift});
  }
  if(!legs.length)return image;
  const source=id(image)+':'+(image.src||'')+':'+iw+'x'+ih+':'+w;
  const baseKey='base:'+source;
  let base=iw===w?image:take(baseKey);
  if(!base){
   let current=image,sw=iw,sh=ih;
   while(sw>w*2){const nw=Math.round(sw/2),nh=Math.max(1,Math.round(sh*nw/sw)),c=canvas(nw,nh),g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(current,0,0,nw,nh);current=c;sw=nw;sh=nh;}
   base=canvas(w,h);const g=base.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(current,0,0,w,h);keep(baseKey,base);
  }
  if(legs.every(p=>!p.lift))return base;
  const key='pose:'+source+':'+id(profile)+':'+legs.map(p=>p.lift).join(',');
  const found=take(key);if(found)return found;
  const out=canvas(w,h),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(base,0,0);
  for(const p of legs){
   if(!p.lift)continue;
   const width=p.right-p.x,shin=p.ankle-p.top;
   g.clearRect(p.x,p.top,width,h-p.top);
   g.drawImage(base,p.x,p.top,width,shin,p.x,p.top,width,shin-p.lift);
   g.drawImage(base,p.x,p.ankle,width,h-p.ankle,p.x,p.ankle-p.lift,width,h-p.ankle);
  }
  return keep(key,out);
 }
 const clear=()=>{cache.clear();bytes=0;};
 return {frame,amount,clear,stats:()=>({entries:cache.size,bytes,limit:LIMIT})};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=EnemyFootMotion;
