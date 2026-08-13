/* Electron shell for Riptide RPG.
   The game itself is untouched browser code - this file only opens a window and points Chromium at
   index.html. Everything that made the web build work still works here, because Electron ships its
   own Chromium rather than borrowing the system webview. */
const {app, BrowserWindow, shell, ipcMain} = require('electron');
const path = require('path');
const fs = require('fs');

/* Player settings that the shell owns rather than the save file, because they decide how the window
   is created. Kept in userData rather than beside the exe: a Steam install directory is not
   writable, and these have to survive an update.
   Defaults are the ones a first-time player should get - vsync on, fullscreen. */
const CFG = path.join(app.getPath('userData'), 'settings.json');
const readCfg = () => {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) {}
  return {vsync: raw.vsync !== false, windowed: !!raw.windowed};
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
  win = new BrowserWindow({
    width: 1280,
    height: 800,
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

  /* F11 fullscreen, the convention players expect from a desktop game. */
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
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
