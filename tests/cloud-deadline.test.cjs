/* Nothing the player is looking at may wait on the cloud for ever. On 2026-09-21 Firestore refused every stream for the
 * project ("Unknown SID") while plain reads worked: get() and set() never came back, the sign-in form had already shut,
 * and the game sat on a bare HUD with no error anywhere. within() is the deadline every cloud wait now goes through;
 * this holds it, and holds the places that must use it. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const between=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,'missing: '+a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,'missing: '+b);return source.slice(i,j);};

function loadWithin(){
 const errors=[],context=vm.createContext({console:{error:m=>errors.push(String(m))},setTimeout,clearTimeout,Promise});
 vm.runInContext(between('function within(p,ms,what){','\n/* ☁ Two roads')+';globalThis.within=within;',context);
 return {within:context.within,errors};
}

test('within() answers with the value, with a failure, or with "late" - and never rejects or hangs',async()=>{
 const {within,errors}=loadWithin();
 assert.deepEqual({...await within(Promise.resolve(7),50,'a')},{ok:true,value:7});
 const denied=await within(Promise.reject(new Error('denied')),50,'b');
 assert.equal(denied.failed,true);assert.equal(denied.error.message,'denied','the failure is handed on: whoever asked decides whether the other road is worth trying');
 const t0=Date.now(),late=await within(new Promise(()=>{}),60,'the hero roster');
 assert.deepEqual({...late},{late:true});assert.ok(Date.now()-t0>=50&&Date.now()-t0<1000,'it waited its deadline and no longer');
 assert.deepEqual({...await within(42,50,'not even a promise')},{ok:true,value:42});
 assert.equal(errors.length,2,'a failure and a silence are both written down: '+errors.join(' | '));
 assert.match(errors[0],/cloud: b failed - denied/);assert.match(errors[1],/cloud: the hero roster did not answer within 60 ms/);
 let fail;const slow=new Promise((_,rej)=>{fail=rej;});
 assert.deepEqual({...await within(slow,30,'c')},{late:true});fail(new Error('client is offline'));await new Promise(r=>setTimeout(r,10));
 assert.equal(errors.length,3,'what fails AFTER its deadline is not reported a second time: '+errors.join(' | '));
});

test('signing in opens the character select at once and gives the cloud a deadline - on both ways in',()=>{
 const enter=between('async function enterAfterAuth(){','\n}');
 assert.ok(enter.indexOf('showSelect()')<enter.indexOf('within('),'the select screen opens BEFORE anything waits on the cloud');
 assert.match(enter,/within\(\(async\(\)=>\{await adoptGuestChars\(\);return cloudPullRoster\(job\);\}\)\(\),CLOUD_WAIT_MS/);
 assert.match(enter,/within\(claimSession\(\)/);assert.match(enter,/abandonPulls\(\)/);
 const form=between("const cred=create?await FB.auth.createUserWithEmailAndPassword","\n}");
 assert.match(form,/await enterAfterAuth\(\)/);assert.ok(!/await cloudPullRoster\(\)|await claimSession\(\)/.test(form),'the form no longer waits on the cloud itself');
 assert.match(form,/\$\('login'\)\.classList\.add\('open'\)/,'and an error is shown on a form that is open, not written into a shut one');
 assert.match(source,/\n if\(FB\.user\)await enterAfterAuth\(\);\n else showLogin\(\);/,'a remembered session goes the same way');
 const listener=between('FB.auth.onAuthStateChanged(async u=>{','},()=>{');
 assert.ok(!/\n\s*if\(u[^\n]*\)\{?await (adoptGuestChars|cloudPullRoster|claimSession)\(/.test(listener),'the auth listener is awaited by initFirebase at boot: it may not wait bare either');
 assert.equal((listener.match(/within\(/g)||[]).length,2);
});

test('a late answer never lands on a hero who is being played, and leaving the game never hangs',()=>{
 const pull=between('async function cloudPullRoster(job){','\n}');
 assert.ok(pull.indexOf('if(job.abandoned)')>pull.indexOf('await cloudGetPlayer(uid)')&&pull.indexOf('await cloudGetPlayer(uid)')>0&&pull.indexOf('if(job.abandoned)')<pull.indexOf('migrate(raw)'),'an abandoned pull is dropped before it touches a save');
 assert.match(between("$('exitBtn').onclick=async()=>{","\n};"),/await within\(saveNow\(\),\d+,/);
 const push=between('async function cloudPushChar(ch){','\n}');
 assert.match(push,/if\(FB\.pushing&&Date\.now\(\)-FB\.pushing<\d+\)return false;/,'pushes do not pile up behind one that never came back');
 assert.equal((push.match(/FB\.pushing=0/g)||[]).length,2,'and the guard is released on success and on failure');
});

test('the character select says what is happening instead of showing nothing',()=>{
 const render=between('async function renderSelect(){','\n document.querySelectorAll(\'[data-play]\')');
 assert.match(render,/if\(selectFetching\)\{[^}]*Fetching your heroes from the cloud/);
 assert.ok(!/The cloud is not answering\./.test(render),'a silent cloud is not announced over a list of heroes - they are simply offered');
 assert.match(render,/No heroes are saved on this device, and the cloud is not answering/,'only an EMPTY list explains itself, so nobody thinks their heroes are gone');
});
