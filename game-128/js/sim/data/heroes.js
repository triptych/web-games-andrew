// Gemheart Saga — the four starting heroes and their skill trees. Pure data.
//
// Gems: 0 sword, 1 heart, 2 ruby, 3 sapphire, 4 emerald, 5 amethyst (see GEMS in config.js). The four coloured gems
// fill the hero's mana pools r, s, e, a; skills spend them.
//
// base: level-1 stats. hp and atk grow with level (heroStats in sim/stats.js); def comes from armour and passives.
// aff: built-in modifiers (same keys as passives, see MOD_KEYS in sim/stats.js).
//
// Skill tree: three branches of three nodes. Tier 1 of each branch is the branch's active skill; tiers 2 and 3 are
// passives. A node has up to 3 ranks; a tier needs at least one rank in the tier below it, and tier 3 needs hero level 6.
//   active  { cost: { r|s|e|a: n }, eff: { kind, ... } }   kinds: dmg, shield, convert, freeze, blast, summon, heal, stun
//   passive { mod: key, per: amount per rank }
// art: the description the fal prompts were written from (dev/art/prompts.mjs). ART_FACING: battle sprites face right.

export const HEROES = [
    {
        id: 'kael', name: 'Kael Ashborne', title: 'Ashen Knight', tale: 'The Broken Oath',
        pitch: 'A knight of the fallen Order of the Dawn, hunting the brother-in-arms who betrayed it.',
        base: { hp: 130, atk: 12, def: 6 }, aff: { sword: 0.10 },
        color: '#e0603c',
        art: 'a young human knight in soot-darkened steel plate armour with a tattered crimson tabard bearing a broken golden sun sigil, short black hair, a scar across one cheek, a longsword raised in one hand and a battered kite shield in the other',
        portrait: 'a young human knight with short black hair, a scar across one cheek, determined grey eyes, soot-darkened steel pauldrons and a tattered crimson tabard with a broken golden sun sigil',
        voiceHint: 'young male, earnest, steely, heroic knight',
        lines: {
            cry: 'For the Dawn!',
            win: 'Rest easy. It\'s over.',
            hurt: 'I\'ve had worse… I think.',
            intro: 'I swore an oath to the Order of the Dawn. The Order is ash now, and the man who burned it still walks free.',
        },
        tree: [
            { branch: 'Blade', nodes: [
                { id: 'k_sunder', name: 'Sundering Strike', type: 'active', cost: { r: 10 }, eff: { kind: 'dmg', mult: 4, per: 1.2 }, desc: 'A burning overhead blow for {m}× attack.' },
                { id: 'k_steel', name: 'Steel Discipline', type: 'passive', mod: 'sword', per: 0.12, desc: 'Sword gems deal +{p}% damage.' },
                { id: 'k_exec', name: 'Executioner', type: 'passive', mod: 'execute', per: 0.25, desc: '+{p}% damage to foes below 35% health.' },
            ] },
            { branch: 'Bulwark', nodes: [
                { id: 'k_aegis', name: 'Aegis', type: 'active', cost: { s: 10 }, eff: { kind: 'shield', pct: 0.25, per: 0.1 }, desc: 'Raise a shield worth {p}% of your max health.' },
                { id: 'k_iron', name: 'Iron Hide', type: 'passive', mod: 'defPct', per: 0.07, desc: 'Take {p}% less damage.' },
                { id: 'k_wind', name: 'Second Wind', type: 'passive', mod: 'heart', per: 0.15, desc: 'Heart gems heal +{p}%.' },
            ] },
            { branch: 'Oath', nodes: [
                { id: 'k_oathfire', name: 'Oathfire', type: 'active', cost: { r: 6, a: 6 }, eff: { kind: 'convert', from: 3, to: 0, n: 5, per: 2 }, desc: 'Turn {n} sapphires into swords.' },
                { id: 'k_valor', name: 'Valor', type: 'passive', mod: 'chain', per: 0.1, desc: 'Each cascade adds +{p}% more damage.' },
                { id: 'k_rally', name: 'Rally', type: 'passive', mod: 'startMana', per: 3, desc: 'Begin every battle with {v} mana of each colour.' },
            ] },
        ],
    },
    {
        id: 'sela', name: 'Sela Moonbrook', title: 'Tide Mage', tale: 'The Drowned Library',
        pitch: 'An apprentice of the Moonbrook Archive, searching for the master who vanished beneath the water.',
        base: { hp: 105, atk: 11, def: 4 }, aff: { skill: 0.2, gain_s: 0.2, gain_a: 0.2 },
        color: '#4c8fe0',
        art: 'a young woman mage with long silver-blue hair in a loose braid, flowing deep blue robes embroidered with silver wave patterns, holding a tall staff topped with a glowing sapphire orb, a leather satchel of scrolls at her hip, casting with her free hand',
        portrait: 'a young woman mage with long silver-blue hair in a loose braid, thoughtful sea-green eyes, deep blue robes with silver wave embroidery and a sapphire pendant',
        voiceHint: 'young female, bright, clever, warm, a little wry',
        lines: {
            cry: 'Tide, answer me!',
            win: 'Fascinating. Let\'s write that down.',
            hurt: 'Ow! That was not in the books.',
            intro: 'Master Quell went down into the drowned stacks and never came back up. Everyone says to let the water keep him. I don\'t.',
        },
        tree: [
            { branch: 'Tidecraft', nodes: [
                { id: 's_torrent', name: 'Torrent', type: 'active', cost: { s: 10 }, eff: { kind: 'blast', cols: 1, per: 1, mult: 0.6 }, desc: 'A wave sweeps {n} column(s) clean; every gem in it counts as matched.' },
                { id: 's_wells', name: 'Deep Wells', type: 'passive', mod: 'gain', per: 0.1, desc: 'Gain +{p}% mana from every gem.' },
                { id: 's_under', name: 'Undertow', type: 'passive', mod: 'slow', per: 0.06, desc: 'Enemies attack {p}% more slowly.' },
            ] },
            { branch: 'Arcana', nodes: [
                { id: 's_bolt', name: 'Arcane Lance', type: 'active', cost: { a: 10 }, eff: { kind: 'dmg', mult: 5, per: 1.5 }, desc: 'A lance of starlight for {m}× attack.' },
                { id: 's_weave', name: 'Spellweave', type: 'passive', mod: 'skill', per: 0.15, desc: 'Skills deal +{p}% damage.' },
                { id: 's_over', name: 'Overflow', type: 'passive', mod: 'overflow', per: 2, desc: 'Matching 4 or more gives +{v} extra mana of that colour.' },
            ] },
            { branch: 'Frost', nodes: [
                { id: 's_prison', name: 'Glacial Prison', type: 'active', cost: { s: 6, e: 6 }, eff: { kind: 'freeze', secs: 4, per: 1, mult: 2 }, desc: 'Freeze the foe for {s} s and deal 2× attack.' },
                { id: 's_armor', name: 'Frost Armour', type: 'passive', mod: 'defPct', per: 0.06, desc: 'Take {p}% less damage.' },
                { id: 's_shatter', name: 'Shatter', type: 'passive', mod: 'frozen', per: 0.25, desc: 'Frozen foes take +{p}% damage.' },
            ] },
        ],
    },
    {
        id: 'fenn', name: 'Fenn Quickfoot', title: 'Thornwood Ranger', tale: 'The Withering Wood',
        pitch: 'A half-elf ranger of the Thornwood, tracking a blight that turns living trees to rot.',
        base: { hp: 130, atk: 12, def: 6 }, aff: { crit: 0.08 },
        color: '#5fb050',
        art: 'a lean young half-elf ranger with messy auburn hair and pointed ears, a green hooded cloak, leather armour with leaf motifs, drawing a longbow with an arrow nocked, a quiver on his back',
        portrait: 'a lean young half-elf ranger with messy auburn hair, pointed ears, a confident lopsided grin, freckles, a green hooded cloak and leather armour with leaf motifs',
        voiceHint: 'young male, playful, quick, confident ranger',
        lines: {
            cry: 'Ash, with me!',
            win: 'Clean shot. The wood thanks you.',
            hurt: 'Hah, missed my heart!',
            intro: 'The old oaks are dying from the inside. The rot has a smell to it, and I\'m going to follow that smell to whoever started it.',
        },
        tree: [
            { branch: 'Marksman', nodes: [
                { id: 'f_volley', name: 'Volley', type: 'active', cost: { e: 10 }, eff: { kind: 'dmg', mult: 1.6, hits: 3, per: 0.45 }, desc: 'Three arrows of {m}× attack each.' },
                { id: 'f_eye', name: 'Keen Eye', type: 'passive', mod: 'crit', per: 0.06, desc: '+{p}% critical chance on sword gems.' },
                { id: 'f_dead', name: 'Deadeye', type: 'passive', mod: 'critDmg', per: 0.3, desc: 'Critical hits deal +{p}% damage.' },
            ] },
            { branch: 'Wilds', nodes: [
                { id: 'f_snare', name: 'Briar Snare', type: 'active', cost: { e: 6, r: 6 }, eff: { kind: 'convert', from: -1, to: 0, n: 6, per: 2, delay: 1.5 }, desc: 'Turn {n} random gems into swords and tangle the foe (+1.5 s).' },
                { id: 'f_forage', name: 'Forager', type: 'passive', mod: 'loot', per: 0.12, desc: '+{p}% gold and materials from battles.' },
                { id: 'f_lore', name: 'Herb Lore', type: 'passive', mod: 'heart', per: 0.15, desc: 'Heart gems heal +{p}%.' },
            ] },
            { branch: 'Beast', nodes: [
                { id: 'f_wolf', name: 'Call Ash', type: 'active', cost: { a: 10 }, eff: { kind: 'summon', secs: 10, every: 2, mult: 0.8, per: 0.3 }, desc: 'Ash the wolf bites every 2 s for 10 s ({m}× attack).' },
                { id: 'f_pack', name: 'Pack Tactics', type: 'passive', mod: 'sword', per: 0.1, desc: 'Sword gems deal +{p}% damage.' },
                { id: 'f_swift', name: 'Swiftstep', type: 'passive', mod: 'slow', per: 0.05, desc: 'Enemies attack {p}% more slowly.' },
            ] },
        ],
    },
    {
        id: 'odo', name: 'Brother Odo', title: 'Lantern Monk', tale: 'The Dimming',
        pitch: 'A monk of the Lantern Temple, sent out when the sacred flame began to fail.',
        base: { hp: 145, atk: 11, def: 6 }, aff: { heart: 0.2 },
        color: '#e8b040',
        art: 'a broad-shouldered bald monk with a short brown beard, saffron and white robes, wooden prayer beads, cloth-wrapped fists raised in a fighting stance, a small brass lantern hanging from his belt glowing warmly',
        portrait: 'a broad-shouldered bald monk with a short brown beard, kind crinkled eyes, saffron and white robes, wooden prayer beads, a warm lantern glow on his face',
        voiceHint: 'middle-aged male, warm, calm, deep, gently humorous',
        lines: {
            cry: 'Be still, and be struck!',
            win: 'Peace to you, poor creature.',
            hurt: 'Hm. Humbling.',
            intro: 'The flame in the Lantern Temple has burned for nine hundred years. Last winter it began to gutter. Somebody out there is drinking the light.',
        },
        tree: [
            { branch: 'Light', nodes: [
                { id: 'o_flare', name: 'Lantern Flare', type: 'active', cost: { r: 10 }, eff: { kind: 'dmg', mult: 3.5, per: 1, delay: 2 }, desc: 'A blinding flash for {m}× attack; the foe loses 2 s.' },
                { id: 'o_flame', name: 'Inner Flame', type: 'passive', mod: 'skill', per: 0.12, desc: 'Skills deal +{p}% damage.' },
                { id: 'o_pure', name: 'Purify', type: 'passive', mod: 'purify', per: 1, desc: 'Each heart match breaks {v} stone or doom gem(s) on the board.' },
            ] },
            { branch: 'Palm', nodes: [
                { id: 'o_palms', name: 'Hundred Palms', type: 'active', cost: { e: 6, s: 6 }, eff: { kind: 'dmg', mult: 0.7, hits: 6, per: 0.2 }, desc: 'Six strikes of {m}× attack.' },
                { id: 'o_fist', name: 'Iron Fist', type: 'passive', mod: 'sword', per: 0.12, desc: 'Sword gems deal +{p}% damage.' },
                { id: 'o_flow', name: 'Flow', type: 'passive', mod: 'flow', per: 1, desc: 'Each cascade gives +{v} mana of a random colour.' },
            ] },
            { branch: 'Serenity', nodes: [
                { id: 'o_prayer', name: 'Mending Prayer', type: 'active', cost: { e: 10 }, eff: { kind: 'heal', pct: 0.3, per: 0.1 }, desc: 'Heal {p}% of your max health.' },
                { id: 'o_still', name: 'Stillness', type: 'passive', mod: 'defPct', per: 0.07, desc: 'Take {p}% less damage.' },
                { id: 'o_martyr', name: 'Last Light', type: 'passive', mod: 'lowHeal', per: 0.4, desc: 'Below 30% health, heart gems heal +{p}%.' },
            ] },
        ],
    },
];

export const HERO = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const NODE = {};
for (const h of HEROES) h.tree.forEach((b, bi) => b.nodes.forEach((n, ti) => { NODE[n.id] = { ...n, hero: h.id, bi, tier: ti }; }));
export const MAX_RANK = 3;
export const TIER3_LEVEL = 6;
