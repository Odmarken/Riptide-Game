/* 🐄 the Cow Run (2026-10-15): the numbers and cards in assets/cow/cow-run.js, and how game.js strips the hero and gives him back */
const test=require('node:test');
const assert=require('node:assert');
const fs=require('fs');
const path=require('path');
const CowRun=require('../assets/cow/cow-run.js');
const game=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const seq=vals=>{let i=0;return ()=>vals[i++%vals.length];};

test('a run starts at level 1 and climbs: 3 cows to level 2, a steeper climb after',()=>{
 const r=CowRun.newRun();
 assert.equal(r.lvl,1);assert.equal(CowRun.xpNeed(1),3);
 assert.equal(CowRun.gainXp(r,2),0);assert.equal(CowRun.gainXp(r,1),1);assert.equal(r.lvl,2);
 for(let l=2;l<30;l++)assert.ok(CowRun.xpNeed(l)>CowRun.xpNeed(l-1));
 r.m.xp=0.5;r.xp=0;CowRun.gainXp(r,4);assert.equal(r.lvl,3,'Wisdom: +50% xp on 4 = 6 = level 2 to 3');
});

test('blue chests cost 20 gold, then more and more',()=>{
 assert.equal(CowRun.chestPrice(0),20);
 for(let n=1;n<12;n++)assert.ok(CowRun.chestPrice(n)>CowRun.chestPrice(n-1));
});

test('three cards, never the same twice; legendaries are rare and luck and chests raise them',()=>{
 const r=CowRun.newRun();
 for(let k=0;k<200;k++){const c=CowRun.rollCards(r);assert.equal(c.length,3);assert.equal(new Set(c.map(x=>x.kind+x.id)).size,3);}
 const legRate=(run,opts)=>{let n=0;for(let k=0;k<20000;k++)if(CowRun.rollCards(run,Math.random,opts).some(c=>c.kind==='legend'))n++;return n/20000;};
 const base=legRate(r),lucky=legRate({...CowRun.newRun(),m:{luck:50}}),chest=legRate(r,{chest:true});
 assert.ok(base>0.01&&base<0.05,'about 2.4% a level: '+base);
 assert.ok(lucky>base*1.5,'luck lifts it: '+lucky);
 assert.ok(chest>base*3,'a chest far more: '+chest);
});

test('a legendary goes in the hand once, adds its passive, and levels after; the other no longer rolls',()=>{
 const r=CowRun.newRun();
 const card=CowRun.rollCards(r,seq([0]))[0];
 assert.equal(card.kind,'legend');
 assert.equal(CowRun.apply(r,card),card.id);
 assert.deepEqual(r.leg,{id:card.id,lvl:1});
 for(let k=0;k<500;k++)for(const c of CowRun.rollCards(r))if(c.kind==='legend')assert.equal(c.id,card.id);
});

test('two weapons (the legendary one of them) and six power-ups at a time: a newcomer replaces the one you choose and takes everything it gave',()=>{
 assert.equal(CowRun.MAX_WEAPONS,2);assert.equal(CowRun.MAX_PASSIVES,6);
 const r=CowRun.newRun();
 for(let k=0;k<400;k++){
  const cs=CowRun.rollCards(r);
  const c=cs[k%cs.length];
  if(c.replaces==='choose')c.out=Object.keys(r.p)[k%6];
  if(c.replaces==='chooseW'){const l=[...Object.keys(r.w),...(r.leg?[r.leg.id]:[])];c.out=l[k%l.length];}
  CowRun.apply(r,c);
  assert.ok(CowRun.armed(r)<=2,'two weapon slots');assert.ok(Object.keys(r.p).length<=6);
 }
 const s=CowRun.newRun();
 CowRun.apply(s,{kind:'weapon',id:'axes',bonus:.25});
 let second=null;for(let k=0;k<500&&!second;k++)second=CowRun.rollCards(s).find(c=>c.kind==='weapon'&&c.id!=='axes')||null;
 assert.equal(second.replaces,null,'the second weapon has a free slot');
 CowRun.apply(s,second);assert.equal(CowRun.armed(s),2);
 let third=null;for(let k=0;k<2000&&!third;k++)third=CowRun.rollCards(s).find(c=>c.kind==='weapon'&&c.isNew)||null;
 assert.equal(third.replaces,'chooseW');
 third.out='axes';CowRun.apply(s,third);assert.ok(!s.w.axes&&!('axes' in s.wb),'the axes and their bonus are gone');
 const leg=CowRun.rollCards(s,()=>0)[0];assert.equal(leg.kind,'legend');assert.equal(leg.replaces,'chooseW','a legendary takes a weapon slot');
 leg.out=Object.keys(s.w)[0];CowRun.apply(s,leg);assert.ok(s.leg);assert.equal(CowRun.armed(s),2);assert.ok(s.m.dmg>0||s.m.haste>0);
 let fourth=null;for(let k=0;k<2000&&!fourth;k++)fourth=CowRun.rollCards(s).find(c=>c.kind==='weapon'&&c.isNew)||null;
 fourth.out=s.leg.id;CowRun.apply(s,fourth);
 assert.equal(s.leg,null,'the legendary can be swapped out');assert.ok(!s.m.dmg&&!s.m.haste&&!s.m.crit&&!s.m.ls,'and its bonus goes with it');
 for(const id of ['might','luck','vamp','haste','thorns','expanse'])CowRun.apply(s,{kind:'passive',id,v:CowRun.byId(id).v,rar:'common'});
 let pc=null;for(let k=0;k<2000&&!pc;k++)pc=CowRun.rollCards(s).find(c=>c.kind==='passive'&&!s.p[c.id])||null;
 assert.equal(pc.replaces,'choose');
 pc.out='luck';CowRun.apply(s,pc);
 assert.ok(!s.p.luck&&!s.m.luck,'Luck and every point it gave are gone');assert.equal(Object.keys(s.p).length,6);
 assert.ok(game.includes("if((card.replaces==='choose'||card.replaces==='chooseW')&&!card.out){cowSwapShow(card);return;}"));
 assert.ok(game.includes("if(!CR.leg&&S.gear.weapon&&S.gear.weapon.cowRun)S.gear.weapon=null;"),'a legendary swapped out leaves the hand');
 assert.match(game,/Replaces a weapon of your choice/);
});

test('a rare stat card gives half again, an epic twice a common',()=>{
 const r=CowRun.newRun();
 const c=CowRun.rollCards(r,seq([0.99,0.0,0.01,0.99,0.5,0.99,0.6,0.99]));
 const p=c.find(x=>x.kind==='passive'&&x.rar==='epic');
 if(p){const def=CowRun.byId(p.id);CowRun.apply(r,p);assert.equal(r.m[def.stat],def.v*2);}
 for(const id of ['axes','bolt','aura','chain','nova','knives','frostseeker','felglaives'])for(let l=1;l<=5;l++)assert.ok(CowRun.weaponStats(id,l).dmg>0,id+l);
});

test('the herd grows with the clock and the time survived pays epics',()=>{
 for(const t of [60,300,600])assert.ok(CowRun.cowHp(t)>CowRun.cowHp(t-60)&&CowRun.cowAtk(t)>=CowRun.cowAtk(t-60));
 assert.ok(CowRun.spawnGap(600)<CowRun.spawnGap(0));
 assert.equal(CowRun.rewardEpics(44),0);assert.equal(CowRun.rewardEpics(45),1);assert.equal(CowRun.rewardEpics(600),13);assert.equal(CowRun.rewardEpics(99999),30);
 const r=CowRun.newRun();CowRun.goldFor(r,1,()=>0.99);assert.equal(r.gold,1);r.m.luck=100;CowRun.goldFor(r,1,()=>0.5);assert.equal(r.gold,3);
});

test('game.js: the run strips the hero, stands the cards in the tree, and gives everything back',()=>{
 assert.match(html,/assets\/cow\/cow-run\.js\?v=\d+"><\/script>\s*<script src="assets\/cow\/cow-fx\.js\?v=\d+"><\/script>\s*<script src="game\.js/,'loaded before game.js');
 assert.match(game,/const COW_STRIP=\['gear','lvl','xp','tree','talents','activeScrolls','pet','pots','cowRunStat'\];/,'the haste and speed upgrades (boosts) stay with the hero');
 assert.match(game,/if\(S&&S\.cowRunStat\)Object\.assign\(treeC\.stat,S\.cowRunStat\);/,'tv lays the cards over the tree');
 assert.match(game,/if\(S\.cowRunStash\)snap=\{\.\.\.snap,\.\.\.S\.cowRunStash\};/,'saveSnapshot writes the hero as he walked in');
 assert.match(game,/function buildZone\(\)\{\n if\(S&&S\.cowRunStash\)cowRunEnd\('left'\);/);
 assert.match(game,/if\(S&&S\.cowRunStash\)cowRunEnd\('quit'\);/);
 assert.match(game,/if\(cowRunning&&S\.cowRunStash\)\{[\s\S]{0,500}cowRunEnd\('died'\);/);
 assert.match(game,/if\(!isFK\(it\)\|\|!S\|\|it\.cowRun\)return it;/);
 assert.match(game,/if\(!isFG\(it\)\|\|!S\|\|it\.cowRun\)return it;/);
 assert.match(game,/const cowRogueOn=\(\)=>!!S;/,'the Cow Level is the Cow Run for every hero');
 assert.match(game,/if\(ch\.cowRunStash\)ch=\{\.\.\.ch,\.\.\.ch\.cowRunStash\};/,'the leaderboard never sees the stripped hero');
 assert.match(game,/if\(test==='cow'\)\{seasonReady=true;document\.title\+=' - Cow test';cowTest\(\);return;\}/);
});

test('game.js, run for real: strip, cards, end - the hero comes back as he went in, and his epics land in the bag',()=>{
 const vm=require('vm');
 const cut=(a,b)=>{const i=game.indexOf(a),j=game.indexOf(b,i);assert.ok(i>=0&&j>i,a);return game.slice(i,j);};
 const src=cut('let CR=null,cowRunLast=null;','function cowRunChest(){');
 const gear={weapon:{name:'Kingsforged Blade'},armor:{name:'Aegis'},trinket:{name:'Idol'}};
 const S={id:'t',test:true,cowRogue:true,lvl:60,xp:123,gear,tree:{a:1},talents:{x:1},activeScrolls:[{id:'titan'},null],pet:'cat',pots:{hp:9,mp:9},boosts:{speed:2,haste:3},bag:[]};
 const logs=[];
 const body=new Set();
 const c={S,CowRun,document:{body:{classList:{add:k=>body.add(k),remove:k=>body.delete(k)}}},ZONES:[{cow:true}],hero:{},treeVer:0,cowT:0,heroMax:()=>100,manaMax:()=>50,classOf:()=>({spells:[{},{},{}]}),
  rollItem:()=>({name:'Epic',rar:'epic'}),log:t=>logs.push(t),stageMsg(){},sfx:{loot(){}},renderHUD(){},cowPickClose(){},cowResultsShow(){},cowRunChest(){},cowKitClear(){},Object,Math,console};
 vm.createContext(c);
 vm.runInContext(src+';this.go=()=>{cowRunStart();};this.end=r=>cowRunEnd(r);this.stats=cowRunStats;this.getCR=()=>CR;',c);
 c.go();
 assert.equal(S.lvl,1);assert.deepEqual(S.gear,{weapon:null,armor:null,trinket:null});assert.equal(S.tree,null);assert.equal(S.pet,null);
 assert.deepEqual(S.boosts,{speed:2,haste:3},'the bought haste and speed upgrades come along');
 assert.ok(S.cowRunStash&&!Object.keys(S).includes('cowRunStash'),'the stash rides along unseen by JSON');
 c.getCR().m.dmg=0.3;c.stats();assert.equal(Math.round(S.cowRunStat.cowDmg),30);
 c.cowT=200;c.end('died');
 assert.equal(S.lvl,60);assert.equal(S.gear,gear);assert.deepEqual(S.tree,{a:1});assert.equal(S.pet,'cat');assert.equal(S.pots.hp,9);
 assert.ok(!('cowRunStat' in S)&&!('cowRunStash' in S));
 assert.equal(S.bag.length,4,'200 s = 4 epics');
 assert.equal(S.cowRunBest.t,200);
});

test('every card says what it does in numbers: a stat before and after, a weapon its next level line by line',()=>{
 const r=CowRun.newRun();
 for(let k=0;k<300;k++){
  const cs=CowRun.rollCards(r,Math.random,{maxHp:200});
  for(const c of cs){
   assert.ok(c.icon,'an icon: '+c.n);
   assert.ok(c.lines&&c.lines.length,'lines: '+c.n);
   for(const l of c.lines)assert.match(String(l.to)+String(l.from??''),/\d/,'a number: '+c.n+' '+JSON.stringify(l));
   assert.doesNotMatch(JSON.stringify(c),/harder, faster/);
  }
  const c=cs.find(x=>x.kind!=='legend')||cs[0];CowRun.apply(r,c);
 }
 assert.deepEqual(CowRun.weaponLines('axes',2)[0],{lab:'Count',from:1,to:2});
 assert.equal(CowRun.rerollPrice(0),15);assert.equal(CowRun.rerollPrice(2),45);
});

test('the view does not shake under the cards: a shake wears off only while the world runs, so the cards and the last screen stop it',()=>{
 assert.match(game,/CR\.cards=cards;CR\.pickChest=!!chest;\n shakeT=0;/);
 assert.match(game,/function cowResultsShow\(run\)\{\n shakeT=0;/);
 const fx=fs.readFileSync(path.join(__dirname,'..','assets','cow','cow-fx.js'),'utf8');
 const lv=fx.slice(fx.indexOf("FX.recipe('cow:levelup'"),fx.indexOf("FX.recipe('cow:chest'"));
 assert.doesNotMatch(lv,/shake/,'the level-up opens the cards at once - no shake');
});

test('the run kit stands over the spells: built when a card is taken, swept every tick, gone with the run',()=>{
 assert.match(game,/cowRunStats\(\);cowKitRender\(\);/);
 assert.match(game,/function cowRunTick\(dt\)\{\n cowT\+=dt;\n cowKitTick\(dt\);/);
 assert.match(game,/document\.body\.classList\.remove\('cowrun'\);\n cowKitClear\(\);/);
 const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
 assert.match(css,/#cowKit\{position:absolute;left:50%;bottom:112px/);
});

test('weapons and spells come common, rare or epic too: +10%, +25% or +50% damage on top of the level; legendaries do not',()=>{
 assert.deepEqual(CowRun.WEAPON_RARITY,{common:0.10,rare:0.25,epic:0.50});
 const rars=new Set();
 for(let k=0;k<3000;k++){const r=CowRun.newRun();r.m.luck=60;for(const c of CowRun.rollCards(r))if(c.kind==='weapon')rars.add(c.rar);}
 assert.deepEqual([...rars].sort(),['common','epic','rare']);
 const r=CowRun.newRun();
 CowRun.apply(r,{kind:'weapon',id:'axes',rar:'rare',bonus:0.25});
 CowRun.apply(r,{kind:'weapon',id:'axes',rar:'epic',bonus:0.50});
 assert.equal(r.w.axes,2);assert.equal(r.wb.axes,0.75);
 const leg=CowRun.rollCards(CowRun.newRun(),()=>0)[0];
 assert.equal(leg.kind,'legend');assert.equal(leg.rar,'legendary');
 assert.match(game,/if\(CR\.wb&&CR\.wb\[id\]\)o\.dmg\*=1\+CR\.wb\[id\];/);
});

test('no top level: weapons, power-ups and legendaries level on for as long as the run lasts; counts and reach level off, damage never',()=>{
 assert.equal(CowRun.MAX_LVL,Infinity);
 const r=CowRun.newRun();
 for(let k=0;k<12;k++)CowRun.apply(r,{kind:'weapon',id:'axes',bonus:.1});
 for(let k=0;k<12;k++)CowRun.apply(r,{kind:'passive',id:'might',v:.1,rar:'common'});
 assert.equal(r.w.axes,12);assert.equal(r.p.might,12);
 assert.ok(CowRun.rollCards(r).length===3);
 for(const id of ['axes','bolt','aura','chain','nova','knives','frostseeker','felglaives']){
  let prev=0;
  for(const l of [1,5,10,30,100]){const st=CowRun.weaponStats(id,l);assert.ok(st.dmg>prev,id+l);prev=st.dmg;}
  const hi=CowRun.weaponStats(id,1000);
  assert.ok((hi.n||0)<=20&&(hi.rad||0)<=330&&(hi.jumps||0)<=14&&(hi.pierce||0)<=6&&(hi.cd===undefined||hi.cd>=0.35),id+' levels off');
 }
 assert.match(game,/if\(c\.lvl>5\)return '';let h='';for\(let k=1;k<=5;k\+\+\)/,'five pips, then the tag says the level');
});

test('eight more power-ups and four more weapons, each with a picture and a working stat; the level said in words, no pips',()=>{
 for(const id of ['thorns','evasion','expanse','barrage','overdrive','bloodlust','clarity','haggler'])assert.ok(CowRun.PASSIVES.find(p=>p.id===id),id);
 for(const id of ['meteor','cleave','plague','judgement']){assert.ok(CowRun.WEAPONS.find(w=>w.id===id),id);for(const l of [1,3,8])assert.ok(CowRun.weaponStats(id,l).dmg>0);}
 assert.equal(CowRun.PASSIVES.length,24);assert.equal(CowRun.WEAPONS.length,10);
 for(const d of [...CowRun.PASSIVES,...CowRun.WEAPONS])assert.ok(fs.existsSync(path.join(__dirname,'..',d.icon)),d.icon);
 assert.equal(CowRun.chestPrice(2,0.5),35);assert.equal(CowRun.rerollPrice(0,0.2),12);
 assert.match(game,/avoid:\(m\.avoid\|\|0\)\*100,killHeal:\(m\.killheal\|\|0\)\*100,mana:\(m\.mana\|\|0\)\*100,regen:\(m\.mana\|\|0\)\*100,cowThorns:\(m\.thorns\|\|0\)\*100,/);
 assert.match(game,/if\(ct>0&&dmg>0&&!foe\.dead\)applyDmg\(foe,Math\.max\(1,Math\.round\(heroAtk\(\)\*ct\/100\)\),'Thorns'\);/);
 for(const id of ['meteor','cleave','plague','judgement'])assert.ok(game.includes("}else if(id==='"+id+"'){"),id);
 assert.match(game,/c\.isNew\?'New':'Level '\+\(c\.lvl-1\)\+' ➜ '\+c\.lvl/);
 const fx=fs.readFileSync(path.join(__dirname,'..','assets','cow','cow-fx.js'),'utf8');
 for(const id of ['cow:meteor','cow:cleave','cow:plaguehit','cow:judge'])assert.ok(fx.includes("FX.recipe('"+id+"'"),id);
});

test('the swap screen weighs each weapon in hand against the newcomer by its damage',()=>{
 assert.ok(game.includes("const dmg=weap?(crWs(id,l)||{}).dmg:null;"));
 assert.ok(game.includes("Two weapons at most - the legendary is one"));
});

test('War Totem and Storm Orb: power-ups that act by themselves, growing with their levels and with Might, Expanse, Overdrive and Barrage',()=>{
 for(const id of ['totem','orb'])assert.ok(CowRun.PASSIVES.find(p=>p.id===id),id);
 assert.ok(CowRun.totemStats(3).dmg>CowRun.totemStats(1).dmg&&CowRun.totemStats(3).rad>CowRun.totemStats(1).rad);
 assert.ok(CowRun.orbStats(5).dmg>CowRun.orbStats(1).dmg&&CowRun.orbStats(5).cd<CowRun.orbStats(1).cd);
 assert.match(game,/const ts=CowRun\.totemStats\(CR\.m\.totem\),rad=ts\.rad\*\(1\+\(CR\.m\.area\|\|0\)\);/,'Expanse widens the totem');
 assert.match(game,/CR\.totemT-=dt\*\(1\+Math\.min\(0\.5,CR\.m\.wcd\|\|0\)\);/,'Overdrive plants it sooner');
 assert.match(game,/n=os\.n\+Math\.round\(CR\.m\.proj\|\|0\)/,'Barrage adds an orb');
 assert.match(game,/cowRunHit\(e,ts\.dmg,0,'cow:totemhit'\)/,'the totem strikes with the hero attack, so Might and crit count');
 const r=CowRun.newRun();let c=null;for(let k=0;k<3000&&!c;k++)c=CowRun.rollCards(r).find(x=>x.id==='totem')||null;
 assert.deepEqual(c.lines.map(l=>l.lab),['Damage / tick','Reach','Totems']);
});

test('an Alpha Bull every three minutes, each tier tougher and redder, slamming the ground and paying a free chest',()=>{
 assert.equal(CowRun.BOSS_GAP,180);
 const a=CowRun.bossStats(1,180),b=CowRun.bossStats(2,360),c=CowRun.bossStats(4,720);
 assert.ok(b.hp>a.hp*1.5&&c.hp>b.hp,'tougher');assert.ok(b.atk>a.atk&&c.slam<a.slam,'harder and quicker to slam');assert.ok(c.red>a.red,'redder');
 assert.ok(a.hp>CowRun.cowHp(180)*50,'a boss, not an Alpha');
 assert.match(game,/CR\.bossT-=dt;\n if\(CR\.bossT<=0\)\{CR\.bossT=CowRun\.BOSS_GAP;cowRunBoss\(\);\}/);
 assert.match(game,/if\(Math\.max\(r,gg,b\)<=20\)continue;/,'the tint leaves the black the cutout keys away');
 assert.match(game,/hazardAt\(hero\.x,hero\.y,st\.slamRad,1\.1,Math\.round\(en\.atk\*1\.6\),'#ff3a2a'\);/);
 assert.match(game,/if\(en\.cowBoss\)\{[\s\S]{0,300}cowPickShow\(true\);/,'its fall opens a free chest');
});

test('the Cow Run AUTO never walks: nearest cow in reach, fights and casts on the move',()=>{
 assert.match(game,/if\(d>heroRange\(\)\)\{if\(!S\.cowRunStash&&!\(kx\|\|ky\)/);
 assert.match(game,/if\(hero\.moving&&!S\.cowRunStash\)hero\.cd=/);
 assert.match(game,/if\(hero\.moving&&!S\.cowRunStash\)\{if\(manual\)stageMsg\('Stand still to cast'/);
 assert.match(game,/if\(S\.cowRunStash&&S\.auto\)\{[\s\S]{0,400}hero\.target=nearestEnemyWithin\(r\);/);
});

test('every card has a ? that says what the thing does, without taking the card',()=>{
 for(const d of [...CowRun.PASSIVES,...CowRun.WEAPONS,...CowRun.LEGENDS])assert.ok(CowRun.HELP[d.id],d.id);
 assert.ok(game.includes('<span class="cc-help" data-cowhelp="'));
 assert.match(game,/q\.onclick=e=>\{e\.stopPropagation\(\);e\.preventDefault\(\);cowHelpShow\(q\.dataset\.cowhelp\);\}/);
});

test('the hero page shows the gear the hero walked in with, red and without buttons, while a run is on',()=>{
 assert.ok(game.includes("const runLock=!!S.cowRunStash,own=runLock?S.cowRunStash:S,lockCls=runLock?' cowlocked':'';"));
 assert.ok(game.includes("const g=own.gear[sl],ringEye=!runLock&&sl==='trinket'&&isRing(g);"));
 assert.ok(game.includes("const petP=runLock?(own.pet?petOf(own.pet):null):activePet();"));
 const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
 assert.match(css,/\.slot\.cowlocked,\.slot\.cowlocked \*\{color:#ff6a5a!important\}/);
});

test('an Alpha Bull never sticks at the fence: it is kept inside by its own size, at birth and every tick',()=>{
 const vm=require('vm');
 const i=game.indexOf('function cowRunInside(en){'),j=game.indexOf('\n}',i)+2;
 const c={world:{w:4200,h:2600},Math};vm.createContext(c);vm.runInContext(game.slice(i,j),c);
 const en={x:30,y:20,r:64};c.cowRunInside(en);
 assert.ok(en.x>=en.r+16&&en.y>=en.r+16,'clear of what collide() calls out of bounds');
 const far={x:5000,y:9000,r:64};c.cowRunInside(far);assert.ok(far.x<=4200-80&&far.y<=2600-80);
 assert.ok(game.includes('cowRunInside(en);   /* a big one spawned by the fence'));
});

test('walking out by Home or the map shows the same summary as a death: time, level, cows, gold and the epics',()=>{
 assert.ok(game.includes("if(reason==='died'||reason==='left')cowResultsShow(run,reason);"));
 assert.ok(game.includes("${left?'You left the herd':'Trampled'}"));
 assert.ok(game.includes("${left?'Continue':'To Moonshine'}"));
});
