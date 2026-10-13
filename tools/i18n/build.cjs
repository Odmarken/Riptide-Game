/* 🌍 Builds the game's language files from the translators' work: tools/i18n/tr/<lang>/*.json  ->  assets/i18n/<lang>.js,
   keeping only units the game has (strings.json) whose marks check out. Prints each language's coverage.
   node tools/i18n/build.cjs [lang ...]   (default: every language with a tr/ folder) */
const fs=require('fs'),path=require('path');
const list=require('./strings.json'),keys=new Set(list.map(u=>u.key));
const TR=path.join(__dirname,'tr');
const marks=s=>(s.match(/\{\d+\}|\{#\d+\}|<\d+>|<\/\d+>|<\d+\/>/g)||[]).sort().join(' ');
const langs=process.argv.slice(2).length?process.argv.slice(2):(fs.existsSync(TR)?fs.readdirSync(TR).filter(d=>fs.statSync(path.join(TR,d)).isDirectory()):[]);
for(const lang of langs){
 const dir=path.join(TR,lang),out={},all={};let bad=0,stray=0;
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
  const part=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  for(const [k,v] of Object.entries(part)){
   if(typeof v==='string'&&v.trim()&&marks(k)===marks(v))all[k]=v;   /* every translation, for the contexts below */
   if(!keys.has(k)){stray++;continue;}
   if(typeof v!=='string'||!v.trim()||marks(k)!==marks(v)){bad++;continue;}
   out[k]=v;
  }
 }
 /* a word given a context ("ledger|Treasury") reads as the word itself unless its context says otherwise (context.json) */
 for(const k of keys){const m=/^[a-z]+\|([\s\S]*)$/.exec(k);if(m&&out[k]===undefined&&all[m[1]]!==undefined)out[k]=all[m[1]];}
 const sorted={};for(const k of Object.keys(out).sort())sorted[k]=out[k];
 fs.writeFileSync(path.join(__dirname,'../../assets/i18n',lang+'.js'),'/* '+lang+': built by tools/i18n/build.cjs from tools/i18n/tr/'+lang+' - edit those, not this */\nI18N.data('+JSON.stringify(lang)+','+JSON.stringify(sorted)+');\n');
 console.log(lang,'units',Object.keys(sorted).length+'/'+keys.size,'('+(100*Object.keys(sorted).length/keys.size).toFixed(1)+'%)','bad marks',bad,'no longer in the game',stray);
}
