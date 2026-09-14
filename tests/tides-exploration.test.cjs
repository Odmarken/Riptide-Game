const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../assets/tides/exploration.js');
function context(extra={}){const c={worldKey:'wasteland',hasLasso:true,x:25000,y:13000,petLevel:12,now:6000000,...extra};if(!c.view)c.view={x:c.x-504,y:c.y-430,w:1008,h:860};return c;}
function setup(extra={},seed=73521){const state=E.create(null,{seed}),c=context(extra);E.advance(state,c);return {state,c};}
function at(c,x,y){return {...c,x,y,view:{x:x-504,y:y-430,w:1008,h:860}};}
function identity(wild){return wild.map(p=>[p.id,p.speciesId,p.level,p.homeX,p.homeY,p.expiresAt]).sort((a,b)=>a[0].localeCompare(b[0]));}

test('random encounters belong to world coordinates regardless of approach, mount speed or visit order',()=>{
 const a=setup(),b=setup();
 for(let x=20000;x<26000;x+=23)E.advance(a.state,at(a.c,x,12500));
 for(let y=18000;y>12000;y-=151)E.advance(b.state,at(b.c,26000,y));
 E.advance(a.state,a.c);E.advance(b.state,b.c);
 assert.deepEqual(identity(a.state.wild),identity(b.state.wild));
 const original=identity(a.state.wild);E.advance(a.state,at(a.c,40000,5000));E.advance(a.state,a.c);
 assert.deepEqual(identity(a.state.wild),original,'unloading and revisiting cannot reroll cells');
 assert.ok(a.state.wild.length>0);
 assert.ok(a.state.wild.every(p=>p.cellX===Math.floor(p.homeX/E.CELL_SIZE)&&p.cellY===Math.floor(p.homeY/E.CELL_SIZE)));
});

test('world distribution is sparse, surrounds the player and loads immediately without distance rolls',()=>{
 let visible=0;const quadrants=new Set();
 for(let seed=1;seed<=200;seed++){
  const {state,c}=setup({},seed);assert.ok(state.wild.length<=E.MAX_WILD);
  for(const p of state.wild){
   if(p.x>=c.view.x&&p.x<=c.view.x+c.view.w&&p.y>=c.view.y&&p.y<=c.view.y+c.view.h)visible++;
   quadrants.add((p.x<c.x?'W':'E')+(p.y<c.y?'N':'S'));
   assert.equal(p.aggro,undefined);assert.equal(p.damage,undefined);
  }
 }
 assert.equal(quadrants.size,4);assert.ok(visible/200>1.1&&visible/200<2.4,'sparse animals in a normal viewport: '+visible/200);
 const {state,c}=setup(),before=identity(state.wild),counter=state.counter;
 for(let i=0;i<100;i++)E.advance(state,c);
 assert.deepEqual(identity(state.wild),before);assert.equal(state.counter,counter,'standing still does not continually create new encounters');
});

test('world samples retain every species and tier rarity with uniform species odds within each tier',()=>{
 const counts=new Map(),levels=new Set();let total=0;
 for(let seed=1;seed<=18;seed++){
  const state=E.create(null,{seed}),seen=new Set();
  for(let yy=1024;yy<E.HEIGHT+1024;yy+=2048)for(let xx=1024;xx<E.WIDTH+1024;xx+=2048){
   const x=Math.min(E.WIDTH-128,xx),y=Math.min(E.HEIGHT-128,yy),c=context({x,y,view:{x:x-1024,y:y-1024,w:2048,h:2048}});
   E.advance(state,c);
   for(const p of state.wild)if(!seen.has(p.id)){seen.add(p.id);counts.set(p.speciesId,(counts.get(p.speciesId)||0)+1);levels.add(p.level);total++;}
  }
 }
 const fractions=E.GROUPS.map(g=>g.reduce((n,id)=>n+(counts.get(id)||0),0)/total);
 assert.equal(counts.size,25);assert.ok(total>40000&&total<47000,'48% of world cells occupied: '+total);
 assert.ok(fractions[0]>.58&&fractions[0]<.62);assert.ok(fractions[1]>.24&&fractions[1]<.28);
 assert.ok(fractions[2]>.095&&fractions[2]<.125);assert.ok(fractions[3]>.022&&fractions[3]<.031);assert.ok(fractions[4]>.0025&&fractions[4]<.0045);
 const spectral=((counts.get('spectralpanther')||0)+(counts.get('spectralwyrm')||0))/total;assert.ok(spectral>.00015&&spectral<.0008,'spectral proportion '+spectral);
 for(const group of E.GROUPS.slice(0,4)){const values=group.map(id=>counts.get(id));assert.ok(Math.max(...values)/Math.min(...values)<1.3,'equal species weights within tier');}
 assert.equal(Math.min(...levels),1);assert.equal(Math.max(...levels),20);
});

test('a whole-world viewport and extended exploration keep local objects and saved state bounded',()=>{
 const {state,c}=setup({view:{x:0,y:0,w:E.WIDTH,h:E.HEIGHT}});assert.ok(state.wild.length<=64&&state.wild.length>=32);
 for(const p of state.wild)assert.ok(Math.abs(p.homeX-c.x)<=E.MAX_LOAD_RADIUS+E.CELL_SIZE&&Math.abs(p.homeY-c.y)<=E.MAX_LOAD_RADIUS+E.CELL_SIZE);
 for(let i=0;i<1000;i++){
  const x=300+(i*1277)%(E.WIDTH-600),y=300+(i*947)%(E.HEIGHT-600);
  E.advance(state,at(c,x,y));assert.ok(state.wild.length<=64);assert.ok(state.levels.length<=2);
 }
 assert.ok(JSON.stringify(state).length<35000,'walking does not retain the whole world');
});

test('capturing consumes one encounter and survives reload, travel and changes of equipped level',()=>{
 const {state,c}=setup(),p=state.wild[0],original=identity(state.wild),id=p.id;
 assert.equal(E.take(state,id,c.now),p);assert.equal(E.take(state,id,c.now),null);assert.equal(state.taken.length,1);
 let restored=E.create(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored,state);
 for(let i=0;i<10;i++){
  E.advance(restored,{...at(c,40000,5000),petLevel:20});E.advance(restored,{...c,petLevel:20});
  assert.ok(!restored.wild.some(p=>p.id===id));assert.deepEqual(identity(restored.wild),original.filter(p=>p[0]!==id));
  restored=E.create(JSON.parse(JSON.stringify(restored)));
 }
 assert.equal(restored.taken[0].until,p.expiresAt);
 E.advance(restored,{...c,now:p.expiresAt+1});assert.ok(!restored.wild.some(p=>p.id===id));assert.ok(!restored.taken.some(t=>t.cellX===p.cellX&&t.cellY===p.cellY));
});

test('staggered real-time cycles refresh cells without movement and cannot be rolled backward',()=>{
 const {state,c}=setup(),old=state.wild.map(p=>({...p})),first=Math.min(...old.map(p=>p.expiresAt));
 assert.ok(new Set(old.map(p=>p.expiresAt)).size>3,'cells do not all reset together');
 E.advance(state,{...c,now:first-1});assert.deepEqual(identity(state.wild),identity(old));
 E.advance(state,{...c,now:first+1});assert.ok(!state.wild.some(p=>p.id===old.find(p=>p.expiresAt===first).id));
 const refreshed=identity(state.wild);E.advance(state,c);assert.deepEqual(identity(state.wild),refreshed,'clock rollback cannot recover the previous cycle');
 E.advance(state,{...c,now:c.now+E.REFRESH_MS+1});assert.ok(state.wild.every(p=>!old.some(q=>q.id===p.id)));
});

test('unowned lassos, other zones, death and modal pauses never load or advance animals',()=>{
 const state=E.create(null,{seed:8}),c=context();
 for(const extra of [{hasLasso:false},{worldKey:'city'},{worldKey:'cindervein'},{world:{key:'wasteland',dungeon:'frostveil'}},{paused:true},{dead:true}]){
  assert.deepEqual(E.advance(state,{...c,...extra}),[]);assert.equal(state.counter,0);
 }
 E.advance(state,c);const original=JSON.stringify(state);
 for(const extra of [{paused:true},{dead:true},{worldKey:'city'}]){
  E.advance(state,{...at(c,40000,5000),now:c.now+900000,dt:.1,...extra});assert.equal(JSON.stringify(state),original);
 }
});

test('placement is collision safe, respects landmarks, and retrying positions cannot change a cell species',()=>{
 const clear=setup(),blocked=setup({isValidPosition:(x,y,r)=>{assert.equal(r,22);return x%512>256;}});
 for(const p of blocked.state.wild){assert.ok(p.x%512>256);const original=clear.state.wild.find(q=>q.id===p.id);assert.ok(original);assert.equal(p.speciesId,original.speciesId);assert.equal(p.level,original.level);}
 const world={w:E.WIDTH,h:E.HEIGHT,exit:{x:25000,y:13000,r:100},entrances:[{x:25200,y:12700,r:150}],stable:{clearZones:[{x:24400,y:12600,w:400,h:700}]}};
 const {state}=setup({world});for(const p of state.wild){
  assert.ok(Math.hypot(p.x-world.exit.x,p.y-world.exit.y)>=155);assert.ok(Math.hypot(p.x-world.entrances[0].x,p.y-world.entrances[0].y)>=205);
  assert.ok(!(p.x>24376&&p.x<24824&&p.y>12576&&p.y<13324));
 }
 let checks=0;const none=setup({isValidPosition:()=>{checks++;return false;}});assert.equal(none.state.wild.length,0);assert.ok(checks<=E.MAX_CELLS*12);
 for(const point of [[30,30],[E.WIDTH-30,E.HEIGHT-30]])for(const p of setup({x:point[0],y:point[1]}).state.wild)assert.ok(p.x>=24&&p.y>=24&&p.x<=E.WIDTH-24&&p.y<=E.HEIGHT-24);
});

test('roaming remains connected to each cell home with idle periods, collision checks and stable encounter identity',()=>{
 const {state,c}=setup({dt:.1}),original=identity(state.wild),counter=state.counter,p=state.wild[0],phase=p.walkphase;let walked=false,rested=false;
 for(let i=0;i<400;i++){
  E.advance(state,c);for(const a of state.wild)assert.ok(Math.hypot(a.x-a.homeX,a.y-a.homeY)<=E.ROAM_RADIUS+.001);
  if(p.motion>.8)walked=true;if(walked&&p.motion===0)rested=true;
 }
 assert.ok(walked&&rested);assert.notEqual(p.walkphase,phase);assert.equal(state.counter,counter);assert.deepEqual(identity(state.wild),original);
 const copy=E.create(JSON.parse(JSON.stringify(state)));assert.deepEqual(copy,state);
 for(let i=0;i<80;i++){E.advance(state,c);E.advance(copy,c);assert.deepEqual(copy,state);}
 const before=JSON.stringify(state.wild);E.advance(state,{...c,paused:true,dt:.25});assert.equal(JSON.stringify(state.wild),before);
 const positions=state.wild.map(p=>[p.x,p.y]);for(let i=0;i<20;i++)E.advance(state,{...c,isValidPosition:()=>false});
 assert.deepEqual(state.wild.map(p=>[p.x,p.y]),positions,'a blocked walking step does not tunnel through a collider');
});

test('old survey migration changes only transient exploration and malformed saves remain bounded',()=>{
 const old={version:2,seed:12345,counter:123,lastNow:6000000,wild:[{id:'old',speciesId:'meadowmouse',level:1,x:500,y:500}],distance:150,nextDistance:220};
 const migrated=E.create(old);assert.equal(migrated.version,3);assert.equal(migrated.seed,12345);assert.equal(migrated.wild.length,0);
 E.advance(migrated,context());assert.ok(migrated.wild.length>0,'existing players immediately discover their local cells');
 const {state}=setup({view:{x:0,y:0,w:E.WIDTH,h:E.HEIGHT}}),first=state.wild[0];
 const raw={...state,wild:[{...first,level:500,homeX:NaN,homeY:-1000,motion:99,roamTargetX:1e9,roamTargetY:0},...state.wild,...state.wild],
  taken:[{cellX:-1,cellY:0,epoch:10},{cellX:2,cellY:3,epoch:10},{cellX:2,cellY:3,epoch:10}],levels:[{epoch:10,level:999},{epoch:10,level:2}]};
 const clean=E.create(raw);assert.ok(clean.wild.length<=64);assert.equal(clean.wild[0].level,20);assert.equal(clean.wild[0].homeX,first.x);assert.equal(clean.wild[0].motion,1);assert.equal(clean.wild[0].roamTargetX,null);
 assert.equal(clean.taken.length,1);assert.equal(clean.levels.length,1);assert.equal(clean.levels[0].level,20);
 for(const value of [null,[],4,'wrong',{}, {wild:'wrong',taken:'wrong'}])assert.equal(E.create(value,{seed:1}).wild.length,0);
});

test('scripted encounters remain challengeable and consumed exactly once without cell tombstones',()=>{
 const {state,c}=setup(),p={id:'scripted',speciesId:'spectralwyrm',level:20,x:c.x,y:c.y,expiresAt:c.now+10000};state.wild.push(p);
 E.advance(state,c);assert.ok(state.wild.includes(p));assert.equal(E.take(state,p.id,c.now),p);assert.equal(E.take(state,p.id,c.now),null);assert.equal(state.taken.length,0);
});
