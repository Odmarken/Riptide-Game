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
 assert.ok(hand.y>table.y+table.cry&&hand.x<table.x-150,'the Hand stands before the near-left chair of the table');
 assert.ok(table.crx>200&&table.cry>90,'the table blocks a broad ellipse');
 /* 🏛 five councillors round the table, ids matching the economy's seats; the near-left chair is the King's Hand's, and the steward sits as Master of Coin */
 const Economy=require('../assets/city/economy.js');
 const seats=w.npcs.filter(n=>n.game==='council');
 assert.deepEqual(seats.map(n=>n.seat),Economy.COUNCIL.map(c=>c.id));
 assert.equal(seats.length,5);assert.equal(seats.filter(n=>n.y<table.y).length,3);assert.equal(seats.filter(n=>n.y>table.y).length,2);
 assert.ok(!seats.some(n=>n.seat===Economy.PLAYER_SEAT.id),'no councillor holds the Master of Coin’s seat: it is the steward’s');
 assert.ok(seats.find(n=>n.seat==='bread').y<table.y,'Gottfrid Pung stands behind the far-left chair, where he always stood');
 for(const n of seats){assert.ok(n.name.includes('\u00b7'));assert.ok(World.contains(n.x,n.y,13));assert.ok(Math.hypot(n.x-hand.x,n.y-hand.y)>80,n.name+' crowds the Hand');}
 assert.match(seats.find(n=>n.seat==='bread').name,/^Gottfrid Pung/);assert.ok(!w.npcs.some(n=>/Agnes/.test(n.name)));
 assert.equal(w.solids.filter(s=>s.kind==='pillar').length,10);
 assert.ok(w.solids.every(s=>s.type==='throneprop'&&s.r>0));
 /* nobody stands inside a blocked prop */
 for(const n of w.npcs)for(const s of w.solids){
  if(s.crx){const kx=(n.x-s.x-(s.cxo||0))/(s.crx+13),ky=(n.y-s.y-(s.cyo||0))/(s.cry+13);assert.ok(kx*kx+ky*ky>=1,`${n.name} is inside the ${s.kind}`);}
  else assert.ok(Math.hypot(n.x-s.x,n.y-s.y)>=13+s.r*.8,`${n.name} is inside a ${s.kind}`);
 }
});

test('the gaol: a stair down through the west wall by the doors, ten barred cells and a gaoler at his desk',()=>{
 const w=World.create(),G=World.GAOL;
 assert.ok(G.y>World.HALL_H,'the gaol lies below the storey of the hall');assert.ok(w.h>=G.y+G.h+150);
 /* on your left as you come in: the stair is in the WEST wall, between the last pillar and the doors */
 assert.ok(World.STAIR_DOWN.x<World.HALL.x&&World.STAIR_DOWN.y>World.PILLAR_Y[World.PILLAR_Y.length-1]&&World.STAIR_DOWN.y<World.EXIT.y);
 /* a disk walks from the spawn to the stair-head, and from where it lands below to the gaoler and back up */
 for(let x=w.spawn.x;x>=World.HALL_ARRIVE.x;x-=4)assert.ok(World.contains(x,w.spawn.y+(World.HALL_ARRIVE.y-w.spawn.y)*(w.spawn.x-x)/(w.spawn.x-World.HALL_ARRIVE.x),13));
 for(let x=World.HALL_ARRIVE.x;x>=World.STAIR_DOWN.x;x-=2)assert.ok(World.contains(x,World.STAIR_DOWN.y,13),'the way down is blocked at '+x);
 for(let x=World.GAOL_ARRIVE.x;x<=World.STAIR_UP.x;x+=2)assert.ok(World.contains(x,World.STAIR_UP.y,13),'the way up is blocked at '+x);
 assert.ok(Math.hypot(World.HALL_ARRIVE.x-World.STAIR_DOWN.x,World.HALL_ARRIVE.y-World.STAIR_DOWN.y)>World.STAIR_DOWN.r+40,'arriving upstairs does not send you straight back down');
 assert.ok(Math.hypot(World.GAOL_ARRIVE.x-World.STAIR_UP.x,World.GAOL_ARRIVE.y-World.STAIR_UP.y)>World.STAIR_UP.r+40);
 assert.ok(World.contains(World.GAOL_ARRIVE.x,World.GAOL_ARRIVE.y,13)&&World.contains(World.HALL_ARRIVE.x,World.HALL_ARRIVE.y,13));
 /* the alcoves hold a disk: nothing the routine accepts sticks through a wall */
 for(const a of [World.STAIR,World.UPSTAIR])for(let y=a.y-40;y<a.y+a.h+40;y+=7)for(let x=a.x-40;x<a.x+a.w+40;x+=7)if(World.contains(x,y,13)){
  for(let i=0;i<16;i++)assert.ok(World.contains(x+Math.cos(i*Math.PI/8)*12.99,y+Math.sin(i*Math.PI/8)*12.99),'disk escaped at '+x+','+y);
 }
 assert.equal(World.contains(100,World.STAIR_DOWN.y,13),false);assert.equal(World.contains(World.STAIR.x+40,World.STAIR.y-20,13),false);
 /* ten cells along the north wall, inside the room's width, none of them walkable */
 assert.equal(World.CELLS.length,10);
 const bars=w.solids.filter(s=>s.kind==='bars');
 assert.deepEqual(bars.map(s=>s.cell),[0,1,2,3,4,5,6,7,8,9]);assert.ok(bars.every(s=>s.noCol&&!s.walled));
 for(const c of World.CELLS){assert.ok(c.x-44>=G.x&&c.x+44<=G.x+G.w);assert.equal(World.contains(c.x,c.y-40,5),false,'a cell is not floor');}
 const gaoler=w.npcs.find(n=>n.game==='gaol'),desk=w.solids.find(s=>s.kind==='gaoldesk');
 assert.equal(gaoler.name,World.GAOLER_NAME);assert.ok(desk.y>gaoler.y,'he stands behind his desk');assert.ok(!gaoler.guard,'he is not one of the eight');
 /* a prisoner stands behind his grille, so the bars are drawn over him */
 const p=World.prisoner(3,{name:'Bodil Vass',skin:'baker',female:true,crime:'stole a ham',say:'It fell into my coat.'});
 assert.equal(p.prisoner,true);assert.equal(p.female,true);assert.equal(p.x,World.CELLS[3].x);assert.ok(p.y<bars[3].y);assert.equal(p.speed,0);
 assert.notEqual(World.prisoner(3,p,1).x,World.prisoner(3,p,2).x,'two to a cell stand apart');
 assert.ok(World.prisoner(13,{name:'x'}).x===World.CELLS[3].x,'an overflow wraps round the cells');
 assert.ok(World.prisoner(0,{name:'Alarik',skin:'king'}).big>1.2,'a deposed king is still a big man');
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

test('a late-loading drain replaces the cached jail floor once; painted torches render every frame',()=>{
 const count={calls:0,draws:0,patterns:0},layers=[],artDraws=[];
 const drain={complete:false,naturalWidth:0,naturalHeight:0},torch={complete:true,naturalWidth:245,naturalHeight:995};
 const context=()=>{const g=fakeContext(count);g.drawImage=(im,...args)=>{for(const n of args)assert.ok(Number.isFinite(n));artDraws.push(im);};return g;};
 const createCanvas=(width,height)=>{const c={width,height,getContext:context};layers.push(c);return c;};
 const world=World.create(),g=context(),view={x:0,y:0,w:World.W,h:World.H};
 const options={images:{drain_cover:drain,wall_torch:torch},time:0,createCanvas};
 World.renderGround(g,world,view,options);const before=layers.length;
 assert.ok(artDraws.includes(torch));assert.ok(!artDraws.includes(drain));
 Object.assign(drain,{complete:true,naturalWidth:866,naturalHeight:494});
 World.renderGround(g,world,view,{...options,time:1});assert.equal(layers.length,before+2);assert.ok(artDraws.includes(drain));
 World.renderGround(g,world,view,{...options,time:2});assert.equal(layers.length,before+2);
});

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
 const art={throne:image,table:image,pillar:image,brazier:image,gaoldesk:image};   /* not the grilles: the module remembers every painting it is handed, and the gaol test below wants their canvas stand-ins */
 for(const s of w.solids){World.drawShadow(g,s);World.drawProp(g,s,1.2,{raidwall:image,raidfloor:image});}
 assert.equal(count.draws,0,'no painting loaded: canvas scenery only');
 const before=count.calls;
 for(const s of w.solids)World.drawProp(g,s,1.2,art);
 assert.equal(count.draws,w.solids.filter(s=>World.ART[s.kind]).length,'one blit per painted prop once its painting is in');
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

/* runs last: the layers are cached per set of loaded images, and this is the first call that has the crypt stone */
test('the gaol paints into a layer of its own and its props draw with finite geometry',()=>{
 const count={calls:0,draws:0,patterns:0},layers=[];
 const createCanvas=(w,h)=>{const c={width:w,height:h,getContext:()=>fakeContext(count)};layers.push(c);return c;};
 const w=World.create(),g=fakeContext(count);
 World.renderGround(g,w,{x:300,y:4100,w:1200,h:700},{images:{raidwall:image,raidfloor:image,cryptwall:image,crypt:image},time:1.5,createCanvas});
 assert.ok(layers.some(c=>c.height===World.HALL_H)&&layers.some(c=>c.width===World.GAOL.w+460),'one layer per storey');
 assert.ok(count.draws>=1,'the gaol slice is blitted');
 const before=count.calls;
 for(const s of w.solids.filter(s=>s.kind==='bars'||s.kind==='gaoldesk')){World.drawShadow(g,s);World.drawProp(g,s,2.2,{});World.drawProp(g,{...s,walled:true},2.2,{});}
 assert.ok(count.calls-before>200);
 /* 🎨 the cell grilles and the bricked-up doorways are paintings too, once theirs are in: one blit a cell */
 const cells=w.solids.filter(x=>x.kind==='bars'),was=count.draws;
 for(const c of cells)World.drawProp(g,c,1.2,{bars:image,bricked:image});
 assert.equal(count.draws-was,cells.length,'one blit a cell');
});
