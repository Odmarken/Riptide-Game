/* Five Five Five (2026-10-11): the third slot machine, Hacksaw Gaming's SixSixSix rules with fives. The return is worked out
 * EXACTLY from the tables in game.js (every line, every 5's place, every wheel combination), then checked against the real
 * fiveRoll; the machine runs for real in a vm - the code between its banner and the bank's, with the real gold helpers, a fake
 * DOM, fake timers and a seeded Math.random - and the menu, the pad and the casino seams are pinned by their source.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const FIVE=section('/* ==================== 5️⃣ FIVE FIVE FIVE','/* ==================== CASINO BUILDING MENU');
const TABLES=section('const FIVE_BETS=','let fiveBetIx=');
const GOLD=section('const bagSellable=','/* ==================== BANK')+section('function spendGold(n){','/* zero loot');
const mulberry=seed=>{let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};
const plain=x=>JSON.parse(JSON.stringify(x));

/* ---------- the exact return ---------- */
function tables(seed=1){const c={Math:Object.assign(Object.create(Math),{random:mulberry(seed)})};vm.createContext(c);vm.runInContext(TABLES+';globalThis.T={FIVE_BETS,FIVE_MAX,FIVE_SPINS,FIVE_BUY,FIVE_LINES,FIVE_PAY,FIVE_W,FIVE_STACK,FIVE_MODES,FIVE_BLUE,FIVE_BLUE_FREE,FIVE_RED,FIVE_DEAL,fiveRoll,fiveBoughtRoll,fiveLinesOf};',c);return c;}
function exactSpin(T,mode){
 const tot=Object.values(T.FIVE_W).reduce((a,b)=>a+b,0),pi={};for(const k in T.FIVE_W)pi[k]=T.FIVE_W[k]/tot;
 const m=T.FIVE_MODES[mode],wheelOf=red=>mode==='base'?T.FIVE_BLUE:red?T.FIVE_RED:T.FIVE_BLUE_FREE;
 /* the line pay, given which rows of reels 1, 3 and 5 hold a 5 (a cell's other symbols keep their odds: the stacks share them) */
 const lineEV=at=>{let ev=0;for(const ln of T.FIVE_LINES)for(const s in T.FIVE_PAY){
  const q=r=>(at[r]===ln[r])?0:pi[s],p=T.FIVE_PAY[s],[a,b,c,d,e]=[0,1,2,3,4].map(q);
  ev+=a*b*c*(1-d)*p[0]+a*b*c*d*(1-e)*p[1]+a*b*c*d*e*p[2];}return ev;};
 /* every combination of the wheels on show: E[M], E[A*M], the chance of MAX, and how many 5s */
 const wheels=cols=>{const o={EM:0,EAM:0,Pmax:0,n5:[0,0,0,0]};const rec=(i,p,A,M,max,n5)=>{
  if(i===cols.length){if(max)o.Pmax+=p;else{o.EM+=p*M;o.EAM+=p*A*M;o.n5[n5]+=p;}return;}
  const W=wheelOf(cols[i]),t=W.reduce((a,s)=>a+s[2],0);
  for(const [k,v,w] of W){const q=p*w/t;if(k==='add')rec(i+1,q,A+v,M,max,n5);else if(k==='mul')rec(i+1,q,A,M*v,max,n5);else if(k==='five')rec(i+1,q,A,M,max,n5+1);else rec(i+1,q,A,M,true,n5);}};
  rec(0,1,0,1,false,0);return o;};
 const opts=()=>{const o=[{row:-1,p:1-m.f}];for(let y=0;y<4;y++){if(m.red<1)o.push({row:y,red:false,p:m.f/4*(1-m.red)});if(m.red>0)o.push({row:y,red:true,p:m.f/4*m.red});}return o;};
 let ev=0;const trig=[0,0,0,0];
 for(const a of opts())for(const b of opts())for(const c of opts()){
  const p=a.p*b.p*c.p,set=[a,b,c],confs=[];
  if(m.guarantee&&!set.some(x=>x.row>=0&&x.red)){for(let k=0;k<3;k++)for(let y=0;y<4;y++)confs.push({set:set.map((x,i)=>i===k?{row:y,red:true}:x),p:p/12});}
  else confs.push({set,p});
  for(const {set:st,p:pp} of confs){
   const at=[-1,-1,-1,-1,-1];st.forEach((x,i)=>{if(x.row>=0)at[[0,2,4][i]]=x.row;});
   const w=wheels(st.filter(x=>x.row>=0).map(x=>!!x.red));
   ev+=pp*(lineEV(at)*w.EM+w.EAM)+pp*w.Pmax*T.FIVE_MAX;
   for(let n=1;n<=3;n++)trig[n]+=pp*w.n5[n];
  }
 }
 return {ev,trig,lines:lineEV([-1,-1,-1,-1,-1])};
}

test('Five Five Five pays back 96.0%, worked out exactly from its tables - and so do both bonus buys, and the Bargain is fair',()=>{
 const T=tables().T,base=exactSpin(T,'base'),per=['t1','t2','t3'].map(m=>exactSpin(T,m).ev);
 const V=[0,...per.map(v=>v*T.FIVE_SPINS)];
 const rtp=base.ev+base.trig[1]*V[1]+base.trig[2]*V[2]+base.trig[3]*V[3];
 assert.ok(Math.abs(rtp-0.96)<0.001,'RTP '+(rtp*100).toFixed(3)+'%');
 assert.ok(Math.abs(V[1]/T.FIVE_BUY[0]-0.96)<0.002,'Ember bought at '+T.FIVE_BUY[0]+'x: '+(V[1]/T.FIVE_BUY[0]*100).toFixed(2)+'%');
 assert.ok(Math.abs(V[2]/T.FIVE_BUY[1]-0.96)<0.002,'Hellfire bought at '+T.FIVE_BUY[1]+'x: '+(V[2]/T.FIVE_BUY[1]*100).toFixed(2)+'%');
 /* the Bargain stakes 10 spins of a fire on 5-20 of it, or 10 of the next: worth exactly what it stakes, both times */
 const dw=T.FIVE_DEAL.reduce((a,d)=>a+d[1],0);
 for(const t of [1,2]){const keep=10*per[t-1],take=T.FIVE_DEAL.reduce((a,[n,w])=>a+w/dw*(n==='up'?10*per[t]:n*per[t-1]),0);
  assert.ok(Math.abs(take/keep-1)<0.003,'the Bargain from tier '+t+': '+(take/keep).toFixed(4));}
 /* the shape: a fifth of the spins pay, a wheel about every 13 spins, a bonus about every 213 */
 assert.ok(base.lines>0.13&&base.lines<0.16,'the lines return '+base.lines.toFixed(3));
 const any=base.trig[1]+base.trig[2]+base.trig[3];assert.ok(1/any>190&&1/any<240,'bonus 1 in '+(1/any).toFixed(0));
 assert.equal(T.FIVE_MAX,15555);assert.deepEqual(plain(T.FIVE_BUY),[100,250]);
});

test('the real fiveRoll draws what the tables say: a 5 only on reels 1, 3 and 5, one a reel, lines from reel 1, and its mean the exact one',()=>{
 const c=tables(7),T=c.T,N=150000;let sum=0,hits=0;
 for(let i=0;i<N;i++){
  const o=T.fiveRoll('base');sum+=o.x;if(o.x>0)hits++;
  for(const r of [1,3])assert.ok(!o.grid[r].some(x=>x.k==='five'),'no 5 on reels 2 and 4');
  for(const r of [0,2,4])assert.ok(o.grid[r].filter(x=>x.k==='five').length<=1,'one 5 a reel');
  assert.equal(o.wheels.length,o.grid.flat().filter(x=>x.k==='five').length,'a wheel for every 5');
  if(i<3000){const {L}=T.fiveLinesOf(o.grid);assert.equal(L,o.L);assert.ok(o.max||Math.abs(o.x-Math.min(T.FIVE_MAX,Math.round((o.L+o.A)*o.M*100)/100))<1e-9);}
 }
 const exact=exactSpin(T,'base').ev;
 assert.ok(Math.abs(sum/N-exact)<0.06,'the base spin returns '+(sum/N).toFixed(4)+' against '+exact.toFixed(4));
 assert.ok(hits/N>0.17&&hits/N<0.24,'hit rate '+(hits/N*100).toFixed(1)+'%');
 /* Inferno: a red wheel on every spin */
 for(let i=0;i<4000;i++)assert.ok(T.fiveRoll('t3').wheels.some(w=>w.red));
 /* a bought spin pays no line and lands one 5 for Ember, two for Hellfire, each on its 5 slice */
 for(let i=0;i<2000;i++)for(const t of [1,2]){
  const o=T.fiveBoughtRoll(t);
  assert.equal(T.fiveLinesOf(o.grid).L,0);assert.equal(o.x,0);assert.equal(o.n5,t);
  assert.equal(o.grid.flat().filter(x=>x.k==='five').length,t);assert.ok(o.wheels.every(w=>T.FIVE_BLUE[w.i][0]==='five'));
 }
});

/* ---------- the machine in a vm ---------- */
function machine(S,seed=1){
 const els=new Map(),timers=new Map(),frames=new Map();let serial=0;
 const doc={activeElement:null,body:null};
 const element=id=>{
  const classes=new Set();let dis=false;
  const e={id,style:{setProperty(){},removeProperty(){}},textContent:'',innerHTML:'',children:[],firstElementChild:null,onclick:null,dataset:{},
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),toggle:(n,f)=>{const on=f===undefined?!classes.has(n):f;if(on)classes.add(n);else classes.delete(n);return on;}},
   appendChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({height:60}),
   getClientRects:()=>/^fiveDeal(Yes|No)$/.test(id)&&c.$('fiveDealFx').style.display!=='flex'?[]:[{}],
   contains:x=>!!x&&x!==doc.body,focus(){if(!dis&&e.getClientRects().length)doc.activeElement=e;},
   listeners:{},addEventListener(t,fn){(e.listeners[t]=e.listeners[t]||[]).push(fn);}};
  Object.defineProperty(e,'disabled',{get:()=>dis,set:v=>{dis=!!v;if(dis&&doc.activeElement===e)doc.activeElement=doc.body;}});
  return e;
 };
 const disks={},rnd=mulberry(seed);
 const c={S,now:1000,rolls:[],saves:0,msgs:[],logs:[],sounds:[],looks:[],
  $:id=>{if(!els.has(id))els.set(id,element(id));return els.get(id);},
  document:{createElement:()=>element(),get activeElement(){return doc.activeElement;},get body(){return doc.body;}},performance:{now:()=>c.now},
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:c.now+(ms||0)});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},
  save:()=>{if(c.S)disks[c.S.id]=JSON.parse(JSON.stringify(c.S));c.saves++;},renderHUD:()=>{if(!c.S)throw new Error('renderHUD with no hero');},
  stageMsg:m=>c.msgs.push(m),log:m=>c.logs.push(String(m).replace(/<[^>]+>/g,'')),casinoAmbApply(){},blip(){},noiseHit(){},noiseSweep(){},dingDingDing:()=>c.sounds.push('ding'),
  sfx:{buy(){},warn:()=>c.sounds.push('warn'),loot:()=>c.sounds.push('loot')},
  isLegendary:()=>false,inGearSet:()=>false,scrapVal:()=>1,padFocus:null,padMark(e){c.padFocus=e||null;},
  GOLD_CAP_BASE:500000,GOLD_CAP_ROOF:2000000,SCRAP_CAP:800,goldCap:()=>1e15};
 c.Math=Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():rnd()});
 doc.body=element('body');doc.activeElement=doc.body;
 vm.createContext(c);
 vm.runInContext(GOLD,c);vm.runInContext(FIVE,c);
 c.run=code=>vm.runInContext(code,c);c.v=c.run;c.disk=id=>disks[id||c.S.id];
 c.advance=ms=>{const end=c.now+ms;for(let n=0;n<10000;n++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);c.now=next[1].at;next[1].fn();}c.now=end;};
 c.frame=()=>{const p=[...frames.values()];frames.clear();p.forEach(fn=>fn(c.now));};
 c.wait=ms=>{const end=c.now+ms;while(c.now<end){c.advance(50);c.frame();}};
 c.deal=()=>c.$('fiveDealFx').style.display==='flex';
 c.idle=()=>!c.v('fiveSpinning')&&!c.v('fiveCelebrating');
 c.play=()=>{for(let i=0;i<4000&&(!c.idle()||c.timersLeft())&&!c.deal();i++){c.advance(100);c.frame();}};
 c.timersLeft=()=>[...timers.values()].some(t=>t.at<=c.now+6000);
 /* force the next roll: the outcome a spin will draw */
 c.next=o=>{const real=c.fiveRoll;c.fiveRoll=mode=>{c.fiveRoll=real;c.mode=mode;return o;};};
 c.run('openFive()');
 return c;
}
const hero=(id,gold=1000000,extra={})=>Object.assign({id,gold,overflow:0,prestige:20,bag:[],scraps:0},extra);
const total=c=>c.S.gold+(c.S.overflow||0);
const grid=k=>[0,1,2,3,4].map(()=>[0,1,2,3].map(()=>({k})));
const out=(x,extra={})=>Object.assign({grid:grid('bones'),wheels:[],wins:[],L:0,A:0,M:1,n5:0,max:false,x},extra);

test('a paid spin is on the record before the reels move, and its win lands when they stop - to the hero who paid',()=>{
 const c=machine(hero('A'));const g0=total(c);
 c.next(out(5,{wins:[{line:0,k:'bones',n:5,p:3}]}));c.$('fiveSpinBtn').onclick({detail:1});
 assert.equal(total(c),g0-100,'the stake is taken');assert.equal(c.S.fivePay,500,'what it pays is on the hero');
 assert.equal(c.disk().fivePay,500,'...and on the save, before anything moves');assert.equal(c.disk().gold+(c.disk().overflow||0),g0-100);
 c.play();
 assert.equal(total(c),g0-100+500);assert.equal(c.S.fivePay,undefined);assert.equal(c.disk().fivePay,undefined);
 assert.match(c.$('fiveRes').textContent,/^Win - 500◉ · x5$/);
 assert.match(c.$('fiveStats').textContent,/^Session: 1 spin · \+400◉$/);
 /* a hero change while it turns: the next hero is paid nothing; the payer's win waits on the payer */
 const d=machine(hero('A'));const A=d.S,a0=total(d);
 d.next(out(10));d.$('fiveSpinBtn').onclick({detail:1});
 d.S=hero('B',5000);d.play();
 assert.equal(total(d),5000,'B gets nothing');assert.equal(A.fivePay,1000,'A is owed it still');
 d.S=A;d.run('openFive()');assert.equal(total(d),a0-100+1000,'and is paid at the next open');assert.equal(A.fivePay,undefined);
});

test('free spins: the trigger goes on the record at once; the Bargain asks, KEEP gives 10 spins of that fire, and they cost nothing',()=>{
 const c=machine(hero('A'));const g0=total(c);
 c.next(out(0,{n5:1,wheels:[{r:0,y:1,red:false,i:9,kind:'five',v:0}]}));c.$('fiveSpinBtn').onclick({detail:1});
 assert.deepEqual(plain(c.S.fiveGift),{tier:1,spins:10,betIx:0});assert.deepEqual(plain(c.disk().fiveGift),{tier:1,spins:10,betIx:0});
 c.play();assert.equal(c.deal(),true,'the Bargain asks');
 assert.match(c.$('fiveDealTxt').innerHTML,/fair bargain: on average worth exactly what you hold/);
 assert.equal(c.$('fiveSpinBtn').disabled,true,'Spin waits for the answer');
 c.$('fiveDealNo').onclick();assert.equal(c.deal(),false);
 assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,1);assert.equal(c.S.fiveGift,undefined);
 assert.equal(c.$('fiveSpinBtn').textContent,'🔥 FREE SPIN · 10 left');
 assert.equal(c.$('fiveBetUp').disabled,true,'the stake is locked while they run');assert.equal(c.$('fiveBuy1').disabled,true);
 const g1=total(c);c.advance(400);c.next(out(0));c.$('fiveSpinBtn').onclick({detail:1});
 assert.equal(c.mode,'t1','an Ember spin');assert.equal(total(c),g1,'free');assert.equal(c.S.fiveFree,9);assert.equal(c.disk().fiveFree,9);
 c.play();
 assert.equal(g1,g0-100);
});

test('the Bargain is answered once, and its slice is on the record before its wheel turns; a 5 raises the fire',()=>{
 const c=machine(hero('A'));
 c.next(out(0,{n5:1,wheels:[{r:2,y:0,red:false,i:9,kind:'five',v:0}]}));c.$('fiveSpinBtn').onclick({detail:1});c.play();
 assert.equal(c.deal(),true);
 c.rolls.push(0.99);c.$('fiveDealYes').onclick();c.$('fiveDealYes').onclick();c.$('fiveDealNo').onclick(); /* the 5 slice; two more presses find no question */
 assert.deepEqual(plain(c.S.fiveGift),{tier:2,spins:10,betIx:0},'raised to Hellfire, on the hero');assert.deepEqual(plain(c.disk().fiveGift),{tier:2,spins:10,betIx:0},'and on the save');
 c.play();assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,2);
 /* 5 to 20 spins otherwise */
 const d=machine(hero('D'));
 d.next(out(0,{n5:1,wheels:[{r:2,y:0,red:false,i:9,kind:'five',v:0}]}));d.$('fiveSpinBtn').onclick({detail:1});d.play();
 d.rolls.push(0.01);d.$('fiveDealYes').onclick();d.play();assert.equal(d.S.fiveFree,5);assert.equal(d.S.fiveTier,1);
 /* unanswered, it keeps the spins after 10 s; on Auto it is never asked */
 const e=machine(hero('E'));
 e.next(out(0,{n5:1,wheels:[{r:2,y:0,red:false,i:9,kind:'five',v:0}]}));e.$('fiveSpinBtn').onclick({detail:1});e.play();
 assert.equal(e.deal(),true);e.wait(10500);assert.equal(e.deal(),false);assert.equal(e.S.fiveFree,10);
 const f=machine(hero('F'));
 f.next(out(0,{n5:2,wheels:[{r:0,y:0,red:false,i:9,kind:'five',v:0},{r:4,y:3,red:false,i:9,kind:'five',v:0}]}));
 f.$('fiveAutoBtn').onclick();
 for(let i=0;i<400&&!f.S.fiveFree;i++){f.advance(100);f.frame();assert.equal(f.deal(),false,'Auto never gambles');}
 assert.equal(f.S.fiveTier,2,'two 5s: Hellfire');assert.equal(f.S.fiveFree,10);f.$('fiveAutoBtn').onclick();assert.equal(f.v('fiveAuto'),false);
});

test('a game closed mid-spin, or the hero put away, loses nothing: the win and the free spins land on that hero',()=>{
 const c=machine(hero('A'));const g0=total(c);
 c.next(out(20,{n5:1,wheels:[{r:0,y:0,red:false,i:9,kind:'five',v:0}]}));c.$('fiveSpinBtn').onclick({detail:1});c.wait(500);
 c.run('fiveTeardown()');
 assert.equal(total(c),g0-100+2000);assert.equal(c.S.fivePay,undefined);assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveGift,undefined);
 assert.equal(c.v('fiveSpinning'),false);assert.doesNotThrow(()=>{c.wait(8000);});assert.equal(total(c),g0-100+2000,'the stopped round pays nothing twice');
 /* a save written mid-spin, opened again: handed over with a word in the log */
 const d=machine(hero('B',1000,{fivePay:1234,fiveGift:{tier:2,spins:10,betIx:1}}));
 assert.equal(total(d),1000+1234);assert.equal(d.S.fiveFree,10);assert.equal(d.S.fiveTier,2);assert.equal(d.v('fiveBet'),500,'at the stake it was won at');
 assert.ok(d.logs.some(l=>/from the spin left in the air/.test(l)));assert.ok(d.logs.some(l=>/HELLFIRE SPINS - 10 free spins/.test(l)));
 /* no hero at all: nothing throws, Close closes */
 const e=machine(hero('C'));e.S=null;
 for(const id of ['fiveSpinBtn','fiveAutoBtn','fiveBetUp','fiveBetDn','fiveBuy1','fiveBuy2'])assert.doesNotThrow(()=>e.$(id).onclick({detail:1}),id);
 e.$('fiveClose').onclick();assert.equal(e.$('fiveFx').classList.contains('open'),false);
});

test('the bonus buys cost 100x and 250x the stake; the bought spin pays nothing and brings its free spins',()=>{
 const c=machine(hero('A'));c.run('fiveBetIx=1;fiveBet=FIVE_BETS[1];updateFiveUI()');const g0=total(c);
 const num=t=>t.replace(/[\s,.  ]/g,'');   /* the host's own thousands mark */
 assert.equal(num(c.$('fiveBuy1').textContent),'🔥Ember·50000◉');assert.equal(num(c.$('fiveBuy2').textContent),'🔥Hellfire·125000◉');
 c.$('fiveBuy2').onclick();
 assert.equal(total(c),g0-125000);assert.deepEqual(plain(c.S.fiveGift),{tier:2,spins:10,betIx:1});assert.equal(c.S.fivePay,undefined);
 c.play();c.$('fiveDealNo').onclick();assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,2);assert.equal(total(c),g0-125000);
 /* the max win ends a bonus: what is left of 15,555x is all it pays */
 const d=machine(hero('D',100,{fiveFree:5,fiveTier:3,fiveFreeBetIx:0,fiveRun:15555*100-300}));
 d.next(out(50));d.$('fiveSpinBtn').onclick({detail:1});
 assert.equal(d.S.fivePay,300,'only what is left under the max win');assert.equal(d.S.fiveFree,undefined,'and the bonus is over');d.play();
 assert.equal(total(d),400);
});

test('the menu: Slots opens the three machines, Back returns, and the new machine joins every casino seam',()=>{
 const menu=html.slice(html.indexOf('<div id="casinoMenu">'),html.indexOf('id="casinoMenuClose"'));
 const main=menu.slice(menu.indexOf('<div id="casinoMain">'),menu.indexOf('<div id="casinoSlots"')),slots=menu.slice(menu.indexOf('<div id="casinoSlots"'));
 assert.deepEqual([...main.matchAll(/data-game="(\w+)"/g)].map(m=>m[1]),['slotpick','bj','rou','rtb','gvb']);
 assert.deepEqual([...slots.matchAll(/data-game="(\w+)"/g)].map(m=>m[1]),['slots','sea','five']);
 assert.match(slots,/<b>Five Five Five<\/b><i>Fives turn into wheels - win up to 15,555x<\/i>/);assert.match(slots,/id="casinoSlotsBack"/);
 const pick=section("document.querySelectorAll('.casinopick').forEach(b=>b.onclick=()=>{",'\n});');
 assert.match(pick,/if\(g==='slotpick'\)\{casinoMenuPage\(true\);return;\}/);assert.match(pick,/else if\(g==='five'\)openFive\(\);/);
 assert.match(section("$('casinoMenuClose').onclick=",'\n'),/if\(\$\('casinoSlots'\)\.style\.display!=='none'\)\{casinoMenuPage\(false\);return;\}/,'B and Esc go back a page first');
 /* the seams: the pad (the Bargain before its machine), Back, the casino's windows, music, the inert page, the hero list, the teardown */
 const pads=section('const PAD_PANELS=','let padFocus=null;');
 assert.ok(pads.indexOf("'fiveDealFx'")<pads.indexOf("'fiveFx'")&&pads.indexOf("'fiveFx'")<pads.indexOf("'casinoMenu'"));
 assert.match(section('const PAD_BACK=','const PAD_NOBACK'),/fiveFx:'fiveClose',fiveDealFx:'fiveDealNo'/);
 assert.match(section('function casinoWinOpen(chest){','\n}'),/'seaFx','fiveFx'/);
 assert.match(section('function casinoAmbApply(){','\n}'),/'seaFx','fiveFx'/);
 assert.match(section('function casinoRoundOpen(){','\n}'),/fiveSpinning/);
 assert.match(section('function closeCasinoWindows(){','\n}'),/if\(typeof fiveTeardown==='function'\)down\(fiveTeardown\);/);
 assert.match(section('let casinoInert=[];',"$('charSelBtn').onclick="),/'seaFx','fiveFx'/);
 /* a held Enter presses once; a doubled one is the same press */
 assert.match(FIVE,/\$\('fiveFx'\)\.addEventListener\('keydown',e=>\{if\(e\.repeat&&e\.key==='Enter'\)e\.preventDefault\(\);\}\);/);
 assert.match(FIVE,/\$\('fiveSpinBtn'\)\.onclick=e=>\{if\(e&&e\.detail===0&&performance\.now\(\)-fiveTurnAt<FIVE_BOUNCE_MS\)return;/);
});
