/**
 * levels.js — the seven stages: layout, set dressing hooks, enemy waves,
 * hazards and story beats. The sim reads events/props/hazards; the view reads
 * theme/segments/sky to build the backdrop; the UI reads name/sub/time.
 *
 * Spawn spec: [type, side, opts]  side: L / R (walk in), T (drop from above),
 *                                       C (appear on screen)
 *   opts: { pal, z, delay, min: 'normal'|'hard' (only at that difficulty+) }
 */

const S = (type, side = 'R', o) => (o ? [type, side, o] : [type, side]);
const N = { min: 'normal' }, H = { min: 'hard' };

export const LEVELS = [
    // ============================================================ 1
    {
        key: 'neon', name: 'NEON ROW', sub: 'Lower Sprawl · 11:42 PM', music: 'neon', bossMusic: 'boss1',
        length: 3200, zMin: 0, zMax: 64,
        theme: 'street', rain: true, ambient: [0.82, 0.8, 0.95], fog: 0x1a0f2e,
        segments: [{ x0: 0, x1: 2050, kind: 'street' }, { x0: 2050, x1: 2700, kind: 'alley' }, { x0: 2700, x1: 3200, kind: 'garage' }],
        props: [
            { type: 'can', x: 300, z: 58 }, { type: 'crate', x: 560, z: 60, drop: 'noodles' }, { type: 'can', x: 820, z: 56 },
            { type: 'vend', x: 1180, z: 62 }, { type: 'barrel', x: 1460, z: 58 }, { type: 'crate', x: 1700, z: 8, drop: 'pipe' },
            { type: 'can', x: 2120, z: 60 }, { type: 'can', x: 2160, z: 54 }, { type: 'crate', x: 2480, z: 58, drop: 'bento' },
            { type: 'barrel', x: 2620, z: 10 }, { type: 'crate', x: 2840, z: 60, drop: 'cell' },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's1_intro' },
            { x: 340, t: 'wave', waves: [[S('punk', 'R'), S('punk', 'R', N)], [S('punk', 'L'), S('punk', 'R')]] },
            { x: 640, t: 'dialog', id: 's1_tips' },
            { x: 900, t: 'wave', waves: [[S('punk', 'R'), S('knifer', 'R')], [S('punk', 'L'), S('knifer', 'R', N), S('punk', 'R', H)]] },
            { x: 1300, t: 'spawn', spawns: [S('punk', 'R')] },
            { x: 1480, t: 'wave', waves: [[S('bruiser', 'R')], [S('punk', 'L'), S('knifer', 'R'), S('punk', 'R', N)]] },
            { x: 1560, t: 'dialog', id: 's1_bruiser' },
            { x: 2000, t: 'banner', text: 'THE ALLEY', kind: 'small' },
            { x: 2200, t: 'wave', waves: [[S('knifer', 'R'), S('knifer', 'L')], [S('punk', 'R'), S('punk', 'R'), S('bruiser', 'L', N)], [S('punk', 'R', H), S('knifer', 'L', H)]] },
            { x: 2620, t: 'wave', waves: [[S('punk', 'R'), S('punk', 'L'), S('knifer', 'R', N)], [S('bruiser', 'R'), S('punk', 'L', N)]] },
            { x: 2980, t: 'boss', id: 'jackhammer', dialog: 's1_boss', entrance: 'T' },
        ],
    },
    // ============================================================ 2
    {
        key: 'train', name: 'LINE 9', sub: 'Maglev Express · 12:30 AM', music: 'train', bossMusic: 'boss2',
        length: 3400, zMin: 4, zMax: 56,
        theme: 'train', ambient: [0.88, 0.88, 0.96], fog: 0x0c1424,
        segments: [{ x0: 0, x1: 1750, kind: 'car' }, { x0: 1750, x1: 3400, kind: 'roof' }],
        props: [
            { type: 'crate', x: 420, z: 52, drop: 'noodles' }, { type: 'can', x: 760, z: 50 }, { type: 'crate', x: 1100, z: 10, drop: 'baton' },
            { type: 'vend', x: 1500, z: 54 }, { type: 'crate', x: 2100, z: 50, drop: 'cell' }, { type: 'barrel', x: 2550, z: 12 }, { type: 'crate', x: 3000, z: 50, drop: 'bento' },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's2_intro' },
            { x: 320, t: 'wave', waves: [[S('guard', 'R'), S('punk', 'R')], [S('guard', 'L'), S('punk', 'R', N)]] },
            { x: 520, t: 'dialog', id: 's2_guard' },
            { x: 820, t: 'wave', waves: [[S('gunner', 'R'), S('punk', 'L')], [S('guard', 'R'), S('gunner', 'L', N), S('knifer', 'R', H)]] },
            { x: 1300, t: 'wave', waves: [[S('guard', 'R'), S('guard', 'L')], [S('gunner', 'R'), S('punk', 'R'), S('punk', 'L', N)]] },
            { x: 1700, t: 'dialog', id: 's2_roof' },
            { x: 1780, t: 'banner', text: 'THE ROOF', kind: 'small' },
            { x: 1900, t: 'hazard', kind: 'gantry', count: 2, every: 7 },
            { x: 2050, t: 'wave', waves: [[S('punk', 'R'), S('gunner', 'R')], [S('guard', 'L'), S('knifer', 'R'), S('gunner', 'R', N)]] },
            { x: 2500, t: 'hazard', kind: 'gantry', count: 3, every: 6 },
            { x: 2600, t: 'wave', waves: [[S('guard', 'R', { pal: 'elite' }), S('gunner', 'L')], [S('punk', 'R'), S('punk', 'L'), S('bruiser', 'R', N)]] },
            { x: 3180, t: 'boss', id: 'viper', dialog: 's2_boss', entrance: 'T' },
        ],
    },
    // ============================================================ 3
    {
        key: 'market', name: 'LANTERN MARKET', sub: 'Old Quarter · 1:15 AM', music: 'market', bossMusic: 'boss3',
        length: 3400, zMin: 0, zMax: 64,
        theme: 'market', rain: true, ambient: [0.92, 0.84, 0.82], fog: 0x24100e,
        segments: [{ x0: 0, x1: 2250, kind: 'market' }, { x0: 2250, x1: 3400, kind: 'rooftop' }],
        props: [
            { type: 'cart', x: 380, z: 60 }, { type: 'lantern', x: 640, z: 62 }, { type: 'crate', x: 900, z: 8, drop: 'katana' },
            { type: 'cart', x: 1260, z: 60 }, { type: 'barrel', x: 1600, z: 56 }, { type: 'lantern', x: 1900, z: 62 }, { type: 'cart', x: 2100, z: 58 },
            { type: 'crate', x: 2600, z: 56, drop: 'bento' }, { type: 'can', x: 2900, z: 58 }, { type: 'crate', x: 3100, z: 8, drop: 'cell' },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's3_intro' },
            { x: 360, t: 'wave', waves: [[S('punk', 'R'), S('knifer', 'L')], [S('ninja', 'R'), S('punk', 'R', N)]] },
            { x: 480, t: 'dialog', id: 's3_ninja' },
            { x: 900, t: 'wave', waves: [[S('ninja', 'R'), S('ninja', 'L', N)], [S('knifer', 'R'), S('bruiser', 'R'), S('punk', 'L', H)]] },
            { x: 1450, t: 'wave', waves: [[S('punk', 'R'), S('punk', 'L'), S('knifer', 'R')], [S('ninja', 'T'), S('ninja', 'T', N)], [S('bruiser', 'L'), S('knifer', 'R', H)]] },
            { x: 2000, t: 'wave', waves: [[S('gunner', 'R'), S('ninja', 'L')], [S('bruiser', 'R'), S('ninja', 'R', { pal: 'b' })]] },
            { x: 2250, t: 'dialog', id: 's3_roof' },
            { x: 2500, t: 'wave', waves: [[S('ninja', 'R', { pal: 'c' }), S('ninja', 'L', { pal: 'b' })], [S('knifer', 'R'), S('gunner', 'L'), S('ninja', 'R', N)]] },
            { x: 2900, t: 'wave', waves: [[S('ninja', 'T'), S('ninja', 'T'), S('ninja', 'T', N)]] },
            { x: 3180, t: 'boss', id: 'oni', dialog: 's3_boss', entrance: 'R' },
        ],
    },
    // ============================================================ 4
    {
        key: 'docks', name: 'IRONWHARF', sub: 'Aurex Freight Docks · 3:50 AM', music: 'docks', bossMusic: 'boss4',
        length: 3600, zMin: 0, zMax: 66,
        theme: 'docks', ambient: [0.86, 0.84, 0.92], fog: 0x1c1a2a,
        segments: [{ x0: 0, x1: 2400, kind: 'docks' }, { x0: 2400, x1: 3600, kind: 'warehouse' }],
        props: [
            { type: 'crate', x: 360, z: 60 }, { type: 'barrel', x: 600, z: 58 }, { type: 'crate', x: 900, z: 8, drop: 'pipe' }, { type: 'barrel', x: 1250, z: 10 },
            { type: 'crate', x: 1500, z: 60, drop: 'bento' }, { type: 'barrel', x: 1900, z: 58 }, { type: 'crate', x: 2250, z: 60, drop: 'cell' },
            { type: 'vend', x: 2700, z: 62 }, { type: 'crate', x: 3050, z: 8, drop: 'knives' }, { type: 'barrel', x: 3250, z: 60 },
        ],
        hazards: [
            { type: 'steam', x: 2650, z: 30, r: 14, on: 0.9, off: 2.6, offset: 0 },
            { type: 'steam', x: 2950, z: 50, r: 14, on: 0.9, off: 2.6, offset: 1.2 },
            { type: 'steam', x: 3200, z: 16, r: 14, on: 0.9, off: 2.6, offset: 0.6 },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's4_intro' },
            { x: 340, t: 'wave', waves: [[S('guard', 'R'), S('gunner', 'R')], [S('ripper', 'L'), S('guard', 'R', N)]] },
            { x: 440, t: 'dialog', id: 's4_ripper' },
            { x: 700, t: 'hazard', kind: 'forklift', count: 2, every: 5 },
            { x: 950, t: 'wave', waves: [[S('ripper', 'R'), S('punk', 'L'), S('punk', 'R')], [S('bruiser', 'R'), S('gunner', 'L', N)]] },
            { x: 1450, t: 'hazard', kind: 'forklift', count: 3, every: 4 },
            { x: 1500, t: 'wave', waves: [[S('guard', 'R', { pal: 'elite' }), S('gunner', 'R'), S('gunner', 'L')], [S('ripper', 'R'), S('ripper', 'L', N), S('bruiser', 'R', H)]] },
            { x: 2050, t: 'wave', waves: [[S('bruiser', 'R'), S('bruiser', 'L', N)], [S('guard', 'R'), S('ripper', 'R'), S('gunner', 'L')]] },
            { x: 2400, t: 'banner', text: 'WAREHOUSE 9', kind: 'small' },
            { x: 2750, t: 'wave', waves: [[S('ripper', 'R', { pal: 'b' }), S('guard', 'L')], [S('gunner', 'R'), S('gunner', 'L'), S('ripper', 'R', N)]] },
            { x: 3380, t: 'boss', id: 'bulwark', dialog: 's4_boss', entrance: 'R' },
        ],
    },
    // ============================================================ 5
    {
        key: 'lab', name: 'BIOLABS', sub: 'Aurex Research · Sublevel 4 · 4:40 AM', music: 'lab', bossMusic: 'boss5',
        length: 3400, zMin: 0, zMax: 62,
        theme: 'lab', ambient: [0.95, 1.0, 0.98], fog: 0x0e1c18,
        segments: [{ x0: 0, x1: 2300, kind: 'lab' }, { x0: 2300, x1: 3400, kind: 'vault' }],
        props: [
            { type: 'jar', x: 420, z: 62 }, { type: 'terminal', x: 720, z: 62, drop: 'cell' }, { type: 'jar', x: 1050, z: 62 },
            { type: 'crate', x: 1350, z: 8, drop: 'baton' }, { type: 'jar', x: 1700, z: 62, drop: 'bento' }, { type: 'terminal', x: 2050, z: 62 },
            { type: 'jar', x: 2550, z: 62 }, { type: 'jar', x: 2850, z: 62, drop: 'medkit' }, { type: 'terminal', x: 3100, z: 62, drop: 'cell' },
        ],
        hazards: [
            { type: 'laser', x: 820, on: 1.4, off: 2.0, offset: 0 },
            { type: 'laser', x: 1620, on: 1.4, off: 2.0, offset: 1.0 },
            { type: 'laser', x: 1680, on: 1.4, off: 2.0, offset: 2.2 },
            { type: 'laser', x: 2400, on: 1.2, off: 1.8, offset: 0.4 },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's5_intro' },
            { x: 330, t: 'wave', waves: [[S('synth', 'R'), S('drone', 'R')], [S('synth', 'L'), S('mine', 'R'), S('mine', 'R', N)]] },
            { x: 440, t: 'dialog', id: 's5_synth' },
            { x: 1050, t: 'wave', waves: [[S('husk', 'R'), S('ripper', 'L')], [S('drone', 'R'), S('drone', 'L', N), S('synth', 'R')]] },
            { x: 1350, t: 'dialog', id: 's5_logs' },
            { x: 1900, t: 'wave', waves: [[S('synth', 'R', { pal: 'elite' }), S('mine', 'L'), S('mine', 'R')], [S('husk', 'R'), S('husk', 'L', N), S('drone', 'R', H)]] },
            { x: 2600, t: 'wave', waves: [[S('synth', 'R'), S('synth', 'L'), S('ripper', 'R')], [S('drone', 'R'), S('drone', 'L'), S('husk', 'R', N)]] },
            { x: 2900, t: 'dialog', id: 's5_echo' },
            { x: 3180, t: 'boss', id: 'goliath', dialog: 's5_boss', entrance: 'T' },
        ],
    },
    // ============================================================ 6
    {
        key: 'spire', name: 'THE SPIRE', sub: 'Express Shaft · 5:20 AM', music: 'spire', bossMusic: 'boss6',
        length: 1500, zMin: 0, zMax: 60,
        theme: 'spire', ambient: [0.9, 0.92, 1.0], fog: 0x0a1020,
        segments: [{ x0: 0, x1: 600, kind: 'lobby' }, { x0: 600, x1: 1500, kind: 'elevator' }],
        props: [
            { type: 'vend', x: 260, z: 60 }, { type: 'terminal', x: 480, z: 62, drop: 'cell' },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's6_intro' },
            { x: 300, t: 'wave', waves: [[S('synth', 'R', { pal: 'elite' }), S('gunner', 'R')], [S('ninja', 'L'), S('guard', 'R', { pal: 'elite' })]] },
            { x: 900, t: 'dialog', id: 's6_lift' },
            { x: 960, t: 'wave', cam: 1050, carry: 0, waves: [
                [S('synth', 'T'), S('synth', 'T', { pal: 'elite' })],
                [S('ninja', 'T'), S('gunner', 'T'), S('drone', 'R', N)],
                [S('guard', 'T', { pal: 'elite' }), S('ripper', 'T'), S('synth', 'T', H)],
                [S('bruiser', 'T'), S('ninja', 'T', { pal: 'b' }), S('drone', 'L')],
                [S('synth', 'T', { pal: 'gold' })],
            ] },
            { x: 1000, t: 'item', item: 'bento', ix: 1050, z: 30 },
            { x: 1020, t: 'dialog', id: 's6_top' },
            { x: 1040, t: 'boss', id: 'mika', dialog: 's6_boss', entrance: 'T', cam: 1050 },
        ],
    },
    // ============================================================ 7
    {
        key: 'zenith', name: 'ZENITH', sub: 'Aurex Penthouse · 5:58 AM', music: 'zenith', bossMusic: 'boss7',
        length: 2700, zMin: 0, zMax: 64,
        theme: 'zenith', rain: true, ambient: [0.92, 0.9, 1.0], fog: 0x241a2c,
        segments: [{ x0: 0, x1: 1800, kind: 'penthouse' }, { x0: 1800, x1: 2700, kind: 'helipad' }],
        props: [
            { type: 'vend', x: 420, z: 62 }, { type: 'terminal', x: 800, z: 62, drop: 'cell' }, { type: 'crate', x: 1100, z: 8, drop: 'katana' },
            { type: 'terminal', x: 1500, z: 62, drop: 'bento' }, { type: 'crate', x: 2050, z: 58, drop: 'medkit' },
        ],
        events: [
            { x: 0, t: 'dialog', id: 's7_intro' },
            { x: 330, t: 'wave', waves: [[S('synth', 'R', { pal: 'elite' }), S('ninja', 'L')], [S('gunner', 'R'), S('gunner', 'L'), S('synth', 'R', N)]] },
            { x: 900, t: 'wave', waves: [[S('ninja', 'R', { pal: 'c' }), S('ninja', 'L', { pal: 'b' }), S('ninja', 'T')], [S('guard', 'R', { pal: 'elite' }), S('synth', 'L', { pal: 'elite' })]] },
            { x: 1450, t: 'wave', waves: [[S('bruiser', 'R'), S('ripper', 'L')], [S('synth', 'R', { pal: 'gold' }), S('drone', 'R'), S('drone', 'L', N)]] },
            { x: 1800, t: 'dialog', id: 's7_roof' },
            { x: 2450, t: 'boss', id: 'magnus', dialog: 's7_boss', entrance: 'R', assist: false },
        ],
    },
];
