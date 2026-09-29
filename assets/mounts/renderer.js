/* Mounted heroes keep their real body, armor and weapon renderer. The saddle
 * anchors the rider; one boot is behind the mount and one rests on its flank. */
const MountRenderer=(()=>{
 let artCache=new WeakMap(),nextArt=1;
 const poseCache=new Map(),LIMIT=16*1024*1024;let bytes=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const legs=rows=>rows.map(([x0,x1,root,ankle,phase])=>({x0:x0/1024,x1:x1/1024,root:root/1024,ankle:ankle/1024,phase}));
 // Reviewed saddle and leg coordinates in the complete 1024px source images.
 // run: a painted gallop, one stride keyed from a Kling clip of the still. Cells sit in the still's own
 // source pixels (origin + cell pixel * scale), so size and ground line match; seats are the tracked hip
 // point [x,y] and the saddle's canvas tilt per frame.
 const profiles={
  horse:{height:65,seat:[482/1024,437/1024],front:[.59,.18,.84,.67],stride:.023,lift:.026,rise:2.2,pitch:.033,surge:.55,stretch:.016,lean:.043,legs:legs([[174,335,802,918,0],[345,552,780,914,Math.PI],[562,736,777,925,Math.PI],[739,912,783,920,0]]),
   run:{frames:10,cols:5,cell:[648,462],origin:[-195.37,2.61],scale:[2.24415,2.24297],
    seats:[[481.1,377.5,.1542],[482.7,389.4,.1717],[481.8,413.7,.1965],[470.6,418.3,.139],[453,409.4,.0084],[443.7,404.4,-.0727],[449.2,387.9,-.0465],[463.1,366.9,.0394],[475.1,369.1,.1216],[480.1,378.9,.1568]]}},
  leopard:{height:65,seat:[513/1024,438/1024],front:[.59,.25,.88,.69],stride:.027,lift:.031,rise:2.65,pitch:.038,surge:.8,stretch:.021,lean:.051,legs:legs([[158,322,751,847,0],[365,565,758,838,Math.PI],[631,816,744,854,Math.PI],[816,1005,770,844,0]]),
   run:{frames:13,cols:5,cell:[790,462],origin:[-314.91,79.89],scale:[1.90909,1.91016],
    seats:[[514.1,421,.4342],[516,408.8,.457],[514.1,387,.3586],[507.8,371.8,.2184],[495.7,377.4,.0989],[481.3,400.7,-.0093],[472.9,424.2,-.1111],[474.1,434.7,-.1547],[480.1,432.3,-.1048],[485.3,424.1,-.0068],[490.3,417.4,.0817],[498,416.7,.175],[507.4,420.8,.3082]]}},
  'spectral-tiger':{height:65,seat:[470/1024,426/1024],front:[.55,.21,.88,.70],stride:.028,lift:.03,rise:2.45,pitch:.034,surge:.7,stretch:.018,lean:.048,legs:legs([[23,258,785,880,0],[308,550,818,873,Math.PI],[550,794,780,878,Math.PI],[800,1024,788,875,0]]),spectral:true,
   run:{frames:11,cols:4,cell:[1016,422],origin:[-402.54,181.06],scale:[1.9379,1.93828],
    seats:[[477.5,373.1,.0055],[489.9,358.4,.12],[497.3,351.9,.2361],[495.9,351.1,.3293],[488.1,348.5,.3833],[474.7,339.2,.3625],[455.6,337.9,.2695],[440.1,361.5,.1581],[439.1,395.6,.0616],[450.6,408.8,-.0179],[464.7,394.7,-.0491]]}},
  /* 🐉 a flyer: no legs to swing, a painted wingbeat instead (20 frames from a Kling clip of the still). lift is how high
     its lowest claw hangs over its shadow, heave how far each downstroke lifts it. Drawn huge on request (2026-09-29). */
  dragon:{height:235,seat:[600/1024,570/1024],front:[.72,.37,.98,.74],stride:.02,lift:56,heave:5.6,rise:0,pitch:0,surge:0,stretch:0,lean:.03,legs:[],fly:true,gust:{at:3.3,puffs:[[520,1010,-1],[880,1010,1]]},
   run:{frames:20,cols:5,cell:[671,550],origin:[-88.44,-2],scale:[2.03586,2.03586],
    seats:[[600.1,570.1,0],[600.1,570.1,0],[600.1,570.1,0],[600.2,572.1,.0175],[602.2,574.2,.0349],[604.2,576.5,.0698],[606.2,576.7,.0873],[606.2,576.7,.0873],[606.2,576.7,.0873],[606,574.3,.0838],[604.8,572.9,.0733],[603.6,571.6,.0628],[602.4,570.3,.0524],[601.6,569.4,.0454],[600.4,568.1,.0349],[600.2,568,.0175],[600.2,568,.0175],[600.1,570.1,0],[600.1,570.1,0],[600.1,570.1,0]]}}
 };
 const TAU=Math.PI*2,RUN_FROM=.35,RUN_TILT=.5,STILL=Object.freeze({bob:0,bodyX:0,angle:0,bodyScaleX:1,bodyScaleY:1});
 let runCache=new WeakMap();
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
 function readRun(art,img){
  if(!art.profile.run||!ready(img))return null;
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,source=img.currentSrc||img.src||'',previous=runCache.get(img);
  if(previous&&previous.art===art&&previous.iw===iw&&previous.ih===ih&&previous.source===source)return previous;
  // A sheet served at another size than it was measured at scales every cell with it.
  const result={art,img,iw,ih,source,k:iw/(art.profile.run.cols*art.profile.run.cell[0]),masks:null};
  runCache.set(img,result);return result;
 }
 // The painted gallop replaces the bent-leg pose while really running; standing keeps the still.
 function runCell(art,sheet,index){
  const run=art.profile.run,ux=art.iw/1024,uy=art.ih/1024,[cw,ch]=run.cell,[x,y,tilt]=run.seats[index];
  return {sheet,index,seat:[x*ux,y*uy],tilt,
   src:[(index%run.cols)*cw*sheet.k,Math.floor(index/run.cols)*ch*sheet.k,cw*sheet.k,ch*sheet.k],
   dest:[run.origin[0]*ux,run.origin[1]*uy,cw*run.scale[0]*ux,ch*run.scale[1]*uy]};
 }
 function runFrame(art,img,phase,moving){
  if(moving<RUN_FROM&&!art.profile.fly)return null;   /* a flyer is always in the air: its wings beat standing still too */
  const sheet=readRun(art,img);if(!sheet)return null;
  const frames=art.profile.run.frames;
  return runCell(art,sheet,Math.floor((phase%TAU+TAU)%TAU/TAU*frames)%frames);
 }
 // Each frame's own silhouette hides the far boot, and its own neck covers the rider, like the still's.
 // One half-size read of the sheet builds every frame's masks; the pixels are not kept.
 function runMasks(l){
  const sheet=l.run.sheet,a=l.art,p=a.profile;
  if(sheet.masks)return sheet.masks[l.run.index];
  const w=Math.max(1,Math.round(sheet.iw/2)),h=Math.max(1,Math.round(sheet.ih/2));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(sheet.img,0,0,w,h);
  let data=null;try{data=g.getImageData(0,0,w,h).data;}catch(_e){}
  sheet.masks=Array.from({length:p.run.frames},(_,index)=>{
   if(!data)return a;
   const r=runCell(a,sheet,index),kx=w/sheet.iw,ky=h/sheet.ih,[sx,sy,sw,sh]=r.src,[dx,dy,dw,dh]=r.dest;
   const px=dw/sw/kx,py=dh/sh/ky,toX=x=>dx+(x/kx-sx)*dw/sw,toY=y=>dy+(y/ky-sy)*dh/sh;
   const x0=Math.max(0,Math.floor(sx*kx)),x1=Math.min(w,Math.ceil((sx+sw)*kx)),y0=Math.max(0,Math.floor(sy*ky)),y1=Math.min(h,Math.ceil((sy+sh)*ky));
   const front=new Path2D();front.rect(-100000,-100000,200000,200000);
   const outside=new Path2D();outside.rect(-100000,-100000,200000,200000);
   const spans=(path,y,from,to,alpha)=>{
    let start=-1;
    for(let x=from;x<=to;x++){
     const solid=x<to&&data[(y*w+x)*4+3]>=alpha;
     if(solid&&start<0)start=x;
     if(!solid&&start>=0){path.rect(toX(start),toY(y),(x-start)*px,py);start=-1;}
    }
   };
   for(let y=y0;y<y1;y++)spans(outside,y,x0,x1,32);
   // The still's neck box, carried along with this frame's saddle.
   const nx0=r.seat[0]+(p.front[0]-p.seat[0])*a.iw,nx1=r.seat[0]+(p.front[2]-p.seat[0])*a.iw;
   const ny0=r.seat[1]+(p.front[1]-p.seat[1])*a.ih,ny1=r.seat[1]+(p.front[3]-p.seat[1])*a.ih;
   const fromX=x=>Math.round((sx+(x-dx)*sw/dw)*kx),fromY=y=>Math.round((sy+(y-dy)*sh/dh)*ky);
   const fx0=Math.max(x0,fromX(nx0)),fx1=Math.min(x1,fromX(nx1)),fy0=Math.max(y0,fromY(ny0)),fy1=Math.min(y1,fromY(ny1));
   for(let y=fy0;y<fy1;y++)spans(front,y,fx0,fx1,192);
   return {front,outside};
  });
  return sheet.masks[l.run.index];
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
  // A painted frame already carries its own rise and pitch; only the rider's seat follows it.
  const run=runFrame(art,options.runImg,phase,moving);
  const {bob,bodyX,angle,bodyScaleX,bodyScaleY}=run?STILL:gait(art.profile,phase,moving,size,time);
  const seat=run?run.seat:[art.profile.seat[0]*art.iw,art.profile.seat[1]*art.ih];
  const seatX=(seat[0]-art.ground[0])*px*bodyScaleX;
  const seatY=(seat[1]-art.ground[1])*px*bodyScaleY;
  /* 🐉 how high a flyer holds its lowest claw over its shadow; it rises on the downstroke (phase π: wings low) and sinks as they lift */
  const air=art.profile.fly?-((art.profile.lift||0)-(art.profile.heave||0)*Math.cos(phase))*size:0;
  const cosine=Math.cos(angle),sine=Math.sin(angle);
  const hipY=-3; // The belt/hip of the 48px painted player, above its knee hem.
  const riderX=fx*(bodyX+seatX*cosine-seatY*sine);
  const riderY=groundY+bob+air+seatX*sine+seatY*cosine-hipY;
  const width=clamp(Number.isFinite(options.bootWidth)?options.bootWidth:10,8,13);
  const stirrup=Math.sin(phase*2-.4)*moving;
  const riderAngle=fx*(art.profile.lean*moving+(run?run.tilt*RUN_TILT:angle*.55)+Math.sin(phase*2-.8)*.014*moving);
  /* The rider faces the camera, turned toward fx: the leg on the mount's near flank is the rider's own right leg when
     riding right, and it shows on the side behind the rider's facing (-fx). The other boot sits forward, behind the body. */
  const boots={
   far:{x:fx*3.5,y:1.8,width:width*.78,angle:fx*.12,fx,alpha:.83},
   near:{x:fx*(-3.5+stirrup*.55),y:3.5+stirrup*.4,width:width*.87,angle:-fx*(.14+stirrup*.045),fx,alpha:1}
  };
  return {art,run,air,x:Number.isFinite(options.x)?options.x:0,y:Number.isFinite(options.y)?options.y:0,fx,phase,moving,size,px,bob,bodyX,angle,bodyScaleX,bodyScaleY,riderAngle,groundY,riderX,riderY,hipY,by:0,boots,width:art.bounds[2]*px,height:art.bounds[3]*px};
 }
 function mountTransform(g,l){g.translate(l.fx*l.bodyX,l.groundY+l.bob+(l.air||0));g.scale(l.fx,1);g.rotate(l.angle);g.scale(l.px*l.bodyScaleX,l.px*l.bodyScaleY);g.translate(-l.art.ground[0],-l.art.ground[1]);}
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
 /* 💨 a flyer's downstroke pushes air: soft puffs curl out from under both wing tips, whooshes sweep past them and a ring
    of wind runs over the ground round the shadow. All of it is a function of the wingbeat phase, so nothing is kept
    between frames and a hovering dragon puffs as steadily as a flying one. at: the phase where the downstroke ends. */
 function drawGust(g,l){
  const p=l.art.profile,gust=p.gust;if(!gust)return;
  const age=((l.phase-gust.at)%TAU+TAU)%TAU/TAU;if(age>=.55)return;
  const t=age/.55,fade=Math.pow(1-t,1.5)*Math.min(1,t*6),k=p.height/120*l.size;
  g.save();
  for(const [u,v,dir] of gust.puffs){
   const x0=l.fx*(l.bodyX+(u-l.art.ground[0])*l.px)-l.fx*t*22*k*l.moving,y0=l.groundY+l.bob+l.air+(v-l.art.ground[1])*l.px;
   for(let i=0;i<3;i++){   /* three soft clouds rolling apart and sinking */
    const spread=(i-1)*9*k+l.fx*dir*t*14*k,x=x0+spread,y=y0+t*16*k+i%2*4*k,r=(5+t*14)*k*(1-.18*Math.abs(i-1));
    const puff=g.createRadialGradient(x,y,0,x,y,r);
    puff.addColorStop(0,'rgba(240,247,255,'+(.52*fade)+')');puff.addColorStop(.6,'rgba(222,236,252,'+(.26*fade)+')');puff.addColorStop(1,'rgba(220,234,250,0)');
    g.fillStyle=puff;g.beginPath();g.ellipse(x,y,r,r*.62,0,0,TAU);g.fill();
   }
   g.strokeStyle='rgba(245,250,255,'+(.55*fade)+')';g.lineWidth=Math.max(.8,1.3*k);g.lineCap='round';
   for(let i=0;i<2;i++){   /* whooshes: two arcs sweeping down and out */
    const r=(8+t*18+i*6)*k,y=y0+t*6*k+i*5*k,start=l.fx*dir>0?-.1:Math.PI*.55,len=Math.PI*.45*(1-t*.3);
    g.beginPath();g.ellipse(x0+l.fx*dir*(3+i*5)*k,y,r,r*.45,0,start,start+len);g.stroke();
   }
  }
  /* the wind reaches the ground: a ring opens round the shadow and fades */
  const ring=(20+t*48)*k;
  g.strokeStyle='rgba(235,242,250,'+(.3*fade)+')';g.lineWidth=Math.max(.8,1.6*k*(1-t*.5));
  g.beginPath();g.ellipse(0,l.groundY,ring,ring*.22,0,0,TAU);g.stroke();
  g.restore();
 }
 function draw(g,options,drawRider){
  const l=getLayout(options);if(!l)return null;
  const device=Number.isFinite(options.deviceScale)&&options.deviceScale>0?options.deviceScale:1;
  const run=l.run,masks=run?runMasks(l):l.art,pose=run?null:poseFrame(l,device);
  g.save();g.translate(l.x,l.y);
  if(l.art.profile.fly){g.fillStyle='rgba(0,0,0,.16)';g.beginPath();g.ellipse(0,l.groundY,l.width*.26,5*l.size,0,0,Math.PI*2);g.fill();}
  else{g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(0,l.groundY,l.width*.34,6*l.size,0,0,Math.PI*2);g.fill();}
  if(l.art.profile.spectral){g.fillStyle='rgba(76,157,238,.085)';g.beginPath();g.ellipse(0,l.groundY,l.width*.39,8*l.size,0,0,Math.PI*2);g.fill();}
  drawGust(g,l);
  g.save();mountTransform(g,l);const clipTransform=g.getTransform();g.restore();
  const clip=path=>bodyContext=>{const transform=bodyContext.getTransform();bodyContext.setTransform(clipTransform);bodyContext.clip(path,'evenodd');bodyContext.setTransform(transform);};
  if(typeof drawRider==='function'&&ready(options.bootImg)){
   g.save();clip(masks.outside)(g);riderTransform(g,l);drawRiderBoots(g,options.bootImg,l,'far');g.restore();
  }
  g.save();if(l.art.profile.spectral)g.globalAlpha*=.88;mountTransform(g,l);
  if(run){
   const [sx,sy,sw,sh]=run.src,[dx,dy,dw,dh]=run.dest,sheet=run.sheet;
   const image=typeof mip==='function'?mip(sheet.img,sheet.iw*dw/sw*l.px):sheet.img,m=(image.naturalWidth||image.width)/sheet.iw;
   g.drawImage(image,sx*m,sy*m,sw*m,sh*m,dx,dy,dw,dh);
  }else{
   const inset=pose.mountInset||0,top=pose.mountTop||0,paintWidth=l.art.iw+inset*2;
   g.drawImage(typeof mip==='function'?mip(pose,paintWidth*l.px):pose,-inset,-top,paintWidth,l.art.ih+top*2);
  }
  g.restore();
  if(typeof drawRider==='function'){
   // Used inside the player's body save/restore only. Held weapons remain in
   // front of the neck; clipping the complete callback would swallow a sword.
   l.clipBody=clip(masks.front);
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
 function clear(){artCache=new WeakMap();runCache=new WeakMap();poseCache.clear();bytes=0;}
 return Object.freeze({draw,getLayout,drawRiderBoots,drawCast,riderTransform,riderPoint,clear,stats:()=>({entries:poseCache.size,bytes,limit:LIMIT})});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MountRenderer;
