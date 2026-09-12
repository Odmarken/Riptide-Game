/* A few cutouts contain white matte outside their painted outlines. Correct only
   reviewed sprites, before scaling, and cache the result once per loaded image. */
const SPRITE_EDGE_PROFILES={
 'farm/flowerbed_farm.png':{radius:6}, 'farm/woodpile_farm.png':{},
 'farm/trough_farm.png':{radius:6}, 'farm/well_farm.png':{radius:5},
 'farm/bench_farm.png':{}, 'farm/farmsign_farm.png':{},
 'farm/pumpkins_farm.png':{}, 'farm/scarecrow_farm.png':{},
 'farm/tree_farm.png':{minimum:110,chroma:50,radius:10,search:16,mask:'farm_tree'},
 'farm/pond_farm.png':{mask:'pondRim',edge:false},
 'farm/fountain_farm.png':{mask:'fountainRim',edge:false},
 'farm/farmhouse_litet.png':{mask:'farmhouseSmall',grayMatte:[1061,964],minimum:110,radius:8,search:24,baseEdge:[626,24]},
 'farm/Farmhouse_medium.png':{grayMatte:[1056,1049],minimum:110,radius:8,search:24,baseEdge:[681,24]},
 'farm/farmhouse_mansion.png':{grayMatte:[1190,900],minimum:110,radius:8,search:24,baseEdge:[585,24]},
 'farm/chickenhouse_farm.png':{grayMatte:[946,1001],minimum:110,radius:8,search:24,baseEdge:[650,24]},
 'farm/lada_farm.png':{grayMatte:[1042,1097],minimum:110,radius:8,search:24,baseEdge:[713,24]},
 'farm/beehives_farm.png':{mask:'beehivePlatformRim',minimum:150,radius:6,search:14},
 'farm/haywagon_farm.png':{mask:'haywagonWheelRim',minimum:150,radius:6,search:14},
 'farm/cowfarm_liten.png':{mask:'farm_calf',edge:false},
 'farm/chickenfarm_big.png':{grayMatte:[808,875,245],edge:false},
 'farm/cowfarm_big.png':{grayMatte:[963,722,245],edge:false},
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
 if(profile.edge===false)return 0;
 const source=new Uint8ClampedArray(pixels),radius=profile.search||8;
 const minimum=profile.minimum||190,chroma=profile.chroma||50;
 let changed=0;
 const sample=(x,y)=>x<0||y<0||x>=width||y>=height?-1:(y*width+x)*4;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Grass around these house bases has a wider trapped fringe than the roof.
  const edgeRadius=profile.baseEdge&&y>=profile.baseEdge[0]?profile.baseEdge[1]:(profile.radius||4);
  const i=(y*width+x)*4,a=source[i+3];
  // Solid paint and coloured translucency (water, foliage, light) are untouched.
  if(!a||a===255)continue;
  const lo=Math.min(source[i],source[i+1],source[i+2]),hi=Math.max(source[i],source[i+1],source[i+2]);
  if(lo<minimum||hi-lo>chroma)continue;
  const light=(source[i]+source[i+1]+source[i+2])/3;
  let edge=false,nearest=-1,best=Infinity,brightest=-1;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const distance=dx*dx+dy*dy;if(!distance||distance>radius*radius)continue;
   const j=sample(x+dx,y+dy);
   if(j<0||source[j+3]<16){if(distance<=edgeRadius*edgeRadius)edge=true;continue;}
   if(source[j+3]<240)continue;
   const donorLight=(source[j]+source[j+1]+source[j+2])/3;
   // Skip the pale transition between matte and paint as well as the white rim.
   // The actual dark outline can lie several pixels farther into the cutout.
   if(donorLight>Math.min(175,light-60))continue;
   if(distance<best||(distance===best&&donorLight>brightest)){nearest=j;best=distance;brightest=donorLight;}
  }
  if(!edge||nearest<0)continue;
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
  const [bx,by,bw,bh]=hole.bounds||[0,0,width,height];
  for(let q=0;q<queue.length;q++){
   const p=queue[q];if(visited[p])continue;visited[p]=1;
   const x=p%width,y=Math.floor(p/width);
   if(x<bx||y<by||x>=bx+bw||y>=by+bh)continue;
   const i=p*4,lo=Math.min(pixels[i],pixels[i+1],pixels[i+2]),hi=Math.max(pixels[i],pixels[i+1],pixels[i+2]);
   if(!pixels[i+3]||pixels[i+3]<(hole.alpha||1)||pixels[i+3]>(hole.maxAlpha||255)||lo<hole.minimum||hi-lo>hole.chroma)continue;
   clear(i);
   if(p%width)queue.push(p-1);if(p%width<width-1)queue.push(p+1);
   if(p>=width)queue.push(p-width);if(p<width*(height-1))queue.push(p+width);
   if(hole.eight)for(const dy of [-1,1])for(const dx of [-1,1]){
    if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)queue.push(p+dy*width+dx);
   }
  }
 }
 return changed;
}
function cleanSpriteGrayMatte(pixels,width,height,size){
 if(!size||size[0]!==width||size[1]!==height)return 0;
 // Reviewed exports contain a neutral backing whose RGB tracks its alpha.
 // Follow only that backing from transparent space; isolated grey paint stays.
 const candidate=new Uint8Array(width*height),queue=[];
 for(let p=0;p<candidate.length;p++){
  const i=p*4,a=pixels[i+3],lo=Math.min(pixels[i],pixels[i+1],pixels[i+2]),hi=Math.max(pixels[i],pixels[i+1],pixels[i+2]);
  const light=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
  if(a&&a<255&&a<=(size[2]||254)&&hi-lo<=10&&
   (Math.abs(light-a)<=10||(a<245&&light>=a*.76&&light<=a+10)))candidate[p]=1;
 }
 for(let p=0;p<candidate.length;p++)if(candidate[p]){
  const x=p%width,y=Math.floor(p/width);
  let edge=false;
  for(let dy=-1;dy<=1&&!edge;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy;
   if(xx<0||yy<0||xx>=width||yy>=height||pixels[(yy*width+xx)*4+3]===0){edge=true;break;}
  }
  if(edge){candidate[p]=2;queue.push(p);}
 }
 for(let q=0;q<queue.length;q++){
  const p=queue[q],x=p%width,y=Math.floor(p/width);pixels[p*4+3]=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;
   const n=yy*width+xx;if(candidate[n]===1){candidate[n]=2;queue.push(n);}
  }
 }
 return queue.length;
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
  const cleared=applySpriteCutoutMask(data.data,c.width,c.height,mask)+cleanSpriteGrayMatte(data.data,c.width,c.height,profile.grayMatte);
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
