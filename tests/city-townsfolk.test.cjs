/* The City's townsfolk and watch, built headless from the production city builder: at least forty
 * villagers, every one walking the streets rather than through the terraces, and five guards in two
 * patrols marching closed rounds of the main streets. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function city(seed=13){
 const context=vm.createContext({world:{w:16800,h:5200,solids:[]},npcSebbeImg:{}});
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','const cityPat=')+source.match(/^function mulberry32\(.*$/m)[0]+`;buildCity(mulberry32(${seed}));globalThis.folk=CITY_FOLK;globalThis.watch=CITY_WATCH;globalThis.spacing=WATCH_SPACING;`,context);
 return {world:JSON.parse(JSON.stringify(context.world)),folk:context.folk,watch:context.watch,spacing:context.spacing};
}
/* run the production walker for a while without the renderer - the same loop game.js uses each frame */
function stepper(){
 const context=vm.createContext({world:null,Math});
 vm.runInContext(section('function updateNpcs(dt){','function drawEnemy(en){'),context);
 return (world,dt)=>{context.world=world;vm.runInContext('updateNpcs('+dt+')',context);};
}
const roadRect=s=>({x:Math.min(s.x0,s.x1)-s.w/2,y:Math.min(s.y0,s.y1)-s.w/2,w:Math.abs(s.x1-s.x0)+s.w,h:Math.abs(s.y1-s.y0)+s.w});
/* a walker's body is about 32 wide; a point is on the road when that body fits between the kerbs */
const onRoad=(w,p,margin=16)=>w.streets.some(s=>{const r=roadRect(s);return p.x>=r.x+margin&&p.x<=r.x+r.w-margin&&p.y>=r.y+margin&&p.y<=r.y+r.h-margin;});
const townsfolk=w=>w.npcs.filter(n=>!n.patrol&&!n.game);
const guards=w=>w.npcs.filter(n=>n.patrol);
const along=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

test('at least forty townsfolk walk the City, in the old faces and the new',()=>{
 for(const seed of [1,13,42]){
  const {world:w,folk}=city(seed),folks=townsfolk(w);
  assert.ok(folks.length>=40,`seed ${seed}: ${folks.length} townsfolk`);
  assert.equal(folks.length,folk.length,'every name on the roster found a route');
  assert.equal(new Set(folks.map(n=>n.name)).size,folks.length,'no name twice');
  const skins=new Set(folks.map(n=>n.skin));
  for(const k of ['male','female','noble_velvet','noble_elder','noble_dandy','noble_lady','noble_dowager','noble_maiden','merchant','monk','blacksmith','baker','market_woman'])
   assert.ok(skins.has(k),`skin ${k} is worn`);
  assert.ok(folks.filter(n=>/^noble_/.test(n.skin)).length>=12,'a dozen nobles');
  assert.ok(w.npcs.some(n=>n.game==='cups'&&n.name==='Sebbe'),'Sebbe still runs his cups');
  for(const n of folks){
   assert.equal(typeof n.skin,'string');
   assert.equal(typeof n.female,'boolean');
   assert.ok(n.pts.length>=6&&n.pts.length<=9,`${n.name} strolls 5-8 stretches`);
   assert.ok(n.speed>=22&&n.speed<=66,`${n.name} speed ${n.speed}`);
  }
  /* the gowns are worn by women, the busts by men, hero costumes by their own gender */
  for(const n of folks){
   const gown=['female','baker','market_woman','noble_lady','noble_dowager','noble_maiden'].includes(n.skin)||/female_/.test(n.skin);
   assert.equal(n.female,gown,`${n.name} (${n.skin})`);
  }
 }
});

test('every stroll follows the streets, one lane wide, and keeps out of the nave, the gate and the well',()=>{
 for(const seed of [1,13,42,8675309]){
  const {world:w}=city(seed);
  const cath=w.solids.find(s=>s.type==='cathedral'),well=w.solids.find(s=>s.type==='well'),portal=w.solids.find(s=>s.type==='altarportal');
  const halls=w.solids.filter(s=>['minehall','enchanthall','smelter'].includes(s.type));
  const inCathedral=p=>{const kx=(p.x-cath.x)/(cath.crx+16),ky=(p.y-cath.y-cath.cyo)/(cath.cry+16);return kx*kx+ky*ky<1;};
  for(const n of townsfolk(w)){
   for(let i=0;i<n.pts.length;i++){
    assert.ok(onRoad(w,n.pts[i]),`${n.name} waypoint ${i} at ${n.pts[i].x},${n.pts[i].y} is off the road`);
    /* the stretch between two waypoints is axis-aligned and on the road along its whole length */
    if(i){
     const a=n.pts[i-1],b=n.pts[i];
     assert.ok(Math.abs(a.x-b.x)<1||Math.abs(a.y-b.y)<1,`${n.name} stretch ${i} is diagonal`);
     for(let t=0;t<=1;t+=1/16){
      const p=along(a,b,t);
      assert.ok(onRoad(w,p),`${n.name} leaves the road between waypoints ${i-1} and ${i}`);
      assert.ok(!inCathedral(p),`${n.name} walks through the cathedral`);
      assert.ok(Math.hypot(p.x-well.x,p.y-well.y)>=well.r,`${n.name} walks through the well`);
      assert.ok(Math.hypot(p.x-portal.x,p.y-portal.y)>=portal.r+40,`${n.name} idles in the gate portal`);
      for(const h of halls){
       const kx=(p.x-h.x-(h.cxo||0))/h.crx,ky=(p.y-h.y-h.cyo)/h.cry;
       assert.ok(kx*kx+ky*ky>=1,`${n.name} walks through the ${h.type}`);
      }
     }
    }
   }
   assert.deepEqual([n.x,n.y],[n.pts[0].x,n.pts[0].y],'starts on the first waypoint');
  }
 }
});

test('nobles keep to the central district for the whole stroll; the rest of the town does not',()=>{
 /* the district is the two blocks either side of the cathedral square: avenues 5500..11300, streets
    1180..4020. A lane can sit up to 118 off the kerb line on the boulevard, hence the margin. */
 const inDistrict=p=>p.x>=5500-120&&p.x<=11300+120&&p.y>=1180-120&&p.y<=4020+120;
 let commoners=0;
 for(const seed of [1,13,42,8675309,205907]){
  const {world:w}=city(seed),folks=townsfolk(w);
  for(const n of folks.filter(n=>/^noble_/.test(n.skin)))
   n.pts.forEach((p,i)=>assert.ok(inDistrict(p),`${n.name} waypoint ${i} at ${p.x},${p.y} is outside the district`));
  commoners+=folks.filter(n=>!/^noble_/.test(n.skin)&&n.pts.some(p=>!inDistrict(p))).length;
 }
 assert.ok(commoners>=20,`only ${commoners} commoners ever leave the district over five seeds`);
});

test('the watch is five guards in two patrols on closed rounds of the main streets',()=>{
 const {world:w,watch,spacing}=city();
 const g=guards(w);
 assert.equal(g.length,5);
 assert.deepEqual(g.map(n=>n.watch),['east','east','east','west','west']);
 assert.ok(g.every(n=>n.skin==='guard'&&n.patrol&&n.pauseT===0&&!n.female&&n.big>1));
 assert.equal(new Set(g.map(n=>n.name)).size,5,'each guard has a name');
 for(const grp of watch){
  const file=g.filter(n=>n.watch===grp.id);
  assert.equal(file.length,grp.names.length);
  const pts=file[0].pts;
  assert.equal(pts.length,4,'a rectangle of the grid');
  for(const n of file)assert.deepEqual(n.pts,pts,'the file shares one round');
  /* every leg of the loop, and the closing leg, runs down a main street - never an alley */
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length];
   const wide=w.streets.filter(s=>s.w>=180);
   let covered=false;
   for(const s of wide){const r=roadRect(s);
    if([0,.25,.5,.75,1].every(t=>{const p=along(a,b,t);return p.x>=r.x+16&&p.x<=r.x+r.w-16&&p.y>=r.y+16&&p.y<=r.y+r.h-16;}))covered=true;}
   assert.ok(covered,`${grp.id} leg ${i} is not on a main street`);
  }
  /* single file: guard j starts j*spacing behind the leader along the closing leg */
  const last=pts[pts.length-1];
  file.forEach((n,j)=>{
   const d=Math.hypot(n.x-pts[0].x,n.y-pts[0].y);
   assert.ok(Math.abs(d-j*spacing)<1e-6,`${n.name} is ${d} behind the leader`);
   const t=1-d/Math.hypot(pts[0].x-last.x,pts[0].y-last.y),p=along(last,pts[0],t);
   assert.ok(Math.hypot(p.x-n.x,p.y-n.y)<1e-6,`${n.name} starts on the closing leg`);
  });
 }
 /* the well in the square and the halls are never on a patrol's line */
 const well=w.solids.find(s=>s.type==='well');
 for(const n of g)for(let i=0;i<n.pts.length;i++)for(let t=0;t<=1;t+=1/32){
  const p=along(n.pts[i],n.pts[(i+1)%n.pts.length],t);
  assert.ok(Math.hypot(p.x-well.x,p.y-well.y)>=well.r+10,`${n.name} marches through the well`);
  for(const h of w.solids.filter(s=>['minehall','enchanthall','smelter'].includes(s.type)))
   assert.ok(p.y>h.y+h.r*.30-1||p.y<h.y-h.r*9||Math.abs(p.x-h.x)>h.crx+40,`${n.name} marches through the ${h.type}`); /* below its doorstep, above its roof, or beside it */
 }
});

test('a patrol marches its round without halting and keeps its file; townsfolk pause and turn back',()=>{
 const {world:w}=city(),step=stepper();
 const g=guards(w),east=g.filter(n=>n.watch==='east'),lead=east[0],folks=townsfolk(w);
 let ticks=0,everStill=0,idleTicks=0,indices=new Set();
 for(let t=0;t<420;t+=1/60){                       /* seven minutes: more than one full round */
  step(w,1/60);ticks++;
  if(ticks>2&&!lead.moving)everStill++;
  if(folks.some(n=>!n.moving))idleTicks++;
  indices.add(lead.i);
  for(const n of g){
   assert.ok(onRoad(w,{x:n.x,y:n.y},0),`${n.name} left the road at ${n.x},${n.y}`);
   assert.ok(n.i>=0&&n.i<n.pts.length,'index wraps inside the loop');
  }
  /* the file holds: each guard stays about one spacing behind the one ahead, measured along the round */
  for(let j=1;j<east.length;j++){
   const a=east[j-1],b=east[j];
   const gap=Math.hypot(a.x-b.x,a.y-b.y);
   assert.ok(gap>18&&gap<70,`gap ${gap.toFixed(1)} between ${a.name} and ${b.name} at t=${t.toFixed(1)}`);
  }
 }
 assert.equal(everStill,0,'the leader never halted');
 assert.deepEqual([...indices].sort(),[0,1,2,3],'the leader visited every corner');
 /* a lap: back near the start after the loop length at marching speed */
 const perimeter=(11300-5500)*2+(4020-2600)*2,lap=perimeter/lead.speed;
 assert.ok(lap<420,'seven minutes covers a lap');
 /* townsfolk: somebody has paused, and everyone turned around instead of running off the end */
 /* a corner pause is 0.6-3.2 s of Math.random, so the whole run is asked, not the final tick alone -
    all 48 happen to be walking at one instant a few percent of the time */
 assert.ok(idleTicks>ticks/10,`villagers idled on only ${idleTicks} of ${ticks} ticks`);
 for(const n of folks){
  assert.ok(n.i>=0&&n.i<n.pts.length,`${n.name} index ${n.i}`);
  assert.ok(onRoad(w,{x:n.x,y:n.y},0),`${n.name} strayed off the road to ${n.x},${n.y}`);
 }
 assert.ok(folks.some(n=>n.dir===-1),'somebody has turned back along their route');
});

test('the roster is deterministic per seed and untouched by re-entering the City',()=>{
 assert.equal(JSON.stringify(city(13).world.npcs),JSON.stringify(city(13).world.npcs));
 assert.notEqual(JSON.stringify(city(13).world.npcs.map(n=>n.pts)),JSON.stringify(city(14).world.npcs.map(n=>n.pts)),'another seed strolls differently');
 const {world:w}=city();
 assert.deepEqual(w.npcs.filter(n=>n.patrol).map(n=>n.pts[0]),[{x:5552,y:2652},{x:5552,y:2652},{x:5552,y:2652},{x:2652,y:1232},{x:2652,y:1232}],'the rounds do not move with the seed');
});
