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

/* Resolution. The default is always the screen itself - a fresh install should fill the display the
   player actually has, not a size we guessed - and a stored size only ever exists because they chose
   one. Candidates are filtered against the work area, so the list never offers a window that would
   not fit. It applies to the windowed size; in fullscreen the display decides and this is what you
   drop back into. */
const RES_CANDIDATES=[[1280,720],[1366,768],[1600,900],[1920,1080],[2560,1440],[3840,2160]];
function screenSize(){
 const {screen}=require('electron');
 const d=screen.getPrimaryDisplay();
 return {w:d.workAreaSize.width,h:d.workAreaSize.height};
}
function resolutionList(){
 const s=screenSize();
 const out=[{w:s.w,h:s.h,label:'Match screen ('+s.w+' x '+s.h+')',native:true}];
 for(const [w,h] of RES_CANDIDATES){
  if(w<=s.w&&h<=s.h&&!(w===s.w&&h===s.h))out.push({w,h,label:w+' x '+h,native:false});
 }
 return out;
}
function windowSize(){
 const c=readCfg(),s=screenSize();
 if(c.resW>0&&c.resH>0)return {w:Math.min(c.resW,s.w),h:Math.min(c.resH,s.h)};
 return s;   /* nothing chosen yet - match the screen */
}
ipcMain.handle('res:list', () => {
 const c=readCfg();
 return {list:resolutionList(), chosen:(c.resW>0&&c.resH>0)?{w:c.resW,h:c.resH}:null};
});
ipcMain.handle('res:set', (_e,w,h) => {
 const s=screenSize();
 const native=(!w||!h);
 const W=native?s.w:Math.min(w|0,s.w),H=native?s.h:Math.min(h|0,s.h);
 writeCfg(native?{resW:0,resH:0}:{resW:W,resH:H});
 if(win&&!win.isDestroyed()){
  /* only resize a window that is actually a window - in fullscreen this would be ignored anyway,
     and the size is stored so it is waiting when they come out of it */
  if(!win.isFullScreen()){win.setSize(W,H);win.center();}
 }
 return {w:W,h:H,fullscreen:!!(win&&!win.isDestroyed()&&win.isFullScreen())};
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
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#1a120b',   /* painted before the page loads, so no white flash on launch */
    autoHideMenuBar: true,
    show: false,
    fullscreen: !cfg.windowed,    /* fullscreen unless the player asked for a window - the 1280x800
                                     above is what they drop into the moment they untick it */
    webPreferences: {
      contextIsolation: true,     /* the game needs no Node access - keep the renderer sandboxed */
      nodeIntegration: false,
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
  win.webContents.on('render-process-gone', (_e, d) => logErr('renderer', d && d.reason));

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
  };
  win.on('enter-full-screen', () => sync(false));
  win.on('leave-full-screen', () => sync(true));
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
