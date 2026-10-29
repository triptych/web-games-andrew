// Oathstones — the content tables: colours, shapes, oaths, heroes, enemies, regions and stages.
// Pure data, no logic beyond small lookups. The view and the UI read the names and descriptions
// from here too, so the rules text and the rules can't drift apart.

export const COLORS = [
    { id: 'ember', name: 'Ember', hex: 0xff5a36, css: '#ff6a46' },
    { id: 'tide', name: 'Tide', hex: 0x3aa6ff, css: '#4cb0ff' },
    { id: 'grove', name: 'Grove', hex: 0x48d468, css: '#56dc74' },
    { id: 'sun', name: 'Sun', hex: 0xffcc33, css: '#ffd447' },
    { id: 'shade', name: 'Shade', hex: 0xb56bff, css: '#c182ff' },
];
export const SHAPES = [
    { id: 'orb', name: 'Orb', glyph: '●' },
    { id: 'spire', name: 'Spire', glyph: '▲' },
    { id: 'keep', name: 'Keep', glyph: '■' },
    { id: 'star', name: 'Star', glyph: '✦' },
];
export const NC = COLORS.length;
export const NS = SHAPES.length;

/** Ember beats Grove beats Tide beats Ember; Sun and Shade each beat the other. */
export function elemMult(att, def) {
    if (att < 0 || def < 0) return 1;
    const beats = { 0: 2, 2: 1, 1: 0 };
    if (beats[att] === def) return 1.5;
    if (beats[def] === att) return 0.6;
    if ((att === 3 && def === 4) || (att === 4 && def === 3)) return 1.5;
    return 1;
}

/**
 * Every token swears one oath: the rule for the lines it may join and when it leaves the board.
 * stone: plain stones can swear it (heroes bind nearby stones to it on arrival).
 */
export const OATHS = {
    hue: { name: 'Kinship', icon: '●', stone: true, text: 'Joins a line of three or more of its own colour.' },
    form: { name: 'Form', icon: '◆', stone: true, text: 'Joins a line of three or more of its own shape, in any colours.' },
    twin: { name: 'Twinned', icon: '♊', stone: true, text: 'Joins only a line of its own colour and its own shape.' },
    prism: { name: 'Prism', icon: '◈', stone: true, text: 'Joins a line of its own shape where every colour is different.' },
    motley: { name: 'Motley', icon: '✣', stone: true, text: 'Joins a line of its own colour where every shape is different.' },
    host: { name: 'Host', icon: '⚑', stone: true, text: 'Joins only a line of four or more of its own colour.' },
    chain: { name: 'Cascade', icon: '⛓', stone: false, text: 'Joins lines of its colour, but only leaves in a cascade, never from your own swap.' },
    cross: { name: 'Crossroads', icon: '✚', stone: false, text: 'Joins lines of its colour, but only leaves where a row and a column of them cross.' },
    ring: { name: 'Ring', icon: '◎', stone: false, text: 'Never joins a line. Leaves when every neighbour beside it shares one colour.' },
    vigil: { name: 'Vigil', icon: '☾', stone: false, text: 'Sleeps and blocks lines. Wakes and leaves after matches are made beside it.' },
    wild: { name: 'Fool', icon: '✧', stone: true, text: 'Joins any line, and counts as any colour and any shape.' },
};

export const RARITY = {
    3: { name: 'Rare', hp: 60, atk: 8, css: '#7fc3ff' },
    4: { name: 'Epic', hp: 80, atk: 11, css: '#d28bff' },
    5: { name: 'Legend', hp: 100, atk: 15, css: '#ffcf4a' },
};

export const CLASSES = ['knight', 'cleric', 'ranger', 'rogue', 'monk', 'bard', 'druid', 'mage', 'paladin', 'warlock'];

// Arrival effects: [kind, area, n]. Areas: ring (the 8 around), row, col, all, party, enemy.
// Skill effects: [kind, value]. See applyEffect / useSkill in board.js and game.js.
const C = { E: 0, T: 1, G: 2, S: 3, D: 4 };
const S = { orb: 0, spire: 1, keep: 2, star: 3 };
const H = (id, name, title, cls, c, s, r, oath, arrive, skill, extra = {}) =>
    ({ id, name, title, cls, c: C[c], s: S[s], r, oath, arrive, skill, ...extra });

export const HEROES = [
    H('rowan', 'Rowan', 'Hearth Knight', 'knight', 'E', 'keep', 3, 'hue',
        { text: 'Paints two stones beside him Ember.', fx: [['paint', 'ring', 2]] },
        { name: 'Brave Cleave', cost: 12, text: 'Strikes for 2.2× his power.', fx: [['strike', 2.2]] }),
    H('lyra', 'Lyra', 'Tide Cleric', 'cleric', 'T', 'orb', 3, 'form',
        { text: 'Rounds two stones beside her into Orbs.', fx: [['mould', 'ring', 2]] },
        { name: 'Tidal Mend', cost: 12, text: 'Heals the party by 30%.', fx: [['mend', 0.3]] }),
    H('bram', 'Bram', 'Hedge Ranger', 'ranger', 'G', 'spire', 3, 'form',
        { text: 'Whittles three stones in his column into Spires.', fx: [['mould', 'col', 3]] },
        { name: 'Volley', cost: 12, text: 'Strikes for 1.6× and delays the enemy a turn.', fx: [['strike', 1.6], ['delay', 1]] }),
    H('tess', 'Tess', 'Alley Cutpurse', 'rogue', 'D', 'star', 3, 'hue',
        { text: 'Shuffles the stones around her.', fx: [['scatter', 'ring', 0]] },
        { name: 'Backstab', cost: 10, text: 'Strikes for 2×.', fx: [['strike', 2]] }),
    H('odo', 'Brother Odo', 'Patient Monk', 'monk', 'S', 'orb', 3, 'vigil',
        { text: 'Charges every party skill by 4.', fx: [['charge', 'party', 4]] },
        { name: 'Iron Palm', cost: 12, text: 'Shields 25% of the party and strikes for 1×.', fx: [['ward', 0.25], ['strike', 1]] }, { wake: 2 }),
    H('pip', 'Pip', 'Wandering Fool', 'bard', 'S', 'star', 3, 'wild',
        { text: 'Turns one stone beside him into a Fool stone.', fx: [['wild', 'ring', 1]] },
        { name: 'Jest', cost: 14, text: 'Turns two stones into Fool stones.', fx: [['wild', 2]] }),
    H('mara', 'Mara', 'Moss Druid', 'druid', 'G', 'orb', 3, 'ring',
        { text: 'Paints two stones beside her Grove.', fx: [['paint', 'ring', 2]] },
        { name: 'Overgrow', cost: 12, text: 'Paints five stones Grove.', fx: [['paint', 5]] }),
    H('kel', 'Kel', 'Spark Adept', 'mage', 'E', 'spire', 3, 'chain',
        { text: 'Paints three stones in his row Ember.', fx: [['paint', 'row', 3]] },
        { name: 'Firebolt', cost: 12, text: 'Strikes for 2.6×.', fx: [['strike', 2.6]] }),

    H('seraphine', 'Seraphine', 'Dawn Paladin', 'paladin', 'S', 'keep', 4, 'twin',
        { text: 'Sanctifies the stones beside her: two turn Sun, two turn to Keeps.', fx: [['paint', 'ring', 2], ['mould', 'ring', 2]] },
        { name: 'Judgement', cost: 14, text: 'Strikes for 2.5× and cleanses the board.', fx: [['strike', 2.5], ['cleanse', 0]] }),
    H('nyx', 'Nyx', 'Hexblade', 'warlock', 'D', 'spire', 4, 'prism',
        { text: 'Binds every stone in her row to the Oath of the Prism.', fx: [['bind', 'row', 0]] },
        { name: 'Hex Bolt', cost: 14, text: 'Strikes for 2.4× and delays the enemy a turn.', fx: [['strike', 2.4], ['delay', 1]] }),
    H('corin', 'Corin', 'Gull Archer', 'ranger', 'T', 'star', 4, 'host',
        { text: 'Paints three stones in his column Tide.', fx: [['paint', 'col', 3]] },
        { name: 'Rain of Arrows', cost: 15, text: 'Shatters the row holding the most Tide stones.', fx: [['quake', 1]] }),
    H('ysolde', 'Ysolde', 'Frost Scholar', 'mage', 'T', 'keep', 4, 'motley',
        { text: 'Binds the stones beside her to the Motley oath.', fx: [['bind', 'ring', 0]] },
        { name: 'Frost Lance', cost: 14, text: 'Strikes for 2.8×.', fx: [['strike', 2.8]] }),
    H('gorm', 'Gorm', 'Stonewarden', 'knight', 'G', 'keep', 4, 'vigil',
        { text: 'Breaks every rubble and ice on the board.', fx: [['shatter', 'all', 0]] },
        { name: 'Bulwark', cost: 14, text: 'Shields 40% of the party.', fx: [['ward', 0.4]] }, { wake: 3 }),
    H('wren', 'Wren', 'Ashen Blade', 'rogue', 'E', 'star', 4, 'cross',
        { text: 'Shuffles the stones around her.', fx: [['scatter', 'ring', 0]] },
        { name: 'Shadowstep', cost: 12, text: 'Strikes for 3×.', fx: [['strike', 3]] }),
    H('fennick', 'Fennick', 'Dusk Minstrel', 'bard', 'D', 'orb', 4, 'wild',
        { text: 'His tune makes the enemy wait two more turns.', fx: [['delay', 'enemy', 2]] },
        { name: 'Lullaby', cost: 16, text: 'Delays the enemy two turns and heals 20%.', fx: [['delay', 2], ['mend', 0.2]] }),
    H('ilse', 'Ilse', 'Lantern Cleric', 'cleric', 'S', 'spire', 4, 'form',
        { text: 'Frees the stones beside her of their oaths.', fx: [['unbind', 'ring', 0]] },
        { name: 'Sanctuary', cost: 15, text: 'Heals 45% and cleanses the board.', fx: [['mend', 0.45], ['cleanse', 0]] }),

    H('aurelia', 'Aurelia', 'the Dawnbringer', 'paladin', 'S', 'star', 5, 'prism',
        { text: 'Binds every stone in her column to the Oath of the Prism.', fx: [['bind', 'col', 0]] },
        { name: 'Dawnbreak', cost: 18, text: 'Paints six stones Sun and strikes for 3×.', fx: [['paint', 6], ['strike', 3]] }),
    H('morrigan', 'Morrigan', 'Queen of Crows', 'warlock', 'D', 'keep', 5, 'cross',
        { text: 'Paints four stones beside her Shade.', fx: [['paint', 'ring', 4]] },
        { name: 'Night Tide', cost: 16, text: 'Strikes for 4×.', fx: [['strike', 4]] }),
    H('thalos', 'Thalos', 'the Deep Sage', 'mage', 'T', 'orb', 5, 'twin',
        { text: 'Binds every stone in his row to the Twinned oath.', fx: [['bind', 'row', 0]] },
        { name: 'Maelstrom', cost: 18, text: 'Shatters the two rows holding the most Tide stones.', fx: [['quake', 2]] }),
    H('vesper', 'Vesper', 'Drake Knight', 'knight', 'E', 'spire', 5, 'host',
        { text: 'Paints three stones beside him Ember.', fx: [['paint', 'ring', 3]] },
        { name: 'Drakefire', cost: 18, text: 'Strikes for 3.2× and paints four stones Ember.', fx: [['strike', 3.2], ['paint', 4]] }),
    H('elowen', 'Elowen', 'Archdruid', 'druid', 'G', 'star', 5, 'ring',
        { text: 'Charges every party skill by 6.', fx: [['charge', 'party', 6]] },
        { name: 'Verdant Bloom', cost: 18, text: 'Heals 60% and paints four stones Grove.', fx: [['mend', 0.6], ['paint', 4]] }),
];
export const HERO = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const STARTERS = ['rowan', 'lyra'];

// Enemy bodies: imp, beast, golem, wraith, drake, treant (built in js/view/models.js).
// pattern: what each of its turns does, cycling. strike hits the party; the rest change the board.
const E = (id, name, body, c, hp, atk, cd, pattern, scale = 1) =>
    ({ id, name, body, c: C[c], hp, atk, cd, pattern, scale });
export const ENEMIES = Object.fromEntries([
    E('imp', 'Cinder Imp', 'imp', 'E', 900, 12, 3, ['strike']),
    E('wolf', 'Ash Wolf', 'beast', 'E', 360, 44, 3, ['strike', 'strike', 'blight:2']),
    E('golem', 'Ember Golem', 'golem', 'E', 520, 61, 4, ['strike', 'petrify:2']),
    E('drake', 'Pyre Drake', 'drake', 'E', 980, 81, 3, ['strike', 'blight:3', 'strike', 'petrify:2'], 1.25),

    E('crab', 'Brine Crab', 'beast', 'T', 580, 76, 3, ['strike', 'freeze:2']),
    E('dknight', 'Drowned Knight', 'wraith', 'T', 700, 93, 3, ['strike', 'strike', 'hex:2']),
    E('siren', 'Siren of the Wrack', 'wraith', 'T', 780, 76, 2, ['strike', 'drain', 'strike']),
    E('leviathan', 'Leviathan', 'drake', 'T', 1500, 127, 3, ['strike', 'freeze:3', 'strike', 'bind:4'], 1.3),

    E('thornling', 'Thornling', 'imp', 'G', 830, 94, 3, ['strike', 'petrify:2']),
    E('hag', 'Bog Hag', 'wraith', 'G', 990, 101, 3, ['strike', 'heal:0.12', 'hex:3']),
    E('mossgolem', 'Moss Golem', 'golem', 'G', 1240, 122, 4, ['strike', 'petrify:3']),
    E('treant', 'Elder Treant', 'treant', 'G', 2080, 134, 3, ['strike', 'petrify:3', 'heal:0.1', 'bind:5'], 1.3),

    E('sentinel', 'Gilded Sentinel', 'golem', 'S', 1450, 88, 3, ['strike', 'freeze:3']),
    E('griffin', 'Storm Griffin', 'beast', 'S', 1780, 129, 3, ['strike', 'scramble', 'strike']),
    E('seraph', 'Fallen Seraph', 'wraith', 'S', 2000, 115, 3, ['strike', 'hex:3', 'drain']),
    E('colossus', 'Sun Colossus', 'golem', 'S', 3430, 152, 3, ['strike', 'petrify:3', 'freeze:3', 'enrage'], 1.35),

    E('hound', 'Shade Hound', 'beast', 'D', 1980, 120, 3, ['strike', 'blight:3', 'strike']),
    E('oathbreaker', 'The Oathbreaker', 'wraith', 'D', 6600, 166, 3, ['strike', 'hex:4', 'strike', 'bind:5', 'scramble', 'drain'], 1.45),
].map((e) => [e.id, e]));

export const ABILITY_TEXT = {
    strike: 'attacks the party',
    petrify: 'turns stones to rubble',
    freeze: 'freezes stones in ice',
    hex: 'hexes stones with the Twinned oath',
    blight: 'stains stones its own colour',
    bind: 'binds stones to this land’s oath',
    heal: 'mends its wounds',
    drain: 'drains your heroes’ skill charge',
    scramble: 'scrambles the board',
    enrage: 'grows enraged',
};

/** Which oath a freshly fallen stone swears in each region (weights). */
export const REGIONS = [
    { id: 'vale', name: 'Emberfall Vale', c: C.E, sky: 0, stones: { hue: 1 }, bindOath: 'hue',
        blurb: 'Hearth-fires gone wild in the foothills. Every stone here swears plain Kinship.' },
    { id: 'coast', name: 'Tidewrack Coast', c: C.T, sky: 1, stones: { hue: 0.78, form: 0.22 }, bindOath: 'form',
        blurb: 'Drowned cliffs where some stones swear the Oath of Form and match by shape.' },
    { id: 'thorn', name: 'Thornwood Deep', c: C.G, sky: 2, stones: { hue: 0.7, form: 0.16, motley: 0.14 }, bindOath: 'motley',
        blurb: 'A wood that grew over a battlefield. Motley stones want every shape at once.' },
    { id: 'sunspire', name: 'Sunspire Heights', c: C.S, sky: 3, stones: { hue: 0.66, form: 0.12, twin: 0.1, prism: 0.12 }, bindOath: 'prism',
        blurb: 'Gilded peaks where Prism and Twinned stones guard the old roads.' },
    { id: 'throne', name: 'The Hollow Throne', c: C.D, sky: 4, stones: { hue: 0.6, form: 0.12, twin: 0.1, prism: 0.1, motley: 0.08 }, bindOath: 'twin',
        blurb: 'The seat of the one who broke every oath. All the old vows tangle here.' },
];

/** guest: a hero who wanders onto this board on turn 2 until you have bound them (the tutorial uses it). */
export const STAGES = [
    { region: 0, name: 'The Smouldering Road', waves: ['imp'], guest: 'bram' },
    { region: 0, name: 'Cinder Fields', waves: ['imp', 'wolf'], guest: 'mara' },
    { region: 0, name: 'Kiln Pass', waves: ['wolf', 'golem'] },
    { region: 0, name: 'The Pyre Nest', waves: ['drake'], boss: true },

    { region: 1, name: 'Saltglass Shore', waves: ['crab'], guest: 'odo' },
    { region: 1, name: 'The Sunken Barrow', waves: ['crab', 'dknight'] },
    { region: 1, name: 'Wrackwater Rocks', waves: ['siren', 'dknight'] },
    { region: 1, name: 'Leviathan’s Deep', waves: ['leviathan'], boss: true },

    { region: 2, name: 'Bramble Gate', waves: ['thornling', 'thornling'], guest: 'pip' },
    { region: 2, name: 'The Hag’s Bog', waves: ['hag'] },
    { region: 2, name: 'Mossfallen Keep', waves: ['thornling', 'mossgolem'] },
    { region: 2, name: 'Heartwood', waves: ['treant'], boss: true },

    { region: 3, name: 'The Gilded Stair', waves: ['sentinel'] },
    { region: 3, name: 'Griffin’s Rest', waves: ['griffin', 'sentinel'] },
    { region: 3, name: 'Hall of Fallen Light', waves: ['seraph', 'griffin'] },
    { region: 3, name: 'The Sun Forge', waves: ['colossus'], boss: true },

    { region: 4, name: 'Hollow Approach', waves: ['hound', 'hound'] },
    { region: 4, name: 'The Hollow Throne', waves: ['oathbreaker'], boss: true, final: true },
];
