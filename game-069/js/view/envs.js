/**
 * envs.js — how each environment looks: sky, sun, fog, the colours of the ground and the road, what
 * stands at the trackside, what drifts through the air, and the shape of the land beyond the track.
 *
 * props: [type, count, near, far, mode]: how many, and how far beyond the barrier (m).
 * land(x, z, dc) is the natural height of the ground at (x, z), where dc is the distance from the
 * middle of the track's bounding box. The terrain builder bends it to meet the track.
 */

import { fbm } from '../rng.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const ENV_LOOK = {
    flats: {
        time: 'Noon', skyTop: 0x1f6fd0, skyHor: 0xcfe0ea, sunCol: 0xfff0d2, sunI: 2.7, sunEl: 0.95, sunAz: 0.6,
        hemiSky: 0xdcefff, hemiGround: 0x9a7a4a, hemiI: 1.05, fog: 0xd8dccc, fogNear: 160, fogFar: 760, exposure: 1.0,
        clouds: 14, cloudCol: 0xffffff,
        ground: [0xa6ab55, 0xc8b26a, 0x8e9a46, 0xb08a54], shoulder: 0xa98a5a, rock: 0x9a8670,
        road: 0xa9784a, rut: 0x7a5232, edge: 0xc4a274, dust: 0xc9a476,
        barrier: ['hay', 'tires'], motes: 'dust', mountains: 0xb58c62,
        land: (x, z, dc) => fbm(x / 210, z / 210, 11) * 5 + ss(380, 900, dc) * (28 + fbm(x / 120, z / 120, 3) * 26),
        props: [
            ['oak', 46, 19, 249], ['wheat', 60, 11, 169, 'cluster'], ['hay', 26, 5, 79], ['fence', 30, 3, 49],
            ['barn', 3, 29, 149], ['silo', 4, 31, 159], ['windmill', 3, 23, 139], ['cow', 18, 19, 189, 'cluster'],
            ['watertower', 1, 49, 189], ['bush', 50, 3, 209], ['pickup', 5, 7, 59],
        ],
        crowd: 1,
    },
    woods: {
        time: 'Misty morning', skyTop: 0x6f9cc4, skyHor: 0xd9e3dc, sunCol: 0xffdcae, sunI: 2.1, sunEl: 0.42, sunAz: -0.9,
        hemiSky: 0xcfe2e6, hemiGround: 0x3d4a2a, hemiI: 1.0, fog: 0xc6d4cc, fogNear: 30, fogFar: 330, exposure: 1.05,
        clouds: 8, cloudCol: 0xf4f6f2,
        ground: [0x4d6a33, 0x3f5a2b, 0x5d7638, 0x6b5a3a], shoulder: 0x5a4a34, rock: 0x7c8078,
        road: 0x6e5238, rut: 0x4b3624, edge: 0x7a6040, dust: 0x7a6248,
        barrier: ['logs', 'fence'], motes: 'pollen', mountains: 0x5a6e66,
        land: (x, z, dc) => fbm(x / 140, z / 140, 21) * 9 + ss(300, 800, dc) * (40 + fbm(x / 100, z / 100, 5) * 30),
        props: [
            ['pine', 260, 2, 289], ['birch', 50, 2, 209], ['fern', 120, 2, 109], ['boulder', 40, 2, 189],
            ['cabin', 3, 23, 129], ['logpile', 8, 5, 69], ['mushroom', 30, 2, 49, 'cluster'], ['stump', 30, 2, 109],
        ],
        crowd: 0.6,
    },
    canyon: {
        time: 'Sunset', skyTop: 0x34488f, skyHor: 0xff9658, sunCol: 0xffa25e, sunI: 2.6, sunEl: 0.2, sunAz: 2.4,
        hemiSky: 0xffc9a0, hemiGround: 0x8a3f22, hemiI: 0.95, fog: 0xe89a72, fogNear: 200, fogFar: 820, exposure: 1.05,
        clouds: 10, cloudCol: 0xffc6a0,
        ground: [0xc8693a, 0xd88a4e, 0xb45a32, 0xe0a26a], shoulder: 0xd0844e, rock: 0xa64a2a,
        road: 0xb4552e, rut: 0x84391e, edge: 0xd4805a, dust: 0xd4865a,
        barrier: ['rocks', 'tires'], motes: 'dust', mountains: 0xa84a2c,
        land: (x, z, dc) => {
            const n = fbm(x / 160, z / 160, 31);
            const mesa = ss(0.1, 0.25, fbm(x / 260, z / 260, 33)) * ss(160, 320, dc) * 45;
            return n * 4 + Math.round(mesa / 9) * 9 + ss(450, 900, dc) * (60 + n * 30);
        },
        props: [
            ['cactus', 70, 3, 229], ['rock', 60, 3, 249], ['hoodoo', 16, 29, 249], ['deadtree', 14, 5, 149],
            ['tumbleweed', 20, 3, 109], ['arch', 1, 59, 189], ['skull', 4, 3, 29], ['bush', 30, 3, 189],
        ],
        crowd: 0.8,
    },
    bayou: {
        time: 'Dusk', skyTop: 0x1a2546, skyHor: 0xd98a62, sunCol: 0xff9a64, sunI: 1.1, sunEl: 0.08, sunAz: -2.2,
        hemiSky: 0x7a8cb4, hemiGround: 0x2a3020, hemiI: 1.15, fog: 0x4c5a58, fogNear: 30, fogFar: 300, exposure: 1.25,
        clouds: 6, cloudCol: 0xd89a8a, night: 0.55,
        ground: [0x4a5a2a, 0x3c4a24, 0x5a6232, 0x463a24], shoulder: 0x4a3c26, rock: 0x5a5a4a,
        road: 0x5e4a30, rut: 0x3e301e, edge: 0x6a5634, dust: 0x5a4a32,
        barrier: ['posts', 'tires'], motes: 'fireflies', mountains: 0x2a3a34,
        water: { level: -1.4, col: 0x2a3a2a, deep: 0x0e1a14 },
        land: (x, z, dc) => fbm(x / 90, z / 90, 41) * 3.4 - 1.6 + ss(400, 900, dc) * 12,
        props: [
            ['cypress', 90, 3, 249], ['deadtree', 26, 3, 189], ['reeds', 120, 2, 149, 'cluster'], ['shack', 6, 15, 129],
            ['lantern', 26, 2.5, 5], ['lily', 60, 3, 189, 'water'], ['gator', 8, 7, 109, 'water'], ['boat', 4, 9, 129, 'water'],
        ],
        crowd: 0.5,
    },
    frost: {
        time: 'Snowy afternoon', skyTop: 0x8aa2c0, skyHor: 0xe2e8f0, sunCol: 0xf2f4ff, sunI: 1.7, sunEl: 0.5, sunAz: 1.2,
        hemiSky: 0xe6eeff, hemiGround: 0x9aa6b8, hemiI: 1.15, fog: 0xdfe5ee, fogNear: 70, fogFar: 430, exposure: 1.0,
        clouds: 16, cloudCol: 0xf4f6fa,
        ground: [0xf2f6fa, 0xe4ecf4, 0xdfe7f0, 0xc8d4e0], shoulder: 0xe8eef4, rock: 0x707884,
        road: 0xd2d8e0, rut: 0xa8b2c0, edge: 0xe6ecf2, dust: 0xf4f8ff,
        barrier: ['snowbank', 'netting'], motes: 'snow', mountains: 0xc8d2e0,
        land: (x, z, dc) => fbm(x / 160, z / 160, 51) * 8 + ss(260, 760, dc) * (70 + fbm(x / 90, z / 90, 52) * 50),
        props: [
            ['snowpine', 200, 2, 289], ['rock', 40, 2, 209], ['cabin', 4, 19, 139], ['snowman', 6, 3, 39],
            ['skiflag', 30, 2, 3], ['crystal', 14, 5, 109],
        ],
        crowd: 0.7,
    },
    dome: {
        time: 'Night', skyTop: 0x04050c, skyHor: 0x141a34, sunCol: 0xdfe8ff, sunI: 1.8, sunEl: 0.9, sunAz: 0.3,
        hemiSky: 0x8a9ad0, hemiGround: 0x3a2a24, hemiI: 1.1, fog: 0x0c0f1e, fogNear: 220, fogFar: 700, exposure: 1.15,
        clouds: 0, cloudCol: 0x202030, night: 1, stars: true,
        ground: [0x7c5236, 0x84583a, 0x6e4a32, 0x8a6040], shoulder: 0x8a5c3c, rock: 0x5a5a60,
        road: 0x9a5f3c, rut: 0x6e4028, edge: 0xb07a52, dust: 0xa8724c,
        barrier: ['tuff', 'tuff'], motes: 'confetti', mountains: 0x10121e,
        land: () => 0,
        stadium: true,
        props: [['lighttower', 0, 0, 0]],
        crowd: 0,
    },
    mesa: {
        time: 'Golden hour', skyTop: 0x283a7c, skyHor: 0xffb46a, sunCol: 0xffc574, sunI: 2.6, sunEl: 0.26, sunAz: -2.6,
        hemiSky: 0xffd6b0, hemiGround: 0x7a4a2a, hemiI: 1.0, fog: 0xe0a070, fogNear: 200, fogFar: 860, exposure: 1.05,
        clouds: 12, cloudCol: 0xffd0a8,
        ground: [0xc98a4a, 0xb8763e, 0xd8a060, 0xa86a3a], shoulder: 0xc4884e, rock: 0x8a5a3a,
        road: 0xa77a4a, rut: 0x7a5230, edge: 0xc89a66, dust: 0xc89462,
        barrier: ['raven', 'raven'], motes: 'dust', mountains: 0x9a5a3a,
        land: (x, z, dc) => {
            const n = fbm(x / 170, z / 170, 61);
            const mesa = ss(0.15, 0.3, fbm(x / 240, z / 240, 63)) * ss(180, 340, dc) * 50;
            return n * 5 + Math.round(mesa / 10) * 10 + ss(450, 950, dc) * (60 + n * 30);
        },
        props: [
            ['cactus', 40, 3, 209], ['rock', 40, 3, 229], ['hoodoo', 14, 29, 249], ['billboard', 8, 5, 29],
            ['flagpole', 22, 2.5, 5], ['tent', 6, 7, 49], ['ravtower', 1, 59, 109],
        ],
        crowd: 1.4,
    },
};

