/* Animate only the living parts of the painted farm props, in local sprite coordinates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FarmDecorationAnimation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function draw(g,id,im,w,h,top,time=0,seed=0){
  if(!['soulfire_brazier','pond','trough'].includes(id))return false;
  const sw=im.naturalWidth||im.width,sh=im.naturalHeight||im.height;
  if(!(sw>0&&sh>0&&w>0&&h>0))return false;
  const t=time+seed*.017;
  g.save();g.translate(-w/2,top);
  if(id==='soulfire_brazier'){
   /* The painted bowl starts at 35%: taper motion to zero before reaching its rim. */
   const cut=.35,bands=22;
   g.drawImage(im,0,sh*cut,sw,sh*(1-cut),0,h*cut,w,h*(1-cut));
   for(let i=0;i<bands;i++){
    const y=i/bands*cut,dh=cut/bands,k=1-(y+dh)/cut;
    const dx=w*.025*k*k*(Math.sin(t*3.9-y*17)+.35*Math.sin(t*7.1+y*23));
    g.drawImage(im,0,sh*y,sw,sh*dh,dx,h*y,w,h*dh+.35);
   }
   g.globalCompositeOperation='lighter';
   for(let i=0;i<4;i++){
    const p=((t*(.18+i*.027)+i*.27)%1+1)%1;
    g.globalAlpha=Math.sin(p*Math.PI)*.55;
    g.fillStyle='#85eaff';g.beginPath();
    g.arc(w*(.5+Math.sin(t*1.6+i*2.4)*.13),h*(.31-p*.27),w*.009*(1-p*.6),0,Math.PI*2);g.fill();
   }
  }else{
   g.drawImage(im,0,0,w,h);
   /* A safe patch inside the water excludes the bank, reeds, lilies and timber rim. */
   g.beginPath();
   if(id==='pond')g.ellipse(w*.535,h*.49,w*.19,h*.205,0,0,Math.PI*2);
   else{g.moveTo(w*.155,h*.23);g.lineTo(w*.85,h*.23);g.lineTo(w*.878,h*.435);g.lineTo(w*.13,h*.435);g.closePath();}
   g.clip();
   const y0=id==='pond'?.27:.22,y1=id==='pond'?.71:.45,bands=18;
   for(let i=0;i<bands;i++){
    const y=y0+(y1-y0)*i/bands,dh=(y1-y0)/bands;
    const dx=Math.sin(t*1.45+y*32)*w*.009;
    g.drawImage(im,0,sh*y,sw,sh*dh,dx,h*y,w,h*dh+.35);
   }
   g.lineWidth=Math.max(.45,w*.003);g.strokeStyle='#d4ffff';
   for(let i=0;i<3;i++){
    const p=((t*.19+i/3)%1+1)%1;
    g.globalAlpha=Math.sin(p*Math.PI)*.22;
    g.beginPath();g.ellipse(w*(id==='pond'?.55:.51),h*(id==='pond'?.49:.33),w*(.025+p*.2),h*(.015+p*.095),0,.2,Math.PI*1.75);g.stroke();
   }
  }
  g.restore();return true;
 }
 return Object.freeze({draw});
});
