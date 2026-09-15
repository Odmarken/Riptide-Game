const test=require('node:test');
const assert=require('node:assert/strict');
const World=require('../assets/tides/guild-world.js');
const Tides=require('../assets/tides/core.js');

test('guild is a safe underground hall with a connected corridor and return stairs',()=>{
 const world=World.create({catalog:Tides.allSpecies(),rng:()=>.42});
 assert.equal(world.guild,true);assert.equal(world.kind,'tidesguild');
 assert.deepEqual(world.enemySpawns,[]);assert.deepEqual(world.solids,[]);
 assert.equal(world.exit.id,'city');assert.ok(world.portal.x<0&&world.portal.y<0);
 // Walk the complete approach with the normal actor radius, including the
 // circular doorway where independent inset shapes can otherwise leave a gap.
 for(let y=world.spawn.y;y>=world.hall.y;y-=4)assert.ok(World.contains(1100,y,30),'corridor blocked at '+y);
 for(const p of [world.spawn,world.exit,...world.npcs,...world.npcs.flatMap(n=>n.tideSpot?[n.tideSpot]:[])])assert.ok(World.contains(p.x,p.y,30));
});

test('guild collision keeps entire actor disks inside the circular hall and corridor',()=>{
 for(const [x,y,r,expected]of [[1100,900,30,true],[1100,130,30,false],[1100,150,30,true],
  [980,2000,20,false],[990,2000,20,true],[1100,2490,20,false],[1100,2480,20,true],
  [1300,1950,0,false],[700,1800,0,false],[1100,1700,40,true],[1200,1690,20,true]]){
  assert.equal(World.contains(x,y,r),expected,`${x},${y},r=${r}`);
 }
 for(const [x,y]of [[NaN,900],[1100,Infinity],[Infinity,2000]])assert.equal(World.contains(x,y),false);
 assert.equal(World.contains(1100,900,Infinity),false);
 // Independently sample the circumference of accepted actor disks: nothing
 // accepted by the collision routine may stick through the authored perimeter.
 for(let y=100;y<2520;y+=29)for(let x=300;x<1910;x+=37)if(World.contains(x,y,30)){
  for(let i=0;i<32;i++)assert.ok(World.contains(x+Math.cos(i*Math.PI/16)*29.99,y+Math.sin(i*Math.PI/16)*29.99),`disk escaped at ${x},${y}`);
 }
});

test('six stationary Sebbe guild members show mixed original and hybrid max-level companions',()=>{
 const w=World.create({catalog:Tides.allSpecies(),rng:()=>.63});
 const members=w.npcs.filter(n=>n.guildRole==='member'),hosts=w.npcs.filter(n=>n.game==='tideguild');
 assert.equal(members.length,6);assert.equal(hosts.length,1);assert.equal(hosts[0].name,'Battle');
 assert.equal(new Set(w.npcs.map(n=>n.id)).size,w.npcs.length);
 assert.equal(new Set(members.map(n=>n.name)).size,6);
 assert.ok(members.some(n=>Tides.getSpecies(n.tide).hybrid));assert.ok(members.some(n=>!Tides.getSpecies(n.tide).hybrid));
 for(const n of w.npcs){assert.equal(n.artKey,'sebbe');assert.equal(n.moving,false);assert.equal(n.walk,0);}
 for(const n of members){assert.equal(n.tideLevel,Tides.MAX_LEVEL);assert.equal(n.tide.level,Tides.MAX_LEVEL);assert.ok(Tides.getSpecies(n.tide));}
});

test('new guild instances roll companions independently and safely handle a missing hybrid catalog',()=>{
 const low=World.create({catalog:Tides.catalog,rng:()=>0}),high=World.create({catalog:Tides.catalog,rng:()=>1});
 assert.notEqual(low.npcs[0].tideSpeciesId,high.npcs[0].tideSpeciesId);
 assert.ok(low.npcs.filter(n=>n.tide).every(n=>!Tides.getSpecies(n.tide).hybrid));
 low.npcs[0].x=0;assert.notEqual(World.create().npcs[0].x,0);
 assert.ok(World.create().npcs.every(n=>!n.tide));
});

function fakeContext(count){
 return new Proxy({
  createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};},
  createPattern(){count.patterns++;return{};}
 },{get(o,k){if(k in o)return o[k];return(...args)=>{
  count.calls++;if(k==='drawImage')count.draws++;
  if(['fillRect','strokeRect','arc','ellipse','translate','scale'].includes(k))for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),`${k} got ${arg}`);
 };},set(o,k,v){o[k]=v;return true;}});
}

test('guild uses bounded small reusable texture canvases and survives unloaded art',()=>{
 const count={calls:0,draws:0,patterns:0,canvases:0},g=fakeContext(count),world=World.create();
 const floor={width:1774,height:887,complete:false},wall={width:1448,height:1086,complete:false};
 const options={images:{raidfloor:floor,raidwall:wall},createCanvas(w,h){count.canvases++;assert.ok(w<=384&&h<=384);return{getContext:()=>fakeContext(count)};}};
 World.renderGround(g,world,{x:0,y:0,w:2200,h:2600},options);assert.equal(count.canvases,0);
 floor.complete=wall.complete=true;
 World.renderGround(g,world,{x:0,y:0,w:2200,h:2600},options);assert.equal(count.canvases,2);
 const draws=count.draws,patterns=count.patterns;
 World.renderGround(g,world,{x:900,y:1900,w:700,h:700},{...options,time:100});
 World.renderBattle(g,3840,2160,100,options);
 assert.equal(count.canvases,2);assert.equal(count.draws,draws);assert.equal(count.patterns,patterns);
 assert.ok(count.calls<22000,'drawing work should stay bounded');
});

test('battle arena renders at desktop and narrow sizes without requiring a guild world',()=>{
 const count={calls:0,draws:0,patterns:0},g=fakeContext(count);
 World.renderBattle(g,1920,1080,0);World.renderBattle(g,360,740,10);
 const before=count.calls;World.renderBattle(g,0,0);assert.equal(count.calls,before);
 assert.ok(count.calls>200);
});
