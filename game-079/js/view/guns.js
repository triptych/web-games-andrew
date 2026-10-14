// Gun models from the gun object. The same object the sim rolled decides every part: the
// archetype's body, the maker's colours, extra barrels, mags, sights, fins, the element's glow.
// Barrel along -z, grip near the origin, about 0.5–1.1 m long.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../rng.js';
import { ELEMENT_COLOR, RARITY } from '../config.js';

const PALETTE = {
    kane: { body: 0x3d4a2e, metal: 0x2b2d31, accent: 0xc8a050, wood: 0x5a3418 },
    neon: { body: 0xff3fa4, metal: 0xd8dce8, accent: 0x2ef2ff, wood: 0x1a1a24 },
    xerxid: { body: 0x4a1f6a, metal: 0x2a1838, accent: 0x9cff2e, wood: 0x3a1050 },
    bubba: { body: 0x7a3a1c, metal: 0x5a5148, accent: 0xbfbfbf, wood: 0x6a4020 },
    tokyo: { body: 0xf2f2f5, metal: 0x202024, accent: 0xff2030, wood: 0x2a2a30 },
};

const cache = new Map();
function g(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }
const rbox = (w, h, d, r = 0.012) => g(`rb${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const cyl = (r1, r2, l, seg = 16) => g(`cy${r1}_${r2}_${l}_${seg}`, () => new THREE.CylinderGeometry(r1, r2, l, seg).rotateX(Math.PI / 2));
const torus = (r, t) => g(`to${r}_${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));

function glow(color, k = 2.6) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }); }

export function buildGun(gun) {
    const rng = makeRng(gun.seed ^ 0x9e37);
    const P = PALETTE[gun.maker];
    const root = new THREE.Group();
    const elemCol = gun.element ? ELEMENT_COLOR[gun.element] : '#' + P.accent.toString(16).padStart(6, '0');
    const M = {
        body: new THREE.MeshStandardMaterial({ color: P.body, roughness: gun.maker === 'neon' || gun.maker === 'tokyo' ? 0.25 : 0.55, metalness: gun.maker === 'neon' ? 0.6 : 0.3, envMapIntensity: 1.0 }),
        metal: new THREE.MeshStandardMaterial({ color: P.metal, roughness: 0.28, metalness: 0.95, envMapIntensity: 1.3 }),
        accent: new THREE.MeshStandardMaterial({ color: P.accent, roughness: 0.3, metalness: 0.7, envMapIntensity: 1.2 }),
        wood: new THREE.MeshStandardMaterial({ color: P.wood, roughness: 0.6, metalness: 0.05 }),
        gold: new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.15, metalness: 1, envMapIntensity: 1.6 }),
        glow: glow(elemCol, gun.element ? 2.8 : 2.0),
    };
    if (gun.maker === 'xerxid') M.body.emissive = new THREE.Color(0x1a0630);
    const trim = gun.rarity >= 4 ? M.gold : M.accent;
    const add = (geo, mat, p, r = [0, 0, 0], s = [1, 1, 1], parent = root) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
        parent.add(m);
        return m;
    };
    const parts = new Set(gun.parts);
    const twin = parts.has('twin');
    const out = { root, muzzle: new THREE.Object3D(), spin: null, coils: [], disc: null, glowMat: M.glow };
    let len = 0.5, barrelY = 0.03;

    // grip and trigger guard, shared by everything
    add(rbox(0.05, 0.14, 0.07), M.body, [0, -0.1, 0.03], [0.25, 0, 0]);
    add(torus(0.035, 0.006), M.metal, [0, -0.05, -0.04], [0, Math.PI / 2, 0], [1, 1, 1]);

    switch (gun.arch) {
        case 'pistol': {
            len = 0.3 + rng() * 0.06;
            add(rbox(0.06, 0.09, len), M.body, [0, 0, -len / 2 + 0.08]);
            add(rbox(0.062, 0.05, len * 0.95, 0.01), M.metal, [0, 0.06, -len / 2 + 0.07]);
            for (let k = 0; k < 6; k++) add(rbox(0.064, 0.035, 0.008, 0.002), M.body, [0, 0.07, 0.04 - k * 0.012]);
            add(cyl(0.015, 0.015, 0.1), M.metal, [0, 0.05, -len + 0.04]);
            barrelY = 0.05; len += 0.0;
            break;
        }
        case 'shotgun': {
            len = 0.75 + rng() * 0.15;
            add(rbox(0.08, 0.1, 0.32), M.body, [0, 0.01, -0.1]);
            const n = twin ? 2 : 1;
            for (let k = 0; k < n; k++) add(cyl(0.024, 0.024, len - 0.2), M.metal, [(k - (n - 1) / 2) * 0.05, 0.045, -0.2 - (len - 0.2) / 2]);
            add(cyl(0.032, 0.032, 0.24, 12), M.wood, [0, -0.01, -0.45]);                   // the pump
            for (let k = 0; k < 5; k++) add(torus(0.033, 0.004), M.metal, [0, -0.01, -0.35 - k * 0.05]);
            add(rbox(0.06, 0.12, 0.3), M.wood, [0, -0.04, 0.2], [-0.2, 0, 0]);            // stock
            add(rbox(0.065, 0.13, 0.03), M.body, [0, -0.06, 0.35], [-0.2, 0, 0]);
            barrelY = 0.045;
            break;
        }
        case 'ripper': {
            len = 0.7 + rng() * 0.1;
            add(rbox(0.12, 0.12, 0.36), M.body, [0, 0.0, -0.08]);
            const spin = new THREE.Group();
            spin.position.set(0, 0.02, -0.26);
            root.add(spin);
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2;
                add(cyl(0.013, 0.013, len - 0.3, 8), M.metal, [Math.cos(a) * 0.035, Math.sin(a) * 0.035, -(len - 0.3) / 2], [0, 0, 0], [1, 1, 1], spin);
            }
            add(cyl(0.055, 0.055, 0.03, 16), M.metal, [0, 0, -(len - 0.3) + 0.03], [0, 0, 0], [1, 1, 1], spin);
            add(cyl(0.055, 0.055, 0.03, 16), M.metal, [0, 0, -0.04], [0, 0, 0], [1, 1, 1], spin);
            out.spin = spin;
            add(g('drum', () => new THREE.CylinderGeometry(0.09, 0.09, 0.06, 20).rotateZ(Math.PI / 2)), trim, [0.1, -0.03, -0.08]);
            add(rbox(0.02, 0.06, 0.16), M.metal, [0, 0.1, -0.05]);                              // carry handle
            barrelY = 0.02;
            break;
        }
        case 'rocket': {
            len = 0.95 + rng() * 0.1;
            add(cyl(0.085, 0.085, len, 20), M.body, [0, 0.06, -len / 2 + 0.2]);
            add(cyl(0.095, 0.075, 0.12, 20), M.metal, [0, 0.06, -len + 0.18]);
            add(cyl(0.075, 0.11, 0.14, 20), M.metal, [0, 0.06, 0.24]);
            add(g('warhead', () => new THREE.ConeGeometry(0.06, 0.14, 14).rotateX(-Math.PI / 2)), trim, [0, 0.06, -len + 0.13]);
            add(rbox(0.04, 0.06, 0.12), M.metal, [0.0, 0.17, -0.2]);                               // sight
            for (let k = 0; k < 3; k++) add(torus(0.088, 0.008), trim, [0, 0.06, -0.1 - k * 0.22]);
            if (twin) add(cyl(0.06, 0.06, len * 0.8, 16), M.body, [0.15, 0.06, -len / 2 + 0.15]);
            barrelY = 0.06;
            break;
        }
        case 'photon': {
            len = 0.7 + rng() * 0.1;
            add(rbox(0.07, 0.1, 0.42, 0.025), M.body, [0, 0.02, -0.12]);
            add(cyl(0.022, 0.03, len - 0.3, 14), M.metal, [0, 0.03, -0.32 - (len - 0.3) / 2]);
            for (let k = 0; k < 3; k++) out.coils.push(add(torus(0.04, 0.009), M.glow, [0, 0.03, -0.38 - k * 0.09]));
            add(cyl(0.025, 0.025, 0.16, 12), M.glow, [0.06, 0.0, -0.08]);                        // energy cell
            add(rbox(0.05, 0.14, 0.24), M.body, [0, -0.03, 0.18], [-0.15, 0, 0]);
            if (twin) add(cyl(0.02, 0.02, len - 0.35, 12), M.metal, [0, -0.03, -0.32 - (len - 0.35) / 2]);
            barrelY = 0.03;
            break;
        }
        case 'disc': {
            len = 0.6;
            add(rbox(0.09, 0.09, 0.45), M.body, [0, 0.0, -0.12]);
            add(rbox(0.12, 0.015, 0.36), M.metal, [0, 0.055, -0.2]);                             // the rail
            const disc = new THREE.Group();
            disc.position.set(0, 0.075, -0.2);
            root.add(disc);
            add(g('discMesh', () => new THREE.CylinderGeometry(0.11, 0.11, 0.012, 32)), M.metal, [0, 0, 0], [0, 0, 0], [1, 1, 1], disc);
            for (let k = 0; k < 12; k++) {
                const a = (k / 12) * Math.PI * 2;
                add(g('discTooth', () => new THREE.ConeGeometry(0.012, 0.03, 4).rotateZ(-Math.PI / 2)), trim, [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], [0, -a, 0], [1, 1, 1], disc);
            }
            add(g('discHub', () => new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16)), M.glow, [0, 0.005, 0], [0, 0, 0], [1, 1, 1], disc);
            out.disc = disc;
            add(rbox(0.05, 0.12, 0.2), M.body, [0, -0.03, 0.2], [-0.2, 0, 0]);
            barrelY = 0.075;
            break;
        }
        case 'tesla': {
            len = 0.6;
            add(rbox(0.09, 0.1, 0.38, 0.02), M.body, [0, 0.0, -0.08]);
            for (let k = 0; k < 6; k++) out.coils.push(add(torus(0.05 - k * 0.004, 0.01), k % 2 ? M.metal : M.glow, [0, 0.04, -0.28 - k * 0.04]));
            add(cyl(0.02, 0.02, 0.24, 10), M.metal, [0, 0.04, -0.38]);
            add(g('teslaBall', () => new THREE.SphereGeometry(0.045, 18, 14)), M.glow, [0, 0.04, -0.53]);
            for (const s of [-1, 1]) add(cyl(0.012, 0.012, 0.3, 8), trim, [0.06 * s, 0.07, -0.25]);
            barrelY = 0.04;
            break;
        }
    }
    // part dressing
    if (parts.has('extmag')) add(g('drumMag', () => new THREE.CylinderGeometry(0.06, 0.06, 0.05, 18).rotateZ(Math.PI / 2)), trim, [0, -0.08, -0.12]);
    else add(rbox(0.04, 0.11, 0.06), M.metal, [0, -0.09, -0.12], [0.15, 0, 0]);
    if (parts.has('laser')) {
        add(rbox(0.025, 0.025, 0.08), M.metal, [0, -0.04, -0.28]);
        add(g('laserDot', () => new THREE.SphereGeometry(0.008, 8, 6)), glow(0xff1010, 4), [0, -0.04, -0.325]);
    }
    if (parts.has('homing')) {
        add(g('dish', () => new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2)), M.metal, [0.07, 0.1, -0.1]);
        add(cyl(0.005, 0.005, 0.05, 6), M.metal, [0.07, 0.1, -0.12]);
    }
    if (parts.has('explosive')) for (let k = 0; k < 3; k++) add(torus(0.03 + (gun.arch === 'rocket' ? 0.06 : 0), 0.008), k % 2 ? M.metal : M.accent, [0, barrelY, -len * 0.6 - k * 0.02]);
    if (parts.has('vampiric')) add(g('vial', () => new THREE.CapsuleGeometry(0.018, 0.06, 4, 10).rotateX(Math.PI / 2)), glow(0xff1030, 2.5), [-0.06, 0.03, -0.1]);
    if (parts.has('overclock')) for (let k = 0; k < 5; k++) add(rbox(0.11, 0.004, 0.02, 0.001), M.metal, [0, barrelY + 0.035, -0.2 - k * 0.04]);
    if (parts.has('heavy')) add(cyl(0.03, 0.03, 0.07, 10), M.metal, [0, barrelY, -len - 0.02]);
    if (parts.has('quick')) add(rbox(0.01, 0.04, 0.12), trim, [0.045, 0.0, -0.05]);
    if (gun.maker === 'tokyo' || parts.has('laser')) {
        add(cyl(0.022, 0.022, 0.16, 14), M.metal, [0, 0.11, -0.1]);                                 // scope
        add(g('lens', () => new THREE.CircleGeometry(0.02, 14)), glow(0x40c0ff, 1.5), [0, 0.11, -0.181], [0, Math.PI, 0]);
    }
    if (gun.maker === 'bubba') for (let k = 0; k < 2; k++) add(rbox(0.1, 0.11, 0.03, 0.004), M.accent, [0, 0, -0.05 - k * 0.15], [0, 0, 0.1 * (k ? 1 : -1)]);
    if (gun.maker === 'xerxid') for (let k = 0; k < 4; k++) add(g('nodule', () => new THREE.SphereGeometry(0.02, 10, 8)), M.glow, [0.045 * (k % 2 ? 1 : -1), 0.03, -0.05 - k * 0.07]);
    // an element strip along the side; legendaries get a second gold one
    add(rbox(0.006, 0.012, Math.max(0.12, len * 0.35), 0.002), M.glow, [0.05, 0.0, -len * 0.3]);
    if (gun.rarity >= 4) add(rbox(0.006, 0.012, Math.max(0.12, len * 0.35), 0.002), M.gold, [-0.05, 0.0, -len * 0.3]);
    out.muzzle.position.set(0, barrelY, -len - 0.04);
    root.add(out.muzzle);
    out.len = len;
    out.mats = M;
    root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    return out;
}

/** CSS colour of a rarity tier. */
export const rarityColor = (r) => RARITY[r].color;
