/* 👑 The coronation, headless: the scene game.js plays when "Take the crown" is pressed. The functions are sliced out
 * of game.js and run against stubs - a real ThroneWorld hall, a real CityEconomy city - and stepped at 30 fps.
 * What is pinned: the blackout and the blinks, everybody in their place when the eyes open, the three speeches in
 * order, the King walked out by two of the guard and the crown changing hands at THAT moment (not before), the hero
 * walking up to the throne, and the hall emptying back to how it was. Run with node --test. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const slice=source.slice(source.indexOf('const CORONATION_LINES='),source.indexOf("let ledgerTab='overview'"));
const E=require('../assets/city/economy.js'),T=require('../assets/city/throne-world.js');
function harness(){
 const s=E.create();E.charter(s);s.food.stock=1e6;s.trust=100;s.season.n=2;for(const k of Object.keys(s.council))s.council[k]=E.COUP_FAVOUR;
 const world=T.create(),el={style:{}};
 const c={coronation:null,S:{city:s,name:'Puffdaddy',gender:'f'},hero:{x:900,y:3000,fx:1,dead:false,walk:0,moving:false},pet:{x:0,y:0},world,
  zoneOf:()=>({throne:true}),goToZone:()=>c.calls.push('goToZone'),THRONE_ZONE:0,ThroneWorld:T,$:()=>el,
  camX:0,camY:0,VW:800,VH:600,zoom:1,marker:{},holdMove:{},shakeT:0,
  cityRoster:()=>['Alrik','Bodil','Cederik','Disa','Emrik','Frida','Gorm','Halla'].map(name=>({name,skin:'male',female:false})),
  blip(){},setTimeout(){},requestAnimationFrame(fn){fn();},CityEconomy:E,cityTitle:()=>'Queen',log:t=>c.logs.push(t),sfx:{quest(){c.calls.push('sfx.quest');},warn(){c.calls.push('sfx.warn');}},
  stageMsg:t=>c.msgs.push(t),sparkles(){},burst(){},
  moveToward:(e,tx,ty,dt)=>{const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy);if(d<2)return true;const sp=Math.min(175*dt,d);e.x+=dx/d*sp;e.y+=dy/d*sp;e.moving=true;return false;},
  renderHero(){c.calls.push('renderHero');},renderHUD(){},save(){c.calls.push('save');},hallApply(){c.calls.push('hallApply');},
  cityApplyAll(){c.calls.push('apply');world.npcs=world.npcs.filter(n=>!(s.crowned&&n.game==='king'));},   /* what hallApply does to a crowned hall */
  calls:[],logs:[],msgs:[],el,city:s};
 vm.createContext(c);vm.runInContext(slice,c);
 c.run=(secs,until)=>{for(let i=0;i<secs*30;i++){c.coronationTick(1/30);if(until&&until())return true;}return false;};
 return c;
}
const front=T.DAIS.y+T.DAIS.h+100;

test('👑 the coronation: black, the eyes open on the hall, three speeches, the King walked to his gaol, the crown at that moment, the throne, and everybody home',()=>{
 const c=harness(),s=c.city,hero=c.hero;
 assert.equal(c.startCoronation('gaol'),true);assert.equal(c.startCoronation('gaol'),false,'one at a time');
 assert.equal(c.coronation.phase,'dark');assert.equal(c.el.style.display,'block');assert.equal(c.el.style.opacity,'1');
 /* the eyes open on the hall: everybody in place, the hero before the dais and not where they were */
 assert.ok(c.run(2,()=>c.coronation.staged));
 assert.deepEqual([hero.x,hero.y],[T.THRONE.x,front+30]);assert.equal(c.camX,hero.x-400);
 const king=c.world.npcs.find(n=>n.game==='king'),hand=c.world.npcs.find(n=>n.game==='ledger'),seats=c.world.npcs.filter(n=>n.seat);
 assert.deepEqual([king.x,king.y],[T.KING.x,T.KING.y]);assert.ok(Math.abs(hand.x-king.x)<100&&Math.abs(hand.y-king.y)<12,'the Hand at the King’s side');
 assert.ok(seats.every(n=>n.y===front-30&&n.scripted),'the council at the foot of the steps');
 const guards=c.world.npcs.filter(n=>n.guard),behind=guards.filter(n=>n.y>hero.y),extras=c.world.npcs.filter(n=>n.extra);
 assert.equal(behind.length,6,'the pillar guards form up behind the hero');assert.equal(c.coronation.escorts.length,2);
 assert.equal(extras.filter(n=>n.extraGuard).length,8,'extras fill the ranks to fourteen');assert.equal(extras.filter(n=>n.hop).length,8,'eight townsfolk on their toes');
 assert.ok(extras.every(n=>n.y>hero.y),'all of them behind the hero');
 assert.equal(s.crowned,false,'nothing has changed hands yet');
 /* three blinks, then awake, then the Hand */
 assert.ok(c.run(4,()=>c.coronation.blink===5));assert.equal(c.el.style.opacity,'0');
 assert.ok(c.run(2,()=>c.coronation.phase==='hand1'));assert.equal(c.el.style.display,'none');
 assert.match(hand.bubble.txt,/heard across the sea/);assert.match(hand.bubble.txt,/Queen Puffdaddy/);assert.equal(king.bubble,null);
 /* the King */
 assert.ok(c.run(10,()=>c.coronation.phase==='king'));assert.match(king.bubble.txt,/ENOUGH/);assert.equal(c.shakeT,.4);assert.equal(s.crowned,false);
 /* two of the guard step to his sides, then the three walk - the camera on the King - to the gaol stair */
 assert.ok(c.run(7,()=>c.coronation.phase==='flank'));
 assert.ok(c.run(3,()=>c.coronation.phase==='escort'));assert.equal(c.coronation.focus,king);
 c.coronationTick(1/30);   /* one step in: the escort is snapped to his arms every frame from here */
 const esc=c.coronation.escorts;assert.ok(esc.every(g=>Math.abs(g.y-king.y-8)<1&&Math.abs(Math.abs(g.x-king.x)-46)<1),'at his arms');
 assert.ok(c.run(20,()=>c.coronation.phase==='hand2'),'he is walked out');
 assert.equal(s.crowned,true,'the crown changed hands the moment he was gone');assert.equal(s.deposed,'gaol');assert.ok(s.jail.some(p=>p.life));
 assert.ok(!c.world.npcs.some(n=>n.game==='king'),'no King in the hall');assert.equal(c.coronation.focus,null);
 assert.match(hand.bubble.txt,/take the throne/);assert.ok(c.calls.includes('apply')&&c.calls.includes('save'));
 /* the hero walks up to the throne; the crowd goes up */
 assert.ok(c.run(3,()=>c.coronation.phase==='ascend'));
 assert.ok(c.run(6,()=>c.coronation.phase==='cheer'));
 assert.ok(Math.hypot(hero.x-T.KING.x,hero.y-T.KING.y)<8,'on the dais where the King stood');assert.ok(c.msgs.some(m=>/All hail Queen Puffdaddy/.test(m)));
 assert.ok(c.calls.includes('renderHero'),'the style before the name');
 /* everybody home */
 assert.ok(c.run(5,()=>c.coronation.phase==='disperse'));
 assert.ok(c.run(40,()=>c.coronation===null),'the hall empties');
 assert.ok(!c.world.npcs.some(n=>n.extra),'the townsfolk and the extra guard are gone');
 for(const n of seats){const seat=T.SEATS.find(x=>x.seat===n.seat);assert.deepEqual([n.x,n.y],[seat.x,seat.y],n.name+' back in the chamber');assert.equal(n.scripted,false);}
 assert.deepEqual([hand.x,hand.y],[T.HAND.x,T.HAND.y],'the Hand at his chair');
 for(const g of guards)assert.deepEqual([g.x,g.y],[g.home.x,g.home.y],g.name+' at his post');
 assert.ok(c.calls.includes('hallApply'));assert.ok(c.msgs.some(m=>/The hall is yours/.test(m)));
});

test('👑 exile: the King is walked out through the doors instead, and the escort comes back from there',()=>{
 const c=harness(),s=c.city;
 assert.ok(c.startCoronation('exile'));
 assert.ok(c.run(40,()=>c.coronation.phase==='escort'));
 const king=c.world.npcs.find(n=>n.game==='king');
 assert.deepEqual([...king.route[king.route.length-1]],[T.EXIT.x,T.EXIT.y-30]);   /* spread: the route was made in the vm realm */
 assert.ok(c.run(20,()=>c.coronation.phase==='hand2'));assert.equal(s.deposed,'exile');assert.ok(!s.jail.some(p=>p.life));
 assert.ok(c.run(60,()=>c.coronation===null));
});

test('👑 no crown, no scene: a steward the realm does not trust, or without a season, or mid-scene, is refused',()=>{
 const c=harness();c.city.trust=50;assert.equal(c.startCoronation('gaol'),false);assert.equal(c.coronation,null);assert.equal(c.el.style.display,undefined);
 const d=harness();d.city.season.n=1;assert.equal(d.startCoronation('gaol'),false);
 const e=harness();e.city.crowned=true;assert.equal(e.startCoronation('gaol'),false);
});
