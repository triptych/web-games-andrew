// Procedural models: every module, cover, shell and fastener is built in code from a few primitives.
// A part's model is chosen by its module type and condition (burnt and cracked parts are built
// differently); things that change while you work (dust, corrosion, solder) are overlays updated per frame.

import * as THREE from 'three';
import { Builder, mat, accentMat, colorMat, glassMat, pcbMat, panelMat, labelMat, ledMat, slabGeo, gearGeo, ringGeo, roundedRectShape } from './kit.js';
import * as TX from './textures.js';
import { KINDS } from '../sim/kinds.js';
import { FLOOR_Y } from '../config.js';

const PI = Math.PI;
const LENS_COLORS = { 'LNS-A': 0xffb13d, 'LNS-B': 0x35a0ff, 'LNS-R': 0xff3d4d, 'LNS-G': 0x4dff9a };
const CAP_COLORS = [0x2a5fd0, 0x1d1f26, 0x2f8f5a, 0xb03a3a, 0x7a4ad0];

const flatPlane = (w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-PI / 2); return g; };

function frameGeo(w, d, holeR, h, r = 0.15) {
    const s = roundedRectShape(w, d, r);
    const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, PI * 2, true); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 20 });
    g.rotateX(-PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** Each builder returns { b: Builder, movers, glows, extra } in the part's local frame. */
const BUILD = {};

BUILD.cell = (p, c) => {
    const b = new Builder(), w = p.w, h = p.h, burnt = p.cond.burnt;
    const r = 0.5, len = w - 0.55, cy = 0.28 + r;
    b.box(mat('gunmetal'), w - 0.15, 0.28, p.d - 0.1, 0, 0.14, 0);
    const body = burnt ? mat('burnt') : colorMat(0x1b2230, { metalness: 0.6, roughness: 0.4 });
    b.add(new THREE.CylinderGeometry(r * (burnt ? 1.1 : 1), r * (burnt ? 1.1 : 1), len, 28), body, 0, cy, 0, 0, 0, PI / 2);
    for (const s of [-1, 1]) b.cylc(mat('brass'), r * 0.9, r * 0.9, 0.2, 22, s * (len / 2 + 0.08), cy, 0, 0, 0, PI / 2);
    if (!burnt) b.cylc(accentMat(c.accent), r + 0.015, r + 0.015, 0.34, 26, 0.05, cy, 0, 0, 0, PI / 2);
    for (const s of [-1, 1]) b.tor(mat('steel'), r + 0.03, 0.035, s * 0.82, cy, 0, 0, PI / 2, 0, 6, 24);
    for (const s of [-1, 1]) b.cyl(mat('copper'), 0.085, 0.1, h - cy - 0.2, 10, s * 0.55, cy + 0.2, 0);
    for (const s of [-1, 1]) b.cyl(mat('chrome'), 0.14, 0.14, 0.04, 14, s * 0.55, h - 0.06, 0);
    b.add(flatPlane(1.0, 0.32), labelMat(p.spec, { w: 160, h: 50, size: 30 }), -0.6, cy + r + 0.012, 0);
    if (burnt) { b.add(flatPlane(1.1, 0.5), colorMat(0x000000, { roughness: 1 }), 0.3, cy + r * 1.1 + 0.01, 0.0); }
    return { b };
};

BUILD.fuse = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.box(mat('plasticBlack'), 1.8, 0.3, 0.85, 0, 0.15, 0);
    for (const s of [-1, 1]) { b.box(mat('brass'), 0.3, 0.3, 0.5, s * 0.62, 0.42, 0); b.box(mat('brass'), 0.1, 0.24, 0.5, s * 0.74, 0.58, 0); }
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 16), burnt ? colorMat(0x1a1210, { roughness: 0.5, transparent: true, opacity: 0.95 }) : glassMat(0xd8f0ff, 0.45), 0, 0.5, 0, 0, 0, PI / 2);
    if (!burnt) b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.96, 6), mat('copperWire'), 0, 0.5, 0, 0, 0, PI / 2);
    else { b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), mat('copperWire'), -0.3, 0.5, 0, 0, 0, PI / 2); b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), mat('copperWire'), 0.33, 0.5, 0.0, 0, 0, PI / 2); }
    b.add(flatPlane(0.7, 0.2), labelMat(p.spec, { w: 128, h: 40, size: 26 }), 0, 0.305, 0.3);
    return { b };
};

BUILD.cap = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    const sleeve = CAP_COLORS[(p.spec.length + p.spec.charCodeAt(p.spec.length - 1)) % CAP_COLORS.length];
    b.cyl(mat('plasticBlack'), 0.28, 0.28, 0.08, 16, 0, 0, 0);
    b.cyl(burnt ? mat('burnt') : colorMat(sleeve, { metalness: 0.5, roughness: 0.35 }), 0.255, 0.255, 0.7, 20, 0, 0.08, 0);
    if (!burnt) {
        b.cyl(mat('chrome'), 0.25, 0.25, 0.04, 20, 0, 0.78, 0);
        b.box(mat('darkSteel'), 0.3, 0.012, 0.025, 0, 0.822, 0); b.box(mat('darkSteel'), 0.025, 0.012, 0.3, 0, 0.822, 0);
        b.box(colorMat(0xdfe6ee, { roughness: 0.5 }), 0.05, 0.6, 0.02, 0.255, 0.4, 0.0);
    } else {
        b.sph(mat('burnt'), 0.27, 0, 0.82, 0, 1, 0.75, 1);
        b.add(flatPlane(0.9, 0.9), colorMat(0x3a2410, { roughness: 0.4, transparent: true, opacity: 0.8 }), 0, 0.01, 0);
    }
    return { b };
};

BUILD.chip = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.box(burnt ? mat('burnt') : mat('plasticBlack'), 0.62, 0.2, 0.62, 0, 0.14, 0);
    b.box(mat('darkSteel'), 0.7, 0.03, 0.7, 0, 0.02, 0);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
        const o = -0.25 + i * 0.1;
        b.box(mat('steel'), 0.1, 0.03, 0.05, s * 0.36, 0.06, o); b.box(mat('steel'), 0.05, 0.03, 0.1, o, 0.06, s * 0.36);
    }
    b.cylc(mat('plasticGrey'), 0.04, 0.04, 0.02, 8, -0.2, 0.245, -0.2);
    if (!burnt) b.add(flatPlane(0.4, 0.16), labelMat(p.spec, { w: 96, h: 40, size: 20, fg: '#9aa4b4', bg: '#101216' }), 0.05, 0.245, 0.05);
    return { b };
};

BUILD.gov = (p, c) => {
    const b = new Builder();
    b.box(colorMat(0x1a0d12, { metalness: 0.4, roughness: 0.35 }), 0.7, 0.22, 0.7, 0, 0.15, 0);
    b.box(mat('darkSteel'), 0.78, 0.03, 0.78, 0, 0.02, 0);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const o = -0.28 + i * 0.11; b.box(mat('gold'), 0.1, 0.03, 0.05, s * 0.4, 0.06, o); b.box(mat('gold'), 0.05, 0.03, 0.1, o, 0.06, s * 0.4); }
    b.add(flatPlane(0.5, 0.18), labelMat('MER-GOV', { w: 112, h: 40, size: 22, fg: '#ff9a9a', bg: '#1a0d12' }), 0, 0.262, 0.2);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), ledMat(0xff2a4a));
    glow.position.set(0, 0.27, -0.12);
    return { b, glows: [{ mesh: glow, always: true, pulse: true }] };
};

BUILD.servo = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    const bodyM = burnt ? mat('burnt') : colorMat(c.body, { metalness: 0.55, roughness: 0.42 });
    b.box(mat('darkSteel'), 1.9, 0.12, 0.52, 0, 0.44, 0);
    b.box(bodyM, 1.25, 0.95, 1.0, -0.12, 0.475, 0);
    b.box(accentMat(c.accent), 1.26, 0.07, 0.3, -0.12, 0.88, 0);
    b.cyl(mat('steel'), 0.3, 0.3, 0.22, 20, -0.3, 0.95, 0);
    b.cyl(mat('gunmetal'), 0.12, 0.12, 0.05, 12, -0.3, 1.17, 0);
    b.cyl(mat('darkSteel'), 0.18, 0.2, 0.28, 12, 0.72, 0.5, 0, 0, 0, 0);
    b.add(flatPlane(0.7, 0.24), labelMat(p.spec, { w: 128, h: 40, size: 24 }), 0.25, 0.953, 0);
    const horn = new THREE.Group();
    const hb = new Builder();
    hb.box(p.cond.seized > 0 ? mat('rust') : mat('chrome'), 0.9, 0.07, 0.2, 0.28, 0, 0);
    hb.cylc(mat('chrome'), 0.14, 0.14, 0.09, 12, 0, 0, 0);
    horn.add(hb.build()); horn.position.set(-0.3, 1.2, 0);
    return { b, movers: [{ obj: horn, kind: 'swing', amp: 0.7, rate: 3 }], extra: [horn], rustTargets: [horn] };
};

BUILD.gear = (p, c) => {
    const b = new Builder();
    b.box(mat('darkSteel'), 1.5, 0.1, 1.5, 0, 0.05, 0);
    const g1 = new THREE.Group(), g2 = new THREE.Group();
    const m1 = new Builder(); m1.add(gearGeo(0.62, 14, 0.2), mat('brass')); m1.cylc(mat('gunmetal'), 0.22, 0.22, 0.24, 6, 0, 0.16, 0);
    g1.add(m1.build()); g1.position.set(-0.1, 0.1, 0.1);
    const m2 = new Builder(); m2.add(gearGeo(0.4, 9, 0.2), mat('steel'));
    g2.add(m2.build()); g2.position.set(0.62, 0.1, -0.5); g2.rotation.y = 0.3;
    b.cyl(mat('steel'), 0.06, 0.06, 0.34, 8, 0.62, 0.1, -0.5);
    return { b, movers: [{ obj: g1, kind: 'spin', rate: 1.6 }, { obj: g2, kind: 'spin', rate: -2.4 }], extra: [g1, g2], rustTargets: [g1, g2] };
};

BUILD.fan = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.add(frameGeo(1.7, 1.7, 0.72, 0.5), burnt ? mat('burnt') : colorMat(0x20242c, { metalness: 0.3, roughness: 0.5 }));
    b.cyl(mat('darkSteel'), 0.26, 0.26, 0.32, 16, 0, 0, 0);
    for (const [x, z] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) b.cyl(mat('steel'), 0.045, 0.045, 0.52, 6, x * 0.7, 0, z * 0.7);
    const rotor = new THREE.Group();
    const rb = new Builder();
    rb.cyl(burnt ? mat('burnt') : accentMat(c.accent), 0.21, 0.21, 0.24, 14, 0, 0.05, 0);
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        rb.add(new THREE.BoxGeometry(0.58, 0.025, 0.2), burnt ? mat('burnt') : colorMat(0x9aa4b4, { metalness: 0.2, roughness: 0.5 }), Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5, 0, -a, 0.35);
    }
    rotor.add(rb.build()); rotor.position.set(0, 0.12, 0);
    return { b, movers: [{ obj: rotor, kind: 'spin', rate: 18 }], extra: [rotor] };
};

BUILD.lens = (p, c) => {
    const b = new Builder(), cracked = p.cond.cracked;
    const col = LENS_COLORS[p.spec] || 0x35a0ff;
    b.add(ringGeo(0.74, 0.58, 0.5), mat('darkSteel'));
    b.add(ringGeo(0.62, 0.52, 0.56), mat('chrome'));
    for (let i = 0; i < 12; i++) b.box(mat('gunmetal'), 0.05, 0.08, 0.1, Math.cos((i / 12) * PI * 2) * 0.76, 0.3, Math.sin((i / 12) * PI * 2) * 0.76, 0, -(i / 12) * PI * 2, 0);
    b.cyl(mat('gunmetal'), 0.56, 0.56, 0.3, 20, 0, 0, 0);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 12, 0, PI * 2, 0, PI / 2), cracked ? glassMat(0xe8f0f8, 0.8) : glassMat(col, 0.55));
    glass.scale.set(1, 0.78, 1); glass.position.y = 0.45;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8), ledMat(col));
    core.position.y = 0.6; core.scale.y = 0.7;
    if (cracked) { const cr = new THREE.Mesh(flatPlane(1.0, 1.0), new THREE.MeshBasicMaterial({ map: TX.crackTex(), transparent: true, depthWrite: false })); cr.position.y = 0.88; return { b, extra: [glass, cr], glows: [{ mesh: core, color: col, dim: true }] }; }
    return { b, extra: [glass], glows: [{ mesh: core, color: col }], beam: col };
};

BUILD.relay = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.box(mat('plasticBlack'), 1.2, 0.18, 1.0, 0, 0.09, 0);
    b.add(new THREE.BoxGeometry(1.1, 0.7, 0.9), burnt ? colorMat(0x15100c, { transparent: true, opacity: 0.92, roughness: 0.4 }) : glassMat(0xcfe4ff, 0.28), 0, 0.53, 0);
    b.cylc(burnt ? mat('burnt') : mat('copper'), 0.26, 0.26, 0.62, 16, -0.12, 0.42, 0, 0, 0, PI / 2);
    for (const s of [-1, 1]) b.box(mat('brass'), 0.12, 0.3, 0.18, 0.4, 0.4 + (s > 0 ? 0.1 : 0), s * 0.12);
    b.box(mat('steel'), 0.5, 0.04, 0.12, 0.2, 0.62, 0);
    b.cyl(mat('steel'), 0.12, 0.12, 0.06, 10, 0, 0.84, 0);
    return { b, movers: [], glows: [] };
};

BUILD.coil = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.cyl(mat('gunmetal'), 0.8, 0.84, 0.16, 28, 0, 0, 0);
    b.tor(burnt ? mat('burnt') : mat('copper'), 0.5, 0.26, 0, 0.42, 0, PI / 2, 0, 0, 12, 32);
    b.cyl(mat('steel'), 0.17, 0.17, 0.72, 12, 0, 0.1, 0);
    for (const s of [-1, 1]) b.cyl(mat('brass'), 0.08, 0.08, 0.2, 8, s * 0.3, 0.66, 0);
    if (burnt) b.add(flatPlane(1.2, 1.2), new THREE.MeshBasicMaterial({ map: TX.sootTex(), transparent: true, depthWrite: false }), 0, 0.72, 0);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.31, 8, 32), new THREE.MeshBasicMaterial({ color: c.accent, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = PI / 2; halo.position.y = 0.42;
    return { b, extra: [halo], glows: [{ mesh: halo, halo: true, color: c.accent }] };
};

BUILD.speaker = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.add(frameGeo(1.7, 1.7, 0.66, 0.28, 0.2), mat('plasticBlack'));
    b.cyl(mat('darkSteel'), 0.5, 0.5, 0.26, 20, 0, 0, 0);
    for (const [x, z] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) b.cylc(mat('steel'), 0.07, 0.07, 0.04, 8, x * 0.55, 0.29, z * 0.55);
    const cone = new THREE.Group();
    const cb = new Builder();
    cb.add(new THREE.CylinderGeometry(0.64, 0.3, 0.26, 28, 1, true), burnt ? mat('burnt') : colorMat(0x30343e, { metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide }), 0, 0.15, 0);
    cb.tor(colorMat(0x22252c, { roughness: 0.9 }), 0.64, 0.045, 0, 0.28, 0, PI / 2, 0, 0, 6, 28);
    cb.sph(burnt ? mat('burnt') : mat('gunmetal'), 0.2, 0, 0.18, 0, 1, 0.5, 1);
    cone.add(cb.build());
    return { b, movers: [{ obj: cone, kind: 'pulse', rate: 28, amp: 0.12 }], extra: [cone] };
};

BUILD.actuator = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    for (const s of [-1, 1]) { b.box(mat('darkSteel'), 0.34, 0.14, 0.7, s * 0.95, 0.07, 0); b.cylc(mat('steel'), 0.1, 0.1, 0.1, 8, s * 0.95, 0.19, 0); }
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 1.35, 22), burnt ? mat('burnt') : colorMat(c.body, { metalness: 0.7, roughness: 0.35 }), -0.15, 0.46, 0, 0, 0, PI / 2);
    b.cylc(accentMat(c.accent), 0.345, 0.345, 0.2, 22, -0.15, 0.46, 0, 0, 0, PI / 2);
    for (const s of [-1, 1]) b.cylc(mat('chrome'), 0.3, 0.3, 0.06, 22, -0.15 + s * 0.7, 0.46, 0, 0, 0, PI / 2);
    const rod = new THREE.Group();
    const rb = new Builder();
    rb.cylc(mat('chrome'), 0.1, 0.1, 0.9, 12, 0.45, 0, 0, 0, 0, PI / 2);
    rb.box(mat('brass'), 0.18, 0.2, 0.3, 0.92, 0, 0);
    rod.add(rb.build()); rod.position.set(0.5, 0.46, 0);
    return { b, movers: [{ obj: rod, kind: 'slide', amp: 0.25, rate: 2.4, base: 0.5, axis: 'x' }], extra: [rod], rustTargets: [rod] };
};

BUILD.display = (p, c) => {
    const b = new Builder();
    b.box(mat('darkSteel'), 2.3, 0.22, 1.5, 0, 0.11, 0);
    b.box(mat('gunmetal'), 2.14, 0.04, 1.34, 0, 0.24, 0);
    const screenTex = TX.canvasTex(256, 160, (g, w, h) => {
        g.fillStyle = '#06141a'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#1b5a58'; g.lineWidth = 1;
        for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); }
        for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
        g.strokeStyle = '#59ffb4'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 100);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, 80 + Math.sin(x * 0.07) * 28 + Math.sin(x * 0.21) * 9);
        g.stroke();
        g.fillStyle = '#59ffb4'; g.font = 'bold 14px monospace'; g.fillText('NAV  OK', 10, 20);
    });
    const dead = p.cond.cracked;
    const screen = new THREE.Mesh(flatPlane(2.0, 1.2), new THREE.MeshStandardMaterial({ color: 0x03080a, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 }));
    screen.position.y = 0.26;
    const extra = [screen];
    if (dead) { const cr = new THREE.Mesh(flatPlane(2.0, 1.2), new THREE.MeshBasicMaterial({ map: TX.crackTex(), transparent: true, depthWrite: false })); cr.position.y = 0.275; extra.push(cr); }
    return { b, extra, screen };
};

BUILD.switch = (p, c) => {
    const b = new Builder(), burnt = p.cond.burnt;
    b.box(burnt ? mat('burnt') : mat('plasticBlack'), 1.0, 0.36, 1.0, 0, 0.18, 0);
    b.box(mat('darkSteel'), 0.92, 0.04, 0.92, 0, 0.38, 0);
    const levers = [];
    for (const s of [-1, 1]) {
        b.cylc(mat('brass'), 0.1, 0.1, 0.12, 10, s * 0.28, 0.44, 0.2);
        const l = new THREE.Group();
        const lb = new Builder();
        lb.cyl(mat('chrome'), 0.04, 0.05, 0.38, 8, 0, 0, 0); lb.sph(accentMat(c.accent), 0.08, 0, 0.4, 0);
        l.add(lb.build()); l.position.set(s * 0.28, 0.44, 0.2); l.rotation.z = s * 0.35;
        levers.push(l);
    }
    return { b, extra: levers, movers: levers.map((l, i) => ({ obj: l, kind: 'flip', rate: 0 })) };
};

BUILD.board = (p, c) => {
    const b = new Builder(), w = p.w, d = p.d;
    const base = ['green', 'blue', 'black', 'red'][(p.spec.charCodeAt(p.spec.length - 1) + w) % 4 | 0] || 'green';
    b.box(mat('plasticBlack'), w, 0.2, d, 0, 0.1, 0);
    b.add(flatPlane(w - 0.04, d - 0.04), pcbMat(base, p.spec.length + 1), 0, 0.205, 0);
    const ix = w / 2 - 0.3, iz = d / 2 - 0.3;
    for (const [x, z] of [[-ix, -iz], [ix, -iz], [ix, iz], [-ix, iz]]) b.tor(mat('gold'), 0.2, 0.03, x, 0.215, z, PI / 2, 0, 0, 6, 16);
    for (let i = 0; i < 12; i++) b.box(mat('gold'), 0.08, 0.02, 0.22, -w / 2 + 0.7 + i * ((w - 1.4) / 11), 0.215, d / 2 - 0.2);
    b.add(flatPlane(0.9, 0.3), labelMat(p.spec, { w: 128, h: 44, size: 26, fg: '#e9e4c8', bg: '#10241a' }), w / 2 - 0.7, 0.212, d / 2 - 0.6);
    // decorative joints: healthy ones are bright and round
    for (let i = 0; i < 12; i++) {
        const x = (((i * 37) % 17) / 17 - 0.5) * (w - 1.4), z = (((i * 53) % 13) / 13 - 0.35) * (d - 1.9);
        b.sph(mat('solder'), 0.05, x, 0.225, z, 1, 0.6, 1, 8, 6);
    }
    return { b, joints: true };
};

BUILD.bracket = (p, c) => {
    const b = new Builder(), w = p.w, d = p.d;
    b.add(slabGeo(w, d, 0.16, 0.2, 0.025), mat('gunmetal'));
    b.add(slabGeo(w - 0.5, d - 0.5, 0.2, 0.15, 0.02), mat('darkSteel'), 0, 0.06, 0);
    for (let i = 0; i < 6; i++) b.box(mat('rubber'), 0.45, 0.01, 0.07, -w / 2 + 0.9 + i * 0.5, 0.22, 0);
    b.add(flatPlane(Math.min(1.2, w - 1), 0.28), labelMat(p.name.slice(0, 14).toUpperCase(), { w: 192, h: 40, size: 22, fg: '#d8c060', bg: '#1a1c22' }), 0, 0.225, d / 2 - 0.36);
    return { b };
};

BUILD.panel = (p, c) => {
    const b = new Builder(), w = p.w, d = p.d;
    b.add(slabGeo(w, d, 0.2, 0.3, 0.04), panelMat(c.body, c.accent, p.id.length + Math.round(w * 3), c.short));
    const pm = panelMat(c.body, c.accent, p.id.length + Math.round(w * 3), c.short);
    // vent slits and ribs
    const nv = Math.max(3, Math.floor((w - 3) / 0.5));
    for (let i = 0; i < Math.min(9, nv); i++) b.box(mat('rubber'), 0.08, 0.02, Math.min(1.6, d * 0.3), -w * 0.3 + i * 0.28, 0.215, -d * 0.2);
    b.box(mat('rubber'), Math.min(1.6, w * 0.4), 0.012, 0.12, 0, 0.215, d * 0.28);
    void pm;
    return { b };
};

// ------------------------------------------------------------------ assembling a part view
const sprites = new Map();
function spriteMaterial(tex) {
    if (!sprites.has(tex)) sprites.set(tex, new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    return sprites.get(tex);
}

export function kindLook(kindId) {
    const K = KINDS[kindId];
    return { accent: K.accent, body: K.body, short: K.name.split(' ')[0].toUpperCase() };
}

/** Build the model for one part. Returns the view object the renderer drives. */
export function makePartView(part, dev) {
    const c = kindLook(dev.kind);
    const fn = BUILD[part.mod];
    const out = fn(part, c);
    const group = new THREE.Group();
    group.add(out.b.build());
    const pv = {
        id: part.id, group, movers: [], glows: out.glows || [], ovl: {}, ports: null, portKey: '', joints: [], beam: out.beam, screen: out.screen,
        cond: JSON.stringify([part.cond.burnt, part.cond.cracked]), mod: part.mod, rust: [], phase: Math.random() * 6,
    };
    for (const o of out.extra || []) group.add(o);
    for (const m of out.movers || []) pv.movers.push({ ...m });
    for (const t of out.rustTargets || []) pv.rust.push(t);
    for (const g of pv.glows) group.add(g.mesh);
    const top = part.h;

    // overlays
    const dust = new THREE.Mesh(flatPlane(part.w + 0.02, part.d + 0.02), new THREE.MeshBasicMaterial({ map: TX.dustTex(), transparent: true, depthWrite: false, opacity: 0, color: 0xcfc6b0 }));
    dust.position.y = top + 0.018; dust.userData.noPick = true; group.add(dust); pv.ovl.dust = dust;
    const corr = new THREE.Group();
    const spots = (part.ports.length ? part.ports.map((q) => [q.ox, q.oz]) : [[-part.w * 0.25, 0], [part.w * 0.25, 0]]);
    spots.forEach(([x, z], i) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ map: TX.corrTex(), color: 0xffffff, roughness: 0.95, bumpMap: TX.corrTex(), bumpScale: 1.4 }));
        m.position.set(x, top + 0.04, z); m.scale.set(1.25, 0.45, 1.25); m.rotation.y = i; corr.add(m);
    });
    corr.userData.noPick = true; group.add(corr); pv.ovl.corr = corr;
    if (part.cond.burnt) {
        const soot = new THREE.Mesh(flatPlane(part.w * 1.15, part.d * 1.15), new THREE.MeshBasicMaterial({ map: TX.sootTex(), transparent: true, depthWrite: false, opacity: 0.9 }));
        soot.position.y = 0.02; soot.userData.noPick = true; group.add(soot);
    }
    const probe = new THREE.Sprite(spriteMaterial(TX.glyphTex('ok')));
    probe.scale.set(0.7, 0.7, 1); probe.position.y = top + 1.0; probe.visible = false; probe.renderOrder = 20; probe.userData.noPick = true;
    group.add(probe); pv.ovl.probe = probe; pv.probeKind = 'ok';

    // joints on boards: one pick target per bad joint
    if (out.joints) {
        (part.cond.joints || []).forEach((j, i) => {
            const g = new THREE.Group();
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), mat('copper'));
            pad.position.y = 0.02;
            const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6d6e74, roughness: 0.9, metalness: 0.5 }));
            blob.scale.set(1, 0.55, 1); blob.position.y = 0.06;
            const glowM = new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glowM);
            glow.position.y = 0.08; glow.userData.noPick = true;
            g.add(pad, blob, glow);
            g.position.set(j.x, 0.22, j.z);
            g.userData.ref = `joint:${part.id}.${i}`;
            pad.userData.ref = blob.userData.ref = g.userData.ref;
            group.add(g);
            pv.joints.push({ g, blob, glow, i });
        });
    }
    group.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
    tagPick(pv, `part:${part.id}`);
    pv.height = top;
    return pv;
}

function tagPick(pv, ref) {
    pv.group.traverse((o) => { if (o.isMesh && !o.userData.noPick && !o.userData.ref) o.userData.ref = ref; });
    pv.ref = ref;
}

/** Sockets: a coloured ring and a lettered tag on each port. Rebuilt when a spare takes a slot's colours. */
export function syncPorts(pv, part) {
    const key = part.ports.map((q) => `${q.id}${q.color}${q.tag}`).join('|');
    if (key === pv.portKey) return;
    pv.portKey = key;
    if (pv.ports) { pv.group.remove(pv.ports); }
    const grp = new THREE.Group();
    for (const q of part.ports) {
        const hex = q.hex || 0x6b7280;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 20), colorMat(hex, { emissive: hex, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.4 }));
        ring.rotation.x = PI / 2; ring.position.set(q.ox, q.oy + 0.03, q.oz);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10), mat('darkSteel'));
        post.position.set(q.ox, q.oy + 0.02, q.oz);
        ring.userData.noPick = post.userData.noPick = true;
        grp.add(ring, post);
        if (q.tag) {
            const s = new THREE.Sprite(spriteMaterial(TX.tagTex(q.tag, hex)));
            s.scale.set(0.3, 0.3, 1); s.position.set(q.ox, q.oy + 0.34, q.oz); s.renderOrder = 15; s.userData.noPick = true;
            grp.add(s);
        }
    }
    pv.ports = grp; pv.group.add(grp);
}

// ------------------------------------------------------------------ per-frame look
export function updatePartView(pv, part, t, st) {
    const c = part.cond;
    const dust = pv.ovl.dust; dust.material.opacity = Math.min(0.9, c.dust * 0.9); dust.visible = c.dust > 0.02;
    pv.ovl.corr.visible = c.corr > 0.02;
    if (pv.ovl.corr.visible) pv.ovl.corr.children.forEach((m) => m.scale.set(1.25 * Math.min(1, 0.4 + c.corr), 0.45, 1.25 * Math.min(1, 0.4 + c.corr)));
    // a clogged fan wears a grey mat of fuzz
    if (c.clog > 0.02 && !pv.clog) {
        const fz = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ map: TX.dustTex(), transparent: true, depthWrite: false, color: 0xb4ab98 }));
        fz.rotation.x = -PI / 2; fz.position.y = 0.52; fz.userData.noPick = true; pv.group.add(fz); pv.clog = fz;
    }
    if (pv.clog) { pv.clog.material.opacity = Math.min(0.95, c.clog); pv.clog.visible = c.clog > 0.02; }
    // rust on stiff mechanisms
    for (const o of pv.rust) {
        o.traverse((m) => {
            if (!m.isMesh) return;
            if (!m.userData.baseMat) m.userData.baseMat = m.material;
            m.material = c.seized > 0.05 ? mat('rust') : m.userData.baseMat;
        });
    }
    // probe flag
    const flag = pv.ovl.probe;
    if (part.probed && part.loc !== 'scrap') {
        const bad = c.burnt || c.dead || c.cracked || c.corr > 0.2 || (c.joints || []).some((j) => !j.done);
        const kind = bad ? 'bad' : 'ok';
        if (kind !== pv.probeKind) { flag.material = spriteMaterial(TX.glyphTex(kind)); pv.probeKind = kind; }
        flag.visible = true; flag.position.y = pv.height + 0.9 + Math.sin(t * 3 + pv.phase) * 0.06;
    } else flag.visible = false;
    // joints
    for (const j of pv.joints) {
        const cj = c.joints[j.i];
        const done = cj.done;
        j.blob.material.color.setHex(done ? 0xdde1e8 : 0x6d6e74);
        j.blob.material.roughness = done ? 0.18 : 0.9;
        j.blob.scale.set(done ? 1.1 : 1, done ? 0.7 : 0.5, done ? 1.1 : 1);
        const heat = Math.min(1, cj.heat || 0);
        j.glow.material.opacity = heat * 0.9;
        j.glow.material.color.setHSL(0.06 - heat * 0.04, 1, 0.5);
    }
    // motion while powered
    const on = st.powered;
    for (const m of pv.movers) {
        if (m.kind === 'spin') m.obj.rotation.y += (on ? m.rate : 0) * st.dt * (c.seized > 0.05 || c.clog > 0.3 ? 0.3 : 1);
        else if (m.kind === 'swing') m.obj.rotation.y = on ? Math.sin(t * m.rate) * m.amp : m.obj.rotation.y * 0.9;
        else if (m.kind === 'pulse') m.obj.scale.y = 1 + (on ? Math.sin(t * m.rate) * m.amp : 0);
        else if (m.kind === 'slide') m.obj.position.x = (m.base || 0) + (on ? (Math.sin(t * m.rate) * 0.5 + 0.5) * m.amp : 0);
        else if (m.kind === 'flip') m.obj.rotation.z = on ? Math.sin(t * 5 + m.obj.id) * 0.4 : m.obj.rotation.z;
    }
    for (const g of pv.glows) {
        const lit = g.always ? true : on;
        const k = lit ? (g.pulse ? 0.65 + Math.sin(t * 4) * 0.35 : 1) : g.dim ? 0.05 : 0.0;
        if (g.halo) g.mesh.material.opacity = lit ? 0.35 + Math.sin(t * 9) * 0.1 : 0;
        else { g.mesh.material.color.setHex(g.color || 0xff2a4a).multiplyScalar(0.15 + k * 1.4); g.mesh.visible = k > 0.02 || !!g.always; }
    }
    if (pv.screen) pv.screen.material.emissiveIntensity = on ? 1.6 + Math.sin(t * 6) * 0.1 : 0;
}

// ------------------------------------------------------------------ fasteners
const headGeos = {};
function fastGroup(type, rusty) {
    const b = new Builder();
    const metal = rusty ? mat('rust') : mat('steel');
    const dark = colorMat(0x0a0b0e, { roughness: 0.8 });
    if (type === 'phil' || type === 'flat') {
        b.cylc(metal, 0.17, 0.17, 0.09, 16, 0, 0.045, 0);
        b.sph(metal, 0.17, 0, 0.09, 0, 1, 0.3, 1, 14, 6);
        if (type === 'phil') { b.box(dark, 0.26, 0.02, 0.05, 0, 0.125, 0); b.box(dark, 0.05, 0.02, 0.26, 0, 0.125, 0); }
        else b.box(dark, 0.3, 0.02, 0.05, 0, 0.125, 0);
        b.cylc(mat('darkSteel'), 0.065, 0.065, 0.5, 8, 0, -0.25, 0);
    } else if (type === 'clip') {
        b.box(accentMat(0xff8a3d), 0.5, 0.1, 0.2, 0, 0.05, 0);
        b.box(accentMat(0xff8a3d), 0.14, 0.26, 0.2, -0.22, 0.13, 0);
        b.add(new THREE.CylinderGeometry(0.08, 0.04, 0.28, 8), mat('plasticGrey'), 0.1, -0.12, 0);
    } else {
        b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 6), metal, 0, 0.07, 0);
        b.cylc(mat('darkSteel'), 0.27, 0.27, 0.035, 16, 0, 0.018, 0);
        b.cylc(mat('darkSteel'), 0.08, 0.08, 0.5, 8, 0, -0.25, 0);
    }
    return b.build();
}
const fastCache = new Map();
export function makeFastener(type, rusty) {
    const key = type + (rusty ? 'r' : '');
    if (!fastCache.has(key)) fastCache.set(key, fastGroup(type, rusty));
    const g = fastCache.get(key).clone();     // shares geometry and materials
    g.traverse((o) => { if (o.isMesh) o.userData.sharedGeo = true; });
    return g;
}
export function makeHoleRing() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), colorMat(0x05060a, { roughness: 0.9 }));
    m.rotation.x = PI / 2; m.userData.sharedGeo = false;
    return m;
}

// ------------------------------------------------------------------ the shell the device sits in
export function buildShell(dev) {
    const K = KINDS[dev.kind];
    const W = dev.W + 0.6, D = dev.D + 0.6;
    const grp = new THREE.Group();
    const b = new Builder();
    const bodyM = panelMat(K.body, K.accent, 5, '');
    b.add(slabGeo(W, D, FLOOR_Y, 0.6, 0.05), mat('darkSteel'));
    // a low rim around the tray
    const wallH = 0.62, t = 0.16;
    b.box(bodyM, W, wallH, t, 0, FLOOR_Y + wallH / 2 - 0.1, -D / 2 + t / 2);
    b.box(bodyM, W, wallH, t, 0, FLOOR_Y + wallH / 2 - 0.1, D / 2 - t / 2);
    b.box(bodyM, t, wallH, D - t * 2, -W / 2 + t / 2, FLOOR_Y + wallH / 2 - 0.1, 0);
    b.box(bodyM, t, wallH, D - t * 2, W / 2 - t / 2, FLOOR_Y + wallH / 2 - 0.1, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        b.cyl(mat('brass'), 0.22, 0.22, wallH + 0.04, 10, sx * (W / 2 - 0.2), FLOOR_Y - 0.1, sz * (D / 2 - 0.2));
    }
    b.add(flatPlane(1.6, 0.4), labelMat(dev.serial, { w: 192, h: 48, size: 28, fg: '#e0d890', bg: '#171a20', border: '#5a5a40' }), -W / 2 + 1.5, FLOOR_Y + 0.52, D / 2 - t / 2 + 0.001);
    decorate(b, K, dev, W, D);
    const m = b.build();
    m.traverse((o) => { if (o.isMesh) o.userData.occluder = true; });
    grp.add(m);
    return grp;
}

const FY = FLOOR_Y;
function decorate(b, K, dev, W, D) {
    const acc = accentMat(K.accent), body = colorMat(K.body, { metalness: 0.6, roughness: 0.42 }), dk = mat('darkSteel');
    const hx = W / 2, hz = D / 2;
    switch (K.shell) {
        case 'arm': case 'cyberarm': {
            b.cylc(dk, 0.95, 0.95, 1.1, 22, -hx - 0.6, FY, 0, PI / 2, 0, 0);          // elbow
            b.tor(acc, 0.95, 0.09, -hx - 0.6, FY, 0.56, 0, 0, 0, 8, 24);
            b.box(body, 1.4, 0.6, 2.2, hx + 0.7, FY, 0);                              // palm
            const n = K.shell === 'cyberarm' ? 4 : 2;
            for (let i = 0; i < n; i++) {
                const z = (i - (n - 1) / 2) * 0.62;
                b.cylc(body, 0.2, 0.22, 1.1, 10, hx + 1.9, FY, z, 0, 0, PI / 2);
                b.sph(acc, 0.22, hx + 1.4, FY, z); b.cylc(body, 0.17, 0.2, 0.9, 10, hx + 2.9, FY, z, 0, 0, PI / 2); b.sph(acc, 0.19, hx + 2.4, FY, z);
            }
            if (K.shell === 'cyberarm') { b.cylc(body, 0.22, 0.24, 1.0, 10, hx + 1.0, FY, hz + 0.6, 0, 0.6, PI / 2); b.sph(acc, 0.22, hx + 0.6, FY, hz + 0.4); }
            else { b.cylc(mat('steel'), 0.06, 0.06, 2.2, 6, hx + 2.6, FY + 0.1, 0, 0, 0, PI / 2); b.sph(mat('steel'), 0.75, hx + 3.5, FY + 0.1, 0, 1, 0.45, 1, 18, 8); }
            break;
        }
        case 'radio': {
            for (let i = 0; i < 3; i++) { b.cylc(mat('brass'), 0.34, 0.34, 0.3, 18, -hx + 1.4 + i * 1.3, FY + 0.15, hz + 0.18, PI / 2, 0, 0); b.cylc(acc, 0.1, 0.1, 0.34, 8, -hx + 1.4 + i * 1.3, FY + 0.15, hz + 0.2, PI / 2, 0, 0); }
            b.cylc(mat('chrome'), 0.04, 0.04, 3.2, 6, -hx - 1.4, FY + 0.5, -hz + 0.5, 0, 0, PI / 2 - 0.2); b.sph(acc, 0.1, -hx - 2.9, FY + 0.88, -hz + 0.5);
            b.box(mat('rubber'), 1.0, 0.3, 0.3, hx - 0.6, FY, hz + 0.3);
            break;
        }
        case 'coil': {
            for (const s of [-1, 1]) {
                b.add(ringGeo(1.5, 1.0, 0.3), body, s * (hx + 0.5), FY - 0.2, 0);
                b.add(ringGeo(1.05, 0.8, 0.45), acc, s * (hx + 0.5), FY - 0.2, 0);
            }
            for (let i = 0; i < 8; i++) for (const s of [-1, 1]) b.box(dk, 0.07, 0.7, 0.55, -hx + 1.0 + i * ((W - 2) / 7), FY + 0.3, s * (hz + 0.15));
            break;
        }
        case 'drone': {
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                const L = 2.6, a = Math.atan2(sz, sx);
                b.box(body, L, 0.28, 0.4, sx * (hx + L * 0.28), FY + 0.1, sz * (hz + L * 0.28), 0, -Math.atan2(sz, sx), 0);
                b.cylc(dk, 0.34, 0.34, 0.5, 14, sx * (hx + L * 0.56), FY + 0.2, sz * (hz + L * 0.56));
                b.add(ringGeo(1.35, 1.22, 0.05), acc, sx * (hx + L * 0.56), FY + 0.55, sz * (hz + L * 0.56));
                void a;
            }
            b.cyl(dk, 0.25, 0.25, 0.8, 10, 0, FY - 0.5, -hz - 0.1);
            break;
        }
        case 'blaster': {
            b.cylc(dk, 0.55, 0.62, 3.2, 20, hx + 1.4, FY + 0.2, 0, 0, 0, PI / 2);
            b.cylc(acc, 0.7, 0.7, 0.35, 20, hx + 3.0, FY + 0.2, 0, 0, 0, PI / 2);
            b.cylc(mat('chrome'), 0.3, 0.3, 0.1, 16, hx + 3.2, FY + 0.2, 0, 0, 0, PI / 2);
            b.box(dk, 0.25, 0.4, 0.2, hx + 2.2, FY + 0.7, 0);
            b.box(body, 1.7, 0.55, 3.0, -hx - 0.3, FY + 0.05, hz + 1.2, 0, 0, 0.0);
            b.tor(dk, 0.7, 0.08, -hx + 1.2, FY + 0.2, hz + 0.1, PI / 2, 0, 0, 6, 20);
            break;
        }
        case 'console': {
            for (let i = 0; i < 7; i++) b.cylc(mat('brass'), 0.12, 0.12, 0.3, 8, -hx + 1.0 + i * 1.0, FY + 0.15, hz + 0.3, PI / 2, 0, 0);
            b.add(ringGeo(0.9, 0.7, 0.2), acc, hx + 0.6, FY - 0.1, hz - 1.0);
            b.tor(dk, 0.9, 0.12, -hx - 0.4, FY, 0, 0, PI / 2, 0, 6, 20);
            for (const s of [-1, 1]) b.box(dk, 0.7, 0.6, 0.5, s * (hx - 1.5), FY - 0.5, hz + 0.1);
            break;
        }
        case 'head': {
            for (const s of [-1, 1]) {
                b.cylc(body, 1.15, 1.15, 0.36, 24, s * (hx + 0.25), FY + 0.1, 0, 0, 0, PI / 2);
                b.cylc(acc, 0.55, 0.55, 0.42, 20, s * (hx + 0.28), FY + 0.1, 0, 0, 0, PI / 2);
            }
            b.cylc(dk, 0.9, 1.0, 1.3, 20, 0, FY - 0.3, -hz - 0.7, PI / 2, 0, 0);
            b.box(acc, W * 0.5, 0.12, 0.25, 0, FY + 0.5, hz - 0.3);
            break;
        }
        case 'eye': {
            b.tor(body, Math.min(hx, hz) * 0.9, 0.3, 0, FY - 0.1, 0, PI / 2, 0, 0, 10, 40);
            for (const a of [0.5, 2.6, 4.7]) b.box(dk, 2.2, 0.3, 0.4, Math.cos(a) * (hx + 1.1), FY + 0.1, Math.sin(a) * (hz + 0.9), 0, -a, 0);
            b.cylc(acc, 0.28, 0.28, 3.0, 8, hx + 1.2, FY + 0.05, 0.4, 0, 0, PI / 2);
            break;
        }
        case 'spanner': {
            b.cylc(dk, 1.9, 1.9, 1.1, 28, -hx - 0.3, FY - 0.2, 0, PI / 2, 0, 0);
            b.cylc(acc, 1.2, 1.2, 1.2, 24, -hx - 0.3, FY - 0.2, 0, PI / 2, 0, 0);
            b.cylc(mat('rubber'), 1.95, 1.95, 0.5, 28, -hx - 0.3, FY - 0.2, 0, PI / 2, 0, 0);
            b.cylc(acc, 0.1, 0.1, 3.2, 8, hx + 0.1, FY + 1.0, -hz, 0, 0, 0);
            b.sph(accentMat(0xffe27a), 0.5, hx + 0.1, FY + 2.7, -hz, 1, 1, 1, 16, 10);
            b.cylc(body, 0.14, 0.14, 2.0, 8, hx + 0.7, FY + 3.0, -hz, 0, 0, PI / 2 + 0.3);
            break;
        }
        default: break;
    }
}

// ------------------------------------------------------------------ the dish and the bin
export function buildDish() {
    const g = new THREE.Group();
    const b = new Builder();
    b.add(new THREE.CylinderGeometry(1.5, 1.25, 0.28, 28, 1, true), mat('steel'), 0, 0.14, 0);
    b.add(new THREE.CircleGeometry(1.25, 28).rotateX(-PI / 2), mat('darkSteel'), 0, 0.03, 0);
    b.tor(mat('chrome'), 1.5, 0.05, 0, 0.28, 0, PI / 2, 0, 0, 6, 32);
    g.add(b.build());
    return g;
}
export function buildBin() {
    const g = new THREE.Group();
    const b = new Builder();
    const m = colorMat(0x2a2e36, { metalness: 0.7, roughness: 0.6 });
    b.add(new THREE.CylinderGeometry(1.6, 1.3, 1.5, 24, 1, true), m, 0, 0.75, 0);
    b.add(new THREE.CircleGeometry(1.3, 24).rotateX(-PI / 2), mat('rubber'), 0, 0.02, 0);
    b.tor(mat('steel'), 1.6, 0.07, 0, 1.5, 0, PI / 2, 0, 0, 6, 32);
    b.box(accentMat(0xffc24d), 0.9, 0.3, 0.02, 0, 0.8, 1.55);
    g.add(b.build());
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.25, 1.45, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x090a0d, side: THREE.BackSide, roughness: 1 }));
    inner.position.y = 0.75; g.add(inner);
    return g;
}
