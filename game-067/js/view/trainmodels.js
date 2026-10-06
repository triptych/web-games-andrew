/**
 * trainmodels.js — locomotives and cars, built from primitives in the player's chosen colours.
 *
 * Vehicles face +x, are centred on x = 0, and stand on the rail top at y = 0. The track gauge is 0.3
 * (rails at z = ±0.15), so bodies are about 0.38 wide. Geometry is cached per type and colours.
 */

import { Builder } from './builder.js';
import { C } from './models.js';
import { PALETTE } from '../config.js';
import { ENGINES, CARS } from '../sim/trainsets.js';

const col = (i) => PALETTE[i]?.hex ?? 0xd8352a;
const cache = new Map();

/** A pair of wheels (both sides) at x, radius r. */
function wheels(b, x, r = 0.06, hub = C.ltgrey) {
    for (const z of [-0.155, 0.155]) {
        b.cyl(r, 0.035, C.black, x, r, z, { rx: Math.PI / 2, centre: true, seg: 12 });
        b.cyl(r * 0.55, 0.04, hub, x, r, z, { rx: Math.PI / 2, centre: true, seg: 8 });
    }
}
/** A two-axle truck under a car. */
function truck(b, x) {
    b.box(0.22, 0.06, 0.26, C.dkgrey, x, 0.04, 0);
    wheels(b, x - 0.06, 0.05); wheels(b, x + 0.06, 0.05);
}
function couplers(b, len) {
    b.box(0.06, 0.04, 0.06, C.dkgrey, len / 2 + 0.01, 0.1, 0);
    b.box(0.06, 0.04, 0.06, C.dkgrey, -len / 2 - 0.01, 0.1, 0);
}
function face(b, x, y) {
    // a friendly face on the smokebox door
    b.cyl(0.105, 0.02, 0xe8e0d0, x, y, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
    for (const z of [-0.035, 0.035]) { b.sphere(0.018, C.white, x + 0.012, y + 0.03, z, { seg: 8 }); b.sphere(0.01, C.black, x + 0.026, y + 0.03, z, { seg: 6 }); }
    for (let k = 0; k < 5; k++) { const a = Math.PI * (0.15 + k * 0.175); b.sphere(0.009, C.dkred, x + 0.014, y - 0.005 - Math.sin(a) * 0.035, Math.cos(a) * 0.04, { seg: 6, rings: 4 }); }
    b.sphere(0.012, 0xf08a8a, x + 0.016, y - 0.005, -0.06); b.sphere(0.012, 0xf08a8a, x + 0.016, y - 0.005, 0.06);
}

const ENGINE_MODELS = {
    steam(b, body, trim, hasFace) {
        const L = ENGINES.steam.len;
        b.box(L * 0.96, 0.05, 0.32, C.black, 0.0, 0.1, 0);
        for (const x of [0.02, 0.18, 0.34]) wheels(b, x - 0.1, 0.075, C.red);
        wheels(b, -0.36, 0.055, C.red);
        b.box(0.48, 0.025, 0.04, C.ltgrey, 0.08, 0.075, 0.18); b.box(0.48, 0.025, 0.04, C.ltgrey, 0.08, 0.075, -0.18);
        b.cyl(0.13, 0.56, body, 0.2, 0.29, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        for (const x of [0.02, 0.22, 0.42]) b.cyl(0.133, 0.025, trim, x, 0.29, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        b.cyl(0.05, 0.14, trim, 0.37, 0.4, 0, { seg: 10 });
        b.cyl(0.075, 0.05, trim, 0.37, 0.53, 0, { rt: 0.06, seg: 10 });
        b.sphere(0.06, C.gold, 0.18, 0.41, 0, { half: true, seg: 10 });
        b.box(0.32, 0.32, 0.36, body, -0.3, 0.14, 0);
        b.box(0.38, 0.04, 0.42, trim, -0.3, 0.46, 0);
        for (const z of [-0.181, 0.181]) b.box(0.12, 0.1, 0.01, C.win, -0.28, 0.32, z, { glow: 1 });
        b.box(0.01, 0.1, 0.2, C.win, -0.139, 0.32, 0, { glow: 1 });
        b.box(0.05, 0.12, 0.36, C.red, L / 2 - 0.02, 0.06, 0);
        b.gable(0.36, 0.12, 0.1, C.dkgrey, L / 2 + 0.04, 0.0, 0, { ry: Math.PI / 2, rz: 0 });
        if (hasFace) face(b, 0.485, 0.29);
        else b.cyl(0.1, 0.02, C.dkgrey, 0.485, 0.29, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        b.cyl(0.035, 0.05, 0xfff3c0, 0.47, 0.45, 0, { rz: Math.PI / 2, centre: true, seg: 10, glow: 2 });
        b.box(0.05, 0.05, 0.05, C.black, 0.44, 0.42, 0);
        b.cyl(0.015, 0.06, C.gold, 0.05, 0.42, 0.05, { seg: 6 });
    },
    tank(b, body, trim, hasFace) {
        const L = ENGINES.tank.len;
        b.box(L * 0.96, 0.05, 0.32, C.black, 0, 0.1, 0);
        for (const x of [-0.17, 0.0, 0.17]) wheels(b, x, 0.07, C.red);
        b.cyl(0.12, 0.42, body, 0.13, 0.27, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        for (const z of [-0.14, 0.14]) b.box(0.32, 0.16, 0.08, body, 0.12, 0.15, z);
        b.box(0.32, 0.02, 0.38, trim, 0.12, 0.31, 0);
        b.cyl(0.045, 0.12, trim, 0.28, 0.37, 0, { seg: 10 });
        b.cyl(0.065, 0.04, trim, 0.28, 0.49, 0, { rt: 0.055, seg: 10 });
        b.sphere(0.05, C.gold, 0.1, 0.38, 0, { half: true, seg: 10 });
        b.box(0.28, 0.3, 0.36, body, -0.22, 0.14, 0);
        b.box(0.32, 0.04, 0.4, trim, -0.22, 0.44, 0);
        for (const z of [-0.181, 0.181]) b.box(0.1, 0.09, 0.01, C.win, -0.21, 0.3, z, { glow: 1 });
        b.box(0.05, 0.1, 0.36, C.red, L / 2 - 0.02, 0.07, 0);
        if (hasFace) face(b, 0.345, 0.27);
        else b.cyl(0.09, 0.02, C.dkgrey, 0.345, 0.27, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        b.cyl(0.03, 0.04, 0xfff3c0, 0.34, 0.41, 0, { rz: Math.PI / 2, centre: true, seg: 10, glow: 2 });
    },
    diesel(b, body, trim) {
        const L = ENGINES.diesel.len;
        truck(b, -0.27); truck(b, 0.27);
        b.box(L * 0.94, 0.04, 0.34, C.black, 0, 0.12, 0);
        b.box(0.86, 0.26, 0.36, body, 0, 0.16, 0);
        b.box(0.87, 0.05, 0.365, trim, 0, 0.2, 0);
        b.box(0.84, 0.05, 0.32, body, 0, 0.42, 0);
        b.cyl(0.16, 0.84, body, 0, 0.42, 0, { rz: Math.PI / 2, centre: true, seg: 12, sy: 1, sx: 1, ts: 0, tl: Math.PI, rx: 0 });
        for (const x of [-0.37, 0.37]) {
            for (const z of [-0.181, 0.181]) b.box(0.1, 0.08, 0.01, C.win, x, 0.32, z, { glow: 1 });
            b.box(0.01, 0.08, 0.26, C.win, x + Math.sign(x) * 0.065, 0.32, 0, { glow: 1 });
            b.cyl(0.025, 0.02, 0xfff3c0, x + Math.sign(x) * 0.07, 0.25, 0, { rz: Math.PI / 2, centre: true, seg: 8, glow: 2 });
        }
        for (let i = 0; i < 4; i++) b.box(0.08, 0.02, 0.2, C.dkgrey, -0.15 + i * 0.1, 0.47, 0);
        b.box(0.04, 0.06, 0.04, C.dkgrey, 0.12, 0.49, 0.06);
    },
    bullet(b, body, trim) {
        truck(b, -0.28); truck(b, 0.2);
        // body, a low rounded roof and a long nose, all the same height so they flow together
        b.box(0.66, 0.24, 0.36, body, -0.17, 0.14, 0);
        b.cyl(0.18, 0.66, body, -0.17, 0.38, 0, { rz: Math.PI / 2, centre: true, seg: 14, ts: 0, tl: Math.PI, sx: 0.62 });
        b.sphere(0.18, body, 0.16, 0.32, 0, { sx: 2.1, sy: 1.0, seg: 18, rings: 10 });
        b.box(0.67, 0.05, 0.365, trim, -0.17, 0.19, 0);
        b.sphere(0.13, trim, 0.32, 0.22, 0, { sx: 1.9, sy: 0.32, seg: 14 });
        b.box(0.62, 0.07, 0.366, 0x22324a, -0.19, 0.31, 0, { glow: 0.6 });
        b.sphere(0.1, 0x22324a, 0.38, 0.38, 0, { sx: 1.1, sy: 0.45, sz: 1.25, seg: 12, glow: 0.4 });
        for (const z of [-0.09, 0.09]) b.sphere(0.022, 0xfff3c0, 0.5, 0.27, z, { glow: 2 });
        b.box(0.02, 0.12, 0.02, C.dkgrey, -0.3, 0.46, 0, { rz: 0.5 }); b.box(0.16, 0.015, 0.2, C.dkgrey, -0.25, 0.56, 0);
    },
    tram(b, body, trim) {
        truck(b, -0.24); truck(b, 0.24);
        b.box(0.84, 0.08, 0.36, trim, 0, 0.12, 0);
        b.box(0.84, 0.28, 0.36, body, 0, 0.2, 0);
        b.cyl(0.19, 0.84, C.white, 0, 0.44, 0, { rz: Math.PI / 2, centre: true, seg: 12, ts: 0, tl: Math.PI });
        for (let i = 0; i < 5; i++) for (const z of [-0.181, 0.181]) b.box(0.12, 0.13, 0.01, C.win, -0.3 + i * 0.15, 0.28, z, { glow: 1 });
        for (const x of [-0.421, 0.421]) { b.box(0.01, 0.13, 0.26, C.win, x, 0.28, 0, { glow: 1 }); b.sphere(0.025, 0xfff3c0, x * 1.01, 0.18, 0, { glow: 2 }); }
        b.box(0.02, 0.3, 0.02, C.dkgrey, 0.05, 0.58, 0, { rz: -0.9 });
        b.sphere(0.02, C.dkgrey, 0.27, 0.78, 0);
        b.box(0.14, 0.05, 0.3, trim, 0, 0.62, 0);
    },
};

const CAR_MODELS = {
    coach(b, c) {
        const L = CARS.coach.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.27, 0.36, c, 0, 0.13, 0);
        b.box(L * 0.97, 0.035, 0.365, C.cream, 0, 0.28, 0);
        b.cyl(0.18, L * 0.98, C.dkgrey, 0, 0.4, 0, { rz: Math.PI / 2, centre: true, seg: 12, ts: 0, tl: Math.PI, sy: 1 });
        b.box(L * 0.98, 0.02, 0.38, C.dkgrey, 0, 0.4, 0);
        for (let i = 0; i < 4; i++) for (const z of [-0.181, 0.181]) b.box(0.11, 0.09, 0.01, C.win, -0.24 + i * 0.16, 0.29, z, { glow: 1 });
        couplers(b, L);
    },
    caboose(b, c) {
        const L = CARS.caboose.len;
        truck(b, -0.18); truck(b, 0.18);
        b.box(L * 0.98, 0.04, 0.36, C.black, 0, 0.12, 0);
        b.box(0.46, 0.28, 0.34, c, 0, 0.16, 0);
        b.box(0.5, 0.03, 0.38, C.dkgrey, 0, 0.44, 0);
        b.box(0.22, 0.13, 0.26, c, 0, 0.47, 0);
        b.box(0.26, 0.025, 0.3, C.dkgrey, 0, 0.6, 0);
        for (const z of [-0.171, 0.171]) b.box(0.08, 0.08, 0.01, C.win, -0.1, 0.3, z, { glow: 1 });
        for (const z of [-0.131, 0.131]) b.box(0.06, 0.06, 0.01, C.win, 0, 0.5, z, { glow: 1 });
        for (const x of [-0.31, 0.31]) { b.box(0.012, 0.16, 0.36, C.yellow, x, 0.16, 0); b.cyl(0.018, 0.02, 0xff4030, x, 0.4, 0.14, { rz: Math.PI / 2, centre: true, glow: 1.5 }); }
        b.cyl(0.015, 0.1, C.dkgrey, 0.12, 0.6, 0.05);
        couplers(b, L);
    },
    box(b, c) {
        const L = CARS.box.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.34, 0.36, c, 0, 0.12, 0);
        b.box(L * 0.98, 0.03, 0.38, C.dkgrey, 0, 0.46, 0);
        b.box(L * 0.7, 0.012, 0.1, 0x8a5a2a, 0, 0.49, 0);
        for (const z of [-0.181, 0.181]) { b.box(0.22, 0.26, 0.012, C.dkgrey, 0, 0.15, z); b.box(0.2, 0.24, 0.014, c, 0, 0.16, z); b.box(0.018, 0.2, 0.016, C.ltgrey, 0.06, 0.18, z); }
        for (let i = 0; i < 5; i++) b.box(0.012, 0.32, 0.365, C.dkgrey, -0.36 + i * 0.18, 0.13, 0);
        couplers(b, L);
    },
    tank(b, c) {
        const L = CARS.tank.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.04, 0.32, C.black, 0, 0.12, 0);
        b.cyl(0.16, L * 0.86, c, 0, 0.32, 0, { rz: Math.PI / 2, centre: true, seg: 16 });
        for (const x of [-L * 0.43, L * 0.43]) b.sphere(0.16, c, x, 0.32, 0, { sx: 0.3, seg: 12 });
        b.cyl(0.07, 0.07, c, 0, 0.47, 0, { seg: 12 });
        b.cyl(0.08, 0.02, C.dkgrey, 0, 0.54, 0, { seg: 12 });
        b.box(0.5, 0.012, 0.012, C.ltgrey, 0, 0.36, 0.165); b.box(0.5, 0.012, 0.012, C.ltgrey, 0, 0.36, -0.165);
        couplers(b, L);
    },
    logs(b, c) {
        const L = CARS.logs.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.05, 0.36, c, 0, 0.12, 0);
        for (const x of [-0.34, -0.12, 0.12, 0.34]) for (const z of [-0.17, 0.17]) b.box(0.025, 0.24, 0.025, C.dkgrey, x, 0.17, z);
        const logs = [[-0.09, 0.22], [0, 0.22], [0.09, 0.22], [-0.045, 0.3], [0.045, 0.3], [0, 0.375]];
        for (const [z, y] of logs) { b.cyl(0.045, L * 0.88, 0x8f5a2e, 0, y, z * 1.3, { rz: Math.PI / 2, centre: true, seg: 8 }); b.cyl(0.035, L * 0.885, 0xd9b77e, 0, y, z * 1.3, { rz: Math.PI / 2, centre: true, seg: 8 }); }
        couplers(b, L);
    },
    coal(b, c) {
        const L = CARS.coal.len;
        truck(b, -0.2); truck(b, 0.2);
        b.box(L * 0.96, 0.05, 0.34, C.black, 0, 0.12, 0);
        b.box(L * 0.92, 0.24, 0.36, c, 0, 0.17, 0, { sz: 1 });
        b.box(L * 0.84, 0.02, 0.32, C.black, 0, 0.4, 0);
        for (let i = 0; i < 9; i++) b.ico(0.06, 0x23242a, -0.26 + (i % 5) * 0.13, 0.42 + (i > 4 ? 0.04 : 0), (i % 2 ? 0.07 : -0.07), { detail: 0 });
        for (let i = 0; i < 4; i++) b.box(0.014, 0.24, 0.365, C.dkgrey, -0.27 + i * 0.18, 0.17, 0);
        couplers(b, L);
    },
    mail(b, c) {
        const L = CARS.mail.len;
        truck(b, -0.22); truck(b, 0.22);
        b.box(L * 0.96, 0.32, 0.36, c, 0, 0.12, 0);
        b.box(L * 0.97, 0.05, 0.365, C.white, 0, 0.3, 0);
        b.cyl(0.18, L * 0.98, C.dkgrey, 0, 0.44, 0, { rz: Math.PI / 2, centre: true, seg: 12, ts: 0, tl: Math.PI, sy: 0.6 });
        for (const z of [-0.182, 0.182]) {
            b.box(0.16, 0.11, 0.01, C.white, -0.12, 0.15, z);
            b.box(0.06, 0.06, 0.012, C.red, -0.12, 0.17, z, { rx: 0, rz: Math.PI / 4, centre: true, y: 0.2 });
            b.box(0.1, 0.18, 0.012, C.dkgrey, 0.18, 0.13, z);
        }
        couplers(b, L);
    },
    sheep(b, c) {
        const L = CARS.sheep.len;
        truck(b, -0.22); truck(b, 0.22);
        b.box(L * 0.96, 0.05, 0.36, C.dkgrey, 0, 0.12, 0);
        for (let i = 0; i < 4; i++) for (const z of [-0.17, 0.17]) b.box(L * 0.94, 0.035, 0.02, c, 0, 0.18 + i * 0.07, z);
        for (const x of [-0.36, 0.36]) b.box(0.02, 0.3, 0.36, c, x, 0.17, 0);
        b.box(L * 0.96, 0.03, 0.38, c, 0, 0.47, 0);
        for (const [x, z] of [[-0.18, 0.19], [0.08, 0.19], [-0.05, -0.19], [0.22, -0.19]]) {
            b.sphere(0.07, C.white, x, 0.33, z * 0.75, { seg: 8 });
            b.sphere(0.04, C.black, x, 0.33, z, { seg: 8 });
        }
        couplers(b, L);
    },
    candy(b, c) {
        const L = CARS.candy.len;
        truck(b, -0.22); truck(b, 0.22);
        b.box(L * 0.96, 0.3, 0.36, c, 0, 0.12, 0);
        for (let i = 0; i < 6; i++) b.box(L * 0.97 / 6, 0.05, 0.37, i % 2 ? C.white : C.pink, -L * 0.48 + (i + 0.5) * (L * 0.97 / 6), 0.36, 0);
        b.box(L * 0.97, 0.03, 0.38, C.white, 0, 0.41, 0);
        b.cone(0.07, 0.2, 0xe0a85c, 0, 0.44, 0, { rx: Math.PI });
        b.sphere(0.085, 0xfff3e0, 0, 0.66, 0, { seg: 10 });
        b.sphere(0.07, C.pink, 0, 0.76, 0, { seg: 10 });
        b.sphere(0.025, C.red, 0, 0.84, 0);
        for (const z of [-0.181, 0.181]) b.box(0.24, 0.12, 0.012, C.win, 0.18, 0.18, z, { glow: 1 });
        couplers(b, L);
    },
    circus(b, c) {
        const L = CARS.circus.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.06, 0.36, c, 0, 0.12, 0);
        b.box(L * 0.96, 0.05, 0.38, c, 0, 0.44, 0);
        b.gable(L * 0.9, 0.08, 0.36, C.red, 0, 0.49, 0);
        for (let i = 0; i < 9; i++) for (const z of [-0.17, 0.17]) b.cyl(0.01, 0.27, C.gold, -0.36 + i * 0.09, 0.18, z, { seg: 5 });
        b.sphere(0.11, 0xe8a03a, 0.02, 0.3, 0, { seg: 10 });
        b.sphere(0.07, 0xf2c070, 0.08, 0.3, 0, { seg: 10 });
        b.sphere(0.012, C.black, 0.135, 0.33, -0.03); b.sphere(0.012, C.black, 0.135, 0.33, 0.03);
        b.box(0.18, 0.08, 0.18, 0xe8a03a, -0.14, 0.18, 0);
        for (const x of [-0.38, 0.38]) b.sphere(0.04, C.yellow, x, 0.5, 0, { glow: 0.8 });
        couplers(b, L);
    },
    flat(b, c) {
        const L = CARS.flat.len;
        truck(b, -0.24); truck(b, 0.24);
        b.box(L * 0.96, 0.05, 0.36, c, 0, 0.12, 0);
        const car = [C.red, C.blue, C.yellow][Math.abs(c) % 3];
        for (const x of [-0.2, 0.2]) {
            b.box(0.3, 0.08, 0.2, car, x, 0.2, 0);
            b.box(0.16, 0.07, 0.18, C.glass, x - 0.02, 0.28, 0, { glow: 0.4 });
            b.box(0.17, 0.02, 0.19, car, x - 0.02, 0.35, 0);
            for (const dx of [-0.09, 0.09]) for (const z of [-0.1, 0.1]) b.cyl(0.035, 0.025, C.black, x + dx, 0.2, z, { rx: Math.PI / 2, centre: true, seg: 8 });
        }
        couplers(b, L);
    },
};

export function engineGeo(type, body, trim, hasFace) {
    const key = `e:${type}:${body}:${trim}:${hasFace ? 1 : 0}`;
    if (!cache.has(key)) {
        const b = new Builder();
        (ENGINE_MODELS[type] || ENGINE_MODELS.steam)(b, col(body), col(trim), hasFace);
        cache.set(key, b.geometry());
    }
    return cache.get(key);
}

export function carGeo(type, color) {
    const key = `c:${type}:${color}`;
    if (!cache.has(key)) {
        const b = new Builder();
        (CAR_MODELS[type] || CAR_MODELS.box)(b, col(color));
        cache.set(key, b.geometry());
    }
    return cache.get(key);
}

/** Where the chimney is, for smoke (engine-local coordinates). */
export const STACK = { steam: [0.37, 0.58], tank: [0.28, 0.54], diesel: [0.12, 0.52] };
