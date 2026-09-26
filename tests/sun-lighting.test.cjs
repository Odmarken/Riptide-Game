/* Run with: node --test tests/sun-lighting.test.cjs
 * ☀ The sun over the City (2026-09-26): shadows cast to the right, one layer for all of them, and a Lighting switch in
 * Settings -> Video that the game listens to.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const DisplaySettings = require('../assets/ui/display-settings.js');
function section(start, end) {
  const a = game.indexOf(start), b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Cannot locate game source section: ${start}`);
  return game.slice(a, b);
}

test('Settings -> Video -> Lighting is on by default, remembered on the device, and tells the game', () => {
  assert.equal(DisplaySettings.normalize(null).lighting, true);
  assert.equal(DisplaySettings.normalize({ lighting: false }).lighting, false);
  assert.equal(DisplaySettings.normalize({ lighting: 'no' }).lighting, true, 'only a real boolean is taken');
  assert.ok(html.includes('<input type="checkbox" id="lightingChk" checked><span>Lighting</span>'), 'the box sits in the Video pane');
  const els = {}, el = id => els[id] || (els[id] = { id, style: { setProperty() {} }, checked: false, value: '', handlers: {},
    addEventListener(type, f) { this.handlers[type] = f; }, setAttribute() {} });
  const doc = { getElementById: el }, kept = {}, storage = { getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v; } };
  const told = [];
  const settings = DisplaySettings.create({ doc, storage, onChange: v => told.push(v.lighting) });
  assert.equal(els.lightingChk.checked, true);
  assert.equal(told.at(-1), true, 'the game hears the setting as soon as it is read');
  els.lightingChk.checked = false;
  els.lightingChk.handlers.change({ target: els.lightingChk });
  assert.equal(told.at(-1), false);
  assert.equal(JSON.parse(kept[DisplaySettings.STORAGE_KEY]).lighting, false, 'saved on the device');
  settings.reset();
  assert.equal(settings.value.lighting, false, 'the reset button is for brightness and contrast only');
  const again = DisplaySettings.create({ doc, storage, onChange: v => told.push(v.lighting) });
  assert.equal(again.value.lighting, false, 'remembered next time');
  assert.equal(told.at(-1), false);
  assert.ok(game.includes('const displaySettings=DisplaySettings.create({onChange:v=>{SUN.on=v.lighting;}});'), 'the switch drives the sun');
});

test('the sun shines on the City only, and every cast shadow goes down at once under all that stands', () => {
  assert.ok(game.includes('sunFrame=SUN.on&&!!z.city;'));
  const a = game.indexOf('if(sunFrame)sunBegin();'), b = game.indexOf('drawPropShadow(s,z);', a), c = game.indexOf('if(sunFrame)sunEnd();', b);
  assert.ok(a > 0 && b > a && c > b, 'the layer is cleared before the ground pass and laid down after it');
  assert.ok(c - a < 1600, 'around the one ground pass of draw()');
  const pass = game.slice(a, c);
  assert.ok(pass.includes('if(s.x<left-(sunFrame?SUN.k*SUN.tallest:0)||'), 'a house off the left edge is still visited while the sun is out');
  assert.ok(pass.indexOf('if(s.x<left)continue;') > pass.indexOf('drawPropShadow(s,z);'), '...for its shadow only, so the shadow does not pop at the edge');
  const light = game.indexOf('if(sunFrame)drawSunLight(now);'), vignette = game.indexOf('if(vigCv)ctx.drawImage(vigCv,0,0,VW,VH);', light);
  assert.ok(light > 0 && vignette > light && vignette - light < 120, 'the light goes on just under the vignette');
});

test('a silhouette is cast to the right and a little toward the viewer, its foot staying where the prop stands', () => {
  const ctx = vm.createContext({ Math, WeakMap,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, fillRect() {}, createLinearGradient: () => ({ addColorStop() {} }) }) }) },
    ctx: { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) } });
  vm.runInContext(section('const SUN=', '/* the flares:'), ctx);
  vm.runInContext(`globalThis.drawn=null;sunFrame=true;sunLayer={};sunG=(()=>{let m=[1,0,0,1,0,0];
    const mul=n=>{const [a,b,c,d,e,f]=m,[A,B,C,D,E,F]=n;m=[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f];};
    return {setTransform(a,b,c,d,e,f){m=[a,b,c,d,e,f];},translate(x,y){mul([1,0,0,1,x,y]);},transform(a,b,c,d,e,f){mul([a,b,c,d,e,f]);},
     scale(x,y){mul([x,0,0,y,0,0]);},drawImage(im,x,y,w,h){globalThis.drawn={im,x,y,w,h,m:[...m]};}};})();`, ctx);
  const cast = (flip) => {
    vm.runInContext(`sunShadow({complete:true,naturalWidth:200,naturalHeight:600},-50,-300,100,300,0,${flip})`, ctx);
    const { im, x, y, w, h, m } = ctx.drawn, r = vm.runInContext('SUN.res', ctx);
    const at = (px, py) => [(m[0] * px + m[2] * py + m[4]) / r, (m[1] * px + m[3] * py + m[5]) / r];
    const mx = im.pad * w / (im.cw + 2 * im.pad), my = im.pad * h / (im.ch + 2 * im.pad);   /* the blur's margin round the picture */
    const L = x + mx, R = x + w - mx, T = y + my, B = y + h - my;
    assert.ok(Math.abs(R - L - 100) < 1e-9 && Math.abs(B - T - 300) < 1e-9, 'the picture inside the margin is the prop at its own size');
    return { foot: at((L + R) / 2, B), top: at((L + R) / 2, T), left: at(L, B), right: at(R, B) };
  };
  for (const flip of [false, true]) {
    const s = cast(flip);
    assert.ok(Math.abs(s.foot[0]) < 1e-9 && Math.abs(s.foot[1]) < 1e-9, 'the foot of the shadow is the foot of the prop');
    assert.ok(s.top[0] > 150, 'the top of the picture falls far to the right');
    assert.ok(s.top[1] > 0 && s.top[1] < s.top[0] / 2, 'and a little toward the viewer');
    assert.ok(Math.abs(s.left[0] + s.right[0]) < 1e-9, 'the base keeps its width');
    assert.equal(s.left[0] < s.right[0], !flip, 'a mirrored prop casts a mirrored silhouette');
  }
  assert.equal(vm.runInContext('sunLayer.used', ctx), true);
  vm.runInContext('sunFrame=false;drawn=null;sunShadow({complete:true,naturalWidth:200,naturalHeight:600},-50,-300,100,300,0)', ctx);
  assert.equal(ctx.drawn, null, 'no sun, no cast shadow');
});
