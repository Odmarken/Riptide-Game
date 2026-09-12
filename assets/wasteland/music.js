/* Original dungeon scores, synthesized locally with the game's existing Web Audio bus.
 * start(key,{ctx,destination,isPaused}) returns a stoppable voice for AC.amb.
 * No media element, downloads, independent volume control or AudioContext is created. */
(function(root){
 'use strict';
 const THEMES=Object.freeze({
  briarhollow:Object.freeze({name:'Under the Briar',bpm:68,mode:'D Dorian',lead:'flute',echo:.31,wet:.17,level:2.34,
   roots:[38,43,36,45,38,43,41,38],chords:[[50,53,57,64],[55,59,62,64],[48,52,55,62],[57,60,64,67],[50,53,57,64],[55,59,62,69],[53,57,60,64],[50,53,57,62]],
   melody:[[74,76,77],[79,77,76],[74,72,69],[72,76,74],[77,81,79],[83,81,79],[77,76,72],[69,72,74]]}),
  cindervein:Object.freeze({name:'Embers Below',bpm:84,mode:'E Phrygian',lead:'hammer',echo:.23,wet:.13,level:3.12,
   roots:[40,41,38,40,36,41,35,40],chords:[[52,55,59,64],[53,57,60,65],[50,53,57,62],[52,55,59,64],[48,52,55,60],[53,57,60,65],[47,50,53,59],[52,55,59,64]],
   melody:[[64,65,67],[65,69,67],[62,65,64],[59,62,64],[67,71,72],[69,67,65],[62,59,65],[67,65,64]]}),
  frostveil:Object.freeze({name:'The Silent Vault',bpm:60,mode:'A Aeolian',lead:'bell',echo:.43,wet:.24,level:3.12,
   roots:[45,41,36,40,45,41,38,45],chords:[[57,60,64,71],[53,57,60,64],[48,55,60,64],[52,55,59,62],[57,60,64,71],[53,57,60,67],[50,57,60,65],[57,60,64,69]],
   melody:[[81,76,79],[77,76,72],[76,79,84],[83,79,76],[81,83,84],[89,88,84],[86,84,81],[79,76,81]]})
 });
 const scores=new Map(),has=key=>Object.prototype.hasOwnProperty.call(THEMES,key),midi=n=>440*Math.pow(2,(n-69)/12);
 function score(key){
  if(!has(key))return null;if(scores.has(key))return scores.get(key);
  const theme=THEMES[key],beat=60/theme.bpm,events=[];
  const add=(at,dur,kind,notes,velocity=1,pan=0)=>events.push(Object.freeze({at:at*beat,dur:dur*beat,kind,notes:Object.freeze([].concat(notes)),velocity,pan}));
  // Sixteen bars: a quiet eight-bar statement followed by a higher answering phrase.
  // The three scores share their phrase length, but have distinct notes, pulse and instruments.
  for(let pair=0;pair<8;pair++){
   const t=pair*8,chord=theme.chords[pair],melody=theme.melody[pair];
   add(t,8.35,'pad',chord,.82+(pair>=4?.13:0));
   add(t,3.7,'bass',theme.roots[pair],.82);add(t+4,3.75,'bass',theme.roots[pair],.68);
   if(key==='briarhollow'){
    for(let j=0;j<4;j++)add(t+j*2+.5,1.7,'harp',chord[[0,2,1,3][j]]+12,.63,j%2?.27:-.27);
    add(t+.5,1.8,'flute',melody[0],.78,-.1);add(t+3,1.3,'flute',melody[1],.70,-.1);add(t+5.5,2.25,'flute',melody[2],.77,-.1);
    add(t,1.1,'drum',45,.38);add(t+5,0.6,'wood',67,.28,.18);
   }else if(key==='cindervein'){
    for(let j=0;j<8;j++){
     if(j!==3&&j!==7)add(t+j,.62,'lowString',theme.roots[pair]+(j%4===2?19:12),j%2?.48:.65,j%2?.16:-.16);
     if(j%2===0)add(t+j,.85,'drum',43,j===0?.66:.43);
    }
    add(t+1,1.55,'hammer',melody[0],.68,-.21);add(t+4.5,1.7,'hammer',melody[1],.53,.24);add(t+6.5,1.1,'hammer',melody[2],.57,-.10);
    if(pair%2===1)add(t+7.5,.32,'wood',61,.31,.12);
   }else{
    add(t+1,3.3,'bell',melody[0],.78,-.28);add(t+3.5,2.7,'bell',melody[1],.64,.27);add(t+6,2.35,'bell',melody[2],.71,-.13);
    add(t+2,4.8,'airString',[chord[0]+12,chord[2]+12],.58,.09);
    if(pair%2===0)add(t,1.4,'drum',40,.24);
   }
  }
  events.sort((a,b)=>a.at-b.at);
  const result=Object.freeze({key,name:theme.name,bpm:theme.bpm,mode:theme.mode,bars:16,duration:64*beat,events:Object.freeze(events)});
  scores.set(key,result);return result;
 }
 function start(key,options){
  const composition=score(key),ctx=options&&options.ctx,destination=options&&options.destination;
  if(!composition||!ctx||!destination||ctx.state==='closed')return null;
  const theme=THEMES[key],voices=new Set(),routing=[],every=options.setInterval||setInterval,cancel=options.clearInterval||clearInterval;
  const make=kind=>{const n=ctx[kind]();routing.push(n);return n;};
  const input=make('createGain'),master=make('createGain'),send=make('createGain'),delay=make('createDelay'),filter=make('createBiquadFilter'),feedback=make('createGain');
  input.connect(master);master.connect(destination);input.connect(send);send.connect(delay);delay.connect(filter);filter.connect(master);filter.connect(feedback);feedback.connect(delay);
  send.gain.value=theme.wet;delay.delayTime.value=theme.echo;filter.type='lowpass';filter.frequency.value=key==='frostveil'?2400:1600;feedback.gain.value=.21;
  master.gain.setValueAtTime(0,ctx.currentTime);master.gain.linearRampToValueAtTime(theme.level,ctx.currentTime+.12);
  // Shared short noise buffer is used only as the body of struck wood/skin, never a wind loop.
  const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.45),ctx.sampleRate),samples=noise.getChannelData(0);let rand=key.length*1327;
  for(let i=0;i<samples.length;i++){rand=(Math.imul(rand,1664525)+1013904223)|0;samples[i]=((rand>>>0)/2147483648-1)*Math.pow(1-i/samples.length,2);}
  let running=true,origin=ctx.currentTime+.035,index=0,cycle=0,pausedAt=null,timer=null;
  function track(source,nodes,end){
   const voice={source,nodes};voices.add(voice);
   source.onended=()=>{voices.delete(voice);for(const n of nodes)try{n.disconnect();}catch(e){}};
   source.stop(end+.025);
  }
  function clearVoices(){
   for(const voice of voices){try{voice.source.stop();}catch(e){}for(const n of voice.nodes)try{n.disconnect();}catch(e){}}
   voices.clear();
  }
  function route(source,t,dur,level,pan,attack,cutoff,sustain){
   const nodes=[source],gain=ctx.createGain();nodes.push(gain);let tail=source;
   if(cutoff){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=cutoff;f.Q.value=.65;tail.connect(f);tail=f;nodes.push(f);}
   tail.connect(gain);tail=gain;
   gain.gain.setValueAtTime(.00001,t);gain.gain.linearRampToValueAtTime(level,t+Math.min(attack,dur*.3));
   if(sustain){gain.gain.setValueAtTime(level,t+dur*.65);gain.gain.linearRampToValueAtTime(.00001,t+dur);}
   else gain.gain.exponentialRampToValueAtTime(.00001,t+dur);
   if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;gain.connect(p);tail=p;nodes.push(p);}
   tail.connect(input);source.start(t);track(source,nodes,t+dur);
  }
  function tone(f,t,dur,level,type,pan,attack,cutoff,sustain,detune=0,drop=0){
   const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.detune.value=detune;
   if(drop)o.frequency.exponentialRampToValueAtTime(drop,t+dur*.5);
   route(o,t,dur,level,pan,attack,cutoff,sustain);
  }
  function hit(t,dur,level,cutoff,pan){const source=ctx.createBufferSource();source.buffer=noise;route(source,t,Math.min(dur,.44),level,pan,.004,cutoff,false);}
  function play(event,t){
   const v=event.velocity,d=event.dur,p=event.pan,notes=event.notes;
   for(const note of notes){
    const f=midi(note);
    if(event.kind==='pad'||event.kind==='airString'){
     const air=event.kind==='airString',cut=air?1700:key==='cindervein'?630:key==='frostveil'?1150:850;
     for(const detune of [-4,4])tone(f,t,d,(air?.009:.012)*v,key==='cindervein'?'sawtooth':'triangle',p,Math.min(1.1,d*.22),cut,true,detune);
    }else if(event.kind==='bass'){
     tone(f,t,d,.036*v,'sine',p,.16,0,true);tone(f*2,t,d,.012*v,'triangle',p,.20,340,true);
    }else if(event.kind==='flute'){
     for(const [ratio,level]of [[1,.067],[2,.012],[3,.003]])tone(f*ratio,t,d,level*v,'sine',p,.095,2300,true);
    }else if(event.kind==='harp'){
     for(const [ratio,level]of [[1,.070],[2,.020],[3,.008]])tone(f*ratio,t,d/Math.sqrt(ratio),level*v,'sine',p,.006,3600,false);
    }else if(event.kind==='bell'||event.kind==='hammer'){
     const bell=event.kind==='bell',partials=bell?[[1,.065],[2.01,.022],[2.76,.015],[4.07,.007]]:[[1,.063],[2.76,.021],[5.41,.009]];
     for(const [ratio,level]of partials)tone(f*ratio,t,d/Math.sqrt(ratio),level*v,'sine',p,.004,bell?5000:3700,false);
     if(!bell)hit(t,.055,.013*v,1200,p);
    }else if(event.kind==='lowString')tone(f,t,d,.045*v,'triangle',p,.012,600,false);
    else if(event.kind==='drum'){tone(f*1.9,t,d,.11*v,'sine',p,.004,0,false,0,f*.77);hit(t,.26,.043*v,280,p);}
    else if(event.kind==='wood'){tone(f,t,d,.032*v,'sine',p,.003,0,false,0,f*.92);hit(t,.08,.035*v,800,p);}
   }
  }
  function seek(time){
   const offset=Math.max(0,time-origin);cycle=Math.floor(offset/composition.duration);index=0;
   while(index<composition.events.length&&cycle*composition.duration+composition.events[index].at<offset-.001)index++;
   if(index===composition.events.length){cycle++;index=0;}
  }
  function update(){
   if(!running)return;if(ctx.state==='closed'){stop();return;}
   // A suspended audio clock already preserves every playing/scheduled note exactly.
   if(ctx.state==='suspended')return;
   const now=ctx.currentTime,wantsPause=!!(options.isPaused&&options.isPaused());
   if(wantsPause){
    if(pausedAt===null){pausedAt=now;clearVoices();master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(0,now);}
    return;
   }
   if(pausedAt!==null){origin+=now-pausedAt;pausedAt=null;seek(now);master.gain.setValueAtTime(0,now);master.gain.linearRampToValueAtTime(theme.level,now+.12);}
   let time=origin+cycle*composition.duration+composition.events[index].at;
   // Browser background throttling must not release a burst of missed notes on return.
   if(time<now-.3){seek(now);time=origin+cycle*composition.duration+composition.events[index].at;}
   for(let count=0;count<64&&time<=now+.22;count++){
    if(time>=now-.025)play(composition.events[index],Math.max(now+.003,time));
    if(++index===composition.events.length){index=0;cycle++;}
    time=origin+cycle*composition.duration+composition.events[index].at;
   }
  }
  function stop(){
   if(!running)return;running=false;if(timer!==null)cancel(timer);timer=null;
   master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setValueAtTime(0,ctx.currentTime);clearVoices();
   for(const n of routing)try{n.disconnect();}catch(e){}
  }
  update();timer=every(update,80);
  return Object.freeze({key,stop,update,get running(){return running;},get voiceCount(){return voices.size;}});
 }
 const api=Object.freeze({has,score,start,themes:Object.freeze(Object.keys(THEMES).map(key=>Object.freeze({key,name:THEMES[key].name,bpm:THEMES[key].bpm,mode:THEMES[key].mode})))});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.WastelandMusic=api;
})(typeof window==='object'?window:globalThis);
