/* ⚖️ The gallows, headless: the scene game.js plays when "Hang him on the square" is pressed on the Gaol tab. The
 * functions are sliced out of game.js and run against stubs - a City-shaped world, a real CityEconomy city - and
 * stepped at 30 fps. What is pinned: the blackout and the blinks, the square cleared (the well too) with the
 * scaffold where the well was, the old King and the gaoler on its deck, the nearest townsfolk in front and the hero
 * among them, the three speeches, the boos, the drop and the rope, the deed in the books only as the screen goes
 * black, and the square put back exactly as it was - the hero where they were. Run with node --test. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const slice=source.slice(source.indexOf('const GALLOWS={'),source.indexOf("let ledgerTab='overview'"));
const E=require('../assets/city/economy.js'),T=require('../assets/city/throne-world.js');
const W=16800,H=5200,cx=W/2,cy=H/2;
function harness(zone='city'){
 const s=E.create();E.charter(s);s.food.stock=1e6;s.trust=100;s.season.n=2;for(const k of Object.keys(s.council))s.council[k]=E.COUP_FAVOUR;
 assert.ok(E.claimCrown(s,'gaol').ok);
 const folk=[];for(let i=0;i<30;i++)folk.push({name:'Townsman '+i,skin:'male',x:cx+(i-15)*300,y:cy+(i%5)*200-400,pts:[{x:0,y:0}],i:0,dir:1,speed:30,walk:0,fx:1,pauseT:i%3,moving:i%2===0});
 const crier={name:'Utropare Måns',skin:'merchant',game:'crier',x:cx+118,y:cy+212,pts:[],i:0,dir:1,speed:0,walk:0,fx:-1,pauseT:1e9,moving:false};
 const well={x:cx,y:cy,r:26,type:'well'},fountain={x:cx-200,y:cy+120,r:20,type:'citywork',id:'fountain'},far={x:cx-2000,y:cy,r:20,type:'citywork'};
 const world={w:W,h:H,solids:[well,fountain,far],npcs:[...folk,crier]};
 const el={style:{}};
 const c={execution:null,coronation:null,world,S:{city:s,name:'Puffdaddy',gender:'f',zone:zone==='city'?7:3},hero:{x:1200,y:2600,fx:1,dead:false,walk:0,moving:false},pet:{x:0,y:0},
  zone,zoneOf:()=>({city:c.zone==='city'}),CITY_ZONE:7,expeditionSpawn:null,goToZone:i=>{c.calls.push('goToZone:'+i);c.zone=i===7?'city':'throne';c.S.zone=i;},
  cityImg:()=>({naturalWidth:871,naturalHeight:900}),ThroneWorld:T,cityCommoner:n=>!n.patrol&&!n.game&&!n.hidden&&!/^noble_/.test(n.skin||''),
  VW:800,VH:600,zoom:1,camX:0,camY:0,$:()=>el,blip(){},setTimeout(){},requestAnimationFrame(fn){fn();},marker:{},holdMove:{},shakeT:0,
  cityTitle:()=>'Queen',log:t=>c.logs.push(t),sfx:{warn(){},shout(){c.calls.push('sfx.shout');}},floatAt:(x,y,t)=>c.floats.push(t),
  CityEconomy:E,cityApplyAll(){c.calls.push('apply');},renderHUD(){},save(){c.calls.push('save');},stageMsg:t=>c.msgs.push(t),
  calls:[],logs:[],msgs:[],floats:[],el,city:s,well,fountain,far,crier,folk};
 vm.createContext(c);vm.runInContext(slice,c);
 c.squareHushed=vm.runInContext('squareHushed',c);c.GALLOWS=vm.runInContext('GALLOWS',c);   /* consts of the slice, not context properties */
 c.run=(secs,until)=>{for(let i=0;i<secs*30;i++){c.executionTick(1/30);if(until&&until())return true;}return false;};
 return c;
}

test('⚖️ the gallows: black, the square cleared, the scaffold where the well was, three speeches, the boos, the drop - and the deed in the books as the screen goes black; then everything put back',()=>{
 const c=harness(),s=c.city,hero=c.hero;
 assert.equal(c.startExecution('Nobody'),false,'only the one in for life');
 assert.equal(c.startExecution('Alarik Tidvind'),true);assert.equal(c.startExecution('Alarik Tidvind'),false,'one at a time');
 assert.equal(c.execution.phase,'dark');assert.equal(c.el.style.display,'block');assert.deepEqual([...Object.values(c.execution.back)],[7,1200,2600]);
 /* the eyes open on the square */
 assert.ok(c.run(2,()=>c.execution.staged));
 assert.equal(c.world.hush,true);assert.equal(c.squareHushed(c.well),true,'the well is gone');assert.equal(c.squareHushed(c.fountain),true);assert.equal(c.squareHushed(c.far),false,'the rest of the city stands');
 const g=c.world.solids.find(x=>x.type==='gallows');assert.ok(g);assert.equal(c.squareHushed(g),false);assert.deepEqual([g.x,g.y,g.w],[cx,cy+30,380]);assert.ok(g.sortY<cy-200,'drawn behind whoever stands on it');
 const king=c.execution.king,gaoler=c.execution.gaoler,deck=g.y-g.h*c.GALLOWS.deck;
 assert.equal(king.name,T.KING_NAME);assert.equal(king.y,deck);assert.equal(gaoler.name,T.GAOLER_NAME);assert.ok(Math.abs(gaoler.y-deck)<8,'both on the deck');
 assert.equal(c.execution.crowd.length,20,'the twenty nearest townsfolk');assert.ok(c.execution.crowd.every(m=>m.n.y>cy+100&&Math.abs(m.n.x-cx)<340&&m.n.pauseT===1e9),'in three rows before it, standing still');
 assert.ok(c.world.npcs.filter(n=>!n.extra).every(n=>n.scripted),'nobody else wanders in');assert.equal(c.crier.hidden,true);
 assert.deepEqual([hero.x,hero.y],[cx,cy+120],'the hero in the front row');assert.equal(c.camX,cx-400);
 assert.equal(s.deposed,'gaol');assert.ok(s.jail.some(p=>p.life),'nothing in the books yet');
 /* the blinks, then the gaoler */
 assert.ok(c.run(4,()=>c.execution.blink===5));
 assert.ok(c.run(2,()=>c.execution.phase==='one'));assert.equal(c.el.style.display,'none');assert.match(gaoler.bubble.txt,/Twelve years a King/);
 assert.ok(c.run(9,()=>c.execution.phase==='two'));assert.match(gaoler.bubble.txt,/poet put in irons/);
 assert.ok(c.run(9,()=>c.execution.phase==='three'));assert.match(gaoler.bubble.txt,/Queen Puffdaddy: he hangs/);assert.ok(c.floats.length>0,'the crowd boos');
 /* the drop */
 assert.ok(c.run(7,()=>c.execution.phase==='drop'));assert.ok(c.calls.includes('sfx.shout'));assert.equal(c.shakeT,.3);
 assert.ok(c.run(1,()=>king.hang!==undefined));assert.ok(Math.abs(king.y-(deck+52))<1e-9,'through the trap');assert.ok(g.rope&&g.rope.x===king.x&&g.rope.y<king.y,'the rope to the neck');
 assert.equal(s.deposed,'gaol','not yet');
 /* the screen goes black - and now it is done */
 assert.ok(c.run(4,()=>c.execution.phase==='fade'));assert.equal(c.el.style.display,'block');assert.equal(s.deposed,'gaol','not while there is still something to see');
 assert.ok(c.run(3,()=>c.execution.phase==='return'));
 assert.equal(s.deposed,'executed');assert.ok(!s.jail.some(p=>p.life));assert.equal(E.allyFear(s),.85);
 assert.ok(!c.world.solids.some(x=>x.type==='gallows'),'the scaffold is gone');assert.ok(c.world.solids.includes(c.well),'the well is back');assert.equal(c.world.hush,false);
 assert.ok(!c.world.npcs.some(n=>n.extra),'the King and the gaoler are gone');assert.equal(c.crier.hidden,false);
 for(const n of c.folk){const i=+n.name.split(' ')[1];assert.deepEqual([n.x,n.y,n.pauseT,n.scripted],[cx+(i-15)*300,cy+(i%5)*200-400,i%3,false],n.name+' back where he was');}
 assert.deepEqual([hero.x,hero.y],[1200,2600],'the hero where they were');assert.ok(c.calls.includes('apply')&&c.calls.includes('save'));assert.ok(!c.calls.some(x=>/goToZone/.test(x)),'same zone: no travel');
 assert.ok(c.run(3,()=>c.execution===null));assert.equal(c.el.style.display,'none');assert.ok(c.msgs.some(m=>/It is done/.test(m)));
});

test('⚖️ from the hall: the scene travels to the City and back, and the hero lands where they stood',()=>{
 const c=harness('throne');
 assert.ok(c.startExecution('Alarik Tidvind'));
 assert.ok(c.run(2,()=>c.execution.staged));assert.deepEqual(c.calls.filter(x=>/goToZone/.test(x)),['goToZone:7']);assert.equal(c.zone,'city');
 assert.ok(c.run(60,()=>c.execution.phase==='return'));
 assert.deepEqual(c.calls.filter(x=>/goToZone/.test(x)),['goToZone:7','goToZone:3']);assert.deepEqual({...c.expeditionSpawn},{zone:3,x:1200,y:2600});assert.equal(c.city.deposed,'executed');
 assert.ok(c.run(3,()=>c.execution===null));
});
