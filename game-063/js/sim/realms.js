// The five realms: the parts of each that change how the ball plays. Colours live in the view.

export const REALMS = [
    { id: 0, key: 'meadow', name: 'Meadowmere', rough: 'rough', hazard: 'water', gravity: 1, monster: 'slime', tree: 'oak', bossName: 'Grubbins the Gopher King' },
    { id: 1, key: 'sand', name: 'Sandsea Dunes', rough: 'dune', hazard: 'water', gravity: 1, monster: 'scarab', tree: 'palm', bossName: 'Duneborn' },
    { id: 2, key: 'frost', name: 'Frostpeak', rough: 'snow', hazard: 'water', gravity: 1, monster: 'penguin', tree: 'pine', bossName: 'Big Frosty' },
    { id: 3, key: 'cinder', name: 'Cinder Caldera', rough: 'ash', hazard: 'lava', gravity: 1, monster: 'imp', tree: 'spire', bossName: 'Double Bogey' },
    { id: 4, key: 'sky', name: 'Sky Citadel', rough: 'rough', hazard: 'void', gravity: 0.82, monster: 'wisp', tree: 'column', bossName: 'Lord Bogey' },
];

// Surface ids shared by the grid, the physics and the terrain shader.
export const SURF = {
    rough: 0, fairway: 1, green: 2, tee: 3, sand: 4, water: 5, lava: 6, ice: 7, snow: 8,
    quick: 9, ash: 10, cloud: 11, stone: 12, oob: 13, void: 14, dune: 15,
};
export const SURF_NAMES = Object.keys(SURF).sort((a, b) => SURF[a] - SURF[b]);

// e: restitution, ft: tangential loss on a bounce, mu: rolling friction (× g), lie: power multiplier.
export const SURF_PHYS = [
    /* rough   */ { e: 0.2, ft: 0.45, mu: 1.5, lie: 0.8, label: 'Rough' },
    /* fairway */ { e: 0.32, ft: 0.2, mu: 0.7, lie: 1, label: 'Fairway' },
    /* green   */ { e: 0.24, ft: 0.16, mu: 0.4, lie: 1, label: 'Green' },
    /* tee     */ { e: 0.32, ft: 0.2, mu: 0.7, lie: 1, label: 'Tee' },
    /* sand    */ { e: 0.02, ft: 0.85, mu: 5, lie: 0.6, plug: true, label: 'Bunker' },
    /* water   */ { hazard: 'water', label: 'Water' },
    /* lava    */ { hazard: 'lava', label: 'Lava' },
    /* ice     */ { e: 0.42, ft: 0.03, mu: 0.06, lie: 1, label: 'Ice' },
    /* snow    */ { e: 0.02, ft: 0.8, mu: 4.2, lie: 0.7, plug: true, label: 'Snowdrift' },
    /* quick   */ { stop: true, lie: 0.5, label: 'Quicksand' },
    /* ash     */ { e: 0.15, ft: 0.4, mu: 1.3, lie: 0.85, label: 'Ash' },
    /* cloud   */ { e: 0.86, ft: 0.08, mu: 0.7, lie: 1, minUp: 10, label: 'Cloud' },
    /* stone   */ { e: 0.45, ft: 0.08, mu: 0.45, lie: 1, label: 'Stone' },
    /* oob     */ { hazard: 'oob', label: 'Out of bounds' },
    /* void    */ { hazard: 'void', label: 'The Void' },
    /* dune    */ { e: 0.06, ft: 0.7, mu: 3, lie: 0.72, plug: true, label: 'Dune' },
];
