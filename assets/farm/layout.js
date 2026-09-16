/* Farm world geometry and the one-time translation of saved farm layouts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FarmLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WIDTH=8400,HEIGHT=5200,OFFSET_X=2100,OFFSET_Y=1300,LAYOUT_VERSION=1;
 const BUILD=Object.freeze({x0:2140,x1:6300,y0:40,y1:5160});
 const HOUSE=Object.freeze({x:3075,y:2620});
 const SPAWN=Object.freeze({x:2570,y:2600});
 const EXIT=Object.freeze({x:2220,y:2600});
 function contains(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=BUILD.x0&&x<BUILD.x1&&y>=BUILD.y0&&y<=BUILD.y1;}
 const clampAnimalX=x=>Math.max(2160,Math.min(6240,x));
 const clampAnimalY=y=>Math.max(60,Math.min(5140,y));
 function migrate(farm){
  if(!farm||typeof farm!=='object')return farm;
  const legacy=!(Number(farm.layoutVersion)>=LAYOUT_VERSION);
  /* Missing house axes get their own defaults; an existing custom axis is retained. */
  if(!Number.isFinite(farm.hx))farm.hx=legacy?HOUSE.x-OFFSET_X:HOUSE.x;
  if(!Number.isFinite(farm.hy))farm.hy=legacy?HOUSE.y-OFFSET_Y:HOUSE.y;
  if(!legacy)return farm;
  const shift=(item,key,offset)=>{if(item&&Number.isFinite(item[key]))item[key]+=offset;};
  farm.hx+=OFFSET_X;farm.hy+=OFFSET_Y;
  for(const list of [farm.b,farm.c])if(Array.isArray(list))for(const item of list){
   shift(item,'x',OFFSET_X);shift(item,'y',OFFSET_Y);
  }
  if(Array.isArray(farm.r))for(const road of farm.r){
   for(const key of ['x0','x1','x'])shift(road,key,OFFSET_X);
   for(const key of ['y0','y1','y'])shift(road,key,OFFSET_Y);
  }
  /* Persist the version with the coordinates; repeated local/cloud loads must not move them again. */
  farm.layoutVersion=LAYOUT_VERSION;
  return farm;
 }
 return Object.freeze({WIDTH,HEIGHT,OFFSET_X,OFFSET_Y,LAYOUT_VERSION,BUILD,HOUSE,SPAWN,EXIT,contains,clampAnimalX,clampAnimalY,migrate});
});
