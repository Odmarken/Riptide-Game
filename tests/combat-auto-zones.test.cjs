const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function harness(){
 const c={S:{auto:true,zone:0,pots:{hp:1,mp:1}},saves:0,warnings:0,casts:0,potions:0,gameOn:true,
  hero:{hp:10,mana:1,potCd:{hp:0,mp:0},target:{boss:true}},enemies:[],
  Math,stageMsg(){},save(){c.saves++;},sfx:{warn(){c.warnings++;}},updateMountButton(){},
  classOf:()=>({spells:[{t:'st'}]}),heroMax:()=>100,spellManaCost:()=>10,autoOn:()=>true,
  usePot:()=>c.potions++,cast:()=>c.casts++,TideUI:{tick(){throw new Error('simulation checkpoint');}},
  mp:{on:false,started:false},mpLeave(){},dropFarmBuild(){}};
 const nodes=new Map();
 c.$=id=>{
  if(!nodes.has(id)){
   const classes=new Set();
   nodes.set(id,{id,style:{},hidden:false,disabled:false,parentElement:{style:{}},attributes:{},
    setAttribute(k,v){this.attributes[k]=v;},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n);}}});
  }
  return nodes.get(id);
 };
 vm.createContext(c);
 vm.runInContext(section('const ZONES=[','const TAVERN_ZONE='),c);
 vm.runInContext('let autoCfgMode=true;const zoneOf=()=>ZONES[S.zone];this.zones=ZONES;',c);
 vm.runInContext(section('let autoT=0;','function update(dt)'),c);
 vm.runInContext(section('function update(dt){','/* ==================== DRAW ==================== */'),c);
 vm.runInContext(section('function applyZoneUI(){','/* keep the open side panel live'),c);
 vm.runInContext(section("$('skAutoCfg').onclick=()=>{"," autoCfgMode=false;\n $('skillbar').classList.remove('autocfg');"),c);
 c.renderHUD=()=>c.refreshCombatAutoControls();
 vm.runInContext("$('autoBtn').onclick=toggleCombatAuto;",c);
 return c;
}

test('dungeons, the Crypts, the raid and the Final Hour block AUTO; leveling bosses, Odin and Thor keep it',()=>{
 const c=harness(),blocked=[...c.zones].filter(z=>!c.combatAutoAllowed(z)).map(z=>z.name);
 assert.deepEqual(blocked,['Violet Halls','The Crypts','The Final Hour','Briarhollow','Cindervein','Frostveil']);
 for(const name of ['Hollowroot Den','Grimwater Cavern','The Sunken Crypt','Pyre of the Old Gate','Emberdeep Keep','Gates of the Viking','Halls of Valhalla','Cow Level','Willowmere Fields','Wasteland','City','Farm','Moonshine']){
  assert.equal(c.combatAutoAllowed(c.zones.find(z=>z.name===name)),true,name);
 }
});

test('zone entry clears saved AUTO and hides both controls; leaving does not silently reenable it',()=>{
 const c=harness();c.S.zone=c.zones.findIndex(z=>z.dungeon==='cindervein');c.$('skillbar').classList.add('autocfg');
 c.applyZoneUI();
 assert.equal(c.S.auto,false);assert.equal(vm.runInContext('autoCfgMode',c),false);assert.equal(c.$('skillbar').classList.contains('autocfg'),false);
 for(const id of ['autoBtn','skAutoCfg']){assert.equal(c.$(id).hidden,true);assert.equal(c.$(id).disabled,true);assert.equal(c.$(id).style.display,'none');}
 c.S.zone=0;c.applyZoneUI();assert.equal(c.S.auto,false);
 for(const id of ['autoBtn','skAutoCfg']){assert.equal(c.$(id).hidden,false);assert.equal(c.$(id).disabled,false);assert.equal(c.$(id).style.display,'');}
 assert.equal(c.$('autoBtn').attributes['aria-pressed'],'false');
});

test('direct activation cannot bypass the dungeon restriction or open AUTO configuration',()=>{
 const c=harness();c.S.zone=c.zones.findIndex(z=>z.raid);
 c.$('autoBtn').onclick();assert.equal(c.S.auto,false);assert.equal(c.warnings,1);assert.equal(c.saves,1);
 c.$('skAutoCfg').onclick();assert.equal(vm.runInContext('autoCfgMode',c),false);
 assert.equal(c.$('skAutoCfg').disabled,true);
});

test('simulation rejects a restored AUTO flag before movement, target selection or spell execution',()=>{
 const c=harness();
 for(let i=0;i<c.zones.length;i++)if(!c.combatAutoAllowed(c.zones[i])){
  c.S.zone=i;c.S.auto=true;
  assert.throws(()=>c.update(.016),/simulation checkpoint/);
  assert.equal(c.S.auto,false,c.zones[i].name);assert.equal(c.casts,0);assert.equal(c.potions,0);
 }
});

test('autoBrain cannot cast or spend potions in any blocked zone, even called directly',()=>{
 const c=harness();
 for(let i=0;i<c.zones.length;i++)if(!c.combatAutoAllowed(c.zones[i])){
  c.S.zone=i;c.S.auto=true;c.autoBrain(1);
  assert.equal(c.S.auto,false,c.zones[i].name);assert.equal(c.casts,0);assert.equal(c.potions,0);
 }
});

test('leveling bosses, Odin, Thor and ordinary zones retain explicit AUTO toggles and automatic skills/potions',()=>{
 for(const name of ['Hollowroot Den','Emberdeep Keep','Gates of the Viking','Halls of Valhalla','Cow Level','Willowmere Fields']){
  const c=harness();c.S.zone=c.zones.findIndex(z=>z.name===name);c.S.auto=false;c.applyZoneUI();
  c.$('autoBtn').onclick();assert.equal(c.S.auto,true,name);assert.equal(c.$('autoBtn').hidden,false);assert.equal(c.$('skAutoCfg').disabled,false);
  c.autoBrain(1);assert.equal(c.casts,1,name);assert.equal(c.potions,2,name);
  c.$('autoBtn').onclick();assert.equal(c.S.auto,false,name);c.autoBrain(1);assert.equal(c.casts,1);
 }
});
