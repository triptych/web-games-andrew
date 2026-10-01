/**
 * skills.js — the pilot's three skill trees. One skill point per pilot level.
 * `row`/`col` place the node in its branch for the tree view; `req` must have
 * at least one rank before this node can be learned.
 */

export const BRANCHES = {
    gunner: { name: 'Gunner', color: '#ff5a6e', blurb: 'Raw firepower and kill chains.' },
    guardian: { name: 'Guardian', color: '#4d9dff', blurb: 'Shields that hold and hulls that last.' },
    gambler: { name: 'Gambler', color: '#ffc843', blurb: 'Bend the odds. Wilds, cores, streaks.' },
};

export const SKILLS = {
    // ---------------- Gunner
    g_disc:   { branch: 'gunner', row: 0, col: 1, max: 3, name: 'Trigger Discipline', desc: (r) => `+${8 * r}% damage from all attack symbols.` },
    g_hot:    { branch: 'gunner', row: 1, col: 0, max: 3, req: 'g_disc', name: 'Hot Barrels', desc: (r) => `Loose attack symbols (in no line) fire +${20 * r}% harder.` },
    g_focus:  { branch: 'gunner', row: 1, col: 2, max: 2, req: 'g_disc', name: 'Focus Fire', desc: (r) => `The first line each spin fires at ×${(1.5 + 0.25 * (r - 1)).toFixed(2)}.` },
    g_crit:   { branch: 'gunner', row: 2, col: 0, max: 3, req: 'g_hot', name: 'Critical Path', desc: (r) => `+${5 * r}% crit chance (crits deal ×2).` },
    g_spree:  { branch: 'gunner', row: 2, col: 2, max: 1, req: 'g_focus', name: 'Killing Spree', desc: () => 'Every kill restores 1 energy.' },
    g_ord:    { branch: 'gunner', row: 3, col: 1, max: 3, req: 'g_crit', name: 'Ordnance Expert', desc: (r) => `Missiles and Arcs +${15 * r}%.` },
    g_over:   { branch: 'gunner', row: 4, col: 1, max: 1, req: 'g_ord', name: 'Overkill Transfer', desc: () => 'Damage past a kill carries into the next enemy.' },
    g_storm:  { branch: 'gunner', row: 5, col: 1, max: 1, req: 'g_over', name: 'Bullet Storm', desc: () => 'CAPSTONE — each link in a chain adds ×0.5 instead of ×0.25.', cap: true },
    // ---------------- Guardian
    d_frame:  { branch: 'guardian', row: 0, col: 1, max: 3, name: 'Reinforced Frame', desc: (r) => `+${10 * r}% max hull.` },
    d_defl:   { branch: 'guardian', row: 1, col: 0, max: 3, req: 'd_frame', name: 'Deflector Tuning', desc: (r) => `Shield symbols +${15 * r}%.` },
    d_medic:  { branch: 'guardian', row: 1, col: 2, max: 3, req: 'd_frame', name: 'Field Medic', desc: (r) => `Repair symbols +${20 * r}%; heal ${4 * r}% hull after every win.` },
    d_memory: { branch: 'guardian', row: 2, col: 0, max: 1, req: 'd_defl', name: 'Shield Memory', desc: () => 'Half of your shield carries into the next turn.' },
    d_thorns: { branch: 'guardian', row: 2, col: 1, max: 2, req: 'd_defl', name: 'Spiked Field', desc: (r) => `Reflect ${25 * r}% of the damage your shield blocks.` },
    d_emerg:  { branch: 'guardian', row: 2, col: 2, max: 1, req: 'd_medic', name: 'Emergency Protocol', desc: () => 'Once per fight, dropping under 30% hull raises a shield of 40% max hull.' },
    d_hard:   { branch: 'guardian', row: 3, col: 1, max: 3, req: 'd_memory', name: 'Hardened', desc: (r) => `Take ${6 * r}% less damage.` },
    d_bastion:{ branch: 'guardian', row: 4, col: 1, max: 1, req: 'd_hard', name: 'Bastion', desc: () => 'CAPSTONE — Shield symbols also strike your target for half the shield they raise.', cap: true },
    // ---------------- Gambler
    l_charm:  { branch: 'gambler', row: 0, col: 1, max: 2, name: 'Lucky Charm', desc: (r) => `+${r} Overclock wild on every strip.` },
    l_hands:  { branch: 'gambler', row: 1, col: 0, max: 1, req: 'l_charm', name: 'Steady Hands', desc: () => '+1 free nudge every turn.' },
    l_near:   { branch: 'gambler', row: 1, col: 2, max: 1, req: 'l_charm', name: 'Near Miss', desc: () => 'Two-of-a-kind from the left pays as a small line.' },
    l_streak: { branch: 'gambler', row: 2, col: 0, max: 3, req: 'l_hands', name: 'Hot Streak', desc: (r) => `Each spin in a row that lands a line adds +${8 * r}% (up to 5 stacks).` },
    l_sense:  { branch: 'gambler', row: 2, col: 2, max: 2, req: 'l_near', name: 'Scatter Sense', desc: (r) => `+${r} Core on every strip.` },
    l_amp:    { branch: 'gambler', row: 3, col: 0, max: 2, req: 'l_streak', name: 'Wild Amp', desc: (r) => `Lines with a wild in them fire ×${(1.5 + 0.25 * (r - 1)).toFixed(2)}.` },
    l_double: { branch: 'gambler', row: 3, col: 2, max: 2, req: 'l_sense', name: 'Double Down', desc: (r) => `Overdrive lasts ${r} more spin${r > 1 ? 's' : ''}.` },
    l_house:  { branch: 'gambler', row: 4, col: 1, max: 1, req: 'l_amp', name: 'House Edge', desc: () => 'CAPSTONE — 4 Cores hit the Jackpot, and Overdrive fires at ×3.', cap: true },
};
export const SKILL_IDS = Object.keys(SKILLS);

export function canLearn(profile, id) {
    const s = SKILLS[id];
    const r = profile.pilot.skills[id] ?? 0;
    if (r >= s.max) return { ok: false, why: 'MAX' };
    if (s.req && !(profile.pilot.skills[s.req] > 0)) return { ok: false, why: `Needs ${SKILLS[s.req].name}` };
    if (profile.pilot.sp < 1) return { ok: false, why: 'No skill points' };
    return { ok: true };
}

export function learn(profile, id) {
    if (!canLearn(profile, id).ok) return false;
    profile.pilot.sp--;
    profile.pilot.skills[id] = (profile.pilot.skills[id] ?? 0) + 1;
    return true;
}

export function respecCost(profile) {
    return Math.round(100 * Math.pow(1.35, profile.pilot.level));
}

export function respec(profile) {
    const c = respecCost(profile);
    if (profile.scrap < c) return false;
    let pts = 0;
    for (const k in profile.pilot.skills) pts += profile.pilot.skills[k];
    profile.pilot.skills = {};
    profile.pilot.sp += pts;
    profile.scrap -= c;
    return true;
}
