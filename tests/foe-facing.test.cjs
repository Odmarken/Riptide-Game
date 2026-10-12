/* Run with: node --test tests/foe-facing.test.cjs
 * 🐾 Which way a painted foe looks (2026-10-12: "mobbsen i level zonerna speglas inte åt det hållet dom går åt ... går dom vänster
 * tittar dom höger"). The real foeFacing, cut out of game.js: at its prey while it chases or fights, the guard it is set on in the
 * City, and otherwise the way it walks - and the painted foe's mirror is that facing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };

test('a foe looks the way it walks, at the hero while it chases or fights, and keeps its last way while it stands', () => {
  const c = vm.createContext({ hero: { x: 500, y: 0 } });
  vm.runInContext(section('function foeFacing(en){', 'function drawEnemy(en){'), c);
  const en = { x: 100, state: 'wander' }, look = more => { Object.assign(en, more); return c.foeFacing(en); };
  assert.equal(c.foeFacing({ x: 100, state: 'wander' }), 1, 'a foe that has not walked yet looks at the hero, as before');
  assert.equal(look({ fx: -1 }), -1, 'wandering left with the hero on the right: it looks left');
  assert.equal(look({ fx: 1 }), 1, 'wandering right: right');
  assert.equal(look({ fx: -0.9, fy: 0.4 }), -1);
  assert.equal(look({ fx: 0.1, fy: -1 }), -1, 'nearly straight up or down: the way it last faced');
  assert.equal(look({ pause: true }), -1, 'standing about: the same');
  assert.equal(look({ state: 'chase', fx: -1 }), 1, 'chasing or fighting: at its prey');
  c.hero.x = 50; assert.equal(look({ state: 'chase', fx: 1 }), -1, 'and turns with it');
  assert.equal(look({ state: 'return', fx: 1 }), 1, 'going home: the way home');
  assert.equal(look({ state: 'wander', face: -1, fx: 1 }), -1, 'set on a guard in the City: at the guard');
  vm.runInContext('hero=null', c);
  assert.equal(c.foeFacing({ x: 0, state: 'chase' }), 1, 'no hero (a menu behind): no error');
});

test('the painted foe is mirrored by that facing - no longer by where the hero stands', () => {
  const draw = section('function drawEnemy(en){', '\nfunction drawMiniBar(');
  const painted = draw.slice(draw.indexOf('}else if(mobSkin){'), draw.indexOf("}else if(en.kind==='beast'){"));
  assert.match(painted, /const fx=foeFacing\(en\);[^\n]*\n[^]*?ctx\.scale\(fx,1\);/);
  assert.doesNotMatch(painted, /hero\.x<en\.x/);
});
