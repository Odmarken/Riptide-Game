/* The gamble chests after the 2026-09-30 casino review (chests-1..7, chests-9 and the missed auto-equip bypass),
 * pinned so they stay fixed. The chest code runs for real in a vm with a fake DOM; the stylesheet and the
 * DOM-heavy shop and farm lines are pinned by their source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const SCRAP_CAP=+game.match(/SCRAP_CAP=(\d+)/)[1];

/* The real gold, scrap and chest code; only the browser surface, the clock and the item factories are fakes. */
function chests(state={}){
 const c={now:1000,roll:.5,rolls:[],saves:[],msgs:[],logs:[],gameOn:true,boss:false,herd:false,SCRAP_CAP,
  S:{id:'A',gold:100000,overflow:0,scraps:0,freeGoldCases:0,chests:{violethalls:0},bag:[],pets:[],scrolls:[],farm:{inv:{}},ore:{gem:0},
   gear:{weapon:null,armor:null,trinket:null},autoEquip:false,...state}};
 const nodes=new Map(),elements=[],timers=new Map(),frames=new Map();let serial=0;
 function element(id=''){
  const classes=new Set(),e={id,style:{setProperty(k,v){this[k]=v;}},dataset:{},attributes:{},textContent:'',innerHTML:'',disabled:false,isConnected:true,
   classList:{add(...n){n.forEach(x=>classes.add(x));},remove(...n){n.forEach(x=>classes.delete(x));},contains:n=>classes.has(n),
    toggle(n,f){const on=f===undefined?!classes.has(n):f;if(on)classes.add(n);else classes.delete(n);return on;}},
   setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},getBoundingClientRect:()=>({width:420}),
   after(){},remove(){this.isConnected=false;},querySelector(sel){
    if(!this.children)this.children=new Map();
    if(!this.children.has(sel)){const ch=element();ch.parentElement=this;this.children.set(sel,ch);}
    return this.children.get(sel);
   }};
  Object.defineProperty(e,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>classes.add(x));}});
  elements.push(e);return e;
 }
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 const reel=c.$('caseReel'),wrap=element();reel.parentElement=wrap;wrap.children=new Map([['.casereel',reel]]);
 const item=(name,rar='common',slot='weapon')=>({name,rar,slot,sell:10,power:rar==='epic'?50:5});
 Object.assign(c,{
  Math:Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():c.roll}),
  performance:{now:()=>c.now},window:{innerWidth:1600},
  document:{createElement:()=>element(),querySelectorAll:sel=>sel==='.caseextra'?elements.filter(e=>e.isConnected&&e.classList.contains('caseextra')):[]},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:c.now+(delay||0)});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  save:()=>c.saves.push(JSON.stringify(c.S)),renderShop(){},renderBag(){},renderHUD(){},blip(){},noiseSweep(){},spawnChestParts(){},
  stageMsg:m=>c.msgs.push(m),log:m=>c.logs.push(m),sfx:{buy(){},warn(){},loot(){},quest(){},level(){},forge(){}},
  inBossFight:()=>c.boss,cowLocked:()=>c.herd,inGearSet:()=>false,padFocus:null,padMark(){}, /* the pad (Scrap hands its highlight to Close) */
  scrapVal:it=>({common:1,fine:2,rare:4,epic:8,legendary:20})[it.rar],isLegendary:it=>!!it&&it.rar==='legendary',
  rollItem:rar=>item('Test '+rar,rar,'armor'),rollRimfrost:()=>item('Rimfrost','legendary'),rollFelGlaives:()=>item('Fel Glaives','legendary'),
  tryAutoEquip:it=>{const cur=c.S.gear[it.slot];if(!cur||it.power>cur.power){if(cur)c.S.bag.push(cur);c.S.gear[it.slot]=it;return true;}return false;},
  itemName:it=>it.name,itemStr:()=>'+10 attack',lootIco:id=>id,SLOT_ICO:{weapon:()=>'W',armor:()=>'A',trinket:()=>'T'},
  petOf:id=>({id,n:id,cc:'#fff',d:'Companion.'}),petGlyph:p=>p.id,ENCHS:[{id:'flame',n:'Flame',glow:'#f80'}],ENCH_COST:2,tierDesc:()=>'+1 fire',
  addGoldOverflow:n=>{c.S.gold+=n;return {got:n,over:0};},
 });
 vm.createContext(c);
 for(const [a,b] of [['const totalGold=()=>','/* Slot wins'],['function spendGold(n){','/* zero loot'],['const scrapRoom=','/* total spendable'],
  ['const bagSellable=','const bagGoldVal='],['function gearLocked(){','function gearSwapTo('],['function scrapBagItems(','function renderBag('],
  ['const CASE_COST=','/* ==================== SLOT MACHINE']])vm.runInContext(section(a,b),c);
 c.run=code=>vm.runInContext(code,c);
 c.pending=()=>timers.size;
 c.advance=ms=>{const end=c.now+ms;for(let guard=0;guard<200;guard++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);c.now=next[1].at;next[1].fn();}c.now=end;};
 c.land=()=>{c.now+=11000;const due=[...frames.values()];frames.clear();due.forEach(fn=>fn(c.now));};
 c.hero=next=>{c.S=next;c.run('S=globalThis.S');};
 c.$('chestFx').classList.add('open');
 return c;
}

test('chests-1: a Violet Halls chest is saved together with its prize, never spent without it',()=>{
 for(const [rolls,check] of [
  [[.5,.2,.9999999],s=>assert.equal(s.gold,150000,'the 50,000 gold prize is on the device')],
  [[.5,.05],s=>assert.deepEqual(s.bag.map(it=>it.name),['Fel Glaives'])],
  [[.5,.99],s=>assert.equal(s.freeGoldCases,10)],
  [[.1,.1,.99],s=>assert.equal(s.ore.gem,4)],
 ]){
  const c=chests({chests:{violethalls:2}});c.rolls=rolls;
  c.run('openVioletHallsChest()');
  assert.equal(c.saves.length,1);const saved=JSON.parse(c.saves[0]);
  assert.equal(saved.chests.violethalls,1);check(saved);
 }
 assert.ok(/const win=btPrizeValue\(\);[^\n]*\n save\(\);renderBag\(\);renderHUD\(\);\n startCaseSpin\(win\);/.test(section('function openVioletHallsChest(','function rollChestBatch(')));
});

test('chests-2: scrapping stops at the pouch - a full pouch keeps the gear, a nearly full one scraps what fits and says so',()=>{
 const gear=()=>['rare','epic','rare','rare','rare'].map((rar,i)=>({name:'G'+i,rar,slot:'armor',sell:100}));
 const full=chests({scraps:SCRAP_CAP});full.S.bag=gear();
 assert.equal(full.run("scrapBagItems(()=>true,'chest items')"),false);
 assert.equal(full.S.scraps,SCRAP_CAP);assert.equal(full.S.bag.length,5,'nothing destroyed for nothing');
 assert.match(full.msgs.at(-1),/Scrap pouch full \(800\/800⚙\)/);
 const near=chests({scraps:SCRAP_CAP-10});near.S.bag=gear();
 assert.equal(near.run("scrapBagItems(()=>true,'chest items')"),true);
 assert.equal(near.S.scraps,SCRAP_CAP-2,'two rares (8) fit into 10 - every scrap credited is a scrap taken');
 assert.deepEqual(near.S.bag.map(it=>it.name),['G1','G3','G4'],'the epic and the last rares stay in the bag');
 /* 798/800 is not full: the kept gear is kept for want of room (round 2 - it said 'scrap pouch full') */
 assert.match(near.logs.at(-1),/Scrapped 2 chest items - \+8 ⚙\. 3 kept - no room in the scrap pouch \(798\/800⚙\)\./);
 assert.match(near.msgs.at(-1),/for 8 Scraps · 3 kept, no room in the scrap pouch \(798\/800⚙\)/);
 const room=chests({scraps:0});room.S.bag=gear();room.run("scrapBagItems(()=>true,'items')");
 assert.equal(room.S.scraps,24);assert.equal(room.S.bag.length,0,'with room it is the whole lot, as before');
 assert.ok(!/S\.scraps=Math\.min\(SCRAP_CAP/.test(section('function scrapBagItems(','function renderBag(')),'no silent clamp');
});

test('chests-2: the chest window promises only what fits, and a full pouch is refused without the two-click arm',()=>{
 const c=chests({gold:1e6,scraps:SCRAP_CAP});c.roll=.5;
 c.run('chestQty.gold=3');c.run('openGoldChest()');c.land();
 const b=c.$('caseScrapBtn');assert.equal(b.textContent,'⚙ Scrap pouch full');
 b.onclick();assert.equal(b.dataset.armed,undefined);assert.equal(c.S.bag.length,3);assert.match(c.msgs.at(-1),/Scrap pouch full/);
 const n=chests({gold:1e6,scraps:SCRAP_CAP-5});n.roll=.5;n.run('chestQty.gold=3');n.run('openGoldChest()');n.land();
 const nb=n.$('caseScrapBtn');assert.equal(nb.textContent,'⚙ Scrap 1 of 3 +4⚙');
 nb.onclick();assert.equal(nb.dataset.armed,'1');
 assert.equal(nb.textContent,'Confirm - scrap 1 of 3?','the Confirm asks what it will really do, as the Bag\'s Scrap All does (round 2, second pass)');
 nb.onclick();
 assert.equal(n.S.scraps,SCRAP_CAP-1);assert.equal(n.S.bag.length,2);
 assert.equal(nb.textContent,'⚙ No room in the scrap pouch (799/800⚙)','what did not fit is still chest gear - and 799/800 is not full (round 2)');
 /* with room for all of it the Confirm is the plain one */
 const r=chests({gold:1e6,scraps:0});r.roll=.5;r.run('chestQty.gold=3');r.run('openGoldChest()');r.land();
 const rb=r.$('caseScrapBtn');rb.onclick();assert.equal(rb.textContent,'Confirm - scrap chest gear?');
 r.advance(3000);assert.equal(rb.textContent,'⚙ Scrap Chest Gear +12⚙');assert.equal(rb.dataset.armed,undefined);
});

test('chests-3 and the missed bypass: no chest is bought or opened in a boss fight or the herd, so no prize equips itself there',()=>{
 const worn={name:'Plain Hauberk',rar:'common',slot:'armor',power:1};
 for(const lock of ['boss','herd']){
  const c=chests({gold:900000,chests:{violethalls:2},autoEquip:true,gear:{weapon:null,armor:worn,trinket:null}});c.roll=.9;c[lock]=true;
  for(const open of ['openChest()','openGoldChest()',"openVioletHallsChest({type:'click'})",'$("respinBtn").onclick()','$("caseAutoBtn").onclick()']){
   c.msgs.length=0;c.run(open);
   assert.equal(c.S.gold,900000,open);assert.equal(c.S.chests.violethalls,2,open);assert.equal(c.S.gear.armor,worn,open);
   assert.equal(c.run('caseSpinning'),false,open);assert.equal(c.run('!!caseAuto'),false,open);
   assert.match(c.msgs.at(-1),lock==='boss'?/No chests mid-boss-fight!/:/The herd allows no chests/,open);
  }
  c[lock]=false;c.run('openGoldChest()');assert.equal(c.S.gold,880000,'the same click works once the lock is gone');
 }
 /* the lock is the gear lock: refused exactly where gearLocked refuses a swap */
 const c=chests();
 for(const [boss,herd] of [[false,false],[true,false],[false,true],[true,true]]){
  c.boss=boss;c.herd=herd;assert.equal(!!c.run('caseLocked()'),c.run('gearLocked()'),`boss ${boss} herd ${herd}`);
 }
 assert.match(section('function gearLocked(){','function gearSwapTo('),/if\(inBossFight\(\)\)[\s\S]*if\(cowLocked\(\)\)/,'caseLockOn mirrors these two');
 /* the shop greys both chest buttons like the potions */
 const shop=section('function renderShop(){','Supplies');
 assert.match(shop,/lock=caseLockOn\(\)/);
 assert.match(shop,/id="chestBtn" \$\{totalGold\(\)<gTot\|\|lock\?'disabled':''\}/);
 assert.match(shop,/id="goldChestBtn" \$\{totalGold\(\)<goTot\|\|lock\?'disabled':''\}/);
});

test('chests-3: an Auto session stops when a boss engages under the window',()=>{
 const c=chests({gold:1e6});c.run("chestQty.gamba=2;curCase='gamba'");
 c.$('caseAutoBtn').onclick();c.advance(1200);c.land();assert.equal(c.S.gold,990000);assert.equal(c.run('!!caseAuto'),true);
 c.boss=true;c.advance(1200);
 assert.equal(c.S.gold,990000,'the next batch is not bought');assert.equal(c.run('caseAuto'),null);
 assert.equal(c.$('caseAutoStatus').textContent,'Auto spin stopped · Boss fight.');
});

test('chests-4 and chests-5: the reel is placed in card units from the marker, so it stops on the prize at any width, even one changed mid-spin',()=>{
 const layouts=[[84,8],[56,6]]; /* desktop and the @media (max-width:600px) cards */
 for(const roll of [0,.25,.5,.75,.9999]){
  const c=chests({gold:1e6});c.roll=roll;c.run('openChest()');
  const start=c.$('caseReel').style.transform;c.land();const end=c.$('caseReel').style.transform;
  for(const t of [start,end])assert.match(t,/^translateX\(calc\(-?[\d.]+ \* \(var\(--cw\) \+ var\(--cgap\)\) - [\d.]+ \* var\(--cw\)\)\)$/);
  const [,a,b]=end.match(/calc\((-?[\d.]+) \* \(var\(--cw\) \+ var\(--cgap\)\) - ([\d.]+) \* var\(--cw\)\)/).map(Number);
  for(const [cw,gap] of layouts){
   const m=-(a*(cw+gap)-b*cw),card=Math.floor(m/(cw+gap)),inside=m-card*(cw+gap);
   assert.equal(card,48,`roll ${roll}, ${cw}px cards: the marker is over the prize card`);
   assert.ok(inside>0.2*cw&&inside<0.8*cw,`roll ${roll}, ${cw}px: inside the card, not in a gap (${inside.toFixed(1)})`);
  }
 }
 const reel=section('function makeReel(','function startCaseSpin(');
 assert.ok(!/innerWidth|getBoundingClientRect/.test(reel),'no card size or marker guessed in JS');
 /* the stylesheet owns the geometry: card width and gap as variables, the reel hung from the marker */
 assert.match(css,/\.casewrap\{[^}]*--cw:84px;--cgap:8px\}/);
 assert.match(css,/\.casereel\{position:absolute;top:12px;left:50%;[^}]*gap:var\(--cgap\)/);
 assert.match(css,/\.casecard\{flex:0 0 var\(--cw\);/);
 const mobile=css.slice(css.indexOf('@media (max-width:600px){'));
 assert.match(mobile.slice(0,400),/\.casewrap,\.caseextra\{height:78px;--cw:56px;--cgap:6px\}/);
 assert.ok(!/\.casecard\{flex:0 0 56px/.test(css)&&!/\.casereel\{top:8px;height:62px;gap:6px\}/.test(css),'no second, fixed card size to disagree with');
 assert.match(css,/\.casemark\{position:absolute;top:-1px;bottom:-1px;left:50%;/,'the marker the reel hangs from');
});

test('chests-6 and chests-7: the farm points at the chests that hold its stock, and the free-case line names no source',()=>{
 /* the two farm lines - the stock tile and the refusal to place - not the whole game, where another text may say it one day */
 const farmLines=['if(have<1)return \'Win one in',"stageMsg('🔒 None owned - win one in"].map(k=>game.split('\n').filter(l=>l.includes(k)));
 for(const found of farmLines){assert.equal(found.length,1);assert.ok(!/in the casino/.test(found[0]),'no game in the casino gives farm stock: '+found[0].trim());}
 assert.match(section('const houseGate=id=>{',"$('farmStoreList').innerHTML=list.map(it=>{"),/if\(have<1\)return 'Win one in '\+\(id==='tjur'\?'GOLD GOLD GOLD':'GAMBAAA!'\);/);
 assert.match(game,/stageMsg\('🔒 None owned - win one in '\+\(id==='tjur'\?'GOLD GOLD GOLD':'GAMBAAA!'\)\+' \(Shop\)',1700\)/);
 const shop=section('function renderShop(){','Supplies');
 assert.match(shop,/farm stock: 🌾 hay seeds, a 🐔 chicken or a 🐄 calf/);
 assert.match(shop,/a Tier II scroll or a 🐂 bull for the farm/);
 assert.ok(!/ODIN/.test(shop),'free cases also come from Violet Halls chests');
 assert.match(shop,/>Your next '\+free\+' case'\+\(free>1\?'s are':' is'\)\+' free\.<\/b>'/);
 /* where the stock really comes from: every grant sits in the chest prizes (farmRefund only gives back a placed one) */
 const grants=game.split('\n').filter(l=>/S\.farm\.inv\.(tjur|cowfarm|chickenfarm|hay)=\(/.test(l));
 assert.equal(grants.length,4);const prizes=section('function prizeValue(type){','const BT_LOOT=');
 for(const l of grants)assert.ok(prizes.includes(l.trim()),l);
});

test('chests-9: free GOLD cases open even when the paid rest of the batch is out of reach - the batch shrinks and says so',()=>{
 const c=chests({gold:50000,freeGoldCases:2});
 assert.deepEqual({...c.run("caseBatch('gold',5)")},{n:4,free:2,cost:40000});
 c.S.gold=0;assert.deepEqual({...c.run("caseBatch('gold',5)")},{n:2,free:2,cost:0});
 c.S.freeGoldCases=0;c.S.gold=50000;assert.deepEqual({...c.run("caseBatch('gold',5)")},{n:5,free:0,cost:100000},'no free cases: all or nothing, as before');
 assert.deepEqual({...c.run("caseBatch('gamba',5)")},{n:5,free:0,cost:25000});
 c.S.freeGoldCases=-3;assert.deepEqual({...c.run("caseBatch('gold',2)")},{n:2,free:0,cost:40000},'a bad counter frees nothing');
 const o=chests({gold:50000,freeGoldCases:2});o.run('chestQty.gold=5');o.run('openGoldChest()');
 assert.equal(o.S.gold,10000);assert.equal(o.S.freeGoldCases,0);assert.equal(o.S.bag.length,4);
 assert.equal(o.msgs.at(-1),'Opening 4 of 5 - not enough gold for the rest');
 const f=chests({gold:0,freeGoldCases:2});f.run("chestQty.gold=5;curCase='gold'");f.run('updateCaseControls()');
 assert.equal(f.$('respinBtn').textContent,'🎁 Respin 2x · FREE');assert.equal(f.$('respinBtn').disabled,false);
 f.$('respinBtn').onclick();assert.equal(f.S.freeGoldCases,0);assert.equal(f.S.bag.length,2);assert.equal(f.S.gold,0);
 const shop=section('function renderShop(){','Supplies');
 assert.match(shop,/const gb=caseBatch\('gold',goQty\),goFree=gb\.free,goTot=gb\.cost;/);
 assert.match(shop,/\$\{gb\.n<goQty\?gb\.n\+' of '\+goQty\+' · ':''\}/);
});

test('teardown contract: caseTeardown drops a turning reel and Auto with no hero, and nothing in flight touches S afterwards',()=>{
 const c=chests({gold:1e6});c.run("chestQty.gamba=3;curCase='gamba'");
 c.$('caseAutoBtn').onclick();c.advance(1200);
 const A=c.S;assert.equal(c.run('caseSpinning'),true);assert.equal(A.bag.length,3,'the prizes were granted at purchase');
 c.hero(null);
 assert.doesNotThrow(()=>c.run('caseTeardown()'));
 assert.equal(c.$('chestFx').classList.contains('open'),false);
 assert.equal(c.run('caseSpinning'),false);assert.equal(c.run('caseAuto'),null);assert.equal(c.run('casePaymentSource'),'gold');
 assert.equal(c.pending(),0,'the Auto timer is gone');
 assert.doesNotThrow(()=>{c.land();c.advance(20000);});
 assert.equal(A.bag.length,3);assert.equal(A.gold,985000);
 for(const click of ['openChest()','openGoldChest()','openVioletHallsChest()','$("respinBtn").onclick()','$("caseAutoBtn").onclick()',
  '$("caseScrapBtn").onclick()','updateCaseControls()'])assert.doesNotThrow(()=>c.run(click),click);
 c.$('chestFx').classList.add('open');assert.doesNotThrow(()=>c.run('hideChestFx()'));
 assert.equal(c.$('chestFx').classList.contains('open'),false,'Close always closes, hero or not');
 assert.ok(section('function caseTeardown(){','function openGoldChest(){').includes('function openChest(){'),'next to the openers');
});

test('teardown contract: a Scrap confirm armed before the hero left does nothing when its disarm timer fires',()=>{
 const c=chests({gold:1e6});c.run('chestQty.gamba=2');c.run('openChest()');c.land();
 c.$('caseScrapBtn').onclick();assert.equal(c.$('caseScrapBtn').dataset.armed,'1');
 c.hero(null);assert.doesNotThrow(()=>c.advance(3500));
});

test('a reel that lands on another hero is taken down without touching that hero',()=>{
 const c=chests({gold:1e6});c.run("chestQty.gamba=5;curCase='gamba'");
 c.$('caseAutoBtn').onclick();c.advance(1200);const A=c.S;
 const B={...A,id:'B',gold:777777,bag:[],farm:{inv:{}},gear:{weapon:null,armor:null,trinket:null}};
 c.hero(B);c.land();c.advance(5000);
 assert.equal(c.$('chestFx').classList.contains('open'),false);assert.equal(c.run('caseAuto'),null);
 assert.equal(B.gold,777777);assert.equal(B.bag.length,0);assert.equal(A.bag.length,5);
});

/* ---------------- round 2 (review-chests' should_fix items) ---------------- */
/* the Bag's own scrap buttons, cut from renderBag and run on the chest floor's real scrap code, with fake buttons */
function bagButtons(c,sel,src){
 const buttons=[],q=c.document.querySelectorAll;
 c.bagBtn=(data={})=>{const b={dataset:{...data},style:{},textContent:'',isConnected:true};buttons.push(b);return b;};
 c.confirms=[];c.confirmBox=(html,yes)=>{c.confirms.push(html);yes();};
 return make=>{buttons.length=0;const made=make();c.document.querySelectorAll=s=>s===sel?made:q(s);c.run(src);c.document.querySelectorAll=q;return made;};
}
const bagSrc=(from,to)=>{const s=section('function renderBag(){','/* --- Gamble Chest opening ceremony');const a=s.indexOf(from),b=s.indexOf(to,a);assert.ok(a>=0&&b>a,from);return s.slice(a,b);};

test('the Bag\'s single Scrap refuses gear the pouch cannot take - it used to destroy it for nothing - and credits through addScraps',()=>{
 const src=bagSrc("document.querySelectorAll('[data-scr]')","document.querySelectorAll('[data-unstar]')");
 assert.ok(!/S\.scraps=Math\.min\(SCRAP_CAP/.test(src),'no clamp that throws the rest away');
 assert.match(src,/addScraps\(scrapVal\(it\)\)/);
 for(const [have,msg,after,kept] of [[SCRAP_CAP-3,'No room in the scrap pouch (797/800⚙)',SCRAP_CAP-3,true],
  [SCRAP_CAP,'Scrap pouch full (800/800⚙) - spend some first',SCRAP_CAP,true],[SCRAP_CAP-4,null,SCRAP_CAP,false],[0,null,4,false]]){
  const c=chests({scraps:have}),rare={name:'Rare One',rar:'rare',slot:'armor',sell:100};c.S.bag=[rare];
  const [b]=bagButtons(c,'[data-scr]',src)(()=>[c.bagBtn({scr:'0'})]);
  c.msgs.length=0;c.logs.length=0;b.onclick();
  assert.equal(c.S.scraps,after,'at '+have);assert.equal(c.S.bag.includes(rare),kept,'at '+have);
  if(msg){assert.equal(c.msgs.at(-1),msg);assert.deepEqual(c.logs,[],'no "+4 ⚙" for scraps that never came');}
  else assert.match(c.logs.at(-1),/Scrapped <span class="lrare">Rare One<\/span> - \+4 ⚙\./);
 }
 /* an inscribed weapon asks first - and is not even asked about when it cannot fit */
 const c=chests({scraps:SCRAP_CAP-3}),w={name:'Mine',rar:'rare',slot:'weapon',insc:{id:'twin',rar:'rare'}};c.S.bag=[w];
 const [b]=bagButtons(c,'[data-scr]',src)(()=>[c.bagBtn({scr:'0'})]);b.onclick();
 assert.deepEqual(c.confirms,[]);assert.equal(c.S.bag.length,1);
 c.S.scraps=0;b.onclick();assert.equal(c.confirms.length,1);assert.equal(c.S.bag.length,0);assert.equal(c.S.scraps,4);
});

test('the Bag\'s Scrap All buttons promise only what fits - all of it, k of n, or no room - and no room is not armed',()=>{
 const rares=()=>['R1','R2'].map(n=>({name:n,rar:'rare',slot:'armor',sell:100})),common=()=>({name:'C1',rar:'common',slot:'armor',sell:1});
 const lab=(scraps,bag,all='Scrap All',ico)=>{const c=chests({scraps});c.S.bag=bag;return c.run(`scrapLabel(S.bag.filter(bagSellable),${JSON.stringify(all)}${ico===undefined?'':','+JSON.stringify(ico)})`);};
 assert.equal(lab(0,[...rares(),common()]),'⚙ Scrap All +9⚙');
 assert.equal(lab(SCRAP_CAP-5,[...rares(),common()]),'⚙ Scrap 2 of 3 +5⚙','one rare and the common fit into 5');
 assert.equal(lab(SCRAP_CAP-3,rares()),'⚙ No room in the scrap pouch (797/800⚙)','room left, but no rare fits');
 assert.equal(lab(SCRAP_CAP,rares()),'⚙ Scrap pouch full');
 assert.equal(lab(SCRAP_CAP,[]),'⚙ Scrap All +0⚙','nothing to scrap is no full pouch');
 assert.equal(lab(SCRAP_CAP-2,[...rares(),common()],'Scrap All',''),'Scrap 1 of 3 +1⚙','the rarity row\'s button: no ⚙ in front');
 assert.equal(lab(SCRAP_CAP-5,[...rares(),common()],'Scrap Chest Gear'),'⚙ Scrap 2 of 3 +5⚙','the chest window\'s button is the same label');
 /* the templates and their 3 s resets all ask scrapLabel, over the same gear scrapBagItems takes, in bag order */
 const bag=section('function renderBag(){','/* --- Gamble Chest opening ceremony');
 assert.match(bag,/id="scrapAll">\$\{scrapLabel\(sellable,'Scrap All'\)\}<\/button>/);
 assert.match(bag,/data-scrrar="\$\{rar\}"[^>]*>\$\{scrapLabel\(S\.bag\.filter\(it=>it\.rar===rar&&bagSellable\(it\)\),'Scrap All',''\)\}<\/button>/);
 assert.match(bag,/b\.textContent=scrapLabel\(mine\(\),'Scrap All',''\)/);assert.match(bag,/sa\.textContent=scrapLabel\(S\.bag\.filter\(bagSellable\),'Scrap All'\)/);
 assert.ok(!/Scrap All \+\$\{|'Scrap All \+'/.test(bag),'no label left that adds up the whole bag');
 /* Scrap All: arms with what it will really do, falls back to the honest label, and a pouch with no room is refused at once */
 const src=bagSrc(" const sa=$('scrapAll');"," const se=$('sellAll');");
 const c=chests({scraps:SCRAP_CAP-5});c.S.bag=[...rares(),common()];
 bagButtons(c,'#none',src)(()=>[]);const sa=c.$('scrapAll');
 sa.onclick();assert.equal(sa.textContent,'Confirm - scrap 2 of 3?');
 c.advance(3000);assert.equal(sa.textContent,'⚙ Scrap 2 of 3 +5⚙');assert.equal(sa.dataset.armed,undefined);
 sa.onclick();sa.onclick();assert.equal(c.S.scraps,SCRAP_CAP);assert.deepEqual(c.S.bag.map(it=>it.name),['R2']);
 const n=chests({scraps:SCRAP_CAP-3});n.S.bag=rares();bagButtons(n,'#none',src)(()=>[]);const na=n.$('scrapAll');
 na.onclick();assert.equal(na.dataset.armed,undefined,'nothing fits: no Confirm step');assert.equal(n.msgs.at(-1),'No room in the scrap pouch (797/800⚙)');
 assert.equal(n.S.bag.length,2);
 /* a rarity row the same way */
 const rsrc=bagSrc(" document.querySelectorAll('[data-scrrar]')"," document.querySelectorAll('[data-eq]')");
 const r=chests({scraps:SCRAP_CAP-3});r.S.bag=rares();const [rb]=bagButtons(r,'[data-scrrar]',rsrc)(()=>[r.bagBtn({scrrar:'rare'})]);
 rb.onclick({stopPropagation(){}});assert.equal(rb.dataset.armed,undefined);assert.equal(r.msgs.at(-1),'No room in the scrap pouch (797/800⚙)');
 r.S.scraps=SCRAP_CAP-4;rb.onclick({stopPropagation(){}});assert.equal(rb.textContent,'Confirm?');
 r.advance(3000);assert.equal(rb.textContent,'Scrap 1 of 2 +4⚙');
 rb.onclick({stopPropagation(){}});r.hero(null);assert.doesNotThrow(()=>r.advance(3000),'a reset timer that outlives the hero (armed, then a kick)');
 const s=chests({scraps:0});s.S.bag=rares();bagButtons(s,'#none',src)(()=>[]);const ss=s.$('scrapAll');
 ss.onclick();s.hero(null);assert.doesNotThrow(()=>s.advance(3000));
});

test('"No room in the scrap pouch (797/800⚙)" wherever the pouch has room but the gear does not fit; "full" only when it is',()=>{
 const rares=()=>['R1','R2'].map(n=>({name:n,rar:'rare',slot:'armor',sell:100}));
 const c=chests({scraps:SCRAP_CAP-3});c.S.bag=rares();
 assert.equal(c.run("scrapBagItems(()=>true,'items')"),false);assert.equal(c.msgs.at(-1),'No room in the scrap pouch (797/800⚙)');
 c.S.scraps=SCRAP_CAP;c.run("scrapBagItems(()=>true,'items')");assert.equal(c.msgs.at(-1),'Scrap pouch full (800/800⚙) - spend some first');
 /* the chest window's label and its refusal */
 const w=chests({gold:1e6,scraps:SCRAP_CAP-3});w.roll=.5;w.run('chestQty.gold=2');w.run('openGoldChest()');w.land();
 const b=w.$('caseScrapBtn');assert.equal(b.textContent,'⚙ No room in the scrap pouch (797/800⚙)');
 b.onclick();assert.equal(b.dataset.armed,undefined);assert.equal(w.msgs.at(-1),'No room in the scrap pouch (797/800⚙)');
 /* one item says so: 'Scrapped 1 item', not '1 items' */
 const one=chests({scraps:0});one.S.bag=[{name:'C',rar:'common',slot:'armor',sell:1}];one.run("scrapBagItems(()=>true,'items')");
 assert.match(one.logs.at(-1),/^Scrapped 1 item - \+1 ⚙\.$/);assert.match(one.msgs.at(-1),/^⚙ Scrapped 1 item for 1 Scraps$/);
 const chestOne=chests({scraps:0});chestOne.S.bag=[{name:'C',rar:'common',slot:'armor',sell:1}];chestOne.run("scrapBagItems(()=>true,'chest items')");
 assert.match(chestOne.logs.at(-1),/^Scrapped 1 chest item - /);
});

test('an Auto session whose hero is gone at its next spin takes the window down - it stopped with "Not enough gold" over the next hero',()=>{
 const c=chests({gold:1e6});c.run("chestQty.gamba=1;curCase='gamba'");
 c.$('caseAutoBtn').onclick();c.advance(1200);c.land();                /* A's first chest has landed; the next is queued */
 const A=c.S;assert.equal(A.gold,995000);assert.equal(c.run('!!caseAuto'),true);
 const B={...A,id:'B',gold:777777,bag:[],farm:{inv:{}},gear:{weapon:null,armor:null,trinket:null}};
 c.hero(B);c.advance(1200);                                            /* a hero change closeCasinoWindows never saw */
 assert.equal(c.$('chestFx').classList.contains('open'),false,'the window was the last hero\'s');
 assert.equal(c.run('caseAuto'),null);assert.equal(c.pending(),0);
 assert.ok(!/Not enough gold/.test(c.$('caseAutoStatus').textContent));
 assert.equal(B.gold,777777);assert.equal(A.gold,995000);
});

test('Respin and Auto are greyed while buying is refused - a boss fight, the Final Hour, the herd - and come back when it is over',()=>{
 const c=chests({gold:1e6});c.run('openChest()');c.land();            /* landed: the window waits, the hero fights on under it */
 const state=()=>({respin:c.$('respinBtn').disabled,auto:c.$('caseAutoBtn').disabled,status:c.$('caseAutoStatus').textContent});
 assert.deepEqual(state(),{respin:false,auto:false,status:' '});
 c.boss=true;c.land();                                                 /* a boss engages: the next frame sees it */
 assert.deepEqual(state(),{respin:true,auto:true,status:'No chests · Boss fight'});
 c.boss=false;c.land();
 assert.deepEqual(state(),{respin:false,auto:false,status:' '},'back when the fight is over - no reopening needed');
 c.herd=true;c.land();assert.deepEqual(state(),{respin:true,auto:true,status:'No chests · The herd'});c.herd=false;c.land();
 /* a Violet Halls chest the same way */
 const v=chests({chests:{violethalls:3}});v.run('openVioletHallsChest()');v.land();
 assert.equal(v.$('respinBtn').disabled,false);v.boss=true;v.land();assert.equal(v.$('respinBtn').disabled,true);
 /* a running Auto keeps its Stop; the lock stops it at its next timer, as before */
 const a=chests({gold:1e6});a.run("chestQty.gamba=1;curCase='gamba'");a.$('caseAutoBtn').onclick();a.advance(1200);
 a.boss=true;a.land();
 assert.equal(a.$('caseAutoBtn').textContent,'■ Stop');assert.equal(a.$('caseAutoBtn').disabled,false,'Stop always works');
 a.advance(1200);assert.equal(a.run('caseAuto'),null);assert.equal(a.$('caseAutoStatus').textContent,'Auto spin stopped · Boss fight.');
 assert.equal(a.$('caseAutoBtn').disabled,true);
 /* the watch lives only while the window does */
 c.run('hideChestFx()');assert.equal(c.run('caseLockRAF'),0);c.boss=true;assert.doesNotThrow(()=>c.land());
 assert.match(section('function updateCaseControls(){','function caseLockWatch('),/rb\.disabled=caseSpinning\|\|!!caseAuto\|\|totalGold\(\)<cost\|\|lock;/);
});
