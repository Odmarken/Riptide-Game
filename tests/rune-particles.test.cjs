const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../assets/weapons/rune-particles.js'), 'utf8');

function recorder() {
 const stack=[],draws=[],scales=[],points=[],ellipses=[];
 const g={globalAlpha:.65,globalCompositeOperation:'multiply',lineWidth:3,
  save(){stack.push({alpha:this.globalAlpha,blend:this.globalCompositeOperation,width:this.lineWidth});},
  restore(){const s=stack.pop();assert.ok(s);this.globalAlpha=s.alpha;this.globalCompositeOperation=s.blend;this.lineWidth=s.width;},
  translate(){},rotate(){},scale(x,y){scales.push([x,y]);},beginPath(){},closePath(){},fill(){},stroke(){},
  moveTo(...p){points.push(p);},lineTo(...p){points.push(p);},
  ellipse(...p){ellipses.push(p);},
  quadraticCurveTo(...p){for(let i=0;i<p.length;i+=2)points.push(p.slice(i,i+2));},
  bezierCurveTo(...p){for(let i=0;i<p.length;i+=2)points.push(p.slice(i,i+2));},
  drawImage(img,...rect){draws.push({img,rect,alpha:this.globalAlpha,blend:this.globalCompositeOperation});},
  createLinearGradient(){return {addColorStop(){}};},
 };
 return {g,draws,scales,points,stack,ellipses};
}
function harness(){
 const canvases=[];let gradients=0;
 const context=vm.createContext({document:{createElement(tag){
  assert.equal(tag,'canvas');const rec=recorder();
  rec.g.createLinearGradient=()=>{gradients++;return {addColorStop(){}};};
  const cv={getContext:()=>rec.g,rec};canvases.push(cv);return cv;
 }}});
 vm.runInContext(source,context,{filename:'rune-particles.js'});
 return {context,canvases,get gradients(){return gradients;}};
}
const particle=(runeFx,extra={})=>({runeFx,x:10,y:20,vx:3,vy:70,r:.7,t:.1,life:.8,c:'#abcdef',...extra});

test('ordinary particles are untouched, while invalid or expired rune particles are safely consumed',()=>{
 const h=harness(),rec=recorder();
 assert.equal(h.context.drawRuneParticle(rec.g,{x:0,y:0}),false);
 assert.equal(h.context.drawRuneParticle(rec.g,particle('unknown')),false);
 for(const extra of [{x:NaN},{y:Infinity},{r:0},{r:-1},{r:NaN},{life:0},{life:NaN},{t:Infinity},{t:1}])
  assert.equal(h.context.drawRuneParticle(rec.g,particle('water',extra)),true);
 assert.equal(rec.draws.length,0);assert.equal(rec.stack.length,0);assert.equal(h.canvases.length,0);
 assert.equal(rec.g.globalAlpha,.65);assert.equal(rec.g.globalCompositeOperation,'multiply');
});

test('liquid silhouettes have compact tails and narrow as falling speed increases',()=>{
 const h=harness();
 for(const kind of ['water','blood','venom']){
  const slow=recorder(),fast=recorder();
  h.context.drawRuneParticle(slow.g,particle(kind,{vx:0,vy:0}));
  h.context.drawRuneParticle(fast.g,particle(kind,{vx:0,vy:300}));
  assert.equal(slow.scales[0][0],1);assert.equal(fast.scales[0][0],1);
  assert.ok(fast.scales[0][1]<slow.scales[0][1]);assert.ok(fast.scales[0][1]>=.7);
  const {points}=slow.draws[0].img.rec;
  assert.ok(points.every(([x,y])=>x>=-2.3&&x<=1.1&&Math.abs(y)<=1));
  assert.equal(slow.draws[0].img,fast.draws[0].img,'Speed changes reuse the same shaded material');
 }
});

test('cached materials are bounded independently of particle count, radius, age and supplied colour',()=>{
 const h=harness(),rec=recorder();
 for(let i=0;i<30;i++)for(const kind of ['water','blood','venom','ember','gold','spark']){
  h.context.drawRuneParticle(rec.g,particle(kind,{r:.4+i*.01,t:(i%10)*.075,c:`rgb(${i},40,90)`}));
 }
 assert.equal(h.canvases.length,6,'Three liquids, flame, coal and gold; sparks use a small path');
 assert.equal(h.gradients,5,'No per-particle gradients or colour-dependent cache growth');
});

test('fire cools from an asymmetric flame to coal, not the liquid silhouette',()=>{
 const h=harness(),young=recorder(),old=recorder();
 h.context.drawRuneParticle(young.g,particle('ember',{t:0,life:1,vy:-40}));
 h.context.drawRuneParticle(old.g,particle('ember',{t:.9,life:1,vy:-40}));
 assert.equal(young.draws.length,1);assert.equal(old.draws.length,1);
 assert.notEqual(young.draws[0].img,old.draws[0].img);
 assert.ok(young.draws[0].img.rec.points.some(([,y])=>y<-2.5),'A tapered flame rises well above its base');
 assert.ok(old.draws[0].img.rec.points.every(([x,y])=>Math.abs(x)<.7&&Math.abs(y)<.7));
 assert.ok(old.draws[0].alpha<young.draws[0].alpha);
});

test('all materials fade with age and preserve caller alpha, blend mode and canvas saves',()=>{
 const h=harness();
 for(const kind of ['water','blood','venom','ember','gold','spark','water-splash','blood-splash','venom-splash']){
  const rec=recorder();
  h.context.drawRuneParticle(rec.g,particle(kind,{t:-1}));
  assert.equal(rec.g.globalAlpha,.65,kind);assert.equal(rec.g.globalCompositeOperation,'multiply',kind);
  assert.equal(rec.g.lineWidth,3,kind);assert.equal(rec.stack.length,0,kind);
  assert.ok(rec.draws.every(d=>d.alpha>=0&&d.alpha<=.65&&d.blend==='source-over'),kind);
 }
 const young=recorder(),old=recorder();
 h.context.drawRuneParticle(young.g,particle('water',{t:0}));
 h.context.drawRuneParticle(old.g,particle('water',{t:.79}));
 assert.ok(old.draws[0].alpha<young.draws[0].alpha*.1);
});

test('ground contacts stay flat and bounded even when a large droplet lands',()=>{
 const h=harness();
 for(const kind of ['water-splash','blood-splash','venom-splash']){
  const rec=recorder();
  assert.equal(h.context.drawRuneParticle(rec.g,particle(kind,{r:4,t:.1})),true);
  assert.ok(rec.ellipses.length>0);
  for(const [x,y,rx,ry] of rec.ellipses){
   assert.equal(x,0);assert.equal(y,0);assert.ok(rx<=2&&ry<=rx*.31);
  }
  assert.equal(rec.draws.length,0,'Ground contacts do not require extra sprite caches');
 }
});
