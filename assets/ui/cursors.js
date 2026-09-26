/* 🖱 The bronze cursors (asked for 2026-09-26): an arrow for pointing and a bronze hand for anything that can be clicked.
   Every stylesheet says cursor:var(--arrow) or cursor:var(--hand); this fills the two in with the art in assets/ui/cursors/.
   The URLs are made absolute here, so a stylesheet in a sub-folder (ledger.css, tides/ui.css) resolves them the same as the
   page does, and a high-DPI screen gets the 64 px drawing. Until this runs - or if the engine refuses every form - style.css
   keeps the system's own default and pointer. Hot spots: the arrow's tip, and the middle of the hand without its cuff. */
(function(){
 const url=file=>'url("'+new URL('assets/ui/cursors/'+file,document.baseURI).href+'")';
 function set(name,art,x,y,fallback){
  const one=url(art+'_32.png'),two=url(art+'_64.png'),at=' '+x+' '+y+','+fallback;
  const forms=['image-set('+one+' 1x,'+two+' 2x)'+at,'-webkit-image-set('+one+' 1x,'+two+' 2x)'+at,one+at];
  const v=forms.find(f=>window.CSS&&CSS.supports('cursor',f));
  if(v)document.documentElement.style.setProperty(name,v);
 }
 set('--arrow','bronze_a_point',0,0,'default');
 set('--hand','bronze_a_grab',16,12,'pointer');
})();
