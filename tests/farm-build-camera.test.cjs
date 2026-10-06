'use strict';
/* Build mode on the Farm: the buildable field lies along the farm's west edge, and the Farm Store (172 px, with its ❮ tab
   sticking out 18 px more) covers the left of the screen. These run the game's own camera code - enterBuildMode, the
   store's tab, expandFarmStore and the per-frame clamp - on the stage sizes the real game has (the stage is the window
   minus the HUD and, on desktop, the side panel) to check that the field opens on the left, clear of the store. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const FarmLayout=require('../assets/farm/layout.js');
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const section=(start,end)=>{const i=game.indexOf(start);assert.ok(i>=0,start);const j=game.indexOf(end,i);assert.ok(j>i,end);return game.slice(i,j);};
const STORE_W=172,TAB_W=18,COVER=STORE_W+TAB_W;
const near=(a,b,what)=>assert.ok(Math.abs(a-b)<1e-6,`${what}: ${a} vs ${b}`);

function harness(VW,VH){
 const classes=new Set();
 const els={
  farmStore:{style:{display:'none'},offsetWidth:STORE_W,classList:{remove:n=>classes.delete(n),contains:n=>classes.has(n),
   toggle(n){if(classes.has(n)){classes.delete(n);return false;}classes.add(n);return true;}}},
  fsCollapse:{textContent:'',offsetLeft:STORE_W-2,offsetWidth:20} /* right:-20px from the padding box, inside a 2 px border */
 };
 const c=vm.createContext({FarmLayout,Math,VW,VH,zoom:1,camX:0,camY:0,ZMAX:3,debugZoom:false,IS_TOUCH:false,
  buildMode:false,buildSel:null,buildTab:'b',hero:{},world:{w:FarmLayout.WIDTH,h:FarmLayout.HEIGHT},zoneOf:()=>({farm:true}),
  $:id=>els[id]||(els[id]={style:{},textContent:''}),renderFarmStore(){},updateCartUI(){},stageMsg(){}});
 vm.runInContext(section('const zmin=()=>{','function dbgZoom('),c);
 vm.runInContext(section('/* 🔨 the Farm Store covers',"$('fsClose').onclick="),c);
 vm.runInContext(section('function enterBuildMode(){','function exitBuildMode('),c);
 vm.runInContext('globalThis.clampCam=function(){'+section('const vw=VW/zoom,vh=VH/zoom,cover=','\n}')+'\n};',c);
 const screenX=wx=>(wx-c.camX)*c.zoom,screenY=wy=>(wy-c.camY)*c.zoom;
 const open=()=>{c.enterBuildMode();c.clampCam();};
 return {c,screenX,screenY,open,tucked:()=>classes.has('collapsed'),tab:()=>{els.fsCollapse.onclick();c.clampCam();}};
}

test('every desktop stage opens build mode with the farm against the store and the field on the left',()=>{
 /* 2175x1338 and 1920x1080 windows with the side panel, 2175x1338 without it, and a 3440x1440 ultra-wide without it */
 for(const [VW,VH] of [[1522,1134],[1344,876],[2175,1134],[3440,1236]]){
  const {c,screenX,screenY,open}=harness(VW,VH);
  open();
  const at=`${VW}x${VH}`;
  assert.equal(c.buildMode,true);
  assert.equal(vm.runInContext('farmStoreW+","+farmTabW',c),COVER+','+TAB_W,'the store and its tab are measured as build mode opens');
  near(c.zoom,Math.min(VW/4400,VH/5400),at+' bird\'s-eye');
  near(screenX(0),COVER,at+' the farm\'s west edge right beside the store and its tab - not under them, not centred away from them');
  const x0=screenX(FarmLayout.BUILD.x0),x1=screenX(FarmLayout.BUILD.x1);
  assert.ok(x0>=COVER&&x0<COVER+12,at+' the field starts at the store');
  assert.ok((x0+x1)/2<VW/2,at+' and lies on the left of the stage, the meadow on the right');
  assert.ok(screenY(FarmLayout.BUILD.y0)>=0&&screenY(FarmLayout.BUILD.y1)<=VH,at+' north to south in view');
  for(const p of [FarmLayout.EXIT,FarmLayout.SPAWN,FarmLayout.HOUSE])assert.ok(screenX(p.x-38)>COVER,at+' the way home, the spawn and the house are clear of the store and its tab');
 }
});

test('tucking the store away lets the farm\'s edge follow it to the tab, and bringing it back puts the edge against the store again',()=>{
 const h=harness(1522,1134);h.open();
 const opened=h.c.camX;
 h.tab();assert.equal(h.tucked(),true);
 near(h.screenX(0),TAB_W,'tucked: the farm moves left as far as the tab');
 h.tab();assert.equal(h.tucked(),false);
 near(h.c.camX,opened,'out again: exactly where build mode opened it');
});

test('zoomed in, tucking the store uncovers what it hid instead of pushing it off the screen',()=>{
 const h=harness(1522,1134);h.open();
 h.c.zoom=1;h.c.camX=1500;h.c.clampCam();
 h.tab();near(h.c.camX,1500,'the view stays: the strip under the store comes into sight');
 h.tab();near(h.c.camX,1500,'and the store covers it again');
 h.c.camX=-COVER;h.c.clampCam();near(h.c.camX,-COVER,'the west edge can sit right beside the open store');
 h.c.camX=-COVER-50;h.c.clampCam();near(h.c.camX,-COVER,'but no further');
 h.tab();near(h.screenX(0),TAB_W,'tucked at the west edge: the edge follows the store to its tab');
 h.tab();near(h.c.camX,-COVER,'and back beside the open store');
 h.c.camX=1e6;h.c.clampCam();const east=h.c.camX;
 h.tab();h.tab();near(h.c.camX,east,'at the east end of the farm nothing moves either way');
});

test('after a checkout expandFarmStore brings the store back the way the tab does',()=>{
 const h=harness(1344,876);h.open();
 h.tab();near(h.screenX(0),TAB_W,'tucked away to place pieces');
 h.c.expandFarmStore();h.c.clampCam();
 assert.equal(h.tucked(),false);
 near(h.screenX(0),COVER,'the farm\'s edge moves out from under the store');
 const opened=h.c.camX;
 h.c.expandFarmStore();h.c.clampCam();near(h.c.camX,opened,'already out: nothing moves');
 h.c.zoom=1;h.c.camX=2000;h.c.clampCam();h.tab();
 h.c.expandFarmStore();h.c.clampCam();near(h.c.camX,2000,'in the middle of the farm the view stays put');
});

test('a phone in portrait opens with the field against the store, and tucked away shows all of it',()=>{
 const {c,screenX,open,tab}=harness(390,585);
 open();
 near(screenX(0),COVER,'the field starts beside the store and runs on to the east');
 const opened=c.camX;
 c.camX=1e6;c.clampCam();near(screenX(FarmLayout.WIDTH),c.VW,'dragged east, the far edge stops at the screen');
 c.camX=opened;c.clampCam();
 tab();
 assert.ok(screenX(FarmLayout.BUILD.x0)>=TAB_W,'tucked: the west edge of the field just clear of the tab');
 assert.ok(screenX(FarmLayout.BUILD.x1)<=c.VW+1,'and its east edge on the screen');
 for(const p of [FarmLayout.EXIT,FarmLayout.SPAWN,FarmLayout.HOUSE])assert.ok(screenX(p.x)>TAB_W&&screenX(p.x)<c.VW);
});

test('outside build mode the clamp is the one every zone had',()=>{
 const {c,tab}=harness(1600,900);
 c.zoom=1;
 for(const [x,want] of [[-500,0],[300,300],[9000,FarmLayout.WIDTH-1600]]){c.camX=x;c.clampCam();assert.ok(Object.is(c.camX,want),`${x} -> ${c.camX}`);}
 c.zoom=0.1;c.camX=0;c.clampCam();
 assert.equal(c.camX,(FarmLayout.WIDTH-16000)/2,'wider than the world: centred');
 c.zoom=1;c.camY=-50;c.clampCam();assert.ok(Object.is(c.camY,0));
 /* in build mode the tab is still on screen while the store is tucked away */
 c.buildMode=true;vm.runInContext('farmStoreW='+COVER+';farmTabW='+TAB_W,c);tab();
 c.camX=-100;c.clampCam();assert.equal(c.camX,-TAB_W);
});

test('waking on the Farm: a spot from the centred field moves west with it, a spot that names this layout stays',()=>{
 const farmZone=3;
 const box=vm.createContext({FarmLayout,Math,JSON,Number,ZONES:{3:{name:'Farm',farm:true},4:{name:'Moonshine'}},
  S:{zone:farmZone,id:'h1'},world:{w:FarmLayout.WIDTH,h:FarmLayout.HEIGHT},hero:{x:470,y:2600,r:13},pet:{},VW:1600,VH:900,zoom:1,camX:0,camY:0,
  zoneOf:()=>box.ZONES[box.S.zone],instanceZone:()=>false,collide:()=>false,refreshWastelandChunks(){},gameOn:true,written:[],
  spotKey:id=>'riptide-spot-'+id,deviceSet:(k,v)=>{box.written.push(JSON.parse(v));return Promise.resolve();}});
 vm.runInContext('let spotLast=null,wakeSpot=null;'+section('function spotStamp(force){','async function loadSpot(')+section('function wakeAt(){','/* ⚓ the Harbour'),box);
 const wake=(sp,zone=farmZone)=>{box.S.zone=zone;box.hero.x=470;box.hero.y=2600;vm.runInContext('wakeSpot='+JSON.stringify(sp)+';globalThis.ok=wakeAt();',box);return box.ok;};
 assert.equal(wake({z:farmZone,name:'Farm',x:3100,y:2400}),true);
 assert.deepEqual([box.hero.x,box.hero.y],[1000,2400],'written by a build with the centred field: 2100 west, like the farm itself');
 assert.equal(wake({z:farmZone,name:'Farm',x:3100,y:2400,fl:2}),true);
 assert.deepEqual([box.hero.x,box.hero.y],[3100,2400],'written under this layout: where it says');
 assert.equal(wake({z:farmZone,name:'Farm',x:2120,y:2400}),false,'a spot that would end up off the map is refused: the spawn it is');
 assert.deepEqual([box.hero.x,box.hero.y],[470,2600]);
 assert.equal(wake({z:4,name:'Moonshine',x:3100,y:400},4),true);
 assert.deepEqual([box.hero.x,box.hero.y],[3100,400],'every other zone is untouched');
 box.S.zone=farmZone;box.hero.x=1234;box.hero.y=2345;vm.runInContext('spotStamp(true)',box);
 assert.deepEqual(box.written.at(-1),{z:farmZone,name:'Farm',x:1234,y:2345,fl:FarmLayout.LAYOUT_VERSION},'a Farm spot names the layout it was written under');
 box.S.zone=4;vm.runInContext('spotStamp(true)',box);
 assert.deepEqual(box.written.at(-1),{z:4,name:'Moonshine',x:1234,y:2345},'other zones write what they always wrote');
});
