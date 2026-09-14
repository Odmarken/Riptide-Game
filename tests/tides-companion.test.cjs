const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const follow=source.slice(source.indexOf(' if(pet&&(activePet()||TideUI.visibleCompanion())&&!hero.dead){'),source.indexOf(' mpHostRaidThreatTick(dt);'));
const draw=source.slice(source.indexOf('function drawPet(){'),source.indexOf('function drawEquippedRing('));
function harness(){
 const c={pet:{x:-26,y:12,fx:1,walk:0,moving:false},hero:{x:0,y:0,fx:1,dead:false},visible:{id:'tide-1'},legacy:null,dt:1/60,calls:[],battling:false,
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),activePet:()=>c.legacy,TideUI:{visibleCompanion:()=>c.visible,isBattling:()=>c.battling,drawCompanion:(g,x,y)=>c.calls.push(['tide',x,y])},ctx:{},
  moveToward(p,x,y,dt){const d=Math.hypot(x-p.x,y-p.y),step=Math.min(d,175*dt);p.x+=(x-p.x)/d*step;p.y+=(y-p.y)/d*step;p.moving=true;},performance:{now:()=>1000}};
 vm.createContext(c);vm.runInContext('function follow(){'+follow+'}\n'+draw,c);return c;
}
test('a visible Tide follows without a legacy pet and steps clear of the hero when first selected',()=>{
 const c=harness();for(let i=0;i<90;i++)c.follow();assert.ok(c.dist(c.pet,c.hero)>=54);assert.ok(c.dist(c.pet,c.hero)<=90);
 c.hero.x=400;for(let i=0;i<90;i++)c.follow();assert.ok(c.dist(c.pet,c.hero)<90);assert.equal(c.legacy,null);
 c.drawPet();assert.equal(c.calls[0][0],'tide');
});
test('Tide battles and dead heroes hide the visual companion; clearing the eye leaves no Tide',()=>{
 const c=harness();c.battling=true;c.drawPet();assert.equal(c.calls.length,0);c.battling=false;c.hero.dead=true;c.drawPet();assert.equal(c.calls.length,0);
 c.hero.dead=false;c.visible=null;c.drawPet();assert.equal(c.calls.length,0);const pos=[c.pet.x,c.pet.y];c.follow();assert.deepEqual([c.pet.x,c.pet.y],pos);
});
test('the normal pet keeps its original follow radius and teleport offset when no Tide is visible',()=>{
 const c=harness();c.visible=null;c.legacy={atkMul:.1};c.pet.x=-201;c.pet.y=0;c.follow();assert.equal(c.pet.x,-24);assert.equal(c.pet.y,12);
 const pos=[c.pet.x,c.pet.y];c.follow();assert.deepEqual([c.pet.x,c.pet.y],pos);assert.deepEqual(c.legacy,{atkMul:.1});
});
