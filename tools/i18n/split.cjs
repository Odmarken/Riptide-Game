/* 🌍 Cuts strings.json into translation work: tools/i18n/work/terms.json (short names and labels - translated first, they
   become every language's glossary) and work/chunk-NN.json (the rest, in source order so neighbouring lines travel
   together, ~2,000 words each). With a language id, only what that language has not translated yet:
   node tools/i18n/split.cjs            all units
   node tools/i18n/split.cjs de         only the units tools/i18n/tr/de/*.json lacks  ->  work/de-delta-NN.json
   node tools/i18n/split.cjs de r2      the same, named work/de-r2-NN.json (use a new round name each time) */
const fs=require('fs'),path=require('path');
const W=path.join(__dirname,'work');fs.mkdirSync(W,{recursive:true});
const list=require('./strings.json');
const lang=process.argv[2],round=process.argv[3]||'delta';   /* a later round gets its own name (de r2), so it never writes over files already translated */
const words=k=>k.replace(/<\/?\d+\/?>|\{#?\d+\}/g,' ').split(/\s+/).filter(w=>/[A-Za-z]/.test(w)).length;
const order=(a,b)=>{const [fa,la]=a.where[0].split(':'),[fb,lb]=b.where[0].split(':');return fa===fb?(+la||0)-(+lb||0):fa.localeCompare(fb);};
const done=new Set();
if(lang){const d=path.join(__dirname,'tr',lang);if(fs.existsSync(d))for(const f of fs.readdirSync(d))if(f.endsWith('.json'))for(const k of Object.keys(JSON.parse(fs.readFileSync(path.join(d,f),'utf8'))))done.add(k);}
const todo=list.filter(u=>!done.has(u.key));
const isTerm=u=>words(u.key)<=3&&!/\{\d+\}/.test(u.key);
const put=(name,arr)=>{fs.writeFileSync(path.join(W,name),JSON.stringify(arr.map(u=>({key:u.key,where:u.where.slice(0,2)})),null,1)+'\n');};
const chunks=(arr,prefix,size)=>{
 const out=[];let cur=[],n=0;
 for(const u of arr){cur.push(u);n+=words(u.key);if(n>=size){out.push(cur);cur=[];n=0;}}
 if(cur.length)out.push(cur);
 out.forEach((c,i)=>put(prefix+String(i+1).padStart(2,'0')+'.json',c));
 return out.length;
};
if(!lang){
 const terms=todo.filter(isTerm).sort(order),rest=todo.filter(u=>!isTerm(u)).sort(order);
 const nt=chunks(terms,'terms-',1200);   /* ~600 short units a file */
 const n=chunks(rest,'chunk-',2000);
 console.log('terms',terms.length,'in',nt,'files; chunks',n,'units',rest.length);
}else{
 const n=todo.length?chunks(todo.sort(order),lang+'-'+round+'-',2000):0;
 console.log(lang,'to translate',todo.length,'files',n);
}
