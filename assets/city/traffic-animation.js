/* Local cutouts keep the painted wagon intact while wheels and individual legs move - the horses' and the handcart family's. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityTrafficAnimation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PROFILES={
  wagon_barrels:{height:282,cut:[365,195],wheels:[[68,218,63,64],[295,222,61,60]],legs:[
   [[421,194],[439,194],[446,232],[480,266],[476,276],[455,276],[429,244],[413,218]],
   [[397,189],[418,194],[409,226],[398,251],[407,267],[400,277],[378,278],[367,265],[382,224]],
   [[534,187],[552,191],[548,226],[535,254],[541,266],[538,276],[516,277],[504,265],[518,221]],
   [[554,179],[571,187],[576,220],[591,248],[602,266],[595,277],[573,276],[560,256],[547,221]]]},
  wagon_caravan:{height:317,cut:[397,233],wheels:[[97,251,66,66],[306,255,64,62]],legs:[
   [[460,229],[478,229],[479,265],[497,289],[503,302],[490,308],[473,302],[452,268]],
   [[430,227],[452,228],[441,268],[431,295],[443,305],[430,315],[406,313],[403,300],[417,267]],
   [[527,213],[550,216],[545,245],[529,276],[532,294],[544,302],[535,312],[515,312],[506,302],[511,276],[519,242]],
   [[570,219],[589,224],[592,265],[609,286],[618,305],[604,315],[586,310],[575,287],[561,264]]]},
  wagon_grain:{height:277,cut:[370,193],wheels:[[95,213,64,63],[272,220,61,56]],legs:[
   [[428,181],[449,184],[448,214],[468,246],[481,261],[470,271],[450,271],[434,246],[418,216]],
   [[405,178],[425,181],[418,219],[401,249],[413,260],[400,272],[378,272],[374,260],[390,218]],
   [[526,181],[546,180],[544,219],[528,249],[538,261],[526,273],[504,272],[497,261],[510,222]],
   [[552,175],[572,180],[575,218],[591,246],[605,264],[592,274],[571,271],[558,249],[542,217]]]},
  /* the family walks: pts is what swings about pivot, cut is where the still painting is removed (below the hem or the
     thigh band, so the body keeps covering each joint); the cuts never overlap one another. fill (a depth, or a strip
     along the hem) keeps a thin band of the cut's unmoved pixels underneath, so a thigh or an ankle swinging aside
     never opens a hole. Back to front. */
  handcart:{height:313,wheels:[[300,245,61,67]],legs:[
   {pivot:[519,240],phase:0,swing:.14,fill:250,pts:[[488,228],[540,228],[539,240],[533,252],[531,275],[517,296],[513,311],[477,311],[463,292],[465,270],[480,256],[485,246],[488,240]],
    cut:[[490,240],[539,240],[533,252],[531,275],[517,296],[513,311],[477,311],[463,292],[465,270],[480,256],[485,246]]},
   {pivot:[566,240],phase:Math.PI,swing:.14,fill:250,pts:[[543,228],[591,228],[592,240],[594,246],[600,258],[610,266],[628,281],[628,300],[621,311],[571,311],[562,298],[553,280],[546,262],[544,246],[544,240]],
    cut:[[544,240],[592,240],[594,246],[600,258],[610,266],[628,281],[628,300],[621,311],[571,311],[562,298],[553,280],[546,262],[544,246]]},
   {pivot:[96,279],phase:Math.PI*.5,swing:.2,fill:283,pts:[[80,272],[110,272],[110,297],[104,303],[94,305],[93,297],[90,294],[82,292]],
    cut:[[82,287],[85,284],[88,280],[96,279],[104,283],[109,290],[109,297],[104,302],[94,304],[93,297],[90,294],[82,292]]},
   {pivot:[168,269],phase:Math.PI*1.5,swing:.2,fill:[[150,280],[156,278],[164,274],[172,270],[180,266],[187,264],[190,268],[180,271],[172,275],[164,278],[156,282],[150,284]],pts:[[148,262],[188,256],[194,270],[202,279],[202,293],[196,302],[172,306],[155,306],[148,296]],
    cut:[[150,280],[156,278],[164,274],[172,270],[180,266],[187,264],[193,272],[202,280],[202,293],[196,302],[172,306],[155,306],[148,296]]},
   {pivot:[70,290],phase:.4,swing:.22,fill:294,pts:[[54,286],[76,286],[82,291],[90,293],[94,296],[94,304],[90,308],[80,312],[58,312],[53,305],[52,294]],
    cut:[[55,293],[66,291],[76,291],[82,292],[90,294],[93,297],[93,303],[89,307],[80,312],[59,312],[54,305],[53,296]]},
   {pivot:[20,280],phase:.4+Math.PI,swing:.22,fill:[[3,277],[12,276],[16,279],[20,282],[24,285],[28,288],[35,289],[35,293],[28,292],[24,289],[20,286],[16,283],[12,280],[3,281]],pts:[[3,268],[35,272],[38,290],[36,302],[32,311],[7,311],[2,300],[2,285]],
    cut:[[3,277],[12,276],[16,279],[20,282],[24,285],[28,288],[35,289],[37,292],[35,302],[31,311],[8,311],[3,300]]}]},
 };
 function polygon(g,pts){g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.closePath();}
 function pose(time,speed,seed,scale,wheelRadius){
  const distance=Math.max(0,speed)*time,phase=distance/Math.max(32,110*scale)*Math.PI*2+seed*.71;
  return {distance,phase,wheelAngle:distance/(wheelRadius*scale)};
 }
 function draw(g,key,im,H,time,speed,seed=0){
  const p=PROFILES[key];if(!p)return false;
  const scale=H/p.height,W=640*scale,motion=pose(time,speed,seed,scale,p.wheels[0][2]);
  g.save();g.translate(-W/2,12-H);g.scale(scale,scale);
  for(const leg of p.legs)if(!Array.isArray(leg)&&leg.fill){
   g.save();g.beginPath();polygon(g,leg.cut);g.clip();g.beginPath();if(Array.isArray(leg.fill))polygon(g,leg.fill);else g.rect(0,0,640,leg.fill);g.clip();
   g.drawImage(im,0,0,640,p.height);g.restore();
  }
  for(let i=0;i<p.legs.length;i++){
   const leg=p.legs[i],walker=!Array.isArray(leg),pts=walker?leg.pts:leg;
   const [rootX,rootY]=walker?leg.pivot:[(pts[0][0]+pts[1][0])/2,pts[0][1]+2];
   const phase=motion.phase+(walker?leg.phase:[0,Math.PI,Math.PI/2,Math.PI*1.5][i]);
   const angle=speed>0?Math.sin(phase)*(walker?leg.swing:.16):0;
   g.save();g.translate(rootX,rootY);g.rotate(angle);g.translate(-rootX,-rootY);
   g.beginPath();polygon(g,pts);g.clip();g.drawImage(im,0,0,640,p.height);
   g.restore();
  }
  /* The body covers each moving hip. Remove the whole old hoof area, including antialiased edges. */
  g.save();g.beginPath();g.rect(-2,-2,644,p.height+4);
  for(const [x,y,rx,ry] of p.wheels){g.moveTo(x+rx,y);g.ellipse(x,y,rx,ry,0,0,Math.PI*2);}
  if(p.cut)g.rect(p.cut[0],p.cut[1],640-p.cut[0],p.height-p.cut[1]+2);
  for(const leg of p.legs)if(!Array.isArray(leg)&&leg.cut)polygon(g,leg.cut);
  g.clip('evenodd');g.drawImage(im,0,0,640,p.height);g.restore();
  for(const [x,y,rx,ry] of p.wheels){
   g.save();g.translate(x,y);g.scale(rx,ry);g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.clip();
   g.rotate(motion.distance/(rx*scale));
   g.drawImage(im,(x-rx)/640*im.naturalWidth,(y-ry)/p.height*im.naturalHeight,rx*2/640*im.naturalWidth,ry*2/p.height*im.naturalHeight,-1,-1,2,2);g.restore();
  }
  g.restore();return true;
 }
 return Object.freeze({draw,pose,PROFILES});
});
