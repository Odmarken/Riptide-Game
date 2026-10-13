/* 🌍 The pseudo-language "xx": every unit in brackets, so a screenshot shows at once what the translation layer reaches
   (bracketed) and what it does not (plain English). Run: node tools/i18n/pseudo.cjs  ->  assets/i18n/xx.js */
const fs=require('fs'),path=require('path');
const list=require('./strings.json');
const out={};
for(const u of list)out[u.key]='⟦'+u.key+'⟧';
fs.writeFileSync(path.join(__dirname,'../../assets/i18n/xx.js'),'I18N.data("xx",'+JSON.stringify(out)+');\n');
console.log('xx units',list.length);
