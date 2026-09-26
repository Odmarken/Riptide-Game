const test=require('node:test'),assert=require('node:assert/strict');
const Traffic=require('../assets/city/traffic-animation.js'),Works=require('../assets/city/city-works.js'),Scenery=require('../assets/city/scenery-effects.js');
function context(){const calls=[],stack=[],g=new Proxy({globalAlpha:.6,
 save(){stack.push(this.globalAlpha);},restore(){assert.ok(stack.length);this.globalAlpha=stack.pop();},
 createLinearGradient(){return {addColorStop(...a){calls.push(['stop',...a]);}};},
 createRadialGradient(){return {addColorStop(...a){calls.push(['stop',...a]);}};}
},{get(o,k){if(k in o)return o[k];return(...a)=>{for(const n of a)if(typeof n==='number')assert.ok(Number.isFinite(n));calls.push([k,...a]);};}});return {g,calls,stack};}
test('wheels follow travelled distance, regardless of frame rate or cargo phase',()=>{
 const scale=.4,r=60,speed=72;
 const a=Traffic.pose(1,speed,0,scale,r),b=Traffic.pose(2,speed,0,scale,r);
 assert.equal((b.wheelAngle-a.wheelAngle)*r*scale,speed);
 assert.equal(Traffic.pose(2,speed,41,scale,r).wheelAngle,b.wheelAngle);
 assert.equal(Traffic.pose(20,0,0,scale,r).wheelAngle,0);
});
test('painted traffic separates the moving parts and restores the canvas state',()=>{
 for(const [key,p] of Object.entries(Traffic.PROFILES)){
  const im={naturalWidth:640,naturalHeight:p.height};const a=context(),b=context();
  Traffic.draw(a.g,key,im,112,0,62,0);Traffic.draw(b.g,key,im,112,.3,62,0);
  assert.notDeepEqual(a.calls,b.calls);assert.equal(a.stack.length,0);assert.equal(a.g.globalAlpha,.6);
  assert.ok(a.calls.some(c=>c[0]==='clip'&&c[1]==='evenodd'),'old spokes and hooves are cut out');
 }
});
test('litter waits for its PNG instead of drawing the old brown placeholder',()=>{
 const world={streets:[{x0:0,y0:100,x1:1200,y1:100,w:240}]},view={x:0,y:0,w:1200,h:200},a=context();
 Works.drawLitter(a.g,world,view,3,0,{});assert.equal(a.calls.length,0);
 const im={complete:true,naturalWidth:767,naturalHeight:443};
 Works.drawLitter(a.g,world,view,3,0,{street_dung:im});assert.ok(a.calls.some(c=>c[0]==='drawImage'&&c[1]===im));
 const clean=context();Works.drawLitter(clean.g,world,view,0,0,{street_dung:im});assert.equal(clean.calls.length,0);
});
test('smoke and contact shadows preserve a faded building and fade to transparent edges',()=>{
 const a=context();Scenery.smoke(a.g,0,0,1,20,3,false);Scenery.shadow(a.g,0,0,60,12,.24);
 assert.equal(a.g.globalAlpha,.6);assert.equal(a.stack.length,0);
 assert.ok(a.calls.some(c=>c[0]==='stop'&&c[1]===1&&/0\)$/.test(c[2])));
});

test('fire and soot remain deterministic across skipped frames, including negative seeds',()=>{
 for(const seed of [-47,0,91])for(const t of [0,3.7,10000]){
  const a=context(),b=context();
  Scenery.fire(a.g,12,-30,1.3,t,seed);
  Scenery.fire(b.g,12,-30,1.3,t+100,seed);b.calls.length=0;
  Scenery.fire(b.g,12,-30,1.3,t,seed);
  assert.deepEqual(a.calls,b.calls,'scrolling offscreen does not restart the particles');
  assert.equal(a.g.globalAlpha,.6);assert.equal(a.stack.length,0);
  for(const [,offset] of a.calls.filter(c=>c[0]==='stop'))assert.ok(offset>=0&&offset<=1);
 }
 const a=context(),b=context();Scenery.flame(a.g,0,0,1,3,7);Scenery.flame(b.g,0,0,1,3.1,7);
 assert.notDeepEqual(a.calls,b.calls,'flame tips move with time');
 for(let t=0;t<100;t+=.03)assert.ok(Scenery.flicker(t,-23)>=.81&&Scenery.flicker(t,-23)<=1);
});

test('the browser flame atlas has a bounded cache and transparent, warm density pixels',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),canvases=[];
 class Canvas {
  constructor(w,h){this.width=w;this.height=h;canvases.push(this);}
  getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:im=>{this.pixels=im.data;}};}
 }
 const box=vm.createContext({OffscreenCanvas:Canvas});
 vm.runInContext(fs.readFileSync(require.resolve('../assets/city/scenery-effects.js'),'utf8'),box);
 const g=context().g;
 for(let cycle=0;cycle<3;cycle++)for(let i=0;i<64;i++)box.CityScenery.flame(g,0,0,1,(cycle+i/64)/.7,0);
 assert.equal(canvases.length,32,'all lamps reuse the same bounded animation cache');
 const p=canvases[0].pixels;
 assert.ok(p.some((v,i)=>i%4===3&&v===0),'outside the flame is transparent');
 assert.ok(p.some((v,i)=>i%4===3&&v>200),'the fuel bed stays bright');
 assert.ok(p.some((v,i)=>i%4===3&&v>0&&v<120),'edges fade without a hard outline');
 assert.notDeepEqual(canvases[0].pixels,canvases[10].pixels,'the density moves through the atlas');
 box.CityScenery.smoke(g,0,0,1,2,0,false,true);
 assert.equal(canvases.length,35,'only three reusable soot sprites');
});
