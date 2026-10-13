/* Run with: node --test tests/hero-views.test.cjs
 * 🧭 Side and back views (2026-10-12, a test with the human male warrior: "koppla så jag får se"). The real layout and draw
 * functions - cut out of game.js and assets/characters/layout.js - against the real PNGs: the views are drawn on the front's
 * own scale and stand on the same hem with the weapon in a painted fist; the camera's side follows where he heads; from the
 * side the shield and his back are behind him, from behind the weapon is behind him and his back is in sight; the boots
 * stride from the side; and the view test starts like the other test scenarios.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readRgbaPng } = require('./helpers/png.cjs');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'assets/characters/layout.js'), 'utf8');
const section = (a, b) => { const i = game.indexOf(a), j = game.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, 'cannot find ' + a); return game.slice(i, j); };
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);
const png = name => readRgbaPng(path.join(root, 'assets/characters', name + '.png'));
const pngSize = file => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

/* a stand-in for the browser's Image: setting src reads the real PNG's size, a missing file never loads */
class FakeImage {
  set src(v) {
    this._src = v; this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0;
    const m = /^assets\/(.+?\.png)/.exec(v), f = m && path.join(root, 'assets', m[1]);
    if (f && fs.existsSync(f)) { [this.naturalWidth, this.naturalHeight] = pngSize(f); this.complete = true; }
  }
  get src() { return this._src; }
}
function multiply(a, b) {
  return { a: a.a * b.a + a.c * b.b, b: a.b * b.a + a.d * b.b, c: a.a * b.c + a.c * b.d, d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e, f: a.b * b.e + a.d * b.f + a.f };
}
const pointAt = (m, x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

function harness() {
  const draws = [], stack = [], path = [], clips = [];
  let transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const ctx = {
    save() { stack.push({ ...transform }); }, restore() { assert.ok(stack.length, 'balanced saves'); transform = stack.pop(); },
    scale(x, y) { transform = multiply(transform, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); },
    rotate(a) { transform = multiply(transform, { a: Math.cos(a), b: Math.sin(a), c: -Math.sin(a), d: Math.cos(a), e: 0, f: 0 }); },
    translate(x, y) { transform = multiply(transform, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); },
    getTransform() { return { ...transform }; }, setTransform(a, b, c, d, e, f) { transform = { a, b, c, d, e, f }; },
    drawImage(img, ...rect) { draws.push({ img, rect, matrix: { ...transform } }); },
    beginPath() { path.length = 0; }, rect(x, y, w, h) { path.push([x, y, w, h]); }, ellipse(...e) { path.push(['ellipse', ...e]); },
    clip() { clips.push({ rects: path.map(r => [...r]), at: draws.length }); },
  };
  const img = src => Object.assign(new FakeImage(), { src });
  const c = vm.createContext({ ctx, Image: FakeImage, performance: { now: () => 0 }, $: () => null,
    RACES: ['human', 'dwarf', 'orc', 'undead'].map(id => ({ id })), CHAR_RUN: {},
    bootImg: img('assets/characters/fot.png'), bootSideImg: img('assets/characters/fot_side.png?v=1'), bootBackImg: img('assets/characters/fot_back.png?v=1'),
    swordImg: img('assets/weapons/sword.png'), maceImg: img('assets/weapons/mace.png'),
    staffImg: img('assets/weapons/staff.png'), bowImg: img('assets/weapons/bow.png'), wgImg: img('assets/models/felglaive.png'),
    warriorShieldImg: img('assets/weapons/warrior_shield.png'),
    FG_ART: {}, FK_ART: {}, fgArtFor: () => null, fkArtFor: () => ({}), isFGLegend: () => false,
    mip: i => i, crisp: i => i, feet() {}, drawGlaive() {},
    runeOnSpare: (g, rune, im, x, y, W, H, grip, sx, sw, draw) => draw(), runeTintOnly: (g, rune, im, x, y, W, H, grip, sx, sw, draw) => draw(), runeUnder: () => null, runeTint() {}, runeMarks() {}, runeEmitter: () => null });
  const aliases = ['RACE_ALIAS', 'CLASS_ALIAS'].map(n => game.match(new RegExp(`const ${n}=.*?;`))[0]).join('\n');
  vm.runInContext(layout + '\n' + aliases + '\n' + game.match(/const CHAR_SPRITES=\{[^]*?\};/)[0]
    + '\n' + section('const charSpriteCache={};', '/* run sheets keyed the same way')
    + '\n' + section('function femBootW(', 'const brunnImg=')
    + '\n' + section('function backWeaponArt(', 'function drawPadPrompt(')
    + '\nthis.views=CHARACTER_VIEWS;', c);
  /* 🧭 the weapons' side pictures, the real table over the real files */
  vm.runInContext("const fkImg=Object.assign(new Image(),{src:'assets/models/frostseeker.png'}),fkImgMace=Object.assign(new Image(),{src:'assets/models/frostseeker_mace.png'}),"
    + "fkImgStaff=Object.assign(new Image(),{src:'assets/models/frostseeker_staff.png'}),fkImgBow=Object.assign(new Image(),{src:'assets/models/frostseeker_bow.png'}),"
    + "fgImgMace=Object.assign(new Image(),{src:'assets/models/felglaive_mace.png'}),fgImgStaff=Object.assign(new Image(),{src:'assets/models/felglaive_staff.png'}),"
    + "fgImgBow=Object.assign(new Image(),{src:'assets/models/felglaive_bow.png'});"
    + section('const sideOf=', 'function femBootW(') + 'this.fkImg=fkImg;this.fkImgBow=fkImgBow;', c);
  return { c, ctx, draws, stack, clips };
}
const champ = (h, fx, view, holster = false, race = 'human') => {
  h.draws.length = 0;
  h.c.drawChampionSprite(h.ctx, race, 'warrior', fx, 0, 0, false, null, false, 1, false, null, null, undefined, holster, view);
  assert.equal(h.stack.length, 0, 'balanced');
  return h.draws.map(d => ({ ...d, name: d.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', '') }));
};

/* the front a view was cut from: the Emperor's pair stands for every male race, the Empress's for every female one */
const frontOf = view => view.startsWith('emperor_male_') ? 'emperor_male' : view.startsWith('empress_') ? 'humanfemale_emperor' : view.replace(/_(side|back)$/, '');
const bodyH = front => front.endsWith('_royal') ? 56 : front === 'emperor_male' ? 52 : front.endsWith('_emperor') ? 52 * 960 / 900 : 48;

test('every hero, outfit and sex has a side and a back view, each on its front\'s own scale and hem, the feet under the body', () => {
  const h = harness(), bounds = vm.runInContext('CHARACTER_BOUNDS', h.c), keys = Object.keys(vm.runInContext('CHAR_SPRITES', h.c));
  assert.equal(vm.runInContext('HERO_VIEWS_MISSING.size', h.c), 0, 'nobody waits for a picture');
  const file = (key, v) => key.includes('male_emperor') && !key.includes('female') ? 'emperor_male_' + v : key.endsWith('female_emperor') ? 'empress_' + v : key + '_' + v;
  for (const key of keys) for (const v of ['side', 'back']) assert.ok(h.c.views[file(key, v)], key + ': a ' + v + ' view');
  assert.equal(Object.keys(h.c.views).length, 2 * (keys.filter(k => !k.endsWith('_emperor')).length + 2), 'one pair per picture, and one each for the masked pair');
  for (const [name, [w, ht, foot, gx, gy, bodyPx, back]] of Object.entries(h.c.views)) {
    const im = png(name), front = frontOf(name), fim = png(front), box = bounds[front] && bounds[front][0] === fim.width ? bounds[front] : [fim.width, fim.height, 0, 0, fim.width, fim.height];
    assert.deepEqual([im.width, im.height], [w, ht], name + ': the table matches the picture');
    assert.equal(bodyPx, box[5], name + ': measured against its front\'s box');
    const lowest = img => { let y = img.height - 1; while (y > 0 && ![...Array(img.width).keys()].some(x => img.alpha(x, y) > 128)) y--; return y; };
    const padB = box[3] + box[5] - 1 - lowest(fim), low = lowest(im);
    assert.ok(Math.abs(ht - 1 - padB - low) <= 2, `${name}: the hem where the front's is (${ht - 1 - padB} / ${low})`);
    const band = Math.max(3, Math.round(ht * .04));   /* the bottom of the hem - a single row can be one plate's point */
    const hem = [...Array(im.width).keys()].filter(x => [...Array(band).keys()].some(d => im.alpha(x, low - d) > 128));
    assert.ok(foot > hem[0] && foot < hem.at(-1), name + ': the feet column is under the hem');
    assert.ok(gx >= 0 && gx < w && gy >= 0 && gy < ht, name + ': the grip is on the picture');
    if (name.endsWith('_side')) assert.ok(back > foot, name + ': its back edge behind the feet'); else assert.equal(back, 0, name);
    const frame = h.c.characterBodyFrame(Object.assign(new FakeImage(), { src: `assets/characters/${name}.png?v=1` }), bodyH(front));
    close(frame.height, ht * bodyH(front) / bodyPx, name + ': the front\'s pixels per unit'); close(frame.y + frame.height, 5, name + ': on the hem line');
    close(frame.x + foot * frame.width / w, 0, name + ': feet column at the origin');
    close(frame.hand.x, frame.x + gx * frame.width / w, name + ': grip x'); close(frame.hand.y, frame.y + gy * frame.height / ht, name + ': grip y');
    if (back) close(frame.backX, (back - foot) * frame.width / w, name + ': back edge');
  }
  const [w, , foot, , , , back] = h.c.views.humanmale_warrior_side;
  close((back - foot) * 48 / 800, 7.02, 'the first one keeps the back edge it was tuned with');
});

test('the painted frame turns for every costume - the Emperor and the Empress one picture each - and waits on the front while a view loads', () => {
  const h = harness(), p = (...a) => h.c.paintedCharacterFrame(...a);
  const side = p('human', 'warrior', false, false, 'side'), back = p('human', 'warrior', false, false, 'back');
  assert.equal(side.view, 'side'); assert.match(side.image.src, /humanmale_warrior_side\.png\?v=1$/);
  assert.equal(back.view, 'back'); assert.match(back.image.src, /humanmale_warrior_back\.png\?v=1$/);
  const front = p('human', 'warrior', false, false);
  assert.equal(front.view, 'front'); assert.match(front.image.src, /humanmale_warrior\.png\?v=3$/);
  assert.deepEqual({ ...side.boots }, { ...front.boots }, 'the same boots in every view');
  for (const [args, file] of [[['orc', 'warrior', false, false, 'side'], 'orcmale_warrior_side'], [['human', 'warrior', true, false, 'side'], 'humanfemale_warrior_side'],
    [['human', 'priest', false, true, 'back'], 'humanmale_armor_back'], [['dwarf', 'mage', true, 'royal', 'side'], 'dwarffemale_royal_side'],
    [['orc', 'hunter', false, 'emperor', 'side'], 'emperor_male_side'], [['undead', 'warrior', true, 'emperor', 'back'], 'empress_back']]) {
    const f = p(...args); assert.equal(f.view, args[4], file); assert.match(f.image.src, new RegExp('/' + file + '\\.png\\?v=1$'), file);
    close(f.height, f.image.naturalHeight * f.bodyHeight / h.c.views[file][5], file + ': its front\'s scale');
  }
  vm.runInContext("HERO_VIEWS_MISSING.add('orcmale_warrior')", h.c);
  assert.equal(p('orc', 'warrior', false, false, 'side').view, 'front', 'a picture still to be made: the front');
  vm.runInContext("charSpriteCache.humanmale_warrior_side.complete=false", h.c);
  const loading = p('human', 'warrior', false, false, 'side');
  assert.equal(loading.view, 'front', 'still loading: the front, never the procedural body'); assert.match(loading.image.src, /humanmale_warrior\.png/);
});

test('which view: across the screen the side, up his back, down the front - turning only while he moves, fights or mines', () => {
  const c = vm.createContext({ fish: { on: false }, S: { mining: { on: false } }, mineTarget: null });
  vm.runInContext(section('const VIEW_TURN=', 'function drawHero(){'), c);
  const h = { fx: 1, fy: 0 }, at = (fx, fy, more = {}) => { Object.assign(h, { fx, fy, moving: true, target: null }, more); return c.heroViewNow(h, false, false); };
  assert.equal(c.heroViewNow(h, false, false), 'front', 'a hero who has not moved yet faces the camera');
  assert.equal(at(1, 0), 'side'); assert.equal(at(0, -1), 'back'); assert.equal(at(-1, 0), 'side'); assert.equal(at(0, 1), 'front');
  /* five degrees past a diagonal before it turns */
  assert.equal(at(.75, .66), 'front', 'just past 45 degrees but inside the margin: still the front');
  assert.equal(at(.8, .6), 'side');
  assert.equal(at(.68, -.73), 'side', 'inside the margin from the side');
  assert.equal(at(.55, -.84), 'back');
  /* standing still keeps the way he faced; a fight and a pick turn him */
  assert.equal(at(1, 0, { moving: false }), 'back', 'standing: no turn');
  assert.equal(at(-1, 0, { moving: false, target: { dead: false } }), 'side', 'turned to his foe');
  assert.equal(at(0, 1, { moving: false, target: { dead: true } }), 'side', 'a dead foe turns no one');
  c.S.mining.on = true; c.mineTarget = {};
  assert.equal(at(0, 1, { moving: false }), 'front', 'mining turns him to the rock');
  /* the saddle, a dance and the rod keep the front picture, and his own view waits for him */
  assert.equal(c.heroViewNow(h, true, false), 'side', 'on a mount: in profile, like the mount'); assert.equal(c.heroViewNow(h, false, true), 'front');
  c.fish.on = true; assert.equal(c.heroViewNow(h, false, false), 'front'); c.fish.on = false;
  assert.equal(h.view, 'front');
  /* the last clear sideways facing, kept for the back picture's hands */
  at(-1, 0); assert.equal(h.faceX, -1); at(.1, -1); assert.equal(h.faceX, -1, 'heading straight up keeps it'); at(.9, -.2); assert.equal(h.faceX, 1);
});

test('front: body, sword, shield as ever; side: shield, body, sword in the one fist; back: the shield in front of him, the sword in sight over him', () => {
  const h = harness();
  for (const fx of [-1, 1]) {
    const f = champ(h, fx);
    assert.deepEqual(f.map(d => d.name), ['humanmale_warrior', 'sword', 'warrior_shield']);
    const s = champ(h, fx, 'side');
    assert.deepEqual(s.map(d => d.name), ['warrior_shield', 'humanmale_warrior_side', 'sword'], 'the far arm\'s shield behind him');
    const [shield, body, sword] = s, [bx, by, bw, bh] = body.rect, [w, ht, foot, gx, gy] = h.c.views.humanmale_warrior_side;
    const fist = pointAt(body.matrix, bx + gx / w * bw, by + gy / ht * bh), grip = pointAt(sword.matrix, 0, 0);
    close(grip.x, fist.x, `side ${fx}: the sword in the painted fist x`); close(grip.y, fist.y, `side ${fx}: y`);
    close(pointAt(body.matrix, bx + foot / w * bw, 0).x, 0, `side ${fx}: the feet column at the origin`);
    const [sx, sy, sw, sh] = shield.rect, sc = pointAt(shield.matrix, sx + sw / 2, sy + sh / 2);
    assert.equal(Math.sign(sc.x - grip.x), -Math.sign(fx), `side ${fx}: the shield a step behind the fist`);
    const wide = m => Math.abs(m.a) * sw, full = champ(h, fx).find(d => d.name === 'warrior_shield');
    assert.ok(wide(shield.matrix) < 0.5 * Math.abs(full.matrix.a) * full.rect[2], 'edge-on');
    const b = champ(h, fx, 'back');
    /* 2026-10-12: "alla vapen ska inte va mer synlig om man tittar mot skärmen än går upp" - the weapon in his hand is in sight from behind */
    assert.deepEqual(b.map(d => d.name), ['warrior_shield', 'humanmale_warrior_back', 'sword'], 'the shield in front of him, the sword over him');
    const bgrip = pointAt(b[2].matrix, 0, 0), [shx, shy, shw, shh] = b[0].rect, bshield = pointAt(b[0].matrix, shx + shw / 2, shy + shh / 2);
    assert.equal(Math.sign(bgrip.x), Math.sign(fx), `back ${fx}: the weapon on the side he last faced`);
    assert.equal(Math.sign(bshield.x), -Math.sign(fx), `back ${fx}: the shield on the other fist`);
  }
  assert.deepEqual(champ(h, 1, 'side', false, 'orc').map(d => d.name), ['warrior_shield', 'orcmale_warrior_side', 'sword'], 'every hero turns');
  vm.runInContext("HERO_VIEWS_MISSING.add('orcmale_warrior')", h.c);
  assert.deepEqual(champ(h, 1, 'side', false, 'orc').map(d => d.name), ['orcmale_warrior', 'sword', 'warrior_shield'], 'no picture yet: the front as ever');
});

test('holstered: behind his back edge from the side, squeezed to its depth; over his back from behind', () => {
  const h = harness();
  const front = champ(h, -1, undefined, true);
  assert.deepEqual(front.map(d => d.name), ['sword', 'warrior_shield', 'humanmale_warrior'], 'the front as ever: behind the body');
  const extent = d => { const [x, y, w, ht] = d.rect, xs = [[x, y], [x + w, y], [x, y + ht], [x + w, y + ht]].map(([a, b]) => pointAt(d.matrix, a, b).x); return [Math.min(...xs), Math.max(...xs)]; };
  for (const fx of [-1, 1]) {
    const s = champ(h, fx, 'side', true);
    assert.deepEqual(s.map(d => d.name), ['sword_side', 'warrior_shield', 'humanmale_warrior_side'], 'behind the body, its edge (sword_side.png) toward us');
    const [lo, hi] = extent(s[0]), [flo, fhi] = extent(front[0]);
    assert.ok(hi - lo < 0.7 * (fhi - flo), `side ${fx}: almost upright, not the front's slant`);
    assert.equal(Math.sign((lo + hi) / 2), -Math.sign(fx), `side ${fx}: at the back, away from where he faces`);
    const [x, y, w, ht] = s[0].rect, hilt = pointAt(s[0].matrix, x + w / 2, y + ht);   /* the sword picture's grip end */
    assert.ok(hilt.y < -33 && hilt.y > -40 && hilt.x * -Math.sign(fx) > 8, `side ${fx}: the hilt up behind his head, a little lower than at first ("sänk vapnen lite också från sidan") (${hilt.x.toFixed(1)},${hilt.y.toFixed(1)})`);
    const [sx, sy, sw, sh] = s[1].rect, sc = pointAt(s[1].matrix, sx + sw / 2, sy + sh / 2);
    assert.ok(sc.x * -Math.sign(fx) > 8 && Math.abs(s[1].matrix.a) < 0.35, `side ${fx}: the shield edge-on on his back`);
    const b = champ(h, fx, 'back', true);
    assert.deepEqual(b.map(d => d.name), ['humanmale_warrior_back', 'sword', 'warrior_shield', 'humanmale_warrior_back'], 'over his back - and his head laid again over them');
    /* 2026-10-12, from the user's look at it: "sätt skölden mer i mitten och svärdet ska ner lite" */
    const [qx, qy, qw, qh] = b[2].rect, mid = pointAt(b[2].matrix, qx + qw / 2, qy + qh / 2);
    assert.ok(Math.abs(mid.x) < 0.5 && mid.y > -16 && mid.y < -8, `back ${fx}: the shield in the middle of his back`);
    const end = d => pointAt(d.matrix, d.rect[0] + d.rect[2] / 2, d.rect[1] + d.rect[3]);   /* the sword picture's grip end */
    const bhilt = end(b[1]), before = end(front[0]);
    assert.ok(bhilt.x > 12 && bhilt.y < -28 && bhilt.y >= before.y - 1e-9 && bhilt.y < before.y + 6, `back ${fx}: the hilt just over his right shoulder, close to the front's height (${bhilt.x.toFixed(1)},${bhilt.y.toFixed(1)} vs ${before.y.toFixed(1)})`);
    /* "så den inte rör sig i olika vinklar": the shield is the same point on his back from the front, the side and behind */
    const centre = d => pointAt(d.matrix, d.rect[0] + d.rect[2] / 2, d.rect[1] + d.rect[3] / 2);
    const fsh = centre(front[1]), bsh = centre(b[2]), ssh = centre(s[1]);
    close(fsh.x, bsh.x, 'shield x, front and back'); close(fsh.y, bsh.y, 'shield y, front and back'); close(ssh.y, bsh.y, 'shield y, side and back');
  }
});

test('the warrior\'s Fel Glaives on his back: each a whole glaive along the cut halves\' line, the spare always, its mirror crossing it when holstered', () => {
  /* 2026-10-12, the last word after six tries: "dom som är kapade är rätt! dom är bara hälften så visa hela vapnet dom ska sticka ut
     där nere också" - the cut halves rising over the shoulders were right; each becomes the whole glaive (blade, skull, blade) */
  const h = harness();
  vm.runInContext(game.match(/const WG_BACK=\{[^}]+\};/)[0] + 'this.WG_BACK=WG_BACK;', h.c);
  h.c.isFGLegend = () => true;
  const glaives = (fx, view, holster) => {
    h.draws.length = 0;
    h.c.drawChampionSprite(h.ctx, 'human', 'warrior', fx, 0, 0, false, 'felglaives', false, 1, false, null, null, undefined, holster, view);
    assert.equal(h.stack.length, 0, 'balanced');
    return h.draws.map(d => ({ ...d, name: d.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', '') }));
  };
  const { WG_BACK } = h.c, full = 2873;
  /* a whole glaive: drawImage(img, 0, 0, full width, height, dx, dy, dw, dh) - its ends at dx and dx + dw, the skull between */
  const ends = d => { const [sx, , sw, , dx, dy, dw, dh] = d.rect; assert.equal(sx, 0); close(sw, full, 'the whole picture, both blades and the skull');
    const a = pointAt(d.matrix, dx, dy + dh / 2), b = pointAt(d.matrix, dx + dw, dy + dh / 2); return a.y < b.y ? { up: a, low: b } : { up: b, low: a }; };
  /* where the approved cut halves' tips were: the half centred at (-7, -34), 42 long, leaning 1.22 */
  const tip = { x: -7 - 21 * Math.cos(1.22), y: -34 - 21 * Math.sin(1.22) };
  for (const fx of [-1, 1]) {
    const hf = glaives(fx, undefined, false), hb = glaives(fx, 'back', false);
    const f = glaives(fx, undefined, true);
    const s = glaives(fx, 'side', true), b = glaives(fx, 'back', true);
    /* in his hands one glaive held level, the other whole on his back */
    assert.deepEqual(hf.map(d => d.name), ['felglaive', 'humanmale_warrior', 'felglaive'], `front ${fx}: the spare behind him, one glaive in his hands`);
    assert.deepEqual(hb.map(d => d.name), ['felglaive', 'humanmale_warrior_back', 'felglaive'], `back ${fx}: the held one in front of him, the spare over his back`);
    ends(hb[2]);
    /* holstered: two whole glaives - no third thing */
    assert.deepEqual(f.map(d => d.name), ['felglaive', 'felglaive', 'humanmale_warrior'], `front ${fx}: two glaives behind him`);
    assert.deepEqual(b.map(d => d.name), ['humanmale_warrior_back', 'felglaive', 'felglaive'], `back ${fx}: two glaives over his back`);
    assert.deepEqual(s.map(d => d.name), ['felglaive_side', 'felglaive_side', 'humanmale_warrior_side'], `side ${fx}: one glaive edge-on - a blade up, a blade down - standing for both`);
    /* from behind the spare is drawn mirrored so it keeps his right shoulder (a reviewer's catch) - one glaive over each shoulder either way */
    const [l, r] = [ends(b[1]), ends(b[2])].sort((p, q) => p.up.x - q.up.x);
    for (const [g, side] of [[l, -1], [r, 1]]) {
      close(g.up.x, side * -tip.x, `back ${fx}: an upper blade where the approved cut one's tip was (x)`); close(g.up.y, tip.y, `back ${fx}: (y)`);
      assert.ok(g.up.y < -48, 'over his head');
      assert.equal(Math.sign(g.low.x), -side, `back ${fx}: the lower blade on past the middle, out the other side`);
      assert.ok(g.low.y > -12, `back ${fx}: the lower blade down low (${g.low.y.toFixed(1)}) - "dom ska sticka ut där nere också"`);
    }
    close(Math.hypot(l.up.x - l.low.x, l.up.y - l.low.y), 2 * WG_BACK.h, 'as long as WG_BACK says');
    const [fl, fr] = [ends(f[0]), ends(f[1])];
    assert.ok(fl.up.y < -48 && fr.up.y < -48 && Math.sign(fl.up.x) === -Math.sign(fr.up.x), `front ${fx}: both upper blades over the shoulders`);
    /* from the side: the spare's edge up from the skull's height and turned over down from it */
    const [, sy0, , sh0] = s[0].rect;
    assert.ok(Math.abs(s[0].matrix.d) > 0 && Math.sign(s[0].matrix.d) === -Math.sign(s[1].matrix.d), `side ${fx}: one up, one turned over`);
    assert.ok(sh0 > 0 && sy0 === -sh0, 'each from the skull outward');
  }
});

test('legendaries on the back sit lower - their top end where the plain weapon\'s is - and a bow is edge-on from the side', () => {
  /* 2026-10-12: "frostseeker på alla gubbar ska ner lite gör så det syns från alla vinklar", "fixa hunters sido profil på vapnet" */
  const h = harness();
  vm.runInContext("FK_ART.warrior={img:fkImg,h:1.38,std:{pw:38,pl:27,grip:H=>4-H}};FK_ART.hunter={img:fkImgBow,h:1.38,std:{pw:44,pl:31,grip:H=>-4-H/2},mirror:true};"
    + 'fkArtFor=c=>FK_ART[c]||FK_ART.warrior;', h.c);
  const onBack = (cls, fm, view) => {
    h.draws.length = 0;
    h.c.drawChampionSprite(h.ctx, 'human', cls, -1, 0, 0, fm, null, false, 1, false, null, null, undefined, true, view);
    assert.equal(h.stack.length, 0, 'balanced');
    const d = h.draws.find(x => !/humanmale_|shield/.test(x.img.src));
    const [x, y, w, ht] = d.rect, a = pointAt(d.matrix, x + w / 2, y), b = pointAt(d.matrix, x + w / 2, y + ht);
    const across = Math.abs(pointAt(d.matrix, x, y + ht / 2).x - pointAt(d.matrix, x + w, y + ht / 2).x);
    return { top: a.y < b.y ? a : b, low: a.y < b.y ? b : a, across, src: d.img.src };
  };
  for (const [cls, view] of [['warrior', undefined], ['hunter', undefined], ['hunter', 'back']]) {   /* the warrior's sword+shield keep the user's own back */
    const plain = onBack(cls, false, view), fk = onBack(cls, true, view), tag = `${cls} ${view || 'front'}`;
    assert.ok(Math.abs(fk.top.x - plain.top.x) < 1e-6 && Math.abs(fk.top.y - plain.top.y) < 1e-6, `${tag}: the top end where the plain weapon's is`);
    assert.ok(fk.low.y > plain.low.y + 4, `${tag}: the longer one goes down his back`);
  }
  for (const cls of ['warrior', 'hunter']) {
    const plain = onBack(cls, false, 'side'), fk = onBack(cls, true, 'side');
    assert.ok(fk.top.y <= plain.top.y, `${cls} side: standing upright it is not pushed into the ground`);
  }
  /* 2026-10-12 "göra asset för frostseeker, felglaive och alla default vapen från sidan": from the side each shows its own edge picture */
  for (const [cls, fm] of [['hunter', false], ['hunter', true], ['warrior', false], ['warrior', true]]) {
    const sideD = onBack(cls, fm, 'side'), frontD = onBack(cls, fm, undefined), tag = `${cls}${fm ? ' Frostseeker' : ''}`;
    assert.ok(/_side\.png/.test(sideD.src), `${tag} from the side: ${sideD.src}`);
    assert.ok(sideD.across < 0.6 * frontD.across, `${tag} from the side is its edge (${sideD.across.toFixed(1)} across, ${frontD.across.toFixed(1)} from the front)`);
    const sideLen = Math.hypot(sideD.top.x - sideD.low.x, sideD.top.y - sideD.low.y), frontLen = Math.hypot(frontD.top.x - frontD.low.x, frontD.top.y - frontD.low.y);
    assert.ok(sideLen <= frontLen + 1e-9 && sideLen > 0.5 * frontLen, `${tag}: from the side no longer than from the front - a long one foreshortened (${sideLen.toFixed(1)} of ${frontLen.toFixed(1)})`);
    assert.ok(sideD.low.y <= 12 + 1e-9, `${tag}: from the side its lower end stays behind his legs, above his soles (${sideD.low.y.toFixed(1)})`);
  }
  /* "sänk vapnen lite också från sidan sitter lite högt upp": from the side the top end hangs SIDE_DROP lower than it did, legendary or not */
  const drop = +game.match(/SIDE_DROP=(\d+(?:\.\d+)?)/)[1];
  for (const cls of ['warrior', 'hunter']) {
    const std = cls === 'hunter' ? 44 : 38, was = -24 - std / 2 * Math.cos(.22);
    for (const fm of [false, true]) close(onBack(cls, fm, 'side').top.y, was + drop, `${cls}${fm ? ' Frostseeker' : ''}: the top end ${drop} lower from the side`);
  }
});

test('the profile boots point the way he faces and stride past each other, the heels show from behind - all on fot.png\'s scale and ground', () => {
  const h = harness(), boots = h.c.paintedCharacterFrame('human', 'warrior', false, false, 'side').boots;
  const k = boots.bw / 578, ground = boots.top + boots.bw * 677 / 578;   /* fot.png is 578x677 */
  const shaft = vm.runInContext('BOOT_SIDE_SHAFT', h.c), hem = [-4.98, 5.4];   /* the side picture's hem, in units round the feet column */
  for (const side of [-1, 1]) for (const walk of [0, .4, 1.2, 2.5]) for (const moving of [false, true]) {
    h.draws.length = 0;
    h.c.bootFeet({ ...boots, moving, walk, bob: 0, side }, h.ctx);
    assert.equal(h.draws.length, 2); assert.equal(h.stack.length, 0);
    h.draws.forEach((d, i) => {
      assert.match(d.img.src, /fot_side\.png/, 'the profile boot');
      assert.equal(d.matrix.a, side < 0 ? 1 : -1, 'both toes the same way: looking left natively, mirrored to the right');
      const [x, y, w, ht] = d.rect, leg = x + w * shaft;   /* in the boot's own (native, left-looking) frame, like the hem */
      close(w, 730 * k, 'on fot.png\'s scale'); close(ht, 632 * k, 'on fot.png\'s scale');
      assert.ok(leg > hem[0] - 3 && leg < hem[1] + 3, `side ${side} walk ${walk}: the leg over the boot is under the hem`);
      assert.ok(y + ht <= ground + 1e-9, 'a step only lifts: the sole is never below the ground');
      if (!moving) close(y + ht, ground - (i === 0 ? 0.8 : 0), 'standing on the ground, the far foot a hair up the screen');
    });
  }
  h.draws.length = 0; h.c.bootFeet({ ...boots, moving: false, walk: 0, bob: 0, back: true }, h.ctx);
  assert.deepEqual(h.draws.map(d => [/fot_back\.png/.test(d.img.src), d.matrix.a]), [[true, 1], [true, -1]], 'from behind: the heels, one mirrored');
  for (const d of h.draws) { close(d.rect[2], 459 * k, 'the back boot on fot.png\'s scale'); close(d.rect[1] + d.rect[3], ground, 'on the ground'); }
  h.draws.length = 0; h.c.bootFeet({ ...boots, moving: false, walk: 0, bob: 0 }, h.ctx);
  assert.deepEqual(h.draws.map(d => [d.img.src, d.matrix.a]), [['assets/characters/fot.png', 1], ['assets/characters/fot.png', -1]], 'the front: splayed as ever');
  vm.runInContext('bootSideImg.complete=false;bootBackImg.complete=false', h.c);
  for (const turn of [{ side: -1 }, { back: true }]) {
    h.draws.length = 0; h.c.bootFeet({ ...boots, moving: false, walk: 0, bob: 0, ...turn }, h.ctx);
    assert.ok(h.draws.length === 2 && h.draws.every(d => d.img.src === 'assets/characters/fot.png'), 'still loading: the front boot meanwhile');
  }
});

test('the view test: started by the shell before the cloud, a throwaway human male warrior in his own colours, kept out of every save', () => {
  const boot = game.slice(game.indexOf('(async()=>{\n /* 🧪'), game.indexOf('if(FB.user)await enterAfterAuth();'));
  assert.ok(boot.includes("if(test==='views'){") && /viewsTest\(\);return;\}/.test(boot));
  assert.ok(boot.indexOf("test==='views'") < boot.indexOf('await initFirebase()'));
  const logs = [], c = vm.createContext({ Math, Date, logs,
    freshState: (name, race, cls) => ({ name, race, cls, zone: 0, bag: [] }), migrate: s => s, esc: s => s, log: t => logs.push(t),
    $: () => ({ classList: { remove() {} } }), zoneOf: () => ({ name: 'Willowmere Fields' }) });
  vm.runInContext('let S=null,gameOn=false;function beginGame(){gameOn=true;}' + section('const TEST_NAMES=', 'function raidTest(')
    + section('const TEST_NAMES_F=', 'const fmtNum=') + ';this.viewsTest=viewsTest;this.S=()=>S;', c);
  assert.match(c.viewsTest(), /^view test: \w+ the Human Warrior in Willowmere Fields$/);
  const S = c.S();
  assert.deepEqual([S.race, S.cls, S.gender, S.outfit, S.zone, S.test], ['human', 'warrior', 'm', 'default', 0, true]);
  assert.match(logs[0], /View test/);
  vm.runInContext('S={id:"real"};gameOn=true;', c);
  assert.match(c.viewsTest(), /^Change Character first/, 'never takes over a real hero in play');
});

test('every weapon has its side picture: as tall as its front, standing the same way up, its edge narrower', () => {
  /* 2026-10-12: "vi måste nu göra assset för frostseeker, felglaive och alla default vapen från sidan så det blir bättre" */
  const man = JSON.parse(fs.readFileSync(path.join(root, 'assets/weapons/weapon-sides-manifest.json'), 'utf8'));
  const table = section('const WEAPON_SIDE=new Map([', ']);');
  for (const [name, w] of Object.entries(man.weapons)) {
    const side = readRgbaPng(path.join(root, w.file));
    assert.ok(game.includes(`'${w.file}'`), `${w.file} is loaded by the game`);
    if (name === 'felglaive_single') { assert.equal(side.height, 1155, 'the spare glaive: blade and plate of the pair art'); continue; }
    assert.ok(table.includes(`'${w.file}'`), `${w.file} is in WEAPON_SIDE`);
    const front = readRgbaPng(path.join(root, w.front));
    assert.equal(side.height, front.height, `${name}: as tall as its front`);
    const rows = img => { const r = []; for (let y = 0; y < img.height; y++) { let any = false; for (let x = 0; x < img.width && !any; x++) any = img.alpha(x, y) > 20; if (any) r.push(y); } return [r[0], r[r.length - 1]]; };
    const [ft, fb] = rows(front), [st, sb] = rows(side);
    assert.ok(Math.abs(ft - st) <= 0.012 * front.height && Math.abs(fb - sb) <= 0.012 * front.height, `${name}: top ${st} and bottom ${sb} where the front's are (${ft}, ${fb})`);
    assert.ok(side.width < front.width, `${name}: its edge is narrower than its face`);
  }
});

test('from the front and the side the boots just painted are laid again over what hangs on his back; from behind it covers them', () => {
  /* 2026-10-12: "går det att göra något åt där vid skorna?" - the glaives' lower blades were painted over his boots */
  const h = harness();
  vm.runInContext(game.match(/const WG_BACK=\{[^}]+\};/)[0], h.c);
  const boots = h.c.paintedCharacterFrame('human', 'warrior', false, false).boots;
  const draw = (view, holster, fg, side = 0) => {
    h.c.isFGLegend = () => fg;
    h.c.bootFeet({ ...boots, moving: false, walk: 0, side, back: view === 'back' }, h.ctx);   /* as every call site does: the boots, then him */
    h.draws.length = 0;
    h.c.drawChampionSprite(h.ctx, 'human', 'warrior', -1, 0, 0, false, fg ? 'felglaives' : null, false, 1, false, null, null, undefined, holster, view);
    assert.equal(h.c.bootFeet.last, null, 'taken and cleared - never another figure\'s');
    return h.draws.map(d => d.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', ''));
  };
  assert.deepEqual(draw(undefined, true, true), ['felglaive', 'felglaive', 'fot', 'fot', 'humanmale_warrior'], 'front: his back things, his boots again, him');
  assert.deepEqual(draw('side', true, true, -1), ['felglaive_side', 'felglaive_side', 'fot_side', 'fot_side', 'humanmale_warrior_side'], 'side: the same');
  /* from behind what hangs on his back is nearest and covers his boots ("det är så med skorna på alla vapen när man går upp") */
  assert.deepEqual(draw('back', true, true), ['humanmale_warrior_back', 'felglaive', 'felglaive'], 'from behind: him, then the glaives over his boots');
  assert.deepEqual(draw('back', true, false), ['humanmale_warrior_back', 'sword', 'warrior_shield', 'humanmale_warrior_back'], 'a single weapon too: no boots again (his head laid again over it)');
  assert.deepEqual(draw('back', false, true), ['felglaive', 'humanmale_warrior_back', 'felglaive'], 'in his hands: the glaive in front of him (hidden), the spare over his back and boots, no boots again');
  assert.deepEqual(draw('back', false, false), ['warrior_shield', 'humanmale_warrior_back', 'sword'], 'from behind with nothing on his back: nothing painted twice');
  assert.deepEqual(draw(undefined, false, false), ['humanmale_warrior', 'sword', 'warrior_shield'], 'nothing on his back: nothing painted twice');
  assert.deepEqual(draw(undefined, true, false), ['sword', 'warrior_shield', 'fot', 'fot', 'humanmale_warrior'], 'a holstered sword and shield too');
  /* a figure drawn without boots just before (riding) finds none to lay again */
  h.c.bootFeet.last = null; h.c.isFGLegend = () => true; h.draws.length = 0;
  h.c.drawChampionSprite(h.ctx, 'human', 'warrior', -1, 0, 0, false, 'felglaives', false, 1, false, null, null, undefined, true);
  assert.ok(!h.draws.some(d => /fot/.test(d.img.src)), 'no boots of its own, none laid');
  /* and in the game every bootFeet call is followed by the same figure's draw before any other boots */
  const calls = [...game.matchAll(/bootFeet\(\{/g)].map(m => m.index);
  assert.ok(calls.length >= 6, 'the call sites');
  for (const i of calls) {
    const next = game.slice(i + 8, i + 1500), d = next.indexOf('drawChampionSprite('), o = next.indexOf('bootFeet(');
    assert.ok(d >= 0 && (o < 0 || d < o), 'followed by its figure: ' + game.slice(i, i + 70));
  }
});

test('every weapon on the back from the reviewers\' round: one height from every side, bows the right way from behind, the head over it, nothing at the hand, hung from the back of the head', () => {
  /* 2026-10-12 "kolla igenom också alla andra vapen i hölstrat default och legendary" - four reviewers and a critic over 48 heroes */
  const h = harness();
  const BF = vm.runInContext('({BACK_FRONT,SIDE_GAP,SIDE_LOW,SIDE_FORESHORTEN})', h.c);   /* the real constants, already in the harness */
  vm.runInContext(game.match(/const WG_BACK=\{[^}]+\};/)[0], h.c);
  const draw = (cls, view, holster = true, race = 'human') => {
    h.draws.length = 0; h.clips.length = 0;
    h.c.drawChampionSprite(h.ctx, race, cls, -1, 0, 0, false, null, false, 1, false, null, null, undefined, holster, view);
    assert.equal(h.stack.length, 0, 'balanced');
    return h.draws.map(d => ({ ...d, name: d.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', '') }));
  };
  const axis = d => { const [x, y, w, ht] = d.rect, a = pointAt(d.matrix, x + w / 2, y), b = pointAt(d.matrix, x + w / 2, y + ht); return a.y < b.y ? { top: a, low: b } : { top: b, low: a }; };
  for (const cls of ['mage', 'priest', 'hunter']) {
    const f = draw(cls, undefined), b = draw(cls, 'back');
    const fw = f.find(d => !/humanmale/.test(d.name)), bw = b.find(d => !/humanmale/.test(d.name));
    const F = axis(fw), B = axis(bw);
    /* the back is the front's exact mirror: the same height, the other side of the picture (the same shoulder of his) */
    assert.ok(Math.abs(F.top.y - B.top.y) < 1e-9 && Math.abs(F.top.x + B.top.x) < 1e-9, `${cls}: one height front and back (${F.top.y.toFixed(1)} / ${B.top.y.toFixed(1)})`);
    assert.ok(F.top.y > -42, `${cls}: lowered from the old -42.5 to -45`);
    /* a mirror, not a turn: the picture's x axis flips, so a bow's string stays against him */
    const det = m => m.a * m.d - m.b * m.c;
    assert.ok(Math.sign(det(fw.matrix)) === -Math.sign(det(bw.matrix)), `${cls}: mirrored from behind`);
  }
  /* from behind the head is laid once more over a single weapon on his back: an ellipse clip, then the back picture */
  const b = draw('mage', 'back');
  const headClip = h.clips.find(c => c.rects.some(r => r[0] === 'ellipse'));
  assert.ok(headClip && headClip.at === b.length - 1 && b[b.length - 1].name === 'humanmale_mage_back', 'the back picture again, inside his head, after the staff');
  const [, ex, ey, rx, ry] = headClip.rects.find(r => r[0] === 'ellipse');
  assert.ok(Math.abs(ex) < 1e-9 && ey > -37 && ey < -29 && rx >= 15 && ry > 7, `the head: (${ex},${ey}) ${rx}x${ry} - wide enough for an orc's ears`);
  /* a crowned body's head is the 48-unit body's, not the crown's */
  draw('mage', 'back', true);
  h.clips.length = 0; h.draws.length = 0;
  h.c.drawChampionSprite(h.ctx, 'human', 'mage', -1, 0, 0, false, null, true, 1, 'royal', null, null, undefined, true, 'back');
  const royal = h.clips.find(c => c.rects.some(r => r[0] === 'ellipse')).rects.find(r => r[0] === 'ellipse');
  close(royal[2], ey, 'the Queen\'s head ellipse where every other head\'s is');
  draw('mage', 'back', false);
  assert.ok(!h.clips.some(c => c.rects.some(r => r[0] === 'ellipse')), 'nothing on his back: nothing laid again');
  /* from the front nothing shows at his left hand: the weapon is clipped out of the band between the shoulder line and the hem */
  draw('priest', undefined);
  const band = h.clips.find(c => c.rects.length === 2);
  assert.ok(band, 'the hand-side clip');
  const [above, left] = band.rects;
  assert.ok(above[1] + above[3] === -22 && left[0] + left[2] === 7 && left[1] === -22 && left[3] >= 400, 'out of x > 7 everywhere below the shoulder line (y -22) - no dot under the fist, no patch on a horse');
  /* from the side it hangs SIDE_GAP behind the back of his head (headX), the warrior's narrow hilt 2.5 */
  for (const [cls, gap] of [['mage', BF.SIDE_GAP], ['warrior', 2.5]]) {
    const s = draw(cls, 'side'), w = s.find(d => !/humanmale|shield/.test(d.name));
    const head = h.c.views[`humanmale_${cls}_side`], scale = 48 / head[5], headX = (head[7] - head[2]) * scale;
    const { top, low } = axis(w), t = (-33 - top.y) / (low.y - top.y), xAt = top.x + t * (low.x - top.x);
    close(Math.abs(xAt), headX + gap, `${cls}: at eye height ${gap} behind the back of his head`);
  }
  /* every side frame has its head edge, measured from the picture */
  for (const [k, v] of Object.entries(h.c.views)) if (k.endsWith('_side')) assert.ok(v.length === 10 && v[7] > v[2], `${k}: head edge (and its hair band's end, its weapon shift)`);
  /* the spare glaive keeps his right shoulder from behind too: mirrored there while it is alone (holstered, the approved crossing stays) */
  h.c.isFGLegend = () => true;
  h.draws.length = 0;
  h.c.drawChampionSprite(h.ctx, 'human', 'warrior', -1, 0, 0, false, 'felglaives', false, 1, false, null, null, undefined, false, 'back');
  const spare = h.draws[h.draws.length - 1], [, , , , dx, dy, dw, dh] = spare.rect;
  const e1 = pointAt(spare.matrix, dx, dy + dh / 2), e2 = pointAt(spare.matrix, dx + dw, dy + dh / 2), up = e1.y < e2.y ? e1 : e2;
  assert.ok(up.x > 0, `from behind the spare's upper blade is over his right shoulder - the viewer's right (${up.x.toFixed(1)})`);
});

test('what hangs on his back rocks with his body instead of sliding against it', () => {
  const champ = section('function drawChampionSprite(', '\n/* 🛡 The warrior');
  assert.ok(champ.includes('const onBack=band=>{g.save();g.rotate(sgn>0?-by*.025:by*.025);'), 'the same rock as paintBody, mirrored as he is');
  assert.ok(champ.includes('g.rotate(by*0.025);'), 'paintBody\'s rock');
});

test('from the side long hair no longer hides a weapon on the back: it lies over the hair and fades in under it where the hair band ends', () => {
  /* 2026-10-12 "frostseeker ... gör så det syns från alla vinklar" - over long hair the side view showed only a hilt above the head */
  const h = harness();
  const { HAIR_FADE, HAIR_FADE_STEPS } = vm.runInContext('({HAIR_FADE,HAIR_FADE_STEPS})', h.c);
  vm.runInContext("FK_ART.warrior={img:fkImg,h:1.38,std:{pw:38,pl:27,grip:H=>4-H}};FK_ART.hunter={img:fkImgBow,h:1.38,std:{pw:44,pl:31,grip:H=>-4-H/2},mirror:true};"
    + 'fkArtFor=c=>FK_ART[c]||FK_ART.warrior;', h.c);
  const side = (race, cls, female, fm = false, view = 'side', holster = true) => {
    h.draws.length = 0; h.clips.length = 0;
    h.c.drawChampionSprite(h.ctx, race, cls, -1, 0, 0, fm, null, female, 1, false, null, null, undefined, holster, view);
    assert.equal(h.stack.length, 0, 'balanced');
    return h.draws.map((d, i) => ({ ...d, i, name: d.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', '') }));
  };
  const hairOf = name => h.c.characterBodyFrame(Object.assign(new FakeImage(), { src: `assets/characters/${name}.png?v=1` }), name.includes('_royal_') ? 56 : 48).hair;
  /* every long-haired woman's side picture has a band, from the neck to no lower than her hands; a short-haired man's has none */
  for (const k of Object.keys(h.c.views)) if (k.startsWith('humanfemale_') && k.endsWith('_side') || k.startsWith('dwarffemale_') && k.endsWith('_side')) {
    const end = hairOf(k);
    assert.ok(end >= -22 && end <= -6, `${k}: the hair band ends between -22 and -6 (${end})`);
  }
  for (const k of ['humanmale_warrior_side', 'humanmale_mage_side', 'orcmale_warrior_side']) assert.equal(hairOf(k), null, `${k}: no long hair`);
  for (const [cls, fm, weapon] of [['mage', false, /^staff_side$/], ['priest', false, /^mace_side$/], ['hunter', false, /^bow_side$/], ['warrior', true, /^frostseeker_side$/], ['hunter', true, /^frostseeker_bow_side$/]]) {
    const d = side('human', cls, true, fm), body = d.find(x => x.name === `humanfemale_${cls}_side`), ws = d.filter(x => weapon.test(x.name));
    assert.equal(ws.length, 2 + HAIR_FADE_STEPS, `${cls}${fm ? ' Frostseeker' : ''}: behind her once, then over her hair in ${1 + HAIR_FADE_STEPS} pieces (${d.map(x => x.name)})`);
    assert.ok(ws[0].i < body.i && ws.slice(1).every(x => x.i > body.i), `${cls}: behind her, then over her`);
    /* the over-draws: the first down to the fade, then one strip per unit of it, the last ending where her hair band ends */
    const end = hairOf(`humanfemale_${cls}_side`), strips = h.clips.filter(c => c.at > body.i && c.rects.length === 1).map(c => c.rects[0]);
    assert.equal(strips.length, 1 + HAIR_FADE_STEPS, `${cls}: one clip per piece`);
    close(strips[0][1] + strips[0][3], end - HAIR_FADE, `${cls}: whole over her hair down to the fade - from its top end, no cut at the neck`);
    assert.ok(strips[0][1] <= -400, `${cls}: from its very top`);
    for (let k = 1; k <= HAIR_FADE_STEPS; k++) close(strips[k][1], end - HAIR_FADE + (k - 1) * HAIR_FADE / HAIR_FADE_STEPS, `${cls}: fade strip ${k}`);
    close(strips[HAIR_FADE_STEPS][1] + strips[HAIR_FADE_STEPS][3], end, `${cls}: faded out where her hair band ends`);
    /* each piece is the same weapon in the same place as the one behind her */
    for (const w of ws.slice(1)) assert.deepEqual([w.matrix, w.rect], [ws[0].matrix, ws[0].rect], `${cls}: the very same weapon`);
  }
  /* the Frostseeker mace's crystal is too wide to lie over the hair (it covered the back of the head, the ears, the collars): once, behind her */
  vm.runInContext("FK_ART.priest={img:fkImgMace,h:1.38,std:{pw:38,pl:27,grip:H=>4-H}};", h.c);
  const mace = side('human', 'priest', true, true).filter(x => /frostseeker_mace/.test(x.name));
  assert.ok(mace.length === 1 && /_side$/.test(mace[0].name), `the ice mace: its side picture, once (${mace.map(x => x.name)})`);
  /* the fel mace and the plain one lie over it (10 and 7 across) */
  assert.equal(side('human', 'priest', true).filter(x => /^mace_side$/.test(x.name)).length, 2 + HAIR_FADE_STEPS, 'the plain mace over her hair');
  /* where a big pauldron stands in the way below the shoulder, the weapon hangs further back on that picture - over the hair behind it */
  const dw = h.c.characterBodyFrame(Object.assign(new FakeImage(), { src: 'assets/characters/dwarffemale_warrior_side.png?v=1' }), 48);
  assert.ok(dw.sideShift > 1.3 && dw.sideShift < 1.7, `the dwarf woman warrior's sword 1.5 further back (${dw.sideShift})`);
  assert.equal(h.c.characterBodyFrame(Object.assign(new FakeImage(), { src: 'assets/characters/humanfemale_warrior_side.png?v=1' }), 48).sideShift, 0, 'elsewhere none');
  const sw = side('dwarf', 'warrior', true, true).find(x => /^frostseeker_side$/.test(x.name)), [x0, y0, ww, hh] = sw.rect;
  const e1 = pointAt(sw.matrix, x0 + ww / 2, y0), e2 = pointAt(sw.matrix, x0 + ww / 2, y0 + hh), k = (-33 - e1.y) / (e2.y - e1.y);
  close(Math.abs(e1.x + k * (e2.x - e1.x)), dw.headX + 1 + dw.sideShift, 'at eye height SIDE_GAP + its shift behind the back of her head');
  /* the copy over the hair has no glow and no rune halo of its own - the one behind lights the air; twice was twice as bright */
  const hp = section('function drawHolstered(', 'function drawChampionSprite(');
  assert.ok(hp.includes("if(glow){if(fm){g.shadowColor='#6fd0ff';") && hp.includes('(glow?runeOnSpare:runeTintOnly)('), 'the glow and the halo only with glow');
  assert.ok(hp.includes('if(band==null){g.save();paint(true,over?fx.hair-HAIR_FADE+by:null);g.restore();}') && hp.includes('paint(false,null);g.restore();'), 'behind him with it, over the hair without');
  /* a short-haired man: once, behind him */
  assert.equal(side('human', 'mage', false).filter(x => /staff/.test(x.name)).length, 1, 'no hair band, no second pass');
  assert.equal(side('human', 'warrior', false, true).filter(x => /frostseeker/.test(x.name)).length, 1, 'his Frostseeker: once');
  /* the warrior's plain sword under the lion shield keeps its place - the shield shows from the side */
  assert.equal(side('human', 'warrior', true).filter(x => /^sword/.test(x.name)).length, 1, 'the sword under the shield: once');
  /* from the front and behind, and with nothing on her back, nothing changes */
  for (const view of [null, 'back']) assert.equal(side('human', 'mage', true, false, view).filter(x => /staff/.test(x.name)).length, 1, `${view || 'front'}: once`);
  assert.equal(side('human', 'mage', true, false, 'side', false).filter(x => /staff/.test(x.name) && x.i > 0).length <= 1, true, 'in her hand: as ever');
  /* the approved glaives show past any hair: no second pass */
  vm.runInContext(game.match(/const WG_BACK=\{[^}]+\};/)[0], h.c);
  h.c.isFGLegend = () => true;
  const g = side('human', 'warrior', true), gl = g.filter(x => /felglaive/.test(x.name));
  h.c.isFGLegend = () => false;
  assert.ok(gl.length === 2 && gl.every(x => x.i < g.find(y => y.name === 'humanfemale_warrior_side').i), 'the two glaives behind her, once each');
});

test('on a mount he sits in profile, like the mount: one turned boot under his hem, laid again over what hangs on his back', () => {
  /* 2026-10-13: "när man rider mount ska de va sido vinklen på gubben ... och vapnet" */
  const h = harness(), boots = h.c.paintedCharacterFrame('human', 'warrior', false, false, 'side').boots;
  for (const fx of [-1, 1]) {
    h.draws.length = 0;
    h.c.bootFeet({ ...boots, ride: { fx, phase: 0, moving: 0 } }, h.ctx);
    const d = h.draws.map(x => x.img.src.split('/').pop().replace(/\?.*$/, ''));
    assert.deepEqual(d, ['fot_side.png'], `facing ${fx}: one boot, in profile (the far one is behind the mount)`);
    const m = h.draws[0].matrix;
    assert.ok(Math.sign(m.a) === -fx, `facing ${fx}: the toe ahead (the profile boot looks left natively)`);
  }
  /* the riding boot is taken like any other: drawChampionSprite lays it again over the weapon on his back */
  h.c.bootFeet({ ...boots, ride: { fx: -1, phase: 0, moving: 0 } }, h.ctx);
  h.draws.length = 0;
  h.c.drawChampionSprite(h.ctx, 'human', 'warrior', -1, 0, 0, false, null, false, 1, false, null, null, undefined, true, 'side');
  const names = h.draws.map(x => x.img.src.split('/').pop().replace(/\?.*$/, '').replace('.png', ''));
  assert.ok(names.indexOf('fot_side') > names.indexOf('sword_side') && names.indexOf('fot_side') < names.indexOf('humanmale_warrior_side'), `the boot over the sword, under him (${names})`);
  /* drawHero: the rider drawn in the view he is shown in, his near boot through bootFeet; no far boot from the side */
  assert.ok(game.includes('if(sideways)bootFeet({...character.boots,ride},g);else MountRenderer.drawRiderBoots(g,bootImg,ride,\'near\');'), 'the near boot');
  assert.ok(game.includes('bootImg:sideways?null:bootImg'), 'no far boot from the side');
});

test('a runed weapon on his back keeps its marks and sheds its embers from every side - behind him or over him as the weapon is', () => {
  /* 2026-10-13: "gör så effekterna på enchants också är aktiva när alla vapen är hölstrade" */
  const h = harness();
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/weapons/rune-profiles.js'), 'utf8') + ';this.PROFILES=WEAPON_RUNE_PROFILES;', h.c);
  const fx = fs.readFileSync(path.join(root, 'assets/weapons/rune-effects.js'), 'utf8');
  const cut = (a, b) => { const i = fx.indexOf(a); return fx.slice(i, fx.indexOf(b, i + a.length)); };
  vm.runInContext(cut('function runePointTransform(', 'function runeProfileFor(') + cut('function runeEmitter(', 'function runeSpark('), h.c);   /* the real emitter maths */
  vm.runInContext(game.match(/const WG_BACK=\{[^}]+\};/)[0], h.c);
  vm.runInContext("FK_ART.warrior={img:fkImg,h:1.38,std:{pw:38,pl:27,grip:H=>4-H}};FK_ART.mage={img:fkImgStaff,h:1.59,std:{pw:42,pl:30,grip:H=>5-H}};fkArtFor=c=>FK_ART[c]||FK_ART.warrior;", h.c);
  const nameOf = im => (im && im.src || '').split('/').pop().replace(/\?.*$/, '').replace('.png', '');
  const marks = [], parts = [];
  /* the rune's sprite as the game hands it back: its picture's profile (null for a picture without one) */
  const sprite = (g, rune, im, x, y, W, H, grip, sx, sw, draw) => { draw(); if (!rune) return null; const name = nameOf(im); return { key: name, profile: h.c.PROFILES[name] || null }; };
  Object.assign(h.c, { runeOnSpare: sprite, runeTintOnly: sprite,
    runeMarks: (g, rune, sp) => { if (rune && sp && sp.profile) marks.push({ name: sp.key, at: h.draws.length }); },
    drawRuneParticle: (g, p) => { parts.push({ layer: p.layer, at: h.draws.length, m: g.getTransform() }); return true; } });
  const ember = { id: 'emberbite', glow: '#ff7a3a' };
  const draw = ({ race = 'human', cls, female = false, fm = false, weapon = null, view, holster = true, rune = ember, pool = [], channel = true }) => {
    h.draws.length = 0; h.clips.length = 0; marks.length = 0; parts.length = 0;
    h.c.isFGLegend = () => weapon === 'felglaives';
    const back = { parts: pool, world: { a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 }, emission: null };
    if (channel) h.c.drawChampionSprite.backFx = back;
    h.c.drawChampionSprite(h.ctx, race, cls, -1, 0, 0, fm, weapon, female, 1, false, rune, null, 0, holster, view);
    assert.equal(h.stack.length, 0, 'balanced');
    assert.equal(h.c.drawChampionSprite.backFx, null, 'the pool is taken and cleared - never another figure\'s');
    h.c.isFGLegend = () => false;
    return { back, names: h.draws.map(d => nameOf(d.img)), pts: back.emission ? back.emission.points : [] };
  };
  const layers = pts => [...new Set(pts.map(p => p.layer))].sort().join(',');

  /* from the front: its marks on it, its embers shed behind him - none from where the front cuts it away below his shoulder line */
  for (const [cls, fm, pic] of [['mage', false, 'staff'], ['mage', true, 'frostseeker_staff'], ['priest', false, 'mace'], ['hunter', false, 'bow'], ['warrior', true, 'frostseeker']]) {
    const d = draw({ cls, fm });
    assert.deepEqual(marks.map(m => m.name), [pic], `${cls}${fm ? ' Frostseeker' : ''} from the front: its marks`);
    assert.ok(d.pts.length >= 1 && layers(d.pts) === 'behind', `${cls}${fm ? ' Frostseeker' : ''} from the front: shed behind him (${layers(d.pts)})`);
    for (const p of d.pts) assert.ok(!(p.y >= -22 && p.x >= 7), `${cls}: nothing from the cut-away part (${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    assert.ok(d.back.emission.size > 0 && /^back:/.test(d.back.emission.key), 'a key and a size of its own');
  }
  /* from behind: over him */
  for (const [cls, fm] of [['mage', false], ['hunter', true], ['priest', false]]) {
    const d = draw({ cls, fm, view: 'back' });
    assert.ok(marks.length === 1 && d.pts.length >= 1 && layers(d.pts) === 'over', `${cls} from behind: marked and shed over him`);
  }
  /* the warrior's sword from behind hangs under the lion shield: nothing sheds from under the shield */
  {
    const d = draw({ cls: 'warrior', view: 'back' }), shieldW = 24 * h.c.warriorShieldImg.naturalWidth / h.c.warriorShieldImg.naturalHeight;
    for (const p of d.pts) assert.ok(!(Math.abs(p.y + 12) <= 12 && Math.abs(p.x) <= shieldW / 2), `not from under the shield (${p.x.toFixed(1)},${p.y.toFixed(1)})`);
  }
  /* from the side its side picture carries the marks; a short-haired man's weapon sheds behind him */
  {
    const d = draw({ cls: 'mage', view: 'side' });
    assert.deepEqual(marks.map(m => m.name), ['staff_side'], 'the side picture\'s own marks');
    assert.ok(d.pts.length >= 1 && layers(d.pts) === 'behind', 'shed behind him');
  }
  /* over long hair it is laid again: its marks with that copy (and the copy behind marks only below where it fades in), and what
     sheds from over her hair is over her */
  {
    const d = draw({ cls: 'mage', female: true, view: 'side' });
    const { HAIR_FADE_STEPS } = vm.runInContext('({HAIR_FADE_STEPS})', h.c);
    assert.equal(marks.filter(m => m.name === 'staff_side').length, 2 + HAIR_FADE_STEPS, 'behind her once, then with every piece over her hair');
    assert.ok(h.clips.some(c => c.rects.length === 1 && c.rects[0][3] === 800 && c.at === marks[0].at), 'the copy behind marks only below the fade');
    assert.ok(d.pts.some(p => p.layer === 'over'), `some of it sheds over her hair (${layers(d.pts)})`);
    const end = h.c.characterBodyFrame(Object.assign(new FakeImage(), { src: 'assets/characters/humanfemale_mage_side.png?v=1' }), 48).hair;
    for (const p of d.pts) assert.equal(p.layer, p.y < end - 2.5 ? 'over' : 'behind', `over her hair above the fade's middle (${p.y.toFixed(1)})`);
  }
  /* the Frostseeker mace is not laid over long hair: marked once, shed behind her */
  {
    vm.runInContext("FK_ART.priest={img:fkImgMace,h:1.38,std:{pw:38,pl:27,grip:H=>4-H}};", h.c);
    const d = draw({ cls: 'priest', fm: true, female: true, view: 'side' });
    assert.deepEqual(marks.map(m => m.name), ['frostseeker_mace_side']);
    assert.equal(layers(d.pts), 'behind');
  }
  /* the warrior's Fel Glaives: both on his back from the front and behind, the spare's two halves from the side */
  for (const [view, n, pic, layer] of [[undefined, 2, 'felglaive', 'behind'], ['back', 2, 'felglaive', 'over'], ['side', 2, 'felglaive_side', 'behind']]) {
    const d = draw({ cls: 'warrior', weapon: 'felglaives', view });
    assert.deepEqual(marks.map(m => m.name), Array(n).fill(pic), `glaives ${view || 'front'}: marked`);
    assert.ok(d.pts.length >= 2 && layers(d.pts) === layer, `glaives ${view || 'front'}: shed ${layer} him`);
  }
  /* in his hands the spare on his back still sheds */
  {
    const d = draw({ cls: 'warrior', weapon: 'felglaives', holster: false });
    assert.ok(marks.some(m => m.name === 'felglaive') && d.pts.length >= 1, 'the spare: marked and shed');
  }
  /* no rune, nothing; no pool (a peer, a portrait), the marks but nothing to shed into */
  assert.ok(draw({ cls: 'mage', rune: null }).back.emission === null && marks.length === 0, 'no rune: no marks, no embers');
  draw({ cls: 'mage', channel: false });
  assert.equal(marks.length, 1, 'a figure without a pool keeps the marks');

  /* what has been shed is painted in his layers, in the world's frame: behind him before his body, over him after it */
  const pool = [{ layer: 'behind' }, { layer: 'over' }, {}];
  for (const view of [undefined, 'side', 'back']) {
    const d = draw({ cls: 'mage', female: true, view, pool });
    const body = d.names.findIndex(n => /^humanfemale_mage/.test(n));
    const behind = parts.filter(p => p.layer !== 'over'), over = parts.filter(p => p.layer === 'over');
    assert.equal(parts.length, 3, `${view || 'front'}: each once`);
    assert.ok(behind.every(p => p.at <= body), `${view || 'front'}: behind him before his body`);
    assert.ok(over.every(p => p.at > body), `${view || 'front'}: over him after it`);
    assert.ok(parts.every(p => p.m.a === 2 && p.m.e === 100 && p.m.f === 50), 'in the world\'s frame');
  }
  /* drawHero: the hero's own pool, stepped and fed from what the draw hands back - in the saddle too */
  const hero = section('function drawHero(){', '\nfunction ');
  assert.ok(hero.includes('const backFx={parts:runeBackEmission.parts,world:runeWorld,emission:null};'), 'the pool');
  assert.equal((hero.match(/drawChampionSprite\.backFx=backFx;/g) || []).length, 2, 'on foot and in the saddle');
  assert.ok(hero.includes('runeSpark(wRune,{...backFx.emission,'), 'fed from what it hands back');
  assert.match(section('function buildZone(){', 'const tmpls=zoneTemplates(z);'), /resetRuneBack\(\);/, 'a new zone empties it');
});
