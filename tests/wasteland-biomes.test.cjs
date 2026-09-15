const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=require('../assets/wasteland/world.js');
function physics(world){
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),start=source.indexOf('const SGRID=320;'),end=source.indexOf('function speedOf(',start);
 const collide=vm.runInNewContext(source.slice(start,end)+';collide',{world,WastelandWorld:W});
 return (x,y,r=13)=>collide({r},x,y);
}
function walk(w,points,blocked){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/100);
  for(let j=0;j<=steps;j++){
   const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;
   W.updateChunks(w,x,y,W.CHUNK);assert.equal(blocked(x,y),false,`blocked at ${x},${y}`);
  }
 }
}
test('one L-shaped Wasteland contains three original-size regions with no internal travel doors',()=>{
 const w=W.create();assert.equal(w.unified,true);assert.equal(w.key,'wasteland');assert.deepEqual([w.w,w.h],[100800,52000]);
 assert.equal(w.regions.reduce((n,r)=>n+r.w*r.h,0),45*16800*5200);
 assert.ok(w.regions.every(r=>r.w===50400&&r.h===26000));assert.equal(w.edgeNeighbors,undefined);
 assert.deepEqual(w.enemySpawns,[]);assert.equal(w.entrances.length,3);assert.deepEqual(w.spawn,{x:2400,y:49600});
 assert.equal(w.exit.id,'city');assert.deepEqual(w.entrances,W.ENTRANCES);
 assert.deepEqual(W.create('wasteland-snow').spawn,{x:28500,y:25700});
 assert.deepEqual(W.create('wasteland-desert').spawn,{x:50700,y:44000});
 for(const key of ['wasteland-snow','wasteland-desert']){const alias=W.create(key);assert.equal(alias.key,'wasteland');assert.equal(alias.unified,true);assert.equal(alias.paths.length,w.paths.length);}
});
test('all roads connect in the single world and both seams are continuously walkable',()=>{
 const w=W.create(),paths=W.worldPaths(w),id=p=>p.x+','+p.y,seen=new Set([id(w.spawn)]);let changed=true;
 while(changed){changed=false;for(const p of paths)if(p.points.some(v=>seen.has(id(v))))for(const v of p.points)if(!seen.has(id(v))){seen.add(id(v));changed=true;}}
 for(const p of paths)for(const v of p.points)assert.ok(seen.has(id(v)),`disconnected ${id(v)}`);
 const blocked=physics(w);for(const p of paths)walk(w,p.points,blocked);
 for(const pts of [[{x:28500,y:25300},{x:28500,y:26700}],[{x:49700,y:44000},{x:51100,y:44000}]]){walk(w,pts,blocked);walk(w,[...pts].reverse(),blocked);}
});
test('the northeast void is blocked while every existing biome and inner seam remains accessible',()=>{
 const w=W.create(),blocked=physics(w);
 for(const p of [[60000,12000],[50405,25995],[50400,25999]])assert.equal(W.isWalkable(w,...p,13),false);
 for(const p of [[25000,12000],[25000,40000],[75000,40000],[28500,26000],[50400,44000],[50350,25950]])assert.equal(W.isWalkable(w,...p,13),true);
 assert.equal(blocked(60000,12000),true);assert.equal(W.contains(w,NaN,100),false);
});
test('biome colors and texture blend weights agree on both sides of the shared coordinates',()=>{
 const w=W.create();assert.equal(W.biomeAt(w,25000,13000),'snow');assert.equal(W.biomeAt(w,25000,40000),'grass');assert.equal(W.biomeAt(w,75000,40000),'desert');
 assert.deepEqual(W.terrainWeights(w,25000,13000),{grass:0,snow:1,desert:0});
 assert.deepEqual(W.terrainWeights(w,25000,40000),{grass:1,snow:0,desert:0});
 assert.deepEqual(W.terrainWeights(w,75000,40000),{grass:0,snow:0,desert:1});
 assert.deepEqual(W.terrainWeights(w,28500,26000),{grass:.5,snow:.5,desert:0});
 assert.deepEqual(W.terrainWeights(w,50400,44000),{grass:.5,snow:0,desert:.5});
 for(const region of w._regions)for(const p of [[200,200],[25000,13000],[50300,25900]])assert.deepEqual(W.terrainWeights(w,p[0]+region.x,p[1]+region.y),W.terrainWeights(region.world,...p));
});
test('both vendors and three training pens share the map, with correct translated collision and access',()=>{
 const w=W.create(),t=w.training,s=w.stable,blocked=physics(w);
 assert.equal(w.npcs.length,2);assert.ok(w.npcs.includes(s.vendor));assert.ok(w.npcs.includes(t.vendor));
 assert.deepEqual([s.vendor.x,s.vendor.y],[15125,43115]);assert.deepEqual([t.vendor.x,t.vendor.y],[58320,43200]);
 assert.equal(t.paddocks.length,3);
 assert.deepEqual(t.building,W.TRAINING.building);assert.deepEqual(s.building,W.STABLE.building);
 walk(w,s.approach,blocked);walk(w,s.paddockApproach,blocked);walk(w,t.approach,blocked);
 for(const pen of t.paddocks)walk(w,[t.vendor,t.approach[1],{x:pen.gate.x,y:t.approach[1].y},pen.gate,pen.displaySpot],blocked);
 W.updateChunks(w,t.building.x,t.building.y,1800);assert.equal(blocked(t.building.x,t.building.y+t.building.collider.cyo),true);
 t.vendor.moving=true;assert.equal(W.create().training.vendor.moving,false);assert.equal(W.TRAINING.vendor.moving,false);
});
test('scenery and the two landmarks survive global travel without unbounded geometry caches',()=>{
 const w=W.create('wasteland',71),other=W.create('wasteland',71),origin={x:58320,y:43200};
 W.updateChunks(w,origin.x,origin.y,1800);W.updateChunks(other,origin.x,origin.y,1800);const original=JSON.stringify(w.solids);assert.deepEqual(w.solids,other.solids);
 for(let i=0;i<65;i++){
  const r=w.regions[i%3],x=r.x+700+(i*1877)%(r.w-1400),y=r.y+700+(i*877)%(r.h-1400);W.updateChunks(w,x,y,100000);
  assert.ok(w._regions.reduce((n,r)=>n+r.world._chunkCache.size,0)<=196);assert.ok(w.solids.length<=2200);
  for(const p of w.solids)assert.ok(W.contains(w,p.x,p.y));
 }
 W.updateChunks(w,origin.x,origin.y,1800);assert.equal(JSON.stringify(w.solids),original);
 W.updateChunks(w,w.stable.vendor.x,w.stable.vendor.y,1800);assert.ok(w.solids.some(p=>p.type==='stable'));
});
test('entrance decoration and return coordinates remain tied to the same three dungeons',()=>{
 const w=W.create(),types=[];
 for(const e of w.entrances){const props=w._landmarkProps.filter(p=>p.entranceLandmark===e.id);assert.ok(props.length>=8);types.push(props.map(p=>p.ftype||p.type).join(','));for(const p of props)assert.ok(Math.hypot(p.x-e.x,p.y-e.y)>=e.clearRadius+150);}
 assert.equal(new Set(types).size,3);for(const e of W.ENTRANCES)assert.ok(e.y>26000);
});
function context(counter){return new Proxy({createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};}},{get(o,k){return k in o?o[k]:(...args)=>{if(k==='drawImage')counter.draws++;};},set(o,k,v){o[k]=v;return true;}});}
test('a continuous viewport spanning two or three biomes retains one bounded terrain cache budget',()=>{
 const count={draws:0,canvases:0},ctx=context(count),im={width:1024,height:1024,complete:true},w=W.create();
 const options={images:{farm:im,snow:im,desert:im,dirtroad:im},createCanvas(width,height){assert.ok(width<=384&&height<=384);count.canvases++;return {width,height,getContext:()=>context(count)};}};
 for(const [x,y]of [[27500,25000],[49400,43000],[49400,25000],...Array.from({length:22},(_,i)=>[i*4200,36000])]){
  W.renderGround(ctx,w,{x,y,w:2200,h:1600},options);assert.ok(w._regions.reduce((n,r)=>n+(r.world._terrainCache?.size||0),0)<=72);
 }
 const before=count.canvases;W.renderGround(ctx,w,{x:0,y:0,w:w.w,h:w.h},options);assert.equal(count.canvases,before);assert.ok(count.draws>100);
});
