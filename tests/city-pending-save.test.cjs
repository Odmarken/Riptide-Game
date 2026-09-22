const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const reload=s=>E.normalize(JSON.parse(JSON.stringify(s)));

test('contracts paid for across a board refresh all survive saving and award their standing',()=>{
 const s=E.create();s.noble.rank=6;s.noble.xp=2200;
 E.postBoard(s,()=>.99);
 for(const o of s.noble.offers)assert.ok(E.fundContract(s,o.id,1e9).ok);
 s.noble.offerLeft=1;
 E.tick(s,{},()=>.99);
 for(const o of s.noble.offers)assert.ok(E.fundContract(s,o.id,1e9).ok);
 assert.equal(s.noble.pending.length,12);
 const restored=reload(s);
 assert.deepEqual(restored.noble.pending,s.noble.pending);
 for(let i=0;i<E.NOBLE_CLOSES;i++){E.tick(s,{},()=>.99);E.tick(restored,{},()=>.99);}
 assert.equal(restored.noble.done,12);
 assert.equal(restored.noble.given,s.noble.given);
 assert.equal(restored.noble.xp,s.noble.xp);
});

test('repeated paid ally investments survive a reload and arrive at the same time',()=>{
 const s=E.create();E.charter(s);s.crowned=true;s.treasury=1e7;
 const id=E.ALLIES[0].id;
 for(let i=0;i<16;i++)assert.ok(E.allyInvest(s,id,1000).ok);
 E.tick(s,{},()=>.95);
 for(let i=0;i<4;i++)assert.ok(E.allyInvest(s,id,1000).ok);
 const restored=reload(s);
 assert.deepEqual(restored.allies[id].pending,s.allies[id].pending);
 assert.equal(restored.treasury,s.treasury);
 for(let i=0;i<E.ALLY_CLOSES;i++){E.tick(s,{},()=>.95);E.tick(restored,{},()=>.95);}
 assert.deepEqual(restored.allies[id],s.allies[id]);
});
