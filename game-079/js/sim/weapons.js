// Procedural guns. A gun is a plain object rolled from a seed: archetype, maker, rarity, element,
// parts. The same object decides the stats, the name, the stat card and the 3D model (view/guns.js),
// so nothing visual is ever saved. Pure.

import { makeRng } from '../rng.js';

// kind: hitscan | proj | beam
export const ARCH = {
    pistol: { label: 'Hand Cannon', nouns: ['Hand Cannon', 'Peacemaker', 'Blaster', 'Six-Shooter'], ammo: 'bullet', kind: 'hitscan', dmg: 24, pellets: 1, rate: 4.5, mag: 12, reload: 1.0, spread: 0.012, range: 120 },
    shotgun: { label: 'Boomstick', nouns: ['Boomstick', 'Scattergun', 'Street Sweeper', 'Thunder Mug'], ammo: 'shell', kind: 'hitscan', dmg: 10, pellets: 9, rate: 1.4, mag: 6, reload: 1.6, spread: 0.085, range: 60 },
    ripper: { label: 'Ripper', nouns: ['Ripper', 'Buzzsaw', 'Shredder', 'Lead Hose'], ammo: 'bullet', kind: 'hitscan', dmg: 10, pellets: 1, rate: 13, mag: 60, reload: 2.0, spread: 0.035, range: 100, spin: 0.5 },
    rocket: { label: 'Doomsayer', nouns: ['Doomsayer', 'Big Bang', 'Rocket Rig', 'Party Popper'], ammo: 'rocket', kind: 'proj', dmg: 95, pellets: 1, rate: 1.1, mag: 4, reload: 2.2, spread: 0.0, speed: 32, splash: 4.5, range: 200 },
    photon: { label: 'Photon Rifle', nouns: ['Photon Rifle', 'Laser Lance', 'Zapper', 'Light Saber-ish'], ammo: 'cell', kind: 'proj', dmg: 17, pellets: 1, rate: 8, mag: 40, reload: 1.6, spread: 0.015, speed: 70, range: 200 },
    disc: { label: 'Disc Slinger', nouns: ['Disc Slinger', 'Saw Thrower', 'Frisbee of Doom', 'Platter Blaster'], ammo: 'cell', kind: 'proj', dmg: 40, pellets: 1, rate: 2.2, mag: 8, reload: 1.8, spread: 0.0, speed: 36, bounce: 3, ammoPer: 2, range: 200 },
    tesla: { label: 'Tesla Coil', nouns: ['Tesla Coil', 'Arc Gun', 'Thunder Stick', 'Bug Zapper'], ammo: 'cell', kind: 'beam', dmg: 7, pellets: 1, rate: 20, mag: 80, reload: 2.0, spread: 0, range: 24, chain: 2 },
};
export const ARCH_IDS = Object.keys(ARCH);

export const MAKERS = {
    kane: { name: 'Kane & Sons', dmg: 1.12 },
    neon: { name: 'Neon Dynamics', rate: 1.15 },
    xerxid: { name: 'Xerxid Salvage', dmg: 1.05, element: 0.2 },
    bubba: { name: "Bubba's Garage", mag: 1.4, spread: 1.4, reload: 1.1 },
    tokyo: { name: 'Tokyo Cyberworks', spread: 0.6, reload: 0.8 },
};
export const MAKER_IDS = Object.keys(MAKERS);

// only: archetypes the part can appear on (null = all)
export const PARTS = {
    twin: { name: 'Twin Barrels', prefix: 'Double', only: null },
    overclock: { name: 'Overclocked', prefix: 'Hyper', only: null },
    heavy: { name: 'Heavy Slugs', prefix: 'Brutal', only: null },
    extmag: { name: 'Extended Mag', prefix: 'Hungry', only: null },
    quick: { name: 'Quickdraw', prefix: 'Snappy', only: null },
    laser: { name: 'Laser Sight', prefix: 'Precise', only: ['pistol', 'shotgun', 'ripper', 'photon'] },
    ricochet: { name: 'Ricochet', prefix: 'Bouncy', only: ['photon', 'disc'] },
    homing: { name: 'Homing', prefix: 'Seeking', only: ['rocket', 'photon', 'disc'] },
    explosive: { name: 'Explosive Rounds', prefix: 'Volatile', only: ['pistol', 'shotgun', 'ripper', 'photon', 'disc'] },
    vampiric: { name: 'Vampiric', prefix: 'Thirsty', only: null },
};
export const ELEMENTS = ['fire', 'shock', 'cryo', 'acid'];
const ELEMENT_PREFIX = {
    fire: ['Searing', 'Infernal', 'Scorching'],
    shock: ['Electric', 'Thunderous', 'Crackling'],
    cryo: ['Frosty', 'Glacial', 'Chilly'],
    acid: ['Toxic', 'Corrosive', 'Caustic'],
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const LEGENDARIES = {
    lastword: { name: "Ironjaw's Last Word", arch: 'shotgun', maker: 'kane', element: 'fire', parts: ['heavy', 'quick'], pellets: 12, flavor: 'Dad never missed. Neither does this.' },
    mixtape: { name: 'The Mixtape', arch: 'disc', maker: 'neon', element: 'shock', parts: ['homing', 'overclock', 'ricochet'], bounce: 6, flavor: 'Side A: violence. Side B: more violence.' },
    requiem: { name: 'Neon Requiem', arch: 'photon', maker: 'neon', element: 'shock', parts: ['homing', 'overclock', 'extmag'], flavor: 'Plays you out.' },
    bertha: { name: 'Big Hair Bertha', arch: 'rocket', maker: 'bubba', element: 'fire', parts: ['twin', 'explosive', 'extmag'], flavor: 'Aqua Net and nitroglycerin.' },
};

function rollRarity(rng, level, bonus) {
    const s = rng() * 100 + level * 4 + bonus * 12;
    return s < 55 ? 0 : s < 80 ? 1 : s < 93 ? 2 : s < 106 ? 3 : 4;
}

/** Roll a gun. opts: { level, bonus, arch, maker, rarity } force any of them. */
export function genWeapon(seed, opts = {}) {
    const rng = makeRng(seed);
    const level = opts.level || 0;
    const arch = opts.arch ?? rng.pick(level === 0 ? ['pistol', 'shotgun', 'ripper', 'photon', 'pistol', 'shotgun', 'disc'] : ARCH_IDS);
    const maker = opts.maker ?? rng.pick(MAKER_IDS);
    const rarity = opts.rarity ?? rollRarity(rng, level, opts.bonus || 0);
    const pool = Object.keys(PARTS).filter((p) => !PARTS[p].only || PARTS[p].only.includes(arch));
    const parts = [];
    for (let k = 0; k < rarity && pool.length; k++) parts.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    const elChance = [0, 0.15, 0.3, 0.45, 0.6][rarity] + (MAKERS[maker].element || 0);
    const element = rng() < elChance ? rng.pick(ELEMENTS) : null;
    const mk = rng.int(0, Math.min(6, rarity + 2));
    const noun = rng.pick(ARCH[arch].nouns);
    const prefix = element ? rng.pick(ELEMENT_PREFIX[element]) : parts.length ? PARTS[parts[0]].prefix : rng.pick(['Stock', 'Plain', 'Trusty', 'Used']);
    const name = `${prefix} ${MAKERS[maker].name} ${noun} Mk.${ROMAN[mk]}`;
    return finish({ seed: seed >>> 0, arch, maker, rarity, element, parts, name, legendary: null, level });
}

export function legendary(id, level = 0) {
    const d = LEGENDARIES[id];
    return finish({ seed: (id.length * 7919 + level) >>> 0, arch: d.arch, maker: d.maker, rarity: 4, element: d.element, parts: [...d.parts], name: d.name, legendary: id, level, flavor: d.flavor }, d);
}

/** The starting pistol. */
export function starterGun() {
    const g = finish({ seed: 1987, arch: 'pistol', maker: 'kane', rarity: 0, element: null, parts: [], name: "Dad's Spare Kane & Sons Hand Cannon", legendary: null, level: 0 });
    g.infinite = true;           // the fallback: it never runs dry
    g.flavor = 'Never runs dry. Dad made sure.';
    return g;
}

/** Stats from archetype × maker × rarity × parts × level. */
function finish(g, over = {}) {
    const A = ARCH[g.arch], M = MAKERS[g.maker];
    let dmg = A.dmg * (M.dmg || 1) * (1 + 0.08 * g.rarity) * (1 + 0.12 * g.level);
    let pellets = over.pellets ?? A.pellets;
    let rate = A.rate * (M.rate || 1);
    let mag = A.mag * (M.mag || 1);
    let reload = A.reload * (M.reload || 1);
    let spread = A.spread * (M.spread || 1);
    let bounce = over.bounce ?? (A.bounce || 0);
    let splash = A.splash || 0, splashFrac = A.splash ? 1 : 0;
    let homing = 0, vamp = 0;
    for (const p of g.parts) {
        if (p === 'twin') { pellets *= 2; dmg *= 0.62; spread = Math.max(spread, 0.02); }
        else if (p === 'overclock') rate *= 1.3;
        else if (p === 'heavy') { dmg *= 1.3; rate *= 0.85; }
        else if (p === 'extmag') mag *= 1.6;
        else if (p === 'quick') reload *= 0.6;
        else if (p === 'laser') spread *= 0.45;
        else if (p === 'ricochet') bounce += 2;
        else if (p === 'homing') homing = 3;
        else if (p === 'explosive') { if (!splash) { splash = 1.8; splashFrac = 0.4; } else splash *= 1.3; }
        else if (p === 'vampiric') vamp = 0.04;
    }
    Object.assign(g, {
        ammo: A.ammo, kind: A.kind, ammoPer: A.ammoPer || 1,
        dmg: Math.round(dmg * 10) / 10, pellets, rate: Math.round(rate * 100) / 100,
        mag: Math.max(1, Math.round(mag)), reload: Math.round(reload * 100) / 100,
        spread, speed: A.speed || 0, splash, splashFrac, bounce, homing, vamp,
        range: A.range, chain: A.chain || 0, spin: A.spin || 0,
    });
    g.dps = Math.round(dps(g));
    g.clip = g.mag;              // rounds loaded
    return g;
}

/** Rough sustained damage per second, for the stat card and the bot's choices. */
export function dps(g) {
    const burst = g.dmg * g.pellets * (g.kind === 'hitscan' && g.pellets > 1 ? 0.75 : 1) * (1 + (g.splash ? 0.5 * g.splashFrac : 0)) * (g.element ? 1.15 : 1) * (1 + g.chain * 0.3);
    const cycle = g.mag / g.rate + g.reload;
    return burst * g.mag / cycle;
}

export function describe(g) {
    const lines = [];
    lines.push(`${ARCH[g.arch].label} · ${MAKERS[g.maker].name}`);
    if (g.element) lines.push(`${g.element.toUpperCase()} element`);
    for (const p of g.parts) lines.push(PARTS[p].name);
    return lines;
}
