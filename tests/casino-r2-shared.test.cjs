/* The casino's shared seams and save durability, round 2 (casino review, 2026-09-30): the pad's A presses only what is drawn,
 * Space presses a focused button in a casino window, a save made while a push is on its way is not marked sent, the desktop
 * shell writes the saves to disk after a save (at most once a second), signing out closes the tables before the cloud goes,
 * and a clock set back can neither re-open the Moonshine Inn wheel nor lock it for more than a day.
 * The real code runs in a vm, cut from game.js, main.js and preload.js; only the DOM, the clock and the cloud are fakes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const flush=()=>new Promise(r=>setImmediate(r));

/* a DOM small enough to reason about: elements with a parent, shown or not (a hidden ancestor hides them, as display:none
   does), disabled or not. click() on a disabled button does nothing, as in the browser. */
function dom(){
 const nodes=new Map(),order=[],clicks=[];
 function element(id,{parent=null,tag='BUTTON',shown=true,disabled=false}={}){
  const cls=new Set();
  const e={id,tagName:tag,parent,shown,disabled,style:{display:''},
   classList:{add:(...n)=>n.forEach(x=>cls.add(x)),remove:(...n)=>n.forEach(x=>cls.delete(x)),contains:n=>cls.has(n)},
   visible(){for(let x=e;x;x=x.parent){if(!x.shown&&!x.classList.contains('open')&&x.style.display!=='flex'&&x.style.display!=='block')return false;}return true;},
   getClientRects(){return e.visible()?[{}]:[];},
   get offsetParent(){return e.visible()?{}:null;},
   contains(x){for(;x;x=x.parent)if(x===e)return true;return false;},
   querySelectorAll(){return order.filter(x=>x!==e&&e.contains(x)&&x.tagName==='BUTTON');},
   querySelector(){return null;},
   click(){if(!e.disabled)clicks.push(id);},
   scrollIntoView(){}};
  nodes.set(id,e);order.push(e);return e;
 }
 const $=id=>nodes.get(id)||element(id,{tag:'DIV',shown:false});
 const document={activeElement:null,querySelectorAll:sel=>{assert.equal(sel,'.padfocus');return order.filter(x=>x.classList.contains('padfocus'));}};
 return {$,element,clicks,document,nodes};
}

/* the pad: the real padItems/padMark/padMenuStep, padAdjustRange and padTick, over one open panel */
function pad(d,host){
 const c=vm.createContext({$:d.$,document:d.document,padPollButtons(){},initAudio(){},padHit:{},padPanelOpen:()=>host,padBack(){},
  casinoBack:()=>false,openSettings(){},Event:class{constructor(t){this.type=t;}}});
 vm.runInContext(section('let padFocus=null;','function padAdjustRange(')+section('function padAdjustRange(','/* ---------- what an A press means in the world')
  +section('function padTick(dt){',' if(padFocus)padMark(null);')+'}\nglobalThis.focus=()=>padFocus;globalThis.setFocus=e=>{padFocus=e;};',c);
 const press=()=>{c.padHit={a:true};c.padTick(0.016);c.padHit={};};
 return {c,press,focus:()=>c.focus()};
}

test('the pad\'s A presses only what is drawn: a highlight left on a hidden button is neither pressed nor moved',()=>{
 /* the duel: A on Create Room hid the entry screen, the highlight stayed on Create, and the next A made a second room */
 let d=dom();
 const duel=d.element('gvbFx',{tag:'DIV'});
 const entry=d.element('gvbEntry',{tag:'DIV',parent:duel});d.element('gvbCreate',{parent:entry});d.element('gvbJoin',{parent:entry});
 const lobby=d.element('gvbLobby',{tag:'DIV',parent:duel});d.element('gvbReady',{parent:lobby});d.element('gvbStart',{parent:lobby,shown:false});
 d.element('gvbLeave',{parent:duel});
 let p=pad(d,duel);
 p.c.setFocus(d.$('gvbCreate'));entry.shown=false;
 p.press();p.press();
 assert.deepEqual(d.clicks,[],'two A press nothing: not the hidden Create, and not a control the highlight was moved to');
 assert.equal(p.focus(),d.$('gvbCreate'),'and the highlight stays put: moved to the first control shown, the next A pressed that');
 /* the d-pad walks on from it: down to the first control shown, up to the last */
 p.c.padHit={down:true};p.c.padTick(0.016);p.c.padHit={};
 assert.equal(p.focus(),d.$('gvbReady'));assert.ok(d.$('gvbReady').classList.contains('padfocus'));
 p.press();assert.deepEqual(d.clicks,['gvbReady'],'and A presses what the player sees');
 p.c.setFocus(d.$('gvbCreate'));p.c.padHit={up:true};p.c.padTick(0.016);p.c.padHit={};
 assert.equal(p.focus(),d.$('gvbLeave'));
 /* the host's START, hidden when the table went to the stakes: mashed A reaches neither it nor '5 rounds', the first control
    of the stakes screen - pressed, it put the table on 5 rounds and cleared every lock */
 d=dom();
 const table=d.element('gvbFx',{tag:'DIV'});
 const lob=d.element('gvbLobby',{tag:'DIV',parent:table});const start=d.element('gvbStart',{parent:lob});
 const bet=d.element('gvbBet',{tag:'DIV',parent:table});
 for(const id of ['gvbR5','gvbR10','500000','gvbBetLock'])d.element(id,{parent:bet});
 d.element('gvbLeave',{parent:table});
 p=pad(d,table);p.c.setFocus(start);lob.shown=false;
 for(let i=0;i<4;i++)p.press();
 assert.deepEqual(d.clicks,[]);assert.equal(p.focus(),start);
 /* the duel's Open, hidden while the chests turn and on the rival's turn, with Leave the only control shown. Moved there, the
    A meant for Open on your next turn pressed Leave, and two more A forfeited the stake. Now it waits for Open to show */
 d=dom();
 const room=d.element('gvbFx',{tag:'DIV'});
 const roll=d.element('gvbDuel',{tag:'DIV',parent:room});const open=d.element('gvbOpen',{parent:roll});
 d.element('gvbLeave',{parent:room});
 p=pad(d,room);p.c.setFocus(open);open.shown=false;
 for(let i=0;i<3;i++)p.press();
 assert.deepEqual(d.clicks,[],'no Leave, so no forfeit');assert.equal(p.focus(),open);
 open.shown=true;p.press();
 assert.deepEqual(d.clicks,['gvbOpen'],'your turn: the next A opens your round');
 /* a chest: A arms Scrap, A scraps it and it hides. Two more A turned Auto spin on (the first control) and spent 5,000 a chest */
 d=dom();
 const chest=d.element('chestFx',{tag:'DIV'});
 d.element('caseAutoBtn',{parent:chest});d.element('respinBtn',{parent:chest});
 const scrap=d.element('caseScrapBtn',{parent:chest});d.element('caseClose',{parent:chest});
 p=pad(d,chest);p.c.setFocus(scrap);scrap.shown=false;
 for(let i=0;i<3;i++)p.press();
 assert.deepEqual(d.clicks,[],'no Auto spin');assert.equal(p.focus(),scrap);
 /* Slots: the Extra Spin box answered and gone, the highlight on its NO */
 d=dom();
 const sea=d.element('seaFx',{tag:'DIV'});d.element('seaSpinBtn',{parent:sea});d.element('seaAutoBtn',{parent:sea});
 const box=d.element('seaBuyFx',{tag:'DIV',parent:sea});d.element('seaBuyYes',{parent:box});d.element('seaBuyNo',{parent:box});
 p=pad(d,sea);p.c.setFocus(d.$('seaBuyNo'));box.shown=false;
 p.press();assert.deepEqual(d.clicks,[]);assert.equal(p.focus(),d.$('seaBuyNo'));
 /* no highlight at all (a window just opened): the first A shows it on the first control, as before, and presses nothing */
 p.c.setFocus(null);p.press();assert.equal(p.focus(),d.$('seaSpinBtn'));assert.deepEqual(d.clicks,[]);
 /* nothing shown to walk to: A and the d-pad do nothing */
 d=dom();const empty=d.element('restFx',{tag:'DIV'});const gone=d.element('restSpinBtn',{parent:empty,shown:false});
 p=pad(d,empty);p.c.setFocus(gone);p.press();p.c.padHit={down:true};p.c.padTick(0.016);
 assert.equal(p.focus(),gone);assert.deepEqual(d.clicks,[]);
});

test('a disabled control keeps the highlight: mashing A mid-spin or mid-deal turns on no Auto and draws no card',()=>{
 for(const [win,busy,next] of [['slotFx','slotSpinBtn','slotAutoBtn'],['bjFx','bjDeal','bjHit'],['rouFx','rouSpinBtn','rouClose']]){
  const d=dom(),host=d.element(win,{tag:'DIV'});
  d.element(busy,{parent:host,disabled:true});d.element(next,{parent:host});
  const p=pad(d,host);p.c.setFocus(d.$(busy));
  for(let i=0;i<4;i++)p.press();
  assert.equal(p.focus(),d.$(busy),win+': the highlight stays on the busy button');
  assert.deepEqual(d.clicks,[],win+': nothing else was pressed ('+next+')');
  d.$(busy).disabled=false;p.press();
  assert.deepEqual(d.clicks,[busy],win+': once it is free again, A presses it');
 }
 /* the source says the same, for anyone reading it rather than running it */
 assert.match(section('function padTick(dt){',' if(padFocus)padMark(null);'),
  /if\(!padFocus\)padMenuStep\(host,1\);\n   else if\(padFocus\.getClientRects\(\)\.length\)padFocus\.click\(\);\n  \}/);
});

/* the global keydown handler, run for real with the real casino helpers and the pad's panel finder */
function keyboard(){
 const d=dom(),calls=[],prevented=[],listeners={},keys={};
 const c=vm.createContext({$:d.$,document:d.document,window:{addEventListener:(ev,fn)=>{listeners[ev]=fn;}},
  getComputedStyle:()=>({visibility:'visible'}),initAudio(){},gameOn:true,gamePaused:false,S:{name:'Alpha'},hero:{dead:false},world:{},keys,
  TideUI:{storageOpen:()=>false,modalOpen:()=>false,isBattling:()=>false},casinoBack:()=>{calls.push('back');return true;},
  openSettings:()=>calls.push('openSettings'),toggleMount:()=>calls.push('toggleMount'),toggleSide:()=>calls.push('toggleSide'),
  usePot:k=>calls.push('usePot '+k),cast:i=>calls.push('cast '+i),nearestEnemyWithin:()=>null,stageMsg:m=>calls.push('msg '+m),
  setInputMode(){},stopMining(){},zoneOf:()=>({}),buildMode:false,fbSignIn(){}});
 vm.runInContext(section('const PAD_PANELS=','let padFocus=null;')+section('function casinoWinOpen(chest){','/* Esc and the pad')
  +section("window.addEventListener('keydown',e=>{","window.addEventListener('keyup',e=>{"),c);
 const press=(key,repeat=false)=>listeners.keydown({key,repeat,preventDefault:()=>prevented.push(key)});
 d.$('login');
 return {c,d,calls,prevented,press,keys};
}

test('Space presses the focused button of a casino window (or of the box on it); elsewhere it still dances and scrolls nothing',()=>{
 /* a Blackjack table with Deal focused: the browser presses it on release - the handler only has to let it */
 let k=keyboard();
 const bj=k.d.element('bjFx',{tag:'DIV',shown:false});bj.classList.add('open');
 const deal=k.d.element('bjDeal',{parent:bj});
 k.d.document.activeElement=deal;
 k.press(' ');k.press(' ',true);
 assert.deepEqual(k.prevented,[],'Space on a focused table button is the browser\'s: pressed on release, once');
 assert.deepEqual({...k.keys},{},'and the hero behind the table does not dance');assert.deepEqual(k.calls,[]);
 k.press('ArrowDown');assert.deepEqual(k.prevented,['ArrowDown'],'arrows still scroll nothing');
 /* nothing focused, a hidden button, or a button that is not the window's: stopped, as before */
 k.d.document.activeElement={tagName:'BODY'};k.press(' ');
 const hidden=k.d.element('bjHidden',{parent:bj,shown:false});k.d.document.activeElement=hidden;k.press(' ');
 k.d.document.activeElement=k.d.element('charSelBtn');k.press(' ');
 assert.deepEqual(k.prevented,['ArrowDown',' ',' ',' ']);
 /* the duel, with the Leave confirm drawn on it: its focused Cancel answers Space too */
 k=keyboard();
 const duel=k.d.element('gvbFx',{tag:'DIV',shown:false});duel.style.display='flex';
 const confirm=k.d.element('confirmFx',{tag:'DIV',shown:false});confirm.style.display='flex';
 k.d.document.activeElement=k.d.element('cfNo',{parent:confirm});
 k.press(' ');assert.deepEqual(k.prevented,[]);
 /* a chest reel's buttons too */
 k=keyboard();
 const chest=k.d.element('chestFx',{tag:'DIV',shown:false});chest.classList.add('open');
 k.d.document.activeElement=k.d.element('caseSpinBtn',{parent:chest});k.press(' ');assert.deepEqual(k.prevented,[]);
 /* the world: Space is the dance, and it presses no button - a nav button that kept focus was fired by it */
 k=keyboard();
 k.d.document.activeElement=k.d.element('navHero');
 k.press(' ');
 assert.deepEqual(k.prevented,[' ']);assert.equal(k.keys[' '],true,'hold Space to bust a move');
});

/* the save code, cut whole from game.js: flushCloud, flushDisk, saveSnapshot, save, saveNow */
function saves({desktop}={}){
 const clock={t:1_000_000,perf:0},timers=[],pushes=[],answers=[],device=[],order=[];
 const c=vm.createContext({
  Date:{now:()=>clock.t},performance:{now:()=>clock.perf},
  setTimeout:(fn,ms)=>{const t={at:clock.perf+ms,fn};timers.push(t);return timers.length;},clearTimeout(){},
  window:desktop?{desktop}:{},
  FB:{ready:true,user:{uid:'u1'},kicked:false,pushDirty:false,lastPush:0},S:null,ZONES:[{}],CITY_ZONE:0,
  heroDeleted:()=>false,memChars:{},publishLB(){},
  deviceSet:async(k,v)=>{device.push(JSON.parse(v));order.push('device');},
  cloudPushChar:ch=>{pushes.push(JSON.parse(JSON.stringify(ch)));order.push('push');return new Promise(r=>answers.push(r));}});
 vm.runInContext(section('const FB_PUSH_MS=','\nsetInterval(()=>{ /* trailing flush'),c);
 const advance=ms=>{clock.t+=ms;clock.perf+=ms;for(;;){const due=timers.filter(t=>t.at<=clock.perf).sort((a,b)=>a.at-b.at)[0];if(!due)break;timers.splice(timers.indexOf(due),1);due.fn();}};
 return {c,clock,pushes,answers,device,order,advance};
}

test('a save made while a push is on its way keeps the flag, and goes up with the next push - no push is added otherwise',async()=>{
 const s=saves();
 s.c.S={id:'a',name:'Alpha',gold:400000,rev:12,zone:0};
 await s.c.save();                                   /* the first save of a session goes up at once */
 assert.equal(s.pushes.length,1);assert.equal(s.pushes[0].rev,13);assert.equal(s.c.FB.pushDirty,true);
 s.advance(300);
 s.c.S.gold-=300000;await s.c.save();                /* a stake, 0.3 s into that push: saved here, not sent */
 assert.equal(s.c.S.rev,14);assert.equal(s.pushes.length,1,'the throttle holds: no second push');
 s.answers[0](true);await flush();
 assert.equal(s.c.FB.pushDirty,true,'the push that came back did not carry the stake: the flag stays');
 assert.equal(s.pushes[0].gold,400000,'it went up as the hero was when it started - the copy is taken then');
 /* the trailing flush's minute later: the stake goes up, and this time the flag is cleared */
 s.advance(61000);s.c.flushCloud();
 assert.equal(s.pushes.length,2);assert.equal(s.pushes[1].rev,14);assert.equal(s.pushes[1].gold,100000);
 s.answers[1](true);await flush();
 assert.equal(s.c.FB.pushDirty,false);
 /* a push with no save behind it clears the flag at once: one push, nothing more */
 s.advance(61000);s.c.S.gold+=5;await s.c.save();
 assert.equal(s.pushes.length,3);s.answers[2](true);await flush();
 assert.equal(s.c.FB.pushDirty,false);
 /* a failed push keeps it, as before */
 s.advance(61000);s.c.S.gold+=5;await s.c.save();s.answers[3](false);await flush();
 assert.equal(s.c.FB.pushDirty,true);
});

test('saveNow sends this save as saved; a save while it is on its way, or another hero, keeps the flag',async()=>{
 const s=saves();
 s.c.S={id:'a',name:'Alpha',gold:1000,rev:3,zone:0};
 const now=s.c.saveNow();await flush();
 assert.equal(s.pushes.length,1);assert.equal(s.pushes[0].rev,4);
 s.c.S.gold=0;await s.c.save();                      /* made while saveNow's push is out */
 s.answers[0](true);await now;
 assert.equal(s.c.FB.pushDirty,true,'the later save is still to go up');
 /* no save in between: cleared */
 s.advance(61000);s.c.flushCloud();s.answers[1](true);await flush();
 assert.equal(s.c.FB.pushDirty,false);
 const again=s.c.saveNow();await flush();s.answers[2](true);await again;
 assert.equal(s.c.FB.pushDirty,false);
 /* the hero was put away while the push was out and another one saved: his flag is not the old push's to clear */
 const p=s.c.saveNow();await flush();
 s.c.S={id:'b',name:'Bravo',gold:5,rev:1,zone:0};s.c.FB.pushDirty=false;s.advance(10);await s.c.save();
 assert.equal(s.c.FB.pushDirty,true);
 s.answers[3](true);await p;
 assert.equal(s.c.FB.pushDirty,true,'Bravo\'s save still goes up');
});

test('the desktop shell writes the saves to disk after the device write, at most once a second; the web build asks nothing',async()=>{
 const flushes=[];
 const s=saves({desktop:{flushStorage:()=>{flushes.push(0);return Promise.resolve(true);}}});
 const at=[];s.c.window.desktop.flushStorage=()=>{at.push(s.clock.perf);s.order.push('disk');return Promise.resolve(true);};
 s.c.FB.user=null; /* signed out: only the disk matters here */
 s.c.S={id:'a',name:'Alpha',gold:1000,rev:1,zone:0};
 await s.c.save();
 assert.deepEqual(s.order,['device','disk'],'the stake is written to disk right after the device write');
 s.advance(300);s.c.S.gold--;await s.c.save();
 s.advance(300);s.c.S.gold--;await s.c.save();
 assert.deepEqual(at,[0],'inside the second: booked, not sent');
 s.advance(400);
 assert.deepEqual(at,[0,1000],'and sent at the end of it, carrying both saves');
 s.advance(1500);s.c.S.gold--;await s.c.save();
 assert.deepEqual(at,[0,1000,2500],'a quiet second: at once');
 /* Lucky 7 on Auto and faster: a save every 100 ms for 3 s */
 const before=at.length;
 for(let i=0;i<30;i++){s.advance(100);s.c.S.gold--;await s.c.save();}
 const lastSave=s.clock.perf;s.advance(1000);
 for(let i=1;i<at.length;i++)assert.ok(at[i]-at[i-1]>=1000,'never twice in a second: '+at.join(','));
 assert.ok(at[at.length-1]>=lastSave,'the last save of a burst is written at the end of its second');
 assert.ok(at.length-before<=4,'30 saves in 3 s, '+(at.length-before)+' flushes');
 /* an unchanged hero saves nothing, so asks nothing */
 const n=at.length;s.advance(5000);await s.c.save();s.advance(2000);assert.equal(at.length,n);
 /* saveNow asks too */
 await s.c.saveNow();assert.equal(at.length,n+1);
 /* a shell that refuses or throws never fails the save */
 s.advance(2000);s.c.window.desktop.flushStorage=()=>Promise.reject(new Error('No handler registered for storage:flush'));
 s.c.S.gold--;await s.c.save();
 s.advance(2000);s.c.window.desktop.flushStorage=()=>{throw new Error('gone');};
 s.c.S.gold--;await s.c.save();assert.equal(s.device.at(-1).gold,s.c.S.gold);
 /* the web build: no shell, and an older one without the call */
 for(const desktop of [undefined,{quit(){}}]){
  const w=saves({desktop});w.c.FB.user=null;w.c.S={id:'a',name:'Alpha',gold:1,rev:1,zone:0};
  await w.c.save();await w.c.saveNow();assert.deepEqual(w.order,['device','device']);
 }
});

/* the desktop shell and its bridge, run for real with a fake Electron */
test('main.js answers storage:flush by flushing the asking page\'s session; preload.js exposes it as desktop.flushStorage',async()=>{
 const handlers=new Map(),logged=[];
 const app={isPackaged:true,getPath:()=>path.join(root,'dist','.flush-test-profile'),commandLine:{appendSwitch(){}},
  whenReady:()=>({then(){}}),requestSingleInstanceLock:()=>true,quit(){},on(){}};
 const electron={app,BrowserWindow:class{static getAllWindows(){return [];}},shell:{openExternal(){}},Menu:{setApplicationMenu(){}},
  ipcMain:{handle(name,fn){handlers.set(name,fn);}},screen:{}};
 const memoryFs={existsSync:()=>false,readFileSync:()=>'{}',writeFileSync(){},statSync:()=>({size:0}),appendFileSync:(f,m)=>logged.push(String(m))};
 vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),{__dirname:root,
  require:n=>({electron,path,fs:memoryFs})[n]||assert.fail('unexpected dependency '+n),
  process:{argv:[],platform:'win32',on(){}},setImmediate(){},setTimeout(){}},{filename:'main.js'});
 assert.ok(handlers.has('storage:flush'));
 let flushed=0;
 assert.equal(handlers.get('storage:flush')({sender:{session:{flushStorageData:()=>{flushed++;}}}}),true);
 assert.equal(flushed,1,'the sender\'s own session - the game\'s localStorage');
 const broken={sender:{session:{flushStorageData:()=>{throw new Error('session gone');}}}};
 assert.equal(handlers.get('storage:flush')(broken),false);assert.equal(handlers.get('storage:flush')(broken),false);
 assert.equal(logged.filter(l=>/storage flush/.test(l)).length,1,'a failure is logged once, not once a second');
 /* the bridge */
 let api=null;const invoked=[];
 vm.runInNewContext(fs.readFileSync(path.join(root,'preload.js'),'utf8'),{require:n=>{assert.equal(n,'electron');
  return {contextBridge:{exposeInMainWorld:(name,o)=>{assert.equal(name,'desktop');api=o;}},ipcRenderer:{invoke:(...a)=>{invoked.push(a);return Promise.resolve(true);},on(){}}};}});
 assert.equal(typeof api.flushStorage,'function');
 assert.equal(await api.flushStorage(),true);assert.deepEqual(invoked,[['storage:flush']]);
 /* and the page calls it only through flushDisk, from save() and saveNow() */
 assert.equal((game.match(/flushStorage\(/g)||[]).length,1);
 assert.equal((game.match(/\n flushDisk\(\);/g)||[]).length,2);
});

test('signing out closes the casino windows first, while S is the hero and the cloud still takes the duel\'s writes',async()=>{
 const line=game.match(/\n\$\('fbOut'\)\.onclick=async\(\)=>\{[^\n]*/)[0];
 const seen=[];
 const btn={};
 const c=vm.createContext({$:()=>btn,S:{name:'Alpha'},sessUnsub:()=>seen.push('unlisten'),
  FB:{user:{uid:'u1'},auth:{signOut:async()=>{seen.push('signOut');}}},
  closeCasinoWindows:()=>seen.push('close '+(c.S&&c.S.name)+' user '+(c.FB.user?'in':'out')),
  showLogin:()=>{seen.push('showLogin');c.S=null;}});
 vm.runInContext(line,c);
 await btn.onclick();
 assert.deepEqual(seen,['close Alpha user in','unlisten','signOut','showLogin']);
 /* showSelect and showLogin still close them first too */
 assert.match(section('function showSelect(){','\n}'),/^function showSelect\(\)\{\n closeCasinoWindows\(\);/);
 assert.match(section('function showLogin(','\n}'),/^function showLogin\(msg=''\)\{\n closeCasinoWindows\(\);/);
});

test('the Moonshine Inn wheel: a clock set back re-opens nothing, and never locks or reads more than a day',()=>{
 const T0=Date.parse('2026-09-30T12:00:00Z'),clock={t:T0};
 const c=vm.createContext({Date:{now:()=>clock.t},S:null});
 vm.runInContext('globalThis.rested=s=>{'+section(' if(s.restedT===undefined)s.restedT=0;',' if(s.freeGoldCases===undefined)')+'return s;};'
  +section('const REST_CD=86400;','function drawRestWheel(rot){')+'globalThis.left=()=>restCdLeft();globalThis.CD=REST_CD;',c);
 const H=3600000;
 /* spun now; the clock is put back a minute and the game reloaded (or the hero picked again from the list): still a day */
 let s=c.rested({restedT:3600,restedPct:0.1,restedSpinAt:T0});
 clock.t=T0-60000;s=c.rested(JSON.parse(JSON.stringify(s)));c.S=s;
 assert.equal(s.restedSpinAt,clock.t,'the wait starts again from now - it used to be reset to 0, a free spin');
 assert.equal(c.left(),c.CD,'locked for a day, not open');
 /* the loop the exploit was: each reload a minute further back - never open */
 for(let i=2;i<=6;i++){clock.t=T0-i*60000;c.S=s=c.rested(JSON.parse(JSON.stringify(s)));assert.ok(c.left()>c.CD-1,'rewind '+i);}
 /* a day after the last rewind was seen, it opens - once */
 clock.t+=24*H;assert.equal(c.left(),0);
 /* set back mid-session, no reload: it read "Next Rested in 48h" and held that long. Now a day at most, and it counts down */
 c.S={restedSpinAt:clock.t};clock.t-=24*H;
 assert.equal(c.left(),c.CD);assert.equal(c.S.restedSpinAt,clock.t);
 clock.t+=12*H;assert.equal(c.left(),c.CD/2);
 clock.t+=12*H;assert.equal(c.left(),0,'24 h after the rewind was seen');
 /* an honest clock is untouched: the lock counts down from the spin */
 c.S={restedSpinAt:clock.t};clock.t+=6*H;assert.equal(c.left(),c.CD*0.75);
 s=c.rested({restedSpinAt:clock.t-H});assert.equal(s.restedSpinAt,clock.t-H,'a spin in the past is left alone');
 s=c.rested({});assert.equal(s.restedSpinAt,0,'no spin yet: open');
 /* the label shows the same number */
 const res={innerHTML:'',textContent:''},btn={disabled:false,textContent:''};
 const u=vm.createContext({Date:{now:()=>clock.t},S:{restedSpinAt:clock.t+48*H},$:id=>id==='restRes'?res:btn,restSpinning:false});
 vm.runInContext(section('const REST_CD=86400;','function drawRestWheel(rot){').replace('let restSpinning=false,','let ')+section('function updateRestUI(){','/* live countdown'),u);
 u.updateRestUI();
 assert.match(res.innerHTML,/Next Rested in 24h 0m/);assert.equal(btn.disabled,true);
});

test('Settings is drawn above the inn wheel, so Esc and the pad\'s Start show it on top and the pad drives what is seen',()=>{
 const z=sel=>{const m=css.match(new RegExp(sel.replace(/[#.]/g,'\\$&')+'\\{[^}]*?z-index:(\\d+)'));assert.ok(m,sel);return +m[1];};
 assert.ok(z('#cfgBox')>z('#restFx'),'at the same 72 the wheel, later in the page, was drawn over Settings');
 const PAD=section('const PAD_PANELS=','const padPanelOpen=');
 assert.ok(PAD.indexOf("'cfgBox'")<PAD.indexOf("'restFx'"),'the pad answers Settings before the wheel under it');
});
