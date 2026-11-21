// Enemy archetypes. Pure data: movement and fire are named here and implemented in js/sim/enemies.js and
// js/sim/patterns.js. hp is at NORMAL difficulty. `model` is what the view builds (js/view/models.js).
//
// fire: [pattern, every (s), params]. A pattern list is cycled.

export const ENEMIES = {
    mote:     { hp: 2.5, r: 0.5,  score: 100,  model: 'mote',     move: 'sine',  fire: [['aimed', 2.6, { n: 1, speed: 7 }]], firstShot: 0.9, chance: 0.6 },
    dart:     { hp: 2,   r: 0.45, score: 150,  model: 'dart',     move: 'swoop', fire: [['aimed', 9, { n: 3, spread: 0.32, speed: 8.5 }]], firstShot: 0.5 },
    pod:      { hp: 12,  r: 0.8,  score: 400,  model: 'pod',      move: 'drift', fire: [['ring', 2.4, { n: 10, speed: 5.5 }]], firstShot: 1.0 },
    gunship:  { hp: 40,  r: 1.2,  score: 1200, model: 'gunship',  move: 'hover', fire: [['fan', 1.4, { n: 7, arc: 0.9, speed: 7.5 }], ['aimed', 0.9, { n: 3, spread: 0.12, speed: 10 }]], drop: 0.3, big: true },
    carrier:  { hp: 130, r: 2.0,  score: 5000, model: 'carrier',  move: 'slow',  fire: [['spiral', 0.08, { arms: 3, speed: 5, rot: 2.1 }], ['spawn', 2.2, { type: 'mote' }]], drop: 1, big: true },
    mine:     { hp: 6,   r: 0.6,  score: 200,  model: 'mine',     move: 'drift', fire: [], death: ['ring', { n: 14, speed: 5 }], fuse: 7 },
    manta:    { hp: 18,  r: 1.0,  score: 600,  model: 'manta',    move: 'glide', fire: [['spiral', 0.12, { arms: 3, speed: 6, rot: 3.3, burst: 1.4 }]], firstShot: 1.2 },
    shard:    { hp: 10,  r: 0.7,  score: 300,  model: 'shard',    move: 'sine',  fire: [['aimed', 2.0, { n: 2, spread: 0.2, speed: 8 }]], split: 'shardlet' },
    shardlet: { hp: 2,   r: 0.35, score: 80,   model: 'shardlet', move: 'scatter', fire: [] },
    squid:    { hp: 25,  r: 1.0,  score: 700,  model: 'squid',    move: 'jet',   fire: [['wave', 1.6, { n: 5, speed: 6, amp: 2.2, freq: 3 }]], firstShot: 0.8 },
    sentinel: { hp: 35,  r: 1.1,  score: 900,  model: 'sentinel', move: 'hover', fire: [['stream', 1.8, { n: 6, gap: 0.07, speed: 11 }]], drop: 0.2, big: true },
    eye:      { hp: 50,  r: 1.3,  score: 1500, model: 'eye',      move: 'hover', fire: [['flower', 1.7, { n: 16, speed: 5, curve: 0.6 }]], drop: 0.25, big: true },
    serpent:  { hp: 30,  r: 1.0,  score: 2000, model: 'serpentHead', move: 'serpent', fire: [['aimed', 1.3, { n: 5, spread: 0.18, speed: 8 }]], segments: 9, big: true },
    segment:  { hp: 6,   r: 0.7,  score: 120,  model: 'segment',  move: 'follow', fire: [['ring', 4.5, { n: 6, speed: 4.5 }]] },
    cruiser:  { hp: 170, r: 2.4,  score: 6000, model: 'cruiser',  move: 'slow',  fire: [['curtain', 2.6, { rows: 9, speed: 6, gap: 2 }], ['ring', 0.9, { n: 18, speed: 6 }], ['aimed', 0.4, { n: 5, spread: 0.1, speed: 11 }]], drop: 1, big: true },
    kamikaze: { hp: 4,   r: 0.5,  score: 150,  model: 'kamikaze', move: 'ram',   fire: [], revenge: 3 },
    bearer:   { hp: 20,  r: 1.0,  score: 800,  model: 'bearer',   move: 'hover', fire: [['fan', 1.6, { n: 5, arc: 0.6, speed: 7 }]], shield: true },
    angel:    { hp: 60,  r: 1.3,  score: 2000, model: 'angel',    move: 'hover', fire: [['ring', 1.2, { n: 20, speed: 5 }], ['aimed', 0.5, { n: 3, spread: 0.25, speed: 9 }], ['laser', 3.5, { warm: 0.9, life: 1.0, w: 0.5 }]], drop: 0.3, big: true },
    egg:      { hp: 5,   r: 0.55, score: 120,  model: 'egg',      move: 'drift', fire: [], hatch: 3.5 },
    turret:   { hp: 18,  r: 0.75, score: 500,  model: 'turret',   move: 'mounted', fire: [['aimed', 1.5, { n: 3, spread: 0.16, speed: 8.5 }]] },
    bigturret:{ hp: 45,  r: 1.0,  score: 1200, model: 'bigturret', move: 'mounted', fire: [['spiral', 0.1, { arms: 4, speed: 5.5, rot: 1.6, burst: 2.0 }], ['fan', 1.2, { n: 9, arc: 1.2, speed: 7 }]] },
    engine:   { hp: 70,  r: 1.2,  score: 3000, model: 'engine',   move: 'mounted', fire: [['ring', 3.0, { n: 8, speed: 4 }]], big: true },
};
