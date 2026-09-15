/* Neutral Tides belong to random world cells, not the player's movement. Only
 * nearby cells are materialized; a character saves captures and roaming state. */
(function(root){
 'use strict';
 const {MAX_LEVEL,SPECTRAL_MIN_LEVEL}=typeof module==='object'&&module.exports?require('./core.js'):root.Tides;
 const WIDTH=50400,HEIGHT=26000,CELL_SIZE=512,COLS=Math.ceil(WIDTH/CELL_SIZE),ROWS=Math.ceil(HEIGHT/CELL_SIZE);
 const MAX_WILD=64,MAX_CELLS=100,LOAD_MARGIN=256,MAX_LOAD_RADIUS=2600,SPAWN_CHANCE=.90,REFRESH_MS=600000;
 const SEPARATION=120,ROAM_RADIUS=60,ROAM_SPEED=16;
 const WORLD_KEYS=Object.freeze(['wasteland','wasteland-snow','wasteland-desert']);
 const REGIONS=Object.freeze([
  Object.freeze({key:'wasteland',x:0,y:HEIGHT,w:WIDTH,h:HEIGHT}),
  Object.freeze({key:'wasteland-snow',x:0,y:0,w:WIDTH,h:HEIGHT}),
  Object.freeze({key:'wasteland-desert',x:WIDTH,y:HEIGHT,w:WIDTH,h:HEIGHT})
 ]);
 // The save keeps its original local cells; this disposable view projects them
 // into the one connected map without rewriting seeds or captured-cell records.
 const projectedViews=new WeakMap();
 const visible=state=>projectedViews.get(state)||state?.wild||[];
 const GROUPS=Object.freeze([
  Object.freeze(['meadowmouse','bramblebunny','pebbletoad','thistlesparrow','amberbeetle']),
  Object.freeze(['mossfox','reedotter','duskmoth','shellsnap','acornboar']),
  Object.freeze(['embercub','moonowl','crystalgecko','stormlynx','thornbadger']),
  Object.freeze(['cinderwolf','frostibex','sunmane','runestag','coraldrake']),
  Object.freeze(['dawnphoenix','obsidianbear','aurorakirin','spectralpanther','spectralwyrm'])
 ]);
 const IDS=new Set(GROUPS.flat()),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),number=(n,f)=>Number.isFinite(n)?n:f;
 const integer=(n,f,min=0,max=Number.MAX_SAFE_INTEGER)=>clamp(Math.floor(number(n,f)),min,max);
 const spectralFloor=Math.min(SPECTRAL_MIN_LEVEL,MAX_LEVEL),wildLevel=(id,level)=>integer(level,1,id.startsWith('spectral')?spectralFloor:1,MAX_LEVEL);
 const position=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 function hash(a,b,c,d=0){let n=(Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791)^d)>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
 function rng(seed){return ()=>{seed=(seed+0x6d2b79f5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),1|t);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
 const cellValid=p=>p&&Number.isInteger(p.cellX)&&p.cellX>=0&&p.cellX<COLS&&Number.isInteger(p.cellY)&&p.cellY>=0&&p.cellY<ROWS&&Number.isSafeInteger(p.epoch)&&p.epoch>=0;
 const offset=(seed,x,y)=>hash(x,y,seed,0x45db)%REFRESH_MS;
 const cellId=(seed,x,y,epoch)=>'tide-'+seed.toString(36)+'-'+x.toString(36)+'-'+y.toString(36)+'-'+epoch.toString(36);
 const expiry=(seed,p)=>(p.epoch+1)*REFRESH_MS+offset(seed,p.cellX,p.cellY);
 function animalSeed(id){let n=2166136261;for(let i=0;i<id.length;i++)n=Math.imul(n^id.charCodeAt(i),16777619);return n>>>0;}
 function roamRandom(p){p.roamSeed=(Math.imul(p.roamSeed,1664525)+1013904223)>>>0;return p.roamSeed/4294967296;}
 function restoreRoaming(p,raw=p){
  const hx=number(raw.homeX,p.x),hy=number(raw.homeY,p.y),valid=hx>=24&&hx<=WIDTH-24&&hy>=24&&hy<=HEIGHT-24&&Math.hypot(hx-p.x,hy-p.y)<=ROAM_RADIUS+1;
  p.homeX=valid?hx:p.x;p.homeY=valid?hy:p.y;p.roamSeed=integer(raw.roamSeed,animalSeed(p.id),0,4294967295);
  p.roamTime=clamp(number(raw.roamTime,2+(p.roamSeed%5000)/1000),0,8);
  const targetValid=Number.isFinite(raw.roamTargetX)&&Number.isFinite(raw.roamTargetY)&&Math.hypot(raw.roamTargetX-p.homeX,raw.roamTargetY-p.homeY)<=ROAM_RADIUS;
  p.roamTargetX=targetValid?raw.roamTargetX:null;p.roamTargetY=targetValid?raw.roamTargetY:null;p.motion=clamp(number(raw.motion,0),0,1);return p;
 }
 function create(saved,options={}){
  const raw=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{},current=raw.version===3;
  const worldKey=WORLD_KEYS.includes(options.worldKey)?options.worldKey:WORLD_KEYS.includes(raw.worldKey)?raw.worldKey:null;
  const seed=integer(raw.seed,integer(options.seed,Math.floor(Math.random()*4294967296)),0,4294967295),wild=[],seen=new Set();
  for(const p of current&&Array.isArray(raw.wild)?raw.wild:[]){
   if(wild.length>=MAX_WILD)break;
   if(!cellValid(p)||!IDS.has(p.speciesId)||!position(p)||p.x<24||p.y<24||p.x>WIDTH-24||p.y>HEIGHT-24)continue;
   const id=cellId(seed,p.cellX,p.cellY,p.epoch);if(seen.has(id)||p.id!==id)continue;seen.add(id);
   wild.push(restoreRoaming({id,cellX:p.cellX,cellY:p.cellY,epoch:p.epoch,speciesId:p.speciesId,level:wildLevel(p.speciesId,p.level),x:p.x,y:p.y,fx:p.fx<0?-1:1,
    spawnedAt:expiry(seed,p)-REFRESH_MS,expiresAt:expiry(seed,p),walkphase:number(p.walkphase,0)},p));
  }
  const taken=[],takenCells=new Set();
  for(const p of current&&Array.isArray(raw.taken)?raw.taken:[]){
   if(taken.length>=COLS*ROWS)break;if(!cellValid(p))continue;const key=p.cellX+','+p.cellY;
   if(takenCells.has(key))continue;takenCells.add(key);taken.push({cellX:p.cellX,cellY:p.cellY,epoch:p.epoch,until:expiry(seed,p)});
  }
  const levels=[];
  for(const p of current&&Array.isArray(raw.levels)?raw.levels:[]){if(!p||!Number.isSafeInteger(p.epoch)||p.epoch<0||levels.some(l=>l.epoch===p.epoch))continue;levels.push({epoch:p.epoch,level:integer(p.level,1,1,MAX_LEVEL)});if(levels.length>=3)break;}
  const state={version:3,seed,counter:integer(raw.counter,0),lastNow:Math.max(0,number(raw.lastNow,0)),wild,taken,levels};
  if(worldKey&&worldKey!=='wasteland')state.worldKey=worldKey;
  // Keep the original version-3 Wasteland state intact. Only two bounded child
  // states are added, so visiting a border cannot erase a captured encounter or
  // reroll its cell. Older saves need no coordinate or seed migration.
  if(!worldKey&&raw.worlds&&typeof raw.worlds==='object'&&!Array.isArray(raw.worlds)){
   for(const key of WORLD_KEYS.slice(1))if(raw.worlds[key]&&typeof raw.worlds[key]==='object'&&!Array.isArray(raw.worlds[key])){
    const childSeed=biomeSeed(seed,key),savedChild={...raw.worlds[key],seed:childSeed};
    (state.worlds||(state.worlds={}))[key]=create(savedChild,{seed:childSeed,worldKey:key});
   }
  }
  return state;
 }
 const biomeSeed=(seed,key)=>hash(seed,animalSeed(key),0x70657473);
 function forWorld(state,key='wasteland'){
  if(!state||!WORLD_KEYS.includes(key)||key==='wasteland'||state.worldKey===key)return state;
  const worlds=state.worlds||(state.worlds={});
  if(!worlds[key])worlds[key]=create(null,{seed:biomeSeed(state.seed,key),worldKey:key});
  return worlds[key];
 }
 // Every species can occupy every world cell. The two spectral species together
 // are 0.04% of generated encounters; no rarity follows the player.
 function chooseSpecies(random){
  const r=random(),tier=r<.60?0:r<.86?1:r<.97?2:r<.9965?3:4;
  if(tier===4){if(r>=.9996)return GROUPS[4][random()<.5?3:4];return GROUPS[4][Math.floor(random()*3)];}
  return GROUPS[tier][Math.floor(random()*GROUPS[tier].length)];
 }
 function chooseLevel(random,petLevel,speciesId){const level=integer(petLevel,1,1,MAX_LEVEL),r=random(),v=random();if(speciesId.startsWith('spectral'))return spectralFloor+Math.floor(v*(MAX_LEVEL-spectralFloor+1));if(r<.30)return 1+Math.floor(v*Math.max(3,level-3));if(r<.85)return clamp(level-3+Math.floor(v*7),1,MAX_LEVEL);return clamp(level+3+Math.floor(v*6),1,MAX_LEVEL);}
 function clearPosition(state,context,x,y,ignore,spacing=true){
  const world=context.world,edge=24,w=number(context.width,number(world&&world.w,WIDTH)),h=number(context.height,number(world&&world.h,HEIGHT));
  if(x<edge||y<edge||x>w-edge||y>h-edge)return false;
  if(spacing&&state.wild.some(p=>p!==ignore&&Math.hypot(p.x-x,p.y-y)<SEPARATION))return false;
  if(world){
   const landmarks=[...(world.entrances||[]),world.exit,world.portal].filter(position);
   if(landmarks.some(p=>Math.hypot(p.x-x,p.y-y)<Math.max(120,number(p.r,0)+55)))return false;
   for(const site of [world.stable,world.training])if(site&&Array.isArray(site.clearZones)&&site.clearZones.some(p=>x>p.x-24&&x<p.x+p.w+24&&y>p.y-24&&y<p.y+p.h+24))return false;
  }
  return typeof context.isValidPosition!=='function'||!!context.isValidPosition(x,y,22);
 }
 function cellsNear(context){
  const view=context.view,valid=position(view)&&Number.isFinite(view.w)&&view.w>0&&Number.isFinite(view.h)&&view.h>0;
  const x0=Math.max(0,context.x-MAX_LOAD_RADIUS,(valid?view.x:context.x-900)-LOAD_MARGIN),y0=Math.max(0,context.y-MAX_LOAD_RADIUS,(valid?view.y:context.y-700)-LOAD_MARGIN);
  const x1=Math.min(WIDTH,context.x+MAX_LOAD_RADIUS,(valid?view.x+view.w:context.x+900)+LOAD_MARGIN),y1=Math.min(HEIGHT,context.y+MAX_LOAD_RADIUS,(valid?view.y+view.h:context.y+700)+LOAD_MARGIN),cells=[];
  if(x1<x0||y1<y0)return cells;
  for(let y=Math.floor(y0/CELL_SIZE);y<=Math.min(ROWS-1,Math.floor(y1/CELL_SIZE));y++)for(let x=Math.floor(x0/CELL_SIZE);x<=Math.min(COLS-1,Math.floor(x1/CELL_SIZE));x++)cells.push({x,y,d:Math.hypot((x+.5)*CELL_SIZE-context.x,(y+.5)*CELL_SIZE-context.y)});
  cells.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);return cells.slice(0,MAX_CELLS);
 }
 function materialize(state,context,cell,now,level){
  const epoch=Math.floor((now-offset(state.seed,cell.x,cell.y))/REFRESH_MS);if(epoch<0)return null;
  const random=rng(hash(cell.x,cell.y,state.seed,epoch));if(random()>=SPAWN_CHANCE)return null;
  const priority=hash(cell.x,cell.y,state.seed,0x75ab3d1);
  // A candidate wins against the eight neighboring cells using only world data.
  // Roughly one cell in nine is a habitat; 90% of habitats contain a Tide. The
  // priority never changes when a neighboring encounter refreshes, so an animal
  // stays available until its own expiry and does not follow the camera/player.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy)continue;const x=cell.x+dx,y=cell.y+dy;if(x<0||y<0||x>=COLS||y>=ROWS)continue;
   const competitor=hash(x,y,state.seed,0x75ab3d1);if(competitor<priority||competitor===priority&&(dy<0||!dy&&dx<0))return null;
  }
  const id=cellId(state.seed,cell.x,cell.y,epoch);
  if(state.taken.some(p=>p.cellX===cell.x&&p.cellY===cell.y&&p.epoch===epoch))return null;
  const s=chooseSpecies(random),petLevel=chooseLevel(random,level,s),existing=state.wild.find(p=>p.id===id);
  if(existing){existing.level=wildLevel(existing.speciesId,existing.level);return existing;}
  // Placement retries cannot reroll a cell's species or level.
  const placement=rng(hash(cell.x,cell.y,state.seed,epoch^0x794d)),x0=cell.x*CELL_SIZE,y0=cell.y*CELL_SIZE;
  for(let attempt=0;attempt<12;attempt++){
   const x=Math.round(x0+64+placement()*(Math.min(CELL_SIZE,WIDTH-x0)-128)),y=Math.round(y0+64+placement()*(Math.min(CELL_SIZE,HEIGHT-y0)-128));
   if(!clearPosition(state,context,x,y,null,false))continue;
   const p={id,cellX:cell.x,cellY:cell.y,epoch,speciesId:s,level:petLevel,x,y,fx:random()<.5?-1:1,spawnedAt:epoch*REFRESH_MS+offset(state.seed,cell.x,cell.y),expiresAt:(epoch+1)*REFRESH_MS+offset(state.seed,cell.x,cell.y),walkphase:random()*Math.PI*2};
   state.counter++;return restoreRoaming(p);
  }
  return null;
 }
 function roam(state,context){
  const dt=clamp(number(context.dt,0),0,.25);if(!dt)return;
  for(const p of state.wild){
   if(!Number.isFinite(p.roamSeed))restoreRoaming(p);
   let moving=false;
   if(p.roamTargetX===null){p.roamTime-=dt;if(p.roamTime<=0){
    p.roamTime=0;
    for(let attempt=0;attempt<6;attempt++){
     const angle=roamRandom(p)*Math.PI*2,radius=20+roamRandom(p)*(ROAM_RADIUS-20),x=p.homeX+Math.cos(angle)*radius,y=p.homeY+Math.sin(angle)*radius;
     if(Math.hypot(x-p.x,y-p.y)<12||!clearPosition(state,context,x,y,p))continue;p.roamTargetX=x;p.roamTargetY=y;break;
    }
    if(p.roamTargetX===null)p.roamTime=2+roamRandom(p)*5;
   }}
   if(p.roamTargetX!==null){
    const dx=p.roamTargetX-p.x,dy=p.roamTargetY-p.y,distance=Math.hypot(dx,dy),step=Math.min(distance,ROAM_SPEED*dt),x=p.x+(distance?dx/distance*step:0),y=p.y+(distance?dy/distance*step:0);
    if(distance>.01&&clearPosition(state,context,x,y,p)){p.x=x;p.y=y;moving=true;if(Math.abs(dx)>.5)p.fx=dx<0?-1:1;p.walkphase=(p.walkphase+step/18*Math.PI*2)%(Math.PI*2);}
    if(!moving||distance<=step+.01){p.roamTargetX=null;p.roamTargetY=null;p.roamTime=2+roamRandom(p)*5;}
   }
   p.motion+=(Number(moving)-p.motion)*(1-Math.exp(-dt*12));if(p.motion<.001)p.motion=0;
  }
 }
 function projectAnimal(p,region){
  const result={...p,regionKey:region.key,x:p.x+region.x,y:p.y+region.y};
  for(const [field,shift]of [['homeX',region.x],['homeY',region.y],['roamTargetX',region.x],['roamTargetY',region.y]])if(Number.isFinite(p[field]))result[field]=p[field]+shift;
  return result;
 }
 function advanceUnified(state,context){
  if(context.paused||context.dead)return visible(state);
  const now=Math.max(state.lastNow,number(context.now,Date.now())),result=[];
  state.lastNow=now;
  for(const region of REGIONS){
   const localContext={...context,world:null,worldKey:region.key,unified:false,x:context.x-region.x,y:context.y-region.y,width:WIDTH,height:HEIGHT,now};
   if(context.view)localContext.view={...context.view,x:context.view.x-region.x,y:context.view.y-region.y};
   if(!cellsNear(localContext).length)continue;
   localContext.isValidPosition=(x,y)=>clearPosition({wild:[]},context,x+region.x,y+region.y,null,false);
   const localState=forWorld(state,region.key),animals=advanceRegion(localState,localContext);
   for(const p of animals)result.push(projectAnimal(p,region));
  }
  // The radius/cell budget already bounds each local state. At a seam combine
  // both sides, keeping the nearest finite view instead of creating a new spawn.
  result.sort((a,b)=>Math.hypot(a.x-context.x,a.y-context.y)-Math.hypot(b.x-context.x,b.y-context.y)||a.id.localeCompare(b.id));
  if(result.length>MAX_WILD)result.length=MAX_WILD;
  projectedViews.set(state,result);return result;
 }
 function advance(state,context={}){
  if(!state||!Array.isArray(state.wild))return [];
  const worldKey=context.worldKey||(context.world&&context.world.key)||null;
  if(!WORLD_KEYS.includes(worldKey)||context.world&&context.world.dungeon||context.hasLasso!==true||!position(context))return [];
  if(context.world?.unified||context.unified)return advanceUnified(state,context);
  projectedViews.delete(state);
  return advanceRegion(state,context);
 }
 function advanceRegion(state,context={}){
  const worldKey=context.worldKey||(context.world&&context.world.key)||null;
  if(state.worldKey!==worldKey&&worldKey!=='wasteland')state=forWorld(state,worldKey);
  if(context.paused||context.dead)return state.wild;
  const now=Math.max(state.lastNow,number(context.now,Date.now())),epoch=Math.floor(now/REFRESH_MS);state.lastNow=now;
  state.taken=state.taken.filter(p=>p.until>now);state.levels=state.levels.filter(p=>p.epoch>=epoch-1&&p.epoch<=epoch);
  for(const e of [Math.max(0,epoch-1),epoch])if(!state.levels.some(p=>p.epoch===e))state.levels.push({epoch:e,level:integer(context.petLevel,1,1,MAX_LEVEL)});
  const local=state.wild.filter(p=>!cellValid(p)&&p.id&&IDS.has(p.speciesId)&&position(p)&&p.expiresAt>now&&Math.hypot(p.x-context.x,p.y-context.y)<=MAX_LOAD_RADIUS).slice(0,MAX_WILD);
  for(const p of local)p.level=wildLevel(p.speciesId,p.level);
  for(const cell of cellsNear(context)){
   if(local.length>=MAX_WILD)break;
   const e=Math.floor((now-offset(state.seed,cell.x,cell.y))/REFRESH_MS),level=state.levels.find(p=>p.epoch===e)?.level||1;
   const p=materialize(state,context,cell,now,level);if(p)local.push(p);
  }
  state.wild=local;roam(state,context);return local;
 }
 function take(state,id,now){
  if(!state||!Array.isArray(state.wild))return null;
  const i=state.wild.findIndex(p=>p.id===id);if(i<0){
   // Root callers can consume a child encounter too; ids include each biome's
   // distinct seed, so a capture cannot consume an animal in another region.
   for(const key of WORLD_KEYS.slice(1))if(state.worlds&&state.worlds[key]){const p=take(state.worlds[key],id,now);if(p){if(projectedViews.has(state))projectedViews.set(state,visible(state).filter(w=>w.id!==id));return p;}}
   return null;
  }
  const p=state.wild[i],time=Math.max(number(now,state.lastNow),state.lastNow);if(p.expiresAt<=time)return null;
  state.wild.splice(i,1);
  if(projectedViews.has(state))projectedViews.set(state,visible(state).filter(w=>w.id!==id));
  if(cellValid(p)){state.taken=state.taken.filter(t=>t.until>time&&(t.cellX!==p.cellX||t.cellY!==p.cellY));state.taken.push({cellX:p.cellX,cellY:p.cellY,epoch:p.epoch,until:p.expiresAt});}return p;
 }
 const api={create,forWorld,visible,advance,take,WORLD_KEYS,REGIONS,GROUPS,WIDTH,HEIGHT,CELL_SIZE,COLS,ROWS,MAX_WILD,MAX_CELLS,LOAD_MARGIN,MAX_LOAD_RADIUS,SPAWN_CHANCE,REFRESH_MS,SEPARATION,ROAM_RADIUS,ROAM_SPEED};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TideExploration=api;
})(typeof globalThis!=='undefined'?globalThis:this);
