/* The bronze cursors (2026-09-26): an arrow for pointing and a bronze hand for anything that can be clicked. Every
 * stylesheet and inline style says cursor:var(--arrow) or cursor:var(--hand), which assets/ui/cursors.js fills in with the
 * art - a system `pointer` or `default` left anywhere shows Windows' own white hand or arrow in the middle of the bronze.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

/* the game's own sources: the root page, script and stylesheet, and every .css/.js under assets/ */
function sources(){
 const out=['index.html','game.js','style.css'];
 const walk=dir=>{for(const e of fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})){
  const f=dir+'/'+e.name;
  if(e.isDirectory())walk(f);else if(/\.(css|js)$/.test(e.name))out.push(f);
 }};
 walk('assets');
 return out;
}

test('no stylesheet or inline style asks for the system pointer or default cursor',()=>{
 const bad=[];
 for(const f of sources()){
  read(f).split('\n').forEach((line,i)=>{
   if(/cursor\s*:\s*(pointer|default)\b|\.cursor\s*=\s*[^;\n]*['"](pointer|default)['"]/.test(line))bad.push(f+':'+(i+1)+'  '+line.trim().slice(0,90));
  });
 }
 assert.deepEqual(bad,[],'use cursor:var(--hand) for clickable things and cursor:var(--arrow) for the rest');
});

test('the page loads the cursors before it draws, and the arrow is the ground everywhere',()=>{
 const html=read('index.html'),head=html.slice(0,html.indexOf('</head>'));
 assert.match(head,/<script src="assets\/ui\/cursors\.js\?v=\d+"><\/script>/,'cursors.js runs in the head, so the first frame already has the bronze');
 const css=read('style.css');
 assert.match(css,/--arrow:default;\s*--hand:pointer;/,'the system cursors stand in until cursors.js runs');
 assert.match(css,/html\{cursor:var\(--arrow\)\}/);
 assert.match(css,/label,select,option\{cursor:var\(--arrow\)\}/,'the engine gives these the system arrow of its own accord');
});

test('the art is all there: both cursors at 32 and 64 px, square, with the hot spots cursors.js uses',()=>{
 const js=read('assets/ui/cursors.js');
 const manifest=JSON.parse(read('assets/ui/cursors/cursor-art-manifest.json'));
 for(const [art,x,y] of [['bronze_a_point',0,0],['bronze_a_grab',16,12]]){
  assert.ok(js.includes("'"+art+"',"+x+','+y+','),art+' is set with hot spot '+x+','+y);
  assert.deepEqual(manifest.files[art+'.png'].sizes['32'].hotspot,[x,y]);
  for(const px of [32,64]){
   const png=fs.readFileSync(path.join(ROOT,'assets/ui/cursors/'+art+'_'+px+'.png'));
   assert.equal(png.toString('ascii',1,4),'PNG');
   assert.equal(png.readUInt32BE(16),px,art+'_'+px+' is '+px+' wide');
   assert.equal(png.readUInt32BE(20),px,art+'_'+px+' is '+px+' high');
  }
 }
});
