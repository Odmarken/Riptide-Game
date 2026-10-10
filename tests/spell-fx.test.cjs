'use strict';
/* ✨ Spell effects (assets/fx): every spell of every class has its own look, every recipe runs clean frame after frame on
   a stand-in canvas, effects die away and the pools stay capped, and game.js hands each spell to it at the right points. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const FILES=['spell-fx.js','spells-warrior.js','spells-mage.js','spells-hunter.js','spells-priest.js'];

/* a 2D context that takes every call and counts them */
function stubCtx(stats){
 const grad={addColorStop(){}};
 return new Proxy({},{
  get(t,k){
   if(k in t)return t[k];
   if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>grad;
   if(k==='getTransform')return ()=>({a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;}});
   return (...args)=>{stats.calls++;for(const v of args)if(typeof v==='number'&&!Number.isFinite(v))stats.nonFinite++;};
  },
  set(t,k,v){t[k]=v;if(typeof v==='number'&&!Number.isFinite(v))stats.nonFinite++;return true;},
 });
}
function load(){
 const stats={calls:0,nonFinite:0};
 const box=vm.createContext({Math,Number,Array,Map,Set,Object,JSON,performance:{now:()=>0}});
 vm.runInContext('globalThis.module=undefined;',box);
 for(const f of FILES)vm.runInContext(fs.readFileSync(path.join(root,'assets/fx',f),'utf8'),box,{filename:f});
 const FX=box.SpellFx;
 FX.setCanvasFactory((w,h)=>({width:w,height:h,getContext:()=>stubCtx(stats)}));
 return {FX,g:stubCtx(stats),stats};
}
/* every spell's fx id, read from CLASSES in game.js */
const spells=[...game.slice(game.indexOf('const CLASSES=['),game.indexOf('/* 10 scrolls')).matchAll(/\{n:'([^']+)',[^\n]*?t:'(\w+)'[^\n]*?fx:'(\w+)'\}/g)].map(m=>({n:m[1],t:m[2],fx:m[3]}));

test('every spell of every class has an fx id and a recipe behind it',()=>{
 assert.equal(spells.length,12,'four classes, three spells each');
 assert.equal(new Set(spells.map(s=>s.fx)).size,12,'each spell looks like itself - no two share a look');
 const {FX}=load();
 for(const s of spells){
  assert.ok(FX.has(s.fx),s.n+' -> '+s.fx);
  const r=FX.ids().includes(s.fx);assert.ok(r);
 }
});

function run(FX,g,secs,step=1/60,each){
 for(let t=0;t<secs;t+=step){FX.update(step);if(each)each(t);for(const L of ['ground','air','glow'])FX.draw(g,L,{x:-2000,y:-2000,w:4000,h:4000});FX.lights();}
}
test('each spell goes off, flies, lands and fades away cleanly, at both facings, for the hero and for a peer',()=>{
 const {FX,g,stats}=load();
 for(const s of spells)for(const fx of [1,-1])for(const peer of [false,true]){
  FX.clear();
  const o={x:0,y:0,gy:16,fx,rad:110,dur:6,cls:'x',tx:fx*140,ty:-6,targets:[{x:fx*140,y:-6,r:18},{x:fx*90,y:40,r:14},{x:-fx*60,y:-50,r:22}],peer,follow:()=>({x:0,y:0})};
  assert.equal(FX.cast(s.fx,o),true,s.n+' cast');
  const b={x:0,y:-10,tgt:{x:fx*140,y:-6},sp:470,fx:s.fx};
  run(FX,g,.6,1/60,()=>{b.x+=(b.tgt.x-b.x)*.08;b.y+=(b.tgt.y-10-b.y)*.08;FX.boltTick(b,1/60);FX.drawBolt(g,b,1);});
  const lands=s.t!=='buff'&&s.t!=='hot';   /* a buff or a heal lands on no foe */
  for(const crit of [false,true])assert.equal(FX.hit(s.fx,{x:fx*140,y:-6,r:18,crit,sx:0,sy:0,peer}),lands,s.n+' hit');
  run(FX,g,4);
  assert.deepEqual({...FX.count()},{effects:0,particles:0},s.n+' leaves nothing behind once it is over');
 }
 assert.equal(FX.faults,0,'no recipe threw');
 assert.equal(stats.nonFinite,0,'no NaN or Infinity reached the canvas');
 assert.ok(stats.calls>5000,'and they really drew');
});

test('auras run for exactly as long as the buff: behind, in front, at night and shedding as the hero walks',()=>{
 const {FX,g,stats}=load();
 for(const key of ['atk','haste','hot']){
  const shown=[];
  for(const left of [6,3,.4,0]){
   const before=stats.calls;
   const a={gy:16,fx:1,moving:true,x:0,y:0,[key]:left>0?{left,dur:6}:null};
   for(const L of ['back','front','glow'])FX.auras(g,a,L,1.5);
   for(let i=0;i<120;i++)FX.auraTick(a,1/60);
   shown.push(stats.calls>before);
  }
  assert.deepEqual(shown,[true,true,true,false],key+': drawn while it lasts, gone when it ends');
 }
 const hasAura=k=>FX.ids().some(id=>id&&FX.has(id));
 assert.ok(hasAura());
 run(FX,g,3);assert.deepEqual({...FX.count()},{effects:0,particles:0});
 assert.equal(FX.faults,0);assert.equal(stats.nonFinite,0);
});

test('a flood of spells stays inside the pools, and a spell lights the night while it burns',()=>{
 const {FX,g}=load();
 const lim=FX.limits();
 for(let i=0;i<400;i++){const s=spells[i%spells.length];FX.cast(s.fx,{x:i,y:0,gy:16,fx:1,rad:110,dur:6,tx:100,ty:0,targets:[{x:100,y:0,r:16}]});FX.hit(s.fx,{x:100,y:0,r:16,crit:true,sx:0,sy:0});}
 const n=FX.count();
 assert.ok(n.effects<=lim.effects&&n.particles<=lim.particles,JSON.stringify(n));
 FX.clear();
 FX.hit('fireball',{x:50,y:60,r:16,crit:false,sx:0,sy:0});
 run(FX,g,.05);
 const lit=FX.lights();
 assert.ok(lit.length>=1,'the explosion is a light');
 for(const L of lit){for(const k of ['x','y','fy','reach','head'])assert.ok(Number.isFinite(L[k]),k);assert.match(L.colour,/^\d+,\d+,\d+$/);assert.ok(L.pulse()>0);}
 run(FX,g,3);assert.equal(FX.lights().length,0,'and goes out with it');
 assert.equal(FX.quality,1);FX.quality=.5;FX.emit({x:0,y:0,n:10});assert.equal(FX.count().particles,5,'phones shed fewer sparks');
});

test('game.js hands every spell to its effect: going off, in flight, landing, as an aura, at night and to the party',()=>{
 const section=(a,b)=>{const i=game.indexOf(a);assert.ok(i>=0,a);return game.slice(i,game.indexOf(b,i));};
 const cast=section('function cast(i,manual){','function usePot(');
 assert.match(cast,/spellCastFx\(sp,fxTgt,fxList\);\n \(sfx\[sp\.vfx\]\|\|sfx\.arcane\)\(\);/,'every cast that gets through goes off with its look');
 assert.equal((cast.match(/fx:sp\.fx/g)||[]).length,2,'both spell projectiles carry the look');
 assert.equal((cast.match(/f:sp\.fx/g)||[]).length,2,'and tell the party which');
 assert.match(cast,/hero\.buff\[sp\.buff\]=\{mul:sp\.val,t:sp\.dur,dur:sp\.dur\};/);
 assert.match(cast,/hero\.hotT=sp\.dur;hero\.hotDur=sp\.dur;/);
 assert.match(section('function dealSpell(en,sp){','function heroGroundY('),/if\(SpellFx\.hit\(sp\.fx,\{x:ex,y:ey,r:er,crit,sx:hero\.x,sy:hero\.y,k:sp\.size\|\|1\}\)\)return;/);   /* k: 🌳 as big as the talents make it */
 assert.match(section('function spellCastFx(sp,tgt,list){','function heroAuraState('),/mpAct\('cast',\{f:sp\.fx,/);
 assert.match(game,/if\(b\.fx&&SpellFx\.drawBolt\(ctx,b,now\)\)continue;/);
 assert.match(game,/else if\(b\.fx&&SpellFx\.has\(b\.fx\)\)SpellFx\.boltTick\(b,dt\);/);
 const draw=section('function draw(){','\nconst sidebarResize=');
 const at=s=>{const i=draw.indexOf(s);assert.ok(i>=0,s);return i;};
 assert.ok(at("SpellFx.draw(ctx,'ground',fxView)")<at('const drawables=[];'),'the ground layer under every figure');
 assert.ok(at("SpellFx.draw(ctx,'air',fxView)")>at('for(const p of parts){'),'the air layer over them');
 assert.ok(at("SpellFx.draw(ctx,'glow',fxView)")>at('if(sunFrame)drawSunLight(now);'),'what shines is laid over the night');
 assert.ok(at('for(const L of SpellFx.lights())sunLights.push(L);')>at('sunLights.length=0;'),'and lights the night\'s light map');
 const hero=section('function drawHero(){','/* the pick, drawn over the hero');
 assert.ok(hero.indexOf("SpellFx.auras(ctx,aura,'back',now)")<hero.indexOf('emission=drawChampionSprite(ctx'),'the aura behind him');
 assert.ok(hero.indexOf("SpellFx.auras(ctx,aura,'front',now)")>hero.indexOf('emission=drawChampionSprite(ctx'),'and in front of him');
 assert.match(section('function update(dt){','/* ==================== DRAW ==================== */'),/SpellFx\.update\(dt\);/);
 assert.match(section('function buildZone(){','world={'),/SpellFx\.clear\(\);/,'a new zone starts clean');
 const peer=section('function mpPlayFx(m,p){','/* ============ WEBRTC LAYER');
 assert.match(peer,/\}else if\(m\.a==='cast'\)\{/,'a peer\'s spell goes off round them');
 assert.match(peer,/SpellFx\.hit\(m\.f,/,'and lands with its own look');
 assert.match(game,/drawHeroLike\(p\._x,p\._y,[^\n]*fxAura[^}\n]*\},p\.name/,'and they wear its aura');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 let last=-1;
 for(const f of FILES){const i=html.indexOf('<script src="assets/fx/'+f+'?v=');assert.ok(i>last,f+' loads, in order');last=i;}
 assert.ok(last<html.indexOf('<script src="game.js?v='),'all before game.js');
});

test('the basic shots have a look of their own (2026-10-09, "alla spells som skjuts ... lite mer episka"), and a fire trail is as long at any frame rate',()=>{
 const {FX,g,stats}=load();
 for(const id of ['firebolt','shot']){
  assert.ok(FX.has(id),id);
  FX.clear();
  const b={x:0,y:-10,tgt:{x:200,y:0},sp:430,fx:id,basic:true};
  run(FX,g,.4,1/60,()=>{b.x+=430/60;FX.boltTick(b,1/60);assert.equal(FX.drawBolt(g,b,1),true,id+' draws its own shot');});
  assert.equal(FX.hit(id,{x:200,y:0,r:16,crit:true,sx:0,sy:0}),true,id+' bites');
  run(FX,g,1.5);assert.equal(FX.count().effects,0,id+' fades');
 }
 assert.equal(stats.nonFinite,0);
 const trailAt=fps=>{const b={x:0,y:-10,tgt:{x:2000,y:0},sp:470,fx:'fireball'};for(let i=0;i<fps*.5;i++){b.x+=470/fps;FX.boltTick(b,1/fps);}const t=b._tr;return Math.hypot(t[0][0]-t[t.length-1][0],t[0][1]-t[t.length-1][1]);};
 const at60=trailAt(60),at240=trailAt(240);
 assert.ok(at60>80&&Math.abs(at240-at60)<10,`the Fireball's wake: ${at60.toFixed(0)} units at 60 fps, ${at240.toFixed(0)} at 240`);
 assert.ok(game.includes("fx:c.id==='hunter'?'shot':frost?'tree:frostbolt':'firebolt'"),'the hero\'s own shots carry it');   /* 🌳 or frost, with Frostbolt */
 assert.ok(game.includes('landHit(t,b.dmg,b.crit,b.label||null,b.basic);if(b.fx)SpellFx.hit(b.fx,o);'),'and land with it');
});
