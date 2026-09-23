/**
 * levels.js — the six level timelines.
 *
 * A level is a list of time-stamped cues. The world fires each cue when the
 * level clock passes its `t`. Progression rule from the GDD: a level introduces
 * at most two new enemy types, and each new type gets one low-density wave to
 * itself before it appears in combination.
 *
 * Pod budgets total 211 — the number of cadets on the Halcyon roll. Any budget
 * a level fails to spawn (a carrier that escaped, say) is released by the boss
 * when it dies, so the headcount available across a full run is always exactly
 * the roll.
 */

const wave = (t, enemy, formation, count, opts = {}) =>
    ({ t, kind: 'wave', enemy, formation, count, opts });
const pods = (t, count, opts = {}) => ({ t, kind: 'pods', count, opts });
const say  = (t, id) => ({ t, kind: 'comms', id });
const midboss = (t, enemy, opts = {}) => ({ t, kind: 'midboss', enemy, opts });
const boss = (t, id) => ({ t, kind: 'boss', id });

export const LEVELS = [
    // ============================================================ LEVEL 1
    {
        id: 1, name: 'HANGAR RING', subtitle: 'HALCYON STATION — DOCK ARM SEVEN',
        backdrop: 'hangar', bpm: 96, podBudget: 14, cadetBudget: 24, burn: false,
        bossId: 'tarpon', introduces: ['drone', 'skimmer', 'lancer', 'turret'],
        palette: { fog: 0x0a1020, accentA: 0x64c8ff, accentB: 0xff9f6e, star: 0x9fb6ff },
        cues: [
            say(0.5, 'l1_open'),
            wave(3.0, 'drone', 'line', 5, { each: { speed: 8 } }),
            say(5.0, 'l1_alone'),
            wave(9.0, 'drone', 'vee', 7, {}),
            say(11.0, 'l1_control_out'),
            pods(14.0, 1),
            say(15.0, 'l1_hook'),
            wave(18.0, 'skimmer', 'line', 4, { width: 12 }),
            wave(26.0, 'drone', 'column', 6, { x: -5, stagger: 0.3 }),
            wave(27.0, 'drone', 'column', 6, { x: 5, stagger: 0.3 }),
            pods(32.0, 2),
            wave(36.0, 'skimmer', 'arc', 6, { depth: 2.5 }),
            wave(44.0, 'lancer', 'pair', 4, {}),
            pods(50.0, 2),
            wave(54.0, 'drone', 'wall', 9, {}),
            wave(60.0, 'skimmer', 'sine', 5, { x: -3, amp: 7 }),
            wave(62.0, 'lancer', 'flankR', 3, { y: 8 }),
            pods(70.0, 2),
            wave(74.0, 'turret', 'anchor', 3, { xs: [-6, 0, 6] }),
            wave(84.0, 'drone', 'vee', 9, {}),
            wave(90.0, 'skimmer', 'line', 6, { width: 15 }),
            pods(96.0, 2),
            midboss(104.0, 'turret', { hp: 700, holdY: 8, escort: ['skimmer', 'skimmer', 'lancer'] }),
            say(105.0, 'l1_midboss'),
            wave(118.0, 'lancer', 'pair', 6, { stagger: 0.4 }),
            wave(126.0, 'drone', 'scatter', 10, {}),
            pods(132.0, 2),
            wave(136.0, 'skimmer', 'arc', 7, { depth: 3 }),
            wave(144.0, 'turret', 'anchor', 2, { xs: [-7, 7] }),
            wave(146.0, 'lancer', 'flankL', 3, { y: 7 }),
            wave(154.0, 'drone', 'wall', 11, {}),
            pods(160.0, 2),
            wave(164.0, 'skimmer', 'sine', 6, { x: 4, amp: 8, stagger: 0.28 }),
            say(174.0, 'l1_boss'),
            boss(178.0, 'tarpon'),
        ],
    },

    // ============================================================ LEVEL 2
    {
        id: 2, name: 'ASHGATE DESCENT', subtitle: 'UPPER CLOUD DECK — 40 km AND FALLING',
        backdrop: 'clouds', bpm: 104, podBudget: 18, cadetBudget: 32, burn: true,
        bossId: 'nimbus', introduces: ['weaver', 'popper', 'shieldbearer'],
        palette: { fog: 0x1a1008, accentA: 0xffc46e, accentB: 0xff6e8e, star: 0xffd9a0 },
        cues: [
            say(0.5, 'l2_open'),
            pods(3.0, 1),
            say(4.0, 'l2_burn'),
            wave(7.0, 'skimmer', 'line', 5, { width: 13 }),
            wave(14.0, 'weaver', 'pair', 2, { gap: 9 }),
            pods(20.0, 2),
            wave(23.0, 'popper', 'scatter', 5, {}),
            wave(31.0, 'weaver', 'line', 3, { width: 11 }),
            wave(33.0, 'drone', 'column', 8, { x: 0, stagger: 0.22 }),
            pods(40.0, 2),
            wave(43.0, 'shieldbearer', 'line', 2, { width: 8 }),
            wave(51.0, 'popper', 'vee', 7, {}),
            wave(53.0, 'lancer', 'flankR', 3, { y: 9 }),
            pods(60.0, 2),
            wave(63.0, 'weaver', 'arc', 4, { depth: 2.5 }),
            wave(71.0, 'shieldbearer', 'pair', 4, { gap: 10, stagger: 0.5 }),
            wave(73.0, 'skimmer', 'sine', 5, { x: -4, amp: 7 }),
            pods(82.0, 2),
            wave(86.0, 'popper', 'wall', 9, {}),
            wave(94.0, 'turret', 'anchor', 4, { xs: [-7.5, -2.5, 2.5, 7.5] }),
            say(100.0, 'l2_midboss'),
            midboss(104.0, 'shieldbearer', { hp: 1100, holdY: 8, escort: ['weaver', 'weaver', 'popper', 'popper'] }),
            pods(118.0, 2),
            wave(122.0, 'weaver', 'pair', 4, { gap: 11 }),
            wave(130.0, 'lancer', 'vee', 7, {}),
            wave(138.0, 'popper', 'scatter', 9, {}),
            pods(144.0, 2),
            wave(148.0, 'shieldbearer', 'line', 3, { width: 12 }),
            wave(156.0, 'skimmer', 'arc', 8, { depth: 3.4 }),
            wave(164.0, 'weaver', 'line', 4, { width: 14 }),
            pods(170.0, 2),
            wave(174.0, 'popper', 'wall', 11, {}),
            wave(182.0, 'lancer', 'pair', 8, { stagger: 0.35 }),
            say(190.0, 'l2_boss'),
            boss(194.0, 'nimbus'),
        ],
    },

    // ============================================================ LEVEL 3
    {
        id: 3, name: 'THE RING YARDS', subtitle: 'SHIPBREAKER YARDS — ASHGATE B-RING',
        backdrop: 'rings', bpm: 112, podBudget: 21, cadetBudget: 38, burn: false,
        bossId: 'ironmaw', introduces: ['sniper', 'carrier', 'minelayer'],
        palette: { fog: 0x0d1418, accentA: 0xffd36e, accentB: 0x8fd6ff, star: 0xcfe0ff },
        cues: [
            say(0.5, 'l3_open'),
            wave(4.0, 'drone', 'wall', 9, {}),
            wave(10.0, 'sniper', 'line', 2, { width: 9 }),
            pods(16.0, 2),
            wave(19.0, 'minelayer', 'pair', 2, { gap: 8 }),
            say(21.0, 'l3_people'),
            wave(26.0, 'carrier', 'column', 1, { x: -4 }),
            wave(33.0, 'skimmer', 'arc', 7, { depth: 3 }),
            wave(35.0, 'sniper', 'anchor', 2, { xs: [-6, 6] }),
            pods(42.0, 2),
            wave(45.0, 'minelayer', 'line', 3, { width: 12 }),
            wave(53.0, 'shieldbearer', 'pair', 4, { gap: 9 }),
            wave(55.0, 'popper', 'scatter', 6, {}),
            pods(62.0, 2),
            wave(66.0, 'carrier', 'pair', 2, { gap: 10 }),
            wave(74.0, 'weaver', 'arc', 5, { depth: 2.8 }),
            wave(82.0, 'lancer', 'vee', 9, {}),
            pods(88.0, 2),
            wave(92.0, 'minelayer', 'scatter', 5, {}),
            wave(94.0, 'sniper', 'line', 3, { width: 13 }),
            say(102.0, 'l3_midboss'),
            midboss(106.0, 'sniper', { hp: 1500, holdY: 10, escort: ['minelayer', 'minelayer', 'shieldbearer'] }),
            pods(120.0, 3),
            wave(124.0, 'turret', 'anchor', 5, { xs: [-8, -4, 0, 4, 8] }),
            wave(134.0, 'carrier', 'column', 1, { x: 5 }),
            wave(136.0, 'popper', 'wall', 11, {}),
            pods(144.0, 3),
            wave(148.0, 'weaver', 'pair', 6, { gap: 12 }),
            wave(156.0, 'minelayer', 'arc', 5, { depth: 2.4 }),
            wave(164.0, 'shieldbearer', 'line', 4, { width: 15 }),
            pods(172.0, 3),
            wave(176.0, 'sniper', 'scatter', 4, {}),
            wave(184.0, 'lancer', 'pair', 10, { stagger: 0.3 }),
            wave(192.0, 'drone', 'wall', 13, {}),
            say(200.0, 'l3_boss'),
            boss(204.0, 'ironmaw'),
        ],
    },

    // ============================================================ LEVEL 4
    {
        id: 4, name: 'THE CHOIR FIELD', subtitle: 'OPEN SPACE — SEEDER SWARM',
        backdrop: 'choir', bpm: 120, podBudget: 22, cadetBudget: 40, burn: false,
        bossId: 'choirmaster', introduces: ['reaver', 'bloom', 'choirling'],
        palette: { fog: 0x14081e, accentA: 0xd6a8ff, accentB: 0xff8ed0, star: 0xe0c8ff },
        cues: [
            say(0.5, 'l4_open'),
            wave(4.0, 'choirling', 'line', 5, { width: 13 }),
            say(8.0, 'l4_beat'),
            wave(11.0, 'bloom', 'pair', 2, { gap: 8, each: { holdY: 6 } }),
            pods(18.0, 2),
            wave(21.0, 'reaver', 'flankL', 2, { y: 10 }),
            wave(23.0, 'reaver', 'flankR', 2, { y: 12 }),
            wave(31.0, 'choirling', 'arc', 7, { depth: 2.6 }),
            pods(38.0, 2),
            wave(41.0, 'bloom', 'line', 3, { width: 12, each: { holdY: 7 } }),
            wave(49.0, 'popper', 'wall', 11, {}),
            wave(51.0, 'reaver', 'pair', 4, { gap: 11 }),
            pods(58.0, 2),
            wave(62.0, 'choirling', 'wall', 9, {}),
            wave(70.0, 'weaver', 'pair', 4, { gap: 10 }),
            wave(72.0, 'minelayer', 'line', 3, { width: 11 }),
            pods(80.0, 3),
            wave(84.0, 'bloom', 'arc', 4, { depth: 2.2, each: { holdY: 6.5 } }),
            wave(92.0, 'reaver', 'scatter', 5, {}),
            say(100.0, 'l4_midboss'),
            midboss(104.0, 'bloom', { hp: 1900, holdY: 7, escort: ['choirling', 'choirling', 'choirling', 'reaver'] }),
            pods(118.0, 3),
            wave(122.0, 'choirling', 'line', 8, { width: 16 }),
            wave(130.0, 'carrier', 'pair', 2, { gap: 9 }),
            wave(138.0, 'bloom', 'pair', 4, { gap: 12, each: { holdY: 7 } }),
            pods(146.0, 3),
            wave(150.0, 'reaver', 'flankL', 3, { y: 9 }),
            wave(152.0, 'reaver', 'flankR', 3, { y: 11 }),
            wave(160.0, 'choirling', 'arc', 9, { depth: 3.2 }),
            pods(168.0, 3),
            wave(172.0, 'sniper', 'line', 3, { width: 12 }),
            wave(180.0, 'bloom', 'line', 4, { width: 15, each: { holdY: 6 } }),
            wave(188.0, 'choirling', 'wall', 11, {}),
            wave(196.0, 'popper', 'scatter', 12, {}),
            say(204.0, 'l4_boss'),
            boss(208.0, 'choirmaster'),
        ],
    },

    // ============================================================ LEVEL 5
    {
        id: 5, name: 'TETHERCORE', subtitle: 'INSIDE THE CHORUS TETHER',
        backdrop: 'tether', bpm: 126, podBudget: 22, cadetBudget: 41, burn: false,
        bossId: 'kel', introduces: ['seraph'],
        palette: { fog: 0x061418, accentA: 0x7dffd4, accentB: 0x9fe8ff, star: 0xa0ffe8 },
        cues: [
            say(0.5, 'l5_open'),
            wave(4.0, 'turret', 'anchor', 4, { xs: [-8, -3, 3, 8] }),
            wave(12.0, 'choirling', 'wall', 9, {}),
            say(14.0, 'l5_kel_voice'),
            pods(18.0, 2),
            wave(21.0, 'seraph', 'column', 1, { x: 0, each: { holdY: 8 } }),
            say(24.0, 'l5_kel_named'),
            wave(34.0, 'reaver', 'pair', 4, { gap: 10 }),
            wave(42.0, 'shieldbearer', 'line', 4, { width: 14 }),
            pods(48.0, 2),
            wave(52.0, 'bloom', 'pair', 4, { gap: 11, each: { holdY: 6.5 } }),
            wave(60.0, 'minelayer', 'arc', 5, { depth: 2.6 }),
            wave(68.0, 'carrier', 'pair', 2, { gap: 11 }),
            pods(74.0, 2),
            wave(78.0, 'choirling', 'arc', 9, { depth: 3 }),
            wave(86.0, 'sniper', 'line', 4, { width: 15 }),
            wave(94.0, 'popper', 'wall', 13, {}),
            say(100.0, 'l5_midboss'),
            midboss(104.0, 'seraph', { hp: 2400, holdY: 7.5, escort: ['choirling', 'choirling', 'reaver', 'reaver'] }),
            pods(120.0, 3),
            wave(124.0, 'weaver', 'line', 5, { width: 15 }),
            wave(132.0, 'reaver', 'scatter', 6, {}),
            wave(140.0, 'seraph', 'pair', 2, { gap: 12, each: { holdY: 8 } }),
            pods(150.0, 3),
            wave(154.0, 'turret', 'anchor', 5, { xs: [-8, -4, 0, 4, 8] }),
            wave(164.0, 'bloom', 'arc', 5, { depth: 2.4, each: { holdY: 6 } }),
            wave(172.0, 'lancer', 'vee', 11, {}),
            pods(180.0, 3),
            wave(184.0, 'choirling', 'wall', 13, {}),
            wave(192.0, 'shieldbearer', 'pair', 6, { gap: 10, stagger: 0.4 }),
            pods(200.0, 3),
            wave(204.0, 'minelayer', 'scatter', 6, {}),
            wave(212.0, 'seraph', 'column', 1, { x: -4, each: { holdY: 7 } }),
            say(220.0, 'l5_boss'),
            boss(224.0, 'kel'),
        ],
    },

    // ============================================================ LEVEL 6
    {
        id: 6, name: 'THE LONG FALL', subtitle: 'ASCENT TO THE HEART — HALCYON BURNING BELOW',
        backdrop: 'fall', bpm: 132, podBudget: 19, cadetBudget: 36, burn: true,
        bossId: 'heart', introduces: [],
        palette: { fog: 0x1a0612, accentA: 0xff7fd0, accentB: 0xffc46e, star: 0xffd0e8 },
        cues: [
            say(0.5, 'l6_open'),
            wave(4.0, 'drone', 'wall', 13, {}),
            say(7.0, 'l6_all'),
            wave(10.0, 'lancer', 'vee', 9, {}),
            pods(16.0, 2),
            wave(19.0, 'seraph', 'pair', 2, { gap: 12, each: { holdY: 8 } }),
            wave(29.0, 'choirling', 'wall', 11, {}),
            wave(37.0, 'reaver', 'flankL', 3, { y: 10 }),
            wave(39.0, 'reaver', 'flankR', 3, { y: 12 }),
            pods(46.0, 2),
            wave(49.0, 'bloom', 'line', 4, { width: 14, each: { holdY: 6.5 } }),
            wave(57.0, 'carrier', 'pair', 2, { gap: 10 }),
            wave(65.0, 'minelayer', 'arc', 6, { depth: 2.8 }),
            pods(72.0, 2),
            wave(76.0, 'sniper', 'line', 4, { width: 16 }),
            wave(84.0, 'shieldbearer', 'wall', 6, {}),
            wave(92.0, 'weaver', 'pair', 6, { gap: 12 }),
            say(98.0, 'l6_midboss'),
            midboss(102.0, 'seraph', { hp: 3200, holdY: 7.5, escort: ['seraph'], escortOpts: { holdY: 9 } }),
            pods(118.0, 3),
            wave(122.0, 'popper', 'wall', 15, {}),
            wave(130.0, 'choirling', 'arc', 11, { depth: 3.4 }),
            wave(138.0, 'reaver', 'scatter', 7, {}),
            pods(146.0, 3),
            wave(150.0, 'turret', 'anchor', 5, { xs: [-8, -4, 0, 4, 8] }),
            wave(158.0, 'bloom', 'pair', 4, { gap: 13, each: { holdY: 6 } }),
            wave(166.0, 'seraph', 'line', 2, { width: 12, each: { holdY: 8 } }),
            pods(174.0, 3),
            wave(178.0, 'lancer', 'pair', 12, { stagger: 0.25 }),
            wave(186.0, 'carrier', 'column', 1, { x: 0 }),
            pods(194.0, 3),
            wave(198.0, 'choirling', 'wall', 13, {}),
            say(206.0, 'l6_boss'),
            boss(210.0, 'heart'),
        ],
    },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(n) {
    return LEVELS.find((l) => l.id === n) ?? LEVELS[0];
}

/** Total escape pods the campaign can spawn. */
export function totalPodBudget() {
    return LEVELS.reduce((sum, l) => sum + l.podBudget, 0);
}

/** Total cadets inside those pods — must equal story.TOTAL_CADETS (the roll). */
export function totalCadetBudget() {
    return LEVELS.reduce((sum, l) => sum + l.cadetBudget, 0);
}
