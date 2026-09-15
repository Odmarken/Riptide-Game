/* Executes the actual City geometry, collision, movement and Tide UI hooks. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const W=require('../assets/wasteland/world.js'),T=require('../assets/tides/core.js'),E=require('../assets/tides/exploration.js'),Mounts=require('../assets/mounts/mounts.js');
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),uiSource=fs.readFileSync(path.join(__dirname,'../assets/tides/ui.js'),'utf8');
function section(start,end){const a=game.indexOf(start),b=game.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return game.slice(a,b);}
function harness(){
 const elements=new Map(),calls=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{id,hidden:true,innerHTML:'',textContent:'',scrollTop:0,style:{},classList:{contains:()=>false,toggle(){},add(){},remove(){}},querySelectorAll:()=>[],getClientRects:()=>[]});return elements.get(id);};
 const S={tides:T.createCollection()};T.purchaseLasso(S.tides,10000,{now:1000,rng:()=>0});S.tides.exploration=E.create(null,{seed:487});
 const context={S,Tides:T,TideExploration:E,WastelandWorld:W,Mounts,mountRide:Mounts.createRide(),calls,
  gameOn:true,gamePaused:false,zone:{city:true},world:{w:16800,h:5200,solids:[],npcs:[]},
  hero:{x:8400,y:2000,r:13,walk:0,dead:false,moveTo:null,pendingDoor:null},keys:{},holdMove:null,marker:null,
  document:{getElementById:el,querySelectorAll:()=>[],activeElement:null},Image:class {complete=false;naturalWidth=0;},
  stopMining(){},totalGold:()=>10000,npcSebbeImg:{},speedOf:()=>175,
  openCupGame:()=>calls.push('Sebbe'),openMiningHall(){},openEnchantHall(){},openSmelter(){},openStable(){},
  openTalents(){},farmhouseClick(){},travelExpedition(){},
  setInputMode(){},initAudio(){},toggleMount(){},toggleSide(){},usePot:kind=>calls.push('potion:'+kind),cast:slot=>calls.push('cast:'+slot),
  stageMsg(){},ring(){},nearestEnemyWithin:()=>({x:0,y:0}),sfx:{bolt(){}},$:el,
  zoneOf:()=>context.zone,padPanelOpen:()=>context.activePanel||null};
 vm.createContext(context);
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','const cityPat=')+
  game.slice(game.indexOf('function mulberry32('),game.indexOf('\n',game.indexOf('function mulberry32('))),context);
 vm.runInContext(section('const SGRID=320;','function speedOf(')+section('function moveToward(','/* ==================== FX')+
  section('function expeditionDoors(){','function refreshWastelandChunks(){'),context);
 vm.runInContext(uiSource+'\nglobalThis.UI=TideUI;',context);
 const pointer=section("cv.addEventListener('pointerdown',e=>{","let best=null,bd=32;");
 const start=pointer.lastIndexOf(' if(zoneOf().city){');assert.ok(start>0);
 vm.runInContext('globalThis.cityClick=function(wx,wy){'+pointer.slice(start)+'};',context);
 return {context,el,calls,ui:context.UI,S,hero:context.hero};
}
function scriptedWild(h,w){
 const region=E.REGIONS.find(r=>w.x>=r.x&&w.x<r.x+r.w&&w.y>=r.y&&w.y<r.y+r.h);assert.ok(region,'scripted encounter belongs to a biome');
 const state=E.forWorld(h.S.tides.exploration,region.key);state.wild.push({...w,x:w.x-region.x,y:w.y-region.y});
 h.ui.updateExploration();return E.visible(h.S.tides.exploration).find(p=>p.id===w.id);
}

test('the actual church click route walks to a reachable door and opens the Tidekeeper from every side',()=>{
 for(const offset of [[0,380],[380,0],[-380,0],[0,-380]]){
  const h=harness(),c=h.context;c.buildCity(c.mulberry32(13));
  const church=c.world.solids.find(s=>s.type==='cathedral');h.hero.x=church.x+offset[0];h.hero.y=church.y+offset[1];
  assert.equal(c.collide(h.hero,h.hero.x,h.hero.y),false,'start is on walkable ground');
  c.cityClick(church.x,church.y-80);assert.ok(h.hero.pendingDoor);assert.equal(h.hero.pendingDoor.s,church);
  assert.equal(c.collide(h.hero,h.hero.moveTo.x,h.hero.moveTo.y),false,'the requested church door is walkable');
  for(let i=0;i<1800&&h.hero.pendingDoor;i++){
   const p=h.hero.pendingDoor;c.moveToward(h.hero,h.hero.moveTo.x,h.hero.moveTo.y,1/60);
   assert.equal(c.collide(h.hero,h.hero.x,h.hero.y),false);
   if(Math.hypot(h.hero.x-p.s.x,h.hero.y-p.s.y)<p.rng)p.open();
  }
  assert.equal(h.el('tideHub').hidden,false,'church reached from '+offset);
  assert.equal(h.el('tideHubTitle').textContent,'The Tidekeeper');assert.equal(h.hero.pendingDoor,null);
 }
});

test('church access is City-only and cannot overlap Sebbe or open while dead',()=>{
 const h=harness(),c=h.context;c.buildCity(c.mulberry32(13));const church=c.world.solids.find(s=>s.type==='cathedral');
 const sebbe=c.world.npcs.find(n=>n.game==='cups');h.hero.x=sebbe.x;h.hero.y=sebbe.y+25;
 c.cityClick(sebbe.x,sebbe.y-25);assert.deepEqual(h.calls,['Sebbe']);assert.equal(h.el('tideHub').hidden,true);
 h.hero.x=church.x;h.hero.y=church.y+70;assert.equal(h.ui.churchInReach(),true);
 for(const zone of [{},{wasteland:true},{dungeon:'briarhollow'}]){c.zone=zone;assert.equal(h.ui.churchInReach(),false);}
 c.zone={city:true};h.hero.dead=true;assert.equal(h.ui.churchInReach(),false);h.ui.openChurch();assert.equal(h.el('tideHub').hidden,true);
});

test('the production unified Wasteland callback excludes props, both vendor grounds, all portals and off-map positions',()=>{
 const h=harness(),c=h.context;c.zone={wasteland:true};c.world=W.create();
 c.world.travelDoors=[{...c.world.exit},...c.world.entrances];
 const spots=[c.world.spawn,c.world.stable.vendor,c.world.training.vendor,...c.world.entrances,{x:25000,y:13000},{x:80,y:10000},{x:50320,y:13000},{x:67900,y:45500}];
 let count=0;const seen=new Set();
 for(const spot of spots){
  h.hero.x=spot.x;h.hero.y=spot.y;W.updateChunks(c.world,spot.x,spot.y,1800);
  h.S.tides.exploration=E.create(null,{seed:count+10});
  for(let i=0;i<80;i++){
   h.hero.x+=i%2?30:-30;h.ui.updateExploration();
   for(const w of E.visible(h.S.tides.exploration)){
    assert.equal(c.collide(h.hero,w.x,w.y),false,'spawn must pass the real game collider');
    assert.ok(c.world.travelDoors.every(d=>Math.hypot(d.x-w.x,d.y-w.y)>=220));
    assert.ok(c.world.stable.clearZones.every(r=>!(w.x>r.x-50&&w.x<r.x+r.w+50&&w.y>r.y-50&&w.y<r.y+r.h+50)));
    assert.ok(c.world.training.clearZones.every(r=>!(w.x>r.x-50&&w.x<r.x+r.w+50&&w.y>r.y-50&&w.y<r.y+r.h+50)));
    assert.equal(W.contains(c.world,w.x,w.y,24),true,'spawn lies within the connected L-shaped map');
    count++;seen.add(w.id);
   }
  }
 }
 assert.ok(seen.size>=4,'actual geometry still accepts sparse encounters near landmarks and in all biomes');
});

test('production world encounters pause in menus and restore the same local animals after City and reload',()=>{
 const h=harness(),c=h.context;c.zone={wasteland:true};c.world=W.create();Object.assign(h.hero,c.world.spawn);const origin={x:h.hero.x,y:h.hero.y};
 vm.runInContext('Date.now=()=>1800000000000',c);
 W.updateChunks(c.world,h.hero.x,h.hero.y,1800);h.ui.updateExploration();
 for(let seed=488;!E.visible(h.S.tides.exploration).length&&seed<520;seed++){h.S.tides.exploration=E.create(null,{seed});h.ui.updateExploration();}
 const snapshot=()=>E.visible(h.S.tides.exploration).map(w=>({id:w.id,speciesId:w.speciesId,level:w.level,x:w.x,y:w.y})).sort((a,b)=>a.id.localeCompare(b.id));
 const initial=snapshot();assert.ok(initial.length>0);
 for(const pause of ['hub','panel','game','dead']){
  if(pause==='hub')h.el('tideHub').hidden=false;if(pause==='panel')c.activePanel={};if(pause==='game')c.gamePaused=true;if(pause==='dead')h.hero.dead=true;
  for(let i=0;i<20;i++){h.hero.x+=20;h.ui.updateExploration();}assert.deepEqual(snapshot(),initial,pause);
  h.el('tideHub').hidden=true;c.activePanel=null;c.gamePaused=false;h.hero.dead=false;Object.assign(h.hero,origin);h.ui.updateExploration();assert.deepEqual(snapshot(),initial,'same place after closing '+pause);
 }
 const old=c.world;c.world={w:16800,h:5200,solids:[]};c.zone={city:true};h.ui.updateExploration();assert.equal(h.ui.nearestWild(),null);
 c.world=old;c.zone={wasteland:true};Object.assign(h.hero,origin);h.ui.updateExploration();assert.deepEqual(snapshot(),initial);
 h.S.tides.exploration=E.create(JSON.parse(JSON.stringify(h.S.tides.exploration)));h.ui.updateExploration();assert.deepEqual(snapshot(),initial);
});

test('clicking even a spectral Tide opens the neutral challenge route without targeting an enemy',()=>{
 const h=harness(),c=h.context;c.zone={wasteland:true};c.world=W.create();
 h.hero.x=2100;h.hero.y=49600;scriptedWild(h,{id:'rare',speciesId:'spectralwyrm',level:30,x:2500,y:49600,fx:1,expiresAt:Date.now()+300000});
 h.hero.target={enemy:true};assert.equal(h.ui.wildClick(2500,49580),true);
 assert.equal(h.hero.target,null);assert.equal(h.hero.pendingDoor.s.id,'rare');
 h.hero.x=2380;h.hero.pendingDoor.open();assert.equal(h.el('tideHub').hidden,false);assert.match(h.el('tideHubBody').innerHTML,/Spectral|spectral/);
 assert.equal(E.visible(h.S.tides.exploration).filter(w=>w.id==='rare').length,1,'previewing never consumes the rare encounter');
 c.zone={dungeon:'frostveil'};assert.equal(h.ui.wildClick(2500,49580),false);
});

test('an encounter that expires in its open challenge cannot start a battle or reserve the companion',()=>{
 const h=harness(),c=h.context;c.zone={wasteland:true};c.world=W.create();Object.assign(h.hero,c.world.spawn);
 vm.runInContext('Date.now=()=>1800000000000',c);
 const w={id:'expired-preview',speciesId:'spectralwyrm',level:30,x:h.hero.x+50,y:h.hero.y,expiresAt:1800000000001};
 scriptedWild(h,w);h.ui.openWild(w.id);assert.equal(h.el('tideHub').hidden,false);
 const pets=JSON.parse(JSON.stringify(h.S.tides.pets)),battleId=h.S.tides.nextBattleId;
 vm.runInContext('Date.now=()=>1800000000002',c);h.ui.begin(w.id);
 assert.equal(h.ui.isBattling(),false);assert.equal(h.S.tides.activeBattle,null);assert.equal(h.S.tides.nextBattleId,battleId);
 assert.deepEqual(h.S.tides.pets,pets);assert.equal(h.el('tideHub').hidden,true);
 assert.equal(E.visible(h.S.tides.exploration).some(p=>p.id===w.id),false);
});

test('typing a Tide search cannot cast spells, spend potions or acquire a world enemy target',()=>{
 const h=harness(),c=h.context,listeners={};c.window={addEventListener:(event,fn)=>{listeners[event]=fn;}};
 c.document.activeElement={tagName:'INPUT'};h.el('tideHub').hidden=false;
 vm.runInContext(section("window.addEventListener('keydown',e=>{","window.addEventListener('keyup',e=>{"),c);
 for(const key of ['1','2','3','4','5','e','w','b','x'])listeners.keydown({key,repeat:false,preventDefault(){}});
 assert.deepEqual(h.calls,[]);assert.equal(h.hero.target,undefined);assert.ok(!c.keys.w);
});

test('a Tide battle continues polling the controller while stopping world simulation',()=>{
 const calls=[],context={gameOn:true,runeFxDt:0,TideUI:{tick:()=>calls.push('battle'),isBattling:()=>true},padNow:null,padStick:()=>null,padTick:()=>calls.push('controller')};
 vm.runInNewContext(section('function update(dt){',' refreshWastelandChunks();')+'throw new Error("World simulation reached during Tide battle");}\nupdate(.016);',context);
 assert.deepEqual(calls,['battle','controller']);
});

test('controller interaction offers a nearby wild animal through the same challenge UI',()=>{
 const h=harness(),c=h.context;c.zone={wasteland:true};c.world=W.create();h.hero.x=75200;h.hero.y=39000;
 scriptedWild(h,{id:'controller-rare',speciesId:'spectralpanther',level:30,x:75300,y:39000,expiresAt:Date.now()+300000});
 vm.runInContext(section('function padInteract(){','/* B backs out.'),c);
 const near=c.padInteract();assert.ok(near,'controller can select the nearby neutral animal');assert.equal(near.s.id,'controller-rare');
 near.open();assert.equal(h.el('tideHub').hidden,false);assert.match(h.el('tideHubBody').innerHTML,/Spectral|spectral/);
});
