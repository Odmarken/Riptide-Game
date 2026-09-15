/* Wasteland terrain and connected dungeon geometry. No saves, enemies, image loading,
 * or whole-world canvases: the game owns those concerns and supplies loaded map art. */
(function(root){
 'use strict';
 const CHUNK=768,CELL=120,MAX_RADIUS=4096,GEOMETRY_CACHE=196,TERRAIN_CACHE=72;
 const REGION_W=50400,REGION_H=26000,BLEND=2400;
 const OVERWORLDS={
  wasteland:{name:'Wasteland',biome:'grass',offset:{x:0,y:0},neighbors:{north:'wasteland-snow',east:'wasteland-desert'}},
  'wasteland-snow':{name:'Frostwild Reach',biome:'snow',offset:{x:0,y:-REGION_H},neighbors:{south:'wasteland'}},
  'wasteland-desert':{name:'Sunscar Sands',biome:'desert',offset:{x:REGION_W,y:0},neighbors:{west:'wasteland'}}
 };
 const REGIONS=Object.freeze(Object.entries(OVERWORLDS).map(([key,def])=>Object.freeze({key,name:def.name,biome:def.biome,x:def.offset.x,y:def.offset.y+REGION_H,w:REGION_W,h:REGION_H})));
 const THEMES={
  briarhollow:{name:'Briarhollow',floor:'#354a37',wall:'#17271e',edge:'#657452',light:'#a8c786',tint:'rgba(67,104,48,.23)'},
  cindervein:{name:'Cindervein',floor:'#554335',wall:'#292326',edge:'#8c6450',light:'#ffad61',tint:'rgba(149,76,28,.23)'},
  frostveil:{name:'Frostveil',floor:'#617c8a',wall:'#263c50',edge:'#8cb7cb',light:'#bdefff',tint:'rgba(145,197,231,.23)'}
 };
 const ENTRANCES=[
  {id:'briarhollow',name:'Briarhollow',x:12600,y:6200,r:110,clearRadius:330,art:'assets/wasteland/briarhollow-entrance.png'},
  {id:'cindervein',name:'Cindervein',x:43200,y:20500,r:110,clearRadius:330,art:'assets/wasteland/cindervein-entrance.png'},
  {id:'frostveil',name:'Frostveil',x:41400,y:4200,r:110,clearRadius:330,art:'assets/wasteland/frostveil-entrance.png'}
 ];
 // A fixed landmark in the northern wedge of the three-way road junction.
 // The renderer preserves the artwork's aspect ratio inside this reference size;
 // collision belongs only to the low building footprint, never its roof.
 const STABLE={
  id:'wasteland-stable',name:'Torstens Stall',junction:{x:14000,y:18000},
  building:{x:14700,y:17120,w:310,h:260,art:'assets/mounts/stable.png',footRatio:.96,
   bounds:{x:14545,y:16870.4,w:310,h:260},collider:{r:38,crx:122.5,cry:38,cyo:-12.5}},
  vendor:{id:'torsten-tygel',name:'Torsten Tygel',x:15125,y:17115,r:18,range:120,
   race:'human',cls:'warrior',female:false,game:'stable',big:1.1,fx:-1,fy:0,walk:0,moving:false},
  paddock:{bounds:{x:15200,y:16680,w:650,h:520},
   gate:{x:15200,y:17070,from:16990,to:17150,width:160,side:'west'},
   displaySpots:[{x:15400,y:17035,fx:-1},{x:15625,y:16970,fx:1}]},
  // Access lanes clear scenery but do not alter the four authored roads.
  approach:[{x:14700,y:17809.090909090908},{x:15100,y:17500},{x:15125,y:17115},{x:14700,y:17220}],
  paddockApproach:[{x:15125,y:17115},{x:15100,y:17070},{x:15260,y:17070}],
  clearZones:[{x:14345,y:16665,w:715,h:670},{x:15120,y:16590,w:820,h:710},{x:14580,y:17250,w:650,h:410}]
 };
 function freezeData(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeData(child);Object.freeze(value);}return value;}
 freezeData(STABLE);
 freezeData(OVERWORLDS);
 const TRAINING=freezeData({
  id:'sunscar-training',name:'Tide Training Grounds',
  building:{x:7800,y:16980,w:440,art:'assets/wasteland/training-lodge.png',footRatio:.96,
   bounds:{x:7580,y:16555,w:440,h:445},collider:{r:48,crx:176,cry:48,cyo:-46}},
  vendor:{id:'viggo-tidekeeper',name:'Viggo',x:7920,y:17200,r:18,range:140,
   race:'human',cls:'warrior',female:false,game:'tidetraining',big:1.2,fx:1,fy:0,walk:0,moving:false},
  paddocks:[0,1,2].map(i=>({id:'training-pen-'+i,index:i,bounds:{x:8250+i*740,y:16500,w:640,h:700},
   gate:{x:8570+i*740,y:17200,from:8490+i*740,to:8650+i*740,width:160,side:'south'},
   displaySpot:{x:8570+i*740,y:16900,fx:i%2?-1:1}})),
  approach:[{x:7800,y:18000},{x:7920,y:17550},{x:7920,y:17200}],
  clearZones:[{x:7410,y:16380,w:2920,h:1160},{x:7650,y:17400,w:800,h:680}]
 });
 const LAYOUTS={
  briarhollow:{cols:60,rows:40,rooms:[[2,29,7,7],[14,28,8,8],[13,13,9,9],[27,14,9,8],[29,28,8,8],[44,25,13,13],[29,2,8,8],[44,2,13,13]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[3,6],[6,7],[2,6]]},
  cindervein:{cols:60,rows:40,rooms:[[2,17,7,7],[14,16,8,8],[14,2,8,8],[28,2,9,9],[28,17,9,8],[44,2,13,13],[28,30,8,8],[44,25,13,13]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[4,6],[6,7],[1,6]]},
  frostveil:{cols:70,rows:44,rooms:[[31,35,8,7],[31,23,8,8],[15,24,8,8],[15,9,8,8],[31,8,8,8],[1,1,12,12],[47,9,8,8],[56,1,12,12]],links:[[0,1],[1,2],[2,3],[3,4],[3,5],[4,6],[6,7],[1,4]]}
 };
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(x,y,seed){let n=(Math.imul(x,73856093)^Math.imul(y,19349663)^seed)>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
 function rng(seed){return function(){seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
 function distanceToSegment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a.x-dx*t,y-a.y-dy*t);}
 function road(points,width=160){return {width,points:points.map(p=>({x:p[0],y:p[1]}))};}
 function worldPaths(world){return world.edgePaths?world.paths.concat(world.edgePaths):world.paths;}
 function nearRoad(world,x,y,pad){for(const p of worldPaths(world))for(let i=1;i<p.points.length;i++)if(distanceToSegment(x,y,p.points[i-1],p.points[i])<p.width/2+pad)return true;return false;}
 function clearSpot(world,x,y,pad){
  if(Math.hypot(x-world.spawn.x,y-world.spawn.y)<420+pad)return true;
  if(world.edgeNeighbors&&(world.edgeNeighbors.north&&y<240+pad||world.edgeNeighbors.south&&y>world.h-240-pad||world.edgeNeighbors.west&&x<240+pad||world.edgeNeighbors.east&&x>world.w-240-pad))return true;
  if(world.stable&&world.stable.clearZones.some(r=>x>r.x-pad&&x<r.x+r.w+pad&&y>r.y-pad&&y<r.y+r.h+pad))return true;
  if(world.training&&world.training.clearZones.some(r=>x>r.x-pad&&x<r.x+r.w+pad&&y>r.y-pad&&y<r.y+r.h+pad))return true;
  return world.entrances.some(e=>Math.hypot(x-e.x,y-e.y)<e.clearRadius+pad)||nearRoad(world,x,y,pad);
 }
 function addStable(world){
  // Per-world copies may acquire UI state; the exported landmark remains immutable.
  const stable=world.stable=JSON.parse(JSON.stringify(STABLE)),b=stable.building,p=stable.paddock,props=[];
  props.push({x:b.x,y:b.y,type:'stable',...b.collider,wastelandProp:true,stableLandmark:'building'});
  // These catalogue IDs and collider dimensions match the existing farm art.
  const shapes={staket:{r:14,crx:65,cry:9,cyo:4},staketv:{r:14,crx:8,cry:47,cyo:-33},hobal:{r:25},trough:{r:14,crx:46,cry:14,cyo:0}};
  const add=(ftype,x,y,sc=1)=>{
   const shape=shapes[ftype],s={x,y,r:shape.r*sc,type:'farmitem',ftype,it:{sc},wastelandProp:true,stableLandmark:ftype};
   if(shape.crx){s.crx=shape.crx*sc;s.cry=shape.cry*sc;s.cyo=shape.cyo*sc;}props.push(s);
  };
  const horizontal=(y)=>{
   const n=Math.ceil(p.bounds.w/130),step=p.bounds.w/n,sc=step/130;
   for(let i=0;i<n;i++)add('staket',p.bounds.x+(i+.5)*step,y-4*sc,sc);
  };
  const vertical=(x,from,to)=>{
   const n=Math.ceil((to-from)/94),step=(to-from)/n,sc=step/94;
   for(let i=0;i<n;i++)add('staketv',x,from+(i+.5)*step+33*sc,sc);
  };
  horizontal(p.bounds.y);horizontal(p.bounds.y+p.bounds.h);
  vertical(p.bounds.x+p.bounds.w,p.bounds.y,p.bounds.y+p.bounds.h);
  vertical(p.bounds.x,p.bounds.y,p.gate.from);vertical(p.bounds.x,p.gate.to,p.bounds.y+p.bounds.h);
  add('hobal',15450,16805);add('hobal',15540,16815);add('trough',15730,16795);
  stable.props=props;world._landmarkProps.push(...props);world.npcs=[stable.vendor];
 }
 function baseWorld(key,seed,w,h){return {key,wasteland:true,overworld:!!OVERWORLDS[key],dungeon:OVERWORLDS[key]?null:key,seed:seed>>>0,w,h,spawn:{x:0,y:0},portal:{x:-500,y:-500},solids:[],mwalls:[],deco:[],waters:[],paths:[],floors:[],entrances:[],enemySpawns:[],bossRooms:[],pathY:-500,pathH:0};}
 function createRegion(key='wasteland',seed=13){
  if(!OVERWORLDS[key]&&!LAYOUTS[key])throw new RangeError('Unknown Wasteland zone: '+key);
  if(!OVERWORLDS[key])return createDungeon(key,seed);
  const w=baseWorld(key,seed,REGION_W,REGION_H),def=OVERWORLDS[key];
  w.name=def.name;w.biome=def.biome;w.worldOffset={...def.offset};w.edgeNeighbors={...def.neighbors};w._landmarkProps=[];
  if(key!=='wasteland')return createBiome(w);
  w.spawn={x:2400,y:23600};w.exit={...w.spawn,id:'city',r:95};
  w.entrances=ENTRANCES.map(e=>({...e}));
  w.paths=[
   road([[2400,23600],[8000,22000],[14000,18000],[25000,15000],[33000,18000],[43200,20500]],180),
   road([[14000,18000],[11000,12000],[12600,6200]],160),
   road([[25000,15000],[28500,9200],[34500,6400],[41400,4200]],160),
   road([[12600,6200],[21000,7400],[28500,9200]],140)
  ];
  w.edgePaths=[road([[28500,9200],[28500,0]],160),road([[33000,18000],[50400,18000]],180)];
  addStable(w);
  addEntranceLandmarks(w);
  w._chunkCache=new Map();w._chunkKey='';updateChunks(w,w.spawn.x,w.spawn.y,1800);return w;
 }
 // Region-local authoring and persistent random seeds remain unchanged. The
 // playable world is a single coordinate space; crossing a seam never rebuilds it.
 function translated(value,dx,dy){
  if(Array.isArray(value))return value.map(item=>translated(item,dx,dy));
  if(!value||typeof value!=='object')return value;
  const out={};for(const [key,item]of Object.entries(value))out[key]=translated(item,dx,dy);
  if(Number.isFinite(out.x))out.x+=dx;if(Number.isFinite(out.y))out.y+=dy;
  if(Number.isFinite(out.cx))out.cx+=dx;if(Number.isFinite(out.cy))out.cy+=dy;
  if(Number.isFinite(out.from)&&Number.isFinite(out.to)&&out.side){const offset=out.side==='west'||out.side==='east'?dy:dx;out.from+=offset;out.to+=offset;}
  return out;
 }
 function create(key='wasteland',seed=13){
  if(!OVERWORLDS[key])return createRegion(key,seed);
  const world=baseWorld('wasteland',seed,REGION_W*2,REGION_H*2);
  world.unified=true;world.name='Wasteland';world.biome='mixed';world.regions=REGIONS;
  world._regions=REGIONS.map(region=>({...region,world:createRegion(region.key,seed)}));
  const grass=world._regions.find(r=>r.key==='wasteland'),desert=world._regions.find(r=>r.biome==='desert'),entry=world._regions.find(r=>r.key===key);
  world.spawn=translated(entry.world.spawn,entry.x,entry.y);
  world.exit=translated(grass.world.exit,grass.x,grass.y);
  world.entrances=translated(grass.world.entrances,grass.x,grass.y);
  world.stable=translated(grass.world.stable,grass.x,grass.y);
  world.training=translated(desert.world.training,desert.x,desert.y);
  world.npcs=[world.stable.vendor,world.training.vendor];
  world.paths=world._regions.flatMap(r=>translated(worldPaths(r.world),r.x,r.y));
  world._landmarkProps=world._regions.flatMap(r=>translated(r.world._landmarkProps,r.x,r.y));
  // The missing northeast quadrant is outside the L-shaped landmass.
  world.mwalls=[{x:REGION_W,y:0,w:REGION_W,h:REGION_H}];
  world._chunkKey='';updateChunks(world,world.spawn.x,world.spawn.y,1800);return world;
 }
 function contains(world,x,y,r=0){
  if(!world||!Number.isFinite(x)||!Number.isFinite(y)||x<r||y<r||x>world.w-r||y>world.h-r)return false;
  return !world.unified||!(x+r>REGION_W&&y-r<REGION_H);
 }
 function biomeAt(world,x,y){
  if(!world?.unified)return world?.biome||null;
  return REGIONS.find(r=>x>=r.x&&y>=r.y&&x<=r.x+r.w&&y<=r.y+r.h)?.biome||null;
 }
 function trimRegionCaches(world,property,limit){
  let total=world._regions.reduce((n,r)=>n+(r.world[property]?.size||0),0);
  if(total<=limit)return;
  // Evict the oldest entries from the least recently rendered region first.
  for(const region of [...world._regions].sort((a,b)=>(a.lastVisible||0)-(b.lastVisible||0))){
   const cache=region.world[property];if(!cache)continue;
   while(cache.size&&total>limit){cache.delete(cache.keys().next().value);total--;}
  }
 }
 function updateUnifiedChunks(world,x,y,viewRadius){
  const radius=clamp(Number.isFinite(viewRadius)?viewRadius:1800,CHUNK,MAX_RADIUS),key=Math.floor(x/CHUNK)+','+Math.floor(y/CHUNK)+','+Math.ceil(radius/CHUNK);
  if(world._chunkKey===key)return false;world._chunkKey=key;
  const solids=[],deco=[],view={x:x-radius-CHUNK,y:y-radius-CHUNK,w:(radius+CHUNK)*2,h:(radius+CHUNK)*2};
  for(const region of world._regions){
   if(!intersects(region,view)){region.world._chunkCache.clear();region.world._chunkKey='';continue;}
   updateChunks(region.world,x-region.x,y-region.y,radius);
   solids.push(...translated(region.world.solids,region.x,region.y));deco.push(...translated(region.world.deco,region.x,region.y));
  }
  world.solids=solids;world.deco=deco;world._sg=null;world._sgN=-1;
  trimRegionCaches(world,'_chunkCache',GEOMETRY_CACHE);return true;
 }
 function farmProp(ftype,x,y,sc=1,metadata={}){
  const shapes={staket:{r:14,crx:65,cry:9,cyo:4},staketv:{r:14,crx:8,cry:47,cyo:-33},hobal:{r:25},trough:{r:14,crx:46,cry:14,cyo:0},
   light_farm:{r:8},tree_farm:{r:16},woodpile:{r:16,crx:44,cry:14,cyo:0},crates:{r:14,crx:38,cry:14,cyo:0},
   well:{r:30},bench:{r:12,crx:42,cry:12,cyo:0},farmsign:{r:8},pond:{r:30,crx:80,cry:34,cyo:2},scarecrow:{r:10}},shape=shapes[ftype];
  if(!shape)throw new RangeError('Unknown expedition decoration: '+ftype);
  const p={x,y,type:'farmitem',ftype,it:{sc},wastelandProp:true,...metadata};
  for(const [k,v]of Object.entries(shape))p[k]=v*sc;return p;
 }
 function addTraining(world){
  const t=world.training=JSON.parse(JSON.stringify(TRAINING)),b=t.building,props=[];
  props.push({x:b.x,y:b.y,type:'tidetraining',...b.collider,wastelandProp:true,trainingLandmark:'building'});
  const add=(id,x,y,sc=1)=>props.push(farmProp(id,x,y,sc,{trainingLandmark:id}));
  const horizontal=(from,to,y)=>{const n=Math.ceil((to-from)/130),step=(to-from)/n,sc=step/130;for(let i=0;i<n;i++)add('staket',from+(i+.5)*step,y-4*sc,sc);};
  const vertical=(x,from,to)=>{const n=Math.ceil((to-from)/94),step=(to-from)/n,sc=step/94;for(let i=0;i<n;i++)add('staketv',x,from+(i+.5)*step+33*sc,sc);};
  for(const p of t.paddocks){
   const r=p.bounds;horizontal(r.x,r.x+r.w,r.y);horizontal(r.x,p.gate.from,r.y+r.h);horizontal(p.gate.to,r.x+r.w,r.y+r.h);
   vertical(r.x,r.y,r.y+r.h);vertical(r.x+r.w,r.y,r.y+r.h);
   add('trough',r.x+r.w-110,r.y+120);add('hobal',r.x+100,r.y+135);add('hobal',r.x+155,r.y+125,.8);
  }
  add('well',7710,17200);add('bench',7600,17240);add('light_farm',8060,17220,1.15);add('light_farm',8150,17490,1.15);
  add('crates',7590,16955,1.1);add('woodpile',7640,17080);add('farmsign',8070,17670,1.15);
  add('tree_farm',7540,17440,1.1);add('tree_farm',10440,17320,1.15);
  t.props=props;world._landmarkProps.push(...props);world.npcs=[t.vendor];
 }
 function createBiome(world){
  if(world.biome==='snow'){
   world.spawn={x:28500,y:25700};
   world.paths=[road([[28500,26000],[28500,22000],[24100,17200],[15800,14800],[7800,8200]],160),
    road([[24100,17200],[32000,13000],[41400,5600]],150),road([[15800,14800],[18100,5800],[27900,3900],[41400,5600]],140)];
  }else{
   world.spawn={x:300,y:18000};
   world.paths=[road([[0,18000],[7800,18000],[17500,19500],[26900,14000],[36200,10600],[44500,4800]],180),
    road([[17500,19500],[11600,9900],[19400,5100],[29000,7600],[36200,10600]],160),
    road([[26900,14000],[33800,20100],[44100,22100]],150)];
   addTraining(world);
  }
  world._chunkCache=new Map();world._chunkKey='';updateChunks(world,world.spawn.x,world.spawn.y,1800);return world;
 }
 function addEntranceLandmarks(world){
  for(const e of world.entrances){
   const kinds=e.id==='briarhollow'?['tree_farm','rock','woodpile','tree_farm','light_farm','rock','tree_farm','rock']:
    e.id==='cindervein'?['rock','crates','light_farm','woodpile','rock','crates','rock','light_farm']:
    ['rock','light_farm','snowtree','rock','snowtree','rock','light_farm','rock'];
   const candidates=[[-580,-150],[590,-220],[-620,260],[640,280],[-430,-520],[440,-570],[-880,-80],[890,10],[-710,-610],[730,-650],[-850,510],[860,520]];
   let placed=0;
   for(const [dx,dy]of candidates){
    const x=e.x+dx,y=e.y+dy;if(clearSpot(world,x,y,150))continue;
    const kind=kinds[placed%kinds.length],metadata={entranceLandmark:e.id};
    if(kind==='rock')world._landmarkProps.push({x,y,r:37+placed%3*7,s:1.05,seed:placed*.73,type:'rock',wastelandProp:true,...metadata});
    else if(kind==='snowtree')world._landmarkProps.push({x,y,r:30,s:1.15,seed:placed*.73,type:'tree',snowy:true,wastelandProp:true,...metadata});
    else world._landmarkProps.push(farmProp(kind,x,y,kind==='tree_farm'?1.1:1.05,metadata));
    placed++;
   }
  }
 }
 function addCorridor(world,grid,a,b,horizontalFirst){
  const sx=Math.floor(a.cx/CELL),sy=Math.floor(a.cy/CELL),ex=Math.floor(b.cx/CELL),ey=Math.floor(b.cy/CELL),mx=horizontalFirst?ex:sx,my=horizontalFirst?sy:ey;
  const pts=[[sx,sy],[mx,my],[ex,ey]];
  for(let i=1;i<pts.length;i++){
   const u=pts[i-1],v=pts[i];if(u[0]===v[0]&&u[1]===v[1])continue;
   const r={x:(Math.min(u[0],v[0])-1)*CELL,y:(Math.min(u[1],v[1])-1)*CELL,w:(Math.abs(u[0]-v[0])+3)*CELL,h:(Math.abs(u[1]-v[1])+3)*CELL,kind:'corridor'};
   world.floors.push(r);fillGrid(grid,world._cols,r);
  }
  world.paths.push(road(pts.map(p=>[(p[0]+.5)*CELL,(p[1]+.5)*CELL]),CELL*3));
 }
 function fillGrid(grid,cols,r){for(let y=r.y/CELL;y<(r.y+r.h)/CELL;y++)for(let x=r.x/CELL;x<(r.x+r.w)/CELL;x++)grid[y*cols+x]=1;}
 function wallRectangles(grid,cols,rows){
  const out=[],active=new Map();
  for(let y=0;y<rows;y++){
   const next=new Map();let x=0;
   while(x<cols){if(grid[y*cols+x]){x++;continue;}const start=x;while(x<cols&&!grid[y*cols+x])x++;const key=start+':'+x;
    let r=active.get(key);if(r)r.h+=CELL;else{r={x:start*CELL,y:y*CELL,w:(x-start)*CELL,h:CELL};out.push(r);}next.set(key,r);
   }
   active.clear();for(const [k,v]of next)active.set(k,v);
  }
  return out;
 }
 function floorEdges(grid,cols,rows){
  const lines=new Map(),add=(axis,fixed,at,side)=>{const k=axis+','+fixed+','+side;if(!lines.has(k))lines.set(k,{axis,fixed,side,at:[]});lines.get(k).at.push(at);};
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(grid[y*cols+x]){
   if(!grid[(y-1)*cols+x])add('h',y,x,'north');if(!grid[(y+1)*cols+x])add('h',y+1,x,'south');
   if(x===0||!grid[y*cols+x-1])add('v',x,y,'west');if(x===cols-1||!grid[y*cols+x+1])add('v',x+1,y,'east');
  }
  const edges=[];for(const line of lines.values()){
   const sorted=line.at.sort((a,b)=>a-b);let start=sorted[0],end=start+1;
   const emit=()=>edges.push(line.axis==='h'?{x:start*CELL,y:line.fixed*CELL,w:(end-start)*CELL,h:0,side:line.side}:{x:line.fixed*CELL,y:start*CELL,w:0,h:(end-start)*CELL,side:line.side});
   for(let i=1;i<sorted.length;i++){if(sorted[i]===end)end++;else{emit();start=sorted[i];end=start+1;}}emit();
  }
  return edges;
 }
 function createDungeon(key,seed){
  const l=LAYOUTS[key],w=baseWorld(key,seed,l.cols*CELL,l.rows*CELL),grid=new Uint8Array(l.cols*l.rows);w._cols=l.cols;w._rows=l.rows;w._floorGrid=grid;w.theme=THEMES[key];
  w.rooms=l.rooms.map((r,i)=>({id:key+'-'+i,index:i,x:r[0]*CELL,y:r[1]*CELL,w:r[2]*CELL,h:r[3]*CELL,cx:(r[0]+r[2]/2)*CELL,cy:(r[1]+r[3]/2)*CELL,kind:i===0?'entry':i===5||i===7?'boss':'chamber'}));
  for(const r of w.rooms){w.floors.push({...r});fillGrid(grid,l.cols,r);}
  for(let i=0;i<l.links.length;i++){const [a,b]=l.links[i];addCorridor(w,grid,w.rooms[a],w.rooms[b],key==='cindervein'||i%2===0);}
  w.mwalls=wallRectangles(grid,l.cols,l.rows);w.wallEdges=floorEdges(grid,l.cols,l.rows);
  const entry=w.rooms[0];w.spawn={x:entry.cx,y:entry.cy};w.exit={x:entry.cx,y:entry.cy+CELL*1.5,id:'wasteland',r:90};
  for(const [index,roomIndex]of [5,7].entries()){
   const r=w.rooms[roomIndex],bossRoom={...r,index,r:420};w.bossRooms.push(bossRoom);w.enemySpawns.push({type:'boss',index,x:r.cx,y:r.cy,room:r.id});
  }
  const R=rng(seed^hash(key.length,11,33));let count=0;
  for(const r of w.rooms.filter(r=>r.kind==='chamber')){
   for(const [dx,dy]of [[-170,-100],[160,-80],[0,155]])w.enemySpawns.push({type:'mob',index:count++%3,x:r.cx+dx,y:r.cy+dy,room:r.id});
   // Side props leave the chamber centre and every corridor unobstructed.
   for(const [corner,[dx,dy]]of [[100,100],[-100,100],[100,-100],[-100,-100]].entries()){
    const x=dx>0?r.x+dx:r.x+r.w+dx,y=dy>0?r.y+dy:r.y+r.h+dy;
    if(nearRoad(w,x,y,75))continue;
    if(corner===3||(key==='frostveil'&&corner===0))w.solids.push({x,y,r:8,type:'farmitem',ftype:'light_farm',it:{sc:1},wastelandProp:true});
    else if(key==='briarhollow'&&corner===0)w.solids.push({x,y,r:16,type:'farmitem',ftype:'tree_farm',it:{sc:.82},wastelandProp:true});
    else if(key==='cindervein'&&corner===1)w.solids.push({x,y,r:17,type:'farmitem',ftype:'crates',it:{sc:.85},wastelandProp:true});
    else w.solids.push({x,y,r:23+R()*10,s:.7+R()*.4,seed:R()*7,type:'rock',wastelandProp:true});
   }
  }
  for(const r of w.bossRooms){
   const points=[[-500,130],[-470,290],[500,90],[470,290],[-280,470],[260,500],[-420,-330],[430,-340]];
   const kinds=key==='briarhollow'?['tree_farm','rock','tree_farm','woodpile','rock','light_farm','rock','tree_farm']:key==='cindervein'?['rock','crates','rock','crates','woodpile','light_farm','rock','rock']:['rock','light_farm','rock','rock','rock','light_farm','rock','rock'];
   points.forEach(([dx,dy],i)=>{
    const x=r.cx+dx,y=r.cy+dy;if(nearRoad(w,x,y,65))return;
    if(kinds[i]==='rock')w.solids.push({x,y,r:30+(i%3)*5,s:1,seed:i*1.71,type:'rock',wastelandProp:true});
    else w.solids.push({x,y,r:kinds[i]==='light_farm'?8:18,type:'farmitem',ftype:kinds[i],it:{sc:kinds[i]==='tree_farm'?.9:1.1,fl:i%2?-1:1},wastelandProp:true});
   });
  }
  w.deco=w.rooms.filter(r=>r.kind!=='entry').map((r,i)=>({x:r.cx+230,y:r.cy+210,k:(i%3)/2}));
  return w;
 }
 function chunkGeometry(world,cx,cy){
  const key=cx+','+cy,cache=world._chunkCache;
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const salt=world.biome==='snow'?0x19cb73:world.biome==='desert'?0x5a903f:0,R=rng(hash(cx,cy,world.seed^salt)),out={solids:[],deco:[]};
  // Six stratified candidates per chunk avoid unbounded clusters and overlap.
  for(let i=0;i<6;i++){
   const x=cx*CHUNK+(i%3+.2+R()*.6)*CHUNK/3,y=cy*CHUNK+(Math.floor(i/3)+.2+R()*.6)*CHUNK/2;
   if(x<120||y<140||x>world.w-120||y>world.h-80||clearSpot(world,x,y,150)||world._landmarkProps.some(p=>Math.hypot(x-p.x,y-p.y)<230))continue;
   const k=R();
   if(world.biome==='snow'){
    out.solids.push({x,y,r:25+R()*19,s:.8+R()*.6,seed:R()*7,type:k<.72?'tree':'rock',snowy:true,wastelandProp:true});continue;
   }
   if(world.biome==='desert'){
    // Broad-leaf trees form sparse shade among sun-worn boulders; the existing
    // farm artwork keeps the oasis foliage in the same painted game style.
    if(k<.12)out.solids.push(farmProp('tree_farm',x,y,.85+R()*.4));
    else out.solids.push({x,y,r:25+R()*22,s:.7+R()*.65,seed:R()*7,type:'rock',wastelandProp:true});continue;
   }
   const nearBriar=Math.hypot(x-12600,y-6200)<6500,nearCinder=Math.hypot(x-43200,y-20500)<5500,nearFrost=Math.hypot(x-41400,y-4200)<5200;
   if(k<(nearBriar?.4:.1))out.solids.push({x,y,r:19,type:'farmitem',ftype:'tree_farm',it:{sc:.85+R()*.4,fl:R()<.5?-1:1},seed:R()*7,wastelandProp:true});
   else out.solids.push({x,y,r:nearCinder||nearFrost?22+R()*18:25+R()*14,s:.7+R()*.5,seed:R()*7,type:k<(nearCinder?.25:nearFrost?.18:.67)?'tree':'rock',snowy:nearFrost||terrainWeights(world,x,y).snow>.35,wastelandProp:true});
  }
  for(let i=0;i<8;i++){const x=(cx+R())*CHUNK,y=(cy+R())*CHUNK;if(x>=0&&y>=0&&x<=world.w&&y<=world.h)out.deco.push({x,y,k:R()});}
  cache.set(key,out);while(cache.size>GEOMETRY_CACHE)cache.delete(cache.keys().next().value);return out;
 }
 function updateChunks(world,x,y,viewRadius=1800){
  if(!world||!world.overworld)return false;
  if(world.unified)return updateUnifiedChunks(world,x,y,viewRadius);
  const radius=clamp(Number.isFinite(viewRadius)?viewRadius:1800,CHUNK,MAX_RADIUS),cx=Math.floor(clamp(x,0,world.w)/CHUNK),cy=Math.floor(clamp(y,0,world.h)/CHUNK),n=Math.ceil(radius/CHUNK),key=cx+','+cy+','+n;
  if(world._chunkKey===key)return false;world._chunkKey=key;
  const solids=[],deco=[];
  for(let j=Math.max(0,cy-n);j<=Math.min(Math.ceil(world.h/CHUNK)-1,cy+n);j++)for(let i=Math.max(0,cx-n);i<=Math.min(Math.ceil(world.w/CHUNK)-1,cx+n);i++){
   const chunk=chunkGeometry(world,i,j);solids.push(...chunk.solids);deco.push(...chunk.deco);
  }
  for(const p of world._landmarkProps)if(Math.abs(p.x-(cx+.5)*CHUNK)<(n+.5)*CHUNK&&Math.abs(p.y-(cy+.5)*CHUNK)<(n+.5)*CHUNK)solids.push(p);
  world.solids=solids;world.deco=deco;world._sg=null;world._sgN=-1;return true;
 }
 function isWalkable(world,x,y,r=0){
  if(!contains(world,x,y,r))return false;
  if(x<r+16||y<r+16||x>world.w-r-16||y>world.h-r-16)return false;
  for(const wall of world.mwalls)if(x>wall.x-r&&x<wall.x+wall.w+r&&y>wall.y-r&&y<wall.y+wall.h+r)return false;
  return true;
 }
 function terrainWeights(world,x,y){
  const offset=world.unified?{x:0,y:-REGION_H}:world.worldOffset||{x:0,y:0},gx=x+offset.x,gy=y+offset.y;
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const snow=smooth((BLEND/2-gy)/BLEND),desert=smooth((gx-REGION_W+BLEND/2)/BLEND);
  return {grass:(1-snow)*(1-desert),snow:snow*(1-desert),desert};
 }
 const intersects=(a,b,pad=0)=>a.x<=b.x+b.w+pad&&a.y<=b.y+b.h+pad&&a.x+a.w>=b.x-pad&&a.y+a.h>=b.y-pad;
 const terrainImageIds=new WeakMap();let nextTerrainImageId=1;
 function imageReady(im){return !!(im&&im.complete!==false&&(im.naturalWidth===undefined?im.width:im.naturalWidth)>0&&(im.naturalHeight===undefined?im.height:im.naturalHeight)>0);}
 function terrainImageSignature(images){
  return Object.keys(images).sort().map(k=>{
   const im=images[k];if(!im)return k+':none';
   if(!terrainImageIds.has(im))terrainImageIds.set(im,nextTerrainImageId++);
   // Image dimensions can arrive before its pixels finish loading. A fallback
   // chunk must be rebuilt when that same, already-sized image becomes ready.
   return [k,terrainImageIds.get(im),imageReady(im)?1:0,im.naturalWidth===undefined?im.width:im.naturalWidth,im.naturalHeight===undefined?im.height:im.naturalHeight,im.currentSrc||im.src||''].join(':');
  }).join('|');
 }
 function dirtCrop(im){return imageReady(im)?[2,2,(im.naturalWidth||im.width)-4,(im.naturalHeight||im.height)-4]:null;}
 function makeCanvas(options,size){const c=options.createCanvas?options.createCanvas(size,size):typeof document!=='undefined'?document.createElement('canvas'):typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):null;if(c)c.width=c.height=size;return c;}
 function texture(g,im,rect,crop,scale=1,offset={x:0,y:0}){
  if(!imageReady(im))return false;const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,src=crop||[0,0,iw,ih],tw=src[2]*scale,th=src[3]*scale;
  g.save();g.beginPath();g.rect(rect.x,rect.y,rect.w,rect.h);g.clip();
  for(let j=Math.floor((rect.y+offset.y)/th);j<Math.ceil((rect.y+rect.h+offset.y)/th);j++)for(let i=Math.floor((rect.x+offset.x)/tw);i<Math.ceil((rect.x+rect.w+offset.x)/tw);i++){
   // Source repeats can also land between cache pixels (e.g. 256 * 1.15).
   // Overlap these internal blits so the fallback colour cannot leak through.
   g.save();g.translate((i+.5)*tw-offset.x,(j+.5)*th-offset.y);g.scale(i%2?-1:1,j%2?-1:1);g.drawImage(im,...src,-tw/2-.5,-th/2-.5,tw+1,th+1);g.restore();
  }
  g.restore();return true;
 }
 function translucentTexture(g,im,rect,crop,scale,alpha,options){
  if(!imageReady(im))return;
  const layer=makeCanvas(options,384);if(!layer)return;const b=layer.getContext('2d');
  b.scale(.5,.5);b.translate(-rect.x,-rect.y);texture(b,im,rect,crop,scale);
  // Blend once after the opaque repeats join, so their overlap cannot form stripes.
  g.save();g.globalAlpha=alpha;g.drawImage(layer,rect.x,rect.y,rect.w,rect.h);g.restore();
 }
 function biomeTexture(g,world,rect,id,options){
  const offset=world.worldOffset,im=(options.images||{})[id],vertical=id==='snow';
  const start=vertical?-BLEND/2-offset.y:REGION_W-BLEND/2-offset.x,end=start+BLEND;
  if(vertical?rect.y>=end:rect.x+rect.w<=start)return;
  const layer=makeCanvas(options,384);if(!layer)return;const b=layer.getContext('2d');
  b.scale(.5,.5);b.translate(-rect.x,-rect.y);
  b.fillStyle=vertical?'#c6d8dc':'#ceaf70';b.fillRect(rect.x,rect.y,rect.w,rect.h);
  if(imageReady(im))texture(b,im,rect,[0,0,im.naturalWidth||im.width,(im.naturalHeight||im.height)*.25],1.1,offset);
  if(vertical?rect.y+rect.h>start:rect.x<end){
   b.globalCompositeOperation='destination-in';
   const fade=vertical?b.createLinearGradient(0,start,0,end):b.createLinearGradient(start,0,end,0);
   // Smoothstep produces a broad feathered transition while sharing exactly
   // the same world coordinates and texture phase on both sides of travel.
   for(let i=0;i<=8;i++){const t=i/8,a=t*t*(3-2*t);fade.addColorStop(t,'rgba(255,255,255,'+(vertical?1-a:a)+')');}
   b.fillStyle=fade;b.fillRect(rect.x,rect.y,rect.w,rect.h);
  }
  g.drawImage(layer,rect.x,rect.y,rect.w,rect.h);
 }
 function paintDungeonWalls(g,world,v,images){
  const t=world.theme,im=world.key==='briarhollow'?images.cryptwall:images.raidwall||images.cryptwall;
  for(const wall of world.mwalls){
   if(!intersects(wall,v))continue;const x=Math.max(wall.x,v.x),y=Math.max(wall.y,v.y),right=Math.min(wall.x+wall.w,v.x+v.w),bottom=Math.min(wall.y+wall.h,v.y+v.h),rect={x,y,w:right-x,h:bottom-y};
   g.fillStyle=t.wall;g.fillRect(x,y,rect.w,rect.h);
   if(imageReady(im)){const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;texture(g,im,rect,[iw*.15,ih*.14,iw*.7,ih*.72],.45);g.fillStyle=t.tint;g.fillRect(x,y,rect.w,rect.h);g.fillStyle='rgba(4,9,14,.2)';g.fillRect(x,y,rect.w,rect.h);}
  }
  // Only genuine floor boundaries get a lip. Rectangle packing seams stay invisible.
  g.lineCap='square';for(const e of world.wallEdges){
   if(!intersects(e,v,25))continue;
   for(const [width,color]of [[30,'rgba(0,0,0,.15)'],[16,'rgba(0,0,0,.29)'],[4,t.edge]]){
    g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(e.x,e.y);g.lineTo(e.x+e.w,e.y+e.h);g.stroke();
   }
   if(world.key==='briarhollow'){
    g.strokeStyle='rgba(78,111,52,.55)';g.lineWidth=7;g.beginPath();g.moveTo(e.x+5,e.y+5);g.lineTo(e.x+e.w+5,e.y+e.h+5);g.stroke();
   }
  }
 }
 function terrainChunk(world,cx,cy,options){
  const images=options.images||{},sig=terrainImageSignature(images);
  if(world._terrainSig!==sig){world._terrainSig=sig;world._terrainCache=new Map();}
  const cache=world._terrainCache,key=cx+','+cy;
  if(cache.has(key)){const c=cache.get(key);cache.delete(key);cache.set(key,c);return c;}
  const c=makeCanvas(options,384);if(!c)return null;const g=c.getContext('2d'),rect={x:cx*CHUNK,y:cy*CHUNK,w:CHUNK,h:CHUNK};g.scale(.5,.5);g.translate(-rect.x,-rect.y);
  g.fillStyle=world.dungeon?world.theme.floor:world.biome==='snow'?'#c6d8dc':world.biome==='desert'?'#ceaf70':'#718343';g.fillRect(rect.x,rect.y,CHUNK,CHUNK);
  if(world.dungeon){
   if(world.key==='briarhollow'){
    texture(g,images.dirtroad,rect,dirtCrop(images.dirtroad),1.15);
    translucentTexture(g,images.farm,rect,null,.7,.36,options);
    g.fillStyle='rgba(19,42,20,.36)';g.fillRect(rect.x,rect.y,CHUNK,CHUNK);
   }else if(world.key==='cindervein'){
    const im=images.raidfloor;if(imageReady(im)){const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;texture(g,im,rect,[iw*.12,ih*.12,iw*.76,ih*.76],.72);}
    g.fillStyle='rgba(123,63,26,.27)';g.fillRect(rect.x,rect.y,CHUNK,CHUNK);
   }else{
    const im=images.crypt;if(imageReady(im)){const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;texture(g,im,rect,[iw*.43,ih*.71,iw*.28,ih*.24],1.1);}
    const snow=images.snow;if(imageReady(snow))translucentTexture(g,snow,rect,[0,0,snow.naturalWidth||snow.width,(snow.naturalHeight||snow.height)*.25],.85,.53,options);
    g.fillStyle='rgba(98,153,191,.17)';g.fillRect(rect.x,rect.y,CHUNK,CHUNK);
   }
   paintDungeonWalls(g,world,rect,images);
  }else{
   texture(g,images.farm,rect,null,.9,world.worldOffset);
   // Small clean top-of-map crops avoid repeating the authored leveling road.
   for(const [id,im,radius]of world.key==='wasteland'?[['cindervein',images.desert,4400],['frostveil',images.snow,4500]]:[]){
    const e=ENTRANCES.find(e=>e.id===id),d=Math.hypot(rect.x+CHUNK/2-e.x,rect.y+CHUNK/2-e.y);
    if(d<radius+CHUNK&&imageReady(im)){
     const layer=makeCanvas(options,384);if(!layer)continue;const b=layer.getContext('2d'),iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
     b.scale(.5,.5);b.translate(-rect.x,-rect.y);texture(b,im,rect,[0,0,iw,ih*.25],1.1);
     b.globalCompositeOperation='destination-in';const fade=b.createRadialGradient(e.x,e.y,radius-1800,e.x,e.y,radius);fade.addColorStop(0,'rgba(255,255,255,.78)');fade.addColorStop(1,'rgba(255,255,255,0)');b.fillStyle=fade;b.fillRect(rect.x,rect.y,CHUNK,CHUNK);
     g.drawImage(layer,rect.x,rect.y,CHUNK,CHUNK);
    }
   }
   biomeTexture(g,world,rect,'snow',options);biomeTexture(g,world,rect,'desert',options);
   paintRoadTexture(g,world,rect,options);
  }
  cache.set(key,c);while(cache.size>TERRAIN_CACHE)cache.delete(cache.keys().next().value);return c;
 }
 function clippedSegment(a,b,v,pad){
  const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
  for(const [p,q]of [[-dx,a.x-v.x+pad],[dx,v.x+v.w+pad-a.x],[-dy,a.y-v.y+pad],[dy,v.y+v.h+pad-a.y]]){
   if(!p){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  return [{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];
 }
 function strokeRoads(g,world,v){
  g.lineCap='round';g.lineJoin='round';
  for(const p of worldPaths(world))for(let i=1;i<p.points.length;i++){
   const seg=clippedSegment(p.points[i-1],p.points[i],v,p.width);if(!seg)continue;
   for(const [width,color]of [[p.width+16,'rgba(45,49,28,.22)'],[p.width,'#a39567'],[p.width*.65,'rgba(202,184,126,.28)']]){
    g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(seg[0].x,seg[0].y);g.lineTo(seg[1].x,seg[1].y);g.stroke();
   }
  }
 }
 function paintRoadTexture(g,world,rect,options){
  const segments=[];for(const p of worldPaths(world))for(let i=1;i<p.points.length;i++){const seg=clippedSegment(p.points[i-1],p.points[i],rect,p.width+50);if(seg)segments.push({seg,width:p.width});}
  if(!segments.length)return;
  const layer=makeCanvas(options,384),mask=makeCanvas(options,384);if(!layer||!mask)return;
  const b=layer.getContext('2d'),m=mask.getContext('2d');for(const c of [b,m]){c.scale(.5,.5);c.translate(-rect.x,-rect.y);}
  const dirt=(options.images||{}).dirtroad;
  // The authored tile has a translucent, pale outer pixel; repeat only its opaque interior.
  b.fillStyle='#90754b';b.fillRect(rect.x,rect.y,rect.w,rect.h);texture(b,dirt,rect,dirtCrop(dirt),1.15,world.worldOffset);
  // One union mask keeps junctions smooth. Soft dirt edges blend into the existing
  // grass, and all resampling happens once per cached chunk rather than every frame.
  m.lineCap='round';m.lineJoin='round';m.strokeStyle='#fff';m.shadowColor='#fff';m.shadowBlur=8;
  for(const {seg,width}of segments){m.lineWidth=width-16;m.beginPath();m.moveTo(seg[0].x,seg[0].y);m.lineTo(seg[1].x,seg[1].y);m.stroke();}
  b.globalCompositeOperation='destination-in';b.drawImage(mask,rect.x,rect.y,CHUNK,CHUNK);
  g.drawImage(layer,rect.x,rect.y,CHUNK,CHUNK);
 }
 function dungeonDetails(g,world,v){
  if(world.key==='cindervein'){
   g.lineCap='butt';for(const p of world.paths)for(let i=1;i<p.points.length;i++){
    const origin=p.points[i-1],end=p.points[i],seg=clippedSegment(origin,end,v,60);if(!seg)continue;
    const [a,b]=seg,dx=end.x-origin.x,dy=end.y-origin.y,len=Math.hypot(dx,dy);if(!len)continue;const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
    g.strokeStyle='#a38d75';g.lineWidth=4;for(const off of [-23,23]){g.beginPath();g.moveTo(a.x+nx*off,a.y+ny*off);g.lineTo(b.x+nx*off,b.y+ny*off);g.stroke();}
    // World-space phase is independent of the camera crop and travel direction.
    // Clip only the range of visible sleepers, never their 72-unit spacing origin.
    const from=a.x*ux+a.y*uy,to=b.x*ux+b.y*uy,offset=origin.x*ux+origin.y*uy;
    g.strokeStyle='#4a3427';g.lineWidth=9;for(let d=Math.ceil((from-1e-7)/72)*72;d<=to;d+=72){const x=origin.x+ux*(d-offset),y=origin.y+uy*(d-offset);g.beginPath();g.moveTo(x-nx*38,y-ny*38);g.lineTo(x+nx*38,y+ny*38);g.stroke();}
   }
  }
  for(const r of world.rooms){if(!intersects(r,v,40))continue;
   const R=rng(hash(r.index,world.seed,17));
   if(world.key==='briarhollow')for(let i=0;i<7;i++){
    const x=r.x+50+R()*(r.w-100),y=r.y+45+(i%2?r.h-90:0);g.fillStyle='rgba(111,148,69,.25)';g.beginPath();g.ellipse(x,y,35+R()*65,14+R()*15,0,0,Math.PI*2);g.fill();
   }
   if(world.key==='frostveil'){
    g.strokeStyle='rgba(192,232,255,.17)';g.lineWidth=3;g.strokeRect(r.x+42,r.y+42,r.w-84,r.h-84);
    for(let i=0;i<4;i++){const x=r.x+55+(i%2)*(r.w-110),y=r.y+55+Math.floor(i/2)*(r.h-110);g.fillStyle='rgba(149,207,230,.5)';g.beginPath();g.moveTo(x,y-23);g.lineTo(x+12,y);g.lineTo(x,y+15);g.lineTo(x-12,y);g.closePath();g.fill();}
   }
  }
 }
 function overworldDetails(g,world,v){
  if(world.training){
   const t=world.training;
   g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle='rgba(122,86,43,.22)';g.lineWidth=80;
   g.beginPath();for(const [i,p]of t.approach.entries())i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);g.stroke();
   for(const p of t.paddocks){
    if(!intersects(p.bounds,v,250))continue;
    g.fillStyle='rgba(115,83,43,.12)';g.fillRect(p.bounds.x+12,p.bounds.y+12,p.bounds.w-24,p.bounds.h-24);
    g.beginPath();g.moveTo(t.approach[1].x,t.approach[1].y);g.lineTo(p.gate.x,t.approach[1].y);g.lineTo(p.gate.x,p.gate.y-60);g.stroke();
    g.strokeStyle='rgba(232,204,147,.3)';g.lineWidth=3;g.beginPath();g.ellipse(p.displaySpot.x,p.displaySpot.y-20,145,82,0,0,Math.PI*2);g.stroke();
    g.strokeStyle='rgba(122,86,43,.22)';g.lineWidth=80;
   }g.restore();
  }
  for(const e of world.entrances){
   if(!intersects({x:e.x-1000,y:e.y-1000,w:2000,h:2000},v))continue;
   g.save();const shade=g.createRadialGradient(e.x,e.y-100,80,e.x,e.y-100,680);
   shade.addColorStop(0,e.id==='briarhollow'?'rgba(40,70,32,.25)':e.id==='cindervein'?'rgba(69,43,28,.25)':'rgba(170,211,228,.27)');shade.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=shade;g.fillRect(e.x-680,e.y-780,1360,1360);
   if(e.id==='briarhollow'){
    g.lineCap='round';g.strokeStyle='rgba(75,65,34,.55)';g.lineWidth=9;
    for(const side of [-1,1]){g.beginPath();g.moveTo(e.x+side*205,e.y-150);g.bezierCurveTo(e.x+side*350,e.y-110,e.x+side*365,e.y+230,e.x+side*540,e.y+320);g.stroke();}
   }else if(e.id==='cindervein'){
    // The approach rails use fixed authored coordinates, never camera phase.
    g.strokeStyle='#655443';g.lineWidth=5;for(const off of [-26,26]){g.beginPath();g.moveTo(e.x-120,e.y+off);g.lineTo(e.x-570,e.y-110+off);g.stroke();}
    g.strokeStyle='#59412b';g.lineWidth=11;for(let i=0;i<7;i++){const x=e.x-150-i*64,y=e.y-(i*64+30)*110/450;g.beginPath();g.moveTo(x-8,y+40);g.lineTo(x+8,y-40);g.stroke();}
   }g.restore();
  }
 }
 function renderGround(g,world,view,options={}){
  if(world?.unified){
   g.save();g.fillStyle='#171d20';g.fillRect(view.x,view.y,view.w,view.h);
   world._renderTick=(world._renderTick||0)+1;
   for(const region of world._regions){
    if(!intersects(region,view)){region.world._terrainCache?.clear();continue;}
    region.lastVisible=world._renderTick;g.save();g.translate(region.x,region.y);
    renderGround(g,region.world,{...view,x:view.x-region.x,y:view.y-region.y},options);g.restore();
   }
   trimRegionCaches(world,'_terrainCache',TERRAIN_CACHE);g.restore();return;
  }
  if(!world||!view)return;const v={x:Math.max(0,view.x),y:Math.max(0,view.y),w:0,h:0};v.w=Math.max(0,Math.min(world.w,view.x+view.w)-v.x);v.h=Math.max(0,Math.min(world.h,view.y+view.h)-v.y);if(!v.w||!v.h)return;
  g.save();g.beginPath();g.rect(v.x,v.y,v.w,v.h);g.clip();g.fillStyle=world.dungeon?world.theme.floor:world.biome==='snow'?'#c6d8dc':world.biome==='desert'?'#ceaf70':'#718343';g.fillRect(v.x,v.y,v.w,v.h);
  const tiles=Math.ceil(v.w/CHUNK+1)*Math.ceil(v.h/CHUNK+1);
  // A whole-map/debug view stays bounded as well. Normal play uses textured chunks.
  if(tiles<=144)for(let y=Math.floor(v.y/CHUNK);y<Math.ceil((v.y+v.h)/CHUNK);y++)for(let x=Math.floor(v.x/CHUNK);x<Math.ceil((v.x+v.w)/CHUNK);x++){
   // Fractional camera zoom can leave a hairline between independently sampled
   // opaque tiles. A half-world-pixel overlap closes it without enlarging caches.
   const tile=terrainChunk(world,x,y,options);if(tile)g.drawImage(tile,x*CHUNK-.5,y*CHUNK-.5,CHUNK+1,CHUNK+1);
  }
  if(world.dungeon){if(tiles>144)paintDungeonWalls(g,world,v,{});dungeonDetails(g,world,v);}
  else{if(tiles>144)strokeRoads(g,world,v);overworldDetails(g,world,v);}
  g.restore();
 }
 const api={create,updateChunks,renderGround,isWalkable,contains,biomeAt,distanceToSegment,terrainWeights,worldPaths,CHUNK,CELL,MAX_RADIUS,REGION_W,REGION_H,BLEND,REGIONS,STABLE:freezeData(translated(STABLE,0,REGION_H)),TRAINING:freezeData(translated(TRAINING,REGION_W,REGION_H)),OVERWORLDS,ENTRANCES:ENTRANCES.map(e=>Object.freeze(translated(e,0,REGION_H)))};
 root.WastelandWorld=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
