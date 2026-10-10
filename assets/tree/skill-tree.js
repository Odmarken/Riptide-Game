/* 🌳 SKILL TREE (2026-10-10, asked for: "lägg en flik ovanför outfits som ska heta skill tree ... varje klass ska ha en unik tree men
   också några saker som är samma typ ... en point per prestige upp till prestige 40 ... vissa saker ska man behöva klicka på flera
   gånger typ 1/3 ... välja mellan 2 delar, en mer konservativ och en mer offensiv ... sista på varje träd något stort", then
   "man ska inte kunna välja allt" and the balance rules agreed the same day).

   One tree per class. The top two rows are the same in every tree (health, mana, gold, damage taken, cooldowns, reach). Below them
   the tree forks: the left side keeps you alive, the right side hits harder. Each side is three columns of four talents and ends in
   a capstone; a hero can spend on both sides but take only ONE of the two capstones. Choice nodes take one of two options.

   Points: one per prestige, P1-P40. A talent opens when the one above it is full (3/3 before the next), and the rows behind a gate
   need that many points spent anywhere in the tree (8, 20, 30). About 70 points' worth of talents against 40 points.

   Balance rules (agreed 2026-10-10): damage bonuses on one spell add up (the game sums them), a second hit or shot does 50-60%,
   all cooldown cuts together stop at -30%, crit bonuses add up, talent damage reduction stops at -25%, block and dodge at 15%.
   Capstones look big and add about 15% on average. Hardcore uses the same cooldowns as normal (asked the same day).

   Pure data and rules: no DOM and no game state. game.js reads effects(), the window is assets/tree/tree-ui.js. */
(function(root){
 'use strict';
 const CAP=40;                         /* the most points a hero can hold: one per prestige up to P40 */
 const GATES=[0,0,8,8,20,20,30];       /* points spent before a row opens: the shared rows, the sides' top, their bottom, the capstones */
 const CD_CUT_MAX=.30,DR_MAX=.25,AVOID_MAX=.15;   /* the caps the game applies to what the tree sums */
 const RESET_LOCK='Not in a boss fight';
 /* ---- the shared top, in every tree ---- */
 const SHARED=[
  {id:'vitality',n:'Vitality',row:0,col:1,max:3,fx:{hp:3},d:'+#% max health'},
  {id:'wisdom',n:'Wisdom',row:0,col:3,max:3,fx:{mana:5,regen:5},d:'+#% mana and mana regeneration'},
  {id:'fortune',n:'Fortune',row:0,col:5,max:3,fx:{gold:3},d:'+#% gold from foes'},
  {id:'toughness',n:'Toughness',row:1,col:1,max:3,req:'vitality',fx:{dr:2},d:'Take #% less damage'},
  {id:'focus',n:'Focus',row:1,col:3,max:3,req:'wisdom',fx:{cdr:3},d:'Spell cooldowns #% shorter'},
  {id:'reach',n:'Reach',row:1,col:5,max:2,req:'fortune',fx:{reach:8},d:'+#% range for attacks and spells (close fighters: wider reach and area spells)'},
 ];
 /* ---- the class trees. Spells by index: warrior Heroic Strike / Whirlwind / Battle Shout, mage Fireball / Frost Nova / Arcane
    Barrage, hunter Aimed Shot / Multi-Shot / Rapid Fire, priest Smite / Holy Nova / Renew. fx: stats per rank, sp: per spell per
    rank, opts: a choice of two, cap: the capstone's id, p: its numbers. '#' in d is the value for the rank shown ---- */
 const TREES={
  warrior:{sides:{def:{n:'Guardian',d:'Shield, armour and staying power'},off:{n:'Berserker',d:'Heavier blows, crits and war cries'}},nodes:[
   /* Guardian */
   {id:'w_block',n:'Shield Block',row:2,col:0,max:3,fx:{avoid:4},d:'#% chance to block a blow completely'},
   {id:'w_slam',n:'Shield Arts',row:3,col:0,req:'w_block',opts:[
    {id:'shieldslam',n:'Shield Slam',d:'Heroic Strike becomes a shield bash that stuns the foe for 1 s (bosses shrug it off)',p:{stun:1}},
    {id:'revenge',n:'Revenge',d:'After you block, your next Heroic Strike deals 60% more',p:{mul:.6}}]},
   {id:'w_ironwill',n:'Iron Will',row:4,col:0,max:3,req:'w_slam',fx:{shoutDr:4},d:'While Battle Shout lasts, take #% less damage'},
   {id:'w_wall',n:'Bastion',row:5,col:0,req:'w_ironwill',opts:[
    {id:'shieldwall',n:'Shield Wall',d:'Battle Shout also cuts the damage you take by 25% for 6 s',p:{dr:.25,dur:6}},
    {id:'taunt',n:'Taunting Roar',d:'Battle Shout pulls nearby foes to you; they deal 15% less damage for 8 s',p:{weak:.15,dur:8,r:220}}]},
   {id:'w_fortify',n:'Fortify',row:2,col:1,max:3,fx:{hp:4},d:'+#% max health'},
   {id:'w_secondwind',n:'Second Wind',row:3,col:1,max:3,req:'w_fortify',fx:{wwHeal:.5},d:'Whirlwind heals #% of max health for every foe it hits'},
   {id:'w_laststand',n:'Last Stand',row:4,col:1,req:'w_secondwind',opts:[
    {id:'laststand',n:'Last Stand',d:'Below 30% health, a shield of 25% of max health (every 2 minutes)',p:{at:.3,shield:.25,cd:120}},
    {id:'unbowed',n:'Unbowed',d:'Below 30% health, take 20% less damage',p:{at:.3,dr:.2}}]},
   {id:'w_rally',n:'Rallying Cry',row:5,col:1,max:2,req:'w_laststand',fx:{shoutHeal:6},d:'Battle Shout heals #% of max health'},
   {id:'w_thorns',n:'Thorns',row:2,col:2,max:3,fx:{thorns:5},d:'Foes that strike you take #% of the blow back'},
   {id:'w_bulwark',n:'Bulwark',row:3,col:2,max:2,req:'w_thorns',sp:{1:{rad:10}},d:'Whirlwind reaches #% wider'},
   {id:'w_spin',n:'Whirling Guard',row:4,col:2,req:'w_bulwark',opts:[
    {id:'spinguard',n:'Spinning Guard',d:'Whirlwind also cuts the damage you take by 15% for 4 s',p:{dr:.15,dur:4}},
    {id:'earthshaker',n:'Earthshaker',d:'Whirlwind slows the foes it hits for 2 s',p:{slow:2}}]},
   {id:'w_stalwart',n:'Stalwart',row:5,col:2,max:3,req:'w_spin',fx:{dr:2},d:'Take #% less damage'},
   {id:'w_unyielding',n:'Unyielding',row:6,col:1,req:['w_wall','w_rally','w_stalwart'],cap:'unyielding',p:{cd:180,dur:6},
    d:'Once every 3 minutes a killing blow leaves you at 1 health: for 6 s you cannot fall, and every blow you take heals you instead. A golden lion roars over you.'},
   /* Berserker */
   {id:'w_mighty',n:'Mighty Blows',row:2,col:4,max:3,sp:{0:{dmg:6,size:10}},d:'Heroic Strike deals #% more damage and cuts wider'},
   {id:'w_trance',n:'Battle Trance',row:3,col:4,max:3,req:'w_mighty',sp:{0:{cd:.2}},d:'Heroic Strike cooldown #s shorter'},
   {id:'w_double',n:'Killing Blow',row:4,col:4,req:'w_trance',opts:[
    {id:'doublestrike',n:'Double Strike',d:'Heroic Strike strikes twice; the second blow deals 50%',p:{second:.5}},
    {id:'execute',n:'Execute',d:'Heroic Strike deals 150% more to foes under 30% health',p:{at:.3,mul:1.5}}]},
   {id:'w_wounds',n:'Deep Wounds',row:5,col:4,max:3,req:'w_double',sp:{0:{dot:3}},d:'Heroic Strike makes the foe bleed for #% of the hit over 3 s'},
   {id:'w_rampage',n:'Rampage',row:2,col:5,max:3,fx:{crit:1.5},d:'+#% critical strike chance'},
   {id:'w_thirst',n:'Bloodlust',row:3,col:5,req:'w_rampage',opts:[
    {id:'bloodthirst',n:'Bloodthirst',d:'Critical strikes heal you for 1% of max health',p:{heal:.01}},
    {id:'brutality',n:'Brutality',d:'Critical strikes deal 15% more damage',p:{critDmg:15}}]},
   {id:'w_fury',n:'Fury',row:4,col:5,max:2,req:'w_thirst',fx:{haste:2},d:'+#% attack speed'},
   {id:'w_enrage',n:'Rage',row:5,col:5,req:'w_fury',opts:[
    {id:'enrage',n:'Enrage',d:'After a critical strike, deal 5% more damage for 3 s',p:{mul:.05,dur:3}},
    {id:'cleave',n:'Cleave',d:'Heroic Strike also hits one more foe beside the target for 50%',p:{share:.5,r:80}}]},
   {id:'w_warcry',n:'War Cry',row:2,col:6,max:3,sp:{2:{val:2}},d:'Battle Shout gives #% more attack'},
   {id:'w_storm',n:'Bladestorm',row:3,col:6,max:2,req:'w_warcry',sp:{1:{dmg:15,size:15}},d:'Whirlwind deals #% more damage and spins taller'},
   {id:'w_clap',n:'Warlord',row:4,col:6,req:'w_storm',opts:[
    {id:'thunderclap',n:'Thunderclap',d:'Battle Shout also slams the ground for 150% to every foe around you and slows them for 2 s',p:{mul:1.5,r:150,slow:2}},
    {id:'bloodrage',n:'Bloodrage',d:'Battle Shout also gives 12% attack speed while it lasts',p:{haste:.12}}]},
   {id:'w_presence',n:'Commanding Presence',row:5,col:6,max:2,req:'w_clap',sp:{2:{dur:1}},d:'Battle Shout lasts #s longer'},
   {id:'w_avatar',n:'Avatar of War',row:6,col:5,req:['w_wounds','w_enrage','w_presence'],cap:'avatar',p:{mul:.08,cleave:.4,scale:1.3,r:80},
    d:'While Battle Shout lasts you grow 30% bigger, deal 8% more damage, and every hit cleaves 40% into the foes beside your target.'},
  ]},
  mage:{sides:{def:{n:'Frostwarden',d:'Ice, shields and control'},off:{n:'Pyromancer',d:'Fire and arcane burst'}},nodes:[
   /* Frostwarden */
   {id:'m_core',n:'Frozen Core',row:2,col:0,max:3,sp:{1:{rad:8,slow:.5}},d:'Frost Nova reaches #% wider and slows #s longer'},
   {id:'m_snap',n:'Cold Snap',row:3,col:0,max:2,req:'m_core',sp:{1:{cd:1}},d:'Frost Nova cooldown #s shorter'},
   {id:'m_freeze',n:'Winter’s Grip',row:4,col:0,req:'m_snap',opts:[
    {id:'deepfreeze',n:'Deep Freeze',d:'Frost Nova freezes foes solid for 1.5 s (bosses are only slowed)',p:{dur:1.5}},
    {id:'glacialspike',n:'Glacial Spike',d:'Frost Nova also hurls an ice spike at the strongest foe near you for 200%',p:{mul:2}}]},
   {id:'m_shatter',n:'Shatter',row:5,col:0,max:3,req:'m_freeze',fx:{vsSlowed:4},d:'Slowed or frozen foes take #% more damage from you'},
   {id:'m_barrier',n:'Ice Barrier',row:2,col:1,max:3,fx:{novaShield:4},d:'Frost Nova shields you for #% of max health for 6 s'},
   {id:'m_shield',n:'Wards',row:3,col:1,req:'m_barrier',opts:[
    {id:'manashield',n:'Mana Shield',d:'A quarter of the damage you take is paid with mana while you have it',p:{share:.25}},
    {id:'frostarmor',n:'Frost Armor',d:'Foes that strike you in melee are slowed for 2 s',p:{slow:2}}]},
   {id:'m_skin',n:'Glacial Skin',row:4,col:1,max:3,req:'m_shield',fx:{dr:2},d:'Take #% less damage'},
   {id:'m_evoc',n:'Clarity of Ice',row:5,col:1,req:'m_skin',opts:[
    {id:'evocation',n:'Evocation',d:'When your mana falls below 20%, regain 40% of it (once a minute)',p:{at:.2,mana:.4,cd:60}},
    {id:'coldblood',n:'Cold Blood',d:'Below 30% health, Frost Nova is ready again at once (every 30 s)',p:{at:.3,cd:30}}]},
   {id:'m_frostbolt',n:'Frostbolt',row:2,col:2,max:3,fx:{boltSlow:10},d:'Your bolts turn to frost: a #% chance to slow the foe for 2 s'},
   {id:'m_intellect',n:'Arcane Intellect',row:3,col:2,max:2,req:'m_frostbolt',fx:{mana:6},d:'+#% max mana'},
   {id:'m_blizzard',n:'Storm of Ice',row:4,col:2,req:'m_intellect',opts:[
    {id:'blizzard',n:'Blizzard',d:'Arcane Barrage becomes a blizzard over your target: 6 strikes of 50% to every foe in it over 4 s, and they are slowed',p:{ticks:6,mul:.5,dur:4,r:120}},
    {id:'icelances',n:'Ice Lances',d:'Arcane Barrage fires 5 ice lances that pierce every foe in their path, 70% each',p:{n:5,mul:.7,w:26}}]},
   {id:'m_hypo',n:'Hypothermia',row:5,col:2,max:3,req:'m_blizzard',fx:{slowedWeak:4},d:'Slowed or frozen foes deal #% less damage'},
   {id:'m_iceblock',n:'Ice Block',row:6,col:1,req:['m_shatter','m_evoc','m_hypo'],cap:'iceblock',p:{cd:180,dur:3,heal:.4,mul:3,r:150},
    d:'Once every 3 minutes a killing blow freezes you in ice for 3 s instead: nothing can hurt you, you heal 40%, and the ice bursts as a Frost Nova of 300%.'},
   /* Pyromancer */
   {id:'m_searing',n:'Searing Fire',row:2,col:4,max:3,sp:{0:{dmg:6,size:10}},d:'Fireball deals #% more damage and burns bigger'},
   {id:'m_kindling',n:'Kindling',row:3,col:4,max:2,req:'m_searing',sp:{0:{cd:.2}},d:'Fireball cooldown #s shorter'},
   {id:'m_twin',n:'Flamecraft',row:4,col:4,req:'m_kindling',opts:[
    {id:'twinflames',n:'Twin Flames',d:'Fireball throws two fireballs; the second deals 50%',p:{second:.5}},
    {id:'pyroblast',n:'Pyroblast',d:'Fireball becomes a huge Pyroblast: 170% damage, half of it to every foe around the target, 1 s longer cooldown',p:{mul:1.7,splash:.5,r:90,cd:1,size:1.7}}]},
   {id:'m_ignite',n:'Ignite',row:5,col:4,max:3,req:'m_twin',sp:{0:{dot:3}},d:'Fireball sets the foe burning for #% of the hit over 3 s'},
   {id:'m_critmass',n:'Critical Mass',row:2,col:5,max:3,fx:{crit:1.5},d:'+#% critical strike chance'},
   {id:'m_combust',n:'Heat',row:3,col:5,req:'m_critmass',opts:[
    {id:'combustion',n:'Combustion',d:'Fire critical strikes deal 20% more damage',p:{critDmg:20}},
    {id:'hotstreak',n:'Hot Streak',d:'Two critical strikes in a row make Fireball ready again at once',p:{}}]},
   {id:'m_burning',n:'Burning Soul',row:4,col:5,max:2,req:'m_combust',fx:{vsBurning:2},d:'Deal #% more damage to burning foes'},
   {id:'m_bomb',n:'Detonation',row:5,col:5,req:'m_burning',opts:[
    {id:'livingbomb',n:'Living Bomb',d:'Every 10 s your next Fireball plants a Living Bomb: the foe explodes after 2 s for 80% to every foe around it',p:{cd:10,delay:2,mul:.8,r:110}},
    {id:'firestarter',n:'Firestarter',d:'Fireball deals 40% more to foes above 80% health',p:{at:.8,mul:.4}}]},
   {id:'m_surge',n:'Arcane Surge',row:2,col:6,max:3,sp:{2:{hits:1}},d:'Arcane Barrage fires # more missiles'},
   {id:'m_power',n:'Arcane Power',row:3,col:6,max:2,req:'m_surge',sp:{2:{cd:3}},d:'Arcane Barrage cooldown #s shorter'},
   {id:'m_beam',n:'Arcane Focus',row:4,col:6,req:'m_power',opts:[
    {id:'arcanebeam',n:'Arcane Beam',d:'Arcane Barrage becomes a violet beam that sweeps across every foe in front of you for 2 s: 6 strikes of 30%',p:{ticks:6,mul:.3,dur:2,len:260,w:30,arc:1.2}},
    {id:'arcaneecho',n:'Arcane Echo',d:'Every missile that hits splits into two smaller ones at nearby foes, 40% each',p:{n:2,mul:.4,r:160}}]},
   {id:'m_mastery',n:'Arcane Mastery',row:5,col:6,max:3,req:'m_beam',sp:{2:{dmg:6}},d:'Arcane Barrage deals #% more damage'},
   {id:'m_meteor',n:'Meteor',row:6,col:5,req:['m_ignite','m_bomb','m_mastery'],cap:'meteor',p:{every:6,mul:3,r:150,burn:3},
    d:'Every 6th Fireball calls a meteor down on the target: 300% to every foe in a wide area, and the ground burns for 3 s.'},
  ]},
  hunter:{sides:{def:{n:'Warden',d:'Evasion, traps and survival'},off:{n:'Marksman',d:'Precision, piercing shots and volleys'}},nodes:[
   /* Warden */
   {id:'h_evasion',n:'Evasion',row:2,col:0,max:3,fx:{avoid:4},d:'#% chance to dodge a blow'},
   {id:'h_fleet',n:'Fleet Foot',row:3,col:0,max:2,req:'h_evasion',fx:{move:5},d:'+#% movement speed'},
   {id:'h_instinct',n:'Instincts',row:4,col:0,req:'h_fleet',opts:[
    {id:'deterrence',n:'Deterrence',d:'Below 30% health, every blow glances off you for 3 s (every 2 minutes)',p:{at:.3,dur:3,cd:120}},
    {id:'survival',n:'Survival Instincts',d:'Below 30% health, heal 25% over 5 s (every 90 s)',p:{at:.3,heal:.25,dur:5,cd:90}}]},
   {id:'h_armor',n:'Natural Armor',row:5,col:0,max:3,req:'h_instinct',fx:{dr:2},d:'Take #% less damage'},
   {id:'h_survivalist',n:'Survivalist',row:2,col:1,max:3,fx:{killHeal:1},d:'Every kill heals #% of max health'},
   {id:'h_herbs',n:'Woodcraft',row:3,col:1,req:'h_survivalist',opts:[
    {id:'herbalist',n:'Herbalist',d:'Healing potions heal 40% more',p:{potion:.4}},
    {id:'spiritbond',n:'Spirit Bond',d:'In a fight, regain 0.6% of max health every second',p:{regen:.006}}]},
   {id:'h_hardy',n:'Hardiness',row:4,col:1,max:3,req:'h_herbs',fx:{hp:4},d:'+#% max health'},
   {id:'h_spirit',n:'Wild Spirit',row:5,col:1,req:'h_hardy',opts:[
    {id:'bearspirit',n:'Bear Spirit',d:'Rapid Fire also cuts the damage you take by 25% while it lasts',p:{dr:.25}},
    {id:'owlspirit',n:'Owl Spirit',d:'Rapid Fire also gives 30% range while it lasts',p:{range:.3}}]},
   {id:'h_pin',n:'Pinning Shots',row:2,col:2,max:3,fx:{boltSlow:8},d:'Your shots have a #% chance to slow the foe for 2 s'},
   {id:'h_trap',n:'Snares',row:3,col:2,req:'h_pin',opts:[
    {id:'frosttrap',n:'Frost Trap',d:'Multi-Shot leaves a frost trap under each target for 3 s: foes in it are slowed',p:{dur:3,r:60}},
    {id:'concussive',n:'Concussive Shot',d:'Aimed Shot slows its target for 3 s',p:{slow:3}}]},
   {id:'h_hobble',n:'Hobble',row:4,col:2,max:2,req:'h_trap',fx:{slowedWeak:5},d:'Slowed foes deal #% less damage'},
   {id:'h_long',n:'Long Shots',row:5,col:2,max:3,req:'h_hobble',fx:{reach:6},d:'+#% range'},
   {id:'h_hawk',n:'Spirit Hawk',row:6,col:1,req:['h_armor','h_spirit','h_long'],cap:'hawk',p:{every:3,mul:1.2,mark:.1,markDur:5,r:320},
    d:'A hawk of light circles over you and dives at a foe every 3 s for 120%; the foe it strikes takes 10% more damage from you for 5 s.'},
   /* Marksman */
   {id:'h_steady',n:'Steady Aim',row:2,col:4,max:3,sp:{0:{dmg:6,size:10}},d:'Aimed Shot deals #% more damage and flies longer'},
   {id:'h_draw',n:'Quick Draw',row:3,col:4,max:2,req:'h_steady',sp:{0:{cd:.2}},d:'Aimed Shot cooldown #s shorter'},
   {id:'h_pierce',n:'Trick Shots',row:4,col:4,req:'h_draw',opts:[
    {id:'piercingshot',n:'Piercing Shot',d:'Aimed Shot becomes a lance of light through every foe in a line: full damage to the first, 70% to the rest',p:{rest:.7,len:320,w:24}},
    {id:'doubleshot',n:'Double Shot',d:'Aimed Shot fires two arrows; the second deals 50%',p:{second:.5}}]},
   {id:'h_careful',n:'Careful Aim',row:5,col:4,max:3,req:'h_pierce',fx:{carefulAim:6},d:'Aimed Shot deals #% more to foes above 70% health'},
   {id:'h_deadeye',n:'Deadeye',row:2,col:5,max:3,fx:{crit:1.5},d:'+#% critical strike chance'},
   {id:'h_lethal',n:'Killing Shots',row:3,col:5,req:'h_deadeye',opts:[
    {id:'lethalshots',n:'Lethal Shots',d:'Critical strikes deal 30% more damage',p:{critDmg:30}},
    {id:'sniper',n:'Sniper Training',d:'Deal 6% more damage to foes more than 150 away',p:{at:150,mul:.06}}]},
   {id:'h_hawkeye',n:'Hawkeye',row:4,col:5,max:2,req:'h_lethal',fx:{reach:8},d:'+#% range'},
   {id:'h_killer',n:'Predator',row:5,col:5,req:'h_hawkeye',opts:[
    {id:'killer',n:'Killer Instinct',d:'Deal 12% more damage to bosses',p:{mul:.12}},
    {id:'huntersmark',n:'Hunter’s Mark',d:'Aimed Shot marks its target: it takes 6% more damage from you for 6 s',p:{mark:.06,dur:6}}]},
   {id:'h_barrage',n:'Barrage',row:2,col:6,max:3,sp:{1:{hits:1}},d:'Multi-Shot fires # more arrows'},
   {id:'h_trigger',n:'Trigger Finger',row:3,col:6,max:2,req:'h_barrage',sp:{2:{dur:1}},d:'Rapid Fire lasts #s longer'},
   {id:'h_explode',n:'Arrowcraft',row:4,col:6,req:'h_trigger',opts:[
    {id:'explosive',n:'Explosive Arrows',d:'Multi-Shot’s arrows explode where they land: 40% to every foe beside the target',p:{splash:.4,r:70}},
    {id:'ricochet',n:'Ricochet',d:'Every Multi-Shot arrow bounces on to one more foe for 50%',p:{mul:.5,r:180}}]},
   {id:'h_volley',n:'Volley Mastery',row:5,col:6,max:3,req:'h_explode',sp:{1:{dmg:8}},d:'Multi-Shot deals #% more damage'},
   {id:'h_rain',n:'Rain of Arrows',row:6,col:5,req:['h_careful','h_killer','h_volley'],cap:'rain',p:{every:.5,mul:.2,r:200},
    d:'Rapid Fire also brings a rain of arrows down round you: every 0.5 s while it lasts, every foe within 200 is struck for 20%.'},
  ]},
  priest:{sides:{def:{n:'Sanctuary',d:'Shields, healing and resolve'},off:{n:'Zealot',d:'Holy fire, beams and judgement'}},nodes:[
   /* Sanctuary */
   {id:'p_shield',n:'Power Word: Shield',row:2,col:0,max:3,fx:{renewShield:4},d:'Renew also shields you for #% of max health'},
   {id:'p_favor',n:'Divine Favor',row:3,col:0,max:2,req:'p_shield',sp:{2:{dur:1}},d:'Renew lasts #s longer'},
   {id:'p_guardian',n:'Providence',row:4,col:0,req:'p_favor',opts:[
    {id:'guardianspirit',n:'Guardian Spirit',d:'Once every 3 minutes a killing blow heals you to 40% instead',p:{cd:180,heal:.4}},
    {id:'mending',n:'Prayer of Mending',d:'Every blow you take heals you for 2% of max health (at most every 2 s)',p:{heal:.02,cd:2}}]},
   {id:'p_serenity',n:'Serenity',row:5,col:0,max:2,req:'p_guardian',sp:{2:{cd:3}},d:'Renew cooldown #s shorter'},
   {id:'p_blessed',n:'Blessed Healing',row:2,col:1,max:3,sp:{0:{heal:15},1:{heal:15}},d:'Smite and Holy Nova heal #% more'},
   {id:'p_innerfire',n:'Inner Fire',row:3,col:1,max:3,req:'p_blessed',fx:{renewDr:3},d:'While Renew runs, take #% less damage'},
   {id:'p_ground',n:'Hallowed Ground',row:4,col:1,req:'p_innerfire',opts:[
    {id:'sanctified',n:'Sanctified Ground',d:'Holy Nova leaves holy ground for 5 s; standing in it heals 2% of max health a second',p:{dur:5,heal:.02,r:100}},
    {id:'embrace',n:'Light’s Embrace',d:'Holy Nova also cuts the damage you take by 15% for 4 s',p:{dr:.15,dur:4}}]},
   {id:'p_devotion',n:'Devotion',row:5,col:1,max:3,req:'p_ground',fx:{hp:4},d:'+#% max health'},
   {id:'p_ward',n:'Holy Ward',row:2,col:2,max:2,sp:{1:{rad:10}},d:'Holy Nova reaches #% wider'},
   {id:'p_well',n:'Grace',row:3,col:2,req:'p_ward',opts:[
    {id:'spiritwell',n:'Spirit Well',d:'Holy Nova restores 2% of your mana for every foe it hits',p:{mana:.02}},
    {id:'blinding',n:'Blinding Light',d:'Holy Nova slows the foes it hits for 2 s',p:{slow:2}}]},
   {id:'p_bene',n:'Benediction',row:4,col:2,max:3,req:'p_well',sp:{1:{cd:.7}},d:'Holy Nova cooldown #s shorter'},
   {id:'p_aegis',n:'Blessings',row:5,col:2,req:'p_bene',opts:[
    {id:'aegis',n:'Divine Aegis',d:'Healing past full health becomes a shield, up to 10% of max health',p:{max:.1}},
    {id:'martyr',n:'Martyrdom',d:'A blow of more than 15% of your health heals you 8% (every 10 s)',p:{at:.15,heal:.08,cd:10}}]},
   {id:'p_archangel',n:'Archangel',row:6,col:1,req:['p_serenity','p_devotion','p_aegis'],cap:'archangel',p:{dur:8,heal:.03,dr:.25},
    d:'Renew opens great wings of light for 8 s: you heal 3% a second, take 25% less damage, and your spells cost no mana.'},
   /* Zealot */
   {id:'p_holyfire',n:'Holy Fire',row:2,col:4,max:3,sp:{0:{dmg:6,size:10}},d:'Smite deals #% more damage and shines bigger'},
   {id:'p_judge',n:'Judgement',row:3,col:4,max:2,req:'p_holyfire',sp:{0:{cd:.2}},d:'Smite cooldown #s shorter'},
   {id:'p_beam',n:'Lightbringer',row:4,col:4,req:'p_judge',opts:[
    {id:'holybeam',n:'Holy Beam',d:'Smite becomes a beam of light through every foe in a line: full damage to the first, 70% to the rest',p:{rest:.7,len:300,w:26}},
    {id:'penance',n:'Penance',d:'Smite strikes three times, 40% each',p:{n:3,mul:.4}}]},
   {id:'p_searing',n:'Searing Light',row:5,col:4,max:3,req:'p_beam',sp:{0:{dot:3}},d:'Smite burns the target for #% of the hit over 3 s'},
   {id:'p_fury',n:'Righteous Fury',row:2,col:5,max:3,fx:{crit:1.5},d:'+#% critical strike chance'},
   {id:'p_zeal',n:'Zeal',row:3,col:5,max:2,req:'p_fury',fx:{haste:3},d:'+#% attack speed'},
   {id:'p_crusader',n:'Crusade',row:4,col:5,req:'p_zeal',opts:[
    {id:'crusader',n:'Crusader Strike',d:'Your attacks have a 20% chance to strike again with holy light for 60%',p:{chance:.2,mul:.6}},
    {id:'purpose',n:'Divine Purpose',d:'Critical strikes deal 20% more damage',p:{critDmg:20}}]},
   {id:'p_wrathful',n:'Retribution',row:5,col:5,req:'p_crusader',opts:[
    {id:'wrathful',n:'Wrathful',d:'Deal 12% more damage to foes under 50% health',p:{at:.5,mul:.12}},
    {id:'vengeance',n:'Vengeance',d:'Holy Nova makes your next Smite deal 25% more',p:{mul:.25}}]},
   {id:'p_radiance',n:'Radiance',row:2,col:6,max:3,sp:{1:{dmg:8,rad:8}},d:'Holy Nova deals #% more damage and reaches #% wider'},
   {id:'p_might',n:'Holy Might',row:3,col:6,max:2,req:'p_radiance',sp:{1:{cd:1}},d:'Holy Nova cooldown #s shorter'},
   {id:'p_conse',n:'Sacred Fire',row:4,col:6,req:'p_might',opts:[
    {id:'consecration',n:'Consecration',d:'Holy Nova leaves burning holy ground for 4 s: 20% a second to every foe in it',p:{dur:4,mul:.2,r:110}},
    {id:'divinestorm',n:'Divine Storm',d:'Holy Nova goes off twice; the second deals 50%',p:{second:.5,delay:.45}}]},
   {id:'p_purge',n:'Purge',row:5,col:6,max:3,req:'p_conse',sp:{1:{dmg:5}},d:'Holy Nova deals #% more damage'},
   {id:'p_wrath',n:'Wrath of Heaven',row:6,col:5,req:['p_searing','p_wrathful','p_purge'],cap:'wrath',p:{every:5,mul:3,r:130},
    d:'Every 5th Smite calls a pillar of light down on the target: 300% to every foe around it.'},
  ]},
 };
 const CLASS_IDS=Object.keys(TREES);
 const listOf=new Map();
 function nodes(cls){
  let l=listOf.get(cls);if(l)return l;
  const t=TREES[cls];l=SHARED.concat(t?t.nodes:[]);listOf.set(cls,l);return l;
 }
 function node(cls,id){return nodes(cls).find(n=>n.id===id)||null;}
 const isChoice=n=>!!n.opts,isCap=n=>!!n.cap;
 const maxOf=n=>isChoice(n)||isCap(n)?1:n.max;
 const sideOf=n=>n.row<2?null:n.col<3?'def':'off';
 const points=prestige=>Math.max(0,Math.min(CAP,Math.floor(+prestige||0)));
 /* a hero's tree as saved: { talent id: rank } with a choice saved as the option's id and a capstone as 1 */
 const rank=(st,id)=>{const v=st&&st[id];return typeof v==='string'?1:Math.max(0,v|0);};
 const pick=(st,id)=>{const v=st&&st[id];return typeof v==='string'?v:null;};
 function spent(st){let t=0;if(st)for(const k in st)t+=rank(st,k);return t;}
 /* a gate counts the points spent in the rows ABOVE the one it guards, as the inspiration's "8 Required" line does */
 function above(st,cls,row){let t=0;for(const m of nodes(cls))if(m.row<row)t+=rank(st,m.id);return t;}
 const full=(st,cls,id)=>{const n=node(cls,id);return !!n&&rank(st,id)>=maxOf(n);};
 function reqMet(st,cls,n){
  if(!n.req)return true;
  return (Array.isArray(n.req)?n.req:[n.req]).some(id=>full(st,cls,id));
 }
 /* may this hero take one more rank of id (opt: the option of a choice)? -> {ok, why} */
 function check(st,cls,id,opt,pts){
  const n=node(cls,id);
  if(!n)return {ok:false,why:'Unknown talent'};
  const r=rank(st,id);
  if(isChoice(n)){
   if(r)return {ok:false,why:pick(st,id)===opt?'Already learned':'You chose the other one - Reset to change'};
   if(!n.opts.some(o=>o.id===opt))return {ok:false,why:'Pick one of the two'};
  }else if(r>=maxOf(n))return {ok:false,why:'Already learned'};
  if(spent(st)>=pts)return {ok:false,why:pts>=CAP?'All 40 points are spent':'No points left - every prestige gives one'};
  if(above(st,cls,n.row)<GATES[n.row])return {ok:false,why:'Needs '+GATES[n.row]+' points spent above it'};
  if(!reqMet(st,cls,n))return {ok:false,why:Array.isArray(n.req)?'Fill one talent above it first':'Fill the talent above it first'};
  if(isCap(n)){const other=nodes(cls).find(m=>isCap(m)&&m!==n&&rank(st,m.id));if(other)return {ok:false,why:'Only one capstone - you hold '+other.n};}
  return {ok:true,why:''};
 }
 function learn(st,cls,id,opt,pts){
  const c=check(st,cls,id,opt,pts);if(!c.ok)return c;
  const n=node(cls,id);
  st[id]=isChoice(n)?opt:isCap(n)?1:rank(st,id)+1;
  return c;
 }
 function reset(st){for(const k of Object.keys(st||{}))delete st[k];return st;}
 /* a saved tree made sound: unknown talents dropped, ranks within their max, nothing held without what it stands on, and no more
    than the hero's points (the bottom rows go first) */
 function normalize(raw,cls,pts=CAP){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!TREES[cls])return out;
  const list=nodes(cls).slice().sort((a,b)=>a.row-b.row||a.col-b.col);
  for(const n of list){
   const v=raw[n.id];
   if(isChoice(n)){if(typeof v==='string'&&n.opts.some(o=>o.id===v))out[n.id]=v;}
   else if(isCap(n)){if(v)out[n.id]=1;}
   else{const r=Math.max(0,Math.min(n.max,Math.floor(+v||0)));if(r)out[n.id]=r;}
  }
  /* down the rows: whatever lost its footing (a gate, the talent above, a second capstone) is handed back. Gates and requirements
     only look upwards, so one pass from the top settles it */
  let caps=0;
  for(const n of list){
   if(!rank(out,n.id))continue;
   if(!reqMet(out,cls,n)||above(out,cls,n.row)<GATES[n.row]||(isCap(n)&&caps++))delete out[n.id];
  }
  /* more spent than the hero holds: hand back from the bottom up, which never knocks out what stands above */
  for(const n of list.slice().reverse()){
   while(spent(out)>pts&&rank(out,n.id)){if(isChoice(n)||isCap(n)||rank(out,n.id)<=1)delete out[n.id];else out[n.id]--;}
  }
  return out;
 }
 /* what the tree adds up to for the game: stat totals, per-spell totals, and the options and capstones taken (with their numbers) */
 function effects(st,cls){
  const out={stat:{},sp:[{},{},{}],on:{}};
  const add=(fx,sp,r)=>{
   if(fx)for(const k in fx)out.stat[k]=(out.stat[k]||0)+fx[k]*r;
   if(sp)for(const i in sp)for(const k in sp[i])out.sp[i][k]=(out.sp[i][k]||0)+sp[i][k]*r;
  };
  if(!st||!TREES[cls])return out;
  for(const n of nodes(cls)){
   const r=rank(st,n.id);if(!r)continue;
   if(isChoice(n)){const o=n.opts.find(x=>x.id===st[n.id]);if(o){out.on[o.id]={...(o.p||{})};add(o.fx,o.sp,1);}}
   else if(isCap(n))out.on[n.cap]={...(n.p||{})};
   else add(n.fx,n.sp,Math.min(r,n.max));
  }
  return out;
 }
 /* the line a talent reads at a rank: '#' is the per-rank value times the rank, several '#' take the values in turn */
 const fmt=v=>{const r=Math.round(v*100)/100;return String(r);};
 function text(n,r){
  if(!n||!n.d)return '';
  if(isChoice(n)||isCap(n)||!n.d.includes('#'))return n.d;
  const vals=[];
  if(n.fx)for(const k in n.fx)vals.push(n.fx[k]);
  if(n.sp)for(const i in n.sp)for(const k in n.sp[i])if(k!=='size')vals.push(n.sp[i][k]);
  if(n.id==='wisdom')vals.length=1;   /* one number stands for mana and its regeneration */
  if(n.id==='p_blessed')vals.length=1;   /* and one for both spells' healing */
  let i=0;
  return n.d.replace(/#/g,()=>fmt((vals[Math.min(i++,vals.length-1)]||0)*Math.max(1,r)));
 }
 const api={CAP,GATES,CD_CUT_MAX,DR_MAX,AVOID_MAX,RESET_LOCK,SHARED,TREES,CLASS_IDS,nodes,node,isChoice,isCap,maxOf,sideOf,points,rank,pick,spent,
  check,learn,reset,normalize,effects,text,reqMet};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.SkillTree=api;
})(typeof window!=='undefined'?window:globalThis);
