const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function city(seed=13){
 const context=vm.createContext({world:{w:16800,h:5200,solids:[]},npcSebbeImg:{}});
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','const cityPat=')+source.match(/^function mulberry32\(.*$/m)[0]+`;buildCity(mulberry32(${seed}));globalThis.faces=CITY_HOUSE;`,context);
 return {world:JSON.parse(JSON.stringify(context.world)),faces:context.faces};
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
  const {world:w,faces}=city(seed),homes=houses(w),drawn=[...services(w),...homes].map(s=>({s,...frame(s,faces)}));
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
 assert.deepEqual(w.solids.filter(s=>['well','altarportal'].includes(s.type)).map(s=>[s.type,s.x,s.y]),[['altarportal',300,2600],['well',8400,2600]]);
 const hash=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
 // Recorded when the townsfolk moved onto the street graph (48 villagers, two patrols, Sebbe):
 // decoration changes must not consume more seeded RNG and silently reroll their routes.
 assert.equal(hash(w.npcs),'a584731958d4367392a28b530fe5beb292fefa9999dd7fbd5ba71db31fb87f82');
 assert.deepEqual(w.mwalls.map(s=>[s.x,s.y,s.w,s.h]),[[0,60,16800,140],[0,5000,16800,140],[60,0,140,2525],[60,2675,140,2525],[16600,0,140,5200]]);
});
