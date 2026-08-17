/* The only bridge between the page and the desktop shell. contextIsolation stays on and the game
   never gets Node - it gets these few functions and nothing else.
   Vsync lives here rather than in the game's save because it is a launch-time decision: the switch
   that turns it off has to be on the command line before Electron starts, so the page can only
   record the preference and let the next launch act on it. Windowed mode is stored alongside it
   because the window is created from it, before the page exists to be asked. */
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setVsync: v => ipcRenderer.invoke('settings:vsync', !!v),
  setWindowed: v => ipcRenderer.invoke('settings:windowed', !!v),
  onWindowedChanged: fn => ipcRenderer.on('windowed-changed', (_e, v) => fn(!!v)),
  getResolutions: () => ipcRenderer.invoke('res:list'),
  setResolution: (w,h) => ipcRenderer.invoke('res:set', w, h),
  quit: () => ipcRenderer.invoke('app:quit'),
});
