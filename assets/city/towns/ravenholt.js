/* 🦅 Ravenholt: a grey fortress town in the northern passes. It sells iron, sellswords and its own loyalty, in that order.
 * The Iron Margrave's keep sits in the Upper Ward with the barracks, the armory, the chapel and a training yard where the
 * dummies never get a day off; a curtain wall with a gatehouse shuts the ward off from the Lower Town, which is all dark
 * granite houses crammed along crooked lanes down to the Raven Square - the monument, the well, the Sellsword Hall - and
 * on down to a cold grey quay where the longships lie. Snow, always. */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=4800,H=5200,GX=2400,WALL=2210,QY=4380,R4=4120;          /* GX: the gate; WALL: the curtain wall's foot; QY: the quay edge */
 const L1=[[250,2480],[700,2450],[1200,2490],[1700,2460],[2100,2480],[2440,2470],[2800,2460],[3300,2490],[3800,2455],[4300,2480],[4550,2470]];
 const L3=[[250,3600],[800,3580],[1300,3610],[1800,3570],[2420,3590],[2900,3600],[3500,3570],[3800,3585],[4200,3600],[4550,3590]];
 /* where a lane runs at x: the houses along it stand 90 north of that */
 const along=(pts,x)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];if(x>=ax&&x<=bx)return Math.round(ay+(by-ay)*(x-ax)/(bx-ax||1));}return pts[x<pts[0][0]?0:pts.length-1][1];};
 const SQ={x:2300,y:3030,rx:520,ry:210};                          /* the Raven Square */
 const art={
  rh_keep:{src:'towns/rh_keep',h:620,drop:14,house:true,cry:54,glow:[[.36,.82,90],[.64,.82,90]]},
  rh_gatehouse:{src:'towns/rh_gatehouse',h:460,drop:14,r:0,glow:[[.31,.63,80],[.69,.63,80]]},
  rh_tower:{src:'towns/rh_tower',h:540,drop:12,r:0,crx:88,cry:34,cyo:-26},
  rh_wall:{src:'towns/rh_wall',h:300,drop:6},
  rh_barracks:{src:'towns/rh_barracks',h:420,drop:14,house:true,smoke:[[.93,.04,1]]},
  rh_armory:{src:'towns/rh_armory',h:430,drop:14,house:true,smoke:[[.83,.04,1.1]],glow:[[.5,.72,120]]},
  rh_chapel:{src:'towns/rh_chapel',h:500,drop:14,house:true,glow:[[.5,.36,90]]},
  rh_hall:{src:'towns/rh_hall',noFlip:true,h:460,drop:14,house:true,glow:[[.33,.78,60],[.67,.78,60]]},
  rh_inn:{src:'towns/rh_inn',noFlip:true,h:440,drop:14,house:true,smoke:[[.8,.04,1]]},
  rh_house_a:{src:'towns/rh_house_a',h:400,drop:14,house:true,smoke:[[.75,.06,.9]]},
  rh_house_b:{src:'towns/rh_house_b',h:440,drop:14,house:true,smoke:[[.64,.06,.8]]},
  rh_house_c:{src:'towns/rh_house_c',h:380,drop:14,house:true,smoke:[[.7,.06,.9]]},
  rh_house_d:{src:'towns/rh_house_d',h:430,drop:14,house:true,smoke:[[.7,.05,.8]]},
  rh_banner:{src:'towns/rh_banner',h:280,drop:8,r:12,flag:true},
  rh_brazier:{src:'towns/rh_brazier',h:120,drop:8,r:30,glow:[[.5,.3,150]],fire:[.5,.3,1.2]},
  rh_dummy:{src:'towns/rh_dummy',h:150,drop:8,r:22},
  rh_target:{src:'towns/rh_target',h:150,drop:8,r:28},
  rh_catapult:{src:'towns/rh_catapult',h:190,drop:10,r:0,crx:110,cry:34,cyo:-18},
  rh_weapon_rack:{src:'towns/rh_weapon_rack',h:150,drop:8,r:0,crx:70,cry:18,cyo:-8},
  rh_well:{src:'towns/rh_well',h:170,drop:10,r:52},
  rh_raven_statue:{src:'towns/rh_raven_statue',h:330,drop:10,r:44},
  rh_stall_furs:{src:'towns/rh_stall_furs',h:180,drop:14,r:58},
  rh_stall_iron:{src:'towns/rh_stall_iron',h:180,drop:14,r:58},
  rh_pine:{src:'towns/rh_pine',h:380,drop:10,r:16,sway:true},
  rh_longship:{src:'towns/rh_longship',w:1100,drop:18,float:{amp:5,rot:.01,speed:.7}},
 };
 /* ---------- the ground ---------- */
 const land=[
  [0,720,'edge'],[W,720,'edge'],[W,H,'edge'],[4480,H,'rock'],[4360,4900,'rock'],[4260,4600,'rock'],[4200,QY,'quay'],
  [620,QY,'rock'],[540,4640,'rock'],[420,4920,'rock'],[330,H,'edge'],[0,H,'edge'],
 ];
 const roads=[
  /* the Upper Ward: the gate road climbs to the keep, with a branch to the training yard and one to the barracks */
  {kind:'street',w:170,pts:[[GX,1640],[2440,1830],[2360,2010],[GX,2170],[GX,2300],[2440,2470]]},
  {kind:'lane',w:130,pts:[[2360,2010],[1900,1980],[1500,1900],[1100,1960]]},
  {kind:'lane',w:130,pts:[[2440,1830],[2900,1790],[3330,1700],[3900,1640]]},
  {kind:'lane',w:110,pts:[[1500,1900],[1500,1650]]},
  /* the Lower Town */
  {kind:'lane',w:130,pts:L1},
  {kind:'street',w:170,pts:[[2440,2470],[2380,2650],[SQ.x,SQ.y-SQ.ry+10]]},
  {kind:'street',w:170,pts:[[SQ.x,SQ.y+SQ.ry-10],[2350,3420],[2420,3590],[2380,3900],[GX,4230]]},
  {kind:'lane',w:130,pts:[[250,3050],[700,3020],[1200,3060],[SQ.x-SQ.rx+20,SQ.y]]},
  {kind:'lane',w:130,pts:[[SQ.x+SQ.rx-20,SQ.y],[3300,3060],[3800,3020],[4300,3050],[4550,3040]]},
  {kind:'lane',w:130,pts:L3},
  {kind:'lane',w:110,pts:[[700,2450],[640,2750],[700,3020],[760,3300],[800,3580],[760,3900],[800,4230]]},
  {kind:'lane',w:110,pts:[[3800,2455],[3860,2740],[3800,3020],[3860,3300],[3800,3585],[3760,3900],[3800,4230]]},
  {kind:'quay',w:280,pts:[[420,4240],[800,4230],[1140,4230],[GX,4230],[3690,4230],[3800,4230],[4400,4240]]},
 ];
 const ring=[];for(let i=0;i<=12;i++){const a=-Math.PI/2+i/12*Math.PI*2;ring.push([Math.round(SQ.x+Math.cos(a)*300),Math.round(SQ.y+Math.sin(a)*140)]);}
 const paths=[
  {pts:[[SQ.x,SQ.y-SQ.ry+10],ring[0]]},{pts:ring.slice(0,7)},{pts:ring.slice(6)},{pts:[ring[6],[SQ.x,SQ.y+SQ.ry-10]]},
  {pts:[[SQ.x-SQ.rx+20,SQ.y],ring[9]]},{pts:[[SQ.x+SQ.rx-20,SQ.y],ring[3]]},
  {pts:[[1100,1960],[1300,1880],[1700,1860]]},{pts:[[3330,1700],[3350,1880]]},
  {pts:[[1140,4230],[1140,4700],[1140,5060],[1420,5060]]},{pts:[[3690,4230],[3690,4880]]},
 ];
 const piers=[
  {kind:'timber',x:1060,y:QY-10,w:160,h:640,open:'ns',old:true},       /* Blackbeard's */
  {kind:'timber',x:820,y:4980,w:800,h:160,open:'n',old:true},
  {kind:'stone',x:3600,y:QY-10,w:180,h:520,open:'ns',tile:'towns/rh_flagstone'},
  {r:170,x:3690,y:5040,tile:'towns/rh_flagstone'},
 ];
 /* ---------- the curtain wall: two runs either side of the gatehouse, towers along it ---------- */
 const GW=609;                                                      /* the gatehouse's drawn width */
 const walls=[{kind:'rh_wall',x0:0,x1:GX-GW/2+40,y:WALL},{kind:'rh_wall',x0:GX+GW/2-40,x1:W,y:WALL}];
 const blocks=[{x:GX-GW/2,y:WALL-50,w:GW*.33,h:58},{x:GX+GW/2-GW*.33,y:WALL-50,w:GW*.33,h:58}];   /* the gatehouse's towers; the arch between them is open */
 /* ---------- what stands where ---------- */
 const buildings=[],props=[];
 const B=(k,x,y,o)=>buildings.push([k,x,Math.round(y),o]),P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 const flip={flip:true};
 /* the Upper Ward */
 B('rh_keep',GX,1390);
 B('rh_armory',1500,1570);B('rh_barracks',3330,1570,flip);B('rh_chapel',3960,1510);
 B('rh_house_b',640,1520);B('rh_house_a',930,1560,flip);B('rh_house_d',4330,1540);
 B('rh_tower',300,1480);B('rh_tower',4560,1500);
 /* the wall's towers stand a little in front of it; the gatehouse closes the gap */
 for(const x of [900,1600,3200,3900])B('rh_tower',x,WALL+14);
 buildings.push(['rh_gatehouse',GX,WALL+16,{noCol:true}]);
 /* the Lower Town: houses along each lane, the hall and the inn on the square */
 const row=(pts,list)=>{for(const [k,x,dy,o] of list)B(k,x,along(pts,x)-90+(dy||0),o);};
 row(L1,[['rh_house_b',390,-4],['rh_house_a',930,6,flip],['rh_house_c',1345,-8],['rh_house_b',1760,4,flip],['rh_house_a',2120,-6],
  ['rh_house_d',2700,6],['rh_house_b',3060,-4,flip],['rh_house_a',3400,8],['rh_house_c',4130,-6,flip],['rh_house_b',4520,4]]);
 const L2W=[[250,3050],[700,3020],[1200,3060],[1780,3030]],L2E=[[2820,3030],[3300,3060],[3800,3020],[4300,3050],[4550,3040]];
 row(L2W,[['rh_house_a',400,-6],['rh_house_d',1010,4,flip],['rh_house_b',1340,-4]]);
 B('rh_hall',1900,2860);B('rh_inn',2780,2850,flip);
 row(L2E,[['rh_house_b',3250,4],['rh_house_a',3560,-6,flip],['rh_house_c',4130,6],['rh_house_b',4480,-4,flip]]);
 row(L3,[['rh_house_a',420,-4],['rh_house_b',960,6,flip],['rh_house_a',1260,-6],['rh_house_d',1600,4],['rh_house_b',1950,-4,flip],
  ['rh_house_c',2800,6,flip],['rh_house_b',3180,-6],['rh_house_a',3500,4,flip],['rh_house_d',4100,-4],['rh_house_b',4450,6]]);
 /* the harbour front: the Harbour's own sheds and a fishing house, weathered the same */
 B('h_fishhouse',400,R4);B('h_warehouse',1180,R4,flip);B('rh_house_c',1700,R4-4);B('h_chandlery',2150,R4);
 B('h_tavern',2700,R4);B('h_warehouse',3150,R4);B('rh_house_a',3550,R4-6,flip);B('h_fishhouse',4150,R4,flip);B('rh_house_b',4500,R4-4);
 /* the forecourt of the keep: braziers, banners, the Margrave's men */
 P('rh_brazier',2140,1450);P('rh_brazier',2660,1450);P('rh_banner',2040,1540);P('rh_banner',2760,1540);
 P('rh_banner',2290,1900);P('rh_banner',2510,1760);P('rh_banner',2300,2120);P('rh_banner',2500,2120);
 /* the training yard */
 for(const [x,y] of [[980,1860],[1160,1900],[1340,1860]])P('rh_dummy',x,y);
 P('rh_target',1620,1790);P('rh_target',1760,1830);P('rh_weapon_rack',860,1760);P('rh_weapon_rack',1080,2060,flip);
 P('rh_catapult',1860,2080);P('rh_brazier',1460,2050);P('rh_banner',760,1990);
 /* the barracks yard */
 P('rh_weapon_rack',3140,1840);P('rh_weapon_rack',3560,1840,flip);P('rh_brazier',3350,1990);P('crates',3700,1800);P('barrels',3790,1860);P('rh_banner',3060,2000);
 P('woodpile',4150,1640);P('rh_well',4000,1900);
 /* the woods on the pass behind, and down both sides */
 for(let x=90,i=0;x<W-40;x+=140+((i*41)%60),i++){P('rh_pine',x,820+((i*47)%110));if(i%3===0)P('rh_pine',x+60,990+((i*31)%70));}
 for(const [x,y] of [[120,1900],[140,2600],[110,3200],[150,3800],[4680,1900],[4700,2640],[4660,3240],[4690,3860],[240,4460],[4560,4480],[140,4900],[4650,4960]])P('rh_pine',x,y);
 P('rocks',720,4820);P('rocks',4140,4950,flip);P('rocks',600,5120);   /* out in the water, clear of the bank */
 /* the Raven Square */
 P('rh_raven_statue',SQ.x,SQ.y+10);P('rh_well',SQ.x+250,SQ.y+140);
 P('rh_brazier',SQ.x-340,SQ.y-120);P('rh_brazier',SQ.x+340,SQ.y-120);
 P('rh_stall_furs',SQ.x-360,SQ.y+120);P('rh_stall_iron',SQ.x+400,SQ.y+60,flip);P('stall_bread',SQ.x-150,SQ.y+180);P('stall_fish',SQ.x+120,SQ.y+195,flip);
 P('rh_banner',SQ.x-480,SQ.y-90);P('rh_banner',SQ.x+480,SQ.y-90);
 /* the lanes: braziers at the crossings, a woodpile or a trough by the doors */
 for(const [x,y] of [[760,2560],[3860,2600],[700,3140],[3860,3150],[820,3700],[3820,3700]])P('rh_brazier',x+70,y);
 for(const [x,y,k] of [[2270,2560,'woodpile'],[1560,3120,'trough'],[3000,3120,'woodpile'],[2150,3680,'woodpile'],[3000,3680,'trough'],[1560,2560,'handcart']])P(k,x,y);
 /* the quay: cargo, nets and fish, cannon on the mole, the longship's gear */
 for(let x=700;x<=4100;x+=240){if(Math.abs(x-1140)<130||Math.abs(x-GX)<120||Math.abs(x-3690)<150)continue;P('bollard',x,QY-26);}
 P('crates',930,4150);P('barrels',1420,4160);P('fishrack',1960,4150);P('pots',2140,4170);P('upturned',2900,4160);P('anchor',3300,4140);P('crates',4000,4150,flip);P('barrels',4330,4160);
 P('rh_brazier',1300,4330);P('rh_brazier',2600,4330);P('rh_brazier',3500,4330);P('lamp',1000,4330);P('lamp',4100,4330);
 P('cannon',3620,4960);P('cannon',3760,4960,flip);B('rh_tower',3690,5080);
 P('barrels',880,5105);P('crates',1520,5110);P('loot',1480,5118);P('lamp',1240,5020);
 P('buoy',2150,4600);P('buoy',3300,4800);
 const ships=[
  ['galleon',1720,4960,{seed:1.3,name:'The Black Tide'}],
  ['rh_longship',2750,4700,{seed:2.7,name:'The Red Wing'}],
  ['rh_longship',3050,5100,{seed:4.4,flip:true}],
  ['rowboat',2250,4480,{seed:5.5}],['rowboat',3950,4620,{seed:0.9,flip:true}],
 ];
 /* ---------- the people ---------- */
 const WARD=[800,1500,4200,2150],TOWN=[250,2400,4550,3700],HARB=[450,4150,4300,4300];
 const folk=[
  ['Raven soldier Arn','raven_soldier',WARD],['Raven soldier Brand','raven_soldier',WARD],['Raven soldier Dag','raven_soldier',WARD],['Raven soldier Eyvind','raven_soldier',TOWN],
  ['Raven soldier Frode','raven_soldier',TOWN],['Raven soldier Geir','raven_soldier',TOWN],['Smith Hallvard','blacksmith',WARD],['Brother Isak','monk',WARD],
  ['Jora','female',TOWN],['Kolbein','male',TOWN],['Market wife Liv','market_woman',TOWN],['Merchant Magnus','merchant',TOWN],['Njal','sebbe',TOWN],
  ['Baker Oda','baker',TOWN],['Smith Petter','blacksmith',TOWN],['Guard Rolf','guard',TOWN],
  ['Sailor Snorri','sailor',HARB],['Dockhand Thrand','dockhand',HARB],['Dockhand Ulfar','dockhand',HARB],['Fishwife Vigdis','fishwife',HARB],['Pirate Yngve','pirate',HARB],
 ];
 const RODERIC=['Ravenholt has never been taken. It has been rented.','Iron, sellswords, loyalty. In that order - and loyalty costs extra.','My men train in the snow. Yours train in the rain. Mine win.','If you want soldiers, the Free Company sells them in Port Meridian. Mine are not for sale. Today.'];
 const stands=[
  {name:'King Roderic Varn',skin:'ruler_roderic',x:GX,y:1470,fx:1,big:1.34,game:'ruler',say:RODERIC,extra:{royal:true}},
  {name:'Raven Guard',skin:'raven_soldier',x:GX-190,y:1460,fx:1,big:1.22,extra:{guard:true}},
  {name:'Raven Guard',skin:'raven_soldier',x:GX+190,y:1460,fx:-1,big:1.22,extra:{guard:true}},
  {name:'Gate Warden',skin:'raven_soldier',x:GX-160,y:2290,fx:1,big:1.2,extra:{guard:true},say:['The gate shuts at dusk. Mostly.','Business in the Upper Ward? Then walk straight and do not touch the catapult.','The Margrave is in. He is always in.']},
  {name:'Sellsword Bjorn',skin:'blacksmith',x:1780,y:2900,fx:1,say:['The Hall hires out swords by the season.','You want an army? Port Meridian. The Free Company sells them by the score.','Twenty good blades for five million - that is the Meridian price. Robbery. Worth it.']},
  {name:'Drillmaster Hrafn',skin:'raven_soldier',x:1250,y:1990,fx:-1,extra:{guard:true},say:['Again! And this time hit the dummy, not the air.','A shield is a wall you carry.','Snow? Snow is just softer ground to fall on.']},
 ];
 TW.register({id:'ravenholt',icon:'🦅',name:'Ravenholt',seed:2207,w:W,h:H,
  blurb:'The fortress in the northern passes: iron, sellswords and snow.',
  land,roads,paths,piers,walls,blocks,buildings,props,ships,folk,stands,art,
  shoreY:QY,
  arrival:{x:1140,y:5080},
  blackbeard:{x:1010,y:5050,fx:1},
  sea:{color:'#1f4452',shade:'rgba(40,60,70,.30)',glint:'#dfeaf0'},
  floor:{tile:'towns/rh_snow',size:360,color:'#b9bec2',shade:'rgba(236,240,244,.30)'},
  map:{ground:'#c9cfd3',roof:'#4a4e57',road:'#8f8b86',plaza:'#9a958f',tree:'#2f4a36',wall:'#6f6a64'},   /* the minimap's colours */
  roadStyles:{
   street:{tile:'towns/rh_flagstone',size:260,kerb:10,kerbColor:'#8d939a',order:2},
   lane:{tile:'towns/rh_flagstone',size:220,kerb:8,kerbColor:'#8d939a',order:1},
   quay:{tile:'towns/rh_flagstone',size:300,order:3},
  },
  plazas:[{x:GX,y:1520,rx:520,ry:140,kind:'court'},{...SQ,kind:'square'}],
  plazaStyles:{square:{tile:'towns/rh_flagstone',size:300,rim:'#9aa0a6',ring:'rgba(120,20,20,.35)'},court:{tile:'towns/rh_flagstone',size:260,rim:'#9aa0a6'}},
  patches:[{x:1300,y:1900,rx:600,ry:200,tile:'towns/rh_flagstone',size:240,shade:'rgba(60,50,40,.25)',rim:'#8d939a'},{x:3350,y:1880,rx:430,ry:150,tile:'towns/rh_flagstone',size:240,shade:'rgba(60,50,40,.25)',rim:'#8d939a'}],
  quayKerb:'#9ea4aa',quayFace:'#3f4247',pierTile:'towns/rh_flagstone',
  backdrop:{key:'towns/rh_mountains',y:0,h:800,sky:[[0,'#8e9aa6'],[.7,'#c3cbd2'],[1,'#dde2e6']]},
  weather:'snow',light:.7,
  birds:[{path:[[1200,2600,700,240,.13,0],[3400,3400,800,300,-.1,2]],src:'harbor/seagull',size:54}],
  haze:[[0,'rgba(200,210,220,.14)'],[1,'rgba(200,210,220,.04)']],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
