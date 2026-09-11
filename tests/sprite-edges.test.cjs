/* Exercises the opt-in matte cleanup without changing any source artwork. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { readRgbaPng } = require('./helpers/png.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/sprite-edges.js'), 'utf8');
const maskSource = fs.readFileSync(path.join(root, 'assets/sprite-cutout-masks.js'), 'utf8');
function readPixels(filename) {
 const data = readRgbaPng(filename);
 data.pixels = new Uint8ClampedArray(data.pixels);
 return data;
}

function patch(width = 15, height = 15) {
 const pixels = new Uint8ClampedArray(width * height * 4);
 return {width, height, pixels,
  set(x, y, rgba) {pixels.set(rgba, (y * width + x) * 4);return this;},
  get(x, y) {return [...pixels.slice((y * width + x) * 4, (y * width + x + 1) * 4)];},
 };
}
function mattePatch() {
 return patch().set(4, 7, [234, 233, 234, 100]).set(6, 7, [30, 40, 50, 255]);
}
function harness() {
 const state = {canvases: 0, reads: 0, writes: 0, exports: 0, denied: false};
 const context = vm.createContext({document: {createElement(tag) {
  assert.equal(tag, 'canvas');state.canvases++;
  const canvas = {width: 0, height: 0, toDataURL(type) {
   assert.equal(type, 'image/png');state.exports++;return 'data:image/png;base64,cleaned';
  }};let image;
  canvas.getContext = () => ({
   drawImage(img) {image = img;},
   getImageData() {
    state.reads++;
    if (state.denied) throw new Error('SecurityError: unreadable canvas');
    return {data: new Uint8ClampedArray(image.pixels)};
   },
   putImageData(data) {state.writes++;canvas.pixels = new Uint8ClampedArray(data.data);},
  });
  return canvas;
 }}});
 vm.runInContext(maskSource, context, {filename: 'sprite-cutout-masks.js'});
 vm.runInContext(source, context, {filename: 'sprite-edges.js'});
 return {context, state};
}
function image(data = mattePatch(), extra = {}) {
 return {src: 'file:///game/assets/city/house_stone.png?v=1', complete: true,
  naturalWidth: data.width, naturalHeight: data.height, pixels: data.pixels, ...extra};
}
function verifyOpaqueUnchanged(before, after, label) {
 for (let i = 0; i < before.length; i += 4) {
  if (before[i + 3] === 255 && (before[i] !== after[i] || before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3])) {
   assert.fail(`${label}: opaque pixel ${i / 4} changed`);
  }
 }
}

test('a neutral white matte edge adopts nearby paint and loses the white coverage', () => {
 const h = harness(), data = mattePatch(), before = new Uint8ClampedArray(data.pixels);
 const changed = h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, {});
 assert.equal(changed, 1);
 assert.deepEqual(data.get(4, 7).slice(0, 3), [30, 40, 50]);
 assert.ok(data.get(4, 7)[3] > 0 && data.get(4, 7)[3] < 25);
 verifyOpaqueUnchanged(before, data.pixels, 'synthetic matte');
 assert.equal(h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, {}), 0,
  'Reusing already cleaned pixels must not erode the outline further');
});

test('opaque white and coloured or unsupported soft light remain intact', () => {
 const h = harness();
 const fixtures = [
  patch().set(4, 7, [255, 255, 255, 255]).set(6, 7, [20, 30, 40, 255]),
  patch().set(4, 7, [80, 230, 255, 170]).set(6, 7, [20, 30, 40, 255]),
  patch().set(4, 7, [230, 230, 230, 100]),
  patch().set(4, 7, [240, 240, 240, 0]).set(6, 7, [20, 30, 40, 255]),
  patch().set(4, 7, [80, 85, 90, 130]).set(6, 7, [20, 30, 40, 255]),
 ];
 for (const data of fixtures) {
  const before = new Uint8ClampedArray(data.pixels);
  assert.equal(h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, {}), 0);
  assert.deepEqual(data.pixels, before);
 }
});

test('interior light paint and distant dark colours cannot be mistaken for a matte border', () => {
 const h = harness(), interior = patch();
 for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) interior.set(x, y, [70, 80, 90, 255]);
 interior.set(7, 7, [240, 240, 240, 180]);
 const before = new Uint8ClampedArray(interior.pixels);
 assert.equal(h.context.cleanSpriteEdgePixels(interior.pixels, 15, 15, {}), 0);
 assert.deepEqual(interior.pixels, before);
 const distant = patch().set(4, 7, [240, 240, 240, 180]).set(13, 7, [20, 30, 40, 255]);
 assert.equal(h.context.cleanSpriteEdgePixels(distant.pixels, 15, 15, {}), 0);
});

test('a pale transition does not block finding the actual painted outline', () => {
 const h = harness(), data = patch().set(4, 7, [255, 249, 239, 251])
  .set(5, 7, [235, 230, 220, 255]).set(6, 7, [225, 210, 190, 255])
  .set(11, 7, [40, 30, 20, 255]);
 const before = new Uint8ClampedArray(data.pixels);
 assert.equal(h.context.cleanSpriteEdgePixels(data.pixels, 15, 15, {}), 1);
 assert.deepEqual(data.get(4, 7).slice(0, 3), [40, 30, 20]);
 assert.ok(data.get(4, 7)[3] < 20, 'Near-opaque rim must not leave alternating white dots');
 verifyOpaqueUnchanged(before, data.pixels, 'pale transition');
});

test('the confirmed house_stone roof fringe is removed while all opaque building paint stays byte-exact', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/city/house_stone.png'));
 const before = new Uint8ClampedArray(data.pixels), i = (221 * data.width + 47) * 4;
 assert.deepEqual([...before.slice(i, i + 4)], [234, 233, 234, 242], 'Confirmed diagnostic source pixel');
 const profile = h.context.spriteEdgeProfile({src: 'assets/city/house_stone.png'});
 const changed = h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, profile);
 assert.ok(changed > 0);
 assert.ok(data.pixels[i] < 180 && data.pixels[i + 1] < 180 && data.pixels[i + 2] < 180);
 assert.ok(data.pixels[i + 3] < before[i + 3]);
 verifyOpaqueUnchanged(before, data.pixels, 'house_stone');
});

test('reviewed farm PNGs lose edge matte without altering any original opaque pixel', () => {
 const h = harness();
 for (const name of ['flowerbed_farm', 'woodpile_farm', 'trough_farm', 'well_farm', 'bench_farm',
  'farmsign_farm', 'pumpkins_farm', 'scarecrow_farm']) {
  const data = readPixels(path.join(root, 'assets/farm', name + '.png'));
  const before = new Uint8ClampedArray(data.pixels);
  const profile = h.context.spriteEdgeProfile({src: 'assets/farm/' + name + '.png'});
  assert.ok(profile, `${name}: expected the reviewed asset to opt in`);
  const changed = h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, profile);
  assert.ok(changed > 0, `${name}: expected reviewed edge matte to be corrected`);
  verifyOpaqueUnchanged(before, data.pixels, name);
  for (let i = 0; i < before.length; i += 4) {
   if (data.pixels[i + 3] > before[i + 3]) assert.fail(`${name}: cleanup must not add opacity`);
   if (!before[i + 3] || Math.max(before[i], before[i + 1], before[i + 2]) -
       Math.min(before[i], before[i + 1], before[i + 2]) > 60) {
    for (let c = 0; c < 4; c++) if (data.pixels[i + c] !== before[i + c]) {
     assert.fail(`${name}: transparent RGB and coloured paint must stay exact at pixel ${i / 4}`);
    }
   }
  }
  if (name === 'flowerbed_farm') for (const [x, y] of [[58, 100], [37, 150]]) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] >= 250, 'Reviewed near-opaque white rim');
   assert.ok(data.pixels[i] < 190 && data.pixels[i + 3] < 30,
    `Dotted white rim remains at ${x},${y}`);
  }
  if (name === 'trough_farm') {
   const i = (114 * data.width + 424) * 4;
   assert.deepEqual([...before.slice(i, i + 4)], [234, 254, 255, 255]);
   assert.deepEqual(data.pixels.slice(i, i + 4), before.slice(i, i + 4),
    'The intended white reflection inside the water must survive');
  }
 }
});

test('only reviewed source paths opt in, preserving intended snow, white fences and light', () => {
 const h = harness();
 for (const src of ['file:///game/assets/models/tr%C3%A4dsnow.png', 'assets/models/armor_altar.png',
  'assets/farm/staketvit_sidan.png', 'assets/farm/staket_ovan.png', 'assets/farm/pond_farm.png',
  'assets/farm/fountain_farm.png', 'assets/farm/cowfarm_liten.png', 'assets/farm/cowfarm_big.png',
  'assets/city/cathedral.png']) {
  const img = image(undefined, {src});
  assert.equal(h.context.spriteEdgeSource(img), img, src);
 }
 assert.equal(h.state.canvases, 0);
 for (const src of ['assets/farm/bench_farm.png?v=2#preview', 'https://example.test/assets/city/house_stone.png',
  'file:///game/assets/farm/woodpile_farm%2Epng', 'C:\\game\\assets\\farm\\trough_farm.png',
  'assets/weapons/bow.png', 'assets/boss/rat_boss.png']) {
  assert.ok(h.context.spriteEdgeProfile({src}), src);
 }
});

test('cleaned images preserve natural dimensions and cache by image identity, source and size', () => {
 const h = harness(), data = mattePatch(), img = image(data), before = new Uint8ClampedArray(img.pixels);
 const cleaned = h.context.spriteEdgeSource(img);
 assert.notEqual(cleaned, img);assert.equal(cleaned.naturalWidth, data.width);assert.equal(cleaned.naturalHeight, data.height);
 assert.equal(cleaned.width, data.width);assert.equal(cleaned.height, data.height);assert.equal(cleaned.complete, true);
 assert.deepEqual(img.pixels, before, 'The original image pixels are immutable');
 assert.equal(h.context.spriteEdgeSource(img), cleaned);assert.equal(h.state.reads, 1);
 assert.notEqual(h.context.spriteEdgeSource(image(data)), cleaned);assert.equal(h.state.reads, 2);
 img.src += '&revision=2';assert.notEqual(h.context.spriteEdgeSource(img), cleaned);assert.equal(h.state.reads, 3);
 const resized = patch(17, 15).set(4, 7, [234, 233, 234, 100]).set(6, 7, [30, 40, 50, 255]);
 img.naturalWidth = resized.width;img.pixels = resized.pixels;
 const large = h.context.spriteEdgeSource(img);assert.equal(large.naturalWidth, 17);assert.equal(h.state.reads, 4);
});

test('unloaded images are not cached and unreadable canvases safely return the original', () => {
 const h = harness(), img = image(undefined, {complete: false, naturalWidth: 0, naturalHeight: 0});
 assert.equal(h.context.spriteEdgeSource(img), img);assert.equal(h.state.canvases, 0);
 img.complete = true;img.naturalWidth = 15;img.naturalHeight = 15;
 assert.notEqual(h.context.spriteEdgeSource(img), img);assert.equal(h.state.reads, 1);
 const blocked = harness(), other = image();blocked.state.denied = true;
 assert.equal(blocked.context.spriteEdgeSource(other), other);
 assert.equal(blocked.context.spriteEdgeSource(other), other);assert.equal(blocked.state.reads, 1);
 assert.equal(blocked.state.writes, 0);
 blocked.state.denied = false;other.src += '&reload=2';
 assert.notEqual(blocked.context.spriteEdgeSource(other), other);
 assert.equal(blocked.state.reads, 2);
});

test('authored masks remove real isolated residue while preserving nearby art and all RGB', () => {
 const h = harness(), masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 for (const [name, count, keep, clear] of [
  ['pickaxe', 1419, [[379, 167], [350, 500]], [[400, 180], [390, 440]]],
  ['staff', 5364, [[102, 140], [144, 190]], [[100, 75]]],
 ]) {
  const data = readPixels(path.join(root, 'assets/weapons', name + '.png'));
  const before = new Uint8ClampedArray(data.pixels), mask = masks[name];
  assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width + 1, data.height, mask), 0,
   'A replacement image size requires a new mask review');
  assert.deepEqual(data.pixels, before);
  assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width, data.height, mask), count, name);
  for (const [x, y] of keep) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] > 0);
   assert.deepEqual(data.pixels.slice(i, i + 4), before.slice(i, i + 4), `${name}: painted art ${x},${y}`);
  }
  for (const [x, y] of clear) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] > 0);assert.equal(data.pixels[i + 3], 0, `${name}: residue ${x},${y}`);
  }
  for (let i = 0; i < before.length; i += 4) {
   assert.equal(data.pixels[i], before[i]);assert.equal(data.pixels[i + 1], before[i + 1]);
   assert.equal(data.pixels[i + 2], before[i + 2]);
   assert.ok(data.pixels[i + 3] === before[i + 3] || data.pixels[i + 3] === 0);
  }
  assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width, data.height, mask), 0);
  const img = image({...data, pixels: before}, {src: `assets/weapons/${name}.png`});
  const cleaned = h.context.spriteEdgeSource(img);
  assert.notEqual(cleaned, img, 'The actual renderer source must apply the configured mask');
  for (const [x, y] of clear) assert.equal(cleaned.pixels[(y * data.width + x) * 4 + 3], 0);
  for (const [x, y] of keep) {
   const i = (y * data.width + x) * 4;
   assert.deepEqual(cleaned.pixels.slice(i, i + 4), before.slice(i, i + 4));
  }
  assert.deepEqual(img.pixels, before, 'Mask integration must not mutate source PNG bytes');
 }
});

test('UI thumbnails use the same cleaned source and disconnect onload before replacing src', () => {
 const h = harness(), img = image(), loads = [];
 let currentSrc = img.src;img.onload = () => loads.push('recursive load');
 Object.defineProperty(img, 'src', {get: () => currentSrc, set(value) {
  loads.push(img.onload);currentSrc = value;
 }});
 h.context.spriteEdgeThumbnail(img);
 assert.equal(img.src, 'data:image/png;base64,cleaned');assert.equal(img.onload, null);
 assert.deepEqual(loads, [null]);assert.equal(h.state.exports, 1);
 h.context.spriteEdgeThumbnail(img);
 assert.equal(h.state.exports, 1, 'The data URL must not be cleaned or exported again');
 assert.equal(h.state.reads, 1);
 const untouched = image(undefined, {src: 'assets/farm/fountain_farm.png', onload() {}});
 const onload = untouched.onload;h.context.spriteEdgeThumbnail(untouched);
 assert.equal(untouched.src, 'assets/farm/fountain_farm.png');assert.equal(untouched.onload, onload);
 const blocked = harness(), original = image();blocked.state.denied = true;
 blocked.context.spriteEdgeThumbnail(original);
 assert.equal(original.src, 'file:///game/assets/city/house_stone.png?v=1');
 assert.equal(blocked.state.exports, 0);
});
