/* Run with: node --test tests/bug-review-2026-11-24-combat.test.cjs
 * The combat fixes from the 2026-11-24 bug review, pinned so they stay fixed. The fight is the real one: cast, dealSpell, applyDmg
 * and the Skill Tree's hooks are cut from game.js and run in a vm against a pretend world (hero attack 100, no crits, no dice).
 *  - Holy Beam with Wrath of Heaven: one pillar, on the target - it fell once for every foe on the line.
 *  - The tree's cooldowns and its blows a beat behind count the fight's own time (treeTick), not the wall clock and not setTimeout:
 *    the pause screen brought the "once every 3 minutes" saves back, a Reset wiped them, and a meteor landed in a paused world.
 *  - A slain foe drops its burn, bomb, mark, freeze and stun: they went off on the foe that got back up.
 *  - Piercing Shot's lance reaches the target the cast was accepted at.
 *  - A double click on "Bind to weapon" spends one enchant, not the twin as well.
 *  - Fortune counts as the tree stands at the kill, not as it stood when the zone was built.
 *  - What a talent laid on the ground stays in the zone it was laid in.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const T=require('../assets/tree/skill-tree.js');
const section=(a,b)=>{const i=game.indexOf(a);assert.ok(i>=0,'section '+a);const j=game.indexOf(b,i+a.length);assert.ok(j>i,'section end '+b);return game.slice(i,j);};
const CLASSES=vm.runInNewContext('('+section('const CLASSES=[','/* 10 scrolls').replace('const CLASSES=','').replace(/;\s*$/,'')+')');
const FIGHT='/* ---- 🌳 THE TREE IN THE FIGHT ----',FIGHT_END='/* the tree\'s auras a peer can carry too';

function box(cls,tree,opt={}){
 const c={SkillTree:T,console,Math:Object.assign(Object.create(Math),{random:()=>.5}),wall:1000000,
  S:{cls,tree,prestige:40,lvl:60,gear:{weapon:{name:'Sword',slot:'weapon'},armor:null,trinket:null},bag:[],pots:{hp:0,mp:0}},
  performance:{now:()=>c.wall},setTimeout(){c.timeouts++;return 1;},timeouts:0,clearTimeout(){},
  gameOn:true,gamePaused:false,shakeT:0,inputMode:'kb',
  hero:{x:0,y:0,r:13,hp:1000,mana:1000,cd:0,spellCd:[0,0,0],buff:{},hotT:0,fx:1,dead:false,target:null,moving:false,swing:0},
  enemies:[],bolts:[],hazards:[],ebolts:[],fx:[],
  classOf:()=>CLASSES.find(k=>k.id===c.S.cls),raceOf:()=>({}),zoneOf:()=>({}),
  heroMax:()=>1000,manaMax:()=>1000,heroAtk:()=>100,heroCrit:()=>0,spellManaCost:()=>24,
  scrollPct:()=>0,scrollRaw:()=>0,hasEnch:()=>false,activePet:()=>null,gearSum:()=>0,wornInsc:()=>0,fkBonus:()=>0,
  isFG:()=>false,isFK:()=>false,syncFelGlaives:()=>({}),runeOf:()=>null,swiftMul:()=>1,hasteBoostMul:()=>1,
  drawWeapons(){},floatAt(){},bloodAt(){},ring(){},burst(){},sparkles(){},zapLine(){},
  heroDies(){c.hero.dead=true;},mpAct(){},mpGuestRaidHit:()=>false,mp:{on:false},
  sfx:new Proxy({},{get:()=>()=>{}}),SpellFx:{cast(id,o){c.fx.push({id,...o});return true;},hit(){return true;},has:()=>true},
  killEnemy(en){if(en.dead)return;en.dead=true;en.deadT=0;},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),TideUI:{isBattling:()=>false},finalIntroHolds:()=>false,mountRide:{},stageMsg(){},
  paintedCharacterFrame:()=>null,outfitArg:()=>false,INSC_ORB_MUL:1.5,INSC_ORB_SPLASH:.5,INSC_ORB_RAD:60,...opt};
 vm.createContext(c);
 vm.runInContext(section('let treeVer=0','const heroMax=')
  +section('/* ==================== COMBAT ====================','function usePot(')
  +section(FIGHT,FIGHT_END)+section('const treeIced=','/* how big the hero is drawn')
  +'\nglobalThis.api={tstat,ton,TT,cast,dealSpell,applyDmg,treeTick,treeFoe,treeCheatDeath,treeReady,treeUse,treeMeteor,treeZone,treeTimersReset,treeLeaveZone,treeGold,treeLater,heroRange,bump(){treeVer++;}};',c);
 c.foe=(name,x,y,o={})=>{const e={name,x,y,r:14,hp:100000,max:100000,dead:false,hidden:false,slowT:0,state:'wander',home:{x,y},...o};c.enemies.push(e);return e;};
 c.fight=secs=>{for(let t=0;t<secs-1e-9;t+=.05)c.api.treeTick(.05);};   /* the world running: what update() gives the tree every frame */
 return c;
}

test('Holy Beam with Wrath of Heaven: the fifth Smite calls ONE pillar, on the target, however many stand on the line',()=>{
 const tree={p_holyfire:3,p_judge:2,p_beam:'holybeam',p_searing:3,p_wrath:1};
 for(const n of [1,3,5]){
  const c=box('priest',tree),foes=[];
  for(let i=0;i<n;i++)foes.push(c.foe('f'+i,30+i*12,0));
  c.hero.target=foes[n-1];   /* the one he aims at is the LAST on the line: the pillar is his, not the nearest foe's */
  for(let k=1;k<=5;k++){c.hero.spellCd=[0,0,0];c.fx.length=0;assert.equal(c.api.cast(0,true),true);if(k<5){c.fight(.6);assert.equal(c.fx.filter(f=>f.id==='tree:pillar').length,0,'no pillar on Smite '+k);}}
  const pillars=c.fx.filter(f=>f.id==='tree:pillar');
  assert.equal(pillars.length,1,n+' on the line: one pillar');
  assert.equal(pillars[0].x,foes[n-1].x,'on the target');
  const hp=foes.map(f=>f.hp);c.fight(.6);
  for(const [i,f] of foes.entries())assert.ok(hp[i]-f.hp>=270&&hp[i]-f.hp<=330,'one pillar of 300% lands on each foe in its ring, once ('+(hp[i]-f.hp)+')');
 }
 /* Penance already kept it to its last strike */
 const c=box('priest',{...tree,p_beam:'penance'});const f=c.foe('f',30,0);c.hero.target=f;
 for(let k=1;k<=5;k++){c.hero.spellCd=[0,0,0];c.fx.length=0;c.api.cast(0,true);c.fight(.6);}
 assert.equal(c.fx.filter(x=>x.id==='tree:pillar').length,1);
 assert.match(section('function treeBeam(','\n}'),/_pillar:!!sp\._pillar&&e===at/);
});

test('the tree\'s cooldowns count the fight\'s time: no save comes back on the pause screen, and a Reset does not clear them',()=>{
 const c=box('warrior',{w_unyielding:1});
 c.hero.hp=0;assert.equal(c.api.treeCheatDeath(),true,'the first killing blow is turned');assert.equal(c.hero.hp,1);
 c.fight(10);c.hero.hp=0;assert.equal(c.api.treeCheatDeath(),false,'ten seconds on, it is not ready');
 c.wall+=600000;   /* ten minutes on the pause screen: the frame loop calls no update(), so no treeTick */
 c.hero.hp=0;assert.equal(c.api.treeCheatDeath(),false,'a pause passes none of its three minutes');
 assert.equal(c.api.treeReady('unyielding'),false);
 /* Reset and relearn: what was running is gone, the cooldowns are not */
 c.api.TT().shield=50;c.api.TT().iceT=2;
 c.api.treeTimersReset();
 assert.equal(c.api.TT().shield,0);assert.equal(c.api.TT().iceT,0);
 assert.equal(c.api.treeReady('unyielding'),false,'a Reset does not bring the save back');
 c.fight(169);assert.equal(c.api.treeReady('unyielding'),false,'179 s of fight');
 c.fight(1.1);assert.equal(c.api.treeReady('unyielding'),true,'three minutes of fight');
 c.hero.hp=0;assert.equal(c.api.treeCheatDeath(),true);
 /* the clock is the tree's own and lives with TT (never in the save): another hero starts with everything ready */
 assert.match(section(FIGHT,FIGHT_END),/const treeClock=\(\)=>TT\(\)\.clock;/);
 assert.ok(!/performance\.now\(\)/.test(section('function TT(){','const treeShoutOn=')),'no wall clock in the cooldowns');
 c.S={...c.S};assert.equal(c.api.treeReady('unyielding'),true);
 assert.ok(!('cd' in c.S)&&!('clock' in c.S),'nothing of it is written on the hero');
 /* Prayer of Mending's two seconds are fight seconds too */
 const p=box('priest',{p_guardian:'mending'}),blow=()=>vm.runInContext('hurtHero(100,undefined,null)',p);   /* 98 after the priest's 2% armour */
 p.hero.hp=500;blow();assert.equal(p.hero.hp,500-98+20,'a blow heals 2%');
 p.wall+=60000;blow();assert.equal(p.hero.hp,422-98,'not again after a minute of pause');
 p.fight(2.1);blow();assert.equal(p.hero.hp,324-98+20,'again after two seconds of fight');
});

test('a talent\'s blow a beat behind waits in a paused world, comes once, and is dropped with a fallen hero or a zone left',()=>{
 assert.ok(!/setTimeout\(/.test(section(FIGHT,FIGHT_END)),'the tree in the fight uses no setTimeout');
 assert.match(game,/\n treeTick\(dt\);   \/\* 🌳/,'update() ticks the tree every frame, fallen or not');
 assert.match(section('function treeTick(dt){','\n}'),/T\.clock\+=dt;[^\n]*\n if\(T\.later\.length\)[^\n]*\n if\(hero\.dead\)return;/);
 const m=box('mage',{m_meteor:1}),boss=m.foe('Boss',100,0,{boss:true});
 m.api.treeMeteor(100,0,m.api.ton('meteor'));
 m.gamePaused=true;m.wall+=5000;   /* paused before it lands: no update(), no treeTick */
 assert.equal(m.timeouts,0);assert.equal(boss.hp,100000,'nothing lands in a paused world');assert.equal(m.api.TT().zones.length,0);
 m.gamePaused=false;m.fight(.5);assert.equal(boss.hp,100000,'0.5 s of fight: still on its way');
 m.fight(.05);assert.equal(boss.hp,99700-10,'it lands when the fight has run its 520 ms: 300%, and the crater\'s first 10%');assert.equal(m.api.TT().zones.length,1);
 assert.equal(m.api.TT().later.length,0);m.fight(5);assert.equal(boss.hp,99700-60,'and only once: the rest is the burning ground\'s six bites');
 /* a fallen hero: the blow asks for itself and is gone, it does not wait for him to get up */
 const d=box('mage',{m_meteor:1}),b2=d.foe('Boss',100,0,{boss:true});
 d.api.treeMeteor(100,0,d.api.ton('meteor'));d.hero.dead=true;d.fight(1);
 assert.equal(d.api.TT().later.length,0);d.hero.dead=false;d.fight(1);assert.equal(b2.hp,100000);
 /* the delayed blows of the casts: Double Strike's second blow in fight time */
 const w=box('warrior',{w_double:'doublestrike'}),f=w.foe('f',30,0);w.hero.target=f;
 w.api.cast(0,true);assert.equal(100000-f.hp,210);w.wall+=9000;assert.equal(100000-f.hp,210);
 w.fight(.2);assert.equal(100000-f.hp,210+105,'the second blow, 50%');w.fight(1);assert.equal(100000-f.hp,315);
});

test('what a talent laid on the ground or sent on its way stays in the zone that is left',()=>{
 const c=box('mage',{m_meteor:1});
 c.api.treeZone('blizzard',50,0,120,4,6,{mul:.65,slow:1.2});c.api.treeMeteor(50,0,c.api.ton('meteor'));c.api.TT().hawk.dive={tgt:{},t:0};
 c.api.treeUse('iceblock',180);c.api.TT().shield=40;c.api.TT().shieldT=5;
 c.api.treeLeaveZone();
 c.enemies.length=0;const f=c.foe('a foe of the next zone',50,0);   /* the same spot in another world */
 c.fight(5);
 assert.equal(f.hp,100000,'nothing of the old zone strikes here');
 assert.equal(c.api.TT().zones.length,0);assert.equal(c.api.TT().later.length,0);assert.equal(c.api.TT().hawk.dive,null);
 assert.equal(c.api.treeReady('iceblock'),false,'the hero\'s own state crosses the portal as before: cooldowns');
 assert.match(section('function buildZone(){','const legacyWastelandBiome='),/SpellFx\.clear\(\);[^\n]*\n if\(typeof treeLeaveZone==='function'\)treeLeaveZone\(\);/);
});

test('a slain foe drops its burn, its bomb, its mark, its freeze and its stun: the one that gets back up is clean',()=>{
 const tree={m_searing:3,m_ignite:3,m_bomb:'livingbomb',m_freeze:'deepfreeze'};
 const c=box('mage',tree);
 const respawn=game.slice(game.indexOf('if(en.deadT>MOB_RESPAWN'),game.indexOf('\n',game.indexOf('if(en.deadT>MOB_RESPAWN')));
 vm.runInContext(section('const MOB_RESPAWN=','\n')+'\nglobalThis.deadTick=(en,dt)=>{en.deadT+=dt;'+respawn+'};',c);
 const a=c.foe('Boar',100,0,{hp:1000,max:1000}),b=c.foe('Boar 2',150,0,{hp:1000,max:1000});
 c.hero.target=a;c.api.cast(0,true);c.api.dealSpell(c.bolts[0].tgt,c.bolts[0].spell);
 a.frozenT=1.5;a.stunT=1;a.markT=5;a.markMul=.1;a.weakT=4;
 assert.ok(a.bombT>0&&a.tdots.length&&a.burnT>0,'burning, with a Living Bomb on it');
 c.api.applyDmg(a,a.hp,'');assert.equal(a.dead,true);
 for(let t=0;t<15.7&&a.dead;t+=.05){c.api.treeFoe(a,.05);if(a.dead)c.deadTick(a,.05);}   /* its time on the ground, as update() runs it */
 assert.equal(a.dead,false,'it got back up');assert.equal(a.hp,1000);
 let held=0;for(let t=0;t<4;t+=.05){if(c.api.treeFoe(a,.05))held++;c.api.treeFoe(b,.05);}
 assert.equal(held,0,'not frozen, not stunned');
 assert.equal(a.hp,1000,'no burn left to tick');assert.equal(b.hp,1000,'no bomb went off beside it');
 assert.equal(a.state,'wander');assert.equal(b.state,'wander','and nobody was sent chasing');
 assert.ok(!(a.markT>0)&&!(a.burnT>0)&&!(a.weakT>0)&&!a.markMul);
 /* a living foe still burns and still blows */
 const l=box('mage',tree),x=l.foe('x',100,0,{hp:5000,max:5000});l.hero.target=x;l.api.cast(0,true);l.api.dealSpell(l.bolts[0].tgt,l.bolts[0].spell);
 const hp=x.hp;for(let t=0;t<3.2;t+=.05)l.api.treeFoe(x,.05);assert.ok(x.hp<hp-80,'the burn and the bomb on a foe that lives');
});

test('Piercing Shot reaches the target the cast was accepted at, with every range talent and under Owl Spirit',()=>{
 for(const [tree,rapid] of [[{reach:2,h_long:3,h_hawkeye:2,h_pierce:'piercingshot'},false],[{reach:2,h_long:3,h_hawkeye:2,h_pierce:'piercingshot',h_spirit:'owlspirit'},true],[{h_pierce:'piercingshot'},false]]){
  const c=box('hunter',tree);if(rapid)c.hero.buff.haste={mul:1.6,t:6,dur:6};
  const reach=c.api.heroRange()+55;
  for(const d of [reach-1,Math.min(reach-1,325),200]){
   c.enemies.length=0;const f=c.foe('Stag',d,0),behind=c.foe('Doe',d+15,0);c.hero.target=f;c.hero.spellCd=[0,0,0];c.hero.mana=1000;
   assert.equal(c.api.cast(0,true),true);
   assert.equal(100000-f.hp,240,'the target at '+Math.round(d)+' is struck in full');
   assert.equal(100000-behind.hp,Math.round(240*.7),'and the lance goes on through the one behind it');
  }
  /* the lance is no longer than before when the target is near: a foe past its 320 stays out of it */
  c.enemies.length=0;const near=c.foe('near',100,0),far=c.foe('far',330,0);c.hero.target=near;c.hero.spellCd=[0,0,0];c.api.cast(0,true);
  assert.equal(100000-near.hp,240);assert.equal(far.hp,100000);
 }
});

test('Fortune counts as the tree stands at the kill: the same tree pays the very same coin',()=>{
 const c=box('warrior',{fortune:3});
 const purse=n=>({gold:n,goldF:c.api.tstat('gold')});
 for(const n of [1,7,13,58,333,2599])assert.equal(c.api.treeGold(purse(n)),n,'unchanged tree: unchanged');
 const stamped=purse(109);   /* 100 at the zone's build, with Fortune 3/3 (+9%) */
 c.S.tree={};c.api.bump();assert.equal(c.api.tstat('gold'),0);
 assert.equal(c.api.treeGold(stamped),100,'Reset away, it stops paying at once');
 const bare=purse(100);c.S.tree={fortune:3};c.api.bump();
 assert.equal(c.api.treeGold(bare),109,'learned in the zone, it pays at once');
 assert.equal(c.api.treeGold({gold:0,goldF:0}),0,'a foe with no purse (a raid lord, Thor) still has none');
 assert.equal(c.api.treeGold({gold:1,goldF:0}),1,'never under one coin');
 assert.equal(c.api.treeGold({gold:77}),77,'a foe from before the stamp pays what it carries');
 assert.match(section('function spawnEnemyAt(','\nfunction spawnAdd('),/gold:t\.gold,goldF:tstat\('gold'\),/);
 assert.match(section('function spawnAdd(','\n}'),/gold:mobGold\(z,0\.45\),goldF:tstat\('gold'\),/);
 assert.match(section('function killEnemy(en){','/* XP intake with'),/addGold\(Math\.round\(treeGold\(en\)\*\(1\+scrollPct\('fortune'\)\)\)\)/);
 assert.match(game,/^const mobGold=.*\(1\+tstat\('gold'\)\/100\)\*mul\)\);/m,'the purse is still counted with Fortune at the build, so nothing changes for a tree left alone');
});

test('binding leaves nothing chosen, so the second click of a double click does not spend the twin',()=>{
 assert.match(section('function enchBind(key){','\n}'),/ inscPick='';[^\n]*\n save\(\);renderHero\(\);renderBag\(\);enchRefresh\(\);/);
 assert.match(section('function enchRefresh(){','\nfunction openEnchantHall'),/const sel=inscPick\?kinds\.find/);
 assert.match(section('function enchRefresh(){','\nfunction openEnchantHall'),/id="enchBindBtn" \$\{sel&&weapon\?'':'disabled'\}/,'no choice, no button');
 /* the functions themselves */
 const el=()=>({style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},contains:()=>false},innerHTML:'',textContent:'',querySelectorAll:()=>[]});
 const els={},c={S:{ench:{trained:true,skill:0,insc:[{id:'twin',rar:'common'},{id:'twin',rar:'common'}]},ore:{gem:0},gear:{weapon:{name:'Iron Sword',slot:'weapon'}},bag:[]},
  $:id=>els[id]||(els[id]=el()),document:{querySelectorAll:()=>[]},uiIcon:()=>'',esc:s=>String(s),itemName:it=>it.name,save(){},renderBag(){},renderHero(){},stageMsg(){},log(){},
  sfx:new Proxy({},{get:()=>()=>{}}),totalGold:()=>0,spendGold:()=>false,setTimeout:()=>1,clearTimeout(){},isKnowledgeBook:()=>false,Math};
 vm.createContext(c);
 vm.runInContext(section('const MINE_RANKS=[','const mineSkill=')+section('const ENCH_RANKS=','const CITY_NAMES=')+'\nglobalThis.pick=v=>{if(v!==undefined)inscPick=v;return inscPick;};globalThis.enchBind=enchBind;',c);
 c.pick('twin:common');
 c.enchBind(c.pick());assert.equal(c.S.ench.insc.length,1);assert.equal(c.pick(),'','nothing chosen after the bind');
 c.enchBind(c.pick());assert.equal(c.S.ench.insc.length,1,'click two finds nothing to bind');
 assert.deepEqual(JSON.parse(JSON.stringify(c.S.gear.weapon.insc)),{id:'twin',rar:'common'});
});
