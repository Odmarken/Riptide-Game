/* Exercise production UI orchestration against the real collection/series rules. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Tides=require('../assets/tides/core.js'),TideGuild=require('../assets/tides/guild.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/tides/ui.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function harness(){
 const collection=Tides.createCollection();Tides.purchaseLasso(collection,10000,{rng:()=>0});collection.pets[0].level=22;
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:true,innerHTML:'',textContent:'',style:{},classList:{toggle(){},remove(){}},setAttribute(){}});return nodes.get(id)};
 const c={Tides,TideGuild,S:{tides:collection},session:null,hubMode:'guild',gameOn:true,gamePaused:false,hero:{dead:false},access:true,
  guildInReach:()=>c.access,el,html:s=>String(s),owned:()=>Tides.equipped(c.S.tides),species:Tides.getSpecies,petSkill:Tides.getSkill,stars:()=>'',remaining:Tides.remainingInjury,
  frameFor:()=>({}),imageFor:()=>({}),icon:()=>'<canvas></canvas>',paintIcons(){},restText:()=> 'Ready',Mounts:{reset(){}},mountRide:{},updateMountButton(){},stopHero(){},
  zoom:1,camX:40,camY:70,setZoom:z=>c.zoom=z,createGuildTrainer:()=>({name:'Alda Ash',race:'human',cls:'mage',fem:true,ice:true,wench:'veinseeker',ring:true}),
  openHub:(mode)=>{if(c.session)return false;c.hubMode=mode;return true},closeHub:()=>c.hubMode='',openStorage(){},entry(){},saveNow:()=>c.saves++,saves:0,
  appendLog:text=>c.log.push(text),log:[],battleAction(){},initAudio(){},sfx:{loot(){},warn(){},tideImpact(){},tideCast(){},tidePower(){}},
  paintBattle(){},clockTick:0,motionClock:0,refreshStorageValues(){},Date,Math};
 vm.createContext(c);
 for(const [start,end]of [[' function guildAllowed(',' function begin(id)'],[' function battleHud(',' function battleSound('],[' function battleSound(',' function awardKill('],[' function tick(',' function nearestWild(']])vm.runInContext(section(start,end),c);
 return c;
}
function settle(c,win){
 const b=c.session.battle;
 if(win){b.foe.hp=1;b.player.atk=99999;b.foe.atk=1;b.foe.powerCooldown=2;}else{b.player.hp=1;b.player.atk=1;b.foe.atk=99999;b.foe.powerCooldown=2;}
 c.act('attack');assert.ok(c.session.animation,'normal combat animation starts');
 assert.equal(c.session.result,null,'settlement waits for the visible combat timeline');
 c.tick(3);assert.ok(c.session.shownResult,'timeline completion reveals the result');
}
test('guild UI rejects a distant host, unready Tide and repeated start clicks',()=>{
 const c=harness();c.access=false;assert.equal(c.openGuild(),false);assert.equal(c.beginGuild(),false);assert.equal(c.S.tides.activeBattle,null);
 c.access=true;assert.equal(c.openGuild(),true);assert.equal(c.beginGuild(),true);const id=c.S.tides.activeBattle.id;
 assert.equal(c.beginGuild(),false);assert.equal(c.S.tides.activeBattle.id,id);assert.equal(c.session.battle.foe.level,22);
 c.closeBattle();c.S.tides.equippedId=null;c.openGuild();assert.equal(c.beginGuild(),false);
});
test('2–1 finishes the series, resets every match and never captures, injures or awards XP',()=>{
 const c=harness(),before=JSON.stringify(c.S.tides.pets);assert.equal(c.beginGuild(),true);const trainer=c.session.guild.trainer,opponent=c.session.battle.foe.speciesId;
 settle(c,true);assert.equal(c.session.guild.score.player,1);assert.equal(c.session.guild.status,'between-rounds');
 assert.equal(c.nextGuildRound(),true);assert.equal(c.nextGuildRound(),false,'a repeated Next click cannot add a match');
 assert.equal(c.session.guild.trainer,trainer);assert.equal(c.session.battle.foe.speciesId,opponent);
 assert.equal(c.session.battle.player.hp,c.session.battle.player.maxHp);assert.equal(c.session.battle.foe.hp,c.session.battle.foe.maxHp);
 settle(c,false);assert.equal(c.session.guild.score.foe,1);assert.equal(c.session.guild.status,'between-rounds');assert.equal(c.nextGuildRound(),true);
 settle(c,true);assert.equal(c.session.guild.outcome,'win');assert.equal(c.session.guild.round,3);assert.equal(c.session.guild.status,'finished');assert.equal(c.S.tides.guildSeries,null);
 assert.match(c.el('tideResult').innerHTML,/Series victory!/);assert.match(c.el('tideResult').innerHTML,/Fight again/);assert.equal(c.nextGuildRound(),false);
 assert.equal(JSON.stringify(c.S.tides.pets),before);const previous=c.session.battle.id;c.el('tideGuildContinue').onclick();assert.ok(c.session);assert.notEqual(c.session.battle.id,previous);assert.equal(c.session.guild.round,1);
});
test('0–2 finishes after two matches and leaving between matches cancels the whole series',()=>{
 const c=harness();c.beginGuild();settle(c,false);c.nextGuildRound();settle(c,false);assert.equal(c.session.guild.round,2);assert.equal(c.session.guild.outcome,'loss');assert.equal(c.S.tides.activeBattle,null);
 c.closeBattle();assert.equal(c.zoom,1);assert.equal(c.camX,40);assert.equal(c.camY,70);c.openGuild();c.beginGuild();settle(c,true);c.closeBattle();
 assert.equal(c.S.tides.guildSeries,null);assert.equal(c.S.tides.activeBattle,null);assert.equal(c.session,null);assert.equal(c.S.tides.pets[0].injuredUntil,0);
});
test('retreat, zone exit and switching characters clear guild state even during an attack',()=>{
 const c=harness();c.beginGuild();c.retreat();assert.ok(c.session,'first click only asks');c.retreat();assert.equal(c.session,null);assert.equal(c.S.tides.guildSeries,null);
 c.openGuild();c.beginGuild();c.act('attack');c.access=false;c.tick(.1);assert.equal(c.session,null);assert.equal(c.S.tides.activeBattle,null);assert.equal(c.S.tides.guildSeries,null);
 c.access=true;c.openGuild();c.beginGuild();const owner=c.S.tides;c.S={tides:Tides.createCollection()};c.tick(.1);assert.equal(owner.activeBattle,null);assert.equal(owner.guildSeries,null);assert.equal(c.S.tides.activeBattle,null);
});
function doubleKnockout(c){
 const b=c.session.battle;b.player.hp=b.foe.hp=1;b.player.atk=b.foe.atk=99999;b.foe.powerCooldown=2;
 c.act('attack');const a=c.session.animation;assert.equal(a.moves.length,2,'both committed attacks have their own animation slot');
 assert.equal(c.session.battle.outcome,'draw');assert.equal(c.session.result,null,'no settlement during the attacks');
 const firstDamage=a.events.find(e=>e.type==='damage'&&e.actionIndex===0),second=a.moves[1];
 c.tick(firstDamage.at+.001);assert.equal(c.session.animation.display.foe.hp,1,'starting health is held until both actions complete');assert.equal(c.session.result,null);
 c.tick(second.start+second.duration*.5-c.session.animation.elapsed);
 assert.equal(c.animationMove(c.session.animation).actor.side,'foe','a knocked-out actor still performs its committed attack');
 assert.equal(c.session.result,null);c.tick(3);assert.equal(c.session.result.outcome,'draw');assert.equal(c.session.animation,null);
 return b;
}
test('a double knockout plays both attacks before Draw, then replays the same guild match with no point',()=>{
 const c=harness(),before=JSON.stringify(c.S.tides.pets);c.beginGuild();const initial=c.session.guild,opponent=initial.opponent,trainer=initial.trainer;
 doubleKnockout(c);assert.match(c.el('tideResult').innerHTML,/<h3>Draw!/);assert.match(c.el('tideResult').innerHTML,/Replay match/);
 assert.equal(c.session.guild.score.player,0);assert.equal(c.session.guild.score.foe,0);assert.equal(c.session.guild.round,1);assert.equal(c.session.guild.status,'between-rounds');
 c.el('tideGuildContinue').onclick();assert.equal(c.session.guild.round,1);assert.equal(c.session.guild.opponent,opponent);assert.equal(c.session.guild.trainer,trainer);
 assert.equal(c.session.battle.player.hp,c.session.battle.player.maxHp);assert.equal(c.session.battle.foe.hp,c.session.battle.foe.maxHp);
 settle(c,true);c.nextGuildRound();settle(c,true);assert.equal(c.session.guild.round,2);assert.equal(c.session.guild.outcome,'win');assert.equal(JSON.stringify(c.S.tides.pets),before);
});
test('wild draws use the explicit no-reward result, and closing during a resolved draw does not turn it into defeat',()=>{
 const c=harness(),before=JSON.stringify(c.S.tides.pets);
 function beginWild(){const r=Tides.beginBattle(c.S.tides,{id:'wild-draw',speciesId:'bramblebunny',level:22});assert.equal(r.ok,true);c.hubMode='';c.session={owner:c.S.tides,battle:r.battle,oldZoom:1,oldCamX:40,oldCamY:70,time:0,animation:null,result:null,shownResult:false};}
 beginWild();doubleKnockout(c);assert.match(c.el('tideResult').innerHTML,/<h3>Draw!/);assert.match(c.el('tideResult').innerHTML,/No Tide was captured and no XP was awarded/);assert.equal(JSON.stringify(c.S.tides.pets),before);assert.equal(c.S.tides.activeBattle,null);
 c.closeBattle();beginWild();const b=c.session.battle;b.player.hp=b.foe.hp=1;b.player.atk=b.foe.atk=99999;b.foe.powerCooldown=2;c.act('attack');assert.equal(b.outcome,'draw');c.closeBattle();assert.equal(b.outcome,'draw');assert.equal(JSON.stringify(c.S.tides.pets),before);assert.equal(c.S.tides.activeBattle,null);
});
test('simultaneous healing, lethal hits and full-health healing commit both bars together after both actions',()=>{
 for(const [startingHp,enemyAttack,finalHp]of [[10,19,7],[10,34,0],[100,19,97]]){
  const c=harness();c.Tides={...Tides,act:(b,action)=>Tides.act(b,action,{rng:()=>.5})};c.S.tides.pets[0].speciesId='bramblebunny';c.beginGuild();
  const b=c.session.battle;Object.assign(b.player,{hp:startingHp,maxHp:100,atk:10,shield:4,buff:0,buffTurns:2,powerCooldown:0});Object.assign(b.foe,{hp:100,maxHp:100,atk:enemyAttack,shield:0,powerCooldown:2});
  c.act('power');const a=c.session.animation;assert.equal(b.player.hp,finalHp);assert.equal(b.foe.hp,88);assert.equal(b.player.shield,0);assert.equal(b.player.buffTurns,1);
  const verifyStartingBars=()=>{assert.equal(c.el('tidePlayerHpText').textContent,startingHp+' / 100');assert.equal(c.el('tideFoeHpText').textContent,'100 / 100');assert.equal(c.session.animation.display.player.shield,4);assert.equal(c.session.animation.display.player.buffTurns,2);assert.match(c.el('tidePlayerStatus').textContent,/Shield 4.*Empowered 2 turns/);};
  verifyStartingBars();c.tick(a.duration*.5);verifyStartingBars();c.tick(a.duration*.5-.001);verifyStartingBars();
  c.tick(.002);assert.equal(c.session.animation,null);assert.equal(c.el('tidePlayerHpText').textContent,finalHp+' / 100');assert.equal(c.el('tideFoeHpText').textContent,'88 / 100');assert.match(c.el('tidePlayerStatus').textContent,/Empowered 1 turns/);assert.doesNotMatch(c.el('tidePlayerStatus').textContent,/Shield/);
  if(finalHp===0)assert.equal(c.session.result.outcome,'loss');else assert.equal(c.session.result,null);
 }
});
test('pre-action poison and long multi-hit powers stay chronologically ordered between both animation slots',()=>{
 const c=harness(),events=[],add=(type,actionIndex,side=actionIndex===0?'player':'foe')=>events.push({type,actionIndex,actionSide:actionIndex===0?'player':'foe',side,targetSide:side,text:type});
 add('poison',0,'foe');add('power',0);for(let i=0;i<14;i++)add('damage',0);add('poison',1,'player');add('attack',1);add('damage',1);events.push({type:'result',text:'Draw!'});
 const a=c.battleTimeline(events,{}),first=a.moves[0],second=a.moves[1],poisons=a.events.filter(e=>e.type==='poison');
 assert.ok(a.events.every((e,i)=>i===0||e.at>a.events[i-1].at),'event timestamps never rewind at an attack boundary');
 assert.ok(poisons[0].at<first.start);assert.ok(poisons[1].at>=first.start+first.duration);assert.ok(poisons[1].at<second.start);
 assert.ok(second.start>first.start+first.duration);assert.ok(a.events.at(-1).at>=second.start+second.duration);assert.ok(a.duration>a.events.at(-1).at);
});
test('all original and hybrid Tide pairs fit between both trainers at desktop and narrow arena sizes',()=>{
 const art={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/tides/art-layout.js'),'utf8'),art);
 const c={species:Tides.getSpecies,TideArtLayout:art.TideArtLayout,frameFor:id=>{const s=Tides.getSpecies(id),r=s.art?.rect||art.TideArtLayout[id].bounds;return {w:r[2],h:r[3]}}};vm.createContext(c);
 vm.runInContext(section(' function animalVisual(',' function stopHero('),c);
 for(const [w,h,top,bottom]of [[1440,1000,190,750],[390,844,160,630],[844,390,96,270],[320,390,112,256]])for(const p of Tides.allSpecies())for(const f of Tides.catalog){
  const l=c.battleLayout(w,h,p.id,f.id,top,bottom,{headY:-42,groundY:18},{guild:true,trainerFrame:{headY:-45,groundY:20}}),tag=w+'x'+h+' '+p.id+'/'+f.id;
  assert.ok(l.left-l.player.width*.55>l.heroRight,tag+' player Tide clears its trainer');
  assert.ok(l.right+l.foe.width*.55<l.foeHeroLeft,tag+' opponent Tide clears its trainer');
  assert.ok(l.left+l.player.width*.55<l.right-l.foe.width*.55,tag+' creatures remain separate');
  assert.ok(l.heroTop>=top+11.99&&l.heroBottom<=bottom-11.99,tag+' heads, rings and boots fit');
  assert.ok(l.floor-Math.max(l.player.height,l.foe.height)*1.08>=top+11.99,tag+' creatures clear health cards');
  assert.ok(l.left+l.travel<l.right&&l.right-l.travel>l.left,tag+' melee does not cross its target');
 }
});
