const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/wasteland/music.js');

function harness(){
 const nodes=[],timers=new Map();let clock=0,paused=false,next=1;
 const param=()=>({value:0,setValueAtTime(value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;},linearRampToValueAtTime(value,time){this.setValueAtTime(value,time);},exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.setValueAtTime(value,time);},cancelScheduledValues(){}});
 function node(kind){
  const n={kind,connections:[],frequency:param(),detune:param(),gain:param(),Q:param(),pan:param(),delayTime:param(),
   connect(target){this.connections.push(target);return target;},disconnect(){this.disconnected=true;this.connections=[];},
   start(time){this.started=time;},stop(time=clock){this.ends=time;}};
  nodes.push(n);return n;
 }
 const ctx={state:'running',sampleRate:8000,get currentTime(){return clock;},
  createGain:()=>node('gain'),createDelay:()=>node('delay'),createBiquadFilter:()=>node('filter'),createStereoPanner:()=>node('pan'),
  createOscillator:()=>node('osc'),createBufferSource:()=>node('noise'),createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}};
 const destination={gain:param()},options={ctx,destination,isPaused:()=>paused,setInterval(fn){const id=next++;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);}};
 function advance(time){clock=time;for(const n of nodes)if(n.ends<=clock&&!n.ended){n.ended=true;if(n.onended)n.onended();}for(const fn of [...timers.values()])fn();}
 return {ctx,options,destination,nodes,timers,advance,setPaused(value){paused=value;},sources:()=>nodes.filter(n=>n.kind==='osc'||n.kind==='noise')};
}

test('three original scores have distinct harmony, instrumentation and complete sixteen-bar phrases',()=>{
 assert.deepEqual(M.themes.map(x=>x.key),['briarhollow','cindervein','frostveil']);
 const signatures=[];
 for(const theme of M.themes){
  const s=M.score(theme.key);assert.equal(s.bars,16);assert.equal(s.duration,64*60/s.bpm);assert.ok(s.duration>=45&&s.duration<=65);
  assert.ok(s.events.length>=55);assert.ok(Object.isFrozen(s.events));assert.equal(s.events[0].at,0);
  for(let i=0;i<s.events.length;i++){
   const e=s.events[i];assert.ok(e.at>=0&&e.at<s.duration);assert.ok(e.dur>0&&e.dur<10);assert.ok(e.velocity>0&&e.velocity<=1);assert.ok(Math.abs(e.pan)<=1);
   assert.ok(e.notes.every(n=>Number.isFinite(n)&&n>=35&&n<=89));if(i)assert.ok(e.at>=s.events[i-1].at);
  }
  signatures.push(JSON.stringify(s.events));
 }
 assert.equal(new Set(signatures).size,3);
 assert.ok(M.score('briarhollow').events.some(e=>e.kind==='flute'));assert.ok(M.score('cindervein').events.some(e=>e.kind==='hammer'));assert.ok(M.score('frostveil').events.some(e=>e.kind==='bell'));
 assert.equal(M.has('crypt'),false);assert.equal(M.has('toString'),false);assert.equal(M.score('world'),null);
});

for(const key of M.themes.map(x=>x.key))test(key+': playback uses only the provided ambient bus and stop disposes notes, echo and timer',()=>{
 const h=harness(),song=M.start(key,h.options);assert.ok(song.running);assert.equal(h.timers.size,1);assert.ok(song.voiceCount>0);
 const external=h.nodes.flatMap(n=>n.connections).filter(n=>!h.nodes.includes(n));assert.deepEqual(external,[h.destination]);
 assert.equal(h.destination.gain.value,0,'the caller owns mute/volume');
 for(let t=.08;t<70;t+=.08){h.advance(t);assert.ok(song.voiceCount<150,'live sources must expire');}
 song.stop();song.stop();assert.equal(h.timers.size,0);assert.equal(song.running,false);assert.equal(song.voiceCount,0);
 assert.ok(h.nodes.every(n=>n.disconnected));assert.ok(h.sources().every(n=>Number.isFinite(n.ends)));
 const count=h.nodes.length;h.advance(100);song.update();assert.equal(h.nodes.length,count);
});

test('running-clock game pause silences scheduled notes and resumes without replaying elapsed time',()=>{
 const h=harness(),song=M.start('briarhollow',h.options);h.advance(1);h.setPaused(true);song.update();assert.equal(song.voiceCount,0);
 const before=h.sources().length;h.advance(7201);assert.equal(h.sources().length,before);h.setPaused(false);song.update();
 assert.ok(h.sources().length-before<30);h.advance(7202);assert.ok(song.running);song.stop();
});

test('suspended AudioContext preserves its scheduled voices and resumes on the same audio clock',()=>{
 const h=harness(),song=M.start('frostveil',h.options),before=h.sources().length,voices=song.voiceCount;
 h.ctx.state='suspended';h.setPaused(true);for(let i=0;i<20;i++)song.update();assert.equal(h.sources().length,before);assert.equal(song.voiceCount,voices);
 h.ctx.state='running';h.setPaused(false);song.update();assert.equal(h.sources().length,before);song.stop();
});

test('two-hour background throttling skips stale score events instead of emitting a catch-up burst',()=>{
 const h=harness(),song=M.start('cindervein',h.options),before=h.sources().length;h.advance(7200);
 assert.ok(h.sources().length-before<40);for(const n of h.sources().slice(before))assert.ok(n.started>=7200);
 h.ctx.state='closed';song.update();assert.equal(song.running,false);assert.equal(h.timers.size,0);
});

test('a rapid dungeon switch stops all old notes before the replacement theme starts',()=>{
 const h=harness(),old=M.start('briarhollow',h.options);h.advance(.08);const first=h.sources().slice();old.stop();
 const next=M.start('frostveil',h.options);assert.equal(h.timers.size,1);assert.ok(first.every(n=>n.disconnected&&n.ends<=h.ctx.currentTime));assert.ok(next.voiceCount>0);next.stop();
 assert.equal(M.start('crypt',h.options),null);assert.equal(M.start('briarhollow',{}),null);assert.equal(h.timers.size,0);
});

test('actual game ambience routing selects unique scores, reuses one instance and stops it on ordinary-zone return',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const h=harness(),AC={ctx:h.ctx,ambG:h.destination,amb:[],timers:[],prof:null};let normal=0,crypt=0;
 const scope={AC,gameOn:true,gamePaused:false,audioPaused:false,
  WastelandMusic:{has:M.has,start:(key,options)=>M.start(key,{...options,setInterval:h.options.setInterval,clearInterval:h.options.clearInterval})},
  clearInterval:h.options.clearInterval,stopCowTrack(){},stopOdinTrack(){},stopCryptTrack(){},stopFinalTrack(){},stopAmbTrack(){},
  startAmbTrack(){normal++;},startCryptTrack(){crypt++;return true;}};
 const api=vm.runInNewContext(section('function stopAmbience(){','function windLayer(')+'\n'+section('function startAmbience(prof){','/* Combat / one-shot sounds')+'\n({startAmbience,stopAmbience})',scope);
 let previous;
 for(const key of ['briarhollow','cindervein','frostveil']){
  const definition=source.split('\n').find(line=>line.includes("dungeon:'"+key+"'"));assert.ok(definition&&definition.includes("amb:'"+key+"'"));
  api.startAmbience(key);assert.equal(AC.prof,key);assert.equal(AC.amb.length,1);const song=AC.amb[0];assert.equal(song.key,key);assert.ok(song.voiceCount>0);
  api.startAmbience(key);assert.equal(AC.amb.length,1);assert.equal(AC.amb[0],song);if(previous){assert.equal(previous.running,false);assert.equal(previous.voiceCount,0);}
  previous=song;
 }
 assert.equal(normal,0);assert.equal(crypt,0);scope.gamePaused=true;previous.update();assert.equal(previous.voiceCount,0);scope.gamePaused=false;
 api.startAmbience('forest');assert.equal(AC.prof,'world');assert.equal(normal,1);assert.equal(crypt,0);assert.equal(previous.running,false);assert.equal(h.timers.size,0);
 api.stopAmbience();assert.equal(AC.amb.length,0);assert.equal(h.timers.size,0);
});
