/* Persistent passive training. Resolve core lazily, just like breeding. */
(function (root, factory) {
  const api = factory(() => typeof module === 'object' && module.exports ? require('./core.js') : root.Tides);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TideTraining = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getTides) {
  'use strict';
  const CONFIG = Object.freeze({MAX_SLOTS: 3, XP_PER_MINUTE: 6, MS_PER_XP: 10000});
  const finite = (x, fallback = 0) => typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  const timeOf = options => Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(finite(typeof options?.now === 'function' ? options.now() : options?.now, Date.now()))));
  const jobs = c => Array.isArray(c?.training?.jobs) ? c.training.jobs : [];
  const clock = (c, options) => Math.max(timeOf(options), Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(finite(c?.training?.lastNow)))));
  const isTraining = (c, id) => jobs(c).some(job => job.petId === id);
  function unavailable(c, pet, now) {
    const T = getTides();
    if (!pet) return 'unowned';
    if (isTraining(c, pet.id)) return 'training';
    if (T.isBreedingParent(c, pet.id)) return 'breeding';
    if (T.remainingInjury(pet, now)) return 'injured';
    if (pet.level >= T.MAX_LEVEL) return 'maximum';
    return null;
  }
  function eligible(c, options = {}) {
    const now = timeOf(options);
    return c?.activeBattle || c?.guildSeries ? [] : (c?.pets || []).filter(p => !unavailable(c, p, now));
  }
  function normalize(raw, c, now = Date.now()) {
    const T = getTides(), occupied = new Set(), pets = new Set(), result = {version: 1, lastNow: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(finite(raw?.lastNow)))), jobs: []};
    for (const saved of Array.isArray(raw?.jobs) ? raw.jobs : []) {
      const pet = c.pets.find(p => p.id === saved?.petId), slot = saved?.slot;
      if (!pet || !Number.isInteger(slot) || slot < 0 || slot >= CONFIG.MAX_SLOTS || occupied.has(slot) || pets.has(pet.id) || T.isBreedingParent(c, pet.id)) continue;
      if (!Number.isSafeInteger(saved.startedAt) || saved.startedAt < 0 || !Number.isSafeInteger(saved.lastAccruedAt) || saved.lastAccruedAt < saved.startedAt) continue;
      result.jobs.push({slot, petId: pet.id, startedAt: saved.startedAt, lastAccruedAt: saved.lastAccruedAt,
        totalXp: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(finite(saved.totalXp))))});
      result.lastNow = Math.max(result.lastNow, saved.lastAccruedAt);
      occupied.add(slot); pets.add(pet.id);
    }
    return result;
  }
  function update(c, options = {}) {
    const T = getTides(), now = clock(c, options), result = {changed: false, xp: 0, levels: 0, pets: []};
    if (c?.training && (jobs(c).length || c.training.lastNow > 0)) c.training.lastNow = now;
    for (const job of jobs(c)) {
      const pet = c.pets.find(p => p.id === job.petId);
      if (!pet) continue;
      // Keep the high-water timestamp on clock rollback. Sub-XP time remains
      // in the saved timestamp, so frequent ticks/reloads never lose progress.
      const amount = Math.floor(Math.max(0, now - job.lastAccruedAt) / CONFIG.MS_PER_XP);
      if (!amount || pet.level >= T.MAX_LEVEL) continue;
      let capacity = -pet.xp;
      for (let level = pet.level; level < T.MAX_LEVEL; level++) capacity += T.xpToNext(level);
      const gained = Math.min(amount, capacity), levels = T.addXp(pet, gained);
      job.lastAccruedAt += amount * CONFIG.MS_PER_XP; job.totalXp += gained;
      result.changed = true; result.xp += gained; result.levels += levels; result.pets.push({petId: pet.id, xp: gained, levels});
    }
    return result;
  }
  function status(c, now = Date.now()) {
    const T = getTides(), time = clock(c, {now});
    return Array.from({length: CONFIG.MAX_SLOTS}, (_, slot) => {
      const job = jobs(c).find(j => j.slot === slot), pet = job && c.pets.find(p => p.id === job.petId);
      if (!pet) return {slot, empty: true};
      return {...job, empty: false, pet, maxLevel: pet.level >= T.MAX_LEVEL,
        elapsedMs: Math.max(0, time - job.startedAt),
        nextXpMs: pet.level >= T.MAX_LEVEL ? 0 : Math.max(0, job.lastAccruedAt + CONFIG.MS_PER_XP - time)};
    });
  }
  function start(c, petId, options = {}) {
    const now = clock(c, options);
    if (!c?.lassoOwned) return {ok: false, reason: 'lasso'};
    if (c.activeBattle || c.guildSeries) return {ok: false, reason: 'battle'};
    const pet = c.pets.find(p => p.id === petId), reason = unavailable(c, pet, now);
    if (reason) return {ok: false, reason};
    const slot = options.slot === undefined ? Array.from({length: CONFIG.MAX_SLOTS}, (_, n) => n).find(n => !jobs(c).some(j => j.slot === n)) : options.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= CONFIG.MAX_SLOTS || jobs(c).length >= CONFIG.MAX_SLOTS || jobs(c).some(j => j.slot === slot)) return {ok: false, reason: 'full'};
    const wasEquipped = c.equippedId === pet.id, wasVisible = c.visibleId === pet.id;
    if (wasEquipped) c.equippedId = null;
    if (wasVisible) c.visibleId = null;
    const job = {slot, petId: pet.id, startedAt: now, lastAccruedAt: now, totalXp: 0};
    c.training = {version: 1, lastNow: now, jobs: [...jobs(c), job]};
    return {ok: true, pet, job: {...job}, wasEquipped, wasVisible};
  }
  function collect(c, petId, options = {}) {
    if (c?.activeBattle || c?.guildSeries) return {ok: false, reason: 'battle'};
    const job = jobs(c).find(j => j.petId === petId), pet = c?.pets?.find(p => p.id === petId);
    if (!job || !pet) return {ok: false, reason: 'missing'};
    update(c, options);
    c.training.jobs = jobs(c).filter(j => j !== job);
    return {ok: true, pet, xp: job.totalXp};
  }
  return Object.freeze({CONFIG, normalize, update, status, start, collect, eligible, isTraining});
});
