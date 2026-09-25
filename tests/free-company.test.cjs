/* ⚔ The Free Company (asked for 2026-09-25): Captain Hakon Stormgaard in Port Meridian hires out sellswords twenty at a time
 * for 5 000 000 from the realm's TREASURY - never the hero's purse - up to a hundred, and every one of them walks a beat in the
 * City from then on. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../assets/city/economy.js');
const root=path.join(__dirname,'..'),game=fs.readFileSync(path.join(root,'game.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=(a,b)=>{const i=game.indexOf(a),j=game.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return game.slice(i,j);};
const chartered=treasury=>{const s=E.create();s.chartered=true;s.office=3;s.treasury=treasury;return s;};

test('twenty sellswords cost five million from the treasury, up to a hundred, and nothing else moves',()=>{
 assert.equal(E.MERC_BATCH,20);assert.equal(E.MERC_PRICE,5000000);assert.equal(E.MERC_MAX,100);
 const s=chartered(30000000),before=JSON.parse(JSON.stringify(s));
 for(let k=1;k<=5;k++){
  const r=E.hireMercs(s);
  assert.equal(r.ok,true,'contract '+k);assert.equal(s.mercs,20*k);assert.equal(r.count,20*k);
  assert.equal(s.treasury,30000000-5000000*k);assert.equal(s.spent,5000000*k);
 }
 const r=E.hireMercs(s);
 assert.equal(r.ok,false);assert.equal(s.mercs,100);assert.equal(s.treasury,5000000,'a refused contract costs nothing');
 assert.equal(E.mercView(s).full,true);assert.equal(E.mercView(s).can,false);
 const changed=Object.keys(s).filter(k=>JSON.stringify(s[k])!==JSON.stringify(before[k])).sort();
 assert.deepEqual(changed,['mercs','spent','treasury'],'only the realm\'s books move');
});

test('the Company is refused when the books are shut, the bank holds them, or the treasury cannot pay',()=>{
 const shut=E.create();shut.treasury=90000000;
 assert.equal(E.hireMercs(shut).ok,false);assert.equal(shut.mercs,0);assert.equal(shut.treasury,90000000);
 const poor=chartered(4999999);assert.equal(E.hireMercs(poor).ok,false);assert.equal(poor.treasury,4999999);
 const red=chartered(-10);assert.equal(E.hireMercs(red).ok,false);
 const bank=chartered(90000000);bank.bankRule={left:4};assert.equal(E.hireMercs(bank).ok,false);assert.equal(bank.treasury,90000000);
 for(const s of [shut,poor,red,bank])assert.ok(E.mercView(s).why.length>0,'the window says why');
 const exact=chartered(5000000);assert.equal(E.hireMercs(exact).ok,true);assert.equal(exact.treasury,0);
});

test('the sellswords are saved with the realm\'s books and come back clamped',()=>{
 const s=chartered(50000000);E.hireMercs(s);E.hireMercs(s);
 const back=E.normalize(JSON.parse(JSON.stringify(s)));
 assert.equal(back.mercs,40);
 assert.equal(E.normalize({...JSON.parse(JSON.stringify(s)),mercs:640}).mercs,100);
 assert.equal(E.normalize({...JSON.parse(JSON.stringify(s)),mercs:-3}).mercs,0);
 assert.equal(E.normalize({...JSON.parse(JSON.stringify(s)),mercs:'x'}).mercs,0);
 assert.equal(E.create().mercs,0);
});

test('the recruiter\'s window shows the count, the cap and the price, and pays from the treasury only',()=>{
 for(const id of ['mercFx','mercBody','mercMsg','mercClose','voyageFx','voyageList','voyageClose'])assert.match(html,new RegExp('id="'+id+'"'),id);
 const ui=section('function renderMercs(){','/* ==================== 👑 THE THRONE HALL');
 for(const label of ['Current mercenaries','Maximum mercenaries','Price'])assert.ok(ui.includes(label),label);
 assert.match(ui,/Recruit \$\{v\.batch\}/);assert.match(ui,/confirmBox\(/,'a contract is confirmed first');
 assert.match(ui,/CityEconomy\.hireMercs\(S\.city\)/);assert.doesNotMatch(ui,/S\.gold/,'the hero\'s purse is never touched');
 assert.match(ui,/save\(\)/,'a paid contract is saved at once');
 const crafting=fs.readFileSync(path.join(root,'assets/ui/crafting.js'),'utf8');
 assert.match(crafting,/voyageFx: 'voyageClose', mercFx: 'mercClose'/,'Esc closes both windows');
});

/* the City's streets, as buildCity lays them: three streets, five avenues, the great square */
const STREETS=[[300,1180,16500,1180,180],[300,2600,16500,2600,280],[300,4020,16500,4020,180],
 ...[2600,5500,8400,11300,14200].map(x=>[x,560,x,4640,200])];
const onStreet=(x,y)=>Math.hypot(x-8400,y-2600)<=520||STREETS.some(([x0,y0,x1,y1,w])=>x>=Math.min(x0,x1)-w/2&&x<=Math.max(x0,x1)+w/2&&y>=Math.min(y0,y1)-w/2&&y<=Math.max(y0,y1)+w/2);
function beats(){
 const c=vm.createContext({HARBOR_MOUTH:{x:8400,y:4378},CityEconomy:E,Math});
 vm.runInContext(section('let mercSlots=null;','function cityApplyMercs(){')+';this.mercBeats=mercBeats;this.mercSlotList=mercSlotList;',c);
 return c;
}

test('a hundred sellswords, every one on a beat of the City\'s streets, the first twenty on the gates and main roads',()=>{
 const c=beats(),slots=c.mercSlotList();
 assert.equal(slots.length,100);
 const first=new Set(slots.slice(0,20).map(s=>s.beat.id));
 for(const id of ['gate','palace','harbour','square','boulevard-w','boulevard-e','cathedral','north-w','north-e','south','walls'])assert.ok(first.has(id),'the first contract covers '+id);
 const seen=new Set(slots.map(s=>s.beat.id+'#'+s.k));assert.equal(seen.size,100,'no two men share a place');
 for(const b of c.mercBeats()){
  if(b.posts){for(const [x,y] of b.posts)assert.ok(onStreet(x,y),b.id+' post '+x+','+y);continue;}
  for(let i=0;i<b.loop.length;i++){const [ax,ay]=b.loop[i],[bx,by]=b.loop[(i+1)%b.loop.length];
   for(let t=0;t<=1;t+=.05)assert.ok(onStreet(ax+(bx-ax)*t,ay+(by-ay)*t),b.id+' walks off the street near '+Math.round(ax+(bx-ax)*t)+','+Math.round(ay+(by-ay)*t));}
 }
 /* and they keep clear of the cathedral, which stands across the central avenue at the north street */
 for(const b of c.mercBeats())if(b.loop)for(const [x,y] of b.loop)assert.ok(!(Math.abs(x-8400)<330&&Math.abs(y-1300)<340),b.id+' passes through the cathedral');
});

test('the sellswords join the City with the rest of its people, and only the ones on screen are drawn',()=>{
 assert.match(game,/function cityApplyAll\(\)\{[^}]*cityApplyMercs\(\);\}/);
 assert.match(game,/if\(world\.mercs&&!TideUI\.isBattling\(\)\)for\(const m of world\.mercs\)\{\n\s*if\(m\.x<cx0\|\|m\.x>cx1\|\|m\.y<cy0\|\|m\.y>cy1/);
 assert.match(game,/if\(world&&world\.mercs\)mercTick\(dt\);/);
 /* one clock for all of them: a man's place is a function of the time, nothing accumulates per man */
 const tick=section('function mercTick(dt){','function mercWorldClick(');
 assert.match(tick,/const d=\(m\.ph\+t\*m\.sp\)%m\.len/);
});
