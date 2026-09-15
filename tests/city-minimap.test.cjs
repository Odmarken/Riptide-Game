/* The real City builder and minimap, isolated from game startup and saved state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'assets/ui/city-minimap.js'), 'utf8');

function section(start, end) {
  const a = game.indexOf(start), b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
  return game.slice(a, b);
}
function close(a, b, label = '') {
  assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);
}
function realCity() {
  const context = vm.createContext({ world: { w: 16800, h: 5200, solids: [] }, npcSebbeImg: {} });
  const rng = game.match(/^function mulberry32\(.*$/m);
  assert.ok(rng);
  vm.runInContext(section('const CATH_ART=', 'const CITY_FOOT=') +
    section('const CITY_NAMES=', 'const cityPat=') + rng[0], context);
  vm.runInContext('buildCity(mulberry32(13));', context);
  return context.world;
}
const city = realCity();
const wasteland = require('../assets/wasteland/world.js').create();
const placeTypes = ['altarportal', 'cathedral', 'enchanthall', 'minehall', 'smelter', 'well'];

function recordingCanvas() {
  const ops = [], stack = [], listeners = new Map();
  let currentPath = [];
  const record = (op, args) => {
    assert.ok(args.every(n => typeof n !== 'number' || Number.isFinite(n)), `${op} received non-finite geometry`);
    ops.push({ op, args: [...args], fillStyle: g.fillStyle });
  };
  const g = {
    save() { stack.push(true); }, restore() { assert.ok(stack.pop(), 'Canvas saves remain balanced'); },
    beginPath() { currentPath = []; }, closePath() {}, clip() {}, fill() {},
    moveTo(x, y) { record('moveTo', [x, y]); currentPath.push([x, y]); },
    lineTo(x, y) { record('lineTo', [x, y]); currentPath.push([x, y]); },
    stroke() { ops.push({ op: 'stroke', path: currentPath.map(p => [...p]), width: this.lineWidth }); },
    drawImage(image, ...args) { record('drawImage', args); ops.at(-1).image = image; },
    createRadialGradient(...args) { record('gradient', args); return { addColorStop() {} }; },
  };
  for (const name of ['scale', 'rotate', 'translate', 'setTransform', 'clearRect', 'fillRect', 'strokeRect', 'ellipse', 'arc', 'rect']) {
    g[name] = (...args) => record(name, args);
  }
  const canvas = { width: 0, height: 0, getContext: () => g,
    addEventListener(name, fn) { listeners.set(name, fn); },
    getBoundingClientRect: () => ({ left: 200, top: 30, width: 150, height: 150 }),
  };
  return { canvas, g, ops, stack, listeners };
}
function harness() {
  const atlasCanvases = [], map = recordingCanvas(), listeners = new Map();
  const tip = { textContent: '' }, title = { textContent: 'CITY' }, attributes = new Map();
  const el = { hidden: true, querySelector: selector => selector === 'canvas' ? map.canvas : selector === '.minimap-title' ? title : tip,
    setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); },
    addEventListener(name, fn) { listeners.set(name, fn); } };
  const context = vm.createContext({ devicePixelRatio: 1,
    Path2D: class { constructor(path) { this.path = path; } },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas'); const rec = recordingCanvas(); atlasCanvases.push(rec); return rec.canvas;
    } },
  });
  vm.runInContext(source, context, { filename: 'city-minimap.js' });
  const controller = context.CityMinimap.create(el);
  return { context, api: context.CityMinimap, controller, atlasCanvases, map, el, tip, title, listeners };
}

test('north-up projection centres the player and uses one scale on both axes', () => {
  const { api } = harness(), hero = { x: 4200, y: 1800 };
  const centre = api.project(hero, hero);
  close(centre.x, 90); close(centre.y, 90);
  const east = api.project({ x: hero.x + 2600, y: hero.y }, hero);
  const south = api.project({ x: hero.x, y: hero.y + 2600 }, hero);
  close(east.x - centre.x, 86); close(south.y - centre.y, 86);
  close(east.y, centre.y); close(south.x, centre.x);
  const a = api.project({ x: 4000, y: 1500 }, hero);
  const b = api.project({ x: 12000, y: 5500 }, { x: 12200, y: 5800 });
  close(a.x, b.x); close(a.y, b.y);
});

test('markers use all six live City landmarks and ignore houses and unrelated props', () => {
  const { api } = harness();
  assert.ok(city.streets.length > 40 && city.solids.filter(s => s.type === 'cityhouse').length > 300,
    'Fixture must execute the production City builder, including its alleys and houses');
  const world = { ...city, solids: [...city.solids, { type: 'tree', x: NaN, y: Infinity },
    { type: 'unknown', x: 0, y: 0 }, { type: 'rock', x: 0, y: 0 }] };
  const markers = api.markers(world, city.spawn);
  assert.deepEqual(Array.from(markers, p => p.type).sort(), placeTypes);
  for (const type of placeTypes) {
    const landmark = city.solids.find(s => s.type === type);
    const atDoor = api.markers(world, landmark).find(p => p.type === type);
    assert.equal(atDoor.far, false); close(atDoor.x, 90); close(atDoor.y, 90);
    close(atDoor.distance, 0);
    const marker = markers.find(p => p.type === type);
    close(marker.distance, Math.hypot(landmark.x - city.spawn.x, landmark.y - city.spawn.y));
    close(marker.angle, Math.atan2(landmark.y - city.spawn.y, landmark.x - city.spawn.x));
  }
});

test('clustered west and east edge badges stay separate and retain their true bearings', () => {
  const { api } = harness(), snapshot = JSON.stringify(city.solids);
  for (const hero of [city.spawn, { x: city.w - 300, y: city.h / 2 }]) {
    const markers = api.markers(city, hero);
    assert.ok(markers.filter(p => p.far).length >= 5);
    for (let i = 0; i < markers.length; i++) {
      const p = markers[i], original = city.solids.find(s => s.type === p.type);
      close(p.angle, Math.atan2(original.y - hero.y, original.x - hero.x));
      if (p.far) close(Math.hypot(p.x - 90, p.y - 90), 72, 'Badge centre stays on the rim');
      assert.ok(Math.hypot(p.x - 90, p.y - 90) + 10.5 < 86, 'Entire badge stays inside the circle');
      for (let j = 0; j < i; j++) if (p.far || markers[j].far) {
        assert.ok(Math.hypot(p.x - markers[j].x, p.y - markers[j].y) >= 23 - 1e-9,
          `${p.type} overlaps ${markers[j].type}`);
      }
    }
    assert.deepEqual(api.markers(city, hero), markers, 'Placement is deterministic');
  }
  assert.equal(JSON.stringify(city.solids), snapshot, 'Markers never move live world objects');
});

test('real city corners, streets and venue positions always produce finite bounded markers', () => {
  const { api } = harness();
  const points = [city.spawn, ...city.plazas,
    ...city.streets.flatMap(s => [{ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }]),
    { x: 0, y: 0 }, { x: city.w, y: city.h }];
  for (const hero of points) for (const p of api.markers(city, hero)) {
    assert.ok([p.x, p.y, p.angle, p.distance].every(Number.isFinite));
    assert.ok(Math.hypot(p.x - 90, p.y - 90) <= 72 + 1e-9);
    const landmark = city.solids.find(s => s.type === p.type);
    const exact = api.project(landmark, hero), radius = Math.hypot(exact.x - 90, exact.y - 90);
    if (radius <= 72) {
      assert.equal(p.far, false, 'Places inside the rim keep their real map location');
      close(p.x, exact.x); close(p.y, exact.y);
    } else assert.equal(p.far, true);
  }
  assert.equal(api.markers({ solids: [] }, city.spawn).length, 0);
});

test('the small cached atlas paints every real road, plaza and wall without stretching the local view', () => {
  const h = harness();
  h.controller.update(city, { ...city.spawn, fx: 1 }, true, 0);
  assert.equal(h.el.hidden, false); assert.equal(h.atlasCanvases.length, 1);
  const atlas = h.atlasCanvases[0];
  assert.ok(atlas.canvas.width <= 2048 && atlas.canvas.height <= 2048);
  const roads = atlas.ops.filter(o => o.op === 'stroke' && o.path.length === 2);
  assert.equal(roads.length, city.streets.length * 2, 'Each street has its lip and painted surface');
  city.streets.forEach((road, i) => {
    assert.deepEqual(roads[i * 2 + 1].path, [[road.x0, road.y0], [road.x1, road.y1]]);
    close(roads[i * 2 + 1].width, road.w);
  });
  assert.equal(atlas.ops.filter(o => o.op === 'ellipse').length, city.plazas.length);
  assert.equal(atlas.ops.filter(o => o.op === 'strokeRect').length, city.mwalls.length);
  const draw = h.map.ops.find(o => o.op === 'drawImage');
  close(draw.args[2] / atlas.canvas.width, draw.args[3] / atlas.canvas.height);
  const atlasScale = atlas.ops.find(o => o.op === 'scale').args[0];
  close(draw.args[0] + city.spawn.x * atlasScale * draw.args[2] / atlas.canvas.width, 90);
  close(draw.args[1] + city.spawn.y * atlasScale * draw.args[3] / atlas.canvas.height, 90);
  assert.equal(h.map.stack.length, 0);
});

test('movement reuses terrain, redraw is bounded, and leaving or rebuilding the City releases stale cache', () => {
  const h = harness(), hero = { ...city.spawn, fx: 1 };
  h.controller.update(city, hero, true, 0);
  const draws = () => h.map.ops.filter(o => o.op === 'drawImage').length;
  h.controller.update(city, { ...hero, x: hero.x + 10 }, true, 20);
  assert.equal(draws(), 1, 'Do not redraw more than 20 times per second');
  h.controller.update(city, { ...hero, x: hero.x + 40 }, true, 50);
  assert.equal(draws(), 2); assert.equal(h.atlasCanvases.length, 1);
  h.context.devicePixelRatio = 3;
  h.controller.update(city, hero, true, 100);
  assert.equal(h.map.canvas.width, 360); assert.equal(h.map.canvas.height, 360);
  assert.equal(h.atlasCanvases.length, 1, 'DPR changes only resize the small display canvas');
  h.controller.update(city, hero, false, 101);
  assert.equal(h.el.hidden, true);
  h.controller.update(city, hero, true, 102);
  assert.equal(h.el.hidden, false); assert.equal(h.atlasCanvases.length, 2);
  h.controller.update({ ...city }, hero, true, 103);
  assert.equal(h.atlasCanvases.length, 3, 'A rebuilt world invalidates even when dimensions match');
  h.controller.update(null, hero, true, 104); assert.equal(h.el.hidden, true);
  h.controller.update(city, null, true, 105); assert.equal(h.el.hidden, true);
});

test('pointer tooltips use CSS coordinates and HUD gestures cannot bubble into world controls', () => {
  const h = harness();
  h.controller.update(city, city.spawn, true, 0);
  const point = h.api.markers(city, city.spawn).find(p => p.type === 'well');
  h.map.listeners.get('pointermove')({ clientX: 200 + point.x * 150 / 180,
    clientY: 30 + point.y * 150 / 180 });
  assert.match(h.tip.textContent, /^Well/); assert.match(h.tip.textContent, /further away/);
  h.map.listeners.get('pointerleave')(); assert.match(h.tip.textContent, /^You/);
  for (const name of ['pointerdown', 'click', 'dblclick', 'contextmenu', 'wheel']) {
    let stopped = false, prevented = false;
    h.listeners.get(name)({ stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } });
    assert.equal(stopped, true, name);
    if (name !== 'pointerdown') assert.equal(prevented, true, name);
  }
});

test('Wasteland exposes only its Home portal and never reads dungeon metadata', () => {
  const { api } = harness(), world = { ...wasteland };
  for (const name of ['entrances', 'travelDoors', 'enemySpawns', 'bossRooms', 'solids']) {
    Object.defineProperty(world, name, { get() { throw new Error('Minimap read private metadata: ' + name); } });
  }
  for (const hero of [wasteland.spawn, ...wasteland.entrances, { x: wasteland.w, y: 0 }]) {
    const places = api.markers(world, hero);
    assert.equal(places.length, 1);
    const home = places[0];
    assert.equal(home.type, 'homeportal'); assert.equal(home.name, 'Home');
    close(home.distance, Math.hypot(world.exit.x - hero.x, world.exit.y - hero.y));
    close(home.angle, Math.atan2(world.exit.y - hero.y, world.exit.x - hero.x));
    if (home.far) close(Math.hypot(home.x - 90, home.y - 90), 72);
    assert.doesNotMatch(JSON.stringify(places), /briar|cinder|frost|dungeon|cathedral|enchant/i);
  }
  assert.equal(api.markers({ ...wasteland, exit: null }, wasteland.spawn).length, 0);
  assert.equal(api.markers({ ...wasteland, exit: { x: NaN, y: 0 } }, wasteland.spawn).length, 0);
  assert.equal(api.markers({ ...wasteland, dungeon: 'briarhollow' }, wasteland.spawn).length, 0);
});

test('Wasteland roads preserve their real polylines and widths with sharp local vector rendering', () => {
  const h = harness();
  assert.equal(wasteland.w, 50400); assert.equal(wasteland.h, 26000);
  for (const [index, road] of wasteland.paths.entries()) {
    const start = h.map.ops.length, hero = road.points[Math.floor(road.points.length / 2)];
    h.controller.update(wasteland, { ...hero, fx: 1 }, true, index * 50);
    const strokes = h.map.ops.slice(start).filter(op => op.op === 'stroke' && op.width === road.width);
    assert.ok(strokes.some(op => JSON.stringify(op.path) === JSON.stringify(road.points.map(p => [p.x, p.y]))),
      'The visible road must retain every bend and its real width');
  }
  assert.equal(h.atlasCanvases.length, 0, 'Large Wasteland needs no downsampled or whole-world atlas');
  assert.equal(h.map.ops.filter(op => op.op === 'drawImage').length, 0, 'Roads stay vector-sharp');
  assert.ok(h.map.ops.some(op => op.op === 'scale' && op.args[0] === 86 / 2600 && op.args[1] === 86 / 2600));
  h.context.devicePixelRatio = 3;
  h.controller.update(wasteland, wasteland.spawn, true, 250);
  assert.equal(h.map.canvas.width, 360); assert.equal(h.map.canvas.height, 360);
  for (let i = 0; i < 50; i++) h.controller.update(wasteland, { x: i * 1000, y: i * 500 }, true, 300 + i * 50);
  assert.equal(h.atlasCanvases.length, 0, 'Crossing the full world never accumulates terrain canvases');
  assert.equal(h.map.stack.length, 0);
});

test('invalid Wasteland path points break roads rather than drawing false connections', () => {
  const h = harness(), world = { key: 'wasteland', w: 10000, h: 10000, exit: null,
    paths: [{ width: 160, points: [{ x: 100, y: 100 }, { x: 300, y: 100 },
      { x: NaN, y: 100 }, { x: 900, y: 100 }, { x: 1100, y: 100 }] },
    { width: Infinity, points: [{ x: 100, y: 100 }, { x: 1000, y: 100 }] }] };
  h.controller.update(world, { x: 600, y: 100 }, true, 0);
  const strokes = h.map.ops.filter(op => op.op === 'stroke' && op.width === 160);
  assert.deepEqual(strokes.map(op => op.path), [[[100, 100], [300, 100]], [[900, 100], [1100, 100]]]);
});

test('City-to-Wasteland switching removes City tooltips and never reveals dungeon destinations', () => {
  const h = harness();
  h.controller.update(city, city.spawn, true, 0);
  const well = h.api.markers(city, city.spawn).find(p => p.type === 'well');
  const hover = p => h.map.listeners.get('pointermove')({ clientX: 200 + p.x * 150 / 180, clientY: 30 + p.y * 150 / 180 });
  hover(well); assert.match(h.tip.textContent, /^Well/);
  const privateWorld = { ...wasteland };
  for (const name of ['entrances', 'solids', 'travelDoors', 'bossRooms', 'enemySpawns']) {
    Object.defineProperty(privateWorld, name, { get() { throw new Error('Renderer read ' + name); } });
  }
  for (const [index, entrance] of wasteland.entrances.entries()) {
    h.controller.update(privateWorld, entrance, true, 50 + index * 50);
    assert.match(h.el.getAttribute('aria-label'), /^Wasteland minimap/);
    assert.equal(h.title.textContent, 'WASTELAND');
    assert.doesNotMatch(h.el.getAttribute('aria-label'), /briar|cinder|frost|dungeon|church|enchant/i);
    hover({ x: 90, y: 90 }); assert.match(h.tip.textContent, /^You/);
    const home = h.api.markers(privateWorld, entrance)[0]; hover(home);
    assert.match(h.tip.textContent, /^Home/);
    for (let y = 0; y <= 180; y += 15) for (let x = 0; x <= 180; x += 15) {
      hover({ x, y }); assert.match(h.tip.textContent, /^(You|Home)/);
    }
  }
  h.controller.update({ ...wasteland, dungeon: 'frostveil' }, wasteland.spawn, true, 210);
  assert.equal(h.el.hidden, true); assert.match(h.tip.textContent, /^You/);
  h.controller.update(city, city.spawn, true, 220);
  assert.equal(h.el.hidden, false); assert.match(h.el.getAttribute('aria-label'), /^City minimap/);
  assert.equal(h.title.textContent, 'CITY');
  hover(well); assert.match(h.tip.textContent, /^Well/);
});

test('snow and desert maps use their biome colors, edge roads and actual Wasteland return borders', () => {
  const h = harness();
  for (const [index, fixture] of [
    {key:'wasteland-snow', name:'Frostwild', spawn:{x:28500,y:25700}, point:{x:28500,y:26000}, color:'#bacdd1'},
    {key:'wasteland-desert', name:'Sundrift', spawn:{x:300,y:18000}, point:{x:0,y:18000}, color:'#bda06b'},
  ].entries()) {
    const road={width:180,points:[fixture.point,fixture.spawn,{x:fixture.spawn.x+500,y:fixture.spawn.y-500}]};
    const world={...fixture,w:50400,h:26000,paths:[],edgePaths:[road],exit:null};
    for(const name of ['solids','entrances','enemySpawns','travelDoors','bossRooms'])Object.defineProperty(world,name,{get(){throw new Error('Minimap read hidden '+name);}});
    const markers=h.api.markers(world,fixture.spawn);assert.equal(markers.length,1);
    assert.equal(markers[0].name,'Wasteland');assert.equal(markers[0].type,'wastelandreturn');
    close(markers[0].distance,300);close(markers[0].angle,Math.atan2(fixture.point.y-fixture.spawn.y,fixture.point.x-fixture.spawn.x));
    const start=h.map.ops.length;h.controller.update(world,fixture.spawn,true,index*50);
    assert.equal(h.el.hidden,false);assert.equal(h.title.textContent,fixture.name.toUpperCase());
    assert.match(h.el.getAttribute('aria-label'),/way back to Wasteland/);assert.doesNotMatch(h.el.getAttribute('aria-label'),/Home|portal|dungeon/);
    const ops=h.map.ops.slice(start);assert.ok(ops.some(o=>o.op==='fillRect'&&o.fillStyle===fixture.color));
    assert.ok(ops.some(o=>o.op==='stroke'&&o.width===180&&JSON.stringify(o.path)===JSON.stringify(road.points.map(p=>[p.x,p.y]))));
    assert.equal(h.atlasCanvases.length,0);assert.equal(h.map.stack.length,0);
    h.map.listeners.get('pointermove')({clientX:200+markers[0].x*150/180,clientY:30+markers[0].y*150/180});assert.match(h.tip.textContent,/^Wasteland/);
  }
});

test('biome maps do not invent a Home portal and dungeon variants remain hidden', () => {
  const h=harness();
  for(const key of ['wasteland-snow','wasteland-desert']){
    const world={key,w:50400,h:26000,paths:[],exit:{x:1000,y:1000},spawn:null};
    assert.equal(h.api.markers(world,{x:1000,y:1000}).length,0,'no fake Home icon from an unrelated exit');
    for(const dungeon of ['briarhollow','cindervein','frostveil']){
      const indoor={...world,dungeon,spawn:{x:300,y:1000}};assert.equal(h.api.markers(indoor,indoor.spawn).length,0);
      h.controller.update(indoor,indoor.spawn,true,0);assert.equal(h.el.hidden,true);
    }
  }
});

test('the actual frame hook updates visibility in City, pause, other zones and character menus', () => {
  const calls = [];
  const context = vm.createContext({ lastT: 0, fpsN: 0, fpsT: 0, frameDt: 0, saveT: 0,
    gameOn: true, gamePaused: false, S: { zone: 1 }, ZONES: [{ city: false }, { city: true }, { wasteland: true }, { wasteland: true, dungeon: 'briarhollow' }],
    world: city, hero: city.spawn, cityMinimap: { update(...args) { calls.push(args); } },
    update() {}, renderVitals() {}, draw() {}, save() {}, requestAnimationFrame() {}, $: () => null,
    TideUI: { afterDraw() {} },
    ctx: { fillRect() {}, fillText() {} }, VW: 800, VH: 600,
    document: { body: {} }, getComputedStyle: () => ({ fontFamily: 'serif' }),
  });
  vm.runInContext(section('function frame(t){', '\nresize();'), context);
  context.frame(0); assert.equal(calls.at(-1)[2], true);
  context.gamePaused = true; context.frame(20); assert.equal(calls.at(-1)[2], true);
  context.S.zone = 0; context.frame(40); assert.equal(!!calls.at(-1)[2], false);
  context.S.zone = 2; context.frame(45); assert.equal(!!calls.at(-1)[2], true, 'Wasteland shares the round minimap');
  context.S.zone = 3; context.frame(50); assert.equal(!!calls.at(-1)[2], false, 'Dungeons do not enable the round minimap');
  context.S.zone = 1; context.gameOn = false; context.frame(60);
  assert.equal(!!calls.at(-1)[2], false, 'Character menus must hide a leftover City map');
  context.S = null; context.frame(80); assert.equal(!!calls.at(-1)[2], false);
  assert.equal(calls.length, 7, 'Visibility updates even when the game draw is not running');
});
