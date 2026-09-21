/* The Hand's counsel, headless: one hint every COUNSEL_EVERY closes, about whatever presses hardest,
 * that says where to look and never gives a figure. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const open=()=>{const s=E.create();E.charter(s);s.food.stock=1e6;return s;};
const quiet=()=>.95;

test('no counsel before the books open, one hint after, and then he keeps his peace for four closes',()=>{
 const s=E.create();
 assert.equal(E.counsel(s,{},quiet),null);assert.equal(E.counselView(s).ready,false);
 E.charter(s);s.food.stock=1e6;
 assert.equal(E.counselView(s).ready,true);
 const r=E.counsel(s,{},quiet);
 assert.ok(r.ok&&r.spent&&r.text.length>40);assert.equal(s.counsel.text,r.text);
 const again=E.counsel(s,{},quiet);assert.equal(again.ok,false);assert.match(again.text,/4 closes/);assert.equal(s.counsel.text,r.text,'a refusal does not wipe what he said');
 for(let i=1;i<=E.COUNSEL_EVERY;i++){assert.equal(E.counselView(s).left,E.COUNSEL_EVERY-i+1);E.attend(s);E.tick(s,{},quiet);}
 assert.equal(E.counselView(s).ready,true);assert.ok(E.counsel(s,{},quiet).spent);
});

test('he speaks of what presses hardest: the red before bread, bread before the deficit',()=>{
 const s=open();
 assert.equal(E.counselTopics(s,{},E.forecast(s,{}))[0].id,'deficit','the opening city loses gold at every close');
 s.food.stock=0;s.food.hunger=1;
 assert.equal(E.counselTopics(s,{},E.forecast(s,{}))[0].id,'hunger');
 s.treasury=-5000;
 assert.equal(E.counselTopics(s,{},E.forecast(s,{}))[0].id,'red');
 assert.equal(E.counsel(s,{},quiet).topic,'red');
});

test('he hints and never counts: no figures, no level names in anything he can say',()=>{
 const levels=[].concat(...Object.values(E.LINES).concat(Object.values(E.RATES)).map(g=>g.levels.map(l=>l.name))).filter(n=>n!=='None'&&n!=='Fair'&&n!=='Standard'&&n!=='Kept');
 const states=[open(),(()=>{const s=open();s.treasury=-1;s.mood=20;s.protest=true;s.attract=20;s.food.stock=0;s.food.hunger=2;s.king.pleasure=10;s.king.demand={id:'barge',age:1};s.petition={id:'mint',age:1};
  s.incidents=[{id:'brawl',age:3}];s.budget.tax=30;for(const id of Object.keys(s.council))s.council[id]=20;s.jail=Array.from({length:9},(_,i)=>({name:'P'+i,term:3,served:0}));return s;})(),
  (()=>{const s=open();s.treasury=2e6;s.budget.tax=20;s.budget.rent=3;s.pop=500;s.attract=80;s.season.card={id:'winter',mods:{eat:1.2}};s.food.auto=true;return s;})()];
 let seen=0;
 for(const s of states)for(const t of E.counselTopics(s,{},E.forecast(s,{})))for(const line of t.lines){
  seen++;assert.ok(!/\d/.test(line),'a figure in: '+line);
  for(const n of levels)assert.ok(!line.includes(n),'names the level “'+n+'”: '+line);
 }
 assert.ok(seen>=15,'only '+seen+' lines were looked at');
});

test('asked again about the same trouble he moves on to the next - unless the house is on fire',()=>{
 const s=open();s.incidents=[{id:'brawl',age:0}];
 const first=E.counsel(s,{},quiet).topic;s.ticks+=E.COUNSEL_EVERY;
 const second=E.counsel(s,{},quiet).topic;
 assert.notEqual(first,second);
 const r=open();r.treasury=-9000;
 assert.equal(E.counsel(r,{},quiet).topic,'red');r.ticks+=E.COUNSEL_EVERY;assert.equal(E.counsel(r,{},quiet).topic,'red');
});

test('the counsel survives a save, and an older save may ask at once',()=>{
 const s=open();
 const r=E.counsel(s,{},quiet),back=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(back.counsel,s.counsel);assert.equal(back.counsel.text,r.text);
 assert.deepEqual(E.normalize({v:E.VERSION,chartered:true}).counsel,{at:null,text:'',topic:''},'an older save may ask at once');
});
