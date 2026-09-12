/* Wasteland dungeon combat. No inventory, save, DOM or network access.
 * createEncounter(key, world.enemySpawns, {level,maxHp,attack}) -> {enemies,...}.
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
    {name:'Brackenstone',kind:'beast',skin:'ossric',color:'#bda077',speed:80,
     moves:[cone('Stonebreaker',235,.60,1.35,.20),circle('Falling Rubble',92,1.65,.20)]},
    {name:'Elder Thornroot',kind:'beast',skin:'gorehusk',color:'#9cc668',speed:76,
     moves:[cone('Briar Sweep',270,.75,1.50,.22),circle('Grasping Roots',105,1.70,.20)]}
   ]},
  cindervein:{key:'cindervein',name:'Cindervein',theme:'ember mine',color:'#e99657',
   mobs:[
    {name:'Ashpick Raider',kind:'humanoid',mobSprite:'hum_raider',speed:100},
    {name:'Cinderbound Cultist',kind:'humanoid',mobSprite:'hum_cultist',speed:96},
    {name:'Sootguard',kind:'humanoid',mobSprite:'hum_soldier',speed:92}
   ],
   bosses:[
    {name:'Ashbound Sentinel',kind:'humanoid',skin:'ashmaw',color:'#f6a463',speed:82,
     moves:[cone('Cinder Cleave',250,.55,1.35,.22),circle('Emberfall',105,1.60,.22)]},
    {name:'Lord Cindervein',kind:'humanoid',skin:'firelord',color:'#ffc06f',speed:78,
     moves:[cone('Furnace Breath',285,.55,1.60,.24),circle('Molten Seal',118,1.80,.23)]}
   ]},
  frostveil:{key:'frostveil',name:'Frostveil',theme:'haunted ice crypt',color:'#a6c8da',
   mobs:[
    {name:'Rimebound Husk',kind:'undead',mobSprite:'und_husk',speed:94},
    {name:'Veil Wraith',kind:'undead',mobSprite:'und_wraith',speed:106},
    {name:'Crypt Revenant',kind:'undead',mobSprite:'und_revenant',speed:98}
   ],
   bosses:[
    {name:'Veilbound Revenant',kind:'undead',skin:'betrayer',color:'#b4b9ed',speed:84,
     moves:[cone('Soul Rend',255,.60,1.40,.21),circle('Grave Echo',100,1.70,.22)]},
    {name:'Lord Rimeveil',kind:'undead',skin:'frostking',color:'#bbe4f3',speed:76,
     moves:[cone('Rime Cleave',275,.68,1.50,.23),circle('Frozen Tomb',112,1.80,.24)]}
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
 let serial=0;

 function scaling(stats={}){
  const level=finite(stats.level,1,1,10000),baseAttack=12+level*2.6;
  const maxHp=finite(stats.maxHp,115+level*14,1,1e9);
  const attack=finite(stats.attack,baseAttack,1,1e9);
  // Gear still pays: HP grows with the square root of attack, capped at 3x.
  // Health gear above twice the level baseline does not inflate incoming hits.
  return Object.freeze({level,maxHp,attack,power:baseAttack*clamp(Math.sqrt(attack/baseAttack),.7,3),
   damageHealth:Math.min(maxHp,2*(115+level*14))});
 }
 function spawnEnemy(encounter,p,slot){
  const boss=p.type==='boss',index=boss?p.index:((p.index%3)+3)%3;
  const d=definitions[encounter.key],t=(boss?d.bosses:d.mobs)[index],s=encounter.scaling;
  const hp=Math.max(1,Math.round(s.power*(boss?26+index*6:3.2+index*.35)));
  const en={name:t.name,kind:t.kind,boss,raid:false,bossId:boss?'wasteland_'+encounter.key+'_'+index:null,
   skin:t.skin||null,mobSprite:t.mobSprite||null,c:t.color||d.color,
   x:p.x,y:p.y,home:{x:p.x,y:p.y},r:boss?27:12,max:hp,hp,
   atk:Math.max(1,Math.round(s.damageHealth*(boss?.06:.032))),xp:0,gold:0,
   dungeon:encounter.key,dungeonIndex:index,encounterId:encounter.id+':'+encounter.generation,
   noRespawn:true,noRewards:true,bookDrop:boss?1:0,roomIdx:p.room??null,
   add:false,atkCd:boss?1.8:1.65,meleeMul:1,reach:0,awake:false,
   speed:t.speed,baseSpeed:t.speed,state:'idle',dir:0,wT:0,cd:boss?1.2:.7+(slot%3)*.2,
   dead:false,deadT:0,walk:0,slowT:0,hurt:0,swing:0,cds:{a:2,b:5,c:8},lockT:0,
   hidden:false,trailT:0,avoid:null,pause:true,
   dungeonCast:null,dungeonRecovery:0,dungeonMove:0,dungeonCooldown:2.2,
   dungeonMoves:t.moves||[],dungeonDamageHealth:s.damageHealth,
   dungeonDefeated:false,dungeonRetired:false};
  return en;
 }
 function createEncounter(key,spawns,stats){
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
  const encounter={key,id:++serial,generation:0,scaling:scaling(stats),spawns:freeze(points),enemies:[]};
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
  en.dungeonDefeated=true;en.dead=true;en.hp=0;en.deadT=0;en.hidden=false;en.dungeonCast=null;
  en.dungeonRecovery=0;en.state='dead';
  return {dungeon:en.dungeon,bossId:en.bossId,name:en.name,books:en.boss?1:0,
   encounterId:en.encounterId,x:en.x,y:en.y};
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
   damage:Math.max(1,Math.round(en.dungeonDamageHealth*move.damage))};
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
  if(en.dead){en.deadT+=dt;en.dungeonCast=null;return true;}
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
   ctx.globalAlpha=.9;ctx.strokeStyle='#ffddad';ctx.lineWidth=2.5;ctx.stroke();
   const labelX=cast.shape==='circle'?cast.x:cast.x+Math.cos(cast.angle)*cast.range*.82;
   const labelY=cast.shape==='circle'?cast.y-cast.radius-10:cast.y+Math.sin(cast.angle)*cast.range*.82-10;
   ctx.globalAlpha=1;ctx.font='bold 12px Georgia,serif';ctx.textAlign='center';
   ctx.lineWidth=3;ctx.strokeStyle='rgba(14,10,8,.9)';ctx.strokeText(cast.name,labelX,labelY);
   ctx.fillStyle='#fff0cf';ctx.fillText(cast.name,labelX,labelY);
   ctx.restore();
  }
 }
 root.WastelandDungeons=Object.freeze({definitions,createEncounter,reset,defeat,updateEnemy,drawTelegraphs,pointInTelegraph});
})(typeof globalThis!=='undefined'?globalThis:window);
