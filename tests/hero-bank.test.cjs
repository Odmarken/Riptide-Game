/* 🏦 The Bank of Moonshine (2026-09-24): it holds at most ten billion, and pays interest by the depositor's standing in the
 * peerage - nothing to a commoner, 0.05% an hour to a Knight, rising evenly to 0.5% an hour for a Duke. The bank's code is
 * game.js's own, run headless. Run with node --test. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);assert.ok(i>=0&&j>i,a);return source.slice(i,j);};
const HOUR=3600000;
/* the bank, with a hero of the given rank who deposited `gold` `hours` ago */
function bank(rank,gold,hours){
 const logs=[],S={bankGold:gold,bankEarned:0,bankLastT:1e12,city:{noble:{rank}}};
 const ctx=vm.createContext({S,Date:{now:()=>1e12+hours*HOUR},log:t=>logs.push(t),save:()=>{},setInterval:()=>{},gameOn:false,Math,Object});
 vm.runInContext(section('/* ==================== BANK ==================== */','/* Spend overflow first')+';globalThis.api={bankTick,bankRate,BANK_CAP,BANK_RATES};',ctx);
 ctx.api.bankTick();
 return {S,logs,api:ctx.api};
}

test('interest by standing: none for a commoner, 0.05% an hour for a Knight, evenly up to 0.5% for a Duke',()=>{
 const {api}=bank(0,0,0);
 assert.deepEqual([...api.BANK_RATES],[0,.0005,.0014,.0023,.0032,.0041,.005]);
 const commoner=bank(0,1e6,10);assert.equal(commoner.S.bankGold,1e6,'a commoner’s gold only sleeps');assert.equal(commoner.S.bankEarned,0);assert.equal(commoner.logs.length,0);
 assert.equal(commoner.S.bankLastT,1e12+10*HOUR,'the hours are counted all the same - a patent later pays nothing backwards');
 const knight=bank(1,1e6,1);assert.equal(knight.S.bankEarned,500,'0.05% of a million in an hour');
 const duke=bank(6,1e6,1);assert.equal(duke.S.bankEarned,5000,'0.5% of a million in an hour, as the bank always paid');
 let g=1e6;for(let i=0;i<24;i++)g+=Math.floor(g*.0023);
 assert.equal(bank(3,1e6,24).S.bankGold,g,'a Viscount, a day, compounded hourly');
 assert.ok(api.BANK_RATES.every((r,i,a)=>!i||r>a[i-1]),'every rank pays more than the one below');
});

test('the vault holds ten billion at most, and interest stops at the cap',()=>{
 const {api}=bank(6,0,0);
 assert.equal(api.BANK_CAP,10000000000);
 const near=bank(6,api.BANK_CAP-1000,5);assert.equal(near.S.bankGold,api.BANK_CAP,'filled to the brim and no further');assert.equal(near.S.bankEarned,1000);
 const full=bank(6,api.BANK_CAP,50);assert.equal(full.S.bankGold,api.BANK_CAP);assert.equal(full.S.bankEarned,0);
});

test('a deposit stops at the cap, and the bank’s window says what it pays and to whom',()=>{
 const deposit=section("if(op==='dg'){","}else if(op==='wg'){");
 assert.match(deposit,/const room=Math\.max\(0,BANK_CAP-\(S\.bankGold\|\|0\)\),want=amt\(totalGold\(\)\),n=Math\.min\(want,room\);/);
 assert.match(deposit,/if\(room<=0\)\{[^}]*holds '\+BANK_CAP\.toLocaleString\(\)\+' ◉ at most/);
 /* the window's line is the rate and the title it comes with, nothing more (asked for 2026-09-24) */
 const line=rank=>{
  const els={},ctx=vm.createContext({S:{city:{noble:{rank}}},$:id=>els[id]=els[id]||{},CityEconomy:require('../assets/city/economy.js'),
   Date,log:()=>{},save:()=>{},setInterval:()=>{},gameOn:false,Math,Object});
  vm.runInContext(section('/* ==================== BANK ==================== */','/* Spend overflow first')+section('function bankRefresh(){','\nfunction openBank(){')+'\nbankRefresh();',ctx);
  return els.bankRateLine.innerHTML.replace(/<[^>]+>/g,'');
 };
 assert.equal(line(6),'Your interest: Duke 0.5%');assert.equal(line(1),'Your interest: Knight 0.05%');assert.equal(line(4),'Your interest: Count 0.32%');
 assert.equal(line(0),'Your interest: 0%','no title: the rate alone');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('id="bankRateLine" style="margin-bottom:10px">Your interest: 0%</div>'));assert.ok(!html.includes('0.5% interest on gold'),'no flat rate promised any more');
});
