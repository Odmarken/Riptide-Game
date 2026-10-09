/* Run with: node --test tests/heat-haze.test.cjs
 * 🔥 Heat haze (asked for 2026-10-09: "lägg in värmedis över eld och lava"). On the GPU (Lighting quality Medium and Ultra) the
 * air shimmers above every fire on the screen: the fires CityScenery draws note where they burn, game.js adds the burning spells,
 * fireballs, boss fire and torches, and assets/gl/gl2d.js heatHaze redraws the scene through a ripple there - tied to the ground,
 * with drifting patches of hot air in the ember lands. The shader itself is checked in the browser; here the bookkeeping.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const Scenery=require('../assets/city/scenery-effects.js');

function context(id,m={a:1,b:0,c:0,d:1,e:0,f:0}){
 const o={globalAlpha:1,canvas:{id},getTransform:()=>({...m}),
  createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 return new Proxy(o,{get(t,k){if(k in t)return t[k];return ()=>{};},set(t,k,v){t[k]=v;return true;}});
}

test('the fires note where they burn, in screen pixels, only on the screen and only between heatBegin and heatTake',()=>{
 const g=context('game',{a:2,b:0,c:0,d:2,e:100,f:50});
 Scenery.fire(g,10,20,1,0,0);
 Scenery.heatBegin();assert.equal(Scenery.heatTake().length,0,'a fire drawn before the frame began is not counted');
 Scenery.heatBegin();
 Scenery.fire(g,10,20,1,0,0);
 Scenery.fire(context('propCache'),10,20,1,0,0);   /* a picture painted off the screen is not where the fire is */
 Scenery.fire(g,0,0,0,0,0);   /* no fire at size 0 */
 const im={naturalWidth:200,naturalHeight:400};
 Scenery.paintedFlame(g,im,100,200,-200,[.25,.1,.75,.4],0,0);
 const h=Scenery.heatTake();
 assert.equal(h.length,2);
 assert.deepEqual(h[0],{x:120,y:66,r:68,k:1},'the plume sits on the fire\'s tongue, as big as the fire is on the screen');
 const w=50,hh=60,x=-50+25,y=-200+20;   /* the painted patch: x,y,w,h in the picture's place */
 assert.equal(h[1].x,2*(x+w/2)+100);assert.equal(h[1].y,2*(y+hh*.35)+50);assert.ok(Math.abs(h[1].r-34*2*Math.max(w,hh)/36)<1e-9);
 Scenery.fire(g,10,20,1,0,0);assert.equal(Scenery.heatTake().length,2,'after the take nothing more is noted');
 Scenery.heatBegin();for(let i=0;i<50;i++)Scenery.fire(g,i,0,1,0,0);
 assert.equal(Scenery.heatTake().length,32,'a bounded list');
});

test('the shader: a plume above each source, the ripple tied to the ground, the rest of the picture untouched',()=>{
 const s=read('assets/gl/gl2d.js'),fs0=s.slice(s.indexOf('const HAZE_FS='),s.indexOf('}`;',s.indexOf('const HAZE_FS=')));
 assert.match(fs0,/uniform vec4 u_src\[24\]/);assert.match(fs0,/uniform vec2 u_org;uniform float u_sc;/);
 assert.match(fs0,/d\.y\+=s\.z\*\.75/,'the plume\'s middle is above the flame (y grows down the screen)');
 assert.match(fs0,/wp=\(p-u_org\)\/max\(u_sc,\.001\)/,'the ripples are laid on world coordinates');
 assert.match(fs0,/vec2 q=wp\*\.035/);assert.match(fs0,/u_time\*1\.9/,'and rise');
 assert.match(fs0,/if\(w<\.004\)\{o=texelFetch\(u_scene,ivec2\(fc\),0\);return;\}/,'where nothing is hot the pixel is copied as it was');
 assert.match(fs0,/if\(u_global>0\.0\)w=u_global\*1\.8\*smoothstep/,'a hot land shimmers in patches, not all over');
 const fn=s.slice(s.indexOf(' function heatHaze(o){'),s.indexOf(' /* ---- a screen-sized layer'));
 assert.match(fn,/if\(!n&&!\(g0>0\)\)return;/,'nothing hot, no pass');
 assert.match(fn,/n=Math\.min\(24,src\.length\)/);
 assert.match(fn,/gl\.uniform2f\(P\.haze\.u\.u_org,wo\.x\|\|0,wo\.y\|\|0\);gl\.uniform1f\(P\.haze\.u\.u_sc,wo\.s\|\|1\)/);
 assert.match(s,/rays\(o\)\{rays\(o\);\},heatHaze\(o\)\{heatHaze\(o\);\}/,'the screen\'s context offers it');
});

test('game.js: Medium and Ultra only, the fires noted through the world pass, the shimmer laid before the weather',()=>{
 const g=read('game.js');
 assert.match(g,/const heatWanted=\(\)=>\{const q=glFx\(\);return !!\(q&&q!=='low'&&ctx\.heatHaze\);\};/,'Low and the plain canvas skip it');
 const a=g.indexOf('heatWorld=ctx.getTransform();const heatOn=heatWanted();if(heatOn)CityScenery.heatBegin();');
 const b=g.indexOf(' if(heatOn)heatPass(z,now);'),c=g.indexOf(' if(sunFrame&&(WEATHER.rain>0||WEATHER.snow>0))drawWeather(now);');
 assert.ok(a>0&&b>a&&c>b,'begin with the world, shimmer after the glow layer, rain and snow fall in front of it');
 assert.ok(g.lastIndexOf("SpellFx.auras(ctx,heroAuraState(hero,heroGroundY()),'glow',now)",b)>a,'the glow layer is inside the hot picture');
 const fnA=g.indexOf('function heatPass(z,now){'),fn=g.slice(fnA,g.indexOf('\n}\n',fnA));
 for(const id of ['boss:embertrail','boss:meteor','boss:eruption','boss:hellfire'])assert.ok(g.includes(`'${id}'`)&&/const HEAT_FX=new Set\(\[[^\]]*'boss:meteor'/.test(g),id);
 assert.match(fn,/c\[0\]>200&&c\[1\]<195&&c\[2\]<170&&c\[0\]>c\[2\]\+80&&c\[1\]>c\[2\]/,'only orange spell lights are fire, not frost, holy gold, plain white or blood');
 assert.match(fn,/for\(const b of bolts\)if\(HEAT_BOLTS\.has\(b\.fx\)&&heatWarm\(b\.c\)\)/);
 assert.match(fn,/if\(z\.dungeon==='cindervein'\)for\(const en of enemies\)/,'the fire guardians heat the ground they will strike');
 assert.match(fn,/R=\(cone\?c\.range:c\.radius\)\|\|100/,'a cone reaches its range');
 assert.match(fn,/if\(z\.finalb\)for\(const s of world\.solids\)if\(s\.type==='finaltorch'\)/);
 assert.match(fn,/global=\(z\.amb==='ember'\|\|z\.dungeon==='cindervein'\)\?\.22:0/);
 assert.match(fn,/world:m\?\{x:m\.e,y:m\.f,s:Math\.hypot\(m\.a,m\.b\)\}:null/);
 const warm=new Function('return '+/const heatWarm=(c=>\{[^\n]*?\});/.exec(g)[1])();
 assert.equal(warm('#ff9a4a'),true,'the mage\'s flame');assert.equal(warm('#ff7a3a'),true);
 assert.equal(warm('#6ac0e0'),false,'a water bolt');assert.equal(warm('#c9a0ff'),false,'soul fire is violet, not hot');
 assert.equal(warm(undefined),true,'a fire bolt with no colour of its own');
});
