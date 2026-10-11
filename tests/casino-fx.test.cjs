/* The casino's show (2026-10-11): assets/casino/casino-fx.js draws the lights, Lucky 7's lever, the roulette wheel and its ball,
 * coins, beams and banners for every casino window - the slots, Blackjack, Roulette, Ride the Bus, Sebbe's cups, the duel and the
 * menu. It is look only: game.js decides every outcome and tells it what happened through one small wrapper per window, so this
 * pins that it loads before the game, answers every call game.js makes, survives calls with no window on screen, never touches
 * the hero, the gold, a save or the odds, and that every painted picture has its art and its line in the manifest.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),game=read('game.js'),src=read('assets/casino/casino-fx.js');
/* the wrapper of each window, and the window it speaks for */
const LOOKS={l7Look:'slotFx',seaLook:'seaFx',fiveLook:'fiveFx',bjLook:'bjFx',rouLook:'rouFx',rtbLook:'rtbFx',cupLook:'sebbeFx',gvbLook:'gvbFx',menuLook:'casinoMenu'};

/* the module in a vm: no window open, no DOM to speak of */
function load(){
 const ctx={window:{},performance:{now:()=>1000},document:{getElementById:()=>null,createElement:()=>({getContext:()=>null})},
  matchMedia:()=>({matches:false}),requestAnimationFrame:()=>0,getComputedStyle:()=>({getPropertyValue:()=>''}),setTimeout:()=>0,clearTimeout(){}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return ctx.window.CasinoFX;
}

test('the page loads the show after the stylesheets and before game.js',()=>{
 const head=html.slice(0,html.indexOf('</head>'));
 assert.match(head,/<link rel="stylesheet" href="assets\/casino\/casino-fx\.css\?v=\d+">/);
 const fx=html.indexOf('<script src="assets/casino/casino-fx.js?v='),main=html.indexOf('<script src="game.js?v=');
 assert.ok(fx>0&&fx<main,'casino-fx.js before game.js');
});

test('every casino window has its wrapper: try/catch round a CasinoFX call for that window, inside the code its tests cut',()=>{
 for(const [fn,win] of Object.entries(LOOKS)){
  const def=`function ${fn}(name,...a){try{if(typeof CasinoFX!=='undefined'&&CasinoFX[name])return CasinoFX[name]('${win}',...a);}catch(e){try{console.warn(`;
  assert.equal(game.split(def).length-1,1,fn+' defined once, for '+win);
 }
 /* each sits in its own game's section, which is what that game's test cuts and runs */
 const at=s=>game.indexOf(s);
 for(const [fn,from,to] of [['l7Look','/* ==================== SLOT MACHINE','/* ==================== SLOTS - hold'],['seaLook','const SEA_BETS=','/* ==================== BLACKJACK'],
  ['bjLook','/* ==================== BLACKJACK','/* ==================== ROULETTE'],['rouLook','/* ==================== ROULETTE','/* ==================== 🚌 RIDE THE BUS'],
  ['cupLook',"/* ==================== 🥤 SEBBE'S CUP GAME",'const RTB_BETS='],['rtbLook','const RTB_BETS=','/* ==================== 🎲 GAMBLE AGAINST FRIEND'],
  ['gvbLook','/* ==================== 🎲 GAMBLE AGAINST FRIEND','/* ==================== ❄ ICE ARMOR'],
  ['fiveLook','/* ==================== 5️⃣ FIVE FIVE FIVE','/* ==================== CASINO BUILDING MENU']]){
  const i=at('function '+fn+'(');assert.ok(i>at(from)&&i<at(to),fn+' inside its section');
 }
});

test('it answers every call game.js makes, and none of them throws with no window on screen',()=>{
 const FX=load();
 assert.ok(FX,'window.CasinoFX');
 const named=new Set([...game.matchAll(new RegExp('\\b(?:'+Object.keys(LOOKS).join('|')+')\\(\'(\\w+)\'','g'))].map(m=>m[1]));
 assert.ok(named.size>=20,'the hooks: '+[...named]);
 for(const n of named)assert.equal(typeof FX[n],'function',n);
 const any={row:['7️⃣','7️⃣','🍒'],tease:true,mul:10,amount:1000,mult:10,ms:4000,ok:true,x:'2.00x',res:7,win:36000,total:1000,num:true,from:0,to:-30,dur:4200,idx:3,t0:1000,at:'#nowhere'};
 for(const id of Object.values(LOOKS))for(const n of named)assert.doesNotThrow(()=>FX[n](id,any,true),id+' '+n);
 /* with nothing on screen a win is not handled, so game.js keeps its own confetti */
 assert.equal(FX.win('slotFx',{mul:10,amount:1000,ms:4000}),false);
 assert.equal(FX.cheer('bjFx',{amount:1000}),false);
 assert.equal(FX.rouLand('rouFx',any),false);
});

test('look only: the show never touches the hero, gold, saves or the odds; the lever pulls through Spin; the wheel keeps its fallback',()=>{
 /* (the game's bare save(), not a canvas context's g.save()) */
 for(const word of [/\bS\./,/(?<![.\w])save\(/,/spendGold|addGold|totalGold|addScraps/,/slotOutcome|seaRollOutcome|SEA_OUTCOMES|rouSettle|bjSettle|rtbPay|gvbDecide/,/spinSlots\(|spinSea\(|rouSpinNow\(|bjDeal\(|cupPick\(/,/Math\.random\(\)\s*<\s*(SEA_BONUS_CHANCE|0\.\d+\)\s*return)/])
  assert.doesNotMatch(src,word,String(word));
 assert.match(src,/document\.getElementById\('slotSpinBtn'\);\s*if\(b&&!b\.disabled\)\{L\.fired=now\(\);b\.click\(\);/,'a pulled lever presses Spin, with all its guards');
 /* the painted wheel draws only when the show is there: the flat one stays below it for anything without */
 const draw=game.slice(game.indexOf('function rouDrawWheel(){'),game.indexOf('function rouRender(){'));
 assert.match(draw,/if\(rouLook\('rouWheel',cvw,rouAngle,ROU_ORDER,ROU_RED\)\)return;[^\n]*\n g\.clearRect|const g=cvw\.getContext/);
 assert.ok(draw.indexOf("rouLook('rouWheel'")<draw.indexOf("getContext('2d')"),'asked before the flat wheel is drawn');
 /* the old confetti stays as the fallback wherever the show answers for a win */
 for(const [fn,call] of [['bjSettle',"if(!bjLook('cheer',"],['rouSettle','if(!shown)spawnPartsIn'],['rtbPay',"if(!rtbLook('cheer',"],['gvbSettle',"if(!gvbLook('cheer',"]])
  assert.ok(game.slice(game.indexOf('function '+fn+'('),game.indexOf('\n}',game.indexOf('function '+fn+'('))).includes(call),fn);
});

test('every painted picture has its line in the manifest - and nothing else is in the folder',()=>{
 const man=JSON.parse(read('assets/casino/casino-art-manifest.json'));
 const files=[...man.symbols,...man.five.symbols].map(s=>s.file);
 assert.equal(files.length,29);
 const jobs=[...man.symbols.map(s=>s.job),...man.five.symbols.map(s=>s.job),...man.five.art.map(s=>s.job),...man.menu.icons.map(s=>s.job),man.card_back.job];
 for(const j of jobs)assert.match(j,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 const want=new Set([...files.flatMap(f=>[f+'.png',f+'_b.png']),...man.menu.icons.map(s=>s.file+'.png'),man.card_back.file,...man.five.art.map(s=>s.file)]);
 const have=fs.readdirSync(path.join(root,'assets/casino')).filter(f=>/\.(png|jpg)$/.test(f));
 assert.deepEqual(have.sort(),[...want].sort());
 for(const f of have.filter(f=>f.endsWith('.png'))){
  const b=fs.readFileSync(path.join(root,'assets/casino',f));
  assert.equal(b.toString('latin1',1,4),'PNG',f);
  const w=b.readUInt32BE(16),h=b.readUInt32BE(20),size=/^l7_/.test(f)?320:/^(sea|f5)_/.test(f)?256:160;
  if(/^f5_(imp_|logo)/.test(f)){assert.ok(w<=360&&h<=320&&w>100&&h>100,f+' '+w+'x'+h);continue;} /* the imps and the logo keep their own shape */
  assert.deepEqual([w,h],f.endsWith('_b.png')?[size/2,size/2]:[size,size],f);
 }
 /* the menu shows them, the emoji staying as alt text; the face-down cards wear the back */
 for(const [game,emo,art] of [['slotpick','🎰','slothall'],['slots','🎰','lucky7'],['sea','🦈','slots'],['five','5','five'],['bj','🃏','blackjack'],['rou','🎡','roulette'],['rtb','🚌','ridebus'],['gvb','🎲','duel']])
  assert.ok(html.includes(`data-game="${game}"><span class="cg"><img src="assets/casino/menu_${art}.png" alt="${emo}" draggable="false"></span>`),game);
 assert.match(read('assets/casino/casino-fx.css'),/\.bjcard\.back\{background:url\('card_back\.jpg'\)/);
});
