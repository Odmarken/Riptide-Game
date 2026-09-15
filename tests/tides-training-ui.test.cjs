const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Tides=require('../assets/tides/core.js'),source=fs.readFileSync('assets/tides/ui.js','utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function harness(){
 const c={Tides,hubMode:'',trainingOwner:null,trainingPicker:null,S:{tides:Tides.createCollection()},gameOn:true,hero:{dead:false},session:null,access:true,saves:0,Date,Math};
 Tides.purchaseLasso(c.S.tides,10000,{rng:()=>0});const initial=c.S.tides.pets[0];c.S.tides.pets.push({...initial,id:'tide-2',speciesId:Tides.catalog[1].id});c.S.tides.visibleId=initial.id;
 const nodes=new Map();c.el=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,querySelectorAll:()=>[],querySelector:()=>null});return nodes.get(id);};
 Object.assign(c,{trainingInReach:()=>c.access,openHub:mode=>{if(c.session)return false;c.hubMode=mode;return true},closeHub:()=>{c.hubMode=''},html:s=>String(s),species:Tides.getSpecies,icon:()=>'<canvas></canvas>',stars:()=>'',paintIcons(){},saveNow:()=>c.saves++,entry(){},refreshStorageValues(){},openStorage(){},sfx:{click(){}}});
 vm.createContext(c);vm.runInContext(section(' function trainingAllowed(',' function visibleCompanion('),c);return c;
}
test('training menu shows three places and the passive rate; only a nearby living character can enter',()=>{
 const c=harness();c.access=false;assert.equal(c.openTraining(),false);c.access=true;c.hero.dead=true;assert.equal(c.openTraining(),false);c.hero.dead=false;
 assert.equal(c.openTraining(),true);assert.equal((c.el('tideHubBody').innerHTML.match(/data-training-slot=/g)||[]).length,3);assert.match(c.el('tideHubBody').innerHTML,/6 XP per minute/);assert.match(c.el('tideHubBody').innerHTML,/unequips and hides/);
});
test('deposit and collection update the same collection, save immediately, and repeated clicks cannot duplicate slots or pets',()=>{
 const c=harness(),id=c.S.tides.pets[0].id;c.openTraining();c.trainingPicker=1;const before=c.saves;
 assert.equal(c.depositTrainingPet(id),true);assert.equal(c.S.tides.training.jobs[0].slot,1);assert.equal(c.S.tides.equippedId,null);assert.equal(c.S.tides.visibleId,null);assert.equal(c.saves,before+1);assert.match(c.el('tideHubMessage').textContent,/Unequipped/);
 assert.equal(c.depositTrainingPet(id),false);assert.equal(c.S.tides.training.jobs.length,1);assert.match(c.el('tideHubBody').innerHTML,/data-training-collect/);
 assert.equal(c.collectTrainingPet(id),true);assert.equal(c.S.tides.training.jobs.length,0);assert.equal(c.S.tides.pets.length,2);assert.equal(c.collectTrainingPet(id),false);assert.equal(c.S.tides.pets.length,2);
});
test('stale menus cannot alter another character, a distant station or an ongoing battle',()=>{
 const c=harness(),id=c.S.tides.pets[0].id;c.openTraining();c.trainingPicker=0;c.access=false;assert.equal(c.depositTrainingPet(id),false);c.access=true;c.session={};assert.equal(c.depositTrainingPet(id),false);c.session=null;
 const old=c.S.tides;c.S={tides:Tides.createCollection()};assert.equal(c.depositTrainingPet(id),false);assert.equal(old.training.jobs.length,0);c.tickTraining();assert.equal(c.hubMode,'');
});
test('background ticking saves newly earned XP once without requiring the training menu to be open',()=>{
 const c=harness(),id=c.S.tides.pets[0].id;Tides.startTraining(c.S.tides,id,{now:Date.now()-61000});c.hubMode='';const before=c.saves;
 c.tickTraining();assert.equal(c.S.tides.pets[0].xp,6);assert.equal(c.saves,before+1);c.tickTraining();assert.equal(c.saves,before+1);
});
test('training pets are excluded from Ready for battle but remain searchable under Training and Favorites',()=>{
 const c=harness(),p=c.S.tides.pets[0];Tides.startTraining(c.S.tides,p.id);p.favorite=true;
 Object.assign(c,{remaining:Tides.remainingInjury,mutation:Tides.mutationSummary,parentNames:()=>''});vm.runInContext(section(' function filteredPets(',' function renderStorage('),c);
 c.el('tideFilter').value='ready';assert.deepEqual(c.filteredPets().map(p=>p.id),['tide-2']);c.el('tideFilter').value='training';assert.deepEqual(c.filteredPets().map(p=>p.id),[p.id]);c.el('tideFilter').value='favorites';assert.deepEqual(c.filteredPets().map(p=>p.id),[p.id]);
});
