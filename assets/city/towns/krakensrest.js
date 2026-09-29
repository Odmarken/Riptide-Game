/* 🐙 Kraken's Rest: a free port built on the wrecks of the fleets that tried to take it (2026-09-29). Its houses are hulls
 * turned keel-up and bows stood on end, its streets are boardwalks; the Drowned Council sits in the stern castle of a beached
 * galleon above Kraken Square, where the bones of the beast that gave the port its name lie in state. Every cargo between the
 * southern seas and the realm pays its toll here, and Trade Officer Corvin Saltmarsh counts it. Pictures: towns/kr_*,
 * Higgsfield gpt_image_2 on flat magenta, the Meridian pictures as style references (towns-art-manifest.json). */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=5600,H=4200,QY=2800,AXM=2800;
 const UPW=[[250,1420],[800,1400],[1500,1420],[2150,1440]],UPE=[[3450,1440],[4100,1420],[4800,1400],[5350,1420]];
 const MID=[[250,2080],[900,2060],[1600,2070],[2200,2060],[AXM,2060],[3400,2060],[4000,2070],[4700,2060],[5350,2080]];
 const WF=[[250,2720],[900,2700],[1380,2700],[2000,2700],[AXM,2700],[3080,2700],[3600,2700],[4380,2700],[5350,2720]];
 const along=(pts,x)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];if(x>=ax&&x<=bx)return Math.round(ay+(by-ay)*(x-ax)/(bx-ax||1));}return pts[x<pts[0][0]?0:pts.length-1][1];};
 const SQ={x:AXM,y:1660,rx:720,ry:250};                            /* Kraken Square, round the bones */
 const art={
  kr_council:{src:'towns/kr_council',noFlip:true,h:620,drop:14,house:true,cry:54,glow:[[.18,.1,90,[120,230,200]],[.82,.1,90,[120,230,200]],[.5,.45,150]]},
  kr_tavern:{src:'towns/kr_tavern',noFlip:true,h:440,drop:14,house:true,smoke:[[.46,.04,.9]],glow:[[.5,.72,120]]},
  kr_hull_a:{src:'towns/kr_hull_a',h:400,drop:14,house:true,glow:[[.5,.62,70]]},
  kr_hull_b:{src:'towns/kr_hull_b',h:460,drop:14,house:true,glow:[[.5,.5,70]]},
  kr_hull_c:{src:'towns/kr_hull_c',h:420,drop:14,house:true,smoke:[[.64,.02,.7]]},
  kr_warehouse:{src:'towns/kr_warehouse',h:400,drop:14,house:true},
  kr_tollhouse:{src:'towns/kr_tollhouse',noFlip:true,h:440,drop:14,house:true,glow:[[.45,.62,80]]},
  kr_shipwright:{src:'towns/kr_shipwright',h:400,drop:14,house:true,glow:[[.5,.4,90]]},
  kr_lighthouse:{src:'towns/kr_lighthouse',h:620,drop:12,r:60,glow:[[.5,.13,300,[150,255,200]]]},
  kr_kraken_bones:{src:'towns/kr_kraken_bones',h:320,drop:12,r:0,crx:140,cry:44,cyo:-18},
  kr_figurehead:{src:'towns/kr_figurehead',h:230,drop:10,r:40},
  kr_stall_salvage:{src:'towns/kr_stall_salvage',h:190,drop:14,r:58},
  kr_stall_rum:{src:'towns/kr_stall_rum',h:190,drop:14,r:58},
  kr_lantern:{src:'towns/kr_lantern',h:170,drop:8,r:9,glow:[[.28,.52,150,[120,240,200]]]},
  kr_flag:{src:'towns/kr_flag',h:300,drop:8,r:12},
  kr_mast_wreck:{src:'towns/kr_mast_wreck',h:300,drop:8,wash:true},
  kr_wreck:{src:'towns/kr_wreck',w:760,drop:10,wash:true},
 };
 const land=[
  [0,560,'edge'],[W,560,'edge'],[W,H,'edge'],[5320,H,'rock'],[5200,3800,'rock'],[5080,3250,'sand'],[4980,QY,'quay'],
  [640,QY,'sand'],[560,3300,'rock'],[460,3900,'rock'],[340,H,'edge'],[0,H,'edge'],
 ];
 const roads=[
  {kind:'street',w:160,pts:UPW},{kind:'street',w:160,pts:UPE},{kind:'street',w:170,pts:MID},
  {kind:'avenue',w:200,pts:[[AXM,SQ.y+SQ.ry-20],[AXM,2060],[AXM,2700]]},
  {kind:'lane',w:120,pts:[[800,1400],[760,1740],[900,2060]]},
  {kind:'lane',w:120,pts:[[1900,1432],[1860,1760],[1900,2066],[1960,2380],[2000,2700]]},
  {kind:'lane',w:120,pts:[[3700,1432],[3760,1760],[3700,2064],[3640,2380],[3600,2700]]},
  {kind:'lane',w:120,pts:[[4800,1400],[4860,1740],[4700,2060]]},
  {kind:'quay',w:300,pts:WF},
 ];
 const ring=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+i/16*Math.PI*2;ring.push([Math.round(AXM+Math.cos(a)*560),Math.round(SQ.y+Math.sin(a)*180)]);}
 const paths=[
  {pts:[[2150,1440],ring[12]]},{pts:[[3450,1440],ring[4]]},{pts:ring},{pts:[ring[8],[AXM,SQ.y+SQ.ry-20]]},{pts:[[AXM,1330],ring[0]]},
  {pts:[[1380,2700],[1380,3640]]},{pts:[[1380,3640],[1100,3640]]},{pts:[[3080,2700],[3080,3560]]},{pts:[[4380,2700],[4380,3740]]},
 ];
 const piers=[
  {kind:'timber',x:1300,y:QY-10,w:160,h:780,open:'ns',old:true},       /* Blackbeard's */
  {kind:'timber',x:1000,y:3560,w:800,h:160,open:'n',old:true},
  {kind:'timber',x:3000,y:QY-10,w:160,h:860,open:'ns',old:true},
  {kind:'timber',x:2800,y:3580,w:560,h:140,open:'n',old:true},
  {kind:'stone',x:4280,y:QY-10,w:200,h:1000,open:'ns',tile:'harbor/quay_paving'},
  {r:230,x:4380,y:3990,tile:'towns/kr_shingle'},
 ];
 const buildings=[],props=[];
 const B=(k,x,y,o)=>buildings.push([k,x,Math.round(y),o]),P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 const flip={flip:true};
 const row=(pts,list)=>{for(const [k,x,dy,o] of list)B(k,x,along(pts,x)-90+(dy||0),o);};
 /* the Drowned Council above the square; hull houses along the upper boardwalks either side */
 B('kr_council',AXM,1270);
 row(UPW,[['kr_hull_a',480,-4],['kr_hull_c',1060,6,flip],['kr_hull_b',1530,-6],['kr_hull_a',2030,4,flip]]);
 row(UPE,[['kr_hull_c',3620,-4],['kr_hull_b',4130,6],['kr_hull_a',4560,-6,flip],['kr_shipwright',5130,4]]);
 /* Middle Street: the toll house at the west end, homes either side of the square */
 row(MID,[['kr_tollhouse',560,-4],['kr_hull_a',1080,6,flip],['kr_hull_c',1570,-6],['kr_hull_b',3980,4,flip],['kr_hull_c',4460,-6],['kr_hull_a',5030,6,flip]]);
 /* the waterfront: salvage warehouses, the shipwright, and the Kraken's Rest itself looking out over the bay */
 row(WF,[['kr_warehouse',750,-6],['kr_hull_a',1450,4],['kr_shipwright',2410,-4,flip],['kr_tavern',3260,-6],['kr_hull_b',4000,-4,flip],['kr_warehouse',4760,-4,flip]]);
 /* the cliff foot behind the town: scrub and a few wind-bent trees, clear of the Council's court */
 for(let x=120,i=0;x<W-60;x+=160+((i*47)%70),i++){if(Math.abs(x-AXM)<420)continue;P(i%3?'linden':'bush',x,700+((i*67)%170));}
 for(const [x,y] of [[140,1200],[5460,1200],[140,1750],[5460,1750],[140,2400],[5460,2400],[AXM-470,1180],[AXM+470,1180]])P('linden',x,y);   /* the town's edges */
 /* Kraken Square: the bones, stalls of salvage and rum on the rim, the figurehead and the flags */
 P('kr_kraken_bones',AXM,SQ.y+34);
 const stalls=['kr_stall_salvage','kr_stall_rum','stall_fish','kr_stall_salvage','kr_stall_rum','stall_fish'];
 const rim=[.08,.24,.37,.63,.76,.92];
 stalls.forEach((k,i)=>{const a=Math.PI*rim[i],x=AXM+Math.cos(a)*700,y=SQ.y+Math.sin(a)*232;P(k,Math.round(x),Math.round(y)+10,x>AXM?flip:undefined);});
 P('kr_figurehead',AXM-330,SQ.y-40);P('pots',AXM+330,SQ.y-40);
 for(const dx of [-760,760])P('kr_flag',AXM+dx,SQ.y-70);
 for(const dx of [-560,560])P('kr_lantern',AXM+dx,SQ.y+180);
 for(const dx of [-300,300])P('kr_lantern',AXM+dx,1330);
 /* the boardwalks: lanterns, pots and nets at the doors */
 for(const [pts,xs] of [[UPW,[650,1300]],[UPE,[3900,4750]],[MID,[400,1300,2080,3520,4250,5250]]])xs.forEach((x,i)=>P(i%2?'kr_lantern':'pots',x,along(pts,x)+(i%2?84:-84)));
 for(const [x,y,k] of [[1750,2150,'fishrack'],[4200,2150,'upturned'],[5300,2150,'fishrack'],[260,1560,'barrels'],[5350,1560,'crates']])P(k,x,y);
 /* the waterfront: bollards, cargo, rope and the guns that keep the port free */
 for(let x=700;x<=4900;x+=250){if(Math.abs(x-1380)<130||Math.abs(x-3080)<130||Math.abs(x-4380)<150)continue;P('bollard',x,QY-26);}
 for(const [x,k] of [[980,'crates'],[1150,'barrels'],[1500,'pots'],[1820,'loot'],[2250,'upturned'],[2560,'barrels'],[3320,'crates'],[3860,'pots'],[4060,'barrels'],[4620,'loot'],[4860,'crates']])P(k,x,2790+((x/10)%3)*10);
 P('stall_fish',1700,2800);P('kr_stall_rum',2200,2600,flip);P('anchor',3700,2805);
 for(const x of [1150,2450,3300,4200,4950])P('kr_lantern',x,2585);
 P('cannon',4300,4130);P('cannon',4460,4130,flip);P('kr_flag',4180,3860);P('kr_lantern',1700,3640);P('barrels',1080,3700);P('crates',1640,3710);
 /* the bay: the wrecks that tried, the rocks that stopped them */
 P('kr_wreck',2250,4040);P('kr_mast_wreck',3930,3930);P('kr_mast_wreck',1500,3980,flip);
 P('buoy',2600,3300);P('buoy',3700,3450);P('rocks',820,3380);P('rocks',4880,3620,flip);
 B('kr_lighthouse',4380,4010);
 const ships=[
  ['galleon',2040,3440,{seed:1.3,name:'The Black Tide'}],
  ['sloop',3500,3560,{seed:2.6,name:'Salt Widow'}],
  ['carrack',3250,4160,{seed:4.1,flip:true}],['sloop',850,4120,{seed:5.2,flip:true}],
  ['rowboat',2350,3220,{seed:.6}],['rowboat',3850,3260,{seed:.9,flip:true}],
 ];
 const UP=[300,1350,5300,2150],QUAY=[600,2580,5000,2820];
 const folk=[
  ['Corsair Anse','pirate',QUAY],['Corsair Bartho','pirate',UP],['Corsair Cutter','pirate',QUAY],['Corsair Dace','pirate',UP],['Corsair Ebb','pirate',QUAY],
  ['Captain Flint Mora','pirate_captain',UP],['Captain Grey Hollis','pirate_captain',QUAY],['Sailor Harl','sailor',QUAY],['Sailor Ives','sailor',UP],
  ['Sailor Jory','sailor',QUAY],['Dockhand Kell','dockhand',QUAY],['Dockhand Lusk','dockhand',QUAY],['Dockhand Morrow','dockhand',QUAY],
  ['Fishwife Nell','fishwife',QUAY],['Fishwife Orla','fishwife',UP],['Salvager Pike','male',UP],['Salvager Quill','male',QUAY],['Tess','female',UP],
  ['Ruby of the Wrecks','courtesan_blonde',UP],['Vesper','courtesan_dark',UP],['Merchant Ramos','merchant',UP],['Market wife Sabine','market_woman',UP],
  ['Sellsword Tor','mercenary',UP],['Sellsword Ulric','mercenary_b',QUAY],['Harbour hand Voss','harbour_master',QUAY],['Corsair Wick','pirate',UP],
 ];
 const CORVIN=['Every cargo between the southern seas and your realm pays its toll here. I count it.','The Drowned Council asks one thing of a guest: pay, and do not drown.','We are a free port. Freedom has a price. I keep the ledger that says what it is.','Mind the Council\'s bones in the square. The beast they came from was the last to argue with us.'];
 const stands=[
  {name:'Trade Officer Corvin Saltmarsh',skin:'ruler_corvin',x:AXM,y:1340,fx:1,big:1.32,game:'ruler',say:CORVIN,extra:{royal:true}},
  {name:'Tollkeeper Maddox',skin:'harbour_master',x:640,y:along(MID,640)-36,fx:1,say:['Every hull pays. Even the ones that sink here.','Coin in the box, name in the book, and the tide is yours.','Kraken\'s Rest takes a tenth. The sea takes the rest.']},
  {name:'Old Salt Barnaby',skin:'pirate_captain',x:AXM-230,y:SQ.y+120,fx:1,say:['I saw it, I did. Arms like mainmasts. It took three fleets before it rested.','Leave a coin by the bones. It is only polite.','They built this town from the ships it sank. Waste not.']},
  {name:'Rum seller Gilly',skin:'pirate',x:2240,y:2660,fx:-1,say:['Rum! Dark as the deep, twice as strong!','A mug for the road - there is no road, only sea.','Drink up. The Council taxes the empty bottles.']},
 ];
 TW.register({id:'krakensrest',icon:'🐙',name:'Kraken’s Rest',seed:6107,w:W,h:H,
  blurb:'A free port built on the wrecks of the fleets that tried to take it - every cargo to the southern seas pays its toll here.',
  land,roads,paths,piers,buildings,props,ships,folk,stands,art,
  shoreY:QY,
  arrival:{x:1380,y:3700},
  blackbeard:{x:1250,y:3670,fx:1},
  sea:{color:'#0f4d55',shade:'rgba(20,90,90,.18)'},
  floor:{tile:'towns/kr_shingle',size:280,color:'#6f6658'},
  map:{roof:'#3a3430',road:'#a88a62',plaza:'#b8ab92',tree:'#3f5a4a',wall:'#8a8070'},   /* the minimap's colours */
  roadStyles:{
   street:{tile:'harbor/planks',size:220,kerb:8,kerbColor:'#5a4630',order:1},
   lane:{tile:'harbor/planks',size:200,kerb:6,kerbColor:'#5a4630',order:0},
   avenue:{tile:'harbor/quay_paving',size:280,kerb:10,kerbColor:'#9a8a70',order:2},
   quay:{tile:'harbor/quay_paving',size:320,order:3},
  },
  plazas:[{...SQ,kind:'square'},{x:AXM,y:1360,rx:480,ry:110,kind:'court'}],
  plazaStyles:{square:{tile:'harbor/quay_paving',size:300,rim:'#9a8a70',ring:'rgba(40,150,130,.42)'},court:{tile:'harbor/quay_paving',size:260,rim:'#9a8a70'}},
  quayKerb:'#8a7a60',quayFace:'#3e3428',quayArt:{key:'towns/kr_quay',kerb:0.4},pierTile:'harbor/planks',
  backdrop:{key:'towns/kr_cliffs',y:0,h:660,sky:[[0,'#2c3a3e'],[1,'#56686a']]},
  light:.3,
  birds:[{path:[[1500,3200,800,260,.15,0],[3800,2400,900,300,-.12,2],[2600,3900,700,240,.2,4],[4600,3300,500,200,-.17,1]]}],
  haze:[[0,'rgba(120,200,190,.07)'],[1,'rgba(120,200,190,0)']],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
