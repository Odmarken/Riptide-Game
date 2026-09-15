/* Real game integration functions, without startup, DOM, saves or network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const W=require('../assets/wasteland/world.js');
const Mounts=require('../assets/mounts/mounts.js');
const TideUI={leaveZone(){},tick(){},isBattling:()=>false,modalOpen:()=>false,updateExploration(){}};
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const dungeonSource=fs.readFileSync(path.join(root,'assets/wasteland/dungeons.js'),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Cannot locate production section: '+start);return source.slice(a,b);
}
const integration=[
 section('const ZONES=[','const TAVERN_ZONE='),
 section('const TAVERN_ZONE=','const expeditionZone='),
 section('const expeditionZone=','const expeditionImages='),
 section('function travelExpedition(s){','function expeditionDoors(){'),
 section('function travelWastelandEdge(){','function refreshWastelandChunks(){'),
 section('/* stat curves */','function zoneQuests(z){'),
 section('function zoneQuests(z){','/* ==================== STATE'),
 section("const SLOTS=['weapon'",'const PREFIX='),
 section('const isLegendary=','/* Upgrade cost:'),
 section('const bagSellable=','const bagGoldVal='),
 section('function upgradeItem(it){','function statBaseStr('),
 section('function healHero(amt,silent){','function hurtHero('),
 section('function killEnemy(en){','/* XP intake with'),
 section('function cleanBagItem(it){','function scrapBagItems('),
 section('function update(dt){',' padNow=padStick();')+' padNow=padStick();}',
 // Execute the actual retirement prefix before the unrelated map construction.
 section('function buildZone(){',' if(!zoneOf().special')+'}',
 'globalThis.testApi={ZONES,TAVERN_ZONE,WASTELAND_ZONE,travelExpedition,travelWastelandEdge,zoneTemplates,zoneQuests,knowledgeBook,isKnowledgeBook,killEnemy,cleanBagItem,tryAutoEquip,upgradeItem,bagSellable,buildZone,update,getSpawn:()=>expeditionSpawn};'
].join('\n');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(key='briarhollow'){
 const calls=[],forbidden=name=>()=>{throw new Error('Ordinary reward/effect reached: '+name);};
 const S={zone:0,gold:123,scraps:47,xp:83,qProg:4,bag:[],scrolls:[],gear:{weapon:null,armor:null,trinket:null}};
 const context={S,calls,hero:{hp:400,dead:false,target:null},world:null,mp:{on:false,started:false},WastelandWorld:W,Mounts,TideUI,mountRide:Mounts.createRide(),$:()=>null,
  MAXLVL:60,pMul:()=>1+.1*(S.prestige||0),pRew:()=>1,mobGold:()=>0,
  raceOf:()=>({leech:.03}),heroMax:()=>1000,hasEnch:id=>id==='reaper',scrollPct:id=>id==='reaper'?.02:0,
  inGearSet:()=>false,itemName:it=>it.name,inBossFight:forbidden('upgrade combat check'),capUp:forbidden('upgrade cap'),upCost:forbidden('upgrade cost'),
  calcPower:forbidden('book stat calculation'),addGold:forbidden('gold'),addScraps:forbidden('scraps'),gainXP:forbidden('XP'),rollItem:forbidden('gear'),completeQuest:forbidden('quest'),
  burst:()=>{},sparkles:()=>{},floatAt:()=>{},stageMsg:()=>{},log:()=>{},save:()=>calls.push('save'),saveNow:()=>calls.push('saveNow'),renderHUD:()=>calls.push('HUD'),
  sfx:{die:()=>calls.push('die'),loot:()=>calls.push('loot')},hcNoFlee:()=>false,
  goToZone:i=>{calls.push(['travel',i]);S.zone=i;},mpLeave:value=>calls.push(['mpLeave',value])};
 context.zoneOf=()=>context.testApi.ZONES[S.zone];
 vm.createContext(context);vm.runInContext(dungeonSource+'\n'+integration,context);
 S.zone=context.testApi.ZONES.findIndex(z=>z.dungeon===key);
 S.wastelandBossReadyAt=context.WastelandDungeons.normalizeBossTimers(null);
 const definition=context.WastelandDungeons.definitions[key],z=context.zoneOf();
 const templates={mobs:context.testApi.zoneTemplates({lvl:z.lvl,en:definition.mobs.map(m=>[m.name,m.kind,definition.color])}),boss:context.testApi.zoneTemplates({lvl:z.lvl,boss:['Guardian',definition.color,'wasteland']})[0]};
 context.world=W.create(key);context.world.encounter=context.WastelandDungeons.createEncounter(key,context.world.enemySpawns,templates,{bossReadyAt:S.wastelandBossReadyAt[key]});
 return {...context,api:context.testApi,context};
}
for(const key of ['briarhollow','cindervein','frostveil']){
 test(key+': actual killEnemy gives only two books, keeps death passives, and ignores repeat kills',()=>{
  const h=harness(key),before={gold:h.S.gold,scraps:h.S.scraps,xp:h.S.xp,qProg:h.S.qProg};
  for(const en of h.world.encounter.enemies){
   h.hero.hp=400;h.hero.target=en;const books=h.S.bag.length,saves=h.calls.filter(c=>c==='saveNow').length;
   h.api.killEnemy(en);
   assert.equal(h.hero.hp,450,'Undead 3% + Reaper 2% still heal on dungeon kills');
   assert.equal(h.hero.target,null);assert.equal(en.dead,true);assert.equal(en.dungeonDefeated,true);
   assert.equal(h.S.bag.length,books+(en.boss?1:0));assert.equal(h.calls.filter(c=>c==='saveNow').length,saves+(en.boss?1:0));
   if(en.boss){assert.equal(h.S.wastelandBossReadyAt[key][en.dungeonIndex],en.bossReadyAt);assert.ok(en.bossReadyAt>Date.now()+7199000);}
   const count=h.calls.length;h.api.killEnemy(en);assert.equal(h.calls.length,count,'duplicate kill has no second effect');assert.equal(h.hero.hp,450);
  }
  assert.deepEqual({gold:h.S.gold,scraps:h.S.scraps,xp:h.S.xp,qProg:h.S.qProg},before);
  assert.equal(h.S.bag.length,2);assert.deepEqual(h.S.scrolls,[]);
  const bosses=h.world.encounter.enemies.filter(e=>e.boss);
  h.S.bag.forEach((book,i)=>{assert.equal(h.api.isKnowledgeBook(book),true);assert.equal(book.sourceBoss,bosses[i].name);assert.equal(book.sourceDungeon,key);});
 });
}
test('actual buildZone retirement prefix prevents stale multishot targets from yielding books or heals',()=>{
 const h=harness(),targets=h.world.encounter.enemies.slice();for(const en of targets)en.dungeonCast={shape:'circle'};
 h.api.buildZone();
 for(const en of targets){assert.equal(en.dead,true);assert.equal(en.dungeonRetired,true);assert.equal(en.dungeonCast,null);h.api.killEnemy(en);}
 assert.equal(h.S.bag.length,0);assert.equal(h.hero.hp,400);assert.deepEqual(h.calls,[]);
});
test('cleanBagItem retains a book but removes fabricated stats and normalizes its inert identity',()=>{
 const h=harness(),incoming={...h.api.knowledgeBook('Elder Thornroot','briarhollow'),slot:'weapon',name:'Altered',rar:'common',sell:999999,power:9999,atk:888,hp:777,crit:66,up:12,wench:'frostgrip',legend:'rimfrost'};
 const book=h.api.cleanBagItem(incoming);
 assert.deepEqual(plain(book),plain(h.api.knowledgeBook('Elder Thornroot','briarhollow')));
 assert.equal(book.slot,'knowledge');assert.equal(book.rar,'legendary');assert.equal(book.sell,0);assert.equal(book.power,0);
 for(const stat of ['atk','hp','crit','up','wench','legend'])assert.equal(book[stat],undefined,stat);
 const numeric=h.api.cleanBagItem({kind:'knowledge',id:'book-of-knowledge',sourceBoss:4,sourceDungeon:7});assert.equal(numeric.sourceBoss,'4');assert.equal(numeric.sourceDungeon,'7');
 assert.equal(h.api.cleanBagItem({kind:'knowledge',id:'unrecognized',slot:'knowledge',name:'Other'}),null);
});
test('canonical books cannot be auto-equipped, upgraded, sold, or consumed as normal gear',()=>{
 const h=harness(),book=h.api.knowledgeBook('Guardian','frostveil'),before=plain(h.S);h.S.bag.push(book);
 assert.equal(h.api.tryAutoEquip(book),false);assert.equal(h.api.upgradeItem(book),false);assert.equal(h.api.bagSellable(book),false);
 assert.deepEqual(h.S.gear,before.gear);assert.equal(h.S.scraps,before.scraps);assert.equal(h.S.bag[0],book);assert.deepEqual(h.calls,[]);
 // Keep the ordinary gear path working: this guard must not disable all equipment.
 const gear={slot:'weapon',rar:'common',power:10,name:'Plain Blade',sell:3};assert.equal(h.api.tryAutoEquip(gear),true);assert.equal(h.S.gear.weapon,gear);assert.equal(h.api.bagSellable(gear),true);
});
test('all six expedition zones provide safe quests without legacy q arrays and preserve saved zone indices',()=>{
 const h=harness(),zones=h.api.ZONES.filter(z=>z.wasteland||z.dungeon);assert.equal(zones.length,6);
 assert.equal(h.api.ZONES[27].name,'Wasteland');assert.equal(h.api.ZONES[31].name,'Tides Guild');
 assert.equal(h.api.ZONES[32].biome,'wasteland-snow');assert.equal(h.api.ZONES[33].biome,'wasteland-desert');
 for(const z of zones){assert.equal(z.q,undefined);const quests=h.api.zoneQuests(z);assert.equal(quests.length,1);assert.equal(quests[0].name,z.name);assert.ok(quests[0].need>2);assert.equal(typeof quests[0].desc,'string');}
});
test('dungeon returns land beside the correct entrance and Home routes to Moonshine',()=>{
 for(const key of ['briarhollow','cindervein','frostveil']){
  const h=harness(key),entrance=W.ENTRANCES.find(e=>e.id===key);assert.equal(h.api.travelExpedition({destination:'wasteland'}),true);
  assert.equal(h.S.zone,h.api.WASTELAND_ZONE);assert.deepEqual(plain(h.api.getSpawn()),{zone:h.api.WASTELAND_ZONE,x:entrance.x,y:entrance.y+180});
  assert.ok(Math.hypot(h.api.getSpawn().x-entrance.x,h.api.getSpawn().y-entrance.y)>90,'return avoids automatic portal bounce');
  assert.equal(h.api.travelExpedition({destination:'home'}),true);assert.equal(h.S.zone,h.api.TAVERN_ZONE);assert.deepEqual(plain(h.api.getSpawn()),{zone:h.api.TAVERN_ZONE,x:1220,y:1370});
 }
});
test('entrance travel leaves multiplayer and respects hardcore/dead/invalid destination guards',()=>{
 const h=harness();h.context.mp.on=true;assert.equal(h.api.travelExpedition({destination:'frostveil'}),true);
 assert.equal(h.api.ZONES[h.S.zone].dungeon,'frostveil');assert.deepEqual(h.calls[0],['mpLeave',false]);
 const count=h.calls.length;h.context.hcNoFlee=()=>true;assert.equal(h.api.travelExpedition({destination:'home'}),false);assert.equal(h.calls.length,count);
 h.context.hcNoFlee=()=>false;h.hero.dead=true;assert.equal(h.api.travelExpedition({destination:'home'}),false);assert.equal(h.calls.length,count);
 h.hero.dead=false;assert.equal(h.api.travelExpedition({destination:'missing'}),false);assert.equal(h.api.travelExpedition(null),false);assert.equal(h.calls.length,count);
});
test('actual update continues simulation when hardcore blocks an overlapping portal',()=>{
 const h=harness(),sentinel=new Error('reached padStick after travel guard');
 Object.assign(h.hero,{x:100,y:100});Object.assign(h.context,{gameOn:true,runeFxDt:0,padNow:null,refreshWastelandChunks:()=>{},expeditionDoors:()=>[{x:100,y:100,type:'wastelandportal',destination:'home'}],padStick:()=>{throw sentinel;},hcNoFlee:()=>true});
 assert.throws(()=>h.api.update(.016),error=>error===sentinel);assert.equal(h.calls.length,0);assert.equal(h.context.runeFxDt,.016);
 h.context.hcNoFlee=()=>false;assert.doesNotThrow(()=>h.api.update(.016));assert.equal(h.S.zone,h.api.TAVERN_ZONE,'successful travel returns before the old frame continues');
});

function edgeHarness(key,position,zoom=1){
 const h=harness(),c=h.context;
 c.world=W.create(key);h.S.zone=h.api.ZONES.findIndex(z=>z.wasteland&&(z.biome||'wasteland')===key);
 Object.assign(c.hero,{...position,r:13,fx:-.6,fy:.8,mana:120,moveTo:{x:position.x+60,y:position.y+60}});
 Object.assign(c,{TideUI:{...TideUI},gamePaused:false,zoom,VW:1440,VH:920,camX:-100,camY:-100,clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
  refreshWastelandChunks:()=>{W.updateChunks(c.world,c.hero.x,c.hero.y,1800);h.calls.push('chunks');},updateMountButton:()=>h.calls.push('mountButton')});
 Object.assign(c.mountRide,{id:'spectral-tiger',phase:1.23,time:.7,moving:.8,lastX:position.x,lastY:position.y});
 c.goToZone=index=>{
  h.calls.push(['travel',index]);h.S.zone=index;const z=h.api.ZONES[index],spawn=h.api.getSpawn();
  c.world=W.create(z.biome||'wasteland');assert.equal(spawn.zone,index);
  c.world.spawn={x:spawn.x,y:spawn.y};
  // Model the existing builder's disposable hero/mount and initial camera. The
  // extracted edge function must then restore riding and correct the camera.
  c.hero={x:spawn.x,y:spawn.y,r:13,hp:c.hero.hp,mana:c.hero.mana,dead:false,fx:1,fy:0,moveTo:null};
  Mounts.reset(c.mountRide);c.camX=c.hero.x-c.VW/2;c.camY=c.hero.y-c.VH/2;
 };
 return h;
}

test('actual biome edge travel keeps all four routes aligned, mounted and safely inside the destination',()=>{
 const routes=[
  {from:'wasteland',to:'wasteland-snow',position:{x:28500,y:40},landing:{x:28500,y:25875},step:{x:0,y:-180}},
  {from:'wasteland-snow',to:'wasteland',position:{x:28500,y:25960},landing:{x:28500,y:125},step:{x:0,y:180}},
  {from:'wasteland',to:'wasteland-desert',position:{x:50360,y:18000},landing:{x:125,y:18000},step:{x:180,y:0}},
  {from:'wasteland-desert',to:'wasteland',position:{x:40,y:18000},landing:{x:50275,y:18000},step:{x:-180,y:0}},
 ];
 for(const route of routes)for(const zoom of [.55,1,2.6]){
  const h=edgeHarness(route.from,route.position,zoom),c=h.context,ride=plain(c.mountRide),health={hp:c.hero.hp,mana:c.hero.mana};
  assert.equal(h.api.travelWastelandEdge(),true,route.from+' to '+route.to);
  assert.equal(c.world.key,route.to);assert.equal(h.api.ZONES[h.S.zone].biome||'wasteland',route.to);
  assert.deepEqual({x:c.hero.x,y:c.hero.y},route.landing);
  assert.equal(W.isWalkable(c.world,c.hero.x,c.hero.y,c.hero.r),true,'landing remains in the walkable edge clearance');
  assert.equal(c.world.solids.some(s=>Math.hypot(s.x-c.hero.x,s.y-c.hero.y)<(s.r||0)+c.hero.r),false,'no tree, rock or landmark overlaps the landing');
  assert.deepEqual({hp:c.hero.hp,mana:c.hero.mana},health);assert.equal(c.hero.fx,-.6);assert.equal(c.hero.fy,.8);
  assert.deepEqual(plain(c.mountRide),ride,'riding state survives the normal builder reset');
  assert.deepEqual(plain(c.hero.moveTo),{x:route.landing.x+route.step.x,y:route.landing.y+route.step.y},'click movement continues inward');
  assert.equal(c.camX,c.clamp(c.hero.x-c.VW/(2*zoom),0,c.world.w-c.VW/zoom));
  assert.equal(c.camY,c.clamp(c.hero.y-c.VH/(2*zoom),0,c.world.h-c.VH/zoom));
  assert.ok(c.camX>=0&&c.camY>=0&&c.camX+c.VW/zoom<=c.world.w&&c.camY+c.VH/zoom<=c.world.h,'first arrival frame never shows outside the world');
  const calls=h.calls.length;assert.equal(h.api.travelWastelandEdge(),false,'arrival cannot immediately bounce to the previous region');assert.equal(h.calls.length,calls);
  assert.ok(h.calls.includes('chunks'));assert.ok(h.calls.includes('mountButton'));
 }
});

test('a crossed edge without a neighbor cannot mask an available return edge at a corner',()=>{
 for(const y of [35,25965]){
  const h=edgeHarness('wasteland-desert',{x:35,y}),c=h.context;
  assert.equal(c.world.edgeNeighbors[y<50?'north':'south'],undefined);
  assert.equal(h.api.travelWastelandEdge(),true,'the west return is still available beside a closed north/south edge');
  assert.equal(c.world.key,'wasteland');assert.equal(c.hero.x,50275);assert.equal(c.hero.y,y);
  assert.equal(W.isWalkable(c.world,c.hero.x,c.hero.y,c.hero.r),true);
 }
 const idle=edgeHarness('wasteland',{x:28500,y:40});idle.context.hero.moveTo=null;
 assert.equal(idle.api.travelWastelandEdge(),true);assert.equal(idle.context.hero.moveTo,null,'no click target is invented for keyboard or idle travel');
 const foot=edgeHarness('wasteland',{x:28500,y:40});Mounts.reset(foot.context.mountRide);
 assert.equal(foot.api.travelWastelandEdge(),true);assert.equal(foot.context.mountRide.id,null,'walking across a border does not equip a mount');
});

test('biome travel is blocked during battles, venue menus, death and pause without changing progress',()=>{
 const guards=[c=>{c.TideUI.isBattling=()=>true;},c=>{c.TideUI.modalOpen=()=>true;},c=>{c.hero.dead=true;},c=>{c.gamePaused=true;}];
 for(const guard of guards){
  const h=edgeHarness('wasteland',{x:28500,y:40}),c=h.context;guard(c);
  const before=plain({hero:c.hero,ride:c.mountRide,state:h.S}),world=c.world;
  assert.equal(h.api.travelWastelandEdge(),false);assert.equal(c.world,world);assert.equal(h.api.getSpawn(),null);
  assert.deepEqual(plain({hero:c.hero,ride:c.mountRide,state:h.S}),before);assert.deepEqual(h.calls,[]);
 }
 for(const [key,position]of [['wasteland',{x:28500,y:500}],['wasteland-snow',{x:2000,y:35}],['wasteland-desert',{x:50365,y:18000}]]){
  const h=edgeHarness(key,position);assert.equal(h.api.travelWastelandEdge(),false,'interior and unconnected boundaries never teleport');assert.deepEqual(h.calls,[]);
 }
 const missing=edgeHarness('wasteland',{x:28500,y:35});missing.context.world.edgeNeighbors.north='unknown';
 assert.equal(missing.api.travelWastelandEdge(),false);assert.deepEqual(missing.calls,[]);
});
