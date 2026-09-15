const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function harness() {
 const saves = [], buildPauses = [];
 let active = false, callback;
 const noop = () => {};
 const context = vm.createContext({
  S: {name:'New hero'}, keys:{w:true}, hero:{x:40,y:100,moveTo:{x:1},target:{}}, holdMove:{}, marker:{},
  world:{w:2400,h:1600},VW:800,VH:600,zoom:1,
  gameOn:false, gamePaused:false, audioPaused:false,
  $: () => ({style:{},classList:{remove:noop}}),
  HeroGuide: {isOpen:()=>active,open(options){active=true;callback=options.onReady;},close(){active=false;}},
  openTab:noop,resize:noop,setZoom:noop,zmin:()=>1,applyZoneUI:noop,
  buildZone:()=>buildPauses.push(context.gamePaused),buildSkillbar:noop,renderHUD:noop,
  syncAudioUI:noop,applyVolumes:noop,setTimeout:noop,preloadMaps:noop,bankTick:noop,smithTick:noop,
  log:noop,stageMsg:noop,classOf:()=>({name:'Warrior'}),zoneOf:()=>({name:'Fields'}),
  save:()=>saves.push({...context.S}),saveNow:()=>saves.push({...context.S})
 });
 vm.runInContext(section('let heroGuideOwner=null;', '// The guide pauses all gameplay'), context);
 vm.runInContext(section('function beginGame(isNew){', '/* Effects were written as'), context);
 return {context,saves,buildPauses,run:code=>vm.runInContext(code,context),ready:()=>callback(),callback:()=>callback};
}

test('new hero pauses before building the world and persists an unfinished guide', () => {
 const h=harness();h.run('beginGame(true)');
 assert.deepEqual(h.buildPauses,[true]);
 assert.equal(h.context.gameOn,true);
 assert.equal(h.context.gamePaused,true);
 assert.equal(h.context.HeroGuide.isOpen(),true);
 assert.ok(h.saves.length>0 && h.saves.every(s=>s.introPending===true));
});

test('existing hero is not interrupted, while an unfinished guide resumes after reload', () => {
 const h=harness();h.run('beginGame(false)');
 assert.equal(h.context.HeroGuide.isOpen(),false);
 h.context.S.introPending=true;h.run('beginGame(false)');
 assert.equal(h.context.HeroGuide.isOpen(),true);
 assert.equal(h.context.gamePaused,true);
});

test('Ready completes the guide once, saves it and resumes the game', () => {
 const h=harness();h.run('beginGame(true)');const callback=h.callback();callback();
 assert.equal(h.context.S.introPending,false);
 assert.equal(h.context.gamePaused,false);
 assert.equal(h.context.HeroGuide.isOpen(),false);
 assert.equal(h.saves.at(-1).introPending,false);
 const count=h.saves.length;callback();assert.equal(h.saves.length,count);
 h.run('beginGame(false)');assert.equal(h.context.HeroGuide.isOpen(),false);
});

test('dismissing for character selection does not complete the guide', () => {
 const h=harness();h.run('beginGame(true);dismissHeroGuide()');
 assert.equal(h.context.S.introPending,true);
 assert.equal(h.context.HeroGuide.isOpen(),false);
 h.run('beginGame(false)');assert.equal(h.context.HeroGuide.isOpen(),true);
});

test('a stale Ready callback cannot complete a different character', () => {
 const h=harness();h.run('beginGame(true)');const oldHero=h.context.S,callback=h.callback();
 h.run('dismissHeroGuide();S={name:"Other hero"}');callback();
 assert.equal(oldHero.introPending,true);
 assert.equal(h.context.S.introPending,undefined);
 h.run('beginGame(true)');callback();
 assert.equal(h.context.S.introPending,true);
 assert.equal(h.context.HeroGuide.isOpen(),true);
 assert.equal(h.context.gamePaused,true);
});

test('explicit manual pause is retained on guide dismissal', () => {
 const h=harness();h.context.audioPaused=true;h.run('beginGame(true)');h.ready();
 assert.equal(h.context.gamePaused,true);
 assert.equal(h.context.audioPaused,true);
});

test('guide clears held movement and combat targets before resuming', () => {
 const h=harness();h.run('gameOn=true;showHeroGuide()');
 assert.deepEqual(Object.keys(h.context.keys),[]);
 assert.equal(h.context.hero.moveTo,null);
 assert.equal(h.context.hero.target,null);
 assert.equal(h.context.holdMove,null);
 assert.equal(h.context.marker,null);
 h.context.keys.d=true;h.context.hero.moveTo={x:5};h.ready();
 assert.deepEqual(Object.keys(h.context.keys),[]);
 assert.equal(h.context.hero.moveTo,null);
});

test('paused introduction frames the hero inside the world without a simulation tick', () => {
 const h=harness();h.run('showHeroGuide()');
 assert.equal(h.context.camX,0);assert.equal(h.context.camY,0);
 h.context.world={w:400,h:300};h.run('positionHeroGuideCamera()');
 assert.equal(h.context.camX,-200);assert.equal(h.context.camY,-150);
});
