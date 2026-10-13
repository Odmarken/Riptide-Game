/* 🌍 The game in seven languages (2026-10-13: "fixa alla språken ... översätt allt i spelet som har text eller visar
   saker"). Nothing in the game is written for translation: this file translates text where it reaches the screen -
   innerHTML, textContent, insertAdjacentHTML, titles and placeholders, alert/confirm, and canvas text (2D and GL2D) -
   looking each unit up in assets/i18n/<lang>.js. A unit is cut and keyed by i18n-core.js, the same rules
   tools/i18n/extract.cjs used on the source, so what the screen shows and what was translated agree. English goes
   straight through, untouched. Changing language saves and reloads, so every screen is drawn fresh in the new one.
   A unit with no translation stays English; I18N.missing lists them (QA). */
(function(){
 const C=window.I18NCore;
 const LANGS=[
  {id:'en',name:'English'},
  {id:'zh',name:'简体中文',en:'Simplified Chinese',html:'zh-Hans'},
  {id:'ru',name:'Русский',en:'Russian'},
  {id:'es',name:'Español',en:'Spanish'},
  {id:'de',name:'Deutsch',en:'German'},
  {id:'it',name:'Italiano',en:'Italian'},
  {id:'pt',name:'Português (Brasil)',en:'Portuguese (Brazil)',html:'pt-BR'}];
 const VER=1;                       /* bump when a language file changes */
 const STORE='riptide.lang';
 const DATA={};
 const ok=id=>LANGS.some(l=>l.id===id)||id==='xx';   /* xx: the pseudo-language QA uses, every unit in ⟦brackets⟧ */
 function pick(){
  try{const q=new URLSearchParams(location.search).get('lang');if(q&&ok(q))return q;}catch(e){}
  try{const s=localStorage.getItem(STORE);if(s&&ok(s))return s;}catch(e){}
  try{
   for(const l of (navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en'])){
    const t=String(l).toLowerCase();
    if(t.startsWith('zh'))return 'zh';
    const b=t.split('-')[0];
    if(['ru','es','de','it','pt'].includes(b))return b;
    if(b==='en')return 'en';
   }
  }catch(e){}
  return 'en';
 }
 let lang=pick();
 const HTML_LANG=((LANGS.find(l=>l.id===lang)||{}).html)||(lang==='xx'?'en':lang);
 const I18N=window.I18N={LANGS,VER,missing:new Set(),stats:{hit:0,miss:0},
  get lang(){return lang;},
  data(id,obj){DATA[id]=obj;if(id===lang)build();},
  text:s=>trText(s),
  html:s=>trHTML(s),
  ctx:(s,ctx)=>trCtx(s,ctx),   /* text with a data-i18n context, as the page walk reads it */
  /* the same words, in whatever language is on screen: for the few places code reads its own text back */
  same:(shown,english)=>shown===english||shown===trText(english),
  /* words that are translated already (a wrapped line's pieces): the canvas doors let them pass */
  keep:s=>{if(lang!=='en'&&typeof s==='string'&&s){if(produced.size>20000)produced.clear();produced.add(s);}return s;},
  choose(id){
   if(!ok(id)||id===lang)return;
   try{localStorage.setItem(STORE,id);}catch(e){}
   const go=()=>{try{const u=new URL(location.href);if(u.searchParams.has('lang')){u.searchParams.delete('lang');location.replace(u.href);return;}}catch(e){}location.reload();};
   Promise.resolve(typeof window.i18nBeforeReload==='function'?window.i18nBeforeReload():null).catch(()=>{}).then(go,go);
  }};

 const now=typeof performance!=='undefined'?()=>performance.now():()=>Date.now();
 const PROF=I18N.prof={html:0,htmlMiss:0,htmlChars:0,htmlMs:0,text:0,textMiss:0,textMs:0,slow:[]};   /* how often each door is used, and what a miss costs */

 /* ---- the dictionary: exact keys, and templates with {0} slots matched as patterns ---- */
 let dict=null,byHead=null,loose=null;
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const TOK=/\{(\d+)\}|\{#(\d+)\}|<(\d+)>|<\/(\d+)>|<(\d+)\/>/g;
 function compile(key){
  const toks=[];let last=0,m;
  TOK.lastIndex=0;
  while((m=TOK.exec(key))){if(m.index>last)toks.push({lit:key.slice(last,m.index)});toks.push({m:[...m]});last=TOK.lastIndex;}
  if(last<key.length)toks.push({lit:key.slice(last)});
  let re='^';const groups=[];
  toks.forEach((t,i)=>{
   if(t.lit!==undefined){re+=esc(t.lit);return;}
   const g=t.m,next=toks[i+1];
   if(g[1]!==undefined){
    /* a slot can come out empty ("{0} Speed Boost{1}" with no icon and no suffix): the space beside it goes with it */
    if(re.endsWith(' ')){re=re.slice(0,-1)+'(?: (.*?))?';}
    else if(next&&next.lit!==undefined&&next.lit[0]===' '&&i===0){re+='(?:(.*?) )?';next.lit=next.lit.slice(1);}
    else re+='(.*?)';
    groups.push({slot:+g[1],suffix:/[A-Za-z]$/.test((toks[i-1]&&toks[i-1].lit)||'')});   /* "close{1}": a slot glued to a word is its English plural */
   }
   else if(g[2]!==undefined){re+='\\{#(\\d+)\\}';groups.push({num:+g[2]});}
   else if(g[3]!==undefined){re+='<(\\d+)>';groups.push({open:+g[3]});}
   else if(g[4]!==undefined){re+='</(\\d+)>';groups.push({close:+g[4]});}
   else {re+='<(\\d+)/>';groups.push({void:+g[5]});}
  });
  re+='$';
  /* need: the longest piece of plain text the template has - a key without it cannot match, so no regex is run */
  const need=key.split(TOK).filter((x,i)=>i%6===0&&x).map(x=>x.trim()).sort((a,b)=>b.length-a.length)[0]||'';
  /* adj: slots side by side with nothing but a space between ("{1} {2}") - their cut is a guess */
  const adj=[...key.matchAll(/\{(\d+)\}( ?)(?=\{(\d+)\})/g)].map(x=>[+x[1],+x[3],x[2]]);
  return {re:new RegExp(re),groups,lit:key.replace(TOK,'').length,need:need.length>=3?need:'',adj};
 }
 /* the bucket a key is filed under: its first two letters after any opening tags ("<0>Hang him..." -> "Ha") */
 const headOf=k=>{const s=k.replace(/^(<\d+\/?>)+/,'');return /^[^{<]{2}/.test(s)?s.slice(0,2):null;};
 function build(){
  const src=DATA[lang];
  dict=new Map();byHead=new Map();loose=[];memo.clear();memoW.clear();memoP.clear();
  cacheT.clear();cacheH.clear();
  if(!src)return;
  const add=(k,v,alias)=>{
   if(alias&&!/[A-Za-z]{2}/.test(k.replace(TOK,'')))return;   /* "Hear ye! {0}" without its cry is "{0}" - a key with no words would match everything */
   if(alias&&/\{\d+\}/.test(k)&&(k.replace(TOK,' ').match(/[A-Za-z]{2,}/g)||[]).length<2&&!/[←-⇿⌀-⏿■-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u.test(k))return;   /* ...and "🎒 {0} left" without its emoji is "{0} left", which would catch any line ending in "left" ("🏹 {0} archer{1}" keeps an emoji to hold on to) */
   if(!/\{\d+\}/.test(k)){if(!alias||!dict.has(k))dict.set(k,v);return;}
   const t=compile(k);t.key=k;t.tr=v;
   const h=headOf(k);
   if(h){if(!byHead.has(h))byHead.set(h,[]);byHead.get(h).push(t);}
   else loose.push(t);
  };
  /* the crier's translated cry ("Hear ye! {0}" says what that is), for lines shown without it */
  const cry=src['Hear ye! {0}'],pre=cry?cry.replace('{0}','').trim():'';
  for(const k in src){
   const v=src[k];if(typeof v!=='string'||!v)continue;
   add(k,v);
   /* a unit written with an emoji in front ("🔓 {0} served the term...") is found without it too, the way the ledger
      shows its lines; and the Notices table drops the crier's "Hear ye! " (l.replace(/^Hear ye! /,'')) */
   const m=LEAD.exec(k);
   if(m){const at=v.indexOf(m[1]),kk=k.slice(m[0].length);if(kk&&at>=0)add(kk,(v.slice(0,at)+v.slice(at+m[1].length)).replace(/ {2,}/g,' ').trim(),true);}
   if(k.startsWith('Hear ye! '))add(k.slice(9),pre&&v.startsWith(pre)?v.slice(pre.length).trim():v,true);
   /* a "· "-led unit ("· 🏹 {0} archer{1}") is found without its dot too: a list whose dot a template already took */
   if(k.startsWith('· ')&&v.startsWith('· '))add(k.slice(2),v.slice(2),true);
  }
  for(const l of byHead.values())l.sort((a,b)=>b.lit-a.lit);
  loose.sort((a,b)=>b.lit-a.lit);
  /* the skill tree writes its numbers as # ("+#% max health") and fills them in before showing: found with numbers too */
  for(const [k,v] of [...dict]){const a=hashAlias(k,v);if(a&&!dict.has(a[0]))dict.set(a[0],a[1]);}
 }
 function tagsBalanced(v){
  if(!/<\/?\d+>/.test(v))return true;
  const st=[];
  for(const m of v.matchAll(/<(\/?)(\d+)>/g)){
   if(!m[1])st.push(m[2]);
   else if(st.pop()!==m[2])return false;
  }
  return st.length===0;
 }
 function hashAlias(k,v){
  const re=/\{#(\d+)\}|#(?!\{)/g;
  if(!/#(?!\{|\d)/.test(k.replace(/\{#\d+\}/g,'')))return null;
  let i=0;const old={},bare=[];
  const kk=k.replace(re,(m,n)=>{const j=i++;if(n!==undefined)old[n]=j;else bare.push(j);return '{#'+j+'}';});
  let b=0,bad=false;
  const vv=v.replace(re,(m,n)=>{if(n!==undefined){if(old[n]===undefined){bad=true;return m;}return '{#'+old[n]+'}';}if(b>=bare.length){bad=true;return m;}return '{#'+bare[b++]+'}';});
  return bad||b!==bare.length?null:[kk,vv];
 }
 const LEAD=/^((?:[←-⇿⌀-⏿■-➿⬀-⯿️‍]|[\u{1F000}-\u{1FAFF}])+)\s+/u;
 /* a key -> its translation (still with {#i} and <k> marks, in the key's own numbering), or null */
 /* every key looked up remembers its answer: a long list of names is cut many ways, and each cut asks the same questions */
 const memo=new Map();
 function trKey(key,depth){
  if(!dict)return null;
  const hit=dict.get(key);
  if(hit!==undefined)return hit;
  const mk=inValueWhole?'G'+key:key,mm=memo.get(mk);   /* (an answer worked out with the value paths shut is not the open answer) */
  if(mm!==undefined)return mm;
  if(depth>3)return null;
  const r=trKeyMatch(key,depth);
  if(r!==null||depth===0){if(memo.size>40000)memo.clear();memo.set(mk,r);}
  return r;
 }
 function trKeyMatch(key,depth){
  const hk=headOf(key),cands=((hk&&byHead.get(hk))||[]).concat(loose);
  for(const t of cands){
   if(t.need&&key.indexOf(t.need)<0)continue;
   const m=t.re.exec(key);if(!m)continue;
   const slots={},nums={},tags={};let bad=false;
   t.groups.forEach((g,i)=>{const v=m[i+1];
    if(g.slot!==undefined){
     if(g.suffix&&v&&/^[A-Za-z]/.test(v)&&!/^(?:e?s|ies)$/i.test(v)&&!dict.has(v.trim()))bad=true;   /* a glued slot that caught words ("close{1}" eating "s left") is the wrong template - unless they are one of the source's own choices ("s are") */
     slots[g.slot]=g.suffix&&/^(?:e?s|ies)$/i.test(v||'')?'':v;   /* ...which no other language wants: "8 次结算s" */
    }
    else if(g.num!==undefined)nums[g.num]=v;
    else{const k=g.open!==undefined?g.open:g.close!==undefined?g.close:g.void;if(tags[k]!==undefined&&tags[k]!==v)bad=true;tags[k]=v;}
   });
   if(bad)continue;
   /* a slot that swallowed a sentence nobody can translate means this template is the wrong one ("<0>{0}</0><1>{1}
      damage.</1>" eating "Balanced. Take 8% less"): try the next, or let the pieces translate themselves */
   const tv={};
   for(const k in slots){const v=slots[k];if(v===undefined)continue;
    if(!tagsBalanced(v)){bad=true;break;}   /* a value never opens a tag it does not close: "{0} damage{1}" swallowing "<0>Human</0><1>Balanced..." */
    tv[k]=trValue(v,depth+1);}
   if(bad)continue;
   /* two values side by side ("{1} {2} ◉ a close" from (owned?'pays':'pays now')+' '+gold): where the cut between them
      left either one English ("pays" | "now 0"), the two together ("pays now 0") */
   for(const [a,b,sp] of t.adj){
    const va=slots[a],vb=slots[b];if(va===undefined||vb===undefined)continue;
    if(!(tv[a]===va&&C.wordy(va))&&!(tv[b]===vb&&C.wordy(vb)))continue;
    const j=va+sp+vb,tj=trValue(j,depth+1);
    if(tj!==j){tv[a]=tj;tv[b]='';}
   }
   for(const k in slots){const v=slots[k];if(v===undefined)continue;
    /* ...and a weak template (a word or two around its slots) that left words of a sentence untranslated is the wrong
       one too - but a strong one ("Still standing: {0}.") keeps its value: a list of names is not a sentence */
    const same=tv[k]===v&&C.wordy(v),left=same&&/(^|[^A-Za-z])[a-z]{2,}/.test(v.replace(/<\/?\d+\/?>|\{#\d+\}/g,' '));   /* (an English small word left over - "up" in "{0} close{1}" - not a name) */
    if(left&&t.lit<12)bad=true;
    /* and so is one whose slot swallowed its own " · " list untranslated ("· mood +{1} · draw" eating "6 · 40 men · trade ×1.1") */
    if(same&&/\S\s+·\s+\S/.test(v)&&t.key.indexOf('·')>=0)bad=true;}   /* (inside it: "🎩 Duke Bjorn · " only ends on one) */
   if(bad)continue;
   return t.tr.replace(TOK,(all,s,n,o,c,vd)=>
    s!==undefined?(tv[s]!==undefined?tv[s]:''):
    n!==undefined?(nums[n]!==undefined?'{#'+nums[n]+'}':''):
    o!==undefined?'<'+(tags[o]!==undefined?tags[o]:o)+'>':
    c!==undefined?'</'+(tags[c]!==undefined?tags[c]:c)+'>':
    '<'+(tags[vd]!==undefined?tags[vd]:vd)+'/>');
  }
  return null;
 }
 /* a slot's captured text: translated on its own, its marks renumbered to its own and back */
 let inValueWhole=false;
 function trValue(v,depth){
  if(!C.wordy(v))return v;
  /* " and court fines": the space round a value belongs to the sentence, not to the unit */
  const lead=/^\s*/.exec(v)[0],trail=/\s*$/.exec(v)[0];
  if(lead||trail){const t=trValue(v.slice(lead.length,v.length-trail.length),depth);return lead+t+trail;}
  const numMap=[],tagMap=[];
  const local=v.replace(/\{#(\d+)\}/g,(a,i)=>{numMap.push(i);return '{#'+(numMap.length-1)+'}';})
               .replace(/<(\/?)(\d+)(\/?)>/g,(a,sl,i,vd)=>{let k=tagMap.indexOf(i);if(k<0){tagMap.push(i);k=tagMap.length-1;}return '<'+sl+k+vd+'>';});
  let t=trKey(local,depth);
  /* values the source glues on one after another, each with its own ", " (", 1 200 sacks of grain in a hired barn, 5
     councillors in your debt" in one slot; "The New Quarter, Watchtowers"): item by item, with its comma or without */
  if(t==null&&depth<=3&&/,\s/.test(local)){
   const parts=local.split(/(,\s+)/);
   if(parts.length>=3&&parts.length<=17){
    let o='',ok=true,any=false;
    for(let i=0;i<parts.length&&ok;i+=2){
     const item=parts[i],sep=i?parts[i-1]:'';
     if(!C.wordy(item)){o+=sep+item;continue;}
     let r=sep?trValue(sep+item,depth+1):null;
     if(r!=null&&r!==sep+item){o+=r;any=true;continue;}
     r=trValue(item,depth+1);
     if(r!==item){o+=sep+r;any=true;}else ok=false;
    }
    if(ok&&any)t=o;
   }
  }
  if(t==null){
   /* a value with tags in it: its pieces one at a time */
   if(/<\d+>/.test(local)){
    t=local.replace(/(<(\d+)>)([^<]*)(<\/\2>)|([^<]+)/g,(a,o,k,inner,c,plain)=>
      plain!==undefined?(C.wordy(plain)?(trKey(plain.trim(),depth+1)!=null?a.replace(plain.trim(),trKey(plain.trim(),depth+1)):a):a)
      :o+(C.wordy(inner)&&trKey(inner.trim(),depth+1)!=null?inner.replace(inner.trim(),trKey(inner.trim(),depth+1)):inner)+c);
   }else{
    /* "your books A": two values the source glued side by side ("grades {1}{2}") land in one slot - the longest unit at
       its start, then the rest on its own */
    const w=local.split(' ');
    for(let k=w.length<=8&&depth<=2?w.length-1:0;k>=1&&t==null;k--){   /* (a short value only: a list of names is not two glued values) */
     const th=trKey(w.slice(0,k).join(' '),depth+1);if(th==null)continue;
     const tail=w.slice(k).join(' '),tt=C.wordy(tail)?trKey(tail,depth+1):tail;if(tt==null)continue;
     t=th+' '+tt;
    }
    /* a plain value the game reshaped ("sought after", "“a line”", "SHOUTED"): whole() knows those forms */
    if(t==null&&!inValueWhole&&!/\{#\d+\}|<\/?\d+\/?>/.test(local)){
     inValueWhole=true;let w=null;try{w=whole(local,0,true);}finally{inValueWhole=false;}   /* once: whole() may meet templates that come back here */
     if(w!=null)return w;
    }
    /* a value with numbers in it ("· 🏹 3 archers · 🔥 40 to burn"): its pieces, the numbers held by stand-ins meanwhile */
    if(t==null&&!inValueWhole&&/\{#\d+\}/.test(local)&&!/<\/?\d+\/?>/.test(local)){
     const ph=[],txt=local.replace(/\{#(\d+)\}/g,(a,i)=>{const s=String(90017+ph.length*1000);ph.push([s,i]);return s;});
     inValueWhole=true;let w=null;try{w=pieces(txt);}finally{inValueWhole=false;}
     if(w!=null&&ph.every(([s])=>w.split(s).length===2)){for(const [s,i] of ph)w=w.replace(s,'{#'+i+'}');t=w;}
    }
    if(t==null)return v;
   }
  }
  return t.replace(/\{#(\d+)\}/g,(a,i)=>'{#'+(numMap[+i]!==undefined?numMap[+i]:i)+'}')
          .replace(/<(\/?)(\d+)(\/?)>/g,(a,sl,i,vd)=>'<'+sl+(tagMap[+i]!==undefined?tagMap[+i]:i)+vd+'>');
 }
 /* a number the source wrote out English-style ("500,000◉") reads as five hundred in German: grouped the way the game's
    other numbers are (toLocaleString), the player's own system's way */
 const num=s=>/^\d{1,3}(?:,\d{3})+$/.test(s)?Number(s.replace(/,/g,'')).toLocaleString():s;
 const fill=(t,nums)=>t.replace(/\{#(\d+)\}/g,(a,i)=>nums[+i]!==undefined?num(nums[+i]):'').replace(/ {2,}/g,' ');

 /* ---- plain text ---- */
 const cacheT=new Map(),cacheH=new Map();
 const QUICK=/^[\s\d.,:;%+\-−×x/()\[\]#◉·•|←→↑↓▴▾✕✓✔⚔★☆♥❤⏳⌛…]*$/;
 const produced=new Set();   /* what this layer wrote: code that reads its own text back and sets it again is not translated twice */
 function trText(s){
  if(lang==='en'||typeof s!=='string'||!s)return s;
  PROF.text++;
  let r=cacheT.get(s);if(r!==undefined)return r;
  if(QUICK.test(s)||produced.has(s))return s;
  const t0=now();PROF.textMiss++;
  r=s;
  if(C.hasWords(s)){
   const c=C.canon(s);
   const t=trKey(c.key,0);
   if(t!=null&&!/<\d+\/?>/.test(t)){r=c.lead+fill(t,c.nums).trim()+c.trail;I18N.stats.hit++;}
   else{
    const g=pieces(s);
    if(g!=null){r=g;I18N.stats.hit++;}
    else if(C.wordy(c.key)){I18N.missing.add(c.key);I18N.stats.miss++;}
   }
  }
  if(cacheT.size>30000){cacheT.clear();produced.clear();}
  cacheT.set(s,r);if(r!==s)produced.add(r);
  PROF.textMs+=now()-t0;
  return r;
 }
 /* the last resort for text the source built from several pieces ("Warrior ⚔️🌀📯", "→ Thornwood Glade", "Heroic Strike 3",
    "Bjorn - Human Warrior · Prestige 10"): cut at symbols, dashes, dots and numbers, and translate every piece that is a
    unit of its own; a piece of two to four words that are each a unit ("Human Warrior") goes word by word */
 const SEP=/((?<=[.!?…])\s+|\s+\+\s+|\s*×\s*|\s+[IVX]{1,4}(?=\s|$)|\s*[·•|—–→←↑↓]\s*|\s+-\s+|,\s+|\s*[←-⇿⌀-⏿■-➿⬀-⯿️‍\u{1F000}-\u{1FAFF}]+\s*|\s*[+\-−]?\d+(?:[.,  ]\d+)*%?\s*|\s*[()[\]]|:\s+)/u;
 const MAJOR=/(?<=[.!?…;:])(?=\s)|(?=\s+[·\-–—]\s)/;
 /* one stretch of such a line that is no unit as it stands: without the dot or dash it starts with ("- Human Warrior"),
    else cut further (pieces lists what it could not do) */
 function alone(core){
  const m=/^([·\-–—]\s+)([\s\S]+)$/.exec(core);
  if(m){const w=whole(m[2])??byWords(m[2])??pieces(m[2]);return w==null?null:m[1]+w;}
  return pieces(core);
 }
 /* Chinese closes a translated stretch with its own marks: "攻击：" not "攻击:" */
 const ZHP={'.':'。','!':'！','?':'？',':':'：',';':'；',',':'，'};
 const endMarks=(t,p)=>lang==='zh'&&/[㐀-鿿]$/.test(t)&&/^[.!?:;,]+$/.test(p.trim())?p.trim().replace(/[.!?:;,]/g,x=>ZHP[x]):p;
 const plainT=t=>t!=null&&!/<\d+\/?>/.test(t);
 /* one piece as a unit of its own - forgiving its end punctuation, the quotes round a spoken line, and SHOUTING */
 /* a glued line is cut many ways, and every cut asks for the same stretches again: whole() and pieces() remember their
    answers (per guard state - a value's own pieces are worked out with the deeper value paths shut) */
 const memoW=new Map(),memoP=new Map();
 const remember=(m,k,f)=>{let r=m.get(k);if(r!==undefined)return r;r=f();if(m.size>20000)m.clear();m.set(k,r);return r;};
 function whole(p,depth=0,lower=false){
  return depth?wholeRaw(p,depth,lower):remember(memoW,(lower?'L':'l')+(inValueWhole?'G':'g')+p,()=>wholeRaw(p,0,lower));
 }
 function wholeRaw(p,depth,lower){   /* lower: a whole value may be a name the game lower-cased; a piece of a sentence may not */
  const c=C.canon(p);if(!C.wordy(c.key))return null;
  const t=trKey(c.key,0);
  if(plainT(t))return c.lead+fill(t,c.nums).trim()+c.trail;
  if(depth>1)return null;
  let m=/^(\s*[“"‘«]\s*)([\s\S]+?)(\s*[”"’»]\s*)$/.exec(p);
  if(m){const w=whole(m[2],depth+1);if(w!=null)return m[1]+w+m[3];}
  m=/^([\s\S]*?[^\s.!?…:;,])(\s*[.!?…:;,]+\s*)$/.exec(p);
  if(m){const w=whole(m[1],depth+1);if(w!=null)return w+endMarks(w,m[2]);}
  /* a name the game lower-cases mid-sentence ("the city is sought after" from 'Sought after'): its capitalised unit,
     brought down again - its first letter only: those names are adjectives ("begehrt", "im Aufruhr", "das Juwel des Reiches") */
  if(lower&&/^[a-z]/.test(p.trim())&&p===p.toLowerCase()){
   const c2=C.canon(p.trim()[0].toUpperCase()+p.trim().slice(1)),tt=trKey(c2.key,0);
   if(plainT(tt)){const r=fill(tt,c2.nums).trim();return c.lead+(!r?r:r[0].toLocaleLowerCase(HTML_LANG)+r.slice(1))+c.trail;}
  }
  if(/[A-Z]{3}/.test(p)&&p===p.toUpperCase()){
   const low=p.toLowerCase();
   for(const v of [low,low.replace(/(^|\s)(\S)/g,(a,b,x)=>b+x.toUpperCase()),p[0]+low.slice(1)]){
    const k=C.canon(v),tt=trKey(k.key,0);
    if(plainT(tt))return (k.lead+fill(tt,k.nums).trim()+k.trail).toLocaleUpperCase(HTML_LANG);
   }
  }
  return null;
 }
 function pieces(s){return remember(memoP,(inValueWhole?'G':'g')+s,()=>piecesRaw(s));}
 function piecesRaw(s){
  if(!dict)return null;
  const w0=whole(s,0,true);if(w0!=null)return w0;
  /* "👑 A petitioner. My Hand deals with petitioners...": the emoji in front is the screen's, not the unit's */
  const lm=/^((?:[←-⇿⌀-⏿■-➿⬀-⯿️‍]|[\u{1F000}-\u{1FAFF}])+\s*)([\s\S]+)$/u.exec(s);
  if(lm&&C.wordy(C.canon(lm[2]).key)){const w=whole(lm[2],0,true);if(w!=null)return lm[1]+w;}   /* (a whole unit only: "🏹 3 archers · ..." is a list, cut below) */
  /* a line the source strings together from whole units - sentences, a label's ": ", "; " and " · " lists, " - " asides
     ("Attack: Hybrid Strike. A reliable strike. Reduces power cooldown by one turn.", "1.2M ◉ · mood +6 · 40 men"):
     from each place the longest run that is a unit ("· {0} men" keeps its dot), and what is none cut further on its own */
  const segs=s.split(MAJOR);
  if(segs.length>1&&segs.length<=24){
   let o='',ch=false;
   for(let i=0;i<segs.length;){
    let done=false;
    for(let j=Math.min(segs.length-1,i+4);j>=i&&!done;j--){
     const txt=segs.slice(i,j+1).join(''),lead=/^\s*/.exec(txt)[0],core=txt.slice(lead.length);
     if(!C.wordy(C.canon(core).key)){if(j===i){o+=txt;i++;done=true;}continue;}
     let w=whole(core);
     if(w==null){const m=/^([·\-–—]\s+)([\s\S]+)$/.exec(core);if(m){const t=whole(m[2]);if(t!=null)w=m[1]+t;}}   /* "· a devoted council - favour 75+ (it is 71)": the list's dot is not the unit's */
     if(w==null&&j===i)w=alone(core);
     if(w!=null){o+=(lang==='zh'&&/[　-〿＀-￯]$/.test(o)?'':lead)+w;ch=true;i=j+1;done=true;}   /* (no space after "。") */
    }
    if(!done){o+=segs[i];i++;}
   }
   if(ch)return o;
  }
  const parts=s.split(SEP);
  if(parts.length<3)return byWords(s);
  const side=x=>{   /* a side with no words in it stays as it is; one with words sheds the separator's ": " first */
   if(!x.trim()||!C.wordy(C.canon(x).key))return x;
   const t0=whole(x);if(t0!=null)return t0;   /* "· {0} ◉ left on the line" is a unit with its dot */
   const m=/^([\s:;,·•|—–\-←-⇿⌀-⏿■-➿⬀-⯿️‍\u{1F000}-\u{1FAFF}]*)([\s\S]*?)([\s:;,·•|—–-]*)$/u.exec(x);   /* "🎩 Duke Bjorn": the emoji in front stays, the words go through */
   if(!m[2])return x;
   const t=whole(m[2])??byWords(m[2]);
   return t==null?null:m[1]+t+m[3];
  };   /* a side with no words in it stays as it is */
  /* two halves at a separator: "First build: Parish Schoolhouse." - "Borrow · 1,000 ◉ left on the line" */
  for(let k=1;k<parts.length;k+=2){
   const L=parts.slice(0,k).join(''),sep=parts[k],R=parts.slice(k+1).join('');
   for(const [a,b] of [[L+sep,R],[L,sep+R]]){
    const ta=side(a);if(ta==null)continue;
    const tb=side(b);if(tb==null)continue;
    if(ta===a&&tb===b)continue;
    return ta+tb;
   }
  }
  /* else piece by piece - a piece may take the colon after it ("First build" + ":") */
  let changed=false,out='';
  for(let i=0;i<parts.length;i++){
   const p=parts[i];
   if(i%2||!p||!C.wordy(p)){out+=p;continue;}
   let w=whole(p);
   if(w==null&&i+1<parts.length&&/^\s*[:;]\s*$/.test(parts[i+1])){
    const sep=parts[i+1],w2=whole(p+sep.trim());
    if(w2!=null){out+=w2+sep.slice(sep.trimEnd().length);i++;changed=true;continue;}
   }
   if(w==null)w=byWords(p);
   if(w!=null){changed=true;out+=w;}else{out+=p;const k=C.canon(p).key;if(C.wordy(k)&&!inValueWhole)I18N.missing.add(k);}   /* a piece left English is listed too (not one of a value's trial cuts) */
  }
  return changed?out:null;
 }
 function byWords(p){
  const core=p.trim(),m=/^([\s\S]*?)([.!?…:;,]*)$/.exec(core),words=m[1].split(/\s+/);   /* "Rare Emberbite:" keeps its colon */
  if(words.length<2||words.length>4||!words.every(w=>/^[A-Z]/.test(w)))return null;   /* names and titles ("Human Warrior"), never a run of small words */
  const tr=words.map(w=>dict.get(w));
  if(tr.some(x=>x===undefined))return null;
  return p.replace(core,tr.join(lang==='zh'?'':' ')+m[2]);
 }

 /* ---- the DOM ---- */
 const D={isText:n=>n.nodeType===3,text:n=>n.data,tag:n=>n.localName||'',
  kids:n=>{const o=[];for(const k of n.childNodes)if(k.nodeType===1||k.nodeType===3)o.push(k);return o;},
  attr:(n,a)=>n.getAttribute?n.getAttribute(a):null};
 let orig={};   /* the browser's own setters, kept before they are wrapped */
 const mkText=s=>orig.createTextNode.call(document,s);
 const setText=(el,s)=>orig.textContent.set.call(el,s);
 /* data-i18n="ctx": a word with two meanings looked up in its context first ("outfit|Worn"), then as itself */
 const ctxKey=(ctx,key)=>ctx&&dict?dict.get(ctx+C.CTX_SEP+key)??null:null;   /* the word itself only: a template would take "controls|" for a name */
 function trCtx(s,ctx){
  if(!ctx||lang==='en'||typeof s!=='string')return trText(s);
  const c=C.canon(s),t=ctxKey(ctx,c.key);
  return plainT(t)?c.lead+fill(t,c.nums).trim()+c.trail:trText(s);
 }
 const ctxOf=el=>{const e=el&&(el.nodeType===1?el:el.parentNode);const h=e&&e.closest&&e.closest('[data-i18n]');return h?h.getAttribute('data-i18n'):'';};
 function attrs(n,ctx){
  if(!n.getAttribute)return;
  for(const a of C.ATTRS){const v=n.getAttribute(a);if(v&&C.hasWords(v)){const t=trCtx(v,ctx);if(t!==v)orig.setAttribute.call(n,a,t);}}
 }
 function walk(n,ctx){
  if(n.nodeType===1){
   if(C.SKIP.has(n.localName)){if(n.localName==='canvas')attrs(n,ctx);return;}   /* a canvas's label is words, its inside pixels */
   if(n.getAttribute('translate')==='no')return;
   ctx=n.getAttribute('data-i18n')||ctx;
   attrs(n,ctx);
  }
  const kids=D.kids(n);
  if((n.nodeType===1||n.nodeType===11)&&C.rich(n,D)){
   const one=C.lone(kids,D);
   if(one){walk(one,ctx);return;}
   for(const c of kids)if(c.nodeType===1)attrs(c,ctx);
   rich(n,kids,ctx);
   return;
  }
  for(const c of kids){
   if(c.nodeType===3){if(C.hasWords(c.data)){const t=trCtx(c.data,ctx);if(t!==c.data)c.data=t;}}
   else walk(c,ctx);
  }
 }
 /* one unit of text and inline tags: translate it whole, then lay the same inline elements out in the new order */
 function rich(n,kids,ctx){
  const raw=C.rawOf(kids,D),c=C.canon(raw);
  if(!kids.some(k=>k.nodeType===1)){   /* text only */
   const t=ctxKey(ctx,c.key)??trKey(c.key,0);
   if(t==null){perChild(kids,ctx);return;}   /* each text on its own, with the last-resort pieces */
   I18N.stats.hit++;
   const s=c.lead+fill(t,c.nums).trim()+c.trail;
   if(kids.length===1)kids[0].data=s;else n.replaceChildren(mkText(s));
   return;
  }
  const t=ctxKey(ctx,c.key)??trKey(c.key,0);
  if(t==null){perChild(kids,ctx);return;}   /* a sentence with tags nobody wrote as one: its pieces, each one its own unit */
  const out=fill(t,c.nums).trim();
  const inl=kids.filter(k=>k.nodeType===1);
  const parts=[],used=new Set();let cur=-1,curText='',okay=true;
  const re=/<(\d+)>|<\/(\d+)>|<(\d+)\/>|[^<]+|</g;let m;
  while((m=re.exec(out))){
   if(m[1]!==undefined){if(cur>=0||used.has(+m[1])||!inl[+m[1]]){okay=false;break;}cur=+m[1];curText='';}
   else if(m[2]!==undefined){if(cur!==+m[2]){okay=false;break;}used.add(cur);parts.push({el:inl[cur],text:curText});cur=-1;}
   else if(m[3]!==undefined){if(used.has(+m[3])||!inl[+m[3]]){okay=false;break;}used.add(+m[3]);parts.push({el:inl[+m[3]]});}
   else if(cur>=0)curText+=m[0];
   else parts.push({text:m[0]});
  }
  if(!okay||cur>=0||used.size!==inl.length){perChild(kids,ctx);return;}
  I18N.stats.hit++;
  if(c.lead)parts.unshift({text:c.lead});
  if(c.trail)parts.push({text:c.trail});
  const nodes=parts.map(p=>{
   if(!p.el)return mkText(p.text);
   if(p.text!==undefined&&!C.VOID.has(p.el.localName)&&p.el.textContent!==p.text)setText(p.el,p.text);
   return p.el;
  });
  n.replaceChildren(...nodes);
 }
 function perChild(kids,ctx){
  for(const k of kids){
   if(k.nodeType===3){if(C.hasWords(k.data)){const t=trCtx(k.data,ctx);if(t!==k.data)k.data=t;}}
   else walk(k,ctx);
  }
 }
 let tplEl=null;
 function trHTML(html,ctx){
  if(lang==='en'||typeof html!=='string'||!html)return html;
  PROF.html++;
  const ck=ctx?ctx+'\u0001'+html:html;
  let r=cacheH.get(ck);if(r!==undefined)return r;
  const t0=now();PROF.htmlMiss++;PROF.htmlChars+=html.length;
  if(!C.hasWords(html.replace(/<[^>]*>/g,''))&&!/\b(?:title|alt|aria-label|placeholder)\s*=\s*["'][^"']*[A-Za-z]/.test(html))r=html;   /* an icon with a title still has words */
  else{
   if(!tplEl)tplEl=document.createElement('template');
   orig.innerHTML.set.call(tplEl,html);
   walk(tplEl.content,ctx);
   r=orig.innerHTML.get.call(tplEl);
  }
  if(cacheH.size>4000)cacheH.clear();
  cacheH.set(ck,r);
  {const ms=now()-t0;PROF.htmlMs+=ms;if(ms>8&&PROF.slow.length<12)PROF.slow.push({ms:Math.round(ms),len:html.length,head:html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,70)});}
  return r;
 }
 const quietEl=el=>{const t=el&&el.nodeName;return t==='STYLE'||t==='SCRIPT'||t==='TEXTAREA'||!!(el&&el.closest&&el.closest('[translate="no"]'));};

 /* ---- wrap the browser's own text doors, once; English walks straight through them ---- */
 function wrap(){
  const P=(o,k)=>Object.getOwnPropertyDescriptor(o,k);
  orig.innerHTML=P(Element.prototype,'innerHTML');
  orig.textContent=P(Node.prototype,'textContent');
  orig.createTextNode=Document.prototype.createTextNode;
  orig.setAttribute=Element.prototype.setAttribute;
  orig.insertAdjacentHTML=Element.prototype.insertAdjacentHTML;
  orig.title=P(HTMLElement.prototype,'title');
  orig.placeholder=P(HTMLInputElement.prototype,'placeholder');
  if(lang==='en')return;   /* nothing to translate: leave the doors as the browser made them */
  Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,enumerable:orig.innerHTML.enumerable,get:orig.innerHTML.get,
   set(v){orig.innerHTML.set.call(this,typeof v==='string'&&!quietEl(this)?trHTML(v,ctxOf(this)):v);}});
  Object.defineProperty(Node.prototype,'textContent',{configurable:true,enumerable:orig.textContent.enumerable,get:orig.textContent.get,
   set(v){orig.textContent.set.call(this,typeof v==='string'&&!(this.nodeType===1&&quietEl(this))&&!(this.parentNode&&quietEl(this.parentNode))?trCtx(v,ctxOf(this)):v);}});
  Document.prototype.createTextNode=function(s){return orig.createTextNode.call(this,trText(String(s)));};
  Element.prototype.setAttribute=function(a,v){
   if(typeof v==='string'&&(a==='title'||a==='placeholder'||a==='aria-label'||a==='alt')&&!quietEl(this))v=trText(v);
   return orig.setAttribute.call(this,a,v);
  };
  Element.prototype.insertAdjacentHTML=function(pos,html){return orig.insertAdjacentHTML.call(this,pos,quietEl(this)?html:trHTML(html,ctxOf(pos==='beforebegin'||pos==='afterend'?this.parentNode:this)));};
  if(orig.title)Object.defineProperty(HTMLElement.prototype,'title',{configurable:true,enumerable:orig.title.enumerable,get:orig.title.get,set(v){orig.title.set.call(this,trText(v));}});
  if(orig.placeholder)Object.defineProperty(HTMLInputElement.prototype,'placeholder',{configurable:true,enumerable:orig.placeholder.enumerable,get:orig.placeholder.get,set(v){orig.placeholder.set.call(this,trText(v));}});
  for(const k of ['alert','confirm','prompt']){const f=window[k];if(typeof f==='function')window[k]=function(msg,...a){return f.call(window,trText(String(msg==null?'':msg)),...a);};}
  /* canvas: the browser's 2D context (GL2D asks I18N.text itself, see gl2d.js) */
  const X=CanvasRenderingContext2D.prototype;
  for(const k of ['fillText','strokeText','measureText']){const f=X[k];X[k]=function(t,...a){return f.call(this,skipCtx.has(this)?t:trText(String(t)),...a);};}
 }
 const skipCtx=new WeakSet();
 I18N.skip=ctx=>{if(ctx)skipCtx.add(ctx);};   /* GL2D's own text canvas: what reaches it is already translated */

 /* ---- start: load the language file before the page is built, then translate the page as it stands ---- */
 const info=LANGS.find(l=>l.id===lang);
 try{document.documentElement.lang=(info&&info.html)||lang;}catch(e){}
 wrap();
 /* the page's own words are translated by I18N.page(), called from index.html right after the last of them and before
    the game's scripts run - so they are walked once, as written, and never a second time over their own translation */
 let paged=false;
 I18N.page=()=>{
  if(paged||lang==='en')return;paged=true;
  if(!dict)build();
  try{walk(document.body);}catch(e){console.error('i18n',e);}
  document.documentElement.classList.remove('i18n-wait');
 };
 if(lang!=='en'){
  document.documentElement.classList.add('i18n-wait');
  document.write('<style id="i18nWait">html.i18n-wait body{visibility:hidden}</style>');
  document.write('<script src="assets/i18n/'+lang+'.js?v='+VER+'"><\/script>');
  document.addEventListener('DOMContentLoaded',()=>I18N.page(),{once:true});   /* a safety net only */
 }
})();
