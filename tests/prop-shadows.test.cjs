/* Run with: node --test tests/prop-shadows.test.cjs
 * Exercises the real shadow pass and sprite geometry without starting the game.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot locate game source section: ${start}`);
  return source.slice(a, b);
}
function image(file) {
  const png = fs.readFileSync(path.join(root, 'assets', file));
  return { complete: true, naturalWidth: png.readUInt32BE(16), naturalHeight: png.readUInt32BE(20), file };
}
function close(actual, expected, label = '') {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
}

function harness() {
  const calls = [], stack = [], art = new Map();
  let transform = { x: 0, y: 0, rotation: 0 };
  const ctx = {
    globalAlpha: 1,
    save() { stack.push({ ...transform, alpha: this.globalAlpha }); },
    restore() { const state = stack.pop(); assert.ok(state); this.globalAlpha = state.alpha; transform = state; },
    translate(x, y) {
      transform.x += x * Math.cos(transform.rotation) - y * Math.sin(transform.rotation);
      transform.y += x * Math.sin(transform.rotation) + y * Math.cos(transform.rotation);
    },
    rotate(angle) { transform.rotation += angle; },
    drawImage(img, x, y, width, height) {
      const dx = x + width / 2, dy = y + height / 2;
      calls.push({ img, width, height, alpha: this.globalAlpha, rotation: transform.rotation,
        x: transform.x + dx * Math.cos(transform.rotation) - dy * Math.sin(transform.rotation),
        y: transform.y + dx * Math.sin(transform.rotation) + dy * Math.cos(transform.rotation) });
    },
  };
  const load = file => {
    if (!art.has(file)) art.set(file, image(file));
    return art.get(file);
  };
  const context = vm.createContext({
    CityWorks: { CHIMNEYS: {}, drawSmoke: () => 0 }, performance: { now: () => 0 }, // geometry only: drawProp's hearth smoke over a Home building's chimney
    ctx, zoom: .5, seeThrough: () => 1, mip: img => img,
    tavernImg: load('models/tavern.png'), casinoImg: load('models/casino.png'),
    bankImg: load('models/bank.png'), smithImg: load('models/blacksmith.png'),
    fishhutImg: load('models/fishinghut.png'),
    treeImg: { complete: true, naturalWidth: 500, naturalHeight: 900, _pad: 1.2 },
    treeSnowImg: { complete: true, naturalWidth: 500, naturalHeight: 900, _pad: 1.33 },
    farmImg: name => load(`farm/${name}.png`), cityImg: name => load(`city/${name}.png`),
    document: { createElement() {
      return { shadow: true, getContext: () => ({ scale() {}, fillRect() {},
        createRadialGradient: () => ({ addColorStop() {} }) }) };
    } },
  });
  for (const [start, end] of [
    ['const CATH_ART=', '/* Zone maps'],
    ['const FARM_BUILD=', '/* ⇄/⤢'],
    ['const FARM_SC_MIN=', 'const canFlipDef='],
    ['const HOME_BUILDINGS=', 'function homeBuildingAt('],
    ['function drawPropShadow(', 'function feet('],
  ]) vm.runInContext(section(start, end), context, { filename: `game.js:${start}` });
  vm.runInContext('globalThis.farmDefs=FARM_BUILD;globalThis.cityFeet=CITY_FOOT;', context);
  return { context, ctx, calls, stack, art,
    shadow(s, z = {}) {
      calls.length = 0;
      context.drawPropShadow(s, z);
      assert.equal(stack.length, 0, 'The shadow pass must balance context saves');
      return calls.slice();
    } };
}
const farm = (ftype, it = {}) => ({ type: 'farmitem', ftype, x: 700, y: 900, it });

test('mirroring reflects the calibrated offset and tilt, without moving the ground contact vertically', () => {
  const h = harness();
  // The garden bench was redrawn on 2026-09-16 (ac6e7a6) with a centred, untilted footprint, so it no longer exercises
  // mirroring; the farm sign's shadow sits well off-centre and does. No piece is tilted any more - the sign flip of the
  // rotation is still held for all of them below.
  for (const id of ['farmsign', 'light_farm', 'windmill']) {
    const s = farm(id), [normal] = h.shadow(s), [flipped] = h.shadow({ ...s, it: { fl: -1 } });
    assert.ok(normal && flipped, id);
    assert.notEqual(normal.x, s.x, `${id} must exercise an asymmetric footprint`);
    close(normal.x + flipped.x, 2 * s.x, id);
    close(normal.y, flipped.y, id);
    close(normal.width, flipped.width, id);
    close(normal.height, flipped.height, id);
    close(normal.rotation, -flipped.rotation, id);
  }
});

test('doubling farm scale doubles the footprint and its offsets around the same world anchor', () => {
  const h = harness();
  for (const id of ['bench', 'light_farm', 'windmill']) {
    const s = farm(id), [normal] = h.shadow(s), [large] = h.shadow({ ...s, it: { sc: 2, fl: -1 } });
    close(large.x - s.x, -2 * (normal.x - s.x), id);
    close(large.y - s.y, 2 * (normal.y - s.y), id);
    close(large.width, 2 * normal.width, id);
    close(large.height, 2 * normal.height, id);
    close(large.rotation, -normal.rotation, id);
  }
});

test('floor decals, carried pieces and mined objects leave no detached shadow', () => {
  const h = harness();
  assert.equal(h.context.farmDefs.find(def => def.id === 'pond').sh, false);
  for (const s of [farm('pond'), { ...farm('bench'), _moving: true }, farm('bench', { _moving: true }),
    { type: 'rock', x: 30, y: 50, r: 20, mined: true }]) {
    assert.equal(h.shadow(s).length, 0);
  }
});

test('all City footprints remain drawn on both sides of the former .42 zoom cutoff', () => {
  const h = harness();
  for (const key of Object.keys(h.context.cityFeet)) {
    const s = { type: key.startsWith('house_') ? 'cityhouse' : key, key, x: 700, y: 900, r: 58 };
    h.context.zoom = .4;
    const low = h.shadow(s, { city: true });
    h.context.zoom = .5;
    const high = h.shadow(s, { city: true });
    assert.equal(low.length, 1, `${key}: zoomed-out shadow missing`);
    assert.deepEqual(low, high, `${key}: zoom must not change world-space shadow geometry`);
    assert.ok(low[0].width > 0 && low[0].height > 0);
  }
});

test('Home shadows use the same image frame as each rendered building', () => {
  const h = harness();
  for (const type of ['house', 'casino', 'bank', 'smith', 'fishhut']) {
    const s = { type, big: true, x: 1400, y: 1700, r: type === 'fishhut' ? 30 : 52 };
    const [shadow] = h.shadow(s), frame = h.context.homeBuildingFrame(s), foot = frame.def.foot;
    h.calls.length = 0;
    h.context.drawProp(s, { tavern: true }, false);
    assert.equal(h.calls.length, 1, `${type}: the sprite pass must not redraw its shadow`);
    const sprite = h.calls[0];
    close(shadow.x, sprite.x + sprite.width * foot.cx, type);
    close(shadow.y, sprite.y + sprite.height * (foot.cy - .5), type);
    close(shadow.width, 2 * sprite.width * foot.rx, type);
    close(shadow.height, 2 * sprite.height * foot.ry, type);
  }
});

test('the cached ground shadow preserves caller opacity and context state', () => {
  const h = harness();
  h.ctx.globalAlpha = .4;
  const [first] = h.shadow(farm('bench')), [second] = h.shadow(farm('windmill'));
  assert.equal(first.img, second.img, 'One gradient canvas is reused across props');
  close(first.alpha, .4 * .27);
  close(h.ctx.globalAlpha, .4);
  assert.equal(h.stack.length, 0);
});
