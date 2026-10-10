'use strict';
/* 🐉 Boss effects (assets/fx/boss-fx.js, 2026-10-09: "enchancements på alla bossar abilites"): every boss ability game.js
   names has a recipe; every warning, blast, missile, moment and shape runs clean frame after frame on a stand-in canvas and
   dies away; and game.js only changed the LOOK - the hazards' reach, timing and damage and the missiles' damage are as they
   were. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');

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
 for(const f of ['spell-fx.js','boss-fx.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets/fx',f),'utf8'),box,{filename:f});
 const FX=box.SpellFx;
 FX.setCanvasFactory((w,h)=>({width:w,height:h,getContext:()=>stubCtx(stats)}));
 return {FX,g:stubCtx(stats),stats};
}
const run=(FX,g,secs)=>{for(let t=0;t<secs;t+=1/60){FX.update(1/60);for(const L of ['ground','air','glow'])FX.draw(g,L,{x:-3000,y:-3000,w:6000,h:6000});FX.lights();}};
/* every boss: id game.js uses */
const used=[...new Set([...game.matchAll(/'(boss:[a-z]+)'/g)].map(m=>m[1]))];

test('every boss ability game.js names has its recipe, and every boss has its looks',()=>{
 const {FX}=load();
 assert.ok(used.length>=24,used.join(' '));
 for(const id of used)assert.ok(FX.has(id),id);
 const ai=game.slice(game.indexOf('function bossAI(en,dt){'),game.indexOf('/* ==================== INPUT ===================='));
 for(const call of ai.match(/hazardAt\([^;]*\);/g))assert.match(call,/,'boss:[a-z]+'\)/,'every warning has its look: '+call.slice(0,80));
 for(const push of ai.match(/ebolts\.push\(\{[^}]*\}\)/g))assert.match(push,/fx:'boss:[a-z]+'/,'every missile too: '+push.slice(0,80));
 for(const boss of ['reaper','gorehusk','maw','ossric','ashmaw','krev','betrayer','firelord','frostking','thor','odin'])
  assert.ok(new RegExp("B==='"+boss+"'[^]*?'boss:").test(ai),boss);
});

test('the warnings: drawn from first breath to the blow, the whole reach every time, then the blast fades away',()=>{
 const {FX,g,stats}=load();
 for(const id of used){
  const r=FX.ids().includes(id)&&id;
  const h={x:400,y:300,rad:id==='boss:embertrail'?24:150,warn:1.2,t:0,fx:id};
  let drew=0;
  for(let t=0;t<=1.2;t+=.1){h.t=t;if(FX.drawHazard(g,h,t))drew++;}
  if(drew)assert.equal(drew,13,id+' draws its warning at every moment');
  FX.clear();
  const hit=FX.hit(id,{x:400,y:300,r:150});
  if(drew)assert.equal(hit,true,id+' bursts where it lands');
  run(FX,g,3.5);
  assert.equal(FX.count().effects,0,id+' fades away');
 }
 assert.equal(FX.faults,0);assert.equal(stats.nonFinite,0);
});

test('the missiles fly by their own speed (no target), trail and land; the moments and the shapes run clean',()=>{
 const {FX,g,stats}=load();
 for(const id of ['boss:soulember','boss:waterbolt','boss:felglaive','boss:firebolt','boss:frostbolt','boss:stormbolt']){
  FX.clear();
  const b={x:0,y:0,vx:260,vy:-60,t:0,fx:id};
  for(let i=0;i<60;i++){b.x+=b.vx/60;b.y+=b.vy/60;FX.boltTick(b,1/60);assert.equal(FX.drawBolt(g,b,i/60),true,id);}
  assert.ok(b._tr&&b._tr.length>4,id+' leaves a trail');
  assert.equal(FX.hit(id,{x:b.x,y:b.y,r:10}),true);run(FX,g,1.5);assert.equal(FX.count().effects,0,id);
 }
 const hero={x:300,y:200};
 const casts={'boss:reaping':{x:0,y:0,a:.4,range:300,half:.6},'boss:blink':{x:0,y:0,r:40},'boss:dive':{x:0,y:0},
  'boss:chargelane':{x:0,y:0,dx:1,dy:0,follow:()=>({x:10,y:0})},'boss:mjolnir':{x:0,y:-20,tx:300,ty:190,target:()=>hero},
  'boss:groundshake':{x:0,y:0,r:220},'boss:enrage':{x:0,y:0,r:140,c:'160,107,208'},'boss:summon':{x:0,y:0,c:'182,255,122'},
  'boss:slam':{x:0,y:0,sx:-40,sy:0,c:'255,134,36',style:'slash'}};
 for(const [id,o] of Object.entries(casts)){FX.clear();assert.equal(FX.cast(id,o),true,id);run(FX,g,3.2);assert.equal(FX.count().effects,0,id+' fades away');}
 const shapes={'boss:soulbeam':{x:0,y:0,ux:.8,uy:.6,len:1400,half:58},'boss:reaping':{x:0,y:0,a:1,p:.7,range:300,half:.6},
  'boss:thorstorm':{cx:500,cy:400,a:2,len:900,half:40,n:3},'boss:chargelane':{x:0,y:0,dx:.6,dy:.8,len:236,half:40,p:.5}};
 for(const [id,o] of Object.entries(shapes))for(let i=0;i<20;i++)assert.equal(FX.drawSpecial(id,g,o,i/20),true,id);
 assert.equal(FX.faults,0);assert.equal(stats.nonFinite,0);
});

test("every boss's own blow has a look - the bladed ones slash, the rest smash, the dungeon guardians in their dungeon's colours",()=>{
 const {FX,g,stats}=load();
 for(const o of [{style:'slash',c:'201,160,255'},{style:'smash',c:'127,208,255'},...['briarhollow','cindervein','frostveil',null].map(d=>({style:'smash',c:'200,180,140',dungeon:d}))]){
  FX.clear();assert.equal(FX.cast('boss:slam',{x:10,y:10,sx:-30,sy:0,...o}),true);run(FX,g,1);assert.equal(FX.count().effects,0);
 }
 assert.equal(FX.faults,0);assert.equal(stats.nonFinite,0);
 assert.equal((game.match(/sfx\.hit\(\);bossSlam\(en\);/g)||[]).length,2,'both ways a boss swings: at reach and up close');
 assert.ok(game.includes("const BOSS_SLASH=new Set(['reaper','krev','betrayer','frostking','firelord']);"));
 assert.ok(game.includes("const DUNGEON_FX_C={briarhollow:'159,189,104',cindervein:'233,150,87',frostveil:'166,200,218'};"));
 assert.ok(game.includes("const dg=en.dungeon||null;"),'a guardian is known by its dungeon');
 assert.ok(game.includes("const dmg=hurtHero(amount,undefined,melee?foe:null);sfx.hit();if(melee)bossSlam(foe);"),'and its club lands with that look');   /* 🌳 the club's swinger answers the tree's thorns */
});

test('game.js only changed the look: reach, timing and damage of every blow as before, the plain look kept as a fallback',()=>{
 assert.ok(game.includes("function hazardAt(x,y,rad,warn,dmg,c,fx){hazards.push({x,y,rad,warn,t:0,dmg,c:c||'#e88a5a',fx});}"));
 assert.ok(game.includes("if(!hero.dead&&Math.hypot(hero.x-h.x,hero.y-h.y)<h.rad)hurtHero(h.dmg);\n   if(!(h.fx&&SpellFx.hit(h.fx,{x:h.x,y:h.y,r:h.rad}))){burst(h.x,h.y,h.c,10,90,true);ring(h.x,h.y,h.rad*0.7,h.c,0.35);}"),'the blow, then its look');
 assert.ok(game.includes('if(h.fx&&SpellFx.drawHazard(ctx,h,now))continue;')&&game.includes('if(b.fx&&SpellFx.drawBolt(ctx,b,now))continue;'));
 for(const [a,b] of [["hazardAt(x,y,190,1.25+Math.random()*0.5,en.atk*2.6,'#a06bd0','boss:runes')",'runes'],["hazardAt(en.x,en.y,290,1.4,en.atk*1.4,'#d0d8e8','boss:bonenova')",'bone nova'],
  ["hazardAt(en.x+Math.cos(a)*rad,en.y+Math.sin(a)*rad*0.85,116,1.5,en.atk*1.96,'#a0e0ff','boss:frostring')",'ring of frost'],["hazardAt(hero.x+(Math.random()-0.5)*120,hero.y+(Math.random()-0.5)*120,290,1.2,en.atk*1.4,'#ff5a3a','boss:hellfire')",'hellfire']])
  assert.ok(game.includes(a),b+': the same numbers');
 assert.ok(game.includes("if(perp<40){hurtHero(en.atk*3.5,'⚡');en.stormTick=0.5;sfx.arcane();}")&&game.includes("half:40,n:3},now)"),'Thor\'s lanes drawn as wide as they hurt');
 assert.ok(game.includes("SpellFx.drawSpecial('boss:soulbeam',ctx,{...en.beamFx,half:BEAM_HALF},now)"),'the Soulbeam drawn as wide as it hurts');
 assert.ok(/<script src="assets\/fx\/boss-fx\.js\?v=\d+"><\/script>/.test(fs.readFileSync(path.join(root,'index.html'),'utf8')));
});

test('the dungeon guardians: all eighteen moves warn and land in their dungeon\'s look, throws fly the whole warning, and the roar',()=>{
 const {FX,g,stats}=load();
 require('../assets/wasteland/dungeons.js');const D=globalThis.WastelandDungeons,moves=[];
 for(const [key,d] of Object.entries(D.definitions))for(const b of d.bosses)for(const m of b.moves)moves.push([key,m]);
 assert.equal(moves.length,18,'six guardians, three moves each');
 for(const [key,m] of moves){
  const cast={...m,x:400,y:300,angle:.7,elapsed:0,color:'#abc',damage:10,...(m.thrown?{fromX:250,fromY:240}:{})};
  for(let i=0;i<=10;i++){cast.elapsed=m.warn*i/10;assert.equal(FX.drawSpecial('boss:dgcast',g,{cast,dungeon:key,p:i/10},i/10),true,m.name);}
  FX.clear();assert.equal(FX.cast('boss:dgstrike',{cast,dungeon:key}),true,m.name);run(FX,g,3.5);assert.equal(FX.count().effects,0,m.name+' fades');
 }
 for(const key of Object.keys(D.definitions)){FX.clear();assert.equal(FX.cast('boss:dgroar',{x:0,y:0,dungeon:key,r:170}),true);run(FX,g,1.5);assert.equal(FX.count().effects,0);}
 assert.equal(FX.faults,0);assert.equal(stats.nonFinite,0);
 assert.ok(game.includes("onStrike:(cast,foe)=>{if(foe.boss)SpellFx.cast('boss:dgstrike',{cast,dungeon:foe.dungeon});}"));
 assert.ok(game.includes("onRoar:foe=>{SpellFx.cast('boss:dgroar'")&&game.includes("SpellFx.drawSpecial('boss:dgcast',ctx,"));
});
