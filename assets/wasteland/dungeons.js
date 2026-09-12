/* Wasteland dungeon combat. No inventory, save, DOM or network access.
 * createEncounter(key, world.enemySpawns, {mobs,boss}, {bossReadyAt,now}) -> {enemies,...}.
 * mobs/boss are ordinary zoneTemplates: all HP/damage scaling stays in game.js.
 * bossReadyAt is the character's mutable per-dungeon deadline record (indices 0/1).
 * now is a wall-clock function in milliseconds, default Date.now; timers survive reset.
 * updateEnemy returns true for dungeon foes: skip ALL ordinary AI/respawn then.
 * Hooks: moveToward(enemy,x,y,dt), hurtHero(damage,label,enemy,isMelee),
 *        onWarn(cast,enemy), onStrike(cast,enemy,hit) (last two are optional VFX).
 * defeat(enemy) owns its once-per-life guard, including if killEnemy set dead first.
 * Its {books:0|1} result is the ONLY dungeon reward; bypass ordinary kill rewards.
 * reset(encounter) replaces enemies and retires old references. The caller must
 * adopt encounter.enemies and clear projectiles/hazards on death or re-entry.
 * drawTelegraphs runs in the same world transform as enemy drawing. */
(function(root){
 'use strict';
 const cone=(name,range,halfAngle,warn,damage)=>({name,shape:'cone',range,halfAngle,warn,damage});
 const circle=(name,radius,warn,damage)=>({name,shape:'circle',radius,warn,damage});
 const definitions={
  briarhollow:{key:'briarhollow',name:'Briarhollow',theme:'overgrown cave',color:'#9fbd68',
   mobs:[
    {name:'Thornfang',kind:'beast',mobSprite:'bst_wolf',speed:108},
    {name:'Rootback Boar',kind:'beast',mobSprite:'bst_boar',speed:92},
    {name:'Briarspinner',kind:'beast',mobSprite:'bst_spider',speed:102}
   ],
   bosses:[
    {name:'Brackenstone',kind:'beast',skin:'cave_troll_briarhollow',color:'#bda077',speed:80,
     moves:[cone('Stonebreaker',235,.60,1.35,1.20),circle('Falling Rubble',92,1.65,1.20)]},
    {name:'Elder Thornroot',kind:'beast',skin:'cave_troll_briarhollow',color:'#9cc668',speed:76,
     moves:[cone('Briar Sweep',270,.75,1.50,1.32),circle('Grasping Roots',105,1.70,1.20)]}
   ]},
  cindervein:{key:'cindervein',name:'Cindervein',theme:'ember mine',color:'#e99657',
   mobs:[
    {name:'Ashpick Raider',kind:'humanoid',mobSprite:'hum_raider',speed:100},
    {name:'Cinderbound Cultist',kind:'humanoid',mobSprite:'hum_cultist',speed:96},
    {name:'Sootguard',kind:'humanoid',mobSprite:'hum_soldier',speed:92}
   ],
   bosses:[
    {name:'Ashbound Sentinel',kind:'humanoid',skin:'cave_troll_cindervein',color:'#f6a463',speed:82,
     moves:[cone('Cinder Cleave',250,.55,1.35,1.32),circle('Emberfall',105,1.60,1.32)]},
    {name:'Lord Cindervein',kind:'humanoid',skin:'cave_troll_cindervein',color:'#ffc06f',speed:78,
     moves:[cone('Furnace Breath',285,.55,1.60,1.44),circle('Molten Seal',118,1.80,1.38)]}
   ]},
  frostveil:{key:'frostveil',name:'Frostveil',theme:'haunted ice crypt',color:'#a6c8da',
   mobs:[
    {name:'Rimebound Husk',kind:'undead',mobSprite:'und_husk',speed:94},
    {name:'Veil Wraith',kind:'undead',mobSprite:'und_wraith',speed:106},
    {name:'Crypt Revenant',kind:'undead',mobSprite:'und_revenant',speed:98}
   ],
   bosses:[
    {name:'Veilbound Revenant',kind:'undead',skin:'cave_troll_frostveil',color:'#b4b9ed',speed:84,
     moves:[cone('Soul Rend',255,.60,1.40,1.26),circle('Grave Echo',100,1.70,1.32)]},
    {name:'Lord Rimeveil',kind:'undead',skin:'cave_troll_frostveil',color:'#bbe4f3',speed:76,
     moves:[cone('Rime Cleave',275,.68,1.50,1.38),circle('Frozen Tomb',112,1.80,1.44)]}
   ]}
 };
 function freeze(value){
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
 }
 freeze(definitions);
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const finite=(v,fallback,lo,hi)=>clamp(Number.isFinite(v)?v:fallback,lo,hi);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const validPoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const BOSS_RESPAWN_MS=2*60*60*1000,owners=new WeakMap();
 let serial=0;

 function wallTime(value){return Number.isFinite(value)&&value>=0?value:Date.now();}
 function normalizeBossTimers(raw,now=Date.now()){
  now=wallTime(now);const result={};
  for(const key of Object.keys(definitions)){
   const record=raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.prototype.hasOwnProperty.call(raw,key)?raw[key]:null;
   result[key]={};
   for(const index of [0,1]){
    const value=record&&typeof record==='object'&&!Array.isArray(record)&&Object.prototype.hasOwnProperty.call(record,index)?record[index]:0;
    if(Number.isFinite(value)&&value>now)result[key][index]=Math.min(value,now+BOSS_RESPAWN_MS);
   }
  }
  return result;
 }
 function bossRemaining(en,now=Date.now()){
  return en&&en.boss&&Number.isFinite(en.bossReadyAt)?Math.max(0,en.bossReadyAt-wallTime(now)):0;
 }
 function scaling(stats){
  if(!stats||!Array.isArray(stats.mobs)||stats.mobs.length!==3||!stats.boss)
   throw new TypeError('Dungeon combat needs three ordinary mob templates and one boss template');
  const copy=(t,boss)=>{
   if(!t||![t.hp,t.atk].every(v=>Number.isFinite(v)&&v>=1&&v<=Number.MAX_SAFE_INTEGER))
    throw new TypeError('Dungeon combat templates need finite positive hp/atk');
   return Object.freeze({hp:Math.round(t.hp),atk:Math.round(t.atk),
    speed:Number.isFinite(t.speed)&&t.speed>0?t.speed:boss?80:105,
    atkCd:Number.isFinite(t.atkCd)&&t.atkCd>0?t.atkCd:boss?1.5:1.15});
  };
  return Object.freeze({mobs:Object.freeze(stats.mobs.map(t=>copy(t,false))),boss:copy(stats.boss,true)});
 }
 function spawnEnemy(encounter,p,slot){
  const boss=p.type==='boss',index=boss?p.index:((p.index%3)+3)%3;
  const d=definitions[encounter.key],t=(boss?d.bosses:d.mobs)[index],s=encounter.scaling;
  const combat=boss?s.boss:s.mobs[index],hp=combat.hp;
  const en={name:t.name,kind:t.kind,boss,raid:false,bossId:boss?'wasteland_'+encounter.key+'_'+index:null,
   skin:t.skin||null,mobSprite:t.mobSprite||null,c:t.color||d.color,
   x:p.x,y:p.y,home:{x:p.x,y:p.y},r:boss?26:12,max:hp,hp,
   atk:combat.atk,xp:0,gold:0,
   dungeon:encounter.key,dungeonIndex:index,encounterId:encounter.id+':'+encounter.generation+':'+slot+':'+(encounter.lives[slot]||0),
   noRespawn:true,noRewards:true,bookDrop:boss?1:0,roomIdx:p.room??null,
   add:false,atkCd:combat.atkCd,meleeMul:1,reach:0,awake:false,
   speed:combat.speed,baseSpeed:combat.speed,state:'idle',dir:0,wT:0,cd:boss?1.2:.7+(slot%3)*.2,
   dead:false,deadT:0,walk:0,slowT:0,hurt:0,swing:0,cds:{a:2,b:5,c:8},lockT:0,
   hidden:false,trailT:0,avoid:null,pause:true,
   dungeonCast:null,dungeonRecovery:0,dungeonMove:0,dungeonCooldown:2.2,
   dungeonMoves:t.moves||[],bossReadyAt:0,dungeonDefeated:false,dungeonRetired:false};
  const deadline=encounter.bossReadyAt[index];
  if(boss&&Number.isFinite(deadline)&&deadline>encounter.now()){
   en.bossReadyAt=deadline;en.dead=true;en.deadT=1;en.hp=0;en.state='dead';en.dungeonDefeated=true;
  }else if(boss)delete encounter.bossReadyAt[index];
  owners.set(en,{encounter,slot});
  return en;
 }
 function createEncounter(key,spawns,stats,options={}){
  if(!definitions[key])throw new RangeError('Unknown Wasteland dungeon: '+key);
  if(!Array.isArray(spawns))throw new TypeError('Dungeon enemySpawns must be an array');
  const bossIndices=[];
  const points=spawns.map(p=>{
   if(!validPoint(p)||!Number.isInteger(p.index)||!['mob','boss'].includes(p.type))
    throw new TypeError('Invalid dungeon enemy spawn');
   if(p.type==='boss')bossIndices.push(p.index);
   return {type:p.type,index:p.index,x:p.x,y:p.y,room:p.room};
  });
  if(bossIndices.length!==2||!bossIndices.includes(0)||!bossIndices.includes(1))
   throw new RangeError('A dungeon needs exactly bosses 0 and 1');
  const mobs=points.length-2;
  if(mobs<12||mobs>18)throw new RangeError('A dungeon needs 12 to 18 regular foes');
  const clock=typeof options.now==='function'?options.now:Date.now,now=()=>wallTime(clock());
  const bossReadyAt=options.bossReadyAt&&typeof options.bossReadyAt==='object'&&!Array.isArray(options.bossReadyAt)?options.bossReadyAt:{};
  const clean=normalizeBossTimers({[key]:bossReadyAt},now())[key];
  for(const index of [0,1]){if(clean[index])bossReadyAt[index]=clean[index];else delete bossReadyAt[index];}
  const encounter={key,id:++serial,generation:0,scaling:scaling(stats),spawns:freeze(points),enemies:[],lives:{},bossReadyAt,now};
  return reset(encounter);
 }
 function reset(encounter){
  for(const en of encounter.enemies){en.dungeonRetired=true;en.dungeonCast=null;en.dead=true;}
  encounter.generation++;
  encounter.enemies=encounter.spawns.map((p,i)=>spawnEnemy(encounter,p,i));
  return encounter;
 }
 function defeat(en){
  if(!en||!en.dungeon||en.dungeonDefeated||en.dungeonRetired)return null;
  const owner=owners.get(en);if(!owner)return null;
  if(en.boss){
   // Persist the cooldown before returning permission to grant the book.
   en.bossReadyAt=owner.encounter.now()+BOSS_RESPAWN_MS;
   owner.encounter.bossReadyAt[en.dungeonIndex]=en.bossReadyAt;
  }
  en.dungeonDefeated=true;en.dead=true;en.hp=0;en.deadT=0;en.hidden=false;en.dungeonCast=null;
  en.dungeonRecovery=0;en.state='dead';
  return {dungeon:en.dungeon,bossId:en.bossId,name:en.name,books:en.boss?1:0,
   encounterId:en.encounterId,bossIndex:en.boss?en.dungeonIndex:null,bossReadyAt:en.bossReadyAt,x:en.x,y:en.y};
 }
 function pointInTelegraph(cast,point){
  if(!cast||!validPoint(cast)||!validPoint(point))return false;
  const dx=point.x-cast.x,dy=point.y-cast.y,d=Math.hypot(dx,dy);
  if(cast.shape==='circle')return d<=cast.radius;
  if(cast.shape!=='cone'||d>cast.range)return false;
  if(d<1e-9)return true;
  const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-cast.angle),Math.cos(Math.atan2(dy,dx)-cast.angle));
  return Math.abs(delta)<=cast.halfAngle;
 }
 function startCast(en,hero,hooks){
  const move=en.dungeonMoves[en.dungeonMove%en.dungeonMoves.length];
  en.dungeonMove++;
  en.dungeonCast={...move,x:move.shape==='circle'?hero.x:en.x,y:move.shape==='circle'?hero.y:en.y,
   angle:Math.atan2(hero.y-en.y,hero.x-en.x),elapsed:0,color:en.c,
   damage:Math.max(1,Math.round(en.atk*move.damage))};
  en.pause=true;en.moving=false;
  if(hooks.onWarn)hooks.onWarn(en.dungeonCast,en);
 }
 function returnHome(en,dt,hooks){
  en.state='return';en.dungeonCast=null;en.dungeonRecovery=0;en.dungeonCooldown=2.2;en.dungeonMove=0;
  en.cd=en.boss?1.2:.7;en.slowT=0;en.hurt=0;en.swing=0;en.awake=false;
  en.hp=en.max;
  if(distance(en,en.home)<3){en.x=en.home.x;en.y=en.home.y;en.state='idle';en.pause=true;return;}
  move(en,en.home,dt,hooks);
 }
 function move(en,target,dt,hooks){
  en.pause=false;
  if(hooks.moveToward)hooks.moveToward(en,target.x,target.y,dt);
 }
 function updateEnemy(en,dt,hero,hooks={}){
  if(!en||!en.dungeon)return false;
  // A long background frame may not skip a warning or deliver stacked strikes.
  dt=finite(dt,0,0,.1);
  en.moving=false;
  if(en.dungeonRetired)return true;
  if(en.dead){
   en.deadT+=dt;en.dungeonCast=null;
   const owner=owners.get(en);
   if(en.boss&&en.bossReadyAt>0&&owner&&bossRemaining(en,owner.encounter.now())===0){
    const {encounter,slot}=owner;
    delete encounter.bossReadyAt[en.dungeonIndex];encounter.lives[slot]=(encounter.lives[slot]||0)+1;
    const fresh=spawnEnemy(encounter,encounter.spawns[slot],slot);
    // Keep the live enemy reference, but not status/stride fields added during
    // its previous life (especially _ax/_ay after returning from the corpse).
    for(const key of Object.keys(en))delete en[key];
    Object.assign(en,fresh);owners.set(en,{encounter,slot});
    if(hooks.onRespawn)hooks.onRespawn(en);
   }
   return true;
  }
  if(en.hurt)en.hurt=Math.max(0,en.hurt-dt);
  if(en.swing)en.swing=Math.max(0,en.swing-dt);
  if(!validPoint(hero)||hero.dead){en.dungeonCast=null;en.pause=true;return true;}
  if(en.state==='return'||distance(en,en.home)>(en.boss?520:550)||distance(hero,en.home)>(en.boss?620:650)){
   returnHome(en,dt,hooks);return true;
  }
  const d=distance(en,hero);
  if(en.state!=='chase'&&en.hp>=en.max&&d>(en.boss?310:200)){en.state='idle';en.pause=true;return true;}
  en.state='chase';en.awake=true;
  if(en.dungeonCast){
   const cast=en.dungeonCast;
   cast.elapsed+=dt;en.pause=true;
   if(cast.elapsed+1e-9>=cast.warn){
    const hit=pointInTelegraph(cast,hero);
    en.dungeonCast=null;en.dungeonRecovery=1.15;en.dungeonCooldown=3.2;en.cd=en.atkCd;en.swing=.3;
    if(hit&&hooks.hurtHero)hooks.hurtHero(cast.damage,cast.name,en,false);
    if(hooks.onStrike)hooks.onStrike(cast,en,hit);
   }
   return true;
  }
  if(en.dungeonRecovery>0){en.dungeonRecovery=Math.max(0,en.dungeonRecovery-dt);en.pause=true;return true;}
  if(en.boss){
   en.dungeonCooldown=Math.max(0,en.dungeonCooldown-dt);
   if(en.dungeonCooldown===0&&d<=370){startCast(en,hero,hooks);return true;}
  }
  // The contact timer starts before entering reach, but produces only one hit.
  en.cd=Math.max(0,en.cd-dt);
  if(d>30+en.r){move(en,hero,dt,hooks);return true;}
  en.pause=true;
  if(en.cd===0){
   en.cd=en.atkCd;en.swing=.2;
   if(hooks.hurtHero)hooks.hurtHero(en.atk,en.name,en,true);
  }
  return true;
 }
 function trace(ctx,cast){
  ctx.beginPath();
  if(cast.shape==='circle')ctx.arc(cast.x,cast.y,cast.radius,0,Math.PI*2);
  else{
   ctx.moveTo(cast.x,cast.y);
   ctx.arc(cast.x,cast.y,cast.range,cast.angle-cast.halfAngle,cast.angle+cast.halfAngle);
   ctx.closePath();
  }
 }
 function drawTelegraphs(ctx,enemies){
  for(const en of enemies){
   const cast=en.dungeonCast;
   if(!cast||en.dead||en.dungeonRetired)continue;
   const progress=clamp(cast.elapsed/cast.warn,0,1);
   ctx.save();trace(ctx,cast);
   ctx.fillStyle=cast.color;ctx.globalAlpha=.17+.12*progress;ctx.fill();
   ctx.restore();
  }
 }
 root.WastelandDungeons=Object.freeze({definitions,BOSS_RESPAWN_MS,normalizeBossTimers,bossRemaining,createEncounter,reset,defeat,updateEnemy,drawTelegraphs,pointInTelegraph});
})(typeof globalThis!=='undefined'?globalThis:window);
