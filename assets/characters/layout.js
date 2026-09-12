/* Visible body bounds (alpha > 128), in original PNG pixels.
 * [source width, source height, left, top, visible width, visible height].
 * Costumes retain their proportions; class changes do not resize the skeleton. */
const CHARACTER_BOUNDS={
 "dwarffemale_armor":[544,714,4,5,535,705],
 "dwarffemale_hunter":[499,668,2,2,495,660],
 "dwarffemale_mage":[548,735,2,2,545,721],
 "dwarffemale_priest":[559,750,14,2,528,735],
 "dwarffemale_warrior":[505,669,2,2,502,661],
 "dwarfmale_armor":[595,800,0,0,595,800],
 "dwarfmale_hunter":[561,800,0,0,561,800],
 "dwarfmale_mage":[541,800,0,0,541,800],
 "dwarfmale_priest":[513,800,0,0,513,800],
 "dwarfmale_warrior":[545,800,0,0,545,800],
 "humanfemale_armor":[420,674,5,5,410,664],
 "humanfemale_hunter":[403,676,4,5,395,667],
 "humanfemale_mage":[461,601,3,2,453,589],
 "humanfemale_priest":[425,659,2,2,421,652],
 "humanfemale_warrior":[437,704,3,2,432,695],
 "humanmale_armor":[561,800,0,0,561,799],
 "humanmale_hunter":[540,800,0,0,540,800],
 "humanmale_mage":[529,800,0,0,529,800],
 "humanmale_priest":[514,800,0,0,514,800],
 "humanmale_warrior":[532,800,0,0,532,800],
 "orcfemale_armor":[463,690,5,5,454,680],
 "orcfemale_hunter":[408,704,5,5,398,695],
 "orcfemale_mage":[432,627,2,2,428,615],
 "orcfemale_priest":[430,688,2,2,426,680],
 "orcfemale_warrior":[473,758,5,5,463,748],
 "orcmale_armor":[625,800,0,0,625,800],
 "orcmale_hunter":[579,800,0,0,579,800],
 "orcmale_mage":[583,800,0,0,583,800],
 "orcmale_priest":[563,800,0,0,563,800],
 "orcmale_warrior":[560,800,0,0,560,800],
 "undeadfemale_armor":[429,685,5,5,419,676],
 "undeadfemale_hunter":[409,688,4,5,401,679],
 "undeadfemale_mage":[500,776,2,2,496,760],
 "undeadfemale_priest":[431,669,2,2,427,662],
 "undeadfemale_warrior":[411,688,5,5,402,679],
 "undeadmale_armor":[574,800,0,0,574,800],
 "undeadmale_hunter":[540,800,0,0,540,800],
 "undeadmale_mage":[531,800,0,0,531,800],
 "undeadmale_priest":[515,800,0,0,515,800],
 "undeadmale_warrior":[525,800,0,0,525,788],
 "npc/npc_male":[516,699,4,5,508,689],
 "npc/npc_female":[387,822,4,5,379,812],
 "npc/npc_sebbe":[516,699,1,4,514,693]
};
function characterBodyFrame(img,bodyHeight=48,bodyBottom=5){
 if(!img||img.complete===false||!img.naturalWidth||!img.naturalHeight)return null;
 const iw=img.naturalWidth,ih=img.naturalHeight;
 const name=decodeURIComponent(img.src.split(/[?#]/)[0]).replace(/\\/g,'/').split('/characters/').pop().replace(/\.png$/,'');
 const reviewed=CHARACTER_BOUNDS[name];
 // A replaced or unknown image uses its full frame until its bounds are reviewed.
 const box=reviewed&&reviewed[0]===iw&&reviewed[1]===ih?reviewed.slice(2):[0,0,iw,ih];
 const scale=bodyHeight/box[3];
 return {x:-(box[0]+box[2]/2)*scale,y:bodyBottom-(box[1]+box[3])*scale,
  width:iw*scale,height:ih*scale,visibleWidth:box[2]*scale,
  bodyBottom,bodyHeight,headY:bodyBottom-bodyHeight};
}
function characterBootFrame(race,female,img,bodyBottom=5){
 // Stable feet for each frame: a robe's width or an armor swap cannot grow boots.
 const bw=female?({human:8.6,dwarf:10.7,orc:8.6,undead:8.2}[race]||9.5):12;
 const aspect=img&&img.naturalWidth?img.naturalHeight/img.naturalWidth:677/578;
 const top=bodyBottom-2;
 return {bw,top,planted:true,fem:!!female,groundY:top+bw*aspect-2};
}
