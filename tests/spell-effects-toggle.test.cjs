/* Run with: node --test tests/spell-effects-toggle.test.cjs
 * 📱 Spell effects on phones (asked for 2026-10-10: "gör så alla telefoner kan klicka av dom här nya effekterna ... men bara för
 * telefonerna ... alltså effekterna för spells ... gör så man fortfarande ser bossens attacker men inte effekt mässigt").
 * Settings > Video > Spell effects, shown on phones only (the web game on a phone or tablet). Off: the spells' and the bosses'
 * own looks (assets/fx) are left out and the game draws its plain ones - the old rings, bursts, bolts and warnings, so a boss's
 * attacks are still marked. The weapon runes, the Tide battles and the heat haze are not part of it.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('game.js');

function stubCtx(){const grad={addColorStop(){}};return new Proxy({},{get(t,k){if(k in t)return t[k];if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>grad;if(k==='getTransform')return ()=>({a:1,b:0,c:0,d:1,e:0,f:0});return ()=>{};},set(t,k,v){t[k]=v;return true;}});}
function load(){
 const box=vm.createContext({Math,Number,Array,Map,Set,Object,JSON,String,performance:{now:()=>0}});
 vm.runInContext('globalThis.module=undefined;',box);
 for(const f of ['spell-fx.js','spells-warrior.js','spells-mage.js','spells-hunter.js','spells-priest.js','boss-fx.js','rune-fx.js'])vm.runInContext(read('assets/fx/'+f),box,{filename:f});
 box.SpellFx.setCanvasFactory((w,h)=>({width:w,height:h,getContext:()=>stubCtx()}));
 return box.SpellFx;
}

test('the setting: on unless switched off, a real true/false only, kept on the device and through Reset',()=>{
 const D=require('../assets/ui/display-settings.js');
 assert.equal(D.normalize(null).spellFx,true);assert.equal(D.normalize({spellFx:false}).spellFx,false);assert.equal(D.normalize({spellFx:'no'}).spellFx,true);
 const kept={},els={},doc={getElementById:id=>els[id]||(els[id]={checked:false,value:100,min:60,max:140,style:{setProperty(){}},setAttribute(){},addEventListener(t,f){this.on=f;}})};
 const storage={getItem:k=>kept[k]??null,setItem:(k,v)=>{kept[k]=v;}},told=[];
 D.create({doc,storage,onChange:v=>told.push(v.spellFx)});
 assert.equal(els.spellFxChk.checked,true,'the box shows it');
 els.spellFxChk.on({target:{checked:false}});
 assert.equal(told.at(-1),false,'the game is told');assert.equal(JSON.parse(kept[D.STORAGE_KEY]).spellFx,false,'saved on the device');
 els.videoReset.on();assert.equal(told.at(-1),false,'Reset (brightness and contrast) leaves it');
});

test('off: every spell\'s and boss\'s look answers as if it were not there, so the plain one is drawn; the runes keep theirs',()=>{
 const FX=load(),g=stubCtx();
 assert.equal(FX.effects,true);
 for(const id of ['fireball','heroic','shot','firebolt','boss:meteor','boss:thorstorm','rune:emberbite'])assert.equal(FX.has(id),true,id);
 FX.cast('fireball',{x:0,y:0,gy:16,fx:1,tx:100,ty:0,targets:[]});assert.ok(FX.count().effects>0);
 FX.effects=false;
 assert.equal(FX.count().effects+FX.count().particles,0,'what was on screen goes at once');
 for(const id of ['fireball','heroic','shot','firebolt','boss:meteor','boss:thorstorm','boss:dgcast'])assert.equal(FX.has(id),false,id+' is plain');
 assert.equal(FX.cast('fireball',{x:0,y:0,gy:16,fx:1}),false);assert.equal(FX.hit('fireball',{x:0,y:0,r:16}),false);
 assert.equal(FX.cast('boss:enrage',{x:0,y:0,r:100}),false,'and a boss falls back to its old ring');
 assert.equal(FX.drawBolt(g,{x:0,y:0,tgt:{x:9,y:9},fx:'fireball'},0),false,'the game draws its own bolt');
 assert.equal(FX.drawHazard(g,{x:0,y:0,rad:60,t:.5,warn:1,fx:'boss:meteor'},0),false,'and its own warning ring');
 assert.equal(FX.drawSpecial('boss:soulbeam',g,{x:0,y:0},0),false);
 let drew=0;FX.auras(new Proxy(g,{get:(t,k)=>k==='save'?()=>{drew++;}:t[k]}),{gy:16,fx:1,atk:{left:5,dur:6},haste:{left:5,dur:6},hot:{left:5,dur:6}},'glow',1);
 assert.equal(drew,0,'no aura round the hero');
 assert.equal(FX.hit('rune:emberbite',{x:0,y:0,r:16}),true,'a weapon rune is not a spell: it keeps its look');
 FX.effects=true;assert.equal(FX.cast('fireball',{x:0,y:0,gy:16,fx:1,tx:100,ty:0,targets:[]}),true,'and on again');
});

test('the game: the row on phones only, the switch only on phones, and the plain looks it falls back to',()=>{
 assert.match(game,/const PHONE=IS_TOUCH&&!window\.desktop;/,'a phone or tablet in the browser, never the desktop build');
 assert.ok(game.includes('SUN.q=v.lightQuality;SpellFx.effects=!PHONE||v.spellFx;}});'),'on a computer the effects are always on');
 assert.ok(game.includes("$('spellFxRow').hidden=!PHONE;"));
 const html=read('index.html'),css=read('style.css');
 assert.ok(html.includes('<label class="cfgrow cfgchk" id="spellFxRow" hidden><input type="checkbox" id="spellFxChk" checked><span>Spell effects</span></label>'));
 assert.ok(html.indexOf('id="spellFxRow"')>html.indexOf('id="weatherChk"')&&html.indexOf('id="spellFxRow"')<html.indexOf('id="lightQRow"'),'under Weather');
 assert.match(css,/\.cfgrow\[hidden\]\{display:none\}/,'a hidden row stays hidden although rows are flex boxes');
 assert.ok(game.includes('ownFx=SpellFx.has(sp.fx)'),'a spell without its look draws the old rings');
 assert.ok(game.includes('if(!SpellFx.effects&&chance(0.35))zapLine(cx,cy-10,cx+ux*LEN,cy+uy*LEN);'),'Thor\'s storm crackles its whole length again when the effects are off');
 assert.match(game,/if\(h\.fx&&SpellFx\.drawHazard\(ctx,h,now\)\)continue;/,'a boss\'s warning falls through to the plain ring');
});
