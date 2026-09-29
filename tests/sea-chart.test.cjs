const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/ui/crafting.css'),'utf8');

/* 🗺 Blackbeard's chart: the realm painted from the user's sketch, the ports that exist to click, the rest only named,
   and a red ring round "You" */
function chart(list){
 const a=source.indexOf("/* 🗺 Blackbeard's chart"),b=source.indexOf('function setSail(',a);
 assert.ok(a>=0&&b>a,'the chart code is found');
 const els={voyageList:{innerHTML:'',querySelectorAll:()=>[]},voyageHint:{textContent:''}};
 const c={$:id=>els[id]||null,voyageList:()=>list,setSail(){}};
 vm.createContext(c);vm.runInContext(source.slice(a,b)+';globalThis.api={SEA_CHART,renderVoyage};',c);
 c.api.renderVoyage();
 return {chart:c.api.SEA_CHART,html:els.voyageList.innerHTML};
}
const ports=[['home','The Harbour'],['silverfjord','Silverfjord'],['ravenholt','Ravenholt'],['emberfall','Emberfall'],['meridian','Port Meridian'],['krakensrest','Kraken’s Rest']];
const list=here=>ports.map(([id,name])=>({id,name,icon:'⛵',blurb:'b',zone:1,here:id===here}));

test('every port of call is on the chart, inside the picture, and the realm around them is named',()=>{
 const {chart:C}=chart(list('home'));
 for(const [id] of ports)assert.ok(C.some(p=>p.port===id),id+' is painted on the chart');
 for(const name of ['The City','Moonshine','Wasteland','The Farm'])assert.ok(C.some(p=>p.name===name&&!p.port),name+' is named, not sailed to');
 for(const p of C)assert.ok(p.x>0&&p.x<100&&p.y>0&&p.y<100,p.name+' lies on the picture');
 assert.ok(fs.existsSync(path.join(root,'assets/ui/sea-chart.jpg')));
 assert.ok(fs.existsSync(path.join(root,'assets/fonts/PirataOne-Regular.ttf'))&&fs.existsSync(path.join(root,'assets/fonts/PirataOne-OFL.txt')),'the font and its licence ship together');
});

test('from the Harbour: five ports to click, the Harbour ringed as You, the rest of the realm only named',()=>{
 const {html}=chart(list('home'));
 const buttons=[...html.matchAll(/<button type="button" class="chart-place port" data-voyage="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(buttons.sort(),['emberfall','krakensrest','meridian','ravenholt','silverfjord']);
 assert.doesNotMatch(html,/class="chart-place[^"]*"[^>]*>The Harbour</,'where you stand is named under the ring, not across it');
 assert.match(html,/<span class="chart-you" style="left:34%;top:37%" aria-label="You are here: The Harbour"><b>You<\/b><i>The Harbour<\/i><\/span>/);
 for(const name of ['The City','Moonshine','Wasteland','The Farm'])assert.match(html,new RegExp('<span class="chart-place" style="[^"]*">'+name+'</span>'));
});

test('in a port: the way home is a port like any other, and the ring moves to where you stand',()=>{
 const {html}=chart(list('krakensrest'));
 assert.match(html,/data-voyage="home"/);assert.doesNotMatch(html,/data-voyage="krakensrest"/);
 assert.match(html,/<span class="chart-you" style="left:41%;top:69%"/);
});

test('a port that does not exist yet is only a name; one not painted yet still sails from below the chart',()=>{
 const some=list('home').filter(d=>d.id!=='emberfall').concat({id:'newport',name:'New Port',icon:'⛵',blurb:'',zone:9,here:false});
 const {html}=chart(some);
 assert.doesNotMatch(html,/data-voyage="emberfall"/);assert.match(html,/<span class="chart-place" style="[^"]*">Emberfall<\/span>/);
 assert.match(html,/<div class="chart-more"><button type="button" class="sbtn" data-voyage="newport">/);
});

test('the chart is styled: pirate lettering, clickable ports with the bronze hand, a red ring',()=>{
 assert.match(css,/@font-face\{font-family:'Pirata One';src:url\('\.\.\/fonts\/PirataOne-Regular\.ttf'\)/);
 assert.match(css,/\.chart-place\.port\{pointer-events:auto;cursor:var\(--hand\)/);
 assert.match(css,/\.chart-you\{[^}]*border:3px solid #c3141b/);
});
