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
 "npc/npc_dragon_rider":[519,700,1,1,518,699],
 "npc/npc_courtesan_blonde":[299,820,1,1,298,818],
 "npc/npc_courtesan_dark":[388,820,0,1,387,818],
 "npc/npc_ruler_sigvald":[533,700,0,1,532,698],
 "npc/npc_ruler_roderic":[530,700,1,1,527,698],
 "npc/npc_ruler_aldric":[532,700,1,0,530,698],
 "npc/npc_ruler_isaura":[504,700,1,2,502,697],
 "npc/npc_ruler_corvin":[527,700,2,3,524,696]
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
/* 🧭 Side and back views (2026-10-12). Each is cut on its front's own pixel scale and its canvas ends where the front's box
 * ends (the hem line the boots stand on), so it is never measured by its alpha like the fronts above.
 * [source width, source height, the column that stands over the feet, grip x, grip y, body px - the front box's height,
 *  which the body's units are measured against - and, for a side view, its back edge column] in PNG pixels. Like the
 * fronts they look left natively: the side view's grip is the fist it shows, the back view's the fist on the left, where
 * the front holds its weapon. The Emperor's are one pair for every race (emperor_male), the Empress's one pair (empress). */
const CHARACTER_VIEWS={
 "humanmale_warrior_side":[406,800,208,205,687,800,325,403,0,0],
 "humanmale_warrior_back":[525,800,262,48,679,800,0],
 "humanmale_mage_side":[401,794,214,214,694,800,312,397,0,0],
 "humanmale_mage_back":[537,803,268,62,703,800,0],
 "humanmale_hunter_side":[428,789,206,206,689,800,370,427,0,0],
 "humanmale_hunter_back":[536,800,268,32,700,800,0],
 "humanmale_priest_side":[387,798,182,182,698,800,284,366,0,0],
 "humanmale_priest_back":[514,807,257,113,707,800,0],
 "humanmale_armor_side":[457,796,226,226,725,799,343,417,409,0],
 "humanmale_armor_back":[552,795,277,64,724,799,0],
 "humanmale_royal_side":[435,893,244,244,797,900,385,404,0,0],
 "humanmale_royal_back":[643,901,321,144,805,900,0],
 "humanfemale_warrior_side":[315,606,144,144,575,602,300,286,396,0],
 "humanfemale_warrior_back":[434,606,216,24,575,602,0],
 "humanfemale_mage_side":[319,603,152,152,559,602,295,276,336,0],
 "humanfemale_mage_back":[379,603,190,38,559,602,0],
 "humanfemale_hunter_side":[328,602,155,155,563,606,307,300,400,0],
 "humanfemale_hunter_back":[389,606,194,29,567,606,0],
 "humanfemale_priest_side":[290,606,140,140,568,605,251,266,370,0],
 "humanfemale_priest_back":[369,606,184,58,568,605,0],
 "humanfemale_armor_side":[321,661,162,162,626,661,296,295,399,0],
 "humanfemale_armor_back":[407,663,204,28,628,661,0],
 "humanfemale_royal_side":[416,907,204,204,811,900,384,366,578,0],
 "humanfemale_royal_back":[592,901,296,119,805,900,0],
 "dwarfmale_warrior_side":[416,797,204,204,697,800,367,385,489,0],
 "dwarfmale_warrior_back":[547,801,273,37,701,800,0],
 "dwarfmale_mage_side":[421,802,194,194,702,800,347,386,469,0],
 "dwarfmale_mage_back":[538,804,269,66,704,800,0],
 "dwarfmale_hunter_side":[417,786,206,206,686,800,379,368,478,0],
 "dwarfmale_hunter_back":[548,799,274,32,699,800,0],
 "dwarfmale_priest_side":[380,801,178,178,701,800,316,350,430,0],
 "dwarfmale_priest_back":[513,804,256,84,704,800,0],
 "dwarfmale_armor_side":[421,784,210,210,710,800,365,397,451,0],
 "dwarfmale_armor_back":[579,787,290,32,713,800,0],
 "dwarfmale_royal_side":[477,901,256,256,805,900,422,404,564,0],
 "dwarfmale_royal_back":[656,901,328,151,805,900,0],
 "dwarffemale_warrior_side":[320,585,149,149,541,585,304,274,414,18],
 "dwarffemale_warrior_back":[463,588,232,24,544,585,0],
 "dwarffemale_mage_side":[341,693,168,168,583,691,270,299,412,14],
 "dwarffemale_mage_back":[539,694,267,58,584,691,0],
 "dwarffemale_hunter_side":[337,589,146,146,565,583,316,279,264,0],
 "dwarffemale_hunter_back":[476,584,237,28,560,583,0],
 "dwarffemale_priest_side":[379,712,186,186,572,714,322,324,433,22],
 "dwarffemale_priest_back":[515,716,256,49,576,714,0],
 "dwarffemale_armor_side":[330,682,162,162,619,701,312,296,456,22],
 "dwarffemale_armor_back":[523,702,262,32,639,701,0],
 "dwarffemale_royal_side":[469,906,232,232,810,900,392,402,556,0],
 "dwarffemale_royal_back":[591,906,295,55,810,900,0],
 "orcmale_warrior_side":[367,801,202,202,701,800,345,366,0,0],
 "orcmale_warrior_back":[555,801,276,36,701,800,0],
 "orcmale_mage_side":[362,801,193,193,701,800,305,334,0,0],
 "orcmale_mage_back":[576,801,288,74,701,800,0],
 "orcmale_hunter_side":[372,799,196,196,699,800,343,352,0,0],
 "orcmale_hunter_back":[558,799,280,33,699,800,0],
 "orcmale_priest_side":[353,799,180,180,699,800,296,310,0,0],
 "orcmale_priest_back":[557,802,280,119,702,800,0],
 "orcmale_armor_side":[368,791,181,181,717,800,351,363,0,0],
 "orcmale_armor_back":[619,797,309,40,723,800,0],
 "orcmale_royal_side":[428,902,227,227,806,900,397,391,0,0],
 "orcmale_royal_back":[635,902,318,141,806,900,0],
 "orcfemale_warrior_side":[351,657,150,150,596,661,302,330,375,0],
 "orcfemale_warrior_back":[459,662,230,26,601,661,0],
 "orcfemale_mage_side":[322,661,148,148,574,662,295,304,406,0],
 "orcfemale_mage_back":[424,663,212,50,576,662,0],
 "orcfemale_hunter_side":[352,664,142,142,621,663,328,329,412,0],
 "orcfemale_hunter_back":[396,662,198,31,619,663,0],
 "orcfemale_priest_side":[340,664,160,160,621,662,307,320,416,0],
 "orcfemale_priest_back":[411,667,204,51,624,662,0],
 "orcfemale_armor_side":[320,680,155,155,638,678,282,298,422,0],
 "orcfemale_armor_back":[442,678,221,41,636,678,0],
 "orcfemale_royal_side":[427,902,213,213,806,900,350,348,573,0],
 "orcfemale_royal_back":[577,899,288,111,803,900,0],
 "undeadmale_warrior_side":[414,787,195,195,688,788,323,388,414,0],
 "undeadmale_warrior_back":[527,788,262,39,690,788,0],
 "undeadmale_mage_side":[396,800,204,204,700,800,318,369,438,0],
 "undeadmale_mage_back":[512,801,256,59,701,800,0],
 "undeadmale_hunter_side":[411,801,211,211,701,800,363,375,497,0],
 "undeadmale_hunter_back":[541,802,269,32,702,800,0],
 "undeadmale_priest_side":[392,795,200,200,695,800,311,365,403,0],
 "undeadmale_priest_back":[515,799,258,79,699,800,0],
 "undeadmale_armor_side":[446,801,188,188,727,800,376,420,443,0],
 "undeadmale_armor_back":[575,800,289,37,726,800,0],
 "undeadmale_royal_side":[436,902,236,236,806,900,379,395,0,0],
 "undeadmale_royal_back":[648,899,324,147,803,900,0],
 "undeadfemale_warrior_side":[288,587,133,133,523,604,268,267,386,0],
 "undeadfemale_warrior_back":[386,605,192,24,541,604,0],
 "undeadfemale_mage_side":[334,686,158,158,583,683,292,304,416,0],
 "undeadfemale_mage_back":[472,687,236,53,584,683,0],
 "undeadfemale_hunter_side":[318,603,142,142,570,608,309,285,375,0],
 "undeadfemale_hunter_back":[401,608,200,28,575,608,0],
 "undeadfemale_priest_side":[332,652,158,158,586,655,317,296,437,0],
 "undeadfemale_priest_back":[439,656,220,46,590,655,0],
 "undeadfemale_armor_side":[334,659,158,158,633,661,311,288,459,21],
 "undeadfemale_armor_back":[416,660,208,33,634,661,0],
 "undeadfemale_royal_side":[447,926,229,229,830,900,390,379,649,0],
 "undeadfemale_royal_back":[550,929,274,60,833,900,0],
 "emperor_male_side":[442,903,244,244,799,900,384,402,540,0],
 "emperor_male_back":[635,922,317,127,818,900,0],
 "empress_side":[450,961,250,250,857,960,384,424,598,0],
 "empress_back":[586,960,292,38,856,960,0]
};
const characterFrameNames=new WeakMap();   /* the sprite's name from its src, worked out once per picture: it is asked on every draw */
function characterFrameName(img){
 const src=img.src,hit=characterFrameNames.get(img);
 if(hit&&hit.src===src)return hit.name;
 const name=decodeURIComponent(src.split(/[?#]/)[0]).replace(/\\/g,'/').split('/characters/').pop().replace(/\.png$/,'');
 characterFrameNames.set(img,{src,name});return name;
}
function characterBodyFrame(img,bodyHeight=48,bodyBottom=5){
 if(!img||img.complete===false||!img.naturalWidth||!img.naturalHeight)return null;
 const iw=img.naturalWidth,ih=img.naturalHeight;
 const name=characterFrameName(img);
 const reviewed=CHARACTER_BOUNDS[name];
 // A replaced or unknown image uses its full frame until its bounds are reviewed.
 const matched=reviewed&&reviewed[0]===iw&&reviewed[1]===ih;
 const view=!matched&&CHARACTER_VIEWS[name],viewed=!!view&&view[0]===iw&&view[1]===ih;   /* 🧭 its front's scale, feet column and grip */
 const box=matched?reviewed.slice(2):[0,0,iw,ih];
 const scale=bodyHeight/(viewed?view[5]:box[3]);
 const x=-(viewed?view[2]:box[0]+box[2]/2)*scale,y=bodyBottom-(viewed?ih:box[1]+box[3])*scale;
 const grip=matched?(ICE_ARMOR_HANDS[name]||FEMALE_COSTUME_HANDS[name]):viewed&&view.slice(3,5);
 const bootTop=matched?ICE_ARMOR_BOOT_TOP[name]:viewed?ICE_ARMOR_BOOT_TOP[name.replace(/_(side|back)$/,'')]:undefined;   /* a view stands in its front's boots */
 return {x,y,
  width:iw*scale,height:ih*scale,visibleWidth:box[2]*scale,
  bodyBottom,bodyHeight,headY:bodyBottom-bodyHeight,
  bootTop:bootTop===undefined?null:bodyBottom+(bootTop-5)*bodyHeight/48,
  hand:grip?{x:x+grip[0]*scale,y:y+grip[1]*scale}:null,
  backX:viewed&&view[6]?(view[6]-view[2])*scale:null,   /* 🧭 a side view's back edge, out from the feet column */
  headX:viewed&&view[7]?(view[7]-view[2])*scale:null,   /* 🧭 and the back of its head at eye height: where a weapon on his back hangs from the side */
  hair:viewed&&view[8]?y+view[8]*scale:null,   /* 🧭 and where its hair band ends (long hair, braids, a fur collar): from the side a weapon on his back lies over the hair down to there */
  sideShift:viewed&&view[9]?view[9]*scale:0};   /* 🧭 and how much further back a weapon on his back hangs there - clear of a big pauldron, over the hair behind it */
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
