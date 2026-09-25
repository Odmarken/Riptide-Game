/* 🚨 The Crown Ledger blinks red while the council's favour is under 35 (asked for 2026-09-25). */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),game=fs.readFileSync(path.join(root,'game.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/city/ledger.css'),'utf8');
const E=require('../assets/city/economy.js');

test('the council alarm is set at 35 favour and reaches the ledger card and the Council tab',()=>{
 assert.ok(game.includes('const COUNCIL_ALARM=35;'));
 const a=game.indexOf('function councilAlarm(){'),fn=game.slice(a,game.indexOf('\n}',a));
 assert.ok(fn.includes('CityEconomy.favour(c)<COUNCIL_ALARM'));
 assert.ok(fn.includes("$('ledgerPeekButton')")&&fn.includes('data-ltab="council"'));
 assert.ok(fn.includes('!c.bankRule'),'not while the bank holds the books');
 const t=game.indexOf('setInterval(()=>{ /* the countdown on the ledger'),tick=game.slice(t,game.indexOf('},1000);',t));
 assert.ok(tick.includes('councilAlarm();'),'checked every second');
 assert.ok(css.includes('.ledger-danger{animation:ledger-danger')&&css.includes('prefers-reduced-motion'));
});

test('favour is the council average, so one sulking councillor does not set it off alone',()=>{
 const s={council:{sword:10,stone:60,bread:60,revel:60,chamber:60}};
 assert.equal(E.favour(s),50);
 s.council={sword:30,stone:30,bread:30,revel:40,chamber:30};
 assert.ok(E.favour(s)<35);
});
