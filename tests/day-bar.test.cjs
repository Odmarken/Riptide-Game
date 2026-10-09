/* ☀ The day-and-night bar over the minimap (2026-10-09, after Skyrim's compass, in the game's bronze): where the sun and the moon
   stand on it, which way the sky runs, what its tip says, when it draws, and that the page, the stylesheet and the frame wire it in. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const source = read('assets/ui/day-bar.js'), game = read('game.js');

function section(start, end) {
  const a = game.indexOf(start), b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
  return game.slice(a, b);
}
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`);
/* the game's own darkness curve, from the sun's section */
const sun = vm.createContext({});
vm.runInContext(section('const SUN=', '/* the flares:'), sun);

function harness(opts) {
  const calls = [], attributes = new Map(), listeners = new Map();
  const context2d = canvas => new Proxy({ canvas }, { get(o, k) {
    if (k in o) return o[k];
    return (...args) => {
      assert.ok(args.every(n => typeof n !== 'number' || Number.isFinite(n)), `${String(k)} received non-finite geometry`);
      calls.push({ k, args });
      return { addColorStop() {} };
    };
  } });
  const canvasOf = () => { const c = { width: 300, height: 150 }; c.getContext = () => context2d(c); return c; };
  const canvas = canvasOf(), tip = { textContent: '' };
  const el = { hidden: true, clientWidth: 156, querySelector: s => s === 'canvas' ? canvas : s === '.daybar-tip' ? tip : null,
    setAttribute(n, v) { attributes.set(n, v); }, getAttribute(n) { return attributes.get(n); },
    addEventListener(n, fn) { listeners.set(n, fn); } };
  const context = vm.createContext({ devicePixelRatio: 2, document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvasOf(); } } });
  vm.runInContext(source, context, { filename: 'day-bar.js' });
  return { api: context.DayBar, bar: context.DayBar.create(el, opts), el, tip, canvas, calls, listeners };
}
const real = { day: 2700, night: 900, dark: t => sun.sunDarkAt(t) };

test('the sun stands at the needle at noon and the moon at midnight; what is coming lies on the left', () => {
  const { api } = harness(real), cyc = 3600, CX = api.CX;
  close(api.place(1350, 1350, cyc), CX, 'noon'); close(api.place(3150, 3150, cyc), CX, 'midnight');
  assert.ok(api.place(1350, 1350 - 600, cyc) < CX, 'ten minutes before noon the sun is still on the left');
  assert.ok(api.place(1350, 1350 + 600, cyc) > CX, 'ten minutes after, on the right: it crosses left to right, as on the screen');
  close(api.place(2700, 1350, cyc), 16, 'at noon dusk is at the left end'); close(api.place(0, 1350, cyc), 140, 'and dawn at the right');
  assert.ok(api.place(3150, 60, cyc) > CX, 'just after dawn, midnight is behind - across the turn of the day');
  assert.equal(api.SPAN, 2700, 'a 45-minute window: the whole night fits, noon shows only day');
});

test('the tip counts the minutes to dusk by day and to dawn by night', () => {
  const { api } = harness(real);
  assert.equal(api.tipText(60, 2700, 900), 'Day · dusk in 44 min');
  assert.equal(api.tipText(2699.5, 2700, 900), 'Day · dusk in 1 min');
  assert.equal(api.tipText(2820, 2700, 900), 'Night · dawn in 13 min');
  assert.equal(api.tipText(3599.9, 2700, 900), 'Night · dawn in 1 min');
});

test('the sky goes from a bronze day through a red twilight to a blue night, darker all the way', () => {
  const { api } = harness(real), day = api.skyRGB(0), twilight = api.skyRGB(.4), night = api.skyRGB(1);
  assert.ok(day[0] > day[2] && night[2] > night[0], 'warm by day, blue by night');
  assert.ok(twilight[0] > twilight[1] && twilight[0] > twilight[2], 'red between');
  let last = Infinity;
  for (let d = 0; d <= 1.0001; d += .05) { const c = api.skyRGB(d), sum = c[0] + c[1] + c[2]; assert.ok(sum <= last, `darker at ${d}`); last = sum; }
});

test('the stars come out only where the game is dark; the sun and the moon sit on the needle at noon and midnight', () => {
  const stars = calls => calls.filter(c => c.k === 'arc' && c.args[2] === .65).length;
  const noon = harness(real); noon.bar.update(true, 1350, 100);
  assert.equal(stars(noon.calls), 0, 'no night in sight at noon');
  assert.ok(noon.calls.some(c => c.k === 'arc' && c.args[0] === 78 && c.args[2] === 3.5), 'the sun\'s disc at the needle');
  const midnight = harness(real); midnight.bar.update(true, 3150, 100);
  assert.equal(stars(midnight.calls), 8, 'the whole night and its stars in the window at midnight');
  assert.ok(midnight.calls.some(c => c.k === 'arc' && c.args[0] === 78 && c.args[2] === 4.4), 'the moon at the needle');
});

test('shown only when asked and the sun\'s time is known; it draws when the sky has moved, not every frame', () => {
  const h = harness(real);
  h.bar.update(true, NaN, 0); assert.equal(h.el.hidden, true, 'no time yet, no bar');
  h.bar.update(true, 1350, 100); assert.equal(h.el.hidden, false);
  assert.equal(h.canvas.width, 312, 'device pixels: 156 wide at a pixel ratio of 2'); assert.equal(h.canvas.height, 52);
  assert.equal(h.tip.textContent, 'Day · dusk in 23 min'); assert.equal(h.el.getAttribute('aria-label'), 'Day and night: Day · dusk in 23 min');
  const drawn = h.calls.length; assert.ok(drawn > 100, 'a whole bar painted');
  h.bar.update(true, 1351, 200); assert.equal(h.calls.length, drawn, 'a second of sky is under a tenth of a unit: nothing to draw');
  h.bar.update(true, 1353, 300); assert.ok(h.calls.length > drawn, 'three seconds move it');
  const again = h.calls.length; h.bar.update(true, 1400, 310); assert.equal(h.calls.length, again, 'never twice within 33 ms');
  h.bar.update(false, 1400, 400); assert.equal(h.el.hidden, true);
});

test('a click or a wheel on the bar does not reach the game under it', () => {
  const h = harness(real); let stopped = 0, prevented = 0;
  for (const name of ['pointerdown', 'click', 'dblclick', 'contextmenu', 'wheel'])
    h.listeners.get(name)({ stopPropagation() { stopped++; }, preventDefault() { prevented++; } });
  assert.equal(stopped, 5); assert.equal(prevented, 4, 'pointerdown keeps its default: focus and the like');
});

test('the page puts the bar over the minimap, as wide as it, and the frame feeds it the sun', () => {
  const html = read('index.html'), css = read('style.css');
  const bar = html.indexOf('<div id="dayBar"'), map = html.indexOf('<div id="cityMinimap"');
  assert.ok(bar > 0 && bar < map, 'the bar comes first, so the minimap can step down under it (a ~ rule)');
  assert.ok(html.includes('class="daybar-tip"'));
  const script = html.indexOf('assets/ui/day-bar.js?v='), main = html.indexOf('game.js?v=');
  assert.ok(script > 0 && script < main, 'loaded before game.js');
  const sizes = sel => [...css.matchAll(new RegExp(sel + '\\{[^}]*?width:([\\d.]+)px;height:([\\d.]+)px', 'g'))].map(m => [+m[1], +m[2]]);
  const bars = sizes('#dayBar'), maps = sizes('#cityMinimap');
  assert.deepEqual(bars.map(s => s[0]), maps.map(s => s[0]), 'as wide as the minimap at every size ("lika stor som gpsen i bredd")');
  assert.equal(bars.length, 3);
  for (const [w, h] of bars) assert.ok(Math.abs(w / h - 6) < .01, `drawn 6:1 at ${w}`);
  assert.ok(css.includes('#dayBar:not([hidden])~#cityMinimap{top:40px}'), 'the minimap steps down under it: 8 + 26 + 6');
  assert.ok(game.includes("const dayBar=DayBar.create($('dayBar'),{day:SUN.day,night:SUN.night,dark:sunDarkAt});"));
  assert.ok(game.includes("dayBar.update(!!(gameOn&&S&&!(voyage&&voyage.phase!=='arrive')&&sunZone(z)),SUN.t,t);"));
  assert.ok(game.includes('SUN.p=p;SUN.t=t;') && game.includes('SUN.dark=sunDarkAt(t);'), 'the sun gives the bar its seconds and its curve');
});
