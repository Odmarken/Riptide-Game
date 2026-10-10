/* The seams between the casino and the rest of the game (casino review, 2026-09-30), pinned so they stay shut: every casino
 * window goes with the hero who is put away, the hero list refuses while one is open, the page behind a window is inert,
 * Esc and the pad's Start are the window's Back, keys under a window touch nothing, Settings and a table's messages are
 * drawn above the tables, Sebbe and the Final Gate stay off the casino track, and the menu says what the games do.
 * Pure pieces run for real in a vm; the DOM-heavy ones are pinned by their source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const TABLES=['casinoMenu','slotFx','seaFx','bjFx','rouFx','rtbFx','sebbeFx'];
const TEARDOWNS=['slotTeardown','seaTeardown','bjTeardown','rouTeardown','rtbTeardown','cupTeardown','caseTeardown'];

/* a small DOM: elements by id that can be opened (.open or display:flex), clicked, and asked whether they are rendered */
function dom(){
 const nodes=new Map(),clicks=[];
 function element(id){
  const classes=new Set();
  const e={id,style:{display:''},inert:false,children:[],
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n)},
   getClientRects:()=>classes.has('open')||e.style.display==='flex'||e.style.display==='block'?[{}]:[],
   querySelector:()=>null,click:()=>clicks.push(id),setAttribute(){},focus(){}};
  return e;
 }
 const $=id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id);};
 return {$,clicks,element,nodes};
}
/* the pad's panel walker, its Back, and the casino helpers, cut from the game */
function padPieces(extra={}){
 const d=dom();
 const c=vm.createContext({$:d.$,getComputedStyle:()=>({visibility:'visible'}),padItems:()=>[],...extra});
 vm.runInContext(section('const PAD_PANELS=','let padFocus=null;')+section('/* B backs out.','let padNear=null;')+';globalThis.padPanelOpen=padPanelOpen;',c);
 return {c,d};
}

test('closeCasinoWindows runs every per-game teardown this build has, survives S=null and a failing one, and puts the rest away',()=>{
 const code=section('function closeCasinoWindows(){','/* 🎰 while a casino window, the duel');
 for(const name of TEARDOWNS)assert.match(code,new RegExp(`if\\(typeof ${name}==='function'\\)down\\(${name}\\);`),name+' is called when it exists');
 const run=defined=>{
  const d=dom(),calls=[];
  const c=vm.createContext({S:null,$:d.$,gvb:{ref:null},console:{warn:()=>calls.push('warned')},
   gvbLeaveForSwitch:()=>calls.push('gvbLeaveForSwitch'),casinoAmbApply:()=>calls.push('casinoAmbApply')});
  for(const [name,fn] of Object.entries(defined))c[name]=()=>{calls.push(name);fn(c);};
  vm.runInContext(code,c);
  return {c,d,calls};
 };
 /* none of the games' teardowns exist: nothing throws, the menu and the duel's entry screen still go, the music follows */
 let r=run({});
 r.d.$('casinoMenu').classList.add('open');r.d.$('gvbFx').style.display='flex';
 r.c.closeCasinoWindows();
 assert.deepEqual(r.calls,['casinoAmbApply']);
 assert.equal(r.d.$('casinoMenu').classList.contains('open'),false);
 assert.equal(r.d.$('gvbFx').style.display,'none');
 /* some exist, one of them throws: the others still run, in order, and the music is settled last */
 r=run({slotTeardown:()=>{},bjTeardown:()=>{throw new TypeError("Cannot read properties of null (reading 'gold')");},rtbTeardown:()=>{},caseTeardown:()=>{}});
 r.c.closeCasinoWindows();
 assert.deepEqual(r.calls,['slotTeardown','bjTeardown','warned','rtbTeardown','caseTeardown','casinoAmbApply']);
 /* all seven, and a duel with a room: its stake is forfeited through the hero-switch leave */
 r=run(Object.fromEntries(TEARDOWNS.map(n=>[n,()=>{}])));
 r.c.gvb.ref={};
 r.c.closeCasinoWindows();
 assert.deepEqual(r.calls,[...TEARDOWNS,'gvbLeaveForSwitch','casinoAmbApply']);
 /* no room yet, but a Create or Join in flight (gvb.op, the duel fixer's): the leave calls it off too */
 r=run({});r.c.gvb.op={gen:1};
 r.c.closeCasinoWindows();
 assert.deepEqual(r.calls,['gvbLeaveForSwitch','casinoAmbApply']);
 /* no room and nothing in flight: the leave is not asked for, the build without gvb.op included */
 r=run({});r.c.gvb.op=undefined;
 r.c.closeCasinoWindows();
 assert.deepEqual(r.calls,['casinoAmbApply']);
});

test('the hero is put away with his casino windows: the hero list, sign-out and a kick (while S is still his), and a new hero entering',()=>{
 const select=section('function showSelect(){','\n}');
 assert.match(select,/^function showSelect\(\)\{\n closeCasinoWindows\(\);/,'first thing on the way to the hero list');
 assert.ok(select.indexOf('closeCasinoWindows()')<select.indexOf('parkDirtyHero()'),'so whatever a table hands back is saved and parked with its hero');
 const login=section('function showLogin(','\n}');
 assert.ok(login.indexOf('closeCasinoWindows()')>=0&&login.indexOf('closeCasinoWindows()')<login.indexOf('S=null'),'before the hero is dropped');
 assert.match(section('function kickSession(){','\n}'),/showLogin\(/,'a kick from another device goes through showLogin');
 assert.match(game,/\$\('fbOut'\)\.onclick=async\(\)=>\{[^\n]*showLogin\(\);\};/,'so does signing out');
 assert.match(section('function beginGame(isNew){','\n}'),/^function beginGame\(isNew\)\{\n if\(casinoWinOpen\(true\)\)closeCasinoWindows\(\);/,'a window still up is not the new hero\'s');
 assert.match(game,/\$\('hcBackBtn'\)\.onclick=\(\)=>\{ov\.remove\(\);showSelect\(\);\};/,'the hardcore memorial\'s Back goes through showSelect, whose teardown closes what was open');
 /* showLogin for real: the teardown sees the hero, then S is dropped */
 const d=dom(),seen=[];
 const c=vm.createContext({S:{name:'Alpha'},gameOn:true,$:d.$,closeCasinoWindows:()=>seen.push(c.S&&c.S.name),spotStamp(){},dismissHeroGuide(){},TideUI:{leaveZone(){}}});
 vm.runInContext(section('function showLogin(','\n}')+'\n}',c);
 c.showLogin('kicked');
 assert.deepEqual(seen,['Alpha']);
 assert.equal(c.S,null);
 assert.equal(d.$('login').classList.contains('open'),true);
});

test('the hero list refuses while any casino window is open, not only mid-round, and says why',()=>{
 const d=dom(),msgs=[];
 const c=vm.createContext({$:d.$,stageMsg:m=>msgs.push(m),sfx:{warn(){}},seaSpinning:false,slotSpinning:false,bjLive:false,bjResolving:false,rouSpinning:false,rtbLive:false,cupState:'idle'});
 vm.runInContext(section('function casinoWinOpen(chest){','/* Esc and the pad')+section('function casinoRoundOpen(){','/* 🎰 the hero is put away'),c);
 assert.equal(c.casinoRoundOpen(),false);assert.deepEqual(msgs,[]);
 for(const id of TABLES){
  d.$(id).classList.add('open');
  assert.equal(c.casinoRoundOpen(),true,id);assert.equal(msgs.pop(),'Close the game first.');
  d.$(id).classList.remove('open');
 }
 /* a chest reel is no game: it is named for what it is (its Close waits while the reel spins) */
 d.$('chestFx').classList.add('open');
 assert.equal(c.casinoRoundOpen(),true,'chestFx');assert.equal(msgs.pop(),'Close the chest first.');
 d.$('chestFx').classList.remove('open');
 d.$('gvbFx').style.display='flex';assert.equal(c.casinoRoundOpen(),true,'the duel');d.$('gvbFx').style.display='none';
 c.rtbLive=true;assert.equal(c.casinoRoundOpen(),true);assert.equal(msgs.pop(),'Finish the game on the table first.');
 /* the chest reel covers the world too, but only where the caller asks for it */
 c.rtbLive=false;d.$('chestFx').classList.add('open');
 assert.equal(c.casinoWinOpen(),null);assert.equal(c.casinoWinOpen(true).id,'chestFx');
 /* and the Change Character button still goes through it */
 assert.match(game,/\$\('charSelBtn'\)\.onclick=async\(\)=>\{if\(hcNoFlee\(\)\|\|sceneHoldsTravel\(\)\|\|casinoRoundOpen\(\)\)return;/);
});

test('the page behind a casino window, the duel or a chest reel is inert while one is up, and only what was made inert is let go',()=>{
 const d=dom(),watched=[];
 const behind=['header','questcard','p-hero','p-bag','nav'].map(d.$),stage=['game','cfgBox','stagemsg','cfgBtn'].map(d.$);
 d.$('stageWrap').children=stage;
 const foreign=d.$('p-bag');foreign.inert=true; /* made inert by someone else before any table opened */
 class MutationObserver{constructor(fn){this.fn=fn;}observe(el,opt){watched.push([el.id,opt.attributes,opt.attributeFilter.join(',')]);}}
 const body=d.$('body');
 const c=vm.createContext({$:d.$,MutationObserver,document:{body,querySelectorAll:sel=>{assert.equal(sel,'#app>header,#questcard,#app>.panel,#app>nav');return behind;}}});
 /* the fake classList has no toggle; the page's does */
 body.classList.toggle=(n,on)=>{if(on)body.classList.add(n);else body.classList.remove(n);return on;};
 vm.runInContext(section('function casinoWinOpen(chest){','/* Esc and the pad')+section('let casinoInert=[];',"$('charSelBtn').onclick="),c);
 assert.deepEqual(watched.map(w=>w[0]),[...TABLES,'gvbFx','chestFx'],'one observer on every window');
 assert.ok(watched.every(w=>w[1]===true&&w[2]==='class,style'),'on their class and style');
 c.casinoInertSync();
 assert.ok([...behind,...stage].every(e=>e.inert===(e===foreign)),'nothing open, nothing new inert');
 assert.equal(body.classList.contains('casinoup'),false,'and the stage\'s messages stay where they were');
 for(const open of [()=>d.$('slotFx').classList.add('open'),()=>d.$('gvbFx').style.display='flex',()=>d.$('chestFx').classList.add('open')]){
  open();c.casinoInertSync();
  assert.ok(behind.every(e=>e.inert),'header, quest card, panels and nav');
  assert.deepEqual(stage.map(e=>e.inert),[true,false,true,true],'the stage, all but Settings - it may stand above a table');
  assert.equal(body.classList.contains('casinoup'),true,'a message is drawn above the window');
  d.$('slotFx').classList.remove('open');d.$('gvbFx').style.display='none';d.$('chestFx').classList.remove('open');
  c.casinoInertSync();
  assert.ok([...behind,...stage].every(e=>e.inert===(e===foreign)),'the last window closed: let go, but not what someone else made inert');
  assert.equal(body.classList.contains('casinoup'),false,'and messages go back under the side panel');
 }
});

/* the global keydown handler, run for real with the pad's Back and the casino helpers */
function keyboard(){
 const calls=[],prevented=[];
 const listeners={};
 const {c,d}=padPieces({window:{addEventListener:(ev,fn)=>{listeners[ev]=fn;}},document:{activeElement:{tagName:'BODY',blur(){}}},
  HeroGuide:{isOpen:()=>false},initAudio(){},gameOn:true,gamePaused:false,S:{name:'Alpha'},hero:{dead:false},world:{},keys:{},
  TideUI:{storageOpen:()=>false,modalOpen:()=>false,isBattling:()=>false},treeUI:{isOpen:()=>false},   /* 🌳 the Skill Tree window, closed */
  openSettings:()=>calls.push('openSettings'),toggleMount:()=>calls.push('toggleMount'),toggleSide:()=>calls.push('toggleSide'),
  usePot:k=>calls.push('usePot '+k),cast:i=>calls.push('cast '+i),nearestEnemyWithin:()=>null,stageMsg:m=>calls.push('msg '+m),
  setInputMode(){},stopMining(){},zoneOf:()=>({}),buildMode:false,fbSignIn(){},raidCommanding:()=>false});
 vm.runInContext(section("window.addEventListener('keydown',e=>{","window.addEventListener('keyup',e=>{"),c);
 const press=(key,repeat=false)=>listeners.keydown({key,repeat,preventDefault:()=>prevented.push(key)});
 return {c,d,calls,prevented,press};
}

test('Esc over a casino window is its Back, as B is; Settings opens from the world, and over a chest reel',()=>{
 const cases=[[()=>{},[],['openSettings']],
  [d=>d.$('bjFx').classList.add('open'),['bjClose'],[]],
  [d=>d.$('rtbFx').classList.add('open'),['rtbClose'],[]],
  [d=>d.$('casinoMenu').classList.add('open'),['casinoMenuClose'],[]],
  [d=>d.$('sebbeFx').classList.add('open'),['sebbeClose'],[]],
  [d=>{d.$('gvbFx').style.display='flex';},['gvbLeave'],[]],
  [d=>{d.$('gvbFx').style.display='flex';d.$('confirmFx').style.display='flex';},['cfNo'],[]], /* the confirm on top answers first */
  [d=>{d.$('casinoMenu').classList.add('open');d.$('cfgBox').classList.add('open');},['cfgClose'],[]], /* Settings already up above a table */
  [d=>d.$('chestFx').classList.add('open'),[],['openSettings']]];
 for(const [setup,clicks,calls] of cases){
  const k=keyboard();setup(k.d);
  k.press('Escape');
  assert.deepEqual(k.d.clicks,clicks);assert.deepEqual(k.calls,calls);assert.deepEqual(k.prevented,['Escape']);
  /* the key held down: its repeats press nothing more - a held Esc that closed a table does not open Settings after it */
  k.press('Escape',true);
  assert.deepEqual(k.d.clicks,clicks);assert.deepEqual(k.calls,calls);
 }
});

test('keys under a casino window or a chest reel walk, drink, cast and hide nothing; with none up they still do',()=>{
 const keys=['d','w','a','s','ArrowUp','ArrowLeft','1','2','3','4','5','e','b','x',' '];
 for(const id of ['slotFx','rtbFx','sebbeFx','gvbFx','chestFx']){
  const k=keyboard();
  if(id==='gvbFx')k.d.$(id).style.display='flex';else k.d.$(id).classList.add('open');
  for(const key of keys)k.press(key);
  assert.deepEqual(k.calls,[],id);assert.deepEqual({...k.c.keys},{},id);
  assert.deepEqual(k.prevented,['ArrowUp','ArrowLeft',' '],'no page scroll - and with no button focused, Space presses nothing (a focused one: casino-r2-shared)');
 }
 const k=keyboard();
 for(const key of keys)k.press(key);
 assert.equal(k.c.keys.d,true);
 assert.deepEqual(k.calls,['cast 0','cast 1','cast 2','usePot hp','usePot mp','msg No foe nearby','toggleSide','toggleMount']);
});

test('the pad\'s Start over a casino window is its Back; in the world and over a chest reel it opens Settings',()=>{
 const tick=section('function padTick(dt){',' const host=padPanelOpen();')+'}';
 const run=setup=>{
  const calls=[];
  const {c,d}=padPieces({padPollButtons(){},padHit:{start:true},initAudio(){},HeroGuide:{isOpen:()=>false},openSettings:()=>calls.push('openSettings')});
  vm.runInContext(tick,c);setup(d);c.padTick(0.016);
  return {clicks:d.clicks,calls};
 };
 assert.deepEqual(run(()=>{}),{clicks:[],calls:['openSettings']});
 assert.deepEqual(run(d=>d.$('bjFx').classList.add('open')),{clicks:['bjClose'],calls:[]},'Start, Up, A mid-hand can no longer reach Exit game');
 assert.deepEqual(run(d=>{d.$('gvbFx').style.display='flex';}),{clicks:['gvbLeave'],calls:[]});
 assert.deepEqual(run(d=>d.$('chestFx').classList.add('open')),{clicks:[],calls:['openSettings']});
});

test('Settings is drawn above the tables, so the pad answers it before them; it opens from the world only',()=>{
 const {c,d}=padPieces();
 d.$('cfgBox').classList.add('open');d.$('iceReqMsg').style.display='block';d.$('rtbFx').classList.add('open');
 assert.equal(c.padPanelOpen().id,'cfgBox','Settings (78) stands above the ice message (74) and every table');
 d.$('outfitFx').style.display='flex';assert.equal(c.padPanelOpen().id,'outfitFx','the outfit offer (96) is still above it');
 d.$('confirmFx').style.display='flex';assert.equal(c.padPanelOpen().id,'confirmFx');
 /* openSettings for real: over a casino window it does nothing (Esc and Start are that window's Back) */
 const e=dom(),focus=[];
 const s=vm.createContext({$:e.$,casinoWinOpen:()=>e.$('bjFx').classList.contains('open')?e.$('bjFx'):null,closeSettings:()=>e.$('cfgBox').classList.remove('open'),
  document:{activeElement:null,querySelector:()=>({focus:()=>focus.push('tab')})},initAudio(){},syncAudioUI(){},displaySettings:{sync(){}},renderControls(){},keys:{},holdMove:null});
 vm.runInContext(section('const openSettings=()=>{','\n};')+'\n};globalThis.openSettings=openSettings;',s);
 e.$('bjFx').classList.add('open');s.openSettings();
 assert.equal(e.$('cfgBox').classList.contains('open'),false);
 e.$('bjFx').classList.remove('open');s.openSettings();
 assert.equal(e.$('cfgBox').classList.contains('open'),true);assert.deepEqual(focus,['tab']);
 /* a held Esc opens or closes Settings once: its repeats neither close it again nor open it after a table closed */
 assert.match(game,/\$\('cfgBox'\)\.addEventListener\('keydown',e=>\{\n e\.stopPropagation\(\);\n if\(e\.key==='Escape'\)\{e\.preventDefault\(\);if\(!e\.repeat\)closeSettings\(\);return;\}/);
 assert.match(section("if(kl==='escape'&&gameOn){ /* ⚙ Esc is the settings key.",' }\n'),/if\(!e\.repeat\)openSettings\(\);/);
});

test('a casino window keeps the hero still, and a key held under a chest reel walks nobody (the fight goes on there)',()=>{
 const gate=game.slice(game.indexOf('}else if(!hallSceneHolds()&&!mountRide.casting'),game.indexOf('/* 🎮 the left stick walks.'));
 assert.match(gate,/^\}else if\(!hallSceneHolds\(\)&&!mountRide\.casting&&!TideUI\.modalOpen\(\)&&!casinoWinOpen\(\)&&\$\('stableFx'\)/);
 assert.match(gate,/let ky=[^\n]*\n  if\(\$\('chestFx'\)\.classList\.contains\('open'\)\)\{kx=0;ky=0;\}/);
 assert.match(game,/if\(padNow&&padPanelOpen\(\)\)padNow=null;/,'the stick\'s own rule, which the keys now match');
});

test('Settings and a table\'s messages are drawn above every casino window; the side panel and the menu screens still cover a message',()=>{
 const z=sel=>{const m=css.match(new RegExp(sel.replace(/[#.]/g,'\\$&')+'\\{[^}]*?z-index:(\\d+)'));assert.ok(m,sel);return +m[1];};
 const inline=id=>+html.match(new RegExp(`id="${id}" style="[^"]*z-index:(\\d+)`))[1];
 const tables=[z('#casinoMenu'),z('#slotFx'),z('#seaFx'),z('#bjFx'),z('#rouFx'),z('#rtbFx'),z('#sebbeFx'),z('#chestFx'),inline('gvbFx')];
 const top=Math.max(...tables),cfg=z('#cfgBox'),msg=z('#stagemsg');
 assert.equal(top,76,'the duel is the highest casino window');
 assert.ok(msg>top,'a refusal said by stageMsg is seen above the table');
 assert.ok(cfg>top,'Settings can never open hidden under a table');
 assert.ok(cfg>msg,'and a message does not cross the Settings box');
 assert.ok(cfg<+game.match(/ov\.id='confirmFx';\n ov\.style\.cssText='[^']*z-index:(\d+)/)[1],'the confirm box stays above Settings');
 /* raised only while a casino window is up (casinoInertSync sets body.casinoup): the narrow layout's side panel (z 20) covered
    the stage's messages before, and still does with no window up */
 assert.match(css,/\n  body\.casinoup #stagemsg\{z-index:77\}\n/);
 assert.doesNotMatch(css,/(^|\n)\s*#stagemsg\{[^}]*z-index/,'no unscoped z-index on the message');
 assert.ok(z('.panel')<msg,'the panel it may cover while a window is up');
 assert.match(css,/body:has\(#login\.open\) #stagemsg,body:has\(#select\.open\) #stagemsg,body:has\(#create\.open\) #stagemsg\{z-index:auto\}/);
});

test('the casino track plays for the menu games only: Sebbe keeps the City\'s sound, the Final Gate is no casino',()=>{
 const d=dom(),played=[];
 class Audio{constructor(src){this.src=src;this.paused=true;played.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const zone={paused:true,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const c=vm.createContext({$:d.$,Audio,AC:{},ambVol:()=>0.5,applyVolumes(){},gameOn:true,audioPaused:false,zoneOf:()=>({}),
  ambAudio:zone,cowAudio:null,odinAudio:null,cryptAudio:null,finalAudio:null});
 vm.runInContext(section('let casinoAudio=null;','function openCasinoMenu(){')+';globalThis.track=()=>casinoAudio;',c);
 assert.match(section('function casinoAmbApply(){','\n}'),/\['casinoMenu','slotFx','seaFx','bjFx','rouFx','rtbFx'\]\.some/);
 for(const id of ['sebbeFx','finalGateFx']){
  d.$(id).classList.add('open');c.casinoAmbApply();
  assert.ok(!c.track()||c.track().paused,id+' starts no casino track');assert.equal(zone.paused,false,id+' leaves the zone its own');
  d.$(id).classList.remove('open');
 }
 for(const open of [()=>d.$('slotFx').classList.add('open'),()=>{d.$('gvbFx').style.display='flex';}]){
  open();c.casinoAmbApply();
  assert.equal(c.track().paused,false);assert.equal(zone.paused,true,'the zone ducks under it');
  d.$('slotFx').classList.remove('open');d.$('gvbFx').style.display='none';c.casinoAmbApply();
  assert.equal(c.track().paused,true);assert.equal(zone.paused,false,'and comes back when the window closes');
 }
});

test('the casino menu says what the games do',()=>{
 const menu=html.slice(html.indexOf('<div id="casinoMenu">'),html.indexOf('id="casinoMenuClose"'));
 const line=game=>(menu.match(new RegExp(`data-game="${game}"[^\\n]*?<i>([^<]*)</i>`))||[])[1];
 /* the lines this review rewrote; the others belong to their games and are only asked to be there */
 assert.equal(line('sea'),'Hold &amp; respin - locking reels, chase free spins','the player locks nothing: the reels lock themselves');
 assert.equal(line('rtb'),'Four guesses - every card pays its odds');
 assert.match(line('gvb'),/winner takes every stake/,'a duel seats up to ten: the winner takes every stake, not one loser\'s');
 assert.doesNotMatch(line('gvb'),/loser's stake/);
 for(const g of ['slots','bj','rou'])assert.ok(line(g),g+' has its line');
 assert.ok(!/[åäöÅÄÖ]/.test(menu),'English-friendly names');
});
