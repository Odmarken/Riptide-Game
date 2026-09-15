const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/ui/desktop-frames.js'),'utf8');
function harness(desktop=true){
 let serial=0,now=0;const native=new Map(),timers=new Map();
 const root={desktop:desktop?{}:undefined,performance:{now:()=>now},
  requestAnimationFrame(fn){const id=++serial;native.set(id,fn);return id;},cancelAnimationFrame:id=>native.delete(id),
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
 const original=root.requestAnimationFrame;vm.runInNewContext(source,{window:root});
 return {root,native,timers,original,
  nativeFrame(at){now=at;const batch=[...native.values()];native.clear();batch.forEach(fn=>fn(at-5));},
  advance(at){let n=0;while(true){const entry=[...timers].filter(([,v])=>v.at<=at).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;
    assert.ok(++n<1000,'No timer runaway');timers.delete(entry[0]);now=entry[1].at;entry[1].fn();}now=at;}
 };
}
test('browser build retains its native scheduling untouched',()=>{
 const h=harness(false);assert.equal(h.root.requestAnimationFrame,h.original);assert.equal(h.timers.size,0);
});
test('foreground frames batch requests once, cancel their fallback, and defer nested work',()=>{
 const h=harness(),seen=[];
 h.root.requestAnimationFrame(t=>{seen.push(['a',t]);h.root.requestAnimationFrame(t2=>seen.push(['nested',t2]));});
 h.root.requestAnimationFrame(t=>seen.push(['b',t]));
 assert.equal(h.native.size,1);assert.equal(h.timers.size,1);
 h.nativeFrame(16);assert.deepEqual(seen,[['a',16],['b',16]]);
 assert.equal(h.native.size,1);assert.equal(h.timers.size,1);
 h.nativeFrame(32);assert.deepEqual(seen,[['a',16],['b',16],['nested',32]]);
 assert.equal(h.native.size,0);assert.equal(h.timers.size,0);
});
test('hidden fallback advances at 30Hz without accumulating native callbacks or duplicating a late frame',()=>{
 const h=harness(),seen=[];const loop=t=>{seen.push(t);h.root.requestAnimationFrame(loop);};h.root.requestAnimationFrame(loop);
 const oldNative=[...h.native.values()][0];h.advance(1000);
 assert.ok(seen.length>=29&&seen.length<=30);assert.equal(h.native.size,1);assert.equal(h.timers.size,1);
 const count=seen.length;oldNative(16);assert.equal(seen.length,count,'Losing native callback is harmless');
 h.nativeFrame(1005);assert.equal(seen.length,count+1);assert.ok(seen.every((t,i)=>!i||t>seen[i-1]));
 assert.equal(seen.at(-1),1005,'Both scheduling paths use the same monotonic clock');
});
test('cancelling before or during a batch prevents the callback and removes unused timers',()=>{
 const h=harness(),seen=[];const first=h.root.requestAnimationFrame(()=>seen.push('cancelled'));
 h.root.cancelAnimationFrame(first);h.advance(100);assert.deepEqual(seen,[]);assert.equal(h.native.size,0);assert.equal(h.timers.size,0);
 let last;h.root.requestAnimationFrame(()=>{seen.push('first');h.root.cancelAnimationFrame(last);});last=h.root.requestAnimationFrame(()=>seen.push('last'));
 h.nativeFrame(120);assert.deepEqual(seen,['first']);assert.equal(h.native.size,0);assert.equal(h.timers.size,0);
});
test('one callback error cannot stop other queues and errors remain observable',()=>{
 const h=harness(),seen=[];h.root.requestAnimationFrame(()=>{throw Error('probe failure');});h.root.requestAnimationFrame(()=>seen.push('survived'));
 h.nativeFrame(16);assert.deepEqual(seen,['survived']);assert.throws(()=>h.advance(16),/probe failure/);
 h.root.requestAnimationFrame(()=>seen.push('next'));h.nativeFrame(32);assert.deepEqual(seen,['survived','next']);
 assert.throws(()=>h.root.requestAnimationFrame(null),/callback must be a function/);
});
