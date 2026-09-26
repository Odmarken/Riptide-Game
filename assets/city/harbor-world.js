/* ⚓ The Harbour under the City. Through the gatehouse in the south wall, down a long flight cut into the
 * sea-cliff, lies a stone quay with five houses against the rock - a smokehouse, a chandler, a warehouse, the
 * harbour master's office and a tavern no honest man drinks in - and three piers that are nothing alike: a long
 * timber pier with a T-head, a stone mole with a beacon on its round head, and a crooked old fishing jetty. Two old
 * pirate ships and a sloop lie moored between them, and the quay is walked by sailors, dockhands, fishwives,
 * merchants and men with eye patches who are here to trade and nothing else.
 * Everything painted is Higgsfield gpt_image_2_5 (2026-09-21, assets/city/harbor/harbor-art-manifest.json). The
 * ground - sea, quay, piers, cliff - is drawn per frame from tiles, camera-culled; nothing here allocates a
 * world-sized canvas. The sea is two drifting layers of one seamless tile, a depth shade, glints, and foam that
 * laps every edge; whatever floats bobs on its own phase. Pure module: no DOM, no game - it runs headless in the
 * tests. game.js hands it images and a clock. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.HarborWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const W=4400,H=3600,XC=2200;
 const Q0=1400,Q1=2020;                                           /* the quay: from the cliff foot to the water's edge */
 const QUAY=Object.freeze({x:160,y:Q0,w:4080,h:Q1-Q0});
 /* the painting of the gate on its cliff with the flight coming down (harbor_arrival.png, 763x1132), its foot on the quay */
 const ARRIVAL=(()=>{const k=900/763;return Object.freeze({k,x:XC-450,y:Q0-1132*k,w:900,h:1132*k});})();
 /* the treads between the balustrades, measured on the painting: 160 px wide under the arch (row 372), 291 at the foot */
 const FLIGHT=Object.freeze({cx:ARRIVAL.x+383*ARRIVAL.k,y0:ARRIVAL.y+372*ARRIVAL.k,y1:Q0+24,half0:80*ARRIVAL.k,half1:146*ARRIVAL.k});
 const EXIT_Y=900;                                                /* this far up the flight and you are on your way to the City */
 const EXIT=Object.freeze({x:FLIGHT.cx,y:EXIT_Y,r:120});
 const SPAWN=Object.freeze({x:FLIGHT.cx,y:Q0+120});
 /* the cliff under the wall (harbor_cliff.png, 937x802: wall rows 0-312, rock below), laid as one wall course over two rock courses */
 const CLIFF=Object.freeze({s:.92,tile:(937-16)*.92,trim:8,wallSrc:[0,312],rockSrc:[312,482],top:FLIGHT.y0-8,wallH:312*.92});   /* trim: the picture is inked along its own edges, and a tile beside its reflection would double that line into a seam */
 /* three piers, nothing alike */
 const PIER_A=Object.freeze({stem:Object.freeze({x:915,y:Q1-20,w:170,h:960}),head:Object.freeze({x:700,y:2940,w:820,h:170})});
 const MOLE=Object.freeze({stem:Object.freeze({x:XC-120,y:Q1-20,w:240,h:920}),head:Object.freeze({x:XC,y:2990,r:200})});
 const JETTY=Object.freeze({upper:Object.freeze({x:3390,y:Q1-20,w:170,h:420}),lower:Object.freeze({x:3390,y:2380,w:170,h:380}),deck:Object.freeze({x:3390,y:Q1-20,w:170,h:760})});
 const LANES=Object.freeze([Q0+175,Q0+390,Q0+540]);               /* where the quay is walked: by the doors, down the middle, along the edge */
 const CROSS=Object.freeze([420,1000,1500,XC,2900,3450,3950]);     /* and where the lanes are crossed - kept clear of cargo */
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const ready=im=>!!(im&&im.complete!==false&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0);
 const iw=im=>im.naturalWidth||im.width,ih=im=>im.naturalHeight||im.height;
 let remembered={};

 /* ---------- who is here ---------- */
 const HARBOUR_MASTER='Harbourmaster Leopold Ankarstjaerna';
 const FOLK=Object.freeze([
  ['Sailor Olle','sailor'],['Sailor Jons','sailor'],['Mate Ragnar','sailor'],['Boatswain Figge','sailor'],['Skipper Hilding','sailor'],['Deckhand Truls','sailor'],
  ['One-Eyed Sixten','pirate'],['Hook Lasse','pirate'],['Black Rurik','pirate'],['Tar Nisse','pirate'],['Sabre Jocke','pirate'],
  ['Stevedore Bror','dockhand'],['Stevedore Malte','dockhand'],['Porter Anton','dockhand'],['Stevedore Valdemar','dockhand'],
  ['Herring Maja','fishwife'],['Sprat Karin','fishwife'],['Eel Britta','fishwife'],
  ['Merchant Hansson','merchant'],['Trader Viktor Saltlake','merchant'],['Spice Trader Melcher','merchant'],['Stallholder Signe','market_woman'],
  ['Brokk Saltskaegg','dwarfmale_hunter'],['Grima Havstand','orcfemale_warrior'],['Brother Ansgar','monk'],['Vex Drunknad','undeadmale_hunter'],
 ]);
 const TALK=Object.freeze({
  harbourmaster:['Every hull in this basin is written in my ledger. What they carry is written somewhere else.','Berth fees are due at the turn of the tide. The gentlemen with the black flag pay in advance - I insist.','Mind the mole at night: the beacon is lit, the cannon is loaded, and the gulls are worse than either.','Kraken’s Rest and Port Meridian both send ships here. One sends cargo. The other sends trouble with a manifest.'],
  captain:['She has outrun three navies and one ex-wife. She will outrun the rot too - probably.','We are honest traders, friend. Ask anybody who is still alive.','Rum, silk and pepper. Do not ask where from, and I will not ask what you are doing on my pier.','I would sell you a map, but the last man who bought one came back. Bad for business.'],
  fishwife:['Fresh this morning! The ones that were not fresh this morning are in the smokehouse.','Herring, cod, eel - and if it has too many legs it is extra.'],
  drunk:['Thish tavern... hic... drowned a rat once. Besht beer in the harbour ever shince.','I am not drunk. The quay is moving. Ask the quay.'],
  lookout:['Sail to the south-west. Could be a trader. Could be a trader’s worst day.','Nothing out there but water and things that live in it. I get paid either way.'],
 });
 function costume(skin){return /^(human|dwarf|orc|undead)(male|female)_(warrior|mage|hunter|priest)$/.exec(skin||'');}
 const isWoman=skin=>/^(female|baker|market_woman|fishwife|noble_lady|noble_dowager|noble_maiden)$|female_/.test(skin||'');
 function rng32(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 /* the walks: a grid of lanes and crossings on the quay, with a spur down each pier, up the flight and round the beacon */
 function graph(){
  const nodes=new Map(),edges=new Map();
  const node=(id,x,y,jx=16,jy=12)=>{nodes.set(id,{id,x,y,jx,jy});edges.set(id,[]);};
  const link=(a,b)=>{edges.get(a).push(b);edges.get(b).push(a);};
  LANES.forEach((y,j)=>CROSS.forEach((x,i)=>{node('q'+i+'_'+j,x,y);if(i)link('q'+(i-1)+'_'+j,'q'+i+'_'+j);if(j)link('q'+i+'_'+(j-1),'q'+i+'_'+j);}));
  node('stair',FLIGHT.cx,Q0+70,20,8);node('stairUp',FLIGHT.cx,Q0-330,30,8);link('q3_0','stair');link('stair','stairUp');
  node('a1',1000,2480,22,20);node('a2',1000,3025,20,10);node('a3',790,3025,20,14);node('a4',1430,3025,20,14);link('q1_2','a1');link('a1','a2');link('a2','a3');link('a2','a4');
  node('m1',XC,2450,40,20);node('m2',XC,2830,30,8);node('m3',XC-135,2990,8,8);node('m4',XC,3125,8,8);node('m5',XC+135,2990,8,8);
  link('q3_2','m1');link('m1','m2');link('m2','m3');link('m3','m4');link('m4','m5');link('m5','m2');
  const jx=JETTY.deck.x+JETTY.deck.w/2;
  node('j1',jx,2300,14,20);node('j2',jx,2400,5,4);node('j3',jx,2500,14,14);node('j4',jx,2715,14,8);link('q5_2','j1');link('j1','j2');link('j2','j3');link('j3','j4');
  return {nodes,edges};
 }
 function route(G,R,steps){
  const ids=[...G.nodes.keys()];let at=ids[Math.floor(R()*ids.length)],from=null;const out=[at];
  for(let i=0;i<steps;i++){
   const next=G.edges.get(at).filter(n=>n!==from&&!out.includes(n));
   if(!next.length)break;
   from=at;at=next[Math.floor(R()*next.length)];out.push(at);
  }
  return out.map(id=>{const n=G.nodes.get(id);return {x:n.x+(R()*2-1)*n.jx,y:n.y+(R()*2-1)*n.jy};});
 }
 function stand(name,skin,x,y,fx,extra){
  return {name,skin,race:'human',cls:'warrior',female:isWoman(skin),big:1.18,pts:[{x,y}],i:0,dir:1,x,y,speed:0,walk:0,fx,pauseT:1e9,moving:false,...extra};
 }
 /* ---------- what stands where ---------- */
 const HOUSES=Object.freeze([
  {kind:'fishhouse',x:520},{kind:'chandlery',x:985},{kind:'warehouse',x:1490},
  {kind:'office',x:2830},{kind:'tavern',x:3290},{kind:'warehouse',x:3850,flip:true},
 ]);
 const SHIPS=Object.freeze([
  {kind:'galleon',name:'The Black Tide',x:1582,y:2840,seed:1.3},
  {kind:'carrack',name:'The Crimson Widow',x:2880,y:2832,seed:4.1},
  {kind:'sloop',name:'The Gull’s Bargain',x:3840,y:2560,seed:2.2},
  {kind:'rowboat',x:770,y:2430,seed:5.5},{kind:'rowboat',x:540,y:2160,seed:0.7,flip:true},
 ]);
 function create(options={}){
  const R=rng32(options.seed===undefined?20260921:options.seed),G=graph(),npcs=[];
  for(const [name,skin] of FOLK){
   let pts=null;for(let t=0;t<8&&!(pts&&pts.length>=3);t++)pts=route(G,R,4+Math.floor(R()*4));
   const c=costume(skin),hauls=skin==='dockhand';
   npcs.push({name,skin,race:c?c[1]:'human',cls:c?c[3]:'warrior',female:isWoman(skin),pts,i:0,dir:1,x:pts[0].x,y:pts[0].y,
    speed:hauls?30+R()*14:24+R()*30,walk:R()*5,fx:1,pauseT:R()*3,moving:false});
  }
  npcs.push(stand(HARBOUR_MASTER,'harbour_master',2830,Q0+104,-1,{big:1.3,game:'harbourmaster',say:TALK.harbourmaster}));
  npcs.push(stand('Captain Blackbeard','pirate_captain',1335,3066,1,{big:1.3,game:'captain',voyage:true,say:TALK.captain}));   /* ⛵ voyage: he sails you to the ports of call */
  npcs.push(stand('Captain Red Ruben','pirate_captain',2276,2690,1,{big:1.26,game:'captain',say:TALK.captain}));
  npcs.push(stand('Fishwife Greta','fishwife',470,Q0+108,1,{big:1.15,game:'fishwife',say:TALK.fishwife}));
  npcs.push(stand('Rum Jerker','pirate',3180,Q0+112,1,{big:1.12,game:'drunk',say:TALK.drunk}));
  npcs.push(stand('Lookout Solve','sailor',2112,3108,-1,{big:1.12,game:'lookout',say:TALK.lookout}));
  npcs.push(stand('Craneman Ebbe','dockhand',1222,1888,1,{big:1.12}));
  const solids=[],prop=(kind,x,y,extra)=>solids.push({x,y,r:ART[kind].r||24,type:'harborprop',kind,...extra});
  for(const h of HOUSES){const a=ART[h.kind];prop(h.kind,h.x,Q0+44,{big:true,flip:!!h.flip,crx:a.crx,cry:46,cyo:-34,seed:h.x*.01});}
  prop('crane',1300,2000,{crx:60,cry:20,cyo:-14});
  prop('crates',1740,1684);prop('crates',3060,1680,{flip:true});prop('barrels',1240,1690);prop('barrels',3640,1694);prop('loot',1236,2968);
  prop('fishrack',730,1672);prop('fishrack',3215,1872,{flip:true});prop('anchor',2520,1676);prop('pots',3330,1990);prop('pots',3585,1992,{flip:true});
  prop('upturned',3790,1690);prop('stall_fish',2056,1690);prop('stall_cloth',2640,1866);
  prop('cannon',2128,2330,{flip:true});prop('cannon',2274,2560);prop('beacon',MOLE.head.x,MOLE.head.y+12,{crx:58,cry:34,cyo:-16});
  for(let x=300;x<=4100;x+=300)if(![1000,XC,3450,1300].some(px=>Math.abs(px-x)<170))prop('bollard',x,Q1-16);
  for(const x of [330,1180,1840,2560,3100,3700,4080])prop('lamp',x,Q0+262);
  /* piles down the timber piers, either side: in the water, so they block nobody */
  for(let y=2140;y<=2900;y+=190){prop('post',PIER_A.stem.x-4,y+36,{noCol:true});prop('post',PIER_A.stem.x+PIER_A.stem.w+4,y+110,{noCol:true});}
  for(const x of [720,900,1100,1300,1500])prop('post',x,PIER_A.head.y+PIER_A.head.h+30,{noCol:true});
  for(let y=2110;y<=2700;y+=200){const low=y>2400,rc=low?JETTY.lower:JETTY.upper;prop('post',rc.x-3,y+30,{noCol:true});prop('post',rc.x+rc.w+3,y+96,{noCol:true});}
  for(const s of SHIPS)prop(s.kind,s.x,s.y,{noCol:true,floats:true,seed:s.seed,flip:!!s.flip,name:s.name});
  prop('buoy',1750,3330,{noCol:true,floats:true,seed:3.3});prop('buoy',3060,3290,{noCol:true,floats:true,seed:6.1});prop('buoy',380,2700,{noCol:true,floats:true,seed:1.9});
  prop('rocks',330,3230,{noCol:true});prop('rocks',4150,3080,{noCol:true,flip:true});prop('wreck',2700,3400,{noCol:true,seed:2.7});
  return {key:'harbor',kind:'harbor',harbor:true,w:W,h:H,quay:{...QUAY},flight:{...FLIGHT},spawn:{...SPAWN},exit:{...EXIT,id:'city'},
   portal:{x:-500,y:-500},npcs,solids,mwalls:[],deco:[],waters:[],paths:[],floors:[],enemySpawns:[],bossRooms:[],entrances:[],pathY:-500,pathH:0};
 }
 /* An actor disk of radius r stands on something: the quay, the flight (a trapezoid, open at its foot), a pier.
    Stems are open at both ends - they run from the quay onto their heads - and closed along the water. */
 const inRect=(rc,x,y,rx,top,bottom)=>x>=rc.x+rx&&x<=rc.x+rc.w-rx&&y>=rc.y+top&&y<=rc.y+rc.h-bottom;
 function contains(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  if(inRect(QUAY,x,y,r,r,r))return true;
  if(y>=FLIGHT.y0+r&&y<=FLIGHT.y1){
   const m=(FLIGHT.half1-FLIGHT.half0)/(FLIGHT.y1-FLIGHT.y0),half=FLIGHT.half0+m*(y-FLIGHT.y0);
   if(Math.abs(x-FLIGHT.cx)<=half-r*Math.hypot(1,m))return true;
  }
  if(inRect(PIER_A.stem,x,y,r,0,0)||inRect(PIER_A.head,x,y,r,r,r))return true;
  if(inRect(MOLE.stem,x,y,r,0,0)||Math.hypot(x-MOLE.head.x,y-MOLE.head.y)<=MOLE.head.r-r)return true;
  if(inRect(JETTY.deck,x,y,r,0,r))return true;
  return false;
 }

 /* ---------- painting helpers ---------- */
 function ellipse(g,x,y,rx,ry,fill){g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);g.fillStyle=fill;g.fill();}
 function light(g,x,y,r,strength=1,tint=[255,190,100]){
  const grad=g.createRadialGradient(x,y,0,x,y,r),c=tint.join(',');
  grad.addColorStop(0,'rgba('+c+','+(.34*strength).toFixed(3)+')');grad.addColorStop(1,'rgba('+c+',0)');
  g.save();g.globalCompositeOperation='lighter';g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);g.restore();
 }
 function fire(g,x,y,size,time,seed){
  g.save();g.globalCompositeOperation='lighter';
  for(let i=0;i<5;i++){
   const p=(time*1.6+i/5+seed)%1,sway=Math.sin(time*6+i*2.1+seed*3)*5*size,r=(1-p)*15*size+3;
   g.fillStyle='rgba(255,'+Math.round(150+80*(1-p))+',60,'+((1-p)*.5).toFixed(3)+')';
   g.beginPath();g.ellipse(x+sway*p,y-p*34*size,r*.7,r,0,0,TAU);g.fill();
  }
  g.restore();
 }
 function smoke(g,x,y,size,time,seed){
  for(let i=0;i<6;i++){
   const p=(time*.11+i/6+seed*.37)%1,r=(7+p*24)*size;
   g.fillStyle='rgba(222,226,228,'+((1-p)*(1-p)*.36).toFixed(3)+')';
   g.beginPath();g.ellipse(x+(p*46+Math.sin(time*.7+i*1.9+seed)*7)*size,y-p*96*size,r,r*.8,0,0,TAU);g.fill();
  }
 }
 /* one texture over a rect, mirrored tile to tile so every seam meets its own reflection; quarter turns lay planks the other way */
 function mirrorTiles(g,im,rc,size,view,turn=false){
  const x0=Math.max(rc.x,view.x0),y0=Math.max(rc.y,view.y0),x1=Math.min(rc.x+rc.w,view.x1),y1=Math.min(rc.y+rc.h,view.y1);
  if(x1<=x0||y1<=y0||!ready(im))return false;
  g.save();g.beginPath();g.rect(x0,y0,x1-x0,y1-y0);g.clip();
  for(let j=Math.floor((y0-rc.y)/size);rc.y+j*size<y1;j++)for(let i=Math.floor((x0-rc.x)/size);rc.x+i*size<x1;i++){
   g.save();g.translate(rc.x+(i+.5)*size,rc.y+(j+.5)*size);if(turn)g.rotate(Math.PI/2);
   g.scale((turn?j:i)%2?-1:1,(turn?i:j)%2?-1:1);g.drawImage(im,-size/2-.4,-size/2-.4,size+.8,size+.8);g.restore();
  }
  g.restore();return true;
 }
 /* Short uneven wavelets fade independently along the shore, rather than a dashed outline. */
 function foam(g,pts,time,seed,out=1){
  g.save();g.lineCap='round';g.lineJoin='round';
  for(let j=1;j<pts.length;j++){
   const [ax,ay]=pts[j-1],[bx,by]=pts[j],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(!len)continue;
   const nx=pts[j-1][2]+pts[j][2],ny=pts[j-1][3]+pts[j][3],nl=Math.hypot(nx,ny)||1;
   for(let d=18;d<len-12;d+=43){
    const phase=time*1.25+seed+j*2.3+d*.079,p=(Math.sin(phase)+1)/2;
    const gap=(5+p*12)*out,x=ax+dx*d/len+nx/nl*gap,y=ay+dy*d/len+ny/nl*gap;
    const span=8+8*Math.sin(d*.13+seed)**2;
    g.strokeStyle='rgba(210,239,237,'+(.05+.19*(1-p))+')';g.lineWidth=1.2+p*.7;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx/len*span*.5+nx/nl*2,y+dy/len*span*.5+ny/nl*2,x+dx/len*span,y+dy/len*span);g.stroke();
   }
  }
  g.restore();
 }
 const rectFoam=rc=>[[rc.x,rc.y,-1,0],[rc.x,rc.y+rc.h,-1,1],[rc.x+rc.w,rc.y+rc.h,1,1],[rc.x+rc.w,rc.y,1,0]];   /* down the west side, along the end, up the east */

 /* ---------- the ground ---------- */
 function sky(g,v){
  if(v.y0>=CLIFF.top)return;
  const grad=g.createLinearGradient(0,0,0,CLIFF.top);grad.addColorStop(0,'#1c2a3b');grad.addColorStop(.55,'#44657c');grad.addColorStop(1,'#7f9fae');
  g.fillStyle=grad;g.fillRect(v.x0,v.y0,v.x1-v.x0,Math.min(v.y1,CLIFF.top)-v.y0);
 }
 function sea(g,im,v,time){
  const top=Q1-40;if(v.y1<=top)return;
  const y0=Math.max(v.y0,top);
  g.fillStyle='#0f4f66';g.fillRect(v.x0,y0,v.x1-v.x0,v.y1-y0);
  if(ready(im.sea_tile)){
   g.save();g.beginPath();g.rect(v.x0,y0,v.x1-v.x0,v.y1-y0);g.clip();
   for(const [size,dx,dy,alpha] of [[640,time*7,time*3,1],[1040,-time*5,time*6.5,.36]]){
    const ox=((dx%size)+size)%size,oy=((dy%size)+size)%size;
    g.globalAlpha=alpha;
    for(let ty=Math.floor((y0-oy)/size)*size+oy;ty<v.y1;ty+=size)for(let tx=Math.floor((v.x0-ox)/size)*size+ox;tx<v.x1;tx+=size)g.drawImage(im.sea_tile,tx,ty,size+.6,size+.6);
   }
   g.restore();
  }
  const deep=g.createLinearGradient(0,Q1,0,H);deep.addColorStop(0,'rgba(10,52,72,0)');deep.addColorStop(.45,'rgba(5,30,52,.22)');deep.addColorStop(1,'rgba(2,12,30,.5)');
  g.fillStyle=deep;g.fillRect(v.x0,y0,v.x1-v.x0,v.y1-y0);
  /* glints: one to a cell, each on its own beat */
  const cell=230;g.fillStyle='#f2fdff';
  for(let j=Math.floor(y0/cell);j*cell<v.y1;j++)for(let i=Math.floor(v.x0/cell);i*cell<v.x1;i++){
   const h=Math.sin(i*127.1+j*311.7)*43758.5453,f=h-Math.floor(h),h2=Math.sin(i*269.5+j*183.3)*24634.6345,f2=h2-Math.floor(h2);
   const a=Math.sin(time*(1.1+f*1.4)+f2*TAU);if(a<.55)continue;
   const x=(i+f)*cell,y=(j+f2)*cell,s=(a-.55)*16;if(y<y0+20)continue;
   g.globalAlpha=(a-.55)*1.7;g.beginPath();g.moveTo(x-s,y);g.lineTo(x,y-s*.45);g.lineTo(x+s,y);g.lineTo(x,y+s*.45);g.closePath();g.fill();
  }
  g.globalAlpha=1;
 }
 function timberPier(g,im,v,rc,time,seed,{turn=false,old=false}={}){
  if(rc.x+rc.w+40<v.x0||rc.x-40>v.x1||rc.y+rc.h+60<v.y0||rc.y-20>v.y1)return;
  g.fillStyle='rgba(2,14,26,.34)';g.fillRect(rc.x+12,rc.y+16,rc.w,rc.h+8);                       /* its shadow on the water */
  g.fillStyle=old?'#2a1d12':'#3a2917';g.fillRect(rc.x,rc.y+rc.h-2,rc.w,24);                        /* the end grain and cross-beam under the far edge */
  g.fillStyle='rgba(0,0,0,.35)';for(let x=rc.x+14;x<rc.x+rc.w-8;x+=44)g.fillRect(x,rc.y+rc.h+2,8,18);
  if(!mirrorTiles(g,im.planks,rc,256,v,turn)){g.fillStyle='#6b5138';g.fillRect(rc.x,rc.y,rc.w,rc.h);}
  if(old){g.fillStyle='rgba(34,22,10,.30)';g.fillRect(rc.x,rc.y,rc.w,rc.h);
   g.fillStyle='rgba(8,24,34,.55)';for(let k=0;k<4;k++){const h=Math.sin((k+seed)*91.7)*9731.1,f=h-Math.floor(h);g.fillRect(rc.x+8+f*(rc.w-60),rc.y+40+((k*.19+f*.3)%1)*(rc.h-80),34+f*30,5);}}   /* a plank or two gone */
  g.strokeStyle=old?'#22170d':'#2e2013';g.lineWidth=7;g.strokeRect(rc.x+3.5,rc.y+3.5,rc.w-7,rc.h-7);
  g.strokeStyle='rgba(255,236,190,.10)';g.lineWidth=2;g.strokeRect(rc.x+9,rc.y+9,rc.w-18,rc.h-18);
 }
 function kerb(g,x,y,w,h,along){   /* dressed stone with the quay's painted grain */
  g.fillStyle='#b7ac93';g.fillRect(x,y,w,h);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x,y,w,Math.min(h,4));
  const im=remembered.quay_paving;
  if(ready(im)){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.globalAlpha=.42;
   for(let yy=y;yy<y+h;yy+=180)for(let xx=x;xx<x+w;xx+=180)g.drawImage(im,xx,yy,180,180);g.restore();}
  g.strokeStyle='rgba(40,32,22,.55)';g.lineWidth=2;g.strokeRect(x,y,w,h);
  g.beginPath();if(along)for(let k=x+58;k<x+w-10;k+=58){g.moveTo(k,y);g.lineTo(k,y+h);}else for(let k=y+58;k<y+h-10;k+=58){g.moveTo(x,k);g.lineTo(x+w,k);}g.stroke();
 }
 function mole(g,im,v,time){
  const s=MOLE.stem,hd=MOLE.head;
  if(s.x+s.w+260<v.x0||s.x-260>v.x1||hd.y+hd.r+40<v.y0||s.y>v.y1)return;
  g.fillStyle='rgba(2,14,26,.34)';g.fillRect(s.x+14,s.y+16,s.w,s.h);ellipse(g,hd.x+14,hd.y+20,hd.r,hd.r,'rgba(2,14,26,.34)');
  g.fillStyle='#5d564a';g.beginPath();g.arc(hd.x,hd.y+22,hd.r,0,Math.PI);g.fill();                 /* the head's seaward face, below its rim */
  g.save();g.beginPath();g.rect(s.x,s.y,s.w,s.h);g.arc(hd.x,hd.y,hd.r,0,TAU);g.clip();
  if(!mirrorTiles(g,im.quay_paving,{x:hd.x-hd.r,y:s.y,w:hd.r*2,h:hd.y+hd.r-s.y},384,v)){g.fillStyle='#7d7563';g.fillRect(hd.x-hd.r,s.y,hd.r*2,hd.y+hd.r-s.y);}
  g.restore();
  kerb(g,s.x,s.y+20,20,hd.y-hd.r*.62-s.y,false);kerb(g,s.x+s.w-20,s.y+20,20,hd.y-hd.r*.62-s.y,false);
  g.strokeStyle='#b7ac93';g.lineWidth=20;g.beginPath();g.arc(hd.x,hd.y,hd.r-10,-.93,Math.PI+.93);g.stroke();
  g.strokeStyle='rgba(40,32,22,.55)';g.lineWidth=2;g.beginPath();g.arc(hd.x,hd.y,hd.r,-.93,Math.PI+.93);g.stroke();g.beginPath();g.arc(hd.x,hd.y,hd.r-20,-.93,Math.PI+.93);g.stroke();
  for(let a=-.8;a<Math.PI+.8;a+=.29){g.beginPath();g.moveTo(hd.x+Math.cos(a)*(hd.r-20),hd.y+Math.sin(a)*(hd.r-20));g.lineTo(hd.x+Math.cos(a)*hd.r,hd.y+Math.sin(a)*hd.r);g.stroke();}
 }
 function quay(g,im,v){
  const rc={x:0,y:Q0-30,w:W,h:Q1-Q0+30};
  if(rc.y>v.y1||rc.y+rc.h+40<v.y0)return;
  g.fillStyle='#4d463b';g.fillRect(QUAY.x,Q1-2,QUAY.w,30);                                          /* the quay wall, seen over its edge */
  g.fillStyle='rgba(0,0,0,.28)';for(let x=QUAY.x+20;x<QUAY.x+QUAY.w;x+=74)g.fillRect(x,Q1+2,3,24);
  if(!mirrorTiles(g,im.quay_paving,{x:QUAY.x,y:rc.y,w:QUAY.w,h:rc.h},400,v)){g.fillStyle='#7d7563';g.fillRect(QUAY.x,rc.y,QUAY.w,rc.h);}
  kerb(g,QUAY.x,Q1-26,QUAY.w,26,true);kerb(g,QUAY.x,Q0,22,QUAY.h-26,false);kerb(g,QUAY.x+QUAY.w-22,Q0,22,QUAY.h-26,false);
  const shade=g.createLinearGradient(0,Q0,0,Q0+190);shade.addColorStop(0,'rgba(8,10,16,.50)');shade.addColorStop(1,'rgba(8,10,16,0)');
  g.fillStyle=shade;g.fillRect(QUAY.x,Q0,QUAY.w,190);                                                 /* the cliff and the houses keep the back of the quay in shade */
  g.strokeStyle='rgba(20,16,10,.8)';g.lineWidth=3;                                                    /* mooring rings let into the kerb */
  for(let x=QUAY.x+150;x<QUAY.x+QUAY.w;x+=300){g.beginPath();g.ellipse(x,Q1-12,7,4.5,0,0,TAU);g.stroke();}
 }
 function cliff(g,im,v){
  if(v.y0>Q0+10)return;
  const c=im.harbor_cliff,tw=CLIFF.tile,rockH=(Q0+6-CLIFF.top)/2+8;   /* two courses of rock fill the cliff exactly, the upper one's foot lapping 16 over the lower one's grass */
  if(ready(c)){
   const course=(srcY,srcH,y,h,shift,odd)=>{
    if(y>v.y1||y+h<v.y0)return;
    for(let i=Math.floor((v.x0-shift)/tw);shift+i*tw<v.x1;i++){
     g.save();g.translate(shift+(i+.5)*tw,0);if((i+odd)%2)g.scale(-1,1);
     g.drawImage(c,CLIFF.trim,srcY,iw(c)-CLIFF.trim*2,srcH,-tw/2-.4,y,tw+.8,h);g.restore();
    }
   };
   course(CLIFF.rockSrc[0]+8,CLIFF.rockSrc[1]-8,Q0+6-rockH,rockH,tw*.5,1);                           /* the lower course first: the upper one's foot lies over its grass */
   course(CLIFF.rockSrc[0],CLIFF.rockSrc[1],CLIFF.top,rockH+2,0,0);
   course(CLIFF.wallSrc[0],CLIFF.wallSrc[1],CLIFF.top-CLIFF.wallH,CLIFF.wallH+1,0,0);
  }else{g.fillStyle='#4a4a46';g.fillRect(v.x0,CLIFF.top,v.x1-v.x0,Q0-CLIFF.top);g.fillStyle='#8a7f6a';g.fillRect(v.x0,CLIFF.top-CLIFF.wallH,v.x1-v.x0,CLIFF.wallH);}
  const a=im.harbor_arrival;
  if(ready(a)&&!(ARRIVAL.x+ARRIVAL.w<v.x0||ARRIVAL.x>v.x1))g.drawImage(a,ARRIVAL.x,ARRIVAL.y,ARRIVAL.w,ARRIVAL.h);
  else if(!ready(a)){g.fillStyle='#8d8672';g.fillRect(FLIGHT.cx-FLIGHT.half1,FLIGHT.y0,FLIGHT.half1*2,FLIGHT.y1-FLIGHT.y0);}
 }
 function renderGround(g,world,view,{images={},time=0}={}){
  remembered={...remembered,...images};const im=remembered;
  const v={x0:Math.max(0,view.x),y0:Math.max(0,view.y),x1:Math.min(W,view.x+view.w),y1:Math.min(H,view.y+view.h)};
  if(!(v.x1>v.x0&&v.y1>v.y0))return;
  g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
  sky(g,v);sea(g,im,v,time);
  if(v.y1>Q1-40){
   foam(g,[[0,Q1+4,0,1],[W,Q1+4,0,1]],time,.4);
   for(const [rc,seed] of [[PIER_A.stem,1.1],[PIER_A.head,2.3],[JETTY.deck,3.7],[MOLE.stem,6.2]])foam(g,rectFoam(rc),time,seed);
   const hd=MOLE.head,ring=[];for(let a=-.7;a<=Math.PI+.71;a+=.2)ring.push([hd.x+Math.cos(a)*hd.r,hd.y+Math.sin(a)*hd.r+(Math.sin(a)>0?20:0),Math.cos(a),Math.sin(a)]);
   foam(g,ring,time,7.7);
  }
  timberPier(g,im,v,PIER_A.stem,time,1);timberPier(g,im,v,PIER_A.head,time,2,{turn:true});
  timberPier(g,im,v,JETTY.deck,time,3,{old:true});
  mole(g,im,v,time);quay(g,im,v);cliff(g,im,v);
  g.restore();
 }

 /* ---------- props sorted with the actors ---------- */
 /* Where each painting sits on its anchor. h (or w, for what is berthed by its length) is the drawn size in world units,
    drop how far below the anchor its bottom edge lands; float makes it ride the water; glow/fire/smoke are in the
    picture's own frame (u across, v down). */
 const ART={
  warehouse:{key:'harbor_warehouse',h:470,drop:16,crx:214,smoke:[[.77,.02,1]]},
  office:{key:'harbor_office',h:430,drop:16,crx:146,smoke:[[.72,.12,.9]],glow:[[.5,.62,150]]},
  tavern:{key:'harbor_tavern',h:440,drop:16,crx:150,smoke:[[.77,.08,1]],glow:[[.42,.55,170]]},
  fishhouse:{key:'harbor_fishhouse',h:380,drop:16,crx:178,smoke:[[.79,.09,1.1]]},
  chandlery:{key:'harbor_chandlery',h:450,drop:16,crx:120,smoke:[[.73,.01,.9]]},
  crane:{key:'harbor_crane',h:430,drop:14,r:40},
  beacon:{key:'harbor_beacon',h:470,drop:18,r:50,glow:[[.5,.20,260]],fire:[.5,.19,1.5]},
  crates:{key:'cargo_crates',h:150,drop:16,r:58},barrels:{key:'cargo_barrels',h:150,drop:12,r:50},loot:{key:'cargo_loot',h:96,drop:10,r:36},
  fishrack:{key:'fish_rack',h:150,drop:12,r:52},anchor:{key:'anchor',h:150,drop:12,r:40},pots:{key:'lobster_pots',h:96,drop:10,r:34},
  upturned:{key:'boat_upturned',h:112,drop:12,r:56},cannon:{key:'cannon',h:74,drop:10,r:34},bollard:{key:'bollard',h:46,drop:8,r:13},
  post:{key:'pier_post',h:88,drop:34},lamp:{key:'lamp',h:150,drop:8,r:9,glow:[[.5,.16,170]]},
  stall_fish:{key:'stall_fish',h:170,drop:14,r:54},stall_cloth:{key:'stall_cloth',h:170,drop:14,r:54},
  galleon:{key:'ship_galleon',w:960,drop:26,float:{amp:5,rot:.008,speed:.62}},
  carrack:{key:'ship_carrack',w:1000,drop:26,float:{amp:4.5,rot:.007,speed:.55}},
  sloop:{key:'ship_sloop',w:520,drop:16,float:{amp:5,rot:.016,speed:.9}},
  rowboat:{key:'rowboat',w:190,drop:26,float:{amp:3,rot:.035,speed:1.3}},
  buoy:{key:'buoy',h:120,drop:6,float:{amp:5,rot:.10,speed:1.15},glow:[[.5,.10,70]]},
  rocks:{key:'sea_rocks',h:210,drop:8,wash:true},wreck:{key:'wreck_mast',h:330,drop:8,wash:true},
 };
 /* the drawn frame of a prop, for the game's walk-behind fade and its sun: {W,H,top} or null while its picture is loading, with the
    picture, where it stands (foot), whether it is mirrored, whether the sea carries it (wet: it throws no shadow) and its glows */
 function frame(s,images){
  const a=ART[s.kind],im=a&&(images||remembered)[a.key];if(!ready(im))return null;
  const Hh=a.h||a.w*ih(im)/iw(im),Ww=a.w||a.h*iw(im)/ih(im);
  return {W:Ww,H:Hh,top:a.drop-Hh,im,foot:a.drop,flip:!!s.flip,wet:!!(a.float||a.wash||s.kind==='post'),glow:a.glow||null};
 }
 function drawShadow(g,s){
  const a=ART[s.kind];if(!a||a.float||a.wash||s.kind==='post')return;
  const rx=a.crx?a.crx*1.04:(a.r||24)*1.5;
  ellipse(g,rx*.08,4,rx,Math.max(7,rx*.22),'rgba(0,0,0,.27)');
 }
 function waterline(g,Ww,time,seed,y=0){   /* broken foam where a hull or a rock meets the sea */
  g.save();g.lineCap='round';g.strokeStyle='rgba(236,250,255,.6)';g.lineWidth=Math.max(2.5,Math.min(5,Ww*.006));
  g.setLineDash([Ww*.05,Ww*.035,Ww*.02,Ww*.045]);g.lineDashOffset=time*11+seed*30;
  g.beginPath();g.ellipse(0,y+2,Ww*.47,Math.max(3,Ww*.018),0,0,Math.PI);g.stroke();
  g.strokeStyle='rgba(236,250,255,.26)';g.lineDashOffset=-time*7+seed*11;
  g.beginPath();g.ellipse(0,y+4,Ww*.52+Math.sin(time*1.2+seed)*Ww*.012,Math.max(5,Ww*.03),0,0,Math.PI);g.stroke();
  g.setLineDash([]);g.restore();
 }
 function drawProp(g,s,time=0,images={},options={}){
  remembered={...remembered,...images};
  const a=ART[s.kind],im=a&&remembered[a.key];
  if(!a)return;
  if(!ready(im)){g.fillStyle='rgba(90,70,50,.55)';g.fillRect(-(a.r||20),-(a.h||60)*.5,(a.r||20)*2,(a.h||60)*.5);return;}   /* a stand-in for the frame or two before the picture is there */
  const f=frame(s,remembered),Ww=f.W,Hh=f.H,seed=s.seed||s.x*.013+s.y*.007,flip=s.flip?-1:1,alpha=options.alpha===undefined?1:options.alpha;
  if(a.float||a.wash)ellipse(g,Ww*.02,8,Ww*.47,Math.max(6,Ww*.04),'rgba(2,14,26,.30)');
  g.save();
  if(a.float){g.translate(0,Math.sin(time*a.float.speed+seed*2.3)*a.float.amp);g.rotate(Math.sin(time*a.float.speed*.63+seed*1.7)*a.float.rot);}
  g.scale(flip,1);
  if(a.float&&Ww>300){   /* a hint of the hull in the water under it */
   g.save();g.globalAlpha=.13*alpha;g.translate(0,a.drop*2-6);g.scale(1,-.55);g.drawImage(im,0,ih(im)*.72,iw(im),ih(im)*.28,-Ww/2,-Hh*.28+a.drop,Ww,Hh*.28);g.restore();
  }
  g.globalAlpha*=alpha;g.drawImage(im,-Ww/2,a.drop-Hh,Ww,Hh);g.globalAlpha=1;
  if(a.smoke){g.globalAlpha=alpha;for(const [u,vv,k] of a.smoke)smoke(g,-Ww/2+u*Ww,a.drop-Hh+vv*Hh,k,time,seed+u*7);g.globalAlpha=1;}
  if(a.fire)fire(g,-Ww/2+a.fire[0]*Ww,a.drop-Hh+a.fire[1]*Hh,a.fire[2],time,seed);
  if(a.glow)for(const [u,vv,r] of a.glow)light(g,-Ww/2+u*Ww,a.drop-Hh+vv*Hh,r,(.8+Math.sin(time*5.1+seed*3)*.2)*alpha);
  g.restore();
  if(a.float||a.wash)waterline(g,Ww*(a.wash?.8:.94),time,seed,a.float?0:2);
 }
 /* 🕊 birds on slow ellipses, each with its shadow on whatever is below. One [cx,cy,rx,ry,w,phase]
    per bird (w in radians per second, negative to circle the other way). The Harbour's gulls fly
    it, and Odin's ravens borrow it with their own picture; `ink` is the glyph drawn until that loads. */
 function drawFlight(g,birds,view,time=0,im=null,size=62,ink='#eef4f6'){
  for(const [cx,cy,rx,ry,w,ph] of birds){
   const t=time*w+ph,x=cx+Math.cos(t)*rx,y=cy+Math.sin(t)*ry;
   if(x<view.x-120||x>view.x+view.w+120||y<view.y-160||y>view.y+view.h+60)continue;
   const heading=Math.atan2(Math.cos(t)*ry*Math.sign(w),-Math.sin(t)*rx*Math.sign(w)),beat=1+Math.sin(time*7+ph*5)*.07;
   ellipse(g,x+70,y+120,22,8,'rgba(0,0,0,.16)');
   g.save();g.translate(x,y);g.rotate(heading+Math.PI/2);g.scale(beat,1);
   if(ready(im))g.drawImage(im,-size/2,-size*ih(im)/iw(im)/2,size,size*ih(im)/iw(im));
   else{g.strokeStyle=ink;g.lineWidth=3;g.beginPath();g.moveTo(-18,4);g.quadraticCurveTo(-8,-8,0,0);g.quadraticCurveTo(8,-8,18,4);g.stroke();}
   g.restore();
  }
 }
 /* 🕊 gulls over everything: seven birds over the basin */
 const GULLS=Object.freeze([[1500,2500,620,300,.13,0],[2900,2350,560,340,-.11,1.7],[2200,1750,900,180,.09,3.1],[3700,2800,380,260,.16,4.4],[800,3000,420,240,-.14,5.2],[2250,3150,300,180,.19,2.2],[3300,1700,500,150,-.08,.9]]);
 function drawSky(g,world,view,time=0,images={}){
  remembered={...remembered,...images};drawFlight(g,GULLS,view,time,remembered.seagull);
 }
 const IMAGES=Object.freeze([...new Set(Object.values(ART).map(a=>a.key).filter(k=>!['lamp','stall_fish','stall_cloth'].includes(k))),'harbor_arrival','harbor_cliff','sea_tile','quay_paving','planks','seagull']);
 const CITY_IMAGES=Object.freeze(['lamp','stall_fish','stall_cloth']);   /* these three are the City's own paintings */

 /* the minimap's picture of the Harbour (assets/ui/city-minimap.js), in world units: the sea, the cliff with the City's
    wall along its top and the blue-carpeted flight up to the gate, the quay with its houses, the three piers and the hulls */
 function paintMap(g){
  g.fillStyle='#1d4d63';g.fillRect(0,0,W,H);
  g.fillStyle='#2e3329';g.fillRect(0,0,W,CLIFF.top-CLIFF.wallH);
  g.fillStyle='#8c8970';g.fillRect(0,CLIFF.top-CLIFF.wallH,W,CLIFF.wallH);
  g.fillStyle='#55504a';g.fillRect(0,CLIFF.top,W,Q0-CLIFF.top);
  g.fillStyle='#b3a994';g.beginPath();g.moveTo(FLIGHT.cx-FLIGHT.half0,CLIFF.top-CLIFF.wallH);g.lineTo(FLIGHT.cx+FLIGHT.half0,CLIFF.top-CLIFF.wallH);
  g.lineTo(FLIGHT.cx+FLIGHT.half1,Q0+24);g.lineTo(FLIGHT.cx-FLIGHT.half1,Q0+24);g.closePath();g.fill();
  g.fillStyle='#22345a';g.fillRect(FLIGHT.cx-34,CLIFF.top-CLIFF.wallH,68,Q0+24-(CLIFF.top-CLIFF.wallH));
  g.fillStyle='#b3a994';g.fillRect(QUAY.x,QUAY.y,QUAY.w,QUAY.h);
  const rect=rc=>g.fillRect(rc.x,rc.y,rc.w,rc.h);
  g.fillStyle='#7a5a3a';rect(PIER_A.stem);rect(PIER_A.head);rect(JETTY.deck);rect(JETTY.lower);
  g.fillStyle='#a39b88';rect(MOLE.stem);g.beginPath();g.arc(MOLE.head.x,MOLE.head.y,MOLE.head.r,0,TAU);g.fill();
  for(const h of HOUSES){const w=ART[h.kind].crx*2.1,hh=Math.min(ART[h.kind].h*.5,w*.62),x=h.x-w/2,y=Q0+44-hh-12;
   g.fillStyle='rgba(16,14,10,.5)';g.fillRect(x+26,y+22,w,hh);g.fillStyle='#7a644c';g.fillRect(x,y,w,hh);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x,y,w,hh*.28);}
  for(const s of SHIPS){const a=ART[s.kind];if(!a||(a.w||0)<300)continue;g.fillStyle='#5b4029';g.beginPath();g.ellipse(s.x,s.y-24,a.w*.42,a.w*.1,0,0,TAU);g.fill();}
  return true;
 }
 return Object.freeze({create,contains,renderGround,drawProp,drawShadow,drawSky,drawFlight,frame,paintMap,
  W,H,XC,Q0,Q1,QUAY,ARRIVAL,FLIGHT,EXIT,EXIT_Y,SPAWN,CLIFF,PIER_A,MOLE,JETTY,LANES,CROSS,HOUSES,SHIPS,FOLK,TALK,HARBOUR_MASTER,ART,IMAGES,CITY_IMAGES});
});
