/* ⚔ THE RAID AS A BATTLE (asked for 2026-10-03: "vi bygger om lite hur raidsen funkar ... jag vill göra hela delen mer
 * interaktiv och coolare"). The crown's men in an enemy port are an army the player commands from above - ringed in with a
 * drag, sent with a click - and the garrison is an army of its own: it musters at the streets leaving the pier head, stands in
 * ranks with its archers behind the shields where the town has trained archers, meets the men as a body, goes for the wounded
 * and the ones left alone, pulls its own badly wounded back behind the line, and sends men to a house that is being fired.
 * Everybody walks the town's streets: a lazily filled grid of the ground and A* through it, so no one walks through a house or
 * across the water.
 *
 * Pure module: no DOM, no drawing, no game - it runs headless in the tests. The game hands it the ground (blocked(x,y,r)), the
 * men on both sides and the buildings that can be burned; it moves them, fights it out, and leaves events in battle.events for
 * the game to show and to book (a man of ours down, a building burned). The units are plain objects the game draws as they are.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.RaidBattle=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CELL=40,PROBE=14,GAP=34;                    /* the ground grid, the clearance it is read with, and a man's room in a rank */
 const SPEED={watch:96,cadet:96,merc:90,melee:92,archer:98};
 const AGGRO_IDLE=170,AGGRO_BURN=150,AGGRO_MOVE=55,CHASE_LEASH=230;   /* how far our men look for a fight, and stray from their post for one */
 const ENGAGE=300,WATCH_R=560,LEASH=560,DEFEND_R=1600;   /* the garrison: closes at, watches out to, chases to, defends houses within */
 const ARROW_RANGE=480,ARROW_MIN=70,ARROW_SPEED=640,ARROW_HIT=.62,VOLLEY=4.6,KITE=150;
 const BURN_TIME=7,BURN_CONTEST=170,BURN_NEED=3,BURN_AT=110;
 const WOUNDED=.3,THINK=.3,PATHS_PER_TICK=6,DRILLED=1.3,WALL=.7;   /* the garrison's men are soldiers, and a shield wall turns blows */
 /* the garrison's own attacks: after it musters, and again and again - ASSAULT_MAX of fighting once they are at it, ASSAULT_MARCH to
    get there, and afterwards they fall back FALLBACK from the men they fought to form up */
 const ASSAULT_FIRST=14,ASSAULT_COOL=22,ASSAULT_MAX=45,ASSAULT_MARCH=80,ASSAULT_STAND=260,FALLBACK=620,HUNT_LOAD=3;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

 /* what a figure is worth: p is the power of the man (or men) it stands for, as the books count it */
 function statsOf(kind,p){
  const k=Math.sqrt(Math.max(.2,p||1));
  if(kind==='archer')return {hp:Math.round(70*k),dmg:4*k,cd:1.2,arrow:9*k};
  return {hp:Math.round(95*k),dmg:8.5*k,cd:1,arrow:0};
 }

 /* ---------------------------------------------------------------- the ground */
 function walkCell(B,c,r){
  const G=B.grid;if(c<0||r<0||c>=G.cols||r>=G.rows)return false;
  const i=r*G.cols+c;let v=G.cell[i];
  if(v<0)v=G.cell[i]=B.blocked(c*CELL+CELL/2,r*CELL+CELL/2,PROBE)?0:1;
  return v===1;
 }
 const cellOf=v=>Math.floor(v/CELL),centre=c=>c*CELL+CELL/2;
 function nearestWalk(B,x,y,maxR=10){
  const c0=cellOf(x),r0=cellOf(y);
  if(walkCell(B,c0,r0))return {c:c0,r:r0};
  for(let k=1;k<=maxR;k++){
   let best=null,bd=Infinity;
   for(let dc=-k;dc<=k;dc++)for(let dr=-k;dr<=k;dr++){
    if(Math.max(Math.abs(dc),Math.abs(dr))!==k)continue;
    const c=c0+dc,r=r0+dr;if(!walkCell(B,c,r))continue;
    const d=Math.hypot(centre(c)-x,centre(r)-y);if(d<bd){bd=d;best={c,r};}
   }
   if(best)return best;
  }
  return null;
 }
 /* a point a man can stand on: where it is, or the middle of the nearest open cell */
 function snapWalk(B,x,y){
  if(!B.blocked(x,y,12))return {x,y};
  const n=nearestWalk(B,x,y);return n?{x:centre(n.c),y:centre(n.r)}:{x,y};
 }
 /* sight along the ground: every half cell of the line open */
 function los(B,a,b){
  const d=dist(a,b),n=Math.ceil(d/(CELL/2));
  for(let i=1;i<n;i++){const t=i/n;if(!walkCell(B,cellOf(a.x+(b.x-a.x)*t),cellOf(a.y+(b.y-a.y)*t)))return false;}
  return true;
 }
 /* A* over the grid, eight ways round (no corner cut), smoothed by line of sight; the start point itself is left out */
 function findPath(B,x0,y0,x1,y1){
  const s=nearestWalk(B,x0,y0),g=nearestWalk(B,x1,y1);if(!s||!g)return null;
  const G=B.grid,cols=G.cols,A=B.astar,start=s.r*cols+s.c,goal=g.r*cols+g.c;
  const end=B.blocked(x1,y1,12)?{x:centre(g.c),y:centre(g.r)}:{x:x1,y:y1};
  if(start===goal)return [end];
  A.gen++;if(A.gen>4e9){A.gen=1;A.seen.fill(0);A.shut.fill(0);}
  const gen=A.gen,h=(c,r)=>{const dx=Math.abs(c-g.c),dy=Math.abs(r-g.r);return (dx+dy+(Math.SQRT2-2)*Math.min(dx,dy));};
  const heapI=[],heapF=[];
  const push=(i,f)=>{let k=heapI.length;heapI.push(i);heapF.push(f);while(k>0){const p=(k-1)>>1;if(heapF[p]<=f)break;heapI[k]=heapI[p];heapF[k]=heapF[p];k=p;}heapI[k]=i;heapF[k]=f;};
  const pop=()=>{const top=heapI[0],li=heapI.pop(),lf=heapF.pop();if(heapI.length){let k=0;const n=heapI.length;for(;;){let c=2*k+1;if(c>=n)break;if(c+1<n&&heapF[c+1]<heapF[c])c++;if(heapF[c]>=lf)break;heapI[k]=heapI[c];heapF[k]=heapF[c];k=c;}heapI[k]=li;heapF[k]=lf;}return top;};
  A.seen[start]=gen;A.g[start]=0;A.from[start]=-1;push(start,h(s.c,s.r));
  let found=false,count=0;
  while(heapI.length){
   const i=pop();if(A.shut[i]===gen)continue;A.shut[i]=gen;
   if(i===goal){found=true;break;}
   if(++count>60000)break;
   const c=i%cols,r=(i-c)/cols,gi=A.g[i];
   for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){
    if(!dc&&!dr)continue;const nc=c+dc,nr=r+dr;
    if(!walkCell(B,nc,nr))continue;
    if(dc&&dr&&(!walkCell(B,c+dc,r)||!walkCell(B,c,r+dr)))continue;   /* never round a corner through it */
    const j=nr*cols+nc;if(A.shut[j]===gen)continue;
    const ng=gi+(dc&&dr?Math.SQRT2:1);
    if(A.seen[j]!==gen||ng<A.g[j]){A.seen[j]=gen;A.g[j]=ng;A.from[j]=i;push(j,ng+h(nc,nr));}
   }
  }
  if(!found)return null;
  const cells=[];for(let i=goal;i!==-1;i=A.from[i])cells.push(i);cells.reverse();
  const pts=cells.map(i=>{const c=i%cols;return {x:centre(c),y:centre((i-c)/cols)};});
  pts[0]={x:x0,y:y0};pts[pts.length-1]=end;
  const out=[];let i=0;
  while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!los(B,pts[i],pts[j]))j--;out.push(pts[j]);i=j;}
  return out;
 }
 /* a man joins a path the body walks: from the farthest point of it he can see, or by a way of his own */
 function joinPath(B,u,path,slot){
  if(!path||!path.length)return [slot];
  for(let k=path.length-1;k>=0;k--)if(los(B,u,path[k]))return [...path.slice(k,-1),slot];
  const own=findPath(B,u.x,u.y,slot.x,slot.y);return own||[slot];
 }

 /* ---------------------------------------------------------------- formations */
 /* rank and file about (x,y), the front rank on the point, facing (fx,fy) */
 function formation(B,n,x,y,fx,fy,width){
  const L=Math.hypot(fx,fy)||1;fx/=L;fy/=L;const px=-fy,py=fx;
  const w=Math.max(1,width||Math.ceil(Math.sqrt(n*1.8))),out=[];
  for(let i=0;i<n;i++){const row=Math.floor(i/w),inRow=Math.min(w,n-row*w),col=i%w-(inRow-1)/2;
   out.push(snapWalk(B,x+px*col*GAP-fx*row*GAP,y+py*col*GAP-fy*row*GAP));}
  return out;
 }
 /* front men to the front rank, and left to left: no one crosses the body to get to his place */
 function assignSlots(units,slots,fx,fy){
  const L=Math.hypot(fx,fy)||1;fx/=L;fy/=L;const px=-fy,py=fx,w=Math.max(1,Math.ceil(Math.sqrt(slots.length*1.8)));
  const us=units.slice().sort((a,b)=>(b.x*fx+b.y*fy)-(a.x*fx+a.y*fy)),ss=slots.map((s,i)=>({s,i}));
  for(let r0=0;r0<us.length;r0+=w){
   const row=us.slice(r0,r0+w).sort((a,b)=>(a.x*px+a.y*py)-(b.x*px+b.y*py));
   const rs=ss.slice(r0,r0+w).sort((a,b)=>(a.s.x*px+a.s.y*py)-(b.s.x*px+b.s.y*py));
   row.forEach((u,k)=>{u.slot=rs[k].s;});
  }
 }
 const centroid=us=>{let x=0,y=0;for(const u of us){x+=u.x;y+=u.y;}return us.length?{x:x/us.length,y:y/us.length}:{x:0,y:0};};
 const strengthOf=us=>us.reduce((t,u)=>t+(u.alive?u.hp*((u.dmg+u.arrow*ARROW_HIT/VOLLEY*u.cd)/u.cd):0),0);

 /* ---------------------------------------------------------------- the battle */
 function create(opt){
  const w=opt.w,h=opt.h,cols=Math.ceil(w/CELL),rows=Math.ceil(h/CELL),n=cols*rows;
  const B={w,h,blocked:opt.blocked,rng:opt.rng||Math.random,stage:opt.stage,arrival:opt.arrival||opt.stage,t:0,seq:0,aiT:0,assault:null,assaultCool:ASSAULT_FIRST,assaultSeq:0,lastStand:!!opt.lastStand,
   grid:{cols,rows,cell:new Int8Array(n).fill(-1)},
   astar:{g:new Float32Array(n),from:new Int32Array(n),seen:new Uint32Array(n),shut:new Uint32Array(n),gen:0},
   units:[],ours:[],theirs:[],squads:[],arrows:[],events:[],over:false,pathQueue:[],
   buildings:(opt.buildings||[]).map(b=>({...b,front:null,burn:0,fire:false,razed:!!b.razed,burners:0,contested:false,defenders:[]}))};
  for(const b of B.buildings)b.front=snapWalk(B,b.front?b.front.x:b.x,b.front?b.front.y:b.y+(b.r||40)*.3+44);
  const make=(o,side)=>{const st=statsOf(o.kind,o.p),at=snapWalk(B,o.x,o.y);o.x=at.x;o.y=at.y;   /* nobody starts in the water or a wall */
   return Object.assign(o,{id:++B.seq,side,r:12,hp:st.hp,max:st.hp,dmg:st.dmg,cd:st.cd,cdT:B.rng()*st.cd,arrow:st.arrow,
    speed:SPEED[o.kind]||92,state:'idle',path:null,pi:0,slot:null,hold:{x:o.x,y:o.y},target:null,order:null,
    fx:o.fx||-1,walk:o.walk||0,moving:false,alive:true,down:0,fade:null,sel:false,hitBy:null,hitT:0,deadT:0,wounded:false,shootAt:null});};
  for(const o of opt.ours||[]){const u=make(o,'us');B.units.push(u);B.ours.push(u);}
  for(const o of opt.theirs||[]){const u=make(o,'them');if(u.kind!=='archer')u.dmg*=DRILLED;B.units.push(u);B.theirs.push(u);}
  (opt.squads||[]).forEach((s,i)=>{
   const S={id:i,anchor:snapWalk(B,s.x,s.y),face:{x:s.fx,y:s.fy},post:null,state:'muster',defend:null,volleyT:1+B.rng()*2,units:[],initial:0,waitT:0};
   S.post=S.home=S.anchor;B.squads.push(S);
  });
  for(const u of B.theirs){const S=B.squads[u.squad]||B.squads[0];if(S){u.squad=S;S.units.push(u);}else u.squad=null;}
  for(const S of B.squads){S.initial=S.units.length;reform(B,S,S.anchor,S.face,true);}
  if(B.ours.length)order(B,B.ours,{type:'move',x:B.stage.x,y:B.stage.y,fx:B.stage.x-B.arrival.x,fy:B.stage.y-B.arrival.y},true);   /* up the pier to its head */
  return B;
 }
 /* the garrison's ranks: shields in front two deep, the archers behind them */
 function reform(B,S,at,face,muster){
  const al=S.units.filter(u=>u.alive),mel=al.filter(u=>u.kind!=='archer'),bows=al.filter(u=>u.kind==='archer');
  const L=Math.hypot(face.x,face.y)||1,fx=face.x/L,fy=face.y/L;
  const ms=formation(B,mel.length,at.x,at.y,fx,fy,Math.max(1,Math.ceil(mel.length/2)));
  assignSlots(mel,ms,fx,fy);
  const back=mel.length?Math.ceil(mel.length/Math.max(1,Math.ceil(mel.length/2)))*GAP+50:0;
  const bs=formation(B,bows.length,at.x-fx*back,at.y-fy*back,fx,fy,Math.max(1,bows.length));
  assignSlots(bows,bs,fx,fy);
  for(const u of al){u.hold={...u.slot};u.path=null;u.pi=0;u.settled=false;u.pathFor=u.slot;if(!u.queued){u.queued=true;B.pathQueue.push(u);}if(!muster)u.target=null;}
  S.reformAt=B.t;
 }

 /* ---------------------------------------------------------------- orders (ours) */
 function order(B,units,cmd,quiet){
  units=units.filter(u=>u.alive&&u.side==='us');if(!units.length||B.over)return false;
  const c=centroid(units);
  if(cmd.type==='attack'){
   if(!cmd.target||!cmd.target.alive)return false;
   for(const u of units){u.order={type:'attack',target:cmd.target};u.target=cmd.target;u.path=null;u.state='fight';u.settled=false;}
   return true;
  }
  if(cmd.type==='hunt'){   /* every man at the foe nearest him - no more than a few on one - and on to the next when he falls */
   if(!B.theirs.some(f=>f.alive))return false;
   for(const u of units){u.order={type:'hunt'};u.target=null;u.path=null;u.state='fight';u.settled=false;}
   for(const u of units)u.target=prey(B,u);
   if(!quiet)B.events.push({type:'order',kind:'hunt',x:c.x,y:c.y,n:units.length});
   return true;
  }
  let to,fx,fy;
  if(cmd.type==='burn'){
   const b=cmd.building;if(!b||b.razed)return false;to=b.front;fx=b.x-b.front.x;fy=b.y-b.front.y;
  }else{to=snapWalk(B,cmd.x,cmd.y);fx=cmd.fx;fy=cmd.fy;}
  const path=findPath(B,c.x,c.y,to.x,to.y);if(!path)return false;
  if(fx==null||(!fx&&!fy)){const last=path.length>1?path[path.length-2]:c;fx=to.x-last.x;fy=to.y-last.y;if(!fx&&!fy){fx=to.x-c.x;fy=to.y-c.y;}}
  let slots;
  if(cmd.type==='burn'){   /* half-rings before the door, one behind the other, a man's room apart (they shook when packed) */
   const b=cmd.building;slots=[];
   for(let k=0;slots.length<units.length;k++){const r=70+k*GAP,n=Math.max(3,Math.floor(Math.PI*.8*r*.95/GAP));
    for(let j=0;j<n&&slots.length<units.length;j++){const a=Math.PI*(.1+.8*(n>1?j/(n-1):.5));slots.push(snapWalk(B,b.front.x+Math.cos(a)*r*1.25,b.front.y+Math.sin(a)*r*.62+14));}}
   const fl=units.slice().sort((p,q)=>dist(p,b.front)-dist(q,b.front));fl.forEach((u,i)=>{u.slot=slots[i];});
  }else{slots=formation(B,units.length,to.x,to.y,fx,fy);assignSlots(units,slots,fx,fy);}
  for(const u of units){
   u.order=cmd.type==='burn'?{type:'burn',b:cmd.building}:{type:'move'};u.target=null;u.state='move';u.settled=false;
   u.hold={...u.slot};u.path=joinPath(B,u,path,u.slot);u.pi=0;
  }
  if(!quiet)B.events.push({type:'order',kind:cmd.type,x:to.x,y:to.y,n:units.length});
  return true;
 }
 /* the foe for a hunting man: the nearest, unless a few of ours are on him already and another is not much farther */
 function prey(B,u){
  const load=new Map();for(const o of B.ours)if(o.alive&&o!==u&&o.target&&o.target.alive)load.set(o.target,(load.get(o.target)||0)+1);
  let best=null,bs=Infinity;
  for(const f of B.theirs){if(!f.alive)continue;const s=dist(u,f)+((load.get(f)||0)>=HUNT_LOAD?400:0);if(s<bs){bs=s;best=f;}}
  return best;
 }
 function select(B,units,add){if(!add)for(const u of B.ours)u.sel=false;for(const u of units)if(u.alive&&u.side==='us')u.sel=true;}
 const selected=B=>B.ours.filter(u=>u.sel&&u.alive);
 function inBox(B,x0,y0,x1,y1){const ax=Math.min(x0,x1),bx=Math.max(x0,x1),ay=Math.min(y0,y1),by=Math.max(y0,y1);
  return B.ours.filter(u=>u.alive&&u.x>=ax-12&&u.x<=bx+12&&u.y-22>=ay-26&&u.y-22<=by+26);}
 function unitAt(B,x,y,side){let best=null,bd=Infinity;
  for(const u of side==='us'?B.ours:B.theirs){if(!u.alive)continue;if(Math.abs(x-u.x)>20||y<u.y-56||y>u.y+14)continue;const d=Math.hypot(x-u.x,y-(u.y-22));if(d<bd){bd=d;best=u;}}
  return best;}
 const alive=(B,side)=>(side==='us'?B.ours:B.theirs).filter(u=>u.alive);
 /* 🏳 the men go aboard: every one of ours to the ship, and the garrison lets them go */
 function sound(B){
  if(B.over)return;B.over=true;B.assault=null;for(const S of B.squads)S.attack=null;
  const ship=snapWalk(B,B.arrival.x,B.arrival.y);B.boardAt=B.t;
  for(const u of B.ours)if(u.alive){u.order={type:'board'};u.target=null;u.sel=false;u.settled=false;u.hold={...ship};const p=findPath(B,u.x,u.y,ship.x,ship.y);u.path=p||[ship];u.pi=0;}
  for(const S of B.squads){S.defend=null;S.state='regroup';reform(B,S,S.anchor,S.face);}
 }

 /* ---------------------------------------------------------------- the clock */
 function tick(B,dt){
  if(dt<=0)return;
  B.t+=dt;
  for(let k=0;k<PATHS_PER_TICK&&B.pathQueue.length;k++){   /* the garrison's ways to its ranks, a few a frame */
   const u=B.pathQueue.shift();u.queued=false;if(!u.alive||u.pathFor!==u.slot)continue;
   u.path=findPath(B,u.x,u.y,u.slot.x,u.slot.y)||[u.slot];u.pi=0;
  }
  bucket(B);
  B.aiT-=dt;if(B.aiT<=0){B.aiT=THINK;defence(B);offense(B);for(const S of B.squads)think(B,S);}
  for(const u of B.units){
   if(!u.alive){u.deadT+=dt;if(u.side==='them'){u.down=Math.min(1,u.deadT*3);u.fade=Math.max(0,1-Math.max(0,u.deadT-1.8)/1.2);}continue;}
   u.cdT-=dt;u.hitT-=dt;
   if(u.side==='us')ourMan(B,u,dt);else theirMan(B,u,dt);
  }
  apart(B,dt);
  arrows(B,dt);
  burning(B,dt);
 }
 /* who is near whom: a hash of 120-unit buckets, rebuilt each tick */
 function bucket(B){
  const m=new Map();for(const u of B.units){if(!u.alive)continue;const k=Math.floor(u.x/120)+','+Math.floor(u.y/120);let a=m.get(k);if(!a)m.set(k,a=[]);a.push(u);}
  B.bk=m;
 }
 function near(B,p,R,side){
  const out=[],c0=Math.floor((p.x-R)/120),c1=Math.floor((p.x+R)/120),r0=Math.floor((p.y-R)/120),r1=Math.floor((p.y+R)/120);
  for(let c=c0;c<=c1;c++)for(let r=r0;r<=r1;r++){const a=B.bk.get(c+','+r);if(!a)continue;for(const u of a)if((!side||u.side===side)&&u.alive&&dist(u,p)<=R)out.push(u);}
  return out;
 }
 const foeSide=u=>u.side==='us'?'them':'us';
 function nearestFoe(B,u,R){
  let best=null,bd=Infinity;
  for(const f of near(B,u,R,foeSide(u))){const d=dist(u,f)-(f===u.hitBy?60:0);if(d<bd){bd=d;best=f;}}
  return best;
 }
 /* a step toward (x,y) on open ground, sliding along whatever is in the way */
 function stepTo(B,u,x,y,dt,sp){
  const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);
  if(d<1.5){u.moving=false;return d;}
  const s=Math.min(d,sp*dt),ux=dx/d,uy=dy/d;
  if(Math.abs(dx)>1)u.fx=dx>0?1:-1;
  for(const [ax,ay] of [[ux,uy],[ux*.6-uy*.8,uy*.6+ux*.8],[ux*.6+uy*.8,uy*.6-ux*.8],[-uy,ux],[uy,-ux]]){
   const nx=u.x+ax*s,ny=u.y+ay*s;
   if(!B.blocked(nx,ny,u.r)){u.x=nx;u.y=ny;u.moving=true;u.walk+=dt*sp/45;return d;}
  }
  u.moving=false;return d;
 }
 function follow(B,u,dt,sp){   /* along his path, then to his place in the ranks; true while still walking */
  if(u.path&&u.pi<u.path.length){const p=u.path[u.pi];if(stepTo(B,u,p.x,p.y,dt,sp)<12)u.pi++;u.settled=false;return true;}
  const d=dist(u,u.hold);
  if(u.settled&&d<18){u.moving=false;return false;}   /* there: a nudge from the man beside him is not a reason to walk */
  if(d>6){stepTo(B,u,u.hold.x,u.hold.y,dt,sp*.8);if(dist(u,u.hold)>6)return true;}
  u.settled=true;u.moving=false;return false;
 }
 function chase(B,u,T,dt){
  if(dist(u,T)>260){   /* far: by the streets */
   if(!u.chasePath||u.chaseFor!==T||B.t>u.chaseAt){u.chasePath=findPath(B,u.x,u.y,T.x,T.y)||[{x:T.x,y:T.y}];u.chaseFor=T;u.chaseAt=B.t+1;u.chaseI=0;}
   const p=u.chasePath[Math.min(u.chaseI,u.chasePath.length-1)];if(stepTo(B,u,p.x,p.y,dt,u.speed)<12)u.chaseI++;
  }else stepTo(B,u,T.x,T.y,dt,u.speed);
 }
 function strike(B,u,T){
  const dmg=u.dmg*(.85+.3*B.rng());
  hurt(B,T,dmg,u);u.strikeT=B.t;
  B.events.push({type:'hit',x:(u.x+T.x)/2,y:(u.y+T.y)/2-26,side:u.side,by:u});
 }
 function hurt(B,T,dmg,by){
  if(!T.alive)return;
  if(T.side==='them'&&T.kind!=='archer'&&!T.wounded&&T.squad&&(T.squad.state==='hold'||T.squad.state==='ready'||dist(T,T.hold)<60))dmg*=WALL;   /* in the line, shields up */
  T.hp-=dmg;T.hitBy=by;T.hitT=1.5;
  if(T.hp<=0){T.hp=0;T.alive=false;T.state=T.side==='us'?'down':'dead';T.deadT=0;T.target=null;T.sel=false;T.moving=false;
   B.events.push({type:T.side==='us'?'down':'dead',unit:T,x:T.x,y:T.y});}
 }
 function melee(B,u,T,dt){   /* close and strike - true while fighting */
  const reach=u.r+T.r+18+(u.close===T?12:0),d=dist(u,T);
  u.settled=false;
  if(d>reach){u.close=null;chase(B,u,T,dt);return true;}
  u.close=T;
  u.moving=false;if(Math.abs(T.x-u.x)>1)u.fx=T.x>u.x?1:-1;
  if(u.cdT<=0){strike(B,u,T);u.cdT=u.cd*(.9+.2*B.rng());}
  return true;
 }

 /* our men: what they were told, and a fight when one comes to them */
 function ourMan(B,u,dt){
  if(u.order&&u.order.type==='board'){   /* up the gangway: near the ship is aboard - on a crowded pier not every man reaches the one plank - and
    after half a minute the last stragglers are taken off wherever they stand, so the ship never waits for ever */
   follow(B,u,dt,u.speed*1.1);
   if(dist(u,B.arrival)<80||B.t-(B.boardAt||B.t)>30||!u.moving&&!(u.path&&u.pi<u.path.length)&&dist(u,B.arrival)<240)u.boarded=(u.boarded||0)+dt;
   return;}
  if(u.order&&u.order.type==='attack'&&!u.order.target.alive){u.order=null;u.hold={x:u.x,y:u.y};}
  let T=u.target;if(T&&!T.alive)T=u.target=null;
  if(u.order&&u.order.type==='attack')T=u.target=u.order.target;
  if(u.order&&u.order.type==='hunt'){if(!T){T=u.target=prey(B,u);if(!T){u.order=null;u.hold={x:u.x,y:u.y};u.state='idle';}}if(T){u.state='fight';melee(B,u,T,dt);return;}}
  if(!T){
   const R=u.state==='move'&&u.path&&u.pi<u.path.length?AGGRO_MOVE:u.order&&u.order.type==='burn'?AGGRO_BURN:AGGRO_IDLE;
   T=u.target=nearestFoe(B,u,R);
  }
  if(T){
   const ordered=u.order&&u.order.type==='attack';
   if(!ordered&&dist(T,u.hold)>CHASE_LEASH+(u.state==='move'?400:0)){u.target=null;}   /* not so far from where he was put */
   else{u.state='fight';melee(B,u,T,dt);return;}
  }
  if(follow(B,u,dt,u.speed)){u.state='move';return;}
  if(u.order&&u.order.type==='burn'&&!u.order.b.razed){u.state='burn';const b=u.order.b;u.fx=b.x>u.x?1:-1;}
  else{if(u.order&&u.order.type==='burn')u.order=null;u.state='idle';}
 }
 /* the garrison's men: their squad says where to stand and whom to fight; the wounded go behind the line */
 function theirMan(B,u,dt){
  const S=u.squad;
  if(u.kind==='archer'){archer(B,u,dt);return;}
  if(u.wounded&&S&&(S.state==='fight'||S.state==='hold'||S.state==='ready')){   /* badly hurt: back behind the line, out of the press */
   const back=S.rear||S.anchor;u.target=null;u.close=null;u.settled=false;
   if(dist(u,back)>30){const x0=u.x,y0=u.y;stepTo(B,u,back.x,back.y,dt,u.speed*.85);if(Math.hypot(u.x-x0,u.y-y0)>.1)return;}
   const close=nearestFoe(B,u,40);if(close){melee(B,u,close,dt);return;}   /* nowhere left to go: he fights whoever reaches him */
   u.moving=false;return;
  }
  let T=u.target;if(T&&!T.alive)T=u.target=null;
  if(!T&&u.hitBy&&u.hitBy.alive&&u.hitT>0&&S&&dist(u.hitBy,S.post)<LEASH)T=u.target=u.hitBy;   /* struck: strike back */
  if(T){
   if(S&&!B.over&&dist(T,S.post)>LEASH+120){u.target=null;}   /* never chased far from where the squad stands */
   else if(!B.over){melee(B,u,T,dt);return;}
  }
  follow(B,u,dt,u.speed);
  if(!u.moving&&S){const f=S.face;if(Math.abs(f.x)>.2)u.fx=f.x>0?1:-1;}
 }
 function archer(B,u,dt){
  const S=u.squad;
  if(!B.over){
   const threat=nearestFoe(B,u,KITE);
   if(threat){   /* too close: back off along the line he came, or fight if there is nowhere to go */
    const L=dist(u,threat)||1,ax=(u.x-threat.x)/L,ay=(u.y-threat.y)/L,tx=u.x+ax*60,ty=u.y+ay*60;
    if(!B.blocked(tx,ty,u.r)&&(!S||dist({x:tx,y:ty},S.post)<LEASH)){stepTo(B,u,tx,ty,dt,u.speed);return;}
    if(dist(u,threat)<u.r+threat.r+20){melee(B,u,threat,dt);return;}
   }
   if(u.shootAt!=null&&B.t>=u.shootAt){u.shootAt=null;const m=u.mark&&u.mark.alive&&dist(u,u.mark)<=ARROW_RANGE?u.mark:aim(B,u);if(m)loose(B,u,m);}
  }
  follow(B,u,dt,u.speed);
  if(!u.moving&&S){const f=S.face;if(Math.abs(f.x)>.2)u.fx=f.x>0?1:-1;}
 }
 /* the archer's mark: the men firing a house first, then the wounded, the ones standing alone, the nearest */
 function aim(B,u,at){
  let best=null,bs=Infinity;
  for(const c of near(B,u,ARROW_RANGE,'us')){
   const d=dist(u,c);if(d<ARROW_MIN)continue;
   const s=d*.5+150*(c.hp/c.max)+30*near(B,c,110,'us').length-(c.state==='burn'?300:0)-(at&&c.order&&c.order.b===at?200:0);
   if(s<bs){bs=s;best=c;}
  }
  return best;
 }
 function loose(B,u,T){
  const d=dist(u,T),still=!T.moving;
  B.arrows.push({x0:u.x,y0:u.y-34,x1:T.x+(B.rng()-.5)*12,y1:T.y-20+(B.rng()-.5)*8,t:0,dur:d/ARROW_SPEED+.15,target:T,dmg:u.arrow*(.85+.3*B.rng()),hit:B.rng()<ARROW_HIT+(still?.08:0),by:u});
  if(Math.abs(T.x-u.x)>1)u.fx=T.x>u.x?1:-1;
  B.events.push({type:'shoot',x:u.x,y:u.y-34,by:u});
 }
 function arrows(B,dt){
  for(let i=B.arrows.length-1;i>=0;i--){const a=B.arrows[i];a.t+=dt;if(a.t<a.dur)continue;B.arrows.splice(i,1);
   if(a.hit&&a.target.alive&&Math.hypot(a.target.x-a.x1,a.target.y-20-a.y1)<44){hurt(B,a.target,a.dmg,a.by);B.events.push({type:'arrowHit',x:a.target.x,y:a.target.y-24});}
   else B.events.push({type:'arrowMiss',x:a.x1,y:a.y1+18});}
 }
 /* men do not stand in one another */
 function apart(B,dt){
  for(const a of B.bk.values())for(let i=0;i<a.length;i++){const u=a[i];
   if(u.boarded)continue;
   for(const v of near(B,u,20)){if(v.id<=u.id||v.boarded)continue;const d=dist(u,v)||.01,min=u.settled&&v.settled?14:20;if(d>=min)continue;
    const push=(min-d)/2*Math.min(1,dt*6),ux=(u.x-v.x)/d,uy=(u.y-v.y)/d;
    if(!B.blocked(u.x+ux*push,u.y+uy*push,u.r)){u.x+=ux*push;u.y+=uy*push;}
    if(!B.blocked(v.x-ux*push,v.y-uy*push,v.r)){v.x-=ux*push;v.y-=uy*push;}}}
 }
 /* a house fires while enough of the men sent to it stand at its door and none of the garrison is near enough to stop them */
 function burning(B,dt){
  for(const b of B.buildings){
   if(b.razed)continue;
   const sent=B.ours.filter(u=>u.alive&&u.order&&u.order.type==='burn'&&u.order.b===b),at=sent.filter(u=>dist(u,b.front)<BURN_AT);
   b.burners=at.length;b.sent=sent.length;
   if(!at.length){b.contested=false;continue;}
   b.contested=near(B,b.front,BURN_CONTEST,'them').length>0;
   if(b.contested||at.length<Math.min(BURN_NEED,sent.length))continue;
   if(!b.fire){b.fire=true;B.events.push({type:'burnStart',b});}
   b.burn=Math.min(1,b.burn+dt/(b.time||BURN_TIME));   /* a seat's doors or a throne take longer than a house */
   if(b.burn>=1){b.razed=true;b.fire=false;B.events.push({type:'burned',b});for(const u of sent){u.order=null;u.state='idle';u.hold={x:u.x,y:u.y};}}
  }
 }

 /* ---------------------------------------------------------------- the garrison's mind */
 /* which squads go to a house being fired: the nearest that can, a second if the first is too weak to win alone */
 function defence(B){
  for(const S of B.squads)if(S.defend&&(S.defend.razed||!S.defend.sent||B.over)){
   const b=S.defend;S.defend=null;S.stand=null;
   if(!B.over&&S.units.some(u=>u.alive)&&dist(body0(S),S.anchor)>FALLBACK*1.5)fallBack(B,S,b.front);   /* far from its stand: it forms up here, not a walk back across the town */
  }
  if(B.over)return;
  for(const b of B.buildings){
   if(b.razed||!b.sent||!b.burners&&!b.fire)continue;
   const on=B.squads.filter(S=>S.defend===b),burners=B.ours.filter(u=>u.alive&&u.order&&u.order.type==='burn'&&u.order.b===b),need=strengthOf(burners);
   let have=on.reduce((t,S)=>t+strengthOf(S.units),0);
   const free=B.squads.filter(S=>!S.defend&&S.units.some(u=>u.alive)&&dist(body0(S),b.front)<DEFEND_R&&!(S.state==='fight'&&!S.attack&&near(B,S.post,ENGAGE,'us').length))
    .sort((a,c)=>dist(body0(a),b.front)-dist(body0(c),b.front));   /* whoever is nearest now - a squad out on an attack too */
   for(const S of free){if(have>=need*1.1)break;S.defend=b;S.attack=null;S.waitT=0;S.stand=null;on.push(S);have+=strengthOf(S.units);}
   for(const S of on)S.strong=B.lastStand||have>=need*.7;   /* together strong enough to go in - or only to hold the corner and shoot; a palace guard always goes in */
  }
 }
 /* ⚔ the garrison does not wait to be attacked (asked for 2026-10-03: "gör att vakterna attackerar även fast jag inte attackerar"):
    once it has mustered, and again after each attack has run its course, every squad that is not saving a house goes for the most
    exposed of our men - the ones standing alone or hurt - as one body: they gather a little short of them, and charge together
    while the archers loose. An attack ends when the men it went for are down, when it has lost two thirds of itself, or after
    ASSAULT_MAX seconds at it (ASSAULT_MARCH if they never get to them); then they fall back out of reach and form up, and come again. */
 function offense(B){
  if(B.over)return;
  const A=B.assault;
  if(A){
   const on=B.squads.filter(S=>S.attack===A),left=on.reduce((t,S)=>t+strengthOf(S.units),0);
   let T=A.unit;
   if(!T||!T.alive){T=A.unit=B.ours.filter(u=>u.alive&&dist(u,A.at)<380).sort((a,c)=>dist(a,A.at)-dist(c,A.at))[0]||null;}
   if(T)A.at={x:T.x,y:T.y};
   if(!on.length||!T||left<A.strength*.34||(A.contact?B.t-A.contact>ASSAULT_MAX:B.t-A.t0>ASSAULT_MARCH)){
    for(const S of on){S.attack=null;S.stand=null;if(S.state!=='gone'&&S.units.some(u=>u.alive))fallBack(B,S,A.at);}
    B.assault=null;B.assaultCool=ASSAULT_COOL*(.85+.3*B.rng());
   }
   return;
  }
  B.assaultCool-=THINK;if(B.assaultCool>0)return;
  if(B.squads.some(S=>S.state==='muster'&&S.units.some(u=>u.alive))&&B.t<40){B.assaultCool=1;return;}   /* the first goes in only when every squad has formed up: no one alone */
  const free=B.squads.filter(S=>!S.defend&&!S.attack&&S.state!=='muster'&&S.state!=='gone'&&S.units.filter(u=>u.alive).length>=3);
  const men=B.ours.filter(u=>u.alive&&!(u.order&&u.order.type==='board'));
  if(!free.length||!men.length){B.assaultCool=3;return;}
  const best=exposed(B,men,centroid(free.map(body0)));
  const A2={id:++B.assaultSeq,unit:best,at:{x:best.x,y:best.y},t0:B.t,contact:0,strength:free.reduce((t,S)=>t+strengthOf(S.units),0)};
  B.assault=A2;
  for(const S of free){S.attack=A2;S.stand=null;S.waitT=0;S.state='march';}
  B.events.push({type:'assault',x:best.x,y:best.y,n:free.reduce((t,S)=>t+S.units.filter(u=>u.alive).length,0)});
 }
 const exposed=(B,men,from)=>{let best=null,bs=Infinity;   /* the most exposed man: alone, or hurt, and not too far to reach */
  for(const u of men){const s=strengthOf(near(B,u,170,'us'))*(.5+.5*u.hp/u.max)+dist(u,from)*40;if(s<bs){bs=s;best=u;}}
  return best;};
 /* after a fight a squad falls back out of reach - FALLBACK from the men it fought, on the side it fought them from - and forms up
    there to come again; home to its stand only if that is nearer. Not a walk back across the town while the fight goes on. */
 function fallBack(B,S,from){
  const body=body0(S),home=S.home||S.anchor;let at=home;
  if(dist(home,from)>FALLBACK){const d=dist(body,from)>60?body:home,L=dist(d,from)||1;at=snapWalk(B,from.x+(d.x-from.x)/L*FALLBACK,from.y+(d.y-from.y)/L*FALLBACK);}
  const f={x:from.x-at.x,y:from.y-at.y};
  S.anchor=at;S.post=at;S.state='regroup';if(Math.hypot(f.x,f.y)>1)S.face=f;reform(B,S,at,S.face);
 }
 function think(B,S){
  const al=S.units.filter(u=>u.alive);if(!al.length){S.state='gone';S.attack=S.defend=null;return;}
  if(B.over){if(S.state!=='regroup'){S.state='regroup';reform(B,S,S.anchor,S.face);}S.post=S.anchor;return;}
  const mel=al.filter(u=>u.kind!=='archer'),bows=al.filter(u=>u.kind==='archer');
  for(const u of mel)u.wounded=u.hp<u.max*WOUNDED;
  /* archers whose shields have all fallen go behind another squad's - an archer left alone is a dead one */
  if(!mel.length&&bows.length){const me=body0(S),o=B.squads.filter(T=>T!==S&&T.units.some(u=>u.alive&&u.kind!=='archer')).sort((a,c)=>dist(body0(a),me)-dist(body0(c),me))[0];
   if(o){for(const u of al){u.squad=o;o.units.push(u);}S.units=[];S.state='gone';S.attack=S.defend=null;reform(B,o,o.post||o.anchor,o.face);return;}}
  /* a squad worn down to a few joins the nearest that still stands */
  if(al.length<=2&&S.initial>3){const me=body0(S),o=B.squads.filter(T=>T!==S&&T.units.filter(u=>u.alive).length>2).sort((a,c)=>dist(body0(a),me)-dist(body0(c),me))[0];
   if(o){for(const u of al){u.squad=o;o.units.push(u);}S.units=[];S.state='gone';S.attack=S.defend=null;reform(B,o,o.post||o.anchor,o.face);return;}}
  const body=centroid(mel.length?mel:al);
  if(S.defend){
   /* march as a body to a corner short of the door (out of reach if they can only harass), wait there for the others, then go in
      together - or, too weak to win, hold that corner with shields up while the archers shoot the men with the torches */
   const b=S.defend,others=B.squads.filter(T=>T.defend===b&&T!==S);
   if(!S.stand){S.stand=towards(B,b.front,body,S.strong?230:340);S.state='march';S.post=S.stand;S.face={x:b.front.x-S.stand.x,y:b.front.y-S.stand.y};reform(B,S,S.stand,S.face);return;}
   const there=al.filter(u=>dist(u,u.hold)<70).length>=al.length*.7;
   if(S.state==='march'&&!there)return;
   if(S.state==='march')S.state='ready';
   const threat=near(B,S.stand,ENGAGE,'us');
   if(S.strong){
    const ready=others.every(T=>T.state==='ready'||T.state==='fight');
    if(S.state!=='fight'&&!ready&&S.waitT<6&&b.burn<.5){S.waitT+=THINK;volley(B,S,bows,b);if(!threat.length)return;}
    S.state='fight';S.post=b.front;fight(B,S,mel,bows,near(B,b.front,420,'us').concat(threat),b);return;
   }
   if(threat.length){S.state='fight';fight(B,S,mel,bows,threat,b);return;}
   S.state='ready';for(const u of mel)u.target=null;volley(B,S,bows,b);return;
  }
  if(S.attack){
   const A=S.attack,others=B.squads.filter(T=>T!==S&&T.attack===A),at=A.at;
   if(S.state==='march'||S.state==='ready'){
    if(!S.stand||dist(S.stand,at)>ASSAULT_STAND+160){S.stand=towards(B,at,body,ASSAULT_STAND);S.post=S.stand;S.face={x:at.x-S.stand.x,y:at.y-S.stand.y};S.state='march';
     S.waitT=-dist(body,S.stand)/90;reform(B,S,S.stand,S.face);return;}   /* the wait for stragglers starts when they should all be there */
    const there=al.filter(u=>dist(u,u.hold)<80).length>=al.length*.7;
    S.waitT+=THINK;
    if(!there&&S.waitT<12){volley(B,S,bows);if(!near(B,body,ENGAGE*.6,'us').length)return;}
    S.state='ready';
    const ready=others.every(T=>T.state==='ready'||T.state==='charge');
    if(!ready&&S.waitT<14&&!near(B,body,ENGAGE*.6,'us').length){volley(B,S,bows);return;}
    S.state='charge';
   }
   S.post=at;
   const met=near(B,body,ENGAGE,'us');
   if(!met.length&&dist(body,at)>ASSAULT_STAND+240){S.state='march';S.stand=null;return;}   /* the men they went for have moved on: after them */
   if(met.length&&!A.contact)A.contact=B.t;   /* the clock of the fight itself starts at the first blow */
   fight(B,S,mel,bows,near(B,at,450,'us').concat(near(B,body,260,'us')));return;
  }
  const close=near(B,S.post,WATCH_R,'us');
  if(close.length){
   const nearest=Math.min(...close.map(c=>Math.min(...(mel.length?mel:al).map(u=>dist(u,c)))));
   const face={x:centroid(close).x-S.post.x,y:centroid(close).y-S.post.y};
   if(nearest<ENGAGE||strengthOf(close)<strengthOf(al)*.8){S.state='fight';fight(B,S,mel,bows,near(B,S.post,LEASH,'us'));return;}
   /* they come in strength: hold the line and let the archers work */
   if(S.state!=='hold'||angle(S.face,face)>.7&&B.t-(S.reformAt||0)>2){S.state='hold';S.face=face;reform(B,S,S.post,face);}   /* turn to face them, not every time they shift */
   for(const u of mel)u.target=null;
   volley(B,S,bows);return;
  }
  if(S.state==='fight'||S.state==='march'||S.state==='ready'||S.state==='hold'&&dist(S.post,S.anchor)>40){S.state='regroup';S.post=S.anchor;reform(B,S,S.anchor,S.face);}
  if(S.state==='regroup'&&al.every(u=>dist(u,u.hold)<30))S.state='hold';
  if(S.state==='muster'&&al.every(u=>dist(u,u.hold)<40))S.state='hold';
 }
 const body0=S=>centroid(S.units.filter(u=>u.alive));
 const angle=(a,b)=>{const la=Math.hypot(a.x,a.y)||1,lb=Math.hypot(b.x,b.y)||1;return Math.acos(clamp((a.x*b.x+a.y*b.y)/la/lb,-1,1));};
 function towards(B,to,from,back){   /* a standing place `back` short of a point, on the side the squad comes from */
  const L=dist(to,from)||1;return snapWalk(B,to.x+(from.x-to.x)/L*Math.min(back,L),to.y+(from.y-to.y)/L*Math.min(back,L));
 }
 /* the fight: every sound man a mark of his own - the wounded and the lone first, never more than two on one - the wounded
    behind the line, and the archers loosing together */
 function fight(B,S,mel,bows,cands,at){
  const live=cands.filter(c=>c.alive),load=new Map();
  const mc=centroid(mel.length?mel:S.units.filter(u=>u.alive)),tc=live.length?centroid(live):{x:mc.x+S.face.x,y:mc.y+S.face.y};
  const tl=Math.hypot(tc.x-mc.x,tc.y-mc.y)||1;   /* behind the line: away from the men they are fighting */
  S.rear=snapWalk(B,mc.x-(tc.x-mc.x)/tl*150,mc.y-(tc.y-mc.y)/tl*150);
  for(const u of mel){
   if(u.wounded){u.target=null;continue;}
   if(u.target&&u.target.alive&&dist(u,u.target)<u.r+u.target.r+30){load.set(u.target,(load.get(u.target)||0)+1);continue;}   /* already at it: stay at it */
   let best=null,bs=Infinity;
   for(const c of live){const d=dist(u,c);if(d>LEASH)continue;
    const s=d+140*(c.hp/c.max)+80*(load.get(c)||0)-(c.state==='burn'?160:0)+20*near(B,c,110,'us').length;
    if(s<bs){bs=s;best=c;}}
   u.target=best;if(best)load.set(best,(load.get(best)||0)+1);
  }
  volley(B,S,bows,at);
 }
 function volley(B,S,bows,at){   /* every bow of the squad at one man: a volley that drops him, not a scatter that grazes many */
  S.volleyT-=THINK;
  if(S.volleyT>0||!bows.length)return;
  const lead=bows.slice().sort((a,c)=>dist(a,S.post)-dist(c,S.post))[0],mark=aim(B,lead,at);
  if(!mark)return;
  for(const b of bows){b.mark=mark;b.shootAt=B.t+B.rng()*.6;}
  S.volleyT=VOLLEY*(.85+.3*B.rng());
 }

 /* more of the garrison, from a door of the town (the ruler's seat): men out of nowhere at `from`, a new squad standing at `at` facing
    (fx,fy) - they run there by the streets, and the squad's mind takes them from there */
 function reinforce(B,list,from,at,face,charge){
  const S={id:B.squads.length,anchor:snapWalk(B,at.x,at.y),face:{x:face.x,y:face.y},post:null,state:'muster',defend:null,volleyT:2+B.rng()*2,units:[],initial:0,waitT:0,fresh:true};
  S.post=S.home=S.anchor;B.squads.push(S);
  const door=snapWalk(B,from.x,from.y);
  list.forEach((o,i)=>{const st=statsOf(o.kind,o.p),p=snapWalk(B,door.x+((i%6)-2.5)*20,door.y+Math.floor(i/6)*20);
   const u=Object.assign(o,{x:p.x,y:p.y,id:++B.seq,side:'them',r:12,hp:st.hp,max:st.hp,dmg:st.dmg*(o.kind!=='archer'?DRILLED:1),cd:st.cd,cdT:B.rng()*st.cd,arrow:st.arrow,
    speed:(SPEED[o.kind]||92)*1.25,state:'idle',path:null,pi:0,slot:null,hold:{x:p.x,y:p.y},target:null,order:null,fx:o.fx||-1,walk:o.walk||0,moving:false,alive:true,down:0,fade:null,
    sel:false,hitBy:null,hitT:0,deadT:0,wounded:false,shootAt:null,squad:S});
   B.units.push(u);B.theirs.push(u);S.units.push(u);});
  S.initial=S.units.length;reform(B,S,S.anchor,S.face,true);
  if(charge)unleash(B,S);
  return S;
 }
 /* charge: they come straight for our men - into the attack under way, or one of their own - the backup runs down from the seat at
    them (2026-10-03), not to a stand by the harbour to wait there while the men burn the town round it */
 function unleash(B,S){
  if(B.over)return;
  let A=B.assault;
  if(!A){const men=B.ours.filter(u=>u.alive&&!(u.order&&u.order.type==='board'));if(!men.length)return;
   const best=exposed(B,men,body0(S));A=B.assault={id:++B.assaultSeq,unit:best,at:{x:best.x,y:best.y},t0:B.t,contact:0,strength:0};}
  A.strength+=strengthOf(S.units);S.attack=A;S.stand=null;S.waitT=0;S.state='march';
 }
 const CONST=Object.freeze({CELL,GAP,ARROW_RANGE,BURN_TIME,BURN_NEED,ENGAGE,LEASH,WOUNDED,VOLLEY,FALLBACK,ASSAULT_MAX,ASSAULT_MARCH});
 return Object.freeze({create,tick,order,select,selected,inBox,unitAt,alive,sound,reinforce,findPath,formation,statsOf,strengthOf,walkCell,CONST});
});
