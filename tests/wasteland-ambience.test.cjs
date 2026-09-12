const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../assets/wasteland/world.js');
const A=require('../assets/wasteland/ambience.js');
const keys=['briarhollow','cindervein','frostveil'];
function context(){
 const calls=[],stack=[],styles=['globalAlpha','globalCompositeOperation','shadowBlur','lineWidth','lineCap','lineJoin','fillStyle','strokeStyle'];
 const g={calls,globalAlpha:.43,globalCompositeOperation:'multiply',shadowBlur:4,lineWidth:7,lineCap:'square',lineJoin:'bevel',fillStyle:'#123',strokeStyle:'#456'};
 g.save=()=>{stack.push(styles.map(k=>g[k]));calls.push(['save']);};
 g.restore=()=>{const s=stack.pop();assert.ok(s);styles.forEach((k,i)=>g[k]=s[i]);calls.push(['restore']);};
 for(const m of ['beginPath','moveTo','lineTo','closePath','rect','clip','fillRect'])g[m]=(...args)=>calls.push([m,...args]);
 g.fill=()=>calls.push(['fill',g.fillStyle,g.globalAlpha]);
 g.stroke=()=>calls.push(['stroke',g.strokeStyle,g.globalAlpha,g.lineWidth]);
 return g;
}
function bossView(world){const r=world.bossRooms[0];return {x:r.cx-560,y:r.cy-450,w:1120,h:900};}

test('all ambience uses the real visible floor clip, finite paths and a balanced caller context',()=>{
 const palettes=[];
 for(const key of keys){
  const world=W.create(key),view=bossView(world),g=context();A.draw(g,world,view,5);
  assert.equal(g.calls[0][0],'save');assert.equal(g.calls.at(-1)[0],'restore');
  assert.equal(g.globalAlpha,.43);assert.equal(g.globalCompositeOperation,'multiply');assert.equal(g.shadowBlur,4);assert.equal(g.lineWidth,7);
  const clip=g.calls.findIndex(c=>c[0]==='clip'),paint=g.calls.findIndex(c=>c[0]==='fill');assert.ok(clip>0&&paint>clip);
  for(const c of g.calls)for(const v of c)if(typeof v==='number')assert.ok(Number.isFinite(v));
  const rects=g.calls.filter(c=>c[0]==='rect');assert.ok(rects.length>0);
  for(const [,x,y,w,h] of rects){
   assert.ok(x>=view.x&&y>=view.y&&x+w<=view.x+view.w&&y+h<=view.y+view.h);
   assert.ok(W.isWalkable(world,x+w/2,y+h/2,0),'clipping rectangles contain actual floor');
  }
  assert.ok(g.calls.filter(c=>c[0]==='stroke'||c[0]==='fill'||c[0]==='fillRect').length<300,'visible-room paint stays bounded');
  palettes.push([...new Set(g.calls.filter(c=>c[0]==='fill'||c[0]==='stroke').map(c=>c[1]))].join(','));
 }
 assert.equal(new Set(palettes).size,3,'each theme has distinct ground colours');
});

test('seeded accents stay stable across renders and revisits without modifying world geometry',()=>{
 for(const key of keys){
  const world=W.create(key,41),view=bossView(world),before=JSON.stringify({rooms:world.rooms,floors:world.floors,solids:world.solids});
  const first=context(),second=context(),reentry=context();
  A.draw(first,world,view,0);A.draw(second,world,view,0);A.draw(reentry,W.create(key,41),view,0);
  assert.deepEqual(second.calls,first.calls);assert.deepEqual(reentry.calls,first.calls);
  assert.equal(JSON.stringify({rooms:world.rooms,floors:world.floors,solids:world.solids}),before);
  const later=context();A.draw(later,world,view,20);
  const terrain=calls=>calls.filter(c=>['moveTo','lineTo','rect'].includes(c[0]));
  assert.deepEqual(terrain(later.calls),terrain(first.calls),'only tiny ground lights animate, never the terrain');
 }
});

test('non-dungeon, invalid and distant views do no work; a whole-map view remains bounded',()=>{
 for(const world of [W.create(),W.create('frostveil')]){
  for(const view of [{x:NaN,y:0,w:100,h:100},{x:0,y:0,w:0,h:100},{x:-1e7,y:-1e7,w:100,h:100}]){
   const g=context();A.draw(g,world,view,Infinity);assert.equal(g.calls.length,0);
  }
 }
 for(const key of keys){
  const world=W.create(key),g=context();A.draw(g,world,{x:0,y:0,w:1e9,h:1e9},NaN);
  assert.ok(g.calls.filter(c=>['fill','stroke','fillRect'].includes(c[0])).length<1200);
  for(const c of g.calls)for(const v of c)if(typeof v==='number')assert.ok(Number.isFinite(v));
 }
});
