/* 🏗 What the Crown Ledger looks like from the street. The ledger (economy.js) decides; this module
 * shows it, so a steward can walk the boulevard and SEE how the city is doing without opening a book:
 *  - public works: scaffolding over a house while a crew is on it, then a signboard and a pennant;
 *    lamps down the boulevard, a fountain, a statue and gardens on the great square
 *  - the market: as many awnings on the square as the fees and the covered market allow
 *  - traffic on the boulevard: trade wagons (as many as the trade works have earned), and handcarts
 *    of families moving in from the gate - or out through it - as the city's name rises and falls
 *  - bunting when the festivals are funded, refuse and flies when the sweepers are not
 *  - boarded-up houses as the population falls
 * Pure functions of a small `look` object and the time: no state of its own, no DOM, no images, so
 * it runs headless in the tests. game.js adds the props to world.solids (type 'citywork'), hangs a
 * `work` on the houses that carry a sign, and calls the draw routines from its own passes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CityWorks=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 /* where each house-work wants to stand; the nearest free terrace house to the point wears its sign */
 const ANCHORS=Object.freeze({
  carters:[1500,2300],caravanserai:[1900,2950],quay:[13500,4300],customs:[14700,2950],fleet:[13900,3700],exchange:[9300,2250],
  school:[4300,2250],apprentice:[6500,3700],library:[7500,2250],press:[7000,1500],university:[10000,1500],
  bathhouse:[5000,3700],hospital:[10500,3700],tenements:[3300,4300],newquarter:[14800,1500],
  theatre:[9800,2950],arena:[12000,1500],courthouse:[6900,2950],
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

 /* ---------- the plan: what stands where for a given look ---------- */
 /* look = {works:{id:'building'|'done'},left:{id:n},stalls:n,clean:0-3,festival:0-3,wagons:n,migrants:-3..3,
            vacancy:0-1,crowned:bool,hero:'name',xMax:n}. geometry comes from the world itself. */
 function square(world){const p=(world.plazas&&world.plazas[0])||{x:world.w/2,y:world.h/2,r:520};return {x:p.x,y:p.y,r:p.r};}
 function stallSlots(world){
  const c=square(world),out=[[-205,215],[-310,262],[-395,196],[-250,300]].map(([dx,dy])=>({x:c.x+dx,y:c.y+dy}));
  for(let k=0;k<4;k++)for(const side of [-1,1])out.push({x:c.x+side*(660+k*170),y:c.y+(k%2?1:-1)*side*118});
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
 /* the props a look asks for, as solids ready for world.solids. Small collision circles: you walk
    round a fountain, you brush past a lamp-post. */
 function props(world,look){
  const c=square(world),out=[],works=look.works||{},st=id=>works[id];
  const add=(kind,x,y,r,extra)=>out.push({type:'citywork',kind,x,y,r,seed:hash(x,y)%1000,...extra});
  const site=(id,x,y,name)=>add('site',x,y,34,{work:id,name,left:(look.left||{})[id]||1});
  if(st('aqueduct')==='done')add('fountain',c.x-270,c.y-250,46);else if(st('aqueduct'))site('aqueduct',c.x-270,c.y-250,'FOUNTAIN');
  if(st('statue')==='done')add('statue',c.x+270,c.y-250,26,{crowned:!!look.crowned,hero:look.hero||''});else if(st('statue'))site('statue',c.x+270,c.y-250,'STATUE');
  if(st('gardens')==='done')add('garden',c.x+285,c.y+258,20,{noCol:true});else if(st('gardens'))site('gardens',c.x+285,c.y+258,'GARDENS');
  if(st('coveredmarket')==='building')site('coveredmarket',c.x-300,c.y+330,'COVERED MARKET');
  if(st('lamps'))for(const p of lampSpots(world,look.xMax))add('lamp',p.x,p.y,7,{lit:st('lamps')==='done',noCol:true});
  stallSlots(world).slice(0,clamp(Math.round(look.stalls||0),0,12)).forEach((p,i)=>add('stall',p.x,p.y,24,{goods:i%5,covered:st('coveredmarket')==='done'}));
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
 /* how many awnings the square carries */
 function stallCount(feeLevel,covered,pop){return clamp([6,4,3,1][clamp(feeLevel|0,0,3)]+(covered?5:0)+Math.floor(Math.max(0,(pop||0)-72)/30),0,12);}
 /* traffic on the boulevard, as pure functions of time: wagons both ways, handcarts one way */
 function traffic(world,look,time){
  const c=square(world),x0=420,x1=(look.xMax||world.w-1300)+200,span=x1-x0,out=[];
  const n=clamp(look.wagons|0,0,8),m=clamp(look.migrants|0,-4,4);
  for(let k=0;k<n;k++){
   const dir=k%2?-1:1,speed=62+((k*37)%23),s=((time*speed+k*span/Math.max(1,n)+k*211)%span+span)%span;
   const x=dir>0?x0+s:x1-s;
   out.push({kind:'wagon',x,y:c.y+dir*-52+((k*13)%9-4),dir,cargo:k%4,seed:k,fade:clamp(Math.min(x-x0,x1-x)/160,0,1)});
  }
  for(let k=0;k<Math.abs(m);k++){
   const dir=m>0?1:-1,speed=34+((k*29)%11),s=((time*speed+k*span/Math.abs(m)+k*977)%span+span)%span;
   const x=dir>0?x0+s:x1-s;
   out.push({kind:'handcart',x,y:c.y+dir*-96+((k*7)%11-5),dir,leaving:m<0,seed:k+20,fade:clamp(Math.min(x-x0,x1-x)/160,0,1)});
  }
  return out;
 }

 /* ---------- drawing: props sorted with the actors ---------- */
 function drawShadow(g,s){
  if(s.kind==='fountain')ellipse(g,0,10,70,24,'rgba(0,0,0,.32)');
  else if(s.kind==='statue')ellipse(g,4,8,40,14,'rgba(0,0,0,.35)');
  else if(s.kind==='stall')ellipse(g,4,10,46,14,'rgba(0,0,0,.30)');
  else if(s.kind==='lamp')ellipse(g,3,3,12,5,'rgba(0,0,0,.30)');
  else if(s.kind==='site')ellipse(g,4,12,60,20,'rgba(0,0,0,.28)');
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
 function garden(g,s,time){
  for(const [x,y,w] of [[-52,-6,44],[8,10,48],[-18,-34,40]]){
   ellipse(g,x+w/2,y,w/2+6,13,'#5a4a36','#2a2016',2);ellipse(g,x+w/2,y-2,w/2,9,'#3f6a34');
   for(let i=0;i<7;i++){const fx=x+6+i*(w-12)/6,sway=Math.sin(time*1.6+i+x)*1.2;ellipse(g,fx+sway,y-7-(i%2)*3,3.2,3.2,['#e8607a','#f0c84a','#f4f0e0','#b884e0'][(i+(x|0))&3]);}
  }
  for(const [x,y] of [[-64,-44],[62,-30]]){
   rect(g,x-3,y-50,6,52,'#5a3a1e');const sway=Math.sin(time*.9+x)*2;
   ellipse(g,x+sway,y-72,26,30,'#3f7a3a');ellipse(g,x-9+sway,y-62,15,17,'#4f8f46');ellipse(g,x+10+sway,y-82,13,15,'#5a9c4e');
  }
  rect(g,-14,14,28,5,'#6d4a28','#2a1a0c',1);rect(g,-12,19,3,8,'#4a2d17');rect(g,9,19,3,8,'#4a2d17');       /* a bench */
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
  label(g,'⚒️ '+(s.name||'WORKS'),0,-112,'#ffd27a',12);
  label(g,(s.left||1)+' close'+((s.left||1)>1?'s':'')+' to go',0,-98,'#e6dbc9',10);
 }
 function drawProp(g,s,time=0){
  if(s.kind==='lamp')lamp(g,s,time);
  else if(s.kind==='stall')stall(g,s,time);
  else if(s.kind==='fountain')fountain(g,s,time);
  else if(s.kind==='statue')statue(g,s,time);
  else if(s.kind==='garden')garden(g,s,time);
  else if(s.kind==='site')site(g,s,time);
 }
 /* ---------- what a house wears: scaffolding while a crew is on it, a signboard after ---------- */
 /* drawn in the house's own frame: (0,0) is its anchor, the art spans x ±W/2 and y from `top` to `top+H` */
 function drawHouseWork(g,work,W,H,top,time=0){
  const w=Math.max(40,W),h=Math.max(40,H),tint=TINT[work.cat]||'#ffd27a';
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
   label(g,'⚒️ '+work.sign,0,top-10,'#ffd27a',12);
   label(g,work.left+' close'+(work.left>1?'s':'')+' to go',0,top+5,'#e6dbc9',10);
   return;
  }
  /* finished: a pennant on the ridge, a board over the door, a warm lamp by it */
  const px=w*.18,sway=Math.sin(time*2.2+w)*3;
  rect(g,px-1.5,top-26,3,34,'#3a2410');
  g.beginPath();g.moveTo(px+1.5,top-26);g.quadraticCurveTo(px+14,top-24+sway,px+28,top-19+sway*.6);g.quadraticCurveTo(px+14,top-14+sway,px+1.5,top-12);g.closePath();g.fillStyle=tint;g.fill();g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1;g.stroke();
  const by=top+h*.60;
  rect(g,-w*.24,by,w*.48,17,'#3a2410','#15100b',2);rect(g,-w*.24+3,by+3,w*.48-6,11,'#5a3a1e');
  g.save();g.font='700 9px Georgia, serif';g.textAlign='center';g.fillStyle=tint;g.fillText(work.icon,0,by+12);g.restore();
  const f=.8+Math.sin(time*4.7+w)*.2;ellipse(g,-w*.30,by+8,16,16,'rgba(255,196,110,'+(.16*f).toFixed(3)+')');ellipse(g,-w*.30,by+8,3.5,4.5,'rgba(255,226,160,.95)');
  label(g,work.icon+' '+work.sign,0,top-32,tint,13);
 }
 /* a house nobody lives in any more: planks across the door, a board on a stake */
 function drawVacant(g,W,H,top){
  const y=top+H*.72;
  g.save();g.strokeStyle='#6d4a28';g.lineWidth=5;g.lineCap='butt';
  g.beginPath();g.moveTo(-14,y);g.lineTo(14,y+22);g.moveTo(14,y);g.lineTo(-14,y+22);g.stroke();
  g.restore();
  rect(g,W*.2,top+H-30,3,30,'#4a2d17');rect(g,W*.2-17,top+H-44,37,16,'#d8c493','#4a2d17',1.5);
  g.save();g.font='700 8px Georgia, serif';g.textAlign='center';g.fillStyle='#3a1a0c';g.fillText('TO LET',W*.2+1.5,top+H-33);g.restore();
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
 function drawLitter(g,world,view,dirt,time=0){
  for(const p of litter(world,view,dirt)){
   const r=p.big?26:13+(p.h>>>9)%8;
   ellipse(g,p.x,p.y+3,r*1.25,r*.5,'rgba(30,24,14,.35)');
   ellipse(g,p.x,p.y,r,r*.52,'#4a3f2a');ellipse(g,p.x-r*.3,p.y-r*.2,r*.55,r*.34,'#5d5034');ellipse(g,p.x+r*.35,p.y-r*.12,r*.4,r*.26,'#3a3120');
   rect(g,p.x-r*.1,p.y-r*.46,r*.34,r*.2,'#8a8270');ellipse(g,p.x+r*.2,p.y-r*.34,r*.12,r*.1,'#b09a6a');
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
 function drawTraffic(g,t,time=0){
  g.save();g.translate(t.x,t.y);g.globalAlpha=clamp(t.fade,0,1);g.scale(t.dir,1);
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
 return Object.freeze({ANCHORS,TINT,props,assignHouses,stallSlots,lampSpots,stallCount,traffic,litter,bunting,vacant,onStreet,
  drawProp,drawShadow,drawHouseWork,drawVacant,drawLitter,drawBunting,drawTraffic});
});
