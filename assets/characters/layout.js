/* Visible body bounds (alpha > 128), in original PNG pixels.
 * [source width, source height, left, top, visible width, visible height].
 * Costumes retain their proportions; class changes do not resize the skeleton. */
const CHARACTER_BOUNDS={
 "dwarffemale_armor":[544,714,4,5,535,705],
 "dwarffemale_hunter":[627,625,67,18,493,583],
 "dwarffemale_mage":[676,625,64,18,546,583],
 "dwarffemale_priest":[687,627,83,18,512,585],
 "dwarffemale_warrior":[633,627,77,18,485,585],
 "dwarfmale_armor":[595,800,0,0,595,800],
 "dwarfmale_hunter":[561,800,0,0,561,800],
 "dwarfmale_mage":[541,800,0,0,541,800],
 "dwarfmale_priest":[513,800,0,0,513,800],
 "dwarfmale_warrior":[545,800,0,0,545,800],
 "humanfemale_armor":[420,674,5,5,410,664],
 "humanfemale_hunter":[531,651,69,21,389,606],
 "humanfemale_mage":[589,646,67,18,453,602],
 "humanfemale_priest":[553,649,66,18,421,605],
 "humanfemale_warrior":[565,644,70,18,430,602],
 "humanmale_armor":[561,800,0,0,561,799],
 "humanmale_hunter":[540,800,0,0,540,800],
 "humanmale_mage":[529,800,0,0,529,800],
 "humanmale_priest":[514,800,0,0,514,800],
 "humanmale_warrior":[532,800,0,0,532,800],
 "orcfemale_armor":[463,690,5,5,454,680],
 "orcfemale_hunter":[536,709,72,21,394,664],
 "orcfemale_mage":[560,705,67,18,423,663],
 "orcfemale_priest":[558,707,66,18,426,663],
 "orcfemale_warrior":[601,707,71,21,459,662],
 "orcmale_armor":[625,800,0,0,625,800],
 "orcmale_hunter":[579,800,0,0,579,800],
 "orcmale_mage":[583,800,0,0,583,800],
 "orcmale_priest":[563,800,0,0,563,800],
 "orcmale_warrior":[560,800,0,0,560,800],
 "undeadfemale_armor":[429,685,5,5,419,676],
 "undeadfemale_hunter":[537,653,71,21,399,608],
 "undeadfemale_mage":[628,622,78,18,472,580],
 "undeadfemale_priest":[559,631,62,18,435,589],
 "undeadfemale_warrior":[539,649,75,21,388,604],
 "undeadmale_armor":[574,800,0,0,574,800],
 "undeadmale_hunter":[540,800,0,0,540,800],
 "undeadmale_mage":[531,800,0,0,531,800],
 "undeadmale_priest":[515,800,0,0,515,800],
 "undeadmale_warrior":[525,800,0,0,525,788],
 "npc/npc_male":[516,699,4,5,508,689],
 "npc/npc_female":[387,822,4,5,379,812],
 "npc/npc_sebbe":[516,699,1,4,514,693]
};
/* Reviewed grip centres in the native (left-facing) Ice Armor PNGs. Broad
 * gauntlets do not share the ordinary costume's fixed weapon attachment. */
const ICE_ARMOR_HANDS={
 humanmale_armor:[80,728],humanfemale_armor:[42,632],
 dwarfmale_armor:[54,726],dwarffemale_armor:[48,644],
 orcmale_armor:[64,726],orcfemale_armor:[55,642],
 undeadmale_armor:[52,726],undeadfemale_armor:[42,641]
};
/* Native grip centres for the compact female costumes. Mage robe sleeves can
 * cover the palm; their grip sits at the sleeve opening. */
const FEMALE_COSTUME_HANDS={
 humanfemale_warrior:[113,589],humanfemale_mage:[124,602],
 humanfemale_hunter:[106,588],humanfemale_priest:[121,585],
 dwarffemale_warrior:[126,559],dwarffemale_mage:[138,520],
 dwarffemale_hunter:[112,577],dwarffemale_priest:[146,505],
 orcfemale_warrior:[119,622],orcfemale_mage:[130,594],
 orcfemale_hunter:[111,642],orcfemale_priest:[119,638],
 undeadfemale_warrior:[116,561],undeadfemale_mage:[139,521],
 undeadfemale_hunter:[111,596],undeadfemale_priest:[118,553]
};
function characterBodyFrame(img,bodyHeight=48,bodyBottom=5){
 if(!img||img.complete===false||!img.naturalWidth||!img.naturalHeight)return null;
 const iw=img.naturalWidth,ih=img.naturalHeight;
 const name=decodeURIComponent(img.src.split(/[?#]/)[0]).replace(/\\/g,'/').split('/characters/').pop().replace(/\.png$/,'');
 const reviewed=CHARACTER_BOUNDS[name];
 // A replaced or unknown image uses its full frame until its bounds are reviewed.
 const matched=reviewed&&reviewed[0]===iw&&reviewed[1]===ih;
 const box=matched?reviewed.slice(2):[0,0,iw,ih];
 const scale=bodyHeight/box[3];
 const x=-(box[0]+box[2]/2)*scale,y=bodyBottom-(box[1]+box[3])*scale;
 const grip=matched&&(ICE_ARMOR_HANDS[name]||FEMALE_COSTUME_HANDS[name]);
 return {x,y,
  width:iw*scale,height:ih*scale,visibleWidth:box[2]*scale,
  bodyBottom,bodyHeight,headY:bodyBottom-bodyHeight,
  hand:grip?{x:x+grip[0]*scale,y:y+grip[1]*scale}:null};
}
function characterHandPoint(frame,fx,by){
 if(!frame.hand)return {x:fx*11,y:-1+by};
 // Match the body exactly: bob inside its rotation, then mirror the native art.
 // Facing uses the same sign as the sprite even when aiming nearly north/south.
 const a=by*.025,c=Math.cos(a),s=Math.sin(a),x=frame.hand.x,y=frame.hand.y+by;
 return {x:(fx<0?1:-1)*(x*c-y*s),y:x*s+y*c};
}
function characterBootFrame(race,female,img,bodyBottom=5){
 // Stable feet for each frame: a robe's width or an armor swap cannot grow boots.
 const bw=female?({human:8.6,dwarf:10.7,orc:8.6,undead:8.2}[race]||9.5):12;
 const aspect=img&&img.naturalWidth?img.naturalHeight/img.naturalWidth:677/578;
 const top=bodyBottom-2;
 return {bw,top,planted:true,fem:!!female,groundY:top+bw*aspect-2};
}
