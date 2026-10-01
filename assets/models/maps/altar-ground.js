/* ⛧ The Altar's ground (asked for 2026-10-01: "gör så man inte kan gå utanför bron ... och även den stora ringen").
 * The sky sanctum is one painting, thealtar.png (1536 x 1024) stretched over a 3000 x 2000 world: a bridge from the
 * west edge that swells around its star, and the great ring it leads to. What you stand on is the stone inside the
 * OUTER GOLD LINE that rims both - the line itself, the decorated strip between it and the inner gold line, the floor.
 * Beyond it are the dark railing band with its gold lattice, the sky, and the ring's ornament spikes: not ground.
 * Traced from the painting: each bridge edge is the outer edge of that line, taken per image column (the line found
 * among the gold pixels, B-R <= -22 and bright), smoothed so the diamond ornaments on it do not bulge the wall, and
 * thinned to a polyline within a unit of the trace. The ring is the circle fitted to its outer line along 500 rays
 * (472 kept, residual sd 2.6 units). Each bridge edge ends on that circle, past the small curve that joins them.
 * Pure module: no DOM, no game - it runs headless in the tests (tests/altar-ground.test.cjs). */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.AltarGround=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const W=3000,H=2000;
 const RING=Object.freeze({x:1987.2,y:991.3,r:876.8});
 /* west to east, each ending on the ring's circle */
 const TOP=[[0,909.2],[322.3,909.2],[349.6,906.4],[400.4,895.5],[492.2,868.8],[570.3,838],[589.8,829.1],[607.4,818.9],
  [617.2,815.9],[646.5,810.4],[691.4,805.7],[757.8,805.7],[808.6,813.7],[857.4,827.4],[894.5,841.3],[933.6,853.8],
  [984.4,872.1],[1027.3,882.9],[1035.2,883.8],[1064.5,882.9],[1119.5,865.1]];
 const BOT=[[0,1105],[341.8,1104.5],[355.5,1106],[388.7,1111.4],[437.5,1122.1],[525.4,1148.3],[619.1,1180.2],[656.2,1187.2],
  [705.1,1192.4],[728.5,1192.4],[748,1190.4],[804.7,1182.2],[859.4,1167],[959,1133.6],[998,1122.5],[1013.7,1120.1],
  [1043,1120.1],[1052.7,1121.2],[1076.2,1126.6],[1084,1129.2],[1117.2,1146.7],[1124.6,1148.7]];
 /* the outline, clockwise on screen: the top edge east, the ring's far side north - east - south in 1-degree steps,
    the bottom edge back west, then the map's own west edge closes it */
 const POLY=(()=>{
  const at=p=>Math.atan2(p[1]-RING.y,p[0]-RING.x);
  const a0=at(TOP[TOP.length-1]);let a1=at(BOT[BOT.length-1]);
  if(a1<=a0)a1+=Math.PI*2;
  const n=Math.ceil((a1-a0)/(Math.PI/180)),arc=[];
  for(let i=1;i<n;i++){const a=a0+(a1-a0)*i/n;arc.push([RING.x+Math.cos(a)*RING.r,RING.y+Math.sin(a)*RING.r]);}
  return Object.freeze([...TOP,...arc,...BOT.slice().reverse()].map(p=>Object.freeze([+p[0].toFixed(1),+p[1].toFixed(1)])));
 })();
 /* the edges as flat numbers with their boxes: collide asks several times a frame, for the hero and the pet */
 const EDGES=(()=>{
  const e=new Float64Array(POLY.length*8);
  for(let i=0,j=POLY.length-1;i<POLY.length;j=i++){
   const [ax,ay]=POLY[j],[bx,by]=POLY[i],o=i*8;
   e[o]=ax;e[o+1]=ay;e[o+2]=bx;e[o+3]=by;
   e[o+4]=Math.min(ax,bx);e[o+5]=Math.max(ax,bx);e[o+6]=Math.min(ay,by);e[o+7]=Math.max(ay,by);
  }
  return e;
 })();
 function inPoly(x,y){
  let inside=false;
  for(let o=0;o<EDGES.length;o+=8){
   const yi=EDGES[o+3],yj=EDGES[o+1];
   if((yi>y)!==(yj>y)){const xi=EDGES[o+2],xj=EDGES[o];if(x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}
  }
  return inside;
 }
 /* true when no edge comes nearer than r */
 function clearOfEdges(x,y,r){
  const r2=r*r;
  for(let o=0;o<EDGES.length;o+=8){
   if(x<EDGES[o+4]-r||x>EDGES[o+5]+r||y<EDGES[o+6]-r||y>EDGES[o+7]+r)continue;
   const ax=EDGES[o],ay=EDGES[o+1],dx=EDGES[o+2]-ax,dy=EDGES[o+3]-ay,l2=dx*dx+dy*dy;
   const t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0;
   const ex=x-ax-t*dx,ey=y-ay-t*dy;
   if(ex*ex+ey*ey<r2)return false;
  }
  return true;
 }
 /* an actor whose feet reach r from where it stands is on the ground: the ring's disc at once, else inside the outline
    and r clear of every edge of it */
 function contains(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r))return false;
  r=Math.max(0,r);
  const cx=x-RING.x,cy=y-RING.y,rr=RING.r-r;
  if(rr>0&&cx*cx+cy*cy<=rr*rr)return true;
  return inPoly(x,y)&&clearOfEdges(x,y,r);
 }
 /* the stretch of rim nearest (x,y): which way it runs (the outline goes clockwise on screen) and the normal pointing
    onto the ground - game.js slides a walker along it instead of steering round it as round a rock */
 function edgeAt(x,y){
  let best=Infinity,bo=0;
  for(let o=0;o<EDGES.length;o+=8){
   const ax=EDGES[o],ay=EDGES[o+1],dx=EDGES[o+2]-ax,dy=EDGES[o+3]-ay,l2=dx*dx+dy*dy;
   const t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0,ex=x-ax-t*dx,ey=y-ay-t*dy,d2=ex*ex+ey*ey;
   if(d2<best){best=d2;bo=o;}
  }
  const dx=EDGES[bo+2]-EDGES[bo],dy=EDGES[bo+3]-EDGES[bo+1],l=Math.hypot(dx,dy)||1;
  return {tx:dx/l,ty:dy/l,nx:-dy/l,ny:dx/l};
 }
 const yAt=(edge,x)=>{
  if(x<=edge[0][0])return edge[0][1];
  for(let i=1;i<edge.length;i++)if(x<=edge[i][0]){const [x0,y0]=edge[i-1],[x1,y1]=edge[i];return y0+(y1-y0)*(x-x0)/(x1-x0);}
  return edge[edge.length-1][1];
 };
 /* where a click on the sky should walk you: the last place on the ground on the way from it toward the middle of the
    bridge (straight across it) or of the ring - so the hero stops at the edge instead of pressing against it */
 function nearest(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  if(contains(x,y,r))return {x,y};
  const anchor=x>=1100?{x:RING.x,y:RING.y}:{x,y:(yAt(TOP,x)+yAt(BOT,x))/2};
  if(!contains(anchor.x,anchor.y,r))return null;
  let lo=0,hi=1;   /* lo: on the ground (the anchor end), hi: off it (the click end) */
  for(let i=0;i<24;i++){
   const m=(lo+hi)/2,px=anchor.x+(x-anchor.x)*m,py=anchor.y+(y-anchor.y)*m;
   if(contains(px,py,r))lo=m;else hi=m;
  }
  return {x:anchor.x+(x-anchor.x)*lo,y:anchor.y+(y-anchor.y)*lo};
 }
 return Object.freeze({W,H,RING,TOP:Object.freeze(TOP.map(p=>Object.freeze(p))),BOT:Object.freeze(BOT.map(p=>Object.freeze(p))),POLY,contains,nearest,edgeAt});
});
