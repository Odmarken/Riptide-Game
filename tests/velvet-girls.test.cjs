const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const cut=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,'found '+from);return source.slice(a,b);};

function city(works){
 const route=k=>[{x:100+k,y:200},{x:400+k,y:200},{x:400+k,y:500}];
 const folk=Array.from({length:30},(_,k)=>({name:'Folk '+k,skin:k%5?'male':'noble_lady',pts:route(k),i:0,x:100+k,y:200}));
 const c={S:{city:{jail:[],pop:2000,works,deposed:null,last:null}},world:{w:1000,h:800,npcs:folk},zoneOf:()=>({city:true}),
  CityEconomy:{POPULATION:2000},palacePoint:()=>({x:0,y:0}),BEGGAR_LINES:[]};
 vm.createContext(c);
 vm.runInContext(cut('function npcSkinFemale(skin)','\n')+'\n'+cut('const NEWCOMER_SKINS=','function cityApplyPeople(){')+cut('function cityApplyPeople(){','\n/* 🏗 What the ledger looks like')+';globalThis.apply=cityApplyPeople;',c);
 return c;
}
const girls=c=>c.world.npcs.filter(n=>n.velvet);

test('no Velvet Lantern, no girls; while it is being built, none either',()=>{
 for(const works of [{},{brothel:{left:2}},{tavern:{left:0}}]){const c=city(works);c.apply();assert.equal(girls(c).length,0);}
});

test('once the Velvet Lantern stands, six girls walk the streets - blonde and black-haired, mixed - and only six',()=>{
 const c=city({brothel:{left:0}});c.apply();
 const g=girls(c);assert.equal(g.length,6);
 assert.deepEqual(g.map(n=>n.skin),['courtesan_blonde','courtesan_dark','courtesan_blonde','courtesan_dark','courtesan_blonde','courtesan_dark']);
 assert.equal(new Set(g.map(n=>n.name)).size,6);
 for(const n of g){
  assert.equal(n.female,true);assert.ok(n.pts.length>1,'she walks a route');assert.ok(n.speed>0);
  assert.ok(n.pts.some(p=>p.x===n.x&&p.y===n.y),'she starts on her route');
 }
 assert.ok(g.every(n=>!/^noble_/.test(c.world.npcs.find(f=>f.pts===n.pts&&!f.velvet).skin)),'she walks a townsman\'s streets, not the gentry\'s');
 c.apply();c.apply();assert.equal(girls(c).length,6,'applying again adds nobody');
 assert.ok(c.S.city.works.brothel,'the ledger is untouched');
});

test('the girls do not count as townsfolk, and they leave when the house is gone',()=>{
 const c=city({brothel:{left:0}});c.apply();
 const hidden=c.world.npcs.filter(n=>!n.velvet&&n.hidden).length;
 const plain=city({});plain.apply();
 assert.equal(hidden,plain.world.npcs.filter(n=>n.hidden).length,'the crowd is sized without them');
 delete c.S.city.works.brothel;c.apply();assert.equal(girls(c).length,0);
 assert.match(source,/courtesan_blonde:'npc_courtesan_blonde',courtesan_dark:'npc_courtesan_dark'/,'their pictures are known');
 for(const f of ['npc_courtesan_blonde','npc_courtesan_dark'])assert.ok(fs.existsSync(path.join(__dirname,'../assets/characters/npc',f+'.png')));
});

test('Vivienne\'s fan is its own piece: it wafts toward her face and back, never past where it was painted',()=>{
 const parts=vm.runInNewContext(cut('const NPC_PARTS=','\n')+';NPC_PARTS');
 const fan=parts.courtesan_dark;assert.ok(fan);
 const size=f=>{const b=fs.readFileSync(path.join(__dirname,'../assets/characters/npc',f+'.png'));return [b.readUInt32BE(16),b.readUInt32BE(20)];};
 assert.deepEqual(size(fan.base),size('npc_courtesan_dark'),'the base is the whole picture, fan cut out');
 assert.deepEqual(size(fan.part),[fan.box[2]-fan.box[0],fan.box[3]-fan.box[1]],'the fan picture is its box');
 assert.ok(fan.pivot[0]>fan.box[0]&&fan.pivot[0]<fan.box[2]&&fan.pivot[1]>fan.box[1]&&fan.pivot[1]<=fan.box[3],'it turns about her wrist, inside the piece');
 assert.ok(fan.amp>0&&fan.amp<.15,'a little');
 const draw=cut('  const part=!n.art&&npcPart(n.skin);','  if(MERC_ARMED.has(n.skin))');
 assert.match(draw,/part\.amp\*\(\.5-\.5\*Math\.cos\(/,'the angle runs from 0 to amp and back: the fan never uncovers what it was painted over');
});
