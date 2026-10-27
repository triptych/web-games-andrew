// Classes, skills, derived stats, levelling and equipment rules for party members. Pure.

import { LEVEL_CAP, SLOTS } from '../config.js';
import { clamp } from './core.js';
import { personName } from './names.js';

export const CLASSES = {
    warrior: {
        name: 'Warrior', icon: 'W', col: 12, hp: 1.35, mp: 0.3, wt: 2, shield: true,
        wpn: ['sword', 'axe', 'mace', 'spear'],
        base: { str: 13, vit: 12, agi: 6, int: 3, luk: 5 }, grow: { str: 1.7, vit: 1.6, agi: 0.7, int: 0.25, luk: 0.5 },
        desc: 'Front-line bruiser. Heavy armour, big hits, thick skin.',
    },
    rogue: {
        name: 'Rogue', icon: 'R', col: 10, hp: 0.95, mp: 0.5, wt: 1, shield: false,
        wpn: ['dagger', 'sword', 'whip'],
        base: { str: 8, vit: 8, agi: 13, int: 5, luk: 11 }, grow: { str: 1.0, vit: 1.0, agi: 1.7, int: 0.4, luk: 1.1 },
        desc: 'Fast and lucky. Finds traps and secret doors, steals, strikes from the shadows.',
    },
    cleric: {
        name: 'Cleric', icon: 'C', col: 15, hp: 1.05, mp: 1.0, wt: 2, shield: true,
        wpn: ['mace', 'staff', 'flail'],
        base: { str: 8, vit: 10, agi: 6, int: 11, luk: 7 }, grow: { str: 0.8, vit: 1.3, agi: 0.6, int: 1.4, luk: 0.7 },
        desc: 'Heals, cures and revives; smites the undead.',
    },
    mage: {
        name: 'Mage', icon: 'M', col: 9, hp: 0.7, mp: 1.5, wt: 0, shield: false,
        wpn: ['staff', 'wand', 'dagger'],
        base: { str: 4, vit: 6, agi: 8, int: 14, luk: 7 }, grow: { str: 0.3, vit: 0.7, agi: 0.8, int: 1.9, luk: 0.6 },
        desc: 'Glass cannon. Fire, ice and lightning, and sleep for the rest.',
    },
    ranger: {
        name: 'Ranger', icon: 'G', col: 2, hp: 1.0, mp: 0.6, wt: 1, shield: false,
        wpn: ['bow', 'spear', 'dagger'],
        base: { str: 10, vit: 9, agi: 12, int: 5, luk: 8 }, grow: { str: 1.3, vit: 1.1, agi: 1.5, int: 0.4, luk: 0.8 },
        desc: 'Marksman. Hits from the back row, marks and snares targets.',
    },
    alchemist: {
        name: 'Alchemist', icon: 'A', col: 14, hp: 0.9, mp: 1.1, wt: 0, shield: false,
        wpn: ['dagger', 'staff', 'whip'],
        base: { str: 5, vit: 8, agi: 9, int: 12, luk: 9 }, grow: { str: 0.5, vit: 0.9, agi: 1.0, int: 1.6, luk: 1.0 },
        desc: 'Flasks and bombs. Potions work half again as well in their hands.',
    },
};
export const CLASS_IDS = Object.keys(CLASSES);

export const TRAITS = {
    sturdy: { name: 'Sturdy', desc: '+12% HP', hp: 0.12 },
    sharp: { name: 'Sharp', desc: '+3 Strength', st: { str: 3 } },
    quick: { name: 'Quick', desc: '+3 Agility', st: { agi: 3 } },
    wise: { name: 'Wise', desc: '+3 Intellect', st: { int: 3 } },
    lucky: { name: 'Lucky', desc: '+4 Luck', st: { luk: 4 } },
    hardy: { name: 'Hardy', desc: '+3 Vitality', st: { vit: 3 } },
    keen: { name: 'Keen-eyed', desc: 'Better at finding traps', find: 0.12 },
};
export const TRAIT_IDS = Object.keys(TRAITS);

// tg: e one enemy, ea all enemies, a one ally, aa all allies, d a fallen ally, s self
// k: p physical, m magic, h heal, b buff, db debuff, x special
export const SKILLS = {
    powerstrike: { cls: 'warrior', lvl: 1, name: 'Power Strike', mp: 3, tg: 'e', k: 'p', pow: 1.8, desc: 'A heavy blow.' },
    cleave: { cls: 'warrior', lvl: 5, name: 'Cleave', mp: 6, tg: 'ea', k: 'p', pow: 0.85, desc: 'Hits every enemy.' },
    rally: { cls: 'warrior', lvl: 9, name: 'Rally', mp: 8, tg: 'aa', k: 'b', buf: { atk: 1.25 }, turns: 3, desc: 'Party attack up for 3 rounds.' },
    shieldbash: { cls: 'warrior', lvl: 13, name: 'Shield Bash', mp: 6, tg: 'e', k: 'p', pow: 1.2, st: 'stun', ch: 0.55, desc: 'Strike and stun.' },
    berserk: { cls: 'warrior', lvl: 18, name: 'Berserk', mp: 8, tg: 's', k: 'b', buf: { atk: 1.6, def: 0.7 }, turns: 4, desc: 'Attack way up, defence down.' },
    whirlwind: { cls: 'warrior', lvl: 24, name: 'Whirlwind', mp: 14, tg: 'ea', k: 'p', pow: 1.4, desc: 'A spinning storm of steel.' },
    execute: { cls: 'warrior', lvl: 30, name: 'Execute', mp: 18, tg: 'e', k: 'p', pow: 3.2, exec: true, desc: 'Deadly against the wounded.' },

    backstab: { cls: 'rogue', lvl: 1, name: 'Backstab', mp: 3, tg: 'e', k: 'p', pow: 1.6, crit: 0.4, desc: 'Likely to crit.' },
    venom: { cls: 'rogue', lvl: 4, name: 'Venom Blade', mp: 4, tg: 'e', k: 'p', pow: 1.0, st: 'poison', ch: 0.9, desc: 'Strike and poison.' },
    steal: { cls: 'rogue', lvl: 8, name: 'Steal', mp: 5, tg: 'e', k: 'x', fx: 'steal', pow: 0.6, desc: 'Lift gold from an enemy.' },
    flurry: { cls: 'rogue', lvl: 12, name: 'Flurry', mp: 8, tg: 'e', k: 'p', pow: 0.7, hits: 3, desc: 'Three quick cuts.' },
    veil: { cls: 'rogue', lvl: 17, name: 'Shadow Veil', mp: 10, tg: 'aa', k: 'b', buf: { def: 1.4, eva: 0.2 }, turns: 3, desc: 'Party defence and evasion up.' },
    assassinate: { cls: 'rogue', lvl: 24, name: 'Assassinate', mp: 14, tg: 'e', k: 'p', pow: 3.0, exec: true, crit: 0.3, desc: 'Finisher.' },

    heal: { cls: 'cleric', lvl: 1, name: 'Heal', mp: 4, tg: 'a', k: 'h', pow: 1.0, field: true, desc: 'Restore one ally.' },
    smite: { cls: 'cleric', lvl: 3, name: 'Smite', mp: 4, tg: 'e', k: 'm', elem: 'holy', pow: 1.5, desc: 'Holy light.' },
    cure: { cls: 'cleric', lvl: 6, name: 'Cure', mp: 3, tg: 'a', k: 'x', fx: 'cure', field: true, desc: 'Cure poison, sleep, stun.' },
    bless: { cls: 'cleric', lvl: 10, name: 'Bless', mp: 8, tg: 'aa', k: 'b', buf: { atk: 1.2, def: 1.2 }, turns: 3, desc: 'Party attack and defence up.' },
    healall: { cls: 'cleric', lvl: 14, name: 'Heal All', mp: 12, tg: 'aa', k: 'h', pow: 0.7, field: true, desc: 'Restore the party.' },
    revive: { cls: 'cleric', lvl: 20, name: 'Revive', mp: 20, tg: 'd', k: 'x', fx: 'revive', field: true, desc: 'Raise a fallen ally.' },
    judgment: { cls: 'cleric', lvl: 28, name: 'Judgment', mp: 18, tg: 'ea', k: 'm', elem: 'holy', pow: 1.1, desc: 'Holy fire on all.' },

    fire: { cls: 'mage', lvl: 1, name: 'Fire', mp: 4, tg: 'e', k: 'm', elem: 'fire', pow: 1.9, desc: 'A bolt of flame.' },
    ice: { cls: 'mage', lvl: 3, name: 'Ice', mp: 4, tg: 'e', k: 'm', elem: 'ice', pow: 1.9, desc: 'A lance of frost.' },
    bolt: { cls: 'mage', lvl: 6, name: 'Bolt', mp: 5, tg: 'e', k: 'm', elem: 'shock', pow: 2.0, desc: 'Lightning.' },
    sleep: { cls: 'mage', lvl: 9, name: 'Sleep', mp: 7, tg: 'ea', k: 'x', fx: 'status', st: 'sleep', ch: 0.6, desc: 'Lull the enemy.' },
    firestorm: { cls: 'mage', lvl: 15, name: 'Firestorm', mp: 12, tg: 'ea', k: 'm', elem: 'fire', pow: 1.1, desc: 'Fire on all.' },
    stormfront: { cls: 'mage', lvl: 21, name: 'Stormfront', mp: 14, tg: 'ea', k: 'm', elem: 'shock', pow: 1.2, desc: 'Lightning on all.' },
    meteor: { cls: 'mage', lvl: 30, name: 'Meteor', mp: 30, tg: 'ea', k: 'm', elem: 'fire', pow: 2.2, desc: 'The sky falls.' },

    aimed: { cls: 'ranger', lvl: 1, name: 'Aimed Shot', mp: 3, tg: 'e', k: 'p', pow: 1.7, ranged: true, desc: 'Never held back by the row.' },
    doubleshot: { cls: 'ranger', lvl: 4, name: 'Double Shot', mp: 5, tg: 'e', k: 'p', pow: 0.95, hits: 2, ranged: true, desc: 'Two arrows.' },
    snare: { cls: 'ranger', lvl: 8, name: 'Snare', mp: 5, tg: 'e', k: 'p', pow: 0.8, st: 'stun', ch: 0.6, ranged: true, desc: 'Pin a target.' },
    mark: { cls: 'ranger', lvl: 12, name: "Hunter's Mark", mp: 6, tg: 'e', k: 'db', buf: { def: 0.72 }, turns: 4, desc: 'Target defence down.' },
    arrowrain: { cls: 'ranger', lvl: 16, name: 'Arrow Rain', mp: 11, tg: 'ea', k: 'p', pow: 0.8, ranged: true, desc: 'Hits every enemy.' },
    snipe: { cls: 'ranger', lvl: 24, name: 'Snipe', mp: 14, tg: 'e', k: 'p', pow: 3.0, ranged: true, crit: 0.25, desc: 'One perfect shot.' },

    acid: { cls: 'alchemist', lvl: 1, name: 'Acid Flask', mp: 3, tg: 'e', k: 'm', elem: 'dark', pow: 1.7, desc: 'Burning acid.' },
    tonic: { cls: 'alchemist', lvl: 3, name: 'Brew Tonic', mp: 6, tg: 'aa', k: 'h', pow: 0.45, field: true, desc: 'A small heal for all.' },
    bomb: { cls: 'alchemist', lvl: 7, name: 'Bomb', mp: 9, tg: 'ea', k: 'm', elem: 'fire', pow: 1.0, desc: 'Boom.' },
    toxin: { cls: 'alchemist', lvl: 11, name: 'Toxin Cloud', mp: 8, tg: 'ea', k: 'x', fx: 'status', st: 'poison', ch: 0.75, desc: 'Poison them all.' },
    catalyst: { cls: 'alchemist', lvl: 15, name: 'Catalyst', mp: 10, tg: 'aa', k: 'b', buf: { atk: 1.25, agi: 1.25 }, turns: 4, desc: 'Party attack and speed up.' },
    elixirdose: { cls: 'alchemist', lvl: 22, name: 'Elixir Dose', mp: 16, tg: 'a', k: 'h', pow: 2.2, field: true, desc: 'A powerful heal.' },
    quicksilver: { cls: 'alchemist', lvl: 28, name: 'Quicksilver', mp: 20, tg: 'e', k: 'm', elem: 'dark', pow: 3.2, desc: 'Liquid ruin.' },
};
export const SKILL_IDS = Object.keys(SKILLS);
for (const id of SKILL_IDS) SKILLS[id].id = id;

export const skillsFor = (m) => SKILL_IDS.map((i) => SKILLS[i]).filter((s) => s.cls === m.cls && s.lvl <= m.lvl);
export const xpNeed = (L) => Math.round(18 * Math.pow(L, 1.75));

export function makeMember(rng, cls, lvl = 1, name = null, trait = null) {
    const m = {
        id: 0, name: name || personName(rng), cls, lvl, xp: 0, hp: 1, mp: 1, row: 0, eq: {}, st: {}, bonus: {},
        trait: trait || (rng() < 0.7 ? rng.pick(TRAIT_IDS) : null), face: Math.floor(rng() * 1e6), kills: 0,
    };
    m.row = CLASSES[cls].wt >= 2 ? 0 : cls === 'rogue' ? 0 : 1;
    const s = calc(m);
    m.hp = s.maxhp; m.mp = s.maxmp;
    return m;
}

const STATS = ['str', 'vit', 'agi', 'int', 'luk'];
/** Derived numbers for a member: gear, trait, curse and level all folded in. Battle buffs are applied by the battle. */
export function calc(m) {
    const c = CLASSES[m.cls], L = m.lvl - 1, tr = m.trait ? TRAITS[m.trait] : null;
    const s = {};
    for (const k of STATS) s[k] = Math.round(c.base[k] + c.grow[k] * L) + (m.bonus[k] || 0) + (tr?.st?.[k] || 0);
    const g = { atk: 0, mag: 0, def: 0, mdef: 0, hp: 0, mp: 0, crit: 0, eva: 0 };
    const res = {};
    let elem = 'phys', onhit = null;
    const fx = {};
    for (const slot of SLOTS) {
        const it = m.eq[slot];
        if (!it) continue;
        if (it.fx) for (const k in it.fx) fx[k] = typeof it.fx[k] === 'number' ? (fx[k] || 0) + it.fx[k] : true;
        for (const k in it.st) { if (k in g) g[k] += it.st[k]; else s[k] = (s[k] || 0) + it.st[k]; }
        if (it.res) for (const e in it.res) res[e] = (res[e] || 0) + it.res[e];
        if (slot === 'weapon') { if (it.elem) elem = it.elem; if (it.onhit) onhit = it.onhit; }
    }
    const curse = m.st.curse ? 0.8 : 1;
    for (const k of STATS) s[k] = Math.max(1, Math.round(s[k] * curse));
    s.maxhp = Math.max(1, Math.round(((20 + s.vit * 5 + m.lvl * 6) * c.hp) * (1 + (tr?.hp || 0)) + g.hp));
    s.maxmp = Math.max(0, Math.round(((6 + s.int * 2.2 + m.lvl * 1.3) * c.mp) + g.mp));
    const wpn = m.eq.weapon;
    s.atk = Math.round((s.str * 1.1 + 3 + g.atk) * curse);
    s.mag = Math.round((s.int * 1.6 + 4 + g.mag) * curse);
    s.def = Math.round(s.vit * 0.4 + g.def);
    s.mdef = Math.round(s.int * 0.25 + s.vit * 0.15 + g.mdef);
    s.crit = clamp(0.05 + s.luk * 0.002 + g.crit, 0, 0.6);
    s.eva = clamp(0.03 + s.agi * 0.0015 + g.eva, 0, 0.5);
    s.res = res; s.elem = elem; s.onhit = onhit; s.fx = fx;
    s.ranged = !!wpn && (wpn.grp === 'bow');
    s.find = 0.3 + s.luk * 0.004 + (m.cls === 'rogue' ? 0.25 : 0) + (tr?.find || 0);
    return s;
}

export const isAlive = (m) => m.hp > 0;
export function healMember(m, hp, mp = 0) {
    const s = calc(m);
    m.hp = clamp(m.hp + hp, 0, s.maxhp);
    m.mp = clamp(m.mp + mp, 0, s.maxmp);
}
/** Keep HP and MP inside the current maximums (they move when gear, curses or levels change). */
export function clampVitals(m) {
    const s = calc(m);
    if (m.hp > s.maxhp) m.hp = s.maxhp;
    if (m.mp > s.maxmp) m.mp = s.maxmp;
}
export function fullHeal(m) {
    const s = calc(m);
    m.hp = s.maxhp; m.mp = s.maxmp; m.st = {};
}

/** Adds XP; returns the number of levels gained. HP and MP rise with the new maximums. */
export function gainXp(m, xp) {
    if (m.hp <= 0 || m.lvl >= LEVEL_CAP) return 0;
    m.xp += xp;
    let n = 0;
    while (m.lvl < LEVEL_CAP && m.xp >= xpNeed(m.lvl)) {
        m.xp -= xpNeed(m.lvl);
        const before = calc(m);
        m.lvl++; n++;
        const after = calc(m);
        m.hp += after.maxhp - before.maxhp;
        m.mp += after.maxmp - before.maxmp;
    }
    return n;
}

/** Can this member wear this item? Returns { ok, why }. */
export function canEquip(m, it) {
    const c = CLASSES[m.cls];
    if (it.t === 'w') {
        if (!c.wpn.includes(it.grp)) return { ok: false, why: `${c.name}s cannot use ${it.grp}s` };
    } else if (it.t === 'a') {
        if (it.wt > c.wt) return { ok: false, why: `${c.name}s cannot wear that weight` };
        if (it.slot === 'shield') {
            if (!c.shield) return { ok: false, why: `${c.name}s cannot use shields` };
            if (m.eq.weapon && m.eq.weapon.hands === 2) return { ok: false, why: 'Needs a one-handed weapon' };
        }
    } else if (it.t !== 'c') return { ok: false, why: 'Not equipment' };
    return { ok: true };
}

/** The slot an item goes into for this member. */
export function slotFor(m, it) {
    if (it.t === 'w') return 'weapon';
    if (it.t === 'a') return it.slot;
    if (it.t === 'c') return !m.eq.acc1 ? 'acc1' : !m.eq.acc2 ? 'acc2' : 'acc1';
    return null;
}

/** A single number for "how good is this member's kit": used for auto-equip. */
export function itemScore(it) {
    if (!it) return 0;
    let s = 0;
    for (const k in it.st) s += (it.st[k] || 0) * ({ atk: 1, mag: 0.8, def: 1.1, mdef: 0.8, str: 1.2, int: 1.1, vit: 1.2, agi: 1.0, luk: 0.6, hp: 0.15, mp: 0.2, crit: 80, eva: 80 }[k] || 0.5);
    if (it.elem && it.elem !== 'phys') s *= 1.05;
    if (it.cursed && !it.known) s *= 0.9;
    if (it.fx) s += 40 + (it.ilvl || 1) * 3;
    return s;
}
