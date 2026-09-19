/* 👑 The Crown Ledger - the City's treasury, budget, loans and temper. Pure arithmetic with no DOM
 * and no clock of its own: game.js feeds it five minutes of play at a time and paints the result,
 * so the whole thing runs headless in the tests. Amounts are gold per close; a close is one tick. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CityEconomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TICK_SECONDS=300;          /* the ledger closes every five minutes of play */
 const LOAN_RATE=0.005;           /* Tides Bank: half a percent of what is owed, every close */
 const OVERDRAFT_RATE=0.01;       /* a treasury below zero costs twice the bank's rate */
 const HISTORY=12;                /* an hour of closes kept on the ledger tab */
 const POPULATION=72;             /* the townsfolk on the streets (CITY_FOLK) */
 const ROYAL_GUARD=8;             /* the men at the pillars of the hall, paid before anyone */
 const PROTEST_START=25,PROTEST_END=40;   /* hysteresis, so the crowd does not flicker */
 const TAX_RATES=[0,5,10,15,20,25,30];
 const TAX_MOOD={0:12,5:6,10:0,15:-7,20:-15,25:-25,30:-38};
 const TAX_NOTE={0:'no tax - the people love you and the treasury starves',5:'a light hand',10:'the customary tithe',
  15:'grumbling in the market',20:'the merchants write letters',25:'the poor go hungry',30:'a rebellion waiting for a spark'};
 /* Every budget line has four levels. cost is gold per close before the prestige scale; mood is
    the pull on the people's temper; order and trade multiply the tolls and customs. */
 const LINES={
  watch:{name:'City Watch',icon:'🛡',blurb:'Patrols on the main streets. Order is what makes a merchant unpack his cart.',levels:[
   {name:'Disbanded',men:0,cost:0,mood:-12,order:.55},
   {name:'Standard',men:5,cost:200,mood:0,order:1},
   {name:'Doubled',men:10,cost:400,mood:4,order:1.15},
   {name:'Royal',men:15,cost:620,mood:6,order:1.25}]},
  roads:{name:'Roads & Walls',icon:'🧱',blurb:'Cobbles, gates and the curtain wall. Good roads carry more trade.',levels:[
   {name:'Neglected',cost:0,mood:-8,trade:.8},
   {name:'Kept',cost:150,mood:0,trade:1},
   {name:'Paved',cost:320,mood:4,trade:1.12},
   {name:'Grand',cost:520,mood:8,trade:1.22}]},
  relief:{name:'Granary & Poor Relief',icon:'🍞',blurb:'Bread for the tenements. Nothing calms a city like a full granary.',levels:[
   {name:'None',cost:0,mood:-6},
   {name:'Bread dole',cost:120,mood:6},
   {name:'Full granary',cost:260,mood:14},
   {name:'Feasts for all',cost:420,mood:22}]},
  festival:{name:'Festivals',icon:'🎉',blurb:'Feast days, tournaments and games on the cathedral square.',levels:[
   {name:'None',cost:0,mood:0},
   {name:'Feast days',cost:100,mood:5},
   {name:'Tournaments',cost:240,mood:11},
   {name:'Royal games',cost:400,mood:17}]},
  court:{name:'The Royal Court',icon:'👑',blurb:'The King’s table, his guests and his tailors. A splendid court draws the gentry, and their gold.',levels:[
   {name:'Frugal',cost:60,mood:-3,trade:.95},
   {name:'Modest',cost:140,mood:0,trade:1},
   {name:'Splendid',cost:300,mood:2,trade:1.05},
   {name:'Lavish',cost:500,mood:4,trade:1.1}]},
 };
 const LINE_KEYS=Object.keys(LINES);
 const DEFAULT_BUDGET=Object.freeze({tax:10,watch:1,roads:1,relief:1,festival:0,court:1});
 /* What happens between closes. gold and mood are before the prestige scale; when() gates an
    event on the budget, so a disbanded watch is what lets the smugglers in. */
 const EVENTS=[
  {text:'A trade caravan from Moonshine paid its tolls at the west gate.',gold:260,w:3},
  {text:'The fishing fleet came home heavy and the fish market overflowed.',gold:220,w:3},
  {text:'The Tides Guild settled its dues with the crown.',gold:180,w:2},
  {text:'A noble wedding filled every inn on the cathedral square.',gold:320,mood:2,w:2,when:s=>s.budget.court>=2},
  {text:'Fire in the tenements - the watch fought it through the night.',gold:-300,mood:-3,w:2,when:s=>s.budget.watch>=1},
  {text:'Fire in the tenements and nobody left to fight it.',gold:-450,mood:-8,w:3,when:s=>s.budget.watch===0},
  {text:'Smugglers slipped past the east gate under cover of dark.',gold:-200,w:3,when:s=>s.budget.watch<=1},
  {text:'Rats got into the granary.',gold:-150,mood:-4,w:2,when:s=>s.budget.relief<=1},
  {text:'The cathedral held a feast day and the whole city turned out.',mood:5,w:3},
  {text:'A week of rain flooded the lower streets.',gold:-120,mood:-3,w:2,when:s=>s.budget.roads<=1},
  {text:'The Mining Hall struck a rich seam.',gold:280,w:2,when:(s,c)=>!!c.miningTrained},
  {text:'An emerald cut in the Enchanting Hall sold to a foreign court.',gold:300,w:2,when:(s,c)=>!!c.enchTrained},
  {text:'The tournament drew knights from three realms.',gold:240,mood:3,w:2,when:s=>s.budget.festival>=2},
 ];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
 const level=(key,i)=>LINES[key].levels[clamp(Math.floor(num(i,DEFAULT_BUDGET[key])),0,LINES[key].levels.length-1)];
 function create(){
  return {treasury:5000,loan:0,mood:60,clock:0,ticks:0,earned:0,spent:0,borrowed:0,protest:false,
   budget:{...DEFAULT_BUDGET},history:[],last:null};
 }
 function normalize(s){
  const out=create();
  if(!s||typeof s!=='object')return out;
  out.treasury=Math.round(num(s.treasury,out.treasury));
  out.loan=Math.max(0,Math.round(num(s.loan,0)));
  out.mood=clamp(Math.round(num(s.mood,out.mood)),0,100);
  out.clock=clamp(num(s.clock,0),0,TICK_SECONDS);
  out.ticks=Math.max(0,Math.floor(num(s.ticks,0)));
  out.earned=Math.max(0,Math.round(num(s.earned,0)));
  out.spent=Math.max(0,Math.round(num(s.spent,0)));
  out.borrowed=Math.max(0,Math.round(num(s.borrowed,0)));
  out.protest=!!s.protest;
  const b=s.budget||{};
  out.budget.tax=TAX_RATES.includes(num(b.tax,10))?num(b.tax,10):10;
  for(const k of LINE_KEYS)out.budget[k]=LINES[k].levels.indexOf(level(k,b[k]));
  out.history=Array.isArray(s.history)?s.history.filter(h=>h&&typeof h==='object').slice(-HISTORY):[];
  out.last=out.history.length?out.history[out.history.length-1]:null;
  return out;
 }
 /* prestige is the real multiplier: a prestige-50 hero runs a city that moves six times the gold */
 function scale(ctx){return 1+num(ctx.prestige)*.10+Math.max(0,num(ctx.lvl,1)-1)*.01;}
 function creditLimit(ctx){return Math.round(100000+num(ctx.prestige)*20000);}
 function moodName(m){return m<PROTEST_START?'Rioting':m<PROTEST_END?'Restless':m<55?'Uneasy':m<70?'Content':m<85?'Prosperous':'Jubilant';}
 function moodColor(m){return m<PROTEST_START?'#ff6f61':m<PROTEST_END?'#ff9f6b':m<55?'#e6c46a':m<70?'#bfe08a':'#8ee6a8';}
 /* The whole ledger for one close, before it happens. Everything the panel shows comes from here,
    so the numbers on the budget tab are exactly what the next close will charge. */
 function forecast(state,ctx={}){
  const k=scale(ctx),b=state.budget,r=v=>Math.round(v);
  const watch=level('watch',b.watch),roads=level('roads',b.roads),relief=level('relief',b.relief),festival=level('festival',b.festival),court=level('court',b.court);
  const order=watch.order,trade=roads.trade*court.trade;
  const temper=.7+state.mood/333;             /* the restless dodge the tax man: 0.7 at 0, 1.0 at 100 */
  const mining=num(ctx.mining),ench=num(ctx.ench),smith=num(ctx.smith),farmLvl=Math.max(1,num(ctx.farmLvl,1));
  const income=[
   {id:'taxes',name:'Poll tax',icon:'💰',amount:r(POPULATION*b.tax/100*80*k*temper),note:POPULATION+' townsfolk at '+b.tax+'% - '+TAX_NOTE[b.tax]},
   {id:'tolls',name:'Market tolls',icon:'⚖️',amount:r(300*k*order*trade*(.75+state.mood/200)),note:'the square, the terraces and the tenement stalls'},
   {id:'exports',name:'Exports',icon:'🚢',amount:r((200+mining*6+smith*40+ench*4)*k*trade),note:'ore, gems and forged steel out through the gate'},
   {id:'imports',name:'Import duties',icon:'📦',amount:r(220*k*order),note:'customs on everything that comes in'},
   {id:'guilds',name:'Guild dues',icon:'⛏',amount:r(((ctx.miningTrained?120:0)+(ctx.enchTrained?120:0)+(ctx.smelter?80:0))*k),note:'the Mining Hall, the Enchanting Hall and the smelter'},
   {id:'farm',name:'Farm levy',icon:'🚜',amount:ctx.farmOwned?r(farmLvl*90*k):0,note:ctx.farmOwned?'your farm, level '+farmLvl:'no farm of your own yet'},
   {id:'licence',name:'Gaming licence',icon:'🎲',amount:r(150*k),note:'the Moonshine casino pays for the privilege'},
  ];
  const expenses=[
   {id:'guard',name:'Royal Guard',icon:'⚔️',amount:r(ROYAL_GUARD*45*k),note:ROYAL_GUARD+' men at the pillars of the hall'},
   {id:'watch',name:'City Watch',icon:'🛡',amount:r(watch.cost*k),note:watch.men+' men - '+watch.name},
   {id:'roads',name:'Roads & Walls',icon:'🧱',amount:r(roads.cost*k),note:roads.name},
   {id:'relief',name:'Granary & Poor Relief',icon:'🍞',amount:r(relief.cost*k),note:relief.name},
   {id:'festival',name:'Festivals',icon:'🎉',amount:r(festival.cost*k),note:festival.name},
   {id:'court',name:'The Royal Court',icon:'👑',amount:r(court.cost*k),note:court.name},
   {id:'interest',name:'Tides Bank interest',icon:'🏦',amount:r(state.loan*LOAN_RATE),note:state.loan>0?(LOAN_RATE*100)+'% of '+state.loan.toLocaleString()+' owed':'nothing owed'},
   {id:'overdraft',name:'Overdraft penalty',icon:'⚠️',amount:state.treasury<0?r(-state.treasury*OVERDRAFT_RATE):0,note:state.treasury<0?'the treasury is below zero':'the treasury is in credit'},
  ];
  const totalIn=income.reduce((t,l)=>t+l.amount,0),totalOut=expenses.reduce((t,l)=>t+l.amount,0);
  const moodTarget=clamp(55+TAX_MOOD[b.tax]+watch.mood+roads.mood+relief.mood+festival.mood+court.mood
   +(state.treasury<0?-18:0)+(state.loan>creditLimit(ctx)*.6?-4:0),0,100);
  return {income,expenses,totalIn,totalOut,net:totalIn-totalOut,moodTarget,order,trade,scale:k,creditLimit:creditLimit(ctx)};
 }
 function rollEvents(state,ctx,rng){
  const roll=clamp(num(rng(),.5),0,.999999);
  if(roll>=.4)return [];                     /* most closes are quiet */
  const pool=EVENTS.filter(e=>!e.when||e.when(state,ctx));
  const total=pool.reduce((t,e)=>t+e.w,0);
  let pick=clamp(num(rng(),.5),0,.999999)*total;
  for(const e of pool){pick-=e.w;if(pick<0)return [e];}
  return pool.length?[pool[pool.length-1]]:[];
 }
 /* One close: charge the ledger, roll the week's news, move the temper a third of the way to
    where the budget says it belongs, and decide whether the crowd is on the boulevard. */
 function tick(state,ctx={},rng=Math.random){
  const f=forecast(state,ctx),k=f.scale;
  const events=rollEvents(state,ctx,rng).map(e=>({text:e.text,gold:Math.round(num(e.gold)*k),mood:num(e.mood)}));
  const eventGold=events.reduce((t,e)=>t+e.gold,0),eventMood=events.reduce((t,e)=>t+e.mood,0);
  const net=f.net+eventGold;
  state.treasury=Math.round(state.treasury+net);
  state.mood=clamp(Math.round(state.mood+(f.moodTarget-state.mood)*.34+eventMood),0,100);
  if(!state.protest&&state.mood<PROTEST_START)state.protest=true;
  else if(state.protest&&state.mood>=PROTEST_END)state.protest=false;
  state.ticks+=1;
  state.earned+=f.totalIn+Math.max(0,eventGold);
  state.spent+=f.totalOut+Math.max(0,-eventGold);
  const entry={n:state.ticks,in:f.totalIn,out:f.totalOut,net,events:events.map(e=>e.text),mood:state.mood,treasury:state.treasury,protest:state.protest};
  state.history.push(entry);
  while(state.history.length>HISTORY)state.history.shift();
  state.last=entry;
  return entry;
 }
 /* Play time drives the clock. Returns how many closes fell inside this slice of time. */
 function advance(state,seconds){
  state.clock=num(state.clock)+Math.max(0,num(seconds));
  let closes=0;
  while(state.clock>=TICK_SECONDS){state.clock-=TICK_SECONDS;closes++;}
  return closes;
 }
 function setBudget(state,key,value){
  if(key==='tax'){if(!TAX_RATES.includes(value))return false;state.budget.tax=value;return true;}
  if(!LINES[key]||!LINES[key].levels[value])return false;
  state.budget[key]=value;return true;
 }
 function borrow(state,ctx,amount){
  const room=creditLimit(ctx)-state.loan,n=Math.min(Math.floor(num(amount)),room);
  if(n<=0)return 0;
  state.loan+=n;state.treasury+=n;state.borrowed+=n;
  return n;
 }
 function repay(state,amount){
  const n=Math.min(Math.floor(num(amount)),state.loan,Math.max(0,state.treasury));
  if(n<=0)return 0;
  state.loan-=n;state.treasury-=n;
  return n;
 }
 /* Moving gold between the treasury and the hero's purse. room is what the purse can still hold. */
 function withdraw(state,amount,room){
  const n=Math.min(Math.floor(num(amount)),Math.max(0,state.treasury),Math.max(0,Math.floor(num(room))));
  if(n<=0)return 0;
  state.treasury-=n;return n;
 }
 function deposit(state,amount,purse){
  const n=Math.min(Math.floor(num(amount)),Math.max(0,Math.floor(num(purse))));
  if(n<=0)return 0;
  state.treasury+=n;return n;
 }
 return Object.freeze({create,normalize,forecast,tick,advance,setBudget,borrow,repay,withdraw,deposit,creditLimit,moodName,moodColor,scale,
  TICK_SECONDS,LOAN_RATE,OVERDRAFT_RATE,HISTORY,POPULATION,ROYAL_GUARD,PROTEST_START,PROTEST_END,TAX_RATES,TAX_MOOD,LINES,LINE_KEYS,DEFAULT_BUDGET,EVENTS});
});
