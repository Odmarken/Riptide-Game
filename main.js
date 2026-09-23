/* Electron shell for Riptide RPG.
   The game itself is untouched browser code - this file only opens a window and points Chromium at
   index.html. Everything that made the web build work still works here, because Electron ships its
   own Chromium rather than borrowing the system webview. */
const {app, BrowserWindow, shell, ipcMain, Menu} = require('electron');
const path = require('path');
const fs = require('fs');

/* Developer mode. False in anything a player receives, which is what closes the console: Electron's
   own menu is hidden by autoHideMenuBar but its accelerators still fire, so Ctrl+Shift+I opened
   DevTools straight onto a game whose whole state is a global object. The flag is an escape hatch
   for the built exe - some faults only appear once packaged, and without it there is no way to look
   at them. It is not a secret worth keeping: anyone who could abuse it could unpack the archive
   instead. It just is not one keypress away. */
const DEV = !app.isPackaged || process.argv.includes('--riptide-dev');
if (!DEV) Menu.setApplicationMenu(null);

/* With the console shut, a player who hits a bug has no way to read the error and no way to tell us
   what it said. So errors go to a file next to the settings instead - both the shell's own and the
   ones the page throws. Trimmed when it gets long, because nobody should acquire a log file that
   grows for a year. */
const LOG = path.join(app.getPath('userData'), 'error.log');
function logErr(where, msg) {
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1048576) fs.writeFileSync(LOG, '');
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${where}: ${msg}` + '\n');
  } catch (e) {}
}
process.on('uncaughtException', e => logErr('main', (e && e.stack) || e));

/* Player settings that the shell owns rather than the save file, because they decide how the window
   is created. Kept in userData rather than beside the exe: a Steam install directory is not
   writable, and these have to survive an update.
   Defaults are the ones a first-time player should get - vsync on, fullscreen. */
const CFG = path.join(app.getPath('userData'), 'settings.json');
const readCfg = () => {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) {}
  return {vsync: raw.vsync !== false, windowed: !!raw.windowed,
          resW: raw.resW | 0, resH: raw.resH | 0};
};
const writeCfg = patch => {
  try { fs.writeFileSync(CFG, JSON.stringify(Object.assign(readCfg(), patch), null, 2)); return true; }
  catch (e) { return false; }
};
const cfg = readCfg();

/* Vsync can only be turned off from the command line, before Electron starts - there is no runtime
   switch. So the checkbox records the choice and the next launch acts on it. Left on, frames are
   paced to the monitor's refresh rate, whatever that is. */
if (!cfg.vsync) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

/* Electron sizes windows in DIP, not physical pixels. Keep saved resW/resH in DIP so existing
   window preferences survive, but show physical resolutions to the player. Fullscreen includes
   the taskbar area; only a window is limited to the work area of its current display. */
const RES_CANDIDATES=[[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440],[3840,2160]];
function currentDisplay(){
 const {screen}=require('electron');
 return win&&!win.isDestroyed()?screen.getDisplayMatching(win.getBounds()):screen.getPrimaryDisplay();
}
function displayPixels(d){
 return {w:Math.round(d.bounds.width*d.scaleFactor),h:Math.round(d.bounds.height*d.scaleFactor)};
}
function windowSize(c=readCfg(),d=currentDisplay()){
 const a=d.workArea;
 return {w:Math.min(a.width,Math.max(960,c.resW>0?c.resW:a.width)),
         h:Math.min(a.height,Math.max(600,c.resH>0?c.resH:a.height))};
}
function resolutionState(){
 const d=currentDisplay(),s=displayPixels(d),c=readCfg();
 const list=[{w:s.w,h:s.h,label:'Match screen ('+s.w+' x '+s.h+')',native:true}];
 for(const [w,h] of RES_CANDIDATES){
  const W=Math.round(w/d.scaleFactor),H=Math.round(h/d.scaleFactor);
  if(W>=960&&H>=600&&W<=d.workArea.width&&H<=d.workArea.height)
   list.push({w:W,h:H,label:w+' x '+h,native:false});
 }
 const chosen=c.resW>0&&c.resH>0?windowSize(c,d):null;
 if(chosen&&!list.some(o=>!o.native&&o.w===chosen.w&&o.h===chosen.h))
  list.push({...chosen,label:Math.round(chosen.w*d.scaleFactor)+' x '+Math.round(chosen.h*d.scaleFactor)+' (window)',native:false});
 return {list,chosen,display:s,fullscreen:!!(win&&!win.isDestroyed()&&win.isFullScreen())};
}
function applyWindowSize(){
 if(!win||win.isDestroyed()||win.isFullScreen())return;
 const d=currentDisplay(),s=windowSize(readCfg(),d),a=d.workArea;
 win.setMinimumSize(Math.min(960,a.width),Math.min(600,a.height));
 win.setBounds({x:a.x+Math.round((a.width-s.w)/2),y:a.y+Math.round((a.height-s.h)/2),width:s.w,height:s.h});
}
function notifyDisplayChanged(){
 if(win&&!win.isDestroyed())win.webContents.send('display-changed',resolutionState());
}
ipcMain.handle('res:list', () => resolutionState());
ipcMain.handle('res:set', (_e,w,h) => {
 const d=currentDisplay();
 const native=(!w||!h);
 const s=windowSize(native?{resW:0,resH:0}:{resW:w|0,resH:h|0},d);
 writeCfg(native?{resW:0,resH:0}:{resW:s.w,resH:s.h});
 applyWindowSize();
 notifyDisplayChanged();
 return {w:Math.round(s.w*d.scaleFactor),h:Math.round(s.h*d.scaleFactor),fullscreen:!!(win&&!win.isDestroyed()&&win.isFullScreen())};
});
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('settings:get', () => readCfg());
ipcMain.handle('settings:vsync', (_e, v) => writeCfg({vsync: !!v}));
ipcMain.handle('settings:windowed', (_e, v) => {
  /* unlike vsync this one applies immediately - no reason to make the player restart to see it */
  const ok = writeCfg({windowed: !!v});
  if (win && !win.isDestroyed()) {
    /* The fullscreen transition is asynchronous and takes a few hundred ms on Windows. Calling it
       again mid-flight gets swallowed, and asking for a state the window is already in fires no
       event at all - both leave the tick showing something the window is not. So: only call when
       there is a change to make, and either way report the REAL state back once things settle. */
    if (win.isFullScreen() !== !v) win.setFullScreen(!v);
    setTimeout(() => {   /* safety net: by now the transition has settled, so this read is trustworthy */
      if (!win || win.isDestroyed()) return;
      const windowed = !win.isFullScreen();
      writeCfg({windowed});
      win.webContents.send('windowed-changed', windowed);
    }, 700);
  }
  return ok;
});

/* The ambient tracks start themselves. Chromium blocks that until the user has clicked something,
   which in a desktop build just means silence until the first click - there is no browser tab the
   player consented to, so the policy protects nobody here. */
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win;

function createWindow() {
  const sz = windowSize();   /* the screen, unless the player has chosen a size */
  win = new BrowserWindow({
    width: sz.w,
    height: sz.h,
    minWidth: Math.min(960,sz.w),
    minHeight: Math.min(600,sz.h),
    backgroundColor: '#1a120b',   /* painted before the page loads, so no white flash on launch */
    autoHideMenuBar: true,
    show: false,
    fullscreen: !cfg.windowed,
    webPreferences: {
      contextIsolation: true,     /* the game needs no Node access - keep the renderer sandboxed */
      nodeIntegration: false,
      /* Combat, online presence and chest reels share the renderer's timers/animation loop.
         Keep that loop alive after Alt+Tab or minimize; only the game's own pause should stop it. */
      backgroundThrottling: false,
      devTools: DEV,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile('index.html');

  /* Anything aiming at a new window (an external link, a payment page) goes to the real browser.
     Left alone, Electron opens a bare chrome-less window the player cannot navigate or close. */
  win.webContents.setWindowOpenHandler(({url}) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return {action: 'deny'};
  });

  /* Whatever the page prints as an error lands in the log, so a player can send the file rather
     than describe a stack trace they cannot see. Electron 33 reports this as loose arguments;
     later versions pass one object. Read both, so an upgrade does not quietly stop logging. */
  win.webContents.on('console-message', (...a) => {
    const d = (a[1] && typeof a[1] === 'object')
      ? a[1] : {level: a[1], message: a[2], lineNumber: a[3], sourceId: a[4]};
    if (d.level === 3 || d.level === 'error') logErr('page', `${d.message} (${d.sourceId}:${d.lineNumber})`);
  });
  /* A crashed page used to leave the window blank until the player quit and started again. It is reloaded instead - the
     saves are on disk - but only a few times in a row, so a page that dies at start cannot spin for ever. */
  let crashes = [];
  win.webContents.on('render-process-gone', (_e, d) => {
    const reason = d && d.reason;
    logErr('renderer', reason);
    if (reason === 'clean-exit' || !win || win.isDestroyed()) return;
    const now = Date.now();
    crashes = crashes.filter(t => now - t < 300000).concat(now);
    if (crashes.length > 3) { logErr('renderer', 'crashed ' + crashes.length + ' times in five minutes - not reloading again'); return; }
    setTimeout(() => { try { if (win && !win.isDestroyed()) win.reload(); } catch (e) { logErr('renderer', 'reload failed: ' + e); } }, 1000);
  });

  /* F11 fullscreen, the convention players expect from a desktop game. Everything else here is the
     browser showing through where it should not: DevTools, and a reload that throws away whatever
     happened since the last autosave. Menu.setApplicationMenu(null) already took the menu's
     accelerators, but Chromium carries its own bindings for these, so they are stopped at the key
     rather than at the menu. */
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = (input.key || '').toLowerCase();
    if (k === 'f11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
      return;
    }
    if (DEV) return;
    const devKeys = (input.control && input.shift && (k === 'i' || k === 'j' || k === 'c')) || k === 'f12';
    const reload = (input.control && k === 'r') || k === 'f5';
    if (devKeys || reload) e.preventDefault();
  });

  /* F11 changes the window behind the settings panel's back. Persist what actually happened and
     tell the page, so the Windowed tick never disagrees with the window the player is looking at.
     The value comes from WHICH event fired, not from asking isFullScreen(): the events arrive
     before that flag flips, so reading it here wrote the previous state back every single time and
     left the saved file inverted - the window and the tick agreed, and the next launch disagreed
     with both. */
  const sync = windowed => {
    writeCfg({windowed});
    if (!win.isDestroyed()) win.webContents.send('windowed-changed', windowed);
    setImmediate(() => {
      if(windowed)applyWindowSize();
      notifyDisplayChanged();
    });
  };
  win.on('enter-full-screen', () => sync(false));
  win.on('leave-full-screen', () => sync(true));
  /* Moving between monitors or changing Windows scaling must refresh an already open menu too. */
  let displayKey='';
  const refreshDisplay=()=>{
    if(win.isDestroyed())return;
    const d=currentDisplay(),key=JSON.stringify([d.id,d.bounds,d.workArea,d.scaleFactor]);
    if(key===displayKey)return;
    displayKey=key;
    notifyDisplayChanged();
  };
  const {screen}=require('electron');
  win.on('move',refreshDisplay);
  screen.on('display-metrics-changed',refreshDisplay);
  screen.on('display-added',refreshDisplay);
  screen.on('display-removed',refreshDisplay);
  win.on('closed',()=>{
    screen.removeListener('display-metrics-changed',refreshDisplay);
    screen.removeListener('display-added',refreshDisplay);
    screen.removeListener('display-removed',refreshDisplay);
  });
}

/* One copy of the game at a time. Two share one profile - one localStorage, one set of heroes on this device - and each
   would write its own idea of a hero over the other's. A second launch brings the running window forward instead. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  });
  app.whenReady().then(createWindow);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
