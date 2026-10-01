/* The Altar's ground (asked for 2026-10-01: "gör så man inte kan gå utanför bron som är på marken och även den stora
 * ringen sen, osynliga väggar"): only the bridge and the great ring of thealtar.png are walkable, up to the outer gold
 * line that rims them. The edges are pinned to the gold line measured on the painting, and the real collide() and
 * moveToward() from game.js walk a hero against every wall. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const A=require('../assets/models/maps/altar-ground.js');
const game=fs.readFileSync(path.join(ROOT,'game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const FEET=13*0.6;   /* the hero's r is 13; collide lets the feet, not the shoulders, reach the rim */
const yAt=(edge,x)=>{for(let i=1;i<edge.length;i++)if(x<=edge[i][0]){const [x0,y0]=edge[i-1],[x1,y1]=edge[i];return y0+(y1-y0)*(x-x0)/(x1-x0);}return edge[edge.length-1][1];};

test('the way in, the way home and the Gate stand on the ground; the sky, the railing band and the ring\'s spikes do not',()=>{
 const on=(x,y)=>A.contains(x,y,FEET);
 const zone=section('  if(z.altar){','  if(!isBoss&&!z.raid&&!z.noBerg){');
 const spawn=zone.match(/world\.spawn=\{x:(\d+),y:(\d+)\}/),portal=zone.match(/\{x:(\d+),y:(\d+),r:38,type:'altarportal'\}/);
 assert.ok(on(+spawn[1],+spawn[2]),'the spawn');
 assert.ok(on(+portal[1],+portal[2]-30),'where the portal takes you home (its trigger is 30 above its foot)');
 const gate=section('function altarGateSync(){','\n}\n').match(/\{x:1996,y:1000,r:52,type:'ritualportal'\}/);assert.ok(gate);
 assert.ok(on(1996,1000),'the Gate, and the Armor Altar after it');
 for(const [x,y] of [[700,1000],[100,920],[100,1095],[700,816],[730,1182],[1110,1000],[1987,130],[2850,991],[1987,1855],[1500,500]])assert.ok(on(x,y),'ground '+x+','+y);
 for(const [x,y,what] of [[100,880,'the railing band above the bridge'],[100,1130,'the railing band below it'],[700,780,'the sky over the bulge'],
  [700,1215,'the sky under it'],[1100,800,'the railing at the top join'],[1100,1175,'the railing at the bottom join'],[1987,108,'the north spike'],
  [2885,991,'the east spike'],[1987,1880,'the south spike'],[300,300,'open sky'],[2950,1950,'the far corner']])assert.ok(!on(x,y),what);
});

test('the edges are the outer gold line as measured on the painting, and both end on the ring\'s circle',()=>{
 /* the outer edge of the outer gold line, found per column in thealtar.png (world units): within 4 units */
 const top=[[100,909],[300,909],[439,886],[488,870],[537,851],[586,831],[635,813],[740,807],[800,812.5],[860,828],[920,850.5],[1000,877],[1056,886.5],[1104,871]];
 const bot=[[100,1104.5],[300,1104.5],[391,1112],[488,1138.5],[586,1169.5],[650,1184.5],[770,1188.5],[830,1174.5],[890,1156.5],[950,1137.5],[1000,1121.5],[1048,1119.5],[1088,1129.5],[1104,1139.5]];
 for(const [x,y] of top)assert.ok(Math.abs(yAt(A.TOP,x)-y)<=4,'top at '+x+': '+yAt(A.TOP,x).toFixed(1)+' vs '+y);
 for(const [x,y] of bot)assert.ok(Math.abs(yAt(A.BOT,x)-y)<=4,'bottom at '+x+': '+yAt(A.BOT,x).toFixed(1)+' vs '+y);
 /* the ring: the circle fitted to its outer line - the line measured to the north, east and south and either side of the bridge sits on it */
 const R=A.RING;
 for(const [x,y] of [[2149.5,129.4],[1841.8,125.5],[2834.4,1224.7],[2145.7,1848.9],[1163.5,700],[1145.5,750],[1134.5,800],[1136.5,1200],[1147.5,1250],[1165.5,1300],[1185.5,1350]])
  assert.ok(Math.abs(Math.hypot(x-R.x,y-R.y)-R.r)<=5,'ring line at '+x+','+y);
 for(const e of [A.TOP,A.BOT]){
  assert.deepEqual(e[0].slice(0,1),[0],'from the map\'s west edge');
  for(let i=1;i<e.length;i++)assert.ok(e[i][0]>e[i-1][0],'west to east');
  const end=e[e.length-1];assert.ok(Math.abs(Math.hypot(end[0]-R.x,end[1]-R.y)-R.r)<0.2,'ends on the circle');
 }
 /* the outline is one simple loop: no edge crosses another */
 const P=A.POLY,n=P.length,o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
  if(i===0&&j===n-1)continue;
  const a=P[i],b=P[(i+1)%n],c=P[j],d=P[(j+1)%n];
  assert.ok(!(o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0),'edges '+i+' and '+j+' cross');
 }
});

/* the real movement: collide() and moveToward() cut from game.js, the Altar's world, a hero of radius 13 */
function walker(){
 const c=vm.createContext({world:{w:3000,h:2000,solids:[],ground:A},mountRide:{id:null},Mounts:{allowed:()=>false},
  TideUI:{visibleCompanion:()=>null},zoneOf:()=>({altar:true}),speedOf:()=>175,pet:{x:0,y:0,r:8},
  hero:{x:430,y:990,r:13,walk:0,fx:1,fy:0,moving:false,avoid:null}});
 vm.runInContext(section('const SGRID=320;','function speedOf(')+section('function moveToward(','/* ==================== FX'),c);
 return c;
}
test('walking any way from anywhere on the bridge or the ring, the hero never sets foot off it',()=>{
 const c=walker(),h=c.hero,dt=1/60;
 const starts=[[430,990],[200,1000],[700,850],[700,1150],[1050,1000],[1300,700],[1987,991],[2600,600],[2700,1400],[1600,1700]];
 for(const [sx,sy] of starts){
  assert.ok(A.contains(sx,sy,FEET),'start '+sx+','+sy);
  for(let k=0;k<24;k++){
   h.x=sx;h.y=sy;h.avoid=null;
   const a=k/24*Math.PI*2,ux=Math.cos(a),uy=Math.sin(a);
   for(let i=0;i<60*6;i++){   /* six seconds with the key held, as the keyboard and the stick walk */
    c.moveToward(h,h.x+ux*50,h.y+uy*50,dt);
    assert.ok(A.contains(h.x,h.y,FEET-1e-6),'off the ground at '+h.x.toFixed(1)+','+h.y.toFixed(1)+' walking '+Math.round(a*180/Math.PI)+' from '+sx+','+sy);
   }
  }
 }
});

test('pushed straight into the rim the hero stands still; pushed at a slant he slides along it - no running to and fro',()=>{
 const c=walker(),h=c.hero,dt=1/60;
 const push=(x,y,ux,uy,secs)=>{h.x=x;h.y=y;h.avoid=null;const xs=[];
  for(let i=0;i<secs*60;i++){c.moveToward(h,h.x+ux*50,h.y+uy*50,dt);xs.push(h.x);}
  return {x:h.x,y:h.y,moving:h.moving,xmin:Math.min(...xs),xmax:Math.max(...xs)};};
 /* the flat west stretch: up and down stop at the gold line, right where they met it (it used to wander up to 150 units) */
 let r=push(200,1000,0,-1,3);
 assert.ok(r.xmax-r.xmin<1,'up: no sideways drift ('+r.xmin.toFixed(1)+'..'+r.xmax.toFixed(1)+')');
 assert.ok(Math.abs(r.y-(909.2+FEET))<0.6,'up: stands right at the top rim, y '+r.y.toFixed(1));assert.equal(r.moving,false,'and the legs stop');
 r=push(150,1000,0,1,3);
 assert.ok(r.xmax-r.xmin<1,'down: no sideways drift');assert.ok(Math.abs(r.y-(1105-FEET))<0.6,'down: stands right at the bottom rim, y '+r.y.toFixed(1));
 /* a slant slides: up-right along the flat stretch, and straight up on the bulge's rising rim climbs to its crest */
 r=push(100,1000,Math.SQRT1_2,-Math.SQRT1_2,2);
 assert.ok(r.x>180,'up-right slides east along the rim: x '+r.x.toFixed(1));assert.ok(A.contains(r.x,r.y,FEET-1e-6));
 r=push(500,1000,0,-1,6);
 assert.ok(r.x>640&&r.x<800&&r.y<820,'straight up on the rising rim slides to the bulge\'s crest: '+r.x.toFixed(1)+','+r.y.toFixed(1));
 assert.ok(Math.abs(r.y-(yAt(A.TOP,r.x)+FEET))<1.5,'and stands on its rim there');
 /* the ring: straight out to the east rim stands; at a slant it follows the circle */
 r=push(2400,991.3,1,0,4);
 assert.ok(Math.abs(Math.hypot(r.x-A.RING.x,r.y-A.RING.y)-(A.RING.r-FEET))<0.6&&Math.abs(r.y-991.3)<3,'east: at the rim, not slid off round it');
 r=push(2400,700,1,0,6);
 assert.ok(r.y>760&&A.contains(r.x,r.y,FEET-1e-6),'pushed east north of the middle: slides round the rim southward, y '+r.y.toFixed(1));
});

test('the whole way is open: from the spawn to the Gate in the middle of the ring, round its rim, and back to the portal',()=>{
 const c=walker(),h=c.hero,dt=1/60;
 const go=(x,y,limit)=>{for(let i=0;i<limit*60;i++){if(Math.hypot(h.x-x,h.y-y)<4)return true;c.moveToward(h,x,y,dt);}return Math.hypot(h.x-x,h.y-y)<4;};
 h.x=430;h.y=990;
 assert.ok(go(1996,1000,30),'over the bridge to the Gate');
 for(const a of [-90,0,90,180,-135,-45,45,135]){   /* to the rim of the ring all round, a step inside the gold line */
  const t=a*Math.PI/180,r=A.RING.r-FEET-2;
  if(a===180)continue;   /* west is where the bridge joins */
  assert.ok(go(A.RING.x+Math.cos(t)*r,A.RING.y+Math.sin(t)*r,30),'to the rim at '+a+' degrees');
  assert.ok(go(1987,991,30),'and back to the middle');
 }
 assert.ok(go(700,816,30),'up to the top of the bulge, by the diamond');
 assert.ok(go(730,1182,30),'down to the bottom of it');
 assert.ok(go(110,965,40),'and home to the portal');
});

test('a tap on the sky walks to the rim and stops there, and every part of the game that walks asks the ground',()=>{
 for(const [x,y] of [[500,600],[700,1400],[1080,780],[1050,1180],[1500,200],[2900,1500],[1987,40],[2990,991],[60,1300],[60,700]]){
  const p=A.nearest(x,y,FEET+1.5);
  assert.ok(p&&A.contains(p.x,p.y,FEET),'a tap at '+x+','+y+' leads to ground');
  const u=Math.hypot(x-p.x,y-p.y);   /* 16 units further toward the tap is sky: the hero stops at the rim, not short of it */
  assert.ok(!A.contains(p.x+(x-p.x)/u*16,p.y+(y-p.y)/u*16,0),'right at the rim, not short of it ('+x+','+y+')');
 }
 assert.deepEqual(A.nearest(700,1000,FEET),{x:700,y:1000},'a tap on the ground is where you go');
 /* game.js: the Altar hands its world this ground, collide asks it, taps and a held finger go through walkTarget */
 assert.match(section('  if(z.altar){','  if(!isBoss&&!z.raid&&!z.noBerg){'),/world\.ground=AltarGround;/);
 assert.match(section('function collide(e,nx,ny){','function speedOf('),/if\(world\.ground&&!world\.ground\.contains\(nx,ny,\(e\.r\|\|12\)\*0\.6\)\)return true;/);
 assert.match(game,/function walkTarget\(wx,wy\)\{\n const p=\{x:Math\.max\(30,Math\.min\(world\.w-30,wx\)\),y:Math\.max\(30,Math\.min\(world\.h-30,wy\)\)\};\n if\(!world\.ground\)return p;\n const q=world\.ground\.nearest\(p\.x,p\.y,\(hero\.r\|\|13\)\*0\.6\+1\.5\)\|\|p;/);
 assert.match(game,/hero\.moveTo=walkTarget\(wx,wy\);hero\.target=null;marker=\{x:walkEnd\(hero\.moveTo\)\.x,y:walkEnd\(hero\.moveTo\)\.y,t:0\};/);
 assert.match(game,/hero\.moveTo=walkTarget\(hx,hy\);/);
 assert.doesNotMatch(game,/hero\.moveTo=\{x:Math\.max\(30,Math\.min\(world\.w-30/,'no tap walks around walkTarget');
 /* a pet that fell behind is put down on the ground, not in the sky behind the hero */
 assert.match(section('// ----- pet follows, immortal and untargetable -----','mpHostRaidThreatTick(dt);'),/relocated=true;\n   if\(collide\(pet,pet\.x,pet\.y\)\)\{pet\.x=hero\.x;pet\.y=hero\.y;\}/);
 /* waking where you logged out: a spot in the sky is refused by collide, and you wake at the spawn */
 assert.match(section('function wakeAt(){','\n}\n'),/if\(collide\(hero,sp\.x,sp\.y\)\)\{hero\.x=x0;hero\.y=y0;/);
 /* the page loads the module before game.js */
 const at=html.indexOf('<script src="assets/models/maps/altar-ground.js?v='),g=html.indexOf('<script src="game.js?v=');
 assert.ok(at>0&&at<g);
});
