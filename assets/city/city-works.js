/* 🏗 What the Crown Ledger looks like from the street. The ledger (economy.js) decides; this module
 * shows it, so a steward can walk the boulevard and SEE how the city is doing without opening a book:
 *  - public works: scaffolding over a house while a crew is on it, then a signboard and a pennant;
 *    lamps down the boulevard, a fountain and a statue on the great square, gardens in the yard beside it
 *  - the market: as many awnings on the square as the fees and the covered market allow
 *  - traffic on the boulevard: trade wagons (as many as the trade works have earned), and handcarts
 *    of families moving in from the gate - or out through it - as the city's name rises and falls
 *  - bunting when the festivals are funded, refuse and flies when the sweepers are not
 *  - boarded-up houses as the population falls
 *  - the temper of the people: houses on fire, barricades on the boulevard, a bread queue and beggars
 *    at the kerb when it goes badly; tubs of flowers and garlands on the houses, a maypole, fiddlers,
 *    long tables laid in the square and fireworks over it when it goes well
 *  - the season: snow in a hard winter, crosses on the doors in the sickness, show tents for the fair
 * Pure functions of a small `look` object and the time: no state of its own, no DOM, no images, so
 * it runs headless in the tests. game.js adds the props to world.solids (type 'citywork'), hangs a
 * `work` on the houses that carry a sign, and calls the draw routines from its own passes. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./scenery-effects.js'):root.CityScenery,typeof module==='object'&&module.exports?require('./traffic-animation.js'):root.CityTrafficAnimation);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CityWorks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Scenery,TrafficAnimation){
 'use strict';
 const TAU=Math.PI*2;
 /* where each house-work wants to stand; the nearest free terrace house to the point wears its sign */
 const ANCHORS=Object.freeze({
  carters:[1500,2300],caravanserai:[1900,2950],quay:[13500,4300],customs:[14700,2950],fleet:[13900,3700],exchange:[9300,2250],
  school:[4300,2250],apprentice:[6500,3700],library:[7500,2250],press:[7000,1500],university:[10000,1500],
  bathhouse:[5000,3700],hospital:[10500,3700],tenements:[3300,4300],newquarter:[14800,1500],
  theatre:[9800,2950],arena:[12000,1500],courthouse:[6900,2950],
  brothel:[12700,4300],      /* appended last, so no house that already wears a sign changes hands */
 });
 const TINT=Object.freeze({trade:'#7fc4e8',learn:'#c9a0e8',living:'#9adf9a',culture:'#ffb46a',order:'#d8d2c4'});
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const hash=(a,b)=>{let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663)^0x5f3a)>>>0;h=Math.imul(h^(h>>>15),2246822519)>>>0;return (h^(h>>>13))>>>0;};
 function rect(g,x,y,w,h,fill,stroke,width=1){g.beginPath();g.rect(x,y,w,h);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
 function ellipse(g,x,y,rx,ry,fill,stroke,width=1){g.beginPath();g.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
 function label(g,text,x,y,color,size=13){
  g.save();g.font='700 '+size+'px Georgia, serif';g.textAlign='center';
  g.fillStyle='rgba(0,0,0,.78)';g.fillText(text,x+1,y+1);g.fillStyle=color;g.fillText(text,x,y);g.restore();
 }

 /* A painted board - the only lettering a house or a plot carries. Nothing floats over a roof:
    what a place is called is written ON it, the way a town does it. */
 function board(g,text,x,y,width,ink='#f0e2c4',wood='#3a2410'){
  const size=clamp(Math.floor(width*1.55/Math.max(6,text.length)),6,10),h=size+8;
  rect(g,x-width/2,y,width,h,wood,'#15100b',2);rect(g,x-width/2+2.5,y+2.5,width-5,h-5,'#5a3a1e');
  g.save();g.font='700 '+size+'px Georgia, serif';g.textAlign='center';g.fillStyle=ink;g.fillText(text,x,y+h/2+size*.36);g.restore();
  return h;
 }

 /* ---------- the plan: what stands where for a given look ---------- */
 /* look = {works:{id:'building'|'done'},left:{id:n},stalls:n,clean:0-3,festival:0-3,wagons:n,migrants:-3..3,
            vacancy:0-1,crowned:bool,hero:'name',xMax:n}. geometry comes from the world itself. */
 function square(world){const p=(world.plazas&&world.plazas[0])||{x:world.w/2,y:world.h/2,r:520};return {x:p.x,y:p.y,r:p.r};}
 function stallSlots(world){
  const c=square(world),out=[[-205,215],[-310,262],[-395,196],[-250,300]].map(([dx,dy])=>({x:c.x+dx,y:c.y+dy}));
  for(let k=0;k<4;k++)for(const side of [-1,1])out.push({x:c.x+side*(660+k*170),y:c.y+(k%2?1:-1)*side*118});
  /* 🧺 a growing city fills its square: pitches round the rim, clear of the wagons' lane, the fountain, the statue,
     the maypole, the crier and the long tables - and then further out along the boulevard. Appended, so the first
     twelve pitches never move. The third of these stood in the north-west yard until the gardens were laid there
     (2026-09-24); it has the notice board's old place on the square now. */
  for(const [dx,dy] of [[-380,-160],[335,-165],[-6,190],[452,192],[-140,-188]])out.push({x:c.x+dx,y:c.y+dy});
  for(let k=4;k<7;k++)for(const side of [-1,1])out.push({x:c.x+side*(660+k*170),y:c.y+(k%2?1:-1)*side*118});
  return out;
 }
 function lampSpots(world,xMax){
  const c=square(world),out=[];
  for(let x=900;x<=Math.min(xMax||world.w-1300,world.w-600);x+=520){
   if(Math.abs(x-c.x)<c.r+60)continue;
   out.push({x,y:c.y-130},{x:x+260,y:c.y+130});
  }
  for(const [dx,dy] of [[-190,-172],[190,-172],[-190,172],[190,172]])out.push({x:c.x+dx,y:c.y+dy});
  const pitches=stallSlots(world);        /* a post never stands in a market pitch, taken or not */
  return out.filter(p=>!pitches.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<70));
 }
 /* 🚩 the Royal Banners: one opposite every lamp-post down the boulevard, so posts and poles take turns on each kerb */
 function bannerSpots(world,xMax){
  const c=square(world),out=[];
  for(let x=900;x<=Math.min(xMax||world.w-1300,world.w-600);x+=520){
   if(Math.abs(x-c.x)<c.r+60)continue;
   out.push({x:x+260,y:c.y-136},{x,y:c.y+136});
  }
  const pitches=stallSlots(world);
  return out.filter(p=>!pitches.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<70)&&Math.abs(p.x-c.x)>=c.r+60);
 }
 /* the props a look asks for, as solids ready for world.solids. Small collision circles: you walk
    round a fountain, you brush past a lamp-post. */
 function props(world,look){
  const c=square(world),out=[],works=look.works||{},st=id=>works[id];
  const add=(kind,x,y,r,extra)=>out.push({type:'citywork',kind,x,y,r,seed:hash(x,y)%1000,...extra});
  const site=(id,x,y,name)=>add('site',x,y,34,{work:id,name,left:(look.left||{})[id]||1});
  const going=id=>st(id)==='building';          /* a work the bank has sold leaves nothing on the square */
  if(st('aqueduct')==='done')add('fountain',c.x-270,c.y-250,46);else if(going('aqueduct'))site('aqueduct',c.x-270,c.y-250,'FOUNTAIN');
  if(st('statue')==='done')add('statue',c.x+270,c.y-250,26,{crowned:!!look.crowned,hero:look.hero||''});else if(going('statue'))site('statue',c.x+270,c.y-250,'STATUE');
  /* 🌳 the gardens are laid in the yard beside the stone house at the square's north-west corner, off the square (2026-09-24) */
  if(st('gardens')==='done')add('garden',c.x-265,c.y-460,20,{noCol:true});else if(going('gardens'))site('gardens',c.x-265,c.y-460,'GARDENS');   /* beside the corner house as it stands since the houses grew (2026-09-25) */
  if(st('coveredmarket')==='building')site('coveredmarket',c.x-300,c.y+330,'COVERED MARKET');
  if(st('lamps')==='done'||going('lamps'))for(const p of lampSpots(world,look.xMax))add('lamp',p.x,p.y,7,{lit:st('lamps')==='done',noCol:true});
  if(st('banners')==='done')for(const p of bannerSpots(world,look.xMax))add('banner',p.x,p.y,7,{noCol:true});
  stallSlots(world).slice(0,clamp(Math.round(look.stalls||0),0,MAX_STALLS)).forEach((p,i)=>add('stall',p.x,p.y,24,{goods:i%5,covered:st('coveredmarket')==='done'}));
  /* 🎭 what the temper of the people puts out on the street. None of it is in anybody's way (noCol). */
  const S=look.street||{},soft=(kind,x,y,extra)=>add(kind,x,y,18,{noCol:true,...extra});
  if(S.maypole)soft('maypole',c.x,c.y-300);
  if(S.music)soft('music',c.x+150,c.y-250);
  if(S.feast)for(let i=0;i<clamp(S.feast|0,0,2);i++)soft('feast',c.x+20,c.y+318+i*112,{row:i});
  if(S.tents){soft('tent',c.x+430,c.y-215,{stripe:0});soft('tent',c.x+295,c.y+260,{stripe:1});}   /* the blue one pitches where the gardens stood, now they have the yard it used */
  if(S.breadline)soft('breadline',c.x-775,c.y-168,{long:S.breadline>1});                        /* the baker's hatch just short of the notice board */
  if(S.barricades)for(const side of [-1,1])for(const row of [-1,1])soft('barricade',c.x+side*(c.r+380),c.y+row*96,{flip:side*row});
  for(let k=0;k<clamp(S.beggars|0,0,8);k++){const x=1250+k*1490+(k%2)*380;if(x<(look.xMax||world.w-1300)&&Math.abs(x-c.x)>c.r+60)soft('beggar',x,c.y+(k%2?1:-1)*152,{face:k%2?-1:1});}
  return out;
 }
 /* which terrace house wears which work: nearest free house to each anchor, the same one every visit */
 function assignHouses(world,look){
  const houses=(world.solids||[]).filter(s=>s.type==='cityhouse'),taken=new Set(),out=[];
  for(const id of Object.keys(ANCHORS)){
   const status=(look.works||{})[id];
   const [ax,ay]=ANCHORS[id];let best=null,bd=Infinity;
   for(const h of houses){if(taken.has(h))continue;const d=Math.hypot(h.x-ax,h.y-ay);if(d<bd){bd=d;best=h;}}
   if(!best)continue;
   taken.add(best);                       /* reserved whether or not it is built, so building one never moves another */
   if(status)out.push({house:best,id,status,left:(look.left||{})[id]||0});
  }
  return out;
 }
 /* 🎭 What the people put out, as a function of a few numbers game.js reads off the ledger:
    mood 0-100, festival and relief 0-3, protest, hungry 0 none / 1 a bread queue / 2 the granary is empty,
    card the season's id. Returns what props() places. */
 function streetLife(v){
  const mood=v.mood===undefined?60:v.mood,joy=mood>=85?2:mood>=70?1:0,festival=v.festival|0;
  return {maypole:!v.protest&&(joy===2||(festival>=2&&mood>=55)),music:!v.protest&&mood>=55&&festival+joy>=2,
   feast:v.protest||v.hungry?0:(v.relief>=3?1:0)+(joy===2?1:0),tents:v.card==='fair',
   breadline:v.hungry|0,barricades:!!v.protest,beggars:clamp((v.relief===0?3:0)+(v.hungry?2+v.hungry:0)+(mood<40?2:0),0,8)};
 }
 /* how hard the city burns, 0-4: a riot, a temper at the bottom, nobody to carry a bucket, a gang war - and last close's fire still smoulders */
 function fireLevel(v){return clamp((v.protest?2:0)+(v.mood<25?1:0)+(v.watch===0?1:0)+(v.gang?1:0)+(v.fireNews?1:0),0,4);}
 /* what one house wears, the same from every frame and every visit until the ledger closes again:
    'fire' | 'plague' | 'garland' | 'flowers' | null. A house with a work or a FOR RENT board wears nothing else. */
 function dressing(house,look){
  if(!look||house.work)return null;
  const hx=Math.round(house.x),hy=Math.round(house.y),roll=(salt)=>(hash(hx+salt*7919,hy-salt*104729)%1000)/1000;
  if(look.fires>0&&roll(1+(look.fireSeed|0))<look.fires*.012)return 'fire';
  if(look.vacancy>0&&vacant(house,look.vacancy))return null;
  if(look.card==='sickness'&&roll(3)<.09)return 'plague';
  if(look.joy>0&&roll(5)<(look.joy>1?.6:.28))return look.joy>1&&roll(6)<.5?'garland':'flowers';
  return null;
 }
 /* how many awnings the square carries */
 const MAX_STALLS=23;
 function stallCount(feeLevel,covered,pop){return clamp([6,4,3,1][clamp(feeLevel|0,0,3)]+(covered?5:0)+Math.floor(Math.max(0,(pop||0)-350)/100),0,MAX_STALLS);}   /* a pitch more for every 100 souls over the 350 the books open on */
 /* traffic on the boulevard, as pure functions of time: wagons both ways, handcarts one way */
 function traffic(world,look,time){
  const c=square(world),x0=420,x1=(look.xMax||world.w-1300)+200,span=x1-x0,out=[];
  const n=clamp(look.wagons|0,0,8),m=clamp(look.migrants|0,-4,4);
  for(let k=0;k<n;k++){
   const dir=k%2?-1:1,speed=62+((k*37)%23),s=((time*speed+k*span/Math.max(1,n)+k*211)%span+span)%span;
   const x=dir>0?x0+s:x1-s;
   out.push({kind:'wagon',x,y:c.y+dir*-52+((k*13)%9-4),dir,speed,cargo:k%4,seed:k,fade:clamp(Math.min(x-x0,x1-x)/160,0,1)});
  }
  for(let k=0;k<Math.abs(m);k++){
   const dir=m>0?1:-1,speed=34+((k*29)%11),s=((time*speed+k*span/Math.abs(m)+k*977)%span+span)%span;
   const x=dir>0?x0+s:x1-s;
   out.push({kind:'handcart',x,y:c.y+dir*-96+((k*7)%11-5),dir,speed,leaving:m<0,seed:k+20,fade:clamp(Math.min(x-x0,x1-x)/160,0,1)});
  }
  return out;
 }

 /* ---------- drawing: props sorted with the actors ---------- */
 function drawShadow(g,s){
  const footprints={fountain:[0,26,66,18],statue:[0,7,34,10],stall:[0,8,48,11],lamp:[0,4,10,4],site:[0,25,54,14],tent:[0,13,110,24],feast:[0,38,132,22],barricade:[0,14,88,18],maypole:[0,6,20,6],noticeboard:[0,6,46,8]};
  const foot=footprints[s.kind];if(foot)Scenery.shadow(g,...foot,.24);
 }
 /* ---------- the people's own doing: small figures, and what they put out ---------- */
 const COATS=['#7a4a3a','#4f6a8c','#5a7a4a','#8a6a3a','#6a4a7a','#8c4a4a','#4a6a6a'];
 /* a townsperson the size of the ones on the handcarts. o: coat, step (leg swing), sit, arm (raised, radians), hat */
 function fig(g,x,y,o={}){
  const st=o.step||0,coat=o.coat||COATS[0],lift=o.sit?7:0;
  if(!o.sit){rect(g,x-4,y-16,3.5,16+st,'#3a2a1a');rect(g,x+.5,y-16,3.5,16-st,'#3a2a1a');}
  else rect(g,x-5,y-9,10,4,'#3a2a1a');
  rect(g,x-5,y-33+lift,10,18,coat);
  if(o.arm!==undefined){g.save();g.strokeStyle=coat;g.lineWidth=3.2;g.lineCap='round';g.beginPath();g.moveTo(x+4,y-30+lift);g.lineTo(x+4+Math.cos(o.arm)*11,y-30+lift-Math.sin(o.arm)*11);g.stroke();g.restore();}
  ellipse(g,x,y-38+lift,5,5.5,'#e0b890');
  if(o.hat)rect(g,x-6,y-45+lift,12,4,o.hat);
 }
 function maypole(g,s,time){
  const H=172,n=8,ring=i=>{const a=time*.7+i/n*TAU;return {x:Math.cos(a)*62,y:Math.sin(a)*22,a};};
  const dancer=i=>{const p=ring(i);fig(g,p.x,p.y+4,{coat:COATS[i%COATS.length],step:Math.sin(time*7+i)*3,arm:1.2});};
  const ribbon=i=>{const p=ring(i);g.beginPath();g.moveTo(0,-H+8);g.quadraticCurveTo(p.x*.35,-H*.45+p.y,p.x+4,p.y-34);g.strokeStyle=['#a8322f','#f0e2c4','#2f6a8c','#e5c05a'][i%4];g.lineWidth=2;g.stroke();};
  for(let i=0;i<n;i++)if(Math.sin(ring(i).a)<0){ribbon(i);dancer(i);}
  rect(g,-3.5,-H,7,H,'#e9dcb8','#4a2d17',1.2);
  for(let k=0;k<9;k++)rect(g,-3.5,-H+10+k*18,7,7,k%2?'#a8322f':'#2f6a8c');
  ellipse(g,0,-H+4,20,7,null,'#3f7d48',5);for(let i=0;i<8;i++){const a=i/8*TAU;ellipse(g,Math.cos(a)*20,-H+4+Math.sin(a)*7,3,3,['#e8607a','#f0c84a','#f4f0e0'][i%3]);}
  ellipse(g,0,-H-6,5,5,'#e5c05a','#6d4d12',1.2);
  for(let i=0;i<n;i++)if(Math.sin(ring(i).a)>=0){ribbon(i);dancer(i);}
 }
 function music(g,s,time){
  const bow=Math.sin(time*6)*5,beat=Math.abs(Math.sin(time*4));
  fig(g,-16,0,{coat:'#6a3f86',hat:'#2b2622'});rect(g,-13,-31,14,5,'#8a5a2b','#2a1a0c',1);        /* the fiddle, and the bow across it */
  g.save();g.strokeStyle='#f0e2c4';g.lineWidth=1.4;g.beginPath();g.moveTo(-14+bow,-36);g.lineTo(2+bow,-24);g.stroke();g.restore();
  fig(g,18,2,{coat:'#3f7d48',arm:.4+beat*.9});ellipse(g,27,-16,9,5,'#e9dcb8','#4a2d17',1.5);rect(g,18,-16,18,12,'#a8322f','#2a1a0c',1);
  fig(g,50,-4,{coat:'#b9822a',sit:true});rect(g,55,-40,3,22,'#5a3a1e');                            /* and a piper on a stool */
  for(let i=0;i<3;i++){const p=(time*.45+i/3)%1;label(g,i%2?'♪':'♫',-6+i*26+Math.sin(time*2+i)*6,-54-p*44,'rgba(255,236,170,'+(1-p).toFixed(3)+')',14);}
  rect(g,-4,6,14,5,'#2b2622');ellipse(g,3,6,5,2,'#e5c05a');                                          /* the hat, and what is in it */
 }
 function feast(g,s,time){
  for(let i=0;i<6;i++)fig(g,-80+i*32,-10,{coat:COATS[(i+s.seed)%COATS.length],sit:true,arm:(i+(s.seed|0))%3===0?1.1+Math.sin(time*3+i)*.4:undefined});
  rect(g,-96,-24,192,20,'#f4f0e0','#8a8270',1.5);rect(g,-96,-6,192,5,'#d8d0bc');
  for(const x of [-88,-30,30,84])rect(g,x,-2,5,14,'#5a3a1e');
  for(let i=0;i<7;i++){const x=-82+i*27;
   if(i%3===0){ellipse(g,x,-17,10,5,'#c9904a','#6b4320',1);}                                         /* a loaf */
   else if(i%3===1){ellipse(g,x,-16,11,5.5,'#d8c8a0','#6b5a3a',1);ellipse(g,x,-18,7,3.5,'#a8522f');} /* a roast on a dish */
   else{rect(g,x-4,-24,8,10,'#8a8478','#3a362f',1);ellipse(g,x+9,-15,4,3,'#e8607a');}}               /* a tankard, and an apple */
  rect(g,-90,8,180,5,'#6d4a28','#2a1a0c',1);rect(g,-84,13,4,8,'#4a2d17');rect(g,80,13,4,8,'#4a2d17'); /* the near bench */
  for(let i=0;i<4;i++)fig(g,-62+i*40,8,{coat:COATS[(i*3+s.seed+2)%COATS.length],sit:true});
 }
 function tent(g,s,time){
  const a=s.stripe?'#2f6a8c':'#a8322f',b='#f0e2c4',W=78,Hh=120;
  for(let i=0;i<8;i++){const x0=-W+i*W/4,x1=x0+W/4;g.beginPath();g.moveTo(x0,-44);g.lineTo(x1,-44);g.lineTo(x1*.12,-Hh);g.lineTo(x0*.12,-Hh);g.closePath();g.fillStyle=i%2?b:a;g.fill();}
  for(let i=0;i<8;i++){const x0=-W+i*W/4;rect(g,x0,-44,W/4,44,i%2?a:b);ellipse(g,x0+W/8,-44,W/8,5,i%2?b:a);}
  g.beginPath();g.moveTo(-14,0);g.lineTo(-10,-34);g.lineTo(10,-34);g.lineTo(14,0);g.closePath();g.fillStyle='#2a1a0c';g.fill();
  rect(g,-1.5,-Hh-26,3,28,'#3a2410');const sw=Math.sin(time*2.4+s.seed)*3;
  g.beginPath();g.moveTo(1.5,-Hh-26);g.lineTo(24,-Hh-20+sw);g.lineTo(1.5,-Hh-13);g.closePath();g.fillStyle='#e5c05a';g.fill();
  board(g,s.stripe?'THE GREAT FAIR':'WONDERS · ONE PENNY',0,-62,84,'#ffd27a');
 }
 function breadline(g,s,time){
  /* a shuttered bakers' hatch, and the queue that has been at it since before dawn */
  rect(g,56,-52,46,52,'#6d4a28','#2a1a0c',2);rect(g,62,-44,34,20,'#3a2410','#15100b',1.5);g.save();g.font='700 7px Georgia, serif';g.textAlign='center';g.fillStyle='#e6dbc9';g.fillText('NO BREAD',79,-12);g.restore();
  const n=s.long?9:5;
  for(let i=0;i<n;i++){const sh=Math.max(0,Math.sin(time*.8-i*.7))*3;fig(g,40-i*19+sh,(i%2)*5,{coat:COATS[(i*2+1)%COATS.length],step:sh*.6,hat:i%3===0?'#3a2a1a':undefined});}
  if(s.long)label(g,'“Bread!”',-60+Math.sin(time*1.4)*4,-56,'#ff8a7a',11);
 }
 function beggar(g,s,time){
  g.save();g.scale(s.face||1,1);
  rect(g,-16,-4,30,8,'#5d5034');fig(g,0,2,{coat:'#5d5668',sit:true,arm:.15+Math.sin(time*1.6+s.seed)*.2});
  ellipse(g,18,-2,6,2.6,'#8a8270','#3a362f',1);
  g.restore();
 }
 function barricade(g,s,time){
  g.save();g.scale(s.flip||1,1);
  g.save();g.translate(-18,-14);g.rotate(-.5);rect(g,-34,-12,68,22,'#6d4a28','#2a1a0c',2);g.restore();                       /* a cart on its side */
  ellipse(g,-44,-30,13,13,'#3a2410','#15100b',2);ellipse(g,-44,-30,3,3,'#8a5a2b');
  for(const [x,y] of [[22,-2],[44,0],[32,-22]]){ellipse(g,x,y-10,10,12,'#7a5230','#2a1a0c',1.5);rect(g,x-10,y-14,20,2.5,'#2f2a26');rect(g,x-10,y-6,20,2.5,'#2f2a26');}
  for(let i=0;i<4;i++){g.save();g.translate(-6+i*9,-8);g.rotate(-1.1+i*.22);rect(g,0,-2,58,4,'#8a5a2b','#2a1a0c',1);g.restore();}
  g.restore();
  const f=.7+Math.sin(time*9+s.seed)*.3;rect(g,2,-64,3,26,'#3a2410');ellipse(g,3.5,-68,5*f,8*f,'rgba(255,170,60,.9)');ellipse(g,3.5,-66,2.5,4,'#ffe9a8');   /* a torch */
  g.save();g.translate(8,-52);const sw=Math.sin(time*2+s.seed)*.12;g.rotate(sw);rect(g,0,0,30,16,'#7a1b1b','#2a0a0a',1);g.restore();
 }
 /* the banner's stand-in while its painting loads (and in the headless tests): a pole and a swallow-tailed crimson silk */
 function banner(g,s,time){
  rect(g,-6,-6,12,7,'#2b2622','#0d0b0a',1.5);rect(g,-2,-236,4,232,'#5a4630');ellipse(g,0,-238,5,5,'#d9b24a');
  const k=Math.sin(time*1.7+s.seed*.02)*10;
  g.beginPath();g.moveTo(2,-226);g.lineTo(58+k*.4,-222);g.lineTo(60+k,-150);g.lineTo(31+k*.7,-164);g.lineTo(2,-150);g.closePath();
  g.fillStyle='#8a1f27';g.fill();g.strokeStyle='#d3ad55';g.lineWidth=2;g.stroke();
 }
 function lamp(g,s,time){
  rect(g,-7,-6,14,8,'#2b2622','#0d0b0a',1.5);rect(g,-2.5,-92,5,88,'#33302c');rect(g,-2.5,-92,1.6,88,'rgba(255,255,255,.18)');
  rect(g,-16,-96,32,4,'#33302c');
  g.beginPath();g.moveTo(-9,-96);g.lineTo(-7,-118);g.lineTo(7,-118);g.lineTo(9,-96);g.closePath();
  g.fillStyle=s.lit?'rgba(255,214,130,.92)':'rgba(70,74,78,.75)';g.fill();g.strokeStyle='#1d1a17';g.lineWidth=1.6;g.stroke();
  g.beginPath();g.moveTo(-10,-118);g.lineTo(0,-128);g.lineTo(10,-118);g.closePath();g.fillStyle='#2b2622';g.fill();
  if(!s.lit)return;
  const f=.85+Math.sin(time*5.1+s.seed)*.15;
  const glow=g.createRadialGradient(0,-106,0,0,-106,96);
  glow.addColorStop(0,'rgba(255,206,120,'+(.34*f).toFixed(3)+')');glow.addColorStop(.5,'rgba(255,170,80,'+(.10*f).toFixed(3)+')');glow.addColorStop(1,'rgba(255,150,60,0)');
  g.fillStyle=glow;g.fillRect(-96,-202,192,192);
  ellipse(g,0,4,58,20,'rgba(255,196,110,'+(.10*f).toFixed(3)+')');
 }
 const AWNING=[['#a8322f','#f0e2c4'],['#2f6a8c','#f0e2c4'],['#3f7d48','#f0e2c4'],['#b9822a','#f0e2c4'],['#6a3f86','#f0e2c4']];
 function stall(g,s,time){
  const [a,b]=AWNING[s.goods%AWNING.length];
  for(const x of [-36,36])rect(g,x-2.5,-66,5,70,'#5a3a1e','#2a1a0c',1);
  rect(g,-40,-22,80,22,'#6d4a28','#2a1a0c',1.5);rect(g,-40,-26,80,6,'#8a5a2b','#2a1a0c',1.5);
  /* the goods: loaves, fish, cabbages, cloth, pots */
  for(let i=0;i<6;i++){
   const x=-32+i*13,y=-30-(i%2)*3;
   if(s.goods===0)ellipse(g,x,y,6,4,'#c9904a','#6b4320',1);
   else if(s.goods===1){ellipse(g,x,y,7,3,'#9fb4c4','#4a5a66',1);}
   else if(s.goods===2)ellipse(g,x,y,5.5,5,'#6fae5a','#2f5a26',1);
   else if(s.goods===3)rect(g,x-5,y-5,10,8,['#a8322f','#2f6a8c','#d9a441'][i%3],'#2a1a0c',1);
   else{ellipse(g,x,y,5,5.5,'#b0683a','#5a2f14',1);}
  }
  /* the awning, striped, scalloped along the front, breathing a little in the wind */
  const lift=Math.sin(time*1.3+s.seed)*1.5;
  for(let i=0;i<8;i++){
   g.beginPath();g.moveTo(-44+i*11,-84);g.lineTo(-33+i*11,-84);g.lineTo(-35+i*11.5,-58+lift);g.lineTo(-48+i*12,-58+lift);g.closePath();
   g.fillStyle=i%2?b:a;g.fill();
   ellipse(g,-41.5+i*11.8,-57+lift,6,4,i%2?b:a);
  }
  rect(g,-46,-87,92,4,'#4a2d17');
  if(s.covered){rect(g,-50,-100,100,14,'#7d8a94','#2b3238',1.5);for(let i=0;i<5;i++)rect(g,-46+i*20,-98,2,10,'rgba(255,255,255,.35)');} /* the covered market's slate roof */
 }
 function fountain(g,s,time){
  ellipse(g,0,0,66,26,'#8c8678','#3a362f',3);ellipse(g,0,-3,56,20,'#3f7f9c');
  for(let i=0;i<5;i++){const p=(time*.5+i*.2)%1;ellipse(g,Math.sin(i*2.1)*20,-3+Math.cos(i*1.7)*6,8+p*34,(8+p*34)*.34,null,'rgba(220,240,250,'+((1-p)*.5).toFixed(3)+')',1.5);}
  rect(g,-9,-58,18,56,'#9a9486','#3a362f',2);ellipse(g,0,-58,30,10,'#a39d8f','#3a362f',2.5);ellipse(g,0,-60,23,6.5,'#4a8fae');
  rect(g,-4,-92,8,34,'#9a9486','#3a362f',1.5);ellipse(g,0,-92,9,4,'#a39d8f','#3a362f',1.5);
  g.strokeStyle='rgba(215,238,250,.85)';g.lineWidth=2.2;g.lineCap='round';
  for(let i=0;i<6;i++){
   const a=i/6*TAU+time*.15,dx=Math.cos(a)*26,dy=Math.sin(a)*7,w=Math.sin(time*3+i)*1.2;
   g.beginPath();g.moveTo(0,-94);g.quadraticCurveTo(dx*.6,-118+w,dx,-60+dy);g.stroke();
  }
  for(let i=0;i<8;i++){const p=(time*1.4+i*.125)%1,a=i*2.4;ellipse(g,Math.cos(a)*(8+p*22),-62-Math.sin(p*Math.PI)*16,1.6,1.6,'rgba(230,245,255,'+(1-p).toFixed(3)+')');}
 }
 function statue(g,s,time){
  rect(g,-26,-34,52,36,'#8c8678','#3a362f',2.5);rect(g,-31,-2,62,10,'#7a7468','#3a362f',2);rect(g,-30,-40,60,8,'#9a9486','#3a362f',2);
  rect(g,-17,-24,34,14,'#6d675c');
  /* the figure in bronze: boots, cloak, an arm raised with a rolled ledger - and a crown once it is earned */
  const br='#7a6238',hi='#b89652';
  rect(g,-10,-72,8,32,br);rect(g,2,-72,8,32,br);
  g.beginPath();g.moveTo(-15,-70);g.lineTo(-19,-112);g.quadraticCurveTo(0,-124,19,-112);g.lineTo(15,-70);g.closePath();g.fillStyle=br;g.fill();
  g.beginPath();g.moveTo(-19,-112);g.lineTo(-27,-64);g.lineTo(-13,-72);g.closePath();g.fillStyle='#6a5430';g.fill();
  rect(g,12,-140,7,32,br);rect(g,8,-150,15,8,hi);
  ellipse(g,0,-124,10,11,br);rect(g,-4,-118,3,22,hi);
  if(s.crowned){g.beginPath();g.moveTo(-10,-132);g.lineTo(-11,-142);g.lineTo(-5,-137);g.lineTo(0,-145);g.lineTo(5,-137);g.lineTo(11,-142);g.lineTo(10,-132);g.closePath();g.fillStyle='#e5c05a';g.fill();g.strokeStyle='#6d4d12';g.lineWidth=1.2;g.stroke();}
  const glint=.25+.25*Math.sin(time*1.7);ellipse(g,-5,-100,3,9,'rgba(255,236,170,'+glint.toFixed(3)+')');
  if(s.hero)label(g,(s.crowned?'👑 ':'')+s.hero,0,-12,'#f0e2c4',9);
 }
 /* the gardens were drawn at 128 high on the square and read as a toy there; in the yard by the stone house they are
    laid out this much bigger (asked for 2026-09-24), painting and canvas stand-in alike */
 const GARDEN_K=1.6;
 function garden(g,s,time){
  g.save();g.scale(GARDEN_K,GARDEN_K);
  for(const [x,y,w] of [[-52,-6,44],[8,10,48],[-18,-34,40]]){
   ellipse(g,x+w/2,y,w/2+6,13,'#5a4a36','#2a2016',2);ellipse(g,x+w/2,y-2,w/2,9,'#3f6a34');
   for(let i=0;i<7;i++){const fx=x+6+i*(w-12)/6,sway=Math.sin(time*1.6+i+x)*1.2;ellipse(g,fx+sway,y-7-(i%2)*3,3.2,3.2,['#e8607a','#f0c84a','#f4f0e0','#b884e0'][(i+(x|0))&3]);}
  }
  for(const [x,y] of [[-64,-44],[62,-30]]){
   rect(g,x-3,y-50,6,52,'#5a3a1e');const sway=Math.sin(time*.9+x)*2;
   ellipse(g,x+sway,y-72,26,30,'#3f7a3a');ellipse(g,x-9+sway,y-62,15,17,'#4f8f46');ellipse(g,x+10+sway,y-82,13,15,'#5a9c4e');
  }
  rect(g,-14,14,28,5,'#6d4a28','#2a1a0c',1);rect(g,-12,19,3,8,'#4a2d17');rect(g,9,19,3,8,'#4a2d17');       /* a bench */
  g.restore();
 }
 /* a fenced building plot: planks, a heap of stone, a crane that swings, a board that counts the closes */
 function site(g,s,time){
  for(let i=-3;i<=3;i++){rect(g,i*16-2,-20,4,24,'#6d4a28','#2a1a0c',1);}
  rect(g,-52,-16,104,4,'#8a5a2b','#2a1a0c',1);rect(g,-52,-6,104,4,'#8a5a2b','#2a1a0c',1);
  for(const [x,y] of [[-30,-30],[-16,-34],[-24,-42]])rect(g,x,y,18,10,'#9a9486','#3a362f',1.5);
  rect(g,22,-96,5,80,'#5a3a1e','#2a1a0c',1);
  const a=Math.sin(time*.6+s.seed)*.35;
  g.save();g.translate(24,-96);g.rotate(-.5+a);rect(g,0,-3,62,5,'#5a3a1e','#2a1a0c',1);
  g.rotate(.5-a);g.strokeStyle='#2a1a0c';g.lineWidth=1.4;const hx=Math.cos(-.5+a)*60,hy=Math.sin(-.5+a)*60;
  g.beginPath();g.moveTo(hx,hy);g.lineTo(hx,hy+30+Math.sin(time*1.1)*6);g.stroke();rect(g,hx-7,hy+30+Math.sin(time*1.1)*6,14,10,'#9a9486','#3a362f',1.2);
  g.restore();
  board(g,s.name||'WORKS',-14,-40,84,'#ffd27a');        /* nailed to the fence; how long it will take is in the ledger */
 }
 /* 📌 the notice board: two posts, a little roof, papers */
 function noticeboard(g){
  for(const x of [-42,38])rect(g,x,-92,6,96,'#4a2d17','#15100b',1);
  rect(g,-46,-84,92,60,'#6d4a28','#2a1a0c',2);
  g.beginPath();g.moveTo(-56,-88);g.lineTo(0,-108);g.lineTo(56,-88);g.closePath();g.fillStyle='#55504a';g.fill();g.strokeStyle='#15100b';g.lineWidth=1.5;g.stroke();
  for(const [x,y,w,h] of [[-38,-78,22,28],[-10,-80,26,20],[20,-76,18,30],[-12,-54,24,24]]){rect(g,x,y,w,h,'#e9dcb8','#6b5430',1);ellipse(g,x+w/2,y+3,1.6,1.6,'#8a1b1b');}
 }
 /* it stands in the yard before the stone house, where the boulevard's north kerb meets the square's rim (moved off the square 2026-09-24) */
 function noticeBoard(world){const c=square(world);return {type:'citywork',kind:'noticeboard',x:c.x-550,y:c.y-185,r:16,seed:7};}
 const FOLK={maypole,music,feast,tent,breadline,beggar,barricade},FOLK_SCALE=1.55;
 /* 🎨 Painted art (assets/city/*.png, Higgsfield 2026-09-21, see city-art-manifest.json). `img` is a
    lookup game.js hands in - name -> a loaded image, or nothing while it loads and in the headless
    tests - and every routine below falls back to its canvas drawing without it. h is the drawn height
    in world units, drop how far below the anchor the art's foot sits. */
 const ART={lamp:{h:138,drop:5},banner:{h:250,drop:8},fountain:{h:146,drop:34},statue:{h:178,drop:10},garden:{h:128*GARDEN_K,drop:44*GARDEN_K},site:{h:150,drop:34},stall:{h:122,drop:10},
  noticeboard:{h:132,drop:8},maypole:{h:272,drop:8},music:{h:92,drop:8},feast:{h:176,drop:50},tent:{h:232,drop:16},breadline:{h:140,drop:10},beggar:{h:70,drop:8},barricade:{h:122,drop:18}};
 const STALL_ART=['stall_bread','stall_fish','stall_greens','stall_cloth'],WAGON_ART=['wagon_barrels','wagon_caravan','wagon_grain','wagon_caravan'];
 const artName=s=>s.kind==='banner'?'city_banner':s.kind==='stall'?STALL_ART[s.goods%STALL_ART.length]:s.kind==='tent'?(s.stripe?'tent_blue':'tent_red'):s.kind==='statue'?(s.crowned?'statue_crowned':'statue'):s.kind;
 const ready=im=>!!(im&&(im.naturalWidth||im.width));
 function drawArt(g,s,time,img){
  const a=ART[s.kind],im=a&&img&&img(artName(s));
  if(!ready(im))return false;
  const H=a.h,W=H*(im.naturalWidth||im.width)/(im.naturalHeight||im.height),flip=(s.kind==='barricade'&&s.flip<0)||(s.kind==='beggar'&&s.face<0)?-1:1;
  g.save();g.scale(flip,1);
  if(s.kind==='banner'){const k=Math.sin(time*1.7+s.seed*.02)*.018+Math.sin(time*4.3+s.seed*.05)*.006;g.transform(1,0,k,1,-k*a.drop,0);}   /* 🚩 the wind in it, as in Silverfjord */
  g.drawImage(im,-W/2,a.drop-H,W,H);g.restore();
  if(s.kind==='lamp'&&s.lit){
   const f=.85+Math.sin(time*5.1+s.seed)*.15,glow=g.createRadialGradient(0,-118,0,0,-118,96);
   glow.addColorStop(0,'rgba(255,206,120,'+(.34*f).toFixed(3)+')');glow.addColorStop(.5,'rgba(255,170,80,'+(.10*f).toFixed(3)+')');glow.addColorStop(1,'rgba(255,150,60,0)');
   g.fillStyle=glow;g.fillRect(-96,-214,192,192);ellipse(g,0,4,58,20,'rgba(255,196,110,'+(.10*f).toFixed(3)+')');
  }
  if(s.kind==='music')for(let i=0;i<3;i++){const p=(time*.45+i/3)%1;label(g,i%2?'♪':'♫',-30+i*30+Math.sin(time*2+i)*6,-96-p*44,'rgba(255,236,170,'+(1-p).toFixed(3)+')',15);}
  if(s.kind==='statue'&&s.hero){g.save();g.font='700 7px Georgia, serif';g.textAlign='center';g.fillStyle='#2a1e0c';g.fillText(s.hero.slice(0,12),0,-27);g.restore();}   /* the name, cut into the plaque */
  if(s.kind==='site'&&s.name)board(g,s.name,-8,-30,84,'#ffd27a');
  return true;
 }
 function drawProp(g,s,time=0,img=null){
  if(drawArt(g,s,time,img))return;
  if(s.kind==='lamp')lamp(g,s,time);
  else if(s.kind==='stall')stall(g,s,time);
  else if(s.kind==='fountain')fountain(g,s,time);
  else if(s.kind==='statue')statue(g,s,time);
  else if(s.kind==='garden')garden(g,s,time);
  else if(s.kind==='banner')banner(g,s,time);
  else if(s.kind==='site')site(g,s,time);
  else if(s.kind==='noticeboard')noticeboard(g);
  else if(FOLK[s.kind]){g.save();g.scale(FOLK_SCALE,FOLK_SCALE);FOLK[s.kind](g,s,time);g.restore();}   /* drawn at handcart size, shown at the size of the townsfolk they stand among */
 }
 /* ---------- what a house wears: scaffolding while a crew is on it, a signboard after ---------- */
 /* drawn in the house's own frame: (0,0) is its anchor, the art spans x ±W/2 and y from `top` to `top+H` */
 function drawHouseWork(g,work,W,H,top,time=0,img=null){
  const w=Math.max(40,W),h=Math.max(40,H),tint=TINT[work.cat]||'#ffd27a';
  const seized=work.status==='seized'&&img&&img('sign_seized'),scaffold=work.status==='building'&&img&&img('scaffold');
  if(ready(seized)){const sh=Math.min(92,h*.3),sw=sh*seized.naturalWidth/seized.naturalHeight;g.drawImage(seized,-sw/2,top+h*.62-sh/2,sw,sh);return;}   /* 🏦 the bank's notice, chained across the door */
  if(ready(scaffold)){
   /* the painted scaffold, stretched over the facade from the street to the eaves; the name on a board lashed to it */
   g.drawImage(scaffold,-w*.5,top+h*.2,w,h*.8);
   board(g,work.sign,0,top+h*.2+h*.8*.30,w*.5,'#ffd27a');
   return;
  }
  if(work.status==='seized'){
   /* 🏦 sold by the bank: a chain across the door, the bank's seal on a board, the name struck through */
   const y=top+h*.74;
   g.save();g.strokeStyle='#8a8478';g.lineWidth=3;g.beginPath();g.moveTo(-w*.16,y);g.quadraticCurveTo(0,y+12,w*.16,y);g.stroke();
   rect(g,-6,y+2,12,13,'#55504a','#15130f',1.5);g.restore();
   rect(g,-w*.26,top+h*.50,w*.52,30,'#e9dcb8','#4a2d17',2);
   g.save();g.font='700 9px Georgia, serif';g.textAlign='center';g.fillStyle='#7a1b1b';g.fillText('SEIZED',0,top+h*.50+13);g.fillStyle='#3a1a0c';g.font='700 7.5px Georgia, serif';g.fillText('BY THE TIDES BANK',0,top+h*.50+24);g.restore();
   ellipse(g,w*.22,top+h*.50+15,8,8,'#7a1b1b','#3a0d10',1.5);
   return;
  }
  if(work.status==='building'){
   const x0=-w*.46,x1=w*.46,y0=top+h*.18,y1=top+h;
   g.strokeStyle='#6d4a28';g.lineWidth=4;g.lineCap='butt';
   for(let i=0;i<=4;i++){const x=x0+(x1-x0)*i/4;g.beginPath();g.moveTo(x,y1);g.lineTo(x,y0-10);g.stroke();}
   for(let k=0;k<3;k++){const y=y1-(y1-y0)*(k+1)/3.2;rect(g,x0-6,y,x1-x0+12,5,'#a0703a','#2a1a0c',1);}
   g.strokeStyle='rgba(60,40,20,.8)';g.lineWidth=2;
   g.beginPath();g.moveTo(x0,y1);g.lineTo(x0+(x1-x0)/4,y0);g.moveTo(x1,y1);g.lineTo(x1-(x1-x0)/4,y0);g.stroke();
   /* a man with a hammer on the middle stage, and the dust he makes */
   const my=y1-(y1-y0)*2/3.2,mx=Math.sin(time*.5+w)*w*.25,hit=Math.abs(Math.sin(time*4));
   ellipse(g,mx,my-20,4.5,5,'#e0b890');rect(g,mx-4,my-15,8,14,'#4a6a8c');g.strokeStyle='#3a2410';g.lineWidth=2.4;
   g.beginPath();g.moveTo(mx+3,my-11);g.lineTo(mx+12,my-16-hit*7);g.stroke();rect(g,mx+10,my-21-hit*7,7,5,'#55504a');
   for(let i=0;i<3;i++){const p=(time*.9+i/3)%1;ellipse(g,mx+14+p*10,my-8-p*14,2+p*5,2+p*4,'rgba(210,196,170,'+((1-p)*.4).toFixed(3)+')');}
   board(g,work.sign,0,y1-(y1-y0)/3.2-22,w*.5,'#ffd27a');      /* lashed to the first stage of the scaffold */
   return;
  }
  /* finished: a pennant on the ridge, a board over the door, a warm lamp by it */
  const px=w*.18,sway=Math.sin(time*2.2+w)*3;
  rect(g,px-1.5,top-26,3,34,'#3a2410');
  g.beginPath();g.moveTo(px+1.5,top-26);g.quadraticCurveTo(px+14,top-24+sway,px+28,top-19+sway*.6);g.quadraticCurveTo(px+14,top-14+sway,px+1.5,top-12);g.closePath();g.fillStyle=tint;g.fill();g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1;g.stroke();
  const by=top+h*.60;
  board(g,work.sign,0,by,w*.52,tint);
  const f=.8+Math.sin(time*4.7+w)*.2;ellipse(g,-w*.30,by+8,16,16,'rgba(255,196,110,'+(.16*f).toFixed(3)+')');ellipse(g,-w*.30,by+8,3.5,4.5,'rgba(255,226,160,.95)');
 }
 /* a house nobody lives in any more: planks across the door, a FOR RENT board on a stake */
 function drawVacant(g,W,H,top,img=null){
  const y=top+H*.72,sign=img&&img('sign_rent');
  g.save();g.strokeStyle='#6d4a28';g.lineWidth=5;g.lineCap='butt';
  g.beginPath();g.moveTo(-14,y);g.lineTo(14,y+22);g.moveTo(14,y);g.lineTo(-14,y+22);g.stroke();
  g.restore();
  if(ready(sign)){const sh=62,sw=sh*sign.naturalWidth/sign.naturalHeight;g.drawImage(sign,W*.24-sw/2,top+H+4-sh,sw,sh);return;}
  rect(g,W*.2,top+H-30,3,30,'#4a2d17');rect(g,W*.2-21,top+H-44,45,16,'#d8c493','#4a2d17',1.5);
  g.save();g.font='700 8px Georgia, serif';g.textAlign='center';g.fillStyle='#3a1a0c';g.fillText('FOR RENT',W*.2+1.5,top+H-33);g.restore();
 }
 /* 🔥🌸☠️ what a house wears for the temper of the city, in the house's own frame (see dressing) */
 function drawDressing(g,kind,W,H,top,time=0,seed=0,img=null){
  const w=Math.max(40,W),h=Math.max(40,H),tub=img&&img('flower_tub');
  if(kind==='fire'){
   /* smoke first, rolling up and downwind; then tongues of flame in three coats, red to yellow; then sparks */
   const k=clamp(h/200,1,2.2),tongue=(fx,fy,bw,hh,lean,fill)=>{g.beginPath();g.moveTo(fx-bw,fy);g.bezierCurveTo(fx-bw*1.3,fy-hh*.45,fx-bw*.2+lean*.4,fy-hh*.7,fx+lean,fy-hh);g.bezierCurveTo(fx+bw*.5+lean*.4,fy-hh*.6,fx+bw*1.3,fy-hh*.4,fx+bw,fy);g.closePath();g.fillStyle=fill;g.fill();};
   ellipse(g,0,top+h-4,w*.62,20,'rgba(255,140,50,'+(.18+.07*Math.sin(time*7+seed)).toFixed(3)+')');
   for(let i=0;i<10;i++){const p=(time*.16+i/10+seed*.13)%1,r=(16+p*46)*k;
    ellipse(g,Math.sin(i*2.3+seed)*w*.22+p*70*k+Math.sin(time*.9+i)*8,top+h*.3-p*300*k,r,r*.82,'rgba('+(38+i%3*10)+','+(34+i%3*9)+',34,'+(Math.sin(p*Math.PI)*.62).toFixed(3)+')');}
   for(let i=0;i<9;i++){
    const fx=(((seed*37+i*61)%100)/100-.5)*w*.66,fy=top+h*(.2+((seed*13+i*29)%55)/100),fl=.72+Math.sin(time*(7+i*.9)+i*1.7)*.28,hh=(34+i%3*16)*fl*k,bw=(7+i%2*3)*k,lean=Math.sin(time*4.3+i*2.1)*6*k;
    tongue(fx,fy,bw*1.35,hh*1.12,lean*1.2,'rgba(200,52,18,.55)');tongue(fx,fy,bw,hh,lean,'rgba(245,128,32,.92)');tongue(fx,fy,bw*.5,hh*.6,lean*.5,'rgba(255,228,130,.96)');
    ellipse(g,fx,fy,bw*2.2,bw*.9,'rgba(255,170,60,.22)');
   }
   for(let i=0;i<8;i++){const p=(time*.6+i/8)%1;ellipse(g,Math.sin(i*3.1+seed)*w*.28+p*30*k+Math.sin(time*2+i)*6,top+h*.3-p*190*k,1.9*k,1.9*k,'rgba(255,205,100,'+(1-p).toFixed(3)+')');}
   return;
  }
  if(kind==='plague'){
   const y=top+h*.8;rect(g,-3,y-12,6,24,'#8a1b1b');rect(g,-10,y-5,20,6,'#8a1b1b');
   return;
  }
  /* tubs of flowers either side of the door; on a garlanded house a swag of green and a crown banner as well */
  const u=clamp(h/190,1,1.9);
  if(ready(tub)){const th=34*u,tw=th*tub.naturalWidth/tub.naturalHeight;for(const side of [-1,1])g.drawImage(tub,side*w*.22-tw/2,top+h+3-th,tw,th);}
  else for(const side of [-1,1]){const x=side*w*.2,y=top+h-2;
   rect(g,x-9*u,y-10*u,18*u,10*u,'#8a5a2b','#2a1a0c',1.2);ellipse(g,x,y-12*u,11*u,6*u,'#3f7a3a');
   for(let i=0;i<5;i++)ellipse(g,x+(-8+i*4)*u+Math.sin(time*1.5+i+seed)*.8,y-(15+(i%2)*3)*u,2.6*u,2.6*u,['#e8607a','#f0c84a','#f4f0e0','#b884e0'][(i+seed)&3]);}
  if(kind!=='garland')return;
  const gy=top+h*.56;g.save();g.strokeStyle='#3f7d48';g.lineWidth=4;
  for(const [x0,x1] of [[-w*.34,0],[0,w*.34]]){g.beginPath();g.moveTo(x0,gy);g.quadraticCurveTo((x0+x1)/2,gy+18,x1,gy);g.stroke();}
  g.restore();
  for(const x of [-w*.34,0,w*.34])ellipse(g,x,gy,4.5,4.5,'#e8607a','#7a2038',1);
  const sw=Math.sin(time*1.8+seed)*2;rect(g,w*.26,gy+6,2,4,'#3a2410');
  g.beginPath();g.moveTo(w*.26-9,gy+10);g.lineTo(w*.26+11,gy+10);g.lineTo(w*.26+11+sw,gy+40);g.lineTo(w*.26+1+sw,gy+33);g.lineTo(w*.26-9+sw,gy+40);g.closePath();g.fillStyle='#e5c05a';g.fill();g.strokeStyle='#6d4d12';g.lineWidth=1;g.stroke();
 }
 /* ---------- the sky over the city: snow in a hard winter, fireworks over a jubilant square ---------- */
 function drawSnow(g,view,time=0){
  const n=clamp(Math.round(view.w*view.h/4200),60,520);
  for(let i=0;i<n;i++){
   const h=hash(i,77),sp=38+(h%40),drift=Math.sin(time*.8+i)*18;
   const x=view.x+(((h>>>4)%1000)/1000*view.w+drift+view.w)%view.w,y=view.y+((((h>>>14)%1000)/1000*view.h+time*sp)%view.h);
   ellipse(g,x,y,2+(h%3)*.9,2+(h%3)*.9,'rgba(245,250,255,.9)');
  }
  g.fillStyle='rgba(215,230,245,.10)';g.fillRect(view.x,view.y,view.w,view.h);
 }
 function drawFireworks(g,world,view,time=0){
  const c=square(world);
  if(c.x+700<view.x||c.x-700>view.x+view.w||c.y<view.y-200||c.y-900>view.y+view.h)return;
  const period=2.8;
  for(let k=0;k<3;k++){
   const T=time/period+k/3,n=Math.floor(T),p=T-n,h=hash(n,k+5);
   const x=c.x+((h%1000)/1000-.5)*900,top=c.y-380-((h>>>10)%260),col=['255,214,110','255,120,110','150,210,255','190,255,170'][(h>>>20)%4];
   if(p<.3){const q=p/.3,ry=c.y-120-(c.y-120-top)*q;for(let j=0;j<5;j++)ellipse(g,x,ry+j*9,2.6-j*.4,2.6-j*.4,'rgba(255,236,190,'+(.95-j*.18).toFixed(3)+')');continue;}
   const q=(p-.3)/.7,R=36+q*150,alpha=Math.pow(1-q,1.4),drop=q*q*60;
   for(let i=0;i<24;i++){const a=i/24*TAU+(h%7),cx=Math.cos(a),sy=Math.sin(a)*.85;
    for(let j=0;j<4;j++){const rr=R*(1-j*.09);ellipse(g,x+cx*rr,top+sy*rr+drop*(1-j*.15),3.4-j*.7,3.4-j*.7,'rgba('+col+','+(alpha*(1-j*.22)).toFixed(3)+')');}   /* a spark, and the tail it drags */
    if(i%2)ellipse(g,x+cx*R*.5,top+sy*R*.5+drop*.5,2.2,2.2,'rgba(255,255,255,'+(alpha*.85).toFixed(3)+')');}
  }
 }
 /* 💨 Where the chimney pots are on each house painting, as fractions of the art (u across, v down), read off the
    pictures under a grid. A face with no chimney (the stair house, the Exchange, the Playhouse, the lists, the
    hospital, the University) or with smoke already painted on it (the Schoolhouse) is not listed. */
 const CHIMNEYS=Object.freeze({
  work_bathhouse:[[.486,.096,.8],[.777,.163,1.1]],minehall:[[.233,.212,1.1]],
  house_timber:[[.78,.02]],house_stone:[[.64,.01]],house_shop:[[.65,.01]],house_turret:[[.34,.2]],house_tenement:[[.70,.02],[.42,.04]],house_manor:[[.55,.01]],
  work_apprentice:[[.73,.01]],work_brothel:[[.72,.01]],work_caravanserai:[[.15,.01],[.84,.01]],work_carters:[[.17,.01],[.83,.01]],work_courthouse:[[.50,.01]],work_customs:[[.50,.01]],
  work_fleet:[[.73,.11]],work_library:[[.79,.01]],work_newquarter:[[.78,.01]],work_press:[[.76,.01]],work_quay:[[.22,.13]],work_tenements:[[.16,.01],[.50,.01],[.83,.01]],
  /* beyond the City: Moonshine's houses (these paintings carry wide transparent margins, so the pots sit well inside
     the frame), the training lodge, the farm's houses, and the smelter's stack - a third number is how big it smokes */
  tavern:[[.19,.175]],casino:[[.19,.235]],bank:[[.19,.21]],blacksmith:[[.245,.17,1.25]],training_lodge:[[.23,.105]],
  farmhouse_litet:[[.24,.02]],Farmhouse_medium:[[.18,.095]],farmhouse_mansion:[[.275,.075],[.66,.03]],smelter:[[.31,.01,1.9]],
 });
 /* hearth smoke from a lived-in house, in the house's own frame: soft puffs that rise, swell, drift downwind and thin out.
    `cold` (a hard winter) stokes every fire. Drawn with whatever globalAlpha the house itself is drawn with. */
 function drawSmoke(g,key,W,H,top,time=0,seed=0,cold=false){
  const pots=CHIMNEYS[key];if(!pots)return 0;
  const k0=Math.max(.6,Math.min(1.5,H/320));
  for(let c=0;c<pots.length;c++){
   const k=k0*(pots[c][2]||1);
   const x0=-W/2+pots[c][0]*W,y0=top+pots[c][1]*H,ph=seed*.37+c*1.9;
   Scenery.smoke(g,x0,y0,k,time,ph,cold);
  }
  return pots.length;
 }
 /* does this house stand empty? a stable hash of its seed against how far the population has fallen */
 function vacant(house,vacancy){return vacancy>0&&!house.work&&(hash(Math.round(house.x),Math.round(house.y))%1000)/1000<vacancy;}

 /* ---------- the street itself: refuse underfoot, bunting overhead ---------- */
 function onStreet(world,x,y,inset){
  for(const s of world.streets||[]){
   const dx=s.x1-s.x0,dy=s.y1-s.y0,L=dx*dx+dy*dy||1;let t=((x-s.x0)*dx+(y-s.y0)*dy)/L;t=t<0?0:t>1?1:t;
   if(Math.hypot(x-(s.x0+dx*t),y-(s.y0+dy*t))<s.w/2-inset)return true;
  }
  return false;
 }
 /* dirt 0 none · 1 the odd heap · 2 heaps and puddles · 3 middens, flies and rats */
 function litter(world,view,dirt){
  const out=[];if(dirt<=0)return out;
  const P=170,keep=[0,10,34,62][clamp(dirt|0,0,3)];
  for(let x=Math.floor(view.x/P)*P;x<view.x+view.w+P;x+=P)for(let y=Math.floor(view.y/P)*P;y<view.y+view.h+P;y+=P){
   const h=hash(x/P,y/P);if(h%100>=keep)continue;
   const px=x+(h>>>7)%P,py=y+(h>>>15)%P;
   if(onStreet(world,px,py,26))out.push({x:px,y:py,h,big:dirt>=3&&(h>>>3)%3===0});
  }
  return out;
 }
 function drawLitter(g,world,view,dirt,time=0,images={}){
  const im=images.street_dung;
  if(!ready(im)||im.complete===false)return; /* Wait for the painting, never flash the old brown circles. */
  for(const p of litter(world,view,dirt)){
   const r=p.big?26:13+(p.h>>>9)%8;
   Scenery.shadow(g,p.x,p.y+2,r*1.13,r*.36,.2);
   {
    const w=r*2.3,h=w*(im.naturalHeight||im.height)/(im.naturalWidth||im.width);
    g.save();g.translate(p.x,p.y);g.scale(p.h&1?-1:1,1);g.drawImage(im,-w/2,-h*.7,w,h);g.restore();
   }
   if(dirt>=2)for(let i=0;i<(p.big?5:2);i++){const a=time*(3+i)+i*2.1+(p.h&255);ellipse(g,p.x+Math.cos(a)*r*.9,p.y-r*.6+Math.sin(a*1.3)*r*.4,1.3,1.3,'rgba(20,20,20,.8)');}
  }
 }
 /* strings of pennants across the boulevard: 1 sparse, 2 every span, 3 doubled and in the crown's gold */
 function bunting(world,view,level,xMax){
  const out=[];if(level<=0)return out;
  const c=square(world),step=level>=2?520:1040,half=150;
  for(let x=1160;x<=Math.min(xMax||world.w-1300,world.w-600);x+=step){
   if(Math.abs(x-c.x)<c.r+40||x<view.x-40||x>view.x+view.w+40)continue;
   if(c.y+half<view.y||c.y-half>view.y+view.h)continue;
   out.push({x,y0:c.y-half,y1:c.y+half,gold:level>=3});
  }
  return out;
 }
 function drawBunting(g,b,time=0){
  const n=11,sag=26,cols=b.gold?['#e5c05a','#a8322f','#f0e2c4']:['#a8322f','#2f6a8c','#f0e2c4','#3f7d48'];
  g.save();
  for(const y of [b.y0,b.y1]){rect(g,b.x-2.5,y-74,5,76,'#4a2d17','#15100b',1);rect(g,b.x-6,y-2,12,5,'#2b2622');}   /* a pole on either kerb */
  g.strokeStyle='rgba(40,30,20,.85)';g.lineWidth=1.5;
  g.beginPath();g.moveTo(b.x,b.y0-70);g.quadraticCurveTo(b.x+10,(b.y0+b.y1)/2-70+sag*2,b.x,b.y1-70);g.stroke();
  for(let i=1;i<n;i++){
   const t=i/n,y=b.y0+(b.y1-b.y0)*t-70+Math.sin(t*Math.PI)*sag,x=b.x+Math.sin(t*Math.PI)*5,sw=Math.sin(time*2.4+i+b.x)*2.5;
   g.beginPath();g.moveTo(x-6,y-5);g.lineTo(x+6,y+5);g.lineTo(x-11+sw,y+13);g.closePath();g.fillStyle=cols[i%cols.length];g.fill();
  }
  g.restore();
 }
 /* a wagon and its horse; a family and its handcart */
 function drawTraffic(g,t,time=0,img=null){
  g.save();g.translate(t.x,t.y);g.globalAlpha=clamp(t.fade,0,1);g.scale(t.dir,1);
  const key=t.kind==='wagon'?WAGON_ART[t.cargo%WAGON_ART.length]:'handcart',im=img&&img(key);
  if(ready(im)){
   const H=t.kind==='wagon'?112:88,W=H*im.naturalWidth/im.naturalHeight;
   Scenery.shadow(g,0,9,W*.46,8,.22);
   TrafficAnimation.draw(g,key,im,H,time,t.speed??(t.kind==='wagon'?62+((t.seed*37)%23):34),t.seed);
   g.restore();return;
  }
  const roll=time*5+t.seed,bob=Math.sin(roll*1.3)*1.2;
  const wheel=(x,y,r)=>{ellipse(g,x,y,r,r,'#3a2410','#15100b',2);g.strokeStyle='#8a5a2b';g.lineWidth=1.6;for(let i=0;i<4;i++){const a=roll+i*Math.PI/4;g.beginPath();g.moveTo(x-Math.cos(a)*r,y-Math.sin(a)*r);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);g.stroke();}};
  ellipse(g,0,8,t.kind==='wagon'?74:40,9,'rgba(0,0,0,.26)');
  if(t.kind==='wagon'){
   rect(g,-58,-30+bob,70,22,'#6d4a28','#2a1a0c',2);rect(g,-58,-34+bob,70,5,'#8a5a2b','#2a1a0c',1.5);
   if(t.cargo===0)for(let i=0;i<3;i++){ellipse(g,-44+i*20,-44+bob,9,12,'#7a5230','#2a1a0c',1.5);rect(g,-53+i*20,-48+bob,18,2.5,'#2f2a26');}
   else if(t.cargo===1)for(let i=0;i<3;i++)rect(g,-54+i*21,-52+bob-(i%2)*6,19,18+(i%2)*6,'#a0783c','#2a1a0c',1.5);
   else if(t.cargo===2)for(let i=0;i<4;i++)ellipse(g,-48+i*15,-40+bob-(i%2)*7,10,8,'#d8c8a0','#6b5a3a',1.5);
   else{rect(g,-56,-50+bob,66,16,'#55504a','#15100b',1.5);for(let i=0;i<4;i++)ellipse(g,-46+i*16,-52+bob,5,3,'#8a8478');}
   wheel(-42,0,11);wheel(-4,0,11);
   rect(g,12,-20+bob,20,3,'#3a2410');
   /* the horse */
   const step=Math.sin(roll*1.6);
   ellipse(g,50,-24,20,11,'#6a4a2e','#2a1a0c',1.5);
   for(const [x,ph] of [[38,0],[44,1.6],[58,3.1],[63,4.7]])rect(g,x,-16,4,18+Math.sin(roll*1.6+ph)*3,'#4a3220');
   g.beginPath();g.moveTo(64,-30);g.lineTo(78,-46+step);g.lineTo(88,-42+step);g.lineTo(84,-34+step);g.lineTo(70,-22);g.closePath();g.fillStyle='#6a4a2e';g.fill();g.strokeStyle='#2a1a0c';g.lineWidth=1.5;g.stroke();
   g.beginPath();g.moveTo(66,-32);g.lineTo(76,-46+step);g.strokeStyle='#2a1a0c';g.lineWidth=3;g.stroke();
   g.beginPath();g.moveTo(31,-26);g.quadraticCurveTo(22,-18,26,-6+step*2);g.strokeStyle='#2a1a0c';g.lineWidth=2.5;g.stroke();
   /* the carter */
   ellipse(g,8,-50+bob,5,5.5,'#e0b890');rect(g,3,-45+bob,10,14,'#5a4a36');rect(g,1,-57+bob,14,4,'#3a2a1a');
  }else{
   rect(g,-34,-24+bob,40,14,'#7a5230','#2a1a0c',1.5);wheel(-16,0,9);
   rect(g,-30,-42+bob,14,18,'#8a5a2b','#2a1a0c',1.2);rect(g,-14,-36+bob,16,12,'#b9a27a','#2a1a0c',1.2);ellipse(g,-8,-40+bob,7,5,'#a8322f');
   rect(g,-24,-52+bob,4,12,'#5a3a1e');rect(g,6,-18+bob,18,2.5,'#3a2410');
   const st=Math.sin(roll*1.8)*3;
   ellipse(g,30,-40,5,5.5,'#e0b890');rect(g,25,-35,10,17,t.leaving?'#5d5668':'#4f7a4a');rect(g,26,-18,3.5,16+st,'#3a2a1a');rect(g,31,-18,3.5,16-st,'#3a2a1a');
   ellipse(g,-44,-30,4,4.5,'#e0b890');rect(g,-48,-26,8,13,'#8a5a6a');rect(g,-47,-13,3,11-st,'#3a2a1a');rect(g,-43,-13,3,11+st,'#3a2a1a');
  }
  g.restore();
 }
 return Object.freeze({ANCHORS,TINT,ART,props,assignHouses,stallSlots,lampSpots,bannerSpots,stallCount,traffic,litter,bunting,vacant,onStreet,
  CHIMNEYS,drawSmoke,MAX_STALLS,noticeBoard,streetLife,fireLevel,dressing,drawDressing,drawSnow,drawFireworks,
  drawProp,drawShadow,drawHouseWork,drawVacant,drawLitter,drawBunting,drawTraffic});
});
