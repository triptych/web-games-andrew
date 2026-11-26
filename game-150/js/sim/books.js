// The procedural book engine. Pure: one integer seed and a few constraints make the same book every time, its
// title, author, virtues, skill, voice and every detail of how it looks (cover material, colour, tooling, emblem,
// page edges, clasp, size). The view turns `look` into a high-resolution 3D book (view/book3d.js) and a 2D cover
// (view/covers.js); the sim only ever reads the numbers.

import { makeRng } from '../rng.js';
import { KINDS, KIND_IDS, RARITY, VIRTUES, VIRTUE_IDS, KIND_SKILLS, SKILLS, VOICE_IDS, MATERIALS } from './data.js';

// ------------------------------------------------------------------ words
const W = {
    adj: ['Amber', 'Velvet', 'Hollow', 'Gilded', 'Whispering', 'Crooked', 'Lantern-lit', 'Quiet', 'Silver', 'Wandering', 'Midnight', 'Honeyed', 'Forgotten', 'Thistle', 'Brave', 'Small', 'Starlit', 'Last', 'Sleeping', 'Copper', 'Merry', 'Moss-green', 'Secret', 'Patient'],
    noun: ['Lantern', 'Key', 'Kettle', 'Crown', 'Teacup', 'Feather', 'Map', 'Bell', 'Door', 'River', 'Garden', 'Clocktower', 'Compass', 'Owl', 'Harvest', 'Comet', 'Mirror', 'Orchard', 'Hearth', 'Ribbon', 'Dragon', 'Fox', 'Ship', 'Staircase'],
    place: ['Larkspur', 'Thimbledown', 'the Glimmer Fen', 'Old Harrowgate', 'the Salt Cliffs', 'Brackenmoor', 'the Inky Sea', 'Fennimore Hill', 'Willowmere', 'the Northern Stacks', 'Candlewick Lane', 'Pudding Vale'],
    first: ['Elowen', 'Bartholomew', 'Ada', 'Cornelius', 'Hester', 'Ignatius', 'Mabel', 'Ottoline', 'Percival', 'Rosalind', 'Tobias', 'Winifred', 'Agatha', 'Florian', 'Jasper', 'Clementine', 'Magnus', 'Odile', 'Fitz', 'Beatrix', 'Silas', 'Juniper', 'Ambrose', 'Lettice'],
    last: ['Inkwright', 'Thistlewood', 'Marrowby', 'Quillfeather', 'Bramblecote', 'Hearthstone', 'Pennyroyal', 'Lanternmoor', 'Featherstone', 'Applegarth', 'Tumbleweed', 'Underhill', 'Wickerby', 'Fairweather', 'Mossbottom', 'Crumpet', 'Starling', 'Goldleaf'],
    food: ['Plum Puddings', 'Honey Buns', 'Mushroom Pies', 'Soups for Rainy Days', 'Dragonfruit Tarts', 'Midnight Biscuits', 'Pumpkin Loaves', 'Teatime Scones', 'Hearty Stews', 'Candied Violets', 'Turnip Surprises', 'Picnic Sandwiches'],
    creature: ['Wyverns', 'Moon Moths', 'Bog Goblins', 'Thunder Goats', 'Glass Snails', 'River Trolls', 'Cinder Newts', 'Hedge Griffins', 'Puddle Drakes', 'Cloud Whales', 'Lantern Toads', 'Mimic Chests'],
    craft: ['Knot-Tying', 'Lockpicking', 'Herb Lore', 'Map Reading', 'Fair Bargaining', 'Swordplay for Beginners', 'Campfire Cookery', 'Bookbinding', 'Stargazing', 'Swimming in Armour', 'Polite Conversation', 'Bee-Keeping'],
    season: ['Spring', 'Summer', 'Autumn', 'Winter', 'Harvest', 'Long Nights', 'First Frost', 'Thaw'],
    plural: ['Lanterns', 'Sparrows', 'Letters', 'Lullabies', 'Roses', 'Rivers', 'Embers', 'Snowfalls', 'Candles', 'Promises', 'Teacups', 'Moths'],
    time: ['Dusk', 'Dawn', 'Midnight', 'Teatime', 'the Turning of the Year', 'Low Tide', 'First Light', 'Closing Time'],
    latin: ['Lumen', 'Arcanum', 'Silvae', 'Stellarum', 'Umbrae', 'Verbum', 'Noctis', 'Aurorae', 'Memoriae', 'Ignis'],
    hero: ['the Tinker\'s Daughter', 'a Very Small Knight', 'the Lighthouse Cat', 'Captain Marrow', 'the Last Librarian', 'a Runaway Prince', 'the Witch of Wicker Lane', 'Two Brave Mice'],
};

const TITLES = {
    cookbook: [
        (r) => `${r.pick(W.food)} of ${r.pick(W.place)}`,
        (r) => `The ${r.pick(W.adj)} Kitchen`,
        (r) => `${r.pick(W.first)}'s ${r.pick(W.food)}`,
        (r) => `A Hundred ${r.pick(W.food)}`,
        (r) => `The ${r.pick(W.adj)} Hearth Cookery Book`,
    ],
    novel: [
        (r) => `The ${r.pick(W.adj)} ${r.pick(W.noun)}`,
        (r) => `${r.pick(W.hero)} and the ${r.pick(W.adj)} ${r.pick(W.noun)}`,
        (r) => `A ${r.pick(W.noun)} for ${r.pick(W.place)}`,
        (r) => `The ${r.pick(W.noun)} of ${r.pick(W.place)}`,
        (r) => `Return to ${r.pick(W.place)}`,
    ],
    poetry: [
        (r) => `${r.pick(W.plural)} at ${r.pick(W.time)}`,
        (r) => `Songs of the ${r.pick(W.adj)} ${r.pick(W.noun)}`,
        (r) => `Small Poems for ${r.pick(W.plural)}`,
        (r) => `${r.pick(W.adj)} Verses`,
    ],
    manual: [
        (r, s) => `A Practical Guide to ${s ? SKILLS[s].name : r.pick(W.craft)}`,
        (r, s) => `${s ? SKILLS[s].name : r.pick(W.craft)} for the Bold`,
        (r, s) => `The ${r.pick(W.adj)} Handbook of ${s ? SKILLS[s].name : r.pick(W.craft)}`,
    ],
    bestiary: [
        (r) => `${r.pick(W.creature)} of ${r.pick(W.place)}`,
        (r) => `On the Habits of ${r.pick(W.creature)}`,
        (r) => `The ${r.pick(W.adj)} Bestiary`,
        (r) => `${r.pick(W.creature)} and How to Befriend Them`,
    ],
    atlas: [
        (r) => `Maps of ${r.pick(W.place)}`,
        (r) => `The Wanderer's Atlas`,
        (r) => `Roads to ${r.pick(W.place)}`,
        (r) => `The ${r.pick(W.adj)} Atlas of ${r.pick(W.place)}`,
    ],
    almanac: [
        (r) => `${r.pick(W.first)}'s Almanac of ${r.pick(W.season)}`,
        (r) => `The ${r.pick(W.adj)} Almanac`,
        (r) => `Weather Signs for ${r.pick(W.season)}`,
        (r) => `The ${r.pick(W.place).replace(/^the /, '')} Almanac`,
    ],
    grimoire: [
        (r) => `The ${r.pick(W.adj)} Grimoire`,
        (r) => `Liber ${r.pick(W.latin)}`,
        (r) => `The Grimoire of ${r.pick(W.first)} ${r.pick(W.last)}`,
        (r) => `Codex ${r.pick(W.latin)} ${r.pick(W.latin)}`,
    ],
};

// ------------------------------------------------------------------ looks
// Cover colours by main virtue: [h, s, l] ranges in degrees and percent.
const HUES = {
    valor: [[350, 15], [55, 75], [26, 40]],
    wit: [[200, 230], [40, 65], [22, 38]],
    hearth: [[22, 42], [45, 70], [28, 42]],
    charm: [[320, 345], [40, 60], [32, 48]],
    wonder: [[245, 285], [35, 60], [20, 36]],
};
const EMBLEMS = {
    cookbook: ['wheat', 'cauldron', 'teacup'], novel: ['key', 'sword', 'crown', 'rose', 'tree'], poetry: ['rose', 'moon', 'quill'],
    manual: ['gear', 'key', 'quill'], bestiary: ['dragon', 'paw', 'sword'], atlas: ['compass', 'star', 'tree'],
    almanac: ['sun', 'wheat', 'moon'], grimoire: ['eye', 'moon', 'star', 'flame'],
};
const PATTERNS = ['plain', 'border', 'corners', 'diamond', 'vines', 'filigree', 'stars', 'runes'];
const METALS = { gold: '#d8b25a', silver: '#c9ccd3', brass: '#b8913f', copper: '#c07a4a' };

function hsl(r, range) { return Math.round(r.range(range[0], range[1])); }

export function makeLook(r, { kind, rarity, virtue, cover = null, accents = [] }) {
    const K = KINDS[kind];
    const [hr, sr, lr] = HUES[virtue];
    const h = (hsl(r, hr) + 360) % 360, s = hsl(r, sr), l = hsl(r, lr);
    const material = cover === 'dragonhide' ? 'dragonhide' : cover === 'oak' ? 'board' : cover === 'paper' ? 'cloth'
        : cover === 'leather' ? 'leather' : rarity >= 3 ? r.pick(['leather', 'leather', 'dragonhide']) : r.pick(['cloth', 'leather', 'leather', 'cloth']);
    const metal = accents.includes('gold') || rarity >= 3 ? 'gold' : accents.includes('clasp') ? 'silver' : r.pick(['gold', 'gold', 'brass', 'silver', 'copper']);
    const pat = Math.min(PATTERNS.length - 1, Math.floor(r() * (2 + rarity * 1.6)));
    const edge = accents.includes('gold') || rarity >= 3 ? 'gilt' : r.pick(rarity >= 2 ? ['gilt', 'marbled', 'sprayed'] : ['cream', 'cream', 'marbled', 'sprayed']);
    return {
        h: K.shape.h * r.range(0.92, 1.08),
        w: K.shape.w * r.range(0.94, 1.06),
        t: K.shape.t * r.range(0.85, 1.2),
        color: `hsl(${h}, ${s}%, ${l}%)`,
        hue: h, sat: s, lit: l,
        material,
        metal, metalColor: METALS[metal],
        pattern: PATTERNS[pat],
        emblem: r.pick(EMBLEMS[kind]),
        bands: r.int(2, 5),
        edge,
        edgeColor: edge === 'marbled' ? `hsl(${(h + 180) % 360}, 45%, 45%)` : edge === 'sprayed' ? `hsl(${h}, 40%, 35%)` : null,
        clasp: accents.includes('clasp') || (rarity >= 2 && r() < 0.45),
        corners: rarity >= 1 && r() < 0.35 + rarity * 0.15,
        ribbon: `hsl(${(h + r.int(90, 270)) % 360}, 55%, 45%)`,
        glow: virtue === 'wonder' && rarity >= 3 ? `hsl(${(h + 20) % 360}, 90%, 70%)` : (accents.includes('star') ? '#ffe9a8' : null),
        wear: Math.max(0, r.range(0.05, 0.6) - rarity * 0.08),
        bump: r.int(0, 1e9),
    };
}

// ------------------------------------------------------------------ stats
function spread(r, points, virtues, nStats) {
    const out = {};
    const vs = virtues.slice(0, nStats);
    // the main virtue gets about 60%; the rest share what's left
    let left = points;
    vs.forEach((v, i) => {
        const share = i === vs.length - 1 ? left : Math.max(1, Math.round(left * (i === 0 ? r.range(0.5, 0.7) : r.range(0.4, 0.6))));
        out[v] = (out[v] || 0) + share;
        left -= share;
    });
    for (const v of Object.keys(out)) if (out[v] <= 0) delete out[v];
    return out;
}

export function bookValue(b) {
    const base = RARITY[b.rarity].value;
    const pts = Object.values(b.stats).reduce((a, x) => a + x, 0);
    let v = base * (0.8 + pts / (RARITY[b.rarity].points * 2.5)) * (1 + 0.25 * b.plus);
    if (b.skill) v *= 1.25;
    if (b.talk) v *= 1.3;
    if (b.gilt) v *= 1.3;
    return Math.max(3, Math.round(v));
}

/**
 * Make a book. seed: integer. opts:
 *   kind, rarity (0–4), virtue (main), skill (id, null = none, undefined = roll), talk (voice id, false, undefined = roll),
 *   cover/accents (when crafted), bonus (extra points per virtue), crafted, title (fixed, for the masterwork)
 */
export function makeBook(id, seed, opts = {}) {
    const r = makeRng((seed ^ 0x9e3779b9) >>> 0);
    r(); r();
    const kind = opts.kind || r.pick(KIND_IDS);
    const rarity = Math.max(0, Math.min(4, opts.rarity ?? 0));
    const K = KINDS[kind];
    const virtue = opts.virtue || r.pick(K.virtues);
    const others = [...K.virtues.filter((v) => v !== virtue), ...VIRTUE_IDS.filter((v) => v !== virtue && !K.virtues.includes(v))];
    // keep the kind's own virtues first, then a random other
    const order = [virtue, ...others.slice(0, 1), r.pick(others.slice(1).length ? others.slice(1) : others)];
    const stats = spread(r, RARITY[rarity].points, [...new Set(order)], RARITY[rarity].stats);
    for (const [v, n] of Object.entries(opts.bonus || {})) if (n) stats[v] = (stats[v] || 0) + n;

    let skill = opts.skill;
    if (skill === undefined) {
        const chance = kind === 'manual' ? 1 : [0, 0.08, 0.25, 0.45, 0.7][rarity];
        skill = r() < chance ? r.pick(KIND_SKILLS[kind]) : null;
    }
    let talk = opts.talk;
    if (talk === undefined) {
        const chance = kind === 'grimoire' ? [0, 0.1, 0.35, 0.7, 1][rarity] : [0, 0, 0.04, 0.12, 0.3][rarity];
        talk = r() < chance ? r.pick(VOICE_IDS) : false;
    }
    const title = opts.title || r.pick(TITLES[kind])(r, skill);
    const author = `${r.pick(W.first)} ${r.pick(W.last)}`;
    const look = makeLook(r, { kind, rarity, virtue, cover: opts.cover, accents: opts.accents || [] });
    const b = {
        id, seed, kind, rarity, title, author, stats, skill: skill || null, talk: talk || false,
        plus: 0, gilt: !!(opts.accents || []).includes('gold'), crafted: !!opts.crafted, read: false,
        year: 1200 + Math.floor(r() * 480), look, value: 0, loc: null,
    };
    if (opts.masterwork) { b.masterwork = true; b.look.glow = '#ffe9a8'; b.look.metal = 'gold'; b.look.metalColor = '#e8c46a'; b.look.pattern = 'filigree'; b.look.edge = 'gilt'; b.look.wear = 0; }
    b.value = bookValue(b);
    return b;
}

/** The sum of a book's points in one virtue. */
export const stat = (b, v) => b.stats[v] || 0;
export const totalPoints = (b) => Object.values(b.stats).reduce((a, x) => a + x, 0);
export const mainVirtue = (b) => Object.entries(b.stats).sort((a, c) => c[1] - a[1])[0]?.[0] || 'wit';

/** One line for a list: "Rare Grimoire · Wonder 4 · Wit 2". */
export function describe(b) {
    const s = Object.entries(b.stats).sort((a, c) => c[1] - a[1]).map(([v, n]) => `${VIRTUES[v].name} ${n}`).join(' · ');
    return `${RARITY[b.rarity].name} ${KINDS[b.kind].name}${b.plus ? ' +' + b.plus : ''} · ${s}`;
}

export function materialName(id) { return MATERIALS[id]?.name || id; }
