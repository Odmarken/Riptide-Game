/* Per-character stable ownership and a disposable, distance-driven riding state. */
const Mounts=(()=>{
 const catalog=Object.freeze([
  Object.freeze({id:'horse',name:'Chestnut Courser',kind:'Horse',price:25000,speed:1.65,art:'assets/mounts/horse.png',description:'A steady companion for the long roads of Wasteland.'}),
  Object.freeze({id:'leopard',name:'Amberfang Leopard',kind:'Leopard',price:150000,speed:1.9,art:'assets/mounts/leopard.png',description:'A sure-footed spotted hunter with a swift, rolling stride.'}),
  Object.freeze({id:'spectral-tiger',name:'Azure Spectral Tiger',kind:'Spectral tiger',price:750000,speed:2.1,art:'assets/mounts/spectral-tiger.png',description:'Blue spirit-fire shimmers beneath its ancient silver armour.'})
 ]);
 const byId=new Map(catalog.map(m=>[m.id,m]));
 const get=id=>byId.get(id)||null;
 function normalize(value){
  const owned=catalog.filter(m=>Array.isArray(value?.owned)&&value.owned.includes(m.id)).map(m=>m.id);
  return {owned,equipped:owned.includes(value?.equipped)?value.equipped:owned[0]||null};
 }
 const allowed=zone=>!!(zone?.wasteland&&!zone.dungeon);
 const selected=state=>{const m=state?.mounts;return m?.owned?.includes(m.equipped)?get(m.equipped):null;};
 function buy(state,id,spend){
  const item=get(id);if(!state||!item)return {ok:false,reason:'unknown'};
  const collection=normalize(state.mounts);
  if(collection.owned.includes(id))return {ok:false,reason:'bought'};
  if(typeof spend!=='function'||!spend(item.price))return {ok:false,reason:'gold'};
  collection.owned.push(id);if(!collection.equipped)collection.equipped=id;
  state.mounts=collection;return {ok:true,item};
 }
 function equip(state,id){
  if(!state||!get(id))return false;
  const collection=normalize(state.mounts);if(!collection.owned.includes(id))return false;
  collection.equipped=id;state.mounts=collection;return true;
 }
 const createRide=()=>({id:null,casting:null,remaining:0,castTravel:0,phase:0,moving:0,lastX:null,lastY:null});
 function reset(ride){Object.assign(ride,createRide());}
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
   // Teleports do not create a stride or a huge phase jump.
   if(travel<160)ride.phase=(ride.phase+travel*.07)%(Math.PI*2);
   ride.moving=Math.max(0,Math.min(1,ride.moving+(travel>dt*2&&travel<160?dt*10:-dt*8)));
  }
 }
 const multiplier=(ride,state,zone)=>allowed(zone)&&ride.id===selected(state)?.id?get(ride.id).speed:1;
 return {catalog,get,normalize,allowed,selected,buy,equip,createRide,reset,toggle,tick,multiplier};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Mounts;
