const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hybrids=require('../assets/tides/hybrids.js'),catalog=require('../assets/tides/catalog.js'),manifest=require('../assets/tides/hybrids-manifest.json');
const root=path.resolve(__dirname,'..');

test('all 300 original-species pairings have unique art mappings with complete native Higgsfield source provenance',()=>{
 assert.equal(hybrids.length,300);assert.equal(manifest.count,300);
 const parents=new Map(catalog.map(p=>[p.id,0])),pairs=new Set(),ids=new Set(),sheets=new Map(manifest.sheets.map(s=>[s.file,s]));
 for(const h of hybrids){
  assert.ok(parents.has(h.parentA)&&parents.has(h.parentB));assert.notEqual(h.parentA,h.parentB);
  const key=[h.parentA,h.parentB].sort().join('|');assert.ok(!pairs.has(key));pairs.add(key);assert.ok(!ids.has(h.id));ids.add(h.id);
  parents.set(h.parentA,parents.get(h.parentA)+1);parents.set(h.parentB,parents.get(h.parentB)+1);
  const a=h.art,s=sheets.get(a.file);assert.ok(s,h.id);assert.equal(a.width,s.width);assert.equal(a.height,s.height);
  const [x,y,w,hgt]=a.rect;assert.ok([x,y,w,hgt].every(Number.isFinite));assert.ok(x>=0&&y>=0&&w>0&&hgt>0&&x+w<=s.width&&y+hgt<=s.height,h.id);
  assert.deepEqual(a.rect,a.sourceRect);if(a.clipPathD)assert.match(a.clipPathD,/^M/);
 }
 assert.ok([...parents.values()].every(n=>n===24));
 for(const s of sheets.values()){
  const bytes=fs.readFileSync(path.join(root,s.file));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),s.width);assert.equal(bytes.readUInt32BE(20),s.height);assert.equal(bytes[25],6,'native RGBA');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256,s.file+' stays identical to reviewed Higgsfield output');
  assert.ok(s.jobId&&s.sourceUrl.startsWith('https://'));
 }
});

test('the incubator is the recorded native transparent Higgsfield asset with a clear exterior and solid doorway',()=>{
 const m=require('../assets/farm/tide-incubator-manifest.json'),bytes=fs.readFileSync(path.join(root,m.file));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m.sha256);
 const {readRgbaPng}=require('./helpers/png.cjs'),im=readRgbaPng(path.join(root,m.file));
 const px=im.pixels||im.rgba,at=(u,v)=>px[(Math.floor(v*im.height)*im.width+Math.floor(u*im.width))*4+3];
 assert.equal(im.width,m.width);assert.equal(im.height,m.height);
 for(const [x,y]of[[.02,.02],[.98,.02],[.02,.98],[.98,.98]])assert.equal(at(x,y),0);
 assert.ok(at(.37,.8)>200,'front doorway remains opaque');
});
