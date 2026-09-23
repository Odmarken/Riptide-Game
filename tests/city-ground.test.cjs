/* 🧱 The ground of the City (assets/city/city-ground.js), against the REAL seeded city: three classes of road with kerbs
 * that stop where another road or a square begins, squares that lie over the roads running into them, grass that is
 * never on a road - and, above all, quiet back-yard things that never stand on the Crown Ledger's stage. The boulevard
 * and the great square are where stalls, lamps, the statue, wagons, beggars and barricades come and go with the books;
 * nothing placed here may ever be in their way, whatever the books say. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const CG=require('../assets/city/city-ground.js'),CW=require('../assets/city/city-works.js');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function city(seed){
 const context=vm.createContext({world:{w:16800,h:5200,solids:[]},npcSebbeImg:{}});
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','/* 🧱 The floor of the City')+source.match(/^function mulberry32\(.*$/m)[0]+`;buildCity(mulberry32(${seed}));`,context);
 return JSON.parse(JSON.stringify(context.world));
}
const SEEDS=[26*7919+13,1,42];                       /* the first is the seed the game itself builds the City from (zone 26) */
const cache=new Map(),built=seed=>{if(!cache.has(seed)){const w=city(seed),p=CG.plan(w,{});cache.set(seed,{w,p,d:CG.decor(w,p)});}return cache.get(seed);};
/* everything the ledger can ever stand on the street, all at once */
const EVERYTHING={works:{aqueduct:'done',statue:'done',gardens:'done',lamps:'done',coveredmarket:'building'},stalls:23,xMax:16800-1300,
 street:{maypole:true,music:true,feast:2,tents:true,breadline:2,barricades:true,beggars:8}};

test('the plan reads the city and changes nothing in it: one boulevard, the cobbled streets, the alleys',()=>{
 const w=city(SEEDS[0]),before=JSON.stringify(w),p=CG.plan(w,{});
 assert.equal(JSON.stringify(w),before,'the world is only read');
 const count=cls=>p.roads.filter(r=>r.cls===cls).length;
 assert.equal(count('boulevard'),1);assert.equal(count('street'),7);assert.ok(count('alley')>40);
 assert.equal(p.roads.length,w.streets.length);
 assert.deepEqual([CG.classOf(280),CG.classOf(200),CG.classOf(180),CG.classOf(88)],['boulevard','street','street','alley']);
 const order=p.roads.map(r=>CG.CLASSES[r.cls].order);assert.deepEqual(order,[...order].sort((a,b)=>a-b),'the humblest road is laid first, the boulevard last');
 assert.deepEqual(JSON.parse(JSON.stringify(CG.plan(w,{}).tufts)),JSON.parse(JSON.stringify(p.tufts)),'the same every visit');
});

test('a kerb runs along a road and stops where another road, or a square, begins',()=>{
 const {p}=built(SEEDS[0]);
 assert.ok(p.kerbs.length>100);
 for(const k of p.kerbs){
  assert.ok(k.b-k.a>14&&k.cls!=='alley','alleys have no kerb');
  for(let t=k.a+8;t<=k.b-8;t+=25){
   const x=k.horiz?t:k.e,y=k.horiz?k.e:t,own=p.roads.filter(r=>x>=r.x-1&&x<=r.x+r.w+1&&y>=r.y-1&&y<=r.y+r.h+1);
   assert.equal(own.length,1,`the kerb at ${x},${y} lies across another road`);
   assert.ok(!p.inPlaza(x,y,-4),`the kerb at ${x},${y} runs into a square`);
  }
 }
 for(const d of p.drains)assert.ok(p.inRoad(d.x,d.y,0),'a drain lies in the gutter, on the road');
});

test('grass grows beside the roads and in the yards - never on a road, in a square or under a house',()=>{
 for(const seed of SEEDS){
  const {p}=built(seed);
  assert.ok(p.tufts.length>400);
  for(const t of p.tufts){
   assert.ok(!p.inRoad(t.x,t.y,0),`a clump on the road at ${Math.round(t.x)},${Math.round(t.y)}`);
   assert.ok(!p.inPlaza(t.x,t.y,0),'a clump in a square');assert.ok(!p.underHouse(t.x,t.y,0),'a clump under a facade');
   assert.ok(t.kind>=1&&t.kind<=4&&t.size>=20&&t.size<=42);
  }
 }
});

test('THE RULE: nothing stands on the ledger\'s stage - not on the boulevard, not on the great square, whatever the books say',()=>{
 for(const seed of SEEDS){
  const {w,p,d}=built(seed),ledger=[...CW.props(w,EVERYTHING),CW.noticeBoard(w)],sq=w.plazas[0];
  assert.ok(ledger.length>80,'the look used here puts out everything the ledger has');
  assert.ok(d.length>=30&&d.length<=110,`a few quiet details, not a forest: ${d.length}`);
  for(const s of d){
   assert.equal(s.type,'citydecor');assert.ok(CG.DECOR[s.kind]);
   assert.ok(Math.abs(s.y-w.h/2)>=CG.KEEP.boulevard,`${s.kind} at ${s.x},${s.y} is in the boulevard's corridor`);
   assert.ok(Math.hypot(s.x-sq.x,s.y-sq.y)>sq.r+300,`${s.kind} at ${s.x},${s.y} is on the great square`);
   for(const l of ledger)assert.ok(Math.hypot(s.x-l.x,s.y-l.y)>=250,`${s.kind} at ${s.x},${s.y} crowds the ledger's ${l.kind}`);
   for(let t=0;t<=1;t+=.05)for(const dir of [1,-1]){   /* and the wagons' and the handcarts' lanes, end to end */
    const lane=w.h/2+dir*-96;assert.ok(Math.abs(s.y-lane)>200);}
  }
  /* the unrest the ledger stages stands on roads, and no decor is near a road */
  for(const s of d){assert.ok(!p.inRoad(s.x,s.y,CG.KEEP.road-1),`${s.kind} by the road at ${s.x},${s.y}`);assert.ok(!p.inPlaza(s.x,s.y,CG.KEEP.plaza-1));}
 }
});

test('the quiet things stand in back yards: clear of the walls, never on or before a facade, and only trunks block the way',()=>{
 for(const seed of SEEDS){
  const {w,p,d}=built(seed);
  for(const s of d){
   assert.ok(s.x>=CG.KEEP.wall&&s.x<=w.w-CG.KEEP.wall&&s.y>=CG.KEEP.wall&&s.y<=w.h-CG.KEEP.wall);
   for(const f of p.houses)assert.ok(!(s.x>=f.x-CG.KEEP.house&&s.x<=f.x+f.w+CG.KEEP.house&&s.y>=f.y&&s.y<=f.base+CG.KEEP.front),`${s.kind} at ${s.x},${s.y} stands across a house front`);
   assert.equal(!!s.noCol,!CG.DECOR[s.kind].r,'a bush and a washing line are walked through; a trunk, a trough and a woodpile are not');
   if(!s.noCol)assert.ok(s.r<=32);
  }
  assert.ok(new Set(d.map(s=>s.kind)).size>=4,'a mix, not an orchard');
  assert.deepEqual(JSON.parse(JSON.stringify(CG.decor(w,p))),JSON.parse(JSON.stringify(d)),'the same every visit');
 }
 /* a keep-out is honoured: the halls' tall paintings, the palace stair, the harbour gate */
 const {w}=built(SEEDS[0]),all=CG.decor(w,CG.plan(w,{})),box={x:0,y:0,w:9000,h:2000},kept=CG.decor(w,CG.plan(w,{keepOut:[box]}));
 assert.ok(all.some(s=>s.x<=9000&&s.y<=2000));assert.ok(!kept.some(s=>s.x<=9000&&s.y<=2000));
});

test('the game hands it mosaics for the squares, keeps trees off the halls and gates, and never touches the builder',()=>{
 const apply=section('function cityGroundApply(){','\nfunction drawCityGround(){');
 for(const key of ['mosaic_compass','mosaic_crown','mosaic_anchor','mosaic_sun','mosaic_pick','mosaic_rune','mosaic_flame'])assert.ok(apply.includes("'"+key+"'"),key);
 assert.match(apply,/PALACE\.x-140/);assert.match(apply,/HARBOR_GATE\.x-90/);assert.match(apply,/CATH_ART/);
 assert.match(source,/if\(z\.city\)\{buildCity\(R\);cityGroundApply\(\);cityApplyAll\(\);\}/,'the floor is planned after the city is built, before the ledger dresses it');
 const builder=section('function buildCity(R){','\n/* 🧱 The floor of the City');
 assert.ok(!/CityGround/.test(builder),'buildCity knows nothing of it: no seeded number is drawn for the floor, no route or house moves');
 assert.match(section('function cityApplyWorks(){','\n}'),/filter\(s2=>s2\.type!=='citywork'\)/,'and the ledger only ever clears its own props');
 const draw=section('function drawCityGround(){','\n}');
 assert.ok(!/createPattern|cityPattern/.test(draw),'tile blits on a world grid, never a CanvasPattern');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.indexOf('assets/city/city-ground.js')>0&&html.indexOf('assets/city/city-ground.js')<html.indexOf('<script src="game.js'));
});

test('every painting exists and is in the manifest; pigeons leave when you walk in and come back when you have gone',()=>{
 const dir=path.join(root,'assets','city','ground'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'ground-art-manifest.json'),'utf8'));
 for(const name of CG.IMAGES){assert.ok(fs.existsSync(path.join(dir,name+'.png')),name+'.png');assert.ok(manifest.art[name+'.png']&&manifest.art[name+'.png'].jobId,name+' is in the manifest');}
 const flocks=[CG.flock(1000,1000,8,1)];
 assert.equal(flocks[0].birds.length,8);assert.ok(flocks[0].birds.every(b=>b.state==='peck'&&Math.hypot(b.x-1000,(b.y-1000)/.6)<110));
 for(let i=0;i<30;i++)CG.updateBirds(flocks,.1,{x:3000,y:3000});
 assert.ok(flocks[0].birds.every(b=>b.state==='peck'),'nobody near: they peck');
 CG.updateBirds(flocks,.1,{x:1000,y:1000});
 assert.ok(flocks[0].birds.every(b=>b.state==='flee'),'you walk in: they all go up');
 for(let i=0;i<25;i++)CG.updateBirds(flocks,.1,{x:1000,y:1000});
 assert.ok(flocks[0].birds.every(b=>b.state==='gone'));
 for(let i=0;i<200;i++)CG.updateBirds(flocks,.1,{x:1000,y:1000});
 assert.ok(flocks[0].birds.every(b=>b.state==='gone'),'and they do not land on your head');
 for(let i=0;i<400;i++)CG.updateBirds(flocks,.1,null);
 assert.ok(flocks[0].birds.every(b=>b.state==='peck'&&b.x===b.hx&&b.y===b.hy),'you leave: they come home');
});

test('drawing never hands the canvas a non-finite number - loaded or not, zoomed in or out',()=>{
 const calls={},g=new Proxy({createRadialGradient(){return {addColorStop(){}};}},{get(t,k){if(k in t)return t[k];return (...args)=>{calls[k]=(calls[k]||0)+1;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${String(k)} got ${a}`);};},set(t,k,v){t[k]=v;return true;}});
 const {w,d}=built(SEEDS[0]),p=CG.plan(w,{mosaics:[{key:'mosaic_compass',x:8400,y:2600,size:430},{key:'mosaic_anchor',x:8400,y:4300,size:186}],plazaStyles:{4:{soot:true}}});
 const images={};for(const k of CG.IMAGES)images[k]={complete:true,naturalWidth:768,naturalHeight:640};
 const flocks=[CG.flock(8400,1640,8,1)];CG.updateBirds(flocks,.1,{x:8400,y:1640});
 for(const view of [{x:7400,y:2000,w:2100,h:1150,zoom:1},{x:0,y:0,w:16800,h:5200,zoom:.2},{x:7000,y:3600,w:1400,h:800,zoom:1.6},{x:-500,y:-500,w:900,h:900,zoom:1},{x:15600,y:2100,w:1400,h:900,zoom:1}])for(const time of [0,3.3,9000.5]){
  CG.render(g,p,view,images,time);CG.drawBirds(g,flocks,view,images,time,false);CG.drawBirds(g,flocks,view,images,time,true);
 }
 for(const s of d){CG.drawShadow(g,s);CG.drawProp(g,s,2.2,images,{alpha:.5});const f=CG.frame(s,images);assert.ok(f.W>0&&f.H>0&&f.top<0);}
 assert.ok(calls.drawImage>300&&calls.clip>10);
 calls.drawImage=0;CG.render(g,p,{x:7400,y:2000,w:2100,h:1150,zoom:1},{},1);for(const s of d)CG.drawProp(g,s,1,{});
 assert.equal(calls.drawImage,0,'nothing loaded yet: flat colours, no pictures, nothing thrown');
 CG.render(g,null,{x:0,y:0,w:10,h:10},images,0);
});
