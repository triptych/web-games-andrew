// Stations: alien stations in five style languages, and Hearth, assembled from built modules.

import * as THREE from 'three';
import { RNG } from '../rng.js';
import { glowTexture } from './renderer.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.45, flatShading: true, ...o });
const emis = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

function lightSprite(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(size);
    return s;
}

// Window strips as emissive points around a cylinder/ring.
function windows(group, count, place, color = '#ffd9a0', size = 1.6) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { const p = place(i); pos.set([p.x, p.y, p.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), size, sizeAttenuation: true, depthWrite: false }));
    group.add(pts);
    return pts;
}

export function buildStation(st, species, opts = {}) {
    if (st.kind === 'hearth') return buildHearth(opts.base, opts.t || 0);
    const r = new RNG(st.seed);
    const style = species?.style || 'ring';
    const pal = species?.palette || { skin: '#8a9aa8', dark: '#2f3a46', eye: '#ffb547', accent: '#e2ecf6' };
    const main = std(pal.skin), dark = std(pal.dark), acc = std(pal.accent, { metalness: 0.3 });
    const glow = pal.eye;
    const g = new THREE.Group();
    const spinner = new THREE.Group();
    g.add(spinner);
    const S = st.kind === 'hub' || st.kind === 'embassy' ? 1.25 : st.kind === 'outpost' ? 0.8 : 1;
    if (style === 'ring') {
        const R = 70 * S;
        spinner.add(new THREE.Mesh(new THREE.TorusGeometry(R, 7 * S, 10, 48), main));
        spinner.add(new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 14 * S, 50 * S, 12), dark));
        for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 3, 3), acc); sp.rotation.y = (i * Math.PI) / 4; spinner.add(sp); }
        windows(spinner, 160, (i) => { const a = (i / 160) * Math.PI * 2; return { x: Math.cos(a) * R, y: (i % 2 ? 3 : -3) * S, z: Math.sin(a) * R }; }, glow);
        if (r.chance(0.6)) { const R2 = R * 0.6; const t2 = new THREE.Mesh(new THREE.TorusGeometry(R2, 4 * S, 8, 36), dark); t2.rotation.x = Math.PI / 2; t2.position.y = 22 * S; g.add(t2); }
    } else if (style === 'spindle') {
        const H = 160 * S;
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(8 * S, 8 * S, H, 10), dark));
        const n = r.int(4, 7);
        for (let i = 0; i < n; i++) {
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(r.range(18, 34) * S, r.range(18, 34) * S, r.range(6, 14) * S, 14), i % 2 ? main : acc);
            disc.position.y = (i / (n - 1) - 0.5) * H * 0.8;
            spinner.add(disc);
            windows(spinner, 30, (k) => { const a = (k / 30) * Math.PI * 2; return { x: Math.cos(a) * 24 * S, y: disc.position.y, z: Math.sin(a) * 24 * S }; }, glow, 1.4);
        }
        for (const s of [1, -1]) { const panel = new THREE.Mesh(new THREE.BoxGeometry(90 * S, 1, 26 * S), std('#1a3a6a', { emissive: new THREE.Color('#1a4aa0'), emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.2 })); panel.position.set(s * 60 * S, H * 0.3, 0); g.add(panel); }
    } else if (style === 'spiky') {
        spinner.add(new THREE.Mesh(new THREE.IcosahedronGeometry(34 * S, 1), main));
        const n = r.int(10, 18);
        for (let i = 0; i < n; i++) {
            const len = r.range(40, 90) * S;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(5 * S, len, 5), i % 3 ? dark : acc);
            const dir = new THREE.Vector3(r.gauss(), r.gauss() * 0.6, r.gauss()).normalize();
            sp.position.copy(dir.clone().multiplyScalar(30 * S + len / 2));
            sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            spinner.add(sp);
            const l = lightSprite(glow, 8 * S); l.position.copy(dir.clone().multiplyScalar(30 * S + len)); spinner.add(l);
        }
    } else if (style === 'pods') {
        const n = r.int(5, 9);
        const pts = [];
        for (let i = 0; i < n; i++) {
            const p = new THREE.Vector3(r.gauss() * 40, r.gauss() * 25, r.gauss() * 40).multiplyScalar(S);
            pts.push(p);
            const pod = new THREE.Mesh(new THREE.SphereGeometry(r.range(14, 26) * S, 14, 10), i % 2 ? main : acc);
            pod.position.copy(p);
            spinner.add(pod);
            windows(spinner, 14, (k) => { const a = (k / 14) * Math.PI * 2; return { x: p.x + Math.cos(a) * 20 * S, y: p.y, z: p.z + Math.sin(a) * 20 * S }; }, glow, 1.5);
        }
        for (let i = 1; i < n; i++) {
            const a = pts[i], b = pts[Math.floor(r.next() * i)];
            const len = a.distanceTo(b);
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(3 * S, 3 * S, len, 6), dark);
            tube.position.copy(a).add(b).multiplyScalar(0.5);
            tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
            spinner.add(tube);
        }
    } else {
        // lattice
        const n = 3;
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
            if (r.chance(0.35) && !(x === 0 && y === 0 && z === 0)) continue;
            const b = new THREE.Mesh(new THREE.OctahedronGeometry(r.range(10, 16) * S, 0), (x + y + z) % 2 ? main : acc);
            b.position.set(x * 38 * S, y * 38 * S, z * 38 * S);
            spinner.add(b);
            if (r.chance(0.4)) { const l = lightSprite(glow, 10 * S); l.position.copy(b.position); spinner.add(l); }
        }
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(76 * S * n / 3 * 2, 76 * S, 76 * S)), new THREE.LineBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(1.5) }));
        spinner.add(frame);
    }
    // Docking bay lights (blinking) + beacon.
    const bay = new THREE.Group();
    for (let i = 0; i < 6; i++) { const l = lightSprite(i % 2 ? '#6bffb0' : '#ffb547', 7); l.position.set(-20 + i * 8, -40 * S, 30 * S); l.userData.blink = i; bay.add(l); }
    g.add(bay);
    const beacon = lightSprite(glow, 22 * S);
    beacon.position.y = 90 * S;
    g.add(beacon);
    g.userData.update = (t) => {
        spinner.rotation.y = t * 0.06 * (style === 'ring' ? 1 : 0.4);
        bay.children.forEach((l) => { l.visible = Math.floor(t * 4 - l.userData.blink) % 6 === 0 || Math.floor(t * 4 - l.userData.blink) % 6 === 1; });
        beacon.material.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2));
    };
    return g;
}

// ------------------------------------------------------------------ Hearth
const MOD_COL = { solar: '#2a5aa8', silo: '#a8a090', refinery: '#b0703a', fabricator: '#8a8f99', shipyard: '#c8c0a8', lab: '#7a9ac8', hydro: '#5fa86a', drones: '#9a8ab8', depot: '#c8a050', defense: '#a84a4a', embassy: '#d8c8e8', beacon: '#6a4ad8' };

function moduleMesh(type, level, r) {
    const g = new THREE.Group();
    const s = 0.8 + level * 0.18;
    const c = MOD_COL[type] || '#888';
    const m = std(c), d = std('#3a3d44');
    switch (type) {
        case 'solar': {
            for (let i = 0; i < 1 + level; i++) {
                const p = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 14), std('#14306a', { emissive: new THREE.Color('#2050c0'), emissiveIntensity: 0.35, metalness: 0.9, roughness: 0.15 }));
                p.position.set(0, i * 5 - level * 2, 0);
                p.rotation.x = 0.3;
                g.add(p);
            }
            g.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8 + level * 5, 6), d));
            break;
        }
        case 'silo': {
            for (let i = 0; i < level; i++) { const cy = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 18, 12), m); cy.position.set((i % 2) * 17 - 8, 0, Math.floor(i / 2) * 17 - 8); g.add(cy); }
            break;
        }
        case 'refinery': {
            g.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 18), m));
            for (let i = 0; i < 1 + Math.ceil(level / 2); i++) {
                const tw = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 22 + level * 3, 8), d);
                tw.position.set(-8 + i * 7, 14, 0);
                g.add(tw);
                const v = lightSprite('#ff8a3a', 12); v.position.set(-8 + i * 7, 27 + level * 1.5, 0); v.userData.flicker = true; g.add(v);
            }
            break;
        }
        case 'fabricator': {
            g.add(new THREE.Mesh(new THREE.BoxGeometry(22, 16, 22), m));
            for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 26), d); arm.position.set(sx * 13, 6, 6); arm.rotation.x = -0.4; g.add(arm); }
            const l = lightSprite('#5ef0ff', 8); l.position.set(0, 10, 12); g.add(l);
            break;
        }
        case 'shipyard': {
            const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(46, 22, 26)), new THREE.LineBasicMaterial({ color: '#c8c0a8' }));
            g.add(fr);
            for (const y of [-11, 11]) for (const z of [-13, 13]) { const b = new THREE.Mesh(new THREE.BoxGeometry(46, 2, 2), m); b.position.set(0, y, z); g.add(b); }
            for (let i = 0; i < 4; i++) { const l = lightSprite('#ffb547', 5); l.position.set(-20 + i * 13, 12, 13); g.add(l); }
            break;
        }
        case 'lab': {
            g.add(new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 8, 14), m));
            const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#9fd0ff', { transparent: true, opacity: 0.5, metalness: 1, roughness: 0.05 }));
            dome.position.y = 4;
            g.add(dome);
            const orb = lightSprite('#9a7aff', 14); orb.position.y = 9; orb.userData.pulse = true; g.add(orb);
            break;
        }
        case 'hydro': {
            for (let i = 0; i < Math.min(4, level + 1); i++) {
                const dm = new THREE.Mesh(new THREE.SphereGeometry(8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#4ad86a', { emissive: new THREE.Color('#1a8a3a'), emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }));
                dm.position.set((i % 2) * 17 - 8, 0, Math.floor(i / 2) * 17 - 8);
                g.add(dm);
            }
            break;
        }
        case 'drones': {
            g.add(new THREE.Mesh(new THREE.BoxGeometry(28, 12, 20), m));
            const door = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), emis('#ffb547', 1.2));
            door.position.set(0, 0, 10.1);
            g.add(door);
            break;
        }
        case 'depot': {
            for (let i = 0; i < 2 + level * 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 6), std(['#c8a050', '#a84a4a', '#4a7ab8', '#5fa86a'][i % 4])); b.position.set((i % 3) * 11 - 11, Math.floor(i / 3) * 6.5, 0); g.add(b); }
            break;
        }
        case 'defense': {
            for (let i = 0; i < Math.min(4, level + 1); i++) {
                const tg = new THREE.Group();
                tg.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 4, 8), d));
                const head = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 7), m); head.position.y = 4; tg.add(head);
                for (const sx of [-1.5, 1.5]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 9, 6), d); b.rotation.x = Math.PI / 2; b.position.set(sx, 4.5, 6); tg.add(b); }
                tg.position.set((i % 2) * 16 - 8, 0, Math.floor(i / 2) * 16 - 8);
                tg.userData.turret = true;
                g.add(tg);
            }
            break;
        }
        case 'embassy': {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(8, 46, 8), m); sp.position.y = 18; g.add(sp);
            g.add(new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 6, 8), d));
            for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 4, 0.7, 0.55), side: THREE.DoubleSide })); const a = (i / 4) * Math.PI * 2; f.position.set(Math.cos(a) * 12, 16, Math.sin(a) * 12); f.rotation.y = -a; g.add(f); }
            break;
        }
        case 'beacon': {
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 70, 6), d); mast.position.y = 35; g.add(mast);
            for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(8 - i * 2, 0.8, 6, 24), emis('#9a7aff', 2)); ring.rotation.x = Math.PI / 2; ring.position.y = 40 + i * 12; g.add(ring); }
            const top = lightSprite('#c79bff', 30); top.position.y = 74; top.userData.pulse = true; g.add(top);
            break;
        }
        default: g.add(new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), m));
    }
    g.scale.setScalar(s);
    return g;
}

export function buildHearth(base, t = 0) {
    const g = new THREE.Group();
    const core = base ? base.modules.find((m) => m.type === 'core').level : 1;
    const dim = core <= 1 && (base?.modules.length || 1) <= 1;
    const hull = std(dim ? '#6a6458' : '#d8d0c0');
    const dark = std('#2a2d33');
    // Core: hex drum + rings, grows with level.
    const coreG = new THREE.Group();
    const h = 30 + core * 6;
    coreG.add(new THREE.Mesh(new THREE.CylinderGeometry(18 + core, 22 + core, h, 6), hull));
    const ringCount = Math.min(3, 1 + Math.floor(core / 3));
    for (let i = 0; i < ringCount; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(46 + i * 18 + core * 3, 3, 8, 6 * 8), dark);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = (i - (ringCount - 1) / 2) * 14;
        coreG.add(ring);
    }
    windows(coreG, 60, (i) => { const a = (i / 60) * Math.PI * 2; return { x: Math.cos(a) * (20 + core), y: ((i % 5) - 2) * h * 0.18, z: Math.sin(a) * (20 + core) }; }, dim ? '#4a3a2a' : '#ffd9a0', 1.8);
    const beaconC = lightSprite(dim ? '#ff5470' : '#ffb547', 26);
    beaconC.position.y = h / 2 + 10;
    coreG.add(beaconC);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 24, 6), dark);
    antenna.position.y = h / 2 + 12;
    coreG.add(antenna);
    g.add(coreG);
    // Modules arranged on the rings.
    const mods = (base?.modules || []).filter((m) => m.type !== 'core');
    const r = new RNG(77);
    mods.forEach((m, i) => {
        const ring = Math.floor(i / 6);
        const a = (i % 6) / 6 * Math.PI * 2 + ring * 0.5;
        const R = 46 + ring * 18 + core * 3 + 14;
        const mesh = moduleMesh(m.type, m.level, r);
        mesh.position.set(Math.cos(a) * R, (ring % 2 ? 14 : -10), Math.sin(a) * R);
        mesh.rotation.y = -a + Math.PI / 2;
        g.add(mesh);
        // strut
        const strut = new THREE.Mesh(new THREE.BoxGeometry(3, 3, R - 20), dark);
        strut.position.set(Math.cos(a) * (R / 2 + 10), mesh.position.y, Math.sin(a) * (R / 2 + 10));
        strut.rotation.y = -a + Math.PI / 2;
        g.add(strut);
    });
    if (dim) {
        // Derelict: a few broken panels drifting.
        for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(r.range(4, 12), 1, r.range(4, 10)), hull); p.position.set(r.range(-60, 60), r.range(-20, 20), r.range(-60, 60)); p.rotation.set(r.range(0, 3), r.range(0, 3), r.range(0, 3)); p.userData.drift = r.range(-0.3, 0.3); g.add(p); }
    }
    const bay = new THREE.Group();
    for (let i = 0; i < 6; i++) { const l = lightSprite(i % 2 ? '#6bffb0' : '#ffb547', 6); l.position.set(-20 + i * 8, -h / 2 - 4, 26); l.userData.blink = i; bay.add(l); }
    g.add(bay);
    g.userData.update = (tt) => {
        coreG.rotation.y = tt * 0.04;
        g.traverse((o) => {
            if (o.userData.flicker) o.material.opacity = 0.6 + Math.random() * 0.4; // view-only, Math.random is fine here
            if (o.userData.pulse) o.scale.setScalar((o.userData.base ||= o.scale.x) * (0.85 + 0.25 * Math.sin(tt * 3)));
            if (o.userData.drift) o.rotation.y += o.userData.drift * 0.016;
            if (o.userData.turret) o.rotation.y = Math.sin(tt * 0.4 + o.position.x) * 1.2;
        });
        bay.children.forEach((l) => { const k = Math.floor(tt * 4 - l.userData.blink) % 6; l.visible = k === 0 || k === 1; });
        beaconC.material.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(tt * 2));
    };
    return g;
}

// Points of interest: derelicts, anomalies, caches, beacons, wrecks, precursor sites, the Lattice.
export function buildPoi(o, t = 0) {
    const g = new THREE.Group();
    const r = new RNG(o.seed || 7);
    switch (o.kind) {
        case 'derelict': case 'wreck': {
            const m = std('#4a4740', { roughness: 0.9 });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 60, 8), m);
            body.rotation.set(r.range(0, 3), r.range(0, 3), r.range(0, 3));
            g.add(body);
            for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(r.range(3, 10), r.range(2, 6), r.range(3, 14)), m); d.position.set(r.gauss() * 30, r.gauss() * 20, r.gauss() * 30); d.rotation.set(r.next() * 3, r.next() * 3, r.next() * 3); d.userData.drift = r.range(-0.5, 0.5); g.add(d); }
            const l = lightSprite(o.kind === 'wreck' ? '#ffb547' : '#ff5470', 10); l.userData.blinkSlow = true; g.add(l);
            break;
        }
        case 'anomaly': {
            const col = new THREE.Color().setHSL(r.next(), 0.8, 0.6);
            for (let i = 0; i < 4; i++) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(30 + i * 14, 1.2, 6, 64), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
                ring.rotation.set(r.next() * 3, r.next() * 3, 0);
                ring.userData.spin = r.range(-1, 1);
                g.add(ring);
            }
            const c = lightSprite('#' + col.getHexString(), 80); c.userData.pulse = true; g.add(c);
            break;
        }
        case 'precursor': case 'lattice': {
            const big = o.kind === 'lattice' ? 3 : 1;
            const mat = std('#1a1830', { emissive: new THREE.Color('#7a4aff'), emissiveIntensity: 0.4, metalness: 1, roughness: 0.15 });
            for (let i = 0; i < 8; i++) {
                const ob = new THREE.Mesh(new THREE.OctahedronGeometry(10 * big, 0), mat);
                const a = (i / 8) * Math.PI * 2;
                ob.position.set(Math.cos(a) * 50 * big, Math.sin(a * 2) * 10 * big, Math.sin(a) * 50 * big);
                ob.scale.set(0.5, 2.5, 0.5);
                ob.userData.orbitA = a; ob.userData.orbitR = 50 * big;
                g.add(ob);
            }
            const ring = new THREE.Mesh(new THREE.TorusGeometry(70 * big, 2 * big, 8, 96), emis('#c79bff', 1.6));
            ring.rotation.x = Math.PI / 2;
            ring.userData.spin = 0.3;
            g.add(ring);
            const core = lightSprite('#c79bff', 90 * big); core.userData.pulse = true; g.add(core);
            break;
        }
        case 'hoard': {
            for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 8), std(['#6a2a2a', '#3a3a3a', '#a88a3a'][i % 3])); b.position.set(r.gauss() * 40, r.gauss() * 15, r.gauss() * 40); b.rotation.set(r.next(), r.next(), r.next()); g.add(b); }
            const l = lightSprite('#ff3a3a', 30); l.userData.pulse = true; g.add(l);
            break;
        }
        case 'cache': {
            const b = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 10), std('#8a7a4a'));
            g.add(b);
            const l = lightSprite('#6bffb0', 16); l.userData.blinkSlow = true; g.add(l);
            break;
        }
        case 'beacon': {
            g.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 40, 6), std('#9a9aaa')));
            const l = lightSprite('#5ef0ff', 24); l.position.y = 22; l.userData.blinkSlow = true; g.add(l);
            break;
        }
        case 'nest': case 'bountyZone': {
            // Invisible: the encounter itself is the content. A faint marker so it isn't empty.
            const l = lightSprite('#ff5470', 12); l.userData.blinkSlow = true; g.add(l);
            break;
        }
        default: break;
    }
    g.position.set(o.pos.x, o.pos.y, o.pos.z);
    g.userData.update = (tt) => {
        g.children.forEach((c) => {
            if (c.userData.spin) { c.rotation.z += c.userData.spin * 0.01; c.rotation.x += c.userData.spin * 0.004; }
            if (c.userData.pulse) c.scale.setScalar((c.userData.base ||= c.scale.x) * (0.8 + 0.3 * Math.sin(tt * 2.5)));
            if (c.userData.drift) c.rotation.y += c.userData.drift * 0.016;
            if (c.userData.blinkSlow) c.visible = Math.sin(tt * 3) > -0.3;
            if (c.userData.orbitA != null) { const a = c.userData.orbitA + tt * 0.3; c.position.set(Math.cos(a) * c.userData.orbitR, Math.sin(a * 2) * c.userData.orbitR * 0.2, Math.sin(a) * c.userData.orbitR); c.rotation.y = -a; }
        });
    };
    return g;
}
