/* 🌳📌 The gardens and the notice board left the great square on 2026-09-24 ("flytta denna garden ... bredvid huset och gör
 * den större", "flytta notices tavlan till där min gubbe står"): the gardens are laid in the yard beside the stone house at
 * the square's north-west corner, bigger than they were on the square, and the board stands before that house where the
 * boulevard's north kerb meets the square's rim. Checked against the REAL seeded City and against every painting the
 * ledger can put out at once - nothing it stages may stand on either of them. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const CW=require('../assets/city/city-works.js');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function city(seed){
 const context=vm.createContext({world:{w:16800,h:5200,solids:[]},npcSebbeImg:{}});
 vm.runInContext(section('const CATH_ART=','const CITY_FOOT=')+section('const CITY_NAMES=','/* 🧱 The floor of the City')+source.match(/^function mulberry32\(.*$/m)[0]+`;buildCity(mulberry32(${seed}));`,context);
 return JSON.parse(JSON.stringify(context.world));
}
const w=city(26*7919+13),sq=w.plazas[0];                 /* the seed the game builds the City from (zone 26) */
/* where a painting lands: ART's height and foot, the picture's own width to height */
const aspect=name=>{const b=fs.readFileSync(path.join(root,'assets','city',name+'.png'));return b.readUInt32BE(16)/b.readUInt32BE(20);};
const STALLS=['stall_bread','stall_fish','stall_greens','stall_cloth'];
const artName=s=>s.kind==='stall'?STALLS[s.goods%STALLS.length]:s.kind==='tent'?(s.stripe?'tent_blue':'tent_red'):s.kind==='statue'?(s.crowned?'statue_crowned':'statue'):s.kind;
const painted=s=>{const a=CW.ART[s.kind],W=a.h*aspect(artName(s));return {x0:s.x-W/2,x1:s.x+W/2,y0:s.y+a.drop-a.h,y1:s.y+a.drop};};
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
const HOUSE={house_timber:[245,.616],house_stair:[265,.768],house_stone:[305,.530],house_shop:[285,.914],house_turret:[340,.743],house_tenement:[375,.556],house_manor:[405,.676]};
const facades=w.solids.filter(s=>s.type==='cityhouse').map(s=>{const [h,ar]=HOUSE[s.key],hw=h*ar/2;return {s,x0:s.x-hw,x1:s.x+hw,y0:s.y+s.r*.3-h,y1:s.y+s.r*.3};});
const onSquare=(x,y)=>((x-sq.x)/sq.r)**2+((y-sq.y)/(sq.r*.82))**2<1;   /* the square's floor, as CityGround lays it */
/* everything the ledger has, all at once - in a riot, in a famine, at the fair, jubilant */
const EVERYTHING={works:{aqueduct:'done',statue:'done',gardens:'done',lamps:'done'},stalls:CW.MAX_STALLS,xMax:15500,crowned:true,hero:'Birgitta',
 street:{maypole:true,music:true,feast:2,tents:true,breadline:2,barricades:true,beggars:8}};
const ledger=[...CW.props(w,EVERYTHING),CW.noticeBoard(w)];
const garden=ledger.find(p=>p.kind==='garden'),board=ledger.find(p=>p.kind==='noticeboard');
const stone=facades.filter(f=>f.s.key==='house_stone').sort((a,b)=>Math.hypot(a.s.x-garden.x,a.s.y-garden.y)-Math.hypot(b.s.x-garden.x,b.s.y-garden.y))[0];

test('the gardens stand in the yard beside the stone house at the square\'s north-west corner, bigger than they were',()=>{
 assert.ok(garden&&stone);
 const g=painted(garden);
 assert.ok(g.x0>=stone.x1&&g.x0-stone.x1<20,'right beside the house, on its east side');
 assert.ok(stone.y1-g.y1>=0&&stone.y1-g.y1<60,'on the ground the house stands on, not in front of its door and not up behind it');
 assert.ok(!onSquare(garden.x,garden.y)&&!onSquare(garden.x,g.y1)&&garden.x<sq.x&&garden.y<sq.y,'in the north-west yard, off the square');
 assert.ok(Math.abs(garden.y-sq.y)>140+garden.r&&Math.abs(garden.x-sq.x)>100+garden.r,'clear of the boulevard and the avenue');
 assert.ok(CW.ART.garden.h>=128*1.5,'no longer the toy they were on the square');
 assert.ok(garden.noCol,'a garden is walked through, never round');
 const site=CW.props(w,{works:{gardens:'building'},left:{gardens:2},stalls:0}).find(p=>p.kind==='site');
 assert.deepEqual([site.x,site.y],[garden.x,garden.y],'the works go up where the gardens will be');
});

test('the notice board stands before the stone house, where the boulevard\'s north kerb meets the square',()=>{
 const b=painted(board);
 assert.ok(board.x>stone.x0-20&&board.x<stone.x1+20,'in front of the house');
 assert.ok(b.y0>stone.y1,'below the house\'s foot: it hides none of the house');
 assert.ok(board.y<sq.y-140-20&&board.y>sq.y-140-80,'in the yard, just back from the boulevard\'s kerb');
 assert.ok(!onSquare(board.x,board.y)&&!onSquare(b.x1,board.y),'off the square');
 const rim=sq.x-sq.r*Math.sqrt(1-((board.y-sq.y)/(sq.r*.82))**2);
 assert.ok(rim-board.x>30&&rim-board.x<120,'a step short of the square\'s rim');
 assert.equal(ledger.filter(p=>p.kind==='noticeboard').length,1);
});

test('nothing the ledger puts out stands on the gardens or the board, and neither stands on a house',()=>{
 for(const mine of [garden,board]){
  const m=painted(mine);
  for(const p of ledger)if(p!==mine&&CW.ART[p.kind])assert.ok(!overlap(m,painted(p)),`the ${p.kind} at ${Math.round(p.x-sq.x)},${Math.round(p.y-sq.y)} stands on the ${mine.kind}`);
  for(const f of facades)assert.ok(!overlap(m,f),`the ${mine.kind} stands on the ${f.s.key} at ${Math.round(f.s.x)},${Math.round(f.s.y)}`);
 }
 /* what used to stand in that yard - the blue fair tent and a market pitch - found room on the square the two of them left */
 const tent=ledger.find(p=>p.kind==='tent'&&p.stripe);
 assert.ok(onSquare(tent.x,tent.y),'the blue fair tent pitches on the square');
 assert.ok(CW.stallSlots(w).some(p=>p.x===sq.x-6&&p.y===sq.y+190),'a market pitch has the board\'s old place');
});
