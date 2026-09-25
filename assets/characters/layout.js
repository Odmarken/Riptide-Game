/* Visible body bounds (alpha > 128), in original PNG pixels.
 * [source width, source height, left, top, visible width, visible height].
 * Costumes retain their proportions; class changes do not resize the skeleton. */
const CHARACTER_BOUNDS={
 "dwarffemale_armor":[544,714,6,6,532,701],
 "dwarffemale_hunter":[627,625,67,18,493,583],
 "dwarffemale_mage":[676,733,64,18,546,691],
 "dwarffemale_priest":[687,756,83,18,512,714],
 "dwarffemale_warrior":[633,627,77,18,485,585],
 "dwarfmale_armor":[595,800,0,0,595,800],
 "dwarfmale_hunter":[561,800,0,0,561,800],
 "dwarfmale_mage":[541,800,0,0,541,800],
 "dwarfmale_priest":[513,800,0,0,513,800],
 "dwarfmale_warrior":[545,800,0,0,545,800],
 "humanfemale_armor":[420,674,6,6,408,661],
 "humanfemale_hunter":[531,651,69,21,389,606],
 "humanfemale_mage":[589,646,99,18,392,602],
 "humanfemale_priest":[553,649,66,18,421,605],
 "humanfemale_warrior":[565,644,70,18,430,602],
 "humanmale_armor":[561,800,0,0,561,799],
 "humanmale_hunter":[540,800,0,0,540,800],
 "humanmale_mage":[529,800,0,0,529,800],
 "humanmale_priest":[514,800,0,0,514,800],
 "humanmale_warrior":[532,800,0,0,532,800],
 "orcfemale_armor":[463,690,7,6,451,678],
 "orcfemale_hunter":[536,709,72,22,394,663],
 "orcfemale_mage":[560,705,67,19,423,662],
 "orcfemale_priest":[558,707,66,19,426,662],
 "orcfemale_warrior":[601,707,71,22,459,661],
 "orcmale_armor":[625,800,0,0,625,800],
 "orcmale_hunter":[579,800,0,0,579,800],
 "orcmale_mage":[583,800,0,0,583,800],
 "orcmale_priest":[563,800,0,0,563,800],
 "orcmale_warrior":[560,800,0,0,560,800],
 "undeadfemale_armor":[429,685,6,6,417,661],
 "undeadfemale_hunter":[537,653,71,21,399,608],
 "undeadfemale_mage":[628,725,78,18,472,683],
 "undeadfemale_priest":[559,697,62,18,435,655],
 "undeadfemale_warrior":[539,649,75,21,388,604],
 "undeadmale_armor":[574,800,0,0,574,800],
 "undeadmale_hunter":[540,800,0,0,540,800],
 "undeadmale_mage":[531,800,0,0,531,800],
 "undeadmale_priest":[515,800,0,0,515,800],
 "undeadmale_warrior":[525,800,0,0,525,788],
 "npc/npc_male":[516,699,4,5,508,689],
 "npc/npc_female":[387,822,4,5,379,812],
 "npc/npc_sebbe":[516,699,1,4,514,693],
 /* City townsfolk drawn 2026-09-16 with Higgsfield gpt_image_2_5 (flare): busts cut at the hips like npc_male,
    the ladies full-length like npc_female. Measured on the installed files. */
 "npc/npc_guard":[523,700,1,2,522,698],
 "npc/npc_noble_velvet":[531,700,2,1,527,698],
 "npc/npc_noble_elder":[565,700,1,1,562,698],
 "npc/npc_noble_dandy":[525,700,0,0,525,699],
 "npc/npc_merchant":[529,700,0,2,529,697],
 "npc/npc_monk":[545,700,0,1,544,698],
 "npc/npc_blacksmith":[545,700,1,1,543,697],
 "npc/npc_noble_lady":[358,820,0,1,358,818],
 "npc/npc_noble_dowager":[358,820,1,1,356,818],
 "npc/npc_noble_maiden":[343,820,1,0,341,819],
 "npc/npc_baker":[331,820,0,0,331,819],
 "npc/npc_market_woman":[349,820,1,1,347,819],
 /* The court of the Throne Hall, 2026-09-19, same model and references: busts cut at the hips. */
 "npc/npc_king":[524,700,0,1,524,699],
 "npc/npc_king_beggar":[507,700,1,1,505,698],
 "npc/npc_kings_hand":[525,700,1,2,523,697],
 "npc/npc_royal_guard":[515,700,0,2,515,698],
 /* The people of the Harbour, 2026-09-21, same model and references: busts cut at the hips, the fishwife full-length. */
 "npc/npc_sailor":[491,700,0,2,490,697],
 "npc/npc_pirate":[499,700,1,1,498,698],
 "npc/npc_pirate_captain":[541,700,1,1,539,698],
 "npc/npc_dockhand":[559,700,0,1,557,698],
 "npc/npc_harbour_master":[500,700,1,4,498,695],
 "npc/npc_fishwife":[410,820,0,1,410,819],
 /* ⛵ Blackbeard's ports of call and the Free Company, 2026-09-25 (the four rulers are their ledger portraits, resized): busts cut at the hips. */
 "npc/npc_silver_guard":[505,700,0,0,504,700],
 "npc/npc_raven_soldier":[515,700,0,0,514,699],
 "npc/npc_foundry_worker":[530,700,2,0,526,700],
 "npc/npc_mercenary":[495,700,1,1,494,699],
 "npc/npc_mercenary_b":[542,700,1,1,541,698],
 "npc/npc_spice_merchant":[528,700,2,0,526,700],
 "npc/npc_merc_recruiter":[519,700,1,2,518,697],
 "npc/npc_ruler_sigvald":[533,700,0,1,532,698],
 "npc/npc_ruler_roderic":[530,700,1,1,527,698],
 "npc/npc_ruler_aldric":[532,700,1,0,530,698],
 "npc/npc_ruler_isaura":[504,700,1,2,502,697]
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
 humanfemale_warrior:[113,589],humanfemale_mage:[140,576],
 humanfemale_hunter:[106,588],humanfemale_priest:[121,585],
 dwarffemale_warrior:[126,559],dwarffemale_mage:[138,599],
 dwarffemale_hunter:[112,577],dwarffemale_priest:[146,592],
 orcfemale_warrior:[119,622],orcfemale_mage:[130,594],
 orcfemale_hunter:[111,642],orcfemale_priest:[119,638],
 undeadfemale_warrior:[116,561],undeadfemale_mage:[139,598],
 undeadfemale_hunter:[111,596],undeadfemale_priest:[118,607]
};
/* Boot tops tuck beneath the side plates of the cleaned female Ice Armor.
 * Values are at the normal 48-unit body height and bottom=5. */
const ICE_ARMOR_BOOT_TOP={
 humanfemale_armor:1.5,dwarffemale_armor:0,
 orcfemale_armor:1.5,undeadfemale_armor:1
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
 const bootTop=matched?ICE_ARMOR_BOOT_TOP[name]:undefined;
 return {x,y,
  width:iw*scale,height:ih*scale,visibleWidth:box[2]*scale,
  bodyBottom,bodyHeight,headY:bodyBottom-bodyHeight,
  bootTop:bootTop===undefined?null:bodyBottom+(bootTop-5)*bodyHeight/48,
  hand:grip?{x:x+grip[0]*scale,y:y+grip[1]*scale}:null};
}
function characterHandPoint(frame,fx,by){
 if(!frame.hand)return {x:fx*11,y:-1+by};
 // Match the body exactly: bob inside its rotation, then mirror the native art.
 // Facing uses the same sign as the sprite even when aiming nearly north/south.
 const a=by*.025,c=Math.cos(a),s=Math.sin(a),x=frame.hand.x,y=frame.hand.y+by;
 return {x:(fx<0?1:-1)*(x*c-y*s),y:x*s+y*c};
}
/* The ladies' shoes sit one unit lower than the men's (2026-09-17): tucked as tight as the boots
 * they read as part of the hem, and a sliver of air below the gowns and the compact costumes
 * reads as ankles. It applies to every female frame - heroes, Ice Armor and the townswomen. */
const FEMALE_BOOT_DROP=1;
function characterBootFrame(race,female,img,bodyBottom=5,reviewedTop=null){
 // Stable feet for each frame: a robe's width or an armor swap cannot grow boots.
 const bw=female?({human:8.6,dwarf:10.7,orc:8.6,undead:8.2,npc:7.8}[race]||9.5):12;
 const aspect=img&&img.naturalWidth?img.naturalHeight/img.naturalWidth:677/578;
 const top=(Number.isFinite(reviewedTop)?reviewedTop:bodyBottom-2)+(female?FEMALE_BOOT_DROP:0);
 return {bw,top,planted:true,fem:!!female,groundY:top+bw*aspect-2};
}
