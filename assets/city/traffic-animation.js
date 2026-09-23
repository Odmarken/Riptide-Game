/* Local cutouts keep the painted wagon intact while wheels and individual legs move. */
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
  handcart:{height:313,wheels:[[300,245,61,67]],legs:[]},
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
  for(let i=0;i<p.legs.length;i++){
   const pts=p.legs[i],rootX=(pts[0][0]+pts[1][0])/2,rootY=pts[0][1]+2;
   const phase=motion.phase+[0,Math.PI,Math.PI/2,Math.PI*1.5][i];
   const angle=speed>0?Math.sin(phase)*.16:0;
   g.save();g.translate(rootX,rootY);g.rotate(angle);g.translate(-rootX,-rootY);
   g.beginPath();polygon(g,pts);g.clip();g.drawImage(im,0,0,640,p.height);
   g.restore();
  }
  /* The body covers each moving hip. Remove the whole old hoof area, including antialiased edges. */
  g.save();g.beginPath();g.rect(-2,-2,644,p.height+4);
  for(const [x,y,rx,ry] of p.wheels){g.moveTo(x+rx,y);g.ellipse(x,y,rx,ry,0,0,Math.PI*2);}
  if(p.cut)g.rect(p.cut[0],p.cut[1],640-p.cut[0],p.height-p.cut[1]+2);
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
