// The stage: renderer, camera, lights, the gothic board, the cathedral behind it, the embers in the
// air, and the separate arena where two pieces fight. All geometry and textures are made here in
// code. Reads a board B = { w, h, tiles }; knows nothing about units.
//
// Board square (x, y) sits at world (x - w/2 + 0.5, 0, y - h/2 + 0.5): the player's rows (high y)
// are nearest the camera, like a chess board seen from White's side.

import * as THREE from 'three';
import { hash3 } from '../rng.js';

export const THEMES = {
    moon:    { fog: 0x090c16, hemi: [0x7f9bd8, 0x1a1624, 1.7], dir: [0xa8b8ff, 2.6], glass: ['#2c4fc0', '#7a8cff', '#dfe6ff'], ember: 0x9fb4ff, flame: 0xffb060 },
    candle:  { fog: 0x120a0a, hemi: [0xffb070, 0x241410, 1.6], dir: [0xffc890, 2.5], glass: ['#a02a10', '#ff8a30', '#ffe0a0'], ember: 0xffb060, flame: 0xffa040 },
    flood:   { fog: 0x061214, hemi: [0x60c0c0, 0x0a1a1c, 1.7], dir: [0x80e0e0, 2.5], glass: ['#104060', '#20a0a0', '#a0fff0'], ember: 0x80ffe8, flame: 0x7ae0ff },
    wind:    { fog: 0x0e1014, hemi: [0x9aa4b0, 0x1a1c22, 1.7], dir: [0xc0ccd8, 2.6], glass: ['#303848', '#6a7a90', '#d0e0f0'], ember: 0xd0dce8, flame: 0xbad0ff },
    bell:    { fog: 0x140e08, hemi: [0xd8a860, 0x20160c, 1.6], dir: [0xffd890, 2.5], glass: ['#603010', '#c08030', '#ffe090'], ember: 0xffd080, flame: 0xffc060 },
    crimson: { fog: 0x14060a, hemi: [0xd05060, 0x200810, 1.6], dir: [0xff8090, 2.4], glass: ['#500818', '#c02040', '#ff9aa0'], ember: 0xff6070, flame: 0xff6050 },
};

const ARENA = new THREE.Vector3(240, 0, 0);

function canvasTex(w, h, draw, repeat = null) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
}

/** Cold flagstone: grey noise, mortar lines, a few cracks. Greyscale, so instance colours tint it. */
function stoneTexture(repeat) {
    return canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#b9b6c2'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
            const v = 150 + Math.floor(hash3(i, 1, 7) * 90);
            g.fillStyle = `rgba(${v},${v},${v + 8},0.18)`;
            g.fillRect(hash3(i, 2, 7) * w, hash3(i, 3, 7) * h, 1 + hash3(i, 4, 7) * 3, 1 + hash3(i, 5, 7) * 3);
        }
        g.strokeStyle = 'rgba(30,28,40,0.55)'; g.lineWidth = 3;
        g.strokeRect(1, 1, w - 2, h - 2);
        g.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) {
            g.beginPath();
            let x = hash3(k, 9, 3) * w, y = hash3(k, 8, 3) * h;
            g.moveTo(x, y);
            for (let s = 0; s < 6; s++) { x += (hash3(k, s, 11) - 0.5) * 60; y += (hash3(k, s, 12) - 0.5) * 60; g.lineTo(x, y); }
            g.stroke();
        }
    }, repeat);
}

/** A rose window in the theme's three glass colours, with dark lead lines. */
function glassTexture(cols) {
    return canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = '#05040a'; g.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2;
        const ring = (r0, r1, n, col, off = 0) => {
            for (let i = 0; i < n; i++) {
                const a0 = off + (i / n) * Math.PI * 2, a1 = off + ((i + 1) / n) * Math.PI * 2;
                g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath();
                g.fillStyle = col(i); g.fill();
                g.strokeStyle = '#05040a'; g.lineWidth = 5; g.stroke();
            }
        };
        ring(200, 250, 24, (i) => cols[i % 3]);
        ring(130, 196, 12, (i) => cols[(i + 1) % 3], 0.1);
        ring(60, 126, 8, (i) => cols[(i + 2) % 3], 0.2);
        g.beginPath(); g.arc(cx, cy, 52, 0, Math.PI * 2); g.fillStyle = cols[2]; g.fill();
        g.strokeStyle = '#05040a'; g.lineWidth = 6; g.stroke();
    });
}

function runeTexture() {
    return canvasTex(256, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,225,150,0.95)'; g.lineWidth = 5;
        g.beginPath(); g.arc(w / 2, h / 2, 100, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 3;
        g.beginPath(); g.arc(w / 2, h / 2, 76, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2, b = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
            g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 100, h / 2 + Math.sin(a) * 100); g.lineTo(w / 2 + Math.cos(b) * 100, h / 2 + Math.sin(b) * 100); g.stroke();
        }
    });
}

function archGeo(w, h) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h * 0.6);
    s.quadraticCurveTo(-w / 2, h * 0.95, 0, h * 1.15);
    s.quadraticCurveTo(w / 2, h * 0.95, w / 2, h * 0.6);
    s.lineTo(w / 2, 0); s.closePath();
    return new THREE.ShapeGeometry(s);
}

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x07060b);
        this.scene.fog = new THREE.Fog(0x07060b, 16, 46);
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
        this.calm = false;
        this.pad = { top: 56, bottom: 0, left: 0, right: 0 };
        this.shake = 0;
        this.arenaOn = false;
        this.orbit = false;
        this.lights = [];                 // flickering flames
        this.hemi = new THREE.HemisphereLight(0x7f9bd8, 0x1a1624, 0.9);
        this.dir = new THREE.DirectionalLight(0xa8b8ff, 1.5);
        this.dir.position.set(-6, 12, 8);
        this.scene.add(this.hemi, this.dir);

        this.stone = stoneTexture([1, 1]);
        this.stoneWide = stoneTexture([8, 6]);
        this.rune = runeTexture();
        this.board = new THREE.Group();
        this.scene.add(this.board);
        this.cathedral = new THREE.Group();
        this.scene.add(this.cathedral);
        this.embers = this._embers(110, 11, 5, 11);
        this.scene.add(this.embers);
        this._buildArena();

        this.B = null;
        this.theme = null;
        this.setTheme('moon');
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.ray = new THREE.Raycaster();
        this.floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }

    // ------------------------------------------------------------------ geometry helpers
    tilePos(x, y, B = this.B) { return new THREE.Vector3(x - B.w / 2 + 0.5, 0, y - B.h / 2 + 0.5); }

    _embers(n, rx, ry, rz) {
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3);
        const seed = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            p[i * 3] = (hash3(i, 1, 5) - 0.5) * rx * 2; p[i * 3 + 1] = hash3(i, 2, 5) * ry; p[i * 3 + 2] = (hash3(i, 3, 5) - 0.5) * rz * 2;
            seed[i] = hash3(i, 4, 5);
        }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const m = new THREE.PointsMaterial({ color: 0xffb060, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
        const pts = new THREE.Points(g, m);
        pts.userData = { seed, ry, rx, rz };
        pts.frustumCulled = false;
        return pts;
    }

    _flame(parent, x, y, z, color, light = 0) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color }));
        f.position.set(x, y, z);
        parent.add(f);
        if (light) {
            const l = new THREE.PointLight(color, light, 7, 1.6);
            l.position.set(x, y + 0.2, z);
            l.userData.base = light; l.userData.phase = hash3(x * 10, y * 10, z * 10) * 6;
            parent.add(l);
            this.lights.push(l);
            f.userData.light = l;
        }
        return f;
    }

    // ------------------------------------------------------------------ theme and board
    setTheme(name) {
        const t = THEMES[name] || THEMES.moon;
        if (this.theme === t) return;
        this.theme = t;
        this.scene.background.setHex(t.fog);
        this.scene.fog.color.setHex(t.fog);
        this.hemi.color.setHex(t.hemi[0]); this.hemi.groundColor.setHex(t.hemi[1]); this.hemi.intensity = t.hemi[2];
        this.dir.color.setHex(t.dir[0]); this.dir.intensity = t.dir[1];
        this.embers.material.color.setHex(t.ember);
        this.glass?.dispose();
        this.glass = glassTexture(t.glass);
        for (const m of this.glassMats || []) m.map = this.glass;
        for (const m of this.glassMats || []) m.needsUpdate = true;
        for (const f of this.flames || []) f.material.color.setHex(t.flame);
        for (const l of this.lights) l.color.setHex(t.flame);
    }

    clearBoard() {
        for (const g of [this.board, this.cathedral]) {
            while (g.children.length) {
                const c = g.children.pop();
                c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.userData.keep) o.material.dispose?.(); });
            }
        }
        this.lights = this.lights.filter((l) => !l.userData.board);
        this.flames = [];
        this.glassMats = [];
    }

    buildBoard(B, themeName) {
        this.clearBoard();
        this.B = B;
        this.setTheme(themeName);
        const { w, h } = B;
        const t = this.theme;
        const tileGeo = new THREE.BoxGeometry(0.97, 0.5, 0.97);
        const tileMat = new THREE.MeshStandardMaterial({ map: this.stone, roughness: 0.82, metalness: 0.1 });
        tileMat.userData.keep = false;
        const solid = (c) => c === '#' || c === '~';
        const cells = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!solid(B.tiles[y][x])) cells.push([x, y]);
        const tiles = new THREE.InstancedMesh(tileGeo, tileMat, cells.length);
        const m4 = new THREE.Matrix4(), col = new THREE.Color();
        cells.forEach(([x, y], i) => {
            const p = this.tilePos(x, y);
            m4.makeTranslation(p.x, -0.25, p.z);
            tiles.setMatrixAt(i, m4);
            const alt = B.tiles[y][x] === '+';
            const dark = (x + y) % 2 === 0;
            col.setHex(alt ? 0x9a90b4 : dark ? 0x6c6a84 : 0x4c4a62).multiplyScalar(0.88 + hash3(x, y, 4) * 0.24);
            tiles.setColorAt(i, col);
        });
        tiles.instanceMatrix.needsUpdate = true;
        tiles.instanceColor.needsUpdate = true;
        this.board.add(tiles);

        // plinth and the abyss showing through the chasm squares
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.7, h + 0.7), new THREE.MeshStandardMaterial({ map: this.stoneWide, color: 0x24222e, roughness: 0.9 }));
        plinth.position.y = -0.85;
        this.board.add(plinth);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.06, h + 0.8), new THREE.MeshStandardMaterial({ color: 0x7a6230, metalness: 0.8, roughness: 0.35 }));
        trim.position.y = -0.46;
        this.board.add(trim);
        const flameCss = '#' + new THREE.Color(t.flame).getHexString();
        this.abyssTex?.dispose();
        const abyssTex = this.abyssTex = canvasTex(128, 128, (g, w, h) => {
            const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, flameCss); gr.addColorStop(0.5, '#3a0c10'); gr.addColorStop(1, '#030205');
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
        });
        const abyssMat = new THREE.MeshBasicMaterial({ map: abyssTex, transparent: true, opacity: 1 });
        this.abyssMat = abyssMat;

        const wallMat = new THREE.MeshStandardMaterial({ map: this.stone, color: 0x7a7894, roughness: 0.9 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0x3c3a4e, roughness: 0.8 });
        const runeMat = new THREE.MeshBasicMaterial({ map: this.rune, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
        this.runeMat = runeMat;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const c = B.tiles[y][x], p = this.tilePos(x, y);
            if (c === '~') {
                const a = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), abyssMat);
                a.rotation.x = -Math.PI / 2; a.position.set(p.x, -0.48, p.z);
                this.board.add(a);
            } else if (c === '#') {
                const hh = 1.25 + hash3(x, y, 8) * 0.5;
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, hh, 0.8), wallMat);
                col.position.set(p.x, hh / 2, p.z);
                const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.95), capMat);
                foot.position.set(p.x, 0.1, p.z);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.55, 4), capMat);
                cap.position.set(p.x, hh + 0.27, p.z); cap.rotation.y = Math.PI / 4;
                const slit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: t.flame }));
                slit.position.set(p.x, hh * 0.6, p.z + 0.41);
                this.flames.push(slit);
                this.board.add(col, foot, cap, slit);
            } else if (c === '+') {
                const slab = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.78), new THREE.MeshStandardMaterial({ color: 0x77708a, roughness: 0.5, metalness: 0.3 }));
                slab.position.set(p.x, 0.04, p.z);
                const r = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), runeMat);
                r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.09, p.z);
                this.board.add(slab, r);
                for (const dx of [-0.3, 0.3]) {
                    const cand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xe9e0c8 }));
                    cand.position.set(p.x + dx, 0.18, p.z - 0.28);
                    this.board.add(cand);
                    this.flames.push(this._flame(this.board, p.x + dx, 0.36, p.z - 0.28, t.flame, 0));
                }
            }
        }
        // corner candelabra: the flames flicker and two of them light the room
        const corner = (sx, sz, light) => {
            const g = new THREE.Group();
            g.position.set(sx * (w / 2 + 0.55), 0, sz * (h / 2 + 0.55));
            g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a3426, metalness: 0.7, roughness: 0.4 })));
            g.children[0].position.y = 0.55 - 0.3;
            const f = this._flame(g, 0, 1.15, 0, t.flame, light);
            this.flames.push(f);
            if (f.userData.light) f.userData.light.userData.board = true;
            this.board.add(g);
        };
        corner(-1, -1, 40); corner(1, -1, 40); corner(-1, 1, 0); corner(1, 1, 0);
        // finials round the rim
        const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.34, 5), capMat, (w + h) * 4);
        let n = 0;
        const spike = (px, pz) => { m4.makeTranslation(px, 0.0, pz); spikes.setMatrixAt(n++, m4); };
        for (let i = 0; i <= w * 2; i++) { spike(-w / 2 + i / 2, -h / 2 - 0.42); spike(-w / 2 + i / 2, h / 2 + 0.42); }
        for (let i = 1; i < h * 2; i++) { spike(-w / 2 - 0.42, -h / 2 + i / 2); spike(w / 2 + 0.42, -h / 2 + i / 2); }
        spikes.count = n;
        this.board.add(spikes);

        this._buildCathedral(w, h);
        this.fit();
    }

    _buildCathedral(w, h) {
        const t = this.theme;
        const z = -h / 2 - 7;
        const glassMat = new THREE.MeshBasicMaterial({ map: this.glass, fog: true });
        this.glassMats.push(glassMat);
        const rose = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), glassMat);
        rose.position.set(0, 7, z);
        this.cathedral.add(rose);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: this.stoneWide, color: 0x1a1824, roughness: 1 }));
        wall.position.set(0, 10, z - 0.2);
        this.cathedral.add(wall);
        const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(t.glass[1]).multiplyScalar(0.55), side: THREE.DoubleSide });
        winMat.userData.window = true;
        for (let i = -3; i <= 3; i++) {
            if (Math.abs(i) < 2 && i !== 0) continue;
            const a = new THREE.Mesh(archGeo(1.3, 4.5 - Math.abs(i) * 0.2), winMat);
            a.position.set(i * 4.2, 0.5, z + 0.05);
            this.cathedral.add(a);
        }
        const pill = new THREE.MeshStandardMaterial({ map: this.stone, color: 0x2e2c3a, roughness: 0.9 });
        for (const sx of [-1, 1]) {
            for (const zz of [z + 1, -h / 2 - 3.5]) {
                const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 18, 1.4), pill);
                p.position.set(sx * (w / 2 + 4.5), 7, zz);
                this.cathedral.add(p);
            }
        }
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ map: this.stoneWide, color: 0x14121c, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.25, 0);
        this.cathedral.add(floor);
    }

    // ------------------------------------------------------------------ the arena
    _buildArena() {
        const g = this.arena = new THREE.Group();
        g.position.copy(ARENA);
        this.scene.add(g);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ map: this.stoneWide, color: 0x2a2838, roughness: 0.75, metalness: 0.15 }));
        floor.rotation.x = -Math.PI / 2;
        g.add(floor);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshStandardMaterial({ map: this.stoneWide, color: 0x1c1a26, roughness: 1 }));
        wall.position.set(0, 12, -10);
        g.add(wall);
        this.arenaGlassMat = new THREE.MeshBasicMaterial({ map: null, color: 0xffffff });
        const rose = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), this.arenaGlassMat);
        rose.position.set(0, 6.4, -9.8);
        g.add(rose);
        const pill = new THREE.MeshStandardMaterial({ map: this.stone, color: 0x2e2c3a, roughness: 0.9 });
        for (const sx of [-1, 1]) {
            for (const [dx, dz] of [[9, -8], [5.5, -9.4]]) {
                const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 1.6), pill);
                p.position.set(sx * dx, 8, dz);
                g.add(p);
            }
            const br = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x3a3426, metalness: 0.7, roughness: 0.4 }));
            br.position.set(sx * 6.5, 1.1, -3);
            g.add(br);
            const fl = this._flame(g, sx * 6.5, 1.6, -3, 0xffa040, 90);
            fl.scale.setScalar(3);
        }
        this.arenaEmbers = this._embers(60, 10, 8, 6);
        this.arenaEmbers.position.copy(ARENA);
        this.scene.add(this.arenaEmbers);
        this.arenaCam = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
    }

    /** Dress the arena for a duel: the window glows in the attacker's element. */
    arenaTheme(elementColor) {
        this.arenaGlassMat.map = this.glass;
        this.arenaGlassMat.color.setHex(elementColor).lerp(new THREE.Color(0xffffff), 0.35);
        this.arenaGlassMat.needsUpdate = true;
    }

    arenaPos(side) {
        const gap = this.w / this.h < 0.9 ? 1.9 : 2.7;
        return new THREE.Vector3(ARENA.x + (side === 'a' ? -gap : gap), 0, ARENA.z);
    }

    setArena(on) {
        this.arenaOn = on;
        if (!on) this.setArenaPad(0);
        this.resize(true);
    }

    /** The duel's HUD panels cover the top of the screen; frame the fighters in what is left. */
    setArenaPad(px) {
        this.arenaPadTop = px;
        const c = this.arenaCam;
        if (px > 0) c.setViewOffset(this.w, this.h, 0, -Math.round(px / 2), this.w, this.h); else c.clearViewOffset();
        c.updateProjectionMatrix();
    }

    // ------------------------------------------------------------------ camera
    /** Fit the whole board in the space left between the HUD bars, at any aspect: back the camera off
     *  until every corner (and the top of the tallest wall) projects inside the free band. */
    fit() {
        if (!this.B) return;
        const { w, h } = this.B;
        const cam = this.camera;
        const vw = this.w, vh = this.h;
        cam.aspect = vw / vh;
        this.pitch = THREE.MathUtils.degToRad(this.orbit ? 36 : 47);
        this.shiftDown = (this.pad.top - this.pad.bottom) / 2;
        this.shiftRight = (this.pad.left - this.pad.right) / 2;
        const lo = -1 + (2 * (this.pad.bottom + 6)) / vh, hi = 1 - (2 * (this.pad.top + 6)) / vh;
        const xlo = -1 + (2 * (this.pad.left + 6)) / vw, xhi = 1 - (2 * (this.pad.right + 6)) / vw;
        const pts = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.5, 1.7]) pts.push(new THREE.Vector3(sx * (w / 2 + 0.55), y, sz * (h / 2 + 0.55)));
        let d = 7;
        for (let i = 0; i < 90; i++) {
            this.dist = d;
            this._placeCamera(0);
            cam.setViewOffset(vw, vh, -this.shiftRight, -this.shiftDown, vw, vh);
            cam.updateProjectionMatrix();
            cam.updateMatrixWorld();
            const fits = pts.every((p) => { const q = p.clone().project(cam); return q.x >= xlo && q.x <= xhi && q.y >= lo && q.y <= hi; });
            if (fits) break;
            d *= 1.03;
        }
        cam.far = this.dist * 6;
        this.scene.fog.near = this.dist * 1.3;
        this.scene.fog.far = this.dist * 3.4;
        cam.updateProjectionMatrix();
    }

    _placeCamera(yaw) {
        const cam = this.camera, d = this.dist, p = this.pitch;
        const lookY = 0.3;
        cam.position.set(Math.sin(yaw) * Math.cos(p) * d, Math.sin(p) * d + lookY, Math.cos(yaw) * Math.cos(p) * d);
        cam.lookAt(0, lookY, 0);
    }

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (!force && w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.arenaCam.aspect = w / h;
        this.arenaCam.fov = w / h < 0.9 ? 52 : 36;
        this.arenaCam.updateProjectionMatrix();
        if (this.arenaPadTop) this.setArenaPad(this.arenaPadTop);
        this.fit();
    }

    setPad({ top = 56, bottom = 0, left = 0, right = 0 }) {
        const p = this.pad;
        if (top === p.top && bottom === p.bottom && left === p.left && right === p.right) return;
        this.pad = { top, bottom, left, right };
        this.fit();
    }

    // ------------------------------------------------------------------ picking
    /** Screen (client) px → board square, through the canvas's own rect. null if off the board. */
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(ndc, this.camera);
        const hit = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(this.floor, hit)) return null;
        const x = Math.floor(hit.x + this.B.w / 2), y = Math.floor(hit.z + this.B.h / 2);
        return x >= 0 && y >= 0 && x < this.B.w && y < this.B.h ? { x, y } : null;
    }

    /** World point → CSS px inside the canvas, for floating numbers. */
    project(v) {
        const cam = this.arenaOn ? this.arenaCam : this.camera;
        if (this.arenaOn) this._arenaCamera(0);
        cam.updateMatrixWorld();
        const p = v.clone().project(cam);
        return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
    }

    // ------------------------------------------------------------------ per frame
    update(dt, time) {
        const calm = this.calm;
        if (!calm) for (const l of this.lights) l.intensity = l.userData.base * (0.86 + Math.sin(time * 7 + l.userData.phase) * 0.08 + Math.sin(time * 13.3 + l.userData.phase * 2) * 0.06);
        for (const e of [this.embers, this.arenaEmbers]) {
            const pos = e.geometry.attributes.position, { seed, ry } = e.userData;
            for (let i = 0; i < seed.length; i++) {
                if (!calm) {
                    let y = pos.getY(i) + dt * (0.15 + seed[i] * 0.35);
                    if (y > ry) y = 0;
                    pos.setY(i, y);
                    pos.setX(i, pos.getX(i) + Math.sin(time * 0.7 + seed[i] * 20) * dt * 0.12);
                }
            }
            pos.needsUpdate = true;
        }
        if (this.runeMat) this.runeMat.opacity = calm ? 0.8 : 0.7 + Math.sin(time * 2) * 0.15;
        if (this.abyssMat) this.abyssMat.opacity = calm ? 0.9 : 0.8 + Math.sin(time * 1.3) * 0.1;
        this.shake = Math.max(0, this.shake - dt * 3);
        if (this.orbit && this.B && !this.arenaOn) { this._placeCamera(Math.sin(time * 0.12) * 0.55); }
    }

    /** Place the duel camera. `time` shakes it after a heavy blow; 0 holds it still. */
    _arenaCamera(time) {
        const c = this.arenaCam, s = this.calm || !time ? 0 : this.shake;
        c.position.set(ARENA.x + Math.sin(time * 90) * s * 0.18, 2.2 + Math.cos(time * 77) * s * 0.12, this.w / this.h < 0.9 ? 13.5 : 11);
        c.lookAt(ARENA.x, 1.5, 0);
    }

    render(time) {
        if (this.arenaOn) {
            this._arenaCamera(time);
            this.renderer.render(this.scene, this.arenaCam);
        } else this.renderer.render(this.scene, this.camera);
    }
}
