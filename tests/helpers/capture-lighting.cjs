/* Run with Electron, in a disposable session: no player's save or account is opened. */
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'artifacts/lighting');
fs.mkdirSync(out, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'riptide-lighting-')));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.whenReady().then(async () => {
  const isolated = session.fromPartition('lighting-preview');
  isolated.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, done) => done({ cancel: true }));
  const win = new BrowserWindow({ width: 1600, height: 1000, show: false, webPreferences: { session: isolated, backgroundThrottling: false } });
  const errors = [], frames = [];
  win.webContents.on('console-message', (_, level, message) => { if (level >= 3 && !message.includes('ERR_BLOCKED_BY_CLIENT')) errors.push(message); });
  const js = code => win.webContents.executeJavaScript(code);
  try {
    await win.loadFile(path.join(root, 'index.html'));
    await js(`
      window.requestAnimationFrame=()=>0; gameOn=false;
      S=freshState('Lighting preview','human','warrior'); S.zone=CITY_ZONE; S.sound=false; S.sfx=false;
      S.city.owned=true; S.city.pop=900; S.city.mood=75;
      resize(); buildZone(); WEATHER.on=false; SUN.light=true; SUN.flare=true;
      globalThis.previewHouse=world.solids.find(s=>s.type==='cityhouse'&&!s.work&&s.x>6000&&s.x<9000);
      if(!previewHouse)throw Error('Preview house missing');
      hero.x=previewHouse.x+230; hero.y=previewHouse.y+120;
      zoom=1.35; camX=previewHouse.x-VW/(zoom*2); camY=previewHouse.y-80-VH/(zoom*2);
      SUN.pin=600; gameOn=true; draw(); gameOn=false;
    `);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const capture = async (name, setup) => {
      await js(setup + '; gameOn=true; draw(); gameOn=false;');
      await new Promise(resolve => setTimeout(resolve, 350));
      await js('gameOn=true; draw(); gameOn=false;');
      const data = await js('cv.toDataURL("image/png")');
      fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
      const jpg = await js('cv.toDataURL("image/jpeg",.92)');
      fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(jpg.split(',')[1], 'base64'));
      frames.push({ name, state: await js('({sun:{...SUN},spot:sunSpot(VW,VH),alpha:ctx.globalAlpha,transform:Array.from(ctx.getTransform().toFloat64Array())})') });
    };
    await capture('sunflare', 'SUN.pin=500; previewHouse.forsakenFire=false; zoom=.85; camX=previewHouse.x-VW/(zoom*2); camY=previewHouse.y-120-VH/(zoom*2)');
    await capture('house-fire-smoke', 'SUN.pin=950; previewHouse.forsakenFire=true; zoom=1.1; camX=previewHouse.x-VW/(zoom*2); camY=previewHouse.y-220-VH/(zoom*2)');
    await capture('house-fire-night', 'SUN.pin=3100');
    fs.writeFileSync(path.join(out, 'capture-result.json'), JSON.stringify({ errors, frames, scene: await js('({house:previewHouse.key, x:previewHouse.x,y:previewHouse.y, width:cv.width,height:cv.height})') }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'capture-error.txt'), error.stack);
    process.exitCode = 1;
  } finally { win.destroy(); app.quit(); }
});
