/* The second road to the cloud, as the GAME uses it. On 2026-09-21 Firestore's live channel was refused from the developer's
 * network while plain HTTPS requests went through; the SDK then neither answers nor fails. These tests run the game's own
 * cloud code (cut out of game.js) against an SDK that never answers and a small Firestore behind fetch, and hold what
 * matters: the heroes still come down and go up, ONE hero per save and the others untouched, the session lock still
 * works, a healthy channel is still the first choice, and an idle window no longer writes anything at all.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const FirestoreRest=require('../assets/cloud/firestore-rest.js');
const {fakeFirestore}=require('./helpers/fake-firestore.cjs');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const between=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,'missing: '+a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,'missing: '+b);return source.slice(i,j);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const plain=v=>JSON.parse(JSON.stringify(v));   /* out of the vm's realm, so deepEqual compares values and not prototypes */

/* the production waits, pinned here and then shrunk so that a silent channel costs the tests milliseconds */
const WAITS='const SDK_WAIT_MS=4000,SDK_WRITE_MS=10000,SESSION_POLL_MS=45000,';
const FAST='const SDK_WAIT_MS=60,SDK_WRITE_MS=90,SESSION_POLL_MS=40,';

/* an SDK whose answers can be switched off: 'healthy' works on the same documents as the REST server, 'silent' never
   answers (what a refused channel looks like), 'denied' is a real refusal */
function fakeSdk(server,mode){
 const log=[],never=new Promise(()=>{}),DELETE={del:true};let network=true;
 const act=(what,fn)=>{log.push(what);
  if(!network||mode.now==='silent')return never;
  if(mode.now==='denied')return Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'}));
  return Promise.resolve().then(fn);};
 const merge=(into,data)=>{for(const [k,v] of Object.entries(data)){const segs=k.split('.');let cur=into;for(const sg of segs.slice(0,-1))cur=cur[sg]=cur[sg]||{};if(v===DELETE)delete cur[segs[segs.length-1]];else cur[segs[segs.length-1]]=v;}return into;};
 const docRef=p=>({
  get:()=>act('get '+p,()=>{const d=server.read(p);return {exists:!!d,data:()=>d};}),
  set:(data,opt)=>act('set '+p,()=>{server.write(p,opt&&opt.merge?merge(server.read(p)||{},data):plain(data));}),
  update:data=>act('update '+p,()=>{const d=server.read(p);if(!d)throw Object.assign(new Error('No document to update'),{code:'not-found'});server.write(p,merge(d,data));}),
  onSnapshot:()=>{log.push('listen '+p);return ()=>log.push('unlisten '+p);},
  collection:name=>colRef(p+'/'+name)});
 const colRef=p=>{const q={doc:id=>docRef(p+'/'+id),orderBy:()=>q,limit:()=>q,
  get:()=>act('query '+p,()=>({docs:[...server.docs.keys()].filter(k=>k.startsWith(p+'/')&&k.split('/').length===2).map(k=>({data:()=>server.read(k)})).sort((a,b)=>b.data().score-a.data().score)}))};return q;};
 return {log,DELETE,db:{collection:colRef,disableNetwork:async()=>{network=false;log.push('network off');},enableNetwork:async()=>{network=true;log.push('network on');}}};
}

function boot({channel='silent',server=fakeFirestore(),local={},roster=null,memo=null}={}){
 const mode={now:channel},sdk=fakeSdk(server,mode),errors=[],warns=[],shown=[];
 const store=new Map(Object.entries(local).map(([id,ch])=>['riptide-char-'+id,JSON.stringify(ch)])),ls=new Map();
 let ids=roster||Object.keys(local);
 if(memo!==null)ls.set('riptide-cloud-rest',String(memo));
 const ctx=vm.createContext({console:{error:m=>errors.push(String(m)),warn:(...a)=>warns.push(a.map(String).join(' ')),log(){}},
  setTimeout,clearTimeout,clearInterval,setInterval:(f,ms)=>{const t=setInterval(f,ms);t.unref();return t;},
  FirestoreRest,fetch:server.fetch,FIREBASE_CONFIG:{projectId:'p'},firebase:{firestore:{FieldValue:{delete:()=>sdk.DELETE}}},
  LS:{get:k=>ls.has(k)?ls.get(k):null,set:(k,v)=>ls.set(k,String(v)),del:k=>ls.delete(k)},
  SEASON:1,S:null,gameOn:false,AC:{},stopAmbience(){},memChars:{},ZONES:[{},{}],CITY_ZONE:0,
  migrate:x=>x,lbScore:()=>0,publishLB(){},stageMsg(){},log(){},renderSelect(){},showSelect(){shown.push('select');},showLogin:m=>shown.push('login: '+m),
  $:()=>({classList:{contains:()=>false,add(){},remove(){}}}),window:{},
  loadRoster:async()=>[...ids],saveRoster:async v=>{ids=[...v];},
  loadChar:async id=>store.has('riptide-char-'+id)?JSON.parse(store.get('riptide-char-'+id)):null,
  deviceGet:async k=>store.get(k)||null,deviceSet:async(k,v)=>{store.set(k,v);},deviceDelete:async k=>{store.delete(k);}});
 const cloud=between('function cloudPushProblem(e){','/* 🚪 Signed in:');
 assert.ok(cloud.includes(WAITS),'the production waits are 4 s for a read, 10 s for a write and a 45 s heartbeat');
 vm.runInContext(between('const FB={ready:false','\nlet seasonReady=false;'),ctx);
 vm.runInContext(cloud.replace(WAITS,FAST),ctx);
 vm.runInContext(between('let selectFetching=false,cloudSilent=false;','/* --- global leaderboard'),ctx);
 vm.runInContext(between('async function fetchLB(){','\nconst esc='),ctx);
 vm.runInContext(between('const FB_PUSH_MS=','\nsetInterval(()=>{ /* trailing flush'),ctx);
 vm.runInContext(`FB.ready=true;FB.db=__db;FB.user={uid:'u1',getIdToken:async()=>'good-token'};
  globalThis.api={FB,SESSION_ID,claimSession,cloudPushChar,cloudDeleteChar,cloudPullRoster,enterAfterAuth,tryLive,fetchLB,save,saveNow,kickSession,
   get watching(){return !!sessUnsub;},stop(){if(sessUnsub)sessUnsub();},get fetching(){return selectFetching;},get silent(){return cloudSilent;}};`,
  Object.assign(ctx,{__db:sdk.db}));
 const localHero=id=>store.has('riptide-char-'+id)?JSON.parse(store.get('riptide-char-'+id)):null;
 return {api:ctx.api,ctx,sdk,server,mode,errors,warns,shown,ls,localHero,roster:()=>[...ids]};
}
const hero=(id,rev,extra={})=>({id,name:'Hero '+id.toUpperCase(),lvl:10,rev,gold:100,bag:[{id:'w1',atk:3}],...extra});
const cloudDoc=chars=>({season:1,roster:Object.keys(chars),chars,updatedAt:1});
const restCalls=g=>g.server.calls.map(c=>c.method+' '+c.path.split('/documents/')[1]+(c.query?' '+decodeURIComponent(c.query):''));

test('a channel that never answers: the heroes still come down, the hero that is ahead goes up ALONE, the lock is claimed',async()=>{
 const g=boot({channel:'silent',local:{a:hero('a',7,{gold:777}),b:hero('b',3)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9,{gold:999}),c:hero('c',2)}));
 await g.api.enterAfterAuth();await sleep(60);   /* the correcting push is not waited for by the sign-in */
 assert.equal(g.api.FB.rest,true);assert.equal(g.api.fetching,false);assert.equal(g.api.silent,false,'the cloud DID answer - by the other road');
 assert.equal(g.localHero('b').gold,999,'the newer cloud copy came down');assert.equal(g.localHero('a').gold,777,'the newer local copy stayed');
 assert.deepEqual(g.roster().sort(),['a','b','c'],'and a hero this device had never seen joined the roster');
 const cloud=g.server.read('players/u1');
 assert.equal(cloud.chars.a.rev,7);assert.equal(cloud.chars.a.gold,777,'the cloud was corrected with the hero that was ahead');
 assert.deepEqual(cloud.chars.b,hero('b',9,{gold:999}));assert.deepEqual(cloud.chars.c,hero('c',2),'and the others were not touched');
 assert.deepEqual(g.server.read('players/u1/meta/session').activeSession,g.api.SESSION_ID);assert.ok(g.api.watching);
 const push=g.server.calls.find(c=>c.method==='PATCH'&&/players\/u1$/.test(c.path));
 assert.deepEqual(new URLSearchParams(push.query).getAll('updateMask.fieldPaths'),['chars.a','updatedAt','season','roster'],'the mask names chars.<hero>, never chars');
 assert.ok(g.sdk.log.includes('network off'),'the SDK is silenced, so nothing it still holds can land later');
 assert.ok(g.ls.has('riptide-cloud-rest'),'and the choice is remembered');
 assert.equal(g.errors.filter(e=>/saving over plain requests/.test(e)).length,1,'said once, where error.log keeps it: '+g.errors.join(' | '));
 g.api.stop();
});

test('in that mode a save is one request for one hero, and only the first of a session is read back',async()=>{
 const g=boot({channel:'silent',memo:Date.now(),local:{a:hero('a',5),b:hero('b',9)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9),c:hero('c',2)}));
 await g.api.enterAfterAuth();g.server.calls.length=0;
 assert.equal(await g.api.cloudPushChar(hero('a',6,{gold:150})),true);
 assert.equal(await g.api.cloudPushChar(hero('a',7,{gold:175})),true);
 assert.deepEqual(restCalls(g),['PATCH players/u1 ?updateMask.fieldPaths=chars.a&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=season&updateMask.fieldPaths=roster','GET players/u1',
  'PATCH players/u1 ?updateMask.fieldPaths=chars.a&updateMask.fieldPaths=updatedAt']);
 const cloud=g.server.read('players/u1');
 assert.equal(cloud.chars.a.gold,175);assert.deepEqual(cloud.chars.b,hero('b',9));assert.deepEqual(cloud.chars.c,hero('c',2));
 assert.ok(!g.errors.some(e=>/gone from the cloud|did not read back/.test(e)),g.errors.join(' | '));
 g.api.stop();
});

test('if the service ever dropped the other heroes on a save, the read-back says so and puts them back',async()=>{
 const g=boot({channel:'silent',memo:Date.now(),server:fakeFirestore({maskBug:true}),local:{a:hero('a',5)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9,{gold:999}),c:hero('c',2)}));
 await g.api.enterAfterAuth();
 assert.equal(await g.api.cloudPushChar(hero('a',6)),true);
 const cloud=g.server.read('players/u1');
 assert.deepEqual(Object.keys(cloud.chars).sort(),['a','b','c']);assert.deepEqual(cloud.chars.b,hero('b',9,{gold:999}));assert.equal(cloud.chars.a.rev,6);
 assert.ok(g.errors.some(e=>/2 hero\(es\) were gone from the cloud after a save - putting them back/.test(e)),g.errors.join(' | '));
 g.api.stop();
});

test('a healthy live channel is still the first choice: no plain request is made at all',async()=>{
 const g=boot({channel:'healthy',local:{a:hero('a',7)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9)}));
 await g.api.enterAfterAuth();await sleep(30);
 assert.equal(g.api.FB.rest,false);assert.deepEqual(restCalls(g),[]);
 assert.equal(g.server.read('players/u1').chars.a.rev,7);assert.equal(g.localHero('b').rev,9);
 assert.ok(g.sdk.log.includes('listen players/u1/meta/session'),'and the lock is watched by a listener: '+g.sdk.log.join(', '));
 assert.ok(!g.ls.has('riptide-cloud-rest'));assert.deepEqual(g.errors,[]);
 g.api.stop();
});

test('a channel that dies in the middle of a session: the save still lands, the lock is asked for instead of listened to',async()=>{
 const g=boot({channel:'healthy',local:{a:hero('a',5)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9)}));
 await g.api.enterAfterAuth();
 g.mode.now='silent';
 assert.equal(await g.api.cloudPushChar(hero('a',6,{gold:321})),true,'the push came back true - by the other road');
 assert.equal(g.api.FB.rest,true);assert.equal(g.server.read('players/u1').chars.a.gold,321);assert.deepEqual(g.server.read('players/u1').chars.b,hero('b',9));
 assert.ok(g.sdk.log.includes('unlisten players/u1/meta/session'));
 g.server.calls.length=0;await sleep(110);
 assert.ok(restCalls(g).includes('GET players/u1/meta/session ?mask.fieldPaths=activeSession'),'the heartbeat: '+restCalls(g).join(', '));
 assert.equal(g.api.FB.sdkPending,1,'the SDK still holds the save it never sent');
 assert.equal(await g.api.tryLive(),false);assert.ok(!g.sdk.log.includes('network on'),'so its network is NOT switched back on: that old copy would land on top of newer ones');
 /* opened on another device: noticed by the heartbeat */
 g.server.write('players/u1/meta/session',{activeSession:'sess_elsewhere',sessionAt:2});
 await sleep(110);
 assert.equal(g.api.FB.kicked,true);assert.match(g.shown[g.shown.length-1],/^login: .*opened on another device/);assert.equal(g.api.watching,false);
});

test('the choice is remembered for half an hour - and the live channel gets its chance again after that',async()=>{
 const recent=boot({channel:'silent',memo:Date.now()-20*60000,local:{a:hero('a',5)}});
 recent.server.write('players/u1',cloudDoc({a:hero('a',5)}));
 const t0=Date.now();await recent.api.enterAfterAuth();
 assert.ok(!recent.sdk.log.some(l=>/^(get|set|update) /.test(l)),'the SDK was not asked for anything: '+recent.sdk.log.join(', '));
 assert.ok(Date.now()-t0<50,'and nobody waited on it');assert.deepEqual(recent.errors,[],'nothing new happened, nothing is written down');
 recent.api.stop();
 const old=boot({channel:'healthy',memo:Date.now()-31*60000,local:{a:hero('a',5)}});
 old.server.write('players/u1',cloudDoc({a:hero('a',5)}));
 await old.api.enterAfterAuth();
 assert.equal(old.api.FB.rest,false);assert.ok(old.sdk.log.includes('get players/u1'));assert.deepEqual(restCalls(old),[]);
 old.api.stop();
});

test('a raid or a duel asks the live channel once more: back on it when it answers, told so when it does not',async()=>{
 const g=boot({channel:'silent',memo:Date.now(),local:{a:hero('a',5)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5)}));
 await g.api.enterAfterAuth();
 assert.equal(await g.api.tryLive(),false);assert.equal(g.api.FB.rest,true);
 assert.deepEqual(g.sdk.log.filter(l=>/network/.test(l)).slice(-2),['network on','network off'],'tried, and shut again');
 g.mode.now='healthy';
 assert.equal(await g.api.tryLive(),true);assert.equal(g.api.FB.rest,false);assert.ok(!g.ls.has('riptide-cloud-rest'));
 assert.equal(g.sdk.log[g.sdk.log.length-1],'listen players/u1/meta/session','and the lock is listened to again');
 g.api.stop();
 const ensure=between('async function mpEnsureFirebase(){','\n}');
 assert.match(ensure,/return tryLive\(\);/);
 assert.equal((source.match(/stageMsg\(mpNotReady\(/g)||[]).length,4,'both raid doors and both duel doors explain themselves');
});

test('a real refusal is an answer, not a reason to go round: nothing is rerouted',async()=>{
 const g=boot({channel:'denied',local:{a:hero('a',5)}});
 assert.equal(await g.api.cloudPullRoster(),false);
 assert.equal(g.api.FB.rest,false);assert.deepEqual(restCalls(g),[]);
});

test('deleting a hero and reading the leaderboard go by the second road too',async()=>{
 const g=boot({channel:'silent',memo:Date.now(),local:{a:hero('a',5)},roster:['a']});
 g.server.write('players/u1',cloudDoc({a:hero('a',5),b:hero('b',9)}));
 for(const [id,score,season] of [['x',5,1],['y',50,1],['z',20,1],['old',99,0]])g.server.write('leaderboard/'+id,{name:id,score,season});
 await g.api.enterAfterAuth();
 assert.deepEqual(g.roster().sort(),['a','b']);await g.ctx.saveRoster(['a']);   /* as the Delete button does: off this device's roster first */
 await g.api.cloudDeleteChar('b');
 const cloud=g.server.read('players/u1');
 assert.deepEqual(Object.keys(cloud.chars),['a']);assert.deepEqual(cloud.roster,['a']);assert.deepEqual(Object.keys(g.api.FB.cloudSeen.chars),['a'],'and the read-back will not put him back');
 assert.deepEqual(plain(await g.api.fetchLB()).map(e=>e.name),['y','z','x'],'ranked, this season only');
 g.api.stop();
});

test('both roads dead: the sign-in still ends, on the heroes of this device',async()=>{
 const g=boot({channel:'silent',local:{a:hero('a',5)}});
 g.ctx.fetch=()=>new Promise(()=>{});
 vm.runInContext('FB.restClient=FirestoreRest.client({fetch:(u,o)=>fetch(u,o),project:"p",timeoutMs:80,getToken:async()=>"good-token"});',g.ctx);
 const t0=Date.now();await g.api.enterAfterAuth();
 assert.ok(Date.now()-t0<3000);assert.equal(g.api.fetching,false);assert.equal(g.localHero('a').rev,5);
 g.api.stop();
});

test('an idle window writes nothing: the autosave of an unchanged hero is not a save at all',async()=>{
 const g=boot({channel:'silent',memo:Date.now(),local:{a:hero('a',5)}});
 g.server.write('players/u1',cloudDoc({a:hero('a',5)}));
 await g.api.enterAfterAuth();g.server.calls.length=0;
 g.ctx.S=hero('a',5);
 await g.api.save();await sleep(20);
 assert.equal(g.ctx.S.rev,6);assert.equal(g.localHero('a').rev,6);
 assert.equal(restCalls(g).filter(c=>c.startsWith('PATCH players/u1 ')).length,1,'the first save of a session goes up');
 for(let i=0;i<5;i++)await g.api.save();
 assert.equal(g.ctx.S.rev,6,'rev did not move: it may never run ahead of a cloud copy that was not sent');
 assert.equal(g.localHero('a').rev,6);assert.equal(restCalls(g).filter(c=>c.startsWith('PATCH players/u1 ')).length,1);
 g.ctx.S.gold+=1;await g.api.save();
 assert.equal(g.ctx.S.rev,7);assert.equal(g.localHero('a').gold,101,'a hero that changed is saved on this device at once');
 assert.equal(restCalls(g).filter(c=>c.startsWith('PATCH players/u1 ')).length,1,'and goes up when the minute is over, not sooner');
 assert.equal(g.api.FB.pushDirty,true);
 await g.api.saveNow();
 assert.equal(g.ctx.S.rev,8);assert.equal(g.server.read('players/u1').chars.a.gold,101,'saveNow() does not wait for the minute');
 assert.match(source,/\nconst FB_PUSH_MS=60000;/);
 g.api.stop();
 /* the tick that was most of the 4.5K writes of 2026-09-21: every XP a paddock earned forced the whole hero to the cloud */
 const ui=fs.readFileSync(path.join(__dirname,'..','assets','tides','ui.js'),'utf8'),at=ui.indexOf(' function tickTraining(){');
 const tick=ui.slice(at,ui.indexOf('\n }',at)).split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 assert.ok(at>0&&/\.changed\)\{save\(\);/.test(tick)&&!/saveNow\(/.test(tick),'nothing that ticks may call saveNow(): '+tick);
});

test('one pull and one claim per sign-in, and the page loads the module before the game',()=>{
 const listener=between('FB.auth.onAuthStateChanged(async u=>{','},()=>{');
 assert.match(listener,/else if\(!first&&!FB\.formSignIn&&seasonReady\)\{/,'the auth listener leaves the boot and the sign-in form to enterAfterAuth()');
 const form=between('async function fbSignIn(create){','\n}');
 assert.ok(form.indexOf('FB.formSignIn=true')<form.indexOf('signInWithEmailAndPassword'),'flagged BEFORE the sign-in that wakes the listener');
 assert.match(form,/\}finally\{FB\.formSignIn=false;\}/);
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.indexOf('assets/cloud/firestore-rest.js')>0&&html.indexOf('assets/cloud/firestore-rest.js')<html.indexOf('<script src="game.js'));
 const pull=between('async function cloudPullRoster(job){','\n}');
 assert.ok(!/\n\s+cloudPushChar\(local\);/.test(pull),'heroes that are ahead are no longer pushed side by side (all but the first used to bounce)');
 assert.match(pull,/for\(const ch of ahead\)if\(!\(S&&S\.id===ch\.id\)\)await cloudPushChar\(ch\);/);
});
