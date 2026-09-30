/**
 * cards3d.js — the table, the hand and the piles, as real 3D cards in the
 * pixel-space card layer (see scene.js: 1 unit = 1 CSS px at z = 0, y up).
 *
 * Every CardView eases toward a target transform each frame (critically
 * damped), or follows a scripted arc tween when one is set. The combat
 * director (combatView.js) sets targets from simulation events; reconcile()
 * snaps the whole layout back to the authoritative state when the event queue
 * is drained, so a missed flourish can never leave a card in the wrong place.
 */

import * as THREE from 'three';
import { cardScene, view, px2card } from './scene.js';
import { faceTextures, backTextures, CW, CH } from './cardArt.js';
import { canvas, colorTex, dataTex, normalFromHeight, makeNoise, roundRectPath, radialTex } from './textures.js';
import { SUIT_INFO } from '../sim/rules.js';

const ASPECT = CH / CW; // 1.406
export const layout = { landscape: true, cw: 80, ch: 112, gap: 6, tableCx: 0, tableCy: 0, tableW: 0, tableH: 0, hand: { cx: 0, y: 0, cw: 100 }, deck: { x: 0, y: 0 }, discard: { x: 0, y: 0 }, enemyRegion: null, heroRegion: null };

let envMap = null;
let cardGeo = null, glowGeo = null;
const matCache = new Map();
let backMat = null;
const views = new Map(); // uid → CardView
let root, tableGroup, boardMesh, pilesGroup;
const cellFx = [];
let glowTex = null, sealTexes = {}, frostTex = null;
let pointerLight;

// ------------------------------------------------------------------ geometry & materials

function roundedCardGeo(w, h, r, seg = 6) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ShapeGeometry(s, seg);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
    g.computeVertexNormals();
    g.userData.shared = true;
    return g;
}

function faceMat(c) {
    const key = c.kind === 'arcana' ? `arc:${c.id}:${c.up}` : c.kind === 'ash' ? 'ash' : c.joker ? 'joker' : `p:${c.rank}:${c.suit}:${c.ench ?? ''}`;
    if (matCache.has(key)) return matCache.get(key);
    const t = faceTextures(c);
    const m = new THREE.MeshStandardMaterial({
        map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: t.ormMap, metalnessMap: t.ormMap, roughness: 1, metalness: 1,
        envMap, envMapIntensity: 1.1, side: THREE.FrontSide,
    });
    matCache.set(key, m);
    return m;
}

export function setCardEnv(tex) {
    envMap = tex;
    for (const m of matCache.values()) { m.envMap = tex; m.needsUpdate = true; }
    if (backMat) { backMat.envMap = tex; backMat.needsUpdate = true; }
    if (boardMesh) { boardMesh.material.envMap = tex; boardMesh.material.needsUpdate = true; }
}

function makeGlowTex() {
    const c = canvas(256, 340);
    const g = c.getContext('2d');
    g.filter = 'blur(14px)';
    g.strokeStyle = '#fff';
    g.lineWidth = 22;
    roundRectPath(g, 40, 40, 176, 260, 22);
    g.stroke();
    g.filter = 'none';
    g.lineWidth = 5;
    roundRectPath(g, 40, 40, 176, 260, 22);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ------------------------------------------------------------------ card view

class CardView {
    constructor(card) {
        this.uid = card.uid;
        this.card = card;
        this.group = new THREE.Group();
        this.front = new THREE.Mesh(cardGeo, faceMat(card));
        this.back = new THREE.Mesh(cardGeo, backMat);
        this.back.rotation.y = Math.PI;
        this.back.position.z = -0.4;
        this.glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd060, opacity: 0 }));
        this.glow.position.z = 0.6;
        this.glow.renderOrder = 5;
        this.group.add(this.front, this.back, this.glow);
        root.add(this.group);
        this.pos = new THREE.Vector3();
        this.rot = new THREE.Vector3();
        this.scale = 1;
        this.t = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };
        this.tween = null;
        this.glowTarget = 0;
        this.glowColor = new THREE.Color(0xffd060);
        this.zone = 'none';
        this.dead = false;
        this.pulse = 0;
        this.tilt = { x: 0, y: 0 };
    }
    setCard(card) {
        this.card = card;
        this.front.material = faceMat(card);
    }
    at(x, y, z = 0, ry = 0, rz = 0, s = 1) {
        this.pos.set(x, y, z); this.rot.set(0, ry, rz); this.scale = s;
        Object.assign(this.t, { x, y, z, rx: 0, ry, rz, s });
        this.apply();
        return this;
    }
    to(x, y, z = 0, { ry = 0, rz = 0, rx = 0, s = 1 } = {}) {
        Object.assign(this.t, { x, y, z, rx, ry, rz, s });
        return this;
    }
    /** Arc tween from the current transform to the target over `dur` seconds. */
    fly(dur = 0.45, arc = 60, delay = 0) {
        this.tween = { t: -delay, dur, arc, from: { p: this.pos.clone(), r: this.rot.clone(), s: this.scale } };
        return this;
    }
    update(dt, time) {
        const t = this.t;
        if (this.tween) {
            const tw = this.tween;
            tw.t += dt;
            if (tw.t >= 0) {
                const k = Math.min(1, tw.t / tw.dur);
                const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
                this.pos.set(
                    tw.from.p.x + (t.x - tw.from.p.x) * e,
                    tw.from.p.y + (t.y - tw.from.p.y) * e,
                    tw.from.p.z + (t.z - tw.from.p.z) * e + Math.sin(k * Math.PI) * tw.arc,
                );
                this.rot.set(
                    tw.from.r.x + (t.rx - tw.from.r.x) * e,
                    tw.from.r.y + (t.ry - tw.from.r.y) * e,
                    tw.from.r.z + (t.rz - tw.from.r.z) * e,
                );
                this.scale = tw.from.s + (t.s - tw.from.s) * e;
                if (k >= 1) this.tween = null;
            }
        } else {
            const a = 1 - Math.exp(-dt * 16);
            const ar = 1 - Math.exp(-dt * 12);
            this.pos.x += (t.x - this.pos.x) * a;
            this.pos.y += (t.y - this.pos.y) * a;
            this.pos.z += (t.z - this.pos.z) * a;
            this.rot.x += (t.rx - this.rot.x) * ar;
            this.rot.y += (t.ry - this.rot.y) * ar;
            this.rot.z += (t.rz - this.rot.z) * ar;
            this.scale += (t.s - this.scale) * a;
        }
        const gm = this.glow.material;
        gm.opacity += (this.glowTarget * (0.75 + 0.25 * Math.sin(time * 6 + this.uid)) - gm.opacity) * (1 - Math.exp(-dt * 10));
        gm.color.copy(this.glowColor);
        this.glow.visible = gm.opacity > 0.01;
        if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 3);
        this.apply();
    }
    apply() {
        const g = this.group;
        g.position.copy(this.pos);
        g.rotation.set(this.rot.x + this.tilt.x, this.rot.y + this.tilt.y, this.rot.z, 'ZYX');
        const s = this.scale * layout.cardScale * (1 + this.pulse * 0.12);
        g.scale.set(s, s, s);
    }
    destroy() {
        this.dead = true;
        root.remove(this.group);
        this.glow.material.dispose();
    }
}

// ------------------------------------------------------------------ table

function paintBoard(worldAccent = '#c89a3a') {
    // board aspect is fixed by the layout formula: width 5.72 cw, height 7.75 cw
    const W = 1024, H = Math.round(1024 * 7.75 / 5.72);
    const col = canvas(W, H), hgt = canvas(W, H), orm = canvas(W, H);
    const c = col.getContext('2d'), h = hgt.getContext('2d'), m = orm.getContext('2d');
    const N = makeNoise(777);
    // dark carved stone with veins
    const img = c.createImageData(W, H);
    const himg = h.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const n = N.fbm(x / 140, y / 140, 5);
        const v = N.fbm(x / 40 + n * 3, y / 40, 3);
        const vein = Math.pow(1 - Math.abs(v - 0.5) * 2, 18);
        const base = 0.1 + n * 0.1;
        const i = (y * W + x) * 4;
        img.data[i] = (base * 0.9 + vein * 0.35) * 255;
        img.data[i + 1] = (base * 0.8 + vein * 0.25) * 255;
        img.data[i + 2] = (base * 1.0 + vein * 0.1) * 255;
        img.data[i + 3] = 255;
        const hv = (0.45 + n * 0.25 - vein * 0.1) * 255;
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv; himg.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    h.putImageData(himg, 0, 0);
    m.fillStyle = 'rgb(0,170,0)'; m.fillRect(0, 0, W, H);
    const k = W / 5.72; // one card width in board pixels
    const gap = 0.08 * k, pad = 0.2 * k, ch = k * ASPECT;
    const gold = (g) => { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fff0b0'); gr.addColorStop(0.3, worldAccent); gr.addColorStop(0.6, '#6a4010'); gr.addColorStop(1, '#f0c860'); return gr; };
    const both = (fn, style, hv, ormStyle, lw) => {
        for (const [g, st] of [[c, style], [h, `rgb(${hv},${hv},${hv})`], [m, ormStyle]]) {
            g.save(); fn(g); g.lineWidth = lw; g.strokeStyle = typeof st === 'function' ? st(g) : st; g.stroke(); g.restore();
        }
    };
    both((g) => roundRectPath(g, 10, 10, W - 20, H - 20, 34), gold, 250, 'rgb(0,70,255)', 12);
    both((g) => roundRectPath(g, 30, 30, W - 60, H - 60, 24), gold, 230, 'rgb(0,70,255)', 4);
    for (let r = 0; r < 5; r++) for (let cc = 0; cc < 5; cc++) {
        const x = pad + cc * (k + gap), y = pad + r * (ch + gap);
        // recessed socket
        c.save();
        roundRectPath(c, x, y, k, ch, k * 0.08);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fill();
        c.clip();
        c.strokeStyle = 'rgba(255,220,150,0.08)';
        c.lineWidth = 2;
        c.beginPath(); c.arc(x + k / 2, y + ch / 2, k * 0.32, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(x + k / 2, y + ch / 2, k * 0.22, 0, Math.PI * 2); c.stroke();
        c.restore();
        h.save(); roundRectPath(h, x, y, k, ch, k * 0.08); h.fillStyle = 'rgb(20,20,20)'; h.fill(); h.restore();
        both((g) => roundRectPath(g, x - 3, y - 3, k + 6, ch + 6, k * 0.09), gold, 200, 'rgb(0,90,230)', 3);
    }
    return { map: colorTex(col), normalMap: dataTex(normalFromHeight(hgt, 4)), ormMap: dataTex(orm) };
}

function makeSealTex(kind) {
    const c = canvas(256, 360);
    const g = c.getContext('2d');
    if (kind === 'frost') {
        const gr = g.createLinearGradient(0, 0, 256, 360);
        gr.addColorStop(0, 'rgba(180,230,255,0.75)'); gr.addColorStop(1, 'rgba(90,160,255,0.55)');
        g.fillStyle = gr; roundRectPath(g, 6, 6, 244, 348, 18); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.beginPath(); g.moveTo(128, 180); g.lineTo(128 + Math.cos(a) * 90, 180 + Math.sin(a) * 90); g.stroke();
            for (const f of [0.4, 0.7]) {
                const bx = 128 + Math.cos(a) * 90 * f, by = 180 + Math.sin(a) * 90 * f;
                g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.7) * 22, by + Math.sin(a + 0.7) * 22); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a - 0.7) * 22, by + Math.sin(a - 0.7) * 22); g.stroke();
            }
        }
    } else {
        g.fillStyle = 'rgba(10,8,14,0.82)'; roundRectPath(g, 6, 6, 244, 348, 18); g.fill();
        // thorny chains
        g.strokeStyle = '#6a8a3a'; g.lineWidth = 9; g.lineCap = 'round';
        for (const d of [-1, 1]) {
            g.beginPath();
            for (let t = 0; t <= 1; t += 0.02) { const x = 128 + d * (t - 0.5) * 230, y = 20 + t * 320 + Math.sin(t * 20) * 10; if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); }
            g.stroke();
        }
        g.fillStyle = '#b0d070';
        for (let i = 0; i < 16; i++) { const t = i / 16; for (const d of [-1, 1]) { const x = 128 + d * (t - 0.5) * 230, y = 20 + t * 320; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 * d, y - 10); g.lineTo(x + 4, y + 6); g.fill(); } }
        g.fillStyle = '#ff6a50'; g.font = 'bold 64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✕', 128, 180);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ------------------------------------------------------------------ init & layout

export function initCards() {
    root = new THREE.Group();
    cardScene.add(root);
    cardGeo = roundedCardGeo(1, ASPECT, 0.074, 5);
    glowGeo = new THREE.PlaneGeometry(256 / 176, (340 / 260) * ASPECT);
    glowGeo.userData.shared = true;
    glowTex = makeGlowTex();
    const bt = backTextures();
    backMat = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, roughnessMap: bt.ormMap, metalnessMap: bt.ormMap, roughness: 1, metalness: 1, envMap });
    sealTexes.seal = makeSealTex('seal');
    frostTex = makeSealTex('frost');

    // lights for the card layer
    cardScene.add(new THREE.AmbientLight(0xfff0e0, 0.65));
    const key = new THREE.DirectionalLight(0xfff4e0, 1.5);
    key.position.set(-400, 600, 1200);
    cardScene.add(key);
    const fill = new THREE.DirectionalLight(0x90a0ff, 0.35);
    fill.position.set(600, -300, 800);
    cardScene.add(fill);
    pointerLight = new THREE.PointLight(0xffe0b0, 2.2, 0, 0);
    pointerLight.position.set(0, 0, 260);
    cardScene.add(pointerLight);

    // table
    tableGroup = new THREE.Group();
    root.add(tableGroup);
    const bt2 = paintBoard();
    const bg = roundedCardGeo(5.72, 7.75, 0.2, 6);
    boardMesh = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: bt2.map, normalMap: bt2.normalMap, roughnessMap: bt2.ormMap, metalnessMap: bt2.ormMap, roughness: 1, metalness: 1, envMap, transparent: true, opacity: 0.94 }));
    boardMesh.position.z = -30;
    tableGroup.add(boardMesh);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshBasicMaterial({ map: radialTex(128, 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0)', 0.55), transparent: true, depthWrite: false }));
    shadow.position.z = -40;
    tableGroup.add(shadow);
    for (let i = 0; i < 25; i++) {
        const mk = (tex, color, blend = THREE.NormalBlending) => {
            const mm = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, blending: blend }));
            mm.visible = false;
            tableGroup.add(mm);
            return mm;
        };
        cellFx.push({
            hover: mk(null, 0xffd060, THREE.AdditiveBlending),
            seal: mk(sealTexes.seal, 0xffffff),
            frost: mk(frostTex, 0xffffff),
            threat: mk(null, 0xff2030, THREE.AdditiveBlending),
            target: { hover: 0, seal: 0, frost: 0, threat: 0 },
        });
    }
    pilesGroup = new THREE.Group();
    root.add(pilesGroup);
    for (const which of ['deck', 'discard']) {
        const g = new THREE.Group();
        g.name = which;
        for (let i = 0; i < 4; i++) {
            const mm = new THREE.Mesh(cardGeo, backMat);
            mm.position.set(i * 0.018, i * 0.024, i * 0.01);
            g.add(mm);
        }
        pilesGroup.add(g);
    }
    computeLayout();
}

export function computeLayout() {
    const w = view.w, h = view.h;
    const L = layout;
    L.landscape = w / h > 1.15;
    L.compact = L.landscape && h < 520;
    if (L.compact) {
        // short landscape (phones on their side): full-height table left, enemies top-right, hand bottom-right
        const top = 46, bottom = h - 6;
        L.cw = Math.min((bottom - top) / 7.75, (w * 0.42) / 5.72);
        L.tableCx = 5.72 * L.cw / 2 + Math.max(8, w * 0.02);
        L.tableCy = top + (bottom - top) / 2;
        const right = L.tableCx + 5.72 * L.cw / 2;
        L.enemyRegion = { x0: right + 8, x1: w * 0.99, y0: h * 0.16, y1: h * 0.5 };
        L.heroRegion = null;
        const hcw = Math.min(L.cw * 1.3, (w - right) / 5.5, h * 0.2);
        L.hand = { cx: (right + w) / 2, y: h - hcw * ASPECT * 0.5 - 6, cw: hcw, maxW: (w - right) * 0.72 };
        L.deck = { x: right + hcw * 0.55, y: h - hcw * ASPECT * 0.5 - 6 };
        L.discard = { x: w - hcw * 0.55, y: h - hcw * ASPECT * 0.5 - 6 };
    } else if (L.landscape) {
        const top = Math.max(56, h * 0.075), bottom = h * 0.77;
        const availH = bottom - top, availW = w * 0.38;
        L.cw = Math.min(availH / 7.75, availW / 5.72);
        L.tableCx = Math.max(w * 0.36, 5.72 * L.cw / 2 + w * 0.2);
        L.tableCy = top + availH / 2;
        L.enemyRegion = { x0: L.tableCx + 5.72 * L.cw / 2 + w * 0.02, x1: w * 0.985, y0: h * 0.12, y1: h * 0.7 };
        L.heroRegion = { x0: w * 0.01, x1: L.tableCx - 5.72 * L.cw / 2 - w * 0.01, y0: h * 0.2, y1: h * 0.7 };
        const hcw = Math.min(L.cw * 1.3, w * 0.085, h * 0.16);
        L.hand = { cx: L.tableCx, y: h - hcw * ASPECT * 0.5 - 12, cw: hcw, maxW: Math.min(w * 0.5, hcw * 6.5) };
        L.deck = { x: Math.max(70, L.hand.cx - L.hand.maxW / 2 - L.hand.cw * 1.1), y: h - L.hand.cw * ASPECT * 0.6 };
        L.discard = { x: w - 70, y: h - L.hand.cw * ASPECT * 0.6 };
    } else {
        const top = h * 0.285, bottom = h * 0.735;
        const availH = bottom - top, availW = w * 0.96;
        L.cw = Math.min(availH / 7.75, availW / 5.72);
        L.tableCx = w / 2;
        L.tableCy = top + availH / 2;
        L.enemyRegion = { x0: w * 0.03, x1: w * 0.97, y0: h * 0.085, y1: h * 0.27 };
        L.heroRegion = null;
        const hcw = Math.min(w * 0.19, L.cw * 1.35);
        L.hand = { cx: w / 2, y: h - hcw * ASPECT * 0.5 - 6, cw: hcw, maxW: w * 0.72 };
        L.deck = { x: hcw * 0.5 + 4, y: h - hcw * ASPECT * 0.5 - 10 };
        L.discard = { x: w - hcw * 0.5 - 4, y: h - hcw * ASPECT * 0.5 - 10 };
    }
    L.ch = L.cw * ASPECT;
    L.gap = L.cw * 0.08;
    L.tableW = 5.72 * L.cw;
    L.tableH = 7.75 * L.cw;
    L.cardScale = L.cw; // CardView base scale = one table card width

    if (tableGroup) {
        const c = px2card(L.tableCx, L.tableCy);
        tableGroup.position.set(c.x, c.y, 0);
        boardMesh.scale.set(L.cw, L.cw, 1);
        tableGroup.children[1].scale.set(L.cw, L.cw, 1);
        for (let i = 0; i < 25; i++) {
            const p = cellLocal(i);
            for (const k of ['hover', 'seal', 'frost', 'threat']) {
                const mm = cellFx[i][k];
                mm.position.set(p.x, p.y, k === 'hover' || k === 'threat' ? 8 : 12);
                const sc = k === 'hover' || k === 'threat' ? 1.1 : 1;
                mm.scale.set(L.cw * sc, L.cw * sc, 1);
            }
        }
        for (const which of ['deck', 'discard']) {
            const g = pilesGroup.getObjectByName(which);
            const p = px2card(L[which].x, L[which].y);
            g.position.set(p.x, p.y, -10);
            g.scale.setScalar(L.hand.cw * 0.8);
        }
    }
}

function cellLocal(i) {
    const r = Math.floor(i / 5), c = i % 5;
    return { x: (c - 2) * (layout.cw + layout.gap), y: -(r - 2) * (layout.ch + layout.gap) };
}

/** Cell centre in card-layer coordinates. */
export function cellPos(i) {
    const p = cellLocal(i);
    return { x: tableGroup.position.x + p.x, y: tableGroup.position.y + p.y };
}
/** Cell centre in CSS pixels. */
export function cellPx(i) {
    const p = cellPos(i);
    return { x: p.x + view.w / 2, y: view.h / 2 - p.y };
}
export function pilePos(which) { const p = layout[which]; return px2card(p.x, p.y); }

// ------------------------------------------------------------------ hand layout

export const handState = { hover: -1, selected: -1, drag: null, lifted: new Set(), dim: new Set() };

export function handSlots(n) {
    const L = layout.hand;
    const s = L.cw / layout.cw;
    const spacing = n > 1 ? Math.min(L.cw * 1.02, (L.maxW - L.cw) / (n - 1)) : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        const px = L.cx + off * spacing;
        const py = L.y + Math.abs(off) * Math.abs(off) * L.cw * 0.035;
        const p = px2card(px, py);
        out.push({ x: p.x, y: p.y, z: 20 + i * 2, rz: -off * 0.045, s });
    }
    return out;
}

export function layoutHand(hand, { immediate = false } = {}) {
    const slots = handSlots(hand.length);
    hand.forEach((c, i) => {
        const v = views.get(c.uid);
        if (!v) return;
        v.zone = 'hand';
        v.handIndex = i;
        const sl = slots[i];
        const hover = handState.hover === i && !handState.drag;
        const sel = handState.selected === i;
        if (handState.drag && handState.drag.uid === c.uid) return;
        const lift = hover || sel ? layout.hand.cw * ASPECT * (view.portrait ? 0.62 : 0.42) : 0;
        const sc = hover || sel ? sl.s * (view.portrait ? 1.45 : 1.3) : sl.s;
        v.to(sl.x, sl.y + lift, sl.z + (hover || sel ? 120 : 0), { rz: hover || sel ? 0 : sl.rz, s: sc });
        v.glowTarget = sel ? 1 : handState.dim.has(c.uid) ? 0 : 0;
        v.glowColor.set(sel ? 0xffd060 : 0xffffff);
        if (immediate) v.at(v.t.x, v.t.y, v.t.z, 0, v.t.rz, v.t.s);
    });
}

// ------------------------------------------------------------------ views API

export function getView(uid) { return views.get(uid); }
export function allViews() { return views; }

export function spawnCard(card, x, y, { faceDown = false, z = 40 } = {}) {
    let v = views.get(card.uid);
    if (v && !v.dead) { v.setCard(card); return v; }
    v = new CardView(card);
    views.set(card.uid, v);
    v.at(x, y, z, faceDown ? Math.PI : 0, 0, layout.hand.cw / layout.cw);
    return v;
}

export function removeCard(uid) {
    const v = views.get(uid);
    if (v) { v.destroy(); views.delete(uid); }
}

export function clearAllCards() {
    for (const v of views.values()) v.destroy();
    views.clear();
    handState.hover = -1; handState.selected = -1; handState.drag = null;
}

export function toCell(v, cell, { fly = true } = {}) {
    const p = cellPos(cell);
    v.zone = 'table';
    v.cell = cell;
    v.to(p.x, p.y, 2, { s: 1 });
    if (fly) v.fly(0.28, 50);
    return v;
}

export function toPile(v, which, { dur = 0.4, delay = 0, remove = true } = {}) {
    const p = pilePos(which);
    v.zone = 'pile';
    v.to(p.x, p.y, 10, { ry: which === 'discard' ? Math.PI : Math.PI, s: layout.hand.cw * 0.8 / layout.cw });
    v.fly(dur, 80, delay);
    if (remove) v.removeAt = (delay + dur);
    return v;
}

/** Snap every card to the authoritative combat state. */
export function reconcile(st) {
    const keep = new Set();
    st.hand.forEach((c) => {
        keep.add(c.uid);
        let v = views.get(c.uid);
        if (!v) { const d = pilePos('deck'); v = spawnCard(c, d.x, d.y, { faceDown: true }); v.fly(0.35, 60); }
        else v.setCard(c);
    });
    layoutHand(st.hand);
    st.board.forEach((b, i) => {
        if (!b.card) return;
        keep.add(b.card.uid);
        let v = views.get(b.card.uid);
        if (!v) { const d = pilePos('deck'); v = spawnCard(b.card, d.x, d.y); }
        v.setCard(b.card);
        if (v.zone !== 'table' || v.cell !== i) toCell(v, i);
        else { const p = cellPos(i); v.to(p.x, p.y, 2, { s: 1 }); }
    });
    for (const [uid, v] of views) if (!keep.has(uid) && !v.removeAt) toPile(v, 'discard', { dur: 0.35 });
}

// ------------------------------------------------------------------ cell overlays

export function setCellFx(i, key, on) { if (cellFx[i]) cellFx[i].target[key] = on ? 1 : 0; }
export function clearCellFx(key) { for (const c of cellFx) c.target[key] = 0; }

export function syncBoardFx(st, threatened = []) {
    for (let i = 0; i < 25; i++) {
        const b = st.board[i];
        cellFx[i].target.seal = b.seal > 0 ? 1 : 0;
        cellFx[i].target.frost = b.frost > 0 ? 1 : 0;
        cellFx[i].target.threat = threatened.includes(i) ? 1 : 0;
    }
}

// ------------------------------------------------------------------ hit testing (CSS px)

export function handHit(px, py, hand) {
    const slots = handSlots(hand.length);
    // test from the top-most card down; hovered card is on top
    const order = hand.map((c, i) => i).sort((a, b) => (a === handState.hover ? 1 : b === handState.hover ? -1 : a - b)).reverse();
    for (const i of order) {
        const v = views.get(hand[i].uid);
        if (!v) continue;
        const s = v.t.s * layout.cw;
        const cx = v.t.x + view.w / 2, cy = view.h / 2 - v.t.y;
        const hw = s / 2, hh = (s * ASPECT) / 2;
        if (Math.abs(px - cx) <= hw && Math.abs(py - cy) <= hh) return i;
        void slots;
    }
    return -1;
}

export function cellHit(px, py, slack = 0.5) {
    const L = layout;
    const lx = px - L.tableCx, ly = py - L.tableCy;
    const c = Math.round(lx / (L.cw + L.gap)) + 2;
    const r = Math.round(ly / (L.ch + L.gap)) + 2;
    if (c < 0 || c > 4 || r < 0 || r > 4) return -1;
    const cx = (c - 2) * (L.cw + L.gap), cy = (r - 2) * (L.ch + L.gap);
    if (Math.abs(lx - cx) > L.cw * (0.5 + slack * 0.1) || Math.abs(ly - cy) > L.ch * (0.5 + slack * 0.1)) return -1;
    return r * 5 + c;
}

export function inTable(px, py) {
    const L = layout;
    return Math.abs(px - L.tableCx) < L.tableW / 2 && Math.abs(py - L.tableCy) < L.tableH / 2;
}

// ------------------------------------------------------------------ per-frame

export function setPointerLight(px, py) {
    if (!pointerLight) return;
    const p = px2card(px, py);
    pointerLight.position.x += (p.x - pointerLight.position.x) * 0.2;
    pointerLight.position.y += (p.y - pointerLight.position.y) * 0.2;
}

/** Pile heights follow the card counts (0 cards → no pile). */
export function updatePiles(nDraw, nDiscard) {
    for (const [which, n] of [['deck', nDraw], ['discard', nDiscard]]) {
        const g = pilesGroup?.getObjectByName(which);
        if (!g) continue;
        const k = n <= 0 ? 0 : Math.min(4, 1 + Math.floor(n / 6));
        g.children.forEach((m, i) => { m.visible = i < k; });
    }
}

export function setTableVisible(on) { if (tableGroup) tableGroup.visible = on; if (pilesGroup) pilesGroup.visible = on; }

export function updateCards(dt, time) {
    for (const [uid, v] of views) {
        v.update(dt, time);
        if (v.removeAt !== undefined) {
            v.removeAt -= dt;
            if (v.removeAt <= 0) { v.destroy(); views.delete(uid); }
        }
    }
    for (const c of cellFx) {
        for (const k of ['hover', 'seal', 'frost', 'threat']) {
            const m = c[k].material;
            let target = c.target[k];
            if (k === 'threat' && target) target = 0.35 + 0.3 * Math.sin(time * 6);
            if (k === 'hover' && target) target = 0.45 + 0.15 * Math.sin(time * 5);
            m.opacity += (target - m.opacity) * (1 - Math.exp(-dt * 12));
            c[k].visible = m.opacity > 0.01;
        }
    }
}

export function suitColor(s) { return s ? SUIT_INFO[s].hex : 0xaaaaaa; }
export { ASPECT };
