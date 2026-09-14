const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/tides/exploration.js');

function context(extra={}){return {worldKey:'wasteland',hasLasso:true,x:2400,y:23600,petLevel:1,now:1000000,...extra};}
function setup(extra={}){const state=E.create(null,{seed:73521}),c=context(extra);E.advance(state,c);return {state,c};}
function travel(state,c,steps,step=160,onStep){
 let direction=1;
 for(let i=0;i<steps;i++){
  if(c.x+step*direction>49000||c.x+step*direction<1000)direction*=-1;
  c.x+=step*direction;c.now+=1000;E.advance(state,c);if(onStep)onStep(state,i);
 }
}

test('an owned lasso starts a small neutral survey with a catchable level-one animal',()=>{
 const {state,c}=setup();assert.equal(state.wild.length,1);
 assert.ok(E.GROUPS[0].includes(state.wild[0].speciesId));assert.equal(state.wild[0].level,1);
 for(const p of state.wild){
  const distance=Math.hypot(p.x-c.x,p.y-c.y);
  assert.ok(distance>=E.MIN_RADIUS-1&&distance<=E.MAX_RADIUS+1);
  assert.ok(p.expiresAt-p.spawnedAt>=E.MIN_TTL&&p.expiresAt-p.spawnedAt<=E.MAX_TTL);
  assert.equal(p.aggro,undefined);assert.equal(p.damage,undefined);assert.equal(p.enemy,undefined);
 }
 assert.equal(new Set(state.wild.map(p=>p.x+','+p.y)).size,1);
});

test('stationary time, menus, unowned lassos, City and dungeons never generate encounters',()=>{
 const state=E.create(null,{seed:99});let c=context({hasLasso:false});
 for(let i=0;i<30;i++){c.x+=10;c.now+=1000;assert.deepEqual(E.advance(state,c),[]);}
 assert.equal(state.initialized,false);assert.equal(state.counter,0);
 for(const worldKey of ['city','briarhollow','cindervein','frostveil']){
  c.worldKey=worldKey;c.hasLasso=true;assert.deepEqual(E.advance(state,c),[]);
 }
 assert.equal(state.initialized,false);
 c.worldKey='wasteland';E.advance(state,c);const ids=state.wild.map(p=>p.id),draws=state.counter;
 for(let i=0;i<1200;i++){c.now+=1000;E.advance(state,c);}
 assert.equal(state.counter,draws);assert.equal(state.rolls,0);assert.equal(state.wild.length,0,'expired animals are not replaced while standing still');
 for(let i=0;i<30;i++){c.paused=true;c.x+=25;c.now+=1000;E.advance(state,c);}
 delete c.paused;E.advance(state,c);assert.equal(state.counter,draws);assert.equal(state.rolls,0);
 assert.equal(state.wild.length,0);assert.ok(ids.length>0);
});

test('distance uses actual diagonal travel, is independent of tick subdivision, and ignores teleports',()=>{
 const a=setup(),b=setup();
 for(let i=0;i<10;i++){a.c.x+=3;a.c.y+=4;E.advance(a.state,a.c);}
 for(let i=0;i<100;i++){b.c.x+=.3;b.c.y+=.4;E.advance(b.state,b.c);}
 assert.ok(Math.abs(a.state.distance-50)<1e-7);assert.ok(Math.abs(a.state.distance-b.state.distance)<1e-7);
 const before=a.state.distance,counter=a.state.counter;
 a.c.x+=2000;E.advance(a.state,a.c);assert.equal(a.state.distance,before);assert.equal(a.state.counter,counter);
 a.c.x+=10;E.advance(a.state,a.c);assert.equal(a.state.distance,before+10);
 a.c.x+=200;a.c.teleported=true;E.advance(a.state,a.c);assert.equal(a.state.distance,before+10);
});

test('leaving or reloading does not reroll the initial group or charge dungeon travel',()=>{
 const {state,c}=setup();for(const p of [...state.wild])assert.ok(E.take(state,p.id));
 const count=state.counter,nextId=state.nextId;
 for(let i=0;i<30;i++){
  E.advance(state,{...c,worldKey:'briarhollow',x:4000+i*100});
  E.advance(state,c);
  assert.equal(state.counter,count);assert.equal(state.nextId,nextId);assert.equal(state.wild.length,0);
 }
 const reloaded=E.create(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(reloaded,state);E.advance(reloaded,c);assert.equal(reloaded.counter,count);
 c.x+=20;E.advance(reloaded,c);assert.equal(reloaded.distance,20);
});

test('a blocked spawn is rejected with bounded attempts, and a later clear step offers the weak starter',()=>{
 let checks=0;const c=context({isValidPosition:()=>{checks++;return false;}}),state=E.create(null,{seed:4});
 E.advance(state,c);assert.equal(state.wild.length,0);assert.equal(checks,14);
 for(let i=0;i<100;i++)E.advance(state,c);assert.equal(checks,14,'no stationary retry loop');
 assert.equal(state.starterSeen,false);c.isValidPosition=(x,y,r)=>{assert.equal(r,22);return x>c.x;};
 for(let i=0;i<20&&!state.wild.length;i++)travel(state,c,1,160);assert.ok(state.wild.length>0);
 assert.ok(E.GROUPS[0].includes(state.wild[0].speciesId));assert.equal(state.wild[0].level,1);
});

test('geometry enforces map edges, portal clearance and stable exclusion',()=>{
 const world={key:'wasteland',w:50400,h:26000,entrances:[{x:2300,y:23400,r:100}],exit:{x:2500,y:23700,r:95},
  stable:{clearZones:[{x:2100,y:23200,w:300,h:700}]}};
 const {state,c}=setup({world});
 travel(state,c,100,40);
 for(const p of state.wild){
  assert.ok(p.x>=24&&p.x<=50376&&p.y>=24&&p.y<=25976);
  assert.ok(Math.hypot(p.x-world.exit.x,p.y-world.exit.y)>=150);
  assert.ok(Math.hypot(p.x-world.entrances[0].x,p.y-world.entrances[0].y)>=155);
  assert.ok(!(p.x>2076&&p.x<2424&&p.y>23176&&p.y<23924));
 }
 const edge=setup({x:25,y:25});assert.ok(edge.state.wild.length>0);
 assert.ok(edge.state.wild.every(p=>p.x>=24&&p.y>=24));
 assert.deepEqual(E.advance(state,{...c,world:{key:'wasteland',dungeon:'frostveil'}}),[]);
});

test('an hour of walking has a bounded local population and continuously discovers different animals',()=>{
 const {state,c}=setup({x:2000,y:12000}),seen=new Map();let largest=state.wild.length;
 for(let i=0,direction=1;i<14400;i++){
  if(c.x+43.75*direction>49000||c.x+43.75*direction<1000)direction*=-1;
  c.x+=43.75*direction;c.now+=250;E.advance(state,c);largest=Math.max(largest,state.wild.length);
  assert.ok(state.wild.length<=8);assert.ok(state.recent.length<=32);
  for(const p of state.wild){assert.ok(Math.hypot(p.x-c.x,p.y-c.y)<=1500);seen.set(p.id,p.speciesId);}
 }
 assert.ok(seen.size>800&&seen.size<1300,'slower sustained discovery without an unbounded world-wide population: '+seen.size);
 assert.ok(largest>=5);assert.ok(new Set(seen.values()).size>=20);
 assert.ok(JSON.stringify(state).length<6500,'the persisted survey remains small after an hour');
});

test('movement rolls retain every species, different star rates, rare spectrals and varied clamped levels',()=>{
 const {state,c}=setup({x:25000,y:13000,petLevel:12}),counts=new Map(),levels=new Set();let total=0;
 const collect=()=>{for(const p of [...state.wild]){counts.set(p.speciesId,(counts.get(p.speciesId)||0)+1);levels.add(p.level);total++;E.take(state,p.id);}};
 collect();travel(state,c,220000,160,collect);
 const stars=E.GROUPS.map(group=>group.reduce((n,id)=>n+(counts.get(id)||0),0)/total);
 assert.equal(counts.size,25);assert.ok(total>58000&&total<63000);
 assert.ok(stars[0]>.58&&stars[0]<.62);assert.ok(stars[1]>.24&&stars[1]<.28);
 assert.ok(stars[2]>.095&&stars[2]<.125);assert.ok(stars[3]>.022&&stars[3]<.031);
 assert.ok(stars[4]>.0027&&stars[4]<.0045);
 const spectral=((counts.get('spectralpanther')||0)+(counts.get('spectralwyrm')||0))/total;
 assert.ok(spectral>.0002&&spectral<.0007,'spectral spawn share '+spectral);
 assert.equal(Math.min(...levels),1);assert.equal(Math.max(...levels),20);assert.ok(levels.size>=17);
 assert.ok(state.recent.length<=32);
 for(const petLevel of [-500,0,1,20,500,NaN]){
  const f=setup({petLevel});travel(f.state,f.c,100,160);
  assert.ok(f.state.wild.every(p=>p.level>=1&&p.level<=20));
 }
});

test('capturing consumes an encounter exactly once and blocks an immediate respawn at that spot',()=>{
 const {state,c}=setup({random:()=>0});assert.equal(state.wild.length,1,'identical random positions are deduplicated');
 const entry=state.wild[0],taken=E.take(state,entry.id);assert.deepEqual(taken,entry);
 assert.equal(E.take(state,entry.id),null);assert.equal(state.recent.length,1);
 for(let i=0;i<30;i++){c.now+=1000;E.advance(state,c);}assert.equal(state.wild.length,0);
 const restored=E.create(JSON.parse(JSON.stringify(state)));assert.equal(E.take(restored,entry.id),null);
 c.x+=300;E.advance(restored,c);assert.ok(restored.wild.length>0);
 assert.ok(restored.wild.every(p=>p.id!==entry.id&&Math.hypot(p.x-entry.x,p.y-entry.y)>=E.SEPARATION));
});

test('saved random state continues the same survey and malformed saves are bounded and sanitized',()=>{
 const f=setup();travel(f.state,f.c,43,80);
 const copy=E.create(JSON.parse(JSON.stringify(f.state)));assert.deepEqual(copy,f.state);
 for(let i=0;i<200;i++){
  f.c.x+=70;f.c.now+=300;E.advance(f.state,f.c);E.advance(copy,f.c);
  assert.deepEqual(copy,f.state);
 }
 const p=f.state.wild[0];
 const clean=E.create({seed:-1,nextId:0,distance:Infinity,nextDistance:-10,randomState:NaN,
  wild:[{...p,level:500},{...p},{...p,id:'bad',speciesId:'unknown'},{...p,id:'bad2',x:NaN},...Array.from({length:30},(_,i)=>({...p,id:'tide-x-'+(i+100),x:1000+i*100,y:1000}))],
  recent:Array.from({length:100},(_,i)=>({x:i,y:i,until:1000000}))});
 assert.equal(clean.wild.length,8);assert.equal(clean.recent.length,32);assert.equal(clean.wild[0].level,20);
 assert.equal(clean.distance,0);assert.equal(clean.nextDistance,300);assert.ok(clean.nextId>100);
 for(const bad of [null,[],4,'wrong',{}, {wild:'wrong',recent:'wrong'}])assert.equal(E.create(bad,{seed:1}).wild.length,0);
});

test('animals alternate resting and walking near home without rolling stationary encounters',()=>{
 const {state,c}=setup({dt:.1}),p=state.wild[0],start={x:p.x,y:p.y,phase:p.walkphase},encounters={counter:state.counter,randomState:state.randomState,rolls:state.rolls,distance:state.distance};
 let walked=false,rested=false;
 for(let i=0;i<600;i++){
  c.now+=100;E.advance(state,c);
  assert.ok(Math.hypot(p.x-p.homeX,p.y-p.homeY)<=E.ROAM_RADIUS+.001);
  if(p.motion>.8)walked=true;
  if(walked&&p.motion===0)rested=true;
 }
 assert.ok(walked&&rested,'gentle walks have visible idle periods between them');
 assert.ok(Math.hypot(p.x-start.x,p.y-start.y)>1);assert.notEqual(p.walkphase,start.phase);
 assert.equal(state.wild.length,1);
 assert.deepEqual({counter:state.counter,randomState:state.randomState,rolls:state.rolls,distance:state.distance},encounters);
 const copy=E.create(JSON.parse(JSON.stringify(state)));assert.deepEqual(copy,state);
 for(let i=0;i<200;i++){c.now+=100;E.advance(state,c);E.advance(copy,c);assert.deepEqual(copy,state);}
});

test('menus, death and leaving Wasteland freeze walking without banking movement on return',()=>{
 const {state,c}=setup({dt:.1});
 for(let i=0;i<100;i++){c.now+=100;E.advance(state,c);}
 const wild=JSON.stringify(state.wild),distance=state.distance,counter=state.counter;
 for(const extra of [{paused:true},{dead:true},{worldKey:'city'},{worldKey:'briarhollow'}]){
  for(let i=0;i<50;i++){c.x+=2;c.now+=100;E.advance(state,{...c,...extra});}
  assert.equal(JSON.stringify(state.wild),wild);
  assert.equal(state.counter,counter);assert.equal(state.distance,distance);
  E.advance(state,{...c,dt:0});assert.equal(state.distance,distance);
 }
});

test('roaming checks collision along its path, avoids landmarks and maintains animal separation',()=>{
 const {state,c}=setup({dt:.25});let p=state.wild[0];
 const wall=p.x+8;p.roamTime=0;p.roamTargetX=p.x+50;p.roamTargetY=p.y;
 let collisionChecks=0;c.isValidPosition=x=>{collisionChecks++;return x<wall;};
 for(let i=0;i<100;i++){c.now+=250;E.advance(state,c);assert.ok(p.x<wall,'walking never steps through a wall');}
 assert.ok(collisionChecks>10);
 const a={...p,id:'tide-roam-1',x:5000,y:12000,homeX:5000,homeY:12000,roamTargetX:5050,roamTargetY:12000,roamTime:0};
 const b={...p,id:'tide-roam-2',x:5130,y:12000,homeX:5130,homeY:12000,roamTargetX:5080,roamTargetY:12000,roamTime:0};
 state.wild=[a,b];c.x=5000;c.y=12000;delete c.isValidPosition;
 c.world={key:'wasteland',exit:{x:5000,y:12160,r:95}};
 for(let i=0;i<240;i++){
  c.now+=250;E.advance(state,c);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=E.SEPARATION-.001);
  for(const animal of state.wild){
   assert.ok(Math.hypot(animal.x-c.world.exit.x,animal.y-c.world.exit.y)>=150-.001);
   assert.ok(Math.hypot(animal.x-animal.homeX,animal.y-animal.homeY)<=E.ROAM_RADIUS+.001);
  }
 }
});

test('old surveys migrate to the slower pace without an immediate saved-distance burst',()=>{
 const {state,c}=setup();const p=state.wild[0],counter=state.counter;
 const raw={...state,version:1,distance:179,nextDistance:100,
  wild:Array.from({length:14},(_,i)=>({...p,id:'tide-old-'+(i+1),x:2000+i*140,y:c.y,homeX:NaN,homeY:-1000,roamTargetX:1e9,roamTargetY:0,motion:99,roamSeed:-1}))};
 const restored=E.create(raw);assert.equal(restored.wild.length,8);assert.equal(restored.distance,0);assert.equal(restored.nextDistance,300);
 for(const animal of restored.wild){assert.equal(animal.homeX,animal.x);assert.equal(animal.homeY,animal.y);assert.equal(animal.roamTargetX,null);assert.equal(animal.motion,1);}
 E.advance(restored,{...c,x:c.x+20});assert.equal(restored.counter,counter);assert.equal(restored.rolls,0);assert.equal(restored.distance,20);
});
