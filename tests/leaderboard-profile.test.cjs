const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
const slice=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const E=require('../assets/city/economy.js'),allFive=()=>Object.fromEntries(E.ALLIES.map(a=>[a.id,{owned:true}]));   /* 👑 every city and port under the crown */
function boot(){
 const writes=[],draws=[],state={fail:false},g=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 const ctx=vm.createContext({S:null,FB:{ready:true,user:{uid:'u1'}},SEASON:1,SDK_WAIT_MS:10,window:{},console:{warn(){}},ZONES:[],CITY_ZONE:26,
  isIce:g=>g?.legend==='icearmor',CityEconomy:{NOBLE_RANKS:[{title:'Commoner'},{title:'Duke'}],isEmperor:E.isEmperor},
  charGearScore:()=>20,lbScore:()=>123,charStats:()=>({hp:500}),heroDeleted:()=>false,
  cloudCall:async(_,sdk,rest)=>{if(state.fail)throw Error('offline');return rest({patch:async(id,entry)=>writes.push({id,entry:JSON.parse(JSON.stringify(entry))})});},
  RACES:[{id:'human'}],CLASSES:[{id:'warrior'}],RACE_ALIAS:{},CLASS_ALIAS:{},CHAR_SPRITES:{humanmale_warrior:1,humanmale_royal:1},
  enchOf:()=>null,runeOf:()=>null,isFKLegend:()=>false,
  paintedCharacterFrame:(race,cls,female,look)=>{draws.push({type:'frame',look,female,race});return state.loading?null:{groundY:0,headY:-28,boots:{}};},
  bootFeet(){},drawChampionSprite:(...args)=>draws.push({type:'sprite',weapon:args[7],look:args[10]}),drawEquippedRing:()=>draws.push({type:'ring'})});
 vm.runInContext(slice('function outfitUnlocked(','const outfitArg=')+slice('const lbPublished=','async function fetchLB(){')+slice('function drawPortrait(','const charGearScore='),ctx);
 return {ctx,writes,draws,state,g,hero:extra=>({id:'a',name:'Hero',cls:'warrior',race:'human',gender:'m',lvl:60,city:{crowned:true,noble:{rank:1}},gear:{armor:{legend:'icearmor',name:'Ice',rar:'legendary',slot:'armor'}},...extra})};
}
test('title and chosen clothes update without waiting thirty minutes, including removing them',async()=>{
 const b=boot(),ch=b.hero({outfit:'royal'});
 await b.ctx.publishLB(ch);assert.equal(b.writes[0].entry.title,'King');assert.equal(b.writes[0].entry.outfit,'royal');
 await b.ctx.publishLB(ch);assert.equal(b.writes.length,1,'unchanged profiles do not write again');
 ch.gender='f';ch.outfit='default';ch.hideWeapon=true;ch.hideRing=true;ch.rating=55;
 await b.ctx.publishLB(ch);const e=b.writes[1].entry;
 assert.equal(e.title,'Queen');assert.equal(e.outfit,'default');assert.equal(e.hideWeapon,true);assert.equal(e.hideRing,true);assert.equal(e.rating,55);
 ch.city.crowned=false;await b.ctx.publishLB(ch);assert.equal(b.writes[2].entry.title,'Duke');
 ch.city.noble.rank=0;await b.ctx.publishLB(ch);assert.equal(b.writes[3].entry.title,'');
});
test('an Emperor is published as one',async()=>{
 const b=boot(),ch=b.hero({gender:'m'});ch.city.allies=allFive();
 await b.ctx.publishLB(ch);assert.equal(b.writes[0].entry.title,'Emperor');
});
test('failed publishes retry, and one hero or account never throttles another',async()=>{
 const b=boot(),ch=b.hero({outfit:'royal'});b.state.fail=true;
 await b.ctx.publishLB(ch);assert.equal(b.writes.length,0);
 b.state.fail=false;await b.ctx.publishLB(ch);await b.ctx.publishLB({...ch,id:'b'});
 b.ctx.FB.user={uid:'u2'};await b.ctx.publishLB(ch);
 assert.deepEqual(b.writes.map(w=>w.id),['leaderboard/s1_u1_a','leaderboard/s1_u1_b','leaderboard/s1_u2_a']);
});
test('the City HUD uses King or Queen ahead of a noble rank',()=>{
 const b=boot();vm.runInContext(slice('function cityHudLine(){','/* a commoner who can be pulled'),b.ctx);
 b.ctx.S=b.hero({gender:'m'});assert.match(b.ctx.cityHudLine(),/^👑 King Hero/);
 b.ctx.S.gender='f';assert.match(b.ctx.cityHudLine(),/^👑 Queen Hero/);
 b.ctx.S.city.allies=allFive();assert.match(b.ctx.cityHudLine(),/^👑 Empress Hero/,'three cities and two ports make an Empress');
 b.ctx.S.city.crowned=false;assert.match(b.ctx.cityHudLine(),/^🎩 Duke Hero/);
});
test('portraits use chosen robes and hidden gear, and never flash a primitive while PNGs load',()=>{
 const b=boot(),cv={width:64,height:76,getContext:()=>b.g};
 b.ctx.drawPortrait(cv,b.hero({cid:'a',outfit:'royal',hideWeapon:true,hideRing:true}));
 assert.equal(b.draws.find(d=>d.type==='frame').look,'royal');
 assert.equal(b.draws.find(d=>d.type==='sprite').look,'royal');
 assert.equal(b.draws.find(d=>d.type==='sprite').weapon,'hidden');assert.ok(!b.draws.some(d=>d.type==='ring'));
 b.draws.length=0;b.ctx.drawPortrait(cv,b.hero({cid:'a',outfit:'default'}));
 assert.equal(b.draws.find(d=>d.type==='frame').look,false,'equipped Ice Armor does not override default clothes');
 b.state.loading=true;b.draws.length=0;b.ctx.drawPortrait(cv,b.hero({cid:'a',outfit:'royal'}));
 assert.ok(!b.draws.some(d=>d.type==='sprite'));
});
