/* Per-character stable ownership and a disposable, distance-driven riding state. */
const Mounts=(()=>{
 const catalog=Object.freeze([
  Object.freeze({id:'horse',name:'Chestnut Courser',kind:'Horse',price:25000,speed:1.65,art:'assets/mounts/horse.png',artVersion:2,run:'assets/mounts/horse-run.png',need:Object.freeze({prestige:4}),description:'A goofy, good-hearted companion with a tongue-out grin and a rolling stride.'}),
  Object.freeze({id:'leopard',name:'Amberfang Leopard',kind:'Leopard',price:150000,speed:1.9,art:'assets/mounts/leopard.png',run:'assets/mounts/leopard-run.png',need:Object.freeze({duke:true}),description:'A sure-footed spotted hunter with a swift, rolling stride.'}),
  Object.freeze({id:'spectral-tiger',name:'Azure Spectral Tiger',kind:'Spectral tiger',price:750000,speed:2.1,art:'assets/mounts/spectral-tiger.png',artVersion:2,run:'assets/mounts/spectral-tiger-run.png',need:Object.freeze({forsaken:true}),description:'Blue spirit-fire shimmers beneath its ancient silver armour.'}),
  /* 🐉 never sold at the stable: the Dragon Rider in Port Meridian sells its egg (the bank's whole cap), and what hatches
     from it is kept by Torsten. fly: it is always airborne, its wings beat even while it hovers. +250% riding speed (asked for 2026-09-29). */
  Object.freeze({id:'dragon',name:'Stormcrown Dragon',kind:'Dragon',price:10000000000,speed:3.5,art:'assets/mounts/dragon.png',run:'assets/mounts/dragon-fly.png',egg:true,fly:true,description:'Midnight scales, sapphire wings and a crown of gold horns. It was an egg once; now the sky is its road.'})
 ]);
 const byId=new Map(catalog.map(m=>[m.id,m]));
 const get=id=>byId.get(id)||null;
 function normalize(value){
  const listed=[...(Array.isArray(value?.owned)?value.owned:[]),...(Array.isArray(value?.foreign)?value.foreign:[])].filter(id=>typeof id==='string');
  const owned=catalog.filter(m=>listed.includes(m.id)).map(m=>m.id);
  /* a mount this build does not know (sold by a newer build) is kept as written and saved back, never dropped -
     and if it was the one ridden, it stays the one ridden (this build simply shows none) */
  const foreign=[...new Set(listed.filter(id=>!byId.has(id)))].slice(0,32);
  const out={owned,equipped:owned.includes(value?.equipped)||foreign.includes(value?.equipped)?value.equipped:owned[0]||null};
  if(foreign.length)out.foreign=foreign;
  return out;
 }
 const allowed=zone=>!!(zone&&!zone.dungeon&&(zone.wasteland||zone.city||zone.farm||zone.tavern));
 const selected=state=>{const m=state?.mounts;return m?.owned?.includes(m.equipped)?get(m.equipped):null;};
 /* Torsten sells each companion only to a hero who has earned it: Prestige 4 for the courser, a Duke's patent for
    the leopard, the Forsaken One slain for the tiger. standing = {prestige, duke, forsaken}, read from the save by
    the game; none given, nothing with a need is for sale. A mount already bought stays bought. */
 function unlocked(item,standing){
  if(item?.egg)return false;
  const need=item?.need;if(!need)return !!item;
  return !((need.prestige&&!((standing?.prestige|0)>=need.prestige))||(need.duke&&!standing?.duke)||(need.forsaken&&!standing?.forsaken));
 }
 const requirement=item=>item?.need?.forsaken?'Slay the Forsaken One':item?.need?.duke?'Duke':item?.need?.prestige?'Prestige '+item.need.prestige:'';
 function buy(state,id,spend,standing){
  const item=get(id);if(!state||!item)return {ok:false,reason:'unknown'};
  const collection=normalize(state.mounts);
  if(collection.owned.includes(id))return {ok:false,reason:'bought'};
  if(item.egg)return {ok:false,reason:'egg'};
  if(!unlocked(item,standing))return {ok:false,reason:'locked'};
  if(typeof spend!=='function'||!spend(item.price))return {ok:false,reason:'gold'};
  collection.owned.push(id);if(!collection.equipped)collection.equipped=id;
  state.mounts=collection;return {ok:true,item};
 }
 /* what an egg hatches into: owned from now on, and ridden at once only if nothing else was chosen */
 function grant(state,id){
  if(!state||!get(id))return false;
  const collection=normalize(state.mounts);
  if(!collection.owned.includes(id))collection.owned.push(id);
  if(!collection.equipped)collection.equipped=id;
  state.mounts=collection;return true;
 }
 function equip(state,id){
  if(!state||!get(id))return false;
  const collection=normalize(state.mounts);if(!collection.owned.includes(id))return false;
  collection.equipped=id;state.mounts=collection;return true;
 }
 const stride={horse:.042,leopard:.037,'spectral-tiger':.034,dragon:.006};
 const HOVER=4.5;   /* 🐉 a flyer's wings keep beating in the air: radians a second on top of the distance flown */
 const createRide=()=>({id:null,casting:null,remaining:0,castTravel:0,phase:0,time:0,moving:0,lastX:null,lastY:null});
 function reset(ride){Object.assign(ride,createRide());}
 /* a zone change keeps a seated rider in the saddle when the new zone allows riding too; a saddling still under way,
    a zone without riding, or no living hero (a character just entering the world) ends the ride. The old position
    means nothing in the new world, so the next step starts a fresh stride instead of a giant one. */
 function carry(ride,zone,hero){
  if(!hero||hero.dead||!ride.id||ride.casting||!allowed(zone)){reset(ride);return false;}
  ride.lastX=null;ride.lastY=null;return true;
 }
 function toggle(ride,state,{zone,hero,paused=false,busy=false}){
  if(!hero||hero.dead||paused||busy)return {ok:false,reason:'busy'};
  if(ride.id||ride.casting){reset(ride);return {ok:true,action:'down'};}
  if(!allowed(zone))return {ok:false,reason:'zone'};
  const item=selected(state);if(!item)return {ok:false,reason:'empty'};
  ride.casting=item.id;ride.remaining=1;ride.castTravel=0;ride.phase=0;ride.moving=0;
  ride.lastX=hero.x;ride.lastY=hero.y;
  return {ok:true,action:'casting'};
 }
 function tick(ride,state,{zone,hero,paused=false},dt){
  if(!hero||hero.dead||!allowed(zone)||!selected(state)||
   ((ride.id||ride.casting)&&selected(state).id!==(ride.id||ride.casting))){reset(ride);return;}
  if(paused||!Number.isFinite(dt)||dt<=0)return;
  const dx=ride.lastX===null?0:hero.x-ride.lastX,dy=ride.lastY===null?0:hero.y-ride.lastY,travel=Math.hypot(dx,dy);
  ride.lastX=hero.x;ride.lastY=hero.y;
  if(ride.casting){
   ride.castTravel+=travel;
   if(ride.castTravel>1){reset(ride);return;}
   ride.remaining=Math.max(0,ride.remaining-dt);
   if(ride.remaining<1e-9){ride.id=ride.casting;ride.casting=null;ride.remaining=0;}
  }
  if(ride.id){
   ride.time=(ride.time+dt)%(Math.PI*2/2.15);
   // Teleports do not create a stride or a huge phase jump.
   if(travel<160)ride.phase=(ride.phase+travel*stride[ride.id])%(Math.PI*2);
   if(get(ride.id)?.fly)ride.phase=(ride.phase+dt*HOVER)%(Math.PI*2);
   ride.moving=Math.max(0,Math.min(1,ride.moving+(travel>dt*2&&travel<160?dt*10:-dt*8)));
  }
 }
 const multiplier=(ride,state,zone)=>allowed(zone)&&ride.id===selected(state)?.id?get(ride.id).speed:1;
 return {catalog,get,normalize,allowed,selected,unlocked,requirement,buy,grant,equip,createRide,reset,carry,toggle,tick,multiplier};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Mounts;
