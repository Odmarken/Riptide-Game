const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert(i>=0&&j>i);return source.slice(i,j);};
const plain=v=>JSON.parse(JSON.stringify(v));
function travelHarness(){
 const city={city:true},guild={tideguild:true};
 const c=vm.createContext({ZONES:[city,guild],CITY_ZONE:0,gameOn:true,S:{zone:0},hero:{x:8400,y:2690,r:13},
  world:{solids:[{x:8400,y:2600,type:'well'}]},mp:{on:false},brunnImg:{naturalWidth:100,naturalHeight:120},
  zoneOf(){return c.ZONES[c.S.zone];},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),TideUI:{isBattling:()=>false,openGuild(){c.opened=(c.opened||0)+1;}},
  goToZone(i){c.S.zone=i;c.traveled=i;},marker:null});
 vm.runInContext(section('const TIDE_GUILD_ZONE=','let expeditionSpawn=')+'let expeditionSpawn=null;',c);
 return c;
}
test('City well click queues a reachable approach and opens only when close to the actual well',()=>{
 const h=travelHarness();h.hero.y=2860;
 assert.equal(vm.runInContext('guildWorldClick(8400,2560)',h),true);
 assert.equal(h.traveled,undefined);assert.deepEqual(plain(h.hero.moveTo),{x:8400,y:2658});
 assert.equal(h.hero.pendingDoor.s,h.world.solids[0]);
 h.hero.y=2695;h.hero.pendingDoor.open();assert.equal(h.traveled,1);
});
test('Well hit area follows its roof/base and does not affect wells outside City',()=>{
 const h=travelHarness();assert.equal(vm.runInContext('guildWorldClick(8400,2510)',h),false);
 assert.equal(vm.runInContext('guildWorldClick(8445,2570)',h),false);
 assert.equal(vm.runInContext('guildWorldClick(8400,2560)',h),true);assert.equal(h.traveled,1);
 h.ZONES[1]={tavern:true};assert.equal(vm.runInContext('guildWorldClick(8400,2560)',h),false);
});
test('Guild host interaction and stairs return are proximity guarded and return beside City well',()=>{
 const h=travelHarness();h.S.zone=1;h.world={npcs:[{x:1100,y:880,game:'tideguild'}],exit:{x:1100,y:2460}};
 h.hero.x=1100;h.hero.y=970;assert.equal(vm.runInContext('guildInReach()',h),true);
 assert.equal(vm.runInContext('guildWorldClick(1100,845)',h),true);assert.equal(h.opened,1);
 assert.equal(vm.runInContext('leaveTideGuild()',h),false);
 h.hero.y=2380;assert.equal(vm.runInContext('guildWorldClick(1100,2390)',h),true);
 assert.equal(h.traveled,0);assert.deepEqual(plain(vm.runInContext('expeditionSpawn',h)),{zone:0,x:8400,y:2695});
});
test('Guild entry/exit reject a dead hero or an ongoing Tide battle',()=>{
 const h=travelHarness();h.hero.dead=true;assert.equal(vm.runInContext('enterTideGuild()',h),false);
 h.hero.dead=false;h.TideUI.isBattling=()=>true;assert.equal(vm.runInContext('enterTideGuild()',h),false);
 h.S.zone=1;h.world.exit={x:8400,y:2690};assert.equal(vm.runInContext('leaveTideGuild()',h),false);
});
test('Random guild trainers span all supported playable looks without changing player equipment',()=>{
 const races=['human','orc','dwarf','undead'],classes=['warrior','mage','hunter','priest'],enchants=['emberbite','frostgrip','veinseeker','stormetch','goldrune'];
 let seed=317;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const c=vm.createContext({RACES:races.map(id=>({id})),CLASSES:classes.map(id=>({id})),WENCH:enchants.map(id=>({id})),rng,S:{gear:{weapon:{legend:'rimfrost'}}}});
 vm.runInContext(section('function createGuildTrainer(','function drawGuildTrainer('),c);
 const before=JSON.stringify(c.S),seen={race:new Set(),cls:new Set(),fem:new Set(),w:new Set(),wench:new Set(),ice:new Set(),ring:new Set()};
 for(let i=0;i<1000;i++){
  const look=vm.runInContext('createGuildTrainer(rng)',c);
  assert(races.includes(look.race));assert(classes.includes(look.cls));assert([null,'rimfrost','felglaives'].includes(look.w));
  assert([null,...enchants].includes(look.wench));assert(look.name.length>4);
  for(const k of Object.keys(seen))seen[k].add(look[k]);
 }
 assert.deepEqual(Object.fromEntries(Object.entries(seen).map(([k,v])=>[k,v.size])),{race:4,cls:4,fem:2,w:3,wench:6,ice:2,ring:2});
 assert.equal(JSON.stringify(c.S),before);
});
