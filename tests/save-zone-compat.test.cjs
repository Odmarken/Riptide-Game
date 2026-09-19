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

test('every write of the character goes through the snapshot',()=>{
 assert.equal((source.match(/JSON\.stringify\(S\)/g)||[]).length,0,'no raw JSON.stringify(S)');
 assert.equal((source.match(/cloudPushChar\(S\)/g)||[]).length,0,'no raw cloud push of S');
 assert.ok((source.match(/JSON\.stringify\(saveSnapshot\(\)\)/g)||[]).length>=2);
});

test('an unknown zone index never reaches the character list or the world builder',()=>{
 assert.match(source,/if\(!ZONES\[s\.zone\|0\]\)s\.zone=TAVERN_ZONE;/,'migrate sends the hero to Moonshine');
 assert.doesNotMatch(source,/\$\{ZONES\[ch\.zone\]\.name\}/,'the character card has a fallback zone name');
 assert.match(source,/\(ZONES\[ch\.zone\]\|\|ZONES\[TAVERN_ZONE\]\)\.name/);
 /* the zone table is append-only: the Throne Hall is its last entry */
 const zones=section('const ZONES=[','const TAVERN_ZONE=');
 assert.ok(zones.lastIndexOf('throne:true')>zones.lastIndexOf('tideguild:true'));
});
