/* Training series rules. Guild opponents are never collectible wild Tides. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.Tides);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TideGuild = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Tides) {
  'use strict';
  const WINS_REQUIRED = 2;
  const catalogOriginal = Object.freeze(Tides.catalog.filter(species => !species.hybrid).slice());
  const random = rng => Math.max(0, Math.min(.999999999999, Number((rng || Math.random)()) || 0));
  const nowOf = options => {
    const value = typeof options?.now === 'function' ? options.now() : options?.now;
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : Date.now();
  };
  const current = (collection, series) => !!series && collection?.guildSeries === series;
  function rollOpponent(collection, options = {}) {
    const pet = Tides.equipped(collection);
    if (!pet) return null;
    const species = catalogOriginal[Math.floor(random(options.rng) * catalogOriginal.length)];
    return {speciesId: species.id, level: pet.level};
  }
  function start(collection, options = {}) {
    if (!collection?.lassoOwned) return {ok: false, reason: 'lasso'};
    if (collection.activeBattle || collection.guildSeries) return {ok: false, reason: 'battle'};
    const pet = Tides.equipped(collection);
    if (!pet) return {ok: false, reason: 'equipped'};
    let trainer;
    try { trainer = options.trainer == null ? null : JSON.parse(JSON.stringify(options.trainer)); }
    catch (_) { return {ok: false, reason: 'trainer'}; }
    const now = nowOf(options), opponent = rollOpponent(collection, options);
    const series = {id: 'guild-' + collection.nextBattleId + '-' + now, trainer, ownedId: pet.id,
      playerSpeciesId: pet.speciesId, level: pet.level, opponent, round: 1,
      score: {player: 0, foe: 0}, status: 'battling', outcome: null, battleId: null, startedAt: now};
    collection.guildSeries = series;
    const result = Tides.beginBattle(collection, opponent, {...options, now, training: true, guildSeriesId: series.id});
    if (!result.ok) { collection.guildSeries = null; return result; }
    series.battleId = result.battle.id;
    return {...result, series};
  }
  function finishRound(collection, series, battle, options = {}) {
    if (!current(collection, series) || series.status !== 'battling' || series.battleId !== battle?.id)
      return {ok: false, reason: 'settled'};
    const active = collection.activeBattle;
    if (!active?.training || active.guildSeriesId !== series.id) return {ok: false, reason: 'battle'};
    const result = Tides.finishBattle(collection, battle, options);
    if (!result.ok) return result;
    series.score[result.outcome === 'win' ? 'player' : 'foe']++;
    const finished = series.score.player >= WINS_REQUIRED || series.score.foe >= WINS_REQUIRED;
    series.status = finished ? 'finished' : 'between-rounds';
    if (finished) {
      series.outcome = series.score.player >= WINS_REQUIRED ? 'win' : 'loss';
      collection.guildSeries = null;
    }
    return {...result, series, finished};
  }
  function nextRound(collection, series, options = {}) {
    if (!current(collection, series) || series.status !== 'between-rounds') return {ok: false, reason: 'settled'};
    const pet = Tides.equipped(collection);
    if (!pet || pet.id !== series.ownedId || pet.speciesId !== series.playerSpeciesId || pet.level !== series.level)
      return {ok: false, reason: 'equipped'};
    const result = Tides.beginBattle(collection, series.opponent, {...options, training: true, guildSeriesId: series.id});
    if (!result.ok) return result;
    series.round++; series.battleId = result.battle.id; series.status = 'battling';
    return {...result, series};
  }
  function abandon(collection, series, battle, options = {}) {
    if (!current(collection, series)) return {ok: false, reason: 'settled'};
    const active = collection.activeBattle;
    if (active) {
      if (!active.training || active.guildSeriesId !== series.id || active.id !== battle?.id)
        return {ok: false, reason: 'battle'};
      const result = Tides.abandonBattle(collection, battle, options);
      if (!result.ok) return result;
    }
    series.status = 'abandoned'; series.outcome = 'loss'; collection.guildSeries = null;
    return {ok: true, series, outcome: 'loss', finished: true, abandoned: true, captured: null, xp: 0, levels: 0};
  }
  return Object.freeze({WINS_REQUIRED, catalogOriginal, rollOpponent, start, finishRound, nextRound, abandon});
});
