/* Run with: node --test tests/gpu-acceleration.test.cjs
 * 📱 GPU acceleration (asked for 2026-10-10: "kan man göra att effekt knappen i settings idag att den stänger av webGL? går det
 * och göra så man kan välja isåfall, men döp den till GPU acceleration"). The phone's Spell effects row became Settings > Video >
 * GPU acceleration: on (the default) the screen is WebGL as before; off it is the plain 2D canvas - every effect still there,
 * but no bloom, heat haze or light shafts. Shown on phones and tablets only (a computer is always WebGL). The switch works at
 * once: a fresh screen element takes the old one's place, keeps every listener, and the old GPU context is let go.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js'),html=read('index.html');
const D=require('../assets/ui/display-settings.js');

test('the setting: on unless switched off, a real true/false only, kept on the device, through Reset, and readable before the screen is made',()=>{
 assert.equal(D.normalize(null).gpu,true);assert.equal(D.normalize({gpu:false}).gpu,false);assert.equal(D.normalize({gpu:'no'}).gpu,true);
 const kept={},els={},doc={getElementById:id=>els[id]||(els[id]={checked:false,value:100,min:60,max:140,style:{setProperty(){}},setAttribute(){},addEventListener(t,f){this.on=f;}})};
 const storage={getItem:k=>kept[k]??null,setItem:(k,v)=>{kept[k]=v;}},told=[];
 assert.equal(D.load(storage).gpu,true,'nothing kept yet: on');
 D.create({doc,storage,onChange:v=>told.push(v.gpu)});
 assert.equal(els.gpuChk.checked,true,'the box shows it');assert.equal(told.at(-1),true,'the game hears it as soon as it is read');
 els.gpuChk.on({target:{checked:false}});
 assert.equal(told.at(-1),false,'the game is told');assert.equal(JSON.parse(kept[D.STORAGE_KEY]).gpu,false,'saved on the device');
 els.videoReset.on();assert.equal(told.at(-1),false,'Reset (brightness and contrast) leaves it');
 assert.equal(D.load(storage).gpu,false,'and the next start reads it before it makes the screen');
 assert.equal(D.load({getItem(){throw new Error('blocked');}}).gpu,true,'storage that will not answer: on');
 assert.equal(D.load(null).gpu,true);
});

test('the row: GPU acceleration under Weather, above Lighting quality, hidden until the game finds a phone or tablet',()=>{
 assert.ok(html.includes('<label class="cfgrow cfgchk" id="gpuRow" hidden><input type="checkbox" id="gpuChk" checked><span>GPU acceleration</span></label>'));
 assert.ok(html.indexOf('id="gpuRow"')>html.indexOf('id="weatherChk"')&&html.indexOf('id="gpuRow"')<html.indexOf('id="lightQRow"'),'where Spell effects was');
 assert.match(read('style.css'),/\.cfgrow\[hidden\]\{display:none\}/,'a hidden row stays hidden although rows are flex boxes');
 assert.match(game,/const PHONE=IS_TOUCH&&!window\.desktop;/,'a phone or tablet in the browser, never the desktop build');
 assert.ok(game.includes("$('gpuRow').hidden=!PHONE;"));
 assert.ok(game.includes('SUN.q=v.lightQuality;screenGpu(!PHONE||v.gpu);screenRes(v.res);}});'),'on a computer the wish is always WebGL');
 assert.ok(game.includes("let gpuWish=!PHONE||DisplaySettings.load().gpu;"),'the screen is made the way the device last asked');
 assert.ok(game.indexOf('screenEars(cv);')<game.indexOf("cv.addEventListener('pointerdown',e=>{"),'the screen\'s listeners are written down from the first');
 assert.ok(game.indexOf('screenRows();',game.indexOf("$('gpuRow').hidden=!PHONE;"))>0,'Lighting quality shows only while the screen is WebGL');
});

/* the game's screen code, run against a pretend page */
function boot({phone=true,gpu=true,probe=true,throwOnCreate=false}={}){
 class Target{}
 Target.prototype.addEventListener=function(type,fn,opt){(this.heard||(this.heard=[])).push([type,fn,opt]);};
 class Canvas extends Target{
  constructor(n){super();this.n=n;this.kind=null;this.gone=false;}
  cloneNode(deep){assert.equal(deep,false);return new Canvas(this.n+1);}
  replaceWith(el){this.gone=true;this.next=el;}
  getContext(type){if(type!=='2d')return null;if(this.kind&&this.kind!=='2d')return null;this.kind='2d';return this.c2||(this.c2={kind:'2d',canvas:this});}
 }
 const log={made:0,lost:0,resized:[],msgs:[]};
 const GL2D={probe:()=>probe,create(el){if(el.kind)return null;el.kind='gl';if(throwOnCreate)throw new Error('shader');log.made++;return {isGL:true,canvas:el,release(){log.lost++;}};}};
 const rows={lightQRow:{hidden:false}},first=new Canvas(0);
 const box=vm.createContext({EventTarget:Target,GL2D,PHONE:phone,DisplaySettings:{load:()=>({gpu})},console:{error(){}},
  $:id=>id==='game'?first:rows[id],resize(){log.resized.push(box.vigCvSeen());},stageMsg(t){log.msgs.push(t);}});
 const code=game.slice(game.indexOf('function screenSurface(el,gpu=true){'),game.indexOf('let VW=0,VH=0,DPR=1,vigCv=null;'));
 vm.runInContext('var vigCv="cached";globalThis.vigCvSeen=()=>vigCv;\n'+code+'\nscreenRows();',box);
 const now=()=>vm.runInContext('({cv,ctx,wish:gpuWish})',box);
 return {box,log,rows,first,now,swap:on=>vm.runInContext('screenGpu('+on+')',box)};
}

test('a phone switching it off and on again: a fresh screen each time, every listener goes along, the old GPU context is let go',()=>{
 const P=boot();
 let {cv,ctx}=P.now();
 assert.equal(ctx.isGL,true,'on: WebGL, as before');assert.equal(P.rows.lightQRow.hidden,false,'Lighting quality shown');
 const down=()=>{},touch=()=>{},wheel=()=>{};
 cv.addEventListener('pointerdown',down);cv.addEventListener('touchstart',touch,{passive:false});cv.addEventListener('wheel',wheel,{passive:false});
 P.swap(false);
 ({cv,ctx}=P.now());
 assert.ok(P.first.gone&&P.first.next===cv,'the old element has made way for the new one');
 assert.equal(ctx.kind,'2d','off: the 2D canvas');assert.ok(!ctx.isGL);
 assert.deepEqual(cv.heard.map(([t,f,o])=>[t,f,o]),[['pointerdown',down,undefined],['touchstart',touch,{passive:false}],['wheel',wheel,{passive:false}]],'the same listeners, the same options');
 assert.equal(P.log.lost,1,'the WebGL context is lost at once');
 assert.deepEqual(P.log.resized,[null],'sized again from scratch (the cached vignette dropped)');
 assert.equal(P.rows.lightQRow.hidden,true,'Lighting quality hidden on the 2D screen');
 P.swap(false);assert.equal(P.now().cv,cv,'asked again for the same: nothing happens');
 const later=()=>{};cv.addEventListener('click',later);
 P.swap(true);
 const back=P.now();
 assert.equal(back.ctx.isGL,true,'on again: WebGL');assert.notEqual(back.cv,cv);
 assert.deepEqual(back.cv.heard.map(h=>h[0]),['pointerdown','touchstart','wheel','click'],'each listener once - and one added since goes along too');
 assert.equal(P.rows.lightQRow.hidden,false);assert.equal(P.log.msgs.length,0);
});

test('a phone that asked for the 2D screen starts on it, without the probe; a computer ignores the wish',()=>{
 const P=boot({gpu:false});
 assert.equal(P.now().ctx.kind,'2d');assert.equal(P.log.made,0,'WebGL never made');assert.equal(P.rows.lightQRow.hidden,true);
 const C=boot({phone:false,gpu:false});
 assert.equal(C.now().ctx.isGL,true,'the desktop build: always WebGL');
 C.swap(true);assert.equal(C.log.resized.length,0,'and its settings never swap the screen');
});

test('asking for WebGL where it cannot be had: the 2D screen, one short message, and no new try at every other setting',()=>{
 const P=boot({gpu:false,probe:false});
 P.swap(true);
 assert.equal(P.now().ctx.kind,'2d');assert.deepEqual(P.log.msgs,['🎮 No WebGL on this device']);
 P.swap(true);assert.equal(P.log.msgs.length,1,'the wish is kept, so a brightness slider does not try again');
 const Q=boot({gpu:false,throwOnCreate:true});
 const before=Q.now().cv,down=()=>{};before.addEventListener('pointerdown',down);
 Q.swap(true);
 const {cv,ctx}=Q.now();
 assert.equal(ctx.kind,'2d','WebGL took the new element and failed: a second fresh one gives the 2D canvas');
 assert.deepEqual(cv.heard.map(h=>h[1]),[down],'and the listeners go to the element that is really on the page');
});

test('a WebGL screen let go is gone for good: its GPU context lost at once, its font listener taken back, so nothing holds its memory',()=>{
 const gl=read('assets/gl/gl2d.js');
 assert.ok(gl.includes("document.fonts.addEventListener('loadingdone',fontsLoaded)")&&gl.includes("document.fonts.removeEventListener('loadingdone',fontsLoaded)"),'the one hold the page keeps on a context is taken back');
 assert.ok(gl.includes("R.warned.add('context lost');"),'a context let go on purpose is not reported as lost');
 assert.ok(gl.includes('finally{try{if(g)g.release();}catch(e){}}'),'the probe lets its scratch context go the same way');
 assert.ok(game.includes('try{if(was.release)was.release();}catch(_){}'),'the 2D screen has nothing to let go');
});
