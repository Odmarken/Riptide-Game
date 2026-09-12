/* Test the generated SVG against real world geometry without a DOM or game saves. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const W=require('../assets/wasteland/world.js');
const M=require('../assets/ui/wasteland-map.js');
const D=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/wasteland/dungeons.js'),'utf8')+';WastelandDungeons',{});
const keys=['briarhollow','cindervein','frostveil'];
function projected(world,p){
 const scale=Math.min(540/world.w,300/world.h);
 return {x:(600-world.w*scale)/2+p.x*scale,y:(360-world.h*scale)/2+p.y*scale};
}
function close(a,b){assert.ok(Math.abs(a-b)<.011,`${a} != ${b}`);}
function playerPoint(html){const m=html.match(/data-player="true" transform="translate\(([-.\d]+) ([-.\d]+)\)"/);return m&&{x:+m[1],y:+m[2]};}
function encounter(w){return D.createEncounter(w.key,w.enemySpawns,{level:60,attack:250,maxHp:1400}).enemies;}

test('Wasteland SVG uses every actual road, three named entrances, Home and the projected player',()=>{
 const world=W.create(),hero={x:25100,y:10900},html=M.render(world,hero,[]);
 const lines=[...html.matchAll(/<polyline data-road="(\d+)" points="([^"]+)"/g)];
 assert.equal(lines.length,world.paths.length);
 for(const m of lines){
  const road=world.paths[+m[1]],points=m[2].split(' ').map(p=>p.split(',').map(Number));
  assert.equal(points.length,road.points.length);
  points.forEach(([x,y],i)=>{const expected=projected(world,road.points[i]);close(x,expected.x);close(y,expected.y);});
 }
 for(const e of world.entrances){assert.ok(html.includes(`data-entrance="${e.id}"`));assert.ok(html.includes(e.name));}
 assert.match(html,/data-exit="true"><title>Home<\/title>/);
 const p=playerPoint(html),expected=projected(world,hero);close(p.x,expected.x);close(p.y,expected.y);
 assert.match(html,/role="img" aria-labelledby=/);assert.match(html,/<desc[^>]*>North is up\./);
 assert.match(html,/aria-label="Cave entrances"/);
 assert.doesNotMatch(html,/<(?:img|image|script|button|a)\b|data-z=|onclick=|tabindex=/);
});

test('north-up placement is centred and uses the same scale in both axes for all real maps',()=>{
 for(const world of [W.create(),...keys.map(k=>W.create(k))]){
  const centre={x:world.w/2,y:world.h/2};
  const p=playerPoint(M.render(world,centre,[]));close(p.x,300);close(p.y,180);
  const q=playerPoint(M.render(world,{x:centre.x+500,y:centre.y-500},[]));
  close(q.x-p.x,p.y-q.y);assert.ok(q.x>p.x&&q.y<p.y);
  for(const corner of [{x:0,y:0},{x:world.w,y:world.h}]){
   const c=playerPoint(M.render(world,corner,[]));assert.ok(c.x>=30&&c.x<=570&&c.y>=30&&c.y<=330);
  }
 }
});

test('dungeon floor rectangles and live/defeated boss markers come from the current layout and enemies',()=>{
 for(const key of keys){
  const world=W.create(key),enemies=encounter(world),bosses=enemies.filter(e=>e.boss);
  bosses[0].dead=true;bosses[1].x+=70;
  const html=M.render(world,world.spawn,enemies);
  const floors=[...html.matchAll(/data-floor="true" x="([-.\d]+)" y="([-.\d]+)" width="([-.\d]+)" height="([-.\d]+)"/g)];
  assert.equal(floors.length,world.floors.length);
  floors.forEach((m,i)=>{
   const floor=world.floors[i],a=projected(world,floor),b=projected(world,{x:floor.x+floor.w,y:floor.y+floor.h});
   close(+m[1],a.x);close(+m[2],a.y);assert.ok(Math.abs(+m[3]-(b.x-a.x))<.021);assert.ok(Math.abs(+m[4]-(b.y-a.y))<.021);
  });
  for(const en of bosses){
   assert.ok(html.includes(en.name));
   const status=en.dead?'defeated':'alive';
   const marker=new RegExp(`data-boss="${en.dungeonIndex}" data-status="${status}"><title>[^<]*</title><g transform="translate\\(([-.\\d]+) ([-.\\d]+)\\)"`).exec(html);
   assert.ok(marker,'boss status and position share one marker');
   const expected=projected(world,en);close(+marker[1],expected.x);close(+marker[2],expected.y);
  }
  assert.match(html,/data-exit="true"><title>Wasteland<\/title>/);assert.match(html,/aria-label="Bosses"/);
  assert.doesNotMatch(html,/data-entrance=/);
 }
});

test('re-rendering reflects movement and kills without keeping boss data from the previous zone',()=>{
 const world=W.create('briarhollow'),enemies=encounter(world),boss=enemies.find(e=>e.boss);
 const first=M.render(world,world.spawn,enemies);
 boss.dead=true;
 const moved={x:world.spawn.x+500,y:world.spawn.y-200},second=M.render(world,moved,enemies);
 assert.notDeepEqual(playerPoint(first),playerPoint(second));
 assert.match(first,/data-boss="0" data-status="alive"/);assert.match(second,/data-boss="0" data-status="defeated"/);
 const next=M.render(W.create('frostveil'),{x:100,y:100},enemies);
 assert.ok(!next.includes(boss.name));assert.doesNotMatch(next,/data-status="defeated"/);
 assert.equal(M.render({key:'city',w:16800,h:5200},moved,enemies),'');
});

test('invalid coordinates stay finite, broken roads remain broken, and boss text cannot become markup',()=>{
 const world=W.create(),original=world.paths[0].points;
 world.paths=[{points:[original[0],original[1],{x:NaN,y:2},original[2],original[3]]}];
 const html=M.render(world,{x:Infinity,y:4},[]);
 assert.doesNotMatch(html,/NaN|Infinity|data-player=/);assert.match(html,/Player position unavailable/);
 assert.equal([...html.matchAll(/data-road="0"/g)].length,2,'invalid point breaks the polyline');
 assert.equal(M.render({...world,w:NaN},world.spawn,[]),'');
 assert.equal(M.render({...world,h:0},world.spawn,[]),'');
 const dungeon=W.create('cindervein'),enemies=encounter(dungeon);
 enemies[0].name='Cinder <img src=x onerror="bad()"> & "Lord"';
 const escaped=M.render(dungeon,dungeon.spawn,enemies);
 assert.doesNotMatch(escaped,/<img\b/);assert.match(escaped,/&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; &quot;Lord&quot;/);
 assert.match(escaped,/font-size:13px;line-height:1\.4/,'full boss names retain readable HTML text at mobile width');
});
