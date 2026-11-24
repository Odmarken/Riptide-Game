/* The hero hand-over part of the 2026-11-24 bug review (runtime sweep): what a hero leaves behind when he is put away.
 * 1. A Cow Run outlived its hero. A kick from another device (showLogin) dropped S with the run on and its cards on screen:
 *    the next hero to enter took a card and it was applied to HIM - his weapon became the run's blade, and was saved. The
 *    run's summary stood over the hero list with Run again live. Both roads out and a hero entering now put the run away.
 * 2. A crossing survived a kick: the Black Tide made port with whoever entered next aboard.
 * 3. The Bank's window read S once a second, hero or no hero: a TypeError every second on the sign-in screen.
 * 4. The sign-in's teardown was the short one: Settings, the Bank, the Smith, the rename box (prefilled with the last hero's
 *    name) and a dozen more stayed up over the sign-in screen and the next hero's world. One teardown now, heroPutAway,
 *    for the hero list, the sign-in and a hero deleted under the player - and a hero is put away while S is still his.
 * The teardown and the three screens that call it run for real in a vm, on a small DOM. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const fn=head=>section(head,'\n}')+'\n}';
const TEARDOWN=section('const HERO_BOXES=','function showLogin(');   /* the two lists, cowRunPutAway, heroPutAway */

/* a world with a hero in it: S, a DOM of windows by id, and everything the teardown calls, each writing down who S was */
function world(){
 const nodes=new Map(),calls=[],bodyClasses=new Set(),panels=[];
 const classList=set=>({add:(...n)=>n.forEach(x=>set.add(x)),remove:(...n)=>n.forEach(x=>set.delete(x)),contains:n=>set.has(n)});
 const element=id=>{const classes=new Set();return {id,style:{display:''},textContent:'',classList:classList(classes),onclick:null,setAttribute(){},remove(){nodes.delete(id);}};};
 const make=id=>{const e=element(id);nodes.set(id,e);return e;};
 const who=()=>c.S?c.S.name:null,note=n=>calls.push(n+' as '+who());
 const c=vm.createContext({console,calls,
  S:{id:'h1',name:'Alfa'},gameOn:true,gamePaused:false,audioPaused:false,scenePause:false,ritualActive:false,ritualArmor:null,pendingDelRect:null,voyage:null,CR:null,TEST_ROSTER:null,
  $:id=>nodes.get(id)||null,document:{body:{classList:classList(bodyClasses)},querySelectorAll:()=>panels},
  mp:{on:false},gvb:{ref:null},AC:{ctx:null,prof:'world'},FB:{user:{uid:'u1'},pushDirty:true},memChars:{h1:'{}'},
  closeCasinoWindows:()=>note('closeCasinoWindows'),
  cowRunEnd:r=>{note('cowRunEnd '+r);if(c.CR&&c.CR.owner)delete c.CR.owner.cowRunStash;c.CR=null;},   /* the Cow Run's own: only called here */
  cowPickClose:()=>{const o=nodes.get('cowPickOv');if(o)o.remove();},
  spotStamp:()=>note('spotStamp'),dropFarmBuild:()=>note('dropFarmBuild'),cancelHallScenes:()=>note('cancelHallScenes'),setCinematic:on=>calls.push('cinematic '+on),
  mpLeave:()=>{note('mpLeave');c.mp.on=false;},dismissHeroGuide(){},TideUI:{leaveZone:()=>note('leaveZone')},stopFishing:()=>calls.push('stopFishing'),
  updateMountButton:()=>note('updateMountButton'),closeSettings:()=>{note('closeSettings');nodes.get('cfgBox').classList.remove('open');},
  enchCeremonyEnd:()=>calls.push('enchCeremonyEnd'),treeUI:{close:()=>calls.push('treeUI.close')},closeFinalGate:()=>calls.push('closeFinalGate'),
  stopAmbience:()=>calls.push('stopAmbience'),parkDirtyHero:()=>note('parkDirtyHero'),gvbLeaveForSwitch(){},saveSnapshot:()=>({...c.S}),
  updateAcctUI(){},renderSelect:()=>calls.push('renderSelect'),
  saveRoster:async ids=>calls.push('saveRoster '+ids.join()),loadRoster:async()=>['h1','h2'],deviceDelete:async()=>{}});
 vm.runInContext(TEARDOWN+fn('function showLogin(')+fn('function showSelect(){')+fn('async function removeDeletedLocal(uid,id){')
  +';this.lists={HERO_BOXES,HERO_WINDOWS};',c);
 for(const id of [...c.lists.HERO_WINDOWS,'lbFx','lbClose','cfgBox','restFx','login','select','create','fbErr'])make(id);
 nodes.get('lbClose').onclick=()=>{calls.push('lbClose');nodes.get('lbFx').classList.remove('open');};
 return {c,calls,nodes,make,bodyClasses,panels};
}
/* everything a hero can have up, at once: a Cow Run with its cards, a crossing, windows of every kind, boxes built in script */
function busy(w){
 const {c,make,nodes,bodyClasses,panels}=w;
 const stash={gear:{weapon:{name:'Frostseeker',atk:111169}},lvl:60};
 c.S.cowRunStash=stash;c.CR={owner:c.S,stash,cards:[{kind:'legend',id:'frostseeker'}]};
 bodyClasses.add('cowrun');make('cowPickOv');make('cowKit');
 c.voyage={d:{id:'ravenholt',zone:37},phase:'sail',name:'Alfa'};
 c.pendingDelRect={x0:0,y0:0,x1:900,y1:900};
 c.mp.on=true;c.AC.ctx={};
 for(const id of ['bankFx','smithFx','ledgerFx','stableFx','farmDelFx','sharkFx','mpLobby','outfitFx'])nodes.get(id).style.display='flex';
 nodes.get('ritualBox').style.display='block';
 c.gamePaused=c.scenePause=true;   /* the shark's box holds the game */
 for(const id of ['lbFx','cfgBox','restFx'])nodes.get(id).classList.add('open');
 for(const id of ['confirmFx','renameOv','prestigeConfirm','hcConfirm','hcDeathOv','cityWonFx'])make(id);
 const p={classList:{open:true,remove(){this.open=false;}}};panels.push(p);
 return p;
}
function assertPutAway(w,panel){
 const {c,nodes,bodyClasses,calls}=w;
 assert.equal(c.CR,null,'no run');
 assert.equal(nodes.has('cowPickOv'),false,'no cards, no summary');
 assert.equal(nodes.has('cowKit'),false,'no kit');
 assert.equal(bodyClasses.has('cowrun'),false,'the header is its own again');
 assert.equal(c.voyage,null,'no crossing');
 assert.equal(c.pendingDelRect,null,'no pieces waiting on a Yes');
 assert.equal(c.mp.on,false,'no raid room');
 assert.equal(c.gamePaused,false,'the pause went with the box that held it');
 for(const id of c.lists.HERO_WINDOWS)assert.equal(nodes.get(id).style.display,'none',id+' closed');
 for(const id of c.lists.HERO_BOXES)assert.equal(nodes.has(id),false,id+' off the page');
 for(const id of ['lbFx','cfgBox','restFx'])assert.equal(nodes.get(id).classList.contains('open'),false,id+' closed');
 for(const n of ['lbClose','enchCeremonyEnd','treeUI.close','closeFinalGate','stopFishing','cinematic false','stopAmbience'])assert.ok(calls.includes(n),n);
 assert.equal(c.AC.prof,null,'the next zone starts its own sound');
 assert.equal(panel.classList.open,false,'side pages shut');
}

test('a kick (showLogin) puts the hero away whole, while S is still his: the run ended as quit before he is dropped',()=>{
 const w=world(),p=busy(w),{c,calls,nodes}=w;
 const hero=c.S;
 c.showLogin('kicked');
 assertPutAway(w,p);
 assert.equal(c.S,null);assert.equal(c.gameOn,false);
 assert.equal(nodes.get('login').classList.contains('open'),true);
 assert.equal(nodes.get('fbErr').textContent,'kicked');
 assert.deepEqual(calls.slice(0,2),['closeCasinoWindows as Alfa','cowRunEnd quit as Alfa'],'the tables first, then the run - both for the hero who is leaving');
 assert.equal('cowRunStash' in hero,false,'he is put back as he walked in');
 for(const n of ['spotStamp','dropFarmBuild','cancelHallScenes','mpLeave','leaveZone','updateMountButton','closeSettings'])assert.ok(calls.includes(n+' as Alfa'),n+' while S is the hero');
 assert.equal(calls.some(x=>/ as null$/.test(x)),false,'nothing of the teardown ran after the hero was dropped');
 assert.equal(calls.includes('parkDirtyHero as Alfa'),false,'a kicked session parks nothing: it may not write');
});

test('the hero list (showSelect) makes the same teardown, keeps the hero, and parks his save',()=>{
 const w=world(),p=busy(w),{c,calls,nodes}=w;
 c.TEST_ROSTER=new Map([['h1','{}']]);c.S.test=true;
 c.showSelect();
 assertPutAway(w,p);
 assert.equal(c.S.name,'Alfa');assert.equal(c.gameOn,false);
 assert.equal(nodes.get('select').classList.contains('open'),true);
 assert.deepEqual(calls.slice(0,2),['closeCasinoWindows as Alfa','cowRunEnd quit as Alfa']);
 assert.ok(calls.includes('parkDirtyHero as Alfa'));
 assert.equal(JSON.parse(c.TEST_ROSTER.get('h1')).name,'Alfa','the hero test keeps the hero as he was put back');
 assert.ok(calls.indexOf('cowRunEnd quit as Alfa')<calls.indexOf('parkDirtyHero as Alfa'));
 assert.equal(calls[calls.length-1],'renderSelect');
 /* the two screens are the casino line and the one helper: no second list to drift */
 for(const head of ['function showSelect(){','function showLogin(']){
  const body=fn(head);
  assert.match(body,/\{\n closeCasinoWindows\(\);[^\n]*\n heroPutAway\(\);/,head);
  for(const moved of ['spotStamp(','dropFarmBuild(','cancelHallScenes(','mpLeave(','TideUI.leaveZone(','cowRunEnd(','stopAmbience('])assert.equal(body.includes(moved),false,head+' has no '+moved+' of its own');
 }
});

test('the summary of a run that is over goes too: no Run again over the hero list or the sign-in',()=>{
 for(const road of ['showSelect','showLogin']){
  const w=world(),{c,calls,nodes,make}=w;
  make('cowPickOv').dataset={results:'1'};   /* cowResultsShow's box: the run has ended, CR is null, nothing is stashed */
  c[road]('');
  assert.equal(nodes.has('cowPickOv'),false,road);
  assert.equal(calls.some(x=>x.startsWith('cowRunEnd')),false,'no run to end');
 }
});

test('a hero entering finds no Cow Run of somebody else: beginGame puts it away before the world is built',()=>{
 const begin=section('function beginGame(isNew){','/* Effects were written as');
 assert.match(begin,/^function beginGame\(isNew\)\{\n if\(casinoWinOpen\(true\)\)closeCasinoWindows\(\);[^\n]*\n dropFarmBuild\(\);cancelHallScenes\(\);\n cowRunPutAway\(\);/);
 assert.ok(begin.indexOf('cowRunPutAway()')<begin.indexOf('buildZone()'));
 /* a run whose owner is not the hero now loaded (the kick's leftover): ended as quit for its owner, its cards closed */
 const w=world(),{c,calls,nodes,make,bodyClasses}=w;
 const gone={name:'Alfa',cowRunStash:{}};
 c.CR={owner:gone,stash:gone.cowRunStash};c.S={id:'h2',name:'Beta'};
 bodyClasses.add('cowrun');make('cowPickOv');make('cowKit');
 vm.runInContext('cowRunPutAway()',c);
 assert.deepEqual(calls,['cowRunEnd quit as Beta']);
 assert.equal(c.CR,null);assert.equal('cowRunStash' in gone,false);
 assert.equal(nodes.has('cowPickOv')||nodes.has('cowKit')||bodyClasses.has('cowrun'),false);
 /* nothing up: nothing asked for */
 const q=world();vm.runInContext('cowRunPutAway()',q.c);assert.deepEqual(q.calls,[]);
});

test('the teardown asks for no hero: the sign-in at start-up, and the hero list after a hero was dropped',()=>{
 const w=world(),{c,calls,nodes}=w;
 c.S=null;c.gameOn=false;
 c.showLogin();
 assert.equal(nodes.get('login').classList.contains('open'),true);
 assert.equal(calls.some(x=>x.startsWith('cowRunEnd')||x.startsWith('updateMountButton')||x.startsWith('closeSettings')||x==='lbClose'),false,'nothing is up, nothing is pressed');
 c.showSelect();
 assert.equal(nodes.get('select').classList.contains('open'),true);
});

test('a hero deleted under the player is put away while S is still his, then dropped, then the hero list',async()=>{
 let w=world(),p=busy(w),{c,calls}=w;
 await c.removeDeletedLocal('u1','h1');
 assertPutAway(w,p);
 assert.equal(c.S,null);assert.equal(c.gameOn,false);assert.equal(c.FB.pushDirty,false);
 assert.deepEqual(calls.slice(0,2),['closeCasinoWindows as Alfa','cowRunEnd quit as Alfa']);
 const dropped=calls.indexOf('closeCasinoWindows as null');
 assert.ok(dropped>0&&calls.indexOf('dropFarmBuild as Alfa')<dropped,'the build tools are put down before the hero list runs with no hero');
 assert.ok(calls.includes('renderSelect')&&calls.includes('saveRoster h2'));
 assert.equal('h1' in c.memChars,false);
 /* on the hero list already: no teardown to make, but no run may be left either */
 w=world();({c,calls}=w);c.gameOn=false;c.CR={owner:c.S,stash:{}};c.S.cowRunStash=c.CR.stash;
 await c.removeDeletedLocal('u1','h1');
 assert.equal(c.S,null);assert.equal(c.CR,null);
 assert.deepEqual(calls.filter(x=>!x.startsWith('saveRoster')),['cowRunEnd quit as Alfa']);
 /* another hero, another account: untouched */
 w=world();({c,calls}=w);
 await c.removeDeletedLocal('u1','h2');assert.equal(c.S.name,'Alfa');assert.equal(c.gameOn,true);
 await c.removeDeletedLocal('u2','h1');assert.equal(c.S.name,'Alfa');
});

test('a kick goes through showLogin, and so does signing out; kickSession still stops the world first',()=>{
 const kick=fn('function kickSession(){');
 assert.match(kick,/gameOn=false;[\s\S]*showLogin\(/);
 assert.match(game,/\$\('fbOut'\)\.onclick=async\(\)=>\{[^\n]*showLogin\(\);\};/);
});

test('no window reads the hero once a second when there is none: the Bank, the Smelter, the Smith, the wheel',()=>{
 assert.match(game,/\nsetInterval\(\(\)=>\{if\(S&&\$\('bankFx'\)\.style\.display==='flex'\)bankRefresh\(\);\},1000\);/);
 /* the Bank's tick for real: open, no hero - bankRefresh (which reads S.bankGold) is not called */
 const line=game.slice(game.indexOf("setInterval(()=>{if(S&&$('bankFx')"));
 const tick=line.slice(line.indexOf('()=>'),line.indexOf(',1000)'));
 const seen=[],c=vm.createContext({S:null,$:()=>({style:{display:'flex'}}),bankRefresh:()=>seen.push(1)});
 const f=vm.runInContext('('+tick+')',c);
 f();assert.deepEqual(seen,[]);
 c.S={bankGold:5};f();assert.deepEqual(seen,[1]);
 /* the others were safe already - pinned so they stay so */
 assert.match(game,/\nconst smeltLeft=\(\)=>S&&S\.smelt\?/);
 assert.match(section('function smeltTick(){','\n}'),/\n if\(!S\|\|!S\.smelt\)return false;/);
 assert.match(section('function smithRefresh(){','\n}'),/^function smithRefresh\(\)\{\n if\(!S\)return;/);
 assert.match(game,/\nsetInterval\(\(\)=>\{if\(S&&\$\('restFx'\)\.classList\.contains\('open'\)\)updateRestUI\(\);\},1000\);/);
});

test('every window the pad knows is somebody\'s to close when the hero is put away',()=>{
 const src=section('const PAD_PANELS=[','];').replace(/\/\*[\s\S]*?\*\//g,'');
 const pad=vm.runInNewContext(src.slice(src.indexOf('['))+']');
 const lists=vm.runInNewContext(TEARDOWN.slice(0,TEARDOWN.indexOf('function cowRunPutAway('))+';({HERO_BOXES,HERO_WINDOWS})',{});
 const put=fn('function heroPutAway(){');
 const elsewhere={
  casino:['sebbeFx','gvbFx','rtbFx','rouFx','bjFx','fiveDealFx','fiveFx','seaBuyFx','seaFx','slotFx','casinoMenu','chestFx'],   /* closeCasinoWindows, called first by both screens */
  tides:['tideHub','tideBattleFx'],          /* TideUI.leaveZone */
  cow:['cowPickOv'],                         /* cowRunPutAway -> cowPickClose */
  scene:['ritualFx'],                        /* cancelHallScenes; the Altar's dark heals itself when S is not its owner */
  inner:['smithMenu'],                       /* inside #smithFx */
  screens:['create','select','login']};
 const own={enchCraftFx:'enchCeremonyEnd()',treeFx:'treeUI.close()',finalGateFx:'closeFinalGate()',cfgBox:'closeSettings()',restFx:"$('restFx').classList.remove('open')",lbFx:"$('lbClose').onclick()"};
 for(const [id,line] of Object.entries(own))assert.ok(put.includes(line),id+' has its own line: '+line);
 assert.ok(put.includes('TideUI.leaveZone()')&&put.includes('cancelHallScenes()')&&put.includes('cowRunPutAway()'));
 const known=new Set([...lists.HERO_BOXES,...lists.HERO_WINDOWS,...Object.keys(own),...Object.values(elsewhere).flat()]);
 assert.ok(pad.length>50&&pad.includes('bankFx')&&pad.includes('login'),'the pad\'s list was read');
 assert.equal(pad.filter(id=>!known.has(id)).join(),'','a new window joins HERO_WINDOWS or HERO_BOXES (game.js, THE HERO IS PUT AWAY), or gets a line of its own');
 /* a box built in script is never merely hidden (a hidden #cowPickOv would freeze the world), a window of the page never removed */
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 for(const id of lists.HERO_WINDOWS)assert.ok(html.includes('id="'+id+'"'),id+' is on the page');
 for(const id of lists.HERO_BOXES){assert.equal(html.includes('id="'+id+'"'),false,id+' is built in script');assert.ok(game.includes("id='"+id+"'"),id+' is built in game.js');}
});
