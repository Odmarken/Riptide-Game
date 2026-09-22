/* The Crown Ledger's long game, headless: rates that trade gold for goodwill, public works bought
 * once and paid for ever, a people who learn, a city that fills or empties with its attractiveness,
 * a King with a purse, humours and wishes, a gaol of real townsfolk, and the realm's trust in the
 * steward - at a hundred, the crown. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
/* the books as they stand the moment the founding loan is signed */
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};   /* ...with a granary that will not run out under a test about something else */
const K=E.COIN;                     /* the tables are in tens of gold */

const quiet=()=>.95;                /* a roll of .95 never triggers anything */
const script=(...v)=>{let i=0;return()=>i<v.length?v[i++]:.95;};
const line=(f,side,id)=>f[side].find(l=>l.id===id).amount;

test('the books open on 350 townsfolk in 70 households, an ordinary city, a tolerant King and a steward nobody knows yet',()=>{
 const s=open(),f=E.forecast(s,{});
 assert.equal(s.pop,E.POPULATION);assert.equal(s.attract,50);assert.equal(s.skill,20);assert.equal(s.trust,10);assert.equal(s.crowned,false);
 assert.deepEqual(s.king,{pleasure:60,humour:'content',humourAge:0,demand:null,raise:0});assert.deepEqual(s.works,{});assert.deepEqual(s.jail,[]);
 assert.equal(f.attractTarget,50,'nobody comes, nobody goes');assert.equal(f.skillTarget,20);assert.equal(f.craft,1);assert.equal(f.visit,1);
 assert.equal(f.housing,E.HOUSING);assert.equal(f.cells,E.CELLS);assert.equal(line(f,'expenses','whims'),0);
 assert.equal(E.POPULATION,350);assert.equal(E.hearths(s),70);assert.equal(E.POP_MAX,5000);
 assert.equal(line(f,'income','rents'),Math.round(70*6*K*(.7+60/333)),'rents are paid by the household');
 /* a quiet close changes none of it but the trust, which a content people and a wary council nudge up */
 E.tick(s,{},quiet);
 assert.equal(s.pop,E.POPULATION);assert.equal(s.attract,50);assert.deepEqual(s.jail,[]);assert.equal(s.king.demand,null);
 assert.ok(s.trust>10&&s.trust<12,'trust '+s.trust);
});

test('rents, market fees, duties and the share of the tithes trade gold against the mood and the draw of the city',()=>{
 const base=E.forecast(open(),{});
 for(const key of E.RATE_KEYS){
  assert.equal(E.RATES[key].levels.length,4);
  const lo=open(),hi=open();assert.ok(E.setBudget(lo,key,0));assert.ok(E.setBudget(hi,key,3));assert.equal(E.setBudget(hi,key,4),false);
  const fl=E.forecast(lo,{}),fh=E.forecast(hi,{});
  assert.ok(fh.moodTarget<base.moodTarget&&fh.attractTarget<base.attractTarget,key+' at the top sours the city');
  assert.ok(fl.attractTarget>base.attractTarget,key+' at the bottom draws people');
  const id=key==='rent'?'rents':key==='fee'?'tolls':key==='tithe'?'church':'imports';
  assert.ok(line(fh,'income',id)>line(base,'income',id)&&line(fl,'income',id)<line(base,'income',id),key+' moves '+id);
 }
 /* a wall of tariffs keeps the wagons away: the exports pay for it */
 const wall=open();E.setBudget(wall,'duty',3);
 assert.ok(line(E.forecast(wall,{}),'income','exports')<line(base,'income','exports'));
});

test('a work is paid for up front, takes its closes to build, and then earns for ever less its upkeep',()=>{
 const s=open(),ctx={prestige:10},carters=E.WORKS.find(w=>w.id==='carters');
 const before=E.forecast(s,ctx);
 assert.equal(E.invest(s,ctx,'fleet').ok,false,'a fleet needs a quay');
 assert.equal(E.invest(s,ctx,'nope').ok,false);
 s.treasury=100;assert.equal(E.invest(s,ctx,'carters').ok,false,'not from an empty treasury');
 s.treasury=2000000;
 const r=E.invest(s,ctx,'carters');assert.ok(r.ok);assert.equal(r.cost,carters.cost*K,'the same price at any prestige');assert.equal(s.treasury,2000000-carters.cost*K);
 assert.deepEqual(s.works.carters,{left:1});assert.equal(E.invest(s,ctx,'carters').ok,false,'only once');
 assert.equal(line(E.forecast(s,ctx),'income','exports'),line(before,'income','exports'),'nothing until it stands');
 const trust=s.trust,close=E.tick(s,ctx,quiet);
 assert.deepEqual(close.finished,['carters']);assert.ok(close.unrest.some(u=>/Carters/.test(u)));assert.ok(s.trust>=trust+2,'a finished work is noticed');
 const after=E.forecast(s,ctx);
 assert.ok(line(after,'income','exports')>=line(before,'income','exports')+carters.fx.exports*K);assert.equal(line(after,'expenses','upkeep'),carters.upkeep*K);
 assert.equal(E.worksView(s,ctx).list.find(w=>w.id==='quay').status,'ready','and it unlocks the quay');
 /* three crews, no more */
 const t=open();t.treasury=1e6;
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
  assert.ok(E.worksView(open(),{}).list.find(v=>v.id===w.id).effects.length>0,w.id+' says what it does');
  if(w.site==='house')assert.ok(w.sign,w.id+' has a signboard');
 }
 /* build the lot, in whatever order the prerequisites allow: every work gets built */
 const s=open();s.treasury=1e8;
 for(let i=0;i<80&&Object.keys(s.works).length<E.WORKS.length;i++){
  for(const w of E.worksView(s,{}).list)if(w.status==='ready')E.invest(s,{},w.id);
  E.tick(s,{},quiet);
 }
 for(let i=0;i<5;i++)E.tick(s,{},quiet);
 assert.equal(E.worksView(s,{}).done,E.WORKS.length);
 const f=E.forecast(s,{}),base=E.forecast(open(),{});
 assert.ok(f.totalIn>base.totalIn*2,'a built city earns '+f.totalIn+' against '+base.totalIn);
 assert.equal(f.housing,E.POP_MAX,'every quarter built: five thousand');assert.equal(f.cells,E.MAX_CELLS);assert.ok(f.skillTarget>=70);
});

test('schooling is slow and it pays: learned hands owe more tax and export more',()=>{
 const s=open();E.setBudget(s,'learn',3);
 const f0=E.forecast(s,{});assert.equal(f0.skillTarget,42);
 for(let i=0;i<40;i++)E.tick(s,{},quiet);
 assert.ok(s.skill>40&&s.skill<=42,'skill '+s.skill);
 const dunce=open();E.setBudget(dunce,'learn',0);for(let i=0;i<40;i++)E.tick(dunce,{},quiet);
 assert.ok(dunce.skill<8);
 const a=open(),b=open();a.skill=100;b.skill=20;
 assert.ok(line(E.forecast(a,{}),'income','taxes')>line(E.forecast(b,{}),'income','taxes')*1.3);
});

test('an attractive city fills until the roofs run out; a shunned one empties to the last few',()=>{
 const good=open();
 for(const [k,v] of [['relief',2],['festival',2],['clean',3],['food',3],['watch',2],['rent',0]])E.setBudget(good,k,v);
 assert.ok(E.forecast(good,{}).attractTarget>=75);
 let full=null;
 for(let i=0;i<30;i++){good.treasury=500000;const r=E.tick(good,{},quiet);if(r.unrest.some(u=>/not a roof left/.test(u))){full=i;break;}}
 assert.equal(good.pop,E.HOUSING,'the city filled every roof');assert.ok(full!==null,'and then turned families away');
 good.works.tenements={left:0};good.treasury=500000;E.tick(good,{},quiet);
 assert.ok(good.pop>E.HOUSING,'tenements let them in again');
 const bad=open();
 for(const [k,v] of [['tax',30],['rent',3],['clean',0],['food',0],['watch',0],['relief',0]])E.setBudget(bad,k,v);
 let left=0;for(let i=0;i<90;i++){bad.treasury=500000;const r=E.tick(bad,{},quiet);if(r.moved<0)left-=r.moved;}
 assert.equal(bad.pop,E.MIN_POP);assert.equal(left,E.POPULATION-E.MIN_POP);assert.ok(bad.attract<10);
 assert.ok(line(E.forecast(bad,{}),'income','taxes')<line(E.forecast(open(),{}),'income','taxes'),'an empty city pays no tax');
});

test('the King: a purse to keep him sweet, humours that turn, wishes to grant or refuse',()=>{
 const s=open();
 /* quiet through the old rolls (event, trouble, petition), then a wish (.0 < .16) - the first on the list (.0) */
 const r=E.tick(s,{},script(.9,.9,.9,.0,.0));
 assert.deepEqual(s.king.demand,{id:'crown',age:0});assert.ok(r.unrest.some(u=>/The King wants something/.test(u)));
 const v=E.crownView(s,{prestige:10});
 assert.equal(v.demand.cost,1600*K);assert.equal(v.demand.left,2);assert.equal(v.crowned,false);assert.equal(v.canClaim,false);
 s.treasury=10;assert.equal(E.answerKing(s,{},true).ok,false);
 s.treasury=500000;const p=s.king.pleasure,mood=s.mood;
 assert.equal(E.answerKing(s,{},true).accepted,true);
 assert.equal(s.treasury,500000-1600*K);assert.equal(s.king.pleasure,p+14);assert.equal(s.mood,mood-3);assert.equal(s.king.demand,null);assert.equal(E.answerKing(s,{},true),null);
 /* refused: he sulks, and the city likes you for it */
 const t=open();E.tick(t,{},script(.9,.9,.9,.0,.0));const p2=t.king.pleasure,trust=t.trust;
 assert.equal(E.answerKing(t,{},false).accepted,false);assert.equal(t.king.pleasure,p2-10);assert.equal(t.trust,trust+1);
 /* ignored for two closes: worse */
 const u=open();E.tick(u,{},script(.9,.9,.9,.0,.0));E.tick(u,{},quiet);const p3=u.king.pleasure;
 const lapse=E.tick(u,{},quiet);assert.equal(u.king.demand,null);assert.ok(lapse.unrest.some(x=>/unanswered/.test(x)));assert.ok(u.king.pleasure<p3-8);
 /* the allowance is for ever */
 const w=open();w.king.demand={id:'allowance',age:0};const purse=E.forecast(w,{}).purse;
 E.answerKing(w,{},true);assert.equal(w.king.raise,1);assert.equal(E.forecast(w,{}).purse,Math.round(purse*1.15));
 /* a humour turns after four closes on a low roll */
 const h=open();for(let i=0;i<4;i++)E.tick(h,{},quiet);
 E.tick(h,{},script(.9,.9,.9,.9,.0,.0));assert.notEqual(h.king.humour,'content');assert.equal(h.king.humourAge,0);
 assert.ok(E.DEMANDS.every(d=>d.text&&d.pleasure>0&&d.likes.every(id=>E.HUMOURS.some(x=>x.id===id))));
 assert.ok(E.HUMOURS.every(x=>x.chance>0&&x.chance<.9&&x.say));
});

test('a King kept short is furious: he helps himself to the treasury and has people arrested for nothing',()=>{
 const s=open();E.setBudget(s,'purse',0);E.setBudget(s,'court',0);
 assert.ok(E.forecast(s,{}).pleasureTarget<30);
 for(let i=0;i<8;i++)E.tick(s,{},quiet);
 assert.ok(s.king.pleasure<30,'pleasure '+s.king.pleasure);assert.equal(E.pleasureName(s.king.pleasure),'Furious');
 assert.equal(line(E.forecast(s,{}),'expenses','whims'),260*K,'and the forecast says so before it happens');
 /* no event, no trouble, no petition, no wish, (humour .9), an arrest (.0), the first on the roster (.0), by the King's order (.0), the shortest term (.0) */
 const roster=[{name:'Bodil Vass',skin:'baker',female:true},{name:'Gorm Hammarson',skin:'male'}];
 const r=E.tick(s,{roster},script(.9,.9,.9,.9,.9,.0,.0,.0,.0));
 assert.equal(s.jail.length,1);assert.equal(s.jail[0].name,'Bodil Vass');assert.equal(s.jail[0].byKing,true);assert.equal(s.jail[0].female,true);assert.equal(s.jail[0].term,3);
 assert.ok(r.unrest.some(u=>/Bodil Vass was taken to the gaol/.test(u)));
});

test('the gaol: real townsfolk, terms served, fines and pardons, and nobody arrested twice',()=>{
 const roster=[{name:'Bodil Vass',skin:'baker',female:true},{name:'Gorm Hammarson',skin:'male'}];
 const s=open(),arrest=()=>script(.9,.9,.9,.9,.0,.0,.0,.0);   /* ...no wish, an arrest, first of the roster, first crime, shortest term */
 E.tick(s,{roster},arrest());
 assert.deepEqual(s.jail.map(p=>[p.name,p.skin,p.term,p.served]),[['Bodil Vass','baker',2,0]]);assert.ok(/ham/.test(s.jail[0].crime)&&s.jail[0].say);
 E.tick(s,{roster},arrest());
 assert.deepEqual(s.jail.map(p=>p.name),['Bodil Vass','Gorm Hammarson'],'the first on the roster who is still free');
 assert.equal(line(E.forecast(s,{}),'expenses','gaol'),24*K);
 const v=E.gaolView(s,{prestige:10});
 assert.equal(v.held,2);assert.equal(v.cells,E.CELLS);assert.equal(v.prisoners[0].left,1);assert.equal(v.prisoners[1].fine,90*2*K);
 const out=E.tick(s,{roster:[]},quiet);
 assert.deepEqual(s.jail.map(p=>p.name),['Gorm Hammarson']);assert.ok(out.unrest.some(u=>/Bodil Vass served the term/.test(u)));
 const gold=s.treasury,fine=E.fine(s,{},'Gorm Hammarson');
 assert.equal(fine.gold,90*K);assert.equal(s.treasury,gold+90*K);assert.deepEqual(s.jail,[]);assert.equal(E.fine(s,{},'Gorm Hammarson'),null);
 /* a pardon is remembered; pardoning the King's prisoner is remembered by the King */
 const t=open();t.jail.push({name:'Poeten Loke Rim',skin:'male',crime:'rhymed',say:'',term:6,served:0,byKing:true});
 const trust=t.trust,pleasure=t.king.pleasure;
 assert.ok(E.pardon(t,'Poeten Loke Rim').ok);assert.equal(t.trust,trust+.5);assert.equal(t.king.pleasure,pleasure-8);assert.equal(E.pardon(t,'nobody'),null);
 /* a courthouse doubles the fines and makes the gaol pay */
 const c=open();c.works.courthouse={left:0};c.jail.push({name:'A',skin:'male',crime:'x',term:4,served:1});
 assert.equal(E.gaolView(c,{}).prisoners[0].fine,540*K);assert.ok(line(E.forecast(c,{}),'income','works')>0);
 /* overcrowding is felt, and the new wing cures it */
 const o=open();for(let i=0;i<8;i++)o.jail.push({name:'P'+i,skin:'male',crime:'x',term:9,served:0});
 assert.equal(E.forecast(o,{}).crowded,2);assert.ok(E.forecast(o,{}).moodTarget<E.forecast(open(),{}).moodTarget);
 o.works.gaolwing={left:0};assert.equal(E.forecast(o,{}).crowded,0);assert.equal(E.cells(o),10);
 assert.ok(E.CRIMES.every(x=>x.text&&x.say&&x.term[0]>=1&&x.term[1]>=x.term[0]));
 /* the crimes fit the city: with the tax at 30 and no bread, those are what people are in for */
 const hard=open();E.setBudget(hard,'tax',30);E.setBudget(hard,'relief',0);const seen=new Set();
 let x=7;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 for(let i=0;i<60;i++){hard.jail=[];hard.treasury=1e5;E.tick(hard,{},rng);hard.jail.forEach(p=>seen.add(p.crime));}
 assert.ok([...seen].some(t2=>/tax collector/.test(t2))&&[...seen].some(t2=>/bread for the children/.test(t2)),[...seen].join(' | '));
});

test('trust is earned close by close, lost to marches and light fingers, and at a hundred the crown can be taken',()=>{
 const s=open();
 assert.equal(E.claimCrown(s,'gaol').ok,false);
 /* a well-run city: happy, backed, attractive */
 s.mood=90;s.attract=85;for(const k of Object.keys(s.council))s.council[k]=85;
 const f=E.forecast(s,{});assert.ok(f.trustDelta>4,'trust per close '+f.trustDelta);
 assert.equal(E.crownView(s,{}).closesToCrown,Math.ceil(90/f.trustDelta));
 /* carrying the treasury home costs it; paying in earns half as much back */
 const t=open();t.trust=50;t.loan=0;t.treasury=3000000;
 assert.equal(E.withdraw(t,30000,1e9,{}),30000);assert.equal(t.trust,48);
 assert.equal(E.withdraw(t,270000,1e9,{}),270000);assert.equal(t.trust,38,'at most ten at a time');
 assert.equal(E.deposit(t,30000,1e9,{}),30000);assert.equal(t.trust,39);
 assert.equal(E.withdraw(open(),30000,1e9,{}),0,'and never gold that is the bank\'s');
 /* a march undoes it */
 const m=open();m.trust=50;m.protest=true;m.mood=10;assert.ok(E.forecast(m,{}).trustDelta<-4);
 /* the coup - trust alone is not enough: the council must be devoted and the bank must have graded a season first (2026-09-22) */
 s.trust=100;s.king.demand={id:'lion',age:0};s.jail.push({name:'Bodil Vass',skin:'baker',crime:'x',term:3,served:0});
 assert.equal(E.crownView(s,{}).canClaim,false,'no season on the books yet');assert.equal(E.claimCrown(s,'gaol').ok,false);
 assert.equal(E.crownView(s,{}).closesToSeason,E.SEASON_CLOSES*E.COUP_SEASONS-s.season.closes);
 s.season.n=1+E.COUP_SEASONS;
 assert.equal(E.crownView(s,{}).canClaim,true);assert.equal(E.crownView(s,{}).closesToSeason,0);
 {const was={...s.council};for(const k of Object.keys(s.council))s.council[k]=E.COUP_FAVOUR-1;
  assert.equal(E.crownView(s,{}).canClaim,false,'a council short of devoted says no');assert.match(E.claimCrown(s,'gaol').text,/council/);
  Object.assign(s.council,was);assert.equal(E.crownView(s,{}).canClaim,true);}
 const r=E.claimCrown(s,'gaol');assert.ok(r.ok);assert.equal(s.crowned,true);assert.equal(s.deposed,'gaol');assert.equal(s.king.demand,null);
 assert.equal(s.jail[0].name,'Alarik Tidvind');assert.equal(s.jail[0].skin,'king');assert.equal(s.jail[0].life,true);assert.equal(s.jail.length,2);
 assert.equal(E.claimCrown(s,'gaol').ok,false,'only once');
 /* no more wishes, no more whims; the purse is the monarch\'s own, and he serves for life */
 s.king.pleasure=0;
 const fc=E.forecast(s,{});assert.equal(line(fc,'expenses','whims'),0);assert.equal(fc.expenses.find(l=>l.id==='purse').name,'Your privy purse');
 for(let i=0;i<12;i++){const due=E.forecast(s,{}).purse,c=E.tick(s,{},()=>.01);assert.equal(s.king.demand,null);assert.equal(c.purse,Math.round(due*E.HERO_COIN/E.COIN),'a tenth of the privy purse reaches the hero’s own gold at every close');}
 assert.ok(s.jail.some(p=>p.life),'Alarik is still there');
 assert.equal(E.fine(s,{},'Alarik Tidvind'),null);
 /* ⚖️ the old King's fate (2026-09-22): a pardon pleases the people and makes every court abroad dearer; the gallows the reverse */
 {const mood=s.mood,worth=E.alliesView(s).list[0].worth,def=E.ALLIES[0];
  assert.equal(E.allyFear(s),1);assert.equal(E.execute(s,'Bodil Vass'),null,'only the one in for life');
  assert.ok(E.pardon(s,'Alarik Tidvind').ok);assert.equal(s.deposed,'pardoned');assert.ok(!s.jail.some(p=>p.life));
  assert.equal(s.mood,Math.min(100,mood+15));assert.equal(E.allyFear(s),1.15);assert.equal(E.alliesView(s).list[0].worth,Math.round(worth*1.15));
  assert.equal(E.normalize(JSON.parse(JSON.stringify(s))).deposed,'pardoned');
  const g=open();g.crowned=true;g.deposed='gaol';g.season.n=2;g.jail.unshift({name:'Alarik Tidvind',skin:'king',female:false,crime:'x',say:'',term:1,served:0,life:true,byKing:false});
  const gm=g.mood,r=E.execute(g,'Alarik Tidvind');assert.ok(r.ok);assert.equal(g.deposed,'executed');assert.ok(!g.jail.some(p=>p.life));
  assert.equal(g.mood,Math.max(0,gm-15));assert.equal(E.allyFear(g),.85);assert.equal(E.alliesView(g).list[0].worth,Math.round(def.worth*.85));
  assert.equal(E.execute(g,'Alarik Tidvind'),null,'once');assert.equal(E.normalize(JSON.parse(JSON.stringify(g))).deposed,'executed');
  /* the courts price the fate: a soft crown pays more at the table, a feared one less */
  const soft=open(),hard=open();for(const t of [soft,hard]){t.crowned=true;t.treasury=9e8;t.allies.ravenholt={stake:60,held:E.COURT_CLOSES,owned:false,put:0,pending:[]};E.openTalks(t,'ravenholt',()=>.5);}
  soft.deposed='pardoned';hard.deposed='executed';
  assert.ok(E.talkView(soft,{},'ravenholt').ask>E.talkView(hard,{},'ravenholt').ask,'the pardon costs at the table, the gallows pays');
  /* and a stake buys more of a frightened place: the same chest, a bigger share */
  const chest=E.allyInvest(hard,'emberfall',1e6);assert.ok(chest.ok);for(let i=0;i<E.ALLY_CLOSES;i++)E.tick(hard,{},quiet);
  assert.equal(hard.allies.emberfall.stake,Math.round(1e6/Math.round(E.ALLIES[1].worth*.85)*100*100)/100);}
 /* a crowned head draws on the treasury without a murmur */
 s.loan=0;s.treasury=90000;const trust=s.trust;assert.equal(E.withdraw(s,90000,1e9,{}),90000);assert.equal(s.trust,trust);
 /* exile from the start */
 const e=open();e.trust=100;e.season.n=2;for(const k of Object.keys(e.council))e.council[k]=E.COUP_FAVOUR;assert.ok(E.claimCrown(e,'exile').ok);assert.deepEqual(e.jail,[]);assert.equal(e.deposed,'exile');
 /* a crown nobody trusts breeds royalists */
 assert.ok(E.INCIDENTS.find(d=>d.id==='royalists').when({crowned:true,trust:20})&&!E.INCIDENTS.find(d=>d.id==='royalists').when({crowned:false,trust:20}));
});

test('normalize carries the long game through a save, repairs a damaged one and opens an old one at its start',()=>{
 const old=E.normalize({treasury:90000,budget:{tax:15,watch:2}});            /* a save from before the founding loan */
 assert.deepEqual(old,E.create(),'opens on the empty strongroom');
 const s=open();s.treasury=1e6;E.invest(s,{},'carters');E.tick(s,{},quiet);E.invest(s,{},'quay');
 s.trust=100;s.season.n=2;for(const k of Object.keys(s.council))s.council[k]=E.COUP_FAVOUR;assert.ok(E.claimCrown(s,'gaol').ok);
 const back=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(back.works,{carters:{left:0},quay:{left:2}});assert.equal(back.crowned,true);assert.equal(back.deposed,'gaol');
 assert.equal(back.jail[0].life,true);assert.equal(back.pop,s.pop);assert.equal(back.trust,s.trust);
 const bad=E.normalize({v:E.VERSION,pop:-4,attract:900,skill:'x',trust:1e9,crowned:0,deposed:'gaol',king:{pleasure:-9,humour:'giddy',demand:{id:'ghost'},raise:99},
  works:{carters:{left:99},ghost:{left:1},quay:null},jail:[{name:'A',term:'x'},{name:'A'},null,{name:''},{crime:'x'}]});
 assert.equal(bad.pop,E.MIN_POP);assert.equal(bad.attract,100);assert.equal(bad.skill,20);assert.equal(bad.trust,100);assert.equal(bad.deposed,null);
 assert.deepEqual(bad.king,{pleasure:0,humour:'content',humourAge:0,demand:null,raise:4});
 assert.deepEqual(bad.works,{carters:{left:1}});
 assert.equal(bad.jail.length,1);assert.equal(bad.jail[0].term,2);assert.equal(bad.jail[0].skin,'male');
 /* and whatever it repaired still forecasts and ticks with whole numbers */
 const f=E.forecast(bad,{});assert.ok(f.income.concat(f.expenses).every(l=>Number.isInteger(l.amount)&&l.amount>=0));
 E.tick(bad,{},Math.random);
});

test('ledgers to attend: the chat says so, and the longer the steward stays away the faster the realm and the council slip - a slope, never a step',()=>{
 const s=open(),said=[];
 assert.equal(s.unattended,0);assert.deepEqual(E.neglect(s),{closes:0,trust:0,seats:0,mood:0,attract:0});
 for(let i=1;i<=13;i++){const r=E.tick(s,{},quiet);assert.equal(s.unattended,i);assert.equal(r.unattended,i);if(r.unrest.some(u=>/You have ledgers to attend/.test(u)))said.push(i);}
 assert.deepEqual(said,[3,6,9,12],'from the third close, at every third');
 assert.ok(s.history.find(h=>h.n===6).unrest.some(u=>/started to talk/.test(u))&&s.history.find(h=>h.n===12).unrest.some(u=>/meets without you/.test(u)),'and more sharply as it goes on');
 /* every close away costs a little more than the last, up to a ceiling */
 const drain=n=>E.neglect({unattended:n});
 for(let n=1;n<=60;n++){
  const a=drain(n-1),b=drain(n);
  assert.ok(b.trust<=a.trust&&b.seats>=a.seats&&b.mood<=a.mood&&b.attract<=a.attract,'never eases while away');
  assert.ok(a.trust-b.trust<=E.TRUST_SLOPE+.11&&b.seats-a.seats<=2&&a.mood-b.mood<=1&&a.attract-b.attract<=1,'and never jumps: close '+n);
 }
 assert.equal(drain(1).trust,-.1);assert.equal(drain(10).trust,-1.2);assert.equal(drain(60).trust,-E.TRUST_DRAIN_MAX);assert.equal(drain(60).seats,E.SEAT_DRAIN_MAX);
 assert.equal(drain(10).mood,-6);assert.equal(drain(10).attract,-4);assert.equal(drain(60).mood,-E.MOOD_DRAIN_MAX);assert.equal(drain(60).attract,-E.DRAW_DRAIN_MAX);
 /* it shows in the forecast, by name, so the Crown tab can say why */
 const f=E.forecast(s,{}),row=f.trustFactors.find(x=>/unattended/.test(x.name));
 assert.equal(row.value,drain(13).trust);assert.ok(/13 closes/.test(row.name));
 assert.equal(E.forecast(open(),{}).trustFactors.find(x=>/unattended/.test(x.name)).value,0);
 /* two stewards, the same city: the one who stayed away is trusted less and his council is colder */
 const home=open(),away=open();
 for(let i=0;i<20;i++){E.attend(home);E.tick(home,{},quiet);E.tick(away,{},quiet);}
 assert.ok(home.trust>away.trust+6,'trust '+home.trust+' against '+away.trust);
 assert.ok(E.favour(home)>E.favour(away)+12,'favour '+E.favour(home)+' against '+E.favour(away));
 /* and it is not only the council: the city itself is uneasier, and draws fewer */
 assert.ok(home.mood>away.mood+6,'mood '+home.mood+' against '+away.mood);assert.ok(home.attract>away.attract+4,'draw '+home.attract+' against '+away.attract);
 assert.ok(E.forecast(away,{}).moodFactors.some(x=>/Nobody has seen the steward/.test(x.name)&&x.value<0)&&E.forecast(away,{}).attractFactors.some(x=>/nobody is seen to run/.test(x.name)&&x.value<0));
 assert.ok(E.councilView(away,{}).seats.filter(x=>x.trend<0).length>=4,'the table is cooling');
 /* sitting down stops the slide - it does not undo it */
 const lost=away.trust,was=E.attend(away);
 assert.equal(was,20);assert.equal(away.unattended,0);assert.equal(away.trust,lost);assert.equal(E.neglect(away).seats,0);
 E.tick(away,{},quiet);assert.ok(E.councilView(away,{}).seats.some(x=>x.trend>0),'and the council starts to warm again');
 /* nothing counts before the books are open, and the count survives a save */
 const shut=E.create();E.tick(shut,{},quiet);assert.equal(shut.unattended,0);
 s.unattended=7;assert.equal(E.normalize(JSON.parse(JSON.stringify(s))).unattended,7);assert.equal(E.normalize({v:E.VERSION,unattended:-3}).unattended,0);
});

test('the granary: the city eats a sack a household, grain is bought by the shipment or comes in gradually on standing orders, and hunger builds and eases slowly',()=>{
 const s=E.create(),N=E.hearths(s);assert.deepEqual(s.food,{stock:0,auto:false,hunger:0});assert.equal(N,70);
 E.charter(s);assert.equal(s.food.stock,E.FOOD_START,'the last steward left three closes of grain');assert.equal(Math.floor(E.FOOD_START/N),3);
 let v=E.foodView(s,{});
 assert.equal(v.need,N);assert.equal(v.closes,Math.floor(E.FOOD_START/N));assert.equal(v.price,E.FOOD_PRICE*K);assert.equal(v.autoPrice,Math.round(v.price*E.AUTO_PREMIUM));assert.equal(v.cap,E.FOOD_CAP);
 assert.equal(v.ship.sacks,0);assert.equal(line(E.forecast(s,{}),'expenses','grain'),0);
 /* a close eats N sacks */
 E.tick(s,{},quiet);assert.equal(s.food.stock,E.FOOD_START-N);assert.equal(s.food.hunger,0);
 /* bought at the table: as much as asked for, as the stores hold, as the treasury can pay */
 const cash=s.treasury,buy=E.buyFood(s,{},200);
 assert.ok(buy.ok);assert.equal(buy.sacks,200);assert.equal(buy.cost,200*v.price);assert.equal(s.treasury,cash-200*v.price);assert.equal(s.food.stock,E.FOOD_START-N+200);
 assert.equal(E.buyFood(s,{},1e9).sacks,E.FOOD_CAP-(E.FOOD_START-N+200),'the stores fill to the rafters and no further');assert.equal(E.buyFood(s,{},10).ok,false);
 const poor=open();poor.food.stock=0;poor.treasury=950;assert.equal(E.buyFood(poor,{},500).sacks,Math.floor(950/v.price));poor.treasury=-5;assert.equal(E.buyFood(poor,{},500).ok,false);
 /* transport makes grain cheaper and the stores bigger; so does a farm of your own */
 const t=open();t.works={carters:{left:0},quay:{left:0},fleet:{left:0},coveredmarket:{left:0}};
 const tv=E.foodView(t,{farmOwned:true});
 assert.equal(tv.discount,.4);assert.equal(tv.price,Math.round(E.FOOD_PRICE*K*.6));assert.equal(tv.cap,E.FOOD_CAP+2*E.FOOD_STORE);assert.ok(Math.floor(E.FOOD_CAP/N)<=9,'stores filled to the rafters feed the opening city for about eight closes, not thirty');assert.equal(tv.cuts.length,5);
 /* a warning while there is still time, then the granary is empty and the hunger BUILDS, close after close */
 const h=E.create();E.charter(h);h.food.stock=N*3+10;
 const warn=E.tick(h,{},quiet);assert.ok(warn.unrest.some(u=>/holds bread for 2 more closes/.test(u)));
 const day1=E.create();E.charter(day1);assert.ok(E.tick(day1,{},quiet).unrest.some(u=>/holds bread for 2 more closes/.test(u)),'the very first close says so');
 E.tick(h,{},quiet);E.tick(h,{},quiet);assert.equal(h.food.stock,10);assert.equal(h.food.hunger,0);
 const first=E.tick(h,{},quiet);assert.equal(h.food.stock,0);assert.ok(first.unrest.some(u=>/granary is EMPTY/.test(u)));assert.ok(h.food.hunger>.8*E.HUNGER_GAIN&&h.food.hunger<.9*E.HUNGER_GAIN,'most of the city went without: '+h.food.hunger);
 const moods=[],hungers=[];for(let i=0;i<12;i++){E.attend(h);E.tick(h,{},quiet);moods.push(E.forecast(h,{}).moodTarget);hungers.push(h.food.hunger);}
 for(let i=1;i<hungers.length;i++)assert.ok(hungers[i]>=hungers[i-1]&&hungers[i]-hungers[i-1]<=E.HUNGER_GAIN+.001,'a slope, close after close');
 assert.equal(h.food.hunger,E.HUNGER_MAX);assert.ok(moods[11]<moods[0]-15,'the temper sinks with it: '+moods.join(','));
 const hf=E.forecast(h,{});
 assert.ok(hf.moodFactors.some(x=>/Hunger/.test(x.name)&&x.value===-36)&&hf.attractFactors.some(x=>/Hunger/.test(x.name)&&x.value===-18)&&hf.trustFactors.some(x=>/Hunger/.test(x.name)&&x.value===-2));
 assert.ok(h.pop<E.POPULATION,'and the hungriest leave: '+h.pop);
 /* bread again: the hunger eases half a point a close - what was lost comes back slowly */
 E.buyFood(h,{},10000);E.tick(h,{},quiet);assert.equal(h.food.hunger,E.HUNGER_MAX-.5);
 for(let i=0;i<11;i++){E.buyFood(h,{},200);E.tick(h,{},quiet);}assert.equal(h.food.hunger,0);
 /* standing shipments: what the city eats and a quarter of the way to six closes' reserve, every close, at a quarter over the price */
 const a=E.create();E.charter(a);a.food.stock=0;assert.equal(E.setAutoFood(a,true),true);
 const av=E.foodView(a,{});
 assert.equal(av.ship.sacks,N+Math.ceil(6*N/4));assert.equal(av.ship.cost,av.ship.sacks*av.autoPrice);assert.equal(line(E.forecast(a,{}),'expenses','grain'),av.ship.cost);
 const before=a.treasury,net=E.forecast(a,{}).net;E.tick(a,{},quiet);
 assert.equal(a.treasury,before+net,'charged with the rest of the ledger');assert.equal(a.food.stock,av.ship.sacks-N);assert.equal(a.food.hunger,0,'nobody went hungry');
 const stocks=[];for(let i=0;i<30;i++){E.tick(a,{},quiet);stocks.push(a.food.stock);}
 assert.ok(stocks[29]>=E.hearths(a)*5&&stocks[29]<=E.hearths(a)*8,'it settles at about six closes of bread: '+stocks[29]);assert.equal(a.food.hunger,0);
 assert.ok(E.foodView(a,{}).ship.sacks<=E.hearths(a)+4,'and then brings only what is eaten');
 /* the merchants want coin: while the bank will cover a close the grain still comes - with the strongroom AND the line spent, it stops */
 a.treasury=0;a.food.stock=0;assert.ok(E.foodView(a,{}).ship.sacks>=E.hearths(a),'on the line');
 a.loan=a.limit;assert.equal(E.foodView(a,{}).ship.sacks,0);assert.equal(E.foodView(a,{}).ship.short,true);
 /* rats */
 const r=open();r.food.stock=1000;const rats=E.EVENTS.find(e=>/Rats/.test(e.text));assert.equal(rats.food,-.15);
 /* and it all survives a save */
 a.food.hunger=1.37;const back=E.normalize(JSON.parse(JSON.stringify(a)));assert.deepEqual(back.food,a.food);
 assert.deepEqual(E.normalize({v:E.VERSION,food:{stock:-4,auto:1,hunger:99}}).food,{stock:0,auto:true,hunger:E.HUNGER_MAX});
});

test('more townsfolk eat more - and pay more: the grain, the poll tax and the rents all grow with every head',()=>{
 const small=open(),big=open();big.pop=700;
 const fs=E.forecast(small,{}),fb=E.forecast(big,{});
 assert.equal(E.foodView(big,{}).need,2*E.foodView(small,{}).need,'twice the heads eat twice the sacks');
 for(const id of ['taxes','rents'])assert.ok(Math.abs(line(fb,'income',id)-2*line(fs,'income',id))<=1,id+' doubles with the population');
 /* and a head is worth more than it eats, even on standing orders - growing the city pays */
 const perHearth=(line(fs,'income','taxes')+line(fs,'income','rents'))/E.hearths(small);
 assert.ok(perHearth>E.foodView(small,{}).autoPrice*2,'a household brings in '+perHearth.toFixed(0)+' a close and eats '+E.foodView(small,{}).autoPrice);
 small.food.auto=big.food.auto=true;small.food.stock=big.food.stock=0;
 assert.ok(E.foodView(big,{}).ship.cost>E.foodView(small,{}).ship.cost*1.9,'the standing shipments grow with the city too');
});

test('nothing costs the same two closes running: a live game blows three winds, lands every close off the estimate and raises wages every season',()=>{
 /* still air for the arithmetic tests: no ctx.live, no winds, the close lands exactly on the forecast */
 const still=open(),fs0=E.forecast(still,{});const rs=E.tick(still,{},Math.random);
 assert.deepEqual(still.winds,{trade:0,harvest:0,prices:0});assert.equal(rs.in,fs0.totalIn);assert.equal(rs.out,fs0.totalOut);
 /* live: the same budget, forty closes, never the same result twice */
 let x=2024;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 const s=open(),nets=new Set(),off=[],news=[];
 for(let i=0;i<40;i++){
  E.attend(s);s.incidents=[];s.petition=null;s.king.demand=null;
  const f=E.forecast(s,{live:true}),r=E.tick(s,{live:true},rng);
  assert.equal(r.expected,f.net,'the entry remembers what the Hand expected');
  assert.ok(Math.abs(r.in/f.totalIn-1)<=E.JITTER_IN/2+.001&&Math.abs(r.out/f.totalOut-1)<=E.JITTER_OUT/2+.001,'within a few percent of it');
  nets.add(r.in-r.out);off.push(Math.abs(r.in-f.totalIn));news.push(...r.unrest.filter(u=>/^🌬/.test(u)));
  for(const key of E.WIND_KEYS)assert.ok(Math.abs(s.winds[key])<=E.WIND_MAX);
 }
 assert.ok(nets.size>=38,'forty closes, '+nets.size+' different results');assert.ok(off.filter(v=>v>100).length>=25,'and rarely on the estimate');
 assert.ok(news.length>=3,'a turn of the wind makes the news: '+news.length);
 assert.ok(E.WIND_KEYS.some(key=>s.winds[key]!==0));
 /* what each wind moves */
 const w=open(),base=E.forecast(w,{});
 w.winds.trade=.2;let f=E.forecast(w,{});for(const id of ['tolls','exports','imports'])assert.ok(line(f,'income',id)>line(base,'income',id)*1.15,id+' rides the trade wind');
 assert.equal(line(f,'income','taxes'),line(base,'income','taxes'));w.winds.trade=0;
 w.winds.harvest=-.2;f=E.forecast(w,{});assert.ok(line(f,'income','taxes')<line(base,'income','taxes')&&line(f,'income','rents')<line(base,'income','rents')&&line(f,'income','church')<line(base,'income','church'),'a lean harvest thins every purse');
 assert.ok(E.foodView(w,{}).price>E.foodView(open(),{}).price,'and makes bread dear');assert.equal(E.foodView(w,{}).harvest,'failed');w.winds.harvest=0;
 w.winds.prices=.2;f=E.forecast(w,{});for(const id of ['relief','court','food','clean'])assert.ok(line(f,'expenses',id)>line(base,'expenses',id),id+' is bought, and prices are dear');
 assert.equal(line(f,'expenses','guard'),line(base,'expenses','guard'),'wages do not follow the market');
 assert.deepEqual(f.winds.map(v=>v.name),['steady','fair','ruinous']);
 /* wages: every season everybody on the payroll asks for a rise, so an untouched budget drifts out of true */
 const p=open(),guard0=line(E.forecast(p,{}),'expenses','guard'),purse0=line(E.forecast(p,{}),'expenses','purse');
 let last;for(let i=0;i<E.SEASON_CLOSES;i++){E.attend(p);last=E.tick(p,{},quiet);}
 assert.equal(p.wage,1+E.WAGE_RISE);assert.ok(last.unrest.some(u=>/asked for a rise/.test(u)));assert.equal(p.seasons[0].wage,p.wage);
 assert.equal(line(E.forecast(p,{}),'expenses','guard'),Math.round(guard0*p.wage));assert.ok(line(E.forecast(p,{}),'expenses','purse')>purse0);
 for(let k=0;k<3;k++)for(let i=0;i<E.SEASON_CLOSES;i++){E.attend(p);p.treasury=4000000;E.tick(p,{},quiet);}
 assert.ok(Math.abs(p.wage-Math.pow(1+E.WAGE_RISE,4))<1e-3,'it compounds: '+p.wage);
 /* and all of it survives a save */
 s.wage=1.0609;const back=E.normalize(JSON.parse(JSON.stringify(s)));assert.deepEqual(back.winds,s.winds);assert.equal(back.wage,1.0609);
 assert.deepEqual(E.normalize({v:E.VERSION,wage:99,winds:{trade:9,harvest:'x',prices:-9}}).winds,{trade:E.WIND_MAX,harvest:0,prices:-E.WIND_MAX});
});

test('the share of the tithes: fuller plates in a contented city, and a pious King and the High Almoner who take a heavy hand personally',()=>{
 const s=open(),base=line(E.forecast(s,{}),'income','church');
 assert.ok(base>800&&base<25000,'the customary share: '+base);
 const glad=open();glad.mood=95;assert.ok(line(E.forecast(glad,{}),'income','church')>base);
 const big=open();big.pop=700;assert.ok(Math.abs(line(E.forecast(big,{}),'income','church')-2*base)<=1,'it grows with every head');
 const feast=open();E.setBudget(feast,'festival',2);assert.ok(line(E.forecast(feast,{}),'income','church')>base,'feast days fill the plate');
 const none=open();E.setBudget(none,'tithe',0);assert.equal(line(E.forecast(none,{}),'income','church'),0);assert.ok(E.forecast(none,{}).moodTarget>E.forecast(s,{}).moodTarget);
 const pious=open();pious.king.humour='pious';assert.ok(line(E.forecast(pious,{}),'income','church')>base);
 const calm=E.forecast(pious,{}).pleasureTarget;E.setBudget(pious,'tithe',3);
 assert.equal(E.forecast(pious,{}).pleasureTarget,calm-14,'seize the plate under a pious King and he takes it personally');
 const seat=()=>E.councilView(pious,{}).seats.find(x=>x.id==='bread').target;
 const taken=seat();E.setBudget(pious,'tithe',1);assert.equal(seat(),taken+20,'and so does the High Almoner');
});

test('no two seasons are alike: a live game deals every season a card, rolls the size of everything on it, and never deals the same one twice running',()=>{
 /* still air: every season is an ordinary one, and nothing about it moves the forecast */
 const calm=open();for(let i=0;i<E.SEASON_CLOSES*2;i++){E.attend(calm);calm.treasury=4000000;E.tick(calm,{},quiet);}
 assert.equal(calm.season.n,3);assert.deepEqual(calm.season.card,{id:'ordinary',mods:{}});
 /* live: the first season is ordinary (enough is new already), the ones after it are dealt */
 let x=5150;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 const s=open();assert.equal(s.season.card.id,'ordinary');
 const dealt=[],opened=[];
 for(let k=0;k<14;k++)for(let i=0;i<E.SEASON_CLOSES;i++){
  E.attend(s);s.treasury=4000000;s.food.stock=1e6;
  const r=E.tick(s,{live:true},rng);
  if(r.review){dealt.push(s.season.card);opened.push(...r.unrest.filter(u=>/^🎲 Season/.test(u)));assert.equal(s.seasons[s.seasons.length-1].card!==undefined,true,'the review remembers what kind of season it was');}
 }
 assert.equal(dealt.length,14);
 for(let i=1;i<dealt.length;i++)assert.notEqual(dealt[i].id,dealt[i-1].id,'never the same season twice running');
 assert.ok(new Set(dealt.map(c=>c.id)).size>=7,'fourteen seasons, '+new Set(dealt.map(c=>c.id)).size+' kinds');
 assert.equal(opened.length,dealt.filter(c=>c.id!=='ordinary').length,'every dealt season is announced');
 /* the cards: well-formed, and the SIZE of each is rolled - two hard winters are not the same winter */
 assert.ok(E.SEASON_CARDS.length>=12);assert.equal(new Set(E.SEASON_CARDS.map(c=>c.id)).size,E.SEASON_CARDS.length);
 for(const c of E.SEASON_CARDS){
  assert.ok(c.name&&c.icon&&c.text&&c.w>0,c.id);
  const lo=c.roll(()=>0),hi=c.roll(()=>.999);
  for(const key of Object.keys(lo)){assert.ok(Number.isFinite(lo[key])&&Number.isFinite(hi[key]),c.id+'.'+key);
   assert.ok(['trade','harvest','prices','wage','eat','court','church','mood','attract','trouble','wishes','arrive','sick','interest'].includes(key),c.id+' has an unknown mod '+key);}
  if(c.id!=='ordinary')assert.ok(Object.keys(lo).some(key=>lo[key]!==hi[key]),c.id+' is a different size every time');
 }
 /* what a card does */
 const base=E.forecast(open(),{}),with_=mods=>{const t=open();t.season.card={id:'winter',mods};return t;};
 let f=E.forecast(with_({trade:.2}),{});assert.ok(line(f,'income','tolls')>line(base,'income','tolls')*1.15);
 f=E.forecast(with_({harvest:-.25}),{});assert.ok(line(f,'income','taxes')<line(base,'income','taxes'));assert.ok(E.foodView(with_({harvest:-.25}),{}).price>E.foodView(open(),{}).price);
 f=E.forecast(with_({prices:.2,wage:1.2,court:1.5,interest:1.3,church:2,mood:-3,attract:-8}),{});
 assert.ok(line(f,'expenses','relief')>line(base,'expenses','relief'));assert.equal(line(f,'expenses','guard'),Math.round(line(base,'expenses','guard')*1.2));
 assert.ok(line(f,'expenses','court')>line(base,'expenses','court')*1.7);assert.equal(line(f,'expenses','interest'),Math.round(line(base,'expenses','interest')*1.3));
 assert.ok(Math.abs(line(f,'income','church')-2*line(base,'income','church'))<=2);assert.equal(f.moodTarget,base.moodTarget-3);assert.equal(f.attractTarget,base.attractTarget-8);
 assert.equal(f.card.id,'winter');assert.ok(f.card.name&&f.card.text);
 assert.equal(E.foodView(with_({eat:1.3}),{}).need,Math.ceil(70*1.3),'a hard winter eats more');
 /* the sickness takes its share at every close, and drains and a hospital blunt it; refugees come whatever the city is like */
 const sick=with_({sick:.01});sick.season.card.id='sickness';E.tick(sick,{},quiet);assert.equal(sick.pop,350-4);
 const nursed=with_({sick:.01});nursed.works={hospital:{left:0}};E.tick(nursed,{},quiet);assert.equal(nursed.pop,350-2);
 const gate=with_({arrive:2.5});gate.attract=45;E.tick(gate,{},quiet);assert.ok(gate.pop>350,'refugees: '+gate.pop);
 /* and the card survives a save; a card nobody knows is an ordinary season */
 const back=E.normalize(JSON.parse(JSON.stringify(with_({prices:.2,eat:1.3}))));assert.deepEqual(back.season.card,{id:'winter',mods:{prices:.2,eat:1.3}});
 assert.deepEqual(E.normalize({v:E.VERSION,chartered:true,season:{card:{id:'ghost',mods:{trade:9}}}}).season.card,{id:'ordinary',mods:{}});
});

test('a city of hundreds moves by the dozen: about twenty a close when it is sought after, never more than one in twenty out, and five thousand at the very most',()=>{
 const s=open();s.attract=85;s.mood=80;
 for(const [k,v] of [['relief',2],['festival',2],['clean',3],['food',3],['watch',2],['rent',0]])E.setBudget(s,k,v);
 E.attend(s);const r=E.tick(s,{},quiet);
 assert.ok(r.moved>=15&&r.moved<=30,'moved in: '+r.moved);assert.ok(r.unrest.some(u=>new RegExp('🧳 '+r.moved+' new townsfolk').test(u)),'and the ledger says how many');
 /* the bigger the city, the more come */
 const big=open();big.pop=3000;big.attract=85;big.works={tenements:{left:0},newquarter:{left:0},suburbs:{left:0},riverside:{left:0}};
 E.attend(big);assert.ok(E.tick(big,{},quiet).moved>r.moved*2);
 /* roofs: 500 to begin with, and four quarters take it to five thousand - and not a soul beyond */
 assert.equal(E.forecast(open(),{}).housing,500);assert.equal(E.forecast(big,{}).housing,E.POP_MAX);
 big.pop=4995;big.attract=100;E.attend(big);const last=E.tick(big,{},quiet);assert.equal(big.pop,5000);assert.equal(last.moved,5);
 E.attend(big);assert.ok(E.tick(big,{},quiet).unrest.some(u=>/as big as its walls will ever hold/.test(u)));
 assert.equal(E.normalize({v:E.VERSION,pop:999999}).pop,E.POP_MAX);
 /* out: a slope, never a cliff */
 const bad=open();bad.attract=0;bad.food.stock=0;bad.food.hunger=6;
 const gone=-E.tick(bad,{},quiet).moved;assert.ok(gone>=10&&gone<=Math.ceil(350*E.LEAVE_MAX),'left: '+gone);
});

test('a bigger city costs more to run - but a household always brings in more than it costs',()=>{
 const small=open(),big=open();big.pop=2800;
 const fs0=E.forecast(small,{}),fb=E.forecast(big,{});
 for(const id of ['watch','roads','relief','clean','learn','food'])assert.ok(line(fb,'expenses',id)>line(fs0,'expenses',id)*4&&line(fb,'expenses',id)<line(fs0,'expenses',id)*8,id+' grows with the head count, with economies in size');
 for(const id of ['court','purse'])assert.ok(line(fb,'expenses',id)>line(fs0,'expenses',id)*2&&line(fb,'expenses',id)<line(fs0,'expenses',id)*4,'a King of thousands expects more: '+id);
 assert.equal(line(fb,'expenses','guard'),line(fs0,'expenses','guard'),'eight men at the pillars, however big the city');
 assert.ok(fb.net>fs0.net,'growing still pays: '+fb.net+' against '+fs0.net);
 assert.equal(fs0.factor.watch,1);assert.ok(fb.factor.watch>5);
});

test('🏗 level 2: a standing work raised once - twice its gifts and its upkeep - after a season, for a devoted council, at its price again (2026-09-22)',()=>{
 const s=open();s.treasury=1e7;
 E.invest(s,{},'carters');E.tick(s,{},quiet);
 const one=E.forecast(s,{}),v1=E.worksView(s,{}).list.find(w=>w.id==='carters');
 assert.equal(v1.status,'done');assert.equal(v1.lvl,1);assert.equal(v1.up.status,'locked');assert.match(v1.up.why,/season/);
 assert.equal(E.upgrade(s,{},'carters').ok,false,'no season on the books');
 assert.equal(E.upgrade(s,{},'quay').ok,false,'not standing');
 s.season.n=2;
 assert.match(E.worksView(s,{}).list.find(w=>w.id==='carters').up.why,/devoted/);assert.equal(E.upgrade(s,{},'carters').ok,false,'the council is not devoted');
 for(const k of Object.keys(s.council))s.council[k]=E.UP_FAVOUR;
 const v2=E.worksView(s,{}).list.find(w=>w.id==='carters');
 assert.equal(v2.up.status,'ready');assert.equal(v2.up.cost,v2.cost,'its price again');assert.equal(v2.up.build,v2.build);assert.equal(v2.up.upkeep,v2.upkeep*2);
 const cash=s.treasury,mid=E.forecast(s,{}),r=E.upgrade(s,{},'carters');
 assert.ok(r.ok);assert.equal(s.treasury,cash-v2.cost);assert.equal(s.works.carters.up,v2.build);assert.equal(E.raising(s,'carters'),true);
 assert.equal(E.upgrade(s,{},'carters').ok,false,'a crew is on it');
 assert.equal(E.worksView(s,{}).building,1,'the crew counts');
 assert.equal(line(E.forecast(s,{}),'income','exports'),line(mid,'income','exports'),'it keeps working at level 1 meanwhile');
 const c=E.tick(s,{},quiet);assert.deepEqual(c.raised,['carters']);assert.ok(c.unrest.some(u=>/level 2/.test(u)));
 assert.equal(E.lvlOf(s,'carters'),2);assert.equal(s.works.carters.up,undefined);assert.equal(E.has(s,'carters'),true);
 const two=E.forecast(s,{}),v3=E.worksView(s,{}).list.find(w=>w.id==='carters');
 assert.equal(v3.lvl,2);assert.equal(v3.up.status,'done');assert.equal(v3.upkeep,v1.upkeep*2);
 assert.equal(E.worksFx(s).exports,110*2);assert.equal(E.worksFx(s).upkeep,25*2);assert.ok(Math.abs(E.worksFx(s).trade-.06)<1e-9);
 assert.ok(v3.effects.some(e=>/exports \+22.000/.test(e)),v3.effects.join(' | '));   /* the thousands gap is whatever the locale says */
 assert.equal(line(two,'expenses','upkeep'),line(one,'expenses','upkeep')*2,'twice the keep');
 assert.equal(E.upgrade(s,{},'carters').ok,false,'once');
 /* blocks and one-offs do not double; the walls still hold five thousand */
 const b=open();b.works={customs:{left:0,lvl:2},tenements:{left:0,lvl:2},newquarter:{left:0,lvl:2},suburbs:{left:0,lvl:2},riverside:{left:0,lvl:2}};
 assert.equal(E.worksFx(b).blocks.size,1);assert.equal(E.forecast(b,{}).housing,E.POP_MAX);
 /* through a save: the level and a crew half way there */
 const p=open();p.works={carters:{left:0,lvl:2},quay:{left:0,up:1},fleet:{left:1,lvl:2,up:2},lamps:{left:0,lvl:7}};
 const back=E.normalize(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(back.works,{carters:{left:0,lvl:2},quay:{left:0,up:1},fleet:{left:1},lamps:{left:0}});
});

test('the Velvet Lantern: dear to build, pays like the plate - by the household - draws visitors, and a pious King sulks',()=>{
 const def=E.WORKS.find(w=>w.id==='brothel');
 assert.ok(def.cost>=E.WORKS.map(w=>w.cost).sort((a,b)=>b-a)[4],'among the dearest works on the list: '+def.cost); /* top five since the tenements went to 2 000 000 (2026-09-22) */
 const s=open(),before=E.forecast(s,{});
 assert.ok(!before.income.some(l=>l.id==='vice'),'no line on the ledger until the lamps are lit');
 s.works.brothel={left:0};
 const f=E.forecast(s,{}),vice=f.income.find(l=>l.id==='vice').amount,church=f.income.find(l=>l.id==='church').amount;
 assert.ok(vice>church*.5&&vice<church*2,'takings of the same order as the plate: '+vice+' against '+church);
 assert.equal(f.attractTarget,before.attractTarget+3);
 const big=open();big.works.brothel={left:0};big.pop=2800;
 assert.ok(E.forecast(big,{}).income.find(l=>l.id==='vice').amount>vice*5,'and it grows with the city');
 assert.ok(f.net>before.net,'it earns more than its upkeep');
 s.king.humour='pious';assert.equal(E.forecast(s,{}).pleasureTarget,before.pleasureTarget-6);
 assert.ok(E.worksView(s,{}).list.find(w=>w.id==='brothel').effects.some(e=>/household/.test(e)));
});

test('every city from before the office had to be earned is closed: it starts again from a commoner on the square',()=>{
 for(const v of [2,3]){const s=E.normalize({v,chartered:true,treasury:412345,loan:480000,pop:410,office:3,noble:{rank:6,xp:9000}});assert.deepEqual(s,E.create(),'v'+v);}
 assert.equal(E.create().office,0);assert.equal(E.create().chartered,false);
 assert.equal(E.recoin({v:2,treasury:5,loan:7},10).treasury,50,'the re-striking tool is still there for the next coinage');
});
