/* ⚓ The Harbour's line in the Crown Ledger, and the 🧪 test switch that makes a Duke of whoever funds one contract.
 * The harbour line is a SPLIT of the old Exports line, never new money: whatever a steward had balanced stays balanced
 * to the coin. The switch is off in the module, so every other test reads the real peerage. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('../assets/city/economy.js');
const line=(f,id)=>(f.income.find(l=>l.id===id)||{amount:0}).amount;
const built=(s,...ids)=>{for(const id of ids)s.works[id]={left:0,paid:E.WORKS.find(w=>w.id===id).cost};return s;};
const open=()=>{const s=E.create();s.chartered=true;return s;};

test('the harbour has a line of its own, and it is carved out of Exports - the two together are what Exports alone was',()=>{
 const f=E.forecast(open(),{});
 assert.equal(line(f,'exports')+line(f,'harbour'),200*E.COIN,'at the opening of the books: the old 200 a close, to the coin');
 assert.equal(line(f,'harbour'),E.HARBOUR_BASE*E.COIN);assert.ok(line(f,'harbour')>0&&line(f,'harbour')<line(f,'exports'),'berth fees: a modest share before anything is built');
 assert.match(f.income.find(l=>l.id==='harbour').note,/Stone Quay.*would bring far more/);
 /* the line sits right under Exports, where a steward looks for it */
 const ids=f.income.map(l=>l.id);assert.equal(ids.indexOf('harbour'),ids.indexOf('exports')+1);
});

test('what goes by water is the quay, the fleet and the lighthouse - what goes by road stays on Exports',()=>{
 const base=E.forecast(open(),{}),K=E.COIN,fx=id=>E.WORKS.find(w=>w.id===id).fx.exports;
 assert.deepEqual([...E.HARBOUR_WORKS],['quay','fleet','lighthouse']);
 const carters=E.forecast(built(open(),'carters'),{});
 assert.ok(line(carters,'harbour')<=line(base,'harbour')*1.04,'a carters’ yard is no harbour: the berth fees only ride the little trade it brings');
 assert.ok(line(carters,'exports')>=line(base,'exports')+fx('carters')*K);
 const quay=E.forecast(built(open(),'carters','quay'),{});
 assert.ok(line(quay,'harbour')>=line(carters,'harbour')+fx('quay')*K,'the quay lands on the harbour line');
 assert.ok(Math.abs(line(quay,'exports')-line(carters,'exports'))<=line(carters,'exports')*.05,'and leaves the road’s line where it was (but for the trade it brings)');
 const all=E.forecast(built(open(),'carters','quay','fleet','lighthouse'),{});
 assert.ok(line(all,'harbour')>=(E.HARBOUR_BASE+fx('quay')+fx('fleet')+fx('lighthouse'))*K);
 assert.match(all.income.find(l=>l.id==='harbour').note,/Stone Quay, Merchant Fleet, Lighthouse/);
 /* the split never invents or loses a coin: for any mix of works the two lines add up to one number that depends only on the total */
 for(const mix of [['carters'],['carters','quay'],['carters','quay','fleet'],['carters','quay','lighthouse'],['carters','quay','fleet','lighthouse','apprentice','school']]){
  const a=E.forecast(built(open(),...mix),{}),s2=built(open(),...mix);s2.winds.trade=.2;const b=E.forecast(s2,{});
  assert.ok(line(a,'harbour')<=line(a,'exports')+line(a,'harbour'));assert.ok(line(b,'exports')+line(b,'harbour')>line(a,'exports')+line(a,'harbour'),'both ride the trade wind together');
  assert.equal(a.totalIn,a.income.reduce((t,l)=>t+l.amount,0));
 }
});

test('🧪 the test switch is OFF in the module - and ON it makes a Duke of whoever funds one contract',()=>{
 assert.equal(E.TEST.dukeAfterOne,false,'the module, and so every other test, reads the real peerage');
 const rng=()=>.5,knight=()=>{const s=E.create();s.noble.rank=1;E.postBoard(s,rng);return s;};
 const fundOne=s=>{const o=s.noble.offers[0];assert.equal(E.fundContract(s,o.id,1e9).ok,true);let last=null;for(let i=0;i<E.NOBLE_CLOSES;i++)last=E.tick(s,{},rng);return {o,last};};
 const real=knight(),r=fundOne(real);
 assert.equal(real.noble.xp,r.o.xp);assert.ok(real.noble.rank<=2,'one contract is one contract: a Knight, or just a Baron');assert.ok(!r.last.summoned);
 E.TEST.dukeAfterOne=true;
 try{
  const s=knight(),t=fundOne(s),top=E.NOBLE_RANKS.length-1;
  assert.equal(s.noble.rank,top,'a Duke');assert.ok(s.noble.xp>=E.NOBLE_RANKS[top].xp);assert.equal(s.noble.done,1);
  assert.equal(t.last.rankUp,top);assert.equal(t.last.summoned,true,'and the Hand sends for him at once');assert.equal(s.office,1);
  assert.equal(E.nobleView(s).summons,true);
 }finally{E.TEST.dukeAfterOne=false;}
 /* the game turns it on in exactly one marked line, and says so on the board */
 const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
 assert.equal((game.match(/CityEconomy\.TEST\.dukeAfterOne=true;/g)||[]).length,1);
 assert.match(game,/🧪 TEST \(asked for 2026-09-22\)[^]*?Delete this one line[^]*?CityEconomy\.TEST\.dukeAfterOne=true;/);
 assert.match(game,/E\.TEST\.dukeAfterOne&&v\.rank<v\.ranks\.length-1\?'<p class="craft-note">🧪 <b>Test is on:<\/b>/);
});
