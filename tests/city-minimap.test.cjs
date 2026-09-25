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
    section('const CITY_NAMES=', '/* 🧱 The floor of the City') + rng[0], context);
  vm.runInContext('buildCity(mulberry32(13));', context);
  return context.world;
}
const city = realCity();
const wasteland = require('../assets/wasteland/world.js').create();
const placeTypes = ['altarportal', 'cathedral', 'enchanthall', 'harborstair', 'minehall', 'palacestair', 'smelter', 'well'];

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
  assert.ok(city.streets.length > 40 && new Set(city.solids.filter(s => s.type === 'cityhouse').map(s => s.key)).size === 7,
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

test('Wasteland exposes Home, Torsten and training while never reading dungeon metadata', () => {
  const { api } = harness(), world = { ...wasteland };
  for (const name of ['entrances', 'travelDoors', 'enemySpawns', 'bossRooms', 'solids']) {
    Object.defineProperty(world, name, { get() { throw new Error('Minimap read private metadata: ' + name); } });
  }
  for (const hero of [wasteland.spawn, ...wasteland.entrances, { x: wasteland.w, y: 0 }]) {
    const places = api.markers(world, hero);
    assert.equal(places.length, 3);
    assert.deepEqual(Array.from(places,p=>p.type).sort(),['homeportal','stable','training']);
    const home = places.find(p=>p.type==='homeportal');
    assert.equal(home.type, 'homeportal'); assert.equal(home.name, 'Home');
    close(home.distance, Math.hypot(world.exit.x - hero.x, world.exit.y - hero.y));
    close(home.angle, Math.atan2(world.exit.y - hero.y, world.exit.x - hero.x));
    if (home.far) close(Math.hypot(home.x - 90, home.y - 90), 72);
    assert.doesNotMatch(JSON.stringify(places), /briar|cinder|frost|dungeon|cathedral|enchant/i);
  }
  assert.equal(api.markers({ ...wasteland, exit: null }, wasteland.spawn).length, 2);
  assert.equal(api.markers({ ...wasteland, exit: { x: NaN, y: 0 } }, wasteland.spawn).length, 2);
  assert.equal(api.markers({ ...wasteland, dungeon: 'briarhollow' }, wasteland.spawn).length, 0);
});

test('Wasteland roads preserve their real polylines and widths with sharp local vector rendering', () => {
  const h = harness();
  assert.equal(wasteland.w, 100800); assert.equal(wasteland.h, 52000);
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
  const afterRoads=wasteland.paths.length*50+50;
  h.controller.update(wasteland, wasteland.spawn, true, afterRoads);
  assert.equal(h.map.canvas.width, 360); assert.equal(h.map.canvas.height, 360);
  for (let i = 0; i < 50; i++) h.controller.update(wasteland, { x: i * 1000, y: i * 500 }, true, afterRoads+50+i*50);
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
      hover({ x, y }); assert.match(h.tip.textContent, /^(You|Home|Torsten Tygel|Tide Training Grounds)/);
    }
  }
  h.controller.update({ ...wasteland, dungeon: 'frostveil' }, wasteland.spawn, true, 210);
  assert.equal(h.el.hidden, true); assert.match(h.tip.textContent, /^You/);
  h.controller.update(city, city.spawn, true, 220);
  assert.equal(h.el.hidden, false); assert.match(h.el.getAttribute('aria-label'), /^City minimap/);
  assert.equal(h.title.textContent, 'CITY');
  hover(well); assert.match(h.tip.textContent, /^Well/);
});

test('one continuous minimap paints each biome and leaves the missing quadrant dark',()=>{
 const h=harness(),colors={grass:'#424632',snow:'#bacdd1',desert:'#bda06b'};
 for(const [index,r]of wasteland.regions.entries()){
  const hero={x:r.x+r.w/2,y:r.y+r.h/2},start=h.map.ops.length;
  h.controller.update(wasteland,hero,true,index*50);
  assert.equal(h.el.hidden,false);assert.equal(h.title.textContent,'WASTELAND');
  assert.match(h.el.getAttribute('aria-label'),/Torsten Tygel/);assert.match(h.el.getAttribute('aria-label'),/Tide Training Grounds/);
  const ops=h.map.ops.slice(start);
  assert.ok(ops.some(o=>o.op==='fillRect'&&o.fillStyle===colors[r.biome]&&JSON.stringify(o.args)===JSON.stringify([r.x,r.y,r.w,r.h])));
  assert.equal(h.atlasCanvases.length,0);assert.equal(h.map.stack.length,0);
 }
 const start=h.map.ops.length;h.controller.update(wasteland,{x:50400,y:26000},true,200);
 const ops=h.map.ops.slice(start),terrainColors=new Set(Object.values(colors));
 assert.equal(ops.filter(o=>o.op==='fillRect'&&terrainColors.has(o.fillStyle)).length,3,'the join shows all three real regions');
 assert.ok(!ops.some(o=>o.op==='fillRect'&&terrainColors.has(o.fillStyle)&&o.args[0]===50400&&o.args[1]===0),'the northeastern void is never filled with invented terrain');
});

test('Torsten and training markers use exact global service positions and stay readable along the rim',()=>{
 const h=harness(),venues=[['stable',wasteland.stable.vendor,/Torsten Tygel/],['training',wasteland.training.vendor,/Tide Training Grounds/]];
 for(const [type,position,name]of venues){
  const marker=h.api.markers(wasteland,position).find(p=>p.type===type);assert.match(marker.name,name);assert.equal(marker.far,false);close(marker.x,90);close(marker.y,90);
 }
 for(const hero of [{x:80,y:80},{x:50320,y:80},{x:100720,y:51920},wasteland.spawn]){
  const markers=h.api.markers(wasteland,hero);assert.equal(markers.length,3);
  for(let i=0;i<markers.length;i++)for(let j=0;j<i;j++)if(markers[i].far||markers[j].far)assert.ok(Math.hypot(markers[i].x-markers[j].x,markers[i].y-markers[j].y)>=23-1e-9);
 }
 const blank={key:'wasteland',unified:true,w:100800,h:52000,paths:[],regions:wasteland.regions,spawn:{x:28500,y:26000},exit:null};
 assert.equal(h.api.markers(blank,blank.spawn).length,0,'there are no artificial return markers at internal biome seams');
 for(const dungeon of ['briarhollow','cindervein','frostveil']){
  const indoor={...wasteland,dungeon};assert.equal(h.api.markers(indoor,wasteland.spawn).length,0);
  h.controller.update(indoor,wasteland.spawn,true,0);assert.equal(h.el.hidden,true);
 }
});

test('the actual frame hook updates visibility in City, pause, other zones and character menus', () => {
  const calls = [];
  const context = vm.createContext({ lastT: 0, fpsN: 0, fpsT: 0, frameDt: 0, saveT: 0,
    gameOn: true, gamePaused: false, S: { zone: 1 }, ZONES: [{ city: false }, { city: true }, { wasteland: true }, { wasteland: true, dungeon: 'briarhollow' }],
    world: city, hero: city.spawn, cityMinimap: { update(...args) { calls.push(args); } },
    update() {}, renderVitals() {}, draw() {}, save() {}, requestAnimationFrame() {}, $: () => null, padTick() {},
    voyage: null, voyageTick() {}, drawVoyage() {}, voyageLift() {},   /* ⛵ no crossing under way */
    TideUI: { afterDraw() {} }, HeroGuide: { isOpen: () => false },
    ctx: { fillRect() {}, fillText() {} }, VW: 800, VH: 600,
    document: { body: {} }, getComputedStyle: () => ({ fontFamily: 'serif' }),
  });
  vm.runInContext(section('function frame(t){', '\nconst sidebarResize='), context);
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

test('the ports of call and the Harbour have a minimap: Blackbeard, the King, the recruiter, the doors and the way home',()=>{
 const TW=require('../assets/city/town-world.js');
 for(const f of fs.readdirSync(path.join(root,'assets/city/towns')).filter(f=>f.endsWith('.js')))require('../assets/city/towns/'+f);
 const HW=require('../assets/city/harbor-world.js'),{api}=harness();
 for(const id of ['silverfjord','ravenholt','emberfall','meridian']){
  const w=TW.create(id),m=api.markers(w,w.arrival);
  assert.ok(m.some(p=>p.type==='voyage'&&/Blackbeard/.test(p.name)),id+': Blackbeard');
  assert.ok(m.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.name),id+': every marker placed and named');
 }
 assert.ok(api.markers(TW.create('silverfjord'),{x:9200,y:2300}).some(p=>p.type==='door'&&p.name==='The Palace'),'the palace door');
 const pm=TW.create('meridian');assert.ok(api.markers(pm,pm.arrival).some(p=>p.type==='recruiter'&&/Free Company/.test(p.name)),'the recruiter');
 const hw=HW.create(),hm=api.markers(hw,hw.spawn);
 assert.ok(hm.some(p=>p.type==='altarportal'&&p.name==='The City'),'the gate up to the City');
 assert.ok(hm.some(p=>p.type==='voyage')&&hm.some(p=>p.type==='harbourmaster'),'Blackbeard and the harbourmaster');
 assert.equal(api.markers(TW.create('sf_palace'),{x:1500,y:3000}).length,0,'no minimap marks inside a palace');
 assert.ok(game.includes('z?.city||z?.wasteland||z?.harbor||(z?.town&&!z?.interior)'),'shown in the Harbour and the ports, not in a palace');
});
