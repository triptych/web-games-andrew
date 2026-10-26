// Name generators: people, bosses, places, shops.

const A = ['Gor', 'Ash', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gra', 'Hal', 'Ith', 'Jor', 'Kel', 'Lor', 'Mor', 'Nar', 'Ora', 'Pyr', 'Ral', 'Sor', 'Tur', 'Ul', 'Val', 'Wyn', 'Xan', 'Yor', 'Zel', 'Bri', 'Cal', 'Dun', 'Eri'];
const B = ['an', 'ek', 'ir', 'ox', 'ur', 'ar', 'el', 'in', 'or', 'um', 'ae', 'ay', 'is', 'ia', 'en'];
const C = ['dor', 'gar', 'lis', 'mir', 'nus', 'rak', 'sil', 'thas', 'vyn', 'zul', 'ton', 'mond', 'wick', 'bane', 'dis', 'ne', 'ra', 'na', 'th'];

export function personName(rng) {
    const n = A[Math.floor(rng() * A.length)] + (rng() < 0.55 ? B[Math.floor(rng() * B.length)] : '') + C[Math.floor(rng() * C.length)];
    return n;
}
const EPITHETS = ['the Hollow', 'the Ravenous', 'the Unbroken', 'of the Deep', 'the Pale', 'the Gloom-Eater', 'the Forsaken', 'Bonegnasher', 'the Sleepless',
    'Worldsinger', 'the Burning', 'Ironmaw', 'the Drowned', 'Dreadwing', 'the Patient', 'Gravewarden', 'the Hungering', 'Nightfall', 'the Cold King', 'Ashmother'];
export const epithet = (rng) => EPITHETS[Math.floor(rng() * EPITHETS.length)];
export const bossName = (rng) => `${personName(rng)} ${epithet(rng)}`;

const ROOF = ['Crooked', 'Rusty', 'Gilded', 'Silver', 'Laughing', 'Sleeping', 'Tarnished', 'Merry', 'Lucky', 'Black'];
const NOUN = ['Lantern', 'Anvil', 'Kettle', 'Raven', 'Crown', 'Barrel', 'Candle', 'Gargoyle', 'Cauldron', 'Dragon'];
export const shopTitle = (rng) => `${ROOF[Math.floor(rng() * ROOF.length)]} ${NOUN[Math.floor(rng() * NOUN.length)]}`;

export const RUMORS = [
    'They say a guardian waits on every fifth floor, and the stairs are its door.',
    'Search dead ends. Walls lie more often than people do.',
    'Cursed gear looks like any other until you wear it. The church can lift the curse.',
    'A shop you own is a shop that pays you. Visit the Guild.',
    'Mushroom caves are bad for the lungs and good for herbs.',
    'The deeper you go, the better the loot, and the worse the neighbours.',
    'Frozen things fear fire. Burning things fear frost. Dead things fear the light.',
    'An inn bed costs less if you own the inn. Funny how that works.',
    'Keep a rogue about. Traps do not spring on those who look first.',
    'The elevator remembers every guardian you have felled.',
    'Wands never run dry for long. Tomes make you stronger forever.',
    'If you hear a chest breathing, run.',
];
export const HINT_SIGNS = [
    'Turn back. There is nothing here but rats and regret.',
    'The mapmaker was here. The mapmaker did not leave.',
    'Beware: floor not as solid as it looks.',
    'A scratch on the wall reads: THE EAST WALL IS A LIAR.',
    'Offerings to the shrine are repaid in kind.',
    'Someone has drawn a smiling face. It is not smiling now.',
    'Light a torch. Say a prayer. Hold your breath.',
    'Below, the deep. Above, the rest. Choose well.',
];
