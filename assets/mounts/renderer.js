/* Mounted heroes keep their real body, armor and weapon renderer. The saddle
 * anchors the rider; one boot is behind the mount and one rests on its flank. */
const MountRenderer=(()=>{
 let artCache=new WeakMap(),nextArt=1;
 const poseCache=new Map(),LIMIT=16*1024*1024;let bytes=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const legs=rows=>rows.map(([x0,x1,root,ankle,phase])=>({x0:x0/1024,x1:x1/1024,root:root/1024,ankle:ankle/1024,phase}));
 // Reviewed saddle and leg coordinates in the complete 1024px source images.
 const profiles={
  horse:{height:65,seat:[482/1024,437/1024],front:[.59,.18,.84,.67],stride:.023,lift:.026,rise:2.2,pitch:.033,surge:.55,stretch:.016,lean:.043,legs:legs([[174,335,802,918,0],[345,552,780,914,Math.PI],[562,736,777,925,Math.PI],[739,912,783,920,0]])},
  leopard:{height:65,seat:[513/1024,438/1024],front:[.59,.25,.88,.69],stride:.027,lift:.031,rise:2.65,pitch:.038,surge:.8,stretch:.021,lean:.051,legs:legs([[158,322,751,847,0],[365,565,758,838,Math.PI],[631,816,744,854,Math.PI],[816,1005,770,844,0]])},
  'spectral-tiger':{height:65,seat:[470/1024,426/1024],front:[.55,.21,.88,.70],stride:.028,lift:.03,rise:2.45,pitch:.034,surge:.7,stretch:.018,lean:.048,legs:legs([[23,258,785,880,0],[308,550,818,873,Math.PI],[550,794,780,878,Math.PI],[800,1024,788,875,0]]),spectral:true}
 };
 function ready(img){return !!(img&&img.complete!==false&&(img.naturalWidth||img.width)>0&&(img.naturalHeight||img.height)>0);}
 function readArt(id,img){
  const profile=profiles[id];if(!profile||!ready(img))return null;
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const source=img.currentSrc||img.src||'',previous=artCache.get(img);
  if(previous&&previous.id===id&&previous.iw===iw&&previous.ih===ih&&previous.source===source)return previous;
  if(previous)for(const [key,item]of poseCache)if(item.art===previous.serial){bytes-=item.bytes;poseCache.delete(key);}
  const c=document.createElement('canvas');c.width=iw;c.height=ih;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  let data;try{data=g.getImageData(0,0,iw,ih).data;}catch(_e){return null;}
  let left=iw,right=-1,top=ih,bottom=-1;
  for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)if(data[(y*iw+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left||bottom<top)return null;
  // Exclude the original opaque neck/near shoulder from the rider's clip. The
  // animal is painted once, so semi-transparent blue fur never doubles in alpha.
  const front=new Path2D();front.rect(-100000,-100000,200000,200000);
  const outside=new Path2D();outside.rect(-100000,-100000,200000,200000);
  // A far-side boot is occluded by the animal's silhouette even through spirit
  // fur. Merely drawing it first would leave a second boot visible through blue.
  for(let y=top;y<=bottom;y++){
   let start=-1;
   for(let x=left;x<=right+1;x++){
    const solid=x<=right&&data[(y*iw+x)*4+3]>=32;
    if(solid&&start<0)start=x;
    if(!solid&&start>=0){outside.rect(start,y,x-start,1);start=-1;}
   }
  }
  const [x0,y0,x1,y1]=profile.front.map((v,i)=>Math.round(v*(i%2?ih:iw)));
  for(let y=y0;y<y1;y++){
   let start=-1;
   for(let x=x0;x<=x1;x++){
    const solid=x<x1&&data[(y*iw+x)*4+3]>=192;
    if(solid&&start<0)start=x;
    if(!solid&&start>=0){front.rect(start,y,x-start,1);start=-1;}
   }
  }
  // Each foot keeps its original ground plane. These contact points let the
  // shoulders and saddle rise without dragging the planted feet into the air.
  const contacts=profile.legs.map(p=>{
   const x0=Math.round(p.x0*iw),x1=Math.round(p.x1*iw);
   for(let y=bottom;y>=Math.round(p.ankle*ih);y--){
    let sum=0,count=0;
    for(let x=x0;x<x1;x++)if(data[(y*iw+x)*4+3]>=128){sum+=x;count++;}
    if(count)return {x:sum/count,y:y+1};
   }
   return {x:(x0+x1)/2,y:bottom+1};
  });
  const result={id,img,iw,ih,source,serial:nextArt++,profile,bounds:[left,top,right-left+1,bottom-top+1],ground:[(left+right)/2,bottom+1],front,outside,contacts};
  artCache.set(img,result);return result;
 }
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.naturalWidth=w;c.naturalHeight=h;c.complete=true;return c;}
 function take(key){const e=poseCache.get(key);if(!e)return null;poseCache.delete(key);poseCache.set(key,e);return e.image;}
 function keep(key,image,art){
  const size=image.width*image.height*4;
  while(bytes+size>LIMIT&&poseCache.size){const [old,e]=poseCache.entries().next().value;bytes-=e.bytes;poseCache.delete(old);}
  if(size<=LIMIT){poseCache.set(key,{image,art,bytes:size});bytes+=size;}return image;
 }
 function gait(profile,phase,moving,size,time=0){
  const breath=Math.sin(time*2.15)*(1-moving),stride=Math.sin(phase*2-.55);
  return {
   bob:-profile.rise*size*(.5+.5*stride)*moving,
   bodyX:Math.sin(phase*2-.9)*profile.surge*size*moving,
   angle:Math.sin(phase+.35)*profile.pitch*moving+breath*.0015,
   bodyScaleX:1-Math.sin(phase*2+.25)*profile.stretch*.35*moving,
   bodyScaleY:1+Math.sin(phase*2+.25)*profile.stretch*moving+breath*.004
  };
 }
 function poseFrame(l,device){
  const a=l.art;if(l.moving<=0)return a.img;
  const w=Math.min(a.iw,Math.max(128,Math.ceil(a.iw*l.px*device/64)*128)),h=Math.max(1,Math.round(a.ih*w/a.iw));
  const step=Math.round(l.phase/(Math.PI*2)*48),strength=Math.round(l.moving*4)/4;
  if(!strength)return a.img;
  const source=a.serial+':'+w,key=source+':'+((step%48+48)%48)+':'+strength;
  const found=take(key);if(found)return found;
  let base=w===a.iw?a.img:take(source+':base');
  if(!base){base=canvas(w,h);const bg=base.getContext('2d');bg.imageSmoothingEnabled=true;bg.imageSmoothingQuality='high';bg.drawImage(a.img,0,0,w,h);keep(source+':base',base,a.serial);}
  const pad=Math.ceil(w*a.profile.stride)+2,padY=Math.ceil(h*.11)+2;
  const out=canvas(w+pad*2,h+padY*2);out.mountInset=pad/w*a.iw;out.mountTop=padY/h*a.ih;
  const g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.translate(pad,padY);g.drawImage(base,0,0);
  const cycle=step/48*Math.PI*2,motion=gait(a.profile,cycle,strength,l.size);
  const rows=a.profile.legs.map((p,i)=>{
   const phase=cycle+p.phase,top=Math.round(p.root*h),ankle=Math.round(p.ankle*h);
   const lift=Math.min(h*a.profile.lift,(ankle-top)*.35)*Math.pow(Math.max(0,Math.sin(phase)),1.3)*strength;
   const reach=-Math.cos(phase)*w*a.profile.stride*strength;
   const foot=a.contacts[i],footY=(foot.y-a.ground[1])*l.px;
   const footX=(foot.x-a.ground[0]+reach*a.iw/w)*l.px*motion.bodyScaleX;
   const targetY=footY-lift*a.ih/h*l.px;
   const plantedY=((targetY-motion.bob-Math.sin(motion.angle)*footX)/(Math.cos(motion.angle)*l.px*motion.bodyScaleY)-(foot.y-a.ground[1]))*h/a.ih;
   return {x:Math.round(p.x0*w),right:Math.round(p.x1*w),top,ankle,dy:plantedY,lift,reach,knee:top+(ankle-top)*.5};
  });
  for(const p of rows)g.clearRect(p.x,p.top,p.right-p.x,h-p.top);
  // Connected affine sections: the root stays planted in the original body;
  // the knee bends, and each complete paw/hoof translates without being cut off.
  function section(p,from,to,dx0,dy0,dx1,dy1){
   const height=to-from;if(height<=0)return;
   const sx=(dx1-dx0)/height,sy=1+(dy1-dy0)/height;
   g.save();g.transform(1,0,sx,sy,dx0-sx*from,dy0+(1-sy)*from);
   g.drawImage(base,p.x,from,p.right-p.x,height,p.x,from,p.right-p.x,height);g.restore();
  }
  for(const p of rows){
   const kneeX=p.reach*.35+p.lift*.14,kneeY=p.dy*.4;
   section(p,p.top,p.knee,0,0,kneeX,kneeY);
   section(p,p.knee,p.ankle,kneeX,kneeY,p.reach,p.dy);
   section(p,p.ankle,h,p.reach,p.dy,p.reach,p.dy);
  }
  return keep(key,out,a.serial);
 }
 function getLayout(options){
  const art=readArt(options.id,options.img);if(!art)return null;
  const size=Number.isFinite(options.scale)?clamp(options.scale,.25,4):1;
  const phase=Number.isFinite(options.phase)?options.phase:0;
  const moving=typeof options.moving==='number'?clamp(options.moving,0,1):(options.moving?1:0);
  const fx=options.fx<0?-1:1,groundY=16*size;
  const px=art.profile.height*size/art.bounds[3];
  const time=Number.isFinite(options.time)?options.time:0;
  const {bob,bodyX,angle,bodyScaleX,bodyScaleY}=gait(art.profile,phase,moving,size,time);
  const seatX=(art.profile.seat[0]*art.iw-art.ground[0])*px*bodyScaleX;
  const seatY=(art.profile.seat[1]*art.ih-art.ground[1])*px*bodyScaleY;
  const cosine=Math.cos(angle),sine=Math.sin(angle);
  const hipY=-3; // The belt/hip of the 48px painted player, above its knee hem.
  const riderX=fx*(bodyX+seatX*cosine-seatY*sine);
  const riderY=groundY+bob+seatX*sine+seatY*cosine-hipY;
  const width=clamp(Number.isFinite(options.bootWidth)?options.bootWidth:10,8,13);
  const stirrup=Math.sin(phase*2-.4)*moving;
  const riderAngle=fx*(art.profile.lean*moving+angle*.55+Math.sin(phase*2-.8)*.014*moving);
  const boots={
   far:{x:-fx*3.5,y:1.8,width:width*.78,angle:fx*.12,fx,alpha:.83},
   near:{x:fx*(3.5+stirrup*.55),y:3.5+stirrup*.4,width:width*.87,angle:-fx*(.14+stirrup*.045),fx,alpha:1}
  };
  return {art,x:Number.isFinite(options.x)?options.x:0,y:Number.isFinite(options.y)?options.y:0,fx,phase,moving,size,px,bob,bodyX,angle,bodyScaleX,bodyScaleY,riderAngle,groundY,riderX,riderY,hipY,by:0,boots,width:art.bounds[2]*px,height:art.bounds[3]*px};
 }
 function mountTransform(g,l){g.translate(l.fx*l.bodyX,l.groundY+l.bob);g.scale(l.fx,1);g.rotate(l.angle);g.scale(l.px*l.bodyScaleX,l.px*l.bodyScaleY);g.translate(-l.art.ground[0],-l.art.ground[1]);}
 function riderTransform(g,l){g.translate(l.riderX,l.riderY+l.hipY);g.rotate(l.riderAngle);g.translate(0,-l.hipY);}
 function riderPoint(l,x,y){const c=Math.cos(l.riderAngle),s=Math.sin(l.riderAngle);return {x:l.riderX+c*x-s*(y-l.hipY),y:l.riderY+l.hipY+s*x+c*(y-l.hipY)};}
 function drawRiderBoots(g,img,ride,layer){
  if(!ready(img)||!ride?.boots)return;
  const keys=layer?[layer]:['near'];
  for(const key of keys){
   const b=ride.boots[key];if(!b)continue;
   const h=b.width*(img.naturalHeight||img.height)/(img.naturalWidth||img.width);
   g.save();g.translate(b.x,b.y);g.rotate(b.angle);if(b.fx>0)g.scale(-1,1);g.globalAlpha*=b.alpha;
   g.drawImage(typeof mip==='function'?mip(img,b.width):img,-b.width/2,-2,b.width,h);g.restore();
  }
 }
 function draw(g,options,drawRider){
  const l=getLayout(options);if(!l)return null;
  const device=Number.isFinite(options.deviceScale)&&options.deviceScale>0?options.deviceScale:1;
  const pose=poseFrame(l,device);
  g.save();g.translate(l.x,l.y);
  g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(0,l.groundY,l.width*.34,6*l.size,0,0,Math.PI*2);g.fill();
  if(l.art.profile.spectral){g.fillStyle='rgba(76,157,238,.085)';g.beginPath();g.ellipse(0,l.groundY,l.width*.39,8*l.size,0,0,Math.PI*2);g.fill();}
  g.save();mountTransform(g,l);const clipTransform=g.getTransform();g.restore();
  const clip=path=>bodyContext=>{const transform=bodyContext.getTransform();bodyContext.setTransform(clipTransform);bodyContext.clip(path,'evenodd');bodyContext.setTransform(transform);};
  if(typeof drawRider==='function'&&ready(options.bootImg)){
   g.save();clip(l.art.outside)(g);riderTransform(g,l);drawRiderBoots(g,options.bootImg,l,'far');g.restore();
  }
  g.save();if(l.art.profile.spectral)g.globalAlpha*=.88;mountTransform(g,l);
  const inset=pose.mountInset||0,top=pose.mountTop||0,paintWidth=l.art.iw+inset*2;
  g.drawImage(typeof mip==='function'?mip(pose,paintWidth*l.px):pose,-inset,-top,paintWidth,l.art.ih+top*2);g.restore();
  if(typeof drawRider==='function'){
   // Used inside the player's body save/restore only. Held weapons remain in
   // front of the neck; clipping the complete callback would swallow a sword.
   l.clipBody=clip(l.art.front);
   g.save();riderTransform(g,l);l.riderResult=drawRider(g,l);g.restore();
  }
  g.restore();return l;
 }
 function drawCast(g,{x=0,y=0,progress=0,id='horse',phase=0}={}){
  if(!Number.isFinite(progress)||progress<=0||progress>=1)return;
  const p=clamp(progress,0,1),color=id==='spectral-tiger'?'#78bcff':id==='leopard'?'#d8b66f':'#d9c095';
  g.save();g.translate(x,y+16);g.strokeStyle=color;g.lineWidth=1.6;g.globalAlpha*=.2+Math.sin(p*Math.PI)*.34;
  g.beginPath();g.ellipse(0,0,22+p*9,8+p*3,0,-Math.PI/2,-Math.PI/2+p*Math.PI*2);g.stroke();
  for(let i=0;i<4;i++){const a=phase+i*Math.PI/2;g.fillStyle=color;g.beginPath();g.arc(Math.cos(a)*22,Math.sin(a)*7-p*11,1.1,0,Math.PI*2);g.fill();}
  g.restore();
 }
 function clear(){artCache=new WeakMap();poseCache.clear();bytes=0;}
 return Object.freeze({draw,getLayout,drawRiderBoots,drawCast,riderTransform,riderPoint,clear,stats:()=>({entries:poseCache.size,bytes,limit:LIMIT})});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MountRenderer;
