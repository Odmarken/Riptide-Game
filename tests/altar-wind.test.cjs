/* The Altar, high above the clouds (asked for 2026-10-01: "ta bort det där 0/999999 i altar och sen fixa lite vindar som väder
 * i altar som blåser för man är högt uppe"): no quest counter on its card, and a wind that never drops - cloud bands racing west,
 * streaks of air and ice dust - that gusts and eases, stops with Settings -> Video -> Weather and costs next to nothing. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};

test('the Altar\'s quest card shows its name, its line, a full bar and a snowflake - never 0 / 999999',()=>{
 const els={},$=id=>els[id]||(els[id]={id,textContent:'',innerHTML:'',style:{},classList:{toggle(){}}});
 const S={gold:0,overflow:0,scraps:0,lvl:30,prestige:0,xp:0,auto:false,zone:7,qProg:0,cleared:{},bossDead:{}};
 const c=vm.createContext({$,S,refreshCombatAutoControls(){},refreshOpenPanel(){},xpNeed:()=>100,MAXLVL:60,ZONES:[],enemies:[],
  expeditionZone:()=>false,portalIsOpen:()=>true,zoneOf:()=>({name:'The Altar',altar:true,special:true}),
  questOf:()=>({name:'⛧ The Altar',desc:'A silent ring above the clouds. Something waits to be awakened.',need:999999})});
 vm.runInContext(section('function renderHUD(){','/* per-spell/potion auto-cast settings'),c);
 c.renderHUD();
 assert.equal(els.qName.textContent,'⛧ The Altar');
 assert.equal(els.qDesc.textContent,'A silent ring above the clouds. Something waits to be awakened.');
 assert.equal(els.qCount.textContent,'❄');assert.equal(els.qBar.style.width,'100%');
 assert.equal(els.nextBtn.style.display,'none','no Continue up here');
 assert.doesNotMatch(Object.values(els).map(e=>e.textContent).join(' '),/999999/);
});

/* the wind's own code, cut from game.js, with a canvas that only counts */
function windBox(){
 const n={drawImage:0,stroke:0,lineTo:0,gradients:0,alpha:[]};
 const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){n.lineTo++;},stroke(){n.stroke++;},drawImage(){n.drawImage++;},
  createLinearGradient(){n.gradients++;return {addColorStop(){}};},set globalAlpha(v){n.alpha.push(v);},get globalAlpha(){return 1;}};
 const tile={save(){},restore(){},translate(){},scale(){},fillRect(){},createRadialGradient:()=>({addColorStop(){}})};
 const c=vm.createContext({ctx,VW:1400,VH:900,zoom:1.3,camX:200,camY:600,document:{createElement:()=>({width:0,height:0,getContext:()=>tile})}});
 vm.runInContext(section('const wxHash=','function weatherUpdate(')+section('const WX_TILE=512;','function drawWeather(')+
  section('/* 🌬 The Altar\'s wind','/* Zone maps are the biggest files')+'\nglobalThis.ALTAR_WIND=ALTAR_WIND;',c);
 return {c,n};
}
test('the wind never drops and never stops: it swells into gusts and eases, and carries everything ever onward',()=>{
 const {c}=windBox(),W=c.ALTAR_WIND;
 let last=0,lo=1,hi=0;
 for(let t=1;t<=240;t+=1/30){
  const g=c.altarWindUpdate(t);
  assert.ok(g>=0&&g<=1,'a gust between calm and full: '+g);
  assert.ok(W.x>=last,'never blown back');last=W.x;lo=Math.min(lo,g);hi=Math.max(hi,g);
 }
 assert.ok(hi-lo>.45,'it gusts and eases ('+lo.toFixed(2)+'..'+hi.toFixed(2)+')');
 assert.ok(W.x>239*90,'and even in a lull it blows at 90 units a second or more');
 /* a held gust for screenshots, and a long pause does not throw everything across the sky */
 c.altarWindTest(1);let x0=W.x;c.altarWindUpdate(W.last+1/60);
 assert.ok(Math.abs(W.x-x0-360/60)<1e-6,'a full gust carries things 360 units a second');
 x0=W.x;c.altarWindUpdate(W.last+30);
 assert.ok(Math.abs(W.x-x0-36)<1e-6,'the first frame after a pause moves them a tenth of a second, not thirty');
 c.altarWindTest(0);x0=W.x;assert.equal(c.altarWindUpdate(W.last+1/60),0);
 assert.ok(Math.abs(W.x-x0-90/60)<1e-6,'a held lull still blows 90 a second');
 c.altarWindTest();assert.equal(W.pin,null);
});
test('a gust brings more streaks and denser dust; the cloud bands get thicker - and the whole of it is cheap',()=>{
 const run=g=>{const {c,n}=windBox();c.altarWindTest(g);c.altarWindUpdate(10);c.altarWindUpdate(10.1);c.drawAltarClouds();c.drawAltarWind(10.1);return n;};
 const calm=run(0),gust=run(1);
 assert.ok(gust.gradients>calm.gradients*1.8,'streaks: '+calm.gradients+' in a lull, '+gust.gradients+' in a gust');
 assert.ok(gust.lineTo>calm.lineTo*1.5,'dust and streak lines grow with it');
 assert.ok(Math.max(...gust.alpha)>Math.max(...calm.alpha),'the cloud bands thicken');
 assert.ok(gust.drawImage>0&&gust.drawImage<=40,'the cloud bands are a handful of tiles, not a canvas a frame ('+gust.drawImage+')');
 assert.ok(gust.gradients<300&&gust.lineTo<4000,'a frame of a full gust stays small: '+gust.gradients+' streaks, '+gust.lineTo+' lines');
});
test('the wind blows in the Altar only, under Settings -> Video -> Weather, over the world but under the canvas text',()=>{
 const draw=section('function draw(){','\nconst sidebarResize=');
 const clouds=draw.indexOf('if(z.altar&&WEATHER.on){altarWindUpdate(now);drawAltarClouds();}'),streaks=draw.indexOf('if(z.altar&&WEATHER.on)drawAltarWind(now);');
 assert.ok(clouds>0&&streaks>0);
 assert.ok(draw.indexOf('drawMist(now);')<clouds&&clouds<draw.indexOf('drawEdgeFog(); /* last thing in world space'),'the clouds in the world, over all that stands');
 assert.ok(draw.indexOf('drawWeather(now);')<streaks&&streaks<draw.indexOf('if(cowRunning||(zoneOf().cow&&hero.dead)){'),'the streaks and dust over the world, under what the canvas writes');
 assert.match(game,/const displaySettings=DisplaySettings\.create\(\{onChange:v=>\{[^}]*WEATHER\.on=v\.weather;/,'the Weather switch is WEATHER.on');
 assert.match(section('function sunZone(z){','\n}'),/z\.altar/,'still no sun up here - the wind is weather of its own');
});
