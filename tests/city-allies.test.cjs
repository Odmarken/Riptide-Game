/* The Master of Coin's own salary, and the Allies: three cities and two ports courted with the treasury's
 * gold, paying a return as partners and their whole yield once bought. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};
const quiet=()=>.95;
const closes=(s,n)=>{let last;for(let i=0;i<n;i++){E.attend(s);last=E.tick(s,{},quiet);}return last;};
const line=(f,side,id)=>(f[side].find(l=>l.id===id)||{amount:0}).amount;

test('the office is unpaid until its holder says otherwise; a tenth of the line reaches the hero, and the city notices',()=>{
 const s=open();
 assert.equal(s.budget.salary,0);assert.equal(closes(s,1).salary,0);const base=E.forecast(s,{});assert.equal(line(base,'expenses','salary'),0);
 assert.deepEqual(E.LINES.salary.levels.map(l=>l.cost*E.COIN),[0,10000,30000,80000]);
 assert.ok(E.setBudget(s,'salary',3));
 const f=E.forecast(s,{}),r=closes(s,1);
 assert.equal(line(f,'expenses','salary'),80000);assert.equal(r.salary,8000,'a tenth of it, in the hero’s own gold');
 assert.equal(f.moodTarget,base.moodTarget-6);assert.ok(f.trustDelta<base.trustDelta-.7,'shameless costs trust at every close');
 assert.ok(f.net<base.net-79000);
 /* in the red it can be cut, not raised - and it is not paid */
 s.treasury=-5000;assert.equal(E.setBudget(s,'salary',0),true);assert.equal(E.setBudget(s,'salary',2),false);
 s.budget.salary=2;s.loan=E.creditLimit({},s);
 const red=E.forecast(s,{});assert.equal(line(red,'expenses','salary'),0,'and charges the treasury nothing for it either');assert.match(red.expenses.find(l=>l.id==='salary').note,/suspended/);
 assert.equal(E.tick(s,{},quiet).salary,0,'a treasury in the red pays its master nothing');
});

test('three cities and two ports: the ports are the end game and want a quay and a fleet',()=>{
 assert.deepEqual(E.ALLIES.map(a=>a.kind),['city','city','city','port','port']);
 assert.deepEqual(E.ALLIES.map(a=>a.name),['Ravenholt','Emberfall','Silverfjord','Kraken’s Rest','Port Meridian']);
 for(const a of E.ALLIES){assert.ok(a.price>=a.worth*8&&a.yield>0&&a.text&&a.perkText&&a.ruler.portrait&&a.ruler.patience>=3&&a.ruler.insultAt<.85);assert.ok(a.price/a.yield>=45&&a.price/a.yield<=65,'pays for itself in fifty or sixty closes: '+a.id);}
 assert.deepEqual(E.ALLIES.map(a=>a.ruler.name),['King Roderic Varn','King Aldric Cindermane','King Sigvald Silverfjord','Trade Officer Corvin Saltmarsh','Trade Officer Isaura Venn'],'a king for each city, a trade officer for each port');
 assert.equal(new Set(E.ALLIES.map(a=>a.ruler.temper)).size,5,'and no two of them bargain alike');
 /* courting must not be a money printer: a full stake pays for itself slower than the public works do (about twenty closes),
    and owning the place has to be worth more than merely holding all of its paper */
 for(const a of E.ALLIES){const partner=a.yield*E.PARTNER_SHARE;assert.ok(a.worth/partner>=30&&a.worth/partner<=60,a.id+' stake pays back in '+Math.round(a.worth/partner)+' closes');assert.ok(a.yield>=partner*4);}
 const fs=require('node:fs'),path=require('node:path');for(const a of E.ALLIES)assert.ok(fs.existsSync(path.join(__dirname,'..','assets','city',a.ruler.portrait+'.png')),a.ruler.portrait);
 assert.ok(Math.min(...E.ALLIES.filter(a=>a.kind==='port').map(a=>a.worth))>=2.5*Math.max(...E.ALLIES.filter(a=>a.kind==='city').map(a=>a.worth)));
 const s=open();s.treasury=5e7;
 /* 👑 (2026-09-22) a steward is refused everywhere; the envoys ride for a crowned head */
 assert.equal(E.alliesView(s).crowned,false);assert.equal(E.allyInvest(s,'ravenholt',1e6).ok,false);assert.match(E.allyInvest(s,'ravenholt',1e6).text,/crown/);
 s.crowned=true;assert.equal(E.alliesView(s).crowned,true);
 assert.equal(E.allyInvest(s,'krakensrest',1e6).ok,false);assert.match(E.allyInvest(s,'krakensrest',1e6).text,/Stone Quay/);
 s.works.quay={left:0};assert.equal(E.allyInvest(s,'krakensrest',1e6).ok,true);
 assert.match(E.allyInvest(s,'meridian',1e6).text,/Merchant Fleet/);
 assert.equal(E.alliesView(s).list.find(a=>a.id==='meridian').locked,'Merchant Fleet');
});

test('an envoy takes three closes; a stake makes a partner, then an ally, and after a while the place can be bought',()=>{
 const s=open();s.treasury=2e7;s.crowned=true;
 const r=E.allyInvest(s,'ravenholt',600000);assert.equal(r.ok,true);assert.equal(s.treasury,2e7-600000);
 closes(s,2);assert.equal(s.allies.ravenholt.stake,0);closes(s,1);
 assert.equal(s.allies.ravenholt.stake,20);assert.equal(E.alliesView(s).list[0].tier,'Trading partner');
 const def=E.ALLIES[0],f=E.forecast(s,{});
 assert.equal(line(f,'income','allies'),Math.round(def.yield*E.PARTNER_SHARE*.2),'a fifth of the place, a fifth of the partner’s share');
 assert.equal(E.makeOffer(s,{},'ravenholt',3e7,quiet).ok,false,'no offer is heard from a mere trading partner');
 assert.equal(E.allyInvest(s,'ravenholt',1e9).cost,2400000,'never more than the place is worth');assert.equal(E.allyInvest(s,'ravenholt',1).ok,false);
 closes(s,3);assert.equal(s.allies.ravenholt.stake,100);assert.equal(E.alliesView(s).list[0].tier,'Ally');
 assert.match(E.talkView(s,{},'ravenholt').why,/courted a while longer/);
 const news=[];for(let i=0;i<E.COURT_CLOSES;i++)news.push(...closes(s,1).unrest);
 assert.ok(news.some(u=>/King Roderic Varn of Ravenholt lets it be known that an offer/.test(u)));assert.equal(E.alliesView(s).list[0].canBuy,true);
 assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))).allies,s.allies);
});

const courted=(id,extra={})=>{const s=open();s.treasury=9e8;s.crowned=true;s.allies[id]={stake:60,held:E.COURT_CLOSES,owned:false,put:0,pending:[]};Object.assign(s,extra);E.openTalks(s,id,()=>.5);return s;};   /* rng .5: a whim of nought */

test('an offer is answered at once: taken, countered with his reasons, met coldly - or the talks end and he remembers',()=>{
 const def=E.ALLIES[0],s=courted('ravenholt'),v=E.talkView(s,{},'ravenholt');
 assert.equal(v.ready,true);assert.equal(v.list,def.price);assert.equal(v.ask,Math.round(def.price*1.2/50000)*50000,'he opens a fifth over what he would take');assert.equal(v.patience,4);
 /* far too low: insulted, a cooldown, a grudge that makes him dearer */
 const low=E.makeOffer(s,{},'ravenholt',def.price*.5,quiet);
 assert.equal(low.outcome,'insulted');assert.equal(low.deal,false);assert.equal(s.treasury,9e8,'nothing is paid');
 assert.equal(E.talkView(s,{},'ravenholt').cooldown,E.TALK_COOL_INSULT);assert.equal(E.makeOffer(s,{},'ravenholt',def.price*2,quiet).ok,false,'he will not see you');
 closes(s,E.TALK_COOL_INSULT);assert.equal(E.talkView(s,{},'ravenholt').canOffer,true);
 const dearer=E.talkView(s,{},'ravenholt').ask;assert.ok(dearer>v.ask*1.01,'the grudge is in the price: '+dearer+' against '+v.ask);
 /* low but not insulting: colder, a pip of patience gone, no counter */
 const reserve=dearer/1.2,cold=E.makeOffer(s,{},'ravenholt',reserve*.7,quiet);
 assert.equal(cold.outcome,'cold');assert.ok(!cold.counter);assert.equal(E.talkView(s,{},'ravenholt').patience,3);
 /* near: a counter-offer between the offer and his ask, with a reason he wants more */
 const near=E.makeOffer(s,{},'ravenholt',reserve*.9,quiet);
 assert.equal(near.outcome,'counter');assert.ok(near.counter>reserve*.9&&near.counter<=dearer);assert.match(near.text,/not forgotten what you offered me last time/);
 const nearer=E.makeOffer(s,{},'ravenholt',reserve*.95,quiet);assert.ok(nearer.counter<near.counter,'and each round it comes down a little');
 /* agreeing to his figure buys the place */
 const before=s.treasury,yes=E.acceptCounter(s,{},'ravenholt');
 assert.equal(yes.deal,true);assert.equal(yes.paid,nearer.counter);assert.equal(s.treasury,before-nearer.counter);assert.equal(s.allies.ravenholt.owned,true);
 const f=E.forecast(s,{});assert.equal(line(f,'income','allies'),def.yield);
 assert.equal(E.makeOffer(s,{},'ravenholt',1e9,quiet).ok,false);assert.equal(E.acceptCounter(s,{},'ravenholt').ok,false);
 assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))).allies,s.allies);
});

test('at or over what he would take he says yes - gladly, if it is handsome - and patience runs out',()=>{
 const s=courted('emberfall',{treasury:5e7}),reserve=E.talkView(s,{},'emberfall').ask/1.2;
 const r=E.makeOffer(s,{},'emberfall',reserve,quiet);assert.equal(r.outcome,'pleased');assert.equal(r.paid,reserve);assert.equal(s.allies.emberfall.paid,reserve);
 const t=courted('emberfall',{treasury:5e7}),trust=t.trust,g=E.makeOffer(t,{},'emberfall',reserve*1.15,quiet);
 assert.equal(g.outcome,'delighted');assert.ok(t.trust>trust+3,'a handsome price is talked about');
 assert.equal(E.makeOffer(courted('emberfall',{treasury:1e6}),{},'emberfall',reserve,quiet).ok,false,'nor gold the crown does not have');
 const w=courted('silverfjord'),ask=E.talkView(w,{},'silverfjord').ask;let last;
 for(let i=0;i<3;i++)last=E.makeOffer(w,{},'silverfjord',ask/1.2*.8,quiet);
 assert.equal(last.outcome,'walked');assert.equal(E.talkView(w,{},'silverfjord').cooldown,E.TALK_COOL_WALK);assert.equal(E.talkView(w,{},'silverfjord').patience,3,'and he starts fresh next time');
});

test('each of the five looks at the city with different eyes, and says why',()=>{
 const pct=(id,extra)=>{const s=courted(id,extra),def=E.ALLIES.find(a=>a.id===id);return E.haggleReasons(s,{},def,s.allies[id]).reduce((t,r)=>t+r.pct,0);};
 const b=o=>({budget:{...E.DEFAULT_BUDGET,...o}});
 assert.ok(pct('ravenholt',b({watch:0}))>pct('ravenholt',b({watch:1}))&&pct('ravenholt',b({watch:1}))>pct('ravenholt',b({watch:3})),'the soldier prices your watch');
 assert.ok(pct('ravenholt',{incidents:[{id:'brawl',age:1}]})>pct('ravenholt',{}));
 assert.ok(pct('emberfall',{treasury:9e8})>pct('emberfall',{treasury:4e7}),'the miser counts your strongroom');
 assert.ok(pct('silverfjord',{trust:20,crowned:false})>pct('silverfjord',{trust:80,crowned:false})&&pct('silverfjord',{trust:20,crowned:true})<pct('silverfjord',{trust:80,crowned:false}),'the proud one weighs your name - and a crown');   /* courted() crowns by default now - the envoys need it */
 assert.ok(pct('krakensrest',{winds:{trade:.25,harvest:0,prices:0}})>pct('krakensrest',{})&&pct('krakensrest',{winds:{trade:-.25,harvest:0,prices:0}})<pct('krakensrest',{}),'the smuggler reads the trade winds');
 assert.ok(pct('meridian',{seasons:[{grade:'F'}]})>pct('meridian',{})&&pct('meridian',{seasons:[{grade:'A'}]})<pct('meridian',{}),'the comptroller reads your bank grade');
 for(const a of E.ALLIES){const s=courted(a.id);for(const r of E.haggleReasons(s,{},a,{...s.allies[a.id],stake:100,held:40,talk:{grudge:1}}))assert.ok(r.text.length>20&&Number.isFinite(r.pct));}
 /* the whim is rolled once, when the talks open, and asking again never re-rolls it */
 const s=courted('ravenholt');E.openTalks(s,'ravenholt',()=>.99);assert.equal(s.allies.ravenholt.talk.whim,0);
 const u=open();u.allies.ravenholt={stake:60,held:12,owned:false,put:0,pending:[]};E.openTalks(u,'ravenholt',()=>.999);assert.ok(u.allies.ravenholt.talk.whim>.05&&u.allies.ravenholt.talk.whim<=.06);
});

test('no envoy rides on the bank’s patience, and all five under the crown is real money',()=>{
 const s=open();s.crowned=true;s.treasury=-1;assert.equal(E.allyInvest(s,'emberfall',1e6).ok,false);assert.match(E.allyInvest(s,'emberfall',1e6).text,/red/);
 assert.equal(E.allyInvest(E.create(),'emberfall',1e6).ok,false,'nor before the books are open');
 const t=open(),base=E.forecast(t,{}).totalIn;
 for(const a of E.ALLIES)t.allies[a.id]={stake:100,held:99,owned:true,put:a.worth,pending:[]};
 const f=E.forecast(t,{});
 assert.equal(line(f,'income','allies'),E.ALLIES.reduce((n,a)=>n+a.yield,0));assert.ok(f.totalIn>base+12e6);
 assert.equal(E.alliesFx(t).owned,5);assert.ok(f.trade>1.35);
});
