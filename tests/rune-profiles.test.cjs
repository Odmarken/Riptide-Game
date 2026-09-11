/* Run with: node --test tests/rune-profiles.test.cjs
 * Validates authored rune paths against actual source artwork, without loading
 * the game, starting Electron, using canvas or accessing a character profile.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { readRgbaPng } = require('./helpers/png.cjs');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'assets/weapons/rune-profiles.js'), 'utf8') + '\nglobalThis.profiles = WEAPON_RUNE_PROFILES;', context);
const profiles = context.profiles;
const names = ['sword', 'mace', 'staff', 'bow', 'rimfrost', 'rimfrost_mace', 'rimfrost_staff', 'rimfrost_bow', 'felglaive', 'felglaive_mace', 'felglaive_staff', 'felglaive_bow'];
const images = Object.fromEntries(names.map(name => [name, readRgbaPng(path.join(root, 'assets', names.indexOf(name) < 4 ? 'weapons' : 'models', `${name}.png`))]));

function validUv(point, label) {
  assert.equal(point.length, 2, label);
  assert.ok(point.every(value => Number.isFinite(value) && value >= 0 && value < 1), label);
}

// A segment may just graze a source PNG's antialiased edge. Permit a maximum
// Euclidean distance of ONE source pixel from a pixel with alpha > 100.
function onArtwork(image, x, y) {
  if (image.alpha(x, y) > 100) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const px = Math.floor(x) + dx, py = Math.floor(y) + dy;
    if (Math.hypot(px + .5 - x, py + .5 - y) <= 1 && image.alpha(px, py) > 100) return true;
  }
  return false;
}

test('profiles cover all ordinary and per-class legendary weapon assets', () => {
  assert.deepEqual(Object.keys(profiles).sort(), [...names].sort());
  for (const [name, profile] of Object.entries(profiles)) {
    assert.ok(profile.paths.length > 0, name);
    assert.ok(profile.emit.length > 0, name);
    for (const curve of profile.paths) {
      assert.ok(curve.length >= 8 && curve.length <= 24, `${name}: paths need 8–24 control points`);
      curve.forEach(point => validUv(point, `${name}: path point`));
    }
    profile.emit.forEach(point => validUv(point, `${name}: emission point`));
    assert.ok(profile.grip === null || (profile.grip.length === 2 && profile.grip[1] > 0), `${name}: grip definition`);
  }
});

for (const name of names) {
  test(`${name}: emitters touch opaque material and every interpolated path follows the artwork`, () => {
    const image = images[name], profile = profiles[name];
    for (const [u, v] of profile.emit) {
      assert.ok(image.alpha(u * image.width, v * image.height) > 100, `${name}: emitter ${u},${v} is in transparent space`);
    }
    for (let curveIndex = 0; curveIndex < profile.paths.length; curveIndex++) {
      const curve = profile.paths[curveIndex];
      for (let i = 1; i < curve.length; i++) {
        const [u0, v0] = curve[i - 1], [u1, v1] = curve[i];
        const dx = (u1 - u0) * image.width, dy = (v1 - v0) * image.height;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
        for (let step = 0; step <= steps; step++) {
          const x = u0 * image.width + dx * step / steps;
          const y = v0 * image.height + dy * step / steps;
          assert.ok(onArtwork(image, x, y), `${name}: curve ${curveIndex}, segment ${i}, source pixel ${x.toFixed(2)},${y.toFixed(2)} is more than 1px from solid material`);
        }
      }
    }
  });
}

test('grip bands are excluded by entire paths, including centrally held staves and bows', () => {
  for (const [name, profile] of Object.entries(profiles)) {
    if (!profile.grip) continue;
    const low = profile.grip[0] - profile.grip[1], high = profile.grip[0] + profile.grip[1];
    for (const curve of profile.paths) {
      assert.ok(curve.every(point => point[1] < low) || curve.every(point => point[1] > high), `${name}: a path crosses its leather grip band`);
    }
    for (const point of profile.emit) {
      assert.ok(point[1] < low || point[1] > high, `${name}: an emitter lies in the grip band`);
    }
  }
});

test('bows retain separate upper and lower limbs and both glaive lobes survive half-image cropping', () => {
  for (const name of ['bow', 'rimfrost_bow', 'felglaive_bow']) {
    const profile = profiles[name], [middle, half] = profile.grip;
    assert.ok(profile.paths.some(curve => curve.every(point => point[1] < middle - half)), `${name}: missing upper limb`);
    assert.ok(profile.paths.some(curve => curve.every(point => point[1] > middle + half)), `${name}: missing lower limb`);
  }
  const image = images.felglaive;
  for (const side of [0, 1]) {
    const curves = profiles.felglaive.paths.filter(curve => curve.every(point => side === 0 ? point[0] < .5 : point[0] > .5));
    assert.ok(curves.length > 0, `Missing ${side ? 'right' : 'left'} glaive lobe`);
    for (const curve of curves) for (const [u, v] of curve) {
      const croppedU = (u - side * .5) * 2;
      assert.ok(croppedU >= 0 && croppedU < 1);
      assert.ok(image.alpha((side * .5 + croppedU * .5) * image.width, v * image.height) > 100);
    }
  }
});
