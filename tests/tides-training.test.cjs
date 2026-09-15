const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../assets/tides/core.js'),Training=require('../assets/tides/training.js');
function collection(){const c=T.createCollection();c.lassoOwned=true;c.pets=T.catalog.slice(0,6).map((s,i)=>({id:'tide-'+(i+1),speciesId:s.id,level:1,xp:0,caughtAt:0,injuredUntil:0}));c.nextId=7;c.equippedId=c.visibleId=c.pets[0].id;return c;}
test('three unique training places accept owned originals and hybrids, and safely unequip/hide only the deposited Tide',()=>{
 const c=collection(),p=c.pets[0];c.pets[2].speciesId=T.getHybrid(c.pets[0].speciesId,c.pets[1].speciesId).id;
 assert.equal(T.startTraining(c,p.id,{slot:0,now:1000}).ok,true);assert.equal(c.equippedId,null);assert.equal(c.visibleId,null);assert.equal(c.pets.length,6);
 assert.equal(T.startTraining(c,p.id,{slot:1,now:1000}).reason,'training');assert.equal(T.startTraining(c,c.pets[1].id,{slot:0,now:1000}).reason,'full');
 for(const slot of [1,2])assert.equal(T.startTraining(c,c.pets[slot].id,{slot,now:1000}).ok,true);
 assert.equal(T.startTraining(c,c.pets[3].id,{now:1000}).reason,'full');assert.equal(T.trainingStatus(c,1000).filter(s=>!s.empty).length,3);
 assert.equal(T.equip(c,c.pets[3].id).ok,true);assert.equal(T.setVisible(c,c.pets[3].id).ok,true);assert.equal(T.isTraining(c,c.pets[2].id),true);
});
test('passive training gives six XP per minute and is slower than repeated victories at every level',()=>{
 const c=collection(),p=c.pets[0];T.startTraining(c,p.id,{now:1000});
 assert.equal(T.updateTraining(c,{now:60999}).xp,5);assert.equal(T.updateTraining(c,{now:61000}).xp,1);assert.equal(p.xp,6);
 assert.equal(T.updateTraining(c,{now:61000}).changed,false);assert.equal(T.updateTraining(c,{now:71000}).xp,1);
 for(let level=1;level<=30;level++)assert.ok(30+level*8+3>Training.CONFIG.XP_PER_MINUTE);
});
test('small ticks, reloads and one offline interval award identical XP and preserve fractional time',()=>{
 const start=1000,end=start+3600000+9999,c=collection();T.startTraining(c,c.pets[0].id,{now:start});
 const offline=JSON.parse(JSON.stringify(c));
 for(let now=start;now<=end;now+=37)T.updateTraining(c,{now});T.updateTraining(c,{now:end});
 const restored=T.normalizeCollection(offline,end);assert.deepEqual(restored.pets.map(p=>[p.level,p.xp]),c.pets.map(p=>[p.level,p.xp]));assert.equal(restored.training.jobs[0].totalXp,360);
 assert.equal(T.updateTraining(restored,{now:end+1}).xp,1);assert.equal(T.normalizeCollection(JSON.parse(JSON.stringify(restored)),end+1).training.jobs[0].totalXp,361);
});
test('clock rollback cannot duplicate XP even after collection, redeposit and reload',()=>{
 let c=collection();const id=c.pets[0].id;T.startTraining(c,id,{now:1000});T.updateTraining(c,{now:101000});assert.equal(c.training.jobs[0].totalXp,10);
 assert.equal(T.updateTraining(c,{now:1000}).xp,0);assert.equal(T.collectTraining(c,id,{now:2000}).xp,10);assert.equal(T.startTraining(c,id,{now:3000}).ok,true);
 assert.equal(c.training.jobs[0].startedAt,101000);c=T.normalizeCollection(JSON.parse(JSON.stringify(c)),4000);
 assert.equal(T.updateTraining(c,{now:101000}).xp,0);assert.equal(T.updateTraining(c,{now:111000}).xp,1);
});
test('offline progress crosses levels exactly and caps at 30 without banking excess XP',()=>{
 const c=collection(),p=c.pets[0];p.level=29;p.xp=T.xpToNext(29)-1;T.startTraining(c,p.id,{now:1000});
 const r=T.updateTraining(c,{now:1000+3600000*24*365});assert.equal(r.xp,1);assert.equal(r.levels,1);assert.equal(p.level,30);assert.equal(p.xp,0);assert.equal(T.trainingStatus(c)[0].maxLevel,true);
 assert.equal(T.updateTraining(c,{now:1000+3600000*24*730}).changed,false);assert.equal(T.collectTraining(c,p.id).ok,true);assert.equal(T.startTraining(c,p.id).reason,'maximum');
});
test('collecting settles once, returns the same owned Tide and frees just its paddock',()=>{
 const c=collection(),a=c.pets[0],b=c.pets[1];T.startTraining(c,a.id,{slot:0,now:1000});T.startTraining(c,b.id,{slot:2,now:1000});
 const r=T.collectTraining(c,a.id,{now:61000});assert.equal(r.pet,a);assert.equal(r.xp,6);assert.equal(c.pets.length,6);assert.equal(T.collectTraining(c,a.id,{now:61000}).reason,'missing');assert.equal(T.isTraining(c,b.id),true);
 assert.equal(T.equip(c,a.id).ok,true);assert.equal(T.setVisible(c,a.id).ok,true);assert.equal(T.trainingStatus(c,61000)[0].empty,true);assert.equal(T.trainingStatus(c,61000)[2].pet,b);
});
test('training prevents equip, visibility, battles, world XP and both breeding-parent positions',()=>{
 const c=collection(),a=c.pets[0],b=c.pets[1];T.startTraining(c,a.id,{now:1000});
 assert.equal(T.equip(c,a.id).reason,'training');assert.equal(T.setVisible(c,a.id).reason,'training');
 c.equippedId=a.id;assert.equal(T.beginBattle(c,{speciesId:b.speciesId,level:1}).reason,'training');assert.equal(T.awardWorldXp(c,{eventId:'kill'}).reason,'training');
 assert.equal(T.startBreeding(c,{stationId:'one',parentAId:a.id,parentBId:b.id}).reason,'training');assert.equal(T.startBreeding(c,{stationId:'one',parentAId:b.id,parentBId:a.id}).reason,'training');assert.ok(!T.eligibleBreedingParents(c).some(p=>p.id===a.id));
 assert.equal(T.toggleFavorite(c,a.id).ok,true,'favorites remain available');
});
test('active battles, guild intermissions, breeding, invalid slots and non-owned pets reject without depositing',()=>{
 const c=collection(),id=c.pets[0].id;for(const field of ['activeBattle','guildSeries']){c[field]={id:'busy'};assert.equal(T.startTraining(c,id,{now:1000}).reason,'battle');assert.equal(T.eligibleTrainingPets(c).length,0);c[field]=null;}
 assert.equal(T.startTraining(c,'missing').reason,'unowned');for(const slot of [-1,3,1.5,NaN])assert.equal(T.startTraining(c,id,{slot}).reason,'full');
 T.startBreeding(c,{stationId:'house',parentAId:id,parentBId:c.pets[1].id,now:1000});assert.equal(T.startTraining(c,id,{now:1000}).reason,'breeding');assert.equal(c.training.jobs.length,0);
});
test('save normalization bounds slots, removes stale/conflicting reservations and never equips a training Tide',()=>{
 const c=collection();T.startTraining(c,c.pets[0].id,{slot:0,now:1000});const raw=JSON.parse(JSON.stringify(c)),good=raw.training.jobs[0];raw.equippedId=raw.visibleId=good.petId;
 raw.training.jobs.push({...good,slot:1},{...good,petId:c.pets[1].id},{...good,slot:2,petId:'missing'},{...good,slot:3,petId:c.pets[3].id},{...good,slot:2,petId:c.pets[2].id,lastAccruedAt:'wrong'});
 const fixed=T.normalizeCollection(raw,61000);assert.equal(fixed.training.jobs.length,1);assert.equal(fixed.equippedId,null);assert.equal(fixed.visibleId,null);assert.equal(fixed.pets[0].xp,6);
 const old=T.normalizeCollection({pets:c.pets,lassoOwned:true},1000);assert.deepEqual(old.training.jobs,[]);
});
test('training keeps mutations, favourites and hybrid identity through long offline progress',()=>{
 const c=collection(),p=c.pets[0];p.speciesId=T.getHybrid(c.pets[0].speciesId,c.pets[1].speciesId).id;p.mutations={hp:2,attack:3,power:2,sixStar:true};p.favorite=true;
 T.startTraining(c,p.id,{now:1000});const restored=T.normalizeCollection(JSON.parse(JSON.stringify(c)),3601000),r=restored.pets[0];assert.equal(r.speciesId,p.speciesId);assert.deepEqual(r.mutations,p.mutations);assert.equal(r.favorite,true);assert.ok(r.level>1);assert.equal(T.stats(r).stars,6);
});
test('browser loading before core supports save/load and collection without CommonJS',()=>{
 const c={};vm.createContext(c);for(const file of ['catalog','breeding','hybrids','training','core'])vm.runInContext(fs.readFileSync('assets/tides/'+file+'.js','utf8'),c);
 const T=c.Tides,owned=T.createCollection();T.purchaseLasso(owned,10000,{rng:()=>0,now:1000});const id=owned.pets[0].id;assert.equal(T.startTraining(owned,id,{now:1000}).ok,true);assert.equal(T.normalizeCollection(JSON.parse(JSON.stringify(owned)),61000).pets[0].xp,6);
});
