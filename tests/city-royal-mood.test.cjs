const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../assets/city/economy.js');
const reload=s=>E.normalize(JSON.parse(JSON.stringify(s)));
function imprisonedKing(){
 const s=E.create();E.charter(s);
 s.crowned=true;s.deposed='gaol';s.treasury=1e9;s.loan=0;s.food.stock=1e6;
 s.jail=[{name:'Alarik',skin:'king',life:true,term:1,served:0,crime:'The former King'}];
 return s;
}
const reaction=s=>E.forecast(s,{}).moodFactors.find(f=>/^(Mercy for the old King|The old King’s execution)/.test(f.name));

for(const [action,fate,delta,fear] of [['pardon','pardoned',15,1.15],['execute','executed',-15,.85]]){
 test(action+' affects mood for two full seasons, survives saves and expires once',()=>{
  let s=imprisonedKing();
  for(let i=0;i<E.SEASON_CLOSES-1;i++){E.attend(s);E.tick(s,{},()=>.95);}
  const mood=s.mood;
  assert.ok(E[action](s,'Alarik').ok);
  assert.equal(s.mood,Math.max(0,Math.min(100,mood+delta)));
  assert.equal(s.royalMoodLeft,2*E.SEASON_CLOSES);
  const total=s.royalMoodLeft;
  for(let left=total;left>0;left--){
   s=reload(s);
   assert.equal(s.royalMoodLeft,left);
   assert.equal(reaction(s).value,delta);
   assert.match(reaction(s).name,new RegExp(left+' closes left'));
   const without={...s,royalMoodLeft:0};
   assert.equal(E.forecast(s,{}).moodTarget-E.forecast(without,{}).moodTarget,delta);
   E.attend(s);const r=E.tick(s,{},()=>.95);
   assert.equal(s.royalMoodLeft,left-1);
   assert.equal(r.unrest.some(line=>line.includes('effect on the people’s mood has ended')),left===1);
  }
  s=reload(s);
  assert.equal(reaction(s),undefined);
  assert.equal(s.deposed,fate);assert.equal(E.allyFear(s),fear);
  assert.equal(E[action](s,'Alarik'),null,'the same decision cannot restart the timer');
  E.attend(s);const r=E.tick(s,{},()=>.95);
  assert.equal(s.royalMoodLeft,0);
  assert.equal(r.unrest.some(line=>line.includes('effect on the people’s mood has ended')),false);
 });
}

test('ordinary pardons and historical decisions without a timer do not start a royal mood effect',()=>{
 const s=imprisonedKing();s.jail=[{name:'Bodil',life:false,term:2,served:0}];
 E.pardon(s,'Bodil');assert.equal(s.royalMoodLeft,0);assert.equal(reaction(s),undefined);
 s.deposed='pardoned';delete s.royalMoodLeft;
 assert.equal(reload(s).royalMoodLeft,0);
 s.royalMoodLeft=999;assert.equal(reload(s).royalMoodLeft,2*E.SEASON_CLOSES);
 s.deposed='exile';assert.equal(reload(s).royalMoodLeft,0);
});
