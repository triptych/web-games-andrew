// The sixteen COM-bot types and the effectiveness chart.
// Read a row as "an attack of this type against a defender of that type".

export const TYPES = ['scrap', 'steam', 'blaze', 'hydro', 'frost', 'volt', 'grit', 'aero', 'iron', 'gear', 'toxic', 'moss', 'piston', 'signal', 'rust', 'void'];

export const TYPE_INFO = {
    scrap:  { name: 'Scrap',  color: '#b8a888', glow: '#ffe8c0', icon: '🔩', blurb: 'Junk-built generalists. Nothing is weak to them, and they are weak to brute force.' },
    steam:  { name: 'Steam',  color: '#d8d0c8', glow: '#ffffff', icon: '♨️', blurb: 'Boilers and pressure. They scald ice, plants and rust clean.' },
    blaze:  { name: 'Blaze',  color: '#ff6a2a', glow: '#ff9a3a', icon: '🔥', blurb: 'Furnace-hearted bots that melt metal and ice.' },
    hydro:  { name: 'Hydro',  color: '#3a8ae8', glow: '#6ac8ff', icon: '💧', blurb: 'Pumps, hoses and diving bells. They douse fires and wash away grit.' },
    frost:  { name: 'Frost',  color: '#8ae0ff', glow: '#c8f4ff', icon: '❄️', blurb: 'Coolant-cooled machines. Brittle, but deadly to fliers and voidcraft.' },
    volt:   { name: 'Volt',   color: '#ffd82a', glow: '#fff07a', icon: '⚡', blurb: 'Tesla coils and capacitors. Grit grounds them out completely.' },
    grit:   { name: 'Grit',   color: '#c8984a', glow: '#ffd08a', icon: '⛏️', blurb: 'Diggers, drills and sand-blasters. Fliers ride above their attacks.' },
    aero:   { name: 'Aero',   color: '#9ad0e8', glow: '#e0f6ff', icon: '🪁', blurb: 'Propellers, wings and turbines. They blow steam and smog away.' },
    iron:   { name: 'Iron',   color: '#8a929e', glow: '#d0d8e4', icon: '🛡️', blurb: 'Heavy plating. Hard to hurt, but acid, fire and rust eat through.' },
    gear:   { name: 'Gear',   color: '#d4a83a', glow: '#ffd86a', icon: '⚙️', blurb: 'Clockwork precision. Order beats brute force, chaos and noise.' },
    toxic:  { name: 'Toxic',  color: '#8ad83a', glow: '#c8ff6a', icon: '☣️', blurb: 'Acid, sludge and fumes. Their acid eats plating and plants alike.' },
    moss:   { name: 'Moss',   color: '#4ab85a', glow: '#8aff8a', icon: '🌿', blurb: 'Bots overgrown by the planet\'s hardy moss. They reclaim water, earth and rust.' },
    piston: { name: 'Piston', color: '#d85a3a', glow: '#ff8a6a', icon: '👊', blurb: 'Hydraulic brawlers. They crush plating, ice and rust.' },
    signal: { name: 'Signal', color: '#e86ad8', glow: '#ffaaf0', icon: '📡', blurb: 'Radio, data and sound. Clever, but fragile against current and decay.' },
    rust:   { name: 'Rust',   color: '#a8582a', glow: '#ff9a5a', icon: '🦴', blurb: 'Haunted wrecks that should have stopped long ago. Steam cleans them away.' },
    void:   { name: 'Void',   color: '#7a4ae8', glow: '#c08aff', icon: '🌌', blurb: 'Alien and orbital tech fallen from the sky. Powerful and strange.' },
};

// attacker -> { super: [...], weak: [...], none: [...] }
const CHART = {
    scrap:  { super: [], weak: ['iron', 'rust'], none: [] },
    steam:  { super: ['frost', 'moss', 'rust'], weak: ['steam', 'hydro', 'aero', 'void'], none: [] },
    blaze:  { super: ['frost', 'moss', 'iron', 'gear'], weak: ['blaze', 'hydro', 'steam', 'grit', 'void'], none: [] },
    hydro:  { super: ['blaze', 'grit', 'toxic'], weak: ['hydro', 'moss', 'void', 'frost'], none: [] },
    frost:  { super: ['aero', 'moss', 'grit', 'void'], weak: ['blaze', 'steam', 'frost', 'iron', 'hydro'], none: [] },
    volt:   { super: ['hydro', 'aero', 'gear', 'signal'], weak: ['volt', 'moss', 'void', 'rust'], none: ['grit'] },
    grit:   { super: ['volt', 'blaze', 'steam', 'toxic'], weak: ['moss', 'piston'], none: ['aero'] },
    aero:   { super: ['moss', 'piston', 'steam', 'toxic'], weak: ['volt', 'iron', 'gear'], none: [] },
    iron:   { super: ['frost', 'grit', 'aero'], weak: ['iron', 'blaze', 'hydro', 'volt'], none: [] },
    gear:   { super: ['piston', 'void', 'signal'], weak: ['iron', 'rust', 'gear', 'blaze'], none: [] },
    toxic:  { super: ['moss', 'iron'], weak: ['toxic', 'grit', 'rust'], none: [] },
    moss:   { super: ['hydro', 'grit', 'rust'], weak: ['blaze', 'moss', 'aero', 'toxic', 'iron', 'steam'], none: [] },
    piston: { super: ['iron', 'frost', 'rust', 'scrap'], weak: ['aero', 'signal', 'toxic', 'gear'], none: [] },
    signal: { super: ['piston', 'toxic'], weak: ['signal', 'iron'], none: ['void'] },
    rust:   { super: ['iron', 'gear', 'signal'], weak: ['rust', 'moss', 'void', 'steam'], none: [] },
    void:   { super: ['void', 'signal', 'rust'], weak: ['iron', 'gear'], none: [] },
};

/** Multiplier of one attacking type against one defending type. */
export function typeEff(atk, def) {
    const c = CHART[atk];
    if (!c || !def) return 1;
    if (c.none.includes(def)) return 0;
    if (c.super.includes(def)) return 2;
    if (c.weak.includes(def)) return 0.5;
    return 1;
}

/** Multiplier against a list of defending types. */
export function effAgainst(atk, defTypes) {
    let m = 1;
    for (const t of defTypes) m *= typeEff(atk, t);
    return m;
}

export function effText(m) {
    if (m === 0) return 'It has no effect…';
    if (m >= 4) return 'A devastating hit!';
    if (m >= 2) return "It's super effective!";
    if (m <= 0.25) return 'It barely scratches the plating…';
    if (m < 1) return "It's not very effective…";
    return '';
}

/** Defensive summary for the registry: { weak: [...], resist: [...], immune: [...] } */
export function defensiveProfile(defTypes) {
    const weak = [], resist = [], immune = [];
    for (const t of TYPES) {
        const m = effAgainst(t, defTypes);
        if (m === 0) immune.push(t);
        else if (m > 1) weak.push(t);
        else if (m < 1) resist.push(t);
    }
    return { weak, resist, immune };
}
