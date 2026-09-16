'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const FarmLayout=require('../assets/farm/layout.js');
const clone=value=>JSON.parse(JSON.stringify(value));

test('farm geometry preserves width, adds equal north/south space and centers the building span',()=>{
 assert.equal(FarmLayout.WIDTH,8400);
 assert.equal(FarmLayout.HEIGHT,2600+2*FarmLayout.OFFSET_Y);
 assert.deepEqual(FarmLayout.BUILD,{x0:2140,x1:6300,y0:40,y1:5160});
 assert.equal(FarmLayout.BUILD.x0-40,FarmLayout.WIDTH/4);
 assert.equal(FarmLayout.BUILD.x1,FarmLayout.WIDTH*3/4);
 assert.equal(FarmLayout.BUILD.x1-FarmLayout.BUILD.x0,4200-40);
 assert.deepEqual(FarmLayout.HOUSE,{x:975+2100,y:1320+1300});
 assert.deepEqual(FarmLayout.SPAWN,{x:470+2100,y:1300+1300});
 assert.deepEqual(FarmLayout.EXIT,{x:120+2100,y:1300+1300});
 for(const geometry of [FarmLayout,FarmLayout.BUILD,FarmLayout.HOUSE,FarmLayout.SPAWN,FarmLayout.EXIT])assert.ok(Object.isFrozen(geometry));
});

test('build containment includes the lower edges and south edge but excludes the east edge',()=>{
 for(const [x,y] of [[2140,40],[6299.9,5160],[4200,80],[4200,5100]])assert.equal(FarmLayout.contains(x,y),true);
 for(const [x,y] of [[2139.9,2600],[6300,2600],[1000,2600],[7500,2600],[4200,39.9],[4200,5160.1],[NaN,2600],[4200,Infinity],['4200',2600]])assert.equal(FarmLayout.contains(x,y),false);
});

test('animal positions clamp inside the central farm and can reach the new northern and southern land',()=>{
 assert.equal(FarmLayout.clampAnimalX(0),2160);
 assert.equal(FarmLayout.clampAnimalX(8400),6240);
 assert.equal(FarmLayout.clampAnimalX(4700),4700);
 assert.equal(FarmLayout.clampAnimalY(-20),60);
 assert.equal(FarmLayout.clampAnimalY(5300),5140);
 assert.equal(FarmLayout.clampAnimalY(100),100);
 assert.equal(FarmLayout.clampAnimalY(5050),5050);
 for(const x of [2160,4700,6240])for(const y of [60,100,5050,5140])assert.ok(FarmLayout.contains(x,y));
});

test('legacy farm translation keeps all layouts, road vectors, station identities and economic state intact',()=>{
 const farm={owned:true,hx:1800,hy:1450,lvl:3,xp:72,baleN:9,cseedN:12,inv:{cowfarm:2},lastSim:1768000000000,simT:1768000000123,nextBreedingStationId:8,
  b:[{t:'tide_incubator',x:1080,y:1200,breedingStationId:'tide-nursery-7',sc:.7,fl:-1,_moving:true},
   {t:'cowfarm_big',x:60,y:2540,fed:1768000000500,preg:1768000000600,meals:2},
   {t:'stone_wall',x:4199,y:40,sc:1.6}],
  c:[{t:'hay',x:72,y:48,at:1768000000800,stage:1},{t:'chickenseeds',x:4104,y:2544,bites:3}],
  r:[{t:'dirt_road',x0:200,y0:90,x1:4175,y1:2300,x:2187.5,y:1195,road:true,sc:1.2},
   {t:'gravel_road',x0:75,y0:100,x1:125,y1:200}]};
 const expected=clone(farm);
 expected.hx+=2100;expected.hy+=1300;expected.layoutVersion=FarmLayout.LAYOUT_VERSION;
 for(const it of [...expected.b,...expected.c]){it.x+=2100;it.y+=1300;}
 for(const road of expected.r){for(const key of ['x0','x1','x'])if(key in road)road[key]+=2100;for(const key of ['y0','y1','y'])if(key in road)road[key]+=1300;}
 assert.equal(FarmLayout.migrate(farm),farm);
 assert.deepEqual(farm,expected);
 assert.equal(farm.b[0].x-farm.c[0].x,1080-72);
 assert.equal(farm.b[0].y-farm.c[0].y,1200-48);
 assert.equal(farm.r[0].x1-farm.r[0].x0,4175-200);
 assert.equal(farm.r[0].y1-farm.r[0].y0,2300-90);
});

test('repeated migration and local/cloud JSON round trips never translate coordinates twice',()=>{
 const farm={b:[{t:'tree_farm',x:1000,y:1000}],c:[{t:'hay',x:72,y:48}],r:[{x0:60,y0:60,x1:100,y1:100}]};
 const expected=clone(FarmLayout.migrate(farm));
 for(let i=0;i<4;i++){
  assert.equal(FarmLayout.migrate(farm),farm);
  assert.deepEqual(farm,expected);
  assert.deepEqual(FarmLayout.migrate(clone(farm)),expected);
 }
});

test('new and partial saves receive current house defaults without losing custom house axes',()=>{
 const fresh={owned:false,b:[],c:[],r:[]};
 FarmLayout.migrate(fresh);
 assert.equal(fresh.hx,FarmLayout.HOUSE.x);assert.equal(fresh.hy,FarmLayout.HOUSE.y);
 assert.deepEqual(fresh.b,[]);assert.deepEqual(fresh.c,[]);assert.deepEqual(fresh.r,[]);
 const xOnly=FarmLayout.migrate({hx:333});assert.equal(xOnly.hx,2433);assert.equal(xOnly.hy,2620);
 const yOnly=FarmLayout.migrate({hy:444});assert.equal(yOnly.hx,3075);assert.equal(yOnly.hy,1744);
 const invalid=FarmLayout.migrate({hx:NaN,hy:Infinity});assert.equal(invalid.hx,3075);assert.equal(invalid.hy,2620);
 const current=FarmLayout.migrate({layoutVersion:1,hx:5000});assert.equal(current.hx,5000);assert.equal(current.hy,2620);
 const future={layoutVersion:2,hx:5100,hy:4000,b:[{x:4200,y:3500}]};
 assert.deepEqual(FarmLayout.migrate(clone(future)),future);
});

test('sparse legacy arrays and incomplete road records preserve missing or invalid fields',()=>{
 const farm={b:[null,{t:'tree_farm',x:0,y:0},{t:'well',x:'unknown'}],c:null,r:[null,{x0:0,y0:0,x1:100},{y:1200}]};
 FarmLayout.migrate(farm);
 assert.deepEqual(farm.b,[null,{t:'tree_farm',x:2100,y:1300},{t:'well',x:'unknown'}]);
 assert.equal(farm.c,null);
 assert.deepEqual(farm.r,[null,{x0:2100,y0:1300,x1:2200},{y:2500}]);
 assert.equal(FarmLayout.migrate(null),null);
 assert.equal(FarmLayout.migrate(undefined),undefined);
});

test('browser script exposes the same frozen FarmLayout API without CommonJS',()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/farm/layout.js'),'utf8'),context);
 assert.equal(context.FarmLayout.WIDTH,FarmLayout.WIDTH);
 assert.equal(context.FarmLayout.HEIGHT,FarmLayout.HEIGHT);
 assert.ok(context.FarmLayout.contains(4200,5000));
 assert.ok(Object.isFrozen(context.FarmLayout));
 assert.deepEqual(clone(context.FarmLayout.migrate({b:[],c:[]})),clone(FarmLayout.migrate({b:[],c:[]})));
});
