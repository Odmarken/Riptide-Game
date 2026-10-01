/* The controller everywhere (asked for 2026-09-30: "handkontroll för allt ... använda menyerna och bläddra med pilarna"):
 * the d-pad walks every menu in the direction pressed, A presses, B backs out, LB/RB turn tabs and the side panel's pages,
 * the right stick scrolls; in the world X/Y/LT cast, the d-pad drinks, targets and mounts, View steps into the side panel.
 * The real code runs in a vm, cut from game.js; only the DOM and the pad are fakes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};

/* a DOM with positions: every element has a box, a parent, a cursor and a place in reading order */
function dom(){
 const order=[],clicks=[],events=[];
 function el(id,{tag='BUTTON',parent=null,box=[0,0,10,10],cursor='auto',attrs={},cls=[]}={}){
  const classes=new Set(cls),e={id,tagName:tag,parentElement:parent,box,cursor,disabled:false,hidden:false,dataset:{},attrs,type:attrs.type||'',
   classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n)},
   getAttribute:k=>k in attrs?attrs[k]:null,
   get offsetParent(){return e.shown()?{}:null;},
   shown(){for(let x=e;x;x=x.parentElement)if(x.hidden)return false;return true;},
   getClientRects(){return e.shown()?[{}]:[];},
   getBoundingClientRect(){const [l,t,w,h]=e.box;return {left:l,top:t,width:w,height:h,right:l+w,bottom:t+h};},
   contains(x){for(;x;x=x.parentElement)if(x===e)return true;return false;},
   compareDocumentPosition(x){return order.indexOf(x)>order.indexOf(e)?4:2;},
   querySelectorAll(sel){
    const inside=order.filter(x=>x!==e&&e.contains(x));
    if(sel==='*')return inside;
    if(sel.startsWith('[role="tab"]'))return inside.filter(x=>x.getAttribute('role')==='tab');   /* padTabStep's tab strip */
    return inside.filter(x=>['BUTTON','INPUT','SELECT'].includes(x.tagName));
   },
   querySelector(sel){return e.querySelectorAll(sel)[0]||null;},
   click(){if(!e.disabled)clicks.push(id);},
   scrollIntoView(){},dispatchEvent(ev){events.push(id+':'+ev.type);},focus(){}};
  if(attrs['data-pad-first']!==undefined)e.dataset.padFirst='';
  order.push(e);return e;
 }
 const document={activeElement:null,querySelectorAll:sel=>{assert.equal(sel,'.padfocus');return order.filter(x=>x.classList.contains('padfocus'));}};
 return {el,order,clicks,events,document};
}
/* the pad's walking pieces, for real */
function walker(d,extra={}){
 const c=vm.createContext({document:d.document,getComputedStyle:x=>({cursor:x.cursor,visibility:'visible',overflowY:'visible'}),
  MouseEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}},Event:class{constructor(t){this.type=t;}},padSideLayer:()=>null,...extra});
 vm.runInContext(section('let padFocus=null;','function padAdjustRange(')+section('function padAdjustRange(','/* ---------- what an A press means in the world')
  +'\nglobalThis.focus=()=>padFocus;globalThis.setFocus=e=>{padFocus=e;};',c);
 return c;
}

test('the d-pad walks a grid as it looks: along the row, down the column, and on in reading order past the end of a row',()=>{
 const d=dom(),host=d.el('bag',{tag:'DIV',box:[0,0,400,400]});
 const cell={};
 for(let r=0;r<3;r++)for(let k=0;k<3;k++)cell[r+''+k]=d.el('c'+r+k,{parent:host,box:[10+k*100,10+r*100,80,80]});
 const c=walker(d);
 c.setFocus(cell['11']);
 const go=dir=>{c.padMenuStep(host,dir==='up'||dir==='left'?-1:1,dir);return c.focus().id;};
 assert.equal(go('right'),'c12');assert.equal(go('down'),'c22');assert.equal(go('left'),'c21');assert.equal(go('up'),'c11');
 c.setFocus(cell['12']);assert.equal(go('right'),'c20','nothing ahead at the end of a row: the next control in reading order');
 c.setFocus(cell['22']);assert.equal(go('down'),'c00','and past the last one it wraps to the first');
 /* a wide button under two narrow ones is reached from either */
 const d2=dom(),h2=d2.el('box',{tag:'DIV',box:[0,0,300,200]});
 d2.el('left',{parent:h2,box:[0,0,100,40]});const right=d2.el('right',{parent:h2,box:[150,0,100,40]});d2.el('wide',{parent:h2,box:[0,60,250,40]});
 const w=walker(d2);w.setFocus(right);w.padMenuStep(h2,1,'down');assert.equal(w.focus().id,'wide');
 w.padMenuStep(h2,-1,'up');assert.equal(w.focus().id,'left','up from the wide one: the first it lines up with');
});

test('the first highlight is the box\'s own safe choice, then what the keyboard stands on, then the first control',()=>{
 const d=dom(),box=d.el('confirmFx',{tag:'DIV'});
 d.el('cfYes',{parent:box,box:[0,0,50,20]});d.el('cfNo',{parent:box,box:[60,0,50,20],attrs:{'data-pad-first':''}});
 let c=walker(d);c.padMenuStep(box,1);assert.equal(c.focus().id,'cfNo','a doubled A on a confirm must not say Yes');
 const d2=dom(),table=d2.el('bjFx',{tag:'DIV'});
 d2.el('bjBetDn',{parent:table});const deal=d2.el('bjDeal',{parent:table});d2.el('bjClose',{parent:table});
 d2.document.activeElement=deal;c=walker(d2);c.padMenuStep(table,1);assert.equal(c.focus().id,'bjDeal');
 const d3=dom(),menu=d3.el('casinoMenu',{tag:'DIV'});d3.el('one',{parent:menu});d3.el('two',{parent:menu});
 c=walker(d3);c.padMenuStep(menu,1);assert.equal(c.focus().id,'one');
 c.setFocus(null);c.padMenuStep(menu,-1);assert.equal(c.focus().id,'two');
 /* the Extra Spin box names its NO, and the confirm its Cancel, in the page itself */
 assert.match(html,/id="seaBuyNo" data-pad-first/);
 assert.match(game,/id="cfNo" data-pad-first/);
});

test('what the pad can land on: controls, and whatever sets the bronze hand itself - a card holding buttons gives way to them',()=>{
 const d=dom(),host=d.el('p-bag',{tag:'DIV',box:[0,0,300,600]});
 const zone=d.el('zone',{tag:'DIV',parent:host,box:[0,0,300,50],cursor:'url(bronze_a_grab_32.png) 16 12, pointer'});
 d.el('zoneText',{tag:'SPAN',parent:zone,box:[5,5,100,20],cursor:'url(bronze_a_grab_32.png) 16 12, pointer'});
 const card=d.el('card',{tag:'DIV',parent:host,box:[0,60,300,80],cursor:'url(bronze_a_grab_32.png) 16 12, pointer'});
 d.el('sell',{parent:card,box:[200,80,60,30]});
 d.el('plain',{tag:'DIV',parent:host,box:[0,150,300,40]});
 const hidden=d.el('gone',{parent:host,box:[0,200,50,20]});hidden.hidden=true;
 const c=walker(d);
 assert.deepEqual(Array.from(c.padItems(host),e=>e.id),['zone','sell'],'the zone card (its text inherits the hand), the Sell button inside the item card - not the card, not plain text, not a hidden button');
});

test('the highlight hovers for the pad, and a page drawn again under it puts it back where it stood',()=>{
 const d=dom(),host=d.el('talentFx',{tag:'DIV',box:[0,0,500,500]});
 const a=d.el('tnodeA',{tag:'DIV',parent:host,box:[0,0,40,40],cursor:'pointer'}),b=d.el('tnodeB',{tag:'DIV',parent:host,box:[0,100,40,40],cursor:'pointer'});
 const c=walker(d);c.padMark(a);c.padMark(b);
 assert.deepEqual(d.events,['tnodeA:mouseover','tnodeA:mouseenter','tnodeA:mouseout','tnodeA:mouseleave','tnodeB:mouseover','tnodeB:mouseenter'],'the Talent tree fills its text from mouseenter');
 /* the bag sold something: the node is gone, a new one stands where it stood */
 b.hidden=true;const again=d.el('tnodeB2',{tag:'DIV',parent:host,box:[0,98,40,40],cursor:'pointer'});
 c.padRehome(host);assert.equal(c.focus(),again);
});

test('LB/RB turn the tabs of a window, wrapping; in the side panel they turn its pages instead',()=>{
 const d=dom(),box=d.el('cfgBox',{tag:'DIV'});
 d.el('audio',{parent:box,attrs:{role:'tab','aria-selected':'false'}});d.el('video',{parent:box,attrs:{role:'tab','aria-selected':'true'}});d.el('controls',{parent:box,attrs:{role:'tab','aria-selected':'false'}});
 const c=walker(d);
 c.padTabStep(box,1);assert.deepEqual(d.clicks,['controls']);assert.equal(c.focus().id,'controls');
 d.order.forEach(t=>{if(t.attrs.role==='tab')t.attrs['aria-selected']=t.id==='controls'?'true':'false';});
 c.padTabStep(box,1);assert.deepEqual(d.clicks,['controls','audio'],'past the last tab: the first');
 const pages=[];const s=walker(dom());s.padSideOpen=step=>pages.push(step);
 const side=dom().el('p-hero',{tag:'DIV',cls:['panel','open']});
 s.padTabStep(side,-1);assert.deepEqual(pages,[-1]);
});

test('left/right step a drop-down through its options, and leave a slider that is not on screen alone',()=>{
 const d=dom(),box=d.el('cfgBox',{tag:'DIV'}),changes=[];
 const sel=d.el('resSel',{tag:'SELECT',parent:box});sel.options=[{},{},{}];sel.selectedIndex=0;sel.dispatchEvent=e=>changes.push(e.type);
 const c=walker(d);c.setFocus(sel);
 assert.equal(c.padAdjustRange(1),true);assert.equal(sel.selectedIndex,1);
 c.padAdjustRange(1);c.padAdjustRange(1);assert.equal(sel.selectedIndex,2,'stops at the last option');
 assert.deepEqual(changes,['change','change']);
 const pane=d.el('paneAudio',{tag:'DIV',parent:box});const slider=d.el('vol',{tag:'INPUT',parent:pane,attrs:{type:'range'}});
 slider.value='50';slider.min='0';slider.max='100';slider.step='1';pane.hidden=true;
 c.setFocus(slider);assert.equal(c.padAdjustRange(1),false,'a slider on a tab the mouse turned away from');assert.equal(slider.value,'50');
});

test('B: the side panel steps back out, the hero list and the sign-in do nothing, a new hero goes back, a window that is one big button ends',()=>{
 const d=dom(),calls=[];
 const $=id=>d.order.find(e=>e.id===id)||null;
 const c=vm.createContext({$,padItems:h=>d.order.filter(x=>x!==h&&h.contains(x)&&x.tagName==='BUTTON'),padSideClose:()=>calls.push('sideClose')});
 vm.runInContext(section('/* B backs out.','/* 🎰 the casino\'s windows'),c);
 const side=d.el('p-bag',{tag:'DIV',cls:['panel','open']});d.el('sell',{parent:side});
 assert.equal(c.padBack(side),true);assert.deepEqual(calls,['sideClose']);assert.deepEqual(d.clicks,[]);
 for(const id of ['select','login','ritualBox']){const s=d.el(id,{tag:'DIV'});d.el(id+'Last',{parent:s});assert.equal(c.padBack(s),false,id);}
 assert.deepEqual(d.clicks,[],'the hero list\'s last button exits the game - B never presses it');
 const create=d.el('create',{tag:'DIV'});d.el('createBack',{parent:create});d.el('startBtn',{parent:create});
 c.padBack(create);assert.deepEqual(d.clicks,['createBack']);
 const rite=d.el('enchCraftFx',{tag:'DIV'});rite.onclick=()=>{};c.padBack(rite);assert.deepEqual(d.clicks,['createBack','enchCraftFx']);
});

test('the pad answers every window and screen: the new ones are listed, the Extra Spin box before its machine, the screens last',()=>{
 const P=section('const PAD_PANELS=','let padSide=false;');
 const ids=[...P.matchAll(/'([A-Za-z]+)'/g)].map(m=>m[1]);
 for(const id of ['enchCraftFx','ritualBox','altarMsg','lbFx','create','select','login'])assert.ok(ids.includes(id),id);
 assert.ok(ids.indexOf('seaBuyFx')<ids.indexOf('seaFx'),'while the Extra Spin box asks, the d-pad reaches its YES and NO, not Auto under it');
 assert.ok(ids.indexOf('enchCraftFx')<ids.indexOf('enchFx'));
 assert.equal(ids[0],'confirmFx');assert.deepEqual(ids.slice(-3),['create','select','login']);
 for(const id of ids)assert.match(html+game,new RegExp('id=["\']'+id+'["\']|\\.id=\''+id+'\''),id+' exists');
});

/* the world half of padTick, run for real with the pad's buttons faked */
function world(hit,rep={},extra={}){
 const calls=[];
 const c=vm.createContext({padPollButtons(){},padHit:hit,padRep:rep,initAudio(){},HeroGuide:{isOpen:()=>false},casinoBack:()=>false,
  openSettings:()=>calls.push('settings'),padPanelOpen:()=>null,padFocus:null,padMark(){},gamePaused:false,inputMode:'pad',padInteract:()=>null,
  gameOn:true,S:{},hero:{dead:false,target:{id:'wolf'}},cast:(i,m)=>calls.push('cast '+i+(m?' manual':'')),usePot:(k,m)=>calls.push('pot '+k+(m?' manual':'')),
  nearestEnemyWithin:()=>({x:1,y:2,r:3}),ring(){},sfx:{bolt(){}},stageMsg:m=>calls.push('msg '+m),toggleMount:()=>calls.push('mount'),
  padSideOpen:s=>calls.push('side '+s),isDesktopLayout:()=>true,toggleSide:()=>calls.push('toggleSide'),openTab(){},mineTrained:()=>false,
  toggleMining(){},padRZoom:0,setZoom(){},zoom:1,document:{querySelector:()=>null},padHostSwitch(){},...extra});
 vm.runInContext(section('function padTick(dt){','/* 🎮 what the buttons do in the menu on screen'),c);
 c.padTick(0.016);
 return {calls,c};
}
test('in the world: X, Y and LT cast, the d-pad drinks, targets and mounts, B lets go, View and LB/RB step into the side panel',()=>{
 assert.deepEqual(world({x:true,y:true,lt:true}).calls,['cast 0 manual','cast 1 manual','cast 2 manual']);
 assert.deepEqual(world({up:true}).calls,['pot hp manual']);
 assert.deepEqual(world({down:true}).calls,['pot mp manual']);
 assert.deepEqual(world({up:true,down:true},{up:true,down:true}).calls,[],'a held d-pad drinks once, not every repeat');
 const t=world({left:true});assert.deepEqual(t.c.hero.target,{x:1,y:2,r:3});
 assert.deepEqual(world({left:true},{},{nearestEnemyWithin:()=>null}).calls,['msg No foe nearby']);
 assert.deepEqual(world({right:true}).calls,['mount']);
 const b=world({b:true});assert.equal(b.c.hero.target,null);
 assert.deepEqual(world({back:true}).calls,['side 0']);
 assert.deepEqual(world({lb:true}).calls,['side -1']);assert.deepEqual(world({rb:true}).calls,['side 1']);
 assert.deepEqual(world({x:true},{},{gamePaused:true}).calls,[],'paused: nothing in the world answers');
 assert.deepEqual(world({up:true},{},{hero:{dead:true}}).calls,[],'a fallen hero drinks nothing');
});

test('the side panel: stepped into on the page it shows or the next one, walked, and stepped out of',()=>{
 const d=dom(),opened=[];let side=false;
 const page=d.el('p-map',{tag:'DIV',cls:['panel','open']});d.el('zoneA',{parent:page});
 const c=vm.createContext({gameOn:true,S:{},isDesktopLayout:()=>true,sideHidden:true,toggleSide:v=>{c.sideHidden=v;},desktopSideTab:'map',
  openTab:t=>opened.push(t),document:{querySelector:()=>page,activeElement:null,querySelectorAll:()=>[]},padMark(){},padMenuStep:(h,dd)=>opened.push('walk '+h.id),world:{}});
 vm.runInContext('let padSide=false,padSideWorld=null;function padSideLayer(){return padSide?'+'document.querySelector(".panel.open"):null;}'
  +section('const PAD_SIDE_TABS=','function padAdjustRange(')+'\nglobalThis.isIn=()=>padSide;',c);
 c.padSideOpen(0);assert.equal(c.sideHidden,false,'a folded panel unfolds');assert.deepEqual(opened,['walk p-map'],'the page it shows, with a highlight in it');
 assert.equal(c.isIn(),true);
 opened.length=0;c.padSideOpen(1);assert.deepEqual(opened,['bag','walk p-map']);
 opened.length=0;c.desktopSideTab='tides';c.padSideOpen(-1);assert.deepEqual(opened.slice(0,1),['shop'],'a side page of the hero counts as the hero: before it comes the shop');
 c.padSideClose();assert.equal(c.isIn(),false);
 c.isDesktopLayout=()=>false;opened.length=0;c.padSideOpen(0);c.padSideClose();assert.deepEqual(opened.slice(-1),['battle'],'narrow, stepping out shows the world');
});

test('a held d-pad walks a long list by itself - after a beat, then briskly - and marks those repeats',()=>{
 let now=0;const btn=Array.from({length:17},()=>({pressed:false,value:0}));
 const pad={connected:true,mapping:'standard',index:0,axes:[0,0,0,0],buttons:btn};
 const c=vm.createContext({navigator:{getGamepads:()=>[pad]},performance:{now:()=>now},padPadIndex:0,padLeftPair:0,padCal:{0:{rested:[true,true,true,true],moved:[false,false,false,false]}},
  PAD_DEAD:0.22,setInputMode(){}});
 vm.runInContext(section('const PAD_B=','/* ---------- what an A press means when a panel is open')+'\nglobalThis.state=()=>({hit:padHit,rep:padRep});',c);
 const at=ms=>{now=ms;c.padPollButtons();return c.state();};
 btn[13].pressed=true;
 assert.equal(at(0).hit.down,true);assert.equal(at(0).rep.down,undefined,'the press itself is no repeat');
 assert.equal(at(200).hit.down,undefined);assert.equal(at(370).hit.down,undefined);
 let s=at(380);assert.equal(s.hit.down,true);assert.equal(s.rep.down,true);
 assert.equal(at(440).hit.down,undefined);assert.equal(at(475).hit.down,true,'then every 95 ms');
 btn[13].pressed=false;assert.equal(at(600).hit.down,undefined);
 /* the right stick is scroll in a menu */
 pad.axes[3]=-1;assert.ok(at(700).hit.rs>0,'pushed up: a positive scroll, up the page');
});

test('the hints name the buttons of the menu on screen, only while the pad drives',()=>{
 const el={innerHTML:'',classList:{on:false,toggle(n,v){this.on=v;}}};
 let now={host:null,mode:'pad'};
 const c=vm.createContext({$:()=>el,get inputMode(){return now.mode;},padPanelOpen:()=>now.host});
 vm.runInContext(section('const PAD_NOBACK=','function padBack(')+section('let padHintKey=','window.addEventListener(\'gamepaddisconnected\''),c);
 const mk=(host,mode)=>{now={host,mode};c.padHintsTick();return el;};
 const tab=(disabled=false)=>({disabled}),none=()=>[];
 const tabs={classList:{contains:()=>false},querySelectorAll:()=>[tab(),tab()]},panel={classList:{contains:n=>n==='panel'},querySelectorAll:none},box={classList:{contains:()=>false},querySelectorAll:none};
 assert.match(mk(tabs,'pad').innerHTML,/<b>A<\/b>Select<b>B<\/b>Back<b>LB<\/b><b>RB<\/b>Tabs<b>RS<\/b>Scroll/);assert.equal(el.classList.on,true);
 assert.match(mk(panel,'pad').innerHTML,/<b>B<\/b>Close<b>LB<\/b><b>RB<\/b>Pages/);
 assert.doesNotMatch(mk(box,'pad').innerHTML,/LB/);
 assert.equal(mk(box,'kb').innerHTML,'');assert.equal(el.classList.on,false,'the keyboard took over: no hints');
 assert.doesNotMatch(mk({classList:{contains:()=>false},querySelectorAll:()=>[tab(true),tab(true),tab(true)]},'pad').innerHTML,/Tabs/,'a Ledger not yet chartered: every tab greyed, nothing to turn');
 for(const id of ['select','login']){const h=mk({id,classList:{contains:()=>false},querySelectorAll:none},'pad').innerHTML;assert.doesNotMatch(h,/<b>B<\/b>/,id+': B does nothing there');assert.match(h,/<b>A<\/b>Select/);}
 assert.match(html,/<div id="padHints" aria-hidden="true"><\/div>/);
 assert.ok(+css.match(/#padHints\{[^}]*z-index:(\d+)/)[1]>120,'drawn above the confirm box');
});

test('the pad works on the hero list, a new hero and the sign-in; the Controls tab lists the pad; the small fixes hold',()=>{
 const frame=section('function frame(t){','\nconst sidebarResize=');
 assert.match(frame,/\}else if\(!gameOn\)\{padNow=null;padTick\(dt\);\}/);
 assert.match(frame,/padHintsTick\(\);/);
 /* since 2026-10-01 the pad has its own Gamepad tab beside Keyboard & Mouse (tests/controls-tabs.test.cjs draws it) */
 const controls=section('function renderControls(){','selectTab(controlsTabs,');
 for(const k of ["['LS','Walk','Left stick']","[['View','Side panel']]","[['LB','Previous page']]","[['RB','Next page']]","['←','Target foe','D-pad ←']","[['Start','Settings']]","['head','In menus']"])assert.ok(controls.includes(k),k);
 assert.doesNotMatch(section('function renderControls(){','$(\'kbdList\').innerHTML='),/Left stick|'Controller'/,'the keyboard\'s list is the keyboard\'s');
 assert.match(section('function openBJ(){','function bjTeardown(){'),/bjTurnAt=performance\.now\(\);/,'the press that opened the table must not deal a hand too');
 assert.match(section('function updateCaseScrap(){','function hideChestFx(){'),/if\(padFocus===cs\)padMark\(\$\('caseClose'\)\)/,'from a hidden Scrap the pad goes to Close, never Respin or Auto');
 assert.match(game,/const PAD_B=\{a:0,b:1,x:2,y:3,lb:4,rb:5,lt:6,rt:7,back:8,start:9,l3:10,r3:11,up:12,down:13,left:14,right:15\}/);
});

/* ---- the real-page check (2026-09-30), a pad in headless Edge: what it found, pinned ---- */

test('the pad\'s hidden pointer hides nothing from the walk, and a Bag rarity heading stays beside its own Scrap All',()=>{
 const d=dom(),host=d.el('p-map',{tag:'DIV',box:[0,0,300,600]});
 d.el('zoneCard',{tag:'DIV',parent:host,box:[0,0,300,50],cursor:'url(bronze_a_grab_32.png) 16 12, pointer'});
 const cls=new Set(['padcursor']);d.document.body={classList:{contains:n=>cls.has(n),add:n=>cls.add(n),remove:n=>cls.delete(n)}};
 /* body.padcursor sets every cursor to none: read with it on, the Map had no zones, the Talent tree no nodes */
 const c=walker(d,{getComputedStyle:x=>({cursor:cls.has('padcursor')?'none':x.cursor,visibility:'visible',overflowY:'visible'})});
 assert.deepEqual(Array.from(c.padItems(host),e=>e.id),['zoneCard']);
 assert.equal(cls.has('padcursor'),true,'and the pointer is hidden again after the look');
 const d2=dom(),bag=d2.el('p-bag',{tag:'DIV',box:[0,0,300,600]});
 const head=d2.el('rareGear',{tag:'DIV',parent:bag,box:[0,0,300,40],cursor:'pointer',cls:['tierhead']});
 d2.el('scrapRare',{parent:head,box:[220,5,60,30]});
 assert.deepEqual(Array.from(walker(d2).padItems(bag),e=>e.id),['rareGear','scrapRare'],'the heading opens the gear under it - dropped, Equip and Sell were out of reach');
 assert.match(game,/\[data-rb\],\[data-tal\]';/,'every Talent node is walkable, taken and locked ones too');
});

test('a neighbour a few pixels lower is on the same row, and up/down go to the next line, onto what lies under the highlight',()=>{
 const go=(c,host,from,dir)=>{c.setFocus(from);c.padMenuStep(host,dir==='up'||dir==='left'?-1:1,dir);return c.focus().id;};
 /* the Bag: Equip and Sell on a row, Sell 3 px lower; the next card 300 px down, its Scrap 3 px right of Sell */
 let d=dom(),host=d.el('p-bag',{tag:'DIV',box:[0,0,400,800]});
 const eq=d.el('equip',{parent:host,box:[200,100,60,30]}),sell=d.el('sell',{parent:host,box:[270,103,60,30]});
 d.el('equip2',{parent:host,box:[100,400,60,30]});d.el('scrap2',{parent:host,box:[273,400,60,30]});
 let c=walker(d);
 assert.equal(go(c,host,eq,'right'),'sell');
 assert.equal(go(c,host,sell,'right'),'equip2','the end of the row: on in reading order - it hopped 300 px down to the Scrap below');
 assert.equal(go(c,host,sell,'left'),'equip');
 /* the sign-in: down from the wide password field lands on Sign in, the first of the two buttons under it */
 d=dom();host=d.el('login',{tag:'DIV',box:[0,0,300,300]});
 const pass=d.el('fbPass',{tag:'INPUT',parent:host,box:[0,0,300,40]});d.el('fbLogin',{parent:host,box:[0,60,100,40]});d.el('fbSignup',{parent:host,box:[110,60,190,40]});
 c=walker(d);assert.equal(go(c,host,pass,'down'),'fbLogin','it went to Create account and skipped Sign in');
 /* Settings, Video: down from the tab reaches the small checkbox on the next line, not the wide drop-down further on */
 d=dom();host=d.el('cfgBox',{tag:'DIV',box:[0,0,400,400]});
 const video=d.el('videoTab',{parent:host,box:[100,0,80,30]});d.el('windowed',{tag:'INPUT',parent:host,box:[10,50,16,16]});
 d.el('fps',{tag:'INPUT',parent:host,box:[10,80,16,16]});d.el('resSel',{tag:'SELECT',parent:host,box:[0,120,300,30]});
 c=walker(d);assert.equal(go(c,host,video,'down'),'windowed');
 /* the hero list: right from Enter World has nothing on its row - it no longer leaps up to Settings */
 d=dom();host=d.el('select',{tag:'DIV',box:[0,0,1000,800]});
 d.el('selCfgBtn',{parent:host,box:[900,10,80,30]});const enter=d.el('enter1',{parent:host,box:[600,200,120,40]});d.el('del1',{parent:host,box:[600,250,120,30]});
 c=walker(d);assert.equal(go(c,host,enter,'right'),'del1');
});

test('a greyed safe choice holds the first highlight, so A waits on it: a chest\'s Close while the reel turns, never Auto spin',()=>{
 const d=dom(),chest=d.el('chestFx',{tag:'DIV',box:[0,0,400,400]});
 const auto=d.el('caseAutoBtn',{parent:chest,box:[50,300,100,40]});d.el('respinBtn',{parent:chest,box:[160,300,100,40]}).disabled=true;
 const close=d.el('caseClose',{parent:chest,box:[100,350,100,40],attrs:{'data-pad-first':''}});close.disabled=true;
 const c=walker(d);c.padMenuStep(chest,1);
 assert.equal(c.focus(),close,'the first control shown was Auto spin, and the next A spent the purse');
 close.click();assert.deepEqual(d.clicks,[],'A on it is nothing while it is greyed');
 c.padMenuStep(chest,-1,'up');assert.equal(c.focus(),auto,'the d-pad still walks off it');
 assert.match(html,/id="caseClose" data-pad-first/);assert.match(html,/id="slotSpinBtn" data-pad-first/,'Lucky 7 starts on Spin, not on the bet\'s +');
 assert.match(game,/id="prNo" data-pad-first/);assert.match(game,/id="hcNo" data-pad-first/);
 assert.match(section('async function renderSelect(){','function showSelect(){'),/document\.querySelector\('#charList \[data-play\]'\);if\(firstPlay\)firstPlay\.dataset\.padFirst=''/,'the hero list starts on the first Enter World');
});

test('a box opened over the highlight starts clean, and closed puts the highlight back - never into the new box by position',()=>{
 const d=dom(),bag=d.el('p-bag',{tag:'DIV',box:[0,0,300,800],cls:['panel','open']});
 const sell=d.el('sell',{parent:bag,box:[200,500,60,30]});d.el('equip',{parent:bag,box:[100,500,60,30]});
 const c=walker(d);
 c.padHostSwitch(bag);c.padMark(sell);
 const confirm=d.el('confirmFx',{tag:'DIV',box:[0,0,300,300]}),yes=d.el('cfYes',{parent:confirm,box:[40,200,60,30]});
 c.padHostSwitch(confirm);assert.equal(c.focus(),null,'the confirm starts clean: its own Cancel comes with the first press');
 c.padMark(yes);
 /* Yes: the confirm is gone and the Bag drawn again - a new row stands where the sold one stood */
 confirm.hidden=true;sell.hidden=true;sell.isConnected=false;
 const again=d.el('sell2',{parent:bag,box:[200,502,60,30]});
 c.padHostSwitch(bag);assert.equal(c.focus(),again,'back on the row it left, not near where Yes was');
 /* a chest bought from the Shop with A: the button is drawn again and the chest window opens - the highlight stays out of it */
 const chest=d.el('chestFx',{tag:'DIV',box:[0,0,300,800]});d.el('caseAutoBtn',{parent:chest,box:[200,500,60,30]});
 again.isConnected=false;
 c.padHostSwitch(chest);assert.equal(c.focus(),null,'re-homed by position, it stood on Auto spin');
 c.padHostSwitch(null);c.padHostSwitch(bag);assert.equal(c.focus(),null,'back in the world, nothing under anything is kept');
 const tick=section('function padTick(dt){',' if(padFocus)padMark(null);');
 assert.ok(tick.indexOf('padHostSwitch(host);')<tick.indexOf('padRehome(host,'),'the switch comes before the re-home');
 /* re-homed, a control of the same kind comes first: after a sale the next Sell, not the heading's Scrap All that moved up */
 const d2=dom(),bag2=d2.el('p-bag',{tag:'DIV',box:[0,0,400,900]});
 const sold=d2.el('sold',{parent:bag2,box:[300,500,70,30]});sold.dataset.sell='3';
 const w=walker(d2);w.padMark(sold);sold.hidden=true;sold.isConnected=false;
 const scrapAll=d2.el('scrapAllRare',{parent:bag2,box:[300,497,70,30]});scrapAll.dataset.scrrar='rare';
 const nextSell=d2.el('nextSell',{parent:bag2,box:[300,560,70,30]});nextSell.dataset.sell='4';
 w.padRehome(bag2,sold);assert.equal(w.focus(),nextSell);
 w.padMark(null);w.padMark(scrapAll);scrapAll.hidden=true;scrapAll.isConnected=false;
 w.padRehome(bag2,null);assert.equal(w.focus(),nextSell,'nothing to match: the nearest');
});

test('the right stick scrolls, and the highlight comes along to what is still in view',()=>{
 const d=dom(),host=d.el('lbFx',{tag:'DIV',box:[0,0,300,300]});
 const list=d.el('lbList',{tag:'DIV',parent:host,box:[0,0,300,200]});
 Object.assign(list,{scrollTop:0,scrollHeight:1000,clientHeight:200});
 const rows=[];
 for(let k=0;k<10;k++){const r=d.el('row'+k,{parent:list,box:[0,k*100,300,40]});r.getBoundingClientRect=()=>{const t=r.box[1]-list.scrollTop;return {left:0,top:t,width:300,height:40,right:300,bottom:t+40};};rows.push(r);}
 const c=walker(d,{getComputedStyle:x=>({cursor:'auto',visibility:'visible',overflowY:x===list?'auto':'visible'})});
 c.setFocus(rows[0]);c.padScroll(host,-1,0.5);
 assert.equal(list.scrollTop,450);assert.equal(c.focus().id,'row5','the highlight was left off-screen, and A pressed what could not be seen');
});

test('the right stick is the right stick on a standard pad, pushed first or not, and it scrolls the hero list before the world ever ran',()=>{
 const pad={connected:true,mapping:'standard',index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 const c=vm.createContext({navigator:{getGamepads:()=>[pad]},PAD_DEAD:0.22,padCal:{},padLeftPair:-1,padPadIndex:-1});
 vm.runInContext(section('function padStick(){','/* ---------- 🎮 buttons, the right stick'),c);
 assert.equal(c.padStick(),null);
 pad.axes[2]=1;assert.equal(c.padStick(),null,'the right stick pushed first walks nobody - it was taken for the walking one');
 pad.axes[2]=0;pad.axes[0]=1;assert.equal(c.padStick().x,1);
 /* the buttons' poll learns the rest itself: on the hero list padStick never runs */
 const pad2={connected:true,mapping:'standard',index:1,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 const b=vm.createContext({navigator:{getGamepads:()=>[pad2]},performance:{now:()=>0},padPadIndex:1,padLeftPair:2,padCal:{},PAD_DEAD:0.22,setInputMode(){}});
 vm.runInContext(section('const PAD_B=','/* ---------- what an A press means when a panel is open')+'\nglobalThis.hit=()=>padHit;',b);
 b.padPollButtons();pad2.axes[3]=1;b.padPollButtons();
 assert.ok(b.hit().rs<0,'pulled down: down the page');
});

test('the side panel lets go when the world changes: after the hero list, a new hero or a journey from the Map',()=>{
 const page={getClientRects:()=>[{}]};
 const c=vm.createContext({gameOn:true,world:{id:1},document:{querySelector:()=>page}});
 vm.runInContext(section('let padSide=false;','const padPanelOpen=')+'\nglobalThis.enter=()=>{padSide=true;padSideWorld=world;};globalThis.isIn=()=>padSide;',c);
 c.enter();assert.equal(c.padSideLayer(),page);
 c.world={id:2};assert.equal(c.padSideLayer(),null,'a new world: the stick walks again');assert.equal(c.isIn(),false);
 c.enter();c.gameOn=false;assert.equal(c.padSideLayer(),null,'the hero list');
 assert.match(section('function padSideOpen(step){','function padSideClose(){'),/padSide=true;padSideWorld=world;/);
});

test('the boxes built in script answer the pad: listed above Settings, B on their NO, Cancel or way out',()=>{
 const P=section('const PAD_PANELS=','let padSide=false;'),ids=[...P.matchAll(/'([A-Za-z]+)'/g)].map(m=>m[1]);
 for(const id of ['hcDeathOv','renameOv','prestigeConfirm','hcConfirm'])assert.ok(ids.indexOf(id)>0&&ids.indexOf(id)<ids.indexOf('cfgBox'),id);
 for(const id of ['raidModal','mpLobby'])assert.ok(ids.includes(id),id);
 const d=dom(),$=id=>d.order.find(e=>e.id===id)||null;
 const c=vm.createContext({$,padItems:h=>d.order.filter(x=>x!==h&&h.contains(x)&&x.tagName==='BUTTON'),padSideClose(){}});
 vm.runInContext(section('/* B backs out.','/* 🎰 the casino\'s windows'),c);
 for(const [id,btn] of [['renameOv','renameNo'],['prestigeConfirm','prNo'],['hcConfirm','hcNo'],['hcDeathOv','hcBackBtn'],['raidModal','raidCancel'],['mpLobby','mpLeaveBtn']]){
  const box=d.el(id,{tag:'DIV'});d.el(btn,{parent:box});d.el(id+'Yes',{parent:box});
  c.padBack(box);assert.equal(d.clicks.at(-1),btn,id);
 }
});

test('in the world RT folds the panel, or on a phone steps into the page; in the panel it folds it and steps out',()=>{
 assert.deepEqual(world({rt:true}).calls,['toggleSide']);
 assert.deepEqual(world({rt:true},{},{isDesktopLayout:()=>false}).calls,['side 0'],'a phone: opened alone, the d-pad drank potions under the page');
 const tabs=[];world({rt:true},{},{isDesktopLayout:()=>false,document:{querySelector:()=>({})},openTab:t=>tabs.push(t)});
 assert.deepEqual(tabs,['battle'],'a page up that the pad is not in: RT shows the world');
 assert.match(section('function padTick(dt){',' if(padFocus)padMark(null);'),/else if\(\(padHit\.back\|\|padHit\.rt\)&&host\.classList\.contains\('panel'\)\)\{[^\n]*\n   padSideClose\(\);\n   if\(padHit\.rt&&isDesktopLayout\(\)\)toggleSide\(true\);/);
});

test('small things for a pad player: Exit asks first, a held slider hurries, the mount says what the d-pad does',()=>{
 const asked=[],clicks=[];let mode='pad';
 const c=vm.createContext({get inputMode(){return mode;},confirmBox:(m,yes)=>asked.push({m,yes})});
 vm.runInContext(section('let exitSure=false;','$(\'exitBtn\').onclick=')+'\nglobalThis.ask=padAskExit;',c);
 const btn={click:()=>{clicks.push('press');if(!c.ask(btn))clicks.push('quit');}};
 btn.click();assert.deepEqual(clicks,['press']);assert.equal(asked[0].m,'Exit the game?');
 asked[0].yes();assert.deepEqual(clicks,['press','press','quit'],'Yes presses it again, and this time it goes');
 mode='kb';btn.click();assert.deepEqual(clicks.slice(-2),['press','quit'],'a mouse click is not asked');
 assert.match(game,/\$\('exitBtn'\)\.onclick=async\(\)=>\{\n if\(padAskExit\(\$\('exitBtn'\)\)\)return;/);
 assert.match(game,/\$\('selExitBtn'\)\.onclick=async\(\)=>\{if\(padAskExit\(\$\('selExitBtn'\)\)\)return;/);
 /* held, a slider hurries: a repeat moves a fortieth of its range */
 const d=dom(),box=d.el('cfgBox',{tag:'DIV'}),vol=d.el('vol',{tag:'INPUT',parent:box,attrs:{type:'range'}});
 Object.assign(vol,{value:'50',min:'0',max:'100',step:'1'});
 const held=walker(d,{padRep:{right:true}});held.setFocus(vol);held.padAdjustRange(1);assert.equal(vol.value,'53');
 const tap=walker(d,{padRep:{}});tap.setFocus(vol);tap.padAdjustRange(1);assert.equal(vol.value,'54','a press is one step');
 assert.match(game,/stageMsg\(inputMode==='pad'\?'Dismount with D-pad → before casting\.':'Dismount with X before casting\.',1000\)/);
 assert.match(section('function toggleMount(){','function updateMountButton(){'),/result\.reason==='empty'&&inputMode==='pad'\)stageMsg\('No mount yet'/);
 assert.match(css,/@media \(max-width:899px\)\{#padHints\{bottom:calc\(80px/,'a phone\'s pill sits above its nav bar');
 const keydown=section("window.addEventListener('keydown',e=>{","const k=e.key||'';");
 assert.match(keydown,/setInputMode\('kb'\);/,'any key hands the steering to the keyboard - over a casino table the hints stayed');
});
