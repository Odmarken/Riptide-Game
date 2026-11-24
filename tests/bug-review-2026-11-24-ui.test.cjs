/* Run with: node --test tests/bug-review-2026-11-24-ui.test.cjs
 * The UI / translation / input fixes of the 2026-11-24 bug review:
 *  1. a pause a scene holds (the raid lobby, the Altar's blackout, the shark's box) is not Space's or the pause button's to flip
 *  2. a hero's or a player's name is never translated, whatever word it is - and the same word as a label still is
 *  3. Esc / Start during the Cow Run's cards does not open Settings under them
 *  4. the translation layer's HTML answers are kept by size as well as by count
 *  5. which window is up (padPanelOpen) is asked once a frame, and again the moment the page changes under it
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js'),core=read('assets/i18n/i18n-core.js'),rt=read('assets/i18n/i18n.js');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const LANGS=['zh','ru','es','de','it','pt'];

/* the translation layer in a bare context, with a language's real dictionary (or a small one) */
function load(lang,dict){
 const noop=()=>{},cls=()=>function(){};
 const Element=cls(),Node=cls(),Document=cls(),HTMLElement=cls(),HTMLInputElement=cls(),Canvas=cls();
 const prop=(P,k)=>Object.defineProperty(P,k,{get(){return this['_'+k]||'';},set(v){this['_'+k]=v;},configurable:true});
 prop(Element.prototype,'innerHTML');prop(Node.prototype,'textContent');prop(HTMLElement.prototype,'title');prop(HTMLInputElement.prototype,'placeholder');
 Document.prototype.createTextNode=s=>({data:s});Element.prototype.setAttribute=noop;Element.prototype.insertAdjacentHTML=noop;
 const drawn=[];
 Canvas.prototype.fillText=function(t){drawn.push(t);};Canvas.prototype.strokeText=noop;Canvas.prototype.measureText=()=>({width:0});
 /* a <template> that keeps what it is given and has nothing to walk: enough for the HTML door's own bookkeeping */
 const document={documentElement:{classList:{add:noop,remove:noop},lang:''},write:noop,addEventListener:noop,readyState:'loading',
  createElement:()=>({content:{nodeType:11,childNodes:[]}})};
 const c={document,navigator:{languages:['sv-SE']},location:{search:'?lang='+lang,href:'http://x/?lang='+lang},localStorage:{getItem:()=>null,setItem:noop},
  URLSearchParams,URL,Element,Node,Document,HTMLElement,HTMLInputElement,CanvasRenderingContext2D:Canvas,console,performance};
 c.window=c;vm.createContext(c);
 vm.runInContext(core,c);vm.runInContext(rt,c);
 if(dict)c.I18N.data(lang,dict);else if(lang!=='en')vm.runInContext(read('assets/i18n/'+lang+'.js'),c);
 return {I:c.I18N,draw:t=>{new Canvas().fillText(t,0,0);return drawn.pop();}};
}

test('a pause a scene holds is not the player\'s to flip, and the scene hands back what the player had chosen', () => {
 const down=section(" if(kl===' '&&gameOn&&S&&!$('cfgBox')?.classList.contains('open')){"," if(kl==='h'&&gameOn&&S){");
 const up=section("window.addEventListener('keyup',e=>{","window.addEventListener('pointerdown',initAudio");
 const mus=section("$('musBtn').onclick=()=>{","let mapsPreloaded");
 const els={},msgs=[],audio=[];
 const el=id=>els[id]||(els[id]={id,classList:{contains:()=>false,toggle(){}},dataset:{},setAttribute(){},style:{},click(){this.onclick&&this.onclick();}});
 const c={$:el,keys:{},gameOn:true,S:{id:'c1'},HeroGuide:{isOpen:()=>false},initAudio(){},AC:{ctx:{suspend:()=>audio.push('off'),resume:()=>audio.push('on')}},
  cowAudio:null,odinAudio:null,cryptAudio:null,finalAudio:null,ambAudio:null,zoneOf:()=>({}),hero:{dead:false},stageMsg:t=>msgs.push(t),Date,handlers:{}};
 c.window={addEventListener(t,f){c.handlers[t]=f;}};
 vm.createContext(c);
 vm.runInContext('var gamePaused=false,audioPaused=false,scenePause=false;'+mus+'\n'+up+'\nfunction spaceDown(e){const kl=" ";'+down+'}',c);
 const tap=()=>{c.spaceDown({preventDefault(){},repeat:false});c.handlers.keyup({key:' '});};
 const st=()=>vm.runInContext('gamePaused+"/"+audioPaused+"/"+scenePause',c);
 const run=s=>vm.runInContext(s,c);
 /* the scenes say so, in the source: the lobby, the ritual, the shark - and each way out hands the player's own choice back */
 assert.match(game,/mpTravelTo\(pendingRaidZone\);raidAutoOff\(\);gamePaused=scenePause=true;/);
 assert.match(game,/\$\('ritualBox'\)\.style\.display='none';\n gamePaused=scenePause=true;/);
 assert.match(game,/\$\('sharkFx'\)\.style\.display='flex';\n\s+gamePaused=scenePause=true;/);
 assert.match(game,/mp\.started=true;scenePause=false;gamePaused=audioPaused;/);
 assert.equal(game.split('mp.on=false;mp.started=false;scenePause=false;gamePaused=audioPaused;').length-1,2,'leaving the lobby, both ways');
 assert.match(game,/if\(S!==owner\)\{ritualActive=false;scenePause=false;gamePaused=audioPaused;return;\}/);
 assert.match(game,/\$\('ritualDoneFx'\)\.style\.display='none';\n scenePause=false;gamePaused=audioPaused;/);
 assert.match(game,/\$\('sharkOk'\)\.onclick=\(\)=>\{\$\('sharkFx'\)\.style\.display='none';scenePause=false;gamePaused=audioPaused;\};/);
 /* in the world Space pauses and goes on, as it did */
 tap();assert.equal(st(),'true/true/false');assert.equal(msgs.pop(),'Game paused');
 tap();assert.equal(st(),'false/false/false');assert.equal(msgs.pop(),'Game resumed');
 /* the lobby: any number of taps, the raid stays held, the sound stays on, nothing is said */
 run('gamePaused=scenePause=true');audio.length=0;
 tap();tap();tap();
 assert.equal(st(),'true/false/true','two taps used to run the raid behind the lobby');
 assert.deepEqual(msgs,[]);assert.deepEqual(audio,[],'and one tap used to leave the raid without sound');
 run('scenePause=false;gamePaused=audioPaused;');   /* the host starts */
 assert.equal(st(),'false/false/false','the raid runs, the button and the sound in step with it');
 tap();assert.equal(st(),'true/true/false','and Space is the player\'s again');tap();
 /* paused by the player before the scene took the game: the sound may come back, the scene keeps its hold, and the end is in step */
 tap();run('gamePaused=scenePause=true');assert.equal(st(),'true/true/true');
 tap();assert.equal(st(),'true/false/true','the sound back on, the scene still holding');
 tap();assert.equal(st(),'true/false/true');
 run('scenePause=false;gamePaused=audioPaused;');assert.equal(st(),'false/false/false');
 tap();run('gamePaused=scenePause=true');run('scenePause=false;gamePaused=audioPaused;');
 assert.equal(st(),'true/true/false','left paused through a scene: still paused after it, button and game alike');tap();
 /* a scene ended by another way (the hero put away over the shark\'s box) leaves no dead button behind */
 run('gamePaused=scenePause=true');run('gamePaused=false');
 tap();assert.equal(st(),'true/true/false');tap();assert.equal(st(),'false/false/false');
});

test('a marked name goes through every door as written, in all six languages - and the same word as a label is still translated', () => {
 for(const lang of LANGS){
  const {I,draw}=load(lang),N=I.name;
  const hunter=I.text('Hunter'),max=I.text('Max'),king=I.text('King');   /* the labels, asked for (and remembered) before any name is shown */
  assert.notEqual(hunter,'Hunter',lang+': the class is a word of the game');
  for(const n of ['Hunter','Max','King','Dragon','Queen','Home','Close','Yes','Bjorn']){
   assert.equal(draw(N(n)),n,lang+': over the hero\'s head');
   assert.equal(draw('👑 '+N(n)),'👑 '+n,lang+': crowned');
   assert.equal(I.text('⏳ '+N(n)),'⏳ '+n,lang+': a lobby row');
   assert.equal(I.text('→ '+N(n)+'!'),'→ '+n+'!',lang+': the lord turns on him');
   const w=I.text('Welcome back, '+N(n)+'.');
   assert.ok(w.includes(n)&&!w.includes(n+'..')&&!/[-]/.test(w)&&w!=='Welcome back, '+n+'.',lang+': the line is translated round the name: '+w);
   const t=I.text(N(n)+' - Human Hunter · Prestige 3');
   assert.ok(t.startsWith(n+' - ')&&t.includes(hunter),lang+': the name kept, the class beside it translated: '+t);
   assert.equal(I.html('<div class="cn">'+N(n)+'<span class="pstar">x</span></div>'),'<div class="cn">'+n+'<span class="pstar">x</span></div>',lang+': the HTML door takes the marks off');
  }
  const d=I.text('Duke '+N('Max'));assert.ok(d.endsWith('Max')&&!d.startsWith('Duke'),lang+': a title before a marked name is still a word: '+d);
  assert.equal(I.text('Hunter'),hunter,lang+': the class label');assert.equal(I.text('Max'),max,lang+': the Max button');assert.equal(draw('King'),king,lang+': order does not matter');
  assert.equal(I.text(N('Max (1840)')),'Max (1840)',lang+': a name with its rating');
  assert.equal(I.text('stray'),'stray',lang+': a mark or a stand-in that is no name never reaches the screen');
 }
 const {I}=load('en');
 assert.equal(I.name('Max'),'Max','English: nothing to guard, nothing added');
});

test('the hero playing is known to the layer: his name stays as written in lines nobody marked, and leaves with him', () => {
 for(const lang of LANGS){
  const {I}=load(lang);
  const hunter=I.text('Hunter'),king=I.text('King');
  const before=I.text('Welcome back, Hunter.');assert.ok(before.includes(hunter),lang+': without the guard the name is translated: '+before);
  let who='Max';I.protect(()=>who);
  const a=I.text('Welcome back, Max.');assert.ok(a.endsWith('Max.')||a.endsWith('Max。'),lang+': '+a);assert.ok(!a.includes('Max..'),lang);
  const k=I.text('👑 King Max');assert.ok(k.endsWith('Max')&&k.includes(king),lang+': the title translated, the name kept: '+k);
  const g=I.text('Max - Human Hunter · Prestige 10');assert.ok(g.startsWith('Max - ')&&g.includes(hunter),lang+': '+g);
  assert.equal(I.sizes().names,1);
  who='Hunter';   /* another hero is loaded: the answers worked out for the last one are forgotten at once, in any order */
  const b=I.text('Welcome back, Hunter.');assert.ok(b.includes('Hunter')&&b!==before,lang+': '+b);
  assert.ok(I.text('Hunter will not rise again.').includes('Hunter'),lang);
  assert.equal(I.text('Hunter'),hunter,lang+': a bare word nobody marked is a label, and is translated');
  who=['Hunter (1840)'];assert.ok(I.text('Welcome back, Hunter.').includes('Hunter'),lang+': the rating is not the name');
  who='';assert.equal(I.text('Welcome back, Hunter.'),before,lang+': nobody about - the line as before');
  assert.equal(I.sizes().names,0,lang+': and no name left behind');
  who=Array.from({length:500},(_,i)=>'Hero'+String.fromCharCode(65+i%26)+String.fromCharCode(97+(i>>5)%26));I.text('x'+lang);
  assert.ok(I.sizes().names<=64,'a long list is cut short');
 }
});

test('the game marks the names it shows and says who is playing', () => {
 assert.match(game,/const shown=\(S\.city&&S\.city\.crowned\?'👑 ':''\)\+\(S\.name\?\(typeof I18N!=='undefined'\?I18N\.name\(S\.name\):S\.name\):'Hero'\);/,'the hero\'s own name over his head');
 assert.match(section('function drawHeroLike(','\n}'),/const nameShown=name\?\(typeof I18N!=='undefined'\?I18N\.name\(name\):name\):'Hero';[^\n]*\n[^\n]*fillText\(nameShown,1,[^\n]*fillText\(nameShown,0,/,'a player\'s name over his');
 assert.match(section('function mpLobbyRender(){','\n}'),/I18N\.name\(esc\(mp\.peers\[k\]\.name\)\)/,'the lobby\'s rows');
 assert.match(game,/floatAt\(en\.x,en\.y-en\.r-30,'→ '\+\(typeof I18N!=='undefined'\?I18N\.name\(nm\):nm\)\+'!'/,'the lord\'s new target');
 assert.match(game,/\$\('heroTitle'\)\.innerHTML=[^\n]*esc\(typeof I18N!=='undefined'\?I18N\.name\(dispName\(S\)\):dispName\(S\)\)\} - /,'the Hero page');
 assert.match(game,/<div class="cn">\$\{e\.title\?esc\(e\.title\)\+' ':''\}\$\{esc\(typeof I18N!=='undefined'\?I18N\.name\(e\.name\|\|'\?'\):\(e\.name\|\|'\?'\)\)\}/,'the leaderboard: the title is a word, the name is not');
 assert.match(game,/<div class="cn">\$\{esc\(typeof I18N!=='undefined'\?I18N\.name\(dispName\(ch\)\):dispName\(ch\)\)\}/,'the hero list');
 assert.match(game,/if\(window\.I18N&&I18N\.protect\)I18N\.protect\(\(\)=>S&&S\.name\|\|''\);/);
 assert.match(rt,/function trText\(s\)\{return typeof s==='string'&&s\.indexOf\(NM0\)>=0\?named\(s,trText0\):trText0\(s\);\}/,'the marks come off before any cache is asked');
});

test('Esc or Start during the Cow Run\'s cards opens no Settings under them; open already, it still closes', () => {
 const calls=[];let open=false,cards=true,casino=false;
 const c=vm.createContext({$:id=>({classList:{contains:()=>open,add:()=>{open=true;calls.push('open');}},setAttribute(){}}),
  closeSettings:()=>{open=false;calls.push('close');},casinoWinOpen:()=>casino,cowPickOpen:()=>cards,document:{activeElement:null,querySelector:()=>null},
  initAudio(){},syncAudioUI(){},displaySettings:{sync(){}},renderControls(){},keys:{w:true},holdMove:{}});
 vm.runInContext('let settingsReturnFocus=null;'+section('const openSettings=()=>{',"$('cfgBtn').onclick=openSettings;")+';globalThis.openSettings=openSettings;',c);
 c.openSettings();assert.deepEqual(calls,[],'the cards (or the run\'s last screen) are up: nothing opens');
 assert.equal(c.keys.w,true,'and the keys are left alone');
 open=true;c.openSettings();assert.deepEqual(calls,['close'],'Settings that was open when the cards came is closed by the same key');
 cards=false;c.openSettings();assert.deepEqual(calls,['close','open'],'no cards: as ever');
 assert.match(game,/if\(typeof cowPickOpen==='function'&&cowPickOpen\(\)\)return;/);
});

test('the HTML answers are kept by size as well as by count', () => {
 const {I}=load('de',{'Bag':'Tasche'});
 const page=(n,size)=>'<div>Bag '+n+'</div>'+'<i></i>'.repeat(size/7|0);
 /* a big page drawn anew each time (the Bag, every second): translated, never remembered */
 for(let i=0;i<50;i++)I.html(page(i,35000));
 assert.deepEqual([I.sizes().html,I.sizes().htmlChars],[0,0],'35,000 characters a time used to be kept twice, 4,000 times over');
 /* small ones are remembered, up to a room of three million characters - then the lot is let go */
 let top=0;
 for(let i=0;i<2000;i++){I.html(page(i,6000));top=Math.max(top,I.sizes().htmlChars);assert.ok(I.sizes().htmlChars<=3e6);}
 assert.ok(top>2.5e6&&I.sizes().html<300,'the room fills and empties: '+top);
 const one=page('x',200);I.html(one);const n=I.sizes().html;I.html(one);assert.equal(I.sizes().html,n,'the same page twice is one answer');
 for(let i=0;i<4100;i++)I.html('<b>Bag '+i+'</b>');
 assert.ok(I.sizes().html<=4001,'and the count still holds');
});

test('which window is up is asked once a frame - and again the moment the page changes under it', () => {
 const src=section('const PAD_PANELS=','let padFocus=null;');
 const ids=[...src.slice(0,src.indexOf('];')).replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
 function world(watch){
  let asked=0;const queue=[],micro=[],observed=new Set();
  const body={nodeType:1,parentNode:{nodeType:9},id:'body'};
  const els={};for(const id of ids)if(id!=='confirmFx')els[id]={id,nodeType:1,parentNode:body,open:false,getClientRects(){asked++;return this.open?[1]:[];}};
  class MO{constructor(f){this.f=f;}observe(n){observed.add(n);}takeRecords(){return queue.splice(0);}}
  const c=vm.createContext({$:id=>els[id]||null,getComputedStyle:()=>({visibility:'visible'}),document:{querySelector:()=>null},gameOn:true,world:{},
   ...(watch?{MutationObserver:MO,queueMicrotask:f=>micro.push(f)}:{})});
  vm.runInContext(src+';globalThis.padPanelOpen=padPanelOpen;',c);
  const change=n=>{if(observed.has(n))queue.push({target:n});};   /* what the browser's observer would note, synchronously */
  return {c,els,body,change,frameEnd:()=>{for(const f of micro.splice(0))f();},asked:()=>{const n=asked;asked=0;return n;},observed};
 }
 /* a bare page (the tests', an old engine): asked every time, as before */
 {const w=world(false);w.c.padPanelOpen();const one=w.asked();w.c.padPanelOpen();assert.equal(w.asked(),one);assert.ok(one>=ids.length-1);
  w.els.bankFx.open=true;assert.equal(w.c.padPanelOpen().id,'bankFx');}
 const w=world(true);
 assert.equal(w.c.padPanelOpen(),null);assert.ok(w.asked()>=ids.length-1,'the first asking of a frame looks at every window');
 for(let i=0;i<5;i++)assert.equal(w.c.padPanelOpen(),null);
 assert.equal(w.asked(),0,'padTick, the hints, update and the Tides in the same frame: no second look');
 assert.ok(w.observed.has(w.els.bankFx)&&w.observed.has(w.body),'every window and what it stands in is watched');
 /* this frame\'s A press opens the bank: the very next asking says so */
 w.els.bankFx.open=true;w.change(w.els.bankFx);
 assert.equal(w.c.padPanelOpen().id,'bankFx','a window opened mid-frame is the answer at once');
 w.asked();assert.equal(w.c.padPanelOpen().id,'bankFx');assert.equal(w.asked(),0);
 /* a box built in script and hung on the page (the confirm): the page\'s own change is the signal, and it is watched from then on */
 w.els.confirmFx={id:'confirmFx',nodeType:1,parentNode:w.body,open:true,getClientRects(){return this.open?[1]:[];}};w.change(w.body);
 assert.equal(w.c.padPanelOpen().id,'confirmFx');assert.ok(w.observed.has(w.els.confirmFx));
 w.els.confirmFx.open=false;w.change(w.els.confirmFx);
 assert.equal(w.c.padPanelOpen().id,'bankFx','closed again in the same frame: the window under it');
 /* the frame ends: the next one looks afresh, whatever the watch saw or missed */
 w.els.bankFx.open=false;assert.equal(w.c.padPanelOpen().id,'bankFx','(nothing told it - within the frame it keeps its answer)');
 w.frameEnd();assert.equal(w.c.padPanelOpen(),null,'a new frame never trusts the last one');
 assert.match(game,/return padPanelMemo\|\|padSideLayer\(\);/,'the side panel answers to the pad\'s own state: asked every time');
 assert.match(game,/if\(padNow&&padPanelOpen\(\)\)padNow=null;/);
});
