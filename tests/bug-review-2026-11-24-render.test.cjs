/* Run with: node --test tests/bug-review-2026-11-24-render.test.cjs
 * The renderer's share of the bug review of 2026-11-24 (found against real WebGL in a scratch rig that loads only gl2d.js; what
 * can be held in Node is held here, gl2d.js running against a pretend WebGL2 that keeps what is uploaded to it):
 *  1. a wild Tide battle's backdrop - the screen copied into a 2D canvas - was empty on WebGL: the frame is not on the canvas
 *     itself until the task ends. The copy is taken after a flush now.
 *  2a. a restored WebGL context has no extensions until they are asked for again: asked once, the half-float light targets were
 *     incomplete after a restore - no lamps, bloom or shafts until a restart. And a post pass first used between the loss and
 *     its event compiled a shader on a dead context and threw into the frame.
 *  2b. a context that never comes back left the screen dead for the session: after 5 s in view the game moves the screen to
 *     the 2D canvas through the GPU acceleration swap, and saves nothing.
 *  3. a gradient's row in the geometry table was taken before its colour ramp was found; a full ramp table then drew the
 *     waiting batch and sent the row up half written - another gradient's colours for one draw, every 512 new ramps.
 *  4. a text wider than the 2048 atlas was not drawn at all (the Forsaken One's lines on a 4K screen at 250%).
 *  5. main.js looked for Electron 35+'s console-message details in the second argument; they are the first.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js'),glSrc=read('assets/gl/gl2d.js'),ui=read('assets/tides/ui.js'),mainSrc=read('main.js');

/* ---- gl2d.js on a pretend page: 2D canvases that only measure, and a WebGL2 that remembers the gradient table, the ramp strip,
        what is written into the text atlas and the vertices of every draw */
function page(){
 const made={canvases:[],text:[]};
 class CanvasGradient{addColorStop(){}}
 class CanvasRenderingContext2D{
  constructor(canvas){this.canvas=canvas;this.font='10px sans-serif';this.transforms=[];}
  createLinearGradient(){return new CanvasGradient();}createRadialGradient(){return new CanvasGradient();}createPattern(){return null;}
  fill(){}stroke(){}fillRect(){}strokeRect(){}clearRect(){}drawImage(){}putImageData(){}reset(){}
  fillText(t){made.text.push({t,m:this.transforms.at(-1),shadowBlur:this.shadowBlur,shadowOffsetX:this.shadowOffsetX});}strokeText(t){made.text.push({t,m:this.transforms.at(-1)});}
  setTransform(...a){this.transforms.push(a);}
  measureText(t){const px=parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]),w=String(t).length*px*.5;return {width:w,actualBoundingBoxLeft:0,actualBoundingBoxRight:w,actualBoundingBoxAscent:px*.8,actualBoundingBoxDescent:px*.2};}
 }
 class HTMLCanvasElement{
  constructor(){this._w=300;this._h=150;this.on={};made.canvases.push(this);}
  get width(){return this._w;}set width(v){this._w=v|0;}get height(){return this._h;}set height(v){this._h=v|0;}
  getContext(type){if(type==='webgl2')return this.gl||null;return this.c2||(this.c2=new CanvasRenderingContext2D(this));}
  addEventListener(type,fn){this.on[type]=fn;}
 }
 class HTMLImageElement{}
 const box=vm.createContext({Math,Number,String,Array,Object,Float32Array,Float64Array,Uint32Array,Uint8Array,ArrayBuffer,Map,Set,WeakMap,Error,
  CanvasGradient,CanvasRenderingContext2D,HTMLCanvasElement,HTMLImageElement,queueMicrotask:()=>{},console:{warn(){},error(){}}});
 box.window=box;box.document={createElement:()=>new HTMLCanvasElement()};
 vm.runInContext(glSrc+'\n;globalThis.__GL2D=GL2D;',box,{filename:'gl2d.js'});
 return {GL2D:box.__GL2D,HTMLCanvasElement,made};
}
function fakeGL(){
 const ids=new Map(),G={lost:false,exts:[],floatExt:true,grad:new Float32Array(4096*8),lut:new Uint8Array(256*4*512),atlas:[],draws:[],verts:null,shaders:0};
 const base={
  getParameter:()=>4096,
  getExtension(n){G.exts.push(n);return n==='EXT_color_buffer_float'&&G.floatExt&&!G.lost?{}:null;},
  isContextLost:()=>G.lost,
  createShader(){G.shaders++;return {};},createProgram:()=>({}),createTexture:()=>({}),createFramebuffer:()=>({}),createRenderbuffer:()=>({}),createBuffer:()=>({}),createVertexArray:()=>({}),createSampler:()=>({}),
  getShaderParameter:()=>G.lost?null:true,getProgramParameter:(p,what)=>G.lost?null:what===gl.ACTIVE_UNIFORMS?0:true,getShaderInfoLog:()=>null,getProgramInfoLog:()=>null,
  texSubImage2D(target,level,x,y,w,h,format,type,data,at){
   if(type===gl.FLOAT)G.grad.set(data.subarray(at,at+h*8),y*8);
   else if(data instanceof Uint8Array)G.lut.set(data.subarray(at,at+h*1024),y*1024);
   else G.atlas.push({x,y,w,h});
  },
  bufferSubData(target,off,data,from,len){if(data instanceof Float32Array)G.verts={f:data,u:new Uint32Array(data.buffer),n:len/7};},
  drawElements(){const v=G.verts,rows=[];for(let i=0;i<v.n;i++)rows.push({x:v.f[i*7],y:v.f[i*7+1],info:v.u[i*7+6]});G.draws.push(rows);},
 };
 const gl=new Proxy(base,{get(t,k){if(k in t)return t[k];if(typeof k==='string'&&/^[A-Z][A-Z0-9_]*$/.test(k)){if(!ids.has(k))ids.set(k,1000+ids.size);return ids.get(k);}return ()=>{};}});
 return {gl,G};
}
function screen(w=256,h=128){
 const P=page(),{gl,G}=fakeGL(),cv=new P.HTMLCanvasElement();cv.gl=gl;cv.width=w;cv.height=h;
 const ctx=P.GL2D.create(cv);assert.ok(ctx&&ctx.isGL);
 return {P,gl,G,cv,ctx};
}
/* the colour the GPU would give a gradient vertex: its row of the geometry table -> the ramp it names -> that ramp's texels */
const gradColour=(G,info)=>{const row=info>>>16,ramp=G.grad[row*8+7];return Array.from(G.lut.subarray(ramp*1024,ramp*1024+3));};

test('3. every gradient is drawn in its own colours - also the one whose new ramp finds the ramp table full, with a batch waiting',()=>{
 const {ctx,G}=screen();
 const solid=c=>{const g=ctx.createLinearGradient(0,0,64,0);g.addColorStop(0,c);g.addColorStop(1,c);return g;};
 let uniq=0;const wrong=[];
 for(let n=0;n<9000;n++){
  ctx.fillStyle='#000000';ctx.fillRect(40,40,4,4);   /* something else of the frame, waiting in the batch */
  let want;if(n%4===3)want=[1,2,3];else{uniq++;want=[uniq%251,(uniq>>3)%241,100+(uniq%7)];}   /* most ramps seen before, some new each frame */
  ctx.fillStyle=solid('rgb('+want.join(',')+')');ctx.fillRect(0,0,16,16);
  G.draws.length=0;ctx.flush();
  const last=G.draws.at(-1).at(-1);assert.equal(last.info&255,255,'the last thing drawn is the gradient');
  const got=gradColour(G,last.info);if(got.join()!==want.join())wrong.push({n,want,got});
 }
 assert.ok(uniq>512*8,'the ramp table was filled and started over many times, past the geometry table\'s own turn');
 assert.deepEqual(wrong,[],'no fill in another gradient\'s colours (before: one for every 512 new ramps)');
 assert.match(glSrc,/const lut=lutRow\(info\);[^\n]*\n\s*if\(gradN>=GROWS\)flush\('grad-full'\);/,'the ramp is found before the row is taken');
});

test('4. a text wider than the atlas is rasterised smaller and laid out at its full size; any other text is rasterised exactly as before',()=>{
 const {ctx,G,P}=screen(2600,100);
 const quad=()=>{G.draws.length=0;ctx.flush();const q=G.draws.at(-1).slice(-4);return {x0:Math.min(...q.map(v=>v.x)),x1:Math.max(...q.map(v=>v.x)),slot:q[0].info&255};};
 ctx.font='60px serif';ctx.fillStyle='#ffffff';
 ctx.fillText('x'.repeat(20),10,60);   /* 600 px: fits */
 let q=quad();assert.equal(G.atlas.at(-1).w,600+4,'a line that fits: its raster at the screen\'s own scale, 2 px round it');
 assert.deepEqual(Array.from(P.made.text.at(-1).m),[1,0,0,1,2,2+48],'drawn into the text canvas 1:1');
 assert.ok(Math.abs((q.x1-q.x0)-604)<1e-6,'and laid out 1:1');
 ctx.fillText('y'.repeat(80),10,60);   /* 2400 px: wider than the 2048 atlas */
 q=quad();const a=G.atlas.at(-1),m=P.made.text.at(-1).m;
 assert.equal(P.made.text.at(-1).t,'y'.repeat(80),'it is drawn (before: dropped without a word)');
 assert.ok(a.w<=2048&&a.w>1900,'its raster fits the atlas, and is no smaller than it must be: '+a.w);
 assert.ok(m[0]<1&&m[0]>.8&&m[0]===m[3],'rasterised at a smaller scale: '+m[0]);
 assert.ok(q.slot>0&&q.slot<255,'a picture from the atlas');
 assert.ok(Math.abs(q.x0-(10-2/m[0]))<.01&&Math.abs((q.x1-q.x0)-a.w/m[0])<.01,'laid out at the size the text has: '+(q.x1-q.x0).toFixed(1)+' px for 2400 px of text');
 assert.ok(q.x1-q.x0>2400&&q.x1-q.x0<2410);
 /* under the screen's own scale (a 4K display at 300%) and with a shadow: the shadow shrinks with the raster, so it comes out the size asked for */
 ctx.setTransform(3,0,0,3,0,0);ctx.font='20px serif';ctx.shadowColor='#ff0000';ctx.shadowBlur=12;ctx.shadowOffsetX=6;
 ctx.fillText('z'.repeat(80),4,20);   /* 800 units -> 2400 px */
 const t=P.made.text.at(-1),f=t.m[0]/3;
 assert.ok(G.atlas.at(-1).w<=2048&&f<1,'fits');assert.ok(Math.abs(t.shadowBlur-12*f)<1e-9&&Math.abs(t.shadowOffsetX-6*f)<1e-9,'blur and offset by the same factor');
 ctx.fillText('z'.repeat(8),4,20);
 assert.equal(P.made.text.at(-1).shadowBlur,12,'a short line\'s shadow untouched');assert.equal(P.made.text.at(-1).m[0],3);
});

test('2a. a restored context is asked for its extensions again - the half-float light targets were incomplete without them',()=>{
 const {ctx,G,cv}=screen();
 const asked=()=>G.exts.filter(n=>n==='EXT_color_buffer_float').length;
 assert.equal(asked(),1,'asked when the screen is made');assert.equal(ctx.hdr,true);
 G.lost=true;cv.on.webglcontextlost({preventDefault(){}});assert.equal(ctx.isContextLost(),true);
 G.lost=false;cv.on.webglcontextrestored({});
 assert.equal(ctx.isContextLost(),false);assert.equal(asked(),2,'and again when the context comes back (before: never, so RGBA16F could not be drawn into)');
 assert.equal(ctx.hdr,true);
 G.lost=true;cv.on.webglcontextlost({preventDefault(){}});G.lost=false;G.floatExt=false;cv.on.webglcontextrestored({});
 assert.equal(ctx.hdr,false,'a GPU that comes back without it: plain 8-bit targets, not incomplete ones');
});

test('2a. a post pass used for the first time while the context is lost - the event still on its way - draws nothing and does not throw',()=>{
 const {ctx,G}=screen();
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,10,10);
 const before=G.shaders;
 G.lost=true;   /* gone, and nobody told yet */
 assert.equal(ctx.isContextLost(),false,'the event has not fired');
 assert.doesNotThrow(()=>{ctx.lightMap({ambient:[.2,.2,.2],lights:[{x:5,y:5,reach:9}]});ctx.bloom({});ctx.rays({x:0,y:0});ctx.heatHaze({sources:[{x:5,y:5,r:9,k:1}]});ctx.drawBlurred({width:8,height:8},.5,1);},
  'before: "GL2D shader: null" out of the frame');
 assert.equal(G.shaders,before,'no shader is compiled on a dead context');
 G.lost=false;
 assert.doesNotThrow(()=>ctx.heatHaze({sources:[{x:5,y:5,r:9,k:1}]}));assert.ok(G.shaders>before,'and once it is back the pass works');
});

test('1. the Tide battle copies the screen after it has reached the canvas: a flush on WebGL, nothing on the 2D screen',()=>{
 assert.ok(ui.includes("draw();screenToCanvas();const backdrop=document.createElement('canvas');backdrop.width=cv.width;backdrop.height=cv.height;backdrop.getContext('2d').drawImage(cv,0,0);"),'the battle\'s first backdrop');
 assert.ok(ui.includes("session.nextBackdrop=session.time+.25;screenToCanvas();session.backdrop.getContext('2d').drawImage(cv,0,0);paintBattle();"),'and the ones that follow while the camera settles');
 assert.equal(ui.split('drawImage(cv,').length-1,2,'no other copy of the screen');
 const i=ui.indexOf(' function screenToCanvas(){'),fn=ui.slice(i,ui.indexOf('\n',i));assert.ok(i>0);
 const run=ctx=>{const box=vm.createContext(ctx===undefined?{}:{ctx});vm.runInContext(fn+';screenToCanvas();',box);};
 let n=0;run({isGL:true,flush(){n++;}});assert.equal(n,1,'WebGL: the frame is put on the canvas now');
 run({flush(){n++;}});assert.equal(n,1,'a 2D screen is left alone');
 assert.doesNotThrow(()=>run(undefined),'and a page without the game\'s screen does not trip over it');
 assert.match(glSrc,/flush\(\)\{present\(\);\}/,'GL2D\'s flush is its present, at once');
});

/* ---- 2b: the game's own screen code on a pretend page with a clock */
function lostBoot({phone=false,gpu=true}={}){
 class Target{}
 Target.prototype.addEventListener=function(type,fn,opt){(this.heard||(this.heard=[])).push([type,fn,opt]);};
 class Canvas extends Target{
  constructor(n){super();this.n=n;this.kind=null;}
  cloneNode(){return new Canvas(this.n+1);}
  replaceWith(el){this.gone=true;this.next=el;}
  getContext(type){if(type!=='2d'||(this.kind&&this.kind!=='2d'))return null;this.kind='2d';return this.c2||(this.c2={kind:'2d',canvas:this});}
 }
 const log={made:0,released:0,resized:0,msgs:[],errors:[],kept:0},timers=[];let now=0,probe=true;
 const GL2D={probe:()=>probe,create(el){if(el.kind)return null;el.kind='gl';log.made++;const c={isGL:true,canvas:el,lost:false,isContextLost(){return c.lost;},release(){log.released++;}};el.glc=c;return c;}};
 const doc={hidden:false,heard:{},addEventListener(type,fn,capture){(doc.heard[type]||(doc.heard[type]=[])).push({fn,capture});}};
 const rows={lightQRow:{hidden:false}},first=new Canvas(0);
 const box=vm.createContext({EventTarget:Target,GL2D,PHONE:phone,DisplaySettings:{load:()=>({gpu})},console:{error(m){log.errors.push(m);}},document:doc,
  setTimeout:(fn,ms)=>{timers.push({fn,at:now+ms,id:timers.length+1});return timers.length;},clearTimeout:id=>{const t=timers.find(t=>t.id===id);if(t)t.dead=true;},
  $:id=>id==='game'?first:rows[id],resize(){log.resized++;},stageMsg(t){log.msgs.push(t);}});
 const a=game.indexOf('function screenSurface(el,gpu=true){'),b=game.indexOf('/* 🖵 Resolution (2026-10-10',a);assert.ok(a>0&&b>a);
 const code=game.slice(a,b);
 vm.runInContext('var vigCv=null;\n'+code.replace('let VW=0,VH=0,DPR=1,vigCv=null;','')+'\nscreenRows();',box);
 const st=()=>vm.runInContext('({cv,ctx,wish:gpuWish,ms:SCREEN_LOST_MS})',box);
 const fire=(type,target)=>{for(const l of doc.heard[type]||[])l.fn({target});};
 const pass=ms=>{now+=ms;for(const t of timers)if(!t.dead&&!t.ran&&t.at<=now){t.ran=true;t.fn();}};
 return {box,log,rows,doc,first,st,fire,pass,code,setProbe:v=>{probe=v;},swap:on=>vm.runInContext('screenGpu('+on+')',box)};
}

test('2b. a WebGL context lost and back within the time is left alone',()=>{
 const P=lostBoot(),{cv,ctx,ms}=P.st();
 assert.equal(ms,5000);assert.ok(ctx.isGL);
 assert.ok(P.doc.heard.webglcontextlost[0].capture===true&&P.doc.heard.webglcontextrestored[0].capture===true,'heard on the way down from the document: the events do not bubble');
 ctx.lost=true;P.fire('webglcontextlost',cv);P.pass(900);
 ctx.lost=false;P.fire('webglcontextrestored',cv);P.pass(60000);
 assert.equal(P.st().cv,cv,'the same screen');assert.equal(P.log.resized,0);assert.deepEqual(P.log.errors,[]);
 /* even with the restore's own event missed, a context that is back is not touched */
 ctx.lost=true;P.fire('webglcontextlost',cv);P.pass(2000);ctx.lost=false;P.pass(60000);
 assert.equal(P.st().cv,cv);
});

test('2b. lost for five seconds with no restore: the screen moves to the 2D canvas, nothing is saved, and the next settings pass asks for WebGL again',()=>{
 const P=lostBoot(),{cv,ctx}=P.st();
 const down=()=>{};cv.addEventListener('pointerdown',down);
 ctx.lost=true;P.fire('webglcontextlost',cv);
 P.pass(4900);assert.equal(P.st().cv,cv,'not before its time');
 P.pass(200);
 const s=P.st();
 assert.notEqual(s.cv,cv);assert.ok(cv.gone&&cv.next===s.cv,'a fresh element in its place');assert.equal(s.ctx.kind,'2d','drawn by the 2D canvas');
 assert.deepEqual(s.cv.heard.map(h=>h[0]),['pointerdown'],'the game\'s listeners went along');
 assert.equal(P.log.released,1,'the dead context let go');assert.equal(P.log.resized,1);assert.equal(P.rows.lightQRow.hidden,true,'Lighting quality hidden, as on any 2D screen');
 assert.equal(P.log.errors.length,1,'written down once (error.log in the desktop build)');assert.deepEqual(P.log.msgs,[],'nothing new said to the player');
 assert.equal(s.wish,false);
 assert.ok(!/localStorage|setItem|DisplaySettings\.(save|set)|saveNow|save\(\)/.test(P.code.slice(P.code.indexOf('const SCREEN_LOST_MS'))),'the device\'s own GPU acceleration setting is not written: the next start asks for WebGL as it says');
 P.pass(60000);assert.equal(P.st().cv,s.cv,'and it happens once');
 /* any change in Settings applies them all: a computer's wish is WebGL, so it is tried again */
 P.swap(true);
 assert.ok(P.st().ctx.isGL,'WebGL again when the GPU gives one');assert.deepEqual(P.log.msgs,[]);
 /* ... and the new screen is watched like the first */
 const n=P.st();n.ctx.lost=true;P.fire('webglcontextlost',n.cv);P.pass(5100);
 assert.equal(P.st().ctx.kind,'2d');
 P.setProbe(false);P.swap(true);
 assert.equal(P.st().ctx.kind,'2d');assert.deepEqual(P.log.msgs,['🎮 No WebGL on this device'],'still none: the message the swap always had, no new one');
});

test('2b. out of view the count waits; a screen already let go, or already 2D, is not touched',()=>{
 const P=lostBoot(),{cv,ctx}=P.st();
 ctx.lost=true;P.doc.hidden=true;P.fire('webglcontextlost',cv);P.pass(60000);
 assert.equal(P.st().cv,cv,'a phone in the background: its browser hands the context back when it is seen again');
 P.doc.hidden=false;P.fire('visibilitychange',P.doc);P.pass(3000);
 ctx.lost=false;P.fire('webglcontextrestored',cv);P.pass(60000);
 assert.equal(P.st().cv,cv,'seen again and restored within the time: nothing');
 ctx.lost=true;P.doc.hidden=true;P.fire('webglcontextlost',cv);P.pass(1000);P.doc.hidden=false;P.fire('visibilitychange',P.doc);
 P.pass(4900);assert.equal(P.st().cv,cv);P.pass(200);assert.equal(P.st().ctx.kind,'2d','seen again and still lost five seconds on: the 2D canvas');
 /* a phone that chose the 2D screen itself: the old element's context is let go, its loss is not this screen's */
 const Q=lostBoot({phone:true}),q=Q.st();
 Q.swap(false);const two=Q.st();assert.equal(two.ctx.kind,'2d');
 q.ctx.lost=true;Q.fire('webglcontextlost',q.cv);Q.pass(60000);
 assert.equal(Q.st().cv,two.cv,'another element\'s event starts nothing');assert.equal(Q.log.resized,1);
 Q.fire('visibilitychange',Q.doc);Q.pass(60000);assert.equal(Q.st().cv,two.cv);assert.deepEqual(Q.log.errors,[]);
});

test('5. page errors reach error.log whichever way Electron hands them over',()=>{
 const i=mainSrc.indexOf("win.webContents.on('console-message', (...a) => {"),j=mainSrc.indexOf('});',i);assert.ok(i>0&&j>i);
 const logged=[],handler=new Function('logErr','return (...a)=>{'+mainSrc.slice(mainSrc.indexOf('{',i)+1,j)+'};')((where,msg)=>logged.push(where+': '+msg));
 /* Electron 35-44: the details are the event itself, the loose arguments still follow it (as 44.7.0 calls, measured) */
 handler({message:'frame: boom',level:'error',lineNumber:9,sourceId:'game.js'},3,'frame: boom',9,'game.js');
 handler({message:'only a warning',level:'warning',lineNumber:1,sourceId:'x'},2,'only a warning',1,'x');
 assert.deepEqual(logged,['page: frame: boom (game.js:9)'],'errors only');
 /* the loose arguments gone, as Electron has announced: before, nothing was logged from then on */
 logged.length=0;handler({message:'frame: later',level:'error',lineNumber:7,sourceId:'game.js'});handler({message:'info',level:'info',lineNumber:1,sourceId:'x'});
 assert.deepEqual(logged,['page: frame: later (game.js:7)']);
 /* Electron 33 and older: an event without details, then level, message, line, source */
 logged.length=0;handler({},3,'frame: old',12,'game.js');handler({},1,'log',1,'x');
 assert.deepEqual(logged,['page: frame: old (game.js:12)']);
});
