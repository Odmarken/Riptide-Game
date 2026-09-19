/* The Crown Ledger, headless: a customary budget runs the city at a small profit, harsh taxes
 * without bread put the crowd on the boulevard, the Tides Bank lends against prestige, and the
 * five-minute clock counts play time only. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');

const quiet=()=>.95;                /* a roll of .95 never triggers an event */

test('a fresh ledger runs the customary budget at a modest profit and settles the people as content',()=>{
 const s=E.create(),f=E.forecast(s,{prestige:0,lvl:1});
 assert.equal(s.treasury,5000);assert.equal(s.loan,0);assert.equal(s.mood,60);assert.equal(s.protest,false);
 assert.deepEqual(s.budget,{tax:10,watch:1,roads:1,relief:1,festival:0,court:1});
 assert.ok(f.net>300&&f.net<700,`net ${f.net}`);
 assert.ok(f.moodTarget>=58&&f.moodTarget<=66,`mood target ${f.moodTarget}`);
 assert.equal(E.moodName(f.moodTarget),'Content');
 assert.equal(f.income.length,7);assert.equal(f.expenses.length,8);
 assert.ok(f.income.every(l=>Number.isInteger(l.amount)&&l.amount>=0&&l.name&&l.icon&&l.note));
 assert.ok(f.expenses.every(l=>Number.isInteger(l.amount)&&l.amount>=0&&l.name&&l.icon&&l.note));
 assert.equal(f.expenses.find(l=>l.id==='guard').amount,E.ROYAL_GUARD*45);
 assert.equal(f.expenses.find(l=>l.id==='interest').amount,0);
 assert.equal(f.expenses.find(l=>l.id==='overdraft').amount,0);
 assert.equal(f.income.find(l=>l.id==='farm').amount,0,'no farm levy without a farm');
});

test('prestige scales every line and the hero\'s trades feed the exports and guild dues',()=>{
 const s=E.create();
 const low=E.forecast(s,{prestige:0,lvl:1}),high=E.forecast(s,{prestige:50,lvl:60});
 assert.ok(Math.abs(E.scale({prestige:50,lvl:60})-6.59)<1e-9);
 for(const id of ['taxes','tolls','imports','licence'])
  assert.ok(high.income.find(l=>l.id===id).amount>low.income.find(l=>l.id===id).amount*6,id);
 const plain=E.forecast(s,{}),skilled=E.forecast(s,{mining:40,smith:5,ench:30,miningTrained:true,enchTrained:true,smelter:true,farmOwned:true,farmLvl:3});
 assert.ok(skilled.income.find(l=>l.id==='exports').amount>plain.income.find(l=>l.id==='exports').amount);
 assert.equal(skilled.income.find(l=>l.id==='guilds').amount,320);
 assert.equal(skilled.income.find(l=>l.id==='farm').amount,270);
 assert.equal(plain.income.find(l=>l.id==='guilds').amount,0);
});

test('a close moves the treasury by the forecast and the temper a third of the way to its target',()=>{
 const s=E.create(),f=E.forecast(s,{});
 const r=E.tick(s,{},quiet);
 assert.equal(s.treasury,5000+f.net);assert.equal(r.net,f.net);assert.deepEqual(r.events,[]);
 assert.equal(s.mood,Math.round(60+(f.moodTarget-60)*.34));
 assert.equal(s.ticks,1);assert.equal(s.history.length,1);assert.equal(s.last,r);
 assert.equal(s.earned,f.totalIn);assert.equal(s.spent,f.totalOut);
 for(let i=0;i<20;i++)E.tick(s,{},quiet);
 assert.equal(s.history.length,E.HISTORY,'the ledger keeps an hour of closes');
 assert.equal(s.history[0].n,21-E.HISTORY+1);
});

test('harsh taxes and no bread start a protest; bread and a lighter tax end it again',()=>{
 const s=E.create();
 assert.ok(E.setBudget(s,'tax',30));assert.ok(E.setBudget(s,'relief',0));
 assert.ok(E.forecast(s,{}).moodTarget<E.PROTEST_START);
 let started=-1;
 for(let i=0;i<12&&started<0;i++){E.tick(s,{},quiet);if(s.protest)started=i;}
 assert.ok(started>=0&&started<8,`the crowd came out on close ${started}`);
 assert.equal(E.moodName(s.mood),'Rioting');
 /* still angry the close after the tax is cut: the crowd goes home at 40, not 25 */
 E.setBudget(s,'tax',5);E.setBudget(s,'relief',2);E.setBudget(s,'festival',1);
 E.tick(s,{},quiet);
 assert.ok(s.mood>=E.PROTEST_START||s.protest,'hysteresis keeps them out until the mood recovers');
 let ended=-1;
 for(let i=0;i<12&&ended<0;i++){E.tick(s,{},quiet);if(!s.protest)ended=i;}
 assert.ok(ended>=0,'the crowd goes home once bread and a lighter tax take hold');
 assert.ok(s.mood>=E.PROTEST_END);
});

test('the Tides Bank lends against prestige, charges half a percent a close and repays only from a treasury in credit',()=>{
 const s=E.create();
 assert.equal(E.creditLimit({prestige:0}),100000);assert.equal(E.creditLimit({prestige:50}),1100000);
 assert.equal(E.borrow(s,{prestige:0},250000),100000,'capped at the credit limit');
 assert.equal(s.loan,100000);assert.equal(s.treasury,105000);assert.equal(s.borrowed,100000);
 assert.equal(E.borrow(s,{prestige:0},1),0);
 assert.equal(E.forecast(s,{}).expenses.find(l=>l.id==='interest').amount,500);
 assert.equal(E.repay(s,40000),40000);assert.equal(s.loan,60000);assert.equal(s.treasury,65000);
 s.treasury=-100;
 assert.equal(E.repay(s,1000),0,'nothing to repay with when the treasury is below zero');
 const f=E.forecast(s,{});
 assert.equal(f.expenses.find(l=>l.id==='overdraft').amount,1);
 assert.ok(f.moodTarget<E.forecast(E.create(),{}).moodTarget-10,'debt sours the mood');
});

test('gold moves between the treasury and the purse only as far as both can carry',()=>{
 const s=E.create();
 assert.equal(E.withdraw(s,10000,2500),2500,'the purse has room for 2 500 only');
 assert.equal(s.treasury,2500);
 assert.equal(E.withdraw(s,10000,1e9),2500,'then whatever the treasury still holds');
 assert.equal(s.treasury,0);assert.equal(E.withdraw(s,1,1e9),0);
 assert.equal(E.deposit(s,7000,4000),4000,'the purse only has 4 000');
 assert.equal(s.treasury,4000);assert.equal(E.deposit(s,-5,100),0);
});

test('the clock counts play time in five-minute closes and survives a long absence',()=>{
 const s=E.create();
 assert.equal(E.advance(s,299),0);assert.equal(E.advance(s,1),1);assert.equal(s.clock,0);
 assert.equal(E.advance(s,1234),4);assert.ok(Math.abs(s.clock-34)<1e-9);
 assert.equal(E.advance(s,-50),0,'time never runs backwards');
});

test('events are gated on the budget, scaled by prestige and only roll on a low draw',()=>{
 const s=E.create();
 s.budget.watch=0;
 const r=E.tick(s,{prestige:10},(()=>{let i=0;return()=>[.1,.0][i++%2];})());
 assert.equal(r.events.length,1);
 assert.ok(r.events[0].includes('caravan'),r.events[0]);
 assert.equal(r.net-E.forecast(E.normalize({...E.create(),budget:{...E.create().budget,watch:0}}),{prestige:10}).net,Math.round(260*2));
 const gated=E.EVENTS.filter(e=>e.when);
 assert.ok(gated.some(e=>e.when({budget:{watch:0}},{})&&!e.when({budget:{watch:1}},{})),'the fire nobody fights needs a disbanded watch');
 assert.ok(E.EVENTS.every(e=>e.text&&e.w>0));
 assert.deepEqual(E.tick(E.create(),{},quiet).events,[]);
});

test('normalize repairs a damaged save and accepts a missing one',()=>{
 const fresh=E.normalize(undefined);
 assert.deepEqual(fresh,E.create());
 const s=E.normalize({treasury:'12.7',loan:-5,mood:400,clock:9999,ticks:'x',protest:1,budget:{tax:11,watch:9,roads:-1,relief:'2'},history:[null,{n:1,net:5},'bad']});
 assert.equal(s.treasury,13);assert.equal(s.loan,0);assert.equal(s.mood,100);assert.equal(s.clock,E.TICK_SECONDS);assert.equal(s.ticks,0);assert.equal(s.protest,true);
 assert.deepEqual(s.budget,{tax:10,watch:3,roads:0,relief:2,festival:0,court:1});
 assert.deepEqual(s.history,[{n:1,net:5}]);assert.deepEqual(s.last,{n:1,net:5});
 assert.equal(E.setBudget(s,'tax',12),false);assert.equal(E.setBudget(s,'watch',4),false);assert.equal(E.setBudget(s,'nope',1),false);
});
