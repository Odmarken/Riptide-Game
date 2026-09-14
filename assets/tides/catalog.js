/* The Tides bestiary. Art cells use a three-column, two-row atlas. */
(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  root.TidesCatalog = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const groups = [
    [
      ['meadowmouse', 'Meadow Mouse', 'A brave field mouse with a lantern-bright tail.', 0.96, 1.04, 'Seedburst', 'Scatter seeds for damage and a small protective shell.', {damage: 1.3, shield: 0.55}],
      ['bramblebunny', 'Bramble Bunny', 'A nimble rabbit sheltered by soft bramble leaves.', 1.02, 0.98, 'Bramble Supper', 'Nibble healing berries, then give a quick kick.', {damage: 1.2, heal: 0.12}],
      ['pebbletoad', 'Pebble Toad', 'A patient little toad with a stony crown.', 1.1, 0.92, 'Riverstone Guard', 'Build a sturdy shield and strengthen the next two attacks.', {shield: 1.5, buff: 0.4, buffTurns: 2}],
      ['thistlesparrow', 'Thistle Sparrow', 'A fearless songbird that nests in wild thistles.', 0.91, 1.09, 'Needle Dive', 'Dive for heavy damage with a small recoil.', {damage: 2.1, recoil: 0.25}],
      ['amberbeetle', 'Amber Beetle', 'An amber-shelled beetle carrying a droplet of sap.', 1.06, 0.96, 'Sticky Sap', 'Strike and leave sap that stings for two turns.', {damage: 1.15, poison: 0.38, poisonTurns: 2}]
    ],
    [
      ['mossfox', 'Moss Fox', 'A russet fox with moss-soft ears and clever eyes.', 0.98, 1.02, 'Moss Mirage', 'Lash out behind a mossy decoy.', {damage: 1.15, shield: 0.7}],
      ['reedotter', 'Reed Otter', 'A playful river otter wearing a crown of reeds.', 1.03, 0.98, 'Ripple Remedy', 'Wash away poison, heal, and splash the opponent.', {damage: 1.1, heal: 0.12, cleanse: true}],
      ['duskmoth', 'Dusk Moth', 'A velvety moth dusted with the colors of sunset.', 0.94, 1.06, 'Drowsy Dust', 'Deal light damage and weaken the next two enemy attacks.', {damage: 1.3, weaken: 0.3, weakenTurns: 2}],
      ['shellsnap', 'Shellsnap', 'A determined terrapin with a sea-glass shell.', 1.11, 0.91, 'Shell Counter', 'Brace behind a shell and prepare one fierce counterattack.', {shield: 1.3, buff: 0.7, buffTurns: 1}],
      ['acornboar', 'Acorn Boar', 'A sturdy woodland boar with polished acorn tusks.', 1.07, 0.94, 'Acorn Charge', 'Charge hard, growing stronger at low health.', {damage: 1.7, missingHpBonus: 0.45}]
    ],
    [
      ['embercub', 'Ember Cub', 'A bold lion cub with ember-tipped paws and a fiery mane.', 1.04, 0.97, 'Cinder Pounce', 'Pounce and kindle an ember that burns next turn.', {damage: 1.35, poison: 0.45, poisonTurns: 1}],
      ['moonowl', 'Moon Owl', 'A silver-feathered owl carrying the hush of midnight.', 0.96, 1.04, 'Moonlit Renewal', 'Heal beneath moonlight and guard against the next blow.', {heal: 0.2, shield: 0.7}],
      ['crystalgecko', 'Crystal Gecko', 'A climbing gecko with a rainbow of crystal scales.', 1.0, 1.0, 'Prism Split', 'Send two sparkling shards through part of a shield.', {damage: 1.7, pierce: 0.55, hits: 2}],
      ['stormlynx', 'Storm Lynx', 'A quick-footed lynx with crackling whiskers.', 0.9, 1.1, 'Thunder Focus', 'Strike lightly and charge the next two attacks.', {damage: 1.1, buff: 0.42, buffTurns: 2}],
      ['thornbadger', 'Thorn Badger', 'A stubborn badger protected by a cloak of thorns.', 1.1, 0.92, 'Thorn Ward', 'Grow a shield whose thorns sting for two turns.', {shield: 1.1, poison: 0.4, poisonTurns: 2}]
    ],
    [
      ['cinderwolf', 'Cinder Wolf', 'A fierce ash-gray wolf with blazing fangs and a mane of flame.', 0.98, 1.03, 'Packfire Howl', 'A fiery howl empowers three attacks and raises a thin ward.', {buff: 0.5, buffTurns: 3, shield: 0.65}],
      ['frostibex', 'Frost Ibex', 'A sure-footed ibex with ice-carved horns.', 1.06, 0.96, 'Glacier Horn', 'Gore the opponent and frost over their next attack.', {damage: 1.35, weaken: 0.4, weakenTurns: 1}],
      ['sunmane', 'Sunmane', 'A golden lion whose mane shines with the dawn.', 1.0, 1.01, 'Solar Roar', 'Roar for damage and restore a little health.', {damage: 1.2, heal: 0.1}],
      ['runestag', 'Rune Stag', 'An ancient stag with luminous runes on its antlers.', 1.08, 0.94, 'Antler Aegis', 'Purge poison, recover health, and raise a runic shield.', {heal: 0.12, shield: 1.0, cleanse: true}],
      ['coraldrake', 'Coral Drake', 'A small reef dragon with coral-pink fins.', 0.95, 1.06, 'Reef Venom', 'Bite and inflict lingering venom for three turns.', {damage: 0.65, poison: 0.4, poisonTurns: 3}]
    ],
    [
      ['dawnphoenix', 'Dawn Phoenix', 'A radiant phoenix that greets every sunrise anew.', 0.95, 1.06, 'Dawn Rekindling', 'Release a warm flare and recover more health when wounded.', {damage: 0.8, heal: 0.11, missingHeal: 0.1}],
      ['obsidianbear', 'Obsidian Bear', 'A towering bear with glossy volcanic armor.', 1.12, 0.9, 'Obsidian Slam', 'Slam the ground and raise a slab of dark stone.', {damage: 1.1, shield: 0.65}],
      ['aurorakirin', 'Aurora Kirin', 'A rare antlered creature trailed by ribbons of light.', 1.01, 1.0, 'Aurora Grace', 'Restore health and strengthen the next two attacks.', {heal: 0.16, buff: 0.5, buffTurns: 2}],
      ['spectralpanther', 'Spectral Panther', 'An elusive blue spirit panther with icy fangs and a spectral gaze.', 0.93, 1.08, 'Veil Siphon', 'Pass partly through shields and drain health from the hit.', {damage: 1.3, drain: 0.32, pierce: 0.4}],
      ['spectralwyrm', 'Spectral Wyrm', 'A translucent sky serpent rarely seen beyond the veil.', 1.05, 0.96, 'Astral Coil', 'Coil in a spirit ward and release piercing astral fire.', {damage: 1.1, shield: 0.55, pierce: 0.25}]
    ]
  ];
  const attacks = [
    ['Quick Bite', 'melee', '#c7db73'], ['Bramble Kick', 'melee', '#84b86b'], ['Stone Headbutt', 'melee', '#97a899'],
    ['Talon Slash', 'melee', '#c9a9d9'], ['Amber Pincer', 'melee', '#edbb54'], ['Fang Lunge', 'melee', '#96bc75'],
    ['River Claw', 'melee', '#77cfdb'], ['Dusk Bolt', 'magic', '#bc8ddc'], ['Shell Bite', 'melee', '#83b9b4'],
    ['Tusk Strike', 'melee', '#c89664'], ['Ember Claw', 'melee', '#f9975b'], ['Lunar Talon', 'melee', '#bcc7ff'],
    ['Crystal Bolt', 'magic', '#a6ece9'], ['Lightning Claw', 'melee', '#9ecbff'], ['Thorn Swipe', 'melee', '#a1bb63'],
    ['Burning Fang', 'melee', '#fb7859'], ['Frozen Gore', 'melee', '#95dff4'], ['Golden Claw', 'melee', '#ffcf70'],
    ['Rune Bolt', 'magic', '#9fe6c1'], ['Reef Bite', 'melee', '#ff998a'], ['Dawnfire', 'magic', '#ffc36c'],
    ['Obsidian Claw', 'melee', '#ac98c6'], ['Aurora Bolt', 'magic', '#a3f5dd'], ['Spectral Fang', 'melee', '#c099ff'],
    ['Spirit Breath', 'magic', '#9edcfa']
  ];
  const meleePowers = new Set(['thistlesparrow', 'acornboar', 'embercub', 'frostibex', 'obsidianbear', 'spectralpanther']);
  const visualScales = {
    meadowmouse:.78, bramblebunny:1, pebbletoad:.82, thistlesparrow:.78, amberbeetle:.75,
    mossfox:1.12, reedotter:1.05, duskmoth:.9, shellsnap:.95, acornboar:1.2,
    embercub:1.15, moonowl:1.05, crystalgecko:1.05, stormlynx:1.25, thornbadger:1.08,
    cinderwolf:1.35, frostibex:1.45, sunmane:1.5, runestag:1.6, coraldrake:1.45,
    dawnphoenix:1.65, obsidianbear:1.8, aurorakirin:1.65, spectralpanther:1.4, spectralwyrm:2.1
  };
  return Object.freeze(groups.flatMap((group, groupIndex) => group.map((row, cell) => {
    const [id, name, description, hpScale, attackScale, skillName, skillDescription, effects] = row;
    const stars = groupIndex + 1, spectral = id.startsWith('spectral');
    const [attackName, attackStyle, color] = attacks[groupIndex * 5 + cell];
    return Object.freeze({id, name, description, stars, spectral, hpScale, attackScale, visualScale:visualScales[id],
      sheet: 'assets/tides/tides-' + stars + '.png', cell, columns: 3, rows: 2,
      encounterWeight: spectral ? 2 : [0, 1200, 520, 220, 53, 31 / 3][stars],
      attack: Object.freeze({name: attackName, description: 'A reliable strike. Reduces power cooldown by one turn.', style: attackStyle, color}),
      skill: Object.freeze({name: skillName, description: skillDescription, style: meleePowers.has(id) ? 'melee' : 'magic', color, cooldown: 2, ...effects})});
  })));
});
