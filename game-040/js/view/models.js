/**
 * models.js — every ship in the game, built from primitives at runtime.
 * No asset files, in keeping with the rest of this repo.
 *
 * Conventions:
 *  - the playfield is the XY plane; +y is up the screen
 *  - the player's ship faces +y, enemies face -y (ConeGeometry points +y, so
 *    enemy hulls get rotation.z = PI)
 *  - anything that should bloom uses an emissive standard material or an
 *    additive basic material; the UnrealBloomPass does the rest
 */

import * as THREE from 'three';
import { COLORS } from '../core/config.js';

const geoCache = new Map();
/**
 * Geometries are built once per shape and shared by every mesh that uses them.
 * They are therefore flagged `shared`, and scene.disposeObject() refuses to
 * dispose those: disposing a shared geometry when one enemy dies would free the
 * GPU buffer out from under every other enemy of that type. (This bug was real;
 * dev/rendertest.mjs caught it.)
 */
function cached(key, make) {
    if (!geoCache.has(key)) {
        const geo = make();
        geo.userData = { ...(geo.userData ?? {}), shared: true };
        geoCache.set(key, geo);
    }
    return geoCache.get(key);
}

export function hull(color, emissive = 0x000000, opts = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        metalness: opts.metalness ?? 0.35,
        roughness: opts.roughness ?? 0.45,
        transparent: !!opts.transparent,
        opacity: opts.opacity ?? 1,
        ...(opts.extra ?? {}),
    });
}

export function glow(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
}

function edges(mesh, color, opacity = 0.55) {
    const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    line.scale.copy(mesh.scale);
    return line;
}

function add(group, mesh, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
}

// ------------------------------------------------------------------ the player

export function makePlayerShip() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        cached('p-body', () => new THREE.ConeGeometry(0.42, 1.7, 4)),
        hull(0xdfe8ff, 0x1a3a5a, { metalness: 0.5, roughness: 0.3 }),
    );
    add(g, body, { y: 0.15 });
    g.add(edges(body, 0x9fe8ff, 0.6));

    // wings
    const wingGeo = cached('p-wing', () => new THREE.ConeGeometry(0.28, 1.1, 3));
    add(g, new THREE.Mesh(wingGeo, hull(0x8fb4ff, 0x123050)), { x: -0.62, y: -0.2, rz: 0.55, sy: 0.9 });
    add(g, new THREE.Mesh(wingGeo, hull(0x8fb4ff, 0x123050)), { x: 0.62, y: -0.2, rz: -0.55, sy: 0.9 });

    // cockpit
    const canopy = add(g, new THREE.Mesh(
        cached('p-canopy', () => new THREE.SphereGeometry(0.22, 12, 8)),
        hull(0x7ef2ff, 0x2fb0d8, { emissiveIntensity: 1.6, metalness: 0.1, roughness: 0.1 }),
    ), { y: 0.35, z: 0.22, sy: 1.5 });

    // tow hook — the reason this ship matters
    const hook = add(g, new THREE.Mesh(
        cached('p-hook', () => new THREE.TorusGeometry(0.3, 0.06, 6, 14, Math.PI * 1.4)),
        hull(0xffd166, 0x7a5410),
    ), { y: -0.75, rx: Math.PI / 2, rz: Math.PI * 0.2 });

    // engines
    const engineGeo = cached('p-engine', () => new THREE.ConeGeometry(0.17, 0.9, 8));
    const e1 = add(g, new THREE.Mesh(engineGeo, glow(0x7ef2ff, 0.9)), { x: -0.26, y: -1.0, rz: Math.PI });
    const e2 = add(g, new THREE.Mesh(engineGeo, glow(0x7ef2ff, 0.9)), { x: 0.26, y: -1.0, rz: Math.PI });

    // the hitbox dot: what actually collides, always drawn, bright in focus mode
    const dot = add(g, new THREE.Mesh(
        cached('p-dot', () => new THREE.SphereGeometry(0.17, 12, 10)),
        glow(0xffffff, 0.85),
    ), { z: 0.5 });
    const focusRing = add(g, new THREE.Mesh(
        cached('p-focus', () => new THREE.RingGeometry(0.5, 0.62, 28)),
        glow(0x7ef2ff, 0.0),
    ), { z: 0.45 });

    // --- boost visuals, all hidden until the matching boost is active ---
    // A shield bubble large enough to read as a bubble, but still transparent
    // enough to see bullets through — you must be able to dodge while shielded.
    const shieldBubble = add(g, new THREE.Mesh(
        cached('p-shield', () => new THREE.SphereGeometry(1.15, 16, 12)),
        glow(COLORS.shield, 0.0),
    ), {});
    const shieldRing = add(g, new THREE.Mesh(
        cached('p-shield-ring', () => new THREE.RingGeometry(1.1, 1.26, 32)),
        glow(COLORS.shield, 0.0),
    ), { z: 0.2 });
    // Invulnerability is a different shape from the shield on purpose: a pair
    // of counter-rotating rings, not a sphere, so you can tell which you have.
    const invulnRings = [0, 1].map((i) => add(g, new THREE.Mesh(
        cached('p-inv-ring', () => new THREE.TorusGeometry(0.95, 0.07, 6, 24)),
        glow(COLORS.invulnItem, 0.0),
    ), { rx: i ? Math.PI / 2.6 : 0, ry: i ? Math.PI / 3 : 0 }));
    const speedTrail = add(g, new THREE.Mesh(
        cached('p-trail', () => new THREE.ConeGeometry(0.5, 2.6, 10, 1, true)),
        glow(COLORS.speedItem, 0.0),
    ), { y: -1.7, rz: Math.PI });
    const rocketPods = [-1, 1].map((sx) => add(g, new THREE.Mesh(
        cached('p-pod', () => new THREE.CylinderGeometry(0.11, 0.14, 0.5, 6)),
        glow(COLORS.rocket, 0.0),
    ), { x: sx * 0.62, y: 0.1 }));

    g.userData = {
        engines: [e1, e2], dot, focusRing, canopy, hook,
        shieldBubble, shieldRing, invulnRings, speedTrail, rocketPods,
    };
    return g;
}

export function makeDrone() {
    const g = new THREE.Group();
    const body = add(g, new THREE.Mesh(
        cached('d-body', () => new THREE.OctahedronGeometry(0.3)),
        hull(0x8effc0, 0x1a6a4a),
    ), {});
    const ring = add(g, new THREE.Mesh(
        cached('d-ring', () => new THREE.TorusGeometry(0.4, 0.04, 6, 18)),
        glow(0x8effc0, 0.8),
    ), { rx: Math.PI / 2 });
    g.userData = { body, ring };
    return g;
}

// ------------------------------------------------------------------- enemies

const ENEMY_BUILDERS = {
    drone(color) {
        const g = new THREE.Group();
        const m = add(g, new THREE.Mesh(
            cached('e-drone', () => new THREE.OctahedronGeometry(0.55, 0)), hull(color, color, { emissiveIntensity: 0.35 })), {});
        g.add(edges(m, color, 0.7));
        add(g, new THREE.Mesh(cached('e-drone-eye', () => new THREE.SphereGeometry(0.16, 10, 8)),
            glow(0xfff2d0, 0.9)), { y: -0.28, z: 0.2 });
        return g;
    },

    skimmer(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-skim', () => new THREE.ConeGeometry(0.5, 1.1, 6)),
            hull(color, color, { emissiveIntensity: 0.3 })), { rz: Math.PI, sz: 0.55 });
        g.add(edges(body, 0xfff2d0, 0.45));
        const finGeo = cached('e-skim-fin', () => new THREE.BoxGeometry(0.7, 0.12, 0.1));
        add(g, new THREE.Mesh(finGeo, hull(0x2a2f44, color)), { y: 0.25, rz: 0.4 });
        add(g, new THREE.Mesh(finGeo, hull(0x2a2f44, color)), { y: 0.25, rz: -0.4 });
        add(g, new THREE.Mesh(cached('e-skim-eye', () => new THREE.SphereGeometry(0.13, 8, 6)),
            glow(0xffd166, 1)), { y: -0.5, z: 0.15 });
        return g;
    },

    lancer(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-lance', () => new THREE.ConeGeometry(0.34, 1.7, 4)),
            hull(color, color, { emissiveIntensity: 0.3 })), { rz: Math.PI });
        g.add(edges(body, 0xffd0c0, 0.5));
        const wing = cached('e-lance-wing', () => new THREE.ConeGeometry(0.22, 1.0, 3));
        add(g, new THREE.Mesh(wing, hull(0x3a2030, color)), { x: -0.45, y: 0.2, rz: 2.5 });
        add(g, new THREE.Mesh(wing, hull(0x3a2030, color)), { x: 0.45, y: 0.2, rz: -2.5 });
        add(g, new THREE.Mesh(cached('e-lance-jet', () => new THREE.ConeGeometry(0.14, 0.7, 7)),
            glow(color, 0.85)), { y: 0.95 });
        return g;
    },

    turret(color) {
        const g = new THREE.Group();
        add(g, new THREE.Mesh(
            cached('e-turret-base', () => new THREE.CylinderGeometry(0.62, 0.78, 0.5, 8)),
            hull(0x555f7a, 0x101828, { metalness: 0.7, roughness: 0.5 })), { y: 0.25 });
        const dome = add(g, new THREE.Mesh(
            cached('e-turret-dome', () => new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
            hull(color, color, { emissiveIntensity: 0.4 })), { y: -0.05, rz: Math.PI });
        g.add(edges(dome, 0xffffff, 0.35));
        const barrel = add(g, new THREE.Mesh(
            cached('e-turret-barrel', () => new THREE.CylinderGeometry(0.1, 0.13, 0.8, 8)),
            hull(0x8a95b5, 0x202840)), { y: -0.55 });
        add(g, new THREE.Mesh(cached('e-turret-eye', () => new THREE.SphereGeometry(0.14, 8, 6)),
            glow(0xff6b6b, 0.9)), { y: -0.15, z: 0.4 });
        g.userData = { barrel, spin: dome };
        return g;
    },

    weaver(color) {
        const g = new THREE.Group();
        const ring = add(g, new THREE.Mesh(
            cached('e-weaver-ring', () => new THREE.TorusGeometry(0.5, 0.13, 8, 20)),
            hull(color, color, { emissiveIntensity: 0.6 })), {});
        const core = add(g, new THREE.Mesh(
            cached('e-weaver-core', () => new THREE.IcosahedronGeometry(0.3, 0)),
            glow(0xfff2d0, 0.95)), {});
        add(g, new THREE.Mesh(cached('e-weaver-ring2', () => new THREE.TorusGeometry(0.66, 0.05, 6, 22)),
            glow(color, 0.6)), { rx: Math.PI / 2.4 });
        g.userData = { ring, core };
        return g;
    },

    popper(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-popper', () => new THREE.IcosahedronGeometry(0.5, 0)),
            hull(color, color, { emissiveIntensity: 0.55 })), {});
        g.add(edges(body, 0xffffff, 0.5));
        const spikes = cached('e-popper-spike', () => new THREE.ConeGeometry(0.1, 0.42, 5));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            add(g, new THREE.Mesh(spikes, hull(0xfff2d0, color)),
                { x: Math.cos(a) * 0.52, y: Math.sin(a) * 0.52, rz: -a + Math.PI / 2 });
        }
        g.userData = { body, pulse: true };
        return g;
    },

    shieldbearer(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-shieldb', () => new THREE.BoxGeometry(1.0, 0.9, 0.6)),
            hull(0x33507a, color, { emissiveIntensity: 0.3 })), {});
        g.add(edges(body, color, 0.5));
        // the shield plate is the tell: it is visibly on the underside
        const shield = add(g, new THREE.Mesh(
            cached('e-shieldb-plate', () => new THREE.CylinderGeometry(0.95, 0.95, 0.12, 20, 1, false, 0, Math.PI)),
            glow(color, 0.55)), { y: -0.55, rx: Math.PI / 2, rz: Math.PI });
        add(g, new THREE.Mesh(cached('e-shieldb-eye', () => new THREE.SphereGeometry(0.15, 8, 6)),
            glow(0xffd166, 0.9)), { y: -0.2, z: 0.35 });
        g.userData = { shield, body };
        return g;
    },

    sniper(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-sniper', () => new THREE.CylinderGeometry(0.22, 0.4, 1.5, 7)),
            hull(color, color, { emissiveIntensity: 0.3 })), { rz: Math.PI });
        g.add(edges(body, 0xffd0d8, 0.5));
        const lens = add(g, new THREE.Mesh(
            cached('e-sniper-lens', () => new THREE.SphereGeometry(0.2, 10, 8)),
            glow(0xff3860, 1)), { y: -0.7 });
        const fin = cached('e-sniper-fin', () => new THREE.BoxGeometry(0.1, 0.7, 0.5));
        add(g, new THREE.Mesh(fin, hull(0x2b1a2a, color)), { x: -0.32, y: 0.4 });
        add(g, new THREE.Mesh(fin, hull(0x2b1a2a, color)), { x: 0.32, y: 0.4 });
        g.userData = { lens };
        return g;
    },

    carrier(color) {
        const g = new THREE.Group();
        const hullMesh = add(g, new THREE.Mesh(
            cached('e-carrier', () => new THREE.BoxGeometry(2.6, 1.5, 0.9)),
            hull(0x4a4270, color, { emissiveIntensity: 0.25 })), {});
        g.add(edges(hullMesh, color, 0.45));
        const bay = cached('e-carrier-bay', () => new THREE.BoxGeometry(0.5, 0.35, 0.5));
        for (let i = -1; i <= 1; i++) {
            add(g, new THREE.Mesh(bay, glow(0xffd166, 0.75)), { x: i * 0.8, y: -0.78 });
        }
        add(g, new THREE.Mesh(cached('e-carrier-spine', () => new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8)),
            hull(0x8a7fd0, color)), { rz: Math.PI / 2, y: 0.6 });
        g.userData = { hullMesh };
        return g;
    },

    minelayer(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-mine-body', () => new THREE.CylinderGeometry(0.6, 0.6, 0.45, 6)),
            hull(color, color, { emissiveIntensity: 0.4 })), { rx: Math.PI / 2 });
        g.add(edges(body, 0xfff2d0, 0.45));
        const pod = cached('e-mine-pod', () => new THREE.SphereGeometry(0.17, 8, 6));
        for (let i = 0; i < 3; i++) {
            add(g, new THREE.Mesh(pod, glow(0xff6b6b, 0.85)),
                { x: (i - 1) * 0.42, y: -0.42 });
        }
        g.userData = { body };
        return g;
    },

    reaver(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-reaver', () => new THREE.ConeGeometry(0.55, 1.5, 3)),
            hull(color, color, { emissiveIntensity: 0.5 })), { rz: Math.PI });
        g.add(edges(body, 0xffd0d8, 0.6));
        const blade = cached('e-reaver-blade', () => new THREE.BoxGeometry(1.5, 0.1, 0.25));
        add(g, new THREE.Mesh(blade, hull(0x5a1020, color)), { y: 0.1, rz: 0.22 });
        add(g, new THREE.Mesh(cached('e-reaver-jet', () => new THREE.ConeGeometry(0.2, 0.9, 7)),
            glow(0xff4f6e, 0.9)), { y: 0.95 });
        return g;
    },

    bloom(color) {
        const g = new THREE.Group();
        const core = add(g, new THREE.Mesh(
            cached('e-bloom-core', () => new THREE.SphereGeometry(0.42, 14, 10)),
            hull(color, color, { emissiveIntensity: 0.8 })), {});
        const petals = [];
        const petalGeo = cached('e-bloom-petal', () => new THREE.ConeGeometry(0.22, 0.8, 5));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            petals.push(add(g, new THREE.Mesh(petalGeo, hull(0xffd0f0, color, { emissiveIntensity: 0.5 })),
                { x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5, rz: -a + Math.PI / 2 }));
        }
        g.userData = { core, petals };
        return g;
    },

    choirling(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-choir', () => new THREE.TetrahedronGeometry(0.55)),
            hull(color, color, { emissiveIntensity: 0.6 })), {});
        g.add(edges(body, 0xffffff, 0.6));
        const halo = add(g, new THREE.Mesh(
            cached('e-choir-halo', () => new THREE.TorusGeometry(0.62, 0.045, 6, 22)),
            glow(0xfff2d0, 0.8)), { rx: Math.PI / 2 });
        g.userData = { body, halo };
        return g;
    },

    seraph(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('e-seraph', () => new THREE.ConeGeometry(0.7, 2.2, 6)),
            hull(0xf0e4c0, color, { emissiveIntensity: 0.4 })), { rz: Math.PI });
        g.add(edges(body, 0xfff2d0, 0.55));
        const wingGeo = cached('e-seraph-wing', () => new THREE.BoxGeometry(1.5, 0.5, 0.14));
        const wl = add(g, new THREE.Mesh(wingGeo, hull(0xc8b88a, color, { emissiveIntensity: 0.4 })),
            { x: -1.15, y: 0.15, rz: 0.2 });
        const wr = add(g, new THREE.Mesh(wingGeo, hull(0xc8b88a, color, { emissiveIntensity: 0.4 })),
            { x: 1.15, y: 0.15, rz: -0.2 });
        const core = add(g, new THREE.Mesh(
            cached('e-seraph-core', () => new THREE.IcosahedronGeometry(0.34, 0)),
            glow(0xffffff, 0.95)), { y: -0.2, z: 0.3 });
        for (let i = 0; i < 3; i++) {
            add(g, new THREE.Mesh(cached('e-seraph-ring', () => new THREE.TorusGeometry(0.9 + i * 0.22, 0.03, 6, 24)),
                glow(color, 0.45 - i * 0.1)), { rx: Math.PI / 2.2, rz: i * 0.4 });
        }
        g.userData = { core, wings: [wl, wr] };
        return g;
    },
};

export function makeEnemyModel(type, color) {
    const build = ENEMY_BUILDERS[type];
    if (!build) return ENEMY_BUILDERS.drone(color);
    return build(color);
}

// --------------------------------------------------------------------- bosses

const BOSS_BUILDERS = {
    tarpon(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('b-tarpon', () => new THREE.BoxGeometry(4.2, 2.4, 1.4)),
            hull(0x6a6a7f, color, { emissiveIntensity: 0.25, metalness: 0.8, roughness: 0.5 })), {});
        g.add(edges(body, 0xffb066, 0.5));
        const cab = add(g, new THREE.Mesh(
            cached('b-tarpon-cab', () => new THREE.BoxGeometry(1.5, 1.0, 1.0)),
            hull(0x33384a, 0xffb066, { emissiveIntensity: 0.5 })), { y: 1.2, z: 0.3 });
        const armGeo = cached('b-tarpon-arm', () => new THREE.BoxGeometry(0.5, 2.6, 0.5));
        const clawGeo = cached('b-tarpon-claw', () => new THREE.ConeGeometry(0.45, 1.1, 4));
        const arms = [];
        for (const side of [-1, 1]) {
            const arm = new THREE.Group();
            add(arm, new THREE.Mesh(armGeo, hull(0x8a8a9f, 0x402810)), { y: -1.3 });
            add(arm, new THREE.Mesh(clawGeo, hull(0xffb066, 0xff7a2a, { emissiveIntensity: 0.8 })),
                { y: -2.8, rz: Math.PI });
            arm.position.set(side * 2.2, -0.3, 0.2);
            g.add(arm);
            arms.push(arm);
        }
        const core = add(g, new THREE.Mesh(
            cached('b-core', () => new THREE.SphereGeometry(0.62, 14, 10)),
            glow(0xffd166, 0.9)), { z: 0.75 });
        g.userData = { arms, core };
        return g;
    },

    nimbus(color) {
        const g = new THREE.Group();
        const disc = add(g, new THREE.Mesh(
            cached('b-nimbus', () => new THREE.CylinderGeometry(2.6, 1.9, 1.1, 14)),
            hull(0xc8b487, color, { emissiveIntensity: 0.35 })), { rx: Math.PI / 2 });
        g.add(edges(disc, 0xffe6b0, 0.4));
        const vanes = [];
        const vaneGeo = cached('b-nimbus-vane', () => new THREE.BoxGeometry(1.6, 0.25, 0.5));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            vanes.push(add(g, new THREE.Mesh(vaneGeo, hull(0x8a7a50, color, { emissiveIntensity: 0.5 })),
                { x: Math.cos(a) * 2.6, y: Math.sin(a) * 2.6, rz: a }));
        }
        const core = add(g, new THREE.Mesh(
            cached('b-nimbus-core', () => new THREE.IcosahedronGeometry(0.85, 1)),
            glow(0xfff0c0, 0.95)), { z: 0.6 });
        g.userData = { vanes, core, disc };
        return g;
    },

    ironmaw(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('b-ironmaw', () => new THREE.BoxGeometry(6.4, 2.6, 1.6)),
            hull(0x5c6478, color, { emissiveIntensity: 0.18, metalness: 0.85, roughness: 0.4 })), {});
        g.add(edges(body, 0xd8e0f0, 0.45));
        add(g, new THREE.Mesh(cached('b-ironmaw-prow', () => new THREE.ConeGeometry(1.2, 2.0, 4)),
            hull(0x7a8398, color)), { y: -2.0, rz: Math.PI });
        const core = add(g, new THREE.Mesh(
            cached('b-core', () => new THREE.SphereGeometry(0.62, 14, 10)),
            glow(0xff7a5a, 0.95)), { y: -0.2, z: 0.85, sx: 1.4, sy: 1.4, sz: 1.4 });
        g.userData = { core, partMeshes: {} };
        return g;
    },

    choirmaster(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('b-choir', () => new THREE.IcosahedronGeometry(2.2, 1)),
            hull(0x6a3f8a, color, { emissiveIntensity: 0.5, roughness: 0.75 })), {});
        g.add(edges(body, 0xd6a8ff, 0.35));
        const rings = [];
        for (let i = 0; i < 3; i++) {
            rings.push(add(g, new THREE.Mesh(
                cached(`b-choir-ring${i}`, () => new THREE.TorusGeometry(2.7 + i * 0.5, 0.07, 8, 40)),
                glow(i % 2 ? 0x8fd6ff : 0xffa8e8, 0.7)),
                { rx: 1.2 + i * 0.3, rz: i * 0.5 }));
        }
        const tendrils = [];
        const tGeo = cached('b-choir-tendril', () => new THREE.ConeGeometry(0.18, 1.8, 5));
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            tendrils.push(add(g, new THREE.Mesh(tGeo, hull(0xb07fd0, color, { emissiveIntensity: 0.6 })),
                { x: Math.cos(a) * 2.1, y: Math.sin(a) * 2.1, rz: -a + Math.PI / 2 }));
        }
        const core = add(g, new THREE.Mesh(
            cached('b-choir-core', () => new THREE.SphereGeometry(0.9, 16, 12)),
            glow(0xffffff, 0.9)), { z: 0.9 });
        g.userData = { rings, tendrils, core };
        return g;
    },

    kel(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('b-kel', () => new THREE.ConeGeometry(1.1, 4.0, 4)),
            hull(0xdfe8ff, 0x1a3a5a, { emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.25 })), { rz: Math.PI });
        g.add(edges(body, 0x9fe8ff, 0.6));
        // Chorus overgrowth: the shell you are actually shooting
        const shell = [];
        const shellGeo = cached('b-kel-shell', () => new THREE.IcosahedronGeometry(0.75, 0));
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            shell.push(add(g, new THREE.Mesh(shellGeo, hull(0x7a4a8a, 0xd6a8ff, { emissiveIntensity: 0.5, roughness: 0.9 })),
                { x: Math.cos(a) * 1.15, y: Math.sin(a) * 1.0, z: 0.25, sx: 0.9, sy: 0.9, sz: 0.7 }));
        }
        const wingGeo = cached('b-kel-wing', () => new THREE.BoxGeometry(2.4, 0.45, 0.18));
        add(g, new THREE.Mesh(wingGeo, hull(0x8fb4ff, 0x123050)), { x: -1.7, y: 0.4, rz: 0.25 });
        add(g, new THREE.Mesh(wingGeo, hull(0x8fb4ff, 0x123050)), { x: 1.7, y: 0.4, rz: -0.25 });
        const core = add(g, new THREE.Mesh(
            cached('b-core', () => new THREE.SphereGeometry(0.62, 14, 10)),
            glow(0x9fe8ff, 0.95)), { y: 0.3, z: 0.7 });
        g.userData = { shell, core };
        return g;
    },

    heart(color) {
        const g = new THREE.Group();
        const body = add(g, new THREE.Mesh(
            cached('b-heart', () => new THREE.SphereGeometry(2.4, 20, 16)),
            hull(0x8a1f52, color, { emissiveIntensity: 0.55, roughness: 0.85 })), { sy: 1.15 });
        const chambers = [];
        const cGeo = cached('b-heart-chamber', () => new THREE.SphereGeometry(1.1, 12, 10));
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            chambers.push(add(g, new THREE.Mesh(cGeo, hull(0xb03060, color, { emissiveIntensity: 0.6, roughness: 0.9 })),
                { x: Math.cos(a) * 2.1, y: Math.sin(a) * 2.1, z: -0.2 }));
        }
        const rings = [];
        for (let i = 0; i < 4; i++) {
            rings.push(add(g, new THREE.Mesh(
                cached(`b-heart-ring${i}`, () => new THREE.TorusGeometry(3.3 + i * 0.45, 0.06, 8, 48)),
                glow(i % 2 ? 0xffc46e : 0xff7fd0, 0.6)),
                { rx: 1.0 + i * 0.25, rz: i * 0.6 }));
        }
        const core = add(g, new THREE.Mesh(
            cached('b-heart-core', () => new THREE.IcosahedronGeometry(1.0, 1)),
            glow(0xffffff, 0.95)), { z: 1.4 });
        g.userData = { chambers, rings, core, body };
        return g;
    },
};

export function makeBossModel(id, color) {
    const build = BOSS_BUILDERS[id] ?? BOSS_BUILDERS.tarpon;
    return build(color);
}

export function makeBossPart(color) {
    const g = new THREE.Group();
    add(g, new THREE.Mesh(
        cached('bp-base', () => new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8)),
        hull(0x6a7488, 0x101828, { metalness: 0.8 })), {});
    add(g, new THREE.Mesh(
        cached('bp-barrel', () => new THREE.CylinderGeometry(0.13, 0.16, 1.0, 8)),
        hull(0xa8b4cc, 0x202840)), { y: -0.6 });
    const light = add(g, new THREE.Mesh(
        cached('bp-light', () => new THREE.SphereGeometry(0.2, 10, 8)),
        glow(0xff6b6b, 0.95)), { z: 0.45 });
    g.userData = { light };
    return g;
}

// ------------------------------------------------------------- pods & pickups

export function makePod() {
    const g = new THREE.Group();
    const shell = add(g, new THREE.Mesh(
        cached('pod-shell', () => new THREE.CapsuleGeometry
            ? new THREE.CapsuleGeometry(0.4, 0.5, 6, 12)
            : new THREE.CylinderGeometry(0.4, 0.4, 1.0, 12)),
        hull(0xe8f4ff, 0x2a6a5a, { metalness: 0.4, roughness: 0.3 })), {});
    g.add(edges(shell, 0x7dffd4, 0.45));
    const window_ = add(g, new THREE.Mesh(
        cached('pod-win', () => new THREE.SphereGeometry(0.22, 12, 10)),
        glow(0x7dffd4, 0.95)), { z: 0.34, sz: 0.5 });
    const beacon = add(g, new THREE.Mesh(
        cached('pod-beacon', () => new THREE.SphereGeometry(0.12, 8, 6)),
        glow(0xffd166, 0.9)), { y: 0.55 });
    const burnRing = add(g, new THREE.Mesh(
        cached('pod-burn', () => new THREE.RingGeometry(0.75, 0.95, 28)),
        glow(0xff6b6b, 0)), { z: -0.2 });
    g.userData = { shell, window: window_, beacon, burnRing };
    return g;
}

/**
 * Pickups are ALL green (COLORS.*Item), because green means "safe to touch"
 * and nothing that hurts you is ever green — see the hazard rule in
 * core/config.js. Hue therefore cannot tell them apart, so SHAPE does: each
 * type has its own silhouette, readable at a glance and in peripheral vision.
 */
const PICKUP_COLORS = {
    power: COLORS.powerItem,
    weapon: COLORS.weaponItem,
    flare: COLORS.flareItem,
    life: COLORS.lifeItem,
    gem: COLORS.gem,
    shield: COLORS.shieldItem,
    rocket: COLORS.rocketItem,
    speed: COLORS.speedItem,
    invuln: COLORS.invulnItem,
};

/** One distinct silhouette per pickup type. */
function pickupGeometry(type) {
    switch (type) {
        case 'gem':    return cached('pk-gem', () => new THREE.OctahedronGeometry(0.46));
        case 'shield': return cached('pk-shield', () => new THREE.SphereGeometry(0.42, 12, 8));
        case 'rocket': return cached('pk-rocket', () => new THREE.ConeGeometry(0.4, 0.95, 6));
        case 'speed':  return cached('pk-speed', () => new THREE.TetrahedronGeometry(0.58));
        case 'invuln': return cached('pk-invuln', () => new THREE.DodecahedronGeometry(0.46));
        case 'life':   return cached('pk-life', () => new THREE.TorusGeometry(0.34, 0.15, 8, 16));
        case 'flare':  return cached('pk-flare', () => new THREE.IcosahedronGeometry(0.46, 0));
        case 'weapon': return cached('pk-weapon', () => new THREE.CylinderGeometry(0.38, 0.38, 0.62, 6));
        default:       return cached('pk-box', () => new THREE.BoxGeometry(0.62, 0.62, 0.62));
    }
}

export function makePickup(type) {
    const g = new THREE.Group();
    const color = PICKUP_COLORS[type] ?? 0xffffff;
    const body = add(g, new THREE.Mesh(
        pickupGeometry(type), hull(color, color, { emissiveIntensity: 1.35 })), {});
    g.add(edges(body, 0xffffff, 0.85));
    // A thin halo ring behind the body, and a wider, much fainter aura. Both
    // sit BEHIND the mesh and stay narrow: an earlier version used a fat
    // filled-looking aura that washed out the silhouette, and the silhouette
    // is the only thing distinguishing one green pickup from another.
    add(g, new THREE.Mesh(cached('pk-halo', () => new THREE.RingGeometry(0.6, 0.67, 22)),
        glow(color, 0.5)), { z: -0.25 });
    const aura = add(g, new THREE.Mesh(
        cached('pk-aura', () => new THREE.RingGeometry(0.86, 0.94, 24)),
        glow(color, 0.18)), { z: -0.3 });
    g.userData = { body, aura, color, type };
    return g;
}

/**
 * The claw is a HAZARD — touching it kills you — so it is painted from the
 * danger end of the palette and given a pulsing warning stripe. It used to be
 * the same amber as the old power-up.
 */
export function makeClawHazard() {
    const g = new THREE.Group();
    const arm = add(g, new THREE.Mesh(
        cached('hz-arm', () => new THREE.BoxGeometry(2.4, 0.5, 0.5)),
        hull(0x8a8a9f, COLORS.hazard, { emissiveIntensity: 0.9 })), {});
    g.add(edges(arm, COLORS.warn, 0.85));
    add(g, new THREE.Mesh(cached('hz-claw', () => new THREE.ConeGeometry(0.5, 1.2, 4)),
        glow(COLORS.warn, 0.9)), { x: 1.6, rz: -Math.PI / 2 });
    add(g, new THREE.Mesh(cached('hz-warn', () => new THREE.BoxGeometry(2.4, 0.16, 0.56)),
        glow(COLORS.warn, 0.7)), { z: 0.01 });
    return g;
}

export function disposeGeometryCache() {
    for (const geo of geoCache.values()) geo.dispose?.();
    geoCache.clear();
}
