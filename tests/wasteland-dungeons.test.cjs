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
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const normalSource=['eHP','eATK','effectiveHeroLvl','effZoneLvl','xpZoneLvl','goldZoneLvl','pMul','pRew']
 .map(name=>game.match(new RegExp('^const '+name+'=.*$','m'))[0]).join('\n')+'\n'+
 game.slice(game.indexOf('function zoneTemplates('),game.indexOf('\nfunction zoneQuests('))+'\n'+
 game.slice(game.indexOf('function spawnEnemyAt('),game.indexOf('\nfunction spawnAdd('));
function normalStats(level=60,prestige=0,zoneLevel=1){
 const zone={lvl:zoneLevel,en:[['One','beast','#abc'],['Two','beast','#abc'],['Three','beast','#abc']]};
 const context={S:{lvl:level,prestige},MAXLVL:60,enemies:[],expeditionZone:z=>!!(z.dungeon||z.wasteland),mobGold:()=>0,zoneOf:()=>zone};
 const api=vm.runInNewContext(normalSource+';({zoneTemplates,spawnEnemyAt})',context);
 const mobs=api.zoneTemplates(zone),boss=api.zoneTemplates({lvl:zoneLevel,boss:['Normal boss','#abc','boss']})[0];
 return {mobs,boss,spawn:t=>api.spawnEnemyAt(t,null,{x:100,y:100})};
}
const stats=normalStats();
function encounter(key='briarhollow',s=stats,options){return D.createEncounter(key,W.create(key,17).enemySpawns,s,options);}
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
    for(const m of en.dungeonMoves){assert.ok(m.warn>=1.35);assert.ok(m.damage>=1.2&&m.damage<=1.44);}
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

test('dungeon HP, attack and body size match actual ordinary spawns across levels, zones and prestige',()=>{
 for(const level of [1,30,60])for(const prestige of [0,1,5,20,50])for(const zoneLevel of [1,60]){
  const templates=normalStats(level,prestige,zoneLevel);
  for(const key of keys)for(const en of encounter(key,templates).enemies){
   const ordinary=templates.spawn(en.boss?templates.boss:templates.mobs[en.dungeonIndex]);
   assert.equal(en.max,ordinary.max,`${key} L${level} P${prestige} HP`);
   assert.equal(en.atk,ordinary.atk,`${key} L${level} P${prestige} attack`);
   assert.equal(en.r,ordinary.r,'same painted body scale and collision radius');
   assert.equal(en.speed,ordinary.speed);assert.equal(en.atkCd,en.boss?1.5:1.15);
  }
 }
 const weak=encounter('briarhollow',{...stats,attack:1,maxHp:1}),strong=encounter('briarhollow',{...stats,attack:1e9,maxHp:1e9});
 assert.deepEqual(Array.from(weak.enemies,e=>[e.max,e.atk]),Array.from(strong.enemies,e=>[e.max,e.atk]),'equipment no longer rescales enemies');
 assert.ok(normalStats(1,1).boss.hp>normalStats(60,0).boss.hp,'rebirth does not reset difficulty');
 const input={mobs:stats.mobs.map(m=>({...m})),boss:{...stats.boss}},snap=encounter('briarhollow',input),hp=snap.enemies[0].max;
 input.boss.hp=1;D.reset(snap);assert.equal(snap.enemies[0].max,hp,'entry snapshots remain stable');
});

test('missing or corrupt normal templates fail explicitly instead of spawning invalid or weaker foes',()=>{
 assert.throws(()=>encounter('briarhollow',{level:60,attack:200}),/ordinary mob templates/);
 for(const invalid of [0,-1,NaN,Infinity,Number.MAX_VALUE]){
  assert.throws(()=>encounter('briarhollow',{mobs:stats.mobs,boss:{hp:invalid,atk:20}}),/finite positive/);
  assert.throws(()=>encounter('briarhollow',{mobs:stats.mobs,boss:{hp:100,atk:invalid}}),/finite positive/);
 }
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

test('reset restores mobs, respects boss cooldowns and retires stale killed/projectile references',()=>{
 const timers={},run=encounter('cindervein',stats,{bossReadyAt:timers,now:()=>1000}),old=run.enemies.slice(),oldId=old[0].encounterId;
 D.defeat(old[0]);D.defeat(old[15]);old[16].dungeonCast={shape:'circle',x:0,y:0};
 D.reset(run);
 assert.equal(run.enemies.length,17);
 for(let i=0;i<17;i++){
  const fresh=run.enemies[i],waiting=fresh.boss&&!!timers[fresh.dungeonIndex];assert.notEqual(fresh,old[i]);assert.equal(fresh.dead,waiting);
  assert.equal(fresh.hp,waiting?0:fresh.max);assert.equal(fresh.x,fresh.home.x);assert.equal(fresh.y,fresh.home.y);
  assert.notEqual(fresh.encounterId,oldId);assert.equal(fresh.dungeonCast,null);
  assert.equal(D.defeat(old[i]),null,'old death cannot pay after a reset');
 }
 assert.equal(D.defeat(run.enemies.find(e=>e.boss)),null,'reset cannot pay a waiting boss twice');
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
   assert.equal(cast.damage,Math.round(en.atk*en.dungeonMoves[n].damage),'special follows normal boss attack scaling');
   assert.ok(cast.damage>0&&cast.damage<=en.atk*1.45,'special stays within its telegraphed attack multiplier');
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

test('saved boss timers retain only known finite future deadlines and cannot extend beyond two hours',()=>{
 const now=1000000,raw={briarhollow:{0:now+60000,1:now,2:now+100},cindervein:{0:Infinity,1:'2000000'},frostveil:{0:now+D.BOSS_RESPAWN_MS*3,1:NaN},other:{0:now+1000}};
 const clean=D.normalizeBossTimers(raw,now);
 assert.deepEqual(JSON.parse(JSON.stringify(clean)),{briarhollow:{0:now+60000},cindervein:{},frostveil:{0:now+D.BOSS_RESPAWN_MS}});
 assert.equal(raw.frostveil[0],now+D.BOSS_RESPAWN_MS*3,'validation does not mutate the imported save');
 for(const invalid of [null,[],{briarhollow:[now+1000]},Object.create({briarhollow:{0:now+1000}})]){
  assert.deepEqual(JSON.parse(JSON.stringify(D.normalizeBossTimers(invalid,now))),{briarhollow:{},cindervein:{},frostveil:{}});
 }
});

test('each boss starts its own two-hour deadline before reward release and duplicate kills cannot extend it',()=>{
 let now=1000000;const timers={},run=encounter('briarhollow',stats,{bossReadyAt:timers,now:()=>now}),bosses=run.enemies.filter(e=>e.boss);
 assert.equal(D.BOSS_RESPAWN_MS,7200000);
 for(const [i,en]of bosses.entries()){
  const atDeath=now;en.hp=0;
  const reward=D.defeat(en);
  assert.equal(reward.books,1);assert.equal(reward.bossIndex,i);
  assert.equal(timers[i],atDeath+7200000);assert.equal(reward.bossReadyAt,timers[i]);
  assert.equal(en.bossReadyAt,timers[i]);assert.equal(D.bossRemaining(en,now),7200000);
  now+=30000;
  assert.equal(D.defeat(en),null);assert.equal(timers[i],atDeath+7200000);
 }
 assert.equal(timers[1]-timers[0],30000,'bosses have independent kill clocks');
 const before=JSON.stringify(timers),mob=run.enemies.find(e=>!e.boss);
 assert.equal(D.defeat(mob).books,0);assert.equal(JSON.stringify(timers),before);assert.equal(D.bossRemaining(mob,now),0);
});

test('boss cooldowns survive zone hops, death resets and serialized reloads without affecting other heroes',()=>{
 let now=1000000;const character=D.normalizeBossTimers(null,now);
 const run=encounter('frostveil',stats,{bossReadyAt:character.frostveil,now:()=>now});
 D.defeat(run.enemies.find(e=>e.boss));D.reset(run);
 const loaded=JSON.parse(JSON.stringify(character));now+=3600000;
 const afterHop=encounter('frostveil',stats,{bossReadyAt:loaded.frostveil,now:()=>now});
 const bosses=afterHop.enemies.filter(e=>e.boss);
 assert.equal(bosses[0].dead,true);assert.equal(bosses[0].hp,0);assert.equal(bosses[0].dungeonDefeated,true);
 assert.equal(D.defeat(bosses[0]),null);assert.equal(D.bossRemaining(bosses[0],now),3600000);
 assert.equal(bosses[1].dead,false,'uncleared boss remains available');
 assert.equal(encounter('cindervein',stats,{bossReadyAt:loaded.cindervein,now:()=>now}).enemies.filter(e=>e.boss).every(e=>!e.dead),true);
 assert.equal(encounter('frostveil',stats,{bossReadyAt:{},now:()=>now}).enemies.filter(e=>e.boss).every(e=>!e.dead),true,'another character has independent bosses');
 now+=3600000;
 const afterRestart=encounter('frostveil',stats,{bossReadyAt:loaded.frostveil,now:()=>now});
 assert.equal(afterRestart.enemies.find(e=>e.boss).dead,false);assert.equal(loaded.frostveil[0],undefined);
});

test('a boss respawns exactly at wall-clock expiry even after pause, with one callback and a fresh reward life',()=>{
 let now=1000000;const timers={},run=encounter('cindervein',stats,{bossReadyAt:timers,now:()=>now});
 const en=run.enemies.find(e=>e.boss),firstId=en.encounterId,hero=heroNear(en),events=[];
 const hooks={onRespawn:e=>events.push(e),hurtHero:()=>assert.fail('respawn must not immediately hit the hero')};
 D.defeat(en);const deadline=en.bossReadyAt;
 en.x+=150;en.y+=100;en._ax=en.x;en._ay=en.y;en.wt=4;en.mv=1;en.fx=-1;en.fy=.5;
 en.slowT=9;en.hurt=1;en.swing=.2;now=deadline-1;
 D.updateEnemy(en,.1,hero,hooks);assert.equal(en.dead,true);assert.equal(D.bossRemaining(en,now),1);assert.equal(events.length,0);
 now=deadline;D.updateEnemy(en,0,hero,hooks); // No simulation time passes while the real clock crosses the deadline.
 assert.equal(en.dead,false);assert.equal(en.hp,en.max);assert.equal(en.x,en.home.x);assert.equal(en.y,en.home.y);
 assert.equal(en.bossReadyAt,0);assert.equal(timers[0],undefined);assert.equal(events.length,1);assert.equal(events[0],en);
 assert.notEqual(en.encounterId,firstId);assert.equal(en.dungeonCast,null);assert.equal(en.dungeonDefeated,false);
 assert.equal(en.slowT,0);assert.equal(en.hurt,0);assert.equal(en.swing,0);
 for(const key of ['_ax','_ay','wt','mv','fx','fy'])assert.equal(key in en,false,`${key} cannot leak from the previous life`);
 D.updateEnemy(en,0,hero,hooks);assert.equal(events.length,1);
 const second=D.defeat(en);assert.equal(second.books,1);assert.equal(second.bossReadyAt,now+7200000);assert.equal(D.defeat(en),null);
});
