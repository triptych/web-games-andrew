// Tomb creatures that sleep inside blocks. They wake when their block breaks, strike at once
// (unless the block was marked, which springs an ambush), and hit back after every strike you make.
// sprite is the cell of art/monsters.webp (3x2); the warden has its own picture.

export const MONSTERS = {
    scarab: { name: 'Lapis Scarab',   hp: 3,  atk: 2, gold: 4,  from: 1,  sprite: 0 },
    wraith: { name: 'Sand Wraith',    hp: 4,  atk: 3, gold: 6,  from: 3,  sprite: 1 },
    jackal: { name: 'Mummy Jackal',   hp: 6,  atk: 3, gold: 8,  from: 5,  sprite: 2 },
    cobra:  { name: 'Gilded Cobra',   hp: 5,  atk: 4, gold: 9,  from: 7,  sprite: 3 },
    golem:  { name: 'Clay Golem',     hp: 12, atk: 4, gold: 14, from: 9,  sprite: 4 },
    moth:   { name: 'Sphinx Moth',    hp: 7,  atk: 5, gold: 12, from: 11, sprite: 5 },
    warden: { name: 'The Sphinx Warden', hp: 40, atk: 5, gold: 120, from: 99, sprite: -1, boss: true },
};

/** A monster's numbers on floor n: tougher and harder-hitting the deeper it sleeps. */
export function monsterStats(id, n) {
    const m = MONSTERS[id];
    const hp = Math.round(m.hp * (1 + Math.min(n, 40) * 0.07));
    const atk = m.atk + Math.floor(Math.min(n, 40) / 5);
    return { hp, atk, gold: m.gold + n };
}

export const TRAPS = {
    spout: { name: 'Sand spout',   dmg: 3, stamina: 0 },
    spikes:{ name: 'Spike glyph',  dmg: 4, stamina: 0 },
    curse: { name: 'Weary curse',  dmg: 2, stamina: 5 },
};
export const trapDamage = (kind, n) => TRAPS[kind].dmg + Math.floor(Math.min(n, 40) / 4);
