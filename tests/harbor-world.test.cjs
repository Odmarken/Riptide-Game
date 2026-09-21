/* ⚓ The Harbour under the City: a quay, a flight up the cliff, three piers that are nothing alike, two pirate ships
 * and a sloop, and people who walk the quay without ever stepping into the sea or through a crate. The module is
 * pure, so all of it is held here headless - including that the drawing never hands the canvas a non-finite number,
 * with or without its pictures. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Hb=require('../assets/city/harbor-world.js');

test('a safe place with no enemies: you arrive at the foot of the flight, and the way back is up it',()=>{
 const w=Hb.create();
 assert.equal(w.harbor,true);assert.equal(w.kind,'harbor');assert.equal(w.w,Hb.W);assert.equal(w.h,Hb.H);
 assert.deepEqual(w.enemySpawns,[]);assert.deepEqual(w.mwalls,[]);assert.ok(w.portal.x<0&&w.portal.y<0);
 assert.equal(w.exit.id,'city');assert.ok(Hb.contains(w.spawn.x,w.spawn.y,13));
 assert.ok(w.spawn.y>Hb.EXIT_Y+400,'you arrive well clear of the height that takes you back up');
 for(let y=w.spawn.y;y>=Hb.EXIT_Y-20;y-=4)assert.ok(Hb.contains(Hb.FLIGHT.cx,y,13),'the flight is blocked at '+y);
 assert.equal(Hb.contains(Hb.FLIGHT.cx,Hb.FLIGHT.y0-5,13),false,'and it ends under the arch');
 assert.deepEqual(JSON.parse(JSON.stringify(Hb.create())),JSON.parse(JSON.stringify(w)),'the same harbour every visit');
});

test('three piers, nothing alike, all reachable on foot - and the sea is not',()=>{
 const walk=(pts)=>{for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],L=Math.hypot(bx-ax,by-ay);
  for(let d=0;d<=L;d+=5)assert.ok(Hb.contains(ax+(bx-ax)*d/L,ay+(by-ay)*d/L,13),`blocked at ${Math.round(ax+(bx-ax)*d/L)},${Math.round(ay+(by-ay)*d/L)}`);}};
 const s=Hb.SPAWN;
 walk([[s.x,s.y],[s.x,1940],[1000,1940],[1000,3025],[760,3025],[1460,3025]]);                       /* the long timber pier and both ends of its T-head */
 walk([[s.x,1940],[Hb.XC,2830],[Hb.XC-135,2990],[Hb.XC,3125],[Hb.XC+135,2990],[Hb.XC,2830]]);       /* down the mole and round the beacon */
 walk([[3450,1940],[3450,2300],[3475,2400],[3500,2500],[3500,2715]]);                               /* the crooked jetty, through its dog-leg */
 assert.ok(Hb.PIER_A.stem.w!==Hb.MOLE.stem.w&&Hb.MOLE.stem.w!==Hb.JETTY.upper.w&&Hb.PIER_A.stem.h!==Hb.JETTY.upper.h);
 for(const [x,y] of [[1600,2500],[2900,2600],[3900,2400],[500,3000],[2200,3300],[3420,2500],[3530,2300],[100,1700],[4300,1700],[2200,300]])assert.equal(Hb.contains(x,y,0),false,`${x},${y} is not ground`);
 for(const [x,y] of [[NaN,1700],[2200,Infinity]])assert.equal(Hb.contains(x,y),false);assert.equal(Hb.contains(2200,1700,Infinity),false);
 /* an actor disk never hangs over an edge */
 for(let y=450;y<3300;y+=23)for(let x=100;x<4300;x+=29)if(Hb.contains(x,y,30))for(let i=0;i<24;i++)
  assert.ok(Hb.contains(x+Math.cos(i*Math.PI/12)*29.9,y+Math.sin(i*Math.PI/12)*29.9),`disk escaped at ${x},${y}`);
});

test('two big pirate ships and a smaller one lie between the piers, clear of every walkway',()=>{
 const w=Hb.create(),ships=w.solids.filter(s=>['galleon','carrack','sloop'].includes(s.kind));
 assert.deepEqual(ships.map(s=>s.kind),['galleon','carrack','sloop']);
 assert.ok(Hb.ART.galleon.w>=900&&Hb.ART.carrack.w>=900&&Hb.ART.sloop.w<Hb.ART.galleon.w*.6,'two big, one small');
 for(const s of ships){
  assert.ok(s.noCol&&s.floats&&s.name);
  const half=Hb.ART[s.kind].w/2;
  for(let x=s.x-half+10;x<=s.x+half-10;x+=20)assert.equal(Hb.contains(x,s.y-20,0),false,`${s.name} lies in the water at ${x}`);
  assert.ok(s.y-Hb.ART[s.kind].w*.95>Hb.Q1-160,`${s.name}: the masts stand over water, not over the quay`);
 }
 const [g,c,sl]=ships;
 assert.ok(g.x-Hb.ART.galleon.w/2>=Hb.PIER_A.stem.x+Hb.PIER_A.stem.w&&g.x+Hb.ART.galleon.w/2<=Hb.MOLE.stem.x,'the galleon fills the basin between the timber pier and the mole');
 assert.ok(c.x-Hb.ART.carrack.w/2>=Hb.MOLE.stem.x+Hb.MOLE.stem.w&&c.x+Hb.ART.carrack.w/2<=Hb.JETTY.lower.x,'the carrack lies between the mole and the jetty');
 assert.ok(sl.x-Hb.ART.sloop.w/2>=Hb.JETTY.lower.x+Hb.JETTY.lower.w,'the sloop lies east of the jetty');
});

test('the people of the quay: traders who only walk, never into the sea, never through the cargo',()=>{
 const w=Hb.create(),walkers=w.npcs.filter(n=>n.speed>0),standing=w.npcs.filter(n=>n.speed===0);
 assert.ok(walkers.length>=24,'a busy quay');assert.equal(new Set(w.npcs.map(n=>n.name)).size,w.npcs.length,'everybody has a name of his own');
 for(const skin of ['sailor','pirate','dockhand','fishwife','merchant'])assert.ok(walkers.some(n=>n.skin===skin),skin+'s are about');
 const blocks=w.solids.filter(s=>!s.noCol);
 const hit=(x,y)=>blocks.find(s=>s.crx?((x-s.x)/(s.crx+6))**2+((y-s.y-(s.cyo||0))/(s.cry+6))**2<1:Math.hypot(x-s.x,y-s.y)<6+s.r*.8);
 for(const n of walkers){
  assert.ok(n.pts.length>=3&&!n.game&&!n.say,`${n.name} has somewhere to go and nothing to sell you`);
  assert.deepEqual([n.x,n.y],[n.pts[0].x,n.pts[0].y]);
  for(let i=1;i<n.pts.length;i++){const a=n.pts[i-1],b=n.pts[i],L=Math.hypot(b.x-a.x,b.y-a.y);
   for(let d=0;d<=L;d+=6){const x=a.x+(b.x-a.x)*d/L,y=a.y+(b.y-a.y)*d/L;
    assert.ok(Hb.contains(x,y,10),`${n.name} leaves the ground at ${Math.round(x)},${Math.round(y)}`);
    const prop=hit(x,y);assert.ok(!prop,`${n.name} walks through the ${prop&&prop.kind} at ${prop&&prop.x},${prop&&prop.y}`);}}
 }
 for(const n of standing){assert.ok(Hb.contains(n.x,n.y,13),`${n.name} stands on the ground`);assert.ok(n.pauseT>1e8&&n.pts.length===1);assert.ok(!hit(n.x,n.y),`${n.name} stands in a prop`);}
 const master=w.npcs.find(n=>n.game==='harbourmaster');
 assert.equal(master.name,Hb.HARBOUR_MASTER);assert.equal(master.skin,'harbour_master');assert.ok(master.say.length>=3);
 const office=w.solids.find(s=>s.kind==='office');assert.ok(Math.abs(master.x-office.x)<40&&master.y>office.y,'he stands at his own door');
 assert.equal(w.npcs.filter(n=>n.game==='captain').length,2,'a captain for each of the big ships');
 for(const n of w.npcs)assert.equal(n.female,/fishwife|market_woman|female_/.test(n.skin),`${n.name} is drawn with the right boots`);
});

test('the furniture of the quay stands on the quay, the ships in the water, and every painting exists',()=>{
 const w=Hb.create(),root=path.join(__dirname,'..','assets','city');
 for(const s of w.solids){
  assert.equal(s.type,'harborprop');assert.ok(Hb.ART[s.kind],'known kind: '+s.kind);
  if(s.noCol)continue;
  assert.ok(Hb.contains(s.x,s.y-(s.kind==='beacon'?0:6),0)||s.kind==='crane'||s.kind==='bollard',`${s.kind} at ${s.x},${s.y} stands on the ground`);
 }
 const near=(s,x,y)=>s.crx?((x-s.x)/(s.crx+24))**2+((y-s.y-(s.cyo||0))/(s.cry+24))**2<1:Math.hypot(s.x-x,s.y-y)<s.r+24;
 for(const lane of Hb.LANES)for(const x of Hb.CROSS)assert.ok(!w.solids.some(s=>!s.noCol&&near(s,x,lane)),`the crossing at ${x},${lane} is clear`);
 assert.deepEqual(w.solids.filter(s=>s.big).map(s=>s.kind),['fishhouse','chandlery','warehouse','office','tavern','warehouse'],'five kinds of house against the cliff, either side of the flight');
 assert.ok(w.solids.filter(s=>s.big).every(s=>Math.abs(s.x-Hb.FLIGHT.cx)>Hb.FLIGHT.half1+Hb.ART[s.kind].crx),'none of them on the flight');
 for(const name of Hb.IMAGES)assert.ok(fs.existsSync(path.join(root,'harbor',name+'.png')),'assets/city/harbor/'+name+'.png');
 for(const name of Hb.CITY_IMAGES)assert.ok(fs.existsSync(path.join(root,name+'.png')),'assets/city/'+name+'.png');
 for(const name of ['harbor_gate','harbor_stair'])assert.ok(fs.existsSync(path.join(root,'harbor',name+'.png')),name+' (the City side)');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'harbor','harbor-art-manifest.json'),'utf8'));
 for(const name of [...Hb.IMAGES,'harbor_gate','harbor_stair'])assert.ok(manifest.art[name+'.png']&&manifest.art[name+'.png'].jobId,name+' is in the manifest');
 /* the gate's arch is a hole: the middle of its lower half is transparent, its towers are not */
 const {readRgbaPng}=require('./helpers/png.cjs'),gate=readRgbaPng(path.join(root,'harbor','harbor_gate.png')),alpha=(u,v)=>gate.pixels[(Math.floor(v*gate.height)*gate.width+Math.floor(u*gate.width))*4+3];
 assert.equal(alpha(.5,.8),0);assert.equal(alpha(.5,.6),0);for(const [u,v] of [[.12,.8],[.88,.8],[.5,.3]])assert.ok(alpha(u,v)>=250,`the masonry at ${u},${v} is solid`);
});

test('drawing never hands the canvas a non-finite number - loaded or not, wherever the camera is',()=>{
 const calls={},grad={addColorStop(o){assert.ok(Number.isFinite(o));}};
 const g=new Proxy({},{get(t,k){if(k in t)return t[k];return (...args)=>{calls[k]=(calls[k]||0)+1;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${String(k)} got ${a}`);if(/Gradient/.test(k))return grad;};},set(t,k,v){t[k]=v;return true;}});
 const w=Hb.create(),images={};for(const k of [...Hb.IMAGES,...Hb.CITY_IMAGES])images[k]={complete:true,naturalWidth:800,naturalHeight:640};
 for(const view of [{x:0,y:0,w:1900,h:1000},{x:1500,y:1400,w:1900,h:1000},{x:2500,y:2600,w:1900,h:1000},{x:-300,y:3000,w:5200,h:900},{x:9000,y:9000,w:100,h:100}])for(const time of [0,1.7,4093.2]){
  Hb.renderGround(g,w,view,{images,time});Hb.drawSky(g,w,view,time,images);
  for(const s of w.solids){Hb.drawShadow(g,s);Hb.drawProp(g,s,time,images,{alpha:.4});const f=Hb.frame(s,images);assert.ok(f&&f.W>0&&f.H>0&&f.top<0);}
 }
 assert.ok(calls.drawImage>500&&calls.setLineDash>50,'paintings, and foam on the water');
 /* the frame or two before a picture has loaded: flat stand-ins, no picture drawn, nothing thrown */
 const unloaded={};for(const k of [...Hb.IMAGES,...Hb.CITY_IMAGES])unloaded[k]={complete:false,naturalWidth:0,naturalHeight:0};
 calls.drawImage=0;
 Hb.renderGround(g,w,{x:0,y:0,w:4400,h:3600},{images:unloaded,time:2});Hb.drawSky(g,w,{x:0,y:0,w:4400,h:3600},2,unloaded);
 for(const s of w.solids){Hb.drawProp(g,s,2,unloaded);assert.equal(Hb.frame(s,unloaded),null);}
 assert.equal(calls.drawImage,0);
});
