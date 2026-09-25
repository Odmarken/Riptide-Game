/* 👑 The palace of Silverfjord, inside: King Sigvald's throne hall, his council chamber in the east wing and the jail a
 * stair below - the same three rooms as the City's Throne Hall, in white marble, blue and silver. It is a TownWorld interior
 * (no sea, walls round every room): you come in through the doors at the foot of the hall from the palace forecourt, the
 * stair in the hall's south-west corner takes you down to the cells and the one in the jail's east end brings you back up. */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=4000,H=8000,CX=1500;                                    /* CX: the carpet, the throne, the doors */
 const HALL={x0:600,x1:2400,y0:1900,y1:4200},COUNCIL={x0:2560,x1:3760,y0:2300,y1:3300},JAIL={x0:400,x1:2300,y0:7000,y1:7600};
 /* the jail is a storey down: far enough below the hall that no screen, however large, shows both at once (a 4K view is
    about 2400 units tall) - it used to sit 800 below the doors and its torch wall was in sight from the throne hall */
 const art={
  sf_throne_backdrop:{src:'towns/sf_throne_backdrop',h:520,drop:6,r:0,noShadow:true},   /* the canopy, the blue curtains and the crest on the wall behind the throne */
  sf_throne:{src:'towns/sf_throne',h:360,drop:12,r:0,crx:110,cry:36,cyo:-20,glow:[[.5,.35,120,[190,215,255]]]},
  sf_hall_pillar:{src:'towns/sf_hall_pillar',h:560,drop:10,r:36,glow:[[.83,.39,90]]},
  sf_hall_brazier:{src:'towns/sf_hall_brazier',h:220,drop:10,r:34,glow:[[.5,.28,170]],fire:[.5,.26,1]},
  sf_council_table:{src:'towns/sf_council_table',h:300,drop:12,r:0,crx:200,cry:70,cyo:-60,glow:[[.25,.15,110]]},
  sf_candelabra:{src:'towns/sf_candelabra',h:210,drop:8,r:18,glow:[[.5,.12,130]]},
  sf_stair_down:{src:'towns/sf_stair_down',h:200,drop:10,r:0,noShadow:true},
  sf_hall_bay:{src:'towns/sf_hall_bay',h:520,drop:4,fit:true,mirrorHalf:true},   /* mirrorHalf: the east half is the west half reflected, so the throne sits in a symmetric wall */   /* one clean bay of the hall wall, pillar to pillar, a whole number of them to a wall */
  sf_council_wall:{src:'towns/sf_council_wall',h:514,drop:4,fit:true},   /* the council's own wall: the map of the realm between bookcases */
  sf_stair_up:{src:'towns/sf_stair_up',h:200,drop:10,r:0,noShadow:true},
  sf_jail_wall:{src:'towns/sf_jail_wall',h:420,drop:4,torches:[[0,.41],[.321,.41],[.499,.41],[.674,.41]]},   /* where the strip's painted torches burn */
  cell_bars:{src:'cell_bars',h:210,drop:6,r:0,crx:60,cry:10,cyo:-4},
  gaol_desk:{src:'gaol_desk',h:150,drop:10,r:0,crx:90,cry:30,cyo:-20},
  sf_banner:{src:'towns/sf_banner',h:270,drop:8,r:12,flag:true},
  sf_statue:{src:'towns/sf_statue',h:300,drop:10,r:40},
  sf_planter:{src:'towns/sf_planter',h:112,drop:8,r:26},
 };
 /* every edge of every room is a wall; a notch at the foot of the hall is the doorway out */
 const w=(x,y)=>[x,y,'wall'];
 const lands=[
  [w(HALL.x0,HALL.y0),w(HALL.x1,HALL.y0),w(HALL.x1,2700),w(COUNCIL.x0,2700),w(COUNCIL.x0,COUNCIL.y0),w(COUNCIL.x1,COUNCIL.y0),w(COUNCIL.x1,COUNCIL.y1),
   w(COUNCIL.x0,COUNCIL.y1),w(COUNCIL.x0,2900),w(HALL.x1,2900),w(HALL.x1,HALL.y1),w(CX+120,HALL.y1),w(CX+120,HALL.y1+70),w(CX-120,HALL.y1+70),w(CX-120,HALL.y1),w(HALL.x0,HALL.y1)],
  [w(JAIL.x0,JAIL.y0),w(JAIL.x1,JAIL.y0),w(JAIL.x1,JAIL.y1),w(JAIL.x0,JAIL.y1)],
 ];
 const roads=[{kind:'carpet',w:230,pts:[[CX,2110],[CX,2800],[CX,3500],[CX,HALL.y1+40]]}];   /* from the foot of the throne's steps to the doors: laid this way its crowns stand upright */
 const paths=[
  /* walks round the hall between the pillar rows, crossing the carpet between the pillars, and into the council chamber */
  {pts:[[860,2350],[860,2790],[860,3710],[860,4020],[CX,4020],[2140,4020],[2140,3710],[2140,2790],[2140,2350]]},{pts:[[860,3710],[CX,3710],[2140,3710]]},{pts:[[860,2790],[CX,2790],[2140,2790]]},
  {pts:[[2140,2790],[2480,2800],[2800,2800],[3160,3060],[3500,2800]]},
  {pts:[[700,JAIL.y0+300],[1300,JAIL.y0+360],[1640,JAIL.y0+440],[2060,JAIL.y0+440]]},   /* along the cells and past the jailer's desk to the stair */
 ];
 const walls=[{kind:'sf_hall_bay',x0:HALL.x0,x1:HALL.x1,y:HALL.y0},{kind:'sf_council_wall',x0:COUNCIL.x0,x1:COUNCIL.x1,y:COUNCIL.y0},{kind:'sf_jail_wall',x0:JAIL.x0,x1:JAIL.x1,y:JAIL.y0}];
 /* a blue rug under the council table; the great doors, seen from above, laid over the wall at the foot of the hall */
 const decals=[{key:'towns/sf_council_rug',x:3160,y:2790,w:720,h:497,shadow:false},{key:'towns/sf_hall_door',x:CX,y:4280,w:604,h:441,shadow:false,over:true}];
 const buildings=[],props=[];
 const P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 /* the throne on its steps, braziers either side, the pillars down the hall */
 P('sf_throne_backdrop',CX,HALL.y0+8);P('sf_throne',CX,HALL.y0+180);   /* forward enough that its spire clears the crest behind it */
 P('sf_hall_brazier',CX-300,HALL.y0+190);P('sf_hall_brazier',CX+300,HALL.y0+190);
 for(const y of [2560,3020,3480,3940])for(const x of [1060,1940])P('sf_hall_pillar',x,y);
 for(const y of [2320,3260])for(const x of [700,2300])P('sf_banner',x,y);
 for(const y of [2780,3700])for(const x of [720,2280])P('sf_candelabra',x,y);
 P('sf_statue',760,HALL.y0+120);P('sf_statue',2240,HALL.y0+120);P('sf_planter',1180,4120);P('sf_planter',1820,4120);
 /* the council chamber */
 P('sf_council_table',3160,2880);P('sf_candelabra',2680,2420);P('sf_candelabra',3640,2420);P('sf_banner',2660,3200);P('sf_banner',3660,3200);
 /* the stairs: down from the hall's south-west corner, up from the jail's east end */
 P('sf_stair_down',700,3990);P('sf_stair_up',2190,JAIL.y1-160);
 /* the jail: ten cells along the north wall, the jailer at his desk */
 for(let i=0;i<8;i++)P('cell_bars',560+i*150,JAIL.y0+150);
 P('gaol_desk',1900,JAIL.y0+330);
 /* the court */
 const SIGVALD=['Silverfjord does not bow. It lends.','Kneel if you like. Most do. It does not buy anything.','The fjord is deeper than any debt, and so is my patience - almost.','My council sits in the east wing. They argue. I decide.'];
 const stands=[
  {name:'King Sigvald Silverfjord',skin:'ruler_sigvald',x:CX,y:HALL.y0+240,fx:1,big:1.45,game:'ruler',say:SIGVALD,extra:{royal:true}},
  ...[[1060,2640],[1940,2640],[1060,3100],[1940,3100],[1060,3560],[1940,3560]].map(([x,y],i)=>({name:'Palace Guard',skin:'silver_guard',x:x+(x<CX?80:-80),y,fx:x<CX?1:-1,big:1.18,extra:{guard:true}})),
  {name:'Royal Guard',skin:'silver_guard',x:CX-190,y:HALL.y0+280,fx:1,big:1.22,extra:{guard:true}},{name:'Royal Guard',skin:'silver_guard',x:CX+190,y:HALL.y0+280,fx:-1,big:1.22,extra:{guard:true}},
  {name:'Lord Commander Brynjar',skin:'silver_guard',x:3160,y:2700,fx:1,big:1.15,extra:{royal:true},say:['The walls hold. The walls always hold.','Two hundred guards, and every one of them polished.','Ravenholt sells swords. We do not need to buy them.']},
  {name:'Mistress of Mines Ragnhild',skin:'noble_dowager',x:2880,y:2760,fx:1,big:1.15,extra:{royal:true},say:['The Deep Vein gave three wagons today.','Silver is patient. Miners are not.','If the mountain speaks, we listen.']},
  {name:'Master of Silver Eirik',skin:'merchant',x:3440,y:2760,fx:-1,big:1.15,extra:{royal:true},say:['The Mint needs more coal, not more opinions.','Every coin in the realm remembers this room.','Emberfall wants our silver cheap. Emberfall will wait.']},
  {name:'High Priest Aldor',skin:'monk',x:2880,y:3080,fx:1,big:1.15,extra:{royal:true},say:['The Deep Water is listening.','A council without a prayer is a market.']},
  {name:'Admiral Sjoberg',skin:'noble_velvet',x:3440,y:3080,fx:-1,big:1.15,extra:{royal:true},say:['The Silver Swan can outrun anything in the north.','The black ship in our harbour? Leave it be.']},
  {name:'Jailer Grimvald',skin:'silver_guard',x:1760,y:JAIL.y0+360,fx:-1,big:1.15,say:['Nine cells, nine regrets.','Nobody has ever left early. Nobody.','Mind the damp. It is older than the palace.']},
  ...[['Smuggler Kjell','pirate',560],['Forger Alrik','merchant',860],['Poacher Tyra','female',1160],['Drunk Bosse','sebbe',1310],['Deserter Ottar','male',1610]].map(([name,skin,x])=>({name,skin,x,y:JAIL.y0+118,fx:1,big:1.05,say:[name.split(' ')[0]==='Smuggler'?'The silver fell into my boat. On its own.':name.startsWith('Forger')?'The coin was real. The King on it was not.':name.startsWith('Poacher')?'It was the King’s deer. It was also very slow.':name.startsWith('Drunk')?'Is it morning? It is always morning in here.':'I did not run. I walked. Quickly.']})),
 ];
 const folk=[['Lady Astrid','noble_lady'],['Lord Eskil','noble_dandy'],['Maiden Solvi','noble_maiden'],['Chamberlain Sten','noble_elder'],['Page Viggo','male'],['Maid Tove','market_woman']].map(([n,s])=>[n,s,[800,2300,2200,4100]]);
 TW.register({id:'sf_palace',name:'Palace of Silverfjord',interior:true,seed:5171,w:W,h:H,
  blurb:'King Sigvald’s throne hall, the council chamber and the cells below.',
  lands,land:lands[0],roads,paths,walls,decals,buildings,props,folk,stands,art,
  arrival:{x:CX,y:3960},
  links:[
   {x:CX,y:HALL.y1+40,r:50,to:'silverfjord',at:{x:9200,y:2210},label:'Silverfjord'},
   {x:700,y:3990,r:52,at:{x:2060,y:JAIL.y0+420},label:'Down to the jail'},
   {x:2190,y:JAIL.y1-200,r:52,at:{x:860,y:3860},label:'Up to the throne hall'},
  ],
  void:'#120e0a',wallTop:'#e3e8ed',wallTops:['#e3e8ed','#4b4a48'],wallT:80,   /* thick enough that the hall's and the council's walls meet over the passage */
  floor:{tile:'towns/sf_plaza',size:300,color:'#e8e4dc'},
  patches:[{pts:[[COUNCIL.x0,COUNCIL.y0],[COUNCIL.x1,COUNCIL.y0],[COUNCIL.x1,COUNCIL.y1],[COUNCIL.x0,COUNCIL.y1]],tile:'towns/sf_parquet',size:260,shade:'rgba(38,32,48,.40)'},   /* the parquet darkened toward walnut: its orange fought the marble and silver */
   {pts:[[JAIL.x0,JAIL.y0],[JAIL.x1,JAIL.y0],[JAIL.x1,JAIL.y1],[JAIL.x0,JAIL.y1]],tile:'towns/rh_flagstone',size:240,shade:'rgba(10,8,6,.35)'}],
  roadStyles:{carpet:{tile:'towns/sf_carpet_runner',runner:true,size:230}},   /* a crimson runner, border to border, from the doors to the throne */
  light:1,
  haze:[[0,'rgba(20,16,12,0)'],[1,'rgba(20,16,12,.12)']],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
