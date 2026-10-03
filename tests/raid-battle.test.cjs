/* Run with: node --test tests/raid-battle.test.cjs
 * ⚔ The raid as a battle (assets/city/raid-battle.js, asked for 2026-10-03): the crown's men ringed in and sent, the garrison in ranks
 * with its archers behind, everybody on the streets and never through a house or the water, and a house burned only when the men at
 * its door are left alone long enough. A synthetic port: land above y=1700 and the sea below it, a pier down to the ship, three rows
 * of houses with a gap in the middle row. */
const test = require('node:test');
const assert = require('node:assert/strict');
const RB = require('../assets/city/raid-battle.js');

const W = 3200, H = 2100, pier = { x: 1520, y: 1680, w: 160, h: 400 };
const houses = [];
for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { if (row === 1 && i === 4) continue; houses.push({ x: 300 + i * 320, y: 500 + row * 420 }); }
const blocked = (x, y, r) => {
  if (x < r || y < r || x > W - r || y > H - r) return true;
  const onPier = x > pier.x && x < pier.x + pier.w && y > pier.y && y < pier.y + pier.h;
  if (y + r > 1700 && !onPier) return true;
  for (const h of houses) { const kx = (x - h.x) / (110 + r), ky = (y - h.y) / (60 + r); if (kx * kx + ky * ky < 1) return true; }
  return false;
};
const rngOf = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function battle(seed = 7, { ours = 60, theirs = 36, archers = 3 } = {}) {
  const us = [], them = [];
  for (let i = 0; i < ours; i++) { const row = Math.floor(i / 4), col = (i % 4) - 1.5; us.push({ kind: i < 10 ? 'watch' : i < 20 ? 'cadet' : 'merc', p: 3.5, x: 1600 + col * 30, y: 2030 - row * 22 }); }
  for (let i = 0; i < theirs; i++) { const sq = i % 3; them.push({ kind: (i % 12) < archers ? 'archer' : 'melee', p: 3.2, x: 600 + sq * 1000 + (i % 5) * 30, y: 200 + (i % 7) * 20, squad: sq }); }
  return RB.create({ w: W, h: H, blocked, rng: rngOf(seed), stage: { x: 1600, y: 1600 }, arrival: { x: 1600, y: 2040 }, ours: us, theirs: them,
    squads: [{ x: 900, y: 1300, fx: 1, fy: 1 }, { x: 1600, y: 1250, fx: 0, fy: 1 }, { x: 2300, y: 1300, fx: -1, fy: 1 }],
    buildings: houses.map((h, i) => ({ key: 'h' + i, x: h.x, y: h.y, r: 60, weight: 1 })) });
}
function run(B, sec, seen = {}) {
  let inside = 0;
  for (let t = 0; t < sec; t += 1 / 30) {
    RB.tick(B, 1 / 30);
    for (const u of B.units) if (u.alive && blocked(u.x, u.y, 8)) inside++;
    for (const e of B.events.splice(0)) seen[e.type] = (seen[e.type] || 0) + 1;
  }
  return { inside, seen };
}

test('a path goes round the houses and never over the water, and a man can walk it', () => {
  const B = battle();
  const p = RB.findPath(B, 1600, 1600, 1600, 300);
  assert.ok(p && p.length >= 2, 'a way up through the gap in the rows');
  let prev = { x: 1600, y: 1600 };
  for (const q of p) { const n = Math.ceil(Math.hypot(q.x - prev.x, q.y - prev.y) / 10); for (let k = 1; k <= n; k++) { const x = prev.x + (q.x - prev.x) * k / n, y = prev.y + (q.y - prev.y) * k / n; assert.ok(!blocked(x, y, 8), 'open ground at ' + Math.round(x) + ',' + Math.round(y)); } prev = q; }
  const sea = RB.findPath(B, 1600, 1600, 200, 1950), end = sea && sea[sea.length - 1];
  assert.ok(end && !blocked(end.x, end.y, 8) && end.y < 1700, 'a click on the sea walks them to the shore, not into it');
});

test('the garrison musters into its ranks, archers behind the shields, and our men form up at the pier head', () => {
  const B = battle();
  B.assaultCool = 1e9;   /* held back from attacking, to see the ranks */
  const { inside } = run(B, 25);
  assert.equal(inside, 0, 'nobody ever stood in a house or the water');
  for (const S of B.squads) {
    const al = S.units.filter(u => u.alive);
    const c = al.reduce((a, u) => ({ x: a.x + u.x / al.length, y: a.y + u.y / al.length }), { x: 0, y: 0 });
    assert.ok(Math.hypot(c.x - S.anchor.x, c.y - S.anchor.y) < 120, 'squad ' + S.id + ' stands at its post');
    const L = Math.hypot(S.face.x, S.face.y), fx = S.face.x / L, fy = S.face.y / L, depth = u => (u.x - S.anchor.x) * fx + (u.y - S.anchor.y) * fy;
    const bows = al.filter(u => u.kind === 'archer'), mel = al.filter(u => u.kind !== 'archer');
    assert.ok(Math.max(...bows.map(depth)) < Math.min(...mel.map(depth)), 'the archers behind the last shield');
  }
  assert.ok(RB.alive(B, 'us').filter(u => Math.hypot(u.x - 1600, u.y - 1600) < 320).length >= 55, 'the men off the pier');
});

test('the garrison attacks on its own: our men only stand at the pier head, and it comes at them as one body', () => {
  const B = battle(6);
  const seen = {}, theirHits = { n: 0 };
  let assaults = 0, squadsIn = 0;
  for (let t = 0; t < 70; t += 1 / 30) {
    RB.tick(B, 1 / 30);
    for (const e of B.events.splice(0)) { seen[e.type] = (seen[e.type] || 0) + 1; if (e.type === 'hit' && e.side === 'them') theirHits.n++; if (e.type === 'assault') { assaults++; squadsIn = Math.max(squadsIn, B.squads.filter(S => S.attack).length); } }
  }
  assert.ok(assaults >= 1, 'it went in: ' + JSON.stringify(seen));
  assert.ok(squadsIn >= 2, 'more than one squad together, not one alone: ' + squadsIn);
  assert.ok(theirHits.n > 20, 'and its men struck ours: ' + theirHits.n);
});

test('a hunt: every man goes at the foe nearest him, a few to a foe, and on to the next until none stand', () => {
  const B = battle(8, { ours: 40, theirs: 12, archers: 2 });
  B.assaultCool = 1e9;
  run(B, 20);
  assert.ok(RB.order(B, RB.alive(B, 'us'), { type: 'hunt' }));
  const load = new Map(); for (const u of RB.alive(B, 'us')) if (u.target) load.set(u.target, (load.get(u.target) || 0) + 1);
  assert.ok(load.size >= 4, 'spread over the foes, not all on one: ' + load.size);
  run(B, 60);
  assert.equal(RB.alive(B, 'them').length, 0, 'none of them left');
  assert.equal(RB.order(B, RB.alive(B, 'us'), { type: 'hunt' }), false, 'nothing left to hunt');
});

test('a ringed-in body goes where it is sent, in ranks, no two men in one place', () => {
  const B = battle();
  run(B, 20);
  const men = RB.alive(B, 'us').slice(0, 24);
  RB.select(B, men);
  assert.equal(RB.selected(B).length, 24);
  assert.ok(RB.order(B, RB.selected(B), { type: 'move', x: 2600, y: 1550 }));
  run(B, 25);
  const there = men.filter(u => u.alive && Math.hypot(u.x - 2600, u.y - 1550) < 260);
  assert.ok(there.length >= men.filter(u => u.alive).length - 2, there.length + ' of them there');
  for (let i = 0; i < there.length; i++) for (let j = i + 1; j < there.length; j++) assert.ok(Math.hypot(there[i].x - there[j].x, there[i].y - there[j].y) > 12, 'not stacked');
  assert.deepEqual(RB.inBox(B, 2300, 1300, 2900, 1700).filter(u => men.includes(u)).length, there.length, 'a box round them rings in the same men');
});

test('archers loose together at one man, and they hit', () => {
  const B = battle(11);
  const marks = new Set(), seen = {};
  for (let t = 0; t < 40; t += 1 / 30) { RB.tick(B, 1 / 30); for (const e of B.events.splice(0)) { seen[e.type] = (seen[e.type] || 0) + 1; } for (const u of B.theirs) if (u.kind === 'archer' && u.shootAt != null && u.mark) marks.add(u.squad.id + ':' + u.mark.id); }
  if (seen.shoot) assert.ok(seen.arrowHit > 0, 'arrows that land');
  RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 1600, y: 1350 });
  run(B, 15, seen);
  assert.ok(seen.shoot >= 6, 'volleys as the men come up the street: ' + seen.shoot);
});

test('a house burns only while the men at its door are left alone - and once only', () => {
  const B = battle();
  run(B, 20);
  const b = B.buildings.slice().sort((a, c) => Math.hypot(a.x - 1600, a.y - 1340) - Math.hypot(c.x - 1600, c.y - 1340))[0];
  assert.ok(RB.order(B, RB.alive(B, 'us'), { type: 'burn', building: b }));
  let contested = false, burned = 0;
  for (let t = 0; t < 60 && !b.razed; t += 1 / 30) { RB.tick(B, 1 / 30); if (b.contested) contested = true; for (const e of B.events.splice(0)) if (e.type === 'burned') burned++; }
  assert.ok(contested, 'the garrison came to stop them');
  assert.equal(b.razed, true); assert.equal(burned, 1, 'one burned event');
  run(B, 5); assert.equal(B.events.filter(e => e.type === 'burned').length, 0, 'and never again');
});

test('the garrison is no easy kill: a full assault costs men, and the badly wounded are pulled back behind the line', () => {
  const B = battle(3);
  run(B, 20);
  const b = B.buildings.slice().sort((a, c) => Math.hypot(a.x - 1600, a.y - 1340) - Math.hypot(c.x - 1600, c.y - 1340))[0];
  RB.order(B, RB.alive(B, 'us'), { type: 'burn', building: b });
  let pulledBack = 0;
  for (let t = 0; t < 30; t += 1 / 30) { RB.tick(B, 1 / 30); B.events.length = 0; for (const u of B.theirs) if (u.alive && u.wounded && u.squad && u.squad.rear && Math.hypot(u.x - u.squad.rear.x, u.y - u.squad.rear.y) < 80) pulledBack++; }
  assert.ok(B.ours.filter(u => !u.alive).length >= 3, 'men went down: ' + B.ours.filter(u => !u.alive).length);
  assert.ok(pulledBack > 0, 'a wounded soldier stood back behind his squad');
});

test('the retreat: every man of ours walks to the ship, and the garrison lets them go', () => {
  const B = battle();
  run(B, 20);
  RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 1600, y: 1350 });
  run(B, 10);
  RB.sound(B);
  assert.equal(RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 1000, y: 1500 }), false, 'no orders once the retreat is sounded');
  run(B, 40);
  const left = RB.alive(B, 'us').filter(u => !(u.boarded > 0));
  assert.equal(left.length, 0, left.length + ' still ashore');
  assert.ok(B.squads.every(S => S.state === 'regroup' || S.state === 'gone' || S.state === 'hold'));
});

test('men who have reached their places stand still - packed at a door or in ranks, nobody shakes', () => {
  const B = battle(9, { theirs: 0 });
  run(B, 20);
  const b = B.buildings.slice().sort((a, c) => Math.hypot(a.x - 1600, a.y - 1340) - Math.hypot(c.x - 1600, c.y - 1340))[0];
  RB.order(B, RB.alive(B, 'us'), { type: 'burn', building: b });
  run(B, 30);
  assert.equal(b.razed, true, 'burned with nobody to stop them');
  let at = B.ours.map(u => [u.x, u.y]);
  run(B, 3);
  let moved = B.ours.filter((u, i) => Math.hypot(u.x - at[i][0], u.y - at[i][1]) > 3).length;
  assert.ok(moved <= 2, moved + ' men still shifting about at the door');
  RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 2200, y: 1550 });
  run(B, 30);
  at = B.ours.map(u => [u.x, u.y]);
  run(B, 3);
  moved = B.ours.filter((u, i) => Math.hypot(u.x - at[i][0], u.y - at[i][1]) > 3).length;
  assert.ok(moved <= 2, moved + ' men still shifting about in the ranks');
});

test('more of the garrison: a body of new men from a door, by the streets to a stand of their own, a squad like the rest', () => {
  const B = battle(4);
  B.assaultCool = 1e9;   /* held back from attacking, to see where they stand */
  run(B, 10);
  const S = RB.reinforce(B, Array.from({ length: 10 }, (_, i) => ({ kind: i < 3 ? 'archer' : 'melee', p: 3.2, skin: 'x' })), { x: 1600, y: 150 }, { x: 1600, y: 1250 }, { x: 0, y: 1 });
  assert.equal(S.units.length, 10); assert.equal(B.theirs.filter(u => u.squad === S).length, 10);
  assert.ok(S.units.every(u => u.speed > 100), 'they come at a run');
  const { inside } = run(B, 30);
  assert.equal(inside, 0, 'by the streets, not through the houses');
  const al = S.units.filter(u => u.alive), c = al.reduce((a, u) => ({ x: a.x + u.x / al.length, y: a.y + u.y / al.length }), { x: 0, y: 0 });
  assert.ok(Math.hypot(c.x - S.anchor.x, c.y - S.anchor.y) < 220, 'at their stand: ' + Math.round(Math.hypot(c.x - S.anchor.x, c.y - S.anchor.y)));
});

test('the backup runs down from its door straight at our men, wherever in the town they are', () => {
  const B = battle(10);
  B.assaultCool = 1e9;   /* the garrison holds its stands: only the new men come */
  RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 300, y: 1560 });
  run(B, 20);
  const S = RB.reinforce(B, Array.from({ length: 12 }, (_, i) => ({ kind: i < 3 ? 'archer' : 'melee', p: 3.2, skin: 'x' })), { x: 3000, y: 150 }, { x: 3000, y: 150 }, { x: -1, y: 1 }, true);
  assert.ok(S.attack && B.assault === S.attack, 'they go in at once, not to a stand to wait');
  let hits = 0, inside = 0;
  for (let t = 0; t < 50; t += 1 / 30) {
    RB.tick(B, 1 / 30);
    for (const u of S.units) if (u.alive && blocked(u.x, u.y, 8)) inside++;
    for (const e of B.events.splice(0)) if (e.type === 'hit' && e.by && e.by.squad === S) hits++;
  }
  assert.equal(inside, 0, 'by the streets');
  assert.ok(hits > 10, 'across the town and into our men: ' + hits + ' blows');
});

test('an attack keeps after men who walk away from it, and falls back near them after - not to its stands across the town', () => {
  const B = battle(9);
  let A = null, moved = false, ended = null;
  const part = new Set();
  for (let t = 0; t < 160 && !ended; t += 1 / 30) {
    RB.tick(B, 1 / 30);
    for (const e of B.events.splice(0)) if (e.type === 'assault' && !moved) { moved = true; RB.order(B, RB.alive(B, 'us'), { type: 'move', x: 300, y: 1560 }); }
    if (B.assault) { A = B.assault; for (const S of B.squads) if (S.attack === A) part.add(S); } else if (A && moved) ended = A;
  }
  assert.ok(moved && ended, 'it went in, and it ended');
  assert.ok(ended.contact > 0, 'they caught up with the men who walked off');
  const far = [...part].filter(S => S.units.some(u => u.alive) && Math.hypot(S.home.x - ended.at.x, S.home.y - ended.at.y) > RB.CONST.FALLBACK + 100);
  assert.ok(far.length >= 1, 'a squad from a stand far from the fight');
  for (const S of far) {
    const d = Math.hypot(S.anchor.x - ended.at.x, S.anchor.y - ended.at.y);
    assert.ok(d < RB.CONST.FALLBACK + 120 && d > RB.CONST.FALLBACK * .6, 'squad ' + S.id + ' forms up out of reach near the fight: ' + Math.round(d));
  }
});

test('the same seed plays the same battle', () => {
  const a = battle(5), b = battle(5);
  run(a, 30); run(b, 30);
  assert.deepEqual(a.units.map(u => [Math.round(u.x), Math.round(u.y), Math.round(u.hp)]), b.units.map(u => [Math.round(u.x), Math.round(u.y), Math.round(u.hp)]));
});
