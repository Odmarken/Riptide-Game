/* Run with: node --test tests/render-resolution.test.cjs
 * 🖵 Resolution that does something (asked for 2026-10-10: "gör också att resolution faktiskt gör något för jag vill kunna ändra
 * för att spara fps", "det ska ju bli mer pixel, tänkte för folk som vill kunna", "och fler resolution alternativ"). Settings >
 * Video > Resolution (desktop) is now how many pixels the game draws: below the window's own, the canvas is drawn smaller and
 * stretched over the window, in fullscreen too (it used to say "takes effect when windowed" and do nothing). The list runs from
 * the display's size down to 640 x 360 in the display's shape. A choice that fits as a window still sizes the window, as before.
 * The notes under Resolution and Lighting quality were taken out the same day ("ta bort denna text").
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js'),html=read('index.html');
const D=require('../assets/ui/display-settings.js');
const slice=(a,b)=>{const i=game.indexOf(a),j=game.indexOf(b,i);assert.ok(i>=0&&j>i,a);return game.slice(i,j);};

test('the setting: the window\'s own by default, only a real WxH taken, kept on the device and through Reset',()=>{
 assert.equal(D.normalize(null).res,'');
 assert.equal(D.normalize({res:'1280x720'}).res,'1280x720');assert.equal(D.normalize({res:'640x360'}).res,'640x360');
 for(const bad of ['abc','12x5','1280',1280,'1280x720x1','1280 x 720',null])assert.equal(D.normalize({res:bad}).res,'',String(bad));
 const kept={},els={},doc={getElementById:id=>els[id]||(els[id]={checked:false,value:100,min:60,max:140,style:{setProperty(){}},setAttribute(){},addEventListener(t,f){this.on=f;}})};
 const storage={getItem:k=>kept[k]??null,setItem:(k,v)=>{kept[k]=v;}},told=[];
 D.create({doc,storage,onChange:v=>told.push(v.res)});
 assert.equal(told.at(-1),'','the game hears it as soon as it is read');
 els.resSel.on({target:{value:'1600x900'}});
 assert.equal(told.at(-1),'1600x900','the game is told');assert.equal(JSON.parse(kept[D.STORAGE_KEY]).res,'1600x900','saved on the device');
 els.videoReset.on();assert.equal(told.at(-1),'1600x900','Reset (brightness and contrast) leaves it');
 assert.equal(D.load(storage).res,'1600x900','and the next start reads it');
});

test('the list shows the kept choice once the game has built it - not before, when there is nothing to pick',()=>{
 const kept={[D.STORAGE_KEY]:JSON.stringify({res:'1280x720'})},storage={getItem:k=>kept[k]??null,setItem:(k,v)=>{kept[k]=v;}};
 const sel={value:'',options:[],addEventListener(){}},doc={getElementById:id=>id==='resSel'?sel:{style:{setProperty(){}},setAttribute(){},addEventListener(){}}};
 const S=D.create({doc,storage});
 assert.equal(sel.value,'','no options yet: left alone');
 sel.options=[{value:''},{value:'1600x900'},{value:'1280x720'}];S.sync();
 assert.equal(sel.value,'1280x720');
});

test('the choices: the display\'s own size first, then every listed height below it in the display\'s shape, down to 640 x 360',()=>{
 const box=vm.createContext({});
 vm.runInContext(slice('const RES_HEIGHTS=','if(window.desktop&&window.desktop.getResolutions){')+';globalThis.resOptions=resOptions;',box);
 const labels=d=>Array.from(box.resOptions(d),o=>o.label);
 assert.deepEqual(labels({w:1920,h:1080}),['Match screen (1920 x 1080)','1600 x 900','1440 x 810','1366 x 768','1280 x 720','1152 x 648','1024 x 576','960 x 540','854 x 480','640 x 360']);
 const k4=box.resOptions({w:3840,h:2160});
 assert.equal(k4.length,15,'a 4K screen gets fourteen below its own');assert.equal(k4[1].label,'3200 x 1800');assert.equal(k4.at(-1).v,'640x360');
 assert.equal(k4[0].v,'','the first is the window\'s own (no WxH)');
 assert.equal(box.resOptions({w:3440,h:1440})[1].label,'3096 x 1296','a wide screen keeps its shape');
 assert.equal(box.resOptions({w:1920,h:1080},'1234x567').at(-1).label,'1234 x 567','a kept choice from another screen is still listed');
 assert.equal(box.resOptions({w:1920,h:1080},'1280x720').length,10,'and an ordinary one is not listed twice');
});

test('the screen draws at most that many pixels: the canvas density follows the choice, never above the window\'s own',()=>{
 const box=vm.createContext({window:{desktop:{}},innerWidth:1920,innerHeight:1080,resizes:0});
 vm.runInContext('let renderRes=null;function resize(){resizes++;}\n'+slice('function renderScale(base){','function resize(){')+';globalThis.S=renderScale;globalThis.R=screenRes;globalThis.cur=()=>renderRes;',box);
 assert.equal(box.S(1),1,'nothing chosen: every pixel');
 box.R('960x540');assert.equal(box.S(1),.5,'half the width and height of a 1920 x 1080 window');assert.equal(box.resizes,1,'and the screen is sized again');
 assert.equal(box.S(2),.25,'on a 200% display the window has 3840 x 2160 pixels');
 box.R('3840x2160');assert.equal(box.S(1),1,'more than the window has: the window\'s own');
 box.innerWidth=2560;box.innerHeight=1080;box.R('1920x1080');assert.equal(box.S(1),.75,'a wide window: the tighter side decides');
 box.R('');assert.equal(box.cur(),null);assert.equal(box.S(1),1,'Match screen');
 box.window.desktop=undefined;box.R('960x540');assert.equal(box.cur(),null,'a browser has no Resolution');
 assert.ok(game.includes('const nextDPR=base*renderScale(base);'),'resize draws at that density');
 assert.ok(game.includes('cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);'),'the canvas gets that many pixels; the page stretches it over the stage');
});

test('the game: the setting reaches the screen, a window still takes a size that fits, and the old notes are gone',()=>{
 assert.ok(game.includes('screenGpu(!PHONE||v.gpu);screenRes(v.res);}});'),'every time the settings are applied');
 const show=slice('const showResolutions=r=>{','window.desktop.getResolutions().then(showResolutions)');
 assert.ok(show.includes('resOptions(r.display,displaySettings.value.res)'),'built from the display');
 assert.ok(show.includes('displaySettings.sync();'),'then the kept choice is shown');
 assert.ok(show.includes('if(!o.v||fit)window.desktop.setResolution(fit?fit.w:0,fit?fit.h:0)'),'a size that fits as a window sizes it, Match screen gives it back the desktop');
 assert.ok(!game.includes('takes effect when windowed'),'fullscreen no longer waits for a window');
 assert.ok(!html.includes('id="resNote"')&&!html.includes('id="lightQNote"')&&!game.includes("$('resNote')")&&!game.includes("$('lightQNote')"),'no notes under Resolution and Lighting quality');
 assert.ok(html.includes('<label class="cfgrow cfgresolution" id="resRow" style="display:none"><span>Resolution</span><select id="resSel"></select></label>'),'the row, hidden until the desktop shell answers');
});
