// The Grimoire of Mending (skill tree), remedies and relics. Pure data.

export const BRANCHES = {
    herb: { label: 'Herbalism', icon: '🌿', css: '#6fdc8c', blurb: 'Roots, teas and patience. More Focus, fuller vials.' },
    hex: { label: 'Hexcraft', icon: '✨', css: '#b98cff', blurb: 'Words that undo words. Lifeblooms, bindings and wild trails.' },
    surg: { label: 'Surgery', icon: '🩸', css: '#ff7a7a', blurb: 'A steady hand and a sharp lancet. Long trails pay you back.' },
};

// Each node needs the one before it in its branch. `mod` is applied to every scan.
export const SKILLS = [
    { id: 'breath', branch: 'herb', tier: 0, cost: 1, label: 'Deep Breath', icon: '🌬️', desc: '+2 Focus in every scan.' },
    { id: 'steeped', branch: 'herb', tier: 1, cost: 1, label: 'Steeped Vials', icon: '🫙', desc: 'Every vial needs 2 fewer motes.' },
    { id: 'tonic', branch: 'herb', tier: 2, cost: 1, label: 'Strong Tonic', icon: '🍵', desc: 'The tonic gives 8 Focus instead of 5.' },
    { id: 'brimming', branch: 'herb', tier: 3, cost: 2, label: 'Brimming', icon: '⚗️', desc: 'Start every scan with a Purging Draught charge.' },
    { id: 'verdant', branch: 'herb', tier: 4, cost: 2, label: 'Verdant Heart', icon: '💚', desc: '+3 more Focus in every scan.' },

    { id: 'bloomlore', branch: 'hex', tier: 0, cost: 1, label: 'Bloom Lore', icon: '🌸', desc: 'Lifeblooms grow from trails of 6 instead of 7.' },
    { id: 'unbinding', branch: 'hex', tier: 1, cost: 1, label: 'Unbinding Word', icon: '🔓', desc: 'One treatment breaks two binding layers.' },
    { id: 'radiant', branch: 'hex', tier: 2, cost: 1, label: 'Radiant Bloom', icon: '🌟', desc: 'A treated lifebloom also treats every mote around it.' },
    { id: 'deepvials', branch: 'hex', tier: 3, cost: 2, label: 'Deep Vials', icon: '🧪', desc: 'Vials hold 3 charges instead of 2.' },
    { id: 'lantern', branch: 'hex', tier: 4, cost: 2, label: 'Lantern Soul', icon: '🏮', desc: 'Every 5th trail, Pip blazes: your next trail can hop between any motes.' },

    { id: 'steady', branch: 'surg', tier: 0, cost: 1, label: 'Steady Hand', icon: '✋', desc: 'Trails of 6 or more give back 1 Focus.' },
    { id: 'widelancet', branch: 'surg', tier: 1, cost: 1, label: 'Wide Lancet', icon: '🗡️', desc: 'The Lancet Burst also reaches the four cells beyond its 3×3.' },
    { id: 'debride', branch: 'surg', tier: 2, cost: 1, label: 'Debride', icon: '🩹', desc: 'Scar tissue softens two layers at once.' },
    { id: 'triage', branch: 'surg', tier: 3, cost: 2, label: 'Triage', icon: '⏱️', desc: 'Your first trail in every scan costs no Focus.' },
    { id: 'master', branch: 'surg', tier: 4, cost: 2, label: "Master's Touch", icon: '🖐️', desc: 'Trails of 5 or more give back 1 Focus.' },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const ITEMS = {
    salts: { label: 'Smelling Salts', icon: '🧂', price: 25, desc: '+3 Focus. Works even when you have run out.' },
    calm: { label: 'Calm Draught', icon: '🍶', price: 20, desc: 'Settles the patient: reshuffles the grid.' },
    star: { label: 'Starpetal Tonic', icon: '🌠', price: 40, desc: 'Fills your fullest vial at once.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const ITEM_MAX = 3;

// Clinic upgrades: bought once with moonpetals at the apothecary shelf, and seen in the clinic.
export const UPGRADES = {
    table: { label: 'Padded Exam Table', icon: '🛏️', price: 120, desc: 'Patients relax: +1 Focus in every scan.' },
    satchel: { label: 'Bigger Satchel', icon: '🎒', price: 150, desc: 'Carry 5 of each remedy instead of 3.' },
    vase: { label: 'Moonflower Vase', icon: '🌸', price: 180, desc: 'The waiting room smells lovely: +25% renown from every patient.' },
    chandelier: { label: 'Lumen Chandelier', icon: '🕯️', price: 260, desc: 'The Lens burns brighter: every vial needs 1 fewer mote.' },
    still: { label: 'Copper Still', icon: '⚗️', price: 340, desc: 'Brews remedies overnight: one free remedy every time you rest.' },
};
export const UPGRADE_IDS = Object.keys(UPGRADES);
export const itemMax = (G) => (G.upgrades?.satchel ? 5 : ITEM_MAX);

export const RELICS = {
    quill: { label: 'Owl-Feather Quill', icon: '🪶', desc: '+1 Focus in every scan.', where: 'Bramblewood Hollow' },
    lens: { label: 'Moonlit Lens', icon: '🔍', desc: 'Every vial needs 1 fewer mote.', where: 'the Drowned Crypt' },
    glove: { label: 'Dragonscale Glove', icon: '🧤', desc: 'Start every scan with a Lancet Burst charge.', where: 'Emberpeak Forge' },
};

export const EVIDENCE = {
    arrow: { label: 'Gilded Arrow', icon: '🏹', desc: 'Golden fletching, an Aurelune smith\'s mark, and the Gilded Company\'s sunburst crest. Pulled from Mother Bramblehide.' },
    scroll: { label: 'Hex Scroll', icon: '📜', desc: 'A binding hex in a neat academic hand, signed "C. H., Magister". Found in the Drowned Crypt.' },
    lance: { label: 'Broken Gilded Lance', icon: '🔱', desc: 'The tip of a paladin\'s lance, gold-chased, snapped off in a dragon\'s wing. Engraved: "A. G."' },
    ledger: { label: "Vessa's Ledger", icon: '📒', desc: 'The Company\'s accounts. "One crown, the Diadem of Wrath, sent as tribute. Fever to follow. Bounty on the Overlord: one dukedom." In Vessa Nightquill\'s hand.' },
};
export const EVIDENCE_IDS = Object.keys(EVIDENCE);

/** Scan modifiers from skills and relics. */
export function scanMods(skills, relics, senses, upgrades = {}) {
    const has = (id) => !!skills[id];
    const rel = (id) => relics.includes(id);
    const start = [];
    if (has('brimming')) start.push('draught');
    if (rel('glove') && senses.includes('sev')) start.push('lancet');
    return {
        focus: (has('breath') ? 2 : 0) + (has('verdant') ? 3 : 0) + (rel('quill') ? 1 : 0) + (upgrades.table ? 1 : 0),
        vialLess: (has('steeped') ? 2 : 0) + (rel('lens') ? 1 : 0) + (upgrades.chandelier ? 1 : 0),
        tonic: has('tonic') ? 8 : 5,
        start,
        bloomChain: has('bloomlore') ? 6 : 7,
        unbind: has('unbinding') ? 2 : 1,
        radiant: has('radiant'),
        maxCharges: has('deepvials') ? 3 : 2,
        lantern: has('lantern') ? 5 : 0,
        steady: has('master') ? 5 : has('steady') ? 6 : 0,
        wideLancet: has('widelancet'),
        debride: has('debride') ? 2 : 1,
        triage: has('triage'),
    };
}

/** Can this skill be learned now? */
export function canLearn(G, id) {
    const s = SKILL_BY_ID[id];
    if (!s || G.skills[id]) return false;
    if (G.points < s.cost) return false;
    if (s.tier > 0) {
        const prev = SKILLS.find((x) => x.branch === s.branch && x.tier === s.tier - 1);
        if (!G.skills[prev.id]) return false;
    }
    return true;
}

/** Renown needed to reach level n+1 from level n. */
export const renownFor = (level) => 60 + level * 40;
