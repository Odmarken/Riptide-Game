/* 👑 The Crown Ledger - the City's treasury, budget, loans, temper, unrest and council; and on top
 * of those the long game: the rates the crown charges (rents, market fees, duties), public works
 * that are bought once and pay for ever, the learning of the people, how attractive the city is and
 * so how many live in it, a King with a purse, humours and wishes of his own, a gaol that fills and
 * empties, and the realm's trust in YOU - at a hundred the crown is there to be taken. Pure
 * arithmetic with no DOM and no clock of its own: game.js feeds it five minutes of play at a time
 * and paints the result, so the whole thing runs headless in the tests. Amounts are gold per close;
 * a close is one tick. Everything that happens in the city is rolled from the rng handed to tick().
 * 🏦 The money is the Tides Bank's. The strongroom starts EMPTY and the books do not open until the
 * steward signs the founding loan at the council table. From then on play runs in seasons: at the
 * end of each the bank reads the books, grades them, and moves the credit line and the rate. A
 * shortfall is covered from the line at a fee while there is a line; past it the treasury is in the
 * red, and after a close of grace the bailiffs start taking things - the watch, works, the guard. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CityEconomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=2;                 /* a save from before the founding loan opens on an empty strongroom */
 const TICK_SECONDS=300;          /* the ledger closes every five minutes of play */
 const COIN=10;                   /* every gold amount in the tables below is in tens of ◉ */
 const SEASON_CLOSES=20;          /* ⚠ a short season while the system is being tried out - the real one is 50 */
 const FOUNDING_LOAN=500000;      /* what the steward signs for before the books open */
 const RESERVE_LINE=150000;       /* and what the bank keeps on the line beyond it, to be drawn later in the season */
 const LOAN_RATE=0.005;           /* Tides Bank: what is owed costs this much of itself every close, to begin with */
 const MIN_RATE=0.003,MAX_RATE=0.009;
 const RED_FLOOR=0.25;            /* the red never runs deeper than a quarter of the line: past that, bills simply go unpaid */
 const DUE_SHARE=0.10;            /* by the end of a season the debt must be this much smaller than it began */
 const COVER_FEE=0.05;            /* the bank covers a shortfall from the line, and charges for the favour */
 const SEIZE_AFTER=2;             /* consecutive closes in the red before the bailiffs come */
 const SEASONS_KEPT=6;
 const GUARD_WAGE=55,MIN_GUARD=2; /* a man at a pillar, per close; the bank never takes the last two */
 /* 🔔 A city is not run from a dungeon. state.unattended counts the closes since the steward last
    opened the ledger at the council table, and everything that follows from it is a SLOPE, never a
    step: from the first close away the realm's trust drains a little more each close (0.12 per close
    away, to 4 at the most) and what every councillor thinks the steward deserves sinks a point and a
    half per close away (to 40 at the most) - their opinion follows it down at the council's usual
    pace. It is not only the council: a city nobody is seen to run grows uneasy (the temper's target
    sinks 0.6 a close away, to 18) and stops being talked of as a place to move to (its draw sinks
    0.4 a close away, to 12). After REMIND_AFTER closes the chat says so, at every third close;
    NEGLECT_AFTER and NEGLECT_HARD only change how sharply it is worded. */
 const REMIND_AFTER=3,NEGLECT_AFTER=6,NEGLECT_HARD=12;
 const TRUST_SLOPE=0.12,TRUST_DRAIN_MAX=4,SEAT_SLOPE=1.5,SEAT_DRAIN_MAX=40,MOOD_SLOPE=0.6,MOOD_DRAIN_MAX=18,DRAW_SLOPE=0.4,DRAW_DRAIN_MAX=12;
 const neglect=state=>{const n=Math.max(0,num(state&&state.unattended));
  return {closes:n,trust:-Math.min(TRUST_DRAIN_MAX,round1(n*TRUST_SLOPE))||0,seats:Math.min(SEAT_DRAIN_MAX,Math.round(n*SEAT_SLOPE)),
   mood:-Math.min(MOOD_DRAIN_MAX,Math.round(n*MOOD_SLOPE))||0,attract:-Math.min(DRAW_DRAIN_MAX,Math.round(n*DRAW_SLOPE))||0};};
 /* 🌾 The granary. The city eats a sack a head at every close, out of a stock that somebody has to
    keep up: buy grain by the shipment at the council table (the cheap way, if you are there to do
    it), or set the standing shipments going - they bring in what the city eats and a little more
    at every close, gradually, at a quarter over the price. Better transport makes grain cheaper
    and the stores bigger. When the stock runs short, hunger BUILDS - by the share of the city that
    went without, close after close - and eases only slowly once the bread is back: the temper,
    the city's draw and the realm's trust all sink with it, and the hungriest leave. */
 /* bread is a pressing need, not a quarterly errand: the books open on THREE closes of grain, and stores
    filled to the rafters feed the opening city for about eight - so it is the standing shipments, or a
    steward who comes back to the table */
 const FOOD_START=210,FOOD_CAP=600,FOOD_STORE=300,FOOD_PRICE=2,AUTO_PREMIUM=1.25,FOOD_RESERVE=6,HUNGER_MAX=6,FOOD_LOW=3;
 const HUNGER_GAIN=0.6,HUNGER_EASE=0.5;   /* a wholly unfed close adds 0.6: ten closes of nothing to reach the worst of it; a fed one takes half a point back */
 const FOOD_LOTS=[100,200,400];
 /* 🌬 Nothing in the city costs the same two closes running. Three winds wander, each pulled back
    toward calm: TRADE (tolls, exports, customs), the HARVEST (what people can pay in tax and rent,
    and what grain costs) and PRICES (everything the crown buys rather than hires). On top of them
    every close lands a few percent off what the Hand expected, and at every season's end the men on
    the crown's payroll ask for their rise - so a budget nobody touches drifts out of true. The
    forecast is therefore an ESTIMATE; the ledger's history shows what really happened.
    Only a live game blows the winds (ctx.live): the headless arithmetic tests run in still air. */
 const WIND_KEYS=['trade','harvest','prices'],WIND_MAX=0.3,WIND_PULL=0.85,WIND_GUST=0.16,JITTER_IN=0.12,JITTER_OUT=0.06,WAGE_RISE=0.03,WAGE_MAX=3;
 const WIND_NAMES={trade:['slack','quiet','steady','brisk','booming'],harvest:['failed','lean','fair','good','fat'],prices:['cheap','easy','fair','dear','ruinous']};
 const windName=(key,v)=>WIND_NAMES[key][v<-.15?0:v<-.05?1:v<=.05?2:v<=.15?3:4];
 /* 🎲 No two seasons are alike. When a season opens a CARD is dealt for it - what kind of season it
    will be - and the size of everything on the card is rolled too, so even two hard winters differ.
    mods: trade/harvest/prices lean the winds for the whole season; wage multiplies the payroll; eat
    the grain the city gets through; court the cost of the court; church the plate; mood and attract
    pull on the people and the city's draw; trouble adds to the chance of an incident at a close;
    wishes multiplies how often the King wants something; arrive multiplies who comes to the gate
    (and above 1 they come whatever the city is like); sick is the share of the city lost at each
    close. Only a live game deals cards (ctx.live): in still air every season is an ordinary one. */
 const span=(rng,a,b)=>Math.round((a+(b-a)*draw(rng))*1000)/1000;
 const SEASON_CARDS=[
  {id:'ordinary',icon:'📅',name:'An ordinary season',w:2,text:'Nothing in particular is expected of it. Which is not the same as nothing happening.',roll:()=>({})},
  {id:'boom',icon:'⛵',name:'A trade boom',w:1.5,text:'Every road and river is full of other people’s goods, and all of them pay at the gate.',roll:r=>({trade:span(r,.12,.26),attract:3})},
  {id:'slump',icon:'🕸',name:'A slump in trade',w:1.5,text:'The caravans have found somewhere else to be. The market square echoes.',roll:r=>({trade:-span(r,.12,.26)})},
  {id:'bumper',icon:'🌾',name:'A bumper harvest',w:1.5,text:'The barns will not shut. Bread is cheap, purses are full and the tithe barn is fuller.',roll:r=>({harvest:span(r,.12,.25),mood:3})},
  {id:'drought',icon:'☀️',name:'Drought',w:1.5,text:'Not a drop since the spring. What grain there is costs what the seller says it costs.',roll:r=>({harvest:-span(r,.15,.28),mood:-3})},
  {id:'winter',icon:'❄️',name:'A hard winter',w:1.5,text:'The river froze in the first week. Everything is dearer, and the city eats a quarter more to keep warm.',roll:r=>({prices:span(r,.12,.24),eat:span(r,1.15,1.4),mood:-3})},
  {id:'sickness',icon:'☠️',name:'The sweating sickness',w:1,text:'It came in with a ship. The carts go round at dawn. Drains and a hospital blunt it; nothing stops it.',roll:r=>({sick:span(r,.006,.014),mood:-6,attract:-8,church:1.4})},
  {id:'war',icon:'⚔️',name:'War on the border',w:1,text:'Every man who can hold a pike wants paying like a soldier, the roads are not safe and the King has found his grandfather’s armour.',roll:r=>({wage:span(r,1.12,1.3),trade:-span(r,.05,.14),wishes:1.6,trouble:.04})},
  {id:'wedding',icon:'💍',name:'A royal wedding',w:1,text:'A cousin of the King marries in the cathedral. The court costs half as much again, the King wants everything, and the whole realm comes to look.',roll:r=>({court:span(r,1.4,1.8),wishes:2,mood:5,attract:6,trade:span(r,.03,.1)})},
  {id:'pilgrims',icon:'⛪',name:'A year of pilgrimage',w:1,text:'A relic has been seen to weep. The roads are full of the devout, and the plate comes back heavy.',roll:r=>({church:span(r,1.7,2.6),attract:5,trouble:.03})},
  {id:'restless',icon:'🥊',name:'A restless season',w:1.5,text:'Nobody can say why. The apprentices are spoiling for it, and the watch sleeps in its boots.',roll:r=>({trouble:span(r,.1,.2),mood:-2})},
  {id:'refugees',icon:'🧳',name:'Refugees on the roads',w:1,text:'A town down the coast has burned. They are coming whether there is a roof for them or not.',roll:r=>({arrive:span(r,1.8,3),mood:-2,prices:span(r,.04,.1)})},
  {id:'fair',icon:'🎪',name:'The great fair',w:1,text:'Once in a generation the great fair comes to the city. Tolls, thieves and visitors, in that order.',roll:r=>({trade:span(r,.08,.18),trouble:.06,attract:4,mood:3})},
  {id:'dear',icon:'🧾',name:'Dear money',w:1,text:'The banks of three realms have raised their rates together, and everything bought on credit costs more - including the crown.',roll:r=>({prices:span(r,.08,.16),interest:span(r,1.15,1.4)})},
 ];
 const ORDINARY=Object.freeze({id:'ordinary',mods:Object.freeze({})});
 function dealCard(rng,last){
  if(!rng)return {id:'ordinary',mods:{}};
  const pool=SEASON_CARDS.filter(c=>c.id!==last),c=pickWeighted(pool,rng);     /* never the same season twice running */
  return {id:c.id,mods:c.roll(rng)};
 }
 const cardDef=id=>SEASON_CARDS.find(c=>c.id===id)||SEASON_CARDS[0];
 const cardOf=state=>(state.season&&state.season.card)||ORDINARY;
 /* 🧙 what the hero's own trades add is a perk, not a second treasury */
 const HERO_EXPORTS_MAX=60,HERO_FARM_LEVELS=5;
 const OVERDRAFT_RATE=0.01;       /* a treasury below zero costs twice the bank's rate */
 const HISTORY=12;                /* an hour of closes kept on the ledger tab */
 const POPULATION=350;            /* souls within the walls when the books open - the streets show a sample of them, not a head count */
 const POP_MAX=5000;              /* as big as the city can ever get, with every quarter built */
 const HOUSEHOLD=5;               /* the crown counts, taxes, rents and feeds by the household: five heads to a hearth */
 const MIN_POP=30,HOUSING=500,LEAVE_MAX=0.05;      /* the last few never leave; roofs for 96 until more are built */
 const MAX_BUILDING=3;            /* the Master Builder has three crews */
 const CELLS=6,MAX_CELLS=10;      /* the gaol under the hall: six cells, ten with the new wing */
 const COUP_TRUST=100;            /* the realm's trust in you at which the crown can be claimed */
 const ROYAL_GUARD=8;             /* the men at the pillars of the hall, paid before anyone */
 const PROTEST_START=25,PROTEST_END=40;   /* hysteresis, so the crowd does not flicker */
 const MAX_INCIDENTS=2;           /* the city never burns in more than two places at once */
 const TAX_RATES=[0,5,10,15,20,25,30];
 const TAX_MOOD={0:12,5:6,10:0,15:-7,20:-15,25:-25,30:-38};
 const TAX_ATTRACT={0:6,5:3,10:0,15:-3,20:-7,25:-12,30:-18};
 const TAX_NOTE={0:'no tax - the people love you and the treasury starves',5:'a light hand',10:'the customary tithe',
  15:'grumbling in the market',20:'the merchants write letters',25:'the poor go hungry',30:'a rebellion waiting for a spark'};
 /* Every budget line has four levels. cost is gold per close before the prestige scale; mood is
    the pull on the people's temper and attract the pull on how many want to live here; order and
    trade multiply the tolls and customs. */
 const LINES={
  watch:{name:'City Watch',icon:'🛡',blurb:'Patrols on the main streets. Order is what makes a merchant unpack his cart - and what breaks up a brawl.',levels:[
   {name:'Disbanded',men:0,cost:0,mood:-12,order:.55,attract:-10},
   {name:'Standard',men:5,cost:220,mood:0,order:1},
   {name:'Doubled',men:10,cost:460,mood:4,order:1.15,attract:4},
   {name:'Royal',men:15,cost:720,mood:6,order:1.25,attract:6}]},
  roads:{name:'Roads & Walls',icon:'🧱',blurb:'Cobbles, gates and the curtain wall. Good roads carry more trade.',levels:[
   {name:'Neglected',cost:0,mood:-8,trade:.8,attract:-5},
   {name:'Kept',cost:170,mood:0,trade:1},
   {name:'Paved',cost:360,mood:4,trade:1.12,attract:3},
   {name:'Grand',cost:600,mood:8,trade:1.22,attract:6}]},
  relief:{name:'Granary & Poor Relief',icon:'🍞',blurb:'Bread for the tenements. Nothing calms a city like a full granary.',levels:[
   {name:'None',cost:0,mood:-6,attract:-3},
   {name:'Bread dole',cost:140,mood:6},
   {name:'Full granary',cost:300,mood:14,attract:2},
   {name:'Feasts for all',cost:480,mood:22,attract:3}]},
  festival:{name:'Festivals',icon:'🎉',blurb:'Feast days, tournaments and games on the cathedral square. From feast days up, the boulevard is hung with bunting.',levels:[
   {name:'None',cost:0,mood:0},
   {name:'Feast days',cost:120,mood:5,attract:2},
   {name:'Tournaments',cost:280,mood:11,attract:5},
   {name:'Royal games',cost:460,mood:17,attract:8}]},
  court:{name:'The Royal Court',icon:'👑',blurb:'The King’s table, his guests and his tailors. A splendid court draws the gentry, and their gold - and keeps the King sweet.',levels:[
   {name:'Frugal',cost:90,mood:-3,trade:.95,attract:-1,pleasure:-8},
   {name:'Modest',cost:240,mood:0,trade:1},
   {name:'Splendid',cost:480,mood:2,trade:1.05,attract:2,pleasure:5},
   {name:'Lavish',cost:780,mood:4,trade:1.1,attract:4,pleasure:9}]},
  clean:{name:'Street Cleaning',icon:'🧹',blurb:'Sweepers, night-soil carts and rat-catchers. A clean city draws settlers; a filthy one breeds the flux - and you can see which it is from the boulevard.',levels:[
   {name:'Filth',cost:0,mood:-8,attract:-12},
   {name:'Sweepers',cost:110,mood:0},
   {name:'Night carts',cost:250,mood:4,attract:6},
   {name:'Spotless',cost:420,mood:7,attract:10}]},
  learn:{name:'Schools & Learning',icon:'📚',blurb:'Letters and numbers for the children of the city. Slow to pay and it never stops paying: skilled hands earn more, and owe more.',levels:[
   {name:'None',cost:0,mood:-2,skill:-15},
   {name:'Parish schools',cost:120,mood:0,skill:0},
   {name:'Grammar schools',cost:280,mood:2,skill:12,attract:2},
   {name:'Free schooling',cost:480,mood:5,skill:22,attract:4}]},
  food:{name:'Markets & Provisions',icon:'🥩',blurb:'Inspectors at the stalls, honest weights, fresh fish on ice. What the city eats is half of what it thinks of you.',levels:[
   {name:'Scraps',cost:0,mood:-7,attract:-8},
   {name:'Plain fare',cost:100,mood:0},
   {name:'Fresh markets',cost:240,mood:5,attract:5},
   {name:'Plenty',cost:400,mood:9,attract:9}]},
  purse:{name:'The King’s Purse',icon:'💎',blurb:'What the crown pays the one who wears it. A King kept short sulks, helps himself and has people arrested; a King kept well leaves you to your work.',levels:[
   {name:'Pittance',cost:200,mood:2,pleasure:22},
   {name:'Customary',cost:500,mood:0,pleasure:55},
   {name:'Generous',cost:900,mood:-1,pleasure:72},
   {name:'Princely',cost:1400,mood:-3,pleasure:88}]},
 };
 const LINE_KEYS=Object.keys(LINES);
 /* ⚖️ The rates the crown charges. rate is what is taken, vol what it does to the traffic. */
 const RATES={
  rent:{name:'Crown rents',icon:'🏠',blurb:'Half the tenements stand on crown land. What a household pays for its roof, every close.',levels:[
   {name:'Peppercorn',rate:3,mood:5,attract:6},
   {name:'Fair',rate:6,mood:0,attract:0},
   {name:'Dear',rate:9,mood:-6,attract:-8},
   {name:'Rack-rent',rate:13,mood:-14,attract:-18}]},
  fee:{name:'Market fees',icon:'⚖️',blurb:'What a stallholder pays for a pitch. Steep fees fill the treasury and empty the square - count the awnings.',levels:[
   {name:'Free market',rate:.3,vol:1.15,mood:3,attract:5},
   {name:'Customary',rate:1,vol:1,mood:0,attract:0},
   {name:'Steep',rate:1.45,vol:.9,mood:-3,attract:-4},
   {name:'Extortionate',rate:1.9,vol:.75,mood:-8,attract:-10}]},
  duty:{name:'Import duties',icon:'📦',blurb:'Customs on what comes through the gates. A wall of tariffs keeps the wagons off the boulevard.',levels:[
   {name:'Open gates',rate:.4,vol:1.12,mood:0,attract:4},
   {name:'Customary',rate:1,vol:1,mood:0,attract:0},
   {name:'Protective',rate:1.5,vol:.92,mood:-2,attract:-3},
   {name:'Wall of tariffs',rate:2,vol:.78,mood:-6,attract:-9}]},
 };
 /* ⛪ the cathedral's plate: what the crown takes of the tithes and the collections */
 RATES.tithe={name:'The crown’s share of the tithes',icon:'⛪',blurb:'The cathedral takes a tenth of everything and the collections besides. How much of that finds its way to the strongroom is for the steward to say - and for the Tidekeeper, the High Almoner and a pious King to resent.',levels:[
   {name:'Leave it to the Church',rate:0,mood:3,attract:2},
   {name:'The customary share',rate:1,mood:0,attract:0},
   {name:'A heavy share',rate:1.8,mood:-4,attract:-2},
   {name:'Seize the plate',rate:2.8,mood:-11,attract:-5}]};
 const RATE_KEYS=Object.keys(RATES);
 const DEFAULT_BUDGET=Object.freeze({tax:10,rent:1,fee:1,duty:1,tithe:1,watch:1,roads:1,relief:1,festival:0,court:1,clean:1,learn:1,food:1,purse:1});
 /* 🏗 Public works: bought once from the treasury, built over a few closes by one of three crews,
    and then they pay - or please, or teach, or house - for ever, less their upkeep. cost, upkeep
    and the gold in fx are before the prestige scale. needs are works that must stand first. site is
    what the City shows for it (assets/city/city-works.js). fx: exports/tolls/income are gold per
    close, trade/order/duty are added to the multipliers, skill is points of learning, housing is
    roofs, cells is gaol cells, safety takes that much off the chance of trouble at a close. */
 const WORK_CATS=[
  {id:'trade',name:'Transport & Trade',icon:'🚢'},
  {id:'learn',name:'Learning',icon:'📚'},
  {id:'living',name:'Health & Living',icon:'🏥'},
  {id:'culture',name:'Culture & Splendour',icon:'🎭'},
  {id:'order',name:'Law & Order',icon:'⚖️'},
 ];
 const WORKS=[
  {id:'carters',cat:'trade',name:'Carters’ Yard',icon:'🐴',cost:1900,build:1,upkeep:25,fx:{exports:110,trade:.03},site:'house',sign:'CARTERS’ YARD',
   blurb:'Stabling, a wheelwright and a loading dock inside the west gate. Wagons start to roll the boulevard.',done:'The first wagons are on the boulevard.'},
  {id:'caravanserai',cat:'trade',name:'Caravanserai',icon:'🐫',cost:4000,build:2,upkeep:50,needs:['carters'],fx:{tolls:190,attract:3},site:'house',sign:'CARAVANSERAI',
   blurb:'Beds, fodder and a strongroom for the long-haul caravans from Moonshine. They stay, and they spend.',done:'The Moonshine caravans overnight in the city now.'},
  {id:'quay',cat:'trade',name:'Stone Quay',icon:'⚓',cost:5200,build:2,upkeep:60,needs:['carters'],fx:{exports:260},site:'house',sign:'HARBOUR OFFICE',
   blurb:'A proper quay at the river gate in place of the mud landing. Barges load in an hour instead of a day.',done:'Barges are loading at the new quay.'},
  {id:'customs',cat:'trade',name:'Customs House',icon:'🧾',cost:3800,build:2,upkeep:50,fx:{duty:.45,order:.04},site:'house',sign:'CUSTOMS HOUSE',blocks:['smugglers'],
   blurb:'Scales, seals and clerks who cannot be bought cheaply. Nothing slips past the east gate again.',done:'The smugglers will have to find another city.'},
  {id:'fleet',cat:'trade',name:'Merchant Fleet',icon:'⛵',cost:11500,build:3,upkeep:155,needs:['quay'],fx:{exports:630},site:'house',sign:'FLEET COUNTING HOUSE',
   blurb:'Three cogs under the crown’s own flag. The city’s ore and steel sail to foreign courts instead of waiting for buyers.',done:'Three cogs sailed on the morning tide under your flag.'},
  {id:'lighthouse',cat:'trade',name:'Lighthouse',icon:'🗼',cost:6000,build:2,upkeep:50,needs:['quay'],fx:{trade:.07,exports:90},
   blurb:'A fire on the point at the river mouth. Captains who used to pass in the dark put in instead.',done:'The light on the point burned all night.'},
  {id:'exchange',cat:'trade',name:'Merchants’ Exchange',icon:'🏛',cost:15000,build:3,upkeep:130,needs:['fleet','caravanserai'],fx:{trade:.12,income:260,attract:4},site:'house',sign:'THE EXCHANGE',
   blurb:'A pillared hall where cargoes are sold before they land. Every trading house in three realms wants a desk in it.',done:'The Exchange rang its bell for the first time.'},
  {id:'school',cat:'learn',name:'Parish Schoolhouse',icon:'🏫',cost:2800,build:1,upkeep:50,fx:{skill:8,mood:2},site:'house',sign:'SCHOOLHOUSE',
   blurb:'One room, one stove, one master with a birch. The start of everything else on this list.',done:'Forty children learned the letter A.'},
  {id:'apprentice',cat:'learn',name:'Guild Apprenticeships',icon:'🛠',cost:3500,build:1,upkeep:50,needs:['school'],fx:{skill:6,exports:100},site:'house',sign:'APPRENTICE HALL',
   blurb:'The crown pays the indenture; the guilds take the poor boys as well as the masters’ sons.',done:'The guilds took forty new apprentices.'},
  {id:'library',cat:'learn',name:'Public Library',icon:'📖',cost:6200,build:2,upkeep:70,needs:['school'],fx:{skill:10,attract:4},site:'house',sign:'LIBRARY',
   blurb:'Six hundred books, chained to the desks, open to anyone with clean hands.',done:'The library opened its doors.'},
  {id:'press',cat:'learn',name:'Printing Press',icon:'📰',cost:5200,build:2,upkeep:35,needs:['library'],fx:{skill:8,income:80},site:'house',sign:'PRINTING HOUSE',
   blurb:'Almanacs, psalters and a weekly broadsheet. The town crier gets a great deal more to shout about.',done:'The first broadsheet sold out by noon.'},
  {id:'university',cat:'learn',name:'University of the Tides',icon:'🎓',cost:20000,build:4,upkeep:230,needs:['library'],fx:{skill:22,attract:8,income:240},site:'house',sign:'UNIVERSITY',
   blurb:'Law, physic and the natural philosophy of tides. Students come from four realms, and they all pay rent.',done:'The University matriculated its first scholars.'},
  {id:'sewers',cat:'living',name:'Sewers & Drains',icon:'🕳',cost:6500,build:3,upkeep:50,fx:{attract:6,mood:3,clean:1},blocks:['flood','flux'],
   blurb:'Brick drains under the lower streets, out to the river. The rain goes where it is told, and so does everything else.',done:'The lower streets stayed dry in the rain.'},
  {id:'aqueduct',cat:'living',name:'Aqueduct & Fountain',icon:'⛲',cost:10000,build:3,upkeep:60,needs:['sewers'],fx:{attract:7,mood:3},site:'fountain',
   blurb:'Sweet water from the hills, ending in a fountain on the great square.',done:'Water ran in the fountain on the square.'},
  {id:'bathhouse',cat:'living',name:'Public Bathhouse',icon:'🛁',cost:4200,build:2,upkeep:55,fx:{mood:3,attract:3,income:80},site:'house',sign:'BATHHOUSE',
   blurb:'Hot water, a penny a head. The city smells better within the week.',done:'The bathhouse lit its furnaces.'},
  {id:'hospital',cat:'living',name:'Hospital of St Agnes',icon:'🏥',cost:9000,build:3,upkeep:120,fx:{mood:5,attract:5},site:'house',sign:'HOSPITAL',blocks:['flux'],
   blurb:'Forty beds and sisters who wash their hands. The flux stops at its door.',done:'The sisters took in their first patients.'},
  {id:'coveredmarket',cat:'living',name:'Covered Market',icon:'🏪',cost:5000,build:2,upkeep:45,fx:{tolls:230,attract:2},site:'stalls',
   blurb:'Pitches under cover on the great square, let by the season. Twice the stalls, in any weather.',done:'The square filled with new awnings.'},
  {id:'tenements',cat:'living',name:'New Tenements',icon:'🏘',cost:6000,build:2,upkeep:0,fx:{housing:500},site:'house',sign:'NEW TENEMENTS',
   blurb:'Four storeys of sound brick on crown land, street after street. Roofs for five hundred more - who will all pay rent and poll tax.',done:'Five hundred more have a roof.'},
  {id:'newquarter',cat:'living',name:'The New Quarter',icon:'🏙',cost:14000,build:4,upkeep:50,needs:['tenements','sewers'],fx:{housing:1500,attract:3},site:'house',sign:'THE NEW QUARTER',
   blurb:'A planned district with drains, a well on every corner and room for fifteen hundred.',done:'The New Quarter was opened with a ribbon and a band.'},
  {id:'suburbs',cat:'living',name:'Suburbs beyond the Wall',icon:'🏡',cost:18000,build:4,upkeep:60,needs:['newquarter','watchtowers'],fx:{housing:1200,attract:2},
   blurb:'Timber streets outside the gates, under the eye of the new towers. Room for twelve hundred who could never afford the walls.',done:'Smoke rose from a thousand new chimneys beyond the wall.'},
  {id:'riverside',cat:'living',name:'The Riverside District',icon:'🌉',cost:24000,build:4,upkeep:80,needs:['newquarter','quay','aqueduct'],fx:{housing:1300,attract:4,tolls:120},
   blurb:'Warehouses below, lodgings above, the whole bank of the river built up from the quay to the mill. The last great quarter: with it the city can hold five thousand.',done:'The Riverside District was opened. The city can hold five thousand souls.'},
  {id:'lamps',cat:'culture',name:'Street Lamps',icon:'🏮',cost:3000,build:1,upkeep:45,fx:{order:.05,attract:4,mood:2},site:'lamps',
   blurb:'Oil lamps the length of the great boulevard, and lamplighters to tend them.',done:'The boulevard was lit from gate to palace.'},
  {id:'gardens',cat:'culture',name:'Royal Gardens',icon:'🌳',cost:4800,build:2,upkeep:55,fx:{attract:6,mood:3},site:'garden',
   blurb:'Flower beds and young limes on the great square, open to all.',done:'The gardens on the square came into flower.'},
  {id:'theatre',cat:'culture',name:'Playhouse',icon:'🎭',cost:7000,build:2,upkeep:70,fx:{mood:5,attract:5,income:90},site:'house',sign:'PLAYHOUSE',
   blurb:'A wooden O with a thatched gallery. Tragedies on Mondays.',done:'The Playhouse opened with a comedy about a tax collector.'},
  {id:'arena',cat:'culture',name:'Tourney Grounds',icon:'🏇',cost:11000,build:3,upkeep:95,fx:{mood:4,attract:6,income:210},site:'house',sign:'TOURNEY LISTS',
   blurb:'Permanent lists with stands for two thousand. Knights come for the prize; the crowd comes for the knights.',done:'The lists saw their first broken lance.'},
  {id:'statue',cat:'culture',name:'Statue of the Steward',icon:'🗿',cost:3200,build:1,upkeep:0,fx:{attract:2},site:'statue',once:{trust:5,pleasure:-8},
   blurb:'You, in bronze, on the great square. The people will like it. The King will not.',done:'Your statue was unveiled on the square.'},
  {id:'watchtowers',cat:'order',name:'Watchtowers',icon:'🗼',cost:4000,build:2,upkeep:55,fx:{order:.08,safety:.06},
   blurb:'Manned towers on the curtain wall with bells that carry to every ward. Trouble is seen before it starts.',done:'The tower bells were tested. The whole city jumped.'},
  {id:'courthouse',cat:'order',name:'Courthouse',icon:'⚖️',cost:6000,build:2,upkeep:70,fx:{mood:2,fines:1},site:'house',sign:'COURTHOUSE',once:{trust:3},
   blurb:'Judges, juries and written law. Fines double, and the gaol pays a little of its own way.',done:'The first case was heard in open court.'},
  {id:'gaolwing',cat:'order',name:'New Gaol Wing',icon:'⛓',cost:3200,build:1,upkeep:30,fx:{cells:4},
   blurb:'Four more cells under the hall. Nobody sleeps three to a bench any more.',done:'Four new cells were unlocked under the hall.'},
 ];
 /* What happens between closes. gold and mood are before the prestige scale; when() gates an
    event on the budget, so a disbanded watch is what lets the smugglers in. tag is what a finished
    work can put a stop to (WORKS.blocks). */
 const has=(s,id)=>!!(s&&s.works&&s.works[id]&&s.works[id].left===0);
 const EVENTS=[
  {text:'A trade caravan from Moonshine paid its tolls at the west gate.',gold:260,w:3},
  {text:'The fishing fleet came home heavy and the fish market overflowed.',gold:220,w:3},
  {text:'The Tides Guild settled its dues with the crown.',gold:180,w:2},
  {text:'A noble wedding filled every inn on the cathedral square.',gold:320,mood:2,w:2,when:s=>s.budget.court>=2},
  {text:'Fire in the tenements - the watch fought it through the night.',gold:-300,mood:-3,w:2,when:s=>s.budget.watch>=1},
  {text:'Fire in the tenements and nobody left to fight it.',gold:-450,mood:-8,w:3,when:s=>s.budget.watch===0},
  {text:'Smugglers slipped past the east gate under cover of dark.',gold:-200,w:3,tag:'smugglers',when:s=>s.budget.watch<=1},
  {text:'Rats got into the granary.',gold:-150,mood:-4,food:-.15,w:2,when:s=>s.budget.relief<=1},
  {text:'The cathedral held a feast day and the whole city turned out.',mood:5,w:3},
  {text:'A week of rain flooded the lower streets.',gold:-120,mood:-3,w:2,tag:'flood',when:s=>s.budget.roads<=1},
  {text:'The Mining Hall struck a rich seam.',gold:280,w:2,when:(s,c)=>!!c.miningTrained},
  {text:'An emerald cut in the Enchanting Hall sold to a foreign court.',gold:300,w:2,when:(s,c)=>!!c.enchTrained},
  {text:'The tournament drew knights from three realms.',gold:240,mood:3,w:2,when:s=>s.budget.festival>=2},
  {text:'A travelling circus pitched its tents outside the wall.',mood:4,gold:90,w:2},
  {text:'A merchant prince opened a counting house on the boulevard.',gold:340,w:1.5,when:s=>s.mood>=60},
  {text:'A preacher in the square blamed the crown for the price of bread.',mood:-4,w:2,when:s=>s.mood<50},
  {text:'Wolves took sheep from the farms beyond the wall.',gold:-110,mood:-2,w:1.5},
  {text:'The flux went through the lower wards. The carts were busy for a week.',gold:-260,mood:-6,pop:-18,w:2.5,tag:'flux',when:s=>s.budget.clean===0},
  {text:'Spoiled meat at the shambles put half a street to bed.',gold:-90,mood:-4,w:2,when:s=>s.budget.food===0},
  {text:'The fleet came home from the southern ports with its holds full of silver.',gold:520,w:2,when:s=>has(s,'fleet')},
  {text:'A scholar of the University published a treatise the whole continent is reading.',gold:160,mood:2,w:1.5,when:s=>has(s,'university')},
  {text:'The Playhouse’s new comedy ran for three weeks to full houses.',gold:140,mood:3,w:1.5,when:s=>has(s,'theatre')},
  {text:'A guild of weavers moved to the city, looms and all.',gold:120,pop:22,w:1.5,when:s=>s.attract>=65},
  {text:'Three families loaded a cart and left by the west gate before dawn.',pop:-15,mood:-1,w:2,when:s=>s.attract<35},
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
  {id:'middens',name:'Middens in the streets',icon:'🪰',text:'The heaps are waist high on the lower streets and the flies have opinions. Families with anywhere else to go are going.',line:'clean',level:2,fix:'Send out the night carts (Street Cleaning)',mood:-5,gold:-60,w:2.5},
  {id:'shortweight',name:'Short weight at the stalls',icon:'⚖️',text:'Chalk in the flour and thumbs on the scales. Without inspectors the honest stallholders are being driven out.',line:'food',level:2,fix:'Fund fresh markets (Markets & Provisions)',mood:-4,gold:-120,w:2},
  {id:'royalists',name:'Royalists in the cellars',icon:'🕯',text:'Men who drank the old King’s wine meet behind shuttered windows. A crown that is not trusted is a crown that can be taken back.',line:'watch',level:3,fix:'Raise the City Watch to Royal',mood:-5,gold:-280,w:4,when:s=>s.crowned&&s.trust<40},
 ];
 /* 🏛 The council: six seats at the table, each with a line of the budget they watch and an opinion
    of you that drifts toward what that line deserves. Their favour together is your standing. */
 const COUNCIL=[
  {id:'coin',title:'Master of Coin',who:'Gottfrid Pung',icon:'🪙',cares:'a ledger in the black, and a small debt'},
  {id:'sword',title:'Lord Commander',who:'Brynolf Järnhand',icon:'⚔️',line:'watch',cares:'men on the streets'},
  {id:'stone',title:'Master Builder',who:'Hallvard Städ',icon:'🧱',line:'roads',cares:'roads, gates and walls - and anything you let him build'},
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
  {id:'amnesty',seat:'bread',text:'Free the debtors from the gaol. They cannot pay from a cell.',cost:0,favour:10,mood:5,others:{coin:-8},amnesty:true},
  {id:'tourney',seat:'revel',text:'A tourney in the King’s name. The whole realm will talk of it.',cost:1300,favour:14,mood:7,gold:500},
  {id:'fireworks',seat:'revel',text:'Fire-flowers from the east for midsummer night. Trust me.',cost:700,favour:10,mood:5},
  {id:'banquet',seat:'chamber',text:'A banquet for the envoys of three realms. We are judged by our table.',cost:1500,favour:14,mood:1,gold:700},
  {id:'audit',seat:'coin',text:'Let me audit the guild books. They will grumble, and they will pay what they owe.',cost:0,favour:10,mood:-4,gold:1400},
  {id:'levy',seat:'coin',text:'A single levy on the counting houses. The people will not weep for bankers.',cost:0,favour:8,mood:2,gold:1100,others:{chamber:-6}},
  {id:'mint',seat:'coin',text:'Strike a new coinage with less silver in it. Nobody will notice for a year.',cost:0,favour:6,mood:-7,gold:2200,others:{bread:-8}},
 ];
 /* 👑 The King. His humour changes every few closes and colours what he asks for and how often;
    his pleasure drifts toward what his purse and his court deserve, and jumps with every wish
    granted or refused. cost is before the prestige scale; trust is what the realm makes of your
    answer - the people hear when you say no to a lion. */
 const HUMOURS=[
  {id:'content',name:'Content',icon:'🙂',chance:.16,say:'The King is in good humour and asks for little.'},
  {id:'needy',name:'Needy',icon:'🥺',chance:.45,say:'The King feels unloved, and has decided that gold is how love is shown.'},
  {id:'restless',name:'Restless',icon:'🏇',chance:.36,say:'The King is bored of his hall and wants to DO things.'},
  {id:'pious',name:'Pious',icon:'🙏',chance:.24,say:'The King has been to confession and is thinking about his soul.'},
  {id:'warlike',name:'Warlike',icon:'⚔️',chance:.30,say:'The King has been reading about his grandfather’s wars.'},
  {id:'melancholy',name:'Melancholy',icon:'🌧',chance:.26,say:'The King sits at the window and sighs.'},
 ];
 const DEMANDS=[
  {id:'crown',text:'This crown pinches. I want a new one - lighter, and with more rubies.',cost:1600,pleasure:14,mood:-3,refuseTrust:1,likes:['needy']},
  {id:'hunt',text:'A royal hunt in the northern forest. A week, forty riders, the good tents.',cost:700,pleasure:10,likes:['restless','warlike']},
  {id:'barge',text:'Every king I know has a gilded barge. Build me a gilded barge.',cost:2600,pleasure:16,mood:-4,refuseTrust:2,likes:['needy','restless']},
  {id:'portrait',text:'The painter from the south is in the city. He shall paint me. Large.',cost:500,pleasure:8,likes:['needy','melancholy']},
  {id:'horses',text:'Twelve war horses from the island studs. A king cannot ride to war on a carthorse.',cost:1200,pleasure:10,favour:{sword:4},likes:['warlike','restless']},
  {id:'allowance',text:'My purse is an insult. Raise it - for good - and we shall say no more about it.',cost:0,pleasure:15,raise:1,refuseTrust:1,likes:['needy']},
  {id:'nameday',text:'My name-day is coming. A feast, and the leavings to the poor so they may toast me.',cost:1100,pleasure:12,mood:3,likes:['content','needy']},
  {id:'wing',text:'The palace wants a summer wing, facing the river. I have drawn it myself.',cost:3200,pleasure:18,mood:-5,refuseTrust:2,likes:['needy']},
  {id:'relic',text:'A golden reliquary for the cathedral, given in my name.',cost:900,pleasure:9,mood:2,favour:{bread:4},likes:['pious']},
  {id:'lion',text:'I am told there is a lion for sale in Moonshine. I want it.',cost:1400,pleasure:12,attract:2,refuseTrust:1,likes:['restless','needy']},
  {id:'tailor',text:'A tailor from the southern court, and the cloth to go with him.',cost:600,pleasure:8,likes:['needy','melancholy']},
  {id:'progress',text:'I shall make a progress through the realm and be seen by my people. With the full household.',cost:1800,pleasure:12,mood:2,likes:['restless']},
  {id:'parade',text:'Parade the guard and the watch past my balcony. In new surcoats.',cost:1000,pleasure:10,favour:{sword:5},likes:['warlike']},
  {id:'musicians',text:'Send for the blind harper and his consort. Nothing else will lift this mood.',cost:650,pleasure:11,likes:['melancholy']},
  {id:'pilgrimage',text:'I will walk barefoot to the shrine at the coast. Carried, part of the way. The household comes.',cost:1300,pleasure:11,mood:1,likes:['pious']},
  {id:'poet',text:'That poet who rhymed “Alarik” with “barbaric”. In irons. Tonight.',cost:0,pleasure:8,mood:-4,trust:-2,refuseTrust:2,arrest:{name:'Poeten Loke Rim',skin:'male',crime:'rhymed the King’s name with “barbaric”',term:6},likes:['warlike','melancholy','needy']},
 ];
 /* ⛓ The gaol. At every close the watch may bring somebody in - a real townsperson from the roster
    game.js hands over, who then is not on the streets until the term is served. when() makes the
    crime fit the city: taxes are dodged when they are high, bread is stolen when there is none. */
 const CRIMES=[
  {text:'stole a ham from a market stall',term:[2,4],w:3,say:'It fell into my coat. Hams do that.'},
  {text:'sold watered ale by the quart',term:[2,3],w:2,say:'It was a HOT day. The ale sweated.'},
  {text:'sang a rude song about the King outside the palace',term:[1,3],w:2,say:'It scanned, though. You have to give me that.'},
  {text:'brawled on the boulevard',term:[1,2],w:2,say:'He started it. I finished it. Twice.',boost:s=>s.incidents.some(i=>i.id==='brawl')?4:0},
  {text:'picked a merchant’s pocket at the west gate',term:[3,5],w:2,say:'I was only warming my hand.',boost:s=>s.incidents.some(i=>i.id==='thieves')?4:0},
  {text:'hid three sacks of wool from the tax collector',term:[2,4],w:1,say:'Twenty-five in the hundred! They should be in here, not me.',boost:s=>s.budget.tax>=20?5:0},
  {text:'stole bread for the children',term:[1,2],w:1,say:'Would you not have?',boost:s=>s.budget.relief===0?6:s.budget.relief===1?1:0},
  {text:'poached a deer from the King’s forest',term:[3,6],w:1.5,say:'It was a very slow deer.'},
  {text:'smuggled brandy past the east gate',term:[3,5],w:1.5,say:'Medicinal. For my aunt.',boost:s=>s.budget.duty>=2?3:0},
  {text:'owed four months’ rent on a crown tenement',term:[2,4],w:1,say:'Thirteen a head! Who has thirteen a head?',boost:s=>s.budget.rent>=2?4:0},
  {text:'ran a crooked cup game on the cathedral square',term:[2,3],w:1.5,say:'Sebbe does it every day and nobody arrests HIM.'},
  {text:'threw a cabbage at the Lord Chamberlain',term:[1,2],w:1.5,say:'I was aiming for his hat.'},
  {text:'kept a pig in the cathedral crypt',term:[1,3],w:1,say:'She likes the cool.'},
  {text:'forged the Master of Coin’s seal',term:[4,6],w:1,say:'Mine was better than his. That is what upset them.'},
  {text:'slept in the fountain, drunk, with no breeches',term:[1,2],w:1.5,say:'I have no memory of the matter and no wish to acquire one.'},
  {text:'led the march on the boulevard',term:[3,5],w:0,say:'You can lock me up. You cannot lock up hunger.',boost:s=>s.protest?8:0},
 ];
 const FALLBACK_ROSTER=[['Nils Tång','male'],['Märit Sill','female'],['Olle Krok','male'],['Ragna Tjärn','market_woman'],['Pelle Lod','male'],['Stina Rev','baker'],
  ['Jöns Skot','male'],['Britta Ask','female'],['Lars Bom','blacksmith'],['Ebba Nät','market_woman'],['Truls Köl','male'],['Malin Garn','female']];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
 const round1=v=>Math.round(v*10)/10;
 const group=key=>LINES[key]||RATES[key];
 const level=(key,i)=>{const L=group(key).levels;return L[clamp(Math.floor(num(i,DEFAULT_BUDGET[key])),0,L.length-1)];};
 const incidentDef=id=>INCIDENTS.find(d=>d.id===id);
 const petitionDef=id=>PETITIONS.find(d=>d.id===id);
 const seatDef=id=>COUNCIL.find(d=>d.id===id);
 const workDef=id=>WORKS.find(d=>d.id===id);
 const demandDef=id=>DEMANDS.find(d=>d.id===id);
 const humourDef=id=>HUMOURS.find(d=>d.id===id)||HUMOURS[0];
 const draw=rng=>clamp(num(rng(),.5),0,.999999);
 function pickWeighted(pool,rng){
  const total=pool.reduce((t,e)=>t+e.w,0);
  let pick=draw(rng)*total;
  for(const e of pool){pick-=e.w;if(pick<0)return e;}
  return pool[pool.length-1]||null;
 }
 function create(){
  const council={};for(const seat of COUNCIL)council[seat.id]=60;
  return {v:VERSION,chartered:false,treasury:0,loan:0,limit:0,rate:LOAN_RATE,mood:60,clock:0,ticks:0,earned:0,spent:0,borrowed:0,repaid:0,protest:false,
   guards:ROYAL_GUARD,arrears:0,seizeI:0,seized:[],season:null,seasons:[],reviewSeen:true,unattended:0,food:{stock:0,auto:false,hunger:0},
   wage:1,winds:{trade:0,harvest:0,prices:0},
   budget:{...DEFAULT_BUDGET},incidents:[],council,petition:null,
   pop:POPULATION,attract:50,skill:20,trust:10,crowned:false,deposed:null,
   king:{pleasure:60,humour:'content',humourAge:0,demand:null,raise:0},works:{},jail:[],
   history:[],last:null};
 }
 function normalize(s){
  const out=create();
  if(!s||typeof s!=='object'||s.v!==VERSION)return out;   /* 🏦 older books are closed: everybody starts from the empty strongroom */
  out.chartered=!!s.chartered;
  out.limit=Math.max(0,Math.round(num(s.limit,0)));
  out.rate=clamp(num(s.rate,LOAN_RATE),MIN_RATE,MAX_RATE);
  out.guards=clamp(Math.round(num(s.guards,ROYAL_GUARD)),MIN_GUARD,ROYAL_GUARD);
  out.arrears=Math.max(0,Math.floor(num(s.arrears,0)));out.seizeI=Math.max(0,Math.floor(num(s.seizeI,0)));
  out.seized=(Array.isArray(s.seized)?s.seized:[]).filter((id,i,a)=>workDef(id)&&a.indexOf(id)===i);
  out.reviewSeen=s.reviewSeen!==false;
  out.unattended=Math.max(0,Math.floor(num(s.unattended,0)));
  out.wage=clamp(Math.round(num(s.wage,1)*1e4)/1e4,1,WAGE_MAX);
  for(const key of WIND_KEYS)out.winds[key]=clamp(Math.round(num(s.winds&&s.winds[key],0)*1e3)/1e3,-WIND_MAX,WIND_MAX);
  const fd=s.food&&typeof s.food==='object'?s.food:{};
  out.food={stock:Math.max(0,Math.round(num(fd.stock,0))),auto:!!fd.auto,hunger:clamp(Math.round(num(fd.hunger,0)*100)/100,0,HUNGER_MAX)};
  const point=q=>({t:Math.round(num(q&&q.t)),d:Math.max(0,Math.round(num(q&&q.d))),n:Math.round(num(q&&q.n))});
  const series=a=>(Array.isArray(a)?a:[]).slice(0,SEASON_CLOSES).map(point);
  if(out.chartered){
   const q=s.season&&typeof s.season==='object'?s.season:{};
   const cm={};if(q.card&&typeof q.card==='object'&&q.card.mods&&typeof q.card.mods==='object')for(const key of Object.keys(q.card.mods))if(Number.isFinite(Number(q.card.mods[key])))cm[key]=Number(q.card.mods[key]);
   out.season={n:Math.max(1,Math.floor(num(q.n,1))),card:{id:cardDef(q.card&&q.card.id).id,mods:cardDef(q.card&&q.card.id).id==='ordinary'?{}:cm},closes:0,startLoan:Math.max(0,Math.round(num(q.startLoan,num(s.loan)))),startTreasury:Math.round(num(q.startTreasury,num(s.treasury))),
    target:Math.max(0,Math.round(num(q.target,0))),red:Math.max(0,Math.floor(num(q.red,0))),covered:Math.max(0,Math.floor(num(q.covered,0))),interest:Math.max(0,Math.round(num(q.interest,0))),series:series(q.series)};
   out.season.closes=out.season.series.length;
   out.seasons=(Array.isArray(s.seasons)?s.seasons:[]).filter(x=>x&&typeof x==='object'&&'ABCDF'.includes(x.grade)).slice(-SEASONS_KEPT)
    .map(x=>({...x,series:series(x.series)}));
  }
  out.treasury=Math.round(num(s.treasury,out.treasury));
  out.loan=Math.max(0,Math.round(num(s.loan,0)));
  out.mood=clamp(Math.round(num(s.mood,out.mood)),0,100);
  out.clock=clamp(num(s.clock,0),0,TICK_SECONDS);
  out.ticks=Math.max(0,Math.floor(num(s.ticks,0)));
  for(const k of ['earned','spent','borrowed','repaid'])out[k]=Math.max(0,Math.round(num(s[k],0)));
  out.protest=!!s.protest;
  const b=s.budget||{};
  out.budget.tax=TAX_RATES.includes(num(b.tax,10))?num(b.tax,10):10;
  for(const k of LINE_KEYS.concat(RATE_KEYS))out.budget[k]=group(k).levels.indexOf(level(k,b[k]));
  const seen=new Set();
  out.incidents=(Array.isArray(s.incidents)?s.incidents:[]).filter(i=>i&&incidentDef(i.id)&&!seen.has(i.id)&&seen.add(i.id))
   .slice(0,MAX_INCIDENTS).map(i=>({id:i.id,age:Math.max(0,Math.floor(num(i.age,0)))}));
  for(const seat of COUNCIL)out.council[seat.id]=clamp(Math.round(num(s.council&&s.council[seat.id],60)),0,100);
  out.petition=s.petition&&petitionDef(s.petition.id)?{id:s.petition.id,age:Math.max(0,Math.floor(num(s.petition.age,0)))}:null;
  /* the long game - every field is new to a save from before it, and takes its opening value */
  out.pop=clamp(Math.round(num(s.pop,POPULATION)),MIN_POP,POP_MAX);
  out.attract=clamp(Math.round(num(s.attract,50)),0,100);
  out.skill=clamp(round1(num(s.skill,20)),0,100);
  out.trust=clamp(round1(num(s.trust,10)),0,100);
  out.crowned=!!s.crowned;
  out.deposed=out.crowned?(s.deposed==='exile'?'exile':'gaol'):null;
  const k=s.king||{};
  out.king={pleasure:clamp(Math.round(num(k.pleasure,60)),0,100),humour:humourDef(k.humour).id,humourAge:Math.max(0,Math.floor(num(k.humourAge,0))),
   demand:!out.crowned&&k.demand&&demandDef(k.demand.id)?{id:k.demand.id,age:Math.max(0,Math.floor(num(k.demand.age,0)))}:null,
   raise:clamp(Math.floor(num(k.raise,0)),0,4)};
  for(const id of Object.keys(s.works&&typeof s.works==='object'?s.works:{})){
   const def=workDef(id),w=s.works[id];
   if(def&&w)out.works[id]={left:clamp(Math.floor(num(w.left,0)),0,def.build)};
  }
  const names=new Set();
  out.jail=(Array.isArray(s.jail)?s.jail:[]).filter(p=>p&&typeof p.name==='string'&&p.name&&!names.has(p.name)&&names.add(p.name)).slice(0,MAX_CELLS+2)
   .map(p=>({name:p.name.slice(0,60),skin:typeof p.skin==='string'?p.skin:'male',female:!!p.female,crime:String(p.crime||'disturbed the King’s peace').slice(0,160),
    say:String(p.say||'').slice(0,200),term:Math.max(1,Math.floor(num(p.term,2))),served:Math.max(0,Math.floor(num(p.served,0))),life:!!p.life,byKing:!!p.byKing}));
  out.history=Array.isArray(s.history)?s.history.filter(h=>h&&typeof h==='object').slice(-HISTORY):[];
  out.last=out.history.length?out.history[out.history.length-1]:null;
  return out;
 }
 /* One city, one currency: the tables are in tens of ◉ and that is all the scale there is. The
    founding loan is 500 000 for every steward, so the prices have to be the same for every steward. */
 function scale(){return COIN;}
 function favour(state){const c=(state&&state.council)||{};return Math.round(COUNCIL.reduce((t,s)=>t+num(c[s.id],60),0)/COUNCIL.length);}
 function favourName(v){return v<25?'Hostile':v<40?'Cold':v<60?'Wary':v<75?'Supportive':'Devoted';}
 /* 🏦 What the Tides Bank will lend: the line it set at the last season's review (the founding
    loan and a reserve, to begin with), and a tenth on top when the council stands behind you. */
 function creditLimit(ctx,state){
  if(!state)return FOUNDING_LOAN+RESERVE_LINE;
  return Math.round(num(state.limit)*(favour(state)>=75?1.1:1));
 }
 const frozen=state=>state.treasury<0;         /* in the red nothing may be raised and nothing ordered */
 function moodName(m){return m<PROTEST_START?'Rioting':m<PROTEST_END?'Restless':m<55?'Uneasy':m<70?'Content':m<85?'Prosperous':'Jubilant';}
 function moodColor(m){return m<PROTEST_START?'#ff6f61':m<PROTEST_END?'#ff9f6b':m<55?'#e6c46a':m<70?'#bfe08a':'#8ee6a8';}
 function attractName(a){return a<15?'Shunned':a<35?'Emptying':a<55?'Ordinary':a<75?'Sought after':a<90?'Thriving':'The jewel of the realm';}
 function trustName(t){return t<15?'A stranger':t<35?'The King’s clerk':t<55?'A steady hand':t<75?'The people’s steward':t<COUP_TRUST?'The realm’s favourite':'Crown-worthy';}
 function pleasureName(p){return p<30?'Furious':p<45?'Sulking':p<65?'Tolerant':p<80?'Pleased':'Delighted';}
 function settleCost(def,ctx){return Math.round((600+def.level*500)*scale(ctx));}
 /* everything the finished works add up to */
 function worksFx(state){
  const t={exports:0,tolls:0,income:0,trade:0,order:0,duty:0,mood:0,attract:0,skill:0,housing:0,cells:0,safety:0,fines:0,clean:0,upkeep:0,count:0,blocks:new Set()};
  for(const w of WORKS){
   if(!has(state,w.id))continue;
   t.upkeep+=num(w.upkeep);t.count++;
   for(const key of Object.keys(w.fx||{}))t[key]+=w.fx[key];
   for(const tag of w.blocks||[])t.blocks.add(tag);
  }
  return t;
 }
 const cells=state=>Math.min(MAX_CELLS,CELLS+worksFx(state).cells);
 const hearths=state=>Math.ceil(state.pop/HOUSEHOLD);                                  /* 🏠 households: what is taxed, rented to and fed */
 const eats=state=>{const c=state.season&&state.season.card;return c&&c.mods&&Number.isFinite(c.mods.eat)?c.mods.eat:1;};   /* a hard winter eats more */
 /* 🌾 what grain costs here, how much the stores hold, and what the standing shipments will bring at the next close */
 function foodView(state,ctx={}){
  const k=scale(ctx),F=state.food,need=Math.ceil(hearths(state)*eats(state));
  const cuts=[['carters','Carters’ Yard',.05],['quay','Stone Quay',.10],['fleet','Merchant Fleet',.10],['coveredmarket','Covered Market',.05]].filter(c=>has(state,c[0])).map(c=>({name:c[1],cut:c[2]}));
  if(ctx.farmOwned)cuts.push({name:'Your own farm',cut:.10});
  const discount=cuts.reduce((t,c)=>t+c.cut,0);
  const harvest=num(state.winds&&state.winds.harvest)+num(cardOf(state).mods.harvest);        /* a lean harvest is dear bread */
  const price=Math.max(1,Math.round(FOOD_PRICE*k*(1-discount)*(1-harvest*.8))),autoPrice=Math.max(1,Math.round(price*AUTO_PREMIUM));
  const cap=FOOD_CAP+(has(state,'coveredmarket')?FOOD_STORE:0)+(has(state,'quay')?FOOD_STORE:0)+(has(state,'newquarter')?FOOD_STORE:0);
  /* gradually: what the city eats, and a quarter of the way to a reserve of six closes - as far as the strongroom can pay */
  const want=F.auto?Math.min(Math.max(0,cap-F.stock),need+Math.max(0,Math.ceil((FOOD_RESERVE*need-F.stock)/4))):0;
  const means=Math.max(0,state.treasury)+(state.chartered?Math.max(0,creditLimit(ctx,state)-state.loan):0);   /* the strongroom, and what is left on the line */
  const sacks=F.auto?Math.min(want,Math.floor(means/autoPrice)):0;
  return {stock:F.stock,need,cap,closes:need>0?Math.floor(F.stock/need):99,price,autoPrice,discount,cuts,auto:F.auto,hunger:F.hunger,lots:FOOD_LOTS,room:Math.max(0,cap-F.stock),
   ship:{sacks,cost:sacks*autoPrice,short:F.auto&&sacks<Math.min(want,need)},low:need>0&&F.stock<need*FOOD_LOW,harvest:windName('harvest',harvest)};
 }
 /* a shipment bought at the table: as many sacks as asked for, as the stores have room for, as the treasury can pay */
 function buyFood(state,ctx,sacks){
  const v=foodView(state,ctx),n=Math.min(Math.floor(num(sacks)),v.room,state.treasury>0?Math.floor(state.treasury/v.price):0);
  if(n<=0)return {ok:false,text:v.room<=0?'The stores are full to the rafters.':'The treasury cannot pay for a single sack.'};
  state.treasury-=n*v.price;state.spent+=n*v.price;state.food.stock+=n;
  return {ok:true,sacks:n,cost:n*v.price,text:n.toLocaleString()+' sacks of grain bought for '+(n*v.price).toLocaleString()+' ◉. The granary holds bread for '+Math.floor(state.food.stock/Math.max(1,Math.ceil(hearths(state)*eats(state))))+' closes.'};
 }
 function setAutoFood(state,on){state.food.auto=!!on;return state.food.auto;}
 /* The whole ledger for one close, before it happens. Everything the panel shows comes from here -
    as the Hand's ESTIMATE: in a live game the close lands a few percent either side of it. */
 function forecast(state,ctx={}){
  const k=scale(ctx),b=state.budget,r=v=>Math.round(v);
  const L={};for(const key of LINE_KEYS.concat(RATE_KEYS))L[key]=level(key,b[key]);
  const {watch,roads,relief,festival,court,clean,learn,food,purse,rent,fee,duty,tithe}=L;
  const W=worksFx(state),K=state.king,crowned=!!state.crowned;
  const fav=favour(state),backing=fav>=75?1.06:1;
  const card=cardOf(state),cm=card.mods,churchMod=num(cm.church,1);
  const wind={trade:num(state.winds&&state.winds.trade)+num(cm.trade),harvest:num(state.winds&&state.winds.harvest)+num(cm.harvest),prices:num(state.winds&&state.winds.prices)+num(cm.prices)};
  const wage=num(state.wage,1)*num(cm.wage,1),dear=1+wind.prices,crop=1+wind.harvest*.6;
  /* 🏙 a bigger city costs more to run: what serves the streets grows with the head count (not quite
     in step - there are economies in size), and a King of five thousand expects more than a King of 350 */
  const heads=Math.max(state.pop,POPULATION/2)/POPULATION,big=Math.pow(heads,.8),grand=Math.pow(heads,.5);
  const factor={watch:wage*big,roads:wage*big,learn:wage*big,clean:wage*dear*big,relief:dear*big,festival:dear*big,food:dear*big,court:dear*grand*num(cm.court,1),purse:wage*grand*(1+.15*num(K.raise))};
  const order=watch.order+W.order,trade=roads.trade*court.trade*backing*duty.vol*(1+W.trade)*(1+wind.trade);
  const temper=.7+state.mood/333;             /* the restless dodge the tax man: 0.7 at 0, 1.0 at 100 */
  const craft=1+(state.skill-20)*.004;        /* 📚 learned hands earn more: 1.0 at 20, 1.32 at 100 */
  const visit=.85+state.attract*.003;         /* a city worth visiting fills its market: 1.0 at 50 */
  const mining=num(ctx.mining),ench=num(ctx.ench),smith=num(ctx.smith),farmLvl=Math.max(1,num(ctx.farmLvl,1));
  const limit=creditLimit(ctx,state);
  const incidents=(state.incidents||[]).map(i=>{
   const def=incidentDef(i.id),grow=1+Math.min(i.age,4)*.25;        /* left alone, it spreads */
   return {id:def.id,name:def.name,icon:def.icon,text:def.text,fix:def.fix,line:def.line,level:def.level,street:!!def.street,age:i.age,
    mood:r(def.mood*grow),gold:r(-def.gold*grow*k),cost:settleCost(def,ctx),met:b[def.line]>=def.level};
  });
  const held=state.jail.length,room=cells(state),crowded=Math.max(0,held-room);
  const grain=foodView(state,ctx),hunger=state.food.hunger,away=neglect(state);
  const fines=W.fines?r(held*14*k):0;
  const income=[
   {id:'taxes',name:'Poll tax',icon:'💰',amount:r(hearths(state)*b.tax/100*80*k*temper*craft*crop),note:state.pop.toLocaleString()+' townsfolk in '+hearths(state).toLocaleString()+' households at '+b.tax+'% - '+TAX_NOTE[b.tax]},
   {id:'rents',name:'Crown rents',icon:'🏠',amount:r(hearths(state)*rent.rate*k*temper*crop),note:rent.name+' - '+rent.rate*k+' ◉ a household from '+hearths(state).toLocaleString()+' households'},
   {id:'tolls',name:'Market tolls',icon:'⚖️',amount:r((300*fee.vol+W.tolls)*fee.rate*k*order*trade*(.75+state.mood/200)*visit),note:'the square, the terraces and the tenement stalls - fees '+fee.name.toLowerCase()},
   {id:'exports',name:'Exports',icon:'🚢',amount:r((200+Math.min(HERO_EXPORTS_MAX,mining*.6+smith*4+ench*.4)+W.exports)*k*trade*craft),note:'ore, gems and forged steel out through the gate'},
   {id:'imports',name:'Import duties',icon:'📦',amount:r(220*k*order*duty.rate*duty.vol*(1+W.duty)*(1+num(wind.trade))),note:'customs on everything that comes in - '+duty.name.toLowerCase()},
   {id:'guilds',name:'Guild dues',icon:'⛏',amount:r(((ctx.miningTrained?30:0)+(ctx.enchTrained?30:0)+(ctx.smelter?20:0))*k),note:'the Mining Hall, the Enchanting Hall and the smelter'},
   {id:'farm',name:'Farm levy',icon:'🚜',amount:ctx.farmOwned?r(Math.min(HERO_FARM_LEVELS,farmLvl)*20*k):0,note:ctx.farmOwned?'your farm, level '+farmLvl:'no farm of your own yet'},
   {id:'licence',name:'Gaming licence',icon:'🎲',amount:r(250*k),note:'the Moonshine casino pays for the privilege'},
   {id:'church',name:'Church intakes',icon:'⛪',amount:r(hearths(state)*2.5*churchMod*tithe.rate*k*(.6+state.mood/250)*(1+festival.cost/1200)*(!crowned&&K.humour==='pious'?1.25:1)*crop),note:tithe.rate?tithe.name.toLowerCase()+' of the tithes and the collections - fuller plates in a contented city, on feast days and under a pious King':'the Church keeps its own'},
   {id:'works',name:'Crown works',icon:'🏗',amount:r(W.income*k)+fines,note:!W.count?'nothing built yet - see the Works tab':W.income||fines?'fees, gate money'+(fines?' and court fines':'')+' from '+W.count+' public work'+(W.count>1?'s':''):W.count+' public work'+(W.count>1?'s':'')+' standing - what they earn shows in the lines above'},
  ];
  const purseCost=r(purse.cost*k*factor.purse);
  const expenses=[
   {id:'guard',name:'Royal Guard',icon:'⚔️',amount:r(state.guards*GUARD_WAGE*k*wage),note:state.guards+' men at the pillars of the hall'+(state.guards<ROYAL_GUARD?' - the bank dismissed '+(ROYAL_GUARD-state.guards):'')},
   {id:'watch',name:'City Watch',icon:'🛡',amount:r(watch.cost*k*factor.watch),note:watch.men+' men - '+watch.name},
   {id:'roads',name:'Roads & Walls',icon:'🧱',amount:r(roads.cost*k*factor.roads),note:roads.name},
   {id:'relief',name:'Granary & Poor Relief',icon:'🍞',amount:r(relief.cost*k*factor.relief),note:relief.name},
   {id:'festival',name:'Festivals',icon:'🎉',amount:r(festival.cost*k*factor.festival),note:festival.name},
   {id:'court',name:'The Royal Court',icon:'👑',amount:r(court.cost*k*factor.court),note:court.name},
   {id:'clean',name:'Street Cleaning',icon:'🧹',amount:r(clean.cost*k*factor.clean),note:clean.name},
   {id:'learn',name:'Schools & Learning',icon:'📚',amount:r(learn.cost*k*factor.learn),note:learn.name},
   {id:'food',name:'Markets & Provisions',icon:'🥩',amount:r(food.cost*k*factor.food),note:food.name},
   {id:'grain',name:'Grain shipments',icon:'🌾',amount:grain.ship.cost,note:grain.auto?grain.ship.sacks.toLocaleString()+' sacks at '+grain.autoPrice+' ◉ - the standing shipments'+(grain.ship.short?', as far as the strongroom can pay':''):'no standing shipments - the granary is stocked by hand'},
   {id:'purse',name:crowned?'Your privy purse':'The King’s Purse',icon:'💎',amount:purseCost,note:purse.name+(crowned?' - paid into your own purse at every close':K.raise?' - raised '+K.raise+' time'+(K.raise>1?'s':'')+' at his insistence':'')},
   {id:'upkeep',name:'Upkeep of the works',icon:'🏗',amount:r(W.upkeep*k*wage*dear),note:W.count?'lamplighters, librarians, harbour pilots':'nothing to keep up yet'},
   {id:'gaol',name:'The gaol',icon:'⛓',amount:r(held*12*k*dear),note:held?held+' prisoner'+(held>1?'s':'')+' in '+room+' cells':'the cells are empty'},
   {id:'interest',name:'Tides Bank interest',icon:'🏦',amount:r(state.loan*state.rate*num(cm.interest,1)),note:state.loan>0?+(state.rate*num(cm.interest,1)*100).toFixed(3)+'% of '+state.loan.toLocaleString()+' owed':'nothing owed'},
   {id:'overdraft',name:'Overdraft penalty',icon:'⚠️',amount:state.treasury<0?r(-state.treasury*OVERDRAFT_RATE):0,note:state.treasury<0?'the treasury is below zero':'the treasury is in credit'},
   {id:'unrest',name:'Unrest & damages',icon:'🥊',amount:incidents.reduce((t,i)=>t+i.gold,0),note:incidents.length?incidents.map(i=>i.name.toLowerCase()).join(', '):'the streets are quiet'},
   {id:'whims',name:'The King helps himself',icon:'🗝',amount:!crowned&&K.pleasure<30?r(260*k):0,note:!crowned&&K.pleasure<30?'a furious King sends his chamberlain to the strongroom':crowned?'there is no King but you':'the King keeps his hands out of the strongroom'},
  ];
  /* a council that has turned against you loses papers, delays wagons and pads every bill */
  const waste=fav<35?r(expenses.reduce((t,l)=>t+l.amount,0)*.06):0;
  expenses.push({id:'obstruction',name:'Council obstruction',icon:'🏛',amount:waste,note:fav<35?'a '+favourName(fav).toLowerCase()+' council pads every bill by 6%':'the council is not working against you'});
  const totalIn=income.reduce((t,l)=>t+l.amount,0),totalOut=expenses.reduce((t,l)=>t+l.amount,0);
  const moodFactors=[
   {name:'The city as it stands',value:55},
   {name:'Poll tax at '+b.tax+'%',value:TAX_MOOD[b.tax]},
   {name:'Crown rents - '+rent.name,value:rent.mood},
   {name:'Market fees - '+fee.name,value:fee.mood},
   {name:'Import duties - '+duty.name,value:duty.mood},
   {name:'The tithes - '+tithe.name,value:tithe.mood},
   {name:'City Watch - '+watch.name,value:watch.mood},
   {name:'Roads & Walls - '+roads.name,value:roads.mood},
   {name:'Granary - '+relief.name,value:relief.mood},
   {name:'Festivals - '+festival.name,value:festival.mood},
   {name:'The court - '+court.name,value:court.mood},
   {name:'Street Cleaning - '+clean.name,value:clean.mood},
   {name:'Schools - '+learn.name,value:learn.mood},
   {name:'Provisions - '+food.name,value:food.mood},
   {name:(crowned?'Your purse - ':'The King’s purse - ')+purse.name,value:purse.mood},
   {name:'Public works',value:W.mood},
   {name:'The gaol is overcrowded',value:crowded?-3:0},
   {name:'🌾 Hunger - it builds while the granary is short',value:-Math.min(36,Math.round(hunger*6))||0},
   {name:'🔔 Nobody has seen the steward ('+away.closes+' close'+(away.closes===1?'':'s')+')',value:away.mood},
   {name:'The season - '+cardDef(card.id).name.toLowerCase(),value:num(cm.mood)},
   {name:'A treasury below zero',value:state.treasury<0?-18:0},
   {name:'The crown is at the end of its credit',value:limit>0&&state.loan>limit*.9?-4:0},
   {name:'Half the Royal Guard dismissed by the bank',value:state.guards<=ROYAL_GUARD/2?-3:0},
   ...incidents.map(i=>({name:i.icon+' '+i.name,value:i.mood})),
  ];
  const moodTarget=clamp(moodFactors.reduce((t,f)=>t+f.value,0),0,100);
  /* 🧲 how much anyone wants to live here */
  const attractFactors=[
   {name:'A walled city on a trade road',value:48},
   {name:'The temper of the people ('+state.mood+')',value:r((state.mood-55)*.3)},
   {name:'Poll tax at '+b.tax+'%',value:TAX_ATTRACT[b.tax]},
   {name:'Crown rents - '+rent.name,value:rent.attract},
   {name:'Market fees - '+fee.name,value:fee.attract},
   {name:'Import duties - '+duty.name,value:duty.attract},
   {name:'The tithes - '+tithe.name,value:tithe.attract},
   ...['watch','roads','relief','festival','court','clean','learn','food'].map(key=>({name:LINES[key].name+' - '+L[key].name,value:num(L[key].attract)})),
   {name:'What the people have learned ('+Math.round(state.skill)+')',value:r((state.skill-20)/10)},
   {name:'Public works',value:W.attract},
   {name:'Trouble in the streets',value:-4*incidents.length},
   {name:'The march on the boulevard',value:state.protest?-15:0},
   {name:'An overcrowded gaol',value:crowded?-3:0},
   {name:'The season - '+cardDef(card.id).name.toLowerCase(),value:num(cm.attract)},
   {name:'🌾 Hunger in the streets',value:-Math.min(18,Math.round(hunger*3))||0},
   {name:'🔔 A city nobody is seen to run ('+away.closes+' close'+(away.closes===1?'':'s')+')',value:away.attract},
   {name:'A crown that cannot pay its bills',value:state.treasury<0?-5:0},
  ];
  const attractTarget=clamp(attractFactors.reduce((t,f)=>t+f.value,0),0,100);
  const housing=HOUSING+W.housing;
  const skillTarget=clamp(20+learn.skill+W.skill,0,100);
  /* 🤝 what the realm makes of you, per close. It adds up - trust is earned, not settled into. */
  const trustFactors=[
   {name:'The people ('+moodName(state.mood).toLowerCase()+')',value:round1((state.mood-55)/18)},
   {name:'The council ('+favourName(fav).toLowerCase()+')',value:round1((fav-55)/18)},
   {name:'The city ('+attractName(state.attract).toLowerCase()+')',value:round1((state.attract-50)/30)},
   {name:'The march on the boulevard',value:state.protest?-3:0},
   {name:'Trouble left in the streets',value:round1(-.5*incidents.length)},
   {name:'A treasury below zero',value:state.treasury<0?-2:0},
   {name:'The ledgers lie unattended ('+num(state.unattended)+' close'+(num(state.unattended)===1?'':'s')+' - it deepens every close)',value:away.trust},
   {name:'🌾 Hunger',value:-Math.min(2,round1(hunger*.35))||0},
  ];
  const trustDelta=round1(trustFactors.reduce((t,f)=>t+f.value,0));
  const pleasureTarget=clamp(purse.pleasure+num(court.pleasure)+(state.mood>=70?4:0)-(state.protest?12:0)-(state.treasury<0?6:0)-(ROYAL_GUARD-state.guards)*2-(K.humour==='pious'?[0,0,6,14][b.tithe]:[0,0,0,5][b.tithe]),0,100);
  return {income,expenses,totalIn,totalOut,net:totalIn-totalOut,moodTarget,moodFactors,incidents,favour:fav,backing,order,trade,scale:k,creditLimit:limit,
   attractTarget,attractFactors,housing,skillTarget,craft,visit,trustFactors,trustDelta,pleasureTarget,purse:purseCost,cells:room,crowded,works:W,grain,
   wage,factor,winds:WIND_KEYS.map(key=>({key,value:wind[key],name:windName(key,wind[key])})),card:{...cardDef(card.id),mods:cm}};
 }
 function rollEvents(state,ctx,rng,blocks){
  if(draw(rng)>=.4)return [];                 /* most closes are quiet */
  const pool=EVENTS.filter(e=>!(e.tag&&blocks&&blocks.has(e.tag))&&(!e.when||e.when(state,ctx)));
  const e=pickWeighted(pool,rng);
  return e?[e]:[];
 }
 /* what a councillor thinks the budget deserves */
 function seatTarget(seat,state,f){
  if(seat.line){
   const pressed=state.incidents.some(i=>incidentDef(i.id).line===seat.line);
   return clamp(SEAT_TARGET[seat.line][state.budget[seat.line]]-(pressed?15:0)-neglect(state).seats-(seat.id==='bread'?[0,0,8,20][state.budget.tithe]:0),0,100);
  }
  return clamp(55-neglect(state).seats+(f.net>=0?12:-18)+(state.treasury<0?-25:0)+(state.loan>f.creditLimit*.9?-10:0)+(state.chartered&&state.loan===0?12:0),0,100);
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
   neglect:neglect(state),
   seats:COUNCIL.map(s=>seatView(s,state,f)),
   petition:p?{...p,age:state.petition.age,cost:Math.round(num(p.cost)*f.scale),gold:Math.round(num(p.gold)*f.scale),seatDef:seatDef(p.seat),left:2-state.petition.age}:null};
 }
 /* 🏗 the Works tab: every work with what it costs at this prestige, what it does and where it stands */
 function fxText(w,k){
  const fx=w.fx||{},out=[],g=v=>Math.round(v*k).toLocaleString();
  if(fx.exports)out.push('exports +'+g(fx.exports)+' ◉');
  if(fx.tolls)out.push('market tolls +'+g(fx.tolls)+' ◉');
  if(fx.income)out.push('income +'+g(fx.income)+' ◉');
  if(fx.trade)out.push('trade +'+Math.round(fx.trade*100)+'%');
  if(fx.duty)out.push('customs +'+Math.round(fx.duty*100)+'%');
  if(fx.order)out.push('order +'+Math.round(fx.order*100)+'%');
  if(fx.safety)out.push('trouble '+Math.round(fx.safety*100)+' points less likely');
  if(fx.mood)out.push('mood +'+fx.mood);
  if(fx.attract)out.push('attractiveness +'+fx.attract);
  if(fx.skill)out.push('learning +'+fx.skill);
  if(fx.housing)out.push('roofs for '+fx.housing+' more');
  if(fx.cells)out.push(fx.cells+' more cells');
  if(fx.fines)out.push('court fines from every prisoner, and fines doubled');
  if(w.blocks&&w.blocks.length)out.push('ends '+w.blocks.map(t=>t==='smugglers'?'smuggling':t==='flood'?'the floods':'the flux').join(' and '));
  if(w.once&&w.once.trust)out.push('trust in you +'+w.once.trust);
  if(w.once&&w.once.pleasure)out.push('the King’s pleasure '+w.once.pleasure);
  return out;
 }
 function worksView(state,ctx={}){
  const k=scale(ctx),building=WORKS.filter(w=>state.works[w.id]&&state.works[w.id].left>0).length;
  const list=WORKS.map(w=>{
   const own=state.works[w.id],cost=Math.round(w.cost*k),missing=(w.needs||[]).filter(id=>!has(state,id)).map(id=>workDef(id).name);
   const status=own?(own.left>0?'building':'done'):missing.length?'locked':frozen(state)?'frozen':building>=MAX_BUILDING?'busy':state.treasury<cost?'poor':'ready';
   return {...w,cost,upkeep:Math.round(num(w.upkeep)*k),status,left:own?own.left:w.build,missing,effects:fxText(w,k)};
  });
  return {list,cats:WORK_CATS.map(c=>({...c,works:list.filter(w=>w.cat===c.id)})),building,crews:MAX_BUILDING,done:list.filter(w=>w.status==='done').length,total:WORKS.length};
 }
 /* 🏗 order a work: the whole price up front, from a treasury that has it */
 function invest(state,ctx,id){
  const v=worksView(state,ctx).list.find(w=>w.id===id);
  if(!v)return {ok:false,text:'No such work.'};
  if(v.status==='done'||v.status==='building')return {ok:false,text:v.name+' is already '+(v.status==='done'?'standing':'being built')+'.'};
  if(v.status==='locked')return {ok:false,text:'First build: '+v.missing.join(', ')+'.'};
  if(v.status==='frozen')return {ok:false,text:'The treasury is in the red. The bank will not see a stone laid until it is not.'};
  if(v.status==='busy')return {ok:false,text:'All '+MAX_BUILDING+' of the Master Builder’s crews are at work. Wait for one to finish.'};
  if(v.status==='poor')return {ok:false,text:'The treasury cannot cover '+v.cost.toLocaleString()+' ◉. The Tides Bank lends against a plan like this.'};
  state.treasury-=v.cost;state.spent+=v.cost;state.works[id]={left:v.build};state.seized=state.seized.filter(x=>x!==id);
  state.council.stone=clamp(state.council.stone+3,0,100);
  return {ok:true,cost:v.cost,text:v.name+' ordered for '+v.cost.toLocaleString()+' ◉ - ready in '+v.build+' close'+(v.build>1?'s':'')+'.'};
 }
 /* 👑 the Crown tab */
 function crownView(state,ctx={}){
  const f=forecast(state,ctx),K=state.king,d=K.demand&&demandDef(K.demand.id),h=humourDef(K.humour);
  return {crowned:state.crowned,deposed:state.deposed,trust:state.trust,trustName:trustName(state.trust),trustDelta:f.trustDelta,trustFactors:f.trustFactors,
   canClaim:!state.crowned&&state.trust>=COUP_TRUST,coupAt:COUP_TRUST,
   closesToCrown:state.crowned||state.trust>=COUP_TRUST?0:f.trustDelta>0?Math.ceil((COUP_TRUST-state.trust)/f.trustDelta):null,
   pleasure:K.pleasure,pleasureName:pleasureName(K.pleasure),pleasureTarget:f.pleasureTarget,humour:h,raise:K.raise,purse:f.purse,whims:f.expenses.find(l=>l.id==='whims').amount,
   demand:d?{...d,age:K.demand.age,left:2-K.demand.age,cost:Math.round(num(d.cost)*f.scale)}:null};
 }
 function arrest(state,p){
  if(state.jail.length>=MAX_CELLS+2||state.jail.some(x=>x.name===p.name))return false;
  state.jail.push({name:p.name,skin:p.skin||'male',female:!!p.female,crime:p.crime,say:p.say||'',term:Math.max(1,Math.floor(num(p.term,2))),served:0,life:!!p.life,byKing:!!p.byKing});
  return true;
 }
 /* yes or no to what the King wants */
 function answerKing(state,ctx,accept){
  const K=state.king,d=K.demand&&demandDef(K.demand.id);if(!d||state.crowned)return null;
  const cost=Math.round(num(d.cost)*scale(ctx));
  if(accept){
   if(state.treasury<cost)return {ok:false,text:'The treasury cannot cover '+cost.toLocaleString()+' ◉.'};
   state.treasury-=cost;state.spent+=cost;
   K.pleasure=clamp(K.pleasure+d.pleasure,0,100);
   state.mood=clamp(state.mood+num(d.mood),0,100);state.attract=clamp(state.attract+num(d.attract),0,100);
   state.trust=clamp(round1(state.trust+num(d.trust)),0,100);
   if(d.raise)K.raise=clamp(K.raise+d.raise,0,4);
   for(const id of Object.keys(d.favour||{}))state.council[id]=clamp(state.council[id]+d.favour[id],0,100);
   if(d.arrest)arrest(state,{...d.arrest,byKing:true,say:'Barbaric. Alarik. It is a PERFECT rhyme.'});
   K.demand=null;
   return {ok:true,accepted:true,text:'So ordered. The King is pleased - for now.'};
  }
  K.pleasure=clamp(K.pleasure-10,0,100);
  state.trust=clamp(round1(state.trust+num(d.refuseTrust)),0,100);
  K.demand=null;
  return {ok:true,accepted:false,text:'Refused. The King’s face did a thing.'+(d.refuseTrust?' The city will hear of it, and like you for it.':'')};
 }
 /* ⛓ the Gaol tab, and the two things a steward can do for a prisoner */
 function fineOf(state,ctx,p){return Math.round(90*(p.term-p.served)*scale(ctx)*(worksFx(state).fines?2:1));}
 function gaolView(state,ctx={}){
  const room=cells(state);
  return {cells:room,held:state.jail.length,crowded:Math.max(0,state.jail.length-room),upkeep:Math.round(state.jail.length*12*scale(ctx)),
   prisoners:state.jail.map(p=>({...p,left:p.life?null:Math.max(0,p.term-p.served),fine:p.life?0:fineOf(state,ctx,p)}))};
 }
 function pardon(state,name){
  const i=state.jail.findIndex(p=>p.name===name);if(i<0)return null;
  const p=state.jail[i];state.jail.splice(i,1);
  if(p.life){state.deposed='exile';return {ok:true,text:p.name+' was put on a ship at dawn. He did not look back.'};}
  state.mood=clamp(state.mood+1,0,100);state.trust=clamp(round1(state.trust+.5),0,100);
  if(p.byKing&&!state.crowned)state.king.pleasure=clamp(state.king.pleasure-8,0,100);
  return {ok:true,text:p.name+' walks free. Word of it is round the tenements by nightfall.'+(p.byKing&&!state.crowned?' The King is not amused.':'')};
 }
 function fine(state,ctx,name){
  const i=state.jail.findIndex(p=>p.name===name);if(i<0||state.jail[i].life)return null;
  const gold=fineOf(state,ctx,state.jail[i]);
  state.jail.splice(i,1);state.treasury+=gold;state.earned+=gold;
  return {ok:true,gold,text:name+' paid '+gold.toLocaleString()+' ◉ and went home.'};
 }
 /* 👑 At a hundred the guard will not stop you and the council will not speak against you. fate is
    what becomes of the old King: a cell under his own hall, or a ship. */
 function claimCrown(state,fate){
  if(state.crowned||state.trust<COUP_TRUST)return {ok:false,text:'The realm does not trust you enough - yet.'};
  state.crowned=true;state.deposed=fate==='exile'?'exile':'gaol';state.king.demand=null;
  state.mood=clamp(state.mood+6,0,100);
  for(const seat of COUNCIL)state.council[seat.id]=clamp(state.council[seat.id]+5,0,100);
  if(state.deposed==='gaol'){
   state.jail=state.jail.filter(p=>!p.life);
   state.jail.unshift({name:'Alarik Tidvind',skin:'king',female:false,crime:'was King, and was found wanting',say:'Enjoy it. It pinches.',term:1,served:0,life:true,byKing:false});
  }
  return {ok:true,text:state.deposed==='gaol'?'The guard stood aside. Alarik went down the stair to his own gaol, and the crown is yours.':'The guard stood aside. Alarik sailed on the evening tide, and the crown is yours.'};
 }
 /* 🏦 Signing the founding loan opens the books: 500 000 in the strongroom, the same owed, a line a
    little beyond it, and the first season's clock running. */
 function newSeason(state,n,share,rng){
  return {n,card:dealCard(rng,state.season&&state.season.card&&state.season.card.id),closes:0,startLoan:state.loan,startTreasury:state.treasury,target:Math.max(0,Math.round(state.loan*(1-share))),red:0,covered:0,interest:0,series:[]};
 }
 function charter(state,rng){
  if(state.chartered)return null;
  state.chartered=true;state.loan+=FOUNDING_LOAN;state.treasury+=FOUNDING_LOAN;state.borrowed+=FOUNDING_LOAN;
  state.limit=FOUNDING_LOAN+RESERVE_LINE;state.rate=LOAN_RATE;state.clock=0;
  state.food.stock=FOOD_START;               /* 🌾 the last steward left three closes of grain, and no more */
  state.season=newSeason(state,1,DUE_SHARE,null);      /* the first season is an ordinary one: enough is new already */
  return {ok:true,text:'Signed. '+FOUNDING_LOAN.toLocaleString()+' ◉ is in the strongroom, and the crown owes the Tides Bank every coin of it.'};
 }
 /* what the Hand lays out before the signing: a close, a season, and what the loan costs */
 function charterView(state,ctx={}){
  const f=forecast(state,ctx),interest=Math.round(FOUNDING_LOAN*LOAN_RATE),grainCost=foodView(state,ctx).need*foodView(state,ctx).price,out=f.totalOut+grainCost;
  return {income:f.income.filter(l=>l.amount),expenses:f.expenses.filter(l=>l.amount).concat([{id:'grain',name:'Grain for the granary',icon:'🌾',amount:grainCost,note:'a sack a household, bought by the shipment'}]),grain:grainCost,wageRise:WAGE_RISE,
   perCloseIn:f.totalIn,perCloseOut:out,interest,net:f.totalIn-out-interest,
   closes:SEASON_CLOSES,seasonIn:f.totalIn*SEASON_CLOSES,seasonOut:(out+interest)*SEASON_CLOSES,seasonNet:(f.totalIn-out-interest)*SEASON_CLOSES,
   loan:FOUNDING_LOAN,line:FOUNDING_LOAN+RESERVE_LINE,reserve:RESERVE_LINE,rate:LOAN_RATE,target:Math.round(FOUNDING_LOAN*(1-DUE_SHARE)),due:Math.round(FOUNDING_LOAN*DUE_SHARE),coverFee:COVER_FEE,seizeAfter:SEIZE_AFTER};
 }
 /* 🏦 The season's review. What counts is what the books show at the last close: is the debt down to
    the target the bank set (borrowing more along the way is fine - it is where you END), was the
    treasury ever in the red or bailed out from the line, and is the crown worth more than it was.
    A good season widens the line by what was repaid and more, and cheapens the money; a bad one
    narrows it and makes every coin owed dearer. */
 const GRADES={
  A:{line:.12,repaid:1,rate:-.0005,trust:6,coin:10,verdict:'the debt is down, the strongroom never ran dry and the crown is worth more than it was. The line widens and the rate falls.'},
  B:{line:.06,repaid:.75,rate:-.00025,trust:3,coin:5,verdict:'the debt is down to where we asked and the treasury stayed in the black. The line widens a little.'},
  C:{line:0,repaid:.5,rate:0,trust:0,coin:0,verdict:'half of what we asked for. The line moves by half of what you repaid, and the rate stays.'},
  D:{line:-.05,repaid:0,rate:.0005,trust:-4,coin:-8,verdict:'the debt is not where we asked. The line narrows and the money gets dearer.'},
  F:{line:-.15,repaid:0,rate:.001,trust:-10,coin:-15,verdict:'the debt is up, the strongroom ran dry and our bailiffs know your streets by name. The line is cut, the rate jumps, and next season we want more back.'},
 };
 function review(state,ctx,rng){
  const q=state.season,worthStart=q.startTreasury-q.startLoan,worth=state.treasury-state.loan;
  const paid=state.loan<=q.target,clean=q.red===0&&q.covered===0,up=worth>worthStart,reduced=Math.max(0,q.startLoan-state.loan);
  const grade=paid&&clean&&up?'A':paid&&q.red===0?'B':paid||(clean&&up)?'C':q.red<=3?'D':'F',G=GRADES[grade];
  /* a debt above the target is called in from whatever the strongroom holds, there and then */
  const swept=paid?0:Math.min(Math.max(0,state.treasury),state.loan-q.target);
  if(swept>0){state.loan-=swept;state.treasury-=swept;state.repaid+=swept;}
  const limitWas=state.limit,rateWas=state.rate;
  state.limit=Math.max(state.loan,200000,Math.round(state.limit*(1+G.line)+reduced*G.repaid));
  state.rate=clamp(Math.round((state.rate+G.rate)*1e5)/1e5,MIN_RATE,MAX_RATE);
  state.trust=clamp(round1(state.trust+G.trust),0,100);
  state.council.coin=clamp(state.council.coin+G.coin,0,100);
  const summary={n:q.n,grade,verdict:G.verdict,startLoan:q.startLoan,endLoan:state.loan,target:q.target,reduced,paid,startTreasury:q.startTreasury,endTreasury:state.treasury,worthStart,worth,
   red:q.red,covered:q.covered,interest:q.interest,swept,limitWas,limit:state.limit,rateWas,rate:state.rate,series:q.series};
  state.seasons.push(summary);while(state.seasons.length>SEASONS_KEPT)state.seasons.shift();
  state.wage=Math.min(WAGE_MAX,Math.round(num(state.wage,1)*(1+WAGE_RISE)*1e4)/1e4);   /* the guard, the watch, the masons and the King all ask for their rise */
  summary.wage=state.wage;
  summary.card=q.card?q.card.id:'ordinary';
  state.season=newSeason(state,q.n+1,grade==='F'?DUE_SHARE*1.5:DUE_SHARE,rng);
  state.reviewSeen=false;
  return summary;
 }
 /* 🏦 The bailiffs. One thing at a close, round a fixed ladder, skipping what is not there to take:
    a building site is stopped and its stone sold for half; a file of the watch is dismissed; a
    finished work that nothing else stands on is sold for a third of what it cost (and its house in
    the City wears the bank's seal); two of the Royal Guard are paid off; the festivals stop; the
    court is cut. What is sold is credited to the treasury - that is how the red ends. */
 const SEIZE_ORDER=['site','watch','work','guards','revels','work','court','work'];
 function seize(state,k){
  for(let tries=0;tries<SEIZE_ORDER.length;tries++){
   const kind=SEIZE_ORDER[state.seizeI++%SEIZE_ORDER.length],b=state.budget;
   if(kind==='site'){
    const id=Object.keys(state.works).find(x=>state.works[x].left>0);
    if(id){const def=workDef(id),back=Math.round(def.cost*k*.5);delete state.works[id];state.treasury+=back;
     return '🏦 The bank’s bailiffs stopped work on the '+def.name+' and sold the stone: +'+back.toLocaleString()+' ◉.';}
   }else if(kind==='work'){
    const owned=Object.keys(state.works).filter(x=>state.works[x].left===0);
    const leaves=owned.filter(x=>!Object.keys(state.works).some(y=>(workDef(y).needs||[]).includes(x))).sort((x,y)=>workDef(y).cost-workDef(x).cost);
    if(leaves.length){const def=workDef(leaves[0]),back=Math.round(def.cost*k*.35);delete state.works[def.id];state.seized.push(def.id);state.treasury+=back;
     return '🏦 The bank’s bailiffs seized the '+def.name+' and sold it for '+back.toLocaleString()+' ◉ - a third of what it cost you.';}
   }else if(kind==='watch'){
    if(b.watch>0){b.watch-=1;return '🏦 The bank’s auditors dismissed a file of the City Watch to cut your costs. It is now '+LINES.watch.levels[b.watch].name.toLowerCase()+'.';}
   }else if(kind==='guards'){
    if(state.guards>MIN_GUARD){state.guards-=2;if(!state.crowned)state.king.pleasure=clamp(state.king.pleasure-6,0,100);
     return '🏦 The bank paid off two of the Royal Guard. '+state.guards+' men are left at the pillars'+(state.crowned?'.':', and the King has counted them.');}
   }else if(kind==='revels'){
    if(b.festival>0){b.festival=0;return '🏦 The bank struck the festivals from the budget. The bunting came down overnight.';}
   }else if(kind==='court'){
    if(b.court>0){b.court-=1;return '🏦 The bank cut the court to '+LINES.court.levels[b.court].name.toLowerCase()+'. The Lord Chamberlain is beside himself.';}
   }
  }
  /* nothing left to take: the bank writes the budget itself - every line to the bone, the King on a pittance */
  let cut=0;for(const key of LINE_KEYS)if(state.budget[key]>0){state.budget[key]=0;cut++;}
  if(cut)return '🏦 There was nothing left to sell, so the bank took the budget into its own hands: every line is cut to the bone.';
  state.mood=clamp(state.mood-3,0,100);
  return '🏦 The bank’s men carried the silver out of the hall. There is nothing left to take.';
 }
 /* two of the guard can be hired back at a time, from a treasury in the black */
 function rehire(state,ctx){
  const cost=Math.round(400*scale(ctx));
  if(state.guards>=ROYAL_GUARD)return {ok:false,text:'The guard is at full strength.'};
  if(frozen(state)||state.treasury<cost)return {ok:false,text:'The treasury cannot cover '+cost.toLocaleString()+' ◉.'};
  state.treasury-=cost;state.spent+=cost;state.guards=Math.min(ROYAL_GUARD,state.guards+2);
  return {ok:true,text:'Two men took the crown’s coin. '+state.guards+' stand at the pillars.'};
 }
 /* 🏦 the Bank tab */
 function bankView(state,ctx={}){
  const limit=creditLimit(ctx,state),q=state.season;
  return {chartered:state.chartered,loan:state.loan,limit,room:Math.max(0,limit-state.loan),rate:state.rate,interest:Math.round(state.loan*state.rate),
   frozen:frozen(state),arrears:state.arrears,bailiffs:frozen(state)&&state.arrears>=SEIZE_AFTER-1,guards:state.guards,fullGuard:ROYAL_GUARD,rehireCost:Math.round(400*scale(ctx)),
   seized:state.seized.map(id=>workDef(id).name),surplus:Math.max(0,state.treasury-state.loan),length:SEASON_CLOSES,
   season:q?{...q,left:SEASON_CLOSES-q.closes,toRepay:Math.max(0,state.loan-q.target),worthStart:q.startTreasury-q.startLoan,worth:state.treasury-state.loan}:null,
   seasons:state.seasons.slice().reverse(),grades:GRADES};
 }
 /* One close: charge the ledger, roll the week's news, move the temper a third of the way to where
    the budget says it belongs, settle or spread the unrest, let the council make up its mind, and
    decide whether the crowd is on the boulevard. Then the long game: crews build, the King wants,
    the people learn, the gaol turns over, the realm weighs you, and families come or go. Every new
    roll comes AFTER the old ones, so a scripted rng still means what it meant. */
 function tick(state,ctx={},rng=Math.random){
  const f=forecast(state,ctx),k=f.scale,unrest=[],card=cardOf(state);
  const rolled=rollEvents(state,ctx,rng,f.works.blocks);
  const events=rolled.map(e=>({text:e.text,gold:Math.round(num(e.gold)*k),mood:num(e.mood)}));
  const eventGold=events.reduce((t,e)=>t+e.gold,0);
  let moodShift=events.reduce((t,e)=>t+e.mood,0),moved=rolled.reduce((t,e)=>t+num(e.pop),0),trustShift=0;
  /* 🌬 what really came in and went out: within a few percent of what the Hand expected, never on it */
  const live=!!ctx.live,gotIn=live?Math.round(f.totalIn*(1+(draw(rng)-.5)*JITTER_IN)):f.totalIn,paidOut=live?Math.round(f.totalOut*(1+(draw(rng)-.5)*JITTER_OUT)):f.totalOut;
  const net=gotIn-paidOut+eventGold;
  const before=state.treasury;
  state.treasury=Math.round(state.treasury+net);
  /* 🏦 a shortfall is covered from the line while there is one, at a fee; past the line it is the red */
  let covered=0;
  if(state.chartered&&state.treasury<0){
   covered=Math.max(0,Math.min(creditLimit(ctx,state)-state.loan,-state.treasury));
   if(covered>0){
    const fee=Math.round(covered*COVER_FEE);
    state.loan+=covered+fee;state.treasury+=covered;state.borrowed+=covered;state.season.covered+=1;
    unrest.push('🏦 The Tides Bank covered a shortfall of '+covered.toLocaleString()+' ◉ from your line - and added '+fee.toLocaleString()+' ◉ to the debt for the favour.');
   }
  }
  if(state.chartered&&state.treasury<0){
   state.arrears+=1;state.season.red+=1;
   if(state.arrears>=SEIZE_AFTER)unrest.push(seize(state,k));
   else unrest.push('🏦 The treasury is in the red and the line is spent. The bank’s clerk left a letter: one close to mend it, then the bailiffs.');
   const floor=-Math.round(creditLimit(ctx,state)*RED_FLOOR);
   if(state.treasury<floor){state.treasury=floor;state.mood=clamp(state.mood-2,0,100);unrest.push('🏦 Nobody will take the crown’s paper any more: this close’s bills went unpaid, and the city knows it.');}
  }else state.arrears=0;
  /* unrest: what the budget now covers is dealt with, the rest bites and spreads */
  state.incidents=state.incidents.filter(i=>{
   const def=incidentDef(i.id);
   if(state.budget[def.line]>=def.level){unrest.push('✔ '+def.name+' - dealt with.');moodShift+=2;trustShift+=1;return false;}
   moodShift+=Math.round(def.mood/3);i.age+=1;return true;
  });
  if(state.incidents.length<MAX_INCIDENTS){
   const chance=clamp(.22+(state.mood<45?.10:0)+(state.budget.watch===0?.08:0)-f.works.safety+num(card.mods.trouble),0,.6);
   if(draw(rng)<chance){
    const pool=INCIDENTS.filter(d=>!state.incidents.some(i=>i.id===d.id)&&state.ticks>=num(d.after)&&(!d.when||d.when(state,ctx)));
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
  if(!state.protest&&state.mood<PROTEST_START)state.protest=true;
  else if(state.protest&&state.mood>=PROTEST_END)state.protest=false;
  /* 🏗 the crews */
  const finished=[];
  for(const id of Object.keys(state.works)){
   const w=state.works[id];if(w.left<=0)continue;
   w.left-=1;if(w.left>0)continue;
   const def=workDef(id);finished.push(id);trustShift+=2;
   state.council.stone=clamp(state.council.stone+2,0,100);
   if(def.once){trustShift+=num(def.once.trust);if(!state.crowned)state.king.pleasure=clamp(state.king.pleasure+num(def.once.pleasure),0,100);}
   unrest.push('🏗 '+def.name+' - finished. '+def.done);
  }
  /* 👑 the King: his pleasure drifts, his wishes lapse, a new one arrives, his humour turns */
  const K=state.king;
  if(!state.crowned){
   K.pleasure=clamp(Math.round(K.pleasure+(f.pleasureTarget-K.pleasure)*.3),0,100);
   if(K.demand){
    K.demand.age+=1;
    if(K.demand.age>=2){K.pleasure=clamp(K.pleasure-12,0,100);K.demand=null;unrest.push('👑 The King’s wish went unanswered. He noticed.');}
   }else if(draw(rng)<Math.min(.9,humourDef(K.humour).chance*num(card.mods.wishes,1))){
    const d=pickWeighted(DEMANDS.filter(x=>!(x.raise&&K.raise>=4)).map(x=>({...x,w:x.likes.includes(K.humour)?4:1})),rng);
    if(d){K.demand={id:d.id,age:0};unrest.push('👑 The King wants something. He is waiting in the hall.');}
   }
   K.humourAge+=1;
   if(K.humourAge>=4&&draw(rng)<.3){
    const h=pickWeighted(HUMOURS.filter(x=>x.id!==K.humour).map(x=>({...x,w:1})),rng);
    if(h){K.humour=h.id;K.humourAge=0;unrest.push('👑 The King’s humour has turned: '+h.name.toLowerCase()+'.');}
   }
  }
  /* ⛓ the gaol: terms are served, and the watch - or a furious King - brings somebody new in */
  state.jail=state.jail.filter(p=>{
   if(p.life)return true;
   p.served+=1;if(p.served<p.term)return true;
   unrest.push('🔓 '+p.name+' served the term and walked free.');return false;
  });
  const taken=new Set(state.jail.map(p=>p.name));
  const roster=(Array.isArray(ctx.roster)&&ctx.roster.length?ctx.roster:FALLBACK_ROSTER.map(([name,skin])=>({name,skin}))).filter(p=>p&&p.name&&!taken.has(p.name));
  const byKing=!state.crowned&&K.pleasure<30;
  if(roster.length&&draw(rng)<clamp(.22+state.budget.watch*.12+state.incidents.length*.08+(byKing?.2:0),0,.85)){
   const who=roster[Math.floor(draw(rng)*roster.length)];
   const kings=byKing&&draw(rng)<.5;          /* half of a furious King's arrests are for nothing at all */
   const crime=kings?{text:'displeased the King, who was already displeased',term:[3,5],say:'I bowed! I bowed TWICE!'}:pickWeighted(CRIMES.map(c=>({...c,w:c.w+(c.boost?c.boost(state):0)})).filter(c=>c.w>0),rng);
   const term=crime.term[0]+Math.floor(draw(rng)*(crime.term[1]-crime.term[0]+1));
   if(arrest(state,{name:who.name,skin:who.skin,female:!!who.female,crime:crime.text,say:crime.say,term,byKing:kings})){
    unrest.push('⛓ '+who.name+' was taken to the gaol: '+crime.text+'.');
    if(kings)state.mood=clamp(state.mood-2,0,100);
   }
  }
  /* 🌾 the standing shipment lands (it was charged with the rest of the ledger), the rats take their share, the city eats */
  if(state.chartered){
   const F=state.food,need=f.grain.need;
   F.stock+=f.grain.ship.sacks;
   for(const e of rolled)if(e.food)F.stock=Math.max(0,Math.round(F.stock*(1+e.food)));
   if(F.stock>=need){
    F.stock-=need;F.hunger=Math.max(0,Math.round((F.hunger-HUNGER_EASE)*100)/100);
    const left=need>0?Math.floor(F.stock/need):99;
    if(left<FOOD_LOW)unrest.push('🌾 The granary holds bread for '+(left<1?'less than one more close':left+' more close'+(left>1?'s':''))+'. Buy grain at the council table'+(F.auto?' - the standing shipments are not keeping up.':', or set the standing shipments going.'));
   }else{
    const short=need>0?(need-F.stock)/need:0,first=F.hunger===0;
    F.stock=0;F.hunger=Math.min(HUNGER_MAX,Math.round((F.hunger+short*HUNGER_GAIN)*100)/100);
    unrest.push(first?'🌾 The granary is EMPTY. '+Math.round(short*100)+'% of the city went without bread at this close - and it gets worse every close it lasts.':'🌾 The granary is empty and the hunger is spreading. '+(F.auto?'The standing shipments cannot be paid for.':'Nobody has bought grain.'));
    moved-=Math.floor(F.hunger*HOUSEHOLD);
   }
  }
  /* 📚 the people learn, slowly; 🧲 the city's name spreads; 🤝 the realm weighs you */
  state.skill=clamp(round1(state.skill+(f.skillTarget-state.skill)*.08),0,100);
  state.attract=clamp(Math.round(state.attract+(f.attractTarget-state.attract)*.3),0,100);
  state.trust=clamp(round1(state.trust+f.trustDelta+trustShift),0,100);
  /* 🧳 families come to a city worth living in, and leave one that is not */
  const roll=draw(rng);
  /* a city of hundreds moves by the dozen: about twenty a close when it is sought after, more the bigger it is */
  const size=HOUSEHOLD*Math.max(1,Math.sqrt(state.pop/POPULATION));
  if(state.attract>=55)moved+=Math.floor(((state.attract-50)/10+roll)*size*num(card.mods.arrive,1));
  else if(state.attract<40)moved-=Math.floor(((40-state.attract)/8+roll)*size);
  if(card.mods.arrive>1&&state.attract<55)moved+=Math.floor(roll*size*card.mods.arrive);            /* refugees come whatever the city is like */
  if(card.mods.sick)moved-=Math.ceil(state.pop*card.mods.sick*(f.works.blocks.has('flux')?.4:1));   /* the sickness takes its share; a hospital or drains blunt it */
  moved=Math.max(moved,-Math.max(1,Math.ceil(state.pop*LEAVE_MAX)));       /* a slope, not a cliff: at most one in twenty packs a cart at any one close */
  moved=clamp(moved,MIN_POP-state.pop,Math.max(0,f.housing-state.pop));
  if(moved>0)unrest.push('🧳 '+moved+' new townsfolk came through the west gate to stay.');
  else if(moved<0)unrest.push('🎒 '+(-moved)+' townsfolk packed a cart and left the city.');
  else if(state.attract>=55&&state.pop>=f.housing)unrest.push(f.housing>=POP_MAX?'🏘 The city is as big as its walls will ever hold.':'🏘 Families are turned away at the gate - there is not a roof left. Build more quarters.');
  state.pop+=moved;
  /* 🔔 another close the steward was not at the table for */
  if(state.chartered){
   state.unattended=num(state.unattended)+1;
   const n=state.unattended;
   if(n>=REMIND_AFTER&&(n-REMIND_AFTER)%3===0)unrest.push('🔔 You have ledgers to attend.'+(n>=NEGLECT_HARD?' The council meets without you now, and the city has stopped asking where you are.':n>=NEGLECT_AFTER?' The council has started to talk - and so has the city.':''));
  }
  state.ticks+=1;
  state.earned+=gotIn+Math.max(0,eventGold);
  state.spent+=paidOut+Math.max(0,-eventGold);
  /* 🌬 the winds wander on, each pulled back toward calm; a turn worth knowing about makes the news */
  if(live)for(const key of WIND_KEYS){
   const was=windName(key,state.winds[key]);
   state.winds[key]=clamp(Math.round((state.winds[key]*WIND_PULL+(draw(rng)-.5)*WIND_GUST)*1e3)/1e3,-WIND_MAX,WIND_MAX);
   const now=windName(key,state.winds[key]);
   if(now!==was)unrest.push(key==='trade'?'🌬 Trade on the roads and the river has turned '+now+'.':key==='harvest'?'🌬 Word from the farms: the harvest looks '+now+'.':'🌬 Prices in the market have turned '+now+'.');
  }
  /* 🏦 the season's book: a point on the chart, and at the last close the bank's review */
  let reviewed=null;
  if(state.chartered){
   const q=state.season;
   q.interest+=f.expenses.find(l=>l.id==='interest').amount;
   q.series.push({t:state.treasury,d:state.loan,n:net});q.closes=q.series.length;
   if(q.closes>=SEASON_CLOSES){
    reviewed=review(state,ctx,live?rng:null);
    const dealt=cardDef(state.season.card.id);
    if(dealt.id!=='ordinary')unrest.push('🎲 Season '+state.season.n+' opens: '+dealt.icon+' '+dealt.name+'. '+dealt.text);
    unrest.push('🏦 Season '+reviewed.n+' is closed. The Tides Bank grades your books '+reviewed.grade+': '+reviewed.verdict);
    unrest.push('🧾 A new season, and everybody on the crown’s payroll has asked for a rise: wages are up '+Math.round(WAGE_RISE*100)+'%.');
    if(reviewed.swept)unrest.push('🏦 The debt stood above the season’s target, so the bank called it in: '+reviewed.swept.toLocaleString()+' ◉ went from the strongroom straight to the debt.');
   }
  }
  const entry={n:state.ticks,covered,review:reviewed?{n:reviewed.n,grade:reviewed.grade}:null,in:gotIn,out:paidOut,expected:f.net,net,events:events.map(e=>e.text),unrest,mood:state.mood,favour:favour(state),
   treasury:state.treasury,protest:state.protest,was:before,unattended:num(state.unattended),food:state.food.stock,hunger:state.food.hunger,pop:state.pop,moved,attract:state.attract,trust:state.trust,finished,
   purse:state.crowned?f.purse:0};
  state.history.push(entry);
  while(state.history.length>HISTORY)state.history.shift();
  state.last=entry;
  return entry;
 }
 /* 🔔 the steward is at the table: the count starts again. Returns how many closes had gone by. */
 function attend(state){const n=num(state.unattended);state.unattended=0;return n;}
 /* Play time drives the clock. Returns how many closes fell inside this slice of time. */
 function advance(state,seconds){
  if(!state.chartered)return 0;                /* 🏦 the books do not open until the founding loan is signed */
  state.clock=num(state.clock)+Math.max(0,num(seconds));
  let closes=0;
  while(state.clock>=TICK_SECONDS){state.clock-=TICK_SECONDS;closes++;}
  return closes;
 }
 function setBudget(state,key,value){
  if(key==='tax'){if(!TAX_RATES.includes(value))return false;state.budget.tax=value;return true;}
  const g=group(key);
  if(!g||!g.levels[value])return false;
  if(LINES[key]&&frozen(state)&&value>state.budget[key])return false;   /* 🏦 in the red a line may be cut, never raised */
  state.budget[key]=value;return true;
 }
 function borrow(state,ctx,amount){
  if(!state.chartered)return 0;
  const room=creditLimit(ctx,state)-state.loan,n=Math.min(Math.floor(num(amount)),room);
  if(n<=0)return 0;
  state.loan+=n;state.treasury+=n;state.borrowed+=n;
  return n;
 }
 /* what counts with the bank is where the debt stands when the season closes, not how often gold went to and fro */
 function repay(state,amount){
  const n=Math.min(Math.floor(num(amount)),state.loan,Math.max(0,state.treasury));
  if(n<=0)return 0;
  state.loan-=n;state.treasury-=n;state.repaid=num(state.repaid)+n;
  return n;
 }
 /* Moving gold between the treasury and the hero's purse. room is what the purse can still hold.
    🤝 The Master of Coin counts what a steward carries out of the strongroom, and the city hears:
    a point of trust for every 1 500 ◉ taken (at most ten at a time), half that back for gold put
    in - so lining your pockets and winning the crown pull in opposite directions. A crowned head
    takes what is its own. 🏦 And borrowed gold never leaves the strongroom: only what the treasury
    holds beyond what it owes the bank can be carried out, by a steward or a crowned head alike. */
 function withdraw(state,amount,room,ctx){
  const n=Math.min(Math.floor(num(amount)),Math.max(0,state.treasury-state.loan),Math.max(0,Math.floor(num(room))));
  if(n<=0)return 0;
  state.treasury-=n;
  if(!state.crowned)state.trust=clamp(round1(num(state.trust)-Math.min(10,n/(1500*scale(ctx||{})))),0,100);
  return n;
 }
 function deposit(state,amount,purse,ctx){
  const n=Math.min(Math.floor(num(amount)),Math.max(0,Math.floor(num(purse))));
  if(n<=0)return 0;
  state.treasury+=n;
  state.trust=clamp(round1(num(state.trust)+Math.min(3,n/(3000*scale(ctx||{})))),0,100);
  return n;
 }
 /* 🥊 pay sellswords, carters or bakers to make one incident go away now, from a treasury that has it */
 function settle(state,ctx,id){
  const i=state.incidents.findIndex(x=>x.id===id);if(i<0)return 0;
  const cost=settleCost(incidentDef(id),ctx);
  if(state.treasury<cost)return 0;
  state.treasury-=cost;state.spent+=cost;state.incidents.splice(i,1);
  state.mood=clamp(state.mood+2,0,100);state.trust=clamp(round1(num(state.trust)+1),0,100);
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
   state.trust=clamp(round1(num(state.trust)+1),0,100);
   let freed=0;
   if(p.amnesty){freed=state.jail.filter(x=>/rent|bread|tax/.test(x.crime)&&!x.life).length;state.jail=state.jail.filter(x=>x.life||!/rent|bread|tax/.test(x.crime));}
   state.petition=null;
   return {ok:true,accepted:true,text:'Granted. The '+seatDef(p.seat).title+' will remember it.'+(freed?' '+freed+' debtor'+(freed>1?'s':'')+' walked out of the gaol.':'')};
  }
  bump(p.seat,-8);state.petition=null;
  return {ok:true,accepted:false,text:'Refused. The '+seatDef(p.seat).title+' bows, stiffly.'};
 }
 return Object.freeze({create,normalize,forecast,tick,advance,setBudget,borrow,repay,withdraw,deposit,settle,answer,councilView,
  worksView,invest,crownView,answerKing,claimCrown,gaolView,pardon,fine,worksFx,has,cells,charter,charterView,bankView,rehire,frozen,attend,neglect,REMIND_AFTER,NEGLECT_AFTER,NEGLECT_HARD,TRUST_SLOPE,TRUST_DRAIN_MAX,SEAT_SLOPE,SEAT_DRAIN_MAX,MOOD_SLOPE,MOOD_DRAIN_MAX,DRAW_SLOPE,DRAW_DRAIN_MAX,
  POP_MAX,HOUSEHOLD,hearths,SEASON_CARDS,cardDef,dealCard,
  windName,WIND_KEYS,WIND_MAX,JITTER_IN,JITTER_OUT,WAGE_RISE,WAGE_MAX,HERO_EXPORTS_MAX,HERO_FARM_LEVELS,
  foodView,buyFood,setAutoFood,HUNGER_GAIN,HUNGER_EASE,FOOD_STORE,FOOD_START,FOOD_CAP,FOOD_PRICE,AUTO_PREMIUM,FOOD_RESERVE,HUNGER_MAX,FOOD_LOW,FOOD_LOTS,
  creditLimit,favour,favourName,moodName,moodColor,attractName,trustName,pleasureName,scale,
  VERSION,COIN,SEASON_CLOSES,FOUNDING_LOAN,RESERVE_LINE,MIN_RATE,MAX_RATE,RED_FLOOR,DUE_SHARE,COVER_FEE,SEIZE_AFTER,GUARD_WAGE,MIN_GUARD,
  TICK_SECONDS,LOAN_RATE,OVERDRAFT_RATE,HISTORY,POPULATION,MIN_POP,HOUSING,LEAVE_MAX,MAX_BUILDING,CELLS,MAX_CELLS,COUP_TRUST,ROYAL_GUARD,PROTEST_START,PROTEST_END,MAX_INCIDENTS,
  TAX_RATES,TAX_MOOD,TAX_ATTRACT,LINES,LINE_KEYS,RATES,RATE_KEYS,DEFAULT_BUDGET,EVENTS,INCIDENTS,COUNCIL,PETITIONS,WORKS,WORK_CATS,HUMOURS,DEMANDS,CRIMES});
});
