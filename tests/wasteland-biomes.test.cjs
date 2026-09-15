const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=require('../assets/wasteland/world.js');
const keys=['wasteland','wasteland-snow','wasteland-desert'];

function physics(world){
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),start=source.indexOf('const SGRID=320;'),end=source.indexOf('function speedOf(',start);
 const collide=vm.runInNewContext(source.slice(start,end)+';collide',{world});
 return (x,y,r=16)=>collide({r},x,y);
}
function walk(world,points,blocked){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/45);
  for(let n=0;n<=steps;n++){
   const x=a.x+(b.x-a.x)*n/steps,y=a.y+(b.y-a.y)*n/steps;
   // Edge travel happens before the hero's radius can reach the outer bounds.
   if(x<50||y<50||x>world.w-50||y>world.h-50)continue;
   W.updateChunks(world,x,y,W.CHUNK);assert.equal(blocked(x,y),false,`blocked ${world.key} at ${x},${y}`);
  }
 }
}

test('three equal-size overworlds join north and east while retaining all old destinations',()=>{
 const worlds=keys.map(key=>W.create(key));
 for(const w of worlds){assert.deepEqual([w.w,w.h],[50400,26000]);assert.equal(w.overworld,true);assert.equal(w.dungeon,null);assert.deepEqual(w.enemySpawns,[]);}
 assert.equal(worlds.reduce((sum,w)=>sum+w.w*w.h,0),3*15*16800*5200);
 const [grass,snow,desert]=worlds;
 assert.deepEqual(grass.spawn,{x:2400,y:23600});assert.equal(grass.exit.id,'city');assert.equal(grass.entrances.length,3);
 assert.equal(snow.exit,undefined);assert.equal(desert.exit,undefined);assert.deepEqual(snow.entrances,[]);assert.deepEqual(desert.entrances,[]);
 assert.equal(snow.worldOffset.y+snow.h,grass.worldOffset.y);assert.equal(desert.worldOffset.x,grass.worldOffset.x+grass.w);
 assert.deepEqual(grass.edgeNeighbors,{north:'wasteland-snow',east:'wasteland-desert'});
 assert.equal(snow.edgeNeighbors.south,'wasteland');assert.equal(desert.edgeNeighbors.west,'wasteland');
 grass.edgeNeighbors.north='bad';assert.equal(W.create().edgeNeighbors.north,'wasteland-snow');assert.ok(Object.isFrozen(W.OVERWORLDS.wasteland.neighbors));
});

test('all roads form one connected route network across the three map coordinates',()=>{
 const worlds=keys.map(key=>W.create(key)),points=w=>W.worldPaths(w).map(p=>p.points.map(v=>({x:v.x+w.worldOffset.x,y:v.y+w.worldOffset.y})));
 const paths=worlds.flatMap(points),id=p=>p.x+','+p.y,seen=new Set([id(worlds[0].spawn)]);let changed=true;
 while(changed){changed=false;for(const route of paths)if(route.some(p=>seen.has(id(p))))for(const p of route)if(!seen.has(id(p))){seen.add(id(p));changed=true;}}
 for(const route of paths)for(const point of route)assert.ok(seen.has(id(point)),`disconnected road ${id(point)}`);
 for(const w of worlds){const blocked=physics(w);for(const p of W.worldPaths(w))walk(w,p.points,blocked);}
});

test('biome blends use continuous global weights with full snow and desert interiors',()=>{
 const grass=W.create(),snow=W.create('wasteland-snow'),desert=W.create('wasteland-desert');
 for(let x=0;x<=grass.w;x+=911){assert.deepEqual(W.terrainWeights(grass,x,0),W.terrainWeights(snow,x,snow.h));assert.deepEqual(W.terrainWeights(grass,x,-500),W.terrainWeights(snow,x,snow.h-500));}
 for(let y=0;y<=grass.h;y+=577){assert.deepEqual(W.terrainWeights(grass,grass.w,y),W.terrainWeights(desert,0,y));assert.deepEqual(W.terrainWeights(grass,grass.w+500,y),W.terrainWeights(desert,500,y));}
 assert.deepEqual(W.terrainWeights(grass,25000,13000),{grass:1,snow:0,desert:0});
 assert.deepEqual(W.terrainWeights(snow,25000,13000),{grass:0,snow:1,desert:0});
 assert.deepEqual(W.terrainWeights(desert,25000,13000),{grass:0,snow:0,desert:1});
 for(const w of [grass,snow,desert])for(let i=0;i<25;i++){const weights=Object.values(W.terrainWeights(w,i*2016,i*1040));assert.ok(weights.every(v=>v>=0&&v<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b)-1)<1e-12);}
});

test('linked border strips remain empty across every travel coordinate and seeds',()=>{
 for(const seed of [1,13,997])for(const key of keys){
  const w=W.create(key,seed);
  for(const side of Object.keys(w.edgeNeighbors))for(let i=0;i<=24;i++){
   const x=side==='west'?60:side==='east'?w.w-60:Math.max(60,Math.min(w.w-60,w.w*i/24));
   const y=side==='north'?60:side==='south'?w.h-60:Math.max(60,Math.min(w.h-60,w.h*i/24));
   W.updateChunks(w,x,y,W.CHUNK);
   for(const p of w.solids)assert.ok(Math.hypot(p.x-x,p.y-y)>180,`${key} ${side} has a blocked landing`);
  }
 }
});

test('training grounds contain three accessible pens, safe approach and correctly scaled farm props',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),start=source.indexOf('const FARM_BUILD='),end=source.indexOf('const FARM_PRESTIGE=',start),catalogue=vm.runInNewContext(source.slice(start,end)+';FARM_BUILD');
 for(const seed of [1,13,997]){
  const w=W.create('wasteland-desert',seed),t=w.training,blocked=physics(w);
  assert.equal(t.paddocks.length,3);assert.equal(w.npcs[0],t.vendor);assert.equal(t.vendor.game,'tidetraining');
  walk(w,t.approach,blocked);
  for(const pen of t.paddocks){walk(w,[t.vendor,t.approach[1],{x:pen.gate.x,y:t.approach[1].y},pen.gate,pen.displaySpot],blocked);assert.equal(blocked(pen.gate.x,pen.gate.y),false);}
  W.updateChunks(w,t.building.x,t.building.y,1800);assert.equal(blocked(t.building.x,t.building.y+t.building.collider.cyo),true);
  for(const p of w.solids.filter(p=>!p.trainingLandmark))for(const r of t.clearZones)assert.ok(!(p.x>r.x-150&&p.x<r.x+r.w+150&&p.y>r.y-150&&p.y<r.y+r.h+150));
  for(const p of t.props.filter(p=>p.type==='farmitem')){
   const def=catalogue.find(d=>d.id===p.ftype);assert.ok(def,p.ftype);assert.ok(fs.existsSync(path.join(__dirname,'../assets/farm',def.img+'.png')));
   assert.ok(p.it.sc>=.5&&p.it.sc<=2.5);
   for(const k of ['r','crx','cry','cyo'])assert.equal(p[k],def.col[k]===undefined?undefined:def.col[k]*p.it.sc,p.ftype+' '+k);
  }
 }
 const a=W.create('wasteland-desert'),b=W.create('wasteland-desert');a.training.vendor.moving=true;assert.equal(b.training.vendor.moving,false);assert.equal(W.TRAINING.vendor.moving,false);
});

test('biome geometry remains deterministic and bounded through long-distance exploration',()=>{
 for(const key of keys.slice(1)){
  const w=W.create(key,71),other=W.create(key,71);W.updateChunks(w,22000,14000,1800);W.updateChunks(other,22000,14000,1800);const original=JSON.stringify(w.solids);assert.deepEqual(w.solids,other.solids);
  for(let i=0;i<60;i++){W.updateChunks(w,(i*1877)%w.w,(i*877)%w.h,100000);assert.ok(w.solids.length<=1110);assert.ok(w.deco.length<=1352);assert.ok(w._chunkCache.size<=196);}
  W.updateChunks(w,22000,14000,1800);assert.equal(JSON.stringify(w.solids),original);
  if(key==='wasteland-snow')assert.ok(w.solids.filter(p=>p.type==='tree').every(p=>p.snowy));
 }
});

test('each existing entrance has distinct anchored decoration while keeping the doorway open',()=>{
 const w=W.create(),types=[];
 for(const e of w.entrances){
  const props=w._landmarkProps.filter(p=>p.entranceLandmark===e.id);assert.ok(props.length>=8);types.push(props.map(p=>p.ftype||p.type).join(','));
  for(const p of props){assert.ok(Math.hypot(p.x-e.x,p.y-e.y)>=e.clearRadius+150);for(const road of W.worldPaths(w))for(let i=1;i<road.points.length;i++)assert.ok(W.distanceToSegment(p.x,p.y,road.points[i-1],road.points[i])>=road.width/2+150);}
 }
 assert.equal(new Set(types).size,3);
});

function context(counter){return new Proxy({createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};}},{get(o,k){return k in o?o[k]:(...args)=>{if(k==='drawImage')counter.draws++;};},set(o,k,v){o[k]=v;return true;}});}
test('new terrain and border blends retain bounded caches and never allocate whole-map canvases',()=>{
 const count={draws:0,canvases:0},ctx=context(count),im={width:1024,height:1024,complete:true},options={images:{farm:im,snow:im,desert:im,dirtroad:im},createCanvas(width,height){assert.ok(width<=384&&height<=384);count.canvases++;return {width,height,getContext:()=>context(count)};}};
 for(const key of keys){
  const w=W.create(key);
  for(let i=0;i<22;i++)W.renderGround(ctx,w,{x:i*2100,y:key==='wasteland-snow'?w.h-900:200,w:1600,h:900},options);
  assert.ok(w._terrainCache.size<=72);
  const before=count.canvases;W.renderGround(ctx,w,{x:0,y:0,w:w.w,h:w.h},options);assert.equal(count.canvases,before);
 }
 assert.ok(count.draws>100);
});
