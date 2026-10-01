/* ☠ The Final Hour's ground (asked for 2026-10-01: "osynliga väggar i finalboss rum ... för ingången, sen runt där han är").
 * finalboss_zone.png (1536 x 1024) is stretched over a 3300 x 2200 world: a great round platform seen a little from above,
 * so an ellipse on the world, ringed by a double bronze line; a chasm and lower terraces all round it; a stair down to the
 * south onto a landing - the way in - and a north stair, two bridges and four buttresses that are scenery. What you stand
 * on is the platform out to the OUTER edge of its outer bronze line, and the entrance: the stair between its balustrades,
 * the neck under its pillars and the landing. Traced from the painting: the ellipse fitted to the outer line along 104
 * rays (79 kept, residual sd 1.4 units); the entrance from the luminance of its steps, balustrades and walls, row by row.
 * Carved out of the platform: the two pillars at the head of the entrance stair, and the north stair's balustrades where
 * they run down onto the platform with their end pillars. game.js also hands ARENA to the Forsaken One's kit (where his
 * runes may bloom, the four points he blinks to). Pure module: no DOM - it runs headless (tests/final-ground.test.cjs). */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.FinalGround=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const W=3300,H=2200;
 const ARENA=Object.freeze({x:1649.4,y:1072.1,rx:764.2,ry:693.3});
 /* the way in, clockwise on screen: the stair (its top edge lies inside the platform), the neck under the stair's foot
    pillars, the landing - which runs on past the map's south edge */
 const ENTRANCE=Object.freeze([[1592,1740],[1710,1740],[1710,1950],[1740,1950],[1740,2008],[1795,2008],[1795,2240],
  [1503,2240],[1503,2008],[1556,2008],[1556,1950],[1592,1950]].map(p=>Object.freeze(p)));
 const PILLARS=Object.freeze([[1558,1733,20],[1739,1733,20],[1563,535,20],[1733,535,20]].map(p=>Object.freeze(p)));   /* x, y, radius */
 const WALLS=Object.freeze([[1558,360,1592,548],[1708,360,1746,548]].map(p=>Object.freeze(p)));   /* x0, y0, x1, y1 */
 function inPoly(x,y){
  let inside=false;
  for(let i=0,j=ENTRANCE.length-1;i<ENTRANCE.length;j=i++){
   const [xi,yi]=ENTRANCE[i],[xj,yj]=ENTRANCE[j];
   if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
 }
 function clearOfEdges(x,y,r){
  const r2=r*r;
  for(let i=0,j=ENTRANCE.length-1;i<ENTRANCE.length;j=i++){
   const [ax,ay]=ENTRANCE[j],[bx,by]=ENTRANCE[i],dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
   const t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0,ex=x-ax-t*dx,ey=y-ay-t*dy;
   if(ex*ex+ey*ey<r2)return false;
  }
  return true;
 }
 function blocked(x,y,r){   /* a pillar or a balustrade on the platform */
  for(const [px,py,pr] of PILLARS){const dx=x-px,dy=y-py,R=pr+r;if(dx*dx+dy*dy<R*R)return true;}
  for(const [x0,y0,x1,y1] of WALLS){const dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);if(dx*dx+dy*dy<r*r||(dx===0&&dy===0))return true;}
  return false;
 }
 /* an actor whose feet reach r from where it stands is on the ground: clear of the pillars and balustrades, and on the
    platform (its ellipse drawn in by r) or on the entrance (inside it and r clear of its edges) */
 function contains(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  if(blocked(x,y,r))return false;
  const ex=(x-ARENA.x)/Math.max(1,ARENA.rx-r),ey=(y-ARENA.y)/Math.max(1,ARENA.ry-r);
  if(ex*ex+ey*ey<=1)return true;
  return inPoly(x,y)&&clearOfEdges(x,y,r);
 }
 /* where a click off the ground should walk you: the last place on the ground on the way from it toward the middle of the
    platform, or toward the stair and landing across from it - whichever of the two stops nearer the click */
 function nearest(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  if(contains(x,y,r))return {x,y};
  let best=null,bd=Infinity;
  for(const anchor of [{x:ARENA.x,y:ARENA.y},{x:1651,y:Math.max(1780,Math.min(2150,y))}]){
   if(!contains(anchor.x,anchor.y,r))continue;
   let lo=0,hi=1;
   for(let i=0;i<24;i++){
    const m=(lo+hi)/2,px=anchor.x+(x-anchor.x)*m,py=anchor.y+(y-anchor.y)*m;
    if(contains(px,py,r))lo=m;else hi=m;
   }
   const p={x:anchor.x+(x-anchor.x)*lo,y:anchor.y+(y-anchor.y)*lo},d=Math.hypot(x-p.x,y-p.y);
   if(d<bd){bd=d;best=p;}
  }
  return best;
 }
 /* the stretch of edge nearest a walker standing at (x,y) with feet r: felt for all round, so a pillar or a balustrade
    answers as well as the rim - the normal points back onto the ground, the tangent runs along the edge */
 function edgeAt(x,y,r=0){
  const d=r+6;let sx=0,sy=0,n=0;
  for(let i=0;i<24;i++){
   const a=i/24*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
   if(!contains(x+c*d,y+s*d,r)){sx+=c;sy+=s;n++;}
  }
  if(!n||n===24)return null;
  const l=Math.hypot(sx,sy);if(!l)return null;
  const ox=sx/l,oy=sy/l;
  return {tx:-oy,ty:ox,nx:-ox,ny:-oy};
 }
 /* a walk between the platform and the way in goes by the stair: through its head on the platform and its foot under the
    pillars - straight at a target across the rim, the walker stopped against the rim beside the stair */
 const HEAD=Object.freeze({x:1651,y:1738}),FOOT=Object.freeze({x:1651,y:1975});
 const onPlatform=(x,y)=>((x-ARENA.x)/ARENA.rx)**2+((y-ARENA.y)/ARENA.ry)**2<=1;
 const onWay=(x,y)=>!onPlatform(x,y)&&inPoly(x,y);
 function route(fx,fy,tx,ty){
  if(onPlatform(fx,fy)&&onWay(tx,ty))return ty>FOOT.y-25?[HEAD,FOOT]:[HEAD];
  if(onWay(fx,fy)&&onPlatform(tx,ty))return fy>FOOT.y-25?[FOOT,HEAD]:[HEAD];
  return [];
 }
 return Object.freeze({W,H,ARENA,ENTRANCE,PILLARS,WALLS,HEAD,FOOT,contains,nearest,edgeAt,route});
});
