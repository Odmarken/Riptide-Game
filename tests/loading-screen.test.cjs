/* Run with: node --test tests/loading-screen.test.cjs
 * 🌊 The loading screen is the storm-and-wave painting (2026-10-13: "byta ut loading screenen till denna bild ... gör den
 * till 4k" - the Steam page background, cut from its own 5504x3072 master), and the menus keep their own backdrop
 * ("det ska vara den jag hade förut där man väljer gubbar"): since 2026-10-15 Moonshine at dusk from the cobbles by the
 * Tavern ("i moonshine vid huset ... från markhöjd och ser in mot husen och lamporna"), Nano Banana Pro 4K, masters and
 * job ids in concepts/menu-backdrop.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');

/* width and height from a JPEG's start-of-frame marker */
function jpegSize(file){
 const b=fs.readFileSync(file);
 assert.ok(b[0]===0xFF&&b[1]===0xD8,file+' is a JPEG');
 for(let i=2;i<b.length-9;){
  if(b[i]!==0xFF){i++;continue;}
  const m=b[i+1],len=b.readUInt16BE(i+2);
  if(m>=0xC0&&m<=0xC3)return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];
  i+=2+len;
 }
 throw new Error('no frame in '+file);
}

test('every screen shape covers itself with the wave painting - the 4K picture, or its 9:16 cut on portrait screens', () => {
 assert.deepEqual(jpegSize(path.join(root,'assets/ui/loading_tide.jpg')),[3840,2160],'4K');
 assert.deepEqual(jpegSize(path.join(root,'assets/ui/loading_tide_phone.jpg')),[1440,2560],'the phone cut');
 assert.match(css,/#boot\{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;\n  background:url\('assets\/ui\/loading_tide\.jpg\?v=1'\) center\/cover no-repeat #545e67;/);
 assert.match(css,/@media \(max-aspect-ratio:1\/1\)\{\n  #boot\{background-image:url\('assets\/ui\/loading_tide_phone\.jpg\?v=1'\);/);
 const plain=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const bootRules=[...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>/#boot\b/.test(m[1]));
 for(const [,sel,body] of bootRules){
  assert.doesNotMatch(body,/border-image|loading_(desktop|phone|frame|medallion)/,`${sel.trim()}: no frame, no old painting`);
  assert.doesNotMatch(sel,/#boot::(before|after)/,'no medallions');
 }
});

test('the boot preloader fetches exactly the picture style.css shows on this screen', () => {
 const pre=game.slice(game.indexOf('function bootPreload(){'),game.indexOf("['ui_background'",game.indexOf('function bootPreload(){')));
 assert.match(pre,/push\(mq\('\(max-aspect-ratio:1\/1\)'\)\?'assets\/ui\/loading_tide_phone\.jpg\?v=1':'assets\/ui\/loading_tide\.jpg\?v=1'\);/);
 const urls=pre.match(/assets\/ui\/(loading|menu)_[a-z_]+\.jpg\?v=\d+/g);
 assert.equal(urls.length,4,'the wave and the menus\' painting, each with its portrait cut');
 for(const url of urls)assert.ok(css.includes(`url('${url}')`),url+' is the same URL in style.css');
});

test('phones tint their status bar with the storm clouds along the picture\'s top', () => {
 const theme=game.match(/const THEME_BOOT='(#[0-9a-f]{6})'/)[1];
 assert.equal(theme,'#636a72');
 assert.ok(html.includes(`<meta name="theme-color" content="${theme}">`),'the page starts on the same tint');
 assert.match(game,/THEME_MENU='#192842'/,'the menus: Moonshine\'s evening sky under their wash');
});

test('the sign-in, the hero list and a new hero stand in Moonshine at dusk - the 4K painting, or its 9:16 cut on portrait screens', () => {
 assert.deepEqual(jpegSize(path.join(root,'assets/ui/menu_moonshine.jpg')),[3840,2160],'4K');
 assert.deepEqual(jpegSize(path.join(root,'assets/ui/menu_moonshine_phone.jpg')),[1440,2560],'the phone cut');
 assert.ok(!html.includes('menuArt'),'no loading painting laid behind the menus');
 for(const sel of ['#create{position:absolute','#select,#login{position:absolute']){
  const at=css.indexOf(sel);assert.ok(at>=0,sel);
  assert.match(css.slice(at,css.indexOf('}',at)),/url\('assets\/ui\/menu_moonshine\.jpg\?v=1'\) center\/cover no-repeat;/,sel);
 }
 assert.equal(css.split("url('assets/ui/menu_moonshine.jpg?v=1') center/cover no-repeat").length-1,4,'the page, the app column and the three screens');
 /* under 900px the page and the narrower app column must paint the same picture: sized by the height, set on the bottom */
 assert.match(css,/@media \(max-width:899px\)\{\n[^}]*#select,#login,#create\{background-size:auto 125%;background-position:center bottom\}/);
 assert.match(css,/@media \(max-aspect-ratio:1\/1\)\{\n(?:.*\n){2}[^}]*#select,#login,#create\{background-size:auto 112%;background-position:center bottom\}/);
 const phones=css.slice(css.indexOf('@media (max-aspect-ratio:5/8){'));
 assert.ok(phones.length<css.length,'a phone block');
 assert.match(phones,/body:has\(#create\.open\) #app\{background-image:url\('assets\/ui\/menu_moonshine_phone\.jpg\?v=1'\)\}/);
 assert.match(phones,/#select,#login,#create\{background-image:linear-gradient\(rgba\(8,14,11,\.35\),rgba\(8,14,11,\.5\)\),url\('assets\/ui\/menu_moonshine_phone\.jpg\?v=1'\)\}/,'the wash stays on top of the phone cut');
 assert.match(game,/push\(mq\('\(max-aspect-ratio:5\/8\)'\)\?'assets\/ui\/menu_moonshine_phone\.jpg\?v=1':'assets\/ui\/menu_moonshine\.jpg\?v=1'\);/,'loaded with the boot screen, so the menus never pop in');
 assert.ok(!/bakground_signin/.test(css+game+html),'the old tavern room is off every screen');
});
