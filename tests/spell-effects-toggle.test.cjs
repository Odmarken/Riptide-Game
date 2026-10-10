/* Run with: node --test tests/spell-effects-toggle.test.cjs
 * 📱 Spell effects on phones (asked for 2026-10-10: "gör så alla telefoner kan klicka av dom här nya effekterna ... men bara för
 * telefonerna ... alltså effekterna för spells ... gör så man fortfarande ser bossens attacker men inte effekt mässigt").
 * Settings > Video > Spell effects, shown on phones only (the web game on a phone or tablet). Off: the spells' and the bosses'
 * own looks (assets/fx) are left out and the game draws its plain ones - the old rings, bursts, bolts and warnings, so a boss's
 * attacks are still marked. The weapon runes, the Tide battles and the heat haze are not part of it.
 * The same day the row became GPU acceleration ("kan man göra att effekt knappen i settings idag att den stänger av webGL ...
 * döp den till GPU acceleration", tests/gpu-acceleration.test.cjs): the effects are on for everyone again. SpellFx can still
 * mute itself (SpellFx.effects) and the game keeps the plain looks it would fall back to, but nothing switches it now.
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

test('the setting is gone: a phone that switched the effects off has them back, and the box is no more',()=>{
 const D=require('../assets/ui/display-settings.js');
 assert.equal('spellFx' in D.normalize(null),false);assert.equal('spellFx' in D.normalize({spellFx:false}),false,'an old saved choice is dropped');
 const html=read('index.html');assert.ok(!html.includes('spellFxRow')&&!html.includes('spellFxChk')&&!html.includes('>Spell effects<'));
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

test('the game never switches the effects off, and keeps the plain looks they would fall back to',()=>{
 assert.ok(!/SpellFx\.effects\s*=/.test(game),'nothing in the game mutes them');
 assert.ok(!game.includes("$('spellFxRow')"));
 assert.ok(game.includes('ownFx=SpellFx.has(sp.fx)'),'a spell without its look draws the old rings');
 assert.ok(game.includes('if(!SpellFx.effects&&chance(0.35))zapLine(cx,cy-10,cx+ux*LEN,cy+uy*LEN);'),'Thor\'s storm crackles its whole length again when the effects are off');
 assert.match(game,/if\(h\.fx&&SpellFx\.drawHazard\(ctx,h,now\)\)continue;/,'a boss\'s warning falls through to the plain ring');
});
