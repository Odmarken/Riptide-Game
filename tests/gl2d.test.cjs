/* Run with: node --test tests/gl2d.test.cjs
 * 🎮 The WebGL screen (asked for 2026-10-09: "vi kör WebGL igenom allt"). assets/gl/gl2d.js draws the screen canvas with WebGL2 behind
 * the 2D API the game already speaks; its geometry and colour work is plain JavaScript and runs here, the GPU half is checked in the
 * browser (the probe the game runs at start, and the conformance page in that day's scratchpad). Also pinned: the game picks it
 * safely and can fall back to the plain canvas, and the switch in Settings > Video.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../assets/gl/gl2d.js'),T=G._test;
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

test('colours parse the way the 2D canvas reads them, unpremultiplied 0..1',()=>{
 assert.deepEqual(T.parseColorRaw('#ff8000'),[1,128/255,0,1]);
 assert.deepEqual(T.parseColorRaw('#f80'),[1,136/255,0,1]);
 assert.deepEqual(T.parseColorRaw('#00000080'),[0,0,0,128/255]);
 assert.deepEqual(T.parseColorRaw('rgba(255,128,0,0.5)'),[1,128/255,0,.5]);
 assert.deepEqual(T.parseColorRaw('rgba(255, 0, 0, .25)'),[1,0,0,.25]);
 assert.deepEqual(T.parseColorRaw('rgb(10 20 30 / 50%)'),[10/255,20/255,30/255,.5]);
 assert.deepEqual(T.parseColorRaw('rgb(300,-5,0)'),[1,0,0,1],'clamped');
 const h=T.parseColorRaw('hsl(120, 100%, 50%)');assert.ok(close(h[0],0)&&close(h[1],1)&&close(h[2],0)&&h[3]===1);
 assert.deepEqual(T.parseColorRaw('transparent'),[0,0,0,0]);
 assert.equal(T.parseColorRaw('not a colour'),null,'unknown words are refused (the context then keeps its old style)');
 assert.equal(T.parseColorRaw('#ggg'),null);
});

test('premultiplied packing: R,G,B,A bytes scaled by alpha and globalAlpha',()=>{
 const v=T.pack([1,.5,0,1],.5);assert.equal(v&255,128);assert.equal((v>>>8)&255,64);assert.equal((v>>>16)&255,0);assert.equal(v>>>24,128);
 assert.equal(T.pack([1,1,1,0],1),0,'fully transparent packs to 0');
});

test('arcs sweep as the 2D canvas defines them, and get enough segments for their size on screen',()=>{
 const TAU=Math.PI*2;
 assert.ok(close(T.arcSweep(0,TAU,false),TAU));assert.ok(close(T.arcSweep(0,7,false),TAU),'more than a turn is a whole circle');
 assert.ok(close(T.arcSweep(0,Math.PI/2,false),Math.PI/2));assert.ok(close(T.arcSweep(0,Math.PI/2,true),Math.PI/2-TAU),'anticlockwise goes the long way');
 assert.ok(close(T.arcSweep(1,1,false),0));
 assert.ok(T.arcSegments(100,TAU)>=30&&T.arcSegments(100,TAU)<=80,'a 100 px circle: tens of segments');
 assert.ok(T.arcSegments(2,TAU)<T.arcSegments(200,TAU),'small arcs are cheap');
 assert.equal(T.arcSegments(0,TAU),1);
});

test('convex shapes are recognised (they skip the stencil), concave and crossed ones are not',()=>{
 const sq=[0,0,10,0,10,10,0,10];assert.ok(Math.abs(T.convexity(sq,0,4))===1);
 const circ=[];for(let i=0;i<40;i++)circ.push(Math.cos(i/40*Math.PI*2)*50,Math.sin(i/40*Math.PI*2)*50);assert.ok(Math.abs(T.convexity(circ,0,40))===1);
 const star=[];for(let i=0;i<10;i++){const r=i%2?40:100,a=i*Math.PI/5;star.push(Math.cos(a)*r,Math.sin(a)*r);}assert.equal(T.convexity(star,0,10),0);
 const bow=[0,0,10,10,10,0,0,10];assert.equal(T.convexity(bow,0,4),0,'a crossed quad');
 const penta=[];for(let i=0;i<5;i++){const a=i*4*Math.PI/5;penta.push(Math.cos(a)*10,Math.sin(a)*10);}assert.equal(T.convexity(penta,0,5),0,'a pentagram turns twice');
 assert.equal(T.winding(sq,0,4,5,5)!==0,true);assert.equal(T.winding(sq,0,4,15,5),0);
 assert.ok(close(Math.abs(T.signedArea(sq,0,4)),100));
});

test('dashes cut a line into the on-runs of the pattern, starting at the offset',()=>{
 const d=T.dashPolyline([0,0,100,0],false,[10,10],0);
 assert.equal(d.length,5);assert.deepEqual(d[0],[0,0,10,0]);assert.deepEqual(d[4],[80,0,90,0]);
 const o=T.dashPolyline([0,0,100,0],false,[10,10],5);assert.deepEqual(o[0],[0,0,5,0],'an offset shortens the first dash');
 const corner=T.dashPolyline([0,0,10,0,10,10],false,[15,100],0);assert.deepEqual(corner[0],[0,0,10,0,10,5],'a dash runs round a corner');
 assert.equal(T.dashPolyline([0,0,100,0],false,[0,0],0).length,1,'an empty pattern draws the whole line');
});

test('strokes cover the pen\'s area: a straight butt-capped line is a w x L rectangle, caps and joins add only outside it',()=>{
 const tris=[],out={t(...v){tris.push(...v);}};
 const area=()=>{let a=0;for(let i=0;i<tris.length;i+=6){const [x0,y0,x1,y1,x2,y2]=tris.slice(i,i+6);a+=Math.abs((x1-x0)*(y2-y0)-(x2-x0)*(y1-y0))/2;}return a;};
 T.strokePolyline([0,0,100,0],false,5,'miter','butt',10,out);assert.ok(close(area(),1000,1e-6),'100 x 10');
 tris.length=0;T.strokePolyline([0,0,100,0],false,5,'miter','square',10,out);assert.ok(close(area(),1100,1e-6),'square caps add half the width at each end');
 tris.length=0;T.strokePolyline([0,0,100,0],false,5,'miter','round',10,out);assert.ok(area()>1000+Math.PI*25*0.9&&area()<1000+Math.PI*25*1.01,'two half discs');
 tris.length=0;T.strokePolyline([0,0,50,0,50,50],false,5,'miter','butt',10,out);const miter=area();
 tris.length=0;T.strokePolyline([0,0,50,0,50,50],false,5,'bevel','butt',10,out);const bevel=area();
 assert.ok(miter>bevel,'the miter fills the corner the bevel cuts');
 tris.length=0;T.strokePolyline([0,0,50,0,50,0.000000001],false,5,'round','butt',10,out);assert.ok(tris.length>0);
 tris.length=0;T.strokePolyline([7,7,7,7],false,3,'round','round',10,out);assert.ok(area()>Math.PI*9*0.85,'a zero-length line with round caps is a dot (a polygon within 0.3 px of the circle)');
 tris.length=0;T.strokePolyline([7,7,7,7],false,3,'round','butt',10,out);assert.equal(tris.length,0,'and nothing with butt caps');
});

test('gradient ramps: stops interpolated unpremultiplied, then premultiplied; equal offsets make a hard edge',()=>{
 const px=new Uint8Array(1024);
 T.rampTexels([0,'#ff0000',1,'#0000ff'],px,0);
 assert.deepEqual([...px.slice(0,4)],[255,0,0,255]);assert.deepEqual([...px.slice(1020,1024)],[0,0,255,255]);
 T.rampTexels([0,'rgba(255,255,255,0)',1,'rgba(255,255,255,1)'],px,0);
 const mid=px.slice(128*4,128*4+4);assert.ok(Math.abs(mid[3]-128)<=2&&Math.abs(mid[0]-mid[3])<=1,'premultiplied: colour follows alpha');
 T.rampTexels([0,'#000',.5,'#000',.5,'#fff',1,'#fff'],px,0);
 assert.equal(px[126*4],0);assert.equal(px[130*4],255);
});

test('the game hands its screen to WebGL only after the probe, and can always fall back to the 2D canvas',()=>{
 const html=read('index.html'),game=read('game.js');
 const gl=html.indexOf('<script src="assets/gl/gl2d.js'),first=html.indexOf('<script src="assets/ui/desktop-frames.js'),main=html.indexOf('<script src="game.js');
 assert.ok(gl>0&&gl<first&&gl<main,'loaded before the game\'s other scripts, so every gradient made later is recorded');
 const pick=game.slice(game.indexOf('function screenSurface(el){'),game.indexOf("const [cv,ctx]=screenSurface($('game'));"));
 assert.ok(pick.includes('GL2D.probe()')&&pick.includes('GL2D.create(el)'),'probe first, then the real canvas');
 assert.ok(pick.includes(".webgl")&&pick.includes('DisplaySettings.normalize'),'the Settings > Video switch decides');
 assert.ok(/el\.getContext\('2d'\)===null\)\{const fresh=el\.cloneNode\(false\);el\.replaceWith\(fresh\);el=fresh;\}/.test(pick),'a canvas WebGL already took is swapped for a fresh one');
 assert.ok(pick.trim().endsWith("return [el,el.getContext('2d')];\n}")||pick.includes("return [el,el.getContext('2d')];"),'and the plain canvas is the fallback');
 /* the game's scaled copies point back at their source, which WebGL mip-maps itself */
 const mip=game.slice(game.indexOf('function mip(img,W){'),game.indexOf('/* 🧠 one memory budget'));
 assert.ok(mip.includes('src.__glSrc=img;'));
 const crisp=game.slice(game.indexOf('function crisp(img,W){'),game.indexOf('function seeThrough('));
 assert.ok(crisp.includes('out.__glSrc=img;'));
});

test('Settings > Video: WebGL on by default, only a real boolean turns it off',()=>{
 const D=require('../assets/ui/display-settings.js');
 assert.equal(D.normalize(null).webgl,true);assert.equal(D.normalize({webgl:false}).webgl,false);assert.equal(D.normalize({webgl:'no'}).webgl,true);
 const html=read('index.html');assert.ok(html.includes('id="webglChk"')&&html.includes('takes effect on restart'));
});
