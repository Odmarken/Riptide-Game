/* Authored masks are checked against original PNGs without running the game. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const {readRgbaPng}=require('./helpers/png.cjs');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'assets/sprite-cutout-masks.js'),'utf8')+'\nglobalThis.masks=SPRITE_CUTOUT_MASKS;',context);
const masks=context.masks;
const images=Object.fromEntries(['pickaxe','staff'].map(name=>[name,readRgbaPng(path.join(root,'assets/weapons',name+'.png'))]));

function connected(image,seed,accept,diagonal=false){
 const {width,height}=image,seen=new Uint8Array(width*height),stack=[];
 const start=seed[1]*width+seed[0];
 if(!accept(start))return seen;
 seen[start]=1;stack.push(start);
 while(stack.length){
  const k=stack.pop(),x=k%width,y=Math.floor(k/width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy||!diagonal&&dx&&dy)continue;
   const nx=x+dx,ny=y+dy,n=ny*width+nx;
   if(nx<0||ny<0||nx>=width||ny>=height||seen[n]||!accept(n))continue;
   seen[n]=1;stack.push(n);
  }
 }
 return seen;
}
function inside(x,y,rect){return x>=rect[0]&&y>=rect[1]&&x<rect[0]+rect[2]&&y<rect[1]+rect[3];}

test('reviewed cutout masks match source dimensions and stay within their image',()=>{
 assert.deepEqual(Object.keys(masks).sort(),['pickaxe','staff']);
 for(const [name,mask]of Object.entries(masks)){
  const im=images[name];
  assert.deepEqual(Array.from(mask.size),[im.width,im.height],name+': asset needs a new mask review');
  for(const rect of mask.rects||[]){
   assert.equal(rect.length,4);assert.ok(rect.every(Number.isInteger));
   const [x,y,w,h]=rect;
   assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=im.width&&y+h<=im.height,name+': rectangle bounds');
  }
  for(const hole of mask.holes||[]){
   assert.equal(hole.seed.length,2);assert.ok(hole.seed.every(Number.isInteger));
   assert.ok(hole.seed[0]>=0&&hole.seed[0]<im.width&&hole.seed[1]>=0&&hole.seed[1]<im.height);
   for(const key of ['minimum','chroma','alpha'])assert.ok(Number.isInteger(hole[key])&&hole[key]>=0&&hole[key]<=255,key);
  }
 }
});

test('pickaxe rectangles remove reviewed islands without touching the weapon component',()=>{
 const im=images.pickaxe,rects=masks.pickaxe.rects;
 assert.equal(im.alpha(350,500),255,'The test seed must remain inside the painted shaft');
 const weapon=connected(im,[350,500],k=>im.pixels[k*4+3]>8,true);
 assert.ok(weapon.reduce((n,v)=>n+v,0)>90000,'The shaft seed must cover the main weapon');
 let removedVisible=0;
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
  if(!rects.some(rect=>inside(x,y,rect)))continue;
  assert.equal(weapon[y*im.width+x],0,`Mask clips weapon at ${x},${y}`);
  if(im.alpha(x,y)>8)removedVisible++;
 }
 assert.equal(removedVisible,1163,'Only the four reviewed detached components should be removed');
 // An accidental one-pixel extension left of the first rectangle clips this real edge.
 assert.equal(weapon[167*im.width+379],1);
 assert.ok(!rects.some(rect=>inside(379,167,rect)));
});

test('staff hole seed isolates white background and preserves the crystal and wooden frame',()=>{
 const im=images.staff,p=im.pixels,hole=masks.staff.holes[0];
 const accepted=k=>{
  const i=k*4,lo=Math.min(p[i],p[i+1],p[i+2]),hi=Math.max(p[i],p[i+1],p[i+2]);
  return p[i+3]>=hole.alpha&&lo>=hole.minimum&&hi-lo<=hole.chroma;
 };
 const region=connected(im,hole.seed,accepted);
 assert.equal(region.reduce((n,v)=>n+v,0),5364,'Changing the seed or thresholds needs visual review');
 let minX=im.width,minY=im.height,maxX=0,maxY=0;
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(region[y*im.width+x]){
  minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 assert.deepEqual([minX,minY,maxX,maxY],[56,35,158,207]);
 assert.equal(region[75*im.width+100],1,'The opaque white void must be included');
 assert.equal(region[140*im.width+102],0,'The blue crystal lies inside the bbox and must survive');
 assert.equal(region[190*im.width+144],0,'The wooden frame lies inside the bbox and must survive');
 assert.equal(im.alpha(102,140),254);assert.equal(im.alpha(144,190),254);
});
