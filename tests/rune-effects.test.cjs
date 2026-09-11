/* Real effect functions and shipped UV profiles; no game startup or saved state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/weapons/rune-effects.js'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'assets/weapons/rune-profiles.js'), 'utf8');

function harness() {
 let canvases = 0;
 const context = vm.createContext({parts: [], gamePaused: false, performance: {now: () => 500},
  document: {createElement() {
   canvases++;
   return {width: 0, height: 0, getContext: () => ({drawImage() {}, fillRect() {},
    createLinearGradient: () => ({addColorStop() {}})})};
  }},
 });
 vm.runInContext(profiles + '\n' + source, context, {filename: 'rune-effects.js'});
 return {context, get canvases() {return canvases;}};
}
const rune = id => ({id, glow: '#aabbcc'});
const emission = (extra = {}) => ({key: 'test-weapon', size: 1, points: [{x: 12, y: 25}], ...extra});
const image = (extra = {}) => ({src: 'file:///game/assets/weapons/bow.png?v=1', naturalWidth: 170,
 naturalHeight: 1187, complete: true, ...extra});
function close(actual, expected) {assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);}
function emitSeconds(h, id, seconds = 1, fps = 60, e = emission()) {
 for (let i = 0; i < seconds * fps; i++) h.context.runeSpark(rune(id), e, 1 / fps, 45);
 return h.context.parts;
}

test('emission rates remain stable at 30, 60 and 144 FPS', () => {
 for (const [id, rate] of Object.entries({emberbite: 9, frostgrip: 3.2, veinseeker: 3.8, stormetch: 4.2, goldrune: 3})) {
  const counts = [30, 60, 144].map(fps => emitSeconds(harness(), id, 10, fps).length);
  assert.ok(counts.every(count => Math.abs(count - rate * 10) <= 1), `${id}: ${counts}`);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${id}: ${counts}`);
 }
});

test('paused and zero-time render calls never produce particles or a deferred burst', () => {
 const h = harness();
 h.context.gamePaused = true;
 emitSeconds(h, 'emberbite', 10);
 h.context.gamePaused = false;
 for (const dt of [0, -1, NaN]) for (let i = 0; i < 100; i++)
  h.context.runeSpark(rune('emberbite'), emission(), dt, 45);
 assert.equal(h.context.parts.length, 0);
 h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
 assert.equal(h.context.parts.length, 0, 'Pausing must not bank ten seconds of emission');
});

test('extra redraws without a simulation tick preserve accrued emission time', () => {
 const normal = harness(), redrawn = harness();
 for (let frame = 0; frame < 600; frame++) {
  normal.context.runeSpark(rune('emberbite'), emission(), 1 / 60, 45);
  redrawn.context.runeSpark(rune('emberbite'), emission(), 1 / 60, 45);
  for (let draw = 0; draw < 3; draw++) redrawn.context.runeSpark(rune('emberbite'), emission(), 0, 45);
 }
 assert.ok(normal.context.parts.length > 80);
 assert.equal(redrawn.context.parts.length, normal.context.parts.length);
});

test('missing weapon data and weapon switches reset fractional emission progress', () => {
 for (const reset of [h => h.context.runeSpark(null, emission(), .05, 45),
  h => h.context.runeSpark(rune('emberbite'), null, .05, 45),
  h => h.context.runeSpark(rune('emberbite'), emission({points: []}), .05, 45),
  h => h.context.resetRuneEmission()]) {
  const h = harness();
  h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
  h.context.runeSpark(rune('emberbite'), emission(), .05, 45); // Carry .9 of one ember.
  reset(h);
  h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
  assert.equal(h.context.parts.length, 0);
 }
 const h = harness();
 h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
 h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
 const next = emission({key: 'new-weapon', points: [{x: -31, y: 4}]});
 h.context.runeSpark(rune('emberbite'), next, .05, 45);
 assert.equal(h.context.parts.length, 0);
 h.context.runeSpark(rune('emberbite'), next, .05, 45);
 h.context.runeSpark(rune('emberbite'), next, .05, 45);
 assert.equal(h.context.parts.length, 1);
 assert.equal(h.context.parts[0].x, -31);
});

test('materials have distinct motion and spawn exactly on profile points without positional scatter', () => {
 const points = [{x: 17.125, y: 10}, {x: 24.625, y: 31}, {x: 30.875, y: 30}];
 for (const [id, kind] of Object.entries({emberbite: 'ember', frostgrip: 'water', veinseeker: 'blood', stormetch: 'spark', goldrune: 'gold'})) {
  const h = harness(), particles = emitSeconds(h, id, 2, 60, emission({points}));
  assert.ok(particles.length > 0);
  for (const p of particles) {
   assert.equal(p.runeFx, kind);
   assert.ok(points.some(q => q.x === p.x && q.y === p.y), `${id}: particle scattered off the art`);
   if (kind === 'water' || kind === 'blood') {
    assert.ok(p.y >= 28, 'Liquid chooses the lowest transformed attachment points');
    assert.ok(p.vy > 0 && p.g > 0);assert.equal(p.floorY, 45);
   } else if (kind === 'ember') {
    assert.ok(p.vy < 0 && p.g < 0);assert.equal(p.floorY, undefined);
   } else if (kind === 'spark') {
    assert.ok(p.life <= .17 && p.r <= .25);assert.equal(p.g, 0);
   } else assert.ok(p.r <= .35 && p.life <= .6);
  }
 }
});

test('water and blood land once, stop moving and expire as bounded splash effects', () => {
 for (const id of ['frostgrip', 'veinseeker']) {
  const h = harness(), p = emitSeconds(h, id)[0], kind = p.runeFx;
  let i = 0;
  while (p.floorY !== undefined && i++ < 100) assert.equal(h.context.stepRuneParticle(p, 1 / 60), false);
  assert.ok(i < 100, `${id}: drop did not reach the floor`);
  assert.equal(p.runeFx, kind + '-splash');assert.equal(p.y, 45);
  assert.equal(p.t, 0);assert.equal(p.vx, 0);assert.equal(p.vy, 0);assert.equal(p.g, 0);
  assert.equal(p.floorY, undefined);
  const life = p.life, x = p.x;
  assert.equal(h.context.stepRuneParticle(p, .1), false);
  assert.equal(p.runeFx, kind + '-splash');assert.equal(p.t, .1);assert.equal(p.x, x);assert.equal(p.y, 45);
  assert.equal(h.context.stepRuneParticle(p, life), true);
 }
});

test('analytic free-flight motion agrees across frame rates', () => {
 const states = [30, 60, 144].map(fps => {
  const h = harness(), p = {x: 12, y: -30, vx: 3, vy: 2, g: 94, t: 0, life: 2, runeFx: 'water'};
  for (let i = 0; i < fps; i++) h.context.stepRuneParticle(p, 1 / fps);
  return p;
 });
 for (const p of states) {close(p.x, 15);close(p.y, 19);close(p.vy, 96);close(p.t, 1);}
});

test('profile emitters follow flip, rotation and scene DPR/zoom/camera transforms', () => {
 const h = harness();
 // Local UV (.25,.8) in (-5,-20,10,40) gives (-2.5,12).
 // Flip X, rotate 90 degrees, then move to hero (100,200): world (88,202.5).
 // Scene DPR 2 * zoom 1.5, camera (30,50), shake (2,3): canvas (180,466.5).
 const transform = {a: 0, b: -3, c: -3, d: 0, e: 216, f: 459};
 const sp = {key: 'known', profile: {emit: [[.25, .8]]}};
 const result = h.context.runeEmitter({getTransform: () => transform}, sp, -5, -20, 10, 40);
 close(result.points[0].x, 180);close(result.points[0].y, 466.5);
 const world = h.context.runePointTransform({a: 1 / 3, b: 0, c: 0, d: 1 / 3, e: 28, f: 47}, result.points[0]);
 close(world.x, 88);close(world.y, 202.5);
 transform.e = 900;
 close(result.points[0].x, 180); // Captured positions cannot move with a later canvas transform.
 assert.equal(h.context.runeEmitter({}, null, 0, 0, 10, 40), null);
 assert.equal(h.context.runeEmitter({}, {profile: {emit: []}}, 0, 0, 10, 40), null);
});

test('glow caches respect image identity, source changes and separate anonymous canvases', () => {
 const h = harness(), a = image(), b = image();
 const first = h.context.runeGlowSprite(a, '#f80', .1);
 assert.equal(h.context.runeGlowSprite(a, '#f80', .1), first);assert.equal(h.canvases, 2);
 assert.notEqual(h.context.runeGlowSprite(b, '#f80', .1), first);assert.equal(h.canvases, 4);
 a.src += '&revision=2';assert.notEqual(h.context.runeGlowSprite(a, '#f80', .1), first);
 const c = {width: 100, height: 200}, d = {width: 100, height: 200};
 assert.notEqual(h.context.runeGlowSprite(c, '#f80', 0), h.context.runeGlowSprite(d, '#f80', 0));
 assert.equal(h.context.runeGlowSprite(image({complete: false}), '#f80', 0), null);
 assert.equal(h.context.runeGlowSprite({naturalWidth: 0, naturalHeight: 0}, '#f80', 0), null);
 assert.equal(h.context.runeProfileFor(image({src: 'file:///assets/weapons/bow%2Epng?rev=4#tip'})), first.profile);
});

test('the shared particle limit prevents runaway rune allocation', () => {
 const h = harness();h.context.parts = Array.from({length: 479}, () => ({}));
 emitSeconds(h, 'emberbite', 10);
 assert.equal(h.context.parts.length, 480);
 h.context.parts = [];
 h.context.runeSpark(rune('emberbite'), emission(), .05, 45);
 assert.ok(h.context.parts.length <= 1, 'A full particle pool must not bank a large future burst');
});
