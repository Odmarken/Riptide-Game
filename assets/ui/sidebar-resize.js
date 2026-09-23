/* Device-local desktop panel width. Pointer capture keeps resizing off the map. */
(function(root){
 'use strict';
 const STORAGE_KEY='riptide.sidebarWidth';
 function limits(viewport){
  return {min:320,max:Math.max(320,Math.floor(Math.min(viewport*.6,viewport-480)))};
 }
 function fit(width,viewport){
  const {min,max}=limits(viewport);
  return Math.round(Math.max(min,Math.min(max,width)));
 }
 function create({handle,app,onDragStart=()=>{},onDragEnd=()=>{}}){
  let preferred=null,width=0,drag=null;
  try{
   const saved=Number(localStorage.getItem(STORAGE_KEY));
   if(Number.isFinite(saved)&&saved>=320)preferred=saved;
  }catch(_){} /* Private browsing can disable storage. */
  const available=()=>window.innerWidth>=900&&!document.body.classList.contains('sidehidden')&&
   !document.querySelector('#login.open,#select.open,#create.open,#tideBattleFx:not([hidden])');
  function apply(){
   width=fit(preferred??window.innerWidth*.3,window.innerWidth);
   app.style.setProperty('--sidew',width+'px');
   const {min,max}=limits(window.innerWidth);
   handle.setAttribute('aria-valuemin',min);
   handle.setAttribute('aria-valuemax',max);
   handle.setAttribute('aria-valuenow',width);
   handle.setAttribute('aria-valuetext',width+' pixels wide');
  }
  function persist(){
   try{
    if(preferred===null)localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY,String(preferred));
   }catch(_){}
  }
  function finish(){
   if(!drag)return;
   const id=drag.id;drag=null;
   document.body.classList.remove('side-resizing');
   if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);
   persist();onDragEnd();
   if(document.activeElement===handle)handle.blur(); /* a mouse drag hands the keyboard back to the game - W, 1, E and Esc went nowhere until the map was clicked */
  }
  function sync(){
   if(!available())finish();
   handle.tabIndex=available()?0:-1;
   handle.setAttribute('aria-disabled',String(!available()));
   apply();
  }
  function reset(){finish();preferred=null;apply();persist();}
  const stop=e=>e.stopPropagation();
  handle.addEventListener('pointerdown',e=>{
   e.stopPropagation();
   if(e.button!==0||e.isPrimary===false||!available())return;
   e.preventDefault();
   drag={id:e.pointerId,x:e.clientX,width};
   handle.setPointerCapture(e.pointerId);
   handle.focus({preventScroll:true});
   document.body.classList.add('side-resizing');
   onDragStart();
  });
  handle.addEventListener('pointermove',e=>{
   e.stopPropagation();
   if(!drag||e.pointerId!==drag.id)return;
   e.preventDefault();
   preferred=fit(drag.width+drag.x-e.clientX,window.innerWidth);
   apply();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
   handle.addEventListener(type,e=>{e.stopPropagation();if(drag&&e.pointerId===drag.id)finish();});
  }
  handle.addEventListener('click',stop);
  handle.addEventListener('dblclick',e=>{e.stopPropagation();e.preventDefault();if(available())reset();});
  handle.addEventListener('keydown',e=>{
   if(!available())return;
   const step=e.shiftKey?60:20,{min,max}=limits(window.innerWidth);
   const next={ArrowLeft:width+step,ArrowRight:width-step,Home:min,End:max}[e.key];
   if(next===undefined)return; /* only the keys the handle uses stop here - every other key still reaches the game */
   e.stopPropagation();
   e.preventDefault();preferred=fit(next,window.innerWidth);apply();persist();
  });
  window.addEventListener('resize',()=>{finish();sync();});
  window.addEventListener('blur',finish);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  /* Login and the collapse button can hide the handle while it owns a pointer. */
  const observer=new MutationObserver(sync);
  for(const el of [document.body,...document.querySelectorAll('#login,#select,#create,#tideBattleFx')]){
   observer.observe(el,{attributes:true,attributeFilter:['class','hidden']});
  }
  sync();
  return {get width(){return width;},reset};
 }
 const api={create,limits,fit,STORAGE_KEY};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.SidebarResize=api;
})(typeof window!=='undefined'?window:globalThis);
