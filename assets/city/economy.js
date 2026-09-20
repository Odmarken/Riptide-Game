/* 👑 The Crown Ledger - the City's treasury, budget, loans, temper, unrest and council; and on top
 * of those the long game: the rates the crown charges (rents, market fees, duties), public works
 * that are bought once and pay for ever, the learning of the people, how attractive the city is and
 * so how many live in it, a King with a purse, humours and wishes of his own, a gaol that fills and
 * empties, and the realm's trust in YOU - at a hundred the crown is there to be taken. Pure
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
 const POPULATION=72;             /* the townsfolk on the streets (CITY_FOLK) when the books open */
 const MIN_POP=6,HOUSING=96;      /* the last few never leave; roofs for 96 until more are built */
 const MAX_BUILDING=3;            /* the Master Builder has three crews */
 const CELLS=6,MAX_CELLS=10;      /* the gaol under the hall: six cells, ten with the new wing */
 const COUP_TRUST=100;            /* the realm's trust in you at which the crown can be claimed */
 const ROYAL_GUARD=8;             /* the men at the pillars of the hall, paid before anyone */
 const PROTEST_START=25,PROTEST_END=40;   /* hysteresis, so the crowd does not flicker */
 const MAX_INCIDENTS=2;           /* the city never burns in more than two places at once */
 const CREDIT_CAP=2000000;        /* the most a good name is worth on top of the base limit */
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
   {name:'Standard',men:5,cost:200,mood:0,order:1},
   {name:'Doubled',men:10,cost:400,mood:4,order:1.15,attract:4},
   {name:'Royal',men:15,cost:620,mood:6,order:1.25,attract:6}]},
  roads:{name:'Roads & Walls',icon:'🧱',blurb:'Cobbles, gates and the curtain wall. Good roads carry more trade.',levels:[
   {name:'Neglected',cost:0,mood:-8,trade:.8,attract:-5},
   {name:'Kept',cost:150,mood:0,trade:1},
   {name:'Paved',cost:320,mood:4,trade:1.12,attract:3},
   {name:'Grand',cost:520,mood:8,trade:1.22,attract:6}]},
  relief:{name:'Granary & Poor Relief',icon:'🍞',blurb:'Bread for the tenements. Nothing calms a city like a full granary.',levels:[
   {name:'None',cost:0,mood:-6,attract:-3},
   {name:'Bread dole',cost:120,mood:6},
   {name:'Full granary',cost:260,mood:14,attract:2},
   {name:'Feasts for all',cost:420,mood:22,attract:3}]},
  festival:{name:'Festivals',icon:'🎉',blurb:'Feast days, tournaments and games on the cathedral square. From feast days up, the boulevard is hung with bunting.',levels:[
   {name:'None',cost:0,mood:0},
   {name:'Feast days',cost:100,mood:5,attract:2},
   {name:'Tournaments',cost:240,mood:11,attract:5},
   {name:'Royal games',cost:400,mood:17,attract:8}]},
  court:{name:'The Royal Court',icon:'👑',blurb:'The King’s table, his guests and his tailors. A splendid court draws the gentry, and their gold - and keeps the King sweet.',levels:[
   {name:'Frugal',cost:60,mood:-3,trade:.95,attract:-1,pleasure:-8},
   {name:'Modest',cost:140,mood:0,trade:1},
   {name:'Splendid',cost:300,mood:2,trade:1.05,attract:2,pleasure:5},
   {name:'Lavish',cost:500,mood:4,trade:1.1,attract:4,pleasure:9}]},
  clean:{name:'Street Cleaning',icon:'🧹',blurb:'Sweepers, night-soil carts and rat-catchers. A clean city draws settlers; a filthy one breeds the flux - and you can see which it is from the boulevard.',levels:[
   {name:'Filth',cost:0,mood:-8,attract:-12},
   {name:'Sweepers',cost:90,mood:0},
   {name:'Night carts',cost:210,mood:4,attract:6},
   {name:'Spotless',cost:360,mood:7,attract:10}]},
  learn:{name:'Schools & Learning',icon:'📚',blurb:'Letters and numbers for the children of the city. Slow to pay and it never stops paying: skilled hands earn more, and owe more.',levels:[
   {name:'None',cost:0,mood:-2,skill:-15},
   {name:'Parish schools',cost:100,mood:0,skill:0},
   {name:'Grammar schools',cost:240,mood:2,skill:12,attract:2},
   {name:'Free schooling',cost:420,mood:5,skill:22,attract:4}]},
  food:{name:'Markets & Provisions',icon:'🥩',blurb:'Inspectors at the stalls, honest weights, fresh fish on ice. What the city eats is half of what it thinks of you.',levels:[
   {name:'Scraps',cost:0,mood:-7,attract:-8},
   {name:'Plain fare',cost:80,mood:0},
   {name:'Fresh markets',cost:200,mood:5,attract:5},
   {name:'Plenty',cost:340,mood:9,attract:9}]},
  purse:{name:'The King’s Purse',icon:'💎',blurb:'What the crown pays the one who wears it. A King kept short sulks, helps himself and has people arrested; a King kept well leaves you to your work.',levels:[
   {name:'Pittance',cost:50,mood:2,pleasure:22},
   {name:'Customary',cost:140,mood:0,pleasure:55},
   {name:'Generous',cost:320,mood:-1,pleasure:72},
   {name:'Princely',cost:580,mood:-3,pleasure:88}]},
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
 const RATE_KEYS=Object.keys(RATES);
 const DEFAULT_BUDGET=Object.freeze({tax:10,rent:1,fee:1,duty:1,watch:1,roads:1,relief:1,festival:0,court:1,clean:1,learn:1,food:1,purse:1});
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
  {id:'carters',cat:'trade',name:'Carters’ Yard',icon:'🐴',cost:1500,build:1,upkeep:20,fx:{exports:110,trade:.03},site:'house',sign:'CARTERS’ YARD',
   blurb:'Stabling, a wheelwright and a loading dock inside the west gate. Wagons start to roll the boulevard.',done:'The first wagons are on the boulevard.'},
  {id:'caravanserai',cat:'trade',name:'Caravanserai',icon:'🐫',cost:3200,build:2,upkeep:40,needs:['carters'],fx:{tolls:190,attract:3},site:'house',sign:'CARAVANSERAI',
   blurb:'Beds, fodder and a strongroom for the long-haul caravans from Moonshine. They stay, and they spend.',done:'The Moonshine caravans overnight in the city now.'},
  {id:'quay',cat:'trade',name:'Stone Quay',icon:'⚓',cost:4200,build:2,upkeep:50,needs:['carters'],fx:{exports:260},site:'house',sign:'HARBOUR OFFICE',
   blurb:'A proper quay at the river gate in place of the mud landing. Barges load in an hour instead of a day.',done:'Barges are loading at the new quay.'},
  {id:'customs',cat:'trade',name:'Customs House',icon:'🧾',cost:3000,build:2,upkeep:40,fx:{duty:.45,order:.04},site:'house',sign:'CUSTOMS HOUSE',blocks:['smugglers'],
   blurb:'Scales, seals and clerks who cannot be bought cheaply. Nothing slips past the east gate again.',done:'The smugglers will have to find another city.'},
  {id:'fleet',cat:'trade',name:'Merchant Fleet',icon:'⛵',cost:9000,build:3,upkeep:130,needs:['quay'],fx:{exports:620},site:'house',sign:'FLEET COUNTING HOUSE',
   blurb:'Three cogs under the crown’s own flag. The city’s ore and steel sail to foreign courts instead of waiting for buyers.',done:'Three cogs sailed on the morning tide under your flag.'},
  {id:'lighthouse',cat:'trade',name:'Lighthouse',icon:'🗼',cost:4800,build:2,upkeep:40,needs:['quay'],fx:{trade:.07,exports:90},
   blurb:'A fire on the point at the river mouth. Captains who used to pass in the dark put in instead.',done:'The light on the point burned all night.'},
  {id:'exchange',cat:'trade',name:'Merchants’ Exchange',icon:'🏛',cost:12000,build:3,upkeep:110,needs:['fleet','caravanserai'],fx:{trade:.12,income:260,attract:4},site:'house',sign:'THE EXCHANGE',
   blurb:'A pillared hall where cargoes are sold before they land. Every trading house in three realms wants a desk in it.',done:'The Exchange rang its bell for the first time.'},
  {id:'school',cat:'learn',name:'Parish Schoolhouse',icon:'🏫',cost:2200,build:1,upkeep:40,fx:{skill:8,mood:2},site:'house',sign:'SCHOOLHOUSE',
   blurb:'One room, one stove, one master with a birch. The start of everything else on this list.',done:'Forty children learned the letter A.'},
  {id:'apprentice',cat:'learn',name:'Guild Apprenticeships',icon:'🛠',cost:2800,build:1,upkeep:40,needs:['school'],fx:{skill:6,exports:100},site:'house',sign:'APPRENTICE HALL',
   blurb:'The crown pays the indenture; the guilds take the poor boys as well as the masters’ sons.',done:'The guilds took forty new apprentices.'},
  {id:'library',cat:'learn',name:'Public Library',icon:'📖',cost:5000,build:2,upkeep:55,needs:['school'],fx:{skill:10,attract:4},site:'house',sign:'LIBRARY',
   blurb:'Six hundred books, chained to the desks, open to anyone with clean hands.',done:'The library opened its doors.'},
  {id:'press',cat:'learn',name:'Printing Press',icon:'📰',cost:4200,build:2,upkeep:30,needs:['library'],fx:{skill:8,income:70},site:'house',sign:'PRINTING HOUSE',
   blurb:'Almanacs, psalters and a weekly broadsheet. The town crier gets a great deal more to shout about.',done:'The first broadsheet sold out by noon.'},
  {id:'university',cat:'learn',name:'University of the Tides',icon:'🎓',cost:16000,build:4,upkeep:190,needs:['library'],fx:{skill:22,attract:8,income:240},site:'house',sign:'UNIVERSITY',
   blurb:'Law, physic and the natural philosophy of tides. Students come from four realms, and they all pay rent.',done:'The University matriculated its first scholars.'},
  {id:'sewers',cat:'living',name:'Sewers & Drains',icon:'🕳',cost:5200,build:3,upkeep:40,fx:{attract:6,mood:3,clean:1},blocks:['flood','flux'],
   blurb:'Brick drains under the lower streets, out to the river. The rain goes where it is told, and so does everything else.',done:'The lower streets stayed dry in the rain.'},
  {id:'aqueduct',cat:'living',name:'Aqueduct & Fountain',icon:'⛲',cost:8000,build:3,upkeep:50,needs:['sewers'],fx:{attract:7,mood:3},site:'fountain',
   blurb:'Sweet water from the hills, ending in a fountain on the great square.',done:'Water ran in the fountain on the square.'},
  {id:'bathhouse',cat:'living',name:'Public Bathhouse',icon:'🛁',cost:3400,build:2,upkeep:45,fx:{mood:3,attract:3,income:80},site:'house',sign:'BATHHOUSE',
   blurb:'Hot water, a penny a head. The city smells better within the week.',done:'The bathhouse lit its furnaces.'},
  {id:'hospital',cat:'living',name:'Hospital of St Agnes',icon:'🏥',cost:7200,build:3,upkeep:100,fx:{mood:5,attract:5},site:'house',sign:'HOSPITAL',blocks:['flux'],
   blurb:'Forty beds and sisters who wash their hands. The flux stops at its door.',done:'The sisters took in their first patients.'},
  {id:'coveredmarket',cat:'living',name:'Covered Market',icon:'🏪',cost:4000,build:2,upkeep:35,fx:{tolls:230,attract:2},site:'stalls',
   blurb:'Pitches under cover on the great square, let by the season. Twice the stalls, in any weather.',done:'The square filled with new awnings.'},
  {id:'tenements',cat:'living',name:'New Tenements',icon:'🏘',cost:4800,build:2,upkeep:0,fx:{housing:24},site:'house',sign:'NEW TENEMENTS',
   blurb:'Four storeys of sound brick on crown land. Roofs for two dozen more - who will all pay rent and poll tax.',done:'Two dozen new households have a roof.'},
  {id:'newquarter',cat:'living',name:'The New Quarter',icon:'🏙',cost:11000,build:4,upkeep:40,needs:['tenements','sewers'],fx:{housing:40,attract:3},site:'house',sign:'THE NEW QUARTER',
   blurb:'A planned district with drains, a well on every corner and room for forty households.',done:'The New Quarter was opened with a ribbon and a band.'},
  {id:'lamps',cat:'culture',name:'Street Lamps',icon:'🏮',cost:2400,build:1,upkeep:35,fx:{order:.05,attract:4,mood:2},site:'lamps',
   blurb:'Oil lamps the length of the great boulevard, and lamplighters to tend them.',done:'The boulevard was lit from gate to palace.'},
  {id:'gardens',cat:'culture',name:'Royal Gardens',icon:'🌳',cost:3800,build:2,upkeep:45,fx:{attract:6,mood:3},site:'garden',
   blurb:'Flower beds and young limes on the great square, open to all.',done:'The gardens on the square came into flower.'},
  {id:'theatre',cat:'culture',name:'Playhouse',icon:'🎭',cost:5600,build:2,upkeep:60,fx:{mood:5,attract:5,income:90},site:'house',sign:'PLAYHOUSE',
   blurb:'A wooden O with a thatched gallery. Tragedies on Mondays.',done:'The Playhouse opened with a comedy about a tax collector.'},
  {id:'arena',cat:'culture',name:'Tourney Grounds',icon:'🏇',cost:8800,build:3,upkeep:80,fx:{mood:4,attract:6,income:210},site:'house',sign:'TOURNEY LISTS',
   blurb:'Permanent lists with stands for two thousand. Knights come for the prize; the crowd comes for the knights.',done:'The lists saw their first broken lance.'},
  {id:'statue',cat:'culture',name:'Statue of the Steward',icon:'🗿',cost:2600,build:1,upkeep:0,fx:{attract:2},site:'statue',once:{trust:5,pleasure:-8},
   blurb:'You, in bronze, on the great square. The people will like it. The King will not.',done:'Your statue was unveiled on the square.'},
  {id:'watchtowers',cat:'order',name:'Watchtowers',icon:'🗼',cost:3200,build:2,upkeep:45,fx:{order:.08,safety:.06},
   blurb:'Manned towers on the curtain wall with bells that carry to every ward. Trouble is seen before it starts.',done:'The tower bells were tested. The whole city jumped.'},
  {id:'courthouse',cat:'order',name:'Courthouse',icon:'⚖️',cost:4800,build:2,upkeep:55,fx:{mood:2,fines:1},site:'house',sign:'COURTHOUSE',once:{trust:3},
   blurb:'Judges, juries and written law. Fines double, and the gaol pays a little of its own way.',done:'The first case was heard in open court.'},
  {id:'gaolwing',cat:'order',name:'New Gaol Wing',icon:'⛓',cost:2600,build:1,upkeep:25,fx:{cells:4},
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
  {text:'Rats got into the granary.',gold:-150,mood:-4,w:2,when:s=>s.budget.relief<=1},
  {text:'The cathedral held a feast day and the whole city turned out.',mood:5,w:3},
  {text:'A week of rain flooded the lower streets.',gold:-120,mood:-3,w:2,tag:'flood',when:s=>s.budget.roads<=1},
  {text:'The Mining Hall struck a rich seam.',gold:280,w:2,when:(s,c)=>!!c.miningTrained},
  {text:'An emerald cut in the Enchanting Hall sold to a foreign court.',gold:300,w:2,when:(s,c)=>!!c.enchTrained},
  {text:'The tournament drew knights from three realms.',gold:240,mood:3,w:2,when:s=>s.budget.festival>=2},
  {text:'A travelling circus pitched its tents outside the wall.',mood:4,gold:90,w:2},
  {text:'A merchant prince opened a counting house on the boulevard.',gold:340,w:1.5,when:s=>s.mood>=60},
  {text:'A preacher in the square blamed the crown for the price of bread.',mood:-4,w:2,when:s=>s.mood<50},
  {text:'Wolves took sheep from the farms beyond the wall.',gold:-110,mood:-2,w:1.5},
  {text:'The flux went through the lower wards. The carts were busy for a week.',gold:-260,mood:-6,pop:-3,w:2.5,tag:'flux',when:s=>s.budget.clean===0},
  {text:'Spoiled meat at the shambles put half a street to bed.',gold:-90,mood:-4,w:2,when:s=>s.budget.food===0},
  {text:'The fleet came home from the southern ports with its holds full of silver.',gold:520,w:2,when:s=>has(s,'fleet')},
  {text:'A scholar of the University published a treatise the whole continent is reading.',gold:160,mood:2,w:1.5,when:s=>has(s,'university')},
  {text:'The Playhouse’s new comedy ran for three weeks to full houses.',gold:140,mood:3,w:1.5,when:s=>has(s,'theatre')},
  {text:'A guild of weavers moved to the city, looms and all.',gold:120,pop:4,w:1.5,when:s=>s.attract>=65},
  {text:'Three families loaded a cart and left by the west gate before dawn.',pop:-3,mood:-1,w:2,when:s=>s.attract<35},
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
  return {treasury:5000,loan:0,mood:60,clock:0,ticks:0,earned:0,spent:0,borrowed:0,repaid:0,credit:0,protest:false,
   budget:{...DEFAULT_BUDGET},incidents:[],council,petition:null,
   pop:POPULATION,attract:50,skill:20,trust:10,crowned:false,deposed:null,
   king:{pleasure:60,humour:'content',humourAge:0,demand:null,raise:0},works:{},jail:[],
   history:[],last:null};
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
  for(const k of LINE_KEYS.concat(RATE_KEYS))out.budget[k]=group(k).levels.indexOf(level(k,b[k]));
  const seen=new Set();
  out.incidents=(Array.isArray(s.incidents)?s.incidents:[]).filter(i=>i&&incidentDef(i.id)&&!seen.has(i.id)&&seen.add(i.id))
   .slice(0,MAX_INCIDENTS).map(i=>({id:i.id,age:Math.max(0,Math.floor(num(i.age,0)))}));
  for(const seat of COUNCIL)out.council[seat.id]=clamp(Math.round(num(s.council&&s.council[seat.id],60)),0,100);
  out.petition=s.petition&&petitionDef(s.petition.id)?{id:s.petition.id,age:Math.max(0,Math.floor(num(s.petition.age,0)))}:null;
  /* the long game - every field is new to a save from before it, and takes its opening value */
  out.pop=clamp(Math.round(num(s.pop,POPULATION)),MIN_POP,999);
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
 /* The whole ledger for one close, before it happens. Everything the panel shows comes from here,
    so the numbers on the budget tab are exactly what the next close will charge. */
 function forecast(state,ctx={}){
  const k=scale(ctx),b=state.budget,r=v=>Math.round(v);
  const L={};for(const key of LINE_KEYS.concat(RATE_KEYS))L[key]=level(key,b[key]);
  const {watch,roads,relief,festival,court,clean,learn,food,purse,rent,fee,duty}=L;
  const W=worksFx(state),K=state.king,crowned=!!state.crowned;
  const fav=favour(state),backing=fav>=75?1.06:1;
  const order=watch.order+W.order,trade=roads.trade*court.trade*backing*duty.vol*(1+W.trade);
  const temper=.7+state.mood/333;             /* the restless dodge the tax man: 0.7 at 0, 1.0 at 100 */
  const craft=1+(state.skill-20)*.006;        /* 📚 learned hands earn more: 1.0 at 20, 1.48 at 100 */
  const visit=.85+state.attract*.003;         /* a city worth visiting fills its market: 1.0 at 50 */
  const mining=num(ctx.mining),ench=num(ctx.ench),smith=num(ctx.smith),farmLvl=Math.max(1,num(ctx.farmLvl,1));
  const limit=creditLimit(ctx,state);
  const incidents=(state.incidents||[]).map(i=>{
   const def=incidentDef(i.id),grow=1+Math.min(i.age,4)*.25;        /* left alone, it spreads */
   return {id:def.id,name:def.name,icon:def.icon,text:def.text,fix:def.fix,line:def.line,level:def.level,street:!!def.street,age:i.age,
    mood:r(def.mood*grow),gold:r(-def.gold*grow*k),cost:settleCost(def,ctx),met:b[def.line]>=def.level};
  });
  const held=state.jail.length,room=cells(state),crowded=Math.max(0,held-room);
  const fines=W.fines?r(held*14*k):0;
  const income=[
   {id:'taxes',name:'Poll tax',icon:'💰',amount:r(state.pop*b.tax/100*80*k*temper*craft),note:state.pop+' townsfolk at '+b.tax+'% - '+TAX_NOTE[b.tax]},
   {id:'rents',name:'Crown rents',icon:'🏠',amount:r(state.pop*rent.rate*k*temper),note:rent.name+' - '+rent.rate+' ◉ a head from '+state.pop+' townsfolk'},
   {id:'tolls',name:'Market tolls',icon:'⚖️',amount:r((300*fee.vol+W.tolls)*fee.rate*k*order*trade*(.75+state.mood/200)*visit),note:'the square, the terraces and the tenement stalls - fees '+fee.name.toLowerCase()},
   {id:'exports',name:'Exports',icon:'🚢',amount:r((200+mining*6+smith*40+ench*4+W.exports)*k*trade*craft),note:'ore, gems and forged steel out through the gate'},
   {id:'imports',name:'Import duties',icon:'📦',amount:r(220*k*order*duty.rate*duty.vol*(1+W.duty)),note:'customs on everything that comes in - '+duty.name.toLowerCase()},
   {id:'guilds',name:'Guild dues',icon:'⛏',amount:r(((ctx.miningTrained?120:0)+(ctx.enchTrained?120:0)+(ctx.smelter?80:0))*k),note:'the Mining Hall, the Enchanting Hall and the smelter'},
   {id:'farm',name:'Farm levy',icon:'🚜',amount:ctx.farmOwned?r(farmLvl*90*k):0,note:ctx.farmOwned?'your farm, level '+farmLvl:'no farm of your own yet'},
   {id:'licence',name:'Gaming licence',icon:'🎲',amount:r(150*k),note:'the Moonshine casino pays for the privilege'},
   {id:'works',name:'Crown works',icon:'🏗',amount:r(W.income*k)+fines,note:!W.count?'nothing built yet - see the Works tab':W.income||fines?'fees, gate money'+(fines?' and court fines':'')+' from '+W.count+' public work'+(W.count>1?'s':''):W.count+' public work'+(W.count>1?'s':'')+' standing - what they earn shows in the lines above'},
  ];
  const purseCost=r(purse.cost*(1+.15*num(K.raise))*k);
  const expenses=[
   {id:'guard',name:'Royal Guard',icon:'⚔️',amount:r(ROYAL_GUARD*45*k),note:ROYAL_GUARD+' men at the pillars of the hall'},
   {id:'watch',name:'City Watch',icon:'🛡',amount:r(watch.cost*k),note:watch.men+' men - '+watch.name},
   {id:'roads',name:'Roads & Walls',icon:'🧱',amount:r(roads.cost*k),note:roads.name},
   {id:'relief',name:'Granary & Poor Relief',icon:'🍞',amount:r(relief.cost*k),note:relief.name},
   {id:'festival',name:'Festivals',icon:'🎉',amount:r(festival.cost*k),note:festival.name},
   {id:'court',name:'The Royal Court',icon:'👑',amount:r(court.cost*k),note:court.name},
   {id:'clean',name:'Street Cleaning',icon:'🧹',amount:r(clean.cost*k),note:clean.name},
   {id:'learn',name:'Schools & Learning',icon:'📚',amount:r(learn.cost*k),note:learn.name},
   {id:'food',name:'Markets & Provisions',icon:'🥩',amount:r(food.cost*k),note:food.name},
   {id:'purse',name:crowned?'Your privy purse':'The King’s Purse',icon:'💎',amount:purseCost,note:purse.name+(crowned?' - paid into your own purse at every close':K.raise?' - raised '+K.raise+' time'+(K.raise>1?'s':'')+' at his insistence':'')},
   {id:'upkeep',name:'Upkeep of the works',icon:'🏗',amount:r(W.upkeep*k),note:W.count?'lamplighters, librarians, harbour pilots':'nothing to keep up yet'},
   {id:'gaol',name:'The gaol',icon:'⛓',amount:r(held*12*k),note:held?held+' prisoner'+(held>1?'s':'')+' in '+room+' cells':'the cells are empty'},
   {id:'interest',name:'Tides Bank interest',icon:'🏦',amount:r(state.loan*LOAN_RATE),note:state.loan>0?(LOAN_RATE*100)+'% of '+state.loan.toLocaleString()+' owed':'nothing owed'},
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
   {name:'A treasury below zero',value:state.treasury<0?-18:0},
   {name:'Deep in debt to the bank',value:state.loan>limit*.6?-4:0},
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
   ...['watch','roads','relief','festival','court','clean','learn','food'].map(key=>({name:LINES[key].name+' - '+L[key].name,value:num(L[key].attract)})),
   {name:'What the people have learned ('+Math.round(state.skill)+')',value:r((state.skill-20)/10)},
   {name:'Public works',value:W.attract},
   {name:'Trouble in the streets',value:-4*incidents.length},
   {name:'The march on the boulevard',value:state.protest?-15:0},
   {name:'An overcrowded gaol',value:crowded?-3:0},
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
  ];
  const trustDelta=round1(trustFactors.reduce((t,f)=>t+f.value,0));
  const pleasureTarget=clamp(purse.pleasure+num(court.pleasure)+(state.mood>=70?4:0)-(state.protest?12:0)-(state.treasury<0?6:0),0,100);
  return {income,expenses,totalIn,totalOut,net:totalIn-totalOut,moodTarget,moodFactors,incidents,favour:fav,backing,order,trade,scale:k,creditLimit:limit,
   attractTarget,attractFactors,housing,skillTarget,craft,visit,trustFactors,trustDelta,pleasureTarget,purse:purseCost,cells:room,crowded,works:W};
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
   const status=own?(own.left>0?'building':'done'):missing.length?'locked':building>=MAX_BUILDING?'busy':state.treasury<cost?'poor':'ready';
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
  if(v.status==='busy')return {ok:false,text:'All '+MAX_BUILDING+' of the Master Builder’s crews are at work. Wait for one to finish.'};
  if(v.status==='poor')return {ok:false,text:'The treasury cannot cover '+v.cost.toLocaleString()+' ◉. The Tides Bank lends against a plan like this.'};
  state.treasury-=v.cost;state.spent+=v.cost;state.works[id]={left:v.build};
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
 /* One close: charge the ledger, roll the week's news, move the temper a third of the way to where
    the budget says it belongs, settle or spread the unrest, let the council make up its mind, and
    decide whether the crowd is on the boulevard. Then the long game: crews build, the King wants,
    the people learn, the gaol turns over, the realm weighs you, and families come or go. Every new
    roll comes AFTER the old ones, so a scripted rng still means what it meant. */
 function tick(state,ctx={},rng=Math.random){
  const f=forecast(state,ctx),k=f.scale,unrest=[];
  const rolled=rollEvents(state,ctx,rng,f.works.blocks);
  const events=rolled.map(e=>({text:e.text,gold:Math.round(num(e.gold)*k),mood:num(e.mood)}));
  const eventGold=events.reduce((t,e)=>t+e.gold,0);
  let moodShift=events.reduce((t,e)=>t+e.mood,0),moved=rolled.reduce((t,e)=>t+num(e.pop),0),trustShift=0;
  const net=f.net+eventGold;
  const before=state.treasury;
  state.treasury=Math.round(state.treasury+net);
  /* unrest: what the budget now covers is dealt with, the rest bites and spreads */
  state.incidents=state.incidents.filter(i=>{
   const def=incidentDef(i.id);
   if(state.budget[def.line]>=def.level){unrest.push('✔ '+def.name+' - dealt with.');moodShift+=2;trustShift+=1;return false;}
   moodShift+=Math.round(def.mood/3);i.age+=1;return true;
  });
  if(state.incidents.length<MAX_INCIDENTS){
   const chance=clamp(.22+(state.mood<45?.10:0)+(state.budget.watch===0?.08:0)-f.works.safety,0,.5);
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
  /* 🏦 a good name: interest paid from a treasury in credit builds it, an overdraft burns it */
  if(state.treasury<0)state.credit=Math.round(state.credit*.92);
  else state.credit=clamp(state.credit+(state.loan>0?Math.round(state.loan*LOAN_RATE*2):net>0?Math.round(100*k):0),0,CREDIT_CAP);
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
   }else if(draw(rng)<humourDef(K.humour).chance){
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
  /* 📚 the people learn, slowly; 🧲 the city's name spreads; 🤝 the realm weighs you */
  state.skill=clamp(round1(state.skill+(f.skillTarget-state.skill)*.08),0,100);
  state.attract=clamp(Math.round(state.attract+(f.attractTarget-state.attract)*.3),0,100);
  state.trust=clamp(round1(state.trust+f.trustDelta+trustShift),0,100);
  /* 🧳 families come to a city worth living in, and leave one that is not */
  const roll=draw(rng);
  if(state.attract>=55)moved+=Math.floor((state.attract-50)/10+roll);
  else if(state.attract<40)moved-=Math.floor((40-state.attract)/8+roll);
  moved=clamp(moved,MIN_POP-state.pop,Math.max(0,f.housing-state.pop));
  if(moved>0)unrest.push('🧳 '+moved+' new townsfolk came through the west gate to stay.');
  else if(moved<0)unrest.push('🎒 '+(-moved)+' townsfolk packed a cart and left the city.');
  else if(state.attract>=55&&state.pop>=f.housing)unrest.push('🏘 Families are turned away at the gate - there is not a roof left. Build tenements.');
  state.pop+=moved;
  state.ticks+=1;
  state.earned+=f.totalIn+Math.max(0,eventGold);
  state.spent+=f.totalOut+Math.max(0,-eventGold);
  const entry={n:state.ticks,in:f.totalIn,out:f.totalOut,net,events:events.map(e=>e.text),unrest,mood:state.mood,favour:favour(state),
   treasury:state.treasury,protest:state.protest,was:before,pop:state.pop,moved,attract:state.attract,trust:state.trust,finished,
   purse:state.crowned?f.purse:0};
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
  const g=group(key);
  if(!g||!g.levels[value])return false;
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
 /* Moving gold between the treasury and the hero's purse. room is what the purse can still hold.
    🤝 The Master of Coin counts what a steward carries out of the strongroom, and the city hears:
    a point of trust for every 1 500 ◉ taken (at most ten at a time), half that back for gold put
    in - so lining your pockets and winning the crown pull in opposite directions. A crowned head
    takes what is its own. */
 function withdraw(state,amount,room,ctx){
  const n=Math.min(Math.floor(num(amount)),Math.max(0,state.treasury),Math.max(0,Math.floor(num(room))));
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
  worksView,invest,crownView,answerKing,claimCrown,gaolView,pardon,fine,worksFx,has,cells,
  creditLimit,favour,favourName,moodName,moodColor,attractName,trustName,pleasureName,scale,
  TICK_SECONDS,LOAN_RATE,OVERDRAFT_RATE,HISTORY,POPULATION,MIN_POP,HOUSING,MAX_BUILDING,CELLS,MAX_CELLS,COUP_TRUST,ROYAL_GUARD,PROTEST_START,PROTEST_END,MAX_INCIDENTS,CREDIT_CAP,
  TAX_RATES,TAX_MOOD,TAX_ATTRACT,LINES,LINE_KEYS,RATES,RATE_KEYS,DEFAULT_BUDGET,EVENTS,INCIDENTS,COUNCIL,PETITIONS,WORKS,WORK_CATS,HUMOURS,DEMANDS,CRIMES});
});
