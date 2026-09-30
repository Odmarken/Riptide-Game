/* Round 2 of the casino polish (2026-09-30): what spans every casino window. Each game's own round-2 fixes are pinned next to
 * its round-1 tests (casino-simple, casino-sea, casino-bj, casino-rtb, casino-chests); the stylesheet and the markup by source. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');

test('the stake − and + of every casino window are 44 px on a phone, upright or on its side, and keep their desktop size',()=>{
 const WIN={slotFx:['slotBetDn','slotBetUp'],seaFx:['seaBetDn','seaBetUp'],bjFx:['bjBetDn','bjBetUp'],sebbeFx:['sebbeBetDn','sebbeBetUp'],rtbFx:['rtbBetDn','rtbBetUp'],rouFx:['rouChipDn','rouChipUp']};
 for(const [fx,ids] of Object.entries(WIN)){
  const a=html.indexOf(`<div id="${fx}">`);assert.ok(a>=0,fx);
  const b=html.indexOf('<div class="slotbet"',a),bet=html.slice(b,html.indexOf('</div>',b));
  for(const id of ids){
   const m=bet.match(new RegExp(`<button class="(qtybtn|sbtn)" id="${id}"([^>]*)>`));
   assert.ok(m,id+' sits on the stake line of '+fx);
   assert.ok(!/width|height/.test(m[2]),id+': no inline size for the phone rule to lose against');
  }
 }
 const rule=css.match(/@media \(max-width:600px\),\(pointer:coarse\) and \(max-height:500px\)\{\n([^}]*\}[^}]*\})\n  \}/);
 assert.ok(rule,'the phone rule: upright (600 px and less) or on its side (a short touch screen)');
 assert.match(rule[1],/\.slotbet\{flex-wrap:wrap;justify-content:center\}/,'a stake line out of room puts its price under the buttons');
 assert.match(rule[1],/:is\(#slotFx,#seaFx,#bjFx,#sebbeFx,#rtbFx,#rouFx\) \.slotbet :is\(\.qtybtn,\.sbtn\)\{width:44px;height:44px;/);
 /* it outranks every other size those buttons have - the desktop 30 px and the Slots' 34 px - wherever they sit in the file:
    an id inside :is() against at most three classes, or a bare id */
 for(const other of ['.slotbet .qtybtn{width:30px','.slotmach.bj .qtybtn{width:30px','#seaBetDn,#seaBetUp{width:34px}'])assert.ok(css.includes(other),other);
 /* a tall touch screen is no phone: the desktop build on a touch laptop reports a coarse pointer too (Electron on the owner's
    machine does) and keeps its 30 px */
 const l7=css.slice(css.indexOf('/* --- Lucky 7 slot machine'),css.indexOf('/* --- Bag: scroll tier categories'));
 assert.ok(l7.includes(rule[0]),'with the stake line\'s own rules, in the Lucky 7 block');
 assert.doesNotMatch(css,/@media \(pointer:coarse\)\{/);
});

test('every session line counts one as one: "1 spin", "1 hand"',()=>{
 const lines=game.match(/`Session: \$\{[^`]*`/g);
 assert.equal(lines.length,3,'Lucky 7, Slots and Blackjack');
 for(const l of lines)assert.match(l,/\$\{(s|ss)\.(spins|hands)\} (spin|hand)\$\{(s|ss)\.(spins|hands)===1\?'':'s'\}/,l);
});
