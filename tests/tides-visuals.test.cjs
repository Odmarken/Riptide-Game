const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const catalog=require('../assets/tides/catalog.js'),source=fs.readFileSync(path.join(__dirname,'../assets/tides/ui.js'),'utf8');
const art={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/tides/art-layout.js'),'utf8'),art);
const byId=new Map(catalog.map(s=>[s.id,s]));
function harness(){
 const c={species:id=>byId.get(id),TideArtLayout:art.TideArtLayout,frameFor:id=>{const b=art.TideArtLayout[id].bounds;return {w:b[2],h:b[3]};}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf(' function animalVisual('),source.indexOf(' function stopHero(')),c);return c;
}

test('every Tide has a physical visual scale and world sprites follow animal size instead of rarity',()=>{
 const c=harness();assert.equal(catalog.length,25);assert.ok(catalog.every(s=>Number.isFinite(s.visualScale)&&s.visualScale>=.7&&s.visualScale<=2.2));
 assert.ok(c.animalVisual('obsidianbear').height>c.animalVisual('bramblebunny').height*1.7);
 assert.ok(c.animalVisual('spectralwyrm').height>c.animalVisual('obsidianbear').height);
 assert.ok(c.animalVisual('meadowmouse').height<c.animalVisual('bramblebunny').height);
 for(const s of catalog){const size=c.animalVisual(s.id),bounds=art.TideArtLayout[s.id].bounds;assert.equal(size.height,36*s.visualScale);assert.ok(Math.abs(size.width/size.height-bounds[2]/bounds[3])<1e-8);}
});

test('every pair fits mobile and desktop battle arenas, preserves relative size and stops melee at the opponent',()=>{
 const c=harness();
 for(const [w,h]of [[390,844],[1440,1000],[844,390],[320,568]])for(const player of catalog)for(const foe of catalog){
  const l=c.battleLayout(w,h,player.id,foe.id),p=l.player,f=l.foe,label=`${w}x${h} ${player.id}/${foe.id}`;
  assert.ok(l.left-p.width*.55>l.heroRight,label+' clear of hero');
  assert.ok(l.right+f.width*.55<=w-11.9,label+' right wing fits');
  assert.ok(l.left+p.width*.55<l.right-f.width*.55,label+' standing animals do not overlap');
  assert.ok(l.floor-Math.max(p.height,f.height)*1.08>=Math.min(130,h*.18)-.01,label+' heads fit below top');
  assert.ok(Math.abs(p.height/f.height-player.visualScale/foe.visualScale)<1e-8,label+' relative animal size retained');
  assert.ok(l.left+l.travel<l.right&&l.right-l.travel>l.left,label+' attack does not cross opponent');
  assert.ok(l.left+l.travel+p.width*.55<=w,label+' charging player stays on screen');
  assert.ok(l.right-l.travel-f.width*.55>l.heroRight,label+' charging opponent stays clear of hero');
 }
});

test('actual wild click handling includes tall heads and wide wings while retaining small animal click targets',()=>{
 const c=harness(),animals=[{id:'giant',speciesId:'spectralwyrm',x:1000,y:1000},{id:'small',speciesId:'meadowmouse',x:2000,y:1000}],opened=[];
 Object.assign(c,{wildList:()=>animals,hero:{x:1000,y:1000},openWild:id=>opened.push(id),marker:null});
 vm.runInContext(source.slice(source.indexOf(' function wildClick('),source.indexOf(' function openWild(')),c);
 const b=c.wildBounds(animals[0]),small=c.wildBounds(animals[1]);assert.ok(b.height>70);assert.ok(small.right-small.left>=52);
 assert.equal(c.wildClick(1000,1006-b.height+2),true,'head above the former fixed58px target');assert.equal(opened.pop(),'giant');
 assert.equal(c.wildClick(1000+b.width*.48,1006-b.height*.5),true,'outer wing follows source aspect');assert.equal(opened.pop(),'giant');
 assert.equal(c.wildClick(b.right+5,1000),false,'empty space outside model target');
 c.hero.x=2000;assert.equal(c.wildClick(small.right-1,1000),true);assert.equal(opened.pop(),'small');
});
