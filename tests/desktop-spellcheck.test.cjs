/* The desktop window runs without Chromium's spellchecker. The game has nothing to check, and every launch without
   APPDATA in its environment (test and debug launches) made the Windows spellchecker create empty
   "<garbage>\Microsoft\Spelling\neutral" folders in the working folder - two dozen of them piled up at the repo root. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'..','main.js'),'utf8');
test('the game window turns the spellchecker off',()=>{
 const prefs=main.slice(main.indexOf('webPreferences:'));
 const block=prefs.slice(0,prefs.indexOf('}'));
 assert.match(block,/spellcheck:\s*false/);
});
