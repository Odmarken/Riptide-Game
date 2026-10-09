/* 🗡 The weapon on the back and ⏸ Space (asked for 2026-10-09: "hölstra vapen på H knappen, alla vapen ska kunna sitta på
   ryggen, som ena glaiven på warrior i felglaive", "när man mountar ska man hölstra automatiskt, och går man i combat med
   hölstrat vapen ska man ta fram dom automatiskt", "space knappen pausar spelet och sen resume"). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
function section(start, end) {
  const a = game.indexOf(start), b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
  return game.slice(a, b);
}

test('H puts the weapon on the back and takes it out; a hidden weapon, a fishing rod or the dead do not', () => {
  const msgs = [];
  const box = vm.createContext({ gameOn: true, S: { hideWeapon: false }, hero: { dead: false }, fish: { on: false }, stageMsg: m => msgs.push(m) });
  vm.runInContext(section('function setHolster(on,quiet){', 'function toggleMount(){'), box);
  vm.runInContext('toggleHolster()', box); assert.equal(box.hero.holster, true); assert.equal(msgs.at(-1), 'Weapon on your back');
  vm.runInContext('toggleHolster()', box); assert.equal(box.hero.holster, false); assert.equal(msgs.at(-1), 'Weapon drawn');
  box.S.hideWeapon = true; vm.runInContext('toggleHolster()', box); assert.equal(box.hero.holster, false, 'a hidden weapon has nothing to put away');
  box.S.hideWeapon = false; box.fish.on = true; vm.runInContext('toggleHolster()', box); assert.equal(box.hero.holster, false);
  box.fish.on = false; vm.runInContext('setHolster(true,true)', box); const n = msgs.length;
  vm.runInContext('drawWeapons()', box); assert.equal(box.hero.holster, false, 'a fight takes it out'); assert.equal(msgs.length, n, 'quietly');
});

test('saddling up puts it away; a swing, a spell or a blow taken takes it out', () => {
  assert.ok(game.includes('{const was=mountRide.id;Mounts.tick(mountRide,S,{zone:zoneOf(),hero,paused:gamePaused},dt);if(!was&&mountRide.id)setHolster(true,true);}'));
  assert.match(section('function heroSwing(', '\n}'), /drawWeapons\(\)/);
  assert.match(section('function hurtHero(', '\n}'), /if\(hero\.dead\)return;\n drawWeapons\(\);/);
  assert.match(section('function cast(i,manual){', '\n}\n'), /drawWeapons\(\);[^]*?return true;$/, 'only a spell that is really cast');
});

test('a tap on Space pauses and goes on through the pause button, held it still dances; H toggles - after the windows and the raid that own those keys', () => {
  const keys = section("window.addEventListener('keydown',e=>{", "window.addEventListener('keyup'");
  const space = keys.indexOf("if(kl===' '&&gameOn&&S&&!$('cfgBox')?.classList.contains('open')){"), h = keys.indexOf("if(kl==='h'&&gameOn&&S){");
  assert.ok(space > 0 && h > 0);
  for (const before of ['finalIntroNext()', 'casinoWinOpen(true)', 'raidKeyDown(kl,e)', 'TideUI.isBattling()']) assert.ok(keys.indexOf(before) < space, before + ' keeps its Space');
  assert.match(keys.slice(space, space + 420), /if\(!e\.repeat\)\{keys\.spaceAt=Date\.now\(\);if\(!gamePaused\)keys\[' '\]=true;\}/, 'held, still the dance');
  const up = section("window.addEventListener('keyup',e=>{", '\n});');
  assert.match(up, /if\(gameOn&&S&&\(gamePaused\|\|held<260\)&&!\$\('cfgBox'\)\.classList\.contains\('open'\)\)\$\('musBtn'\)\.click\(\);/, 'a tap pauses on its release; paused, any release goes on');
  assert.ok(game.includes("if(keys[' ']&&!hero.moving&&Date.now()-(keys.spaceAt||0)>=260){"), 'the dance waits a quarter second, so a tap does not flicker into one');
  assert.match(keys.slice(h, h + 160), /if\(!e\.repeat&&!gamePaused\)toggleHolster\(\);/);
  const rows = section("const rows=[\n  ['head','Moving'],", '];');
  assert.ok(rows.includes("['H','Put your weapon on your back, or take it out.") && rows.includes("['Space','Tap: pause the game, tap again to go on. Hold: dance']"));
});

test('on the back like the spare Fel Glaive, nothing in the hand; the warrior\'s pair takes both shoulders, the second mirrored', () => {
  const champ = section('function drawChampionSprite(', '\n/* 🛡 The warrior');
  assert.ok(champ.startsWith('function drawChampionSprite(g,raceId,clsId,fx,by,swing,fm,weaponId,female,painted,iceArm,rune,riding,effectTime,holster){'));
  assert.ok(champ.indexOf('if(holstered)drawHolstered(') < champ.indexOf('const frame=painted?paintedCharacterFrame('), 'behind the body');
  assert.ok(champ.includes("if(weaponId==='hidden'||holstered)return null;"), 'no weapon in the hand, no shield on the arm');
  const back = section('function drawHolstered(', '\nfunction drawChampionSprite(');
  assert.match(back, /g\.translate\(7,-34\+by\);g\.scale\(-1,1\);g\.rotate\(1\.22\);/, 'the spare glaive (-7, rotate 1.22) mirrored on the right shoulder');
  assert.match(back, /warriorShieldOn\(clsId,fm,weaponId\)/, 'the shield goes on the back with the sword');
  const art = section('function backWeaponArt(', '\nfunction drawHolstered(');
  for (const img of ['staffImg', 'maceImg', 'bowImg', 'swordImg', 'fkArtFor', 'fgArtFor']) assert.ok(art.includes(img), img);
});

test('raid-mates see it: the position message carries hl and the ghost draws it', () => {
  assert.match(game, /rtcBroadcast\(\{k:'pos',[^}]*,hl:hero\.holster\?1:0\},false\)/);
  assert.ok(game.includes('p.hl=m.hl?1:0;'));
  assert.ok(game.includes('attacking:!!p.atk,fxAura,holster:!!p.hl}'));
  assert.ok(game.includes('look.hw?null:wenchById(look.wench),null,undefined,!!anim.holster);'));
  assert.ok(game.includes("wRune,ride,undefined,!!h.holster);") && game.includes("outfitArg(),wRune,null,undefined,!!h.holster);"), 'the hero, on foot and in the saddle');
});
