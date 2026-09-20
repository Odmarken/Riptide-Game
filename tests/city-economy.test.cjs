/* The Crown Ledger, headless: an empty strongroom until the founding loan is signed, a customary
 * budget that does not quite pay for itself, harsh taxes without bread put the crowd on the
 * boulevard, the Tides Bank lends along a line, and the five-minute clock counts play time only.
 * The bank's seasons, cover and bailiffs have a file of their own (city-bank.test.cjs).
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
/* the books as they stand the moment the founding loan is signed */
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};   /* ...with a granary that will not run out under a test about something else */
const K=E.COIN;                     /* the tables are in tens of gold */

const quiet=()=>.95;                /* a roll of .95 never triggers an event */

test('the strongroom starts empty and the books stay shut until the founding loan is signed',()=>{
 const s=E.create();
 assert.equal(s.treasury,0);assert.equal(s.loan,0);assert.equal(s.limit,0);assert.equal(s.chartered,false);assert.equal(s.season,null);assert.equal(s.v,E.VERSION);
 assert.equal(E.advance(s,99999),0,'no close falls before the signing');assert.equal(s.clock,0);
 assert.equal(E.borrow(s,{},1000),0,'and the bank lends nothing but the founding loan');
 const r=E.charter(s);
 assert.ok(r.ok);assert.equal(s.chartered,true);assert.equal(s.treasury,E.FOUNDING_LOAN);assert.equal(s.loan,E.FOUNDING_LOAN);assert.equal(E.FOUNDING_LOAN,500000);
 assert.equal(s.limit,E.FOUNDING_LOAN+E.RESERVE_LINE);assert.equal(s.season.n,1);assert.equal(s.season.target,450000,'a tenth of it back by the end of the season');
 assert.equal(E.charter(s),null,'signed once');
 assert.equal(E.advance(s,E.TICK_SECONDS),1,'and now the clock runs');
});

test('the customary budget does not pay for itself - the King alone sees to that - and settles the people as content',()=>{
 const s=open(),f=E.forecast(s,{});
 assert.equal(s.mood,60);assert.equal(s.protest,false);
 assert.deepEqual(s.budget,{tax:10,rent:1,fee:1,duty:1,tithe:1,watch:1,roads:1,relief:1,festival:0,court:1,clean:1,learn:1,food:1,purse:1});
 assert.ok(f.net<-2000&&f.net>-6000,`net ${f.net}: doing nothing loses money at every close`);
 const purse=f.expenses.find(l=>l.id==='purse').amount;
 assert.ok(purse>=E.ROYAL_GUARD*E.GUARD_WAGE*K&&purse>f.expenses.find(l=>l.id==='watch').amount*2,'a King is the dearest thing a city keeps: '+purse);
 assert.ok(f.net+purse>0,'without him the budget would balance');
 assert.ok(f.income.find(l=>l.id==='church').amount>0,'the cathedral pays its share');
 assert.ok(f.moodTarget>=58&&f.moodTarget<=66,`mood target ${f.moodTarget}`);
 assert.equal(E.moodName(f.moodTarget),'Content');
 assert.equal(f.income.length,10);assert.equal(f.expenses.length,18);
 assert.equal(f.expenses.find(l=>l.id==='grain').amount,0,'no standing shipments until the steward starts them');
 assert.equal(f.expenses.find(l=>l.id==='unrest').amount,0);assert.equal(f.expenses.find(l=>l.id==='obstruction').amount,0);
 assert.deepEqual(s.incidents,[]);assert.equal(s.petition,null);assert.equal(E.favour(s),60);
 assert.ok(f.income.every(l=>Number.isInteger(l.amount)&&l.amount>=0&&l.name&&l.icon&&l.note));
 assert.ok(f.expenses.every(l=>Number.isInteger(l.amount)&&l.amount>=0&&l.name&&l.icon&&l.note));
 assert.equal(f.expenses.find(l=>l.id==='guard').amount,E.ROYAL_GUARD*E.GUARD_WAGE*K);
 assert.equal(f.expenses.find(l=>l.id==='interest').amount,Math.round(E.FOUNDING_LOAN*E.LOAN_RATE));
 assert.equal(f.expenses.find(l=>l.id==='overdraft').amount,0);
 assert.equal(f.income.find(l=>l.id==='farm').amount,0,'no farm levy without a farm');
});

test('one city, one currency: prestige changes nothing, and what the hero adds from their own trades is a perk, not a second treasury',()=>{
 const s=open();
 assert.equal(E.scale({prestige:50,lvl:60}),K);assert.equal(E.scale({}),K);
 assert.deepEqual(E.forecast(s,{prestige:50,lvl:60}).income,E.forecast(s,{prestige:0,lvl:1}).income,'500 000 is 500 000 for every steward');
 const plain=E.forecast(s,{}),skilled=E.forecast(s,{mining:40,smith:5,ench:30,miningTrained:true,enchTrained:true,smelter:true,farmOwned:true,farmLvl:3});
 assert.ok(skilled.income.find(l=>l.id==='exports').amount>plain.income.find(l=>l.id==='exports').amount);
 assert.equal(skilled.income.find(l=>l.id==='guilds').amount,80*K);
 assert.equal(skilled.income.find(l=>l.id==='farm').amount,60*K);
 /* however far the hero has come: a few thousand a close at the very most, and never enough to carry the city */
 const maxed=E.forecast(s,{mining:999,smith:99,ench:999,miningTrained:true,enchTrained:true,smelter:true,farmOwned:true,farmLvl:99});
 assert.ok(maxed.totalIn-plain.totalIn<=3000&&maxed.totalIn-plain.totalIn>=1500,'perk '+(maxed.totalIn-plain.totalIn));
 assert.ok(maxed.net<0,'a city nobody runs loses money whoever its steward is: '+maxed.net);
 assert.equal(plain.income.find(l=>l.id==='guilds').amount,0);
});

test('a close moves the treasury by the forecast and the temper a third of the way to its target',()=>{
 const s=open(),f=E.forecast(s,{});
 const r=E.tick(s,{},quiet);
 assert.equal(s.treasury,E.FOUNDING_LOAN+f.net);assert.equal(r.net,f.net);assert.deepEqual(r.events,[]);
 assert.equal(s.mood,Math.round(60+(f.moodTarget-60)*.34));
 assert.equal(s.ticks,1);assert.equal(s.history.length,1);assert.equal(s.last,r);
 assert.equal(s.earned,f.totalIn);assert.equal(s.spent,f.totalOut);
 for(let i=0;i<20;i++)E.tick(s,{},quiet);
 assert.equal(s.history.length,E.HISTORY,'the ledger keeps an hour of closes');
 assert.equal(s.history[0].n,21-E.HISTORY+1);
});

test('harsh taxes and no bread start a protest; bread and a lighter tax end it again',()=>{
 const s=open();
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

test('the Tides Bank lends along its line, charges half a percent a close and is repaid only from a treasury in credit',()=>{
 const s=open();
 assert.equal(E.creditLimit({}),650000);assert.equal(E.creditLimit({prestige:50}),650000,'the line is the bank\'s, not the hero\'s');
 assert.equal(E.borrow(s,{},1e9),E.RESERVE_LINE,'the reserve is all that is left on the line');
 assert.equal(s.loan,650000);assert.equal(s.treasury,650000);assert.equal(s.borrowed,650000);
 assert.equal(E.borrow(s,{},1),0);
 assert.equal(E.forecast(s,{}).expenses.find(l=>l.id==='interest').amount,3250);
 assert.equal(E.repay(s,40000),40000);assert.equal(s.loan,610000);assert.equal(s.treasury,610000);assert.equal(s.repaid,40000);
 s.treasury=-100;
 assert.equal(E.repay(s,1000),0,'nothing to repay with when the treasury is below zero');
 const f=E.forecast(s,{});
 assert.equal(f.expenses.find(l=>l.id==='overdraft').amount,1);
 assert.ok(f.moodTarget<E.forecast(open(),{}).moodTarget-10,'a crown that cannot pay sours the mood');
});

test('only what the treasury holds beyond its debt can be carried to the purse, and only as far as the purse has room',()=>{
 const s=open();
 assert.equal(E.withdraw(s,10000,1e9,{}),0,'borrowed gold never leaves the strongroom');
 s.treasury=E.FOUNDING_LOAN+20000;
 assert.equal(E.withdraw(s,30000,2500,{}),2500,'the purse has room for 2 500 only');
 assert.equal(E.withdraw(s,1e9,1e9,{}),17500,'then the rest of the surplus');
 assert.equal(s.treasury,E.FOUNDING_LOAN);assert.equal(E.withdraw(s,1,1e9,{}),0);
 assert.equal(E.deposit(s,7000,4000,{}),4000,'the purse only has 4 000');
 assert.equal(s.treasury,E.FOUNDING_LOAN+4000);assert.equal(E.deposit(s,-5,100,{}),0);
});

test('the clock counts play time in five-minute closes and survives a long absence',()=>{
 const s=open();
 assert.equal(E.advance(s,299),0);assert.equal(E.advance(s,1),1);assert.equal(s.clock,0);
 assert.equal(E.advance(s,1234),4);assert.ok(Math.abs(s.clock-34)<1e-9);
 assert.equal(E.advance(s,-50),0,'time never runs backwards');
});

test('events are gated on the budget and only roll on a low draw',()=>{
 const s=open();
 s.budget.watch=0;
 const before=E.forecast(s,{}).net;
 const r=E.tick(s,{prestige:10},(()=>{let i=0;return()=>[.1,.0][i++%2];})());
 assert.equal(r.events.length,1);
 assert.ok(r.events[0].includes('caravan'),r.events[0]);
 assert.equal(r.net-before,260*K);
 const gated=E.EVENTS.filter(e=>e.when);
 assert.ok(gated.some(e=>e.when({budget:{watch:0}},{})&&!e.when({budget:{watch:1}},{})),'the fire nobody fights needs a disbanded watch');
 assert.ok(E.EVENTS.every(e=>e.text&&e.w>0));
 assert.deepEqual(E.tick(open(),{},quiet).events,[]);
});

test('normalize repairs a damaged save, accepts a missing one and closes the books of an older one',()=>{
 assert.deepEqual(E.normalize(undefined),E.create());
 assert.deepEqual(E.normalize({treasury:88000,loan:0,mood:90,budget:{tax:5}}),E.create(),'a save from before the founding loan starts again from the empty strongroom');
 const s=E.normalize({v:E.VERSION,chartered:1,treasury:'12.7',loan:-5,limit:'650000',rate:9,mood:400,clock:9999,ticks:'x',protest:1,budget:{tax:11,watch:9,roads:-1,relief:'2'},history:[null,{n:1,net:5},'bad']});
 assert.equal(s.treasury,13);assert.equal(s.loan,0);assert.equal(s.limit,650000);assert.equal(s.rate,E.MAX_RATE);assert.equal(s.mood,100);assert.equal(s.clock,E.TICK_SECONDS);assert.equal(s.ticks,0);assert.equal(s.protest,true);
 assert.equal(s.chartered,true);assert.equal(s.season.n,1);assert.deepEqual(s.season.series,[]);
 assert.deepEqual(s.budget,{tax:10,rent:1,fee:1,duty:1,tithe:1,watch:3,roads:0,relief:2,festival:0,court:1,clean:1,learn:1,food:1,purse:1});
 assert.deepEqual(s.history,[{n:1,net:5}]);assert.deepEqual(s.last,{n:1,net:5});
 assert.equal(E.setBudget(s,'tax',12),false);assert.equal(E.setBudget(s,'watch',4),false);assert.equal(E.setBudget(s,'nope',1),false);
});

/* a scripted rng: the values are handed out in order, then it stays quiet */
const script=(...v)=>{let i=0;return()=>i<v.length?v[i++]:.95;};

test('a brawl is rolled at a close, bites and spreads until the watch is doubled, and then ends',()=>{
 const s=open();
 /* no event (.9), trouble (.0 < .22), the first kind in the pool (.0 = brawl), no petition (.9) */
 const r=E.tick(s,{},script(.9,.0,.0,.9));
 assert.deepEqual(s.incidents,[{id:'brawl',age:0}]);
 assert.ok(r.unrest.some(u=>/Brawl on the boulevard/.test(u)&&/Double the City Watch/.test(u)));
 E.attend(s);                        /* the steward is at the table: this test is about the brawl */
 const f0=E.forecast(s,{}),i0=f0.incidents[0];
 assert.equal(i0.line,'watch');assert.equal(i0.level,2);assert.equal(i0.met,false);assert.equal(i0.street,true);
 assert.equal(f0.expenses.find(l=>l.id==='unrest').amount,140*K);
 assert.equal(f0.moodTarget,E.forecast(open(),{}).moodTarget-6,'it pulls the mood target down');
 assert.ok(f0.moodFactors.some(x=>/Brawl/.test(x.name)&&x.value===-6));
 const mood=s.mood;E.tick(s,{},quiet);
 assert.equal(s.incidents[0].age,1);assert.ok(s.mood<mood,'left alone it bites');
 const f1=E.forecast(s,{});
 assert.equal(f1.incidents[0].gold,175*K);assert.equal(f1.incidents[0].mood,-7,'and spreads: a quarter worse per close');
 for(let i=0;i<6;i++)E.tick(s,{},quiet);
 assert.equal(E.forecast(s,{}).incidents[0].gold,280*K,'capped at twice as bad');
 assert.ok(E.setBudget(s,'watch',2));
 assert.equal(E.forecast(s,{}).incidents[0].met,true);
 const end=E.tick(s,{},quiet);
 assert.deepEqual(s.incidents,[]);assert.ok(end.unrest.some(u=>/dealt with/.test(u)));
});

test('a strong enough line nips trouble in the bud, and gold can end an incident on the spot',()=>{
 const s=open();E.setBudget(s,'watch',2);
 const r=E.tick(s,{},script(.9,.0,.0,.9));
 assert.deepEqual(s.incidents,[]);assert.ok(r.unrest.some(u=>/nipped in the bud/.test(u)));
 const t=open();E.tick(t,{},script(.9,.0,.0,.9));
 const cost=E.forecast(t,{}).incidents[0].cost;
 assert.equal(cost,(600+2*500)*K);
 t.treasury=cost-1;assert.equal(E.settle(t,{},'brawl'),0,'not from an empty treasury');
 t.treasury=cost+50;assert.equal(E.settle(t,{},'brawl'),cost);
 assert.equal(t.treasury,50);assert.deepEqual(t.incidents,[]);assert.equal(E.settle(t,{},'brawl'),0);
});

test('trouble is random, never doubled up, never more than two at once, and likelier in a sour, unwatched city',()=>{
 const kinds=new Set();
 for(let seed=1;seed<=40;seed++){
  let x=seed*2654435761%4294967296;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  const s=open();E.setBudget(s,'watch',0);E.setBudget(s,'relief',0);
  for(let i=0;i<20;i++){
   E.tick(s,{},rng);
   assert.ok(s.incidents.length<=E.MAX_INCIDENTS);
   assert.equal(new Set(s.incidents.map(i=>i.id)).size,s.incidents.length);
   s.incidents.forEach(i=>kinds.add(i.id));
  }
 }
 assert.ok(kinds.size>=5,'saw '+[...kinds].join(', '));
 assert.ok(E.INCIDENTS.every(d=>E.LINES[d.line]&&E.LINES[d.line].levels[d.level]&&d.mood<0&&d.gold<=0&&d.w>0&&d.fix&&d.text));
 assert.deepEqual(E.INCIDENTS.filter(d=>d.street).map(d=>d.id),['brawl','gang']);
});

test('the council: six seats that drift toward what their line deserves, and a favour that pays or costs',()=>{
 const s=open();
 assert.deepEqual(Object.keys(s.council),E.COUNCIL.map(c=>c.id));assert.equal(E.COUNCIL.length,6);
 E.setBudget(s,'watch',3);E.setBudget(s,'relief',0);
 for(let i=0;i<10;i++){E.attend(s);E.tick(s,{},quiet);}
 assert.ok(s.council.sword>=85,'the Lord Commander loves a Royal watch: '+s.council.sword);
 assert.ok(s.council.bread<=30,'the High Almoner does not forgive an empty granary: '+s.council.bread);
 const v=E.councilView(s,{});
 assert.equal(v.seats.length,6);assert.equal(v.favour,E.favour(s));assert.ok(v.seats.every(x=>x.say&&x.title&&x.who));
 /* devoted: trade and credit; hostile: padded bills */
 const hi=open();for(const k of Object.keys(hi.council))hi.council[k]=90;
 const lo=open();for(const k of Object.keys(lo.council))lo.council[k]=20;
 const base=E.forecast(open(),{}),up=E.forecast(hi,{}),down=E.forecast(lo,{});
 assert.ok(up.income.find(l=>l.id==='tolls').amount>base.income.find(l=>l.id==='tolls').amount);
 assert.equal(up.creditLimit,715000,'a devoted council is worth a tenth more on the line');assert.equal(base.creditLimit,650000);
 assert.ok(down.expenses.find(l=>l.id==='obstruction').amount>0);assert.equal(base.expenses.find(l=>l.id==='obstruction').amount,0);
 assert.equal(E.favourName(90),'Devoted');assert.equal(E.favourName(20),'Hostile');
});

test('petitions arrive at random, can be granted or refused, and lapse after two closes',()=>{
 const s=open();
 /* no event, no trouble (.9 >= chance), a petition (.0 < .35), the first on the list (.0) */
 const r=E.tick(s,{},script(.9,.9,.0,.0));
 assert.deepEqual(s.petition,{id:'halberds',age:0});assert.ok(r.unrest.some(u=>/petition/.test(u)));
 const v=E.councilView(s,{}).petition;
 assert.equal(v.cost,900*K);assert.equal(v.seat,'sword');assert.equal(v.left,2);
 const sword=s.council.sword,mood=s.mood;
 s.treasury=100;assert.equal(E.answer(s,{},true).ok,false,'cannot grant what the treasury cannot cover');
 s.treasury=50000;const yes=E.answer(s,{},true);
 assert.equal(yes.accepted,true);assert.equal(s.treasury,50000-900*K);assert.equal(s.council.sword,sword+14);assert.equal(s.mood,mood+1);assert.equal(s.petition,null);
 assert.equal(E.answer(s,{},true),null);
 const t=open();E.tick(t,{},script(.9,.9,.0,.0));
 const before=t.council.sword;assert.equal(E.answer(t,{},false).accepted,false);assert.equal(t.council.sword,before-8);
 const u=open();E.tick(u,{},script(.9,.9,.0,.0));E.tick(u,{},quiet);assert.equal(u.petition.age,1);
 const lapse=E.tick(u,{},quiet);assert.equal(u.petition,null);assert.ok(lapse.unrest.some(x=>/lapsed/.test(x)));
 assert.ok(E.PETITIONS.every(p=>E.COUNCIL.some(c=>c.id===p.seat)&&p.text&&p.favour>0));
});

test('normalize repairs unrest, council and petition from a damaged save',()=>{
 const s=E.normalize({v:E.VERSION,incidents:[{id:'brawl',age:'3'},{id:'brawl',age:1},{id:'nope'},null,{id:'gang',age:-4},{id:'hunger'}],council:{coin:140,sword:'x'},petition:{id:'ghost'}});
 assert.deepEqual(s.incidents,[{id:'brawl',age:3},{id:'gang',age:0}]);
 assert.equal(s.council.coin,100);assert.equal(s.council.sword,60);assert.equal(s.council.bread,60);
 assert.equal(s.petition,null);
 assert.deepEqual(E.normalize({v:E.VERSION,petition:{id:'audit',age:1}}).petition,{id:'audit',age:1});
});
