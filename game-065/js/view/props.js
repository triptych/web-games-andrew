// Props: junk piles, pylons, buildings with painted signs, landmarks and furniture.
// Geometry is generated once and shared; piles are instanced per map (js/view/overworld.js).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metal, glow, MAT, tex, weather } from './materials.js';
import { gearGeo } from './botgen.js';
import { TYPE_INFO } from '../sim/data/types.js';

const gc = new Map();
const G = (k, f) => { if (!gc.has(k)) gc.set(k, f()); return gc.get(k); };
function M(geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; }
const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)); const c = g.clone(); c.applyMatrix4(m); return c; };
function stripUV(g) { const c = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k); return c; }
const merge = (list) => mergeGeometries(list.map(stripUV));

// ------------------------------------------------------------------ junk kinds (for instancing)
export const JUNK = {
    mound: () => { const g = new THREE.IcosahedronGeometry(0.62, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const n = Math.sin(p.getX(i) * 7.1) * Math.cos(p.getZ(i) * 6.3) * 0.12; p.setY(i, Math.max(-0.05, y * 0.65 + n)); p.setX(i, p.getX(i) * (1 + n)); } g.computeVertexNormals(); return g; },
    barrel: () => { const g = new THREE.LatheGeometry([[0, 0], [0.24, 0], [0.29, 0.18], [0.3, 0.35], [0.29, 0.52], [0.24, 0.7], [0, 0.7]].map(([x, y]) => new THREE.Vector2(x, y)), 16); return merge([g, tr(new THREE.TorusGeometry(0.29, 0.02, 4, 18), 0, 0.2, 0, Math.PI / 2), tr(new THREE.TorusGeometry(0.29, 0.02, 4, 18), 0, 0.5, 0, Math.PI / 2)]); },
    crate: () => { const b = new RoundedBoxGeometry(0.6, 0.6, 0.6, 2, 0.04); b.translate(0, 0.3, 0); return merge([b, tr(new THREE.BoxGeometry(0.62, 0.06, 0.06), 0, 0.3, 0.3), tr(new THREE.BoxGeometry(0.06, 0.62, 0.06), 0.3, 0.3, 0)]); },
    tires: () => merge([0, 1, 2].map((i) => tr(new THREE.TorusGeometry(0.28, 0.1, 8, 18), 0.03 * i, 0.1 + i * 0.18, 0, Math.PI / 2))),
    pipe: () => merge([tr(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 14, 1, true), 0, 0.16, 0, 0, 0, Math.PI / 2), tr(new THREE.TorusGeometry(0.17, 0.04, 6, 16), 0.62, 0.16, 0, 0, Math.PI / 2), tr(new THREE.TorusGeometry(0.17, 0.04, 6, 16), -0.62, 0.16, 0, 0, Math.PI / 2)]),
    gear: () => tr(gearGeo(0.55, 12, 0.1), 0, 0.25, 0, 0, 0, 0.3),
    engine: () => merge([tr(new RoundedBoxGeometry(0.7, 0.45, 0.5, 2, 0.05), 0, 0.25, 0), ...[-0.2, 0, 0.2].map((x) => tr(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), x, 0.6, 0)), tr(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), 0, 0.3, 0.3, Math.PI / 2)]),
    girder: () => merge([tr(new THREE.BoxGeometry(1.4, 0.06, 0.3), 0, 0.03, 0), tr(new THREE.BoxGeometry(1.4, 0.06, 0.3), 0, 0.33, 0), tr(new THREE.BoxGeometry(1.4, 0.3, 0.05), 0, 0.18, 0)]),
    screen: () => merge([tr(new RoundedBoxGeometry(0.5, 0.42, 0.42, 2, 0.04), 0, 0.21, 0), tr(new THREE.BoxGeometry(0.36, 0.28, 0.02), 0, 0.23, 0.215)]),
    plate: () => tr(new THREE.BoxGeometry(0.9, 0.04, 0.6), 0, 0.15, 0, 0.5, 0.3, 0.2),
};
const JUNK_COLORS = ['#8a5a3a', '#5a6a7a', '#7a3a2a', '#9a8a6a', '#4a5a4a', '#6a6a6e', '#a86a3a', '#3a4a5a', '#8a7a5a'];
export function junkColors() { return JUNK_COLORS; }
let junkMat = null;
const solidJunk = new Map();
/** Junk material for single meshes (no instance colours). */
export function junkSolid(color = '#8a5a3a') {
    if (!solidJunk.has(color)) { const m = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.6 }); weather(m, { rust: 0.45, patina: new THREE.Color('#7a3a18'), scale: 2.2, seed: 5 }); solidJunk.set(color, m); }
    return solidJunk.get(color);
}
export function junkMaterial() {
    if (!junkMat) { junkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.6 }); weather(junkMat, { rust: 0.45, patina: new THREE.Color('#7a3a18'), scale: 2.2, seed: 3 }); }
    return junkMat;
}

/** A lattice radio mast with a blinking light (the "trees" of Midden). */
export function mastGeometry() {
    return G('mast', () => {
        const parts = [];
        const H = 3.4;
        for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) { const leg = new THREE.CylinderGeometry(0.03, 0.05, H, 5); leg.translate(0, H / 2, 0); const m = new THREE.Matrix4().makeShear(-x * 0.18, 0, -z * 0.18, 0, 0, 0); leg.applyMatrix4(m); leg.translate(x, 0, z); parts.push(leg); }
        for (let i = 0; i < 6; i++) { const y = 0.3 + i * 0.5, w = 0.6 - i * 0.07; parts.push(tr(new THREE.BoxGeometry(w, 0.03, 0.03), 0, y, w / 2), tr(new THREE.BoxGeometry(w, 0.03, 0.03), 0, y, -w / 2), tr(new THREE.BoxGeometry(0.03, 0.03, w), w / 2, y, 0), tr(new THREE.BoxGeometry(0.03, 0.03, w), -w / 2, y, 0)); }
        parts.push(tr(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), 0, H + 0.35, 0), tr(new THREE.BoxGeometry(0.5, 0.04, 0.04), 0, H - 0.2, 0, 0, 0.5));
        return merge(parts);
    });
}

// ------------------------------------------------------------------ signs
function signTexture(text, sub, bg = '#2a1a10', fg = '#f0d090', icon = '') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#c8902a'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#c8902a'; for (const [x, y] of [[16, 16], [496, 16], [16, 112], [496, 112]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${sub ? 44 : 54}px Georgia, "Times New Roman", serif`;
    g.fillText((icon ? icon + ' ' : '') + text, 256, sub ? 52 : 66);
    if (sub) { g.font = 'italic 26px Georgia, serif'; g.fillStyle = '#d8c8a0'; g.fillText(sub, 256, 98); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}
function sign(text, sub, w, bg, fg, icon) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: signTexture(text, sub, bg, fg, icon), roughness: 0.6, emissive: new THREE.Color('#1a1008'), emissiveIntensity: 0.4 }));
    return m;
}

// ------------------------------------------------------------------ buildings
const wallMat = new Map();
function texMat(kind, color, rx = 1, ry = 1) {
    const k = `${kind}|${color}|${rx}|${ry}`;
    if (wallMat.has(k)) return wallMat.get(k);
    const t = tex(kind);
    const tt = t ? t.clone() : null;
    if (tt) { tt.needsUpdate = true; tt.repeat.set(rx, ry); }
    const m = new THREE.MeshStandardMaterial({ map: tt, color, roughness: kind === 'corrugated' ? 0.6 : 0.85, metalness: kind === 'corrugated' ? 0.15 : kind === 'plate' ? 0.4 : 0.05 });
    wallMat.set(k, m);
    return m;
}
/**
 * A building on a footprint of w × d tiles, origin at the footprint's north-west corner, front (south)
 * at z = d. doorX = the door's column inside the footprint.
 */
export function buildBuilding(style, w, d, doorX, opts = {}) {
    const g = new THREE.Group();
    const H = { station: 2.6, shop: 2.3, foundry: 3.4, house: 2.1, shack: 1.9, workshop: 2.5 }[style] || 2.2;
    const inset = 0.08;
    let wallM, roofM, trimM = metal('brass');
    switch (style) {
        case 'station': wallM = texMat('brick', '#ffffff', w / 2, H / 2); roofM = metal('verdigris'); break;
        case 'shop': wallM = texMat('corrugated', '#7ab0b0', w, 1); roofM = metal('gunmetal'); break;
        case 'foundry': wallM = texMat('brick', '#c8a898', w / 2, H / 2); roofM = metal('iron'); break;
        case 'workshop': wallM = texMat('planks', '#ffffff', w / 2, 1); roofM = metal('rust'); break;
        case 'shack': wallM = texMat('corrugated', '#c8a888', w, 1); roofM = metal('rust'); break;
        default: wallM = texMat('planks', '#e8d8c8', w / 2, 1); roofM = metal('copper'); break;
    }
    const body = M(new THREE.BoxGeometry(w - inset * 2, H, d - inset * 2), wallM, w / 2, H / 2, d / 2);
    g.add(body);
    // Foundation and corner posts.
    g.add(M(new THREE.BoxGeometry(w, 0.18, d), MAT.dark, w / 2, 0.09, d / 2));
    for (const [x, z] of [[inset, inset], [w - inset, inset], [inset, d - inset], [w - inset, d - inset]]) g.add(M(G(`post${H}`, () => new THREE.BoxGeometry(0.16, H + 0.05, 0.16)), metal('iron'), x, H / 2, z));
    // Roof.
    if (style === 'station') {
        // Half cylinder: theta 0..π is the +x half; rotating +90° about z turns it upward with the axis along x.
        const vault = M(new THREE.CylinderGeometry(d / 2, d / 2, w - 0.1, 24, 1, false, 0, Math.PI), roofM, w / 2, H, d / 2);
        vault.rotation.set(0, 0, Math.PI / 2);
        vault.scale.set(0.55, 1, 1);
        g.add(vault);
    } else if (style === 'foundry') {
        const n = Math.max(2, Math.floor(w / 2));
        for (let i = 0; i < n; i++) {
            const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(d, 0.9); s.lineTo(0, 0);
            const saw = M(new THREE.ExtrudeGeometry(s, { depth: w / n - 0.04, bevelEnabled: false }), roofM, (i * w) / n + 0.02, H, d);
            saw.rotation.y = Math.PI / 2; g.add(saw);
            g.add(M(new THREE.PlaneGeometry(w / n - 0.1, 0.8), glow('#ffcc7a', 0.8), (i + 0.5) * w / n, H + 0.42, d - 0.02, false));
        }
    } else if (style === 'shop') {
        g.add(M(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), roofM, w / 2, H + 0.06, d / 2));
        for (let i = 0; i <= w * 2; i++) g.add(M(G('rail', () => new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4)), metal('iron'), i * 0.5, H + 0.3, d));
        g.add(M(new THREE.BoxGeometry(w, 0.03, 0.03), metal('iron'), w / 2, H + 0.5, d));
    } else {
        const s = new THREE.Shape(); s.moveTo(-0.15, 0); s.lineTo(d + 0.15, 0); s.lineTo(d / 2, d * 0.45); s.lineTo(-0.15, 0);
        const roof = M(new THREE.ExtrudeGeometry(s, { depth: w + 0.3, bevelEnabled: false }), roofM, -0.15, H, d);
        roof.rotation.y = Math.PI / 2;
        g.add(roof);
        const rm = texMat('corrugated', style === 'shack' ? '#d8a07a' : '#c8885a', w, 2);
        roof.material = [wallM, rm];
    }
    // Door.
    const dx = doorX + 0.5;
    g.add(M(G('doorframe', () => new THREE.BoxGeometry(0.8, 1.35, 0.12)), metal('brass'), dx, 0.68, d - inset + 0.02));
    g.add(M(G('door', () => new THREE.BoxGeometry(0.62, 1.22, 0.06)), style === 'shop' ? metal('teal') : MAT.dark, dx, 0.62, d - inset + 0.06));
    g.add(M(G('doorwin', () => new THREE.CircleGeometry(0.13, 14)), glow('#ffcf7a', 1.4), dx, 0.92, d - inset + 0.1, false));
    g.add(M(G('step', () => new THREE.BoxGeometry(0.9, 0.08, 0.3)), metal('iron'), dx, 0.04, d + 0.1));
    // Windows.
    const winM = glow('#ffcc6a', 1.3);
    for (let x = 0.7; x < w - 0.4; x += 1.2) {
        if (Math.abs(x - dx) < 0.7) continue;
        g.add(M(G('win', () => new THREE.CircleGeometry(0.2, 16)), winM, x, H * 0.55, d - inset + 0.01, false));
        const fr = M(G('winfr', () => new THREE.TorusGeometry(0.21, 0.035, 6, 18)), trimM, x, H * 0.55, d - inset + 0.02); g.add(fr);
        g.add(M(G('wincross', () => new THREE.BoxGeometry(0.4, 0.025, 0.02)), MAT.dark, x, H * 0.55, d - inset + 0.03));
    }
    // Pipes up the side.
    g.add(M(G(`sidepipe${H}`, () => new THREE.CylinderGeometry(0.06, 0.06, H, 8)), metal('copper'), w - inset + 0.02, H / 2, d * 0.6));
    const emitters = [];
    // Chimneys / stacks.
    const nStack = style === 'foundry' ? 2 : style === 'station' ? 2 : 1;
    for (let i = 0; i < nStack; i++) {
        const sh = style === 'foundry' ? 2.2 : 1.0;
        const x = style === 'foundry' ? 0.6 + i * (w - 1.2) : style === 'station' ? 0.5 + i * (w - 1) : w * 0.75;
        const st = M(G(`stack${sh}`, () => new THREE.CylinderGeometry(0.16, 0.2, sh, 10)), style === 'foundry' ? MAT.dark : metal('iron'), x, H + sh / 2 + (style === 'station' ? -0.2 : 0.1), d * 0.35);
        g.add(st);
        g.add(M(G('stackband', () => new THREE.TorusGeometry(0.19, 0.03, 6, 14)), metal('brass'), x, H + sh + 0.05, d * 0.35));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
        emitters.push({ pos: new THREE.Vector3(x, H + sh + 0.25, d * 0.35), kind: style === 'station' ? 'steam' : 'smoke', rate: style === 'foundry' ? 4 : 1.6 });
    }
    // Style details and signs.
    const front = d + 0.01;
    if (style === 'station') {
        const s = sign('BOILER STATION', 'Repairs · Locker · Workbench', 2.6, '#6a1a14', '#ffe8c0', '♨');
        s.position.set(w / 2, H + 0.05, front + 0.25); g.add(s);
        const gauge = new THREE.Group();
        gauge.add(M(G('bgauge', () => new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24)), metal('brass')), M(G('bgaugef', () => new THREE.CylinderGeometry(0.36, 0.36, 0.11, 24)), metal('cream')));
        const needle = M(G('needle', () => new THREE.BoxGeometry(0.04, 0.32, 0.02)), metal('red'), 0, 0.12, 0.07); gauge.add(needle);
        gauge.rotation.x = Math.PI / 2; gauge.position.set(dx < w / 2 ? w - 0.8 : 0.8, H * 0.72, front);
        g.add(gauge);
        g.userData.needle = needle;
    } else if (style === 'shop') {
        const aw = new THREE.Mesh(G('awning', () => new THREE.PlaneGeometry(1.4, 0.7)), new THREE.MeshStandardMaterial({ map: stripesTex(), side: THREE.DoubleSide, roughness: 0.9 }));
        aw.rotation.x = -1.0; aw.position.set(dx, 1.62, front + 0.28); aw.castShadow = true; g.add(aw);
        const s = sign('PARTS EXCHANGE', 'Spikes · Kits · Cards', 2.4, '#14304a', '#c8f0ff', '⚙'); s.position.set(w / 2, H + 0.4, front + 0.08); g.add(s);
        for (const x of [0.4, w - 0.5]) if (Math.abs(x - dx) > 0.8) { const c = M(JUNKGEO('crate'), junkSolid('#8a6a4a'), x, 0, front + 0.35); c.scale.setScalar(0.7); g.add(c); }
    } else if (style === 'foundry') {
        const gr = M(gearGeo(0.9, 16, 0.12), metal('brass'), w / 2, H - 0.2, front + 0.08);
        g.add(gr); g.userData.gear = gr;
        const tcol = opts.type ? TYPE_INFO[opts.type].color : '#c8902a';
        const s = sign('FOUNDRY', opts.leader ? `Forgemaster ${opts.leader}` : 'Grand Gearworks Circuit', 2.6, '#1a1410', tcol, opts.type ? TYPE_INFO[opts.type].icon : '⚙'); s.position.set(w / 2, H + 1.2, front - 0.3); g.add(s);
        for (const x of [0.6, w - 0.6]) { const b = M(G('banner', () => new THREE.PlaneGeometry(0.5, 1.2)), new THREE.MeshStandardMaterial({ color: tcol, roughness: 0.9, side: THREE.DoubleSide }), x, H * 0.5, front + 0.03, false); g.add(b); }
        g.add(M(new THREE.PlaneGeometry(w * 0.5, 0.4), glow('#ff7a2a', 1.2), w / 2, 0.45, front + 0.005, false));
    } else if (style === 'workshop') {
        const s = sign('BELLOWS & KIN', 'Wrights since forever', 2.2, '#2a1a10', '#f0d090', '🔧'); s.position.set(w / 2, H + 0.75, front - 0.1); g.add(s);
        const crane = new THREE.Group();
        crane.add(M(G('cpost', () => new THREE.BoxGeometry(0.12, 1.4, 0.12)), metal('iron'), 0, 0.7, 0), M(G('cboom', () => new THREE.BoxGeometry(1.6, 0.1, 0.1)), metal('yellow'), 0.7, 1.35, 0), M(G('chook', () => new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI * 1.4)), metal('iron'), 1.4, 0.9, 0));
        crane.position.set(w - 0.8, H + 0.3, d * 0.5); g.add(crane);
    } else {
        if (opts.label) { const s = sign(opts.label, '', 1.6, '#2a1a10', '#f0d090'); s.position.set(w / 2, H + 0.45, front + 0.02); g.add(s); }
    }
    g.userData.emitters = emitters;
    return g;
}
const JUNKGEO = (k) => G(`junk:${k}`, JUNK[k]);
export { JUNKGEO };
let stripes = null;
function stripesTex() {
    if (stripes) return stripes;
    const c = document.createElement('canvas'); c.width = 128; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8dcc0' : '#2e8a8a'; g.fillRect(i * 16, 0, 16, 16); }
    stripes = new THREE.CanvasTexture(c); stripes.colorSpace = THREE.SRGBColorSpace;
    return stripes;
}

// ------------------------------------------------------------------ landmarks
export function buildLandmark(kind, biome) {
    const g = new THREE.Group();
    const em = [];
    const rustM = metal('rust'), ironM = metal('iron'), brassM = metal('brass');
    switch (kind) {
        case 'crane': {
            g.add(M(new THREE.BoxGeometry(0.5, 4, 0.5), metal('yellow'), 0, 2, 0));
            const boom = M(new THREE.BoxGeometry(4.5, 0.25, 0.25), metal('yellow'), 1.8, 4, 0); boom.rotation.z = 0.15; g.add(boom);
            g.add(M(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), MAT.dark, 3.8, 3.3, 0), M(G('hk', () => new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI * 1.4)), ironM, 3.8, 2.1, 0));
            g.add(M(new THREE.BoxGeometry(0.8, 0.6, 0.6), metal('yellow'), 0, 4.2, 0));
            break;
        }
        case 'boiler': {
            g.add(M(new THREE.CylinderGeometry(1.1, 1.2, 3.2, 24), metal('copper'), 0, 1.6, 0));
            for (const y of [0.4, 1.4, 2.4]) { const b = M(new THREE.TorusGeometry(1.15, 0.06, 6, 30), brassM, 0, y, 0); b.rotation.x = Math.PI / 2; g.add(b); }
            g.add(M(new THREE.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal('copper'), 0, 3.2, 0));
            g.add(M(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 10), ironM, 0.5, 4.2, 0));
            em.push({ pos: new THREE.Vector3(0.5, 5, 0), kind: 'steam', rate: 5 });
            g.add(M(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20), metal('cream'), 0, 1.8, 1.17)); g.children[g.children.length - 1].rotation.x = Math.PI / 2;
            break;
        }
        case 'giantgear': {
            const gr = M(gearGeo(3, 18, 0.5), metal('bronze', { rustScale: 2 }), 0, 1.2, 0); gr.rotation.set(0, 0.6, 0.2); g.add(gr);
            const gr2 = M(gearGeo(1.6, 12, 0.4), rustM, 2.6, 0.4, 1.2); gr2.rotation.set(-1.2, 0, 0.3); g.add(gr2);
            break;
        }
        case 'shiphull': {
            const hull = M(new THREE.CapsuleGeometry(1.4, 5.5, 6, 18), metal('gunmetal', { rustScale: 2.2 }), 0, 0.7, 0); hull.rotation.set(0.15, 0.3, Math.PI / 2 - 0.12); g.add(hull);
            for (let i = 0; i < 6; i++) { const r = M(new THREE.TorusGeometry(1.45, 0.08, 6, 24, Math.PI * 1.2), rustM, -2.6 + i * 1.05, 0.7, 0); r.rotation.y = Math.PI / 2 + 0.3; r.rotation.z = -0.3; g.add(r); }
            for (let i = 0; i < 5; i++) g.add(M(G('hwin', () => new THREE.CircleGeometry(0.16, 12)), glow(i % 2 ? '#8ad8ff' : '#ffcc6a', 1.2), -2 + i * 1.0, 1.4, 1.3, false));
            const fin = M(new THREE.BoxGeometry(0.15, 2.6, 2.2), metal('rust'), 3.6, 2.2, 0); fin.rotation.z = -0.4; g.add(fin);
            em.push({ pos: new THREE.Vector3(1.5, 2.6, 0.5), kind: 'smoke', rate: 1 });
            break;
        }
        case 'rocketfin': {
            for (let i = 0; i < 3; i++) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.6, 0); s.lineTo(0.3, 2.8); s.lineTo(0, 2.6); const f = M(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }), i === 1 ? metal('red') : metal('steel', { rustScale: 2 }), 0, 0, 0); f.rotation.y = (i / 3) * Math.PI * 2; g.add(f); }
            g.add(M(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 16), ironM, 0, 0.3, 0));
            g.rotation.z = 0.25;
            break;
        }
        case 'pylon': {
            const m = M(mastGeometry(), ironM, 0, 0, 0); m.scale.set(1.4, 1.6, 1.4); g.add(m);
            for (const x of [-0.9, 0.9]) { g.add(M(G('insul', () => new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8)), metal('cream'), x, 4.9, 0)); }
            g.add(M(new THREE.BoxGeometry(2, 0.08, 0.08), ironM, 0, 5.1, 0));
            g.add(M(G('plamp', () => new THREE.SphereGeometry(0.1, 8, 6)), glow('#ff3a2a', 3), 0, 6.1, 0));
            em.push({ pos: new THREE.Vector3(0.9, 4.8, 0), kind: 'spark', rate: 0.8 });
            break;
        }
        case 'teslatower': {
            g.add(M(new THREE.CylinderGeometry(0.4, 0.9, 5, 12), metal('gunmetal'), 0, 2.5, 0));
            for (let i = 0; i < 8; i++) { const r = M(new THREE.TorusGeometry(0.55 - i * 0.03, 0.08, 6, 20), metal('copper'), 0, 1.5 + i * 0.45, 0); r.rotation.x = Math.PI / 2; g.add(r); }
            g.add(M(new THREE.SphereGeometry(0.85, 20, 14), glow('#8ad8ff', 2.6), 0, 5.8, 0));
            g.add(M(new THREE.TorusGeometry(1.0, 0.1, 8, 24), brassM, 0, 5.8, 0));
            em.push({ pos: new THREE.Vector3(0, 5.8, 0), kind: 'spark', rate: 6, color: '#8ad8ff', bolt: true });
            break;
        }
        case 'refinery': {
            for (const [x, z, r, h] of [[0, 0, 1.0, 3], [2.2, 0.4, 0.7, 2.2], [-1.8, 0.8, 0.6, 2.6]]) { g.add(M(new THREE.CylinderGeometry(r, r, h, 18), metal('verdigris', { rustScale: 1.5 }), x, h / 2, z)); g.add(M(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ironM, x, h, z)); }
            g.add(M(new THREE.CylinderGeometry(0.25, 0.3, 5, 10), MAT.dark, 1.2, 2.5, -1));
            em.push({ pos: new THREE.Vector3(1.2, 5.2, -1), kind: 'smoke', rate: 4, color: '#6a8a3a' });
            for (let i = 0; i < 4; i++) g.add(M(G('rglow', () => new THREE.CircleGeometry(0.2, 12)), glow('#aaff4a', 2), -0.5 + i * 0.5, 1.2, 1.01, false));
            break;
        }
        case 'cryoship': {
            const hull = M(new THREE.CapsuleGeometry(1.6, 5, 6, 18), metal('white', { rustScale: 0.5 }), 0, 1, 0); hull.rotation.set(0, 0.2, Math.PI / 2 + 0.2); g.add(hull);
            for (let i = 0; i < 14; i++) { const ic = M(G('icicle', () => new THREE.ConeGeometry(0.12, 0.7, 6)), MAT.ice, -2.5 + i * 0.4, 0.4 + (i % 3) * 0.1, 1.4 - (i % 2) * 0.4); ic.rotation.x = Math.PI; g.add(ic); }
            for (let i = 0; i < 4; i++) g.add(M(G('cwin', () => new THREE.CircleGeometry(0.2, 12)), glow('#8ae8ff', 1.4), -1.5 + i * 1.1, 1.6, 1.45, false));
            em.push({ pos: new THREE.Vector3(0, 2.6, 0), kind: 'steam', rate: 2 });
            break;
        }
        case 'ship': {
            const hull = M(new THREE.CapsuleGeometry(1.2, 5, 6, 16), metal('black'), 0, 0.2, 0); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.7); g.add(hull);
            g.add(M(new THREE.BoxGeometry(3.4, 0.9, 1.4), metal('cream'), 0, 1.4, 0));
            for (const x of [-0.8, 0.8]) { g.add(M(new THREE.CylinderGeometry(0.3, 0.32, 1.6, 12), metal('red'), x, 2.6, 0)); em.push({ pos: new THREE.Vector3(x, 3.5, 0), kind: 'smoke', rate: 2 }); }
            const wheel = M(gearGeo(0.9, 14, 0.2), metal('red'), -3, 0.6, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel); g.userData.gear = wheel;
            break;
        }
        case 'airship': {
            const env = M(new THREE.SphereGeometry(1.5, 24, 16), metal('cream'), 0, 7, 0); env.scale.set(2.8, 1, 1); g.add(env);
            for (let i = 0; i < 5; i++) { const b = M(new THREE.TorusGeometry(1.5, 0.04, 6, 30), brassM, -3 + i * 1.5, 7, 0); b.rotation.y = Math.PI / 2; b.scale.set(1, Math.cos((i - 2) * 0.55), Math.cos((i - 2) * 0.55)); g.add(b); }
            g.add(M(new THREE.BoxGeometry(2, 0.5, 0.7), metal('bronze'), 0, 5.2, 0));
            const prop = M(new THREE.BoxGeometry(0.06, 1.4, 0.15), ironM, -4.4, 7, 0); g.add(prop); g.userData.prop = prop;
            g.userData.float = true;
            break;
        }
        case 'holo': {
            g.add(M(new THREE.CylinderGeometry(0.4, 0.5, 0.4, 16), metal('gunmetal'), 0, 0.2, 0));
            const h = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#4ad8ff', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            h.position.y = 1.2; h.rotation.x = Math.PI; g.add(h);
            const s = new THREE.Mesh(new THREE.TorusKnotGeometry(0.35, 0.08, 64, 8), new THREE.MeshBasicMaterial({ color: '#8ae8ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, wireframe: true }));
            s.position.y = 1.5; g.add(s); g.userData.spin = s;
            break;
        }
        case 'skyrail': break;
    }
    g.userData.emitters = em;
    return g;
}

// ------------------------------------------------------------------ furniture and machinery
export function buildFurniture(style, seed) {
    const g = new THREE.Group();
    const r = (seed % 997) / 997;
    const kinds = {
        station: ['boilerTank', 'pipes', 'cabinet', 'gaugeWall'],
        shop: ['shelf', 'shelf', 'crates', 'barrels'],
        house: ['shelf', 'table', 'bed', 'stove'],
        shack: ['bed', 'table', 'crates'],
        workshop: ['anvil', 'shelf', 'crates', 'stove', 'pipes'],
        arena: ['statue', 'brazier'],
        crown: ['statue', 'brazier'],
        dungeon: ['console', 'pipes', 'tank', 'crates'],
        foundry: ['anvil', 'brazier', 'gaugeWall'],
    };
    const key = style.startsWith('foundry') ? 'foundry' : style.startsWith('elite') ? 'arena' : kinds[style] ? style : 'dungeon';
    const list = kinds[key];
    const k = list[Math.floor(r * list.length)];
    switch (k) {
        case 'boilerTank': g.add(M(G('fbt', () => new THREE.CylinderGeometry(0.38, 0.4, 1.4, 16)), metal('copper'), 0, 0.7, 0), M(G('fbtd', () => new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), metal('brass'), 0, 1.4, 0), M(G('fbtg', () => new THREE.CircleGeometry(0.12, 12)), glow('#ffcc6a', 1.2), 0, 0.9, 0.41, false)); break;
        case 'pipes': for (let i = 0; i < 3; i++) g.add(M(G('fpipe', () => new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8)), metal(i % 2 ? 'copper' : 'iron'), -0.25 + i * 0.25, 0.9, -0.2)); g.add(M(G('fvalve', () => new THREE.TorusGeometry(0.12, 0.025, 6, 12)), metal('red'), 0, 1.1, -0.05)); break;
        case 'cabinet': g.add(M(G('fcab', () => new RoundedBoxGeometry(0.9, 1.6, 0.5, 2, 0.04)), metal('brass'), 0, 0.8, 0)); for (let i = 0; i < 3; i++) g.add(M(G('fcabd', () => new THREE.BoxGeometry(0.8, 0.02, 0.02)), MAT.dark, 0, 0.4 + i * 0.45, 0.26)); break;
        case 'gaugeWall': g.add(M(G('fgw', () => new THREE.BoxGeometry(0.9, 1.6, 0.25)), metal('gunmetal'), 0, 0.8, -0.2)); for (let i = 0; i < 4; i++) g.add(M(G('fgwg', () => new THREE.CircleGeometry(0.13, 14)), glow(i % 2 ? '#ffcc6a' : '#8affa8', 1), -0.2 + (i % 2) * 0.4, 0.6 + Math.floor(i / 2) * 0.5, -0.07, false)); break;
        case 'shelf': g.add(M(G('fsh', () => new THREE.BoxGeometry(0.9, 1.5, 0.4)), texMat('planks', '#ffffff'), 0, 0.75, -0.2)); for (let i = 0; i < 4; i++) g.add(M(G('fshi', () => new THREE.BoxGeometry(0.18, 0.2, 0.2)), metal(['brass', 'copper', 'red', 'teal'][i]), -0.3 + i * 0.2, 0.55 + (i % 2) * 0.5, -0.1)); break;
        case 'crates': g.add(M(JUNKGEO('crate'), junkSolid('#8a6a4a'), 0, 0, 0), M(JUNKGEO('crate'), junkSolid('#7a5a3a'), 0.1, 0.6, 0.05)); g.children[1].scale.setScalar(0.7); break;
        case 'barrels': g.add(M(JUNKGEO('barrel'), metal('blue'), -0.2, 0, 0), M(JUNKGEO('barrel'), metal('red'), 0.25, 0, 0.1)); break;
        case 'table': g.add(M(G('ftab', () => new THREE.BoxGeometry(0.9, 0.08, 0.7)), texMat('planks', '#ffffff'), 0, 0.6, 0)); for (const [x, z] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]]) g.add(M(G('ftleg', () => new THREE.BoxGeometry(0.06, 0.6, 0.06)), MAT.dark, x, 0.3, z)); g.add(M(G('fmug', () => new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10)), metal('copper'), 0.1, 0.7, 0.1)); break;
        case 'bed': g.add(M(G('fbed', () => new RoundedBoxGeometry(0.9, 0.35, 0.9, 2, 0.05)), new THREE.MeshStandardMaterial({ color: '#8a3a2a', roughness: 1 }), 0, 0.3, 0), M(G('fpil', () => new RoundedBoxGeometry(0.5, 0.12, 0.25, 2, 0.05)), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 1 }), 0, 0.52, -0.28)); break;
        case 'stove': g.add(M(G('fst', () => new RoundedBoxGeometry(0.7, 0.8, 0.6, 2, 0.06)), MAT.dark, 0, 0.4, 0), M(G('fstg', () => new THREE.PlaneGeometry(0.4, 0.25)), glow('#ff7a2a', 2), 0, 0.35, 0.31, false), M(G('fstp', () => new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8)), metal('iron'), 0.2, 1.3, -0.15)); g.userData.emitters = [{ pos: new THREE.Vector3(0, 0.4, 0.4), kind: 'ember', rate: 1 }]; break;
        case 'anvil': g.add(M(G('fanv', () => new THREE.BoxGeometry(0.7, 0.25, 0.3)), metal('iron'), 0, 0.65, 0), M(G('fanvb', () => new THREE.BoxGeometry(0.3, 0.5, 0.3)), metal('gunmetal'), 0, 0.27, 0), M(G('fanvh', () => new THREE.ConeGeometry(0.12, 0.35, 8)), metal('iron'), 0.45, 0.68, 0)); g.children[2].rotation.z = -Math.PI / 2; break;
        case 'brazier': g.add(M(G('fbr', () => new THREE.CylinderGeometry(0.35, 0.18, 0.5, 12)), metal('brass'), 0, 0.85, 0), M(G('fbrs', () => new THREE.CylinderGeometry(0.06, 0.12, 0.6, 8)), metal('iron'), 0, 0.3, 0), M(G('fbrf', () => new THREE.SphereGeometry(0.25, 10, 8)), glow('#ff8a2a', 3), 0, 1.15, 0)); g.userData.emitters = [{ pos: new THREE.Vector3(0, 1.2, 0), kind: 'ember', rate: 3 }]; g.userData.light = '#ff8a3a'; break;
        case 'statue': g.add(M(G('fstb', () => new THREE.BoxGeometry(0.7, 0.4, 0.7)), metal('gunmetal'), 0, 0.2, 0), M(gearGeo(0.45, 12, 0.12), metal('gold'), 0, 1.0, 0)); break;
        case 'console': g.add(M(G('fcon', () => new RoundedBoxGeometry(0.9, 0.9, 0.6, 2, 0.05)), metal('gunmetal'), 0, 0.45, 0), M(G('fcons', () => new THREE.PlaneGeometry(0.6, 0.35)), glow(r > 0.5 ? '#4ad8ff' : '#aaff6a', 1.4), 0, 0.7, 0.31, false)); break;
        case 'tank': g.add(M(G('ftank', () => new THREE.CylinderGeometry(0.4, 0.4, 1.3, 14)), metal('verdigris'), 0, 0.65, 0), M(G('ftankw', () => new THREE.PlaneGeometry(0.2, 0.7)), glow('#aaff6a', 1.2), 0, 0.7, 0.41, false)); break;
    }
    return g;
}

/** Entities that are objects rather than people. */
export function buildThing(kind, opts = {}) {
    const g = new THREE.Group();
    switch (kind) {
        case 'sign': g.add(M(G('spost', () => new THREE.BoxGeometry(0.1, 1.0, 0.1)), texMat('planks', '#ffffff'), 0, 0.5, 0), M(G('sboard', () => new RoundedBoxGeometry(0.9, 0.5, 0.08, 2, 0.02)), texMat('planks', '#e8c8a0'), 0, 1.0, 0), M(G('sbrass', () => new THREE.BoxGeometry(0.7, 0.08, 0.1)), metal('brass'), 0, 1.0, 0.02)); break;
        case 'item': {
            const c = M(G('icrate', () => new RoundedBoxGeometry(0.4, 0.32, 0.32, 2, 0.04)), texMat('planks', '#ffffff'), 0, 0.2, 0);
            c.add(M(G('iband', () => new THREE.BoxGeometry(0.42, 0.06, 0.34)), glow('#ffcc4a', 1.5), 0, 0, 0));
            g.add(c); g.userData.bob = c; g.userData.sparkle = '#ffd86a';
            break;
        }
        case 'heap': g.add(M(JUNKGEO('mound'), junkSolid('#6a5038'), 0, 0, 0), M(JUNKGEO('gear'), metal('brass'), 0.1, 0.25, 0.05)); g.children[0].scale.set(0.8, 0.7, 0.8); g.children[1].scale.setScalar(0.4); g.userData.sparkle = '#ffe8a0'; break;
        case 'locker': for (let i = 0; i < 2; i++) { g.add(M(G('lock', () => new RoundedBoxGeometry(0.42, 1.6, 0.5, 2, 0.03)), metal('brass'), -0.22 + i * 0.44, 0.8, -0.1)); g.add(M(G('lockv', () => new THREE.BoxGeometry(0.3, 0.04, 0.02)), MAT.dark, -0.22 + i * 0.44, 1.3, 0.16)); g.add(M(G('lockl', () => new THREE.SphereGeometry(0.03, 6, 4)), glow('#8affa8', 2), -0.22 + i * 0.44, 1.0, 0.16)); } break;
        case 'bench': {
            g.add(M(G('wbt', () => new RoundedBoxGeometry(1.0, 0.1, 0.6, 2, 0.02)), texMat('planks', '#ffffff'), 0, 0.75, 0));
            for (const x of [-0.42, 0.42]) g.add(M(G('wbl', () => new THREE.BoxGeometry(0.08, 0.75, 0.5)), metal('iron'), x, 0.37, 0));
            g.add(M(G('wbv', () => new THREE.BoxGeometry(0.18, 0.18, 0.18)), metal('gunmetal'), -0.3, 0.88, 0.1), M(gearGeo(0.12, 10, 0.04), metal('brass'), 0.2, 0.82, 0), M(G('wblamp', () => new THREE.SphereGeometry(0.07, 10, 8)), glow('#ffcc6a', 2.2), 0.35, 1.1, -0.2), M(G('wblarm', () => new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5)), metal('brass'), 0.35, 0.9, -0.2));
            g.children[g.children.length - 3].rotation.x = Math.PI / 2;
            g.userData.light = '#ffcc6a';
            break;
        }
        case 'fence': {
            for (const x of [-0.45, 0.45]) g.add(M(G('fpost', () => new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6)), metal('iron'), x, 0.65, 0));
            g.add(M(G('fmesh', () => new THREE.PlaneGeometry(0.9, 1.1, 1, 1)), new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.8, roughness: 0.4, wireframe: true }), 0, 0.65, 0));
            for (let i = 0; i < 3; i++) g.add(M(G('fstripe', () => new THREE.BoxGeometry(0.95, 0.08, 0.03)), metal(i % 2 ? 'black' : 'yellow'), 0, 0.3 + i * 0.4, 0.02));
            g.add(M(G('fchain', () => new THREE.TorusGeometry(0.15, 0.03, 6, 12)), metal('steel'), 0, 0.7, 0.05), M(G('flock', () => new THREE.BoxGeometry(0.14, 0.16, 0.06)), metal('brass'), 0, 0.55, 0.08));
            break;
        }
        case 'block': {
            g.add(M(G('eblk', () => new RoundedBoxGeometry(0.95, 0.8, 0.9, 2, 0.06)), metal('gunmetal', { rustScale: 2 }), 0, 0.4, 0));
            for (let i = 0; i < 3; i++) g.add(M(G('ecyl', () => new THREE.CylinderGeometry(0.12, 0.12, 0.4, 10)), metal('iron'), -0.28 + i * 0.28, 0.95, 0));
            g.add(M(G('emag', () => new THREE.BoxGeometry(0.3, 0.06, 0.92)), metal('red'), 0, 0.82, 0));
            break;
        }
        case 'ledge': {
            const m = M(G('ledge', () => { const b = new THREE.BoxGeometry(1.02, 0.28, 0.5); b.translate(0, 0.14, 0); return b; }), metal(opts.metal || 'rust'), 0, 0, 0.25);
            g.add(m);
            break;
        }
        case 'doorframe': {
            g.add(M(G('dfr', () => new THREE.BoxGeometry(0.95, 1.5, 0.2)), metal('brass'), 0, 0.75, -0.45), M(G('dfd', () => new THREE.BoxGeometry(0.75, 1.35, 0.1)), new THREE.MeshBasicMaterial({ color: '#05070a' }), 0, 0.68, -0.38));
            g.add(M(G('dfl', () => new THREE.SphereGeometry(0.06, 8, 6)), glow(opts.color || '#ffcc6a', 2.5), 0, 1.6, -0.35));
            break;
        }
        case 'mat': g.add(M(G('dmat', () => new THREE.BoxGeometry(0.9, 0.03, 0.7)), new THREE.MeshStandardMaterial({ color: '#8a2a1a', roughness: 1 }), 0, 0.015, 0, false)); break;
        case 'counter': g.add(M(G('ctr', () => new RoundedBoxGeometry(1.0, 0.95, 0.9, 2, 0.04)), texMat('planks', '#c89a6a'), 0, 0.47, 0), M(G('ctrt', () => new THREE.BoxGeometry(1.02, 0.06, 0.92)), metal('brass'), 0, 0.96, 0)); break;
        case 'lamp': g.add(M(G('lpost', () => new THREE.CylinderGeometry(0.05, 0.08, 2.2, 8)), metal('iron'), 0, 1.1, 0), M(G('lhead', () => new THREE.CylinderGeometry(0.16, 0.12, 0.3, 6)), metal('brass'), 0, 2.3, 0), M(G('lglass', () => new THREE.SphereGeometry(0.12, 10, 8)), glow('#ffcc6a', 3.5), 0, 2.28, 0), M(G('lcap', () => new THREE.ConeGeometry(0.2, 0.14, 6)), metal('iron'), 0, 2.52, 0)); g.userData.light = '#ffc870'; break;
        case 'skiff': {
            g.add(M(G('skh', () => new RoundedBoxGeometry(0.9, 0.18, 1.3, 2, 0.08)), metal('teal'), 0, 0.1, 0), M(G('skfan', () => new THREE.TorusGeometry(0.28, 0.04, 6, 16)), metal('brass'), 0, 0.5, -0.55));
            const fan = M(G('skb', () => new THREE.BoxGeometry(0.5, 0.05, 0.02)), metal('iron'), 0, 0.5, -0.55); g.add(fan); g.userData.fan = fan;
            break;
        }
    }
    return g;
}
