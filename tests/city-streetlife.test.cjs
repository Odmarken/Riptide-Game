/* The temper of the people, as the street wears it: fires, barricades, a bread queue and beggars when
 * it goes badly; flowers, garlands, a maypole, fiddlers, long tables and fireworks when it goes well;
 * snow, crosses on the doors and show tents by the season - pure functions of a look and the clock.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const Works=require('../assets/city/city-works.js');

function city(){
 const w=16800,h=5200,solids=[];
 for(let x=700;x<16200;x+=260)for(const y of [960,1400,2380,2820,3800,4240])solids.push({type:'cityhouse',x,y,r:34,seed:x+y});
 return {w,h,streets:[{x0:300,y0:2600,x1:16500,y1:2600,w:280}],plazas:[{x:8400,y:2600,r:520}],solids};
}
function fakeContext(count){
 return new Proxy({createRadialGradient(){return{addColorStop(){}};},measureText:t=>({width:String(t).length*6}),fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',lineCap:'',globalAlpha:1},
 {get(o,k){if(k in o)return o[k];return(...args)=>{count.calls++;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),k+' got '+a);};},set(o,k,v){o[k]=v;return true;}});
}
const kinds=(w,street)=>Works.props(w,{works:{},stalls:0,street}).map(p=>p.kind);

test('an ordinary city puts nothing out; a glad one dances, a jubilant one feasts as well',()=>{
 const plain=Works.streetLife({mood:60,festival:0,relief:1});
 assert.deepEqual(plain,{maypole:false,music:false,feast:0,tents:false,breadline:0,barricades:false,beggars:0});
 assert.deepEqual(kinds(city(),plain),[]);
 const glad=Works.streetLife({mood:72,festival:1,relief:1});
 assert.ok(glad.music&&!glad.maypole&&!glad.feast);
 assert.ok(Works.streetLife({mood:60,festival:2,relief:1}).maypole,'tournaments put a maypole up even in a merely content city');
 const jubilant=Works.streetLife({mood:90,festival:2,relief:3});
 assert.ok(jubilant.maypole&&jubilant.music);assert.equal(jubilant.feast,2);
 const k=kinds(city(),jubilant);
 assert.equal(k.filter(x=>x==='feast').length,2);assert.ok(k.includes('maypole')&&k.includes('music'));
});

test('a city that goes badly shows it: a queue, beggars, and in a riot barricades and no dancing',()=>{
 const hungry=Works.streetLife({mood:50,festival:1,relief:3,hungry:2});
 assert.equal(hungry.breadline,2);assert.equal(hungry.feast,0,'nobody lays a long table in a famine');assert.ok(hungry.beggars>=4);
 assert.equal(Works.streetLife({mood:60,festival:0,relief:0}).beggars,3,'no poor relief, beggars at the kerb');
 const riot=Works.streetLife({mood:15,festival:3,relief:3,protest:true});
 assert.ok(riot.barricades&&!riot.maypole&&!riot.music&&!riot.feast);
 const w=city(),p=Works.props(w,{works:{},stalls:0,street:riot,xMax:15500});
 assert.equal(p.filter(x=>x.kind==='barricade').length,4);
 assert.ok(p.every(x=>x.noCol),'none of it stands in anybody’s way');
 assert.ok(p.filter(x=>x.kind==='beggar').every(x=>Math.abs(x.x-8400)>580),'the beggars keep to the boulevard, off the square');
 assert.ok(kinds(w,Works.streetLife({mood:60,card:'fair'})).filter(x=>x==='tent').length===2);
});

test('how hard the city burns, and which houses: the same ones all close, others the next',()=>{
 assert.equal(Works.fireLevel({mood:60,watch:1}),0);assert.equal(Works.fireLevel({mood:60,watch:1,fireNews:true}),1);
 assert.equal(Works.fireLevel({mood:10,watch:0,protest:true,gang:true,fireNews:true}),4);
 const w=city(),houses=w.solids,burning=look=>houses.filter(h=>Works.dressing(h,look)==='fire');
 assert.equal(burning({fires:0,fireSeed:3}).length,0);
 const a=burning({fires:3,fireSeed:3}),again=burning({fires:3,fireSeed:3}),next=burning({fires:3,fireSeed:4});
 assert.ok(a.length>=3&&a.length<houses.length*.1,a.length+' of '+houses.length);
 assert.deepEqual(a,again);assert.notDeepEqual(a.map(h=>h.x+':'+h.y),next.map(h=>h.x+':'+h.y));
 assert.ok(burning({fires:4,fireSeed:3}).length>burning({fires:1,fireSeed:3}).length);
 const signed={...houses[0],work:{id:'school'}};
 assert.equal(Works.dressing(signed,{fires:4,fireSeed:1,joy:2}),null,'a house with a sign wears nothing else');
});

test('flowers at content, garlands at jubilant, crosses only in the sickness',()=>{
 const houses=city().solids,count=(look,kind)=>houses.filter(h=>Works.dressing(h,look)===kind).length;
 assert.equal(count({joy:0},'flowers')+count({joy:0},'garland'),0);
 assert.ok(count({joy:1},'flowers')>houses.length*.15);assert.equal(count({joy:1},'garland'),0);
 assert.ok(count({joy:2},'garland')>houses.length*.15&&count({joy:2},'flowers')>houses.length*.15);
 assert.equal(count({joy:0,card:'winter'},'plague'),0);assert.ok(count({joy:0,card:'sickness'},'plague')>5);
});

test('every new thing draws with finite geometry at any time of day',()=>{
 const count={calls:0},g=fakeContext(count),w=city();
 const all=Works.props(w,{works:{},stalls:0,xMax:15500,street:{maypole:true,music:true,feast:2,tents:true,breadline:2,barricades:true,beggars:8}});
 for(const kind of ['maypole','music','feast','tent','breadline','barricade','beggar'])assert.ok(all.some(p=>p.kind===kind),kind);
 for(const t of [0,1.37,999.5])for(const p of all){Works.drawShadow(g,p);Works.drawProp(g,p,t);}
 for(const kind of ['fire','plague','flowers','garland'])for(const t of [0,12.3])Works.drawDressing(g,kind,220,300,-290,t,41);
 const view={x:7600,y:1800,w:1600,h:1200};
 Works.drawSnow(g,view,5.5);Works.drawFireworks(g,w,view,0);Works.drawFireworks(g,w,view,7.77);
 const before=count.calls;Works.drawFireworks(g,w,{x:0,y:0,w:800,h:600},3);
 assert.equal(count.calls,before,'no fireworks are drawn when the square is nowhere near the screen');
 assert.ok(count.calls>500);
});

test('with its paintings loaded every prop, wagon and house sign is one blit; without them the canvas stand-ins still draw',()=>{
 const count={calls:0},g=fakeContext(count),w=city(),asked=new Set();let blits=0;
 const paint=new Proxy(g,{get(o,k){return k==='drawImage'?(...a)=>{blits++;for(const v of a.slice(1))assert.ok(Number.isFinite(v),'drawImage got '+v);}:o[k];},set(o,k,v){o[k]=v;return true;}});
 const img=n=>{asked.add(n);return {naturalWidth:640,naturalHeight:480};};
 const all=Works.props(w,{works:{aqueduct:'done',statue:'done',gardens:'done',lamps:'done',coveredmarket:'building'},stalls:8,crowned:true,hero:'Birgitta',xMax:15500,street:{maypole:true,music:true,feast:2,tents:true,breadline:2,barricades:true,beggars:8}});
 for(const p of all)Works.drawProp(paint,p,2.5,img);
 assert.equal(blits,all.length,'one painting per prop');
 for(const n of ['lamp','fountain','statue_crowned','garden','site','stall_bread','stall_fish','stall_greens','stall_cloth','maypole','music','feast','tent_red','tent_blue','breadline','beggar','barricade'])assert.ok(asked.has(n),n);
 blits=0;for(const t of Works.traffic(w,{wagons:4,migrants:2,xMax:15500},12))Works.drawTraffic(paint,t,12,img);
 assert.equal(blits,6);for(const n of ['wagon_barrels','wagon_caravan','wagon_grain','handcart'])assert.ok(asked.has(n),n);
 blits=0;Works.drawHouseWork(paint,{status:'building',sign:'LIBRARY',left:2,cat:'learn'},220,300,-290,1,img);Works.drawHouseWork(paint,{status:'seized',sign:'PLAYHOUSE',cat:'culture'},220,300,-290,1,img);
 Works.drawVacant(paint,220,300,-290,img);Works.drawDressing(paint,'flowers',220,300,-290,1,7,img);
 assert.equal(blits,5,'a scaffold, a seizure notice, a FOR RENT board and two tubs of flowers');
 const before=count.calls;blits=0;for(const p of all)Works.drawProp(paint,p,2.5,()=>null);
 assert.equal(blits,0);assert.ok(count.calls>before+300,'nothing loaded: canvas scenery only');
});

test('every painting the city asks for is on disk, and every finished work that wears a house has its own building',()=>{
 const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'..','assets','city');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'city-art-manifest.json'),'utf8'));
 for(const id of Object.keys(Works.ANCHORS))assert.ok(manifest.art['work_'+id+'.png']&&fs.existsSync(path.join(dir,'work_'+id+'.png')),'work_'+id);
 for(const file of Object.keys(manifest.art)){assert.ok(fs.existsSync(path.join(dir,file)),file);assert.match(manifest.art[file].jobId,/^[0-9a-f-]{36}$/);}
 assert.ok(Object.keys(manifest.art).length>=48);
});

test('hearth smoke rises from every painted chimney pot, and from none where the painting has none',()=>{
 const count={calls:0},g=fakeContext(count);
 for(const key of Object.keys(Works.CHIMNEYS)){
  const fs=require('node:fs'),path=require('node:path'),file=key==='training_lodge'?'training-lodge':key;
  assert.ok(['city','models','farm','wasteland'].some(dir=>fs.existsSync(path.join(__dirname,'..','assets',dir,file+'.png'))),key+' has a painting');
  for(const [u,v,size=1] of Works.CHIMNEYS[key])assert.ok(u>0&&u<1&&v>=0&&v<.3&&size>=1&&size<=2,key+' pot off the roof: '+u+','+v);
  for(const t of [0,3.3,999])assert.equal(Works.drawSmoke(g,key,220,300,-290,t,41,t>100),Works.CHIMNEYS[key].length);
 }
 const before=count.calls;
 for(const key of ['house_stair','work_exchange','work_theatre','work_school','work_bathhouse','nothing'])assert.equal(Works.drawSmoke(g,key,220,300,-290,1,1),0,key);
 assert.equal(count.calls,before);assert.ok(before>300);
});
