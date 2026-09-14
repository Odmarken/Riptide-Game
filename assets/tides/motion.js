/* Full-body Tide motion. The original silhouette stays connected: walking bends
 * the lower leg band, while breathing scales around the planted feet. */
const TideMotion=(()=>{
 const cache=new Map(),ids=new WeakMap(),LIMIT=24*1024*1024;
 let nextId=1,bytes=0;
 const flyers=new Set(['duskmoth','dawnphoenix','spectralwyrm']);
 const birds=new Set(['thistlesparrow','moonowl']);
 const hoppers=new Set(['bramblebunny','pebbletoad']);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const phaseFor=id=>[...id].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),0)%628/100;
 function pose(id,time,motion,phase,alive=true){
  if(!alive)return {scaleX:1,scaleY:1,lift:0,tilt:0,walk:0};
  const p=time*2.1+phaseFor(id),breath=Math.sin(p),walk=clamp(motion||0,0,1),flying=flyers.has(id);
  const step=Math.abs(Math.sin(phase)),hop=hoppers.has(id)?1.5:1;
  return {scaleX:1-breath*.006+(id==='duskmoth'?Math.sin(time*8+phaseFor(id))*.035:0),
   scaleY:1+breath*.016,lift:flying?.027+.017*Math.sin(p*.8):step*.026*walk*hop,
   tilt:flying?Math.sin(p*.75)*.018:Math.sin(phase)*.023*walk,walk:flying?0:walk};
 }
 function get(key){const p=cache.get(key);if(!p)return null;cache.delete(key);cache.set(key,p);return p.frame;}
 function keep(key,frame){
  const cost=frame.w*frame.h*4;
  while(bytes+cost>LIMIT&&cache.size){const [key,old]=cache.entries().next().value;bytes-=old.bytes;cache.delete(key);}
  if(cost<=LIMIT){cache.set(key,{frame,bytes:cost});bytes+=cost;}return frame;
 }
 function walkFrame(f,id,phase,strength,deviceHeight){
  if(strength<=0||flyers.has(id))return f;
  if(!ids.has(f))ids.set(f,nextId++);
  const h=Math.min(f.h,384,Math.max(96,Math.ceil(deviceHeight/64)*64)),w=Math.max(1,Math.round(h*f.w/f.h));
  const step=Math.round(((phase%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*24)%24,amount=Math.round(clamp(strength,0,1)*4)/4;
  if(!amount)return f;
  const key=ids.get(f)+':'+h+':'+step+':'+amount,cached=get(key);if(cached)return cached;
  const baseKey=ids.get(f)+':base:'+h;
  let base=get(baseKey);
  if(!base){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(f.image,f.x,f.y,f.w,f.h,0,0,w,h);base=keep(baseKey,{image:c,x:0,y:0,w,h});}
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';
  const root=Math.round(h*(birds.has(id)?.79:.72)),ankle=Math.round(h*.91),cycle=step/24*Math.PI*2;
  g.drawImage(base.image,0,0,w,root,0,0,w,root);
  // Smooth adjacent columns share the same upper edge; nothing is detached.
  for(let i=0;i<24;i++){
   const x=Math.floor(w*i/24),right=Math.floor(w*(i+1)/24),cw=right-x;
   if(!cw)continue;
   const lift=Math.pow(Math.max(0,Math.sin(cycle+(i+.5)/24*Math.PI*2)),1.4)*h*.027*amount;
   g.drawImage(base.image,x,root,cw,ankle-root,x,root,cw,ankle-root-lift);
   g.drawImage(base.image,x,ankle,cw,h-ankle,x,ankle-lift,cw,h-ankle);
  }
  return keep(key,{image:c,x:0,y:0,w,h});
 }
 function draw(g,f,id,x,y,height,fx,motion,phase,alpha,time,alive=true){
  const p=pose(id,time,motion,phase,alive),width=height*f.w/f.h;
  g.save();g.translate(x,y);g.globalAlpha*=alpha;
  g.fillStyle='rgba(0,0,0,.21)';g.beginPath();g.ellipse(0,1,width*.31,Math.max(3,height*.08),0,0,Math.PI*2);g.fill();
  g.scale((fx<0?-1:1)*p.scaleX,p.scaleY);g.translate(0,-p.lift*height);g.rotate(p.tilt);
  const m=g.getTransform(),deviceHeight=height*Math.hypot(m.c,m.d),paint=walkFrame(f,id,phase,p.walk,deviceHeight);
  g.drawImage(paint.image,paint.x,paint.y,paint.w,paint.h,-width/2,-height,width,height);g.restore();
 }
 return {draw,pose,stats:()=>({entries:cache.size,bytes,limit:LIMIT})};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=TideMotion;
