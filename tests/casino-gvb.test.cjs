/* The chest duel ("Gamble against friend") after the casino review of 2026-09-30, pinned so it stays fixed. The rules run for
 * real in a vm; the table runs as several real clients on an in-memory Firestore with transactions (helpers/duel-rig.cjs,
 * every client its own vm holding the duel cut from game.js); the markup and the texts are pinned by their source.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=game.indexOf(from),b=game.indexOf(to,a);assert.ok(a>=0&&b>a,'section '+from);return game.slice(a,b);};
const {Sim,makeClient,seat,openAs,autoplay,serverDoc,text,listeners}=require('./helpers/duel-rig.cjs');
const sum=a=>a.reduce((t,x)=>t+x,0);
const deltas=(cls,before)=>cls.map((c,i)=>c.total()-before[i]);
async function openRounds(sim,cls,n,scoreOf){for(let r=0;r<n;r++){await sim.until(()=>cls.some(c=>c.alive&&c.can('gvbOpen')),30000,50);await openAs(cls.find(c=>c.alive&&c.can('gvbOpen')),scoreOf);await sim.run(11500);}}
async function toBet(sim,cls){
 const [h,...g]=cls;cls.forEach(c=>c.open());
 await h.click('gvbCreate');await sim.run(1000);const code=h.g().code;
 for(const c of g){c.$('gvbCode').value=code;await c.click('gvbJoin');await sim.run(800);}
 for(const c of cls)await c.click('gvbReady');await sim.run(800);
 await h.click('gvbStart');await sim.run(800);
 return code;
}

test('the rules: a verdict only once every stake is in, rounds without gaps, a pot of paid seats only',()=>{
 const c=vm.createContext({});
 vm.runInContext(section('const GVB_SCORE=','function gvbShow(')+section('const gvbOld=','function gvbRender(')
  +';Object.assign(globalThis,{gvb,gvbClean,gvbPaidCount,gvbWavesOf,gvbDecide,gvbStakesIn,gvbAllLocked,GVB_V,GVB_MAXP});',c);
 const w=sc=>({seed:1,o:{pa:{sc},pb:{sc:3}}});
 /* gap-safe: the room's copy wins, WebRTC only fills a round the room does not hold, and the rounds stop at the first gap */
 assert.equal(c.gvbWavesOf({0:w(5),1:w(5),3:w(5)}).length,2,'a missing round 2 hides round 4 - it used to shift into its place');
 assert.equal(c.gvbWavesOf({0:w(5),1:w(5),3:w(5)},{2:w(7)}).length,4);
 assert.equal(c.gvbWavesOf({0:w(5)},{0:w(20)})[0].o.pa.sc,5,'the room\'s copy of a round wins');
 const five={0:w(5),1:w(5),2:w(5),3:w(5),4:w(5)};
 const room=o=>c.gvbClean(Object.assign({state:'roll',host:'pa',order:['pa','pb'],rounds:5,bet:1000,players:{pa:{v:3},pb:{v:3}},waves:five,paid:{pa:true,pb:true},forfeits:{}},o));
 assert.deepEqual({...c.gvbDecide(room({}))},{w:'pa',pot:2000,f:false,n:5});
 assert.equal(c.gvbDecide(room({paid:{pa:true}})),null,'a seat that has neither paid nor forfeited keeps the verdict open (the pay window)');
 assert.deepEqual({...c.gvbDecide(room({paid:{pa:true},forfeits:{pb:true},waves:{}}))},{w:'pa',pot:1000,f:true,n:0},'nobody else paid: only the own stake');
 assert.deepEqual({...c.gvbDecide(room({paid:{},forfeits:{pa:true,pb:true},waves:{}}))},{w:null,pot:0,f:true,n:0},'nobody left');
 assert.equal(c.gvbDecide(room({waves:{0:w(5),1:w(5),2:w(5),4:w(5)}})),null,'a gap is not a finished duel');
 /* the verdict as it comes in: a seat of this table, a whole-number pot */
 assert.equal(room({result:{w:'pzz',pot:5}}).result,null,'a winner who is not at the table is no verdict');
 assert.deepEqual({...room({result:{w:'pb',pot:'1e3x',f:1}}).result},{w:'pb',pot:0,f:true,n:0});
 assert.deepEqual({...room({result:{w:null,pot:7}}).result},{w:null,pot:7,f:false,n:0});
 /* the pot counts paid flags only - an older build's seat without one adds nothing (gvb-4) */
 c.gvb.pid='pzz';c.gvb.paidOk=false;
 assert.equal(c.gvbPaidCount({order:['pa','pb'],players:{pa:{v:3},pb:{}},paid:{pa:true},forfeits:{}}),1);
 /* the roll starts only on identical locks for this round count, from builds that pay through the room, and 6+ seats play 10 */
 const bet=(o,players)=>Object.assign({state:'bet',rounds:10,order:Object.keys(players),players},o);
 const L=(b,r=10,v=3)=>({ok:true,bet:b,r,v});
 assert.equal(c.gvbAllLocked(bet({},{pa:L(5000),pb:L(5000)})),true);
 assert.equal(c.gvbAllLocked(bet({},{pa:L(5000),pb:L(9000)})),false);
 assert.equal(c.gvbAllLocked(bet({},{pa:L(5000),pb:L(5000,5)})),false,'a lock made under another round count');
 assert.equal(c.gvbAllLocked(bet({},{pa:L(5000),pb:L(5000,10,2)})),false,'an older build');
 const six={};for(const p of ['pa','pb','pc','pd','pe','pf'])six[p]=L(5000,5);
 assert.equal(c.gvbAllLocked(bet({rounds:5},six)),false,'6 seats never play 5 rounds');
 assert.equal(c.GVB_V,3);assert.equal(c.GVB_MAXP,10);
});

test('the verdict is written once, with the round that decides it: no second winner, no lost pot (gvb-1, verify MISSED gvbv-2)',async()=>{
 /* gvb-1: Anna leads, opens the Leave confirm before the last round, Bert deals it under her confirm and his tab goes to the
    background; Anna presses Yes after her own screen paid her. It used to write a forfeit that paid Bert as well. */
 for(const rtc of ['none','fast']){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:11,rtc,up:90,down:90}),B=makeClient(sim,'Bert',{seed:22,rtc,up:90,down:90});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:10});
  const sc=nm=>nm==='Anna'?5:3;
  await openRounds(sim,[A,B],9,sc);
  await A.click('gvbLeave');assert.ok(A.confirmOpen(),'undecided: Leave asks first');
  await sim.until(()=>B.can('gvbOpen'),30000,50);await openAs(B,sc);await sim.run(300);
  B.hide();
  await sim.until(()=>A.g().settled,20000,16);
  await A.yes();await sim.run(1500);
  B.show();await sim.run(12000);
  const d=serverDoc(sim,code);
  assert.deepEqual(Object.keys(d.forfeits),[],'a Yes after the verdict writes no forfeit ('+rtc+')');
  assert.equal(d.players[d.result.w].name,'Anna');
  assert.match(text(B,'gvbDoneTxt'),/Anna TAKES THE POT/);
  assert.deepEqual(deltas([A,B],before),[100000,-100000]);
 }
 /* gvbv-2: Bert leads and confirms Leave in the last moments of the final reel - it used to name him the winner on the other
    screens while his own never paid (the pot went to no one). Now his Leave settles by the room's verdict. */
 for(const [x,early] of [[250,false],[20,false],[400,true],[20,true]]){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:261}),B=makeClient(sim,'Bert',{seed:262});
  const before=[A.total(),B.total()];
  await seat(sim,[A,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[A,B],4,sc);
  await sim.until(()=>A.can('gvbOpen'),30000,50);
  if(early)await B.click('gvbLeave');
  await openAs(A,sc);const tWave=sim.now+170;await sim.run(1000);
  if(!early){await B.click('gvbLeave');assert.equal(B.confirmOpen(),undefined,'the verdict is in: Leave shows it instead of asking');}
  await sim.run(Math.max(0,tWave+10400-x-sim.now));
  if(B.confirmOpen())await B.yes();
  await sim.run(3000);
  assert.deepEqual(deltas([A,B],before),[-100000,100000],`Bert is paid, nothing vanishes (Yes ${x} ms before his reel ends, early ${early})`);
  assert.match(text(A,'gvbDoneTxt'),/Bert TAKES THE POT/);
 }
});

test('a screen cut off from the room can neither claim nor pay itself (verify MISSED gvbv-1)',async()=>{
 /* a network drop of over 2 minutes: both sides were offered Claim, both claimed and both paid themselves the pot */
 const sim=new Sim();
 const A=makeClient(sim,'Anna',{seed:31}),B=makeClient(sim,'Bert',{seed:32});
 const before=[A.total(),B.total()];
 const code=await seat(sim,[A,B],{bet:100000,rounds:10});
 const sc=nm=>nm==='Anna'?5:3;
 await openRounds(sim,[A,B],2,sc);
 B.goOffline();
 await autoplay(sim,[A,B],sc,{max:400000});
 assert.ok(B.claims>0,'the cut-off side pressed Claim');
 assert.equal(B.g().settled,false,'and is paid nothing while it cannot reach the room');
 assert.ok(B.msgs.includes('No answer from the table yet'),'true even when the cloud carries the claim later');
 assert.ok(!B.msgs.some(m=>/nothing was claimed/.test(m)),'no answer is not a refusal');
 assert.equal(B.total()-before[1],-100000);
 B.goOnline();await sim.run(15000);
 const d=serverDoc(sim,code);
 assert.deepEqual(Object.keys(d.forfeits).map(p=>d.players[p].name),['Bert']);
 assert.match(text(B,'gvbDoneTxt'),/Anna TAKES THE POT/);
 assert.equal(sum(deltas([A,B],before)),0);
 /* three seats, one cut off after round 1: it used to claim the others one by one and pay itself too */
 const sim3=new Sim();
 const cls=['Anna','Bert','Cina'].map((n,i)=>makeClient(sim3,n,{seed:41+i}));const b3=cls.map(c=>c.total());
 await seat(sim3,cls,{bet:100000,rounds:5});
 await openRounds(sim3,cls,1,sc);
 cls[2].goOffline();
 await autoplay(sim3,cls,sc,{max:900000});
 cls[2].goOnline();await sim3.run(30000);
 assert.deepEqual(deltas(cls,b3),[200000,-100000,-100000]);
});

test('a round goes over WebRTC only once the room holds it (gvb-3)',async()=>{
 /* Anna and Bert share a LAN link, Cina has none; Anna's internet drops as she opens round 4. The round used to reach Bert by
    WebRTC alone, shift Cina's count, and Cina claimed her way to a second pot */
 const sim=new Sim();
 const A=makeClient(sim,'Anna',{seed:51,rtc:'fast'}),B=makeClient(sim,'Bert',{seed:52,rtc:'fast'}),C=makeClient(sim,'Cina',{seed:53,rtc:'none'});
 A.lanRtc=true;B.lanRtc=true;
 const cls=[A,B,C],before=cls.map(c=>c.total());
 const code=await seat(sim,cls,{bet:100000,rounds:5});
 const sc=nm=>nm==='Bert'?5:3;
 await openRounds(sim,cls,3,sc);
 A.goOffline();
 await sim.until(()=>A.can('gvbOpen'),30000,50);await openAs(A,sc);await sim.run(12000);
 assert.equal(A.msgs.slice(-1)[0],'No answer from the table - try again');
 assert.equal(B.run('gvbWaves().length'),3,'nothing reached Bert by WebRTC');
 const end=sim.now+900000;let back=false;const t=sim.now;
 while(sim.now<end&&!cls.every(c=>c.g().settled||!c.g().ref)){if(!back&&sim.now-t>400000){A.goOnline();back=true;}await autoplay(sim,cls.filter(c=>c.online),sc,{max:2000});await sim.run(250);}
 if(!back)A.goOnline();
 await sim.run(15000);
 const d=serverDoc(sim,code);
 assert.deepEqual(Object.keys(d.waves).map(Number),[0,1,2,3,4],'the room\'s rounds run without a gap');
 assert.equal(d.players[d.result.w].name,'Bert');
 assert.equal(sum(deltas(cls,before)),0);
 assert.deepEqual(cls.map(c=>/Bert TAKES|YOU WIN/.test(text(c,'gvbDoneTxt'))),[true,true,true],'every screen shows the one verdict');
});

test('no chest opens before every stake is in; a seat that never paid sits the duel out (gvb-2, gvb-19)',async()=>{
 /* 6 seats: the host cannot pick 5 rounds; Fia locks, then closes her game. She used to be dealt chests and win the pot. */
 const sim=new Sim();
 const names=['Anna','Bert','Cina','Dave','Erik','Fia'];
 const cls=names.map((nm,i)=>makeClient(sim,nm,{seed:600+i}));const before=cls.map(c=>c.total());
 const code=await toBet(sim,cls);
 const h=cls[0];
 assert.equal(h.can('gvbR5'),false,'6+ seats play 10 rounds');
 h.invoke(()=>h.$('gvbR5').onclick(),'r5');await sim.run(500);
 assert.equal(serverDoc(sim,code).rounds,10);
 const F=cls[5];F.$('gvbBetIn').value='100000';await F.click('gvbBetLock');await sim.run(400);F.kill();
 for(const c of cls.slice(0,5)){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim.run(300);}
 await sim.until(()=>h.panel()==='gvbDuel',10000,10);
 assert.match(h.$('gvbRound').textContent,/^Collecting stakes \d\/6$/);
 assert.equal(h.$('gvbOpen').style.display,'none','Open waits for the stakes');
 /* the window runs 30 s from the last stake that came in (round 2: it ran from the roll, and a present seat still paying on a slow
    link was skipped) */
 await sim.until(()=>h.$('gvbRound').textContent==='Collecting stakes 5/6',30000,20);const tLast=sim.now;
 await sim.run(29000);
 assert.equal(h.can('gvbOpen'),false,'still waiting on Fia inside the pay window');
 await sim.until(()=>h.can('gvbOpen'),8000,100);
 assert.ok(sim.now-tLast>=30000&&sim.now-tLast<34000,'Fia sits out 30 s after the last stake came in ('+(sim.now-tLast)+' ms)');
 assert.equal(h.$('gvbRound').textContent,'Round 1 / 10 · pot '+(500000).toLocaleString()+'◉','the pot line counts every stake that came in');
 const d0=serverDoc(sim,code);
 assert.deepEqual(Object.keys(d0.forfeits).map(p=>d0.players[p].name),['Fia']);
 const live=cls.slice(0,5);
 await autoplay(sim,live,nm=>nm==='Anna'||nm==='Fia'?5:3,{max:900000});
 const d=serverDoc(sim,code);
 assert.equal(d.players[d.result.w].name,'Anna');assert.equal(d.result.pot,500000);
 assert.ok(Object.values(d.waves).every(w=>!w.o[d.order[5]]),'Fia was never dealt a chest');
 assert.equal(sum(deltas(cls,before)),0);
});

test('a seat that comes back after the table went on without it is charged nothing (gvb-6, gvb-17)',async()=>{
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:111}),B=makeClient(sim,'Bert',{seed:112});
 const before=[A.total(),B.total()];
 const code=await toBet(sim,[A,B]);
 B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');await sim.run(400);
 B.goOffline();
 A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(2000);
 await autoplay(sim,[A],()=>3,{max:120000});
 assert.match(text(A,'gvbDoneTxt'),/YOUR STAKE COMES BACK.*nobody else could pay/,'a refund is not shown as a victory');
 assert.ok(A.logs.includes('Gamble against friend: nobody else could pay - your '+(100000).toLocaleString()+' ◉ stake comes back.'));
 B.goOnline();await sim.run(15000);
 assert.equal(serverDoc(sim,code).paid[serverDoc(sim,code).order[1]],undefined);
 assert.deepEqual(B.msgs,['The duel went on without you - nothing was taken']);
 assert.ok(B.logs.every(l=>!/gone/.test(l)),'nothing is called gone that was never taken');
 assert.deepEqual(deltas([A,B],before),[0,0]);
 /* a seat whose purse dropped below the stake after its lock: it sits out, and is told so */
 const s2=new Sim();const X=makeClient(s2,'Anna',{seed:231}),Y=makeClient(s2,'Bert',{seed:232});
 const b2=[X.total(),Y.total()];
 await toBet(s2,[X,Y]);
 Y.$('gvbBetIn').value='100000';await Y.click('gvbBetLock');await s2.run(300);
 Y.run('S.gold=50000;');const y0=Y.total();
 X.$('gvbBetIn').value='100000';await X.click('gvbBetLock');await s2.run(8000);
 assert.equal(Y.total(),y0,'nothing taken');
 assert.deepEqual(Y.msgs,['You no longer carry the stake - you sit this one out (nothing was taken)']);
 assert.match(Y.logs[0],/sat out the duel .* nothing was staked/);
 assert.equal(X.total(),b2[0]);
});

test('Create and Join: one request at a time, one listener, Leave calls off what is in flight, a silent cloud says so (gvb-5, gvb-10, gvb-20, ui-gvb-2)',async()=>{
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:101});A.open();
  await A.click('gvbCreate');await sim.run(100);
  assert.equal(A.can('gvbCreate'),false,'Create is disabled while it waits');
  A.invoke(()=>A.run('gvbCreate()'),'second');await sim.run(1500);
  assert.equal(sim.server.docs.size,1,'a double click writes one room');assert.equal(listeners(A),1);
  A.invoke(()=>A.run('gvbListen()'),'again');await sim.run(200);
  assert.equal(listeners(A),1,'listening again drops the old listener first'); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:141}),B=makeClient(sim,'Bert',{seed:142});A.open();B.open();
  await A.click('gvbCreate');await sim.run(1000);const code=A.g().code;
  B.$('gvbCode').value=code;await B.click('gvbJoin');await sim.run(120);
  assert.equal(B.can('gvbJoin'),false);B.invoke(()=>B.run(`gvbJoin('${code}')`),'second');await sim.run(2000);
  assert.equal(serverDoc(sim,code).order.length,2,'a double click takes one seat');
  await A.click('gvbReady');await B.click('gvbReady');await sim.run(1500);
  assert.equal(A.$('gvbStart').style.display,'inline-block'); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:231,up:150,down:150});
  A.open();await A.click('gvbCreate');await sim.run(60);await A.click('gvbLeave');await sim.run(3000);
  assert.equal(A.$('gvbFx').style.display,'none');assert.equal(A.g().ref,null);assert.equal(listeners(A),0);
  assert.deepEqual([...sim.server.docs.values()].map(d=>d.state),['closed'],'the room that landed after Leave is shut');
  const sim2=new Sim();const H=makeClient(sim2,'Anna',{seed:241}),B=makeClient(sim2,'Bert',{seed:242,up:150,down:150});
  H.open();B.open();await H.click('gvbCreate');await sim2.run(1000);const code=H.g().code;
  B.$('gvbCode').value=code;await B.click('gvbJoin');await sim2.run(100);await B.click('gvbLeave');await sim2.run(3000);
  assert.equal(serverDoc(sim2,code).order.length,1,'the seat that landed after Leave is taken away');assert.equal(listeners(B),0); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:251});A.open();A.silent=true;
  await A.click('gvbCreate');await sim.run(7000);
  assert.equal(A.$('gvbEntryMsg').textContent,'The cloud is not answering - Leave to give up');
  await A.click('gvbLeave');await sim.run(500);
  assert.equal(A.g().ref,null);A.silent=false;A.open();
  assert.equal(A.can('gvbCreate'),true,'a new try is possible');
  const sim3=new Sim();const C=makeClient(sim3,'Cina',{seed:253});C.open();
  C.ctx.FB.db.collection=()=>({doc:id=>({path:'rooms/'+id,id,set:()=>Promise.reject(Object.assign(new Error('denied'),{code:'permission-denied'}))})});
  await C.click('gvbCreate');await sim3.run(500);
  assert.equal(C.g().code,null);assert.equal(C.g().ref,null,'a refused create leaves nothing set');
  assert.equal(C.$('gvbEntryMsg').textContent,'Could not create room: permission-denied'); }
});

test('seats are taken where the room is read: never 11 of 10, never mid-duel, never at an older host (gvb-14, gvb-11, gvb-4)',async()=>{
 { const sim=new Sim();
  const cls=['Anna','Bert','Cina','Dave','Erik','Fia','Gus','Hel','Ivo','Jan','Kim'].map((nm,i)=>makeClient(sim,nm,{seed:150+i}));
  cls.forEach(c=>c.open());
  await cls[0].click('gvbCreate');await sim.run(1000);const code=cls[0].g().code;
  for(const c of cls.slice(1,9)){c.$('gvbCode').value=code;await c.click('gvbJoin');await sim.run(700);}
  for(const c of cls.slice(9,11)){c.$('gvbCode').value=code;await c.click('gvbJoin');}
  await sim.run(3000);
  assert.equal(serverDoc(sim,code).order.length,10);
  assert.equal(cls.slice(9).filter(c=>c.msgs.includes('Room is full (10 players)')).length,1); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:161}),B=makeClient(sim,'Bert',{seed:162}),C=makeClient(sim,'Cina',{seed:163});
  const c0=C.total();[A,B,C].forEach(c=>c.open());
  await A.click('gvbCreate');await sim.run(1000);const code=A.g().code;
  B.$('gvbCode').value=code;await B.click('gvbJoin');await sim.run(800);
  C.$('gvbCode').value=code;await C.click('gvbJoin');await sim.run(170);C.goOffline();await sim.run(500);
  await A.click('gvbReady');await B.click('gvbReady');await sim.run(800);await A.click('gvbStart');await sim.run(800);
  for(const c of [A,B]){c.$('gvbBetIn').value='300000';await c.click('gvbBetLock');await sim.run(300);}
  await sim.run(2000);await openRounds(sim,[A,B],2,()=>3);
  C.goOnline();await sim.run(15000);
  assert.equal(serverDoc(sim,code).order.length,2,'the late seat never landed');assert.equal(C.total(),c0);assert.equal(listeners(C),0); }
 { /* an older build's room: its host seat has no v (or v 2) */
  const sim=new Sim();const B=makeClient(sim,'Bert',{seed:170});B.open();
  sim.server.put('rooms/GVB-OLD22',{gvb:true,state:'lobby',host:'pold1',order:['pold1'],rounds:10,players:{pold1:{name:'Anna',ready:false,bet:0,ok:false,v:2}},waves:{},forfeits:{}});
  B.$('gvbCode').value='OLD22';await B.click('gvbJoin');await sim.run(1500);
  assert.deepEqual(B.msgs,['The host must update the game to duel']);
  assert.equal(sim.server.docs.get('rooms/GVB-OLD22').order.length,1);assert.equal(listeners(B),0); }
});

test('a table with an older build never starts, and the host clears a seat nobody answers for (gvb-4, gvb-10)',async()=>{
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:81}),B=makeClient(sim,'Bert',{seed:82});
 A.open();B.open();
 await A.click('gvbCreate');await sim.run(1000);const code=A.g().code;
 B.$('gvbCode').value=code;await B.click('gvbJoin');await sim.run(1000);
 /* an older exe joins the way it does: arrayUnion its seat with v 2 (or none), ready at once */
 const d0=serverDoc(sim,code);
 sim.server.put('rooms/GVB-'+code,Object.assign(d0,{order:[...d0.order,'pold9'],players:Object.assign(d0.players,{pold9:{name:'Olle',ready:true,bet:0,ok:false,v:2}})}));
 sim.server.notify('rooms/GVB-'+code);
 await A.click('gvbReady');await B.click('gvbReady');await sim.run(1500);
 assert.match(A.$('gvbPlayers').innerHTML,/Olle <span style="color:#ff8a7a">- update the game<\/span>/);
 assert.equal(A.$('gvbStart').style.display,'none');
 A.invoke(()=>A.$('gvbStart').onclick(),'start');await sim.run(1500);
 assert.equal(serverDoc(sim,code).state,'lobby','the room refuses a start with an older seat');
 A.invoke(()=>A.$('gvbPlayers').onclick({target:{closest:()=>({dataset:{gvbkick:'pold9'}})}}),'kick');await sim.run(1500);
 assert.equal(serverDoc(sim,code).order.length,2);
 assert.equal(A.$('gvbStart').style.display,'inline-block');
 /* a guest's screen whose seat was cleared leaves the table */
 const bp=B.g().pid;
 A.invoke(()=>A.$('gvbPlayers').onclick({target:{closest:()=>({dataset:{gvbkick:bp}})}}),'kick');await sim.run(1500);
 assert.deepEqual(B.msgs,['You were removed from the table']);assert.equal(B.$('gvbFx').style.display,'none');
 B.invoke(()=>B.$('gvbPlayers').onclick({target:{closest:()=>({dataset:{gvbkick:A.g().pid}})}}),'kick');await sim.run(500);
 assert.equal(serverDoc(sim,code).order.length,1,'only the host clears seats');
});

test('the roll starts on locks the room holds, for the round count they were made under (gvb-12, gvb-22)',async()=>{
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:171}),B=makeClient(sim,'Bert',{seed:172});
  const before=[A.total(),B.total()];
  const code=await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';B.$('gvbBetIn').value='250000';await A.click('gvbBetLock');await B.click('gvbBetLock');await sim.run(1500);
  A.$('gvbBetIn').value='250000';B.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await B.click('gvbBetLock');await sim.run(3000);
  assert.equal(serverDoc(sim,code).state,'bet','a swap of re-locks starts nothing');assert.deepEqual(deltas([A,B],before),[0,0]);
  B.$('gvbBetIn').value='250000';await B.click('gvbBetLock');await sim.run(3000);
  assert.equal(serverDoc(sim,code).state,'roll');assert.equal(serverDoc(sim,code).bet,250000);
  assert.deepEqual(deltas([A,B],before),[-250000,-250000]); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:181}),B=makeClient(sim,'Bert',{seed:182});
  const code=await toBet(sim,[A,B]);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');await sim.run(800);
  await A.click('gvbR5');await sim.run(800);
  const d=serverDoc(sim,code);assert.equal(d.players[d.order[1]].ok,false,'a new round count clears the locks');
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(1500);
  assert.equal(serverDoc(sim,code).state,'bet');
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');await sim.run(1500);
  assert.equal(serverDoc(sim,code).state,'roll');assert.equal(serverDoc(sim,code).rounds,5); }
 { /* the host's link drops as the last lock lands: the tick asks the room again */
  const sim=new Sim();const A=makeClient(sim,'Anna',{seed:1}),B=makeClient(sim,'Bert',{seed:2});
  const code=await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');await sim.run(81);
  A.goOffline();await sim.run(3000);assert.equal(serverDoc(sim,code).state,'bet');
  A.goOnline();await sim.run(6000);assert.equal(serverDoc(sim,code).state,'roll'); }
});

test('Claim: only for the opener and round it was offered for, refused once that round landed (gvb-8, gvb-16)',async()=>{
 for(const [rtc,dt] of [['fast',40],['fast',120],['fast',400],['none',40]]){
  const sim=new Sim();
  const cls=['Anna','Bert','Cina'].map((nm,i)=>makeClient(sim,nm,{seed:120+i,rtc}));const [A,B,C]=cls;
  const code=await seat(sim,cls,{bet:100000,rounds:10});
  const sc=nm=>nm==='Anna'?5:3;
  await openRounds(sim,cls,2,sc);
  await sim.until(()=>B.can('gvbClaim'),200000,100);
  assert.equal(B.$('gvbClaim').textContent,'⏱ Cina is gone - skip them (they forfeit)','with 3 seats a claim skips, it does not win');
  assert.match(C.$('gvbTurnTxt').textContent,/^You open the chests for everyone · the table may skip you now$/);
  await openAs(C,sc);await sim.run(dt);
  B.invoke(()=>B.$('gvbClaim').onclick(),'claim');await sim.run(3000);
  assert.deepEqual(Object.keys(serverDoc(sim,code).forfeits),[],`nobody is forfeited (rtc ${rtc}, click ${dt} ms after the round)`);
 }
 /* two seats: the claim takes the pot, and the opener sees the time left */
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:210}),B=makeClient(sim,'Bert',{seed:211});
 await seat(sim,[A,B],{bet:100000});
 await openRounds(sim,[A,B],1,()=>3);
 await sim.run(15000);
 assert.match(B.$('gvbTurnTxt').textContent,/^You open the chests for everyone · 1m \d\ds left$/);
 await sim.until(()=>A.can('gvbClaim'),200000,500);
 assert.equal(A.$('gvbClaim').textContent,'⏱ Bert is gone - claim the pot');
});

test('a room shut under a missed last round still pays its recorded winner; a verdict stays up when the other leaves first (gvb-13, gvb-18)',async()=>{
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:191}),B=makeClient(sim,'Bert',{seed:192});
  const before=[A.total(),B.total()];
  await seat(sim,[A,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[A,B],4,sc);
  B.goOffline();
  await sim.until(()=>A.can('gvbOpen'),30000,50);await openAs(A,sc);await sim.run(11500);
  A.run(`gvb.ref.update({state:'closed'})`); /* what an older exe's Leave did */
  await sim.run(2000);B.goOnline();await sim.run(15000);
  assert.match(text(B,'gvbDoneTxt'),/YOU WIN THE POT/);assert.deepEqual(B.msgs,[]);
  assert.deepEqual(deltas([A,B],before),[-100000,100000]); }
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:241}),B=makeClient(sim,'Bert',{seed:242});
  await seat(sim,[A,B],{bet:100000,rounds:5});
  await openRounds(sim,[A,B],5,nm=>nm==='Anna'?5:3);await sim.run(2000);
  const shown=text(B,'gvbDoneTxt');
  await A.click('gvbLeave');await sim.run(2000);
  assert.equal(B.panel(),'gvbDone');assert.deepEqual(B.msgs,[]);assert.equal(text(B,'gvbDoneTxt'),shown);
  await B.click('gvbLeave');await sim.run(500);assert.equal(B.$('gvbFx').style.display,'none'); }
});

test('an honest screen cannot be made to mint or to pay a stake it did not lock (gvb-7)',async()=>{
 { /* the stake, the verdict's pot and a fake paid seat, all rewritten from one console */
  const sim=new Sim();const X=makeClient(sim,'Xena',{seed:250}),B=makeClient(sim,'Bert',{seed:251});
  const before=[X.total(),B.total()];
  await seat(sim,[X,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[X,B],4,sc);
  X.run(`gvb.ref.update({bet:50000000,order:firebase.firestore.FieldValue.arrayUnion('pfake1'),'paid.pfake1':true})`);await sim.run(1000);
  await openRounds(sim,[X,B],1,sc);
  X.run(`gvb.ref.update({'result.pot':999999999})`);await sim.run(12000);
  assert.equal(B.total()-before[1],100000,'Bert takes his own stake and Xena\'s - no more'); }
 { /* the stake rewritten before a seat's screen saw the roll */
  const sim=new Sim();const X=makeClient(sim,'Xena',{seed:260}),B=makeClient(sim,'Bert',{seed:261});
  const b0=B.total();
  const code=await toBet(sim,[X,B]);
  X.$('gvbBetIn').value='100000';await X.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');B.downMs=2500;
  await sim.until(()=>serverDoc(sim,code).state==='roll',20000,5);
  X.run(`gvb.ref.update({bet:900000})`);await sim.run(12000);
  assert.equal(B.total(),b0,'nothing of Bert\'s stays taken'); }
 /* the pay step checks its own lock; the Open handler deals only the next round, by the opener the room names */
 const pay=section('function gvbPay(d){','\nfunction gvbPayTx');
 assert.match(pay,/lk\.bet!==d\.bet\|\|lk\.r!==d\.rounds/);
 const open=section("$('gvbOpen').onclick=","$('gvbClaim').onclick=");
 assert.match(open,/if\(W\.length!==i\|\|gvbTrigger\(d2,W\)!==me\|\|gvbWinner\(d2,W\)\)return null;/);
 assert.ok(open.indexOf('gvbRtcBroadcast')>open.indexOf('gvbTx('),'a round goes over WebRTC only after the room took it');
});

test('the hero put away at any moment: nothing throws, nothing listens, the table settles, nothing reaches the next hero (gvb-9)',async()=>{
 const stages=['create in flight','join in flight','lobby host','bet guest','pay window','mid-round','last reel','after the verdict'];
 for(const stage of stages){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:301}),B=makeClient(sim,'Bert',{seed:302}),C=makeClient(sim,'Cina',{seed:303});
  const cls=[A,B,C],before=cls.map(c=>c.total());
  let X=B,hero0;
  const sw=()=>{hero0=X.S();X.invoke(()=>X.run('gvbLeaveForSwitch();S=null;'),'switch');};
  const sc=nm=>nm==='Bert'?7:nm==='Anna'?5:3;
  if(stage==='create in flight'){X=A;A.open();A.upMs=A.downMs=400;await A.click('gvbCreate');await sim.run(300);sw();await sim.run(3000);}
  else if(stage==='join in flight'){A.open();B.open();await A.click('gvbCreate');await sim.run(1000);B.upMs=B.downMs=400;B.$('gvbCode').value=A.g().code;await B.click('gvbJoin');await sim.run(500);sw();await sim.run(3000);}
  else if(stage==='lobby host'){A.open();B.open();await A.click('gvbCreate');await sim.run(1000);B.$('gvbCode').value=A.g().code;await B.click('gvbJoin');await sim.run(1000);X=A;sw();await sim.run(3000);assert.deepEqual(B.msgs,['The room was closed']);}
  else if(stage==='bet guest'){await toBet(sim,cls);A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);sw();await sim.run(3000);}
  else{
   await seat(sim,cls,{bet:100000,rounds:5});
   if(stage==='mid-round'){await sim.until(()=>A.can('gvbOpen'),30000,50);await openAs(A,sc);await sim.run(4000);}
   if(stage==='last reel'||stage==='after the verdict'){await openRounds(sim,cls,4,sc);await sim.until(()=>cls.some(c=>c.can('gvbOpen')),30000,50);await openAs(cls.find(c=>c.can('gvbOpen')),sc);await sim.run(stage==='last reel'?3000:12000);}
   sw();
   await autoplay(sim,cls.filter(c=>c!==X),sc,{max:900000});await sim.run(5000);
  }
  assert.deepEqual([X.$('gvbFx').style.display,X.g().ref,X.g().op,listeners(X),X.errors],['none',null,null,0,[]],stage);
  const heroDelta=hero0.gold+(hero0.overflow||0)-before[cls.indexOf(X)];
  assert.equal(heroDelta+sum(cls.filter(c=>c!==X).map(c=>c.total()-before[cls.indexOf(c)])),0,'gold conserved: '+stage);
  if(stage==='last reel'||stage==='after the verdict')assert.equal(heroDelta,200000,'the room had named this hero: paid before it was put away ('+stage+')');
  /* a new hero on the same screen: a clean seat */
  X.upMs=X.downMs=80;X.run(`S={name:'Nova',rating:0,gold:1000000,overflow:0,prestige:20,bag:[],scraps:0};`);
  const Y=makeClient(sim,'Yuki',{seed:399});const n0=[X.total(),Y.total()];
  await seat(sim,[X,Y],{bet:50000,rounds:5});
  await autoplay(sim,[X,Y],nm=>nm==='Nova'?5:3,{max:400000});
  assert.deepEqual([X.total()-n0[0],Y.total()-n0[1]],[50000,-50000],'the next hero duels clean: '+stage);
 }
 /* no hero at all (S dropped with no teardown): no throw, no pay into nobody, and Close still closes */
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:131}),B=makeClient(sim,'Bert',{seed:132});
 await seat(sim,[A,B],{bet:100000,rounds:5});
 const sc=nm=>nm==='Bert'?5:3;
 await openRounds(sim,[A,B],4,sc);await sim.until(()=>A.can('gvbOpen'),30000,50);await openAs(A,sc);await sim.run(3000);
 B.run('S=null;');await sim.run(20000);
 assert.equal(B.g().settled,false,'no verdict is marked settled without a hero to pay');
 B.invoke(()=>B.$('gvbLeave').onclick(),'close');
 assert.deepEqual([B.$('gvbFx').style.display,listeners(B),B.errors],['none',0,[]]);
 for(const id of ['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbBetLock','gvbOpen','gvbClaim'])B.invoke(()=>B.$(id).onclick(),id);
 assert.deepEqual(B.errors,[],'every button returns early with no hero');
});

test('texts: the seat limit, the rounds, sudden death, every stake - the words match the table (gvb-15, ui-gvb-1)',async()=>{
 assert.match(game,/const GVB_MAXP=10;/);
 assert.match(html,/<i>Chest duel - winner takes every stake<\/i>/);
 assert.match(html,/2-10 players, 5 or 10 rounds: every round opens one chest for each player, all at once\. Most scraps takes every stake - the scraps are only score\. A tie goes to sudden death\./);
 assert.match(html,/>Host opens first, then around the table</);
 assert.match(html,/>Everyone stakes the same amount - and must carry it\.</);
 assert.match(html,/id="gvbEntryMsg"/,'a status line in the window itself');
 assert.ok(!/2-4 players|Ten chests|Both stake|the loser's stake/.test(html),'no old wording left');
 assert.match(css,/\.gvbkick\{[^}]*\}/);
 assert.ok(!/\.gvbkick\{[^}]*cursor/.test(css),'the remove button keeps the bronze hand of .sbtn');
 assert.match(game,/setInterval\(\(\)=>\{if\(gvb\.doc&&gvb\.doc\.state==='roll'&&!gvb\.animating&&!gvb\.settled\)gvbRender\(\);else if\(S&&gvb\.doc&&gvb\.doc\.state==='bet'/);
 /* a five-seat lobby says so */
 const sim=new Sim();const cls=['Anna','Bert','Cina','Dave','Erik'].map((nm,i)=>makeClient(sim,nm,{seed:200+i}));
 cls.forEach(c=>c.open());await cls[0].click('gvbCreate');await sim.run(1000);const code=cls[0].g().code;
 for(const c of cls.slice(1)){c.$('gvbCode').value=code;await c.click('gvbJoin');await sim.run(600);}
 assert.match(cls[1].$('gvbPlayers').innerHTML,/room open \(5\/10\)/);
 assert.ok(!/gvbkick/.test(cls[1].$('gvbPlayers').innerHTML),'only the host sees the remove buttons');
 assert.equal((cls[0].$('gvbPlayers').innerHTML.match(/data-gvbkick=/g)||[]).length,4);
});

/* ---------- round 2 (review-gvb should_fix 1-7 and 10, followup-3 pad-gvb-1..5) ---------- */
test('round 2: a seat that leaves unheard still gets what the room owes it - the pot of a verdict it had not seen, a stake the room never took',async()=>{
 /* should_fix 1: the room names Bert the winner, and his screen is put away (or his Leave confirmed) before that snapshot reaches
    it. The pot went to no one (review r03, fuzz seeds 118/120/138/146/157); offline, the Leave's own question was dropped (seed 156) */
 for(const how of ['switch','leave','leave offline','switch, hero list']){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:931}),B=makeClient(sim,'Bert',{seed:932});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[A,B],4,sc);
  await sim.until(()=>A.can('gvbOpen'),30000,50);
  B.downMs=600;
  await openAs(A,sc);
  await sim.until(()=>!!(serverDoc(sim,code)||{}).result,10000,1);
  assert.equal(B.g().doc.result,null,'Bert has not seen the verdict ('+how+')');
  if(how==='leave offline')B.goOffline();
  if(how.startsWith('switch'))B.invoke(()=>B.run('gvbLeaveForSwitch()'),'switch');
  else{await B.click('gvbLeave');assert.equal(B.confirmOpen().msg,'Leave mid-duel? You forfeit - your stake stays in the pot for the winner.');await B.yes();}
  if(how==='switch, hero list')B.ctx.gameOn=false; /* showSelect: the hero is out of play, and still S */
  assert.equal(B.panel(),'closed','the window goes at once ('+how+')');
  B.downMs=80;
  if(how==='leave offline'){await sim.run(60000);B.goOnline();}
  await sim.run(40000);
  assert.deepEqual(deltas([A,B],before),[-100000,100000],'the pot the room named Bert for reaches him ('+how+')');
  assert.deepEqual(B.msgs,['🏆 The duel was yours - '+(200000).toLocaleString()+'◉'],how);
  assert.ok(B.logs.some(l=>/VICTORY - the whole .* pot is yours \(the table named you as you left\)/.test(l)),how);
  assert.deepEqual(Object.keys(serverDoc(sim,code).forfeits),[],'no forfeit is written after the verdict ('+how+')');
  assert.equal(B.parked,how==='switch, hero list'?1:0,'a payout on the hero list is parked with its hero, whose save goes up on its own ('+how+')');
  assert.deepEqual(B.errors,[]);
 }
 /* should_fix 2: Bert's stake left his purse, his link dropped before the room took it, and he left (or was put away) - it was lost */
 for(const how of ['leave','switch']){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:901}),B=makeClient(sim,'Bert',{seed:902});
  const before=[A.total(),B.total()];
  const code=await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().stake>0,20000,1);
  B.goOffline();await sim.run(3000);
  assert.equal(B.total()-before[1],-100000,'the stake left the purse');
  if(how==='leave'){await B.click('gvbLeave');await B.yes();}else B.invoke(()=>B.run('gvbLeaveForSwitch()'),'switch');
  assert.equal(B.panel(),'closed');
  await sim.run(60000);B.goOnline();await sim.run(60000);
  const d=serverDoc(sim,code);
  assert.equal(d.paid[d.order[1]],undefined,'the room never took it ('+how+')');
  assert.deepEqual(deltas([A,B],before),[0,0],'so it comes back to Bert, once ('+how+')');
  assert.deepEqual(B.msgs,['Your stake never reached the table - it came back'],how);
 }
 /* the room is shut under a stake whose pay has no answer (an older exe's Leave closes with a plain write): the room still answers for it */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:511}),B=makeClient(sim,'Bert',{seed:512});
  const b0=B.total();
  await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().stake>0,20000,1);B.silent=true;
  await sim.run(2000);A.run(`gvb.ref.update({state:'closed'})`);await sim.run(3000);
  assert.deepEqual([B.panel(),B.total()-b0],['closed',-100000]);
  await sim.run(20000);B.silent=false;await sim.run(60000);
  assert.equal(B.total(),b0,'Bert\'s stake never reached the shut room: it comes back');
  assert.deepEqual(B.msgs,['The room was closed','Your stake never reached the table - it came back']); }
 /* both seats leave while cut off: each keeps asking, so the seat whose leave lands second is the last one in the duel and takes the
    pot. A plain forfeit written without the verdict left it to no one (fuzz seeds 102/117/135/145/147) */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:971}),B=makeClient(sim,'Bert',{seed:972});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:10});
  await openRounds(sim,[A,B],2,()=>3);
  A.goOffline();B.goOffline();
  for(const c of [A,B]){await c.click('gvbLeave');await c.yes();}
  await sim.run(30000);A.goOnline();B.goOnline();await sim.run(90000);
  const d=serverDoc(sim,code),dl=deltas([A,B],before);
  assert.ok(d.result&&d.result.w,'a winner is named');
  assert.deepEqual(dl.slice().sort((x,y)=>x-y),[-100000,100000],'the last seat in the duel is paid');
  assert.equal(dl[d.order.indexOf(d.result.w)],100000); }
 /* the answer comes after another hero took the screen: nothing of the old duel reaches the new hero */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:931}),B=makeClient(sim,'Bert',{seed:932});
  const old=B.S(),b0=B.total();
  const code=await seat(sim,[A,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[A,B],4,sc);await sim.until(()=>A.can('gvbOpen'),30000,50);
  B.downMs=600;await openAs(A,sc);await sim.until(()=>!!(serverDoc(sim,code)||{}).result,10000,1);
  B.invoke(()=>B.run(`gvbLeaveForSwitch();S={name:'Nova',rating:0,gold:777000,overflow:0,prestige:20,bag:[],scraps:0};`),'switch');
  B.downMs=80;await sim.run(40000);
  assert.equal(B.total(),777000,'the new hero is not paid another hero\'s pot');
  assert.equal(old.gold+(old.overflow||0)-b0,-100000,'and the hero that was put away is not written behind the screen\'s back');
  assert.deepEqual(B.errors,[]); }
 /* no hero in play any more (the account opened elsewhere): the leave is still asked for - its forfeit lets the table go on without
    waiting two minutes for a claim - unless the screen is signed out, when the room would refuse it for ever */
 for(const signedIn of [true,false]){
  const sim=new Sim();const A=makeClient(sim,'Anna',{seed:981}),B=makeClient(sim,'Bert',{seed:982});
  const code=await seat(sim,[A,B],{bet:100000,rounds:10});
  await openRounds(sim,[A,B],1,()=>3);
  const bp=B.g().pid;B.goOffline();
  B.invoke(()=>B.run('gvbLeaveForSwitch();S=null;'+(signedIn?'':'FB.user=null;')),'switch');
  await sim.run(40000);const tx0=B.fs.txs;await sim.run(40000);
  assert.equal(B.fs.txs>tx0,signedIn,'asked again while offline (signed in '+signedIn+')');
  if(signedIn){B.goOnline();await sim.run(35000);assert.ok(serverDoc(sim,code).forfeits[bp],'the forfeit lands once the room answers');}
  assert.deepEqual(B.errors,[]);
 }
});

test('round 2: a confirmed Leave closes the window at once, and the room settles with the seat in the background',async()=>{
 /* should_fix 3 (review r40): after Yes the window stayed up for 12 s (24 s with a stake on its way), Open still showing, and a
    second Leave did nothing */
 for(const mode of ['silent','offline']){
  const sim=new Sim();const A=makeClient(sim,'Anna',{seed:61}),B=makeClient(sim,'Bert',{seed:62});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:10});
  await sim.until(()=>A.can('gvbOpen'),30000,20);await openAs(A,()=>3);await sim.run(12000);
  assert.ok(B.can('gvbOpen'),'Bert opens next');
  if(mode==='silent')B.silent=true;else B.goOffline();
  await B.click('gvbLeave');await B.yes();
  assert.deepEqual([B.panel(),B.g().ref,listeners(B)],['closed',null,0],'closed at once ('+mode+')');
  await sim.run(20000);
  if(mode==='silent')B.silent=false;else B.goOnline();
  await sim.run(40000);
  const d=serverDoc(sim,code);
  assert.deepEqual(Object.keys(d.forfeits).map(p=>d.players[p].name),['Bert'],'the forfeit lands once the room answers ('+mode+')');
  assert.equal(d.players[d.result.w].name,'Anna');
  await sim.run(3000);
  assert.deepEqual(deltas([A,B],before),[100000,-100000],mode);
  assert.deepEqual(B.errors,[]);
 }
 /* the verdict is on the screen but its own stake is still unanswered (its uploads vanish): Leave did nothing at all until the room
    answered - now it leaves, and the room answers for the stake */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:501}),B=makeClient(sim,'Bert',{seed:502});
  const before=[A.total(),B.total()];
  await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().stake>0,20000,1);B.silent=true;
  await sim.until(()=>!!(B.g().doc&&B.g().doc.result),120000,100);
  assert.deepEqual([B.panel(),B.g().settled,B.total()-before[1]],['gvbDuel',false,-100000]);
  await B.click('gvbLeave');
  assert.deepEqual([B.panel(),B.confirmOpen(),B.g().ref],['closed',undefined,null],'the verdict is in and the stake unanswered: it leaves');
  await sim.run(20000);B.silent=false;await sim.run(60000);
  assert.deepEqual(deltas([A,B],before),[0,0]);
  assert.deepEqual(B.msgs,['Your stake never reached the table - it came back']); }
});

test('round 2: a seat that sat out or was skipped reads true texts - no "claim the pot" that hands it to another, no stake in its Leave',async()=>{
 /* should_fix 4 (review r70): Cina's purse fell below the stake, so she sits out; Bert opens next and is gone */
 { const sim=new Sim();
  const cls=['Anna','Bert','Cina'].map((nm,i)=>makeClient(sim,nm,{seed:1+i}));const [A,B,C]=cls;
  await toBet(sim,cls);
  for(const c of [A,B]){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim.run(300);}
  C.$('gvbBetIn').value='100000';await C.click('gvbBetLock');C.run('S.gold=5000;');const c0=C.total();
  await sim.run(5000);
  assert.deepEqual(C.msgs,['You no longer carry the stake - you sit this one out (nothing was taken)']);
  await sim.until(()=>A.can('gvbOpen'),30000,50);await openAs(A,()=>3);await sim.run(12000);
  B.goOffline();
  await sim.until(()=>A.can('gvbClaim')&&C.can('gvbClaim'),200000,500);
  assert.equal(A.$('gvbClaim').textContent,'⏱ Bert is gone - claim the pot','Anna is in the duel: the pot is hers to claim');
  assert.equal(C.$('gvbClaim').textContent,'⏱ Bert is gone - skip them (they forfeit)','Cina sat out: her press gives the pot to Anna, and says so');
  await C.click('gvbLeave');
  assert.equal(C.confirmOpen(),undefined,'nothing staked: nothing to ask, no stake named');
  assert.equal(C.panel(),'closed');
  await sim.run(3000);assert.equal(C.total(),c0,'and nothing taken'); }
 /* a seat that was skipped: its stake is in the pot and it is out of the duel - leaving changes nothing, so nothing is asked */
 { const sim=new Sim();
  const cls=['Anna','Bert','Cina'].map((nm,i)=>makeClient(sim,nm,{seed:11+i}));const [A,B,C]=cls;const before=cls.map(c=>c.total());
  const code=await seat(sim,cls,{bet:100000,rounds:10});
  await openRounds(sim,cls,1,()=>3);
  B.goOffline();
  await sim.until(()=>A.can('gvbClaim'),200000,500);await A.click('gvbClaim');await sim.run(3000);
  assert.deepEqual(Object.keys(serverDoc(sim,code).forfeits),[B.g().pid]);
  B.goOnline();await sim.run(3000);
  await B.click('gvbLeave');
  assert.equal(B.confirmOpen(),undefined,'Bert is out of the duel already');
  assert.equal(B.panel(),'closed');
  await A.click('gvbLeave');
  assert.equal(A.confirmOpen().msg,'Leave mid-duel? You forfeit - your stake stays in the pot for the winner.','a seat still in the duel with its stake on the table is asked');
  A.confirmOpen().open=false;
  await autoplay(sim,[A,C],nm=>nm==='Cina'?5:3,{max:900000});await sim.run(5000);
  assert.deepEqual(deltas(cls,before),[-100000,-100000,200000]); }
});

test('round 2: the rounds switch and a Leave before the duel read the room - they never land on a rolling one',async()=>{
 /* should_fix 5a (review r80): the host picks 5 rounds just after its own lock started the roll. The plain write landed on the rolling
    room and cleared every lock: the host sat out ('The stake changed') and lost the duel by forfeit */
 for(const dt of [0,40,120,250]){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:11,up:120,down:120}),B=makeClient(sim,'Bert',{seed:12});
  const before=[A.total(),B.total()];
  const code=await toBet(sim,[A,B]);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');await sim.run(1500);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(dt);
  assert.equal(A.g().doc.state,'bet','the host still sees the bet panel');
  await A.click('gvbR5');await sim.run(3000);
  const d=serverDoc(sim,code);
  if(d.state==='roll')assert.deepEqual([d.rounds,Object.keys(d.paid).length,Object.keys(d.forfeits).length],[10,2,0],'the roll came first: nobody sits out ('+dt+' ms)');
  else assert.deepEqual([d.state,d.rounds,Object.values(d.players).map(p=>p.ok)],['bet',5,[false,false]],'the switch came first: everyone locks again ('+dt+' ms)');
  assert.deepEqual(A.msgs,[],dt+' ms');
  if(d.state==='roll'){await autoplay(sim,[A,B],nm=>nm==='Anna'?5:3,{max:600000});await sim.run(5000);assert.deepEqual(deltas([A,B],before),[100000,-100000],dt+' ms');}
 }
 /* should_fix 5b (review r60): a seat leaves while its screen still shows the bet panel and the room has begun to roll. The host's
    plain close shut a room with the others' stakes on it, and no verdict */
 for(const who of ['host','guest'])for(const t of [0,300,600]){
  const sim=new Sim();
  const A=makeClient(sim,'Anna',{seed:81,down:who==='host'?1000:80}),B=makeClient(sim,'Bert',{seed:82,down:who==='guest'?1000:80}),C=makeClient(sim,'Cina',{seed:83});
  const cls=[A,B,C],before=cls.map(c=>c.total()),L=who==='host'?A:B;
  cls.forEach(c=>c.open());await A.click('gvbCreate');await sim.until(()=>A.panel()==='gvbLobby',8000,20);const code=A.g().code;
  for(const c of [B,C]){c.$('gvbCode').value=code;await c.click('gvbJoin');await sim.until(()=>c.panel()==='gvbLobby',8000,20);}
  for(const c of cls)await c.click('gvbReady');
  await sim.until(()=>A.can('gvbStart'),8000,20);await A.click('gvbStart');await sim.until(()=>cls.every(c=>c.panel()==='gvbBet'),8000,20);
  for(const c of [L].concat(cls.filter(c=>c!==L))){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim.run(who==='guest'&&c===L?1500:300);}
  await sim.until(()=>serverDoc(sim,code).state==='roll',20000,1);await sim.run(t);
  assert.equal(L.g().doc.state,'bet',who+' '+t);
  await L.click('gvbLeave');assert.equal(L.confirmOpen(),undefined);
  const rest=cls.filter(c=>c!==L);
  await autoplay(sim,rest,nm=>nm==='Cina'?5:3,{max:900000});await sim.run(15000);
  const d=serverDoc(sim,code);
  assert.deepEqual([d.state,Object.keys(d.forfeits).map(p=>d.players[p].name)],['roll',[L.name]],'the leaver forfeits a duel it never paid into ('+who+' '+t+')');
  assert.equal(d.players[d.result.w].name,'Cina');
  assert.deepEqual(deltas(cls,before),who==='host'?[0,-100000,100000]:[-100000,0,100000],who+' '+t);
  assert.ok(cls.every(c=>!c.msgs.includes('The room was closed')),who+' '+t);
 }
});

test('round 2: a claim that landed is never reported as refused - its answer lost, the retry reads its own skip',async()=>{
 /* should_fix 6: 'No answer from the table - nothing was claimed' could be untrue (pinned in the gvbv-1 test above), and a claim whose
    answer was lost ran again, read its own forfeit and said 'The table moved on - nothing was claimed' */
 const sim=new Sim();
 const cls=['Anna','Bert','Cina'].map((nm,i)=>makeClient(sim,nm,{seed:120+i}));const [A,B,C]=cls;
 const code=await seat(sim,cls,{bet:100000,rounds:10});
 await openRounds(sim,cls,1,()=>3);
 const bp=B.g().pid;
 B.goOffline();
 await sim.until(()=>C.can('gvbClaim'),200000,100);
 await C.click('gvbClaim');
 await sim.until(()=>!!(serverDoc(sim,code).forfeits||{})[bp],5000,1);
 C.goOffline();await sim.run(100);C.goOnline(); /* the commit is in, its answer is lost on the way back */
 await sim.run(5000);
 assert.deepEqual(Object.keys(serverDoc(sim,code).forfeits),[bp]);
 assert.deepEqual(C.msgs,[],'the claim landed: nothing says it was refused');
});

test('round 2: the pay window runs from the last stake that came in - a full table on slow links is not skipped',async()=>{
 /* should_fix 7: ten seats at 800 ms each way need about 40 s for every contended pay transaction to land; at a fixed 30 s from the
    roll two present seats were skipped (refunded, but out of the duel) */
 const sim=new Sim();
 const names=['Anna','Bert','Cina','Dave','Erik','Fia','Gus','Hel','Ivo','Jan'];
 const cls=names.map((nm,i)=>makeClient(sim,nm,{seed:7800+i,up:800,down:800}));const before=cls.map(c=>c.total());
 const code=await seat(sim,cls,{bet:100000,rounds:10});
 const t0=sim.now;
 await sim.until(()=>{const d=serverDoc(sim,code);return d.state==='roll'&&d.order.every(p=>(d.paid||{})[p]||(d.forfeits||{})[p]);},120000,50);
 assert.ok(sim.now-t0>32000,'the stakes took longer than the old 30 s window ('+(sim.now-t0)+' ms)');
 const d=serverDoc(sim,code);
 assert.deepEqual(Object.keys(d.forfeits),[],'no present seat is skipped');
 await autoplay(sim,cls,nm=>nm==='Cina'?5:3,{max:2000000});await sim.run(30000);
 assert.deepEqual([serverDoc(sim,code).result.pot,sum(deltas(cls,before))],[1000000,0]);
});

test('round 2: every duel button answers only in its own part of the duel - a hidden one pressed by the pad, a key or a stale click does nothing (followup-3 pad-gvb-1..5)',async()=>{
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:401}),B=makeClient(sim,'Bert',{seed:402});
 /* nothing written, no transaction asked, no room made, the same seat and the same panel */
 const press=async(c,ids,where)=>{
  const mine=()=>sim.server.log.filter(e=>e.by===c.name).length,w0=mine(),t0=c.fs.txs,docs=sim.server.docs.size,code=c.g().code,pid=c.g().pid,panel=c.panel();
  c.$('gvbBetIn').value='100000';
  for(const id of ids)c.invoke(()=>c.$(id).onclick(),'stale '+id);
  await sim.run(1500);
  assert.deepEqual([mine()-w0,c.fs.txs-t0,sim.server.docs.size-docs,c.g().code,c.g().pid,c.panel()],[0,0,0,code,pid,panel],c.name+' pressed '+ids.join(', ')+' '+where);
 };
 [A,B].forEach(c=>c.open());
 await A.click('gvbCreate');await sim.run(1000);const code=A.g().code;
 B.$('gvbCode').value=code;await B.click('gvbJoin');await sim.run(1000);
 /* pad-gvb-1: Create and Join again from the lobby */
 await press(A,['gvbCreate','gvbJoin','gvbR5','gvbR10','gvbBetLock','gvbOpen','gvbClaim'],'in the lobby');
 await press(B,['gvbCreate','gvbJoin','gvbStart','gvbR5','gvbR10','gvbBetLock','gvbOpen','gvbClaim'],'in the lobby');
 await A.click('gvbReady');await B.click('gvbReady');await sim.run(1000);await A.click('gvbStart');await sim.run(1000);
 assert.equal(serverDoc(sim,code).state,'bet');
 /* pad-gvb-3 and 4: START and Ready once the lobby is gone */
 await press(A,['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbOpen','gvbClaim'],'in the bet');
 await press(B,['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbR5','gvbR10','gvbOpen','gvbClaim'],'in the bet');
 for(const c of [A,B]){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim.run(300);}
 await sim.until(()=>A.can('gvbOpen'),30000,50);
 /* pad-gvb-2: Create mid-duel; START and Ready mid-duel; Open and Claim out of turn */
 await press(A,['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbR5','gvbR10','gvbBetLock','gvbClaim'],'mid-duel, opening');
 await press(B,['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbR5','gvbR10','gvbBetLock','gvbOpen','gvbClaim'],'mid-duel, watching');
 await openRounds(sim,[A,B],10,nm=>nm==='Anna'?5:3);await sim.run(3000);
 assert.ok(A.g().settled&&B.g().settled);
 /* pad-gvb-5: Open after the verdict (the winner is its only contender left) */
 for(const c of [A,B])await press(c,['gvbOpen','gvbClaim','gvbReady','gvbStart','gvbR5','gvbBetLock','gvbCreate','gvbJoin'],'after the verdict');
 /* the room shut under Anna's verdict (Bert left last): her verdict stays up with no room behind it - Create and Join are not hers to press */
 await B.click('gvbLeave');await sim.run(2000);
 assert.deepEqual([A.panel(),A.g().ref],['gvbDone',null]);
 await press(A,['gvbCreate','gvbJoin'],'under the verdict of a shut room');
 assert.equal(Object.keys(serverDoc(sim,code).waves).length,10,'no round was dealt after the verdict');
});

/* ---------- round 3 (r2review-duel should_fix 1-3, r2fix-duel not_fixed, r2refix-shared new_findings 0) ---------- */
const refuse=(sim,who)=>{const srv=sim.server,commit=srv.commit.bind(srv);srv.commit=(cl,reads,writes)=>cl===who&&writes.length?{error:Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'})}:commit(cl,reads,writes);return ()=>{srv.commit=commit;};};
test('round 3: a seat that left asks its room a bounded number of times - none after a refusal, one log line when it gives up, nothing given back on a guess',async()=>{
 /* should_fix 1 (v3-retry-loop): the background leave asked every 2-30 s for as long as S or FB.user was set - 98 asks and 98 error.log
    lines an hour offline, 88 on a silent channel, 122 when the rules refused its writes (a refusal is final) */
 for(const mode of ['offline','silent','refused']){
  const sim=new Sim();const A=makeClient(sim,'Anna',{seed:701}),B=makeClient(sim,'Bert',{seed:702});
  const before=[A.total(),B.total()];
  await seat(sim,[A,B],{bet:100000,rounds:10});
  await openRounds(sim,[A,B],1,()=>3);
  const t0=B.fs.txs,c0=B.cloud.length;
  const heal=mode==='offline'?(B.goOffline(),()=>B.goOnline()):mode==='silent'?(B.silent=true,()=>{B.silent=false;}):refuse(sim,B);
  await B.click('gvbLeave');await B.yes();
  await sim.run(600000);
  const asks=B.fs.txs-t0;
  assert.equal(asks,mode==='refused'?1:12,'asks in the first 10 minutes ('+mode+')');
  heal();await autoplay(sim,[A],()=>3,{max:600000}); /* the link is back: Anna's claim skips the silent opener and takes the pot */
  await sim.run(3000000);
  assert.equal(B.fs.txs-t0,asks,'nothing is asked after it gave up ('+mode+')');
  assert.equal(B.cloud.length-c0,1,'one line in the log ('+mode+')');
  assert.match(B.cloud[c0],mode==='refused'?/^cloud: the duel table did not settle with a seat that left \(refused: permission-denied; 1 ask in 0 s\) - giving up$/:/^cloud: the duel table did not settle with a seat that left \((no answer|failed: unavailable); 12 asks in \d+ s\) - giving up$/);
  assert.deepEqual(deltas([A,B],before),[100000,-100000],'its stake stayed in the pot for the winner ('+mode+')');
  assert.deepEqual([A.errors,B.errors],[[],[]]);
 }
 /* the stake never reached the room and the room never answered in time: it is not given back on a guess (that could mint) */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:901}),B=makeClient(sim,'Bert',{seed:902});
  const before=[A.total(),B.total()];
  const code=await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().stake>0,20000,1);B.goOffline();
  await B.click('gvbLeave');await B.yes();
  await sim.run(700000);const tx=B.fs.txs;B.goOnline();await sim.run(120000);
  const d=serverDoc(sim,code);
  assert.equal(d.paid[d.order[1]],undefined,'the room never took it');
  assert.deepEqual([B.fs.txs-tx,B.total()-before[1],B.msgs],[0,-100000,[]],'asked no more, and nothing came back without the room\'s word');
  assert.equal(B.cloud.filter(m=>/giving up/.test(m)).length,1); }
 /* signed out with no hero: nothing is asked - the room refuses it - and that is said once */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:981}),B=makeClient(sim,'Bert',{seed:982});
  await seat(sim,[A,B],{bet:100000,rounds:10});
  const t0=B.fs.txs;B.invoke(()=>B.run('gvbLeaveForSwitch();S=null;FB.user=null;'),'sign-out');await sim.run(60000);
  assert.deepEqual([B.fs.txs-t0,B.cloud.filter(m=>/giving up/.test(m))],[0,['cloud: the duel table did not settle with a seat that left (signed out; 0 asks in 0 s) - giving up']]); }
});

test('round 3: what the room owes goes to the hero by his id - the same hero picked again from the hero list is paid, another hero never is',async()=>{
 /* should_fix 3: loadChar hands back a new object, so S===tk.hero failed for a hero entered again before the room answered, and the pot
    or the stake went to nobody (fz-acklost: 10 of 1000 duels) */
 for(const who of ['the same hero','another hero','a hero with no id']){
  const sim=new Sim();const A=makeClient(sim,'Anna',{seed:931}),B=makeClient(sim,'Bert',{seed:932});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:5});
  const sc=nm=>nm==='Bert'?5:3;
  await openRounds(sim,[A,B],4,sc);await sim.until(()=>A.can('gvbOpen'),30000,50);
  B.downMs=600;await openAs(A,sc);await sim.until(()=>!!(serverDoc(sim,code)||{}).result,10000,1);
  const old=B.S();
  B.invoke(()=>B.run('gvbLeaveForSwitch();gameOn=false;'),'hero list'); /* put away before the verdict reached the screen */
  B.run(who==='the same hero'?'S=JSON.parse(JSON.stringify(S));gameOn=true;' /* picked again: loadChar reads him back as a new object */
   :`S=${JSON.stringify(Object.assign(who==='another hero'?{id:'cnova'}:{},{name:'Nova',rating:0,gold:777000,overflow:0,prestige:20,bag:[],scraps:0}))};gameOn=true;`);
  B.downMs=80;await sim.run(40000);
  assert.notEqual(B.S(),old);
  assert.equal(old.gold+(old.overflow||0),before[1]-100000,'the object put away is never written behind the screen ('+who+')');
  if(who==='the same hero'){
   assert.deepEqual(deltas([A,B],before),[-100000,100000],'the pot reaches Bert, loaded again');
   assert.deepEqual(B.msgs,['🏆 The duel was yours - '+(200000).toLocaleString()+'◉']);
  }else assert.deepEqual([B.total(),B.msgs],[777000,[]],'nothing of Bert\'s duel reaches '+who);
  assert.deepEqual(B.errors,[]);
 }
 /* a stake the room never took, answered after the same hero was entered again */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:901}),B=makeClient(sim,'Bert',{seed:902});
  const before=[A.total(),B.total()];
  await toBet(sim,[A,B]);
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().stake>0,20000,1);B.goOffline();await sim.run(3000);
  B.invoke(()=>B.run('gvbLeaveForSwitch();gameOn=false;'),'hero list');B.run('S=JSON.parse(JSON.stringify(S));gameOn=true;');
  await sim.run(30000);B.goOnline();await sim.run(60000);
  assert.deepEqual(deltas([A,B],before),[0,0]);
  assert.deepEqual(B.msgs,['Your stake never reached the table - it came back']); }
});

test('round 3: nobody left to win - each stake the room holds goes back to the seat that paid it, once; with a winner a forfeited stake stays in the pot',async()=>{
 /* should_fix 2 (owner's decision): a verdict naming nobody kept the paid stakes (fz-acklost seed 62, the fixer's seed 930): Bert paid and
    confirmed Leave in the pay window, then Anna left before paying, and Bert's 100 000 went to no one */
 for(const how of ['Anna sits out','Anna leaves unpaid']){
  const sim=new Sim();const B=makeClient(sim,'Bert',{seed:621}),A=makeClient(sim,'Anna',{seed:622});
  const before=[B.total(),A.total()];
  const code=await toBet(sim,[B,A]); /* Bert hosts */
  A.$('gvbBetIn').value='100000';await A.click('gvbBetLock');await sim.run(400);
  if(how==='Anna sits out'){A.run('S.gold=5000;');before[1]=A.total();} /* her purse no longer holds the stake */
  A.downMs=3000;if(how==='Anna leaves unpaid')A.goOffline();
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().paidOk,20000,5);
  await B.click('gvbLeave');assert.ok(B.confirmOpen(),'a stake in play: Leave asks');await B.yes(); /* the pay window: Anna has neither paid nor left */
  await sim.run(5000);
  if(how==='Anna leaves unpaid'){await A.click('gvbLeave');if(A.confirmOpen())await A.yes();await sim.run(20000);A.goOnline();}
  await sim.run(90000);
  const d=serverDoc(sim,code);
  assert.deepEqual({...d.result},{w:null,pot:100000,f:true,n:0},how);
  assert.deepEqual(deltas([B,A],before),[0,0],'Bert\'s stake comes back to him ('+how+')');
  assert.deepEqual(B.msgs,['Nobody was left to win - your stake came back'],how);
  assert.ok(B.logs.includes('Gamble against friend: nobody was left to win - your '+(100000).toLocaleString()+' ◉ stake comes back.'),how);
  assert.deepEqual([A.errors,B.errors],[[],[]]);
 }
 /* three seats, two paid and left, the third sits out: both stakes go back; a seat that paid and left while the others go on to a
    winner stays in the pot, and its settler stops asking once every stake is in */
 for(const how of ['nobody','a winner']){
  const sim=new Sim();const [B,C,A]=['Bert','Cina','Anna'].map((nm,i)=>makeClient(sim,nm,{seed:640+i}));const cls=[B,C,A],before=cls.map(c=>c.total());
  const code=await toBet(sim,cls);
  for(const c of [A,C]){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim.run(300);}
  if(how==='nobody'){A.run('S.gold=5000;');before[2]=A.total();}
  A.downMs=4000;
  B.$('gvbBetIn').value='100000';await B.click('gvbBetLock');
  await sim.until(()=>B.g().paidOk&&C.g().paidOk,20000,5);
  if(how==='nobody')for(const c of [B,C]){await c.click('gvbLeave');await c.yes();}
  else{await B.click('gvbLeave');await B.yes();}
  const t=B.fs.txs;
  if(how==='a winner')await autoplay(sim,[A,C],nm=>nm==='Cina'?5:3,{max:900000});
  await sim.run(120000);
  const d=serverDoc(sim,code);
  if(how==='nobody'){
   assert.deepEqual({...d.result},{w:null,pot:200000,f:true,n:0});
   assert.deepEqual(deltas(cls,before),[0,0,0],'Bert and Cina each get their own stake back');
   for(const c of [B,C])assert.deepEqual(c.msgs,['Nobody was left to win - your stake came back']);
  }else{
   assert.equal(d.players[d.result.w].name,'Cina');
   assert.deepEqual(deltas(cls,before),[-100000,200000,-100000],'Bert\'s forfeited stake stays in the pot for the winner');
   assert.deepEqual(B.msgs,[]);assert.ok(B.fs.txs-t<=6,'Bert stopped asking once every stake was in ('+(B.fs.txs-t)+' asks)');
   assert.deepEqual(B.cloud.filter(m=>/giving up/.test(m)),[],'it finished, it did not give up');
  }
 }
 /* once: the same verdict brought again - by another answer, a snapshot or a Leave - pays nothing more, whichever path saw it first */
 { const sim=new Sim();const A=makeClient(sim,'Anna',{seed:661}),B=makeClient(sim,'Bert',{seed:662});
  const before=[A.total(),B.total()];
  const code=await seat(sim,[A,B],{bet:100000,rounds:10});
  await sim.until(()=>A.g().paidOk&&B.g().paidOk,20000,5);
  const doc=serverDoc(sim,code),[pa,pb]=doc.order; /* a room that names nobody while both stakes are on its record, as every screen sees it */
  assert.deepEqual(Object.keys(doc.paid).sort(),[pa,pb].sort());
  sim.server.put('rooms/GVB-'+code,Object.assign(doc,{forfeits:{[pa]:true,[pb]:true},result:{w:null,pot:200000,f:true,n:0}}));sim.server.notify('rooms/GVB-'+code);
  await sim.run(3000);
  assert.deepEqual(deltas([A,B],before),[0,0],'each live screen gives its own stake back');
  for(const c of [A,B]){
   assert.ok(c.logs.includes('Gamble against friend: nobody was left to win - your '+(100000).toLocaleString()+' ◉ stake comes back.'),c.name);
   assert.match(text(c,'gvbDoneTxt'),/^⚖ NOBODY WINS.* · every stake goes back$/);
   c.run(`gvbOwed({res:{w:null,pot:200000,f:true,n:0},forfeit:true,paid:true,np:2,open:false},gvb.pid,gvb.take);gvbBack(gvb.take);gvbSettle({w:null,pot:200000,f:true,n:0});`);
  }
  sim.server.notify('rooms/GVB-'+code);await sim.run(3000);
  for(const c of [A,B])await c.click('gvbLeave');await sim.run(3000);
  assert.deepEqual(deltas([A,B],before),[0,0],'each stake back once');
  assert.deepEqual(B.logs.filter(l=>/stake comes back/.test(l)).length,1); }
 /* the token itself: whatever answers come, and in whatever order, a stake is paid or given back once - and never to another hero */
 { const sim=new Sim();const B=makeClient(sim,'Bert',{seed:671});const b0=B.total();
  B.run(`var tk={n:100000,id:S.id,hero:S,seats:2,kept:false,back:false,done:false};spendGold(100000);
   const v={res:{w:null,pot:200000,f:true,n:0},forfeit:true,paid:true,np:2,open:false};
   gvbOwed(v,'pb',tk);gvbOwed(v,'pb',tk);gvbOwed({res:{w:'pb',pot:200000,f:false,n:10},paid:true,np:2},'pb',tk);gvbOwed({paid:false},'pb',tk);gvbBack(tk);`);
  assert.equal(B.total(),b0,'the stake came back, once');
  B.run(`var tk2={n:100000,id:S.id,hero:S,seats:2,kept:false,back:false,done:false};spendGold(100000);S={id:'cnova',name:'Nova',gold:5,overflow:0};gvbOwed({res:{w:null,pot:200000},paid:true,np:2},'pb',tk2);`);
  assert.equal(B.total(),5,'another hero is never given it'); }
});

test('round 3: the pad\'s highlight lands where the screen asks - Ready, Lock, your own Open, Leave once it costs nothing - never on a forfeit (r2refix-shared new_findings 0)',async()=>{
 /* a screen change hid the highlighted button (Create for the lobby, START for the stakes, Lock for the duel) and A did nothing until the
    d-pad moved; moved to the first control shown instead, the next A pressed Leave mid-duel and three more forfeited (r2review-shared) */
 const sim=new Sim();const A=makeClient(sim,'Anna',{seed:411}),B=makeClient(sim,'Bert',{seed:412});const before=[A.total(),B.total()];
 A.open();B.open();
 A.padOn('gvbCreate');await A.padA();await sim.run(1500);
 assert.deepEqual([A.pads,A.padAt()],[['gvbCreate'],'gvbReady'],'Create gave way to the lobby: Ready');
 B.$('gvbCode').value=A.g().code;B.padOn('gvbJoin');await B.padA();await sim.run(1500);
 assert.equal(B.padAt(),'gvbReady');
 await A.padA();await B.padA();await sim.run(1500);
 const code=A.g().code;assert.ok(serverDoc(sim,code).order.every(p=>serverDoc(sim,code).players[p].ready),'A pressed Ready');
 A.padOn('gvbStart');await A.padA();await sim.run(1500);
 assert.deepEqual([A.padAt(),B.padAt()],['gvbBetLock','gvbBetLock'],'START and Ready gave way to the stakes: Lock');
 await A.padA();await sim.run(600); /* the host mashes on: Lock with no stake chosen says so - no rounds switch, no lock cleared */
 assert.deepEqual([A.pads.slice(-1)[0],A.msgs.slice(-1)[0],serverDoc(sim,code).rounds],['gvbBetLock','Minimum stake 1,000◉',10]);
 for(const c of [A,B]){c.padOn(c.$('gvbBetLock'));c.$('gvbBetIn').value='100000';await c.padA();await sim.run(300);await c.padA();} /* Lock, and a second A on it */
 await sim.until(()=>A.can('gvbOpen'),30000,20);
 assert.deepEqual([A.padAt(),B.padAt()],['gvbOpen','gvbOpen (hidden)'],'Lock gave way to the duel: the host\'s Open, the guest\'s Open waiting for his turn');
 for(let i=0;i<4;i++){await B.padA();await sim.run(200);} /* the guest mashes A on the host's turn */
 assert.deepEqual([B.pads.filter(p=>p!=='gvbReady'&&p!=='gvbBetLock'&&p!=='gvbJoin'),B.confirmOpen(),B.padAt()],[[],undefined,'gvbOpen (hidden)'],'nothing pressed: no Leave, no confirm');
 A.forced.push(0.3,0.5,0.3,0.5,0.4242);await A.padA();await sim.run(1000);
 assert.equal(serverDoc(sim,code).waves[0]!==undefined,true,'A on the turn opened round 1');
 assert.equal(A.padAt(),'gvbOpen (hidden)','during its own reel the highlight waits on Open');
 for(let i=0;i<3;i++){await A.padA();await sim.run(300);}
 assert.deepEqual(A.pads.filter(p=>p==='gvbLeave'),[],'no Leave in the reel');
 await sim.until(()=>B.can('gvbOpen'),30000,20);
 assert.equal(B.padAt(),'gvbOpen');B.forced.push(0.3,0.5,0.3,0.5,0.4242);await B.padA();await sim.run(500);
 assert.ok(serverDoc(sim,code).waves[1],'and the guest\'s A on his turn opened round 2');
 /* the rest of the duel on the pad alone; the verdict: Leave is all that is left, and costs nothing */
 for(let i=0;i<400&&!(A.g().settled&&B.g().settled);i++){for(const c of [A,B])if(c.can('gvbOpen')){c.forced.push(0.9,0.5,0.3,0.5,0.4242);await c.padA();}await sim.run(500);} /* Anna's chest 5, Bert's 3 */
 assert.deepEqual([A.padAt(),B.padAt()],['gvbLeave','gvbLeave'],'the verdict: Leave');
 assert.deepEqual([A.pads.includes('cfYes')||B.pads.includes('cfYes'),Object.keys(serverDoc(sim,code).forfeits)],[false,[]],'no forfeit anywhere');
 assert.equal(sum(deltas([A,B],before)),0);
 /* a seat that sat out: its stake never left the purse, so Leave is safe - it goes there, and leaves at once */
 { const sim2=new Sim();const [H,G,X]=['Anna','Bert','Cina'].map((nm,i)=>makeClient(sim2,nm,{seed:421+i}));
  await toBet(sim2,[H,G,X]);
  for(const c of [H,G]){c.$('gvbBetIn').value='100000';await c.click('gvbBetLock');await sim2.run(300);}
  X.$('gvbBetIn').value='100000';X.padOn('gvbBetLock');await X.padA();X.run('S.gold=5000;');const x0=X.total();
  await sim2.run(3000);
  assert.deepEqual([X.msgs,X.padAt()],[['You no longer carry the stake - you sit this one out (nothing was taken)'],'gvbLeave']);
  await X.padA();assert.deepEqual([X.confirmOpen(),X.panel(),X.total()],[undefined,'closed',x0],'no confirm, nothing lost'); }
 /* a box on top keeps its own highlight, and a mouse player (no highlight) is given none */
 { const sim3=new Sim();const H=makeClient(sim3,'Anna',{seed:431}),G=makeClient(sim3,'Bert',{seed:432});
  await seat(sim3,[H,G],{bet:100000,rounds:10});await sim3.until(()=>H.can('gvbOpen'),30000,20);
  assert.equal(H.padAt(),null,'nobody used the pad: no highlight');
  G.padOn('gvbLeave');await G.padA();assert.ok(G.confirmOpen());await G.padA();assert.equal(G.padAt(),'cfYes');
  G.run('gvbRender();gvbShow("gvbDuel");');assert.equal(G.padAt(),'cfYes','the confirm keeps it');
  G.confirmOpen().open=false; }
 /* the host's highlight on a seat's ✕: every snapshot draws the seats anew (the old ✕ leaves the page), and the highlight stays with that
    seat - or goes to Ready once the seat is gone. It fell off, and the next A lit the first ✕ of all */
 { const lobby=section("if(d.state==='lobby'){","if(d.state==='bet'){"),bet=section("if(d.state==='bet'){","if(d.state==='roll'){");
  assert.ok(lobby.indexOf('gvbPadHome();')>lobby.indexOf("$('gvbPlayers').innerHTML="),'after the lobby\'s seats are drawn');
  assert.ok(bet.indexOf('gvbPadHome();')>bet.indexOf("$('gvbBetStat').innerHTML="),'after the stakes\' seats are drawn');
  const mk=(id,drawn,o={})=>Object.assign({id,dataset:{},getClientRects:()=>drawn?[{}]:[]},o);
  const old=mk('',false,{dataset:{gvbkick:'prival01'}}),fresh=mk('',true,{dataset:{gvbkick:'prival01'}}),ready=mk('gvbReady',true);
  const run=seatDrawn=>{let marked=null;const c=vm.createContext({GVB_PID:/^p[a-z0-9]{1,16}$/,gvb:{doc:{state:'lobby'},pid:'phost01'},padFocus:old,padMark:e=>{marked=e;},
   $:id=>({gvbFx:{style:{display:'flex'},contains:e=>e!==old,querySelector:s=>seatDrawn&&s==='[data-gvbkick="prival01"]'?fresh:null},gvbReady:ready})[id]});
   vm.runInContext(section('function gvbPadHome(){','\nfunction openGVB(')+';gvbPadHome();',c);return marked;};
  assert.equal(run(true),fresh,'the same seat\'s ✕, drawn anew');
  assert.equal(run(false),ready,'that seat is gone: Ready'); }
});

test('round 2: the duel rig runs this repo\'s game.js unless DUEL_RIG_GAME points elsewhere - never the scratch harness\'s RT_GAME (review should_fix 10)',()=>{
 const rig=fs.readFileSync(path.join(__dirname,'helpers','duel-rig.cjs'),'utf8');
 assert.match(rig,/const GAME=process\.env\.DUEL_RIG_GAME\|\|path\.join\(__dirname,'\.\.','\.\.','game\.js'\);/);
 assert.ok(!/process\.env\.RT_GAME/.test(rig),'RT_GAME is the scratch harness\'s variable');
 if(!process.env.DUEL_RIG_GAME)assert.equal(require('./helpers/duel-rig.cjs').SRC,game,'the scenarios above ran the game.js the source pins read');
});
