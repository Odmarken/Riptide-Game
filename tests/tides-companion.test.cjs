const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const follow=source.slice(source.indexOf(' if(pet&&(activePet()||TideUI.visibleCompanion())&&!hero.dead){'),source.indexOf(' mpHostRaidThreatTick(dt);'));
const draw=source.slice(source.indexOf('function drawPet(){'),source.indexOf('function drawEquippedRing('));
function harness(){
 const c={pet:{x:-26,y:12,fx:1,walk:0,moving:false},hero:{x:0,y:0,fx:1,dead:false},visible:{id:'tide-1'},legacy:null,dt:1/60,calls:[],battling:false,
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),activePet:()=>c.legacy,TideUI:{animalVisual:()=>({width:36,height:36}),visibleCompanion:()=>c.visible,isBattling:()=>c.battling,drawCompanion:(g,x,y,options)=>c.calls.push(['tide',x,y,options])},ctx:{},
  moveToward(p,x,y,dt){const d=Math.hypot(x-p.x,y-p.y),step=Math.min(d,175*dt);p.x+=(x-p.x)/d*step;p.y+=(y-p.y)/d*step;p.moving=true;},performance:{now:()=>1000}};
 vm.createContext(c);vm.runInContext('function follow(){'+follow+'}\n'+draw,c);return c;
}
test('a visible Tide follows without a legacy pet and steps clear of the hero when first selected',()=>{
 const c=harness();for(let i=0;i<90;i++)c.follow();assert.ok(c.dist(c.pet,c.hero)>=54);assert.ok(c.dist(c.pet,c.hero)<=90);
 c.hero.x=400;for(let i=0;i<90;i++)c.follow();assert.ok(c.dist(c.pet,c.hero)<90);assert.equal(c.legacy,null);
 c.drawPet();assert.equal(c.calls[0][0],'tide');
});
test('Tide battles and dead heroes hide the visual companion; clearing the eye leaves no Tide',()=>{
 const c=harness();c.battling=true;c.drawPet();assert.equal(c.calls.length,0);c.battling=false;c.hero.dead=true;c.drawPet();assert.equal(c.calls.length,0);
 c.hero.dead=false;c.visible=null;c.drawPet();assert.equal(c.calls.length,0);const pos=[c.pet.x,c.pet.y];c.follow();assert.deepEqual([c.pet.x,c.pet.y],pos);
});

test('large visible Tides leave room beside the hero and do not teleport at their normal follow distance',()=>{
 const c=harness();c.TideUI.animalVisual=()=>({width:420,height:150});
 for(let i=0;i<150;i++)c.follow();
 assert.ok(Math.abs(c.pet.x)-420*.55>=23,'body and wings stay clear of the hero');
 assert.ok(c.dist(c.pet,c.hero)>240,'large companions may stand beyond the old teleport threshold');
 const pos=[c.pet.x,c.pet.y],phase=c.pet.tidePhase;
 for(let i=0;i<60;i++)c.follow();
 assert.deepEqual([c.pet.x,c.pet.y],pos);assert.equal(c.pet.tidePhase,phase);
 c.hero.x=1000;c.follow();assert.ok(c.dist(c.pet,c.hero)<280,'relocation preserves size-aware spacing');
});
test('the normal pet keeps its original follow radius and teleport offset when no Tide is visible',()=>{
 const c=harness();c.visible=null;c.legacy={atkMul:.1};c.pet.x=-201;c.pet.y=0;c.follow();assert.equal(c.pet.x,-24);assert.equal(c.pet.y,12);
 const pos=[c.pet.x,c.pet.y];c.follow();assert.deepEqual([c.pet.x,c.pet.y],pos);assert.deepEqual(c.legacy,{atkMul:.1});
});

test('follower feet advance with actual ground travel and settle on collision or relocation',()=>{
 const c=harness();c.pet.x=-150;const start={x:c.pet.x,y:c.pet.y};c.follow();
 assert.ok(c.pet.moving);assert.ok(c.pet.tideMotion>0);assert.ok(Math.abs(c.pet.tidePhase-c.dist(c.pet,start)*.075)<1e-9);
 c.drawPet();assert.equal(c.calls.at(-1)[3].phase,c.pet.tidePhase);assert.equal(c.calls.at(-1)[3].motion,c.pet.tideMotion);
 const phase=c.pet.tidePhase;c.moveToward=p=>{p.moving=true;p.walk+=11*c.dt;};
 for(let i=0;i<90;i++)c.follow();assert.equal(c.pet.tidePhase,phase);assert.equal(c.pet.moving,false);assert.ok(c.pet.tideMotion<.0001);
 c.pet.x=-1000;c.follow();assert.equal(c.pet.tidePhase,phase,'teleport never becomes a giant stride');assert.equal(c.pet.moving,false);
});

test('visible Tides keep pace with every equipped mount while the passive pet retains its existing speed',()=>{
 const c=harness();c.Mounts=require('../assets/mounts/mounts.js');c.swiftMul=()=>1;c.speedBoostMul=()=>1;c.zoneOf=()=>({farm:true});
 vm.runInContext(source.slice(source.indexOf('function speedOf(e){'),source.indexOf('/* Smoother obstacle avoidance:')),c);
 for(const mount of c.Mounts.catalog){c.S={mounts:{owned:[mount.id],equipped:mount.id}};c.mountRide={id:mount.id};
  c.visible={id:'tide-1'};assert.ok(c.speedOf(c.pet)>c.speedOf(c.hero));assert.equal(c.speedOf(c.pet),175*1.15*mount.speed);
  c.visible=null;assert.equal(c.speedOf(c.pet),175*1.15);
 }
});

test('follower strides are more visible while idle breathing and battle gait retain their original motion',()=>{
 const motion=require('../assets/tides/motion.js');
 for(const id of ['meadowmouse','obsidianbear','hybrid-obsidianbear--spectralwyrm']){
  const ordinary=motion.pose(id,1,1,1,true),following=motion.pose(id,1,1,1,true,1.5);
  assert.ok(Math.abs(following.lift-ordinary.lift*1.5)<1e-10);assert.ok(Math.abs(following.tilt-ordinary.tilt*1.5)<1e-10);
  assert.deepEqual(motion.pose(id,1,0,1,true,1.5),motion.pose(id,1,0,1,true));
  assert.notEqual(motion.pose(id,1,0,1).scaleY,motion.pose(id,2,0,1).scaleY,'standing companions breathe');
 }
});
