/* Farm world geometry and the one-time translation of saved farm layouts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FarmLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* The building span runs along the west edge, by the way home, with open meadow to the east - as the farm was
    first laid out. Layout 1 (2026-09-16) added the land north and south but also slid the span 2100 east into the
    middle, which left a strip west of the portal that could not be built on. Layout 2 puts it back on the west. */
 const WIDTH=8400,HEIGHT=5200,OFFSET_X=0,OFFSET_Y=1300,CENTRED_X=2100,LAYOUT_VERSION=2;
 const BUILD=Object.freeze({x0:40,x1:4200,y0:40,y1:5160});
 const HOUSE=Object.freeze({x:975,y:2620});
 const SPAWN=Object.freeze({x:470,y:2600});
 const EXIT=Object.freeze({x:120,y:2600});
 function contains(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=BUILD.x0&&x<BUILD.x1&&y>=BUILD.y0&&y<=BUILD.y1;}
 const clampAnimalX=x=>Math.max(60,Math.min(4140,x));
 const clampAnimalY=y=>Math.max(60,Math.min(5140,y));
 /* How far a point saved under a layout version moves to reach this one: a save from before any version gains the
    northern land, a layout-1 save comes back west from the middle, and the current or a newer one stays put. */
 function shiftFrom(version){
  const v=Number(version);
  if(v>=LAYOUT_VERSION)return {dx:0,dy:0};
  return v>=1?{dx:-CENTRED_X,dy:0}:{dx:OFFSET_X,dy:OFFSET_Y};
 }
 function migrate(farm){
  if(!farm||typeof farm!=='object')return farm;
  const {dx,dy}=shiftFrom(farm.layoutVersion);
  /* Missing house axes get their own defaults; an existing custom axis is retained. */
  if(!Number.isFinite(farm.hx))farm.hx=HOUSE.x-dx;
  if(!Number.isFinite(farm.hy))farm.hy=HOUSE.y-dy;
  if(Number(farm.layoutVersion)>=LAYOUT_VERSION)return farm;
  const shift=(item,key,offset)=>{if(item&&Number.isFinite(item[key]))item[key]+=offset;};
  farm.hx+=dx;farm.hy+=dy;
  for(const list of [farm.b,farm.c])if(Array.isArray(list))for(const item of list){
   shift(item,'x',dx);shift(item,'y',dy);
  }
  if(Array.isArray(farm.r))for(const road of farm.r){
   for(const key of ['x0','x1','x'])shift(road,key,dx);
   for(const key of ['y0','y1','y'])shift(road,key,dy);
  }
  /* Persist the version with the coordinates; repeated local/cloud loads must not move them again. */
  farm.layoutVersion=LAYOUT_VERSION;
  return farm;
 }
 return Object.freeze({WIDTH,HEIGHT,OFFSET_X,OFFSET_Y,LAYOUT_VERSION,BUILD,HOUSE,SPAWN,EXIT,contains,clampAnimalX,clampAnimalY,shiftFrom,migrate});
});
