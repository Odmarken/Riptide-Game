const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const display4k = () => ({
  id: 1, scaleFactor: 1.5,
  bounds: {x: 0, y: 0, width: 2560, height: 1440},
  workArea: {x: 0, y: 0, width: 2560, height: 1392},
});
const displayLeft = () => ({
  id: 2, scaleFactor: 1,
  bounds: {x: -1920, y: 0, width: 1920, height: 1080},
  workArea: {x: -1920, y: 0, width: 1920, height: 1040},
});

// Execute the real shell and its registered IPC/event handlers, with no Electron process or
// writes to the player's profile. Timers are explicit so fullscreen's old flag can be tested.
function shellHarness({settings = {}, displays = [display4k()], rawSettings} = {}) {
  let stored = rawSettings === undefined ? JSON.stringify(settings) : rawSettings;
  const writes = [], sent = [], windows = [], immediate = [], delayed = [];
  const handlers = new Map();
  let ready;
  const app = new EventEmitter();
  Object.assign(app, {
    isPackaged: true,
    getPath: () => path.join(root, 'dist', '.resolution-test-profile'),
    commandLine: {appendSwitch() {}},
    whenReady: () => ({then(callback) { ready = callback; }}),
    requestSingleInstanceLock: () => true,   /* the only copy running */
    quit() {},
  });
  const screen = new EventEmitter();
  screen.getPrimaryDisplay = () => displays[0];
  screen.getDisplayMatching = bounds => {
    const overlap = d => Math.max(0, Math.min(bounds.x + bounds.width,
      d.bounds.x + d.bounds.width) - Math.max(bounds.x, d.bounds.x)) *
      Math.max(0, Math.min(bounds.y + bounds.height, d.bounds.y + d.bounds.height) -
        Math.max(bounds.y, d.bounds.y));
    return displays.reduce((best, d) => overlap(d) > overlap(best) ? d : best);
  };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = plain(options);
      this.bounds = {x: displays[0].workArea.x, y: displays[0].workArea.y,
        width: options.width, height: options.height};
      this.fullscreen = options.fullscreen;
      this.destroyed = false;
      this.boundsCalls = [];
      this.fullscreenCalls = [];
      this.webContents = new EventEmitter();
      this.webContents.send = (channel, value) => sent.push({channel, value: plain(value)});
      this.webContents.setWindowOpenHandler = () => {};
      windows.push(this);
    }
    getBounds() { return {...this.bounds}; }
    isDestroyed() { return this.destroyed; }
    isFullScreen() { return this.fullscreen; }
    setFullScreen(value) { this.fullscreenCalls.push(value); }
    setBounds(bounds) { this.bounds = plain(bounds); this.boundsCalls.push(plain(bounds)); }
    setMinimumSize(w, h) { this.minimum = [w, h]; }
    loadFile() {}
    show() {}
    static getAllWindows() { return windows.filter(w => !w.destroyed); }
  }
  const electron = {app, screen, BrowserWindow, shell: {openExternal() {}},
    Menu: {setApplicationMenu() {}}, ipcMain: {handle(name, callback) { handlers.set(name, callback); }}};
  const memoryFs = {
    readFileSync(file) {
      assert.equal(path.basename(file), 'settings.json');
      return stored;
    },
    writeFileSync(file, value) {
      assert.equal(path.basename(file), 'settings.json');
      stored = String(value);
      writes.push(JSON.parse(stored));
    },
    existsSync: () => false,
    appendFileSync() {},
  };
  vm.runInNewContext(mainSource, {
    __dirname: root,
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'path') return path;
      if (name === 'fs') return memoryFs;
      throw new Error('Unexpected main.js dependency: ' + name);
    },
    process: {argv: [], platform: 'win32', on() {}},
    setImmediate(callback) { immediate.push(callback); },
    setTimeout(callback, ms) { delayed.push({callback, ms}); },
  }, {filename: 'main.js'});
  ready();
  return {
    window: windows[0], screen, sent, writes, displays,
    invoke(name, ...args) {
      assert.ok(handlers.has(name), 'Actual IPC handler exists: ' + name);
      return plain(handlers.get(name)({}, ...args));
    },
    settings: () => JSON.parse(stored),
    flushImmediate() { while (immediate.length) immediate.shift()(); },
    flushTimeouts(ms) {
      for (const timer of delayed.splice(0)) {
        assert.equal(timer.ms, ms);
        timer.callback();
      }
    },
    move(bounds) {
      Object.assign(windows[0].bounds, bounds);
      windows[0].emit('move');
    },
  };
}

test('4K at 150% reports full physical display and filters presets in DIP', () => {
  const h = shellHarness();
  const state = h.invoke('res:list');
  assert.deepEqual(state.display, {w: 3840, h: 2160});
  assert.deepEqual(state.list[0], {w: 3840, h: 2160,
    label: 'Match screen (3840 x 2160)', native: true});
  assert.equal(state.chosen, null);
  assert.equal(state.fullscreen, true);
  assert.deepEqual(state.list.slice(1), [
    {w: 1067, h: 600, label: '1600 x 900', native: false},
    {w: 1280, h: 720, label: '1920 x 1080', native: false},
    {w: 1707, h: 960, label: '2560 x 1440', native: false},
  ]);
  assert.equal(h.window.options.width, 2560);
  assert.equal(h.window.options.height, 1392);
});

test('selecting a physical preset persists DIP, centers it, and returns rounded physical size', () => {
  const h = shellHarness({settings: {windowed: true}});
  const option = h.invoke('res:list').list.find(o => o.label === '1600 x 900');
  assert.deepEqual(h.invoke('res:set', option.w, option.h), {w: 1601, h: 900, fullscreen: false});
  assert.deepEqual(h.settings(), {vsync: true, windowed: true, resW: 1067, resH: 600});
  assert.deepEqual(h.window.bounds, {x: 747, y: 396, width: 1067, height: 600});
  assert.deepEqual(h.window.minimum, [960, 600]);
  assert.deepEqual(h.invoke('res:list').chosen, {w: 1067, h: 600});
  assert.equal(h.invoke('res:list').list.filter(o => o.w === 1067 && o.h === 600).length, 1);
});

test('window on a secondary monitor uses its DPI, negative origin, and work area', () => {
  const h = shellHarness({settings: {windowed: true}, displays: [display4k(), displayLeft()]});
  h.move({x: -1800, y: 100, width: 1000, height: 700});
  assert.deepEqual(h.invoke('res:list').display, {w: 1920, h: 1080});
  assert.deepEqual(h.sent.at(-1).value.display, {w: 1920, h: 1080});
  assert.deepEqual(h.invoke('res:set', 1280, 720), {w: 1280, h: 720, fullscreen: false});
  assert.deepEqual(h.window.bounds, {x: -1600, y: 160, width: 1280, height: 720});
  assert.equal(h.invoke('res:list').list.some(o => o.label === '1920 x 1080' && !o.native), false);
});

test('legacy DIP window settings survive listing and restart with a selectable custom option', () => {
  const settings = {vsync: false, windowed: true, resW: 1201, resH: 777};
  const h = shellHarness({settings});
  const state = h.invoke('res:list');
  assert.deepEqual(state.chosen, {w: 1201, h: 777});
  assert.deepEqual(state.list.at(-1), {w: 1201, h: 777, label: '1802 x 1166 (window)', native: false});
  assert.deepEqual(h.settings(), settings);
  assert.equal(h.writes.length, 0);
  const restarted = shellHarness({settings: h.settings()});
  assert.equal(restarted.window.options.width, 1201);
  assert.equal(restarted.window.options.height, 777);
  assert.deepEqual(restarted.invoke('res:list').chosen, state.chosen);
});

test('fullscreen resolution selection waits for exit to settle before applying saved window size', () => {
  const h = shellHarness();
  assert.deepEqual(h.invoke('res:set', 1280, 720), {w: 1920, h: 1080, fullscreen: true});
  assert.equal(h.window.boundsCalls.length, 0);
  assert.equal(h.settings().resW, 1280);
  h.window.emit('leave-full-screen'); // Electron can still report its previous flag here.
  assert.equal(h.window.isFullScreen(), true);
  assert.equal(h.settings().windowed, true);
  assert.equal(h.window.boundsCalls.length, 0);
  h.window.fullscreen = false;
  h.flushImmediate();
  assert.deepEqual(h.window.bounds, {x: 640, y: 336, width: 1280, height: 720});
  assert.equal(h.sent.at(-1).channel, 'display-changed');
  assert.equal(h.sent.at(-1).value.fullscreen, false);
  assert.deepEqual(h.sent.at(-1).value.chosen, {w: 1280, h: 720});
});

test('Match screen clears a saved preference and restores work-area sizing on fullscreen exit', () => {
  const h = shellHarness({settings: {resW: 1200, resH: 700}});
  assert.deepEqual(h.invoke('res:set', 0, 0), {w: 3840, h: 2088, fullscreen: true});
  assert.equal(h.settings().resW, 0);
  assert.equal(h.settings().resH, 0);
  assert.equal(h.invoke('res:list').chosen, null);
  assert.deepEqual(h.invoke('res:list').display, {w: 3840, h: 2160});
  h.window.emit('leave-full-screen');
  h.window.fullscreen = false;
  h.flushImmediate();
  assert.deepEqual(h.window.bounds, {x: 0, y: 0, width: 2560, height: 1392});
});

test('F11 and windowed IPC synchronize actual fullscreen state and restored dimensions', () => {
  const h = shellHarness({settings: {windowed: true, resW: 1100, resH: 700}});
  let prevented = false;
  h.window.webContents.emit('before-input-event', {preventDefault() { prevented = true; }},
    {type: 'keyDown', key: 'F11'});
  assert.equal(prevented, true);
  assert.deepEqual(h.window.fullscreenCalls, [true]);
  h.window.emit('enter-full-screen');
  assert.equal(h.settings().windowed, false);
  h.window.fullscreen = true;
  h.flushImmediate();
  assert.equal(h.sent.at(-1).value.fullscreen, true);
  assert.equal(h.invoke('settings:windowed', true), true);
  assert.deepEqual(h.window.fullscreenCalls, [true, false]);
  h.window.emit('leave-full-screen');
  h.window.fullscreen = false;
  h.flushImmediate();
  h.flushTimeouts(700);
  assert.deepEqual(h.window.bounds, {x: 730, y: 346, width: 1100, height: 700});
  assert.deepEqual(h.sent.at(-1), {channel: 'windowed-changed', value: true});
  h.invoke('settings:windowed', true);
  assert.deepEqual(h.window.fullscreenCalls, [true, false], 'No repeated OS transition for the current state');
  h.flushTimeouts(700);
});

test('monitor scale and work-area changes refresh open resolution UI and clean up listeners', () => {
  const h = shellHarness({settings: {windowed: true}, displays: [display4k(), displayLeft()]});
  h.move({x: -1800, y: 100, width: 1000, height: 700});
  const firstCount = h.sent.length;
  h.window.emit('move');
  h.screen.emit('display-metrics-changed', {}, h.displays[1], ['scaleFactor']);
  assert.equal(h.sent.length, firstCount, 'Unchanged monitor data does not resend');
  h.displays[1].scaleFactor = 2;
  h.screen.emit('display-metrics-changed', {}, h.displays[1], ['scaleFactor']);
  assert.equal(h.sent.length, firstCount + 1);
  assert.deepEqual(h.sent.at(-1).value.display, {w: 3840, h: 2160});
  assert.deepEqual(h.sent.at(-1).value.list.filter(o => !o.native), [
    {w: 1280, h: 720, label: '2560 x 1440', native: false},
  ]);
  h.displays[1].workArea.height = 600;
  h.screen.emit('display-metrics-changed', {}, h.displays[1], ['workArea']);
  assert.equal(h.sent.at(-1).value.list.length, 1);
  h.displays.splice(1, 1);
  h.screen.emit('display-removed', {}, displayLeft());
  assert.deepEqual(h.sent.at(-1).value.display, {w: 3840, h: 2160});
  assert.equal(h.sent.at(-1).value.list.length, 4, 'Removal selects the remaining display');
  h.displays.push(displayLeft());
  h.screen.emit('display-added', {}, h.displays[1]);
  assert.deepEqual(h.sent.at(-1).value.display, {w: 1920, h: 1080});
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed'])
    assert.equal(h.screen.listenerCount(event), 1);
  h.window.destroyed = true;
  h.window.emit('closed');
  for (const event of ['display-metrics-changed', 'display-added', 'display-removed'])
    assert.equal(h.screen.listenerCount(event), 0);
});

test('small displays and malformed numeric resolution requests stay inside the available work area', () => {
  const small = {id: 3, scaleFactor: 1, bounds: {x: -800, y: 100, width: 800, height: 600},
    workArea: {x: -800, y: 100, width: 800, height: 500}};
  const h = shellHarness({settings: {windowed: true}, displays: [small]});
  assert.equal(h.window.options.minWidth, 800);
  assert.equal(h.window.options.minHeight, 500);
  for (const [w, height] of [[1, 1], [999999, 999999], [-1, -20], [NaN, NaN], [Infinity, Infinity]]) {
    assert.deepEqual(h.invoke('res:set', w, height), {w: 800, h: 500, fullscreen: false});
    assert.deepEqual(h.window.bounds, {x: -800, y: 100, width: 800, height: 500});
    assert.deepEqual(h.window.minimum, [800, 500]);
  }
  const malformed = shellHarness({rawSettings: '{invalid json'});
  assert.equal(malformed.invoke('res:list').chosen, null);
  assert.equal(malformed.invoke('res:list').fullscreen, true);
});
