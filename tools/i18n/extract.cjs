/* 🌍 Collects every piece of text the game can put on screen, as translation units.
   Run: node tools/i18n/extract.cjs   ->  tools/i18n/strings.json

   The game is not rewritten for translation: assets/i18n/i18n.js translates text where it reaches the screen
   (innerHTML, textContent, canvas fillText, titles...). This script builds the list of units that layer will meet,
   from the source: every string literal, template literal and '+' chain that can be shown, with its expressions as
   {0} {1} placeholders and its numbers as {#0} {#1}. HTML is cut into the same units the runtime cuts the DOM into
   (unit() in i18n.js): an element whose children are text and simple inline tags is one unit, its tags written
   <0>..</0>; anything else is split per child. Keep the two in step - tests/i18n.test.cjs checks they agree. */
const ts=require('typescript'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const I=require(path.join(ROOT,'assets/i18n/i18n-core.js'));   /* the runtime's own key rules: normalise, inline tags */

const SKIP_FILES=/(^|\/)(gl\/gl2d\.js|i18n\/|sprite-edges\.js|sprite-cutout-masks\.js|[\w-]*hit-masks\.js|cloud\/firestore-rest\.js)/;
function walkDir(d,out=[]){for(const f of fs.readdirSync(path.join(ROOT,d))){const p=d+'/'+f,st=fs.statSync(path.join(ROOT,p));if(st.isDirectory())walkDir(p,out);else if(/\.js$/.test(f))out.push(p);}return out;}
const FILES=['game.js',...walkDir('assets')].filter(f=>!SKIP_FILES.test(f));

/* calls whose string arguments are names, selectors, keys or patterns - never shown */
const QUIET_CALLS=new Set(['$','getElementById','querySelector','querySelectorAll','closest','matches',
 'addEventListener','removeEventListener','getAttribute','hasAttribute','removeAttribute','createElement','matchMedia','require','fetch','getItem','setItem',
 'removeItem','postMessage','log_','warn','error','info','debug','RegExp','parse','parseInt','parseFloat','split','indexOf','lastIndexOf','includes',
 'startsWith','endsWith','match','matchAll','search','has','get','delete','getContext','padStart','padEnd','join','sfx','play','playSfx','deviceGet','deviceSet',
 'cloudCall','openTab','openPanel','setProperty','getPropertyValue','removeProperty','toggleAttribute','insertRule','loadImg','img','artImg','image','assetImg',
 'Image','createPattern','createLinearGradient','addColorStop','keyOf','track','mark','trace','time','timeEnd','dispatchEvent','CustomEvent','Event',
 'scrollIntoView','focus','blur','fx','spawnFx','SpellFx','recipe','stop','pause','load','preload','prefetch','animate','getComputedStyle','escape','encodeURIComponent','decodeURIComponent']);
/* object keys whose values are ids, art, colours or settings - not words */
/* (only keys whose values are never words, even capitalised ones - an id-like value is dropped by looksLikeCode anyway) */
const QUIET_KEYS=/^(id|key|code|keyName|src|url|href|file|img|font|c|col|color|colour|fill|stroke|bg|glow|tint|class|className|cursor|mask|art|anim|sfx|sound|music|track|tex|sheet|frames|blend|layer|recipe|asset|ev|event|fn|op|selector|sel|attr|field|prop|pane|mode|state|kind|skin|race|cls|zone|map|amb|lang)$/;
const QUIET_PROPS=new Set(['className','id','src','href','type','cursor','font','fillStyle','strokeStyle','globalCompositeOperation','textAlign','textBaseline',
 'lineJoin','lineCap','filter','direction','imageSmoothingQuality','letterSpacing','display','transform','background','backgroundImage','color','width','height',
 'left','top','right','bottom','opacity','zIndex','position','pointerEvents','visibility','overflow','transition','animation','cssText','borderColor','boxShadow',
 'value','name','dataset','key','code','htmlFor','role','tabIndex','dir','lang','download','rel','crossOrigin','preload','loading','decoding','mode','state','kind','skin','zone','race','cls']);
const SHOW_PROPS=new Set(['innerHTML','textContent','innerText','title','placeholder','alt','outerHTML']);

const PH=i=>String.fromCharCode(0xE100+i);   /* an expression's slot inside a template, digit-free so numbers stay numbers */
const units=new Map();   /* key -> {key,where:Set,files:Set} */
function addUnit(key,where){
 if(!I.wordy(key))return;
 let u=units.get(key);if(!u){u={key,where:new Set()};units.set(key,u);}
 if(u.where.size<4)u.where.add(where);
}
/* a template's text with its slots, cut into units the way the runtime will see it */
const MARK=/[\uE200-\uE4FF]/;
function emitTemplate(text,where,maxSlots){
 const add=(k,w)=>{if(maxSlots!==undefined&&(k.match(/\{\d+\}/g)||[]).length>maxSlots)return;addUnit(k,w);};
 if(!/[A-Za-z]/.test(text.replace(/[\uE100-\uE1FF]/g,'')))return;
 /* titles and labels, even in a fragment of a tag (' title="Declare war on '+name+'"') */
 for(const m of text.matchAll(/\b(?:title|aria-label|placeholder|alt)\s*=\s*(["'])([^"']*)/g))
  if(I.hasWords(m[2])&&!I.looksLikeCode(m[2]))add(I.keyFromRaw(I.decode(m[2])),where);
 if(/<\/?[a-zA-Z][^>]*>/.test(text)){
  /* HTML: judged unit by unit - a src="assets/..." or a style="..." in a tag says nothing about the words beside it */
  const tree=I.parseHTML(text);
  for(const u of I.unitsOfTree(tree)){
   const ctx=/^[a-z]+\|/.exec(u);   /* "ledger|Close": judged by its words, not by the context in front */
   if(I.looksLikeCode((ctx?u.slice(ctx[0].length):u).replace(/[\uE200-\uE4FF]/g,' ')))continue;
   add(I.keyFromRaw(u),where);
   /* a unit with tags: its pieces stand on their own too, for when a slot beside them turns out to hold buttons or
      blocks and the runtime cuts the element up ("<span>Borrow \u00B7 1,000 \u25C9 left on the line</span>" + buttons) */
   if(MARK.test(u))for(const p of u.split(/[\uE200-\uE4FF]/))if(p.trim()&&I.hasWords(p)&&!I.looksLikeCode(p))add(I.keyFromRaw(p),where);
  }
 }else if(!I.looksLikeCode(text))add(I.keyFromRaw(I.decode(text)),where);   /* "a &middot; b" reaches the screen as "a · b" */
}
function stringParts(node,parts,sub){
 /* flattens a '+' chain / template literal into text and slots; the slots' own strings are visited separately */
 if(ts.isParenthesizedExpression(node))return stringParts(node.expression,parts,sub);
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){parts.push(node.text);return;}
 if(ts.isTemplateExpression(node)){
  parts.push(node.head.text);
  for(const sp of node.templateSpans){parts.push({slot:sp.expression});sub.push(sp.expression);parts.push(sp.literal.text);}
  return;
 }
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken&&isStringy(node)){
  stringParts(node.left,parts,sub);stringParts(node.right,parts,sub);return;
 }
 parts.push({slot:node});sub.push(node);
}
function choices(node){   /* the literal strings a slot can be: c?'a':'b', and c?'a':d?'b':'c' */
 if(ts.isParenthesizedExpression(node))return choices(node.expression);
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return [node.text];
 if(ts.isConditionalExpression(node)){const a=choices(node.whenTrue),b=choices(node.whenFalse);return a&&b?a.concat(b):null;}
 return null;
}
function isStringy(node){
 if(ts.isParenthesizedExpression(node))return isStringy(node.expression);
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node))return true;
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken)return isStringy(node.left)||isStringy(node.right);
 return false;
}
function calleeName(call){
 const e=call.expression;
 if(ts.isIdentifier(e))return e.text;
 if(ts.isPropertyAccessExpression(e))return e.name.text;
 return '';
}
/* is this string's value only ever a name, a key or a pattern? */
function quietContext(node){
 let p=node.parent,child=node;
 while(p&&(ts.isParenthesizedExpression(p)||(ts.isConditionalExpression(p)&&child!==p.condition)||(ts.isBinaryExpression(p)&&(p.operatorToken.kind===ts.SyntaxKind.BarBarToken||p.operatorToken.kind===ts.SyntaxKind.QuestionQuestionToken||p.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)&&child!==p.left))){child=p;p=p.parent;}
 if(!p)return false;
 if(ts.isCallExpression(p)||ts.isNewExpression(p)){
  const n=calleeName(p);
  if(n==='setAttribute'){const a=p.arguments&&p.arguments[0];return !(child!==a&&a&&ts.isStringLiteral(a)&&/^(title|placeholder|aria-label|alt|data-tip|aria-valuetext)$/.test(a.text));}
  /* classList.add('on') is a class name; the game's own add('red',100,'The bailiffs sell...') is words */
  if(/^(add|remove|toggle|contains|replace)$/.test(n)){
   const obj=ts.isPropertyAccessExpression(p.expression)?p.expression.expression.getText():'';
   if(/classList$/.test(obj))return true;
   if(n==='replace'||n==='contains')return !!p.arguments&&p.arguments[0]===child;
   return false;
  }
  if(n==='set'&&ts.isPropertyAccessExpression(p.expression))return !!p.arguments&&p.arguments[0]===child;   /* a Map's key, not its value */
  if(QUIET_CALLS.has(n))return true;
  if(ts.isPropertyAccessExpression(p.expression)&&/^(console|classList|localStorage|sessionStorage|dataset|style|JSON|Object|Reflect|Math|Number)$/.test(p.expression.expression.getText()))return true;
  return false;
 }
 if(ts.isElementAccessExpression(p)&&p.argumentExpression===child)return true;
 if(ts.isPropertyAssignment(p)){
  if(p.name===child)return true;
  const k=p.name&&(p.name.text||p.name.getText());
  return QUIET_KEYS.test(k||'');
 }
 if(ts.isBinaryExpression(p)){
  const k=p.operatorToken.kind;
  if([ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.InKeyword,ts.SyntaxKind.InstanceOfKeyword].includes(k))return true;
  if(k===ts.SyntaxKind.EqualsToken||k===ts.SyntaxKind.PlusEqualsToken){
   const L=p.left;
   if(ts.isPropertyAccessExpression(L)){const n=L.name.text;if(SHOW_PROPS.has(n))return false;if(QUIET_PROPS.has(n))return true;
    if(ts.isPropertyAccessExpression(L.expression)&&/^(style|dataset)$/.test(L.expression.name.text))return true;}
   if(ts.isElementAccessExpression(L))return /dataset|style/.test(L.expression.getText());
  }
  return false;
 }
 if(ts.isCaseClause(p))return true;
 if(ts.isImportDeclaration(p)||ts.isExportDeclaration(p))return true;
 return false;
}
function visitFile(file){
 const src=fs.readFileSync(path.join(ROOT,file),'utf8');
 const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const done=new Set();
 const where=n=>file+':'+(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1);
 function handle(node){
  if(done.has(node))return;
  done.add(node);
  const parts=[],sub=[];
  stringParts(node,parts,sub);
  const quiet=quietContext(node);
  if(!quiet){
   let text='',k=0;
   for(const p of parts)text+=typeof p==='string'?p:PH(k++);
   emitTemplate(text,where(node));
   /* a small inline choice makes whole sentences of each form: '⚔ '+(hall?'The throne hall of ':'Raid on ')+name is
      "⚔ The throne hall of {0}" and "⚔ Raid on {0}" - not "⚔ {0}{1}" with two loose fragments */
   const alts=parts.map(p=>typeof p==='string'?null:choices(p.slot));
   const at=alts.map((a,i)=>a&&a.length<=4?i:-1).filter(i=>i>=0).slice(0,2);
   if(at.length){   /* (a line of five values or more is a HUD readout, not a sentence: left as it is) */
    const combos=at.reduce((acc,i)=>acc.flatMap(c=>alts[i].map(v=>({...c,[i]:v}))),[{}]);
    for(const c of combos){
     let t='',j=0;
     parts.forEach((p,i)=>{t+=typeof p==='string'?p:(c[i]!==undefined?c[i]:PH(j++));});
     emitTemplate(t,where(node),4);   /* (a unit of five values or more from a variant is a HUD readout: not kept) */
    }
   }
  }
  for(const s of sub)visit(s);   /* the slots' own strings: ternary branches, nested templates, helper calls */
 }
 function visit(node){
  if(isStringy(node)&&!(node.parent&&ts.isBinaryExpression(node.parent)&&node.parent.operatorToken.kind===ts.SyntaxKind.PlusToken&&isStringy(node.parent))
     &&!(node.parent&&ts.isParenthesizedExpression(node.parent)&&isStringy(node.parent))){handle(node);return;}
  if(ts.isRegularExpressionLiteral(node))return;
  ts.forEachChild(node,visit);
 }
 visit(sf);
}
for(const f of FILES)visitFile(f);

/* index.html: the page's own words, and its titles and labels */
{
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const body=html.slice(html.indexOf('<body'),html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const tree=I.parseHTML(body);
 for(const u of I.unitsOfTree(tree))addUnit(I.keyFromRaw(u),'index.html');
}

/* units that are the same sentence over and over in data, folded into one template the runtime matches; and names that are
   brands of their own (the 300 hybrid Tides' coined names) - shown as they are in every language, so never sent to translate */
const FOLD=[[/^A Tide bred from (.+) and (.+)\.$/,'A Tide bred from {0} and {1}.']];
const KEEP=new Set(['Rimfrost']);   /* the old name of Frostseeker lives on only as an alias in game.js - never shown, never shipped */
try{for(const h of require(path.join(ROOT,'assets/tides/hybrids.js')))KEEP.add(h.name);}catch(e){}
for(const [k,u] of [...units]){
 if(KEEP.has(k)){units.delete(k);continue;}
 for(const [re,tpl] of FOLD)if(re.test(k)){units.delete(k);addUnit(tpl,u.where.values().next().value);break;}
}
for(const k of require('./observed.json').keys)addUnit(k,'observed');
/* a scroll is shown without its "Scroll of" ("Chain Lightning III"): the name on its own is a unit too */
for(const k of [...units.keys()]){const m=/^Scroll of (.+)$/.exec(k);if(m&&!/{/.test(m[1]))addUnit(m[1],'derived');}
const list=[...units.values()].map(u=>({key:u.key,where:[...u.where]})).sort((a,b)=>a.key.localeCompare(b.key));
const words=list.reduce((n,u)=>n+u.key.replace(/<\/?\d+\/?>|\{#?\d+\}/g,' ').split(/\s+/).filter(w=>/[A-Za-z]/.test(w)).length,0);
fs.mkdirSync(path.join(__dirname),{recursive:true});
fs.writeFileSync(path.join(__dirname,'strings.json'),JSON.stringify(list,null,1)+'\n');
console.log('units',list.length,'words',words,'files',FILES.length+1);
