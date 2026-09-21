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
 assert.equal(E.ennoble(E.create(),1e9).ok,false,'not before the books are open');
 const s=open();
 assert.equal(E.ennoble(s,E.PATENT_COST-1).ok,false);
 const r=E.ennoble(s,E.PATENT_COST);assert.equal(r.ok,true);assert.equal(r.cost,100000);
 assert.equal(E.ennoble(s,1e9).ok,false,'one petition at a time');
 assert.equal(E.nobleView(s).pending[0].seconds,15*60);
 closes(s,2);assert.equal(s.noble.rank,0);assert.equal(E.nobleView(s).pending[0].seconds,5*60);
 const last=closes(s,1);assert.equal(s.noble.rank,1);assert.equal(last.rankUp,1);assert.ok(last.unrest.some(u=>/patent of nobility is sealed/.test(u)));
 assert.equal(E.ennoble(s,1e9).ok,false,'and only once');
 const v=E.nobleView(s);assert.equal(v.def.title,'Sir');assert.equal(v.def.titleF,'Dame');assert.equal(v.next.id,'baron');
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
 for(const [xp,rank,title] of [[249,1,'Sir'],[250,2,'Baron'],[700,3,'Viscount'],[1600,4,'Count'],[3500,5,'Marquess'],[7500,6,'Duke']]){
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
 assert.deepEqual(E.normalize({v:E.VERSION,chartered:true}).noble,{rank:0,xp:0,given:0,done:0,pending:[],offers:[],offerLeft:0});
 assert.deepEqual(E.normalize({v:E.VERSION,chartered:true,noble:{rank:99,xp:-4,pending:[{kind:'loan',amount:5},{kind:'contract',id:'ghost',amount:5}],offers:[{id:'ghost',cost:9}]}}).noble,{rank:6,xp:0,given:0,done:0,pending:[],offers:[],offerLeft:0});
});
