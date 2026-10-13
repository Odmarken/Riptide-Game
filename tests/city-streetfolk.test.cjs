/* Run with: node --test tests/city-streetfolk.test.cjs
 * 🍞🎻 The square's painted crowds made townsfolk (2026-10-13: "som breadline ta bort människorna i den bilden ha kvar no bread,
 * och lägg till så det är NPC olika istället i kön", "gör så det är NPC som står och dansar i stället"): the bread queue and
 * the street music's dancers are townsfolk NPCs now, and the two paintings keep only the hatch and the hat.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {readRgbaPng}=require('./helpers/png.cjs');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const cut=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,'found '+from);return source.slice(a,b);};

function square(props){
 const c={world:{npcs:[{name:'Walker',skin:'male',pts:[{x:0,y:0},{x:9,y:0}]}],solids:props.map(([kind,x,y,extra],i)=>({type:'citywork',kind,x,y,seed:i*37,...extra}))},
  npcSkinCostume:()=>null};
 vm.createContext(c);
 vm.runInContext(cut('function npcSkinFemale(skin)','\n')+'\n'+cut('const NEWCOMER_FIRST=','const VELVET_GIRLS=')+cut('const cityCommoner=','\n')+'\n'
  +cut('const FEAST_SKINS=','\n/* 📣 The crier')+';globalThis.queue=cityApplyBreadline;globalThis.dancers=cityApplyDancers;globalThis.commoner=cityCommoner;',c);
 return c;
}
const queuers=c=>c.world.npcs.filter(n=>n.queuer),dancers=c=>c.world.npcs.filter(n=>n.dancer);

test('the bread queue is townsfolk, no two alike, in line toward the hatch - five while bread is short, eight when the granary is empty', () => {
 for(const [long,many] of [[false,5],[true,8]]){
  const c=square([['breadline',1000,500,{long}]]);c.queue();
  const q=queuers(c);
  assert.equal(q.length,many,`${long?'empty granary':'short of bread'}: ${many} in the queue`);
  assert.equal(new Set(q.map(n=>n.skin)).size,many,'no two dressed alike');
  const xs=q.map(n=>n.x);
  assert.ok(xs.every((x,i)=>!i||x<xs[i-1]),'one behind the other, away from the hatch');
  assert.ok(xs[0]<1000+64&&xs[0]>1000+30,'the first at the counter, short of the hatch\'s post');
  for(const n of q){
   assert.equal(n.fx,1,'facing the hatch');
   assert.equal(n.speed,0);assert.ok(n.pauseT>1e6,'they stand and wait');
   assert.ok(Math.abs(n.y-500)<20,'along the hatch\'s front');
   assert.equal(c.commoner(n),false,'never marched off to protest');
  }
  c.queue();assert.equal(queuers(c).length,many,'applying again adds nobody');
  c.world.solids=[];c.queue();assert.equal(queuers(c).length,0,'they go with the queue');
  assert.equal(c.world.npcs.length,1,'the walking townsfolk are left alone');
 }
});

test('four townsfolk dance round the musicians\' hat, each in their own time', () => {
 const c=square([['music',2000,800,{}]]);c.dancers();
 const d=dancers(c);
 assert.equal(d.length,4);
 assert.equal(new Set(d.map(n=>n.skin)).size,4,'four different townsfolk');
 assert.equal(new Set(d.map(n=>n.dance.rate+':'+n.dance.phase)).size,4,'each in their own time');
 for(const n of d){
  assert.ok(n.dance.rate>.8&&n.dance.rate<1.2,'about the hero\'s own pace');
  assert.ok(Math.abs(n.x-2000)<60&&n.y<=800,'round the hat and a little behind it');
  assert.equal(c.commoner(n),false);
 }
 c.dancers();assert.equal(dancers(c).length,4,'applying again adds nobody');
 c.world.solids=[];c.dancers();assert.equal(dancers(c).length,0,'they go when the music does');
});

test('they are laid out with the square\'s props, carry no names, and dance as the hero does', () => {
 assert.match(source,/ cityApplyFeast\(\);cityApplyBreadline\(\);cityApplyDancers\(\);\n\}/,'whenever the square\'s props are');
 assert.match(source,/!n\.held&&!n\.feaster&&!n\.queuer&&!n\.dancer&&/,'no names over the crowds');
 assert.match(source,/!n\.velvet&&!n\.feaster&&!n\.queuer&&!n\.dancer\)/,'not counted among the walking townsfolk');
 const draw=cut('function drawNpc(n){','function drawNpcBubble(');
 assert.ok(draw.includes('const fx=dz?(Math.sin(dt*3)>=0?1:-1):n.fx;'),'a turn each way');
 assert.ok(draw.includes('-Math.abs(Math.sin(dt*9))*6'),'a hop');
 assert.ok(draw.includes('if(dz)ctx.rotate(Math.sin(dt*6)*.25);'),'a rock');
 assert.ok(!/\bn\.fx>0/.test(draw),'every mirror in the draw follows the dancer\'s turn');
 assert.match(source,/const line=world\.npcs\.filter\(n=>n\.queuer\)/,'the queue grumbles now and then');
});

test('the paintings keep the hatch and the hat - the people in them are gone', () => {
 const dir=path.join(__dirname,'../assets/city');
 const bread=readRgbaPng(path.join(dir,'breadline.png'));
 assert.deepEqual([bread.width,bread.height],[640,284],'the same frame, so the hatch stands where it stood');
 let queue=0,board=0;
 for(let y=112;y<284;y++)for(let x=0;x<448;x++)queue+=bread.alpha(x,y)>8;
 for(let y=70;y<120;y++)for(let x=500;x<560;x++)board+=bread.alpha(x,y)>200;
 assert.equal(queue,0,'nobody painted in the queue');
 assert.ok(board>2800,'the NO BREAD board is whole');
 const music=readRgbaPng(path.join(dir,'music.png'));
 assert.deepEqual([music.width,music.height],[640,469]);
 let band=0,hat=0;
 for(let y=0;y<469;y++)for(let x=0;x<640;x++){const a=music.alpha(x,y)>8,inHat=x>=235&&x<=390&&y>=362;if(a&&!inHat)band++;if(a&&inHat)hat++;}
 assert.equal(band,0,'the band is gone');
 assert.ok(hat>8000,'the hat and its coins stay');
});
