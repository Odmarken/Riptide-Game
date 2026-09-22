/* Reviewed foot-only regions in each complete sprite, before world transforms.
   x0/x1 reserve transparent side margins wherever the painting permits.
   These are hard rectangular supports; no horizontal feather is required.
   root stays planted;
   ankle and everything below it share one vertical offset. Phases are radians.
   Coordinates below are source pixels; the exported data is normalized 0..1.
   Keep the same source canvas when replacing joined boots, or remeasure it. */
const EnemyFootProfiles=(()=>{
 const PI=Math.PI;
 const feet=(w,h,rows)=>Object.freeze(rows.map(([x0,x1,root,ankle,phase=0])=>
  Object.freeze({x0:x0/w,x1:x1/w,root:root/h,ankle:ankle/h,phase})));
 // All three masters share their silhouette. Both fists finish above y884;
 // their fixed grip centres (267.5/748.5,821.77) are outside every moving row.
 const troll=feet(1024,1024,[[270,476,884,931,0],[544,747,884,931,PI]]);
 const cow=feet(1024,1024,[[275,480,840,925,0],[600,790,840,925,PI]]);
 return Object.freeze({
  cave_troll_briarhollow:troll,
  cave_troll_cindervein:troll,
  cave_troll_frostveil:troll,
  // Original 1024px leveling masters. Ossric's low right claw needs the
  // shorter distal-foot interval; raising its root would deform that claw.
  gorehusk:feet(1024,1024,[[273,470,848,908,0],[564,746,875,918,PI]]),
  maw:feet(1024,1024,[[262,452,845,894,0],[574,761,891,921,PI]]),
  ossric:feet(1024,1024,[[257,465,848,907,0],[577,765,900,932,PI]]),
  ashmaw:feet(1024,1024,[[274,476,850,893,0],[574,762,850,904,PI]]),
  krev:feet(1024,1024,[[233,424,886,945,0],[596,792,886,945,PI]]),
  cowmob:cow,
  cowmob_big:cow,
  // Joined canvases: the body and boots already form one painted sprite.
  // Roots sit below hands, hanging cloth and the original body cut lines.
  betrayer:feet(937,866,[[295,455,725,813,0],[467,628,725,813,PI]]),
  firelord:feet(752,804,[[148,368,740,780,0],[368,581,744,782,PI]]),
  frostking:feet(911,898,[[302,473,792,855,0],[498,668,792,855,PI]]),
  thor:feet(908,975,[[222,441,822,925,0],[458,677,822,925,PI]]),
  reaper:feet(642,712,[[195,336,660,692,0],[336,474,660,692,PI]]),
  // ODIN's complete chibi master (2026-09-22): root just below the hanging fists, ankle where the boots flare.
  odin:feet(898,1014,[[150,448,868,960,0],[452,745,868,960,PI]]),
  // The rat's right boundary stops before the detached poison puddle at x825;
  // its root is below the hand and the tail crossing behind that ankle.
  rat:feet(1024,1024,[[218,512,891,938,0],[641,824,913,966,PI]]),
  // Original small mobs; mirrored render poses mirror these same regions.
  hum_bandit:feet(140,220,[[34,77,182,203,0],[81,132,182,203,PI]]),
  hum_raider:feet(174,220,[[13,59,182,203,0],[64,124,182,203,PI]]),
  // Only the tiny exposed shoe tips move; the robe and staff stay fixed.
  hum_cultist:feet(153,220,[[23,59,215,218,0],[85,115,215,216,PI]]),
  // The sword crosses the right shin above y185, outside its moving rows.
  hum_soldier:feet(123,220,[[21,59,184,205,0],[65,115,186,205,PI]]),
  und_husk:feet(164,220,[[32,80,185,204,0],[86,140,185,204,PI]]),
  und_skeleton:feet(134,220,[[19,63,184,204,0],[73,123,184,204,PI]]),
  // The preserved bone pair is joined behind the original 141x220 body.
  und_revenant:feet(141,262,[[3,69,201,231,0],[74,140,201,231,PI]]),
  und_wraith:Object.freeze([]),
  // Four visible paws/hooves, with diagonally opposite legs sharing a phase.
  bst_boar:feet(220,183,[[23,55,133,154,0],[58,92,136,151,PI],
   [95,135,140,166,PI],[138,176,140,159,0]]),
  // The wolf's middle silhouettes touch at x104. Matching phase AND vertical
  // mapping across that shared boundary prevents a seam without feathering.
  bst_wolf:feet(220,172,[[22,63,119,141,0],[72,104,126,145,PI],
   [104,145,126,145,PI],[154,220,127,148,0]]),
  bst_harpy:feet(220,214,[[77,113,180,196,0],[113,146,172,189,PI]]),
  // Five visible supporting leg tips; the central fangs are not legs.
  // Thin outer tips stop at the source canvas edge.
  bst_spider:feet(220,170,[[0,23,110,131,0],[33,66,123,151,PI],
   [77,112,132,158,0],[173,200,124,147,PI],[200,220,116,132,0]])
 });
})();
if(typeof module!=='undefined'&&module.exports)module.exports=EnemyFootProfiles;
