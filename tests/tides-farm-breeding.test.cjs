const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const TideFarm=require('../assets/tides/farm-breeding.js');
const FarmLayout=require('../assets/farm/layout.js');
const Tides=require('../assets/tides/core.js');
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function section(from,to){const start=game.indexOf(from),end=game.indexOf(to,start);assert.ok(start>=0&&end>start,from);return game.slice(start,end);}
function handler(id,next){return section(`$('${id}').onclick=`,`$('${next}').onclick=`);}
function harness(gold=1000000){
 const elements=new Map(),calls=[],image={complete:true,naturalWidth:1024,naturalHeight:1024};
 const el=id=>{if(!elements.has(id))elements.set(id,{style:{display:'none'},textContent:'',innerHTML:'',classList:{toggle(){}}});return elements.get(id);};
 const c={TideFarm,FarmLayout,Tides,Date,Math,performance:{now:()=>1234},
  S:{gold,overflow:0,scraps:1000,farm:FarmLayout.migrate({owned:true,b:[],c:[],r:[],lvl:1}),tides:Tides.createCollection()},
  world:{w:FarmLayout.WIDTH,h:FarmLayout.HEIGHT,solids:[]},hero:{x:3100,y:2320,r:16,dead:false},zone:{farm:true},gameOn:true,buildMode:false,
  farmCart:[],moveItem:null,movePicked:null,sizeItem:null,pendingDelRect:null,holdMove:null,marker:null,roadAnchor:null,
  $:el,zoneOf:()=>c.zone,dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),farmImg:()=>image,
  pixelSolid:(im,u,v)=>u>=.15&&u<=.72&&v>=.1&&v<=.9,
  TideUI:{openBreeding:(id,options)=>calls.push({type:'open',id,options})},
  stageMsg:message=>calls.push({type:'message',message}),sfx:{warn:()=>calls.push({type:'warn'}),buy(){},forge(){},place(){}},
  save:()=>calls.push({type:'save'}),renderFarmStore(){},renderHUD(){},updateCartUI(){},expandFarmStore(){},blip(){},
  snapPos:(id,x,y)=>({x,y}),cropCellTaken:()=>false,isHay:()=>false,isBull:()=>false,isCattle:()=>false,isChicken:()=>false,
  goldCap:()=>1e12,SCRAP_CAP:1e9,totalGold:()=>c.S.gold+(c.S.overflow||0)};
 vm.createContext(c);
 vm.runInContext(section('const farmAssetUrl=','function farmImageSource('),c);
 vm.runInContext(section('const FARM_BUILD=','const FARM_PRESTIGE=')+';globalThis.catalogue=FARM_BUILD;',c);
 vm.runInContext(section('const FARM_SC_MIN=','const torWeaponImg='),c);
 vm.runInContext(section('const FARM_PRICES=','let snapMode=true;'),c);
 vm.runInContext(section('function spendGold(','/* zero loot'),c);
 vm.runInContext(section('function farmBreedingDoor(','let buildMode=false'),c);
 vm.runInContext(section('function farmListOf(','function showMovePopup('),c);
 vm.runInContext(section('function farmRefund(','const CROP_GX='),c);
 vm.runInContext(section('function farmBuildPositionOk(','function cropCellTaken('),c);
 vm.runInContext(section('function farmCartTotal(','function openFarmCheckout('),c);
 vm.runInContext(section('function placeFarmItem(','const MINE_TRAIN_COST='),c);
 vm.runInContext(handler('farmCheckYes','farmCheckNo')+handler('farmDelYes','farmDelNo')+
  handler('farmMoveGo','farmMoveInv')+handler('farmMoveFlip','farmMoveSize'),c);
 const start=game.indexOf('   if(moveItem){ /* set it down here */'),end=game.indexOf("   if(buildSel==='remove')",start);
 assert.ok(start>=0&&end>start);
 vm.runInContext('globalThis.dropMoved=function(wx,wy){'+game.slice(start,end)+'};',c);
 const normalize=section(' const fixLook=it=>{',' /* 🏷');
 vm.runInContext('globalThis.restoreFarmLook=function(s){'+normalize+'};',c);
 vm.runInContext(section('const SGRID=320;','function speedOf('),c);
 return {c,el,calls,image,def:c.catalogue.find(x=>x.id===TideFarm.BUILDING_ID)};
}
function buy(h,x=3100,y=2300){h.c.placeFarmItem(TideFarm.BUILDING_ID,x,y);h.el('farmCheckYes').onclick();return h.c.S.farm.b.at(-1);}
function breedingJob(h,it,now=1000){
 const c=h.c.S.tides;Tides.purchaseLasso(c,10000,{rng:()=>0,now});
 c.pets.push({...clone(c.pets[0]),id:'tide-2',speciesId:'bramblebunny'});c.nextId=3;
 const r=Tides.startBreeding(c,{stationId:it.breedingStationId,parentAId:c.pets[0].id,parentBId:c.pets[1].id,now,rng:()=>0});
 assert.equal(r.ok,true);return r.job;
}

test('the real Farm checkout charges500000gold per incubator, commits only paid ghosts and assigns persistent IDs',()=>{
 const h=harness(700000);h.c.S.overflow=400000;h.c.S.farm.lvl=2;
 assert.equal(TideFarm.PRICE,500000);assert.equal(h.def.id,TideFarm.BUILDING_ID);assert.equal(h.def.noScale,1);
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3100,2300);h.c.placeFarmItem(TideFarm.BUILDING_ID,3700,2300);
 assert.equal(h.c.farmCart.length,2);assert.equal(h.c.S.farm.b.length,0);assert.equal(h.c.farmCartTotal(),1000000);assert.equal(h.c.farmCartScraps(),0);
 assert.equal(TideFarm.station(h.c.S.farm,'tide-nursery-1'),null,'unpaid ghosts are not interactive stations');
 h.el('farmCheckYes').onclick();
 assert.equal(h.c.S.gold,100000);assert.equal(h.c.S.overflow,0);assert.equal(h.c.S.scraps,1000);
 assert.equal(h.c.farmCart.length,0);assert.equal(h.c.S.farm.b.length,2);
 assert.equal(new Set(h.c.S.farm.b.map(it=>it.breedingStationId)).size,2);
 assert.ok(h.calls.some(x=>x.type==='save'));
 const before=clone(h.c.S);h.el('farmCheckYes').onclick();assert.deepEqual(clone(h.c.S),before,'duplicate checkout cannot buy the committed cart twice');
});

test('Farm level controls incubator capacity, including unpaid ghosts and buildings being moved',()=>{
 for(const level of [1,2,3]){
  const farm={lvl:level,b:[{t:'tree_farm'}]};
  assert.equal(TideFarm.capacity(farm),level);
  assert.equal(TideFarm.count(farm),0);
  assert.equal(TideFarm.canPlace(farm),true);
  const cart=[];
  for(let i=0;i<level;i++){
   assert.equal(TideFarm.canPlace(farm,cart),true);
   if(i===0)farm.b.push({t:TideFarm.BUILDING_ID,_moving:true});
   else cart.push({t:TideFarm.BUILDING_ID});
  }
  cart.push({t:'tree_farm'});
  assert.equal(TideFarm.count(farm,cart),level);
  assert.equal(TideFarm.canPlace(farm,cart),false);
  assert.equal(TideFarm.cartWithinLimit(farm,cart),true);
  cart.push({t:TideFarm.BUILDING_ID});
  assert.equal(TideFarm.cartWithinLimit(farm,cart),false);
 }
});

test('the actual placement route stops at one incubator per Farm level before creating any extra ghost',()=>{
 for(const level of [1,2,3]){
  const h=harness(2000000);h.c.S.farm.lvl=level;
  for(let i=0;i<level;i++)h.c.placeFarmItem(TideFarm.BUILDING_ID,3100+i*400,2300);
  assert.equal(h.c.farmCart.length,level);
  const before=clone(h.c.S),cartBefore=clone(h.c.farmCart);
  h.c.placeFarmItem(TideFarm.BUILDING_ID,3100+level*400,2300);
  assert.deepEqual(clone(h.c.S),before);
  assert.deepEqual(clone(h.c.farmCart),cartBefore);
  assert.ok(h.calls.some(x=>x.type==='warn'));
  h.el('farmCheckYes').onclick();
  assert.equal(h.c.S.farm.b.length,level);
  assert.equal(h.c.S.gold,2000000-level*500000);
  h.c.placeFarmItem(TideFarm.BUILDING_ID,3100+level*400,2300);
  assert.equal(h.c.farmCart.length,0,'paid stations also consume the available capacity');
 }
});

test('the Farm shop locks the incubator at capacity and unlocks after a Farm level increase',()=>{
 const h=harness(),card={dataset:{fs:TideFarm.BUILDING_ID}};
 h.c.buildTab='b';h.c.buildSel=null;
 h.c.document={querySelectorAll:()=>[card]};
 h.c.countFarm=(predicate,includeCart)=>h.c.S.farm.b.filter(it=>predicate(it.t)).length+(includeCart?h.c.farmCart.filter(it=>predicate(it.t)).length:0);
 h.c.houseMax=()=>1;
 vm.runInContext(section('function renderFarmStore(','function placeFarmItem('),h.c);
 const cardClasses=()=>h.el('farmStoreList').innerHTML.match(/<div class="([^"]*)" data-fs="tide_incubator">/)[1];
 h.c.renderFarmStore();assert.doesNotMatch(cardClasses(),/\block\b/);
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3100,2300);
 h.c.renderFarmStore();assert.match(cardClasses(),/\block\b/);
 card.onclick();assert.equal(h.c.buildSel,null);assert.ok(h.calls.some(x=>x.type==='warn'));
 h.c.S.farm.lvl=2;h.c.renderFarmStore();assert.doesNotMatch(cardClasses(),/\block\b/);
 card.onclick();assert.equal(h.c.buildSel,TideFarm.BUILDING_ID);
});

test('checkout revalidates a changed Farm limit before spending gold, scraps or consuming the cart',()=>{
 const h=harness(2000000);h.c.S.farm.lvl=2;h.c.S.overflow=100000;
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3100,2300);
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3500,2300);
 assert.equal(h.c.farmCart.length,2);
 h.c.S.farm.lvl=1;
 const before=clone(h.c.S),cartBefore=clone(h.c.farmCart);
 h.el('farmCheckYes').onclick();
 assert.deepEqual(clone(h.c.S),before);
 assert.deepEqual(clone(h.c.farmCart),cartBefore);
 assert.ok(h.calls.some(x=>x.type==='warn'));
 h.c.S.farm.lvl=2;h.el('farmCheckYes').onclick();
 assert.equal(h.c.S.farm.b.length,2);assert.equal(h.c.farmCart.length,0);
 assert.equal(h.c.totalGold(),1100000);
});

test('legacy farms keep excess incubators and may still buy unrelated items',()=>{
 const h=harness();h.c.S.farm.b=[
  {t:TideFarm.BUILDING_ID,x:3100,y:2300},
  {t:TideFarm.BUILDING_ID,x:3500,y:2300},
  {t:TideFarm.BUILDING_ID,x:3900,y:2300}
 ];
 h.c.restoreFarmLook(h.c.S);h.c.rebuildFarmItems();
 assert.equal(h.c.S.farm.b.length,3);
 assert.equal(TideFarm.canPlace(h.c.S.farm),false);
 assert.equal(TideFarm.cartWithinLimit(h.c.S.farm,[]),true);
 assert.equal(TideFarm.cartWithinLimit(h.c.S.farm,[{t:'tree_farm'}]),true);
 assert.equal(TideFarm.cartWithinLimit(h.c.S.farm,[{t:TideFarm.BUILDING_ID}]),false);
 const ids=h.c.S.farm.b.map(it=>it.breedingStationId);
 h.c.placeFarmItem('tree_farm',4300,2300);assert.equal(h.c.farmCart.length,1);
 h.el('farmCheckYes').onclick();
 assert.equal(h.c.S.farm.b.length,4);
 assert.deepEqual(h.c.S.farm.b.slice(0,3).map(it=>it.breedingStationId),ids);
 assert.equal(h.c.S.farm.b.at(-1).t,'tree_farm');
 assert.ok(h.c.S.gold<1000000,'unrelated purchase uses its normal price');
});

test('removing a ghost or idle station frees its incubator slot without increasing the Farm level',()=>{
 const h=harness();
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3100,2300);
 assert.equal(TideFarm.canPlace(h.c.S.farm,h.c.farmCart),false);
 h.c.placeFarmItem('remove',3100,2300);
 assert.equal(h.c.farmCart.length,0);assert.equal(TideFarm.canPlace(h.c.S.farm,h.c.farmCart),true);
 const station=buy(h);assert.equal(TideFarm.canPlace(h.c.S.farm),false);
 h.c.placeFarmItem('remove',station.x,station.y);
 assert.equal(TideFarm.canPlace(h.c.S.farm),true);
 h.c.placeFarmItem(TideFarm.BUILDING_ID,3500,2300);h.el('farmCheckYes').onclick();
 assert.equal(h.c.S.farm.lvl,1);assert.equal(h.c.S.farm.b.length,1);
 assert.notEqual(h.c.S.farm.b[0].breedingStationId,station.breedingStationId);
});

test('incubator countdown rounds upward to the next second and never shows a negative time',()=>{
 assert.equal(TideFarm.timerLabel(null),'');
 for(const [remainingMs,label]of [[60000,'1:00'],[59001,'1:00'],[59000,'0:59'],[1001,'0:02'],[1,'0:01'],[0,'0:00'],[-1,'0:00']]){
  assert.equal(TideFarm.timerLabel({phase:'incubating',remainingMs}),label);
 }
 for(const phase of ['ready','revealed'])assert.equal(TideFarm.timerLabel({phase,ready:true,remainingMs:0}),'0:00');
});

test('insufficient gold leaves the incubator ghost and wallet intact without creating a station',()=>{
 const h=harness(499999);h.c.placeFarmItem(TideFarm.BUILDING_ID,3100,2300);const before=clone(h.c.S);
 h.el('farmCheckYes').onclick();assert.deepEqual(clone(h.c.S),before);assert.equal(h.c.farmCart.length,1);assert.equal(h.c.S.farm.b.length,0);
 assert.ok(h.calls.some(x=>x.type==='message'&&/Not enough gold/.test(x.message)));
 h.c.S.gold=500000;h.el('farmCheckYes').onclick();assert.equal(h.c.S.gold,0);assert.equal(h.c.S.farm.b.length,1);
});

test('station identity survives the actual move/flip/save repair routes while incubation stays attached',()=>{
 const h=harness(),it=buy(h),id=it.breedingStationId;breedingJob(h,it);
 const offspring=clone(h.c.S.tides.breedingJobs[0].offspring);
 h.c.movePicked={kind:'b',i:0,t:it.t};h.el('farmMoveGo').onclick();assert.equal(it._moving,true);
 assert.equal(TideFarm.station(h.c.S.farm,id),null,'carried station cannot be opened');
 h.c.dropMoved(3400,2200);assert.equal(it.x,3400);assert.equal(it.y,2200);assert.equal(it._moving,undefined);assert.equal(it.breedingStationId,id);
 h.c.movePicked={kind:'b',i:0,t:it.t};h.el('farmMoveFlip').onclick();assert.equal(it.fl,-1);assert.equal(it.breedingStationId,id);
 it._moving=true;const saved=clone(h.c.S);h.c.restoreFarmLook(saved);
 assert.equal(saved.farm.b[0]._moving,undefined);assert.equal(saved.farm.b[0].fl,-1);assert.equal(saved.farm.b[0].breedingStationId,id);
 TideFarm.ensureStationIds(saved.farm);assert.equal(saved.farm.b[0].breedingStationId,id);
 const tides=Tides.normalizeCollection(saved.tides,120000);assert.deepEqual(tides.breedingJobs[0].offspring,offspring);assert.equal(tides.breedingJobs[0].stationId,id);
});

test('legacy and duplicate station identifiers repair deterministically without taking a later valid station ID',()=>{
 const farm={b:[{t:TideFarm.BUILDING_ID},{t:TideFarm.BUILDING_ID,breedingStationId:'tide-nursery-1'},
  {t:TideFarm.BUILDING_ID,breedingStationId:'tide-nursery-1'},{t:'tree_farm',breedingStationId:'unrelated'}]};
 TideFarm.ensureStationIds(farm);
 assert.equal(farm.b[1].breedingStationId,'tide-nursery-1');assert.equal(new Set(farm.b.slice(0,3).map(x=>x.breedingStationId)).size,3);
 assert.equal(farm.b[3].breedingStationId,'unrelated');const before=clone(farm);TideFarm.ensureStationIds(farm);assert.deepEqual(farm,before);
});

test('door geometry and pixel hit-testing follow the exact image transform in both orientations, and the entrance is walkable',()=>{
 for(const fl of [1,-1])for(const sc of [.5,1,2.5]){
  const h=harness(),it=buy(h);it.fl=fl;it.sc=sc;h.c.rebuildFarmItems();
  const frame=TideFarm.frame(it,h.def,h.image),door=h.c.farmBreedingDoor(it);
  assert.equal(frame.W,h.def.W*sc);assert.equal(frame.H,frame.W);assert.equal(frame.y,it.y+h.def.gy*sc-frame.H);
  assert.equal(door.x,it.x+(h.def.door.x-.5)*frame.W*fl);
  assert.ok(door.y-(frame.y+h.def.door.y*frame.H)>=22-1e-9,'fixed-size hero retains at least22world units of doorstep clearance');
  if(sc===1)assert.equal(door.y,frame.y+h.def.door.y*frame.H+22,'normal-size doorway stays aligned with the art');
  const u=.2,v=.45,x=frame.x+(fl<0?1-u:u)*frame.W,y=frame.y+v*frame.H;
  const mapped=TideFarm.imagePoint(it,h.def,h.image,x,y);assert.ok(Math.abs(mapped.u-u)<1e-10);assert.ok(Math.abs(mapped.v-v)<1e-10);
  assert.equal(h.c.farmBreedingAt(x,y),it);
  const transparentX=frame.x+(fl<0?.95:.05)*frame.W;assert.equal(h.c.farmBreedingAt(transparentX,y),null);
  assert.equal(h.c.collide({r:16},door.x,door.y),false,`door walkable at flip${fl}/scale${sc}`);
  assert.equal(h.c.collide({r:16},it.x,it.y+h.def.col.cyo*sc),true,'building footprint remains solid');
 }
});

test('opening and retained UI callbacks validate Farm ownership, zone, range, living hero and station presence every time',()=>{
 const h=harness(),it=buy(h),id=it.breedingStationId,door=h.c.farmBreedingDoor(it);Object.assign(h.c.hero,door);
 assert.equal(h.c.farmBreedingInReach(id),true);h.c.openFarmBreeding(id);
 const open=h.calls.find(x=>x.type==='open');assert.equal(open.id,id);assert.equal(open.options.canInteract(),true);
 for(const [apply,restore]of [
  [()=>h.c.zone={city:true},()=>h.c.zone={farm:true}],
  [()=>h.c.S.farm.owned=false,()=>h.c.S.farm.owned=true],
  [()=>h.c.gameOn=false,()=>h.c.gameOn=true],
  [()=>h.c.buildMode=true,()=>h.c.buildMode=false],
  [()=>h.c.hero.dead=true,()=>h.c.hero.dead=false],
  [()=>h.c.hero.x=door.x+91,()=>h.c.hero.x=door.x],
  [()=>it._moving=true,()=>delete it._moving]
 ]){
  apply();const before=h.calls.filter(x=>x.type==='open').length;
  assert.equal(open.options.canInteract(),false);h.c.openFarmBreeding(id);assert.equal(h.calls.filter(x=>x.type==='open').length,before);restore();
 }
 h.c.S.farm.b=[];assert.equal(open.options.canInteract(),false);assert.equal(h.c.farmBreedingInReach('missing'),false);
});

test('a far click targets the actual mirrored door and the delayed open rechecks the current world',()=>{
 const h=harness(),it=buy(h);it.fl=-1;h.c.hero.x=2300;h.c.hero.y=1500;
 h.c.enterFarmBreeding(it);const door=h.c.farmBreedingDoor(it);
 assert.deepEqual(clone(h.c.hero.moveTo),door);assert.deepEqual(clone(h.c.hero.pendingDoor.s),door);assert.equal(h.c.hero.pendingDoor.rng,90);
 Object.assign(h.c.hero,door);h.c.zone={wasteland:true};h.c.hero.pendingDoor.open();assert.equal(h.calls.some(x=>x.type==='open'),false);
 h.c.zone={farm:true};h.c.hero.pendingDoor.open();assert.equal(h.calls.some(x=>x.type==='open'),true);
});

test('single delete refuses incubating, ready and revealed stations without removing or refunding anything',()=>{
 for(const phase of ['incubating','ready','revealed']){
  const h=harness(),it=buy(h);const now=Date.now(),job=breedingJob(h,it,phase==='incubating'?now:now-70000);
  if(phase==='revealed')Tides.revealBreeding(h.c.S.tides,job.stationId,{now});
  assert.equal(Tides.breedingStatus(h.c.S.tides,job.stationId,now).phase,phase);
  const before=clone(h.c.S);h.c.placeFarmItem('remove',it.x,it.y);
  assert.deepEqual(clone(h.c.S),before);assert.ok(h.calls.some(x=>x.type==='message'&&/collect the Tide/.test(x.message)));
 }
});

test('mass delete checks incubation again on confirmation and preserves every selected item without refunds',()=>{
 const h=harness(),it=buy(h);h.c.S.farm.b.push({t:'tree_farm',x:3200,y:2300});h.c.S.farm.c.push({t:'hay',x:3250,y:2300});h.c.S.farm.r.push({t:'dirt_road',x0:3000,y0:2200,x1:3300,y1:2400});
 h.c.pendingDelRect={x0:2900,y0:2100,x1:3500,y1:2500};
 breedingJob(h,it,Date.now());const before=clone(h.c.S);
 h.el('farmDelYes').onclick();assert.deepEqual(clone(h.c.S),before);assert.equal(h.c.pendingDelRect,null);
 assert.ok(h.calls.some(x=>x.type==='message'&&/collect the Tide/.test(x.message)));
});

test('after collection demolition uses the existing50percent refund path exactly once',()=>{
 const h=harness(),it=buy(h),job=breedingJob(h,it,1000);
 Tides.revealBreeding(h.c.S.tides,job.stationId,{now:61000});Tides.claimBreeding(h.c.S.tides,job.stationId,{now:61000});
 const gold=h.c.S.gold;h.c.placeFarmItem('remove',it.x,it.y);
 assert.equal(h.c.S.farm.b.length,0);assert.equal(h.c.S.gold,gold+250000);assert.equal(h.c.S.tides.pets.length,3);
 h.c.placeFarmItem('remove',it.x,it.y);assert.equal(h.c.S.gold,gold+250000);
});
