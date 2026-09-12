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
function verifyOpaqueUnchanged(before, after, label, clearedExceptions = []) {
 const approved = new Set(clearedExceptions);
 for (let i = 0; i < before.length; i += 4) {
  if (before[i + 3] === 255 && (before[i] !== after[i] || before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3])) {
   if (approved.has(i / 4) && after[i + 3] === 0 && before[i] === after[i] &&
       before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2]) continue;
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

test('a nearby grey transition cannot hide a farther donor with enough contrast', () => {
 const h = harness(), data = patch().set(4, 7, [185, 180, 175, 250])
  .set(5, 7, [145, 145, 145, 255]).set(8, 7, [70, 55, 35, 255]);
 const before = new Uint8ClampedArray(data.pixels);
 assert.equal(h.context.cleanSpriteEdgePixels(data.pixels, 15, 15, {minimum: 150, chroma: 50}), 1);
 assert.deepEqual(data.get(4, 7).slice(0, 3), [70, 55, 35],
  'Donors need sufficient contrast before the nearest valid donor is selected');
 assert.ok(data.get(4, 7)[3] < 125);
 verifyOpaqueUnchanged(before, data.pixels, 'grey transition');
});

test('the wider base-edge search does not extend into the upper building', () => {
 const h = harness(), data = patch(45, 45);
 for (let y = 0; y < 45; y++) for (let x = 0; x < 45; x++) data.set(x, y, [40, 80, 20, 255]);
 data.set(20, 10, [210, 205, 200, 230]).set(30, 10, [0, 0, 0, 0]);
 data.set(20, 32, [210, 205, 200, 230]).set(30, 32, [0, 0, 0, 0]);
 const upper = data.get(20, 10), before = new Uint8ClampedArray(data.pixels);
 assert.equal(h.context.cleanSpriteEdgePixels(data.pixels, 45, 45,
  {radius: 4, search: 14, baseEdge: [25, 12]}), 1);
 assert.deepEqual(data.get(20, 10), upper, 'Upper details retain the smaller safe edge radius');
 assert.ok(data.get(20, 32)[3] < 100, 'Only the approved lower region reaches the farther transparent gap');
 verifyOpaqueUnchanged(before, data.pixels, 'base-only radius');
});

test('grey backing follows diagonal connections from transparent space without repainting pixels', () => {
 const h = harness(), data = patch(12, 12);
 for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) data.set(x, y, [45, 65, 25, 255]);
 data.set(1, 1, [240, 220, 200, 0]);
 const clear = [[2, 2, [128, 128, 128, 128]], [3, 3, [146, 146, 146, 146]],
  [4, 4, [254, 254, 254, 254]], [5, 5, [149, 149, 147, 158]],
  [6, 6, [160, 164, 162, 200]], [7, 7, [179, 185, 184, 240]],
  [11, 8, [126, 128, 130, 128]]]; // Canvas boundary is also transparent space.
 for (const [x, y, rgba] of clear) data.set(x, y, rgba);
 data.set(2, 1, [128, 128, 128, 255]); // Genuine solid grey paint.
 data.set(1, 2, [255, 255, 255, 255]); // Opaque white paint.
 data.set(1, 3, [124, 124, 135, 128]); // Span 11: too colourful, despite a matching mean.
 data.set(2, 3, [90, 90, 90, 120]); // RGB does not follow alpha.
 data.set(8, 5, [128, 128, 128, 128]); // Same grey, enclosed by real paint.
 const before = new Uint8ClampedArray(data.pixels);
 assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, 12, 12, [12, 12]), clear.length);
 for (const [x, y, rgba] of clear) assert.deepEqual(data.get(x, y), [...rgba.slice(0, 3), 0]);
 for (const [x, y] of [[2, 1], [1, 2], [1, 3], [2, 3], [8, 5]]) {
  const i = (y * 12 + x) * 4;
  assert.deepEqual(data.get(x, y), [...before.slice(i, i + 4)], `Preserved paint at ${x},${y}`);
 }
 for (let i = 0; i < before.length; i += 4) {
  assert.deepEqual(data.pixels.slice(i, i + 3), before.slice(i, i + 3), 'RGB is immutable');
  assert.ok(data.pixels[i + 3] === before[i + 3] || data.pixels[i + 3] === 0);
 }
 assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, 12, 12, [12, 12]), 0,
  'A second pass must not erode additional paint');
});

test('grey backing requires exact alpha zero or the canvas boundary and the reviewed dimensions', () => {
 const h = harness(), data = patch(9, 9);
 for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) data.set(x, y, [35, 65, 25, 255]);
 data.set(3, 3, [0, 0, 0, 1]).set(4, 4, [128, 128, 128, 128]);
 const before = new Uint8ClampedArray(data.pixels);
 assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, 9, 9, [9, 9]), 0,
  'A nearly transparent paint pixel must not seed a background flood');
 assert.deepEqual(data.pixels, before);
 data.set(3, 3, [0, 0, 0, 0]);
 for (const size of [undefined, [8, 9], [9, 10]]) {
  const original = new Uint8ClampedArray(data.pixels);
  assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, 9, 9, size), 0);
  assert.deepEqual(data.pixels, original, 'Unknown image dimensions require a new review');
 }
 assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, 9, 9, [9, 9]), 1);
 assert.equal(data.get(4, 4)[3], 0);
});

test('grey backing accepts darker premultiplied residue but preserves near-opaque grey paint and alpha caps', () => {
 const h = harness(), original = patch(7, 5)
  .set(1, 1, [200, 200, 200, 254]) // Real neutral-grey paint, not a translucent backing.
  .set(2, 1, [248, 248, 248, 254]) // Only the optional cap protects this bright paint.
  .set(3, 1, [245, 245, 245, 245]) // The cap is inclusive.
  .set(4, 1, [160, 164, 162, 200]) // Backing darker than alpha, with slight channel variation.
  .set(5, 1, [180, 180, 180, 245]) // The darker-backing rule stops before near-opaque paint.
  .set(1, 3, [100, 100, 100, 200]); // Too dark to be the reviewed backing.
 for (const cap of [undefined, 245]) {
  const pixels = new Uint8ClampedArray(original.pixels);
  const size = cap ? [7, 5, cap] : [7, 5];
  assert.equal(h.context.cleanSpriteGrayMatte(pixels, 7, 5, size), cap ? 2 : 3);
  for (const [x, y] of [[1, 1], [5, 1], [1, 3]]) {
   const i = (y * 7 + x) * 4;
   assert.deepEqual(pixels.slice(i, i + 4), original.pixels.slice(i, i + 4), `Grey paint ${x},${y}`);
  }
  assert.equal(pixels[(1 * 7 + 2) * 4 + 3], cap ? 254 : 0);
  assert.equal(pixels[(1 * 7 + 3) * 4 + 3], 0);
  assert.equal(pixels[(1 * 7 + 4) * 4 + 3], 0);
  for (let i = 0; i < pixels.length; i += 4)
   assert.deepEqual(pixels.slice(i, i + 3), original.pixels.slice(i, i + 3), 'Backing removal preserves RGB');
  assert.equal(h.context.cleanSpriteGrayMatte(pixels, 7, 5, size), 0);
 }
});

test('the large cow and chicken cap leaves all near-opaque animal paint byte-exact', () => {
 const h = harness();
 for (const name of ['cowfarm_big', 'chickenfarm_big']) {
  const data = readPixels(path.join(root, 'assets/farm', name + '.png'));
  const profile = h.context.spriteEdgeProfile({src: `assets/farm/${name}.png`});
  assert.ok(profile && profile.grayMatte, name);
  assert.equal(profile.edge, false, 'Animal fur must not use the generic donor cleanup');
  assert.deepEqual(Array.from(profile.grayMatte), [data.width, data.height, 245]);
  const before = new Uint8ClampedArray(data.pixels);
  assert.ok(h.context.cleanSpriteGrayMatte(data.pixels, data.width, data.height, profile.grayMatte) > 0);
  let protectedPixels = 0;
  for (let i = 0; i < before.length; i += 4) {
   if (before[i + 3] <= 245) continue;
   protectedPixels++;
   if (data.pixels[i] !== before[i] || data.pixels[i + 1] !== before[i + 1] ||
       data.pixels[i + 2] !== before[i + 2] || data.pixels[i + 3] !== before[i + 3])
    assert.fail(`${name}: protected animal paint changed at ${i / 4}`);
  }
  assert.ok(protectedPixels > 10000, `${name}: fixture must contain substantial animal paint`);
  const img = image({...data, pixels: before}, {src: `assets/farm/${name}.png`});
  const cleaned = h.context.spriteEdgeSource(img);
  assert.notEqual(cleaned, img, 'The reviewed backing must be cleaned in the real renderer');
  assert.deepEqual(cleaned.pixels, data.pixels, 'The renderer must apply only the capped animal backing pass');
  assert.deepEqual(img.pixels, before);
 }
});

test('all five reviewed house backings clear without changing RGB or solid paint', () => {
 const h = harness();
 for (const name of ['farmhouse_litet', 'Farmhouse_medium', 'farmhouse_mansion', 'chickenhouse_farm', 'lada_farm']) {
  const data = readPixels(path.join(root, 'assets/farm', name + '.png'));
  const before = new Uint8ClampedArray(data.pixels), profile = h.context.spriteEdgeProfile({src: `assets/farm/${name}.png`});
  assert.ok(profile && profile.grayMatte, `${name}: reviewed grey backing must opt in`);
  assert.deepEqual(Array.from(profile.grayMatte), [data.width, data.height]);
  assert.ok(h.context.cleanSpriteGrayMatte(data.pixels, data.width, data.height, profile.grayMatte) > 0);
  verifyOpaqueUnchanged(before, data.pixels, name);
  for (let i = 0; i < before.length; i += 4) {
   if (data.pixels[i] !== before[i] || data.pixels[i + 1] !== before[i + 1] || data.pixels[i + 2] !== before[i + 2])
    assert.fail(`${name}: backing correction repainted RGB at ${i / 4}`);
   if (data.pixels[i + 3] !== before[i + 3] && data.pixels[i + 3] !== 0)
    assert.fail(`${name}: backing correction altered partial coverage at ${i / 4}`);
  }
  assert.equal(h.context.cleanSpriteGrayMatte(data.pixels, data.width, data.height, profile.grayMatte), 0, name);
 }
});

test('the renderer clears farmhouse roof, porch and grass backing while preserving real building details', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/farm/farmhouse_litet.png'));
 const before = new Uint8ClampedArray(data.pixels), img = image(data, {src: 'assets/farm/farmhouse_litet.png'});
 const cleaned = h.context.spriteEdgeSource(img);
 assert.notEqual(cleaned, img, 'The actual renderer must consume the grey-backing profile');
 for (const [x, y, expected] of [[222, 100, [128, 128, 128, 128]], [201, 300, [146, 146, 146, 146]],
  [110, 450, [149, 149, 147, 158]], [1017, 704, [246, 246, 246, 254]],
  [204, 630, [138, 138, 137, 162]], [204, 634, [127, 127, 127, 157]],
  [1018, 638, [156, 155, 153, 176]], [200, 659, [144, 143, 140, 167]],
  [1017, 706, [245, 246, 246, 255]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected, `Reviewed source at ${x},${y}`);
  assert.equal(cleaned.pixels[i + 3], 0, `Backing remains at ${x},${y}`);
 }
 for (const [x, y, expected] of [[518, 919, [201, 194, 192, 254]], [520, 925, [190, 182, 185, 253]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected, `Reviewed base grass at ${x},${y}`);
  assert.ok(cleaned.pixels[i + 3] < 160, `Wide base fringe remains at ${x},${y}`);
  assert.ok(cleaned.pixels[i] + cleaned.pixels[i + 1] + cleaned.pixels[i + 2] < expected[0] + expected[1] + expected[2]);
 }
 for (const [label, x, y] of [['plaster', 840, 470], ['light stone', 272, 81], ['base', 605, 795], ['window', 746, 575]]) {
  const i = (y * data.width + x) * 4;
  assert.ok(before[i + 3] > 0);
  assert.deepEqual(cleaned.pixels.slice(i, i + 4), before.slice(i, i + 4), label);
 }
 verifyOpaqueUnchanged(before, cleaned.pixels, 'farmhouse renderer', [706 * data.width + 1017]);
 assert.deepEqual(img.pixels, before, 'The original source image remains unchanged');
});

test('the one-pixel farmhouse mask clears only the reviewed opaque dot at its original dimensions', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/farm/farmhouse_litet.png'));
 const masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 const profile = h.context.spriteEdgeProfile({src: 'assets/farm/farmhouse_litet.png'}), mask = masks[profile.mask];
 assert.ok(mask, 'The farmhouse profile must reference the reviewed one-pixel mask');
 const before = new Uint8ClampedArray(data.pixels), pixel = 706 * data.width + 1017, i = pixel * 4;
 assert.deepEqual([...before.slice(i, i + 4)], [245, 246, 246, 255]);
 for (const [width, height] of [[data.width + 1, data.height], [data.width, data.height + 1]]) {
  assert.equal(h.context.applySpriteCutoutMask(data.pixels, width, height, mask), 0,
   'Replacement art dimensions must disable the authored correction');
  assert.deepEqual(data.pixels, before);
 }
 assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width, data.height, mask), 1);
 const expected = new Uint8ClampedArray(before);expected[i + 3] = 0;
 assert.deepEqual(data.pixels, expected, 'No other alpha or RGB value may change');
 verifyOpaqueUnchanged(before, data.pixels, 'one-pixel farmhouse exception', [pixel]);
 assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width, data.height, mask), 0);
});

test('the tree profile corrects reviewed grey leaf-gap pixels while retaining opaque foliage', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/farm/tree_farm.png'));
 const before = new Uint8ClampedArray(data.pixels), profile = h.context.spriteEdgeProfile({src: 'assets/farm/tree_farm.png'});
 assert.ok(profile);assert.equal(profile.grayMatte, undefined, 'A tree must not inherit a building backing mask');
 assert.ok(h.context.cleanSpriteEdgePixels(data.pixels, data.width, data.height, profile) > 0);
 for (const [x, y, expected] of [[36, 421, [195, 188, 178, 254]], [38, 413, [180, 177, 168, 250]],
  [36, 456, [191, 178, 162, 251]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected);
  assert.ok(data.pixels[i] < 130 && data.pixels[i + 3] < 150, `Grey fleck remains at ${x},${y}`);
 }
 verifyOpaqueUnchanged(before, data.pixels, 'tree_farm');
});

test('pond bank matte clears while water reflections, translucent reeds and flowers stay exact', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/farm/pond_farm.png'));
 const before = new Uint8ClampedArray(data.pixels), profile = h.context.spriteEdgeProfile({src: 'assets/farm/pond_farm.png'});
 assert.ok(profile);assert.equal(profile.grayMatte, undefined, 'Water must not inherit a building backing mask');
 assert.equal(profile.edge, false, 'Soft water must not use generic donor recolouring');
 const masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 assert.ok(masks[profile.mask], 'The pond renderer needs its reviewed outer-rim mask');
 const img = image(data, {src: 'assets/farm/pond_farm.png'}), cleaned = h.context.spriteEdgeSource(img);
 assert.notEqual(cleaned, img);
 data.pixels = cleaned.pixels;
 for (const [x, y, expected] of [[351, 108, [255, 244, 228, 250]], [348, 109, [255, 246, 228, 249]],
  [298, 133, [255, 238, 226, 250]], [674, 93, [236, 218, 206, 250]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected, `Reviewed pond edge at ${x},${y}`);
  assert.equal(data.pixels[i + 3], 0, `White matte remains on the bank at ${x},${y}`);
  assert.deepEqual([...data.pixels.slice(i, i + 3)], expected.slice(0, 3), 'The rim mask only changes alpha');
 }
 for (const [label, x, y, expected] of [
  ['white reflection', 500, 175, [239, 250, 220, 255]],
  ['white reflection', 430, 207, [219, 242, 222, 255]],
  ['blue water', 625, 310, [115, 173, 177, 255]],
  ['deep water', 580, 420, [58, 110, 121, 255]],
  ['reed', 835, 110, [32, 46, 21, 254]],
  ['reed', 846, 145, [27, 38, 30, 254]],
  ['reed', 218, 159, [78, 90, 50, 254]],
  ['flower', 865, 204, [251, 185, 187, 255]],
  ['water-reed transition', 350, 351, [91, 129, 132, 254]],
 ]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected, `Reviewed ${label} at ${x},${y}`);
  assert.deepEqual(data.pixels.slice(i, i + 4), before.slice(i, i + 4), `${label} at ${x},${y}`);
 }
 verifyOpaqueUnchanged(before, data.pixels, 'pond_farm');
 const maskOnly = new Uint8ClampedArray(before);
 assert.ok(h.context.applySpriteCutoutMask(maskOnly, data.width, data.height, masks[profile.mask]) > 0);
 assert.deepEqual(data.pixels, maskOnly, 'Only the reviewed outer bank pixels may change');
 assert.deepEqual(img.pixels, before);
});

test('the fountain uses only its outer-rim mask and preserves spray, foam and stone', () => {
 const h = harness(), data = readPixels(path.join(root, 'assets/farm/fountain_farm.png'));
 const before = new Uint8ClampedArray(data.pixels), src = 'assets/farm/fountain_farm.png';
 const profile = h.context.spriteEdgeProfile({src}), masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 assert.ok(profile && masks[profile.mask]);assert.equal(profile.edge, false);
 const img = image(data, {src}), cleaned = h.context.spriteEdgeSource(img);
 assert.notEqual(cleaned, img);
 for (const [x, y, expected] of [[9, 324, [243, 240, 233, 251]], [76, 248, [249, 245, 236, 251]],
  [10, 320, [231, 227, 218, 249]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected);
  assert.equal(cleaned.pixels[i + 3], 0, `Stone-rim matte remains at ${x},${y}`);
 }
 for (const [label, x, y, expected] of [['spray', 360, 40, [124, 174, 197, 254]],
  ['foam', 227, 320, [218, 237, 235, 255]], ['stone', 300, 355, [174, 119, 54, 255]],
  ['soft stone edge', 490, 474, [205, 158, 90, 254]]]) {
  const i = (y * data.width + x) * 4;
  assert.deepEqual([...before.slice(i, i + 4)], expected);
  assert.deepEqual(cleaned.pixels.slice(i, i + 4), before.slice(i, i + 4), label);
 }
 const maskOnly = new Uint8ClampedArray(before);
 assert.ok(h.context.applySpriteCutoutMask(maskOnly, data.width, data.height, masks[profile.mask]) > 0);
 assert.deepEqual(cleaned.pixels, maskOnly, 'Generic cleanup must not erase soft water');
 verifyOpaqueUnchanged(before, cleaned.pixels, 'fountain_farm');
 assert.deepEqual(img.pixels, before);
});

test('beehive and haywagon base matte clears without removing the wood, wheel or hay', () => {
 const h = harness(), masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 for (const {name, count, clear, keep} of [
  {name: 'beehives_farm', count: 183, clear: [[372, 754], [370, 755], [408, 741]], keep: [[350, 690], [300, 500], [185, 126]]},
  {name: 'haywagon_farm', count: 136, clear: [[139, 519], [253, 572]], keep: [[170, 478], [190, 475], [500, 290], [580, 200]]},
 ]) {
  const data = readPixels(path.join(root, 'assets/farm', name + '.png'));
  const before = new Uint8ClampedArray(data.pixels), img = image(data, {src: `assets/farm/${name}.png`});
  const profile = h.context.spriteEdgeProfile(img), maskOnly = new Uint8ClampedArray(before);
  assert.ok(profile && masks[profile.mask], `${name}: the reviewed base mask must be connected`);
  assert.equal(h.context.applySpriteCutoutMask(maskOnly, data.width, data.height, masks[profile.mask]), count);
  const cleaned = h.context.spriteEdgeSource(img);
  assert.notEqual(cleaned, img, `${name}: reviewed sprite must be cleaned`);
  for (const [x, y] of clear) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] >= 240, 'Reviewed near-opaque matte');
   assert.ok(cleaned.pixels[i + 3] < 120, `${name}: base matte remains at ${x},${y}`);
   if (cleaned.pixels[i + 3]) {
    assert.ok(cleaned.pixels[i] + cleaned.pixels[i + 1] + cleaned.pixels[i + 2] <
     before[i] + before[i + 1] + before[i + 2] - 120, `${name}: matte is still light at ${x},${y}`);
   } else assert.deepEqual(cleaned.pixels.slice(i, i + 3), before.slice(i, i + 3), 'Mask deletion keeps source RGB');
  }
  for (const [x, y] of keep) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] > 0);
   assert.deepEqual(cleaned.pixels.slice(i, i + 4), before.slice(i, i + 4), `${name}: real paint ${x},${y}`);
  }
  verifyOpaqueUnchanged(before, cleaned.pixels, name);
  assert.deepEqual(img.pixels, before);
 }
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
  'assets/farm/staketvit_sidan.png', 'assets/farm/staket_ovan.png',
  'assets/city/cathedral.png']) {
  const img = image(undefined, {src});
  assert.equal(h.context.spriteEdgeSource(img), img, src);
 }
 assert.equal(h.state.canvases, 0);
 for (const src of ['assets/farm/bench_farm.png?v=2#preview', 'https://example.test/assets/city/house_stone.png',
  'file:///game/assets/farm/woodpile_farm%2Epng', 'C:\\game\\assets\\farm\\trough_farm.png',
  'assets/weapons/bow.png', 'assets/boss/rat_boss.png', 'assets/farm/tree_farm.png',
  'assets/farm/pond_farm.png', 'assets/farm/farmhouse_litet.png', 'assets/farm/cowfarm_liten.png',
  'assets/farm/cowfarm_big.png', 'assets/farm/chickenfarm_big.png', 'assets/farm/beehives_farm.png',
  'assets/farm/haywagon_farm.png', 'assets/farm/fountain_farm.png']) {
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

test('bounded hole masks honour diagonal connectivity, alpha limits and painted barriers', () => {
 const h = harness(), original = patch(9, 9)
  .set(2, 2, [220, 220, 220, 180]).set(3, 3, [210, 210, 210, 190])
  .set(4, 4, [210, 210, 210, 190]) // Connected, but beyond the reviewed rectangle.
  .set(1, 2, [240, 240, 240, 254]) // High-alpha real paint.
  .set(2, 3, [240, 200, 100, 180]) // Coloured leaf/fur paint.
  .set(1, 1, [220, 220, 220, 15]); // Below the approved alpha range.
 for (const eight of [false, true]) {
  const pixels = new Uint8ClampedArray(original.pixels);
  const mask = {size: [9, 9], holes: [{seed: [2, 2], bounds: [1, 1, 3, 3], minimum: 200,
   chroma: 20, alpha: 16, maxAlpha: 200, eight}]};
  assert.equal(h.context.applySpriteCutoutMask(pixels, 9, 9, mask), eight ? 2 : 1);
  assert.equal(pixels[(2 * 9 + 2) * 4 + 3], 0);
  assert.equal(pixels[(3 * 9 + 3) * 4 + 3], eight ? 0 : 190);
  for (const [x, y] of [[4, 4], [1, 2], [2, 3], [1, 1]]) {
   const i = (y * 9 + x) * 4;
   assert.deepEqual(pixels.slice(i, i + 4), original.pixels.slice(i, i + 4), `Protected ${x},${y}`);
  }
  for (let i = 0; i < pixels.length; i += 4)
   assert.deepEqual(pixels.slice(i, i + 3), original.pixels.slice(i, i + 3));
  assert.equal(h.context.applySpriteCutoutMask(pixels, 9, 9, mask), 0);
 }
});

test('tree-gap and calf masks reach the renderer while preserving gold leaves, bark and cream fur', () => {
 const h = harness(), masks = vm.runInContext('SPRITE_CUTOUT_MASKS', h.context);
 const fixtures = [
  {name: 'tree_farm', count: 409,
   clear: [[76, 256], [82, 256], [61, 266], [58, 268], [36, 421], [36, 456], [37, 459], [548, 36]],
   keep: [[55, 255], [58, 273], [69, 267], [75, 258], [350, 500]]},
  {name: 'cowfarm_liten', count: 73,
   clear: [[313, 671], [317, 678]], keep: [[450, 510], [350, 420], [440, 770]]},
 ];
 for (const {name, count, clear, keep} of fixtures) {
  const data = readPixels(path.join(root, 'assets/farm', name + '.png'));
  const before = new Uint8ClampedArray(data.pixels), src = `assets/farm/${name}.png`;
  const profile = h.context.spriteEdgeProfile({src}), mask = profile && masks[profile.mask];
  assert.ok(mask, `${name}: the profile must reference an existing reviewed mask`);
  assert.equal(h.context.applySpriteCutoutMask(data.pixels, data.width, data.height, mask), count, name);
  const img = image({...data, pixels: before}, {src}), cleaned = h.context.spriteEdgeSource(img);
  assert.notEqual(cleaned, img, `${name}: the mask must reach the actual renderer`);
  for (const [x, y] of clear) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] > 0, `Reviewed residue at ${x},${y}`);
   assert.equal(data.pixels[i + 3], 0, `${name}: direct mask missed ${x},${y}`);
   assert.equal(cleaned.pixels[i + 3], 0, `${name}: renderer missed ${x},${y}`);
  }
  for (const [x, y] of keep) {
   const i = (y * data.width + x) * 4;
   assert.ok(before[i + 3] > 0);
   assert.deepEqual(cleaned.pixels.slice(i, i + 4), before.slice(i, i + 4), `${name}: real paint ${x},${y}`);
  }
  if (name === 'cowfarm_liten') {
   assert.equal(profile.edge, false, 'Cream fur must not enter the generic edge cleanup');
   assert.deepEqual(cleaned.pixels, data.pixels, 'Only the reviewed calf island may change');
  }
  assert.deepEqual(img.pixels, before);
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
 const untouched = image(undefined, {src: 'assets/farm/staketvit_sidan.png', onload() {}});
 const onload = untouched.onload;h.context.spriteEdgeThumbnail(untouched);
 assert.equal(untouched.src, 'assets/farm/staketvit_sidan.png');assert.equal(untouched.onload, onload);
 const blocked = harness(), original = image();blocked.state.denied = true;
 blocked.context.spriteEdgeThumbnail(original);
 assert.equal(original.src, 'file:///game/assets/city/house_stone.png?v=1');
 assert.equal(blocked.state.exports, 0);
});
