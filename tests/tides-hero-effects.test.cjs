/* Execute the production Tide hero block with the real equipment effect helpers. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('assets/tides/ui.js'),game=read('game.js');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function matrix(a=1,b=0,c=0,d=1,e=0,f=0){return {a,b,c,d,e,f,inverse(){const k=a*d-b*c;return matrix(d/k,-b/k,-c/k,a/k,(c*f-d*e)/k,(b*e-a*f)/k);}};}
function harness(){
 const calls=[],stack=[];let transform=matrix(2,0,0,2);
 const g={save(){stack.push({transform,alpha:this.globalAlpha});},restore(){const s=stack.pop();assert.ok(s);transform=s.transform;this.globalAlpha=s.alpha;},
  translate(x,y){const m=transform;transform=matrix(m.a,m.b,m.c,m.d,m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f);},
  scale(x,y){const m=transform;transform=matrix(m.a*x,m.b*x,m.c*y,m.d*y,m.e,m.f);},getTransform:()=>transform,
  drawImage(img,...rect){calls.push({type:'ring',img,rect,matrix:transform});},globalAlpha:1};
 const rune={id:'veinseeker',glow:'#bf4450'},ring={legend:'thering'},frame={headY:-42,groundY:9,boots:{bw:10}};
 const c={g,calls,S:{race:'human',cls:'hunter',gender:'f',hideName:true,gear:{armor:{ice:true},weapon:{wench:rune.id},trinket:ring}},
  hero:{dead:false},session:{time:0},layout:{heroX:100,heroScale:4},floor:300,parts:[],gamePaused:false,
  performance:{now:()=>900000},theRingImg:{complete:true,naturalWidth:100,naturalHeight:50},mip:img=>img,
  isRing:it=>it===ring,wenchById:id=>id===rune.id?rune:null,isIce:it=>!!it?.ice,isFK:()=>false,isFG:()=>false,
  paintedCharacterFrame:(...args)=>{calls.push({type:'frame',args});return frame;},bootFeet:()=>calls.push({type:'boots'}),
  drawRuneParticle:(_g,p)=>calls.push({type:'particle',p:{...p},matrix:transform}),
 };
 vm.createContext(c);vm.runInContext(read('assets/weapons/rune-effects.js')+'\n'+section(game,'function drawEquippedRing(','function drawHero(){')+'\n'+game.match(/^const heroWeaponArgs=.*$/m)[0]+'\n'+game.match(/^const heroRing=.*$/m)[0],c);
 c.drawChampionSprite=(...args)=>{
  calls.push({type:'champion',args});
  return args[11]?c.runeEmitter(g,{key:'real-weapon',profile:{emit:[[.2,.8]]}},-10,-30,50,40):null;
 };
 const block=section(ui,'  // Use the same equipped cosmetics as the world hero,','  drawAnimal(g,b.player.speciesId');
 vm.runInContext('globalThis.paintHero=function(){'+block+'};',c);
 return {c,calls,stack,ring,rune,frame};
}

test('the battle hero keeps the equipped rune and Ring, regardless of hidden name, in its enlarged coordinates',()=>{
 const h=harness(),{c,calls}=h;c.paintHero();
 const champion=calls.find(x=>x.type==='champion');
 assert.equal(champion.args[1],'human');assert.equal(champion.args[2],'hunter');assert.equal(champion.args[8],true);
 assert.equal(champion.args[10],true);assert.equal(champion.args[11],h.rune);assert.equal(champion.args[13],0);
 const ring=calls.find(x=>x.type==='ring');assert.ok(ring,'the equipped Ring renders even when the name is hidden');
 assert.equal(ring.matrix.a,8);assert.equal(ring.matrix.d,8,'DPR and hero enlargement apply to the Ring');
 assert.equal(ring.matrix.e,200);assert.equal(ring.matrix.f,(295+(-42-2)*4)*2,'the Ring follows the character head');
 assert.equal(h.stack.length,0);assert.equal(c.parts.length,0);
});

test('unequipped or unloaded Ring is absent and an unenchanted weapon never emits a battle rune',()=>{
 const h=harness(),{c,calls}=h;c.S.gear.trinket=null;c.S.gear.weapon={};
 for(let i=0;i<60;i++){c.session.time+=1/60;c.paintHero();}
 assert.equal(calls.filter(x=>x.type==='ring').length,0);assert.equal(calls.filter(x=>x.type==='particle').length,0);
 assert.ok(calls.filter(x=>x.type==='champion').every(x=>x.args[11]===null));
 c.S.gear.trinket=h.ring;c.theRingImg.complete=false;c.paintHero();assert.equal(calls.filter(x=>x.type==='ring').length,0);
});

test('battle droplets stay attached through DPR and resize, emit only once per tick, and pause without leaking into the world',()=>{
 const h=harness(),{c,calls}=h;c.paintHero();
 for(let i=0;i<25;i++){c.session.time+=1/60;c.paintHero();}
 const fx=c.session.heroEffects;assert.ok(fx.parts.length>0);
 for(const p of fx.parts){assert.ok(Math.abs(p.x)<1,'emission x is hero-local');assert.ok(p.y>=2&&p.y<10,'emission follows the actual weapon point');}
 assert.equal(c.parts.length,0);const before=JSON.stringify(fx);
 for(let i=0;i<10;i++)c.paintHero();assert.equal(JSON.stringify(fx),before,'extra renders neither advance nor emit');
 c.gamePaused=true;const positions=JSON.stringify(fx.parts);c.paintHero();assert.equal(JSON.stringify(fx.parts),positions);
 c.gamePaused=false;c.layout={heroX:210,heroScale:2};c.paintHero();
 const particle=calls.findLast(x=>x.type==='particle');assert.equal(particle.matrix.a,4);assert.equal(particle.matrix.e,420);
 assert.equal(JSON.stringify(fx.parts),positions,'resizing transforms the same local particles');
 assert.equal(c.parts.length,0);assert.equal(h.stack.length,0);
});

test('hiding battle weapons removes the weapon and lingering rune particles but keeps the Ring',()=>{
 const {c,calls}=harness();for(let i=0;i<25;i++){c.session.time+=1/60;c.paintHero();}
 assert.ok(c.session.heroEffects.parts.length>0);
 calls.length=0;c.S.hideWeapon=true;c.paintHero();
 const champion=calls.find(x=>x.type==='champion');
 assert.equal(champion.args[7],'hidden');assert.equal(champion.args[11],null);
 assert.equal(c.session.heroEffects.parts.length,0);assert.ok(calls.some(x=>x.type==='ring'));
 c.S.hideWeapon=false;c.paintHero();assert.equal(calls.findLast(x=>x.type==='champion').args[7],null);
});

test('the Ring eye saves visibility and hides only its drawing, leaving equipment and the weapon rune intact',()=>{
 const h=harness(),{c,calls}=h,button={},saved=[];
 const before=JSON.stringify(c.S.gear);
 c.document={querySelectorAll:()=>[button]};c.save=()=>saved.push(JSON.parse(JSON.stringify(c.S)));
 c.renderHero=()=>{};c.stageMsg=()=>{};
 vm.runInContext(section(game," document.querySelectorAll('[data-ringeye]')",' /* two scroll slots'),c);
 c.paintHero();assert.ok(calls.some(x=>x.type==='ring'),'older characters show the ring by default');
 calls.length=0;button.onclick();c.paintHero();
 assert.equal(saved.at(-1).hideRing,true);
 assert.equal(calls.some(x=>x.type==='ring'),false);
 assert.equal(calls.find(x=>x.type==='champion').args[11],h.rune);
 assert.equal(JSON.stringify(c.S.gear),before,'the trinket and its bonuses remain equipped');
 calls.length=0;button.onclick();c.paintHero();
 assert.equal(saved.at(-1).hideRing,false);
 assert.ok(calls.some(x=>x.type==='ring'));
});
