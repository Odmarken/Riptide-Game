/* The fixes from the 2026-09-23 bug review (BUG_REVIEW.md), pinned so they stay fixed. Pure pieces run for real in a vm;
 * the DOM-heavy ones are pinned by their source, the way the cloud tests pin theirs. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const between=(from,to)=>section(from,to);

test('markup from other players stays text: esc covers quotes, hero names lose markup characters',()=>{
 const c=vm.createContext({});
 vm.runInContext(section('const esc=t=>','const RARCOL=')+';globalThis.esc=esc;',c);
 assert.equal(c.esc('<img src=x onerror="a(\'b\')">'),'&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;');
 assert.equal(c.cleanHeroName('  <b>Tor&"\'`\\\u0001</b>  '),'bTor/b'); /* a slash is harmless text; the markup characters are what go */
 assert.equal(c.cleanHeroName('Abcdefghijklmnopqrstu'),'Abcdefghijklmn','14 at most');
 assert.equal(c.cleanHeroName('<>'),'','a name that is only markup is no name');
 /* every place another player's name reaches the page goes through esc */
 assert.match(between('function mpLobbyRender(){','\n}'),/esc\(mp\.peers\[k\]\.name/);
 assert.match(between('function gvbRender(){','\nfunction gvbAnimateWave'),/const nameH=p=>esc\(nameOf\(p\)\)/);
 assert.ok(!/\$\{nameOf\(p\)\}/.test(between('function gvbRender(){','\nfunction gvbAnimateWave')),'no raw nameOf() in markup');
 assert.match(between('function gvbSettle(','\n}'),/esc\(\(d\.players\[p\]&&d\.players\[p\]\.name\)/);
});

test('a duel room is cleaned on the way in, and the pot holds only what was paid',()=>{
 const c=vm.createContext({});
 vm.runInContext(section('const GVB_SCORE=','function gvbSig(')+';globalThis.gvb=gvb;globalThis.gvbPaidCount=gvbPaidCount;',c);
 const d=c.gvbClean({state:'roll',host:'pabc',bet:'1000',order:['pabc','x" onmouseover="evil','pdef','pabc'],
  players:{pabc:{name:'<b>Anna</b>',bet:'5e3',ok:1,v:2},'x" onmouseover="evil':{name:'bad'},pdef:{name:'Bert',v:0}},
  waves:{0:{seed:7,o:{pabc:{ic:'<svg/onload=1>',cc:'red;x:expression()',sc:'<b>'},pdef:{ic:'🐂',cc:'#ffd100',sc:10}}}},
  paid:{pabc:true},forfeits:{}});
 assert.deepEqual([...d.order],['pabc','pdef'],'only ids this client could have made, once each');
 assert.equal(d.players.pabc.name,'<b>Anna</b>','kept as text - esc() makes it safe where it is shown');
 assert.equal(d.players.pabc.bet,5000);
 assert.deepEqual({...d.waves[0].o.pabc},{ic:'⚔️',cc:'#5b9bd5',sc:3,n:''},'a chest can only be a chest this table knows');
 assert.equal(d.waves[0].o.pdef.sc,10);
 /* the pot: a v2 seat counts when it has paid; a seat from an older build (no v) counts unless it forfeited */
 c.gvb.pid='pzzz';c.gvb.paidOk=false;
 assert.equal(c.gvbPaidCount({order:['pabc','pdef'],players:d.players,paid:{pabc:true},forfeits:{}}),2);
 assert.equal(c.gvbPaidCount({order:['pabc','pdef'],players:{pabc:{v:2},pdef:{v:2}},paid:{pabc:true},forfeits:{}}),1,'an unpaid v2 seat adds nothing');
 assert.equal(c.gvbPaidCount({order:['pabc','pdef'],players:{pabc:{v:2},pdef:{}},paid:{pabc:true},forfeits:{pdef:true}}),1,'an old seat that forfeited adds nothing');
 /* the settle and the pot display use it; joins go through arrayUnion; a settled loser does not close a room others still settle in */
 assert.match(between('function gvbSettle(','\n}'),/const pot=gvb\.bet\*gvbPaidCount\(d\)/);
 assert.match(game,/order:firebase\.firestore\.FieldValue\.arrayUnion\(gvb\.pid\)/);
 assert.match(game,/gvbActive\(d\)\.every\(p=>p===gvb\.pid\|\|\(d\.settled&&d\.settled\[p\]\)\)/);
});

test('the cup game pays on the stake that was paid, and a round on the table cannot be walked away from',()=>{
 const pick=between('function cupPick(i){','\n}');
 assert.match(pick,/const bet=cupStake;/);
 assert.ok(!/CUP_BETS\[cupBetI\]/.test(pick));
 assert.match(between('function cupStart(){','\n}'),/cupStake=bet;/);
 assert.match(between('function cupUI(){','\n}'),/cupState==='picking'/);
 assert.match(between('function closeCupGame(){','\n}'),/if\(cupState==='shuffling'\|\|cupState==='picking'\)/);
});

test('scaled copies of images live under one memory budget, and a frame\'s own copies are never dropped',()=>{
 const c=vm.createContext({Date});
 vm.runInContext(section('/* 🧠 one memory budget','/* crisp(): the player')+';globalThis.scaledAll=scaledAll;globalThis.SCALED_BUDGET=SCALED_BUDGET;globalThis.bytes=()=>scaledBytes;',c);
 const store={},mk=(w,h)=>({width:w,height:h});
 const big=Math.ceil(Math.sqrt(c.SCALED_BUDGET/4/3));
 const a=mk(big,big),b=mk(big,big),d=mk(big,big),e=mk(big,big);
 c.scaledPut(store,1,a);c.scaledPut(store,2,b);c.scaledPut(store,3,d);
 assert.equal(Object.keys(store).length,3,'drawn a moment ago - kept even past the budget');
 for(const v of c.scaledAll.values())v.t-=10000; /* ten seconds later */
 c.scaledTouch(d);
 c.scaledPut(store,4,e);
 assert.equal(store[1],undefined,'the least recently drawn goes first');
 assert.ok(store[3]&&store[4],'the one drawn again, and the new one, stay');
 assert.ok(c.bytes()<=c.SCALED_BUDGET+big*big*4);
 assert.match(between('function crisp(img,W){','\n}'),/if\(dev>=img\.naturalWidth\)return img;/,'no copy larger than its source');
});

test('the gear ladder: hub zones count as progress, level-60 specials keep their rung, chests roll by progress',()=>{
 const ZONES=[{},{},{},{lvl:10},{special:true,lvl:60},{special:true,lvl:1}];
 const c=vm.createContext({ZONES,MAXLVL:60});
 vm.runInContext(section('function gearRungHere(','function rollItem('),c);
 assert.equal(c.gearRungHere({zone:3}),3);
 assert.equal(c.gearRungHere({zone:4}),4,'an endgame special keeps its index');
 assert.equal(c.gearRungHere({zone:5}),0,'Moonshine, the City, the Harbour... are places, not rungs');
 assert.equal(c.gearRungHere({zone:99}),0,'a zone this build does not know');
 assert.match(between('function rollItem(','/* WEAPONS keep pace'),/const zi=fromChest\?\(S\.maxZone\|\|0\):Math\.max\(gearRungHere\(S\),S\.maxZone\|\|0\);/);
 assert.equal((game.match(/rollItem\(rar,false,true\)/g)||[]).length,2,'GOLD GOLD GOLD and GAMBAAA chests roll by progress');
 assert.match(between('function bestNormalWeaponAtk(){','\n}'),/Math\.max\(gearRungHere\(S\),progZone\(S\)\|\|0\)/);
});

test('farm pieces are held by reference, the cart never outlives its hero, and a half-eaten bale refunds what is left',()=>{
 const S={farm:{b:[],c:[],r:[],baleN:0,cseedN:0,inv:{}}};
 const c=vm.createContext({S,farmCart:[],world:{solids:[]}});
 vm.runInContext(section('function farmListOf(kind){','function showMovePopup('),c);
 const bull={t:'tjur'},barn={t:'lada'},bale={t:'hobal',bites:1};
 S.farm.b.push(bale,bull,barn);
 const pick={kind:'b',i:1,t:'tjur',ref:bull};
 S.farm.b.splice(0,1); /* the herd finishes the bale while the menu is open */
 assert.equal(c.farmPiece(pick),bull,'still the bull, not the barn that slid into its slot');
 assert.equal(pick.i,0);
 S.farm.b.splice(0,1);
 assert.equal(c.farmPiece(pick),null,'gone is gone');
 /* farmRefund: a bale with one bite left gives one point back */
 const r=vm.createContext({S:{farm:{baleN:0,cseedN:0,inv:{}},scraps:0},FARM_ROAD_RATE:{},FARM_PRICES:{},FARM_SCRAPS:{},SCRAP_CAP:1e9,isHay:()=>false,addGoldOverflow(){},roadCost:()=>0});
 vm.runInContext(section('function farmRefund(list){','\n}')+'\n}',r);
 r.farmRefund([{t:'hobal',bites:1},{t:'hobal'},{t:'chickenseeds',bites:3}]);
 assert.equal(r.S.farm.baleN,6);assert.equal(r.S.farm.cseedN,3);
 /* the hero list, entering the world and leaving the farm all put the build tools down */
 assert.match(between('function showSelect(){','\n}'),/dropFarmBuild\(\);/);
 assert.match(between('function beginGame(isNew){','\n}'),/dropFarmBuild\(\);/);
 assert.match(between('function applyZoneUI(){','\n}'),/if\(!zoneOf\(\)\.farm\)\{dropFarmBuild\(\);/);
 assert.match(between('function rebuildFarmItems(){','\n}'),/if\(!world\|\|!S\|\|!zoneOf\(\)\.farm\)return;/);
 assert.match(game,/Not enough in stock: /,'the checkout refuses what the stock cannot cover');
});

test('scenes end cleanly: travel is held while one plays, a new hero never inherits one, and the frame loop survives a fault',()=>{
 assert.match(between('function coronationTick(dt){','\n}'),/if\(sc\.staged&&\(!world\|\|!world\.throne\|\|!world\.npcs\)\)\{cancelHallScenes\(\);return;\}/);
 assert.match(between('function executionTick(dt){','\n}'),/if\(sc\.staged&&sc\.phase!=='return'&&\(!world\|\|!zoneOf\(\)\.city\|\|!world\.npcs\)\)\{cancelHallScenes\(\);return;\}/);
 for(const where of ['function goHome(){','function doPrestige(){'])assert.match(between(where,'\n}'),/sceneHoldsTravel\(\)/,where);
 assert.match(game,/\$\('charSelBtn'\)\.onclick=async\(\)=>\{if\(hcNoFlee\(\)\|\|sceneHoldsTravel\(\)\|\|casinoRoundOpen\(\)\)return;/);
 assert.match(game,/if\(S&&S\.city&&!coronation&&!execution\)\{/,'the ledger clock holds its breath during a scene');
 const frame=between('function frame(t){','\nconst sidebarResize=');
 assert.ok(frame.indexOf('requestAnimationFrame(frame)')<frame.indexOf('try{'),'the next frame is asked for before anything can throw');
 assert.match(frame,/\}catch\(e\)\{\n\s*frame\.faults=/);
});

test('saves: a hero left behind is pushed on its own, a hardcore death is forced, a season change retires and never deletes',()=>{
 assert.match(between('function showSelect(){','\n}'),/parkDirtyHero\(\);/);
 assert.match(between('async function flushParked(){','\n}'),/cloudPushChar\(ch\)/);
 assert.match(between('function hcDeath(){','\n}'),/saveNow\(\);publishLB\(S,true\);/);
 assert.match(between('async function saveNow(){','\n}'),/FB\.pushDirty=true;/);
 const pull=between('async function cloudPullRoster(job){','\n}');
 assert.match(pull,/retired\.has\(id\)&&\+\(\(raw&&raw\.season\)\|\|0\)!==\+SEASON/);
 assert.ok(!/chars:\{\}/.test(pull)&&!/FieldValue\.delete\(\)/.test(pull),'a season change never deletes a hero');
 const push=between('async function cloudPushChar(ch){','\n}');
 assert.match(push,/copy\.season=SEASON;/);
 assert.ok(!/season:SEASON,roster/.test(between('async function cloudDeleteChar(id){','\n}')),'a delete does not relabel the doc');
});

test('Tides and mounts from a newer build are kept, not dropped; an explicit "none equipped" stays none',()=>{
 const T=require('../assets/tides/core.js');
 const wild=T.allSpecies().find(s=>!s.hybrid);
 const c=T.normalizeCollection({nextId:3,lassoOwned:true,equippedId:null,pets:[{id:'tide-1',speciesId:wild.id,level:4},{id:'tide-9',speciesId:'a-species-from-the-future',level:30}],
  breedingJobs:[{id:'breed-5',stationId:'st-1',parentAId:'tide-1',parentBId:'tide-2',startedAt:1,readyAt:2,offspring:{id:'tide-12',speciesId:'future-hybrid'}}]});
 assert.deepEqual(c.pets.map(p=>p.id),['tide-1']);
 assert.equal(c.foreignPets.length,1);assert.equal(c.foreignPets[0].id,'tide-9');
 assert.ok(c.nextId>9,'new ids never collide with a kept one');
 assert.equal(c.equippedId,null);
 assert.equal(c.foreignJobs.length,1);
 assert.equal(T.breedingStatus(c,'st-1').phase,'incubating','the kept clutch still holds its incubator');
 const again=T.normalizeCollection(JSON.parse(JSON.stringify(c)));
 assert.equal(again.foreignPets.length,1,'it survives a save and a reload');
 const M=require('../assets/mounts/mounts.js');
 assert.deepEqual(M.normalize({owned:['horse','sky-drake'],equipped:'sky-drake'}),{owned:['horse'],equipped:'sky-drake',foreign:['sky-drake']});
});

test('the city: the Bank tab shows what a close charges, the old King keeps his cell through a reload',()=>{
 const E=require('../assets/city/economy.js');
 const s=E.normalize(null);s.jail=Array.from({length:E.MAX_CELLS+3},(_,i)=>({name:'P'+i,term:1,served:0,crime:'x',life:i===0}));
 assert.equal(E.normalize(JSON.parse(JSON.stringify(s))).jail.length,E.MAX_CELLS+3);
 assert.match(fs.readFileSync(path.join(root,'assets/city/economy.js'),'utf8'),/const im=num\(cardOf\(state\)\.mods\.interest,1\);/);
});

test('input: held keys are let go on blur, a pinch counts only fingers on the map, Enter signs in, double clicks buy once',()=>{
 assert.match(game,/window\.addEventListener\('blur',releaseHeldInput\);/);
 assert.ok(!/e\.touches/.test(game),'pinch uses targetTouches');
 assert.match(game,/cv\.addEventListener\('touchcancel',endPinch\);/);
 assert.match(game,/\['fbEmail','fbPass'\]\.includes\(document\.activeElement\?\.id\)\)\{e\.preventDefault\(\);if\(!e\.repeat\)fbSignIn\(false\);return;\}/);
 assert.match(game,/\$\('bjDeal'\)\.onclick=e=>\{if\(e&&e\.detail>1\)return;bjDeal\(\);\};/);
 assert.match(game,/if\(e\.target\.closest\('#rtbStart'\)\)\{if\(e\.detail>1\)return;rtbStart\(\);\}/);
 assert.ok(!/\['','Round 2 - higher or lower than '/.test(game),'Ride the Bus no longer reads a card that has not been drawn');
 const side=fs.readFileSync(path.join(root,'assets/ui/sidebar-resize.js'),'utf8');
 assert.match(side,/if\(next===undefined\)return; \/\* only the keys the handle uses stop here/);
});

test('raids: per-lord running totals, the Firestore death is a real death, swings only hit who they reach',()=>{
 assert.match(game,/if\(nb\.dead&&!e\.dead\)\{e\.netDead=true;killEnemy\(e\);\} \/\* the same death as over WebRTC/);
 assert.match(between('function mpHostTotal(','\n}'),/if\(!\(tot>prev\)\)return;/);
 assert.match(between('function mpGuestRaidHit(','\n}'),/rtcBroadcast\(\{k:'dmg',id,tot:mp\.dmgBy\[id\],d:rd\},true\);/);
 assert.match(game,/if\(en\.raid&&TMove!==hero&&Math\.hypot\(en\.x-hero\.x,en\.y-hero\.y\)>30\+en\.r\+14\)continue;/);
 assert.match(between('function applyZoneUI(){','\n}'),/if\(mp\.on&&mp\.started&&!zoneOf\(\)\.raid\)mpLeave\(false\);/);
 assert.match(between('function mpBegin(){','\n}'),/e\.hp=Math\.round\(e\.hp\*1\.5\)/);
});
