/* A save must stay readable by an OLDER build. On 2026-09-19 a hero saved inside the new Throne Hall
 * (the newest index in the append-only zone table) emptied the character list of the packaged exe
 * from two days earlier, which had no such zone. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}

test('a hero in the Throne Hall is written down as standing in the City, with a note for the stair',()=>{
 const c=vm.createContext({ZONES:[{name:'Moonshine',tavern:true},{name:'City',city:true},{name:'Throne Hall',throne:true}],CITY_ZONE:1,S:null});
 vm.runInContext(section('function saveSnapshot(){','async function save(){'),c);
 c.S={id:'a',zone:2,gold:5,city:{treasury:9}};
 const snap=vm.runInContext('saveSnapshot()',c);
 assert.equal(snap.zone,1);assert.equal(snap.atPalace,true);assert.equal(snap.gold,5);assert.deepEqual(snap.city,{treasury:9});
 assert.equal(c.S.zone,2,'the live state is untouched');assert.equal(c.S.atPalace,undefined);
 c.S={id:'a',zone:1};
 assert.equal(vm.runInContext('saveSnapshot()===S',c),true,'everywhere else the state is written as it is');
});

test('a hero in the Harbour is written down as standing in the City too, with a note for the flight',()=>{
 const c=vm.createContext({ZONES:[{name:'Moonshine',tavern:true},{name:'City',city:true},{name:'Throne Hall',throne:true},{name:'The Harbour',harbor:true}],CITY_ZONE:1,S:null});
 vm.runInContext(section('function saveSnapshot(){','async function save(){'),c);
 c.S={id:'a',zone:3,gold:5};
 const snap=vm.runInContext('saveSnapshot()',c);
 assert.equal(snap.zone,1);assert.equal(snap.atHarbor,true);assert.equal(snap.atPalace,undefined);assert.equal(snap.gold,5);
 assert.equal(c.S.zone,3,'the live state is untouched');assert.equal(c.S.atHarbor,undefined);
 /* and the builder reads the note: back in the City the hero wakes on the flight, clear of the dark under the arch that takes him down */
 assert.match(source,/else if\(z\.city&&S\.atHarbor\)world\.spawn=\{\.\.\.HARBOR_FOOT\};/);assert.match(source,/delete S\.atPalace;delete S\.atHarbor;/);
 const c2=vm.createContext({});vm.runInContext(section('const HARBOR_GATE=','/* what blocks, as rects in the flight')+';globalThis.out={foot:HARBOR_FOOT,step:HARBOR_STEP,gate:HARBOR_GATE};',c2);
 assert.ok(c2.out.foot.y<c2.out.step.y-200&&c2.out.foot.x===c2.out.step.x,'the way down does not fire again the moment you come up');
 assert.ok(c2.out.step.y>5000&&c2.out.step.y<c2.out.gate.foot,'the step is inside the wall, under the arch');
});

test('every write of the character goes through the snapshot',()=>{
 assert.equal((source.match(/JSON\.stringify\(S\)/g)||[]).length,0,'no raw JSON.stringify(S)');
 assert.equal((source.match(/cloudPushChar\(S\)/g)||[]).length,0,'no raw cloud push of S');
 assert.ok((source.match(/JSON\.stringify\(saveSnapshot\(\)\)/g)||[]).length>=2);
});

test('an unknown zone index never reaches the character list or the world builder',()=>{
 assert.match(source,/if\(!ZONES\[s\.zone\|0\]\)s\.zone=TAVERN_ZONE;/,'migrate sends the hero to Moonshine');
 assert.doesNotMatch(source,/\$\{ZONES\[ch\.zone\]\.name\}/,'the character card has a fallback zone name');
 assert.match(source,/\(ZONES\[ch\.zone\]\|\|ZONES\[TAVERN_ZONE\]\)\.name/);
 /* the zone table is append-only: the Throne Hall came after the guild, the Harbour after the Throne Hall - and is the last entry */
 const zones=section('const ZONES=[','const TAVERN_ZONE=');
 assert.ok(zones.lastIndexOf('throne:true')>zones.lastIndexOf('tideguild:true'));
 assert.ok(zones.lastIndexOf('harbor:true')>zones.lastIndexOf('throne:true'));
 assert.match(zones,/harbor:true[^\n]*\n[^\n]*\},\n\];\n$/,'nothing may be inserted before it');
});
