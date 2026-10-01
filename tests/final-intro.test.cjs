/* The Final Hour's opening scene and its violet wind (asked for 2026-10-01: "gör lite lila vind puffar där inne i rummet, sen gör
 * en film sekvens när man kommer in varje gång - gubben stannar upp, kamera panerar till bossen, han pratar 'So it's time you
 * come to me with the ice armor thinking that it will help' - sen ge mig lite mer text - sen startar fighten"). The scene's
 * own code runs here in a vm, phase by phase; how it is wired into the game is read from game.js. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};

function scene(){
 const log={msgs:[],sounds:0,rings:0},cls=new Set();
 const boss={x:1650,y:660,r:40,dead:false,state:'wander',hp:100,max:100};
 const c=vm.createContext({world:{},hero:{x:1650,y:2040,dead:false,moveTo:null,target:null,goPortal:false},boss,padHit:{},holdMove:null,marker:null,shakeT:0,
  S:{auto:false},combatAutoAllowed:()=>true,refreshCombatAutoControls(){log.autoShown=(log.autoShown||0)+1;},renderHUD(){},save(){log.saves=(log.saves||0)+1;},
  document:{body:{classList:{toggle:(n,on)=>on?cls.add(n):cls.delete(n)}}},ring(){log.rings++;},burst(){},noiseSweep(){log.sounds++;},blip(){log.sounds++;},
  stageMsg:m=>log.msgs.push(m),sfx:{arcane(){log.sounds++;},shout(){log.sounds++;}}});
 vm.runInContext(section('const FINAL_LINES=[','function drawFinalIntro(){')+'\nglobalThis.LINES=FINAL_LINES;globalThis.cine=()=>cinematicOn;',c);
 c.startFinalIntro(boss);
 return {c,log,cls,boss,I:()=>c.world.intro};
}
const run=(s,secs,each)=>{for(let i=0;i<Math.round(secs*60);i++){s.c.finalIntroTick(1/60);if(each)each();if(!s.c.world.intro)return i/60;}return secs;};

test('he has his say: the bars close, the hero stops, the camera glides up to him, four lines - and the fight begins',()=>{
 const s=scene(),h=s.c.hero;
 assert.equal(s.I().phase,'hold');assert.equal(s.c.cine(),true);assert.ok(s.cls.has('cinematic'),'the skill bar steps out of the picture');
 assert.equal(s.c.finalIntroHolds(),true);
 let held=true,phases=[],lines=new Set(),focusAtBoss=false;
 const total=run(s,90,()=>{
  const I=s.c.world.intro;if(!I)return;
  if(phases[phases.length-1]!==I.phase)phases.push(I.phase);
  if(I.phase==='speak'){lines.add(I.line);if(I.focus&&I.focus.x===1650&&I.focus.y===560)focusAtBoss=true;}
  if(I.phase!=='end'){h.moveTo={x:1,y:1};s.c.finalIntroTick(0);if(h.moveTo)held=false;}
 });
 assert.deepEqual(phases,['hold','pan','speak','back','end']);
 assert.deepEqual([...lines],[0,1,2,3],'all four lines, in order');
 assert.ok(focusAtBoss,'while he speaks the camera rests on him');
 assert.ok(held,'the hero stands still the whole time');
 assert.ok(total>18&&total<45,'left alone it runs '+total.toFixed(1)+' s');
 assert.equal(s.boss.state,'chase','and then he comes for you');
 assert.deepEqual(s.log.msgs,['☠ THE FINAL HOUR']);
 assert.equal(s.c.S.auto,true,'AUTO is on for the fight (asked for 2026-10-01)');assert.ok(s.log.autoShown>=1&&s.log.saves>=1,'its button shows it, and it is saved');
 assert.equal(s.c.cine(),false);assert.equal(s.c.finalIntroHolds(),false);assert.equal(s.c.world.intro,null,'the bars lift and the scene is gone');
});
test('a key hurries him: first the whole line, then the next one; after the last, the fight - and Esc or B skips the lot',()=>{
 let s=scene();
 run(s,1);assert.equal(s.I().phase,'pan');
 s.c.finalIntroNext();assert.equal(s.I().phase,'speak','straight to his words');assert.equal(s.I().line,0);
 run(s,.2);assert.ok(s.I().shown>0&&s.I().shown<s.c.LINES[0].length);
 s.c.finalIntroNext();assert.equal(s.I().shown,s.c.LINES[0].length,'the whole line at once');assert.equal(s.I().line,0);
 s.c.finalIntroNext();assert.equal(s.I().line,1,'then the next');assert.equal(s.I().shown,0);
 for(let i=0;i<6;i++)s.c.finalIntroNext();
 assert.equal(s.I().phase,'back');s.c.finalIntroNext();assert.equal(s.I().phase,'end');assert.equal(s.boss.state,'chase');
 s=scene();run(s,4);s.c.finalIntroSkip();assert.equal(s.I().phase,'end');assert.equal(s.boss.state,'chase');assert.deepEqual(s.log.msgs,['☠ THE FINAL HOUR']);
 s.c.finalIntroSkip();assert.deepEqual(s.log.msgs,['☠ THE FINAL HOUR'],'skipping twice does not start it twice');
 /* the pad: A hurries, B skips */
 s=scene();run(s,4);s.c.padHit.a=true;s.c.finalIntroTick(1/60);s.c.padHit.a=false;assert.equal(s.I().phase,'speak');
 s.c.padHit.b=true;s.c.finalIntroTick(1/60);assert.equal(s.I().phase,'end');
});
test('a scene with no one left to speak, or no one to hear it, ends at once',()=>{
 let s=scene();s.boss.dead=true;s.c.finalIntroTick(1/60);assert.equal(s.c.world.intro,null);assert.equal(s.c.cine(),false);
 s=scene();s.c.hero.dead=true;s.c.finalIntroTick(1/60);assert.equal(s.c.world.intro,null);
});
test('his words: the line asked for first, then three more of his own',()=>{
 const {c}=scene(),L=c.LINES;
 assert.equal(L.length,4);
 assert.match(L[0],/^So it is time\. You come to me wrapped in the Ice Armor, thinking it will help you\.$/);
 assert.ok(L.every(l=>l.length<=90),'each fits the bar on two lines');
 assert.doesNotMatch(L.join(' '),/[åäö]/,'English, like every name in the game');
});
test('drawn: black bars, his name in violet, his line as far as it is typed, and how to hurry or skip',()=>{
 const s=scene(),texts=[],fills=[];
 const ctx={save(){},restore(){},fillRect:(x,y,w,h)=>fills.push([x,y,w,h]),fillText:t=>texts.push(t),measureText:t=>({width:t.length*8}),set font(v){},set fillStyle(v){},set textAlign(v){}};
 Object.assign(s.c,{ctx,VW:1000,VH:700,inputMode:'kb',IS_TOUCH:false,getComputedStyle:()=>({fontFamily:'sans-serif'})});
 vm.runInContext(section('function drawFinalIntro(){','\n}\n')+'\n}',s.c);
 run(s,4);texts.length=0;fills.length=0;s.c.drawFinalIntro();
 assert.equal(fills.length,2,'a bar at the top and one at the bottom');assert.equal(fills[0][1],0);assert.equal(fills[1][1]+fills[1][3],700);
 assert.ok(texts.includes('The Forsaken One'));
 const typed=Math.floor(s.I().shown),said=texts.filter(t=>t!=='The Forsaken One'&&!/next/.test(t)).join(' ');
 assert.equal(said.replace(/\s+/g,' ').trim(),s.c.LINES[0].slice(0,typed).trim(),'as far as it is typed - no further');
 assert.ok(texts.includes('Space  next   ·   Esc  skip'));
 s.c.inputMode='pad';texts.length=0;s.c.drawFinalIntro();assert.ok(texts.includes('A  next   ·   B  skip'));
});
test('wired in: it starts each time you come up while he stands, holds the hero, the boss, the spells and the camera, and takes Space, Esc and clicks',()=>{
 assert.match(section('  if(z.finalb){\n   if(!S.bossDead[S.zone]&&!S.forsakenDead){','   else world.solids.push'),/spawnEnemyAt\(tmpls\[0\],R,\{x:world\.w\/2,y:world\.h\*0\.30\}\);\n    startFinalIntro\(enemies\[enemies\.length-1\]\);/);
 assert.match(game,/const hallSceneHolds=\(\)=>[^\n]*\|\|finalIntroHolds\(\);/,'the hero stands still - no walking, no swinging, no AUTO, no A prompt');
 assert.match(section('function cast(i,manual){','const c=classOf()'),/if\(finalIntroHolds\(\)\)return false;/,'no spells');
 const enemiesLoop=section(' // ----- enemies -----','  if(en._nd){');
 assert.match(enemiesLoop,/if\(world\.intro&&world\.intro\.phase!=='end'\)continue;/,'the boss waits for his last word');
 assert.match(game,/const cf=\(coronation&&coronation\.focus\)\|\|\(execution&&execution\.focus\)\|\|\(world\.intro&&world\.intro\.focus\)\|\|hero;/);
 const upd=section('function update(dt){','/* ==================== DRAW ==================== */');
 assert.match(upd,/if\(cinematicOn&&!finalIntroHolds\(\)\)setCinematic\(false\);[^\n]*\n if\(world&&world\.intro\)finalIntroTick\(dt\);/);
 const keys=section("window.addEventListener('keydown',e=>{","window.addEventListener('keyup',e=>{");
 const intro=keys.indexOf("if(gameOn&&world&&world.intro&&world.intro.phase!=='end'){");
 assert.ok(intro>0&&intro<keys.indexOf('if(gameOn&&casinoWinOpen(true)){'),'heard before anything else the keys do');
 assert.match(keys.slice(intro,intro+400),/if\(kl==='escape'\)\{e\.preventDefault\(\);if\(!e\.repeat\)finalIntroSkip\(\);return;\}\n  if\(kl===' '\|\|kl==='enter'\)\{e\.preventDefault\(\);if\(!e\.repeat\)finalIntroNext\(\);return;\}/,'Esc skips him instead of opening Settings');
 assert.match(section("cv.addEventListener('pointerdown',e=>{",'let best=null,bd=32;'),/if\(finalIntroHolds\(\)\)\{finalIntroNext\(\);return;\}/,'a click hurries him');
 const draw=section('function draw(){','\nconst sidebarResize=');
 assert.ok(draw.indexOf('if(world.intro)drawFinalIntro();')>draw.indexOf('drawWeather(now);'),'his bars and words over the world');
 assert.match(css,/body\.cinematic #skillbar,body\.cinematic #padHints\{opacity:0;pointer-events:none\}/);
});
test('the violet wind: puffs and curls on the floor of the arena only, under everyone and every warning, off with Weather',()=>{
 const n={img:0,stroke:0};
 const ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},stroke(){n.stroke++;},drawImage(){n.img++;},set globalAlpha(v){},set strokeStyle(v){},set lineWidth(v){},set lineCap(v){}};
 const tile={fillRect(){},createRadialGradient:()=>({addColorStop(){}})};
 const c=vm.createContext({ctx,VW:1400,VH:900,zoom:1,camX:900,camY:600,world:{arena:{x:1649.4,y:1072.1,rx:764.2,ry:693.3}},document:{createElement:()=>({getContext:()=>tile})}});
 vm.runInContext(section('const wxHash=','function weatherUpdate(')+section('let puffTex=null;','/* Zone maps are the biggest files'),c);
 c.drawFinalPuffs(12.3);
 assert.ok(n.img>4&&n.img<=30,'a few dozen puffs at most ('+n.img+' in view)');
 assert.ok(n.stroke>0&&n.stroke<=100,'and the curls, ten at most, in short fading strokes');
 n.img=n.stroke=0;c.world.arena=null;c.drawFinalPuffs(12.3);assert.equal(n.img+n.stroke,0,'nothing without an arena');
 const draw=section('function draw(){','\nconst sidebarResize=');
 const at=draw.indexOf('if(z.finalb&&WEATHER.on)drawFinalPuffs(now);');
 assert.ok(at>0&&at<draw.indexOf('drawPortal();')&&at<draw.indexOf('/* telegraphed boss hazards */'),'laid on the floor: before the portal, the warnings and everyone standing');
});
test('eight torches in their stone feet round the outer ring: on the ground, clear of the stairs, the bridges and where he blinks to; their light under everyone',()=>{
 const F=require('../assets/models/maps/final-ground.js'),A=F.ARENA;
 const zone=section('  if(z.finalb){ /* ☠ you walk in from the south','  if(z.altar){');
 assert.ok(zone.includes("for(let i=0;i<8;i++){const a=(22.5+45*i)*Math.PI/180,A=world.arena;\n    world.solids.push({x:Math.round(A.x+Math.cos(a)*A.rx*.93),y:Math.round(A.y-Math.sin(a)*A.ry*.93),r:12,type:'finaltorch',seed:i*1.7});}"));
 const torches=[...Array(8)].map((_,i)=>{const a=(22.5+45*i)*Math.PI/180;return {x:Math.round(A.x+Math.cos(a)*A.rx*.93),y:Math.round(A.y-Math.sin(a)*A.ry*.93)};});
 for(const t of torches){
  assert.ok(F.contains(t.x,t.y,12),'stands on the platform: '+t.x+','+t.y);
  for(const ang of [0.785,2.356,3.927,5.498])assert.ok(Math.hypot(t.x-(A.x+Math.cos(ang)*A.rx*.8),t.y-(A.y+Math.sin(ang)*A.ry*.8))>120,'clear of where he blinks to');
  assert.ok(Math.abs(t.x-1651)>200,'clear of the north stair and the way in');
  assert.ok(Math.abs(t.y-1072)>150,'clear of the bridges east and west');
 }
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(Math.hypot(torches[i].x-torches[j].x,torches[i].y-torches[j].y)>350,'spread round the ring');
 assert.ok(game.includes("if(s.type==='finaltorch'){drawFinalTorch(s,performance.now()/1000);ctx.restore();return;}"),'drawn as a prop, sorted with everyone standing');
 assert.ok(game.includes("else if(s.type==='finaltorch')drawGroundShadow(0,2,18,6);"));
 const draw=section('function draw(){','\nconst sidebarResize=');
 const light=draw.indexOf('if(z.finalb)drawFinalTorchLight(now);');
 assert.ok(light>0&&light<draw.indexOf('drawPortal();'),'their light lies on the floor, under everyone');
 assert.ok(game.includes("const finalTorchImg=new Image();finalTorchImg.src='assets/models/final_torch.png';"));
 const png=fs.readFileSync(path.join(__dirname,'..','assets/models/final_torch.png'));
 const m=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets/models/final-torch-manifest.json'),'utf8'));
 assert.equal(png.toString('latin1',1,4),'PNG');assert.ok(png.length<400*1024);
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],m.size);assert.match(m.job,/^[0-9a-f-]{36}$/);
});
