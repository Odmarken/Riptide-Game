/* Run with: node --test tests/skill-tree.test.cjs
 * 🌳 The Skill Tree (asked for 2026-10-10: a card above Outfits opening a WoW-style tree; one point per prestige to P40; a unique tree
 * per class with shared stat talents on top; ranks such as 1/3 that must be full before the next; a conservative and an offensive
 * side; choices of two; a big capstone at the end of each side; "man ska inte kunna välja allt"; and the balance rules agreed the
 * same day: damage bonuses add, a second hit is 50-60%, cooldown cuts stop at -30%, talent damage reduction at -25%, block and
 * dodge at 15%, hardcore on the same cooldowns as normal).
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const T=require('../assets/tree/skill-tree.js');
const game=read('game.js'),html=read('index.html');
const section=(a,b)=>{const i=game.indexOf(a);assert.ok(i>=0,a);const j=game.indexOf(b,i);assert.ok(j>i,b);return game.slice(i,j);};

test('every class has its own tree under the shared top: two sides of twelve, four choices a side, a capstone each, about 70 ranks for 40 points',()=>{
 assert.deepEqual(T.CLASS_IDS,['warrior','mage','hunter','priest']);
 for(const cls of T.CLASS_IDS){
  const ns=T.nodes(cls),pos=new Set(),ids=new Set();
  assert.equal(ns.filter(n=>n.row<2).length,6,cls+': the shared top');
  for(const n of ns){
   const k=n.row+','+n.col;assert.ok(!pos.has(k),cls+' two talents at '+k);pos.add(k);
   assert.ok(!ids.has(n.id));ids.add(n.id);
   for(const r of [].concat(n.req||[])){const p=ns.find(m=>m.id===r);assert.ok(p,n.id+' stands on '+r);assert.ok(p.row<n.row,n.id+': what it stands on is above it');}
   if(T.isChoice(n))assert.equal(n.opts.length,2,n.id+': a choice of two');
   assert.ok(n.d||n.opts,n.id+' says what it does');
  }
  for(const side of ['def','off']){
   const s=ns.filter(n=>T.sideOf(n)===side);
   assert.equal(s.filter(n=>!T.isCap(n)).length,12,cls+' '+side+': three columns of four');
   assert.equal(s.filter(T.isChoice).length,4,cls+' '+side+': four choices');
   assert.equal(s.filter(T.isCap).length,1,cls+' '+side+': one capstone');
  }
  const ranks=ns.reduce((t,n)=>t+T.maxOf(n),0);
  assert.ok(ranks>=66&&ranks<=72,cls+' '+ranks+' ranks');
  const shared=ns.filter(n=>n.row<2).reduce((t,n)=>t+T.maxOf(n),0),side=ns.filter(n=>T.sideOf(n)==='off').reduce((t,n)=>t+T.maxOf(n),0);
  assert.ok(shared+side>T.CAP,cls+': the whole top and a whole side are more than 40 points');
  for(const n of ns.filter(n=>n.row<2))assert.ok(n.fx&&!n.opts,'the shared top is stats');
  assert.equal(JSON.stringify(ns.filter(n=>n.row<2).map(n=>n.id)),JSON.stringify(['vitality','wisdom','fortune','toughness','focus','reach']));
 }
});

test('every talent, every option and every side has its painted icon',()=>{
 const need=new Set(['tree','guardian','berserker','frostwarden','pyromancer','warden','marksman','sanctuary','zealot']);
 for(const cls of T.CLASS_IDS)for(const n of T.nodes(cls)){if(n.opts)n.opts.forEach(o=>need.add(o.id));else need.add(n.id);}
 const missing=[...need].filter(id=>!fs.existsSync(path.join(root,'assets/tree/icons',id+'.jpg')));
 assert.deepEqual(missing,[],'icons missing');
 for(const c of T.CLASS_IDS)assert.ok(fs.existsSync(path.join(root,'assets/tree/backdrops',c+'.jpg')),c+' backdrop');
 for(const f of ['hawk','lion','wings','iceblock'])assert.ok(fs.existsSync(path.join(root,'assets/tree/fx',f+'.png')),f);
});

test('points: one per prestige, P1 to P40',()=>{
 assert.equal(T.points(0),0);assert.equal(T.points(1),1);assert.equal(T.points(12),12);assert.equal(T.points(40),40);assert.equal(T.points(50),40);
 assert.equal(T.points(undefined),0);assert.equal(T.points(-3),0);assert.equal(T.points(7.9),7);
});

test('the rules: a rank at a time, the one above full first, the gates, a choice is for good, one capstone, and no more than the points',()=>{
 const st={},c='mage';
 assert.equal(T.check(st,c,'vitality',undefined,0).ok,false,'no points at P0');
 assert.match(T.check(st,c,'vitality',undefined,0).why,/every prestige gives one/);
 assert.equal(T.learn(st,c,'vitality',undefined,5).ok,true);assert.equal(T.rank(st,'vitality'),1);
 assert.equal(T.check(st,c,'toughness',undefined,5).ok,false,'1/3 is not enough');
 assert.match(T.check(st,c,'toughness',undefined,5).why,/Fill the talent above/);
 T.learn(st,c,'vitality',undefined,5);T.learn(st,c,'vitality',undefined,5);
 assert.equal(T.check(st,c,'vitality',undefined,5).why,'Already learned','3/3');
 assert.equal(T.learn(st,c,'toughness',undefined,5).ok,true,'3/3 opens the next');
 assert.match(T.check(st,c,'m_searing',undefined,40).why,/Needs 8 points spent above it/,'the 8 gate');
 for(const id of ['toughness','toughness','wisdom','wisdom'])T.learn(st,c,id,undefined,40);
 assert.equal(T.spent(st),8);
 assert.equal(T.learn(st,c,'m_searing',undefined,40).ok,true,'eight above opens the sides');
 assert.equal(T.learn(st,c,'m_barrier',undefined,40).ok,true,'both sides');
 /* a choice: one of its two, never changed but by Reset */
 T.learn(st,c,'m_searing',undefined,40);T.learn(st,c,'m_searing',undefined,40);T.learn(st,c,'m_kindling',undefined,40);T.learn(st,c,'m_kindling',undefined,40);
 assert.match(T.check(st,c,'m_twin','twinflames',40).why,/20 points/,'the 20 gate');
 for(const id of ['fortune','fortune','fortune','wisdom','focus','focus','focus','reach','reach'])assert.equal(T.learn(st,c,id,undefined,40).ok,true,id);   /* Focus needs Wisdom full */
 assert.equal(T.check(st,c,'m_twin','nonsense',40).ok,false);
 assert.equal(T.learn(st,c,'m_twin','pyroblast',40).ok,true);assert.equal(T.pick(st,'m_twin'),'pyroblast');assert.equal(T.rank(st,'m_twin'),1);
 assert.match(T.check(st,c,'m_twin','twinflames',40).why,/Reset/);
 /* the capstones: 30 above, the one above full, and only one of the two */
 T.learn(st,c,'m_ignite',undefined,40);T.learn(st,c,'m_ignite',undefined,40);T.learn(st,c,'m_ignite',undefined,40);
 assert.ok(T.spent(st)<30);
 assert.match(T.check(st,c,'m_meteor',undefined,40).why,/30 points/);
 for(const id of ['m_barrier','m_barrier','m_critmass','m_critmass','m_critmass','m_surge'])T.learn(st,c,id,undefined,40);
 assert.equal(T.learn(st,c,'m_meteor',undefined,40).ok,true,'Meteor');
 const st2={...st};delete st2.m_meteor;st2.m_iceblock=1;
 assert.equal(T.check(st,c,'m_iceblock',undefined,40).ok,false);
 assert.match(T.check(st,c,'m_iceblock',undefined,40).why,/Only one capstone|Fill one talent above/);
 /* out of points */
 const tight={vitality:1};assert.match(T.check(tight,c,'vitality',undefined,1).why,/No points left/);
 const all={};for(let i=0;i<40;i++)all['x'+i]=0;assert.equal(T.points(40),40);
 T.reset(st);assert.equal(T.spent(st),0,'Reset gives every point back');
});

test('a saved tree is made sound: unknown talents go, ranks stay in bounds, what lost its footing and what is over the points comes back',()=>{
 assert.deepEqual(T.normalize(null,'mage'),{});assert.deepEqual(T.normalize([],'mage'),{});assert.deepEqual(T.normalize({vitality:2},'nobody'),{});
 assert.deepEqual(T.normalize({vitality:9,m_twin:'bogus',w_block:2,zz:3},'mage',40),{vitality:3},'too high, a wrong option, another class\'s talent, nonsense');
 assert.deepEqual(T.normalize({vitality:1,toughness:2},'mage',40),{vitality:1},'what stands on a talent that is not full comes back');
 assert.deepEqual(T.normalize({m_searing:3},'mage',40),{},'a side talent without the 8 above');
 const big={vitality:3,toughness:3,wisdom:3,focus:3,fortune:3,reach:2,m_searing:3,m_kindling:2,m_twin:'twinflames',m_ignite:3,m_critmass:3,m_combust:'combustion',m_burning:2};
 const n=T.normalize(big,'mage',40);assert.equal(T.spent(n),T.spent(big),'a sound tree stays as it is');
 const cut=T.normalize(big,'mage',20);assert.equal(T.spent(cut),20,'over the points: the bottom rows first');
 assert.equal(cut.vitality,3);assert.equal(cut.m_burning,undefined);
 assert.deepEqual(T.normalize({...big,m_meteor:1,m_iceblock:1},'mage',40).m_iceblock,undefined,'two capstones: the second goes');
});

test('what a tree adds up to: stats, per spell, and the choices and capstones with their numbers',()=>{
 const st={vitality:3,wisdom:2,toughness:1,m_searing:2,m_surge:3,m_twin:'twinflames'};
 const e=T.effects(st,'mage');
 assert.equal(e.stat.hp,9);assert.equal(e.stat.mana,10);assert.equal(e.stat.regen,10);assert.equal(e.stat.dr,2);
 assert.equal(e.sp[0].dmg,12);assert.equal(e.sp[0].size,20);assert.equal(e.sp[2].hits,3);
 assert.deepEqual(e.on.twinflames,{second:.5});assert.equal(e.on.pyroblast,undefined);
 assert.deepEqual(T.effects(null,'mage'),{stat:{},sp:[{},{},{}],on:{}});
 assert.equal(T.text(T.node('mage','vitality'),2),'+6% max health');
 assert.equal(T.text(T.node('mage','m_core'),3),'Frost Nova reaches 24% wider and slows 1.5s longer');
 assert.equal(T.text(T.node('mage','wisdom'),1),'+5% mana and mana regeneration');
 assert.equal(T.text(T.node('priest','p_blessed'),2),'Smite and Holy Nova heal 30% more');
 assert.equal(T.text(T.node('mage','m_meteor'),1),T.node('mage','m_meteor').d);
});

test('the balance rules are in the numbers: a second hit 50-60%, capped cuts, the cheat-deaths on three minutes (hardcore too)',()=>{
 assert.equal(T.CD_CUT_MAX,.3);assert.equal(T.DR_MAX,.25);assert.equal(T.AVOID_MAX,.15);
 const opt=(cls,id)=>T.nodes(cls).flatMap(n=>n.opts||[]).find(o=>o.id===id);
 assert.equal(opt('warrior','doublestrike').p.second,.5);assert.equal(opt('mage','twinflames').p.second,.5);assert.equal(opt('hunter','doubleshot').p.second,.5);
 assert.equal(opt('priest','divinestorm').p.second,.5);
 assert.equal(T.node('warrior','w_unyielding').p.cd,180);assert.equal(T.node('mage','m_iceblock').p.cd,180);assert.equal(opt('priest','guardianspirit').p.cd,180);
 assert.ok(!game.slice(game.indexOf('function treeCheatDeath'),game.indexOf('function treeIceBurst')).includes('hardcore'),'no hardcore cooldowns of their own');
 for(const cls of T.CLASS_IDS)for(const n of T.nodes(cls)){if(n.sp)for(const i in n.sp)if(n.sp[i].dmg)assert.ok(n.sp[i].dmg<=25,n.id+' one rank of damage is small');if(n.fx&&n.fx.crit)assert.equal(n.fx.crit,1.5);}
});

/* the game's side, run in a box with a pretend hero */
function box(cls,state){
 const SkillTree=T,c={SkillTree,S:{cls,tree:state,prestige:40},Math,performance:{now:()=>1000},hero:{hp:500,mana:100,buff:{},hotT:0,fx:1,x:0,y:0,spellCd:[0,0,0]},
  classOf:()=>({id:cls,ranged:cls==='mage'||cls==='hunter',range:cls==='mage'?175:40}),heroMax:()=>1000,manaMax:()=>200,floatAt(){},
  SpellFx:{cast(){},hit(){}},mpAct(){},heroGroundY:()=>12,healHero(n){c.healed=(c.healed||0)+n;}};
 vm.createContext(c);
 vm.runInContext(section('let treeVer=0','const heroMax=')+section('/* ---- 🌳 THE TREE IN THE FIGHT ----','/* the reach of the hero')+
  section('/* the reach of the hero','/* what the talents add when a spell lands')+section('/* --- the damage the hero takes','function treeAfterHurt(')+
  '\nglobalThis.api={treeSpell,heroRange,treeHurt,treeDr,treeBuffDr,TT,tstat,ton};',c);
 return c;
}
test('a spell as its talents make it: damage adds up, the spell\'s own cut and Focus stop at -30%, Pyroblast and the shared Reach',()=>{
 const st={vitality:3,toughness:3,wisdom:3,focus:3,fortune:3,reach:2,m_searing:3,m_kindling:2,m_twin:'pyroblast'};
 const {api}=box('mage',st);
 const fb={n:'Fireball',cost:14,cd:4,t:'st',mul:2.6,vfx:'fire',fx:'fireball'};
 const s=api.treeSpell(fb,0);
 assert.ok(Math.abs(s.mul-2.6*1.18*1.7)<1e-9,'+18% then Pyroblast\'s 170%');
 assert.ok(Math.abs(s.cd-(4*(1-(.4/4+.09))+1))<1e-9,'the cut and Focus together, then Pyroblast\'s second');
 assert.ok(s.size>1.29*1.69,'and it looks bigger');
 assert.ok(Math.abs(api.heroRange()-175*1.16)<1e-9,'Reach 2/2');
 const big=box('mage',{focus:3,m_core:3,m_snap:2,vitality:3,toughness:3,wisdom:3}).api.treeSpell({n:'Frost Nova',cd:9,t:'aoe',mul:1.3,rad:115,slow:3},1);
 assert.ok(Math.abs(big.cd-9*(1-Math.min(.3,2/9+.09)))<1e-9,'never past -30%');
 const melee=box('warrior',{fortune:3,reach:2}).api.treeSpell({n:'Whirlwind',cd:8,t:'aoe',mul:1.5,rad:100},1);
 assert.ok(Math.abs(melee.rad-116)<1e-9,'a close fighter\'s Reach widens his area spells');
});
test('the damage taken: block and dodge stop at 15%, always-on reduction at 25%, the short walls on top at 40%, a shield soaks first',()=>{
 const c=box('warrior',{w_block:3,toughness:3,vitality:3,w_thorns:3,w_bulwark:2,w_spin:'spinguard',w_stalwart:3,fortune:3,reach:2});
 const {api}=c;
 assert.ok(Math.abs(api.treeDr(null)-.12)<1e-9,'Toughness 6% + Stalwart 6%');
 c.Math=Object.assign(Object.create(Math),{random:()=>.99});
 vm.runInContext('Math=globalThis.Math',c);
 assert.equal(api.treeHurt(100,null),88,'no block on this roll: 12% off');
 api.TT().spinT=4;assert.equal(api.treeHurt(100,null),Math.round(100*.88*.85),'Spinning Guard on top');
 api.TT().shield=50;api.TT().shieldT=5;assert.equal(api.treeHurt(100,null),Math.round(100*.88*.85)-50,'the shield soaks first');
 c.Math=Object.assign(Object.create(Math),{random:()=>.01});vm.runInContext('Math=globalThis.Math',c);
 assert.equal(api.treeHurt(100,null),0,'a block');
 const many=box('warrior',{toughness:3,vitality:3,w_ironwill:0});
 many.api.TT();
 assert.ok(many.api.treeDr({slowT:1,weakT:5,weak:.5})<=.25,'never past -25%');
});

test('the game uses the tree everywhere it should',()=>{
 const at=s=>{const i=html.indexOf(s);assert.ok(i>0,s);return i;};
 assert.ok(at('id="tidesTitle"')<at('<div id="tideStorageEntry"></div>')&&at('<div id="tideStorageEntry"></div>')<at('id="ledgerGroupTitle"')&&at('id="ledgerGroupTitle"')<at('<div id="ledgerEntry"></div>')&&at('<div id="ledgerEntry"></div>')<at('id="wardrobeTitle"')&&at('id="wardrobeTitle"')<at('<div id="outfitEntry"></div>')&&at('<div id="outfitEntry"></div>')<at('id="skillsTitle"')&&at('id="skillsTitle"')<at('<div id="treeEntry"></div>'),'Tides, Ledger, Wardrobe, Skills - each card under its heading');
 assert.ok(html.includes('id="treeFx" class="craft-modal"'),'its window');
 const sTree=html.indexOf('<script src="assets/tree/skill-tree.js'),sUi=html.indexOf('<script src="assets/tree/tree-ui.js'),sFx=html.indexOf('<script src="assets/fx/tree-fx.js'),sGame=html.indexOf('<script src="game.js');
 assert.ok(sTree>0&&sUi>sTree&&sFx>0&&sGame>Math.max(sUi,sFx),'loaded before the game');
 assert.ok(html.includes('<link rel="stylesheet" href="assets/tree/tree.css'),'its styles');
 assert.ok(game.includes("s.tree=SkillTree.normalize(s.tree,s.cls,SkillTree.points(s.prestige));"),'every save is made sound on load');
 assert.ok(game.includes('TideUI.entry();ledgerEntry();treeEntry();outfitEntry();heroGroups();'),'a heading only over a card that is there');
 assert.ok(/const PAD_PANELS=\[[^\]]*'treeFx'/.test(game),'the pad walks it');assert.ok(game.includes("const PAD_BACK={treeFx:'treeClose',"),'and B closes it');
 assert.ok(game.includes("if(gameOn&&S&&kl==='escape'&&treeUI.isOpen()"),'Esc closes it');
 assert.ok(game.includes("const treeLocked=()=>inBossFight()?SkillTree.RESET_LOCK:'';"),'nothing learned or reset in a boss fight');
 for(const s of ["*(1+tstat('hp')/100)","*(1+tstat('mana')/100)","+tstat('crit')","*(1+tstat('gold')/100)","*(1+tstat('regen')/100)","*(1+tstat('move')/100)","*treeHaste()"])assert.ok(game.includes(s),s);
 const cast=section('function cast(i,manual){','function usePot(');
 assert.ok(cast.includes('sp=treeSpell(c.spells[i],i)')&&cast.includes('heroRange()+55'));
 for(const s of ['treeCastSt(sp,tgt,c)','treeCastMulti(sp,tgt,list,c)','treeCastAoe(sp,list)','treeCastBuff(sp)','treeTwinBolt(sp,tgt,c,bc)'])assert.ok(cast.includes(s),s);
 const hurt=section('function hurtHero(','\n}');
 assert.ok(hurt.includes('dmg=treeHurt(dmg,foe);if(!(dmg>0))return 0;')&&hurt.includes('if(hero.hp<=0&&!treeCheatDeath())heroDies();')&&hurt.includes('treeAfterHurt(dmg,foe);'));
 assert.ok(section('function dealSpell(en,sp){','function heroGroundY(').includes('treeSpellHit(en,sp,Math.round(dmg),crit,ex,ey);'));
 assert.ok(section('function applyDmg(en,dmg,label,crit){','function dealSpell(').includes('dmg=Math.round(dmg*treeFoeMul(en));'));
 assert.ok(game.includes('if(treeFoe(en,dt))continue;'),'the foes the tree holds');
 assert.ok(game.includes('treeTick(dt);'),'the hero\'s side every frame');
 assert.equal((game.match(/hurtHero\(en\.atk\*\(0\.85\+Math\.random\(\)\*0\.3\)[^;]*,undefined,en\)/g)||[]).length,3,'every foe\'s blow says who struck');
 assert.ok(game.includes("const spellManaCost=sp=>treeFreeCast()?0:Math.ceil(sp.cost*2);"),'Archangel');
 assert.ok(game.includes('treeAuraState({gy,'),'the auras');
 assert.ok(game.includes('for(const k of TREE_AURAS){a[k]=s(k);if(a[k])any=true;}'),'a peer\'s too');
});
