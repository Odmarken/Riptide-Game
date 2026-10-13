/* Run with: node --test tests/i18n.test.cjs
 * 🌍 The game in seven languages (2026-10-13: "fixa alla språken ... bredvid controls så kan du lägga language och sen ska
 * english va högst upp sen tar du en rad ner med alla andra språken ... översätt allt i spelet som har text").
 * assets/i18n/i18n.js translates text where it reaches the screen; i18n-core.js cuts and keys units for it and for
 * tools/i18n/extract.cjs alike; tools/i18n/build.cjs writes assets/i18n/<lang>.js from the translators' work.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const core=read('assets/i18n/i18n-core.js'),rt=read('assets/i18n/i18n.js'),html=read('index.html'),css=read('style.css'),game=read('game.js'),gl=read('assets/gl/gl2d.js');
const C=require(path.join(root,'assets/i18n/i18n-core.js'));
const LANGS=['zh','ru','es','de','it','pt'];

/* the runtime in a bare context: just enough of a browser for its doors to be wrapped */
function load(lang,dict){
 const noop=()=>{},cls=()=>function(){};
 const Element=cls(),Node=cls(),Document=cls(),HTMLElement=cls(),HTMLInputElement=cls(),Canvas=cls();
 const prop=(P,k)=>Object.defineProperty(P,k,{get(){return '';},set(){},configurable:true});
 prop(Element.prototype,'innerHTML');prop(Node.prototype,'textContent');prop(HTMLElement.prototype,'title');prop(HTMLInputElement.prototype,'placeholder');
 Document.prototype.createTextNode=s=>({data:s});Element.prototype.setAttribute=noop;Element.prototype.insertAdjacentHTML=noop;
 Canvas.prototype.fillText=noop;Canvas.prototype.strokeText=noop;Canvas.prototype.measureText=()=>({width:0});
 const document={documentElement:{classList:{add:noop,remove:noop},lang:''},write:noop,addEventListener:noop,readyState:'loading'};
 const c={document,navigator:{languages:['sv-SE']},location:{search:'?lang='+lang,href:'http://x/?lang='+lang},localStorage:{getItem:()=>null,setItem:noop},
  URLSearchParams,URL,Element,Node,Document,HTMLElement,HTMLInputElement,CanvasRenderingContext2D:Canvas,console};
 c.window=c;vm.createContext(c);
 vm.runInContext(core,c);vm.runInContext(rt,c);
 if(dict)c.I18N.data(lang,dict);
 return c.I18N;
}

test('a unit is keyed the same way everywhere: numbers, slots and inline tags', () => {
 assert.deepEqual(C.canon('  Reach Prestige 1 first '),{key:'Reach Prestige {#0} first',nums:['1'],lead:'  ',trail:' '});
 assert.equal(C.canon('1 500 000 gold').key,'{#0} gold','a number grouped with no-break spaces is one number');
 assert.equal(C.keyFromRaw('Traveling to '+String.fromCharCode(C.SLOT)+'…'),'Traveling to {0}…');
 const tree=C.parseHTML('<div class="x"><b>Hang him on the square</b>: the people <b class="neg">−5</b> for 3 seasons</div><p>Close</p>');
 assert.deepEqual(C.unitsOfTree(tree).map(C.keyFromRaw),['<0>Hang him on the square</0>: the people <1>−{#0}</1> for {#1} seasons','Close']);
 assert.deepEqual(C.unitsOfTree(C.parseHTML('<button title="Close settings"><b>Settings</b></button>')).map(C.keyFromRaw),['Close settings','Settings'],'a lone tag round a unit is not part of it; titles are units');
 assert.deepEqual(C.unitsOfTree(C.parseHTML('<div translate="no">Deutsch</div>')),[],'translate="no" is left alone');
 for(const code of ['harbor/planks','players..bet','#fff','rgba(0,0,0,.5)','courtesan_blonde','click','assets/ui/x.png','G-1F2M3QS4Z'])assert.ok(C.looksLikeCode(code),code);
 for(const words of ['Gold','Hi/Lo','First:',' fps','Traveling to …','Close'])assert.ok(!C.looksLikeCode(words),words);
});

test('English goes straight through, untouched - the doors are not even wrapped', () => {
 const I=load('en');
 assert.equal(I.lang,'en');
 assert.equal(I.text('Traveling to Moonshine…'),'Traveling to Moonshine…');
 assert.match(rt,/if\(lang==='en'\)return;   \/\* nothing to translate/);
});

test('a language finds whole units, templates with values in them, and numbers in their place', () => {
 const I=load('de',{
  'Traveling to {0}…':'Reise nach {0}…','Moonshine':'Moonshine','The Harbour':'Der Hafen',
  'Reach Prestige {#0} first':'Erreiche zuerst Prestige {#0}','{0} gold':'{0} Gold',
  '{0} Speed Boost{1}':'{0} Tempo-Schub{1}','Declare war on {0}':'{0} den Krieg erklären',
  'You have {0} and {1}':'Du hast {1} und {0}'});
 assert.equal(I.text('Traveling to The Harbour…'),'Reise nach Der Hafen…','a value is translated on its own');
 assert.equal(I.text('Reach Prestige 1 first'),'Erreiche zuerst Prestige 1');
 assert.equal(I.text('1 500 gold'),'1 500 Gold');
 assert.equal(I.text('Speed Boost'),'Tempo-Schub','an empty value takes its space with it');
 assert.equal(I.text('Declare war on Ravenholt'),'Ravenholt den Krieg erklären','values move where the grammar wants them');
 assert.equal(I.text('You have 5 gold and 2 scraps'),'Du hast 2 scraps und 5 Gold');
 assert.equal(I.text('Nobody wrote this'),'Nobody wrote this','no translation: English stays');
 assert.ok(I.missing.has('Nobody wrote this'),'and is listed for QA');
 assert.equal(I.text(I.text('Traveling to Moonshine…')),'Reise nach Moonshine…','its own output is never translated twice');
});

test('text the source built from pieces is translated piece by piece', () => {
 const I=load('de',{
  'First build:':'Zuerst bauen:','Stone Quay':'Steinkai','Aqueduct & Fountain':'Aquädukt & Brunnen',
  'The crown is in steady hands.':'Die Krone ist in sicheren Händen.','🏦 The bank’s men left.':'🏦 Die Männer der Bank gingen.',
  'strangers':'Fremde','Warrior':'Krieger','Human':'Mensch','Thornwood Glade':'Dornwaldlichtung','Heroic Strike':'Heldenhafter Stoß',
  'Lord Chamberlain':'Lord Kämmerer','· {0} ◉ left on the line':'· {0} ◉ Kreditrahmen frei','Borrow':'Leihen'});
 assert.equal(I.text('First build: Stone Quay, Aqueduct & Fountain.'),'Zuerst bauen: Steinkai, Aquädukt & Brunnen.');
 assert.equal(I.text('“The crown is in steady hands.”'),'“Die Krone ist in sicheren Händen.”','a spoken line in quotes');
 assert.equal(I.text('The bank’s men left.'),'Die Männer der Bank gingen.','found without its emoji');
 assert.equal(I.text('STRANGERS'),'FREMDE','shouting: the lower-case unit, upper-cased');
 assert.equal(I.text('Warrior ⚔️🌀📯'),'Krieger ⚔️🌀📯');
 assert.equal(I.text('→ Thornwood Glade'),'→ Dornwaldlichtung');
 assert.equal(I.text('Heroic Strike 3'),'Heldenhafter Stoß 3');
 assert.equal(I.text('Lord Chamberlain +3'),'Lord Kämmerer +3');
 assert.equal(I.text('Bjorn - Human Warrior'),'Bjorn - Mensch Krieger','two words that are each a unit');
 assert.equal(I.text('Borrow · 1,000 ◉ left on the line'),'Leihen · '+(1000).toLocaleString()+' ◉ Kreditrahmen frei');
});

test('the page loads the layer first, translates its own words once, and GL2D text goes through it', () => {
 const head=html.slice(0,html.indexOf('</head>'));
 assert.ok(head.indexOf('assets/i18n/i18n-core.js')>0&&head.indexOf('assets/i18n/i18n-core.js')<head.indexOf('assets/i18n/i18n.js'),'core, then the layer, in <head>');
 assert.ok(html.indexOf('<script>I18N.page()</script>')<html.indexOf('assets/gl/gl2d.js')&&html.indexOf('<script>I18N.page()</script>')>html.indexOf('</nav>'),'after the page, before any script writes more');
 assert.match(gl,/fillText\(t,x,y,m\)\{drawText\(tr\(t\),x,y,m,false\);\}/);
 assert.match(gl,/measureText\(t\)\{t=tr\(t\);/);
 assert.match(gl,/if\(window\.I18N\)I18N\.skip\(tctx\);/,'its own text canvas gets words already translated');
 assert.match(game,/find\(b=>window\.I18N\?I18N\.same\(b\.textContent,'▴ Close'\):b\.textContent==='▴ Close'\)/,'the one place code reads its words back');
 assert.match(JSON.parse(read('package.json')).scripts.dist,/\|tools\|/,'the translators\' tools stay out of the exe');
});

test('Settings has a Language tab after Controls: English on top, the six others under it, three to a row, all alike', () => {
 const tabs=[...html.matchAll(/<button class="cfgtab[^"]*" id="(\w+)" data-pane="(\w+)"/g)].map(m=>m[2]);
 assert.deepEqual(tabs,['audio','video','controls','language']);
 const pane=html.slice(html.indexOf('id="paneLanguage"'),html.indexOf('<div class="cfgfooter">'));
 assert.match(pane,/<div class="langpick" translate="no">\s*<button class="langbtn langen" data-lang="en"[^>]*><b>English<\/b><\/button>\s*<div class="langrow">/);
 const row=[...pane.slice(pane.indexOf('langrow')).matchAll(/data-lang="(\w+)"/g)].map(m=>m[1]);
 assert.deepEqual(row,LANGS);
 for(const id of ['en',...LANGS])assert.match(rt,new RegExp("\\{id:'"+id+"'"),id+' is a language the layer knows');
 assert.match(css,/\.cfgtabs\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.langrow\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-auto-rows:1fr/,'six boxes of one size, on two rows (2026-10-13: "gör rutorna lika stora och en rad neråt")');
 assert.match(css,/\.langbtn\{[^}]*cursor:var\(--hand\)/);
 assert.match(game,/b\.onclick=\(\)=>\{if\(window\.I18N\)I18N\.choose\(b\.dataset\.lang\);\};/);
 assert.match(game,/window\.i18nBeforeReload=\(\)=>save\(\);/,'the hero is saved before the game starts again in the new language');
});

test('every language file covers the game and keeps every value, number and tag', () => {
 const keys=JSON.parse(read('tools/i18n/strings.json')).map(u=>u.key);
 const marks=s=>(s.match(/\{\d+\}|\{#\d+\}|<\d+>|<\/\d+>|<\d+\/>/g)||[]).sort().join(' ');
 for(const lang of LANGS){
  const file=path.join(root,'assets/i18n',lang+'.js');
  assert.ok(fs.existsSync(file),lang+'.js exists');
  let data=null;const c={I18N:{data:(id,o)=>{assert.equal(id,lang);data=o;}}};vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);
  const have=keys.filter(k=>data[k]!==undefined).length;
  assert.ok(have/keys.length>=0.98,lang+': '+have+' of '+keys.length+' units translated');
  for(const [k,v] of Object.entries(data))assert.equal(marks(v),marks(k),lang+': '+k);
 }
});

test('the skill tree\'s # numbers and a value\'s own spaces do not hide a unit', () => {
 const I=load('de',{'+#% max health':'+#% maximale Gesundheit','+#% damage for {#0} seconds':'+#% Schaden für {#0} Sekunden','You earn {0}.':'Du verdienst {0}.','and court fines':'und Gerichtsbußen'});
 assert.equal(I.text('+3% max health'),'+3% maximale Gesundheit');
 assert.equal(I.text('+5% damage for 3 seconds'),'+5% Schaden für 3 Sekunden','# and a written number, each in its place');
 assert.equal(I.text('You earn  and court fines.'),'Du verdienst  und Gerichtsbußen.'.replace('  ',' '));
});

test('the English plural "s" glued to a word in a slot is dropped in other languages', () => {
 const I=load('zh',{'{0} close{1} left':'还剩 {0} 次结算{1}','Your next {0} case{1} free.':'你接下来的 {0} 个宝箱{1}免费。','s are':'均'});
 assert.equal(I.text('8 closes left'),'还剩 8 次结算');
 assert.equal(I.text('1 close left'),'还剩 1 次结算');
 assert.equal(I.text('Your next 3 cases are free.'),'你接下来的 3 个宝箱均免费。','a longer glued value is a phrase, translated');
});

test('two values glued side by side: the unit at the start, the rest on its own', () => {
 const I=load('de',{'🏦 Season {0} is closed - the Tides Bank grades {1}{2}.':'🏦 Saison {0} ist abgeschlossen - die Tidenbank bewertet {1}{2}.','your books':'deine Bücher'});
 assert.equal(I.text('🏦 Season 3 is closed - the Tides Bank grades your books A.'),'🏦 Saison 3 ist abgeschlossen - die Tidenbank bewertet deine Bücher A.');
});

test('a name the game lower-cases mid-sentence is found by its capitalised unit', () => {
 const es=load('es',{'Sought after':'Codiciada','Hear ye! {0}':'¡Oíd! {0}','Hear ye! {0} souls within the walls, and the city is {1}.':'¡Oíd! {0} almas tras los muros, y la ciudad está {1}.'});
 assert.equal(es.text('sought after'),'codiciada');
 assert.equal(es.text('1,200 souls within the walls, and the city is sought after.'),(1200).toLocaleString()+' almas tras los muros, y la ciudad está codiciada.','the crier\'s line without its cry, as the Notices table shows it');
 const de=load('de',{'Rioting':'Im Aufruhr','Sought after':'Begehrt'});
 assert.equal(de.text('sought after'),'begehrt','a German adjective in running text is lower-case too');
 assert.equal(de.text('rioting'),'im Aufruhr','only the first letter: the noun inside keeps its capital');
});

test('an alias with no words of its own is never made - it would match everything', () => {
 const I=load('de',{'Hear ye! {0}':'Hört her! {0}','Warrior':'Krieger','🔓 {0}':'🔓 {0}'});
 assert.equal(I.text('Warrior ⚔️🌀📯'),'Krieger ⚔️🌀📯');
 assert.equal(I.text('Something nobody wrote'),'Something nobody wrote','not swallowed by a "{0}"');
});

test('a number written out English-style is grouped the way the game’s other numbers are', () => {
 const I=load('de',{'Need {#0}◉ and {#1}⚙':'Benötigt {#0}◉ und {#1}⚙','+{#0}% movement and attack speed.':'+{#0}% Bewegungs- und Angriffstempo.'});
 assert.equal(I.text('Need 500,000◉ and 500⚙'),'Benötigt '+(500000).toLocaleString()+'◉ und 500⚙','"500,000" would read as five hundred in German');
 assert.equal(I.text('+2.5% movement and attack speed.'),'+2.5% Bewegungs- und Angriffstempo.','a decimal is left as it is');
});

test('a context word never leaks its context into a line a template matched', () => {
 const I=load('de',{'controls|Scroll':'Scrollen','{0} - {1} mana, {2}s cooldown':'{0} - {1} Mana, {2} s Abklingzeit','Heroic Strike':'Heldenhafter Stoß'});
 assert.equal(I.ctx('Scroll','controls'),'Scrollen');
 assert.equal(I.ctx('Heroic Strike - 24 mana, 4s cooldown','controls'),'Heldenhafter Stoß - 24 Mana, 4 s Abklingzeit','Settings > Controls showed "controls|Heroic Strike"');
});

test('a line glued from whole units is cut where each unit ends: labels, sentences, dotted lists', () => {
 const I=load('de',{'Attack':'Angriff','Hybrid Strike':'Hybridschlag','A reliable strike. Reduces power cooldown by one turn.':'Ein verlässlicher Schlag. Verkürzt die Abklingzeit der Kraft um eine Runde.',
  '🛡 {0} defender{1} left{2}{3}{4} · {5}':'🛡 {0} Verteidiger{1} übrig{2}{3}{4} · {5}','· 🏹 {0} archer{1}':'· 🏹 {0} Bogenschützen{1}','· 🔥 {0} to burn':'· 🔥 {0} zum Niederbrennen'});
 assert.equal(I.text('Attack: Hybrid Strike. A reliable strike. Reduces power cooldown by one turn.'),'Angriff: Hybridschlag. Ein verlässlicher Schlag. Verkürzt die Abklingzeit der Kraft um eine Runde.');
 assert.equal(I.text('🛡 12 defenders left · 🏹 3 archers · 🔥 40 to burn · Silverfjord 35%'),'🛡 12 Verteidiger übrig · 🏹 3 Bogenschützen · 🔥 40 zum Niederbrennen · Silverfjord 35%','a slot that took the list keeps it translated, each unit found without the dot the template took');
});

test('an emoji the screen puts in front of a whole spoken line does not hide the line', () => {
 const I=load('de',{'A petitioner. My Hand deals with petitioners, and my Hand is busy.':'Ein Bittsteller. Um Bittsteller kümmert sich meine Hand, und meine Hand ist beschäftigt.'});
 assert.equal(I.text('👑 A petitioner. My Hand deals with petitioners, and my Hand is busy.'),'👑 Ein Bittsteller. Um Bittsteller kümmert sich meine Hand, und meine Hand ist beschäftigt.');
});
