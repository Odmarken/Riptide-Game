const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Arena=require('../assets/boss/odin-arena.js'),root=path.join(__dirname,'..');
test('Odin uses the supplied 2400 by 1600 floor at native size, with four ring braziers',()=>{
 const png=fs.readFileSync(path.join(root,'assets/models/maps/odin_bosszone.png')),w=Arena.create();
 assert.equal(w.w,2400);assert.equal(w.h,1600);assert.equal(w.w,png.readUInt32BE(16));assert.equal(w.h,png.readUInt32BE(20));
 assert.equal(w.solids.length,4);
 assert.equal(new Set(w.solids.map(s=>Math.sign(s.x-Arena.BOSS.x)+','+Math.sign(s.y-Arena.BOSS.y))).size,4);
 for(const s of w.solids){assert.equal(s.kind,'brazier');assert.equal(s.type,'throneprop');assert.ok(s.x>0&&s.x<w.w&&s.y>0&&s.y<w.h);}
 for(const [cx,cy,rx,ry] of Arena.RAVENS){assert.ok(cx-rx>=0&&cx+rx<=w.w&&cy-ry>=0&&cy+ry<=w.h);}
 const src=fs.readFileSync(path.join(root,'game.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(src,/if\(z\.amb==='odin'\)g\.drawImage\(mImg,0,0\);/);
 assert.ok(html.indexOf('assets/boss/odin-arena.js')<html.indexOf('<script src="game.js'));
});
test('spawned crows use the raven PNG, animate, face the target and restore canvas state',()=>{
 const calls=[],g={save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...v){calls.push(['translate',...v]);},rotate(v){calls.push(['rotate',v]);},scale(...v){calls.push(['scale',...v]);},drawImage(...v){calls.push(['image',...v]);}};
 const en={x:200,y:200,home:{x:200},r:11},im={complete:true,naturalWidth:640,naturalHeight:338};
 assert.equal(Arena.drawCrow(g,en,{x:300,y:200},1,im),true);
 assert.equal(calls.find(c=>c[0]==='rotate')[1],Math.PI/2);
 assert.equal(calls.find(c=>c[0]==='image')[1],im);
 const first=calls.find(c=>c[0]==='scale')[1];calls.length=0;
 Arena.drawCrow(g,en,{x:200,y:100},1.2,im);assert.notEqual(calls.find(c=>c[0]==='scale')[1],first);
 assert.equal(calls[0][0],'save');assert.equal(calls.at(-1)[0],'restore');
 calls.length=0;assert.equal(Arena.drawCrow(g,en,null,0,{complete:false}),false);assert.equal(calls.length,0);
});
