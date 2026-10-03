// The Kestrel's upgrade tree: four branches of seven nodes, bought with
// salvage in the hangar between operations. `computeLoadout` turns the owned
// ranks into the flat stat block the player's weapons read.

export const BRANCHES = [
    { id: 'guns', name: 'Chin Gun', color: '#ff6a4a', blurb: 'The 20 mm under the nose. Faster, wider, harder.' },
    { id: 'ord', name: 'Ordnance', color: '#ffb02e', blurb: 'Missiles, rockets, drones and the Arc Caster.' },
    { id: 'air', name: 'Airframe', color: '#3fd6c6', blurb: 'Armour, speed, a smaller profile and second chances.' },
    { id: 'sys', name: 'Systems', color: '#b07cff', blurb: 'EMP bombs, Overdrive and the salvage economy.' },
];

// row: vertical position in the branch column (0 top); col: -1, 0, 1 within the column.
export const SKILLS = [
    // ---- Chin gun
    { id: 'g_dmg', b: 'guns', row: 0, col: 0, name: 'Heavy Barrels', ranks: 3, cost: [120, 260, 480], icon: 'barrel', desc: '+20% chin-gun damage per rank.' },
    { id: 'g_rof', b: 'guns', row: 1, col: -1, name: 'Twin Feed', ranks: 3, cost: [160, 320, 560], req: ['g_dmg'], icon: 'feed', desc: '+15% rate of fire per rank.' },
    { id: 'g_fan', b: 'guns', row: 1, col: 1, name: 'Fan Spread', ranks: 1, cost: [300], req: ['g_dmg'], icon: 'fan', desc: 'Adds two angled streams. In focus they close up.' },
    { id: 'g_wide', b: 'guns', row: 2, col: 1, name: 'Wide Fan', ranks: 1, cost: [650], req: ['g_fan'], icon: 'wide', desc: 'Two more streams at the edges of the fan.' },
    { id: 'g_pierce', b: 'guns', row: 2, col: -1, name: 'Tungsten Rounds', ranks: 2, cost: [420, 800], req: ['g_rof'], icon: 'pierce', desc: 'Rounds punch through 1 / 2 targets.' },
    { id: 'g_crit', b: 'guns', row: 3, col: -1, name: 'Tracer Crits', ranks: 2, cost: [500, 900], req: ['g_pierce'], icon: 'crit', desc: '8% chance per rank for a round to hit for 2.5x.' },
    { id: 'g_ion', b: 'guns', row: 4, col: 0, name: 'Ion Lance', ranks: 1, cost: [1800], req: ['g_crit', 'g_wide'], icon: 'ion', desc: 'Capstone. In focus the gun becomes a piercing ion beam that also burns bullets.' },
    // ---- Ordnance
    { id: 'o_msl', b: 'ord', row: 0, col: 0, name: 'Hellfire Rack', ranks: 1, cost: [220], icon: 'missile', desc: 'Homing missiles, a pair every 1.2 s.' },
    { id: 'o_mslx', b: 'ord', row: 1, col: -1, name: 'Deep Magazine', ranks: 2, cost: [380, 700], req: ['o_msl'], icon: 'missiles', desc: '+1 missile pair per rank.' },
    { id: 'o_rkt', b: 'ord', row: 1, col: 1, name: 'Rocket Pods', ranks: 2, cost: [340, 680], req: ['o_msl'], icon: 'rocket', desc: 'Forward rocket salvos with splash. Rank 2 fires faster.' },
    { id: 'o_clus', b: 'ord', row: 2, col: -1, name: 'Cluster Warheads', ranks: 1, cost: [720], req: ['o_mslx'], icon: 'cluster', desc: 'Missiles burst into bomblets.' },
    { id: 'o_drone', b: 'ord', row: 2, col: 1, name: 'Wingman Drone', ranks: 2, cost: [600, 1100], req: ['o_rkt'], icon: 'drone', desc: 'An escort drone per rank, firing with you.' },
    { id: 'o_hunt', b: 'ord', row: 3, col: 0, name: 'Hunter AI', ranks: 1, cost: [800], req: ['o_clus', 'o_drone'], icon: 'eye', desc: 'Missiles and drones prefer the toughest target; +25% ordnance damage.' },
    { id: 'o_arc', b: 'ord', row: 4, col: 0, name: 'Arc Caster', ranks: 1, cost: [1800], req: ['o_hunt'], icon: 'arc', desc: 'Capstone. Chain lightning leaps between up to five enemies.' },
    // ---- Airframe
    { id: 'a_arm', b: 'air', row: 0, col: 0, name: 'Composite Plating', ranks: 3, cost: [150, 340, 620], icon: 'armor', desc: '+1 armour per rank.' },
    { id: 'a_spd', b: 'air', row: 1, col: 1, name: 'Turbine Tune', ranks: 2, cost: [200, 420], req: ['a_arm'], icon: 'speed', desc: '+10% speed per rank.' },
    { id: 'a_reg', b: 'air', row: 1, col: -1, name: 'Auto-Repair', ranks: 2, cost: [380, 760], req: ['a_arm'], icon: 'repair', desc: 'Restore 1 armour every 50 / 35 s.' },
    { id: 'a_slim', b: 'air', row: 2, col: 1, name: 'Slim Profile', ranks: 1, cost: [550], req: ['a_spd'], icon: 'slim', desc: 'Hitbox 25% smaller.' },
    { id: 'a_shield', b: 'air', row: 2, col: -1, name: 'Deflector', ranks: 1, cost: [700], req: ['a_reg'], icon: 'shield', desc: 'A shield that absorbs one hit, recharging in 22 s.' },
    { id: 'a_graze', b: 'air', row: 3, col: 1, name: 'Graze Dynamo', ranks: 1, cost: [650], req: ['a_slim'], icon: 'graze', desc: 'Grazing bullets charges Overdrive 60% faster.' },
    { id: 'a_phx', b: 'air', row: 4, col: 0, name: 'Phoenix Protocol', ranks: 1, cost: [1800], req: ['a_shield', 'a_graze'], icon: 'phoenix', desc: 'Capstone. Once per operation, rise from a fatal hit with full armour and an EMP.' },
    // ---- Systems
    { id: 's_bomb', b: 'sys', row: 0, col: 0, name: 'EMP Capacitors', ranks: 2, cost: [180, 420], icon: 'bomb', desc: '+1 Thunderclap EMP per operation per rank.' },
    { id: 's_mag', b: 'sys', row: 1, col: 1, name: 'Salvage Magnet', ranks: 2, cost: [140, 300], req: ['s_bomb'], icon: 'magnet', desc: '+60% pickup radius per rank.' },
    { id: 's_od', b: 'sys', row: 1, col: -1, name: 'Overdrive Core', ranks: 2, cost: [300, 600], req: ['s_bomb'], icon: 'od', desc: 'Overdrive lasts 2 s longer per rank.' },
    { id: 's_broker', b: 'sys', row: 2, col: 1, name: 'Scrap Broker', ranks: 2, cost: [400, 800], req: ['s_mag'], icon: 'broker', desc: '+15% salvage per rank.' },
    { id: 's_tdil', b: 'sys', row: 2, col: -1, name: 'Time Dilation', ranks: 1, cost: [750], req: ['s_od'], icon: 'clock', desc: 'Enemy fire slows to half speed during Overdrive.' },
    { id: 's_clap', b: 'sys', row: 3, col: 0, name: 'Thunderclap+', ranks: 1, cost: [700], req: ['s_tdil', 's_broker'], icon: 'clap', desc: 'EMP damage doubled; invulnerability lasts 1 s longer.' },
    { id: 's_storm', b: 'sys', row: 4, col: 0, name: 'Storm Breaker', ranks: 1, cost: [1800], req: ['s_clap'], icon: 'storm', desc: 'Capstone. Cancelled bullets turn to salvage, and every boss phase break refunds an EMP.' },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function rankOf(owned, id) { return owned[id] | 0; }

export function canBuy(owned, id, salvage) {
    const s = SKILL_BY_ID[id];
    if (!s) return { ok: false, why: 'unknown' };
    const r = rankOf(owned, id);
    if (r >= s.ranks) return { ok: false, why: 'Maxed' };
    for (const q of s.req || []) if (rankOf(owned, q) < 1) return { ok: false, why: 'Needs ' + SKILL_BY_ID[q].name };
    if (salvage < s.cost[r]) return { ok: false, why: 'Not enough salvage' };
    return { ok: true, cost: s.cost[r] };
}

export function spentOn(owned) {
    let t = 0;
    for (const s of SKILLS) {
        const r = rankOf(owned, s.id);
        for (let i = 0; i < r; i++) t += s.cost[i];
    }
    return t;
}

export function computeLoadout(owned = {}) {
    const r = (id) => rankOf(owned, id);
    return {
        dmgMul: 1 + 0.2 * r('g_dmg'),
        rofMul: 1 + 0.15 * r('g_rof'),
        streams: 2 + (r('g_fan') ? 2 : 0) + (r('g_wide') ? 2 : 0),
        pierce: r('g_pierce'),
        crit: 0.08 * r('g_crit'),
        ion: r('g_ion') > 0,
        missiles: r('o_msl') ? 1 + r('o_mslx') : 0,       // pairs per volley
        cluster: r('o_clus') > 0,
        rockets: r('o_rkt'),
        drones: r('o_drone'),
        hunter: r('o_hunt') > 0,
        ordMul: r('o_hunt') ? 1.25 : 1,
        arc: r('o_arc') > 0,
        maxArmor: 3 + r('a_arm'),
        speedMul: 1 + 0.1 * r('a_spd'),
        regen: r('a_reg') === 2 ? 35 : r('a_reg') === 1 ? 50 : 0,
        hitboxMul: r('a_slim') ? 0.75 : 1,
        shield: r('a_shield') > 0,
        grazeMul: r('a_graze') ? 1.6 : 1,
        phoenix: r('a_phx') > 0,
        bombs: 2 + r('s_bomb'),
        magnet: 1 + 0.6 * r('s_mag'),
        salvageMul: 1 + 0.15 * r('s_broker'),
        odDur: 6 + 2 * r('s_od'),
        timeDilation: r('s_tdil') > 0,
        clap: r('s_clap') > 0,
        stormBreaker: r('s_storm') > 0,
    };
}

/** A loadout a player could plausibly own after `opsCleared` operations; used by the balance bot. */
export function typicalOwned(opsCleared) {
    const order = ['g_dmg', 'a_arm', 'o_msl', 'g_rof', 's_bomb', 'g_fan', 'g_dmg', 'a_arm', 'o_mslx', 'o_rkt', 'g_rof',
        'g_dmg', 's_mag', 'a_spd', 'g_wide', 'a_reg', 'g_pierce', 'o_drone', 's_od', 'a_arm', 'o_clus', 'g_rof',
        'a_shield', 'g_crit', 'o_mslx', 'a_slim', 's_broker', 'o_hunt', 'g_pierce', 's_tdil', 'a_graze', 'o_drone', 's_bomb',
        'a_reg', 's_od', 'g_crit', 's_mag', 'a_spd', 'o_rkt', 's_broker', 's_clap', 'g_ion', 'a_phx', 'o_arc', 's_storm'];
    // roughly what a player banks: ~1.5-3k salvage an operation, a little lost to failures
    const budget = [0, 1300, 3200, 5600, 8200, 11000, 14000][Math.min(opsCleared, 6)];
    const owned = {};
    let spent = 0;
    for (const id of order) {
        const s = SKILL_BY_ID[id];
        const rank = owned[id] | 0;
        if (rank >= s.ranks) continue;
        if ((s.req || []).some((q) => !owned[q])) continue;
        if (spent + s.cost[rank] > budget) break;
        spent += s.cost[rank];
        owned[id] = rank + 1;
    }
    return owned;
}
