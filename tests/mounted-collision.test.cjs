const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=require('../assets/wasteland/world.js'),Mounts=require('../assets/mounts/mounts.js');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const start=source.indexOf('const SGRID=320;'),end=source.indexOf('/* ==================== FX ==================== */',start);
assert.ok(start>=0&&end>start,'exercise the actual collision grid, speed and movement code');
const physics=source.slice(start,end);

function tracked(x,y,extra={}){
 const moves=[],body={x,y,r:13,walk:0,...extra};
 const entity=new Proxy(body,{set(target,key,value){
  target[key]=value;if(key==='y')moves.push({x:target.x,y:target.y});return true;
 }});
 return {entity,moves};
}
function setup({x=15525,y=16656,id='spectral-tiger',swift=1,empty=false,zone={wasteland:true}}={}){
 // These historical fence coordinates belong to the original authored region.
 const world=empty?{w:50400,h:26000,solids:[]}:W.create('wasteland',13)._regions.find(r=>r.key==='wasteland').world;
 if(!empty)W.updateChunks(world,x,y,1000);
 const {entity:hero,moves}=tracked(x,y),mountRide=Mounts.createRide();mountRide.id=id;
 const env={world,hero,mountRide,Mounts,pet:null,S:{mounts:{owned:['spectral-tiger'],equipped:'spectral-tiger'}},
  zoneOf:()=>zone,swiftMul:()=>swift,speedBoostMul:()=>2.6,
  Math:Object.assign(Object.create(Math),{random:()=>.25})};
 vm.createContext(env);vm.runInContext(physics,env);
 return {...env,moves};
}
function safeSteps(f,from){
 for(const to of f.moves){
  assert.ok(Math.hypot(to.x-from.x,to.y-from.y)<=8+1e-9,'every committed move, including slides, is at most eight pixels');
  assert.equal(f.collide(f.hero,to.x,to.y),false,'a committed step never lands inside scenery');
  from=to;
 }
}

test('a fast mounted hero cannot jump the real northern paddock fence in a slow frame',()=>{
 const f=setup(),from={x:f.hero.x,y:f.hero.y};
 assert.equal(f.speedOf(f.hero),955.5);
 assert.equal(f.collide(f.hero,from.x,from.y),false);
 assert.equal(f.collide(f.hero,15525,16680),true,'the old single step crossed solid fence');
 assert.equal(f.collide(f.hero,15525,16703.775),false,'the old endpoint was already beyond the fence');
 f.moveToward(f.hero,15525,16706,.05);
 assert.ok(f.hero.y<16680,'the rider stays outside the paddock');
 assert.ok(f.moves.length>1);safeSteps(f,from);
});

test('a diagonal mount step with speed boosts and Swiftness cannot skip the same fence',()=>{
 const f=setup({swift:1.2}),from={x:f.hero.x,y:f.hero.y};
 assert.equal(f.collide(f.hero,15540,16706),false,'the desired endpoint alone does not reveal the crossed fence');
 f.moveToward(f.hero,15540,16706,.05);
 assert.ok(f.hero.y<16680);assert.ok(f.moves.length>1);safeSteps(f,from);
});

test('mounted avoidance keeps gliding along a real fence without crossing it or sticking',()=>{
 const f=setup(),from={x:f.hero.x,y:f.hero.y};
 for(let n=0;n<8;n++){
  f.moveToward(f.hero,f.hero.x+50,f.hero.y+20,.05);
  assert.ok(f.hero.y<16680,'gliding remains on the approach side of the rail');
 }
 assert.ok(f.hero.x>from.x+100,'the rider makes progress along the obstacle');
 safeSteps(f,from);
});

test('open ground preserves mounted speed, analogue pace and target clamping',()=>{
 for(const pace of [1,.35]){
  const f=setup({empty:true}),from={x:f.hero.x,y:f.hero.y},dt=.05;
  f.moveToward(f.hero,f.hero.x+1000,f.hero.y,dt,pace);
  assert.ok(Math.abs(f.hero.x-from.x-f.speedOf(f.hero)*dt*pace)<1e-8);
  assert.ok(Math.abs(f.hero.walk-dt*11)<1e-9);safeSteps(f,from);
 }
 const near=setup({empty:true}),tx=near.hero.x+3;
 near.moveToward(near.hero,tx,near.hero.y,.05);
 assert.equal(near.hero.x,tx,'short destinations are never overshot');
 assert.equal(near.moveToward(near.hero,tx,near.hero.y,.05),true);
});

test('mounted movement in City, Farm and Home cannot skip thin walls or building footprints',()=>{
 for(const zone of [{city:true},{farm:true},{tavern:true}])for(const shape of ['wall','building']){
  const f=setup({x:500,y:500,empty:true,zone}),from={x:500,y:500};
  if(shape==='wall')f.world.mwalls=[{x:430,y:520,w:140,h:4}];
  else f.world.solids=[{type:'farmitem',x:500,y:532,crx:95,cry:3,cyo:0}];
  assert.equal(f.collide(f.hero,from.x,from.y),false);
  assert.equal(f.collide(f.hero,500,532),true);
  assert.equal(f.collide(f.hero,500,562),false,'a large untested step could skip the whole obstruction');
  assert.equal(f.speedOf(f.hero),955.5);
  f.moveToward(f.hero,500,600,.065);
  assert.ok(f.hero.y<520,'the rider stays on the approach side');
  assert.ok(f.moves.length>1);safeSteps(f,from);
 }
});

test('unmounted heroes, pets and enemies retain their original single-step movement path',()=>{
 const f=setup({id:null,empty:true}),x=f.hero.x;
 f.moveToward(f.hero,x+1000,f.hero.y,.05);
 assert.equal(f.moves.length,1);assert.ok(Math.abs(f.hero.x-x-22.75)<1e-9);
 for(const kind of ['pet','enemy']){
  const mover=tracked(1000,1000,{speed:950}),env=setup({empty:true});
  // The extracted functions need the actual pet identity to exercise its existing speed branch.
  const context={world:env.world,hero:env.hero,mountRide:env.mountRide,Mounts,S:env.S,TideUI:{visibleCompanion:()=>null},
   pet:kind==='pet'?mover.entity:null,zoneOf:env.zoneOf,swiftMul:env.swiftMul,speedBoostMul:env.speedBoostMul};
  vm.createContext(context);vm.runInContext(physics,context);
  const speed=context.speedOf(mover.entity);
  context.moveToward(mover.entity,2000,1000,.05);
  assert.equal(mover.moves.length,1,kind+' does not enter the mounted substep path');
  assert.ok(Math.abs(mover.entity.x-1000-speed*.05)<1e-9);
 }
});

test('a Tide keeping pace with a mounted player also checks every step against thin farm fences',()=>{
 const env=setup({empty:true,zone:{farm:true}}),mover=tracked(500,500);
 env.world.mwalls=[{x:430,y:520,w:140,h:4}];
 const context={world:env.world,hero:env.hero,pet:mover.entity,mountRide:env.mountRide,Mounts,S:env.S,
  TideUI:{visibleCompanion:()=>({id:'tide-1'})},zoneOf:env.zoneOf,swiftMul:env.swiftMul,speedBoostMul:env.speedBoostMul};
 vm.createContext(context);vm.runInContext(physics,context);
 context.moveToward(mover.entity,500,650,.065);assert.ok(mover.moves.length>1);assert.ok(mover.entity.y<520);
 let from={x:500,y:500};for(const to of mover.moves){assert.ok(Math.hypot(to.x-from.x,to.y-from.y)<=8+1e-9);assert.equal(context.collide(mover.entity,to.x,to.y),false);from=to;}
});
