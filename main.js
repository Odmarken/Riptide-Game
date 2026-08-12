/* Electron shell for Riptide RPG.
   The game itself is untouched browser code - this file only opens a window and points Chromium at
   index.html. Everything that made the web build work still works here, because Electron ships its
   own Chromium rather than borrowing the system webview. */
const {app, BrowserWindow, shell, ipcMain} = require('electron');
const path = require('path');
const fs = require('fs');

/* Uncapping the frame rate is a launch-time decision - these switches have to be on the command
   line before Electron starts, so the setting is read off disk here and the checkbox in-game only
   records it for next time. Kept in userData rather than beside the exe: a Steam install directory
   is not writable, and this has to survive an update. */
const CFG = path.join(app.getPath('userData'), 'settings.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { return {}; } };
const cfg = readCfg();

if (cfg.fpsUnlimited) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

ipcMain.handle('fps-unlimited:get', () => !!readCfg().fpsUnlimited);
ipcMain.handle('fps-unlimited:set', (_e, v) => {
  const next = Object.assign(readCfg(), {fpsUnlimited: !!v});
  try { fs.writeFileSync(CFG, JSON.stringify(next, null, 2)); return true; } catch (e) { return false; }
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
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
