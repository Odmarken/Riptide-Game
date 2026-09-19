/* The Throne Hall above the City: two connected rooms the actor can walk between, a king on his dais,
 * the King's Hand at a council table for six, eight guards at the pillars, and drawing routines that
 * never hand the canvas a non-finite number. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const World=require('../assets/city/throne-world.js');

test('the hall is a safe interior with a spawn by the doors, an exit to the City and no enemies',()=>{
 const w=World.create();
 assert.equal(w.throne,true);assert.equal(w.kind,'thronehall');
 assert.deepEqual(w.enemySpawns,[]);assert.deepEqual(w.mwalls,[]);
 assert.equal(w.exit.id,'city');assert.ok(w.portal.x<0&&w.portal.y<0);
 assert.ok(Math.hypot(w.spawn.x-w.exit.x,w.spawn.y-w.exit.y)>150,'you arrive clear of the door that takes you back');
 assert.equal(w.w,World.W);assert.equal(w.h,World.H);
});

test('an actor disk walks from the doors up the carpet, round the dais and into the council chamber',()=>{
 const w=World.create();
 for(let y=w.spawn.y;y>=World.DAIS.y+World.DAIS.h+40;y-=4)assert.ok(World.contains(900,y,30),'the carpet is blocked at '+y);
 /* through the west passage past the dais and up to the table */
 const door=World.DOORS[0],dx=door.x+door.w/2;
 for(let y=door.y+door.h+20;y>=door.y-20;y-=4)assert.ok(World.contains(dx,y,30),'the west passage is blocked at '+y);
 for(let x=dx;x<=World.HAND.x;x+=4)assert.ok(World.contains(x,World.HAND.y,30),'the chamber is blocked at '+x);
 for(const p of [w.spawn,w.exit,World.KING,World.HAND,...w.npcs])assert.ok(World.contains(p.x,p.y,13),`${p.name||'point'} stands on the floor`);
});

test('the walls hold: nothing accepted by the collision routine sticks through the perimeter',()=>{
 for(const [x,y,r,expected] of [[900,2000,30,true],[900,1000,30,false],[900,1185,30,true],[900,1175,30,false],[395,1000,30,true],[395,1000,80,false],
  [262,2000,13,false],[264,2000,13,true],[900,3239,13,false],[900,3236,13,true],[600,1100,10,false],[900,320,13,true],[900,305,13,false]]){
  assert.equal(World.contains(x,y,r),expected,`${x},${y},r=${r}`);
 }
 for(const [x,y] of [[NaN,900],[900,Infinity],[Infinity,900]])assert.equal(World.contains(x,y),false);
 assert.equal(World.contains(900,2000,Infinity),false);
 for(let y=100;y<3400;y+=31)for(let x=100;x<1800;x+=37)if(World.contains(x,y,30)){
  for(let i=0;i<32;i++)assert.ok(World.contains(x+Math.cos(i*Math.PI/16)*29.99,y+Math.sin(i*Math.PI/16)*29.99),`disk escaped at ${x},${y}`);
 }
});

test('the court: eight named guards at the pillars, the king before his throne, the Hand at the table',()=>{
 const w=World.create();
 const guards=w.npcs.filter(n=>n.guard),king=w.npcs.find(n=>n.game==='king'),hand=w.npcs.find(n=>n.game==='ledger');
 assert.equal(guards.length,8);assert.equal(new Set(guards.map(n=>n.name)).size,8);
 assert.ok(guards.every(n=>n.skin==='royal_guard'&&n.speed===0&&n.pauseT>1e8&&!n.moving&&n.pts.length===1));
 for(const n of guards.slice(0,6)){
  const pillar=w.solids.find(s=>s.kind==='pillar'&&Math.abs(s.y-n.y)<20&&Math.abs(s.x-n.x)<100);
  assert.ok(pillar,`${n.name} stands by a pillar`);
  assert.equal(Math.sign(n.fx),-Math.sign(pillar.side),`${n.name} faces the carpet`);
 }
 assert.equal(king.name,World.KING_NAME);assert.equal(king.skin,'king');assert.ok(king.big>1.4);assert.equal(king.royal,true);
 const throne=w.solids.find(s=>s.kind==='throne');
 assert.ok(throne.y<king.y&&Math.abs(throne.x-king.x)<1,'the throne is drawn behind the king');
 assert.equal(hand.name,World.HAND_NAME);assert.equal(hand.skin,'kings_hand');
 const table=w.solids.find(s=>s.kind==='table');
 assert.ok(hand.y>table.y+table.cry&&Math.abs(hand.x-table.x)<1,'the Hand stands at the near end of the table');
 assert.ok(table.crx>200&&table.cry>90,'the table blocks a broad ellipse');
 assert.equal(w.solids.filter(s=>s.kind==='pillar').length,10);
 assert.ok(w.solids.every(s=>s.type==='throneprop'&&s.r>0));
 /* nobody stands inside a blocked prop */
 for(const n of w.npcs)for(const s of w.solids){
  if(s.crx){const kx=(n.x-s.x-(s.cxo||0))/(s.crx+13),ky=(n.y-s.y-(s.cyo||0))/(s.cry+13);assert.ok(kx*kx+ky*ky>=1,`${n.name} is inside the ${s.kind}`);}
  else assert.ok(Math.hypot(n.x-s.x,n.y-s.y)>=13+s.r*.8,`${n.name} is inside a ${s.kind}`);
 }
});

function fakeContext(count){
 return new Proxy({
  createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};},
  createPattern(){count.patterns++;return{};},
  fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',lineCap:'',globalAlpha:1
 },{get(o,k){if(k in o)return o[k];return(...args)=>{
  count.calls++;if(k==='drawImage')count.draws++;
  if(['fillRect','strokeRect','arc','ellipse','translate','scale','moveTo','lineTo','rect','quadraticCurveTo','bezierCurveTo','transform','fillText','strokeText','roundRect'].includes(k))
   for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${k} got ${arg}`);
  if(k==='drawImage')for(const arg of args.slice(1))assert.ok(Number.isFinite(arg),`drawImage got ${arg}`);
 };},set(o,k,v){o[k]=v;return true;}});
}
const image={complete:true,naturalWidth:512,naturalHeight:512};

test('the ground paints once into a static layer, then blits the visible slice and lights it per frame',()=>{
 const count={calls:0,draws:0,patterns:0},layers=[];
 const createCanvas=(w,h)=>{const c={width:w,height:h,getContext:()=>fakeContext(count)};layers.push(c);return c;};
 const w=World.create(),g=fakeContext(count);
 World.renderGround(g,w,{x:200,y:2400,w:1200,h:700},{images:{raidwall:image,raidfloor:image},time:1.5,createCanvas});
 assert.ok(layers.length>=1,'a static layer was created');
 const before=layers.length,drawsBefore=count.draws;
 World.renderGround(g,w,{x:200,y:2400,w:1200,h:700},{images:{raidwall:image,raidfloor:image},time:2.5,createCanvas});
 assert.equal(layers.length,before,'the static layer is reused');
 assert.ok(count.draws>drawsBefore,'the visible slice is blitted every frame');
 /* a view hanging off the world does not ask drawImage for a negative source rect */
 World.renderGround(g,w,{x:-600,y:-400,w:1400,h:900},{images:{raidwall:image,raidfloor:image},time:3,createCanvas});
 World.renderGround(g,w,{x:1500,y:3200,w:1400,h:900},{images:{raidwall:image,raidfloor:image},time:3,createCanvas});
});

test('props draw with finite geometry as paintings, and as canvas scenery until the paintings load',()=>{
 const count={calls:0,draws:0,patterns:0},g=fakeContext(count),w=World.create();
 const art={throne:image,table:image,pillar:image,brazier:image};
 for(const s of w.solids){World.drawShadow(g,s);World.drawProp(g,s,1.2,{raidwall:image,raidfloor:image});}
 assert.equal(count.draws,0,'no painting loaded: canvas scenery only');
 const before=count.calls;
 for(const s of w.solids)World.drawProp(g,s,1.2,art);
 assert.equal(count.draws,w.solids.length,'one blit per prop once its painting is in');
 assert.ok(before>200);
 for(const kind of ['pillar','throne','table','brazier'])assert.ok(World.ART[kind].h>0&&World.ART[kind].drop>=0,kind);
 /* every flame sits inside its picture */
 for(const a of Object.values(World.ART))assert.ok(a.glow[0]>=0&&a.glow[0]<=1&&a.glow[1]>=0&&a.glow[1]<=1);
 /* 🔥 the braziers by the throne and the pillar torches burn; the throne and the table do not */
 assert.deepEqual(Object.keys(World.ART).filter(k=>World.ART[k].fire).sort(),['brazier','pillar']);
 for(const a of Object.values(World.ART))if(a.fire)assert.ok(a.fire[0]>0&&a.fire[0]<1&&a.fire[1]>0&&a.fire[1]<1&&a.fire[2]>0);
 /* the fire is a pure function of time: two frames draw the same number of marks, all finite */
 const brazier=w.solids.find(s=>s.kind==='brazier'),c0=count.calls;
 World.drawProp(g,brazier,3.2,art);const one=count.calls-c0;
 World.drawProp(g,brazier,97.45,art);assert.equal(count.calls-c0-one,one);
 assert.ok(one>60,'flames, embers, sparks and smoke');
});
