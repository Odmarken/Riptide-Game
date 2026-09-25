/* 🧭 Port Meridian: the great harbour at the centre of the chart, where four oceans trade. A crescent of sandstone and
 * terracotta round a bay full of ships: the Exchange of the Four Oceans looks down on the Grand Bazaar, the waterfront
 * is warehouses, taverns, the Customs House and the Chart House, four piers run out into the bay, the lighthouse stands
 * on the breakwater - and in the west quarter the Free Company keeps its hall and its camp, where Captain Hakon
 * Stormgaard hires out sellswords by the score. */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=6400,H=4500,QY=2850,AXM=3200;
 const HILLW=[[250,1420],[800,1390],[1500,1410],[2000,1400],[2440,1480]],HILLE=[[3960,1480],[4200,1400],[4600,1400],[4900,1410],[5600,1390],[6150,1420]];
 const MKT=[[250,2070],[800,2040],[1500,2060],[2000,2050],[2600,2045],[AXM,2040],[3800,2045],[4600,2050],[5100,2060],[5600,2050],[6150,2070]];
 const WF=[[250,2700],[800,2680],[1330,2680],[1580,2680],[2000,2680],[2850,2680],[AXM,2680],[3980,2680],[4600,2680],[5300,2680],[5640,2680],[6150,2700]];
 const along=(pts,x)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];if(x>=ax&&x<=bx)return Math.round(ay+(by-ay)*(x-ax)/(bx-ax||1));}return pts[x<pts[0][0]?0:pts.length-1][1];};
 const BZ={x:AXM,y:1620,rx:800,ry:270};                           /* the Grand Bazaar */
 const CAMP={x:780,y:2360,rx:520,ry:190};                          /* the Free Company's camp */
 const art={
  pm_exchange:{src:'towns/pm_exchange',noFlip:true,h:560,drop:14,house:true,cry:54,glow:[[.5,.72,150]]},
  pm_merc_hall:{src:'towns/pm_merc_hall',noFlip:true,h:460,drop:14,house:true,glow:[[.37,.62,70],[.63,.62,70]]},
  pm_warehouse:{src:'towns/pm_warehouse',noFlip:true,h:400,drop:14,house:true},
  pm_tavern:{src:'towns/pm_tavern',noFlip:true,h:440,drop:14,house:true,smoke:[[.73,.03,.8]],glow:[[.5,.8,100]]},
  pm_customs:{src:'towns/pm_customs',noFlip:true,h:440,drop:14,house:true},
  pm_charthouse:{src:'towns/pm_charthouse',noFlip:true,h:480,drop:14,house:true},
  pm_bazaar_a:{src:'towns/pm_bazaar_a',h:420,drop:14,house:true,glow:[[.28,.72,80],[.72,.72,80]]},
  pm_bazaar_b:{src:'towns/pm_bazaar_b',h:420,drop:14,house:true,glow:[[.5,.72,90]]},
  pm_house_a:{src:'towns/pm_house_a',h:420,drop:14,house:true},
  pm_house_b:{src:'towns/pm_house_b',h:480,drop:14,house:true},
  pm_house_c:{src:'towns/pm_house_c',h:420,drop:14,house:true},
  pm_lighthouse:{src:'towns/pm_lighthouse',h:600,drop:12,r:60,glow:[[.5,.12,280,[255,230,170]]],fire:[.5,.12,1.2]},
  pm_stall_spice:{src:'towns/pm_stall_spice',h:190,drop:14,r:58},
  pm_stall_rugs:{src:'towns/pm_stall_rugs',h:190,drop:14,r:58},
  pm_stall_fruit:{src:'towns/pm_stall_fruit',h:190,drop:14,r:58},
  pm_stall_lanterns:{src:'towns/pm_stall_lanterns',h:190,drop:14,r:58,glow:[[.5,.4,110,[255,200,120]]]},
  pm_rope_coil:{src:'towns/pm_rope_coil',h:90,drop:8,r:34},
  pm_sacks:{src:'towns/pm_sacks',h:110,drop:8,r:44},
  pm_merc_tent:{src:'towns/pm_merc_tent',h:250,drop:12,r:0,crx:100,cry:40,cyo:-20},
  pm_campfire:{src:'towns/pm_campfire',h:120,drop:8,r:40,glow:[[.45,.55,170]],fire:[.45,.5,1.1]},
  pm_flagpole:{src:'towns/pm_flagpole',h:300,drop:8,r:12,flag:true},
  pm_palm:{src:'towns/pm_palm',h:360,drop:10,r:14,sway:true},
  pm_merchantman:{src:'towns/pm_merchantman',w:900,drop:24,float:{amp:4,rot:.007,speed:.5}},
  pm_dhow:{src:'towns/pm_dhow',w:700,drop:16,float:{amp:5,rot:.012,speed:.8}},
  rh_dummy:{src:'towns/rh_dummy',h:150,drop:8,r:22},
  rh_target:{src:'towns/rh_target',h:150,drop:8,r:28},
  rh_weapon_rack:{src:'towns/rh_weapon_rack',h:150,drop:8,r:0,crx:70,cry:18,cyo:-8},
 };
 const land=[
  [0,560,'edge'],[W,560,'edge'],[W,H,'edge'],[6120,H,'sand'],[5980,3900,'sand'],[5870,3300,'sand'],[5800,QY,'quay'],
  [600,QY,'sand'],[520,3300,'sand'],[420,3900,'sand'],[300,H,'edge'],[0,H,'edge'],
 ];
 const roads=[
  {kind:'street',w:160,pts:HILLW},{kind:'street',w:160,pts:HILLE},{kind:'street',w:170,pts:MKT},
  {kind:'avenue',w:200,pts:[[AXM,BZ.y+BZ.ry-20],[AXM,2040],[AXM,2680]]},
  {kind:'lane',w:120,pts:[[800,1390],[760,1720],[800,2040]]},
  {kind:'lane',w:120,pts:[[2000,1400],[1940,1720],[2000,2050],[2080,2360],[2000,2680]]},
  {kind:'lane',w:120,pts:[[4600,1400],[4660,1720],[4600,2050],[4520,2360],[4600,2680]]},
  {kind:'lane',w:120,pts:[[5600,1390],[5660,1720],[5600,2050],[5640,2360],[5640,2680]]},
  {kind:'quay',w:300,pts:WF},
 ];
 const ring=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+i/16*Math.PI*2;ring.push([Math.round(AXM+Math.cos(a)*560),Math.round(BZ.y+Math.sin(a)*180)]);}
 const paths=[
  {pts:[[2440,1480],ring[12]]},{pts:[[3960,1480],ring[4]]},{pts:ring},{pts:[ring[8],[AXM,BZ.y+BZ.ry-20]]},{pts:[[AXM,1320],ring[0]]},
  {pts:[[800,2040],[800,2300],[1300,2400],[1330,2680]]},{pts:[[800,2300],[400,2400],[800,2680]]},
  {pts:[[1580,2680],[1580,3200],[1580,3680],[1860,3680]]},{pts:[[2850,2680],[2850,3850]]},{pts:[[3980,2680],[3980,3750],[4200,3750]]},{pts:[[5300,2680],[5300,4000]]},
 ];
 const piers=[
  {kind:'timber',x:1500,y:QY-10,w:160,h:780,open:'ns',old:true},       /* Blackbeard's */
  {kind:'timber',x:1260,y:3600,w:800,h:160,open:'n',old:true},
  {kind:'stone',x:2750,y:QY-10,w:200,h:1060,open:'n',tile:'towns/pm_paving'},
  {kind:'timber',x:3900,y:QY-10,w:160,h:880,open:'ns'},
  {kind:'timber',x:3700,y:3700,w:560,h:140,open:'n'},
  {kind:'stone',x:5200,y:QY-10,w:200,h:1110,open:'ns',tile:'towns/pm_paving'},
  {r:230,x:5300,y:4140,tile:'towns/pm_paving'},
 ];
 const buildings=[],props=[];
 const B=(k,x,y,o)=>buildings.push([k,x,Math.round(y),o]),P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 const flip={flip:true};
 const row=(pts,list)=>{for(const [k,x,dy,o] of list)B(k,x,along(pts,x)-90+(dy||0),o);};
 /* the Exchange above the bazaar, houses along the hill street either side */
 B('pm_exchange',AXM,1270);
 row(HILLW,[['pm_tavern',450,-4],['pm_bazaar_b',1230,6],['pm_charthouse',1720,-8],['pm_house_a',2250,4,flip],['pm_house_b',2560,-6]]);
 row(HILLE,[['pm_house_a',3880,-4],['pm_house_b',4200,6,flip],['pm_bazaar_a',5060,4,flip],['pm_house_a',5840,-6,flip]]);
 /* Market Street: the Free Company's hall at the west end, bazaar houses east of the square */
 B('pm_house_a',450,along(MKT,450)-90,flip);B('pm_merc_hall',1300,along(MKT,1300)-94);B('pm_house_b',2240,along(MKT,2240)-92);
 row(MKT,[['pm_bazaar_b',4260,-6,flip],['pm_house_c',4970,6],['pm_house_b',5400,-4,flip],['pm_house_a',5930,6]]);
 /* the waterfront: warehouses, the Customs House, a tavern, the Chart House's rival */
 row(WF,[['pm_warehouse',1670,-6],['pm_customs',2430,-8],['pm_tavern',2880,4],['pm_warehouse',3620,-6],['pm_house_b',4260,4],
  ['pm_warehouse',5050,-4],['pm_house_a',5900,-6,flip]]);
 for(const [x,pts] of [[4015,WF],[5460,WF],[5460,HILLE],[2700,MKT],[3700,MKT]])P('pm_palm',x,along(pts,x)-60);
 /* the hills behind: palms, olive-dark cypress, a flag or two */
 for(let x=120,i=0;x<W-60;x+=170+((i*43)%80),i++){if(Math.abs(x-AXM)<560)continue;P(i%3?'pm_palm':'linden',x,690+((i*61)%150));}
 for(const [x,y] of [[140,1700],[160,2300],[6260,1700],[6240,2300],[2600,1180],[3800,1180],[2550,1350],[3850,1350]])P('pm_palm',x,y);
 /* the Grand Bazaar */
 P('fountain',AXM,BZ.y+30);
 const stalls=['pm_stall_spice','pm_stall_rugs','pm_stall_fruit','pm_stall_lanterns','stall_cloth','pm_stall_spice','pm_stall_fruit','stall_bread'];
 /* round the rim, clear of the four ways in: the Exchange's door above, the avenue below, the hill street either side */
 const rim=[.08,.24,.37,.63,.76,.92,1.25,1.75];
 stalls.forEach((k,i)=>{const a=Math.PI*rim[i],x=AXM+Math.cos(a)*700,y=BZ.y+Math.sin(a)*232;P(k,Math.round(x),Math.round(y)+10,x>AXM?flip:undefined);});
 P('tent_red',AXM-300,BZ.y-10);P('tent_blue',AXM+300,BZ.y-10);
 for(const dx of [-760,760])P('pm_flagpole',AXM+dx,BZ.y-60);
 for(const dx of [-230,230])P('pm_palm',AXM+dx,BZ.y-190);
 for(const dx of [-560,560])P('lamp',AXM+dx,BZ.y+180);
 /* the Free Company's camp between the hall and the water */
 for(const [x,y] of [[420,2270],[660,2230],[1140,2270]])P('pm_merc_tent',x,y,x>800?flip:undefined);
 P('pm_campfire',CAMP.x,CAMP.y+60);P('rh_dummy',1080,2470);P('rh_dummy',1190,2500);P('rh_target',1420,2440);
 P('rh_weapon_rack',300,2300);P('rh_weapon_rack',1000,2530,flip);P('crates',340,2560);P('barrels',1230,2560);P('pm_flagpole',900,2200);
 /* the streets: palms and lamps, sacks and jars at the shop doors */
 for(const [pts,xs] of [[HILLW,[600,1500]],[HILLE,[4450,5300]],[MKT,[600,1900,2700,3700,4450,5450]]])xs.forEach((x,i)=>P(i%2?'lamp':'pm_palm',x,along(pts,x)+(i%2?84:-84)));
 for(const [x,y,k] of [[2520,2140,'pm_sacks'],[3880,2140,'pm_sacks'],[4880,2130,'flower_tub'],[5480,2130,'pm_sacks'],[1560,1480,'flower_tub'],[4750,1480,'flower_tub']])P(k,x,y);
 /* the waterfront: cranes, cargo, rope and the cannon on the breakwater */
 for(let x=700;x<=5700;x+=250){if(Math.abs(x-1580)<130||Math.abs(x-2850)<150||Math.abs(x-3980)<130||Math.abs(x-5300)<150)continue;P('bollard',x,QY-26);}
 P('crane',2150,2800);P('crane',4450,2800,flip);
 for(const [x,k] of [[900,'pm_sacks'],[1100,'crates'],[2300,'pm_rope_coil'],[2560,'barrels'],[3350,'pm_sacks'],[3560,'crates'],[4250,'pm_rope_coil'],[4800,'barrels'],[5000,'pm_sacks'],[5500,'crates'],[5760,'pm_rope_coil']])P(k,x,2790+((x/10)%3)*10);
 P('stall_fish',1950,2590);P('pm_stall_fruit',4750,2600,flip);P('handcart',3400,2590);P('wagon_barrels',5500,2600,flip);
 for(const x of [1300,2650,3800,4900,5700])P('lamp',x,2585);
 P('cannon',5230,4230);P('cannon',5370,4230,flip);P('anchor',5400,3100);P('pm_flagpole',2850,3860);P('pm_flagpole',4200,3780);
 P('barrels',1320,3700);P('crates',1920,3710);P('loot',1780,3640);P('lamp',1700,3640);
 P('buoy',3450,4150);P('buoy',4700,3950);P('rocks',720,3460);P('rocks',5760,3900,flip);
 B('pm_lighthouse',5300,4170);
 const ships=[
  ['galleon',2180,3560,{seed:1.3,name:'The Black Tide'}],
  ['pm_merchantman',3430,3620,{seed:2.6,name:'The Four Winds'}],
  ['pm_dhow',4630,3480,{seed:3.1,name:'Saffron Star'}],
  ['carrack',3300,4300,{seed:4.1,flip:true}],['pm_dhow',900,4200,{seed:5.2}],['sloop',4700,4380,{seed:2.2,flip:true}],
  ['rowboat',2500,3250,{seed:.6}],['rowboat',4250,3300,{seed:.9,flip:true}],
 ];
 const UP=[300,1350,6100,2150],QUAY=[700,2560,5700,2800],CAMPR=[300,2200,1400,2600];
 const folk=[
  ['Sellsword Aldo','mercenary',CAMPR],['Sellsword Bram','mercenary_b',CAMPR],['Sellsword Corin','mercenary',CAMPR],['Sellsword Dario','mercenary_b',UP],
  ['Spice trader Emir','spice_merchant',UP],['Spice trader Farid','spice_merchant',UP],['Merchant Gaspard','merchant',UP],['Merchant Hollis','merchant',UP],
  ['Lady Ilse','noble_lady',UP],['Lord Jasper','noble_dandy',UP],['Market wife Kasia','market_woman',UP],['Baker Lena','baker',UP],['Brother Matteo','monk',UP],
  ['Guard Nuno','guard',UP],['Guard Otto','guard',QUAY],['Mira','female',UP],['Pieter','male',UP],
  ['Sailor Quint','sailor',QUAY],['Sailor Rafe','sailor',QUAY],['Sailor Silas','sailor',QUAY],['Pirate Teague','pirate',QUAY],['Dockhand Ugo','dockhand',QUAY],
  ['Dockhand Vasco','dockhand',QUAY],['Dockhand Wim','dockhand',QUAY],['Fishwife Xenia','fishwife',QUAY],['Merchant Yusuf','spice_merchant',QUAY],
  ['Sailor Zeb','sailor',QUAY],['Dockhand Abel','dockhand',QUAY],['Pirate Bonny','pirate',QUAY],['Merchant Cyrus','merchant',UP],['Lady Dalia','noble_maiden',UP],
  ['Spice trader Ezra','spice_merchant',UP],['Guard Fabio','guard',QUAY],['Sellsword Gunnar','mercenary',UP],['Market wife Hana','market_woman',UP],
 ];
 const ISAURA=['Everything has a price. I keep the ledger that says what it is.','Four oceans, one Exchange, one tariff. Mine.','The Free Company hires out swords at the west end. Their price is fair. I checked.','Your treasury pays. Your treasury always pays.'];
 const HAKON=['Twenty blades a contract, five million from your treasury, a hundred at the most.','We fight for whoever pays - and we stay paid.','My lads walk your walls and your squares. Nobody climbs them after.'];
 const stands=[
  {name:'Trade Officer Isaura Venn',skin:'ruler_isaura',x:AXM,y:1335,fx:1,big:1.32,game:'ruler',say:ISAURA,extra:{royal:true}},
  {name:'Captain Hakon Stormgaard',skin:'merc_recruiter',x:1300,y:along(MKT,1300)-40,fx:1,big:1.3,game:'recruiter',say:HAKON},
  {name:'Free Company Sentry',skin:'mercenary',x:1040,y:along(MKT,1040)-40,fx:1,big:1.2,extra:{guard:true}},
  {name:'Free Company Sentry',skin:'mercenary_b',x:1560,y:along(MKT,1560)-40,fx:-1,big:1.2,extra:{guard:true}},
  {name:'Harbour Clerk Nel',skin:'harbour_master',x:2600,y:2600,fx:1,say:['Customs is that way. Everything is taxed. Even the gulls.','Four oceans meet here, and every one of them owes something.','Mind the cranes.']},
  {name:'Spice trader Omar',skin:'spice_merchant',x:AXM-640,y:BZ.y+90,fx:1,say:['Pepper from the east, saffron from the south!','A pinch for luck, a sack for business.','The finest cinnamon on four oceans. Smell it.']},
 ];
 TW.register({id:'meridian',icon:'🧭',name:'Port Meridian',seed:4411,w:W,h:H,
  blurb:'The great harbour at the centre of the chart, where four oceans trade - and where the Free Company hires out swords.',
  land,roads,paths,piers,buildings,props,ships,folk,stands,art,
  shoreY:QY,
  arrival:{x:1580,y:3700},
  blackbeard:{x:1450,y:3670,fx:1},
  sea:{color:'#11607a',shade:'rgba(20,120,140,.14)'},
  floor:{tile:'towns/pm_sand',size:300,color:'#d6b98a'},
  map:{roof:'#b3643f',road:'#efe6d2',plaza:'#f2ead8',tree:'#4d7a3a',wall:'#e8dcc0'},   /* the minimap's colours */
  roadStyles:{
   street:{tile:'towns/pm_paving',size:260,kerb:10,kerbColor:'#e7cf9f',order:1},
   lane:{tile:'towns/pm_paving',size:220,kerb:8,kerbColor:'#e7cf9f',order:0},
   avenue:{tile:'towns/pm_paving',size:300,kerb:12,kerbColor:'#f0dcae',order:2},
   quay:{tile:'towns/pm_paving',size:320,order:3},
  },
  plazas:[{...BZ,kind:'square'},{x:AXM,y:1360,rx:520,ry:110,kind:'court'}],
  plazaStyles:{square:{tile:'towns/pm_paving',size:320,rim:'#f0dcae',ring:'rgba(20,130,140,.45)'},court:{tile:'towns/pm_paving',size:260,rim:'#f0dcae'}},
  patches:[{...CAMP,tile:'towns/pm_sand',size:220,shade:'rgba(120,70,30,.20)',rim:'#b88a55'}],
  quayKerb:'#e2c794',quayFace:'#8a6a44',pierTile:'towns/pm_paving',
  backdrop:{key:'towns/pm_hills',y:0,h:660,sky:[[0,'#5fa8d8'],[.7,'#bfe0f0'],[1,'#f3e7c8']]},
  light:.35,
  birds:[{path:[[1600,3200,800,260,.15,0],[4200,2400,900,300,-.12,2],[3000,3900,700,240,.2,4],[5400,3300,500,200,-.17,1]]}],
  haze:[[0,'rgba(255,230,180,.08)'],[1,'rgba(255,230,180,0)']],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
