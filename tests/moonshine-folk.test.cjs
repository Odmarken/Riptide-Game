/* Moonshine's folk (assets/models/moonshine-folk.js), in the Home the game's own builder puts up headless - the inn, casino, bank,
 * forge and fishing hut with their footprints, and the seeded trees and rocks. Fifteen people in nearly as many faces walk the painted
 * roads between the places they like, never through a house, the well or a tree; they stand, talk, go through a portal and come
 * back, and they do not walk the same few points round and round. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const Folk=require(path.join(root,'assets/models/moonshine-folk.js'));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const line=re=>{const m=source.match(re);assert.ok(m,String(re));return m[0];};
const mulberry32=vm.runInNewContext(line(/^function mulberry32\(.*$/m)+';mulberry32');

/* the painted map, decoded without a dependency (8-bit RGB or RGBA, not interlaced) */
function readPng(file){
 const png=fs.readFileSync(path.join(root,file)),width=png.readUInt32BE(16),height=png.readUInt32BE(20),type=png[25],bpp=type===6?4:3;
 assert.ok(png[24]===8&&(type===2||type===6)&&png[28]===0,'an 8-bit RGB(A) picture, not interlaced');
 const chunks=[];
 for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+n));p+=n+12;}
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*bpp,px=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const f=raw[y*(stride+1)];assert.ok(f<=4);
  for(let x=0;x<stride;x++){
   const o=y*stride+x,l=x>=bpp?px[o-bpp]:0,u=y?px[o-stride]:0,ul=y&&x>=bpp?px[o-stride-bpp]:0,p=l+u-ul;
   const pa=Math.abs(p-l),pb=Math.abs(p-u),pc=Math.abs(p-ul);
   px[o]=(raw[y*(stride+1)+x+1]+[0,l,u,(l+u)>>1,pa<=pb&&pa<=pc?l:pb<=pc?u:ul][f])&255;
  }
 }
 return {width,height,bpp,px};
}
/* Home as the game builds it: the tavern branch of the zone builder, with the building art's sizes read off the PNGs */
function home(){
 const size=f=>{const b=fs.readFileSync(path.join(root,'assets/models',f+'.png'));return {complete:true,naturalWidth:b.readUInt32BE(16),naturalHeight:b.readUInt32BE(20)};};
 const context=vm.createContext({MoonshineFolk:Folk,world:{w:2600,h:1700,solids:[],deco:[],waters:[]},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  tavernImg:size('tavern'),casinoImg:size('casino'),bankImg:size('bank'),smithImg:size('blacksmith'),fishhutImg:size('fishinghut')});
 const branch=section('}else if(z.tavern){','\n }else{\n  if(z.crypts)buildCryptMaze();').slice('}else if(z.tavern){'.length);
 vm.runInContext(section('const HOME_BUILDINGS={','function homeBuildingAt(')+section('function syncHomeBuildingFootprint(s){','function enterHomeBuilding(')
  +line(/^function mulberry32\(.*$/m)+'\n'+line(/^function npcSkinFemale\(.*$/m)+'\n'+line(/^function npcSkinCostume\(.*$/m)+'\n(function(){'+branch+'})();',context);
 return context.world;
}
const W=home(),HOUSES=W.solids.filter(s=>s.crx),PROPS=W.solids.filter(s=>s.type==='tree'||s.type==='rock');
const inHouse=(x,y)=>HOUSES.find(s=>((x-s.x-s.cxo)/s.crx)**2+((y-s.y-s.cyo)/s.cry)**2<1);
const nearProp=(x,y,r)=>PROPS.find(s=>Math.hypot(x-s.x,y-s.y)<r);
const inWell=(x,y)=>((x-Folk.WELL.x)/49)**2+((y-Folk.WELL.y)/10)**2<1;   /* the well's base, 75 wide, with half a body either side */
const MAP=readPng('assets/models/maps/moonshine_map.png');
const rgb=(x,y)=>{const X=Math.min(MAP.width-1,Math.max(0,Math.floor(x*MAP.width/W.w))),Y=Math.min(MAP.height-1,Math.max(0,Math.floor(y*MAP.height/W.h))),o=(Y*MAP.width+X)*MAP.bpp;return [MAP.px[o],MAP.px[o+1],MAP.px[o+2]];};
const dirt=(x,y)=>{const [r,g,b]=rgb(x,y);return r>g+8&&r>b+30;};
const water=(x,y)=>{const [r,g,b]=rgb(x,y);return b>r+25&&b>=g-10;};
const dirtShare=(x,y)=>{let n=0,k=0;for(let dx=-18;dx<=18;dx+=6)for(let dy=-18;dy<=18;dy+=6)if(dx*dx+dy*dy<=324){n++;k+=dirt(x+dx,y+dy);}return k/n;};

test('Home has fifteen people, and hardly two of them look alike',()=>{
 const folk=W.npcs;
 assert.ok(W.folk,'the zone hands its people to MoonshineFolk');
 assert.ok(folk.length>=15,folk.length+' people');
 assert.equal(new Set(folk.map(n=>n.name)).size,folk.length,'no name twice');
 for(const n of folk)assert.ok(!/[åäöÅÄÖ]/.test(n.name),n.name+' is English-friendly');
 const skins=new Set(folk.map(n=>n.skin));
 assert.ok(skins.size>=14,'faces: '+[...skins].join(', '));
 const names=vm.runInNewContext(section('const NPC_SKINS=','const npcSkinCache')+';NPC_SKINS');
 for(const n of folk){
  const costume=/^(human|dwarf|orc|undead)(male|female)_(warrior|mage|hunter|priest)$/.exec(n.skin);
  assert.ok(names[n.skin]||costume,n.name+' wears '+n.skin+', a painted face or a hero costume');
  assert.ok(n.skin!=='sebbe'&&!/^(king|ruler_|royal_guard|kings_hand)/.test(n.skin),n.name+' is no one who belongs elsewhere');
  assert.equal(typeof n.female,'boolean');
  if(costume){assert.equal(n.race,costume[1]);assert.equal(n.female,costume[2]==='female');}
  assert.ok(n.roam,n.name+' is walked by MoonshineFolk');
 }
 assert.ok(folk.some(n=>n.female)&&folk.some(n=>!n.female));
 assert.ok(folk.some(n=>n.race==='orc')&&folk.some(n=>n.race==='undead'),'the orc and the undead of old are still here');
});

test('their roads are the painted ones, and the steps over the grass keep clear of the houses, trees, rocks and the lake',()=>{
 const P=Folk.pos,ROAD=/^(m[A-Z]+|n\d|s\d|w\d|e\d|nw\d|sw\d|ne\d|se\d|\w+Gate|casino)$/;
 for(const chain of Folk.CHAINS){
  const ids=chain.split(' ');if(ids[0]==='P')continue;   /* the square itself: crossed straight, round the well (the walk test) */
  for(let i=1;i<ids.length;i++){
   const a=P(ids[i-1]),b=P(ids[i]),road=ROAD.test(ids[i-1])&&ROAD.test(ids[i]),L=Math.hypot(b.x-a.x,b.y-a.y);
   for(let t=0;t<=1;t+=10/L){
    const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,at=`${ids[i-1]}-${ids[i]} at ${x|0},${y|0}`;
    if(road)assert.ok(dirtShare(x,y)>=.8,'off the painted road: '+at);
    assert.ok(!water(x,y),'in the lake: '+at);
    const h=inHouse(x,y);assert.ok(!h,`through the ${h&&h.type}: `+at);
    const p=nearProp(x,y,30);assert.ok(!p,`through a ${p&&p.type}: `+at);
   }
  }
 }
 for(const [id,s] of Object.entries(Folk.SPOTS)){
  if(s.gone){assert.ok(W.solids.some(p=>/portal/.test(p.type)&&Math.hypot(p.x-P(s.node).x,p.y-P(s.node).y)<2),id+' is a portal');continue;}
  if(s.stroll)continue;
  const pts=s.ring?Array.from({length:24},(_,k)=>{const a=s.front?-.3+k/23*(Math.PI+.6):k/24*Math.PI*2;return [0,1].map(e=>{const r=s.ring[e];return {x:Folk.WELL.x+Math.cos(a)*r,y:Folk.WELL.y+Math.sin(a)*r*(s.flat||1)};});}).flat()
   :[[0,0],[-1,-1],[1,-1],[-1,1],[1,1]].map(([u,v])=>({x:s.x+u*s.rx,y:s.y+v*s.ry}));
  for(const {x,y} of pts){
   const at=`${id} at ${x|0},${y|0}`;
   assert.ok(x>40&&x<W.w-40&&y>40&&y<W.h-40,at);
   assert.ok(!water(x,y)&&!inHouse(x,y)&&!inWell(x,y),'nobody stands in the lake, a house or the well: '+at);
   assert.ok(!nearProp(x,y,24),'nor in a tree: '+at);
   if(s.ring)assert.ok(dirtShare(x,y)>=.8,'on the square: '+at);
  }
 }
});

test('they go where they like and stand a while - round the well, never through a house, never stuck, and never the same few points',()=>{
 const rng=mulberry32(2026),folk=Folk.create(rng),dt=1/30,log=new Map(folk.map(n=>[n,{places:[],goals:new Set(),walks:0,prev:n.state,still:0,hidden:0}]));
 let talks=0,trips=0,walking=0,standing=0,closest=Infinity;
 for(let t=0;t<30*60;t+=dt){
  Folk.step(folk,dt,rng,{night:false});
  for(const n of folk){
   const s=log.get(n);
   if(n.state!==s.prev){
    if(n.state==='idle'||n.state==='out')s.places.push(n.dest);   /* a portal is somewhere to go too */
    if(n.state==='walk'&&s.prev!=='chat'&&s.prev!=='pause'){s.walks++;s.goals.add(n.path.map(p=>Math.round(p.x/6)+','+Math.round(p.y/6)).join(' '));}   /* the whole way, bends and all */
    if(n.state==='chat')talks++;
    if(n.state==='gone')trips++;
    s.prev=n.state;
   }
   if(n.hidden){assert.ok((s.hidden+=dt)<75,n.name+' went through a portal and did not come back');continue;}
   s.hidden=0;
   assert.ok(n.x>0&&n.x<W.w&&n.y>0&&n.y<W.h,n.name+' left the map');
   const h=inHouse(n.x,n.y);assert.ok(!h,`${n.name} walked into the ${h&&h.type} at ${n.x|0},${n.y|0}`);
   assert.ok(!inWell(n.x,n.y),`${n.name} walked through the well at ${n.x|0},${n.y|0}`);
   for(const p of PROPS)closest=Math.min(closest,Math.hypot(n.x-p.x,n.y-p.y));
   if(n.state==='walk'&&!n.moving&&n.fade==null)assert.ok((s.still+=dt)<1,n.name+' stopped dead in the middle of a walk');else s.still=0;
   if(n.state==='walk')walking++;else standing++;
  }
 }
 assert.ok(closest>=10,'nobody walks through a tree trunk ('+closest.toFixed(1)+')');
 for(const [n,s] of log){
  const places=new Set(s.places);
  assert.ok(places.size>=3,`${n.name} only went to ${[...places]}`);
  assert.ok(s.goals.size>=s.walks*.9,`${n.name} kept walking the same way (${s.goals.size} different of ${s.walks})`);
 }
 assert.ok(talks>=20,'two who meet on the road stop for a word ('+talks+')');
 assert.ok(trips>=4,'some go through a portal and come back ('+trips+')');
 const share=standing/(walking+standing);
 assert.ok(share>.25&&share<.6,'they stand about as well as walk ('+(share*100).toFixed(0)+'% of the time)');
});

test('at night the inn draws them',()=>{
 const atInn=night=>{
  const rng=mulberry32(5),folk=Folk.create(rng);let sum=0,looks=0;
  for(let t=0;t<30*60;t+=1/20){Folk.step(folk,1/20,rng,{night});if(Math.round(t*20)%100===0){looks++;sum+=folk.filter(n=>n.state==='idle'&&n.dest==='tavern').length;}}
  return sum/looks;
 };
 const day=atInn(false),night=atInn(true);
 assert.ok(night>day*1.8&&night>=2,`standing at the inn: ${day.toFixed(2)} by day, ${night.toFixed(2)} at night`);
});

test('two standing close do not print their names over each other',()=>{
 const folk=Folk.create(mulberry32(9)),[a,b]=folk;
 for(const n of folk.slice(2))Object.assign(n,{state:'gone',hidden:true,wait:1e9});
 Object.assign(a,{state:'idle',wait:1e9,x:1400,y:900});Object.assign(b,{state:'idle',wait:1e9,x:1432,y:905});
 for(let t=0;t<1;t+=1/30)Folk.step(folk,1/30,Math.random);
 assert.ok(Math.abs(a.nameLift-b.nameLift)>=12,`name lines ${a.nameLift} and ${b.nameLift}`);
 b.x=1700;for(let t=0;t<1;t+=1/30)Folk.step(folk,1/30,Math.random);
 assert.ok(a.nameLift<1&&b.nameLift<1,'apart again, both names come back down');
});

test('the game walks them with MoonshineFolk, draws their lifted names, and loads the module before game.js',()=>{
 const upd=section('function updateNpcs(dt){','function drawEnemy(en){');
 assert.ok(upd.includes('if(world.folk)MoonshineFolk.step(world.npcs,dt,Math.random,{night:SUN.dark>.5});'));
 assert.ok(upd.includes('if(n.roam)continue;'),'the old back-and-forth walker leaves them alone');
 assert.ok(section('function drawNpc(n){','function drawNpcBubble').includes('-(n.nameLift||0))*size'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),at=html.indexOf('src="assets/models/moonshine-folk.js');
 assert.ok(at>0&&at<html.indexOf('src="game.js'),'moonshine-folk.js is loaded before game.js');
});
