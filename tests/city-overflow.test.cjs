const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../assets/city/economy.js');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

function harness(gold,overflow){
 const city=E.create();
 E.charter(city);city.treasury=1000000;
 city.seasons=[{n:1,grade:'A',in:1000000,out:0,bonusTaken:0}];
 const saved=[];
 const c={S:{gold,overflow,city},CityEconomy:E,ledgerNote:'',
  cityContext:()=>({}),cityLook:()=>({}),cityApplyAll:()=>{},cityStreetNews:()=>{},
  $:()=>({style:{display:'none'}}),log:()=>{},stageMsg:()=>{},
  renderHUD:()=>{},ledgerRefresh:()=>{},sfx:{buy(){},warn(){}},
  fmtGold:n=>String(n),fmtSigned:n=>String(n),
  goldRoom:()=>{throw new Error('Crown payouts must not depend on carried-gold capacity');},
  save:()=>saved.push(JSON.parse(JSON.stringify(c.S)))};
 vm.createContext(c);
 vm.runInContext(section('function cityLedgerClose(){','/* 🎭 what changed'),c);
 vm.runInContext(section('function ledgerAction(act,k,v){','function openLedger('),c);
 vm.runInContext(section('function ledgerBonus(b){','function ledgerBank('),c);
 return {c,saved};
}

test('salary and royal purse go entirely to overflow with empty, near-full and full carried gold',()=>{
 for(const gold of [0,99999,100000])for(const overflow of [undefined,500]){
  const {c,saved}=harness(gold,overflow);
  c.CityEconomy={...E,tick:()=>({salary:8000,purse:12000,net:0,treasury:1000000,mood:50,events:[],unrest:[]}),canClaim:()=>false};
  c.cityLedgerClose();
  assert.equal(c.S.gold,gold);
  assert.equal(c.S.overflow,(overflow||0)+20000);
  assert.equal(saved.at(-1).overflow,c.S.overflow);
 }
});

test('season bonus stays claimable with full carried gold, pays overflow and cannot be claimed twice',()=>{
 for(const gold of [0,99999,100000]){
  const {c,saved}=harness(gold,500);
  const html=c.ledgerBonus(E.bonusView(c.S.city));
  assert.match(html,/Take 200000 ◉ to overflow/);
  assert.doesNotMatch(html,/ disabled/);
  c.ledgerAction('bonus',null,'all');
  assert.equal(c.S.gold,gold);
  assert.equal(c.S.overflow,200500);
  assert.equal(c.S.city.treasury,800000);
  assert.equal(saved.at(-1).overflow,200500);
  c.ledgerAction('bonus',null,'all');
  assert.equal(c.S.overflow,200500);
  assert.equal(c.S.city.treasury,800000);
 }
});

test('season bonus still respects the treasury and refuses a loss or empty treasury',()=>{
 for(const treasury of [0,-100,123]){
  const {c}=harness(100000,undefined);c.S.city.treasury=treasury;
  c.ledgerAction('bonus',null,'all');
  assert.equal(c.S.gold,100000);
  assert.equal(c.S.overflow,treasury>0?123:undefined);
  assert.equal(c.S.city.treasury,treasury>0?0:treasury);
 }
 const {c}=harness(100000,500);c.S.city.seasons[0].out=2000000;
 c.ledgerAction('bonus',null,'all');
 assert.equal(c.S.overflow,500);
 assert.equal(c.S.city.treasury,1000000);
});

test('declining a season bonus leaves both wallets untouched and survives reloading',()=>{
 for(const treasury of [1000000,0,-100]){
  const {c,saved}=harness(100000,500);c.S.city.treasury=treasury;
  assert.match(c.ledgerBonus(E.bonusView(c.S.city)),/data-lact="declineBonus">Decline/);
  c.ledgerAction('declineBonus');
  assert.equal(c.S.gold,100000);
  assert.equal(c.S.overflow,500);
  assert.equal(c.S.city.treasury,treasury);
  assert.equal(saved.at(-1).city.seasons[0].bonusDeclined,true);
  c.S.city=E.normalize(saved.at(-1).city);
  const view=E.bonusView(c.S.city);
  assert.equal(view.declined,true);
  assert.equal(view.open,false);
  assert.equal(view.why,'declined');
  const html=c.ledgerBonus(view);
  assert.match(html,/Your season bonus · declined/);
  assert.doesNotMatch(html,/data-lact="(?:bonus|declineBonus)"/);
  assert.equal(E.takeBonus(c.S.city).ok,false);
  assert.equal(E.declineBonus(c.S.city).ok,false);
  assert.equal(c.S.city.treasury,treasury);
  c.S.city.seasons.push({n:2,grade:'A',in:1000000,out:0,bonusTaken:0});
  c.S.city.treasury=1000000;
  assert.equal(E.bonusView(c.S.city).open,true);
  assert.equal(E.takeBonus(c.S.city).gold,200000);
 }
});

test('a taken bonus, a loss and a missing season cannot be declined',()=>{
 const {c}=harness(0,0);
 E.takeBonus(c.S.city);
 assert.equal(E.declineBonus(c.S.city).ok,false);
 assert.equal(E.bonusView(c.S.city).why,'taken');
 c.S.city.seasons=[{n:2,in:0,out:100,bonusTaken:0}];
 assert.equal(E.declineBonus(c.S.city).ok,false);
 c.S.city.seasons=[];
 assert.equal(E.declineBonus(c.S.city).ok,false);
});
