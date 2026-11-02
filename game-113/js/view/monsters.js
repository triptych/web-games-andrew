// Pixel monsters, one painter per body plan, coloured by a palette. Everything faces LEFT (toward the band, who stand
// on the left of a battle). Sizes: small 32×32, medium 40×40, bosses 64×64, Vorthrax and the Colossus 112×104.

import { Px, mix, hex } from './pixel.js';

const OUT = '#160f1c';
export const PAL = {
    crystal: { a: '#5ad8e8', b: '#2a7a9a', c: '#d8fbff', eye: '#ff5a8a' },
    gloom: { a: '#6a4ab8', b: '#2a1a5a', c: '#c8b8ff', eye: '#ffe27a' },
    rust: { a: '#b8683a', b: '#5a3a2a', c: '#e8b87a', eye: '#7ff6ff' },
    reef: { a: '#3ab88a', b: '#1a5a5a', c: '#ffb86a', eye: '#ffe27a' },
    violet: { a: '#b85ad8', b: '#5a2a8a', c: '#ffc8f8', eye: '#ffffff' },
    tide: { a: '#2a8ad8', b: '#1a3a7a', c: '#9af0ff', eye: '#ffde5a' },
    crow: { a: '#3a3a4a', b: '#1a1a24', c: '#8a8aa8', eye: '#ff4a3a' },
    thorn: { a: '#5a8a3a', b: '#2a4a1a', c: '#d84a6a', eye: '#ffe27a' },
    hay: { a: '#d8a83a', b: '#7a4a1a', c: '#8a3a2a', eye: '#ff8a1a' },
    ice: { a: '#9ad8ff', b: '#3a6ab8', c: '#ffffff', eye: '#3a3aff' },
    snow: { a: '#e8eef8', b: '#8a9ab8', c: '#5a6a8a', eye: '#5ad8ff' },
    rime: { a: '#7ab8e8', b: '#2a4a8a', c: '#e8f8ff', eye: '#5afff0' },
    obsidian: { a: '#3a3448', b: '#14101c', c: '#9a6aff', eye: '#d85aff' },
    hush: { a: '#4a3a6a', b: '#1a1028', c: '#c86bff', eye: '#ffffff' },
};
const dk = (c, t) => mix(hex(c), '#000000', t);
const lt = (c, t) => mix(hex(c), '#ffffff', t);

const PAINT = {
    crab(P, p) {
        P.mline(8, 26, 3, 31, 2).mline(13, 27, 10, 31, 2).mline(21, 27, 24, 31, 2).mline(26, 26, 30, 31, 2).paint(p.b);
        P.mell(17, 21, 11, 7).paint(p.a, { tex: (x, y) => ((x + y) % 5 === 0 ? 1 : 0) });
        // crystal shards growing from the shell
        P.mpoly([[12, 16], [14, 6], [17, 15]]).mpoly([[17, 15], [21, 4], [23, 15]]).mpoly([[23, 16], [27, 9], [27, 17]]).paint(p.c, { soft: true });
        P.mell(5, 15, 4, 3.4).paint(p.a); P.mpoly([[1, 12], [5, 14], [2, 16]]).fill(p.b);
        P.mell(11, 17, 1.5, 1.5).paint('#ffffff'); P.mp(10, 17).fill(p.eye);
    },
    wisp(P, p) {
        P.mpoly([[16, 4], [26, 12], [27, 22], [22, 30], [18, 26], [14, 31], [9, 26], [6, 18], [8, 10]]).paint(p.a, { tex: (x, y) => (y > 22 && (x + y) % 3 === 0 ? -1 : 0) });
        P.mell(15, 16, 6, 6).paint(p.c, { soft: true });
        P.mrect(11, 14, 2, 3).fill(p.b); P.mrect(16, 14, 2, 3).fill(p.b);
        P.mrect(12, 19, 4, 2).fill(p.b);
    },
    automaton(P, p) {
        P.mrect(10, 26, 4, 6).mrect(20, 26, 4, 6).paint(p.b);
        P.mrect(8, 13, 18, 14).paint(p.a, { tex: (x, y) => (x % 5 === 0 || y === 19 ? -1 : 0) });
        P.mell(17, 9, 6, 5).paint(p.a);
        P.mell(14, 9, 2.6, 2.6).paint(p.eye, { soft: true });
        P.mline(8, 15, 2, 22, 2).mline(26, 15, 30, 22, 2).paint(p.b);
        P.mell(17, 20, 3, 3).paint(p.c);
        P.mrect(16, 1, 2, 4).paint(p.b);
    },
    fishman(P, p) {
        P.mrect(11, 27, 3, 5).mrect(19, 27, 3, 5).paint(p.b);
        P.mell(16, 20, 8, 9).paint(p.a, { tex: (x, y) => ((x * 2 + y) % 6 === 0 ? -1 : 0) });
        P.mell(13, 10, 7, 6).paint(p.a);
        P.mpoly([[6, 12], [12, 12], [7, 15]]).fill('#2a1a1a');                  // a wide mouth
        P.mell(11, 8, 2.4, 2.4).paint('#ffffff'); P.mp(10, 8).fill('#1a1a1a');
        P.mpoly([[17, 4], [24, 2], [22, 9]]).paint(p.c);                        // a fin
        P.mline(24, 17, 30, 9, 1).paint('#c8b88a'); P.mpoly([[28, 6], [31, 8], [30, 10]]).fill('#c8b88a');   // a fork
    },
    jelly(P, p) {
        for (let i = 0; i < 5; i++) P.mline(8 + i * 4, 18, 7 + i * 4 + (i % 2 ? 2 : -1), 31, 1);
        P.paint(p.b);
        P.mell(16, 13, 11, 9).msub((q) => q.mrect(0, 17, 32, 10)).paint(p.a, { tex: (x, y) => ((x + y) % 4 === 0 ? 1 : 0) });
        P.mell(13, 10, 3, 2).paint(p.c, { soft: true });
        P.mp(12, 13).mp(18, 13).fill('#ffffff');
    },
    bird(P, p) {
        P.mrect(16, 32, 2, 6).mrect(22, 32, 2, 6).paint('#c8a84a');
        P.mpoly([[10, 16], [28, 14], [32, 30], [12, 34]]).paint(p.a, { tex: (x, y) => ((x + y * 2) % 5 === 0 ? -1 : 0) });
        P.mpoly([[24, 16], [38, 22], [36, 30], [28, 28]]).paint(p.b);          // a wing
        P.mell(14, 11, 7, 6).paint(p.a);
        P.mpoly([[4, 11], [9, 9], [9, 14]]).paint('#e8b83a');                  // the beak
        P.mp(11, 10).fill(p.eye);
        // a battered helmet and a rusty sword
        P.mpoly([[8, 6], [20, 4], [21, 9], [9, 9]]).paint('#8a94a8');
        P.mline(8, 26, 2, 14, 2).paint('#c8d0e0');
    },
    imp(P, p) {
        P.mrect(11, 25, 3, 6).mrect(18, 25, 3, 6).paint(p.b);
        P.mell(16, 20, 7, 7).paint(p.a, { tex: (x, y) => ((x * y) % 7 === 0 ? -1 : 0) });
        P.mell(15, 11, 7, 6).paint(p.a);
        for (const [x, y] of [[9, 5], [15, 3], [21, 5], [24, 12], [6, 13]]) P.mpoly([[x, y], [x + 2, y + 4], [x - 2, y + 4]]);
        P.paint(p.c);
        P.mrect(11, 10, 2, 2).fill(p.eye); P.mrect(16, 10, 2, 2).fill(p.eye);
        P.mrect(11, 14, 6, 1).fill('#2a1a1a');
    },
    mite(P, p) {
        P.mline(8, 24, 3, 30, 1).mline(12, 25, 9, 31, 1).mline(20, 25, 23, 31, 1).mline(24, 24, 29, 30, 1).paint(p.b);
        P.mell(17, 21, 9, 6).paint(p.a, { tex: (x, y) => ((x + y) % 3 === 0 ? 1 : 0) });
        P.mpoly([[12, 16], [15, 8], [18, 16]]).mpoly([[19, 16], [23, 10], [24, 17]]).paint(p.c, { soft: true });
        P.mell(9, 20, 4, 3.5).paint(p.a);
        P.mp(8, 19).mp(10, 19).fill(p.eye);
    },
    wolf(P, p) {
        P.mrect(9, 29, 3, 9).mrect(15, 30, 3, 8).mrect(27, 29, 3, 9).mrect(32, 30, 3, 8).paint(p.b);
        P.mell(23, 25, 14, 7).paint(p.a, { tex: (x, y) => ((x + y) % 4 === 0 ? -1 : 0) });
        P.mpoly([[34, 21], [40, 14], [39, 24]]).paint(p.a);                     // the tail
        P.mell(10, 18, 7, 6).paint(p.a);
        P.mpoly([[1, 19], [6, 16], [6, 23]]).paint(p.a);
        P.mpoly([[9, 9], [12, 14], [7, 13]]).mpoly([[14, 9], [16, 14], [12, 13]]).paint(p.b);
        P.mp(7, 17).mp(8, 17).fill(p.eye);
        P.mrect(2, 21, 3, 1).fill('#ffffff');
    },
    knight(P, p) {
        P.mrect(13, 30, 4, 10).mrect(22, 30, 4, 10).paint(p.b);
        P.mpoly([[11, 15], [28, 15], [30, 31], [9, 31]]).paint(p.a, { tex: (x, y) => (y === 22 ? -1 : 0) });
        P.mell(19, 10, 7, 7).paint(p.a);
        P.mrect(13, 9, 9, 2).fill(p.eye);                                       // a glowing visor slit
        P.mpoly([[19, 2], [23, 0], [22, 5]]).paint(p.c);                        // a plume of hush-flame
        P.mpoly([[3, 4], [6, 4], [6, 30], [3, 32]]).paint('#2a2434');           // a black greatsword
        P.mline(4, 6, 4, 26, 1).fill(p.c);
        P.mpoly([[24, 16], [36, 20], [33, 34], [24, 32]]).paint(p.b);           // a shield
        P.mell(30, 26, 2, 2).paint(p.c, { soft: true });
    },
    moth(P, p) {
        P.mpoly([[20, 18], [38, 4], [38, 22], [24, 26]]).mpoly([[20, 18], [2, 4], [2, 22], [16, 26]]).paint(p.a, { tex: (x, y) => ((x * y) % 9 === 0 ? 1 : 0) });
        P.mell(30, 12, 3, 3).mell(10, 12, 3, 3).paint(p.c, { soft: true });
        P.mpoly([[20, 26], [36, 32], [28, 38]]).mpoly([[20, 26], [4, 32], [12, 38]]).paint(p.b);
        P.mell(20, 22, 3, 10).paint(dk(p.a, 0.3));
        P.mp(18, 13).mp(22, 13).fill(p.eye);
        P.mline(18, 12, 14, 4).mline(22, 12, 26, 4).fill(p.c);
    },
    // -------------------------------------------------------- bosses, 64×64
    serpent(P, p) {
        // coils rising out of the water, a finned head, a pearl-lit crown
        P.mell(40, 54, 20, 8).paint(p.b, { tex: (x, y) => ((x + y) % 5 === 0 ? 1 : 0) });
        P.mpoly([[30, 54], [36, 30], [46, 24], [52, 32], [46, 56]]).paint(p.a, { tex: (x, y) => ((x * 2 + y) % 6 === 0 ? -1 : 0) });
        P.mpoly([[36, 34], [40, 30], [42, 54], [36, 54]]).paint(p.c, { soft: true });   // belly
        P.mell(30, 20, 13, 10).paint(p.a);
        P.mpoly([[10, 20], [20, 14], [22, 26], [12, 26]]).paint(p.a);          // a long snout
        P.mpoly([[12, 24], [22, 24], [16, 28]]).fill('#2a0a1a');
        for (let i = 0; i < 3; i++) P.mp(14 + i * 3, 24).fill('#ffffff');
        P.mpoly([[26, 8], [36, 2], [44, 10], [40, 16]]).mpoly([[40, 12], [54, 8], [50, 20]]).paint(p.c);   // fins
        P.mell(26, 16, 2.6, 2.6).paint(p.eye, { soft: true }); P.mp(25, 16).fill('#1a0a0a');
        P.mell(34, 6, 3, 3).paint('#fff6e8', { soft: true });                   // the pearl
    },
    scarecrow(P, p) {
        P.mrect(30, 34, 3, 30).paint('#6a4a2a');                                // the pole
        P.mrect(8, 26, 48, 4).paint('#7a5a3a');                                 // the crossbar
        P.mpoly([[20, 26], [44, 26], [48, 52], [16, 52]]).paint('#5a3a5a', { tex: (x, y) => ((x + y) % 7 === 0 ? -1 : 0) });   // a ragged coat
        P.mpoly([[16, 52], [20, 52], [18, 58]]).mpoly([[26, 52], [30, 52], [28, 59]]).mpoly([[38, 52], [42, 52], [40, 58]]).paint('#5a3a5a');
        for (const [x, y] of [[8, 28], [56, 28], [24, 54], [40, 54]]) P.mpoly([[x - 3, y], [x + 3, y], [x, y + 6]]);
        P.paint(p.a, { tex: (x, y) => (x % 2 ? 1 : -1) });                      // straw bursting out
        P.mell(32, 16, 10, 10).paint('#e8c88a', { tex: (x, y) => ((x * y) % 11 === 0 ? -1 : 0) });   // a sack head
        P.mpoly([[18, 10], [46, 10], [40, 2], [26, 0]]).paint('#3a2a2a');       // a tall hat
        P.mrect(16, 9, 32, 3).paint('#3a2a2a');
        P.mpoly([[24, 14], [29, 13], [28, 18]]).mpoly([[34, 13], [39, 14], [35, 18]]).fill(p.eye);
        P.mpoly([[24, 21], [40, 21], [36, 24], [28, 24]]).fill('#2a1a10');
        for (let i = 0; i < 5; i++) P.mp(26 + i * 3, 22).fill('#e8c88a');
        P.mpoly([[2, 34], [10, 30], [8, 40]]).paint('#2a2a34');                 // a crow on the arm
        P.mp(4, 33).fill('#ff4a3a');
    },
    wolfknight(P, p) {
        P.mrect(22, 46, 6, 18).mrect(36, 46, 6, 18).paint(p.b);
        P.mpoly([[18, 22], [46, 22], [50, 48], [14, 48]]).paint(p.a, { tex: (x, y) => (y % 6 === 0 ? -1 : 0) });
        P.mpoly([[46, 22], [60, 30], [54, 60], [44, 50]]).paint(lt(p.b, 0.2));  // a frost cape
        P.mell(30, 14, 11, 9).paint(p.a);
        P.mpoly([[6, 16], [20, 10], [20, 22], [10, 22]]).paint(p.a);            // a wolf's snout
        P.mpoly([[24, 2], [28, 9], [21, 8]]).mpoly([[34, 2], [37, 9], [31, 8]]).paint(p.c);
        P.mp(18, 13).mp(19, 13).mp(24, 13).fill(p.eye);
        P.mrect(8, 21, 8, 1).fill('#ffffff');
        P.mpoly([[2, 14], [6, 12], [8, 56], [4, 58]]).paint(p.c, { soft: true });   // an ice greatsword
        P.mell(30, 34, 4, 4).paint(p.c, { soft: true });
    },
    warden(P, p) {
        P.mrect(18, 48, 9, 16).mrect(37, 48, 9, 16).paint(p.b);
        P.mpoly([[12, 18], [52, 18], [56, 50], [8, 50]]).paint(p.a, { tex: (x, y) => ((x % 8 === 0 || y % 8 === 0) ? -1 : 0) });
        P.mpoly([[2, 18], [12, 18], [10, 44], [2, 40]]).mpoly([[52, 18], [62, 18], [62, 40], [54, 44]]).paint(p.b);   // pauldron-arms
        P.mpoly([[22, 2], [42, 2], [44, 18], [20, 18]]).paint(p.a);
        P.mrect(24, 9, 16, 3).fill(p.eye);
        P.mpoly([[30, 22], [34, 22], [36, 40], [28, 40]]).paint(p.c, { soft: true });   // a crystal core
        for (const [x, y] of [[16, 0], [48, 0], [8, 14]]) P.mpoly([[x, y + 8], [x + 3, y], [x + 6, y + 8]]);
        P.paint(p.c);
    },
    // -------------------------------------------------------- 112×104
    dragon(P, p) {
        // wings first, behind
        P.mpoly([[60, 40], [100, 4], [110, 30], [104, 60], [80, 64]]).paint(p.b, { tex: (x, y) => ((x - y) % 9 === 0 ? 1 : 0) });
        P.mline(60, 40, 100, 4, 2).mline(70, 46, 108, 34, 2).mline(76, 54, 104, 60, 2).paint(p.a);
        // tail
        P.mpoly([[70, 84], [96, 80], [110, 92], [92, 96], [76, 94]]).paint(p.a);
        // body
        P.mell(66, 72, 26, 20).paint(p.a, { tex: (x, y) => ((x * 3 + y * 2) % 11 === 0 ? -1 : 0) });
        P.mpoly([[50, 66], [64, 60], [70, 90], [52, 92]]).paint(p.c, { soft: true, hi: 0.6 });   // a pale belly
        // legs and claws
        P.mrect(48, 84, 10, 18).mrect(74, 86, 10, 16).paint(p.b);
        for (const x of [46, 50, 54, 72, 76, 80]) P.mpoly([[x, 101], [x + 2, 104], [x + 4, 101]]);
        P.paint('#e8e0f0');
        // the long neck and the head
        P.mpoly([[44, 66], [30, 40], [36, 26], [48, 34], [58, 62]]).paint(p.a);
        P.mell(30, 26, 14, 11).paint(p.a);
        P.mpoly([[6, 26], [20, 20], [22, 34], [8, 34]]).paint(p.a);
        P.mpoly([[8, 32], [22, 32], [14, 38]]).fill('#1a0a1a');
        for (let i = 0; i < 4; i++) P.mpoly([[10 + i * 3, 32], [11 + i * 3, 35], [12 + i * 3, 32]]);
        P.fill('#ffffff');
        // horns of black glass
        P.mpoly([[30, 16], [44, 0], [40, 18]]).mpoly([[36, 18], [58, 8], [46, 24]]).paint('#1a1428', { light: '#9a6aff' });
        P.mell(26, 22, 3.4, 2.6).paint(p.eye, { soft: true }); P.mrect(25, 21, 2, 3).fill('#1a0a1a');
        // the obsidian heart, glowing through the chest
        P.mpoly([[58, 62], [64, 54], [70, 62], [64, 74]]).paint(p.c, { soft: true, light: '#ffffff' });
        // spines
        for (let i = 0; i < 6; i++) P.mpoly([[50 + i * 7, 52 - (i < 3 ? 4 - i : 0)], [54 + i * 7, 42 + i], [58 + i * 7, 52]]);
        P.paint('#1a1428');
    },
    colossus(P, p) {
        const gold = '#e8b83a', deep = '#7a4a1a', glass = '#7ff6ff';
        // legs
        P.mpoly([[30, 72], [46, 72], [48, 102], [26, 102]]).mpoly([[66, 72], [82, 72], [86, 102], [64, 102]]).paint(gold, { tex: (x, y) => (y % 8 === 0 ? -1 : 0) });
        // torso
        P.mpoly([[22, 30], [90, 30], [86, 76], [26, 76]]).paint(gold, { tex: (x, y) => ((x % 10 === 0 || y % 12 === 0) ? -1 : 0) });
        // arms: raised, like the statue
        P.mpoly([[22, 32], [8, 6], [16, 2], [32, 34]]).mpoly([[90, 32], [104, 6], [96, 2], [80, 34]]).paint(gold);
        P.mell(12, 4, 6, 5).mell(100, 4, 6, 5).paint(deep);
        // head
        P.mpoly([[42, 8], [70, 8], [74, 28], [38, 28]]).paint(gold);
        P.mrect(46, 15, 20, 5).paint('#2a1a10'); P.mrect(48, 16, 16, 3).fill(glass);
        P.mpoly([[52, 8], [56, 0], [60, 8]]).paint('#ff6a5a');
        // the chest: Otto, home, his eye where the heart was
        P.mpoly([[44, 40], [68, 40], [70, 62], [42, 62]]).paint(deep);
        P.mell(56, 51, 8, 8).paint('#5a3a1a'); P.mell(56, 51, 6, 6).paint(glass, { soft: true, light: '#ffffff' });
        P.mrect(53, 48, 2, 2).fill('#ffffff');
        // organ pipes on the shoulders: it sings
        for (let i = 0; i < 4; i++) { P.mrect(24 + i * 4, 18 - i * 2, 3, 14 + i * 2); P.mrect(76 + i * 4, 12 + i * 2, 3, 20 - i * 2); }
        P.paint('#d8d8e8');
    },
};

const SIZE = { serpent: 64, scarecrow: 64, wolfknight: 64, warden: 64, dragon: 112, colossus: 112, bird: 40, wolf: 40, knight: 40, moth: 40 };

export function drawMonster(sprite, pal = 'crystal') {
    const n = SIZE[sprite] || 32;
    const P = new Px(n, sprite === 'dragon' || sprite === 'colossus' ? 104 : n);
    (PAINT[sprite] || PAINT.wisp)(P, PAL[pal] || PAL.crystal);
    P.outline(OUT, 0.85);
    return P;
}
export const SPRITES = Object.keys(PAINT);
