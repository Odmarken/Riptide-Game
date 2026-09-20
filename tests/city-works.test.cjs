/* What the Crown Ledger looks like from the street: props for the works, signs and scaffolds on the
 * terrace houses, awnings by the fee, wagons and handcarts on the boulevard, refuse, bunting and
 * boarded-up houses - all pure functions of a look and the clock, drawn with finite geometry.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Works=require('../assets/city/city-works.js');
const E=require('../assets/city/economy.js');

/* a city the size of the real one: the grid's main streets, the great square, a terrace of houses */
function city(){
 const w=16800,h=5200,streets=[{x0:300,y0:2600,x1:16500,y1:2600,w:280},{x0:8400,y0:560,x1:8400,y1:4640,w:200},{x0:300,y0:1180,x1:16500,y1:1180,w:180},{x0:300,y0:4020,x1:16500,y1:4020,w:180}];
 const solids=[];
 for(let x=700;x<16200;x+=260)for(const y of [960,1400,2380,2820,3800,4240])solids.push({type:'cityhouse',x,y,r:34,seed:x+y});
 return {w,h,streets,plazas:[{x:8400,y:2600,r:520}],solids};
}
function fakeContext(count){
 return new Proxy({createRadialGradient(){return{addColorStop(){}};},createLinearGradient(){return{addColorStop(){}};},measureText:t=>({width:String(t).length*6}),
  fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',lineCap:'',globalAlpha:1},
 {get(o,k){if(k in o)return o[k];return(...args)=>{count.calls++;
  if(['fillRect','arc','ellipse','translate','scale','rotate','moveTo','lineTo','rect','quadraticCurveTo','bezierCurveTo','fillText'].includes(k))
   for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),k+' got '+a);};},set(o,k,v){if(k==='globalAlpha')assert.ok(Number.isFinite(v)&&v>=0&&v<=1,'alpha '+v);o[k]=v;return true;}});
}

test('an untouched city shows only its market; every work that has a site shows up once it is ordered',()=>{
 const w=city();
 const bare=Works.props(w,{works:{},stalls:4});
 assert.deepEqual(bare.map(p=>p.kind),['stall','stall','stall','stall']);
 assert.ok(bare.every(p=>p.type==='citywork'&&p.r>0&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const building=Works.props(w,{works:{aqueduct:'building',statue:'building',gardens:'building',coveredmarket:'building',lamps:'building'},left:{aqueduct:3},stalls:0});
 assert.equal(building.filter(p=>p.kind==='site').length,4);assert.equal(building.find(p=>p.work==='aqueduct').left,3);
 assert.ok(building.filter(p=>p.kind==='lamp').length>20&&building.filter(p=>p.kind==='lamp').every(p=>!p.lit&&p.noCol),'posts up, not yet lit');
 const done=Works.props(w,{works:{aqueduct:'done',statue:'done',gardens:'done',coveredmarket:'done',lamps:'done'},stalls:12,crowned:true,hero:'Birgitta',xMax:15500});
 for(const kind of ['fountain','statue','garden'])assert.equal(done.filter(p=>p.kind===kind).length,1,kind);
 assert.equal(done.filter(p=>p.kind==='site').length,0);assert.equal(done.filter(p=>p.kind==='stall').length,12);
 assert.ok(done.filter(p=>p.kind==='lamp').every(p=>p.lit&&p.x<=15500+260));
 assert.equal(done.find(p=>p.kind==='statue').crowned,true);assert.equal(done.find(p=>p.kind==='statue').hero,'Birgitta');
 assert.ok(done.filter(p=>p.kind==='stall').every(p=>p.covered));
 /* 🏦 what the bank has sold leaves nothing behind on the square - not even a building site */
 const sold=Works.props(w,{works:{aqueduct:'seized',statue:'seized',gardens:'seized',lamps:'seized',coveredmarket:'seized'},stalls:0});
 assert.deepEqual(sold,[]);
 /* nothing on the square stands in the carriageway of the boulevard or the avenue, or on the well */
 const c=w.plazas[0];
 for(const p of done.filter(p=>['fountain','statue','garden','site'].includes(p.kind)))assert.ok(Math.abs(p.y-c.y)>140+p.r&&Math.abs(p.x-c.x)>100+p.r,p.kind+' blocks a street');
 /* and no two props share a spot */
 for(const a of done)for(const b of done)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=30,a.kind+' on top of '+b.kind);
});

test('every work with a house site has an anchor and a signboard, and keeps its house whatever else is built',()=>{
 const housed=E.WORKS.filter(w=>w.site==='house').map(w=>w.id).sort();
 assert.deepEqual(Object.keys(Works.ANCHORS).sort(),housed);
 for(const w of E.WORKS)if(w.site&&w.site!=='house')assert.ok(['fountain','statue','garden','stalls','lamps'].includes(w.site),w.id);
 for(const c of E.WORK_CATS)assert.ok(Works.TINT[c.id],c.id+' has a pennant colour');
 const w=city();
 const one=Works.assignHouses(w,{works:{school:'building'},left:{school:1}});
 assert.equal(one.length,1);assert.equal(one[0].id,'school');assert.equal(one[0].status,'building');assert.equal(one[0].left,1);
 assert.equal(Works.assignHouses(w,{works:{school:'seized'}})[0].status,'seized','a seized work keeps its house, to wear the seal of the bank');
 const all={};for(const id of housed)all[id]='done';
 const every=Works.assignHouses(w,{works:all});
 assert.equal(every.length,housed.length);assert.equal(new Set(every.map(a=>a.house)).size,housed.length,'one house each');
 assert.equal(every.find(a=>a.id==='school').house,one[0].house,'the school did not move when the rest were built');
 for(const a of every){const [ax,ay]=Works.ANCHORS[a.id];assert.ok(Math.hypot(a.house.x-ax,a.house.y-ay)<700,a.id+' is near where it was meant to be');}
});

test('the market shrinks with the fee and grows with the covered market and the population',()=>{
 assert.deepEqual([0,1,2,3].map(f=>Works.stallCount(f,false,350)),[6,4,3,1]);
 assert.equal(Works.stallCount(1,true,350),9);assert.equal(Works.stallCount(1,false,800),7,'a bigger city fills more pitches');assert.equal(Works.stallCount(0,true,5000),12,'twelve pitches and no more');
 assert.equal(Works.stallSlots(city()).length,12);
});

test('traffic is a function of the clock: wagons by the trade, handcarts in or out by the city\'s draw',()=>{
 const w=city();
 assert.deepEqual(Works.traffic(w,{wagons:0,migrants:0},10),[]);
 const busy=Works.traffic(w,{wagons:5,migrants:3,xMax:15500},42.5);
 assert.equal(busy.filter(t=>t.kind==='wagon').length,5);assert.equal(busy.filter(t=>t.kind==='handcart').length,3);
 assert.ok(busy.filter(t=>t.kind==='handcart').every(t=>t.dir===1&&!t.leaving),'moving in: eastward from the gate');
 const leaving=Works.traffic(w,{wagons:0,migrants:-4},42.5);
 assert.equal(leaving.length,4);assert.ok(leaving.every(t=>t.dir===-1&&t.leaving),'moving out: westward to the gate');
 assert.ok(busy.some(t=>t.dir===1)&&busy.some(t=>t.dir===-1),'wagons run both ways');
 for(const t of busy.concat(leaving)){assert.ok(t.x>=420&&t.x<=15700&&Math.abs(t.y-2600)<140,'on the boulevard');assert.ok(t.fade>=0&&t.fade<=1);}
 /* it moves, it is the same at the same instant, and it never jumps mid-road */
 assert.deepEqual(Works.traffic(w,{wagons:5,migrants:3,xMax:15500},42.5),busy);
 const a=Works.traffic(w,{wagons:1},100)[0],b=Works.traffic(w,{wagons:1},100.1)[0];
 assert.ok(b.x>a.x&&b.x-a.x<10);
 assert.equal(Works.traffic(w,{wagons:99,migrants:99},1).length,12,'capped');
});

test('refuse lies on the streets only, more of it the dirtier the city; bunting spans the boulevard in view',()=>{
 const w=city(),view={x:4000,y:2000,w:2400,h:1300};
 assert.deepEqual(Works.litter(w,view,0),[]);
 const some=Works.litter(w,view,1),lots=Works.litter(w,view,3);
 assert.ok(lots.length>some.length*2&&some.length>=1,some.length+' against '+lots.length);
 assert.ok(lots.every(p=>Works.onStreet(w,p.x,p.y,26)));assert.ok(lots.some(p=>p.big)&&!some.some(p=>p.big));
 assert.deepEqual(Works.litter(w,view,3),lots,'the same heaps every frame');
 assert.deepEqual(Works.bunting(w,view,0),[]);
 const few=Works.bunting(w,view,1),many=Works.bunting(w,view,3);
 assert.ok(many.length>few.length&&few.length>=1);assert.ok(many.every(b=>b.gold&&b.x>=view.x-40&&b.x<=view.x+view.w+40&&b.y0<2600&&b.y1>2600));
 assert.deepEqual(Works.bunting(w,{x:4000,y:200,w:2400,h:600},3),[],'none when the boulevard is off screen');
 assert.ok(!Works.bunting(w,{x:7600,y:2000,w:1600,h:1300},3).some(b=>Math.abs(b.x-8400)<560),'none across the great square');
});

test('houses empty as the population falls, never one that carries a work',()=>{
 const w=city(),houses=w.solids;
 assert.equal(houses.filter(h=>Works.vacant(h,0)).length,0);
 const third=houses.filter(h=>Works.vacant(h,.35)).length/houses.length;
 assert.ok(third>.25&&third<.45,'about a third: '+third.toFixed(2));
 assert.ok(houses.filter(h=>Works.vacant(h,.35)).every(h=>Works.vacant(h,.7)),'a house that is empty stays empty as it gets worse');
 const h=houses.find(x=>Works.vacant(x,.7));assert.equal(Works.vacant({...h,work:{id:'school'}},.7),false);
});

test('everything draws with finite geometry at any instant',()=>{
 const count={calls:0},g=fakeContext(count),w=city();
 const look={works:{aqueduct:'done',statue:'done',gardens:'done',coveredmarket:'building',lamps:'done'},left:{coveredmarket:2},stalls:12,crowned:true,hero:'Birgitta',wagons:6,migrants:-3,xMax:15500};
 for(const time of [0,1.37,999.9]){
  for(const p of Works.props(w,look)){Works.drawShadow(g,p);Works.drawProp(g,p,time);}
  for(const p of Works.props(w,{works:{lamps:'building'},stalls:0}))Works.drawProp(g,p,time);
  for(const t of Works.traffic(w,look,time))Works.drawTraffic(g,t,time);
  for(const t of Works.traffic(w,{wagons:4,migrants:4},time))Works.drawTraffic(g,t,time);
  Works.drawLitter(g,w,{x:4000,y:2000,w:2400,h:1300},3,time);
  for(const b of Works.bunting(w,{x:4000,y:2000,w:2400,h:1300},3))Works.drawBunting(g,b,time);
  for(const status of ['building','done','seized'])for(const def of E.WORKS.filter(x=>x.site==='house'))
   Works.drawHouseWork(g,{id:def.id,status,left:2,sign:def.sign,icon:def.icon,cat:def.cat},260,300,-290,time);
  Works.drawHouseWork(g,{id:'x',status:'done',left:0,sign:'X',icon:'x',cat:'nope'},0,0,0,time);
  Works.drawVacant(g,260,300,-290);
 }
 assert.ok(count.calls>5000,'drew '+count.calls);
});

test('game.js hands the streets to the ledger: the look, the props, the people, the gaol and the panel are wired',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 for(const hook of ['CityWorks.props(world,look)','CityWorks.assignHouses(world,look)','CityWorks.drawHouseWork(','CityWorks.drawVacant(','CityWorks.drawLitter(','CityWorks.traffic(world,world.look,now)',
  'CityWorks.bunting(','CityWorks.drawProp(ctx,s,','CityWorks.drawShadow(ctx,s)','ThroneWorld.prisoner(','hallStair(T.GAOL_ARRIVE','hallStair(T.HALL_ARRIVE','E.claimCrown(c,v)','E.invest(c,cityContext(),k)','roster:cityRoster()',
  'E.charter(c)','function ledgerCharter(','function ledgerSeasonCard(','function ledgerGranary(','live:true','CityEconomy.attend(S.city)','fmtRough(','function ledgerSeasonChart(','function ledgerBank(','seasonChartHover','E.rehire(c,cityContext())',"works[id]='seized'",'CityEconomy.ROYAL_GUARD-c.guards'])
  assert.ok(src.includes(hook),'missing '+hook);
 assert.ok(/function cityApplyAll\(\)\{cityApplyPeople\(\);cityApplyProtest\(\);cityApplyUnrest\(\);cityApplyWatch\(\);cityApplyWorks\(\);/.test(src));
 for(const tab of ['works','crown','gaol'])assert.ok(html.includes('data-ltab="'+tab+'"'),tab+' tab');
 assert.ok(html.indexOf('assets/city/city-works.js')>html.indexOf('assets/city/economy.js')&&html.indexOf('assets/city/city-works.js')<html.indexOf('game.js?'),'city-works loads between the economy and the game');
});
