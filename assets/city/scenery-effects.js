(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityScenery=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function shadow(g,x,y,rx,ry,alpha=.24){
  if(!(rx>0&&ry>0))return;
  g.save();g.translate(x,y);g.scale(rx,ry);
  const grad=g.createRadialGradient(0,0,0,0,0,1);
  grad.addColorStop(0,'rgba(0,0,0,'+alpha+')');grad.addColorStop(.48,'rgba(0,0,0,'+(alpha*.8)+')');
  grad.addColorStop(.8,'rgba(0,0,0,'+(alpha*.3)+')');grad.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grad;g.fillRect(-1,-1,2,2);g.restore();
 }
 let puff=null;
 function smokePuff(){
  if(puff)return puff;
  const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(96,96):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!c)return null;c.width=c.height=96;const g=c.getContext('2d');
  for(const [x,y,r,a] of [[47,49,39,.55],[35,41,28,.3],[60,34,24,.27],[60,60,25,.22]]){
   const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(238,236,230,'+a+')');grad.addColorStop(.5,'rgba(214,216,211,'+(a*.55)+')');grad.addColorStop(1,'rgba(192,198,198,0)');g.fillStyle=grad;g.fillRect(0,0,96,96);
  }
  puff=c;return c;
 }
 function smoke(g,x0,y0,k,time,phase,cold){
  const im=smokePuff(),n=cold?15:12,rise=(cold?165:135)*k;
  g.save();
  for(let i=0;i<n;i++){
   const p=((time*.105+i/n+phase)%1+1)%1;
   const birth=(time-p/.105)*.24+phase;
   const wind=24+Math.sin(birth)*12,x=x0+(p*p*wind+Math.sin(p*5+birth)*p*6)*k,y=y0-p*rise;
   const r=(7+p*26)*k,alpha=Math.min(1,p*14)*Math.pow(1-p,1.6)*(cold?.90:.78);
   g.save();g.globalAlpha*=alpha;g.translate(x,y);g.rotate(Math.sin(birth+p*2)*.24);
   if(im)g.drawImage(im,-r,-r,r*2,r*2);
   else{const grad=g.createRadialGradient(0,0,0,0,0,r);grad.addColorStop(0,'rgba(238,236,230,.7)');grad.addColorStop(1,'rgba(192,198,198,0)');g.fillStyle=grad;g.fillRect(-r,-r,r*2,r*2);}
   g.restore();
  }
  g.restore();
 }
 return Object.freeze({shadow,smoke});
});
