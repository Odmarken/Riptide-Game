/* 🧱 The ground of the City. What used to be one grey slab, one small cobble for every street and blurred weed is a
 * built surface: a calm yard floor between the houses, three classes of road - the pale royal boulevard, cobbled
 * streets and avenues, dark back alleys - each with a kerb, a gutter and the odd drain; squares paved in fan setts
 * with a ring of dressed stone and a floor mosaic that says what the square is for; grass along the kerbs; and,
 * sparsely, the quiet things of a back yard: a linden, an apple tree, a woodpile, a washing line, a trough. Pigeons
 * keep the cathedral's approach and leave it when you walk in.
 *
 * THE RULE: the boulevard and the great square are the Crown Ledger's stage - stalls, lamps, the statue, the fountain,
 * wagons, beggars, barricades, the long tables all go there as the steward earns or deserves them. Nothing in this
 * file ever stands there: decor() keeps a wide berth of both (KEEP below), and everything else here is floor. The
 * city builder is not touched either - the plan is read off its streets, plazas and houses after the fact, and every
 * placement is hashed from its own position, so not one seeded number is consumed and no route or house moves.
 *
 * Painted by Higgsfield gpt_image_2_5 (2026-09-22, assets/city/ground/ground-art-manifest.json). Drawn per frame
 * from tiles, camera-culled; the plan is made once per visit. Pure module: no DOM, no game - it runs headless. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CityGround=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 const ready=im=>!!(im&&im.complete!==false&&(im.naturalWidth||im.width)>0&&(im.naturalHeight||im.height)>0);
 const iw=im=>im.naturalWidth||im.width,ih=im=>im.naturalHeight||im.height;
 const hash=(a,b)=>{let h=(Math.imul(a|0,73856093)^Math.imul(b|0,19349663)^0x9e3779b9)>>>0;h=Math.imul(h^(h>>>15),2246822519)>>>0;h=Math.imul(h^(h>>>13),3266489917)>>>0;return (h^(h>>>16))>>>0;};
 const unit=(a,b,salt=0)=>(hash(a+salt*7919,b-salt*104729)%100000)/100000;
 /* road classes by the width the builder gave the street: what it is paved with, how big the tile is laid, how it is kerbed */
 const CLASSES=Object.freeze({
  boulevard:{min:240,tile:'road_boulevard',size:340,mirror:true,kerb:9,kerbColor:'#d8ccb0',order:3},
  street:{min:140,tile:'road_cobble',size:270,mirror:false,kerb:7,kerbColor:'#b9ad93',order:2},
  alley:{min:0,tile:'road_alley',size:250,mirror:true,kerb:0,kerbColor:null,order:1},
 });
 const classOf=w=>w>=CLASSES.boulevard.min?'boulevard':w>=CLASSES.street.min?'street':'alley';
 const KEEP=Object.freeze({boulevard:330,square:330,road:64,plaza:70,wall:330,house:26,front:150});   /* how wide a berth decor() gives the ledger's stage, and everything else */
 const HOUSE={house_timber:[245,.616],house_stair:[265,.768],house_stone:[305,.530],house_shop:[285,.914],house_turret:[340,.743],house_tenement:[375,.556],house_manor:[405,.676]};
 const facade=s=>{const d=HOUSE[s.key];if(!d)return null;const h=d[0],hw=h*d[1]/2;return {x:s.x-hw,y:s.y+s.r*.3-h,w:hw*2,h,base:s.y+s.r*.3,hw};};

 /* ---------- the plan: read off the built city, once ---------- */
 function plan(world,options={}){
  const streets=world.streets||[],plazas=(world.plazas||[]).map(p=>({x:p.x,y:p.y,rx:p.r,ry:p.r*.82,r:p.r}));
  const roads=streets.map((s,i)=>{
   const horiz=s.y0===s.y1,cls=classOf(s.w),half=s.w/2;
   return horiz?{i,cls,horiz,half,x:Math.min(s.x0,s.x1),y:s.y0-half,w:Math.abs(s.x1-s.x0),h:s.w,ax:Math.min(s.x0,s.x1),bx:Math.max(s.x0,s.x1),c:s.y0}
               :{i,cls,horiz,half,x:s.x0-half,y:Math.min(s.y0,s.y1),w:s.w,h:Math.abs(s.y1-s.y0),ax:Math.min(s.y0,s.y1),bx:Math.max(s.y0,s.y1),c:s.x0};
  }).sort((a,b)=>CLASSES[a.cls].order-CLASSES[b.cls].order||a.i-b.i);
  const inRoad=(x,y,pad=0,skip=null)=>roads.some(r=>r!==skip&&x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad);
  const inPlaza=(x,y,pad=0)=>plazas.some(p=>((x-p.x)/(p.rx+pad))**2+((y-p.y)/(p.ry+pad))**2<1);
  /* kerbs: each long edge of a kerbed road, less the stretches that lie inside another road or a square */
  const kerbs=[];
  for(const r of roads){
   if(!CLASSES[r.cls].kerb)continue;
   for(const side of [-1,1]){
    const e=r.c+side*r.half;let cuts=[];
    for(const o of roads){if(o===r)continue;
     if(r.horiz){if(e>=o.y-1&&e<=o.y+o.h+1)cuts.push([o.x-2,o.x+o.w+2]);}
     else if(e>=o.x-1&&e<=o.x+o.w+1)cuts.push([o.y-2,o.y+o.h+2]);}
    for(const p of plazas){
     const d=r.horiz?(e-p.y)/p.ry:(e-p.x)/p.rx;if(Math.abs(d)>=1)continue;
     const span=(r.horiz?p.rx:p.ry)*Math.sqrt(1-d*d),mid=r.horiz?p.x:p.y;cuts.push([mid-span-2,mid+span+2]);}
    cuts.sort((a,b)=>a[0]-b[0]);
    let at=r.ax;
    for(const [c0,c1] of cuts){if(c0>at&&c0-at>14)kerbs.push({horiz:r.horiz,e,a:at,b:Math.min(c0,r.bx),side,cls:r.cls});at=Math.max(at,c1);if(at>=r.bx)break;}
    if(r.bx-at>14)kerbs.push({horiz:r.horiz,e,a:at,b:r.bx,side,cls:r.cls});
   }
  }
  const houses=(world.solids||[]).filter(s=>s.type==='cityhouse').map(s=>({s,f:facade(s)})).filter(h=>h.f);
  const G=260,grid=new Map();
  for(const h of houses)for(let gx=Math.floor(h.f.x/G);gx<=Math.floor((h.f.x+h.f.w)/G);gx++)for(let gy=Math.floor(h.f.y/G);gy<=Math.floor((h.f.base+20)/G);gy++){const key=gx+','+gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(h);}
  const housesNear=(x,y)=>{const out=new Set();for(let gx=Math.floor((x-G)/G);gx<=Math.floor((x+G)/G);gx++)for(let gy=Math.floor((y-G)/G);gy<=Math.floor((y+G)/G);gy++)for(const h of grid.get(gx+','+gy)||[])out.add(h);return [...out];};
  const underHouse=(x,y,pad=0)=>housesNear(x,y).some(h=>x>=h.f.x-pad&&x<=h.f.x+h.f.w+pad&&y>=h.f.y-pad&&y<=h.f.base+pad);
  /* drains in the gutter, and grass along the outside of the kerb: hashed off the kerb itself */
  const drains=[],tufts=[];
  for(const k of kerbs){
   for(let t=k.a+90;t<k.b-90;t+=70){
    const u=unit(Math.round(t),Math.round(k.e),1);
    if(u<.075)drains.push(k.horiz?{x:t,y:k.e-k.side*14,horiz:true}:{x:k.e-k.side*14,y:t,horiz:false});
    else if(u>.62){const off=k.side*(9+unit(Math.round(t),Math.round(k.e),2)*10);
     const x=k.horiz?t:k.e+off,y=k.horiz?k.e+off:t;
     if(!inRoad(x,y,4)&&!inPlaza(x,y,6)&&!underHouse(x,y,0))tufts.push({x,y,kind:1+hash(Math.round(x),Math.round(y))%3,size:20+unit(Math.round(x),Math.round(y),3)*14,flip:hash(Math.round(y),Math.round(x))&1});}
   }
  }
  /* the yard: clumps on a hashed grid, never on a road, a square or under a facade */
  const W=world.w,H=world.h;
  for(let gy=300;gy<H-300;gy+=190)for(let gx=300;gx<W-300;gx+=190){
   if(unit(gx,gy,4)>.40)continue;
   const x=gx+unit(gx,gy,5)*170,y=gy+unit(gx,gy,6)*170;
   if(inRoad(x,y,16)||inPlaza(x,y,14)||underHouse(x,y,8))continue;
   tufts.push({x,y,kind:1+hash(gx,gy)%4,size:24+unit(gx,gy,7)*18,flip:hash(gy,gx)&1});
  }
  const mosaics=(options.mosaics||[]).map(m=>({...m}));
  const styles=options.plazaStyles||{};
  plazas.forEach((p,i)=>{p.soot=!!(styles[i]&&styles[i].soot);});
  return {w:W,h:H,roads,plazas,kerbs,drains,tufts,mosaics,houses:houses.map(h=>h.f),cy:H/2,square:plazas[0]||{x:W/2,y:H/2,rx:520,ry:426,r:520},
   inRoad,inPlaza,underHouse,housesNear,keepOut:(options.keepOut||[]).map(r=>({...r}))};
 }

 /* ---------- the quiet things of a back yard ---------- */
 const DECOR=Object.freeze({
  linden:{key:'tree_linden',h:330,drop:12,r:15,tall:true},apple:{key:'tree_apple',h:215,drop:10,r:12,tall:true},
  bush:{key:'bush',h:74,drop:8,r:0},woodpile:{key:'woodpile',h:112,drop:10,r:30},trough:{key:'trough',h:96,drop:10,r:32},laundry:{key:'laundry',h:120,drop:6,r:0},
 });
 /* Two candidates to a 520-unit cell, most of them turned down: off the ledger's stage, off every road and square, clear of the
    walls, never on or just in front of a facade. What is left is a back yard. */
 function decor(world,p){
  const out=[],cell=520,sq=p.square;
  const ok=(x,y,kind)=>{
   if(x<KEEP.wall||x>p.w-KEEP.wall||y<KEEP.wall||y>p.h-KEEP.wall)return false;
   if(Math.abs(y-p.cy)<KEEP.boulevard)return false;                                           /* the boulevard and everything the ledger lines it with */
   if(Math.hypot(x-sq.x,(y-sq.y)*1.1)<sq.r+KEEP.square)return false;                           /* the great square and the pitches round its rim */
   if(p.inRoad(x,y,KEEP.road)||p.inPlaza(x,y,KEEP.plaza))return false;
   for(const k of p.keepOut)if(x>=k.x&&x<=k.x+k.w&&y>=k.y&&y<=k.y+k.h)return false;
   const hw=kind==='laundry'?110:kind==='linden'?70:40;
   for(const {f} of p.housesNear(x,y)){
    if(x>=f.x-KEEP.house-hw&&x<=f.x+f.w+KEEP.house+hw&&y>=f.y&&y<=f.base+KEEP.front)return false;   /* not across a front, not in the doorway's view */
   }
   return true;
  };
  for(let gy=0;gy<p.h;gy+=cell)for(let gx=0;gx<p.w;gx+=cell)for(const go of [0,40]){   /* two tries to a cell: most are turned down */
   if(unit(gx,gy,11+go)>.70)continue;
   const x=gx+60+unit(gx,gy,12+go)*(cell-120),y=gy+60+unit(gx,gy,13+go)*(cell-120),u=unit(gx,gy,14+go);
   if(out.some(o=>Math.hypot(o.x-x,o.y-y)<170))continue;                                      /* never two in a heap */
   const kind=u<.38?'linden':u<.62?'apple':u<.78?'bush':u<.86?'woodpile':u<.93?'laundry':'trough';
   if(!ok(x,y,kind))continue;
   const d=DECOR[kind];
   out.push({type:'citydecor',kind,x:Math.round(x),y:Math.round(y),r:d.r||10,noCol:!d.r,flip:!!(hash(gx,gy)&1),seed:unit(gx,gy,15)*10});
   if(kind==='bush'||kind==='linden'){   /* a bush keeps a tree, or another bush, company */
    const bx=Math.round(x+(hash(gy,gx)&1?1:-1)*(54+unit(gx,gy,16)*30)),by=Math.round(y+10+unit(gx,gy,17)*26);
    if(ok(bx,by,'bush'))out.push({type:'citydecor',kind:'bush',x:bx,y:by,r:10,noCol:true,flip:!!(hash(gx,gy)&2),seed:unit(gx,gy,18)*10});
   }
  }
  return out;
 }
 function frame(s,images){
  const d=DECOR[s.kind],im=d&&images&&images[d.key];if(!ready(im))return null;
  const Hh=d.h,Ww=Hh*iw(im)/ih(im);return {W:Ww,H:Hh,top:d.drop-Hh,tall:!!d.tall};
 }
 function drawShadow(g,s){
  const d=DECOR[s.kind];if(!d)return;
  const rx=s.kind==='linden'?96:s.kind==='apple'?64:s.kind==='laundry'?84:s.kind==='bush'?40:52;
  g.fillStyle='rgba(0,0,0,.24)';g.beginPath();g.ellipse(rx*.10,5,rx,Math.max(8,rx*.26),0,0,TAU);g.fill();
 }
 function drawProp(g,s,time=0,images={},options={}){
  const d=DECOR[s.kind],f=frame(s,images);if(!d)return;
  if(!f){g.fillStyle='rgba(60,90,50,.5)';g.beginPath();g.ellipse(0,-20,18,24,0,0,TAU);g.fill();return;}
  const im=images[d.key],sway=d.tall?Math.sin(time*.9+(s.seed||0))*.012:s.kind==='laundry'?Math.sin(time*1.7+(s.seed||0))*.02:0;
  g.save();g.globalAlpha*=options.alpha===undefined?1:options.alpha;g.scale(s.flip?-1:1,1);
  if(sway){g.transform(1,0,sway,1,0,0);}                                                     /* the crown leans a hair in the wind; the foot stays put */
  g.drawImage(im,-f.W/2,f.top,f.W,f.H);g.restore();
 }

 /* ---------- drawing the floor ---------- */
 function tiles(g,im,rc,size,v,mirror,turn){
  const x0=Math.max(rc.x,v.x0),y0=Math.max(rc.y,v.y0),x1=Math.min(rc.x+rc.w,v.x1),y1=Math.min(rc.y+rc.h,v.y1);
  if(x1<=x0||y1<=y0||!ready(im))return false;
  const ox=rc.ox||0,oy=rc.oy||0;   /* anchored in the world (a road: on its own centre line), never on the camera */
  for(let j=Math.floor((y0-oy)/size);oy+j*size<y1;j++)for(let i=Math.floor((x0-ox)/size);ox+i*size<x1;i++){
   if(!mirror&&!turn){g.drawImage(im,ox+i*size-.4,oy+j*size-.4,size+.8,size+.8);continue;}
   g.save();g.translate(ox+(i+.5)*size,oy+(j+.5)*size);if(turn)g.rotate(Math.PI/2);
   if(mirror)g.scale((turn?j:i)%2?-1:1,(turn?i:j)%2?-1:1);
   g.drawImage(im,-size/2-.4,-size/2-.4,size+.8,size+.8);g.restore();
  }
  return true;
 }
 const FLAT={ground_yard:'#6f6a58',road_boulevard:'#d9c79c',road_cobble:'#7f6a4f',road_alley:'#3f3a31',plaza_setts:'#86796a'};
 function roadPath(g,r){   /* the stretch and its two round ends */
  g.beginPath();
  if(r.horiz){g.moveTo(r.x,r.y);g.lineTo(r.x+r.w,r.y);g.arc(r.x+r.w,r.c,r.half,-Math.PI/2,Math.PI/2);g.lineTo(r.x,r.y+r.h);g.arc(r.x,r.c,r.half,Math.PI/2,Math.PI*1.5);}
  else{g.moveTo(r.x+r.w,r.y);g.lineTo(r.x+r.w,r.y+r.h);g.arc(r.c,r.y+r.h,r.half,0,Math.PI);g.lineTo(r.x,r.y);g.arc(r.c,r.y,r.half,Math.PI,TAU);}
  g.closePath();
 }
 function render(g,p,view,images={},time=0){
  if(!p)return;
  const zoom=view.zoom||1,v={x0:view.x,y0:view.y,x1:view.x+view.w,y1:view.y+view.h};
  /* the yard floor, everywhere */
  if(!tiles(g,images.ground_yard,{x:0,y:0,w:p.w,h:p.h},330,v,true,false)){g.fillStyle=FLAT.ground_yard;g.fillRect(v.x0,v.y0,view.w,view.h);}
  g.fillStyle='rgba(44,42,32,.34)';g.fillRect(v.x0,v.y0,view.w,view.h);   /* pushed back: the yard is the quiet surface, the roads and the squares are what is lit */
  /* clumps: grass, daisies, dock, poppies */
  if(zoom>.4)for(const t of p.tufts){
   if(t.x<v.x0-30||t.x>v.x1+30||t.y<v.y0-10||t.y>v.y1+40)continue;
   const im=images['tuft_'+t.kind];if(!ready(im))continue;
   const w=t.size*1.5,h=w*ih(im)/iw(im);
   g.save();g.translate(t.x,t.y);if(t.flip)g.scale(-1,1);g.drawImage(im,-w/2,-h+4,w,h);g.restore();
  }
  /* roads, humblest first, each seated in a soft shadow */
  for(const r of p.roads){
   if(r.x-r.half>v.x1||r.x+r.w+r.half<v.x0||r.y-r.half>v.y1||r.y+r.h+r.half<v.y0)continue;
   const c=CLASSES[r.cls],im=images[c.tile];
   g.save();roadPath(g,r);
   if(zoom>.5){g.strokeStyle='rgba(0,0,0,.20)';g.lineWidth=10;g.stroke();}
   g.clip();
   const box={x:r.x-r.half,y:r.y-r.half,w:r.w+r.half*2,h:r.h+r.half*2,ox:r.horiz?0:r.c-c.size/2,oy:r.horiz?r.c-c.size/2:0};
   if(!tiles(g,im,box,c.size,v,c.mirror,!r.horiz&&c.mirror)){g.fillStyle=FLAT[c.tile];g.fillRect(box.x,box.y,box.w,box.h);}
   if(r.cls==='alley'){g.fillStyle='rgba(150,138,112,.13)';g.fillRect(Math.max(box.x,v.x0),Math.max(box.y,v.y0),Math.min(box.x+box.w,v.x1)-Math.max(box.x,v.x0),Math.min(box.y+box.h,v.y1)-Math.max(box.y,v.y0));}   /* lifted a shade, so a lane reads as a lane and not as a shadow on the yard */
   if(r.cls==='boulevard'&&zoom>.45){   /* where the wagons roll the stone is worn dark and smooth */
    for(const lane of [-52,52])for(const rut of [-17,17]){const y=r.c+lane+rut;g.fillStyle='rgba(70,52,30,.13)';g.fillRect(Math.max(r.x,v.x0),y-5,Math.min(r.x+r.w,v.x1)-Math.max(r.x,v.x0),10);g.fillStyle='rgba(255,246,220,.10)';g.fillRect(Math.max(r.x,v.x0),y-6.5,Math.min(r.x+r.w,v.x1)-Math.max(r.x,v.x0),1.5);}
   }
   g.restore();
  }
  /* kerbs and gutters */
  if(zoom>.3)for(const k of p.kerbs){
   const c=CLASSES[k.cls],a=Math.max(k.a,(k.horiz?v.x0:v.y0)-40),b=Math.min(k.b,(k.horiz?v.x1:v.y1)+40);
   if(b<=a||k.e<(k.horiz?v.y0:v.x0)-20||k.e>(k.horiz?v.y1:v.x1)+20)continue;
   const line=(off,width,color)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();if(k.horiz){g.moveTo(a,k.e+off);g.lineTo(b,k.e+off);}else{g.moveTo(k.e+off,a);g.lineTo(k.e+off,b);}g.stroke();};
   line(-k.side*(c.kerb/2+6),4,'rgba(30,22,12,.30)');                         /* the gutter, inside */
   line(k.side*(c.kerb/2+1),3,'rgba(0,0,0,.30)');                             /* the kerb's shadow on the yard */
   line(0,c.kerb,c.kerbColor);line(-k.side*(c.kerb/2-1),1.5,'rgba(255,250,235,.35)');
   if(zoom>.55){g.strokeStyle='rgba(38,30,20,.5)';g.lineWidth=1.5;g.beginPath();
    for(let t=Math.ceil(a/52)*52;t<b;t+=52){if(k.horiz){g.moveTo(t,k.e-c.kerb/2);g.lineTo(t,k.e+c.kerb/2);}else{g.moveTo(k.e-c.kerb/2,t);g.lineTo(k.e+c.kerb/2,t);}}g.stroke();}
  }
  if(zoom>.5)for(const d of p.drains){
   if(d.x<v.x0-20||d.x>v.x1+20||d.y<v.y0-20||d.y>v.y1+20)continue;
   if(ready(images.drain_cover)){
    const im=images.drain_cover,w=38,h=w*ih(im)/iw(im);
    g.drawImage(im,d.x-w/2,d.y-h/2,w,h);continue;
   }
   const w=d.horiz?30:13,h=d.horiz?13:30;
   g.fillStyle='#8f8672';g.fillRect(d.x-w/2-3,d.y-h/2-3,w+6,h+6);g.fillStyle='#15120e';g.fillRect(d.x-w/2,d.y-h/2,w,h);
   g.fillStyle='#4a453c';for(let i=1;i<5;i++){if(d.horiz)g.fillRect(d.x-w/2+i*w/5-1,d.y-h/2,2,h);else g.fillRect(d.x-w/2,d.y-h/2+i*h/5-1,w,2);}
  }
  /* squares lie OVER the roads that run into them: one floor, rim to rim */
  for(const pl of p.plazas){
   if(pl.x+pl.rx<v.x0||pl.x-pl.rx>v.x1||pl.y+pl.ry<v.y0||pl.y-pl.ry>v.y1)continue;
   g.save();g.beginPath();g.ellipse(pl.x,pl.y,pl.rx,pl.ry,0,0,TAU);
   g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=12;g.stroke();g.clip();
   if(!tiles(g,images.plaza_setts,{x:pl.x-pl.rx,y:pl.y-pl.ry,w:pl.rx*2,h:pl.ry*2},300,v,false,false)){g.fillStyle=FLAT.plaza_setts;g.fillRect(pl.x-pl.rx,pl.y-pl.ry,pl.rx*2,pl.ry*2);}
   if(pl.soot){g.fillStyle='rgba(18,12,8,.34)';g.fillRect(pl.x-pl.rx,pl.y-pl.ry,pl.rx*2,pl.ry*2);}
   g.restore();
   /* a ring of pale dressed stone at the rim, jointed, and a thin inner band */
   g.strokeStyle='#cfc3a6';g.lineWidth=18;g.beginPath();g.ellipse(pl.x,pl.y,pl.rx-9,pl.ry-9,0,0,TAU);g.stroke();
   g.strokeStyle='rgba(38,30,20,.55)';g.lineWidth=2;
   g.beginPath();g.ellipse(pl.x,pl.y,pl.rx,pl.ry,0,0,TAU);g.stroke();g.beginPath();g.ellipse(pl.x,pl.y,pl.rx-18,pl.ry-18,0,0,TAU);g.stroke();
   if(zoom>.5){const n=Math.round(pl.rx/9);g.beginPath();for(let i=0;i<n;i++){const a=i/n*TAU,c=Math.cos(a),s=Math.sin(a);g.moveTo(pl.x+c*(pl.rx-18),pl.y+s*(pl.ry-18));g.lineTo(pl.x+c*pl.rx,pl.y+s*pl.ry);}g.stroke();}
   g.strokeStyle='rgba(60,48,34,.35)';g.lineWidth=5;g.beginPath();g.ellipse(pl.x,pl.y,pl.rx*.66,pl.ry*.66,0,0,TAU);g.stroke();
  }
  for(const m of p.mosaics){
   const im=images[m.key],half=m.size/2;
   if(!ready(im)||m.x+half<v.x0||m.x-half>v.x1||m.y+half<v.y0||m.y-half>v.y1)continue;
   const hh=half*(m.squash||.86);                                                           /* laid on the ground, seen from the game's raised camera */
   g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(m.x,m.y+3,half+5,hh+5,0,0,TAU);g.fill();
   g.drawImage(im,m.x-half,m.y-hh,m.size,hh*2);
  }
 }

 /* ---------- 🕊 pigeons: they keep a forecourt, and leave it when you walk in ---------- */
 function flock(x,y,n,seed=1){
  const birds=[];
  for(let i=0;i<n;i++){const a=unit(i,seed,21)*TAU,d=20+unit(i,seed,22)*78;birds.push({hx:x+Math.cos(a)*d,hy:y+Math.sin(a)*d*.6,x:0,y:0,state:'peck',t:unit(i,seed,23)*4,fx:unit(i,seed,24)<.5?-1:1,ax:0,ay:0,away:0});birds[i].x=birds[i].hx;birds[i].y=birds[i].hy;}
  return {x,y,birds};
 }
 function updateBirds(flocks,dt,hero){
  for(const f of flocks||[])for(const b of f.birds){
   b.t+=dt;
   if(b.state==='peck'){
    if(hero&&Math.hypot(hero.x-b.x,hero.y-b.y)<150){const a=Math.atan2(b.y-hero.y,b.x-hero.x)+(unit(Math.round(b.hx),Math.round(b.hy),25)-.5)*1.2;b.state='flee';b.t=0;b.ax=Math.cos(a);b.ay=Math.sin(a)*.7-.35;b.away=6+unit(Math.round(b.hx),Math.round(b.hy),26)*6;}
    else if(b.t>2.4){b.t=0;b.fx=-b.fx;}                                                     /* turns about now and then */
   }else if(b.state==='flee'){b.x+=b.ax*330*dt;b.y+=b.ay*330*dt;if(b.t>1.7){b.state='gone';b.t=0;}}
   else if(b.state==='gone'){if(b.t>b.away&&!(hero&&Math.hypot(hero.x-b.hx,hero.y-b.hy)<260)){b.state='back';b.t=0;}}
   else if(b.state==='back'){const dx=b.hx-b.x,dy=b.hy-b.y,d=Math.hypot(dx,dy);if(d<8){b.x=b.hx;b.y=b.hy;b.state='peck';b.t=0;}else{b.x+=dx/d*Math.min(d,300*dt);b.y+=dy/d*Math.min(d,300*dt);}}
  }
 }
 function drawBirds(g,flocks,view,images,time,sky){
  const ground=images.pigeon,fly=images.pigeon_fly;
  for(const f of flocks||[])for(const b of f.birds){
   if(b.x<view.x-60||b.x>view.x+view.w+60||b.y<view.y-80||b.y>view.y+view.h+60)continue;
   const air=b.state==='flee'||b.state==='back';
   if(air!==!!sky||b.state==='gone')continue;
   if(!air){
    if(!ready(ground))continue;
    const w=22,h=w*ih(ground)/iw(ground),nod=Math.max(0,Math.sin(time*5+b.hx))*2.5;
    g.fillStyle='rgba(0,0,0,.20)';g.beginPath();g.ellipse(b.x,b.y+1,9,3,0,0,TAU);g.fill();
    g.save();g.translate(b.x,b.y);g.scale(-b.fx,1);g.rotate(nod*.04);g.drawImage(ground,-w/2,-h+2,w,h);g.restore();
   }else{
    const lift=b.state==='flee'?Math.min(1,b.t/1.2):Math.min(1,Math.hypot(b.hx-b.x,b.hy-b.y)/260),size=26+lift*12,heading=b.state==='flee'?Math.atan2(b.ay,b.ax):Math.atan2(b.hy-b.y,b.hx-b.x);
    g.fillStyle='rgba(0,0,0,'+(.18*(1-lift*.5)).toFixed(3)+')';g.beginPath();g.ellipse(b.x+lift*40,b.y+lift*70,10,4,0,0,TAU);g.fill();
    g.save();g.translate(b.x,b.y-lift*30);g.rotate(heading+Math.PI/2);g.scale(1+Math.sin(time*22+b.hx)*.22,1);g.globalAlpha=b.state==='flee'?1-Math.max(0,b.t-1.2)/.5:1;
    if(ready(fly))g.drawImage(fly,-size/2,-size*ih(fly)/iw(fly)/2,size,size*ih(fly)/iw(fly));
    g.restore();
   }
  }
 }
 const IMAGES=Object.freeze(['ground_yard','road_boulevard','road_cobble','road_alley','plaza_setts','mosaic_compass','mosaic_sun','mosaic_crown','mosaic_anchor','mosaic_pick','mosaic_rune','mosaic_flame',
  'tree_linden','tree_apple','bush','woodpile','trough','laundry','pigeon','pigeon_fly','tuft_1','tuft_2','tuft_3','tuft_4','drain_cover']);
 return Object.freeze({plan,decor,render,drawProp,drawShadow,frame,flock,updateBirds,drawBirds,classOf,CLASSES,DECOR,KEEP,IMAGES});
});
