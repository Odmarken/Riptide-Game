/* ✨ Tides battle effects (asked for 2026-10-09: "gör så tides får coolare effekter också i sina attacker").
   The arena (assets/tides/ui.js paintBattle) is a canvas of its own in CSS pixels, painted fresh every frame from the battle;
   this keeps that battle's effects - the move in flight, the impact, the shield, the healing, the poison and the rest - and
   draws them with the spell effects' helpers (SpellFx.H: the glows, flares, rings, streaks and slashes the world's spells
   use). A move takes its element from its name (Ember Claw burns, Frozen Gore throws ice, Lightning Claw crackles, Seedburst
   scatters leaves, Rune Bolt turns a magic circle) and a melee move its contact from its verb (a claw rakes, a bite snaps,
   a charge slams). The battle's own events (assets/tides/core.js act) set them off at the moment the timeline shows them;
   nothing here reads or changes the rules.
     create()                         - one battle's effects
     anchors(st,{player,foe})         - where the two Tides stand this frame: x (middle), y (feet), w, h, dir (1 faces right)
     frame(st,time,o)                 - step to the battle's clock; o: {move} the move in flight, {units} the shown combatants
     event(st,e,look)                 - a timeline event happened; look: {names,color,style,power,name} the move behind it
     drawUnder / drawMove / drawOver  - under the Tides, the move in flight, over them
     flash(st,side)                   - 0..1, how white the struck Tide is drawn
     shakeOffset(st)                  - the arena's jolt when something lands */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.TideBattleFx=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const TAU=Math.PI*2,MAXP=320;
 const clamp01=v=>v<0?0:v>1?1:v;
 const out=p=>1-Math.pow(1-clamp01(p),3);
 const pick=(v,r)=>Array.isArray(v)?v[0]+(v[1]-v[0])*r():v;
 const other=s=>s==='player'?'foe':'player';
 function rgb(hex){
  const s=String(hex||'').trim().replace(/^#/,'');
  if(/^[0-9a-f]{6}$/i.test(s)){const n=parseInt(s,16);return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);}
  if(/^[0-9a-f]{3}$/i.test(s))return s.split('').map(c=>parseInt(c+c,16)).join(',');
  return '255,255,255';
 }
 function mix(a,b,t){const A=a.split(',').map(Number),B=b.split(',').map(Number);return A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',');}

 /* ---------- what a move looks like ---------- */
 const ELEMENTS=[
  ['fire',/ember|burn|cinder|fire|flame|blaz|dawn|pyre|scorch|kindl/i],
  ['frost',/frost|frozen|glacier|\bice|icy|rime|snow|hail/i],
  ['storm',/lightning|thunder|storm|spark|volt/i],
  ['water',/river|ripple|reef|wave|splash|shell|tide/i],
  ['nature',/bramble|thorn|seed|moss|sap\b|leaf|acorn|berry|vine|petal|amber|needle/i],
  ['stone',/stone|pebble|obsidian|tusk|slam|headbutt|horn|gore|rock|boulder/i],
  ['spirit',/spectral|spirit|astral|veil|ghost|siphon|wraith/i],
  ['arcane',/rune|crystal|prism|aurora|moon|lunar|dusk|mirage|aegis|drowsy/i],
  ['light',/golden|solar|\bsun|radiant|grace|holy/i],
 ];
 /* the element of the first name that has one, by the earliest word in it ("Riverstone Guard" is water, "Frozen Gore" frost) */
 function element(names){
  for(const n of [].concat(names||[]).map(String)){
   let best=null,at=Infinity;
   for(const [k,re] of ELEMENTS){const m=re.exec(n);if(m&&m.index<at){at=m.index;best=k;}}
   if(best)return best;
  }
  return 'beast';
 }
 function contact(names){
  for(const n of [].concat(names||[]).map(String)){
   if(/bite|fang|snap|jaw|pincer|venom|siphon/i.test(n))return 'bite';
   if(/claw|talon|slash|swipe|rake|pounce/i.test(n))return 'claw';
   if(/kick|headbutt|tusk|horn|gore|slam|charge|dive|strike|lunge/i.test(n))return 'bash';
  }
  return 'bash';
 }
 /* each element's own light, its white-hot heart, and what flies off it */
 const LOOK={
  fire:{c:'255,128,40',hot:'255,214,120',bit:'ember'},
  frost:{c:'140,210,255',hot:'235,250,255',bit:'shard'},
  storm:{c:'150,180,255',hot:'235,240,255',bit:'spark'},
  water:{c:'80,180,235',hot:'210,245,255',bit:'drop'},
  nature:{c:'130,200,80',hot:'230,250,170',bit:'leaf'},
  stone:{c:'190,160,120',hot:'255,230,190',bit:'rock'},
  spirit:{c:'150,170,255',hot:'235,240,255',bit:'mote'},
  arcane:{c:null,hot:'255,255,255',bit:'mote'},
  light:{c:'255,210,110',hot:'255,250,220',bit:'mote'},
  beast:{c:null,hot:'255,248,235',bit:'spark'},
 };
 /* the colour a move is drawn in: its own colour, pulled toward its element's */
 function tint(look,el){const own=rgb(look&&look.color),L=LOOK[el]||LOOK.beast;return L.c?mix(own,L.c,.55):own;}

 /* ---------- state ---------- */
 function create(o={}){
  return {t:0,time:null,parts:[],fx:[],floats:[],shake:0,flash:{player:0,foe:0},sick:{player:0,foe:0},L:null,rnd:o.rng||Math.random,
   font:o.font||'Georgia, serif',acc:{player:{},foe:{}},hue:{player:{},foe:{}},pend:{player:{},foe:{}},trail:0,lane:{player:0,foe:0}};
 }
 function anchors(st,L){st.L=L;}
 const scaleOf=a=>Math.max(.6,Math.min(2,Math.min(a.h,a.w*1.15)/120));
 const front=(a,k=.25)=>({x:a.x+a.dir*a.w*k,y:a.y-a.h*.5});
 const helpers=()=>root.SpellFx&&root.SpellFx.H||null;

 function emit(st,o){
  const r=st.rnd,n=Math.max(0,Math.round(o.n??1));
  for(let i=0;i<n;i++){
   if(st.parts.length>=MAXP)st.parts.shift();
   const a=pick(o.angle||[0,TAU],r),v=pick(o.speed||[30,90],r),sp=o.spread||0;
   st.parts.push({x:o.x+(r()-.5)*2*sp,y:o.y+(r()-.5)*2*sp*(o.flat??1),vx:Math.cos(a)*v,vy:Math.sin(a)*v*(o.flat??1)-(o.up||0),t:0,
    life:Math.max(.05,pick(o.life||[.4,.8],r)),s:pick(o.size||[2,4],r),c:o.c||'255,255,255',k:o.kind||'glow',g:o.grav||0,
    drag:o.drag??2,rot:r()*TAU,spin:pick(o.spin||[-5,5],r),seed:r()*100,under:!!o.under});
  }
 }
 /* the element's own debris thrown out of a point: s the size of the Tide it lands on, k how much */
 function burst(st,el,x,y,c,s,k=1,dir=0){
  const L=LOOK[el]||LOOK.beast,toward=dir?(dir>0?[-1.1,1.1]:[Math.PI-1.1,Math.PI+1.1]):[0,TAU];
  switch(L.bit){
   case 'ember':emit(st,{x,y,n:16*k,kind:'ember',c:mix(c,'255,190,90',.3),speed:[50*s,170*s],angle:toward,life:[.5,1.1],size:[1.6*s,3.4*s],up:40*s,drag:2.2,grav:-30*s,spread:8*s});
    emit(st,{x,y,n:7*k,kind:'smoke',c:'70,52,44',speed:[10*s,40*s],life:[.7,1.2],size:[10*s,18*s],up:30*s,spread:10*s});break;
   case 'shard':emit(st,{x,y,n:12*k,kind:'shard',c,speed:[90*s,230*s],angle:toward,life:[.45,.85],size:[2.4*s,4.4*s],drag:3,grav:120*s,spin:[-12,12],spread:6*s});
    emit(st,{x,y,n:10*k,kind:'mote',c:'230,248,255',speed:[20*s,70*s],life:[.8,1.4],size:[1.2*s,2.4*s],grav:18*s,spread:20*s});break;
   case 'spark':emit(st,{x,y,n:16*k,kind:'spark',c,speed:[160*s,380*s],angle:toward,life:[.18,.42],size:[1.4*s,2.6*s],drag:4,spread:4*s});break;
   case 'drop':emit(st,{x,y,n:16*k,kind:'drop',c,speed:[80*s,200*s],angle:[-Math.PI*.95,-Math.PI*.05],life:[.5,.9],size:[2*s,3.6*s],grav:520*s,drag:1,spread:8*s});break;
   case 'leaf':emit(st,{x,y,n:12*k,kind:'leaf',c,speed:[60*s,170*s],angle:toward,life:[.8,1.4],size:[3*s,5*s],grav:60*s,drag:2.6,spin:[-8,8],spread:8*s});
    emit(st,{x,y,n:6*k,kind:'mote',c:mix(c,'255,250,190',.5),speed:[20*s,60*s],life:[.6,1.1],size:[1.2*s,2.2*s],up:20*s,spread:12*s});break;
   case 'rock':emit(st,{x,y,n:10*k,kind:'rock',c:'120,104,90',speed:[90*s,220*s],angle:[-Math.PI*.95,-Math.PI*.05],life:[.5,.9],size:[2.6*s,5*s],grav:600*s,drag:.8,spin:[-10,10],spread:8*s});
    emit(st,{x,y:y+10*s,n:6*k,kind:'dust',c:'150,128,100',speed:[20*s,60*s],life:[.6,1.1],size:[12*s,22*s],up:10*s,spread:14*s});break;
   default:emit(st,{x,y,n:14*k,kind:'mote',c,speed:[40*s,140*s],angle:toward,life:[.5,1.1],size:[1.6*s,3.2*s],drag:2.4,spread:6*s});
  }
 }
 /* a number rises over its Tide's head; a word (the power's name, Empowered, Weakened) is a caption under its feet, two at most */
 function float(st,side,text,c,o={}){
  if(!text)return;
  if(o.small){const row=st.floats.filter(f=>f.small&&f.side===side&&f.t<f.life*.6).length;if(row>1)return;
   st.floats.push({side,text:String(text),c,t:0,life:o.life||1.4,small:true,dx:0,row});return;}
  const lane=st.lane[side]=(st.lane[side]+1)%3;
  st.floats.push({side,text:String(text),c,t:0,life:o.life||1.15,small:false,dx:(lane-1)*34,up:(o.up||0)+lane*16});
 }

 /* ---------- the battle's events ---------- */
 function event(st,e,look={}){
  if(!st||!e||!st.L)return;
  const side=e.side,target=e.targetSide||other(side),a=st.L[side],b=st.L[target];if(!a||!b)return;
  const names=look.names||[look.name],el=element(names),c=tint(look,el),s=scaleOf(b),num=(re,t)=>{const m=re.exec(String(t||''));return m?+m[1]:0;};
  switch(e.type){
   case 'attack':case 'power':{
    const sa=scaleOf(a),f=front(a,.28);
    st.fx.push({k:e.type==='power'?'circle':'windup',side,c,el,t:0,life:e.type==='power'?1:.4,magic:look.style==='magic'});
    if(e.type==='power'){emit(st,{x:a.x,y:a.y-4,n:12,kind:'mote',c,speed:[10*sa,40*sa],life:[.7,1.2],size:[1.6*sa,3*sa],up:70*sa,spread:a.w*.35,flat:.3});
     float(st,side,look.name,c,{small:true,life:1.5});}
    else if(look.style==='magic')emit(st,{x:f.x,y:f.y,n:6,kind:'mote',c,speed:[20*sa,60*sa],life:[.3,.6],size:[1.4*sa,2.6*sa],spread:10*sa});
    break;}
   case 'damage':{
    const raw=num(/takes (\d+) damage/,e.text),blocked=num(/\((\d+) blocked\)/,e.text),f=front(b,.22),melee=look.style==='melee',hit=raw>0;
    if(hit){st.flash[target]=1;st.shake=Math.max(st.shake,(look.power?7:4.5)*Math.min(1.4,s));}
    st.fx.push({k:'impact',side:target,from:side,c,el,t:0,life:melee?.55:.7,melee,contact:contact(names),power:!!look.power,dir:a.dir,x:f.x,y:f.y,blocked:blocked>0,seed:st.rnd()*1000});
    st.fx.push({k:'shock',side:target,c,t:0,life:.6,power:!!look.power});
    if(blocked)st.fx.push({k:'wardhit',side:target,c:st.hue[target].shield||'150,210,255',t:0,life:.5,x:f.x,y:f.y});
    burst(st,el,f.x,f.y,c,s,(look.power?1.2:.85)*(hit?1:.4),melee?a.dir:0);
    if(el==='storm')st.fx.push({k:'zap',side:target,c,t:0,life:.45,seed:st.rnd()*1000});
    float(st,target,hit?'-'+raw:blocked?'Blocked':'0',hit?'255,226,214':'190,220,255');
    break;}
   case 'shield':{
    st.hue[target].shield=c;st.pend[target].shield=true;
    st.fx.push({k:'ward',side:target,c,t:0,life:1.3});
    emit(st,{x:b.x,y:b.y-b.h*.5,n:14,kind:'mote',c,speed:[40*s,120*s],life:[.4,.8],size:[1.4*s,2.6*s],drag:3,spread:b.w*.3});
    float(st,target,'+'+(e.amount|0)+' shield','170,220,255');
    break;}
   case 'buff':{
    st.hue[target].buff=c;st.pend[target].buff=true;
    st.fx.push({k:'rise',side:target,c,t:0,life:1.25});
    emit(st,{x:b.x,y:b.y-6,n:16,kind:'mote',c:mix(c,'255,236,170',.35),speed:[10*s,40*s],life:[.8,1.3],size:[1.6*s,3*s],up:110*s,drag:1.5,spread:b.w*.4,flat:.3});
    float(st,target,'Empowered',mix(c,'255,236,170',.4),{small:true});
    break;}
   case 'weaken':{
    st.pend[target].weaken=true;
    st.fx.push({k:'sink',side:target,c:'150,90,210',t:0,life:1.2});
    emit(st,{x:b.x,y:b.y-b.h*1.05,n:12,kind:'smoke',c:'60,30,90',speed:[10*s,30*s],life:[.8,1.3],size:[12*s,20*s],grav:50*s,spread:b.w*.35});
    float(st,target,'Weakened','200,160,255',{small:true});
    break;}
   case 'status':{
    st.pend[target].poison=true;
    st.fx.push({k:'venom',side:target,c:'140,220,80',t:0,life:.9});
    emit(st,{x:b.x,y:b.y-b.h*.55,n:16,kind:'drop',c:'140,220,80',speed:[60*s,160*s],angle:[-Math.PI*.95,-Math.PI*.05],life:[.5,.9],size:[2*s,3.4*s],grav:480*s,drag:1,spread:b.w*.2});
    break;}
   case 'poison':{
    const amt=e.amount|0;st.sick[target]=1;
    emit(st,{x:b.x,y:b.y-b.h*.45,n:14,kind:'bubble',c:'150,230,90',speed:[10*s,40*s],life:[.7,1.2],size:[2.4*s,4.6*s],up:60*s,drag:1.4,spread:b.w*.3});
    if(amt>0)float(st,target,'-'+amt,'170,240,110');
    break;}
   case 'heal':{
    st.fx.push({k:'heal',side:target,c:mix(c,'150,255,150',.5),t:0,life:1.4});
    emit(st,{x:b.x,y:b.y-6,n:18,kind:'plus',c:'170,255,160',speed:[8*s,30*s],life:[.9,1.4],size:[3*s,5*s],up:80*s,drag:1.2,spread:b.w*.42,flat:.3});
    float(st,target,'+'+(e.amount|0),'150,255,150');
    break;}
   case 'recoil':{
    st.flash[target]=.7;st.shake=Math.max(st.shake,3);
    const f=front(b,.3);emit(st,{x:f.x,y:f.y,n:10,kind:'spark',c:'255,120,80',speed:[120*s,260*s],life:[.2,.4],size:[1.4*s,2.4*s],drag:4,spread:4*s});
    float(st,target,'-'+(e.amount|0),'255,170,120');
    break;}
   case 'ko':{   /* the round is over and this Tide is down */
    st.fx.push({k:'shock',side:target,c:'255,240,220',t:0,life:.9,power:true});st.shake=Math.max(st.shake,6);
    emit(st,{x:b.x,y:b.y-b.h*.5,n:24,kind:'mote',c:'255,236,200',speed:[60*s,200*s],life:[.6,1.2],size:[1.6*s,3*s],drag:2.4,spread:b.w*.2});
    float(st,target,'Knocked out!','255,236,200',{small:true,life:1.8});
    break;}
  }
 }

 /* ---------- the clock: particles, and what lasts - a move's trail, a status's own wisps ---------- */
 function frame(st,time,o={}){
  if(!st)return;
  const dt=st.time==null?0:Math.max(0,Math.min(.05,time-st.time));st.time=time;
  if(!o.animating)st.pend={player:{},foe:{}};
  if(!(dt>0))return;
  st.t+=dt;
  for(let i=st.parts.length-1;i>=0;i--){const p=st.parts[i];p.t+=dt;if(p.t>=p.life){st.parts.splice(i,1);continue;}const d=Math.exp(-p.drag*dt);p.vx*=d;p.vy=p.vy*d+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;}
  for(let i=st.fx.length-1;i>=0;i--){const e=st.fx[i];e.t+=dt;if(e.t>=e.life)st.fx.splice(i,1);}
  for(let i=st.floats.length-1;i>=0;i--){const f=st.floats[i];f.t+=dt;if(f.t>=f.life)st.floats.splice(i,1);}
  for(const s of ['player','foe']){st.flash[s]=Math.max(0,st.flash[s]-dt*4.5);st.sick[s]=Math.max(0,st.sick[s]-dt*2.5);}
  st.shake=Math.max(0,st.shake-dt*28);
  const m=o.move;   /* a bolt in flight leaves its element behind it */
  if(m&&st.L&&m.look&&m.look.style==='magic'&&!m.self&&m.progress>.02&&m.progress<.66&&element(m.look.names)!=='storm'){
   st.trail+=dt*60;const path=boltPath(st,m);if(path){const el=element(m.look.names),c=tint(m.look,el),L=LOOK[el]||LOOK.beast,s=scaleOf(st.L[m.side]);
    while(st.trail>=1){st.trail--;const q=path(Math.min(1,m.progress*1.55));
     const kind=L.bit==='spark'?'spark':L.bit==='drop'?'bubble':L.bit==='rock'?'dust':L.bit;
     emit(st,{x:q.x,y:q.y,n:1,kind:kind==='dust'?'dust':kind,c,speed:[8*s,40*s],life:kind==='dust'?[.4,.7]:[.3,.6],size:kind==='dust'?[6*s,10*s]:[1.4*s,2.8*s],up:kind==='ember'?30*s:0,grav:kind==='shard'?80*s:0,drag:2.5,spread:4*s});}}
  }else st.trail=0;
  const u=o.units;   /* what lasts: the poisoned bubble, the weakened sink, the empowered shine */
  if(u&&st.L)for(const s of ['player','foe']){
   const unit=u[s],a=st.L[s],acc=st.acc[s];if(!unit||!a||unit.hp<=0)continue;const sc=scaleOf(a);
   if(unit.poisonTurns>0||st.pend[s].poison){acc.poison=(acc.poison||0)+dt;while(acc.poison>.32){acc.poison-=.32;emit(st,{x:a.x+(st.rnd()-.5)*a.w*.5,y:a.y-a.h*(.2+st.rnd()*.4),n:1,kind:'bubble',c:'150,230,90',speed:[2,10],life:[.8,1.3],size:[1.6*sc,3.2*sc],up:28*sc,drag:1});}}
   if(unit.weakenTurns>0||st.pend[s].weaken){acc.weaken=(acc.weaken||0)+dt;while(acc.weaken>.4){acc.weaken-=.4;emit(st,{x:a.x+(st.rnd()-.5)*a.w*.6,y:a.y-a.h*(.6+st.rnd()*.4),n:1,kind:'smoke',c:'60,30,90',speed:[2,8],life:[1,1.4],size:[8*sc,13*sc],grav:16*sc});}}
   if(unit.buffTurns>0||st.pend[s].buff){acc.buff=(acc.buff||0)+dt;while(acc.buff>.3){acc.buff-=.3;emit(st,{x:a.x+(st.rnd()-.5)*a.w*.7,y:a.y-a.h*st.rnd()*.3,n:1,kind:'mote',c:st.hue[s].buff||'255,214,120',speed:[2,8],life:[.8,1.2],size:[1.4*sc,2.6*sc],up:60*sc,drag:1});}}
  }
 }
 /* where a bolt flies: from the caster's chest to the target's, over a low arc */
 function boltPath(st,m){
  const a=st.L[m.side],b=st.L[m.target||other(m.side)];if(!a||!b)return null;
  const x0=a.x+a.dir*a.w*.28,y0=a.y-a.h*.58,x1=b.x+b.dir*b.w*.25,y1=b.y-b.h*.5,lift=Math.min(a.h,b.h)*.28;
  return p=>({x:x0+(x1-x0)*p,y:y0+(y1-y0)*p-Math.sin(p*Math.PI)*lift,dx:x1-x0,dy:(y1-y0)-Math.cos(p*Math.PI)*Math.PI*lift});
 }

 /* ---------- drawing ---------- */
 function flash(st,side){return st?Math.max(st.flash[side]||0,0):0;}
 function shakeOffset(st){const s=st?st.shake:0;if(!(s>.05))return {x:0,y:0};const t=st.t*57;return {x:Math.sin(t*1.7)*s,y:Math.cos(t*2.3)*s*.55};}

 /* under the Tides: the power's circle, the ground's shock, a shield's foot, the healing light's pool */
 function drawUnder(g,st,o={}){
  const H=helpers();if(!H||!st||!st.L)return;
  for(const e of st.fx){
   const a=st.L[e.side];if(!a)continue;const p=e.t/e.life,s=scaleOf(a);
   if(e.k==='circle'){const fade=Math.min(1,p*5)*(1-Math.pow(p,2));H.runes(g,a.x,a.y-2,a.w*.62*(.55+.45*out(p*2.2)),e.c,fade*.95,{flat:.3,rot:st.t*1.3,w:1.8*s,ticks:18,star:6});H.haze(g,a.x,a.y-2,a.w*.8,e.c,fade*.45,.3);}
   else if(e.k==='shock'){const r=a.w*.32*(.45+1.2*out(p));H.ring(g,a.x,a.y-1,r,(e.power?3.4:2.4)*s*(1-p),e.c,(1-p)*.85,.3);H.haze(g,a.x,a.y-1,r*1.1,e.c,(1-p)*.25,.3);}
   else if(e.k==='heal'){H.haze(g,a.x,a.y-2,a.w*.7,e.c,Math.sin(Math.PI*p)*.55,.3);}
   else if(e.k==='venom'){H.haze(g,a.x,a.y,a.w*.55*(.5+.5*out(p*2)),e.c,(1-p)*.5,.28,false);}
  }
  for(const p of st.parts)if(p.under)drawPart(g,H,p);
 }

 /* the move in flight: m {side, target, progress (0..1 of its turn), look, self} */
 function drawMove(g,st,m){
  const H=helpers();if(!H||!st||!st.L||!m||!m.look)return;
  const a=st.L[m.side],b=st.L[m.target||other(m.side)];if(!a||!b)return;
  const look=m.look,el=element(look.names),c=tint(look,el),L=LOOK[el]||LOOK.beast,sa=scaleOf(a),pr=m.progress;
  if(look.style==='melee'){
   /* the lunge: streaks of the move's colour behind the Tide as it springs */
   if(pr>.08&&pr<.5){const k=Math.sin(Math.PI*(pr-.08)/.42),bx=a.x-a.dir*a.w*.42;
    for(let i=0;i<4;i++){const y=a.y-a.h*(.25+i*.16),len=a.w*(.35+.15*((i*37)%3))*k;H.streak(g,bx-a.dir*len,y,bx,y,2.2*sa,c,.55*k);}}
   return;
  }
  if(m.self){   /* a power on itself: the light gathers round it */
   const k=Math.sin(Math.PI*clamp01(pr));H.glow(g,a.x,a.y-a.h*.5,a.w*.55,c,.35*k,1.1);return;
  }
  const path=boltPath(st,m);if(!path)return;
  const p=Math.min(1,pr*1.55),q=path(p),ang=Math.atan2(q.dy,q.dx),s=Math.max(sa,scaleOf(b))*.9;
  if(p<.12){const f=front(a,.28),k=p/.12;H.glow(g,f.x,f.y,22*s*k,c,.9*k);H.flare(g,f.x,f.y,30*s*k,L.hot,.6*k,st.t*3);}   /* it gathers before it flies */
  if(p>=1)return;
  if(el==='storm'){   /* lightning: no ball, a crooked line that strikes and flickers */
   if(p>.15){const r=rngOf(Math.floor(st.t*24)),f=front(a,.28),t=front(b,.25),pts=H.jag(f.x,f.y,t.x,t.y,9,18*s,r);H.line(g,pts,3*s,c,.95);
    const pts2=H.jag(f.x,f.y,t.x,t.y,7,26*s,r);H.line(g,pts2,1.4*s,L.hot,.6);H.glow(g,t.x,t.y,30*s,c,.8);}
   return;
  }
  /* the tail: the head's own light laid back along its path */
  for(let i=8;i>=1;i--){const tq=path(Math.max(0,p-i*.035)),k=1-i/9;H.glow(g,tq.x,tq.y,(5+9*k)*s,c,.5*k);}
  const back=path(Math.max(0,p-.16));H.streak(g,back.x,back.y,q.x,q.y,9*s,c,.75);
  /* the head: a white-hot heart in its element's dress */
  H.glow(g,q.x,q.y,24*s,c,.95);
  if(el==='fire'){H.glow(g,q.x,q.y,14*s,'255,230,160',1);H.haze(g,q.x-Math.cos(ang)*10*s,q.y-Math.sin(ang)*10*s,26*s,'255,110,30',.6);}
  else if(el==='frost'||(el==='arcane'&&/crystal|prism/i.test(look.names.join(' ')))){drawShard(g,q.x,q.y,11*s,ang+st.t*9,c);}
  else if(el==='arcane'){H.runes(g,q.x,q.y,15*s,c,.95,{flat:1,rot:st.t*6,w:1.3*s,ticks:10,star:5});}
  else if(el==='water'){g.save();g.globalAlpha=.85;g.strokeStyle='rgba(225,250,255,.9)';g.lineWidth=1.6*s;g.beginPath();g.arc(q.x,q.y,9*s,0,TAU);g.stroke();g.restore();}
  else if(el==='nature'){for(let i=0;i<3;i++){const t=st.t*7+i*TAU/3;drawLeaf(g,q.x+Math.cos(t)*12*s,q.y+Math.sin(t)*8*s,4*s,t,c,.95);}}
  else if(el==='stone'){drawRock(g,q.x,q.y,9*s,st.t*5,'130,112,96',1);}
  else if(el==='spirit'){for(let i=0;i<3;i++){const t=st.t*5+i*TAU/3;H.glow(g,q.x+Math.cos(t)*13*s,q.y+Math.sin(t)*13*s,6*s,c,.8);}}
  H.flare(g,q.x,q.y,26*s,L.hot,.85,st.t*2.4);
 }

 /* over the Tides: the impacts and the statuses, the debris, and the numbers */
 function drawOver(g,st,o={}){
  const H=helpers();if(!H||!st||!st.L)return;
  const u=o.units||{};
  /* what lasts while it lasts: a shield's ward round its Tide */
  for(const s of ['player','foe']){
   const a=st.L[s],unit=u[s];if(!a||!unit||unit.hp<=0)continue;
   if(unit.shield>0||st.pend[s].shield)drawWard(g,H,a,st.hue[s].shield||'150,210,255',.32+.06*Math.sin(st.t*3.1+(s==='foe'?1.7:0)),st.t);
   if(st.sick[s]>0)H.haze(g,a.x,a.y-a.h*.5,a.w*.6,'130,230,70',st.sick[s]*.5,1.1);
  }
  for(const e of st.fx){
   const a=st.L[e.side];if(!a)continue;const p=e.t/e.life,s=scaleOf(a);
   switch(e.k){
    case 'windup':{const f=front(a,.3),k=Math.sin(Math.PI*p);H.glow(g,f.x,f.y,(e.magic?26:16)*s*k,e.c,.8*k);if(e.magic)H.flare(g,f.x,f.y,34*s*k,'255,255,255',.5*k,st.t*3);break;}
    case 'circle':{const k=Math.sin(Math.PI*p);H.beam(g,a.x,a.y-a.h*1.35,a.y,a.w*.75,e.c,.32*k);break;}
    case 'impact':drawImpact(g,H,st,e,a,p,s);break;
    case 'zap':{const r=rngOf(e.seed+Math.floor(st.t*20));for(let i=0;i<3;i++){const t0=r()*TAU,x0=a.x+Math.cos(t0)*a.w*.4,y0=a.y-a.h*.5+Math.sin(t0)*a.h*.4,t1=t0+1.2+r(),x1=a.x+Math.cos(t1)*a.w*.45,y1=a.y-a.h*.5+Math.sin(t1)*a.h*.42;H.line(g,H.jag(x0,y0,x1,y1,6,10*s,r),1.6*s,e.c,(1-p)*.9);}break;}
    case 'ward':{const k=out(p/.3),fl=p<.3?0:Math.max(0,1-(p-.3)/.25);g.save();g.translate(a.x,a.y-a.h*.5);g.scale(.35+.65*k,.35+.65*k);g.translate(-a.x,-(a.y-a.h*.5));drawWard(g,H,a,e.c,.32+.6*fl+.3*(1-k),st.t);g.restore();break;}
    case 'wardhit':{const k=1-p;H.flare(g,e.x,e.y,40*s*(1+p),'210,240,255',k*.9,.4);H.glow(g,e.x,e.y,30*s,e.c,k*.8);break;}
    case 'rise':{for(let i=0;i<4;i++){const q=clamp01(p*1.6-i*.18);if(q<=0||q>=1)continue;const y=a.y-a.h*(.05+1.15*out(q)),k=Math.sin(Math.PI*q),w=a.w*.24;drawChevron(g,H,a.x+(i%2?-1:1)*a.w*.12,y,w,8*s,e.c,k);}H.beam(g,a.x,a.y-a.h*1.4,a.y,a.w*.55,e.c,.4*Math.sin(Math.PI*p));break;}
    case 'sink':{for(let i=0;i<3;i++){const q=clamp01(p*1.5-i*.2);if(q<=0||q>=1)continue;const y=a.y-a.h*(1.25-.85*out(q)),k=Math.sin(Math.PI*q);drawChevron(g,H,a.x,y,a.w*.26,-9*s,e.c,k*.9);}H.haze(g,a.x,a.y-a.h*.55,a.w*.6,'40,16,60',.45*Math.sin(Math.PI*p),1.1,false);break;}
    case 'venom':{H.glow(g,a.x,a.y-a.h*.55,a.w*.35*(1+p),e.c,(1-p)*.6);break;}
    case 'heal':{const k=Math.sin(Math.PI*p);H.beam(g,a.x,a.y-a.h*1.5,a.y,a.w*.8,e.c,.5*k);H.glow(g,a.x,a.y-a.h*.55,a.w*.5,e.c,.3*k);break;}
   }
  }
  for(const p of st.parts)if(!p.under)drawPart(g,H,p);
  drawFloats(g,st);
 }
 function drawImpact(g,H,st,e,a,p,s){
  const k=1-p,x=e.x,y=e.y,big=e.power?1.3:1,L=LOOK[e.el]||LOOK.beast;
  if(p<.25){H.flare(g,x,y,(52+30*p)*s*big,L.hot,(1-p/.25)*.95,e.seed);}   /* the white instant it lands */
  H.glow(g,x,y,(26+24*p)*s*big,e.c,k*k*.95);
  /* the element's own flourish where it lands */
  if(e.el==='fire'){H.haze(g,x,y-8*s*p,(34+46*out(p))*s*big,'255,96,18',k*.85);H.glow(g,x,y,(18+16*p)*s*big,'255,200,90',k*.8);}
  else if(e.el==='frost'){for(let i=0;i<6;i++){const t=i*TAU/6+.3,r0=8*s,r1=(18+34*out(p*1.5))*s*big;H.streak(g,x+Math.cos(t)*r0,y+Math.sin(t)*r0,x+Math.cos(t)*r1,y+Math.sin(t)*r1,4*s,'200,240,255',k);}}
  else if(e.el==='arcane')H.runes(g,x,y,(18+30*out(p))*s*big,e.c,k*.9,{flat:1,rot:st.t*4,w:1.4*s,ticks:12,star:5});
  else if(e.el==='water'){H.ring(g,x,y+16*s,(14+40*out(p))*s*big,3*s*k,'200,240,255',k*.8,.45);H.haze(g,x,y,(24+30*p)*s,'70,170,230',k*.6);}
  else if(e.el==='nature')H.haze(g,x,y,(26+34*out(p))*s*big,'110,190,60',k*.55);
  else if(e.el==='stone')H.haze(g,x,y+10*s,(30+40*out(p))*s*big,'150,128,100',k*.5,1,false);
  else if(e.el==='light'||e.el==='spirit')H.flare(g,x,y,(40+30*p)*s*big,e.c,k*.8,st.t);
  if(e.melee){
   const lead=out(p/.22),fade=p<.3?1:Math.max(0,1-(p-.3)/.62),d=-e.dir;   /* d: the way the blow travels across the target */
   if(e.contact==='claw'){   /* three rakes, white-hot down the middle */
    for(let i=-1;i<=1;i++){const ox=i*13*s,len=46*s*big,x0=x-d*len*.55+ox-7*s*i,y0=y-len*.75,x1=x+d*len*.55+ox+7*s*i,y1=y+len*.75;
     H.streak(g,x0,y0,x0+(x1-x0)*lead,y0+(y1-y0)*lead,7*s,e.c,fade);}
   }else if(e.contact==='bite'){   /* the jaws close */
    const r=28*s*big,gap=r*(.95-.8*lead);
    H.crescent(g,x,y+gap,r,Math.PI*1.12,Math.PI*1.88,8*s,e.c,fade,{flat:.7});
    H.crescent(g,x,y-gap,r,Math.PI*.12,Math.PI*.88,8*s,e.c,fade,{flat:.7});
   }else{   /* the slam's rings */
    H.ring(g,x,y,(14+50*out(p))*s*big,5*s*k,e.c,k,1);
    H.ring(g,x,y,(8+32*out(p*1.4))*s*big,3*s*k,L.hot,k*.8,1);
   }
  }else H.ring(g,x,y,(12+50*out(p))*s*big,3.6*s*k,e.c,k*.9,1);
  if(e.blocked)H.ring(g,x,y,(20+26*out(p))*s,2*s*k,'200,235,255',k*.8,1);
 }
 function drawWard(g,H,a,c,al,t){
  const cx=a.x,cy=a.y-a.h*.5,rx=a.w*.64,ry=a.h*.66;
  H.haze(g,cx,cy,Math.max(rx,ry)*1.05,c,al*.5,ry/Math.max(rx,ry));
  g.save();g.globalCompositeOperation='lighter';
  g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.strokeStyle='rgba('+c+',1)';g.globalAlpha=Math.min(1,al*.9);g.lineWidth=2.2;g.stroke();
  g.clip();   /* a honeycomb inside the ward, its light running round */
  const hs=Math.max(10,Math.min(rx,ry)*.24),w=hs*Math.sqrt(3);g.lineWidth=1;g.strokeStyle='rgba('+c+',1)';
  for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
   const hx=cx+col*w+(row&1?w/2:0),hy=cy+row*hs*1.5,d=Math.hypot((hx-cx)/rx,(hy-cy)/ry);if(d>1.05)continue;
   const run=.5+.5*Math.sin(t*2.4-d*5+col*.7);g.globalAlpha=Math.min(1,al*(.18+.4*run)*d);
   g.beginPath();for(let i=0;i<6;i++){const an=Math.PI/6+i*TAU/6,px=hx+Math.cos(an)*hs,py=hy+Math.sin(an)*hs;if(i)g.lineTo(px,py);else g.moveTo(px,py);}g.closePath();g.stroke();
  }
  g.restore();
  const an=t*1.6;H.glow(g,cx+Math.cos(an)*rx,cy+Math.sin(an)*ry,9,'255,255,255',al*.9);
 }
 function drawChevron(g,H,x,y,w,h,c,a){if(!(a>0))return;H.line(g,[[x-w/2,y+h],[x,y],[x+w/2,y+h]],Math.max(2,Math.abs(h)*.35),c,a);}
 function drawShard(g,x,y,s,rot,c){
  g.save();g.translate(x,y);g.rotate(rot);g.fillStyle='rgba('+c+',.95)';g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(s*.6,0);g.lineTo(0,s*1.8);g.lineTo(-s*.6,0);g.closePath();g.fill();
  g.globalCompositeOperation='lighter';g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.moveTo(0,-s*1.4);g.lineTo(s*.22,0);g.lineTo(0,s*.5);g.closePath();g.fill();g.restore();
 }
 function drawLeaf(g,x,y,s,rot,c,a){
  g.save();g.translate(x,y);g.rotate(rot);g.globalAlpha=Math.min(1,a);g.fillStyle='rgba('+c+',1)';
  g.beginPath();g.moveTo(-s*1.4,0);g.quadraticCurveTo(0,-s*.9,s*1.4,0);g.quadraticCurveTo(0,s*.9,-s*1.4,0);g.fill();
  g.strokeStyle='rgba(30,60,20,.6)';g.lineWidth=Math.max(.5,s*.15);g.beginPath();g.moveTo(-s*1.2,0);g.lineTo(s*1.2,0);g.stroke();g.restore();
 }
 function drawRock(g,x,y,s,rot,c,a){
  g.save();g.translate(x,y);g.rotate(rot);g.globalAlpha=Math.min(1,a);g.fillStyle='rgba('+c+',1)';g.beginPath();
  for(let i=0;i<6;i++){const t=i*TAU/6,r=s*(.75+.25*Math.sin(i*2.7));if(i)g.lineTo(Math.cos(t)*r,Math.sin(t)*r);else g.moveTo(Math.cos(t)*r,Math.sin(t)*r);}
  g.closePath();g.fill();g.fillStyle='rgba(255,240,220,.25)';g.beginPath();g.arc(-s*.25,-s*.3,s*.35,0,TAU);g.fill();g.restore();
 }
 function drawPart(g,H,p){
  const k=p.t/p.life,a=Math.min(1,k*9)*(1-k);if(a<=0)return;
  switch(p.k){
   case 'spark':{const sp=Math.hypot(p.vx,p.vy),L=Math.min(26,4+sp*.06);if(sp<1){H.glow(g,p.x,p.y,p.s*2,p.c,a);break;}H.streak(g,p.x-p.vx/sp*L,p.y-p.vy/sp*L,p.x,p.y,p.s*.8,p.c,a);break;}
   case 'ember':H.glow(g,p.x,p.y,p.s*(1.7+.3*Math.sin(p.t*31+p.seed)),p.c,a*(.75+.25*Math.sin(p.t*23+p.seed*3)));break;
   case 'mote':H.glow(g,p.x+Math.sin(p.t*5+p.seed)*3,p.y,p.s*1.8,p.c,a);break;
   case 'shard':g.save();g.globalAlpha=a;drawShard(g,p.x,p.y,p.s,p.rot,p.c);g.restore();H.glow(g,p.x,p.y,p.s*2.2,p.c,a*.4);break;
   case 'leaf':drawLeaf(g,p.x,p.y,p.s,p.rot,p.c,a);break;
   case 'rock':drawRock(g,p.x,p.y,p.s,p.rot,p.c,a);break;
   case 'drop':{g.save();g.globalAlpha=a;g.fillStyle='rgba('+p.c+',.95)';const sp=Math.hypot(p.vx,p.vy)||1;g.translate(p.x,p.y);g.rotate(Math.atan2(p.vy,p.vx));
    g.beginPath();g.ellipse(0,0,p.s*(1+Math.min(1.4,sp/260)),p.s*.75,0,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.arc(p.s*.3,-p.s*.2,p.s*.3,0,TAU);g.fill();g.restore();break;}
   case 'bubble':{g.save();g.globalAlpha=a*.9;g.strokeStyle='rgba('+p.c+',1)';g.lineWidth=Math.max(.8,p.s*.28);g.beginPath();g.arc(p.x+Math.sin(p.t*6+p.seed)*2,p.y,p.s,0,TAU);g.stroke();
    g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(p.x+Math.sin(p.t*6+p.seed)*2-p.s*.35,p.y-p.s*.35,p.s*.25,0,TAU);g.fill();g.restore();break;}
   case 'plus':{const w=p.s;H.streak(g,p.x-w,p.y,p.x+w,p.y,w*.45,p.c,a);H.streak(g,p.x,p.y+w,p.x,p.y-w,w*.45,p.c,a);break;}
   case 'smoke':case 'dust':H.haze(g,p.x,p.y,p.s*(1+k*1.4),p.c,a*.55,1,false);break;
   default:H.glow(g,p.x,p.y,p.s*2,p.c,a);
  }
 }
 function drawFloats(g,st){
  for(const f of st.floats){
   const a=st.L[f.side];if(!a)continue;const p=f.t/f.life,s=scaleOf(a),pop=f.t<.14?1+.45*(1-f.t/.14):1;
   const size=Math.round((f.small?15:24)*Math.min(1.25,s)*pop),x=(a.hx??a.x)+f.dx*s;   /* where the Tide stands, not where it lunged */
   const y=f.small?Math.min((a.hy??a.y)+14*Math.min(1.2,s)+f.row*(size+4),(st.L.bottom||Infinity)-size*.6-(1-f.row)*(size+4))-6*out(p)   /* above the controls */
    :Math.max((st.L.top||0)+size*.8+46,a.y-a.h*1.04-8*s-f.up)-46*out(p);   /* a number, risen, is still below the HUD at the top */
   const al=p<.7?1:Math.max(0,1-(p-.7)/.3);if(!(al>0))continue;
   g.save();g.globalAlpha=al;g.font=(f.small?'italic 700 ':'800 ')+size+'px '+st.font;g.textAlign='center';g.textBaseline='middle';
   g.lineJoin='round';g.lineWidth=Math.max(3,size*.2);g.strokeStyle='rgba(16,10,6,.85)';g.strokeText(f.text,x,y);
   g.fillStyle='rgba('+f.c+',1)';g.fillText(f.text,x,y);g.restore();
  }
 }
 function rngOf(seed){let s=(seed>>>0)||0x9e3779b9;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}

 return Object.freeze({create,anchors,frame,event,drawUnder,drawMove,drawOver,flash,shakeOffset,element,contact,tint,rgb,LOOK});
});
