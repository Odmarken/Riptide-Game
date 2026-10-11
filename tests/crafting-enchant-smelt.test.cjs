const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const plain=v=>JSON.parse(JSON.stringify(v));
const BOOK={id:'book-of-knowledge',kind:'knowledge',slot:'knowledge',name:'Book of Knowledge',rar:'legendary',sell:0,power:0,sourceBoss:'A & B',sourceDungeon:'briarhollow'};
function harness(){
 const c={now:1000000,saves:0,roll:.01,S:{gold:200000,ench:{trained:true,skill:0},ore:{ore:6,coal:2,gem:4},gear:{weapon:{name:'Iron Sword'}},bag:[]}};
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
    const pick=/data-ii="([^"]+)"/.exec(attrs);if(pick)button.dataset.ii=pick[1];
    if(button.id)nodes.set(button.id,button);this.buttons.push(button);
   }
  }});
  return e;
 }
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 Object.assign(c,{Math:Object.assign(Object.create(Math),{random:()=>c.roll}),Date:{now:()=>c.now},document:{querySelectorAll:()=>c.$('enchBody').querySelectorAll().filter(b=>b.dataset.ii)},
  uiIcon:(file)=>'<img src="assets/icons/'+file+'.png" alt="">',esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),itemName:item=>item.name,
  save:()=>c.saves++,renderBag(){},renderHero(){},renderHUD(){},stageMsg(){},log(){},sfx:{warn(){},loot(){},quest(){},buy(){}},
  totalGold:()=>c.S.gold,spendGold:n=>{if(c.S.gold<n)return false;c.S.gold-=n;return true;},setTimeout:()=>1,clearTimeout(){}});
 vm.createContext(c);
 vm.runInContext(section('const isKnowledgeBook=','/* 💍 The Ring is being forged'),c);   /* the hall counts the books in the bag */
 vm.runInContext(section('const MINE_RANKS=[','const mineSkill='),c);
 vm.runInContext(section('const ENCH_RANKS=','const CITY_NAMES='),c);
 vm.runInContext(section("$('smeltGo').onclick=()=>{","setInterval(()=>{if($('smithFx')"),c);
 return c;
}

test('enchanting keeps the learn fee and presents locked, empty and missing-weapon states',()=>{
 const c=harness();c.S.ench={trained:false,skill:0};c.S.gold=199999;c.enchRefresh();
 assert.equal(c.$('enchLearn').disabled,true);assert.match(c.$('enchBody').innerHTML,/200[,\s]000 gold/);
 assert.match(c.$('enchBody').innerHTML,/a Book of Knowledge from the Wasteland guardians and 2 emeralds into a random enchant/);
 c.S.gold=200000;c.enchRefresh();c.$('enchLearn').onclick();
 assert.equal(c.S.gold,0);assert.deepEqual(plain(c.S.ench),{trained:true,skill:0,insc:[]});
 assert.match(c.$('enchBody').innerHTML,/no enchants yet/);assert.equal(c.$('enchBindBtn').disabled,true);
 c.S.ench.insc=[{id:'orb',rar:'rare'}];c.S.gear.weapon=null;vm.runInContext("inscPick='orb:rare'",c);c.enchRefresh();
 assert.match(c.$('enchBody').innerHTML,/No weapon equipped/);assert.equal(c.$('enchBindBtn').disabled,true);
 c.enchBind('orb:rare');assert.equal(c.S.ench.insc.length,1);
});

test('an enchant takes one book and two emeralds, rolls one of the five, teaches seven points and plays the ceremony',()=>{
 for(const [roll,id,name,rar] of [[0,'twin','Goldrune','common'],[.25,'keen','Frostgrip','common'],[.45,'orb','Stormetch','common'],[.65,'leech','Veinseeker','common'],[.99,'swift','Emberbite','rare']]){
  const c=harness();c.roll=roll;c.S.bag=[{...BOOK},{...BOOK}];c.enchRefresh();
  assert.equal(c.$('enchMakeBtn').disabled,false);c.$('enchMakeBtn').onclick();
  assert.equal(c.S.ore.gem,2);assert.equal(c.S.bag.length,1);assert.deepEqual(plain(c.S.ench.insc),[{id,rar}]);assert.equal(c.S.ench.skill,7);
  assert.equal(c.$('enchCraftFx').classList.contains('open'),true);assert.match(c.$('ecStage').innerHTML,new RegExp(name));c.enchCeremonyEnd();
  const html=c.$('enchBody').innerHTML;assert.match(html,/Last enchant/);assert.match(html,new RegExp(name+' added to your enchants'));
  assert.equal(c.$('enchBindBtn').disabled,false,'the new enchant comes pre-selected');assert.equal(c.S.ench.lastCut,undefined);
 }
 const c=harness();c.enchRefresh();assert.equal(c.$('enchMakeBtn').disabled,true);assert.match(c.$('enchBody').innerHTML,/You need a Book of Knowledge\./);
 assert.match(c.$('enchBody').innerHTML,/Clear a Wasteland dungeon/);
 c.enchMake();assert.equal(c.S.ore.gem,4);assert.equal(c.S.ench.insc,undefined,'no book, no enchant - and no emeralds spent');
 c.S.bag=[{...BOOK}];c.S.ore.gem=1;c.enchRefresh();assert.equal(c.$('enchMakeBtn').disabled,true);assert.match(c.$('enchBody').innerHTML,/You need 1 more emerald\./);
 c.enchMake();assert.equal(c.S.bag.length,1,'no emeralds, no enchant - and the book stays');assert.equal(c.S.ore.gem,1);
 c.S.bag=[];c.S.ore.gem=0;c.enchRefresh();assert.match(c.$('enchBody').innerHTML,/You need a Book of Knowledge and 2 more emeralds\./);
});

test('binding writes the enchant and its look onto the worn weapon together, replacing the old one and nothing else',()=>{
 const c=harness();c.S.ench.insc=[{id:'keen',rar:'rare'},{id:'keen',rar:'rare'},{id:'leech',rar:'epic'}];
 c.S.gear.weapon={name:'Iron Sword',wench:'emberbite',insc:{id:'swift',rar:'common'},atk:17};
 c.enchRefresh();const cells=c.$('enchBody').querySelectorAll().filter(b=>b.dataset.ii);
 assert.deepEqual(cells.map(b=>b.dataset.ii),['leech:epic','keen:rare'],'rarest first');
 cells[1].onclick();assert.equal(c.focused.dataset.ii,'keen:rare');
 assert.match(c.$('enchBody').innerHTML,/Replaces Common Emberbite: \+1% attack speed\. The current enchant will be lost/);
 c.$('enchBindBtn').onclick();
 assert.deepEqual(plain(c.S.gear.weapon),{name:'Iron Sword',wench:'frostgrip',insc:{id:'keen',rar:'rare'},atk:17});
 assert.deepEqual(plain(c.S.ench.insc),[{id:'keen',rar:'rare'},{id:'leech',rar:'epic'}]);
 assert.match(c.$('enchBody').innerHTML,/Rare Frostgrip bound to Iron Sword; Common Emberbite replaced\./);assert.equal(c.$('enchBindBtn').disabled,false);
 c.$('enchBindBtn').onclick();assert.deepEqual(plain(c.S.ench.insc),[{id:'leech',rar:'epic'}]);assert.equal(c.$('enchBindBtn').disabled,true);
});

test('each of the five enchants wears a rune of its own, under that rune\'s name and icon',()=>{
 const c=harness(),runes=plain(vm.runInContext('WENCH',c)),five=plain(vm.runInContext('INSC.map(e=>({id:e.id,rune:e.rune,n:e.n,icon:e.icon}))',c));
 assert.deepEqual(five.map(e=>e.id),['twin','keen','orb','leech','swift']);
 assert.deepEqual(five.map(e=>e.rune).sort(),runes.map(r=>r.id).sort(),'every rune is worn, and by one enchant only');
 for(const e of five){const r=runes.find(x=>x.id===e.rune);assert.deepEqual([e.n,e.icon],[r.n,r.icon],e.id);}
 assert.equal(runes.find(r=>r.id==='stormetch').glow,'#b98cff','the orb\'s own violet');assert.match(source,/const TWIN_DELAY_MS=140,ORB_C='#b98cff';/);
});

test('the runes go back into emeralds once, and every enchanted weapon wears its enchant\'s look',()=>{
 const c=harness();
 const s={ench:{trained:true,skill:40,bag:['emberbite','frostgrip','nonesuch']},ore:{ore:0,coal:0,gem:1},
  gear:{weapon:{slot:'weapon',name:'Worn',wench:'goldrune',insc:{id:'orb',rar:'epic'}},armor:{slot:'armor',name:'Coat'},trinket:null},
  bag:[{slot:'weapon',name:'Glow only',wench:'veinseeker'},{slot:'weapon',name:'Enchanted, no look',insc:{id:'leech',rar:'fine'}},
   {slot:'weapon',name:'Newer',insc:{id:'thunder',rar:'epic'},wench:'stormetch'},{slot:'weapon',name:'Plain'},{...BOOK}]};
 assert.equal(c.enchMeltRunes(s),3,'two runes in the hall (one this build never heard of is no rune) and one bound on its own');
 assert.equal(s.ore.gem,7);assert.equal(s.ench.melted,3);assert.equal('bag' in s.ench,false);
 assert.equal(s.gear.weapon.wench,'stormetch','an enchant wears its own look');assert.equal('wench' in s.gear.armor,false);
 assert.equal('wench' in s.bag[0],false);assert.equal(s.bag[1].wench,'veinseeker');
 assert.equal(s.bag[2].wench,'stormetch','a newer build\'s enchant keeps the look it gave');assert.equal('wench' in s.bag[3],false);
 const before=JSON.stringify(s);assert.equal(c.enchMeltRunes(s),0);assert.equal(JSON.stringify(s),before,'a second load changes nothing');
 const none={ench:{trained:false,skill:0},ore:{coal:0,ore:0,gem:0},gear:{weapon:null},bag:[]};
 assert.equal(c.enchMeltRunes(none),0);assert.deepEqual(plain(none),{ench:{trained:false,skill:0},ore:{coal:0,ore:0,gem:0},gear:{weapon:null},bag:[]});
});

test('every load melts after the enchants are cleaned, and the hero hears it once on the way in',()=>{
 const mig=section('function migrate(s){','/* the road east is open');
 assert.ok(mig.indexOf('enchMeltRunes(s);')>mig.indexOf('s.bag.forEach(it=>{delete it._lid;'),'after fixInsc has cleaned the bag');
 assert.doesNotMatch(mig,/ench\.bag/);
 assert.match(section('function beginGame(isNew){','/* Effects were written as'),/Welcome back[\s\S]*enchMeltNotice\(\)/);
 const c=harness(),logs=[];c.log=t=>logs.push(t);c.S.ench.melted=3;c.enchMeltNotice();
 assert.equal(logs.length,1);assert.match(logs[0],/Your 3 runes went back into 6 emeralds/);assert.equal('melted' in c.S.ench,false);assert.equal(c.saves,1);
 c.enchMeltNotice();assert.equal(logs.length,1);assert.equal(c.saves,1);
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
 const c=harness();c.S.bag=[{...BOOK}];c.enchMake();c.$('smeltGo').onclick();c.now+=300000;c.smeltTick();
 c.S=JSON.parse(JSON.stringify(c.S));c.enchRefresh();c.smeltRefresh();
 assert.doesNotMatch(c.$('enchBody').innerHTML,/Last enchant|added to your enchants/);assert.equal(c.$('smeltResultTitle').textContent,'1 Emerald');
 assert.deepEqual(Object.keys(c.S.ench).sort(),['insc','skill','trained']);assert.equal(c.S.smelt,null);
});
