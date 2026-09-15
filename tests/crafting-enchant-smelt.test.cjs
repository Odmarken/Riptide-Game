const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function harness(){
 const c={now:1000000,saves:0,roll:.01,S:{gold:200000,ench:{trained:true,skill:0,bag:[]},ore:{ore:6,coal:2,gem:4},gear:{weapon:{name:'Iron Sword'}}}};
 const nodes=new Map();
 function element(id=''){
  const classes=new Set(),e={id,style:{setProperty(k,v){this[k]=v;}},dataset:{},attributes:{},textContent:'',hidden:false,disabled:false,
   classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,on){if(on)classes.add(k);else classes.delete(k);}},
   focus(){c.focused=this;},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},querySelector(){return this.fill||(this.fill=element());},querySelectorAll(){return this.buttons||[];}};
  Object.defineProperty(e,'innerHTML',{get(){return this.html||'';},set(html){
   this.html=html;this.buttons=[];
   for(const match of html.matchAll(/<button\b([^>]*)>/g)){
    const attrs=match[1],button=element((/\bid="([^"]+)"/.exec(attrs)||[])[1]);
    button.disabled=/\bdisabled(?:\s|$)/.test(attrs);
    const pick=/data-ei="([^"]+)"/.exec(attrs);if(pick)button.dataset.ei=pick[1];
    if(button.id)nodes.set(button.id,button);this.buttons.push(button);
   }
  }});
  return e;
 }
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 Object.assign(c,{Math:Object.assign(Object.create(Math),{random:()=>c.roll}),Date:{now:()=>c.now},document:{querySelectorAll:()=>c.$('enchBody').querySelectorAll().filter(b=>b.dataset.ei)},
  uiIcon:(file)=>'<img src="assets/icons/'+file+'.png" alt="">',esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),itemName:item=>item.name,
  save:()=>c.saves++,renderBag(){},renderHero(){},renderHUD(){},stageMsg(){},log(){},sfx:{warn(){},loot(){},quest(){},buy(){}},
  totalGold:()=>c.S.gold,spendGold:n=>{if(c.S.gold<n)return false;c.S.gold-=n;return true;},setTimeout:()=>1,clearTimeout(){}});
 vm.createContext(c);
 vm.runInContext(section('const MINE_RANKS=[','const mineSkill='),c);
 vm.runInContext(section('const ENCH_RANKS=','const CITY_NAMES='),c);
 vm.runInContext(section("$('smeltGo').onclick=()=>{","setInterval(()=>{if($('smithFx')"),c);
 return c;
}

test('enchanting keeps the learn fee and presents locked, empty and missing-weapon states',()=>{
 const c=harness();c.S.ench={trained:false,skill:0,bag:[]};c.S.gold=199999;c.enchRefresh();
 assert.equal(c.$('enchLearn').disabled,true);assert.match(c.$('enchBody').innerHTML,/200[,\s]000 gold/);
 c.S.gold=200000;c.enchRefresh();c.$('enchLearn').onclick();
 assert.equal(c.S.gold,0);assert.equal(c.S.ench.trained,true);assert.equal(c.S.ench.skill,0);
 assert.match(c.$('enchBody').innerHTML,/collection is empty/);assert.equal(c.$('enchApplyBtn').disabled,true);
 c.S.ench.bag=['emberbite'];c.S.gear.weapon=null;vm.runInContext("enchPick='emberbite'",c);c.enchRefresh();
 assert.match(c.$('enchBody').innerHTML,/No weapon equipped/);assert.equal(c.$('enchApplyBtn').disabled,true);
 c.enchApply('emberbite');assert.equal(c.S.ench.bag.length,1);
});

test('cutting keeps the random pool, two-emerald cost, two skill points, ceremony and durable rune result',()=>{
 for(const [roll,id]of [[0,'emberbite'],[.25,'frostgrip'],[.45,'veinseeker'],[.65,'stormetch'],[.99,'goldrune']]){
  const c=harness();c.roll=roll;c.enchRefresh();c.$('enchCutBtn').onclick();
  assert.equal(c.S.ore.gem,2);assert.deepEqual([...c.S.ench.bag],[id]);assert.equal(c.S.ench.skill,2);
  assert.equal(c.$('enchCraftFx').classList.contains('open'),true);c.enchCeremonyEnd();
  assert.match(c.$('enchBody').innerHTML,/Last rune cut/);assert.match(c.$('enchBody').innerHTML,/added to your runes/);
  assert.equal(c.$('enchApplyBtn').disabled,false);assert.equal(c.S.ench.lastCut,undefined);
 }
 const c=harness();c.S.ore.gem=1;c.enchRefresh();assert.equal(c.$('enchCutBtn').disabled,true);c.enchCut();assert.equal(c.S.ore.gem,1);assert.equal(c.S.ench.bag.length,0);
});

test('binding previews replacement and consumes one selected rune without changing weapon stats',()=>{
 const c=harness();c.S.ench.bag=['emberbite','frostgrip','frostgrip'];c.S.gear.weapon={name:'Iron Sword',wench:'emberbite',atk:17};
 c.enchRefresh();const pick=c.$('enchBody').querySelectorAll().find(b=>b.dataset.ei==='frostgrip');pick.onclick();
 assert.equal(c.focused.dataset.ei,'frostgrip');
 assert.match(c.$('enchBody').innerHTML,/Replaces Emberbite/);assert.match(c.$('enchBody').innerHTML,/current rune will be lost/);
 c.$('enchApplyBtn').onclick();
 assert.equal(c.S.gear.weapon.wench,'frostgrip');assert.equal(c.S.gear.weapon.atk,17);assert.deepEqual([...c.S.ench.bag],['emberbite','frostgrip']);
 assert.match(c.$('enchBody').innerHTML,/Frostgrip bound to Iron Sword/);assert.equal(c.$('enchApplyBtn').disabled,false);
 c.$('enchApplyBtn').onclick();assert.deepEqual([...c.S.ench.bag],['emberbite']);assert.equal(c.$('enchApplyBtn').disabled,true);
});

test('smelting consumes three ore and one coal, runs for five minutes and automatically awards exactly one emerald',()=>{
 const c=harness();c.smeltRefresh();assert.match(c.$('smSlotOre').innerHTML,/3 Emerald Ore/);assert.match(c.$('smeltResultNote').textContent,/4 emeralds in your bag/);
 c.$('smeltGo').onclick();assert.deepEqual(c.S.ore,{ore:3,coal:1,gem:4});assert.equal(c.S.smelt.done,c.now+300000);assert.equal(c.$('smeltGo').disabled,true);
 const deadline=c.S.smelt.done;c.$('smeltGo').onclick();assert.equal(c.S.smelt.done,deadline);assert.equal(c.S.ore.ore,3);
 c.now+=150000;c.smeltRefresh();assert.match(c.$('smeltCount').textContent,/2:30/);assert.equal(c.$('smeltProgress').querySelector('i').style.width,'50%');assert.equal(c.smeltTick(),false);
 c.now=deadline-1;assert.equal(c.smeltTick(),false);c.now=deadline;assert.equal(c.smeltTick(),true);assert.equal(c.smeltTick(),false);
 assert.equal(c.S.ore.gem,5);assert.equal(c.S.smelt,null);c.smeltRefresh();assert.equal(c.$('smeltResultTitle').textContent,'Emerald smelted');assert.match(c.$('smeltResultNote').textContent,/Added automatically/);
 c.openSmelter();assert.equal(c.$('smeltResultTitle').textContent,'Emerald smelted');assert.equal(c.$('smeltGo').disabled,false);
 c.$('smeltGo').onclick();assert.equal(c.$('smeltResultTitle').textContent,'One emerald is forming');assert.deepEqual(c.S.ore,{ore:0,coal:0,gem:5});
 c.now+=300000;c.smeltTick();c.smeltRefresh();assert.equal(c.S.ore.gem,6);assert.equal(c.$('smeltGo').disabled,true);
});

test('craft result feedback is not saved or shown for a different character',()=>{
 const c=harness();c.enchCut();c.$('smeltGo').onclick();c.now+=300000;c.smeltTick();
 c.S=JSON.parse(JSON.stringify(c.S));c.enchRefresh();c.smeltRefresh();
 assert.doesNotMatch(c.$('enchBody').innerHTML,/Last rune cut|added to your runes/);assert.equal(c.$('smeltResultTitle').textContent,'1 Emerald');
 assert.deepEqual(Object.keys(c.S.ench).sort(),['bag','skill','trained']);assert.equal(c.S.smelt,null);
});
