/* Real character PNGs and production layout/render functions; no game startup,
 * account, network or save state is used. Run with node --test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { readRgbaPng } = require('./helpers/png.cjs');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'assets/characters/layout.js'), 'utf8');
const races = ['human', 'dwarf', 'orc', 'undead'];
const classes = ['warrior', 'mage', 'hunter', 'priest'];
const heroes = races.flatMap(race => ['male', 'female'].flatMap(gender =>
  [...classes, 'armor'].map(cls => `${race}${gender}_${cls}`)));
const names = [...heroes, 'npc/npc_male', 'npc/npc_female', 'npc/npc_sebbe'];
const art = new Map();

function png(name) {
  if (!art.has(name)) art.set(name, readRgbaPng(path.join(root, 'assets/characters', `${name}.png`)));
  return art.get(name);
}
function image(name, extra = {}) {
  const { width, height } = png(name);
  return { src: `file:///game/assets/characters/${name}.png?v=layout#ready`,
    complete: true, naturalWidth: width, naturalHeight: height, ...extra };
}
function close(actual, expected, label = '') {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
}
function section(start, end) {
  const a = game.indexOf(start), b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
  return game.slice(a, b);
}
function visibleBounds(im) {
  let left = im.width, top = im.height, right = -1, bottom = -1;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
    if (im.pixels[(y * im.width + x) * 4 + 3] <= 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return [left, top, right + 1 - left, bottom + 1 - top];
}
function harness(overrides = {}) {
  const lookups = [], draws = [], translations = [], stack = [];
  const ctx = {
    save() { stack.push(true); }, restore() { assert.ok(stack.pop(), 'Balanced canvas saves'); },
    scale() {}, rotate() {}, translate(x, y) { translations.push([x, y]); },
    drawImage(img, ...rect) { draws.push({ img, rect }); },
  };
  const images = new Map();
  const context = vm.createContext({ ctx, bootImg: image('fot'), CHAR_RUN: {},
    RACES: races.map(id => ({ id })), performance: { now: () => 0 },
    charSprite(race, cls, female) {
      const name = `${race}${female ? 'female' : 'male'}_${cls}`;
      lookups.push(name);
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (!images.has(name)) images.set(name, image(name));
      return images.get(name);
    },
    mip: img => img, crisp: img => img, isFGLegend: () => false,
    swordImg: { src: 'sword.png', complete: true, naturalWidth: 200, naturalHeight: 800 },
  });
  const aliases = ['RACE_ALIAS', 'CLASS_ALIAS'].map(name => {
    const match = game.match(new RegExp(`const ${name}=.*?;`));
    assert.ok(match, `Missing ${name}`);
    return match[0];
  }).join('\n');
  vm.runInContext(`${layout}\n${aliases}\nglobalThis.bounds=CHARACTER_BOUNDS;`, context);
  vm.runInContext(section('function femBootW(', 'const brunnImg='), context);
  vm.runInContext(section('function drawChampionSprite(', 'function drawPadPrompt('), context);
  return { context, lookups, draws, translations, stack };
}

test('all 43 reviewed body bounds match the shipped PNG alpha above 128 exactly', () => {
  const { context } = harness();
  assert.equal(heroes.length, 40);
  assert.deepEqual(Object.keys(context.bounds).sort(), [...names].sort());
  for (const name of names) {
    const im = png(name);
    assert.deepEqual(Array.from(context.bounds[name]),
      [im.width, im.height, ...visibleBounds(im)], name);
  }
});

test('all bodies share their visible height and hem without stretching or cropping source art', () => {
  const { context } = harness();
  for (const name of names) {
    const im = png(name), npc = name.startsWith('npc/');
    const height = npc ? 44 : 48, bottom = npc ? 7 : 5;
    const frame = context.characterBodyFrame(image(name), height, bottom);
    const [left, top, width, bodyHeight] = visibleBounds(im);
    const sx = frame.width / im.width, sy = frame.height / im.height;
    close(sx, sy, `${name}: uniform source scale`);
    close(bodyHeight * sy, height, `${name}: visible height`);
    close(frame.y + (top + bodyHeight) * sy, bottom, `${name}: hem`);
    close(frame.y + top * sy, bottom - height, `${name}: head`);
    close(frame.x + (left + width / 2) * sx, 0, `${name}: visible centre`);
    close(frame.visibleWidth, width * sx, `${name}: visible width`);
    close(frame.headY, bottom - height);
    // The returned rectangle covers the entire original PNG, including pixels
    // outside the alpha>128 measurement (hair antialiasing and soft hems).
    close(-frame.x / sx, left + width / 2);
    close(frame.width / sx, im.width);
    close(frame.height / sy, im.height);
  }
});

test('replacement dimensions and unknown art use a full frame; unloaded art recovers when ready', () => {
  const { context } = harness();
  const original = image('humanfemale_mage');
  for (const im of [
    { ...original, naturalWidth: original.naturalWidth + 1 },
    { ...original, naturalHeight: original.naturalHeight + 1 },
    { ...original, src: 'assets/characters/unreviewed.png' },
  ]) {
    const frame = context.characterBodyFrame(im);
    close(frame.height, 48); close(frame.width, 48 * im.naturalWidth / im.naturalHeight);
    close(frame.x, -frame.width / 2); close(frame.y, 5 - 48);
  }
  for (const im of [null, { ...original, complete: false },
    { ...original, naturalWidth: 0 }, { ...original, naturalHeight: 0 }]) {
    assert.equal(context.characterBodyFrame(im), null);
  }
  const loading = { ...original, complete: false };
  assert.equal(context.characterBodyFrame(loading), null);
  loading.complete = true;
  const frame = context.characterBodyFrame(loading);
  assert.ok(frame.height > 48, 'Reviewed padding compensation must recover after loading');
  const windows = { ...original, src: 'C:\\game\\assets\\characters\\humanfemale_mage.png?v=2' };
  assert.deepEqual(context.characterBodyFrame(windows), frame);
});

test('boots remain stable for each race and gender across every class and armor swap', () => {
  const { context } = harness();
  for (const race of races) for (const female of [false, true]) {
    const reference = context.paintedCharacterFrame(race, 'warrior', female, false).boots;
    for (const cls of classes) for (const armor of [false, true]) {
      const frame = context.paintedCharacterFrame(race, cls, female, armor);
      assert.deepEqual(frame.boots, reference, `${race}/${female}/${cls}/${armor}`);
      if (female) close(context.femBootW(race, cls), reference.bw);
      close(frame.groundY, reference.groundY);
    }
  }
  close(context.femBootW('stoneborn', 'mage'), context.femBootW('dwarf', 'hunter'));
});

test('real boot proportions and planted steps keep both feet attached to the shared body hem', () => {
  const h = harness(), im = png('fot');
  for (const race of races) for (const female of [false, true]) {
    const body = h.context.paintedCharacterFrame(race, 'mage', female, true);
    const boots = body.boots;
    const fallback = h.context.characterBootFrame(race, female, null);
    close(fallback.groundY, boots.groundY, 'Unloaded boot aspect matches the shipped asset');
    for (const walk of [0, Math.PI / 4, -Math.PI / 4]) for (const bob of [-1.8, 0, 1.8]) {
      h.draws.length = 0;
      h.context.bootFeet({ ...boots, moving: true, walk, bob }, h.context.ctx);
      assert.equal(h.draws.length, 2);
      for (const { rect } of h.draws) {
        assert.equal(rect.length, 4, 'Both boots draw the full source image');
        const [, y, width, height] = rect;
        close(height / width, im.height / im.width, 'Boot aspect is preserved');
        close(height, boots.bw * im.height / im.width);
        assert.ok(y <= body.bodyBottom + bob, 'The top of a boot overlaps the moving hem');
        assert.ok(y <= boots.top, 'A planted step only lifts; it never drops below its resting top');
      }
      close(boots.groundY, boots.top + h.draws[0].rect[3] - 2);
      assert.equal(h.stack.length, 0);
    }
  }
});

test('the wrapper resolves legacy names and uses the actual armor readiness instead of class art', () => {
  const armor = image('dwarffemale_armor');
  const h = harness({ dwarffemale_armor: armor, dwarffemale_priest: null });
  const frame = h.context.paintedCharacterFrame('stoneborn', 'cleric', true, true);
  assert.equal(frame.image, armor);
  assert.deepEqual(h.lookups, ['dwarffemale_armor']);
  assert.equal(h.context.paintedCharacterFrame('stoneborn', 'cleric', true, false), null);
  assert.equal(h.lookups.at(-1), 'dwarffemale_priest');
  armor.complete = false;
  assert.equal(h.context.paintedCharacterFrame('stoneborn', 'cleric', true, true), null);
  armor.complete = true;
  assert.ok(h.context.paintedCharacterFrame('stoneborn', 'cleric', true, true));
});

test('a loaded armor body keeps the painted hand and weapon size even before normal class art loads', () => {
  const armor = image('humanfemale_armor');
  const h = harness({ humanfemale_armor: armor, humanfemale_warrior: null });
  const frame = h.context.paintedCharacterFrame('human', 'warrior', true, true);
  h.lookups.length = 0;
  h.context.drawChampionSprite(h.context.ctx, 'human', 'warrior', 1, 0, 0,
    false, null, true, 1, true, null);
  assert.deepEqual(h.lookups, ['humanfemale_armor'], 'Unrelated class art must not choose weapon geometry');
  assert.equal(h.draws.length, 2);
  assert.equal(h.draws[0].img, armor);
  assert.deepEqual(h.draws[0].rect, [frame.x, frame.y, frame.width, frame.height]);
  assert.deepEqual(h.translations, [[11, -1]], 'The painted hand remains active');
  assert.equal(h.draws[1].rect[3], 38, 'Painted standard sword height, not procedural height 27');
  assert.equal(h.stack.length, 0);
});
