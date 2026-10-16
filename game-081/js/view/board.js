// The Lumen Lens: the scan scene. The patient floats behind the grid as an X-ray hologram; each body
// cell is a glass tile; each affliction is a small 3D glyph (its form) on a ring (its nature), lit
// in its aura's colour and scaled by its depth. Reads the scan state; never changes it.
//
// sync(S, events) reconciles the board with the state after every action: events only supply the
// flourishes (where a new mote falls from, which motes pop), so the board can never drift from S.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HUES, SEVS, SCHOOLS } from '../sim/data/ailments.js';
import { xrayMaterial, holoBackdrop, timeUniform } from './shaders.js';
import { buildModel } from './models.js';
import { glow } from './textures.js';
import { Bursts } from './fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ glyphs

function placed(geo, pos, rot, scale) {
    const g = geo.clone();
    const m = new THREE.Matrix4().compose(pos ?? V(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))), scale ? V(...scale) : V(1, 1, 1));
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    return g;
}
const merge = (list) => { const ng = list.map((g) => (g.index ? g.toNonIndexed() : g)); return mergeGeometries(ng); };
const teardrop = (r, h) => new THREE.LatheGeometry([...Array(13).keys()].map((i) => { const t = i / 12; return new THREE.Vector2(Math.max(0.001, Math.sin(t * Math.PI) ** 0.9 * r * (1 - t * 0.55)), -h / 2 + t * h); }), 16);

const GLYPHS = {};
function glyph(kind) {
    if (GLYPHS[kind]) return GLYPHS[kind];
    const S = (r, d = 12) => new THREE.SphereGeometry(r, d, Math.max(6, d * 0.7));
    let parts;
    switch (kind) {
        case 'nightshade': parts = [placed(S(0.13), V(-0.1, -0.05, 0)), placed(S(0.13), V(0.1, -0.05, 0)), placed(S(0.12), V(0, 0.12, 0.02)), placed(new THREE.ConeGeometry(0.06, 0.16, 5), V(0.08, 0.24, 0), [0, 0, -0.8])]; break;
        case 'wyrmbile': parts = [placed(teardrop(0.17, 0.42), V(0, 0, 0), [Math.PI, 0, 0])]; break;
        case 'spider': {
            parts = [placed(S(0.12), V(0, 0.02, 0)), placed(S(0.08), V(0, 0.15, 0.03))];
            for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; parts.push(placed(new THREE.CylinderGeometry(0.016, 0.01, 0.3, 4), V(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0), [0, 0, a + Math.PI / 2])); }
            break;
        }
        case 'rotspore': parts = [placed(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), V(0, 0, 0)), placed(new THREE.CylinderGeometry(0.06, 0.08, 0.18, 8), V(0, -0.09, 0)), placed(S(0.04), V(0.08, 0.12, 0.08)), placed(S(0.035), V(-0.09, 0.1, 0.06))]; break;
        case 'gash': parts = [placed(new THREE.TorusGeometry(0.17, 0.05, 6, 20, Math.PI * 1.1), V(0.0, -0.05, 0), [0, 0, 0.6], [1, 1, 0.45])]; break;
        case 'bruise': parts = [placed(S(0.2, 16), V(0, 0, 0), null, [1, 0.8, 0.45]), placed(new THREE.TorusGeometry(0.2, 0.025, 6, 24), V(0, 0, 0.02))]; break;
        case 'thorn': parts = [placed(new THREE.ConeGeometry(0.1, 0.46, 8), V(0, 0, 0)), placed(new THREE.ConeGeometry(0.05, 0.18, 6), V(0.1, -0.04, 0), [0, 0, -1.0]), placed(new THREE.ConeGeometry(0.05, 0.16, 6), V(-0.1, -0.1, 0), [0, 0, 1.0])]; break;
        case 'fracture': {
            const s = new THREE.Shape();
            s.moveTo(-0.06, 0.24); s.lineTo(0.1, 0.24); s.lineTo(0.0, 0.04); s.lineTo(0.12, 0.04); s.lineTo(-0.08, -0.26); s.lineTo(-0.02, -0.04); s.lineTo(-0.13, -0.04); s.lineTo(-0.06, 0.24);
            parts = [placed(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }), V(0, 0, -0.04))];
            break;
        }
        case 'sigil': {
            parts = [placed(new THREE.TorusGeometry(0.19, 0.03, 6, 28), V(0, 0, 0))];
            for (let i = 0; i < 3; i++) parts.push(placed(new THREE.BoxGeometry(0.34, 0.035, 0.035), V(0, 0, 0), [0, 0, (i / 3) * Math.PI]));
            parts.push(placed(S(0.06), V(0, 0, 0)));
            break;
        }
        case 'wither': {
            const s = new THREE.Shape();
            s.moveTo(0, -0.24); s.quadraticCurveTo(0.22, -0.05, 0.02, 0.25); s.quadraticCurveTo(-0.2, 0.0, 0, -0.24);
            parts = [placed(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }), V(0, 0, -0.015), [0.3, 0, 0.4]), placed(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), V(0, 0, 0.02), [0, 0, 0.4])];
            break;
        }
        case 'nightmare': parts = [placed(S(0.19, 16), V(0, 0, 0), null, [1.25, 0.8, 0.6]), placed(new THREE.TorusGeometry(0.2, 0.025, 6, 24), V(0, 0, 0), null, [1.25, 0.85, 1])]; break;
        case 'chain': parts = [placed(new THREE.TorusGeometry(0.1, 0.035, 6, 16), V(-0.07, 0.06, 0), null, [1, 1.5, 1]), placed(new THREE.TorusGeometry(0.1, 0.035, 6, 16), V(0.07, -0.06, 0), [0, Math.PI / 2, 0], [1, 1.5, 1])]; break;
        case 'scorch': parts = [placed(teardrop(0.17, 0.48), V(0, 0.02, 0)), placed(teardrop(0.08, 0.24), V(0.11, -0.08, 0.03), [0, 0, -0.4])]; break;
        case 'holyfire': {
            parts = [placed(S(0.11), V(0, 0, 0))];
            for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(placed(new THREE.ConeGeometry(0.04, 0.14, 4), V(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0), [0, 0, a - Math.PI / 2])); }
            break;
        }
        case 'frostbite': {
            parts = [placed(new THREE.OctahedronGeometry(0.08), V(0, 0, 0))];
            for (let i = 0; i < 3; i++) parts.push(placed(new THREE.BoxGeometry(0.44, 0.035, 0.035), V(0, 0, 0), [0, 0, (i / 3) * Math.PI]));
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(placed(new THREE.BoxGeometry(0.1, 0.025, 0.025), V(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0), [0, 0, a + 0.8])); }
            break;
        }
        case 'acid': parts = [placed(S(0.12), V(-0.07, -0.06, 0)), placed(S(0.09), V(0.1, -0.02, 0.02)), placed(S(0.065), V(0.0, 0.13, 0.03)), placed(S(0.04), V(0.13, 0.15, 0))]; break;
        default: parts = [placed(S(0.18), V(0, 0, 0))];
    }
    GLYPHS[kind] = merge(parts);
    GLYPHS[kind].computeVertexNormals();
    return GLYPHS[kind];
}

const SCHOOL_SIDES = { venom: 6, wound: 32, hex: 3, blight: 4 };
const RINGS = {};
function ringGeo(school) {
    if (!RINGS[school]) RINGS[school] = new THREE.RingGeometry(0.33, 0.4, SCHOOL_SIDES[school], 1, school === 'blight' ? Math.PI / 4 : school === 'hex' ? Math.PI / 2 : 0);
    return RINGS[school];
}

const BLOOM_GEO = (() => {
    const parts = [placed(new THREE.SphereGeometry(0.1, 12, 8), V(0, 0, 0.05))];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(placed(new THREE.SphereGeometry(0.1, 10, 6), V(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0), null, [1.4, 0.8, 0.4])); }
    return merge(parts);
})();

// ------------------------------------------------------------------ the scan view

export class ScanView {
    constructor(stage) {
        this.stage = stage;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050a14);
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), holoBackdrop(0x3a8cff));
        back.position.z = -18;
        this.scene.add(back);
        this.back = back;
        this.scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x101830, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 8); this.scene.add(key);
        this.scene.environment = stage.envRoom;
        this.board = new THREE.Group();
        this.scene.add(this.board);
        this.patientRoot = new THREE.Group();
        this.patientRoot.position.z = -6;
        this.scene.add(this.patientRoot);
        this.bursts = new Bursts(900);
        this.scene.add(this.bursts.points);
        this.pip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: new THREE.Color(0.35, 0.7, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.pip.scale.setScalar(0.9);
        this.pip.renderOrder = 10;
        this.scene.add(this.pip);
        this.pipCore = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.05, 1.25) }));
        this.pip.add(this.pipCore);
        this.objs = new Map();      // mote id → { g, mat, ring, r, c, bound }
        this.tiles = [];
        this.dying = [];
        this.path = [];
        this.trail = null;
        this.hint = null;
        this.cursor = null;
        this.armed = null;
        this.insets = { top: 120, bottom: 150, left: 12, right: 12 };
        this.pipTarget = V(0, 0, 1);
        this.raycaster = new THREE.Raycaster();
        this.plane = new THREE.Plane(V(0, 0, 1), 0);
        this.tileGeo = new RoundedBoxGeometry(0.94, 0.94, 0.12, 2, 0.06);
        this.tileMat = new THREE.MeshPhysicalMaterial({ color: 0x06121f, roughness: 0.2, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.68, emissive: 0x0a3a6a, emissiveIntensity: 0.1 });
        this.scarMat = new THREE.MeshStandardMaterial({ color: 0xb07a80, roughness: 0.85, emissive: 0x3a1a20, emissiveIntensity: 0.4 });
        this.chainMat = new THREE.MeshStandardMaterial({ color: 0xc0a8ff, metalness: 0.8, roughness: 0.3, emissive: 0x7a3aff, emissiveIntensity: 1.0 });
    }

    /** Start a scan: build the X-ray patient and the grid. */
    open(S, species, name) {
        this.close();
        this.species = species;
        const model = buildModel(species, name);
        const xr = xrayMaterial(0x58c8ff);
        this.xray = xr;
        model.traverse((o) => {
            if (o.isLight) o.visible = false;
            if (o.isSprite) o.visible = false;
            if (o.isMesh) { o.material = xr; o.castShadow = false; }
        });
        const h = model.userData.height;
        const s = 8 / Math.max(1, h) * (species === 'dragon' ? 0.75 : 1);
        model.scale.setScalar(s);
        model.position.y = -h * s * 0.5;
        this.patient = model;
        this.patientRoot.add(model);
        this.rebuild(S);
    }

    close() {
        for (const o of this.objs.values()) this.board.remove(o.g);
        this.objs.clear();
        for (const t of this.tiles) this.board.remove(t);
        this.tiles = [];
        for (const d of this.dying) this.board.remove(d.g);
        this.dying = [];
        if (this.patient) { this.patientRoot.remove(this.patient); this.patient = null; }
        this.setPath([]);
        this.setHint(null);
    }

    cellPos(r, c) { return V(c - (this.cols - 1) / 2, (this.rows - 1) / 2 - r, 0); }

    /** Rebuild tiles for a (new) board shape. */
    rebuild(S) {
        for (const t of this.tiles) this.board.remove(t);
        this.tiles = [];
        for (const o of this.objs.values()) this.board.remove(o.g);
        this.objs.clear();
        this.rows = S.rows; this.cols = S.cols;
        this.scars = [];
        for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
            if (S.cells[r][c].hole) continue;
            const t = new THREE.Mesh(this.tileGeo, this.tileMat);
            t.position.copy(this.cellPos(r, c)).setZ(-0.12);
            this.board.add(t);
            this.tiles.push(t);
            const sc = new THREE.Group();
            sc.position.copy(this.cellPos(r, c));
            sc.userData = { r, c };
            for (let i = 0; i < 5; i++) {
                const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + (i % 2) * 0.05, 1), this.scarMat);
                b.position.set(Math.cos(i * 1.3) * 0.18, Math.sin(i * 1.7) * 0.18, 0.05);
                sc.add(b);
            }
            sc.visible = false;
            this.board.add(sc);
            this.tiles.push(sc);
            this.scars.push(sc);
        }
        this.fit();
        this.sync(S, []);
    }

    makeMote(m) {
        const g = new THREE.Group();
        const hue = HUES[m.hue];
        const mat = new THREE.MeshStandardMaterial({ color: hue.hex, emissive: hue.hex, emissiveIntensity: 0.2, roughness: 0.32, metalness: 0.15 });
        const body = new THREE.Mesh(m.bloom ? BLOOM_GEO : glyph(m.kind), m.bloom ? new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc840, emissiveIntensity: 1.4, roughness: 0.2 }) : mat);
        body.position.z = 0.12;
        g.add(body);
        const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SCHOOLS[m.school].css).multiplyScalar(0.85), transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo(m.school), ringMat);
        ring.position.z = 0.02;
        g.add(ring);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: m.bloom ? new THREE.Color(1.0, 0.8, 0.3) : new THREE.Color(hue.hex).multiplyScalar(0.45), transparent: true, opacity: m.bloom ? 0.7 : 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(m.bloom ? 1.6 : 1.0);
        halo.position.z = 0.05;
        g.add(halo);
        const chains = new THREE.Group();
        for (let i = 0; i < 2; i++) {
            const ch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 24), this.chainMat);
            ch.rotation.set(0.6 * (i ? 1 : -1), 0.5, 0);
            ch.position.z = 0.15;
            chains.add(ch);
        }
        g.add(chains);
        const scale = m.bloom ? 1.05 : SEVS[m.sev].scale;
        body.scale.setScalar(scale * 1.45);
        return { g, body, mat: m.bloom ? body.material : mat, ring, ringMat, halo, chains, sev: m.sev, phase: Math.random() * 6, bloom: m.bloom, dim: 0 };
    }

    /** Reconcile the board with the scan state; events add the flourishes. */
    sync(S, events) {
        if (S.rows !== this.rows || S.cols !== this.cols || events.some((e) => e.type === 'phase')) {
            if (events.some((e) => e.type === 'phase')) this.flash = 1;
            this.rebuild(S);
            return;
        }
        const fromR = new Map();
        for (const e of events) {
            if (e.type === 'settle') for (const sp of e.spawns) fromR.set(sp.m.id, sp.fromR);
            if (e.type === 'treat') {
                for (const it of e.items) {
                    const o = this.objs.get(it.id);
                    if (!o) continue;
                    this.objs.delete(it.id);
                    this.dying.push({ ...o, t: 0, from: o.g.position.clone(), source: e.source });
                    const col = it.m.bloom ? new THREE.Color(1.6, 1.3, 0.5) : new THREE.Color(HUES[it.m.hue].hex).multiplyScalar(1.6);
                    this.bursts.emit(this.board.localToWorld(o.g.position.clone()).setZ(0.5), col, { n: e.source === 'chain' ? 10 : 7, speed: 2.4, up: 0.3, life: 0.7, size: 0.09, gravity: -3 });
                }
            }
            if (e.type === 'prism') for (const it of e.items) { const o = this.objs.get(it.id); if (o) { o.mat.color.setHex(HUES[it.hue].hex); o.mat.emissive.setHex(HUES[it.hue].hex); o.pop = 1; } }
            if (e.type === 'bloom') this.bursts.emit(this.board.localToWorld(this.cellPos(e.r, e.c)).setZ(0.6), new THREE.Color(1.8, 1.4, 0.5), { n: 30, speed: 3, up: 0.2, life: 1.1, size: 0.1, gravity: -1 });
            if (e.type === 'unbind') { const o = this.objs.get(e.id); if (o) o.pop = 1; }
        }
        const seen = new Set();
        for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
            const m = S.cells[r][c].m;
            if (!m) continue;
            seen.add(m.id);
            let o = this.objs.get(m.id);
            if (o && o.bloom !== m.bloom) { this.board.remove(o.g); this.objs.delete(m.id); o = null; }
            if (!o) {
                o = this.makeMote(m);
                const fr = fromR.get(m.id);
                o.g.position.copy(this.cellPos(fr ?? r, c));
                if (fr == null) { o.g.scale.setScalar(0.01); o.grow = true; }
                this.board.add(o.g);
                this.objs.set(m.id, o);
            }
            if (o.mat.color.getHex() !== HUES[m.hue].hex && !m.bloom) { o.mat.color.setHex(HUES[m.hue].hex); o.mat.emissive.setHex(HUES[m.hue].hex); }
            o.r = r; o.c = c;
            o.target = this.cellPos(r, c);
            o.chains.visible = m.bound > 0;
            o.chains.children[1].visible = m.bound > 1;
        }
        for (const [id, o] of this.objs) if (!seen.has(id)) { this.board.remove(o.g); this.objs.delete(id); }
        for (const sc of this.scars) {
            const n = S.cells[sc.userData.r][sc.userData.c].scar;
            sc.visible = n > 0;
            sc.scale.setScalar(n > 1 ? 1.15 : 0.9);
        }
        this.S = S;
    }

    /** The trail being dragged, and which motes it can reach next. */
    setPath(path, S = this.S, canExt = null) {
        this.path = path.slice();
        if (this.trail) { this.board.remove(this.trail); this.trail.geometry.dispose(); this.trail = null; }
        if (path.length >= 2) {
            const pts = path.map(([r, c]) => this.cellPos(r, c).setZ(0.45));
            const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
            const geo = new THREE.TubeGeometry(curve, Math.max(8, path.length * 8), 0.07, 8, false);
            const long = path.length >= (S?.mods?.bloomChain ?? 7);
            this.trail = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: long ? new THREE.Color(2.2, 1.8, 0.6) : new THREE.Color(0.6, 1.6, 2.4) }));
            this.board.add(this.trail);
        }
        // dim what can't be reached from the end of the trail
        for (const o of this.objs.values()) {
            const inPath = path.some(([r, c]) => r === o.r && c === o.c);
            o.inPath = inPath;
            o.dimTarget = path.length && !inPath && canExt && !canExt(o.r, o.c) ? 1 : 0;
        }
    }

    setHint(path) { this.hint = path; }
    setCursor(cell) { this.cursor = cell; }

    /** Pointer → cell, or null. tight: only near a cell's centre (for drags through diagonals). */
    pick(clientX, clientY, tight = false) {
        const rect = this.stage.canvas.getBoundingClientRect();
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
        const p = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.plane, p)) return null;
        this.board.worldToLocal(p);
        this.pipTarget.copy(p).setZ(0.9);
        const c = Math.round(p.x + (this.cols - 1) / 2);
        const r = Math.round((this.rows - 1) / 2 - p.y);
        if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
        const cp = this.cellPos(r, c);
        const d = Math.hypot(cp.x - p.x, cp.y - p.y);
        if (tight && d > 0.42) return null;
        return [r, c];
    }

    /** Where a cell is on screen, in CSS px (for the DOM tags). */
    screenOf(r, c) {
        const p = this.board.localToWorld(this.cellPos(r, c).setZ(0.5)).project(this.camera);
        const rect = this.stage.canvas.getBoundingClientRect();
        return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
    }

    /** Fit the board into the space the HUD leaves free. */
    fit() {
        if (!this.rows) return;
        const W = this.stage.w, H = this.stage.h;
        const ins = this.insets;
        const aw = Math.max(80, W - ins.left - ins.right), ah = Math.max(80, H - ins.top - ins.bottom);
        const tan = Math.tan((this.camera.fov * Math.PI) / 360);
        const bw = this.cols + 0.4, bh = this.rows + 0.4;
        const d = Math.max((bh * H) / (ah * 2 * tan), (bw * H) / (aw * 2 * tan));
        this.camera.aspect = W / H;
        this.camera.position.set(0, -0.2, d);
        this.camera.lookAt(0, 0, 0);
        const cx = ins.left + aw / 2, cy = ins.top + ah / 2;
        this.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
        this.camera.updateProjectionMatrix();
        this.board.rotation.x = -0.04;
    }

    setInsets(ins) { this.insets = ins; this.fit(); }

    frame(dt, t, heal = 0) {
        if (this.patient) {
            this.patient.rotation.y = Math.sin(t * 0.25) * 0.5;
            this.patient.userData.anim?.(t, 'idle');
            this.xray.uniforms.uHeal.value = heal;
        }
        const k = Math.min(1, dt * 14);
        for (const o of this.objs.values()) {
            if (o.target) o.g.position.lerp(o.target, k);
            if (o.grow) { const s = Math.min(1, o.g.scale.x + dt * 5); o.g.scale.setScalar(s); if (s >= 1) o.grow = false; }
            o.dim += ((o.dimTarget ?? 0) - o.dim) * k;
            const pulse = o.sev === 'L' && !o.bloom ? 0.25 * Math.sin(t * 4 + o.phase) : 0;
            const sel = o.inPath ? 1 : 0;
            o.pop = Math.max(0, (o.pop || 0) - dt * 3);
            o.body.rotation.y = Math.sin(t * 1.2 + o.phase) * 0.35 + (sel ? t * 3 : 0);
            o.body.position.z = 0.12 + sel * 0.25 + o.pop * 0.3;
            const s = (o.bloom ? 1.05 : SEVS[o.sev].scale) * 1.45 * (1 + sel * 0.18 + o.pop * 0.4);
            if (!o.grow) o.body.scale.setScalar(s);
            o.mat.emissiveIntensity = (o.bloom ? 0.9 : 0.18 + pulse * 0.4 + sel * 0.55) * (1 - o.dim * 0.75);
            o.ringMat.opacity = 0.8 * (1 - o.dim * 0.7);
            o.halo.material.opacity = (o.bloom ? 0.6 : 0.06 + sel * 0.45) * (1 - o.dim * 0.8);
            o.chains.rotation.z = t * 0.6;
        }
        // treated motes swell, then fly into the patient and fade
        for (let i = this.dying.length - 1; i >= 0; i--) {
            const d = this.dying[i];
            d.t += dt;
            const u = d.t / 0.55;
            if (u >= 1) { this.board.remove(d.g); this.dying.splice(i, 1); continue; }
            const sw = u < 0.3 ? 1 + u * 2 : (1 - (u - 0.3) / 0.7) * 1.6;
            d.g.scale.setScalar(Math.max(0.01, sw));
            d.g.position.copy(d.from).lerp(V(0, 0, -3), Math.max(0, (u - 0.3) / 0.7) ** 2);
            d.mat.emissiveIntensity = 2.5 * (1 - u);
        }
        // Pip follows the finger, or the end of the trail, or the keyboard cursor
        const tgt = this.path.length ? this.cellPos(...this.path[this.path.length - 1]).setZ(0.9) : this.cursor ? this.cellPos(...this.cursor).setZ(0.9) : this.pipTarget;
        const wpos = this.board.localToWorld(tgt.clone().add(V(0.35, 0.35, 0)));
        this.pip.position.lerp(wpos, Math.min(1, dt * 10));
        this.pip.material.opacity = 0.55 + Math.sin(t * 6) * 0.1;
        this.pip.scale.setScalar(this.armed ? 1.4 + Math.sin(t * 8) * 0.2 : 0.9);
        // the hint: a slow wave along the suggested trail
        if (this.hint && !this.path.length) {
            this.hint.forEach(([r, c], i) => { for (const o of this.objs.values()) if (o.r === r && o.c === c) o.body.position.z += Math.max(0, Math.sin(t * 4 - i * 0.6)) * 0.25; });
        }
        if (this.cursor) for (const o of this.objs.values()) if (o.r === this.cursor[0] && o.c === this.cursor[1]) o.halo.material.opacity = 1;
        this.flash = Math.max(0, (this.flash || 0) - dt * 1.5);
        this.bursts.update(dt);
        timeUniform.value = t;
    }
}
