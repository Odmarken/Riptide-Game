/* Run with: node --test tests/home-hit-geometry.test.cjs
 * Executes the game's real Home renderer, hit testing and collision functions in an
 * isolated VM. No game startup, Electron profile, network or character save is used.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const masksSource = fs.readFileSync(path.join(root, 'assets/models/home-hit-masks.js'), 'utf8');

function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot locate game source section: ${start}`);
  return source.slice(a, b);
}

// Decode the actual, non-interlaced RGBA PNGs without adding a test dependency.
function readPng(name) {
  const png = fs.readFileSync(path.join(root, 'assets/models', `${name}.png`));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.deepEqual([...png.subarray(24, 29)], [8, 6, 0, 0, 0], 'Expected 8-bit RGBA PNG');
  const chunks = [];
  for (let p = 8; p < png.length;) {
    const length = png.readUInt32BE(p);
    if (png.toString('ascii', p + 4, p + 8) === 'IDAT') chunks.push(png.subarray(p + 8, p + 8 + length));
    p += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4, 'Unsupported PNG filter');
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const up = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const p = left + up - upperLeft;
      const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
      const paeth = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

const art = Object.fromEntries(['tavern', 'casino', 'bank', 'blacksmith', 'fishinghut'].map(name => [name, readPng(name)]));
const imageNames = { tavernImg: 'tavern', casinoImg: 'casino', bankImg: 'bank', smithImg: 'blacksmith', fishhutImg: 'fishinghut' };
const types = ['house', 'casino', 'bank', 'smith', 'fishhut'];

function harness(options = {}) {
  const state = { reads: 0, canvases: 0, failRead: false, opened: [], draws: [], ...options };
  const images = Object.fromEntries(Object.entries(imageNames).map(([key, name]) => [key, {
    complete: true, naturalWidth: art[name].width, naturalHeight: art[name].height,
    src: `${name}.png`, art: art[name],
  }]));
  let transform = { x: 0, y: 0 };
  const stack = [];
  const context = vm.createContext({
    ...images,
    world: { w: 5000, h: 5000, solids: [] }, hero: { x: 0, y: 0, r: 13 },
    holdMove: null, marker: null,
    atob: text => Buffer.from(text, 'base64').toString('binary'),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    openRestedWheel: () => state.opened.push('house'),
    openCasinoMenu: () => state.opened.push('casino'),
    openBank: () => state.opened.push('bank'),
    openSmith: () => state.opened.push('smith'),
    openFishHut: () => state.opened.push('fishhut'),
    seeThrough: () => 1, mip: img => img, drawPropShadow: () => {},
    ctx: {
      globalAlpha: 1,
      save() { stack.push({ ...transform }); },
      restore() { transform = stack.pop(); },
      translate(x, y) { transform.x += x; transform.y += y; },
      drawImage(img, x, y, width, height) {
        state.draws.push({ img, x: x + transform.x, y: y + transform.y, width, height });
      },
    },
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        state.canvases++;
        const canvas = { width: 0, height: 0 };
        let image;
        canvas.getContext = () => ({
          drawImage(img) { image = img; },
          getImageData() {
            state.reads++;
            if (state.failRead) throw new Error('SecurityError: canvas pixels are unreadable');
            const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
            // Interior/exterior samples avoid antialiasing-dependent edge pixels.
            for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
              const sx = Math.floor((x + 0.5) * image.art.width / canvas.width);
              const sy = Math.floor((y + 0.5) * image.art.height / canvas.height);
              data[(y * canvas.width + x) * 4 + 3] = image.art.pixels[(sy * image.art.width + sx) * 4 + 3];
            }
            return { data };
          },
        });
        return canvas;
      },
    },
  });
  vm.runInContext(masksSource, context, { filename: 'home-hit-masks.js' });
  vm.runInContext(section('const HOME_BUILDINGS=', 'const stenImg='), context, { filename: 'game.js:Home' });
  vm.runInContext(section('const SGRID=', 'function speedOf('), context, { filename: 'game.js:collision' });
  vm.runInContext(section('function drawProp(', 'function feet('), context, { filename: 'game.js:drawProp' });
  vm.runInContext('globalThis.defs = HOME_BUILDINGS;', context);
  return { context, state, images };
}

function solid(type, overrides = {}) {
  return { type, big: type === 'house', r: type === 'fishhut' ? 30 : 52, x: 2000, y: 2000, ...overrides };
}

function drawnPoint(h, building, u, v) {
  h.state.draws.length = 0;
  h.context.drawProp(building, { tavern: true }, false);
  assert.equal(h.state.draws.length, 1, 'The loaded Home building should draw exactly one sprite');
  const rect = h.state.draws[0];
  return { x: rect.x + rect.width * u, y: rect.y + rect.height * v };
}

test('all five rendered Home silhouettes accept opaque pixels and reject transparent margins', () => {
  const h = harness();
  for (const type of types) {
    const building = solid(type);
    h.context.world.solids = [building];
    for (const [u, v, expected] of [[0.5, 0.5, building], [0.01, 0.01, null], [0.5, 0.97, null]]) {
      const point = drawnPoint(h, building, u, v);
      assert.equal(h.context.homeBuildingAt(point.x, point.y), expected, `${type}: UV ${u},${v}`);
    }
  }
  assert.equal(h.state.reads, 5, 'Each image should be read once, not once per pointer hit');
});

test('UV coordinates outside the image or non-finite coordinates never access canvas pixels', () => {
  const h = harness();
  for (const [u, v] of [[-0.01, .5], [1, .5], [.5, -0.01], [.5, 1], [NaN, .5], [.5, NaN], [Infinity, .5], [.5, -Infinity]]) {
    assert.equal(h.context.pixelSolid(h.images.tavernImg, u, v), false, `UV ${u},${v}`);
  }
  assert.equal(h.state.canvases, 0);
});

test('a click before image load does not poison the alpha cache after loading', () => {
  const h = harness(), img = h.images.tavernImg, building = solid('house');
  h.context.world.solids = [building];
  img.complete = false; img.naturalWidth = 0; img.naturalHeight = 0;
  assert.equal(h.context.pixelSolid(img, .5, .5), false);
  assert.equal(h.context.homeBuildingAt(building.x, building.y), null);
  assert.equal(h.state.canvases, 0);
  img.complete = true; img.naturalWidth = 1024; img.naturalHeight = 1536;
  const point = drawnPoint(h, building, .5, .5);
  assert.equal(h.context.homeBuildingAt(point.x, point.y), building);
  assert.equal(h.context.pixelSolid(img, .01, .01), false);
  assert.equal(h.state.reads, 1);
});

test('changing an image source invalidates its cached alpha buffer', () => {
  const h = harness(), img = h.images.tavernImg;
  assert.equal(h.context.pixelSolid(img, .5, .5), true);
  img.currentSrc = 'replacement.png';
  img.art = { ...img.art, pixels: Buffer.alloc(img.art.pixels.length) };
  assert.equal(h.context.pixelSolid(img, .5, .5), false);
  assert.equal(h.state.reads, 2);
});

test('unreadable canvas pixels use shipped silhouette masks rather than a clickable rectangle', () => {
  const h = harness({ failRead: true });
  for (const type of types) {
    const building = solid(type);
    h.context.world.solids = [building];
    for (const [u, v, expected] of [[.5, .5, building], [.01, .01, null], [.5, .97, null]]) {
      const point = drawnPoint(h, building, u, v);
      assert.equal(h.context.homeBuildingAt(point.x, point.y), expected, `${type}: fallback UV ${u},${v}`);
    }
  }
  assert.equal(h.context.pixelSolid({ ...h.images.bankImg }, .5, .5), false, 'An unknown image must fail closed');
});

test('overlapping Home buildings select the frontmost painted silhouette, including stable ties', () => {
  const h = harness();
  const rear = solid('house', { y: 1950 }), front = solid('house');
  h.context.world.solids = [front, rear]; // Deliberately opposite to paint order.
  const point = drawnPoint(h, front, .5, .5);
  assert.equal(h.context.homeBuildingAt(point.x, point.y), front);
  const later = solid('house');
  h.context.world.solids = [front, later];
  assert.equal(h.context.homeBuildingAt(point.x, point.y), later, 'Later solids win a stable y-sort tie');

  const frame = h.context.homeBuildingFrame(front);
  const behind = solid('house', { y: front.y - frame.H * .3 });
  h.context.world.solids = [behind, front];
  const throughMargin = drawnPoint(h, front, .5, .1);
  assert.equal(h.context.homeBuildingAt(throughMargin.x, throughMargin.y), behind, 'Transparent foreground padding must not intercept the rear building');
});

test('Home door approach points remain outside each complete foot collider', () => {
  const h = harness();
  for (const type of types) {
    const building = solid(type);
    h.context.syncHomeBuildingFootprint(building);
    h.context.world = { w: 5000, h: 5000, solids: [building] };
    const door = h.context.homeBuildingDoor(building);
    assert.equal(h.context.collide({ r: 13 }, door.x, door.y), false, `${type}: the walk target must be reachable`);
    assert.equal(h.context.collide({ r: 13 }, building.x + building.cxo, building.y + building.cyo), true, `${type}: the foundation must still block movement`);
  }
});

test('offset colliders are indexed and tested at their shifted ground location', () => {
  const h = harness();
  const building = solid('bank', { x: 1000, y: 1000, cxo: 700, cyo: 0, crx: 40, cry: 30 });
  h.context.world.solids = [building];
  assert.equal(h.context.collide({ r: 13 }, 1700, 1000), true, 'The shifted foot is in a different spatial-grid cell');
  assert.equal(h.context.collide({ r: 13 }, 1000, 1000), false, 'The old sprite anchor must not remain a collider');
});

test('moving and resizing a farm object refreshes collision without changing the object count', () => {
  const h = harness();
  const item = { t: 'barn', x: 400, y: 500, sc: 1 };
  h.context.S = { farm: { b: [item] } };
  h.context.FARM_BUILD = [{ id: 'barn', col: { r: 40, crx: 80, cry: 30, cyo: 0 } }];
  h.context.scaleOf = it => it.sc;
  vm.runInContext(section('function rebuildFarmItems()', 'let buildMode='), h.context);
  h.context.rebuildFarmItems();
  assert.equal(h.context.collide({ r: 13 }, 400, 500), true);
  item.x = 1200; item.sc = 2;
  h.context.rebuildFarmItems();
  assert.equal(h.context.world.solids.length, 1);
  assert.equal(h.context.collide({ r: 13 }, 400, 500), false, 'The old location must be walkable');
  assert.equal(h.context.collide({ r: 13 }, 1200, 500), true, 'The new location must block');
  assert.equal(h.context.collide({ r: 13 }, 1340, 500), true, 'The resized footprint must block too');
});

test('a distant Home click walks to the clear door and a nearby click opens the right building', () => {
  const h = harness(), building = solid('smith');
  h.context.hero = { x: 50, y: 50, r: 13, target: {}, goPortal: true };
  h.context.holdMove = { id: 7 };
  h.context.enterHomeBuilding(building);
  const door = h.context.homeBuildingDoor(building);
  assert.equal(h.context.hero.moveTo.x, door.x);
  assert.equal(h.context.hero.moveTo.y, door.y);
  assert.equal(h.context.hero.pendingDoor.s.x, door.x);
  assert.equal(h.context.hero.pendingDoor.s.y, door.y);
  assert.equal(h.context.hero.target, null);
  assert.equal(h.context.holdMove, null);
  assert.equal(h.state.opened.length, 0);
  h.context.hero.x = door.x; h.context.hero.y = door.y;
  h.context.enterHomeBuilding(building);
  assert.deepEqual(h.state.opened, ['smith']);
  assert.equal(h.context.hero.moveTo, null);
});
