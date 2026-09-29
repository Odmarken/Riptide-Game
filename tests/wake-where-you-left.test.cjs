/* 🧭 Where you log out is where you wake (asked for 2026-09-29) - the Harbour and the Throne Hall too, which are written down
 * as the City for older builds - except in an instance: a dungeon puts you at its door, a raid or a boss's arena at home.
 * The exact spot is kept on the device and used when it is still free. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}

const ZONES=vm.runInNewContext(section('const ZONES=[','const TAVERN_ZONE=').replace(/^const ZONES=/,'(').replace(/;\s*$/,'')+')',{});
const idx=name=>{const i=ZONES.findIndex(z=>z.name===name);assert.ok(i>=0,name);return i;};
const instance=vm.runInNewContext((source.match(/^const instanceZone=.*$/m)||[''])[0]+';instanceZone');

test('dungeons, raids and every boss arena are instances; towns, halls and open country are not',()=>{
 for(const name of ['Briarhollow','Cindervein','Frostveil','Violet Halls','Hollowroot Den','Emberdeep Keep','Gates of the Viking','Halls of Valhalla','Cow Level','The Crypts','The Final Hour'])
  assert.equal(instance(ZONES[idx(name)]),true,name);
 for(const name of ['Moonshine','City','Throne Hall','The Harbour','Wasteland','Farm','The Altar','Tides Guild','Silverfjord','Palace of Silverfjord','Kraken’s Rest'])
  assert.equal(instance(ZONES[idx(name)]),false,name);
 assert.equal(instance(ZONES[0]),false,'a levelling zone is open country');
 assert.equal(instance(undefined),false);
});

test('migrate wakes the hero where the save says, reading back the notes older builds need',()=>{
 const rule=section('/* 🧭 where you logged out is where you wake','\n if(!ZONES[s.zone|0])s.zone=TAVERN_ZONE;');
 const c={ZONES,instanceZone:instance,TAVERN_ZONE:idx('Moonshine'),CITY_ZONE:idx('City'),WASTELAND_ZONE:idx('Wasteland'),THRONE_ZONE:idx('Throne Hall'),HARBOR_ZONE:idx('The Harbour')};
 vm.createContext(c);
 const run=s=>{c.__s=s;vm.runInContext('(function(s){'+rule+'})(__s)',c);return s;};
 assert.deepEqual(run({zone:c.CITY_ZONE,atPalace:true}),{zone:c.THRONE_ZONE},'logged out in the Throne Hall: wake in it');
 assert.deepEqual(run({zone:c.CITY_ZONE,atHarbor:true}),{zone:c.HARBOR_ZONE},'logged out in the Harbour: wake in it');
 assert.deepEqual(run({zone:c.CITY_ZONE}),{zone:c.CITY_ZONE},'the City stays the City');
 assert.deepEqual(run({zone:idx('Briarhollow')}),{zone:c.WASTELAND_ZONE,atDungeon:'briarhollow'},'a dungeon: at its door in the Wasteland');
 for(const name of ['Violet Halls','Hollowroot Den','Halls of Valhalla','Cow Level','The Crypts','The Final Hour'])
  assert.deepEqual(run({zone:idx(name)}),{zone:c.TAVERN_ZONE},name+': home to Moonshine');
 for(const name of ['Farm','The Altar','Tides Guild','Wasteland'])assert.deepEqual(run({zone:idx(name)}),{zone:idx(name)},name+' stays');
 assert.deepEqual(run({zone:0}),{zone:0},'a levelling zone stays');
 /* the Harbour and the Throne Hall are still WRITTEN as the City, so an older exe keeps its character list */
 assert.match(source,/let snap=z&&z\.throne\?\{\.\.\.S,zone:CITY_ZONE,atPalace:true\}:z&&z\.harbor\?\{\.\.\.S,zone:CITY_ZONE,atHarbor:true\}/);
});

test('the exact spot: used when it is the same zone and free, never in another zone, off the map or built over',()=>{
 const code=section('let spotLast=null,wakeSpot=null;','/* ⚓ the Harbour');
 const make=(blocked=false)=>{
  const Z=idx('City'),c={ZONES,S:{zone:Z},hero:{x:100,y:100,r:13},pet:{x:0,y:0},world:{w:4000,h:3000},VW:1000,VH:600,zoom:1,camX:0,camY:0,
   zoneOf:()=>ZONES[Z],instanceZone:instance,collide:()=>blocked,refreshWastelandChunks(){},deviceSet:async()=>{},deviceGet:async()=>null,gameOn:true};
  vm.createContext(c);vm.runInContext(code.replace('let spotLast=null,wakeSpot=null;','var spotLast=null,wakeSpot=null;'),c);return c;
 };
 let c=make();c.wakeSpot={z:idx('City'),x:900,y:700};
 assert.equal(vm.runInContext('wakeAt()',c),true);assert.equal(c.hero.x,900);assert.equal(c.hero.y,700);assert.equal(c.pet.x,870);assert.equal(c.wakeSpot,null);
 c=make();c.wakeSpot={z:idx('Farm'),x:900,y:700};assert.equal(vm.runInContext('wakeAt()',c),false,'another zone');assert.equal(c.hero.x,100);
 c=make();c.wakeSpot={z:idx('City'),x:5,y:700};assert.equal(vm.runInContext('wakeAt()',c),false,'off the map');
 c=make(true);c.wakeSpot={z:idx('City'),x:900,y:700};assert.equal(vm.runInContext('wakeAt()',c),false,'built over');assert.equal(c.hero.x,100,'back on the zone spawn');
 c=make();assert.equal(vm.runInContext('wakeAt()',c),false,'no spot, nothing moves');
});

test('the spot is stamped as you play and as you leave, and read before the world is built',()=>{
 assert.match(source,/buildZone\(\);wakeAt\(\);/,'beginGame stands the hero on it after building');
 assert.match(source,/wakeSpot=await loadSpot\(ch\.id\);/,'Enter World reads it');
 assert.match(section('function showSelect(){','\n}'),/spotStamp\(true\)/);
 assert.match(section('function showLogin(','\n}'),/spotStamp\(true\)/);
 assert.match(source,/const cloudBail=async\(\)=>\{spotStamp\(true\);/,'closing the window');
 assert.match(source,/setInterval\(\(\)=>spotStamp\(false\),4000\);/);
 assert.match(source,/else if\(S\.zone===WASTELAND_ZONE&&S\.atDungeon\)/,'the dungeon door');
 assert.match(source,/delete S\.atPalace;delete S\.atHarbor;delete S\.atDungeon;/);
 assert.doesNotMatch(section('function saveSnapshot(){','async function save(){'),/spot/,'the spot never rides in the save - no cloud traffic, no new rev');
});
