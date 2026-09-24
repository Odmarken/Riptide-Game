/* The whole city game played with random decisions, from a commoner on the square to the great ports: a patent, contracts,
 * a dukedom, the office, the founding loan, budgets, works, the bank, the King, the gaol, envoys and bargaining - several
 * hundred closes a seed. It asserts nothing about balance. It looks for what would break a playthrough or a save:
 * an exception, a number that is not finite, "undefined"/"NaN" in anything the player can read, a value out of range,
 * and a city that does not come back from a save exactly as it went in. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const seeded=seed=>{let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};};
const ctx={live:true,mining:120,ench:80,smith:6,miningTrained:true,enchTrained:true,smelter:true,farmOwned:true,farmLvl:3};
const problems=new Map(),note=(k,d)=>{if(!problems.has(k))problems.set(k,d);};
function scan(v,path,seed){
 if(typeof v==='number'){if(!Number.isFinite(v))note('non-finite number at '+path,'seed '+seed);}
 else if(typeof v==='string'){if(/undefined|NaN|\[object/.test(v))note('bad text at '+path.replace(/\d+/g,'#'),'seed '+seed+': '+v.slice(0,160));}
 else if(Array.isArray(v))v.forEach((x,i)=>scan(x,path+'['+i+']',seed));
 else if(v&&typeof v==='object'&&!(v instanceof Set))for(const k of Object.keys(v))if(typeof v[k]!=='function')scan(v[k],path+'.'+k,seed);
}
function views(s,seed){
 const all={forecast:E.forecast(s,ctx),council:E.councilView(s,ctx),works:E.worksView(s,ctx),crown:E.crownView(s,ctx),gaol:E.gaolView(s,ctx),bank:E.bankView(s,ctx),charter:E.charterView(s,ctx),food:E.foodView(s,ctx),
  noble:E.nobleView(s),allies:E.alliesView(s),counselView:E.counselView(s),projection:E.projection(s,ctx),talks:E.ALLIES.map(a=>E.talkView(s,ctx,a.id))};
 if(s.chartered)all.topics=E.counselTopics(s,ctx,all.forecast);
 scan(all,'view',seed);return all;
}
function roundTrip(s,seed,when){
 const back=E.normalize(JSON.parse(JSON.stringify(s)));
 try{assert.deepEqual(back,JSON.parse(JSON.stringify(s)));}catch(e){note('save/load changes the city ('+when+')','seed '+seed+': '+String(e.message).split('\n').slice(0,14).join(' | ').slice(0,900));}
}
const stats=[];
test('eight random playthroughs from the square to the great ports break neither the game nor the save',()=>{
for(let seed=1;seed<=8;seed++){
 const rng=seeded(seed*7919),pick=a=>a[Math.floor(rng()*a.length)],s=E.create();
 let gold=0,closes=0,duke=null,spent=0,windfall=false;
 try{
  /* ---------- the road to the office, with the books shut ---------- */
  E.ennoble(s,1e9);spent+=E.PATENT_COST;
  while(s.office<1&&closes<3000){
   for(const o of s.noble.offers)if(!o.taken&&s.noble.rank>=1&&rng()<.85){const r=E.fundContract(s,o.id,1e9);if(r.ok)spent+=r.cost;}
   const r=E.tick(s,ctx,rng);closes++;scan(r,'idleTick',seed);
   if(closes%37===0){views(s,seed);roundTrip(s,seed,'before the office');}
  }
  if(s.office<1)note('never became a Duke','seed '+seed+' after '+closes+' closes, rank '+s.noble.rank+' xp '+s.noble.xp);
  duke=closes;
  assert.equal(E.meetHand(s),true);assert.equal(E.acceptOffice(s).ok,true);assert.ok(E.charter(s).ok);
  roundTrip(s,seed,'just chartered');
  /* ---------- running the city ---------- */
  for(let i=0;i<620;i++){
   if(i>=300&&!s.crowned&&!s.bankRule){s.trust=100;for(const k of Object.keys(s.council))s.council[k]=Math.max(s.council[k],E.COUP_FAVOUR);}   /* 👑 a realm that adores you until you hold the crown (again, if the bank's seasons took it), so the crown - which the ports now need - is within reach in every run */
   if(!s.chartered&&s.office===1){assert.equal(E.meetHand(s),true);assert.equal(E.acceptOffice(s).ok,true);assert.ok(E.charter(s).ok);roundTrip(s,seed,'chartered again after the bank');}   /* 🏦 handed back: the Duke answers the Hand's summons */
   const v=views(s,seed);
   if(rng()<.7)E.attend(s);
   if(rng()<.25){const k=pick(E.LINE_KEYS.concat(E.RATE_KEYS));E.setBudget(s,k,Math.floor(rng()*4));}
   if(rng()<.08)E.setBudget(s,'tax',pick(E.TAX_RATES));
   if(rng()<.3&&v.food.low)E.buyFood(s,ctx,pick([100,200,400,1e9]));
   if(rng()<.05)E.setAutoFood(s,rng()<.7);
   if(rng()<.2){const w=pick(v.works.list);scan(E.invest(s,ctx,w.id),'invest',seed);}
   if(rng()<.1)E.borrow(s,ctx,pick([1e5,5e5,1e6,1e12]));
   if(rng()<.15)E.repay(s,pick([1e5,5e5,1e12]));
   if(s.petition&&rng()<.7)scan(E.answer(s,ctx,rng()<.6),'answer',seed);
   if(s.king.demand&&rng()<.7)scan(E.answerKing(s,ctx,rng()<.5),'answerKing',seed);
   for(const inc of v.forecast.incidents)if(rng()<.2)E.settle(s,ctx,inc.id);
   for(const p of v.gaol.prisoners)if(rng()<.05)scan(rng()<.5?E.pardon(s,p.name):E.fine(s,ctx,p.name),'gaol',seed);
   if(rng()<.1){const n=E.withdraw(s,pick([1e4,1e5,1e12]),5e5-gold,ctx);gold+=n;}
   if(rng()<.1){const n=E.deposit(s,pick([1e4,1e5]),gold,ctx);gold-=n;}
   if(rng()<.3)scan(E.counsel(s,ctx,rng),'counsel',seed);
   if(v.crown.canClaim&&rng()<.3)scan(E.claimCrown(s,pick(['gaol','exile'])),'coup',seed);
   if(rng()<.1)E.rehire(s,ctx);
   for(const o of s.noble.offers)if(!o.taken&&rng()<.3&&gold>=o.cost){const r=E.fundContract(s,o.id,gold);if(r.ok)gold-=r.cost;scan(r,'fund',seed);}
   /* allies: court them, then bargain */
   if(i>200&&rng()<.25){const a=pick(E.ALLIES);if(i>400||a.kind==='city')scan(E.allyInvest(s,a.id,pick([250000,1e6,5e6,1e12])),'allyInvest',seed);}
   if(i>=450&&!windfall&&s.chartered&&!s.bankRule){s.treasury+=6e8;windfall=true;}   /* a windfall, so the end game is reached in every run - never into the bank's hands */
   for(const t of v.talks)if(t.canOffer&&rng()<.35){
    E.openTalks(s,t.id,rng);
    const tv=E.talkView(s,ctx,t.id),r=tv.counter&&rng()<.4?E.acceptCounter(s,ctx,t.id):E.makeOffer(s,ctx,t.id,Math.round(tv.ask*(.35+rng()*.8)),rng);
    scan(r,'talk.'+t.id,seed);
   }
   const r=E.tick(s,ctx,rng);closes++;scan(r,'tick',seed);gold+=r.purse+r.salary;
   if(!Number.isFinite(gold))note('hero gold went non-finite','seed '+seed);
   if(i%29===0)roundTrip(s,seed,'close '+i);
   assert.ok(s.pop>=E.MIN_POP&&s.pop<=E.POP_MAX,'pop '+s.pop);assert.ok(s.mood>=0&&s.mood<=100);assert.ok(s.trust>=0&&s.trust<=100);
   for(const a of Object.values(s.allies))assert.ok(a.stake>=0&&a.stake<=100&&a.held>=0,'stake '+JSON.stringify(a));
  }
  views(s,seed);roundTrip(s,seed,'the end');
 }catch(e){note('EXCEPTION: '+String(e.message).split('\n')[0].slice(0,200),'seed '+seed+' close '+closes+'\n'+String(e.stack).split('\n').slice(1,5).join('\n'));}
 stats.push({seed,duke,spent,dismissed:s.dismissed,owned:Object.values(s.allies).filter(a=>a.owned).length,crowned:s.crowned,pop:s.pop,treasury:s.treasury,loan:s.loan,grades:s.seasons.map(x=>x.grade).join('')});
}
assert.deepEqual([...problems].map(([k,d])=>k+' :: '+d),[]);
assert.ok(stats.every(x=>x.duke&&x.duke<400),'every run reaches Duke: '+stats.map(x=>x.duke).join(','));
assert.ok(stats.some(x=>x.dismissed>0),'and some random steward runs the city into the red long enough for the bank to take the books, and gets the city back: '+stats.map(x=>x.dismissed).join(''));
assert.ok(stats.some(x=>x.owned>=3)&&stats.some(x=>x.crowned),'and the end game is actually reached: owned '+stats.map(x=>x.owned).join('')+' crowned '+stats.filter(x=>x.crowned).length);
});
