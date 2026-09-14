const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../assets/wasteland/world.js');

function reachable(world,radius=30){
 const cols=world.w/W.CELL,rows=world.h/W.CELL,seen=new Set(),queue=[[Math.floor(world.spawn.x/W.CELL),Math.floor(world.spawn.y/W.CELL)]];
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i],key=x+','+y;if(seen.has(key)||x<0||y<0||x>=cols||y>=rows||!W.isWalkable(world,(x+.5)*W.CELL,(y+.5)*W.CELL,radius))continue;
  seen.add(key);queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
 }
 return seen;
}
test('Wasteland is exactly fifteen City areas and contains no enemy spawns',()=>{
 const w=W.create();assert.equal(w.w,50400);assert.equal(w.h,26000);assert.equal(w.w*w.h,15*16800*5200);assert.deepEqual(w.enemySpawns,[]);assert.deepEqual(w.portal,{x:-500,y:-500});
 assert.equal(w.entrances.length,3);assert.equal(new Set(w.entrances.map(e=>e.id)).size,3);
 for(const a of w.entrances){assert.ok(a.x>0&&a.y>0&&a.x<w.w&&a.y<w.h);for(const b of w.entrances)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>16000);}
});
test('safe roads form a connected graph from City exit to all three entrances',()=>{
 const w=W.create(),seen=new Set([w.spawn.x+','+w.spawn.y]);let changed=true;
 while(changed){changed=false;for(const p of w.paths)if(p.points.some(p=>seen.has(p.x+','+p.y)))for(const p2 of p.points){const k=p2.x+','+p2.y;if(!seen.has(k)){seen.add(k);changed=true;}}}
 for(const e of w.entrances)assert.ok(seen.has(e.x+','+e.y),e.id);
 for(const p of w.paths)for(let i=1;i<p.points.length;i++){
  const a=p.points[i-1],b=p.points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/600);
  for(let j=0;j<=steps;j++){
   const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;W.updateChunks(w,x,y,768);
   for(const s of w.solids)assert.ok(W.distanceToSegment(s.x,s.y,a,b)>=p.width/2+150-1e-8,'prop intrudes into road clearance');
  }
 }
});
test('entrance approaches remain clear and chunk props use valid existing art types',()=>{
 const w=W.create();for(const e of [...w.entrances,{...w.spawn,clearRadius:420}]){
  W.updateChunks(w,e.x,e.y,1800);for(const s of w.solids){assert.ok(Math.hypot(s.x-e.x,s.y-e.y)>=e.clearRadius+150);assert.ok(['tree','rock','farmitem'].includes(s.type));if(s.type==='farmitem')assert.equal(s.ftype,'tree_farm');}
 }
});
test('chunk geometry is deterministic, bounded, and invalidates equal-length collision grids',()=>{
 const w=W.create('wasteland',51),other=W.create('wasteland',51);
 W.updateChunks(w,25000,13000,Infinity);W.updateChunks(other,25000,13000,1800);assert.deepEqual(w.solids,other.solids);
 w._sg=new Map();w._sgN=w.solids.length;assert.equal(W.updateChunks(w,26000,13000,1800),true);assert.equal(w._sg,null);assert.equal(w._sgN,-1);assert.equal(W.updateChunks(w,26001,13001,1800),false);
 for(let i=0;i<90;i++){W.updateChunks(w,(i*1877)%w.w,(i*877)%w.h,100000);assert.ok(w.solids.length<=1020);assert.ok(w.deco.length<=1352);assert.ok(w._chunkCache.size<=196);}
 W.updateChunks(w,25000,13000,1800);assert.deepEqual(w.solids,other.solids);
});
for(const key of ['briarhollow','cindervein','frostveil']){
 test(key+': every floor tile is connected with full hero clearance',()=>{
  const w=W.create(key),seen=reachable(w);let floors=0;
  for(let y=0;y<w._rows;y++)for(let x=0;x<w._cols;x++)if(w._floorGrid[y*w._cols+x]){floors++;assert.ok(seen.has(x+','+y),`unreachable floor ${x},${y}`);}
  assert.equal(seen.size,floors);assert.ok(w.mwalls.length<80);assert.equal(W.updateChunks(w,100,100),false);assert.ok(!W.isWalkable(w,5,5,30));
  for(const p of [w.spawn,w.exit,...w.enemySpawns]){assert.ok(W.isWalkable(w,p.x,p.y,35));assert.ok(seen.has(Math.floor(p.x/W.CELL)+','+Math.floor(p.y/W.CELL)));}
 });
 test(key+': exactly two spacious boss arenas and fifteen regular mob positions',()=>{
  const w=W.create(key);assert.equal(w.bossRooms.length,2);assert.deepEqual(w.enemySpawns.filter(s=>s.type==='boss').map(s=>s.index),[0,1]);assert.equal(w.enemySpawns.filter(s=>s.type==='mob').length,15);
  for(const room of w.bossRooms){assert.ok(W.isWalkable(w,room.cx,room.cy,420));for(const s of w.solids)assert.ok(Math.hypot(s.x-room.cx,s.y-room.cy)>420+s.r);}
  for(const e of w.enemySpawns)for(const s of w.solids)assert.ok(Math.hypot(e.x-s.x,e.y-s.y)>s.r+35);
 });
 test(key+': collision walls cover precisely the non-floor area',()=>{
  const w=W.create(key);for(let y=0;y<w._rows;y++)for(let x=0;x<w._cols;x++)assert.equal(W.isWalkable(w,(x+.5)*W.CELL,(y+.5)*W.CELL),!!w._floorGrid[y*w._cols+x]);
 });
}
test('dungeons have distinct room routes and invalid identifiers fail explicitly',()=>{
 const layouts=['briarhollow','cindervein','frostveil'].map(k=>JSON.stringify(W.create(k).floors));assert.equal(new Set(layouts).size,3);assert.throws(()=>W.create('unknown'),RangeError);
});
function fakeContext(counter){return new Proxy({createRadialGradient(){return {addColorStop(){}};}},{get(o,k){if(k in o)return o[k];return (...args)=>{if(k==='drawImage'){counter.draws++;if(counter.onDraw)counter.onDraw(args,o);}};},set(o,k,v){o[k]=v;return true;}});}
test('ground canvas size, cache, and draw cost stay bounded even at world overview',()=>{
 const count={draws:0,canvases:0},ctx=fakeContext(count),w=W.create(),options={createCanvas(width,height){count.canvases++;assert.ok(width<=384&&height<=384);return {getContext:()=>fakeContext(count)};}};
 W.renderGround(ctx,w,{x:5000,y:5000,w:1600,h:1000},options);const created=count.canvases;assert.ok(created>0&&created<=12);
 W.renderGround(ctx,w,{x:5000,y:5000,w:1600,h:1000},options);assert.equal(count.canvases,created);
 for(let i=0;i<40;i++)W.renderGround(ctx,w,{x:i*1000,y:10000,w:1600,h:1000},options);assert.ok(w._terrainCache.size<=72);
 const before=count.canvases;W.renderGround(ctx,w,{x:0,y:0,w:w.w,h:w.h},options);assert.equal(count.canvases,before);
});
test('grass chunks recover when an already-sized image finishes loading',()=>{
 const world=W.create(),image={naturalWidth:1024,naturalHeight:1024,width:1024,height:1024,complete:false,src:'farm.png'};
 let grassDraws=0;const count={draws:0,canvases:0,onDraw(args){if(args[0]===image)grassDraws++;}};
 const options={images:{farm:image},createCanvas(){count.canvases++;return {getContext:()=>fakeContext(count)};}},ctx=fakeContext(count);
 const view={x:10000,y:10000,w:1200,h:900};
 W.renderGround(ctx,world,view,options);const fallbackTiles=new Map(world._terrainCache),fallbackCanvases=count.canvases;
 assert.ok(fallbackTiles.size>1);assert.equal(grassDraws,0,'an incomplete image cannot paint the terrain');
 W.renderGround(ctx,world,view,options);assert.equal(count.canvases,fallbackCanvases,'loading frames reuse their bounded fallback');
 image.complete=true; // Natural dimensions are unchanged when the pixels arrive.
 W.renderGround(ctx,world,view,options);assert.ok(grassDraws>0,'the loaded grass is painted on the next frame');
 for(const [key,tile]of fallbackTiles)assert.notEqual(world._terrainCache.get(key),tile,'all visible fallback chunks must be replaced');
 assert.equal(world._terrainCache.size,fallbackTiles.size);
 const readyCanvases=count.canvases,readyDraws=grassDraws;
 W.renderGround(ctx,world,view,options);assert.equal(count.canvases,readyCanvases);assert.equal(grassDraws,readyDraws,'finished terrain stays cached');
});
test('terrain cache follows image replacement, source changes and height, including broken images with display dimensions',()=>{
 const world=W.create(),view={x:10000,y:10000,w:200,h:150},count={draws:0,canvases:0},drawn=[];
 count.onDraw=args=>{if(args[0].src)drawn.push(args);};
 const options={images:{farm:{naturalWidth:1024,naturalHeight:768,complete:true,src:'farm.png'}},createCanvas(){count.canvases++;return {getContext:()=>fakeContext(count)};}},ctx=fakeContext(count);
 W.renderGround(ctx,world,view,options);let created=count.canvases;
 for(const change of [
  ()=>{options.images.farm={...options.images.farm};},
  ()=>{options.images.farm.src='replacement.png';},
  ()=>{options.images.farm.naturalHeight=512;}
 ]){
  change();W.renderGround(ctx,world,view,options);assert.ok(count.canvases>created,'image changes invalidate stale pixels');created=count.canvases;
 }
 assert.equal(drawn.at(-1)[4],512,'updated image height is used for the texture');
 options.images.farm={width:1024,height:1024,naturalWidth:0,naturalHeight:0,complete:true,src:'broken.png'};
 W.renderGround(ctx,world,view,options);assert.equal(drawn.some(args=>args[0].src==='broken.png'),false,'CSS size must not make a failed image drawable');
});
test('roads and Briar floors exclude the real dirt tile translucent border',()=>{
 const {readRgbaPng}=require('./helpers/png.cjs'),path=require('node:path');
 const png=readRgbaPng(path.join(__dirname,'../assets/farm/dirt_road.png'));
 assert.equal(png.width,256);assert.equal(png.height,256);
 assert.ok(Array.from({length:256},(_,y)=>png.alpha(0,y)).some(a=>a<255));
 for(let y=2;y<png.height-2;y++)for(let x=2;x<png.width-2;x++)assert.equal(png.alpha(x,y),255);
 const im={width:png.width,height:png.height,complete:true};
 for(const key of ['wasteland','briarhollow']){
  let draws=0;const count={draws:0,onDraw(args){if(args[0]===im){draws++;assert.deepEqual(args.slice(1,5),[2,2,252,252]);}}};
  const world=W.create(key),ctx=fakeContext(count),options={images:{dirtroad:im},createCanvas(){return {getContext:()=>fakeContext(count)};}};
  W.renderGround(ctx,world,{x:world.spawn.x-400,y:world.spawn.y-300,w:800,h:600},options);assert.ok(draws>0,key);
 }
});
test('translucent floor textures blend complete layers instead of overlapping repeats',()=>{
 for(const [key,asset,alpha]of [['briarhollow','farm',.36],['frostveil','snow',.53]]){
  const im={width:1024,height:1024,complete:true};let repeats=0,blends=0;
  const count={draws:0,onDraw(args,ctx){
   if(args[0]===im){repeats++;assert.equal(ctx.globalAlpha??1,1,'texture repeats must be opaque');}
   else if(ctx.globalAlpha===alpha){blends++;assert.equal(args.length,5);assert.equal(args[0].width,384);assert.equal(args[0].height,384);}
  }};
  const world=W.create(key),options={images:{[asset]:im},createCanvas(width,height){return {width,height,getContext:()=>fakeContext(count)};}};
  W.renderGround(fakeContext(count),world,{x:world.spawn.x-400,y:world.spawn.y-300,w:800,h:600},options);
  assert.ok(repeats>0,key);assert.ok(blends>0,key);assert.ok(blends<repeats,key);
 }
});

test('all Cindervein rail sleepers stay fixed in world space across camera movement, zoom and segment direction',()=>{
 const world=W.create('cindervein');
 function sleepers(w,view,focus){
  let points=[];const positions=new Set();
  const ctx=new Proxy({
   beginPath(){points=[];},moveTo(x,y){points.push({x,y});},lineTo(x,y){points.push({x,y});},
   stroke(){
    if(this.strokeStyle!=='#4a3427'||points.length!==2)return;
    const x=(points[0].x+points[1].x)/2,y=(points[0].y+points[1].y)/2;
    if(Math.abs(x-focus.x)<75&&Math.abs(y-focus.y)<75)positions.add(x.toFixed(5)+','+y.toFixed(5));
   }
  },{get(o,k){return k in o?o[k]:()=>{};}});
  W.renderGround(ctx,w,view,{createCanvas:()=>null});
  return [...positions].sort();
 }
 for(const route of world.paths)for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i];if(Math.hypot(b.x-a.x,b.y-a.y)<200)continue;
  const focus={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const scene={...world,rooms:[],paths:[{width:route.width,points:[a,b]}]};
  const base=sleepers(scene,{x:focus.x-400,y:focus.y-300,w:800,h:600},focus);
  assert.ok(base.length>0,'comparison region includes actual sleepers');
  for(const zoom of [.45,.88,1,1.73,2.4])for(const delta of [0,7.25,29.75]){
   const view={x:focus.x-400/zoom+delta,y:focus.y-300/zoom+delta,w:800/zoom,h:600/zoom};
   assert.deepEqual(sleepers(scene,view,focus),base,`rail ${a.x},${a.y} -> ${b.x},${b.y}, zoom ${zoom}, camera +${delta}`);
   const reverse={...scene,paths:[{width:route.width,points:[b,a]}]};
   assert.deepEqual(sleepers(reverse,view,focus),base,'reversing the same rail cannot move its sleepers');
  }
 }
});
