// Procedural pixel-art monsters and bosses, facing right. Each draws into a Px; palettes give every kind its variants.

import { Px, mix } from './pixel.js';

const EYE = '#fff6a8';
const PAL = {
    slime: { base: ['#6fd45a', '#3a9a3a'], blue: ['#5ab4f0', '#3a6ac8'], red: ['#f0704a', '#c8382a'], ice: ['#a8e8ff', '#5aa8e0'] },
    bat: { base: ['#6a4a8a', '#3a2a5a'], ice: ['#8ac0e8', '#4a7aa8'] },
    wolf: { base: ['#7a7a88', '#4a4a58'], ice: ['#d8ecff', '#8ab0d0'], red: ['#a8503a', '#6a2a1a'] },
    goblin: { base: ['#7ac04a', '#4a8a2a'], red: ['#c85a3a', '#8a2a1a'], blue: ['#5a9ac0', '#2a5a8a'] },
    shroom: { base: ['#d8483a', '#8a2a2a'] },
    sapling: { base: ['#6a8a3a', '#3a5a1a'] },
    skeleton: { base: ['#e8e0c8', '#a8a088'] },
    golem: { base: ['#8a8a96', '#5a5a68'] },
    crab: { base: ['#e0683a', '#a8381a'] },
    jelly: { base: ['#e08ae8', '#a85ac8'] },
    naga: { base: ['#3aa88a', '#1a6a6a'] },
    wisp: { base: ['#7fc8ff', '#3a7ad8'], ice: ['#d8f4ff', '#7ab8e8'], void: ['#b070ff', '#5a2aa8'] },
    scorpion: { base: ['#c8a050', '#8a6a2a'] },
    cobra: { base: ['#6aa84a', '#3a6a2a'] },
    mummy: { base: ['#e0d4b0', '#a8986a'] },
    harpy: { base: ['#a86ad8', '#6a3aa8'] },
    yeti: { base: ['#f0f4fa', '#9ab0d0'] },
    knight: { base: ['#6a6a7a', '#3a3a4a'], void: ['#4a2a6a', '#201030'], gold: ['#c8a040', '#7a5a1a'] },
    imp: { base: ['#e04a3a', '#8a1a1a'] },
    drake: { base: ['#c85a3a', '#7a2a1a'], red: ['#e0382a', '#8a1a0a'], void: ['#3a2a4a', '#1a1028'] },
    shade: { base: ['#4a3a6a', '#1a1030'], void: ['#2a1a3a', '#0a0414'] },
    gargoyle: { base: ['#7a8a9a', '#4a5a6a'] },
    fiend: { base: ['#8a2a4a', '#4a1028'] },
    treant: { base: ['#6a5030', '#3a2a14'] },
    colossus: { base: ['#8a8a86', '#56565a'] },
    kraken: { base: ['#4a6ad8', '#2a3a9a'] },
    pharaoh: { base: ['#e8c848', '#2a6aa8'] },
    wyrm: { base: ['#aee0ff', '#4a8ac8'] },
    king: { base: ['#2a1a3a', '#b070ff'] },
};

const pal = (kind, p) => PAL[kind]?.[p] || PAL[kind]?.base || ['#888', '#444'];
const eye = (P, x, y, c = EYE, s = 2) => { P.mrect(x, y, s, s).fill(c); P.mp(x + s - 1, y + s - 1).fill('#201020'); };

const DRAW = {
    slime(P, [a, b]) {
        P.mell(18, 20, 14, 9).paint(a); P.mell(18, 14, 10, 8).paint(a); P.mrect(8, 24, 20, 3).paint(b);
        P.mell(13, 11, 3, 2).fill(mix(a, '#fff', 0.55)); eye(P, 19, 17); eye(P, 25, 17);
        P.mrect(21, 22, 4, 1).fill('#201020');
    },
    bat(P, [a, b]) {
        P.mpoly([[22, 14], [2, 6], [6, 16], [4, 26], [12, 20], [16, 28], [22, 20]]).paint(b);
        P.mpoly([[22, 14], [42, 6], [38, 16], [40, 26], [32, 20], [28, 28], [22, 20]]).paint(b);
        P.mell(22, 18, 7, 8).paint(a); P.mpoly([[17, 12], [16, 4], [21, 10]]).mpoly([[27, 12], [28, 4], [23, 10]]).paint(a);
        eye(P, 19, 15, '#ff4a4a', 1); eye(P, 24, 15, '#ff4a4a', 1); P.mp(20, 22).mp(24, 22).fill('#fff');
    },
    wolf(P, [a, b]) {
        P.mell(24, 20, 15, 9).paint(a); P.mpoly([[36, 14], [48, 20], [48, 26], [36, 26]]).paint(a);
        P.mpoly([[36, 14], [38, 6], [41, 14]]).paint(b); P.mpoly([[42, 14], [44, 7], [46, 16]]).paint(b);
        for (const x of [12, 17, 28, 33]) P.mrect(x, 26, 3, 8).paint(b);
        P.mpoly([[10, 18], [0, 12], [3, 22], [10, 24]]).paint(a);
        P.mrect(45, 20, 4, 2).fill('#201020'); eye(P, 41, 17, '#ffd84a', 2); P.mrect(43, 24, 4, 1).fill('#fff');
        P.mrect(20, 12, 12, 2).paint(b, { flat: true });
    },
    goblin(P, [a, b]) {
        P.mrect(12, 24, 12, 14).paint('#8a5a3a'); P.mrect(12, 36, 5, 8).mrect(19, 36, 5, 8).paint(b);
        P.mell(18, 15, 9, 8).paint(a); P.mpoly([[9, 14], [0, 10], [9, 18]]).mpoly([[27, 14], [36, 10], [27, 18]]).paint(a);
        eye(P, 17, 13, '#ffe04a', 2); eye(P, 22, 13, '#ffe04a', 2); P.mrect(17, 20, 6, 2).fill('#201020'); P.mp(18, 21).mp(21, 21).fill('#fff');
        P.mrect(24, 26, 3, 10).paint('#6a4a2a'); P.mrect(22, 18, 7, 9).paint('#8a6a3a');
        P.mrect(10, 26, 3, 9).paint(a);
    },
    shroom(P, [a, b]) {
        P.mrect(11, 20, 14, 14).paint('#f0e0c0'); P.mrect(12, 34, 4, 3).mrect(20, 34, 4, 3).paint('#c8b090');
        P.mell(18, 14, 16, 11).msub((Q) => Q.mrect(0, 22, 36, 14)).paint(a);
        for (const [x, y] of [[10, 10], [20, 7], [26, 14], [14, 15]]) P.mell(x, y, 2.5, 2).fill('#f8e8d0');
        eye(P, 14, 24, '#201020', 2); eye(P, 21, 24, '#201020', 2); P.mrect(17, 29, 3, 1).fill('#8a4a4a');
    },
    sapling(P, [a, b]) {
        P.mrect(15, 24, 10, 20).paint('#7a5230'); P.mrect(11, 40, 6, 6).mrect(23, 40, 6, 6).paint('#5a3a20');
        P.mell(20, 14, 17, 12).paint(a); P.mell(12, 12, 7, 6).mell(28, 10, 7, 6).paint(b);
        P.mline(15, 30, 6, 24, 3).mline(25, 30, 34, 26, 3).paint('#7a5230');
        eye(P, 16, 30, '#ffd84a', 2); eye(P, 22, 30, '#ffd84a', 2); P.mrect(17, 35, 5, 1).fill('#201020');
    },
    skeleton(P, [a, b]) {
        P.mell(18, 9, 7, 7).paint(a); P.mrect(13, 14, 10, 4).paint(a); P.mrect(14, 14, 3, 1).mrect(19, 14, 3, 1).fill('#201020');
        eye(P, 14, 8, '#ff5a3a', 2); eye(P, 20, 8, '#ff5a3a', 2);
        P.mrect(17, 18, 3, 12).paint(a); for (const y of [20, 23, 26]) P.mrect(11, y, 15, 2).paint(a);
        P.mrect(11, 30, 14, 3).paint(b); P.mrect(13, 33, 3, 12).mrect(20, 33, 3, 12).paint(a);
        P.mline(10, 20, 6, 34, 2).mline(26, 20, 31, 30, 2).paint(a); P.mline(31, 30, 31, 12, 2).paint('#c8d0e0');
    },
    golem(P, [a, b]) {
        P.mrect(16, 16, 24, 26).paint(a); P.mrect(20, 6, 16, 12).paint(a); P.mrect(6, 18, 10, 20).mrect(40, 18, 10, 20).paint(b);
        P.mrect(18, 40, 8, 14).mrect(30, 40, 8, 14).paint(b);
        eye(P, 24, 10, '#ff8a3a', 3); eye(P, 31, 10, '#ff8a3a', 3); P.mrect(25, 16, 6, 2).fill('#201020');
        P.mrect(22, 24, 12, 8).paint('#3a2a2a', { flat: true }); P.mell(28, 28, 4, 3).fill('#ff8a3a');
        P.mpoly([[18, 16], [22, 22], [16, 28]]).fill(mix(a, '#000', 0.35));
    },
    crab(P, [a, b]) {
        P.mell(24, 20, 14, 9).paint(a); for (const x of [10, 16, 32, 38]) P.mline(x, 26, x + (x < 24 ? -4 : 4), 31, 2).paint(b);
        P.mell(6, 12, 6, 5).mell(42, 12, 6, 5).paint(a); P.mpoly([[2, 8], [6, 12], [0, 14]]).mpoly([[46, 8], [42, 12], [48, 14]]).fill(b);
        P.mline(18, 12, 17, 6, 1).mline(30, 12, 31, 6, 1).paint(b); eye(P, 16, 4, '#fff', 2); eye(P, 30, 4, '#fff', 2);
        P.mrect(21, 22, 6, 1).fill('#201020');
    },
    jelly(P, [a, b]) {
        P.mell(20, 16, 15, 12).msub((Q) => Q.mrect(0, 20, 40, 14)).paint(mix(a, '#fff', 0.2));
        P.mrect(5, 18, 30, 5).paint(a); for (const x of [8, 14, 20, 26, 32]) P.mline(x, 22, x + ((x * 7) % 3) - 1, 40, 2).paint(b);
        eye(P, 14, 14, '#201020', 3); eye(P, 22, 14, '#201020', 3); P.mell(14, 8, 4, 2).fill('#ffffffaa'.slice(0, 7));
    },
    naga(P, [a, b]) {
        P.mline(22, 28, 20, 52, 8).mline(20, 50, 34, 54, 5).paint(a); P.mline(30, 52, 44, 50, 3).paint(b);
        P.mrect(16, 16, 14, 14).paint('#e8b890'); P.mell(23, 9, 7, 7).paint('#e8b890'); P.mrect(15, 14, 16, 3).paint(a);
        P.mrect(14, 4, 18, 4).paint(b); eye(P, 24, 8, '#40e0ff', 2); eye(P, 28, 8, '#40e0ff', 2);
        P.mline(14, 20, 8, 28, 3).mline(32, 20, 40, 14, 3).paint('#e8b890'); P.mline(40, 14, 40, 0, 2).paint('#c8d8e8'); P.mpoly([[37, 3], [40, 0], [43, 3]]).fill('#e8f0f8');
        P.mrect(16, 24, 14, 6).paint(b);
    },
    wisp(P, [a, b]) {
        P.mell(16, 24, 11, 13).paint(a); P.mpoly([[8, 20], [16, 0], [24, 20]]).paint(a); P.mpoly([[14, 34], [10, 44], [18, 38], [22, 46], [22, 34]]).paint(b);
        P.mell(16, 24, 6, 8).fill(mix(a, '#ffffff', 0.55)); eye(P, 11, 22, '#201030', 3); eye(P, 18, 22, '#201030', 3); P.mrect(14, 30, 4, 2).fill('#201030');
    },
    scorpion(P, [a, b]) {
        P.mell(26, 24, 15, 8).paint(a); for (const x of [18, 24, 30, 36]) P.mline(x, 28, x - 3, 34, 2).paint(b);
        P.mline(12, 22, 6, 16, 3).mline(6, 16, 12, 6, 3).mline(12, 6, 20, 4, 3).paint(a); P.mpoly([[18, 2], [24, 6], [20, 9]]).fill('#ff4a3a');
        P.mell(42, 18, 5, 4).mell(46, 28, 5, 4).paint(b); P.mpoly([[44, 14], [52, 18], [46, 21]]).mpoly([[48, 25], [55, 28], [49, 32]]).paint(a);
        eye(P, 36, 20, '#201020', 2); eye(P, 39, 20, '#201020', 2);
    },
    cobra(P, [a, b]) {
        P.mell(18, 42, 14, 5).mell(24, 34, 10, 5).paint(a); P.mrect(14, 14, 10, 22).paint(a);
        P.mpoly([[14, 10], [4, 18], [14, 26], [24, 26], [30, 18], [24, 10]]).paint(b); P.mell(19, 14, 7, 6).paint(a);
        eye(P, 17, 11, '#ffe04a', 2); eye(P, 22, 11, '#ffe04a', 2); P.mrect(26, 16, 3, 1).fill('#ff4a4a');
        P.mpoly([[14, 22], [19, 32], [24, 22]]).fill('#f0e0a0');
    },
    mummy(P, [a, b]) {
        P.mell(18, 9, 7, 7).paint(a); P.mrect(11, 15, 14, 18).paint(a); P.mrect(12, 32, 5, 14).mrect(19, 32, 5, 14).paint(b);
        P.mline(8, 18, 4, 32, 4).mline(28, 18, 34, 26, 4).paint(a);
        for (let y = 16; y < 32; y += 4) P.mrect(11, y, 14, 1).fill(b); eye(P, 17, 8, '#ff4a4a', 2); eye(P, 22, 8, '#ff4a4a', 1);
    },
    harpy(P, [a, b]) {
        P.mpoly([[22, 20], [2, 6], [8, 22], [4, 36], [18, 30]]).paint(b); P.mpoly([[22, 20], [30, 4], [34, 22], [30, 34], [24, 30]]).paint(b);
        P.mell(24, 24, 7, 9).paint(a); P.mell(25, 11, 6, 6).paint('#e8c0a0'); P.mrect(18, 5, 14, 3).paint(a);
        eye(P, 26, 10, '#201020', 2); P.mpoly([[28, 12], [34, 14], [28, 15]]).fill('#ffd84a');
        P.mrect(20, 33, 3, 9).mrect(26, 33, 3, 9).paint('#d8a840'); P.mpoly([[18, 42], [24, 42], [18, 46]]).mpoly([[24, 42], [30, 42], [24, 46]]).fill('#d8a840');
    },
    yeti(P, [a, b]) {
        P.mell(26, 28, 17, 18).paint(a); P.mell(30, 10, 10, 9).paint(a); P.mline(14, 20, 6, 42, 8).mline(40, 22, 48, 42, 8).paint(a);
        P.mrect(18, 42, 8, 12).mrect(30, 42, 8, 12).paint(b); P.mell(32, 12, 6, 5).fill('#5a7ab0');
        eye(P, 31, 9, '#40a0ff', 2); eye(P, 36, 9, '#40a0ff', 2); P.mrect(31, 15, 7, 2).fill('#201020'); P.mp(32, 16).mp(36, 16).fill('#fff');
        P.mpoly([[22, 6], [24, 0], [28, 6]]).fill(b);
    },
    knight(P, [a, b]) {
        P.mrect(14, 22, 16, 22).paint(a); P.mrect(15, 40, 6, 14).mrect(23, 40, 6, 14).paint(b);
        P.mell(22, 12, 8, 9).paint(a); P.mrect(16, 8, 12, 5).paint(b); P.mrect(18, 9, 8, 2).fill('#201020');
        P.mrect(19, 9, 2, 2).mrect(24, 9, 2, 2).fill(a === '#4a2a6a' ? '#c070ff' : '#ff6a3a');
        P.mpoly([[18, 3], [22, -2], [26, 3]]).paint(b);
        P.mell(10, 24, 6, 5).mell(34, 24, 6, 5).paint(b); P.mline(34, 28, 40, 40, 4).paint(a); P.mline(40, 40, 40, 18, 3).paint('#c8d0e0'); P.mrect(36, 38, 8, 2).paint('#a08040');
        P.mrect(10, 28, 4, 12).paint(b);
    },
    imp(P, [a, b]) {
        P.mpoly([[14, 20], [0, 8], [6, 22], [2, 30], [14, 28]]).paint(b); P.mpoly([[24, 20], [36, 8], [32, 22], [34, 30], [24, 28]]).paint(b);
        P.mell(19, 28, 8, 9).paint(a); P.mell(20, 14, 8, 7).paint(a); P.mpoly([[13, 10], [10, 2], [17, 8]]).mpoly([[24, 8], [29, 2], [27, 10]]).paint('#f0e0b0');
        eye(P, 17, 12, '#ffe84a', 2); eye(P, 22, 12, '#ffe84a', 2); P.mrect(18, 18, 5, 2).fill('#201020'); P.mp(19, 19).mp(21, 19).fill('#fff');
        P.mrect(14, 34, 4, 6).mrect(22, 34, 4, 6).paint(b); P.mline(26, 36, 32, 38, 1).paint(a);
        P.mline(28, 20, 34, 38, 2).paint('#8a6a3a'); P.mpoly([[31, 16], [34, 20], [37, 16], [34, 22]]).fill('#c8d0e0');
    },
    drake(P, [a, b]) {
        P.mpoly([[24, 24], [12, 2], [30, 16], [44, 2], [40, 24]]).paint(b); P.mell(28, 32, 17, 11).paint(a); P.mline(12, 34, 0, 40, 4).mline(0, 40, 4, 44, 3).paint(a);
        P.mell(46, 22, 8, 7).paint(a); P.mpoly([[50, 20], [60, 24], [60, 28], [50, 28]]).paint(a); P.mpoly([[42, 16], [40, 8], [47, 14]]).paint('#f0e0b0');
        eye(P, 46, 19, '#ffe84a', 2); P.mrect(56, 24, 3, 1).fill('#201020');
        for (const x of [20, 26, 36]) P.mrect(x, 40, 4, 9).paint(b); P.mpoly([[18, 24], [22, 20], [26, 24]]).mpoly([[28, 22], [32, 18], [36, 22]]).fill('#f0e0b0');
        P.mell(30, 38, 12, 4).paint(mix(a, '#ffe0a0', 0.55));
    },
    shade(P, [a, b]) {
        P.mpoly([[18, 2], [30, 14], [32, 40], [28, 50], [24, 42], [20, 52], [14, 42], [8, 50], [4, 40], [6, 14]]).paint(a);
        P.mell(18, 14, 8, 9).fill('#05030c'); eye(P, 14, 12, '#ff4a8a', 3); eye(P, 21, 12, '#ff4a8a', 3);
        P.mline(30, 24, 36, 34, 3).mline(6, 24, 1, 34, 3).paint(b); P.mp(36, 35).mp(1, 35).fill('#c8a0ff');
    },
    gargoyle(P, [a, b]) {
        P.mpoly([[22, 24], [4, 4], [8, 20], [4, 36], [20, 34]]).paint(b); P.mpoly([[30, 24], [48, 4], [44, 20], [48, 36], [32, 34]]).paint(b);
        P.mell(26, 34, 11, 11).paint(a); P.mell(30, 18, 9, 8).paint(a); P.mpoly([[24, 12], [20, 2], [28, 10]]).mpoly([[34, 10], [38, 2], [37, 13]]).paint(b);
        eye(P, 28, 16, '#ff6a3a', 2); eye(P, 33, 16, '#ff6a3a', 2); P.mrect(28, 22, 7, 2).fill('#201020'); P.mp(29, 23).mp(33, 23).fill('#fff');
        P.mrect(20, 42, 6, 8).mrect(30, 42, 6, 8).paint(b);
    },
    fiend(P, [a, b]) {
        P.mpoly([[26, 28], [4, 6], [10, 28], [4, 44], [24, 40]]).paint(b); P.mpoly([[36, 28], [58, 6], [52, 28], [58, 44], [38, 40]]).paint(b);
        P.mell(32, 40, 14, 16).paint(a); P.mell(32, 18, 10, 9).paint(a); P.mpoly([[24, 14], [18, 0], [28, 10]]).mpoly([[38, 10], [46, 0], [40, 16]]).paint('#f0e0b0');
        eye(P, 28, 16, '#ffe84a', 3); eye(P, 35, 16, '#ffe84a', 3); P.mrect(28, 24, 9, 3).fill('#201020'); for (const x of [29, 32, 35]) P.mp(x, 24).fill('#fff');
        P.mrect(22, 52, 7, 10).mrect(35, 52, 7, 10).paint(b); P.mell(32, 40, 6, 6).fill(mix(a, '#ff80c0', 0.5));
        P.mline(18, 34, 10, 52, 5).mline(46, 34, 54, 50, 5).paint(a);
    },
    // ------------------------------------------------ bosses (96 × 96)
    treant(P, [a, b]) {
        P.mrect(34, 34, 30, 54).paint(a); P.mrect(24, 78, 12, 14).mrect(60, 78, 14, 14).paint(b);
        P.mell(48, 22, 42, 22).paint('#4a8a3a'); P.mell(26, 20, 16, 14).mell(72, 18, 16, 14).mell(48, 8, 18, 10).paint('#3a7a2a');
        P.mline(36, 50, 8, 40, 7).mline(8, 40, 4, 62, 5).mline(62, 50, 90, 44, 7).mline(90, 44, 92, 66, 5).paint(a);
        P.mrect(40, 40, 18, 6).fill('#201008'); eye(P, 41, 38, '#ffd84a', 5); eye(P, 54, 38, '#ffd84a', 5); P.mrect(44, 52, 12, 4).fill('#201008');
        for (const [x, y] of [[20, 14], [60, 10], [34, 26], [76, 26]]) P.mell(x, y, 4, 3).fill('#ff7a8a');
        P.mpoly([[34, 62], [48, 70], [64, 62], [60, 80], [38, 80]]).paint(b);
    },
    colossus(P, [a, b]) {
        P.mrect(26, 28, 44, 44).paint(a); P.mrect(34, 8, 28, 24).paint(a); P.mrect(6, 30, 22, 44).mrect(68, 30, 22, 44).paint(b);
        P.mrect(30, 70, 16, 24).mrect(50, 70, 16, 24).paint(b); P.mrect(2, 70, 26, 16).mrect(68, 70, 26, 16).paint(a);
        eye(P, 38, 16, '#ff8a3a', 6); eye(P, 52, 16, '#ff8a3a', 6); P.mrect(40, 26, 16, 3).fill('#201010');
        P.mell(48, 48, 10, 10).fill('#2a1a1a'); P.mell(48, 48, 6, 6).fill('#ff8a3a'); P.mell(48, 48, 3, 3).fill('#ffe0a0');
        P.mpoly([[28, 28], [36, 44], [26, 60]]).fill(mix(a, '#000', 0.4)); P.mpoly([[64, 30], [60, 50], [70, 62]]).fill(mix(a, '#000', 0.4));
    },
    kraken(P, [a, b]) {
        P.mell(48, 34, 34, 28).msub((Q) => Q.mrect(0, 56, 96, 40)).paint(a);
        for (let i = 0; i < 7; i++) { const x = 10 + i * 12; P.mline(x, 50, x + ((i % 2) ? 6 : -6), 70, 5).mline(x + ((i % 2) ? 6 : -6), 70, x + (i - 3) * 4, 90, 4).paint(b); }
        P.mell(40, 24, 10, 6).fill(mix(a, '#fff', 0.35)); eye(P, 34, 34, '#ffe84a', 8); eye(P, 54, 34, '#ffe84a', 8); P.mrect(38, 40, 5, 5).mrect(58, 40, 5, 5).fill('#201020');
        P.mrect(34, 50, 28, 5).fill('#201020'); for (const x of [38, 44, 50, 56]) P.mpoly([[x, 50], [x + 2, 54], [x + 4, 50]]).fill('#fff');
    },
    pharaoh(P, [a, b]) {
        P.mrect(30, 36, 36, 50).paint('#e0d4b0'); for (let y = 38; y < 84; y += 5) P.mrect(30, y, 36, 1).fill('#a8986a');
        P.mell(48, 24, 15, 16).paint('#c8a070'); P.mpoly([[28, 24], [34, 2], [62, 2], [68, 24], [64, 50], [32, 50]]).msub((Q) => Q.mell(48, 28, 10, 14)).paint(b);
        P.mrect(30, 2, 36, 5).paint(a); P.mpoly([[44, 2], [48, -6], [52, 2]]).fill('#ff4a3a');
        eye(P, 42, 24, '#40e0ff', 4); eye(P, 52, 24, '#40e0ff', 4); P.mrect(36, 42, 24, 5).paint(a);
        P.mline(30, 42, 10, 58, 6).mline(66, 42, 86, 40, 6).paint('#e0d4b0'); P.mline(86, 40, 88, 6, 3).paint('#8a6a2a'); P.mell(88, 6, 6, 6).fill('#ffd84a'); P.mell(88, 6, 3, 3).fill('#fff');
        P.mrect(34, 84, 10, 10).mrect(52, 84, 10, 10).paint('#a8986a');
    },
    wyrm(P, [a, b]) {
        P.mpoly([[40, 44], [10, 8], [38, 30], [56, 4], [60, 44]]).paint(b); P.mell(48, 62, 34, 22).paint(a); P.mline(18, 70, 2, 84, 10).mline(2, 84, 12, 92, 6).paint(a);
        P.mell(78, 40, 14, 12).paint(a); P.mpoly([[84, 36], [96, 42], [96, 50], [84, 50]]).paint(a); P.mpoly([[70, 30], [64, 16], [78, 26]]).mpoly([[76, 28], [78, 14], [86, 28]]).paint('#e8f4ff');
        eye(P, 77, 36, '#40e0ff', 4); P.mrect(88, 46, 6, 2).fill('#201020'); for (const x of [88, 91, 94]) P.mp(x, 48).fill('#fff');
        for (const x of [32, 48, 62]) P.mrect(x, 78, 8, 16).paint(b);
        P.mell(50, 68, 22, 8).paint(mix(a, '#ffffff', 0.5));
        for (const [x, y] of [[26, 54], [40, 48], [58, 50]]) P.mpoly([[x, y], [x + 4, y - 8], [x + 8, y]]).fill('#e8f4ff');
    },
    king(P, [a, b]) {
        P.mpoly([[30, 30], [10, 96], [86, 96], [66, 30]]).paint(a); P.mrect(36, 28, 24, 38).paint(mix(a, '#4a3a6a', 0.3));
        P.mell(48, 18, 15, 17).fill('#06040e'); eye(P, 40, 16, b, 5); eye(P, 52, 16, b, 5);
        P.mpoly([[30, 10], [32, -4], [40, 6]]).mpoly([[40, 4], [48, -8], [56, 4]]).mpoly([[56, 6], [64, -4], [66, 10]]).paint(b);
        P.mrect(32, 8, 32, 4).paint(b, { flat: true });
        P.mline(34, 40, 12, 66, 8).mline(62, 40, 84, 62, 8).paint(a); P.mline(84, 62, 90, 20, 3).paint('#c8a0ff'); P.mpoly([[86, 20], [90, 4], [94, 20]]).paint('#e8d0ff');
        P.mell(48, 52, 7, 7).fill('#06040e'); P.mell(48, 52, 4, 4).fill(b);
        for (const x of [14, 28, 44, 60, 76]) P.mpoly([[x, 94], [x + 6, 80], [x + 12, 94]]).fill(mix(a, '#000', 0.4));
    },
};

const SIZES = { slime: [36, 30], bat: [44, 36], wolf: [52, 38], goblin: [38, 46], shroom: [36, 38], sapling: [40, 48], skeleton: [38, 48], golem: [56, 56], crab: [50, 34], jelly: [40, 44], naga: [50, 58], wisp: [32, 48], scorpion: [58, 38], cobra: [42, 50], mummy: [38, 48], harpy: [48, 48], yeti: [56, 58], knight: [46, 58], imp: [40, 42], drake: [62, 52], shade: [36, 54], gargoyle: [54, 54], fiend: [62, 66], treant: [96, 96], colossus: [96, 96], kraken: [96, 96], pharaoh: [96, 98], wyrm: [98, 96], king: [96, 100] };

/** A monster sprite as a Px (facing right); unknown kinds fall back to a slime. */
export function drawMonster(sprite, palName = 'base') {
    const [w, h] = SIZES[sprite] || SIZES.slime;
    const P = new Px(w, h + 2);
    (DRAW[sprite] || DRAW.slime)(P, pal(sprite, palName));
    P.outline();
    return P;
}
export const MONSTER_SPRITES = Object.keys(DRAW);
