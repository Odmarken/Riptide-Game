/* Production dungeon layouts and combat, entirely offline: no game startup/save. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const W=require('../assets/wasteland/world.js');
const root=path.resolve(__dirname,'..');
const D=vm.runInNewContext(fs.readFileSync(path.join(root,'assets/wasteland/dungeons.js'),'utf8')+';WastelandDungeons',{});
const keys=['briarhollow','cindervein','frostveil'];
const stats={level:60,maxHp:1500,attack:280};
function encounter(key='briarhollow',s=stats){return D.createEncounter(key,W.create(key,17).enemySpawns,s);}
function heroNear(en,x=160,y=0){return {x:en.home.x+x,y:en.home.y+y,dead:false};}
function tickUntil(en,hero,predicate,hooks={},limit=400){
 for(let i=0;i<limit&&!predicate();i++)D.updateEnemy(en,.05,hero,hooks);
 assert.ok(predicate(),'combat reached expected state within '+limit+' ticks');
}
function resolve(en,hero,hooks={}){tickUntil(en,hero,()=>!en.dungeonCast,hooks);}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('all actual dungeon layouts create 15 themed foes and six distinct existing boss models',()=>{
 const bosses=[];
 for(const key of keys){
  const world=W.create(key),run=D.createEncounter(key,world.enemySpawns,stats);
  assert.equal(run.enemies.filter(e=>!e.boss).length,15);
  assert.equal(run.enemies.filter(e=>e.boss).length,2);
  for(const en of run.enemies){
   assert.ok(W.isWalkable(world,en.x,en.y,en.r),`${key}: ${en.name} fits spawn`);
   assert.ok(en.hp===en.max&&en.hp>0&&Number.isFinite(en.atk));
   assert.equal(en.xp,0);assert.equal(en.gold,0);assert.equal(en.raid,false);
   if(en.boss){
    bosses.push(en);assert.equal(en.dungeonMoves.length,2);
    assert.deepEqual(Array.from(en.dungeonMoves,m=>m.shape).sort(),['circle','cone']);
    for(const m of en.dungeonMoves){assert.ok(m.warn>=1.35);assert.ok(m.damage<=.24);}
   }else assert.ok(fs.existsSync(path.join(root,'assets/mobs',en.mobSprite+'.png')),en.mobSprite);
  }
 }
 assert.equal(new Set(bosses.map(e=>e.skin)).size,6);
 assert.equal(new Set(bosses.map(e=>e.bossId)).size,6);
 const skinBodies={ossric:'boss_levling3',gorehusk:'boss_levling4',ashmaw:'boss_levling1',firelord:'firelord_boss',betrayer:'fellord_boss',frostking:'frostlord_boss'};
 for(const en of bosses)assert.ok(fs.existsSync(path.join(root,'assets/boss',skinBodies[en.skin]+'.png')),en.skin);
});

test('invalid layouts cannot silently omit or duplicate a book boss',()=>{
 const spawns=W.create('briarhollow').enemySpawns;
 assert.throws(()=>D.createEncounter('missing',spawns,stats),/Unknown/);
 assert.throws(()=>D.createEncounter('briarhollow',spawns.filter(p=>p.type!=='boss'||p.index===0),stats),/exactly bosses/);
 assert.throws(()=>D.createEncounter('briarhollow',spawns.map(p=>p.type==='boss'?{...p,index:0}:p),stats),/exactly bosses/);
 assert.throws(()=>D.createEncounter('briarhollow',spawns.map((p,i)=>i? p:{...p,x:NaN}),stats),/Invalid/);
});

test('scaling is finite for malformed/extreme stats and preserves the benefit of better gear',()=>{
 for(const level of [1,60,180,10000,NaN,Infinity,-4])for(const gear of [1,280,1e9,NaN,Infinity]){
  const run=encounter('frostveil',{level,attack:gear,maxHp:gear});
  for(const en of run.enemies){
   assert.ok(Number.isFinite(en.max)&&en.max>=1);
   assert.ok(Number.isFinite(en.atk)&&en.atk>=1);
   assert.ok(Number.isFinite(en.dungeonDamageHealth));
  }
 }
 const weak=encounter('briarhollow',{level:60,attack:168,maxHp:1000});
 const strong=encounter('briarhollow',{level:60,attack:672,maxHp:10000});
 assert.ok(strong.enemies[15].max/672<weak.enemies[15].max/168,'better weapon reduces hits needed');
 assert.ok(strong.enemies[15].atk/10000<weak.enemies[15].atk/1000,'health gear reduces relative damage');
 const input={...stats},snap=encounter('briarhollow',input),hp=snap.enemies[15].max;
 input.attack=1e9;input.maxHp=1;D.reset(snap);
 assert.equal(snap.enemies[15].max,hp,'encounter stats do not follow mutable equipment input');
});

test('all regular deaths are unrewarded and never respawn; each boss grants exactly one book',()=>{
 for(const key of keys){
  const run=encounter(key);let books=0;
  for(const en of run.enemies){
   en.hp=0;en.dead=true; // The game sets dead before its dungeon-only reward branch.
   const result=D.defeat(en);books+=result.books;
   assert.equal(result.books,en.boss?1:0);
   assert.equal(D.defeat(en),null);
   en.dead=false;assert.equal(D.defeat(en),null,'clearing visible dead flag cannot duplicate rewards');en.dead=true;
   for(let i=0;i<700;i++)D.updateEnemy(en,.1,heroNear(en));
   assert.equal(en.dead,true,'corpse stays dead beyond ordinary 12s respawn');assert.equal(en.hp,0);
  }
  assert.equal(books,2);
 }
});

test('reset/reentry restore all encounters and retire stale killed/projectile references',()=>{
 const run=encounter('cindervein'),old=run.enemies.slice(),oldId=old[0].encounterId;
 D.defeat(old[0]);D.defeat(old[15]);old[16].dungeonCast={shape:'circle',x:0,y:0};
 D.reset(run);
 assert.equal(run.enemies.length,17);
 for(let i=0;i<17;i++){
  const fresh=run.enemies[i];assert.notEqual(fresh,old[i]);assert.equal(fresh.dead,false);
  assert.equal(fresh.hp,fresh.max);assert.equal(fresh.x,fresh.home.x);assert.equal(fresh.y,fresh.home.y);
  assert.notEqual(fresh.encounterId,oldId);assert.equal(fresh.dungeonCast,null);
  assert.equal(D.defeat(old[i]),null,'old death cannot pay after a reset');
 }
 assert.equal(D.defeat(run.enemies.find(e=>e.boss)).books,1,'fresh life may pay normally');
 assert.notEqual(encounter('cindervein').enemies[0].encounterId,run.enemies[0].encounterId);
});

test('bosses wait for a local pull and both locked warnings are dodgeable without tracking the hero',()=>{
 for(const key of keys)for(const en of encounter(key).enemies.filter(e=>e.boss)){
  const far=heroNear(en,600),warnings=[],hits=[],moves=[];
  const hooks={hurtHero:(...v)=>hits.push(v),onWarn:c=>warnings.push(c.name),moveToward:(...v)=>moves.push(v)};
  for(let i=0;i<200;i++)D.updateEnemy(en,.05,far,hooks);
  assert.equal(en.dungeonCast,null);assert.equal(en.state,'idle');assert.equal(hits.length,0);assert.equal(moves.length,0);
  const hero=heroNear(en);
  for(let n=0;n<2;n++){
   hero.x=en.home.x+160;hero.y=en.home.y;
   tickUntil(en,hero,()=>!!en.dungeonCast,hooks);
   const cast=en.dungeonCast,snapshot={x:cast.x,y:cast.y,angle:cast.angle},before=moves.length;
   if(cast.shape==='cone')hero.x=en.home.x-160;
   else hero.x=cast.x+cast.radius+20;
   assert.equal(D.pointInTelegraph(cast,hero),false);
   D.updateEnemy(en,.05,hero,hooks);
   assert.deepEqual({x:cast.x,y:cast.y,angle:cast.angle},snapshot,'target and bearing stay locked');
   assert.equal(moves.length,before,'boss stays still while warning');
   resolve(en,hero,hooks);assert.equal(hits.length,0,'leaving the marked area dodges the strike');
  }
  assert.equal(warnings.length,2);assert.notEqual(warnings[0],warnings[1]);
 }
});

test('standing in either warning causes one bounded strike with a melee-free recovery window',()=>{
 for(const key of keys)for(const en of encounter(key).enemies.filter(e=>e.boss)){
  const hero=heroNear(en),hits=[],strikes=[];
  const hooks={hurtHero:(...args)=>hits.push(args),onStrike:(cast,boss,hit)=>strikes.push(hit)};
  for(let n=0;n<2;n++){
   tickUntil(en,hero,()=>!!en.dungeonCast,hooks);
   const cast=en.dungeonCast;
   assert.equal(D.pointInTelegraph(cast,hero),true);
   assert.equal(hits.length,n,'no damage before warning expires');
   resolve(en,hero,hooks);
   assert.equal(hits.length,n+1);assert.equal(hits[n][0],cast.damage);assert.equal(hits[n][3],false);
   assert.ok(cast.damage>0&&cast.damage<=stats.maxHp*.25,'single special cannot one-shot a full-health hero');
   for(let i=0;i<10;i++)D.updateEnemy(en,.1,hero,hooks);
   assert.equal(hits.length,n+1,'recovery cannot stack an immediate melee hit');
  }
  assert.deepEqual(strikes,[true,true]);
 }
});

test('leashing, death and retired encounters immediately cancel pending warning damage',()=>{
 for(const scenario of ['leash','death','reset']){
  const run=encounter(),en=run.enemies.find(e=>e.boss),hero=heroNear(en),hits=[];
  tickUntil(en,hero,()=>!!en.dungeonCast,{hurtHero:(...v)=>hits.push(v)});
  en.hp=en.max/2;
  if(scenario==='leash')hero.x=en.home.x+800;
  if(scenario==='death')hero.dead=true;
  if(scenario==='reset')D.reset(run);
  for(let i=0;i<100;i++)D.updateEnemy(en,.1,hero,{hurtHero:(...v)=>hits.push(v)});
  assert.equal(en.dungeonCast,null);assert.equal(hits.length,0);
  if(scenario==='leash'){assert.equal(en.hp,en.max);assert.equal(en.state,'idle');}
 }
 assert.equal(D.updateEnemy({name:'ordinary'},.1,{x:0,y:0}),false);
});

test('telegraph hit tests match circle and sector drawing through every facing and the angle wrap',()=>{
 const calls=[];
 const ctx=new Proxy({}, {get:(o,k)=>o[k]||(o[k]=(...args)=>calls.push([k,...args]))});
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI+.01,-Math.PI/2,2.9]){
  const c={shape:'cone',x:200,y:300,range:250,halfAngle:.6,angle,warn:1.5,elapsed:.6,color:'#abc',name:'Test'};
  const p=(a,r)=>({x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r});
  assert.equal(D.pointInTelegraph(c,p(angle,249)),true);
  assert.equal(D.pointInTelegraph(c,p(angle+.61,240)),false);
  assert.equal(D.pointInTelegraph(c,p(angle-.61,240)),false);
  assert.equal(D.pointInTelegraph(c,p(angle,251)),false);
  assert.equal(D.pointInTelegraph(c,{x:c.x,y:c.y}),true);
  calls.length=0;D.drawTelegraphs(ctx,[{dungeonCast:c}]);
  const arc=calls.find(a=>a[0]==='arc');assert.deepEqual(arc.slice(1),[c.x,c.y,c.range,angle-c.halfAngle,angle+c.halfAngle]);
 }
 const circle={shape:'circle',x:200,y:300,radius:100,warn:1.5,elapsed:.6,color:'#abc',name:'Test'};
 assert.equal(D.pointInTelegraph(circle,{x:200,y:399}),true);
 assert.equal(D.pointInTelegraph(circle,{x:200,y:401}),false);
 calls.length=0;D.drawTelegraphs(ctx,[{dungeonCast:circle}]);
 assert.deepEqual(calls.find(a=>a[0]==='arc').slice(1),[200,300,100,0,Math.PI*2]);
 for(const args of calls)for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));
 assert.equal(D.pointInTelegraph(circle,{x:NaN,y:300}),false);
 calls.length=0;D.drawTelegraphs(ctx,[{dead:true,dungeonCast:circle}]);assert.equal(calls.length,0);
});

test('long or invalid frame deltas cannot skip a full warning and deal immediate damage',()=>{
 const en=encounter().enemies.find(e=>e.boss),hero=heroNear(en),hits=[];
 tickUntil(en,hero,()=>!!en.dungeonCast);
 for(const dt of [1000,Infinity,NaN,-1])D.updateEnemy(en,dt,hero,{hurtHero:(...v)=>hits.push(v)});
 assert.ok(en.dungeonCast);assert.ok(en.dungeonCast.elapsed<=.1);assert.equal(hits.length,0);
});
