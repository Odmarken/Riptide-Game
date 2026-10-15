/* 🐄 THE COW RUN - the Cow Level as a roguelike (asked for 2026-10-15: "gör cow level till en sån där rogue like version där man
   börjar som level 1 ... sen varje level får man en ruta som visar 3 rutor ... få vapen så man kan uppgradera som dom spelen brukar
   va sen ska man kunna få legendary vapenen ... låg chans ... luck ... blåa lådorna ... 20 guld sen bli dyrare och dyrare ... baserat
   på hur länge man överlever ... epic gear").
   This file holds the run's numbers and its cards and nothing that draws: game.js keeps the hero, the herd and the screen.
   A run: the hero walks in at level 1 with nothing on, every cow leaves an XP gem and gold behind, each level stops the herd and
   offers three cards - a stat, a weapon that fires by itself, or (by luck, rarely) Frostseeker or the Fel Glaives - the blue
   chests on the field are bought with the run's gold at a price that climbs, and the time survived pays out in epic gear. */
(function(root){
 'use strict';
 const pct=v=>Math.round(v*1000)/10+'%';
 /* the stats a card can raise; v is one common card's worth (rare x1.5, epic x2). lab + f print the total before and after the card
    ("Damage +24% -> +36%"); icon is one of the game's own pictures */
 const PASSIVES=[
  {id:'might',n:'Might',icon:'assets/icons/heroicstrike.png',g:'⚔️',stat:'dmg',v:0.12,lab:'Damage',f:v=>'+'+pct(v),d:'Every blow and every weapon hits harder'},
  {id:'arcana',n:'Arcana',icon:'assets/icons/fireball.png',g:'✨',stat:'spell',v:0.25,lab:'Spell damage',f:v=>'+'+pct(v),d:'Your class spells strike far harder'},
  {id:'vitality',n:'Vitality',icon:'assets/icons/pot_hp.png',g:'❤️',stat:'hp',v:0.18,lab:'Max health',f:v=>'+'+pct(v),d:'More health to take the herd on'},
  {id:'regen',n:'Regeneration',icon:'assets/icons/renew.png',g:'💚',stat:'regen',v:0.005,lab:'Health / s',f:(v,c)=>'+'+(Math.round((0.003+v)*((c&&c.maxHp)||100)*10)/10),d:'Your wounds close by themselves'},
  {id:'armor',n:'Iron Hide',icon:'assets/icons/pot_armor.png',g:'🛡️',stat:'armor',v:0.06,lab:'Damage taken',f:v=>'-'+pct(Math.min(0.6,v)),d:'Horns and hooves bite less'},
  {id:'crit',n:'Precision',icon:'assets/icons/aimedshot.png',g:'🎯',stat:'crit',v:5,lab:'Crit chance',f:v=>'+'+Math.round(v*10)/10+'%',d:'More blows land as criticals'},
  {id:'haste',n:'Haste',icon:'assets/icons/rapidfire.png',g:'⚡',stat:'haste',v:0.10,lab:'Attack speed',f:v=>'+'+pct(v),d:'Swing, shoot and fire faster - weapons too'},
  {id:'swift',n:'Swiftness',icon:'assets/icons/ui_speed.png',g:'👟',stat:'speed',v:0.08,lab:'Move speed',f:v=>'+'+pct(v),d:'Outrun the stampede'},
  {id:'luck',n:'Luck',icon:'assets/icons/it_luck.png',g:'🍀',stat:'luck',v:12,lab:'Luck',f:v=>'+'+Math.round(v),d:'Rarer cards, extra gold, a better shot at a legendary'},
  {id:'magnet',n:'Magnet',icon:'assets/icons/ui_magnet.png',g:'🧲',stat:'pickup',v:0.40,lab:'Pickup range',f:v=>'+'+pct(v),d:'XP gems fly to you from further off'},
  {id:'vamp',n:'Vampirism',icon:'assets/icons/en_vein.png',g:'🩸',stat:'ls',v:0.006,lab:'Lifesteal',f:v=>pct(v),d:'Every hit, yours and your weapons, heals you'},
  {id:'focus',n:'Focus',icon:'assets/icons/battleshout.png',g:'⏳',stat:'cdr',v:0.10,lab:'Spell recharge',f:v=>'-'+pct(Math.min(0.3,v)),d:'Your class spells come back sooner'},
  {id:'wisdom',n:'Wisdom',icon:'assets/icons/it_book.png',g:'📘',stat:'xp',v:0.12,lab:'XP',f:v=>'+'+pct(v),d:'Level faster, see more cards'},
  {id:'greed',n:'Greed',icon:'assets/icons/it_gold.png',g:'🪙',stat:'gold',v:0.25,lab:'Gold',f:v=>'+'+pct(v),d:'More gold for the blue chests'},
  /* eight more (asked 2026-10-15: "lägg in typ 8 mer powerups och 4 till mer vapen") */
  {id:'thorns',n:'Thorns',icon:'assets/icons/it_armor.png',g:'🌵',stat:'thorns',v:0.5,lab:'Hit back',f:v=>pct(v)+' of attack',d:'A cow that strikes you takes a blow back'},
  {id:'evasion',n:'Evasion',icon:'assets/icons/ui_haste.png',g:'💨',stat:'avoid',v:0.04,lab:'Dodge chance',f:v=>pct(Math.min(0.15,v)),d:'Slip a blow now and then (at most 15%)'},
  {id:'expanse',n:'Expanse',icon:'assets/icons/it_gem.png',g:'💎',stat:'area',v:0.12,lab:'Weapon area',f:v=>'+'+pct(v),d:'Your weapons reach further and hit wider'},
  {id:'barrage',n:'Barrage',icon:'assets/icons/en_gold.png',g:'➕',stat:'proj',v:1,lab:'Projectiles',f:v=>'+'+Math.round(v),d:'One more axe, missile, knife, shard, meteor or beam'},
  {id:'overdrive',n:'Overdrive',icon:'assets/icons/ui_auto.png',g:'⚙️',stat:'wcd',v:0.08,lab:'Weapon cooldown',f:v=>'-'+pct(Math.min(0.5,v)),d:'Your weapons fire more often'},
  {id:'bloodlust',n:'Bloodlust',icon:'assets/icons/it_trinket.png',g:'🩸',stat:'killheal',v:0.004,lab:'Heal per kill',f:v=>pct(v)+' health',d:'Every cow slain mends you'},
  {id:'clarity',n:'Clarity',icon:'assets/icons/pot_mp.png',g:'💧',stat:'mana',v:0.25,lab:'Mana and its regen',f:v=>'+'+pct(v),d:'More mana for your class spells, back faster'},
  /* two that act by themselves (asked 2026-10-15: "ett totem som gör area effects tickande dmg och en som skjuter saker blåa bollar");
     v is their power - one card's worth, more with rarity and every level; totemStats/orbStats turn it into numbers */
  {id:'totem',n:'War Totem',icon:'assets/icons/ui_torch.png',g:'🗿',stat:'totem',v:1,lab:'Damage / tick',f:v=>v?Math.round(totemStats(v).dmg*100)+'%':'–',d:'Plants a totem where you stand that burns every cow around it',
   more:(a,b)=>[{lab:'Reach',from:a?Math.round(totemStats(a).rad):'–',to:Math.round(totemStats(b).rad)},{lab:'Totems',from:a?totemStats(a).max:'–',to:totemStats(b).max}]},
  {id:'orb',n:'Storm Orb',icon:'assets/icons/en_frost.png',g:'🔵',stat:'orb',v:1,lab:'Damage / ball',f:v=>v?Math.round(orbStats(v).dmg*100)+'%':'–',d:'Blue orbs circle you and shoot blue balls at the herd',
   more:(a,b)=>[{lab:'Orbs',from:a?orbStats(a).n:'–',to:orbStats(b).n},{lab:'Every',from:a?(Math.round(orbStats(a).cd*100)/100)+' s':'–',to:(Math.round(orbStats(b).cd*100)/100)+' s'}]},
  {id:'haggler',n:'Haggler',icon:'assets/icons/it_chest.png',g:'💰',stat:'discount',v:0.10,lab:'Chests and rerolls',f:v=>'-'+pct(Math.min(0.6,v)),d:'The blue chests and rerolls cost less'},
 ];
 /* the weapons that fire by themselves; dmg is a share of the hero's attack */
 const WEAPONS=[
  {id:'axes',n:'Whirling Axes',icon:'assets/icons/whirlwind.png',g:'🪓',d:'Burning axes circle you and cut all they touch'},
  {id:'bolt',n:'Arcane Missiles',icon:'assets/icons/arcanebarrage.png',g:'🔮',d:'Violet missiles hunt the nearest cows'},
  {id:'aura',n:'Consecration',icon:'assets/icons/holynova.png',g:'☀️',d:'A holy rune circle burns every cow inside it'},
  {id:'chain',n:'Storm Chain',icon:'assets/icons/en_storm.png',g:'🌩️',d:'Lightning leaps from cow to cow'},
  {id:'nova',n:'Frost Nova',icon:'assets/icons/frostnova.png',g:'❄️',d:'A blast of frost hurts and slows all near you'},
  {id:'knives',n:'Fan of Knives',icon:'assets/icons/multishot.png',g:'🗡️',d:'A fan of knives flies the way you face and pierces'},
  {id:'meteor',n:'Meteor Storm',icon:'assets/icons/en_ember.png',g:'☄️',d:'Burning rocks fall on the herd and burst'},
  {id:'cleave',n:'Cleaving Arc',icon:'assets/icons/it_weapon.png',g:'⚔️',d:'A great sweep of steel cuts everything in front of you'},
  {id:'plague',n:'Plague Cloud',icon:'assets/icons/it_emerald.png',g:'☣️',d:'Poison clouds settle among the cows and eat at them'},
  {id:'judgement',n:'Judgement',icon:'assets/icons/smite.png',g:'🔨',d:'Pillars of light strike the toughest cows near you'},
 ];
 /* the two legendaries, rare as they are in the world: one per run, in the hero's hand */
 const LEGENDS=[
  {id:'frostseeker',n:'Frostseeker',icon:'assets/models/frostseeker.png',g:'❄️',d:'A ring of ice shards bursts out of you again and again, slowing all it pierces',bonus:['+25% damage','+5% crit']},
  {id:'felglaives',n:'Fel Glaives',icon:'assets/models/felglaive.png',g:'🌀',d:'Two burning fel glaives circle you wide and fast',bonus:['+20% attack speed','+3% lifesteal']},
 ];
 /* the "?" on a card (asked 2026-10-15: "ett fråge tecken till höger uppe i varje kort som man klickar på visar vad själva powerupen
    gör"): how each one works, in a sentence or two beyond the card's own line */
 const HELP={
  might:'Raises all damage you deal - your swings, your class spells, every weapon, the totem and the orbs.',
  arcana:'Only your class spells (the 1-2-3 buttons) hit harder. Weapons are not spells.',
  vitality:'Raises your maximum health. Every level of the run adds health as well.',
  regen:'Heals you a little every second, on top of the slow mend every hero has in the run.',
  armor:'Every blow a cow lands on you is made smaller. Stops at 60% less.',
  crit:'Chance that a hit lands as a critical for 70% extra. Counts for weapons, totem and orbs too.',
  haste:'Your basic attack swings or shoots faster, and your weapons fire a little more often.',
  swift:'You walk faster - the best way to stay out of the herd.',
  luck:'Rare and epic cards come more often, a cow may drop a second coin, and the slim chance of a legendary grows.',
  magnet:'XP gems are pulled to you from further away.',
  vamp:'A share of all the damage you deal comes back as health.',
  focus:'Your class spells recharge faster. Stops at 30%.',
  wisdom:'Every XP gem counts for more, so you level and see cards more often.',
  greed:'More gold from every cow, for the blue chests and rerolls.',
  thorns:'Each time a cow hits you it takes a blow back - a share of your own attack, crits not included.',
  evasion:'A chance to slip a blow completely. Stops at 15%.',
  expanse:'Widens every weapon that has a reach: the axes\' circle, Consecration, Frost Nova, meteors, clouds, the cleave and the totem.',
  barrage:'Adds to every weapon that fires several things: axes, missiles, knives, shards, meteors, Judgement beams - and one more orb and one more totem.',
  overdrive:'Every weapon with a cooldown fires sooner, and the totem is planted sooner. Stops at 50%.',
  bloodlust:'Each cow you kill heals you a share of your maximum health.',
  clarity:'More mana for your class spells, and it comes back faster.',
  haggler:'The blue chests and rerolls cost less gold. Stops at 60%.',
  totem:'Every few seconds a totem is planted beside you. It stands a while and burns every cow in its ring twice a second. Grows with Might, Expanse, Overdrive and Barrage.',
  orb:'Blue orbs circle your shoulders and each shoots a blue ball at the nearest cow. Grows with Might, Overdrive and Barrage.',
  axes:'Axes circle you all the time; each cuts a cow it touches, then again a moment later.',
  bolt:'Fires missiles at the nearest cows on a cooldown. They follow their target.',
  aura:'A holy circle around you burns every cow inside it twice a second.',
  chain:'A bolt jumps from the nearest cow to the next, and on - more jumps with every level.',
  nova:'A blast around you on a cooldown: damage and a slow on everything near.',
  knives:'Knives fly the way you are facing and pierce through several cows.',
  meteor:'Rocks fall on cows near you; a red ring shows where, and everything in the blast is hit.',
  cleave:'A wide sweep in front of you, the way you face, hitting all it reaches.',
  plague:'Poison clouds settle among the cows and hurt everything inside for a few seconds.',
  judgement:'Pillars of light strike the cows with the most health near you - good against the Alphas and the Alpha Bulls.',
  frostseeker:'Your legendary: a ring of ice shards bursts out of you again and again, slowing what it pierces. It also gives +25% damage and +5% crit.',
  felglaives:'Your legendary: two burning glaives circle you wide and fast. It also gives +20% attack speed and +3% lifesteal.',
 };
 /* what a weapon's next level changes, as card lines */
 const W_LAB=[['n','Count',v=>v],['jumps','Jumps',v=>v],['dmg','Damage',v=>Math.round(v*100)+'%'],['cd','Every',v=>(Math.round(v*100)/100)+' s'],
  ['rad','Reach',v=>Math.round(v)],['pierce','Pierces',v=>v],['slow','Slow',v=>v+' s'],['spin','Spin',v=>(Math.round(v*10)/10)]];
 /* b: the rarity bonus the weapon already has, add: what this card brings - both multiply its damage */
 function weaponLines(id,lvl,b,add){
  b=b||0;add=add||0;
  const now=lvl>1?{...weaponStats(id,lvl-1)}:null,next={...weaponStats(id,lvl)},out=[];
  if(now)now.dmg*=1+b;
  next.dmg*=1+b+add;
  if(add)out.push({lab:'Bonus',to:'+'+Math.round(add*100)+'% damage'});
  for(const [k,lab,f] of W_LAB){
   if(next[k]===undefined)continue;
   if(!now)out.push({lab,to:f(next[k])});
   else if(f(now[k])!==f(next[k]))out.push({lab,from:f(now[k]),to:f(next[k])});
  }
  return out.slice(0,4);
 }
 /* a weapon that would replace the one in hand, set against it line by line: yours -> the new one (asked 2026-10-15: "visa också
    vad mitt vapen har i jämförelse"); '-' where one of the two has no such number */
 function compareLines(run,old,id,add){
  const cur={...weaponStats(old,run.w[old])},next={...weaponStats(id,1)},out=[];
  cur.dmg*=1+((run.wb||{})[old]||0);next.dmg*=1+add;
  for(const [k,lab,f] of W_LAB){
   if(cur[k]===undefined&&next[k]===undefined)continue;
   out.push({lab,from:cur[k]===undefined?'–':f(cur[k]),to:next[k]===undefined?'–':f(next[k])});
  }
  out.sort((x,y)=>(x.lab==='Damage'?-1:0)-(y.lab==='Damage'?-1:0));
  return out.slice(0,4);
 }
 /* a weapon or spell card's rarity, as extra damage on top of its level (asked 2026-10-15: "kommer en spell som common kanske den
    ökar med 10% bara medans kommer den som rare ger den typ 25% osv") */
 const WEAPON_RARITY={common:0.10,rare:0.25,epic:0.50};
 const LEGEND_PASSIVE={frostseeker:{dmg:0.25,crit:5},felglaives:{haste:0.20,ls:0.03}};
 /* one weapon and four power-ups at a time (asked 2026-10-15: "högst 1 vapen och 4 powerups så måste man isåfall replace dom"):
    a new one when the slots are full replaces one, and its card says which */
 /* and no top level (asked 2026-10-15: "jag vill att de ska kunna gå oändligt"): a weapon, a power-up or a legendary levels for as
    long as the run lasts - the weapons' counts, reach and speed level off at a ceiling, their damage never does */
 const MAX_LVL=Infinity,MAX_WEAPONS=2,MAX_PASSIVES=6;   /* two weapon slots, the legendary one of them (2026-10-15: "2 vapen och legendary ska vara 1 av dom att kunna byta ut") */
 const armed=run=>Object.keys(run.w).length+(run.leg?1:0);   /* weapon slots in use */   /* six since 2026-10-15 ("gör så man kan ha 6 powerups aktiva") */
 const RARITY={common:1,rare:1.5,epic:2};
 const byId=id=>PASSIVES.find(p=>p.id===id)||WEAPONS.find(w=>w.id===id)||LEGENDS.find(l=>l.id===id)||null;

 function newRun(){
  return {lvl:1,xp:0,kills:0,gold:0,goldTotal:0,chestsBought:0,rerolls:0,t:0,
   m:{},          /* stat -> total the cards gave */
   p:{},          /* passive id -> level */
   w:{},          /* weapon id -> level */
   pv:{},         /* passive id -> the stat its cards added, taken back if it is replaced */
   wb:{},         /* weapon id -> the damage its cards' rarities added (+10% common, +25% rare, +50% epic) */
   leg:null};     /* {id,lvl} once a legendary is in the hand */
 }
 /* XP for the next level: 3 cows to level 2, then a slowly steeper climb */
 const xpNeed=l=>Math.round(3+(l-1)*2.5+Math.pow(l-1,2)*0.3);
 /* a blue chest costs 20 gold, then 40, 70, 110, 160... */
 const chestPrice=(n,disc)=>Math.max(1,Math.round((20+15*n+5*n*n)*(1-Math.min(0.6,disc||0))));
 /* the herd grows with the clock, not with the hero: soft at the start, savage after ten minutes */
 /* after 20 minutes the stampede: everything grows on the square of the minutes past, so every run ends */
 const stampede=t=>t>1200?1+Math.pow((t-1200)/60,2)*0.05:1;
 const cowHp=t=>Math.round(14*Math.pow(1+t/60*0.5,1.6)*stampede(t));
 const cowAtk=t=>Math.round(3*Math.pow(1+t/60*0.35,1.6)*stampede(t));
 const cowSpeedMul=t=>Math.min(1.25,0.72+t*0.0009);
 const spawnGap=t=>Math.max(0.09,1.4/(1+t/60*1.0));
 const cowCap=t=>Math.min(150,20+Math.floor(t/3));
 const ALPHA_FIRST=60,ALPHA_GAP=45;
 /* the Alpha Bull, a boss every three minutes (asked 2026-10-15: "en alpha som boss var 3e minut, som är tuff och varje boss blir
    tuffare och tuffare ... rödare och rödare"): tier n has the clock's cow times 60, half again per tier, hits four times as hard and
    a quarter more per tier, slams the ground more often, and pays a free chest */
 const BOSS_GAP=180;
 const bossStats=(n,t)=>({hp:Math.round(cowHp(t)*60*Math.pow(1.5,n-1)),atk:Math.round(cowAtk(t)*4*Math.pow(1.25,n-1)),
  slam:Math.max(2.2,5-0.4*(n-1)),slamRad:Math.min(190,110+12*n),r:Math.min(70,48+4*n),xp:40*n,gold:40*n,red:Math.min(1,0.25+0.15*n)});
 /* what the herd pays out at the end: one epic every 45 seconds survived, at most 30 */
 const rewardEpics=t=>Math.max(0,Math.min(30,Math.floor(t/45)));

 /* a weapon at its level: how often it goes off, how hard (x the hero's attack), how many, how far */
 function weaponStats(id,lvl){
  const L=Math.max(1,lvl|0),up=L-1,past=Math.max(0,L-5),early=a=>a[Math.min(4,up)];   /* the first five as tuned, then on to a ceiling */
  switch(id){
   case 'axes':return {n:Math.min(8,early([1,2,2,3,4])+Math.floor(past/2)),rad:Math.min(170,75+L*6),spin:Math.min(6,3+up*0.25),dmg:0.8*(1+0.2*up),hitGap:0.45};
   case 'bolt':return {cd:Math.max(0.35,1.3-0.15*up),n:Math.min(8,early([1,1,2,2,3])+Math.floor(past/2)),dmg:1.0*(1+0.25*up),speed:520,range:430};
   case 'aura':return {rad:Math.min(240,60+L*14),tick:0.5,dmg:0.35*(1+0.3*up)};
   case 'chain':return {cd:Math.max(0.8,2.2-0.2*up),jumps:Math.min(14,2+L),dmg:1.2*(1+0.2*up),reach:150};
   case 'nova':return {cd:Math.max(1.5,5-0.5*up),rad:Math.min(330,130+15*L),dmg:1.5*(1+0.25*up),slow:1.5};
   case 'knives':return {cd:Math.max(0.55,1.0-0.05*past),n:Math.min(12,early([2,3,4,5,6])+past),dmg:0.7*(1+0.2*up),pierce:Math.min(6,2+Math.floor(past/3)),speed:560,range:420};
   case 'frostseeker':return {cd:Math.max(0.5,1.6-0.15*up),n:Math.min(20,6+L),dmg:1.4*(1+0.25*up),speed:480,range:380,slow:2};
   case 'meteor':return {cd:Math.max(1.2,3-0.25*up),n:Math.min(8,early([1,1,2,2,3])+Math.floor(past/2)),rad:Math.min(150,70+6*L),dmg:2.2*(1+0.25*up),fall:0.55};
   case 'cleave':return {cd:Math.max(0.45,1.4-0.12*up),rad:Math.min(200,95+8*L),arc:Math.min(3.6,1.8+0.2*up),dmg:1.1*(1+0.22*up)};
   case 'plague':return {cd:Math.max(1.2,3.2-0.25*up),n:Math.min(5,1+Math.floor(up/2)),rad:Math.min(160,60+8*L),dur:Math.min(8,3+0.5*up),tick:0.5,dmg:0.3*(1+0.25*up)};
   case 'judgement':return {cd:Math.max(1,3.2-0.3*up),n:Math.min(8,early([1,1,2,2,3])+Math.floor(past/2)),dmg:3*(1+0.25*up)};
   case 'felglaives':return {n:Math.min(4,2+Math.floor(past/3)),rad:Math.min(180,130+past*5),spin:Math.min(8,4.2+up*0.3),dmg:1.3*(1+0.25*up),hitGap:0.35};
  }
  return null;
 }

 /* the War Totem at its power: planted every gap seconds, standing dur, burning in a ring every tick; more power, more at once */
 function totemStats(v){const k=Math.max(1,v);return {gap:Math.max(2.5,6-0.35*(k-1)),dur:Math.min(9,5+0.4*(k-1)),rad:Math.min(220,110+10*k),tick:0.5,dmg:0.4*(1+0.5*(k-1)),max:Math.min(4,1+Math.floor(k/3))};}
 /* the Storm Orb at its power: how many circle the hero, how often each shoots, how hard */
 function orbStats(v){const k=Math.max(1,v);return {n:Math.min(4,1+Math.floor((k-1)/2.5)),cd:Math.max(0.35,1.1-0.08*(k-1)),dmg:0.6*(1+0.3*(k-1)),speed:600,range:460};}
 /* the card for one choice, as the screen shows it: lines are {lab,from,to} - what it changes */
 function cardOf(run,kind,id,rar,ctx){
  if(kind==='passive'){
   const p=byId(id),lvl=(run.p[id]||0)+1,v=p.v*RARITY[rar],cur=run.m[p.stat]||0;
   const full=lvl===1&&Object.keys(run.p).length>=MAX_PASSIVES;
   return {kind,id,rar,lvl,n:p.n,g:p.g,icon:p.icon,v,d:p.d,isNew:lvl===1,replaces:full?'choose':null,lines:[{lab:p.lab,from:p.f(cur,ctx),to:p.f(cur+v,ctx)},...(p.more?p.more(cur,cur+v):[])]};
  }
  if(kind==='weapon'){
   const w=byId(id),lvl=(run.w[id]||0)+1,add=WEAPON_RARITY[rar]||WEAPON_RARITY.common;
   const full=lvl===1&&armed(run)>=MAX_WEAPONS;
   return {kind,id,rar:WEAPON_RARITY[rar]?rar:'common',lvl,n:w.n,g:w.g,icon:w.icon,d:w.d,isNew:lvl===1,bonus:add,replaces:full?'chooseW':null,
    lines:weaponLines(id,lvl,(run.wb||{})[id]||0,add)};
  }
  if(kind==='legend'){
   const l=byId(id),lvl=run.leg&&run.leg.id===id?run.leg.lvl+1:1;
   const full=lvl===1&&armed(run)>=MAX_WEAPONS;
   return {kind,id,rar:'legendary',lvl,n:l.n,g:l.g,icon:l.icon,d:l.d,isNew:lvl===1,replaces:full?'chooseW':null,lines:lvl===1?l.bonus.map(b=>({lab:'',to:b})):weaponLines(id,lvl)};
  }
  if(kind==='heal')return {kind,id:'heal',rar:'common',lvl:0,n:'Second Wind',g:'🍖',icon:'assets/icons/pot_hp.png',d:'Catch your breath',lines:[{lab:'Heal',to:'40% health'}]};
  return {kind:'coins',id:'coins',rar:'common',lvl:0,n:'Purse',g:'💰',icon:'assets/icons/it_pouch.png',d:'A cow was carrying it',lines:[{lab:'Gold',to:'+30'}]};
 }
 /* a reroll costs the run's gold: 15, 30, 45... */
 const rerollPrice=(n,disc)=>Math.max(1,Math.round(15*(n+1)*(1-Math.min(0.6,disc||0))));

 /* three cards: owned things that can still grow are a little likelier than new ones; luck lifts the rarity and the slim chance of a
    legendary; a chest is generous on both */
 function rollCards(run,rnd,opts){
  rnd=rnd||Math.random;opts=opts||{};
  const luck=(run.m.luck||0)+(opts.chest?25:0);
  const nP=Object.keys(run.p).length,nW=armed(run);
  const pool=[];
  for(const p of PASSIVES){const l=run.p[p.id]||0;if(l>=MAX_LVL)continue;pool.push({kind:'passive',id:p.id,w:l?1.6:nP>=MAX_PASSIVES?0.35:1});}   /* full: a newcomer is rarer, and replaces one */
  for(const w of WEAPONS){const l=run.w[w.id]||0;if(l>=MAX_LVL)continue;pool.push({kind:'weapon',id:w.id,w:l?2.2:nW>=MAX_WEAPONS?0.35:2.4});}
  if(run.leg&&run.leg.lvl<MAX_LVL)pool.push({kind:'legend',id:run.leg.id,w:1.4});
  const legChance=run.leg?0:(0.008+luck*0.0006)*(opts.chest?4:1);
  const cards=[];
  for(let i=0;i<3;i++){
   if(!run.leg&&rnd()<legChance&&!cards.some(c=>c.kind==='legend')){
    const l=LEGENDS[Math.floor(rnd()*LEGENDS.length)];cards.push(cardOf(run,'legend',l.id,'legendary',opts));continue;
   }
   const left=pool.filter(o=>!cards.some(c=>c.kind===o.kind&&c.id===o.id));
   if(!left.length)break;
   let sum=0;for(const o of left)sum+=o.w;
   let r=rnd()*sum,pick=left[left.length-1];
   for(const o of left){r-=o.w;if(r<=0){pick=o;break;}}
   let rar='common';
   if(pick.kind==='passive'||pick.kind==='weapon'){   /* stats, weapons and spells alike: legendaries stand apart */
    const q=rnd();
    if(q<0.03+luck*0.0015+(opts.chest?0.10:0))rar='epic';
    else if(q<0.18+luck*0.004+(opts.chest?0.25:0))rar='rare';
   }
   cards.push(cardOf(run,pick.kind,pick.id,rar,opts));
  }
  if(cards.length<3&&!cards.some(c=>c.kind==='heal'))cards.push(cardOf(run,'heal'));
  if(cards.length<3)cards.push(cardOf(run,'coins'));
  return cards;
 }

 /* the card is taken: returns what the screen should do besides ('heal', 'coins', or the legendary's id to put in the hand) */
 function apply(run,card){
  if(card.kind==='passive'){
   const p=byId(card.id);
   if(!run.p[card.id]&&Object.keys(run.p).length>=MAX_PASSIVES){   /* full: out goes the one the player chose (card.out), or the first */
    const out=run.p[card.out]?card.out:Object.keys(run.p)[0];remove(run,'passive',out);
   }
   run.p[card.id]=(run.p[card.id]||0)+1;
   run.m[p.stat]=(run.m[p.stat]||0)+card.v;
   run.pv=run.pv||{};run.pv[card.id]=(run.pv[card.id]||0)+card.v;
   return null;
  }
  if(card.kind==='weapon'){
   if(!run.w[card.id]&&armed(run)>=MAX_WEAPONS)dropWeapon(run,card.out);
   run.w[card.id]=(run.w[card.id]||0)+1;
   run.wb=run.wb||{};run.wb[card.id]=(run.wb[card.id]||0)+(card.bonus||WEAPON_RARITY.common);
   return null;
  }
  if(card.kind==='legend'){
   if(run.leg&&run.leg.id===card.id){run.leg.lvl++;return null;}
   if(run.leg)return null;
   if(armed(run)>=MAX_WEAPONS)dropWeapon(run,run.w[card.out]?card.out:null);
   run.leg={id:card.id,lvl:1};
   for(const [k,v] of Object.entries(LEGEND_PASSIVE[card.id]||{}))run.m[k]=(run.m[k]||0)+v;
   return card.id;
  }
  if(card.kind==='coins'){run.gold+=30;run.goldTotal+=30;return 'coins';}
  return 'heal';
 }
 /* a weapon slot is freed for a newcomer: the one the player chose (a weapon or the legendary), or the first weapon */
 function dropWeapon(run,out){
  if(run.leg&&out===run.leg.id){remove(run,'legend',out);return;}
  remove(run,'weapon',run.w[out]?out:Object.keys(run.w)[0]);
 }
 /* a weapon or a power-up leaves the run: its levels, its rarity bonus and every bit of stat its cards gave go with it */
 function remove(run,kind,id){
  if(kind==='weapon'){delete run.w[id];if(run.wb)delete run.wb[id];return;}
  if(kind==='legend'){   /* the legendary goes, and the damage, crit, speed or lifesteal it carried with it */
   if(!run.leg||run.leg.id!==id)return;
   for(const [k,v] of Object.entries(LEGEND_PASSIVE[id]||{})){run.m[k]=(run.m[k]||0)-v;if(Math.abs(run.m[k])<1e-9)delete run.m[k];}
   run.leg=null;return;
  }
  const p=byId(id);if(!p||!run.p[id])return;
  run.m[p.stat]=(run.m[p.stat]||0)-((run.pv&&run.pv[id])||0);
  if(Math.abs(run.m[p.stat])<1e-9)delete run.m[p.stat];
  delete run.p[id];if(run.pv)delete run.pv[id];
 }
 /* XP in; how many levels came of it */
 function gainXp(run,amt){
  run.xp+=amt*(1+(run.m.xp||0));
  let ups=0;
  while(run.xp>=xpNeed(run.lvl)){run.xp-=xpNeed(run.lvl);run.lvl++;ups++;}
  return ups;
 }
 /* gold from one cow: one coin, more with greed, and luck's chance of a second */
 function goldFor(run,base,rnd){
  rnd=rnd||Math.random;
  let g=base*(1+(run.m.gold||0));
  if(rnd()*100<(run.m.luck||0))g+=base;
  g=Math.max(1,Math.round(g));
  run.gold+=g;run.goldTotal+=g;
  return g;
 }
 /* the bottom bar's line: what the run has made of the hero, terse */
 function summary(run){
  const parts=[];
  if(run.leg)parts.push(byId(run.leg.id).g+' '+byId(run.leg.id).n+' '+run.leg.lvl);
  for(const [id,l] of Object.entries(run.w))parts.push(byId(id).g+' '+l);
  for(const [id,l] of Object.entries(run.p))parts.push(byId(id).g+' '+l);
  return parts.join(' · ');
 }
 const api={PASSIVES,WEAPONS,LEGENDS,LEGEND_PASSIVE,MAX_LVL,MAX_WEAPONS,MAX_PASSIVES,RARITY,ALPHA_FIRST,ALPHA_GAP,
  byId,remove,armed,newRun,HELP,BOSS_GAP,bossStats,totemStats,orbStats,xpNeed,chestPrice,rerollPrice,weaponLines,WEAPON_RARITY,stampede,cowHp,cowAtk,cowSpeedMul,spawnGap,cowCap,rewardEpics,weaponStats,rollCards,apply,gainXp,goldFor,summary};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CowRun=api;
})(typeof window!=='undefined'?window:globalThis);
