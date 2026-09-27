/* 🍺 The folk of Moonshine (2026-09-27). Home had eight villagers, and all of them wore the same two faces - they carried a
 * race and a class but no skin, so drawNpc gave the men the straw-hatted townsman and the women the nun - and each walked the
 * same two or three points back and forth, which from above looked like walking in circles.
 * Now fifteen people wear the painted townsfolk (and an orc and an undead in hero costume), and each has places they like to be:
 * the inn's front door, the forge, the bank, the casino, the well, the fishing hut and the lake shore, the road up to the Altar.
 * They walk the painted roads between them - across the square round the well, each on a lane of their own, easing into a stride
 * and slowing as they arrive - and there they stand a while, glance about and turn to whoever is standing near. Two who meet on
 * the road may stop for a word, one now and then stops to look round, and a few go through a portal (to the Farm, the City, the
 * Wasteland, the Altar) and come back out of it a minute later. At night the inn draws them.
 * The zone is 2600 x 1700 with moonshine_map.png stretched over it, so every point here is a world unit measured on that painting
 * (road middles traced from its dirt, doors from HOME_BUILDINGS, the grass paths kept clear of the seeded trees and rocks).
 * Pure module: no DOM, no game - it runs headless in the tests; game.js gives each person their race and gender from the skin
 * and draws them with drawNpc. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.MoonshineFolk=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WELL=Object.freeze({x:1281,y:881});
 const WELL_CLEAR=60;   /* the well is drawn 75 wide: a walk across the square keeps this far from its middle, a detour goes round at +18 */
 /* [id, x, y]: the eight mouths on the rim of the square, each road outward along the middle of its painted dirt to where it runs
    into a building or a portal, then the few steps over the grass to a door, the fishing hut and the shore. P is the square. */
 const NODES=[
  ['P',1281,876],
  ['mN',1268,640],['mNE',1480,722],['mE',1522,880],['mSE',1478,1030],['mS',1266,1115],['mSW',1075,1020],['mW',1040,878],['mNW',1075,725],
  ['n1',1268,525],['n2',1228,440],['n3',1170,360],['n4',1162,305],['n5',1190,250],['n6',1232,200],['altarGate',1260,150],
  ['s1',1270,1210],['s2',1252,1295],['s3',1228,1360],['s4',1200,1425],['wasteGate',1220,1500],
  ['w1',860,879],['w2',620,879],['w3',400,878],['farmGate',160,850],
  ['e1',1760,881],['e2',2050,880],['e3',2300,879],['cityGate',2440,850],
  ['nw1',990,695],['nw2',920,661],['nw3',860,611],['nw4',800,543],['nw5',750,492],['nw6',675,466],
  ['sw1',985,1050],['sw2',920,1107],['sw3',860,1161],['sw4',815,1215],['sw5',775,1295],['sw6',720,1338],['sw7',655,1358],
  ['ne1',1565,712],
  ['se1',1565,1075],['se2',1620,1135],['se3',1680,1190],['se4',1720,1240],['se5',1790,1256],['se6',1845,1270],
  ['t1',1695,1330],['t2',1700,1445],['t3',1745,1585],['tavern',1935,1556],   /* off the south-east road, round the inn's west end to its door */
  ['f1',695,1440],['smith',570,1482],                                        /* off the forge's road end to its door */
  ['bank',626,498],['casino',1622,698],
  ['h1',1865,780],['h2',1945,625],['hut',2022,566],['h3',1938,480],['shore',1962,400],   /* up from the east road, east of the casino */
 ];
 const CHAINS=[
  'P mN','P mNE','P mE','P mSE','P mS','P mSW','P mW','P mNW',
  'mN n1 n2 n3 n4 n5 n6 altarGate','mS s1 s2 s3 s4 wasteGate','mW w1 w2 w3 farmGate','mE e1 e2 e3 cityGate',
  'mNW nw1 nw2 nw3 nw4 nw5 nw6 bank','mSW sw1 sw2 sw3 sw4 sw5 sw6 sw7','mNE ne1 casino','mSE se1 se2 se3 se4 se5 se6',
  'se4 t1 t2 t3 tavern','sw6 f1 smith','e1 h1 h2 hut','h2 h3 shore',
 ];
 const POS={},ADJ={};
 for(const [id,x,y] of NODES){POS[id]=Object.freeze({x,y});ADJ[id]=[];}
 for(const chain of CHAINS){const ids=chain.split(' ');for(let i=1;i<ids.length;i++){ADJ[ids[i-1]].push(ids[i]);ADJ[ids[i]].push(ids[i-1]);}}
 /* a stroll ends at one of these: any point of a road - not its mouth, not a doorstep, and not the last bend under a portal */
 const STROLL=NODES.map(n=>n[0]).filter(id=>/^(n|s|w|e|nw|sw|ne|se)\d$/.test(id)&&id!=='n6'&&id!=='s4');
 /* where they go and what they do there. node: where the walk ends in the graph; x,y +- rx,ry: the patch they stand on (a point
    is drawn in it, clear of anyone standing or heading there); ring: a band round the well instead; face: the x they turn to (a
    door, the well, the water) - none, either way; wait: seconds; gone: a portal they step through and come back out of */
 const SPOTS=Object.freeze({
  well:     {node:'P',ring:[62,74],flat:.5,front:true,face:'well',wait:[6,16]},   /* beside it or in front, not hidden behind it */
  plaza:    {node:'P',ring:[85,205],wait:[4,12]},
  tavern:   {node:'tavern',x:1935,y:1544,rx:76,ry:16,face:1950,wait:[12,30]},   /* on the grass below the inn's steps - room for the evening crowd */
  smith:    {node:'smith',x:566,y:1484,rx:30,ry:6,face:552,wait:[10,24]},
  bank:     {node:'bank',x:626,y:498,rx:26,ry:7,face:570,wait:[6,15]},
  casino:   {node:'casino',x:1622,y:698,rx:36,ry:8,face:1651,wait:[8,20]},
  hut:      {node:'hut',x:2022,y:566,rx:16,ry:6,face:2042,wait:[10,22]},
  shore:    {node:'shore',x:1962,y:400,rx:14,ry:14,face:2200,wait:[15,40]},
  altar:    {node:'n4',x:1164,y:302,rx:16,ry:14,face:1260,wait:[8,18]},
  farmroad: {node:'w2',x:620,y:879,rx:100,ry:16,wait:[4,10]},
  cityroad: {node:'e2',x:2050,y:880,rx:100,ry:16,wait:[4,10]},
  southroad:{node:'s2',x:1252,y:1295,rx:12,ry:20,wait:[4,10]},
  stroll:   {stroll:true,wait:[2,6]},
  altarGate:{node:'altarGate',gone:true},
  wasteGate:{node:'wasteGate',gone:true},
  farmGate: {node:'farmGate',gone:true},
  cityGate: {node:'cityGate',gone:true},
 });
 /* [name, skin, pace in world units a second, where they like to go and how much] - the eight who lived here before keep their
    names and paces; seven more came with faces nobody in Moonshine had yet */
 const FOLK=[
  ['Sven-Ove','male',34,{farmroad:3,farmGate:2,well:2,tavern:2,plaza:1,stroll:1}],
  ['Gunnar Guldtand','blacksmith',28,{smith:5,tavern:3,well:1,plaza:1}],
  ['Barbro Brattom','baker',62,{plaza:3,well:2,tavern:2,bank:1,casino:1,smith:1}],
  ['Little Kjell','dockhand',42,{stroll:2,smith:2,tavern:2,hut:2,bank:1,casino:1,cityroad:1,plaza:1}],
  ['Ragnar Lagom','orcmale_warrior',24,{tavern:4,casino:2,southroad:2,wasteGate:1,plaza:1}],
  ['Fisherman Frasse','sailor',32,{shore:4,hut:3,tavern:2,well:1}],
  ['Auntie Ulla','undeadfemale_priest',27,{altar:3,well:2,plaza:2,bank:1,tavern:1}],
  ['Borje Junior','noble_dandy',38,{casino:5,bank:3,tavern:2,plaza:1}],
  ['Fishwife Greta','fishwife',30,{hut:3,plaza:3,tavern:2,well:1,shore:1}],
  ['Brother Holger','monk',26,{altar:4,altarGate:1,well:2,plaza:1}],
  ['Apple Stina','market_woman',34,{plaza:3,farmroad:2,well:2,tavern:1,casino:1}],
  ['Merchant Tore','merchant',30,{bank:4,cityGate:2,cityroad:2,casino:1,tavern:1}],
  ['Peddler Ossian','spice_merchant',30,{plaza:3,cityroad:2,cityGate:1,tavern:2,casino:1}],
  ['Apprentice Bosse','foundry_worker',40,{smith:5,well:1,tavern:1,stroll:1}],
  ['Sister Agnes','female',26,{altar:3,well:2,plaza:2,southroad:1}],
 ];
 const TALK=95;   /* two standing this close turn to each other */

 /* the shortest way through the graph (Dijkstra - it is five dozen nodes) */
 function route(from,to){
  if(from===to)return [from];
  const dist={[from]:0},prev={},open=new Set([from]);
  while(open.size){
   let u=null;for(const k of open)if(u===null||dist[k]<dist[u])u=k;
   open.delete(u);if(u===to)break;
   for(const v of ADJ[u]){
    const d=dist[u]+Math.hypot(POS[u].x-POS[v].x,POS[u].y-POS[v].y);
    if(dist[v]===undefined||d<dist[v]){dist[v]=d;prev[v]=u;open.add(v);}
   }
  }
  if(dist[to]===undefined)return null;
  const ids=[to];while(ids[0]!==from)ids.unshift(prev[ids[0]]);
  return ids;
 }
 /* where a walker is going to stand at the end of the walk */
 const goalOf=m=>m.state==='walk'&&m.path?m.path[m.path.length-1]:m;
 /* a point to stand on in a spot, clear of whoever stands there or is on the way there */
 function spotPoint(s,rng,people,n){
  for(let tries=0;;tries++){
   let p;
   if(s.ring){const a=s.front?-.3+rng()*(Math.PI+.6):rng()*Math.PI*2,r=s.ring[0]+rng()*(s.ring[1]-s.ring[0]);p={x:WELL.x+Math.cos(a)*r,y:WELL.y+Math.sin(a)*r*(s.flat||1),node:'P'};}
   else if(s.stroll){const id=STROLL[Math.floor(rng()*STROLL.length)];p={x:POS[id].x+(rng()-.5)*36,y:POS[id].y+(rng()-.5)*36,node:id};}
   else if(s.gone)return {x:POS[s.node].x,y:POS[s.node].y,node:s.node};
   else p={x:s.x+(rng()*2-1)*s.rx,y:s.y+(rng()*2-1)*s.ry,node:s.node};
   if(tries>=6||!people.some(m=>m!==n&&!m.hidden&&Math.hypot(goalOf(m).x-p.x,goalOf(m).y-p.y)<38))return p;
  }
 }
 function facing(s,n,rng){
  if(s.face==='well')return WELL.x>n.x?1:-1;
  if(typeof s.face==='number')return s.face>n.x?1:-1;
  return rng()<.5?1:-1;
 }
 /* the walk to a spot: the graph's way there from the node the walker stands at, the square crossed straight (P is only the hub),
    every bend moved sideways onto this walk's own lane, and a step round the well where a line would clip it */
 function plan(n,id,rng,people){
  const s=SPOTS[id],goal=spotPoint(s,rng,people,n),ids=route(n.node,goal.node)||[n.node,goal.node];
  const pts=[{x:n.x,y:n.y}];
  for(let i=1;i<ids.length-1;i++)if(ids[i]!=='P')pts.push({x:POS[ids[i]].x,y:POS[ids[i]].y});
  pts.push({x:goal.x,y:goal.y});
  const lane=(rng()*2-1)*20;
  for(let i=1;i<pts.length-1;i++){
   const a=pts[i-1],b=pts[i+1],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;
   pts[i].x+=-dy/l*lane;pts[i].y+=dx/l*lane;
  }
  for(let pass=0;pass<4;pass++){
   let bent=false;
   for(let i=1;i<pts.length&&!bent;i++){
    const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=((WELL.x-a.x)*dx+(WELL.y-a.y)*dy)/L;
    if(t<=0||t>=1)continue;
    const cx=a.x+dx*t,cy=a.y+dy*t,d=Math.hypot(cx-WELL.x,cy-WELL.y);
    if(d>=WELL_CLEAR)continue;
    let ux=(cx-WELL.x)/d,uy=(cy-WELL.y)/d;
    if(!(d>1)){const l=Math.sqrt(L);ux=-dy/l;uy=dx/l;}
    pts.splice(i,0,{x:WELL.x+ux*(WELL_CLEAR+18),y:WELL.y+uy*(WELL_CLEAR+18),tight:true});bent=true;
   }
   if(!bent)break;
  }
  n.path=pts;n.k=1;n.node=goal.node;n.dest=id;
 }
 const left=n=>{if(!n.path)return 0;let L=0,x=n.x,y=n.y;for(let i=n.k;i<n.path.length;i++){L+=Math.hypot(n.path[i].x-x,n.path[i].y-y);x=n.path[i].x;y=n.path[i].y;}return L;};
 function nearest(n,people,r,ok){
  let best=null,bd=r;
  for(const m of people){if(m===n||m.hidden||!ok(m))continue;const d=Math.hypot(m.x-n.x,m.y-n.y);if(d<bd){bd=d;best=m;}}
  return best;
 }
 /* the next place to go: by the walker's own liking, the nearer the likelier (a walk across the whole village is the exception,
    not every other trip), never the same doorstep twice running; the inn counts four times at night */
 function choose(n,rng,night){
  const w=[];let sum=0;
  for(const id in n.haunts){
   const s=SPOTS[id];
   if(id===n.dest&&!s.ring&&!s.stroll)continue;
   const at=s.ring?WELL:s.stroll?null:s.x!==undefined?s:POS[s.node],near=at?600/(600+Math.hypot(at.x-n.x,at.y-n.y)):.6;
   const k=n.haunts[id]*(night&&id==='tavern'?4:1)*near;w.push([id,k]);sum+=k;
  }
  let r=rng()*sum;for(const [id,k] of w)if((r-=k)<=0)return id;
  return w[w.length-1][0];
 }
 function depart(n,rng,people,night){
  plan(n,choose(n,rng,night),rng,people);
  n.state='walk';n.go=0;n.pace=.88+rng()*.24;n.walkT=0;
  n.budget=left(n)/(n.speed*n.pace*.3)+6;               /* a walk that has taken this long ends where it is - nobody is ever stuck */
  n.pauseIn=rng()<.22?2+rng()*6:0;                        /* now and then a stop on the way, to look round */
 }
 function arrive(n,rng,people,night){
  const s=SPOTS[n.dest];
  n.vx=n.vy=0;n.go=0;n.moving=false;n.path=null;
  if(s.gone){n.state='out';if(n.fade==null)n.fade=1;return;}
  n.state='idle';n.wait=s.wait[0]+rng()*(s.wait[1]-s.wait[0]);
  if(night&&n.dest==='tavern')n.wait*=2;
  n.rest=facing(s,n,rng);n.fx=n.rest;n.lookT=1+rng()*2;
  const mate=nearest(n,people,TALK,m=>m.state==='idle');
  if(mate){n.fx=mate.x>n.x?1:-1;mate.fx=-n.fx;mate.lookT=Math.max(mate.lookT,2);n.wait+=2+rng()*3;}   /* somebody to talk to */
 }
 function walk(n,dt,rng,people,night){
  if(n.fade!=null&&(n.fade+=dt*2)>=1)n.fade=null;       /* coming out of a portal */
  n.walkT+=dt;
  if(n.pauseIn>0&&(n.pauseIn-=dt)<=0&&left(n)>90){n.state='pause';n.wait=1+rng()*1.5;n.lookT=.4+rng()*.5;n.vx=n.vy=0;n.go=0;n.moving=false;return;}
  let p=n.path[n.k];
  while(n.k<n.path.length-1&&Math.hypot(p.x-n.x,p.y-n.y)<(p.tight?8:18))p=n.path[++n.k];   /* a bend is taken as a curve, not a corner - but the way round the well is walked, not cut */
  const last=n.k===n.path.length-1,dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy);
  if(last&&(d<2||n.walkT>n.budget)){if(n.walkT>n.budget){n.x=p.x;n.y=p.y;}arrive(n,rng,people,night);return;}
  n.go=Math.min(1,n.go+dt*2.4);
  const v=n.speed*n.pace*(.3+.7*n.go)*(last?Math.max(.3,Math.min(1,d/36)):1),a=Math.min(1,dt*6);
  n.vx+=(dx/d*v-n.vx)*a;n.vy+=(dy/d*v-n.vy)*a;
  n.x+=n.vx*dt;n.y+=n.vy*dt;
  const sp=Math.hypot(n.vx,n.vy);
  if(Math.abs(n.vx)>6)n.fx=n.vx>0?1:-1;
  n.moving=sp>4;n.walk+=dt*sp/45;
 }
 function idle(n,dt,rng,people,night){
  n.wait-=dt;
  if((n.lookT-=dt)<=0){
   const mate=nearest(n,people,TALK,m=>m.state==='idle'||m.state==='chat');
   if(mate){n.fx=mate.x>n.x?1:-1;n.lookT=2.5+rng()*3.5;}
   else if(n.fx===n.rest&&rng()<.45){n.fx=-n.rest;n.lookT=.7+rng()*1.3;}   /* a glance over the shoulder */
   else{n.fx=n.rest;n.lookT=2+rng()*4;}
  }
  if(n.wait<=0)depart(n,rng,people,night);
 }
 /* two walkers coming towards each other on the road: now and then they stop for a word */
 function meet(people,rng){
  for(let i=0;i<people.length;i++){
   const a=people[i];if(a.state!=='walk'||a.meetCool>0||a.fade!=null)continue;
   for(let j=i+1;j<people.length;j++){
    const b=people[j];if(b.state!=='walk'||b.meetCool>0||b.fade!=null)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>60||d<26||(b.vx-a.vx)*dx+(b.vy-a.vy)*dy>=0)continue;
    if(left(a)>70&&left(b)>70&&rng()<.4){
     const t=2.5+rng()*3.5;
     for(const [p,q] of [[a,b],[b,a]]){p.state='chat';p.wait=t;p.fx=q.x>p.x?1:-1;p.vx=p.vy=0;p.go=0;p.moving=false;p.meetCool=35+rng()*40;}
    }else a.meetCool=b.meetCool=5;
    break;
   }
  }
 }
 /* one frame of Moonshine: everybody with somewhere to be */
 function step(folk,dt,rng,opts){
  rng=rng||Math.random;
  const night=!!(opts&&opts.night),people=folk.filter(n=>n.roam);
  meet(people,rng);
  for(const n of people){
   if(n.meetCool>0)n.meetCool-=dt;
   if(n.state==='walk')walk(n,dt,rng,people,night);
   else if(n.state==='idle')idle(n,dt,rng,people,night);
   else if(n.state==='chat'||n.state==='pause'){
    if(n.state==='pause'&&(n.lookT-=dt)<=0){n.fx=-n.fx;n.lookT=1e9;}   /* one look back the way they came */
    if((n.wait-=dt)<=0)n.state='walk';
   }else if(n.state==='out'){if((n.fade-=dt*2)<=0){n.fade=0;n.hidden=true;n.state='gone';n.wait=25+rng()*45;}}
   else if(n.state==='gone'&&(n.wait-=dt)<=0){n.hidden=false;n.fade=0;depart(n,rng,people,night);}
  }
  /* two standing or passing close would print their names over each other: from left to right each takes the lowest line its
     neighbours have left free (drawNpc lifts the name by nameLift), eased so a name never jumps */
  const shown=people.filter(n=>!n.hidden).sort((a,b)=>a.x-b.x);
  for(let j=0;j<shown.length;j++){
   const b=shown[j],used=new Set();
   for(let i=j-1;i>=0&&b.x-shown[i].x<84;i--)if(Math.abs(shown[i].y-b.y)<26)used.add(shown[i].liftTo);
   b.liftTo=[0,13,26].find(l=>!used.has(l))??26;
   b.nameLift=(b.nameLift||0)+(b.liftTo-(b.nameLift||0))*Math.min(1,dt*8);
  }
 }
 /* the people, each standing somewhere they like to be, then three quarters of a minute of the day gone by so that some are
    walking and some talking when you arrive */
 function create(rng){
  rng=rng||Math.random;
  const people=FOLK.map(([name,skin,speed,haunts])=>({name,skin,speed,haunts,roam:true,x:0,y:0,fx:1,walk:rng()*5,moving:false,
   vx:0,vy:0,go:0,pace:1,walkT:0,budget:0,pauseIn:0,meetCool:5+rng()*20,state:'idle',wait:0,lookT:0,rest:1,node:'P',dest:null,path:null,k:0}));
  for(const n of people){
   const homes=Object.keys(n.haunts).filter(id=>!SPOTS[id].gone),id=homes[Math.floor(rng()*homes.length)],s=SPOTS[id],p=spotPoint(s,rng,people,n);
   Object.assign(n,{x:p.x,y:p.y,node:p.node,dest:id,wait:rng()*s.wait[1],lookT:rng()*3});
   n.rest=n.fx=facing(s,n,rng);
  }
  for(let t=0;t<45;t+=.05)step(people,.05,rng);
  return people;
 }
 return {create,step,route,left,NODES,CHAINS,SPOTS,FOLK,STROLL,WELL,WELL_CLEAR,pos:id=>POS[id]};
});
