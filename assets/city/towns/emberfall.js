/* 🔥 Emberfall: seven hundred chimneys under a red sky. Everything the realm makes out of metal was made here first.
 * The Great Foundry fills the top of the town with its yard of crucibles and ore carts; two crooked forge streets -
 * Hammer Row and Copper Street - run down through the soot-dark terraces to the Anvil Square, where the Guild of Smiths
 * and the Iron Market face the bronze smith, and on to the ore docks where the barges lie low with coal. Smoke from every
 * roof, embers on the wind, the volcano behind it all. */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=5000,H=5150,QY=4220,R4=3960;
 const CR=[[250,1560],[800,1530],[1400,1560],[2150,1540],[2500,1540],[2850,1540],[3600,1560],[4200,1530],[4750,1560]];      /* the Coal Road */
 const SL=[[250,2180],[800,2150],[1300,2190],[1800,2160],[2500,2160],[3200,2160],[3700,2190],[4200,2150],[4750,2180]];     /* Soot Lane */
 const QW=[[250,2900],[800,2870],[1500,2880],[1940,2880]],QE=[[3060,2880],[3500,2880],[4200,2870],[4750,2900]];         /* either side of the square */
 const CI=[[250,3490],[800,3460],[1650,3480],[2500,3480],[3350,3480],[4200,3460],[4750,3490]];                             /* Cinder Row */
 const HR=[[2150,1540],[1800,2160],[1500,2880],[1650,3480],[1900,4060]],CS=[[2850,1540],[3200,2160],[3500,2880],[3350,3480],[3100,4060]];
 const along=(pts,x)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i];if(x>=ax&&x<=bx)return Math.round(ay+(by-ay)*(x-ax)/(bx-ax||1));}return pts[x<pts[0][0]?0:pts.length-1][1];};
 const SQ={x:2500,y:2880,rx:560,ry:210};                          /* the Anvil Square */
 const soot=true;
 const art={
  ef_foundry:{src:'towns/ef_foundry',h:560,drop:14,house:true,cry:56,soot,smoke:[[.27,.02,1.6],[.5,.02,1.6],[.73,.02,1.6]],glow:[[.17,.8,160,[255,140,40]],[.5,.8,180,[255,140,40]],[.83,.8,160,[255,140,40]]]},
  ef_forge:{src:'towns/ef_forge',h:400,drop:14,house:true,soot,smoke:[[.83,.02,1.2]],glow:[[.45,.6,130,[255,130,40]]]},
  ef_guildhall:{src:'towns/ef_guildhall',noFlip:true,h:480,drop:14,house:true,glow:[[.5,.75,110]]},
  ef_chapel:{src:'towns/ef_chapel',h:480,drop:14,house:true,fire:[.5,.04,1],glow:[[.5,.05,120,[255,150,50]],[.5,.33,90]]},
  ef_market:{src:'towns/ef_market',h:420,drop:14,house:true,glow:[[.5,.6,140]]},
  ef_house_a:{src:'towns/ef_house_a',h:440,drop:14,house:true,soot,smoke:[[.2,.02,.9],[.5,.02,.9],[.8,.02,.9]]},
  ef_house_b:{src:'towns/ef_house_b',h:440,drop:14,house:true,soot,smoke:[[.21,.02,.9],[.78,.02,.9]]},
  ef_house_c:{src:'towns/ef_house_c',h:400,drop:14,house:true,soot,smoke:[[.14,.06,.8],[.47,.02,.9],[.77,.1,.8]]},
  ef_warehouse:{src:'towns/ef_warehouse',h:380,drop:14,house:true,soot,smoke:[[.7,.02,.9]]},
  ef_smokestack:{src:'towns/ef_smokestack',h:760,drop:12,r:0,crx:70,cry:26,cyo:-18,soot,smoke:[[.5,.01,2.4]],glow:[[.5,.93,100,[255,130,40]]]},
  ef_anvil:{src:'towns/ef_anvil',h:120,drop:8,r:30},
  ef_crucible:{src:'towns/ef_crucible',h:170,drop:10,r:50,glow:[[.5,.12,190,[255,150,40]],[.5,.8,120,[255,120,30]]]},
  ef_ore_cart:{src:'towns/ef_ore_cart',h:120,drop:10,r:44},
  ef_coal_heap:{src:'towns/ef_coal_heap',h:140,drop:10,r:56},
  ef_stall_tools:{src:'towns/ef_stall_tools',h:190,drop:14,r:58},
  ef_lamp:{src:'towns/ef_lamp',h:200,drop:8,r:9,glow:[[.5,.12,170,[255,170,80]]]},
  ef_statue:{src:'towns/ef_statue',h:320,drop:10,r:42},
  ef_barge:{src:'towns/ef_barge',w:1000,drop:16,float:{amp:3,rot:.005,speed:.45},smoke:[[.03,.06,.7]]},
  rh_brazier:{src:'towns/rh_brazier',h:120,drop:8,r:30,glow:[[.5,.3,150]],fire:[.5,.3,1.2]},
 };
 const land=[
  [0,640,'edge'],[W,640,'edge'],[W,H,'edge'],[4700,H,'rock'],[4560,4700,'rock'],[4420,4420,'rock'],[4380,QY,'quay'],
  [560,QY,'rock'],[480,4460,'rock'],[360,4760,'rock'],[260,H,'edge'],[0,H,'edge'],
 ];
 const roads=[
  {kind:'street',w:170,pts:CR},{kind:'lane',w:150,pts:SL},{kind:'lane',w:150,pts:QW},{kind:'lane',w:150,pts:QE},{kind:'lane',w:150,pts:CI},
  {kind:'street',w:170,pts:HR},{kind:'street',w:170,pts:CS},
  {kind:'lane',w:150,pts:[[2500,1540],[2500,2160],[2500,SQ.y-SQ.ry]]},
  {kind:'lane',w:150,pts:[[2500,SQ.y+SQ.ry],[2500,3480],[2500,4060]]},
  {kind:'quay',w:260,pts:[[300,4070],[900,4060],[1080,4060],[1900,4060],[2500,4060],[3100,4060],[3600,4060],[4100,4060],[4700,4070]]},
 ];
 const ring=[];for(let i=0;i<=12;i++){const a=-Math.PI/2+i/12*Math.PI*2;ring.push([Math.round(SQ.x+Math.cos(a)*330),Math.round(SQ.y+Math.sin(a)*140)]);}
 const paths=[
  {pts:[[2500,SQ.y-SQ.ry],ring[0]]},{pts:ring.slice(0,7)},{pts:ring.slice(6)},{pts:[ring[6],[2500,SQ.y+SQ.ry]]},
  {pts:[[1940,2880],ring[9]]},{pts:[[3060,2880],ring[3]]},
  {pts:[[1080,4060],[1080,4600],[1080,4960],[1340,4960]]},{pts:[[3600,4060],[3600,4640]]},
 ];
 const piers=[
  {kind:'timber',x:1000,y:QY-10,w:160,h:700,open:'ns',old:true},
  {kind:'timber',x:760,y:4880,w:800,h:160,open:'n',old:true},
  {kind:'stone',x:3500,y:QY-10,w:200,h:500,open:'n',tile:'harbor/quay_paving'},
 ];
 const buildings=[],props=[];
 const B=(k,x,y,o)=>buildings.push([k,x,Math.round(y),o]),P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 const flip={flip:true};
 const row=(pts,list)=>{for(const [k,x,dy,o] of list)B(k,x,along(pts,x)-90+(dy||0),o);};
 /* the Coal Road: the Great Foundry set back behind its yard, warehouses and stacks either side */
 B('ef_foundry',2500,1330);
 row(CR,[['ef_warehouse',560,-6],['ef_house_c',1130,4],['ef_smokestack',1640,-30],['ef_house_a',1860,6,flip],
  ['ef_house_b',3170,-4],['ef_smokestack',3420,-30],['ef_house_c',3900,6,flip],['ef_warehouse',4480,-4,flip]]);
 row(SL,[['ef_house_a',400,-4],['ef_house_b',700,6,flip],['ef_forge',1150,-6],['ef_house_a',1560,4,flip],['ef_chapel',2170,-10],
  ['ef_house_b',2760,4],['ef_forge',3520,-6,flip],['ef_house_a',3960,6],['ef_house_b',4280,-4,flip],['ef_house_a',4600,4]]);
 row(QW,[['ef_house_c',450,-4],['ef_house_a',900,6,flip],['ef_house_b',1200,-6]]);
 B('ef_guildhall',2076,2700);B('ef_market',2910,2700);
 row(QE,[['ef_house_c',3900,4,flip],['ef_house_a',4350,-6],['ef_house_b',4650,4,flip]]);
 row(CI,[['ef_house_b',380,-4,flip],['ef_house_a',680,6],['ef_smokestack',950,-30],['ef_house_b',1280,-6],
  ['ef_house_a',1850,4,flip],['ef_house_b',2200,-6],['ef_forge',2930,-4],['ef_house_c',3800,6,flip],['ef_smokestack',4250,-30],['ef_house_a',4560,-4]]);
 for(const [k,x,o] of [['ef_warehouse',470],['ef_house_a',900,flip],['ef_warehouse',1400],['ef_house_b',2150],['ef_house_b',2800,flip],['ef_warehouse',3550,flip],['ef_house_c',4100],['ef_warehouse',4620,flip]])B(k,x,R4+(x%3)*3,o);
 /* behind the Coal Road: slag heaps, stacks and the ore that feeds them */
 for(const [x,y] of [[300,980],[820,900],[1350,1000],[3700,960],[4250,900],[4700,1000]])P('ef_coal_heap',x,y,x%2?flip:undefined);
 for(const x of [580,1100,3950,4500])B('ef_smokestack',x,1060);
 P('ef_ore_cart',1560,1000);P('ef_ore_cart',3450,1010,flip);P('crates',200,1180);P('barrels',4800,1180);
 /* the foundry yard */
 P('ef_crucible',2050,1470);P('ef_crucible',2950,1470);P('ef_ore_cart',2260,1450);P('ef_ore_cart',2760,1450,flip);
 P('ef_coal_heap',1880,1440);P('ef_coal_heap',3120,1440,flip);P('ef_anvil',2380,1420);P('ef_anvil',2620,1420);
 P('rh_brazier',2250,1650);P('rh_brazier',2750,1650);
 /* the Anvil Square */
 P('ef_statue',SQ.x,SQ.y+10);
 P('ef_stall_tools',SQ.x-340,SQ.y+130);P('ef_stall_tools',SQ.x+340,SQ.y+130,flip);P('stall_bread',SQ.x-180,SQ.y+185);P('stall_greens',SQ.x+170,SQ.y+185,flip);
 P('rh_brazier',SQ.x-370,SQ.y-120);P('rh_brazier',SQ.x+370,SQ.y-120);
 for(const dx of [-470,470])P('ef_lamp',SQ.x+dx,SQ.y-60);
 /* the streets: iron lamps, anvils and coal by the forges */
 for(const [pts,xs] of [[CR,[600,1300,3700,4400]],[SL,[500,1000,2300,3350,4100]],[QW,[600,1200]],[QE,[3700,4400]],[CI,[500,1100,2050,2700,3900,4450]]])
  xs.forEach((x,i)=>P('ef_lamp',x,along(pts,x)+(i%2?88:-88)));
  for(const [x,y] of [[1560,2270],[3440,2250],[1700,3040],[3330,3040]])P('ef_ore_cart',x,y,x>2500?flip:undefined);
 P('ef_coal_heap',720,3000);P('ef_coal_heap',4200,2990,flip);P('crates',1880,3040);P('barrels',3120,3040);P('woodpile',640,2250);P('trough',4480,2250);
 /* the ore docks */
 for(let x=700;x<=4300;x+=260){if(Math.abs(x-1080)<130||Math.abs(x-3600)<150)continue;P('bollard',x,QY-26);}
 P('crane',1850,4150);P('crane',3200,4150,flip);P('ef_coal_heap',2250,4130);P('ef_coal_heap',2750,4140,flip);P('ef_ore_cart',2050,4170);P('ef_ore_cart',2950,4170,flip);
 P('crates',700,4130);P('barrels',1300,4150);P('crates',3900,4140,flip);P('barrels',4300,4150);
 for(const x of [800,1500,2500,3400,4200])P('ef_lamp',x,4180);
 P('barrels',840,4990);P('crates',1450,5000);P('loot',1300,4920);P('lamp',1200,4910);
 P('rocks',630,4720);P('rocks',4350,4800,flip);P('buoy',2200,4700);P('buoy',4100,4900);
 const ships=[
  ['galleon',1660,4860,{seed:1.3,name:'The Black Tide'}],
  ['ef_barge',2500,4440,{seed:2.1,name:'Cinder Maid'}],['ef_barge',4150,4500,{seed:3.3,flip:true}],['ef_barge',3000,4760,{seed:4.7}],
  ['rowboat',3850,4880,{seed:.5}],
 ];
 const TOWN=[300,1500,4700,3600],DOCK=[400,4000,4600,4150],YARD=[1800,1400,3200,1700];
 const folk=[
  ['Foundryman Ansgar','foundry_worker',YARD],['Foundryman Brokk','foundry_worker',YARD],['Foundryman Cale','foundry_worker',TOWN],['Foundryman Dunstan','foundry_worker',TOWN],
  ['Foundryman Egil','foundry_worker',TOWN],['Foundryman Fenn','foundry_worker',TOWN],['Smith Garrick','blacksmith',TOWN],['Smith Harald','blacksmith',TOWN],
  ['Smith Ivo','blacksmith',TOWN],['Market wife Jenna','market_woman',TOWN],['Kara','female',TOWN],['Lorcan','male',TOWN],['Merchant Mathis','merchant',TOWN],
  ['Watchman Nils','guard',TOWN],['Baker Olwen','baker',TOWN],['Brother Piran','monk',TOWN],
  ['Dockhand Quill','dockhand',DOCK],['Dockhand Rurik','dockhand',DOCK],['Dockhand Soren','dockhand',DOCK],['Sailor Tam','sailor',DOCK],['Foundryman Ulric','foundry_worker',DOCK],
 ];
 const ALDRIC=['Seven hundred chimneys, and every one of them pays me.','Everything the realm makes out of metal was made here first. Remember that when you sign.','Gold is only yellow iron with ambitions.','Mind the soot. It costs extra to wash off.'];
 const stands=[
  {name:'King Aldric Cindermane',skin:'ruler_aldric',x:2076,y:2765,fx:1,big:1.34,game:'ruler',say:ALDRIC,extra:{royal:true}},
  {name:'Guild Warden',skin:'guard',x:1880,y:2760,fx:1,big:1.2,extra:{guard:true}},
  {name:'Foreman Halvor',skin:'foundry_worker',x:2500,y:1620,fx:1,say:['Stand clear of the crucibles!','Fourteen hundred degrees and it still wants more coal.','The Foundry never sleeps. Neither do I, apparently.']},
  {name:'Ironmonger Wren',skin:'market_woman',x:SQ.x-340,y:SQ.y+200,fx:1,say:['Nails, hinges, horseshoes - forged this morning.','Emberfall iron. It bends before it breaks.','Buy two, the third is still two.']},
 ];
 TW.register({id:'emberfall',icon:'🔥',name:'Emberfall',seed:3301,w:W,h:H,
  blurb:'Seven hundred chimneys under a red sky: the foundry city of King Aldric.',
  land,roads,paths,piers,buildings,props,ships,folk,stands,art,
  shoreY:QY,
  arrival:{x:1080,y:4970},
  blackbeard:{x:950,y:4940,fx:1},
  sea:{color:'#2a3438',shade:'rgba(60,30,20,.30)',glint:'#ffd9b0'},
  floor:{tile:'towns/ef_cinder',size:300,color:'#3a3230'},
  map:{ground:'#3e3431',roof:'#7a4535',road:'#8a7a6c',plaza:'#948373',tree:'#3b4a2e',wall:'#5d5550'},   /* the minimap's colours */
  roadStyles:{
   street:{tile:'towns/ef_brick',size:220,kerb:10,kerbColor:'#5b4b42',order:2},
   lane:{tile:'towns/ef_brick',size:200,kerb:8,kerbColor:'#5b4b42',order:1},
   quay:{tile:'harbor/quay_paving',size:320,shade:'rgba(40,20,10,.25)',order:3},
  },
  plazas:[{...SQ,kind:'square'}],
  plazaStyles:{square:{tile:'towns/ef_brick',size:260,rim:'#8a5a3a',ring:'rgba(184,115,51,.45)'}},
  patches:[{x:2500,y:1480,rx:760,ry:150,tile:'towns/ef_brick',size:220,shade:'rgba(20,10,5,.30)',rim:'#5b4b42'}],
  quayKerb:'#7c7068',quayFace:'#3a302c',pierTile:'harbor/quay_paving',
  backdrop:{key:'towns/ef_skyline',y:0,h:720,sky:[[0,'#3a0d08'],[.55,'#8e2a12'],[1,'#d8642a']]},
  weather:'embers',light:1,
  tint:'rgba(120,40,10,.06)',
  haze:[[0,'rgba(140,50,20,.16)'],[1,'rgba(60,20,10,.10)']],
  birds:[],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
