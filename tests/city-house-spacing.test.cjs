const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function city(seed=13){
 const context=vm.createContext({world:{w:16800,h:5200,solids:[]},npcSebbeImg:{}});
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','/* 🧱 The floor of the City')+source.match(/^function mulberry32\(.*$/m)[0]+`;buildCity(mulberry32(${seed}));globalThis.faces=CITY_HOUSE;globalThis.palace=PALACE;`,context);
 return {world:JSON.parse(JSON.stringify(context.world)),faces:context.faces,palace:JSON.parse(JSON.stringify(context.palace))};
}
const sizes=new Map();
function frame(s,faces){
 const key=s.key||s.type;
 if(!sizes.has(key)){const p=fs.readFileSync(path.join(root,'assets/city',key+'.png'));sizes.set(key,{w:p.readUInt32BE(16),h:p.readUInt32BE(20)});}
 const image=sizes.get(key),h=faces[key]?.h||s.r*(key==='cathedral'?8:9),w=h*image.w/image.h;
 return {x:s.x-w/2,y:s.y+s.r*.3-h,w,h};
}
const overlaps=(a,b,gap=0)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
const houses=w=>w.solids.filter(s=>s.type==='cityhouse');
const services=w=>w.solids.filter(s=>['cathedral','minehall','enchanthall','smelter'].includes(s.type));

test('complete City house art stays separated from neighbouring roofs and all service buildings',()=>{
 for(const seed of [1,13,42,8675309]){
  const {world:w,faces,palace}=city(seed),homes=houses(w),drawn=[...services(w),...homes].map(s=>({s,...frame(s,faces)}));
  /* 👑 the palace stair is ground art with its own box, not an r*9 facade */
  for(const h of homes)assert.equal(overlaps(frame(h,faces),palace,15),false,`seed${seed}: a house stands on the palace stair`);
  assert.ok(homes.length>260,'the existing city remains populated');
  assert.equal(new Set(homes.map(s=>s.key)).size,7,'all original house faces remain in the city');
  for(let i=0;i<drawn.length;i++)for(let j=i+1;j<drawn.length;j++)
   assert.equal(overlaps(drawn[i],drawn[j],15),false,`seed${seed}: ${drawn[i].s.key||drawn[i].s.type} at${drawn[i].s.x},${drawn[i].s.y} overlaps ${drawn[j].s.key||drawn[j].s.type}`);
 }
});

test('roofs, foundations and doorway colliders keep streets, alleys, plazas and walls clear',()=>{
 for(const seed of [1,13,42]){
  const {world:w,faces}=city(seed);
  for(const h of houses(w)){
   const b=frame(h,faces);
   assert.ok(b.x>=230&&b.y>=230&&b.x+b.w<=w.w-230&&b.y+b.h<=w.h-230,'the complete facade clears the curtain walls');
   for(const s of w.streets){
    const road={x:Math.min(s.x0,s.x1)-s.w/2,y:Math.min(s.y0,s.y1)-s.w/2,w:Math.abs(s.x1-s.x0)+s.w,h:Math.abs(s.y1-s.y0)+s.w};
    assert.equal(overlaps(b,road,11),false,'no roof or doorway covers the road');
    assert.equal(overlaps({x:h.x-h.r,y:h.y-h.r,w:h.r*2,h:h.r*2},road),false,'walking colliders also clear the road');
   }
   for(const p of w.plazas){
    const x=Math.max(b.x,Math.min(p.x,b.x+b.w)),y=Math.max(b.y,Math.min(p.y,b.y+b.h));
    assert.ok(Math.hypot(x-p.x,y-p.y)>=p.r+11,'service plazas remain open');
   }
  }
 }
});

test('spacing remains deterministic and preserves City size, services, gate and existing townsfolk routes',()=>{
 const {world:w}=city(),again=city().world;
 assert.equal(JSON.stringify(w),JSON.stringify(again));
 assert.deepEqual([w.w,w.h,w.spawn.x,w.spawn.y],[16800,5200,520,2600]);
 assert.deepEqual(services(w).map(s=>[s.type,s.x,s.y,s.r]),[
  ['minehall',4050,1180,58],['enchanthall',12750,4020,58],['cathedral',8400,1425.2,96],['smelter',7150,4020,58]
 ]);
 const stair=w.solids.find(s=>s.type==='palacestair');
 assert.ok(stair&&stair.noCol&&Math.abs(stair.y-2600)<1e-6&&stair.x>16500&&stair.x<16600,'the palace gate is on the boulevard, against the east wall');
 assert.equal(w.rails.filter(r=>!r.harbor).length,4);
 /* ⚓ the harbour gate: a landmark under the arch at the south end of the central avenue, two plinths, two balustrades and the two jambs of the passage */
 const flight=w.solids.find(s=>s.type==='harborstair');
 assert.ok(flight&&flight.noCol&&flight.x===8400&&flight.y>5000&&flight.y<5140,'the way down is in the south wall, on the central avenue');
 assert.equal(w.rails.filter(r=>r.harbor).length,6);
 assert.deepEqual(w.solids.filter(s=>['well','altarportal'].includes(s.type)).map(s=>[s.type,s.x,s.y]),[['altarportal',300,2600],['well',8400,2600]]);
 const hash=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
 // Recorded when the second wave of townsfolk joined (72 villagers, two patrols, Sebbe); the first
 // 48 hash exactly as they did on the day they moved onto the street graph, because the new names
 // are appended to the roster and the seeded RNG is drawn in roster order. Decoration changes must
 // not consume more seeded RNG and silently reroll the routes.
 // Re-recorded 2026-09-19 when the palace stair took the boulevard's east end: the three strollers who
 // reached that dead end (Syster Agnes, Urzul Gråhud, Broder Botolf) now turn round at its forecourt.
 // Only that one waypoint moved - before the change every other route hashed as d7d5cca7...4304 did.
 // Re-recorded 2026-09-21 when Syster Agnes left the city and Tvätterskan Agda took her place in the
 // roster: the same routes to the last waypoint (checked by hashing with the old name put back), only the name differs.
 // Re-recorded 2026-09-22 when the harbour flight took the south end of the central avenue: the one stroller who
 // reached that dead end (Gorm Hammarson, a waypoint at 8411,4651) now turns round at the head of the flight (y 4348).
 // Only that one waypoint moved - with the turn-round taken out, every route hashed as 9a57fe09...c0c2 did, and no
 // house stood where the gate went (276 before and after at seed 13; the same in seeds 1, 42 and 8675309).
 assert.equal(hash(w.npcs),'94732d8c5c680af27a60a9ec04e54e21b3d48a9bddd25273bda2d6d37d816e5d');
 /* the south wall is two lengths now: the passage under the harbour gatehouse is 180 wide on the central avenue */
 assert.deepEqual(w.mwalls.map(s=>[s.x,s.y,s.w,s.h]),[[0,60,16800,140],[0,5000,8310,140],[8490,5000,8310,140],[60,0,140,2525],[60,2675,140,2525],[16600,0,140,5200]]);
});
