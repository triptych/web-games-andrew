// HOLLOWDEEP — classes, their skills, recruit names and the portrait pool. Pure data.
//
// Stats at level 1, and what a level adds (fractional growth accumulates exactly; see stats.js).
//   hp mp atk def mag res spd luk
// `gear` lists the equipment kinds a class can use (items.js `kind`); `row` is where it likes to stand.
// `skills` are learned at the listed level. Skill fields:
//   tgt:  'enemy' | 'enemies' | 'row' (every enemy in one row... here: all enemies at 0.8) | 'ally' | 'allies' | 'self' | 'dead'
//   kind: 'phys' (atk vs def) | 'mag' (mag vs res) | 'heal' | 'buff' | 'status' | 'revive' | 'cure' | 'steal' | 'flee'
//   pow:  damage or healing multiplier; el: element; st: a status it may inflict, with ch: chance
//   ranged: ignores the back-row penalty

export const CLASSES = {
    fighter: {
        name: 'Fighter', short: 'FTR', row: 'front', gear: ['sword', 'axe', 'heavy', 'light', 'shield'],
        base: { hp: 34, mp: 0, atk: 12, def: 8, mag: 2, res: 3, spd: 7, luk: 5 },
        grow: { hp: 9, mp: 0, atk: 2.6, def: 1.6, mag: 0.2, res: 0.7, spd: 1.0, luk: 0.6 },
        blurb: 'Hits hardest and stands longest. The heart of any front row.',
        skills: [
            { lv: 2, id: 'power_strike', name: 'Power Strike', mp: 0, hpCost: 0.06, tgt: 'enemy', kind: 'phys', pow: 1.7, desc: 'A full-weight blow (costs a little HP).' },
            { lv: 5, id: 'cleave', name: 'Cleave', mp: 0, hpCost: 0.08, tgt: 'enemies', kind: 'phys', pow: 0.85, desc: 'A sweeping arc that strikes every foe.' },
            { lv: 9, id: 'war_cry', name: 'War Cry', mp: 0, hpCost: 0.05, tgt: 'allies', kind: 'buff', st: 'might', turns: 4, desc: 'The whole party hits harder for 4 rounds.' },
            { lv: 14, id: 'second_wind', name: 'Second Wind', mp: 0, tgt: 'self', kind: 'heal', pow: 0.4, once: true, desc: 'Recover 40% of max HP, once a battle.' },
            { lv: 20, id: 'berserk', name: 'Berserk Blow', mp: 0, hpCost: 0.12, tgt: 'enemy', kind: 'phys', pow: 2.8, desc: 'Everything into one swing.' },
        ],
    },
    knight: {
        name: 'Knight', short: 'KNT', row: 'front', gear: ['sword', 'mace', 'heavy', 'light', 'shield'],
        base: { hp: 38, mp: 8, atk: 10, def: 11, mag: 4, res: 6, spd: 5, luk: 4 },
        grow: { hp: 10, mp: 1.2, atk: 2.1, def: 2.2, mag: 0.6, res: 1.2, spd: 0.7, luk: 0.5 },
        blurb: 'A shield for the party. Draws blows, guards the weak, smites the dead.',
        skills: [
            { lv: 2, id: 'provoke', name: 'Provoke', mp: 2, tgt: 'self', kind: 'buff', st: 'taunt', turns: 3, desc: 'Foes aim at you for 3 rounds; you take less damage.' },
            { lv: 4, id: 'shield_bash', name: 'Shield Bash', mp: 3, tgt: 'enemy', kind: 'phys', pow: 1.1, st: 'stun', ch: 0.45, desc: 'May stun the target.' },
            { lv: 8, id: 'guard_wall', name: 'Guard Wall', mp: 6, tgt: 'allies', kind: 'buff', st: 'guard', turns: 4, desc: 'The party takes 30% less damage for 4 rounds.' },
            { lv: 12, id: 'holy_edge', name: 'Holy Edge', mp: 6, tgt: 'enemy', kind: 'phys', pow: 1.6, el: 'holy', desc: 'A blessed strike; deadly to the undead.' },
            { lv: 18, id: 'lay_hands', name: 'Lay on Hands', mp: 10, tgt: 'ally', kind: 'heal', pow: 2.2, desc: 'Heal one ally greatly.' },
        ],
    },
    thief: {
        name: 'Thief', short: 'THF', row: 'front', gear: ['dagger', 'sword', 'light'],
        base: { hp: 26, mp: 0, atk: 9, def: 6, mag: 3, res: 4, spd: 13, luk: 12 },
        grow: { hp: 6.5, mp: 0, atk: 2.0, def: 1.0, mag: 0.4, res: 0.8, spd: 2.0, luk: 1.6 },
        blurb: 'Quick, lucky and sly. Finds more gold, opens trapped chests, strikes first.',
        skills: [
            { lv: 1, id: 'backstab', name: 'Backstab', mp: 0, tgt: 'enemy', kind: 'phys', pow: 1.3, critBonus: 0.35, ranged: true, desc: 'A sneaky strike with a high critical chance; works from the back row.' },
            { lv: 3, id: 'steal', name: 'Pilfer', mp: 0, tgt: 'enemy', kind: 'steal', desc: 'Lift gold (or an item) off a foe.' },
            { lv: 6, id: 'poison_blade', name: 'Venom Blade', mp: 0, tgt: 'enemy', kind: 'phys', pow: 1.0, st: 'poison', ch: 0.8, desc: 'Likely poisons the target.' },
            { lv: 10, id: 'smoke_bomb', name: 'Smoke Bomb', mp: 0, tgt: 'self', kind: 'flee', desc: 'The party escapes for certain (not from a guardian).' },
            { lv: 16, id: 'assassinate', name: 'Assassinate', mp: 0, tgt: 'enemy', kind: 'phys', pow: 1.6, instaKill: 0.22, ranged: true, desc: 'May slay an ordinary foe outright.' },
        ],
    },
    mage: {
        name: 'Mage', short: 'MAG', row: 'back', gear: ['staff', 'robe'],
        base: { hp: 20, mp: 18, atk: 3, def: 3, mag: 13, res: 9, spd: 8, luk: 6 },
        grow: { hp: 4.5, mp: 3.4, atk: 0.4, def: 0.6, mag: 2.8, res: 1.6, spd: 1.0, luk: 0.6 },
        blurb: 'Fragile, and the most dangerous person in the dungeon. Fire, frost and storm.',
        skills: [
            { lv: 1, id: 'fire', name: 'Firebolt', mp: 3, tgt: 'enemy', kind: 'mag', pow: 1.5, el: 'fire', desc: 'Fire damage to one foe.' },
            { lv: 2, id: 'frost', name: 'Frost Lance', mp: 3, tgt: 'enemy', kind: 'mag', pow: 1.4, el: 'ice', st: 'slow', ch: 0.4, desc: 'Ice damage; may slow.' },
            { lv: 4, id: 'thunder', name: 'Chain Lightning', mp: 7, tgt: 'enemies', kind: 'mag', pow: 0.95, el: 'bolt', desc: 'Lightning arcs through every foe.' },
            { lv: 7, id: 'sleep', name: 'Slumber', mp: 4, tgt: 'enemies', kind: 'status', st: 'sleep', ch: 0.55, desc: 'May put every foe to sleep.' },
            { lv: 11, id: 'blizzard', name: 'Blizzard', mp: 12, tgt: 'enemies', kind: 'mag', pow: 1.3, el: 'ice', desc: 'A storm of ice on every foe.' },
            { lv: 17, id: 'meteor', name: 'Meteor', mp: 22, tgt: 'enemies', kind: 'mag', pow: 1.9, el: 'fire', desc: 'Fire from the sky.' },
        ],
    },
    priest: {
        name: 'Priest', short: 'PRI', row: 'back', gear: ['mace', 'staff', 'robe', 'light', 'shield'],
        base: { hp: 24, mp: 16, atk: 6, def: 5, mag: 10, res: 11, spd: 6, luk: 7 },
        grow: { hp: 5.5, mp: 3.0, atk: 1.0, def: 1.0, mag: 2.2, res: 2.0, spd: 0.8, luk: 0.8 },
        blurb: 'Heals the living, raises the fallen, and burns the dead with holy light.',
        skills: [
            { lv: 1, id: 'heal', name: 'Mend', mp: 3, tgt: 'ally', kind: 'heal', pow: 1.3, desc: 'Heal one ally.' },
            { lv: 3, id: 'cure', name: 'Purify', mp: 2, tgt: 'ally', kind: 'cure', desc: 'Cure poison, sleep, paralysis, blindness and curses.' },
            { lv: 5, id: 'turn_undead', name: 'Turn Undead', mp: 5, tgt: 'enemies', kind: 'mag', pow: 0.9, el: 'holy', desc: 'Holy light on every foe; the undead take double.' },
            { lv: 8, id: 'blessing', name: 'Blessing', mp: 6, tgt: 'allies', kind: 'buff', st: 'regen', turns: 5, desc: 'The party regenerates for 5 rounds.' },
            { lv: 10, id: 'raise', name: 'Raise', mp: 12, tgt: 'dead', kind: 'revive', pow: 0.3, desc: 'Bring a fallen ally back with 30% HP.' },
            { lv: 13, id: 'mass_heal', name: 'Sanctuary', mp: 11, tgt: 'allies', kind: 'heal', pow: 0.9, desc: 'Heal the whole party.' },
            { lv: 19, id: 'holy', name: 'Judgement', mp: 16, tgt: 'enemy', kind: 'mag', pow: 2.6, el: 'holy', desc: 'Heaven\'s wrath on one foe.' },
        ],
    },
    ranger: {
        name: 'Ranger', short: 'RNG', row: 'back', gear: ['bow', 'dagger', 'light'],
        base: { hp: 28, mp: 6, atk: 11, def: 6, mag: 5, res: 5, spd: 11, luk: 9 },
        grow: { hp: 7, mp: 1.0, atk: 2.4, def: 1.1, mag: 0.6, res: 0.9, spd: 1.6, luk: 1.1 },
        blurb: 'Shoots from the back row at full strength. Marks prey, pins it, rains arrows.',
        skills: [
            { lv: 2, id: 'aimed_shot', name: 'Aimed Shot', mp: 2, tgt: 'enemy', kind: 'phys', pow: 1.55, ranged: true, sure: true, desc: 'A shot that never misses.' },
            { lv: 4, id: 'hunters_mark', name: 'Hunter\'s Mark', mp: 3, tgt: 'enemy', kind: 'status', st: 'marked', ch: 1, turns: 4, desc: 'The target takes 30% more damage for 4 rounds.' },
            { lv: 7, id: 'pin_down', name: 'Pin Down', mp: 4, tgt: 'enemy', kind: 'phys', pow: 1.0, ranged: true, st: 'stun', ch: 0.5, desc: 'May pin the target in place for a round.' },
            { lv: 10, id: 'volley', name: 'Volley', mp: 6, tgt: 'enemies', kind: 'phys', pow: 0.8, ranged: true, desc: 'Arrows for every foe.' },
            { lv: 15, id: 'flame_arrow', name: 'Flame Arrow', mp: 6, tgt: 'enemy', kind: 'phys', pow: 1.7, el: 'fire', ranged: true, desc: 'A burning shot.' },
            { lv: 21, id: 'storm_arrows', name: 'Storm of Arrows', mp: 14, tgt: 'enemies', kind: 'phys', pow: 1.35, ranged: true, desc: 'The sky goes dark with arrows.' },
        ],
    },
};

for (const [id, c] of Object.entries(CLASSES)) c.id = id;
export const CLASS_IDS = Object.keys(CLASSES);

export const SKILLS = {};
for (const c of Object.values(CLASSES)) for (const s of c.skills) SKILLS[s.id] = { ...s, cls: c.id };

/** Two portraits per class (art/por/<id>.webp). `art` is the fal prompt. */
export const PORTRAITS = [
    { id: 'fighter_a', cls: 'fighter', art: 'a scarred young man with a shaved head and a short dark beard in battered steel pauldrons and a red cloak' },
    { id: 'fighter_b', cls: 'fighter', art: 'a broad-shouldered woman with braided auburn hair, a nose ring and a fur-trimmed chain hauberk' },
    { id: 'knight_a', cls: 'knight', art: 'a stern older man with grey temples and a trimmed moustache in polished silver plate armour with a blue tabard' },
    { id: 'knight_b', cls: 'knight', art: 'a calm dark-skinned woman with short curly hair in white enamelled plate armour with a golden sun emblem' },
    { id: 'thief_a', cls: 'thief', art: 'a sly lanky young man with messy black hair, a crooked grin and a dark hooded leather jerkin' },
    { id: 'thief_b', cls: 'thief', art: 'a sharp-eyed young woman with a silver-white bob haircut, a scarf over her lower face pulled down and a green leather hood' },
    { id: 'mage_a', cls: 'mage', art: 'an elderly wizard with a long white beard, round spectacles and a deep purple robe with star embroidery' },
    { id: 'mage_b', cls: 'mage', art: 'a young elven sorceress with long pale blue hair, pointed ears and a high-collared crimson robe' },
    { id: 'priest_a', cls: 'priest', art: 'a kind bald monk-priest with warm brown skin and a white and gold vestment with a holy symbol pendant' },
    { id: 'priest_b', cls: 'priest', art: 'a gentle young priestess with long blonde hair under a white veil and a silver circlet' },
    { id: 'ranger_a', cls: 'ranger', art: 'a weathered half-elf hunter with long brown hair tied back, a green cloak and a feathered quiver strap' },
    { id: 'ranger_b', cls: 'ranger', art: 'a fierce young woman with black hair in a high ponytail, tattooed cheek and a leaf-green leather hood' },
];

export const NAMES = [
    'Aldric', 'Brenna', 'Cassian', 'Dagny', 'Edric', 'Fenna', 'Garrick', 'Hilde', 'Isolde', 'Jory', 'Kael', 'Liora',
    'Mordan', 'Nessa', 'Orrin', 'Perrin', 'Quill', 'Rowan', 'Sabine', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yorick',
    'Zara', 'Bastian', 'Corra', 'Dain', 'Elspeth', 'Finch', 'Greta', 'Hale', 'Ingrid', 'Jasper', 'Kestrel', 'Lark',
];
