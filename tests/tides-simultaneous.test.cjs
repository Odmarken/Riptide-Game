const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const T = require('../assets/tides/core.js');
const clone = value => JSON.parse(JSON.stringify(value));
function duel(player = 'meadowmouse', foe = player, rules = T) {
  const c = rules.createCollection();
  rules.purchaseLasso(c, 10000, {rng: () => 0, now: 1000});
  c.pets[0].speciesId = player; c.pets[0].level = 10;
  const battle = rules.beginBattle(c, {speciesId: foe, level: 10}, {rng: () => .25, now: 2000}).battle;
  return {c, battle};
}
function act(battle, action = 'attack', rules = T) { return rules.act(battle, action, {rng: () => .5}); }
function attacks(battle) { for (const unit of [battle.player, battle.foe]) unit.powerCooldown = 1; }
function loadedInjuries() {
  const context = vm.createContext({TidesCatalog: T.catalog});
  const source = fs.readFileSync(path.join(__dirname, '../assets/tides/core.js'), 'utf8')
    .replace('const INJURY_MS = 0;', 'const INJURY_MS = 2 * 60 * 60 * 1000;');
  vm.runInContext(source, context); return context.Tides;
}

test('identical lethal hits both execute and produce a draw instead of a player-first victory', () => {
  const {battle} = duel(); attacks(battle);
  for (const unit of [battle.player, battle.foe]) { unit.hp = 10; unit.atk = 100; }
  const result = act(battle);
  assert.equal(result.outcome, 'draw'); assert.equal(battle.player.hp, 0); assert.equal(battle.foe.hp, 0);
  assert.deepEqual(result.events.filter(e => e.type === 'attack').map(e => e.side), ['player', 'foe']);
  for (const event of result.events.filter(e => e.type !== 'result')) {
    assert.equal(event.actionSide, ['player', 'foe'][event.actionIndex]);
    assert.ok(event.amount >= 0 && Number.isFinite(event.amount));
  }
});

test('every original power mirrors identically when the two round-start combatants exchange sides', () => {
  for (const a of T.catalog) for (const b of T.catalog) {
    const {battle} = duel(a.id, b.id);
    for (const [index, unit] of [battle.player, battle.foe].entries()) Object.assign(unit, {
      hp: Math.round(unit.maxHp * .45), shield: index ? 6 : 11, buff: index ? .2 : .35, buffTurns: 2,
      weaken: index ? .1 : .25, weakenTurns: 2, poison: index ? 3 : 5, poisonTurns: 2});
    const mirrored = clone(battle); [mirrored.player, mirrored.foe] = [mirrored.foe, mirrored.player];
    act(battle, 'power'); act(mirrored, 'power');
    assert.deepEqual(battle.player, mirrored.foe, a.id + ' / ' + b.id + ' player');
    assert.deepEqual(battle.foe, mirrored.player, a.id + ' / ' + b.id + ' foe');
    assert.equal(mirrored.outcome, battle.outcome === 'win' ? 'loss' : battle.outcome === 'loss' ? 'win' : battle.outcome);
  }
});

test('a selected heal combines with simultaneous damage and saves either side from an otherwise lethal hit', () => {
  const {battle} = duel('bramblebunny', 'meadowmouse');
  Object.assign(battle.player, {maxHp: 100, hp: 10, atk: 0});
  Object.assign(battle.foe, {maxHp: 100, hp: 100, atk: 15, powerCooldown: 1});
  const mirrored = clone(battle); [mirrored.player, mirrored.foe] = [mirrored.foe, mirrored.player];
  const result = act(battle, 'power'); act(mirrored, 'attack');
  assert.equal(battle.player.hp, 7); assert.equal(mirrored.foe.hp, 7);
  assert.equal(result.outcome, null); assert.ok(result.events.some(e => e.type === 'heal' && e.amount === 12));
  const incoming = result.events.find(e => e.type === 'damage' && e.targetSide === 'player');
  assert.match(incoming.text, /takes 15 damage/); assert.equal(incoming.amount, 10, 'capped legacy amount does not underreport the damage in the log');
  assert.deepEqual(battle.player, mirrored.foe);
});

test('healing prevents simultaneous damage at full HP without exceeding the health cap', () => {
  const {battle} = duel('bramblebunny', 'meadowmouse');
  Object.assign(battle.player, {maxHp: 100, hp: 100, atk: 0});
  Object.assign(battle.foe, {maxHp: 100, hp: 100, atk: 15, powerCooldown: 1});
  act(battle, 'power'); assert.equal(battle.player.hp, 97);
  battle.player.powerCooldown = 0; battle.foe.atk = 0; battle.foe.powerCooldown = 1;
  const result = act(battle, 'power'); assert.equal(battle.player.hp, 100);
  assert.equal(result.events.find(e => e.type === 'heal').amount, 3);
});

test('new shields absorb this round on both sides while new buffs and weakening affect the next round', () => {
  const {battle} = duel('pebbletoad', 'meadowmouse');
  Object.assign(battle.player, {maxHp: 100, hp: 100, atk: 10});
  Object.assign(battle.foe, {maxHp: 100, hp: 100, atk: 20, powerCooldown: 1});
  act(battle, 'power'); assert.equal(battle.player.hp, 95); assert.equal(battle.player.shield, 0);
  assert.equal(battle.player.buff, .4); assert.equal(battle.player.buffTurns, 2);
  battle.foe.powerCooldown = 1;
  const next = act(battle); assert.equal(next.events.find(e => e.type === 'damage' && e.side === 'player').amount, 14);
  assert.equal(battle.player.buffTurns, 1);
  const frost = duel('frostibex', 'meadowmouse').battle;
  Object.assign(frost.player, {hp: 100, atk: 10}); Object.assign(frost.foe, {hp: 100, atk: 20, powerCooldown: 2});
  act(frost, 'power'); assert.equal(frost.player.hp, 80); assert.equal(frost.foe.weakenTurns, 1);
  act(frost); assert.equal(frost.player.hp, 68); assert.equal(frost.foe.weakenTurns, 0);
});

test('lethal old poison ticks once but never cancels either committed action', () => {
  const {battle} = duel(); attacks(battle);
  for (const unit of [battle.player, battle.foe]) Object.assign(unit, {hp: 1, atk: 20, poison: 10, poisonTurns: 1});
  const result = act(battle);
  assert.equal(result.outcome, 'draw'); assert.equal(result.events.filter(e => e.type === 'attack').length, 2);
  assert.equal(result.events.filter(e => e.type === 'poison').length, 2);
  for (const unit of [battle.player, battle.foe]) { assert.equal(unit.poison, 0); assert.equal(unit.poisonTurns, 0); }
  assert.ok(result.events.filter(e => e.type === 'poison').every(e => e.actionSide === e.targetSide));
});

test('poison overkill combines with healing using the same unclamped damage rule as direct hits', () => {
  for (const poison of [5, 100]) {
    const {battle} = duel('bramblebunny', 'meadowmouse');
    Object.assign(battle.player, {maxHp: 100, hp: 1, atk: 0, poison, poisonTurns: 1});
    Object.assign(battle.foe, {atk: 0, powerCooldown: 1});
    const result = act(battle, 'power');
    assert.equal(battle.player.hp, poison === 5 ? 8 : 0);
    assert.equal(result.events.filter(e => ['attack', 'power'].includes(e.type)).length, 2);
    const tick = result.events.find(e => e.type === 'poison');
    assert.match(tick.text, new RegExp('takes ' + poison + ' lingering damage')); assert.equal(tick.amount, 1);
    assert.ok(result.events.every(e => e.amount >= 0));
  }
});

test('cleanse removes remaining old poison, while newly inflicted poison starts next round regardless of visual order', () => {
  const {battle} = duel('reedotter', 'amberbeetle');
  for (const unit of [battle.player, battle.foe]) Object.assign(unit, {maxHp: 100, hp: 50, atk: 10});
  Object.assign(battle.player, {poison: 3, poisonTurns: 2});
  const result = act(battle, 'power');
  assert.equal(result.events.filter(e => e.type === 'poison').length, 1);
  assert.equal(battle.player.poison, 4); assert.equal(battle.player.poisonTurns, 2);
  const next = act(battle); assert.equal(next.events.find(e => e.type === 'poison').amount, 4);
  assert.equal(battle.player.poisonTurns, 1);
});

test('AI chooses from round-start HP rather than reacting to damage that has not happened yet', () => {
  const {battle} = duel('meadowmouse', 'bramblebunny');
  battle.player.atk = 35;
  const result = act(battle);
  assert.equal(result.events.find(e => e.side === 'foe' && ['attack', 'power'].includes(e.type)).type, 'attack');
  battle.foe.powerCooldown = 0;
  const next = act(battle);
  assert.equal(next.events.find(e => e.side === 'foe' && ['attack', 'power'].includes(e.type)).type, 'power');
});

test('equal remaining health at the turn limit draws; unequal health retains the existing ratio tiebreak', () => {
  for (const [playerHp, foeHp, outcome] of [[50, 50, 'draw'], [51, 50, 'win'], [49, 50, 'loss']]) {
    const {battle} = duel(); attacks(battle); battle.turn = 60;
    Object.assign(battle.player, {hp: playerHp, maxHp: 100, atk: 0}); Object.assign(battle.foe, {hp: foeHp, maxHp: 100, atk: 0});
    assert.equal(act(battle).outcome, outcome);
  }
});

test('wild draw clears provisional injuries without capturing, XP or a second settlement, including restored injury rules', () => {
  for (const rules of [T, loadedInjuries()]) {
    const {c, battle} = duel('meadowmouse', 'meadowmouse', rules);
    const pet = c.pets[0], originalXp = pet.xp, count = c.pets.length;
    assert.equal(pet.injuredUntil, rules.INJURY_MS ? 7202000 : 0);
    attacks(battle); for (const unit of [battle.player, battle.foe]) { unit.hp = 1; unit.atk = 100; }
    assert.equal(act(battle, 'attack', rules).outcome, 'draw');
    const result = rules.finishBattle(c, battle, {now: 5000});
    assert.equal(result.ok, true); assert.equal(result.outcome, 'draw'); assert.equal(result.captured, null);
    assert.equal(result.xp, 0); assert.equal(result.levels, 0); assert.equal(pet.xp, originalXp);
    assert.equal(pet.injuredUntil, 0); assert.equal(c.pets.length, count); assert.equal(c.activeBattle, null);
    assert.equal(rules.finishBattle(c, battle).reason, 'settled');
    assert.equal(rules.normalizeCollection(clone(c), 6000).pets[0].injuredUntil, 0);
  }
});

test('invalid choices do not spend either action or RNG and persisted battle copies replay both sides deterministically', () => {
  const {battle} = duel('spectralpanther', 'dawnphoenix');
  battle.player.powerCooldown = 1;
  const saved = clone(battle), unused = () => { throw Error('invalid action must not consume RNG'); };
  assert.equal(T.act(battle, 'power', {rng: unused}).reason, 'cooldown');
  assert.equal(T.act(battle, 'wrong', {rng: unused}).reason, 'action');
  assert.deepEqual(battle, saved);
  assert.deepEqual(T.act(battle, 'attack'), T.act(saved, 'attack')); assert.deepEqual(battle, saved);
});
