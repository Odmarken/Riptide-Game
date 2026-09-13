/* Mounted heroes keep their real body, armor and weapon renderer. The callback
 * receives only a seat translation; facing still belongs to the player renderer. */
const MountRenderer=(()=>{
 const artCache=new WeakMap();
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const legs=rows=>rows.map(([x0,x1,root,ankle,phase])=>({x0:x0/1024,x1:x1/1024,root:root/1024,ankle:ankle/1024,phase}));
 // Reviewed saddle and leg coordinates in the complete 1024px source images.
 const profiles={
  horse:{height:65,seat:[482/1024,437/1024],front:[.59,.18,.84,.67],legs:legs([[184,316,850,924,0],[350,532,800,916,Math.PI],[570,711,808,925,Math.PI],[721,880,806,928,0]])},
  leopard:{height:65,seat:[513/1024,438/1024],front:[.59,.25,.88,.69],legs:legs([[165,312,790,853,0],[376,557,790,847,Math.PI],[643,813,780,856,Math.PI],[819,998,790,847,0]])},
  'spectral-tiger':{height:65,seat:[480/1024,458/1024],front:[.59,.22,.88,.69],legs:legs([[153,320,790,843,0],[355,565,780,844,Math.PI],[569,779,800,855,Math.PI],[779,993,800,844,0]]),spectral:true}
 };
 function ready(img){return !!(img&&img.complete!==false&&(img.naturalWidth||img.width)>0&&(img.naturalHeight||img.height)>0);}
 function readArt(id,img){
  const profile=profiles[id];if(!profile||!ready(img))return null;
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const previous=artCache.get(img);if(previous&&previous.id===id&&previous.iw===iw&&previous.ih===ih)return previous;
  const c=document.createElement('canvas');c.width=iw;c.height=ih;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  let data;try{data=g.getImageData(0,0,iw,ih).data;}catch(_e){return null;}
  let left=iw,right=-1,top=ih,bottom=-1;
  for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)if(data[(y*iw+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left||bottom<top)return null;
  // Exclude the original opaque neck/near shoulder from the rider's clip. The
  // animal is painted once, so semi-transparent blue fur never doubles in alpha.
  const front=new Path2D();front.rect(-100000,-100000,200000,200000);
  const [x0,y0,x1,y1]=profile.front.map((v,i)=>Math.round(v*(i%2?ih:iw)));
  for(let y=y0;y<y1;y++){
   let start=-1;
   for(let x=x0;x<=x1;x++){
    const solid=x<x1&&data[(y*iw+x)*4+3]>=192;
    if(solid&&start<0)start=x;
    if(!solid&&start>=0){front.rect(start,y,x-start,1);start=-1;}
   }
  }
  const result={id,img,iw,ih,profile,bounds:[left,top,right-left+1,bottom-top+1],ground:[(left+right)/2,bottom+1],front};
  artCache.set(img,result);return result;
 }
 function getLayout(options){
  const art=readArt(options.id,options.img);if(!art)return null;
  const size=Number.isFinite(options.scale)?clamp(options.scale,.25,4):1;
  const phase=Number.isFinite(options.phase)?options.phase:0;
  const moving=typeof options.moving==='number'?clamp(options.moving,0,1):(options.moving?1:0);
  const fx=options.fx<0?-1:1,groundY=16*size;
  const px=art.profile.height*size/art.bounds[3];
  const bob=-Math.abs(Math.sin(phase))*1.15*size*moving;
  const angle=Math.sin(phase)*.007*moving;
  const seatX=(art.profile.seat[0]*art.iw-art.ground[0])*px;
  const seatY=(art.profile.seat[1]*art.ih-art.ground[1])*px;
  const cosine=Math.cos(angle),sine=Math.sin(angle);
  const hipY=-3; // The belt/hip of the 48px painted player, above its knee hem.
  const riderX=fx*(seatX*cosine-seatY*sine);
  const riderY=groundY+bob+seatX*sine+seatY*cosine-hipY;
  const width=clamp(Number.isFinite(options.bootWidth)?options.bootWidth:10,8,13);
  const boots={
   far:{x:-fx*4.8,y:2.2,width:width*.82,angle:fx*.24,fx,alpha:.83},
   near:{x:fx*5.8,y:4.4,width:width*.92,angle:-fx*.28,fx,alpha:1}
  };
  return {art,x:Number.isFinite(options.x)?options.x:0,y:Number.isFinite(options.y)?options.y:0,fx,phase,moving,size,px,bob,angle,groundY,riderX,riderY,hipY,by:0,boots,width:art.bounds[2]*px,height:art.bounds[3]*px};
 }
 function mountTransform(g,l){g.translate(0,l.groundY+l.bob);g.scale(l.fx,1);g.rotate(l.angle);g.scale(l.px,l.px);g.translate(-l.art.ground[0],-l.art.ground[1]);}
 function drawRiderBoots(g,img,ride,layer){
  if(!ready(img)||!ride?.boots)return;
  const keys=layer?[layer]:['far','near'];
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
  const pose=typeof EnemyFootMotion!=='undefined'?EnemyFootMotion.frame(l.art.img,l.art.profile.legs,l.phase,l.moving,l.art.iw*l.px*device):l.art.img;
  g.save();g.translate(l.x,l.y);
  g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(0,l.groundY,l.width*.34,6*l.size,0,0,Math.PI*2);g.fill();
  if(l.art.profile.spectral){g.fillStyle='rgba(76,157,238,.085)';g.beginPath();g.ellipse(0,l.groundY,l.width*.39,8*l.size,0,0,Math.PI*2);g.fill();}
  g.save();if(l.art.profile.spectral)g.globalAlpha*=.88;mountTransform(g,l);
  g.drawImage(typeof mip==='function'?mip(pose,l.art.iw*l.px):pose,0,0,l.art.iw,l.art.ih);g.restore();
  if(typeof drawRider==='function'){
   g.save();mountTransform(g,l);const clipTransform=g.getTransform();g.restore();
   // Used inside the player's body save/restore only. Held weapons remain in
   // front of the neck; clipping the complete callback would swallow a sword.
   l.clipBody=bodyContext=>{const transform=bodyContext.getTransform();bodyContext.setTransform(clipTransform);bodyContext.clip(l.art.front,'evenodd');bodyContext.setTransform(transform);};
   g.save();g.translate(l.riderX,l.riderY);l.riderResult=drawRider(g,l);g.restore();
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
 return Object.freeze({draw,getLayout,drawRiderBoots,drawCast});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MountRenderer;
