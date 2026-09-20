/* 👑 The Crown Ledger - the City's treasury, budget, loans, temper, unrest and council. Pure
 * arithmetic with no DOM and no clock of its own: game.js feeds it five minutes of play at a time
 * and paints the result, so the whole thing runs headless in the tests. Amounts are gold per close;
 * a close is one tick. Everything that happens in the city is rolled from the rng handed to tick(). */
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
 const MAX_INCIDENTS=2;           /* the city never burns in more than two places at once */
 const CREDIT_CAP=2000000;        /* the most a good name is worth on top of the base limit */
 const TAX_RATES=[0,5,10,15,20,25,30];
 const TAX_MOOD={0:12,5:6,10:0,15:-7,20:-15,25:-25,30:-38};
 const TAX_NOTE={0:'no tax - the people love you and the treasury starves',5:'a light hand',10:'the customary tithe',
  15:'grumbling in the market',20:'the merchants write letters',25:'the poor go hungry',30:'a rebellion waiting for a spark'};
 /* Every budget line has four levels. cost is gold per close before the prestige scale; mood is
    the pull on the people's temper; order and trade multiply the tolls and customs. */
 const LINES={
  watch:{name:'City Watch',icon:'🛡',blurb:'Patrols on the main streets. Order is what makes a merchant unpack his cart - and what breaks up a brawl.',levels:[
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
  {text:'A travelling circus pitched its tents outside the wall.',mood:4,gold:90,w:2},
  {text:'A merchant prince opened a counting house on the boulevard.',gold:340,w:1.5,when:s=>s.mood>=60},
  {text:'A preacher in the square blamed the crown for the price of bread.',mood:-4,w:2,when:s=>s.mood<50},
  {text:'Wolves took sheep from the farms beyond the wall.',gold:-110,mood:-2,w:1.5},
 ];
 /* 🥊 Unrest. An incident is rolled at a close, stays until the budget line it names reaches the
    level it asks for (or the crown pays to have it dealt with), and costs mood and gold every
    close it is left alone - more each close. street marks the ones the player can SEE in the City. */
 const INCIDENTS=[
  {id:'brawl',name:'Brawl on the boulevard',icon:'🥊',text:'Dockhands and miners are at each other’s throats by the west gate, and the watch is too thin to part them.',line:'watch',level:2,fix:'Double the City Watch',mood:-6,gold:-140,w:4,street:true},
  {id:'gang',name:'Gang war in the tenements',icon:'🗡',text:'Two gangs fight over the back alleys south of the well. Only a Royal watch can clear them out.',line:'watch',level:3,fix:'Raise the City Watch to Royal',mood:-9,gold:-260,w:1.5,street:true,after:6},
  {id:'thieves',name:'Cutpurses at the gates',icon:'🦝',text:'Every second purse that enters the city leaves it lighter. The merchants want more men on the street.',line:'watch',level:2,fix:'Double the City Watch',mood:-3,gold:-230,w:3},
  {id:'hunger',name:'Bread queues at dawn',icon:'🥖',text:'The dole runs out before the queue does. The tenements are counting the days.',line:'relief',level:2,fix:'Fill the granary (Granary & Poor Relief)',mood:-7,gold:-40,w:3},
  {id:'potholes',name:'A cart lost in the boulevard',icon:'🕳',text:'An axle-deep hole swallowed a wine cart, and the carters are refusing the city roads.',line:'roads',level:2,fix:'Pave the roads (Roads & Walls)',mood:-3,gold:-190,w:2.5},
  {id:'envoy',name:'An insulted envoy',icon:'🎭',text:'A foreign envoy was served cold pottage at the King’s table and says so, loudly, in every port.',line:'court',level:2,fix:'Keep a Splendid court',mood:-2,gold:-210,w:1.5},
  {id:'gloom',name:'A joyless city',icon:'🌧',text:'Not a feast day in living memory. The apprentices have started making their own entertainment.',line:'festival',level:1,fix:'Fund feast days (Festivals)',mood:-5,gold:-30,w:2},
 ];
 /* 🏛 The council: six seats at the table, each with a line of the budget they watch and an opinion
    of you that drifts toward what that line deserves. Their favour together is your standing. */
 const COUNCIL=[
  {id:'coin',title:'Master of Coin',who:'Gottfrid Pung',icon:'🪙',cares:'a ledger in the black, and a small debt'},
  {id:'sword',title:'Lord Commander',who:'Brynolf Järnhand',icon:'⚔️',line:'watch',cares:'men on the streets'},
  {id:'stone',title:'Master Builder',who:'Hallvard Städ',icon:'🧱',line:'roads',cares:'roads, gates and walls'},
  {id:'bread',title:'High Almoner',who:'Syster Agnes',icon:'🍞',line:'relief',cares:'bread for the poor'},
  {id:'revel',title:'Master of Revels',who:'Casimir Lilje',icon:'🎉',line:'festival',cares:'feast days and tourneys'},
  {id:'chamber',title:'Lord Chamberlain',who:'Ansgar Vidhem',icon:'👑',line:'court',cares:'the splendour of the court'},
 ];
 const SEAT_TARGET={watch:[18,55,74,90],roads:[22,55,74,90],relief:[22,55,76,90],festival:[38,60,78,90],court:[30,55,75,90]};
 /* 📜 Petitions: now and then a councillor brings something to the table. cost and gold are before
    the prestige scale; favour is that councillor's, others are the ones it annoys or pleases. */
 const PETITIONS=[
  {id:'halberds',seat:'sword',text:'The watch drills with broom handles. New halberds and mail, and I will answer for the streets.',cost:900,favour:14,mood:1},
  {id:'barracks',seat:'sword',text:'A proper barracks by the west gate, so my men need not sleep in the gatehouse.',cost:1500,favour:16,mood:2},
  {id:'bridge',seat:'stone',text:'The mill bridge is rotting through. Let me rebuild it in stone before it takes a wagon with it.',cost:1400,favour:14,mood:3},
  {id:'sewers',seat:'stone',text:'The lower streets flood with every rain. Dig me proper drains.',cost:1100,favour:12,mood:4},
  {id:'almshouse',seat:'bread',text:'An almshouse by the cathedral, for the winter. It will not be cheap and it will not be forgotten.',cost:1100,favour:14,mood:6},
  {id:'amnesty',seat:'bread',text:'Free the debtors from the gaol. They cannot pay from a cell.',cost:0,favour:10,mood:5,others:{coin:-8}},
  {id:'tourney',seat:'revel',text:'A tourney in the King’s name. The whole realm will talk of it.',cost:1300,favour:14,mood:7,gold:500},
  {id:'fireworks',seat:'revel',text:'Fire-flowers from the east for midsummer night. Trust me.',cost:700,favour:10,mood:5},
  {id:'banquet',seat:'chamber',text:'A banquet for the envoys of three realms. We are judged by our table.',cost:1500,favour:14,mood:1,gold:700},
  {id:'audit',seat:'coin',text:'Let me audit the guild books. They will grumble, and they will pay what they owe.',cost:0,favour:10,mood:-4,gold:1400},
  {id:'levy',seat:'coin',text:'A single levy on the counting houses. The people will not weep for bankers.',cost:0,favour:8,mood:2,gold:1100,others:{chamber:-6}},
  {id:'mint',seat:'coin',text:'Strike a new coinage with less silver in it. Nobody will notice for a year.',cost:0,favour:6,mood:-7,gold:2200,others:{bread:-8}},
 ];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
 const level=(key,i)=>LINES[key].levels[clamp(Math.floor(num(i,DEFAULT_BUDGET[key])),0,LINES[key].levels.length-1)];
 const incidentDef=id=>INCIDENTS.find(d=>d.id===id);
 const petitionDef=id=>PETITIONS.find(d=>d.id===id);
 const seatDef=id=>COUNCIL.find(d=>d.id===id);
 const draw=rng=>clamp(num(rng(),.5),0,.999999);
 function pickWeighted(pool,rng){
  const total=pool.reduce((t,e)=>t+e.w,0);
  let pick=draw(rng)*total;
  for(const e of pool){pick-=e.w;if(pick<0)return e;}
  return pool[pool.length-1]||null;
 }
 function create(){
  const council={};for(const seat of COUNCIL)council[seat.id]=60;
  return {treasury:5000,loan:0,mood:60,clock:0,ticks:0,earned:0,spent:0,borrowed:0,repaid:0,credit:0,protest:false,
   budget:{...DEFAULT_BUDGET},incidents:[],council,petition:null,history:[],last:null};
 }
 function normalize(s){
  const out=create();
  if(!s||typeof s!=='object')return out;
  out.treasury=Math.round(num(s.treasury,out.treasury));
  out.loan=Math.max(0,Math.round(num(s.loan,0)));
  out.mood=clamp(Math.round(num(s.mood,out.mood)),0,100);
  out.clock=clamp(num(s.clock,0),0,TICK_SECONDS);
  out.ticks=Math.max(0,Math.floor(num(s.ticks,0)));
  for(const k of ['earned','spent','borrowed','repaid'])out[k]=Math.max(0,Math.round(num(s[k],0)));
  out.credit=clamp(Math.round(num(s.credit,0)),0,CREDIT_CAP);
  out.protest=!!s.protest;
  const b=s.budget||{};
  out.budget.tax=TAX_RATES.includes(num(b.tax,10))?num(b.tax,10):10;
  for(const k of LINE_KEYS)out.budget[k]=LINES[k].levels.indexOf(level(k,b[k]));
  const seen=new Set();
  out.incidents=(Array.isArray(s.incidents)?s.incidents:[]).filter(i=>i&&incidentDef(i.id)&&!seen.has(i.id)&&seen.add(i.id))
   .slice(0,MAX_INCIDENTS).map(i=>({id:i.id,age:Math.max(0,Math.floor(num(i.age,0)))}));
  for(const seat of COUNCIL)out.council[seat.id]=clamp(Math.round(num(s.council&&s.council[seat.id],60)),0,100);
  out.petition=s.petition&&petitionDef(s.petition.id)?{id:s.petition.id,age:Math.max(0,Math.floor(num(s.petition.age,0)))}:null;
  out.history=Array.isArray(s.history)?s.history.filter(h=>h&&typeof h==='object').slice(-HISTORY):[];
  out.last=out.history.length?out.history[out.history.length-1]:null;
  return out;
 }
 /* prestige is the real multiplier: a prestige-50 hero runs a city that moves six times the gold */
 function scale(ctx){return 1+num(ctx.prestige)*.10+Math.max(0,num(ctx.lvl,1)-1)*.01;}
 function favour(state){const c=(state&&state.council)||{};return Math.round(COUNCIL.reduce((t,s)=>t+num(c[s.id],60),0)/COUNCIL.length);}
 function favourName(v){return v<25?'Hostile':v<40?'Cold':v<60?'Wary':v<75?'Supportive':'Devoted';}
 /* 🏦 What the Tides Bank will lend: a base set by prestige, a good name earned by paying what you
    owe (state.credit), and a tenth on top when the council stands behind you. */
 function creditLimit(ctx,state){
  const base=100000+num(ctx&&ctx.prestige)*20000;
  if(!state)return Math.round(base);
  return Math.round((base+clamp(num(state.credit),0,CREDIT_CAP))*(favour(state)>=75?1.1:1));
 }
 function moodName(m){return m<PROTEST_START?'Rioting':m<PROTEST_END?'Restless':m<55?'Uneasy':m<70?'Content':m<85?'Prosperous':'Jubilant';}
 function moodColor(m){return m<PROTEST_START?'#ff6f61':m<PROTEST_END?'#ff9f6b':m<55?'#e6c46a':m<70?'#bfe08a':'#8ee6a8';}
 function settleCost(def,ctx){return Math.round((600+def.level*500)*scale(ctx));}
 /* The whole ledger for one close, before it happens. Everything the panel shows comes from here,
    so the numbers on the budget tab are exactly what the next close will charge. */
 function forecast(state,ctx={}){
  const k=scale(ctx),b=state.budget,r=v=>Math.round(v);
  const watch=level('watch',b.watch),roads=level('roads',b.roads),relief=level('relief',b.relief),festival=level('festival',b.festival),court=level('court',b.court);
  const fav=favour(state),backing=fav>=75?1.06:1;
  const order=watch.order,trade=roads.trade*court.trade*backing;
  const temper=.7+state.mood/333;             /* the restless dodge the tax man: 0.7 at 0, 1.0 at 100 */
  const mining=num(ctx.mining),ench=num(ctx.ench),smith=num(ctx.smith),farmLvl=Math.max(1,num(ctx.farmLvl,1));
  const limit=creditLimit(ctx,state);
  const incidents=(state.incidents||[]).map(i=>{
   const def=incidentDef(i.id),grow=1+Math.min(i.age,4)*.25;        /* left alone, it spreads */
   return {id:def.id,name:def.name,icon:def.icon,text:def.text,fix:def.fix,line:def.line,level:def.level,street:!!def.street,age:i.age,
    mood:r(def.mood*grow),gold:r(-def.gold*grow*k),cost:settleCost(def,ctx),met:b[def.line]>=def.level};
  });
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
   {id:'unrest',name:'Unrest & damages',icon:'🥊',amount:incidents.reduce((t,i)=>t+i.gold,0),note:incidents.length?incidents.map(i=>i.name.toLowerCase()).join(', '):'the streets are quiet'},
  ];
  /* a council that has turned against you loses papers, delays wagons and pads every bill */
  const waste=fav<35?r(expenses.reduce((t,l)=>t+l.amount,0)*.06):0;
  expenses.push({id:'obstruction',name:'Council obstruction',icon:'🏛',amount:waste,note:fav<35?'a '+favourName(fav).toLowerCase()+' council pads every bill by 6%':'the council is not working against you'});
  const totalIn=income.reduce((t,l)=>t+l.amount,0),totalOut=expenses.reduce((t,l)=>t+l.amount,0);
  const moodFactors=[
   {name:'The city as it stands',value:55},
   {name:'Poll tax at '+b.tax+'%',value:TAX_MOOD[b.tax]},
   {name:'City Watch - '+watch.name,value:watch.mood},
   {name:'Roads & Walls - '+roads.name,value:roads.mood},
   {name:'Granary - '+relief.name,value:relief.mood},
   {name:'Festivals - '+festival.name,value:festival.mood},
   {name:'The court - '+court.name,value:court.mood},
   {name:'A treasury below zero',value:state.treasury<0?-18:0},
   {name:'Deep in debt to the bank',value:state.loan>limit*.6?-4:0},
   ...incidents.map(i=>({name:i.icon+' '+i.name,value:i.mood})),
  ];
  const moodTarget=clamp(moodFactors.reduce((t,f)=>t+f.value,0),0,100);
  return {income,expenses,totalIn,totalOut,net:totalIn-totalOut,moodTarget,moodFactors,incidents,favour:fav,backing,order,trade,scale:k,creditLimit:limit};
 }
 function rollEvents(state,ctx,rng){
  if(draw(rng)>=.4)return [];                 /* most closes are quiet */
  const pool=EVENTS.filter(e=>!e.when||e.when(state,ctx));
  const e=pickWeighted(pool,rng);
  return e?[e]:[];
 }
 /* what a councillor thinks the budget deserves */
 function seatTarget(seat,state,f){
  if(seat.line){
   const pressed=state.incidents.some(i=>incidentDef(i.id).line===seat.line);
   return SEAT_TARGET[seat.line][state.budget[seat.line]]-(pressed?15:0);
  }
  return clamp(55+(f.net>=0?12:-18)+(state.treasury<0?-25:0)+(state.loan>f.creditLimit*.5?-12:0)+(state.loan===0?8:0),0,100);
 }
 function seatView(seat,state,f){
  const v=state.council[seat.id],t=seatTarget(seat,state,f);
  const say=v<30?'I will not put my name to this.':v<45?'I expected better of you.':v<60?'We shall see.':v<78?'The crown is in steady hands.':'You have my sword, my seal and my vote.';
  return {...seat,approval:v,target:t,trend:t>v+2?1:t<v-2?-1:0,say,level:seat.line?LINES[seat.line].levels[state.budget[seat.line]].name:null};
 }
 function councilView(state,ctx={}){
  const f=forecast(state,ctx),fav=f.favour;
  const p=state.petition&&petitionDef(state.petition.id);
  return {favour:fav,name:favourName(fav),
   effect:fav>=75?'A devoted council: trade +6% and the Tides Bank lends a tenth more.':fav<35?'A council against you: every bill is padded by 6%.':'The council does its work and no more.',
   seats:COUNCIL.map(s=>seatView(s,state,f)),
   petition:p?{...p,age:state.petition.age,cost:Math.round(num(p.cost)*f.scale),gold:Math.round(num(p.gold)*f.scale),seatDef:seatDef(p.seat),left:2-state.petition.age}:null};
 }
 /* One close: charge the ledger, roll the week's news, move the temper a third of the way to where
    the budget says it belongs, settle or spread the unrest, let the council make up its mind, and
    decide whether the crowd is on the boulevard. */
 function tick(state,ctx={},rng=Math.random){
  const f=forecast(state,ctx),k=f.scale,unrest=[];
  const events=rollEvents(state,ctx,rng).map(e=>({text:e.text,gold:Math.round(num(e.gold)*k),mood:num(e.mood)}));
  const eventGold=events.reduce((t,e)=>t+e.gold,0);
  let moodShift=events.reduce((t,e)=>t+e.mood,0);
  const net=f.net+eventGold;
  const before=state.treasury;
  state.treasury=Math.round(state.treasury+net);
  /* unrest: what the budget now covers is dealt with, the rest bites and spreads */
  state.incidents=state.incidents.filter(i=>{
   const def=incidentDef(i.id);
   if(state.budget[def.line]>=def.level){unrest.push('✔ '+def.name+' - dealt with.');moodShift+=2;return false;}
   moodShift+=Math.round(def.mood/3);i.age+=1;return true;
  });
  if(state.incidents.length<MAX_INCIDENTS){
   const chance=clamp(.22+(state.mood<45?.10:0)+(state.budget.watch===0?.08:0),0,.5);
   if(draw(rng)<chance){
    const pool=INCIDENTS.filter(d=>!state.incidents.some(i=>i.id===d.id)&&state.ticks>=num(d.after));
    const def=pickWeighted(pool,rng);
    if(def){
     if(state.budget[def.line]>=def.level){unrest.push('🛡 '+def.name+' - nipped in the bud. '+LINES[def.line].name+' paid for itself.');moodShift+=1;}
     else{state.incidents.push({id:def.id,age:0});unrest.push(def.icon+' '+def.name+'! '+def.fix+'.');}
    }
   }
  }
  state.mood=clamp(Math.round(state.mood+(f.moodTarget-state.mood)*.34+moodShift),0,100);
  /* the council makes up its mind */
  for(const seat of COUNCIL){
   const v=state.council[seat.id];
   state.council[seat.id]=clamp(Math.round(v+(seatTarget(seat,state,f)-v)*.3),0,100);
  }
  if(state.petition){
   state.petition.age+=1;
   if(state.petition.age>=2){
    const p=petitionDef(state.petition.id);
    state.council[p.seat]=clamp(state.council[p.seat]-5,0,100);
    unrest.push('📜 The '+seatDef(p.seat).title+'’s petition lapsed unanswered.');
    state.petition=null;
   }
  }else if(draw(rng)<.35){
   const p=pickWeighted(PETITIONS.map(d=>({...d,w:1})),rng);
   if(p){state.petition={id:p.id,age:0};unrest.push('📜 The '+seatDef(p.seat).title+' brings a petition to the table.');}
  }
  /* 🏦 a good name: interest paid from a treasury in credit builds it, an overdraft burns it */
  if(state.treasury<0)state.credit=Math.round(state.credit*.92);
  else state.credit=clamp(state.credit+(state.loan>0?Math.round(state.loan*LOAN_RATE*2):net>0?Math.round(100*k):0),0,CREDIT_CAP);
  if(!state.protest&&state.mood<PROTEST_START)state.protest=true;
  else if(state.protest&&state.mood>=PROTEST_END)state.protest=false;
  state.ticks+=1;
  state.earned+=f.totalIn+Math.max(0,eventGold);
  state.spent+=f.totalOut+Math.max(0,-eventGold);
  const entry={n:state.ticks,in:f.totalIn,out:f.totalOut,net,events:events.map(e=>e.text),unrest,mood:state.mood,favour:favour(state),
   treasury:state.treasury,protest:state.protest,was:before};
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
  const room=creditLimit(ctx,state)-state.loan,n=Math.min(Math.floor(num(amount)),room);
  if(n<=0)return 0;
  state.loan+=n;state.treasury+=n;state.borrowed+=n;
  return n;
 }
 /* every coin repaid is worth a quarter of itself in new credit */
 function repay(state,amount){
  const n=Math.min(Math.floor(num(amount)),state.loan,Math.max(0,state.treasury));
  if(n<=0)return 0;
  state.loan-=n;state.treasury-=n;state.repaid=num(state.repaid)+n;
  state.credit=clamp(num(state.credit)+Math.round(n*.25),0,CREDIT_CAP);
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
 /* 🥊 pay sellswords, carters or bakers to make one incident go away now, from a treasury that has it */
 function settle(state,ctx,id){
  const i=state.incidents.findIndex(x=>x.id===id);if(i<0)return 0;
  const cost=settleCost(incidentDef(id),ctx);
  if(state.treasury<cost)return 0;
  state.treasury-=cost;state.spent+=cost;state.incidents.splice(i,1);
  state.mood=clamp(state.mood+2,0,100);
  return cost;
 }
 /* 📜 yes or no to the petition on the table */
 function answer(state,ctx,accept){
  const p=state.petition&&petitionDef(state.petition.id);if(!p)return null;
  const k=scale(ctx),cost=Math.round(num(p.cost)*k),gold=Math.round(num(p.gold)*k),bump=(id,d)=>{state.council[id]=clamp(state.council[id]+d,0,100);};
  if(accept){
   if(state.treasury<cost)return {ok:false,text:'The treasury cannot cover '+cost.toLocaleString()+' ◉.'};
   state.treasury+=gold-cost;state.spent+=cost;state.earned+=gold;
   state.mood=clamp(state.mood+num(p.mood),0,100);bump(p.seat,p.favour);
   for(const id of Object.keys(p.others||{}))bump(id,p.others[id]);
   state.petition=null;
   return {ok:true,accepted:true,text:'Granted. The '+seatDef(p.seat).title+' will remember it.'};
  }
  bump(p.seat,-8);state.petition=null;
  return {ok:true,accepted:false,text:'Refused. The '+seatDef(p.seat).title+' bows, stiffly.'};
 }
 return Object.freeze({create,normalize,forecast,tick,advance,setBudget,borrow,repay,withdraw,deposit,settle,answer,councilView,
  creditLimit,favour,favourName,moodName,moodColor,scale,
  TICK_SECONDS,LOAN_RATE,OVERDRAFT_RATE,HISTORY,POPULATION,ROYAL_GUARD,PROTEST_START,PROTEST_END,MAX_INCIDENTS,CREDIT_CAP,
  TAX_RATES,TAX_MOOD,LINES,LINE_KEYS,DEFAULT_BUDGET,EVENTS,INCIDENTS,COUNCIL,PETITIONS});
});
