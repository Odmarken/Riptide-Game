/* Firestore over plain HTTPS (assets/cloud/firestore-rest.js), headless: values encoded exactly as the SDK encodes
 * them and decoded back unchanged, update masks that touch ONE hero and leave the others alone, a document that is not
 * there as an answer rather than an error, errors with codes, and a deadline on every request. The fake server
 * (helpers/fake-firestore.cjs) applies update masks the way Firestore documents them - and the way a trial against the
 * real database confirmed - so "the other heroes survive" is tested, not assumed.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../assets/cloud/firestore-rest.js');

const {fakeFirestore}=require('./helpers/fake-firestore.cjs');   /* applies update masks the way Firestore documents them */
const cloud=(server,token='good-token',timeoutMs=500)=>R.client({fetch:server.fetch,project:'p',getToken:async()=>token,timeoutMs});

test('plain JSON goes to Firestore values exactly as the SDK writes them, and comes back unchanged',()=>{
 assert.deepEqual(R.encodeValue(7),{integerValue:'7'});assert.deepEqual(R.encodeValue(-3),{integerValue:'-3'});
 assert.deepEqual(R.encodeValue(0.5),{doubleValue:0.5});assert.deepEqual(R.encodeValue(2**53),{doubleValue:2**53},'past the safe integers a number is a double, as in the SDK');
 assert.deepEqual(R.encodeValue(-0),{doubleValue:-0});assert.deepEqual(R.encodeValue(1e15),{integerValue:'1000000000000000'});
 assert.deepEqual(R.encodeValue(null),{nullValue:null});assert.deepEqual(R.encodeValue(true),{booleanValue:true});assert.deepEqual(R.encodeValue(''),{stringValue:''});
 assert.deepEqual(R.encodeValue([]),{arrayValue:{values:[]}});assert.deepEqual(R.encodeValue({}),{mapValue:{fields:{}}});
 assert.deepEqual(R.encodeFields({a:1,b:undefined}),{a:{integerValue:'1'}},'undefined is "not there", as JSON has it');
 assert.throws(()=>R.encodeValue([[1]]),/array directly inside an array/);assert.throws(()=>R.encodeValue(()=>1),/cannot store/);
 const save={name:'Åsa "the Bold"',lvl:60,gold:1900000,rating:3000.5,dead:false,pet:null,bag:[{id:'w1',atk:12.25,runes:['fire','ice'],up:0},{id:'a2',tags:[]}],
  city:{v:4,treasury:-400000,winds:{trade:-0.125},noble:{offers:[{id:'feast',cost:70000,taken:true}]},allies:{},'odd key.with dots':1,'ключ':'värde'},big:9007199254740991,tiny:1e-9,rev:13898};
 assert.deepEqual(R.decodeFields(R.encodeFields(save)),save);
 assert.deepEqual(R.decodeFields(JSON.parse(JSON.stringify(R.encodeFields(save)))),save,'and it survives the wire');
 assert.equal(R.decodeValue({integerValue:'12'}),12);assert.ok(Number.isNaN(R.decodeValue({doubleValue:'NaN'})));assert.equal(R.decodeValue({doubleValue:'-Infinity'}),-Infinity);
 assert.deepEqual(R.decodeValue({arrayValue:{}}),[]);assert.deepEqual(R.decodeValue({mapValue:{}}),{});assert.equal(R.decodeValue({timestampValue:'2026-01-01T00:00:00Z'}),'2026-01-01T00:00:00Z');
});

test('field paths for an update mask: identifiers as they are, anything else in backticks',()=>{
 assert.equal(R.fieldPath(['chars','cmrarbi4f2ks']),'chars.cmrarbi4f2ks');assert.equal(R.fieldPath(['updatedAt']),'updatedAt');
 assert.equal(R.fieldPath(['chars','9lives']),'chars.`9lives`');assert.equal(R.fieldPath(['chars','a.b']),'chars.`a.b`');assert.equal(R.fieldPath(['x','we`ird\\id']),'x.`we\\`ird\\\\id`');
});

test('saving ONE hero touches that hero and nothing else - the others, the roster and unknown fields survive',async()=>{
 const s=fakeFirestore(),c=cloud(s);
 s.docs.set('players/u1',R.encodeFields({season:1,roster:['a','b','c'],activeSession:'legacy',chars:{a:{name:'A',lvl:1},b:{name:'B',lvl:50,bag:[1,2]},c:{name:'C',lvl:9}},updatedAt:1}));
 await c.patch('players/u1',{chars:{b:{name:'B',lvl:51,bag:[1,2,3]}},updatedAt:2},[['chars','b'],['updatedAt']]);
 assert.deepEqual(s.read('players/u1'),{season:1,roster:['a','b','c'],activeSession:'legacy',chars:{a:{name:'A',lvl:1},b:{name:'B',lvl:51,bag:[1,2,3]},c:{name:'C',lvl:9}},updatedAt:2});
 const call=s.calls[s.calls.length-1];
 assert.equal(call.method,'PATCH');assert.equal(call.token,'good-token');assert.deepEqual(new URLSearchParams(call.query).getAll('updateMask.fieldPaths'),['chars.b','updatedAt']);
 assert.deepEqual(Object.keys(call.body.fields).sort(),['chars','updatedAt'],'only what is masked is even sent');
 /* the roster rides along when it changed; a masked path that is absent from the data is a delete (how a hero is removed) */
 await c.patch('players/u1',{season:1,roster:['a','b'],updatedAt:3},[['season'],['roster'],['chars','c'],['updatedAt']]);
 assert.deepEqual(s.read('players/u1'),{season:1,roster:['a','b'],activeSession:'legacy',chars:{a:{name:'A',lvl:1},b:{name:'B',lvl:51,bag:[1,2,3]}},updatedAt:3});
 /* a first save ever creates the document; no mask replaces a document whole (the session claim, a leaderboard entry) */
 await c.patch('players/u2',{chars:{z:{name:'Z'}},updatedAt:1},[['chars','z'],['updatedAt']]);assert.deepEqual(s.read('players/u2'),{chars:{z:{name:'Z'}},updatedAt:1});
 await c.patch('players/u1/meta/session',{activeSession:'S1',sessionAt:5});await c.patch('players/u1/meta/session',{activeSession:'S2'});
 assert.deepEqual(s.read('players/u1/meta/session'),{activeSession:'S2'});
});

test('reading: a document, a document that is not there, and a ranked query',async()=>{
 const s=fakeFirestore(),c=cloud(s);
 s.docs.set('players/u1',R.encodeFields({season:1,chars:{a:{lvl:3}}}));
 assert.deepEqual(await c.get('players/u1'),{exists:true,data:{season:1,chars:{a:{lvl:3}}},updateTime:'2026-09-21T20:00:00Z'});
 assert.deepEqual(await c.get('players/nobody'),{exists:false,data:null,updateTime:null},'not an error: a new account has no document yet');
 for(const [id,score] of [['x',5],['y',50],['z',20]])s.docs.set('leaderboard/'+id,R.encodeFields({name:id,score,season:1}));
 const top=await R.client({fetch:s.fetch,project:'p'}).query('leaderboard',{orderBy:'score',descending:true,limit:2});   /* the leaderboard is public: no token */
 assert.deepEqual(top,[{id:'y',data:{name:'y',score:50,season:1}},{id:'z',data:{name:'z',score:20,season:1}}]);
 assert.equal(s.calls[s.calls.length-1].token,'');
});

test('a heartbeat asks for one field of a large document, and a token that ran out is renewed once',async()=>{
 const s=fakeFirestore(),c=cloud(s);
 s.docs.set('players/u1',R.encodeFields({activeSession:'S9',sessionAt:4,chars:{a:{bag:new Array(50).fill('sword')}}}));
 assert.deepEqual((await c.get('players/u1',['activeSession'])).data,{activeSession:'S9'});
 assert.match(s.calls[s.calls.length-1].query,/^\?mask\.fieldPaths=activeSession$/);
 const asked=[],expired={ok:false,status:401,text:async()=>'{"error":{"message":"expired"}}'};
 const flaky=R.client({project:'p',getToken:async fresh=>{asked.push(!!fresh);return fresh?'good-token':'stale-token';},
  fetch:async(url,opt)=>opt.headers.Authorization==='Bearer stale-token'?expired:s.fetch(url,opt)});
 assert.deepEqual((await flaky.get('players/u1',['sessionAt'])).data,{sessionAt:4});assert.deepEqual(asked,[false,true],'asked again, this time for a fresh token');
 let tries=0;const hopeless=R.client({project:'p',getToken:async()=>'stale-token',fetch:async()=>{tries++;return expired;}});
 await assert.rejects(hopeless.get('players/u1'),e=>e.code==='unauthenticated');assert.equal(tries,2,'once more - not for ever');
});

test('errors carry a code, and a server that never answers is "unavailable" after the deadline - nothing hangs',async()=>{
 const s=fakeFirestore();
 await assert.rejects(cloud(s,'stolen-token').get('players/u1'),e=>e instanceof R.CloudError&&e.code==='permission-denied'&&e.status===403&&/insufficient permissions/.test(e.message));
 await assert.rejects(cloud(s,null).patch('players/u1',{a:1},[['a']]),e=>e.code==='unauthenticated');
 const silent=R.client({fetch:()=>new Promise(()=>{}),project:'p',timeoutMs:60}),t0=Date.now();
 await assert.rejects(silent.get('players/u1'),e=>e.code==='unavailable'&&/no answer within 60 ms/.test(e.message));
 assert.ok(Date.now()-t0<1000);
 await assert.rejects(R.client({fetch:async()=>{throw new TypeError('Failed to fetch');},project:'p'}).get('x/y'),e=>e.code==='unavailable'&&/Failed to fetch/.test(e.message));
 await assert.rejects(R.client({fetch:async()=>({ok:false,status:429,text:async()=>'{"error":{"message":"Quota exceeded."}}'}),project:'p'}).get('x/y'),e=>e.code==='resource-exhausted'&&e.message==='Quota exceeded.');
});

test('paths are escaped a segment at a time and the project lands in the URL',async()=>{
 const s=fakeFirestore(),c=cloud(s);
 await c.patch('leaderboard/s1_uid_with space/and',{a:1}).catch(()=>{});
 assert.match(s.calls[0].url,/^https:\/\/firestore\.googleapis\.com\/v1\/projects\/p\/databases\/\(default\)\/documents\/leaderboard\/s1_uid_with%20space\/and$/);
});
