'use strict';
/* A table of real duel clients ("Gamble against friend") for the tests, after the verification rig of 2026-09-30.
 * - One discrete-event clock (Sim) drives every client's timers, animation frames, Date.now and performance.now.
 * - An in-memory Firestore with a cache per client: a plain write is echoed to the writer's own listeners at once
 *   (latency compensation), travels up a FIFO link, is applied by the server in arrival order, and the new state travels
 *   down to every subscriber; update() on a missing document fails with not-found. Offline, uplink messages wait and
 *   downlink states are coalesced to the latest per document.
 * - runTransaction() as the SDK has it: reads go to the server, the commit carries the versions it read and is refused
 *   when the document moved on (the update function runs again, 5 attempts at most), and nothing is queued - a client
 *   that is offline gets 'unavailable'. `silent` models a channel that neither answers nor fails.
 * - WebRTC: 'none' (never connects) or 'fast' (connects after the Firestore-signalled offer/answer).
 * - Every hero has an id ('c' + name, or o.id; o.id null for none): the duel pays a stake to its hero by that id.
 * - The pad: padFocus/padMark as game.js keeps them, nodes that know whether they are drawn (getClientRects), and cl.padA(), padTick's A
 *   for the duel window with the confirm on top of it (the confirm's first button is Yes, as in the page).
 * - Each client is its own vm context holding the REAL code cut from this repo's game.js, the copy the source pins beside it read.
 *   DUEL_RIG_GAME, a name only this rig reads, may point it at another copy for a scratch run. It used to take RT_GAME, which the
 *   scratch harness sets too: the scenarios then quietly ran another game.js than the pins in the same test file. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const GAME=process.env.DUEL_RIG_GAME||path.join(__dirname,'..','..','game.js');
const SRC=fs.readFileSync(GAME,'utf8');
function cut(a,b,src=SRC){
 const i=src.indexOf(a);if(i<0)throw new Error('cut start not found: '+a);
 const j=src.indexOf(b,i+a.length);if(j<0)throw new Error('cut end not found: '+b);
 return src.slice(i,j);
}
const tick=()=>new Promise(r=>setImmediate(r));
const J=o=>o===undefined?undefined:JSON.parse(JSON.stringify(o));
/* sfc32, seeded through a splitmix-style hash */
function sfc(seed){const h=x=>{x=Math.imul(x^x>>>16,0x85ebca6b);x=Math.imul(x^x>>>13,0xc2b2ae35);return (x^x>>>16)>>>0;};
 let a=h(seed>>>0^0x9e3779b9),b=h(a^0x7f4a7c15),c=h(b^0x94d049bb),d=1;
 const f=()=>{a|=0;b|=0;c|=0;d|=0;const t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=(c<<21|c>>>11);c=c+t|0;return (t>>>0)/4294967296;};
 for(let i=0;i<20;i++)f();return f;}
class Sim{
 constructor(){this.t0=Date.parse('2026-09-30T10:00:00Z');this.now=this.t0;this.heap=[];this.seq=0;this.fatal=[];this.clients=[];this.server=new Server(this);this.rtcMs=15;this.pcs=new Map();this.pcSeq=0;}
 at(t,fn,owner,tag){const e={t:Math.max(t,this.now),s:++this.seq,fn,owner,tag,dead:false};const h=this.heap;h.push(e);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(this.less(h[i],h[p])){[h[i],h[p]]=[h[p],h[i]];i=p;}else break;}return e;}
 less(a,b){return a.t<b.t||(a.t===b.t&&a.s<b.s);}
 pop(){const h=this.heap;const top=h[0];const last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&this.less(h[l],h[m]))m=l;if(r<h.length&&this.less(h[r],h[m]))m=r;if(m===i)break;[h[i],h[m]]=[h[m],h[i]];i=m;}}return top;}
 async run(ms){
  const end=this.now+ms;await tick();
  while(this.heap.length&&this.heap[0].t<=end){
   const e=this.pop();if(e.dead)continue;
   if(e.owner&&!e.owner.alive)continue;
   if(e.owner&&e.owner.hidden&&e.tag==='raf'){e.owner.heldFrames.push(e);continue;}
   this.now=e.t;
   try{e.fn();}catch(err){(e.owner?e.owner.errors:this.fatal).push((e.tag||'')+': '+String(err&&err.stack||err).split('\n').slice(0,2).join(' | '));}
   await tick();
  }
  this.now=Math.max(this.now,end);await tick();
 }
 async until(pred,max=600000,step=100){const end=this.now+max;while(this.now<end){if(pred())return true;await this.run(step);}return pred();}
}
/* ---------------- Firestore ---------------- */
const SENT='__fv';
const isFV=v=>v&&typeof v==='object'&&v[SENT];
function deepCopy(v){if(v===null||typeof v!=='object')return v;if(isFV(v))return {[SENT]:v[SENT],vals:v.vals.slice()};if(Array.isArray(v))return v.map(deepCopy);const o={};for(const k in v)o[k]=deepCopy(v[k]);return o;}
function materialize(v){if(v===null||typeof v!=='object')return v;if(isFV(v))return v[SENT]==='union'?[...new Set(v.vals)]:[];if(Array.isArray(v))return v.map(materialize);const o={};for(const k in v)o[k]=materialize(v[k]);return o;}
function applyMutation(doc,m){
 if(m.kind==='set')return materialize(deepCopy(m.data));
 if(doc===undefined||doc===null){const e=new Error('No document to update');e.code='not-found';throw e;}
 const d=J(doc);
 for(const p of Object.keys(m.data)){
  const segs=p.split('.');let o=d;
  for(let i=0;i<segs.length-1;i++){if(o[segs[i]]===null||typeof o[segs[i]]!=='object'||Array.isArray(o[segs[i]]))o[segs[i]]={};o=o[segs[i]];}
  const k=segs[segs.length-1],v=m.data[p];
  if(isFV(v)){const cur=Array.isArray(o[k])?o[k].slice():[];if(v[SENT]==='union'){for(const x of v.vals)if(!cur.includes(x))cur.push(x);o[k]=cur;}else o[k]=cur.filter(x=>!v.vals.includes(x));}
  else o[k]=materialize(deepCopy(v));
 }
 return d;
}
class Server{
 constructor(sim){this.sim=sim;this.docs=new Map();this.vers=new Map();this.subs=new Map();this.cols=new Map();this.colSubs=new Map();this.log=[];this.nid=0;}
 ver(p){return this.vers.get(p)||0;}
 put(p,d){this.docs.set(p,d);this.vers.set(p,this.ver(p)+1);}
 write(client,p,m){
  let err=null;
  try{this.put(p,applyMutation(this.docs.get(p),m));}catch(e){err=e;}
  this.log.push({t:this.sim.now-this.sim.t0,by:client.name,path:p,kind:m.kind,keys:Object.keys(m.data).join(','),err:err&&err.code});
  if(!err)this.notify(p);
  client.down(()=>client.fs.ack(p,m,err),'ack');
 }
 /* a transaction's commit: every document it read must be as it was read, or nothing is written */
 commit(client,reads,writes){
  for(const [p,v] of reads)if(this.ver(p)!==v)return {conflict:true};
  const next=new Map();
  try{for(const w of writes)next.set(w.path,applyMutation(next.has(w.path)?next.get(w.path):this.docs.get(w.path),w));}catch(e){return {error:e};}
  for(const [p,d] of next)this.put(p,d);
  for(const w of writes)this.log.push({t:this.sim.now-this.sim.t0,by:client.name,path:w.path,kind:'tx-'+w.kind,keys:Object.keys(w.data).join(',')});
  for(const p of next.keys())this.notify(p);
  return {ok:true};
 }
 notify(p){const st=J(this.docs.get(p));for(const c of this.subs.get(p)||[])c.down(()=>c.fs.state(p,J(st)),'state',p);}
 subscribe(client,p){if(!this.subs.has(p))this.subs.set(p,new Set());this.subs.get(p).add(client);const st=J(this.docs.get(p));client.down(()=>client.fs.state(p,st===undefined?null:st),'state',p);}
 unsubscribe(client,p){const s=this.subs.get(p);if(s)s.delete(client);}
 get(client,p,cb){const st=J(this.docs.get(p));client.down(()=>cb(st===undefined?null:st),'get');}
 add(client,col,data){const d=J(data);d.__id='s'+(++this.nid);if(!this.cols.has(col))this.cols.set(col,[]);this.cols.get(col).push(d);for(const c of this.colSubs.get(col)||[])c.down(()=>c.fs.colAdded(col,[J(d)]),'sig');}
 colSubscribe(client,col){if(!this.colSubs.has(col))this.colSubs.set(col,new Set());this.colSubs.get(col).add(client);const all=J(this.cols.get(col)||[]);client.down(()=>client.fs.colAdded(col,all),'sig');}
 colUnsubscribe(client,col){const s=this.colSubs.get(col);if(s)s.delete(client);}
}
class ClientFS{
 constructor(client){this.c=client;this.cache=new Map();this.colL=new Map();this.txs=0;}
 entry(p){if(!this.cache.has(p))this.cache.set(p,{base:undefined,pending:[],ls:[]});return this.cache.get(p);}
 view(p){const e=this.entry(p);let d=e.base;for(const m of e.pending){try{d=applyMutation(d,m);}catch(err){}}return d;}
 fire(p){
  const e=this.entry(p);const d=this.view(p);if(d===undefined)return;
  const key=JSON.stringify(d);
  for(const l of e.ls.slice()){if(!l.live||l.key===key)continue;l.key=key;const snap={exists:d!==null,id:p.split('/').pop(),data:()=>d===null?undefined:J(d)};this.c.invoke(()=>l.cb(snap),'onSnapshot');}
 }
 write(p,kind,data){
  return new Promise((res,rej)=>{
   const m={kind,data:deepCopy(data),res,rej};
   this.entry(p).pending.push(m);
   this.c.sim.at(this.c.sim.now,()=>this.fire(p),this.c,'echo');
   this.c.up(()=>this.c.sim.server.write(this.c,p,m),'write');
  });
 }
 ack(p,m,err){const e=this.entry(p);e.pending=e.pending.filter(x=>x!==m);this.fire(p);if(err)m.rej(err);else m.res();}
 state(p,st){this.entry(p).base=st;this.fire(p);}
 listen(p,cb){
  const e=this.entry(p);const l={cb,key:null,live:true};e.ls.push(l);
  this.c.sim.at(this.c.sim.now,()=>this.fire(p),this.c,'first');
  this.c.up(()=>this.c.sim.server.subscribe(this.c,p),'sub');
  return ()=>{l.live=false;e.ls=e.ls.filter(x=>x!==l);if(!e.ls.length)this.c.up(()=>this.c.sim.server.unsubscribe(this.c,p),'unsub');};
 }
 get(p){return new Promise(res=>{this.c.up(()=>this.c.sim.server.get(this.c,p,st=>{const e=this.entry(p);e.base=st;res({exists:st!==null,data:()=>st===null?undefined:J(st)});}),'get');});}
 colAdd(col,data){return new Promise(res=>{this.c.up(()=>{this.c.sim.server.add(this.c,col,data);this.c.down(()=>res({id:'x'}),'addack');},'add');});}
 colListen(col,cb){
  if(!this.colL.has(col))this.colL.set(col,[]);const l={cb,live:true};this.colL.get(col).push(l);
  this.c.up(()=>this.c.sim.server.colSubscribe(this.c,col),'colsub');
  return ()=>{l.live=false;this.c.up(()=>this.c.sim.server.colUnsubscribe(this.c,col),'colunsub');};
 }
 colAdded(col,docs){for(const l of (this.colL.get(col)||[]).slice()){if(!l.live)continue;this.c.invoke(()=>l.cb({docChanges:()=>docs.map(d=>({type:'added',doc:{id:d.__id,data:()=>J(d)}}))}),'signals');}}
 /* runTransaction: reads by the server, a commit that carries what it read, retries on a conflict or a dropped link */
 runTransaction(fn){
  const c=this.c,sim=c.sim,srv=sim.server;this.txs++;
  return new Promise((resolve,reject)=>{
   let attempt=0,done=false;
   const fail=code=>{if(done)return;done=true;const e=new Error('transaction failed: '+code);e.code=code;reject(e);};
   const again=code=>{if(done)return;if(attempt>=5)fail(code);else sim.at(sim.now+250*Math.pow(2,attempt),run,c,'txretry');};
   const run=()=>{
    if(done)return;
    attempt++;
    const reads=new Map(),writes=[];let lost=false;
    const tx={
     get:ref=>new Promise((res,rej)=>{
      c.txUp(()=>{const st=J(srv.docs.get(ref.path)),v=srv.ver(ref.path);
       c.txDown(()=>{reads.set(ref.path,v);res({exists:st!==undefined&&st!==null,id:ref.id,data:()=>st===undefined||st===null?undefined:J(st)});},()=>{lost=true;rej(Object.assign(new Error('unavailable'),{code:'unavailable'}));});
      },()=>{lost=true;rej(Object.assign(new Error('unavailable'),{code:'unavailable'}));});
     }),
     update:(ref,data)=>{writes.push({path:ref.path,kind:'update',data:deepCopy(data)});return tx;},
     set:(ref,data)=>{writes.push({path:ref.path,kind:'set',data:deepCopy(data)});return tx;},
    };
    Promise.resolve().then(()=>fn(tx)).then(value=>{
     if(done)return;
     c.txUp(()=>{
      const r=srv.commit(c,[...reads],writes);
      c.txDown(()=>{
       if(done)return;
       if(r.conflict){again('aborted');return;}
       if(r.error){done=true;reject(r.error);return;}
       done=true;resolve(value);
      },()=>again('unavailable')); /* the answer was lost: the SDK runs it again (the functions read their own write then) */
     },()=>again('unavailable'));
    },err=>{if(lost||(err&&err.code==='unavailable'))again('unavailable');else if(!done){done=true;reject(err);}});
   };
   run();
  });
 }
 db(){
  const self=this;
  const doc=p=>({path:p,id:p.split('/').pop(),
   set:d=>self.write(p,'set',d),update:d=>self.write(p,'update',d),get:()=>self.get(p),
   onSnapshot:(cb)=>self.listen(p,cb),
   collection:sub=>({add:d=>self.colAdd(p+'/'+sub,d),onSnapshot:cb=>self.colListen(p+'/'+sub,cb)})});
  return {collection:n=>({doc:id=>doc(n+'/'+id)}),runTransaction:fn=>self.runTransaction(fn)};
 }
}
/* ---------------- WebRTC ---------------- */
function makePC(sim,client){
 return class PC{
  constructor(){this.id=++sim.pcSeq;sim.pcs.set(this.id,this);this.client=client;this.closed=false;this.ch=null;this.remote=null;}
  createDataChannel(){this.ch=mkChan(sim,this);return this.ch;}
  async createOffer(){return {type:'offer',sdp:String(this.id)};}
  async createAnswer(){return {type:'answer',sdp:String(this.id)};}
  async setLocalDescription(){}
  async setRemoteDescription(d){this.remote=sim.pcs.get(+d.sdp);if(d.type==='answer'&&this.remote&&client.rtc==='fast'&&this.remote.client.rtc==='fast')rtcConnect(sim,this,this.remote);}
  async addIceCandidate(){}
  close(){this.closed=true;if(this.ch)this.ch.readyState='closed';}
 };
}
function mkChan(sim,pc){
 return {pc,readyState:'connecting',onopen:null,onmessage:null,peer:null,
  send(s){if(this.readyState!=='open')throw new Error('not open');const peer=this.peer;
   if(!pc.client.online&&!pc.client.lanRtc)return; /* a dropped network takes the data channel with it (unless a LAN link is modelled) */
   sim.at(sim.now+sim.rtcMs,()=>{if(!peer.pc.client.online&&!peer.pc.client.lanRtc)return;if(peer.readyState==='open'&&!peer.pc.closed&&peer.onmessage)peer.pc.client.invoke(()=>peer.onmessage({data:s}),'rtcmsg');},peer.pc.client,'rtc');},
  close(){this.readyState='closed';}};
}
function rtcConnect(sim,offerPC,answerPC){
 const a=offerPC.ch;if(!a)return;const b=mkChan(sim,answerPC);answerPC.ch=b;a.peer=b;b.peer=a;
 sim.at(sim.now+sim.rtcMs,()=>{
  if(offerPC.closed||answerPC.closed)return;
  a.readyState='open';b.readyState='open';
  if(answerPC.ondatachannel)answerPC.client.invoke(()=>answerPC.ondatachannel({channel:b}),'ondatachannel');
  if(a.onopen)offerPC.client.invoke(()=>a.onopen(),'onopen');
  if(b.onopen)answerPC.client.invoke(()=>b.onopen(),'onopen');
 },null,'rtcconnect');
}
/* ---------------- a client ---------------- */
const PANEL_OF={gvbCreate:'gvbEntry',gvbJoin:'gvbEntry',gvbReady:'gvbLobby',gvbStart:'gvbLobby',gvbBetLock:'gvbBet',gvbR5:'gvbBet',gvbR10:'gvbBet',gvbOpen:'gvbDuel',gvbClaim:'gvbDuel',gvbLeave:null};
function makeClient(sim,name,o={}){
 const cl={sim,name,alive:true,hidden:false,heldFrames:[],online:true,silent:false,upMs:o.up??80,downMs:o.down??80,rtc:o.rtc||'none',
  upQ:[],downQ:[],downCo:new Map(),lastUp:0,lastDown:0,errors:[],cloud:[],msgs:[],logs:[],saves:0,parked:0,confirms:[],forced:[]};
 const R=sfc(o.seed||[...name].reduce((a,ch)=>a*31+ch.charCodeAt(0),7));
 cl.up=(fn,tag)=>{if(cl.silent)return;if(!cl.online){cl.upQ.push([fn,tag]);return;}const t=Math.max(cl.lastUp,sim.now+cl.upMs);cl.lastUp=t;sim.at(t,()=>{if(!cl.online){cl.upQ.push([fn,tag]);return;}fn();},cl,'up:'+tag);};
 const hold=(fn,tag,coKey)=>{if(coKey){cl.downCo.delete(coKey);cl.downCo.set(coKey,[fn,tag]);}else cl.downQ.push([fn,tag]);};
 cl.down=(fn,tag,coKey)=>{if(!cl.online){hold(fn,tag,coKey);return;}const t=Math.max(cl.lastDown,sim.now+cl.downMs);cl.lastDown=t;sim.at(t,()=>{if(!cl.online){hold(fn,tag,coKey);return;}fn();},cl,'down:'+tag);};
 /* a transaction's messages are never queued: a link that is down fails them (a silent one swallows them) */
 cl.txUp=(fn,onFail)=>{if(cl.silent)return;if(!cl.online){sim.at(sim.now+cl.upMs,onFail,cl,'txfail');return;}const t=Math.max(cl.lastUp,sim.now+cl.upMs);cl.lastUp=t;sim.at(t,()=>{if(!cl.online){onFail();return;}fn();},cl,'txup');};
 cl.txDown=(fn,onFail)=>{if(cl.silent)return;const t=Math.max(cl.lastDown,sim.now+cl.downMs);cl.lastDown=t;sim.at(t,()=>{if(!cl.online){onFail();return;}fn();},cl,'txdown');};
 cl.goOffline=()=>{cl.online=false;};
 cl.goOnline=()=>{cl.online=true;const u=cl.upQ.splice(0),co=[...cl.downCo.values()],dq=cl.downQ.splice(0);cl.downCo.clear();co.forEach(([f,t])=>cl.down(f,t));dq.forEach(([f,t])=>cl.down(f,t));u.forEach(([f,t])=>cl.up(f,t));};
 cl.invoke=(fn,tag)=>{if(!cl.alive)return;try{const r=fn();if(r&&typeof r.then==='function')r.then(null,e=>cl.errors.push(tag+' (async): '+String(e&&e.message||e)));}catch(e){cl.errors.push(tag+': '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '));}};
 cl.fs=new ClientFS(cl);
 const nodes=new Map();
 /* every node is the duel window's (duel), in a panel (PANEL_OF); getClientRects() is empty when it is not drawn, as in the page */
 const el=(id='',panel=PANEL_OF[id])=>{const cls=new Set();const e={id,duel:true,panel,style:{},dataset:{},textContent:'',innerHTML:'',value:'',disabled:false,clientWidth:300,onclick:null,
  classList:{add:(...n)=>n.forEach(x=>cls.add(x)),remove:(...n)=>n.forEach(x=>cls.delete(x)),contains:n=>cls.has(n),toggle:(n,f)=>{const on=f===undefined?!cls.has(n):!!f;on?cls.add(n):cls.delete(n);return on;}},
  getClientRects(){return cl.drawn(e)?[{}]:[];},contains:x=>id==='gvbFx'&&!!x&&x.duel===true,
  setAttribute(){},getAttribute(){return null;},remove(){},appendChild(){},querySelector:()=>null,querySelectorAll:()=>[]};return e;};
 const $=id=>{if(!nodes.has(id))nodes.set(id,el(id));return nodes.get(id);};
 $('gvbR5').dataset.gvbr='5';$('gvbR10').dataset.gvbr='10';
 const betBtns=['500000','1000000','2000000'].map(v=>{const b=el('bet'+v,'gvbBet');b.dataset.gvbbet=v;return b;});
 const PANELS=['gvbEntry','gvbLobby','gvbBet','gvbDuel','gvbDone'];
 cl.drawn=e=>{
  if(!e)return false;
  if(!e.duel)return e.getClientRects().length>0;
  const fx=$('gvbFx');if(fx.style.display!=='flex')return false;
  if(e===fx)return true;
  if(e.style.display==='none'||(['gvbStart','gvbOpen','gvbClaim'].includes(e.id)&&e.style.display!=='inline-block'))return false; /* display:none in the markup until shown */
  if(PANELS.includes(e.id))return e.style.display==='block';
  return !e.panel||$(e.panel).style.display==='block';
 };
 /* the pad (padTick's A, the duel's part of it): the box on top answers first - A highlights its first button (Yes), the next A presses
    it; on the table a highlight from elsewhere is dropped and A highlights the first control drawn, a drawn one is pressed, a hidden one
    is left alone. cl.pads records what A pressed */
 const cfYes={id:'cfYes',duel:false,dataset:{},getClientRects:()=>cl.confirmOpen()?[{}]:[]};
 cl.pads=[];
 cl.padItems=()=>['gvbCreate','gvbJoin','gvbReady','gvbStart','gvbR5','gvbR10'].map($).concat(betBtns,['gvbBetLock','gvbOpen','gvbClaim','gvbLeave'].map($)).filter(e=>cl.drawn(e)&&!e.disabled);
 cl.padOn=id=>{ctx.padMark(id===null?null:typeof id==='string'?$(id):id);};
 cl.padAt=()=>{const f=ctx.padFocus;return f?f.id+(f.getClientRects().length?'':' (hidden)'):null;};
 cl.padA=async()=>{
  const box=cl.confirmOpen();
  if(box){if(ctx.padFocus!==cfYes)ctx.padMark(cfYes);else{cl.pads.push('cfYes');box.open=false;cl.invoke(()=>box.onYes(),'pad Yes');}await tick();return;}
  if($('gvbFx').style.display!=='flex'){ctx.padMark(null);await tick();return;}
  if(ctx.padFocus&&!$('gvbFx').contains(ctx.padFocus))ctx.padMark(null);
  const f=ctx.padFocus;
  if(!f){const first=cl.padItems()[0];if(first)ctx.padMark(first);}
  else if(f.getClientRects().length&&!f.disabled){cl.pads.push(f.id||f.dataset.gvbbet);cl.invoke(()=>f.onclick(),'pad A '+f.id);}
  await tick();
 };
 const RD=Date;class FD extends RD{constructor(...a){a.length?super(...a):super(sim.now);}static now(){return sim.now;}}
 let tid=0;const tm=new Map();
 const ctx={
  console:{log(){},warn:(...a)=>cl.errors.push('warn: '+a.map(x=>x&&x.message||x).join(' ')),
   error:(...a)=>{const m=a.map(x=>x&&x.message||x).join(' ');(/^cloud: /.test(m)?cl.cloud:cl.errors).push(m);}},
  Math:Object.assign(Object.create(Math),{random:()=>cl.forced.length?cl.forced.shift():R()}),
  Date:FD,performance:{now:()=>sim.now-sim.t0},
  setTimeout:(fn,d)=>{const id=++tid;tm.set(id,sim.at(sim.now+(d||0),()=>{tm.delete(id);cl.invoke(fn,'timeout');},cl,'timer'));return id;},
  clearTimeout:id=>{const e=tm.get(id);if(e)e.dead=true;tm.delete(id);},
  setInterval:(fn,d)=>{const id=++tid;const go=()=>{if(!tm.has(id))return;cl.invoke(fn,'interval');tm.set(id,sim.at(sim.now+d,go,cl,'timer'));};tm.set(id,sim.at(sim.now+d,go,cl,'timer'));return id;},
  clearInterval:id=>{const e=tm.get(id);if(e)e.dead=true;tm.delete(id);},
  requestAnimationFrame:fn=>{sim.at(sim.now+(o.frameMs||16),()=>cl.invoke(()=>fn(sim.now-sim.t0),'raf'),cl,'raf');return 1;},
  cancelAnimationFrame(){},
  $,document:{createElement:()=>el(),body:{appendChild(){}},querySelector:()=>null,querySelectorAll:s=>s==='[data-gvbr]'?[$('gvbR5'),$('gvbR10')]:s==='[data-gvbbet]'?betBtns:[]},
  save:()=>{cl.saves++;},renderHUD(){},renderShop(){},renderBag(){},renderHero(){},
  gameOn:true,parkDirtyHero:()=>{cl.parked++;}, /* the hero list: out of play (gameOn false), a save parked with its hero */
  padFocus:null,padMark:e=>{ctx.padFocus=e||null;}, /* the pad's highlight, as game.js keeps it */
  stageMsg:m=>cl.msgs.push(String(m)),log:m=>cl.logs.push(String(m).replace(/<[^>]*>/g,'')),
  blip(){},dingDingDing(){},spawnPartsIn(){},casinoAmbApply(){},initAudio(){},
  sfx:new Proxy({},{get:()=>()=>{}}),
  confirmBox:(msg,onYes)=>{cl.confirms.forEach(x=>x.open=false);cl.confirms.push({msg,onYes,open:true});},
  isLegendary:it=>!!it&&it.rar==='legendary',inGearSet:()=>false,scrapVal:()=>1,
  window:{innerWidth:1600},
 };
 ctx.firebase={firestore:Object.assign(()=>cl.db,{FieldValue:{arrayUnion:(...v)=>({[SENT]:'union',vals:v}),arrayRemove:(...v)=>({[SENT]:'remove',vals:v})}})};
 ctx.window.firebase=ctx.firebase;
 cl.db=cl.fs.db();
 ctx.FB={ready:true,db:cl.db,rest:false,sdkPending:0,user:{uid:'u'+name}}; /* signed in; a test signs out with FB.user=null */
 ctx.RTCPeerConnection=makePC(sim,cl);
 vm.createContext(ctx);
 cl.ctx=ctx;cl.$=$;
 cl.run=code=>vm.runInContext(code,ctx);
 /* a hero has an id, as every saved hero has: the duel pays a stake to the hero it belongs to by that id (o.id null: an id-less hero) */
 cl.run(`var S=${JSON.stringify(Object.assign(o.id===null?{}:{id:o.id||'c'+name.toLowerCase()},{name,rating:0,gold:o.gold??1000000,overflow:o.overflow??0,prestige:o.prestige??20,bag:[],scraps:0}))};`);
 const src=o.src||SRC;
 cl.run(cut('const GOLD_CAP_BASE=','/* ==================== THOR WINDOWS'));
 cl.run(cut('const fmtMS=ms=>{','\n/* effective wealth'));
 cl.run(cut('const bagSellable=','/* ==================== BANK'));
 cl.run(cut('function spendGold(n){','/* zero loot'));
 cl.run(cut('const mpDB=()=>','\nconst mpRoom='));
 cl.run(cut('const MPCODE=()=>','\nfunction raidAutoOff'));
 cl.run(cut('async function mpEnsureFirebase(){','\nfunction mpLook'));
 cl.run(cut('const CLOUD_WAIT_MS=','/* ☁ Two roads'));
 cl.run(cut('async function tryLive(){','\n/* One cloud call'));
 cl.run(cut('const RTC_CFG={','\nfunction rtcSignal'));
 cl.run(cut('const dispName=ch=>','\n'));
 cl.run(cut('function mulberry32(a){','\n'));
 cl.run(cut('const esc=t=>','\n'));
 cl.run(cut('/* ==================== 🎲 GAMBLE AGAINST FRIEND','/* ==================== ❄ ICE ARMOR TALENT TREE',src));
 cl.run(cut("setInterval(()=>{if(gvb.doc&&gvb.doc.state==='roll'",'\n',src));
 cl.g=()=>cl.run('gvb');
 cl.S=()=>cl.run('S');
 cl.total=()=>{const s=cl.S();return s?s.gold+(s.overflow||0):NaN;};
 cl.panel=()=>{if($('gvbFx').style.display!=='flex')return 'closed';return ['gvbEntry','gvbLobby','gvbBet','gvbDuel','gvbDone'].filter(id=>$(id).style.display==='block').join('+')||'?';};
 cl.confirmOpen=()=>cl.confirms.find(x=>x.open);
 /* can a real player press it: overlay up, no confirm on top, its panel shown, the button shown and enabled */
 cl.can=id=>{if($('gvbFx').style.display!=='flex')return false;if(cl.confirmOpen())return false;const p=PANEL_OF[id];if(p&&$(p).style.display!=='block')return false;const b=$(id);if(b.disabled)return false;if(['gvbStart','gvbOpen','gvbClaim'].includes(id)&&b.style.display!=='inline-block')return false;return true;};
 cl.click=async id=>{if(!cl.can(id))throw new Error(`${name} cannot press ${id} (panel ${cl.panel()}, display ${$(id).style.display}, disabled ${$(id).disabled}, confirm ${!!cl.confirmOpen()})`);cl.invoke(()=>$(id).onclick(),'click '+id);await tick();};
 cl.yes=async()=>{const x=cl.confirmOpen();if(!x)throw new Error(name+': no confirm open');x.open=false;cl.invoke(()=>x.onYes(),'yes');await tick();};
 cl.open=()=>cl.invoke(()=>cl.run('openGVB()'),'openGVB');
 cl.hide=()=>{cl.hidden=true;};
 cl.show=()=>{cl.hidden=false;const f=cl.heldFrames.splice(0);for(const e of f)sim.at(sim.now,e.fn,cl,'raf');};
 cl.kill=()=>{cl.alive=false;};
 sim.clients.push(cl);
 return cl;
}
/* forced chest values for the next Open by this client: one entry per contender in seat order, then the seed roll */
const ROLLS={20:[0.001],12:[0.004],10:[0.01],7:[0.03],3:[0.3,0.5],5:[0.9,0.5]};
function force(cl,scores){for(const s of scores)cl.forced.push(...ROLLS[s]);cl.forced.push(0.4242);}
/* from the entry screen to the roll: the first creates, the others join, all ready, the host starts, all lock `bet` */
async function seat(sim,cls,{bet=100000,rounds=10,before}={}){
 const [h,...g]=cls;
 cls.forEach(c=>c.open());
 await h.click('gvbCreate');await sim.run(1000);await sim.until(()=>h.panel()==='gvbLobby',8000,20);
 const code=h.g().code;
 for(const c of g){c.$('gvbCode').value=code;await c.click('gvbJoin');await sim.run(800);await sim.until(()=>c.panel()==='gvbLobby',8000,20);}
 for(const c of cls)await c.click('gvbReady');
 await sim.run(1000);await sim.until(()=>h.can('gvbStart'),8000,20);
 await h.click('gvbStart');await sim.run(1000);await sim.until(()=>cls.every(c=>c.panel()==='gvbBet'),8000,20);
 if(rounds!==10){await h.click(rounds===5?'gvbR5':'gvbR10');await sim.run(600);await sim.until(()=>cls.every(c=>c.g().doc&&c.g().doc.rounds===rounds),8000,20);}
 if(before)await before();
 for(const c of cls){if(!c.alive)continue;c.$('gvbBetIn').value=String(bet);await c.click('gvbBetLock');await sim.run(300);}
 await sim.run(1500);
 return code;
}
/* press Open as client c with the chests chosen per player name (scoreOf(name) -> 20/12/10/7/5/3), for the contenders the room has */
async function openAs(c,scoreOf){
 const names=c.run('gvbContenders(gvb.doc,gvbWaves()).map(p=>(gvb.doc.players[p]||{}).name||p)');
 for(const nm of names)c.forced.push(...(ROLLS[scoreOf(nm)]||ROLLS[3]));
 c.forced.push(0.4242);
 await c.click('gvbOpen');
 return names;
}
/* honest bots: open when it is your turn (after `think` ms) and claim when the table offers it; until every live seat settled */
async function autoplay(sim,cls,scoreOf,{think=400,max=900000,claim=true}={}){
 const end=sim.now+max;
 while(sim.now<end){
  const live=cls.filter(c=>c.alive&&c.g().ref);
  if(!live.length||live.every(c=>c.g().settled))return true;
  for(const c of live){
   if(c.can('gvbOpen')){await sim.run(think);if(c.can('gvbOpen'))await openAs(c,scoreOf);}
   else if(claim&&c.can('gvbClaim')){await c.click('gvbClaim');c.claims=(c.claims||0)+1;}
  }
  await sim.run(250);
 }
 return false;
}
const serverDoc=(sim,code)=>J(sim.server.docs.get('rooms/GVB-'+code));
const text=(c,id)=>String(c.$(id).innerHTML||c.$(id).textContent||'').replace(/<[^>]*>/g,'');
const listeners=c=>[...c.fs.cache.values()].reduce((t,e)=>t+e.ls.length,0);
module.exports={SRC,cut,Sim,makeClient,force,seat,openAs,autoplay,serverDoc,text,listeners,sfc,tick,J,ROLLS};
