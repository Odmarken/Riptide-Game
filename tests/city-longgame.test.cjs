/* The Crown Ledger's long game, headless: rates that trade gold for goodwill, public works bought
 * once and paid for ever, a people who learn, a city that fills or empties with its attractiveness,
 * a King with a purse, humours and wishes, a gaol of real townsfolk, and the realm's trust in the
 * steward - at a hundred, the crown. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');

const quiet=()=>.95;                /* a roll of .95 never triggers anything */
const script=(...v)=>{let i=0;return()=>i<v.length?v[i++]:.95;};
const line=(f,side,id)=>f[side].find(l=>l.id===id).amount;

test('the books open on 72 townsfolk, an ordinary city, a tolerant King and a steward nobody knows yet',()=>{
 const s=E.create(),f=E.forecast(s,{});
 assert.equal(s.pop,E.POPULATION);assert.equal(s.attract,50);assert.equal(s.skill,20);assert.equal(s.trust,10);assert.equal(s.crowned,false);
 assert.deepEqual(s.king,{pleasure:60,humour:'content',humourAge:0,demand:null,raise:0});assert.deepEqual(s.works,{});assert.deepEqual(s.jail,[]);
 assert.equal(f.attractTarget,50,'nobody comes, nobody goes');assert.equal(f.skillTarget,20);assert.equal(f.craft,1);assert.equal(f.visit,1);
 assert.equal(f.housing,E.HOUSING);assert.equal(f.cells,E.CELLS);assert.equal(line(f,'expenses','whims'),0);
 assert.equal(line(f,'income','rents'),Math.round(72*6*(.7+60/333)));
 /* a quiet close changes none of it but the trust, which a content people and a wary council nudge up */
 E.tick(s,{},quiet);
 assert.equal(s.pop,72);assert.equal(s.attract,50);assert.deepEqual(s.jail,[]);assert.equal(s.king.demand,null);
 assert.ok(s.trust>10&&s.trust<12,'trust '+s.trust);
});

test('rents, market fees and duties trade gold against the mood and the city\'s draw',()=>{
 const base=E.forecast(E.create(),{});
 for(const key of E.RATE_KEYS){
  assert.equal(E.RATES[key].levels.length,4);
  const lo=E.create(),hi=E.create();assert.ok(E.setBudget(lo,key,0));assert.ok(E.setBudget(hi,key,3));assert.equal(E.setBudget(hi,key,4),false);
  const fl=E.forecast(lo,{}),fh=E.forecast(hi,{});
  assert.ok(fh.moodTarget<base.moodTarget&&fh.attractTarget<base.attractTarget,key+' at the top sours the city');
  assert.ok(fl.attractTarget>base.attractTarget,key+' at the bottom draws people');
  const id=key==='rent'?'rents':key==='fee'?'tolls':'imports';
  assert.ok(line(fh,'income',id)>line(base,'income',id)&&line(fl,'income',id)<line(base,'income',id),key+' moves '+id);
 }
 /* a wall of tariffs keeps the wagons away: the exports pay for it */
 const wall=E.create();E.setBudget(wall,'duty',3);
 assert.ok(line(E.forecast(wall,{}),'income','exports')<line(base,'income','exports'));
});

test('a work is paid for up front, takes its closes to build, and then earns for ever less its upkeep',()=>{
 const s=E.create(),ctx={prestige:10};
 const before=E.forecast(s,ctx);
 assert.equal(E.invest(s,ctx,'fleet').ok,false,'a fleet needs a quay');
 assert.equal(E.invest(s,ctx,'nope').ok,false);
 s.treasury=100;assert.equal(E.invest(s,ctx,'carters').ok,false,'not from an empty treasury');
 s.treasury=20000;
 const r=E.invest(s,ctx,'carters');assert.ok(r.ok);assert.equal(r.cost,3000,'1 500 at prestige 10');assert.equal(s.treasury,17000);
 assert.deepEqual(s.works.carters,{left:1});assert.equal(E.invest(s,ctx,'carters').ok,false,'only once');
 assert.equal(line(E.forecast(s,ctx),'income','exports'),line(before,'income','exports'),'nothing until it stands');
 const trust=s.trust,close=E.tick(s,ctx,quiet);
 assert.deepEqual(close.finished,['carters']);assert.ok(close.unrest.some(u=>/Carters/.test(u)));assert.ok(s.trust>=trust+2,'a finished work is noticed');
 const after=E.forecast(s,ctx);
 assert.ok(line(after,'income','exports')>line(before,'income','exports')+200);assert.equal(line(after,'expenses','upkeep'),40);
 assert.equal(E.worksView(s,ctx).list.find(w=>w.id==='quay').status,'ready','and it unlocks the quay');
 /* three crews, no more */
 const t=E.create();t.treasury=1e6;
 for(const id of ['carters','school','lamps'])assert.ok(E.invest(t,{},id).ok);
 assert.equal(E.invest(t,{},'statue').ok,false);assert.equal(E.worksView(t,{}).list.find(w=>w.id==='statue').status,'busy');
});

test('every work is well-formed, reachable and worth something',()=>{
 const ids=new Set(E.WORKS.map(w=>w.id));
 assert.equal(ids.size,E.WORKS.length);assert.ok(E.WORKS.length>=25,'plenty to build');
 for(const w of E.WORKS){
  assert.ok(w.name&&w.icon&&w.blurb&&w.done&&w.cost>0&&w.build>=1&&w.build<=4&&w.upkeep>=0,w.id);
  assert.ok(E.WORK_CATS.some(c=>c.id===w.cat),w.id+' has a category');
  for(const n of w.needs||[])assert.ok(ids.has(n)&&n!==w.id,w.id+' needs '+n);
  assert.ok(E.worksView(E.create(),{}).list.find(v=>v.id===w.id).effects.length>0,w.id+' says what it does');
  if(w.site==='house')assert.ok(w.sign,w.id+' has a signboard');
 }
 /* build the lot, in whatever order the prerequisites allow: every work gets built */
 const s=E.create();s.treasury=1e7;
 for(let i=0;i<80&&Object.keys(s.works).length<E.WORKS.length;i++){
  for(const w of E.worksView(s,{}).list)if(w.status==='ready')E.invest(s,{},w.id);
  E.tick(s,{},quiet);
 }
 for(let i=0;i<5;i++)E.tick(s,{},quiet);
 assert.equal(E.worksView(s,{}).done,E.WORKS.length);
 const f=E.forecast(s,{}),base=E.forecast(E.create(),{});
 assert.ok(f.totalIn>base.totalIn*2.5,'a built city earns '+f.totalIn+' against '+base.totalIn);
 assert.equal(f.housing,E.HOUSING+64);assert.equal(f.cells,E.MAX_CELLS);assert.ok(f.skillTarget>=70);
});

test('schooling is slow and it pays: learned hands owe more tax and export more',()=>{
 const s=E.create();E.setBudget(s,'learn',3);
 const f0=E.forecast(s,{});assert.equal(f0.skillTarget,42);
 for(let i=0;i<40;i++)E.tick(s,{},quiet);
 assert.ok(s.skill>40&&s.skill<=42,'skill '+s.skill);
 const dunce=E.create();E.setBudget(dunce,'learn',0);for(let i=0;i<40;i++)E.tick(dunce,{},quiet);
 assert.ok(dunce.skill<8);
 const a=E.create(),b=E.create();a.skill=100;b.skill=20;
 assert.ok(line(E.forecast(a,{}),'income','taxes')>line(E.forecast(b,{}),'income','taxes')*1.4);
});

test('an attractive city fills until the roofs run out; a shunned one empties to the last few',()=>{
 const good=E.create();
 for(const [k,v] of [['relief',2],['festival',2],['clean',3],['food',3],['watch',2],['rent',0]])E.setBudget(good,k,v);
 assert.ok(E.forecast(good,{}).attractTarget>=75);
 let full=null;
 for(let i=0;i<30;i++){good.treasury=50000;const r=E.tick(good,{},quiet);if(r.unrest.some(u=>/not a roof left/.test(u))){full=i;break;}}
 assert.equal(good.pop,E.HOUSING,'the city filled every roof');assert.ok(full!==null,'and then turned families away');
 good.works.tenements={left:0};good.treasury=50000;E.tick(good,{},quiet);
 assert.ok(good.pop>E.HOUSING,'tenements let them in again');
 const bad=E.create();
 for(const [k,v] of [['tax',30],['rent',3],['clean',0],['food',0],['watch',0],['relief',0]])E.setBudget(bad,k,v);
 let left=0;for(let i=0;i<40;i++){bad.treasury=50000;const r=E.tick(bad,{},quiet);if(r.moved<0)left-=r.moved;}
 assert.equal(bad.pop,E.MIN_POP);assert.equal(left,E.POPULATION-E.MIN_POP);assert.ok(bad.attract<10);
 assert.ok(line(E.forecast(bad,{}),'income','taxes')<line(E.forecast(E.create(),{}),'income','taxes'),'an empty city pays no tax');
});

test('the King: a purse to keep him sweet, humours that turn, wishes to grant or refuse',()=>{
 const s=E.create();
 /* quiet through the old rolls (event, trouble, petition), then a wish (.0 < .16) - the first on the list (.0) */
 const r=E.tick(s,{},script(.9,.9,.9,.0,.0));
 assert.deepEqual(s.king.demand,{id:'crown',age:0});assert.ok(r.unrest.some(u=>/The King wants something/.test(u)));
 const v=E.crownView(s,{prestige:10});
 assert.equal(v.demand.cost,3200);assert.equal(v.demand.left,2);assert.equal(v.crowned,false);assert.equal(v.canClaim,false);
 s.treasury=10;assert.equal(E.answerKing(s,{},true).ok,false);
 s.treasury=5000;const p=s.king.pleasure,mood=s.mood;
 assert.equal(E.answerKing(s,{},true).accepted,true);
 assert.equal(s.treasury,3400);assert.equal(s.king.pleasure,p+14);assert.equal(s.mood,mood-3);assert.equal(s.king.demand,null);assert.equal(E.answerKing(s,{},true),null);
 /* refused: he sulks, and the city likes you for it */
 const t=E.create();E.tick(t,{},script(.9,.9,.9,.0,.0));const p2=t.king.pleasure,trust=t.trust;
 assert.equal(E.answerKing(t,{},false).accepted,false);assert.equal(t.king.pleasure,p2-10);assert.equal(t.trust,trust+1);
 /* ignored for two closes: worse */
 const u=E.create();E.tick(u,{},script(.9,.9,.9,.0,.0));E.tick(u,{},quiet);const p3=u.king.pleasure;
 const lapse=E.tick(u,{},quiet);assert.equal(u.king.demand,null);assert.ok(lapse.unrest.some(x=>/unanswered/.test(x)));assert.ok(u.king.pleasure<p3-8);
 /* the allowance is for ever */
 const w=E.create();w.king.demand={id:'allowance',age:0};const purse=E.forecast(w,{}).purse;
 E.answerKing(w,{},true);assert.equal(w.king.raise,1);assert.equal(E.forecast(w,{}).purse,Math.round(purse*1.15));
 /* a humour turns after four closes on a low roll */
 const h=E.create();for(let i=0;i<4;i++)E.tick(h,{},quiet);
 E.tick(h,{},script(.9,.9,.9,.9,.0,.0));assert.notEqual(h.king.humour,'content');assert.equal(h.king.humourAge,0);
 assert.ok(E.DEMANDS.every(d=>d.text&&d.pleasure>0&&d.likes.every(id=>E.HUMOURS.some(x=>x.id===id))));
 assert.ok(E.HUMOURS.every(x=>x.chance>0&&x.chance<.9&&x.say));
});

test('a King kept short is furious: he helps himself to the treasury and has people arrested for nothing',()=>{
 const s=E.create();E.setBudget(s,'purse',0);E.setBudget(s,'court',0);
 assert.ok(E.forecast(s,{}).pleasureTarget<30);
 for(let i=0;i<8;i++)E.tick(s,{},quiet);
 assert.ok(s.king.pleasure<30,'pleasure '+s.king.pleasure);assert.equal(E.pleasureName(s.king.pleasure),'Furious');
 assert.equal(line(E.forecast(s,{}),'expenses','whims'),260,'and the forecast says so before it happens');
 /* no event, no trouble, no petition, no wish, (humour .9), an arrest (.0), the first on the roster (.0), by the King's order (.0), the shortest term (.0) */
 const roster=[{name:'Bodil Vass',skin:'baker',female:true},{name:'Gorm Hammarson',skin:'male'}];
 const r=E.tick(s,{roster},script(.9,.9,.9,.9,.9,.0,.0,.0,.0));
 assert.equal(s.jail.length,1);assert.equal(s.jail[0].name,'Bodil Vass');assert.equal(s.jail[0].byKing,true);assert.equal(s.jail[0].female,true);assert.equal(s.jail[0].term,3);
 assert.ok(r.unrest.some(u=>/Bodil Vass was taken to the gaol/.test(u)));
});

test('the gaol: real townsfolk, terms served, fines and pardons, and nobody arrested twice',()=>{
 const roster=[{name:'Bodil Vass',skin:'baker',female:true},{name:'Gorm Hammarson',skin:'male'}];
 const s=E.create(),arrest=()=>script(.9,.9,.9,.9,.0,.0,.0,.0);   /* ...no wish, an arrest, first of the roster, first crime, shortest term */
 E.tick(s,{roster},arrest());
 assert.deepEqual(s.jail.map(p=>[p.name,p.skin,p.term,p.served]),[['Bodil Vass','baker',2,0]]);assert.ok(/ham/.test(s.jail[0].crime)&&s.jail[0].say);
 E.tick(s,{roster},arrest());
 assert.deepEqual(s.jail.map(p=>p.name),['Bodil Vass','Gorm Hammarson'],'the first on the roster who is still free');
 assert.equal(line(E.forecast(s,{}),'expenses','gaol'),24);
 const v=E.gaolView(s,{prestige:10});
 assert.equal(v.held,2);assert.equal(v.cells,E.CELLS);assert.equal(v.prisoners[0].left,1);assert.equal(v.prisoners[1].fine,Math.round(90*2*2));
 const out=E.tick(s,{roster:[]},quiet);
 assert.deepEqual(s.jail.map(p=>p.name),['Gorm Hammarson']);assert.ok(out.unrest.some(u=>/Bodil Vass served the term/.test(u)));
 const gold=s.treasury,fine=E.fine(s,{},'Gorm Hammarson');
 assert.equal(fine.gold,90);assert.equal(s.treasury,gold+90);assert.deepEqual(s.jail,[]);assert.equal(E.fine(s,{},'Gorm Hammarson'),null);
 /* a pardon is remembered; pardoning the King's prisoner is remembered by the King */
 const t=E.create();t.jail.push({name:'Poeten Loke Rim',skin:'male',crime:'rhymed',say:'',term:6,served:0,byKing:true});
 const trust=t.trust,pleasure=t.king.pleasure;
 assert.ok(E.pardon(t,'Poeten Loke Rim').ok);assert.equal(t.trust,trust+.5);assert.equal(t.king.pleasure,pleasure-8);assert.equal(E.pardon(t,'nobody'),null);
 /* a courthouse doubles the fines and makes the gaol pay */
 const c=E.create();c.works.courthouse={left:0};c.jail.push({name:'A',skin:'male',crime:'x',term:4,served:1});
 assert.equal(E.gaolView(c,{}).prisoners[0].fine,540);assert.ok(line(E.forecast(c,{}),'income','works')>0);
 /* overcrowding is felt, and the new wing cures it */
 const o=E.create();for(let i=0;i<8;i++)o.jail.push({name:'P'+i,skin:'male',crime:'x',term:9,served:0});
 assert.equal(E.forecast(o,{}).crowded,2);assert.ok(E.forecast(o,{}).moodTarget<E.forecast(E.create(),{}).moodTarget);
 o.works.gaolwing={left:0};assert.equal(E.forecast(o,{}).crowded,0);assert.equal(E.cells(o),10);
 assert.ok(E.CRIMES.every(x=>x.text&&x.say&&x.term[0]>=1&&x.term[1]>=x.term[0]));
 /* the crimes fit the city: with the tax at 30 and no bread, those are what people are in for */
 const hard=E.create();E.setBudget(hard,'tax',30);E.setBudget(hard,'relief',0);const seen=new Set();
 let x=7;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 for(let i=0;i<60;i++){hard.jail=[];hard.treasury=1e5;E.tick(hard,{},rng);hard.jail.forEach(p=>seen.add(p.crime));}
 assert.ok([...seen].some(t2=>/tax collector/.test(t2))&&[...seen].some(t2=>/bread for the children/.test(t2)),[...seen].join(' | '));
});

test('trust is earned close by close, lost to marches and light fingers, and at a hundred the crown can be taken',()=>{
 const s=E.create();
 assert.equal(E.claimCrown(s,'gaol').ok,false);
 /* a well-run city: happy, backed, attractive */
 s.mood=90;s.attract=85;for(const k of Object.keys(s.council))s.council[k]=85;
 const f=E.forecast(s,{});assert.ok(f.trustDelta>4,'trust per close '+f.trustDelta);
 assert.equal(E.crownView(s,{}).closesToCrown,Math.ceil(90/f.trustDelta));
 /* carrying the treasury home costs it; paying in earns half as much back */
 const t=E.create();t.trust=50;t.treasury=30000;
 assert.equal(E.withdraw(t,3000,1e9,{}),3000);assert.equal(t.trust,48);
 assert.equal(E.withdraw(t,27000,1e9,{}),27000);assert.equal(t.trust,38,'at most ten at a time');
 assert.equal(E.deposit(t,3000,1e9,{}),3000);assert.equal(t.trust,39);
 assert.equal(E.withdraw(E.normalize({...E.create(),treasury:3000,trust:50}),3000,1e9,{prestige:10}),3000);
 /* a march undoes it */
 const m=E.create();m.trust=50;m.protest=true;m.mood=10;assert.ok(E.forecast(m,{}).trustDelta<-4);
 /* the coup */
 s.trust=100;s.king.demand={id:'lion',age:0};s.jail.push({name:'Bodil Vass',skin:'baker',crime:'x',term:3,served:0});
 assert.equal(E.crownView(s,{}).canClaim,true);
 const r=E.claimCrown(s,'gaol');assert.ok(r.ok);assert.equal(s.crowned,true);assert.equal(s.deposed,'gaol');assert.equal(s.king.demand,null);
 assert.equal(s.jail[0].name,'Alarik Tidvind');assert.equal(s.jail[0].skin,'king');assert.equal(s.jail[0].life,true);assert.equal(s.jail.length,2);
 assert.equal(E.claimCrown(s,'gaol').ok,false,'only once');
 /* no more wishes, no more whims; the purse is the monarch\'s own, and he serves for life */
 s.king.pleasure=0;
 const fc=E.forecast(s,{});assert.equal(line(fc,'expenses','whims'),0);assert.equal(fc.expenses.find(l=>l.id==='purse').name,'Your privy purse');
 for(let i=0;i<12;i++){const c=E.tick(s,{},()=>.01);assert.equal(s.king.demand,null);assert.equal(c.purse,fc.purse);}
 assert.ok(s.jail.some(p=>p.life),'Alarik is still there');
 assert.equal(E.fine(s,{},'Alarik Tidvind'),null);
 assert.ok(E.pardon(s,'Alarik Tidvind').ok);assert.equal(s.deposed,'exile');assert.ok(!s.jail.some(p=>p.life));
 /* a crowned head draws on the treasury without a murmur */
 s.treasury=9000;const trust=s.trust;E.withdraw(s,9000,1e9,{});assert.equal(s.trust,trust);
 /* exile from the start */
 const e=E.create();e.trust=100;assert.ok(E.claimCrown(e,'exile').ok);assert.deepEqual(e.jail,[]);assert.equal(e.deposed,'exile');
 /* a crown nobody trusts breeds royalists */
 assert.ok(E.INCIDENTS.find(d=>d.id==='royalists').when({crowned:true,trust:20})&&!E.INCIDENTS.find(d=>d.id==='royalists').when({crowned:false,trust:20}));
});

test('normalize carries the long game through a save, repairs a damaged one and opens an old one at its start',()=>{
 const old=E.normalize({treasury:9000,budget:{tax:15,watch:2}});            /* a save from before any of this */
 assert.equal(old.pop,72);assert.equal(old.trust,10);assert.equal(old.budget.rent,1);assert.equal(old.budget.purse,1);assert.deepEqual(old.works,{});
 const s=E.create();s.trust=100;s.treasury=1e6;E.invest(s,{},'carters');E.tick(s,{},quiet);E.invest(s,{},'quay');E.claimCrown(s,'gaol');
 const back=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(back.works,{carters:{left:0},quay:{left:2}});assert.equal(back.crowned,true);assert.equal(back.deposed,'gaol');
 assert.equal(back.jail[0].life,true);assert.equal(back.pop,s.pop);assert.equal(back.trust,s.trust);
 const bad=E.normalize({pop:-4,attract:900,skill:'x',trust:1e9,crowned:0,deposed:'gaol',king:{pleasure:-9,humour:'giddy',demand:{id:'ghost'},raise:99},
  works:{carters:{left:99},ghost:{left:1},quay:null},jail:[{name:'A',term:'x'},{name:'A'},null,{name:''},{crime:'x'}]});
 assert.equal(bad.pop,E.MIN_POP);assert.equal(bad.attract,100);assert.equal(bad.skill,20);assert.equal(bad.trust,100);assert.equal(bad.deposed,null);
 assert.deepEqual(bad.king,{pleasure:0,humour:'content',humourAge:0,demand:null,raise:4});
 assert.deepEqual(bad.works,{carters:{left:1}});
 assert.equal(bad.jail.length,1);assert.equal(bad.jail[0].term,2);assert.equal(bad.jail[0].skin,'male');
 /* and whatever it repaired still forecasts and ticks with whole numbers */
 const f=E.forecast(bad,{});assert.ok(f.income.concat(f.expenses).every(l=>Number.isInteger(l.amount)&&l.amount>=0));
 E.tick(bad,{},Math.random);
});
