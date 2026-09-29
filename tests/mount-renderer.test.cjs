const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const close=(a,b,label='coordinate')=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);
const sprite=(src='mount',w=1024,h=1024)=>({src,complete:true,naturalWidth:w,naturalHeight:h});

function harness(){
 const canvases=[];
 class Shape {constructor(){this.rectangles=[];}rect(...r){this.rectangles.push(r);}}
 function context(canvas={ops:[]}){
  let matrix=[1,0,0,1,0,0],stack=[],clips=[];
  const record=(kind,args)=>canvas.ops.push({kind,args,matrix:[...matrix],clips:[...clips]});
  const g={globalAlpha:1,
   save(){stack.push({matrix:[...matrix],clips:[...clips],alpha:g.globalAlpha});},
   restore(){const s=stack.pop();assert.ok(s,'balanced canvas saves');matrix=s.matrix;clips=s.clips;g.globalAlpha=s.alpha;},
   transform(a,b,c,d,e,f){const [A,B,C,D,E,F]=matrix;matrix=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F];},
   translate(x,y){g.transform(1,0,0,1,x,y);},scale(x,y){g.transform(x,0,0,y,0,0);},
   rotate(t){g.transform(Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0);},
   getTransform(){const [a,b,c,d,e,f]=matrix;return {a,b,c,d,e,f};},
   setTransform(m){matrix=[m.a,m.b,m.c,m.d,m.e,m.f];},
   clip(p,rule){clips.push({path:p,rule});record('clip',[p,rule]);},
   drawImage(...args){record('draw',args);},clearRect(...args){record('clear',args);},
   getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=20;y<h-20;y++)for(let x=20;x<w-20;x++)data[(y*w+x)*4+3]=220;return {data};},
   beginPath(){},ellipse(){},fill(){},arc(){},stroke(){},
   createRadialGradient(...args){record('gradient',args);return {addColorStop(){}};}
  };return g;
 }
 const document={createElement(tag){assert.equal(tag,'canvas');const c={width:0,height:0,ops:[]};c.getContext=()=>c.g||(c.g=context(c));canvases.push(c);return c;}};
 const renderer=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/mounts/renderer.js'),'utf8')+';MountRenderer',{document,Path2D:Shape});
 return {renderer,canvases,context};
}
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];

test('each mount keeps every hoof/paw rigidly attached through a complete alternating stride',()=>{
 const {renderer,context}=harness();
 for(const id of ['horse','leopard','spectral-tiger']){
  const img=sprite(id);
  for(const phase of [Math.PI/4,Math.PI/2,Math.PI*5/4,Math.PI*3/2]){
   const painted={ops:[]},g=context(painted);
   const l=renderer.draw(g,{id,img,moving:1,phase,deviceScale:5});
   const pose=painted.ops.find(o=>o.kind==='draw').args[0];
   const pieces=pose.ops.filter(o=>o.kind==='draw').slice(1),clears=pose.ops.filter(o=>o.kind==='clear');
   assert.equal(pieces.length,12,'three connected sections for each of four legs');
   assert.equal(clears.length,4);
   assert.ok(pose.mountInset>0,'side padding retains paws that reach past the source edge');
   for(let i=0;i<4;i++){
    const [upper,lower,paw]=pieces.slice(i*3,i*3+3);
    const u=upper.args.slice(1),s=lower.args.slice(1),p=paw.args.slice(1);
    assert.equal(u[1]+u[3],s[1]);assert.equal(s[1]+s[3],p[1]);
    const pad=pose.ops[0].matrix[4],padY=pose.ops[0].matrix[5];
    assert.equal(p[1]+p[3],pose.height-padY*2,'the entire source sole is preserved');
    const upperEnd=point(upper.matrix,u[4],u[5]+u[7]),lowerStart=point(lower.matrix,s[4],s[5]);
    const lowerEnd=point(lower.matrix,s[4],s[5]+s[7]),pawStart=point(paw.matrix,p[4],p[5]);
    upperEnd.forEach((v,n)=>close(v,lowerStart[n],'knee connection'));
    lowerEnd.forEach((v,n)=>close(v,pawStart[n],'ankle connection'));
    close(paw.matrix[0],1);close(paw.matrix[1],0);close(paw.matrix[2],0);close(paw.matrix[3],1,'paw is never squashed');
    const root=point(upper.matrix,u[4],u[5]);
    close(root[0],u[0]+pad,'upper leg stays attached horizontally');close(root[1],u[1]+padY,'upper leg stays attached vertically');
    const sole=point(paw.matrix,p[4]+p[6],p[5]+p[7]);
    assert.ok(pawStart[0]>=0&&sole[0]<=pose.width,'complete paw remains inside padded frame');
    assert.ok(pawStart[1]>=0&&sole[1]<=pose.height,'contact compensation retains the complete sole inside vertical padding');
   }
   for(let i=1;i<clears.length;i++)assert.ok(clears[i-1].args[0]+clears[i-1].args[2]<=clears[i].args[0],'source patches never overlap translucent pixels');
   assert.equal(l.height,65);
  }
 }
});

test('the rider hip follows the saddle through breathing, motion, scale and both facing directions',()=>{
 const {renderer}=harness();
 const images=Object.fromEntries(['horse','leopard','spectral-tiger'].map(id=>[id,sprite(id,128,128)]));
 for(const id of ['horse','leopard','spectral-tiger'])for(const fx of [-1,1])for(const moving of [0,.5,1])for(const phase of [0,1,2,3]){
  const l=renderer.getLayout({id,img:images[id],fx,moving,phase,time:phase,scale:1.3});
  const sx=(l.art.profile.seat[0]*l.art.iw-l.art.ground[0])*l.px*l.bodyScaleX;
  const sy=(l.art.profile.seat[1]*l.art.ih-l.art.ground[1])*l.px*l.bodyScaleY;
  close(l.riderX,fx*(l.bodyX+sx*Math.cos(l.angle)-sy*Math.sin(l.angle)),'hip x at saddle');
  close(l.riderY+l.hipY,l.groundY+l.bob+sx*Math.sin(l.angle)+sy*Math.cos(l.angle),'hip y at saddle');
  assert.ok(Math.abs(l.bob)<=l.art.profile.rise*1.3,'body lift stays within this mount gait');
  assert.ok(Math.abs(l.riderAngle)<.09,'rider stays seated without excessive lean');
  const opposite=renderer.getLayout({id,img:l.art.img,fx:-fx,moving,phase,time:phase,scale:1.3});
  close(l.riderX,-opposite.riderX);close(l.riderY,opposite.riderY);
  close(l.boots.near.x,-opposite.boots.near.x);close(l.boots.near.angle,-opposite.boots.near.angle);
 }
});

test('running moves the whole torso and seated rider, with quiet breathing and continuous cycle endpoints',()=>{
 const {renderer}=harness();
 const range=(items,key)=>Math.max(...items.map(x=>x[key]))-Math.min(...items.map(x=>x[key]));
 for(const id of ['horse','leopard','spectral-tiger'])for(const fx of [-1,1]){
  const img=sprite(id),run=[],idle=[];
  for(let step=0;step<=48;step++){
   const phase=step/48*Math.PI*2;
   run.push(renderer.getLayout({id,img,fx,moving:1,phase,time:phase}));
   idle.push(renderer.getLayout({id,img,fx,moving:0,phase,time:phase}));
  }
  assert.ok(range(run,'bob')>2,'body lift is clearly larger than the former half-pixel foot-only gait');
  assert.ok(range(run,'angle')>.06,'shoulders visibly rock with each stride');
  assert.ok(range(run,'riderY')>2,'the saddle carries the rider through the run');
  assert.ok(range(run,'bodyX')>1,'body surges forward and settles with the stride');
  assert.ok(range(run,'bodyScaleY')>.03,'torso compresses and extends');
  assert.ok(range(idle,'riderY')<.4,'idle motion remains quiet breathing');
  assert.ok(range(idle,'angle')<.004,'idle never rocks like running');
  assert.equal(range(idle,'bob'),0,'no hopping while stationary');
  for(const key of ['bob','bodyX','angle','bodyScaleX','bodyScaleY','riderX','riderY','riderAngle'])close(run[0][key],run[48][key],'cycle wraps '+key);
 }
});

test('body rise does not lift planted feet, while swing feet clear their original contact plane',()=>{
 const {renderer,context}=harness();
 for(const id of ['horse','leopard','spectral-tiger'])for(const fx of [-1,1]){
  const img=sprite(id);
  for(let step=0;step<48;step+=3){
   const painted={ops:[]},phase=step/48*Math.PI*2;
   const l=renderer.draw(context(painted),{id,img,fx,moving:1,phase,time:0,deviceScale:2});
   const mountDraw=painted.ops.find(o=>o.kind==='draw'),pose=mountDraw.args[0],base=pose.ops[0];
   const pad=base.matrix[4],padY=base.matrix[5],w=pose.width-pad*2,h=pose.height-padY*2;
   const pieces=pose.ops.filter(o=>o.kind==='draw').slice(1);
   for(let i=0;i<4;i++){
    const paw=pieces[i*3+2],contact=l.art.contacts[i];
    const posed=point(paw.matrix,contact.x*w/l.art.iw,contact.y*h/l.art.ih);
    const world=point(mountDraw.matrix,(posed[0]-pad)*l.art.iw/w,(posed[1]-padY)*l.art.ih/h);
    const plane=l.groundY+(contact.y-l.art.ground[1])*l.px;
    if(Math.sin(phase+l.art.profile.legs[i].phase)<=1e-8)close(world[1],plane,'stance paw stays grounded');
    else assert.ok(world[1]<plane,'swing paw lifts clear of its contact plane');
   }
  }
 }
});

test('ring and upright name follow the same rider transform as the body and enchanted weapon',()=>{
 const {renderer,context}=harness();
 const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const start=source.indexOf(' /* name only (no rating), lifted clear of the sprite; hp lives in the header bar instead */');
 const end=source.indexOf('\n ctx.restore();\n}',start);
 assert.ok(start>0&&end>start,'actual mounted hero label renderer found');
 const renderLabels=source.slice(start,end);
 for(const id of ['horse','leopard','spectral-tiger'])for(const fx of [-1,1])for(const phase of [0,1,2,3]){
  const l=renderer.getLayout({id,img:sprite(id),fx,moving:1,phase});
  const output={ops:[]},g=context(output),before=g.getTransform();
  g.fillText=(text,x,y)=>{const t=g.getTransform();output.ops.push({kind:'text',text,x,y,matrix:[t.a,t.b,t.c,t.d,t.e,t.f]});};
  const ring={};
  vm.runInNewContext(source.match(/^const heroRing=.*$/m)[0]+'\n'+renderLabels,{ctx:g,rideLayout:l,character:{headY:-35},S:{gear:{trinket:{}},name:'Rider'},h:{dead:false},now:1,by:0,MountRenderer:renderer,isRing:()=>true,
   drawEquippedRing(ctx,item,y){const t=ctx.getTransform();ring.point=point([t.a,t.b,t.c,t.d,t.e,t.f],0,y);}});
  const head=renderer.riderPoint(l,0,-35),label=renderer.riderPoint(l,0,-47);
  close(ring.point[0],head.x);close(ring.point[1],head.y);
  const name=output.ops.at(-1);close(name.x,label.x);close(name.y,label.y);
  assert.deepEqual(name.matrix,[1,0,0,1,0,0],'label remains upright while its anchor follows the rider');
  assert.deepEqual(g.getTransform(),before,'attachments restore their drawing transform');
 }
});

test('the far boot is masked behind the whole mount, while one near boot joins the rider on top',()=>{
 const {renderer,context}=harness(),boot=sprite('rider boot',578,677);
 for(const id of ['horse','leopard','spectral-tiger'])for(const fx of [-1,1]){
  const painted={ops:[]},g=context(painted),before=g.getTransform();let calls=0;
  const l=renderer.draw(g,{id,img:sprite(id),fx,phase:1,moving:1,bootImg:boot},(seat,ride)=>{
   calls++;renderer.drawRiderBoots(seat,boot,ride,'near');
   seat.save();ride.clipBody(seat);seat.drawImage('hero body',0,0);seat.restore();
   seat.drawImage('held weapon',0,0);
  });
  assert.equal(calls,1);assert.deepEqual(g.getTransform(),before,'draw restores its caller transform');
  const draws=painted.ops.filter(o=>o.kind==='draw'),boots=draws.filter(o=>o.args[0]===boot);
  assert.equal(boots.length,2);assert.equal(draws[0],boots[0],'far boot precedes the animal');
  assert.equal(draws[2],boots[1],'only the near boot follows the animal');
  assert.ok(boots[0].clips.some(c=>c.path===l.art.outside&&c.rule==='evenodd'));
  assert.ok(l.art.outside.rectangles.length>l.art.front.rectangles.length,'far mask includes the full body, not only the neck');
  assert.equal(boots[1].clips.length,0,'near boot remains visible on the flank');
  assert.equal(draws.at(-1).args[0],'held weapon');assert.equal(draws.at(-1).clips.length,0,'body occlusion never swallows the weapon');
 }
});

test('pose caching is bounded, distinguishes image replacements and reuses matching frames',()=>{
 const {renderer,context,canvases}=harness();
 const img=sprite('original'),options={id:'spectral-tiger',img,phase:1,moving:1,deviceScale:8};
 const draw=opts=>{const output={ops:[]};renderer.draw(context(output),opts);return output.ops.find(o=>o.kind==='draw').args[0];};
 const a=draw(options),count=canvases.length;
 assert.equal(draw(options),a);assert.equal(canvases.length,count,'cached poses allocate nothing');
 const replacement=draw({...options,img:sprite('original')});assert.notEqual(replacement,a,'distinct image identities do not share pixels');
 img.src='new-art';assert.notEqual(draw(options),a,'replacement source invalidates bounds and poses');
 for(let n=0;n<64;n++)draw({...options,phase:n*Math.PI/16});
 const stats=renderer.stats();assert.ok(stats.bytes<=stats.limit);assert.equal(stats.limit,16*1024*1024);
 assert.ok(stats.entries<32,'old large frames are evicted');
 renderer.clear();assert.equal(renderer.stats().bytes,0);assert.equal(renderer.stats().entries,0);
 const resting=draw({...options,moving:0});assert.equal(resting,img,'resting mount uses its complete original image');
 assert.equal(renderer.stats().bytes,0,'idle breathing creates no pose frames');
});

test('every mount gallops through its painted sheet, with the rider on each frame\'s own saddle',()=>{
 const {renderer,context}=harness(),boot=sprite('rider boot',578,677);
 for(const id of ['horse','leopard','spectral-tiger']){
 const img=sprite(id),run=renderer.getLayout({id,img,moving:0}).art.profile.run;
 const runImg=sprite(id+'-run',run.cols*run.cell[0],Math.ceil(run.frames/run.cols)*run.cell[1]);
 const seen=new Set(),steps=run.frames*4;
 for(const fx of [-1,1])for(let step=0;step<steps;step++){
  const phase=(step+.5)/steps*Math.PI*2,painted={ops:[]};
  const l=renderer.draw(context(painted),{id,img,runImg,fx,moving:1,phase,bootImg:boot},(seat,ride)=>{
   seat.save();ride.clipBody(seat);seat.drawImage('hero body',0,0);seat.restore();
  });
  const index=Math.floor(phase/(Math.PI*2)*run.frames);seen.add(index);
  assert.equal(l.run.index,index);
  const cell=painted.ops.filter(o=>o.kind==='draw'&&o.args[0]===runImg);
  assert.equal(cell.length,1,'one painted frame, no bent-leg pose');
  const [,sx,sy,sw,sh,dx,dy,dw,dh]=cell[0].args;
  assert.deepEqual([sx,sy,sw,sh],[(index%run.cols)*run.cell[0],Math.floor(index/run.cols)*run.cell[1],...run.cell]);
  close(dx,run.origin[0]);close(dy,run.origin[1]);close(dw,run.cell[0]*run.scale[0]);close(dh,run.cell[1]*run.scale[1]);
  const m=cell[0].matrix;close(m[1],0,'the frame carries its own pitch');close(m[2],0);close(m[0],fx*l.px);close(m[3],l.px);
  const [x,y,tilt]=run.seats[index];
  close(l.riderX,fx*(x-l.art.ground[0])*l.px,'hip x on this frame\'s saddle');
  close(l.riderY+l.hipY,l.groundY+(y-l.art.ground[1])*l.px,'hip y on this frame\'s saddle');
  assert.ok(Math.abs(l.riderAngle)<.3,'the rider leans with the saddle, never tips over');
  close(l.riderAngle,fx*(l.art.profile.lean+tilt*.5+Math.sin(phase*2-.8)*.014),'the rider takes half the saddle tilt');
  const far=painted.ops.find(o=>o.kind==='draw'&&o.args[0]===boot),body=painted.ops.find(o=>o.args[0]==='hero body');
  assert.notEqual(far.clips[0].path,l.art.outside,'the far boot hides behind this frame\'s silhouette');
  assert.notEqual(body.clips[0].path,l.art.front,'the rider tucks behind this frame\'s neck');
  assert.ok(far.clips[0].path.rectangles.length>1&&body.clips[0].path.rectangles.length>1);
 }
 assert.equal(seen.size,run.frames,'every painted frame shows once per stride');
 const a=renderer.getLayout({id,img,runImg,moving:1,phase:0}),b=renderer.getLayout({id,img,runImg,moving:1,phase:Math.PI*2});
 assert.equal(a.run.index,b.run.index);close(a.riderY,b.riderY,'the stride wraps');
 }
});

test('the painted gallop waits for its sheet and a real run',()=>{
 const {renderer,context,canvases}=harness();
 const img=sprite('spectral-tiger'),runImg=sprite('spectral-tiger-run',4064,1266);
 const mount=opts=>{const painted={ops:[]};const l=renderer.draw(context(painted),{id:'spectral-tiger',img,phase:1,deviceScale:2,...opts});return {l,art:painted.ops.find(o=>o.kind==='draw').args[0]};};
 assert.equal(mount({runImg,moving:0}).art,img,'standing keeps the still');
 assert.equal(mount({runImg,moving:0}).l.run,null);
 const easing=mount({runImg,moving:.2});assert.equal(easing.l.run,null);assert.ok(easing.art!==img&&easing.art!==runImg,'setting off bends the still');
 assert.equal(mount({runImg:{...runImg,complete:false},moving:1}).l.run,null,'an unloaded sheet falls back to the bent-leg pose');
 assert.equal(mount({moving:1}).l.run,null);
 assert.equal(mount({runImg,moving:1}).art,runImg);
 const first=renderer.draw(context({ops:[]}),{id:'spectral-tiger',img,runImg,moving:1,phase:1});
 const again=renderer.draw(context({ops:[]}),{id:'spectral-tiger',img,runImg,moving:1,phase:1});
 assert.equal(first.run.sheet,again.run.sheet,'the sheet is read once');
 const made=canvases.length;
 for(let n=0;n<11;n++)renderer.draw(context({ops:[]}),{id:'spectral-tiger',img,runImg,moving:1,phase:(n+.5)/11*Math.PI*2},(seat,ride)=>{seat.save();ride.clipBody(seat);seat.restore();});
 assert.equal(canvases.length,made,'one read of the sheet built the masks of every frame');
 renderer.clear();assert.notEqual(renderer.getLayout({id:'spectral-tiger',img,runImg,moving:1,phase:1}).run.sheet,first.run.sheet);
});

test('the dragon flies: its wings beat from the painted sheet even while it hovers, held in the air over its shadow',()=>{
 const {renderer,context}=harness();
 const img=sprite('dragon'),run=renderer.getLayout({id:'dragon',img,moving:0}).art.profile.run;
 const runImg=sprite('dragon-fly',run.cols*run.cell[0],Math.ceil(run.frames/run.cols)*run.cell[1]);
 assert.equal(run.frames,20);
 const seen=new Set();
 for(const moving of [0,1])for(const fx of [-1,1])for(let step=0;step<run.frames*2;step++){
  const phase=(step+.5)/(run.frames*2)*Math.PI*2,painted={ops:[]};
  const l=renderer.draw(context(painted),{id:'dragon',img,runImg,fx,moving,phase});
  assert.ok(l.run,'a flyer never falls back to the still while its sheet is loaded');seen.add(l.run.index);
  const p=l.art.profile,air=-(p.lift-p.heave*Math.cos(phase));close(l.air,air,'height over the shadow');
  assert.ok(l.air<=-(p.lift-p.heave)+1e-9,'always well off the ground');
  const cell=painted.ops.find(o=>o.kind==='draw'&&o.args[0]===runImg);assert.ok(cell);
  close(point(cell.matrix,...l.art.ground)[1],l.groundY+l.air,'the painted frame is lifted with the rider');
  const [x,y]=run.seats[l.run.index];
  close(l.riderX,fx*(x-l.art.ground[0])*l.px,'hip x on the saddle');
  close(l.riderY+l.hipY,l.groundY+air+(y-l.art.ground[1])*l.px,'hip y on the saddle, up in the air');
 }
 assert.equal(seen.size,20,'every wing position shows');
 const high=renderer.getLayout({id:'dragon',img,runImg,moving:1,phase:Math.PI}),low=renderer.getLayout({id:'dragon',img,runImg,moving:1,phase:0});
 assert.ok(high.air<low.air,'the downstroke lifts it');
 assert.ok(high.height>200,'a huge beast next to a 48-unit hero');
});

test('the boot on show is the rider\'s near leg: behind the facing, while the forward boot hides behind the mount',()=>{
 const {renderer}=harness();
 for(const id of ['horse','leopard','spectral-tiger','dragon'])for(const fx of [-1,1])for(const moving of [0,1]){
  const l=renderer.getLayout({id,img:sprite(id),fx,moving,phase:1});
  assert.ok(l.boots.near.x*fx<0,`${id} fx ${fx}: the visible boot hangs on the side away from the facing`);
  assert.ok(l.boots.far.x*fx>0,`${id} fx ${fx}: the hidden boot is the forward one`);
 }
});

test('the dragon\'s downstroke puffs air under its wings and rings the ground, then the air settles',()=>{
 const {renderer,context}=harness();
 const img=sprite('dragon'),run=renderer.getLayout({id:'dragon',img,moving:0}).art.profile.run;
 const runImg=sprite('dragon-fly',run.cols*run.cell[0],Math.ceil(run.frames/run.cols)*run.cell[1]);
 const gust=renderer.getLayout({id:'dragon',img,moving:0}).art.profile.gust;
 const puffs=(id,phase,moving=0,image=img,sheet=runImg)=>{const painted={ops:[]};renderer.draw(context(painted),{id,img:image,runImg:sheet,phase,moving});return painted.ops.filter(o=>o.kind==='gradient').length;};
 assert.equal(puffs('dragon',gust.at+.3),6,'three clouds under each wing just after the downstroke');
 assert.equal(puffs('dragon',gust.at+.3,1),6,'flying or hovering');
 assert.equal(puffs('dragon',gust.at-.3),0,'still air while the wings rise');
 assert.equal(puffs('dragon',gust.at+Math.PI*2*.6),0,'the puff has settled before the next beat');
 for(const id of ['horse','leopard','spectral-tiger'])assert.equal(puffs(id,gust.at+.3,1,sprite(id),null),0,'only a flyer moves air');
});
