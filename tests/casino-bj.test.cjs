/* Blackjack fixes from the 2026-09-30 casino review (bj-1..bj-7, the 'broke!' wording, crosscut-2 and crosscut-11 for this table),
 * pinned so they stay fixed. The real Blackjack slice of game.js runs in a vm over a small fake DOM, with fake timers, a fake clock
 * and rigged cards; gold is plain S.gold. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const BJ=section('/* ==================== BLACKJACK','/* ==================== ROULETTE');
const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const cards=(...rs)=>rs.flatMap(r=>[(RANKS.indexOf(r)+.5)/13,.1]); /* bjDraw takes two Math.random() calls: rank, suit (0.1 = a black spade) */
const n=v=>v.toLocaleString(); /* the table writes numbers in the machine's locale */

function table({gold=100000,overflow=0,bet}={}){
 const doc={activeElement:null,body:null};
 function el(id=''){
  const cls=new Set();let dis=false,html='';
  const e={id,parent:null,children:[],style:{},dataset:{},textContent:'',
   classList:{add:(...a)=>a.forEach(x=>cls.add(x)),remove:(...a)=>a.forEach(x=>cls.delete(x)),contains:x=>cls.has(x),
    toggle(x,f){const on=f===undefined?!cls.has(x):f;if(on)cls.add(x);else cls.delete(x);return on;}},
   appendChild(c){c.parent=e;e.children.push(c);return c;},
   contains(x){for(let p=x;p;p=p.parent)if(p===e)return true;return false;},
   focus(){if(!dis)doc.activeElement=e;},
   listeners:{},addEventListener(t,fn){(e.listeners[t]=e.listeners[t]||[]).push(fn);}};
  Object.defineProperty(e,'className',{get:()=>[...cls].join(' '),set:v=>{cls.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>cls.add(x));}});
  Object.defineProperty(e,'innerHTML',{get:()=>html,set:v=>{html=String(v);e.children.forEach(k=>k.parent=null);e.children.length=0;}});
  /* Chromium drops focus to the page when the focused button is disabled under it */
  Object.defineProperty(e,'disabled',{get:()=>dis,set:v=>{dis=!!v;if(dis&&doc.activeElement===e)doc.activeElement=doc.body;}});
  return e;
 }
 doc.body=el('body');doc.activeElement=doc.body;
 const nodes=new Map();
 const fx=el('bjFx');nodes.set('bjFx',fx);
 for(const id of ['bjDTot','bjDealerC','bjPTot','bjHandC','bjRes','bjStats','bjBetDn','bjBetN','bjBetUp','bjDeal','bjHit','bjStand','bjDbl','bjClose']){const e=el(id);fx.appendChild(e);nodes.set(id,e);}
 const outside=el('charSelBtn');doc.body.appendChild(outside);nodes.set('charSelBtn',outside);
 doc.body.appendChild(fx);
 const timers=new Map();let serial=0;
 const c={
  now:1000,rolls:[],msgs:[],logs:[],saves:0,amb:0,
  $:id=>{if(!nodes.has(id)){const e=el(id);fx.appendChild(e);nodes.set(id,e);}return nodes.get(id);},
  document:{createElement:()=>el(),get activeElement(){return doc.activeElement;},get body(){return doc.body;}},
  performance:{now:()=>c.now},
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:c.now+(ms||0)});return id;},clearTimeout:id=>timers.delete(id),
  S:{id:'hero-a',gold,overflow},
  totalGold:()=>c.S.gold+(c.S.overflow||0),
  spendGold(v){if(c.totalGold()<v)return false;const g=Math.min(c.S.gold,v);c.S.gold-=g;c.S.overflow-=v-g;return true;},
  addGoldOverflow(v){c.S.gold+=v;return {got:v,over:0};},
  save(){c.saves++;},renderHUD(){},stageMsg(m){c.msgs.push(m);},log(m){c.logs.push(m);},
  blip(){},noiseSweep(){},dingDingDing(){},spawnPartsIn(){},casinoAmbApply(){c.amb++;},
  sfx:{buy(){},warn(){},loot(){}},
  padFocus:null,padMark(e){c.padFocus=e||null;},
  Math:Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():.5}),
 };
 c.advance=ms=>{const end=c.now+ms;for(let guard=0;guard<1000;guard++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;timers.delete(due[0]);c.now=due[1].at;due[1].fn();}c.now=end;};
 c.doc=doc;c.outside=outside;
 vm.createContext(c);
 vm.runInContext(BJ,c);
 c.v=expr=>vm.runInContext(expr,c);
 if(bet)c.v(`bjBet=${bet}`);
 c.v('openBJ()');
 c.advance(400); /* the press that opened the table is not a Deal (openBJ starts the bounce): the player's next press comes later */
 c.tap=(id,detail=1)=>c.$(id).onclick({detail}); /* a mouse click; detail 0 is a key or the pad */
 c.text=id=>String(c.$(id).textContent);
 c.open=()=>fx.classList.contains('open');
 return c;
}

test('the result line, the log and the session line show what the hand changed; a dealer blackjack says so',()=>{
 const t=table();
 t.rolls=cards('10','9','10','7');t.tap('bjDeal');t.advance(400);t.tap('bjStand');t.advance(3000); /* 19 v 17 */
 assert.equal(t.S.gold,101000);
 assert.equal(t.text('bjRes'),'Winner! +'+n(1000)+'◉','the net, not the 2,000 that came back');
 assert.match(t.logs.at(-1),new RegExp('\\+'+n(1000)+' ◉'));
 assert.equal(t.text('bjStats'),'Session: 1 hand · +'+n(1000)+'◉','one hand, not "1 hands"');
 t.advance(400);t.rolls=cards('A','K','9','7');t.tap('bjDeal'); /* a natural at 1,000 */
 assert.equal(t.S.gold,102500);
 assert.equal(t.text('bjRes'),'🃏 BLACKJACK! +'+n(1500)+'◉ · pays 3:2');
 assert.equal(t.text('bjStats'),'Session: 2 hands · +'+n(2500)+'◉');
 t.advance(400);t.rolls=cards('10','9','A','K');t.tap('bjDeal'); /* the dealer's natural */
 assert.equal(t.text('bjRes'),'Dealer blackjack.');
 assert.equal(t.S.gold,101500);
 const d=table({gold:200000,bet:15000});
 d.rolls=cards('6','5','6','10');d.tap('bjDeal');d.advance(400);d.rolls=cards('10','10');d.tap('bjDbl');d.advance(4000); /* 15,000 doubled 11 -> 21, dealer 6,10,10 */
 assert.equal(d.S.gold,230000);
 assert.equal(d.text('bjRes'),'Winner! +'+n(30000)+'◉');
});

test('a doubled or held press does not deal over a result, or hit right after a deal',()=>{
 const t=table();
 t.rolls=cards('A','K','9','7','10','6','8','5');
 t.tap('bjDeal',0);t.tap('bjDeal',0); /* the pad's A twice, or Enter twice: the natural settles inside the first press */
 assert.equal(t.v('bjSession.hands'),1);assert.equal(t.v('bjLive'),false);
 assert.match(t.text('bjRes'),/^🃏 BLACKJACK!/,'the paid blackjack stays on screen');
 assert.equal(t.S.gold,101500,'no second stake');
 t.advance(349);t.tap('bjDeal',0);assert.equal(t.v('bjLive'),false,'still the same press');
 t.advance(2);t.tap('bjDeal',0);assert.equal(t.v('bjLive'),true,'a new press deals');
 /* the Deal that left the hand live moved focus to Hit: the doubled press lands there and must not draw */
 t.rolls=cards('K');t.tap('bjHit',0);t.tap('bjStand',0);t.tap('bjDbl',0);
 assert.equal(t.v('bjP.length'),2);assert.equal(t.v('bjLive'),true);
 t.advance(400);t.tap('bjHit',0);assert.equal(t.v('bjP.length'),3,'10,6 +K: bust');
 assert.equal(t.v('bjLive'),false);
 t.tap('bjDeal',0);assert.equal(t.v('bjLive'),false,'the press after a bust does not buy the next hand');
 t.advance(400);t.rolls=cards('10','6','8','5');t.tap('bjDeal',0);assert.equal(t.v('bjLive'),true);
 /* a mouse double-click was already one hand (2026-09-23): its second click carries detail 2 */
 const m=table();m.rolls=cards('A','K','9','7','10','6','8','5');m.tap('bjDeal',1);m.advance(400);m.tap('bjDeal',2);
 assert.equal(m.v('bjSession.hands'),1);assert.equal(m.v('bjLive'),false);
 /* a held Enter presses a table button once: its repeats are cancelled before they click - by a listener on the table
    (2026-09-30, round 2), not an onkeydown that another keydown handler could silently replace */
 assert.equal(t.$('bjFx').onkeydown,undefined);assert.equal(t.$('bjFx').listeners.keydown.length,1);
 let prevented=0;const key=(repeat,k='Enter')=>t.$('bjFx').listeners.keydown.forEach(fn=>fn({key:k,repeat,preventDefault(){prevented++;}}));
 key(false);assert.equal(prevented,0);key(true);assert.equal(prevented,1);key(true,'a');assert.equal(prevented,1);
 assert.match(BJ,/\$\('bjFx'\)\.addEventListener\('keydown',e=>\{if\(e\.repeat&&e\.key==='Enter'\)e\.preventDefault\(\);\}\);/);
 assert.doesNotMatch(game,/\$\('bjFx'\)\.onkeydown=/);
});

test('keyboard and pad focus follow the play: Hit after a live deal, Deal after the settle, Close is kept',()=>{
 const t=table();
 assert.equal(t.doc.activeElement,t.$('bjDeal'),'the table opens on Deal');
 t.padFocus=t.$('bjDeal');
 t.rolls=cards('10','6','8','5');t.tap('bjDeal',0);
 assert.equal(t.doc.activeElement,t.$('bjHit'),'Deal went dead under the key: focus moves on to Hit');
 assert.equal(t.padFocus,t.$('bjHit'),'and so does the pad highlight');
 t.advance(400);t.rolls=cards('K');t.tap('bjHit',0); /* bust */
 assert.equal(t.doc.activeElement,t.$('bjDeal'),'back to Deal once the hand is over');
 assert.equal(t.padFocus,t.$('bjDeal'));
 t.advance(400);t.rolls=cards('10','8','6','10');t.tap('bjDeal',0);t.advance(400);
 t.$('bjClose').focus();t.padFocus=t.$('bjClose');
 t.tap('bjStand');t.rolls=cards('K');t.advance(3000);
 assert.equal(t.v('bjSettled'),true);
 assert.equal(t.doc.activeElement,t.$('bjClose'),'a player who went to Close keeps it');
 assert.equal(t.padFocus,t.$('bjClose'));
 /* a natural keeps focus on Deal; focus elsewhere on the page is never taken mid-hand */
 t.advance(400);t.$('bjDeal').focus();t.rolls=cards('A','K','9','7');t.tap('bjDeal',0);
 assert.equal(t.doc.activeElement,t.$('bjDeal'));
 t.outside.focus();t.advance(400);t.rolls=cards('10','6','8','5');t.tap('bjDeal');
 assert.equal(t.doc.activeElement,t.outside);
});

test('cards fly in once each: a Hit animates only the new card, the hole card turns over in place',()=>{
 const t=table();
 const P=()=>t.$('bjHandC').children,D=()=>t.$('bjDealerC').children;
 t.rolls=cards('10','2','9','7');t.tap('bjDeal');
 assert.deepEqual([...P(),...D()].map(e=>e.style.animationDelay),['0s','0.16s','0.32s','0.48s'],'the deal: you, you, dealer, hole');
 assert.ok([...P(),...D()].every(e=>e.classList.contains('deal')));
 assert.ok(D()[1].classList.contains('back'));
 const before=[...P(),...D()];
 t.advance(400);t.rolls=cards('3');t.tap('bjHit');
 assert.equal(P().length,3);
 assert.deepEqual([...P()].slice(0,2),before.slice(0,2),'the cards on the table are the same elements - nothing is re-dealt');
 assert.equal(D()[1],before[3],'the hole card is not dealt again');
 assert.ok(P()[2].classList.contains('deal'));assert.equal(P()[2].style.animationDelay,'0s','the new card flies in at once');
 t.tap('bjStand');
 const hole=D()[1];
 assert.equal(hole,before[3],'the reveal turns the same card over');
 assert.equal(hole.className,'bjcard flip');assert.equal(hole.style.animationDelay,'');assert.equal(hole.innerHTML,'<span>7</span><span>♠</span>');
 assert.equal(t.text('bjDTot'),'16');
 t.rolls=cards('5');t.advance(3000); /* the dealer draws 5 -> 21 */
 assert.equal(D().length,3);assert.equal(D()[2].style.animationDelay,'0s');assert.equal(D()[1],hole);
 /* a bust renders twice in one tick: the busting card keeps its flight */
 t.advance(400);t.rolls=cards('10','6','9','7');t.tap('bjDeal');t.advance(400);t.rolls=cards('K');t.tap('bjHit');
 assert.ok(P()[2].classList.contains('deal'));assert.ok(D()[1].classList.contains('flip'));assert.equal(t.text('bjRes'),'Bust! The house takes your coin.');
 /* a natural is settled at the deal: every card comes in face up and flies, none flips before it has landed */
 t.advance(400);t.rolls=cards('A','K','9','7');t.tap('bjDeal');
 assert.equal(P().length+D().length,4);
 assert.ok([...P(),...D()].every(e=>e.classList.contains('deal')&&!e.classList.contains('back')&&!e.classList.contains('flip')));
 assert.equal(t.text('bjDTot'),'16');
});

test('Close mid-hand says why it stays; an idle table closes',()=>{
 const t=table();
 t.rolls=cards('10','6','8','5');t.tap('bjDeal');
 t.tap('bjClose');
 assert.ok(t.open());assert.deepEqual(t.msgs,['Finish the hand first - your stake is on the table.']);
 t.advance(400);t.tap('bjStand');t.tap('bjClose');
 assert.ok(t.open(),'not while the dealer draws either');assert.equal(t.msgs.length,2);
 t.rolls=cards('K');t.advance(3000);t.tap('bjClose');
 assert.ok(!t.open());assert.equal(t.amb,1);
});

test("'broke!' only when not even the smallest hand can be paid; a bet above the purse drops to what it can pay",()=>{
 const t=table({gold:1500});
 t.rolls=cards('10','9','6','10');t.tap('bjDeal');t.advance(400);t.tap('bjStand');
 assert.equal(t.v('bjResolving'),true);
 assert.equal(t.text('bjDeal'),'Deal · '+n(1000)+'◉','500 left, but the dealer is still drawing a hand that may pay');
 t.rolls=cards('K');t.advance(3000);
 assert.equal(t.S.gold,2500);assert.equal(t.text('bjDeal'),'Deal · '+n(1000)+'◉');
 const r=table({gold:5000,bet:15000});
 assert.equal(r.v('bjBet'),5000,'opened with 5,000 against a 15,000 bet: the bet drops to 5,000');
 assert.equal(r.text('bjDeal'),'Deal · '+n(5000)+'◉');assert.equal(r.$('bjDeal').disabled,false);
 r.tap('bjBetUp');
 assert.equal(r.text('bjDeal'),'Deal · '+n(6000)+'◉ - lower the bet');assert.equal(r.$('bjDeal').disabled,true);
 r.tap('bjBetDn');r.rolls=cards('10','6','10','8');r.tap('bjDeal');r.advance(400);r.tap('bjStand');r.advance(3000); /* 16 v 18: 5,000 lost */
 assert.equal(r.S.gold,0);assert.equal(r.v('bjBet'),1000);assert.equal(r.text('bjDeal'),'Deal · '+n(1000)+'◉ - broke!');
 const s=table({gold:3500,bet:3000});
 s.rolls=cards('10','6','10','8');s.tap('bjDeal');s.advance(400);s.tap('bjStand');s.advance(3000);
 assert.equal(s.S.gold,500);assert.equal(s.text('bjDeal'),'Deal · '+n(1000)+'◉ - broke!');
 const o=table({gold:2500,overflow:1000,bet:4000});
 assert.equal(o.v('bjBet'),3000,'overflow gold counts, as it does when the stake is paid');
});

test('teardown: a hand in flight is forfeited, never pays, and the next hero finds a clean table - even with S gone',()=>{
 const t=table();
 t.rolls=cards('10','9','6','10');t.tap('bjDeal');t.advance(400);t.tap('bjStand'); /* 19 v 16: the dealer draws */
 const saves=t.saves,gold=t.S.gold;
 t.v('bjTeardown()');
 assert.ok(!t.open());
 assert.deepEqual([...t.v('[bjLive,bjResolving,bjP.length,bjD.length,bjSession.hands]')],[false,false,0,0,0]);
 t.rolls=cards('K','K','K');t.advance(5000); /* the dealer's timers are dead */
 assert.equal(t.S.gold,gold);assert.equal(t.saves,saves);assert.equal(t.$('bjDealerC').children.length,0);
 t.S=null; /* a kick: closeCasinoWindows runs teardown before S is dropped, and may run it again */
 assert.doesNotThrow(()=>t.v('bjTeardown()'));
 t.S={id:'hero-b',gold:50000,overflow:0};
 t.v('openBJ()');
 assert.ok(t.open());assert.equal(t.text('bjStats'),'');assert.equal(t.$('bjDeal').disabled,false);assert.equal(t.$('bjHit').disabled,true);
 assert.match(section('function openBJ(){','\n$(\'bjDeal\').onclick='),/\nfunction bjTeardown\(\)\{/,'the teardown lives next to the open function');
});

test('a hand belongs to the hero who paid: another hero loaded mid-hand is never paid or charged',()=>{
 const a={id:'hero-a',gold:100000,overflow:0},b={id:'hero-b',gold:1000,overflow:0};
 const t=table();t.S=a;
 t.rolls=cards('10','9','10','7');t.tap('bjDeal');t.advance(400); /* Alpha pays 1,000 for 19 v 17 */
 t.S=b; /* a switch the table outlived */
 t.tap('bjStand');t.advance(3000);
 assert.equal(b.gold,1000,'Bravo is not paid for a hand Alpha bought');assert.equal(a.gold,99000);
 assert.ok(!t.open(),'the void hand leaves with the table');assert.equal(t.v('bjLive'),false);
 assert.equal(t.amb,1,'and the room gets its music back, as a Close does');
 const d=table();d.S=a;a.gold=100000;
 d.rolls=cards('6','5','9','7');d.tap('bjDeal');d.advance(400);d.S=b;d.tap('bjDbl');
 assert.equal(b.gold,1000,'nor charged for its double');
 const r=table();r.S=a;a.gold=100000;
 r.rolls=cards('10','9','6','10');r.tap('bjDeal');r.advance(400);r.tap('bjStand');r.S=b;r.rolls=cards('K');r.advance(3000);
 assert.equal(b.gold,1000,'nor paid when the dealer busts after the switch');assert.ok(!r.open());
 /* the Close guard asks the hero who paid: a stranger closes the table on the void hand */
 const c=table();c.S=a;c.rolls=cards('10','6','8','5');c.tap('bjDeal');c.S=b;c.tap('bjClose');
 assert.ok(!c.open());assert.deepEqual(c.msgs,[]);
});

test('with S gone every table button returns quietly, and Close still closes',()=>{
 const t=table();
 t.S=null;
 for(const id of ['bjDeal','bjHit','bjStand','bjDbl','bjBetUp','bjBetDn'])assert.doesNotThrow(()=>t.tap(id),id);
 assert.doesNotThrow(()=>t.tap('bjClose'));assert.ok(!t.open());
 const k=table();k.rolls=cards('10','6','8','5');k.tap('bjDeal');k.advance(400);
 k.S=null; /* kicked with a hand live */
 assert.doesNotThrow(()=>k.tap('bjStand'));assert.ok(!k.open());assert.equal(k.v('bjResolving'),false);
 const r=table();r.rolls=cards('10','9','6','10');r.tap('bjDeal');r.advance(400);r.tap('bjStand');
 r.S=null; /* kicked while the dealer draws */
 assert.doesNotThrow(()=>r.advance(3000));assert.ok(!r.open());
 const o=table();o.S=null;o.v('openBJ()');o.tap('bjClose');assert.ok(!o.open());
 assert.doesNotThrow(()=>{o.S=null;o.v('openBJ()');});
});

test('the rules are the same: 3:2, pushes, the dealer stands on soft 17, the deal handler still drops a double-click',()=>{
 const t=table();
 t.rolls=cards('A','K','K','A');t.tap('bjDeal');assert.equal(t.text('bjRes'),'Push - bet returned.');assert.equal(t.S.gold,100000);
 t.advance(400);t.rolls=cards('5','6','A','6');t.tap('bjDeal');t.advance(400);t.rolls=cards('K');t.tap('bjHit'); /* 21 v A,6 */
 t.advance(3000);assert.equal(t.v("bjD.map(c=>c.r).join(',')"),'A,6','soft 17 stands');assert.equal(t.S.gold,101000);
 assert.match(game,/\$\('bjDeal'\)\.onclick=e=>\{if\(e&&e\.detail>1\)return;bjDeal\(\);\};/);
 assert.match(BJ,/if\(kind==='bj'\)paid=Math\.round\(bjWager\*2\.5\);/);
 assert.match(BJ,/if\(bjVal\(bjD\)<17\)\{/);
});
