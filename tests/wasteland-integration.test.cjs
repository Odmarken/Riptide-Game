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
 'globalThis.testApi={ZONES,TAVERN_ZONE,WASTELAND_ZONE,travelExpedition,zoneTemplates,zoneQuests,knowledgeBook,isKnowledgeBook,killEnemy,cleanBagItem,tryAutoEquip,upgradeItem,bagSellable,buildZone,update,getSpawn:()=>expeditionSpawn};'
].join('\n');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(key='briarhollow',options={}){
 const calls=[],forbidden=name=>()=>{throw new Error('Ordinary reward/effect reached: '+name);};
 const S=options.state?plain(options.state):{zone:0,gold:123,scraps:47,xp:83,qProg:4,bag:[],scrolls:[],gear:{weapon:null,armor:null,trinket:null}};
 const clock=options.clock||{now:Date.now()},snapshots=[];
 const context={S,calls,clock,snapshots,Date:class extends Date{static now(){return clock.now;}},hero:{hp:400,dead:false,target:null},world:null,mp:{on:false,started:false},enemies:[],hazards:[],ebolts:[],WastelandWorld:W,Mounts,TideUI,mountRide:Mounts.createRide(),$:()=>null,
  MAXLVL:60,pMul:()=>1+.1*(S.prestige||0),pRew:()=>1,mobGold:()=>0,
  raceOf:()=>({leech:.03}),heroMax:()=>1000,hasEnch:id=>id==='reaper',scrollPct:id=>id==='reaper'?.02:0,
  inGearSet:()=>false,itemName:it=>it.name,inBossFight:forbidden('upgrade combat check'),capUp:forbidden('upgrade cap'),upCost:forbidden('upgrade cost'),
  calcPower:forbidden('book stat calculation'),addGold:forbidden('gold'),addScraps:forbidden('scraps'),gainXP:forbidden('XP'),rollItem:forbidden('gear'),completeQuest:forbidden('quest'),
  burst:()=>{},sparkles:()=>{},floatAt:()=>{},stageMsg:()=>{},log:()=>{},save:()=>calls.push('save'),saveNow:()=>{calls.push('saveNow');snapshots.push(plain(S));},renderHUD:()=>calls.push('HUD'),
  sfx:{die:()=>calls.push('die'),loot:()=>calls.push('loot')},hcNoFlee:()=>false,
  goToZone:i=>{calls.push(['travel',i]);S.zone=i;},mpLeave:value=>calls.push(['mpLeave',value])};
 context.zoneOf=()=>context.testApi.ZONES[S.zone];
 vm.createContext(context);vm.runInContext(dungeonSource+'\n'+integration,context);
 S.zone=context.testApi.ZONES.findIndex(z=>z.dungeon===key);
 S.wastelandBossReadyAt=context.WastelandDungeons.normalizeBossTimers(S.wastelandBossReadyAt,clock.now);
 const definition=context.WastelandDungeons.definitions[key],z=context.zoneOf();
 const templates={mobs:context.testApi.zoneTemplates({lvl:z.lvl,en:definition.mobs.map(m=>[m.name,m.kind,definition.color])}),boss:context.testApi.zoneTemplates({lvl:z.lvl,boss:['Guardian',definition.color,'wasteland']})[0]};
 context.world=W.create(key);context.world.encounter=context.WastelandDungeons.createEncounter(key,context.world.enemySpawns,templates,{bossReadyAt:S.wastelandBossReadyAt[key]});
 return {...context,api:context.testApi,context};
}
for(const key of ['briarhollow','cindervein','frostveil']){
 test(key+': actual killEnemy gives one book for both bosses, keeps death passives, and ignores repeat kills',()=>{
  const h=harness(key),before={gold:h.S.gold,scraps:h.S.scraps,xp:h.S.xp,qProg:h.S.qProg};
  let bossKills=0;
  for(const en of h.world.encounter.enemies){
   h.hero.hp=400;h.hero.target=en;const books=h.S.bag.length,saves=h.calls.filter(c=>c==='saveNow').length;
   h.api.killEnemy(en);
   assert.equal(h.hero.hp,450,'Undead 3% + Reaper 2% still heal on dungeon kills');
   assert.equal(h.hero.target,null);assert.equal(en.dead,true);assert.equal(en.dungeonDefeated,true);
   if(en.boss)bossKills++;
   assert.equal(h.S.bag.length,books+(en.boss&&bossKills===2?1:0));assert.equal(h.calls.filter(c=>c==='saveNow').length,saves+(en.boss?1:0));
   if(en.boss){assert.equal(h.S.wastelandBossReadyAt[key][en.dungeonIndex],en.bossReadyAt);assert.ok(en.bossReadyAt>Date.now()+7199000);}
   const count=h.calls.length;h.api.killEnemy(en);assert.equal(h.calls.length,count,'duplicate kill has no second effect');assert.equal(h.hero.hp,450);
  }
  assert.deepEqual({gold:h.S.gold,scraps:h.S.scraps,xp:h.S.xp,qProg:h.S.qProg},before);
  assert.equal(h.S.bag.length,1);assert.deepEqual(h.S.scrolls,[]);
  const bosses=h.world.encounter.enemies.filter(e=>e.boss);
  const book=h.S.bag[0];assert.equal(h.api.isKnowledgeBook(book),true);assert.equal(book.sourceBoss,bosses.map(b=>b.name).join(' & '));assert.equal(book.sourceDungeon,key);
 });
}

for(const key of ['briarhollow','cindervein','frostveil'])for(const order of [[0,1],[1,0]])test(key+': kill order '+order.join(' then ')+' saves partial and completed clears and requires two fresh kills next time',()=>{
 const clock={now:1000000};let h=harness(key,{clock});
 const boss=i=>h.world.encounter.enemies.find(e=>e.boss&&e.dungeonIndex===i);
 h.api.killEnemy(boss(order[0]));assert.equal(h.S.bag.length,0);assert.equal(h.snapshots.length,1,'first guardian must save even without loot');
 const firstSave=h.snapshots.at(-1),firstDeadline=firstSave.wastelandBossReadyAt[key][order[0]];
 assert.equal(firstSave.wastelandBossReadyAt[key].clearProgress,1<<order[0]);
 clock.now+=1000;h=harness(key,{state:firstSave,clock});assert.equal(boss(order[0]).dead,true);
 h.api.killEnemy(boss(order[1]));assert.equal(h.S.bag.length,1);assert.equal(h.snapshots.length,1);
 const completed=h.snapshots.at(-1),secondDeadline=completed.wastelandBossReadyAt[key][order[1]];
 assert.equal(completed.bag.length,1);assert.equal(completed.wastelandBossReadyAt[key].clearProgress,undefined,'inventory and consumed progress share one save');
 h=harness(key,{state:completed,clock});for(const i of order)h.api.killEnemy(boss(i));assert.equal(h.S.bag.length,1);assert.equal(h.snapshots.length,0,'re-entry cannot pay again');
 clock.now=firstDeadline;h.WastelandDungeons.updateEnemy(boss(order[0]),0,{x:0,y:0});h.api.killEnemy(boss(order[0]));assert.equal(h.S.bag.length,1,'the old second guardian cannot count again');
 h=harness(key,{state:h.snapshots.at(-1),clock});assert.equal(h.S.wastelandBossReadyAt[key].clearProgress,1<<order[0]);
 clock.now=secondDeadline;h.WastelandDungeons.updateEnemy(boss(order[1]),0,{x:0,y:0});h.api.killEnemy(boss(order[1]));assert.equal(h.S.bag.length,2);
 const final=h.snapshots.at(-1);assert.equal(final.bag.length,2);assert.equal(final.wastelandBossReadyAt[key].clearProgress,undefined);
});

test('old saved books remain intact and already paid legacy guardian deaths cannot be reused',()=>{
 const clock={now:1000000},initial=harness('briarhollow',{clock}),state=plain(initial.S);
 state.bag.push(initial.api.knowledgeBook('Old guardian','briarhollow'));
 state.wastelandBossReadyAt.briarhollow={0:clock.now+3600000};
 const h=harness('briarhollow',{state,clock}),bosses=h.world.encounter.enemies.filter(e=>e.boss);
 h.api.killEnemy(bosses[1]);assert.equal(h.S.bag.length,1);assert.equal(h.S.bag[0].sourceBoss,'Old guardian');
 assert.equal(h.S.wastelandBossReadyAt.briarhollow.clearProgress,2);
 clock.now+=3600000;h.WastelandDungeons.updateEnemy(bosses[0],0,{x:0,y:0});h.api.killEnemy(bosses[0]);assert.equal(h.S.bag.length,2);
});
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


test('actual overworld updates keep one world, hero and ride while crossing biome seams',()=>{
 const h=harness(),c=h.context,world=W.create();h.S.zone=h.api.WASTELAND_ZONE;c.world=world;
 const sentinel=new Error('continued current-world simulation');
 Object.assign(c,{gameOn:true,runeFxDt:0,padNow:null,refreshWastelandChunks:()=>{},expeditionDoors:()=>[],padStick:()=>{throw sentinel;}});
 Object.assign(c.mountRide,{id:'spectral-tiger',phase:1.23,moving:.8});
 const ride=plain(c.mountRide),hero=c.hero;
 for(const [x,y]of [[28500,26005],[28500,25995],[50395,44000],[50405,44000],[50405,44000],[50395,44000],[28500,25995],[28500,26005]]){
  Object.assign(hero,{x,y});assert.throws(()=>h.api.update(.016),error=>error===sentinel);
  assert.equal(c.world,world);assert.equal(c.hero,hero);assert.equal(h.S.zone,h.api.WASTELAND_ZONE);assert.deepEqual(plain(c.mountRide),ride);
  assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='travel'),false,'seams do not invoke zone travel or rebuild the map');
 }
 assert.equal(world.unified,true);assert.equal(world.w,100800);assert.equal(world.h,52000);
});
