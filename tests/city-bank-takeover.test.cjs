/* 🏦 When the red lasts (asked for 2026-09-24): twelve closes in the red in a row and the council hands the crown's books to the
 * Tides Bank. The steward is dismissed for two seasons and may touch nothing, while the bank squeezes the city until it burns,
 * starves and fills with refuse; then the city is handed back as it was the day the books first opened, the old King on his
 * throne, and the Hand sends for the Duke again - a new budget, a new loan. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('../assets/city/economy.js');
const W=require('../assets/city/city-works.js');
const quiet=()=>.95;                                   /* no events, no trouble, no petitions, no wishes */
const RULE=E.BANK_RULE_SEASONS*E.SEASON_CLOSES;
/* a Duke in the office, the loan signed */
const open=()=>{const s=E.create();s.noble.rank=6;s.noble.xp=2200;s.office=1;E.meetHand(s);E.acceptOffice(s);E.charter(s);return s;};
/* a close in the red with the line spent - deep enough that no city's takings can lift it out */
const red=s=>{s.loan=Math.max(s.loan,s.limit);s.treasury=-2e7;return E.tick(s,{},quiet);};

test('the council counts the closes in the red, says so from half way, and at twelve in a row hands the books to the bank',()=>{
 const s=open(),news=[];
 for(let i=1;i<E.BANK_TAKEOVER;i++){const r=red(s);news.push(r.unrest.join(' '));assert.equal(r.takeover,false);assert.equal(s.bankRule,null,'not yet at close '+i);}
 assert.match(news[0],/after 12 closes in the red the council hands the crown’s books to the bank/,'the first letter names the limit');
 assert.ok(!/council is counting/.test(news[E.BANK_TAKEOVER/2-2]),'no count before half way');
 assert.match(news[E.BANK_TAKEOVER-2],/council is counting: 1 more close in the red/);
 assert.equal(E.bankRuleView(s).toTakeover,1);
 const r=red(s);
 assert.equal(r.takeover,true);assert.deepEqual(s.bankRule,{left:RULE});assert.equal(s.dismissed,1);
 assert.ok(r.unrest.some(u=>/The council met without you and voted: the crown’s books go to the Tides Bank/.test(u)));
 /* a close in the black before the count runs out forgets it */
 const t=open();for(let i=1;i<E.BANK_TAKEOVER;i++)red(t);
 t.treasury=5e6;E.tick(t,{},quiet);assert.equal(t.arrears,0);
 for(let i=1;i<E.BANK_TAKEOVER;i++)red(t);assert.equal(t.bankRule,null,'the count starts again');
});

test('the bank squeezes the city: the tax and every rate at the top, every line of the budget to nothing, no grain bought',()=>{
 const s=open();s.food.auto=true;s.petition={id:'bridge',age:0};s.king.demand={id:'hunt',age:0};
 for(let i=0;i<E.BANK_TAKEOVER;i++)red(s);
 assert.equal(s.budget.tax,30);for(const k of E.RATE_KEYS)assert.equal(s.budget[k],3,k);for(const k of E.LINE_KEYS)assert.equal(s.budget[k],0,k);
 assert.equal(s.food.auto,false);assert.equal(s.petition,null);assert.equal(s.king.demand,null);
});

test('a dismissed steward may touch nothing: every order at the table refuses, and the crown cannot be taken',()=>{
 const s=open();s.works.carters={left:0};s.jail.push({name:'Olle Krok',skin:'male',female:false,crime:'x',say:'',term:4,served:0,life:false,byKing:false});
 s.incidents.push({id:'brawl',age:0});
 for(let i=0;i<E.BANK_TAKEOVER;i++)red(s);
 assert.ok(s.bankRule);
 s.treasury=9e7;s.trust=100;for(const k of Object.keys(s.council))s.council[k]=100;s.crowned=false;s.season.n=3;
 s.petition={id:'bridge',age:0};s.king.demand={id:'hunt',age:0};
 const was=JSON.stringify(s);
 assert.equal(E.setBudget(s,'tax',10),false);assert.equal(E.setBudget(s,'watch',3),false);
 for(const r of [E.invest(s,{},'lamps'),E.upgrade(s,{},'carters'),E.buyFood(s,{},100),E.allyInvest(s,'ravenholt',250000),E.rehire(s,{}),E.takeBonus(s),E.declineBonus(s),E.claimCrown(s,'gaol'),E.counsel(s,{},quiet),E.acceptCounter(s,{},'ravenholt')])
  assert.equal(r.ok,false);
 assert.equal(E.borrow(s,{},1e6),0);assert.equal(E.repay(s,1e6),0);assert.equal(E.settle(s,{},'brawl'),0);assert.equal(E.withdraw(s,1e5,1e9,{}),0);assert.equal(E.deposit(s,1e5,1e9,{}),0);
 assert.equal(E.answer(s,{},true),null);assert.equal(E.answerKing(s,{},true),null);assert.equal(E.pardon(s,'Olle Krok'),null);assert.equal(E.fine(s,{},'Olle Krok'),null);
 assert.equal(E.setAutoFood(s,true),false);assert.equal(E.canClaim(s),false);
 assert.equal(JSON.stringify(s),was,'and nothing was changed by trying');
 assert.equal(E.talkView(s,{},'ravenholt').canOffer,false);assert.match(E.talkView(s,{},'ravenholt').why,/Tides Bank keeps the crown’s books/);
});

test('under the bank the city burns, starves and empties - and nobody misses the steward at the table',()=>{
 const s=open();
 for(let i=0;i<E.BANK_TAKEOVER;i++)red(s);
 const pop=s.pop;let petitions=0,wishes=0,purse=0;
 for(let i=0;i<12;i++){s.petition=null;s.king.demand=null;const r=E.tick(s,{},()=>.01);   /* a draw that would bring every petition and every wish */
  petitions+=s.petition?1:0;wishes+=s.king.demand?1:0;purse+=r.purse+r.salary;}
 assert.equal(petitions,0,'no petitions for a steward who may not answer them');assert.equal(wishes,0,'no wishes either');assert.equal(purse,0,'and no pay');
 assert.equal(s.unattended,0,'a dismissed steward is not missed at the table');
 assert.ok(s.mood<E.PROTEST_START&&s.protest,'the people riot: '+s.mood);assert.ok(s.food.hunger>0,'no bread');assert.ok(s.pop<pop,'families leave');
 /* what the street shows: fires, barricades, beggars, a bread queue */
 const street=W.streetLife({mood:s.mood,festival:s.budget.festival,relief:s.budget.relief,protest:s.protest,hungry:s.food.hunger>0?2:0});
 assert.ok(street.barricades&&street.beggars>=5&&street.breadline===2);
 assert.ok(W.fireLevel({protest:s.protest,mood:s.mood,watch:s.budget.watch})>=3,'houses burn');
 assert.ok(s.budget.clean===0,'and the refuse lies where it falls');
});

test('two seasons on, the city is handed back as it was the day the books first opened, and the Hand sends for the Duke again',()=>{
 const s=open();
 s.works={carters:{left:0},quay:{left:0,lvl:2}};s.allies.ravenholt={stake:100,held:30,owned:true,put:0,pending:[],paid:1};
 s.crowned=true;s.deposed='gaol';s.jail=[{name:'Alarik Tidvind',skin:'king',female:false,crime:'was King',say:'',term:1,served:0,life:true,byKing:false}];
 s.pop=2400;s.trust=100;
 for(let i=0;i<E.BANK_TAKEOVER;i++)red(s);
 const ticks=s.ticks,standing=N=>({rank:N.rank,xp:N.xp,given:N.given,done:N.done}),noble=standing(s.noble);
 let r,left=[];
 for(let i=0;i<RULE;i++){r=E.tick(s,{},quiet);if(!r.restored)left.push(s.bankRule.left);
  if(i<RULE-1){assert.equal(r.restored,false);assert.ok(s.bankRule);}}
 assert.deepEqual(left.slice(0,3),[RULE-1,RULE-2,RULE-3]);
 assert.equal(r.restored,true);assert.equal(r.summoned,true);
 assert.ok(r.unrest.some(u=>/hands the city back as it was the day you first took the books/.test(u)));
 assert.ok(r.unrest.some(u=>/the King’s Hand wishes to speak with you/.test(u)));
 /* everything is as a fresh city has it... */
 const fresh=E.create();
 for(const k of Object.keys(fresh))if(!['noble','ticks','clock','dismissed','office'].includes(k))assert.deepEqual(s[k],fresh[k],k);
 assert.equal(s.crowned,false);assert.equal(s.deposed,null);assert.deepEqual(s.works,{});assert.deepEqual(s.allies,{});assert.deepEqual(s.jail,[]);
 /* ...but the hero keeps what is the hero's, the clock runs on, and the fall is remembered */
 assert.deepEqual(standing(s.noble),noble,'the peerage is the hero’s - the board keeps its own clock meanwhile');assert.equal(s.ticks,ticks+RULE);assert.equal(s.dismissed,1);assert.equal(s.office,1);
 /* and the same scenario begins again: the Hand, the office, a new budget and a new loan */
 assert.equal(E.tick(s,{},quiet).idle,true,'the books are shut until they are signed again');
 assert.equal(E.meetHand(s),true);assert.equal(E.acceptOffice(s).ok,true);assert.ok(E.charter(s).ok);
 assert.equal(s.treasury,E.FOUNDING_LOAN);assert.equal(s.loan,E.FOUNDING_LOAN);assert.equal(s.season.n,1);assert.equal(s.bankRule,null);
 assert.ok(E.setBudget(s,'tax',15),'and every order answers again');
});

test('what a noble gives at the board while the bank has the city is remembered for the next Master of Coin',()=>{
 const s=open();
 for(let i=0;i<E.BANK_TAKEOVER;i++)red(s);
 s.noble.offers=[{id:'feast',cost:50000,xp:55,taken:false}];
 assert.ok(E.fundContract(s,'feast',1e9).ok);
 const mood=s.mood;
 for(let i=0;i<E.NOBLE_CLOSES;i++)E.tick(s,{},quiet);
 assert.equal(s.noble.legacy.mood,4,'the feast is remembered');assert.ok(s.mood<=mood,'and not spent on the bank’s city');
 while(s.bankRule)E.tick(s,{},quiet);
 assert.equal(s.noble.legacy.mood,4,'through the hand-back');
 E.meetHand(s);E.acceptOffice(s);E.charter(s);
 assert.equal(s.mood,64,'paid out on the day the books open again');assert.equal(s.noble.legacy.mood,0);
});

test('the bank’s hold survives a save exactly, and an older save knows nothing of it',()=>{
 const s=open();
 for(let i=0;i<E.BANK_TAKEOVER+5;i++)red(s);
 assert.ok(s.bankRule);
 assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(s))),JSON.parse(JSON.stringify(s)));
 const old=JSON.parse(JSON.stringify(s));delete old.bankRule;delete old.dismissed;
 const o=E.normalize(old);assert.equal(o.bankRule,null);assert.equal(o.dismissed,0);
 const bad=JSON.parse(JSON.stringify(s));bad.bankRule={left:'soon'};bad.dismissed=-3;
 const b=E.normalize(bad);assert.deepEqual(b.bankRule,{left:RULE});assert.equal(b.dismissed,0);
 const shut=E.create();shut.bankRule={left:5};assert.equal(E.normalize(shut).bankRule,null,'books that are shut are nobody’s');
 const v=E.bankRuleView(s);assert.equal(v.on,true);assert.equal(v.closes,RULE);assert.equal(v.seasons,E.BANK_RULE_SEASONS);assert.ok(v.left<RULE&&v.wait>0);assert.equal(v.toTakeover,null);
});

test('game.js shows it: the takeover and the hand-back announced, the bank’s page at the table, the old King back on his throne',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
 const close=src.slice(src.indexOf('function cityLedgerClose(){'),src.indexOf('\nfunction cityStreetNews('));
 assert.match(close,/if\(r\.restored\)\{/);assert.match(close,/if\(r\.takeover\)\{stageMsg\(/);
 assert.ok(close.indexOf('if(r.restored){')<close.indexOf('if(r.summoned){'),'the hand-back is told before the summons it brings');
 const html=src.slice(src.indexOf('function ledgerHTML(){'),src.indexOf('\nlet ledgerRenderedView'));
 assert.ok(html.indexOf('if(c.bankRule)return ledgerBankRule(c);')>0&&html.indexOf('if(c.bankRule)return ledgerBankRule(c);')<html.indexOf('ledgerPeek&&!c.chartered'),'the bank’s page, from the table and from the road');
 const action=src.slice(src.indexOf('function ledgerAction(act,k,v){'),src.indexOf('\nfunction cityIsNewer('));
 assert.match(action,/if\(c\.bankRule&&act!=='goto'&&act!=='back'\)\{/);
 const hall=src.slice(src.indexOf('function hallApply(){'),src.indexOf('\nfunction hallStair('));
 assert.match(hall,/if\(!c\.crowned&&!world\.npcs\.some\(n=>n\.game==='king'\)\)/);
 assert.match(src.slice(src.indexOf('function cityHudLine(){'),src.indexOf('\nconst cityCommoner=')),/The Tides Bank keeps the crown’s books - you are dismissed/);
 assert.match(src.slice(src.indexOf('function cityCrierLines(){'),src.indexOf('\nconst BEGGAR_LINES=')),/By order of the Tides Bank/);
 assert.match(src.slice(src.indexOf('function kingSpeak(){'),src.indexOf('\nfunction kingSpeak(){')+4000),/if\(c\.bankRule\)\{/);
 assert.match(src.slice(src.indexOf('function ledgerOffer(c){'),src.indexOf('\nfunction ledgerCharter(')),/if\(c\.dismissed>0\)/,'the Hand has other words for a Duke the bank sent back');
 assert.match(src,/closes in the red in a row<\/b> - an hour of play - and the council hands the crown’s books to the Tides Bank/,'the help says so');
});
