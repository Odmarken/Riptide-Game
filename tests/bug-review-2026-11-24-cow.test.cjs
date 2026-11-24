/* The Cow Run fixes from the 2026-11-24 bug review, pinned so they stay fixed. What can run does run - the real functions cut out
 * of game.js in a vm, as tests/cow-run.test.cjs does; the DOM-bound ones are pinned by their source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\r\n/g,'\n');
const fx=fs.readFileSync(path.join(root,'assets','cow','cow-fx.js'),'utf8');
const CowRun=require('../assets/cow/cow-run.js');
const SkillTree=require('../assets/tree/skill-tree.js');
const cut=(a,b)=>{const i=game.indexOf(a),j=game.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'section '+a);return game.slice(i,j);};
const fn=h=>{const i=game.indexOf(h);assert.ok(i>=0,'function '+h);return game.slice(i,game.indexOf('\n}',i)+2);};
const line=h=>{const i=game.indexOf(h);assert.ok(i>=0,'line '+h);return game.slice(i,game.indexOf('\n',i));};
const CORE=()=>cut('let CR=null,cowRunLast=null;','function cowRunChest(){');
const hero0=()=>({id:'h',cls:'warrior',lvl:60,xp:123,prestige:12,zone:19,maxZone:16,gear:{weapon:{name:'Blade'},armor:{name:'Aegis'},trinket:{name:'Idol'}},
 tree:{vitality:3},talents:{},activeScrolls:[null,null],pet:'cat',pots:{hp:9,mp:9},bag:[]});
/* the run's own neighbours, stubbed the way cow-run.test.cjs stubs them */
const world=(S,more)=>{const c={S,CowRun,document:{body:{classList:{add(){},remove(){}}}},ZONES:[{cow:true}],hero:{},treeVer:0,cowT:0,heroMax:()=>100,manaMax:()=>50,
 classOf:()=>({spells:[{},{},{}]}),rollItem:()=>({name:'Epic',rar:'epic'}),log(){},stageMsg(){},sfx:{loot(){},level(){},warn(){}},renderHUD(){},cowPickClose(){},
 cowResultsShow(){},cowRunChest(){},cowKitClear(){},Object,Math,Date,console,...more};return vm.createContext(c);};

test('The Ring forged while a run is on binds to the hero\'s own gear in the stash, and is there when the run ends',()=>{
 const S=hero0();Object.assign(S,{smithLvl:10,smithJob:{kind:'ring',endT:Date.now()-1},ringForged:false});
 const idol=S.gear.trinket;
 const c=world(S,{rollTheRing:()=>({id:'thering',legend:'thering',slot:'trinket',rar:'legendary',name:'The Ring'}),uiIcon:()=>'',publishLB(){},syncFelGlaives:x=>x,syncFrostseeker:x=>x,
  inscClean:()=>false,enchSetOn(){},LEGEND_MAX_UP:6,smithCompleted(){},save(){},$:()=>null,smithRefresh(){}});
 vm.runInContext(CORE()+'\n'+fn('function smithTick(){')+';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);this.tick=()=>smithTick();',c);
 c.go();c.tick();
 assert.equal(S.gear.trinket,null,'not on the run\'s bare hands');
 assert.equal(S.cowRunStash.gear.trinket.legend,'thering');assert.ok(S.ringForged);
 assert.ok(S.bag.includes(idol),'the old trinket steps aside into the bag, as it does outside a run');
 c.cowT=10;c.end('died');
 assert.equal(S.gear.trinket.legend,'thering','worn when the run is over');
});

test('migrate clears what an earlier run could leave: stray card sums, the run\'s dummy legendary, and a Ring lost with the run\'s gear',()=>{
 const block=cut(' /* 🐄 what a Cow Run could leave on a hero until 2026-11-24',' if(s.lastZone===undefined)');
 const fix=s=>{vm.runInContext('(function(s){'+block+'})',vm.createContext({Object,Array}))(s);return s;};
 const ring=it=>!!it&&it.legend==='thering';
 const a=fix({cowRunStat:{cowDmg:24},gear:{weapon:{name:'Frostseeker',legend:'frostseeker',cowRun:true},armor:{name:'Aegis'},trinket:null},bag:[{name:'Fel Glaives',cowRun:true},{name:'Keep me'}],ringForged:false});
 assert.ok(!('cowRunStat' in a));assert.equal(a.gear.weapon,null,'the hand is left empty: no legendary is minted for the weapon that was lost');
 assert.equal(a.gear.armor.name,'Aegis');assert.deepEqual(a.bag.map(i=>i.name),['Keep me']);
 /* the Ring cannot be sold, scrapped or fed to the forge (isLegendary guards all three), so forged + none anywhere + none in the fire = lost */
 const b=fix({gear:{weapon:null,armor:null,trinket:{name:'Idol'}},bag:[],ringForged:true,smithJob:null});
 assert.equal(b.bag.filter(ring).length,1);assert.equal(b.bag[0].up,0);assert.equal(b.bag[0].slot,'trinket');
 assert.equal(fix(b).bag.filter(ring).length,1,'once: the second load finds it');
 assert.equal(fix({gear:{weapon:null,armor:null,trinket:{legend:'thering'}},bag:[],ringForged:true}).bag.length,0,'worn');
 assert.equal(fix({gear:{weapon:null,armor:null,trinket:null},bag:[{legend:'thering'}],ringForged:true}).bag.length,1,'in the bag');
 assert.equal(fix({gear:{weapon:null,armor:null,trinket:null},bag:[],ringForged:true,smithJob:{kind:'ring',endT:1}}).bag.length,0,'still in the fire');
 assert.equal(fix({gear:{weapon:null,armor:null,trinket:null},bag:[],ringForged:false}).bag.length,0,'never forged');
 assert.match(game,/const bagSellable=it=>!!it&&!isLegendary\(it\)/,'the rule the repair leans on');
});

test('a run whose hero is no longer the one playing takes no card and writes no sums onto the next hero',()=>{
 const A=hero0(),B=hero0();B.id='b';const realBlade=B.gear.weapon;
 let closed=0;
 const c=world(A,{cowPickClose:()=>{closed++;},cowSwapShow(){},cowKitRender(){},healHero(){},cowPickOpenNext(){},SpellFx:{cast:()=>true},heroFollow:()=>null});
 vm.runInContext(CORE()+'\n'+fn('function cowPickKey(i){')+';this.go=()=>cowRunStart();this.key=i=>cowPickKey(i);this.stats=()=>cowRunStats();this.setS=s=>{S=s;};this.getCR=()=>CR;',c);
 c.go();const CR=c.getCR();
 CR.cards=[CowRun.rollCards(CR,()=>0)[0],{kind:'passive',id:'might',rar:'epic',v:0.24,lvl:1,n:'Might'}];
 assert.equal(CR.cards[0].kind,'legend');
 c.setS(B);closed=0;   /* signed out and back in, kicked, deleted under the run: another S, the run still there */
 c.key(1);c.key(0);c.stats();
 assert.ok(!('cowRunStat' in B),'no card sums on the hero who is not in the run');
 assert.equal(B.gear.weapon,realBlade,'and his weapon is his own');
 assert.ok(closed>=2,'the stale cards are put away, so the world behind them goes on');
 assert.equal(CR.cards.length,2,'nothing was taken');
 assert.equal(Object.keys(CR.p).length,0);
 c.setS(A);c.key(1);assert.equal(Math.round(A.cowRunStat.cowDmg),24,'the run\'s own hero still takes his card');
 assert.ok(game.includes('  if(!CR||CR.owner!==S||!CR.cards)return;\n  const pr=CowRun.rerollPrice('),'nor a reroll');
});

test('Run again is the map card\'s door: a hero in play, free to travel, Prestige 5, level 60 - and only the hero whose run it was',()=>{
 const said=[];
 const c=vm.createContext({gameOn:true,S:{prestige:12,lvl:60},hcNoFlee:()=>false,sceneHoldsTravel:()=>false,abroadNoTravel:()=>false,stageMsg:t=>said.push(t),sfx:{warn(){}}});
 vm.runInContext(fn('function cowRunGate(){')+';this.gate=()=>cowRunGate();',c);
 assert.equal(c.gate(),true);
 c.gameOn=false;assert.equal(c.gate(),false,'no hero in play');c.gameOn=true;
 c.S.prestige=4;assert.equal(c.gate(),false);c.S.prestige=5;
 c.S.lvl=59;assert.equal(c.gate(),false);c.S.lvl=60;
 assert.deepEqual(said,['🐄 The cows demand Prestige 5','🐄 The cows demand level 60'],'the map card\'s own lines');
 for(const k of ['hcNoFlee','sceneHoldsTravel','abroadNoTravel']){c[k]=()=>true;assert.equal(c.gate(),false,k);c[k]=()=>false;}
 c.S=null;assert.equal(c.gate(),false);
 assert.ok(game.includes(" $('cowResAgain').onclick=()=>{cowPickClose();if(S!==run.owner||!cowRunGate())return;const i=cowZoneIdx();if(i>=0)goToZone(i);};"));
});

test('the Skill Tree in a run: the hero\'s own tree is shown, nothing is learned or reset, and no points are offered',()=>{
 const S=hero0();S.prestige=40;const own=S.tree,said=[];
 const c=world(S,{SkillTree,inBossFight:()=>false,stageMsg:t=>said.push(t),treeAfter(){},treeTimersReset(){},save(){}});
 vm.runInContext(CORE()+'\n'+[line('const treeLocked='),line('const treeOwn='),line('const treeBarred='),fn('function treeLearn(id,opt){'),fn('function treeReset(){')].join('\n')+
  ';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);this.learn=(a,b)=>treeLearn(a,b);this.reset=()=>treeReset();this.barred=()=>treeBarred();this.own=()=>treeOwn().tree;',c);
 assert.equal(c.barred(),'','free outside a run');assert.equal(c.own(),own);
 c.go();said.length=0;   /* the run's own greeting */
 assert.equal(S.tree,null);assert.equal(c.own(),own,'the window and the Hero card read the stash');
 assert.match(c.barred(),/Not used in the Cow Level/);
 for(const n of SkillTree.nodes('warrior'))c.learn(n.id,SkillTree.isChoice(n)?n.opts[0].id:undefined);
 c.reset();
 assert.equal(S.tree,null,'no tree grows inside the run');assert.deepEqual(own,{vitality:3},'and the hero\'s own is not reset');
 assert.ok(said.length&&said.every(t=>/Not used in the Cow Level/.test(t)));
 c.end('quit');assert.equal(S.tree,own);
 c.learn('wisdom');assert.equal(S.tree.wisdom,1,'learning works again after the run');
 assert.ok(game.includes('return {state:treeOwn().tree||(treeOwn().tree={}),cls:S.cls,className:classOf().name.toUpperCase(),prestige:S.prestige||0,locked:treeBarred(),touch:IS_TOUCH,'));
 assert.ok(game.includes('spent=SkillTree.spent(treeOwn().tree),left=pts-spent;'));
 assert.ok(game.includes("const treeBarred=()=>S&&S.cowRunStash?'🐄 Not used in the Cow Level - you fight with what the run gives you':treeLocked();"),'the Hero page\'s own line, no new text');
 assert.ok(game.includes('<div class="cowlock-note">🐄 Not used in the Cow Level - you fight with what the run gives you</div>'));
});

test('no prestige out of a run (its level 60 is not the hero\'s), nor from abroad',()=>{
 const mk=()=>{const S=hero0();Object.assign(S,{bossDead:{2:true},cleared:{},zoneLvlGain:{},finished:true,quest:0,qProg:0});return S;};
 const built=[];
 const ctx=S=>{const c=world(S,{cowPickOpen:()=>false,cowPickOpenNext(){},cowRunBar(){},SpellFx:{cast:()=>true},heroFollow:()=>null,renderHero(){},
  hcNoFlee:()=>false,sceneHoldsTravel:()=>false,abroadNoTravel:()=>false,PRESTIGE_CAP:50,MAXLVL:60,allBossesDead:()=>true,goldCap:()=>1,applyZoneUI(){},save(){},publishLB(){},openTab(){},isDesktopLayout:()=>true,
  buildZone:()=>built.push(1)});
  vm.runInContext(CORE()+'\n'+fn('function cowRunXp(v){')+'\n'+fn('function doPrestige(){')+';this.go=()=>cowRunStart();this.xp=v=>cowRunXp(v);this.pre=()=>doPrestige();',c);return c;};
 let need=0;for(let l=1;l<60;l++)need+=CowRun.xpNeed(l);
 const S=mk(),c=ctx(S);c.go();c.xp(need);
 assert.equal(S.lvl,60,'the run reached its own level 60');
 c.pre();
 assert.equal(S.prestige,12);assert.ok(S.cowRunStash,'still in the run');assert.deepEqual(S.bossDead,{2:true});assert.equal(built.length,0);
 const T=mk(),d=ctx(T);d.abroadNoTravel=()=>true;d.pre();
 assert.equal(T.prestige,12,'abroad: shut as Home and the map are');assert.equal(built.length,0);
 d.abroadNoTravel=()=>false;d.pre();assert.equal(T.prestige,13,'at home, level 60, every boss down: as before');assert.equal(T.lvl,1);
 assert.ok(game.includes(' }else if(S.lvl>=MAXLVL&&!S.cowRunStash){'),'and the Hero panel shows no prestige card in the herd');
});

test('walking out alive keeps the share of health and mana, not the run\'s few hundred points',()=>{
 for(const share of [1,0.5,0.1]){
  const S=hero0();
  const c=world(S,{heroMax:()=>S.cowRunStash?300:20000,manaMax:()=>S.cowRunStash?120:400});
  vm.runInContext(CORE()+';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);',c);
  c.go();c.hero.hp=300*share;c.hero.mana=120*share;c.cowT=50;c.end('left');
  assert.equal(c.hero.hp,20000*share);assert.equal(c.hero.mana,400*share);
 }
 const S=hero0(),c=world(S,{heroMax:()=>S.cowRunStash?300:20000});
 vm.runInContext(CORE()+';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);',c);
 c.go();c.hero.hp=0;c.hero.dead=true;c.end('died');assert.equal(c.hero.hp,0,'the dead are not healed');
 assert.match(game,/function buildZone\(\)\{\n if\(S&&S\.cowRunStash\)cowRunEnd\('left'\);/,'before buildZone reads the old hero\'s health to carry it');
});

test('the herd pays by its own rung wherever the hero is headed, and puts S.zone back',()=>{
 const S=hero0(),at=[];
 const c=world(S,{ZONES:[{},{},{cow:true},{tavern:true}],rollItem:()=>{at.push(S.zone);return {name:'Epic',rar:'epic'};}});
 vm.runInContext(CORE()+';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);',c);
 c.go();S.zone=3;   /* Home names Moonshine before buildZone ends the run */
 c.cowT=135;c.end('left');
 assert.deepEqual(at,[2,2,2],'three epics, all rolled in the Cow Level');assert.equal(S.zone,3);
 const T=hero0(),d=world(T,{ZONES:[{},{},{cow:true}],rollItem:()=>{throw new Error('roll');}});
 vm.runInContext(CORE()+';this.go=()=>cowRunStart();this.end=r=>cowRunEnd(r);',d);
 d.go();T.zone=1;d.cowT=50;assert.throws(()=>d.end('left'));assert.equal(T.zone,1,'even when a roll throws');
});

test('Fel Glaives 3 and 4 fly their own places: hits, drawing and glow share the axes\' spacing',()=>{
 assert.ok(game.includes("const a=CR.glA+i*6.283/st.n;cowRunTouch('fg'+i,"));
 assert.ok(game.includes('const a=CR.glA+i*6.283/st.n,x=hx+Math.cos(a)*st.rad,y=hy+Math.sin(a)*st.rad*0.8;'));
 assert.ok(fx.includes('const a=s.glA+i*TAU/st.n;H.crescent('));
 assert.ok(!/glA\+i\*Math\.PI/.test(game+fx));
 for(const L of [8,11]){const st=CowRun.weaponStats('felglaives',L),seen=new Set();
  for(let i=0;i<st.n;i++){const a=1+i*6.283/st.n;seen.add(Math.round(Math.cos(a)*st.rad)+','+Math.round(Math.sin(a)*st.rad*0.8));}
  assert.equal(seen.size,st.n);}
});

test('small ones: keys 5 and 6 on the swap screen, a swapped-out totem\'s posts, potions from the Trader, the save on death, hitT',()=>{
 assert.ok(game.includes(" if(gameOn&&!gamePaused&&k==='5'){if(typeof cowPickOpen==='function'&&cowPickOpen())cowPickKey(4);else usePot('mp',true);}"));
 assert.ok(game.includes(" if(gameOn&&!gamePaused&&k==='6'&&typeof cowPickOpen==='function'&&cowPickOpen())cowPickKey(5);"));
 assert.equal(CowRun.MAX_PASSIVES,6,'six tiles to name');
 assert.ok(game.includes(' }else if(CR.totems.length)CR.totems.length=0;'),'no War Totem, no posts');
 const pot=cut("document.querySelectorAll('[data-pot]').forEach(b=>b.onclick=()=>{",'S.pots[k]+=n;');
 assert.match(pot,/if\(cowLocked\(\)\)\{stageMsg\('🐄 Not used in the Cow Level - you fight with what the run gives you',1800\);sfx\.warn\(\);return;\}/);
 assert.ok(pot.indexOf('cowLocked()')<pot.indexOf('spendGold('),'refused before the gold is taken');
 assert.match(fn('function heroDies(){'),/cowRunEnd\('died'\);\n  save\(\);/);
 assert.ok(game.includes('hitT:new WeakMap()'),'a cow that is gone is let go');
 const c=world(hero0());vm.runInContext(CORE()+';this.go=()=>cowRunStart();this.getCR=()=>CR;',c);c.go();
 assert.equal(Object.prototype.toString.call(c.getCR().hitT),'[object WeakMap]');
});
