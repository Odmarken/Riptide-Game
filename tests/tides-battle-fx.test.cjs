/* Run with: node --test tests/tides-battle-fx.test.cjs
 * ✨ Tides battle effects (asked for 2026-10-09: "gör så tides får coolare effekter också i sina attacker"). assets/tides/battle-fx.js
 * gives every move an element from its name and a contact from its verb, sets off the impact, the shield, the healing, the poison
 * and the rest when the battle timeline shows them, and draws them with the spell effects' helpers. Pinned here: the looks are
 * read right for all 325 species, whole battles run clean through it on a stand-in canvas, the numbers say what the log says,
 * nothing is left behind, and ui.js hands it every event and draws it round the Tides.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const Tides=require('../assets/tides/core.js');
const ui=read('assets/tides/ui.js'),html=read('index.html');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}

/* a 2D context that takes every call, counts them, and notices a number that is not finite */
function stubCtx(stats){
 const grad={addColorStop(){}};
 return new Proxy({},{
  get(t,k){
   if(k in t)return t[k];
   if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>grad;
   if(k==='getTransform')return ()=>({a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;}});
   if(k==='measureText')return ()=>({width:10});
   return (...args)=>{stats.calls++;for(const v of args)if(typeof v==='number'&&!Number.isFinite(v))stats.nonFinite++;};
  },
  set(t,k,v){t[k]=v;if(typeof v==='number'&&!Number.isFinite(v))stats.nonFinite++;return true;},
 });
}
function load(){
 const stats={calls:0,nonFinite:0},box=vm.createContext({Math,Number,Array,Map,Set,Object,JSON,String,performance:{now:()=>0}});
 vm.runInContext('globalThis.module=undefined;',box);
 vm.runInContext(read('assets/fx/spell-fx.js'),box);
 box.SpellFx.setCanvasFactory((w,h)=>({width:w,height:h,getContext:()=>stubCtx({calls:0,nonFinite:0})}));
 vm.runInContext(read('assets/tides/battle-fx.js'),box);
 return {Fx:box.TideBattleFx,stats,g:stubCtx(stats)};
}
const anchors={player:{x:300,y:420,hx:300,hy:420,w:150,h:130,dir:1},foe:{x:800,y:420,hx:800,hy:420,w:170,h:150,dir:-1},top:90,bottom:560};

test('every move reads as an element and a contact from its name - all 325 species',()=>{
 const {Fx}=load();
 const want={'Ember Claw':'fire','Burning Fang':'fire','Dawnfire':'fire','Cinder Pounce':'fire','Frozen Gore':'frost','Glacier Horn':'frost',
  'Lightning Claw':'storm','Thunder Focus':'storm','River Claw':'water','Reef Bite':'water','Ripple Remedy':'water','Riverstone Guard':'water',
  'Bramble Kick':'nature','Thorn Swipe':'nature','Seedburst':'nature','Sticky Sap':'nature','Amber Pincer':'nature','Stone Headbutt':'stone',
  'Tusk Strike':'stone','Obsidian Slam':'stone','Spirit Breath':'spirit','Spectral Fang':'spirit','Veil Siphon':'spirit','Rune Bolt':'arcane',
  'Crystal Bolt':'arcane','Dusk Bolt':'arcane','Aurora Bolt':'arcane','Lunar Talon':'arcane','Golden Claw':'light','Solar Roar':'light',
  'Quick Bite':'beast','Talon Slash':'beast','Fang Lunge':'beast'};
 for(const [name,el] of Object.entries(want))assert.equal(Fx.element([name]),el,name);
 assert.equal(Fx.element(['Hybrid Strike','Ember Claw']),'fire','a hybrid\'s plain strike borrows its parent\'s element');
 assert.equal(Fx.element(['Seedburst + Prism Split']),'nature','a hybrid power reads its first parent');
 assert.equal(Fx.contact(['Quick Bite']),'bite');assert.equal(Fx.contact(['Talon Slash']),'claw');assert.equal(Fx.contact(['Stone Headbutt']),'bash');
 assert.equal(Fx.contact(['Cinder Pounce']),'claw');assert.equal(Fx.contact(['Fang Lunge']),'bite');assert.equal(Fx.contact(['Acorn Charge']),'bash');
 for(const s of Tides.allSpecies())for(const m of [s.attack,s.skill]){
  const el=Fx.element([m.name,...(m.parentNames||[])]);assert.ok(Fx.LOOK[el],s.id+' '+m.name);
  assert.match(Fx.tint({color:m.color},el),/^\d{1,3},\d{1,3},\d{1,3}$/,s.id);
 }
 assert.equal(Fx.rgb('#ff8000'),'255,128,0');assert.equal(Fx.rgb('#f80'),'255,136,0');assert.equal(Fx.rgb('nonsense'),'255,255,255');
});

test('whole battles run clean through it: every event, every frame, every layer, and nothing is left behind',()=>{
 const {Fx,stats,g}=load();
 const ids=Tides.allSpecies().map(s=>s.id);let seed=7;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const timeline=new Function('return '+ui.slice(ui.indexOf(' function battleTimeline('),ui.indexOf(' function animationMove(')).trim()+';')();
 const types=new Set();
 for(let n=0;n<40;n++){
  const c=Tides.createCollection();Tides.purchaseLasso(c,10000,{rng:()=>0});const pet=c.pets[0];pet.speciesId=ids[Math.floor(rnd()*ids.length)];pet.level=30;
  const r=Tides.beginBattle(c,{speciesId:ids[Math.floor(rnd()*25)],level:30},{now:1,rng:rnd});if(!r.ok){c.trainer={xp:1600};}
  const b=r.ok?r.battle:Tides.beginBattle(c,{speciesId:ids[Math.floor(rnd()*25)],level:30},{now:1,rng:rnd}).battle;
  const st=Fx.create({rng:rnd});Fx.anchors(st,anchors);let time=0;
  for(let round=0;round<30&&!b.outcome;round++){
   const display={player:{...b.player},foe:{...b.foe}};
   const res=Tides.act(b,b.player.powerCooldown?'attack':(rnd()<.5?'power':'attack'),{rng:rnd});assert.ok(res.ok);
   const a=timeline(res.events,display);
   while(a.elapsed<a.duration){
    a.elapsed+=1/60;time+=1/60;
    while(a.shown<a.events.length&&a.events[a.shown].at<=a.elapsed){const e=a.events[a.shown++];types.add(e.type);
     const act=e.type==='attack'||e.type==='power'?e:a.moves.find(m=>m.side===e.actionSide);const unit=act&&display[act.side],s=unit&&Tides.getSpecies(unit.speciesId),move=act&&(act.type==='power'?s.skill:s.attack);
     Fx.event(st,e,move?{names:[move.name,...(move.parentNames||[])],name:move.name,color:move.color,style:move.style,power:act.type==='power'}:{});}
    const mv=a.moves.find(m=>a.elapsed>=m.start&&a.elapsed<m.start+m.duration);
    const flight=mv?{side:mv.side,target:mv.side==='player'?'foe':'player',progress:(a.elapsed-mv.start)/mv.duration,look:(()=>{const s=Tides.getSpecies(display[mv.side].speciesId),m=mv.type==='power'?s.skill:s.attack;return {names:[m.name],color:m.color,style:m.style,power:mv.type==='power'};})(),self:mv.type==='power'&&!Tides.getSkill(display[mv.side]).damage}:null;
    Fx.frame(st,time,{move:flight,units:display,animating:true});
    Fx.drawUnder(g,st,{units:display});Fx.drawMove(g,st,flight);Fx.drawOver(g,st,{units:display});
    assert.ok(st.parts.length<=320,'the particle pool stays capped');
   }
  }
  for(let i=0;i<240;i++){time+=1/60;Fx.frame(st,time,{units:{player:{hp:0},foe:{hp:0}}});Fx.drawOver(g,st,{});}
  assert.equal(st.parts.length+st.fx.length+st.floats.length,0,'two seconds after, the arena is clear');
  assert.equal(Fx.flash(st,'player')+Fx.flash(st,'foe'),0);const sh=Fx.shakeOffset(st);assert.ok(sh.x===0&&sh.y===0,'the arena stands still again');
 }
 for(const t of ['attack','power','damage','shield','buff','heal'])assert.ok(types.has(t),'the battles saw '+t);
 assert.ok(stats.calls>20000,'it drew');assert.equal(stats.nonFinite,0,'every number it drew with was finite');
});

test('what the numbers say: the log\'s damage, a block, the healing; words go under the feet, two at most',()=>{
 const {Fx}=load();const st=Fx.create({rng:()=>.5});Fx.anchors(st,anchors);
 const look={names:['Ember Claw'],color:'#f9975b',style:'melee',power:false};
 Fx.event(st,{type:'damage',side:'player',targetSide:'foe',text:'Crystal Gecko takes 62 damage.',amount:40},look);
 assert.equal(st.floats.at(-1).text,'-62','the hit as the log tells it, even when less was left to lose');assert.equal(st.floats.at(-1).side,'foe');
 assert.ok(Fx.flash(st,'foe')>.9&&st.shake>0,'the struck Tide flashes and the arena jolts');
 Fx.event(st,{type:'damage',side:'player',targetSide:'foe',text:'Crystal Gecko takes 0 damage (30 blocked).',amount:0},look);
 assert.equal(st.floats.at(-1).text,'Blocked');assert.ok(st.fx.some(e=>e.k==='wardhit'));
 Fx.event(st,{type:'heal',side:'foe',targetSide:'foe',text:'',amount:53},look);assert.equal(st.floats.at(-1).text,'+53');
 for(const w of ['Seedburst','Empowered','Weakened'])Fx.event(st,{type:w==='Seedburst'?'power':w==='Empowered'?'buff':'weaken',side:'player',targetSide:'player',text:''},{...look,name:w==='Seedburst'?w:'x'});
 assert.equal(st.floats.filter(f=>f.small&&f.side==='player').length,2,'a third caption waits its turn');
 const {Fx:F2}=load(),cap=[];const s2=F2.create();F2.anchors(s2,anchors);
 F2.event(s2,{type:'damage',side:'foe',targetSide:'player',text:'Ember Cub takes 9 damage.'},look);
 const ys=[];const g={...stubCtx({calls:0,nonFinite:0})};
 const rec=new Proxy({},{get(t,k){if(k==='fillText')return (txt,x,y)=>ys.push(y);if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>({addColorStop(){}});return k in t?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
 for(let i=0;i<60;i++){F2.frame(s2,i/60,{});F2.drawOver(rec,s2,{});}
 assert.ok(ys.length&&ys.every(y=>y>anchors.top),'a number never rises into the HUD');
});

test('ui.js hands it every event and draws it round the Tides; index.html loads it first',()=>{
 assert.ok(html.indexOf('assets/tides/battle-fx.js')>0&&html.indexOf('assets/tides/battle-fx.js')<html.indexOf('assets/tides/ui.js'));
 assert.match(ui,/appendLog\(e\.text\);battleSound\(e,a\);battleFx\(e,a\);/,'each event, once, as the timeline shows it');
 const fxFn=section(ui,' function battleFx(e,a){','\n }');
 assert.match(fxFn,/if\(!session\?\.bfx\|\|typeof TideBattleFx!=='object'\)return;/,'nothing before the arena is painted');
 assert.match(fxFn,/session\.battle\[side\]\.hp<=0\)TideBattleFx\.event\(session\.bfx,\{type:'ko'/);
 const look=section(ui,' function battleLook(e,a){','\n }');
 assert.match(look,/if\(!power&&s\.hybrid\)for\(const id of \[s\.parentA,s\.parentB\]\)/);
 const paint=section(ui,' function paintBattle(){',' function tick(dt){');
 const order=['TideBattleFx.anchors(bfx,','TideBattleFx.frame(bfx,session.time,','g.translate(shake.x,shake.y);','TideBattleFx.drawUnder(g,bfx,',
  "drawAnimal(g,b.player.speciesId","drawAnimal(g,b.foe.speciesId",'TideBattleFx.drawMove(g,bfx,flight);','TideBattleFx.drawOver(g,bfx,{units:b});'];
 let at=-1;for(const k of order){const i=paint.indexOf(k);assert.ok(i>at,k);at=i;}
 assert.match(paint,/TideBattleFx\.flash\(bfx,'player'\)\);/);assert.match(paint,/TideBattleFx\.flash\(bfx,'foe'\)\);/);
 assert.ok(!paint.includes('g.shadowBlur=15'),'the old plain orb is gone');
 assert.match(ui,/if\(flash>0\)\{g\.save\(\);g\.filter='brightness\('/,'drawAnimal lights a struck Tide');
});
