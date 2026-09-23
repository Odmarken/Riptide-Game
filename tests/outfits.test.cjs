/* 👘 Outfits, headless: what the hero is drawn in - the class colours, the Ice Armor or the crown's robes - chosen on the
 * Outfits page and independent of what is worn for numbers; the weapon eye; and what a peer's look says. The rules are
 * sliced out of game.js and run against stubs. Run with node --test. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const slice=source.slice(source.indexOf('const OUTFITS=['),source.indexOf('function bootFeet('));
function harness(S){
 const c={S,classOf:()=>({name:'Warrior'}),isIce:it=>!!(it&&it.legend==='icearmor'),isFK:it=>!!(it&&it.legend==='rimfrost'),isFG:it=>!!(it&&it.legend==='felglaives'),
  RACE_ALIAS:{},CLASS_ALIAS:{},keys:[],charSprite:(r,cls,f)=>{c.keys.push(r+(f?'female':'male')+'_'+cls);return {};},
  characterBodyFrame:(img,h=48,b=5)=>({bodyBottom:b,bodyHeight:h,headY:b-h,bootTop:null,x:0,y:0,width:10,height:h}),characterBootFrame:()=>({groundY:10}),bootImg:{}};
 vm.createContext(c);vm.runInContext(slice,c);
 for(const k of ['OUTFITS','outfitArgOf','outfitArg','lookOutfit','heroWeaponArgs','ROYAL_BODY_H'])c[k]=vm.runInContext(k,c);
 return c;
}
const hero=(extra={})=>({race:'human',cls:'warrior',gender:'m',gear:{weapon:null,armor:null,trinket:null},bag:[],...extra});

test('👘 three outfits, unlocked by what you have done: the class colours always, the Ice Armor by the ritual or the plate, the robes by the crown',()=>{
 const c=harness(hero());
 assert.deepEqual(Array.from(c.OUTFITS.map(o=>o.id)),['default','ice','royal']);   /* Array.from / spread: values made in the vm realm */
 assert.equal(c.outfitUnlocked('default'),true);assert.equal(c.outfitUnlocked('ice'),false);assert.equal(c.outfitUnlocked('royal'),false);assert.equal(c.outfitUnlocked('nope'),false);
 assert.equal(harness(hero({ritualDone:true})).outfitUnlocked('ice'),true,'the ritual');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}}})).outfitUnlocked('ice'),true,'the plate on your back');
 assert.equal(harness(hero({bag:[{legend:'icearmor'}]})).outfitUnlocked('ice'),true,'the plate in the bag');
 assert.equal(harness(hero({city:{crowned:false}})).outfitUnlocked('royal'),false);assert.equal(harness(hero({city:{crowned:true}})).outfitUnlocked('royal'),true,'the crown');
 assert.ok(c.OUTFITS.every(o=>o.name()&&o.desc&&o.how&&o.icon));
 assert.equal(harness(hero({gender:'f',city:{crowned:true}})).OUTFITS[2].name(),'Queen’s robes');assert.equal(c.OUTFITS[2].name(),'King’s robes');
});

test('👘 what is drawn: the choice when it is unlocked, the class colours when it is not, and the old rule for a save without a choice',()=>{
 assert.equal(harness(hero()).heroOutfit(),'default');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}}})).heroOutfit(),'ice','no choice yet: the armor on your back shows');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}},outfit:'default'})).heroOutfit(),'default','chosen: the plate is hidden under the class colours');
 assert.equal(harness(hero({outfit:'royal'})).heroOutfit(),'default','not crowned: the robes are not yours');
 const k=harness(hero({outfit:'royal',city:{crowned:true}}));
 assert.equal(k.heroOutfit(),'royal');assert.equal(k.outfitArg(),'royal');
 assert.equal(harness(hero({outfit:'ice',ritualDone:true})).outfitArg(),true);assert.equal(harness(hero()).outfitArg(),false);
 assert.equal(harness(null).heroOutfit(),'default');assert.equal(harness(null).outfitUnlocked('default'),true);
 /* the painted frame asks for the right sprite, and the royal frame is taller for the crown */
 const f=k.paintedCharacterFrame('human','warrior',false,'royal');assert.deepEqual([...k.keys],['humanmale_royal']);assert.equal(f.bodyHeight,k.ROYAL_BODY_H);assert.ok(k.ROYAL_BODY_H>48);
 k.keys.length=0;assert.equal(k.paintedCharacterFrame('orc','mage',true,true).bodyHeight,48);assert.deepEqual([...k.keys],['orcfemale_armor']);
 k.keys.length=0;k.paintedCharacterFrame('dwarf','priest',false,false);assert.deepEqual([...k.keys],['dwarfmale_priest']);
 /* what a peer sent */
 assert.equal(k.lookOutfit({outfit:'royal',ice:false}),'royal');assert.equal(k.lookOutfit({ice:true}),true);assert.equal(k.lookOutfit({}),false);assert.equal(k.lookOutfit(null),false);
});

test('👁 the weapon eye: sheathed, the hand is empty and the rune is out - the numbers do not know',()=>{
 const rim=harness(hero({gear:{weapon:{legend:'rimfrost'}}}));assert.deepEqual({...rim.heroWeaponArgs()},{fm:true,id:'rimfrost'});
 const fel=harness(hero({gear:{weapon:{legend:'felglaives'}}}));assert.deepEqual({...fel.heroWeaponArgs()},{fm:false,id:'felglaives'});
 const plain=harness(hero({gear:{weapon:{id:'sword'}}}));assert.deepEqual({...plain.heroWeaponArgs()},{fm:false,id:null});
 const hid=harness(hero({gear:{weapon:{legend:'rimfrost'}},hideWeapon:true}));assert.deepEqual({...hid.heroWeaponArgs()},{fm:false,id:'hidden'});
});

function offerHarness(extra={}){
 const c=harness(hero({city:{crowned:true},...extra})),elements={},timers=new Map(),draws=[];
 let serial=0,ready=false;
 const g=new Proxy({}, {get:(target,key)=>target[key]||(()=>{})});
 c.$=id=>elements[id]||(elements[id]={style:{display:'none'},width:180,height:220,getContext:()=>g});
 c.classOf=()=>({id:c.S.cls,name:c.S.cls});
 const body=c.characterBodyFrame;
 c.characterBodyFrame=(...args)=>ready?body(...args):null;
 c.bootFeet=()=>{};c.drawChampionSprite=(...args)=>draws.push(args);
 c.performance={now:()=>0};c.save=()=>{};c.renderHero=()=>{};c.stageMsg=()=>{};c.sfx={};
 c.setTimeout=fn=>{timers.set(++serial,fn);return serial;};c.clearTimeout=id=>timers.delete(id);
 vm.runInContext(source.slice(source.indexOf('function paintOutfitPortrait('),source.indexOf('let outfitPortraitTimer=')),c);
 vm.runInContext(source.slice(source.indexOf('let outfitOfferPaintTimer='),source.indexOf('function ledgerEntry(){')),c);
 return {c,draws,timers,load(){ready=true;},tick(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}};
}

test('royal offer waits for cold art and then draws the selected race, gender and class in robes',()=>{
 for(const race of ['human','dwarf','orc','undead'])for(const gender of ['m','f'])for(const cls of ['warrior','mage','hunter','priest']){
  const h=offerHarness({race,gender,cls}),key=race+(gender==='f'?'female':'male')+'_royal';
  assert.ok(fs.existsSync(path.join(__dirname,'../assets/characters',key+'.png')));
  h.c.openOutfitOffer('royal');
  assert.equal(h.c.$('outfitFx').style.display,'flex');
  assert.equal(h.draws.length,0,'no unrobed fallback while loading');
  assert.equal(h.timers.size,1,'a cold first open must schedule a repaint');
  h.tick();assert.equal(h.timers.size,1,'keep waiting if the art is still loading');
  h.load();h.tick();
  assert.equal(h.timers.size,0);
  assert.ok(h.c.keys.every(k=>k===key));
  assert.equal(h.draws.length,1);
  const draw=h.draws[0];
  assert.equal(draw[1],race);assert.equal(draw[2],cls);assert.equal(draw[8],gender==='f');assert.equal(draw[10],'royal');
  assert.match(h.c.$('outfitOfferTitle').textContent,gender==='f'?/QUEEN/:/KING/);
 }
});

test('closing or reopening the offer cancels pending paints and switching heroes stops them',()=>{
 const h=offerHarness();h.c.openOutfitOffer('royal');h.c.openOutfitOffer('royal');
 assert.equal(h.timers.size,1);
 h.c.$('outfitOfferLater').onclick();assert.equal(h.timers.size,0);assert.equal(h.c.S.outfit,undefined);
 h.c.openOutfitOffer('royal');h.c.$('outfitOfferWear').onclick();
 assert.equal(h.timers.size,0);assert.equal(h.c.S.outfit,'royal');
 h.c.openOutfitOffer('royal');h.c.S=hero({race:'orc',city:{crowned:true}});h.load();h.tick();
 assert.equal(h.draws.length,0);assert.equal(h.timers.size,0);
 h.c.openOutfitOffer('royal');assert.equal(h.draws.length,1,'warm art draws immediately');
});

test('Outfits waits for PNGs without fallback figures or rebuilding the cards, including on reopen',()=>{
 const h=offerHarness({ritualDone:true}),c=h.c,body=c.$('outfitBody');
 const portraits=['default','ice','royal'].map(id=>({width:150,height:190,dataset:{outfitPortrait:id},getContext:c.$('outfitOfferPortrait').getContext}));
 let builds=0,open=true;
 Object.defineProperty(body,'innerHTML',{set(){builds++;}});
 body.querySelectorAll=selector=>selector==='[data-outfit-portrait]'?portraits:[];
 c.$('p-outfits').classList={contains:()=>open};c.esc=s=>s;c.openTab=()=>{open=false;};
 vm.runInContext(source.slice(source.indexOf('let outfitPortraitTimer='),source.indexOf('let outfitOfferPaintTimer=')),c);
 c.renderOutfits();
 assert.equal(builds,1);assert.equal(h.draws.length,0);assert.equal(h.timers.size,1);
 h.tick();assert.equal(builds,1);assert.equal(h.draws.length,0);
 h.load();h.tick();
 assert.equal(builds,1,'loading does not replace the cards');
 assert.deepEqual(h.draws.map(draw=>draw[10]),[false,true,'royal']);
 assert.equal(h.timers.size,0);
 c.$('outfitBack').onclick();open=true;c.renderOutfits();
 assert.equal(builds,2);assert.equal(h.draws.length,6,'cached PNGs paint immediately on reopen');
 assert.equal(h.timers.size,0);
});

test('Outfits cancels superseded loads and never paints a different hero into old cards',()=>{
 const h=offerHarness(),c=h.c;
 c.$('outfitBody').querySelectorAll=selector=>selector==='[data-outfit-portrait]'?[{...c.$('outfitOfferPortrait'),dataset:{outfitPortrait:'default'}}]:[];
 c.$('p-outfits').classList={contains:()=>true};c.esc=s=>s;c.openTab=()=>{};
 vm.runInContext(source.slice(source.indexOf('let outfitPortraitTimer='),source.indexOf('let outfitOfferPaintTimer=')),c);
 c.renderOutfits();c.renderOutfits();assert.equal(h.timers.size,1);
 c.$('outfitBack').onclick();assert.equal(h.timers.size,0);
 c.renderOutfits();c.S=hero({race:'orc'});h.load();h.tick();
 assert.equal(h.draws.length,0);assert.equal(h.timers.size,0);
});
