/* Settings > Controls has two tabs (asked for 2026-10-01: "gör en flik i controls för keyboard/mouse och en för gamepad och
 * visa en bild med min stil alla kontroller för gamepad"): Keyboard & Mouse keeps the painted keyboard and its list, Gamepad
 * shows a painted controller with a line from every button out to what it does. The real renderControls runs in a vm with
 * stub elements; its lines are checked against the buttons measured on the art (assets/ui/gamepad-art-manifest.json). */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(ROOT,'game.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'style.css'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/ui/gamepad-art-manifest.json'),'utf8'));
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};

const MAGE=[{n:'Fireball',cd:3},{n:'Frost Nova',cd:12},{n:'Arcane Barrage',cd:30}];
/* renderControls for real: $ hands out stub elements that count their innerHTML writes */
function controls({spells=MAGE,mode='kb'}={}){
 const els={},picked=[];
 const $=id=>els[id]||(els[id]={id,style:{cssText:''},writes:0,_h:'',get innerHTML(){return this._h;},set innerHTML(v){this._h=v;this.writes++;}});
 const c=vm.createContext({$,esc:s=>String(s).replace(/[&<>"']/g,ch=>'&#'+ch.charCodeAt(0)+';'),spellManaCost:()=>10,
  classOf:()=>spells?{spells}:null,inputMode:mode,controlsTabs:[],selectTab:(tabs,tab)=>picked.push(tab.id)});
 vm.runInContext(section('const PAD_MAP=','/* 🖵 Resolution is desktop-only')+'\nglobalThis.PAD_MAP=PAD_MAP;',c);
 c.renderControls();
 return {c,els,picked};
}
/* the map's lines and labels, in the order drawn (one line per label) */
function readMap(h){
 const lines=[...h.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"\/>/g)].map(m=>m.slice(1).map(Number));
 const calls=h.split('<div class="padcall ').slice(1).map(s=>({side:s[0],style:s.match(/style="([^"]*)"/)[1],
  rows:[...s.matchAll(/<kbd>(.*?)<\/kbd><span>(.*?)<\/span>/g)].map(m=>[m[1],m[2]])}));
 return {lines,calls};
}
const distToSeg=([x1,y1,x2,y2],[px,py])=>{
 const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(x1+t*dx-px,y1+t*dy-py);
};

test('Controls holds a Keyboard & Mouse tab and a Gamepad tab, outside the Settings tab strip',()=>{
 const pane=html.slice(html.indexOf('id="paneControls"'),html.indexOf('<div class="cfgfooter">'));
 assert.match(pane,/<div class="ctrltabs" role="tablist"/);
 assert.match(pane,/<button class="ctrltab on" id="ctrlTabKb" data-ctrl="kb" role="tab" aria-selected="true" aria-controls="ctrlKb">Keyboard &amp; Mouse<\/button>/);
 assert.match(pane,/<button class="ctrltab" id="ctrlTabPad" data-ctrl="pad" role="tab" aria-selected="false" aria-controls="ctrlPad" tabindex="-1">Gamepad<\/button>/);
 assert.doesNotMatch(pane,/class="cfgtab/,'a cfgtab would join Audio / Video / Controls');
 const kb=pane.slice(pane.indexOf('id="ctrlKb"'),pane.indexOf('id="ctrlPad"'));
 assert.match(kb,/src="assets\/ui\/keyboard_controls\.png"/);assert.match(kb,/id="kbdList"/);
 const pad=pane.slice(pane.indexOf('id="ctrlPad"'));
 assert.match(pad,/role="tabpanel" aria-labelledby="ctrlTabPad" hidden>/);
 for(const id of ['padMap','padWorld','padMenus'])assert.match(pad,new RegExp('id="'+id+'"'),id);
 assert.match(game,/const settingsTabs=\[\.\.\.document\.querySelectorAll\('\.cfgtab'\)\],controlsTabs=\[\.\.\.document\.querySelectorAll\('\.ctrltab'\)\];\nwireTabs\(settingsTabs\);wireTabs\(controlsTabs\);/);
 assert.match(css,/\.ctrlpane\{display:none;/);assert.match(css,/\.ctrlpane\.on\{display:flex\}/);
 assert.match(css,/\.ctrltab\{[^}]*cursor:var\(--hand\)/);
});

test('either strip of tabs: a click or the arrow keys pick one, show its pane and hide the others',()=>{
 const c=vm.createContext({});
 vm.runInContext(section('function selectTab(tabs,tab){','const settingsTabs=')+'\nglobalThis.selectTab=selectTab;globalThis.wireTabs=wireTabs;',c);
 const panes={},tab=(id,on)=>{const cls=new Set(on?['on']:[]),keys=[];
  const t={id,tabIndex:0,attrs:{},focused:0,classList:{contains:n=>cls.has(n),toggle:(n,v)=>v?cls.add(n):cls.delete(n)},
   getAttribute:k=>k==='aria-controls'?'p'+id:t.attrs[k],setAttribute:(k,v)=>{t.attrs[k]=v;},
   addEventListener:(type,f)=>keys.push(f),key:k=>keys.forEach(f=>f({key:k,preventDefault(){}})),focus(){t.focused++;}};
  panes['p'+id]={hidden:false,classList:{toggle(n,v){this.on=v;}}};return t;};
 c.$=id=>panes[id];
 const kb=tab('kb',true),pad=tab('pad',false);c.wireTabs([kb,pad]);
 assert.equal(panes.pkb.hidden,false);assert.equal(panes.ppad.hidden,true,'one pane at a time from the start');
 pad.onclick();assert.equal(pad.attrs['aria-selected'],'true');assert.equal(kb.tabIndex,-1);assert.equal(panes.pkb.hidden,true);
 pad.key('ArrowRight');assert.equal(kb.attrs['aria-selected'],'true','past the last tab: the first');assert.equal(kb.focused,1);
 kb.key('End');assert.equal(panes.ppad.hidden,false);
});

test('the controller art is the measured one: a 760 x 515 PNG with transparency, its job on record',()=>{
 const buf=fs.readFileSync(path.join(ROOT,'assets/ui',manifest.file));
 assert.equal(buf.toString('latin1',1,4),'PNG');
 const w=buf.readUInt32BE(16),h=buf.readUInt32BE(20),colour=buf[25];
 assert.deepEqual([w,h],manifest.size);
 assert.ok(colour===6||(colour===3&&buf.includes(Buffer.from('tRNS'))),'the controller stands on the map\'s own background');
 assert.ok(buf.length<300*1024,Math.round(buf.length/1024)+' KB');
 assert.match(manifest.job,/^[0-9a-f-]{36}$/);
 const {c}=controls();
 assert.ok(Math.abs(c.PAD_MAP.art.h/c.PAD_MAP.art.w-h/w)<1e-9,'the map sets the painting at its own shape, or every line would miss');
});

test('every button of the painted controller has a line that ends on it and crosses no other button',()=>{
 const {c,els}=controls();
 const {art:A,h:H}=c.PAD_MAP;
 const {lines,calls}=readMap(els.padMap.innerHTML);
 assert.equal(lines.length,calls.length);
 const at=([x,y,r])=>({x:A.x+A.w*x/100,y:A.y+A.h*y/100,r:r?A.w*r/100:0});
 const btn=Object.fromEntries(Object.entries(manifest.buttons).map(([k,v])=>[k,at(v)]));
 const BADGE={LS:'LS',RS:'RS','↑':'D-pad',LT:'LT',RT:'RT',LB:'LB',RB:'RB',View:'View',Start:'Start',Y:'face'};
 const round=Object.keys(btn).filter(k=>btn[k].r);
 const seen=new Set();
 calls.forEach((call,i)=>{
  const [x1,y1,x2,y2]=lines[i],first=call.rows[0][0],who=BADGE[first];
  assert.ok(who,'a label leads with '+first);
  if(who==='face'){
   for(const k of ['Y','X','B','A']){
    assert.ok(call.rows.some(r=>r[0]===k),k+' is named');seen.add(k);
    assert.ok(Math.hypot(x2-btn[k].x,y2-btn[k].y)>=btn[k].r,'the face line ends between the buttons, not on '+k);
   }
   const mid={x:(btn.Y.x+btn.X.x+btn.B.x+btn.A.x)/4,y:(btn.Y.y+btn.X.y+btn.B.y+btn.A.y)/4};
   assert.ok(Math.hypot(x2-mid.x,y2-mid.y)<A.w*0.08,'and inside the diamond');
  }else{
   seen.add(who);
   const b=btn[who],d=Math.hypot(x2-b.x,y2-b.y);
   assert.ok(b.r?d<=b.r*0.35:d<=A.w*0.015,first+' ends on its button ('+d.toFixed(1)+' units off)');
  }
  for(const k of round){
   if(k===who)continue;
   const d=distToSeg(lines[i],[btn[k].x,btn[k].y]);
   assert.ok(d>=btn[k].r,first+'\'s line crosses '+k+' ('+(btn[k].r-d).toFixed(1)+' units into it)');
  }
  /* where the line leaves its label */
  if(call.side==='l'){assert.equal(x1,220);assert.match(call.style,/^right:78%;/);}
  if(call.side==='r'){assert.equal(x1,780);assert.match(call.style,/^left:78%;/);}
  if(call.side==='t'){assert.equal(x1,x2,'straight down');assert.ok(y1<A.y,'from above the controller');}
  assert.ok(y1>0&&y1<H,first+' stands inside the map');
  assert.match(call.style,new RegExp('top:'+(+(y1/H*100).toFixed(1))+'%$'),first+'\'s label sits where its line starts');
 });
 assert.deepEqual([...seen].sort(),Object.keys(manifest.buttons).sort(),'every measured button is pointed at');
 /* no two lines cross */
 const cross=(a,b)=>{const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  const [p1,p2,p3,p4]=[[a[0],a[1]],[a[2],a[3]],[b[0],b[1]],[b[2],b[3]]];
  return o(p1,p2,p3)!==o(p1,p2,p4)&&o(p3,p4,p1)!==o(p3,p4,p2);};
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++)assert.ok(!cross(lines[i],lines[j]),calls[i].rows[0][0]+' x '+calls[j].rows[0][0]);
});

test('the map names what padTick does: the class\'s spells on X, Y and LT, and the rest of the world bindings',()=>{
 const tick=section('function padTick(dt){','/* 🎮 what the buttons do in the menu on screen');
 for(const re of [/if\(padHit\.a&&padNear\)padNear\.open\(\);/,/if\(padHit\.start\)\{\s*if\(!casinoBack\(\)\)openSettings\(\);/,/if\(padHit\.x\)cast\(0,true\);/,/if\(padHit\.y\)cast\(1,true\);/,
  /if\(padHit\.lt\)cast\(2,true\);/,/if\(padHit\.up&&!padRep\.up\)usePot\('hp',true\);/,/if\(padHit\.down&&!padRep\.down\)usePot\('mp',true\);/,
  /if\(padHit\.left&&!padRep\.left\)\{\s*const t=nearestEnemyWithin/,/if\(padHit\.right&&!padRep\.right\)toggleMount\(\);/,/if\(padHit\.b&&hero\.target\)hero\.target=null;/,
  /if\(gameOn&&\(padHit\.back\|\|padHit\.lb\|\|padHit\.rb\)\)padSideOpen\(padHit\.rb\?1:padHit\.lb\?-1:0\);/,/if\(padHit\.rt&&gameOn\)\{\s*if\(isDesktopLayout\(\)\)toggleSide\(\);/,
  /if\(padHit\.r3&&gameOn&&mineTrained\(\)\)toggleMining\(\);/,/if\(Math\.abs\(padRZoom\)>0\.01&&gameOn\)setZoom/])assert.match(tick,re,'a binding changed: change the Gamepad tab with it');
 const {els}=controls();
 const rows=Object.fromEntries(readMap(els.padMap.innerHTML).calls.flatMap(c=>c.rows));
 assert.deepEqual(rows,{LS:'Walk','↑':'Health potion','↓':'Mana potion','←':'Target foe','→':'Ride mount',Y:'Frost Nova',X:'Fireball',B:'Drop target',
  A:'Talk, open',LT:'Arcane Barrage',LB:'Previous page',RB:'Next page',RT:'Hide panel',RS:'Zoom',R3:'Mining pick',View:'Side panel',Start:'Settings'});
 const none=readMap(controls({spells:null}).els.padMap.innerHTML).calls.flatMap(c=>c.rows);
 assert.deepEqual(none.filter(r=>['X','Y','LT'].includes(r[0])),[['Y','Second spell'],['X','First spell'],['LT','Third spell']],'no hero yet');
});

test('the lists: the keyboard keeps its own, the pad\'s menus are written out, and a phone gets the map as rows',()=>{
 const {els}=controls();
 assert.match(els.kbdList.innerHTML,/<kbd>W A S D<\/kbd>/);
 assert.doesNotMatch(els.kbdList.innerHTML,/Left stick|Controller|D-pad/,'the pad has its own tab now');
 const world=els.padWorld.innerHTML;
 for(const k of ['Left stick','D-pad ↑','D-pad ↓','D-pad ←','D-pad →','Y','X','B','A','LT','LB','RB','RT','Right stick','R3','View','Start'])
  assert.ok(world.includes('<kbd>'+k+'</kbd>'),k);
 assert.match(world,/^<div class="kbdhead">Playing<\/div>/);
 const menus=els.padMenus.innerHTML;
 assert.match(menus,/^<div class="kbdhead">In menus<\/div>/);
 for(const k of ['D-pad','A','B','LB / RB','Right stick','View / RT','Start'])assert.ok(menus.includes('<kbd>'+k+'</kbd>'),k);
 /* the narrow layout swaps the labels for the list */
 assert.match(css,/#ctrlPad\{container-type:inline-size\}/);
 assert.match(css,/\.kbdlist\.padworld\{display:none;/);
 const q=css.slice(css.indexOf('@container (max-width:420px){'));
 assert.match(q.slice(0,q.indexOf('\n  }')),/\.padlines,\.padcall\{display:none\}[\s\S]*\.kbdlist\.padworld\{display:grid\}/);
});

test('Settings opens on the tab of whatever is steering, and the map is drawn again only for new spell names',()=>{
 assert.deepEqual(controls({mode:'pad'}).picked,['ctrlTabPad'],'the pad\'s Start: the Gamepad tab');
 const {c,els,picked}=controls({mode:'kb'});
 assert.deepEqual(picked,['ctrlTabKb'],'the gear clicked: Keyboard & Mouse');
 c.renderControls();assert.equal(els.padMap.writes,1,'opened again: the picture is not rebuilt');
 c.classOf=()=>({spells:[{n:'Heroic Strike',cd:4},{n:'Whirlwind',cd:8},{n:'Battle Shout',cd:28}]});c.renderControls();
 assert.equal(els.padMap.writes,2);assert.match(els.padMap.innerHTML,/<kbd>X<\/kbd><span>Heroic Strike<\/span>/,'another hero, another class');
 assert.match(els.padMap.style.cssText,/^--ar:1000\/\d+;--ax:[\d.]+%;--ay:[\d.]+%;--aw:[\d.]+%$/);
});

test('LB/RB turn Audio, Video and Controls only: the pair inside Controls does not stop RB',()=>{
 for(const fn of [section('function padTabStep(host,d){','\n}\n'),section('function padHintsTick(){','\n}\n')])
  assert.ok(fn.includes('[role="tab"]:not(.ctrltab),.cfgtab,.craft-tab'),'both read the same strip');
 /* a small selector matcher: [role="tab"], :not(.x) and .x - all the strip selector uses */
 const el=(id,cls,on=false)=>{const s=new Set(cls),attrs={role:'tab','aria-selected':String(on)};
  return {id,cls:s,attrs,disabled:false,classList:{contains:n=>s.has(n)},getAttribute:k=>attrs[k],getClientRects:()=>[{}]};};
 const tabs=[el('audio',['cfgtab']),el('video',['cfgtab']),el('controls',['cfgtab','on'],true),el('kb',['ctrltab','on'],true),el('pad',['ctrltab'])];
 const match=(t,sel)=>sel.split(',').some(part=>{
  let ok=true;part=part.trim();
  for(const m of part.matchAll(/\[(\w[\w-]*)="([^"]*)"\]|:not\(\.([\w-]+)\)|\.([\w-]+)/g)){
   if(m[1])ok=ok&&t.attrs[m[1]]===m[2];else if(m[3])ok=ok&&!t.cls.has(m[3]);else ok=ok&&t.cls.has(m[4]);
  }
  return ok;});
 const clicks=[];tabs.forEach(t=>{t.click=()=>clicks.push(t.id);});
 const host={classList:{contains:()=>false},querySelectorAll:sel=>tabs.filter(t=>match(t,sel))};
 const c=vm.createContext({padMark(){},padSideOpen(){}});
 vm.runInContext(section('function padTabStep(host,d){','\n}\n')+'\n}',c);
 c.padTabStep(host,1);c.padTabStep(host,-1);
 assert.deepEqual(clicks,['audio','video'],'RB from Controls wraps to Audio, LB goes to Video - it used to click Keyboard & Mouse');
});
