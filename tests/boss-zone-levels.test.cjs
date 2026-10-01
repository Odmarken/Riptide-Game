/* Run with: node --test tests/boss-zone-levels.test.cjs
 * 2026-10-01: every leveling boss stands at the level of the zone after him (Hollowroot Den 10 -> Ironcrag Pass 10, Grimwater
 * Cavern 20 -> Ashen Moor 20, The Sunken Crypt 30 -> Frostspire Heights 30, Pyre of the Old Gate 45 -> Stormreach Coast 45), so
 * the level that lets you in is the level that lets you on: he falls and Continue opens at once. He still has to fall first, and
 * the zone before him, entered at its own level, can still climb all the way to his inside the per-zone level cap.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'cannot find '+start);return source.slice(a,b);};
function box(){
 const c={S:{zone:0,lvl:1,xp:0,cleared:{},bossDead:{},zoneLvlGain:{},prestige:0},Math,hero:null,stageMsg(){},log(){},sfx:{level(){}},
  pRew:()=>1,farmBonus:()=>0};
 vm.createContext(c);
 vm.runInContext(section('const MAXLVL=','\n'),c);
 vm.runInContext(section('const ZONES=[','const TAVERN_ZONE='),c);
 vm.runInContext(section('const expeditionZone=','\n'),c);
 vm.runInContext(section('const bossesClearedBefore=','\n'),c);
 vm.runInContext(section('const xpBoost=','\n'),c);
 vm.runInContext(section('const xpNeed=','\n'),c);
 vm.runInContext(section('function portalIsOpen(){','\n}\n')+'\n}\n',c);
 vm.runInContext(section('const ZONE_LVL_CAP=','function heroDies(){'),c);
 vm.runInContext('const zoneOf=()=>ZONES[S.zone];this.zones=ZONES;this.cap=ZONE_LVL_CAP;this.portalIsOpen=portalIsOpen;this.gainXP=gainXP;',c);
 return c;
}
const leveling=c=>[...c.zones.slice(0,c.zones.findIndex(z=>z.special))];

test('every leveling boss has the level of the zone after him',()=>{
 const c=box(),road=leveling(c);
 const bosses=road.map((z,i)=>[z,road[i+1]]).filter(([z,next])=>z.boss&&next).map(([z,next])=>[z.name,z.lvl,next.name,next.lvl]);
 assert.deepEqual(bosses,[
  ['Hollowroot Den',10,'Ironcrag Pass',10],
  ['Grimwater Cavern',20,'Ashen Moor',20],
  ['The Sunken Crypt',30,'Frostspire Heights',30],
  ['Pyre of the Old Gate',45,'Stormreach Coast',45]]);
 assert.equal(road.at(-1).name,'Emberdeep Keep');
 assert.equal(road.at(-1).lvl,60,'Krev at the end of the road stays level 60');
});

test('the boss has to fall before Continue opens, and then it opens at once',()=>{
 const c=box(),road=leveling(c);
 for(const [i,z] of road.entries()){
  if(!z.boss||!road[i+1])continue;
  c.S.zone=i;c.S.lvl=z.lvl;c.S.cleared={};c.S.bossDead={};
  road.forEach((y,k)=>{if(k<i){c.S.cleared[k]=true;if(y.boss)c.S.bossDead[k]=true;}});
  assert.equal(c.portalIsOpen(),false,z.name+': the gate stays shut while he lives');
  c.S.cleared[i]=true;c.S.bossDead[i]=true;
  assert.equal(c.portalIsOpen(),true,z.name+': he falls at his own level and the road east opens');
 }
});

test('the zone before each boss, entered at its own level, can still climb to his inside the level cap',()=>{
 const c=box(),road=leveling(c);
 assert.equal(c.cap,5);
 for(const [i,z] of road.entries()){
  const next=road[i+1];
  if(!next||!next.boss)continue;
  c.S.zone=i;c.S.lvl=z.lvl;c.S.xp=0;c.S.zoneLvlGain={};c.S.cleared={[i]:true};c.S.bossDead={};
  road.forEach((y,k)=>{if(k<i&&y.boss)c.S.bossDead[k]=true;});
  for(let n=0;n<400&&c.S.lvl<next.lvl;n++)c.gainXP(5000);
  assert.equal(c.S.lvl,next.lvl,z.name+' (level '+z.lvl+') reaches '+next.name+' (level '+next.lvl+')');
  assert.equal(c.portalIsOpen(),true,z.name+': the road to '+next.name+' opens');
 }
});
