/* Restore enemy artwork as one cached sprite. Original source files stay intact;
   old opaque masters are keyed once, and surviving cutouts are joined once.
   All coordinates are in the existing body image's pixel space, so restoring
   feet does not resize the torso, weapons, hitboxes or combat statistics. */
const EnemyFullbody=(()=>{
 const cache=new WeakMap(),cutouts=new WeakMap();
 const ready=img=>!!(img&&img.complete&&img.naturalWidth&&img.naturalHeight);
 function mask(p,w,h,profile){
  if(!profile||!profile.key)return;
  const white=profile.key==='white',limit=white?(profile.minimum??238):14,chroma=profile.chroma??20;
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  const background=n=>{const i=n*4,lo=Math.min(p[i],p[i+1],p[i+2]),hi=Math.max(p[i],p[i+1],p[i+2]);return white?lo>=limit&&hi-lo<=chroma:hi<=limit;};
  const add=n=>{if(!seen[n]&&background(n)){seen[n]=1;queue[tail++]=n;}};
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
  for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
  for(const [x,y]of profile.seeds||[])add(y*w+x);
  while(head<tail){const n=queue[head++],x=n%w,y=Math.floor(n/w);if(x)add(n-1);if(x+1<w)add(n+1);if(y)add(n-w);if(y+1<h)add(n+w);}
  for(let n=0;n<w*h;n++)if(seen[n])p[n*4+3]=0;
  // Retain the dark painted outline; soften only its immediate matte boundary.
  for(let n=0;n<w*h;n++)if(!seen[n]){
   const x=n%w,y=Math.floor(n/w),i=n*4;
   if(!((x&&seen[n-1])||(x+1<w&&seen[n+1])||(y&&seen[n-w])||(y+1<h&&seen[n+w])))continue;
   const lo=Math.min(p[i],p[i+1],p[i+2]),hi=Math.max(p[i],p[i+1],p[i+2]);
   const coverage=white?((profile.edgeMaximum??255)-lo)/(profile.edgeSoftness??35):(hi-8)/24;
   if(coverage<1&&(!white||hi-lo<chroma))p[i+3]=Math.round(p[i+3]*Math.max(0,coverage));
  }
  // A supplied reference may contain a detached study beside the actual boss.
  // Remove only that reviewed connected component, never a bounding rectangle.
  for(const [sx,sy,maxArea]of profile.remove||[]){
   const visited=new Uint8Array(w*h);head=0;tail=0;
   const visit=n=>{if(!visited[n]&&p[n*4+3]>0){visited[n]=1;queue[tail++]=n;}};
   visit(sy*w+sx);
   while(head<tail&&tail<=maxArea){const n=queue[head++],x=n%w,y=Math.floor(n/w);if(x)visit(n-1);if(x+1<w)visit(n+1);if(y)visit(n-w);if(y+1<h)visit(n+w);}
   if(tail<=maxArea)for(let i=0;i<tail;i++)p[queue[i]*4+3]=0;
  }
 }
 function partSource(p){
  if(!p.cutout)return p.img;
  const signature=p.img.src+JSON.stringify(p.cutout),old=cutouts.get(p.img);
  if(old&&old.signature===signature)return old.canvas;
  const canvas=document.createElement('canvas');canvas.width=p.img.naturalWidth;canvas.height=p.img.naturalHeight;
  const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(p.img,0,0);
  const data=g.getImageData(0,0,canvas.width,canvas.height);mask(data.data,canvas.width,canvas.height,p.cutout);g.putImageData(data,0,0);
  cutouts.set(p.img,{signature,canvas});return canvas;
 }
 function get(skin){
  const body=skin.img;if(!ready(body))return null;
  const original=skin.original,parts=typeof skin.join==='function'?skin.join():skin.join||[];
  const inputs=[body,original,...parts.map(p=>p.img)].filter(Boolean);
  const signature=inputs.map(im=>(im.src||'')+':'+im.naturalWidth+':'+im.naturalHeight).join('|');
  const old=cache.get(skin);if(old&&old.signature===signature)return old.art;
  if(original&&!ready(original))return null; // retry after loading; never cache a missing master
  if(parts.some(p=>!ready(p.img)))return null;
  let canvas,x=0,y=0,width,height;
  if(original){
   canvas=document.createElement('canvas');canvas.width=original.naturalWidth;canvas.height=original.naturalHeight;
   const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(original,0,0);
   if(skin.cutout){const data=g.getImageData(0,0,canvas.width,canvas.height);mask(data.data,canvas.width,canvas.height,skin.cutout);g.putImageData(data,0,0);}
   const f=skin.frame,k=body.naturalHeight/f[3];
   x=-f[0]*k;y=-f[1]*k;width=canvas.width*k;height=canvas.height*k;
  }else if(parts.length){
   x=Math.floor(Math.min(0,...parts.map(p=>p.x)));y=Math.floor(Math.min(0,...parts.map(p=>p.y)));
   width=Math.ceil(Math.max(body.naturalWidth,...parts.map(p=>p.x+p.w))-x);
   height=Math.ceil(Math.max(body.naturalHeight,...parts.map(p=>p.y+p.h))-y);
   canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const g=canvas.getContext('2d');
   for(const p of parts){
    const source=partSource(p);g.save();g.translate(p.x-x,p.y-y);if(p.flip){g.translate(p.w,0);g.scale(-1,1);}
    if(p.crop)g.drawImage(source,...p.crop,0,0,p.w,p.h);else g.drawImage(source,0,0,p.w,p.h);
    g.restore();
   }
   g.drawImage(body,-x,-y);
  }else return {img:body,x:0,y:0,width:body.naturalWidth,height:body.naturalHeight};
  // Match the existing image contract so mip() keeps its progressive downscale.
  canvas.naturalWidth=canvas.width;canvas.naturalHeight=canvas.height;canvas.complete=true;
  const art={img:canvas,x,y,width,height};cache.set(skin,{signature,art});return art;
 }
 return {get,mask};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=EnemyFullbody;
