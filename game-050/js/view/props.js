/**
 * props.js — procedural scenery: trees, rocks, crystals, ruins and friends.
 * Each prop is a merged toon mesh (+ outline) and, where needed, a glow mesh.
 */

import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { part, toonMesh, glowMat, merge, paint, paintGradient, jitterColor, shade, mix } from './toon.js';
import { taper, sph, cyl, cone, box, tor } from './chars.js';

const PI = Math.PI;
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dode = (r) => new THREE.DodecahedronGeometry(r, 0);

function rockGeo(rng, r, color) {
    const g = dode(r);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rng.range(0.8, 1.2), p.getY(i) * rng.range(0.6, 0.9), p.getZ(i) * rng.range(0.8, 1.2));
    g.computeVertexNormals();
    paintGradient(g, shade(color, -0.25), shade(color, 0.12), 1);
    return g;
}

const PROPS = {
    tree(rng, o) {
        const trunk = '#7a5236', leaf = o.leaf || rng.pick(['#4fae3a', '#5cbf44', '#3f9a3a']);
        const geos = [part(cyl(0.09, 0.14, 0.9, 8), trunk, [0, 0.45, 0])];
        const n = rng.int(3, 5);
        for (let i = 0; i < n; i++) geos.push(part(paintGradient(ico(rng.range(0.38, 0.52), 1), shade(leaf, -0.2), shade(leaf, 0.15), 1), null, [rng.range(-0.25, 0.25), 1.0 + rng.range(0, 0.45), rng.range(-0.25, 0.25)]));
        return toonMesh(geos, { outline: 0.025 });
    },
    pine(rng, o) {
        const geos = [part(cyl(0.07, 0.1, 0.5, 8), '#6a4a32', [0, 0.25, 0])];
        const c = o.leaf || '#2f7a4a', snow = o.snow;
        for (let i = 0; i < 3; i++) {
            const g = cone(0.55 - i * 0.13, 0.7, 10);
            if (snow) paintGradient(g, c, '#f4f8ff', 1, -0.1, 0.35); else paintGradient(g, shade(c, -0.2), shade(c, 0.15), 1);
            geos.push(part(g, null, [0, 0.65 + i * 0.38, 0]));
        }
        return toonMesh(geos, { outline: 0.025 });
    },
    palm(rng) {
        const trunk = taper([[0, 0, 0], [0.1, 0.8, 0], [0.3, 1.6, 0]], 0.1, 0.06, 10, 8); paint(trunk, '#a07a4a');
        const geos = [trunk];
        for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; geos.push(part(paintGradient(new THREE.SphereGeometry(0.5, 10, 6), '#3a9a3a', '#7ad05a', 0), null, [0.3 + Math.cos(a) * 0.35, 1.58, Math.sin(a) * 0.35], [0, -a, 0.5], [1, 0.12, 0.28])); }
        geos.push(part(sph(0.08, 8, 6), '#6a4a2a', [0.3, 1.52, 0.06]), part(sph(0.08, 8, 6), '#6a4a2a', [0.24, 1.5, -0.06]));
        return toonMesh(geos, { outline: 0.02 });
    },
    deadtree(rng) {
        const c = '#4a3a3a';
        const geos = [paint(taper([[0, 0, 0], [0.05, 0.6, 0], [-0.05, 1.2, 0.05]], 0.13, 0.04, 10, 8), c)];
        for (let i = 0; i < 4; i++) { const y = 0.5 + i * 0.18, s = i % 2 ? 1 : -1; geos.push(paint(taper([[0, y, 0], [s * 0.25, y + 0.15, 0.05], [s * 0.45, y + 0.35, 0.0]], 0.05, 0.01, 8, 6), c)); }
        return toonMesh(geos, { outline: 0.02 });
    },
    bush(rng, o) {
        const c = o.leaf || '#4fae3a';
        const geos = [];
        for (let i = 0; i < 4; i++) geos.push(part(paintGradient(ico(rng.range(0.22, 0.32), 1), shade(c, -0.2), shade(c, 0.15), 1), null, [rng.range(-0.25, 0.25), 0.18, rng.range(-0.2, 0.2)]));
        if (rng.chance(0.5)) for (let i = 0; i < 4; i++) geos.push(part(sph(0.04, 6, 4), rng.pick(['#ff6a8a', '#ffd04a', '#ffffff']), [rng.range(-0.3, 0.3), rng.range(0.25, 0.4), rng.range(0.1, 0.3)]));
        return toonMesh(geos, { outline: 0.02 });
    },
    rock(rng, o) { return toonMesh([rockGeo(rng, rng.range(0.25, 0.5), o.rock || '#8a8a96')], { outline: 0.02 }); },
    flower(rng) {
        const geos = [];
        for (let i = 0; i < 5; i++) {
            const x = rng.range(-0.3, 0.3), z = rng.range(-0.3, 0.3), c = rng.pick(['#ff6a8a', '#ffd04a', '#ffffff', '#b07aff', '#ff8a3a']);
            geos.push(part(cyl(0.01, 0.01, 0.18, 4), '#3a8a3a', [x, 0.09, z]), part(sph(0.05, 8, 6), c, [x, 0.2, z], [0, 0, 0], [1, 0.6, 1]), part(sph(0.02, 6, 4), '#ffe04a', [x, 0.22, z]));
        }
        return toonMesh(geos, { outline: 0.008 });
    },
    coral(rng) {
        const c = rng.pick(['#ff7a8a', '#ff9a5a', '#c87aff']);
        const geos = [];
        for (let i = 0; i < 5; i++) { const a = rng.range(0, PI * 2); geos.push(paint(taper([[0, 0, 0], [Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1], [Math.cos(a) * 0.15, 0.45, Math.sin(a) * 0.15]], 0.05, 0.03, 8, 6), c)); }
        return toonMesh(geos, { outline: 0.012 });
    },
    shell(rng) { return toonMesh([part(new THREE.SphereGeometry(0.18, 12, 8, 0, PI * 2, 0, PI / 2), '#ffe8d8', [0, 0, 0], [0, 0, 0], [1, 0.6, 1.2]), part(cone(0.06, 0.12, 8), '#ffd0c0', [0, 0.06, -0.18], [-1.2, 0, 0])], { outline: 0.01 }); },
    pillar(rng, o) {
        const c = o.stone || '#e8dcc0';
        const h = rng.range(1.2, 2.2);
        const broken = rng.chance(0.4);
        const geos = [part(box(0.5, 0.15, 0.5), shade(c, -0.1), [0, 0.07, 0]), part(cyl(0.18, 0.2, broken ? h * 0.6 : h, 12), c, [0, (broken ? h * 0.6 : h) / 2 + 0.1, 0])];
        if (!broken) geos.push(part(box(0.48, 0.14, 0.48), shade(c, -0.1), [0, h + 0.15, 0]));
        return toonMesh(geos, { outline: 0.02 });
    },
    ruin(rng, o) {
        const c = o.stone || '#d8ccb0';
        const geos = [];
        for (let i = 0; i < 5; i++) geos.push(part(box(rng.range(0.3, 0.6), rng.range(0.2, 0.35), 0.3), shade(c, rng.range(-0.15, 0.05)), [i * 0.32 - 0.6, 0.12 + (i % 2) * 0.05, rng.range(-0.05, 0.05)], [0, rng.range(-0.2, 0.2), 0]));
        geos.push(part(box(0.35, 0.8, 0.35), c, [-0.5, 0.45, 0]));
        return toonMesh(geos, { outline: 0.02 });
    },
    crystal(rng, o) {
        const c = o.crystal || rng.pick(['#c87aff', '#7af0ff', '#ff7ad8']);
        const geos = [];
        for (let i = 0; i < rng.int(3, 5); i++) geos.push(part(paintGradient(new THREE.OctahedronGeometry(0.2), shade(c, -0.2), shade(c, 0.5), 1), null, [rng.range(-0.2, 0.2), 0.3, rng.range(-0.2, 0.2)], [rng.range(-0.4, 0.4), rng.range(0, 3), rng.range(-0.4, 0.4)], [0.6, rng.range(1.5, 3), 0.6]));
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(merge(geos), glowMat()));
        return grp;
    },
    icecrystal(rng) { return PROPS.crystal(rng, { crystal: '#bfefff' }); },
    gravestone(rng) {
        const c = '#8a8a9a';
        return toonMesh([part(box(0.36, 0.5, 0.1), c, [0, 0.25, 0], [0, 0, rng.range(-0.15, 0.15)]), part(cyl(0.18, 0.18, 0.1, 12, false), c, [0, 0.5, 0], [PI / 2, 0, 0]), part(box(0.5, 0.06, 0.3), '#5a5a4a', [0, 0.02, 0.15])], { outline: 0.015 });
    },
    mushroomBig(rng, o) {
        const c = o.cap || rng.pick(['#c87aff', '#7a8aff', '#ff6a8a']);
        const grp = new THREE.Group();
        grp.add(toonMesh([part(cyl(0.08, 0.12, 0.6, 10), '#e8e0d0', [0, 0.3, 0]), part(new THREE.SphereGeometry(0.38, 16, 10, 0, PI * 2, 0, PI / 2), c, [0, 0.58, 0], [0, 0, 0], [1, 0.6, 1])], { outline: 0.02 }));
        grp.add(new THREE.Mesh(merge(Array.from({ length: 5 }, (_, i) => part(sph(0.04, 6, 4), '#ffffff', [Math.cos(i * 1.3) * 0.25, 0.7, Math.sin(i * 1.3) * 0.25])))
            , glowMat()));
        return grp;
    },
    lava(rng) {
        const grp = new THREE.Group();
        const g = new THREE.CircleGeometry(rng.range(0.5, 0.9), 20);
        paintGradient(g, '#ffd04a', '#ff4a1a', 0);
        const m = new THREE.Mesh(g, glowMat());
        m.rotation.x = -PI / 2; m.position.y = 0.02;
        grp.add(m);
        grp.add(toonMesh([part(tor(0.7, 0.08, 6, 20), '#3a2420', [0, 0.02, 0], [PI / 2, 0, 0])], { outline: false }));
        return grp;
    },
    spire(rng, o) {
        const c = o.rock || '#5a4a48';
        return toonMesh([rockGeo(rng, 0.4, c), part(paintGradient(cone(0.3, 1.8, 6), shade(c, -0.2), shade(c, 0.15), 1), null, [0, 0.9, 0], [0, rng.range(0, 1), rng.range(-0.1, 0.1)])], { outline: 0.02 });
    },
    brazier(rng) {
        const grp = new THREE.Group();
        grp.add(toonMesh([part(cyl(0.05, 0.08, 0.7, 8), '#4a4048', [0, 0.35, 0]), part(cyl(0.22, 0.12, 0.16, 12), '#5a5058', [0, 0.75, 0])], { outline: 0.015 }));
        const f = paintGradient(cone(0.16, 0.4, 10), '#ff6a1a', '#ffe04a', 1);
        const flame = new THREE.Mesh(f, glowMat({ transparent: true, opacity: 0.9, additive: true }));
        flame.position.y = 1.0;
        flame.userData.flicker = true;
        grp.add(flame);
        return grp;
    },
    lantern(rng) {
        const grp = new THREE.Group();
        grp.add(toonMesh([part(cyl(0.03, 0.04, 1.2, 6), '#3a3038', [0, 0.6, 0]), part(box(0.2, 0.04, 0.04), '#3a3038', [0.08, 1.18, 0])], { outline: 0.012 }));
        const l = new THREE.Mesh(paint(sph(0.08, 10, 8), '#ffd08a'), glowMat());
        l.position.set(0.16, 1.08, 0);
        l.userData.lamp = true;
        grp.add(l);
        return grp;
    },
    fence(rng) {
        const c = '#a07a4a';
        return toonMesh([part(box(0.06, 0.4, 0.06), c, [-0.4, 0.2, 0]), part(box(0.06, 0.4, 0.06), c, [0.4, 0.2, 0]), part(box(0.9, 0.05, 0.04), c, [0, 0.28, 0]), part(box(0.9, 0.05, 0.04), c, [0, 0.14, 0])], { outline: 0.01 });
    },
    cloud(rng) {
        const geos = [];
        for (let i = 0; i < rng.int(4, 6); i++) geos.push(part(paintGradient(ico(rng.range(0.5, 0.9), 1), '#dfe8f8', '#ffffff', 1), null, [i * 0.6 - 1.2, rng.range(-0.1, 0.2), rng.range(-0.3, 0.3)]));
        return toonMesh(geos, { outline: false });
    },
};

export function makeProp(kind, seed = 1, opts = {}) {
    const rng = new Rng(seed);
    const f = PROPS[kind] || PROPS.rock;
    const m = f(rng, opts);
    m.userData.prop = kind;
    return m;
}

/** Ground disc with a soft vertex-colour pattern. */
export function groundDisc(radius, c1, c2, seed = 1, segs = 64) {
    const g = new THREE.RingGeometry(0.001, radius, segs, 14);
    g.rotateX(-PI / 2);
    const rng = new Rng(seed);
    const col = new Float32Array(g.attributes.position.count * 3);
    const a = new THREE.Color(c1), b = new THREE.Color(c2), t = new THREE.Color();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const n = Math.sin(x * 0.9 + rng.next() * 0.3) * Math.cos(z * 0.8) * 0.5 + 0.5;
        t.copy(a).lerp(b, n * 0.8 + rng.next() * 0.2);
        col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

export { PROPS, rockGeo };
