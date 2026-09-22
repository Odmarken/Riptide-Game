/* 👘 Outfits, headless: what the hero is drawn in - the class colours, the Ice Armor or the crown's robes - chosen on the
 * Outfits page and independent of what is worn for numbers; the weapon eye; and what a peer's look says. The rules are
 * sliced out of game.js and run against stubs. Run with node --test. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const slice=source.slice(source.indexOf('const OUTFITS=['),source.indexOf('function bootFeet('));
function harness(S){
 const c={S,classOf:()=>({name:'Warrior'}),isIce:it=>!!(it&&it.legend==='icearmor'),isFK:it=>!!(it&&it.legend==='rimfrost'),isFG:it=>!!(it&&it.legend==='felglaives'),
  RACE_ALIAS:{},CLASS_ALIAS:{},keys:[],charSprite:(r,cls,f)=>{c.keys.push(r+(f?'female':'male')+'_'+cls);return {};},
  characterBodyFrame:(img,h=48,b=5)=>({bodyBottom:b,bodyHeight:h,headY:b-h,bootTop:null,x:0,y:0,width:10,height:h}),characterBootFrame:()=>({groundY:10}),bootImg:{}};
 vm.createContext(c);vm.runInContext(slice,c);
 for(const k of ['OUTFITS','outfitArgOf','outfitArg','lookOutfit','heroWeaponArgs','ROYAL_BODY_H'])c[k]=vm.runInContext(k,c);
 return c;
}
const hero=(extra={})=>({race:'human',cls:'warrior',gender:'m',gear:{weapon:null,armor:null,trinket:null},bag:[],...extra});

test('👘 three outfits, unlocked by what you have done: the class colours always, the Ice Armor by the ritual or the plate, the robes by the crown',()=>{
 const c=harness(hero());
 assert.deepEqual(Array.from(c.OUTFITS.map(o=>o.id)),['default','ice','royal']);   /* Array.from / spread: values made in the vm realm */
 assert.equal(c.outfitUnlocked('default'),true);assert.equal(c.outfitUnlocked('ice'),false);assert.equal(c.outfitUnlocked('royal'),false);assert.equal(c.outfitUnlocked('nope'),false);
 assert.equal(harness(hero({ritualDone:true})).outfitUnlocked('ice'),true,'the ritual');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}}})).outfitUnlocked('ice'),true,'the plate on your back');
 assert.equal(harness(hero({bag:[{legend:'icearmor'}]})).outfitUnlocked('ice'),true,'the plate in the bag');
 assert.equal(harness(hero({city:{crowned:false}})).outfitUnlocked('royal'),false);assert.equal(harness(hero({city:{crowned:true}})).outfitUnlocked('royal'),true,'the crown');
 assert.ok(c.OUTFITS.every(o=>o.name()&&o.desc&&o.how&&o.icon));
 assert.equal(harness(hero({gender:'f',city:{crowned:true}})).OUTFITS[2].name(),'Queen’s robes');assert.equal(c.OUTFITS[2].name(),'King’s robes');
});

test('👘 what is drawn: the choice when it is unlocked, the class colours when it is not, and the old rule for a save without a choice',()=>{
 assert.equal(harness(hero()).heroOutfit(),'default');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}}})).heroOutfit(),'ice','no choice yet: the armor on your back shows');
 assert.equal(harness(hero({gear:{armor:{legend:'icearmor'}},outfit:'default'})).heroOutfit(),'default','chosen: the plate is hidden under the class colours');
 assert.equal(harness(hero({outfit:'royal'})).heroOutfit(),'default','not crowned: the robes are not yours');
 const k=harness(hero({outfit:'royal',city:{crowned:true}}));
 assert.equal(k.heroOutfit(),'royal');assert.equal(k.outfitArg(),'royal');
 assert.equal(harness(hero({outfit:'ice',ritualDone:true})).outfitArg(),true);assert.equal(harness(hero()).outfitArg(),false);
 assert.equal(harness(null).heroOutfit(),'default');assert.equal(harness(null).outfitUnlocked('default'),true);
 /* the painted frame asks for the right sprite, and the royal frame is taller for the crown */
 const f=k.paintedCharacterFrame('human','warrior',false,'royal');assert.deepEqual([...k.keys],['humanmale_royal']);assert.equal(f.bodyHeight,k.ROYAL_BODY_H);assert.ok(k.ROYAL_BODY_H>48);
 k.keys.length=0;assert.equal(k.paintedCharacterFrame('orc','mage',true,true).bodyHeight,48);assert.deepEqual([...k.keys],['orcfemale_armor']);
 k.keys.length=0;k.paintedCharacterFrame('dwarf','priest',false,false);assert.deepEqual([...k.keys],['dwarfmale_priest']);
 /* what a peer sent */
 assert.equal(k.lookOutfit({outfit:'royal',ice:false}),'royal');assert.equal(k.lookOutfit({ice:true}),true);assert.equal(k.lookOutfit({}),false);assert.equal(k.lookOutfit(null),false);
});

test('👁 the weapon eye: sheathed, the hand is empty and the rune is out - the numbers do not know',()=>{
 const rim=harness(hero({gear:{weapon:{legend:'rimfrost'}}}));assert.deepEqual({...rim.heroWeaponArgs()},{fm:true,id:'rimfrost'});
 const fel=harness(hero({gear:{weapon:{legend:'felglaives'}}}));assert.deepEqual({...fel.heroWeaponArgs()},{fm:false,id:'felglaives'});
 const plain=harness(hero({gear:{weapon:{id:'sword'}}}));assert.deepEqual({...plain.heroWeaponArgs()},{fm:false,id:null});
 const hid=harness(hero({gear:{weapon:{legend:'rimfrost'}},hideWeapon:true}));assert.deepEqual({...hid.heroWeaponArgs()},{fm:false,id:'hidden'});
});
