const test=require('node:test'),assert=require('node:assert/strict');
const animation=require('../assets/farm/decoration-animation.js');
function render(id,time){
 const calls=[],states=[];
 const g=new Proxy({save(){states.push(1);},restore(){assert.ok(states.pop());}}, {get(o,k){return k in o?o[k]:(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));calls.push([k,...args]);};}});
 const im={naturalWidth:1200,naturalHeight:1800};
 const result=animation.draw(g,id,im,120,180,-168,time,137);
 assert.equal(states.length,0);return {calls,result};
}
test('flames move while the bowl and feet retain the same source and destination',()=>{
 const a=render('soulfire_brazier',0),b=render('soulfire_brazier',1);
 const draws=x=>x.calls.filter(c=>c[0]==='drawImage');
 assert.equal(a.result,true);assert.deepEqual(draws(a)[0],draws(b)[0]);
 assert.notDeepEqual(draws(a).slice(1),draws(b).slice(1));
});
test('pond and trough animate inside a water clip after painting their stationary frame',()=>{
 for(const id of ['pond','trough']){
  const a=render(id,0),b=render(id,1);
  const base=a.calls.findIndex(c=>c[0]==='drawImage'),clip=a.calls.findIndex(c=>c[0]==='clip');
  assert.ok(clip>base);assert.deepEqual(a.calls[base],b.calls[base]);assert.notDeepEqual(a.calls,b.calls);
 }
});
test('unrelated props stay on their existing render path',()=>{
 assert.deepEqual(render('bench',0),{calls:[],result:false});
});
