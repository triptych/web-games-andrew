/**
 * mods.js — modules (enhancements). Each one changes how the reels behave, and
 * carries a rolled stat bonus. Rarity sets the level cap and bonus size;
 * levels are bought with scrap.
 */

export const RARITIES = [
    { id: 'common', name: 'Common', color: '#c8d3e6', maxLv: 3, bonus: 1, w: 60 },
    { id: 'rare', name: 'Rare', color: '#4da3ff', maxLv: 5, bonus: 1.6, w: 28 },
    { id: 'epic', name: 'Epic', color: '#c46bff', maxLv: 7, bonus: 2.4, w: 10 },
    { id: 'legendary', name: 'Legendary', color: '#ffae35', maxLv: 10, bonus: 3.5, w: 2.5 },
];

export const MODS = {
    cascade:   { name: 'Cascade Feed', icon: 'cascade', desc: (lv) => `Winning symbols shatter and new ones fall in. Up to ${cascades(lv)} cascade${cascades(lv) > 1 ? 's' : ''} per spin; each one keeps the chain going.` },
    expand:    { name: 'Expanding Overclock', icon: 'expand', desc: (lv) => `${expandChance(lv)}% chance each landed wild expands to fill its whole reel.` },
    sticky:    { name: 'Sticky Overclock', icon: 'sticky', desc: (lv) => `Wilds stay where they land for ${lv >= 4 ? 2 : 1} more spin${lv >= 4 ? 's' : ''}.` },
    mirror:    { name: 'Mirror Logic', icon: 'mirror', desc: (lv) => `Lines also pay right to left, at ${Math.round(mirrorMult(lv) * 100)}%.` },
    conductor: { name: 'Arc Conductor', icon: 'arc', needs: 'arc', desc: (lv) => `Arcs jump to ${1 + Math.ceil(lv / 2)} more targets and lose no power when they jump.` },
    claw:      { name: 'Salvage Claw', icon: 'scrap', desc: (lv) => `Scrap symbols are worth ×${(1 + lv * 0.5).toFixed(1)}.` },
    eater:     { name: 'Glitch Eater', icon: 'glitch', desc: (lv) => (lv >= 3 ? 'Glitches count as wilds.' : 'Every Glitch on the grid gives 1 energy. At level 3 they count as wilds.') },
    twin:      { name: 'Twin-Link Blades', icon: 'blade', desc: (lv) => `Blade lines strike a second time at ${40 + 10 * lv}%.` },
    splitter:  { name: 'Payload Splitter', icon: 'missile', needs: 'missile', desc: (lv) => `Missile lines fire ${Math.ceil(lv / 3)} extra volley${lv > 3 ? 's' : ''} at ${50 + 5 * lv}%.` },
    overheat:  { name: 'Overheat Valve', icon: 'energy', desc: (lv) => `On ENGAGE, unspent energy vents at your target: ${4 + 2 * lv}× blade power per point.` },
    magnet:    { name: 'Scatter Magnet', icon: 'core', desc: (lv) => `+${Math.ceil(lv / 2)} Core on every strip.` },
    cluster:   { name: 'Cluster Protocol', icon: 'cluster', desc: (lv) => `Groups of ${lv >= 5 ? 4 : 5}+ touching identical symbols fire as a line of their size.` },
    seventh:   { name: 'Seventh Heaven', icon: 'seven', desc: (lv) => `Every 7th spin, everything fires at ×${(2 + 0.5 * lv).toFixed(1)}.` },
    echo:      { name: 'Echo Chamber', icon: 'echo', desc: (lv) => `Your best line fires again at ${25 + 10 * lv}%.` },
    leech:     { name: 'Leech Rounds', icon: 'repair', desc: (lv) => `Repair ${2 + lv}% of the damage you deal.` },
    thorns:    { name: 'Thorn Field', icon: 'shield', desc: (lv) => `Reflect ${20 + 10 * lv}% of the damage your shield blocks.` },
    daemon:    { name: 'Targeting Daemon', icon: 'crit', desc: (lv) => `+${4 * lv}% crit chance for attack symbols.` },
    capacitor: { name: 'Capacitor Bank', icon: 'reactor', desc: (lv) => `+${Math.ceil(lv / 2)} max energy, and start every fight fully charged.` },
};
export const MOD_IDS = Object.keys(MODS);

export const cascades = (lv) => 1 + Math.floor(lv / 3);
export const expandChance = (lv) => Math.min(90, 30 + 8 * lv);
export const mirrorMult = (lv) => Math.min(1, 0.6 + 0.06 * lv);

export const STATS = {
    blade: { name: 'Blade damage', pct: true, roll: 8 },
    cannon: { name: 'Cannon damage', pct: true, roll: 8 },
    missile: { name: 'Missile damage', pct: true, roll: 9 },
    arc: { name: 'Arc damage', pct: true, roll: 9 },
    shield: { name: 'Shield power', pct: true, roll: 9 },
    repair: { name: 'Repair power', pct: true, roll: 10 },
    hp: { name: 'Max hull', pct: true, roll: 7 },
    scrap: { name: 'Scrap found', pct: true, roll: 10 },
    crit: { name: 'Crit chance', pct: true, roll: 2 },
};
export const STAT_IDS = Object.keys(STATS);

/** The module's stat bonus at its current level, in percent. */
export function modStat(m) {
    return Math.round(m.val * (1 + 0.15 * (m.lv - 1)) * 10) / 10;
}

export function modUpgradeCost(m) {
    if (m.lv >= RARITIES[m.rar].maxLv) return null;
    return Math.round(90 * (1 + m.rar) * Math.pow(2.1, m.lv - 1));
}
export function modSalvage(m) {
    return Math.round(30 * Math.pow(1 + m.rar, 2) * m.lv);
}

/**
 * Roll a module. `luck` (0..1+) shifts rarity upward (chapter depth, elites, bosses).
 * `owned` (array of mods) lowers the chance of rolling exact duplicates.
 */
export function rollMod(rng, uid, luck = 0, owned = []) {
    const w = {};
    RARITIES.forEach((r, i) => { w[i] = r.w * Math.pow(1 + luck, i); });
    const rar = Number(rng.weighted(w));
    let id = rng.pick(MOD_IDS);
    for (let i = 0; i < 3 && owned.some((m) => m.id === id); i++) id = rng.pick(MOD_IDS);
    const stat = rng.pick(STAT_IDS);
    const val = Math.round(STATS[stat].roll * RARITIES[rar].bonus * rng.range(0.8, 1.25) * 10) / 10;
    return { uid, id, rar, lv: 1, stat, val };
}

export function modName(m) {
    return MODS[m.id].name;
}
