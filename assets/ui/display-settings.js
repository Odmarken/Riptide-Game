/* Monitor adjustments are device preferences, independent of character saves. */
(function(root){
 'use strict';
 const STORAGE_KEY='riptide.displaySettings',MIN=60,MAX=140;
 function normalize(raw){
  const result={brightness:100,contrast:100,showFps:true,lighting:true,sunFlare:true,weather:true};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const key of ['brightness','contrast']){
   if(typeof raw[key]==='number'&&Number.isFinite(raw[key]))result[key]=Math.round(Math.max(MIN,Math.min(MAX,raw[key])));
  }
  for(const key of ['showFps','lighting','sunFlare','weather'])if(typeof raw[key]==='boolean')result[key]=raw[key];
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
 function create({doc=root.document,storage,onChange}={}){   /* onChange: told the settings whenever they are applied (the game's sun reads Lighting and Sun flare, its sky Weather) */
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
   const fps=doc.getElementById('fps'),fpsToggle=doc.getElementById('fpsChk');
   if(fps)fps.hidden=!value.showFps;
   if(fpsToggle)fpsToggle.checked=value.showFps;
   const lightToggle=doc.getElementById('lightingChk');
   if(lightToggle)lightToggle.checked=value.lighting;
   const flareToggle=doc.getElementById('sunFlareChk');
   if(flareToggle)flareToggle.checked=value.sunFlare;
   const weatherToggle=doc.getElementById('weatherChk');
   if(weatherToggle)weatherToggle.checked=value.weather;
   for(const key of ['brightness','contrast']){
    const input=doc.getElementById(key+'Sl'),output=doc.getElementById(key+'N');
    if(input){input.value=value[key];input.setAttribute('aria-valuetext',value[key]+'%');paintRange(input);}
    if(output)output.textContent=value[key];
   }
   onChange?.({...value});
  }
  function reset(){value=normalize({showFps:value.showFps,lighting:value.lighting,sunFlare:value.sunFlare,weather:value.weather});sync();save();}
  for(const key of ['brightness','contrast']){
   doc.getElementById(key+'Sl')?.addEventListener('input',e=>{
    value=normalize({...value,[key]:Number(e.target.value)});sync();save();
   });
  }
  doc.getElementById('fpsChk')?.addEventListener('change',e=>{
   value={...value,showFps:e.target.checked};sync();save();
  });
  doc.getElementById('lightingChk')?.addEventListener('change',e=>{
   value={...value,lighting:e.target.checked};sync();save();
  });
  doc.getElementById('sunFlareChk')?.addEventListener('change',e=>{
   value={...value,sunFlare:e.target.checked};sync();save();
  });
  doc.getElementById('weatherChk')?.addEventListener('change',e=>{
   value={...value,weather:e.target.checked};sync();save();
  });
  doc.getElementById('videoReset')?.addEventListener('click',reset);
  root.addEventListener?.('storage',e=>{if(e.key===STORAGE_KEY||e.key===null){value=read();sync();}});
  value=read();sync();
  return {sync,reset,get value(){return {...value};}};
 }
 const api={create,normalize,filter,paintRange,STORAGE_KEY};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.DisplaySettings=api;
})(typeof window!=='undefined'?window:globalThis);
