/* 🌍 Checks a translated chunk against its input: every key there, every {0} {#0} <0> kept exactly once, no stray tags.
   node tools/i18n/check.cjs <input.json> <output.json>   (input: [{key,where}] or {key:...}; output: {key:translation}) */
const fs=require('fs');
const [,,inp,outp]=process.argv;
const rawIn=JSON.parse(fs.readFileSync(inp,'utf8'));
const keys=Array.isArray(rawIn)?rawIn.map(u=>u.key):Object.keys(rawIn);
let out;
try{out=JSON.parse(fs.readFileSync(outp,'utf8'));}catch(e){console.log('NOT VALID JSON: '+e.message);process.exit(1);}
const marks=s=>{
 const m={};for(const x of s.match(/\{\d+\}|\{#\d+\}|<\d+>|<\/\d+>|<\d+\/>/g)||[])m[x]=(m[x]||0)+1;return m;
};
const problems=[];
for(const k of keys){
 if(!(k in out)){problems.push('MISSING  '+JSON.stringify(k));continue;}
 const v=out[k];
 if(typeof v!=='string'||!v.trim()){problems.push('EMPTY    '+JSON.stringify(k));continue;}
 const a=marks(k),b=marks(v);
 const all=new Set([...Object.keys(a),...Object.keys(b)]);
 for(const x of all)if((a[x]||0)!==(b[x]||0))problems.push('MARKS    '+JSON.stringify(k)+' -> '+JSON.stringify(v)+'  ('+x+': '+(a[x]||0)+' in English, '+(b[x]||0)+' in yours)');
 /* tags must still nest: <0> before </0> */
 for(const [,n] of v.matchAll(/<(\d+)>/g)){const o=v.indexOf('<'+n+'>'),c=v.indexOf('</'+n+'>');if(c<o)problems.push('ORDER    '+JSON.stringify(v)+' (<'+n+'> must come before </'+n+'>)');}
 if(/<(?!\/?\d+\/?>)[a-z\/]/i.test(v)&&!/<(?!\/?\d+\/?>)[a-z\/]/i.test(k))problems.push('HTML     '+JSON.stringify(v)+' (do not add tags)');
}
for(const k of Object.keys(out))if(!keys.includes(k))problems.push('EXTRA    '+JSON.stringify(k)+' (not in the input - keys must be copied exactly)');
if(problems.length){console.log(problems.length+' problem(s):\n'+problems.slice(0,80).join('\n'));process.exit(1);}
console.log('OK - '+keys.length+' units');
