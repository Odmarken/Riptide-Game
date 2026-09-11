/* A few cutouts contain white matte outside their painted outlines. Correct only
   reviewed sprites, before scaling, and cache the result once per loaded image. */
const SPRITE_EDGE_PROFILES={
 'farm/flowerbed_farm.png':{radius:6}, 'farm/woodpile_farm.png':{},
 'farm/trough_farm.png':{radius:6}, 'farm/well_farm.png':{radius:5},
 'farm/bench_farm.png':{}, 'farm/farmsign_farm.png':{},
 'farm/pumpkins_farm.png':{}, 'farm/scarecrow_farm.png':{},
 'city/house_stone.png':{},
 'weapons/bow.png':{minimum:150,chroma:24},
 'weapons/mace.png':{minimum:150,chroma:24},
 'weapons/staff.png':{minimum:150,chroma:24,mask:'staff'},
 'weapons/sword.png':{minimum:150,chroma:24},
 'weapons/pickaxe.png':{mask:'pickaxe'},
 'boss/rat_boss.png':{minimum:180,chroma:24}
};
const spriteEdgeCache=new WeakMap();
function spriteEdgeProfile(img){
 const path=decodeURIComponent((img.src||'').split(/[?#]/)[0]).replace(/\\/g,'/');
 return SPRITE_EDGE_PROFILES[path.split('/assets/').pop().replace(/^assets\//,'')]||null;
}
function cleanSpriteEdgePixels(pixels,width,height,profile){
 const source=new Uint8ClampedArray(pixels),radius=profile.search||8,edgeRadius=profile.radius||4;
 const minimum=profile.minimum||190,chroma=profile.chroma||50;
 let changed=0;
 const sample=(x,y)=>x<0||y<0||x>=width||y>=height?-1:(y*width+x)*4;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,a=source[i+3];
  // Solid paint and coloured translucency (water, foliage, light) are untouched.
  if(!a||a===255)continue;
  const lo=Math.min(source[i],source[i+1],source[i+2]),hi=Math.max(source[i],source[i+1],source[i+2]);
  if(lo<minimum||hi-lo>chroma)continue;
  let edge=false,nearest=-1,best=Infinity,brightest=-1;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const distance=dx*dx+dy*dy;if(!distance||distance>radius*radius)continue;
   const j=sample(x+dx,y+dy);
   if(j<0||source[j+3]<16){if(distance<=edgeRadius*edgeRadius)edge=true;continue;}
   if(source[j+3]<240)continue;
   const light=(source[j]+source[j+1]+source[j+2])/3;
   // Skip the pale transition between matte and paint as well as the white rim.
   // The actual dark outline can lie several pixels farther into the cutout.
   if(light>175)continue;
   if(distance<best||(distance===best&&light>brightest)){nearest=j;best=distance;brightest=light;}
  }
  const light=(source[i]+source[i+1]+source[i+2])/3;
  if(!edge||nearest<0||brightest>175||light-brightest<60)continue;
  const coverage=Math.max(0,Math.min(1,(255-light)/(255-brightest)));
  pixels[i]=source[nearest];pixels[i+1]=source[nearest+1];pixels[i+2]=source[nearest+2];
  pixels[i+3]=Math.round(a*coverage);changed++;
 }
 return changed;
}
function applySpriteCutoutMask(pixels,width,height,mask){
 if(!mask||mask.size[0]!==width||mask.size[1]!==height)return 0;
 let changed=0;
 const clear=i=>{if(pixels[i+3]){pixels[i+3]=0;changed++;}};
 for(const [x,y,w,h] of mask.rects||[])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)clear((yy*width+xx)*4);
 for(const hole of mask.holes||[]){
  const visited=new Uint8Array(width*height),queue=[hole.seed[1]*width+hole.seed[0]];
  for(let q=0;q<queue.length;q++){
   const p=queue[q];if(visited[p])continue;visited[p]=1;
   const i=p*4,lo=Math.min(pixels[i],pixels[i+1],pixels[i+2]),hi=Math.max(pixels[i],pixels[i+1],pixels[i+2]);
   if(pixels[i+3]<hole.alpha||lo<hole.minimum||hi-lo>hole.chroma)continue;
   clear(i);
   if(p%width)queue.push(p-1);if(p%width<width-1)queue.push(p+1);
   if(p>=width)queue.push(p-width);if(p<width*(height-1))queue.push(p+width);
  }
 }
 return changed;
}
function spriteEdgeSource(img){
 if(!img||img.complete===false||!img.naturalWidth)return img;
 const profile=spriteEdgeProfile(img);if(!profile)return img;
 const key=img.src+'|'+img.naturalWidth+'x'+img.naturalHeight,cached=spriteEdgeCache.get(img);
 if(cached&&cached.key===key)return cached.source;
 let source=img;
 try{
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
  const g=c.getContext('2d');g.drawImage(img,0,0);
  const data=g.getImageData(0,0,c.width,c.height);
  const mask=typeof SPRITE_CUTOUT_MASKS!=='undefined'&&SPRITE_CUTOUT_MASKS[profile.mask];
  const cleared=applySpriteCutoutMask(data.data,c.width,c.height,mask);
  if(cleanSpriteEdgePixels(data.data,c.width,c.height,profile)+cleared){
   g.putImageData(data,0,0);source=c;
   // Keep the normal image sizing contract for mipmaps and art placement.
   c.naturalWidth=c.width;c.naturalHeight=c.height;c.complete=true;
  }
 }catch(_){ /* Unreadable third-party canvases retain their original appearance. */ }
 spriteEdgeCache.set(img,{key,source});return source;
}
function spriteEdgeThumbnail(img){
 const source=spriteEdgeSource(img);if(source===img)return;
 img.onload=null;img.src=source.toDataURL('image/png');
}
