/* The casino's part of the 2026-11-24 bug review: Five Five Five.
 * 1. Free spins won wait on the hero (S.fiveGift) through the fanfare, the Bargain and its wheel. For those seconds Spin, both
 *    buys, Auto and the stake were live: a bonus bought or spun then took the place of the one just won - 500,000 of Hellfire
 *    gone for a click on Ember. A waiting bonus now makes the machine busy, in the guards and on the buttons.
 * 2. "Free spins over - X in all" counted from the machine's own memory, which began again at the hero list or a relaunch.
 * The machine runs for real in a vm: the code between its banner and the bank's, the real gold helpers, a fake DOM, fake timers.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const FIVE=section('/* ==================== 5️⃣ FIVE FIVE FIVE','/* ==================== CASINO BUILDING MENU');
const GOLD=section('const bagSellable=','/* ==================== BANK')+section('function spendGold(n){','/* zero loot');
const mulberry=seed=>{let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};

function machine(S,seed=1){
 const els=new Map(),timers=new Map(),frames=new Map();let serial=0;
 const element=id=>{
  const classes=new Set();
  return {id,disabled:false,style:{setProperty(){},removeProperty(){}},textContent:'',innerHTML:'',children:[],firstElementChild:null,onclick:null,dataset:{},
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),toggle:(n,f)=>{const on=f===undefined?!classes.has(n):f;if(on)classes.add(n);else classes.delete(n);return on;}},
   appendChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({height:60}),getClientRects:()=>[{}],contains:()=>true,focus(){},addEventListener(){}};
 };
 const disks={},rnd=mulberry(seed);
 const c={S,now:1000,rolls:[],msgs:[],logs:[],
  $:id=>{if(!els.has(id))els.set(id,element(id));return els.get(id);},
  document:{createElement:()=>element(),activeElement:null,body:null},performance:{now:()=>c.now},
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:c.now+(ms||0)});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},
  save:()=>{if(c.S)disks[c.S.id]=JSON.parse(JSON.stringify(c.S));},renderHUD(){},
  stageMsg:m=>c.msgs.push(m),log:m=>c.logs.push(String(m).replace(/<[^>]+>/g,'')),casinoAmbApply(){},blip(){},noiseHit(){},noiseSweep(){},dingDingDing(){},
  sfx:{buy(){},warn(){},loot(){}},isLegendary:()=>false,inGearSet:()=>false,scrapVal:()=>1,padFocus:null,padMark(){},
  SCRAP_CAP:800,goldCap:()=>1e15};
 c.Math=Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():rnd()});
 vm.createContext(c);
 vm.runInContext(GOLD,c);vm.runInContext(FIVE,c);
 c.v=code=>vm.runInContext(code,c);c.disk=()=>disks[c.S.id];
 c.advance=ms=>{const end=c.now+ms;for(let n=0;n<10000;n++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);c.now=next[1].at;next[1].fn();}c.now=end;};
 c.frame=()=>{const p=[...frames.values()];frames.clear();p.forEach(fn=>fn(c.now));};
 c.step=ms=>{for(let t=0;t<ms;t+=50){c.advance(50);c.frame();}};
 c.deal=()=>c.$('fiveDealFx').style.display==='flex';
 c.land=()=>{for(let i=0;i<4000&&c.v('fiveSpinning');i++){c.advance(50);c.frame();}};   /* the spin in the air lands - and nothing after it has run yet */
 c.settle=keep=>{for(let i=0;i<4000;i++){c.advance(50);c.frame();if(keep&&c.deal())c.press('fiveDealNo');if(!c.v('fiveSpinning')&&!c.v('fiveCelebrating')&&!c.deal()&&![...timers.values()].length)break;}};
 c.press=id=>c.$(id).onclick({detail:1});   /* the handler itself, whatever the button's disabled flag says: the guard has to hold on its own */
 c.next=o=>{const real=c.fiveRoll;c.fiveRoll=mode=>{c.fiveRoll=real;return o;};};
 c.v('openFive()');
 return c;
}
const hero=(id,gold=5000000,extra={})=>Object.assign({id,gold,overflow:0,prestige:20,bag:[],scraps:0},extra);
const total=c=>c.S.gold+(c.S.overflow||0);
const grid=k=>[0,1,2,3,4].map(()=>[0,1,2,3].map(()=>({k})));
const out=(x,extra={})=>Object.assign({grid:grid('bones'),wheels:[],wins:[],L:0,A:0,M:1,n5:0,max:false,x},extra);
const LIVE=['fiveSpinBtn','fiveBuy1','fiveBuy2','fiveAutoBtn','fiveBetUp','fiveBetDn'];
const shut=(c,why)=>{for(const id of LIVE)assert.equal(c.$(id).disabled,true,id+' is shut '+why);};
/* every way in, pressed past the disabled flag: no gold moves, the bonus stays as it was, nothing starts */
const hammer=(c,why)=>{
 const g=total(c),gift=JSON.stringify(c.S.fiveGift),ix=c.v('fiveBetIx');
 for(const id of ['fiveBuy1','fiveBuy2','fiveSpinBtn','fiveBetUp','fiveBetDn','fiveAutoBtn']){
  c.press(id);
  assert.equal(total(c),g,id+' takes no gold '+why);
  assert.equal(JSON.stringify(c.S.fiveGift),gift,id+' leaves the bonus alone '+why);
  assert.equal(c.v('fiveSpinning'),false,id+' starts no spin '+why);
  assert.equal(c.v('fiveAuto'),false,id+' starts no Auto '+why);
  assert.equal(c.v('fiveBetIx'),ix,id+' moves no stake '+why);
 }
 assert.equal(JSON.stringify(c.disk().fiveGift),gift,'the save holds the same bonus '+why);
};

test('a bonus bought in the fanfare of the one just won is refused: 500,000 of Hellfire is not swapped for Ember',()=>{
 const c=machine(hero('A'));const g0=total(c);
 for(let i=0;i<3;i++)c.press('fiveBetUp');   /* the 2,000 stake */
 c.press('fiveBuy2');assert.equal(g0-total(c),500000);
 c.land();
 assert.deepEqual(JSON.parse(JSON.stringify(c.S.fiveGift)),{tier:2,spins:10,betIx:3},'the Hellfire spins wait on the hero');
 assert.equal(c.v('fiveSpinning')||c.v('fiveCelebrating')||c.deal(),false,'the fanfare: nothing spins, nothing asks');
 shut(c,'in the fanfare');
 c.step(1000);
 hammer(c,'in the fanfare');
 assert.equal(g0-total(c),500000,'Ember was not sold over it');
 c.settle(true);
 assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,2,'ten Hellfire spins, as paid for');assert.equal(c.S.fiveGift,undefined);
 assert.equal(c.$('fiveSpinBtn').disabled,false,'handed over: Spin is live again');
 assert.match(c.$('fiveSpinBtn').textContent,/FREE SPIN · 10 left/);
});

test('a natural bonus: Spin in its fanfare charges no paid spin, and the free spins come as won',()=>{
 const c=machine(hero('B'));const g0=total(c);
 const five=c.v('FIVE_BLUE.findIndex(s=>s[0]==="five")');
 const o=out(0,{n5:1,wheels:[{r:0,y:0,red:false,i:five,kind:'five',v:0}]});o.grid[0][0]={k:'five',red:false};
 c.next(o);c.press('fiveSpinBtn');c.land();
 assert.equal(g0-total(c),100);assert.ok(c.S.fiveGift,'the bonus waits');
 shut(c,'in the fanfare');
 c.step(300);hammer(c,'in the fanfare');
 c.settle(true);
 assert.equal(g0-total(c),100,'one stake, the one that won it');
 assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,1);
});

test('the Bargain taken: while its wheel turns the bonus still waits, and the buttons are shut by that - not by what the box left on them',()=>{
 const c=machine(hero('C'));const g0=total(c);
 c.press('fiveBuy1');
 for(let i=0;i<4000&&!c.deal();i++){c.advance(50);c.frame();}
 assert.ok(c.deal(),'the Bargain asks');
 for(const id of LIVE)c.$(id).disabled=false;   /* whatever the box left on the buttons is wiped: YES has to shut them itself */
 c.rolls.push(0.999);   /* the last slice: the 5 that raises the fire */
 c.press('fiveDealYes');
 assert.equal(c.deal(),false);assert.deepEqual(JSON.parse(JSON.stringify(c.S.fiveGift)),{tier:2,spins:10,betIx:0},'drawn and on the hero before the wheel turns');
 shut(c,'while the wheel turns');
 c.step(500);hammer(c,'while the wheel turns');
 c.settle(true);
 assert.equal(g0-total(c),10000,'the one Ember buy');
 assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,2,'the raise is kept');
});

test('a running Auto can still be stopped in the fanfare - and a stopped one is not started there',()=>{
 const c=machine(hero('D'));
 const five=c.v('FIVE_BLUE.findIndex(s=>s[0]==="five")');
 const o=out(0,{n5:1,wheels:[{r:0,y:0,red:false,i:five,kind:'five',v:0}]});o.grid[0][0]={k:'five',red:false};
 c.next(o);c.press('fiveAutoBtn');assert.equal(c.v('fiveAuto'),true);
 c.land();
 assert.ok(c.S.fiveGift);assert.equal(c.$('fiveAutoBtn').disabled,false,'Stop stays live');
 c.press('fiveAutoBtn');assert.equal(c.v('fiveAuto'),false,'stopped');
 assert.equal(c.$('fiveAutoBtn').disabled,true,'and not to be started over a waiting bonus');
 c.press('fiveAutoBtn');assert.equal(c.v('fiveAuto'),false);
 c.settle(true);
 assert.equal(c.S.fiveFree,10,'the bonus is handed over all the same');
});

test('a bonus left waiting in a save from before the fix is handed over when the machine opens - it locks nothing',()=>{
 const c=machine(hero('E',5000000,{fiveGift:{tier:2,spins:10,betIx:1},fivePay:700}));
 assert.equal(c.S.fiveGift,undefined);assert.equal(c.S.fiveFree,10);assert.equal(c.S.fiveTier,2);assert.equal(c.S.fiveFreeBetIx,1);
 assert.equal(total(c),5000700,'and the win left in the air with it');
 assert.equal(c.$('fiveSpinBtn').disabled,false);assert.match(c.$('fiveSpinBtn').textContent,/FREE SPIN · 10 left/);
 /* ...and one closed on the fanfare waits for the next open, as before */
 const d=machine(hero('F'));
 d.press('fiveBuy1');d.land();assert.ok(d.S.fiveGift);
 d.press('fiveClose');assert.equal(d.$('fiveFx').classList.contains('open'),false,'Close is never held by a waiting bonus');
 d.v('openFive()');
 assert.equal(d.S.fiveGift,undefined);assert.equal(d.S.fiveFree,10);assert.equal(d.$('fiveSpinBtn').disabled,false);
 d.settle(true);assert.equal(d.S.fiveFree,10,'the fanfare\'s own clock finds nothing left to hand over twice');
});

test('"Free spins over - X in all" is the bonus as saved: the hero list or a relaunch in the middle no longer cuts it short',()=>{
 const c=machine(hero('G',1000000,{fiveFree:4,fiveTier:1,fiveFreeBetIx:0,fiveRun:0}));const g0=total(c);
 const spin=()=>{c.next(out(5,{wins:[{line:0,k:'bones',n:5,p:3}]}));c.press('fiveSpinBtn');c.settle(true);};
 spin();spin();
 assert.equal(total(c)-g0,1000);assert.equal(c.S.fiveRun,1000);
 c.v('fiveTeardown()');c.v('openFive()');   /* Change Character and back - or the game closed and opened */
 spin();spin();
 assert.equal(total(c)-g0,2000);
 assert.match(c.$('fiveRes').textContent,/^🔥 Free spins over - 2[\s ,.]?000◉ in all · x20$/);
 assert.ok(c.logs.some(l=>/the free spins paid 2[\s ,.]?000 ◉ in all/.test(l)));
 assert.equal(c.S.fiveRun,undefined,'and the count is put away with the bonus');
 /* an unbroken bonus says the same as it always did */
 const d=machine(hero('H',1000000,{fiveFree:2,fiveTier:1,fiveFreeBetIx:0,fiveRun:0}));
 const spinD=()=>{d.next(out(5,{wins:[{line:0,k:'bones',n:5,p:3}]}));d.press('fiveSpinBtn');d.settle(true);};
 spinD();spinD();
 assert.match(d.$('fiveRes').textContent,/^🔥 Free spins over - 1[\s ,.]?000◉ in all · x10$/);
});

test('the seams, by their source: every way into a spin asks whether a bonus waits',()=>{
 assert.match(FIVE,/const fiveGiftWaits=\(\)=>!!\(S&&S\.fiveGift\);/);
 assert.match(FIVE,/function spinFive\(\)\{\n if\(!S\|\|fiveSpinning\|\|fiveCelebrating\|\|fiveDeal\|\|S\.fiveGift\)return;/);
 assert.match(FIVE,/if\(!fiveReady\(\)\|\|fiveSpinning\|\|fiveCelebrating\|\|fiveAuto\|\|fiveFree>0\|\|fiveDeal\|\|fiveGiftWaits\(\)\)return;/,'the buys');
 assert.match(FIVE,/if\(fiveAuto\)\{stopFiveAuto\(\);return;\}\n if\(fiveDealOpen\(\)\|\|fiveGiftWaits\(\)\)return;/,'Auto: Stop first, then the lock');
 assert.equal((FIVE.match(/&&fiveFree<=0&&!fiveDeal&&!fiveGiftWaits\(\)\)\{fiveBetIx/g)||[]).length,2,'both stake arrows');
 assert.match(FIVE,/b\.disabled=fiveSpinning\|\|fiveCelebrating\|\|fiveDealOpen\(\)\|\|fiveGiftWaits\(\)\|\|/,'Spin, on the button');
 assert.match(FIVE,/a\.disabled=fiveDealOpen\(\)\|\|\(!fiveAuto&&fiveGiftWaits\(\)\);/,'Auto, on the button');
 assert.match(FIVE,/const lock=fiveSpinning\|\|fiveAuto\|\|fiveFree>0\|\|fiveDealOpen\(\)\|\|fiveGiftWaits\(\);/,'the stake, on the buttons');
 assert.match(FIVE,/bb\.disabled=fiveSpinning\|\|fiveCelebrating\|\|fiveAuto\|\|fiveFree>0\|\|fiveDealOpen\(\)\|\|fiveGiftWaits\(\)\|\|totalGold\(\)<price;/,'the buys, on the buttons');
 assert.match(FIVE,/const total=\(S\.fiveRun\|0\)\|\|fiveRunGold,/,'the total is read from the save');
 /* the lever in casino-fx.js pulls Lucky 7's Spin only, and only when that button is live */
 const fx=fs.readFileSync(path.join(__dirname,'..','assets','casino','casino-fx.js'),'utf8');
 assert.match(fx,/const b=document\.getElementById\('slotSpinBtn'\);\n\s*if\(b&&!b\.disabled\)\{L\.fired=now\(\);b\.click\(\);/);
 assert.ok(!/getElementById\('five(SpinBtn|Buy1|Buy2|AutoBtn)'\)/.test(fx),'the show presses nothing on Five Five Five');
});
