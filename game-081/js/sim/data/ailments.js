// Afflictions: the pieces of the healing puzzle. Pure data, shared by the sim, the view and the UI.
//
// Every mote has four traits — form (kind), aura (hue), depth (sev) and nature (school) — and the
// healer links two motes when they share a trait the healer can sense.

export const HUES = {
    red:    { label: 'crimson', hex: 0xff3d4f, css: '#ff4d5e' },
    orange: { label: 'ember',   hex: 0xff8a1e, css: '#ff9a3a' },
    yellow: { label: 'gold',    hex: 0xffd23a, css: '#ffd84f' },
    green:  { label: 'verdant', hex: 0x5fe04a, css: '#6fe35a' },
    blue:   { label: 'azure',   hex: 0x3fa8ff, css: '#4fb2ff' },
    purple: { label: 'violet',  hex: 0xa45cff, css: '#b06dff' },
    pink:   { label: 'rose',    hex: 0xff6fc4, css: '#ff7dca' },
};
export const HUE_IDS = Object.keys(HUES);

export const SCHOOLS = {
    venom:  { label: 'Venom',  verb: 'purge',  past: 'purged',   css: '#7ee06a', icon: '☠️' },
    wound:  { label: 'Wound',  verb: 'mend',   past: 'mended',   css: '#ff6b6b', icon: '🩹' },
    hex:    { label: 'Hex',    verb: 'dispel', past: 'dispelled', css: '#b98cff', icon: '🔯' },
    blight: { label: 'Blight', verb: 'soothe', past: 'soothed',  css: '#ffad4a', icon: '🔥' },
};
export const SCHOOL_IDS = Object.keys(SCHOOLS);

export const SEVS = {
    S: { label: 'minor',   scale: 0.66 },
    M: { label: 'serious', scale: 0.84 },
    L: { label: 'grave',   scale: 1.04 },
};
export const SEV_IDS = ['S', 'M', 'L'];

// hues[0] is the "classic" aura used before Aura Sight.
export const KINDS = {
    nightshade: { label: 'Nightshade',  plural: 'nightshade',   school: 'venom',  hues: ['purple', 'blue'],          icon: '🫐' },
    wyrmbile:   { label: 'Wyrmbile',    plural: 'wyrmbile',     school: 'venom',  hues: ['green', 'yellow'],         icon: '💧' },
    spider:     { label: 'Spider-bite', plural: 'spider-bites', school: 'venom',  hues: ['red', 'green'],            icon: '🕷️' },
    rotspore:   { label: 'Rot-spore',   plural: 'rot-spores',   school: 'venom',  hues: ['green', 'orange', 'pink'], icon: '🍄' },
    gash:       { label: 'Gash',        plural: 'gashes',       school: 'wound',  hues: ['red', 'pink'],             icon: '🗡️' },
    bruise:     { label: 'Bruise',      plural: 'bruises',      school: 'wound',  hues: ['purple', 'blue', 'yellow'], icon: '🟣' },
    thorn:      { label: 'Thorn',       plural: 'thorns',       school: 'wound',  hues: ['green', 'orange'],         icon: '🌵' },
    fracture:   { label: 'Fracture',    plural: 'fractures',    school: 'wound',  hues: ['yellow'],                  icon: '🦴' },
    sigil:      { label: 'Sigil',       plural: 'sigils',       school: 'hex',    hues: ['purple', 'pink', 'blue'],  icon: '🔯' },
    wither:     { label: 'Wither',      plural: 'withers',      school: 'hex',    hues: ['orange', 'yellow'],        icon: '🍂' },
    nightmare:  { label: 'Nightmare',   plural: 'nightmares',   school: 'hex',    hues: ['blue', 'purple'],          icon: '👁️' },
    chain:      { label: 'Chain',       plural: 'chains',       school: 'hex',    hues: ['yellow', 'red'],           icon: '⛓️' },
    scorch:     { label: 'Scorch',      plural: 'scorches',     school: 'blight', hues: ['orange', 'red'],           icon: '🔥' },
    holyfire:   { label: 'Holy Fire',   plural: 'holy fires',   school: 'blight', hues: ['yellow', 'pink'],          icon: '☀️' },
    frostbite:  { label: 'Frostbite',   plural: 'frostbites',   school: 'blight', hues: ['blue'],                    icon: '❄️' },
    acid:       { label: 'Acid',        plural: 'acid burns',   school: 'blight', hues: ['green', 'yellow'],         icon: '🧪' },
};
export const KIND_IDS = Object.keys(KINDS);

/** Every natural form + aura pair: the Codex of Ailments. */
export function codexEntries() {
    const out = [];
    for (const kind of KIND_IDS) for (const hue of KINDS[kind].hues) out.push({ kind, hue, key: `${kind}|${hue}` });
    return out;
}

// --- Senses: the traits the healer can link by ---
export const SENSES = {
    kind:   { label: 'Form',   name: 'Eye of Form', icon: '👁️', hop: 'same form',   blurb: 'Link afflictions of the same form: a thorn to a thorn.' },
    hue:    { label: 'Aura',   name: 'Aura Sight',  icon: '🌈', hop: 'same aura',   blurb: 'You can see the colour of hurt now. Two crimson motes link, whatever their form: a gash to a spider-bite.' },
    sev:    { label: 'Depth',  name: 'Depth Sense', icon: '📏', hop: 'same depth',  blurb: 'You can feel how deep a hurt goes. Two grave motes link, however different they look.' },
    school: { label: 'Nature', name: 'Root Lore',   icon: '🌳', hop: 'same nature', blurb: 'You know the four roots of all hurt now: venom, wound, hex and blight. Any two of the same nature link.' },
};
export const SENSE_ORDER = ['kind', 'hue', 'sev', 'school'];

// --- Vials: one per sense; a full vial is a power charge ---
export const VIALS = {
    kind:   { power: 'draught', need: 8 },
    hue:    { power: 'prism',   need: 10 },
    sev:    { power: 'lancet',  need: 10 },
    school: { power: 'phoenix', need: 12 },
};
export const MAX_CHARGES = 2;

export const POWERS = {
    draught: { label: 'Purging Draught', icon: '⚗️', tip: 'Tap a mote: treat every mote of that form.' },
    prism:   { label: 'Prism Salve',     icon: '🔮', tip: 'Tap a mote: its neighbours take its aura.' },
    lancet:  { label: 'Lancet Burst',    icon: '🗡️', tip: 'Tap a spot: treat the 3×3 around it.' },
    phoenix: { label: 'Phoenix Feather', icon: '🪶', tip: 'Your next trail can hop between any motes.' },
};

// --- Rules ---
export const MIN_CHAIN = 3;
export const BLOOM_CHAIN = 7;             // trail length that grows a lifebloom
export const TONIC_FOCUS = 5;
export const STAR2_FRAC = 0.2;
export const STAR3_FRAC = 0.4;
export const SCORE = { perChainSq: 10, power: 20, bloom: 100, leftover: 150 };

/** A goal's ticket text: "Mend 8 thorns". */
export function goalLabel(g) {
    const n = g.n;
    switch (g.t) {
        case 'kind': return `${SCHOOLS[KINDS[g.v].school].verb[0].toUpperCase() + SCHOOLS[KINDS[g.v].school].verb.slice(1)} ${n} ${n === 1 ? KINDS[g.v].label.toLowerCase() : KINDS[g.v].plural}`;
        case 'hue': return `Treat ${n} ${HUES[g.v].label}`;
        case 'sev': return `Treat ${n} ${SEVS[g.v].label}`;
        case 'school': return `${SCHOOLS[g.v].verb[0].toUpperCase() + SCHOOLS[g.v].verb.slice(1)} ${n} ${SCHOOLS[g.v].label.toLowerCase()}`;
        case 'bloom': return `Grow ${n} lifebloom${n === 1 ? '' : 's'}`;
        case 'scar': return `Soften ${n} scar${n === 1 ? '' : 's'}`;
        case 'bound': return `Unbind ${n}`;
        case 'any': return `Treat ${n} afflictions`;
        default: return '?';
    }
}
