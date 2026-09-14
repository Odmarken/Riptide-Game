/* Weapon effects share the art's UV profiles and the exact matrix used to draw it.
   Profiles are shipped with the art so file:// builds do not need canvas pixel reads. */
const runeNoise=n=>{const x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
const runeOf=it=>(it&&it.wench)?wenchById(it.wench):null;
const runeGlowCache=new WeakMap();
let runeFxDt=0;
const runeWorldEmission={carry:0,key:''};
function createRuneEmissionState(){return {carry:0,key:'',parts:[]};}
function resetRuneEmission(){runeFxDt=0;runeWorldEmission.carry=0;runeWorldEmission.key='';}
function runePointTransform(m,p){return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};}
function runeProfileFor(img){
 const name=decodeURIComponent((img.src||'').split(/[?#]/)[0]).split('/').pop().replace(/\.png$/i,'');
 return typeof WEAPON_RUNE_PROFILES!=='undefined'?WEAPON_RUNE_PROFILES[name]||null:null;
}
function runeGlowSprite(img,colour,gripFrac,sx,sw,tone=.12){
 if(!img||img.complete===false)return null;
 const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 if(!iw||!ih)return null;
 sx=sx||0;sw=sw||iw;
 const key=[img.src||'',colour,gripFrac,sx,sw,tone].join('|');
 let cache=runeGlowCache.get(img);if(!cache){cache=new Map();runeGlowCache.set(img,cache);}
 if(cache.has(key))return cache.get(key);
 const source=spriteEdgeSource(img);
 // Recolour the complete artwork independently of the glow's grip mask. Paint an
 // opaque colour layer, then restore the original alpha once, including thin strings.
 const art=document.createElement('canvas');art.height=Math.min(512,ih);
 art.width=Math.max(1,Math.round(art.height*sw/ih));
 const ink=art.getContext('2d');
 ink.drawImage(source,sx,0,sw,ih,0,0,art.width,art.height);
 ink.globalCompositeOperation='color';ink.fillStyle=colour;ink.fillRect(0,0,art.width,art.height);
 ink.globalCompositeOperation='multiply';ink.globalAlpha=tone;ink.fillRect(0,0,art.width,art.height);
 ink.globalCompositeOperation='destination-in';ink.globalAlpha=1;
 ink.drawImage(source,sx,0,sw,ih,0,0,art.width,art.height);
 const profile=runeProfileFor(img),H=Math.min(192,ih),W=Math.max(1,Math.round(H*sw/ih));
 const blur=Math.max(1,Math.min(H*.045,W*.24)),PAD=Math.ceil(blur*3);
 const sil=document.createElement('canvas');sil.width=W;sil.height=H;
 const s=sil.getContext('2d');s.drawImage(source,sx,0,sw,ih,0,0,W,H);
 s.globalCompositeOperation='source-in';s.fillStyle=colour;s.fillRect(0,0,W,H);
 // Only the glow fades at the hand grip; the base colour covers the complete weapon.
 if(profile&&profile.grip&&profile.grip[1]>0){
  const [cy,half]=profile.grip,edge=half*.45;
  s.globalCompositeOperation='destination-out';
  const fade=s.createLinearGradient(0,H*(cy-half-edge),0,H*(cy+half+edge));
  fade.addColorStop(0,'transparent');fade.addColorStop(.23,'#000');
  fade.addColorStop(.77,'#000');fade.addColorStop(1,'transparent');
  s.fillStyle=fade;s.fillRect(0,H*(cy-half-edge),W,H*(half+edge)*2);
 }else if(!profile&&gripFrac>0){
  s.globalCompositeOperation='destination-out';
  const fade=s.createLinearGradient(0,H*(1-gripFrac*1.6),0,H*(1-gripFrac*.35));
  fade.addColorStop(0,'transparent');fade.addColorStop(1,'#000');
  s.fillStyle=fade;s.fillRect(0,H*(1-gripFrac*1.6),W,H*gripFrac*1.6);
 }
 const out=document.createElement('canvas');out.width=W+PAD*2;out.height=H+PAD*2;
 const g=out.getContext('2d');
 g.filter='blur('+blur+'px)';g.globalAlpha=.40;g.drawImage(sil,PAD,PAD);
 g.filter='blur('+Math.max(.6,blur*.36)+'px)';g.globalAlpha=.54;g.drawImage(sil,PAD,PAD);
 g.filter='none';g.globalAlpha=.13;g.drawImage(sil,PAD,PAD);
 const result={cv:out,sil,art,padX:PAD/W,padY:PAD/H,profile,key};cache.set(key,result);return result;
}
function runeHalo(g,w,sp,x,y,W,H,time){
 if(!w||!sp)return;
 const t=time??performance.now()/1000;
 const pulse=w.id==='emberbite'?.78+.12*Math.sin(t*7.3)+.08*Math.sin(t*17.1):.85+.10*Math.sin(t*2.1);
 const px=sp.padX*W,py=sp.padY*H;
 g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=pulse*(w.id==='veinseeker'?.62:.80);
 // Padding expands the light without stretching the underlying silhouette off the steel.
 g.drawImage(sp.cv,x-px,y-py,W+px*2,H+py*2);g.restore();
}
function runeTint(g,w,sp,x,y,W,H){
 if(!w||!sp)return;
 // This replaces the original sprite. Overlaying both would leak the old hue
 // through semitransparent edges and make those edges too opaque.
 g.save();g.globalCompositeOperation='source-over';g.drawImage(sp.art,x,y,W,H);g.restore();
}
function runeUnder(g,w,img,x,y,W,H,gripFrac,sx,sw,time){
 if(!w)return null;
 const sp=runeGlowSprite(img,w.glow,gripFrac,sx,sw,w.id==='veinseeker'?.32:.12);if(sp)runeHalo(g,w,sp,x,y,W,H,time);return sp;
}
function runeOnSpare(g,w,img,x,y,W,H,gripFrac,sx,sw,draw,time){
 const sp=runeUnder(g,w,img,x,y,W,H,gripFrac,sx,sw,time);if(sp)runeTint(g,w,sp,x,y,W,H);else draw();
}
function runePathPoint(path,u,x,y,W,H){
 const k=Math.max(0,Math.min(1,u))*(path.length-1),i=Math.floor(k),a=path[i],b=path[Math.min(i+1,path.length-1)],f=k-i;
 return {x:x+(a[0]+(b[0]-a[0])*f)*W,y:y+(a[1]+(b[1]-a[1])*f)*H};
}
function runeMarks(g,w,sp,x,y,W,H,time){
 if(!w||!sp||!sp.profile)return;
 const t=time??performance.now()/1000,size=Math.max(.65,Math.min(1.25,Math.max(W,H)/48));
 const paths=sp.profile.paths;
 g.save();g.lineCap='round';g.lineJoin='round';
 const trace=(path,a,b)=>{
  g.beginPath();for(let k=0;k<=20;k++){const p=runePathPoint(path,a+(b-a)*k/20,x,y,W,H);k?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);}g.stroke();
 };
 for(let j=0;j<paths.length;j++){
  const path=paths[j];if(path.length<2)continue;
  const length=path.reduce((sum,p,i)=>i?sum+Math.hypot((p[0]-path[i-1][0])*W,(p[1]-path[i-1][1])*H):0,0);
  const count=Math.max(1,Math.min(4,Math.ceil(length/12)));
  if(w.id==='emberbite'){
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=.35;g.strokeStyle='#ffd49a';g.lineWidth=.42*size;trace(path,.06,.94);g.restore();
   for(let i=0;i<count;i++){
    const p=runePathPoint(path,(i+.5)/count,x,y,W,H),ph=t*7.2+i*2.4+j*1.8;
    const rise=(2.1+1.1*(.5+.5*Math.sin(ph*1.3)))*size,lean=Math.sin(ph)*.65*size,r=.48*size;
    g.save();g.globalAlpha*=.6+.13*Math.sin(ph);
    g.fillStyle='#d54d1e';g.beginPath();g.moveTo(p.x-r,p.y+.15);
    g.bezierCurveTo(p.x-r*1.4,p.y-rise*.42,p.x+lean*.3,p.y-rise*.4,p.x+lean,p.y-rise);
    g.bezierCurveTo(p.x+lean*.6,p.y-rise*.44,p.x+r*1.4,p.y-rise*.25,p.x+r,p.y);g.closePath();g.fill();
    g.globalCompositeOperation='lighter';g.fillStyle='#ffc578';g.beginPath();g.moveTo(p.x-r*.4,p.y);g.quadraticCurveTo(p.x+lean*.3,p.y-rise*.35,p.x+lean*.3,p.y-rise*.65);g.quadraticCurveTo(p.x+r*.7,p.y-rise*.2,p.x+r*.4,p.y);g.fill();g.restore();
   }
  }else if(w.id==='frostgrip'||w.id==='veinseeker'){
   const blood=w.id==='veinseeker';
   g.save();g.globalAlpha*=blood?.65:.42;g.strokeStyle=blood?'#71162c':'#d5f2f5';g.lineWidth=(blood?.6:.38)*size;trace(path,.04,.96);g.restore();
   // A moving wet highlight follows the material; it never cuts across the bow's empty middle.
   const flow=(t*(blood?.18:.28)+j*.31)%1;
   g.save();g.globalAlpha*=blood?.42:.7;g.strokeStyle=blood?'#dc8b8e':'#f2ffff';g.lineWidth=.32*size;trace(path,Math.max(0,flow-.07),Math.min(1,flow+.05));g.restore();
   if(!blood)for(let i=0;i<count;i++){
    const p=runePathPoint(path,(i+.6)/(count+.2),x,y,W,H),r=(.48+.13*Math.sin(t*1.5+i))*size;
    g.save();g.globalAlpha*=.5;g.strokeStyle='#c8f3ff';g.lineWidth=.32*size;g.beginPath();g.moveTo(p.x-r,p.y-r);g.lineTo(p.x+r,p.y+r);g.moveTo(p.x-r*.7,p.y+r*.6);g.lineTo(p.x+r*.7,p.y-r*.6);g.stroke();g.restore();
   }
  }else if(w.id==='stormetch'){
   const q=Math.floor(t*15)+j*71;if(runeNoise(q)<.25)continue;
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=.68;g.strokeStyle='#dbc9f4';g.lineWidth=.44*size;g.beginPath();
   for(let i=0;i<=18;i++){
    const u=i/18,p=runePathPoint(path,u,x,y,W,H),kick=(runeNoise(q*19+i)-.5)*.7*size*Math.sin(u*Math.PI);
    i?g.lineTo(p.x+kick,p.y):g.moveTo(p.x,p.y);
   }g.stroke();g.restore();
  }else if(w.id==='goldrune'){
   g.save();g.globalAlpha*=.38;g.strokeStyle='#d1a05a';g.lineWidth=.42*size;trace(path,.1,.9);g.restore();
   for(let i=0;i<Math.min(3,count);i++){
    const u=(i+1)/(Math.min(3,count)+1),p=runePathPoint(path,u,x,y,W,H);
    const before=runePathPoint(path,Math.max(0,u-.03),x,y,W,H),after=runePathPoint(path,Math.min(1,u+.03),x,y,W,H);
    g.save();g.translate(p.x,p.y);g.rotate(Math.atan2(after.y-before.y,after.x-before.x));
    g.globalAlpha*=.4+.17*Math.sin(t*2.1+i+j);g.strokeStyle='#ffe7ac';g.lineWidth=.38*size;
    g.beginPath();g.moveTo(-.75*size,0);g.lineTo(.75*size,0);g.moveTo(-.35*size,-.5*size);g.lineTo(-.35*size,.5*size);g.moveTo(.35*size,0);g.lineTo(.35*size,.5*size);g.stroke();g.restore();
   }
  }
 }
 g.restore();
}
function runeEmitter(g,sp,x,y,W,H){
 if(!sp||!sp.profile||!sp.profile.emit.length)return null;
 const m=g.getTransform();
 return {key:sp.key,size:Math.max(.7,Math.min(1.15,Math.max(W,H)/48)),
  points:sp.profile.emit.map(p=>runePointTransform(m,{x:x+p[0]*W,y:y+p[1]*H}))};
}
function runeSpark(w,emission,dt,floorY,state=runeWorldEmission){
 if(!w||!emission||!emission.points.length||gamePaused){state.carry=0;state.key='';return;}
 if(!(dt>0))return; /* extra renders neither emit nor discard accumulated simulation time */
 const key=w.id+'|'+emission.key;if(key!==state.key){state.carry=0;state.key=key;}
 const rates={emberbite:9,frostgrip:3.2,veinseeker:3.8,stormetch:4.2,goldrune:3};
 state.carry+=Math.min(.05,dt)*(rates[w.id]||0);
 let count=Math.floor(state.carry);state.carry-=count;
 const pool=state.parts||parts;
 if(pool.length>=480)return;
 const liquid=w.id==='frostgrip'||w.id==='veinseeker';
 let points=emission.points;
 if(liquid){const bottom=Math.max(...points.map(p=>p.y));points=points.filter(p=>p.y>=bottom-3);}
 while(count-->0&&pool.length<480){
  const point=points[Math.floor(Math.random()*points.length)],size=emission.size;
  const p={x:point.x,y:point.y,t:0,life:.65,c:w.glow,r:(.40+Math.random()*.22)*size,vx:0,vy:0,g:0};
  if(w.id==='emberbite'){p.runeFx='ember';p.vx=(Math.random()-.5)*6;p.vy=-8-Math.random()*10;p.g=-7;p.life=.45+Math.random()*.25;}
  else if(liquid){p.runeFx=w.id==='frostgrip'?'water':'blood';p.vx=(Math.random()-.5)*1.5;p.vy=2+Math.random()*2;p.g=p.runeFx==='water'?94:112;p.life=1.05;p.floorY=Math.max(point.y+4,floorY);}
  else if(w.id==='stormetch'){p.runeFx='spark';p.vx=(Math.random()-.5)*60;p.vy=(Math.random()-.5)*50;p.life=.10+Math.random()*.07;p.r=.25*size;}
  else{p.runeFx='gold';p.vx=(Math.random()-.5)*3;p.vy=-2-Math.random()*3;p.g=5;p.life=.6;p.r=.35*size;}
  pool.push(p);
 }
}
function stepRuneParticle(p,dt){
 // Analytic acceleration keeps drop motion stable across normal frame rates.
 p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt+.5*p.g*dt*dt;p.vy+=p.g*dt;
 if(p.floorY!==undefined&&p.y>=p.floorY){
  p.y=p.floorY;p.vx=0;p.vy=0;p.g=0;p.t=0;
  p.life=p.runeFx==='water'?.26:.42;p.runeFx+='-splash';delete p.floorY;
 }
 return p.t>p.life;
}
