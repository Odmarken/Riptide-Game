/* The save, migration and raid-packet fixes from the 2026-11-24 bug review, pinned so they stay fixed. The real functions are cut
 * out of game.js and run in a vm - migrate() with every module it leans on, found by name, so a line moved or a helper added
 * does not break the cut. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\r\n/g,'\n');
const E=require('../assets/city/economy.js');
const plain=o=>JSON.parse(JSON.stringify(o));
const cut=(a,b)=>{const i=game.indexOf(a),j=game.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'section '+a);return game.slice(i,j);};
const line=h=>{const i=game.indexOf('\n'+h);assert.ok(i>=0,'line '+h);return game.slice(i+1,game.indexOf('\n',i+1));};

/* ---- a declaration of game.js by its name: from its first character to the end of its statement (or its function's last brace) ---- */
function balanced(a,isFn){
 let depth=0,i=a,str=null;
 for(;i<game.length;i++){
  const ch=game[i],nx=game[i+1];
  if(str){
   if(ch==='\\'){i++;continue;}
   if(ch===str)str=null;
   else if(str==='`'&&ch==='$'&&nx==='{'){let d=1;i+=2;for(;i<game.length&&d;i++){if(game[i]==='{')d++;else if(game[i]==='}')d--;}i--;}
   continue;
  }
  if(ch==='/'&&nx==='*'){i=game.indexOf('*/',i)+1;continue;}
  if(ch==='/'&&nx==='/'){i=game.indexOf('\n',i)-1;continue;}
  if(ch==='"'||ch==="'"||ch==='`'){str=ch;continue;}
  if(ch==='/'&&/[=(,:!&|?{};\n]\s*$/.test(game.slice(Math.max(0,i-3),i))){   /* a regex literal */
   let j=i+1,cls=false;for(;j<game.length;j++){const c=game[j];if(c==='\\'){j++;continue;}if(c==='[')cls=true;else if(c===']')cls=false;else if(c==='/'&&!cls)break;else if(c==='\n')break;}
   if(game[j]==='/'){i=j;continue;}
  }
  if(ch==='('||ch==='['||ch==='{')depth++;
  else if(ch===')'||ch===']'||ch==='}'){depth--;if(isFn&&depth===0&&ch==='}')break;}
  else if(!isFn&&depth===0&&(ch===';'||ch==='\n')){
   if(ch===';')break;
   if(!/^\s*[.?:+\-*&|,=]/.test(game.slice(i+1,i+40))&&!/[=,+\-*&|?:(]\s*$/.test(game.slice(Math.max(0,i-3),i)))break;
  }
 }
 return game.slice(a,i+1);
}
function decl(name){
 const n=name.replace(/[$]/g,'\\$');
 let m=new RegExp('^(?:async )?function '+n+'\\(','m').exec(game);
 if(m)return balanced(m.index,true);
 m=new RegExp('^(?:const|let|var) '+n+'\\s*=','m').exec(game)||new RegExp('^(?:const|let|var) [^\\n]*?[,;]\\s*'+n+'\\s*=','m').exec(game)||new RegExp('^(?:const|let|var) [^\\n]*\\b'+n+'\\s*[=,;]','m').exec(game);
 return m?balanced(m.index,false):null;
}
function define(c,code,label){
 for(let g=0;g<400;g++){
  try{vm.runInContext(code.replace(/^(const|let) /,'var '),c,{filename:'game.js:'+label});c.__have.add(label);return;}
  catch(e){const m=/^(\S+) is not defined$/.exec(e.message);if(e.name!=='ReferenceError'||!m)throw e;const d=decl(m[1]);assert.ok(d,'game.js declares '+m[1]+' (needed by '+label+')');define(c,d,m[1]);}
 }
}
/* run an expression in the context; whatever of game.js it trips over is cut in, and it runs again from an untouched input */
function run(c,expr,before){
 for(let g=0;g<600;g++){
  try{if(before)before();return vm.runInContext(expr,c,{timeout:4000});}
  catch(e){const m=/^(\S+) is not defined$/.exec((e&&e.message)||'');if(!(m&&e.name==='ReferenceError')||c.__have.has(m[1]))throw e;const d=decl(m[1]);assert.ok(d,'game.js declares '+m[1]);define(c,d,m[1]);}
 }
}
const MODULES=['city/economy.js','wasteland/world.js','wasteland/dungeons.js','mounts/mounts.js','tides/catalog.js','tides/hybrids.js','tides/breeding.js','tides/training.js','tides/core.js','tides/guild.js',
 'tides/farm-breeding.js','farm/layout.js','tides/exploration.js','tree/skill-tree.js','cow/cow-run.js'];
let saveWorld=null;
function world(){
 if(saveWorld)return saveWorld;
 const c=vm.createContext({console,S:null,setTimeout,clearTimeout,performance:{now:()=>Date.now()}});
 c.window=c;c.globalThis=c;c.self=c;c.__have=new Set();
 for(const f of MODULES)vm.runInContext(fs.readFileSync(path.join(root,'assets',f),'utf8'),c,{filename:f});
 return saveWorld=c;
}
const migrate=s=>{const c=world();return plain(run(c,'migrate(__in)',()=>{c.__in=plain(s);}));};
const fresh=()=>{const c=world();return plain(run(c,"migrate(freshState('Bo','human','warrior'))"));};
/* a hero with something in every list the guards walk */
function hero(){
 const s=fresh();
 Object.assign(s,{id:'cabc12345x',lvl:60,prestige:12,zone:5,maxZone:5,gold:5000,
  gear:{weapon:{slot:'weapon',name:'Kingsforged Blade',rar:'epic',atk:900,hp:0,crit:3,up:4},armor:null,trinket:{slot:'trinket',name:'Runed Signet',rar:'rare',atk:10,hp:40,crit:2,up:0}},
  bag:[{slot:'armor',name:'Sturdy Hauberk',rar:'common',atk:0,hp:30,crit:0,up:1}],scrolls:[{id:'titan',tier:2}],
  bossDead:Object.fromEntries(Array.from({length:17},(_, i)=>[i,true])),cleared:{0:true}});
 Object.assign(s.farm,{owned:true,b:[{t:'barn',x:300,y:300},{t:'cowfarm',x:400,y:300,fed:1}],c:[{t:'wheat',x:500,y:300,at:1}]});
 return migrate(s);
}

/* ============ 8. migrate() and the hero list against damaged saves ============ */
test('a damaged field stops no hero loading: the farm, the bag, the gear sets, the chests, the scroll case, the slots',()=>{
 const good=hero(),Z=run(world(),'ZONES.length');
 assert.deepEqual(migrate(good),good,'a sound hero comes through the guards exactly as he went in');
 assert.equal(good.farm.b.length,2);assert.equal(good.bag.length,1);assert.equal(good.gear.weapon.name,'Kingsforged Blade');
 const cases={
  'the farm is null':s=>{s.farm=null;},'the farm is a word':s=>{s.farm='x';},'the farm is a list':s=>{s.farm=[];},
  'a hole among the buildings':s=>{s.farm.b=[null,s.farm.b[0],'x',7];},'the buildings are a word':s=>{s.farm.b='x';},'the buildings are an object':s=>{s.farm.b={};},
  'a hole among the crops':s=>{s.farm.c=[null];},'the crops are a number':s=>{s.farm.c=1e308;},
  'the bag is a word':s=>{s.bag='x';},'the bag is an object':s=>{s.bag={};},'the bag is null, with an old gear set to unpack':s=>{s.bag=null;s.gearSets=[{weapon:{slot:'weapon',name:'Old',atk:1,hp:0,crit:0}},null];},
  'the gear sets are a word':s=>{s.gearSets='x';},'the gear sets are an object':s=>{s.gearSets={};},
  'the chests are null':s=>{s.chests=null;},'the chests are a word':s=>{s.chests='x';},
  'the scroll case is null, with an old enchant on the blade':s=>{s.scrolls=null;s.gear.weapon.ench='titan';s.bag[0].ench='fortune';},
  'the gear is null':s=>{s.gear=null;},'a slot holds a word':s=>{s.gear.weapon='x';s.gear.armor=7;},
 };
 for(const [name,spoil] of Object.entries(cases)){
  const s=plain(good);spoil(s);
  let out;assert.doesNotThrow(()=>{out=migrate(s);},name);
  assert.ok(Array.isArray(out.bag)&&out.bag.every(it=>it&&typeof it==='object'),name+': a bag of items');
  assert.ok(Array.isArray(out.scrolls),name+': a scroll case');assert.ok(Array.isArray(out.gearSets),name+': gear sets');
  assert.ok(Array.isArray(out.farm.b)&&Array.isArray(out.farm.c)&&[...out.farm.b,...out.farm.c].every(it=>it&&typeof it==='object'),name+': a farm of pieces');
  assert.ok(out.chests&&typeof out.chests==='object',name+': chests');
  for(const k of ['weapon','armor','trinket'])assert.ok(out.gear[k]===null||typeof out.gear[k]==='object',name+': the '+k+' slot');
  assert.ok(Number.isInteger(out.zone)&&out.zone>=0&&out.zone<Z,name+': a zone in the table');
  assert.deepEqual(migrate(out),out,name+': and the next load changes nothing more');
 }
 assert.equal(migrate({...plain(good),farm:{...good.farm,b:[null,good.farm.b[0],'x']}}).farm.b.length,1,'the real building is kept, only the holes go');
});

test('a zone, a deepest zone or an upgrade count that is no sane number can no longer hang the load',()=>{
 const good=hero(),Z=run(world(),'ZONES.length');
 /* each of these counted down - or up - one step at a time from 1e308, for ever: the game sat on its loading screen */
 const cases={
  'zone 1e308 on a prestiged hero':s=>{s.zone=1e308;},'zone as text':s=>{s.zone='x';},'zone a fraction':s=>{s.zone=5.5;},'zone negative':s=>{s.zone=-5;},'zone null':s=>{s.zone=null;},
  'deepest zone 1e308 before the first prestige':s=>{s.prestige=0;s.bossDead={};s.maxZone=1e308;},'deepest zone 1e308 after it':s=>{s.maxZone=1e308;},'deepest zone as text':s=>{s.maxZone='x';},
  'an item forged 1e308 times':s=>{s.bag[0].up=1e308;delete s.bag[0].baseHp;},'a worn item forged 1e308 times':s=>{s.gear.trinket.up=1e308;},
 };
 for(const [name,spoil] of Object.entries(cases)){
  const s=plain(good);spoil(s);
  let out;assert.doesNotThrow(()=>{out=migrate(s);},name+' (a vm timeout here is the hang)');
  assert.ok(Number.isInteger(out.zone)&&out.zone>=0&&out.zone<Z,name+': zone '+out.zone);
  assert.ok(Number.isInteger(out.maxZone)&&out.maxZone>=0&&out.maxZone<Z,name+': deepest zone '+out.maxZone);
 }
 const road=run(world(),'ZONES.findIndex((z,i)=>i>0&&!z.boss&&!z.special)');   /* a stretch of the road: no arena to be carried home from */
 assert.equal(migrate({...plain(good),zone:road,maxZone:road}).zone,road);
 assert.equal(migrate({...plain(good),zone:String(road),maxZone:road}).zone,road,'a zone written as text is the same zone, as a number');
 assert.equal(migrate({...plain(good),zone:road+.5,maxZone:road}).zone,road,'and a fraction of one is the zone it lies in');
 assert.equal(migrate({...plain(good),zone:9999}).zone,run(world(),'TAVERN_ZONE'),'and one past the table - a newer build\'s - still wakes in Moonshine');
 assert.match(game,/if\(!ZONES\[s\.zone\|0\]\)s\.zone=TAVERN_ZONE;/,'the older rule stands beside the new one');
});

test('one hero that cannot be read is left out of the list; the others are still offered',async()=>{
 const mem={bad:JSON.stringify({id:'bad',broken:true}),good:JSON.stringify({id:'good'})},errors=[];
 const c=vm.createContext({console:{error:(...a)=>errors.push(a)},TEST_ROSTER:null,memChars:mem,deviceGet:async k=>mem[k.replace(/^(riptide|eastvale)-char-/,'')]||null,
  migrate:s=>{if(s.broken)throw new TypeError('damaged');return {...s,migrated:true};}});
 vm.runInContext(cut('async function loadChar(id){','async function legacyLoad(')+';this.loadChar=loadChar;',c);
 /* the device copy throws, and the copy in memory is the same hero: the second read stood outside the try and rejected the whole list */
 assert.equal(await c.loadChar('bad'),null);
 assert.equal(errors.length,1,'and error.log says which hero and why');
 assert.deepEqual(plain(await c.loadChar('good')),{id:'good',migrated:true});
 assert.equal(await c.loadChar('nobody'),null);
});

/* ============ 6 and 9. what travels between the players of a raid ============ */
const RACES=[{id:'human'},{id:'dwarf'},{id:'orc'},{id:'undead'}],CLASSES=[{id:'warrior'},{id:'mage'},{id:'hunter'},{id:'priest'}];
function room(host){
 const sent=[],casts=[];
 const c=vm.createContext({console,performance:{now:()=>5000},sent,casts,RACES,CLASSES,
  mp:{on:true,started:true,host:!!host,hostPid:'h',peers:{p1:{x:10,y:20,hp:1}},rtc:{},applied:{},appliedBy:{}},hero:{x:100.4,y:200.6},enemies:[],bolts:[],
  rtcBroadcast:o=>sent.push(JSON.parse(JSON.stringify(o))),   /* what JSON puts on the data channel */
  SpellFx:{cast:(id,o)=>{casts.push([id,o]);return true;},hit:()=>false},
  burst(){},zapLine(){},bloodAt(){},sparkles(){},ring(){},floatAt(){},killEnemy(e){e.dead=true;}});
 vm.runInContext([line('const RACE_ALIAS='),line('const CLASS_ALIAS='),line('const TREE_AURAS='),line('const RUNE_LIGHT='),
  cut('const rtcNum=','/* ============ WEBRTC LAYER'),cut('function rtcOnMsg(pid,m){','/* ⚔ A guest\'s damage to a raid lord'),
  cut('function mpBossClean(nb){','function mpHostRaidThreatTick('),cut('function peerAuraState(p){','\n}')+'\n}',
  'Object.assign(this,{mpAct,mpPlayFx,rtcOnMsg,mpBossClean,mpPeerClean,mpLookClean,mpHostTotal,peerAuraState,rtcNum,TREE_AURAS});'].join('\n'),c);
 return c;
}
test('a cast and the aura it leaves reach the party: the aura travels as au, never over the packet\'s own kind',()=>{
 const c=room(false);
 c.mpAct('cast',{f:'shout',fx:1,gy:8,rad:0,d:10,k:'atk',tx:undefined,ty:undefined,tg:[[300,200]],sz:undefined});   /* as spellCastFx hands a buff over */
 c.mpAct('cast',{f:'heroic',d:0,k:undefined,tg:[]});                                                                /* and a blow that leaves none */
 c.mpAct('cast',{f:'tree:lion',d:6,k:'undying'});
 c.mpAct('swing',{tx:5,ty:6});
 assert.deepEqual(c.sent.map(p=>[p.k,p.a,p.au]),[['act','cast','atk'],['act','cast',undefined],['act','cast','undying'],['act','swing',undefined]]);
 assert.deepEqual([c.sent[0].px,c.sent[0].py,c.sent[0].f,c.sent[0].d],[100,201,'shout',10],'the rest of the packet as it always was');
 for(const p of c.sent)c.rtcOnMsg('p1',p);
 assert.deepEqual(c.casts.map(x=>x[0]),['shout','heroic','tree:lion'],'the far side plays every cast');
 assert.ok(c.casts.every(x=>x[1].peer===true));
 const P=c.mp.peers.p1,aura=c.peerAuraState(P);
 assert.deepEqual(Object.keys(P.fxAura).sort(),['atk','undying']);
 assert.ok(aura&&aura.atk&&aura.undying&&!aura.haste,'and the peer wears what it left');
 assert.equal(Math.round(aura.atk.left),10);
 /* a build from before this fix: its packet has the aura where the kind should be, and is dropped as it always was - without a throw */
 const c2=room(false);
 for(const old of [{a:'cast',f:'shout',d:10,k:'atk',px:1,py:2},{a:'cast',f:'heroic',px:1,py:2},{a:'cast',f:'renew',d:8,k:'hot',px:1,py:2}])assert.doesNotThrow(()=>c2.rtcOnMsg('p1',JSON.parse(JSON.stringify(old))));
 assert.equal(c2.casts.length,0);assert.equal(c2.mp.peers.p1.fxAura,undefined);
 /* and that older build receiving the new packet: its line reads the kind as the aura's name - a key nothing looks up */
 const p={},m=c.sent[0];
 if(m.k&&m.d>0)(p.fxAura||(p.fxAura={}))[m.k]={until:5+m.d,dur:m.d};
 assert.deepEqual(Object.keys(p.fxAura),['act']);assert.ok(!c.TREE_AURAS.includes('act')&&!['atk','haste','hot'].includes('act'));
 assert.equal(c.peerAuraState({fxAura:plain(p.fxAura)}),null,'no aura is drawn from it');
 /* only an aura this build draws is kept, for no longer than ten minutes */
 const c3=room(false);
 for(const au of ['constructor','__proto__','act',7,{a:1}])c3.rtcOnMsg('p1',{k:'act',a:'cast',f:'x',d:5,au});
 assert.equal(c3.mp.peers.p1.fxAura,undefined);
 c3.rtcOnMsg('p1',{k:'act',a:'cast',f:'x',d:1e5,au:'wings'});assert.equal(c3.mp.peers.p1.fxAura.wings.dur,600);
});

test('a packet that is not what it should be changes nothing: no NaN in a lord\'s health, no place that is no number',()=>{
 const lord=()=>({raid:true,bossId:'fel',awake:true,dead:false,hp:50000,max:50000,x:0,y:0,r:30});
 /* the host's side */
 for(const m of [{k:'dmg',d:'x'},{k:'dmg',d:{}},{k:'dmg',d:[]},{k:'dmg',d:null},{k:'dmg',d:-50},{k:'dmg',id:'fel',tot:'1e9999'},{k:'dmg',id:'fel',tot:-5},{k:'dmg',id:'fel',tot:'x'}]){
  const c=room(true),b=lord();c.enemies.push(b);
  assert.doesNotThrow(()=>c.rtcOnMsg('p1',plain(m)));
  assert.equal(b.hp,50000,JSON.stringify(m));assert.equal(b.dead,false);
 }
 {const c=room(true),b=lord();c.enemies.push(b);
  c.rtcOnMsg('p1',{k:'dmg',d:120});assert.equal(b.hp,49880,'an older build\'s single hit still lands');
  c.rtcOnMsg('p1',{k:'dmg',id:'fel',tot:500,d:500});assert.equal(b.hp,49380,'and a running total');
  c.mpHostTotal('p1','fel',Infinity);c.mpHostTotal('p1','fel',NaN);assert.equal(b.hp,49380,'a total that is no number counts for nothing (the players doc can hold one)');
  assert.match(cut('function mpHostTotal(','\n}'),/if\(!\(tot>prev\)\)return;/);}
 /* where a peer stands */
 {const c=room(true),P=c.mp.peers.p1;
  for(const m of [{k:'pos',x:'a',y:null,hp:'z'},{k:'pos',x:5,y:{}},{k:'pos',x:1e300,y:5},{k:'pos',y:5},{k:'pos',x:NaN,y:NaN}])c.rtcOnMsg('p1',m);
  assert.deepEqual([P.x,P.y,P.hp],[10,20,1],'he stays where he last was');
  c.rtcOnMsg('p1',{k:'pos',x:'30',y:40,hp:7,f:'abc',hl:1});assert.deepEqual([P.x,P.y,P.hp,P.f,P.hl],[30,40,1,1,1],'numbers as text are numbers, health between nothing and full');
  c.rtcOnMsg('p1',{k:'pos',x:31,y:41,hp:'q',f:-1});assert.deepEqual([P.x,P.hp,P.f],[31,1,-1],'a health that is no number leaves the last one');}
 /* the lords as a guest hears of them */
 {const c=room(false),b=lord();c.enemies.push(b);b.netX=3;b.netY=4;
  for(const bs of [null,'x',{},[null],['x'],[{id:'fel',x:'a',y:1,hp:NaN,max:'q',cds:'x',tgt:{}}],[{id:'fel',hp:null,max:undefined}],[{id:'fel',x:5,y:null,hp:{}}]])assert.doesNotThrow(()=>c.rtcOnMsg('h',{k:'boss',bs}));
  assert.deepEqual([b.hp,b.max,b.netX,b.netY,b.dead],[50000,50000,3,4,false]);
  c.rtcOnMsg('h',{k:'boss',bs:[{id:'fel',x:7,y:8,hp:400,max:50000,cds:{a:2,b:'x',c:null},tgt:'p1',awake:true}]});
  assert.deepEqual([b.hp,b.netX,b.netY,b.target],[400,7,8,'p1']);assert.deepEqual(plain(b.cds),{a:2});
  c.rtcOnMsg('h',{k:'boss',bs:[{id:'fel',dead:true}]});assert.equal(b.dead,true,'and his death still arrives');
  assert.equal((game.match(/nb=mpBossClean\(nb\);if\(!nb\)return;/g)||[]).length,2,'over WebRTC and from the room\'s own record alike');}
 /* what a peer's own effects carry */
 {const c=room(false);
  for(const m of [{k:'act',a:'cast',f:'__proto__',tg:[null,'x',[1],[{},2],[3,4]]},{k:'act',a:'cast',f:{x:1},d:'x',gy:{},rad:'q'},{k:'act',a:'swing',wr:'constructor',tx:1,ty:2},{k:'act',a:'swing',rg:1,tx:'q',ty:5},
   {k:'act',a:'boltfx',tx:1,ty:{},f:{},c:{}},{k:'act',a:'bolt',tx:1e300,ty:1,c:7},{k:'act',a:'potion',c:{}},{k:'act',px:'x',py:{}},{k:'act'}])assert.doesNotThrow(()=>c.rtcOnMsg('p1',plain(m)),JSON.stringify(m));
  assert.deepEqual(plain(c.casts[0][1].targets),[{x:3,y:4,r:16}],'only the targets that are places');
  assert.ok(c.bolts.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.tgt.x)&&Number.isFinite(b.tgt.y)&&typeof b.c==='string'&&(b.fx===undefined||typeof b.fx==='string')),'no shot is loosed at a place that is no number');
  assert.equal(c.bolts.length,0);
  c.rtcOnMsg('p1',{k:'act',a:'swing',rg:1,tx:50,ty:60,px:1,py:2,c:'#fff'});assert.equal(c.bolts.length,1);}
});

test('a peer\'s doc is made sound before it is merged: a look this build can paint, numbers that are numbers',()=>{
 const c=room(true);
 const d=plain(c.mpPeerClean({name:{x:1},x:'12',y:null,hp:5,dmg:'x',dmgBy:{fel:'9',thor:NaN,odin:{},loki:-1},ready:true,t:77,look:{race:'elf',cls:'bard',w:{},outfit:7,pet:[],wench:'emberbite',fem:true}}));
 assert.deepEqual(d,{name:'Hero',x:12,hp:1,dmg:0,dmgBy:{fel:9},ready:true,t:77,look:{race:'human',cls:'warrior',w:null,outfit:null,pet:null,wench:'emberbite',fem:true}});
 assert.deepEqual(plain(c.mpLookClean({race:'stoneborn',cls:'cleric'})),{race:'dwarf',cls:'priest'},'the old names of a race and a class are still theirs');
 for(const bad of ['constructor','__proto__','toString',{},7,null,undefined])assert.deepEqual(plain(c.mpLookClean({race:bad,cls:bad})),{race:'human',cls:'warrior'});
 assert.deepEqual(plain(c.mpLookClean(undefined)),{race:'human',cls:'warrior'});
 assert.equal(plain(c.mpPeerClean({name:'x'.repeat(99)})).name.length,24);
 assert.match(game,/const data=mpPeerClean\(d\.data\(\)\),prev=mp\.peers\[d\.id\],now=Date\.now\(\);/,'where the room\'s players are taken in');
 /* the portraits of the hero list and the leaderboard: the race the row names, or the first this build knows */
 assert.match(cut('function drawPortrait(cnv,ch){','const bg=g.createLinearGradient'),/\|\|RACES\[0\],c=[^\n]*\|\|CLASSES\[0\];\n ch=\{\.\.\.ch,race:r\.id\};/);
});

/* ============ 7. the city's shape under one VERSION ============ */
const CTX={live:true,mining:120,ench:80,smith:6,miningTrained:true,enchTrained:true,smelter:true,farmOwned:true,farmLvl:3};
const seeded=seed=>{let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};};
/* what this VERSION's city is known to hold where the wars, the sellswords, the expeditions and the conquests write. A build that
   knows fewer of these and the same VERSION rebuilds the city without them and saves it (a build from 2026-09-23 strips the
   sellswords and the wars from today's city). So a name is added here KNOWINGLY: either with VERSION raised - builds since
   2026-09-23 then set the city aside untouched and say "saved by a newer version", but builds before it empty the city, which is
   why VERSION was not raised on 2026-11-24 - or accepting that every older build of this VERSION drops the new field when it saves. */
const SHAPE={4:{
 top:['allies','arrears','attract','bankRule','borrowed','budget','chartered','clock','council','counsel','coupTold','crowned','deposed','dismissed','earned','expedition','food','forsaken','forsakenAt','guards','history','hurt',
  'incidents','jail','kept','king','last','limit','loan','mercs','mood','noble','office','petition','pop','protest','raid','rate','regency','repaid','reviewSeen','royalMoodLeft','scars','season','seasons','seizeI','seized','skill',
  'spent','ticks','treasury','trust','unattended','v','wage','winds','works'],
 ally:['ashes','conquered','held','owned','peaceAt','pending','put','rel','ruin','sacked','stake','truce','war'],
 war:['beaten','burned','by','cool','hits','plunder','raids','refit','since','str'],
 expedition:['ally','at','auto','cadets','cap','down','landed','mercs','rate','used','watch'],
 hurt:['cadets','left','mercs','watch']}};
test('the city comes back from a save whole after every act of war, and its shape is the one this VERSION is known by',()=>{
 const known=SHAPE[E.VERSION];
 assert.ok(known,'VERSION '+E.VERSION+' has no shape written down here: write it, and say in the comment above what the older builds do with it');
 const s=E.create(),rng=seeded(11),seen={top:new Set(),ally:new Set(),war:new Set(),expedition:new Set(),hurt:new Set()},acts=[];
 const diff=(a,b,p='',out=[])=>{if(a===b)return out;if(typeof a!==typeof b||a===null||b===null||typeof a!=='object'){out.push(p+': '+JSON.stringify(a)+' -> '+JSON.stringify(b));return out;}
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'.'+k,out);return out;};
 const check=act=>{
  acts.push(act);
  const d=diff(plain(s),plain(E.normalize(plain(s))));
  assert.deepEqual(d,[],'after "'+act+'" a save and a load change the city: normalize() drops or alters '+d.slice(0,6).join(' | '));
  for(const k of Object.keys(s))seen.top.add(k);
  for(const a of Object.values(s.allies)){for(const k of Object.keys(a))seen.ally.add(k);if(a.war)for(const k of Object.keys(a.war))seen.war.add(k);}
  for(const k of ['expedition','hurt'])if(s[k])for(const q of Object.keys(s[k]))seen[k].add(q);
 };
 E.ennoble(s,1e9,{prestige:1});
 for(let n=0;s.office<1&&n<4000;n++){for(const o of s.noble.offers)if(!o.taken&&s.noble.rank>=1)E.fundContract(s,o.id,1e9);E.tick(s,CTX,rng);}
 assert.equal(E.meetHand(s),true);assert.ok(E.acceptOffice(s).ok);assert.ok(E.charter(s).ok);
 Object.assign(s,{crowned:true,deposed:'gaol',trust:100,treasury:900e6});check('the crown');   /* crowned, as the game's own test heroes are set */
 for(let i=0;i<5;i++){assert.ok(E.hireMercs(s).ok);check('sellswords hired');}
 assert.equal(s.mercs,E.MERC_MAX);
 const [a0,a1]=E.ALLIES.map(a=>a.id);
 assert.ok(E.declareWar(s,a0).ok);check('war declared');assert.ok(E.declareWar(s,a1).ok);check('a second war');
 let took=false;
 for(let r=0;r<80&&!took;r++){
  s.allies[a0].war.refit=0;const H=E.warView(s,a0).war.home;
  assert.ok(E.sail(s,a0,{watch:H.watch,cadets:H.cadets,mercs:H.mercs}).ok,'the expedition sails');check('an expedition sails');
  if(r===0){s.expedition.down=3;s.expedition.landed=true;check('men fall in the battle (the game counts them on the expedition)');}
  for(let k=0;k<300;k++){const z=E.raze(s,a0,'house@'+r+','+k,2);check('a building razed');if(!z.ok)break;if(z.conquered){took=true;break;}}
  if(s.expedition){assert.ok(E.endRaid(s,{hurt:7}).ok);check('the men come home, some hurt');}
  for(let k=0;k<3;k++){E.tick(s,CTX,rng);check('a close at war');}
 }
 assert.ok(took,'the first court falls to the sword');check('a court conquered');
 if(E.restoreAllyView(s,a0)){assert.ok(E.restoreAlly(s,a0).ok);check('the sacked court restored');}
 for(let k=0;k<40;k++){E.tick(s,CTX,rng);check('a close with a court held');}
 if(s.allies[a1].war){s.treasury=900e6;assert.ok(E.makePeace(s,a1).ok,'peace is made');check('peace');}
 for(let k=0;k<40;k++){E.tick(s,CTX,rng);check('a close in the truce');}
 assert.ok(seen.expedition.has('down')&&seen.expedition.has('landed')&&seen.ally.has('war')&&seen.ally.has('conquered')&&seen.top.has('mercs'),'the playthrough reached the wars, the fallen and a conquest');
 for(const part of Object.keys(seen)){
  const unknown=[...seen[part]].filter(k=>!known[part].includes(k)).sort();
  assert.deepEqual(unknown,[],'the city\'s '+part+' grew under VERSION '+E.VERSION+': '+unknown.join(', ')+' - read the comment at SHAPE in this test before adding '+(unknown.length>1?'them':'it')+' there');
 }
 /* and the other way round: nothing written down here that create() no longer makes */
 assert.deepEqual(Object.keys(E.create()).filter(k=>!known.top.includes(k)),[]);
 assert.deepEqual(known.top.filter(k=>!(k in E.create())),[],'every top-level field is born in create(), so normalize() has a default for it');
});
