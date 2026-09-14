/* Serializable breeding rules. Resolve Tides lazily so this module can load before core. */
(function (root, factory) {
  const api = factory(() => typeof module === 'object' && module.exports ? require('./core.js') : root.Tides);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TideBreeding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getTides) {
  'use strict';
  const CONFIG = Object.freeze({DURATION_MS: 60000, MAX_DURATION_MS: 7 * 24 * 60 * 60 * 1000,
    MAX_MUTATIONS: 8, STAT_PER_STACK: 0.05, SIX_STAR_MULTIPLIER: 1.10,
    COUNT_WEIGHTS: Object.freeze([7000, 1800, 700, 280, 130, 60, 22, 7, 1]),
    TYPE_WEIGHTS: Object.freeze({hp: 3333, attack: 3333, power: 3333, sixStar: 1}),
    OFFSPRING_LEVEL: 1, ALLOW_HYBRID_PARENTS: false});
  const finite = (x, fallback = 0) => typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  const integer = (x, fallback = 0) => Math.floor(finite(x, fallback));
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const nowOf = options => Math.max(0, finite(typeof options?.now === 'function' ? options.now() : options?.now, Date.now()));
  const clone = value => JSON.parse(JSON.stringify(value));
  const random = rng => clamp(finite((rng || Math.random)()), 0, .999999999999);
  const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
  const jobs = c => Array.isArray(c?.breedingJobs) ? c.breedingJobs : [];
  function choose(entries, rng) {
    let ticket = random(rng) * entries.reduce((n, entry) => n + entry[1], 0);
    return (entries.find(entry => (ticket -= entry[1]) < 0) || entries[entries.length - 1])[0];
  }
  function normalizeMutations(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const result = {hp: 0, attack: 0, power: 0, sixStar: source.sixStar === true};
    let remaining = CONFIG.MAX_MUTATIONS - (result.sixStar ? 1 : 0);
    for (const key of ['hp', 'attack', 'power']) { result[key] = clamp(integer(source[key]), 0, remaining); remaining -= result[key]; }
    return result;
  }
  function mutationSummary(pet) {
    const m = normalizeMutations(pet?.mutations || pet);
    return {...m, count: m.hp + m.attack + m.power + (m.sixStar ? 1 : 0)};
  }
  function rollMutations(spectralParent, rng) {
    const count = choose(CONFIG.COUNT_WEIGHTS.map((weight, n) => [n, spectralParent && n === 0 ? 0 : weight]), rng);
    const result = {hp: 0, attack: 0, power: 0, sixStar: false};
    for (let i = 0; i < count; i++) {
      const type = choose(Object.entries(CONFIG.TYPE_WEIGHTS).map(([type, weight]) => [type, type === 'sixStar' && result.sixStar ? 0 : weight]), rng);
      if (type === 'sixStar') result.sixStar = true; else result[type]++;
    }
    return result;
  }
  function isParentLocked(c, id) { return jobs(c).some(job => job.parentAId === id || job.parentBId === id); }
  function eligibleParents(c, options = {}) {
    const T = getTides(), now = nowOf(options);
    return (c?.pets || []).filter(pet => { const species = T.getSpecies(pet); return species && !species.hybrid && !T.remainingInjury(pet, now) && !isParentLocked(c, pet.id); });
  }
  function status(c, stationId, now = Date.now()) {
    const job = jobs(c).find(item => item.stationId === stationId);
    if (!job) return null;
    const remainingMs = Math.max(0, job.readyAt - nowOf({now})), ready = remainingMs === 0, revealed = ready && job.revealed === true;
    return {id: job.id, stationId: job.stationId, parentAId: job.parentAId, parentBId: job.parentBId,
      startedAt: job.startedAt, readyAt: job.readyAt, remainingMs, ready, revealed,
      phase: revealed ? 'revealed' : ready ? 'ready' : 'incubating', offspring: revealed ? clone(job.offspring) : null};
  }
  function start(c, stationId, parentAId, parentBId, options = {}) {
    const T = getTides(), now = nowOf(options);
    if (!c || !validId(stationId)) return {ok: false, reason: 'station'};
    if (c.activeBattle) return {ok: false, reason: 'battle'};
    if (jobs(c).some(job => job.stationId === stationId)) return {ok: false, reason: 'busy'};
    if (parentAId === parentBId) return {ok: false, reason: 'same'};
    const a = c.pets?.find(p => p.id === parentAId), b = c.pets?.find(p => p.id === parentBId);
    if (!a || !b) return {ok: false, reason: 'unowned'};
    const sa = T.getSpecies(a), sb = T.getSpecies(b);
    if (!sa || !sb) return {ok: false, reason: 'unowned'};
    if (sa.hybrid || sb.hybrid) return {ok: false, reason: 'hybrid-parent'};
    if (sa.id === sb.id) return {ok: false, reason: 'same-species'};
    if (T.remainingInjury(a, now) || T.remainingInjury(b, now)) return {ok: false, reason: 'injured'};
    if (isParentLocked(c, a.id) || isParentLocked(c, b.id)) return {ok: false, reason: 'parent-busy'};
    const species = T.getHybrid(sa.id, sb.id);
    if (!species) return {ok: false, reason: 'unknown-hybrid'};
    // Roll before changing any state, then persist the actual result, never a future reroll seed.
    const mutations = rollMutations(sa.spectral || sb.spectral, options.rng);
    const duration = clamp(integer(options.durationMs, CONFIG.DURATION_MS), 1, CONFIG.MAX_DURATION_MS);
    let nextId = Math.max(1, integer(c.nextId, 1)), petId;
    do { petId = 'tide-' + nextId++; } while (c.pets.some(p => p.id === petId) || jobs(c).some(j => j.offspring.id === petId));
    let nextBreedingId = Math.max(1, integer(c.nextBreedingId, 1)), id;
    do { id = 'breed-' + nextBreedingId++; } while (jobs(c).some(j => j.id === id));
    const readyAt = now + duration;
    const offspring = {id: petId, speciesId: species.id, level: CONFIG.OFFSPRING_LEVEL, xp: 0,
      caughtAt: readyAt, injuredUntil: 0, favorite: false, mutations};
    const job = {id, stationId, parentAId: a.id, parentBId: b.id, startedAt: now, readyAt, revealed: false, offspring};
    c.nextId = nextId; c.nextBreedingId = nextBreedingId;
    c.breedingJobs = [...jobs(c), job];
    return {ok: true, job: status(c, stationId, now)};
  }
  function actionable(c, stationId, options) {
    if (c?.activeBattle) return {ok: false, reason: 'battle'};
    const job = jobs(c).find(item => item.stationId === stationId);
    if (!job) return {ok: false, reason: 'missing'};
    if (options?.jobId && job.id !== options.jobId) return {ok: false, reason: 'settled'};
    if (nowOf(options) < job.readyAt) return {ok: false, reason: 'early'};
    return {ok: true, job};
  }
  function reveal(c, stationId, options = {}) {
    const result = actionable(c, stationId, options);
    if (!result.ok) return result;
    result.job.revealed = true;
    return {ok: true, pet: clone(result.job.offspring), job: status(c, stationId, nowOf(options))};
  }
  function claim(c, stationId, options = {}) {
    const result = actionable(c, stationId, options);
    if (!result.ok) return result;
    const job = result.job;
    if (!job.revealed) return {ok: false, reason: 'unrevealed'};
    if (c.pets.some(p => p.id === job.offspring.id)) return {ok: false, reason: 'settled'};
    const pet = clone(job.offspring);
    c.pets.push(pet); c.breedingJobs = jobs(c).filter(j => j !== job);
    return {ok: true, pet, jobId: job.id};
  }
  function normalizeJobs(raw, c, now = Date.now()) {
    const T = getTides(), result = [], stations = new Set(), parents = new Set(), jobIds = new Set(), petIds = new Set(c.pets.map(p => p.id));
    for (const saved of Array.isArray(raw) ? raw : []) {
      if (!saved || !validId(saved.id) || !validId(saved.stationId) || jobIds.has(saved.id) || stations.has(saved.stationId)) continue;
      const a = c.pets.find(p => p.id === saved.parentAId), b = c.pets.find(p => p.id === saved.parentBId);
      if (!a || !b || a.id === b.id || parents.has(a.id) || parents.has(b.id)) continue;
      const sa = T.getSpecies(a), sb = T.getSpecies(b);
      if (!sa || !sb || sa.hybrid || sb.hybrid || sa.id === sb.id) continue;
      const hybrid = T.getHybrid(sa.id, sb.id);
      if (!hybrid || !saved.offspring || saved.offspring.speciesId !== hybrid.id || !validId(saved.offspring.id) || petIds.has(saved.offspring.id)) continue;
      const startedAt = Math.max(0, finite(saved.startedAt, now)), readyAt = finite(saved.readyAt, -1);
      if (readyAt <= startedAt || readyAt > startedAt + CONFIG.MAX_DURATION_MS) continue;
      const offspring = T.normalizePet(saved.offspring, now);
      if (!offspring) continue;
      // An old or malformed spectral result receives a deterministic repair, never a new random roll.
      if ((sa.spectral || sb.spectral) && mutationSummary(offspring).count === 0) offspring.mutations.hp = 1;
      result.push({id: saved.id, stationId: saved.stationId, parentAId: a.id, parentBId: b.id,
        startedAt, readyAt, revealed: saved.revealed === true, offspring});
      stations.add(saved.stationId); parents.add(a.id); parents.add(b.id); jobIds.add(saved.id); petIds.add(offspring.id);
      const petSequence = /^tide-(\d+)$/.exec(offspring.id), jobSequence = /^breed-(\d+)$/.exec(saved.id);
      if (petSequence) c.nextId = Math.max(c.nextId, Number(petSequence[1]) + 1);
      if (jobSequence) c.nextBreedingId = Math.max(c.nextBreedingId, Number(jobSequence[1]) + 1);
    }
    return result;
  }
  return Object.freeze({CONFIG, normalizeMutations, mutationSummary, rollMutations, isParentLocked, eligibleParents,
    status, start, reveal, claim, normalizeJobs});
});
