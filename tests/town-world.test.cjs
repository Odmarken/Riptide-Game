/* ⛵ Blackbeard's ports of call (assets/city/town-world.js + assets/city/towns/*.js): every town builds, is walkable from
 * the pier where the Black Tide lands you, keeps its houses and props off its own streets, and paints headless.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const TW=require('../assets/city/town-world.js');
for(const f of fs.readdirSync(path.join(__dirname,'../assets/city/towns')).filter(f=>f.endsWith('.js')))require('../assets/city/towns/'+f);
const root=path.join(__dirname,'..'),game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const TOWNS=['silverfjord','ravenholt','emberfall','meridian'];   /* the ports; the palace of Silverfjord is an interior */
const ALL=[...TOWNS,'sf_palace'];

/* what the game's collide() does in a town, for a hero of radius r */
function blocked(w,x,y,r=13){
 if(!TW.contains(w,x,y,r))return 'coast';
 for(const s of w.solids){
  if(s.noCol)continue;
  if(s.crx){const kx=(x-s.x-(s.cxo||0))/(s.crx+r),ky=(y-s.y-(s.cyo||0))/(s.cry+r);if(kx*kx+ky*ky<1)return s.kind;continue;}
  if(Math.hypot(x-s.x,y-s.y)<r+s.r*.8)return s.kind;
 }
 for(const m of w.mwalls)if(x>m.x-r&&x<m.x+m.w+r&&y>m.y-r&&y<m.y+m.h+r)return 'wall';
 return null;
}

test('the four ports of call and the palace are registered, each with a zone of its own after the Harbour',()=>{
 assert.deepEqual(TW.list().map(t=>t.id).sort(),[...ALL].sort());
 assert.deepEqual(TW.list().filter(t=>!t.interior).map(t=>t.id).sort(),[...TOWNS].sort(),'only the palace is an interior');
 const zones=game.slice(game.indexOf('const ZONES=['),game.indexOf('const TAVERN_ZONE='));
 for(const id of TOWNS){
  assert.match(zones,new RegExp("town:'"+id+"'"),id+' has a zone');
  assert.ok(zones.indexOf("town:'"+id+"'")>zones.indexOf('harbor:true'),id+' comes after the Harbour');
  const t=TW.town(id);assert.ok(t.name&&t.blurb&&t.icon,id+' can be listed in the voyage window');
 }
});

test('you land on the pier beside Blackbeard and his ship, and every townsman stands on ground',()=>{
 for(const id of TOWNS){
  const w=TW.create(id),bb=w.npcs.filter(n=>n.voyage);
  assert.equal(w.kind,'town');assert.equal(w.town,id);
  assert.equal(bb.length,1,id+': one Blackbeard');assert.equal(bb[0].game,'captain');assert.equal(bb[0].skin,'pirate_captain');
  assert.ok(Math.hypot(bb[0].x-w.arrival.x,bb[0].y-w.arrival.y)<260,id+': you arrive at his side');
  assert.equal(blocked(w,w.arrival.x,w.arrival.y),null,id+': the arrival point is free');
  assert.ok(TW.contains(w,bb[0].x,bb[0].y,13),id+': he stands on the pier');
  const tide=w.solids.find(s=>s.kind==='galleon'&&s.name==='The Black Tide');
  assert.ok(tide&&tide.floats&&tide.noCol,id+': the Black Tide is moored');
  assert.ok(Math.hypot(tide.x-bb[0].x,tide.y-bb[0].y)<900,id+': beside his ship');
  assert.ok(!TW.contains(w,tide.x,tide.y+40,1),id+': the ship floats on water');
  for(const n of w.npcs)for(const p of n.pts)assert.ok(TW.contains(w,p.x,p.y,6),id+': '+n.name+' walks on ground');
 }
});

test('no house, stall or wall stands on a street, and nobody walks through one',()=>{
 for(const id of ALL){
  const w=TW.create(id),def=TW.town(id);
  for(const r of def.roads)for(let i=1;i<r.pts.length;i++){
   const [ax,ay]=r.pts[i-1],[bx,by]=r.pts[i],L=Math.hypot(bx-ax,by-ay);
   for(let d=0;d<=L;d+=24){const x=ax+(bx-ax)*d/L,y=ay+(by-ay)*d/L,b=blocked(w,x,y,8);assert.ok(!b||b==='coast',id+': '+b+' on a street at '+Math.round(x)+','+Math.round(y));}
  }
  for(const n of w.npcs)for(let i=1;i<n.pts.length;i++){
   const a=n.pts[i-1],b=n.pts[i],L=Math.hypot(b.x-a.x,b.y-a.y);
   for(let d=0;d<=L;d+=30){const x=a.x+(b.x-a.x)*d/L,y=a.y+(b.y-a.y)*d/L,bl=blocked(w,x,y,6);assert.equal(bl,null,id+': '+n.name+' walks through '+bl+' at '+Math.round(x)+','+Math.round(y));}
  }
 }
});

test('every street of every town can be reached on foot from the pier - or, in the palace, by its stairs',()=>{
 for(const id of ALL){
  const w=TW.create(id),G=24,cols=Math.ceil(w.w/G),rows=Math.ceil(w.h/G),seen=new Uint8Array(cols*rows),q=[],at=(c,r)=>r*cols+c;
  for(const p of [w.arrival,...w.links.filter(l=>!l.to).map(l=>l.at)]){const c0=Math.floor(p.x/G),r0=Math.floor(p.y/G);assert.equal(blocked(w,p.x,p.y),null,id+': a way in at '+p.x+','+p.y);seen[at(c0,r0)]=1;q.push([c0,r0]);}
  while(q.length){const [c,r]=q.pop();for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=cols||nr>=rows||seen[at(nc,nr)])continue;
   if(blocked(w,nc*G+G/2,nr*G+G/2)){seen[at(nc,nr)]=2;continue;}seen[at(nc,nr)]=1;q.push([nc,nr]);}}
  const near=(x,y)=>{const c=Math.floor(x/G),r=Math.floor(y/G);for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++)if(seen[at(c+dc,r+dr)]===1)return true;return false;};
  for(const n of TW.graph(TW.town(id)).nodes.values())assert.ok(near(n.x,n.y),id+': the way at '+Math.round(n.x)+','+Math.round(n.y)+' cannot be reached');
  for(const n of w.npcs)assert.ok(near(n.x,n.y),id+': '+n.name+' cannot be reached');
 }
});

test('the sea is never ground, the piers always are, and a sign is never painted backwards',()=>{
 for(const id of ALL){
  const w=TW.create(id),def=TW.town(id);
  for(const p of def.piers||[]){const x=p.r?p.x:p.x+p.w/2,y=p.r?p.y:p.y+p.h/2;assert.ok(TW.contains(w,x,y,13),id+': pier at '+x+','+y);}
  if(!def.interior)assert.equal(TW.contains(w,w.w/2,w.h-8,1),false,id+': the open water at the bottom');
  assert.equal(TW.contains(w,-5,w.h/2,0),false);assert.equal(TW.contains(w,NaN,1,0),false);
  for(const s of w.solids)if(TW.ART[s.kind].noFlip)assert.ok(!s.flip,id+': '+s.kind+' is lettered');
 }
});

test('every picture a town asks for is on disk, and every one of its own is in the manifest with its job',()=>{
 const man=JSON.parse(fs.readFileSync(path.join(root,'assets/city/towns/towns-art-manifest.json'),'utf8'));
 for(const id of ALL)for(const k of TW.imagesFor(id)){
  assert.ok(fs.existsSync(path.join(root,'assets/city',k+'.png')),'assets/city/'+k+'.png');
  if(k.startsWith('towns/'))assert.ok(man.art[k.slice(6)+'.png']&&man.art[k.slice(6)+'.png'].jobId,k+' in the manifest');
 }
 /* the houses' footprints are worked out from the installed pictures' sizes */
 for(const [k,a] of Object.entries(TW.ART))if(a.house&&a.src.startsWith('towns/'))assert.ok(TW.SIZES[a.src],k+' has its size');
});

test('every skin a town dresses its people in is one the game can paint',()=>{
 const skins=game.slice(game.indexOf('const NPC_SKINS={'),game.indexOf('const npcSkinCache'));
 for(const id of ALL)for(const n of TW.create(id).npcs){
  const m=skins.match(new RegExp('\\b'+n.skin+":'(npc_[a-z_]+)'"));
  assert.ok(m,id+': '+n.skin+' is in NPC_SKINS');
  assert.ok(fs.existsSync(path.join(root,'assets/characters/npc',m[1]+'.png')),m[1]+'.png');
 }
});

test('a town paints headless, ground, props and sky, without touching anything it was not given',()=>{
 const calls={draw:0};
 const grad={addColorStop(){}};
 const ctx=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>grad:k==='drawImage'?()=>{calls.draw++;}:typeof k==='string'&&/^[a-z]/.test(k)?(t[k]!==undefined?t[k]:()=>{}):undefined,set:(t,k,v)=>{t[k]=v;return true;}});
 const img={complete:true,naturalWidth:64,naturalHeight:64,width:64,height:64};
 for(const id of ALL){
  const w=TW.create(id),images=Object.fromEntries(TW.imagesFor(id).map(k=>[k,img]));
  TW.renderGround(ctx,w,{x:w.arrival.x-800,y:w.arrival.y-500,w:1600,h:1000,zoom:1},{images,time:3});
  for(const s of w.solids.slice(0,60)){TW.drawShadow(ctx,s);TW.drawProp(ctx,s,3,images,{alpha:.5});}
  TW.drawSky(ctx,w,{x:0,y:0,w:1600,h:1000},3,images);
 }
 assert.ok(calls.draw>200);
});

test('Silverfjord is bigger than the City and walled all round; its palace doors lead in and out again',()=>{
 const sf=TW.town('silverfjord'),city=[16800,5200];
 assert.ok(sf.w>city[0]&&sf.w*sf.h>city[0]*city[1],'bigger than the City');
 const w=TW.create('silverfjord');
 assert.ok(w.solids.filter(s=>TW.ART[s.kind].house).length>=120,'a town of houses');
 /* the walls: the north run blocks from end to end (the Mine Gate is shut), the west and east runs from the north wall to the sea */
 for(let x=400;x<sf.w-400;x+=97)assert.ok(blocked(w,x,1330,13),'the north wall at '+x);
 for(let y=1500;y<6900;y+=113){assert.ok(blocked(w,200,y,13),'the west wall at '+y);assert.ok(blocked(w,sf.w-200,y,13),'the east wall at '+y);}
 const door=w.links.find(l=>l.to==='sf_palace'),palace=TW.create('sf_palace'),out=palace.links.find(l=>l.to==='silverfjord');
 assert.ok(door&&out,'a door each way');
 assert.equal(blocked(palace,door.at.x,door.at.y),null,'you come in on the hall floor');
 assert.equal(blocked(w,out.at.x,out.at.y),null,'and out on the forecourt');
 assert.ok(Math.hypot(out.at.x-door.x,out.at.y-door.y)>door.r+20,'coming out does not send you straight back in');
 for(const l of palace.links.filter(l=>!l.to))assert.ok(palace.links.every(o=>Math.hypot(l.at.x-o.x,l.at.y-o.y)>o.r+20),'a stair lands you clear of every stair');
 assert.ok(palace.npcs.some(n=>n.skin==='ruler_sigvald'&&n.say),'the King holds court');
 assert.equal(palace.npcs.filter(n=>n.voyage).length,0,'and no ship docks in a palace');
 assert.match(game,/for\(const t of TownWorld\.list\(\)\)\{if\(t\.interior\)continue;/,'the palace is not a port of call');
});

test('a rocky shore keeps its stones out in the water, and every sea rock stands clear of the bank',()=>{
 for(const id of TOWNS){
  const def=TW.town(id),w=TW.create(id),R=TW.rockShore(def);
  if(def.lands.some(L=>L.some(p=>p[2]==='rock')))assert.ok(R.stones.length>10,id+': stones off its rocky bank');
  for(const s of R.stones)assert.ok(!TW.contains(w,s.x,s.y,0),id+': a stone on the ground at '+Math.round(s.x)+','+Math.round(s.y));
  const a=TW.ART.rocks,Ww=a.h*a.ar;
  for(const [k,x,y] of def.props)if(k==='rocks')for(let yy=y+a.drop;yy>=y+a.drop-a.h*.7;yy-=25)for(let xx=x-Ww/2;xx<=x+Ww/2;xx+=25)
   assert.ok(!TW.contains(w,xx,yy,0),id+': the sea rock at '+x+','+y+' stands on the shore');
 }
 const sf=TW.town('silverfjord');
 assert.ok(!sf.props.some(p=>p[0]==='rh_pine')&&!sf.art.rh_pine,'no snow-laden pines in a green Silverfjord');
});

test('the palace jail is a storey down, out of sight of the throne hall, and its torches burn',()=>{
 const def=TW.town('sf_palace'),hallFoot=Math.max(...def.lands[0].map(p=>p[1])),wall=def.walls.find(w=>w.kind==='sf_jail_wall');
 /* a 4K screen at the floor zoom sees about 2400 units top to bottom: half of that below the hero at the doors */
 assert.ok(wall.y-TW.ART.sf_jail_wall.h-hallFoot>1300,'the jail wall is out of sight from the hall doors');
 assert.ok(TW.ART.sf_jail_wall.torches.length>=4,'every painted torch flickers');
 const calls={fire:0};
 const ctx=new Proxy({},{get:(t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):typeof k==='string'&&/^[a-z]/.test(k)?(t[k]!==undefined?t[k]:()=>{if(k==='ellipse')calls.fire++;}):undefined,set:(t,k,v)=>{t[k]=v;return true;}});
 const img={complete:true,naturalWidth:1344,naturalHeight:752,width:1344,height:752},w=TW.create('sf_palace');
 TW.drawProp(ctx,w.solids.find(s=>s.kind==='sf_jail_wall'),3,{'towns/sf_jail_wall':img});
 assert.ok(calls.fire>=10,'flames drawn over the painted torches');
});

test('every port paints a minimap picture of itself headless, and the Harbour does too',()=>{
 const HW=require('../assets/city/harbor-world.js');
 let fills=0;
 const ctx=new Proxy({},{get:(t,k)=>typeof k==='string'&&/^[a-z]/.test(k)?(t[k]!==undefined?t[k]:()=>{if(k==='fill'||k==='fillRect')fills++;}):undefined,set:(t,k,v)=>{t[k]=v;return true;}});
 for(const id of TOWNS){const before=fills;assert.equal(TW.paintMap(ctx,TW.create(id)),true,id);assert.ok(fills-before>100,id+': ground, roofs and trees');}
 assert.equal(TW.paintMap(ctx,{town:'nowhere'}),false);
 const before=fills;assert.equal(HW.paintMap(ctx,HW.create()),true);assert.ok(fills-before>10,'the Harbour');
});
