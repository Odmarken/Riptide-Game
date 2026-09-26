/* Run with: node --test tests/sun-lighting.test.cjs
 * ☀ The sun over the City and Moonshine (2026-09-26): it crosses from the left to the right in a two-minute day, a darker
 * minute follows, and the shadows and the light go where the sun is. One layer for all the cast shadows, the lights of the
 * night (street lamps, doorways, portals), and a Lighting switch in Settings -> Video that the game listens to.
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
/* the sun's clock and its shadow-casting, in a sandbox of their own */
function sunBox(extra = {}) {
  const box = vm.createContext({ Math, WeakMap, Date,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, fillRect() {}, createLinearGradient: () => ({ addColorStop() {} }) }) }) },
    ctx: { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }, ...extra });
  vm.runInContext(section('const SUN=', '/* the flares:'), box);
  return box;
}
/* the tests below speak in the seconds of the first, two-minute day (0-120 the day, 120-180 the dark); old() puts a moment of
   it on the hour the day runs now (45 minutes and 15), so "60" is still noon and "150" the middle of the night */
const old = t => t < 120 ? t * 2700 / 120 : 2700 + (t - 120) * 900 / 60;
const at = (box, t) => { vm.runInContext(`SUN.pin=${old(t)};sunUpdate();`, box); return vm.runInContext('({...SUN})', box); };

test('Settings -> Video -> Lighting and Sun flare are on by default, remembered on the device, and tell the game', () => {
  assert.equal(DisplaySettings.normalize(null).sunFlare, true);
  assert.equal(DisplaySettings.normalize({ sunFlare: false }).sunFlare, false);
  assert.equal(DisplaySettings.normalize({ sunFlare: 1 }).sunFlare, true, 'only a real boolean is taken');
  assert.ok(html.includes('<input type="checkbox" id="lightingChk" checked><span>Lighting</span></label>\n            <label class="cfgrow cfgchk"><input type="checkbox" id="sunFlareChk" checked><span>Sun flare</span></label>'), 'Sun flare sits under Lighting');
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
  const flares = [];
  const third = DisplaySettings.create({ doc, storage, onChange: v => flares.push(v.sunFlare) });
  assert.equal(els.sunFlareChk.checked, true);
  els.sunFlareChk.checked = false;
  els.sunFlareChk.handlers.change({ target: els.sunFlareChk });
  assert.equal(flares.at(-1), false);
  assert.equal(JSON.parse(kept[DisplaySettings.STORAGE_KEY]).sunFlare, false, 'saved on the device');
  third.reset();
  assert.equal(third.value.sunFlare, false, 'the reset button leaves it alone');
  assert.ok(game.includes('const displaySettings=DisplaySettings.create({onChange:v=>{SUN.light=v.lighting;SUN.flare=v.sunFlare;WEATHER.on=v.weather;}});'), 'the switches drive the sun and the sky');
});

test('the sun shines out of doors all over the world, and every cast shadow goes down at once under all that stands', () => {
  assert.ok(game.includes('sunFrame=sunZone(z);'));
  const a0 = game.indexOf('const ZONES=['), i0 = game.indexOf('[', a0);
  let depth = 0, j0 = i0;
  for (; j0 < game.length; j0++) { const ch = game[j0]; if (ch === '[') depth++; else if (ch === ']' && !--depth) break; }
  const zones = vm.runInNewContext('(' + game.slice(i0, j0 + 1) + ')'), sunZone = vm.runInNewContext('(' + section('function sunZone(z){', '\n}\n') + '\n})');
  assert.deepEqual([...zones.filter(z => !sunZone(z)).map(z => z.name)], ['Hollowroot Den', 'Grimwater Cavern', 'The Sunken Crypt', 'Pyre of the Old Gate', 'Emberdeep Keep',
    'Gates of the Viking', 'Halls of Valhalla', 'Violet Halls', 'The Crypts', 'The Altar', 'The Final Hour', 'Briarhollow', 'Cindervein', 'Frostveil', 'Tides Guild',
    'Throne Hall', 'Palace of Silverfjord'], 'the Altar, the bosses\' arenas, the raid, the crypts, the dungeons and indoors keep their own light');
  for (const name of ['Willowmere Fields', 'Emberdeep Approach', 'Cow Level', 'Moonshine', 'Farm', 'City', 'Wasteland', 'Sunscar Sands', 'The Harbour', 'Silverfjord', 'Port Meridian'])
    assert.ok(sunZone(zones.find(z => z.name === name)), name + ' has the sun');
  const u = game.indexOf('if(sunFrame){sunUpdate();weatherUpdate(z,S.zone);weatherDim();sunWorld=ctx.getTransform();}'), k = game.indexOf('sunCast=sunFrame&&SUN.light&&SUN.cast>0;', u);
  assert.ok(u > 0 && k > u && k - u < 260, 'the day runs whatever the switches say; the shadows are Lighting\'s, and there are none after dark');
  const a = game.indexOf('if(sunCast)sunBegin();'), b = game.indexOf('drawPropShadow(s,z);', a), c = game.indexOf('if(sunCast)sunEnd();', b);
  assert.ok(a > u && b > a && c > b, 'the layer is cleared before the ground pass and laid down after it');
  assert.ok(c - a < 1600, 'around the one ground pass of draw()');
  const pass = game.slice(a, c);
  assert.ok(pass.includes('if(s.x<left-sunL||s.x>right+sunR||'), 'a house off the edge on the sun\'s side is still visited');
  assert.ok(pass.indexOf('if(s.x<left||s.x>right)continue;') > pass.indexOf('drawPropShadow(s,z);'), '...for its shadow only, so the shadow does not pop at the edge');
  const reach = game.slice(game.lastIndexOf('\n', game.lastIndexOf('\n', a) - 1), a);   /* the line before */
  assert.ok(reach.includes('sunL=sunCast?Math.max(0,SUN.k*SUN.tallest):0') && reach.includes('sunR=sunCast?Math.max(0,-SUN.k*SUN.tallest):0'),
    'in the morning shadows reach in from the left, in the evening from the right');
  const fog = game.indexOf('drawEdgeFog(); /* last thing in world space'), light = game.indexOf('if(sunFrame)drawSunLight(now);'), clock = game.indexOf('if(cowRunning||(zoneOf().cow&&hero.dead)){');
  assert.ok(fog > 0 && light > fog && light - fog < 200 && clock > light, 'the light goes down on the world as soon as it is drawn, under what the canvas writes on it - the Cow Level\'s clock');
  for (const call of ['if(sunCast){const gi=cityGroundImages()', 'if(sunCast){const f=CityWorks.artFrame', "if(sunCast){const im=cityImg('gallows')"])
    assert.ok(game.includes(call), 'nothing is worked out for a shadow at night: ' + call);
});

test('a day is 45 minutes of the sun going from the left to the right, then 15 darker minutes, then it rises on the left again', () => {
  const box = sunBox();
  assert.equal(vm.runInContext('SUN.day+SUN.night', box), 3600, 'an hour, the bank\'s hour');
  assert.equal(vm.runInContext('SUN.day', box), 2700);
  let last = null, jump = 0;
  for (let t = 0; t < 180; t += .05) {
    const S = at(box, t);
    if (last) jump = Math.max(jump, Math.abs(S.dark - last.dark), Math.abs(S.cast - last.cast), Math.abs(S.lit - last.lit));
    if (t < 120 && last && last.p < 1) assert.ok(S.k <= last.k + 1e-12, 'the shadows swing steadily from the right to the left');
    last = S;
  }
  const wrap = at(box, 0);
  jump = Math.max(jump, Math.abs(wrap.dark - last.dark), Math.abs(wrap.cast - last.cast), Math.abs(wrap.lit - last.lit));
  assert.ok(jump < .02, 'no step anywhere in the light, not even where the night turns into the next day');
  const dawn = at(box, 3), morning = at(box, 20), noon = at(box, 60), evening = at(box, 100), dusk = at(box, 117);
  assert.ok(dawn.p < .05 && dawn.k > 1, 'sunrise is at the left edge, the shadows long to the right');
  assert.ok(dawn.lit > 0 && dawn.lit < 1 && dawn.cast < dawn.lit, 'the sun comes up; its shadows follow it in');
  assert.ok(morning.k > .5 && morning.k < 1 && morning.cast === 1 && morning.dark === 0);
  assert.ok(Math.abs(noon.k) < 1e-9 && noon.p === .5, 'at noon the sun stands over the top of the view and the shadows fall toward you');
  assert.ok(Math.abs(evening.k + morning.k) < 1e-9, 'the evening mirrors the morning');
  assert.ok(dusk.k < -1 && dusk.cast < 1 && dusk.dark > 0, 'the sun sinks at the right edge, its shadows long to the left, the dusk coming on');
  for (const t of [125, 150, 175]) {
    const S = at(box, t);
    assert.equal(S.cast, 0, 'no shadows at night');
    assert.equal(S.lit, 0, 'and no sun');
    assert.ok(S.dark > .6, 'darker');
  }
  assert.equal(at(box, 150).dark, 1);
  let dark = 0;
  for (let t = 0; t < 180; t += .05) if (at(box, t).dark >= .4) dark += .05;
  assert.ok(Math.abs(dark - 60) < 1, 'a quarter of it is dark');
  vm.runInContext('SUN.pin=null;sunUpdate(3600000*9e3+1350000);', box);
  assert.equal(vm.runInContext('SUN.p', box), .5, 'it runs on the wall clock, so it goes on while you are elsewhere');
  /* on the bank's hour: the Bank of Moonshine pays every full hour from S.bankLastT, and the sun comes up on that beat */
  assert.ok(game.includes('const BANK_HOUR=3600000,'), 'the bank\'s hour is an hour');
  vm.runInContext('globalThis.S={bankLastT:1234567};SUN.pin=null;sunUpdate(1234567+3600000*7);', box);
  assert.equal(vm.runInContext('SUN.p', box), 0, 'sunrise as the bank pays');
  vm.runInContext('sunUpdate(1234567+3600000*7+2700000+60000);', box);
  assert.ok(vm.runInContext('SUN.p===1&&SUN.dark>.4', box), 'and 45 minutes on, the night');
  vm.runInContext('sunUpdate(1234567+3600000*8-1);', box);
  assert.ok(vm.runInContext('SUN.lit===0&&SUN.dark>=.4', box), 'which lasts until the next payment');
  vm.runInContext('delete globalThis.S;', box);
  assert.equal(vm.runInContext('sunTest(true,30)', box), 'sun on at 30 s');
  assert.equal(vm.runInContext('SUN.pin', box), 30, 'sunTest holds it for a screenshot');
});

test('a silhouette is cast away from the sun and a little toward the viewer, its foot staying where the prop stands', () => {
  const box = sunBox();
  vm.runInContext(`globalThis.drawn=null;sunFrame=true;sunCast=true;sunLayer={};sunG=(()=>{let m=[1,0,0,1,0,0];
    const mul=n=>{const [a,b,c,d,e,f]=m,[A,B,C,D,E,F]=n;m=[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f];};
    return {setTransform(a,b,c,d,e,f){m=[a,b,c,d,e,f];},translate(x,y){mul([1,0,0,1,x,y]);},transform(a,b,c,d,e,f){mul([a,b,c,d,e,f]);},
     scale(x,y){mul([x,0,0,y,0,0]);},drawImage(im,...a){const [x,y,w,h]=a.length>4?a.slice(4):a;globalThis.drawn={im,x,y,w,h,src:a.length>4?a.slice(0,4):null,m:[...m]};}};})();`, box);
  const cast = (t, flip) => {
    at(box, t);
    vm.runInContext(`sunShadow({complete:true,naturalWidth:200,naturalHeight:600},-50,-300,100,300,0,${flip})`, box);
    const { im, x, y, w, h, m } = box.drawn, r = vm.runInContext('SUN.res', box);
    const pt = (px, py) => [(m[0] * px + m[2] * py + m[4]) / r, (m[1] * px + m[3] * py + m[5]) / r];
    const mx = im.pad * w / (im.cw + 2 * im.pad), my = im.pad * h / (im.ch + 2 * im.pad);   /* the blur's margin round the picture */
    const L = x + mx, R = x + w - mx, T = y + my, B = y + h - my;
    assert.ok(Math.abs(R - L - 100) < 1e-9 && Math.abs(B - T - 300) < 1e-9, 'the picture inside the margin is the prop at its own size');
    return { foot: pt((L + R) / 2, B), top: pt((L + R) / 2, T), left: pt(L, B), right: pt(R, B) };
  };
  for (const flip of [false, true]) {
    const morning = cast(20, flip), noon = cast(60, flip), evening = cast(100, flip);
    for (const s of [morning, noon, evening]) {
      assert.ok(Math.abs(s.foot[0]) < 1e-9 && Math.abs(s.foot[1]) < 1e-9, 'the foot of the shadow is the foot of the prop');
      assert.ok(Math.abs(s.left[0] + s.right[0]) < 1e-9, 'the base keeps its width');
      assert.equal(s.left[0] < s.right[0], !flip, 'a mirrored prop casts a mirrored silhouette');
      assert.ok(Math.abs(s.top[1] - 72) < 1e-9, 'always a little toward the viewer - the sun stands behind the town');
    }
    assert.ok(morning.top[0] > 150, 'in the morning the top of the picture falls far to the right');
    assert.ok(Math.abs(noon.top[0]) < 1e-6, 'at noon straight toward you, and short');
    assert.ok(evening.top[0] < -150, 'in the evening far to the left');
  }
  /* a picture that reaches below its foot - a porch, the grass it stands in - casts from the foot up only */
  at(box, 20);
  vm.runInContext('sunShadow({complete:true,naturalWidth:200,naturalHeight:720},-50,-300,100,360,0)', box);
  const cut = box.drawn, sil = cut.im;
  assert.ok(cut.src && cut.src[1] === 0, 'only the top of the silhouette is laid down');
  assert.ok(Math.abs(cut.src[3] - (sil.pad + sil.ch * 300 / 360)) < 1e-9, 'the rows down to the foot');
  assert.ok(Math.abs(cut.y + cut.h) < 1e-9, 'ending on the foot line, so nothing is thrown back toward the sun');
  assert.equal(vm.runInContext('sunLayer.used', box), true);
  vm.runInContext('sunCast=false;drawn=null;sunShadow({complete:true,naturalWidth:200,naturalHeight:600},-50,-300,100,300,0)', box);
  assert.equal(box.drawn, null, 'no sun, no cast shadow');
});

test('the light goes where the sun is: its glow and flares cross the top of the view, the night is darker and bluer', () => {
  const fills = [], gradients = [], images = [];
  const paint = { save() {}, restore() {}, fillRect(x, y, w, h) { fills.push({ op: this.globalCompositeOperation, style: this.fillStyle, alpha: this.globalAlpha }); },
    createLinearGradient: (x0, y0, x1, y1) => { const g = { kind: 'linear', x0, y0, x1, y1, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; gradients.push(g); return g; },
    createRadialGradient: (x0, y0) => { const g = { kind: 'radial', x0, y0, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; gradients.push(g); return g; },
    drawImage(c, x, y) { images.push({ x: x + c.width / 2, y: y + c.height / 2 }); }, globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '' };
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }) }) });
  const box = sunBox({ VW: 1920, VH: 1080 });
  box.ctx = paint; box.document = { createElement: canvas };
  vm.runInContext(section('/* the flares:', '/* Zone maps are the biggest files'), box);
  const frame = t => { at(box, t); fills.length = gradients.length = images.length = 0; paint.globalAlpha = 1; vm.runInContext('drawSunLight(0)', box); };

  const spot = t => { at(box, t); return vm.runInContext('sunSpot(1920,1080)', box); };
  assert.ok(spot(0).x < 0, 'it rises off the left edge');
  assert.ok(Math.abs(spot(60).x - 960) < 1e-9 && spot(60).y < 0, 'stands just over the top at noon');
  assert.ok(spot(119.99).x > 1920, 'and sets off the right edge');
  assert.ok(spot(30).y < spot(15).y && spot(90).y < spot(105).y, 'climbing, then sinking');

  frame(20);
  const glow = gradients.find(g => g.kind === 'radial');
  assert.ok(glow.x0 < 960 && glow.y0 < 540, 'in the morning the glow is up to the left');
  assert.ok(images.length === 6 && images.every(p => p.x > glow.x0), 'the flares run from it toward the middle of the view and on');
  const gold = gradients.find(g => g.kind === 'linear' && String(g.stops[0][1]).startsWith('rgba'));
  assert.ok(gold.x0 < gold.x1, 'the gold comes in from the sun\'s side');
  assert.ok(!fills.some(f => f.op === 'multiply' && /^rgb\(/.test(f.style)), 'no night in the day');

  frame(100);
  assert.ok(gradients.find(g => g.kind === 'radial').x0 > 960, 'in the evening the glow is over to the right');
  assert.ok(gradients.find(g => g.kind === 'linear' && String(g.stops[0][1]).startsWith('rgba')).x0 > 960, 'and the gold comes from there');

  frame(150);
  assert.deepEqual(fills.map(f => [f.op, f.style]), [['multiply', 'rgb(136,152,214)']], 'at night only the dark: no sun, no glow, no flares');
  assert.equal(images.length, 0);
});

/* the lights of the night in a sandbox: every canvas keeps its own log of [what, composite, fill or picture, x, y, w, h, alpha] */
function nightBox() {
  const recorder = log => ({ globalCompositeOperation: 'source-over', globalAlpha: 1, fillStyle: '', filter: 'none',
    setTransform() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {},
    fillRect() { log.push(['fillRect', this.globalCompositeOperation, this.fillStyle]); },
    drawImage(im, x, y, w, h) { log.push(['drawImage', this.globalCompositeOperation, im, x, y, w, h, this.globalAlpha]); },
    createRadialGradient(...args) { const g = { kind: 'radial', args, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; log.push(g); return g; },
    createLinearGradient(...args) { const g = { kind: 'linear', args, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; log.push(g); return g; } });
  const main = [], shadows = [];
  const box = sunBox({ VW: 1920, VH: 1080, cv: { width: 1920, height: 1080 }, world: { w: 10000 },
    CityWorks: { artFrame: () => null }, cityArt: () => null, performance: { now: () => 0 },
    homeBuildingFrame: s => (s.type === 'house' ? { ready: true } : null), homeBuildingDoor: s => ({ x: s.x - 20, y: s.y + 60 }),
    drawGroundShadow: (x, y, rx, ry, al, rot) => shadows.push({ x, y, rx, al, rot }) });
  box.document = { createElement: () => { const c = { width: 0, height: 0, log: [] }; c.getContext = () => c.ctx || (c.ctx = recorder(c.log)); return c; } };
  box.ctx = recorder(main);
  vm.runInContext(section('/* the flares:', '/* Zone maps are the biggest files'), box);
  vm.runInContext(`sunFrame=true;sunWorld={a:1,b:0,c:0,d:1,e:0,f:0};
    globalThis.west={type:'citywork',kind:'lamp',lit:true,x:500,y:2000,seed:0};globalThis.east={type:'citywork',kind:'lamp',lit:true,x:9500,y:2000,seed:0};
    globalThis.inn={type:'house',big:true,x:1300,y:900};globalThis.altar={type:'altarportal',x:1260,y:150};globalThis.farm={type:'farmportal',x:160,y:850};
    globalThis.tree={type:'tree',x:700,y:700};globalThis.dark={type:'citywork',kind:'lamp',lit:false,x:500,y:2000,seed:0};
    globalThis.zone={};globalThis.light1=s=>{const o=[];propLights(s,zone,o);return o[0]||null;};`, box);
  return { box, main, shadows, near: (a, b) => Math.abs(a - b) < 1e-9 };
}

test('the street lamps come on at dusk, west end first, and their light is let into the night', () => {
  const pass = game.slice(game.indexOf('if(sunCast)sunBegin();'), game.indexOf('if(sunCast)sunEnd();'));
  assert.ok(pass.includes('sunLights.length=0;'), 'the lights are gathered afresh each frame');
  assert.ok(pass.indexOf('if(sunFrame&&SUN.light&&SUN.dark>0)propLights(s,z,sunLights);') > pass.indexOf('if(s.x<left||s.x>right)continue;'),
    'the lights met on the prop pass, in and near the view, once it grows dark');
  assert.ok(game.includes('lightPersonShadow(h.x,h.y,8+gY,56);'), 'the hero throws a shadow away from a light');
  assert.ok(game.includes('lightPersonShadow(n.x,n.y,gy,tall*size,size);'), 'and so does everyone in the street');

  const { box, main, shadows, near } = nightBox();
  const level = (t, who) => { at(box, t); return vm.runInContext(`lightLevel(light1(${who}),0)`, box); };
  assert.equal(vm.runInContext('light1(dark)', box), null, 'a lamp the ledger has not lit gives no light');
  assert.equal(level(40, 'west'), 0, 'out by day');
  assert.equal(level(40, 'east'), 0);
  assert.ok(level(150, 'west') > .85 && level(150, 'east') > .85, 'burning at night');
  assert.ok(level(116, 'west') > level(116, 'east'), 'the lamplighters start at the west gate');
  assert.equal(level(116, 'east'), 0);

  const v = level(150, 'west');
  vm.runInContext('sunLights.length=0;sunLights.push(light1(west));', box);
  main.length = 0; vm.runInContext('drawSunLight(0)', box);
  assert.equal(main.filter(e => e[0] === 'fillRect' && e[1] === 'multiply').length, 0, 'with a lamp burning the night is no longer one flat colour...');
  const laid = main.find(e => e[0] === 'drawImage' && e[1] === 'multiply');
  assert.ok(laid, '...but a light map laid over the view');
  const map = laid[2].log;
  assert.deepEqual(map[0], ['fillRect', 'source-over', 'rgb(136,152,214)'], 'the night in it');
  const [pool, head] = map.filter(e => e[0] === 'drawImage');
  assert.ok(near(pool[3], 500 - 340) && near(pool[4], 2004 - 340 * .8) && near(pool[5], 680) && near(pool[6], 680 * .8), 'a pool round the lamp\'s foot, a little flattened');
  assert.ok(near(pool[7], v), 'as strong as the lamp burns');
  assert.ok(near(head[3], 500 - 190) && near(head[4], 2000 - 109 - 190), 'and light round the flame, for the post and the wall behind it');
  for (const sprite of [pool[2], head[2]]) {
    const g = sprite.log.find(e => e.kind === 'radial'), alpha = g.stops.map(([, c]) => Number(c.split(',')[3].replace(')', '')));
    assert.ok(alpha[0] === 1 && alpha.at(-1) === 0, 'bright under the lamp, nothing at the edge of its reach');
    assert.ok(alpha.every((a, i) => !i || a <= alpha[i - 1]), 'falling away steadily');
    assert.ok(g.stops[0][1].startsWith('rgba(255,214,156,'), 'a warm flame');
  }
  const glows = main.filter(e => e[0] === 'drawImage' && e[1] === 'screen' && near(e[3] + e[5] / 2, 500) && near(e[4] + e[6] / 2, 1891));
  assert.equal(glows.length, 2, 'a haze and a bloom round the flame, over the night');

  at(box, 40); main.length = 0; vm.runInContext('drawSunLight(0)', box);
  assert.ok(!main.some(e => e[0] === 'drawImage' && (e[1] === 'multiply' || (e[1] === 'screen' && near(e[4] + e[6] / 2, 1891)))), 'no lamp light by day');

  at(box, 150);
  const cast = (x, y) => { shadows.length = 0; vm.runInContext(`lightPersonShadow(${x},${y},8,56)`, box); return shadows.slice(); };
  const right = cast(600, 2004), below = cast(500, 2104), far = cast(900, 2004);
  assert.equal(right.length, 1); assert.ok(Math.abs(right[0].rot) < 1e-9 && right[0].x > 0, 'standing east of a lamp, the shadow falls east');
  assert.equal(below.length, 1); assert.ok(Math.abs(below[0].rot - Math.PI / 2) < 1e-9, 'south of it, south');
  assert.equal(far.length, 0, 'out of its reach, none');
  assert.ok(cast(560, 2004)[0].al > right[0].al, 'darker the nearer the lamp');
  at(box, 40);
  assert.equal(cast(600, 2004).length, 0, 'none by day');
});

test('Moonshine: the inn, casino, bank, forge and fishing hut cast from their base, and their doors and the portals light the night', () => {
  const home = section('}else if(home&&home.ready){', '}else if(s.type===\'tree\'){');
  assert.ok(home.includes('sunShadow(home.img,home.left,home.top,home.W,home.H,home.top+home.H*home.def.anchor);'),
    'a home building casts from the front of its base, where its picture stands on the ground');
  assert.ok(section("}else if(s.type==='rock'){", "}else if(s.type==='dungeonentrance')").includes('sunShadow(stenImg,-W/2,6-H,W,H,6-W*.06);'), 'the rocks too');
  const tree = section("}else if(s.type==='tree'){", "}else if(s.type==='cityhouse'){"), well = section("else if(s.type==='well'){", "}else if(s.type==='armoraltar'){");
  assert.ok(tree.includes('sunShadow(') && well.includes('sunShadow('), 'its trees and its well already did');

  const { box, main, shadows, near } = nightBox();
  const light = who => vm.runInContext(`light1(${who})`, box);
  assert.equal(light('tree'), null, 'a tree is no light');
  const door = light('inn');
  assert.ok(near(door.x, 1280) && near(door.y, 960), 'the inn\'s light stands at its door');
  assert.ok(door.colour === '255,214,156' && door.fy < door.y && !door.bloom && !door.glass, 'warm, from the height of the doorway, with no lamp glass to burn');
  const altar = light('altar'), farm = light('farm');
  assert.equal(altar.colour, '154,200,255', 'the Altar\'s portal lights the night blue');
  assert.equal(farm.colour, '201,224,106', 'the Farm\'s green');
  assert.ok(near(altar.fy, 150 - 36), 'from the middle of its ring');

  at(box, 40);
  assert.equal(vm.runInContext('lightLevel(light1(inn),0)', box), 0, 'nothing by day');
  assert.equal(vm.runInContext('lightLevel(light1(altar),0)', box), 0);
  at(box, 150);
  const beats = [0, .3, .6, .9].map(t => vm.runInContext(`lightLevel(light1(altar),${t})`, box));
  assert.ok(Math.max(...beats) - Math.min(...beats) > .1, 'a portal\'s light beats with its ring');
  assert.ok(vm.runInContext('lightLevel(light1(inn),0)', box) > .85, 'the doors are lit at night');

  vm.runInContext('sunLights.length=0;sunLights.push(light1(inn),light1(altar));', box);
  main.length = 0; vm.runInContext('drawSunLight(0)', box);
  const map = main.find(e => e[0] === 'drawImage' && e[1] === 'multiply')[2].log.filter(e => e[0] === 'drawImage');
  assert.equal(map.length, 4, 'a pool and a flame-light for each');
  const tint = sprite => sprite.log.find(e => e.kind === 'radial').stops[0][1];
  assert.ok(tint(map[0][2]).startsWith('rgba(255,214,156,') && tint(map[2][2]).startsWith('rgba(154,200,255,'), 'each in its own colour');
  assert.ok(near(map[0][3] + map[0][5] / 2, 1280) && near(map[2][3] + map[2][5] / 2, 1260), 'each where it stands');
  const hazes = main.filter(e => e[0] === 'drawImage' && e[1] === 'screen');
  assert.equal(hazes.length, 2, 'a haze round each, and no lamp bloom where there is no lamp');

  const cast = (x, y) => { shadows.length = 0; vm.runInContext(`lightPersonShadow(${x},${y},8,56)`, box); return shadows.slice(); };
  const byDoor = cast(1330, 960);
  assert.equal(byDoor.length, 1, 'standing at the inn\'s door at night you throw a shadow...');
  assert.ok(Math.abs(byDoor[0].rot) < 1e-9, '...away from it');
});

test('Sun flare turns off the glow and the flares; with Lighting off too the day is plain and the night only darker', () => {
  const { box, main } = nightBox();
  const frame = (t, light, flare) => { vm.runInContext(`SUN.light=${light};SUN.flare=${flare};`, box); at(box, t); main.length = 0; vm.runInContext('drawSunLight(0)', box); return main.slice(); };
  const glowAtSun = log => log.some(e => e.kind === 'radial' && e.args[1] < 540);
  const shade = log => log.some(e => e.kind === 'linear');
  const flares = log => log.filter(e => e[0] === 'drawImage' && e[1] === 'screen').length;
  let log = frame(40, true, false);
  assert.ok(shade(log) && !glowAtSun(log) && flares(log) === 0, 'Sun flare off: the gold and the shade stay, the glow and the flares go');
  log = frame(40, false, true);
  assert.ok(!shade(log) && glowAtSun(log) && flares(log) === 6, 'Lighting off: no gold and no shade, the glow and the flares still ride the sun');
  log = frame(40, false, false);
  assert.equal(log.filter(e => e[0] === 'fillRect' || e[0] === 'drawImage').length, 0, 'both off: the day is plain');
  log = frame(150, false, false);
  assert.deepEqual(log.filter(e => e[0] === 'fillRect').map(e => [e[1], e[2]]), [['multiply', 'rgb(136,152,214)']], '...and the night only darker');
  vm.runInContext('sunLights.length=0;sunLights.push(light1(west));', box);
  log = frame(150, false, false);
  assert.ok(!log.some(e => e[0] === 'drawImage'), 'with Lighting off the lamps do not light the night');
  assert.deepEqual(log.filter(e => e[0] === 'fillRect').map(e => e[1]), ['multiply']);
  log = frame(150, true, false);
  assert.ok(log.some(e => e[0] === 'drawImage' && e[1] === 'multiply'), 'with it on they do, flares or none');
  vm.runInContext('SUN.light=true;SUN.flare=true;', box);
});

test('the whole world casts: mountains, farm pieces, the Wasteland\'s buildings, the ports and the Harbour, foes, pets, mounts and Tides', () => {
  const shadows = section('function drawPropShadow(s,z){', 'function drawProp(s,z,withShadow=true){');
  for (const [what, call] of [
    ['the stable, drawn mirrored', 'sunShadow(stableImg,-W/2,-H*.96,W,H,0,true);'],
    ['the training lodge', 'sunShadow(trainingLodgeImg,-W/2,-H*b.footRatio,W,H,0);'],
    ['the Harbour, but not what floats', "if(f&&!f.wet)sunShadow(f.im,-f.W/2,f.top,f.W,f.H,f.foot,f.flip);"],
    ['the ports, a wall as a block', 'if(f.span)sunShadowBox(-f.W/2,f.top,f.W,f.H,f.foot);else sunShadow(f.im,-f.W/2,f.top,f.W,f.H,f.foot,f.flip);'],
    ['a farm piece that stands up, from its base', 'sunShadow(im,-W/2,gy-H,W,H,gy+W*sh.dy,fl<0);'],
    ['the mountains', 'sunShadow(bergImg,-W/2,s.dr*.5-H,W,H,s.dr*.5-W*.055);'],
    ['a dungeon\'s mouth', 'sunShadow(im,-210,28-420,420,420,0);']])
    assert.ok(shadows.includes(call), what);
  assert.ok(shadows.indexOf('sunShadow(im,-W/2,gy-H,W,H,gy+W*sh.dy,fl<0);') > shadows.indexOf('if(def&&def.sh&&ready(farmImg(def.img))){'), 'a piece with no contact shadow lies flat and casts nothing');
  for (const [what, call] of [
    ['a foe', 'if(!en.dead){sunPersonShadow(en.r*.55,en.r*4);lightPersonShadow(en.x,en.y,en.r*.55,en.r*4);}'],
    ['a pet', 'sunPersonShadow(5,22);lightPersonShadow(pet.x,pet.y,5,22);'],
    ['a Tide companion', 'sunFootShadow(pet.x,pet.y+4,34);TideUI.drawCompanion('],
    ['the hero on horseback', 'else if(!h.dead){sunPersonShadow(10,84);lightPersonShadow(h.x,h.y,10,84);}'],
    ['the mounts in the paddock', 'sunFootShadow(spot.x,spot.y+6,70);MountRenderer.draw('],
    ['a townsman\'s Tide', 'sunFootShadow(tx,ty,height);TideUI.drawAnimal('],
    ['a Tide in training', 'sunFootShadow(x,y,visual.height);TideUI.drawAnimal('],
    ['the wild Tides', 'TideUI.addWildDrawables(drawables,{x0:cx0,x1:cx1,y0:cy0,y1:cy1},sunFootShadow);']])
    assert.ok(game.includes(call), what);
  assert.ok(fs.readFileSync(path.join(root, 'assets/tides/ui.js'), 'utf8').includes('if(shade)shade(w.x,w.y+6,H);'), 'the Tides lay the shadow under a wild one');

  /* the modules tell the game what it needs: the picture, where it stands, whether it is mirrored, whether the sea carries it, its glows */
  const Hb = require('../assets/city/harbor-world.js'), TW = require('../assets/city/town-world.js');
  const pic = { naturalWidth: 100, naturalHeight: 500, complete: true };
  const hLamp = Hb.frame({ kind: 'lamp', flip: false }, { lamp: pic }), boat = Hb.frame({ kind: 'rowboat' }, { rowboat: pic });
  assert.ok(hLamp.im === pic && hLamp.foot === 8 && hLamp.flip === false && hLamp.wet === false && hLamp.glow.length === 1, 'a harbour lamp');
  assert.equal(boat.wet, true, 'a boat rides the sea');
  const tLamp = TW.frame({ kind: 'lamp' }, { lamp: pic });
  assert.ok(tLamp.im === pic && tLamp.foot === 8 && tLamp.wet === false && tLamp.glow[0][2] === 170, 'a port\'s lamp');

  const { box } = nightBox();
  vm.runInContext(`HarborWorld={frame:s=>s.f};TownWorld={frame:s=>s.f};harborImages=()=>({});townImages=()=>({});
    FARM_BUILD=[{id:'light_farm',img:'light_farm',W:42,gy:10,glow:{fx:.799,fy:.408,r:.78},sh:{dy:-.045}}];
    farmImg=()=>({complete:true,naturalWidth:42,naturalHeight:126});scaleOf=()=>1;flipOf=it=>it&&it.fl||1;
    globalThis.all=s=>{const o=[];propLights(s,{town:'silverfjord'},o);return o;};`, box);
  const lamp = vm.runInContext("all({type:'townprop',kind:'lamp',x:1000,y:800,seed:.5,f:{W:30,H:150,top:-142,im:{},foot:8,flip:false,glow:[[.5,.16,170]]}})", box);
  assert.equal(lamp.length, 1);
  assert.ok(lamp[0].x === 1000 && Math.abs(lamp[0].fy - (800 - 142 + 24)) < 1e-9 && lamp[0].bloom && lamp[0].glass, 'a port\'s lamp burns at its head, glass and all');
  const inn = vm.runInContext("all({type:'townprop',kind:'h_tavern',x:1000,y:800,seed:.2,f:{W:300,H:400,top:-384,im:{},foot:16,flip:true,glow:[[.42,.55,170,[255,140,40]],[.8,.3,90]]}})", box);
  assert.equal(inn.length, 2, 'every glow its art declares');
  assert.ok(Math.abs(inn[0].x - (1000 - (.42 - .5) * 300)) < 1e-9, 'mirrored with the picture');
  assert.ok(inn[0].colour === '255,140,40' && inn[1].colour === '255,214,156' && !inn[0].bloom, 'in its own colour, warm when it names none; a window is no lamp');
  const post = vm.runInContext("all({type:'farmitem',ftype:'light_farm',x:500,y:500,it:{}})", box);
  assert.equal(post.length, 1);
  assert.ok(Math.abs(post[0].x - (500 + .799 * 42 - 21)) < 1e-9 && Math.abs(post[0].fy - (500 + 10 - 126 + .408 * 126)) < 1e-9, 'a lamp post lights from its lantern');
  assert.equal(vm.runInContext("all({type:'farmitem',ftype:'fence',x:0,y:0,it:{}}).length", box), 0, 'a fence is no light');
});

test('the weather: a cycle rains one time in five, for ten minutes, in Moonshine, the City, the Wasteland and the leveling zones - snow where it is snowy - and one in seven brings the Wasteland a quarter hour of mist', () => {
  const box = vm.createContext({ Math, WeakMap, Date, world: { look: null } });
  vm.runInContext(section('const SUN=', '/* the flares:'), box);
  vm.runInContext(section('/* 🌧 The weather', 'let mistTex=null;'), box);
  const a0 = game.indexOf('const ZONES=['), i0 = game.indexOf('[', a0);
  let depth = 0, j0 = i0;
  for (; j0 < game.length; j0++) { const ch = game[j0]; if (ch === '[') depth++; else if (ch === ']' && !--depth) break; }
  box.ZONES = vm.runInContext('(' + game.slice(i0, j0 + 1) + ')', box);
  const wet = [...vm.runInContext('ZONES.filter(weatherZone).map(z=>z.name)', box)];
  assert.deepEqual(wet, ['Willowmere Fields', 'Thornwood Glade', 'Ironcrag Pass', 'Mistfen Marsh', 'Ashen Moor', 'Duskhollow Barrens', 'Frostspire Heights', 'Shatterstone Vale',
    'Cinderwaste', 'Stormreach Coast', 'Blackwind Steppe', 'Emberdeep Approach', 'Moonshine', 'City', 'Wasteland', 'Frostwild Reach', 'Sunscar Sands'], 'where it can rain');

  const wu = vm.runInContext('weatherUpdate', box), pin = p => vm.runInContext('WEATHER.pin=' + JSON.stringify(p), box);
  const zoneNamed = name => { const i = box.ZONES.findIndex(z => z.name === name); return [box.ZONES[i], i]; };
  const sky = (name, t) => { const [z, i] = zoneNamed(name); return { ...wu(z, i, t * 1000) }; };
  const HOUR = 3600, T0 = 1.8e9 - 1.8e9 % HOUR;   /* on the top of a cycle (the bank's hour; its anchor is 0 here) */
  const cycles = (name, n, kind) => {   /* for each cycle: how many seconds of it the rain (or the mist) was on */
    const out = [];
    for (let c = 0; c < n; c++) {
      let secs = 0;
      for (let s = 0; s < HOUR; s += 10) { const w = sky(name, T0 + c * HOUR + s); if ((kind === 'fog' ? w.fog : Math.max(w.rain, w.snow)) > .5) secs += 10; }
      out.push(secs);
    }
    return out;
  };
  pin(null);
  const rainy = cycles('Willowmere Fields', 300, 'rain').filter(s => s > 0);
  assert.ok(rainy.length / 300 > .14 && rainy.length / 300 < .26, 'it rains in about one cycle in five: ' + (rainy.length / 300).toFixed(2));
  assert.ok(rainy.every(s => s >= 550 && s <= 600), 'and then for ten minutes: ' + [...new Set(rainy)].join(','));
  const misty = cycles('Wasteland', 300, 'fog').filter(s => s > 0);
  assert.ok(misty.length / 300 > .09 && misty.length / 300 < .21, 'a mist over the Wasteland in about one cycle in seven: ' + (misty.length / 300).toFixed(2));
  assert.ok(misty.every(s => s >= 820 && s <= 900), 'lying a quarter of an hour: ' + [...new Set(misty)].join(','));
  assert.deepEqual(sky('Willowmere Fields', T0 + 500), sky('Willowmere Fields', T0 + 500), 'the same sky for the same moment');
  let differ = false;
  for (let t = T0; t < T0 + 60 * HOUR && !differ; t += 300) differ = (sky('Willowmere Fields', t).rain > .5) !== (sky('Moonshine', t).rain > .5);
  assert.ok(differ, 'a leveling zone has a sky of its own');
  let showers = 0;
  for (let t = T0; t < T0 + 40 * HOUR; t += 60) {   /* Moonshine, the City and the Wasteland share one sky (asked for 2026-09-26) */
    const home = sky('Moonshine', t).rain;
    if (home > .5) showers++;
    assert.equal(sky('City', t).rain, home, 'when it rains at home it rains in the City');
    assert.equal(sky('Wasteland', t).rain, home, '...and in the Wasteland');
    assert.equal(sky('Sunscar Sands', t).rain, home);
    assert.equal(sky('Frostwild Reach', t).snow, home, 'where it snows instead, at the same time');
    assert.equal(sky('Sunscar Sands', t).fog, sky('Wasteland', t).fog, 'the same mist over all the Wasteland');
  }
  assert.ok(showers > 0, 'and it does rain in those hours');
  for (let t = T0; t < T0 + 40 * HOUR; t += 120) {
    assert.equal(sky('Frostspire Heights', t).rain, 0, 'on the snowy heights it snows instead');
    assert.equal(sky('Farm', t).rain + sky('The Harbour', t).rain + sky('Silverfjord', t).rain + sky('Throne Hall', t).rain, 0, 'the Farm, the ports and indoors stay as they are');
    assert.equal(sky('City', t).fog + sky('Moonshine', t).fog, 0, 'the mist is the Wasteland\'s');
  }
  pin({ rain: .7 });
  assert.equal(sky('Willowmere Fields', T0).rain, .7, 'weatherTest holds it');
  vm.runInContext('WEATHER.on=false', box);
  pin({ rain: 1 });
  assert.equal(sky('Willowmere Fields', T0).rain, 0, 'Settings -> Video -> Weather off: a clear sky');
  pin(null);
  assert.equal(sky('Wasteland', T0).fog, 0);
  vm.runInContext('WEATHER.on=true;WEATHER.pin={rain:1};SUN.pin=40;sunUpdate();weatherUpdate(ZONES[0],0);weatherDim();', box);
  assert.ok(vm.runInContext('SUN.cast<.16&&SUN.lit===0', box), 'under the clouds the shadows go soft and the sun\'s glow goes out');

  const DS = DisplaySettings;
  assert.equal(DS.normalize(null).weather, true);
  assert.equal(DS.normalize({ weather: false }).weather, false);
  assert.ok(html.includes('<span>Sun flare</span></label>\n            <label class="cfgrow cfgchk"><input type="checkbox" id="weatherChk" checked><span>Weather</span></label>'), 'Weather sits under Sun flare');
  const els = {}, el = id => els[id] || (els[id] = { id, style: { setProperty() {} }, checked: false, value: '', handlers: {}, addEventListener(type, f) { this.handlers[type] = f; }, setAttribute() {} });
  const kept = {}, told = [];
  const settings = DS.create({ doc: { getElementById: el }, storage: { getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v; } }, onChange: v => told.push(v.weather) });
  els.weatherChk.checked = false; els.weatherChk.handlers.change({ target: els.weatherChk });
  assert.equal(told.at(-1), false); assert.equal(JSON.parse(kept[DS.STORAGE_KEY]).weather, false, 'remembered on the device');
  settings.reset(); assert.equal(settings.value.weather, false, 'the reset button leaves it alone');

  const order = ['if(sunFrame){sunUpdate();weatherUpdate(z,S.zone);weatherDim();', 'if(sunFrame&&WEATHER.fog>0)drawMist(now);', 'drawEdgeFog(); /* last thing in world space',
    'if(sunFrame)drawSunLight(now);', 'if(sunFrame&&(WEATHER.rain>0||WEATHER.snow>0))drawWeather(now);', 'if(cowRunning||(zoneOf().cow&&hero.dead)){'].map(x => game.indexOf(x));
  assert.ok(order.every((x, i) => x > 0 && (!i || x > order[i - 1])), 'the mist lies in the world under the edge fog, the rain falls over the lit world, and the canvas HUD over both');
  const light = section('function drawSunLight(now){', '/* 🏮 The lights of the night');
  assert.ok(light.indexOf('drawOvercast();') > 0 && light.indexOf('drawOvercast();') < light.indexOf('if(dark>0){'), 'the grey of a rainy day goes down before the night');
});

test('the rain, its splashes and the snow keep their places on the world, so they do not follow the hero about', () => {
  const marks = { drops: [], splashes: [], flakes: [] };
  const ctx = { save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {}, lineTo() {}, strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: '', globalAlpha: 1,
    moveTo(x, y) { marks.drops.push([x, y]); }, ellipse(x, y) { marks.splashes.push([x, y]); }, arc(x, y) { marks.flakes.push([x, y]); } };
  const box = vm.createContext({ Math, WeakMap, Date, world: { look: null }, ctx, VW: 1500, VH: 950, zoom: .9, camX: 5000, camY: 2000 });
  vm.runInContext(section('const SUN=', '/* the flares:'), box);
  vm.runInContext(section('/* 🌧 The weather', '/* Zone maps are the biggest files'), box);
  const shot = (camX, kind) => {
    for (const k in marks) marks[k].length = 0;
    vm.runInContext(`camX=${camX};SUN.dark=0;WEATHER.rain=${kind === 'snow' ? 0 : 1};WEATHER.snow=${kind === 'snow' ? 1 : 0};WEATHER.wind=.3;drawWeather(1234.5);`, box);
    return { drops: marks.drops.slice(), splashes: marks.splashes.slice(), flakes: marks.flakes.slice() };
  };
  const matchShift = (a, b, dx) => {   /* every point of b well inside the screen is a point of a moved by dx (b = a + dx) */
    const inner = b.filter(([x, y]) => x > 150 && x < 1350 && y > 60 && y < 890);
    assert.ok(inner.length > 20, 'something to compare: ' + inner.length);
    for (const [x, y] of inner) assert.ok(a.some(([u, v]) => Math.abs(u + dx - x) < 1e-6 && Math.abs(v - y) < 1e-6), 'moved with the ground: ' + x + ',' + y);
  };
  const a = shot(5000, 'rain'), b = shot(5100, 'rain');
  assert.ok(a.drops.length > 300 && a.drops.length < 1200, 'as thick as it was: ' + a.drops.length + ' drops on the screen');
  matchShift(a.drops, b.drops, -100 * .9);
  matchShift(a.splashes, b.splashes, -100 * .9);
  const c = shot(5000, 'snow'), d = shot(5100, 'snow');
  matchShift(c.flakes, d.flakes, -100 * .9);
});
