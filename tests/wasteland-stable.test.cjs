const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const FullW=require('../assets/wasteland/world.js');
// Verify the original authored stable/roads before the unified-map translation.
const W={...FullW,create(key='wasteland',seed){const w=FullW.create(key,seed);return w.unified?w._regions.find(r=>r.key===key).world:w;}};
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');

function physics(world){
 const start=source.indexOf('const SGRID=320;'),end=source.indexOf('function speedOf(',start);
 assert.ok(start>=0&&end>start,'use the actual game collision grid and collider');
 const collide=vm.runInNewContext(source.slice(start,end)+';collide',{world});
 return (x,y,r=16)=>collide({r},x,y);
}
function walk(world,points,blocked){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/40);
  for(let n=0;n<=steps;n++){
   const x=a.x+(b.x-a.x)*n/steps,y=a.y+(b.y-a.y)*n/steps;
   W.updateChunks(world,x,y,W.CHUNK);
   assert.equal(blocked(x,y),false,`blocked walk at ${x},${y}`);
  }
 }
}

test('the stable is a deterministic landmark north of the existing junction with isolated vendor state',()=>{
 const a=W.create('wasteland',13),b=W.create('wasteland',987),s=a.stable;
 assert.deepEqual(s,b.stable);assert.notEqual(s,b.stable);assert.notEqual(s.vendor,b.stable.vendor);
 assert.equal(a.npcs.length,1);assert.equal(a.npcs[0],s.vendor);assert.equal(s.vendor.name,'Torsten Tygel');
 assert.equal(s.vendor.game,'stable');assert.equal(s.building.w,310);assert.ok(s.building.x>s.junction.x&&s.building.y<s.junction.y);
 assert.deepEqual([a.w,a.h],[50400,26000]);assert.deepEqual(a.spawn,{x:2400,y:23600});
 assert.deepEqual(a.paths.map(p=>[p.width,p.points.map(p=>[p.x,p.y])]),[
  [180,[[2400,23600],[8000,22000],[14000,18000],[25000,15000],[33000,18000],[43200,20500]]],
  [160,[[14000,18000],[11000,12000],[12600,6200]]],
  [160,[[25000,15000],[28500,9200],[34500,6400],[41400,4200]]],
  [140,[[12600,6200],[21000,7400],[28500,9200]]]
 ]);
 s.vendor.moving=true;assert.equal(b.stable.vendor.moving,false);assert.equal(W.STABLE.vendor.moving,false);
 assert.ok(Object.isFrozen(W.STABLE)&&Object.isFrozen(W.STABLE.building.collider));
 for(const key of ['briarhollow','cindervein','frostveil'])assert.equal(W.create(key).stable,undefined);
});

test('all authored roads remain open through the actual collision grid',()=>{
 const w=W.create(),blocked=physics(w);
 for(const route of w.paths)walk(w,route.points,blocked);
});

test('the hero can walk from the City entry to Torsten, the stable front and the open paddock gate',()=>{
 for(const seed of [1,13,99]){
  const w=W.create('wasteland',seed),blocked=physics(w),s=w.stable;
  walk(w,[w.spawn,{x:8000,y:22000},s.junction,s.approach[0],s.vendor],blocked);
  walk(w,s.approach,blocked);walk(w,s.paddockApproach,blocked);
  for(const point of s.paddock.displaySpots)walk(w,[s.paddockApproach.at(-1),point],blocked);
  const b=s.building,c=b.collider;
  assert.equal(blocked(b.x,b.y+c.cyo),true,'the stable footprint is solid');
  const fence=s.props.find(p=>p.ftype==='staket');
  assert.equal(blocked(fence.x,fence.y+fence.cyo),true,'paddock rails block passage');
  assert.equal(blocked(s.paddock.gate.x,s.paddock.gate.y),false,'the gate itself stays open');
 }
});

test('landmark props survive chunk eviction and invalidate stale collision grids on return',()=>{
 const w=W.create(),s=w.stable;
 W.updateChunks(w,15000,17100,1800);
 const before=w.solids.filter(p=>p.stableLandmark),snapshot=JSON.stringify(before),vendor=s.vendor;
 assert.equal(before.length,25);assert.equal(new Set(before).size,25);
 assert.equal(physics(w)(s.building.x,s.building.y-25),true);assert.ok(w._sg);
 for(let i=0;i<40;i++)W.updateChunks(w,25000+(i*379)%23000,3000+(i*577)%17000,4096);
 assert.ok(w._chunkCache.size<=196);assert.equal(w._sg,null);assert.equal(w._sgN,-1);
 w._chunkCache.clear();w._chunkKey='';W.updateChunks(w,15000,17100,1800);
 const after=w.solids.filter(p=>p.stableLandmark);
 assert.equal(JSON.stringify(after),snapshot);assert.deepEqual(after,before);
 assert.equal(w.stable,s);assert.equal(w.npcs[0],vendor);
 for(let i=0;i<5;i++)W.updateChunks(w,15000,17100,1800);
 assert.equal(w.solids.filter(p=>p.stableLandmark).length,25,'repeated loading does not duplicate fences');
});

test('trees and rocks cannot regenerate inside the building, yard or approach clearances',()=>{
 for(const seed of [1,13,99,12345]){
  const w=W.create('wasteland',seed);W.updateChunks(w,15000,17100,1800);
  for(const p of w.solids.filter(p=>!p.stableLandmark))for(const r of w.stable.clearZones)
   assert.ok(!(p.x>r.x-150&&p.x<r.x+r.w+150&&p.y>r.y-150&&p.y<r.y+r.h+150),'generated prop overlaps stable clearance');
 }
});

test('paddock props use existing farm assets and their actual scaled collision definitions',()=>{
 const start=source.indexOf('const FARM_BUILD='),end=source.indexOf('const FARM_PRESTIGE=',start);
 assert.ok(start>=0&&end>start);
 const catalogue=vm.runInNewContext(source.slice(start,end)+';FARM_BUILD'),w=W.create();
 for(const prop of w.stable.props.filter(p=>p.type==='farmitem')){
  const def=catalogue.find(d=>d.id===prop.ftype);assert.ok(def,prop.ftype);
  assert.ok(fs.existsSync(path.join(__dirname,'../assets/farm',def.img+'.png')),def.img);
  assert.ok(prop.it.sc>=.5&&prop.it.sc<=2.5,'renderer scale clamp must match collision');
  for(const key of ['r','crx','cry','cyo']){
   if(def.col[key]===undefined)assert.equal(prop[key],undefined);
   else assert.equal(prop[key],def.col[key]*prop.it.sc,prop.ftype+' '+key);
  }
 }
});
