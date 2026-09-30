/* The Slots machine (hold & respin) after the 2026-09-30 casino audit, pinned so it stays fixed. The machine runs for real in a
 * vm - the code from 'const SEA_BETS=' to the Blackjack banner, with the real gold and scrap helpers, a fake DOM, fake timers
 * and a seeded Math.random - and the page text is read from index.html. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const SLOTS=section('const SEA_BETS=','/* ==================== BLACKJACK');
const GOLD=section('const bagSellable=','/* ==================== BANK')+section('function spendGold(n){','/* zero loot');
const mulberry=seed=>{let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
const hero=(id,gold=1000000,extra={})=>Object.assign({id,gold,overflow:0,prestige:20,bag:[],scraps:0},extra);

/* one machine: c.S is the hero, c.disk(id) what was last saved for that hero, c.rolls forces the next Math.random() values */
function machine(S,seed=1){
 const els=new Map(),timers=new Map(),frames=new Map();let serial=0;
 /* keyboard focus as Chromium keeps it: a focused button disabled under the key drops focus to the page; YES and NO are not
    rendered while the Extra Spin box is hidden (a focused one keeps focus until the page catches up, as in Edge) */
 const doc={activeElement:null,body:null};
 const element=id=>{
  const classes=new Set();let dis=false;
  const e={id,style:{setProperty(){},removeProperty(){}},textContent:'',innerHTML:'',children:[],firstElementChild:null,onclick:null,
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),toggle:(n,f)=>{const on=f===undefined?!classes.has(n):f;if(on)classes.add(n);else classes.delete(n);return on;}},
   appendChild(){},remove(){},querySelector:()=>element(),getBoundingClientRect:()=>({height:62}),
   getClientRects:()=>/^seaBuy(Yes|No)$/.test(id)&&c.$('seaBuyFx').style.display!=='flex'?[]:[{}],
   contains:x=>!!x&&x!==doc.body, /* everything the machine made sits inside #seaFx; the page does not */
   focus(){if(!dis&&e.getClientRects().length)doc.activeElement=e;},
   listeners:{},addEventListener(t,fn){(e.listeners[t]=e.listeners[t]||[]).push(fn);}};
  Object.defineProperty(e,'disabled',{get:()=>dis,set:v=>{dis=!!v;if(dis&&doc.activeElement===e)doc.activeElement=doc.body;}});
  Object.defineProperty(e,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>classes.add(x));}});
  return e;
 };
 const disks={},rnd=mulberry(seed);
 const c={S,now:1000,rolls:[],saves:0,msgs:[],logs:[],sounds:[],texts:[],
  $:id=>{if(!els.has(id))els.set(id,element(id));return els.get(id);},
  document:{createElement:()=>element(),get activeElement(){return doc.activeElement;},get body(){return doc.body;}},performance:{now:()=>c.now},
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:c.now+(ms||0)});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},
  save:()=>{if(c.S)disks[c.S.id]=JSON.parse(JSON.stringify(c.S));c.saves++;},renderHUD:()=>{if(!c.S)throw new Error('renderHUD with no hero');},
  stageMsg:m=>c.msgs.push(m),log:m=>c.logs.push(m),casinoAmbApply(){},blip(){},noiseHit(){},dingDingDing:()=>c.sounds.push('ding'),
  sfx:{buy(){},warn:()=>c.sounds.push('warn'),loot:()=>c.sounds.push('loot')},
  AC:{},ambAudio:null,cowAudio:null,odinAudio:null,cryptAudio:null,finalAudio:null,
  isLegendary:()=>false,inGearSet:()=>false,scrapVal:()=>1,
  padFocus:null,padMark(e){c.padFocus=e||null;}, /* the pad's highlight - game.js keeps it with padTick */
  GOLD_CAP_BASE:500000,GOLD_CAP_ROOF:2000000,SCRAP_CAP:800,goldCap:()=>1e15};
 c.Math=Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():rnd()});
 doc.body=element('body');doc.activeElement=doc.body;c.doc=doc;
 vm.createContext(c);
 vm.runInContext(GOLD,c);
 vm.runInContext(SLOTS,c);
 const res=c.$('seaRes');let txt='';Object.defineProperty(res,'textContent',{get:()=>txt,set:v=>{txt=String(v);c.texts.push(txt);}});
 c.run=code=>vm.runInContext(code,c);
 c.v=name=>c.run(name);
 c.disk=id=>disks[id||c.S.id];
 c.box=()=>c.$('seaBuyFx').style.display==='flex';
 c.idle=()=>!c.v('seaSpinning')&&!c.v('seaCelebrating');
 c.advance=ms=>{const end=c.now+ms;for(let n=0;n<10000;n++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);c.now=next[1].at;next[1].fn();}c.now=end;};
 c.frame=()=>{const p=[...frames.values()];frames.clear();p.forEach(fn=>fn(c.now));
  if(doc.activeElement&&!doc.activeElement.getClientRects().length)doc.activeElement=doc.body;}; /* a frame later the page catches up: a hidden button loses focus */
 c.wait=ms=>{const end=c.now+ms;while(c.now<end){c.advance(50);c.frame();}};
 c.play=()=>{for(let i=0;i<4000&&!c.idle()&&!c.box();i++){c.advance(250);c.frame();}}; /* until the round is over or the box asks */
 /* force the table: the next seaRollOutcome returns m; force the natural trigger with the first draw of a paid spin */
 const roll=c.seaRollOutcome;c.draws=0;c.seaRollOutcome=f=>{c.draws++;if(c.force!=null){const m=c.force;c.force=null;return m;}return roll(f);};
 const script=c.seaScript;c.seaScript=g=>{c.grid=g;return script(g);};
 c.spin=(mult,trigger=false)=>{c.force=mult;c.rolls.unshift(trigger?0:0.999);c.run('spinSea()');};
 c.at=ix=>c.run(`seaBetIx=${ix};seaBet=SEA_BETS[${ix}];updateSeaUI();`);
 c.run('openSea()');
 return c;
}
const total=c=>c.S.gold+(c.S.overflow||0);

test('the bonus buy returns 96.06%: the bought spin only plants the boxes, and every figure comes from the tables',()=>{
 const c=machine(hero('A'));
 const ev=t=>t.reduce((a,[m,w])=>a+m*w,0)/t.reduce((a,[,w])=>a+w,0);
 const base=ev(c.v('SEA_OUTCOMES')),free=ev(c.v('SEA_OUTCOMES_BONUS')),n=c.v('SEA_BONUS_SPINS'),x=c.v('SEA_BONUSBUY_X');
 const buy=n*free/x,plain=base+c.v('SEA_BONUS_CHANCE')*n*free;
 assert.ok(Math.abs(buy-0.9606)<0.00005,'bonus buy '+(buy*100).toFixed(3)+'% - it was 99.18% while the bought spin paid a base roll of its own');
 assert.ok(Math.abs(plain-0.9601)<0.00005,'plain play '+(plain*100).toFixed(3)+'%');
 assert.match(section('const SEA_BONUSBUY_X=','\n'),/96\.06%/,'the comment gives the real figure');
 /* and the machine does it: a buy at 2,000 costs 50,000, draws nothing from the base table, pays nothing and grants 10 */
 c.at(3);const g0=total(c);c.force=20000;
 c.$('seaBonusBuyBtn').onclick();c.play();
 assert.equal(c.draws,0,'no base-game draw on the bought spin');
 assert.equal(total(c)-g0,-50000);
 assert.equal(c.S.seaFree,10);assert.equal(c.S.seaFreeBetIx,3);assert.equal(c.S.seaBonusPending,undefined);
});

test('free spins are the hero\'s: a machine left open across a hero change spins the new hero\'s own, and the teardown hands nothing over',()=>{
 const A=hero('A'),B=hero('B',5000);
 const c=machine(A);c.at(3);c.spin(0,true);c.play();
 assert.equal(A.seaFree,10);assert.equal(c.v('seaFree'),10);
 c.S=B; /* a keyboard hero switch with the machine still open */
 assert.equal(c.$('seaSpinBtn').textContent,'🎁 FREE SPIN · 10 left','the label is still the last hero\'s...');
 c.$('seaSpinBtn').onclick();
 assert.equal(B.gold,5000,'...so a press aimed at it only redraws the machine for B: it used to charge B a paid spin');
 assert.equal(c.$('seaSpinBtn').textContent,'🦈 Spin · '+(2000).toLocaleString()+'◉');
 c.force=0;c.rolls.push(0.999);c.$('seaSpinBtn').onclick();c.play();
 assert.equal(B.seaFree,undefined,'B spun a paid spin of its own...');
 assert.equal(B.gold,3000,'...at the stake on the machine, paid by B');
 assert.equal(A.seaFree,10,'A still has all ten - nothing was spun off its copy');
 /* Auto never runs on into the next hero's gold */
 const u=machine(hero('U'));u.at(0);u.seaRollOutcome=()=>0;u.rolls.push(0.999);u.$('seaAutoBtn').onclick();u.play();
 const V=hero('V',5000);u.S=V;u.wait(5000);
 assert.equal(u.v('seaAuto'),false);assert.equal(V.gold,5000);
 /* the last free spin draws free-spin reels too (it used to draw base-game ones: seaFree was already 0) */
 const l=machine(hero('L',1000000,{seaFree:1,seaFreeBetIx:0}));l.force=0;l.run('spinSea()');
 assert.equal(l.S.seaFree,undefined);assert.equal(l.run('seaBonusMode()'),true);l.play();assert.equal(l.run('seaBonusMode()'),false);
 /* the teardown the hero list runs: persists, zeroes, closes - and with the next hero already loaded it neither hands the
    last hero's spins over nor wipes the next hero's own */
 const A2=hero('A2'),B2=hero('B2',5000,{seaFree:5,seaFreeBetIx:1});
 const d=machine(A2);d.at(3);d.spin(0,true);d.play();
 d.S=B2;d.run('seaTeardown()');
 assert.deepEqual([B2.seaFree,B2.seaFreeBetIx],[5,1]);
 assert.deepEqual([A2.seaFree,A2.seaFreeBetIx],[10,3]);
 assert.equal(d.v('seaFree'),0);assert.equal(d.v('seaAuto'),false);assert.equal(d.v('seaForcedBonus'),false);
 assert.equal(d.$('seaFx').classList.contains('open'),false);
 d.run('openSea()');assert.equal(d.v('seaFree'),5);assert.equal(d.v('seaBet'),500);
 /* a teardown mid-spin: nothing in flight pays afterwards, and with no hero at all it does not throw */
 const e=machine(hero('A3'));e.at(3);const g0=total(e);e.spin(500);e.wait(1500);e.run('seaTeardown()');e.wait(30000);
 assert.equal(total(e)-g0,-2000,'the stake stays paid, the round is over');
 assert.equal(e.v('seaSpinning'),false);assert.equal(e.box(),false);
 e.S=null;assert.doesNotThrow(()=>e.run('seaTeardown()'));
 assert.match(game,/function openSea\(\)\{[\s\S]*?\n\}\n\/\*[^]*?\*\/\nfunction seaTeardown\(\)\{/,'the teardown lives next to openSea');
});

test('Buy Extra Spin: the win is paid before the question, YES is a fair new wager saved when paid, and each answer counts once',()=>{
 const c=machine(hero('A'));c.at(3);const g0=total(c);
 c.spin(100);c.play();
 assert.equal(c.box(),true);
 assert.equal(total(c)-g0,198000,'the 200,000 win is on the hero while the box asks');
 assert.equal(c.disk().gold-g0,198000,'...and saved: closing the game on the box loses nothing');
 assert.match(c.$('seaBuyOdds').textContent,/^50% to double your 200.000◉$/);
 assert.match(c.$('seaBuyPrice').textContent,/^100.000◉$/);
 /* YES with a hit: the price and the doubled win are saved at once, and the box asks again for the doubled win */
 const d0=c.disk().gold;c.rolls.push(0.3);c.$('seaBuyYes').onclick();
 assert.equal(c.disk().gold-d0,100000,'-100,000 price, +200,000 hit, saved before the cells roll');
 c.play();assert.equal(c.box(),true);assert.match(c.$('seaBuyPrice').textContent,/^200.000◉$/);
 /* a miss adds nothing more and says so */
 c.rolls.push(0.7);c.$('seaBuyYes').onclick();c.play();
 assert.equal(total(c)-g0,98000);
 assert.equal(c.$('seaRes').textContent.replace(/\s/g,' '),'No connection - you keep 400 000◉'.replace(/\s/g,' '));
 /* the answered box is dead: a second press (a pad's A on the hidden NO) does nothing, even during the next spin */
 const g1=total(c);for(let k=0;k<3;k++){c.$('seaBuyNo').onclick();c.$('seaBuyYes').onclick();}
 assert.equal(total(c),g1);
 c.spin(0);c.wait(300);c.$('seaBuyNo').onclick();c.$('seaBuyYes').onclick();
 assert.equal(c.v('seaSpinning'),true,'a stale answer does not end the next spin');c.play();
 /* NO pays nothing more - the win is already on the hero */
 const g2=total(c);c.at(0);c.spin(10);c.play();c.$('seaBuyNo').onclick();c.play();
 assert.equal(total(c)-g2,900);
 assert.match(section('function seaBuyAnswer(yes){','\n}'),/Math\.random\(\)<0\.5;/,'a fair 50% double: 96% whatever the answer');
 /* unanswered it is NO after 10 s, counting down on the button */
 const g3=total(c);c.spin(10);c.play();assert.equal(c.box(),true);
 c.wait(5000);assert.equal(c.$('seaBuyNo').textContent,'NO · 5');
 c.wait(5100);assert.equal(c.box(),false);c.play();assert.equal(total(c)-g3,900);
 /* not on a push, and never while Auto runs */
 c.spin(1);c.play();assert.equal(c.box(),false);
 const a=machine(hero('B'));a.at(3);let boxes=0;a.seaRollOutcome=()=>100;
 a.rolls.push(0.999);a.$('seaAutoBtn').onclick();
 for(let t=0;t<40000;t+=50){a.wait(50);if(a.box())boxes++;}
 assert.equal(boxes,0,'Auto never sees the box');assert.equal(a.v('seaAuto'),true);
 /* Close on the box (a pad's B) is NO */
 const b=machine(hero('C'));b.at(0);const gb=total(b);b.spin(10);b.play();b.$('seaClose').onclick();
 assert.equal(b.box(),false);b.play();assert.equal(total(b)-gb,900);
});

test('a natural bonus is on the hero\'s save before the reels move, and a relaunch hands it over',()=>{
 const c=machine(hero('A'));c.at(3);
 c.spin(100,true);
 assert.deepEqual(c.disk().seaBonusPending,{betIx:3},'saved with the stake, before the reels stop');
 c.wait(3500);assert.equal(c.v('seaSpinning'),true);
 const relaunched=machine(JSON.parse(JSON.stringify(c.disk())));
 assert.equal(relaunched.v('seaFree'),10);assert.equal(relaunched.v('seaBet'),2000);assert.equal(relaunched.S.seaBonusPending,undefined);
 c.play();if(c.box())c.$('seaBuyNo').onclick();c.play();
 assert.equal(c.S.seaFree,10,'played out, it is granted once');assert.equal(c.S.seaBonusPending,undefined);
 /* the fanfare only for spins really granted: a round whose record was handed out already announces nothing */
 const b=machine(hero('B'));b.at(0);b.force=0;b.rolls.unshift(0);b.run('spinSea()');
 delete b.S.seaBonusPending;b.play();
 assert.equal(b.S.seaFree,undefined);assert.ok(!b.texts.some(t=>/BONUS/.test(t)),'no 🎁 BONUS for spins that are not coming');
 assert.equal(b.$('seaRes').textContent,'The sea is quiet…');
});

test('scraps come by the stake on paid spins only, and the result line shows them - or a full pouch',()=>{
 const got=[];
 for(const ix of [0,1,2,3]){
  const c=machine(hero('S'+ix));c.at(ix);
  c.spin(2);c.play();c.$('seaBuyNo').onclick();c.play();const once=c.S.scraps;
  c.spin(2);c.play();c.rolls.push(0.1);c.$('seaBuyYes').onclick();c.play();c.$('seaBuyNo').onclick();c.play();
  got.push([once,c.S.scraps-once]);
 }
 assert.deepEqual(got,[[1,2],[3,6],[6,12],[12,24]],'1/3/6/12 at 100/500/1,000/2,000, doubled at 4x');
 const f=machine(hero('F',1000000,{seaFree:3,seaFreeBetIx:3}));f.spin(2);f.play();
 assert.equal(f.S.scraps,0,'no scraps on a free spin');
 const p=machine(hero('P',1000000,{scraps:800}));p.at(0);p.spin(2);p.play();p.$('seaBuyNo').onclick();p.play();
 assert.match(p.$('seaRes').textContent,/^Winner! 200◉ · x2 · scrap pouch full$/);
 assert.ok(p.logs.some(l=>/scrap pouch full \(800\)/.test(l)));
 const q=machine(hero('Q'));q.at(2);q.spin(2);q.play();q.$('seaBuyNo').onclick();q.play();
 assert.match(q.$('seaRes').textContent,/ · \+6⚙$/);
});

test('less than the stake back is a quiet return: no Winner!, no lock and respin, no fanfare',()=>{
 const c=machine(hero('A'));c.at(0);
 for(const m of [0.1,0.2,0.5]){c.texts.length=0;c.sounds.length=0;c.spin(m);c.play();
  assert.deepEqual(c.texts.filter(t=>t.trim()),['Returned '+Math.round(m*100)+'◉ · x'+m]);
  assert.deepEqual(c.sounds,[]);
 }
 assert.equal(c.$('seaRes').style.color,'#8fa898');
});

test('the reels show what is paid: every win reaches reel 3, 10x+ reel 4, no second line, no fake bonus, no xN but a real x2',()=>{
 const c=machine(hero('A',1e12),7),R=mulberry(99);
 const COL=['skull','epic','rare','fine'],runOf=(g,k)=>{let r=0;while(r<4&&g[r].some(x=>x.k===k))r++;return r;};
 const bad=[],why=(ok,msg)=>{if(!ok&&bad.length<5)bad.push(msg);};
 const pairOther=g=>COL.some(k=>k!==g._bk&&g[0].some(x=>x.k===k)&&g[1].some(x=>x.k===k));
 const fake=g=>!g._bonus&&[0,1,2].every(i=>g[i].some(x=>x.k==='bonus'));
 const boxes=g=>[0,1,2].every(i=>g[i].some(x=>x.k==='bonus'));
 const script=c.seaScript;c.seaScript=g=>{
  why(!pairOther(g),'stop: second pair');why(!fake(g),'stop: fake bonus');why(!g._bonus||boxes(g),'stop: bonus without boxes');
  why(!(g._steps>0&&[2,3].some(i=>g[i].some(x=>x.k===g._bk))),'stop: the colour past reel 2 before the respins');
  why(!g._bk||(g[0].some(x=>x.k===g._bk)&&g[1].some(x=>x.k===g._bk)),'stop: a win without its pair on reels 1-2');
  why(!g.flat().some(x=>x.m>1),'stop: xN');return script(g);};
 const step=c.seaScriptStep;c.seaScriptStep=(g,left)=>{const n0=g.flat().filter(x=>x.lock&&x.k===g._bk).length;step(g,left);
  why(g.flat().filter(x=>x.lock&&x.k===g._bk).length>n0,'respin: nothing new connected');
  why(!pairOther(g),'respin: second pair');why(!fake(g),'respin: fake bonus');why(!g._bonus||boxes(g),'respin: a box rolled away');
  why(!(g._steps===1&&g[3].some(x=>x.k===g._bk)),'respin: a <10x win on reel 4');};
 const pay=c.seaPayout;c.seaPayout=g=>{
  if(!g._paid&&g._bk){const run=runOf(g,g._bk);
   if(g._steps>=1)why(run>=3,'paid before reel 3 ('+g._mult+'x)');
   if(g._steps>=2)why(run===4,'10x+ paid before reel 4');
   if(g._steps===1)why(run===3,'<10x reached reel 4');
   why(g.flat().filter(x=>x.m>1).length===(g._hits||0)&&g.flat().every(x=>x.m===1||x.m===2),'badges other than one x2 per hit');
   why(g._target===Math.round(g._mult*g._bet)*2**(g._hits||0),'paid other than table x 2^hits');}
  if(!g._paid){why(!pairOther(g),'payout: second pair');why(!fake(g),'payout: fake bonus');why(!g._bonus||boxes(g),'payout: bonus boxes gone');}
  return pay(g);};
 let wins=0,respins=0,bonus=0,hits=0;
 for(let i=0;i<4000;i++){
  if(c.v('seaFree')<=0)c.at(Math.floor(R()*4));
  if(c.v('seaFree')<=0&&R()<0.02)c.$('seaBonusBuyBtn').onclick();else c.$('seaSpinBtn').onclick();
  for(let k=0;k<4000&&!c.idle();k++){
   if(c.box()){const g=c.grid;if(R()<0.5){const r=R();c.rolls.push(r);if(r<0.5){g._hits=(g._hits||0)+1;hits++;}c.$('seaBuyYes').onclick();}else c.$('seaBuyNo').onclick();continue;}
   c.advance(250);c.frame();
  }
  const g=c.grid;if(g&&g._bk)wins++;if(g&&g._steps)respins++;if(g&&g._bonus)bonus++;
 }
 assert.deepEqual(bad,[]);
 assert.ok(wins>1000&&respins>300&&bonus>50&&hits>20,JSON.stringify({wins,respins,bonus,hits}));
 /* a 🎁 never lands on the only cell of the line: a reel of colours used to lose it (1 round in ~30,000) */
 const cell=k=>({k,icon:'x',cc:'#fff',m:1}),g=[[cell('epic'),cell('rare'),cell('fine')],[],[],[]];g._bk='rare';
 for(let i=0;i<200;i++)assert.notEqual(c.run('seaBoxSpot')(g,0),1);
 g[0]=[cell('rare'),cell('rare'),cell('rare')];for(let i=0;i<20;i++)assert.ok(c.run('seaBoxSpot')(g,0)<3,'a reel that is all line gives one up and keeps the rest');
});

test('Close says why it waits, Auto keeps the session line, Auto on free spins ends with them, and the winning cells light up',()=>{
 const c=machine(hero('A'));c.at(0);
 for(let i=0;i<3;i++){c.spin(0);c.play();}
 const line=c.$('seaStats').textContent;assert.match(line,/^Session: 3 spins/);
 c.force=0;c.rolls.push(0.999);c.$('seaAutoBtn').onclick();c.$('seaAutoBtn').onclick();c.play();
 assert.match(c.$('seaStats').textContent,/^Session: 4 spins/,'Auto used to wipe the running tally');
 c.spin(0);c.$('seaClose').onclick();
 assert.equal(c.$('seaFx').classList.contains('open'),true);assert.deepEqual(c.msgs.slice(-1),['Wait for the reels to stop']);
 c.play();c.$('seaClose').onclick();assert.equal(c.$('seaFx').classList.contains('open'),false);
 /* with Auto running, a Close refused mid-spin stops Auto, so the next Close closes - Auto used to spin on and refuse every time */
 const a=machine(hero('U'));a.at(0);a.seaRollOutcome=()=>0;a.$('seaAutoBtn').onclick();a.wait(5000);
 if(!a.v('seaSpinning'))a.wait(900);
 assert.equal(a.v('seaSpinning'),true);a.$('seaClose').onclick();
 assert.equal(a.v('seaAuto'),false);assert.deepEqual(a.msgs.slice(-1),['Auto stopped - wait for the reels']);
 assert.equal(a.$('seaFx').classList.contains('open'),true);
 a.play();a.wait(3000);a.$('seaClose').onclick();assert.equal(a.$('seaFx').classList.contains('open'),false);
 const f=machine(hero('F',1000000,{seaFree:3,seaFreeBetIx:0}));f.seaRollOutcome=()=>0;
 const g0=total(f);f.$('seaAutoBtn').onclick();f.wait(30000);
 assert.equal(f.v('seaAuto'),false);assert.equal(total(f),g0,'no paid spin after the free ones');
 assert.deepEqual(f.msgs.slice(-1),['Free spins over - Auto stopped']);
 /* out of gold says it the same way */
 const o=machine(hero('O',250));o.at(0);o.seaRollOutcome=()=>0;o.$('seaAutoBtn').onclick();o.wait(20000);
 assert.equal(o.v('seaAuto'),false);assert.equal(o.S.gold,50);assert.equal(o.$('seaRes').textContent,'Out of gold - Auto stopped');
 const payout=section('function seaPayout(grid){','\nfunction clearSeaCelebration(');
 assert.match(payout,/seaMark\(grid,grid\._bk,seaRunOf\(grid,grid\._bk\)\)/);
 assert.ok(!/function seaBest\(|function seaNext\(/.test(SLOTS),'the dead highlight helpers are gone');
});

test('Auto pressed while a bonus is on its way runs the free spins and stops with them - bought, or once the third box has landed',()=>{
 /* buy, then Auto 0.3 s into the bought spin: 10 free spins, not one paid spin after them (it went on at 2,000 a spin) */
 const autoAfter=(gold,setup,ms)=>{
  const c=machine(hero('A',gold),3);c.at(3);c.seaRollOutcome=()=>0;
  let paid=0,free=0;const sp=c.spinSea;c.spinSea=()=>{const f=(c.S.seaFree|0)>0,s0=c.v('seaSpinning');sp();if(!s0&&c.v('seaSpinning')){if(f)free++;else paid++;}};
  setup(c);const g1=total(c);c.wait(ms);c.$('seaAutoBtn').onclick();const on=c.v('seaAuto');c.wait(120000);
  return {on,free,paid,after:total(c)-g1,auto:c.v('seaAuto'),msg:c.msgs.slice(-1)[0],c};
 };
 const buy=c=>c.$('seaBonusBuyBtn').onclick();
 let r=autoAfter(1e6,buy,300);
 assert.deepEqual([r.on,r.free,r.paid-1,r.after,r.auto,r.msg],[true,10,0,0,false,'Free spins over - Auto stopped']);
 /* a buy that took the last gold still gets its Auto: 10 free spins are coming */
 r=autoAfter(50000,buy,300);
 assert.deepEqual([r.on,r.free,r.paid-1,r.c.S.gold,r.auto],[true,10,0,0,false]);assert.ok(!r.c.msgs.includes('Not enough gold to start auto-spin'));
 /* a natural bonus: once the third box has landed, Auto is Auto for the free spins... */
 const natural=c=>{c.rolls.unshift(0);c.run('spinSea()');};
 r=autoAfter(1e6,natural,2200);
 assert.deepEqual([r.free,r.paid-1,r.auto,r.msg],[10,0,false,'Free spins over - Auto stopped']);
 /* ...before it, the player pressed Auto on a paid spin, and it stays Auto for paid spins */
 r=autoAfter(1e6,natural,300);
 assert.ok(r.free>=10);assert.ok(r.paid-1>0&&r.auto,'paid Auto runs on');
});

test('the pad follows the Extra Spin box: the highlight lands on NO, and an answer takes it off the hidden buttons',()=>{
 const p=machine(hero('P'));p.at(0);p.padFocus=p.$('seaSpinBtn'); /* a pad player pressed A on Spin */
 p.spin(100);p.play();assert.equal(p.box(),true);assert.equal(p.padFocus,p.$('seaBuyNo'),'A keeps the win');
 p.padFocus=p.$('seaBuyYes');p.rolls.push(0.2);p.$('seaBuyYes').onclick();
 assert.equal(p.padFocus,p.$('seaSpinBtn'),'A pressed the hidden YES again and again, and nothing answered until the d-pad moved');
 p.play();assert.equal(p.box(),true);assert.equal(p.padFocus,p.$('seaBuyNo'),'the box is back after the hit: NO again');
 p.$('seaBuyNo').onclick();assert.equal(p.padFocus,p.$('seaSpinBtn'));p.play();
 p.spin(10);p.play();assert.equal(p.box(),true);p.wait(10500);assert.equal(p.box(),false);assert.equal(p.padFocus,p.$('seaSpinBtn'),'the 10 s NO too');
 const m=machine(hero('M'));m.at(0);m.spin(100);m.play();assert.equal(m.box(),true);assert.equal(m.padFocus,null,'no pad in use: no highlight');
 m.$('seaBuyNo').onclick();assert.equal(m.padFocus,null);
});

test('no hero behind the machine (logout, kick): nothing throws, a round in the air ends, and Close always closes',()=>{
 const c=machine(hero('A'));c.at(3);c.S=null;
 for(const id of ['seaSpinBtn','seaAutoBtn','seaBetUp','seaBetDn','seaBonusBuyBtn','seaBuyYes','seaBuyNo','seaInfoBtn','seaFastBtn'])assert.doesNotThrow(()=>c.$(id).onclick(),id);
 for(const f of ['updateSeaUI()','resumeSeaAuto()','stopSeaAuto()','spinSea()','openSea()'])assert.doesNotThrow(()=>c.run(f),f);
 c.$('seaClose').onclick();assert.equal(c.$('seaFx').classList.contains('open'),false);
 const d=machine(hero('B'));d.at(3);const g0=total(d);d.spin(10);d.wait(1500);const B=d.S;d.S=null;
 assert.doesNotThrow(()=>d.wait(20000));
 assert.equal(d.v('seaSpinning'),false);assert.equal(d.box(),false);assert.equal(total({S:B})-g0,-2000,'nothing lands once the payer is gone');
 d.$('seaClose').onclick();assert.equal(d.$('seaFx').classList.contains('open'),false);
 const e=machine(hero('C'));e.at(3);e.spin(100);e.play();assert.equal(e.box(),true);e.S=null;
 e.$('seaClose').onclick();assert.equal(e.box(),false);assert.equal(e.$('seaFx').classList.contains('open'),false);
});

test('the info panel says what the machine does, once, in plain words - and the box shows its odds',()=>{
 const pay=html.slice(html.indexOf('id="seaPay"'),html.indexOf('</div>',html.indexOf('id="seaPay"')));
 const lines=[...pay.matchAll(/<span>([\s\S]*?)<\/span>\n/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
 assert.equal(new Set(lines).size,lines.length,'no line twice');
 const text=lines.join('\n');
 for(const gone of [/per way/,/scripted/i,/multiply further/,/4 = double/,/RTP target/])assert.doesNotMatch(text,gone);
 const c=machine(hero('A'));
 /* the colour ranges come from the tables */
 const band=m=>m>=50?'skull':m>=5?'epic':m>=1?'rare':'fine',mults=[...c.v('SEA_OUTCOMES'),...c.v('SEA_OUTCOMES_BONUS')].map(([m])=>m).filter(m=>m>0);
 const range=k=>{const v=mults.filter(m=>band(m)===k);return Math.min(...v).toLocaleString('en')+'-'+Math.max(...v).toLocaleString('en')+'x';};
 for(const [k,word] of [['fine','white'],['rare','blue'],['epic','purple'],['skull','🪙']])assert.match(text,new RegExp(word+' '+range(k).replace(/[.]/g,'\\.')),word);
 assert.match(text,/^Pair on reels 1-2: white 0\.1-0\.5x back/m);
 assert.match(text,/^Blue, purple and 🪙 pairs lock and respin to reel 3 - from 10x to reel 4$/m,'what the respins do (steps: 1 below 10x, 2 and up from 10x)');
 assert.match(text,new RegExp('🎁 on reels 1, 2 and 3 = '+c.v('SEA_BONUS_SPINS')+' free spins at that stake · Bonus buys them: '+c.v('SEA_BONUSBUY_X')+'x'));
 assert.match(text,/Extra Spin: pay half your win, 50% to double it/);
 const bets=c.v('SEA_BETS'),scraps=bets.map(b=>Math.max(1,Math.round(6*b/1000)));
 assert.match(text,new RegExp(scraps.join(' / ')+'⚙ at '+bets.map(b=>b.toLocaleString('en')).join(' / ')+'◉, x2 at 4x'));
 assert.equal(Math.max(...c.v('SEA_OUTCOMES').map(([m])=>m)),20000);
 assert.match(text,/MAX WIN 20,000x · RTP 96%/);
 assert.ok(lines.length<=5,'five lines: the panel may not push the machine past a 1500x1000 window further than the old one did');
 assert.match(html,/<div id="seaBuyOdds"[^>]*>50% to double your win<\/div>/);
 assert.doesNotMatch(text,/[åäöÅÄÖ]/);
});

/* ---------------- round 2 (refix-sea's finding, the session line) ---------------- */
test('keyboard focus follows the Extra Spin box: NO when it asks, Spin once Spin is live again - it dropped to the page and Enter did nothing',()=>{
 const c=machine(hero('K'));c.at(0);const on=()=>c.doc.activeElement&&c.doc.activeElement.id;
 assert.equal(on(),'seaSpinBtn','the machine opens on Spin');
 c.force=10;c.rolls.unshift(0.999);c.$('seaSpinBtn').onclick();     /* Enter on Spin: Spin goes dead under the key */
 assert.equal(on(),'body');
 c.play();assert.equal(c.box(),true);assert.equal(on(),'seaBuyNo','the box asks: the keyboard is on NO, as the pad is');
 c.$('seaBuyNo').onclick();                                          /* Enter on NO: the box hides under it */
 c.play();assert.equal(c.box(),false);assert.equal(on(),'seaSpinBtn','NO answered: back on Spin, which is live');
 assert.equal(c.$('seaSpinBtn').disabled,false);
 /* YES, and a miss: Spin once the round is over (here the cells have no pictures to roll, so it is over at once) */
 c.force=10;c.rolls.unshift(0.999);c.$('seaSpinBtn').onclick();c.play();assert.equal(on(),'seaBuyNo');
 c.$('seaBuyYes').focus();c.rolls.push(0.9);c.$('seaBuyYes').onclick();
 c.play();assert.equal(c.box(),false);assert.match(c.$('seaRes').textContent,/^No connection/);assert.equal(on(),'seaSpinBtn');
 /* YES, and a hit: the box asks again - NO again */
 c.force=10;c.rolls.unshift(0.999);c.$('seaSpinBtn').onclick();c.play();
 c.$('seaBuyYes').focus();c.rolls.push(0.1);c.$('seaBuyYes').onclick();c.play();
 assert.equal(c.box(),true);assert.equal(on(),'seaBuyNo');
 /* a player who went elsewhere keeps it: Close stays where the keyboard put it */
 c.$('seaClose').focus();c.$('seaBuyNo').onclick();c.play();
 assert.equal(c.box(),false);assert.equal(on(),'seaClose');
 /* the casino menu hides under its pick as the machine opens: Spin takes the focus that was lost; focus still on something
    rendered stays where it is */
 const m=machine(hero('M'));
 m.doc.activeElement={id:'casinoPick',getClientRects:()=>[]};m.run('openSea()');assert.equal(m.doc.activeElement.id,'seaSpinBtn');
 m.doc.activeElement={id:'elsewhere',getClientRects:()=>[{}]};m.run('openSea()');assert.equal(m.doc.activeElement.id,'elsewhere');
});

test('the session line counts one spin as "1 spin", like the Blackjack table\'s "1 hand"',()=>{
 const c=machine(hero('A'));c.at(0);
 c.spin(0);c.play();assert.match(c.$('seaStats').textContent,/^Session: 1 spin · /);
 c.spin(0);c.play();assert.match(c.$('seaStats').textContent,/^Session: 2 spins · /);
});

/* ---------------- round 2, second pass (the review's must-fix: a held Enter) ---------------- */
/* a held Enter as Chromium sends it: one keydown, then after half a second a repeat every 33 ms. A keydown on a button passes
   #seaFx's listeners on its way up and, unless one cancels it, clicks that button; on the page (focus dropped) it clicks nothing */
const holdEnter=(c,ms,{spent=false,until=()=>false}={})=>{
 const clicks=[];let t=0,repeat=spent; /* spent: the first press went to something else (the casino menu's pick) */
 while(t<=ms&&!until()){
  const a=c.doc.activeElement;
  if(a&&a!==c.doc.body){
   let cancelled=false;(c.$('seaFx').listeners.keydown||[]).forEach(fn=>fn({key:'Enter',repeat,preventDefault(){cancelled=true;}}));
   if(!cancelled&&!a.disabled&&a.onclick){clicks.push(a.id);a.onclick();}
  }
  const step=repeat?33:500;repeat=true;c.advance(step);c.frame();t+=step;
 }
 return clicks;
};
test('a held Enter presses once: focus follows the play back to Spin and NO, so the machine cancels the repeats - they spun paid spin after spin and answered the box unseen',()=>{
 const c=machine(hero('H'));c.at(0);
 const fx=c.$('seaFx'),on=()=>c.doc.activeElement&&c.doc.activeElement.id;
 assert.equal(fx.onkeydown,undefined,'a listener, as at the Blackjack table - not an onkeydown another handler could replace');
 assert.equal(fx.listeners.keydown.length,1);
 let prevented=0;const key=(repeat,k='Enter')=>fx.listeners.keydown.forEach(fn=>fn({key:k,repeat,preventDefault(){prevented++;}}));
 key(false);assert.equal(prevented,0,'a press goes through');
 key(true);assert.equal(prevented,1,'its repeat is cancelled before it clicks');
 key(true,' ');key(true,'a');assert.equal(prevented,1,'only Enter');
 /* 8 s held on Spin, losing spins only: one spin, one stake - it was four */
 c.seaRollOutcome=()=>0;c.Math.random=()=>0.999;
 assert.equal(on(),'seaSpinBtn');const g0=total(c);
 assert.deepEqual(holdEnter(c,8000),['seaSpinBtn']);
 c.play();assert.equal(c.v('seaSession.spins'),1);assert.equal(total(c)-g0,-100);
 assert.equal(on(),'seaSpinBtn','and Spin has the keyboard again, for the next press');
 /* held over a winning spin and on for 3 s of the box: it asks with NO focused, the repeats leave it be, and it waits for its
    countdown - a repeat answered it NO within 50 ms, and the player never saw the offer */
 c.seaRollOutcome=()=>10;let boxAt=0;
 assert.deepEqual(holdEnter(c,30000,{until:()=>{if(c.box()&&!boxAt)boxAt=c.now;return boxAt&&c.now-boxAt>=3000;}}),['seaSpinBtn']);
 assert.equal(c.box(),true,'the offer is still there when the key comes up');assert.equal(on(),'seaBuyNo');
 assert.equal(c.$('seaBuyNo').textContent,'NO · 7','its countdown runs');
 c.seaRollOutcome=()=>0;c.wait(8000);
 assert.equal(c.box(),false,'answered NO by its countdown');assert.equal(c.v('seaSession.spins'),2);
 /* the casino menu took the press and hid under its pick: the machine opens on Spin, and the rest of the hold spins nothing */
 const m=machine(hero('M'));m.at(0);m.seaRollOutcome=()=>0;m.Math.random=()=>0.999;
 m.doc.activeElement={id:'casinoPick',getClientRects:()=>[]};m.run('openSea()');
 const gm=total(m);assert.deepEqual(holdEnter(m,1500,{spent:true}),[]);
 assert.equal(m.v('seaSession.spins'),0);assert.equal(total(m),gm);assert.equal(m.doc.activeElement.id,'seaSpinBtn');
 /* the source: Blackjack's guard, on the machine */
 assert.match(SLOTS,/\$\('seaFx'\)\.addEventListener\('keydown',e=>\{if\(e\.repeat&&e\.key==='Enter'\)e\.preventDefault\(\);\}\);/);
 assert.doesNotMatch(game,/\$\('seaFx'\)\.onkeydown=/);
});

test('a doubled press is the same press again: Enter or A pressed twice on NO, or on the casino menu\'s pick, pays for no spin - a mouse click is never held back',()=>{
 /* a click from a key or the pad carries detail 0, a mouse click 1 or more */
 const c=machine(hero('D'));c.at(0);c.seaRollOutcome=()=>2;c.Math.random=()=>0.999;const s=()=>c.v('seaSession.spins');
 c.wait(400);c.$('seaSpinBtn').onclick({detail:0});assert.equal(s(),1,'opened a while ago: a key spins at once');
 c.play();assert.equal(c.box(),true,'a 2x win: the box asks');
 /* NO answers the box and leaves Spin focused and live under the key: its second press spun a paid spin */
 c.seaRollOutcome=()=>0;const g0=total(c);
 c.$('seaBuyNo').onclick({detail:0});assert.equal(c.box(),false);assert.equal(c.doc.activeElement.id,'seaSpinBtn');
 c.advance(80);c.$('seaSpinBtn').onclick({detail:0});
 assert.equal(s(),1,'the second press of a doubled Enter spins nothing');assert.equal(total(c),g0);
 c.advance(300);c.$('seaSpinBtn').onclick({detail:0});assert.equal(s(),2,'a press after the bounce is a new one');c.play();
 /* a mouse click is never a doubled key: NO, then Spin at once, spins */
 c.seaRollOutcome=()=>2;c.wait(400);c.$('seaSpinBtn').onclick({detail:1});c.play();assert.equal(c.box(),true);
 c.seaRollOutcome=()=>0;c.$('seaBuyNo').onclick({detail:1});c.$('seaSpinBtn').onclick({detail:1});assert.equal(s(),4);c.play();
 /* the casino menu's pick: one doubled Enter opened the machine and paid for a spin */
 const m=machine(hero('M'));m.at(0);m.seaRollOutcome=()=>0;m.Math.random=()=>0.999;m.wait(1000);
 m.run('openSea()');m.advance(80);const gm=total(m);m.$('seaSpinBtn').onclick({detail:0});
 assert.equal(m.v('seaSession.spins'),0,'opened, and not spun, by one doubled Enter');assert.equal(total(m),gm);
 m.advance(300);m.$('seaSpinBtn').onclick({detail:0});assert.equal(m.v('seaSession.spins'),1);
 assert.match(SLOTS,/\$\('seaSpinBtn'\)\.onclick=e=>\{if\(e&&e\.detail===0&&performance\.now\(\)-seaTurnAt<SEA_BOUNCE_MS\)return;/);
 assert.equal(c.v('SEA_BOUNCE_MS'),350,'as long as Blackjack\'s');
});
