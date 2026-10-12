// The seven circles Cael climbs. Each stage is terrain keyframes (see
// terrain.js) plus a script of events keyed by scroll distance — the same
// script every time, so waves can be learned the way R-Type and Gradius are
// learned. At `len` the scroll slows and the boss arrives.
//
// Event shapes:  { at, t: 'wave'|'one'|'say'|'block'|'speed', kind?, n?, o? }
// `o.x` is screen x at spawn time (34 = just off the right edge).

import { NONE_FLOOR as NF, NONE_CEIL as NC } from './terrain.js';

// ---------------------------------------------------------------- flight paths
const PTS = {
    down: [[34, 16.5], [26, 13.5], [18, 8.5], [10, 5], [-3, 4]],
    up: [[34, 1.5], [26, 4.5], [18, 9.5], [10, 13], [-3, 14]],
    dipT: [[34, 15], [23, 12], [15, 10], [22, 7.5], [36, 6]],
    dipB: [[34, 3], [23, 6], [15, 8], [22, 10.5], [36, 12]],
    swoopT: [[30, 19.5], [28, 12], [20, 9], [8, 9], [-3, 10]],
    swoopB: [[30, -1.5], [28, 6], [20, 9], [8, 9], [-3, 8]],
};

function script(build) {
    const ev = [];
    const api = {
        say: (at, who, text, touch) => ev.push({ at, t: 'say', who, text, touch }),
        wave: (at, kind, n, o = {}) => ev.push({ at, t: 'wave', kind, n, o }),
        one: (at, kind, o = {}) => ev.push({ at, t: 'one', kind, o }),
        carrier: (at, item, y = 9) => ev.push({ at, t: 'one', kind: 'carrier', o: { item, y } }),
        block: (at, o) => ev.push({ at, t: 'block', o }),
        turrets: (at, list, o = {}) => list.forEach(([side, x]) => ev.push({ at, t: 'one', kind: 'turret', o: { side, x, ...o } })),
        seraphs: (at, n, path, o = {}) => ev.push({ at, t: 'wave', kind: 'seraphling', n, o: { pts: PTS[path], dur: 4.2, gap: 0.42, ...o } }),
        imps: (at, n, path, o = {}) => ev.push({ at, t: 'wave', kind: 'imp', n, o: { path, ...o } }),
        flies: (at, n, y, o = {}) => ev.push({ at, t: 'wave', kind: 'fly', n, o: { y, gap: 0.16, dphase: 0.35, ...o } }),
        speed: (at, v) => ev.push({ at, t: 'speed', o: { v } }),
    };
    build(api);
    ev.sort((a, b) => a.at - b.at);
    return ev;
}

export const STAGES = [
    // ======================================================================= 1
    {
        id: 'cradle', name: 'The Cradle of Cinders', circle: 'The Ninth Circle',
        sub: 'Where the fallen star struck', boss: 'gorrmaw', len: 380, seed: 11,
        floorKind: 'lava', music: 0,
        checkpoints: [0, 130, 250],
        terrain: [
            [0, 0.7, NC, 0.15], [62, 0.7, NC, 0.15], [76, 3.3, NC, 0.8], [100, 3.0, NC, 0.8],
            [114, 0.7, NC, 0.15], [150, 0.7, NC, 0.15], [168, 2.6, 15.6, 0.9], [200, 3.3, 14.2, 1.0],
            [240, 2.7, 15.0, 1.0], [272, 3.5, 14.0, 1.1], [300, 2.5, 15.5, 0.9], [322, 0.7, NC, 0.15],
            [1200, 0.7, NC, 0.15],
        ],
        script: script(({ say, wave, one, carrier, turrets, imps, flies }) => {
            say(1, 'vesper', 'Little light... they are coming for you. Fly! Arrows or WASD.', 'Little light... they are coming for you. Fly! Drag to move.');
            imps(8, 5, 'sine', { y: 12, amp: 1.6, gap: 0.42 });
            say(13, 'vesper', 'Hold Z or Space, and your feathers will fly.', 'Your feathers fly on their own. Aim with your body.');
            imps(18, 5, 'sine', { y: 6, amp: 1.6, gap: 0.42, phase: 1 });
            imps(27, 5, 'straight', { ys: [8, 10, 8, 10, 9], gap: 0.5 });
            say(33, 'vesper', 'That bearer carries a shard of a halo. Break its cage!');
            carrier(36, 'red', 10);
            say(46, 'vesper', 'Your Halo shields you from small fire. C casts it out. C again calls it home.', 'Your Halo shields you from small fire. HALO casts it out; again calls it home.');
            flies(50, 8, 9, { amp: 2.5 });
            imps(58, 6, 'loop', { y: 14, loopX: 18, drop: 'wing', gap: 0.38 });
            say(66, 'vesper', 'Hold X to gather the light. Let go, and it burns through anything.', 'Hold BEAM to gather the light. Let go, and it burns through anything.');
            one(70, 'skull', { y: 12, stopX: 25 });
            one(72, 'skull', { y: 6, stopX: 27 });
            turrets(78, [['floor', 34], ['floor', 40]]);
            one(85, 'hound', { x: 34 });
            imps(92, 5, 'dive', { y: 15 });
            carrier(98, 'echo', 12);
            flies(106, 10, 5, { amp: 1 });
            imps(114, 5, 'sine', { y: 9, amp: 4, gap: 0.4 });
            say(120, 'vesper', 'The lava stirs. Watch for the bubbling — then move!');
            one(122, 'geyser', { x: 24 });
            one(126, 'geyser', { x: 18 });
            one(130, 'geyser', { x: 28 });
            wave(134, 'imp', 6, { path: 'pts', pts: PTS.swoopT, dur: 3.6, gap: 0.35 });
            one(142, 'eye', { y: 9, stopX: 24 });
            flies(152, 8, 14);
            carrier(158, 'blue', 9);
            say(166, 'vesper', "The Cradle's throat. Mind the rock — it is hungrier than the demons.");
            turrets(171, [['ceil', 34], ['floor', 38]]);
            imps(177, 5, 'sine', { y: 9, amp: 2 });
            one(185, 'hound', { x: 34 }); one(185, 'hound', { x: 37.5 });
            turrets(191, [['ceil', 34]], { rate: 1.5, burst: 2 });
            flies(198, 10, 9, { amp: 3 });
            one(206, 'skull', { y: 10, stopX: 25 });
            imps(212, 6, 'loop', { y: 11, loopX: 18, loopR: 2.6, drop: 'seeker' });
            turrets(222, [['floor', 34], ['ceil', 36]]);
            one(230, 'hound', { x: 34, jump: 11 });
            imps(236, 5, 'dive', { y: 5 });
            carrier(244, 'wing', 9);
            flies(252, 12, 8, { amp: 2 });
            turrets(260, [['floor', 34], ['floor', 40], ['ceil', 37]]);
            one(270, 'skull', { y: 7, stopX: 24 }); one(271, 'skull', { y: 11, stopX: 26 });
            imps(282, 6, 'sine', { y: 12, amp: 1.5, shoot: 0.4 });
            one(292, 'hound', { x: 34 }); one(292, 'hound', { x: 38 }); one(292, 'hound', { x: 42 });
            imps(300, 5, 'straight', { y: 9, gap: 0.45 });
            say(322, 'vesper', 'Something stirs beneath the fire... Be ready, little one.');
            one(326, 'geyser', { x: 22 }); one(326, 'geyser', { x: 28 });
            imps(334, 6, 'loop', { y: 6, loopDir: -1, loopX: 18, drop: 'echo' });
            flies(344, 12, 12);
            carrier(352, 'red', 9);
            imps(360, 5, 'sine', { y: 9, amp: 3 });
        }),
    },

    // ======================================================================= 2
    {
        id: 'orchard', name: 'The Bone Orchard', circle: 'The Eighth Circle',
        sub: 'Where the first fallen were buried', boss: 'wyrm', len: 400, seed: 22,
        floorKind: 'bone', music: 1,
        checkpoints: [0, 140, 270],
        terrain: [
            [0, NF, NC, 0], [20, 2.0, NC, 0.6], [40, 2.6, 15.5, 1.0], [80, 3.0, 14.5, 1.3],
            [120, 4.0, 13.2, 1.2], [150, 2.5, 15.5, 1.2], [180, 3.2, 14.8, 1.3], [220, 5.0, 16.0, 1.0],
            [250, 2.0, 12.4, 1.0], [280, 3.0, 15.0, 1.2], [330, 2.2, 15.6, 1.0], [370, 2.0, 16.0, 0.8],
            [392, NF, NC, 0], [1200, NF, NC, 0],
        ],
        script: script(({ say, wave, one, carrier, block, turrets, imps, flies }) => {
            say(3, 'malphas', 'A spark of the Light, loose in my house... Bring it to me. Unbroken.');
            imps(10, 5, 'sine', { y: 11 });
            imps(18, 5, 'sine', { y: 7, phase: 1.5 });
            carrier(26, 'wing', 9);
            one(32, 'worm', { side: 'floor', x: 28 });
            turrets(41, [['ceil', 34], ['floor', 36]]);
            flies(48, 8, 9);
            say(54, 'vesper', 'Behind you! The dead do not keep to the front.');
            one(56, 'wraith', { y: 6 }); one(57, 'wraith', { y: 12 });
            one(64, 'worm', { side: 'ceil', x: 26 });
            imps(72, 6, 'loop', { y: 9, loopX: 18, drop: 'blue' });
            block(82, { x: 34, y0: 0, y1: 8.5, w: 1.4, kind: 'bone' });
            turrets(86, [['ceil', 34]]);
            block(92, { x: 34, y0: 9.5, y1: 18, w: 1.4, kind: 'bone' });
            imps(98, 5, 'dive', { y: 12 });
            one(106, 'mine', { y: 6 }); one(107, 'mine', { y: 12 });
            one(114, 'worm', { side: 'floor', x: 30, len: 10 });
            one(122, 'hound', { x: 34 }); one(122, 'hound', { x: 37 });
            one(130, 'skull', { y: 9, stopX: 25 });
            carrier(138, 'echo', 9);
            one(146, 'wraith', { y: 9 }); one(147, 'wraith', { y: 4 });
            flies(154, 12, 9, { amp: 3 });
            say(160, 'vesper', 'A gate of bone. Break it — the beam will serve you best.');
            block(162, { x: 34, y0: 0, y1: 10.5, w: 1.6, hp: 40, kind: 'bonegate' });
            block(170, { x: 34, y0: 7.5, y1: 18, w: 1.6, hp: 40, kind: 'bonegate' });
            turrets(178, [['floor', 34], ['ceil', 38]], { burst: 2 });
            one(186, 'worm', { side: 'ceil', x: 24 }); one(188, 'worm', { side: 'floor', x: 30 });
            one(196, 'eye', { y: 9, stopX: 25 });
            imps(208, 6, 'sine', { y: 13 });
            one(214, 'mine', { hang: true, x: 34, len: 4 }); one(214, 'mine', { hang: true, x: 40, len: 6 });
            flies(224, 10, 10);
            wave(232, 'wraith', 3, { ys: [6, 11, 14], gap: 0.6 });
            carrier(240, 'seeker', 9);
            one(251, 'hound', { x: 34 }); one(251, 'hound', { x: 38 });
            turrets(258, [['floor', 34], ['floor', 38], ['ceil', 36]]);
            one(266, 'worm', { side: 'floor', x: 28, len: 10 });
            imps(276, 6, 'loop', { y: 9, loopX: 18, drop: 'wing' });
            block(286, { x: 34, y0: 0, y1: 7.5, w: 1.4, kind: 'bone' });
            block(286, { x: 40, y0: 11, y1: 18, w: 1.4, kind: 'bone' });
            block(286, { x: 46, y0: 0, y1: 7.5, w: 1.4, kind: 'bone' });
            one(298, 'skull', { y: 7, stopX: 24 }); one(298, 'skull', { y: 11, stopX: 26 });
            flies(306, 12, 9);
            one(314, 'worm', { side: 'ceil', x: 26 }); one(316, 'worm', { side: 'floor', x: 30 });
            wave(324, 'wraith', 2, { ys: [5, 13], gap: 0.5 });
            carrier(332, 'aegis', 9);
            imps(340, 5, 'dive', { y: 5 }); imps(341, 5, 'dive', { y: 13 });
            one(350, 'eye', { y: 9, stopX: 25 });
            imps(364, 6, 'sine', { y: 9, amp: 3 });
            say(374, 'vesper', 'These bones were angels once. Like you. Like... me.');
        }),
    },

    // ======================================================================= 3
    {
        id: 'foundry', name: 'The Weeping Foundry', circle: 'The Seventh Circle',
        sub: 'Where halos are hammered into chains', boss: 'penitent', len: 420, seed: 33,
        floorKind: 'iron', music: 2,
        checkpoints: [0, 140, 280],
        terrain: [
            [0, 1.4, 16.6, 0.3], [40, 1.4, 16.6, 0.3], [56, 3.0, 15.0, 0.3], [100, 3.0, 15.0, 0.3],
            [110, 2.0, 13.2, 0.3], [152, 2.0, 13.2, 0.3], [162, 4.0, 16.0, 0.3], [200, 4.0, 16.0, 0.3],
            [210, 2.2, 15.0, 0.3], [260, 2.6, 14.0, 0.3], [300, 2.6, 14.6, 0.3], [330, 1.4, 16.6, 0.3],
            [1200, 1.4, 16.6, 0.3],
        ],
        script: script(({ say, wave, one, carrier, block, turrets, imps, flies }) => {
            say(3, 'vesper', 'The Foundry. Here they hammer the halos of the fallen into chains.');
            imps(10, 5, 'sine', { y: 11 });
            turrets(16, [['floor', 34], ['ceil', 36]]);
            flies(24, 10, 7);
            carrier(30, 'gold', 9);
            say(35, 'vesper', 'Those presses keep time. Learn the beat, then slip beneath.');
            one(38, 'crusher', { x: 34 });
            one(44, 'crusher', { x: 34, phase: 1.5 });
            one(52, 'wheel', { side: 'floor', x: 34 });
            one(60, 'lancer', { y: 12, stopX: 27 }); one(60, 'lancer', { y: 6, stopX: 28.5 });
            one(70, 'mine', { hang: true, x: 34, len: 4 }); one(70, 'mine', { hang: true, x: 38, len: 6 });
            imps(78, 6, 'loop', { y: 9, loopX: 18, drop: 'wing' });
            one(88, 'bull', { track: true });
            turrets(96, [['floor', 34], ['ceil', 37]], { burst: 3 });
            one(104, 'wheel', { side: 'ceil', x: 34 });
            one(112, 'crusher', { x: 34 }); one(112, 'crusher', { x: 40, phase: 1.0 }); one(112, 'crusher', { x: 46, phase: 2.0 });
            flies(126, 12, 8);
            carrier(132, 'echo', 8);
            one(140, 'lancer', { y: 9, stopX: 26 }); one(140, 'lancer', { y: 4.5, stopX: 28 }); one(140, 'lancer', { y: 12, stopX: 30 });
            say(150, 'vesper', 'Behind!');
            one(152, 'bull', { from: 'left' });
            one(160, 'wheel', { side: 'floor', x: 34 }); one(160, 'wheel', { side: 'floor', x: 39 });
            imps(168, 5, 'dive', { y: 13 });
            one(176, 'eye', { y: 10, stopX: 25 });
            turrets(188, [['ceil', 34], ['ceil', 38], ['floor', 36]]);
            flies(196, 10, 12);
            block(204, { x: 34, y0: 0, y1: 9, w: 2, kind: 'pipe' });
            block(204, { x: 42, y0: 11, y1: 18, w: 2, kind: 'pipe' });
            turrets(214, [['floor', 50], ['ceil', 54]]);
            carrier(220, 'seeker', 9);
            wave(228, 'bull', 2, { ys: [5, 13], gap: 0.9 });
            one(238, 'mine', { hang: true, x: 34, len: 3.5 }); one(238, 'mine', { hang: true, x: 38, len: 6 }); one(238, 'mine', { hang: true, x: 42, len: 4.5 });
            imps(248, 6, 'sine', { y: 9, amp: 3 });
            one(258, 'lancer', { y: 7, stopX: 27 }); one(258, 'lancer', { y: 11, stopX: 29 });
            one(268, 'wheel', { side: 'ceil', x: 34 }); one(268, 'wheel', { side: 'floor', x: 37 });
            turrets(276, [['floor', 34], ['floor', 38], ['ceil', 36], ['ceil', 40]]);
            carrier(286, 'aegis', 9);
            one(294, 'crusher', { x: 34 }); one(294, 'crusher', { x: 39, phase: 1 }); one(294, 'crusher', { x: 44, phase: 2 });
            flies(306, 12, 6); flies(307, 12, 12);
            one(318, 'eye', { y: 9, stopX: 25 });
            wave(330, 'bull', 3, { ys: [4, 9, 14], gap: 1.2 });
            imps(342, 6, 'loop', { y: 10, loopX: 18, drop: 'red' });
            one(354, 'lancer', { y: 6, stopX: 28 }); one(354, 'lancer', { y: 12, stopX: 27 });
            imps(366, 5, 'dive', { y: 9 });
            say(380, 'vesper', 'Chains rattle in the deep... The Penitent wakes.');
        }),
    },

    // ======================================================================= 4
    {
        id: 'styx', name: 'The Drowned Choir', circle: 'The Sixth Circle',
        sub: 'Where the singers sank', boss: 'ferryman', len: 420, seed: 44,
        floorKind: 'water', music: 3,
        checkpoints: [0, 140, 280],
        terrain: [
            [0, 1.2, NC, 0.12], [104, 1.2, NC, 0.12], [118, 1.2, 14.6, 0.8], [180, 1.2, 13.6, 0.9],
            [210, 1.2, NC, 0.12], [278, 1.2, NC, 0.12], [290, 1.2, 15.0, 0.7], [316, 1.2, 15.0, 0.7], [330, 1.2, NC, 0.12],
            [1200, 1.2, NC, 0.12],
        ],
        script: script(({ say, wave, one, carrier, block, turrets, imps, flies, seraphs }) => {
            say(3, 'vesper', 'The Styx. Every soul that sang too loud for Heaven drowned here.');
            imps(10, 5, 'sine', { y: 12 });
            one(16, 'lantern', { y: 8 });
            say(22, 'vesper', 'Stay above the water. The drowned are reaching.');
            one(24, 'hand', { lead: 1.5 });
            flies(30, 10, 10);
            carrier(38, 'blue', 10);
            one(46, 'wraith', { y: 6 }); one(47, 'wraith', { y: 13 });
            wave(54, 'hand', 2, { lead: 2, gap: 0.8 });
            say(60, 'vesper', 'The choir... they were seraphs. The Pit has made them sing for it.');
            seraphs(62, 2, 'down');
            seraphs(66, 2, 'up');
            one(74, 'lantern', { y: 6 }); one(75, 'lantern', { y: 12 });
            imps(84, 6, 'loop', { y: 10, loopX: 18, drop: 'wing' });
            block(94, { x: 34, y0: 0, y1: 7, w: 1.6, kind: 'column' });
            block(94, { x: 44, y0: 0, y1: 9, w: 1.6, kind: 'column' });
            one(102, 'skull', { y: 13, stopX: 25 }); one(103, 'skull', { y: 8, stopX: 27 });
            carrier(112, 'echo', 10);
            turrets(120, [['ceil', 34], ['ceil', 38]]);
            flies(126, 12, 8);
            wave(134, 'hand', 3, { lead: 1, gap: 0.7 });
            one(142, 'eye', { y: 8, stopX: 24 });
            seraphs(154, 2, 'dipT'); seraphs(156, 2, 'dipB');
            wave(166, 'lantern', 3, { ys: [5, 9, 13], gap: 0.7 });
            wave(176, 'wraith', 3, { ys: [4, 9, 14], gap: 0.6 });
            imps(186, 6, 'sine', { y: 9, amp: 3 });
            carrier(196, 'seeker', 10);
            wave(204, 'hand', 2, { lead: 3, gap: 0.6 });
            block(212, { x: 34, y0: 0, y1: 8, w: 1.6, kind: 'column' });
            block(212, { x: 41, y0: 0, y1: 5.5, w: 1.6, kind: 'column' });
            block(212, { x: 48, y0: 0, y1: 8, w: 1.6, kind: 'column' });
            flies(224, 10, 12); flies(225, 10, 6);
            seraphs(234, 2, 'down'); seraphs(237, 2, 'up');
            one(246, 'lantern', { y: 9 }); one(247, 'skull', { y: 13, stopX: 25 });
            carrier(256, 'aegis', 10);
            wave(264, 'wraith', 4, { ys: [4, 8, 11, 15], gap: 0.5 });
            one(276, 'eye', { y: 10, stopX: 25 });
            turrets(268, [['ceil', 34], ['ceil', 38], ['ceil', 42]]);
            wave(300, 'hand', 3, { lead: 2, gap: 0.6 });
            imps(310, 6, 'loop', { y: 10, loopX: 18, drop: 'gold' });
            seraphs(322, 2, 'dipT'); seraphs(324, 2, 'dipB');
            wave(336, 'lantern', 3, { ys: [6, 10, 14], gap: 0.6 });
            flies(348, 12, 9, { amp: 3 });
            one(360, 'wraith', { y: 5 }); one(360, 'wraith', { y: 13 }); one(362, 'skull', { y: 9, stopX: 25 }); one(363, 'skull', { y: 13, stopX: 27 });
            wave(372, 'hand', 4, { lead: 1, gap: 0.5 });
            say(386, 'ferryman', 'Fare, little light? No coin... Then you will pay in feathers.');
        }),
    },

    // ======================================================================= 5
    {
        id: 'flesh', name: 'The Flesh Labyrinth', circle: 'The Fifth Circle',
        sub: 'Where the Pit itself is alive', boss: 'brood', len: 440, seed: 55,
        floorKind: 'flesh', music: 4,
        checkpoints: [0, 150, 300],
        terrain: [
            [0, 2.0, 16.0, 1.0], [30, 3.0, 15.0, 1.3], [60, 5.0, 16.5, 1.4], [90, 2.0, 12.4, 1.4],
            [120, 4.0, 14.0, 1.5], [150, 6.0, 17.0, 1.2], [176, 1.6, 11.6, 1.2], [200, 3.0, 15.0, 1.5],
            [240, 2.0, 13.0, 1.4], [270, 5.0, 16.0, 1.4], [300, 3.0, 14.0, 1.5], [340, 2.5, 15.5, 1.4],
            [380, 3.0, 15.0, 1.2], [420, 1.0, 17.0, 0.8], [444, 0.5, 17.5, 0.5], [1200, 0.5, 17.5, 0.5],
        ],
        script: script(({ say, wave, one, carrier, block, imps, flies }) => {
            say(3, 'vesper', 'This is no cave. The Pit is alive, Cael — and it is trying to swallow you.');
            flies(10, 10, 9, { amp: 3 });
            one(18, 'pod', { side: 'floor', x: 34 }); one(18, 'pod', { side: 'ceil', x: 38 });
            one(26, 'tentacle', { side: 'floor', x: 34 });
            carrier(33, 'red', 9);
            say(38, 'vesper', 'A wall of flesh. Burn through!');
            block(40, { x: 34, y0: 0, y1: 18, w: 1.8, hp: 30, kind: 'membrane' });
            imps(48, 5, 'sine', { y: 11 });
            one(56, 'tentacle', { side: 'ceil', x: 34 }); one(56, 'tentacle', { side: 'floor', x: 40 });
            one(64, 'worm', { side: 'floor', x: 30, len: 9 });
            one(72, 'eye', { y: 11, stopX: 25 });
            one(84, 'pod', { side: 'floor', x: 34 }); one(84, 'pod', { side: 'floor', x: 40 });
            imps(92, 6, 'loop', { y: 8, loopX: 18, loopR: 2.4, drop: 'wing' });
            block(100, { x: 34, y0: 0, y1: 8, w: 1.6, hp: 25, kind: 'membrane' });
            block(100, { x: 38, y0: 7, y1: 18, w: 1.6, hp: 25, kind: 'membrane' });
            one(110, 'tentacle', { side: 'ceil', x: 34 }); one(110, 'tentacle', { side: 'ceil', x: 39 });
            carrier(118, 'echo', 9);
            wave(126, 'fly', 10, { home: true, x: 34, ys: [5, 13], vx: -6, gap: 0.25 });
            one(134, 'worm', { side: 'ceil', x: 28 });
            block(142, { x: 34, y0: 0, y1: 18, w: 1.8, hp: 35, kind: 'membrane' });
            one(152, 'pod', { side: 'floor', x: 34 }); one(152, 'tentacle', { side: 'ceil', x: 38 });
            one(160, 'eye', { y: 11.5, stopX: 25 });
            imps(172, 5, 'dive', { y: 9 });
            one(180, 'tentacle', { side: 'floor', x: 34 }); one(180, 'tentacle', { side: 'floor', x: 39 }); one(181, 'pod', { side: 'ceil', x: 36 });
            carrier(188, 'seeker', 8);
            block(196, { x: 34, y0: 0, y1: 9.5, w: 1.6, hp: 25, kind: 'membrane' });
            block(196, { x: 41, y0: 8.5, y1: 18, w: 1.6, hp: 25, kind: 'membrane' });
            one(204, 'worm', { side: 'floor', x: 26 }); one(206, 'worm', { side: 'floor', x: 31 });
            flies(214, 10, 8); one(215, 'pod', { side: 'ceil', x: 36 });
            one(224, 'eye', { y: 6, stopX: 24 }); one(225, 'eye', { y: 11.5, stopX: 27 });
            one(238, 'tentacle', { side: 'floor', x: 34 }); one(238, 'tentacle', { side: 'ceil', x: 37 }); one(238, 'tentacle', { side: 'floor', x: 40 });
            carrier(248, 'aegis', 8);
            block(256, { x: 34, y0: 0, y1: 18, w: 1.8, hp: 40, kind: 'membrane' });
            imps(264, 6, 'sine', { y: 10 });
            one(274, 'worm', { side: 'ceil', x: 28 }); one(276, 'worm', { side: 'floor', x: 30 });
            one(284, 'pod', { side: 'floor', x: 34 }); one(284, 'pod', { side: 'ceil', x: 37 }); one(284, 'pod', { side: 'floor', x: 41 });
            carrier(296, 'wing', 9);
            one(304, 'eye', { y: 9, stopX: 25 }); flies(306, 10, 13);
            for (const [s, x] of [['floor', 34], ['ceil', 36], ['floor', 39], ['ceil', 42]]) one(316, 'tentacle', { side: s, x });
            block(330, { x: 34, y0: 0, y1: 9, w: 1.6, hp: 30, kind: 'membrane' });
            block(330, { x: 39, y0: 9, y1: 18, w: 1.6, hp: 30, kind: 'membrane' });
            imps(340, 6, 'loop', { y: 9, loopX: 18, loopR: 2.5, drop: 'blue' });
            one(352, 'worm', { side: 'floor', x: 26 }); one(352, 'worm', { side: 'ceil', x: 31 });
            one(362, 'pod', { side: 'floor', x: 34 }); one(362, 'pod', { side: 'ceil', x: 38 });
            one(364, 'tentacle', { side: 'floor', x: 40 }); one(364, 'tentacle', { side: 'ceil', x: 42 });
            one(376, 'eye', { y: 6, stopX: 25 }); one(377, 'eye', { y: 12, stopX: 27 });
            flies(392, 16, 9, { amp: 4 });
            say(404, 'vesper', 'Its heart is near. I can hear it beating... for you.');
        }),
    },

    // ======================================================================= 6
    {
        id: 'cocytus', name: 'The Frozen Betrayal', circle: 'The Fourth Circle',
        sub: 'Where the traitors freeze', boss: 'sammael', len: 440, seed: 66,
        floorKind: 'ice', music: 5,
        checkpoints: [0, 150, 300],
        terrain: [
            [0, NF, NC, 0], [20, 2.0, NC, 1.0], [50, 2.5, 15.0, 1.1], [100, 3.5, 14.0, 1.2],
            [140, 2.0, 15.5, 1.0], [168, NF, 16.0, 0.8], [206, NF, 16.2, 0.8], [216, 2.5, NC, 1.0],
            [250, 3.0, 14.5, 1.2], [290, 2.0, 13.2, 1.0], [320, 4.0, 15.5, 1.2], [360, 2.5, 15.0, 1.0],
            [400, 2.0, 16.0, 1.0], [432, NF, NC, 0], [1200, NF, NC, 0],
        ],
        script: script(({ say, wave, one, carrier, block, turrets, imps, flies, seraphs }) => {
            say(3, 'vesper', 'Cocytus. Where the traitors freeze. Do not look into the ice, Cael.');
            imps(10, 5, 'sine', { y: 12 });
            say(16, 'vesper', 'Those crystals shatter when they break. Break them far from you.');
            one(18, 'crystal', { y: 9 }); one(19, 'crystal', { y: 13 });
            carrier(26, 'gold', 9);
            seraphs(34, 2, 'down');
            turrets(44, [['floor', 34], ['ceil', 37]]);
            wave(52, 'crystal', 3, { ys: [5, 9, 13], gap: 0.7 });
            one(60, 'lancer', { y: 12, stopX: 27 }); one(60, 'lancer', { y: 6, stopX: 29 });
            imps(70, 6, 'loop', { y: 9, loopX: 18, drop: 'wing' });
            block(80, { x: 34, y0: 0, y1: 18, w: 1.8, hp: 35, kind: 'ice' });
            seraphs(88, 2, 'dipT'); seraphs(90, 2, 'dipB');
            wave(100, 'mine', 3, { ys: [6, 9, 12], gap: 0.5 });
            carrier(108, 'echo', 9);
            one(116, 'gargoyle', { side: 'floor', x: 34 }); one(116, 'gargoyle', { side: 'ceil', x: 40 });
            flies(126, 12, 9, { amp: 3 });
            one(134, 'bull', { track: true });
            one(144, 'eye', { y: 9, stopX: 25 });
            wave(156, 'crystal', 4, { ys: [4, 8, 11, 14], gap: 0.5 });
            carrier(166, 'seeker', 10);
            say(170, 'vesper', 'No ground beneath you now. Only the long fall.');
            seraphs(174, 2, 'down'); seraphs(176, 2, 'up');
            one(178, 'lancer', { y: 9, stopX: 28 }); one(180, 'lancer', { y: 4, stopX: 27 });
            imps(186, 5, 'dive', { y: 13 }); imps(188, 5, 'dive', { y: 5 });
            wave(198, 'bull', 2, { ys: [6, 12], gap: 1.0 });
            one(218, 'gargoyle', { side: 'floor', x: 34 }); one(218, 'gargoyle', { side: 'floor', x: 39 });
            block(226, { x: 34, y0: 0, y1: 10, w: 1.6, hp: 30, kind: 'ice' });
            block(226, { x: 40, y0: 8, y1: 18, w: 1.6, hp: 30, kind: 'ice' });
            wave(236, 'crystal', 4, { ys: [5, 13, 7, 11], gap: 0.5 });
            carrier(244, 'aegis', 9);
            one(252, 'lancer', { y: 5, stopX: 26 }); one(252, 'lancer', { y: 9, stopX: 28 }); one(252, 'lancer', { y: 13, stopX: 30 });
            seraphs(264, 3, 'dipT'); seraphs(266, 3, 'dipB');
            turrets(276, [['floor', 34], ['ceil', 36], ['floor', 38], ['ceil', 40]]);
            imps(286, 6, 'loop', { y: 9, loopX: 18, drop: 'red' });
            block(296, { x: 34, y0: 0, y1: 18, w: 1.8, hp: 40, kind: 'ice' });
            one(306, 'eye', { y: 6, stopX: 24 }); one(307, 'eye', { y: 12, stopX: 27 });
            for (const [s, x] of [['floor', 34], ['ceil', 38], ['floor', 42]]) one(322, 'gargoyle', { side: s, x });
            wave(334, 'crystal', 5, { ys: [3, 6, 9, 12, 15], gap: 0.4 });
            wave(346, 'bull', 3, { ys: [4, 9, 14], gap: 1.1 });
            seraphs(360, 3, 'down'); seraphs(363, 3, 'up');
            carrier(376, 'life', 9);
            one(386, 'lancer', { y: 7, stopX: 27 }); one(386, 'lancer', { y: 11, stopX: 29 }); wave(388, 'mine', 3, { ys: [5, 9, 13], gap: 0.5 });
            say(402, 'sammael', "So the Star's child crawls up from the dark. She burned for you, did you know? I watched.");
        }),
    },

    // ======================================================================= 7
    {
        id: 'dawn', name: 'The Gate of Dawn', circle: 'The Rim of the Pit',
        sub: 'Where the dark ends', boss: 'malphas', len: 460, seed: 77,
        floorKind: 'stone', music: 6, bossScroll: 0.8,
        checkpoints: [0, 150, 300],
        terrain: [
            [0, 2.0, NC, 0.8], [40, 3.0, 15.0, 1.0], [90, 2.5, 14.0, 1.1], [126, NF, NC, 0],
            [168, 3.0, 15.5, 1.0], [220, 2.5, 13.6, 1.2], [260, 4.0, 16.0, 1.0], [300, 2.0, 15.0, 1.0],
            [336, NF, NC, 0], [376, 2.0, 16.0, 0.8], [404, 2.0, 16.0, 0.8], [424, NF, NC, 0], [1200, NF, NC, 0],
        ],
        script: script(({ say, wave, one, carrier, turrets, imps, flies, seraphs }) => {
            say(3, 'vesper', 'Look up, Cael. Do you see it? That is dawn. That is home.');
            imps(10, 6, 'sine', { y: 12 });
            one(18, 'gargoyle', { side: 'floor', x: 34 }); one(18, 'gargoyle', { side: 'floor', x: 39 });
            carrier(26, 'wing', 9);
            seraphs(34, 2, 'down'); seraphs(36, 2, 'up');
            turrets(46, [['floor', 34], ['ceil', 37], ['floor', 40]]);
            one(54, 'eye', { y: 9, stopX: 25 });
            flies(66, 14, 9, { amp: 3 });
            carrier(74, 'echo', 9);
            wave(82, 'bull', 2, { ys: [6, 12], gap: 0.9 });
            one(92, 'worm', { side: 'floor', x: 28 }); one(94, 'worm', { side: 'ceil', x: 30 });
            one(104, 'lancer', { y: 5, stopX: 26 }); one(104, 'lancer', { y: 9, stopX: 28 }); one(104, 'lancer', { y: 13, stopX: 30 });
            carrier(116, 'seeker', 9);
            imps(124, 6, 'loop', { y: 9, loopX: 18, drop: 'red' });
            seraphs(134, 3, 'dipT'); seraphs(136, 3, 'dipB');
            wave(146, 'wraith', 3, { ys: [5, 9, 13], gap: 0.5 });
            carrier(156, 'aegis', 9);
            one(164, 'eye', { y: 6, stopX: 24 }); one(165, 'eye', { y: 12, stopX: 27 });
            for (const [s, x] of [['floor', 34], ['ceil', 37], ['floor', 40]]) one(176, 'gargoyle', { side: s, x });
            imps(188, 6, 'dive', { y: 5 }); imps(189, 6, 'dive', { y: 13 });
            wave(200, 'crystal', 4, { ys: [5, 13, 7, 11], gap: 0.5 });
            carrier(212, 'blue', 9);
            one(222, 'lancer', { y: 6, stopX: 27 }); one(222, 'lancer', { y: 12, stopX: 29 }); wave(226, 'bull', 2, { ys: [4, 14], gap: 0.8 });
            one(236, 'mine', { hang: true, x: 34, len: 4 }); one(236, 'mine', { hang: true, x: 38, len: 6 }); one(236, 'mine', { hang: true, x: 42, len: 3.5 });
            one(248, 'pod', { side: 'floor', x: 34 }); one(248, 'tentacle', { side: 'ceil', x: 37 }); one(248, 'pod', { side: 'ceil', x: 41 });
            seraphs(262, 3, 'down'); seraphs(265, 3, 'up');
            carrier(276, 'gold', 9);
            one(284, 'eye', { y: 6, stopX: 25 }); one(285, 'eye', { y: 12, stopX: 27 });
            turrets(266, [['floor', 34], ['ceil', 36], ['floor', 38], ['ceil', 40]]);
            flies(310, 16, 9, { amp: 4 });
            one(322, 'worm', { side: 'floor', x: 26 }); one(323, 'worm', { side: 'ceil', x: 30 });
            carrier(334, 'life', 9);
            seraphs(340, 3, 'dipT'); seraphs(342, 3, 'dipB'); imps(344, 6, 'sine', { y: 9, amp: 4 });
            wave(356, 'bull', 3, { ys: [4, 9, 14], gap: 1.0 });
            for (const [s, x] of [['floor', 34], ['ceil', 36], ['floor', 39], ['ceil', 42]]) one(366, 'gargoyle', { side: s, x });
            one(388, 'eye', { y: 5, stopX: 24 }); one(389, 'eye', { y: 13, stopX: 26 }); one(390, 'eye', { y: 9, stopX: 28 });
            imps(404, 8, 'loop', { y: 9, loopX: 17, drop: 'wing' });
            carrier(414, 'aegis', 9);
            say(422, 'malphas', 'Enough. You will not leave my house, little spark. You ARE its light.');
        }),
    },
];
