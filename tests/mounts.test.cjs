const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../assets/mounts/mounts.js');
const outdoor={wasteland:true};
const ridingZones=[outdoor,{city:true},{farm:true},{tavern:true}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' vs '+b);
const earned={prestige:50,duke:true,forsaken:true};
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
 const state={},spending=[];let gold=20000000;
 const spend=amount=>{spending.push(amount);if(gold<amount)return false;gold-=amount;return true;};
 const sold=M.catalog.filter(m=>!m.egg&&!m.reward);
 for(const item of sold){
  const before=gold;assert.equal(M.buy(state,item.id,spend,earned).ok,true);
  assert.equal(before-gold,item.price);assert.ok(state.mounts.owned.includes(item.id));
  const paid=spending.length,saved=JSON.stringify(state);
  assert.deepEqual(M.buy(state,item.id,spend,earned),{ok:false,reason:'bought'});
  assert.equal(spending.length,paid);assert.equal(JSON.stringify(state),saved);
 }
 assert.equal(state.mounts.equipped,M.catalog[0].id,'later purchases do not silently replace the equipped horse');
 assert.deepEqual(spending,sold.map(m=>m.price));
});

test('unknown, unaffordable and unowned choices leave money and ownership unchanged',()=>{
 const state={mounts:{owned:['horse'],equipped:'horse'}},before=JSON.stringify(state);let calls=0;
 const fail=()=>{calls++;return false;};
 assert.deepEqual(M.buy(state,'unknown',fail),{ok:false,reason:'unknown'});assert.equal(calls,0);
 assert.deepEqual(M.buy(state,'leopard',fail,earned),{ok:false,reason:'gold'});assert.equal(calls,1);
 assert.deepEqual(M.buy(state,'leopard',undefined,earned),{ok:false,reason:'gold'});
 assert.equal(M.equip(state,'unknown'),false);assert.equal(M.equip(state,'leopard'),false);
 assert.equal(JSON.stringify(state),before);
 assert.equal(M.selected({mounts:{owned:['horse'],equipped:'leopard'}}),null);
 assert.equal(M.selected({}),null);assert.equal(M.selected(null),null);
});

test('old saves normalize safely and ownership survives JSON reload without inheriting a temporary ride',()=>{
 for(const value of [null,undefined,{},[],{owned:'horse'}])
  assert.deepEqual(M.normalize(value),{owned:[],equipped:null});
 /* a mount this build does not know is a newer build's: it is kept, unowned here, and saved back - never dropped */
 assert.deepEqual(M.normalize({owned:['unknown'],equipped:'unknown'}),{owned:[],equipped:'unknown',foreign:['unknown']});
 assert.equal(M.selected({mounts:M.normalize({owned:['unknown'],equipped:'unknown'})}),null,'a mount this build cannot draw is not ridden here');
 const raw={owned:['leopard','horse','horse','unknown'],equipped:'leopard',extra:123},before=JSON.stringify(raw);
 const state={mounts:M.normalize(raw)};assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(state.mounts,{owned:['horse','leopard'],equipped:'leopard',foreign:['unknown']});
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

test('every mount can saddle up, ride and dismount in Wasteland, City, Farm and Home',()=>{
 for(const zone of ridingZones)for(const item of M.catalog){
  const f=setup(item.id);f.context.zone=zone;
  assert.equal(M.allowed(zone),true);
  assert.equal(M.toggle(f.ride,f.state,f.context).action,'casting');
  M.tick(f.ride,f.state,f.context,.99);
  assert.equal(f.ride.id,null);assert.equal(M.multiplier(f.ride,f.state,zone),1);
  M.tick(f.ride,f.state,f.context,.01);
  assert.equal(f.ride.id,item.id);assert.equal(M.multiplier(f.ride,f.state,zone),item.speed);
  f.hero.x+=20;M.tick(f.ride,f.state,f.context,.1);
  assert.ok(f.ride.phase>0);assert.equal(f.ride.moving,1);
  assert.equal(M.toggle(f.ride,f.state,f.context).action,'down');
  assert.equal(M.multiplier(f.ride,f.state,zone),1);assert.deepEqual(f.ride,M.createRide());
 }
});

test('riding in the added zones still requires an owned and equipped mount',()=>{
 for(const zone of ridingZones)for(const collection of [
  {owned:[],equipped:null},
  {owned:['horse'],equipped:null},
  {owned:['horse'],equipped:'leopard'},
  {owned:[],equipped:'horse'}
 ]){
  const f=setup();f.context.zone=zone;f.state.mounts=structuredClone(collection);
  const before=JSON.stringify(f.state);
  assert.deepEqual(M.toggle(f.ride,f.state,f.context),{ok:false,reason:'empty'});
  assert.equal(f.ride.id,null);assert.equal(f.ride.casting,null);
  M.tick(f.ride,f.state,f.context,1);
  assert.equal(M.multiplier(f.ride,f.state,zone),1);
  assert.equal(JSON.stringify(f.state),before,'entering a riding zone never selects a mount for the player');
 }
});

test('dungeons, unsupported zones, death, missing ownership and equipment changes immediately remove riding speed',()=>{
 const banned=[{},null,{raid:true},{cow:true},{altar:true},{crypts:true},{boss:true},{dungeon:'briarhollow'},
  ...ridingZones.map(zone=>({...zone,dungeon:'cindervein'}))];
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
 for(const zone of ridingZones)for(const item of M.catalog){
  const f=setup(item.id),pet={},mob={speed:90},slowMob={speed:90,slowT:2};f.context.zone=zone;
  const env={hero:f.hero,pet,S:f.state,mountRide:f.ride,Mounts:M,TideUI:{visibleCompanion:()=>null},zoneOf:()=>zone,swiftMul:()=>1.2,speedBoostMul:()=>1.1};
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

test('Torsten sells the courser from Prestige 4 and the leopard to a Duke; the tiger is the Forsaken One\'s gift',()=>{
 const sold=M.catalog.filter(m=>!m.egg);
 assert.deepEqual(Object.fromEntries(sold.map(m=>[m.id,{...m.need}])),{horse:{prestige:4},leopard:{duke:true},'spectral-tiger':{forsaken:true}});
 assert.deepEqual(sold.map(M.requirement),['Prestige 4','Duke','Slay the Forsaken One']);
 assert.deepEqual(sold.map(m=>m.price),[2500000,10000000,0],'2.5 million, 10 million, free (2026-09-29)');
 const attempt=(id,standing)=>{let charged=0;const state={};const result=M.buy(state,id,price=>{charged+=price;return true;},standing);return {result,charged,state};};
 for(const id of ['horse','leopard']){
  const none=attempt(id);assert.deepEqual(none.result,{ok:false,reason:'locked'},'no standing, nothing with a need is for sale');
  assert.equal(none.charged,0);assert.deepEqual(none.state,{},'a refused sale writes nothing');
 }
 assert.equal(attempt('horse',{prestige:3,duke:true,forsaken:true}).result.reason,'locked','a Duke at Prestige 3 still waits for the courser');
 assert.equal(attempt('horse',{prestige:4}).result.ok,true);assert.equal(attempt('horse',{prestige:4}).charged,2500000);
 assert.equal(attempt('leopard',{prestige:50,forsaken:true}).result.reason,'locked','prestige is not a patent');
 assert.equal(attempt('leopard',{duke:true}).result.ok,true);assert.equal(attempt('leopard',{duke:true}).charged,10000000);
 /* the tiger is never sold, not even to the hero who slew the Forsaken One: it is given */
 for(const standing of [undefined,earned]){
  const t=attempt('spectral-tiger',standing);assert.deepEqual(t.result,{ok:false,reason:'reward'});assert.equal(t.charged,0);assert.deepEqual(t.state,{});
 }
 assert.equal(M.unlocked(M.get('spectral-tiger'),earned),false,'no live Buy button for the gift');
 const hero={mounts:{owned:['horse'],equipped:'horse'}};
 assert.deepEqual(M.rewards(hero,{prestige:50,duke:true}),[],'nothing given before the Forsaken One falls');
 assert.deepEqual(hero.mounts.owned,['horse']);
 assert.deepEqual(M.rewards(hero,{forsaken:true}).map(m=>m.id),['spectral-tiger']);
 assert.deepEqual(hero.mounts,{owned:['horse','spectral-tiger'],equipped:'horse'},'given, not saddled over the chosen mount');
 assert.deepEqual(M.rewards(hero,{forsaken:true}),[],'given once');
 const fresh={};M.rewards(fresh,{forsaken:true});assert.equal(M.selected(fresh).id,'spectral-tiger','a first mount is ridden at once');
 assert.equal(M.unlocked(null,earned),false);assert.equal(M.unlocked(M.get('horse'),{prestige:'4'}),true,'a prestige read as text still counts');
 /* bought before the rule: kept, ridden and re-equipped without meeting it */
 const old={mounts:{owned:['horse','spectral-tiger'],equipped:'horse'}};
 assert.equal(M.equip(old,'spectral-tiger'),true);assert.equal(M.selected(old).id,'spectral-tiger');
 assert.deepEqual(M.buy(old,'spectral-tiger',()=>true),{ok:false,reason:'bought'});
});

test('the stable reads the hero\'s standing from the save and locks what is not earned',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const line=source.match(/^const mountStanding=[\s\S]*?\}\)\;$/m);assert.ok(line,'mountStanding found');
 const CityEconomy=require('../assets/city/economy.js');
 const standing=S=>vm.runInNewContext(line[0]+';mountStanding()',{S,CityEconomy});
 const duke=CityEconomy.NOBLE_RANKS.findIndex(r=>r.id==='duke');assert.ok(duke>0);
 assert.deepEqual({...standing({prestige:0})},{prestige:0,forsaken:false,duke:false});
 assert.equal(standing({prestige:4,city:{noble:{rank:duke-1}}}).duke,false,'a Marquess is not yet a Duke');
 assert.equal(standing({city:{noble:{rank:duke}}}).duke,true);
 assert.equal(standing({city:{crowned:true,noble:{rank:0}}}).duke,true,'a King outranks every Duke');
 assert.equal(standing({forsakenDead:true}).forsaken,true);assert.equal(standing({prestige:7}).prestige,7);
 const refresh=source.slice(source.indexOf('function stableRefresh('),source.indexOf('function toggleMount('));
 assert.match(refresh,/Mounts\.buy\(S,id,spendBank,mountStanding\(\)\)/,'the purchase passes the same standing, and the bank pays');
 const spendLine=source.match(/^const spendBank=.*$/m);assert.ok(spendLine,'spendBank found');
 const S={gold:50000000,bankGold:3000000};const spendBank=vm.runInNewContext(spendLine[0]+';spendBank',{S});
 assert.equal(spendBank(10000000),false);assert.equal(S.bankGold,3000000,'a short bank is not touched');
 assert.equal(spendBank(2500000),true);assert.equal(S.bankGold,500000);assert.equal(S.gold,50000000,'the purse never pays Torsten');
 assert.match(source,/<span class="imp">The Forsaken One is slain\.<\/span>[^\n]*\n\s*mountRewards\(\);/,'the kill gives the tiger');
 assert.match(source,/s\.mounts=Mounts\.normalize\(s\.mounts\);if\(s\.forsakenDead\)Mounts\.rewards\(s,\{forsaken:true\}\);/,'a hero who slew it before gets it on loading');
 assert.match(refresh,/equipped\|\|locked\?'disabled':''/,'a locked companion has no live Buy button');
});

test('a rider keeps the saddle from one riding zone to the next, and only then',()=>{
 for(const from of ridingZones)for(const to of ridingZones){
  const a=mounted('leopard');a.context.zone=from;M.tick(a.ride,a.state,a.context,.1);
  a.hero.x+=3;M.tick(a.ride,a.state,a.context,.1);const phase=a.ride.phase;
  assert.equal(M.carry(a.ride,to,a.hero),true);assert.equal(a.ride.id,'leopard');assert.equal(a.ride.phase,phase);
  /* the new world puts the hero somewhere else entirely: no giant stride, no dismount */
  a.hero.x=9000;a.hero.y=-400;a.context.zone=to;M.tick(a.ride,a.state,a.context,.1);
  assert.equal(a.ride.id,'leopard');assert.equal(a.ride.phase,phase,'the jump is not a stride');
  a.hero.x+=3;M.tick(a.ride,a.state,a.context,.1);assert.ok(a.ride.phase>phase,'and the next step rides on');
  assert.equal(M.multiplier(a.ride,a.state,to),M.get('leopard').speed);
 }
 const into=(zone,prep=f=>f)=>{const f=prep(mounted('horse'));const kept=M.carry(f.ride,zone,f.hero);return {kept,ride:f.ride};};
 for(const zone of [{dungeon:true,wasteland:true},{harbor:true},{interior:true},{boss:true},{},null]){
  const r=into(zone);assert.equal(r.kept,false);assert.deepEqual(r.ride,M.createRide(),'a zone without riding dismounts');
 }
 assert.equal(into(outdoor,f=>{f.hero.dead=true;return f;}).kept,false);
 const fresh=mounted('horse');assert.equal(M.carry(fresh.ride,outdoor,null),false,'a character entering the world starts on foot');
 assert.deepEqual(fresh.ride,M.createRide());
 const saddling=setup('horse');M.toggle(saddling.ride,saddling.state,saddling.context);
 assert.equal(M.carry(saddling.ride,{city:true},saddling.hero),false,'half a saddling does not travel');assert.equal(saddling.ride.casting,null);
 const walking=setup('horse');assert.equal(M.carry(walking.ride,{city:true},walking.hero),false);
});

test('buildZone hands the ride to Mounts.carry with the new zone and the current hero',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const body=source.slice(source.indexOf('function buildZone(){'),source.indexOf(' const legacyWastelandBiome='));
 assert.match(body,/Mounts\.carry\(mountRide,zoneOf\(\),hero\);/);
 assert.doesNotMatch(body,/Mounts\.reset\(mountRide\)/,'no unconditional dismount on every zone change');
 const enter=source.slice(source.indexOf(' hero=null; /* fresh character entering the world'),source.indexOf('syncAudioUI(); /* button glyph'));
 assert.ok(enter.indexOf('hero=null')<enter.indexOf('buildZone()'),'a fresh character is null by the time buildZone asks, so it starts on foot');
});

test('the dragon is never sold at the stable: it hatches from the egg, flies at +250% and beats its wings while hovering',()=>{
 const dragon=M.get('dragon');
 assert.equal(dragon.egg,true);assert.equal(dragon.fly,true);
 close(dragon.speed,3.5);assert.ok(dragon.speed>M.get('spectral-tiger').speed*1.5,'still well over half again the tiger');
 let charged=0;const state={};
 assert.deepEqual(M.buy(state,'dragon',p=>{charged+=p;return true;},earned),{ok:false,reason:'egg'});
 assert.equal(charged,0);assert.deepEqual(state,{},'no gold, no ownership');
 assert.equal(M.unlocked(dragon,earned),false);
 /* what the egg hatches into */
 const hero={mounts:{owned:['horse'],equipped:'horse'}};
 assert.equal(M.grant(hero,'dragon'),true);assert.deepEqual(hero.mounts,{owned:['horse','dragon'],equipped:'horse'},'the chosen mount stays chosen');
 assert.equal(M.grant(hero,'dragon'),true);assert.equal(hero.mounts.owned.filter(id=>id==='dragon').length,1,'one dragon');
 const fresh={};M.grant(fresh,'dragon');assert.equal(fresh.mounts.equipped,'dragon','a hero with no mount rides it at once');
 assert.equal(M.grant(fresh,'no-such-mount'),false);
 assert.equal(M.equip(hero,'dragon'),true);
 /* airborne: standing still, the wings keep beating - at the same pace at any frame rate */
 const a=mounted('dragon'),b=mounted('dragon');
 const p0=a.ride.phase;
 for(let n=0;n<30;n++)M.tick(a.ride,a.state,a.context,1/30);
 for(let n=0;n<120;n++)M.tick(b.ride,b.state,b.context,1/120);
 assert.ok(a.ride.phase!==p0,'hovering flaps');close(a.ride.phase,b.ride.phase);assert.equal(a.ride.moving,0);
 const still=a.ride.phase;a.hero.x+=40;M.tick(a.ride,a.state,a.context,1/30);
 assert.ok(a.ride.phase-still>40*.006,'flying forward beats faster than hovering');
 assert.equal(M.multiplier(a.ride,a.state,outdoor),3.5);
});
