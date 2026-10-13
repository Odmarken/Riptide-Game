/* 🌍 The rules a translation unit is cut and keyed by - shared word for word by the game (assets/i18n/i18n.js, on the
   live DOM and canvas) and by tools/i18n/extract.cjs (on the source), so the two always agree on what a unit is.

   A unit is the text of one element whose children are only text and simple inline tags (b, i, span... holding
   nothing but text): "Hang him on the square: the people <b>-5</b>" is ONE unit, written
   "Hang him on the square: the people <0>-{#0}</0>". Any other element is a container and each child is cut on its
   own. In a key, whitespace is folded to single spaces, numbers become {#0} {#1} (in order), the source's
   expressions {0} {1}, and the inline tags <0>..</0> (or <0/> for br/img). */
(function(root){
 const INLINE=new Set(['b','strong','i','em','u','s','small','span','a','sup','sub','mark','code','kbd','br','img','abbr','q','cite','del','ins','big','font','wbr']);
 const VOID=new Set(['br','img','input','hr','wbr','meta','link','source','col','area','base','embed','param','track']);
 const SKIP=new Set(['script','style','canvas','textarea','noscript','template','math']);   /* svg is walked: its <text> is shown (the ledger's charts) */
 const ATTRS=['title','placeholder','aria-label','alt'];
 /* private-use characters stand for slots, tags and numbers while a unit is being keyed - they hold no digits */
 const SLOT=0xE100,OPEN=0xE200,CLOSE=0xE300,VOIDM=0xE400,NUM=0xE500;
 const NUM_RE=/\d+(?:[.,  ]\d+)*/g;
 const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',hellip:'…',mdash:'—',ndash:'–',middot:'·',times:'×',rarr:'→',larr:'←',uarr:'↑',darr:'↓',
  copy:'©',reg:'®',trade:'™',bull:'•',laquo:'«',raquo:'»',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',deg:'°',minus:'−',plusmn:'±',frac12:'½',hearts:'♥',diams:'♦',clubs:'♣',spades:'♠',thinsp:' ',ensp:' ',emsp:' '};
 const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):+e.slice(1)):(ENT[e.toLowerCase()]!==undefined?ENT[e.toLowerCase()]:m));

 /* ---- a small HTML reader for the source's templates (the game itself uses the browser's) ---- */
 function parseAttrs(s){
  const a={},re=/([^\s"'>\/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;let m;
  while((m=re.exec(s)))a[m[1].toLowerCase()]=decode(m[3]!==undefined?m[3]:m[4]!==undefined?m[4]:m[5]!==undefined?m[5]:'');
  return a;
 }
 function parseHTML(s){
  const root={tag:'#root',attrs:{},kids:[]},stack=[root];let i=0;
  const text=t=>{if(t)stack[stack.length-1].kids.push({text:decode(t)});};
  while(i<s.length){
   const lt=s.indexOf('<',i);
   if(lt<0){text(s.slice(i));break;}
   if(lt>i)text(s.slice(i,lt));
   if(s.startsWith('<!--',lt)){const e=s.indexOf('-->',lt+4);i=e<0?s.length:e+3;continue;}
   /* a slot may sit where attributes go - data-v="'+x+'"'+(off?' disabled':'')+'>' - with no space before it */
   const m=/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s*[-]+|\s+[^\s"'>\/=-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/.exec(s.slice(lt,lt+4000));
   if(!m){text('<');i=lt+1;continue;}
   const tag=m[2].toLowerCase();
   if(m[1]){for(let k=stack.length-1;k>0;k--)if(stack[k].tag===tag){stack.length=k;break;}}
   else{
    const el={tag,attrs:parseAttrs(m[3]),kids:[]};stack[stack.length-1].kids.push(el);
    if(SKIP.has(tag)&&!VOID.has(tag)&&!m[4]){const end=s.toLowerCase().indexOf('</'+tag,lt+m[0].length);i=end<0?s.length:(s.indexOf('>',end)+1||s.length);continue;}
    if(!VOID.has(tag)&&!m[4])stack.push(el);
   }
   i=lt+m[0].length;
  }
  return root;
 }
 /* the same walk over either tree: A says how to read a node */
 const TREE={isText:n=>n.text!==undefined,text:n=>n.text,tag:n=>n.tag,kids:n=>n.kids,attr:(n,a)=>n.attrs&&n.attrs[a]};
 const hasWords=s=>/[A-Za-zÀ-ɏЀ-ӿ一-鿿]/.test(s.replace(/[\uE100-\uE5FF]/g,''));
 const simpleInline=(n,A)=>{const t=A.tag(n);if(!INLINE.has(t))return false;if(VOID.has(t))return true;return A.kids(n).every(k=>A.isText(k));};
 /* a rich node: its kids are text and simple inline tags only, with some words among them */
 function rich(n,A){
  const kids=A.kids(n);
  if(!kids.length||!kids.every(k=>A.isText(k)||simpleInline(k,A)))return false;
  let any=false;for(const k of kids)if(hasWords(A.isText(k)?A.text(k):textOf(k,A)))any=true;
  return any;
 }
 const textOf=(n,A)=>A.isText(n)?A.text(n):A.kids(n).map(k=>textOf(k,A)).join('');
 /* one tag wrapping the whole unit (only spaces beside it) is not part of it: <div><b>Close</b></div> is "Close" */
 function lone(kids,A){
  const real=kids.filter(k=>!(A.isText(k)&&!A.text(k).trim()));
  return real.length===1&&!A.isText(real[0])&&!VOID.has(A.tag(real[0]))?real[0]:null;
 }
 /* the raw unit: text as it is, inline tags as private-use marks */
 function rawOf(kids,A){
  let s='',k=0;
  for(const c of kids){
   if(A.isText(c)){s+=A.text(c);continue;}
   const n=k++;
   if(VOID.has(A.tag(c))){s+=String.fromCharCode(VOIDM+n);continue;}
   s+=String.fromCharCode(OPEN+n)+textOf(c,A)+String.fromCharCode(CLOSE+n);
  }
  return s;
 }
 /* data-i18n="ctx" on an element gives the words inside it a context: "outfit|Worn" (the outfit you have on) is not
    "Worn" (the item prefix). The runtime looks the context key up first, then the plain one. */
 const CTX_SEP='|';
 function unitsOf(n,A,out,ctx){
  const c0=A.attr(n,'data-i18n');if(c0)ctx=c0;
  const put=s=>out.push(ctx?ctx+CTX_SEP+s.trim():s);
  for(const a of ATTRS){const v=A.attr(n,a);if(v&&hasWords(v))put(v);}
  const t=A.tag(n);
  if(t&&SKIP.has(t))return out;
  if(A.attr(n,'translate')==='no')return out;
  const kids=A.kids(n);
  if(rich(n,A)){
   const one=lone(kids,A);
   if(one)return unitsOf(one,A,out,ctx);
   for(const c of kids)if(!A.isText(c))for(const a of ATTRS){const v=A.attr(c,a);if(v&&hasWords(v))put(v);}
   put(rawOf(kids,A));return out;
  }
  for(const c of kids){
   if(A.isText(c)){if(hasWords(A.text(c)))put(A.text(c));}
   else unitsOf(c,A,out,ctx);
  }
  return out;
 }
 const unitsOfTree=tree=>unitsOf(tree,TREE,[]);

 /* ---- keys ---- */
 /* canon(raw) -> {key, nums, lead, trail}: the key a unit is looked up by, the numbers it carried, its outer spaces */
 function canon(raw){
  const lead=(/^\s+/.exec(raw)||[''])[0],trail=(/\s+$/.exec(raw)||[''])[0];
  const nums=[];
  /* numbers first: "1 500 000" written with no-break spaces is ONE number, and folding spaces first would split it */
  let s=raw.replace(NUM_RE,m=>{nums.push(m);return String.fromCharCode(NUM+nums.length-1);});
  s=s.replace(/\s+/g,' ').trim();
  const slots=new Map();
  let key='';
  for(const ch of s){
   const c=ch.codePointAt(0);
   if(c>=SLOT&&c<SLOT+256){if(!slots.has(c))slots.set(c,slots.size);key+='{'+slots.get(c)+'}';}
   else if(c>=OPEN&&c<OPEN+256)key+='<'+(c-OPEN)+'>';
   else if(c>=CLOSE&&c<CLOSE+256)key+='</'+(c-CLOSE)+'>';
   else if(c>=VOIDM&&c<VOIDM+256)key+='<'+(c-VOIDM)+'/>';
   else if(c>=NUM&&c<NUM+256)key+='{#'+(c-NUM)+'}';
   else key+=ch;
  }
  return {key,nums,lead,trail};
 }
 const keyFromRaw=raw=>canon(raw).key;
 /* a unit worth translating: a real word in it, two letters or more, outside its marks */
 const wordy=key=>/[A-Za-z]{2,}/.test(key.replace(/<\/?\d+\/?>|\{#?\d+\}/g,' '));
 /* strings that are code, not words: paths, CSS, selectors, ids */
 function looksLikeCode(text){
  const t=text.replace(/[\uE100-\uE1FF]/g,' ').trim();
  if(!t)return true;
  const t0=text.replace(/[\uE100-\uE1FF]/g,'').trim();   /* the same with its slots closed up: "players.{0}.bet" is one token */
  if(!/\s/.test(t0)&&!/<[a-z]/i.test(t0)){
   if(t0.length>32)return true;                                                /* base64, keys, hashes */
   if(/[\/\\]/.test(t0)&&!/^[A-Z][a-z]{0,3}\/[A-Z][a-z]{0,3}$/.test(t0))return true;   /* paths - but "Hi/Lo" is a word */
   if(/[="'`\[\]{}|]/.test(t0)||/:./.test(t0))return true;                     /* key=value, a:b, quotes, selectors - but "First:" is a label */
   if(/\w\.+\w/.test(t0))return true;                                           /* dotted names, domains */
   if(/\d[A-Z]|[A-Z]{2}\d/.test(t0)&&/\d.*\d/.test(t0))return true;           /* ids like G-1F2M3QS4Z */
   if(/_/.test(t0))return true;
   if(/^[a-z]+-[a-z0-9-]+$/.test(t0))return true;
  }
  if(/^[\w-]+(,[\w-]+)+$/.test(t0))return true;                                  /* lists of ids */
  if(/(^|[\s,])(button|select|input|a|div|span)[\[:.#,]/.test(t)&&/[\[\]=]/.test(t))return true;   /* CSS selectors */
  if(/(^|[\s"'(=])(\.{1,2}\/[\w.-]|\/[a-z_][\w-]*\/|https?:|data:|blob:|assets\/)|\.(png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|json|js|css|html|ttf|woff2?)\b/i.test(t))return true;   /* paths - but "3/5" is a count */
  if(/[a-z-]+\s*:\s*[^;{}]+;/.test(t)&&!/[.!?]\s/.test(t)&&!/<[a-z]/i.test(t)&&t.split(/\s+/).filter(w=>/[a-z]{3,}/i.test(w)).length<6)return true;   /* CSS - but a sentence with a colon and a semicolon is prose */
  if(/^\s*(rgba?|hsla?|url|linear-gradient|radial-gradient|calc|var|translate|rotate|scale|matrix|drop-shadow|blur|brightness|cubic-bezier)\(/i.test(t))return true;
  if(/^#[0-9a-f]{3,8}$/i.test(t))return true;
  if(/\b\d+(px|vh|vw|rem|ms|deg)\b/.test(t)&&!/\s[a-z]{3,}\s/i.test(t.replace(/\b\d+(px|vh|vw|rem|ms|deg)\b/g,'')))return true;
  if(/^[.#\[][\w-]/.test(t)&&!/\s[a-z]{2,}\s[a-z]{2,}/i.test(t))return true;
  if(/[-](px|vh|vw|rem|em|deg)\b/.test(text))return true;   /* n+'px' (but n+'s' is seconds on screen) */
  if(/[-] [a-z]{2,}|[a-z]{2,} [-]/.test(text))return false; /* n+' fps', 'x '+n: a word beside a value is shown */
  if(/^[a-z0-9_$-]+$/.test(t))return true;                                  /* ids, keys, events: one lower-case token */
  if(/^[a-z][a-z0-9]*([A-Z_][a-zA-Z0-9]*)+$/.test(t))return true;          /* camelCase / snake_case */
  if(/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(t))return true;                          /* CONSTANT_NAMES */
  if(/=>|\bfunction\b|\breturn\b|[{};]\s*$/.test(t)&&!/[.!?…]$/.test(t))return true;
  if(/^[\w-]+(\s+[\w-]+)*$/.test(t)&&/^[a-z]/.test(t)&&/[-_]/.test(t)&&!/\s/.test(t))return true;
  return false;
 }
 Object.assign(root,{CTX_SEP,INLINE,VOID,SKIP,ATTRS,SLOT,OPEN,CLOSE,VOIDM,NUM,NUM_RE,decode,parseHTML,TREE,rich,lone,rawOf,unitsOf,unitsOfTree,canon,keyFromRaw,wordy,hasWords,looksLikeCode,textOf,simpleInline});
})(typeof module!=='undefined'&&module.exports?module.exports:(window.I18NCore={}));
