/* 👑 Emperor (2026-09-24): a crowned head who holds all three cities and both great ports is named Emperor - or Empress -
 * in place of King or Queen, wherever the style before the name is shown. CityEconomy decides; game.js names it.
 * Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../assets/city/economy.js');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,a);return source.slice(i,j);};
const quiet=()=>.95;
/* a crowned city that has courted every place long enough, with the ports' quay and fleet built and gold for all of it */
function realm(){
 const s=E.create();E.charter(s);s.food.stock=1e6;s.treasury=5e9;s.crowned=true;s.deposed='gaol';
 s.works.quay={left:0};s.works.fleet={left:0};
 for(const def of E.ALLIES){s.allies[def.id]={stake:60,held:E.COURT_CLOSES,owned:false,put:0,pending:[]};E.openTalks(s,def.id,()=>.5);}   /* rng .5: a whim of nought */
 return s;
}
const buy=(s,id)=>E.makeOffer(s,{},id,E.talkView(s,{},id).ask,quiet);
const ids=E.ALLIES.map(a=>a.id);
function emperorOf(){const s=realm();for(const id of ids)assert.equal(buy(s,id).deal,true,id);return s;}

test('the deal that buys the last of the five makes an Emperor; four do not',()=>{
 const s=realm();
 assert.equal(E.isEmperor(s),false);assert.equal(E.alliesView(s).emperor,false);
 for(const id of ids.slice(0,-1)){const r=buy(s,id);assert.equal(r.deal,true,id);assert.equal(r.emperor,false,id+' is not the last');}
 assert.equal(E.isEmperor(s),false,'four of five is a King with a large estate');
 const last=buy(s,ids[ids.length-1]);
 assert.equal(last.deal,true);assert.equal(last.emperor,true,'the deal that bought the last says so');
 assert.equal(E.isEmperor(s),true);assert.equal(E.alliesView(s).emperor,true);
 assert.equal(E.isEmperor(E.normalize(JSON.parse(JSON.stringify(s)))),true,'and it survives a save and a load');
 /* the crown is part of it: the five without a crown on the head make nobody an Emperor */
 const bare=JSON.parse(JSON.stringify(s));bare.crowned=false;assert.equal(E.isEmperor(bare),false);
 assert.equal(E.isEmperor(null),false);assert.equal(E.isEmperor(E.create()),false);
});

test('a counter-offer taken for the last place makes an Emperor too',()=>{
 const s=realm();for(const id of ids.slice(0,-1))buy(s,id);
 const id=ids[ids.length-1],reserve=E.talkView(s,{},id).ask/1.2;
 const r=E.makeOffer(s,{},id,Math.round(reserve*.9),quiet);assert.equal(r.outcome,'counter');assert.equal(E.isEmperor(s),false);
 const took=E.acceptCounter(s,{},id);assert.equal(took.deal,true);assert.equal(took.emperor,true);assert.equal(E.isEmperor(s),true);
});

test('game.js names it: Emperor or Empress before the name, King or Queen with fewer than five, the peerage below the crown',()=>{
 const ctx=vm.createContext({CityEconomy:E,S:null});
 vm.runInContext(section('/* 👑 a crowned head: Emperor or Empress','const outfitArgOf')+section('const cityTitle=','\nfunction cityContext')
  +';globalThis.api={characterTitle,cityTitle};',ctx);
 const {characterTitle,cityTitle}=ctx.api,emperor=emperorOf();
 const king=realm();buy(king,ids[0]);
 const duke=E.create();duke.noble.rank=6;
 assert.equal(characterTitle({gender:'m',city:emperor}),'Emperor');assert.equal(characterTitle({gender:'f',city:emperor}),'Empress');
 assert.equal(characterTitle({gender:'m',city:JSON.parse(JSON.stringify(emperor))}),'Emperor','a saved hero on the leaderboard, too');
 assert.equal(characterTitle({gender:'m',city:king}),'King');assert.equal(characterTitle({gender:'f',city:king}),'Queen');
 assert.equal(characterTitle({gender:'m',city:duke}),'Duke');assert.equal(characterTitle({gender:'m',city:E.create()}),'');
 ctx.S={gender:'f',city:emperor};assert.equal(ctx.api.cityTitle(),'Empress','the crier, the throne, the ledger and the hero panel all read cityTitle');
 ctx.S={gender:'m',city:king};assert.equal(ctx.api.cityTitle(),'King');
 ctx.S=null;assert.equal(ctx.api.cityTitle(),'King');
});

test('the realm is told: the Allies tab says what the five make you, the last deal proclaims it, and the crier shouts it',()=>{
 const allies=section('function ledgerAllies(c){','\n/* 👑 The audience');
 assert.match(allies,/v\.emperor\?/);assert.match(allies,/the realm names you <b>'\+\(S\.gender==='f'\?'Empress':'Emperor'\)/);
 const deal=section("else if(act==='offer'||act==='takecounter'){","else if(act==='rehire')");
 assert.match(deal,/if\(r\.deal&&r\.emperor\)\{/);assert.match(deal,/all hail '\+who/);
 const talk=section('function ledgerTalk(c){','\n}\n');   /* the ledger covers the stage: the audience itself says it too */
 assert.match(talk,/CityEconomy\.isEmperor\(c\)\?'[^']*the realm names you <b>'\+cityTitle\(\)\+'<\/b>/);
 const crier=section('function cityCrierLines(){','\n}\n');
 assert.match(crier,/if\(E\.isEmperor\(c\)\)out\.push\('Hear ye! Three cities and two great ports under one crown/);
 assert.match(section("+sec('🤝 Allies'",'\n'),/the realm names you <b>Emperor<\/b>, or <b>Empress<\/b>/);
});
