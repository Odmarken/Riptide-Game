/* Lucky 7, Roulette and Sebbe's cups after the casino audit of 2026-09-30, pinned so they stay fixed. The three games run
 * for real in a vm (their sections of game.js plus the real gold helpers) on a small fake DOM; the markup and the CSS are
 * pinned by their source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const between=(from,to)=>section(from,to);
const LUCKY7=['/* ==================== SLOT MACHINE ====================','/* ==================== SLOTS - hold & respin slot'];
const ROULETTE=['/* ==================== ROULETTE ====================','/* ==================== 🚌 RIDE THE BUS'];
const CUPS=["/* ==================== 🥤 SEBBE'S CUP GAME",'const RTB_BETS='];

/* one casino floor: a hero, the real gold helpers, the three games, a clock, animation frames and a seeded Math.random
   (c.rolls, when filled, is drawn first) */
function casino(hero={}){
 let seed=20260930;
 const rng=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 const c={now:1000,rolls:[],logs:[],msgs:[],sounds:[],amb:0,S:{gold:0,overflow:0,prestige:0,bag:[],scraps:0,gamblerPots:0,...hero}};
 const nodes=new Map(),timers=new Map(),frames=new Map();let serial=0;
 const pen=new Proxy({},{get:()=>()=>{}}); /* a canvas context that draws nothing */
 let machine=null;
 const element=(id='')=>{
  const classes=new Set();
  return {id,style:{setProperty(k,v){this[k]=v;}},dataset:{},textContent:'',innerHTML:'',disabled:false,width:420,height:420,
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),
    toggle:(n,f)=>{const on=f===undefined?!classes.has(n):!!f;if(on)classes.add(n);else classes.delete(n);return on;}},
   appendChild(){},remove(){},querySelector:()=>machine,querySelectorAll:()=>[],getContext:()=>pen};
 };
 machine=element('machine');
 c.$=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 const cups=[0,1,2].map(i=>{const e=element('cup'+i);e.dataset.cup=String(i);return e;});
 const balls=[0,1,2].map(i=>c.$('cupBall'+i));
 c.$('cupRow').querySelectorAll=sel=>sel==='.cup'?cups:[];
 Object.assign(c,{
  document:{createElement:()=>element(),
   querySelector:sel=>{const m=/data-cup="(\d)"/.exec(sel);return m?cups[+m[1]]:null;},
   querySelectorAll:sel=>sel==='#cupRow .cup'?cups:sel==='#cupRow .cupball'?balls:[]},
  window:{innerWidth:1280},console,
  Math:Object.assign(Object.create(Math),{random:()=>c.rolls.length?c.rolls.shift():rng()}),
  performance:{now:()=>c.now},
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:c.now+(ms||0)});return id;},clearTimeout:id=>{timers.delete(id);},
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},
  save(){},renderHUD(){},stageMsg:m=>{c.msgs.push(m);},log:m=>{c.logs.push(String(m).replace(/<[^>]+>/g,''));},
  blip(){},noiseHit(){},noiseSweep(){},dingDingDing(){},spawnPartsIn(){},initAudio(){},casinoAmbApply:()=>{c.amb++;},
  isLegendary:()=>false,inGearSet:()=>false,scrapVal:()=>1,
  sfx:new Proxy({},{get:(t,k)=>()=>{c.sounds.push(k);}}),
 });
 vm.createContext(c);
 c.run=code=>vm.runInContext(code,c);
 c.run(section('const GOLD_CAP_BASE=','/* ==================== THOR WINDOWS'));
 c.run(section('const bagSellable=','/* ==================== BANK'));
 c.run(section('function spendGold(n){','const RACES='));
 for(const [a,b] of [LUCKY7,ROULETTE,CUPS])c.run(section(a,b));
 c.el=c.$;
 c.advance=ms=>{const end=c.now+ms;for(let guard=0;guard<10000;guard++){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);c.now=next[1].at;next[1].fn();}c.now=end;};
 c.frame=ms=>{c.now+=ms;const due=[...frames.values()];frames.clear();due.forEach(fn=>fn(c.now));};
 c.land=()=>{for(let k=0;k<6&&c.run('slotSpinning||rouSpinning');k++)c.frame(1000);};
 c.pending=()=>timers.size;
 c.framesQueued=()=>frames.size;
 c.open=id=>c.$(id).classList.contains('open');
 return c;
}
const reelSyms=(c,i)=>(c.el('sr'+i).innerHTML.match(/<div class="slotcell">(.*?)<\/div>/g)||[]).map(s=>s.replace(/<[^>]+>/g,''));

test('Lucky 7 pays back 96% in gold: the thresholds are read out of slotOutcome and the return is worked out exactly',()=>{
 const bands=[...between('function slotOutcome(){','\n}').matchAll(/if\(r<([\d.]+)\)(.*)/g)]
  .map(m=>({to:m[1],kind:/kind:'(\w+)'/.exec(m[2])[1],mul:+((/mul:(\d+)/.exec(m[2])||[])[1]||0)}));
 assert.deepEqual(bands.map(b=>[b.to,b.kind,b.mul]),[['0.002','gold',100],['0.038','gold',10],['0.118','gold',5],['0.238','scrap',0]]);
 /* exact, in millionths of a spin: each gold band's width times its multiplier */
 const u=s=>Math.round(parseFloat(s)*1e6);let from=0,back=0,gears=0;
 for(const b of bands){const w=u(b.to)-from;from=u(b.to);if(b.kind==='gold')back+=w*b.mul;else gears+=w;}
 assert.equal(back,960000,'96.0000% of every stake comes back as gold');
 assert.equal(gears,120000,'three gears (scraps) on 12% of spins');
 /* the real function draws what was read: both sides of every threshold */
 const c=casino();let lo=0;
 for(const b of bands){
  const t=parseFloat(b.to);
  for(const r of [lo,(lo+t)/2,t-1e-12]){c.rolls=[r,0];const o=c.slotOutcome();assert.equal(o.kind,b.kind,'r='+r);if(b.mul)assert.equal(o.mul,b.mul,'r='+r);}
  lo=t;
 }
 for(const r of [0.238,0.5,0.999999]){c.rolls=[r];assert.equal(c.slotOutcome().kind,'none','r='+r);}
 /* the scrap prize grows with the bet: 1-2 scraps per bet step, the same scraps per gold at 1x and at 5x */
 for(let bet=1;bet<=5;bet++){
  c.run('slotBet='+bet);
  c.rolls=[0.2,0];assert.equal(c.slotOutcome().n,bet);
  c.rolls=[0.2,0.999];assert.equal(c.slotOutcome().n,2*bet);
 }
 /* the 1-in-500 jackpot still brings the Potion of Gambler */
 const d=casino({gold:100000,prestige:5});d.run('openSlots()');
 d.rolls=[0.001];d.el('slotSpinBtn').onclick();d.land();
 assert.equal(d.S.gamblerPots,1);assert.equal(d.S.gold+d.S.overflow,100000-1000+100000);
});

test('Lucky 7 Auto rolls on with a full vault (prizes overflow), and a scrap prize says what reached the pouch',()=>{
 assert.ok(!/lootBlocked|scrap both full/.test(section(...LUCKY7)),'no vault stop, no false word about scraps');
 const c=casino({gold:500000,overflow:100000});c.run('openSlots()');   /* a P0 vault at its cap, overflow to pay from */
 c.rolls=[0.5];c.el('slotAutoBtn').onclick();
 for(let i=0;i<3;i++){c.land();c.rolls=[0.5];c.advance(800);}
 assert.equal(c.run('slotAuto'),true);assert.equal(c.run('slotSession.spins'),3);
 const d=casino({gold:495000});d.run('openSlots()');
 d.rolls=[0.01];d.el('slotAutoBtn').onclick();d.land();                /* a 10x that fills the vault */
 assert.deepEqual([d.S.gold,d.S.overflow],[500000,4000]);
 d.rolls=[0.5];d.advance(4000+700);
 assert.equal(d.run('slotSpinning'),true,'Auto spins again after the celebration');
 for(const [have,line,after] of [[800,'+0 ⚙ Scraps (pouch full)',800],[797,'+3 ⚙ Scraps (pouch full)',800],[0,'+10 ⚙ Scraps',10]]){
  const e=casino({gold:100000,scraps:have});e.run('openSlots();slotBet=5');
  e.rolls=[0.2,0.9];e.el('slotSpinBtn').onclick();e.land();            /* three gears at 5x: 10 scraps rolled */
  assert.equal(e.el('slotRes').textContent,line);assert.equal(e.S.scraps,after);
 }
});

test('Lucky 7 reels park in % of their own height, the idle face never lines up, and re-opening leaves a landing spin alone',()=>{
 assert.ok(!/window\.innerWidth|px\)`/.test(between('function spinSlots(){','\n}')),'no cell size guessed from the window width, no pixel offsets');
 const c=casino({gold:100000,prestige:5});c.run('openSlots()');
 c.rolls=[0.05];c.el('slotSpinBtn').onclick();c.land();
 for(const i of [0,1,2]){
  const syms=reelSyms(c,i),n=syms.length;
  assert.equal(n,18+i*6);
  assert.equal(c.el('sr'+i).style.transform,`translateY(${-(n-1)/n*100}%)`,'the last of n cells sits in the window at any cell size');
  assert.equal(syms[n-1],'🔔');
 }
 for(let k=0;k<3000;k++){
  c.run('openSlots()');
  const face=[0,1,2].map(i=>reelSyms(c,i));
  assert.ok(face.every(r=>r.length===1)&&!(face[0][0]===face[1][0]&&face[1][0]===face[2][0]),'an idle face that lines up: '+face.join(''));
 }
 /* Auto on, Close while the reels turn (allowed on Auto), back in before they land */
 const d=casino({gold:100000,prestige:5});d.run('openSlots()');
 d.rolls=[0.05];d.el('slotAutoBtn').onclick();d.frame(300);
 d.el('slotClose').onclick();
 assert.equal(d.open('slotFx'),false);assert.equal(d.run('slotAuto'),false);
 d.frame(500);d.run('openSlots()');
 assert.deepEqual([0,1,2].map(i=>reelSyms(d,i).length),[18,24,30],'the turning reels are not rebuilt');
 d.land();
 assert.equal(d.el('sr2').style.transform,`translateY(${-29/30*100}%)`);
 assert.equal(reelSyms(d,2)[29],'🔔');
 assert.match(d.el('slotRes').textContent,/^Winner! 5x/);
 assert.match(d.el('slotStats').textContent,/^Session: 1 spin · /,'the spin that landed belongs to this sitting - one spin, not "1 spins"');
});

test('Lucky 7: switching Auto on keeps the session, a refused Close says why, and with no hero nothing plays and Close still hides',()=>{
 const c=casino({gold:100000});c.run('openSlots()');
 for(let i=0;i<3;i++){c.rolls=[0.5];c.el('slotSpinBtn').onclick();c.land();}
 c.rolls=[0.5];c.el('slotAutoBtn').onclick();c.land();c.el('slotAutoBtn').onclick();
 assert.match(c.el('slotStats').textContent,/^Session: 4 spins/);
 c.rolls=[0.5];c.el('slotSpinBtn').onclick();
 c.el('slotClose').onclick();
 assert.equal(c.open('slotFx'),true);
 assert.equal(c.msgs.at(-1),'The reels are spinning - wait for them to stop');
 c.land();
 /* the account is opened elsewhere: S is gone under an open machine, with Auto on and a spin in the air */
 c.rolls=[0.5];c.el('slotAutoBtn').onclick();
 const payer=c.S,before=payer.gold+payer.overflow;
 c.S=null;
 for(const id of ['slotSpinBtn','slotAutoBtn','slotBetUp','slotBetDn'])assert.doesNotThrow(()=>c.el(id).onclick(),id);
 assert.doesNotThrow(()=>c.run('updateSlotUI();openSlots()'));
 c.el('slotClose').onclick();
 assert.equal(c.open('slotFx'),false,'Close hides the machine with no hero behind it');
 assert.doesNotThrow(()=>{c.land();c.advance(10000);});
 assert.equal(payer.gold+payer.overflow,before,'the spin in the air pays no one');
 assert.equal(c.run('slotSpinning||slotAuto'),false);
});

test('Lucky 7 teardown: the spin in the air never lands, Auto stops, the next hero starts clean; a prize lands only for its payer',()=>{
 const c=casino({gold:100000,prestige:5});c.run('openSlots()');
 c.rolls=[0.001];c.el('slotAutoBtn').onclick();                        /* a jackpot in the air */
 const g=c.S.gold+c.S.overflow;
 c.run('slotTeardown()');
 assert.equal(c.pending(),0);
 c.frame(16);assert.equal(c.framesQueued(),0,'the reel animation stops');
 c.land();c.advance(10000);
 assert.equal(c.S.gold+c.S.overflow,g);assert.equal(c.S.gamblerPots,0);
 assert.equal(c.run('slotAuto||slotSpinning||slotCelebrating'),false);
 assert.equal(c.run('slotSession.spins'),0);assert.equal(c.open('slotFx'),false);
 c.S=null;assert.doesNotThrow(()=>c.run('slotTeardown();slotTeardown()'));
 c.S={gold:50000,overflow:0,prestige:0,bag:[],scraps:0};c.run('openSlots()');
 assert.deepEqual([0,1,2].map(i=>reelSyms(c,i).length),[1,1,1]);assert.equal(c.el('slotStats').textContent,'');
 /* a hero change the teardown never saw: the prize is void and Auto stops */
 const d=casino({gold:100000,prestige:5});d.run('openSlots();slotBet=5');
 d.rolls=[0.01];d.el('slotAutoBtn').onclick();
 const A=d.S,a=A.gold+A.overflow;
 d.S={gold:1000,overflow:0,prestige:0,bag:[],scraps:0,gamblerPots:0};
 d.land();d.advance(10000);d.land();
 assert.equal(d.S.gold,1000);assert.equal(A.gold+A.overflow,a);assert.equal(d.run('slotAuto'),false);
});

test('Roulette announces what a spin gained or lost, with the win sound only for a gain and the loss sound only for a total loss',()=>{
 const spin=(bets,ball)=>{
  const c=casino({gold:1000000,prestige:20});c.run('openRoulette()');
  for(const [k,chip,times] of bets){c.run('rouChipI='+chip);for(let i=0;i<times;i++)c.rouAdd(k);}
  const before=c.S.gold+c.S.overflow;c.sounds.length=0;
  c.rolls=[(ball+0.5)/37,0.5];c.rouSpinNow();c.frame(4300);
  return {line:c.el('rouRes').innerHTML.replace(/<[^>]+>/g,''),log:c.logs.at(-1),sounds:c.sounds.filter(s=>s==='buy'||s==='warn'),net:c.S.gold+c.S.overflow-before};
 };
 const f=n=>n.toLocaleString();
 let r=spin([['n17',2,1],['red',0,1]],3);                              /* 10,000 on 17 and 1,000 on red, the ball on 3 (red) */
 assert.equal(r.net,-9000);assert.equal(r.line,`3 RED - returned ${f(2000)}◉ · lost ${f(9000)}◉`);
 assert.deepEqual(r.sounds,[],'a partial return is quiet, as Slots\' "Returned" is (round 2 - it played the loss sound)');
 assert.equal(r.log,`Roulette: 3 RED - returned ${f(2000)} ◉, lost ${f(9000)} ◉.`);
 r=spin([['red',1,1],['black',1,1]],3);
 assert.equal(r.net,0);assert.equal(r.line,`3 RED - returned ${f(10000)}◉ · broke even`);assert.deepEqual(r.sounds,[]);
 r=spin([['red',1,1]],3);
 assert.equal(r.net,5000);assert.equal(r.line,`3 RED - +${f(5000)}◉`);assert.deepEqual(r.sounds,['buy']);
 r=spin([['n17',0,1]],17);
 assert.equal(r.net,35000);assert.equal(r.line,`17 BLACK - +${f(35000)}◉`);
 r=spin([['red',1,1]],0);
 assert.equal(r.net,-5000);assert.match(r.line,/^0 GREEN - the house takes /);assert.deepEqual(r.sounds,['warn']);
});

test('Roulette wraps the wheel angle where it lands and settles from the bets its stake paid for',()=>{
 const c=casino({overflow:1e12,prestige:20});c.run('openRoulette()');
 const seg=2*Math.PI/37;
 for(let i=0;i<300;i++){
  c.run('rouChipI=0');c.rouAdd('red');
  const res=(i*7)%37;c.rolls=[(res+0.5)/37,0.5];c.rouSpinNow();c.frame(4300);
  const A=c.run('rouAngle');
  assert.ok(A>=0&&A<2*Math.PI,'angle '+A);
  assert.equal(c.run('ROU_ORDER['+Math.floor(((((-Math.PI/2-A)/seg)%37)+37)%37)+']'),res,'the pocket under the pointer is the result');
 }
 /* a bet forced onto the live table mid-spin (every button path is guarded) is not settled */
 const d=casino({gold:100000,prestige:20});d.run('openRoulette()');
 d.run('rouChipI=0');d.rouAdd('n17');
 d.rolls=[(17+0.5)/37,0.5];d.rouSpinNow();
 d.run('rouBets.n17=300000;rouBets.red=300000');
 d.frame(4300);
 assert.equal(d.S.gold,100000-1000+36000);
 /* every bet still returns 36/37 through the real rouSettle */
 const e=casino({overflow:1e12,prestige:20});
 for(const k of [...Array(37).keys()].map(n=>'n'+n).concat(['red','black','even','odd'])){
  let back=0;for(let r=0;r<37;r++){const b=e.S.gold+e.S.overflow;e.rouSettle(r,1000,{[k]:1000},e.S);back+=e.S.gold+e.S.overflow-b;}
  assert.equal(back,36000,k);
 }
});

test('Roulette: chip − and + stop at the ends, the limit line uses the window\'s one number format, the table stands upright on a phone',()=>{
 const c=casino({gold:100000});c.run('openRoulette()');
 const ends=()=>[c.el('rouChipDn').disabled,c.el('rouChipUp').disabled];
 c.run('rouChipI=0;rouRender()');assert.deepEqual(ends(),[true,false]);
 c.el('rouChipDn').onclick();assert.equal(c.run('rouChipI'),0);
 c.run('rouChipI=ROU_CHIPS.length-1;rouRender()');assert.deepEqual(ends(),[false,true]);
 c.run('rouChipI=3;rouRender()');assert.deepEqual(ends(),[false,false]);
 assert.equal(c.el('rouMax').textContent,'◉ / chip · max '+(300000).toLocaleString()+'◉ total');
 assert.equal(c.el('rouStat').textContent,'Staked 0◉ / '+(300000).toLocaleString()+'◉ max');
 assert.match(html,/<span class="slotbetcost" id="rouMax">/);
 /* the upright phone table: 1-18 on the left, 19-36 on the right, three across in reading order, under the zero */
 const cells=[...c.el('rouGrid').innerHTML.matchAll(/data-rn="(\d+)" style="--pc:(\d);--pr:(\d)"/g)].map(m=>({n:+m[1],pc:+m[2],pr:+m[3]}));
 assert.equal(cells.length,36);
 for(const {n,pc,pr} of cells){const half=n>18?1:0,k=n-1-18*half;assert.equal(pr,2+Math.floor(k/3),'row of '+n);assert.equal(pc,1+3*half+k%3,'column of '+n);}
 const phone=css.slice(css.indexOf('@media (max-width:600px){\n #rouWheel'));
 assert.ok(phone.length<css.length,'the phone rules for the roulette table');
 assert.match(phone,/\.rougrid\{grid-template-columns:repeat\(6,1fr\);width:100%\}/);
 assert.match(phone,/\.roucell\{grid-column:var\(--pc\);grid-row:var\(--pr\)/);
 assert.match(phone,/\.roucell\.g\{grid-column:1\/-1;grid-row:1\}/);
});

test('Roulette teardown and a changed hero: a wheel still turning never pays, and with no hero Close still hides',()=>{
 const c=casino({gold:100000,prestige:20});c.run('openRoulette()');
 c.run('rouChipI=2');c.rouAdd('n17');c.rolls=[(17+0.5)/37,0.5];c.rouSpinNow();c.frame(1000);
 const g=c.S.gold;c.run('rouTeardown()');c.frame(5000);c.frame(5000);
 assert.equal(c.S.gold,g);assert.equal(c.run('rouSpinning'),false);assert.equal(c.run('JSON.stringify(rouBets)'),'{}');
 assert.equal(c.open('rouFx'),false);assert.equal(c.framesQueued(),0);
 c.S=null;assert.doesNotThrow(()=>c.run('rouTeardown()'));
 const d=casino({gold:100000,prestige:20});d.run('openRoulette()');
 d.run('rouChipI=2');d.rouAdd('n17');d.rolls=[(17+0.5)/37,0.5];d.rouSpinNow();
 const A=d.S;d.S={gold:1000,overflow:0,prestige:0,bag:[],scraps:0};d.frame(4300);
 assert.equal(d.S.gold,1000);assert.equal(A.gold,90000);assert.equal(d.run('rouSpinning'),false);
 const e=casino({gold:100000,prestige:20});e.run('openRoulette()');
 e.run('rouChipI=0');e.rouAdd('red');e.rolls=[0.5,0.5];e.rouSpinNow();
 e.S=null;
 assert.doesNotThrow(()=>{e.rouAdd('odd');e.el('rouSpin').onclick();e.el('rouClear').onclick();e.el('rouChipUp').onclick();e.el('rouChipDn').onclick();});
 e.el('rouClose').onclick();assert.equal(e.open('rouFx'),false);
 assert.doesNotThrow(()=>e.frame(4300));
});

test('Sebbe\'s cups say what they are: FIND THE BALL, a blurred last pass, one cup in three, a lost round in the log, the City\'s own sound',()=>{
 assert.match(html,/<div id="sebbeFx">\s*<div class="slotmach cups">\s*<div class="slottop">FIND THE BALL<\/div>/);
 assert.ok(!/FOLLOW THE BALL|Keep your eye on it/.test(html+game));
 assert.match(css,/\.cuprow\.blur\{filter:blur\(\d+px\)/);
 assert.ok(!/casinoAmbApply/.test(section(...CUPS)),'the cup game leaves the music alone');
 assert.match(between('const CUP_BETS=','\nconst CUP_SLOT'),/const CUP_PAY=2\.8;/);
 const c=casino({gold:100000});c.run('openCupGame()');
 const say=()=>c.el('sebbeSay').innerHTML.replace(/<[^>]+>/g,'');
 assert.match(say(),/Find the ball and Sebbe pays 2\.8×\. Whatever you think you saw, it is one cup in three\.$/);
 const row=c.el('cupRow'),swaps=[];
 const layout=c.cupLayout;c.cupLayout=function(ms){swaps.push({blur:row.classList.contains('blur'),ms});return layout(ms);};
 c.el('sebbeStart').onclick();
 assert.equal(say(),'Sebbe\'s hands blur - it could be under any of them now…');
 assert.ok(c.el('cupBall1').classList.contains('show'),'the ball still goes down under the middle cup');
 c.advance(9000);
 assert.equal(c.run('cupState'),'picking');
 assert.equal(swaps.map(s=>s.blur?1:0).join(''),'0'.repeat(13)+'1'.repeat(9),'only the last pass, and all of it, is a blur');
 assert.ok(swaps.every(s=>s.blur?s.ms===0:s.ms>=300),'the shuffle slides as before; under the blur each swap is a jump, with nothing to follow');
 assert.match(css,/#sebbeSay\{width:0;min-width:100%/,'the longer line wraps instead of widening the table');
 assert.equal(row.classList.contains('blur'),false,'the cups are clear to pick');
 const n=c.logs.length;c.rolls=[0.9];c.run('cupPick(0)');               /* the ball was under cup 2 */
 assert.deepEqual(c.logs.slice(n),['🥤 Wrong cup - Sebbe keeps '+(5000).toLocaleString()+' ◉.']);
 assert.equal(c.amb,0);
});

test('Sebbe\'s table: opening it again keeps a round on the table or clears the old timer; teardown and a changed hero pay nothing',()=>{
 const c=casino({gold:200000});c.run('openCupGame();cupBetI=0;cupUI()');
 c.el('sebbeStart').onclick();c.advance(2000);
 c.run('openCupGame()');
 assert.equal(c.run('cupState'),'shuffling','the round stays on the table');
 c.run('cupBetI=6;cupUI()');c.el('sebbeStart').onclick();
 assert.equal(c.S.gold,199500,'no second stake');
 c.advance(7000);c.rolls=[0.1];c.run('cupPick(0)');
 assert.equal(c.S.gold,199500+1400,'one pick, paid on the one stake');
 c.run('openCupGame()');assert.equal(c.run('cupState'),'idle','opened during the reveal: a fresh table');
 c.el('sebbeStart').onclick();c.advance(1900);
 assert.equal(c.run('cupState'),'shuffling','the old reveal timer died with the reset');
 c.advance(4500);assert.ok(c.el('cupRow').classList.contains('blur'));
 const g=c.S.gold;c.run('cupTeardown()');c.advance(20000);
 assert.equal(c.run('cupState'),'idle');assert.equal(c.pending(),0);assert.equal(c.S.gold,g);
 assert.equal(c.el('cupRow').classList.contains('blur'),false);assert.equal(c.open('sebbeFx'),false);
 c.S=null;assert.doesNotThrow(()=>c.run('cupTeardown()'));
 const d=casino({gold:100000});d.run('openCupGame()');d.el('sebbeStart').onclick();d.advance(9000);
 const A=d.S;d.S={gold:1000,overflow:0,prestige:0,bag:[],scraps:0};
 d.rolls=[0.1];d.run('cupPick(0)');
 assert.equal(d.S.gold,1000);assert.equal(A.gold,95000);assert.equal(d.run('cupState'),'idle');
 const e=casino({gold:100000});e.run('openCupGame()');e.el('sebbeStart').onclick();e.advance(3000);
 e.S=null;
 assert.doesNotThrow(()=>{e.el('sebbeBetUp').onclick();e.el('sebbeStart').onclick();e.run('cupPick(1)');});
 e.el('sebbeClose').onclick();
 assert.equal(e.open('sebbeFx'),false,'Leave closes the table with no hero behind it');assert.equal(e.pending(),0);
});

/* ---------------- round 2 (review-simple's should_fix items) ---------------- */
/* rouRes as a page keeps it: textContent and innerHTML are one text ('&nbsp;' reads as a no-break space) */
const liveRes=c=>{const res=c.el('rouRes');let html='';
 Object.defineProperty(res,'innerHTML',{get:()=>html,set:v=>{html=String(v);}});
 Object.defineProperty(res,'textContent',{get:()=>html.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' '),set:v=>{html=String(v);}});
 return res;};

test('Roulette: a void spin clears the table, opening the window mid-spin keeps the turning wheel, and the line says what went to overflow',()=>{
 const f=n=>n.toLocaleString(),staked=n=>'Staked '+f(n)+'◉ / '+f(300000)+'◉ max';
 /* a hero change no teardown saw: nothing is paid, and the table lets go of that spin's chips and words */
 const c=casino({gold:100000,prestige:20});const res=liveRes(c);c.run('openRoulette()');
 c.run('rouChipI=2');c.rouAdd('n17');c.rouAdd('red');
 c.rolls=[(17+0.5)/37,0.5];c.rouSpinNow();
 assert.equal(res.textContent,'No more bets…');assert.equal(c.el('rouStat').textContent,staked(20000));
 const A=c.S;c.S={gold:1000,overflow:0,prestige:0,bag:[],scraps:0};c.frame(4300);
 assert.equal(A.gold,80000);assert.equal(c.S.gold,1000,'the void spin pays no one');
 assert.equal(res.textContent,' ','no "No more bets" left under a wheel that stopped');
 assert.equal(c.el('rouStat').textContent,staked(0),'no stake left on the cloth');
 assert.equal(c.run('JSON.stringify(rouBets)'),'{}');assert.equal(c.el('rouSpin').disabled,true);assert.equal(c.el('rouClear').disabled,true);
 /* the window opened again while the wheel turns: its chips, its line and its landing stay */
 const d=casino({gold:100000,prestige:20});const dres=liveRes(d);d.run('openRoulette()');
 d.run('rouChipI=1');d.rouAdd('red');d.rouAdd('n7');d.rolls=[(7+0.5)/37,0.5];d.rouSpinNow();d.frame(1000);
 d.run('openRoulette()');
 assert.equal(d.run('rouSpinning'),true,'the wheel still turns');
 assert.equal(d.run('JSON.stringify(rouBets)'),JSON.stringify({red:5000,n7:5000}));
 assert.equal(dres.textContent,'No more bets…');assert.equal(d.el('rouStat').textContent,staked(10000));
 assert.equal(d.el('rouSpin').disabled,true,'no second spin on top of it');
 d.frame(4300);
 assert.equal(d.run('rouSpinning'),false);assert.equal(d.S.gold,100000-10000+5000*2+5000*36);
 assert.equal(dres.textContent,'7 RED - +'+f(180000)+'◉');
 /* a vault at its cap: the line says what went to overflow, as Lucky 7's does - a gain and a partial return alike */
 for(const [bets,ball,line] of [[[['n17',0]],17,`17 BLACK - +${f(35000)}◉ (${f(36000)} to overflow)`],
  [[['n17',2],['red',0]],3,`3 RED - returned ${f(2000)}◉ · lost ${f(9000)}◉ (${f(2000)} to overflow)`]]){
  const e=casino({prestige:0,overflow:100000});const eres=liveRes(e);e.S.gold=e.run('goldCap()');e.run('openRoulette()');
  for(const [k,i] of bets){e.run('rouChipI='+i);e.rouAdd(k);}
  e.rolls=[(ball+0.5)/37,0.5];e.rouSpinNow();e.frame(4300);
  assert.equal(eres.textContent,line);
 }
 assert.match(between('function openRoulette(){','\n}'),/if\(rouSpinning\)\{rouRender\(\);return;\}/);
});

test('Roulette between phone and desktop (601-899 px): the 13-wide strip spans a wider machine at 13 px instead of 14 px cells at 10.5 px',()=>{
 const i=css.indexOf('@media (min-width:601px) and (max-width:899px){\n .rougrid,.roucolors');
 assert.ok(i>0,'the tablet rules for the roulette table');
 const block=css.slice(i,css.indexOf('\n}',i));
 assert.match(block,/\.rougrid,\.roucolors\{width:min\(520px,calc\(100vw - 72px\)\)\}/,'at most 520 px, and never wider than the screen less the machine\'s padding');
 assert.match(block,/\.roucell\{font-size:13px\}/);
 assert.ok(i>css.indexOf('@media (max-width:600px){\n #rouWheel')&&i<css.indexOf('.slotmach.bj{'),'next to the phone rules of the roulette');
 /* 520 px over 13 columns and 12 gaps of 3 px: cells of 37 px (the old strip had 14) */
 assert.ok((520-12*3)/13>=37);
});
