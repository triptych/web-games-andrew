// The 3D books. three.js builds every book from its procedural `look`: boards with a painted, gilt-tooled cover
// (colour, metalness, roughness and bump maps from view/covers.js), a rounded spine, a page block with gilt, marbled
// or plain edges and a title page inside, metal corners, a clasp, a ribbon, a glow for the legendary ones.
//
// Two modes share one renderer:
//   inspect(book)      one book, high resolution: orbit, zoom, open the cover.
//   shelves(G)         every shelf and table in the shop as 3D bookcases; tap a book to inspect it.
// The view only reads the game; it never changes it.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drawCover, drawSpine, drawEdge, drawTitlePage } from './covers.js';
import { FURNITURE } from '../sim/data.js';

const BOARD = 0.028;

function canvasTex(w, h, paint, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

/** Roughness from a metal mask: leather is matte, gilt shines. */
function roughFrom(metalCanvas, base) {
    const c = document.createElement('canvas');
    c.width = metalCanvas.width; c.height = metalCanvas.height;
    const x = c.getContext('2d');
    x.drawImage(metalCanvas, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { const m = d.data[i] / 255; const v = Math.round((base * (1 - m) + 0.22 * m) * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
}

function plainBack(ctx, book, w, h) {
    // the back board: the cover's colour and grain, a simple border, no title
    drawCover(ctx, { ...book, title: '', author: '', plus: 0, look: { ...book.look, pattern: book.look.pattern === 'plain' ? 'plain' : 'border', emblem: book.look.emblem } }, w, h);
}

/** Build one book. q: texture height in px for the cover (1024 in the inspector, less elsewhere). */
export function buildBook(book, q = 1024) {
    const L = book.look;
    const H = L.h, W = L.w, T = L.t;
    const g = new THREE.Group();
    const disp = [];
    const keep = (x) => { disp.push(x); return x; };
    const roughBase = L.material === 'cloth' ? 0.85 : L.material === 'board' ? 0.6 : L.material === 'dragonhide' ? 0.42 : 0.66;
    const cw = Math.round(q * W / H), ch = q;

    // ---- cover materials
    const coverMap = keep(canvasTex(cw, ch, (c, w, h) => drawCover(c, book, w, h)));
    const metalCanvas = document.createElement('canvas'); metalCanvas.width = cw; metalCanvas.height = ch;
    drawCover(metalCanvas.getContext('2d'), book, cw, ch, 'metal');
    const metalMap = keep(new THREE.CanvasTexture(metalCanvas));
    const roughMap = keep(roughFrom(metalCanvas, roughBase));
    const bumpMap = keep(canvasTex(cw, ch, (c, w, h) => drawCover(c, book, w, h, 'bump'), false));
    const glow = L.glow ? new THREE.Color(L.glow) : null;
    const coverMat = keep(new THREE.MeshStandardMaterial({
        map: coverMap, metalness: 1, metalnessMap: metalMap, roughness: 1, roughnessMap: roughMap,
        bumpMap, bumpScale: 2.2, emissive: glow || 0x000000, emissiveMap: glow ? metalMap : null, emissiveIntensity: glow ? 0.55 : 0,
    }));
    const backMap = keep(canvasTex(Math.round(cw / 2), Math.round(ch / 2), (c, w, h) => plainBack(c, book, w, h)));
    const backMat = keep(new THREE.MeshStandardMaterial({ map: backMap, roughness: roughBase, metalness: 0.05 }));
    const edgeMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(L.hue / 360, L.sat / 100 * 0.8, L.lit / 100 * 0.8), roughness: roughBase }));
    const endpaper = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(((L.hue + 30) % 360) / 360, 0.35, 0.72), roughness: 0.9 }));

    // ---- spine: half a cylinder, flattened a little
    const spineMap = keep(canvasTex(Math.round(q * 0.22), q, (c, w, h) => drawSpine(c, book, w, h)));
    const spineMetal = document.createElement('canvas'); spineMetal.width = Math.round(q * 0.22); spineMetal.height = q;
    drawSpine(spineMetal.getContext('2d'), book, spineMetal.width, spineMetal.height, 'metal');
    const spineMetalMap = keep(new THREE.CanvasTexture(spineMetal));
    const spineMat = keep(new THREE.MeshStandardMaterial({
        map: spineMap, metalness: 1, metalnessMap: spineMetalMap, roughness: 1, roughnessMap: keep(roughFrom(spineMetal, roughBase)),
        emissive: glow || 0x000000, emissiveMap: glow ? spineMetalMap : null, emissiveIntensity: glow ? 0.5 : 0, side: THREE.DoubleSide,
    }));
    const spineGeo = keep(new THREE.CylinderGeometry(T / 2, T / 2, H, 32, 1, true, Math.PI, Math.PI));
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.scale.x = 0.42;
    spine.position.x = -W / 2;
    spine.castShadow = true;
    g.add(spine);

    // ---- page block, with its edges and a title page on top
    const inset = 0.035;
    const pw = W - inset, ph = H - inset * 2, pt = T - BOARD * 2 - 0.004;
    const foreMap = keep(canvasTex(64, 512, (c, w, h) => drawEdge(c, book, w, h)));
    const topMap = keep(canvasTex(512, 64, (c, w, h) => drawEdge(c, book, w, h)));
    const gilt = L.edge === 'gilt';
    const edgeMk = (map) => keep(new THREE.MeshStandardMaterial({ map, metalness: gilt ? 0.85 : 0, roughness: gilt ? 0.35 : 0.9 }));
    const pageMap = keep(canvasTex(Math.round(q * 0.7 * pw / ph), Math.round(q * 0.7), (c, w, h) => drawTitlePage(c, book, w, h)));
    const pageMat = keep(new THREE.MeshStandardMaterial({ map: pageMap, roughness: 0.92 }));
    const fore = edgeMk(foreMap), top = edgeMk(topMap);
    const pages = new THREE.Mesh(keep(new THREE.BoxGeometry(pw, ph, pt)), [fore, endpaper, top, top, pageMat, pageMat]);
    pages.position.x = inset / 2 - 0.004;
    pages.castShadow = true; pages.receiveShadow = true;
    g.add(pages);

    // ---- boards: the back is fixed, the front swings open on a hinge at the spine
    const boardGeo = keep(new THREE.BoxGeometry(W, H, BOARD));
    const back = new THREE.Mesh(boardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, endpaper, backMat]);
    back.position.z = -T / 2 + BOARD / 2;
    back.castShadow = true;
    g.add(back);
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, T / 2 - BOARD / 2);
    const front = new THREE.Mesh(boardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, coverMat, endpaper]);
    front.position.x = W / 2;
    front.castShadow = true;
    hinge.add(front);
    g.add(hinge);

    // ---- metal: corners and a clasp
    const metal = keep(new THREE.MeshStandardMaterial({ color: L.metalColor, metalness: 1, roughness: 0.28, emissive: glow || 0x000000, emissiveIntensity: glow ? 0.25 : 0 }));
    if (L.corners) {
        const cg = keep(new THREE.BoxGeometry(0.11, 0.11, BOARD + 0.008));
        for (const sy of [-1, 1]) {
            const c1 = new THREE.Mesh(cg, metal); c1.position.set(W / 2 - 0.055, sy * (H / 2 - 0.055), 0); front.add(c1);
            const c2 = new THREE.Mesh(cg, metal); c2.position.set(W / 2 - 0.055, sy * (H / 2 - 0.055), back.position.z); g.add(c2);
        }
    }
    let clasp = null;
    if (L.clasp) {
        clasp = new THREE.Group();
        const strap = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 0.09, T + 0.02)), metal);
        strap.position.set(W / 2 - 0.02, 0, 0);
        const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 16, 12)), metal);
        knob.position.set(W / 2 - 0.06, 0, T / 2 + 0.012);
        clasp.add(strap, knob);
        g.add(clasp);
    }
    // ---- a silk ribbon
    const rib = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.035, 0.22)), keep(new THREE.MeshStandardMaterial({ color: L.ribbon, roughness: 0.5, side: THREE.DoubleSide })));
    rib.position.set(-W * 0.15, -H / 2 - 0.07, 0.01);
    g.add(rib);

    g.userData = { hinge, clasp, H, W, T, dispose: () => disp.forEach((d) => d.dispose && d.dispose()) };
    return g;
}

/** A cheap book for the shelf view: a box with the spine painted on the side that faces out. */
function shelfBook(book, mats) {
    const L = book.look;
    const s = 0.44;
    const H = L.h * s, W = L.w * s, T = L.t * s;
    const spine = mats.spine(book);
    const body = mats.body(book);
    const m = new THREE.Mesh(new THREE.BoxGeometry(T, H, W), [body, body, mats.paper, mats.paper, spine, body]);
    m.castShadow = true;
    m.userData = { book: book.id, H, W, T };
    return m;
}

function woodTex(dark = false) {
    return canvasTex(256, 256, (c, w, h) => {
        c.fillStyle = dark ? '#3a2416' : '#6b4226'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
            c.strokeStyle = `rgba(${dark ? '20,10,5' : '40,22,10'},${0.15 + Math.random() * 0.2})`;
            c.lineWidth = 1 + Math.random() * 2;
            const y = Math.random() * h;
            c.beginPath(); c.moveTo(0, y);
            for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x / 40 + i) * 3);
            c.stroke();
        }
    });
}

export class BookStage {
    constructor(canvas) {
        this.canvas = canvas;
        this.ready = false;
        this.visible = false;
        this.mode = null;
        this.onPick = null;
        this.openT = 0; this.openTarget = 0;
    }

    _init() {
        if (this.ready) return;
        this.ready = true;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.05;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.setClearColor(0x000000, 0);
        this.scene = new THREE.Scene();
        const pm = new THREE.PMREMGenerator(r);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
        this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
        const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a20, 0.55);
        const key = this.key = new THREE.DirectionalLight(0xffe2b8, 2.1);
        key.position.set(2.2, 3.2, 3.4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
        key.shadow.bias = -0.0006;
        key.shadow.radius = 4;
        const rim = new THREE.DirectionalLight(0x9fb8ff, 0.9);
        rim.position.set(-3, 2, -2.5);
        this.scene.add(hemi, key, rim);
        this.floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.28 }));
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.minDistance = 1.4;
        this.controls.maxDistance = 6;
        this.controls.addEventListener('start', () => { this.touched = true; });
        this.ray = new THREE.Raycaster();
        this._bindShelfInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.ready) return;
        const r = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.mode === 'shelves') this._fitShelves();
    }

    _clear() {
        for (const c of [...this.root.children]) {
            this.root.remove(c);
            c.traverse((o) => { if (o.userData?.dispose) o.userData.dispose(); if (o.geometry && !o.userData?.shared) o.geometry.dispose?.(); });
        }
        if (this.shelfMats) { for (const m of this.shelfMats.all) { m.map?.dispose(); m.dispose(); } this.shelfMats = null; }
        this.bookObj = null;
        this.picks = [];
    }

    /** One book, close up. */
    inspect(book, { open = false, quality = 1024 } = {}) {
        this._init();
        this._clear();
        this.mode = 'inspect';
        const q = Math.min(quality, (window.innerWidth < 700 ? 768 : 1024));
        const b = this.bookObj = buildBook(book, q);
        b.position.y = b.userData.H / 2 + 0.005;
        b.rotation.y = -0.45;
        this.root.add(b);
        this.floor.visible = true;
        this.openT = open ? 1 : 0; this.openTarget = open ? 1 : 0;
        this.controls.enabled = true;
        this.controls.target.set(0, b.userData.H / 2, 0);
        this.camera.position.set(0.35, b.userData.H * 0.68, 2.35);
        this.controls.update();
        this.touched = false;
        this.spin = 0;
        this.key.position.set(2.2, 3.2, 3.4);
        this.key.target.position.set(0, 0, 0);
        this.resize();
    }

    toggleOpen() { this.openTarget = this.openTarget ? 0 : 1; return !!this.openTarget; }

    /** Every shelf and table in the shop, as bookcases standing in a row. */
    shelves(G, books) {
        this._init();
        this._clear();
        this.mode = 'shelves';
        this.controls.enabled = false;
        this.floor.visible = true;
        const wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.75 });
        const backWood = new THREE.MeshStandardMaterial({ map: woodTex(true), roughness: 0.9 });
        const paper = new THREE.MeshStandardMaterial({ color: 0xeee0c0, roughness: 0.95 });
        const spineCache = new Map(), bodyCache = new Map();
        const all = [wood, backWood, paper];
        this.shelfMats = {
            all,
            paper,
            spine: (b) => {
                if (!spineCache.has(b.id)) {
                    const t = canvasTex(64, Math.round(256 * b.look.h), (c, w, h) => drawSpine(c, b, w, h));
                    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.1, emissive: b.look.glow ? new THREE.Color(b.look.glow) : 0x000000, emissiveIntensity: b.look.glow ? 0.25 : 0 });
                    spineCache.set(b.id, m); all.push(m);
                }
                return spineCache.get(b.id);
            },
            body: (b) => {
                if (!bodyCache.has(b.id)) {
                    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(b.look.hue / 360, b.look.sat / 100, b.look.lit / 100), roughness: 0.7 });
                    bodyCache.set(b.id, m); all.push(m);
                }
                return bodyCache.get(b.id);
            },
        };
        const CW = 1.2, CH = 2.3, D = 0.42, rows = 4, rowH = (CH - 0.16) / rows;
        const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 });
        const pot = new THREE.MeshStandardMaterial({ color: 0xb8643a, roughness: 0.8 });
        const leaf = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.7 });
        const flame = new THREE.MeshBasicMaterial({ color: 0xffd98a });
        const globe = new THREE.MeshStandardMaterial({ color: 0x3f6fb0, roughness: 0.5, metalness: 0.1 });
        all.push(brass, pot, leaf, flame, globe);
        /** A little prop to keep a half-empty row cozy: a candle, a plant or a globe. */
        const prop = (grp, x, y, k) => {
            const o = new THREE.Group();
            if (k === 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.16, 12), brass); c.position.y = 0.08; const w = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0xf4ead0 })); w.position.y = 0.21; const f = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), flame); f.position.y = 0.28; f.scale.y = 1.8; o.add(c, w, f); }
            else if (k === 1) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.11, 14), pot); p.position.y = 0.055; o.add(p); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), leaf); l.position.set(Math.cos(i * 1.3) * 0.04, 0.14 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.04); o.add(l); } }
            else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 14), brass); const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), globe); g2.position.y = 0.12; o.add(b, g2); }
            o.position.set(x, y, 0.02);
            o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
            grp.add(o);
        };
        let x = 0;
        this.picks = [];
        const cases = [];
        for (let s = 0; s < G.shop.width; s++) {
            for (const row of ['wall', 'floor']) {
                const cell = G.shop[row][s];
                if (!cell || !FURNITURE[cell.type].cap) continue;
                const on = books.filter((b) => b.loc && b.loc.row === row && b.loc.slot === s);
                const grp = new THREE.Group();
                grp.position.x = x;
                if (cell.type === 'shelf') {
                    const box = (w, h, d, px, py, pz, m = wood) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; grp.add(o); };
                    box(0.06, CH, D, -CW / 2, CH / 2, 0); box(0.06, CH, D, CW / 2, CH / 2, 0);
                    box(CW + 0.06, 0.07, D + 0.04, 0, CH, 0.01);
                    box(CW, 0.02, 0.02, 0, CH / 2, -D / 2, backWood); box(CW, CH, 0.02, 0, CH / 2, -D / 2, backWood);
                    for (let r = 0; r <= rows; r++) box(CW, 0.04, D, 0, 0.06 + r * rowH, 0);
                    // books stand three to a row, left to right by their slot
                    const perRow = Math.ceil(FURNITURE.shelf.cap / rows);
                    for (let r = 0; r < rows; r++) {
                        let bx = -CW / 2 + 0.08;
                        const rowBooks = on.filter((b) => Math.floor(b.loc.i / perRow) === r).sort((a, c) => a.loc.i - c.loc.i);
                        for (const b of rowBooks) {
                            const m = shelfBook(b, this.shelfMats);
                            const T = m.userData.T;
                            m.position.set(bx + T / 2, 0.08 + (rows - 1 - r) * rowH + m.userData.H / 2, 0.02);
                            m.rotation.z = rowBooks.length < 3 && b === rowBooks[rowBooks.length - 1] && rowBooks.length > 1 ? -0.12 : 0;
                            bx += T + 0.025;
                            grp.add(m); this.picks.push(m);
                        }
                        if (rowBooks.length < 3 && (s + r) % 3 !== 2) prop(grp, CW / 2 - 0.16, 0.08 + (rows - 1 - r) * rowH, (s * 3 + r) % 3);
                    }
                } else {
                    // a display table: round top, books propped up facing out
                    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 40), wood);
                    top.position.y = 0.8; top.castShadow = top.receiveShadow = true;
                    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.8, 16), wood);
                    leg.position.y = 0.4; leg.castShadow = true;
                    grp.add(top, leg);
                    on.sort((a, c) => a.loc.i - c.loc.i).forEach((b, i) => {
                        const m = buildBook(b, 256);
                        m.scale.setScalar(0.32);
                        m.position.set((i - 1) * 0.36, 0.825 + m.userData.H * 0.32 / 2, 0.15);
                        m.rotation.x = -0.18;
                        m.traverse((o) => { if (o.isMesh) { o.userData.book = b.id; this.picks.push(o); } });
                        grp.add(m);
                    });
                }
                this.root.add(grp);
                cases.push(grp);
                x += CW + 0.35;
            }
        }
        this.shelfSpan = Math.max(0, x - CW - 0.35);
        this.camX = 0; this.camVX = 0;
        this.key.position.set(this.shelfSpan / 2 + 2, 4, 4);
        this.key.target.position.set(this.shelfSpan / 2, 0, 0);
        this.scene.add(this.key.target);
        this._fitShelves();
        return cases.length;
    }

    _fitShelves() {
        const portrait = this.camera.aspect < 1;
        this.camDist = portrait ? 6.2 : 4.4;
        this.camY = 1.15;
        this.camera.fov = portrait ? 44 : 34;
        this.camera.updateProjectionMatrix();
        this._placeShelfCam();
    }
    _placeShelfCam() {
        this.camX = Math.max(-0.2, Math.min(this.shelfSpan + 0.2, this.camX));
        this.camera.position.set(this.camX, this.camY + 0.2, this.camDist);
        this.camera.lookAt(this.camX, this.camY, 0);
    }

    _bindShelfInput() {
        let down = null;
        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.mode !== 'shelves') return;
            down = { x: e.clientX, y: e.clientY, cam: this.camX, moved: false, t: performance.now() };
            try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (this.mode !== 'shelves' || !down) return;
            const dx = e.clientX - down.x;
            if (Math.abs(dx) > 8) down.moved = true;
            const k = (this.camDist * 0.9) / Math.max(200, this.w);
            const nx = down.cam - dx * k * 1.6;
            this.camVX = (nx - this.camX) * 30;
            this.camX = nx;
            this._placeShelfCam();
        });
        const up = (e) => {
            if (this.mode !== 'shelves' || !down) return;
            if (!down.moved) this._pick(e.clientX, e.clientY);
            else this.glide = true;
            down = null;
        };
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', () => { down = null; });
        this.canvas.addEventListener('wheel', (e) => {
            if (this.mode !== 'shelves') return;
            e.preventDefault();
            this.camX += (e.deltaX || e.deltaY) * 0.004;
            this._placeShelfCam();
        }, { passive: false });
    }

    /** The book under a screen point, or null (also used by the tests). */
    bookAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(v, this.camera);
        const hit = this.ray.intersectObjects(this.picks || [], false)[0];
        return hit ? hit.object.userData.book : null;
    }
    _pick(x, y) {
        const id = this.bookAt(x, y);
        if (id != null) this.onPick?.(id);
    }
    /** Screen position of a book in the shelf view (for the tests and the hint arrow). */
    screenOf(bookId) {
        const m = (this.picks || []).find((o) => o.userData.book === bookId);
        if (!m) return null;
        const p = new THREE.Vector3();
        m.getWorldPosition(p);
        p.project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, on: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
    }
    focusBook(bookId) {
        const m = (this.picks || []).find((o) => o.userData.book === bookId);
        if (!m) return;
        const p = new THREE.Vector3(); m.getWorldPosition(p);
        this.camX = p.x; this._placeShelfCam();
    }

    frame(dt) {
        if (!this.ready || !this.visible) return;
        this.resize();
        if (this.mode === 'inspect' && this.bookObj) {
            const u = this.bookObj.userData;
            this.openT += (this.openTarget - this.openT) * Math.min(1, dt * 4);
            const a = this.openT * Math.PI * 0.92;
            u.hinge.rotation.y = -a;
            if (u.clasp) u.clasp.visible = this.openT < 0.04;
            if (!this.touched) { this.spin += dt; this.bookObj.rotation.y = -0.45 + Math.sin(this.spin * 0.5) * 0.35; }
            this.controls.update();
        } else if (this.mode === 'shelves' && this.glide) {
            this.camVX *= Math.pow(0.02, dt);
            if (Math.abs(this.camVX) < 0.02) this.glide = false;
            this.camX += this.camVX * dt;
            this._placeShelfCam();
        }
        this.renderer.render(this.scene, this.camera);
    }
}
