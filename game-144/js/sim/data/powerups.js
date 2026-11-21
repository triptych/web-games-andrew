// Power-up capsules and the synergies two of them unlock together. Pure data; the rules are in js/sim/player.js.
//
// weight: how often a random drop is this capsule (carriers and wave leaders always drop one).

export const POWERUPS = {
    P: { name: 'POWER', desc: 'Main gun +1 level (max 6).', color: 0xff5a5a, weight: 26 },
    B: { name: 'BOMB', desc: '+1 bomb. Bombs clear every bullet and turn them into stars.', color: 0xffd24a, weight: 10 },
    S: { name: 'SHIELD', desc: '+1 shield charge. A charge eats a hit and blasts the bullets around you.', color: 0x4ad8ff, weight: 12 },
    R: { name: 'ROCKETS', desc: 'Homing rocket pods +1 (max 4).', color: 0xff9a3c, weight: 12 },
    O: { name: 'OPTION', desc: '+1 option drone that copies your gun (max 4). Focus pulls them in tight.', color: 0x8affc0, weight: 12 },
    W: { name: 'WARP', desc: '+1 warp charge (max 3). Blink forward through bullets, cutting everything on the way.', color: 0xb27cff, weight: 9 },
    H: { name: 'HALO', desc: 'Orbiting blades that shred bullets and burn enemies (max 2).', color: 0xfff0a0, weight: 7 },
    X: { name: 'OVERDRIVE', desc: '10 s of double fire rate and full power.', color: 0xff4ad2, weight: 5 },
    T: { name: 'CHRONO', desc: '8 s of slowed enemy bullets.', color: 0x6ab4ff, weight: 5 },
    M: { name: 'MAGNET', desc: '20 s: stars and capsules fly to you.', color: 0xc0c8d8, weight: 5 },
    U: { name: '1UP', desc: 'An extra life.', color: 0x7dff6a, weight: 0.8 },
};
export const POWERUP_KEYS = Object.keys(POWERUPS);

// Two (or more) things held together unlock a named combo. `need` is read by hasSynergy() in player.js.
export const SYNERGIES = [
    { id: 'aegis', name: 'AEGIS JUMP', need: ['shield', 'warp'], desc: 'Warping leaves a burning wake that eats bullets for a second.' },
    { id: 'swarm', name: 'SWARM ARRAY', need: ['rockets', 'options2'], desc: 'Every option launches rockets too.' },
    { id: 'sunwheel', name: 'SUN WHEEL', need: ['halo', 'shield'], desc: 'The halo grows and turns the bullets it cuts into your own shots.' },
    { id: 'nova', name: 'NOVA BARRAGE', need: ['overdrive', 'rockets'], desc: 'Rockets fire three times as fast.' },
    { id: 'phase', name: 'PHASE SHIFT', need: ['chrono', 'warp'], desc: 'Warps are free while time is slow.' },
    { id: 'cataclysm', name: 'CATACLYSM', need: ['overdrive', 'bombs3'], desc: 'Bombs hit three times as hard and last longer.' },
    { id: 'wings', name: 'SERAPH WINGS', need: ['options4', 'power6'], desc: 'Options fire piercing lances.' },
    { id: 'starfield', name: 'STARFIELD', need: ['magnet', 'halo'], desc: 'Bullets the halo cuts become stars.' },
    { id: 'golden', name: 'GOLDEN HOUR', need: ['magnet', 'overdrive'], desc: 'Stars are worth triple and fill Burst twice as fast.' },
];
