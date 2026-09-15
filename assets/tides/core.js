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
      activeBattle: null, guildSeries: null, recentWorldEvents: [], breedingJobs: [], nextBreedingId: 1};
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
    // Guild training is retired on reload, with no injury or rewards. Never
    // restore its opponent as an ordinary catchable wild encounter.
    if (INJURY_MS > 0 && raw.activeBattle && typeof raw.activeBattle === 'object' && raw.activeBattle.training !== true) {
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
    if (c.activeBattle || c.guildSeries) return {ok: false, reason: 'battle'};
    const pet = c.pets.find(item => item.id === ownedId);
    if (!pet) return {ok: false, reason: 'unowned'};
    c.equippedId = pet.id;
    return {ok: true, pet, injured: remainingInjury(pet, now) > 0};
  }

  function awardWorldXp(c, options = {}) {
    const pet = equipped(c);
    if (!pet) return {ok: false, reason: 'equipped'};
    if (c.activeBattle || c.guildSeries || remainingInjury(pet, nowOf(options))) return {ok: false, reason: 'injured'};
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
    const training = options.training === true;
    if (c.guildSeries && (!training || options.guildSeriesId !== c.guildSeries.id)) return {ok: false, reason: 'battle'};
    const pet = equipped(c), now = nowOf(options);
    if (!pet) return {ok: false, reason: 'equipped'};
    if (isBreedingParent(c, pet.id)) return {ok: false, reason: 'breeding'};
    if (remainingInjury(pet, now)) return {ok: false, reason: 'injured'};
    if (!getSpecies(wild?.speciesId)) return {ok: false, reason: 'unknown'};
    const enemy = {speciesId: wild.speciesId, level: clamp(integer(wild.level, 1), 1, MAX_LEVEL)};
    const battle = {id: 'battle-' + c.nextBattleId++, ownedId: pet.id, enemy, startedAt: now, turn: 1,
      player: combatant(pet, pet.level), foe: combatant(enemy, enemy.level),
      seed: Math.floor(random(options.rng) * 4294967295) || 1, outcome: null, committed: false};
    if (!training) pet.injuredUntil = INJURY_MS > 0 ? now + INJURY_MS : 0;
    c.activeBattle = {id: battle.id, ownedId: pet.id, enemy: {...enemy}, startedAt: now};
    if (training) {
      const metadata = {training: true, mode: 'guild', guildSeriesId: options.guildSeriesId || null};
      Object.assign(battle, metadata); Object.assign(c.activeBattle, metadata);
    }
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
    const sides = ['player', 'foe'], before = {player: {...battle.player}, foe: {...battle.foe}};
    const after = {player: {...before.player}, foe: {...before.foe}};
    const name = unit => getSpecies(unit.speciesId).name;
    const enemySkill = getSkill(before.foe);
    // Both decisions see the round's starting state, never the other action's
    // damage or status changes. Visual animation order does not confer priority.
    const waitsForHealing = enemySkill.heal && before.foe.maxHp - before.foe.hp < before.foe.maxHp * enemySkill.heal * 0.8;
    const enemyAction = before.foe.powerCooldown === 0 && !waitsForHealing && random(rng) < 0.9 ? 'power' : 'attack';
    const plans = {};
    function emit(plan, type, text, amount = 0, targetSide = plan.targetSide, sourceSide = plan.side) {
      plan.events.push({type, side: sourceSide, targetSide, text, amount, actionSide: plan.side, actionIndex: plan.actionIndex});
    }
    for (const [actionIndex, side] of sides.entries()) {
      const targetSide = side === 'player' ? 'foe' : 'player', unit = before[side], next = after[side];
      const selected = side === 'player' ? action : enemyAction, skill = selected === 'power' ? getSkill(unit) : {};
      const plan = plans[side] = {side, targetSide, actionIndex, skill, events: [], hits: [], incoming: 0, dealt: 0, poison: 0, healed: 0};
      if (unit.poisonTurns > 0) {
        plan.poison = Math.max(0, unit.poison);
        next.poisonTurns--; if (next.poisonTurns === 0) next.poison = 0;
        const shownPoison = Math.min(unit.hp, plan.poison);
        emit(plan, 'poison', name(unit) + ' takes ' + plan.poison + ' lingering damage.', shownPoison, side, targetSide);
      }
      const buff = unit.buffTurns > 0 ? unit.buff : 0, weaken = unit.weakenTurns > 0 ? unit.weaken : 0;
      const power = unit.atk * (1 + buff) * (1 - weaken) * (.86 + random(rng) * .28);
      if (unit.buffTurns > 0 && --next.buffTurns === 0) next.buff = 0;
      if (unit.weakenTurns > 0 && --next.weakenTurns === 0) next.weaken = 0;
      emit(plan, selected, name(unit) + ' uses ' + (selected === 'power' ? skill.name : getSpecies(unit.speciesId).attack.name) + '.');
      next.powerCooldown = selected === 'power' ? skill.cooldown : Math.max(0, unit.powerCooldown - 1);
      if (selected === 'attack') plan.hits.push({amount: Math.max(0, Math.round(power)), pierce: 0});
      else if (skill.damage) {
        const strength = skill.damage + (skill.missingHpBonus || 0) * (1 - unit.hp / unit.maxHp), hits = skill.hits || 1;
        for (let i = 0; i < hits; i++) plan.hits.push({amount: Math.max(0, Math.round(power * strength * (unit.powerMultiplier || 1) / hits)), pierce: skill.pierce || 0});
      }
      if (skill.cleanse) { next.poison = 0; next.poisonTurns = 0; }
      if (skill.shield) {
        const added = Math.max(0, Math.min(Math.round(unit.maxHp * .45) - unit.shield, Math.round(unit.atk * skill.shield)));
        next.shield += added;
        emit(plan, 'shield', name(unit) + ' gains ' + added + ' shield.', added, side);
      }
      if (skill.buff) { next.buff = skill.buff; next.buffTurns = skill.buffTurns; emit(plan, 'buff', name(unit) + ' powers up for ' + skill.buffTurns + ' turns.', 0, side); }
    }
    // New shields protect against this round's committed hits on BOTH sides.
    for (const side of sides) {
      const plan = plans[side], target = after[plan.targetSide], targetBefore = before[plan.targetSide], targetPlan = plans[plan.targetSide];
      for (const hit of plan.hits) {
        const absorbed = Math.min(target.shield, Math.round(hit.amount * (1 - hit.pierce)));
        target.shield -= absorbed;
        const rawDamage = hit.amount - absorbed;
        const actual = Math.min(Math.max(0, targetBefore.hp - targetPlan.poison - targetPlan.incoming), rawDamage);
        targetPlan.incoming += rawDamage; plan.dealt += actual;
        emit(plan, 'damage', name(target) + ' takes ' + rawDamage + ' damage' + (absorbed ? ' (' + absorbed + ' blocked)' : '') + '.', actual);
      }
      const skill = plan.skill;
      if (skill.weaken) { target.weaken = skill.weaken; target.weakenTurns = skill.weakenTurns; emit(plan, 'weaken', name(target) + ' is weakened.'); }
      if (skill.poison) { target.poison = Math.max(1, Math.round(before[side].atk * skill.poison * (before[side].powerMultiplier || 1))); target.poisonTurns = skill.poisonTurns; emit(plan, 'status', name(target) + ' will take lingering damage.'); }
    }
    for (const side of sides) {
      const unit = before[side], next = after[side], plan = plans[side], skill = plan.skill;
      const healing = Math.max(0, Math.round(unit.maxHp * (skill.heal || 0) + (unit.maxHp - unit.hp) * (skill.missingHeal || 0))) + Math.max(0, Math.round(plan.dealt * (skill.drain || 0)));
      // Combine healing and incoming damage BEFORE clamping. Neither a lethal
      // hit nor a lethal old poison tick cancels the already chosen action.
      plan.healed = Math.min(healing, Math.max(0, unit.maxHp - unit.hp + plan.poison + plan.incoming));
      next.hp = clamp(unit.hp - plan.poison - plan.incoming + plan.healed, 0, unit.maxHp);
      if (plan.healed) emit(plan, 'heal', name(unit) + ' restores ' + plan.healed + ' health.', plan.healed, side);
    }
    for (const side of sides) {
      const plan = plans[side], next = after[side];
      // Recoil cannot kill its caster, or penalize a successful finishing hit.
      if (plan.skill.recoil && after[plan.targetSide].hp > 0) {
        const damage = Math.max(0, Math.min(next.hp - 1, Math.round(before[side].atk * plan.skill.recoil)));
        next.hp -= damage;
        if (damage) emit(plan, 'recoil', name(next) + ' takes ' + damage + ' recoil damage.', damage, side);
      }
      Object.assign(battle[side], next); events.push(...plan.events);
    }
    if (battle.player.hp <= 0 && battle.foe.hp <= 0) battle.outcome = 'draw';
    else if (battle.player.hp <= 0) battle.outcome = 'loss';
    else if (battle.foe.hp <= 0) battle.outcome = 'win';
    if (!battle.outcome && battle.turn >= 60) {
      const difference = battle.player.hp / battle.player.maxHp - battle.foe.hp / battle.foe.maxHp;
      battle.outcome = difference > 0 ? 'win' : difference < 0 ? 'loss' : 'draw';
      events.push({type: 'limit', side: 'player', targetSide: 'player', text: 'The long duel ends on remaining health.', amount: 0});
    }
    if (battle.outcome) events.push({type: 'result', side: 'player', targetSide: 'player', amount: 0, text: battle.outcome === 'draw'
      ? 'Draw. Both Tides can battle again.' : battle.training ? battle.outcome === 'win' ? 'Round won!' : 'Round lost.'
      : battle.outcome === 'win' ? 'Victory! The wild Tide can now be captured.' : INJURY_MS > 0 ? 'Your Tide needs two hours of rest.' : 'Defeat. Your Tide is ready to battle again.'});
    else battle.turn++;
    return {ok: true, events, outcome: battle.outcome, turn: battle.turn};
  }

  function finishBattle(c, battle, options = {}) {
    const active = c?.activeBattle;
    if (!battle || battle.committed || !active || active.id !== battle.id || active.ownedId !== battle.ownedId)
      return {ok: false, reason: 'settled'};
    if (!['win', 'loss', 'draw'].includes(battle.outcome)) return {ok: false, reason: 'unfinished'};
    const pet = c.pets.find(item => item.id === active.ownedId), now = nowOf(options);
    if (!pet) return {ok: false, reason: 'unowned'};
    let captured = null, xp = 0, levels = 0;
    if (active.training === true) {
      // The saved encounter is authoritative, even if a caller omitted the
      // training flag on its animation copy of the battle.
    } else if (battle.outcome === 'draw') {
      pet.injuredUntil = 0;
    } else if (battle.outcome === 'win') {
      // Use the original encounter, so UI state cannot swap the captured species.
      captured = newPet(c, active.enemy.speciesId, active.enemy.level, now);
      pet.injuredUntil = 0;
      xp = Math.round(30 + active.enemy.level * 8 + getSpecies(active.enemy.speciesId).stars * 3);
      levels = addXp(pet, xp);
    } else pet.injuredUntil = INJURY_MS > 0 ? now + INJURY_MS : 0;
    battle.committed = true; c.activeBattle = null;
    return {ok: true, outcome: battle.outcome, pet, captured, xp, levels, training: active.training === true};
  }

  function abandonBattle(c, battle, options = {}) {
    if (!battle || battle.committed) return {ok: false, reason: 'settled'};
    battle.outcome = 'loss';
    return finishBattle(c, battle, options);
  }

  registerHybrids(hybrids);
  const startBreeding = (c, options = {}) => c?.guildSeries ? {ok: false, reason: 'battle'}
    : breeding.start(c, options.stationId, options.parentAId, options.parentBId, options);
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
