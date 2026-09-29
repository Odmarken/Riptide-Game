const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/tides/core.js');
const B = require('../assets/tides/breeding.js');
const G = require('../assets/tides/guild.js');
const clone = v => JSON.parse(JSON.stringify(v));
function collection() {
  const c = T.createCollection(); T.purchaseLasso(c, 10000, {rng: () => 0}); return c;
}
function capture(c, speciesId = 'meadowmouse', outcome = 'win') {
  const result = T.beginBattle(c, {speciesId, level: 1}, {now: 1000});
  assert.equal(result.ok, true, JSON.stringify(result));
  result.battle.outcome = outcome;
  return {battle: result.battle, result: T.finishBattle(c, result.battle, {now: 2000})};
}

test('Trainer thresholds unlock exactly one new capture tier, with breeding at level four', () => {
  const c = collection();
  assert.deepEqual(T.TRAINER_RANKS.map(r => r.xp), [0, 100, 350, 800, 1600]);
  assert.equal(c.trainer.xp, 0, 'buying a starter grants no Trainer XP');
  for (const rank of T.TRAINER_RANKS) {
    for (const xp of [rank.xp, (T.TRAINER_RANKS[rank.level]?.xp || 1601) - 1]) {
      c.trainer.xp = xp;
      assert.equal(T.trainerView(c).level, rank.level);
      assert.equal(T.canBreed(c), rank.level >= 4);
      for (const s of T.catalog) {
        assert.equal(T.canCapture(c, s.id), s.stars <= rank.level);
        const before = clone(c), r = T.beginBattle(c, {speciesId: s.id, level: 1});
        assert.equal(r.ok, s.stars <= rank.level);
        if (!r.ok) { assert.equal(r.reason, 'trainer-level'); assert.deepEqual(c, before); }
        else T.abandonBattle(c, r.battle);
      }
    }
  }
  assert.equal(T.canCapture(c, T.getHybrid('meadowmouse', 'bramblebunny').id), false);
});

test('wild capture XP, discovery bonus, promotion and settlement are persisted exactly once', () => {
  let c = collection();
  c = T.normalizeCollection(clone(c));
  let {result, battle} = capture(c);
  assert.equal(result.trainer.xp, 30); assert.equal(result.trainer.discovery, true);
  assert.equal(T.finishBattle(c, battle).reason, 'settled'); assert.equal(c.trainer.xp, 30);
  c = T.normalizeCollection(clone(c));
  result = capture(c).result;
  assert.equal(result.trainer.xp, 10); assert.equal(result.trainer.discovery, false);
  capture(c, 'bramblebunny');
  result = capture(c, 'pebbletoad').result;
  assert.equal(c.trainer.xp, 100); assert.equal(result.trainer.levels, 1);
  assert.equal(T.trainerView(c).level, 2);
  assert.equal(capture(c, 'mossfox').result.trainer.xp, 60);
  assert.equal(capture(c, 'mossfox').result.trainer.xp, 20);
  for (const outcome of ['loss', 'draw']) {
    const before = clone(c.trainer); capture(c, 'meadowmouse', outcome); assert.deepEqual(c.trainer, before);
  }
  const before = clone(c.trainer), practice = G.start(c, {rng: () => .99});
  assert.equal(practice.ok, true); practice.battle.outcome = 'win';
  G.finishRound(c, practice.series, practice.battle);
  assert.deepEqual(c.trainer, before, 'high-star guild practice gives no capture or standing');
});

test('all five levels remain reachable with repeat catches and discovery rewards shorten the journey', () => {
  const repeat = collection(); let captures = 0;
  while (T.trainerView(repeat).level < 5) { capture(repeat); assert.ok(++captures <= 160); }
  assert.equal(captures, 158);
  const varied = collection(); let count = 0, seed = 271;
  while (T.trainerView(varied).level < 5) {
    const allowed = T.catalog.filter(s => T.canCapture(varied, s.id));
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    capture(varied, allowed[seed % allowed.length].id); assert.ok(++count < captures);
  }
  assert.ok(count < 65 && count >= 25, 'a varied journey is measured in dozens of captures');
  assert.equal(varied.trainer.xp, 1600);
  assert.equal(capture(varied).result.trainer.xp, 0);
});

test('old saves keep all Tides but start at novice; malformed standing is bounded and discoveries survive reload', () => {
  const c = collection(); c.pets[0].speciesId = 'spectralwyrm'; delete c.trainer;
  const loaded = T.normalizeCollection(c);
  assert.equal(T.trainerView(loaded).level, 1); assert.equal(loaded.pets[0].speciesId, 'spectralwyrm');
  assert.deepEqual(loaded.trainer.discovered, ['spectralwyrm']);
  for (const xp of [NaN, Infinity, -200, '1600', null]) assert.equal(T.trainerView(T.normalizeCollection({...c, trainer: {xp}})).level, 1);
  assert.equal(T.trainerView(T.normalizeCollection({...c, trainer: {xp: 1e12}})).level, 5);
});

test('breeding, revealing and claiming require level four, award no Trainer XP and preserve existing jobs', () => {
  const c = collection(); c.pets.push({...clone(c.pets[0]), id: 'tide-2', speciesId: 'bramblebunny'}); c.nextId = 3;
  const options = {stationId: 'nursery', parentAId: 'tide-1', parentBId: 'tide-2', now: 1000, rng: () => .5};
  c.trainer.xp = 799; const before = clone(c);
  assert.equal(T.startBreeding(c, options).reason, 'trainer-level'); assert.deepEqual(c, before);
  c.trainer.xp = 800; assert.equal(T.startBreeding(c, options).ok, true);
  const job = clone(c.breedingJobs[0]); c.trainer.xp = 0;
  assert.equal(T.revealBreeding(c, 'nursery', {now: 61000}).reason, 'trainer-level');
  assert.equal(T.claimBreeding(c, 'nursery', {now: 61000}).reason, 'trainer-level');
  assert.deepEqual(T.normalizeCollection(c, 61000).breedingJobs[0], job);
  c.trainer.xp = 800; T.revealBreeding(c, 'nursery', {now: 61000});
  assert.equal(T.claimBreeding(c, 'nursery', {now: 61000}).ok, true); assert.equal(c.trainer.xp, 800);
});

test('six-star chance is exactly one independent 1-in-10000 roll for every original pair', () => {
  assert.equal(B.CONFIG.SIX_STAR_CHANCE, .0001);
  for (let a = 0; a < T.catalog.length; a++) for (let b = a + 1; b < T.catalog.length; b++) {
    const x = T.catalog[a], y = T.catalog[b];
    for (const ticket of [0, .0000999999, .0001, .5, .999999]) for (const count of [0, .5, .999999]) {
      let i = 0;
      const m = B.rollMutations(x.spectral || y.spectral, () => i++ === 0 ? ticket : count, (x.stars + y.stars) / 2);
      assert.equal(m.sixStar, ticket < .0001, x.id + ' x ' + y.id);
      assert.ok(B.mutationSummary(m).count <= 8);
    }
  }
});

test('every six-star hybrid exceeds every fully stat-mutated lower tier at the same combat level', () => {
  for (const level of [1, 10, 20, 30]) {
    const ordinary = T.allSpecies().map(s => ({
      hp: T.stats({speciesId: s.id, level, mutations: {hp: 8}}).maxHp,
      atk: T.stats({speciesId: s.id, level, mutations: {attack: 8}}).atk,
      power: T.stats({speciesId: s.id, level, mutations: {power: 8}}).powerMultiplier
    }));
    const maxHp = Math.max(...ordinary.map(s => s.hp)), maxAtk = Math.max(...ordinary.map(s => s.atk));
    for (const s of T.allSpecies().filter(s => s.hybrid)) {
      const mutant = T.stats({speciesId: s.id, level, mutations: {sixStar: true}});
      assert.ok(mutant.maxHp > maxHp && mutant.atk > maxAtk && mutant.powerMultiplier > 1.4, s.id);
    }
  }
});
