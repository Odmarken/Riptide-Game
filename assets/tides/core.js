/* Pure, serializable Tides rules. The host owns rendering and save scheduling. */
(function (root, factory) {
  const commonjs = typeof module === 'object' && module.exports;
  const api = factory(commonjs ? require('./catalog.js') : root.TidesCatalog,
    commonjs ? require('./breeding.js') : root.TideBreeding,
    commonjs ? require('./hybrids.js') : root.TidesHybrids || root.TideHybrids || []);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Tides = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalog, breeding, hybrids) {
  'use strict';
  const MAX_LEVEL = 30, SPECTRAL_MIN_LEVEL = 25, LASSO_PRICE = 10000;
  // Temporarily disabled for playtesting. Restore 2 * 60 * 60 * 1000 to enable Tide injuries again.
  const INJURY_MS = 0;
  const byId = new Map(catalog.map(species => [species.id, species]));
  const hybridByParents = new Map();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const number = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const integer = (value, fallback = 0) => Math.floor(number(value, fallback));
  const nowOf = options => Math.max(0, number(typeof options?.now === 'function' ? options.now() : options?.now, Date.now()));
  const random = rng => clamp(number((rng || Math.random)(), 0), 0, 0.999999999999);
  const getSpecies = id => byId.get(typeof id === 'string' ? id : id?.speciesId || id?.id) || null;
  const pairKey = (a, b) => [a, b].sort().join('--');
  const getHybrid = (a, b) => hybridByParents.get(pairKey(a, b)) || null;
  const emptyMutations = () => ({hp: 0, attack: 0, power: 0, sixStar: false});
  const normalizeMutations = raw => breeding ? breeding.normalizeMutations(raw) : emptyMutations();
  const mutationSummary = pet => breeding ? breeding.mutationSummary(pet) : {...emptyMutations(), count: 0};
  const isBreedingParent = (c, id) => breeding ? breeding.isParentLocked(c, id) : false;
  function combinedSkill(a, b) {
    const x = a.skill, y = b.skill;
    const skill = {name: x.name + ' + ' + y.name,
      description: 'Combines ' + x.name + ' and ' + y.name + ' at balanced strength.',
      parentNames: [x.name, y.name], parentSpecies: [a.id, b.id],
      style: x.style === 'magic' || y.style === 'magic' ? 'magic' : 'melee', color: x.color,
      cooldown: Math.max(x.cooldown || 2, y.cooldown || 2)};
    const mean = key => (number(x[key]) + number(y[key])) / 2;
    for (const [key, cap] of Object.entries({damage: 2.1, missingHpBonus: .45, heal: .2, missingHeal: .1, shield: 1.5, recoil: .25})) {
      const value = Math.min(cap, mean(key)); if (value > 0) skill[key] = value;
    }
    for (const [key, cap] of [['buff', .7], ['weaken', .4]]) {
      const value = Math.min(cap, mean(key));
      if (value > 0) {
        skill[key] = value;
        const total = number(x[key]) + number(y[key]);
        skill[key + 'Turns'] = clamp(Math.round((number(x[key]) * number(x[key + 'Turns'], 1) + number(y[key]) * number(y[key + 'Turns'], 1)) / total), 1, 3);
      }
    }
    if (x.poison || y.poison) {
      skill.poisonTurns = clamp(Math.max(integer(x.poisonTurns), integer(y.poisonTurns)), 1, 3);
      skill.poison = Math.min(.45, (number(x.poison) * number(x.poisonTurns) + number(y.poison) * number(y.poisonTurns)) / (2 * skill.poisonTurns));
    }
    const direct = number(x.damage) + number(y.damage);
    if (direct > 0) {
      for (const key of ['pierce', 'drain']) {
        const value = (number(x.damage) * number(x[key]) + number(y.damage) * number(y[key])) / direct;
        if (value > 0) skill[key] = Math.min(key === 'pierce' ? .55 : .32, value);
      }
      skill.hits = clamp(Math.max(integer(x.hits, 1), integer(y.hits, 1)), 1, 2);
    }
    if (x.cleanse || y.cleanse) skill.cleanse = true;
    const percent = value => Math.round(value * 1000) / 10 + '%', details = [];
    if (skill.damage) details.push(percent(skill.damage) + ' damage' + (skill.hits === 2 ? ' across two hits' : '') +
      (skill.missingHpBonus ? ', stronger as health falls' : ''));
    if (skill.pierce) details.push(percent(skill.pierce) + ' of damage bypasses shields');
    if (skill.heal) details.push('restore ' + percent(skill.heal) + ' max health');
    if (skill.missingHeal) details.push('restore ' + percent(skill.missingHeal) + ' of missing health');
    if (skill.drain) details.push('heal for ' + percent(skill.drain) + ' of damage dealt');
    if (skill.shield) details.push('shield for ' + percent(skill.shield) + ' ATK');
    if (skill.buff) details.push('+' + percent(skill.buff) + ' damage for ' + skill.buffTurns + ' actions');
    if (skill.weaken) details.push('enemy damage -' + percent(skill.weaken) + ' for ' + skill.weakenTurns + ' actions');
    if (skill.poison) details.push(percent(skill.poison) + ' ATK lingering damage for ' + skill.poisonTurns + ' actions');
    if (skill.cleanse) details.push('remove poison');
    if (skill.recoil) details.push(percent(skill.recoil) + ' ATK recoil unless the target falls');
    skill.description = details.join('; ') + '.';
    return Object.freeze(skill);
  }
  function registerHybrids(definitions) {
    const list = Array.isArray(definitions) ? definitions : definitions?.catalog || [];
    let registered = 0;
    for (const definition of list) {
      if (!definition || typeof definition.id !== 'string' || catalog.some(s => s.id === definition.id)) continue;
      const a = byId.get(definition.parentA), b = byId.get(definition.parentB);
      if (!a || !b || a.hybrid || b.hybrid || a.id === b.id) continue;
      const species = Object.freeze({...definition, hybrid: true, spectral: a.spectral || b.spectral,
        stars: clamp(Math.round((a.stars + b.stars) / 2), 1, 5), hpScale: (a.hpScale + b.hpScale) / 2,
        attackScale: (a.attackScale + b.attackScale) / 2, visualScale: Math.max(.8, (a.visualScale + b.visualScale) / 2),
        encounterWeight: 0, sheet: definition.art?.file || definition.sheet, sourceRect: definition.art?.sourceRect || definition.sourceRect,
        columns: 1, rows: 1, cell: 0,
        attack: Object.freeze({name: 'Hybrid Strike', description: 'A reliable strike. Reduces power cooldown by one turn.',
          style: a.attack.style === 'magic' && b.attack.style === 'magic' ? 'magic' : 'melee', color: a.attack.color}),
        skill: combinedSkill(a, b)});
      byId.set(species.id, species); hybridByParents.set(pairKey(a.id, b.id), species); registered++;
    }
    return registered;
  }
  const getSkill = pet => getSpecies(pet)?.skill || null;
  const xpToNext = level => level >= MAX_LEVEL ? 0 : 24 + clamp(integer(level, 1), 1, MAX_LEVEL) * 12;

  function createCollection() {
    return {version: 2, lassoOwned: false, pets: [], equippedId: null, visibleId: null, nextId: 1, nextBattleId: 1,
      activeBattle: null, recentWorldEvents: [], breedingJobs: [], nextBreedingId: 1};
  }

  function normalizePet(saved, now = Date.now()) {
    if (!saved || !getSpecies(saved.speciesId)) return null;
    const pet = {id: saved.id, speciesId: saved.speciesId, level: clamp(integer(saved.level, 1), 1, MAX_LEVEL),
      xp: Math.max(0, integer(saved.xp)), caughtAt: Math.max(0, number(saved.caughtAt, now)),
      injuredUntil: INJURY_MS > 0 ? Math.max(0, number(saved.injuredUntil)) : 0,
      favorite: saved.favorite === true, mutations: normalizeMutations(saved.mutations)};
    addXp(pet, 0); return pet;
  }

  function addXp(pet, amount) {
    const before = pet.level;
    pet.xp += Math.max(0, integer(amount));
    while (pet.level < MAX_LEVEL && pet.xp >= xpToNext(pet.level)) {
      pet.xp -= xpToNext(pet.level); pet.level++;
    }
    if (pet.level >= MAX_LEVEL) { pet.level = MAX_LEVEL; pet.xp = 0; }
    return pet.level - before;
  }

  function normalizeCollection(raw, now = Date.now()) {
    const c = createCollection();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return c;
    const time = nowOf({now}), used = new Set();
    c.nextId = Math.max(1, integer(raw.nextId, 1));
    for (const saved of Array.isArray(raw.pets) ? raw.pets : []) {
      if (!saved || !getSpecies(saved.speciesId)) continue;
      let id = typeof saved.id === 'string' && saved.id.length <= 100 ? saved.id : '';
      if (!id || used.has(id)) {
        do { id = 'tide-' + c.nextId++; } while (used.has(id));
      }
      used.add(id);
      const pet = normalizePet({...saved, id}, time);
      c.pets.push(pet);
      const sequence = /^tide-(\d+)$/.exec(id);
      if (sequence) c.nextId = Math.max(c.nextId, Number(sequence[1]) + 1);
    }
    // Existing pets imply that this character has already bought the permanent lasso.
    c.lassoOwned = raw.lassoOwned === true || c.pets.length > 0;
    c.equippedId = c.pets.some(pet => pet.id === raw.equippedId) ? raw.equippedId : c.pets[0]?.id || null;
    c.visibleId = c.pets.some(pet => pet.id === raw.visibleId) ? raw.visibleId : null;
    c.nextBattleId = Math.max(1, integer(raw.nextBattleId, 1));
    c.nextBreedingId = Math.max(1, integer(raw.nextBreedingId, 1));
    if (breeding) c.breedingJobs = breeding.normalizeJobs(raw.breedingJobs, c, time);
    c.recentWorldEvents = (Array.isArray(raw.recentWorldEvents) ? raw.recentWorldEvents : [])
      .filter(id => typeof id === 'string').slice(-128);
    // The exploration module owns this schema and sanitizes it when loaded.
    if (raw.exploration && typeof raw.exploration === 'object' && !Array.isArray(raw.exploration)) {
      try { c.exploration = JSON.parse(JSON.stringify(raw.exploration)); } catch (_) { /* Invalid non-save input. */ }
    }
    // Reloading an unfinished fight is abandonment. When enabled, preserve the
    // injury's original real-time deadline; playtesting clears old injuries too.
    if (INJURY_MS > 0 && raw.activeBattle && typeof raw.activeBattle === 'object') {
      const pet = c.pets.find(item => item.id === raw.activeBattle.ownedId);
      if (pet) pet.injuredUntil = Math.max(pet.injuredUntil,
        Math.max(0, number(raw.activeBattle.startedAt, time)) + INJURY_MS);
    }
    return c;
  }

  function stats(speciesOrId, level = speciesOrId?.level || 1) {
    const species = getSpecies(speciesOrId);
    if (!species) return null;
    const lvl = clamp(integer(level, 1), 1, MAX_LEVEL), rarity = 1 + (species.stars - 1) * 0.02;
    const mutations = mutationSummary(typeof speciesOrId === 'object' ? speciesOrId : null), step = breeding?.CONFIG.STAT_PER_STACK || 0;
    const sixStar = mutations.sixStar ? breeding.CONFIG.SIX_STAR_MULTIPLIER : 1;
    const baseMaxHp = Math.round((100 + (lvl - 1) * 11) * species.hpScale * rarity);
    const baseAtk = Math.round((17 + (lvl - 1) * 1.8) * species.attackScale * rarity);
    const maxHp = Math.round(baseMaxHp * (1 + mutations.hp * step) * sixStar);
    const atk = Math.round(baseAtk * (1 + mutations.attack * step) * sixStar);
    return {level: lvl, maxHp, hp: maxHp, atk, attack: atk, stars: mutations.sixStar ? 6 : species.stars, spectral: species.spectral,
      baseMaxHp, baseAtk, mutationCount: mutations.count, hpMutation: mutations.hp, attackMutation: mutations.attack,
      powerMutation: mutations.power, powerMultiplier: 1 + mutations.power * step};
  }

  function equipped(c) { return c?.pets?.find(pet => pet.id === c.equippedId) || null; }
  function visible(c) { return c?.pets?.find(pet => pet.id === c.visibleId) || null; }
  function setVisible(c, id) {
    if (id === null) { c.visibleId = null; return {ok: true, pet: null}; }
    const pet = c?.pets?.find(p => p.id === id);
    if (!pet) return {ok: false, reason: 'unowned'};
    c.visibleId = id; return {ok: true, pet};
  }
  function toggleVisible(c, id) { return setVisible(c, c?.visibleId === id ? null : id); }
  function toggleFavorite(c, id) {
    const pet = c?.pets?.find(p => p.id === id);
    if (!pet) return {ok: false, reason: 'unowned'};
    pet.favorite = !pet.favorite; return {ok: true, pet, favorite: pet.favorite};
  }
  function remainingInjury(pet, now = Date.now()) { return INJURY_MS > 0 ? Math.max(0, number(pet?.injuredUntil) - nowOf({now})) : 0; }

  function newPet(c, speciesId, level, now) {
    let id;
    do { id = 'tide-' + c.nextId++; } while (c.pets.some(pet => pet.id === id) || c.breedingJobs?.some(job => job.offspring.id === id));
    const pet = {id, speciesId, level: clamp(integer(level, 1), 1, MAX_LEVEL), xp: 0, caughtAt: now, injuredUntil: 0,
      favorite: false, mutations: emptyMutations()};
    c.pets.push(pet); return pet;
  }

  function purchaseLasso(c, gold, options = {}) {
    if (!c || c.lassoOwned) return {ok: false, reason: 'owned', gold};
    if (!Number.isFinite(gold) || gold < LASSO_PRICE) return {ok: false, reason: 'gold', gold};
    const starters = catalog.filter(species => species.stars === 1);
    const species = starters[Math.floor(random(options.rng) * starters.length)];
    const starter = newPet(c, species.id, 1, nowOf(options));
    c.lassoOwned = true; c.equippedId = starter.id;
    return {ok: true, gold: gold - LASSO_PRICE, starter};
  }

  function equip(c, ownedId, now = Date.now()) {
    if (c.activeBattle) return {ok: false, reason: 'battle'};
    const pet = c.pets.find(item => item.id === ownedId);
    if (!pet) return {ok: false, reason: 'unowned'};
    c.equippedId = pet.id;
    return {ok: true, pet, injured: remainingInjury(pet, now) > 0};
  }

  function awardWorldXp(c, options = {}) {
    const pet = equipped(c);
    if (!pet) return {ok: false, reason: 'equipped'};
    if (c.activeBattle || remainingInjury(pet, nowOf(options))) return {ok: false, reason: 'injured'};
    const eventId = typeof options.eventId === 'string' ? options.eventId : null;
    if (eventId && c.recentWorldEvents.includes(eventId)) return {ok: false, reason: 'duplicate'};
    const amount = clamp(integer(options.amount, 2), 0, 5);
    if (eventId) { c.recentWorldEvents.push(eventId); c.recentWorldEvents = c.recentWorldEvents.slice(-128); }
    return {ok: true, pet, xp: amount, levels: addXp(pet, amount)};
  }

  function rollWild(c, options = {}) {
    const total = catalog.reduce((sum, species) => sum + species.encounterWeight, 0);
    let ticket = random(options.rng) * total;
    const species = catalog.find(item => (ticket -= item.encounterWeight) < 0) || catalog[catalog.length - 1];
    const minLevel = species.spectral ? SPECTRAL_MIN_LEVEL : 1;
    const level = options.level === undefined ? species.spectral
      ? minLevel + Math.floor(random(options.rng) * (MAX_LEVEL - minLevel + 1))
      : (equipped(c)?.level || 1) + Math.floor(random(options.rng) * 5) - 2 : options.level;
    return {speciesId: species.id, level: clamp(integer(level, minLevel), minLevel, MAX_LEVEL)};
  }

  function combatant(pet, level) {
    const speciesId = typeof pet === 'string' ? pet : pet.speciesId;
    return {speciesId, mutations: normalizeMutations(typeof pet === 'object' ? pet.mutations : null), ...stats(pet, level), shield: 0, powerCooldown: 0,
      buff: 0, buffTurns: 0, weaken: 0, weakenTurns: 0, poison: 0, poisonTurns: 0};
  }

  function beginBattle(c, wild, options = {}) {
    if (!c.lassoOwned) return {ok: false, reason: 'lasso'};
    if (c.activeBattle) return {ok: false, reason: 'battle'};
    const pet = equipped(c), now = nowOf(options);
    if (!pet) return {ok: false, reason: 'equipped'};
    if (isBreedingParent(c, pet.id)) return {ok: false, reason: 'breeding'};
    if (remainingInjury(pet, now)) return {ok: false, reason: 'injured'};
    if (!getSpecies(wild?.speciesId)) return {ok: false, reason: 'unknown'};
    const enemy = {speciesId: wild.speciesId, level: clamp(integer(wild.level, 1), 1, MAX_LEVEL)};
    const battle = {id: 'battle-' + c.nextBattleId++, ownedId: pet.id, enemy, startedAt: now, turn: 1,
      player: combatant(pet, pet.level), foe: combatant(enemy, enemy.level),
      seed: Math.floor(random(options.rng) * 4294967295) || 1, outcome: null, committed: false};
    pet.injuredUntil = INJURY_MS > 0 ? now + INJURY_MS : 0;
    c.activeBattle = {id: battle.id, ownedId: pet.id, enemy: {...enemy}, startedAt: now};
    return {ok: true, battle};
  }

  function seededRandom(battle) {
    battle.seed = (Math.imul(1664525, battle.seed) + 1013904223) >>> 0;
    return battle.seed / 4294967296;
  }

  function act(battle, action, options = {}) {
    if (!battle || battle.outcome || battle.committed) return {ok: false, reason: 'finished', events: [], outcome: battle?.outcome || null};
    if (action !== 'attack' && action !== 'power') return {ok: false, reason: 'action', events: [], outcome: null};
    if (action === 'power' && battle.player.powerCooldown > 0) return {ok: false, reason: 'cooldown', events: [], outcome: null};
    const events = [], rng = options.rng || (() => seededRandom(battle));
    const name = unit => getSpecies(unit.speciesId).name;
    const event = (type, side, text, amount = 0, targetSide = side) => events.push({type, side, targetSide, text, amount});
    function checkOutcome() {
      if (battle.player.hp <= 0) battle.outcome = 'loss';
      else if (battle.foe.hp <= 0) battle.outcome = 'win';
      return battle.outcome;
    }
    function hurt(target, amount, side, targetSide, pierce = 0, type = 'damage') {
      const requested = Math.max(0, Math.round(amount));
      const absorbed = Math.min(target.shield, Math.round(requested * (1 - pierce)));
      target.shield -= absorbed;
      const actual = Math.min(target.hp, requested - absorbed);
      target.hp -= actual;
      event(type, side, name(target) + ' takes ' + actual + ' damage' + (absorbed ? ' (' + absorbed + ' blocked)' : '') + '.', actual, targetSide);
      return actual;
    }
    function heal(unit, amount, side) {
      const actual = Math.min(unit.maxHp - unit.hp, Math.max(0, Math.round(amount)));
      unit.hp += actual;
      if (actual) event('heal', side, name(unit) + ' restores ' + actual + ' health.', actual);
    }
    function move(unit, target, selected, side, targetSide) {
      if (unit.poisonTurns > 0) {
        unit.poisonTurns--;
        const damage = Math.min(unit.hp, unit.poison); unit.hp -= damage;
        event('poison', targetSide, name(unit) + ' takes ' + damage + ' lingering damage.', damage, side);
        if (unit.poisonTurns === 0) unit.poison = 0;
        if (checkOutcome()) return;
      }
      const buff = unit.buffTurns > 0 ? unit.buff : 0, weaken = unit.weakenTurns > 0 ? unit.weaken : 0;
      const power = unit.atk * (1 + buff) * (1 - weaken) * (0.86 + random(rng) * 0.28);
      if (unit.buffTurns > 0 && --unit.buffTurns === 0) unit.buff = 0;
      if (unit.weakenTurns > 0 && --unit.weakenTurns === 0) unit.weaken = 0;
      if (selected === 'attack') {
        event('attack', side, name(unit) + ' uses ' + getSpecies(unit.speciesId).attack.name + '.', 0, targetSide);
        hurt(target, power, side, targetSide);
        unit.powerCooldown = Math.max(0, unit.powerCooldown - 1);
      } else {
        const skill = getSkill(unit);
        event('power', side, name(unit) + ' uses ' + skill.name + '.', 0, targetSide);
        unit.powerCooldown = skill.cooldown;
        if (skill.cleanse) { unit.poison = 0; unit.poisonTurns = 0; }
        let damage = 0;
        if (skill.damage) {
          const strength = skill.damage + (skill.missingHpBonus || 0) * (1 - unit.hp / unit.maxHp);
          const hits = skill.hits || 1;
          for (let i = 0; i < hits && target.hp > 0; i++) damage += hurt(target, power * strength * (unit.powerMultiplier || 1) / hits, side, targetSide, skill.pierce || 0);
        }
        if (skill.heal || skill.missingHeal) heal(unit, unit.maxHp * (skill.heal || 0) + (unit.maxHp - unit.hp) * (skill.missingHeal || 0), side);
        if (skill.drain) heal(unit, damage * skill.drain, side);
        if (skill.shield) {
          const previous = unit.shield;
          unit.shield = Math.min(Math.round(unit.maxHp * 0.45), unit.shield + Math.round(unit.atk * skill.shield));
          event('shield', side, name(unit) + ' gains ' + (unit.shield - previous) + ' shield.', unit.shield - previous);
        }
        if (skill.buff) { unit.buff = skill.buff; unit.buffTurns = skill.buffTurns; event('buff', side, name(unit) + ' powers up for ' + skill.buffTurns + ' turns.'); }
        if (skill.weaken) { target.weaken = skill.weaken; target.weakenTurns = skill.weakenTurns; event('weaken', side, name(target) + ' is weakened.', 0, targetSide); }
        if (skill.poison && target.hp > 0) { target.poison = Math.max(1, Math.round(unit.atk * skill.poison * (unit.powerMultiplier || 1))); target.poisonTurns = skill.poisonTurns; event('status', side, name(target) + ' will take lingering damage.', 0, targetSide); }
        // Recoil cannot turn an otherwise successful finishing blow into a loss.
        if (skill.recoil && target.hp > 0) hurt(unit, Math.min(unit.hp - 1, unit.atk * skill.recoil), side, side, 1, 'recoil');
      }
      checkOutcome();
    }
    move(battle.player, battle.foe, action, 'player', 'foe');
    if (!battle.outcome) {
      const enemySkill = getSkill(battle.foe);
      const waitsForHealing = enemySkill.heal && battle.foe.maxHp - battle.foe.hp < battle.foe.maxHp * enemySkill.heal * 0.8;
      const enemyAction = battle.foe.powerCooldown === 0 && !waitsForHealing && random(rng) < 0.9 ? 'power' : 'attack';
      move(battle.foe, battle.player, enemyAction, 'foe', 'player');
    }
    if (!battle.outcome && battle.turn >= 60) {
      battle.outcome = battle.player.hp / battle.player.maxHp > battle.foe.hp / battle.foe.maxHp ? 'win' : 'loss';
      event('limit', 'player', 'The long duel ends on remaining health.');
    }
    if (battle.outcome) event('result', 'player', battle.outcome === 'win' ? 'Victory! The wild Tide can now be captured.' : INJURY_MS > 0 ? 'Your Tide needs two hours of rest.' : 'Defeat. Your Tide is ready to battle again.');
    else battle.turn++;
    return {ok: true, events, outcome: battle.outcome, turn: battle.turn};
  }

  function finishBattle(c, battle, options = {}) {
    const active = c?.activeBattle;
    if (!battle || battle.committed || !active || active.id !== battle.id || active.ownedId !== battle.ownedId)
      return {ok: false, reason: 'settled'};
    if (battle.outcome !== 'win' && battle.outcome !== 'loss') return {ok: false, reason: 'unfinished'};
    const pet = c.pets.find(item => item.id === active.ownedId), now = nowOf(options);
    if (!pet) return {ok: false, reason: 'unowned'};
    let captured = null, xp = 0, levels = 0;
    if (battle.outcome === 'win') {
      // Use the original encounter, so UI state cannot swap the captured species.
      captured = newPet(c, active.enemy.speciesId, active.enemy.level, now);
      pet.injuredUntil = 0;
      xp = Math.round(30 + active.enemy.level * 8 + getSpecies(active.enemy.speciesId).stars * 3);
      levels = addXp(pet, xp);
    } else pet.injuredUntil = INJURY_MS > 0 ? now + INJURY_MS : 0;
    battle.committed = true; c.activeBattle = null;
    return {ok: true, outcome: battle.outcome, pet, captured, xp, levels};
  }

  function abandonBattle(c, battle, options = {}) {
    if (!battle || battle.committed) return {ok: false, reason: 'settled'};
    battle.outcome = 'loss';
    return finishBattle(c, battle, options);
  }

  registerHybrids(hybrids);
  const startBreeding = (c, options = {}) => breeding.start(c, options.stationId, options.parentAId, options.parentBId, options);
  return Object.freeze({catalog, MAX_LEVEL, SPECTRAL_MIN_LEVEL, LASSO_PRICE, INJURY_MS, createCollection, normalizeCollection, normalizePet,
    registerHybrids, allSpecies: () => [...byId.values()], getHybrid, getSkill, mutationSummary, normalizeMutations,
    visible, setVisible, toggleVisible, toggleFavorite, isBreedingParent, BREEDING_CONFIG: breeding?.CONFIG,
    startBreeding, breedingStatus: (c, stationId, now) => breeding.status(c, stationId, now),
    revealBreeding: (c, stationId, options) => breeding.reveal(c, stationId, options),
    claimBreeding: (c, stationId, options) => breeding.claim(c, stationId, options),
    eligibleBreedingParents: (c, options) => breeding.eligibleParents(c, options),
    getSpecies, stats, xpToNext, equipped, equip, remainingInjury, purchaseLasso, awardWorldXp,
    rollWild, beginBattle, act, finishBattle, abandonBattle});
});
