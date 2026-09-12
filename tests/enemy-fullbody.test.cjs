const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mask}=require('../assets/boss/fullbody.js');
function raster(w,h,colour){
 const p=new Uint8ClampedArray(w*h*4);
 const set=(x,y,c)=>p.set(c,(y*w+x)*4),get=(x,y)=>Array.from(p.slice((y*w+x)*4,(y*w+x+1)*4));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)set(x,y,colour);
 return {p,w,h,set,get};
}
test('opaque masters lose only connected background and retain internal dark paint',()=>{
 const a=raster(11,11,[2,2,2,255]);
 for(let y=2;y<9;y++)for(let x=2;x<9;x++)a.set(x,y,[80,120,40,255]);
 a.set(5,5,[0,0,0,255]);a.set(2,4,[22,21,20,255]);
 const before=a.p.slice();mask(a.p,11,11,{key:'black'});
 assert.equal(a.get(0,0)[3],0);assert.deepEqual(a.get(5,5),[0,0,0,255]);
 assert.ok(a.get(2,4)[3]>0&&a.get(2,4)[3]<255);
 for(let i=0;i<a.p.length;i+=4)assert.deepEqual(a.p.slice(i,i+3),before.slice(i,i+3),'original painted RGB stays exact');
});
test('rat background key preserves white highlights behind painted outlines',()=>{
 const a=raster(11,11,[255,255,255,255]);
 for(let y=2;y<9;y++)for(let x=2;x<9;x++)a.set(x,y,[60,42,35,255]);
 a.set(5,5,[255,255,255,255]);mask(a.p,11,11,{key:'white'});
 assert.equal(a.get(0,0)[3],0);assert.deepEqual(a.get(5,5),[255,255,255,255]);
 assert.deepEqual(a.get(2,2),[60,42,35,255]);
});
test('reviewed detached reference removal cannot erase a large connected boss',()=>{
 const a=raster(16,12,[255,255,255,255]);
 for(let y=1;y<11;y++)for(let x=7;x<15;x++)a.set(x,y,[80,40,30,255]);
 for(let y=7;y<10;y++)for(let x=1;x<4;x++)a.set(x,y,[0,0,0,255]);
 mask(a.p,16,12,{key:'white',remove:[[2,8,12],[10,5,12]]});
 assert.equal(a.get(2,8)[3],0);assert.equal(a.get(10,5)[3],255);
});
function harness(){
 const canvases=[];
 const document={createElement(){const draws=[],c={width:0,height:0,draws};
  c.getContext=()=>({drawImage(...args){draws.push(args);},save(){},restore(){},translate(){},scale(){}});canvases.push(c);return c;}};
 const api=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/boss/fullbody.js'),'utf8')+';EnemyFullbody',{document});
 return {api,canvases,document};
}
const image=(src,w,h)=>({src,complete:true,naturalWidth:w,naturalHeight:h});
test('uncut originals retain historic torso coordinates and cache across enemy instances',()=>{
 const {api,canvases}=harness(),skin={img:image('body',650,847),original:image('master',1024,1024),frame:[183,51,650,847]};
 const a=api.get(skin);assert.equal(a.x,-183);assert.equal(a.y,-51);assert.equal(a.width,1024);assert.equal(a.height,1024);
 assert.equal(api.get(skin),a);assert.equal(canvases.length,1);
 assert.equal(canvases[0].draws.length,1);assert.equal(canvases[0].draws[0][0],skin.original);
 skin.original.src='new-master';assert.notEqual(api.get(skin),a);assert.equal(canvases.length,2);
});
test('missing art retries after load and static feet are joined behind the body only once',()=>{
 const {api,canvases}=harness(),foot=image('foot',20,30),body=image('body',100,120);
 const skin={img:body,join:[{img:foot,x:20,y:112,w:20,h:30},{img:foot,x:65,y:112,w:20,h:30,flip:true}]};
 foot.complete=false;assert.equal(api.get(skin),null);assert.equal(canvases.length,0);
 foot.complete=true;const a=api.get(skin);assert.equal(a.height,142);assert.equal(a.width,100);
 assert.deepEqual(canvases[0].draws.map(d=>d[0]),[foot,foot,body]);assert.equal(api.get(skin),a);
 const master=image('master',128,128);master.complete=false;
 const s={img:body,original:master,frame:[0,0,100,120]};assert.equal(api.get(s),null);master.complete=true;assert.ok(api.get(s));
});
test('restored canvases retain the actual game mip downscaling and reuse the cached reduction',()=>{
 const {api,canvases,document}=harness(),skin={img:image('body',650,847),original:image('master',1024,1024),frame:[183,51,650,847]};
 const art=api.get(skin).img;assert.equal(art.naturalWidth,1024);assert.equal(art.naturalHeight,1024);assert(art.complete);
 const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
 const source=game.slice(game.indexOf('function mip('),game.indexOf('/* crisp():'));
 const mip=vm.runInNewContext(source+';mip',{document,spriteEdgeSource:im=>im,zoom:1,DPR:1});
 const small=mip(art,64);assert.equal(small.width,128);assert.equal(small.height,128);
 assert.equal(canvases.length,4,'master plus three progressive half-steps');
 assert.equal(mip(art,64),small);assert.equal(canvases.length,4);
});
