// The squad and the opposition. Pure data: the sim reads the numbers, the view
// and the UI read the looks and the words.

export const CREW_ORDER = ['rico', 'lola', 'doc', 'dex', 'jinx', 'tito', 'roxy'];

export const CREW = {
    rico: {
        name: 'Rico Vega', short: 'RICO', role: 'Detective', joins: 1,
        r: 0.4, m: 1.0, hp: 3, power: 1.0, charges: 2,
        ability: 'Bank On It', abilityKey: 'rebank',
        abilityText: 'Tap while rolling to stop dead and line up a second shot from where you stand.',
        passive: 'Hard Case: knocks out a guard from any side if he hits at speed.',
        bio: 'Metro-Dade Vice, eleven years. Plays nine-ball on Tuesdays and the angles every other day. His partner Benny died on a bust somebody sold out, and Rico means to find out who.',
        look: { jacket: '#f6f0e4', shirt: '#2fd6c8', skin: '#d9a07a', hair: '#3a2416', hairStyle: 'swept', glasses: 'aviator', stubble: true, ring: 0x2ff2e0 },
    },
    lola: {
        name: 'Lola Reyes', short: 'LOLA', role: 'Sharpshooter', joins: 2,
        r: 0.38, m: 0.9, hp: 3, power: 1.0, charges: 6,
        ability: 'Tranq Darts', abilityKey: 'dart',
        abilityText: 'Tap while rolling to fire a dart the way you are heading (up to three a shot). Darts bank once off walls, put unaware guards to sleep and break cameras.',
        passive: 'Steady Hand: darts fly true and ricochet once.',
        bio: 'Tended bar at Club Flamingo for two years and listened to everything. Feds’ informant, Olympic pistol alternate, and very tired of pretending to laugh at Nico Valente’s jokes.',
        look: { jacket: '#ff4fa8', shirt: '#1a1022', skin: '#c8865c', hair: '#14080a', hairStyle: 'pony', glasses: null, ring: 0xff4fa8 },
    },
    doc: {
        name: 'Dr. Marisol Santos', short: 'DOC', role: 'Medic', joins: 3,
        r: 0.4, m: 1.0, hp: 4, power: 1.0, charges: 2,
        ability: 'Triage', abilityKey: 'heal',
        abilityText: 'Tap while rolling for a healing pulse: every teammate close by gets a heart back.',
        passive: 'Bedside Manner: bump a teammate to heal them, or to get a downed one back on their feet. Unaware guards she hits are sedated.',
        bio: 'Night shift at Mercy General. Her brother drove for the cartel until the cartel decided he talked too much. She stitches up the squad and does not ask where the holes came from.',
        look: { jacket: '#e8fff8', shirt: '#5fe0a8', skin: '#b87a52', hair: '#2a1410', hairStyle: 'bun', glasses: 'round', ring: 0x8dff8a },
    },
    dex: {
        name: 'Dex Monroe', short: 'DEX', role: 'Demolitions', joins: 4,
        r: 0.42, m: 1.2, hp: 3, power: 1.0, charges: 2,
        ability: 'Detonate', abilityKey: 'boom',
        abilityText: 'Tap while rolling to blow up where you are: knocks everything back, flattens guards, breaks crates, cracked walls, glass and cameras. Loud.',
        passive: 'Blast Proof: his own blasts never hurt him.',
        bio: 'Army engineer, Grenada, 1983. Came home to a chop shop in Hialeah and a cartel that wanted it. He would rather build than break, but he is very good at breaking.',
        look: { jacket: '#5a6a3a', shirt: '#ffb03a', skin: '#8a5a3a', hair: '#1a0e08', hairStyle: 'flat', glasses: 'visor', ring: 0xff8a3a },
    },
    jinx: {
        name: 'Jasmine "Jinx" Kowalski', short: 'JINX', role: 'Hacker', joins: 5,
        r: 0.34, m: 0.7, hp: 2, power: 1.15, charges: 3,
        ability: 'Ghost', abilityKey: 'ghost',
        abilityText: 'Tap while rolling to vanish: guards, cameras and lasers miss her until she stops.',
        passive: 'Root Access: rolls over terminals to hack them, and shuts off any camera she touches.',
        bio: 'Seventeen. Runs a pirate station, WJNX, out of a water tower and reads the phone company’s mail for fun. Joined up because the cartel jammed her signal, and that was personal.',
        look: { jacket: '#2a1a4a', shirt: '#8dff5a', skin: '#f0c8a8', hair: '#ff3fd0', hairStyle: 'mohawk', glasses: 'shades', ring: 0xb44cff },
    },
    tito: {
        name: 'Big Tito Fuentes', short: 'TITO', role: 'Heavy', joins: 6,
        r: 0.48, m: 3.0, hp: 5, power: 0.88, charges: 3,
        ability: 'Anchor', abilityKey: 'anchor',
        abilityText: 'Tap while rolling to plant his feet: he stops dead and a shockwave shoves everything near him away and stuns guards.',
        passive: 'Wrecking Ball: smashes crates and cracked walls, and knocks out any guard he hits.',
        bio: 'Shop steward, Local 1416, Port of Miami. Three hundred pounds, most of it patience. The cartel threatened his crews. That used up the patience.',
        look: { jacket: '#3a5aa8', shirt: '#f4f4f4', skin: '#9a6440', hair: '#1a1a1a', hairStyle: 'cap', glasses: null, beard: true, ring: 0x4fd8ff },
    },
    roxy: {
        name: 'Roxy Starr', short: 'ROXY', role: 'Decoy', joins: 7,
        r: 0.38, m: 0.9, hp: 3, power: 1.0, charges: 2,
        ability: 'Boombox', abilityKey: 'boombox',
        abilityText: 'Tap while rolling to drop a boombox. Guards nearby go and dance to it for ten seconds.',
        passive: 'Star Power: guards who spot her are starstruck and take twice as long to raise the alarm.',
        bio: 'Two top-ten singles and a third one stuck in a vault because Nico Valente owns her contract. She knows every room in every mansion on Star Island, and every bodyguard’s name.',
        look: { jacket: '#b44cff', shirt: '#ffe45c', skin: '#e8b090', hair: '#ffd890', hairStyle: 'big', glasses: 'star', earrings: true, ring: 0xffe45c },
    },
};

// Guard kinds. `see` scales cone range, `ko` scales the speed a hit needs.
export const FOES = {
    goon:  { name: 'Goon', r: 0.42, m: 1.3, hp: 1, see: 1, speed: 1, gun: true, look: { suit: '#f4f0ea', shirt: '#1a1a1a', hair: '#141010', skin: '#c89070', chain: true } },
    heavy: { name: 'Enforcer', r: 0.5, m: 2.2, hp: 2, see: 0.9, speed: 0.85, gun: true, ko: 1.6, look: { suit: '#2a2a32', shirt: '#ff3fa4', hair: '#101010', skin: '#a87050', chain: true, shades: true } },
    dog:   { name: 'Dog', r: 0.3, m: 0.6, hp: 1, see: 1, speed: 1.6, gun: false, dog: true, look: { fur: '#6a4428' } },
    cop:   { name: 'Officer', r: 0.42, m: 1.2, hp: 1, see: 1.05, speed: 1, gun: false, cop: true, look: { suit: '#1a2a5a', shirt: '#cfd8ff', hair: '#2a1a10', skin: '#d8a888', hat: true } },
    nico:  { name: 'Nico Valente', r: 0.5, m: 2.0, hp: 3, see: 1, speed: 0.9, gun: true, boss: true, ko: 1.2, look: { suit: '#ffe45c', shirt: '#ff3fa4', hair: '#2a1408', skin: '#d09870', chain: true, shades: true } },
    shark: { name: 'The Shark', r: 0.6, m: 3.4, hp: 5, see: 1.1, speed: 0.8, gun: true, boss: true, ko: 1.3, look: { suit: '#8a94a8', shirt: '#101820', hair: '#d8d8e0', skin: '#e0b090', fin: true, shades: true } },
};

// Garage upgrades. Cost grows with level.
export const UPGRADES = {
    hp:      { name: 'Kevlar', text: '+1 heart', max: 2, cost: [600, 1400] },
    charges: { name: 'Gear', text: '+1 ability charge', max: 2, cost: [800, 1800] },
};
export const TEAM_UPGRADES = {
    guide:   { name: 'Pool Shark’s Eye', text: 'The aim guide follows one more cushion', max: 2, cost: [700, 1600] },
    rewind:  { name: 'Spare Tape', text: '+1 Instant Replay per episode', max: 2, cost: [900, 2000] },
};
