/* The Tides Bank, headless: what the Hand lays out before the founding loan, seasons that end in a
 * graded review, a line and a rate that move with it, a shortfall covered from the line at a fee,
 * and - past the line - the red: a close of grace, then bailiffs who take one thing at a close.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};   /* ...with a granary that will not run out under a test about something else */
const K=E.COIN,N=E.SEASON_CLOSES;
const quiet=()=>.95;
const rate=v=>Math.round(v*1e5)/1e5;        /* the bank keeps its rates to a thousandth of a percent */
const season=(s,each)=>{let last;for(let i=0;i<N;i++){E.attend(s);if(each)each(s,i);last=E.tick(s,{},quiet);}return last;};   /* a steward who is at the table every close */

test('before the signing the Hand can lay out a close, a season and what the loan will cost',()=>{
 const s=E.create(),v=E.charterView(s,{});
 assert.equal(v.loan,5000000);assert.equal(v.line,6500000);assert.equal(v.reserve,1500000);assert.equal(v.closes,N);
 assert.equal(v.interest,Math.round(5000000*E.LOAN_RATE));assert.equal(v.target,4500000);assert.equal(v.due,500000);
 assert.ok(v.perCloseIn>0&&v.perCloseOut>v.perCloseIn,'the city does not cover its own costs');
 assert.ok(v.net<-40000,'and then there is the interest: '+v.net);
 assert.equal(v.grain,E.foodView(s,{}).need*E.foodView(s,{}).price,'the grain is on the list the Hand reads out');assert.equal(v.expenses[v.expenses.length-1].id,'grain');assert.equal(v.wageRise,E.WAGE_RISE);
 assert.equal(v.seasonNet,v.net*N);assert.equal(v.seasonOut,(v.perCloseOut+v.interest)*N);
 assert.ok(v.income.every(l=>l.amount>0)&&v.expenses.every(l=>l.amount>0)&&!v.expenses.some(l=>l.id==='interest')&&v.income.some(l=>l.id==='church'),'the costs as they stand, before any loan');
 assert.ok(N>=10&&N<=50);
});

test('a season of doing nothing: the debt is called in, the grade is poor, the line narrows and the money gets dearer',()=>{
 const s=open();
 for(let i=0;i<N-1;i++){const r=E.tick(s,{},quiet);assert.equal(r.review,null);}
 assert.equal(s.season.closes,N-1);assert.equal(s.season.series.length,N-1);assert.equal(s.seasons.length,0);
 const cash=s.treasury,last=E.tick(s,{},quiet);
 assert.deepEqual(last.review,{n:1,grade:'D'});assert.ok(last.unrest.some(u=>/Season 1 is closed/.test(u))&&last.unrest.some(u=>/called it in/.test(u)));
 const v=s.seasons[0];
 assert.equal(v.grade,'D');assert.equal(v.paid,false);assert.equal(v.red,0);assert.equal(v.covered,0);assert.equal(v.series.length,N);
 assert.equal(v.swept,500000,'what was owed above the target came straight out of the strongroom');assert.equal(s.loan,4500000);assert.equal(s.treasury,cash+last.net-500000);
 assert.ok(v.worth<v.worthStart,'the crown is worth less than it was');assert.ok(v.interest>=N*24000);
 assert.equal(s.limit,Math.round(6500000*.95));assert.equal(s.rate,rate(E.LOAN_RATE+.0005));
 assert.equal(s.season.n,2);assert.equal(s.season.target,4050000);assert.deepEqual(s.season.series,[]);assert.equal(s.reviewSeen,false);
});

test('a season that ends with the debt down, the strongroom never dry and the crown worth more earns an A: a wider line and cheaper money',()=>{
 const s=open(),trust0=s.trust;
 season(s,(st,i)=>{if(i===N-1){E.deposit(st,1200000,1e9,{});E.repay(st,500000);}});
 const v=s.seasons[0];
 assert.equal(v.grade,'A');assert.equal(v.paid,true);assert.equal(v.swept,0);assert.equal(v.reduced,500000);assert.equal(s.loan,4500000);
 assert.equal(s.limit,Math.round(6500000*1.12+500000));assert.equal(s.rate,rate(E.LOAN_RATE-.0005));
 assert.ok(s.trust>trust0+6,'the realm hears of it');
 /* in the black but no richer: a B, and a smaller reward */
 const b=open();season(b,(st,i)=>{if(i===N-1)E.repay(st,500000);});
 assert.equal(b.seasons[0].grade,'B');assert.equal(b.limit,Math.round(6500000*1.06+500000*.75));
 /* it is where the debt ENDS that counts: gold sent to and fro earns nothing */
 const c=open();season(c,st=>{E.borrow(st,{},1000000);E.repay(st,1000000);});
 assert.equal(c.seasons[0].grade,'D');assert.equal(c.seasons[0].reduced,0);
 /* and drawing the reserve is fine, as long as it is back by the end */
 const d=open();season(d,(st,i)=>{if(i===0)E.borrow(st,{},1500000);if(i===N-1)E.repay(st,2000000);});
 assert.equal(d.seasons[0].paid,true);assert.ok('AB'.includes(d.seasons[0].grade));
 /* the rate never leaves its band, however many good or bad seasons follow */
 const many=open();for(let k=0;k<12;k++)season(many,(st,i)=>{if(i===N-1){E.deposit(st,2000000,1e9,{});E.repay(st,1e9);}});
 assert.equal(many.rate,E.MIN_RATE);assert.equal(many.loan,0);assert.equal(many.seasons.length,6,'six seasons are kept');assert.equal(many.seasons[5].n,12);
 assert.equal(many.seasons[5].grade,'A','debt-free and growing is as good as it gets');
});

test('a shortfall is covered from the line at a fee while there is a line',()=>{
 const s=open();s.treasury=0;
 const f=E.forecast(s,{}),r=E.tick(s,{},quiet);
 assert.equal(r.covered,-f.net);assert.equal(s.treasury,0);assert.equal(s.loan,5000000-f.net+Math.round(-f.net*E.COVER_FEE));
 assert.equal(s.season.covered,1);assert.equal(s.season.red,0);assert.equal(s.arrears,0);assert.ok(r.unrest.some(u=>/covered a shortfall/.test(u)));
 assert.equal(E.frozen(s),false);
 /* a season with a bail-out in it is never an A */
 season(s,(st,i)=>{if(i===N-2){E.deposit(st,3000000,1e9,{});E.repay(st,st.loan-st.season.target);}});
 assert.notEqual(s.seasons[0].grade,'A');
});

test('past the line the treasury is in the red: nothing may be raised or ordered, and after a close of grace the bailiffs take one thing at a close',()=>{
 const s=open();
 s.loan=s.limit;s.budget.watch=2;s.budget.festival=1;
 s.works={carters:{left:0},quay:{left:0},school:{left:2}};
 const red=()=>{s.treasury=-600000;return E.tick(s,{},quiet);};
 const first=red();
 assert.equal(first.covered,0);assert.equal(s.arrears,1);assert.ok(first.unrest.some(u=>/one close to mend it/.test(u)));
 assert.equal(E.frozen(s),true);
 assert.equal(E.setBudget(s,'relief',2),false,'no line may be raised in the red');assert.equal(E.setBudget(s,'relief',0),true,'but any may be cut');assert.equal(E.setBudget(s,'tax',15),true,'and taxes may rise');
 assert.equal(E.invest(s,{},'lamps').ok,false);assert.equal(E.worksView(s,{}).list.find(w=>w.id==='lamps').status,'frozen');
 /* the ladder: a site, the watch, a work nothing stands on, the guard, the festivals, a work, the court */
 assert.ok(red().unrest.some(u=>/stopped work on the Parish Schoolhouse/.test(u)));assert.equal(s.works.school,undefined);
 assert.ok(red().unrest.some(u=>/dismissed a file of the City Watch/.test(u)));assert.equal(s.budget.watch,1);
 assert.ok(red().unrest.some(u=>/seized the Stone Quay/.test(u)),'the quay goes before the yard it stands on');assert.deepEqual(s.seized,['quay']);assert.ok(s.works.carters);
 const pleasure=s.king.pleasure;
 assert.ok(red().unrest.some(u=>/paid off two of the Royal Guard/.test(u)));assert.equal(s.guards,6);assert.ok(s.king.pleasure<pleasure);
 assert.equal(E.forecast(s,{}).expenses.find(l=>l.id==='guard').amount,6*E.GUARD_WAGE*K);
 assert.ok(red().unrest.some(u=>/struck the festivals/.test(u)));assert.equal(s.budget.festival,0);
 assert.ok(red().unrest.some(u=>/seized the Carters/.test(u)));assert.deepEqual(s.seized,['quay','carters']);assert.deepEqual(s.works,{});
 assert.ok(red().unrest.some(u=>/cut the court/.test(u)));assert.equal(s.budget.court,0);
 /* what is sold is credited: a third of a finished work, half of a site */
 const t=open();t.loan=t.limit;t.works={university:{left:4}};t.treasury=-10000;E.tick(t,{},quiet);t.treasury=-10000;
 const net=E.forecast(t,{}).net;E.tick(t,{},quiet);
 assert.equal(t.treasury,-10000+net+Math.round(E.WORKS.find(w=>w.id==='university').cost*K*.5));
 /* when there is nothing left the bank writes the budget itself, and the red has a floor */
 for(let i=0;i<12;i++)red();
 assert.equal(s.guards,E.MIN_GUARD,'the last two are never taken');
 assert.ok(E.LINE_KEYS.every(k=>s.budget[k]===0),'every line to the bone');
 s.treasury=-9e6;const floor=E.tick(s,{},quiet);
 assert.equal(s.treasury,-Math.round(E.creditLimit({},s)*E.RED_FLOOR));assert.ok(floor.unrest.some(u=>/went unpaid/.test(u)));
 /* back in the black: the arrears are forgotten, the lines can be raised, the seized work rebuilt and the guard hired back */
 s.treasury=4000000;E.tick(s,{},quiet);
 assert.equal(s.arrears,0);assert.equal(E.frozen(s),false);assert.ok(E.setBudget(s,'watch',1));
 assert.ok(E.invest(s,{},'carters').ok);assert.deepEqual(s.seized,['quay']);
 const cash=s.treasury,hire=E.rehire(s,{});
 assert.ok(hire.ok);assert.equal(s.guards,E.MIN_GUARD+2);assert.equal(s.treasury,cash-400*K);
 s.guards=E.ROYAL_GUARD;assert.equal(E.rehire(s,{}).ok,false);
 /* a season like that is an F: the line is cut, the rate jumps, and the bank wants more back next time */
 const f=open();f.loan=f.limit;season(f,st=>{st.treasury=-600000;});
 assert.equal(f.seasons[0].grade,'F');assert.ok(f.seasons[0].red>=N-1);assert.equal(f.rate,rate(E.LOAN_RATE+.001));
 assert.equal(f.season.target,Math.round(f.loan*(1-E.DUE_SHARE*1.5)));
});

test('the Bank tab has everything it shows, and the season survives a save',()=>{
 const s=open();E.borrow(s,{},500000);for(let i=0;i<5;i++)E.tick(s,{},quiet);
 const v=E.bankView(s,{});
 assert.equal(v.chartered,true);assert.equal(v.loan,5500000);assert.equal(v.limit,6500000);assert.equal(v.room,1000000);assert.equal(v.interest,Math.round(5500000*s.rate));
 assert.equal(v.length,N);assert.equal(v.season.n,1);assert.equal(v.season.closes,5);assert.equal(v.season.left,N-5);assert.equal(v.season.toRepay,1000000);
 assert.equal(v.season.series.length,5);assert.ok(v.season.series.every(p=>Number.isInteger(p.t)&&p.d===5500000&&Number.isInteger(p.n)));
 assert.equal(v.surplus,0);assert.equal(v.frozen,false);assert.equal(v.bailiffs,false);assert.deepEqual(v.seasons,[]);
 assert.deepEqual(Object.keys(v.grades),['A','B','C','D','F']);
 const back=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(back.season,s.season);assert.equal(back.limit,s.limit);assert.equal(back.rate,s.rate);assert.equal(back.chartered,true);
 season(s);const again=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.equal(again.seasons.length,1);assert.equal(again.seasons[0].grade,s.seasons[0].grade);assert.equal(again.seasons[0].series.length,N);assert.equal(again.reviewSeen,false);
 /* a damaged season is rebuilt, never trusted */
 const bad=E.normalize({v:E.VERSION,chartered:true,loan:3000000,limit:'x',rate:-1,guards:99,seized:['quay','quay','ghost'],season:{n:'x',series:[{t:'5',d:-3},null]},seasons:[{grade:'Z'},{grade:'B',n:1,series:'no'}]});
 assert.equal(bad.limit,0);assert.equal(bad.rate,E.MIN_RATE);assert.equal(bad.guards,E.ROYAL_GUARD);assert.deepEqual(bad.seized,['quay']);
 assert.equal(bad.season.n,1);assert.deepEqual(bad.season.series,[{t:5,d:0,n:0},{t:0,d:0,n:0}]);assert.equal(bad.season.closes,2);
 assert.equal(bad.seasons.length,1);assert.deepEqual(bad.seasons[0].series,[]);
 E.tick(bad,{},Math.random);
});

test('the Hand carries the season forward to its last close: a guess with a band that widens, never a promise',()=>{
 assert.equal(E.projection(E.create(),{}),null,'nothing to project before the books open');
 const s=open(),p=E.projection(s,{});
 assert.equal(p.pts.length,N);assert.equal(p.pts[0].i,1);assert.equal(p.end.i,N);assert.equal(p.target,4500000);
 assert.ok(p.net<0&&p.end.t<s.treasury,'a city that loses gold at every close is heading down');
 assert.ok(p.pts.every((x,i,a)=>x.lo<x.t&&x.t<x.hi&&(!i||x.hi-x.lo>a[i-1].hi-a[i-1].lo)),'the band widens the further out it looks');
 assert.equal(p.end.d,5000000);assert.equal(p.short,500000);assert.equal(p.canPay,true);
 const before=JSON.stringify(s);E.projection(s,{});assert.equal(JSON.stringify(s),before,'looking ahead changes nothing');
 /* it is a guess, but not a wild one: a quiet season lands inside the band */
 for(let i=0;i<N-1;i++){E.attend(s);E.tick(s,{},quiet);}
 assert.ok(s.treasury>p.pts[N-2].lo&&s.treasury<p.pts[N-2].hi,s.treasury+' outside '+p.pts[N-2].lo+'..'+p.pts[N-2].hi);
 assert.equal(E.projection(s,{}).pts.length,1);
 /* a treasury that will run dry is covered from the line in the guess too, at the bank's fee */
 const poor=open();poor.treasury=30000;const g=E.projection(poor,{});
 assert.ok(g.end.d>5000000&&g.end.t>=0&&g.short>500000&&!g.canPay);
});
