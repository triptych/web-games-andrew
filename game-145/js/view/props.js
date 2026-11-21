// Every prop in the city, built from boxes, cylinders and tubes. Local frame: origin on the floor at the prop's
// centre, the back against -z (the wall), the front facing +z. Colours multiply the material's texture.

import { plain, surface, decal, vendingTexture } from './tex.js';
import * as THREE from 'three';

let M = null;
function mats() {
    if (M) return M;
    M = {
        wood: plain('wood'), metal: plain('metal'), paint: plain('paint'), fabric: plain('fabric'), glow: plain('glow'),
        glass: plain('glass'), paper: plain('paper'), bark: plain('bark'), leaves: plain('leaves'), rust: plain('rust'),
        conc: plain('concrete'), plain: plain('plain'),
        vend: new THREE.MeshStandardMaterial({ map: vendingTexture(), emissive: 0xffffff, emissiveMap: vendingTexture(), emissiveIntensity: 0.9, roughness: 0.4 }),
    };
    return M;
}

const C = {
    dark: [0.12, 0.11, 0.1], grey: [0.45, 0.45, 0.44], white: [0.85, 0.84, 0.8], rust: [0.55, 0.32, 0.2], cream: [0.8, 0.74, 0.6],
    teal: [0.25, 0.42, 0.42], green: [0.28, 0.34, 0.22], red: [0.5, 0.14, 0.12], blue: [0.2, 0.26, 0.42], yellow: [0.75, 0.6, 0.22],
    mattress: [0.72, 0.66, 0.52], stain: [0.5, 0.42, 0.28], leaf: [0.25, 0.3, 0.14], deadleaf: [0.42, 0.33, 0.18],
};
const CAR = [[0.42, 0.12, 0.1], [0.16, 0.24, 0.36], [0.62, 0.6, 0.55], [0.18, 0.3, 0.22], [0.5, 0.42, 0.25], [0.12, 0.12, 0.13], [0.55, 0.5, 0.42], [0.35, 0.18, 0.3]];

/** A tiny deterministic random from a prop's position, for variety that never changes between visits. */
function rnd(p, k = 0) { const h = Math.sin(p.x * 12.9898 + p.z * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); }

export const PROPS = {
    // ---------------------------------------------------------------- home
    bed(K, p) {
        const M = mats();
        K.box(M.wood, 0, 0, 0, 1.5, 0.35, 2.0, C.dark, 1);
        K.box(M.fabric, 0, 0.35, 0.05, 1.4, 0.22, 1.85, p.start ? [0.55, 0.5, 0.42] : C.mattress, 1);
        K.box(M.fabric, 0, 0.57, -0.7, 0.9, 0.12, 0.35, C.white, 1);
        K.box(M.wood, 0, 0, -1.0, 1.55, 1.1, 0.08, C.dark, 1);
        if (rnd(p) < 0.6 || p.start) K.box(M.fabric, 0.05, 0.57, 0.35, 1.45, 0.06, 1.2, [0.42, 0.38, 0.33], 1);   // a rumpled sheet
    },
    mattress(K, p) { const M = mats(); K.box(M.fabric, 0, 0, 0, 1.4, 0.2, 1.9, C.stain, 1); },
    cot(K, p) { const M = mats(); K.box(M.metal, 0, 0.3, 0, 0.8, 0.06, 1.8, C.grey); K.box(M.fabric, 0, 0.36, 0, 0.75, 0.1, 1.7, C.stain); },
    couch(K, p) {
        const M = mats(), col = [C.green, C.red, [0.4, 0.3, 0.25], C.blue][Math.floor(rnd(p) * 4)];
        K.box(M.fabric, 0, 0.1, 0, 1.9, 0.35, 0.85, col); K.box(M.fabric, 0, 0.1, -0.35, 1.9, 0.75, 0.2, col);
        K.box(M.fabric, -0.9, 0.1, 0, 0.2, 0.55, 0.85, col); K.box(M.fabric, 0.9, 0.1, 0, 0.2, 0.55, 0.85, col);
        K.box(M.wood, 0, 0, 0, 1.9, 0.1, 0.85, C.dark);
    },
    sofa(K, p) { PROPS.couch(K, p); },
    armchair(K, p) { const M = mats(); K.box(M.fabric, 0, 0.1, 0, 0.85, 0.35, 0.8, C.red); K.box(M.fabric, 0, 0.1, -0.32, 0.85, 0.8, 0.18, C.red); K.box(M.fabric, -0.38, 0.1, 0, 0.12, 0.55, 0.8, C.red); K.box(M.fabric, 0.38, 0.1, 0, 0.12, 0.55, 0.8, C.red); },
    tv(K, p) { const M = mats(); K.box(M.wood, 0, 0, -0.2, 1.2, 0.5, 0.45, C.dark); K.box(M.paint, 0, 0.5, -0.2, 0.7, 0.55, 0.5, C.dark); K.box(M.glass, 0, 0.56, 0.06, 0.55, 0.42, 0.01, [0.2, 0.25, 0.22]); },
    shelf(K, p) {
        const M = mats();
        K.box(M.wood, 0, 0, -0.7, 1.6, 1.9, 0.4, C.dark, 1, 0b111110);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) if (rnd(p, i * 9 + k) < 0.6) K.box(M.paint, -0.65 + k * 0.25, 0.08 + i * 0.46, -0.7, 0.12 + rnd(p, k) * 0.08, 0.28 + rnd(p, i) * 0.1, 0.3, [0.3 + rnd(p, k) * 0.4, 0.2 + rnd(p, i + k) * 0.2, 0.15 + rnd(p, i) * 0.2]);
    },
    bookcase(K, p) {
        const M = mats();
        K.box(M.wood, 0, 0, 0, 1.8, 2.1, 0.5, [0.32, 0.22, 0.14]);
        for (let i = 0; i < 5; i++) for (const side of [-1, 1]) for (let k = 0; k < 7; k++) if (rnd(p, i * 13 + k + side) < 0.7)
            K.box(M.paint, -0.75 + k * 0.24, 0.1 + i * 0.4, side * 0.26, 0.16, 0.3, 0.04, [0.25 + rnd(p, k) * 0.4, 0.18 + rnd(p, i * k) * 0.2, 0.12 + rnd(p, i) * 0.25], 1, side > 0 ? 4 : 8);
    },
    table(K, p) { const M = mats(); K.box(M.wood, 0, 0.72, 0, 1.4, 0.05, 0.9, C.dark); for (const [x, z] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) K.box(M.wood, x, 0, z, 0.06, 0.72, 0.06, C.dark); },
    piano(K, p) { const M = mats(); K.box(M.paint, 0, 0, -0.5, 1.5, 1.25, 0.6, [0.06, 0.05, 0.05]); K.box(M.paint, 0, 0.7, -0.1, 1.4, 0.06, 0.25, C.white); },
    fridge(K, p) { const M = mats(); K.box(M.paint, 0, 0, -0.5, 0.75, 1.75, 0.7, [0.78, 0.76, 0.66]); K.box(M.metal, 0.3, 0.9, -0.14, 0.04, 0.5, 0.04, C.grey); },
    stove(K, p) { const M = mats(); K.box(M.paint, 0, 0, -0.55, 0.75, 0.9, 0.65, [0.8, 0.78, 0.7]); for (const [x, z] of [[-0.18, -0.7], [0.18, -0.7], [-0.18, -0.4], [0.18, -0.4]]) K.cyl(M.metal, x, 0.9, z, 0.09, 0.02, 8, C.dark); },
    counter(K, p) { const M = mats(); K.box(M.wood, 0, 0, -0.55, 1.9, 0.88, 0.65, [0.45, 0.4, 0.32]); K.box(M.paint, 0, 0.88, -0.55, 1.95, 0.05, 0.7, [0.7, 0.68, 0.6]); },
    wardrobe(K, p) { const M = mats(); K.box(M.wood, 0, 0, -0.6, 1.2, 2.0, 0.6, [0.3, 0.2, 0.13]); K.box(M.metal, 0.05, 1.0, -0.29, 0.04, 0.2, 0.03, C.grey); },
    dresser(K, p) { const M = mats(); K.box(M.wood, 0, 0, -0.6, 1.2, 0.85, 0.5, [0.35, 0.24, 0.15]); K.box(M.glass, 0, 0.95, -0.82, 0.8, 0.9, 0.02, [0.5, 0.55, 0.55]); },
    bathtub(K, p) { const M = mats(); K.box(M.paint, 0, 0, 0, 0.8, 0.55, 1.7, C.white); K.box(M.paint, 0, 0.5, 0, 0.62, 0.06, 1.5, [0.35, 0.3, 0.22]); },
    toilet(K, p) { const M = mats(); K.box(M.paint, 0, 0, -0.5, 0.4, 0.42, 0.55, C.white); K.box(M.paint, 0, 0.42, -0.75, 0.42, 0.4, 0.18, C.white); },
    // ---------------------------------------------------------------- offices, schools, shops
    desk(K, p) {
        const M = mats();
        K.box(M.wood, 0, 0.72, -0.3, 1.5, 0.05, 0.75, [0.4, 0.32, 0.22]); K.box(M.metal, -0.6, 0, -0.3, 0.3, 0.72, 0.7, C.grey); K.box(M.metal, 0.68, 0, -0.3, 0.05, 0.72, 0.7, C.grey);
        if (rnd(p) < 0.6) { K.box(M.paint, 0.2, 0.77, -0.45, 0.45, 0.36, 0.38, [0.75, 0.72, 0.62]); K.box(M.glass, 0.2, 0.83, -0.25, 0.34, 0.26, 0.01, [0.1, 0.12, 0.12]); }
        K.box(M.paper, -0.3, 0.77, -0.2, 0.4, 0.02, 0.3, C.white);
        K.box(M.fabric, 0.2, 0, 0.45, 0.5, 0.45, 0.5, C.dark);
    },
    filing(K, p) { const M = mats(); K.box(M.metal, 0, 0, -0.65, 0.5, 1.35, 0.65, [0.42, 0.44, 0.4]); for (let i = 0; i < 4; i++) K.box(M.metal, 0, 0.2 + i * 0.32, -0.31, 0.18, 0.03, 0.03, C.dark); },
    cubicle(K, p) {
        const M = mats();
        const col = [0.42, 0.4, 0.34];
        K.box(M.fabric, 0, 0, -0.95, 2.0, 1.45, 0.06, col); K.box(M.fabric, -0.95, 0, 0, 0.06, 1.45, 1.9, col);
        K.box(M.wood, -0.2, 0.72, -0.6, 1.4, 0.04, 0.7, [0.55, 0.48, 0.36]);
        if (rnd(p) < 0.7) { K.box(M.paint, -0.3, 0.76, -0.75, 0.42, 0.34, 0.35, [0.75, 0.72, 0.62]); K.box(M.glass, -0.3, 0.82, -0.57, 0.32, 0.24, 0.01, [0.08, 0.1, 0.1]); }
        K.box(M.fabric, 0.1, 0, 0.1, 0.5, 0.45, 0.5, C.dark);
    },
    schooldesk(K, p) { const M = mats(); for (const x of [-0.45, 0.45]) { K.box(M.wood, x, 0.68, -0.2, 0.6, 0.04, 0.45, [0.6, 0.48, 0.3]); K.box(M.metal, x, 0, -0.2, 0.04, 0.68, 0.04, C.grey); K.box(M.wood, x, 0.42, 0.35, 0.4, 0.04, 0.38, [0.6, 0.48, 0.3]); } },
    blackboard(K, p) { const M = mats(); K.box(M.paint, 0, 0.8, -0.96, 1.9, 1.1, 0.05, [0.08, 0.14, 0.1]); K.box(M.wood, 0, 0.75, -0.9, 1.9, 0.05, 0.12, [0.5, 0.4, 0.3]); },
    rack(K, p) { const M = mats(); K.tube(M.metal, [-0.8, 1.5, 0], [0.8, 1.5, 0], 0.02, 6, C.grey); for (const x of [-0.8, 0.8]) K.tube(M.metal, [x, 0, 0], [x, 1.5, 0], 0.02, 6, C.grey); for (let i = 0; i < 8; i++) if (rnd(p, i) < 0.5) K.box(M.fabric, -0.7 + i * 0.2, 0.7, 0, 0.05, 0.75, 0.45, [0.3 + rnd(p, i + 1) * 0.4, 0.25, 0.25 + rnd(p, i + 2) * 0.3]); },
    mannequin(K, p) { const M = mats(); K.cyl(M.paint, 0, 0, 0, 0.18, 0.05, 8, C.white); K.cyl(M.paint, 0, 0.05, 0, 0.03, 0.8, 6, C.white); K.cyl(M.paint, 0, 0.85, 0, 0.17, 0.7, 8, C.white, 0.2); K.cyl(M.paint, 0, 1.6, 0, 0.1, 0.22, 8, C.white, 0.08); },
    crate(K, p) { const M = mats(); K.box(M.wood, 0, 0, 0, 0.9, 0.8, 0.9, [0.55, 0.45, 0.32]); if (rnd(p) < 0.5) K.box(M.wood, 0.1, 0.8, 0.05, 0.7, 0.6, 0.7, [0.5, 0.4, 0.3]); },
    planter(K, p) { const M = mats(); K.box(M.conc, 0, 0, 0, 1.2, 0.6, 1.2, C.grey); PROPS._shrub(K, p, 0.6); },
    kiosk(K, p) { const M = mats(); K.box(M.wood, 0, 0, 0, 1.6, 1.0, 1.0, [0.4, 0.3, 0.22]); K.box(M.glass, 0, 1.0, 0, 1.5, 0.6, 0.9, [0.5, 0.55, 0.55]); },
    bench(K, p) { const M = mats(); K.box(M.wood, 0, 0.42, 0, 1.6, 0.06, 0.45, [0.4, 0.3, 0.2]); K.box(M.wood, 0, 0.6, -0.2, 1.6, 0.35, 0.05, [0.4, 0.3, 0.2]); for (const x of [-0.7, 0.7]) K.box(M.metal, x, 0, 0, 0.06, 0.42, 0.45, C.dark); },
    // ---------------------------------------------------------------- hospital
    hospbed(K, p) {
        const M = mats();
        K.box(M.metal, 0, 0.45, 0, 0.95, 0.08, 2.0, C.white); K.box(M.fabric, 0, 0.53, 0.02, 0.9, 0.14, 1.9, [0.7, 0.72, 0.68]);
        for (const [x, z] of [[-0.42, -0.92], [0.42, -0.92], [-0.42, 0.92], [0.42, 0.92]]) K.cyl(M.metal, x, 0, z, 0.025, 0.45, 6, C.grey);
        K.box(M.metal, 0, 0.45, -1.0, 0.95, 0.6, 0.04, C.white);
        K.tube(M.metal, [-0.5, 0.75, -0.5], [-0.5, 0.75, 0.6], 0.015, 5, C.grey);
    },
    gurney(K, p) { const M = mats(); K.box(M.metal, 0, 0.8, 0, 0.65, 0.06, 1.9, C.grey); K.box(M.fabric, 0, 0.86, 0, 0.6, 0.08, 1.8, [0.6, 0.65, 0.6]); for (const z of [-0.8, 0.8]) K.box(M.metal, 0, 0, z, 0.05, 0.8, 0.05, C.grey); },
    wheelchair(K, p) { const M = mats(); K.box(M.fabric, 0, 0.45, 0, 0.5, 0.06, 0.45, C.dark); K.box(M.fabric, 0, 0.5, -0.22, 0.5, 0.5, 0.04, C.dark); for (const x of [-0.3, 0.3]) K.at(x, 0.3, 0, 0, () => K.cyl(M.metal, 0, -0.3, 0, 0.3, 0.03, 12, C.grey)); },
    cabinet(K, p) { const M = mats(); K.box(M.metal, 0, 0, -0.7, 0.9, 1.8, 0.45, [0.72, 0.74, 0.7]); K.box(M.glass, 0, 0.9, -0.47, 0.8, 0.8, 0.01, [0.5, 0.6, 0.6]); },
    curtain(K, p) { const M = mats(); K.tube(M.metal, [-1, 2.2, 0], [1, 2.2, 0], 0.015, 5, C.grey); for (let i = 0; i < 8; i++) K.quad(M.paper, [-1 + i * 0.25, 0.3, (i % 2) * 0.08], [-0.75 + i * 0.25, 0.3, ((i + 1) % 2) * 0.08], [-0.75 + i * 0.25, 2.2, ((i + 1) % 2) * 0.08], [-1 + i * 0.25, 2.2, (i % 2) * 0.08], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.55, 0.65, 0.62]); },
    // ---------------------------------------------------------------- industry
    machine(K, p) {
        const M = mats(), w = (p.w ?? 4) - 0.4, d = (p.d ?? 2) - 0.4;
        K.box(M.rust, 0, 0, 0, w, 1.4, d, [0.7, 0.62, 0.55], 1.5); K.box(M.paint, -w / 4, 1.4, 0, w / 3, 0.8, d * 0.7, [0.35, 0.42, 0.35]);
        K.cyl(M.metal, w / 4, 1.4, 0, d * 0.3, 1.1, 10, C.grey); K.tube(M.rust, [w / 4, 2.5, 0], [w / 4, 4.5, 0], 0.12, 6, C.rust);
    },
    press(K, p) { const M = mats(), w = (p.w ?? 4) - 0.6; K.box(M.paint, 0, 0, 0, w, 0.9, 1.4, [0.55, 0.45, 0.2]); for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) K.box(M.rust, x, 0.9, 0, 0.3, 2.2, 0.3, C.rust); K.box(M.paint, 0, 3.1, 0, w, 0.5, 1.2, [0.55, 0.45, 0.2]); },
    conveyor(K, p) { const M = mats(), w = (p.w ?? 4) - 0.2; K.box(M.paint, 0, 0.75, 0, w, 0.12, 0.9, C.dark); for (let x = -w / 2 + 0.3; x < w / 2; x += 0.9) K.box(M.rust, x, 0, 0, 0.08, 0.75, 0.8, C.rust); for (let i = 0; i < 4; i++) if (rnd(p, i) < 0.6) K.cyl(M.metal, -w / 2 + 0.5 + i * w / 4, 0.87, 0, 0.07, 0.13, 8, [0.6, 0.6, 0.55]); },
    rack_(K, p) {},
    racks(K, p) {},
    switchgear(K, p) { const M = mats(); K.box(M.paint, 0, 0, -0.4, 1.8, 2.1, 0.8, [0.42, 0.46, 0.42]); for (let i = 0; i < 6; i++) K.box(M.glow, -0.6 + i * 0.24, 1.6, 0.01, 0.05, 0.05, 0.02, i % 3 ? [0.1, 0.1, 0.1] : [0.6, 0.1, 0.05]); },
    breaker(K, p) { const M = mats(); K.box(M.paint, 0.35, 0.6, 0, 0.5, 1.3, 1.2, [0.38, 0.42, 0.38]); K.box(M.metal, 0.62, 1.0, 0, 0.06, 0.4, 0.2, [0.15, 0.15, 0.15]); },
    column(K, p) { const M = mats(); K.box(M.conc, 0, 0, 0, 0.6, 12, 0.6, [0.55, 0.54, 0.5], 1.5); },
    pillar(K, p) { const M = mats(); K.box(M.conc, 0, 0, 0, 0.8, 12, 0.8, [0.75, 0.68, 0.45], 1.5); },
    rubblepile(K, p) { PROPS.debris(K, { ...p, big: true }); },
    // a parked car inside a garage
    pcar(K, p) { PROPS.car(K, { ...p, flat: false }); },
    // ---------------------------------------------------------------- loose junk
    papers(K, p) { const M = mats(); for (let i = 0; i < 3; i++) K.flat(M.paper, (rnd(p, i) - 0.5) * 0.6, 0.012 + i * 0.002, (rnd(p, i + 3) - 0.5) * 0.6, 0.22, 0.3, rnd(p, i + 6) * 6, [0.75, 0.72, 0.62]); },
    chair(K, p) { const M = mats(); K.at(0, 0, 0, 0, () => { if (p.tip) { K.box(M.wood, 0, 0, 0, 0.45, 0.45, 0.05, C.dark); K.box(M.wood, 0, 0, -0.3, 0.45, 0.05, 0.6, C.dark); } else { K.box(M.wood, 0, 0.42, 0, 0.45, 0.05, 0.45, C.dark); K.box(M.wood, 0, 0.42, -0.2, 0.45, 0.5, 0.05, C.dark); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) K.box(M.wood, x, 0, z, 0.04, 0.42, 0.04, C.dark); } }); },
    box(K, p) { const M = mats(); K.box(M.paper, 0, 0, 0, 0.45, 0.35, 0.35, [0.55, 0.45, 0.3]); },
    bottle(K, p) { const M = mats(); K.cyl(M.glass, 0, 0, 0, 0.04, 0.25, 6, [0.2, 0.4, 0.25]); },
    books(K, p) { const M = mats(); for (let i = 0; i < 3; i++) K.box(M.paint, (rnd(p, i) - 0.5) * 0.3, i * 0.05, 0, 0.22, 0.05, 0.3, [0.4, 0.2 + i * 0.1, 0.15]); },
    debris(K, p) {
        const M = mats(), n = p.big ? 14 : 5, s = p.big ? 1.6 : 0.7;
        for (let i = 0; i < n; i++) K.at((rnd(p, i) - 0.5) * s, 0, (rnd(p, i + 9) - 0.5) * s, rnd(p, i + 4) * 3, () => K.box(i % 3 ? M.conc : M.wood, 0, 0, 0, 0.15 + rnd(p, i + 2) * 0.35, 0.06 + rnd(p, i + 5) * (p.big ? 0.5 : 0.15), 0.12 + rnd(p, i + 7) * 0.3, [0.5, 0.48, 0.44]));
    },
    // ---------------------------------------------------------------- the mall and the lab
    mallfountain(K, p) { const M = mats(); K.cyl(M.conc, 0, 0, 0, 1.9, 0.5, 20, [0.7, 0.66, 0.6]); K.cyl(M.paint, 0, 0.45, 0, 1.7, 0.06, 20, [0.25, 0.27, 0.2], 1.7); K.cyl(M.conc, 0, 0.5, 0, 0.3, 1.2, 10, [0.7, 0.66, 0.6]); K.cyl(M.conc, 0, 1.7, 0, 0.9, 0.2, 14, [0.7, 0.66, 0.6]); K.cyl(M.conc, 0, 1.9, 0, 0.15, 0.6, 8, [0.7, 0.66, 0.6]); },
    bigtree(K, p) { PROPS.tree(K, { ...p, s: (p.s ?? 1) * 1.6, tall: (p.floors ?? 3) }, true); },
    ring(K, p) {
        const M = mats(), R = 4.4, y0 = 5.2;
        for (let i = 0; i < 32; i++) {
            const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2;
            K.tube(M.rust, [Math.cos(a0) * R, y0 + Math.sin(a0) * R, 0], [Math.cos(a1) * R, y0 + Math.sin(a1) * R, 0], 0.55, 8, [0.62, 0.55, 0.5]);
            if (i % 4 === 0) K.at(Math.cos(a0) * R, y0 + Math.sin(a0) * R, 0, 0, () => K.box(M.metal, 0, -0.45, 0, 0.9, 0.9, 1.4, [0.35, 0.36, 0.34]));
        }
        K.box(M.conc, 0, 0, 0, 10, 0.8, 2.2, [0.5, 0.5, 0.48]);
        for (const x of [-3, 3]) K.box(M.rust, x, 0.8, 0, 0.8, 1.2, 1.6, C.rust);
    },
    console(K, p) {
        const M = mats();
        K.box(M.paint, 0, 0, 0, 7.6, 0.95, 1.4, [0.3, 0.33, 0.32]);
        K.quad(M.paint, [-3.8, 0.95, 0.7], [3.8, 0.95, 0.7], [3.8, 1.25, -0.7], [-3.8, 1.25, -0.7], [[0, 0], [4, 0], [4, 1], [0, 1]], [0.22, 0.24, 0.23]);
        for (let i = 0; i < 20; i++) K.box(M.glow, -3.4 + i * 0.36, 1.0, -0.2, 0.05, 0.12, 0.05, i % 4 ? [0.05, 0.05, 0.05] : [0.5, 0.3, 0.05]);
    },
    coil(K, p) { const M = mats(); for (let i = 0; i < 8; i++) K.cyl(M.rust, 0, i * 0.5, 0, 0.6 - (i % 2) * 0.1, 0.45, 12, i % 2 ? [0.55, 0.35, 0.2] : C.rust); K.cyl(M.metal, 0, 4, 0, 0.9, 0.3, 14, C.grey); },
    // ---------------------------------------------------------------- outside
    car(K, p) {
        const M = mats(), col = CAR[p.c ?? 0], rustc = [col[0] * 0.7 + 0.15, col[1] * 0.7 + 0.08, col[2] * 0.6 + 0.04];
        const c = (p.rust ?? 0.5) > 0.6 ? rustc : col;
        const sink = p.flat ? -0.12 : 0;
        K.at(0, sink, 0, 0, () => {
            K.box(M.paint, 0, 0.28, 0, 1.75, 0.62, 4.3, c);
            K.box(M.paint, 0, 0.9, -0.15, 1.55, 0.5, 2.2, c);
            K.box(M.glass, 0, 0.92, -0.15, 1.58, 0.42, 2.0, [0.15, 0.18, 0.2]);
            K.box(M.metal, 0, 0.18, 2.12, 1.8, 0.18, 0.15, C.grey); K.box(M.metal, 0, 0.18, -2.12, 1.8, 0.18, 0.15, C.grey);
            K.box(p.lightsOn ? M.glow : M.metal, -0.6, 0.55, 2.16, 0.3, 0.14, 0.04, p.lightsOn ? [1, 0.9, 0.6] : [0.7, 0.7, 0.6]);
            K.box(p.lightsOn ? M.glow : M.metal, 0.6, 0.55, 2.16, 0.3, 0.14, 0.04, p.lightsOn ? [1, 0.9, 0.6] : [0.7, 0.7, 0.6]);
        });
        for (const [x, z] of [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]]) K.at(x, 0.33 + sink * (p.flat ? 1.5 : 0), z, Math.PI / 2, () => K.tube(M.plain, [0, 0, -0.12], [0, 0, 0.12], 0.33, 10, C.dark));
        if (rnd(p, 3) < 0.5) K.flat(M.paper, 0, 0.92 + 0.5, 0.3, 0.6, 0.4, rnd(p) * 6, [0.35, 0.3, 0.2]);   // leaves on the roof
    },
    van(K, p) { const M = mats(), c = CAR[p.c ?? 2]; K.box(M.paint, 0, 0.3, 0, 1.9, 1.85, 4.8, c); K.box(M.glass, 0, 1.25, 1.9, 1.85, 0.6, 0.9, [0.15, 0.18, 0.2]); for (const [x, z] of [[-0.86, 1.6], [0.86, 1.6], [-0.86, -1.6], [0.86, -1.6]]) K.at(x, 0.36, z, Math.PI / 2, () => K.tube(M.plain, [0, 0, -0.13], [0, 0, 0.13], 0.36, 10, C.dark)); },
    truck(K, p) { const M = mats(); K.box(M.paint, 0, 0.5, 1.4, 2.1, 1.9, 1.6, CAR[p.c ?? 1]); K.box(M.rust, 0, 0.6, -1.1, 2.2, 2.4, 3.4, [0.6, 0.55, 0.5]); for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.8], [0.95, -1.8]]) K.at(x, 0.45, z, Math.PI / 2, () => K.tube(M.plain, [0, 0, -0.15], [0, 0, 0.15], 0.45, 10, C.dark)); },
    bus(K, p) {
        const M = mats();
        K.box(M.paint, 0, 0.35, 0, 2.5, 2.6, 9.6, [0.75, 0.6, 0.2]);
        for (const s of [-1, 1]) K.box(M.glass, s * 1.255, 1.5, 0, 0.02, 0.9, 8.6, [0.12, 0.14, 0.15]);
        K.box(M.glass, 0, 1.5, 4.81, 2.3, 1.1, 0.02, [0.12, 0.14, 0.15]);
        for (const [x, z] of [[-1.1, 3.4], [1.1, 3.4], [-1.1, -3.4], [1.1, -3.4]]) K.at(x, 0.5, z, Math.PI / 2, () => K.tube(M.plain, [0, 0, -0.15], [0, 0, 0.15], 0.5, 10, C.dark));
    },
    container(K, p) { const M = mats(), col = [[0.5, 0.2, 0.15], [0.2, 0.3, 0.42], [0.25, 0.38, 0.25], [0.55, 0.45, 0.2], [0.45, 0.45, 0.42]][p.c ?? 0]; K.box(M.rust, 0, 0, 0, 2.4, 2.6, 5.9, col, 1.5); },
    tree(K, p, inside = false) {
        const M = mats(), s = p.s ?? 1, dead = p.k === 'deadtree';
        const h = (inside ? 4 + (p.tall ?? 2) * 3.4 : 6.5) * s;
        K.cyl(M.bark, 0, 0, 0, 0.28 * s, h, 9, [0.75, 0.72, 0.68], 0.12 * s);
        // roots heaving the floor
        for (let i = 0; i < 5; i++) { const a = rnd(p, i) * 6.28; K.tube(M.bark, [0, 0.3, 0], [Math.cos(a) * 1.2 * s, -0.05, Math.sin(a) * 1.2 * s], 0.14 * s, 5, [0.7, 0.68, 0.64], 0.04); }
        const branches = 7;
        for (let i = 0; i < branches; i++) {
            const a = rnd(p, i + 10) * 6.28, y = h * (0.45 + rnd(p, i + 20) * 0.45), L = (1.6 + rnd(p, i + 30) * 1.8) * s;
            const end = [Math.cos(a) * L, y + L * 0.6, Math.sin(a) * L];
            K.tube(M.bark, [0, y, 0], end, 0.09 * s, 5, [0.7, 0.68, 0.64], 0.03 * s);
            if (!dead) PROPS._shrub(K, { x: p.x + end[0], z: p.z + end[2] }, 1.2 * s, end);
        }
        if (!dead) PROPS._shrub(K, { x: p.x, z: p.z + 1 }, 1.8 * s, [0, h, 0]);
    },
    deadtree(K, p) { PROPS.tree(K, p); },
    _shrub(K, p, r, at = [0, 0.6, 0]) {
        const M = mats();
        for (let i = 0; i < 5; i++) {
            const a = rnd(p, i) * 6.28, d = rnd(p, i + 1) * r * 0.6;
            const cx = at[0] + Math.cos(a) * d, cy = at[1] + rnd(p, i + 2) * r * 0.5, cz = at[2] + Math.sin(a) * d, rr = r * (0.45 + rnd(p, i + 3) * 0.3);
            const col = rnd(p, i + 4) < 0.4 ? C.deadleaf : C.leaf;
            K.at(cx, cy, cz, rnd(p, i + 5) * 6, () => K.cyl(M.leaves, 0, -rr * 0.6, 0, rr, rr * 1.3, 6, col, rr * 0.2));
        }
    },
    fountain(K, p) { PROPS.mallfountain(K, p); },
    swings(K, p) { const M = mats(); for (const x of [-1.5, 1.5]) { K.tube(M.rust, [x, 0, -0.8], [x, 2.4, 0], 0.05, 5, C.rust); K.tube(M.rust, [x, 0, 0.8], [x, 2.4, 0], 0.05, 5, C.rust); } K.tube(M.rust, [-1.5, 2.4, 0], [1.5, 2.4, 0], 0.05, 5, C.rust); for (const x of [-0.6, 0.6]) { K.tube(M.metal, [x - 0.2, 2.4, 0], [x - 0.2, 0.5, 0.1], 0.01, 4, C.grey); K.tube(M.metal, [x + 0.2, 2.4, 0], [x + 0.2, 0.5, 0.1], 0.01, 4, C.grey); K.box(M.wood, x, 0.48, 0.1, 0.5, 0.04, 0.2, [0.4, 0.3, 0.2]); } },
    slide(K, p) { const M = mats(); K.box(M.rust, 0, 0, -1, 0.8, 1.8, 0.8, C.rust); K.quad(M.paint, [-0.35, 1.8, -0.6], [0.35, 1.8, -0.6], [0.35, 0.1, 1.8], [-0.35, 0.1, 1.8], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.6, 0.5, 0.2]); },
    hoop(K, p) { const M = mats(); K.tube(M.metal, [0, 0, 0], [0, 3, 0], 0.06, 6, C.grey); K.box(M.paint, 0, 2.8, 0.3, 1.2, 0.8, 0.05, C.white); },
    sign(K, p) { const M = mats(); K.box(M.wood, 0, 0, 0, 0.08, 1.2, 0.08, C.dark); K.box(M.paint, 0, 1.0, 0.05, 1.2, 0.6, 0.03, [0.65, 0.6, 0.5]); },
    streetlight(K, p) { const M = mats(); K.cyl(M.metal, 0, 0, 0, 0.11, 6.5, 8, [0.32, 0.33, 0.32], 0.07); K.tube(M.metal, [0, 6.4, 0], [0, 6.7, 1.6], 0.05, 6, [0.32, 0.33, 0.32]); K.box(M.metal, 0, 6.55, 1.7, 0.3, 0.16, 0.6, [0.25, 0.25, 0.25]); K.box(p.on ? M.glow : M.glass, 0, 6.5, 1.7, 0.24, 0.05, 0.5, p.on ? [1, 0.78, 0.45] : [0.4, 0.4, 0.38]); },
    flood(K, p) { const M = mats(); K.cyl(M.metal, 0, 0, 0, 0.12, 8, 8, C.grey); K.box(M.metal, 0, 8, 0.2, 1.2, 0.5, 0.3, C.dark); K.box(M.glow, 0, 8.05, 0.36, 1.0, 0.4, 0.02, [1, 0.95, 0.8]); },
    signal(K, p) { const M = mats(); K.cyl(M.metal, 0, 0, 0, 0.08, 3.6, 8, [0.3, 0.32, 0.28]); K.box(M.paint, 0, 3.0, 0.2, 0.35, 1.0, 0.3, [0.2, 0.22, 0.18]); for (let i = 0; i < 3; i++) K.cyl(i === 1 && p.blink ? M.glow : M.glass, 0, 3.15 + i * 0.3, 0.35, 0.09, 0.02, 10, i === 1 && p.blink ? [1, 0.55, 0.1] : [0.2, 0.2, 0.18]); },
    hydrant(K, p) { const M = mats(); K.cyl(M.paint, 0, 0, 0, 0.14, 0.7, 10, [0.55, 0.15, 0.1]); K.cyl(M.paint, 0, 0.7, 0, 0.16, 0.1, 10, [0.55, 0.15, 0.1], 0.05); },
    bin(K, p) { const M = mats(); K.cyl(M.metal, 0, 0, 0, 0.3, 0.9, 10, [0.25, 0.3, 0.26], 0.33); },
    shelter(K, p) { const M = mats(); K.box(M.metal, 0, 2.3, 0, 3.0, 0.1, 1.4, [0.3, 0.32, 0.3]); for (const x of [-1.45, 1.45]) K.box(M.metal, x, 0, -0.6, 0.08, 2.3, 0.08, C.grey); K.box(M.glass, 0, 0.1, -0.65, 2.9, 2.1, 0.03, [0.4, 0.45, 0.45]); K.box(M.wood, 0, 0.45, -0.4, 2.4, 0.05, 0.35, [0.4, 0.3, 0.2]); },
    trash(K, p) { PROPS.debris(K, p); PROPS.papers(K, p); },
    phone(K, p) { const M = mats(); K.box(M.metal, 0, 0, 0, 0.8, 2.2, 0.8, [0.3, 0.32, 0.36]); K.box(M.glass, 0, 0.2, 0.41, 0.7, 1.8, 0.02, [0.4, 0.45, 0.45]); K.box(M.glow, 0, 2.05, 0.41, 0.6, 0.12, 0.02, [0.7, 0.75, 0.6]); },
    newsbox(K, p) { const M = mats(); K.box(M.paint, 0, 0, 0, 0.5, 1.0, 0.45, [0.6, 0.15, 0.12]); K.box(M.glass, 0, 0.55, 0.23, 0.4, 0.35, 0.01, [0.6, 0.6, 0.55]); },
    mailbox(K, p) { const M = mats(); K.box(M.wood, 0, 0, 0, 0.08, 1.0, 0.08, C.dark); K.box(M.metal, 0, 1.0, 0, 0.25, 0.25, 0.5, C.grey); },
    barrel(K, p) { const M = mats(); K.cyl(M.rust, 0, 0, 0, 0.3, 0.9, 10, [0.45 + rnd(p) * 0.3, 0.35, 0.2]); },
    pallet(K, p) { const M = mats(); K.box(M.wood, 0, 0, 0, 1.2, 0.14, 1.0, [0.55, 0.45, 0.3]); },
    tyres(K, p) { const M = mats(); for (let i = 0; i < 3; i++) K.cyl(M.plain, 0, i * 0.22, 0, 0.35, 0.2, 12, C.dark); },
    trike(K, p) { const M = mats(); K.box(M.paint, 0, 0.3, 0, 0.1, 0.1, 0.6, [0.6, 0.15, 0.12]); K.at(0, 0.25, 0.3, Math.PI / 2, () => K.tube(M.plain, [0, 0, -0.03], [0, 0, 0.03], 0.25, 10, C.dark)); },
    mower(K, p) { const M = mats(); K.box(M.paint, 0, 0.1, 0, 0.5, 0.25, 0.6, [0.2, 0.4, 0.2]); K.tube(M.metal, [0, 0.3, -0.3], [0, 1.0, -0.8], 0.02, 4, C.grey); },
    tower(K, p) {
        const M = mats(), s = p.s ?? 1;
        for (let i = 0; i < 10; i++) { const t0 = i / 10, t1 = (i + 1) / 10; const r = (t) => (3.4 - Math.sin(t * Math.PI) * 1.2) * s; K.cyl(M.conc, 0, t0 * 16 * s, 0, r(t0), 1.6 * s, 18, [0.6, 0.58, 0.55], r(t1), false); }
    },
    pipes(K, p) { const M = mats(); for (let i = 0; i < 3; i++) { K.tube(M.rust, [-24, 2 + i * 0.6, 0], [24, 2 + i * 0.6, 0], 0.25, 8, C.rust); } for (let x = -24; x <= 24; x += 6) K.box(M.rust, x, 0, 0, 0.3, 3.6, 0.3, C.rust); },
    vending(K, p) {
        const M = mats();
        K.box(M.paint, 0, 0, -0.6, 1.0, 1.95, 0.8, [0.55, 0.12, 0.1]);
        K.quad(M.vend, [-0.42, 0.55, -0.195], [0.42, 0.55, -0.195], [0.42, 1.85, -0.195], [-0.42, 1.85, -0.195], [[0, 0.14], [1, 0.14], [1, 1], [0, 1]], [1, 1, 1]);
        K.box(M.metal, 0, 0.2, -0.21, 0.6, 0.18, 0.04, C.dark);
    },
    lotlines(K, p) {},
};

/** Build one prop into a kit at its place. */
export function buildProp(K, p, ox = 0, oy = 0, oz = 0) {
    const f = PROPS[p.k];
    if (!f) return false;
    K.at(ox + p.x, oy + (p.y ?? 0), oz + p.z, p.r ?? 0, () => f(K, p));
    return true;
}

/** Prop kinds that glow (for the bloom and the light pool). */
export const GLOWS = new Set(['vending', 'phone', 'streetlight', 'flood']);
export { decal, surface };
