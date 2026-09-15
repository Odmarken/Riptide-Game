const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../assets/tides/core.js');
const B = require('../assets/tides/breeding.js');
const clone = value => JSON.parse(JSON.stringify(value));
function collection(ids = ['bramblebunny', 'pebbletoad']) {
  const c = T.createCollection();
  T.purchaseLasso(c, 10000, {now: 100, rng: () => 0});
  c.pets = ids.map((speciesId, i) => ({...clone(c.pets[0]), speciesId, id: 'tide-' + (i + 1), level: 20}));
  c.nextId = ids.length + 1; c.equippedId = c.pets[0].id;
  return c;
}
function start(c, options = {}) {
  const result = T.startBreeding(c, {stationId: 'farm-house-1', parentAId: c.pets[0].id, parentBId: c.pets[1].id,
    now: 1000, rng: () => 0, ...options});
  assert.equal(result.ok, true, JSON.stringify(result)); return result.job;
}
function battle(pet, foe = 'obsidianbear') {
  const c = collection(); c.pets = [clone(pet)]; c.equippedId = pet.id;
  const result = T.beginBattle(c, {speciesId: foe, level: 30}, {now: 2000, rng: () => .2});
  assert.equal(result.ok, true); return result.battle;
}
const hybrid = (a, b) => T.getHybrid(a, b);

test('all300 unordered original pairs resolve to breeding-only hybrids with both specials and bounded effect budgets', () => {
  assert.equal(T.catalog.length, 25); assert.equal(T.allSpecies().length, 325);
  const seen = new Set();
  for (let i = 0; i < 25; i++) for (let j = i + 1; j < 25; j++) {
    const a = T.catalog[i], b = T.catalog[j], h = hybrid(a.id, b.id), s = T.getSkill(h);
    assert.ok(h?.hybrid); assert.equal(hybrid(b.id, a.id), h); seen.add(h.id);
    assert.equal(h.encounterWeight, 0); assert.ok(h.stars >= 1 && h.stars <= 5);
    assert.equal(h.spectral, a.spectral || b.spectral);
    assert.deepEqual(s.parentNames, [a.skill.name, b.skill.name]);
    for (const key of ['damage', 'missingHpBonus', 'heal', 'missingHeal', 'shield', 'buff', 'weaken', 'poison', 'recoil', 'drain', 'pierce']) {
      if (a.skill[key] || b.skill[key]) assert.ok(s[key] > 0, `${h.id} retains ${key}`);
    }
    if (a.skill.cleanse || b.skill.cleanse) assert.equal(s.cleanse, true);
    if (a.skill.hits === 2 || b.skill.hits === 2) assert.equal(s.hits, 2);
    assert.ok((s.damage || 0) <= Math.max(a.skill.damage || 0, b.skill.damage || 0));
    assert.ok((s.heal || 0) <= .2 && (s.shield || 0) <= 1.5 && (s.buff || 0) <= .7 && (s.weaken || 0) <= .4);
    assert.ok((s.poison || 0) <= .45 && (s.poisonTurns || 0) <= 3);
    for (const value of Object.values(s)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
  }
  assert.equal(seen.size, 300);
  const c = collection(); for (let i = 0; i < 1000; i++) assert.equal(T.getSpecies(T.rollWild(c, {rng: () => i / 1000})).hybrid, undefined);
});

test('a60second real-time job persists its one result immediately but hides it until explicit ready reveal', () => {
  const c = collection(), parents = clone(c.pets), job = start(c);
  assert.equal(T.BREEDING_CONFIG.DURATION_MS, 60000); assert.equal(job.readyAt, 61000);
  assert.equal(job.phase, 'incubating'); assert.equal(job.offspring, null); assert.equal(c.pets.length, 2);
  assert.deepEqual(c.pets, parents); assert.ok(c.breedingJobs[0].offspring.speciesId.startsWith('hybrid-'));
  const selected = clone(c.breedingJobs[0].offspring);
  assert.equal(T.revealBreeding(c, job.stationId, {now: 60999}).reason, 'early');
  assert.equal(T.claimBreeding(c, job.stationId, {now: 61000}).reason, 'unrevealed');
  assert.equal(T.breedingStatus(c, job.stationId, 61000).phase, 'ready');
  assert.equal(T.breedingStatus(c, job.stationId, 61000).offspring, null);
  const loaded = T.normalizeCollection(clone(c), 120000);
  assert.deepEqual(loaded.breedingJobs[0].offspring, selected); assert.equal(loaded.breedingJobs[0].readyAt, 61000);
  const revealed = T.revealBreeding(loaded, job.stationId, {now: 120000, jobId: job.id});
  assert.deepEqual(revealed.pet, selected); assert.equal(revealed.job.phase, 'revealed');
  revealed.pet.mutations.hp = 8;
  assert.deepEqual(loaded.breedingJobs[0].offspring, selected, 'public result cannot mutate the saved roll');
  const reloaded = T.normalizeCollection(clone(loaded), 120001);
  assert.deepEqual(T.breedingStatus(reloaded, job.stationId, 120001).offspring, selected);
  const claimed = T.claimBreeding(reloaded, job.stationId, {now: 120001, jobId: job.id});
  assert.equal(claimed.ok, true); assert.deepEqual(claimed.pet, selected); assert.equal(reloaded.pets.length, 3);
  assert.equal(T.breedingStatus(reloaded, job.stationId, 120001), null);
  assert.equal(T.claimBreeding(reloaded, job.stationId, {now: 120002}).reason, 'missing');
  assert.deepEqual(T.normalizeCollection(clone(reloaded), 130000).pets, reloaded.pets);
});

test('invalid pairs, occupied stations, active battles and locked parents reject atomically before rolling', () => {
  const failures = [
    [{stationId: ''}, 'station'], [{parentBId: 'tide-1'}, 'same'], [{parentBId: 'missing'}, 'unowned']
  ];
  for (const [extra, reason] of failures) {
    const c = collection(), before = clone(c);
    const result = T.startBreeding(c, {stationId: 'house', parentAId: 'tide-1', parentBId: 'tide-2', rng: () => {throw Error('must not roll');}, ...extra});
    assert.equal(result.reason, reason); assert.deepEqual(c, before);
  }
  const same = collection(['meadowmouse', 'meadowmouse']);
  assert.equal(T.startBreeding(same, {stationId: 'a', parentAId: 'tide-1', parentBId: 'tide-2'}).reason, 'same-species');
  const hybridParent = collection([hybrid('meadowmouse', 'bramblebunny').id, 'moonowl']);
  assert.equal(T.startBreeding(hybridParent, {stationId: 'a', parentAId: 'tide-1', parentBId: 'tide-2'}).reason, 'hybrid-parent');
  const c = collection(['bramblebunny', 'pebbletoad', 'moonowl', 'runestag']);
  c.activeBattle = {id: 'battle'};
  assert.equal(T.startBreeding(c, {stationId: 'a', parentAId: 'tide-1', parentBId: 'tide-2'}).reason, 'battle');
  c.activeBattle = null; start(c);
  assert.equal(T.startBreeding(c, {stationId: 'farm-house-1', parentAId: 'tide-3', parentBId: 'tide-4'}).reason, 'busy');
  assert.equal(T.startBreeding(c, {stationId: 'other-house', parentAId: 'tide-1', parentBId: 'tide-3'}).reason, 'parent-busy');
  assert.deepEqual(T.eligibleBreedingParents(c).map(p => p.id), ['tide-3', 'tide-4']);
  assert.equal(T.beginBattle(c, {speciesId: 'meadowmouse', level: 1}).reason, 'breeding');
  assert.equal(T.awardWorldXp(c, {eventId: 'mentor-xp'}).ok, true, 'locked parent can still receive passive world XP');
  assert.equal(T.startBreeding(c, {stationId: 'other-house', parentAId: 'tide-3', parentBId: 'tide-4', now: 1000}).ok, true);
  assert.equal(c.breedingJobs.length, 2);
});

test('reveal and claim are battle guarded; stale job IDs cannot claim a later offspring at the same station', () => {
  const c = collection(), first = start(c);
  c.activeBattle = {id: 'unrelated-battle'};
  assert.equal(T.revealBreeding(c, first.stationId, {now: 61000}).reason, 'battle');
  assert.equal(T.claimBreeding(c, first.stationId, {now: 61000}).reason, 'battle');
  c.activeBattle = null;
  T.revealBreeding(c, first.stationId, {now: 61000}); T.claimBreeding(c, first.stationId, {now: 61000});
  const second = start(c, {now: 62000, durationMs: 1000}); assert.notEqual(first.id, second.id);
  T.revealBreeding(c, second.stationId, {now: 63000}); const before = clone(c);
  assert.equal(T.claimBreeding(c, second.stationId, {now: 63000, jobId: first.id}).reason, 'settled');
  assert.deepEqual(c, before); assert.equal(T.claimBreeding(c, second.stationId, {now: 63000, jobId: second.id}).ok, true);
});

test('weighted mutation rolls range0–8, guarantee1–8 for either spectral parent, and six-star is an ultra-rare counted mutation', () => {
  assert.equal(B.mutationSummary(B.rollMutations(false, () => 0)).count, 0);
  assert.equal(B.mutationSummary(B.rollMutations(true, () => 0)).count, 1);
  const maximum = B.rollMutations(false, () => .999999999);
  assert.equal(B.mutationSummary(maximum).count, 8); assert.equal(maximum.sixStar, true); assert.equal(maximum.power, 7);
  for (const ids of [['spectralpanther', 'meadowmouse'], ['meadowmouse', 'spectralwyrm'], ['spectralpanther', 'spectralwyrm']]) {
    const c = collection(ids); start(c); assert.equal(T.mutationSummary(c.breedingJobs[0].offspring).count, 1);
  }
  let seed = 741852, zero = 0, six = 0;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 50000; i++) {
    const ordinary = B.rollMutations(false, rng), spectral = B.rollMutations(true, rng), count = B.mutationSummary(ordinary).count;
    if (!count) zero++; if (ordinary.sixStar) six++;
    assert.ok(count >= 0 && count <= 8); assert.ok(B.mutationSummary(spectral).count >= 1 && B.mutationSummary(spectral).count <= 8);
  }
  assert.ok(zero > 34000 && zero < 36000, 'zero mutations stays near70%, not uniform');
  assert.ok(six < 40, 'six-star is much rarer than ordinary mutations');
});

// Supply the count ticket once, then choose HP for every mutation type.
function countRoll(spectral, ticket, stars) {
  let first = true;
  const rng = () => first ? (first = false, ticket) : 0;
  return B.mutationSummary(stars === undefined ? B.rollMutations(spectral, rng) : B.rollMutations(spectral, rng, stars)).count;
}

test('the two-argument mutation API and explicit five stars retain the original count boundaries', () => {
  const ordinary = [.7, .88, .95, .978, .991, .997, .9992, .9999];
  const spectral = [.6, 2500 / 3000, 2780 / 3000, .97, .99, 2992 / 3000, 2999 / 3000];
  for (const [isSpectral, boundaries] of [[false, ordinary], [true, spectral]]) {
    for (const stars of [undefined, 5]) {
      assert.equal(countRoll(isSpectral, 0, stars), isSpectral ? 1 : 0);
      assert.equal(countRoll(isSpectral, .999999999, stars), 8);
      boundaries.forEach((threshold, i) => {
        const count = i + (isSpectral ? 1 : 0);
        assert.equal(countRoll(isSpectral, threshold - 1e-10, stars), count);
        assert.equal(countRoll(isSpectral, threshold + 1e-10, stars), count + 1);
      });
    }
  }
});

test('unrounded parental means give exact ordinary mutation chances from 70 percent to 30 percent', () => {
  const cases = [[1, .70], [1.5, .65], [2, .60], [2.5, .55], [3, .50], [3.5, .45], [4, .40], [4.5, .35], [5, .30]];
  for (const [stars, chance] of cases) {
    let mutated = 0;
    for (let i = 0; i < 2000; i++) if (countRoll(false, (i + .5) / 2000, stars)) mutated++;
    assert.equal(mutated, Math.round(chance * 2000), `${stars} parental stars`);
    assert.equal(countRoll(false, 1 - chance - 1e-10, stars), 0);
    assert.equal(countRoll(false, 1 - chance + 1e-10, stars), 1);
  }
});

test('lower-star partners shift positive mutation counts upward for ordinary and spectral offspring', () => {
  // Frozen positive-count CDFs for 1, 3.5 and 5 parental stars, before the zero outcome.
  const cases = [
    [1, .70, [.35650623885918004, .6337888690829867, .8001584472172707, .9031491384432561, .9625668449197861, .9887106357694593, .9984155278272925]],
    [3.5, .45, [.4776594686038412, .733074601121173, .8631041231299964, .9364115832421136, .9762165389591004, .9930009619530965, .9990380469035062]],
    [5, .30, [.6, 2500 / 3000, 2780 / 3000, .97, .99, 2992 / 3000, 2999 / 3000]]
  ];
  for (const [stars, chance, boundaries] of cases) for (const spectral of [false, true]) {
    const zero = spectral ? 0 : 1 - chance, positive = spectral ? 1 : chance;
    boundaries.forEach((threshold, i) => {
      const ticket = zero + positive * threshold;
      assert.equal(countRoll(spectral, ticket - 1e-10, stars), i + 1, `${stars}, spectral=${spectral}, below ${i + 2}`);
      assert.equal(countRoll(spectral, ticket + 1e-10, stars), i + 2, `${stars}, spectral=${spectral}, above ${i + 1}`);
    });
    assert.equal(countRoll(spectral, .999999999, stars), 8);
  }
  assert.equal(countRoll(true, .5, 5), 1);
  assert.equal(countRoll(true, .5, 3.5), 2, 'spectral guarantee retains the lower-parent multi-mutation bonus');
  assert.equal(countRoll(true, .7, 1), 3);
});

test('all300 actual breeding pairs use original species stars and produce identical mutations in either parent order', () => {
  let pairs = 0; const starPairs = new Set();
  for (let i = 0; i < T.catalog.length; i++) for (let j = i + 1; j < T.catalog.length; j++) {
    const a = T.catalog[i], b = T.catalog[j], avg = (a.stars + b.stars) / 2;
    starPairs.add([a.stars, b.stars].sort().join('+'));
    for (const ticket of [.325, .475, .525, .575, .625, .75, .95, .999999999]) {
      const expected = countRoll(a.spectral || b.spectral, ticket, avg);
      for (const reverse of [false, true]) {
        const c = collection([a.id, b.id]);
        c.pets[0].mutations = {hp: 0, attack: 0, power: 0, sixStar: true};
        c.pets[0].level = 30; c.pets[1].level = 1;
        let first = true;
        start(c, {parentAId: c.pets[reverse ? 1 : 0].id, parentBId: c.pets[reverse ? 0 : 1].id,
          rng: () => first ? (first = false, ticket) : 0});
        assert.equal(T.mutationSummary(c.breedingJobs[0].offspring).count, expected, `${a.id}+${b.id}, ticket ${ticket}, reverse=${reverse}`);
      }
    }
    pairs++;
  }
  assert.equal(pairs, 300); assert.equal(starPairs.size, 15);
});

test('five-plus-two has better mutation odds than five-plus-three despite both hybrids rounding to four stars', () => {
  const two = collection(['dawnphoenix', 'mossfox']), three = collection(['dawnphoenix', 'moonowl']);
  for (const c of [two, three]) { let first = true; start(c, {rng: () => first ? (first = false, .575) : 0}); }
  assert.equal(T.getSpecies(two.breedingJobs[0].offspring).stars, 4);
  assert.equal(T.getSpecies(three.breedingJobs[0].offspring).stars, 4);
  assert.equal(T.mutationSummary(two.breedingJobs[0].offspring).count, 1);
  assert.equal(T.mutationSummary(three.breedingJobs[0].offspring).count, 0);
});

test('mutation types and the single six-star limit remain unchanged across every parental mean', () => {
  assert.deepEqual(B.CONFIG.TYPE_WEIGHTS, {hp: 3333, attack: 3333, power: 3333, sixStar: 1});
  for (const stars of [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) for (const spectral of [false, true]) {
    const firstTicket = spectral ? 0 : .70 - (5 - stars) * .10 + 1e-8;
    for (const [ticket, type] of [[0, 'hp'], [.33329, 'hp'], [.33331, 'attack'], [.66659, 'attack'], [.66661, 'power'], [.99989, 'power'], [.99991, 'sixStar']]) {
      let first = true;
      const rolled = B.rollMutations(spectral, () => first ? (first = false, firstTicket) : ticket, stars);
      assert.equal(B.mutationSummary(rolled).count, 1);
      assert.equal(rolled[type], type === 'sixStar' ? true : 1);
    }
    const maximum = B.rollMutations(spectral, () => .999999999, stars);
    assert.deepEqual(maximum, {hp: 0, attack: 0, power: 7, sixStar: true});
  }
});

test('old pending ordinary and spectral results survive the balance change without rerolls during load, reveal or claim', () => {
  for (const [ids, mutations] of [
    [['dawnphoenix', 'meadowmouse'], {hp: 0, attack: 0, power: 0, sixStar: false}],
    [['spectralwyrm', 'meadowmouse'], {hp: 1, attack: 0, power: 0, sixStar: false}],
    [['spectralpanther', 'mossfox'], {hp: 2, attack: 2, power: 3, sixStar: true}]
  ]) {
    const c = collection(ids); start(c); c.breedingJobs[0].offspring.mutations = mutations;
    const saved = clone(c.breedingJobs[0]), random = Math.random;
    try {
      Math.random = () => {throw Error('persisted offspring must not reroll');};
      const pending = T.normalizeCollection(clone(c), 60000);
      assert.deepEqual(pending.breedingJobs[0], saved);
      const ready = T.normalizeCollection(clone(pending), 90000);
      assert.deepEqual(T.revealBreeding(ready, saved.stationId, {now: 90000}).pet, saved.offspring);
      const revealed = T.normalizeCollection(clone(ready), 90001);
      assert.deepEqual(T.claimBreeding(revealed, saved.stationId, {now: 90001}).pet, saved.offspring);
      assert.deepEqual(revealed.pets.at(-1), saved.offspring);
    } finally { Math.random = random; }
  }
});

test('only the six-star mutation grants6stars; HP/Atk/Power stack independently and carry into combat', () => {
  const speciesId = hybrid('spectralwyrm', 'obsidianbear').id;
  const normal = {...collection().pets[0], speciesId, level: 30}, mutated = {...normal, mutations: {hp: 2, attack: 2, power: 3, sixStar: true}};
  const base = T.stats(normal), result = T.stats(mutated);
  assert.equal(base.stars, 5); assert.equal(result.stars, 6); assert.equal(result.mutationCount, 8);
  assert.equal(result.maxHp, Math.round(base.maxHp * 1.1 * 1.1));
  assert.equal(result.atk, Math.round(base.atk * 1.1 * 1.1)); assert.equal(result.powerMultiplier, 1.15);
  const unit = battle(mutated).player;
  assert.deepEqual(unit.mutations, mutated.mutations); assert.equal(unit.maxHp, result.maxHp); assert.equal(unit.atk, result.atk); assert.equal(unit.stars, 6);
  assert.equal(T.stats({...mutated, mutations: {hp: 8}}).stars, 5);
  const powerOnly = {...normal, mutations: {hp: 0, attack: 0, power: 8, sixStar: false}};
  const basicA = battle(normal), basicB = battle(powerOnly);
  const damage = (b, action) => T.act(b, action, {rng: () => .5}).events.filter(e => e.type === 'damage' && e.side === 'player').reduce((n, e) => n + e.amount, 0);
  assert.equal(damage(basicA, 'attack'), damage(basicB, 'attack'), 'power mutations do not buff attack1');
  assert.ok(damage(battle(powerOnly), 'power') > damage(battle(normal), 'power'), 'power mutations boost attack2 in actual combat');
});

test('combined specials execute healing, shield, cleanse, buffs, damage-over-time, drain and multi-hit without double-strength attacks', () => {
  const pet = (a, b) => ({...collection().pets[0], speciesId: hybrid(a, b).id, level: 30});
  const healer = battle(pet('bramblebunny', 'runestag')); healer.player.hp = 100; healer.player.poison = 2; healer.player.poisonTurns = 2;
  const healEvents = T.act(healer, 'power', {rng: () => .5}).events;
  assert.ok(healEvents.some(e => e.type === 'heal' && e.side === 'player')); assert.ok(healEvents.some(e => e.type === 'shield' && e.side === 'player')); assert.equal(healer.player.poisonTurns, 0);
  const mixed = battle(pet('cinderwolf', 'coraldrake'));
  const mixedEvents = T.act(mixed, 'power', {rng: () => .5}).events; assert.ok(mixed.player.buff > 0); assert.ok(mixed.foe.poison > 0); assert.ok(mixedEvents.some(e => e.type === 'shield' && e.side === 'player' && e.amount > 0));
  const siphon = battle(pet('crystalgecko', 'spectralpanther')); siphon.player.hp -= 100; siphon.foe.shield = 100;
  const events = T.act(siphon, 'power', {rng: () => .5}).events;
  assert.equal(events.filter(e => e.type === 'damage' && e.side === 'player').length, 2);
  assert.ok(events.some(e => e.type === 'heal' && e.side === 'player')); assert.ok(siphon.foe.hp < siphon.foe.maxHp);
  assert.equal(siphon.player.powerCooldown, 2); T.act(siphon, 'attack', {rng: () => .5}); T.act(siphon, 'attack', {rng: () => .5}); assert.equal(siphon.player.powerCooldown, 0);
});

test('all300 hybrid special combinations remain finite and playable over repeated rounds', () => {
  for (const species of T.allSpecies().filter(s => s.hybrid)) {
    const pet = {...collection().pets[0], speciesId: species.id, mutations: {hp: 2, attack: 2, power: 3, sixStar: true}};
    const b = battle(pet);
    for (let i = 0; i < 8 && !b.outcome; i++) {
      assert.equal(T.act(b, b.player.powerCooldown ? 'attack' : 'power', {rng: () => .5}).ok, true);
      for (const unit of [b.player, b.foe]) {
        assert.ok(Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxHp, species.id);
        assert.ok(unit.shield >= 0 && unit.shield <= Math.round(unit.maxHp * .45));
      }
    }
  }
});

test('favorites and visible Tide are independent from battle equip and persist with bounded individual mutations', () => {
  const c = collection(); assert.equal(T.visible(c), null);
  T.toggleFavorite(c, c.pets[1].id); T.setVisible(c, c.pets[1].id);
  assert.equal(T.equipped(c).id, c.pets[0].id); assert.equal(T.visible(c).id, c.pets[1].id);
  c.pets[1].mutations = {hp: 2, attack: 3, power: 2, sixStar: true};
  const loaded = T.normalizeCollection(clone(c), 10000);
  assert.equal(loaded.pets[1].favorite, true); assert.equal(loaded.visibleId, c.visibleId); assert.equal(loaded.equippedId, c.equippedId);
  assert.deepEqual(loaded.pets[1].mutations, c.pets[1].mutations);
  assert.equal(T.toggleVisible(loaded, loaded.visibleId).pet, null); assert.equal(loaded.visibleId, null);
  assert.equal(T.toggleFavorite(loaded, 'missing').reason, 'unowned'); assert.equal(T.setVisible(loaded, 'missing').reason, 'unowned');
  const hostile = clone(c); hostile.pets[1].mutations = {hp: Infinity, attack: 10000, power: -2, sixStar: true}; hostile.visibleId = 'missing';
  const normalized = T.normalizeCollection(hostile, 10000);
  assert.deepEqual(normalized.pets[1].mutations, {hp: 0, attack: 7, power: 0, sixStar: true}); assert.equal(normalized.visibleId, null);
});

test('save normalization never rerolls jobs, rejects copied claims and repairs duplicate station/parent reservations', () => {
  const c = collection(['spectralwyrm', 'obsidianbear', 'bramblebunny', 'moonowl']); start(c);
  const original = clone(c.breedingJobs[0]); c.breedingJobs.push(clone(original), {...clone(original), id: 'breed-200', stationId: 'other-station'});
  const loaded = T.normalizeCollection(clone(c), 60000);
  assert.equal(loaded.breedingJobs.length, 1); assert.deepEqual(loaded.breedingJobs[0], original);
  assert.ok(loaded.nextId > Number(original.offspring.id.split('-')[1]));
  const forged = clone(loaded); forged.pets.push(clone(original.offspring));
  assert.equal(T.normalizeCollection(forged, 100000).breedingJobs.length, 0, 'already-owned offspring cannot be claimed twice from copied job');
  const wrong = clone(loaded); wrong.breedingJobs[0].offspring.speciesId = hybrid('meadowmouse', 'bramblebunny').id;
  assert.equal(T.normalizeCollection(wrong, 100000).breedingJobs.length, 0, 'job must match its actual two parents');
});

test('browser script order supports the complete serializable breeding flow without CommonJS', () => {
  const context = vm.createContext({});
  for (const file of ['catalog.js', 'hybrids.js', 'breeding.js', 'core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/tides', file), 'utf8'), context);
  const C = context.Tides.normalizeCollection(clone(collection()), 1000);
  const job = context.Tides.startBreeding(C, {stationId: 'browser-farm', parentAId: 'tide-1', parentBId: 'tide-2', now: 1000, rng: () => 0});
  assert.equal(job.ok, true); assert.equal(context.Tides.allSpecies().length, 325);
  context.Tides.revealBreeding(C, 'browser-farm', {now: 61000});
  assert.equal(context.Tides.claimBreeding(C, 'browser-farm', {now: 61000}).ok, true);
  assert.equal(context.Tides.normalizeCollection(clone(C), 70000).pets.length, 3);
});
