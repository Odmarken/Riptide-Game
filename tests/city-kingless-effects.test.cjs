/* 👑 (2026-09-24) Crowned yourself - or with the throne standing empty - there is no King above you to please or to annoy:
 * no work, contract or budget line says it moves a King's pleasure, and none of them does. Under Alarik they all still do.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('../assets/city/economy.js');
const quiet=()=>.95;
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;s.treasury=1e7;return s;};
const RULE={alarik:s=>s,crowned:s=>{s.crowned=true;s.deposed='gaol';return s;},regency:s=>{s.regency=true;return s;}};
const work=(s,id)=>E.worksView(s,{}).list.find(w=>w.id===id);
const kingly=t=>/King/.test(t);

test('under Alarik the statue and the red lamps say what they do to him; with no King above you they do not',()=>{
 const a=open();
 assert.ok(work(a,'statue').effects.includes('the King’s pleasure -8'));assert.match(work(a,'statue').blurb,/The King will not\./);
 assert.ok(work(a,'brothel').effects.includes('a pious King’s pleasure −6'));assert.match(work(a,'brothel').blurb,/a pious King will sulk\./);
 for(const how of ['crowned','regency']){
  const s=RULE[how](open());
  for(const w of E.worksView(s,{}).list){assert.ok(!w.effects.some(kingly),how+' '+w.id+': '+w.effects.join(' · '));assert.ok(!kingly(w.blurb),how+' '+w.id+': '+w.blurb);}
  assert.ok(work(s,'statue').effects.includes('trust in you +5'),'what else it does stays');assert.equal(work(s,'statue').blurb,'You, in bronze, on the great square. The people will like it.');
  assert.deepEqual(work(s,'brothel').effects,work(a,'brothel').effects.filter(e=>!kingly(e)));assert.match(work(s,'brothel').blurb,/The Tidekeeper will preach against it\.$/);
 }
});

test('the notice board: a contract that pleased the King says so only while there is a King',()=>{
 for(const how of Object.keys(RULE)){
  const s=RULE[how](open());s.noble.rank=4;
  s.noble.offers=['chantry','hunt','regiment'].map(id=>({id,cost:100000,xp:100,taken:false}));
  const said=E.nobleView(s).offers.map(o=>o.effects.join(' · '));
  if(how==='alarik')assert.ok(said.every(e=>/the King’s pleasure \+\d/.test(e)),said.join(' | '));
  else assert.ok(said.every(e=>!kingly(e)&&e.length),how+': '+said.join(' | '));
 }
});

test('and nothing moves a King who is not there: a statue raised and a contract cleared leave his pleasure alone',()=>{
 for(const how of ['crowned','regency']){
  const s=RULE[how](open()),before=s.king.pleasure;
  s.works.statue={left:1};s.noble.rank=2;s.noble.pending.push({kind:'contract',id:'hunt',amount:100000,xp:100,left:1});
  E.attend(s);const r=E.tick(s,{},quiet);
  assert.equal(s.works.statue.left,0,'the statue stands');assert.equal(s.noble.pending.length,0,'the hunt is paid for');
  assert.equal(s.king.pleasure,before,how+': '+r.events.join(' / '));
 }
 /* under Alarik both still reach him */
 const twin=()=>{const s=open();s.king.pleasure=60;E.attend(s);return s;},a=twin(),b=twin();
 a.works.statue={left:1};E.tick(a,{},quiet);E.tick(b,{},quiet);
 assert.ok(a.king.pleasure<b.king.pleasure,'the statue costs him his temper: '+a.king.pleasure+' against '+b.king.pleasure);
});

test('the Budget tab names a King’s pleasure only while there is a King',()=>{
 const src=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
 assert.ok(src.includes("(k==='purse'?(c.crowned?' · into your overflow gold':c.regency?'':' · his pleasure → '+lv.pleasure):!c.crowned&&!c.regency&&lv.pleasure?' · King '+(lv.pleasure>0?'+':'')+lv.pleasure:'')"));
});
