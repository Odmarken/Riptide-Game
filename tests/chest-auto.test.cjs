const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Chest source boundaries must exist');
 return source.slice(a,b);
}

// Exercise the real payment, prize, reel, finish and click handlers. Only the
// browser surface, clock, item factories and unrelated rendering are mocked.
function harness(type='gamba',qty=1,state={}){
 const c={now:1000,roll:.5,rolls:[],spins:[],spendCalls:[],saves:0,gameOn:true,
  S:{gold:100000,overflow:0,freeGoldCases:0,chests:{violethalls:0},bag:[],pets:[],scrolls:[],farm:{inv:{}},ore:{gem:0},...state}};
 const nodes=new Map(),elements=[],timers=new Map(),frames=new Map();let serial=0;
 function element(id=''){
  const classes=new Set(),e={id,style:{setProperty(k,v){this[k]=v;}},dataset:{},attributes:{},textContent:'',innerHTML:'',disabled:false,isConnected:true,
   classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n),
    toggle(n,force){const on=force===undefined?!classes.has(n):force;if(on)classes.add(n);else classes.delete(n);return on;}},
   setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},getBoundingClientRect:()=>({width:420}),
   after(){},remove(){this.isConnected=false;},querySelector(selector){
    if(!this.children)this.children=new Map();
    if(!this.children.has(selector)){const child=element();child.parentElement=this;this.children.set(selector,child);}
    return this.children.get(selector);
   }};
  Object.defineProperty(e,'className',{get:()=>[...classes].join(' '),set:value=>{classes.clear();value.split(/\s+/).filter(Boolean).forEach(n=>classes.add(n));}});
  elements.push(e);return e;
 }
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 const reel=c.$('caseReel'),wrap=element();reel.parentElement=wrap;wrap.children=new Map([['.casereel',reel]]);
 c.$('chestFx').classList.add('open');
 const item=(name,rar='common')=>({name,rar,slot:'weapon',sell:10});
 Object.assign(c,{
  Math:Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():c.roll}),
  performance:{now:()=>c.now},window:{innerWidth:1600},
  document:{createElement:()=>element(),querySelectorAll:selector=>selector==='.caseextra'?elements.filter(e=>e.isConnected&&e.classList.contains('caseextra')):[]},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:c.now+delay});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  save:()=>c.saves++,renderShop(){},renderBag(){},renderHUD(){},stageMsg(){},log(){},blip(){},noiseSweep(){},spawnChestParts(){},
  sfx:{buy(){},warn(){},loot(){},quest(){},level(){}},
  rollItem:rar=>item('Test '+rar,rar),rollRimfrost:()=>item('Rimfrost','legendary'),rollFelGlaives:()=>item('Fel Glaives','legendary'),
  itemName:it=>it.name,itemStr:()=>'+10 attack',isLegendary:it=>it.rar==='legendary',scrapVal:()=>1,tryAutoEquip:()=>false,
  lootIco:id=>id,SLOT_ICO:{weapon:()=>'⚔',armor:()=>'◇',trinket:()=>'○'},
  petOf:id=>({id,n:{cat:'Puffen',dog:'Ayla',blackdog:'Nellie'}[id],cc:'#fff',d:'Companion.'}),petGlyph:p=>p.id,
  ENCHS:[{id:'flame',n:'Flame',glow:'#f80'}],ENCH_COST:2,tierDesc:()=>'+1 fire',
  addGoldOverflow:n=>{c.S.gold+=n;return {got:n,over:0};},scrapBagItems(){},
  recordSpin:wins=>c.spins.push(Array.isArray(wins)?[...wins]:[wins]),
 });
 vm.createContext(c);
 vm.runInContext(section('const totalGold=()=>','/* Slot wins'),c);
 vm.runInContext(section('function spendGold(n){','/* zero loot'),c);
 vm.runInContext(section('const CASE_COST=','/* ==================== SLOT MACHINE'),c);
 vm.runInContext(`curCase=${JSON.stringify(type)};chestQty[${JSON.stringify(type)}]=${qty};
  const actualStartCaseSpin=startCaseSpin;startCaseSpin=function(wins){recordSpin(wins);return actualStartCaseSpin(wins);};
  const actualSpendGold=spendGold;spendGold=function(n){spendCalls.push(n);return actualSpendGold(n);};`,c);
 c.read=expression=>vm.runInContext(expression,c);
 c.pending=()=>timers.size;
 c.advance=ms=>{
  const target=c.now+ms;let budget=100;
  while(true){
   const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!next)break;assert.ok(budget-->0,'Timer loop must terminate');
   timers.delete(next[0]);c.now=next[1].at;next[1].fn();
  }
  c.now=target;
 };
 c.completeSpin=()=>{
  assert.equal(c.read('caseSpinning'),true,'There must be a real spin to finish');
  c.now+=11000;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(c.now));
  assert.equal(c.read('caseSpinning'),false);
 };
 c.drain=()=>{
  let budget=30;
  while(c.read('!!caseAuto')||c.read('caseSpinning')){
   assert.ok(budget-->0,'Auto spin must stop at available resources');
   if(c.read('caseSpinning'))c.completeSpin();else c.advance(1200);
  }
 };
 c.updateCaseControls();return c;
}

test('paid Gamba and Gold auto spins use overflow, finish a smaller last batch and stop before overdrawing',()=>{
 for(const [type,cost]of [['gamba',5000],['gold',20000]]){
  const c=harness(type,3,{gold:cost*5+123,overflow:cost*2});
  c.$('caseAutoBtn').onclick();assert.equal(c.pending(),1);c.advance(1199);assert.equal(c.spins.length,0);
  c.advance(1);assert.equal(c.spins.length,1);assert.equal(c.$('respinBtn').disabled,true);assert.equal(c.$('caseClose').disabled,true);
  c.drain();assert.deepEqual(c.spins.map(w=>w.length),[3,3,1]);assert.deepEqual(c.spendCalls,[cost*3,cost*3,cost]);
  assert.equal(c.S.gold,123);assert.equal(c.S.overflow,0);assert.equal(c.S.bag.length,7);assert.equal(c.pending(),0);
  assert.equal(c.$('caseAutoBtn').disabled,true);assert.match(c.$('caseAutoStatus').textContent,/Not enough gold/);
  c.advance(100000);assert.equal(c.spins.length,3);
 }
});

test('free Gold auto sessions consume every free chest including a partial batch and never spill into the wallet',()=>{
 const c=harness('gold',3,{gold:900000,freeGoldCases:7});
 c.$('caseAutoBtn').onclick();assert.match(c.$('caseAutoStatus').textContent,/Free chests only/);c.drain();
 assert.deepEqual(c.spins.map(w=>w.length),[3,3,1]);assert.deepEqual(c.spendCalls,[0,0,0]);
 assert.equal(c.S.freeGoldCases,0);assert.equal(c.S.gold,900000);assert.equal(c.S.bag.length,7);assert.equal(c.pending(),0);
 assert.equal(c.$('caseAutoBtn').disabled,true);assert.match(c.$('caseAutoStatus').textContent,/No free chests left/);
 c.$('caseAutoBtn').onclick();c.advance(10000);assert.equal(c.spins.length,3);assert.equal(c.S.gold,900000);
});

test('Auto stays disabled after the last manually opened free chest; an explicit paid Respin can start a new paid session',()=>{
 const c=harness('gold',1,{gold:100000,freeGoldCases:1});
 c.openGoldChest();assert.equal(c.S.freeGoldCases,0);assert.equal(c.S.gold,100000);assert.equal(c.$('caseAutoBtn').disabled,true);
 c.completeSpin();assert.equal(c.$('caseAutoBtn').disabled,true);assert.equal(c.$('respinBtn').disabled,false);
 c.$('caseAutoBtn').onclick();c.advance(5000);assert.equal(c.spins.length,1);assert.equal(c.S.gold,100000);
 c.$('respinBtn').onclick();assert.equal(c.S.gold,80000);assert.equal(c.$('caseAutoBtn').disabled,false);
 c.$('caseAutoBtn').onclick();assert.equal(c.pending(),0);c.drain();
 assert.equal(c.S.gold,0);assert.equal(c.S.bag.length,6);assert.deepEqual(c.spendCalls,[0,20000,20000,20000,20000,20000]);
});

test('Violet Halls auto opens only the owned chest count and does not charge gold',()=>{
 const c=harness('violethalls',1,{gold:12345,chests:{violethalls:3}});c.roll=0;
 c.$('caseAutoBtn').onclick();c.drain();
 assert.equal(c.spins.length,3);assert.equal(c.S.chests.violethalls,0);assert.equal(c.S.gold,12345);assert.deepEqual(c.spendCalls,[]);
 assert.equal(c.$('caseAutoBtn').disabled,true);assert.equal(c.$('respinBtn').disabled,true);assert.match(c.$('caseAutoStatus').textContent,/No chests left/);
});

test('actual Rimfrost, companion, Bull, Calf, Chicken and Fel Glaives rewards stop auto after the reveal',()=>{
 const cases=[
  ['gold',[.001],'Rimfrost'],['gold',[.003,0],'Puffen'],['gold',[.006],'Bull'],
  ['gamba',[.001],'Calf'],['gamba',[.005],'Chicken'],['violethalls',[.5,.01],'Fel Glaives'],
 ];
 for(const [type,rolls,name]of cases){
  const c=harness(type,1,{gold:1000000,chests:{violethalls:3}});c.rolls=rolls;
  c.$('caseAutoBtn').onclick();c.advance(1200);assert.equal(c.spins[0][0].name,name);assert.equal(c.read('!!caseAuto'),true);
  c.completeSpin();assert.equal(c.read('caseAuto'),null);assert.equal(c.pending(),0);
  assert.match(c.$('caseAutoStatus').textContent,new RegExp('paused.*'+name));assert.equal(c.$('chestReveal').classList.contains('show'),true);
  c.advance(60000);assert.equal(c.spins.length,1,'The special reward must remain visible until manual input');
 }
});

test('a special prize anywhere in a multi-opening stops the session; ordinary epics and farm seeds continue',()=>{
 const c=harness('gold',3,{gold:1000000});c.rolls=[.5,.001,.5];
 c.$('caseAutoBtn').onclick();c.advance(1200);assert.deepEqual(c.spins[0].map(w=>w.name),['Test rare','Rimfrost','Test rare']);
 c.completeSpin();assert.equal(c.read('caseAuto'),null);assert.equal(c.S.bag.length,3);assert.equal(c.S.gold,940000);assert.equal(c.pending(),0);
 for(const [roll,tier]of [[.99,'epic'],[.02,'FARM']]){
  const ordinary=harness('gamba',1,{gold:10000});ordinary.roll=roll;
  ordinary.$('caseAutoBtn').onclick();ordinary.advance(1200);assert.equal(ordinary.spins[0][0].tier,tier);
  ordinary.completeSpin();assert.equal(ordinary.read('!!caseAuto'),true);assert.equal(ordinary.pending(),1);ordinary.drain();
  assert.equal(ordinary.spins.length,2);assert.equal(ordinary.S.gold,0);
 }
});

test('Stop cancels a queued opening and can stop during a spin without cancelling or duplicating its already paid prize',()=>{
 const pending=harness();pending.$('caseAutoBtn').onclick();pending.$('caseAutoBtn').onclick();
 assert.equal(pending.pending(),0);pending.advance(10000);assert.equal(pending.spins.length,0);assert.equal(pending.S.gold,100000);
 const spinning=harness();spinning.$('caseAutoBtn').onclick();spinning.advance(1200);
 assert.equal(spinning.S.gold,95000);assert.equal(spinning.S.bag.length,1);spinning.$('caseAutoBtn').onclick();
 assert.equal(spinning.read('caseSpinning'),true);assert.equal(spinning.read('caseAuto'),null);
 spinning.completeSpin();spinning.advance(10000);assert.equal(spinning.spins.length,1);assert.equal(spinning.S.bag.length,1);assert.equal(spinning.pending(),0);
 assert.equal(spinning.$('caseClose').disabled,false);assert.match(spinning.$('caseAutoStatus').textContent,/stopped/);
});

test('closing cancels auto, and an attempted close during a spin preserves the current paid reveal',()=>{
 const pending=harness();pending.$('caseAutoBtn').onclick();pending.hideChestFx();pending.advance(10000);
 assert.equal(pending.$('chestFx').classList.contains('open'),false);assert.equal(pending.spins.length,0);
 const spinning=harness();spinning.$('caseAutoBtn').onclick();spinning.advance(1200);spinning.hideChestFx();
 assert.equal(spinning.$('chestFx').classList.contains('open'),true);assert.equal(spinning.read('caseAuto'),null);
 spinning.completeSpin();assert.equal(spinning.$('chestReveal').classList.contains('show'),true);assert.equal(spinning.pending(),0);
});

test('pending auto work rechecks its character, chest type, open overlay, game state and funds before spending',()=>{
 for(const mutate of [
  c=>{c.S={...c.S,bag:[]};},c=>c.read("curCase='gold'"),c=>c.$('chestFx').classList.remove('open'),
  c=>{c.gameOn=false;},c=>{c.S.gold=0;},
 ]){
  const c=harness();c.$('caseAutoBtn').onclick();mutate(c);const remaining=c.S.gold;c.advance(1200);
  assert.equal(c.spins.length,0);assert.equal(c.S.gold,remaining);assert.equal(c.read('caseAuto'),null);assert.equal(c.pending(),0);
 }
});

test('manual Respin invalidates a queued auto timer; extra clicks during the spin cannot purchase twice',()=>{
 const c=harness();c.$('caseAutoBtn').onclick();assert.equal(c.pending(),1);
 c.$('respinBtn').onclick();assert.equal(c.spins.length,1);assert.equal(c.read('caseAuto'),null);assert.equal(c.pending(),0);
 c.$('respinBtn').onclick();c.openChest();c.openGoldChest();assert.equal(c.spins.length,1);assert.equal(c.S.gold,95000);
 c.advance(1200);assert.equal(c.spins.length,1);c.completeSpin();assert.equal(c.pending(),0);assert.equal(c.S.bag.length,1);
});

test('a DOM click event passed to the Violet opener is manual and cancels an older auto timer',()=>{
 const c=harness('violethalls',1,{gold:12345,chests:{violethalls:3}});c.roll=0;
 c.$('caseAutoBtn').onclick();assert.equal(c.pending(),1);
 c.openVioletHallsChest({type:'click'});
 assert.equal(c.read('caseAuto'),null);assert.equal(c.pending(),0);assert.equal(c.spins.length,1);
 assert.equal(c.S.chests.violethalls,2);assert.equal(c.S.gold,12345);
 c.advance(1200);assert.equal(c.spins.length,1);c.completeSpin();c.advance(10000);
 assert.equal(c.spins.length,1);assert.equal(c.S.chests.violethalls,2);assert.equal(c.pending(),0);
});

test('arming during an existing spin waits for its reveal, and repeated queue requests schedule one opening',()=>{
 const c=harness('gamba',1,{gold:15000});c.openChest();c.$('caseAutoBtn').onclick();
 assert.equal(c.pending(),0);c.queueCaseAuto();assert.equal(c.pending(),0);c.completeSpin();assert.equal(c.pending(),1);
 c.queueCaseAuto();c.queueCaseAuto();assert.equal(c.pending(),1);c.drain();
 assert.equal(c.spins.length,3);assert.equal(c.S.gold,0);assert.equal(c.S.bag.length,3);
});
