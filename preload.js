/* The only bridge between the page and the desktop shell. contextIsolation stays on and the game
   never gets Node - it gets these two functions and nothing else.
   This exists because uncapping the frame rate is a launch-time decision: the switches that turn
   off vsync have to be on the command line before Electron starts, so the page can only record the
   preference and let the next launch act on it. */
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getFpsUnlimited: () => ipcRenderer.invoke('fps-unlimited:get'),
  setFpsUnlimited: v => ipcRenderer.invoke('fps-unlimited:set', !!v),
});
