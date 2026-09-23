(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.OdinArena=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Native pixels of the supplied 2400 x 1600 floor in maps/odin_bosszone.png. */
 const WIDTH=2400,HEIGHT=1600;
 const BRAZIERS=Object.freeze([[750,375],[1650,375],[750,1175],[1650,1175]].map(p=>Object.freeze(p)));
 const BOSS=Object.freeze({x:1200,y:766});
 const RAVENS=Object.freeze([[1200,800,780,430,.11,0],[1200,800,560,330,-.09,2.6]].map(p=>Object.freeze(p)));
 function create(){return {w:WIDTH,h:HEIGHT,spawn:{x:1200,y:1450},portal:{x:1200,y:140},pathY:800,pathH:110,
  solids:BRAZIERS.map(([x,y])=>({x,y,r:20,type:'throneprop',kind:'brazier'})),deco:[],waters:[]};}
 function drawCrow(g,en,target,time,im){
  if(!(im&&im.complete&&im.naturalWidth))return false;
  const phase=en.dead?0:time*9+(en.home?en.home.x:en.x)*.07;
  const width=en.r*5.8,height=width*im.naturalHeight/im.naturalWidth;
  const heading=target?Math.atan2(target.y-en.y,target.x-en.x)+Math.PI/2:0;
  g.save();g.translate(0,-10+(en.dead?0:Math.sin(phase*.5)*2));g.rotate(heading);
  g.scale(.84+Math.sin(phase)*.16,1);
  g.drawImage(im,-width/2,-height/2,width,height);g.restore();return true;
 }
 return Object.freeze({WIDTH,HEIGHT,BRAZIERS,BOSS,RAVENS,create,drawCrow});
});
