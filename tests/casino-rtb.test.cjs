/* Ride the Bus after the 2026-09-30 casino review (test-rtb.json, design O1). The old 2x/3x/4x/20x ladder handed a player who
 * chose well 131% of every fare; now every guess pays its odds. The return is computed exactly from game.js's own rules, prices
 * and max win; the table itself runs for real in a vm with a fake DOM; the markup and the styles are pinned by their source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const cut=(src,from,to)=>{const a=src.indexOf(from),b=src.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return src.slice(a,b);};
const RTB=cut(game,'const RTB_BETS=','/* ==================== 🎲 GAMBLE AGAINST FRIEND');
const between=(from,to)=>cut(RTB,from,to);
const near=(got,want,what)=>assert.ok(Math.abs(got-want)<1e-9,`${what}: ${got} (want ${want})`);
const gold=n=>n.toLocaleString()+'◉';

/* the table in a vm: a fake DOM, a hero with a purse, and what it calls outside itself stubbed */
function element(id){
 const cls=new Set();let inner=null;
 return {id,disabled:false,innerHTML:'',textContent:'',style:{},listeners:{},
  classList:{add:(...n)=>n.forEach(x=>cls.add(x)),remove:(...n)=>n.forEach(x=>cls.delete(x)),contains:n=>cls.has(n)},
  addEventListener(t,fn){this.listeners[t]=fn;},querySelector(){return inner||(inner=element(''));}};
}
function table(src=RTB){
 const els=new Map(),timers=new Map();let tid=0;
 const c={S:{gold:1e7},saves:0,msgs:[],logs:[],pays:[],
  $:id=>{if(!els.has(id))els.set(id,element(id));return els.get(id);},
  spendGold:n=>{if(c.S.gold<n)return false;c.S.gold-=n;return true;},
  addGoldOverflow:n=>{c.S.gold+=n;c.pays.push(n);return {got:n,over:0};},
  save:()=>{c.saves++;},renderHUD(){},casinoAmbApply(){},stageMsg:m=>{c.msgs.push(m);},log:m=>{c.logs.push(m);},
  sfx:{buy(){},warn(){}},noiseSweep(){},blip(){},dingDingDing(){},spawnPartsIn(){},
  setTimeout:fn=>{timers.set(++tid,fn);return tid;},clearTimeout:id=>{timers.delete(id);}};
 c.timers=timers;
 vm.createContext(c);
 c.run=code=>vm.runInContext(code,c);
 c.run(src+`;globalThis.T={
  st:()=>({live:rtbLive,stage:rtbStage,cards:rtbCards.map(x=>x.r+x.s).join(' '),won:rtbWon.join(','),deck:rtbDeck.length}),
  force:(...want)=>{for(const w of want.slice().reverse()){const i=rtbDeck.findIndex(x=>x.r+x.s===w);rtbDeck.push(rtbDeck.splice(i,1)[0]);}},
  bet:i=>{rtbBetI=i;rtbRender();}};`);
 c.st=()=>({...c.T.st()}); /* a copy made out here: deepEqual tells the vm's objects apart */
 c.click=(target,detail=1)=>c.$('rtbActs').listeners.click({target,detail});
 c.board=(detail=1)=>c.click({closest:s=>s==='#rtbStart'?{}:null},detail);
 c.press=(g,detail=1)=>c.click({closest:s=>s==='[data-rg]'?{dataset:{rg:g}}:null},detail);
 c.btns=()=>[...c.$('rtbActs').innerHTML.matchAll(/data-rg="([^"]+)"( disabled)?>(.*?)<\/button>/g)].map(m=>(m[2]?'dead ':'')+m[3].replace(/<[^>]+>/g,''));
 c.rungs=()=>[...c.$('rtbLadder').innerHTML.matchAll(/class="rtbstep ?([^"]*)">([^<]*)</g)].map(m=>(m[1]?m[1]+': ':'')+m[2]);
 c.res=()=>c.$('rtbRes').innerHTML.replace(/<[^>]+>/g,'');
 c.open=()=>c.$('rtbFx').classList.contains('open');
 return c;
}

/* The exact return of each way of playing, by backward induction over the cards themselves (as the audit counted them) with
 * game.js's own rtbWins, rtbPrice and RTB_CAP: every card path is walked and every winner counted. After the colour round a
 * state is worth the same whatever its suits are called, and its locked product is fixed by its cards (each card on a live table
 * won exactly one button of its round), so each suit-canonical table is valued once - checked below, then relied on. */
const POLICIES=['optimal','typical','likely','random','longshot'];
function exactReturns(c){
 const R=c.run('({G:RTB_GUESSES,cap:RTB_CAP,wins:rtbWins,price:rtbPrice,deck:(rtbShuffle(),rtbDeck.slice())})');
 const deck=R.deck,tbl=[],memo=new Map();
 const canon=()=>{const m={};let n=0;return tbl.map(x=>x.r+(m[x.s]||(m[x.s]='abcd'[n++]))).join(',');};
 function V(stage,P,j){ /* per unit of stake, from a state with P/100^j locked: [optimal, typical, likely, random, longshot] */
  const key=stage>0?canon():'';
  if(memo.has(key))return memo.get(key);
  const D=100**j,n=deck.length,cash=P/D,opts=[];
  for(const g of R.G[stage]){
   const p=R.price(stage,g,tbl,deck);if(!p)continue;             /* a dead button is never pressed */
   const o={k:0,v:[0,0,0,0,0]};
   for(let i=0;i<n;i++){const x=deck[i];if(!R.wins(stage,g,x,tbl))continue;o.k++;
    const P2=P*p,D2=D*100;let w;
    if(P2>=R.cap*D2)w=Array(5).fill(R.cap);                        /* the max win cashes itself out */
    else if(stage===3)w=Array(5).fill(P2/D2);                      /* rode the whole bus */
    else{deck[i]=deck[n-1];deck.pop();tbl.push(x);w=V(stage+1,P2,j+1);tbl.pop();deck.push(deck[i]);deck[i]=x;}
    for(let q=0;q<5;q++)o.v[q]+=w[q]/n;}
   opts.push(o);
  }
  let best=stage>0?cash:-1,rnd=0,likely=opts[0],long=opts[0];
  for(const o of opts){best=Math.max(best,o.v[0]);rnd+=o.v[3];if(o.k>likely.k)likely=o;if(o.k<long.k)long=o;}
  const r=[best,stage===2?cash:likely.v[1],likely.v[2],rnd/opts.length,long.v[4]];
  if(stage>0)memo.set(key,r);
  return r;
 }
 /* the memo's premise: renaming the suits renames the suit buttons and changes no price, from round 2 on */
 const byName=new Map(deck.map(x=>[x.r+x.s,x])),SU=['♠','♥','♦','♣'];
 let seed=7;const rnd=k=>{seed=(seed*16807)%2147483647;return seed%k;};
 for(let t=0;t<300;t++){
  const perm=SU.slice().sort(()=>rnd(3)-1),ren=x=>byName.get(x.r+perm[SU.indexOf(x.s)]);
  const shuffled=deck.slice().sort(()=>rnd(3)-1),stage=1+rnd(3),on=shuffled.slice(0,stage),rest=shuffled.slice(stage);
  for(const g of R.G[stage]){const g2=stage===3?'s'+perm[SU.indexOf(g.slice(1))]:g;
   assert.equal(R.price(stage,g2,on.map(ren),rest.map(ren)),R.price(stage,g,on,rest),'suit-blind prices');}
 }
 const r=V(0,1,0);
 return Object.fromEntries(POLICIES.map((p,i)=>[p,r[i]]));
}

test('every guess pays its odds: exactly 96% back played well and less played any other way, from game.js\'s own rules',()=>{
 const t0=Date.now(),r=exactReturns(table());
 assert.ok(r.optimal>=0.95&&r.optimal<=0.97,'the best possible play gets 95-97%: '+r.optimal);
 near(r.optimal,0.96,'the best play cashes out after the colour: 1.92 x 1/2 - no later guess is worth more than it risks');
 near(r.typical,0.9565828054,'the most likely guesses, cashing out after round 2');
 near(r.likely,0.9514406178,'riding to the end on the most likely guesses');
 near(r.random,0.9364852893,'random buttons to the end (95.387% without the 250x cap)');
 near(r.longshot,0.8779968667,'always the longest shot (95.581% without the cap - the max win takes its tail)');
 for(const p of POLICIES)assert.ok(r[p]<1,p+' play gives the house its edge: '+r[p]);
 assert.ok(Date.now()-t0<5000,'fast enough to run with the suite');
});

test('the buttons wear their prices, a button no card can win is dead, and a guess from another round is no guess',()=>{
 const c=table();c.run('openRTB()');c.board();
 assert.deepEqual(c.btns(),['Red 1.92x','Black 1.92x']);
 c.T.force('A♦','K♠','5♥');
 c.press('hi');c.press('in');c.press('s♦');                 /* round-1 buttons only: none of these is a colour */
 assert.equal(c.st().deck,52,'no card was drawn');
 c.press('red');
 assert.equal(c.res(),'✅ A♦ - 1.92x locked. Round 2 - higher or lower than A♦? Aces low, a tie loses.');
 assert.deepEqual(c.btns(),['⬆ Higher 1.06x','dead ⬇ Lower —'],'48 of 51 cards are higher than an ace; none is lower');
 c.press('lo');c.run("rtbGuess('lo')");c.press('black');c.press('out');
 assert.deepEqual(c.st(),{live:true,stage:1,cards:'A♦',won:'192',deck:51},'the dead button and the other rounds\' buttons change nothing');
 c.press('hi');
 assert.equal(c.res(),'✅ K♠ - 2.03x locked. Round 3 - inside or outside A♦ and K♠? A card on the line loses.');
 assert.deepEqual(c.btns(),['↔ Inside 1.13x','dead ↕ Outside —'],'44 of 50 inside an ace and a king; nothing outside');
 c.press('in');
 assert.equal(c.res(),'✅ 5♥ - 2.29x locked. Round 4 - which suit?');
 assert.deepEqual(c.btns(),['♠ 4.08x','♥ 4.08x','♦ 4.08x','♣ 3.76x'],'12 of 49 left in each suit seen, 13 in the one not seen');
 /* adjacent cards: nothing lies between them */
 const d=table();d.run('openRTB()');d.board();d.T.force('7♥','8♣');d.press('red');
 assert.deepEqual(d.btns(),['⬆ Higher 2.12x','⬇ Lower 2.12x'],'24 of 51 either way from a 7');
 d.press('hi');
 assert.deepEqual(d.btns(),['dead ↔ Inside —','↕ Outside 1.13x']);
 /* the rules in code: the price is floor(100n/k)/100 over the deck before the draw, the colour a flat 1.92x */
 assert.match(between('function rtbPrice(','\n}'),/if\(stage===0\)return RTB_COLOUR;/);
 assert.match(between('function rtbPrice(','\n}'),/return k\?Math\.floor\(100\*deck\.length\/k\):0;/);
 assert.equal(c.run('RTB_COLOUR'),192);
 assert.match(between('function rtbGuess(','\n}'),/if\(!price\)return;/);
 assert.ok(!/rtbShuffle\(\)/.test(between('function rtbGuess(','\n}')),'no deck refill: four cards never empty a fresh deck');
});

test('Cash Out shows what it pays, and pays floor(stake x the product of the prices won)',()=>{
 const c=table();c.run('openRTB()');c.T.bet(5);
 assert.equal(c.$('rtbCash').textContent,'Cash Out');assert.equal(c.$('rtbCash').disabled,true);
 c.board();
 assert.equal(c.$('rtbCash').disabled,true,'nothing won yet - the fare is on the table');
 c.T.force('7♥');c.press('red');
 assert.equal(c.$('rtbCash').textContent,'Cash Out '+gold(96000));assert.equal(c.$('rtbCash').disabled,false);
 const before=c.S.gold;c.run('rtbCashOut()');
 assert.deepEqual(c.pays,[96000]);assert.equal(c.S.gold-before,96000);
 assert.equal(c.st().live,false);
 c.run('rtbCashOut()');assert.deepEqual(c.pays,[96000],'once');
 /* 1,000 x 1.92 x 2.12 = 4,070.4: the gold is rounded down, and the button said so */
 const d=table();d.run('openRTB()');d.T.bet(0);d.board();d.T.force('7♥','9♠');d.press('red');d.press('hi');
 const want=Number(1000n*192n*212n/10000n);
 assert.equal(want,4070);
 assert.equal(d.$('rtbCash').textContent,'Cash Out '+gold(want));
 d.run('rtbCashOut()');assert.deepEqual(d.pays,[want]);
 assert.match(between('function rtbPay(','\n}'),/addGoldOverflow\(win\)/,'wins go over the gold cap into overflow, as before');
});

test('the ladder shows each price won and the running total; a bust marks its rung red, a cash-out its rung gold',()=>{
 const c=table();c.run('openRTB()');
 assert.deepEqual(c.rungs(),['Colour 1.92x','Hi/Lo','In/Out','Suit'],'the one fixed price shows before the fare is paid (round 2)');
 c.board();c.T.force('7♥','9♠','7♣');
 assert.deepEqual(c.rungs(),['cur: Colour 1.92x','Hi/Lo','In/Out','Suit']);
 c.press('red');c.press('hi');
 assert.deepEqual(c.rungs(),['won: Colour 1.92x','won: Hi/Lo 2.12x','cur: In/Out','Suit','tot: = 4.07x']);
 c.press('in');                                             /* a 7 is on the line */
 assert.deepEqual(c.rungs(),['won: Colour 1.92x','won: Hi/Lo 2.12x','bust: In/Out','Suit','tot lost: = 4.07x']);
 assert.match(c.res(),/^💥 7♣ - bust - on the line loses!/);
 c.board();c.T.force('7♥','9♠');c.press('red');c.press('hi');c.run('rtbCashOut()');
 assert.deepEqual(c.rungs(),['won: Colour 1.92x','cash: Hi/Lo 2.12x','In/Out','Suit','tot: = 4.07x']);
 c.board();
 assert.deepEqual(c.rungs(),['cur: Colour 1.92x','Hi/Lo','In/Out','Suit'],'a new ride starts clean');
 assert.match(css,/\.rtbstep\.bust\{[^}]*#a03636/);
 assert.match(css,/\.rtbstep\.cash\{[^}]*#ffd76a/);
 assert.match(css,/\.rtbladder\{flex-wrap:wrap\}/,'the priced rungs wrap on a phone');
});

test('max win 250x: the ride cashes itself out the moment the multiplier reaches it',()=>{
 /* the longest shot there is: 1.92 x 6.37 x 12.50 x 4.90 = 749x, paid at 250x */
 const c=table();c.run('openRTB()');c.T.bet(0);c.board();c.T.force('3♠','A♠','2♠','9♠');
 c.press('black');c.press('lo');c.press('in');
 assert.equal(c.st().live,true);assert.equal(c.$('rtbCash').textContent,'Cash Out '+gold(152880),'1.92 x 6.37 x 12.50');
 c.press('s♠');
 assert.deepEqual(c.pays,[250000]);
 assert.equal(c.st().live,false);assert.equal(c.res(),'🚌🎉 MAX WIN - +'+gold(250000));
 assert.deepEqual(c.rungs(),['won: Colour 1.92x','won: Hi/Lo 6.37x','won: In/Out 12.50x','cash: Suit 4.90x','tot: = 250.00x']);
 assert.equal(c.timers.size,1,'the big-win glow is timed');
 /* reached mid-ride with a lower cap: the ride ends there and pays the cap, not the product */
 const d=table(RTB.replace('const RTB_CAP=250;','const RTB_CAP=4;'));
 d.run('openRTB()');d.T.bet(0);d.board();d.T.force('7♥','9♠');d.press('red');
 assert.equal(d.st().live,true,'1.92x is under the cap');
 d.press('hi');                                              /* 1.92 x 2.12 = 4.07 */
 assert.deepEqual(d.pays,[4000]);assert.equal(d.st().live,false);assert.equal(d.$('rtbCash').disabled,true);
 assert.equal(c.run('RTB_CAP'),250);
 assert.match(html,/<span class="slotbetcost">◉ \/ ride · max win 250x<\/span>/,'the table says so');
 /* the payout never needs more than whole numbers under 2^53: the largest product is 749.11x at a 50,000 stake */
 assert.ok(50000*192*637*1250*490<Number.MAX_SAFE_INTEGER);
});

test('a fresh 52-card deck each ride, the stakes, the fare saved on boarding and the result saved',()=>{
 const c=table();c.run('openRTB()');
 assert.deepEqual([...c.run('RTB_BETS')],[1000,2500,5000,10000,25000,50000]);
 for(let ride=0;ride<3;ride++){
  const saves=c.saves,g=c.S.gold;c.board();
  assert.equal(c.S.gold,g-5000);assert.equal(c.saves,saves+1,'the fare is saved as paid');
  const deck=c.run('rtbDeck');assert.equal(new Set(deck.map(x=>x.r+x.s)).size,52);assert.equal(deck.length,52);
  c.T.force('5♥');c.press('black');                         /* bust */
  assert.equal(c.saves,saves+2,'and so is the result');
 }
 /* a real double-click: one fare, one guess */
 const g=c.S.gold;c.board(1);c.board(2);
 assert.equal(c.S.gold,g-5000);
 c.T.force('9♥','K♣');c.press('red',1);c.press('hi',2);
 assert.equal(c.st().stage,1,'the second click of a double-click is not the next round\'s guess');
});

test('a hero put away: rtbTeardown forfeits the ride, and with no hero nothing pays, throws or sticks',()=>{
 /* kicked mid-ride with 1.92x locked (S is null before any teardown runs) */
 const c=table();c.run('openRTB()');c.board();c.T.force('7♥');c.press('red');
 const hero=c.S;c.S=null;
 assert.doesNotThrow(()=>{c.run('rtbCashOut()');c.press('hi');c.board();c.$('rtbBetUp').onclick();c.$('rtbBetDn').onclick();});
 assert.deepEqual(c.pays,[]);assert.equal(c.st().stage,1);
 assert.equal(c.open(),true);
 c.$('rtbClose').onclick();
 assert.equal(c.open(),false,'Close always lets go of the table without a hero');
 assert.equal(c.st().live,false);
 c.run('openRTB()');assert.equal(c.open(),false,'no table without a hero');
 /* the teardown itself: never throws with S gone, stops the glow, closes the window, starts the next hero clean */
 const d=table();d.run('openRTB()');d.T.bet(0);d.board();d.T.force('3♠','A♠','2♠','9♠');
 d.press('black');d.press('lo');d.press('in');d.press('s♠');
 d.board();d.T.force('8♥');d.press('red');
 assert.equal(d.timers.size,1);
 d.S=null;
 assert.doesNotThrow(()=>d.run('rtbTeardown()'));
 assert.deepEqual(d.st(),{live:false,stage:0,cards:'',won:'',deck:0});
 assert.equal(d.open(),false);assert.equal(d.timers.size,0,'no timer outlives the hero');
 assert.equal(d.$('rtbFx').querySelector('.slotmach').classList.contains('bigwin'),false);
 d.S={gold:5000};d.run('openRTB()');d.T.bet(2);d.board();
 assert.deepEqual(d.st(),{live:true,stage:0,cards:'',won:'',deck:52});assert.equal(d.S.gold,0);
 /* a ride paid by one hero never pays another: the payout is void and the table goes */
 const e=table();e.run('openRTB()');e.board();e.T.force('7♥','9♠');e.press('red');
 const other={gold:0};e.S=other;
 e.run('rtbCashOut()');
 assert.deepEqual(e.pays,[]);assert.equal(other.gold,0);assert.equal(e.st().live,false);assert.equal(e.open(),false);
 const f=table();f.run('openRTB()');f.board();f.T.force('7♥','9♠');f.press('red');f.S={gold:0};
 f.press('hi');
 assert.deepEqual(f.st(),{live:false,stage:0,cards:'',won:'',deck:0},'nor is it played on by another');
 assert.equal(hero.gold,1e7-5000,'the fare stays paid - it was saved when it was paid');
 assert.match(between('function rtbStart(){','\n}'),/rtbHero=S;/);
});

test('the words on the table: the intro, the rules in each prompt, the stake line',()=>{
 const c=table();c.run('openRTB()');
 assert.equal(c.res(),'Every guess pays its odds - cash out after any win.','Cash Out opens after the first win - not "any time"');
 assert.match(between('function rtbGuess(','\n}'),/Aces low, a tie loses\./);
 assert.match(between('function rtbGuess(','\n}'),/A card on the line loses\./);
 assert.ok(!/20×|20x/.test(cut(game,'/* ==================== 🚌 RIDE THE BUS','*/')),'the header comment no longer promises 20x');
 assert.ok(!/RTB_MULT/.test(game),'the fixed ladder is gone');
 assert.match(cut(html,'<div id="rtbFx">','<div id="rouFx">'),/id="rtbCash" disabled>Cash Out</);
});

/* ---------------- round 2 (review-rtb's optional items, asked for by the owner) ---------------- */
test('a paid ride is over the moment it is paid: a sound or log line that throws cannot leave it live to be cashed out again',()=>{
 for(const [how,setup] of [['Cash Out',c=>{c.T.force('7♥');c.press('red');c.sfx.buy=()=>{throw new Error('a sound that threw');};return ()=>c.run('rtbCashOut()');}],
  ['the max win',c=>{c.T.bet(0);c.T.force('3♠','A♠','2♠','9♠');c.press('black');c.press('lo');c.press('in');c.dingDingDing=()=>{throw new Error('a fanfare that threw');};return ()=>c.press('s♠');}]]){
  const c=table();c.run('openRTB()');c.board();
  const pay=setup(c),saves=c.saves;assert.throws(pay,/threw/,how);
  assert.equal(c.pays.length,1,how+' paid once');
  assert.equal(c.st().live,false,how+': the ride is not live after its payout, whatever threw after it');
  /* ...and the table says so at once (second pass): it was drawn live - Cash Out lit, the guesses up - until the next render */
  assert.equal(c.$('rtbCash').disabled,true,how+': Cash Out is drawn dead');assert.equal(c.$('rtbCash').textContent,'Cash Out');
  assert.match(c.$('rtbActs').innerHTML,/id="rtbStart">Board the Bus</,how+': Board the Bus is back');
  assert.match(c.res(),how==='Cash Out'?/^🚌 Cashed out - \+9.600◉$/:/^🚌🎉 MAX WIN - \+1.250.000◉$/,how+': the line says what was paid');
  assert.equal(c.saves,saves+1,how+': and the ride\'s end is saved');
  c.run('rtbCashOut()');c.$('rtbCash').onclick();c.press('s♠');
  assert.equal(c.pays.length,1,how+': a second press pays nothing');
  if(how==='the max win'){ /* the big-win glow was timed before the fanfare threw: it still goes out */
   const mach=c.$('rtbFx').querySelector('.slotmach');assert.equal(mach.classList.contains('bigwin'),true);assert.equal(c.timers.size,1);
   [...c.timers.values()].forEach(fn=>fn());assert.equal(mach.classList.contains('bigwin'),false);
  }
 }
 const pay=between('function rtbPay(','\n}');
 assert.match(pay,/over=addGoldOverflow\(win\)\.over[^\n]*\n rtbLive=false;/,'right after the gold is credited');
 assert.match(pay,/\n rtbEnd\([^\n]*\n if\(how==='cash'\)\{\n  sfx\.buy\(\);/,'the table ends, is drawn and saved before any sound');
 assert.match(pay,/rtbGlowT=setTimeout\(\(\)=>mach\.classList\.remove\('bigwin'\),1800\);[^\n]*\n dingDingDing\(true\);/,'the glow is timed before the fanfare');
});

test('the four priced suits stay on one row below 360 px, and the ladder shows the one fixed price before the fare is paid',()=>{
 assert.match(css,/@media \(max-width:359px\)\{#rtbActs \.bjact\[data-rg\]\{padding:12px 6px\}\.rtbstep\{padding:5px 6px\}\}/,'the guess buttons only - Board the Bus and Cash Out keep theirs');
 /* the rungs too (second pass): 'Colour 1.92x' put the idle ladder's Suit on a second row at 320 px - it was one row before.
    Same specificity as the 5px 10px rule, so it has to come after it */
 assert.ok(css.indexOf('.rtbstep{padding:5px 10px;')>=0&&css.indexOf('.rtbstep{padding:5px 10px;')<css.indexOf('.rtbstep{padding:5px 6px}'));
 /* the phone rule under it sets #rtbFx .bjact{padding:12px}: this one must outrank it */
 const spec=s=>[(s.match(/#/g)||[]).length,(s.match(/\.|\[/g)||[]).length];
 assert.ok(spec('#rtbActs .bjact[data-rg]')[1]>spec('#rtbFx .bjact')[1]&&spec('#rtbActs .bjact[data-rg]')[0]===spec('#rtbFx .bjact')[0]);
 const c=table();c.run('openRTB()');
 assert.deepEqual(c.rungs(),['Colour 1.92x','Hi/Lo','In/Out','Suit'],'Colour pays 1.92x whatever the cards: it is shown before boarding');
 c.board();c.T.force('5♥');c.press('black');
 assert.deepEqual(c.rungs(),['bust: Colour','Hi/Lo','In/Out','Suit'],'a lost rung shows no price');
 c.run('openRTB()');assert.deepEqual(c.rungs(),['Colour 1.92x','Hi/Lo','In/Out','Suit']);
 assert.equal(c.run('RTB_COLOUR'),192);
});
