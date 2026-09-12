const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Profiles=require('../assets/boss/foot-motion-profiles.js');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const image=(src,w=256,h=w)=>({src,complete:true,naturalWidth:w,naturalHeight:h});
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,label+': '+a+' vs '+b);

function harness(){
 const canvases=[];
 const document={createElement(tag){
  assert.equal(tag,'canvas');
  const c={width:0,height:0,ops:[]};
  c.getContext=()=>({
   drawImage(...args){c.ops.push({kind:'draw',args});},
   clearRect(...args){c.ops.push({kind:'clear',args});}
  });
  canvases.push(c);return c;
 }};
 const api=vm.runInNewContext(fs.readFileSync(path.join(root,'assets/boss/foot-motion.js'),'utf8')+';EnemyFootMotion',{document});
 return {api,canvases};
}
const pair=[
 {x0:.1,x1:.4,root:.6,ankle:.8,phase:0},
 {x0:.6,x1:.9,root:.6,ankle:.8,phase:Math.PI}
];
function patches(frame){
 const groups=[];
 for(let i=0;i<frame.ops.length;i++){
  if(frame.ops[i].kind!=='clear')continue;
  const clear=frame.ops[i].args,shin=frame.ops[i+1],foot=frame.ops[i+2];
  assert.equal(shin.kind,'draw');assert.equal(foot.kind,'draw');
  assert.equal(shin.args.length,9);assert.equal(foot.args.length,9);
  groups.push({clear,shin:shin.args.slice(1),foot:foot.args.slice(1)});
 }
 return groups;
}

test('walking roots stay fixed, full feet keep their shape, and each shin joins its foot without a hole',()=>{
 const {api}=harness(),source=image('armored boss',400,600);
 for(const phase of [Math.PI/6,Math.PI/2,Math.PI*7/6,Math.PI*3/2]){
  const frame=api.frame(source,pair,phase,1,400);
  assert.equal(frame.width,400);assert.equal(frame.height,600);
  assert.equal(frame.ops[0].args[0],source,'upper body starts as the unchanged source');
  const groups=patches(frame);assert.equal(groups.length,1,'only the rising leg is rebuilt');
  for(const {clear,shin,foot} of groups){
   const [sx,sy,sw,sh,dx,dy,dw,dh]=shin;
   const [fx,fy,fw,fh,tx,ty,tw,th]=foot;
   assert.deepEqual(clear,[sx,sy,sw,600-sy]);
   assert.equal(dx,sx);assert.equal(dy,sy,'root cannot rise with the foot');
   assert.equal(dw,sw);assert.ok(dh>0&&dh<sh,'only the connecting shin compresses');
   assert.equal(fx,sx);assert.equal(fw,sw);assert.equal(tx,fx);
   assert.equal(tw,fw);assert.equal(th,fh,'toe and sole retain full original dimensions');
   assert.equal(fy,sy+sh,'source regions cover the full lower leg with no omitted rows');
   close(dy+dh,ty,'destination shin and ankle meet exactly');
   close(fy-ty,sh-dh,'the foot translates by the same amount the shin shortens');
   assert.equal(fy+fh,600,'the original sole is never cropped');
   assert.ok(ty+th<=600,'the lifted foot remains inside its original canvas');
  }
 }
});

test('opposite stride phases alternate the feet and never modify the torso above the roots',()=>{
 const {api}=harness(),source=image('two feet');
 const a=api.frame(source,pair,Math.PI/2,1,256),b=api.frame(source,pair,Math.PI*3/2,1,256);
 const pa=patches(a),pb=patches(b);
 assert.equal(pa.length,1);assert.equal(pb.length,1);
 assert.ok(pa[0].clear[0]<128);assert.ok(pb[0].clear[0]>128);
 for(const frame of [a,b])for(const op of frame.ops.filter(o=>o.kind==='clear'))
  assert.equal(op.args[1],Math.round(.6*256),'the torso and weapon hand anchors stay above all clears');
 const resting=api.frame(source,pair,0,1,256);
 assert.equal(resting,source,'neutral phase needs no transformed image');
});

test('dead, hidden, casting and stunned enemies have no gait; invalid phases and unready art pass through',()=>{
 const {api,canvases}=harness(),source=image('gait gates');
 for(const stop of [{dead:true},{hidden:true},{dungeonCast:{}},{stunT:.01},{lockT:.01}]){
  const en={mv:1,...stop},before=JSON.stringify(en);
  assert.equal(api.amount(en),0);assert.equal(api.frame(source,pair,Math.PI/2,api.amount(en),256),source);
  assert.equal(JSON.stringify(en),before,'rendering never mutates combat state');
 }
 for(const mv of [undefined,NaN,Infinity,-1])assert.equal(api.amount({mv}),0);
 assert.equal(api.amount({mv:2}),1);assert.equal(api.amount({mv:.35}),.35);assert.equal(api.amount(null),0);
 for(const phase of [undefined,NaN,Infinity,-Infinity])assert.equal(api.frame(source,pair,phase,1,256),source);
 for(const strength of [0,-1,NaN,Infinity])assert.equal(api.frame(source,pair,1,strength,256),source);
 for(const width of [0,-1,NaN,Infinity])assert.equal(api.frame(source,pair,1,1,width),source);
 assert.equal(api.frame(source,[],1,1,256),source);
 const loading={...source,complete:false};assert.equal(api.frame(loading,pair,1,1,256),loading);
 assert.equal(canvases.length,0,'invalid or stopped poses allocate nothing');
});

test('frame identity, native dimensions and a bounded LRU survive many different enemy images',()=>{
 const {api}=harness(),sources=Array.from({length:13},()=>image('same-url',1024));
 const poses=sources.slice(0,12).map(s=>api.frame(s,pair,Math.PI/2,1,1024));
 assert.equal(new Set(poses).size,12,'distinct source objects may not share cached pixels');
 for(const p of poses){assert.equal(p.naturalWidth,p.width);assert.equal(p.naturalHeight,p.height);assert.equal(p.complete,true);}
 assert.equal(api.frame(sources[0],pair,Math.PI/2,1,1024),poses[0],'cache hit refreshes recency');
 api.frame(sources[12],pair,Math.PI/2,1,1024);
 assert.equal(api.frame(sources[0],pair,Math.PI/2,1,1024),poses[0],'recently used pose survives eviction');
 assert.notEqual(api.frame(sources[1],pair,Math.PI/2,1,1024),poses[1],'oldest unused pose is evicted');
 const stats=api.stats();assert.ok(stats.bytes<=stats.limit);assert.equal(stats.limit,48*1024*1024);
 assert.equal(stats.bytes,stats.entries*1024*1024*4);
 const changed=image('changeable',256),first=api.frame(changed,pair,Math.PI/2,1,256);
 changed.src='replacement';assert.notEqual(api.frame(changed,pair,Math.PI/2,1,256),first);
 api.clear();assert.equal(api.stats().entries,0);assert.equal(api.stats().bytes,0);
 const huge=image('uncached oversized',4096);
 assert.notEqual(api.frame(huge,pair,Math.PI/2,1,4096),api.frame(huge,pair,Math.PI/2,1,4096));
 assert.equal(api.stats().bytes,0,'one over-budget pose cannot defeat the memory cap');
});

test('downsampled frames keep source aspect and cached reductions across stride poses',()=>{
 const {api,canvases}=harness(),source=image('large original',1024,1536);
 const neutral=api.frame(source,pair,0,1,100);
 close(neutral.width/neutral.height,1024/1536,'uniform downsampling');
 assert.ok(neutral.width>=100&&neutral.width<1024);
 const count=canvases.length;
 assert.equal(api.frame(source,pair,0,1,100),neutral);
 assert.equal(canvases.length,count,'resting phase reuses the reduction');
 const walking=api.frame(source,pair,Math.PI/2,1,100);
 assert.equal(walking.width,neutral.width);assert.equal(walking.height,neutral.height);
 assert.equal(canvases.length,count+1,'a new gait pose reuses its existing reduced source');
});

test('the cultist\'s one-pixel shin still lifts a complete shoe without moving its robe',()=>{
 const {api}=harness(),source=image('cultist',153,220);
 for(const phase of [Math.PI/2,Math.PI*3/2]){
  const out=api.frame(source,Profiles.hum_cultist,phase,1,153);
  assert.notEqual(out,source,'both shoe tips must have a visible nonzero gait');
  const changed=patches(out);assert.equal(changed.length,1);
  const {clear,shin,foot}=changed[0];
  assert.ok(clear[1]>=215,'the hanging robe is outside the modified band');
  assert.ok(foot[1]-foot[5]>0&&foot[1]-foot[5]<1,'tiny foot lift survives subpixel quantization');
  assert.equal(foot[3],foot[7]);close(shin[5]+shin[7],foot[5],'tiny shin and ankle remain joined');
 }
});

test('the production profiles cover all painted enemies and keep special limb and hand regions safe',()=>{
 const skins=game.slice(game.indexOf('const RAID_SKINS='),game.indexOf('const mobImg='));
 const keys=[...skins.matchAll(/^\s*([a-z][a-z0-9_]*):\{/gm)].map(m=>m[1]);
 const mobSource=game.slice(game.indexOf('const MOB_SET='),game.indexOf('const MOB_SIZE='));
 const mobs=[...mobSource.matchAll(/'(hum_[a-z]+|bst_[a-z]+|und_[a-z]+)'/g)].map(m=>m[1]);
 assert.deepEqual(Object.keys(Profiles).sort(),[...keys,...mobs,'odin','rat'].sort());
 assert.equal(Object.keys(Profiles).length,29);
 assert.equal(Profiles.und_wraith.length,0,'a floating wraith must not acquire fake feet');
 for(const key of ['bst_boar','bst_wolf']){
  assert.equal(Profiles[key].length,4);
  assert.equal(Profiles[key][0].phase,Profiles[key][3].phase);
  assert.equal(Profiles[key][1].phase,Profiles[key][2].phase);
  assert.notEqual(Profiles[key][0].phase,Profiles[key][1].phase);
 }
 assert.equal(Profiles.bst_spider.length,5,'only the five visible supporting tips are legs');
 for(const [key,rows]of Object.entries(Profiles)){
  assert.ok(Object.isFrozen(rows),key+' profile cannot drift behind cached poses');
  for(const p of rows){
   assert.ok(Object.isFrozen(p));
   assert.ok([p.x0,p.x1,p.root,p.ankle,p.phase].every(Number.isFinite),key);
   assert.ok(p.x0>=0&&p.x1<=1&&p.x0<p.x1,key);
   assert.ok(p.root>=0&&p.root<p.ankle&&p.ankle<1,key);
  }
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/boss/cave-troll-manifest.json'),'utf8'));
 const [frameX,frameY]=manifest.split.bodyRect;
 for(const variant of ['briarhollow','cindervein','frostveil'])for(const [hx,hy]of Object.values(manifest.raidSkin.handPoints)){
  const x=(frameX+hx)/manifest.source[0],y=(frameY+hy)/manifest.source[1];
  for(const p of Profiles['cave_troll_'+variant])assert.ok(x<p.x0||x>p.x1||y<p.root,'reviewed club grip is outside every deforming region');
 }
 assert.ok(Profiles.hum_soldier[1].root*220>185,'sword crossing the right shin stays above motion');
 assert.ok(Profiles.hum_cultist.every(p=>p.root*220>=213),'robe and staff remain above the shoe-tip animation');
 assert.ok(Profiles.rat[1].x1*1024<825,'detached poison puddle is not dragged with the rat foot');
});

test('actual rat update advances stride by distance and settles when stationary or the hero dies',()=>{
 const start=game.indexOf('function updateRatBoss('),end=game.indexOf('function rebuildFarmItems(',start);
 assert.ok(start>=0&&end>start);
 const make=(speed=80)=>{
  const rb={x:100,y:100,ci:0,cj:0,ti:0,tj:0,speed,walk:0,footPhase:0,gait:0,moving:false};
  const hero={x:350,y:100,dead:false};
  const update=vm.runInNewContext(game.slice(start,end)+';updateRatBoss',{
   world:{ratboss:rb},hero,CRYPT:{C:1000,ox:0,oy:0,cols:4,rows:4},mazeFirstStep:()=>null
  });return {rb,hero,update};
 };
 const a=make(80),b=make(40);a.update(.1);b.update(.2);
 close(a.rb.x,b.rb.x,'same distance');close(a.rb.footPhase,b.rb.footPhase,'phase depends on movement distance, not elapsed time');
 assert.ok(a.rb.footPhase>0&&a.rb.gait>0&&a.rb.moving);
 const phase=a.rb.footPhase;
 a.hero.dead=true;a.update(.1);
 assert.equal(a.rb.gait,0);assert.equal(a.rb.moving,false);assert.equal(a.rb.footPhase,phase);
 const still=make();Object.assign(still.rb,{x:500,y:500,gait:1,footPhase:2});Object.assign(still.hero,{x:1500,y:500});
 still.update(.1);assert.equal(still.rb.moving,false);assert.equal(still.rb.footPhase,2);
 close(still.rb.gait,.4,'stationary gait fades');still.update(.1);assert.equal(still.rb.gait,0);
});

test('the actual enemy distance gate detects slow walking at high refresh rates and ignores tiny jitter',()=>{
 const start=game.indexOf('const md=Math.hypot(en.x-'),end=game.indexOf('\n  }\n  en._nd=',start);
 assert.ok(start>=0&&end>start,'extract the production stride update, not a reimplementation');
 const update=vm.runInNewContext('(en,dt)=>{'+game.slice(start,end)+'}');
 const states=[];
 for(const fps of [30,60,120,144,240]){
  const en={x:0,y:0,_ax:0,_ay:0,r:12,mv:0,wt:0};
  for(let n=0;n<fps*2;n++){en.x+=20/fps;update(en,1/fps);}
  assert.equal(en.mv,1,'slow mob animates at '+fps+' FPS');states.push(en.wt);
  const phase=en.wt;
  for(let n=0;n<fps;n++)update(en,1/fps);
  assert.equal(en.mv,0,'stationary feet settle at '+fps+' FPS');assert.equal(en.wt,phase);
  for(let n=0;n<fps;n++){en.x+=(n%2?1:-1)/fps;update(en,1/fps);}
  assert.equal(en.mv,0,'subthreshold positional jitter must not start a walk');
 }
 for(const phase of states)close(phase,states[0],'same distance gives the same gait across refresh rates');
});
