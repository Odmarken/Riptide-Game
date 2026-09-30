/* The painted window backdrops (assets/ui/modal-art-manifest.json): every picture the manifest lists exists, is a real
   JPEG of a sensible size, and is wired to each of its windows in style.css - and every window it names exists in the
   page. A backdrop that goes missing leaves a plain box, which nothing else would notice. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/ui/modal-art-manifest.json'),'utf8'));
const css=fs.readFileSync(path.join(ROOT,'style.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const jpegSize=buf=>{ /* width and height from the first SOF marker */
 let i=2;
 while(i<buf.length){
  if(buf[i]!==0xFF){i++;continue;}
  const m=buf[i+1],len=buf.readUInt16BE(i+2);
  if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return {h:buf.readUInt16BE(i+5),w:buf.readUInt16BE(i+7)};
  i+=2+len;
 }
 return null;
};
test('every listed backdrop is a JPEG between 500 and 1024 px on its long side, and small enough to ship',()=>{
 assert.ok(manifest.images.length>=20);
 for(const im of manifest.images){
  const buf=fs.readFileSync(path.join(ROOT,'assets/ui',im.file));
  assert.equal(buf[0],0xFF,im.file);assert.equal(buf[1],0xD8,im.file);
  const s=jpegSize(buf);assert.ok(s,im.file+' has a frame header');
  const long=Math.max(s.w,s.h);
  assert.ok(long>=500&&long<=1024,im.file+' long side '+long);
  assert.ok(buf.length<400*1024,im.file+' is '+Math.round(buf.length/1024)+' KB');
  assert.match(im.job,/^[0-9a-f-]{36}$/,im.file+' records its Higgsfield job');
 }
});
test('each window named in the manifest exists in index.html and gets its picture from style.css',()=>{
 for(const im of [...manifest.images,...manifest.reused]){
  for(const w of im.windows){
   assert.match(html,new RegExp('id="'+w+'"'),w+' is in the page');
   const rule=css.split('\n').find(l=>l.includes('#'+w)&&l.includes("url('assets/ui/"+im.file+"')"));
   assert.ok(rule,w+' shows '+im.file);
   assert.match(rule,/linear-gradient\(180deg,rgba\([^)]*,\.[6-9]\d?\),rgba\([^)]*,\.[89]\d?\)\),url/,w+' keeps a dark wash over the picture so the text stays readable');
  }
 }
});
test('the crown ledger rule outranks ledger.css, which loads after style.css and sets its own background',()=>{
 assert.match(css,/#ledgerFx\.craft-modal \.craft-ledger\{background:[^}]*modal_ledger\.jpg/);
 assert.match(html,/id="ledgerFx" class="craft-modal"/);
});
test('the small boxes styled inline in index.html need !important to take a picture',()=>{
 for(const w of ['cryptIntro','gateMsg','ritualBox','altarMsg','iceReqMsg','iceMsg']){
  const rule=css.split('\n').find(l=>new RegExp('#'+w+'[,{]').test(l)&&l.includes('url('));
  assert.ok(rule&&/!important\}/.test(rule),w);
 }
});
