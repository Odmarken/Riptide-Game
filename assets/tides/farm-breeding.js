/* Farm station identity and geometry; no economy or save side effects outside the supplied farm. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TideFarm=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BUILDING_ID='tide_incubator',PRICE=500000;
 function ensureStationIds(farm){
  if(!farm||!Array.isArray(farm.b))return;
  const used=new Set(),reserved=new Set(farm.b.filter(it=>it?.t===BUILDING_ID&&typeof it.breedingStationId==='string').map(it=>it.breedingStationId));
  let next=Number.isSafeInteger(farm.nextBreedingStationId)&&farm.nextBreedingStationId>0?farm.nextBreedingStationId:1;
  for(const it of farm.b){
   if(it?.t!==BUILDING_ID)continue;
   let id=typeof it.breedingStationId==='string'&&/^tide-nursery-\d{1,12}$/.test(it.breedingStationId)?it.breedingStationId:null;
   if(!id||used.has(id)){do{id='tide-nursery-'+next++;}while(used.has(id)||reserved.has(id));it.breedingStationId=id;}
   used.add(id);next=Math.max(next,Number(id.slice(13))+1);
  }
  farm.nextBreedingStationId=next;
 }
 function station(farm,id){return farm?.b?.find(it=>it.t===BUILDING_ID&&it.breedingStationId===id&&!it._moving)||null;}
 function frame(it,def,image){
  if(!it||it.t!==BUILDING_ID||!def)return null;
  const sc=Number.isFinite(it.sc)?Math.max(.5,Math.min(2.5,it.sc)):1,W=def.W*sc,H=W*(image?.naturalWidth?image.naturalHeight/image.naturalWidth:1),gy=(def.gy??24)*sc;
  return {x:it.x-W/2,y:it.y+gy-H,W,H,sc,flip:it.fl===-1?-1:1};
 }
 function door(it,def,image){const f=frame(it,def,image);if(!f)return null;const d=def.door||{x:.37,y:.88};return {x:it.x+(d.x-.5)*f.W*f.flip,y:f.y+d.y*f.H+22*Math.max(1,f.sc)};}
 function imagePoint(it,def,image,x,y){const f=frame(it,def,image);if(!f)return null;let u=(x-f.x)/f.W;const v=(y-f.y)/f.H;if(f.flip<0)u=1-u;return {u,v};}
 return Object.freeze({BUILDING_ID,PRICE,ensureStationIds,station,frame,door,imagePoint});
});
