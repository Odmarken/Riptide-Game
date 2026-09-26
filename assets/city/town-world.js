/* ⚓ The ports of call: the towns Captain Blackbeard sails the Black Tide to. Each town is one data file in
 * assets/city/towns/ that hands register() its plan - a coastline, roads, squares, piers, the houses along them,
 * the things that stand about, the ships at berth, and the people who walk it - and this module turns that plan
 * into a world the game can walk, collide with and paint. Adding a port is one more file and one more zone.
 *
 * The ground is drawn per frame from tiles, camera-culled, exactly like the Harbour: the sea is two drifting layers
 * of one seamless tile with a depth shade and glints, the land is laid over it clipped to its coastline, roads and
 * squares over the land, quay kerbs and foam along the water, piers on top, and a painted backdrop across the far
 * edge. Nothing here allocates a world-sized canvas. Pure module: no DOM, no game - it runs headless in the tests;
 * game.js hands it images and a clock. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.TownWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const ready=im=>!!(im&&im.complete!==false&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0);
 const iw=im=>im.naturalWidth||im.width,ih=im=>im.naturalHeight||im.height;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const hash=(a,b)=>{let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663)^0x9e3779b9)>>>0;h=Math.imul(h^(h>>>15),2246822519)>>>0;h=Math.imul(h^(h>>>13),3266489917)>>>0;return (h^(h>>>16))>>>0;};
 const unit=(a,b,salt=0)=>(hash(a+salt*7919,b-salt*104729)%100000)/100000;
 function rng32(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
 const TOWNS={},ORDER=[];
 let remembered={},lastImages=null;
 /* the pictures handed in are merged into what is remembered only when a new set arrives: the game passes the same object
    every frame, and copying sixty entries for each of two hundred props made a town's frame measurably slower */
 function remember(images){if(images&&images!==lastImages){lastImages=images;Object.assign(remembered,images);}}

 /* ---------- the paintings a port may put up ----------
    src is the picture under assets/city/ (no .png); h (or w, for what is berthed by its length) its drawn size in world
    units, ar its width over its height, drop how far below the anchor its foot lands. house: a building - it blocks
    with an ellipse under its front (crx is worked out from its width). float rides the water; wash stands in it.
    glow/fire/smoke are in the picture's own frame (u across, v down); sway leans a crown in the wind; flag waves. */
 const ART={
  galleon:{src:'harbor/ship_galleon',w:960,ar:1.080,drop:26,float:{amp:5,rot:.008,speed:.62}},
  carrack:{src:'harbor/ship_carrack',w:1000,ar:1.069,drop:26,float:{amp:4.5,rot:.007,speed:.55}},
  sloop:{src:'harbor/ship_sloop',w:520,ar:1.096,drop:16,float:{amp:5,rot:.016,speed:.9}},
  rowboat:{src:'harbor/rowboat',w:190,ar:2.424,drop:26,float:{amp:3,rot:.035,speed:1.3}},
  buoy:{src:'harbor/buoy',h:120,ar:.634,drop:6,float:{amp:5,rot:.10,speed:1.15},glow:[[.5,.10,70]]},
  rocks:{src:'harbor/sea_rocks',h:210,ar:1.217,drop:8,wash:true},
  crates:{src:'harbor/cargo_crates',h:150,ar:1.368,drop:16,r:58},barrels:{src:'harbor/cargo_barrels',h:150,ar:1.017,drop:12,r:50},
  loot:{src:'harbor/cargo_loot',h:96,ar:1.373,drop:10,r:36},anchor:{src:'harbor/anchor',h:150,ar:.773,drop:12,r:40},
  bollard:{src:'harbor/bollard',h:46,ar:1.021,drop:8,r:13},cannon:{src:'harbor/cannon',h:74,ar:1.813,drop:10,r:34},
  pots:{src:'harbor/lobster_pots',h:96,ar:1.107,drop:10,r:34},fishrack:{src:'harbor/fish_rack',h:150,ar:1.342,drop:12,r:52},
  upturned:{src:'harbor/boat_upturned',h:112,ar:1.689,drop:12,r:56},post:{src:'harbor/pier_post',h:88,ar:.359,drop:34,noShadow:true},
  crane:{src:'harbor/harbor_crane',h:430,ar:.770,drop:14,r:40,crx:60,cry:20,cyo:-14},
  beacon:{src:'harbor/harbor_beacon',h:470,ar:.358,drop:18,r:50,glow:[[.5,.20,260]],fire:[.5,.19,1.5]},
  h_warehouse:{src:'harbor/harbor_warehouse',noFlip:true,h:470,ar:.994,drop:16,house:true,smoke:[[.77,.02,1]]},
  h_tavern:{src:'harbor/harbor_tavern',noFlip:true,h:440,ar:.766,drop:16,house:true,smoke:[[.77,.08,1]],glow:[[.42,.55,170]]},
  h_fishhouse:{src:'harbor/harbor_fishhouse',noFlip:true,h:380,ar:1.018,drop:16,house:true,smoke:[[.79,.09,1.1]]},
  h_chandlery:{src:'harbor/harbor_chandlery',noFlip:true,h:450,ar:.579,drop:16,house:true,smoke:[[.73,.01,.9]]},
  h_office:{src:'harbor/harbor_office',noFlip:true,h:430,ar:.739,drop:16,house:true,glow:[[.5,.62,150]]},
  lamp:{src:'lamp',h:150,ar:.2,drop:8,r:9,glow:[[.5,.16,170]]},
  fountain:{src:'fountain',h:250,ar:.959,drop:10,r:0,crx:115,cry:40,cyo:-30,spray:[[.5,.1,1],[.5,.1,-1]]},
  stall_fish:{src:'stall_fish',h:170,ar:1.072,drop:14,r:54},stall_cloth:{src:'stall_cloth',h:170,ar:.995,drop:14,r:54},
  stall_bread:{src:'stall_bread',h:170,ar:1.041,drop:14,r:54},stall_greens:{src:'stall_greens',h:170,ar:1.054,drop:14,r:54},
  tent_red:{src:'tent_red',h:230,ar:.792,drop:12,r:62},tent_blue:{src:'tent_blue',h:230,ar:.770,drop:12,r:62},
  flower_tub:{src:'flower_tub',h:92,ar:.888,drop:8,r:24},handcart:{src:'handcart',h:92,ar:2.045,drop:8,r:40},
  wagon_barrels:{src:'wagon_barrels',h:132,ar:2.270,drop:10,r:70},wagon_grain:{src:'wagon_grain',h:128,ar:2.310,drop:10,r:70},
  linden:{src:'ground/tree_linden',h:330,ar:.763,drop:12,r:15,sway:true},apple:{src:'ground/tree_apple',h:215,ar:.809,drop:10,r:12,sway:true},
  bush:{src:'ground/bush',h:74,ar:1.309,drop:8,r:0},woodpile:{src:'ground/woodpile',h:112,ar:1.311,drop:10,r:30},
  trough:{src:'ground/trough',h:96,ar:1.495,drop:10,r:32},laundry:{src:'ground/laundry',h:120,ar:1.763,drop:6,r:0},
 };
 const SHARED_TILES=Object.freeze({sea:'harbor/sea_tile',quay:'harbor/quay_paving',planks:'harbor/planks',gull:'harbor/seagull'});

 /* ---------- the register ---------- */
 function register(def){
  if(!def||!def.id||!def.w||!def.h||!(Array.isArray(def.land)||Array.isArray(def.lands)))throw new Error('TownWorld.register: a town needs an id, a size and a coastline');
  /* lands: several separate floors (the rooms of a palace, a jail further down the map); land is the first of them */
  if(!Array.isArray(def.lands))def.lands=[def.land];
  def.land=def.lands[0];
  for(const [k,a] of Object.entries(def.art||{})){if(ART[k]&&ART[k].src!==a.src)throw new Error('TownWorld: '+k+' is already another picture');ART[k]=a;}
  if(!TOWNS[def.id])ORDER.push(def.id);
  TOWNS[def.id]=def;
  return def;
 }
 const town=id=>TOWNS[id]||null;
 const list=()=>ORDER.map(id=>TOWNS[id]);

 /* ---------- the ground a foot may stand on ---------- */
 function inPoly(pts,x,y){
  let c=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
   const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
   if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;
  }
  return c;
 }
 function segDist(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?clamp(((px-ax)*dx+(py-ay)*dy)/l,0,1):0;
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
 }
 function onLand(def,x,y,r){
  for(const hole of def.holes||[])if(inPoly(hole,x,y))return false;
  for(const L of def.lands){
   if(!inPoly(L,x,y))continue;
   if(r>0)for(let i=0,j=L.length-1;i<L.length;j=i++){const a=L[j],b=L[i];if(segDist(x,y,a[0],a[1],b[0],b[1])<r)return false;}
   return true;
  }
  return false;
 }
 /* a pier is open where it meets the land (open: 'n' for a pier that leaves the quay going south, and so on) */
 function onPier(p,x,y,r){
  if(p.r)return Math.hypot(x-p.x,y-p.y)<=p.r-r;
  const o=p.open||'n';
  const top=o.includes('n')?0:r,bottom=o.includes('s')?0:r,left=o.includes('w')?0:r,right=o.includes('e')?0:r;
  return x>=p.x+left&&x<=p.x+p.w-right&&y>=p.y+top&&y<=p.y+p.h-bottom;
 }
 function contains(world,x,y,r=0){
  const def=TOWNS[world&&world.town];
  if(!def||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  if(x<r||y<r||x>def.w-r||y>def.h-r)return false;
  if(onLand(def,x,y,r))return true;
  for(const p of def.piers||[])if(onPier(p,x,y,r))return true;
  return false;
 }

 /* ---------- the walks: every road and path is a line of nodes, joined where two share a point ---------- */
 function graph(def){
  const nodes=new Map(),edges=new Map(),key=(x,y)=>Math.round(x)+','+Math.round(y);
  const node=(x,y,j)=>{const k=key(x,y);if(!nodes.has(k)){nodes.set(k,{id:k,x,y,j});edges.set(k,new Set());}else nodes.get(k).j=Math.min(nodes.get(k).j,j);return k;};
  const lines=[...(def.roads||[]).filter(r=>!r.noWalk),...(def.paths||[])];
  for(const r of lines){
   const j=clamp((r.w||80)*.12,4,18);let prev=null;
   for(const [x,y] of r.pts){const k=node(x,y,j);if(prev&&prev!==k){edges.get(prev).add(k);edges.get(k).add(prev);}prev=k;}
  }
  return {nodes,edges:new Map([...edges].map(([k,v])=>[k,[...v]]))};
 }
 function route(G,R,steps,start){
  const ids=[...G.nodes.keys()];let at=start||ids[Math.floor(R()*ids.length)],from=null;const out=[at];
  for(let i=0;i<steps;i++){
   const next=G.edges.get(at).filter(n=>n!==from&&!out.includes(n));
   if(!next.length)break;
   from=at;at=next[Math.floor(R()*next.length)];out.push(at);
  }
  return out.map(id=>{const n=G.nodes.get(id);return {x:n.x+(R()*2-1)*n.j,y:n.y+(R()*2-1)*n.j};});
 }
 const HERO_SKIN=/^(human|dwarf|orc|undead)(male|female)_(warrior|mage|hunter|priest)$/;
 const isWoman=skin=>/^(female|baker|market_woman|fishwife|noble_lady|noble_dowager|noble_maiden)$|female_/.test(skin||'');
 function stand(name,skin,x,y,fx,extra){
  const c=HERO_SKIN.exec(skin||'');
  return {name,skin,race:c?c[1]:'human',cls:c?c[3]:'warrior',female:isWoman(skin),big:1.18,pts:[{x,y}],i:0,dir:1,x,y,speed:0,walk:0,fx,pauseT:1e9,moving:false,...extra};
 }
 const BLACKBEARD_SAY=Object.freeze(['The Black Tide sails when you say so. Where to?','Every port has a price. Mine is only a good story.','Mind the gangplank - it bites.','Silverfjord, Ravenholt, Emberfall, Meridian... or home. Choose, and we cast off.']);

 /* ---------- a town, built ---------- */
 const artOf=kind=>{const a=ART[kind];if(!a)throw new Error('TownWorld: no picture called '+kind);return a;};
 /* the pixel sizes of the towns' own pictures (towns-art.js, written by the art installer), so a house's footprint is
    known before its picture has loaded */
 const SIZES={};
 function sizes(map){for(const [k,v] of Object.entries(map||{}))if(Array.isArray(v)&&v[0]>0&&v[1]>0)SIZES[k]=[v[0],v[1]];}
 const aspect=a=>a.ar||(SIZES[a.src]?SIZES[a.src][0]/SIZES[a.src][1]:1);
 const drawnW=a=>a.w||a.h*aspect(a);
 function create(id,options={}){
  const def=TOWNS[id];if(!def)throw new Error('TownWorld: no town called '+id);
  const R=rng32(options.seed===undefined?(def.seed||1):options.seed),G=graph(def),npcs=[];
  const starts=[...G.nodes.keys()];
  for(const [name,skin,where] of def.folk||[]){
   let pts=null;
   for(let t=0;t<10&&!(pts&&pts.length>=3);t++){
    const s=where?starts.filter(k=>{const n=G.nodes.get(k);return n.x>=where[0]&&n.x<=where[2]&&n.y>=where[1]&&n.y<=where[3];}):starts;
    pts=route(G,R,4+Math.floor(R()*4),s[Math.floor(R()*s.length)]);
   }
   const c=HERO_SKIN.exec(skin);
   npcs.push({name,skin,race:c?c[1]:'human',cls:c?c[3]:'warrior',female:isWoman(skin),pts,i:0,dir:1,x:pts[0].x,y:pts[0].y,
    speed:/dockhand|soldier|guard/.test(skin)?30+R()*16:24+R()*30,walk:R()*5,fx:1,pauseT:R()*3,moving:false});
  }
  for(const s of def.stands||[])npcs.push(stand(s.name,s.skin,s.x,s.y,s.fx||1,{big:s.big||1.18,...(s.game?{game:s.game}:{}),...(s.say?{say:s.say.slice()}:{}),...(s.extra||{})}));
  const bb=def.blackbeard;   /* every port has him by his ship; a palace does not */
  if(bb)npcs.push(stand('Captain Blackbeard','pirate_captain',bb.x,bb.y,bb.fx||1,{big:1.3,game:'captain',voyage:true,say:(bb.say||BLACKBEARD_SAY).slice()}));
  const solids=[],mwalls=(def.blocks||[]).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h}));   /* blocks: plain rectangles nobody walks through */
  const put=(kind,x,y,extra={})=>{
   const a=artOf(kind),s={x,y,r:a.r===undefined?24:a.r,type:'townprop',kind,seed:+(x*.013+y*.007).toFixed(3),...(def.light!==undefined?{glowK:def.light}:{}),...extra};
   if(a.noFlip)s.flip=false;   /* a sign with letters on it would read backwards */
   if(a.house){const W=drawnW(a);s.big=true;s.crx=extra.crx||a.crx||Math.round(W*.44);s.cry=extra.cry||a.cry||44;s.cyo=extra.cyo||a.cyo||-32;s.r=Math.round(W*.3);}
   else if(a.crx){s.crx=a.crx;s.cry=a.cry;s.cyo=a.cyo;}
   if(!s.r&&!s.crx)s.noCol=true;
   if(!s.half)s.half=Math.round(drawnW(a)/2);
   solids.push(s);
  };
  /* a run of wall: its strip picture tiled from x0 to x1, standing on y; it blocks along its foot */
  for(const w of def.walls||[]){
   const a=artOf(w.kind),span=w.x1-w.x0,depth=w.depth||46;
   solids.push({x:(w.x0+w.x1)/2,y:w.y,r:0,type:'townprop',kind:w.kind,span,half:Math.round(span/2),noCol:true,seed:+(w.x0*.01).toFixed(3)});
   mwalls.push({x:w.x0,y:w.y-depth,w:span,h:depth+6});
  }
  /* a wall running north-south is seen from above: it is ground, painted with the floor, and blocks along its whole run */
  for(const w of def.vwalls||[])mwalls.push({x:w.x-w.w/2,y:w.y0,w:w.w,h:w.y1-w.y0});
  for(const d of def.decals||[])if(d.block)mwalls.push({x:d.x-d.w/2,y:d.y-d.h/2,w:d.w,h:d.h});
  for(const b of def.buildings||[])put(b[0],b[1],b[2],b[3]);
  for(const p of def.props||[])put(p[0],p[1],p[2],p[3]);
  for(const sh of def.ships||[])put(sh[0],sh[1],sh[2],{noCol:true,floats:true,...(sh[3]||{})});
  /* the piles of every timber pier, down both sides and along the end: they stand in the water, so they block nobody */
  for(const p of def.piers||[]){
   if(p.kind!=='timber'||p.r)continue;
   const o=p.open||'n',vertical=o==='n'||o==='s';
   if(vertical){for(let y=p.y+120;y<=p.y+p.h-40;y+=190){put('post',p.x-4,y+36,{noCol:true});put('post',p.x+p.w+4,y+110,{noCol:true});}}
   else for(let x=p.x+60;x<=p.x+p.w-40;x+=200)put('post',x,p.y+p.h+30,{noCol:true});
  }
  /* links: a door or a stair. Walking onto one (within r) takes you to `at` - in another town when `to` names one, further
     along this map when it does not. `click` is the painting that opens it when clicked. */
  const links=(def.links||[]).map(l=>({...l,at:{...l.at},...(l.click?{click:{...l.click}}:{})}));
  return {key:'town',kind:'town',town:id,name:def.name,interior:!!def.interior,w:def.w,h:def.h,spawn:{...def.arrival},arrival:{...def.arrival},links,
   portal:{x:-500,y:-500},npcs,solids,mwalls,deco:[],waters:[],paths:[],floors:[],enemySpawns:[],bossRooms:[],entrances:[],pathY:-500,pathH:0};
 }

 /* ---------- painting helpers (the Harbour's, so the two seas are one sea) ---------- */
 function ellipse(g,x,y,rx,ry,fill){g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);g.fillStyle=fill;g.fill();}
 /* a glow is one radial gradient per tint, painted once into a small canvas and stretched - a gradient made afresh for
    every lamp in every frame cost Emberfall a tenth of its frame rate. Headless (no document) it is made the old way. */
 const glowCache={};
 function glowSprite(c){
  if(glowCache[c]!==undefined)return glowCache[c];
  let cv=null;
  try{if(typeof document!=='undefined'&&document.createElement){cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d'),grad=g.createRadialGradient(32,32,0,32,32,32);
   grad.addColorStop(0,'rgba('+c+',1)');grad.addColorStop(1,'rgba('+c+',0)');g.fillStyle=grad;g.fillRect(0,0,64,64);}}catch(e){cv=null;}
  return glowCache[c]=cv;
 }
 function light(g,x,y,r,strength=1,tint=[255,190,100]){
  if(!(strength>.02))return;
  const c=tint.join(','),sp=glowSprite(c);
  g.save();g.globalCompositeOperation='lighter';
  if(sp){g.globalAlpha*=Math.min(1,.34*strength);g.drawImage(sp,x-r,y-r,r*2,r*2);}
  else{const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba('+c+','+(.34*strength).toFixed(3)+')');grad.addColorStop(1,'rgba('+c+',0)');g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);}
  g.restore();
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
 function smoke(g,x,y,size,time,seed,dark=false){
  for(let i=0;i<6;i++){
   const p=(time*.11+i/6+seed*.37)%1,r=(7+p*24)*size;
   g.fillStyle=(dark?'rgba(58,52,50,':'rgba(222,226,228,')+((1-p)*(1-p)*(dark?.42:.36)).toFixed(3)+')';
   g.beginPath();g.ellipse(x+(p*46+Math.sin(time*.7+i*1.9+seed)*7)*size,y-p*96*size,r,r*.8,0,0,TAU);g.fill();
  }
 }
 function tiles(g,im,rc,size,v,mirror,turn){
  const x0=Math.max(rc.x,v.x0),y0=Math.max(rc.y,v.y0),x1=Math.min(rc.x+rc.w,v.x1),y1=Math.min(rc.y+rc.h,v.y1);
  if(x1<=x0||y1<=y0||!ready(im))return false;
  const ox=rc.ox===undefined?rc.x:rc.ox,oy=rc.oy===undefined?rc.y:rc.oy;
  g.save();g.beginPath();g.rect(x0,y0,x1-x0,y1-y0);g.clip();   /* the last row and column of tiles would hang over the edge */
  for(let j=Math.floor((y0-oy)/size);oy+j*size<y1;j++)for(let i=Math.floor((x0-ox)/size);ox+i*size<x1;i++){
   if(!mirror&&!turn){g.drawImage(im,ox+i*size-.4,oy+j*size-.4,size+.8,size+.8);continue;}
   g.save();g.translate(ox+(i+.5)*size,oy+(j+.5)*size);if(turn)g.rotate(Math.PI/2);
   if(mirror)g.scale((turn?j:i)%2?-1:1,(turn?i:j)%2?-1:1);
   g.drawImage(im,-size/2-.4,-size/2-.4,size+.8,size+.8);g.restore();
  }
  g.restore();
  return true;
 }
 function foamLine(g,pts,time,seed){
  g.save();g.lineCap='round';
  for(let j=1;j<pts.length;j++){
   const [ax,ay,nx,ny]=pts[j-1],[bx,by]=pts[j],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(!len)continue;
   for(let d=18;d<len-12;d+=43){
    const phase=time*1.25+seed+j*2.3+d*.079,p=(Math.sin(phase)+1)/2;
    const gap=5+p*12,x=ax+dx*d/len+nx*gap,y=ay+dy*d/len+ny*gap,span=8+8*Math.sin(d*.13+seed)**2;
    g.strokeStyle='rgba(210,239,237,'+(.05+.19*(1-p))+')';g.lineWidth=1.2+p*.7;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx/len*span*.5+nx*2,y+dy/len*span*.5+ny*2,x+dx/len*span,y+dy/len*span);g.stroke();
   }
  }
  g.restore();
 }
 /* the outward normal of a coastline edge: the side its own floor is not on */
 function edgeNormal(poly,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=dy/l,ny=-dx/l,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
  return inPoly(poly,mx+nx*6,my+ny*6)?[-nx,-ny]:[nx,ny];
 }
 function area(P){let t=0;for(let i=0,j=P.length-1;i<P.length;j=i++)t+=(P[j][0]*P[i][1]-P[i][0]*P[j][1]);return t/2;}
 /* every floor (and every hole in them) as one path, for an even-odd clip */
 function landPath(g,def){
  g.beginPath();
  for(const L of [...def.lands,...(def.holes||[])]){L.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();}
 }
 const onView=(x0,y0,x1,y1,v,pad=0)=>!(x1+pad<v.x0||x0-pad>v.x1||y1+pad<v.y0||y0-pad>v.y1);

 /* ---------- the ground ---------- */
 function sea(g,im,v,time,def){
  const S=def.sea||{};
  g.fillStyle=S.color||'#0f4f66';g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);
  const tile=im[S.tile||SHARED_TILES.sea];
  if(ready(tile)){
   g.save();g.beginPath();g.rect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);g.clip();
   for(const [size,dx,dy,alpha] of [[640,time*7,time*3,S.alpha||1],[1040,-time*5,time*6.5,.36]]){
    const ox=((dx%size)+size)%size,oy=((dy%size)+size)%size;g.globalAlpha=alpha;
    for(let ty=Math.floor((v.y0-oy)/size)*size+oy;ty<v.y1;ty+=size)for(let tx=Math.floor((v.x0-ox)/size)*size+ox;tx<v.x1;tx+=size)g.drawImage(tile,tx,ty,size+.6,size+.6);
   }
   g.restore();
  }
  if(S.shade){g.fillStyle=S.shade;g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);}
  const deep=g.createLinearGradient(0,def.shoreY||def.h*.7,0,def.h);deep.addColorStop(0,'rgba(10,52,72,0)');deep.addColorStop(1,'rgba(2,12,30,.45)');
  g.fillStyle=deep;g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);
  const cell=230;g.fillStyle=S.glint||'#f2fdff';
  for(let j=Math.floor(v.y0/cell);j*cell<v.y1;j++)for(let i=Math.floor(v.x0/cell);i*cell<v.x1;i++){
   const f=unit(i,j,1),f2=unit(i,j,2),a=Math.sin(time*(1.1+f*1.4)+f2*TAU);if(a<.55)continue;
   const x=(i+f)*cell,y=(j+f2)*cell,s=(a-.55)*16;
   g.globalAlpha=(a-.55)*1.7;g.beginPath();g.moveTo(x-s,y);g.lineTo(x,y-s*.45);g.lineTo(x+s,y);g.lineTo(x,y+s*.45);g.closePath();g.fill();
  }
  g.globalAlpha=1;
 }
 function polyPath(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();}
 /* a floor's tint is painted into a copy of its tile once, instead of a see-through sheet over the whole view every frame
    (headless - no document - it is laid the old way) */
 const tintCache=new Map();
 function tinted(im,shade){
  if(!shade||!ready(im)||typeof document==='undefined'||!document.createElement)return null;
  const key=(im.src||'')+'|'+shade;let c=tintCache.get(key);if(c)return c;
  try{c=document.createElement('canvas');c.width=iw(im);c.height=ih(im);const t=c.getContext('2d');t.drawImage(im,0,0);t.fillStyle=shade;t.fillRect(0,0,c.width,c.height);}catch(e){return null;}
  tintCache.set(key,c);return c;
 }
 function land(g,im,v,def){
  const F=def.floor||{};
  g.save();landPath(g,def);
  g.clip('evenodd');
  const tt=F.shade?tinted(im[F.tile],F.shade):null;
  if(!tiles(g,tt||im[F.tile],{x:0,y:0,w:def.w,h:def.h},F.size||330,v,F.mirror!==false,false)){g.fillStyle=F.color||'#77705e';g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);}
  if(F.shade&&!tt){g.fillStyle=F.shade;g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);}
  /* patches: a parade ground, a coal yard, a garden - a floor of their own inside the land */
  for(const p of def.patches||[]){
   const box=p.pts?bbox(p.pts):{x:p.x-p.rx,y:p.y-p.ry,w:p.rx*2,h:p.ry*2};
   if(!onView(box.x,box.y,box.x+box.w,box.y+box.h,v))continue;
   g.save();if(p.pts)polyPath(g,p.pts);else{g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);}
   g.clip();
   if(!tiles(g,im[p.tile],{x:box.x,y:box.y,w:box.w,h:box.h,ox:box.x,oy:box.y},p.size||300,v,p.mirror!==false,false)){g.fillStyle=p.color||'#6c6452';g.fillRect(box.x,box.y,box.w,box.h);}
   if(p.shade){g.fillStyle=p.shade;g.fillRect(box.x,box.y,box.w,box.h);}
   g.restore();
   if(p.rim){g.strokeStyle=p.rim;g.lineWidth=p.rimW||10;if(p.pts)polyPath(g,p.pts);else{g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);}g.stroke();}
  }
  /* clumps of grass and weeds where the plan scatters them (never on a road or a square: the plan was made that way) */
  const tuftIm=[im['ground/tuft_1'],im['ground/tuft_2'],im['ground/tuft_3'],im['ground/tuft_4']];
  for(const t of def.tufts||[]){
   if(t[0]<v.x0-30||t[0]>v.x1+30||t[1]<v.y0-10||t[1]>v.y1+40)continue;
   const ti=tuftIm[(t[2]||0)%4];if(!ready(ti))continue;
   const w=(t[3]||30)*1.5,h=w*ih(ti)/iw(ti);g.save();g.translate(t[0],t[1]);if((t[0]+t[1])%2)g.scale(-1,1);g.globalAlpha=def.tuftAlpha||1;g.drawImage(ti,-w/2,-h+4,w,h);g.restore();
  }
  g.restore();
 }
 function bbox(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return {x:x0,y:y0,w:x1-x0,h:y1-y0};}
 /* a road is its polyline stroked wide: a soft shadow first, then the paving clipped to the strip (one box per
    stretch, a disc at every bend - all wound the same way, or the nonzero rule punches the bends out), then its kerbs */
 function roadClip(g,r,square=false){
  const h=r.w/2;g.beginPath();
  for(let i=1;i<r.pts.length;i++){
   const [ax,ay]=r.pts[i-1],[bx,by]=r.pts[i],dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy)||1,nx=-dy/l*h,ny=dx/l*h;
   g.moveTo(ax-nx,ay-ny);g.lineTo(bx-nx,by-ny);g.lineTo(bx+nx,by+ny);g.lineTo(ax+nx,ay+ny);g.closePath();
  }
  r.pts.forEach(([x,y],i)=>{if(square&&(i===0||i===r.pts.length-1))return;g.moveTo(x+h,y);g.arc(x,y,h,0,TAU);});   /* a runner ends square */
 }
 /* where roads meet, the kerb of each is broken for the width of the other, on the side the other comes in from:
    for every road, the stretches (by distance along it) where each kerb is not drawn */
 function roadJoints(def){
  if(def._joints)return def._joints;
  const rs=(def.roads||[]).filter(r=>!r.hidden),key=p=>Math.round(p[0])+','+Math.round(p[1]),at=new Map(),out=new Map();
  for(const r of rs)r.pts.forEach((p,i)=>{const k=key(p);if(!at.has(k))at.set(k,[]);at.get(k).push({r,i});});
  for(const r of rs){
   const cum=[0];for(let i=1;i<r.pts.length;i++)cum.push(cum[i-1]+Math.hypot(r.pts[i][0]-r.pts[i-1][0],r.pts[i][1]-r.pts[i-1][1]));
   const gaps=[];
   r.pts.forEach((p,i)=>{
    const a=r.pts[Math.max(0,i-1)],b=r.pts[Math.min(r.pts.length-1,i+1)],tx=b[0]-a[0],ty=b[1]-a[1];
    for(const o of at.get(key(p)))if(o.r!==r)for(const j of [o.i-1,o.i+1]){
     if(j<0||j>=o.r.pts.length)continue;
     const q=o.r.pts[j],cr=tx*(q[1]-p[1])-ty*(q[0]-p[0]);
     gaps.push({d0:cum[i]-o.r.w/2-3,d1:cum[i]+o.r.w/2+3,side:cr>0?1:-1});
    }
   });
   out.set(r,{cum,gaps});
  }
  def._joints=out;return out;
 }
 function kerbLine(g,r,J,side,off){
  g.beginPath();
  for(let k=1;k<r.pts.length;k++){
   const [ax,ay]=r.pts[k-1],[bx,by]=r.pts[k],c0=J.cum[k-1],c1=J.cum[k],len=c1-c0;if(!len)continue;
   const nx=-(by-ay)/len*off,ny=(bx-ax)/len*off;
   let cuts=[[c0,c1]];
   for(const gp of J.gaps){if(gp.side!==side)continue;cuts=cuts.flatMap(([s,e])=>gp.d1<=s||gp.d0>=e?[[s,e]]:[...(gp.d0>s?[[s,gp.d0]]:[]),...(gp.d1<e?[[gp.d1,e]]:[])]);}
   for(const [s,e] of cuts){const t0=(s-c0)/len,t1=(e-c0)/len;g.moveTo(ax+(bx-ax)*t0+nx,ay+(by-ay)*t0+ny);g.lineTo(ax+(bx-ax)*t1+nx,ay+(by-ay)*t1+ny);}
  }
  g.stroke();
 }
 function strokeLine(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));}
 /* a carpet runner: its picture laid along the road at the road's own width, border to border, repeating down the run and
    carried on across the bends, never mirrored across (a runner's borders must meet the road's edges) */
 function runner(g,pic,r){
  const len0=r.w*ih(pic)/iw(pic);let run=0;
  for(let i=1;i<r.pts.length;i++){
   const [ax,ay]=r.pts[i-1],[bx,by]=r.pts[i],L=Math.hypot(bx-ax,by-ay);if(!L)continue;
   g.save();g.translate(ax,ay);g.rotate(Math.atan2(by-ay,bx-ax)-Math.PI/2);
   for(let d=-(run%len0);d<L;d+=len0)g.drawImage(pic,-r.w/2,d-.5,r.w,len0+1);
   g.restore();run+=L;
  }
 }
 /* a runner's two ends: a fringe of short woollen tassels */
 function runnerFringe(g,r,color){
  g.save();g.strokeStyle=color||'rgba(238,228,204,.92)';g.lineWidth=2.4;g.lineCap='round';
  for(const [i,j] of [[0,1],[r.pts.length-1,r.pts.length-2]]){
   const [x,y]=r.pts[i],[qx,qy]=r.pts[j],L=Math.hypot(x-qx,y-qy)||1,ux=(x-qx)/L,uy=(y-qy)/L;
   for(let k=-r.w/2+5;k<=r.w/2-5;k+=7){const bx=x-uy*k,by=y+ux*k;g.beginPath();g.moveTo(bx,by);g.lineTo(bx+ux*12,by+uy*12);g.stroke();}
  }
  g.restore();
 }
 function roads(g,im,v,def,zoom){
  const styles=def.roadStyles||{};
  const list=(def.roads||[]).filter(r=>!r.hidden).map(r=>({r,s:styles[r.kind]||styles.street||{}})).sort((a,b)=>(a.s.order||0)-(b.s.order||0));
  for(const {r,s} of list){
   const box=bbox(r.pts);if(!onView(box.x,box.y,box.x+box.w,box.y+box.h,v,r.w))continue;
   if(zoom>.35){g.save();g.lineCap=s.runner?'butt':'round';g.lineJoin='round';g.strokeStyle='rgba(0,0,0,.20)';g.lineWidth=r.w+12;strokeLine(g,r.pts);g.stroke();g.restore();}
   g.save();roadClip(g,r,!!s.runner);g.clip();
   const rc={x:box.x-r.w,y:box.y-r.w,w:box.w+r.w*2,h:box.h+r.w*2};
   const rt=s.shade?tinted(im[s.tile],s.shade):null;
   if(s.runner&&ready(im[s.tile]))runner(g,im[s.tile],r);
   else if(!tiles(g,rt||im[s.tile],rc,s.size||280,v,s.mirror!==false,false)){g.fillStyle=s.color||'#8a7d66';g.fillRect(rc.x,rc.y,rc.w,rc.h);}
   if(s.shade&&!rt){g.fillStyle=s.shade;g.fillRect(Math.max(rc.x,v.x0),Math.max(rc.y,v.y0),Math.min(rc.x+rc.w,v.x1)-Math.max(rc.x,v.x0),Math.min(rc.y+rc.h,v.y1)-Math.max(rc.y,v.y0));}
   g.restore();
   if(s.runner&&zoom>.3)runnerFringe(g,r,s.fringe);
   if(s.kerb&&zoom>.3){   /* the two kerbs, just inside the edge: a pale dressed line with a thin dark joint outside it */
    const J=roadJoints(def).get(r);
    g.save();g.lineCap='butt';
    for(const side of [-1,1]){
     g.strokeStyle='rgba(0,0,0,.30)';g.lineWidth=2.5;kerbLine(g,r,J,side,side*(r.w/2));
     g.strokeStyle=s.kerbColor||'#cfc3a6';g.lineWidth=s.kerb;kerbLine(g,r,J,side,side*(r.w/2-s.kerb/2));
    }
    g.restore();
   }
  }
 }
 function plazas(g,im,v,def,zoom){
  for(const p of def.plazas||[]){
   if(!onView(p.x-p.rx,p.y-p.ry,p.x+p.rx,p.y+p.ry,v))continue;
   const s=(def.plazaStyles||{})[p.kind||'square']||{};
   g.save();g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=12;g.stroke();g.clip();
   if(!tiles(g,im[s.tile],{x:p.x-p.rx,y:p.y-p.ry,w:p.rx*2,h:p.ry*2},s.size||300,v,s.mirror!==false,false)){g.fillStyle=s.color||'#86796a';g.fillRect(p.x-p.rx,p.y-p.ry,p.rx*2,p.ry*2);}
   if(s.shade){g.fillStyle=s.shade;g.fillRect(p.x-p.rx,p.y-p.ry,p.rx*2,p.ry*2);}
   g.restore();
   const rim=s.rim||'#cfc3a6';
   g.strokeStyle=rim;g.lineWidth=18;g.beginPath();g.ellipse(p.x,p.y,p.rx-9,p.ry-9,0,0,TAU);g.stroke();
   g.strokeStyle='rgba(38,30,20,.55)';g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);g.stroke();g.beginPath();g.ellipse(p.x,p.y,p.rx-18,p.ry-18,0,0,TAU);g.stroke();
   if(zoom>.5){const n=Math.round(p.rx/9);g.beginPath();for(let i=0;i<n;i++){const a=i/n*TAU,c=Math.cos(a),sn=Math.sin(a);g.moveTo(p.x+c*(p.rx-18),p.y+sn*(p.ry-18));g.lineTo(p.x+c*p.rx,p.y+sn*p.ry);}g.stroke();}
   if(s.ring){g.strokeStyle=s.ring;g.lineWidth=6;g.beginPath();g.ellipse(p.x,p.y,p.rx*.62,p.ry*.62,0,0,TAU);g.stroke();}
  }
  for(const m of def.mosaics||[]){
   const mi=im[m.key],half=m.size/2;
   if(!ready(mi)||!onView(m.x-half,m.y-half,m.x+half,m.y+half,v))continue;
   const hh=half*(m.squash||.86);
   ellipse(g,m.x,m.y+3,half+5,hh+5,'rgba(0,0,0,.18)');g.drawImage(mi,m.x-half,m.y-hh,m.size,hh*2);
  }
 }
 /* where the land meets the water: a quay (dressed kerb, the wall's face below it, mooring rings) or a rocky shore,
    and foam on the water either way */
 function shore(g,im,v,def,time){
  for(const L of def.lands)for(let i=0;i<L.length;i++){
   const a=L[i],b=L[(i+1)%L.length],style=a[2]||'edge';
   if(style==='edge')continue;
   if(!onView(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1]),v,90))continue;
   const [nx,ny]=edgeNormal(L,a,b);
   if(style==='wall'){   /* inside: the top of the wall round a room, seen from above, and its shadow on the floor */
    const T=def.wallT||60,len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,ux=(b[0]-a[0])/len,uy=(b[1]-a[1])/len;
    /* run on past an end only where the room's corner points outward - into a doorway it would close the opening */
    const n=L.length,prev=L[(i-1+n)%n],next=L[(i+2)%n],turn=(p,q,r)=>(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]),sgn=Math.sign(area(L));
    const ea=turn(prev,a,b)*sgn>0?T:0,eb=turn(a,b,next)*sgn>0?T:0;
    const ax=a[0]-ux*ea,ay=a[1]-uy*ea,bx=b[0]+ux*eb,by=b[1]+uy*eb;
    g.save();
    g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.lineTo(bx+nx*T,by+ny*T);g.lineTo(ax+nx*T,ay+ny*T);g.closePath();
    g.fillStyle=(def.wallTops&&def.wallTops[def.lands.indexOf(L)])||def.wallTop||'#cfd6dc';g.fill();
    if(ready(im[def.wallTile])){g.clip();tiles(g,im[def.wallTile],{x:Math.min(ax,bx+nx*T)-T,y:Math.min(ay,by+ny*T)-T,w:Math.abs(bx-ax)+T*3,h:Math.abs(by-ay)+T*3},180,v,true,false);}
    g.restore();
    const sh=g.createLinearGradient(a[0],a[1],a[0]-nx*44,a[1]-ny*44);sh.addColorStop(0,'rgba(0,0,0,.30)');sh.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=sh;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(b[0]-nx*44,b[1]-ny*44);g.lineTo(a[0]-nx*44,a[1]-ny*44);g.closePath();g.fill();
    g.save();g.lineCap='butt';
    g.strokeStyle='rgba(255,255,255,.38)';g.lineWidth=3;g.beginPath();g.moveTo(a[0]+nx*2,a[1]+ny*2);g.lineTo(b[0]+nx*2,b[1]+ny*2);g.stroke();
    g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=3;g.beginPath();g.moveTo(ax+nx*T,ay+ny*T);g.lineTo(bx+nx*T,by+ny*T);g.stroke();
    g.restore();
    continue;
   }
   if(style==='quay'){
    const face=Math.max(0,ny)*30+8;                                    /* a wall seen over its edge only where the water lies below */
    g.save();g.lineCap='butt';
    g.strokeStyle=def.quayFace||'#4d463b';g.lineWidth=face;g.beginPath();g.moveTo(a[0]+nx*face/2,a[1]+ny*face/2);g.lineTo(b[0]+nx*face/2,b[1]+ny*face/2);g.stroke();
    g.strokeStyle=def.quayKerb||'#b7ac93';g.lineWidth=22;g.beginPath();g.moveTo(a[0]-nx*11,a[1]-ny*11);g.lineTo(b[0]-nx*11,b[1]-ny*11);g.stroke();
    g.strokeStyle='rgba(255,255,255,.16)';g.lineWidth=3;g.beginPath();g.moveTo(a[0]-nx*21,a[1]-ny*21);g.lineTo(b[0]-nx*21,b[1]-ny*21);g.stroke();
    g.strokeStyle='rgba(40,32,22,.55)';g.lineWidth=2;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    g.strokeStyle='rgba(20,16,10,.8)';g.lineWidth=3;
    for(let d=150;d<len-60;d+=300){const t=d/len,x=a[0]+(b[0]-a[0])*t-nx*12,y=a[1]+(b[1]-a[1])*t-ny*12;g.beginPath();g.ellipse(x,y,7,4.5,0,0,TAU);g.stroke();}
    g.restore();
   }else if(style==='rock'){   /* the land ends at a low bank; its stones lie out in the water (rockShore) */
    const face=Math.max(0,ny)*10+5;
    g.save();g.lineCap='round';
    g.strokeStyle=def.bank||'rgba(62,53,42,.92)';g.lineWidth=face;g.beginPath();g.moveTo(a[0]+nx*face/2,a[1]+ny*face/2);g.lineTo(b[0]+nx*face/2,b[1]+ny*face/2);g.stroke();
    g.strokeStyle='rgba(255,255,255,.10)';g.lineWidth=2;g.beginPath();g.moveTo(a[0]-nx*2,a[1]-ny*2);g.lineTo(b[0]-nx*2,b[1]-ny*2);g.stroke();
    g.restore();
   }else if(style==='sand'){
    g.save();g.lineCap='round';g.strokeStyle='rgba(214,196,150,.85)';g.lineWidth=34;g.beginPath();g.moveTo(a[0]+nx*6,a[1]+ny*6);g.lineTo(b[0]+nx*6,b[1]+ny*6);g.stroke();g.restore();
   }
   const fo=style==='quay'?Math.max(0,ny)*30+10:style==='rock'?Math.max(0,ny)*10+12:12;
   foamLine(g,[[a[0]+nx*fo,a[1]+ny*fo,nx,ny],[b[0]+nx*fo,b[1]+ny*fo,nx,ny]],time,i*1.7);
  }
  shoreStones(g,v,def,time);
 }
 /* a rocky shore's stones, out in the water off the bank: laid once per town by a seeded hand, in clusters of one to
    three, never on the land or a pier, and painted in the ground pass with a wash of foam round each */
 const rockCache=new WeakMap();
 function openWater(def,x,y,r){
  if(x<r||y<r||x>def.w-r||y>def.h-r)return false;
  for(const L of def.lands){
   if(inPoly(L,x,y))return false;
   for(let i=0,j=L.length-1;i<L.length;j=i++){const a=L[j],b=L[i];if(segDist(x,y,a[0],a[1],b[0],b[1])<r)return false;}
  }
  for(const p of def.piers||[])if(p.r?Math.hypot(x-p.x,y-p.y)<p.r+r:(x>p.x-r&&x<p.x+p.w+r&&y>p.y-r&&y<p.y+p.h+r))return false;
  return true;
 }
 function rockShore(def){
  let c=rockCache.get(def);if(c)return c;
  const edges=[],stones=[];
  for(const L of def.lands)for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length];if(a[2]==='rock')edges.push([a,b,edgeNormal(L,a,b)]);}
  for(const [a,b,[nx,ny]] of edges){
   const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,ux=(b[0]-a[0])/len,uy=(b[1]-a[1])/len;
   for(let d=20+unit(a[0],a[1],5)*60;d<len;d+=70+unit(Math.round(d),a[0]+a[1],6)*130){
    const ox=a[0]+ux*d,oy=a[1]+uy*d,n=1+Math.floor(unit(Math.round(ox),Math.round(oy),7)*3);
    for(let k=0;k<n;k++){
     const u1=unit(Math.round(ox)+k*31,Math.round(oy)-k*17,8),u2=unit(Math.round(ox)-k*13,Math.round(oy)+k*29,9);
     const rx=(k?9:13)+u2*(k?11:17),off=rx+24+u1*(k?60:90),along=k?(u2-.5)*110:0;
     const x=ox+nx*off+ux*along,y=oy+ny*off+uy*along,lump=u1>.35;
     if(openWater(def,x,y,rx*(lump?1.5:1)+14))stones.push({x,y,rx,ry:rx*(.58+u1*.14),c:u1<.5?0:1,ph:u2*TAU,
      lx:lump?(u2<.5?-1:1)*rx*(.45+u1*.3):0,lr:.42+u2*.3});   /* most are two stones grown together, not one round pebble */
    }
   }
  }
  stones.sort((p,q)=>p.y-q.y);
  rockCache.set(def,c={edges,stones});
  return c;
 }
 function shoreStones(g,v,def,time){
  const R=rockShore(def);if(!R.stones.length)return;
  const C=def.stones||['#5b5750','#6e6960'],foot=def.stoneFoot||'#45423c';
  for(const s of R.stones){
   const wide=s.rx+Math.abs(s.lx)*.6;
   if(s.x+wide+14<v.x0||s.x-wide-14>v.x1||s.y+s.ry+14<v.y0||s.y-s.ry-14>v.y1)continue;
   const p=(Math.sin(time*1.4+s.ph)+1)/2,cx=s.x+s.lx*.3;
   const lx=s.x+s.lx,lrx=s.rx*s.lr,lry=s.ry*s.lr*1.08,ly=s.y+s.ry*.12;
   ellipse(g,cx+s.rx*.18,s.y+s.ry*.55,wide*1.12,s.ry*1.1,'rgba(2,18,30,.30)');                     /* its shadow in the water */
   g.strokeStyle='rgba(224,246,244,'+(.16+.3*(1-p)).toFixed(3)+')';g.lineWidth=2;
   g.beginPath();g.ellipse(cx,s.y+s.ry*.3,wide+4+p*6,s.ry+2+p*4,0,0,TAU);g.stroke();                /* the wash round it */
   if(s.lx){ellipse(g,lx,ly+lry*.2,lrx,lry*.92,foot);ellipse(g,lx-lrx*.04,ly-lry*.1,lrx*.93,lry*.8,C[1-s.c]);}
   ellipse(g,s.x,s.y+s.ry*.2,s.rx,s.ry*.92,foot);                                                    /* wet below */
   ellipse(g,s.x-s.rx*.04,s.y-s.ry*.1,s.rx*.93,s.ry*.8,C[s.c]);                                      /* dry on top */
   ellipse(g,s.x-s.rx*.3,s.y-s.ry*.32,s.rx*.42,s.ry*.3,'rgba(255,255,255,.12)');
  }
 }
 function mirrorTiles(g,im,rc,size,v,turn=false){return tiles(g,im,{...rc,ox:rc.x,oy:rc.y},size,v,true,turn);}
 function kerbRect(g,x,y,w,h,im,color){
  g.fillStyle=color||'#b7ac93';g.fillRect(x,y,w,h);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x,y,w,Math.min(h,4));
  if(ready(im)){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.globalAlpha=.42;for(let yy=y;yy<y+h;yy+=180)for(let xx=x;xx<x+w;xx+=180)g.drawImage(im,xx,yy,180,180);g.restore();}
  g.strokeStyle='rgba(40,32,22,.55)';g.lineWidth=2;g.strokeRect(x,y,w,h);
 }
 function piers(g,im,v,def,time){
  for(const p of def.piers||[]){
   if(p.r){   /* a round stone head, like the Harbour's mole */
    if(!onView(p.x-p.r,p.y-p.r,p.x+p.r,p.y+p.r+30,v))continue;
    ellipse(g,p.x+14,p.y+20,p.r,p.r,'rgba(2,14,26,.34)');
    g.fillStyle=def.quayFace||'#5d564a';g.beginPath();g.arc(p.x,p.y+22,p.r,0,Math.PI);g.fill();
    g.save();g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.clip();
    if(!mirrorTiles(g,im[p.tile||def.pierTile||SHARED_TILES.quay],{x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2},384,v)){g.fillStyle='#7d7563';g.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);}
    g.restore();
    g.strokeStyle=def.quayKerb||'#b7ac93';g.lineWidth=20;g.beginPath();g.arc(p.x,p.y,p.r-10,0,TAU);g.stroke();
    g.strokeStyle='rgba(40,32,22,.55)';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.stroke();
    const ring=[];for(let a=0;a<=TAU+.01;a+=.2)ring.push([p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r+(Math.sin(a)>0?20:0),Math.cos(a),Math.sin(a)]);
    foamLine(g,ring,time,p.x*.01);
    continue;
   }
   if(!onView(p.x,p.y,p.x+p.w,p.y+p.h,v,60))continue;
   const o=p.open||'n';
   const edges=[];if(!o.includes('w'))edges.push([[p.x,p.y,-1,0],[p.x,p.y+p.h,-1,0]]);if(!o.includes('e'))edges.push([[p.x+p.w,p.y,1,0],[p.x+p.w,p.y+p.h,1,0]]);
   if(!o.includes('s'))edges.push([[p.x,p.y+p.h+(p.kind==='timber'?22:26),0,1],[p.x+p.w,p.y+p.h+(p.kind==='timber'?22:26),0,1]]);if(!o.includes('n'))edges.push([[p.x,p.y,0,-1],[p.x+p.w,p.y,0,-1]]);
   for(const e of edges)foamLine(g,e,time,p.x*.007+p.y*.003);
   g.fillStyle='rgba(2,14,26,.34)';g.fillRect(p.x+12,p.y+16,p.w,p.h+8);
   if(p.kind==='timber'){
    g.fillStyle=p.old?'#2a1d12':'#3a2917';g.fillRect(p.x,p.y+p.h-2,p.w,24);
    g.fillStyle='rgba(0,0,0,.35)';for(let x=p.x+14;x<p.x+p.w-8;x+=44)g.fillRect(x,p.y+p.h+2,8,18);
    if(!mirrorTiles(g,im[SHARED_TILES.planks],p,256,v,p.w>p.h)){g.fillStyle='#6b5138';g.fillRect(p.x,p.y,p.w,p.h);}
    if(p.old){g.fillStyle='rgba(34,22,10,.30)';g.fillRect(p.x,p.y,p.w,p.h);}
    g.strokeStyle=p.old?'#22170d':'#2e2013';g.lineWidth=7;g.strokeRect(p.x+3.5,p.y+3.5,p.w-7,p.h-7);
    g.strokeStyle='rgba(255,236,190,.10)';g.lineWidth=2;g.strokeRect(p.x+9,p.y+9,p.w-18,p.h-18);
   }else{
    g.fillStyle=def.quayFace||'#5d564a';g.fillRect(p.x,p.y+p.h-2,p.w,28);
    if(!mirrorTiles(g,im[p.tile||def.pierTile||SHARED_TILES.quay],p,384,v)){g.fillStyle='#7d7563';g.fillRect(p.x,p.y,p.w,p.h);}
    const k=20,t=im[SHARED_TILES.quay],c=def.quayKerb;
    if(!o.includes('w'))kerbRect(g,p.x,p.y,k,p.h,t,c);if(!o.includes('e'))kerbRect(g,p.x+p.w-k,p.y,k,p.h,t,c);
    if(!o.includes('s'))kerbRect(g,p.x,p.y+p.h-k,p.w,k,t,c);if(!o.includes('n'))kerbRect(g,p.x,p.y,p.w,k,t,c);
   }
  }
 }
 /* inside, a painted back wall stands up off its room's floor: the wall's top, seen from above, is carried along its top
    edge and down both ends to the room's own wall band, so the painting is framed by masonry and does not stand against
    the dark like a board */
 function wallFrames(g,v,def){
  if(!def.interior)return;
  const T=def.wallT||60;
  for(const w of def.walls||[]){
   const a=ART[w.kind];if(!a)continue;
   const top=w.y+(a.drop||0)-a.h,x0=w.x0,x1=w.x1;
   if(!onView(x0-T,top-T,x1+T,w.y,v,20))continue;
   const room=Math.max(0,def.lands.findIndex(L=>inPoly(L,(x0+x1)/2,w.y+12)));
   g.fillStyle=(def.wallTops&&def.wallTops[room])||def.wallTop||'#cfd6dc';
   g.fillRect(x0-T,top-T,x1-x0+T*2,T);g.fillRect(x0-T,top-T,T,w.y-top+T);g.fillRect(x1,top-T,T,w.y-top+T);
   g.save();g.lineCap='butt';
   g.strokeStyle='rgba(255,255,255,.38)';g.lineWidth=3;g.beginPath();g.moveTo(x0-2,w.y);g.lineTo(x0-2,top-2);g.lineTo(x1+2,top-2);g.lineTo(x1+2,w.y);g.stroke();
   g.strokeStyle='rgba(0,0,0,.5)';g.beginPath();g.moveTo(x0-T,w.y);g.lineTo(x0-T,top-T);g.lineTo(x1+T,top-T);g.lineTo(x1+T,w.y);g.stroke();
   g.restore();
  }
 }
 /* a wall running north-south, seen from above: its strip tiled down the run at its own width */
 function vwalls(g,im,v,def){
  for(const w of def.vwalls||[]){
   if(!onView(w.x-w.w/2,w.y0,w.x+w.w/2,w.y1,v,20))continue;
   const pic=im[artOf(w.kind).src];
   if(!ready(pic)){g.fillStyle='#d8dde2';g.fillRect(w.x-w.w/2,w.y0,w.w,w.y1-w.y0);continue;}
   const TH=w.w*ih(pic)/iw(pic),y0=Math.max(w.y0,v.y0-TH),y1=Math.min(w.y1,v.y1+TH);
   g.save();g.beginPath();g.rect(w.x-w.w/2-2,w.y0,w.w+4,w.y1-w.y0);g.clip();
   g.fillStyle='rgba(0,0,0,.22)';g.fillRect(w.x+w.w/2-4,w.y0,18,w.y1-w.y0);   /* its shadow falls east */
   for(let y=w.y0+Math.floor((y0-w.y0)/TH)*TH;y<y1;y+=TH)g.drawImage(pic,w.x-w.w/2,y-.4,w.w,TH+.8);
   g.restore();
  }
 }
 /* paintings laid on the ground: a gate seen from above in a north-south wall, a stair going down, a rug. `over` ones (a
    doorway seen from above) are laid after the coast and the wall bands, on top of them */
 function decals(g,im,v,def,over=false){
  for(const d of def.decals||[]){
   if(!!d.over!==over)continue;
   if(!onView(d.x-d.w/2,d.y-d.h/2,d.x+d.w/2,d.y+d.h/2,v,20))continue;
   const pic=im[d.key];if(!ready(pic))continue;
   if(d.shadow!==false){g.fillStyle='rgba(0,0,0,.22)';g.fillRect(d.x-d.w/2+10,d.y-d.h/2+12,d.w,d.h);}
   g.drawImage(pic,d.x-d.w/2,d.y-d.h/2,d.w,d.h);
  }
 }
 /* the far edge: a painted band (mountains, a skyline) laid across the top, mirrored tile to tile */
 function backdrop(g,im,v,def){
  const B=def.backdrop;if(!B)return;
  const top=B.y||0;if(v.y0>top+B.h)return;
  if(B.sky){const grad=g.createLinearGradient(0,top,0,top+B.h);B.sky.forEach(([t,c])=>grad.addColorStop(t,c));g.fillStyle=grad;g.fillRect(v.x0,Math.max(v.y0,top),v.x1-v.x0,Math.min(v.y1,top+B.h)-Math.max(v.y0,top));}
  const pic=im[B.key];if(!ready(pic))return;
  const trim=B.trim===undefined?8:B.trim,tw=B.h*(iw(pic)-trim*2)/ih(pic);
  for(let i=Math.floor((v.x0-(B.shift||0))/tw);(B.shift||0)+i*tw<v.x1;i++){
   g.save();g.translate((B.shift||0)+(i+.5)*tw,0);if(i%2)g.scale(-1,1);
   g.drawImage(pic,trim,0,iw(pic)-trim*2,ih(pic),-tw/2-.4,top,tw+.8,B.h);g.restore();
  }
 }
 /* is any water in view? The land's middle-of-the-view test, then every coastline edge (the world's own border does
    not count) and every pier against the view */
 function wetView(def,v){
  if(def.interior)return false;
  if(!onLand(def,(v.x0+v.x1)/2,(v.y0+v.y1)/2,0))return true;
  for(const L of def.lands)for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length],st=a[2]||'edge';if(st==='edge'||st==='wall')continue;
   if(onView(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1]),v,120))return true;}
  for(const p of def.piers||[]){const r=p.r||0;if(onView(p.x-r,p.y-r,p.x+(p.w||r),p.y+(p.h||r),v,120))return true;}
  return false;
 }
 function renderGround(g,world,view,{images={},time=0}={}){
  remember(images);const im=remembered;
  const def=TOWNS[world&&world.town];if(!def)return;
  const v={x0:Math.max(0,view.x),y0:Math.max(0,view.y),x1:Math.min(def.w,view.x+view.w),y1:Math.min(def.h,view.y+view.h)};
  if(!(v.x1>v.x0&&v.y1>v.y0))return;
  const zoom=view.zoom||1;
  g.save();g.beginPath();g.rect(0,0,def.w,def.h);g.clip();
  if(def.interior){g.fillStyle=def.void||'#14100c';g.fillRect(v.x0,v.y0,v.x1-v.x0,v.y1-v.y0);}   /* a palace: the dark round its rooms */
  else if(wetView(def,v))sea(g,im,v,time,def);   /* in the middle of town the land covers every pixel of the sea: do not paint it */
  land(g,im,v,def);
  g.save();landPath(g,def);g.clip('evenodd');roads(g,im,v,def,zoom);plazas(g,im,v,def,zoom);g.restore();
  vwalls(g,im,v,def);decals(g,im,v,def);
  shore(g,im,v,def,time);
  wallFrames(g,v,def);
  piers(g,im,v,def,time);
  decals(g,im,v,def,true);
  backdrop(g,im,v,def);
  g.restore();
 }

 /* ---------- props sorted with the actors ---------- */
 /* the drawn frame of a prop, for the game's walk-behind fade and its sun: {W,H,top} or null while its picture is loading, with the
    picture, where it stands (foot), whether it is mirrored, whether it throws no shadow (wet: the sea carries it, or it lies flat), a
    wall's run (span) and its glows */
 function frame(s,images){
  const a=ART[s.kind],im=a&&(images||remembered)[a.src];if(!ready(im))return null;
  const more={im,foot:a.drop||0,flip:!!s.flip,wet:!!(a.float||a.wash||a.noShadow||s.kind==='post'),glow:s.span?null:a.glow||null};
  if(s.span)return {W:s.span,H:a.h,top:(a.drop||0)-a.h,span:true,...more};
  const Hh=a.h||a.w*ih(im)/iw(im),Ww=a.w||a.h*iw(im)/ih(im);
  return {W:Ww,H:Hh,top:(a.drop||0)-Hh,...more};
 }
 function drawShadow(g,s){
  const a=ART[s.kind];if(!a||a.float||a.wash||a.noShadow||s.kind==='post')return;
  if(s.span){g.fillStyle='rgba(0,0,0,.24)';g.fillRect(-s.span/2,-4,s.span,16);return;}
  const rx=s.crx?s.crx*1.04:a.house?drawnW(a)*.46:(a.r||24)*1.5;
  ellipse(g,rx*.08,4,rx,Math.max(7,rx*.22),'rgba(0,0,0,.27)');
 }
 function waterline(g,Ww,time,seed,y=0){
  g.save();g.lineCap='round';g.strokeStyle='rgba(236,250,255,.6)';g.lineWidth=Math.max(2.5,Math.min(5,Ww*.006));
  g.setLineDash([Ww*.05,Ww*.035,Ww*.02,Ww*.045]);g.lineDashOffset=time*11+seed*30;
  g.beginPath();g.ellipse(0,y+2,Ww*.47,Math.max(3,Ww*.018),0,0,Math.PI);g.stroke();
  g.strokeStyle='rgba(236,250,255,.26)';g.lineDashOffset=-time*7+seed*11;
  g.beginPath();g.ellipse(0,y+4,Ww*.52+Math.sin(time*1.2+seed)*Ww*.012,Math.max(5,Ww*.03),0,0,Math.PI);g.stroke();
  g.setLineDash([]);g.restore();
 }
 function spray(g,a,Ww,Hh,time,seed){   /* a fountain's water: droplets on arcs from each spout, and rings on the basin */
  for(const [u,vv,k] of a.spray){
   const sx=-Ww/2+u*Ww,sy=a.drop-Hh+vv*Hh;
   for(let i=0;i<7;i++){
    const p=(time*.9+i/7+seed)%1,dir=(i%2?1:-1)*(k||1),x=sx+dir*p*Ww*.13,y=sy-Math.sin(p*Math.PI)*Hh*.10+p*Hh*.12;
    g.fillStyle='rgba(225,245,255,'+(.75*(1-p)).toFixed(3)+')';g.beginPath();g.arc(x,y,2.2*(1-p*.5),0,TAU);g.fill();
   }
  }
  const t=(time*.6+seed)%1;g.strokeStyle='rgba(235,250,255,'+(.35*(1-t)).toFixed(3)+')';g.lineWidth=2;
  g.beginPath();g.ellipse(0,a.drop-Hh*.16,Ww*.18+t*Ww*.2,Hh*.03+t*Hh*.035,0,0,TAU);g.stroke();
 }
 function drawProp(g,s,time=0,images={},options={}){
  remember(images);
  const a=ART[s.kind],im=a&&remembered[a.src];
  if(!a)return;
  if(!ready(im)){g.fillStyle='rgba(90,70,50,.55)';g.fillRect(-(a.r||20),-(a.h||60)*.5,(a.r||20)*2,(a.h||60)*.5);return;}
  const f=frame(s,remembered),Ww=f.W,Hh=f.H,seed=s.seed||0,flip=s.flip?-1:1,alpha=options.alpha===undefined?1:options.alpha,drop=a.drop||0;
  /* options.mip(picture, drawn width): the game hands over its mipmap cache, so a 900 px painting drawn 400 px tall is not
     scaled down from full size every frame */
  const pic=s.span?(options.mip?options.mip(im,Hh*iw(im)/ih(im)):im):(options.mip?options.mip(im,Ww):im);
  if(s.span){   /* a wall: the strip laid tile after tile along its run, cut clean at both ends */
   let TW=Hh*iw(im)/ih(im);
   if(a.fit)TW=Ww/Math.max(1,Math.round(Ww/TW));   /* fit: a whole number of tiles, a little stretched, so no window is cut at an end */
   g.save();g.beginPath();g.rect(-Ww/2,drop-Hh-2,Ww,Hh+4);g.clip();g.globalAlpha*=alpha;
   for(let x=-Ww/2;x<Ww/2;x+=TW){
    if(a.mirrorHalf&&x>=-.5){g.save();g.translate(x+TW/2,0);g.scale(-1,1);g.drawImage(pic,-TW/2-.4,drop-Hh,TW+.8,Hh);g.restore();}   /* the east half reflected */
    else g.drawImage(pic,x-.4,drop-Hh,TW+.8,Hh);
   }
   g.restore();
   /* torches painted into the strip (u across a tile, v down it): their flames flicker and their light breathes on the
      stone, each out of step with the next */
   if(a.torches){
    const k=s.glowK===undefined?1:s.glowK;
    for(let x=-Ww/2;x<Ww/2;x+=TW)for(const [u,vv,sz] of a.torches){
     const tx=x+u*TW;if(tx<-Ww/2+16||tx>Ww/2-16)continue;
     const ty=drop-Hh+vv*Hh,ph=(s.x+tx)*.0173,z=sz||1;
     const f=.66+.2*Math.sin(time*7.1+ph)+.1*Math.sin(time*17.3+ph*2.3)+.04*Math.sin(time*31+ph*4.1);
     light(g,tx,ty,120*z,f*alpha*k);
     fire(g,tx,ty+Hh*.045,.62*z,time,ph);
    }
   }
   return;
  }
  if(a.float||a.wash)ellipse(g,Ww*.02,8,Ww*.47,Math.max(6,Ww*.04),'rgba(2,14,26,.30)');
  g.save();
  if(a.float){g.translate(0,Math.sin(time*a.float.speed+seed*2.3)*a.float.amp);g.rotate(Math.sin(time*a.float.speed*.63+seed*1.7)*a.float.rot);}
  g.scale(flip,1);
  if(a.float&&Ww>300){
   g.save();g.globalAlpha=.13*alpha;g.translate(0,drop*2-6);g.scale(1,-.55);g.drawImage(pic,0,ih(pic)*.72,iw(pic),ih(pic)*.28,-Ww/2,-Hh*.28+drop,Ww,Hh*.28);g.restore();
  }
  if(a.sway){const k=Math.sin(time*.9+seed)*.012;g.transform(1,0,k,1,-k*drop,0);}
  if(a.flag){const k=Math.sin(time*1.7+seed*2)*.018;g.transform(1,0,k,1,-k*drop,0);}
  g.globalAlpha*=alpha;g.drawImage(pic,-Ww/2,drop-Hh,Ww,Hh);g.globalAlpha=1;
  if(a.spray)spray(g,a,Ww,Hh,time,seed);
  if(a.smoke){g.globalAlpha=alpha;for(const [u,vv,k] of a.smoke)smoke(g,-Ww/2+u*Ww,drop-Hh+vv*Hh,k,time,seed+u*7,!!a.soot);g.globalAlpha=1;}
  if(a.fire)fire(g,-Ww/2+a.fire[0]*Ww,drop-Hh+a.fire[1]*Hh,a.fire[2],time,seed);
  if(a.fires)for(const fr of a.fires)fire(g,-Ww/2+fr[0]*Ww,drop-Hh+fr[1]*Hh,fr[2],time,seed+fr[0]*3);
  if(a.glow)for(const [u,vv,r,c] of a.glow)light(g,-Ww/2+u*Ww,drop-Hh+vv*Hh,r,(.8+Math.sin(time*5.1+seed*3)*.2)*alpha*(s.glowK===undefined?1:s.glowK),c);   /* glowK: a town in broad daylight dims its lamps */
  g.restore();
  if(a.float||a.wash)waterline(g,Ww*(a.wash?.8:.94),time,seed,a.float?0:2);
 }

 /* ---------- over everything: birds, weather, the air of the place ---------- */
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
 function weather(g,def,v,time){
  const kind=def.weather;if(!kind)return;
  if(kind==='snow'){
   const cell=170;g.fillStyle='#ffffff';
   for(let j=Math.floor(v.y0/cell)-1;j*cell<v.y1;j++)for(let i=Math.floor(v.x0/cell);i*cell<v.x1;i++){
    const f=unit(i,j,31),speed=34+f*30,y=(j*cell+((time*speed+unit(i,j,32)*cell)%cell)),x=i*cell+unit(i,j,33)*cell+Math.sin(time*.8+f*9)*12;
    if(y<v.y0||y>v.y1)continue;
    g.globalAlpha=.45+f*.4;g.beginPath();g.arc(x,y,1.1+f*1.7,0,TAU);g.fill();
   }
   g.globalAlpha=1;
  }else if(kind==='embers'){
   const cell=210;
   for(let j=Math.floor(v.y0/cell)-1;j*cell<v.y1+cell;j++)for(let i=Math.floor(v.x0/cell);i*cell<v.x1;i++){
    const f=unit(i,j,41);if(f>.55)continue;
    const speed=26+f*40,y=(j+1)*cell-((time*speed+unit(i,j,42)*cell)%cell),x=i*cell+unit(i,j,43)*cell+Math.sin(time*1.3+f*11)*16,fl=.5+.5*Math.sin(time*9+f*40);
    if(y<v.y0||y>v.y1)continue;
    g.fillStyle='rgba(255,'+Math.round(120+fl*90)+',40,'+(.35+fl*.45).toFixed(3)+')';g.beginPath();g.arc(x,y,1+f*1.8,0,TAU);g.fill();
   }
  }
 }
 function drawSky(g,world,view,time=0,images={}){
  remember(images);
  const def=TOWNS[world&&world.town];if(!def)return;
  const v={x0:view.x,y0:view.y,x1:view.x+view.w,y1:view.y+view.h};
  weather(g,def,v,time);
  for(const flock of def.birds||[])drawFlight(g,flock.path,view,time,remembered[flock.src||SHARED_TILES.gull],flock.size||62,flock.ink);
  if(def.tint){g.fillStyle=def.tint;g.fillRect(v.x0,v.y0,view.w,view.h);}
  if(def.haze){const grad=g.createLinearGradient(0,v.y0,0,v.y1);def.haze.forEach(([t,c])=>grad.addColorStop(t,c));g.fillStyle=grad;g.fillRect(v.x0,v.y0,view.w,view.h);}
 }

 /* every picture a town asks for, by its path under assets/city/ */
 function imagesFor(id){
  const def=TOWNS[id];if(!def)return [];
  const out=new Set([SHARED_TILES.sea,SHARED_TILES.quay,SHARED_TILES.planks,SHARED_TILES.gull,'ground/tuft_1','ground/tuft_2','ground/tuft_3','ground/tuft_4']);
  const add=k=>{if(k)out.add(k);};
  add(def.floor&&def.floor.tile);add(def.sea&&def.sea.tile);add(def.pierTile);add(def.backdrop&&def.backdrop.key);add(def.wallTile);
  for(const d of def.decals||[])add(d.key);
  for(const s of Object.values(def.roadStyles||{}))add(s.tile);for(const s of Object.values(def.plazaStyles||{}))add(s.tile);
  for(const p of def.patches||[])add(p.tile);for(const m of def.mosaics||[])add(m.key);for(const p of def.piers||[])add(p.tile);
  for(const f of def.birds||[])add(f.src);
  const kinds=new Set(['post',...(def.buildings||[]).map(b=>b[0]),...(def.props||[]).map(p=>p[0]),...(def.ships||[]).map(s=>s[0]),...(def.walls||[]).map(w=>w.kind),...(def.vwalls||[]).map(w=>w.kind)]);
  for(const k of kinds)add(artOf(k).src);
  return [...out];
 }

 /* ---------- the minimap's picture of a port (assets/ui/city-minimap.js): painted once per visit into its atlas, in world
    units - water, the ground, streets and squares, piers, walls, roofs, trees and hulls. def.map may set the colours. ---------- */
 const MAP_ROADS={street:'#c7b48c',avenue:'#d6c59c',crown:'#dccb9f',lane:'#b19d76',quay:'#b3a994',carpet:'#8e2a2a'};
 function paintMap(g,world){
  const def=TOWNS[world&&world.town];if(!def)return false;
  const M=def.map||{},F=def.floor||{},line=pts=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));};
  g.fillStyle=def.interior?(def.void||'#14100c'):(M.sea||'#1d4d63');g.fillRect(0,0,def.w,def.h);
  g.fillStyle=M.ground||F.color||'#77705e';landPath(g,def);g.fill('evenodd');
  g.save();landPath(g,def);g.clip('evenodd');g.lineCap='round';g.lineJoin='round';
  const roadColor=k=>(M.roads&&M.roads[k])||M.road||MAP_ROADS[k]||MAP_ROADS.street;
  for(const r of def.roads||[]){line(r.pts);g.strokeStyle=M.lip||'rgba(28,24,18,.5)';g.lineWidth=(r.w||150)+40;g.stroke();}
  for(const p of def.plazas||[]){g.beginPath();g.ellipse(p.x,p.y,p.rx+20,p.ry+20,0,0,TAU);g.fillStyle=M.lip||'rgba(28,24,18,.5)';g.fill();}
  for(const r of def.roads||[]){line(r.pts);g.strokeStyle=roadColor(r.kind);g.lineWidth=r.w||150;g.stroke();}
  for(const p of def.plazas||[]){g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);g.fillStyle=M.plaza||roadColor('avenue');g.fill();}
  g.restore();
  for(const p of def.piers||[]){g.fillStyle=p.kind==='timber'?(M.timber||'#7a5a3a'):(M.stone||'#a39b88');if(p.r){g.beginPath();g.arc(p.x,p.y,p.r,0,TAU);g.fill();}else g.fillRect(p.x,p.y,p.w,p.h);}
  g.fillStyle=M.wall||'#dfe3e6';
  for(const w of def.walls||[])g.fillRect(w.x0,w.y-70,w.x1-w.x0,80);
  for(const w of def.vwalls||[])g.fillRect(w.x-w.w/2,w.y0,w.w,w.y1-w.y0);
  for(const s of world.solids||[]){
   const a=ART[s.kind];if(!a||s.span)continue;
   if(a.house){
    const W=drawnW(a)*.9,h=Math.min((a.h||W)*.5,W*.62),x=s.x-W/2,y=s.y-h-12;
    g.fillStyle='rgba(16,14,10,.5)';g.fillRect(x+26,y+22,W,h);
    g.fillStyle=M.roof||'#7a644c';g.fillRect(x,y,W,h);g.fillStyle='rgba(255,255,255,.16)';g.fillRect(x,y,W,h*.28);
   }else if(a.sway){g.fillStyle=M.tree||'#35552c';g.beginPath();g.arc(s.x,s.y-50,76,0,TAU);g.fill();}
   else if(s.floats&&(a.w||0)>300){g.fillStyle=M.hull||'#5b4029';g.beginPath();g.ellipse(s.x,s.y-24,a.w*.42,a.w*.1,0,0,TAU);g.fill();}
  }
  return true;
 }

 return Object.freeze({register,town,list,create,contains,renderGround,drawProp,drawShadow,drawSky,drawFlight,frame,imagesFor,graph,
  sizes,paintMap,rockShore,ART,SIZES,SHARED_TILES,BLACKBEARD_SAY,onLand,onPier,inPoly});
});
