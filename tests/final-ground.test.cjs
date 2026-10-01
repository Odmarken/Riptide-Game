/* The Final Hour's ground (asked for 2026-10-01: "osynliga väggar i finalboss rum - de som finns är dåliga - för ingången, sen
 * runt där han är"): the platform out to its outer bronze line, and the stair and landing you come in by - traced from
 * finalboss_zone.png, pinned here to what was measured on it - and the real collide() and moveToward() walk a hero against
 * every wall. The old walls were an ellipse 69 units too high and 160 too short, plus a rectangle for the stair. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const F=require('../assets/models/maps/final-ground.js');
const game=fs.readFileSync(path.join(ROOT,'game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const FEET=13*0.6,A=F.ARENA;
const onRim=(x,y)=>{const t=Math.atan2((y-A.y)/A.ry,(x-A.x)/A.rx);return Math.hypot(x-A.x-A.rx*Math.cos(t),y-A.y-A.ry*Math.sin(t));};

test('you arrive, he waits and the way out opens on the ground; the chasm, the bridges, the north stair, the terraces and the pillars are not',()=>{
 const on=(x,y)=>F.contains(x,y,FEET);
 const zone=section('  if(z.finalb){ /* ☠ you walk in from the south','  if(z.altar){');
 assert.match(zone,/world\.spawn=\{x:world\.w\/2,y:world\.h-160\};/);
 assert.ok(on(1650,2200-160),'the spawn, on the landing');
 assert.ok(on(1650,2200*.30),'where the Forsaken One waits');
 assert.ok(on(1650,2200*.46-60),'the way out his death opens (its trigger is 60 above its foot)');
 for(const [x,y,what] of [[1649,1072,'the middle'],[900,1072,'the west rim'],[2400,1072,'the east rim'],[1650,450,'the foot of the north stair, between its balustrades'],
  [1650,1850,'the stair'],[1570,1980,'the neck under its pillars'],[1520,2100,'the landing'],[1650,1755,'the head of the stair']])assert.ok(on(x,y),what);
 for(const [x,y,what] of [[870,1072,'the chasm in the west'],[800,1072,'the west bridge'],[2500,1072,'the east bridge'],[1650,300,'the north stair'],
  [1575,450,'the north stair\'s west balustrade'],[1727,450,'its east one'],[1563,535,'the pillar at its end'],[1558,1733,'a pillar at the head of the way in'],
  [1575,1850,'the stair\'s balustrade'],[1450,1850,'the terrace beside it'],[1480,2100,'beside the landing'],[1080,1600,'the south-west buttress'],[200,200,'the dark']])
  assert.ok(!on(x,y),what);
});

test('the platform\'s edge is the outer bronze line measured on the painting, and the way in is the stair and landing as painted',()=>{
 /* the outer edge of the outer bronze line along rays, in world units - the ellipse runs within 3.5 of each */
 for(const [x,y] of [[2388.9,904.2],[2238.3,625.7],[1516.6,389.3],[1255.7,479.5],[1023.8,675.4],[945.8,1339],[1154.4,1601.6],[1385.3,1724.6],[1888.7,1731.2],[2332.1,1382.8]])
  assert.ok(onRim(x,y)<=3.5,'rim at '+x+','+y+': '+onRim(x,y).toFixed(1)+' off');
 assert.ok(Math.abs(A.ry/A.rx-.907)<.01,'drawn a little from above: an ellipse, not a circle');
 /* the stair's steps between the balustrades (measured 1592..1710), the landing between its walls (1500..1796) */
 const xs=F.ENTRANCE.map(p=>p[0]),has=(x,y)=>F.ENTRANCE.some(p=>p[0]===x&&p[1]===y);
 assert.ok(has(1592,1740)&&has(1710,1740)&&has(1710,1950)&&has(1592,1950),'the stair, 1592..1710, runs up into the platform');
 assert.ok(F.contains(1650,1740,0)&&F.contains(1650,1770,FEET),'and meets it with no seam');
 assert.equal(Math.min(...xs),1503);assert.equal(Math.max(...xs),1795);
});

/* the real movement: collide() and moveToward() cut from game.js, the Final Hour's world, a hero of radius 13 */
function walker(){
 const c=vm.createContext({world:{w:3300,h:2200,solids:[],ground:F,arena:{...A}},mountRide:{id:null},Mounts:{allowed:()=>false},
  TideUI:{visibleCompanion:()=>null},zoneOf:()=>({finalb:true}),speedOf:()=>175,pet:{x:0,y:0,r:8},
  hero:{x:1650,y:2040,r:13,walk:0,fx:1,fy:0,moving:false,avoid:null}});
 vm.runInContext(section('const SGRID=320;','function speedOf(')+section('function moveToward(','/* ==================== FX'),c);
 return c;
}
test('walking any way from anywhere on the platform or the way in, the hero never sets foot off the ground',()=>{
 const c=walker(),h=c.hero,dt=1/60;
 for(const [sx,sy] of [[1650,2040],[1650,1850],[1520,2100],[1650,1072],[1000,1072],[2300,1072],[1650,450],[1650,660],[1250,600],[2050,1550]]){
  assert.ok(F.contains(sx,sy,FEET),'start '+sx+','+sy);
  for(let k=0;k<24;k++){
   h.x=sx;h.y=sy;h.avoid=null;
   const a=k/24*Math.PI*2,ux=Math.cos(a),uy=Math.sin(a);
   for(let i=0;i<60*5;i++){
    c.moveToward(h,h.x+ux*50,h.y+uy*50,dt);
    assert.ok(F.contains(h.x,h.y,FEET-1e-6),'off the ground at '+h.x.toFixed(1)+','+h.y.toFixed(1)+' walking '+Math.round(a*180/Math.PI)+' from '+sx+','+sy);
   }
  }
 }
});
test('the whole of it is open: up the stair, to him, round the rim, into the foot of the north stair and back down - and the rim slides',()=>{
 const c=walker(),h=c.hero,dt=1/60;
 /* a walk as a tap makes it: by the ground's own way round (the stair's head and foot) when it crosses the rim */
 const go=(x,y,limit)=>{
  for(const p of [...F.route(h.x,h.y,x,y),{x,y}]){
   for(let i=0;i<limit*60&&Math.hypot(h.x-p.x,h.y-p.y)>=4;i++)c.moveToward(h,p.x,p.y,dt);
   if(Math.hypot(h.x-p.x,h.y-p.y)>=4)return false;
  }
  return true;
 };
 h.x=1650;h.y=2040;
 assert.ok(go(1650,660,30),'up the stair and across to where he waits');
 for(const t of [0,45,135,180,225,315]){const a=t*Math.PI/180,k=1-(FEET+3)/A.ry;assert.ok(go(A.x+Math.cos(a)*A.rx*k,A.y+Math.sin(a)*A.ry*k,30),'to the rim at '+t+' degrees');assert.ok(go(1650,1072,30));}
 assert.ok(go(1650,420,30),'between the north balustrades');
 assert.ok(go(1520,2150,40),'and all the way back down to the landing');
 /* pushed straight into the rim he stands; at a slant he slides - no running to and fro along it */
 h.x=1650;h.y=1072;const xs=[];for(let i=0;i<60*6;i++){c.moveToward(h,h.x-50,h.y,dt);xs.push(h.y);}
 assert.ok(Math.abs(h.x-(A.x-A.rx+FEET))<1.5&&Math.max(...xs)-Math.min(...xs)<1,'west: stands at the rim, x '+h.x.toFixed(1));
 h.x=1650;h.y=1850;for(let i=0;i<60*3;i++)c.moveToward(h,h.x-50,h.y,dt);
 assert.ok(Math.abs(h.x-(1592+FEET))<1.5&&Math.abs(h.y-1850)<1,'into the stair\'s balustrade: stands by it');
});
test('a tap across the rim walks by the stair - its head, its foot, in the order the walk needs - and straight otherwise',()=>{
 const R=(...a)=>F.route(...a).map(p=>[p.x,p.y]);
 assert.deepEqual(R(1300,1500,1520,2150),[[1651,1738],[1651,1975]],'platform to landing');
 assert.deepEqual(R(1520,2150,1300,700),[[1651,1975],[1651,1738]],'landing to platform');
 assert.deepEqual(R(1650,1850,1300,700),[[1651,1738]],'from the stair itself: only its head');
 assert.deepEqual(R(1300,700,2000,1400),[],'across the platform: straight');
 assert.deepEqual(R(1520,2150,1650,2040),[],'about the landing: straight');
 for(const p of [F.HEAD,F.FOOT])assert.ok(F.contains(p.x,p.y,FEET+1.5),'a stop the hero can stand on');
 assert.match(game,/const via=world\.ground\.route\?world\.ground\.route\(hero\.x,hero\.y,q\.x,q\.y\):\[\];\n return via\.length\?\{x:via\[0\]\.x,y:via\[0\]\.y,then:\[\.\.\.via\.slice\(1\),\{x:q\.x,y:q\.y\}\]\}:q;/);
 assert.match(game,/const then=hero\.moveTo\.then;hero\.moveTo=then&&then\.length\?\{\.\.\.then\[0\],then:then\.slice\(1\)\}:null;/,'each stop reached hands on to the next');
});
test('game.js: the Final Hour hands its world this ground and the old walls are gone; his kit keeps to the new arena',()=>{
 const zone=section('  if(z.finalb){ /* ☠ you walk in from the south','  if(z.altar){');
 assert.match(zone,/world\.ground=FinalGround;\n   world\.arena=\{\.\.\.FinalGround\.ARENA\};/);
 const collide=section('function collide(e,nx,ny){','function speedOf(');
 assert.doesNotMatch(collide,/world\.arena|gx0|inGate/,'the ellipse-and-rectangle walls are gone');
 assert.match(collide,/if\(world\.ground&&!world\.ground\.contains\(nx,ny,\(e\.r\|\|12\)\*0\.6\)\)return true;/);
 /* where he blinks to (0.8 of the arena on the diagonals) and where his runes may bloom (inside 0.92) is ground */
 const kit=section('function bossAI(en,dt){','/* --- 2. SOULBEAM');
 assert.match(kit,/const inArena=\(x,y\)=>!A\|\|\(\(\(x-A\.x\)\/A\.rx\)\*\*2\+\(\(y-A\.y\)\/A\.ry\)\*\*2\)<=0\.92;/);
 for(const ang of [0.785,2.356,3.927,5.498])assert.ok(F.contains(A.x+Math.cos(ang)*A.rx*.8,A.y+Math.sin(ang)*A.ry*.8,40),'the blink point at '+ang);
 assert.match(game,/en\.x=\(A\?A\.x:en\.x\)\+Math\.cos\(ang\)\*\(A\?A\.rx:400\)\*0\.80;/);
 const at=html.indexOf('<script src="assets/models/maps/final-ground.js?v='),g=html.indexOf('<script src="game.js?v=');
 assert.ok(at>0&&at<g,'the page loads the module before game.js');
});
