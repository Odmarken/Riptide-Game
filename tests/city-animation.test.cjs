const test=require('node:test'),assert=require('node:assert/strict');
const close=(a,b,m)=>assert.ok(Math.abs(a-b)<1e-9,m+': '+a+' vs '+b);
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
test('the handcart family walks: each leg swings about its own joint only while the cart travels',()=>{
 const p=Traffic.PROFILES.handcart,walkers=p.legs;
 assert.equal(walkers.length,6,'the father\'s two legs, the mother\'s and the girl\'s two feet');
 const inside=(pts,x,y)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
 for(let y=200.37;y<313;y+=.5)for(let x=.61;x<640;x+=.5){
  const cuts=walkers.filter(w=>inside(w.cut,x,y));
  assert.ok(cuts.length<2,`cuts overlap at ${x},${y} - evenodd would paint the still leg back in`);
  for(const w of cuts)assert.ok(inside(w.pts,x,y)||walkers.some(o=>o!==w&&inside(o.pts,x,y)),`the removed still at ${x},${y} is repainted by a swinging piece`);
  for(const [cx,cy,rx,ry] of p.wheels)assert.ok(!cuts.length||((x-cx)/rx)**2+((y-cy)/ry)**2>1,'no cut reaches the wheel');
 }
 const angles=(time,speed)=>{const calls=[];const g=new Proxy({save(){},restore(){}},{get(o,k){if(k in o)return o[k];return(...a)=>calls.push([k,...a]);}});
  Traffic.draw(g,'handcart',{naturalWidth:640,naturalHeight:313},88,time,speed,20);return calls.filter(c=>c[0]==='rotate').slice(0,walkers.length).map(c=>c[1]);};
 assert.ok(angles(3,0).every(a=>a===0),'a halted cart stands still');
 const a=angles(1,34),b=angles(1.4,34);assert.notDeepEqual(a,b);
 a.forEach((v,i)=>assert.ok(Math.abs(v)<=walkers[i].swing+1e-12,'a little swing, never more'));
 const t=.9,man=angles(t,34);close(man[0],-man[1],'the father\'s legs swing in opposite phase');
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

test('painted hall fire moves its original pixels once while the stand stays fixed',()=>{
 const im={naturalWidth:352,naturalHeight:640},a=context(),b=context();
 Scenery.paintedFlame(a.g,im,121,220,-210,[0,0,1,.265],2,7);
 Scenery.paintedFlame(b.g,im,121,220,-210,[0,0,1,.265],2.3,7);
 const draws=c=>c.calls.filter(x=>x[0]==='drawImage'),one=draws(a),two=draws(b);
 assert.deepEqual(one[0],two[0],'the metal and coals never move');
 assert.notDeepEqual(one.slice(1),two.slice(1),'the painted flame stretches and curls');
 assert.ok(one.every(x=>x[1]===im),'no generated flame on top of the original');
 assert.ok(a.calls.some(x=>x[0]==='clip'&&x[1]==='evenodd'),'the old static flame is excluded');
 assert.equal(a.g.globalAlpha,.6);assert.equal(a.stack.length,0);
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
