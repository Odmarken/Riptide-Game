/* 🏔 Silverfjord: the jewel of the north, bigger than the City itself. A mining town grown rich at the head of a fjord so
 * deep the silver barges float over nothing - white granite, deep-blue slate, silver on every rail and lamp - inside a
 * white curtain wall with blue-roofed towers, the Mine Gate in the north wall and the West and East Gates shut (Silverfjord
 * trades by sea). King Sigvald's palace stands at the head of the grand axis - its doors lead into the throne hall
 * (towns/sf_palace.js) - which runs down past the Fountain Square to the Grand Landing. Four streets cross the town from
 * wall to wall with the Temple, the Exchange and the Mint, the Opera, the Library, the Market Hall, the Winter Garden and
 * Swan Park along them; the rows between are filled house by house from a seeded hand (so the town is the same every
 * visit) with the landmarks placed first. Blackbeard ties up at the old timber pier west of the Landing. */
(function(root){
 if(typeof module==='object'&&module.exports)require('./towns-art.js');
 const TW=root.TownWorld||(typeof require==='function'?require('../town-world.js'):null);
 if(!TW)return;
 const W=18400,H=7400,AX=9200,QY=5560;                          /* AX: the grand axis; QY: the quay edge */
 const WALLN=1340,WX0=200,WX1=W-200;                             /* the north wall's foot; the west and east walls' middles */
 const MINE=11800;                                               /* the Mine Gate in the north wall */
 /* four streets from wall to wall, bowing a little with the slope of the fjord side */
 const bow=x=>((x-AX)/AX)**2;
 const XS=[360,1200,2400,3600,4600,5700,6900,7900,AX,10500,11500,11800,12800,13800,14900,16000,17200,W-360];
 const U=x=>Math.round(2150+70*bow(x)),C=x=>Math.round(2950+60*bow(x)),L=x=>Math.round(3750+70*bow(x)),Q=x=>Math.round(4550+60*bow(x));
 const HR=5300;                                                  /* the harbour road along the quay */
 const street=(f,w,kind='street',x0=360,x1=W-360)=>({kind,w,pts:XS.filter(x=>x>=x0&&x<=x1).map(x=>[x,f(x)])});
 const FS={x:AX,y:3350,rx:1050,ry:360};                          /* Fountain Square */
 const art={
  sf_palace:{src:'towns/sf_palace',noFlip:true,h:640,drop:14,house:true,cry:52,glow:[[.5,.78,150]]},
  sf_temple:{src:'towns/sf_temple',h:600,drop:14,house:true,glow:[[.5,.83,130]]},
  sf_exchange:{src:'towns/sf_exchange',noFlip:true,h:540,drop:14,house:true},
  sf_mint:{src:'towns/sf_mint',noFlip:true,h:480,drop:14,house:true},
  sf_opera:{src:'towns/sf_opera',noFlip:true,h:600,drop:14,house:true,glow:[[.5,.8,160]]},
  sf_library:{src:'towns/sf_library',noFlip:true,h:520,drop:14,house:true},
  sf_inn:{src:'towns/sf_inn',noFlip:true,h:480,drop:14,house:true,glow:[[.5,.8,90]]},
  sf_market_hall:{src:'towns/sf_market_hall',h:440,drop:14,house:true},
  sf_bathhouse:{src:'towns/sf_bathhouse',h:440,drop:14,house:true},
  sf_barracks:{src:'towns/sf_barracks',h:420,drop:14,house:true},
  sf_chapel:{src:'towns/sf_chapel',h:480,drop:14,house:true,glow:[[.5,.35,80]]},
  sf_admiralty:{src:'towns/sf_admiralty',h:520,drop:14,house:true,glow:[[.36,.8,70],[.64,.8,70]]},
  sf_minersguild:{src:'towns/sf_minersguild',noFlip:true,h:480,drop:14,house:true},
  sf_wintergarden:{src:'towns/sf_wintergarden',h:330,drop:12,house:true,cry:40},
  sf_manor:{src:'towns/sf_manor',h:460,drop:14,house:true},
  sf_townhouse_a:{src:'towns/sf_townhouse_a',h:440,drop:14,house:true},
  sf_townhouse_b:{src:'towns/sf_townhouse_b',h:470,drop:14,house:true},
  sf_townhouse_c:{src:'towns/sf_townhouse_c',h:400,drop:14,house:true,glow:[[.97,.52,60]]},
  sf_house_d:{src:'towns/sf_house_d',h:470,drop:14,house:true},
  sf_house_e:{src:'towns/sf_house_e',h:400,drop:14,house:true},
  sf_house_f:{src:'towns/sf_house_f',h:480,drop:14,house:true},
  sf_house_g:{src:'towns/sf_house_g',h:460,drop:14,house:true},
  sf_house_h:{src:'towns/sf_house_h',h:400,drop:14,house:true},
  sf_house_i:{src:'towns/sf_house_i',h:430,drop:14,house:true},
  sf_house_j:{src:'towns/sf_house_j',h:360,drop:14,house:true},
  sf_house_k:{src:'towns/sf_house_k',h:500,drop:14,house:true},
  sf_house_l:{src:'towns/sf_house_l',h:420,drop:14,house:true},
  sf_house_m:{src:'towns/sf_house_m',h:470,drop:14,house:true},
  sf_row:{src:'towns/sf_row',h:440,drop:14,house:true},
  sf_warehouse:{src:'towns/sf_warehouse',h:360,drop:14,house:true},
  sf_pavilion:{src:'towns/sf_pavilion',h:290,drop:12,house:true,cry:40,cyo:-26},
  sf_gatehouse:{src:'towns/sf_gatehouse',h:560,drop:12,house:true,cry:48,glow:[[.28,.64,70],[.72,.64,70]]},
  sf_tower:{src:'towns/sf_tower',h:620,drop:12,r:0,crx:92,cry:34,cyo:-24},
  sf_wall:{src:'towns/sf_wall',h:300,drop:6},
  sf_wall_v:{src:'towns/sf_wall_v',h:1,drop:0},
  sf_lighthouse:{src:'towns/sf_lighthouse',h:560,drop:12,r:56,glow:[[.5,.1,260,[255,236,190]]],fire:[.5,.1,1.1]},
  sf_fountain:{src:'towns/sf_fountain',h:360,drop:14,r:0,crx:160,cry:56,cyo:-42,spray:[[.5,.07,1],[.5,.07,-1]]},
  sf_statue:{src:'towns/sf_statue',h:300,drop:10,r:40},
  sf_obelisk:{src:'towns/sf_obelisk',h:420,drop:10,r:42},
  sf_gazebo:{src:'towns/sf_gazebo',h:300,drop:12,r:0,crx:120,cry:44,cyo:-28},
  sf_banner:{src:'towns/sf_banner',h:270,drop:8,r:12,flag:true},
  sf_lamp:{src:'towns/sf_lamp',h:190,drop:8,r:9,glow:[[.5,.14,170]]},
  sf_stall_silk:{src:'towns/sf_stall_silk',h:190,drop:14,r:60},
  sf_stall_silver:{src:'towns/sf_stall_silver',h:190,drop:14,r:60},
  sf_birch:{src:'towns/sf_birch',h:310,drop:10,r:14,sway:true},
  sf_planter:{src:'towns/sf_planter',h:112,drop:8,r:26},
  sf_bench:{src:'towns/sf_bench',h:84,drop:8,r:0,crx:52,cry:14,cyo:-6},
  sf_hedge:{src:'towns/sf_hedge',h:62,drop:6,r:0,crx:96,cry:14,cyo:-8},
  sf_flowerbed:{src:'towns/sf_flowerbed',h:92,drop:8,r:0,crx:58,cry:20,cyo:-14},
  sf_warship:{src:'towns/sf_warship',w:1000,drop:26,float:{amp:4,rot:.006,speed:.5}},
  sf_barge:{src:'towns/sf_barge',w:780,drop:18,float:{amp:3,rot:.006,speed:.55}},
 };
 /* ---------- the ground ---------- */
 const land=[
  [0,820,'edge'],[W,820,'edge'],[W,H,'edge'],[17600,H,'rock'],[17300,6400,'rock'],[17000,5900,'rock'],[16900,QY,'quay'],
  [1500,QY,'rock'],[1400,5900,'rock'],[1100,6400,'rock'],[800,H,'edge'],[0,H,'edge'],
 ];
 const zig=(x,f0,f1,dx)=>{const a=f0(x),b=f1(x);return [[x,a],[x+dx,Math.round((a+b)/2)],[x,b]];};
 const roads=[
  street(U,150),street(C,190,'crown'),street(L,150),street(Q,150),
  {kind:'avenue',w:260,pts:[[AX,U(AX)],[AX,C(AX)],[AX,FS.y-FS.ry+80]]},
  {kind:'avenue',w:260,pts:[[AX,FS.y+FS.ry-80],[AX,L(AX)],[AX,Q(AX)],[AX,HR]]},
  /* the West and East Avenues start at the Crown Street, below the Temple and the Exchange; the East one breaks for the Market Hall */
  {kind:'avenue',w:200,pts:[[4600,C(4600)],[4600,L(4600)],[4600,Q(4600)],[4600,HR]]},
  {kind:'avenue',w:200,pts:[[13800,C(13800)],[13800,L(13800)]]},{kind:'avenue',w:200,pts:[[13800,Q(13800)],[13800,HR]]},
  ...[2400,6900,11500,16000].map((x,i)=>({kind:'lane',w:120,pts:[...zig(x,U,C,i%2?44:-44),...zig(x,C,L,i%2?-40:40).slice(1),...zig(x,L,Q,i%2?36:-36).slice(1)]})),
  ...[1200,17200].map((x,i)=>({kind:'lane',w:120,pts:[...zig(x,C,L,i?40:-40),...zig(x,L,Q,i?-36:36).slice(1)]})),
  {kind:'street',w:150,pts:[[MINE,WALLN+60],[MINE,U(MINE)]]},
  {kind:'quay',w:400,pts:[[1700,HR],[2400,HR],[4600,HR],[5600,HR],[AX,HR],[12800,HR],[13800,HR],[15100,HR],[16700,HR]]},
 ];
 const ring=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+i/16*Math.PI*2;ring.push([Math.round(AX+Math.cos(a)*700),Math.round(FS.y+Math.sin(a)*250)]);}
 const paths=[
  {pts:[[AX,FS.y-FS.ry+80],ring[0]]},{pts:ring.slice(0,9)},{pts:ring.slice(8)},{pts:[ring[8],[AX,FS.y+FS.ry-80]]},
  {pts:[[5600,HR],[5600,5900],[5600,6360],[5900,6360]]},              /* Blackbeard's pier */
  {pts:[[AX,HR],[AX,5940]]},                                          /* the Grand Landing */
  {pts:[[12800,HR],[12800,6440]]},                                    /* the lighthouse mole */
  {pts:[[15100,HR],[15100,6120]]},                                    /* the barge pier */
 ];
 const piers=[
  {kind:'timber',x:5520,y:QY-10,w:160,h:720,open:'ns'},{kind:'timber',x:5280,y:6260,w:800,h:160,open:'n'},
  {kind:'stone',x:AX-260,y:QY-10,w:520,h:430,open:'n',tile:'towns/sf_paving'},
  {kind:'stone',x:12700,y:QY-10,w:200,h:1000,open:'ns',tile:'towns/sf_paving'},{r:230,x:12800,y:6640,tile:'towns/sf_paving'},
  {kind:'stone',x:15000,y:QY-10,w:200,h:600,open:'n',tile:'towns/sf_paving'},
  {kind:'timber',x:3200,y:QY-10,w:140,h:420,open:'n'},
 ];
 /* ---------- the curtain wall ---------- */
 const GATE_W=680;                                               /* the Mine Gate's drawn width, near enough */
 const walls=[{kind:'sf_wall',x0:WX0,x1:MINE-GATE_W/2+40,y:WALLN},{kind:'sf_wall',x0:MINE+GATE_W/2-40,x1:WX1,y:WALLN}];
 const vwalls=[{kind:'sf_wall_v',x:WX0,y0:WALLN-40,y1:7060,w:150},{kind:'sf_wall_v',x:WX1,y0:WALLN-40,y1:7060,w:150}];
 const decals=[{key:'towns/sf_gate_v',x:WX0,y:C(360),w:200,h:796,block:true},{key:'towns/sf_gate_v',x:WX1,y:C(W-360),w:200,h:796,block:true}];
 const blocks=[{x:MINE-GATE_W/2,y:WALLN-50,w:GATE_W,h:58}];        /* the Mine Gate is shut */
 /* ---------- what stands where ---------- */
 const buildings=[],props=[];
 const B=(k,x,y,o)=>buildings.push([k,x,Math.round(y),o]),P=(k,x,y,o)=>props.push([k,x,Math.round(y),o]);
 const flip={flip:true};
 const ar=k=>{const a=art[k],sz=TW.SIZES[a.src];return sz?sz[0]/sz[1]:null;};
 const wOf=k=>{const r=ar(k);return r?Math.round(art[k].h*r):0;};
 /* the seeded hand that fills the rows: the same town every visit */
 let seed=1703;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const HOUSES=['sf_townhouse_a','sf_townhouse_b','sf_townhouse_c','sf_house_d','sf_house_e','sf_house_f','sf_house_g','sf_house_h','sf_house_i','sf_house_j','sf_house_k','sf_house_l','sf_house_m','sf_row','sf_manor'];
 /* a row: houses along the north side of a street from x0 to x1, around what is already standing there (reserved) */
 function fillRow(f,dy,x0,x1,reserved,pool=HOUSES,gardenOdds=.16){
  const res=reserved.slice().sort((a,b)=>a[0]-b[0]);let x=x0,prev=[];
  while(x<x1){
   const block=res.find(([r0,r1])=>x>=r0&&x<r1);if(block){x=block[1];continue;}
   const next=res.find(([r0])=>r0>x),room=Math.min(x1,next?next[0]:x1)-x;
   if(rnd()<gardenOdds&&room>420){   /* a garden between two houses: a tree at the back, something to sit on or look at */
    const gw=190+Math.floor(rnd()*120),gx=x+gw/2,base=f(gx)+dy;
    P(rnd()<.5?'sf_birch':'linden',gx+Math.round(rnd()*40-20),base-120);
    P(['sf_flowerbed','sf_planter','sf_bench'][Math.floor(rnd()*3)],gx,base-36);
    x+=gw;continue;
   }
   const fits=pool.filter(k=>{const w=wOf(k);return w&&w<=room-12&&!prev.includes(k);});
   if(!fits.length){x+=Math.max(40,room);continue;}
   const k=fits[Math.floor(rnd()*fits.length)],w=wOf(k),cx=x+w/2+6;
   B(k,cx,f(cx)+dy+Math.round(rnd()*16-8),rnd()<.45?flip:undefined);
   prev=[prev[prev.length-1],k].filter(Boolean);
   x+=w+14+Math.floor(rnd()*40);
  }
 }
 const around=(x,half)=>[x-half,x+half];
 const crossings=()=>[around(AX,160),around(4600,130),around(13800,130),...[2400,6900,11500,16000].map(x=>around(x,115)),...[1200,17200].map(x=>around(x,115))];
 /* R1, under the north wall: the palace, the Library, the Guard, the Miners' Guild and the Opera */
 const R1=x=>U(x)-90;
 const fixedR1=[['sf_palace',AX,-12],['sf_library',6900,0],['sf_barracks',7950,4],['sf_minersguild',11150,-6],['sf_opera',16000,-8],['sf_manor',10350,4],['sf_manor',3500,-6]];
 for(const [k,x,d] of fixedR1)B(k,x,R1(x)+d);
 fillRow(U,-90,380,W-380,[...fixedR1.map(([k,x])=>around(x,wOf(k)/2+20)),around(MINE,120)],HOUSES,.12);
 /* R2, along the Crown Street: the Temple and the Exchange with the Mint beside it, the Silver Swan */
 const R2=x=>C(x)-95;
 const fixedR2=[['sf_temple',4600,-16],['sf_exchange',13800,-14],['sf_mint',14650,-6],['sf_inn',10700,0],['sf_manor',7600,-8]];
 for(const [k,x,d] of fixedR2)B(k,x,R2(x)+d);
 fillRow(C,-95,420,W-420,[...fixedR2.map(([k,x])=>around(x,wOf(k)/2+20)),...crossings(),around(4600,420),around(13800,420)],HOUSES,.14);
 /* R3, along the Lower Street: open on the Fountain Square, the Winter Garden park on the west, Swan Park on the east */
 const R3=x=>L(x)-90;
 const fixedR3=[['sf_wintergarden',3000,-30],['sf_chapel',1700,-6]];
 for(const [k,x,d] of fixedR3)B(k,x,R3(x)+d);
 fillRow(L,-90,420,W-420,[...fixedR3.map(([k,x])=>around(x,wOf(k)/2+20)),...crossings(),[AX-1150,AX+1150],[2500,3600],[14950,16350]],HOUSES,.14);
 /* R4, along the Quay Lane: the Market Hall on its square, the Silver Baths */
 const R4=x=>Q(x)-90;
 const fixedR4=[['sf_market_hall',13800,-10],['sf_bathhouse',5700,-8],['sf_house_l',10500,0]];
 for(const [k,x,d] of fixedR4)B(k,x,R4(x)+d);
 fillRow(Q,-90,420,W-420,[...fixedR4.map(([k,x])=>around(x,wOf(k)/2+20)),...crossings(),around(13800,700),around(AX,160)],HOUSES,.12);
 /* R5, the harbour front: warehouses and pavilions, the Admiralty */
 const R5=HR-210;
 const fixedR5=[['sf_admiralty',11000,-6],['sf_pavilion',AX-520,6],['sf_pavilion',AX+520,6]];
 for(const [k,x,d] of fixedR5)B(k,x,R5+d,x>AX?flip:undefined);
 fillRow(()=>R5+90,-90,1760,16640,[...fixedR5.map(([k,x])=>around(x,wOf(k)/2+20)),around(AX,160),around(4600,120),around(13800,120)],['sf_warehouse','sf_warehouse','sf_house_j','sf_townhouse_b','sf_house_h','sf_row','sf_house_m'],.1);
 /* ---------- the wall's towers, gates and the woods beyond ---------- */
 B('sf_gatehouse',MINE,WALLN+14);
 for(const x of [WX0,2200,4200,6200,8200,10200,13600,15600,WX1])B('sf_tower',x,WALLN+16);
 for(const y of [3900,4900,6000,7060])for(const x of [WX0,WX1])B('sf_tower',x,y);
 for(let x=120,i=0;x<W-60;x+=160+((i*37)%70),i++){P(i%3===0?'linden':'sf_birch',x,960+((i*53)%90));if(i%4===0)P('sf_birch',x+70,1140+((i*29)%60));}
 /* gardens behind the top row, under the wall */
 for(let x=480,i=0;x<W-480;x+=260+((i*53)%90),i++){if(Math.abs(x-AX)<700||Math.abs(x-MINE)<420)continue;P(i%3===2?'linden':'sf_birch',x,WALLN+150+((i*41)%70));}
 /* a green belt inside the walls */
 for(let y=1700;y<=5300;y+=420)for(const x of [390,W-390])if([C,U,L,Q].every(f=>Math.abs(y-f(x))>170))P(y%840?'sf_birch':'linden',x,y);
 for(const [i,[x,y]] of [[700,6100],[900,6700],[500,6500],[17700,6100],[17500,6700],[17900,6500]].entries())P(i%2?'linden':'sf_birch',x,y);
 P('rocks',1430,6320);P('rocks',17040,6430,flip);P('rocks',1120,7120);P('rocks',17320,7240,flip);   /* out in the water, clear of the bank */
 /* ---------- the Palace forecourt ---------- */
 const PB=R1(AX)-12;                                            /* the palace's foot */
 P('sf_banner',AX-330,PB+58);P('sf_banner',AX+330,PB+58);P('sf_statue',AX-700,PB+30);P('sf_statue',AX+700,PB+30);
 P('sf_planter',AX-440,PB+70);P('sf_planter',AX+440,PB+70);P('sf_flowerbed',AX-880,PB+10);P('sf_flowerbed',AX+880,PB+10);
 /* ---------- Fountain Square ---------- */
 P('sf_fountain',AX,FS.y+70);
 P('sf_statue',AX-960,FS.y+40);P('sf_statue',AX+960,FS.y+40);
 /* the market stalls stand between the walk round the fountain and the square's rim */
 for(const [deg,k] of [[20,'sf_stall_silk'],[160,'sf_stall_silver'],[340,'sf_stall_silver'],[200,'sf_stall_silk']]){const a=deg*Math.PI/180,x=AX+Math.cos(a)*880;P(k,Math.round(x),FS.y+Math.round(Math.sin(a)*300),x>AX?flip:undefined);}
 for(const [dx,dy,o] of [[-230,-90],[230,-90],[-330,70,flip],[330,70]])P('sf_bench',AX+dx,FS.y+dy,o);
 for(const [dx,dy] of [[-980,-120],[980,-120],[-960,170],[960,170]])P('sf_banner',AX+dx,FS.y+dy);
 for(const [dx,dy] of [[-520,-296],[520,-296],[-1030,-60],[1030,-60],[-520,286],[520,286]])P('sf_lamp',AX+dx,FS.y+dy);
 /* ---------- the squares on the Crown Street: the Temple's and the Exchange's ---------- */
 for(const x of [4600,13800]){P('sf_statue',x-560,C(x)+170);P('sf_statue',x+560,C(x)+170);P('sf_banner',x-420,C(x)+150);P('sf_banner',x+420,C(x)+150);}
 /* ---------- the Market Square on the Quay Lane ---------- */
 for(const [dx,dy,k,o] of [[-420,160,'stall_fish'],[420,160,'stall_bread',flip],[-240,230,'stall_greens'],[240,230,'sf_stall_silk',flip],[-560,220,'tent_blue'],[560,220,'tent_blue',flip]])P(k,13800+dx,Q(13800)+dy,o);
 /* ---------- the parks ---------- */
 for(const [x,dy] of [[2560,-120],[2640,-40],[3440,-110],[3520,-30],[3380,20]])P('sf_birch',x,R3(x)+dy);
 P('sf_gazebo',15500,R3(15500)-20);P('sf_obelisk',15100,R3(15100)-40);   /* Swan Park: the lane at 16000 runs through it, so everything keeps west of it */
 for(const [x,dy] of [[15000,-150],[16250,-140],[16300,-60],[15300,-160],[15750,-170]])P('sf_birch',x,R3(x)+dy);
 P('sf_flowerbed',15300,R3(15300)+10);P('sf_flowerbed',15750,R3(15750)+10);P('sf_bench',15420,R3(15420)+40);P('sf_bench',15650,R3(15650)+40,flip);
 /* ---------- the streets: a lamp every so often on alternate sides, banners down the axis ---------- */
 const keep=x=>[AX,4600,13800,2400,6900,11500,16000,1200,17200,MINE].every(c=>Math.abs(x-c)>(c===AX?360:c===4600||c===13800?760:150));
 for(const [f,w,k] of [[U,150,1],[C,190,-1],[L,150,1],[Q,150,-1]])for(let x=700,i=0;x<=W-700;x+=460,i++)if(keep(x))P('sf_lamp',x,f(x)+(i%2?1:-1)*k*(w/2+14));
 for(const y of [2380,2560,2760,3960,4180,4380,4800,5000])P('sf_banner',AX+(y%40?-165:165),y);
 /* ---------- the harbour front ---------- */
 for(let x=1900;x<=16600;x+=250){if([5600,AX,12800,15100,3270].some(c=>Math.abs(x-c)<(c===AX?330:160)))continue;P('bollard',x,QY-26);}
 for(const [x,k,o] of [[2150,'crane'],[3900,'crates'],[4050,'barrels'],[6500,'crates',flip],[7300,'barrels'],[8100,'anchor'],[10300,'crates'],[10450,'barrels'],[11900,'cannon'],[12100,'cannon',flip],[14300,'crates'],[14450,'barrels'],[16200,'crane',flip]])P(k,x,HR-120,o);
 for(const x of [2600,4400,6300,7700,AX-300,AX+300,10700,12400,14000,15600])P('sf_lamp',x,HR+214);
 P('sf_banner',AX-220,5820);P('sf_banner',AX+220,5820);P('cannon',AX-160,5890);P('cannon',AX+160,5890,flip);
 P('barrels',5330,6420);P('crates',5980,6425);P('loot',5840,6420);P('anchor',6040,6300);P('lamp',5720,6310);
 P('sf_lighthouse',12800,6680);P('buoy',7300,5900);P('buoy',11800,6000);P('buoy',16000,6400);
 /* ---------- the fjord's boats ---------- */
 const ships=[
  ['galleon',6180,6250,{seed:1.3,name:'The Black Tide'}],
  ['sf_warship',AX+1150,6230,{seed:3.4,name:'The Silver Swan'}],
  ['sf_barge',14450,6130,{seed:2.2,name:'Silver barge'}],['sf_barge',15800,6080,{seed:4.2,flip:true}],
  ['sloop',3600,6300,{seed:2.7,flip:true}],['carrack',10900,7000,{seed:4.1}],
  ['rowboat',3150,6050,{seed:5.5}],['rowboat',AX-560,6080,{seed:0.7,flip:true}],['rowboat',13300,6200,{seed:1.9}],
 ];
 /* ---------- the people ---------- */
 const UP=[400,1500,W-400,3100],MID=[400,2800,W-400,4700],HARB=[1700,4450,16800,5500];
 const nobles=['Lady Ingrid','Dowager Astrid','Maiden Solvi','Lord Eskil','Jarl Torvald','Lord Halvar','Lady Runa','Lord Arne','Lady Signe','Lord Bertil','Lady Maja','Jarl Folke'];
 const nobleSkins=['noble_lady','noble_dowager','noble_maiden','noble_dandy','noble_elder','noble_velvet'];
 const folk=[
  ...nobles.map((n,i)=>[n,nobleSkins[i%nobleSkins.length],i%2?UP:MID]),
  ...['Leif','Orm','Hakon','Knut','Sune','Viggo','Alvar','Egil'].map((n,i)=>['Guardsman '+n,'silver_guard',i%3?MID:UP]),
  ...['Bjarke','Ulf','Vidar','Tord','Olle'].map((n,i)=>['Merchant '+n,'merchant',i%2?MID:HARB]),
  ...['Sigrid','Tove','Ylva','Frida','Greta'].map((n,i)=>[i%2?'Market wife '+n:'Baker '+n,i%2?'market_woman':'baker',MID]),
  ...['Anund','Edvin'].map(n=>['Brother '+n,'monk',MID]),
  ...['Gunnar','Hedda','Stig','Karin','Rune','Linnea','Torsten','Ebba'].map((n,i)=>[n,i%2?'female':'male',i%3?MID:UP]),
  ...['Kettil','Birger','Arvid','Holger'].map(n=>['Sailor '+n,'sailor',HARB]),
  ...['Ragnar','Sten','Bo','Nils'].map(n=>['Dockhand '+n,'dockhand',HARB]),
  ['Fishwife Gudrun','fishwife',HARB],['Fishwife Elna','fishwife',HARB],['Smith Joar','blacksmith',MID],['Smith Ivar','blacksmith',MID],
 ];
 const GATES=['The gates are shut. Silverfjord trades by sea.','Nobody leaves by land - the passes are the King’s.','If you want out, find the black ship in the harbour.'];
 const stands=[
  {name:'Palace Guard',skin:'silver_guard',x:AX-210,y:PB+82,fx:1,big:1.22,extra:{guard:true},say:['The King receives in the throne hall. Go in.','Mind the carpet. It cost more than your ship.']},
  {name:'Palace Guard',skin:'silver_guard',x:AX+210,y:PB+82,fx:-1,big:1.22,extra:{guard:true}},
  {name:'West Gate Warden',skin:'silver_guard',x:WX0+170,y:C(360)-40,fx:1,extra:{guard:true},say:GATES},
  {name:'East Gate Warden',skin:'silver_guard',x:WX1-170,y:C(W-360)-40,fx:-1,extra:{guard:true},say:GATES},
  {name:'Mine Gate Warden',skin:'silver_guard',x:MINE-150,y:WALLN+90,fx:1,extra:{guard:true},say:['The mines are the King’s. Nobody passes.','Silver comes down this road every morning. Under guard.','The miners? Up in the mountain. They come down on feast days.']},
  {name:'Silk merchant Frida',skin:'market_woman',x:AX-420,y:FS.y+260,fx:1,say:['Silk from the south, blue from the north.','Feel it. No, gently.','For a lady of your standing, half price. Almost.']},
  {name:'Silversmith Orvar',skin:'merchant',x:AX+420,y:FS.y+260,fx:-1,say:['Mined here, worked here, sold here.','That cup? Fjord silver. It rings.','No haggling. This is Silverfjord.']},
  {name:'Harbour Warden Sune',skin:'silver_guard',x:AX+120,y:5900,fx:-1,extra:{guard:true},say:['The Silver Swan is the fastest ship in the north.','Mind the edge - the fjord has no bottom.','The black ship? The King lets it moor. Nobody knows why.']},
  {name:'High Priest Aldor',skin:'monk',x:4600,y:C(4600)-60,fx:1,say:['The Deep Water gives, and the Deep Water keeps.','Light a candle for the miners.','Silverfjord was built on a promise to the fjord.']},
  {name:'Banker Osvald',skin:'noble_elder',x:13800,y:C(13800)-60,fx:-1,say:['The Exchange opens at the first bell.','Silver is steady. Everything else is weather.','The Mint strikes a thousand coins before breakfast.']},
  {name:'Opera doorman Kasper',skin:'noble_dandy',x:16000,y:U(16000)+40,fx:1,say:['Tonight: The Drowned King, in five acts.','Boxes are sold out until midwinter.','Please - no armour in the stalls.']},
 ];
 TW.register({id:'silverfjord',icon:'🏔',name:'Silverfjord',seed:1703,w:W,h:H,
  blurb:'The jewel of the north, walled in white granite: silver, marble and King Sigvald’s palace.',
  land,roads,paths,piers,walls,vwalls,decals,blocks,buildings,props,ships,folk,stands,art,
  shoreY:QY,
  arrival:{x:5600,y:6380},
  blackbeard:{x:5460,y:6350,fx:1},
  links:[{x:AX,y:PB+44,r:46,to:'sf_palace',at:{x:1500,y:3960},label:'The Palace',click:{x0:AX-520,y0:PB-620,x1:AX+520,y1:PB+10}}],
  sea:{color:'#0c4a66',shade:'rgba(20,70,110,.18)'},
  floor:{tile:'towns/sf_lawn',size:300,color:'#5f8a4c',shade:'rgba(118,128,112,.34)'},
  map:{roof:'#4d6d99',road:'#d9d4c6',plaza:'#e4dfd2',tree:'#3f6a33',wall:'#eef0f2'},   /* the minimap's colours */
  light:.38,
  roadStyles:{
   street:{tile:'towns/sf_paving',size:260,kerb:12,kerbColor:'#e9edf0',order:1},
   crown:{tile:'towns/sf_paving',size:280,kerb:14,kerbColor:'#f3f5f7',order:2},
   lane:{tile:'towns/sf_paving',size:220,kerb:8,kerbColor:'#e9edf0',order:0},
   avenue:{tile:'towns/sf_paving',size:300,kerb:14,kerbColor:'#f3f5f7',order:3},
   quay:{tile:'towns/sf_paving',size:320,shade:'rgba(90,110,130,.10)',order:4},
  },
  plazas:[{x:AX,y:U(AX)-10,rx:1000,ry:190,kind:'court'},{...FS,kind:'square'},
   {x:4600,y:C(4600),rx:700,ry:250,kind:'square'},{x:13800,y:C(13800),rx:700,ry:250,kind:'square'},
   {x:13800,y:Q(13800)+60,rx:650,ry:230,kind:'court'},{x:16000,y:U(16000),rx:520,ry:170,kind:'court'},{x:6900,y:U(6900),rx:460,ry:150,kind:'court'}],
  plazaStyles:{square:{tile:'towns/sf_plaza',size:340,rim:'#f2f4f6',ring:'rgba(40,80,150,.35)'},court:{tile:'towns/sf_plaza',size:260,rim:'#eef1f4'}},
  quayKerb:'#e3e7ea',quayFace:'#6c7a86',pierTile:'towns/sf_paving',
  backdrop:{key:'towns/sf_mountains',y:0,h:900,sky:[[0,'#9fc4e6'],[.6,'#d9ebf7'],[1,'#eef6fb']]},
  birds:[{path:[[5000,4600,1200,300,.14,0],[11000,3800,1500,400,-.11,2],[AX,5800,900,260,.19,4],[15000,4300,1100,300,-.13,1]]}],
  haze:[[0,'rgba(210,230,250,.10)'],[1,'rgba(210,230,250,0)']],
 });
})(typeof globalThis!=='undefined'?globalThis:this);
