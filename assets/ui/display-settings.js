/* Monitor adjustments are device preferences, independent of character saves. */
(function(root){
 'use strict';
 const STORAGE_KEY='riptide.displaySettings',MIN=60,MAX=140;
 function normalize(raw){
  const result={brightness:100,contrast:100};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const key of Object.keys(result)){
   if(typeof raw[key]==='number'&&Number.isFinite(raw[key]))result[key]=Math.round(Math.max(MIN,Math.min(MAX,raw[key])));
  }
  return result;
 }
 function filter(value){
  const {brightness,contrast}=normalize(value);
  return brightness===100&&contrast===100?'none':`brightness(${brightness/100}) contrast(${contrast/100})`;
 }
 function paintRange(input){
  if(!input)return;
  const min=Number(input.min),max=Number(input.max),value=Number(input.value);
  const fraction=max>min?Math.max(0,Math.min(1,(value-min)/(max-min))):0;
  input.style.setProperty('--range-fill',Math.round(fraction*100)+'%');
 }
 function create({doc=root.document,storage}={}){
  let store=storage,value=normalize(null);
  if(store===undefined){try{store=root.localStorage;}catch(_){store=null;}}
  function read(){try{return normalize(JSON.parse(store?.getItem(STORAGE_KEY)||'null'));}catch(_){return normalize(null);}}
  function save(){try{store?.setItem(STORAGE_KEY,JSON.stringify(value));}catch(_){}}
  function sync(){
   /* Filtering the canvases leaves HUD/menu text clear and avoids changing the
      containing block of the fixed Settings dialog. Battle copies raw pixels,
      so its own canvas gets one adjustment, never a second baked-in filter. */
   const effect=filter(value);
   for(const id of ['game','tideArena']){const canvas=doc.getElementById(id);if(canvas)canvas.style.filter=effect;}
   for(const key of ['brightness','contrast']){
    const input=doc.getElementById(key+'Sl'),output=doc.getElementById(key+'N');
    if(input){input.value=value[key];input.setAttribute('aria-valuetext',value[key]+'%');paintRange(input);}
    if(output)output.textContent=value[key];
   }
  }
  function reset(){value=normalize(null);try{store?.removeItem(STORAGE_KEY);}catch(_){}sync();}
  for(const key of ['brightness','contrast']){
   doc.getElementById(key+'Sl')?.addEventListener('input',e=>{
    value=normalize({...value,[key]:Number(e.target.value)});sync();save();
   });
  }
  doc.getElementById('videoReset')?.addEventListener('click',reset);
  root.addEventListener?.('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){value=read();sync();}});
  value=read();sync();
  return {sync,reset,get value(){return {...value};}};
 }
 const api={create,normalize,filter,paintRange,STORAGE_KEY};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.DisplaySettings=api;
})(typeof window!=='undefined'?window:globalThis);
