/* 📖 Books of Knowledge read into weapon inscriptions: odds, the hall, combat, bag safety and the leaderboard.
   Every block below runs the real game.js code, cut out by its markers, against small stubs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Cannot locate production section: '+start);return source.slice(a,b);
}
const plain=v=>JSON.parse(JSON.stringify(v));
const BOOK={id:'book-of-knowledge',kind:'knowledge',slot:'knowledge',name:'Book of Knowledge',rar:'legendary',sell:0,power:0,sourceBoss:'A & B',sourceDungeon:'briarhollow'};
const HELPERS=[
 section('const isKnowledgeBook=','/* 💍 The Ring is being forged'),
 section('const MINE_RANKS=[','const mineSkill='),
 'const ENCH_RANKS=MINE_RANKS;',
 section('const INSC_RARS=','function enchGain(')
].join('\n');
/* a script's top-level const is not a property of its context - lift the ones the tests call */
const LIFT='Object.assign(globalThis,{inscVal,inscOk,inscClean,inscLine,wornInsc,bestInsc,inscById});';
function helpers(S={}){const c={S,Math};vm.createContext(c);vm.runInContext(HELPERS+'\n'+LIFT,c);return c;}

/* ---------------- the odds and the roll ---------------- */
test('every rank row is a full hundred and the odds are a full one at every skill',()=>{
 const c=helpers();
 for(const row of vm.runInContext('INSC_ODDS',c))for(const w of [row.from,row.to])assert.equal(w.reduce((a,b)=>a+b,0),100);
 for(let s=0;s<=500;s++){const o=c.inscOdds(s);assert.equal(o.length,5);assert.ok(Math.abs(o.reduce((a,b)=>a+b,0)-1)<1e-9,'skill '+s);assert.ok(o.every(x=>x>=0));}
 assert.deepEqual(plain(c.inscOdds(0).map(x=>Math.round(x*100))),[70,25,5,0,0]);
 assert.deepEqual(plain(c.inscOdds(500).map(x=>Math.round(x*100))),[10,25,33,22,10]);
 assert.deepEqual(c.inscOdds(-40),c.inscOdds(0));assert.deepEqual(c.inscOdds(9999),c.inscOdds(500));assert.deepEqual(c.inscOdds('x'),c.inscOdds(0));
});
test('each rank opens one rarity and more skill never makes the roll worse',()=>{
 const c=helpers();
 for(let s=0;s<50;s++)assert.equal(c.inscOdds(s)[3],0,'no epic for an Apprentice at '+s);
 for(let s=0;s<125;s++)assert.equal(c.inscOdds(s)[4],0,'no legendary before Expert at '+s);
 assert.ok(c.inscOdds(50)[3]>0,'a Journeyman can read an epic line');assert.ok(c.inscOdds(125)[4]>0,'an Expert can read a legendary one');
 for(let s=1;s<=500;s++){
  const a=c.inscOdds(s-1),b=c.inscOdds(s);
  assert.ok(b[0]<=a[0]+1e-12,'common never grows at '+s);
  assert.ok(b[3]>=a[3]-1e-12&&b[4]>=a[4]-1e-12,'epic and legendary never shrink at '+s);
 }
});
test('the roll maps its two numbers onto a rarity and a kind, and never onto a rarity the skill cannot reach',()=>{
 const c=helpers();
 assert.deepEqual(plain(c.inscRoll(0,0,0)),{id:'twin',rar:'common'});
 assert.deepEqual(plain(c.inscRoll(0,.94,.2)),{id:'keen',rar:'fine'});
 assert.deepEqual(plain(c.inscRoll(0,.96,.99)),{id:'swift',rar:'rare'});
 assert.deepEqual(plain(c.inscRoll(500,.95,.5)),{id:'orb',rar:'legendary'});
 assert.deepEqual(plain(c.inscRoll(500,.8,.7)),{id:'leech',rar:'epic'});
 for(const s of [0,1,49])assert.equal(c.inscRoll(s,1-1e-15,.5).rar,'rare','float dust at the top stays inside what the skill reaches');
 assert.equal(c.inscRoll(124,1-1e-15,.5).rar,'epic');
 const seen=new Set();for(let i=0;i<20000;i++)seen.add(c.inscRoll(0).rar);assert.deepEqual([...seen].sort(),['common','fine','rare']);
 const master=new Set(),kinds=new Set();for(let i=0;i<20000;i++){const r=c.inscRoll(500);master.add(r.rar);kinds.add(r.id);}
 assert.equal(master.size,5);assert.deepEqual([...kinds].sort(),['keen','leech','orb','swift','twin']);
});
test('values, cleaning and the worn weapon: only a well-formed inscription on the worn weapon counts',()=>{
 const S={gear:{weapon:{name:'Blade',insc:{id:'keen',rar:'legendary'}}},bag:[{slot:'weapon',insc:{id:'twin',rar:'legendary'}}]},c=helpers(S);
 assert.equal(c.inscVal({id:'keen',rar:'common'}),0.5);assert.equal(c.inscVal({id:'twin',rar:'legendary'}),8);assert.equal(c.inscVal({id:'leech',rar:'rare'}),1.5);
 assert.equal(c.wornInsc('keen'),5);assert.equal(c.wornInsc('twin'),0,'a weapon in the bag does nothing');
 S.gear.weapon.insc={id:'keen',rar:'mythic'};assert.equal(c.wornInsc('keen'),0);S.gear.weapon=null;assert.equal(c.wornInsc('keen'),0);
 for(const bad of [null,'twin',7,[],{id:'twin'},{id:4,rar:'epic'},{id:'twin',rar:{}},{id:'x'.repeat(40),rar:'epic'}])assert.equal(c.inscClean(bad),null,JSON.stringify(bad));
 assert.deepEqual(plain(c.inscClean({id:'twin',rar:'epic',atk:9999,__proto__x:1})),{id:'twin',rar:'epic'});
 assert.deepEqual(plain(c.inscClean({id:'thunder',rar:'epic'})),{id:'thunder',rar:'epic'},'a newer build\'s kind is kept for that build');
 assert.equal(c.inscOk({id:'thunder',rar:'epic'}),false);assert.equal(c.inscVal({id:'thunder',rar:'epic'}),0);
 assert.equal(c.inscLine({id:'orb',rar:'epic'}),'Epic Arcane Orb: 5% chance to hurl an arcane orb');
});
test('the star forge carries the rarest inscription, and a known kind beats one this build cannot read',()=>{
 const c=helpers();
 assert.equal(c.bestInsc([{},null,{insc:'junk'}]),null);
 assert.deepEqual(plain(c.bestInsc([{insc:{id:'twin',rar:'fine'}},{insc:{id:'orb',rar:'epic'}},{insc:{id:'keen',rar:'rare'}}])),{id:'orb',rar:'epic'});
 assert.deepEqual(plain(c.bestInsc([{insc:{id:'thunder',rar:'legendary'}},{insc:{id:'twin',rar:'common'}}])),{id:'twin',rar:'common'});
 assert.deepEqual(plain(c.bestInsc([{insc:{id:'thunder',rar:'legendary'}},{}])),{id:'thunder',rar:'legendary'});
});

test('a finished star forge writes the inscription it carried onto the new blade, and none when it carried none',()=>{
 for(const kind of ['fk','fg'])for(const carried of [{id:'twin',rar:'epic'},undefined,{id:'thunder',rar:'epic'},'junk']){
  const bag=[],c={S:{smithJob:{kind,to:2,endT:0,...(carried?{insc:carried}:{})},bag,gear:{}},Math,Date,LEGEND_MAX_UP:6,
   syncFelGlaives:it=>it,syncRimfrost:it=>it,log(){},stageMsg(){},sfx:{level(){}},smithCompleted(){},save(){},$:()=>null,publishLB(){}};
  vm.createContext(c);vm.runInContext(HELPERS+'\n'+section('function smithTick(){','setInterval(()=>{if(gameOn)smithTick();},5000);'),c);
  c.smithTick();
  assert.equal(c.S.smithJob,null);assert.equal(bag.length,1);assert.equal(bag[0].star,2);
  if(carried&&typeof carried==='object')assert.deepEqual(plain(bag[0].insc),carried,kind);else assert.equal('insc' in bag[0],false,kind+' '+carried);
 }
});

/* ---------------- the hall ---------------- */
function hall(){
 const c={now:1000000,saves:0,roll:.01,warns:0,S:{gold:0,ench:{trained:true,skill:0,bag:[]},ore:{ore:0,coal:0,gem:0},gear:{weapon:{name:'Iron Sword',atk:17}},bag:[]}};
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
    for(const [k,v] of attrs.matchAll(/data-(\w+)="([^"]+)"/g).map(m=>[m[1],m[2]]))button.dataset[k]=v;
    if(button.id)nodes.set(button.id,button);this.buttons.push(button);
   }
  }});
  return e;
 }
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 const pick=sel=>{const k=(/\[data-(\w+)\]/.exec(sel)||[])[1];return c.$('enchBody').querySelectorAll().filter(b=>b.dataset[k]!==undefined);};
 Object.assign(c,{Math:Object.assign(Object.create(Math),{random:()=>c.roll}),Date:{now:()=>c.now},document:{querySelectorAll:pick},
  uiIcon:(file)=>'<img src="assets/icons/'+file+'.png" alt="">',esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),itemName:item=>item.name,
  save:()=>c.saves++,renderBag(){},renderHero(){},renderHUD(){},stageMsg(){},log(){},sfx:{warn(){c.warns++;},loot(){},quest(){},buy(){}},
  totalGold:()=>c.S.gold,spendGold:()=>false,setTimeout:()=>1,clearTimeout(){}});
 vm.createContext(c);
 vm.runInContext(section('const isKnowledgeBook=','/* 💍 The Ring is being forged'),c);
 vm.runInContext(section('const MINE_RANKS=[','const mineSkill='),c);
 vm.runInContext(section('const ENCH_RANKS=','const CITY_NAMES='),c);
 c.cells=kind=>pick('[data-'+kind+']');
 return c;
}
const booksTab=c=>{c.enchRefresh();c.$('enchTabBooks').onclick();};
test('the hall opens on the runes and the books tab counts the books, with the odds for this skill',()=>{
 const c=hall();c.S.bag=[{slot:'weapon',name:'Spare',rar:'fine'},{...BOOK},{...BOOK}];c.enchRefresh();
 assert.match(c.$('enchBody').innerHTML,/Cut a rune/);assert.match(c.$('enchBody').innerHTML,/Books of Knowledge <b class="insc-tabcount">×2<\/b>/);
 c.$('enchTabBooks').onclick();const html=c.$('enchBody').innerHTML;
 assert.match(html,/Read a Book of Knowledge/);assert.doesNotMatch(html,/Cut a rune/);assert.equal(c.$('enchReadBtn').disabled,false);
 assert.match(html,/Your odds at skill 0/);assert.match(html,/Common <b>70%<\/b>/);assert.match(html,/Rare <b>5%<\/b>/);assert.match(html,/insc-odd none[^>]*>Legendary <b>0%<\/b>/);
 assert.match(c.$('enchGems').innerHTML,/<b>2<\/b> Books of Knowledge in your bag/);
 assert.equal(c.$('enchInscBtn').disabled,true);assert.match(html,/no inscriptions yet/);
 c.$('enchTabRunes').onclick();assert.match(c.$('enchBody').innerHTML,/Cut a rune/);assert.match(c.$('enchGems').innerHTML,/emeralds? in your bag/);
});
test('reading spends exactly one book, keeps the rest of the bag, teaches five points and shows the result',()=>{
 const c=hall(),spare={slot:'weapon',name:'Spare',rar:'fine'};c.S.bag=[spare,{...BOOK},{...BOOK,sourceDungeon:'frostveil'}];
 booksTab(c);c.$('enchReadBtn').onclick();
 assert.equal(c.S.bag.length,2);assert.equal(c.S.bag[0],spare);assert.equal(c.S.bag[1].sourceDungeon,'frostveil','the first book is the one read');
 assert.deepEqual(plain(c.S.ench.insc),[{id:'twin',rar:'common'}]);assert.equal(c.S.ench.skill,5);assert.equal(c.saves,1);
 assert.equal(c.$('enchCraftFx').classList.contains('open'),true);assert.match(c.$('ecStage').innerHTML,/Twin Strike/);assert.match(c.$('ecStage').innerHTML,/Common inscription/);
 assert.equal(c.$('ecStage').style['--ei'],'#59625a','the name is inked dark enough for the page');
 const html=c.$('enchBody').innerHTML;assert.match(html,/Last book read/);assert.match(html,/Common Twin Strike: 1% chance to strike twice/);assert.match(html,/Common Twin Strike added to your inscriptions/);
 assert.match(html,/Selected inscription<\/span>[\s\S]*Twin Strike/,'the new inscription comes pre-selected');assert.equal(c.$('enchInscBtn').disabled,false);
 c.S.ench.skill=500;c.roll=.95;c.$('enchReadBtn').onclick();
 assert.deepEqual(plain(c.S.ench.insc[1]),{id:'swift',rar:'legendary'},'the roll reads the skill');assert.equal(c.S.bag.length,1);assert.equal(c.S.ench.skill,500);
 c.$('enchReadBtn').onclick();assert.equal(c.S.ench.insc.length,2,'no book, no reading');assert.equal(c.warns,1);assert.equal(c.$('enchReadBtn').disabled,true);
});
test('an untrained hero reads nothing and is told the hall teaches the books too',()=>{
 const c=hall();c.S.ench={trained:false,skill:0,bag:[]};c.S.bag=[{...BOOK}];c.enchRefresh();
 assert.match(c.$('enchBody').innerHTML,/read the Books of Knowledge/);c.enchReadBook();assert.equal(c.S.bag.length,1);assert.equal(c.S.ench.insc,undefined);
});
test('inscribing writes one chosen inscription onto the worn weapon, replacing the old one and nothing else',()=>{
 const c=hall();c.S.ench.insc=[{id:'keen',rar:'rare'},{id:'twin',rar:'epic'},{id:'twin',rar:'epic'}];c.S.gear.weapon.insc={id:'orb',rar:'common'};
 booksTab(c);
 const cells=c.cells('ii');assert.deepEqual(cells.map(b=>b.dataset.ii),['twin:epic','keen:rare'],'rarest first');
 assert.match(c.$('enchBody').innerHTML,/×2<\/span><\/button>/);
 cells[0].onclick();assert.equal(c.focused.dataset.ii,'twin:epic');
 const html=c.$('enchBody').innerHTML;assert.match(html,/Replaces Common Arcane Orb: 1% chance to hurl an arcane orb\. The current inscription will be lost/);
 c.$('enchInscBtn').onclick();
 assert.deepEqual(plain(c.S.gear.weapon),{name:'Iron Sword',atk:17,insc:{id:'twin',rar:'epic'}});
 assert.deepEqual(plain(c.S.ench.insc),[{id:'keen',rar:'rare'},{id:'twin',rar:'epic'}]);
 assert.match(c.$('enchBody').innerHTML,/Twin Strike inscribed on Iron Sword; Arcane Orb erased/);
 c.S.gear.weapon=null;c.enchRefresh();assert.equal(c.$('enchInscBtn').disabled,true);assert.match(c.$('enchBody').innerHTML,/Equip a weapon to inscribe it/);
 c.enchInscribe('keen:rare');assert.equal(c.S.ench.insc.length,2);assert.equal(c.warns,1);
 c.S.gear.weapon={name:'Axe'};c.enchInscribe('nothing:here');c.enchInscribe('keen:rare');assert.deepEqual(plain(c.S.gear.weapon.insc),{id:'keen',rar:'rare'});assert.equal(c.S.ench.insc.length,1);
});
test('a newer build\'s inscription waits unseen in the hall and cannot be written by this one',()=>{
 const c=hall();c.S.ench.insc=[{id:'thunder',rar:'epic'},{id:'twin',rar:'fine'}];booksTab(c);
 assert.deepEqual(c.cells('ii').map(b=>b.dataset.ii),['twin:fine']);assert.match(c.$('enchBody').innerHTML,/Your inscriptions <span class="craft-badge">1<\/span>/);
 c.enchInscribe('thunder:epic');assert.equal(c.S.gear.weapon.insc,undefined);assert.equal(c.S.ench.insc.length,2);
});
test('what was read is not shown to the next hero loaded',()=>{
 const c=hall();c.S.bag=[{...BOOK}];booksTab(c);c.$('enchReadBtn').onclick();
 c.S=JSON.parse(JSON.stringify(c.S));c.enchRefresh();
 assert.doesNotMatch(c.$('enchBody').innerHTML,/Last book read|added to your inscriptions/);
 assert.deepEqual(Object.keys(c.S.ench).sort(),['bag','insc','skill','trained']);
});

/* ---------------- combat ---------------- */
function fight(weaponInsc,cls={id:'warrior',cd:1,ranged:false}){
 const rolls=[],timers=[],hits=[],floats=[],acts=[],heals=[];
 const c={S:{gear:{weapon:{name:'Blade',insc:weaponInsc},trinket:null}},hero:{x:0,y:0,cd:0,swing:0,mana:10,dead:false,deadWait:false},enemies:[],bolts:[],gameOn:true,mp:{on:false},
  rolls,timers,hits,floats,acts,heals,
  Math:Object.assign(Object.create(Math),{random:()=>{assert.ok(rolls.length,'a roll nobody scripted');return rolls.shift();}}),
  setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},
  classOf:()=>cls,hasteMul:()=>1,heroAtk:()=>100,atkMul:()=>1,heroCrit:()=>10,mpAct:(a,d)=>acts.push({a,...d}),
  sfx:{bolt(){},swing(){},hit(){},arcane(){},shout(){}},hasEnch:()=>false,scrollPct:()=>0,scrollRaw:()=>0,mpGuestRaidHit:()=>false,
  floatAt:(x,y,t)=>floats.push(t),burst(){},ring(){},zapLine(){},bloodAt(){},killEnemy:en=>{en.dead=true;},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),fkBonus:()=>0,healHero:n=>heals.push(n),manaMax:()=>100,isFG:()=>false,activePet:()=>null};
 vm.createContext(c);
 vm.runInContext(HELPERS,c);
 vm.runInContext(section("/* one swing's damage roll","function dealSpell(en,sp){"),c);
 c.foe=(x=40,y=0)=>{const en={x,y,r:12,hp:1000,dead:false,hidden:false,slowT:0};c.enemies.push(en);return en;};
 return c;
}
test('a plain weapon swings once, and every inscription roll is spent only when the weapon has one',()=>{
 const c=fight(undefined),en=c.foe();c.rolls.push(.5,.99);
 c.heroBasicAttack(en,5);assert.equal(en.hp,900);assert.deepEqual(c.floats,['100']);assert.equal(c.timers.length,0);assert.equal(c.bolts.length,0);assert.equal(c.rolls.length,0);
 const k=fight({id:'keen',rar:'epic'}),e2=k.foe();k.rolls.push(.5,.99);k.heroBasicAttack(e2,5);assert.equal(e2.hp,900,'Keen Edge adds no roll of its own - it lives in heroCrit');
});
test('Twin Strike: a second full swing a beat later, with its own rolls, only while the fight is still on',()=>{
 const c=fight({id:'twin',rar:'legendary'}),en=c.foe();
 c.rolls.push(.5,.99,.079);c.heroBasicAttack(en,5);
 assert.equal(en.hp,900);assert.equal(c.timers.length,1);assert.equal(c.timers[0].ms,140);
 c.rolls.push(1,0);c.timers[0].f();
 assert.equal(en.hp,1000-100-187,'110 × 1.7 crit on the second swing');assert.deepEqual(c.floats,['100','Twin ✦187']);
 assert.deepEqual(c.acts.map(a=>a.a),['swing','swing']);
 c.rolls.push(.5,.99,.08);c.heroBasicAttack(en,5);assert.equal(c.timers.length,1,'8% means below eight, not eight');
 c.rolls.push(.5,.99,0);c.heroBasicAttack(en,5);en.dead=true;c.timers[1].f();assert.equal(c.rolls.length,0,'a dead foe takes no second swing');
 const again=fight({id:'twin',rar:'common'}),foe=again.foe();again.rolls.push(.5,.99,0);again.heroBasicAttack(foe,5);
 again.enemies.length=0;again.timers[0].f();assert.equal(foe.hp,900,'a foe left behind by a zone change takes no second swing');
 again.enemies.push(foe);again.S={gear:{}};again.timers[0].f();assert.equal(foe.hp,900,'nor one struck by a hero no longer played');
});
test('Twin Strike on a ranged class looses a second, labelled projectile',()=>{
 const c=fight({id:'twin',rar:'common'},{id:'hunter',cd:1,ranged:true,boltC:'#cfe8a0'}),en=c.foe();
 c.rolls.push(.5,.99,0);c.heroBasicAttack(en,5);c.rolls.push(.5,.99);c.timers[0].f();
 assert.equal(c.bolts.length,2);assert.equal(c.bolts[0].label,null);assert.equal(c.bolts[1].label,'Twin');assert.equal(c.bolts[1].basic,true);assert.equal(c.bolts[1].arrow,true);
});
test('Arcane Orb: a slow orb for 150% of a swing, seen by the other raiders too',()=>{
 const c=fight({id:'orb',rar:'legendary'}),en=c.foe(120,0);
 c.rolls.push(.5,.99,.05,.5,.99);c.heroBasicAttack(en,5);
 assert.equal(c.bolts.length,1);const orb=c.bolts[0];
 assert.equal(orb.orb,true);assert.equal(orb.dmg,150);assert.equal(orb.crit,false);assert.equal(orb.tgt,en);assert.ok(orb.sp<430,'slower than an arrow');
 assert.deepEqual(plain(c.acts[1]),{a:'boltfx',tx:120,ty:0,c:'#b98cff',orb:1});
 c.rolls.push(.5,.99,.08);c.heroBasicAttack(en,5);assert.equal(c.bolts.length,1);
});
test('the orb bursts on its target and splashes half on foes close beside it, and nowhere else',()=>{
 const c=fight({id:'orb',rar:'epic'}),t=c.foe(100,100),near=c.foe(140,120),far=c.foe(200,100),dead=c.foe(110,100);dead.dead=true;dead.hp=0;
 c.orbBurst({tgt:t,dmg:151,crit:true});
 assert.equal(t.hp,849);assert.equal(near.hp,924);assert.equal(far.hp,1000);assert.equal(dead.hp,0);
 assert.deepEqual(c.floats,['Orb ✦151','Orb 76']);assert.deepEqual(c.heals,[],'an orb is magic, not a strike: no lifesteal');
 t.dead=true;c.orbBurst({tgt:t,dmg:151});assert.equal(near.hp,924,'an orb whose target is already gone does nothing');
});
test('Bloodthirst adds to the lifesteal of every landed hit',()=>{
 const c=fight({id:'leech',rar:'legendary'}),en=c.foe();c.rolls.push(.5,.99);c.heroBasicAttack(en,5);
 assert.deepEqual(c.heals,[3]);
 c.S.gear.weapon.lifesteal=0.02;c.landHit(en,100,false,null,true);assert.equal(Math.round(c.heals[1]*1e6)/1e6,5);
});
test('Keen Edge reaches the crit chance and Quickening the attack speed',()=>{
 const c={S:{gamblerT:0,gear:{weapon:{insc:{id:'keen',rar:'epic'}}}},hero:{buff:{}},Math,classOf:()=>({crit:5}),raceOf:()=>({crit:6}),gearSum:()=>0,fkBonus:()=>0,fgCrit:()=>0,
  swiftMul:()=>1,hasteBoostMul:()=>1,activePet:()=>null};
 vm.createContext(c);vm.runInContext(HELPERS,c);
 vm.runInContext(section('const heroCrit=','/* Every legendary bonus')+'\nglobalThis.heroCrit=heroCrit;',c);vm.runInContext(section('function hasteMul(){','function healHero('),c);
 assert.equal(c.heroCrit(),5+6+0+3);
 c.S.gear.weapon.insc={id:'swift',rar:'legendary'};assert.equal(c.heroCrit(),11);assert.equal(c.hasteMul(),1.08);
});

/* ---------------- the bag ---------------- */
function bag(){
 const logs=[],c={S:{scraps:0,bag:[],gear:{weapon:null,armor:null,trinket:null}},logs,Math,SLOTS:['weapon','armor','trinket'],SCRAP_CAP:1e9,
  log:t=>logs.push(t),stageMsg(){},renderBag(){},renderHUD(){},save(){},sfx:{forge(){}},cowLocked:()=>false,scrapVal:()=>2,itemName:it=>it.name,
  inGearSet:it=>!!it.gs,calcPower:it=>{it.power=it.atk||0;},knowledgeBook:()=>({...BOOK})};
 vm.createContext(c);vm.runInContext(HELPERS,c);
 vm.runInContext(section('const isLegendary=','/* Upgrade cost:'),c);
 vm.runInContext(section('const bagSellable=','const bagGoldVal='),c);
 vm.runInContext(section('function upgradeItem(it){','function statBaseStr('),c);
 vm.runInContext(section('function cleanBagItem(it){','function scrapBagItems('),c);
 vm.runInContext(section('function scrapBagItems(','function renderBag(){'),c);
 vm.runInContext('globalThis.bagSellable=bagSellable;',c);
 return c;
}
test('inscribed weapons stay out of Sell All and Scrap All, like legendaries and gear sets',()=>{
 const c=bag(),plainW={slot:'weapon',name:'Plain',rar:'fine'},inscribed={slot:'weapon',name:'Mine',rar:'fine',insc:{id:'twin',rar:'rare'}},set={slot:'armor',name:'Set',rar:'rare',gs:1};
 assert.equal(c.bagSellable(plainW),true);assert.equal(c.bagSellable(inscribed),false);assert.equal(c.bagSellable({...BOOK}),false);
 c.S.bag=[plainW,inscribed,set,{...BOOK}];c.scrapBagItems(()=>true,'items');
 assert.deepEqual(plain(c.S.bag.map(it=>it.name)),['Mine','Set','Book of Knowledge']);assert.equal(c.S.scraps,2);
});
test('auto-equip leaves an inscribed weapon in the hand, says so once, and still equips other slots',()=>{
 const c=bag(),worn={slot:'weapon',name:'Mine',rar:'fine',power:10,insc:{id:'orb',rar:'epic'}};c.S.gear.weapon=worn;
 assert.equal(c.tryAutoEquip({slot:'weapon',name:'Better',rar:'epic',power:99}),false);assert.equal(c.S.gear.weapon,worn);
 assert.equal(c.tryAutoEquip({slot:'weapon',name:'Better still',rar:'epic',power:120}),false);assert.equal(c.logs.length,1);assert.match(c.logs[0],/keeps your inscribed/);
 assert.equal(c.tryAutoEquip({slot:'weapon',name:'Worse',rar:'common',power:1}),false);
 assert.equal(c.tryAutoEquip({slot:'armor',name:'Coat',rar:'fine',power:5}),true);
 delete worn.insc;assert.equal(c.tryAutoEquip({slot:'weapon',name:'Better',rar:'epic',power:99}),true);
});
test('cleanBagItem keeps a well-formed inscription on a weapon only',()=>{
 const c=bag();
 assert.deepEqual(plain(c.cleanBagItem({slot:'weapon',name:'W',insc:{id:'twin',rar:'epic',extra:1}}).insc),{id:'twin',rar:'epic'});
 assert.deepEqual(plain(c.cleanBagItem({slot:'weapon',name:'W',insc:{id:'thunder',rar:'epic'}}).insc),{id:'thunder',rar:'epic'});
 assert.equal('insc' in c.cleanBagItem({slot:'weapon',name:'W',insc:'twin'}),false);
 assert.equal('insc' in c.cleanBagItem({slot:'armor',name:'A',insc:{id:'twin',rar:'epic'}}),false);
 assert.equal('insc' in c.cleanBagItem({slot:'weapon',name:'W'}),false);
 assert.equal(c.cleanBagItem({...BOOK,insc:{id:'twin',rar:'epic'}}).insc,undefined,'a book is rebuilt from nothing');
});

/* ---------------- the leaderboard ---------------- */
test('the leaderboard carries an inscription only when there is one',async()=>{
 const writes=[],ctx=vm.createContext({S:null,FB:{ready:true,user:{uid:'u1'}},SEASON:1,SDK_WAIT_MS:10,window:{},console:{warn(){}},ZONES:[],CITY_ZONE:26,
  charGearScore:()=>20,lbScore:()=>123,charStats:()=>({hp:500}),heroDeleted:()=>false,characterTitle:()=>'',heroOutfit:()=>'default',
  cloudCall:async(_,sdk,rest)=>rest({patch:async(id,entry)=>writes.push(JSON.parse(JSON.stringify(entry)))})});
 vm.runInContext(section('const lbPublished=','async function fetchLB(){'),ctx);
 const ch={id:'a',name:'Hero',cls:'warrior',race:'human',lvl:60,gear:{weapon:{name:'Blade',rar:'epic',slot:'weapon',atk:9},armor:{name:'Coat',rar:'fine',slot:'armor',hp:9}}};
 await ctx.publishLB(ch);assert.equal('insc' in writes[0].gear.weapon,false);assert.equal('insc' in writes[0].gear.armor,false);
 ch.gear.weapon.insc={id:'twin',rar:'legendary'};await ctx.publishLB(ch);
 assert.equal(writes.length,2,'an inscription is a change worth publishing');assert.deepEqual(writes[1].gear.weapon.insc,{id:'twin',rar:'legendary'});
});
