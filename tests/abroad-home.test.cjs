const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');

/* ⛵ a port of call is left only by sea: in a town zone the Home button is blacked out and the map will not travel */
function rules(S,ZONES){
 const a=source.indexOf('/* ⛵ a port of call is left only the way it was reached'),b=source.indexOf('function sceneHoldsTravel(){',a);
 assert.ok(a>=0&&b>a,'the abroad rules are found');
 const calls=[],cls={},attrs={};
 const button={classList:{toggle:(k,on)=>{cls[k]=on;}},setAttribute:(k,v)=>{attrs[k]=v;},title:''};
 const c={S,ZONES,calls,stageMsg:m=>calls.push(m),sfx:{warn(){}},document:{querySelector:q=>q==='nav button[data-tab="home"]'?button:null}};
 vm.createContext(c);vm.runInContext(source.slice(a,b)+';globalThis.api={abroad,abroadNoTravel,homeButtonState};',c);
 return {api:c.api,calls,cls,attrs,button};
}
const ZONES=[{name:'Moonshine',tavern:true},{name:'The Harbour',harbor:true},{name:'Kraken’s Rest',town:'krakensrest'},{name:'The Palace',town:'sf_palace',interior:true}];

test('in a port - a town or its palace - Home and the map refuse and point to Blackbeard',()=>{
 for(const zone of [2,3]){
  const r=rules({zone},ZONES);
  assert.equal(r.api.abroadNoTravel(),true);assert.match(r.calls[0],/Blackbeard/);
  r.api.homeButtonState();assert.equal(r.cls.abroad,true);assert.equal(r.attrs['aria-disabled'],'true');assert.match(r.button.title,/Blackbeard/);
 }
});

test('at home, in the Harbour and anywhere else Home works as before',()=>{
 for(const zone of [0,1]){
  const r=rules({zone},ZONES);
  assert.equal(r.api.abroadNoTravel(),false);assert.equal(r.calls.length,0);
  r.api.homeButtonState();assert.equal(r.cls.abroad,false);assert.equal(r.button.title,'');
 }
 assert.equal(rules(null,ZONES).api.abroad(),false,'no hero, nothing to stop');
});

test('goHome, the travel map and every zone change wire it up; the button is drawn black',()=>{
 const at=source.indexOf('function goHome(){'),home=source.slice(at,source.indexOf('\n}',at));
 assert.match(home,/if\(abroadNoTravel\(\)\)return;/);
 assert.match(source,/if\(hcNoFlee\(\)\|\|sceneHoldsTravel\(\)\|\|abroadNoTravel\(\)\)return;/,'the travel map');
 assert.match(source,/function applyZoneUI\(\)\{[\s\S]{0,600}homeButtonState\(\);/,'every zone change repaints the button');
 assert.match(css,/nav button\.abroad\{[^}]*background:rgba\(0,0,0,/);
});
