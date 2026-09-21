/* Nobility at the notice board, headless: a patent bought with the hero's own gold, contracts that
 * rotate on the board every hour of play - more of them with rank - papers that take a quarter of an
 * hour to clear, XP that becomes rank, and not a coin of it ever coming back. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};
const quiet=()=>.95;
const closes=(s,n,rng=quiet)=>{let last;for(let i=0;i<n;i++){E.attend(s);last=E.tick(s,{},rng);}return last;};
const seeded=seed=>{let x=seed;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};};

test('a quarter of an hour and a hundred thousand of your own gold make a knight; nothing is sealed sooner',()=>{
 assert.equal(E.NOBLE_CLOSES*E.TICK_SECONDS,15*60);assert.equal(E.OFFER_CLOSES*E.TICK_SECONDS,60*60);
 const street=E.create();assert.equal(E.ennoble(street,1e9).ok,true,'a patent is the heralds’ business: the books need not be open');
 for(let i=0;i<3;i++)E.tick(street,{},quiet);assert.equal(street.noble.rank,1);assert.equal(street.treasury,0,'and with the books shut the fee reaches no treasury');
 const s=open();
 assert.equal(E.ennoble(s,E.PATENT_COST-1).ok,false);
 const r=E.ennoble(s,E.PATENT_COST);assert.equal(r.ok,true);assert.equal(r.cost,100000);
 assert.equal(E.ennoble(s,1e9).ok,false,'one petition at a time');
 assert.equal(E.nobleView(s).pending[0].seconds,15*60);
 closes(s,2);assert.equal(s.noble.rank,0);assert.equal(E.nobleView(s).pending[0].seconds,5*60);
 const last=closes(s,1);assert.equal(s.noble.rank,1);assert.equal(last.rankUp,1);assert.ok(last.unrest.some(u=>/patent of nobility is sealed/.test(u)));
 assert.equal(E.ennoble(s,1e9).ok,false,'and only once');
 const v=E.nobleView(s);assert.equal(v.def.title,'Knight');assert.equal(v.next.id,'baron');
});

test('the board is re-posted every hour of play with one to three contracts, never the same set twice running',()=>{
 const s=open(),rng=seeded(7),counts=new Set();let was=[];
 for(let hour=0;hour<40;hour++){
  closes(s,hour?E.OFFER_CLOSES:1,rng);
  const ids=s.noble.offers.map(o=>o.id);
  assert.ok(ids.length>=1&&ids.length<=3,'a commoner sees 1-3: '+ids.length);assert.ok(!ids.some(id=>was.includes(id)),'fresh contracts every posting');
  assert.equal(new Set(ids).size,ids.length);counts.add(ids.length);was=ids;
  for(const o of s.noble.offers){const c=E.CONTRACTS.find(x=>x.id===o.id);assert.ok(c.rank<=1&&o.cost>=c.lo&&o.cost<=c.hi&&o.cost%5000===0&&o.xp>0);}
 }
 assert.deepEqual([...counts].sort(),[1,2,3],'sometimes one, sometimes two, sometimes three');
 assert.equal(E.nobleView(s).repost,60*60);
});

test('a contract takes the whole sum now, clears in a quarter of an hour, does the city good - and nothing comes back',()=>{
 const s=open();closes(s,1,seeded(3));
 const o=s.noble.offers[0];
 assert.equal(E.fundContract(s,o.id,1e9).ok,false,'let to the nobility only');
 E.ennoble(s,1e9);closes(s,3);
 const offer=s.noble.offers[0],def=E.CONTRACTS.find(c=>c.id===offer.id);
 assert.equal(E.fundContract(s,offer.id,offer.cost-1).ok,false);
 const r=E.fundContract(s,offer.id,offer.cost);assert.equal(r.ok,true);assert.equal(r.cost,offer.cost);
 assert.equal(E.fundContract(s,offer.id,1e9).ok,false,'a contract is taken once');assert.equal(E.nobleView(s).offers[0].taken,true);
 closes(s,2);assert.equal(s.noble.xp,0);
 const before=s.treasury,last=closes(s,1);
 assert.equal(s.noble.xp,offer.xp);assert.equal(s.noble.done,1);assert.equal(s.noble.given,offer.cost);assert.equal(last.nobleXp,offer.xp);
 assert.equal(s.treasury-before-last.net,Math.round(offer.cost*(def.fx.crown||0)),'the crown keeps its share and no more');
 for(const c of E.CONTRACTS)assert.ok(!('dividend' in c.fx)&&!('refund' in c.fx)&&(c.fx.crown||0)<=.5,'nothing pays the noble back: '+c.id);
 assert.ok(!('dividend' in last)&&last.purse===0);
});

test('XP is rank, and rank brings more contracts, dearer ones, a better name and a little of the city’s regard',()=>{
 const s=open();E.ennoble(s,1e9);closes(s,3);
 const base=E.forecast(s,{});
 for(const [xp,rank,title] of [[149,1,'Knight'],[150,2,'Baron'],[400,3,'Viscount'],[800,4,'Count'],[1400,5,'Marquess'],[2200,6,'Duke']]){
  s.noble.xp=xp;closes(s,1);assert.equal(s.noble.rank,rank,xp+' XP');assert.equal(E.nobleView(s).def.title,title);
 }
 const f=E.forecast(s,{});
 assert.equal(f.attractFactors.find(x=>/noble patron/.test(x.name)).value,6);assert.equal(f.trustFactors.find(x=>/Your title/.test(x.name)).value,.6);
 assert.equal(base.attractFactors.find(x=>/noble patron/.test(x.name)).value,1);
 assert.deepEqual(E.nobleView(s).offerRange,[3,6]);
 const rng=seeded(11);let most=0,dear=false;
 for(let i=0;i<30;i++){closes(s,E.OFFER_CLOSES,rng);most=Math.max(most,s.noble.offers.length);assert.ok(s.noble.offers.length>=3&&s.noble.offers.length<=6);dear=dear||s.noble.offers.some(o=>E.CONTRACTS.find(c=>c.id===o.id).rank>=4);}
 assert.ok(most>=5&&dear,'a duke is brought more contracts, and the great ones');
 assert.equal(E.nobleView(s).next,null);
});

test('the papers survive a save, and a save from before the peerage opens as a commoner',()=>{
 const s=open();closes(s,1,seeded(5));E.ennoble(s,1e9);closes(s,3);E.fundContract(s,s.noble.offers[0].id,1e9);
 assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))).noble,s.noble);
 assert.equal(E.normalize({v:E.VERSION,chartered:true}).office,3);assert.deepEqual(E.normalize({v:E.VERSION,chartered:true}).noble,{rank:0,xp:0,given:0,done:0,pending:[],offers:[],offerLeft:0,legacy:{mood:0,attract:0,skill:0,pleasure:0,food:0,seats:{}}});
 assert.deepEqual(E.normalize({v:E.VERSION,chartered:true,noble:{rank:99,xp:-4,pending:[{kind:'loan',amount:5},{kind:'contract',id:'ghost',amount:5}],offers:[{id:'ghost',cost:9}]}}).noble,{rank:6,xp:0,given:0,done:0,pending:[],offers:[],offerLeft:0,legacy:{mood:0,attract:0,skill:0,pleasure:0,food:0,seats:{}}});
});

test('the whole road: a commoner on the square becomes a duke with the books shut, is sent for, hears the Hand out and takes the office',()=>{
 const s=E.create(),rng=seeded(21);
 assert.equal(E.acceptOffice(s).ok,false,'the office is not offered to a stranger');assert.equal(E.meetHand(s),false);
 E.ennoble(s,1e9);let sent=null,closesRun=0;
 while(s.office<1&&closesRun<4000){
  for(const o of s.noble.offers)if(!o.taken&&s.noble.rank>=1)E.fundContract(s,o.id,1e9);
  const r=E.tick(s,{},rng);closesRun++;assert.equal(r.idle,true);if(r.summoned)sent=r;
 }
 assert.equal(s.noble.rank,6);assert.equal(s.office,1);assert.ok(sent&&sent.unrest.some(u=>/King’s Hand wishes to speak with you/.test(u)));
 assert.equal(s.chartered,false);assert.equal(s.treasury,0,'not a coin of it reached a treasury nobody keeps');assert.equal(s.history.length,0);
 assert.equal(E.nobleView(s).summons,true);
 assert.equal(E.meetHand(s),true);assert.equal(s.office,2);assert.equal(E.meetHand(s),false);
 const yes=E.acceptOffice(s);assert.equal(yes.ok,true);assert.equal(s.office,3);assert.equal(E.acceptOffice(s).ok,false);
 assert.ok(E.charter(s).ok);assert.equal(E.nobleView(s).summons,false);assert.equal(E.tick(s,{},rng).idle,undefined,'and now the ledger closes for real');
 /* the summons is sent once, and a duke who is already Master of Coin is never sent for */
 const t=open();t.noble.rank=1;t.noble.xp=5000;E.tick(t,{},quiet);assert.equal(t.noble.rank,6);assert.equal(t.office,3);
});

test('with the books shut the city stays neutral: a noble’s good works are remembered, and count from the day the office is taken',()=>{
 const s=E.create(),rng=seeded(9);E.ennoble(s,1e9);
 for(let i=0;i<400;i++){for(const o of s.noble.offers)if(!o.taken&&s.noble.rank>=1)E.fundContract(s,o.id,1e9);E.tick(s,{},rng);}
 assert.ok(s.noble.done>20);
 const fresh=E.create();
 for(const key of ['mood','attract','skill','pop','protest'])assert.equal(s[key],fresh[key],key+' has not moved');
 assert.deepEqual(s.council,fresh.council);assert.equal(s.king.pleasure,fresh.king.pleasure);assert.deepEqual(s.incidents,[]);assert.equal(s.food.stock,0);
 assert.ok(s.noble.legacy.food>0&&s.noble.legacy.food<=E.FOOD_CAP,'grain bought for the granary waits in a barn instead of vanishing: '+s.noble.legacy.food);
 assert.ok(s.trust>fresh.trust,'only what the realm makes of the noble moves');
 const L=JSON.parse(JSON.stringify(s.noble.legacy));
 assert.ok(L.mood>0&&L.mood<=15&&L.attract<=15&&L.skill<=10&&Object.values(L.seats).every(v=>v>0&&v<=20),'remembered, within limits: '+JSON.stringify(L));
 assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))).noble.legacy,L);
 E.acceptOffice(Object.assign(s,{office:1}));E.charter(s);
 assert.equal(s.food.stock,Math.min(E.FOOD_CAP,E.FOOD_START+L.food),'and the barn is emptied into the granary');
 assert.equal(s.mood,60+L.mood);assert.equal(s.attract,50+L.attract);assert.equal(s.skill,20+L.skill);assert.equal(s.council.bread,60+(L.seats.bread||0));
 assert.deepEqual(s.noble.legacy,{mood:0,attract:0,skill:0,pleasure:0,food:0,seats:{}},'paid out once');
});

test('the first posting goes up the moment somebody walks up to the board, and only the clock re-posts it after that',()=>{
 const s=E.create();assert.equal(E.nobleView(s).offers.length,0);
 assert.equal(E.postBoard(s,seeded(4)),true);const first=s.noble.offers.map(o=>o.id);
 assert.ok(first.length>=1&&first.length<=3);assert.equal(s.noble.offerLeft,E.OFFER_CLOSES);assert.equal(E.nobleView(s).repost,60*60);
 assert.equal(E.postBoard(s,seeded(5)),false,'walking up to it again re-rolls nothing');assert.deepEqual(s.noble.offers.map(o=>o.id),first);
 E.ennoble(s,1e9);closes(s,3);for(const o of s.noble.offers)E.fundContract(s,o.id,1e9);
 assert.equal(E.postBoard(s,seeded(6)),false,'nor does taking everything on it');
 closes(s,E.OFFER_CLOSES-3);assert.notDeepEqual(s.noble.offers.map(o=>o.id),first);
});
