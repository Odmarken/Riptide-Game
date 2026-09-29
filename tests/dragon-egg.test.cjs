const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Mounts=require('../assets/mounts/mounts.js');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const section=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);assert.ok(a>=0&&b>a,'found '+from);return source.slice(a,b);};
const rules=section("/* 🐉 THE DRAGON'S EGG","/* 🐉 the Dragon Rider's egg");
const shop=section("/* 🐉 the Dragon Rider's egg",'function renderMercs(){');

function harness(S,now=1e12){
 const calls=[],els={},el=id=>els[id]||(els[id]={id,textContent:'',innerHTML:'',style:{},onclick:null});
 const c={S,Mounts,BANK_CAP:10000000000,DRAGON_EGG_PRICE:5000000000,Date:{now:()=>c.clock},clock:now,gameOn:true,calls,els,
  $:el,setInterval:()=>0,stageMsg:m=>calls.push(['stage',m]),log:m=>calls.push(['log',m]),sfx:{level(){},buy(){},warn(){}},
  save:()=>calls.push(['save']),renderBag:()=>calls.push(['bag']),renderHUD(){},updateMountButton(){},
  hero:{x:6000,y:1400,dead:false},world:{npcs:[{game:'dragonrider',x:6030,y:1385,fx:-1}]},TideUI:{isBattling:()=>false},
  confirmBox:(html,yes)=>{calls.push(['confirm',html]);yes();}};
 vm.createContext(c);vm.runInContext(rules+shop+';globalThis.api={DRAGON_EGG_PRICE,DRAGON_HATCH_MS,dragonEggLeft,dragonHeld,dragonEggTick,openDragonShop,renderDragonShop};',c);
 return c;
}
const rich=()=>({gold:1234,overflow:0,bankGold:10000000000,mounts:{owned:['horse'],equipped:'horse'},dragonEgg:null});

test('the egg costs five billion, from the vault and never the purse, and only once',()=>{
 const S=rich(),h=harness(S),api=h.api;
 assert.equal(api.DRAGON_EGG_PRICE,5000000000);assert.equal(api.DRAGON_HATCH_MS,5*3600000);
 api.openDragonShop();assert.equal(h.els.dragonFx.style.display,'flex');
 assert.doesNotMatch(h.els.dragonBody.innerHTML,/disabled/,'a full bank may buy');
 h.els.dragonBuy.onclick();
 assert.equal(S.bankGold,5000000000,'the bank pays');assert.equal(S.gold,1234,'the purse is untouched');
 assert.equal(S.dragonEgg.at,h.clock);assert.equal(api.dragonHeld(),true);
 assert.ok(h.calls.some(c=>c[0]==='save'));
 /* a second egg: refused, nothing more taken */
 S.bankGold=10000000000;h.els.dragonBuy.onclick();assert.equal(S.bankGold,10000000000);
 assert.match(h.els.dragonBody.innerHTML,/disabled/);
});

test('a bank short of the price cannot buy, however much gold is carried',()=>{
 const S={...rich(),bankGold:4999999999,gold:2000000},h=harness(S);
 h.api.renderDragonShop();assert.match(h.els.dragonBody.innerHTML,/disabled/);
 h.els.dragonBuy.onclick();assert.equal(S.bankGold,4999999999);assert.equal(S.dragonEgg,null);assert.equal(S.gold,2000000);
});

test('the egg hatches five hours after it was bought, into the dragon Torsten keeps, exactly once',()=>{
 const S=rich(),h=harness(S),api=h.api;
 h.els.dragonBuy=null;api.renderDragonShop();h.els.dragonBuy.onclick();
 assert.match(h.calls.find(c=>c[0]==='confirm')[1],/five hours/);
 api.dragonEggTick();assert.equal(h.els.eggLeft.textContent,'Hatches in 5 h 0 min');
 h.clock+=2*3600000+30*60000+15000;api.dragonEggTick();assert.equal(h.els.eggLeft.textContent,'Hatches in 2 h 29 min');
 h.clock+=2*3600000+28*60000+15000;api.dragonEggTick();assert.equal(h.els.eggLeft.textContent,'Hatches in 1 min 30 s');
 h.clock+=60000;assert.equal(api.dragonEggLeft(),30000);api.dragonEggTick();
 assert.ok(S.dragonEgg,'still an egg at 30 s');assert.equal(h.els.eggLeft.textContent,'Hatches in 30 s');
 h.clock+=30000;api.dragonEggTick();
 assert.equal(S.dragonEgg,null);assert.equal(JSON.stringify(S.mounts),JSON.stringify({owned:["horse","dragon"],equipped:"horse"}));
 assert.ok(h.calls.some(c=>c[0]==='stage'&&/hatches/.test(c[1])));
 const saves=h.calls.filter(c=>c[0]==='save').length;api.dragonEggTick();
 assert.equal(h.calls.filter(c=>c[0]==='save').length,saves,'nothing happens twice');
 S.bankGold=10000000000;api.renderDragonShop();h.els.dragonBuy.onclick();assert.equal(S.bankGold,10000000000,'one egg, one dragon');
});

test('a clock set back never stretches the wait past five hours, and an egg bought while away hatches on return',()=>{
 const S={...rich(),dragonEgg:{at:1e12+9*3600000}},h=harness(S);
 assert.equal(h.api.dragonEggLeft(),5*3600000);
 const away={...rich(),dragonEgg:{at:1e12-5*3600000-1}},g=harness(away);g.api.dragonEggTick();
 assert.equal(away.dragonEgg,null);assert.ok(away.mounts.owned.includes('dragon'));
});

test('the save knows the egg, and the town, the bag and the stable wire it up',()=>{
 assert.match(source,/const DRAGON_EGG_PRICE=5000000000;/,'the egg costs five billion');
 assert.match(source,/setInterval\(\(\)=>\{if\(gameOn\)dragonEggTick\(\);\},1000\);/,'a once-a-second tick hatches it');
 assert.doesNotMatch(rules,/setInterval|BANK_CAP/,'the rules evaluate on their own: other tests cut this stretch of game.js out');
 assert.match(source,/bankLastT:0,dragonEgg:null,/);
 assert.match(source,/if\(!\(s\.dragonEgg&&typeof s\.dragonEgg==='object'&&Number\.isFinite\(s\.dragonEgg\.at\)\)\)s\.dragonEgg=null;/);
 assert.match(source,/n\.game==='dragonrider'\?openDragonShop/);
 assert.match(source,/bagCat\('Items',  eggHtml\+/);
 assert.match(source,/if\(m\.egg&&!owned\)return `<div class="stable-card stable-mystery" aria-label="Unknown"><div class="stable-q">\?<\/div><\/div>`;/);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 for(const id of ['dragonFx','dragonBody','dragonMsg','dragonClose'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(fs.readFileSync(path.join(__dirname,'../assets/ui/crafting.js'),'utf8'),/dragonFx: 'dragonClose'/,'Esc closes it');
 const town=fs.readFileSync(path.join(__dirname,'../assets/city/towns/meridian.js'),'utf8');
 assert.match(town,/game:'dragonrider'/);
});
