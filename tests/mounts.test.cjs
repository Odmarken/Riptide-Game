const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../assets/mounts/mounts.js');
const outdoor={wasteland:true};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' vs '+b);
function setup(id='horse'){
 const state={mounts:M.normalize({owned:[id],equipped:id})};
 const ride=M.createRide(),hero={x:100,y:200,dead:false},context={hero,zone:outdoor};
 return {state,ride,hero,context};
}
function mounted(id='horse'){
 const f=setup(id);assert.equal(M.toggle(f.ride,f.state,f.context).action,'casting');
 M.tick(f.ride,f.state,f.context,1);assert.equal(f.ride.id,id);return f;
}

test('buying charges the listed price once, preserves the selected mount, and duplicates cannot debit gold',()=>{
 const state={},spending=[];let gold=1000000;
 const spend=amount=>{spending.push(amount);if(gold<amount)return false;gold-=amount;return true;};
 for(const item of M.catalog){
  const before=gold;assert.equal(M.buy(state,item.id,spend).ok,true);
  assert.equal(before-gold,item.price);assert.ok(state.mounts.owned.includes(item.id));
  const paid=spending.length,saved=JSON.stringify(state);
  assert.deepEqual(M.buy(state,item.id,spend),{ok:false,reason:'bought'});
  assert.equal(spending.length,paid);assert.equal(JSON.stringify(state),saved);
 }
 assert.equal(state.mounts.equipped,M.catalog[0].id,'later purchases do not silently replace the equipped horse');
 assert.deepEqual(spending,M.catalog.map(m=>m.price));
});

test('unknown, unaffordable and unowned choices leave money and ownership unchanged',()=>{
 const state={mounts:{owned:['horse'],equipped:'horse'}},before=JSON.stringify(state);let calls=0;
 const fail=()=>{calls++;return false;};
 assert.deepEqual(M.buy(state,'unknown',fail),{ok:false,reason:'unknown'});assert.equal(calls,0);
 assert.deepEqual(M.buy(state,'leopard',fail),{ok:false,reason:'gold'});assert.equal(calls,1);
 assert.deepEqual(M.buy(state,'leopard'),{ok:false,reason:'gold'});
 assert.equal(M.equip(state,'unknown'),false);assert.equal(M.equip(state,'leopard'),false);
 assert.equal(JSON.stringify(state),before);
 assert.equal(M.selected({mounts:{owned:['horse'],equipped:'leopard'}}),null);
 assert.equal(M.selected({}),null);assert.equal(M.selected(null),null);
});

test('old saves normalize safely and ownership survives JSON reload without inheriting a temporary ride',()=>{
 for(const value of [null,undefined,{},[],{owned:'horse'},{owned:['unknown'],equipped:'unknown'}])
  assert.deepEqual(M.normalize(value),{owned:[],equipped:null});
 const raw={owned:['leopard','horse','horse','unknown'],equipped:'leopard',extra:123},before=JSON.stringify(raw);
 const state={mounts:M.normalize(raw)};assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(state.mounts,{owned:['horse','leopard'],equipped:'leopard'});
 assert.equal(M.equip(state,'horse'),true);
 const restored={mounts:M.normalize(JSON.parse(JSON.stringify(state)).mounts)};
 assert.deepEqual(restored,state);assert.equal(M.selected(restored).id,'horse');
 assert.deepEqual(M.normalize({owned:['leopard'],equipped:'spectral-tiger'}),{owned:['leopard'],equipped:'leopard'});
 const newCharacter={mounts:M.normalize(null)};
 assert.equal(M.selected(newCharacter),null,'one character cannot inherit another character\'s purchase');
 const ride=M.createRide();assert.equal(ride.id,null);assert.equal(ride.casting,null);
 assert.equal(M.multiplier(ride,restored,outdoor),1,'saved equipment alone never grants riding speed');
});

test('saddling takes one second at multiple refresh rates and with uneven frame times',()=>{
 for(const fps of [20,30,60,120,144,240]){
  const f=setup();assert.equal(M.toggle(f.ride,f.state,f.context).action,'casting');
  for(let n=0;n<fps-1;n++)M.tick(f.ride,f.state,f.context,1/fps);
  assert.equal(f.ride.id,null,'not complete early at '+fps+' FPS');assert.equal(M.multiplier(f.ride,f.state,outdoor),1);
  M.tick(f.ride,f.state,f.context,1/fps);
  assert.equal(f.ride.id,'horse');assert.equal(f.ride.casting,null);assert.equal(f.ride.remaining,0);
 }
 for(const steps of [[.03,.17,.11,.19,.25,.25],[.999,.001]]){
  const f=setup('leopard');M.toggle(f.ride,f.state,f.context);
  for(const dt of steps.slice(0,-1)){M.tick(f.ride,f.state,f.context,dt);assert.equal(f.ride.id,null);}
  M.tick(f.ride,f.state,f.context,steps.at(-1));assert.equal(f.ride.id,'leopard');
 }
});

test('pause freezes saddling, invalid deltas do not advance it, and toggling cancels or dismounts',()=>{
 const f=setup();M.toggle(f.ride,f.state,f.context);M.tick(f.ride,f.state,f.context,.4);
 const before=JSON.stringify(f.ride);
 M.tick(f.ride,f.state,{...f.context,paused:true},20);assert.equal(JSON.stringify(f.ride),before);
 for(const dt of [0,-1,NaN,Infinity])M.tick(f.ride,f.state,f.context,dt);
 assert.equal(JSON.stringify(f.ride),before);
 assert.deepEqual(M.toggle(f.ride,f.state,{...f.context,paused:true}),{ok:false,reason:'busy'});
 assert.equal(JSON.stringify(f.ride),before);
 assert.equal(M.toggle(f.ride,f.state,f.context).action,'down');
 assert.deepEqual(f.ride,M.createRide());
 M.toggle(f.ride,f.state,f.context);M.tick(f.ride,f.state,f.context,1);
 assert.equal(M.toggle(f.ride,f.state,f.context).action,'down');assert.deepEqual(f.ride,M.createRide());
 for(const stop of [{paused:true},{busy:true}]){
  assert.equal(M.toggle(f.ride,f.state,{...f.context,...stop}).ok,false);assert.equal(f.ride.casting,null);
 }
 f.hero.dead=true;assert.equal(M.toggle(f.ride,f.state,f.context).ok,false);
});

test('saddling cancels after movement, including several subpixel steps during a high-rate update',()=>{
 for(const steps of [[1.5],[.75,.75],Array(20).fill(.1)]){
  const f=setup();M.toggle(f.ride,f.state,f.context);
  for(const dx of steps){f.hero.x+=dx;M.tick(f.ride,f.state,f.context,.01);}
  assert.equal(f.ride.id,null);assert.equal(f.ride.casting,null,'total movement above one pixel interrupts the cast');
  assert.equal(f.ride.remaining,0);
 }
 const still=setup();M.toggle(still.ride,still.state,still.context);
 still.hero.x+=.25;M.tick(still.ride,still.state,still.context,.5);M.tick(still.ride,still.state,still.context,.5);
 assert.equal(still.ride.id,'horse','small numerical position jitter does not cancel a stationary cast');
});

test('City, dungeons, death, missing ownership and equipment changes immediately remove riding speed',()=>{
 const banned=[{},null,{city:true},{tavern:true},{raid:true},{dungeon:'briarhollow'},{wasteland:true,dungeon:'cindervein'}];
 for(const zone of banned){
  assert.equal(M.allowed(zone),false);
  const f=mounted();assert.equal(M.multiplier(f.ride,f.state,zone),1);
  M.tick(f.ride,f.state,{...f.context,zone,paused:true},.1);
  assert.deepEqual(f.ride,M.createRide(),'zone exit resets even while the game is paused');
  assert.equal(M.toggle(f.ride,f.state,{...f.context,zone}).reason,'zone');
 }
 const dead=mounted();dead.hero.dead=true;M.tick(dead.ride,dead.state,dead.context,.01);
 assert.deepEqual(dead.ride,M.createRide());assert.equal(M.multiplier(dead.ride,dead.state,outdoor),1);
 const lost=mounted();lost.state.mounts.owned=[];M.tick(lost.ride,lost.state,lost.context,.01);assert.deepEqual(lost.ride,M.createRide());
 const swapped=mounted();swapped.state.mounts.owned.push('leopard');M.equip(swapped.state,'leopard');
 assert.equal(M.multiplier(swapped.ride,swapped.state,outdoor),1);
 M.tick(swapped.ride,swapped.state,swapped.context,.01);assert.deepEqual(swapped.ride,M.createRide());
 const empty=setup();empty.state.mounts=M.normalize(null);assert.equal(M.toggle(empty.ride,empty.state,empty.context).reason,'empty');
});

test('the actual speedOf hook boosts only the mounted hero and preserves pet and enemy speed rules',()=>{
 const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const start=game.indexOf('function speedOf('),end=game.indexOf('function moveToward(',start);
 assert.ok(start>=0&&end>start);
 for(const item of M.catalog){
  const f=setup(item.id),pet={},mob={speed:90},slowMob={speed:90,slowT:2};
  const env={hero:f.hero,pet,S:f.state,mountRide:f.ride,Mounts:M,zoneOf:()=>outdoor,swiftMul:()=>1.2,speedBoostMul:()=>1.1};
  const speed=vm.runInNewContext(game.slice(start,end)+';speedOf',env),base=175*1.2*1.1;
  close(speed(f.hero),base);M.toggle(f.ride,f.state,f.context);close(speed(f.hero),base);
  M.tick(f.ride,f.state,f.context,1);close(speed(f.hero),base*item.speed);
  close(speed(pet),base*1.15);assert.equal(speed(mob),90);close(speed(slowMob),40.5);
  M.reset(f.ride);close(speed(f.hero),base);
 }
});

test('walking phase depends on distance, idle feet settle, and a teleport never creates a huge stride',()=>{
 const a=mounted(),b=mounted();
 for(let n=0;n<10;n++){a.hero.x+=2;M.tick(a.ride,a.state,a.context,.1);}
 for(let n=0;n<100;n++){b.hero.x+=.2;M.tick(b.ride,b.state,b.context,.01);}
 close(a.ride.phase,b.ride.phase);assert.equal(a.ride.moving,1);assert.equal(b.ride.moving,1);
 const phase=a.ride.phase;M.tick(a.ride,a.state,a.context,.2);
 assert.equal(a.ride.phase,phase);assert.equal(a.ride.moving,0);
 a.hero.x+=2000;M.tick(a.ride,a.state,a.context,.1);
 assert.equal(a.ride.phase,phase);assert.equal(a.ride.moving,0);
 a.hero.x+=2;M.tick(a.ride,a.state,a.context,.1);close(a.ride.phase,(phase+.084)%(Math.PI*2));
 assert.equal(a.ride.moving,1,'the first genuine step after teleport resumes from the new location');
 const paused=JSON.stringify(a.ride);M.tick(a.ride,a.state,{...a.context,paused:true},100);
 assert.equal(JSON.stringify(a.ride),paused);
});

test('all mounts keep the same stride at different frame rates and breathe while resting without moving feet',()=>{
 for(const id of ['horse','leopard','spectral-tiger']){
  const a=mounted(id),b=mounted(id);
  for(let n=0;n<30;n++){a.hero.x+=3;M.tick(a.ride,a.state,a.context,1/30);}
  for(let n=0;n<120;n++){b.hero.x+=.75;M.tick(b.ride,b.state,b.context,1/120);}
  close(a.ride.phase,b.ride.phase);close(a.ride.time,b.ride.time);
  const phase=a.ride.phase,time=a.ride.time;
  M.tick(a.ride,a.state,a.context,.5);
  assert.equal(a.ride.phase,phase);assert.equal(a.ride.moving,0);assert.notEqual(a.ride.time,time);
  const resting=JSON.stringify(a.ride);M.tick(a.ride,a.state,{...a.context,paused:true},.5);
  assert.equal(JSON.stringify(a.ride),resting,'pausing freezes breathing as well as strides');
 }
});
