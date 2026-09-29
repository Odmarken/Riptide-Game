const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const cut=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,'found '+from);return source.slice(a,b);};

function square(tables){
 const c={world:{npcs:[{name:'Walker',skin:'male',pts:[{x:0,y:0},{x:9,y:0}]}],solids:tables.map((t,i)=>({type:'citywork',kind:'feast',x:t[0],y:t[1],row:i}))},
  npcSkinCostume:skin=>/^(dwarf|orc)/.test(skin)?[skin,skin.replace(/(male|female).*/,''),/female/.test(skin)?'female':'male',skin.split('_')[1]]:null};
 vm.createContext(c);
 vm.runInContext(cut('function npcSkinFemale(skin)','\n')+'\n'+cut('const NEWCOMER_FIRST=','const VELVET_GIRLS=')+cut('const cityCommoner=','\n')+'\n'
  +cut('const FEAST_SKINS=','\n/* 📣 The crier')+';globalThis.apply=cityApplyFeast;globalThis.commoner=cityCommoner;',c);
 return c;
}
const feasters=c=>c.world.npcs.filter(n=>n.feaster);

test('ten townsfolk stand round each feast table, five a side, facing it and hopping each in their own time',()=>{
 const c=square([[1000,500],[1000,612]]);c.apply();
 const all=feasters(c);assert.equal(all.length,20);
 for(const [x,y] of [[1000,500],[1000,612]]){
  const at=all.filter(n=>Math.abs(n.y-y)<=80);assert.ok(at.length>=10);
 }
 for(const n of all){
  const table=c.world.solids.reduce((a,b)=>Math.abs(b.y-n.y)<Math.abs(a.y-n.y)?b:a);
  assert.ok(Math.abs(n.x-table.x)>=78,'outside the benches');
  assert.equal(n.fx,n.x<table.x?1:-1,'facing the table');
  assert.equal(n.speed,0);assert.ok(n.pauseT>1e6,'they stand, they do not wander off');
  assert.ok(n.hop&&n.hop.h>0&&n.hop.rate>0,'hopping');
  assert.equal(c.commoner(n),false,'never marched off to protest');
 }
 assert.ok(new Set(all.map(n=>n.hop.rate+':'+n.hop.phase)).size>10,'each in their own time');
 assert.ok(new Set(all.map(n=>n.skin)).size>=6,'a mixed crowd');
 assert.equal(c.world.npcs.filter(n=>!n.feaster).length,1,'the walking townsfolk are left alone');
 assert.match(source,/!n\.held&&!n\.feaster&&/,'no names over the crowd at the table');
});

test('the crowd comes and goes with the tables',()=>{
 const c=square([[1000,500]]);c.apply();assert.equal(feasters(c).length,10);
 c.apply();assert.equal(feasters(c).length,10,'applying again adds nobody');
 c.world.solids=[];c.apply();assert.equal(feasters(c).length,0);
 assert.match(source,/ cityApplyFeast\(\);\n\}/,'laid out whenever the square\'s props are');
});
