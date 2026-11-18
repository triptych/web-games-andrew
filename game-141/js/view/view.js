// The three.js board: reads G every frame and turns sim events into effects. Never changes G.
//
// Cell (x, y) of a floor sits at world (x - w/2 + 0.5, 0, y - h/2 + 0.5); the camera looks down at the floor from
// the south at a steep angle, so blocks read as chunky painted cubes. Blocks, open tiles and their objects are
// rebuilt from a per-cell signature when it changes; animation (shake, squash, monster bob, channel turning,
// blocks dropping in on a new floor) lives here and only here.

import * as THREE from 'three';
import { BLOCKS, THEMES, PILLAR_TILE, HATCH_TILE } from '../sim/data/blocks.js';
import { MONSTERS } from '../sim/data/monsters.js';
import { rotMask } from '../sim/floor.js';
import { exposed, has, rank } from '../sim/game.js';
import { ART, ROOT } from '../media.js';
import { FX } from './fx.js';

const BH = 0.62;                 // block height
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const NUM_COLORS = ['', '#5ad1ff', '#7be07b', '#ffd34a', '#ff9a3c', '#ff5a4a', '#e45aff', '#ff3aa0', '#ffffff'];

function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** A number or numeral, inked and outlined, on a transparent square. */
function glyphTex(text, fill, font = '900 92px "Nunito", "Segoe UI", sans-serif') {
    return canvasTex(128, 128, (g, w, h) => {
        g.font = font;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 16; g.strokeStyle = 'rgba(30,14,4,0.95)';
        g.strokeText(text, w / 2, h / 2 + 6);
        g.fillStyle = fill;
        g.fillText(text, w / 2, h / 2 + 6);
        g.globalCompositeOperation = 'source-atop';
        const gr = g.createLinearGradient(0, 20, 0, 110);
        gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
}

function flagTex() {
    return canvasTex(128, 128, (g) => {
        g.lineCap = 'round';
        g.strokeStyle = '#2a1408'; g.lineWidth = 12; g.beginPath(); g.moveTo(40, 120); g.lineTo(40, 14); g.stroke();
        g.strokeStyle = '#c9a15a'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 118); g.lineTo(40, 16); g.stroke();
        g.fillStyle = '#2a1408'; g.beginPath(); g.moveTo(40, 14); g.lineTo(118, 38); g.lineTo(40, 66); g.closePath(); g.fill();
        g.fillStyle = '#e8402c'; g.beginPath(); g.moveTo(46, 22); g.lineTo(104, 38); g.lineTo(46, 58); g.closePath(); g.fill();
        g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(40, 12, 9, 0, 7); g.fill();
    });
}

function eyesTex() {
    return canvasTex(128, 64, (g) => {
        for (const x of [40, 88]) {
            const r = g.createRadialGradient(x, 32, 0, x, 32, 26);
            r.addColorStop(0, 'rgba(255,255,220,1)'); r.addColorStop(0.35, 'rgba(120,230,255,0.95)'); r.addColorStop(1, 'rgba(60,160,255,0)');
            g.fillStyle = r; g.beginPath(); g.arc(x, 32, 26, 0, 7); g.fill();
            g.fillStyle = '#04121a'; g.beginPath(); g.ellipse(x, 32, 4, 9, 0, 0, 7); g.fill();
        }
    });
}

function warnTex() {
    return canvasTex(128, 128, (g) => {
        g.fillStyle = '#2a1408'; g.beginPath(); g.moveTo(64, 6); g.lineTo(124, 116); g.lineTo(4, 116); g.closePath(); g.fill();
        g.fillStyle = '#ff6a3a'; g.beginPath(); g.moveTo(64, 22); g.lineTo(110, 106); g.lineTo(18, 106); g.closePath(); g.fill();
        g.fillStyle = '#2a1408'; g.font = '900 68px sans-serif'; g.textAlign = 'center'; g.fillText('!', 64, 100);
    });
}

function crackTex(stage) {
    return canvasTex(128, 128, (g) => {
        g.strokeStyle = 'rgba(20,10,4,0.85)'; g.lineCap = 'round'; g.lineJoin = 'round';
        let seed = 7 + stage * 13;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const lines = 2 + stage * 3;
        for (let k = 0; k < lines; k++) {
            g.lineWidth = 2 + rnd() * 3;
            let x = 64 + (rnd() - 0.5) * 20, y = 64 + (rnd() - 0.5) * 20;
            const a = rnd() * Math.PI * 2;
            g.beginPath(); g.moveTo(x, y);
            for (let s = 0; s < 4 + stage; s++) {
                x += Math.cos(a + (rnd() - 0.5) * 1.4) * 12; y += Math.sin(a + (rnd() - 0.5) * 1.4) * 12;
                g.lineTo(x, y);
            }
            g.stroke();
        }
    });
}

/** A gold channel: base shape straight (N–S) or corner (N–E). */
function pipeTex(corner, lit) {
    return canvasTex(128, 128, (g) => {
        const gold = lit ? '#fff2a8' : '#b8893a', dark = lit ? '#ffb020' : '#5a3a14';
        g.lineCap = 'butt';
        const path = () => {
            g.beginPath();
            if (corner) { g.moveTo(64, 0); g.quadraticCurveTo(64, 64, 128, 64); } else { g.moveTo(64, 0); g.lineTo(64, 128); }
        };
        g.strokeStyle = '#2a1408'; g.lineWidth = 46; path(); g.stroke();
        g.strokeStyle = dark; g.lineWidth = 36; path(); g.stroke();
        g.strokeStyle = gold; g.lineWidth = 18; path(); g.stroke();
        if (lit) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6; path(); g.stroke(); }
    });
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a1a10);
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        this.insets = { top: 100, bottom: 160, right: 0 };
        this.shakeAmt = 0;
        this.shakeOn = true;
        this.cursor = -1;
        this.markMode = false;
        this.cells = [];
        this.floorKey = '';
        this.cam = { dist: 12, look: new THREE.Vector3(), dive: 0 };

        const hemi = new THREE.HemisphereLight(0xfff0d8, 0x4a3020, 1.15);
        this.scene.add(hemi);
        this.sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
        this.sun.position.set(-4, 12, 6);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
        this.sun.shadow.camera.left = -8; this.sun.shadow.camera.right = 8;
        this.sun.shadow.camera.top = 8; this.sun.shadow.camera.bottom = -8;
        this.sun.shadow.bias = -0.0008;
        this.scene.add(this.sun);
        this.rim = new THREE.DirectionalLight(0x8ab8ff, 0.5);
        this.rim.position.set(6, 5, -8);
        this.scene.add(this.rim);

        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.fx = new FX(this.scene);

        // shared geometry
        this.geo = {
            block: new THREE.BoxGeometry(0.94, BH, 0.94),
            tile: new THREE.PlaneGeometry(1, 1),
            pillar: new THREE.CylinderGeometry(0.34, 0.38, 1.3, 20),
            cap: new THREE.CylinderGeometry(0.44, 0.38, 0.16, 20),
        };
        this.geo.tile.rotateX(-Math.PI / 2);

        // canvas textures
        this.tex = {
            nums: NUM_COLORS.map((c, n) => (n ? glyphTex(String(n), c) : null)),
            roman: ROMAN.map((r) => (r ? glyphTex(r, '#ffe7a6', '800 74px "Alegreya", Georgia, serif') : null)),
            romanLit: ROMAN.map((r) => (r ? glyphTex(r, '#bffff8', '800 74px "Alegreya", Georgia, serif') : null)),
            flag: flagTex(), eyes: eyesTex(), warn: warnTex(),
            cracks: [1, 2, 3].map(crackTex),
            pipe: { s0: pipeTex(false, false), s1: pipeTex(false, true), c0: pipeTex(true, false), c1: pipeTex(true, true) },
        };
        this.mat = {
            num: this.tex.nums.map((t) => t && new THREE.SpriteMaterial({ map: t, depthWrite: false })),
            flag: new THREE.SpriteMaterial({ map: this.tex.flag, depthWrite: false }),
            eyes: new THREE.SpriteMaterial({ map: this.tex.eyes, depthWrite: false, blending: THREE.AdditiveBlending }),
            warn: new THREE.SpriteMaterial({ map: this.tex.warn, depthWrite: false }),
            crack: this.tex.cracks.map((t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })),
            pipe: Object.fromEntries(Object.entries(this.tex.pipe).map(([k, t]) => [k, new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.4, metalness: 0.3, emissive: k.endsWith('1') ? 0xffa020 : 0x000000, emissiveIntensity: k.endsWith('1') ? 0.6 : 0, emissiveMap: k.endsWith('1') ? t : null })])),
            cursor: new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false }),
            glint: new THREE.SpriteMaterial({ map: this.fx.sparks[0].s.material.map, color: 0xfff2b0, depthWrite: false, blending: THREE.AdditiveBlending }),
        };

        // cursor: a gold frame floating over the hovered cell
        const frame = new THREE.Shape();
        frame.moveTo(-0.52, -0.52); frame.lineTo(0.52, -0.52); frame.lineTo(0.52, 0.52); frame.lineTo(-0.52, 0.52); frame.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-0.42, -0.42); hole.lineTo(-0.42, 0.42); hole.lineTo(0.42, 0.42); hole.lineTo(0.42, -0.42); hole.closePath();
        frame.holes.push(hole);
        const cg = new THREE.ShapeGeometry(frame);
        cg.rotateX(-Math.PI / 2);
        this.cursorMesh = new THREE.Mesh(cg, this.mat.cursor);
        this.cursorMesh.renderOrder = 5;
        this.cursorMesh.visible = false;
        this.scene.add(this.cursorMesh);

        // the numbers and numerals are painted into canvases: paint them again once the web fonts have arrived
        if (document.fonts?.load) {
            Promise.all(['900 92px "Nunito"', '800 74px "Alegreya"'].map((f) => document.fonts.load(f).catch(() => null)))
                .then(() => this.repaintGlyphs());
        }

        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.ready = this.load();

        this.resize();
        const onResize = () => this.resize(true);
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    repaintGlyphs() {
        this.tex.nums = NUM_COLORS.map((c, n) => (n ? glyphTex(String(n), c) : null));
        this.tex.roman = ROMAN.map((r) => (r ? glyphTex(r, '#ffe7a6', '800 74px "Alegreya", Georgia, serif') : null));
        this.tex.romanLit = ROMAN.map((r) => (r ? glyphTex(r, '#bffff8', '800 74px "Alegreya", Georgia, serif') : null));
        this.mat.num.forEach((m, n) => { if (m) { m.map = this.tex.nums[n]; m.needsUpdate = true; } });
        for (const cv of this.cells) cv.sig = '';      // rebuild the rune numerals with the new textures
    }

    /** Load the painted atlases; until they arrive blocks are drawn in flat colours. */
    async load() {
        const loader = new THREE.TextureLoader();
        const get = (path) => new Promise((res) => loader.load(ROOT + path, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
        const [tiles, mons, boss, items] = await Promise.all([get(ART.tiles), get(ART.monsters), get(ART.boss), get(ART.items)]);
        this.atlas = { tiles, mons, boss, items };
        const sub = (t, i, cols, rows) => {
            if (!t) return null;
            const c = t.clone();
            c.repeat.set(1 / cols, 1 / rows);
            c.offset.set((i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows);
            c.anisotropy = 4;
            c.needsUpdate = true;
            return c;
        };
        this.tileTex = [...Array(16)].map((_, i) => sub(tiles, i, 4, 4));
        this.monTex = [...Array(6)].map((_, i) => sub(mons, i, 3, 2));
        this.itemTex = [...Array(16)].map((_, i) => sub(items, i, 4, 4));
        this.bossTex = boss;
        this.buildMaterials();
        this.floorKey = '';     // rebuild with textures
    }

    buildMaterials() {
        const m = (tile, color, opts = {}) => new THREE.MeshStandardMaterial({ map: this.tileTex?.[tile] || null, color, roughness: 0.85, metalness: 0, ...opts });
        this.blockMat = {};
        for (const [id, b] of Object.entries(BLOCKS)) {
            const base = this.tileTex ? 0xffffff : b.color;
            const side = new THREE.Color(base).multiplyScalar(0.62).getHex();
            const lit = [m(b.tile, side), m(b.tile, side), m(b.tile, base, { emissive: 0x3a2410, emissiveIntensity: 0.5 }), m(b.tile, side), m(b.tile, side), m(b.tile, side)];
            // buried blocks (no open side yet) sit in shadow; the ones you can strike catch the light
            const dimTop = new THREE.Color(base).multiplyScalar(0.42).getHex(), dimSide = new THREE.Color(base).multiplyScalar(0.28).getHex();
            const dim = [m(b.tile, dimSide), m(b.tile, dimSide), m(b.tile, dimTop), m(b.tile, dimSide), m(b.tile, dimSide), m(b.tile, dimSide)];
            if (id === 'crystal') for (const q of [...lit, ...dim]) { q.roughness = 0.25; q.metalness = 0.1; }
            if (id === 'obsidian') for (const q of [...lit, ...dim]) { q.roughness = 0.3; }
            this.blockMat[id] = { lit, dim };
        }
        this.floorMat = {};
        for (const [id, th] of Object.entries(THEMES)) {
            this.floorMat[id] = { floor: m(th.floor, this.tileTex ? 0xffffff : 0xc9a576), room: m(th.room, this.tileTex ? 0xffffff : 0xb08a5a) };
        }
        this.pillarMat = m(2, this.tileTex ? 0xf0e0c0 : 0xd9b98a);
        this.capMat = m(PILLAR_TILE, this.tileTex ? 0xffffff : 0xe8d0a8);
        this.hatchMat = m(HATCH_TILE, this.tileTex ? 0xffffff : 0x9a8060);
        this.wallMat = m(2, 0xb8a080);
        this.groundMat = new THREE.MeshStandardMaterial({ color: 0x24160c, roughness: 1 });
        const sprite = (t, opts = {}) => new THREE.SpriteMaterial({ map: t || null, ...opts });
        this.chestMat = { closed: sprite(this.itemTex?.[12]), open: sprite(this.itemTex?.[13]), key: sprite(this.itemTex?.[11]) };
        this.monMat = Object.fromEntries(Object.entries(MONSTERS).map(([id, mo]) => [id, () => sprite(mo.boss ? this.bossTex : this.monTex?.[mo.sprite])]));
    }

    // ------------------------------------------------------------------ layout
    setInsets(ins) {
        const same = ['top', 'bottom', 'right', 'left'].every((k) => (this.insets[k] || 0) === (ins[k] || 0));
        this.insets = { ...ins };
        if (!same) this.fit();
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.fit();
    }

    /** Find the camera distance at which the whole floor fits the space between the HUD and the action bar. */
    fit() {
        const F = this.F;
        const W = F ? F.w : 8, H = F ? F.h : 8;
        const ins = this.insets;
        const aw = Math.max(120, this.w - (ins.right || 0) - (ins.left || 0) - 12), ah = Math.max(120, this.h - ins.top - ins.bottom);
        const tilt = 0.98;     // radians above the horizon... steep, so the far rows stay readable
        const dir = new THREE.Vector3(0, Math.sin(tilt + 0.2), Math.cos(tilt + 0.2)).normalize();
        this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
        const corners = [];
        for (const x of [-W / 2 - 0.6, W / 2 + 0.6]) for (const z of [-H / 2 - 0.6, H / 2 + 0.6]) for (const y of [0, 0.8]) corners.push(new THREE.Vector3(x, y, z));
        let lo = 3, hi = 60;
        for (let k = 0; k < 30; k++) {
            const d = (lo + hi) / 2;
            this.camera.position.copy(dir).multiplyScalar(d);
            this.camera.lookAt(0, 0, 0);
            this.camera.updateMatrixWorld();
            let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
            for (const c of corners) {
                const p = c.clone().project(this.camera);
                minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
            }
            const pw = (maxx - minx) / 2 * this.w, ph = (maxy - miny) / 2 * this.h;
            this.fitCenter = { x: (minx + maxx) / 2, y: (miny + maxy) / 2 };
            if (pw <= aw && ph <= ah) hi = d; else lo = d;
        }
        this.cam.dist = hi;
        this.cam.dir = dir;
        // shift the picture so the floor's centre sits in the middle of the free space
        this.camera.position.copy(dir).multiplyScalar(hi);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld();
        const cy = (ins.top + this.h - ins.bottom) / 2, cx = ((ins.left || 0) + this.w - (ins.right || 0)) / 2;
        const projX = (this.fitCenter.x + 1) / 2 * this.w, projY = (1 - this.fitCenter.y) / 2 * this.h;
        this.viewOff = { x: projX - cx, y: projY - cy };
        this.camera.setViewOffset(this.w, this.h, this.viewOff.x, this.viewOff.y, this.w, this.h);
        this.camera.updateProjectionMatrix();
        this.sun.shadow.camera.left = -W; this.sun.shadow.camera.right = W; this.sun.shadow.camera.top = H; this.sun.shadow.camera.bottom = -H;
        this.sun.shadow.camera.updateProjectionMatrix();
    }

    pos(i, y = 0) {
        const F = this.F;
        return new THREE.Vector3((i % F.w) - F.w / 2 + 0.5, y, Math.floor(i / F.w) - F.h / 2 + 0.5);
    }

    /** A cell's centre (top of its block, if any) in client pixels. */
    project(i, lift = 0.5) {
        if (!this.F || i < 0) return { x: this.w / 2, y: this.h / 2 };
        const p = this.pos(i, lift).project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    }

    /** The cell under a client point, or -1. */
    pick(clientX, clientY) {
        if (!this.F) return -1;
        const r = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hits = this.raycaster.intersectObjects(this.pickables, false);
        for (const h of hits) if (h.object.userData.i !== undefined) return h.object.userData.i;
        return -1;
    }

    // ------------------------------------------------------------------ building a floor
    build(G) {
        const F = G.F;
        this.F = F;
        this.root.clear();
        this.cells = [];
        this.pickables = [];
        if (!this.blockMat) this.buildMaterials();
        const theme = THEMES[F.theme];
        this.scene.background.set(theme.fog);
        // ground and the walls round the floor
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(F.w + 30, F.h + 30), this.groundMat);
        ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
        this.root.add(ground);
        const wallH = 0.9;
        for (const [sx, sz, lx, lz] of [[0, -1, F.w + 1.2, 0.6], [0, 1, F.w + 1.2, 0.6], [-1, 0, 0.6, F.h], [1, 0, 0.6, F.h]]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(lx, wallH, lz), this.wallMat);
            wall.position.set(sx * (F.w / 2 + 0.3), wallH / 2 - 0.1, sz * (F.h / 2 + 0.3));
            wall.castShadow = true; wall.receiveShadow = true;
            this.root.add(wall);
        }
        for (let i = 0; i < F.cells.length; i++) {
            const c = F.cells[i];
            const cv = { i, sig: '', anim: { shake: 0, squash: 0, drop: 0, dropV: 0 }, g: new THREE.Group() };
            cv.g.position.copy(this.pos(i));
            this.root.add(cv.g);
            if (c.k === 'p') {
                const p = new THREE.Mesh(this.geo.pillar, this.pillarMat);
                p.position.y = 0.65; p.castShadow = true; p.receiveShadow = true;
                const cap = new THREE.Mesh(this.geo.cap, [this.pillarMat, this.capMat, this.pillarMat]);
                cap.position.y = 1.36; cap.castShadow = true;
                cv.g.add(p, cap);
                this.cells.push(cv);
                continue;
            }
            const tile = new THREE.Mesh(this.geo.tile, c.room ? this.floorMat[F.theme].room : this.floorMat[F.theme].floor);
            tile.receiveShadow = true;
            tile.userData.i = i;
            tile.scale.setScalar(0.98);
            cv.g.add(tile);
            this.pickables.push(tile);
            cv.tile = tile;
            // drop-in: blocks fall into place from above, the nearest first
            const dx = (i % F.w) - (F.start % F.w), dy = Math.floor(i / F.w) - Math.floor(F.start / F.w);
            cv.anim.drop = 2.5 + Math.hypot(dx, dy) * 0.45;
            cv.anim.dropV = 0;
            this.cells.push(cv);
        }
        this.floorKey = `${G.seed}:${F.n}`;
        this.fit();
    }

    /** Bring one cell's meshes in line with its state. */
    syncCell(G, cv) {
        const F = G.F, c = F.cells[cv.i];
        if (c.k === 'p') return;
        const ex = c.k === 'b' && exposed(F, cv.i);
        const o = c.o;
        const glint = c.k === 'b' && (rank(G, 'dowse') >= 1 || has(G, 'starchart')) && (c.c?.loot === 'art' || o?.t === 'chest');
        const eyes = c.k === 'b' && has(G, 'lamp') && c.c?.d === 'mon';
        const sig = [c.k, c.b, c.hp, c.m, c.seen, c.lit, c.n, ex ? 1 : 0, o?.t, o?.open, o?.r, c.pw, o?.t === 'mon' ? `${o.hp}/${o.stun}` : '', glint ? 1 : 0, eyes ? 1 : 0, F.cleared ? 1 : 0, this.markMode ? 1 : 0, has(G, 'lens') ? 1 : 0, (F.hidden && !has(G, 'tablet')) ? 1 : 0].join('|');
        if (sig === cv.sig) return;
        cv.sig = sig;
        // clear everything but the floor tile
        for (const k of ['block', 'crack', 'num', 'flag', 'warn', 'eyes', 'glint', 'obj', 'hpbar', 'roman']) {
            if (cv[k]) { cv.g.remove(cv[k]); cv[k] = null; }
        }
        this.pickables = this.pickables.filter((p) => p.userData.i !== cv.i || p === cv.tile);
        if (c.k === 'b') {
            const mats = this.blockMat[c.b];
            const block = new THREE.Mesh(this.geo.block, ex ? mats.lit : mats.dim);
            block.position.y = BH / 2;
            block.castShadow = true; block.receiveShadow = true;
            block.userData.i = cv.i;
            cv.block = block;
            cv.g.add(block);
            this.pickables.push(block);
            if (c.b === 'rune') {
                if (c.lit) {
                    block.material = mats.lit.map((q, k) => (k === 2 ? q.clone() : q));
                    block.material[2].emissive = new THREE.Color(0x40e0d0);
                    block.material[2].emissiveIntensity = 0.9;
                    block.material[2].emissiveMap = block.material[2].map;
                }
                if (!(F.hidden && !has(G, 'tablet'))) {
                    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: (c.lit ? this.tex.romanLit : this.tex.roman)[c.r], depthWrite: false, depthTest: false }));
                    s.position.y = BH + 0.32; s.scale.setScalar(0.62); s.renderOrder = 6;
                    cv.roman = s; cv.g.add(s);
                }
            }
            if (c.b === 'panel' && c.pw) {
                // (a panel is opened the moment light reaches it; this only shows for one frame)
            }
            const dmg = c.mx > 1 ? 1 - c.hp / c.mx : 0;
            if (dmg > 0 && c.hp > 0) {
                const stage = dmg < 0.34 ? 0 : dmg < 0.67 ? 1 : 2;
                const cr = new THREE.Mesh(this.geo.tile, this.mat.crack[stage]);
                cr.position.y = BH + 0.004; cr.scale.setScalar(0.92); cr.renderOrder = 2;
                cv.crack = cr; cv.g.add(cr);
            }
            if (c.m) {
                const f = new THREE.Sprite(this.mat.flag);
                f.position.set(0.12, BH + 0.4, 0); f.scale.setScalar(0.62); f.renderOrder = 6;
                cv.flag = f; cv.g.add(f);
            } else if (c.seen) {
                const w = new THREE.Sprite(this.mat.warn);
                w.position.y = BH + 0.3; w.scale.setScalar(0.5); w.renderOrder = 6;
                cv.warn = w; cv.g.add(w);
            }
            if (eyes) {
                const e = new THREE.Sprite(this.mat.eyes);
                e.position.set(0, BH + 0.16, 0.2); e.scale.set(0.5, 0.25, 1); e.renderOrder = 6;
                cv.eyes = e; cv.g.add(e);
            }
            if (glint) {
                const s = new THREE.Sprite(this.mat.glint);
                s.position.set(0.25, BH + 0.12, 0.25); s.scale.setScalar(0.4); s.renderOrder = 6;
                cv.glint = s; cv.g.add(s);
            }
            return;
        }
        // ---- open floor
        if (c.n > 0) {
            const s = new THREE.Sprite(this.mat.num[c.n]);
            s.position.y = 0.3; s.scale.setScalar(0.62); s.renderOrder = 4;
            cv.num = s; cv.g.add(s);
        }
        if (!o) return;
        if (o.t === 'mon') {
            const s = new THREE.Sprite(this.monMat[o.id]());
            const big = MONSTERS[o.id].boss;
            s.scale.setScalar(big ? 1.9 : 1.05);
            s.position.y = big ? 0.95 : 0.55;
            s.userData.i = cv.i;
            s.userData.base = s.scale.x;
            if (o.stun) s.material.color.setRGB(0.6, 0.7, 1);
            cv.obj = s; cv.g.add(s);
            this.pickables.push(s);
            // health bar
            const bar = new THREE.Group();
            const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a0a04, depthTest: false }));
            bg.scale.set(0.8, 0.1, 1); bg.renderOrder = 7;
            const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5a3a, depthTest: false }));
            const r = Math.max(0, o.hp / o.mx);
            fg.center.set(0, 0.5); fg.position.x = -0.38; fg.scale.set(0.76 * r, 0.07, 1); fg.renderOrder = 8;
            bar.add(bg, fg);
            bar.position.y = big ? 1.95 : 1.15;
            cv.hpbar = bar; cv.g.add(bar);
        } else if (o.t === 'chest') {
            const s = new THREE.Sprite(o.open ? this.chestMat.open : this.chestMat.closed);
            s.scale.setScalar(0.85); s.position.y = 0.42;
            s.userData.i = cv.i;
            cv.obj = s; cv.g.add(s);
            this.pickables.push(s);
        } else if (o.t === 'pipe') {
            const eff = rotMask(o.m, o.r);
            const straight = eff === 5 || eff === 10;
            const steps = straight ? (eff === 10 ? 1 : 0) : ({ 3: 0, 6: 1, 12: 2, 9: 3 })[eff];
            const holder = new THREE.Group();
            const plane = new THREE.Mesh(this.geo.tile, this.mat.pipe[(straight ? 's' : 'c') + (c.pw ? 1 : 0)]);
            plane.position.y = 0.02; plane.renderOrder = 1;
            plane.userData.i = cv.i;
            holder.add(plane);
            const target = -steps * Math.PI / 2;
            // turn from where it was, the short way round, so a tap reads as a quarter turn
            const prev = cv.pipeRot ?? target;
            let from = prev;
            while (from - target > Math.PI) from -= Math.PI * 2;
            while (target - from > Math.PI) from += Math.PI * 2;
            holder.rotation.y = from;
            cv.pipeRot = target;
            cv.pipeAnim = { from, to: target, t: 0 };
            cv.obj = holder; cv.g.add(holder);
            this.pickables.push(plane);
        } else if (o.t === 'lens') {
            const g = new THREE.Group();
            const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.4, 16), this.pillarMat);
            ped.position.y = 0.2; ped.castShadow = true;
            const on = has(G, 'lens');
            const orb = new THREE.Mesh(new THREE.SphereGeometry(on ? 0.2 : 0.12, 20, 14), new THREE.MeshStandardMaterial({ color: on ? 0xffd36b : 0x6a5a48, emissive: on ? 0xffa020 : 0x000000, emissiveIntensity: on ? 1.4 : 0, roughness: 0.3 }));
            orb.position.y = 0.58;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 0.7, roughness: 0.3 }));
            ring.position.y = 0.58;
            g.add(ped, orb, ring);
            g.userData.ring = ring; g.userData.orb = orb; g.userData.on = on;
            cv.obj = g; cv.g.add(g);
        } else if (o.t === 'stairs') {
            const g = new THREE.Group();
            const hatch = new THREE.Mesh(this.geo.tile, this.hatchMat);
            hatch.position.y = 0.015; hatch.scale.setScalar(0.92);
            hatch.userData.i = cv.i;
            g.add(hatch);
            this.pickables.push(hatch);
            if (F.cleared) {
                const glow = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0x8ff0ff }));
                glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06;
                g.add(glow);
                g.userData.glow = glow;
            }
            cv.obj = g; cv.g.add(g);
        }
    }

    sync(G) {
        if (!G?.F) return;
        if (`${G.seed}:${G.F.n}` !== this.floorKey || G.F !== this.F) this.build(G);
        for (const cv of this.cells) this.syncCell(G, cv);
    }

    // ------------------------------------------------------------------ events → effects
    onEvents(G, events) {
        if (!this.F || G.F !== this.F) this.sync(G);
        for (const e of events) {
            const cv = this.cells[e.i];
            const p = e.i >= 0 && this.F && e.i < this.F.cells.length ? this.pos(e.i, BH * 0.7) : new THREE.Vector3();
            switch (e.type) {
                case 'strike': {
                    if (cv) { cv.anim.shake = 0.14; cv.anim.squash = 0.18; }
                    const color = BLOCKS[e.b]?.color || 0xe8c27a;
                    this.fx.burst(p.clone().setY(BH), color, e.crit ? 7 : 3, 0.6, 0.8);
                    this.fx.puff(p.clone().setY(BH * 0.9), BLOCKS[e.b]?.family === 'soft' ? 0xf0d8a8 : 0xd8ccb8, 2, 0.4, 0.4);
                    if (e.crit) { this.fx.sparkle(p, 0xffe08a, 10, 2.5); this.shake(0.06); }
                    if (e.hyper) this.fx.sparkle(p, 0xffc02e, 5, 2);
                    break;
                }
                case 'break': {
                    const fam = BLOCKS[e.b]?.family;
                    const hard = { soft: 0.6, stone: 1, obsidian: 1.4, crystal: 1.2, puzzle: 1 }[fam] || 1;
                    const color = BLOCKS[e.b]?.color || 0xe8c27a;
                    this.fx.burst(p, color, Math.round(12 + hard * 8), 0.8 + hard * 0.3);
                    this.fx.puff(p.clone().setY(0.3), fam === 'soft' ? 0xf0d8a8 : 0xcfc2a8, 5 + Math.round(hard * 3), 0.7, 0.8);
                    if (fam === 'crystal') this.fx.sparkle(p, 0xa8fff4, 16, 3);
                    if (fam === 'obsidian') this.fx.sparkle(p, 0xc08aff, 10, 2.5);
                    if (e.by === 'shock') this.fx.ring(p, 0xffd36b, 1.6, 0.4);
                    this.fx.flash(p, 0xffd59a, 2.5 * hard);
                    this.shake(0.025 + hard * 0.035);
                    break;
                }
                case 'shock': if (cv) cv.anim.shake = 0.1; break;
                case 'trap':
                    this.fx.puff(p.clone().setY(0.2), 0xe8b070, 14, 1.0, 2.4);
                    this.fx.sparkle(p, 0xff6a3a, 18, 3.2, 0.32);
                    this.fx.ring(p, 0xff5a3a, 2.4, 0.5);
                    this.shake(0.22);
                    break;
                case 'disarm': this.fx.sparkle(p, 0x8fe6ff, 18, 2.4); this.fx.ring(p, 0x8fe6ff, 1.8, 0.5); break;
                case 'falseAlarm': this.fx.puff(p, 0xbbbbbb, 4, 0.5, 0.4); break;
                case 'monster':
                    this.fx.puff(p.clone().setY(0.3), 0xd8c098, 10, 0.9, 1.4);
                    this.fx.sparkle(p, e.ambush ? 0x8fe6ff : 0xff8a5a, 10, 2);
                    if (cv) cv.anim.pop = 1;
                    this.shake(e.id === 'warden' ? 0.3 : 0.08);
                    break;
                case 'ambush': case 'mhit':
                    if (cv) { cv.anim.hit = 1; }
                    this.fx.sparkle(p.clone().setY(0.6), 0xffffff, 8, 2.6, 0.24);
                    this.shake(0.05);
                    break;
                case 'mattack': if (cv) cv.anim.lunge = 1; break;
                case 'mdie':
                    this.fx.puff(p.clone().setY(0.4), 0xffffff, 12, 0.9, 1.2);
                    this.fx.sparkle(p, 0xffe08a, 16, 3);
                    this.fx.ring(p, 0xffe08a, 2, 0.5);
                    this.shake(0.1);
                    break;
                case 'hurt': this.shake(e.src === 'trap' ? 0.18 : 0.12); break;
                case 'loot':
                    if (e.kind === 'gold') this.fx.sparkle(p, 0xffd36b, 8, 2.2, 0.22);
                    else if (e.kind === 'gem') this.fx.sparkle(p, 0x6ac8ff, 12, 2.5);
                    else if (e.kind === 'food') this.fx.sparkle(p, 0x9aff8a, 6, 1.6, 0.2);
                    break;
                case 'artifact':
                    this.fx.beam(p, 0xffe9a8, 2.2);
                    this.fx.sparkle(p.clone().setY(1), 0xfff2b0, 40, 3.5, 0.34, 1.4, 0.8);
                    this.fx.ring(p, 0xffe08a, 4, 1);
                    this.shake(0.12);
                    break;
                case 'levelup': {
                    const c = new THREE.Vector3();
                    this.fx.ring(c, 0xffd36b, Math.max(this.F.w, this.F.h) * 1.4, 1.1);
                    this.fx.sparkle(c.setY(1), 0xffe08a, 30, 4, 0.34, 1.2, 3);
                    break;
                }
                case 'runeLit': this.fx.sparkle(p.clone().setY(BH + 0.2), 0x8ff0ff, 14, 2); this.fx.flash(p, 0x60f0e0, 3); break;
                case 'runeReset': for (const j of e.cells) this.fx.puff(this.pos(j, BH), 0x888888, 2, 0.4, 0.3); if (cv) cv.anim.shake = 0.2; break;
                case 'runeFizzle': this.fx.puff(p, 0xaaaaaa, 3, 0.4, 0.3); break;
                case 'runeSolved':
                    for (const j of e.cells) { this.fx.sparkle(this.pos(j, BH), 0x8ff0ff, 16, 3); this.fx.ring(this.pos(j), 0x8ff0ff, 2.2, 0.7); }
                    this.shake(0.15);
                    break;
                case 'rot': break;
                case 'panelOpen':
                    for (const j of e.path) this.fx.sparkle(this.pos(j, 0.2), 0xffd36b, 6, 1.6, 0.26);
                    this.fx.beam(p, 0xffd36b, 1.6);
                    this.fx.ring(p, 0xffd36b, 3, 0.8);
                    this.shake(0.15);
                    break;
                case 'chestOpen': this.fx.sparkle(p.clone().setY(0.6), 0xffd36b, 34, 3.4, 0.3, 1.1, 0.5); this.fx.ring(p, 0xffd36b, 2.4, 0.6); break;
                case 'clear': {
                    const c = new THREE.Vector3();
                    this.fx.ring(c, 0x8ff0ff, Math.max(this.F.w, this.F.h) * 1.6, 1.3);
                    for (let k = 0; k < 6; k++) this.fx.sparkle(this.pos(Math.floor(Math.random() * this.F.cells.length), 0.4), 0xfff2b0, 8, 2.4);
                    break;
                }
                case 'blast':
                    this.fx.ring(p, 0xffa040, 4, 0.6);
                    this.fx.puff(p.clone().setY(0.3), 0xd0b080, 20, 1.3, 1.8);
                    this.fx.flash(p, 0xffa040, 10);
                    this.shake(0.35);
                    break;
                case 'dowsed': for (const cv2 of this.cells) if (this.F.cells[cv2.i]?.seen) this.fx.sparkle(this.pos(cv2.i, BH + 0.2), 0xff8a5a, 4, 1.4); break;
                case 'warded': this.fx.ring(new THREE.Vector3(), 0x8fe6ff, 3, 0.5); break;
                case 'unlock': this.fx.sparkle(p, 0xffd36b, 14, 2.4); break;
                default: break;
            }
        }
        this.sync(G);
    }

    shake(a) { if (this.shakeOn) this.shakeAmt = Math.min(0.5, this.shakeAmt + a); }

    setCursor(i, markMode) {
        this.cursor = i;
        this.markMode = markMode;
        this.mat.cursor.color.set(markMode ? 0xff6a4a : 0xffe08a);
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        if (G?.F) this.sync(G);
        const F = this.F;
        // per-cell animation
        for (const cv of this.cells) {
            const a = cv.anim;
            if (!a) continue;
            if (a.drop > 0) {
                a.dropV -= 30 * dt;
                a.drop = Math.max(0, a.drop + a.dropV * dt);
                if (a.drop === 0 && a.dropV < -2) { a.dropV = 0; }
            }
            cv.g.position.y = a.drop;
            if (cv.block) {
                a.shake = Math.max(0, a.shake - dt);
                a.squash = Math.max(0, a.squash - dt * 1.4);
                const s = a.shake;
                cv.block.position.x = s ? (Math.random() - 0.5) * s * 0.6 : 0;
                cv.block.position.z = s ? (Math.random() - 0.5) * s * 0.6 : 0;
                const q = Math.sin(a.squash * 30) * a.squash;
                cv.block.scale.set(1 + q * 0.4, 1 - q, 1 + q * 0.4);
                cv.block.position.y = (BH / 2) * (1 - q);
                if (cv.glint) cv.glint.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + cv.i));
                if (cv.eyes) cv.eyes.material.opacity = 0.55 + 0.45 * Math.sin(time * 2 + cv.i);
                if (cv.warn) cv.warn.position.y = BH + 0.3 + Math.sin(time * 4 + cv.i) * 0.04;
                if (cv.roman) cv.roman.position.y = BH + 0.32 + Math.sin(time * 2 + cv.i) * 0.03;
            }
            if (cv.obj) {
                const o = F?.cells[cv.i]?.o;
                if (o?.t === 'mon') {
                    const s = cv.obj;
                    a.pop = Math.max(0, (a.pop || 0) - dt * 3);
                    a.hit = Math.max(0, (a.hit || 0) - dt * 4);
                    a.lunge = Math.max(0, (a.lunge || 0) - dt * 3);
                    const base = s.userData.base;
                    const pop = 1 - a.pop;
                    const bob = Math.sin(time * 4 + cv.i) * 0.04;
                    s.scale.set(base * pop * (1 + a.hit * 0.15), base * pop * (1 - a.hit * 0.12 + bob), 1);
                    s.position.z = Math.sin(a.lunge * Math.PI) * 0.35;
                    s.position.x = a.hit ? (Math.random() - 0.5) * a.hit * 0.2 : 0;
                    if (!o.stun) s.material.color.setRGB(1, 1 - a.hit * 0.6, 1 - a.hit * 0.6);
                } else if (o?.t === 'pipe' && cv.pipeAnim) {
                    const pa = cv.pipeAnim;
                    pa.t = Math.min(1, pa.t + dt * 7);
                    const e = 1 - (1 - pa.t) ** 3;
                    cv.obj.rotation.y = pa.from + (pa.to - pa.from) * e;
                } else if (o?.t === 'lens' && cv.obj.userData.on) {
                    cv.obj.userData.ring.rotation.y = time;
                    cv.obj.userData.ring.rotation.x = Math.sin(time) * 0.4;
                    cv.obj.userData.orb.position.y = 0.58 + Math.sin(time * 2) * 0.04;
                } else if (o?.t === 'stairs' && cv.obj.userData.glow) {
                    const gl = cv.obj.userData.glow;
                    gl.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
                } else if (o?.t === 'chest' && !o.open) {
                    cv.obj.position.y = 0.42 + Math.abs(Math.sin(time * 2.5 + cv.i)) * 0.05;
                }
            }
            if (cv.num) cv.num.position.y = 0.3 + Math.sin(time * 1.5 + cv.i * 0.7) * 0.02;
        }
        // cursor
        if (F && this.cursor >= 0 && this.cursor < F.cells.length && F.cells[this.cursor].k !== 'p') {
            const c = F.cells[this.cursor];
            this.cursorMesh.visible = true;
            this.cursorMesh.position.copy(this.pos(this.cursor, (c.k === 'b' ? BH : 0) + 0.02 + (this.cells[this.cursor]?.anim?.drop || 0)));
            this.mat.cursor.opacity = 0.6 + Math.sin(time * 6) * 0.25;
        } else this.cursorMesh.visible = false;

        this.fx.update(dt);
        // camera: shake and the dive into the hatch
        this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.6);
        const s = this.shakeAmt * this.shakeAmt;
        const dir = this.cam.dir || new THREE.Vector3(0, 0.9, 0.4);
        const dist = this.cam.dist * (1 - this.cam.dive * 0.75);
        this.camera.position.copy(dir).multiplyScalar(dist);
        if (this.cam.dive && this.F) this.camera.position.add(this.pos(this.F.exit).multiplyScalar(this.cam.dive));
        this.camera.position.x += (Math.random() - 0.5) * s * 2;
        this.camera.position.y += (Math.random() - 0.5) * s * 2;
        this.camera.lookAt(this.cam.dive && this.F ? this.pos(this.F.exit).multiplyScalar(this.cam.dive) : new THREE.Vector3());
        this.renderer.render(this.scene, this.camera);
    }
}
