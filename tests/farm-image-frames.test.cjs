const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const start=game.indexOf('const farmImgs={};'),end=game.indexOf('const FARM_BUILD=[',start);
assert.ok(start>=0&&end>start);
function setup(){
 const draws=[],canvases=[],images=[];
 class Image{constructor(){this.complete=false;this.naturalWidth=this.naturalHeight=0;images.push(this);}}
 const document={createElement(tag){assert.equal(tag,'canvas');const c={getContext(){return {drawImage(...args){draws.push(args);}};}};canvases.push(c);return c;}};
 const api=vm.runInNewContext(game.slice(start,end)+';({farmImg,farmImageSource,farmAssetUrl})',{document,Image});
 return {api,draws,canvases,images};
}
test('the padded fence export preserves existing Farm snap and paddock dimensions',()=>{
 const {api,draws}=setup(),raw=api.farmImg('staket_ovan');
 Object.assign(raw,{complete:true,naturalWidth:1024,naturalHeight:3072});
 const logical=api.farmImg('staket_ovan');
 assert.equal(logical.naturalWidth,145);assert.equal(logical.naturalHeight,1045);
 assert.equal(13*logical.naturalHeight/logical.naturalWidth,13*1045/145,'saved fence rows keep their original length');
 assert.equal(raw.naturalWidth,1024,'source image is not mutated');assert.equal(raw.naturalHeight,3072);
 assert.deepEqual(draws[0],[raw,338,0,346,3072,0,0,145,1045]);
 assert.equal(logical.complete,true);assert.match(logical.src,/staket_ovan\.png\?v=2$/);
});
test('fence framing waits for loading and is cached until the source changes',()=>{
 const {api,canvases}=setup(),raw=api.farmImg('staket_ovan');
 assert.equal(api.farmImg('staket_ovan'),raw);assert.equal(canvases.length,0);
 Object.assign(raw,{complete:true,naturalWidth:1024,naturalHeight:3072});
 const frame=api.farmImg('staket_ovan');assert.equal(api.farmImg('staket_ovan'),frame);assert.equal(canvases.length,1);
 raw.src+='&revision=next';assert.notEqual(api.farmImg('staket_ovan'),frame);assert.equal(canvases.length,2);
});
test('horizontal fences and unrelated farm art retain their original pixels and sizing',()=>{
 const {api,canvases}=setup();
 for(const name of ['staketvit_sidan','tide_incubator','tree_farm']){
  const raw=api.farmImg(name);Object.assign(raw,{complete:true,naturalWidth:1032,naturalHeight:394});
  assert.equal(api.farmImg(name),raw);
 }
 const legacy={complete:true,naturalWidth:145,naturalHeight:1045,src:'old-staket.png'};
 assert.equal(api.farmImageSource('staket_ovan',legacy),legacy,'an unexpected or legacy asset never becomes an empty crop');
 assert.equal(canvases.length,0);
 assert.equal(api.farmAssetUrl('staketvit_sidan'),'assets/farm/staketvit_sidan.png');
 assert.equal(api.farmAssetUrl('tide_incubator'),'assets/farm/tide_incubator.png?v=2');
});
