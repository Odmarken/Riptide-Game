'use strict';
/* ✨ Weapon runes in action (asked for 2026-10-09: "gör så alla vapen enchants har bättre effekt nu när vi har renare effekts").
   assets/fx/rune-fx.js gives each of the five runes a swing, a landing and a shot's trail, and game.js sets them off from the
   weapon's own blows - a look only, the runes still change no number. Pinned: every rune has its look and it runs clean, the game
   calls it from the swing, the landed blow and the flying shot, a hidden weapon shows none, the party sees it, and it lights the
   night round its bearer. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js'),html=read('index.html');
function section(start,end){const a=game.indexOf(start),b=game.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return game.slice(a,b);}
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
 const stats={calls:0,nonFinite:0},box=vm.createContext({Math,Number,Array,Map,Set,Object,JSON,performance:{now:()=>0}});
 vm.runInContext('globalThis.module=undefined;',box);
 for(const f of ['spell-fx.js','rune-fx.js'])vm.runInContext(read('assets/fx/'+f),box,{filename:f});
 box.SpellFx.setCanvasFactory((w,h)=>({width:w,height:h,getContext:()=>stubCtx(stats)}));
 return {FX:box.SpellFx,g:stubCtx(stats),stats,box};
}
const RUNES=[...section('const WENCH=[','const wenchById=').matchAll(/\{id:'(\w+)'/g)].map(m=>m[1]);
function run(FX,g,secs,each){for(let t=0;t<secs;t+=1/60){FX.update(1/60);if(each)each(t);for(const L of ['ground','air','glow'])FX.draw(g,L,{x:-2000,y:-2000,w:4000,h:4000});FX.lights();}}

test('every rune the hall cuts has its swing, its landing and its trail, and they run clean and die away',()=>{
 assert.deepEqual(RUNES,['emberbite','frostgrip','veinseeker','stormetch','goldrune']);
 const {FX,g,stats,box}=load();
 assert.deepEqual([...box.RUNE_FX],RUNES,'rune-fx.js knows exactly the five');
 for(const id of RUNES)for(const fx of [1,-1])for(const crit of [false,true]){
  FX.clear();
  assert.equal(FX.cast('rune:swing',{x:0,y:0,gy:16,fx,tx:fx*60,ty:4,id}),true,id+' swing');
  let to={x:0,y:-22};
  assert.equal(FX.hit('rune:'+id,{x:fx*60,y:4,r:16,crit,sx:0,sy:0,near:[{x:fx*120,y:20,r:14}],to:()=>to}),true,id+' hit');
  const b={x:0,y:-10,tgt:{x:fx*200,y:0},fx:'rune:'+id};
  let lit=false;
  run(FX,g,.8,t=>{b.x+=fx*4;FX.boltTick(b,1/60);to={x:-t*30,y:-22};if(FX.lights().length)lit=true;});
  assert.ok(lit,id+' lights the night where it lands');
  run(FX,g,3);
  const n=FX.count();assert.equal(n.effects+n.particles,0,id+' leaves nothing behind');
 }
 FX.clear();assert.equal(FX.cast('rune:swing',{x:0,y:0,id:'nonsense'}),true);run(FX,g,.5);assert.equal(FX.count().effects,0,'an unknown rune draws nothing');
 assert.equal(FX.faults,0,'no recipe threw');assert.equal(stats.nonFinite,0);assert.ok(stats.calls>3000);
});

test('Emberbite\'s light is warm - the GPU heat haze rises off it - and the others\' are not',()=>{
 const {FX}=load(),warm=[];
 for(const id of RUNES){FX.clear();FX.hit('rune:'+id,{x:0,y:0,r:16});FX.update(1/60);const L=FX.lights()[0];const c=L.colour.split(',').map(Number);
  if(c[0]>200&&c[1]<195&&c[2]<170&&c[0]>c[2]+80&&c[1]>c[2])warm.push(id);}   /* game.js heatPass's test for fire */
 assert.deepEqual(warm,['emberbite']);
});

test('game.js: the swing, the landed blow and the shot carry the worn rune; a hidden weapon shows none',()=>{
 assert.match(game,/const heroRune=\(\)=>S&&!S\.hideWeapon&&S\.gear\?runeOf\(S\.gear\.weapon\):null;/);
 const swing=section('function heroSwing(en,c,dmg,crit,label){','\n}\n');
 assert.match(swing,/else\{sfx\.swing\(\);if\(wr\)SpellFx\.cast\('rune:swing',\{x:hero\.x,y:hero\.y,gy:heroGroundY\(\),fx:hero\.fx\|\|1,tx:en\.x,ty:en\.y,id:wr\.id\}\);landHit/,'a melee swing sweeps the rune');
 assert.match(swing,/fx:c\.id==='hunter'\?'shot':frost\?'tree:frostbolt':'firebolt',\.\.\.\(wr\?\{rune:wr\.id\}:\{\}\)\}\);/,'a shot carries it');   /* 🌳 Frostbolt turns a mage's bolt to frost */
 assert.match(swing,/c:c\.boltC,\.\.\.\(wr\?\{wr:wr\.id\}:\{\}\)\}\);/,'the party is told, and a weapon with no rune sends what it always sent');
 const land=section('function landHit(en,dmg,crit,label,basic){','function applyDmg(');
 assert.ok(land.indexOf('runeHitFx(en,crit);')>land.indexOf('if(basic){')&&land.indexOf('runeHitFx(en,crit);')<land.indexOf("hasEnch('flames')"),'only a weapon\'s own blow, not a spell');
 assert.match(game,/if\(b\.rune\)SpellFx\.boltTick\(\{x:b\.x,y:b\.y,tgt:b\.tgt,fx:'rune:'\+b\.rune\},dt\);/);
 /* run the helpers: Stormetch finds the foes beside the struck one, Veinseeker the hero */
 const hits=[],c={S:{gear:{weapon:{wench:'stormetch'}},hideWeapon:false},hero:{x:0,y:0,fx:1,dead:false},enemies:[],
  runeOf:it=>it&&it.wench?{id:it.wench}:null,dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),SpellFx:{hit:(id,o)=>hits.push({id,o})},Math};
 vm.createContext(c);vm.runInContext(section('const heroRune=','const RUNE_LIGHT='),c);
 const en={x:50,y:0,r:16},near={x:120,y:0,r:12},far={x:400,y:0,r:12},dead={x:60,y:0,dead:true};c.enemies.push(en,near,far,dead);
 c.runeHitFx(en,true);assert.equal(hits[0].id,'rune:stormetch');assert.deepEqual(JSON.parse(JSON.stringify(hits[0].o.near)),[{x:120,y:0,r:12}]);
 assert.equal(hits[0].o.crit,true);assert.deepEqual({...hits[0].o.to()},{x:0,y:-22});
 c.S.hideWeapon=true;c.runeHitFx(en,false);assert.equal(hits.length,1,'a hidden weapon burns no rune');
 c.S.hideWeapon=false;c.S.gear.weapon={};c.runeHitFx(en,false);assert.equal(hits.length,1,'nor does a weapon with none');
});

test('the party sees a peer\'s rune, and a runed weapon lights the ground round its bearer at night',()=>{
 const peer=section('function mpPlayFx(m,p){','}else if(m.a===\'boltfx\')');
 assert.match(peer,/const wr=typeof m\.wr==='string'&&RUNE_LIGHT\[m\.wr\]\?m\.wr:null;/,'only a rune it knows');
 assert.match(peer,/if\(wr\)\{SpellFx\.cast\('rune:swing',/);assert.match(peer,/arrow:!!m\.ar,\.\.\.\(wr\?\{rune:wr\}:\{\}\)\}\);/);
 assert.match(game,/if\(b\.rune\)SpellFx\.hit\('rune:'\+b\.rune,\{x:b\.tgt\.x,y:b\.tgt\.y,r:16,sx:b\.x,sy:b\.y\}\);/,'their shot lands with it');
 assert.match(game,/if\(sunFrame&&SUN\.light&&SUN\.dark>0&&!hero\.dead&&!fish\.on&&!TideUI\.isBattling\(\)\)\{const wr=heroRune\(\);if\(wr\)sunLights\.push\(runeLight\(wr,now\)\);\}/);
 const c={hero:{x:100,y:200,fx:-1},heroGroundY:()=>12,Math};vm.createContext(c);vm.runInContext(section('const RUNE_LIGHT=','\nfunction heroBasicAttack('),c);
 for(const id of ['emberbite','frostgrip','veinseeker','stormetch','goldrune']){
  const L=c.runeLight({id},3.2);assert.equal(L.x,90);assert.equal(L.y,212);assert.equal(L.fy,182);assert.match(L.colour,/^\d+,\d+,\d+$/);
  const v=L.pulse(3.2);assert.ok(v>0&&v<=1,id);
 }
 assert.ok(html.indexOf('assets/fx/rune-fx.js')>html.indexOf('assets/fx/spell-fx.js')&&html.indexOf('assets/fx/rune-fx.js')<html.indexOf('game.js?v='));
});
