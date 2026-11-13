// TITAN'S VAULT: the three masteries, their skills and the hybrid synergies.
// Pure data. Every number the rules use is here or in config.js; the sim reads it, the UI prints it,
// and the art prompts (dev/art) are written from the `art` lines.
//
// A skill's damage is a multiple of WEAPON damage (Diablo III's rule): one gear number scales every build, so a
// lightning mage and a war-axe brute both care about the same weapon roll and hybrids never fall behind.
// `per` is added once per rank above the first. Tier n needs that many mastery ranks: [1, 4, 7, 10].

export const TIER_RANK = [0, 1, 4, 7, 10];
export const MASTERY_MAX = 10;
export const SKILL_MAX = 5;

export const MASTERIES = {
    warfare: {
        name: 'Warfare', res: 'rage', color: '#e0623a', hex: 0xe0623a,
        titan: 'Aster of the Iron Oath',
        blurb: 'Steel, momentum and fury. Rage is earned by hitting and being hit, and it drains away when the fighting stops: stand still and it is gone.',
        rankBonus: { lifePct: 3, armorPct: 2 },       // per mastery rank
        art: 'a battered bronze greatsword crossed with a war-axe over a red oath-shield',
    },
    storm: {
        name: 'Storm', res: 'mana', color: '#5cc8ff', hex: 0x5cc8ff,
        titan: 'Ilyra the Skyfather\'s Daughter',
        blurb: 'Lightning that chains, shocks and calls the sky down. Mana flows back steadily, so the question is never "if" but "how fast".',
        rankBonus: { lightningPct: 3, mana: 6 },
        art: 'a forked bolt of blue lightning striking a silver circlet',
    },
    umbra: {
        name: 'Umbra', res: 'essence', color: '#a77bff', hex: 0xa77bff,
        titan: 'Morrow, Keeper of the Dusk Gate',
        blurb: 'Shadow, shades and stolen life. Essence is torn from the dying: every kill feeds the next spell.',
        rankBonus: { shadowPct: 3, essence: 4 },
        art: 'a violet skull wreathed in shadow smoke above a crescent moon',
    },
};

/** The three starting classes: a mastery, a look and a voice. The second mastery is chosen at CLASS.secondAt. */
export const CLASSES = {
    ironsworn: {
        name: 'Ironsworn', mastery: 'warfare', model: 'hero-ironsworn', weapon: 'sword',
        pitch: 'A Vaultwarden who swore the Iron Oath. Leaps into the crowd and does not leave until it is gone.',
        stats: { might: 14, cunning: 10, spirit: 6, vitality: 12 },
        art: 'a broad-shouldered human warrior woman in battered bronze-and-leather Greek-style armour, red cloak, short dark braided hair, a bronze greatsword on her back',
    },
    stormcaller: {
        name: 'Stormcaller', mastery: 'storm', model: 'hero-stormcaller', weapon: 'staff',
        pitch: 'An oracle of the high temples who heard the sky answer. Fragile, and very loud.',
        stats: { might: 7, cunning: 11, spirit: 15, vitality: 9 },
        art: 'a lean young human man in flowing white-and-sky-blue oracle robes with silver trim, bare forearms with glowing blue rune tattoos, a silver circlet, holding nothing',
    },
    shadebinder: {
        name: 'Shadebinder', mastery: 'umbra', model: 'hero-shadebinder', weapon: 'wand',
        pitch: 'A gravekeeper who learned the dead will work for a kind word and a little stolen life.',
        stats: { might: 8, cunning: 13, spirit: 12, vitality: 9 },
        art: 'a hooded human woman gravekeeper in a tattered charcoal-and-violet hooded mantle over dark leather, a bone-and-silver pendant, pale face, violet eyes glowing faintly',
    },
};

/** Two masteries make a hybrid with its own name and a synergy that neither tree has alone (Titan Quest's rule). */
export const HYBRIDS = {
    'storm+warfare': {
        name: 'Thunderborn', synergy: 'galvanic',
        power: 'Galvanic Edge: melee hits have a 20% chance to arc a Chain Lightning for 60% of its damage, and every lightning critical hit gives 3 Rage.',
    },
    'umbra+warfare': {
        name: 'Reaver', synergy: 'bloodpact',
        power: 'Blood Pact: every kill gives 4 Rage and 3 Essence, and Leap Slam raises a Shade where you land (if you have room for one).',
    },
    'storm+umbra': {
        name: 'Eclipse Seer', synergy: 'voidcurrent',
        power: 'Void Current: your Shades cast a Spark Bolt every 2 seconds, and shadow damage against Shocked enemies is 25% higher.',
    },
};
export const hybridKey = (a, b) => [a, b].sort().join('+');

/**
 * Skills. kind: 'active' | 'passive'. fx.type picks the rule in js/sim/skills.js.
 * Damage fields are fractions of weapon damage; `per` lists what grows each rank.
 */
export const SKILLS = {
    // ------------------------------------------------------------------ Warfare (Rage)
    cleave: {
        mastery: 'warfare', tier: 1, kind: 'active', name: 'Cleave', icon: 0,
        cost: 0, gain: 5, cd: 0, attack: true, el: 'phys',
        fx: { type: 'arc', mult: 1.45, radius: 2.6, angle: 2.1, gainPerHit: 2 },
        per: { mult: 0.14 },
        desc: 'Sweep a wide arc for {mult}% weapon damage. Builds 5 Rage, plus 2 for each enemy struck.',
        art: 'a curved red slash trail of a sword sweep',
    },
    leap: {
        mastery: 'warfare', tier: 1, kind: 'active', name: 'Leap Slam', icon: 1,
        cost: 22, cd: 4, el: 'phys', target: 'ground',
        fx: { type: 'leap', mult: 2.3, radius: 2.8, range: 9, stagger: 0.6 },
        per: { mult: 0.25, radius: 0.15 },
        desc: 'Leap to a spot up to 9 m away and crash down for {mult}% weapon damage around you. Staggers.',
        art: 'a warrior silhouette leaping down onto cracked earth with a shockwave ring',
    },
    ironskin: {
        mastery: 'warfare', tier: 1, kind: 'passive', name: 'Iron Skin', icon: 2,
        fx: { type: 'passive', armorPct: 12, lifePct: 4 },
        per: { armorPct: 12, lifePct: 4 },
        desc: '+{armorPct}% armour and +{lifePct}% maximum life.',
        art: 'a bronze shield with rivets glowing at the rim',
    },
    warcry: {
        mastery: 'warfare', tier: 2, kind: 'active', name: 'War Cry', icon: 3,
        cost: 30, cd: 14, el: 'phys',
        fx: { type: 'buff', buff: 'warcry', dur: 7, dmgPct: 22, radius: 7, taunt: 3, armorBreak: 20 },
        per: { dmgPct: 5 },
        desc: 'Roar: +{dmgPct}% damage for 7 s. Enemies within 7 m turn on you for 3 s and lose 20% armour.',
        art: 'a roaring lion-helmed warrior face with red sound waves',
    },
    bloodlust: {
        mastery: 'warfare', tier: 2, kind: 'passive', name: 'Bloodlust', icon: 4,
        fx: { type: 'passive', atkSpeedPct: 4, lifeOnHit: 2, rageOnHit: 1 },
        per: { atkSpeedPct: 3, lifeOnHit: 2 },
        desc: '+{atkSpeedPct}% attack speed, +{lifeOnHit} life per hit (scaled by level), +1 Rage per hit.',
        art: 'a dripping red axe blade with a pulsing heart',
    },
    whirlwind: {
        mastery: 'warfare', tier: 3, kind: 'active', name: 'Whirlwind', icon: 5,
        cost: 0, drain: 16, cd: 0, el: 'phys', channel: true,
        fx: { type: 'channel', mult: 0.85, radius: 2.5, tick: 0.3, slow: 0.7 },
        per: { mult: 0.1 },
        desc: 'Hold to spin through the crowd: {mult}% weapon damage around you every 0.3 s while moving at 70% speed. Drains 16 Rage a second.',
        art: 'a spinning vortex of steel blades and red wind',
    },
    wrath: {
        mastery: 'warfare', tier: 4, kind: 'active', name: 'Titan\'s Wrath', icon: 6,
        cost: 50, spendAll: true, cd: 24, el: 'phys',
        fx: { type: 'nova', mult: 6.0, radius: 6.5, stun: 1.5, perRage: 0.012 },
        per: { mult: 0.8 },
        desc: 'Spend all your Rage (50 at least) to split the ground: {mult}% weapon damage within 6.5 m, +1.2% per Rage over 50. Stuns for 1.5 s.',
        art: 'a giant bronze fist smashing the ground, golden cracks radiating outward',
    },

    // ------------------------------------------------------------------ Storm (Mana)
    spark: {
        mastery: 'storm', tier: 1, kind: 'active', name: 'Spark Bolt', icon: 7,
        cost: 5, cd: 0, attack: true, el: 'lightning', target: 'aim',
        fx: { type: 'proj', mult: 1.25, speed: 20, range: 14, pierce: 0, radius: 0.35 },
        per: { mult: 0.13, pierce: 0.25 },
        desc: 'Fire a crackling bolt for {mult}% weapon damage as lightning. Pierces {pierce} enemies.',
        art: 'a small bright blue lightning orb streaking forward with a tail',
    },
    chain: {
        mastery: 'storm', tier: 1, kind: 'active', name: 'Chain Lightning', icon: 8,
        cost: 16, cd: 0, el: 'lightning', target: 'enemy',
        fx: { type: 'chain', mult: 1.7, bounces: 3, range: 10, hop: 6 },
        per: { mult: 0.15, bounces: 0.5 },
        desc: 'Lightning leaps from enemy to enemy: {mult}% weapon damage, {bounces} jumps.',
        art: 'a jagged lightning bolt forking between three points',
    },
    staticcharge: {
        mastery: 'storm', tier: 1, kind: 'passive', name: 'Static Charge', icon: 9,
        fx: { type: 'passive', critPct: 3, shockPct: 6 },
        per: { critPct: 2, shockPct: 2 },
        desc: '+{critPct}% critical chance. Lightning hits Shock: the enemy takes +{shockPct}% damage for 3 s (stacks 3 times).',
        art: 'a crackling blue sphere covered in tiny sparks',
    },
    stormshield: {
        mastery: 'storm', tier: 2, kind: 'active', name: 'Storm Shield', icon: 10,
        cost: 24, cd: 12, el: 'lightning',
        fx: { type: 'buff', buff: 'shield', dur: 8, shieldPct: 22, zap: 0.9 },
        per: { shieldPct: 5, zap: 0.15 },
        desc: 'A shell of storm absorbs {shieldPct}% of your maximum life for 8 s. Anything that strikes you takes {zap}% weapon damage back.',
        art: 'a glowing blue hexagonal energy shield with lightning on its edges',
    },
    conduit: {
        mastery: 'storm', tier: 2, kind: 'passive', name: 'Conduit', icon: 11,
        fx: { type: 'passive', lightningPct: 8, manaRegenPct: 10 },
        per: { lightningPct: 6, manaRegenPct: 8 },
        desc: '+{lightningPct}% lightning damage and +{manaRegenPct}% mana regeneration.',
        art: 'a copper rod drawing lightning down from a cloud',
    },
    thunderstrike: {
        mastery: 'storm', tier: 3, kind: 'active', name: 'Thunderstrike', icon: 12,
        cost: 28, cd: 3, el: 'lightning', target: 'ground',
        fx: { type: 'ground', mult: 3.8, radius: 3.0, delay: 0.55, range: 14, stagger: 0.5 },
        per: { mult: 0.45 },
        desc: 'Call a bolt from the sky onto a spot: after a breath, {mult}% weapon damage within 3 m. Staggers.',
        art: 'a huge white-blue lightning bolt hitting the ground from storm clouds',
    },
    tempest: {
        mastery: 'storm', tier: 4, kind: 'active', name: 'Tempest', icon: 13,
        cost: 45, cd: 28, el: 'lightning',
        fx: { type: 'buff', buff: 'tempest', dur: 8, mult: 1.6, every: 0.35, range: 10 },
        per: { mult: 0.2 },
        desc: 'Wear the storm for 8 s: every 0.35 s a bolt strikes a nearby enemy for {mult}% weapon damage.',
        art: 'a swirling hurricane of dark clouds with many lightning bolts around a figure',
    },

    // ------------------------------------------------------------------ Umbra (Essence)
    soulrend: {
        mastery: 'umbra', tier: 1, kind: 'active', name: 'Soul Rend', icon: 14,
        cost: 0, gain: 5, cd: 0, attack: true, el: 'shadow', target: 'enemy',
        fx: { type: 'beam', mult: 1.35, range: 7, heal: 0.12 },
        per: { mult: 0.13, heal: 0.02 },
        desc: 'Tear at a soul within 7 m: {mult}% weapon damage as shadow, and heal for {heal}% of it. Builds 5 Essence.',
        art: 'a violet ghostly hand ripping a glowing wisp from a silhouette',
    },
    bonespear: {
        mastery: 'umbra', tier: 1, kind: 'active', name: 'Bone Spear', icon: 15,
        cost: 18, cd: 0, el: 'shadow', target: 'aim',
        fx: { type: 'proj', mult: 2.6, speed: 26, range: 16, pierce: 99, radius: 0.45 },
        per: { mult: 0.3 },
        desc: 'Hurl a spear of bone that passes through everything in a line: {mult}% weapon damage as shadow.',
        art: 'a long white bone spear wrapped in violet smoke flying forward',
    },
    shadowstep: {
        mastery: 'umbra', tier: 1, kind: 'active', name: 'Shadow Step', icon: 16,
        cost: 10, cd: 5, el: 'shadow', target: 'ground',
        fx: { type: 'blink', range: 8, dr: 30, dur: 1.5 },
        per: { dr: 5 },
        desc: 'Step through shadow to a spot up to 8 m away. For 1.5 s afterwards you take {dr}% less damage.',
        art: 'a dark silhouette dissolving into violet smoke and reappearing',
    },
    shade: {
        mastery: 'umbra', tier: 2, kind: 'active', name: 'Raise Shade', icon: 17,
        cost: 28, cd: 1, el: 'shadow',
        fx: { type: 'summon', max: 2, life: 28, mult: 0.7, hpPct: 35 },
        per: { max: 0.5, mult: 0.1 },
        desc: 'Raise a Shade to fight beside you for 28 s: {mult}% weapon damage a blow. Up to {max} at once.',
        art: 'a ghostly violet warrior spirit rising from a grave mist',
    },
    gravepact: {
        mastery: 'umbra', tier: 2, kind: 'passive', name: 'Grave Pact', icon: 18,
        fx: { type: 'passive', leechPct: 3, minionPct: 12 },
        per: { leechPct: 1, minionPct: 10 },
        desc: 'Heal for {leechPct}% of shadow damage you deal. Shades and your companion deal +{minionPct}% damage.',
        art: 'two clasped skeletal and living hands bound by a violet thread',
    },
    frailty: {
        mastery: 'umbra', tier: 3, kind: 'active', name: 'Curse of Frailty', icon: 19,
        cost: 16, cd: 6, el: 'shadow', target: 'ground',
        fx: { type: 'curse', radius: 4.2, dur: 8, vulnPct: 20, slow: 0.3, range: 14 },
        per: { vulnPct: 5 },
        desc: 'Curse everything within 4 m of a spot for 8 s: they take +{vulnPct}% damage and move 30% slower.',
        art: 'a cracked purple rune circle with a withered eye at its centre',
    },
    harvest: {
        mastery: 'umbra', tier: 4, kind: 'active', name: 'Harvest', icon: 20,
        cost: 50, cd: 24, el: 'shadow',
        fx: { type: 'nova', mult: 4.6, radius: 8, killHeal: 0.05 },
        per: { mult: 0.6 },
        desc: 'Reap every soul within 8 m: {mult}% weapon damage as shadow. Each enemy it kills restores 5% of your life.',
        art: 'a giant violet scythe sweeping a ring of ghostly souls',
    },
};

export const SKILLS_BY_MASTERY = Object.fromEntries(Object.keys(MASTERIES).map((m) => [m, Object.keys(SKILLS).filter((k) => SKILLS[k].mastery === m)]));

/** The value of field `k` of a skill at a rank (rank ≥ 1). */
export function skillVal(id, k, rank) {
    const s = SKILLS[id];
    const base = s.fx[k] ?? 0;
    return base + (s.per?.[k] ?? 0) * Math.max(0, rank - 1);
}

/** The skill's description with its numbers filled in for a rank. */
export function skillText(id, rank) {
    const s = SKILLS[id];
    const r = Math.max(1, rank);
    return s.desc.replace(/\{(\w+)\}/g, (_, k) => {
        const v = skillVal(id, k, r);
        if (k === 'mult' || k === 'zap' || k === 'heal') return Math.round(v * 100);
        if (k === 'bounces' || k === 'pierce' || k === 'max') return Math.floor(v);
        return Math.round(v * 10) / 10;
    });
}
