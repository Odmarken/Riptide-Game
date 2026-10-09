/* Run with: node --test tests/phone-mode.test.cjs
 * 📱 Phones (asked for 2026-10-10: "går det att göra något separat åt telefonerna ... för nu strugglar telefonerna lite med fps").
 * The web game on a phone or tablet (never the desktop build): Lighting quality starts on Low (moved there once for a phone
 * that played on the old Ultra default), a 120 Hz screen is drawn at 60, the picture's sharpness follows the frame rate
 * (1.5 to the point to start, 1.25 .. 2), the props' shadows are rebuilt every other frame and moved with the camera between,
 * and a plume of smoke has half its puffs. Two savings for every screen: a font is parsed once, and which window is up is
 * looked up once a frame. Measured headless as a phone with a 4x slower CPU (scratchpad 7f048ed2 daybar/phoneperf.mjs).
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const game=read('game.js');
function section(start,end){const a=game.indexOf(start),b=game.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return game.slice(a,b);}
const D=require('../assets/ui/display-settings.js');

test('a phone starts on Low, a phone that played on the old Ultra moves to Low once, and what the player picks after stays',()=>{
 assert.equal(D.normalize(null).lightQuality,'ultra','the desktop and the desktop build keep Ultra');
 assert.equal(D.normalize(null,true).lightQuality,'low');assert.equal(D.normalize(null,true).phoneRev,D.PHONE_REV);
 assert.equal(D.normalize({lightQuality:'ultra'},true).lightQuality,'low','an old phone save with the old default');
 assert.equal(D.normalize({lightQuality:'ultra',phoneRev:D.PHONE_REV},true).lightQuality,'ultra','chosen on the phone after the move: kept');
 assert.equal(D.normalize({lightQuality:'medium',phoneRev:D.PHONE_REV},true).lightQuality,'medium');
 assert.equal(D.normalize({lightQuality:'ultra'}).lightQuality,'ultra','a desktop is never moved');
 /* through the real settings object: the move is saved, so it happens once */
 const kept={},storage={getItem:k=>kept[k]??null,setItem:(k,v)=>{kept[k]=v;}};
 kept[D.STORAGE_KEY]=JSON.stringify({lightQuality:'ultra',weather:false});
 const doc={getElementById:()=>null};
 const a=D.create({doc,storage,phone:true});
 assert.equal(a.value.lightQuality,'low');assert.equal(a.value.weather,false,'nothing else changes');
 assert.equal(JSON.parse(kept[D.STORAGE_KEY]).phoneRev,D.PHONE_REV,'saved at once');
 kept[D.STORAGE_KEY]=JSON.stringify({...JSON.parse(kept[D.STORAGE_KEY]),lightQuality:'ultra'});   /* the player picks Ultra again */
 assert.equal(D.create({doc,storage,phone:true}).value.lightQuality,'ultra');
 assert.match(game,/const displaySettings=DisplaySettings\.create\(\{onChange:v=>\{[^]*?\},phone:PHONE\}\);/);
 assert.match(game,/const PHONE=IS_TOUCH&&!window\.desktop;/,'the web game on a phone or tablet, never the desktop build');
});

function gate(){
 const c={PHONE:true,gameOn:true,gamePaused:false,document:{hidden:false},now:0,resized:0,micro:[],
  performance:{now:()=>c.now},queueMicrotask:f=>c.micro.push(f),resize(){c.resized++;}};
 vm.createContext(c);
 vm.runInContext(section('const PHONE_SCALES=','function resize(){')+';globalThis.R=()=>phoneRes;globalThis.SCALES=PHONE_SCALES;',c);
 /* one frame: t its time, work the ms the game spends on it */
 c.step=(t,work)=>{c.now=t;const skip=c.frameGate(t);c.now+=work;c.micro.splice(0).forEach(f=>f());return skip;};
 return c;
}
test('a 120 Hz screen is drawn every other frame; 60 and 90 Hz screens are not held back',()=>{
 for(const [hz,want] of [[120,.5],[60,1],[90,1]]){
  const c=gate();let drawn=0,n=0;
  for(let t=0;t<4000;t+=1000/hz,n++)if(!c.step(t,3))drawn++;
  assert.ok(Math.abs(drawn/n-want)<.06,hz+' Hz: '+(drawn/n).toFixed(2));
 }
 const c=gate();c.PHONE=false;let drawn=0;for(let t=0;t<1000;t+=1000/120)if(!c.step(t,1))drawn++;
 assert.ok(drawn>110,'not on a computer');
});

test('the sharpness follows the frame rate: down when the graphics cannot keep up, up while it holds, a failed step not again',()=>{
 const c=gate();assert.equal(c.R().i,1);assert.equal(c.SCALES[1],.75,'1.5 to the point on a 2x phone to start');
 let t=0;const run=(ms,frame,work)=>{for(const end=t+ms;t<end;t+=frame)c.step(t,work);};
 run(7000,30,6);   /* 33 fps, the game's own work 6 ms: the time goes to the graphics (judged every 3 s, after the first 4) */
 assert.equal(c.R().i,0,'one step down');assert.ok(c.resized>=1);
 run(9000,16.7,4);   /* holds 60 at 1.25 */
 assert.equal(c.R().i,1,'and back up');
 run(10000,16.7,4);assert.equal(c.R().i,2,'a sharper step tried');
 run(9000,30,6);assert.equal(c.R().i,1,'it failed: back');assert.equal(c.R().ceil,1,'and it is not tried again');
 run(30000,16.7,4);assert.equal(c.R().i,1);
 /* slow because of the game's own work (the CPU): a blurrier picture cannot help, so it stays */
 const d=gate();let u=0;for(;u<12000;u+=30)d.step(u,26);
 assert.equal(d.R().i,1,'CPU-bound: no change');
 assert.match(section('function resize(){','\nwindow.addEventListener'),/Math\.min\(2,window\.devicePixelRatio\|\|1\)\*\(PHONE\?PHONE_SCALES\[phoneRes\.i\]:1\)/);
 assert.match(section('function frame(t){','\nconst sidebarResize='),/requestAnimationFrame\(frame\);\n if\(typeof frameGate==='function'&&frameGate\(t\)\)return;/);
});

test('the props\' shadows: a phone rebuilds them every other frame and moves the kept layer with the camera',()=>{
 const sun=section('function sunBegin(){','function sunFootShadow(');
 const draws=[],c={PHONE:true,S:{zone:3},SUN:{res:.5,alpha:.28,cast:1,k:.3,s:.24},cv:{width:600,height:900},heatWorld:{a:1.5,b:0,c:0,d:1.5,e:-100,f:-200},
  sunCast:true,sunReuse:false,sunBuilt:null,sunParity:false,sunLayer:null,sunG:null,glFx:()=>null,
  document:{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}})})},
  ctx:{save(){},restore(){},setTransform(){},drawImage:(...a)=>draws.push(a),getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),drawBlurred:(...a)=>draws.push(['gl',...a])},
  sunSilhouette:()=>({width:10,height:10,pad:1,cw:8,ch:8}),Math};
 vm.createContext(c);vm.runInContext('let sunReuse=false,sunBuilt=null,sunParity=false,sunLayer=null,sunG=null;'+sun+';globalThis.state=()=>({sunReuse,sunLayer});',c);
 let built=null;
 const frame=(e,f,a=1.5)=>{c.heatWorld={a,b:0,c:0,d:a,e,f};c.sunBegin();c.sunShadow({},0,-10,10,10,0);c.sunEnd();const kept=c.state().sunReuse;if(!kept)built={e,f};return kept;};
 /* walking: after the first, every other frame keeps the layer, laid over by as far as the camera went since it was built */
 const seen=[];
 for(let i=0;i<8;i++){const before=built,e=-100-3*i,f=-200-i,kept=frame(e,f);seen.push(kept?'kept':'built');
  if(kept)assert.deepEqual(draws.at(-1).slice(1,3),[e-before.e,f-before.f],'moved with the camera');}
 assert.deepEqual(seen.slice(1),['built','kept','built','kept','built','kept','built']);
 let k=0;while(!frame(-130-k,-210)&&k<4)k++;   /* a kept frame: the next one builds */
 frame(-131-k,-210);assert.equal(frame(-132-k,-210,1.6),false,'a zoom rebuilds');
 frame(-133-k,-210,1.6);assert.equal(frame(-600,-210,1.6),false,'and so does a jump');
 c.PHONE=false;assert.ok([1,2,3,4].every(i=>frame(-600-i,-210,1.6)===false),'a computer builds every frame');
 c.PHONE=true;c.glFx=()=>'medium';k=0;
 while(true){const before=built,e=-700-3*k,f=-220-k;if(frame(e,f)){assert.equal(draws.at(-1)[0],'gl');assert.deepEqual(draws.at(-1).slice(-2),[e-before.e,f-before.f],'the GPU\'s soft shadows are moved the same way');break;}if(++k>6)assert.fail('never kept');}
 assert.match(read('assets/gl/gl2d.js'),/gl\.uniform2f\(P\.addmix\.u\.u_shift,-\(\+dx\|\|0\)\/W,\(\+dy\|\|0\)\/H\);/);
});

test('a phone\'s plume of smoke has half its puffs, a little denser',()=>{
 const S=require('../assets/city/scenery-effects.js'),count=()=>{let n=0;const g=new Proxy({globalAlpha:1},{get:(t,k)=>k in t?t[k]:k==='drawImage'?()=>{n++;}:k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
  S.smoke(g,0,0,1,1.2,0,false,false);S.smoke(g,0,0,1,1.2,0,false,true);return n;};
 const all=count();S.setDetail(.5);const half=count();S.setDetail(1);
 assert.ok(half<=Math.ceil(all/2)+1&&half>=Math.floor(all/2)-1,all+' -> '+half);
 assert.match(game,/if\(PHONE\)CityScenery\.setDetail\(\.5\);/);
});

test('for every screen: a font is parsed once, and which window is up is looked up once a frame',()=>{
 const gl=read('assets/gl/gl2d.js');
 assert.match(gl,/prop\('font',\(\)=>S\.font,v=>\{v=String\(v\);let n=fontNorm\.get\(v\);/);
 assert.match(gl,/g\.font='1px __gl2d__';g\.font=v;n=g\.font==='1px __gl2d__'\?null:g\.font;/,'a refused font is told apart by a sentinel');
 const ids=['a','b'],els={a:{rects:0},b:{rects:1}},c={PAD_PANELS:ids,$:id=>({getClientRects:()=>({length:els[id].rects}),id}),getComputedStyle:()=>({visibility:'visible'}),
  padSide:false,gameOn:true,world:{},document:{querySelector:()=>null},frameSeq:5};
 vm.createContext(c);vm.runInContext(section('let padSide=false;','let padFocus=null;')+';globalThis.look=padPanelOpen;',c);
 assert.equal(c.look().id,'b');els.a.rects=1;
 assert.equal(c.look().id,'b','the same frame: the first answer stands');
 c.frameSeq=6;assert.equal(c.look().id,'a','the next frame looks again');
 els.a.rects=0;c.frameSeq=-1;assert.equal(c.look().id,'b','between frames (a key, a click) it always looks');
});
