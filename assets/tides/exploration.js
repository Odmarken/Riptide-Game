/* Neutral Wasteland encounters. All clocks, geometry and optional randomness are
 * supplied by the game; the bounded, JSON-safe survey belongs to one character. */
(function(root){
 'use strict';
 const WIDTH=50400,HEIGHT=26000,MAX_WILD=8,MAX_STEP=500,DESPAWN_DISTANCE=1500;
 const MIN_ROLL_DISTANCE=220,MAX_ROLL_DISTANCE=360,SPAWN_CHANCE=.50;
 const MIN_RADIUS=280,MAX_RADIUS=750,SEPARATION=120,MIN_TTL=300000,MAX_TTL=600000;
 const ROAM_RADIUS=60,ROAM_SPEED=16;
 const GROUPS=Object.freeze([
  Object.freeze(['meadowmouse','bramblebunny','pebbletoad','thistlesparrow','amberbeetle']),
  Object.freeze(['mossfox','reedotter','duskmoth','shellsnap','acornboar']),
  Object.freeze(['embercub','moonowl','crystalgecko','stormlynx','thornbadger']),
  Object.freeze(['cinderwolf','frostibex','sunmane','runestag','coraldrake']),
  Object.freeze(['dawnphoenix','obsidianbear','aurorakirin','spectralpanther','spectralwyrm'])
 ]);
 const IDS=new Set(GROUPS.flat());
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const number=(n,fallback)=>Number.isFinite(n)?n:fallback;
 const integer=(n,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>clamp(Math.floor(number(n,fallback)),min,max);
 const position=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 function animalSeed(id){
  let hash=2166136261;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return hash>>>0;
 }
 // A separate stream lets animals wander while the player stands still without
 // changing encounter rolls, species, levels or the saved exploration counter.
 function roamRandom(p){
  p.roamSeed=(Math.imul(p.roamSeed,1664525)+1013904223)>>>0;
  return p.roamSeed/4294967296;
 }
 function restoreRoaming(p,raw=p){
  const homeX=number(raw.homeX,p.x),homeY=number(raw.homeY,p.y);
  const homeValid=homeX>=24&&homeX<=WIDTH-24&&homeY>=24&&homeY<=HEIGHT-24&&Math.hypot(homeX-p.x,homeY-p.y)<=ROAM_RADIUS+1;
  p.homeX=homeValid?homeX:p.x;p.homeY=homeValid?homeY:p.y;
  p.roamSeed=integer(raw.roamSeed,animalSeed(p.id),0,4294967295);
  p.roamTime=clamp(number(raw.roamTime,2+(p.roamSeed%5000)/1000),0,8);
  const targetValid=Number.isFinite(raw.roamTargetX)&&Number.isFinite(raw.roamTargetY)&&Math.hypot(raw.roamTargetX-p.homeX,raw.roamTargetY-p.homeY)<=ROAM_RADIUS;
  p.roamTargetX=targetValid?raw.roamTargetX:null;p.roamTargetY=targetValid?raw.roamTargetY:null;
  p.motion=clamp(number(raw.motion,0),0,1);
  return p;
 }
 function create(saved,options={}){
  const raw=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  const seed=integer(raw.seed,integer(options.seed,Math.floor(Math.random()*4294967296)),0,4294967295);
  const seen=new Set(),wild=[];
  for(const item of Array.isArray(raw.wild)?raw.wild:[]){
   if(wild.length>=MAX_WILD)break;
   if(!item||typeof item.id!=='string'||seen.has(item.id)||!IDS.has(item.speciesId)||!position(item)||item.x<24||item.y<24||item.x>WIDTH-24||item.y>HEIGHT-24)continue;
   if(wild.some(p=>Math.hypot(p.x-item.x,p.y-item.y)<SEPARATION))continue;
   seen.add(item.id);
   const spawnedAt=Math.max(0,number(item.spawnedAt,0));
   wild.push(restoreRoaming({id:item.id,speciesId:item.speciesId,level:integer(item.level,1,1,20),x:item.x,y:item.y,fx:item.fx<0?-1:1,
    spawnedAt,expiresAt:clamp(number(item.expiresAt,spawnedAt+MIN_TTL),spawnedAt,spawnedAt+MAX_TTL),walkphase:number(item.walkphase,0)},item));
  }
  const usedId=wild.reduce((highest,p)=>Math.max(highest,integer(Number(p.id.split('-').at(-1)),0)),0);
  const nextDistance=raw.version===2?clamp(number(raw.nextDistance,300),MIN_ROLL_DISTANCE,MAX_ROLL_DISTANCE):300;
  return {version:2,seed,randomState:integer(raw.randomState,seed,0,4294967295),counter:integer(raw.counter,0),
   nextId:Math.max(integer(raw.nextId,1,1),usedId+1),rolls:integer(raw.rolls,0),
   initialized:raw.initialized===true||wild.length>0,starterSeen:raw.starterSeen===true||wild.length>0,
   distance:raw.version===2?clamp(number(raw.distance,0),0,nextDistance):0,nextDistance,
   lastX:Number.isFinite(raw.lastX)?raw.lastX:null,lastY:Number.isFinite(raw.lastY)?raw.lastY:null,
   lastWorldKey:typeof raw.lastWorldKey==='string'?raw.lastWorldKey:null,lastNow:Math.max(0,number(raw.lastNow,0)),wild,
   recent:(Array.isArray(raw.recent)?raw.recent:[]).filter(p=>position(p)&&Number.isFinite(p.until)).slice(-32).map(p=>({x:p.x,y:p.y,until:p.until}))};
 }
 function random(state,override){
  state.randomState=(state.randomState+0x6d2b79f5)>>>0;state.counter++;
  let t=state.randomState;t=Math.imul(t^(t>>>15),1|t);t^=t+Math.imul(t^(t>>>7),61|t);
  const generated=((t^(t>>>14))>>>0)/4294967296;
  return typeof override==='function'?clamp(number(override(),generated),0,1-Number.EPSILON):generated;
 }
 // Location changes relative animal abundance within a star tier; every animal
 // remains possible everywhere. The two spectral species total 0.04% per spawn.
 function chooseSpecies(state,x,y,override,starter){
  const r=starter?0:random(state,override);
  const tier=r<.60?0:r<.86?1:r<.97?2:r<.9965?3:4;
  if(tier===4){
   if(r>=.9996)return GROUPS[4][random(state,override)<.5?3:4];
   return GROUPS[4][Math.floor(random(state,override)*3)];
  }
  const habitat=((Math.floor(x/4200)+2*Math.floor(y/3800))%5+5)%5;
  const weights=GROUPS[tier].map((_,i)=>i===habitat?1.8:i===(habitat+1)%5?1.2:.8);
  let pick=random(state,override)*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return GROUPS[tier][i];}
  return GROUPS[tier][4];
 }
 function chooseLevel(state,petLevel,override,starter){
  if(starter)return 1;
  const level=integer(petLevel,1,1,20),r=random(state,override),v=random(state,override);
  if(r<.30)return 1+Math.floor(v*Math.max(3,level-3));
  if(r<.85)return clamp(level-3+Math.floor(v*7),1,20);
  return clamp(level+3+Math.floor(v*6),1,20);
 }
 function clearPosition(state,context,x,y,ignore){
  const world=context.world,edge=24,w=number(context.width,number(world&&world.w,WIDTH)),h=number(context.height,number(world&&world.h,HEIGHT));
  if(x<edge||y<edge||x>w-edge||y>h-edge)return false;
  if(state.wild.some(p=>p!==ignore&&Math.hypot(p.x-x,p.y-y)<SEPARATION)||state.recent.some(p=>Math.hypot(p.x-x,p.y-y)<SEPARATION))return false;
  if(world){
   const landmarks=[...(world.entrances||[]),world.exit,world.portal].filter(position);
   if(landmarks.some(p=>Math.hypot(p.x-x,p.y-y)<Math.max(120,number(p.r,0)+55)))return false;
   if(world.stable&&world.stable.clearZones&&world.stable.clearZones.some(p=>x>p.x-24&&x<p.x+p.w+24&&y>p.y-24&&y<p.y+p.h+24))return false;
  }
  return typeof context.isValidPosition!=='function'||!!context.isValidPosition(x,y,22);
 }
 function spawn(state,context,now){
  if(state.wild.length>=MAX_WILD)return null;
  const override=context.random;
  for(let attempt=0;attempt<14;attempt++){
   const angle=random(state,override)*Math.PI*2;
   const radius=MIN_RADIUS+random(state,override)*(MAX_RADIUS-MIN_RADIUS);
   const x=Math.round(context.x+Math.cos(angle)*radius),y=Math.round(context.y+Math.sin(angle)*radius);
   if(!clearPosition(state,context,x,y))continue;
   const starter=!state.starterSeen;
   const entry={id:'tide-'+state.seed.toString(36)+'-'+state.nextId++,speciesId:chooseSpecies(state,x,y,override,starter),
    level:chooseLevel(state,context.petLevel,override,starter),x,y,fx:random(state,override)<.5?-1:1,
    spawnedAt:now,expiresAt:now+MIN_TTL+Math.floor(random(state,override)*(MAX_TTL-MIN_TTL)),walkphase:random(state,override)*Math.PI*2};
   restoreRoaming(entry);state.starterSeen=true;state.wild.push(entry);return entry;
  }
  return null;
 }
 function roam(state,context){
  const dt=clamp(number(context.dt,0),0,.25);if(!dt)return;
  for(const p of state.wild){
   if(!Number.isFinite(p.roamSeed))restoreRoaming(p);
   let moving=false;
   if(p.roamTargetX===null){
    p.roamTime-=dt;
    if(p.roamTime<=0){
     p.roamTime=0;
     for(let attempt=0;attempt<6;attempt++){
      const angle=roamRandom(p)*Math.PI*2,radius=20+roamRandom(p)*(ROAM_RADIUS-20);
      const x=p.homeX+Math.cos(angle)*radius,y=p.homeY+Math.sin(angle)*radius;
      if(Math.hypot(x-p.x,y-p.y)<12||!clearPosition(state,context,x,y,p))continue;
      p.roamTargetX=x;p.roamTargetY=y;break;
     }
     if(p.roamTargetX===null)p.roamTime=2+roamRandom(p)*5;
    }
   }
   if(p.roamTargetX!==null){
    const dx=p.roamTargetX-p.x,dy=p.roamTargetY-p.y,distance=Math.hypot(dx,dy),step=Math.min(distance,ROAM_SPEED*dt);
    const x=p.x+(distance?dx/distance*step:0),y=p.y+(distance?dy/distance*step:0);
    if(distance>.01&&clearPosition(state,context,x,y,p)){
     p.x=x;p.y=y;moving=true;if(Math.abs(dx)>.5)p.fx=dx<0?-1:1;
     p.walkphase=(p.walkphase+step/18*Math.PI*2)%(Math.PI*2);
    }
    if(!moving||distance<=step+.01){
     p.roamTargetX=null;p.roamTargetY=null;p.roamTime=2+roamRandom(p)*5;
    }
   }
   p.motion+=(Number(moving)-p.motion)*(1-Math.exp(-dt*12));
   if(p.motion<.001)p.motion=0;
  }
 }
 function advance(state,context={}){
  if(!state||!Array.isArray(state.wild))return [];
  const worldKey=context.worldKey||(context.world&&context.world.key)||null;
  const valid=Number.isFinite(context.x)&&Number.isFinite(context.y);
  const active=worldKey==='wasteland'&&!(context.world&&context.world.dungeon)&&context.hasLasso===true&&valid;
  if(!active){state.lastWorldKey=worldKey;state.lastX=null;state.lastY=null;return [];}
  if(context.paused||context.dead){state.lastWorldKey=worldKey;state.lastX=context.x;state.lastY=context.y;return state.wild;}
  const now=Math.max(state.lastNow,number(context.now,Date.now()));
  state.lastNow=now;
  state.wild=state.wild.filter(p=>p.expiresAt>now&&Math.hypot(p.x-context.x,p.y-context.y)<=DESPAWN_DISTANCE);
  state.recent=state.recent.filter(p=>p.until>now);
  const travel=state.lastWorldKey===worldKey&&Number.isFinite(state.lastX)&&Number.isFinite(state.lastY)?Math.hypot(context.x-state.lastX,context.y-state.lastY):0;
  state.lastWorldKey=worldKey;state.lastX=context.x;state.lastY=context.y;
  if(!state.initialized){
   state.initialized=true;
   spawn(state,context,now);
   return state.wild;
  }
  roam(state,context);
  // Teleports and zone changes establish a fresh anchor without banking travel.
  if(context.teleported||travel>MAX_STEP||travel<=0)return state.wild;
  state.distance+=travel;
  while(state.distance>=state.nextDistance){
   state.distance-=state.nextDistance;state.rolls++;
   if(random(state,context.random)<SPAWN_CHANCE)spawn(state,context,now);
   state.nextDistance=MIN_ROLL_DISTANCE+random(state,context.random)*(MAX_ROLL_DISTANCE-MIN_ROLL_DISTANCE);
  }
  return state.wild;
 }
 function take(state,id,now){
  if(!state||!Array.isArray(state.wild))return null;
  const index=state.wild.findIndex(p=>p.id===id);if(index<0)return null;
  const entry=state.wild.splice(index,1)[0],time=Math.max(number(now,state.lastNow),state.lastNow);
  state.recent.push({x:entry.x,y:entry.y,until:time+120000});
  if(state.recent.length>32)state.recent.splice(0,state.recent.length-32);
  return entry;
 }
 const api={create,advance,take,GROUPS,MAX_WILD,MAX_STEP,DESPAWN_DISTANCE,MIN_ROLL_DISTANCE,MAX_ROLL_DISTANCE,SPAWN_CHANCE,MIN_RADIUS,MAX_RADIUS,SEPARATION,MIN_TTL,MAX_TTL,ROAM_RADIUS,ROAM_SPEED};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.TideExploration=api;
})(typeof globalThis!=='undefined'?globalThis:this);
