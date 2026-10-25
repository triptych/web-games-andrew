// The stage: renderer, painted sky, the board as a floating diorama (a brush-painted tile texture,
// terrain props batched by material, water and lava shaders, banners that show who owns each
// property), the camera (fit, pan, zoom), picking, the close-up battle arena, and the roost diorama.
// Reads a board B = { w, h, tiles, own }; knows nothing about units.
//
// Board tile (x, y) sits at world (x - w/2 + 0.5, top, y - h/2 + 0.5); row 0 is the far edge.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, toonOwn, ink, canvasTex, brushRand, dab, shade, css, ramp } from './paint.js';

export const THEMES = {
    meadow:   { sky: ['#5aa8f0', '#cfeaff'], sea: 0x3a9ad8, sun: 0xfff2d8, hemi: [0xd8ecff, 0x6a8a4a], grass: '#7cc84a', tree: ['#3a9a3a', '#5cbc44', '#2f7a34'], motes: 0xfff8b0, fog: 0xcfe4f4 },
    hills:    { sky: ['#e8a060', '#ffe0b0'], sea: 0x4a8ab8, sun: 0xffd8a0, hemi: [0xffe0c0, 0x7a6a4a], grass: '#a8b850', tree: ['#5a8a2a', '#8aa83a', '#4a6a24'], motes: 0xffd890, fog: 0xf0d0a8 },
    coast:    { sky: ['#3a8ae0', '#bfe8ff'], sea: 0x2a7ad0, sun: 0xffffff, hemi: [0xd0ecff, 0x6a8a6a], grass: '#8ac85a', tree: ['#3a8a4a', '#5aac54', '#2a6a3a'], motes: 0xffffff, fog: 0xc8e4f8 },
    forest:   { sky: ['#4a9a7a', '#d0f0c8'], sea: 0x3a8a8a, sun: 0xf8ffd8, hemi: [0xd8ffd8, 0x3a5a2a], grass: '#5aa83a', tree: ['#2a7a3a', '#3a9a3a', '#1f5a2a'], motes: 0xd8ff80, fog: 0xc0e0c0 },
    swamp:    { sky: ['#5a6a5a', '#b8c8a0'], sea: 0x4a6a4a, sun: 0xe0f0c0, hemi: [0xc0d8b0, 0x3a4a2a], grass: '#6a8a3a', tree: ['#4a6a2a', '#6a7a3a', '#3a4a24'], motes: 0xb8ff6a, fog: 0x98a888 },
    frost:    { sky: ['#7aa8e0', '#eef6ff'], sea: 0x6a9ad0, sun: 0xffffff, hemi: [0xeef6ff, 0x8a9ab0], grass: '#c8dce8', tree: ['#3a6a5a', '#4a7a6a', '#2a5a4a'], motes: 0xffffff, fog: 0xe0ecf8 },
    volcano:  { sky: ['#3a1a2a', '#e8603a'], sea: 0xff6a2a, sun: 0xffb080, hemi: [0xffa080, 0x3a2a2a], grass: '#6a5a4a', tree: ['#3a2a2a', '#4a3a30', '#2a1a1a'], motes: 0xff8a3a, fog: 0x8a4a3a },
    fortress: { sky: ['#4a6a98', '#d8e0f0'], sea: 0x2a5a90, sun: 0xfff0d8, hemi: [0xd8e0ff, 0x5a5a6a], grass: '#8ab85a', tree: ['#3a7a4a', '#4a9a4a', '#2a5a3a'], motes: 0xffffff, fog: 0xc8d0e0 },
    forge:    { sky: ['#2a1a1a', '#a84a2a'], sea: 0xff7a2a, sun: 0xffc090, hemi: [0xffb090, 0x2a2020], grass: '#5a504a', tree: ['#3a3030', '#4a3a3a', '#2a2020'], motes: 0xffa040, fog: 0x6a3a2a },
    throne:   { sky: ['#1a0a2a', '#7a2a6a'], sea: 0x8a3aff, sun: 0xe0b0ff, hemi: [0xd0a0ff, 0x2a1a3a], grass: '#5a4a6a', tree: ['#3a2a4a', '#4a3a5a', '#2a1a3a'], motes: 0xd080ff, fog: 0x4a2a5a },
    roost:    { sky: ['#ff9a6a', '#ffe8c0'], sea: 0x4a9ad8, sun: 0xffe0b0, hemi: [0xffe8d0, 0x6a7a4a], grass: '#7cc84a', tree: ['#3a9a3a', '#5cbc44', '#2f7a34'], motes: 0xfff0a0, fog: 0xffe0c0 },
};

const HEIGHT = {
    plains: 0.1, forest: 0.11, hills: 0.24, mount: 0.38, sea: -0.06, shoal: 0.0, road: 0.1, bridge: 0.13,
    swamp: 0.02, lava: 0.02, snow: 0.12, ruins: 0.12, crystal: 0.13, cliff: 0.5, village: 0.12, roost: 0.12, hq: 0.14,
};
export const tileTop = (id) => HEIGHT[id] ?? 0.1;

/** Ground colours per terrain, given the theme's grass. */
function groundColor(id, th) {
    switch (id) {
        case 'plains': return th.grass;
        case 'forest': return css(shade(th.grass, -0.08, 0, 0.01));
        case 'hills': return css(shade(th.grass, 0.04, -0.15, -0.03));
        case 'mount': return '#9a8a7a';
        case 'sea': return css(th.sea);
        case 'shoal': return css(shade(th.sea, 0.15, -0.1));
        case 'road': case 'village': case 'roost': case 'hq': return '#d8bc88';
        case 'bridge': return css(shade(th.sea, 0.1));
        case 'swamp': return '#4a5838';
        case 'lava': return '#ff6a1a';
        case 'snow': return '#f2f6ff';
        case 'ruins': return '#b8ac98';
        case 'crystal': return '#a8e8d8';
        case 'cliff': return '#7a6a64';
    }
    return th.grass;
}

// ------------------------------------------------------------------ batching
/** Collects transformed geometries per material and merges them into one mesh each (+ ink). */
class Batch {
    constructor() { this.groups = new Map(); }
    add(geo, mat, m, inkW = 0) {
        const key = mat.uuid + '|' + inkW;
        if (!this.groups.has(key)) this.groups.set(key, { mat, inkW, geos: [] });
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(m);
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        this.groups.get(key).geos.push(g);
    }
    build(parent) {
        for (const { mat, inkW, geos } of this.groups.values()) {
            if (!geos.length) continue;
            const merged = mergeGeometries(geos, false);
            const mesh = new THREE.Mesh(merged, mat);
            parent.add(mesh);
            if (inkW) { const o = new THREE.Mesh(merged, ink(inkW)); o.raycast = () => {}; parent.add(o); }
            geos.forEach((g) => g.dispose());
        }
        this.groups.clear();
    }
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
const mat4 = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)).clone();

const G_SPH = new THREE.SphereGeometry(1, 9, 7);
const G_CONE = new THREE.ConeGeometry(1, 1, 7);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_ROOF = (() => { const g = new THREE.CylinderGeometry(0, 0.75, 0.5, 4, 1); g.rotateY(Math.PI / 4); return g; })();
const G_OCTA = new THREE.OctahedronGeometry(1, 0);

// ------------------------------------------------------------------ shaders
function waterMaterial(color, lava = false) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { t: { value: 0 }, col: { value: new THREE.Color(color) }, lava: { value: lava ? 1 : 0 } },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float t; uniform vec3 col; uniform float lava; varying vec3 vW;
            void main(){
                float a = sin(vW.x*3.1 + t*1.3) * sin(vW.z*2.7 - t*1.1);
                float b = sin((vW.x+vW.z)*5.3 - t*2.0);
                float r = clamp(a*0.5+0.5, 0.0, 1.0);
                float sp = smoothstep(0.86, 1.0, clamp(b*0.5+0.5, 0.0, 1.0) * r);
                vec3 c = mix(col*0.8, col*1.15, r);
                if (lava > 0.5) { c = mix(vec3(0.9,0.2,0.02), vec3(1.0,0.85,0.25), clamp(r*r, 0.0, 1.0)); c += sp * vec3(1.0,0.9,0.5); gl_FragColor = vec4(c, 0.92); return; }
                c += sp * 0.6;
                gl_FragColor = vec4(c, 0.62 + sp*0.3);
            }`,
    });
}

function skyMaterial() {
    return new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
        vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bot; varying float vY; void main(){ float k = clamp(vY*1.4+0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, k*k), 1.0); }`,
    });
}

function cloudTexture(seed) {
    return canvasTex(256, 128, (g, w, h) => {
        const r = brushRand(seed);
        for (let i = 0; i < 14; i++) {
            const x = 40 + r() * 176, y = 60 + (r() - 0.5) * 30, rad = 20 + r() * 34;
            const gr = g.createRadialGradient(x, y, 0, x, y, rad);
            gr.addColorStop(0, 'rgba(255,255,255,0.95)');
            gr.addColorStop(0.6, 'rgba(255,255,255,0.75)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(160,170,200,0.25)';
        g.fillRect(0, 80, w, 48);
    });
}

function highlightTexture() {
    return canvasTex(64, 64, (g) => {
        g.fillStyle = 'rgba(255,255,255,0.42)'; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(3, 3, 58, 58);
    }, { srgb: false });
}

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
        this.calm = false;
        this.pad = { top: 60, bottom: 0, left: 0, right: 0 };
        this.zoom = 1; this.pan = new THREE.Vector2(0, 0);
        this.shake = 0;
        this.mode = 'board';           // board | arena | roost
        this.time = 0;

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.4);
        this.sun = new THREE.DirectionalLight(0xffffff, 2.3);
        this.sun.position.set(-5, 12, 7);
        this.scene.add(this.hemi, this.sun);

        this.sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), skyMaterial());
        this.scene.add(this.sky);
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
        for (let i = 0; i < 9; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(i + 3), transparent: true, depthWrite: false, fog: false }));
            const a = (i / 9) * Math.PI * 2;
            sp.position.set(Math.cos(a) * 60, 6 + (i % 3) * 5, Math.sin(a) * 60 - 10);
            sp.scale.set(36, 18, 1);
            sp.userData.a = a;
            this.clouds.add(sp);
        }
        this.seaMat = waterMaterial(0x3a9ad8);
        this.sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.seaMat);
        this.sea.rotation.x = -Math.PI / 2;
        this.sea.position.y = -1.6;
        this.scene.add(this.sea);

        this.board = new THREE.Group();
        this.scene.add(this.board);
        this.hlTex = highlightTexture();
        this.motes = this._motes();
        this.scene.add(this.motes);
        this.flags = new Map();
        this.B = null;
        this.theme = THEMES.meadow;

        this.arena = new THREE.Group();
        this.arena.position.set(600, 0, 0);
        this.arena.visible = false;
        this.scene.add(this.arena);
        this.arenaCam = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

        this.roost = new THREE.Group();
        this.roost.position.set(-600, 0, 0);
        this.roost.visible = false;
        this.scene.add(this.roost);
        this.roostCam = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

        this.ray = new THREE.Raycaster();
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    setTheme(name) {
        const th = THEMES[name] || THEMES.meadow;
        this.theme = th; this.themeName = name;
        this.sky.material.uniforms.top.value.set(th.sky[0]);
        this.sky.material.uniforms.bot.value.set(th.sky[1]);
        this.hemi.color.set(th.hemi[0]); this.hemi.groundColor.set(th.hemi[1]);
        this.sun.color.set(th.sun);
        this.scene.fog = new THREE.Fog(th.fog, 40, 160);
        this.seaMat.uniforms.col.value.set(th.sea);
        this.seaMat.uniforms.lava.value = name === 'volcano' || name === 'forge' ? 1 : 0;
        this.motes.material.color.set(th.motes);
        const dark = name === 'throne' || name === 'volcano' || name === 'forge';
        this.motes.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        for (const c of this.clouds.children) c.material.color.set(dark ? 0x8a6a8a : name === 'swamp' ? 0xc0c8b0 : 0xffffff);
    }

    _motes() {
        const n = 140;
        const g = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 20; p[i * 3 + 1] = Math.random() * 5; p[i * 3 + 2] = (Math.random() - 0.5) * 16; }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false });
        const pts = new THREE.Points(g, m);
        pts.frustumCulled = false;
        return pts;
    }

    // ------------------------------------------------------------------ the board
    tilePos(x, y) {
        const B = this.B;
        if (!B) return new THREE.Vector3();
        return new THREE.Vector3(x - B.w / 2 + 0.5, tileTop(B.tiles[y * B.w + x]), y - B.h / 2 + 0.5);
    }

    clearGroup(g) {
        for (const c of [...g.children]) {
            g.remove(c);
            c.traverse((o) => { if (o.geometry && o.geometry !== G_SPH && o.geometry !== G_CONE && o.geometry !== G_CYL && o.geometry !== G_BOX) o.geometry.dispose?.(); if (o.material?.map && o.material.map !== this.hlTex) o.material.map.dispose?.(); });
        }
    }

    buildBoard(B, themeName) {
        this.B = B;
        this.setTheme(themeName);
        this.clearGroup(this.board);
        this.flags.clear();
        const th = this.theme;
        const { w, h, tiles } = B;
        const PX = 64;
        // 1. the painted ground: one canvas for the whole board
        const r = brushRand(w * 131 + h * 7 + tiles.length);
        const tex = canvasTex(w * PX, h * PX, (g) => {
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const id = tiles[y * w + x];
                const base = groundColor(id, th);
                g.fillStyle = css(shade(base, (r() - 0.5) * 0.04));
                g.fillRect(x * PX, y * PX, PX, PX);
            }
            // brushwork: dabs of lighter and darker paint, with a little of each neighbour bleeding in
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const id = tiles[y * w + x];
                const base = groundColor(id, th);
                const water = id === 'sea' || id === 'shoal' || id === 'swamp' || id === 'lava';
                const n = water ? 10 : 26;
                for (let i = 0; i < n; i++) {
                    const cx = x * PX + r() * PX, cy = y * PX + r() * PX;
                    const c = shade(base, (r() - 0.45) * 0.16, (r() - 0.5) * 0.1, (r() - 0.5) * 0.02);
                    dab(g, cx, cy, water ? 12 + r() * 10 : 5 + r() * 7, water ? 2 : 2 + r() * 2.5, water ? 0.1 : r() * Math.PI, css(c), water ? 0.35 : 0.45);
                }
                for (const [dx, dy] of [[1, 0], [0, 1]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= w || ny >= h) continue;
                    const nid = tiles[ny * w + nx];
                    if (nid === id) continue;
                    const nc = groundColor(nid, th);
                    for (let i = 0; i < 6; i++) {
                        const ex = dx ? (x + 1) * PX + (r() - 0.5) * 12 : x * PX + r() * PX;
                        const ey = dy ? (y + 1) * PX + (r() - 0.5) * 12 : y * PX + r() * PX;
                        dab(g, ex, ey, 6 + r() * 6, 3, dx ? Math.PI / 2 : 0, r() < 0.5 ? base : nc, 0.35);
                    }
                }
                if (id === 'plains' || id === 'hills') for (let i = 0; i < 5; i++) { g.fillStyle = r() < 0.5 ? '#fff6c8' : '#ff9ac8'; g.globalAlpha = 0.8; g.beginPath(); g.arc(x * PX + r() * PX, y * PX + r() * PX, 1.6, 0, 7); g.fill(); g.globalAlpha = 1; }
                if (id === 'snow') for (let i = 0; i < 8; i++) dab(g, x * PX + r() * PX, y * PX + r() * PX, 8, 3, r() * 3, '#ffffff', 0.6);
            }
            // roads: thick sandy strokes joining neighbouring road-like tiles
            const roadish = (id) => id === 'road' || id === 'bridge' || id === 'village' || id === 'roost' || id === 'hq';
            g.lineCap = 'round';
            // the dark verge first, then the sandy middle over all of it, so joins stay clean
            for (const [lw, col] of [[28, '#a88a5a'], [20, '#e8d0a0']]) {
                g.strokeStyle = col; g.lineWidth = lw; g.fillStyle = col;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    if (!roadish(tiles[y * w + x])) continue;
                    let links = 0;
                    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !roadish(tiles[ny * w + nx])) continue;
                        links++;
                        g.beginPath(); g.moveTo((x + 0.5) * PX, (y + 0.5) * PX); g.lineTo((x + 0.5 + dx * 0.5) * PX, (y + 0.5 + dy * 0.5) * PX); g.stroke();
                    }
                    if (links || tiles[y * w + x] === 'road') { g.beginPath(); g.arc((x + 0.5) * PX, (y + 0.5) * PX, lw / 2, 0, 7); g.fill(); }
                }
            }
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (roadish(tiles[y * w + x])) for (let i = 0; i < 6; i++) dab(g, (x + 0.3 + r() * 0.4) * PX, (y + 0.3 + r() * 0.4) * PX, 4, 2, r() * 3, '#c8a870', 0.5);
            // a soft grid so the tiles read
            g.strokeStyle = 'rgba(30,30,20,0.16)'; g.lineWidth = 2;
            for (let x = 0; x <= w; x++) { g.beginPath(); g.moveTo(x * PX, 0); g.lineTo(x * PX, h * PX); g.stroke(); }
            for (let y = 0; y <= h; y++) { g.beginPath(); g.moveTo(0, y * PX); g.lineTo(w * PX, y * PX); g.stroke(); }
        });
        tex.colorSpace = THREE.SRGBColorSpace;

        // 2. tile tops and the earth below them
        const pos = [], uv = [], idx = [];
        const spos = [], sidx = [], scol = [];
        const top = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -0.45 : tileTop(tiles[y * w + x]));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const t = top(x, y), x0 = x - w / 2, z0 = y - h / 2;
            const b = pos.length / 3;
            pos.push(x0, t, z0, x0 + 1, t, z0, x0 + 1, t, z0 + 1, x0, t, z0 + 1);
            uv.push(x / w, 1 - y / h, (x + 1) / w, 1 - y / h, (x + 1) / w, 1 - (y + 1) / h, x / w, 1 - (y + 1) / h);
            idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
            // skirts down to whichever neighbour is lower
            const sides = [[0, -1, [x0, z0], [x0 + 1, z0]], [1, 0, [x0 + 1, z0], [x0 + 1, z0 + 1]], [0, 1, [x0 + 1, z0 + 1], [x0, z0 + 1]], [-1, 0, [x0, z0 + 1], [x0, z0]]];
            for (const [dx, dy, a, c] of sides) {
                const nt = top(x + dx, y + dy);
                if (nt >= t) continue;
                const s = spos.length / 3;
                const bot = x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h ? -0.45 : nt;
                spos.push(a[0], t, a[1], c[0], t, c[1], c[0], bot, c[1], a[0], bot, a[1]);
                const id = tiles[y * w + x];
                const col = new THREE.Color(id === 'snow' ? '#c8d0e0' : id === 'mount' || id === 'cliff' ? '#6a5a50' : id === 'sea' || id === 'shoal' ? '#5a4a3a' : '#8a6a44');
                for (let k = 0; k < 4; k++) { const f = k < 2 ? 1 : 0.6; scol.push(col.r * f, col.g * f, col.b * f); }
                sidx.push(s, s + 1, s + 2, s, s + 2, s + 3);
            }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        tg.setIndex(idx);
        tg.computeVertexNormals();
        this.tops = new THREE.Mesh(tg, new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp() }));
        this.board.add(this.tops);
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3));
        sg.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3));
        sg.setIndex(sidx);
        sg.computeVertexNormals();
        this.board.add(new THREE.Mesh(sg, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp(), side: THREE.DoubleSide })));
        // the island the board sits on
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 8, 2), toon(themeName === 'frost' ? 0x8a9ab0 : themeName === 'volcano' || themeName === 'forge' || themeName === 'throne' ? 0x3a2a30 : 0x7a5a3a));
        isl.scale.set(Math.hypot(w, h) * 0.56, 2.4, Math.hypot(w, h) * 0.5);
        isl.position.y = -1.7;
        isl.rotation.y = Math.PI / 8;
        this.board.add(isl);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, h + 0.6), toon(0x6a4a30));
        rim.position.y = -0.7;
        this.board.add(rim);

        // 3. water and lava surfaces
        const water = [], lava = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const id = tiles[y * w + x];
            if (id === 'sea' || id === 'shoal' || id === 'swamp' || id === 'bridge') water.push([x, y, id]);
            if (id === 'lava') lava.push([x, y]);
        }
        const quads = (list, yv) => {
            const p = [];
            for (const [x, y] of list) { const x0 = x - w / 2, z0 = y - h / 2; p.push(x0, yv, z0, x0 + 1, yv, z0 + 1, x0 + 1, yv, z0, x0, yv, z0, x0, yv, z0 + 1, x0 + 1, yv, z0 + 1); }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
            return g;
        };
        this.waterMats = [];
        if (water.length) {
            const m = waterMaterial(themeName === 'swamp' ? 0x5a7a4a : th.sea);
            this.waterMats.push(m);
            this.board.add(new THREE.Mesh(quads(water.filter((q) => q[2] !== 'swamp'), 0.04), m));
            const sw = water.filter((q) => q[2] === 'swamp');
            if (sw.length) { const m2 = waterMaterial(0x4a6a58); this.waterMats.push(m2); this.board.add(new THREE.Mesh(quads(sw, 0.05), m2)); }
        }
        if (lava.length) { const m = waterMaterial(0xff5a1a, true); this.waterMats.push(m); this.board.add(new THREE.Mesh(quads(lava, 0.05), m)); }

        // 4. props, batched by material
        this._props(B, themeName);
        // 5. highlights and the path, on top
        this.hlGroup = new THREE.Group();
        this.board.add(this.hlGroup);
        this.hl = [];
        this.pathGroup = new THREE.Group();
        this.board.add(this.pathGroup);
        this.cursor = new THREE.Mesh(new THREE.RingGeometry(0.43, 0.5, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xfff4a0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
        this.cursor.rotation.x = -Math.PI / 2;
        this.cursor.scale.setScalar(1.4);
        this.cursor.visible = false;
        this.board.add(this.cursor);
        for (let i = 0; i < B.tiles.length; i++) if (this.flags.has(i)) this.setOwner(i, B.own[i]);
        this.pan.set(0, 0); this.zoom = 1;
        this.fit();
    }

    _props(B, themeName) {
        const th = this.theme;
        const { w, h, tiles } = B;
        const r = brushRand(w * 977 + h * 31);
        const bt = new Batch();
        const trunk = toon(themeName === 'volcano' || themeName === 'forge' ? 0x2a1a1a : 0x7a4a2a);
        const leaves = th.tree.map((c) => toon(c));
        const rock = toon(themeName === 'frost' ? 0x8a94a8 : themeName === 'volcano' || themeName === 'forge' || themeName === 'throne' ? 0x3a3038 : 0x8a7a6a);
        const rock2 = toon(themeName === 'frost' ? 0xa8b4c8 : 0xa89a8a);
        const snow = toon(0xffffff);
        const wall = toon(0xf0e6d0), wood = toon(0x9a6a3a), roofs = [toon(0xd84a3a), toon(0x3a7ad8), toon(0xe8a030), toon(0x5aa84a)];
        const stone = toon(0xc8bca8), stoneD = toon(0x9a8e7a);
        const crystal = toon(0x7af0e0, { emissive: 0x3ad8c8, ei: 0.7 });
        const reed = toon(0x8a9a4a), lily = toon(0x4a9a3a), pink = toon(0xff9ad8);
        const rubble = toon(0x2a2228);
        const pine = themeName === 'frost' || themeName === 'hills';
        const dead = themeName === 'volcano' || themeName === 'forge' || themeName === 'throne';
        const corners = [[-0.28, -0.28], [0.28, -0.26], [-0.26, 0.28], [0.3, 0.3], [0, -0.33], [-0.34, 0.02], [0.33, 0.02]];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const id = tiles[y * w + x];
            const cx = x - w / 2 + 0.5, cz = y - h / 2 + 0.5, t = tileTop(id);
            const tree = (px, pz, s) => {
                if (dead) { bt.add(G_CYL, trunk, mat4(px, t + 0.18 * s, pz, 0.03 * s, 0.36 * s, 0.03 * s, 0, 0, (r() - 0.5) * 0.4), 0.012); bt.add(G_CYL, trunk, mat4(px + 0.05, t + 0.28 * s, pz, 0.015, 0.16 * s, 0.015, 0, 0, -0.8), 0.008); return; }
                bt.add(G_CYL, trunk, mat4(px, t + 0.08 * s, pz, 0.035 * s, 0.16 * s, 0.035 * s), 0.01);
                const lf = leaves[Math.floor(r() * leaves.length)];
                if (pine) {
                    for (let k = 0; k < 3; k++) bt.add(G_CONE, lf, mat4(px, t + (0.2 + k * 0.11) * s, pz, (0.17 - k * 0.04) * s, 0.2 * s, (0.17 - k * 0.04) * s), 0.014);
                    if (themeName === 'frost') bt.add(G_CONE, snow, mat4(px, t + 0.47 * s, pz, 0.06 * s, 0.08 * s, 0.06 * s), 0.008);
                } else {
                    bt.add(G_SPH, lf, mat4(px, t + 0.26 * s, pz, 0.17 * s, 0.15 * s, 0.17 * s), 0.016);
                    bt.add(G_SPH, lf, mat4(px + 0.06 * s, t + 0.36 * s, pz - 0.03 * s, 0.11 * s), 0.014);
                }
            };
            switch (id) {
                case 'forest': { const n = 4 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const c = corners[i]; tree(cx + c[0] + (r() - 0.5) * 0.08, cz + c[1] + (r() - 0.5) * 0.08, 0.8 + r() * 0.5); } break; }
                case 'hills': for (const c of [[-0.22, -0.2], [0.25, 0.18]]) bt.add(G_SPH, leaves[1], mat4(cx + c[0], t, cz + c[1], 0.24, 0.12, 0.2), 0.012); if (r() < 0.5) tree(cx + 0.28, cz - 0.28, 0.6); break;
                case 'mount': {
                    for (const [px, pz, s] of [[-0.24, -0.22, 0.85], [0.26, -0.18, 0.7], [0.0, -0.36, 1.05], [-0.3, 0.24, 0.5]]) {
                        bt.add(G_CONE, rock, mat4(cx + px, t + 0.25 * s, cz + pz, 0.22 * s, 0.5 * s, 0.22 * s, 0, r() * 3), 0.016);
                        bt.add(G_CONE, themeName === 'volcano' || themeName === 'forge' ? rock2 : snow, mat4(cx + px, t + 0.42 * s, cz + pz, 0.09 * s, 0.17 * s, 0.09 * s, 0, r() * 3), 0.01);
                    }
                    break;
                }
                case 'cliff': for (const [px, pz, s] of [[-0.25, -0.25, 1], [0.25, -0.2, 0.8], [0.2, 0.25, 0.9], [-0.22, 0.22, 0.7]]) bt.add(G_BOX, rock, mat4(cx + px, t + 0.18 * s, cz + pz, 0.3 * s, 0.4 * s, 0.3 * s, 0, r(), (r() - 0.5) * 0.2), 0.016); break;
                case 'village': {
                    for (const [px, pz, s] of [[-0.2, -0.18, 1], [0.24, 0.12, 0.8]]) {
                        bt.add(G_BOX, wall, mat4(cx + px, t + 0.1 * s, cz + pz, 0.26 * s, 0.2 * s, 0.22 * s), 0.012);
                        bt.add(G_ROOF, roofs[Math.floor(r() * roofs.length)], mat4(cx + px, t + 0.32 * s, cz + pz, 0.3 * s, 0.4 * s, 0.26 * s), 0.012);
                        bt.add(G_BOX, wood, mat4(cx + px, t + 0.05 * s, cz + pz + 0.112 * s, 0.06 * s, 0.1 * s, 0.01), 0);
                    }
                    this._flag(B, x, y, cx - 0.32, t, cz + 0.3, 0.55);
                    break;
                }
                case 'roost': {
                    bt.add(G_CYL, stone, mat4(cx, t + 0.24, cz - 0.08, 0.2, 0.48, 0.2), 0.016);
                    bt.add(G_CONE, roofs[1], mat4(cx, t + 0.6, cz - 0.08, 0.26, 0.26, 0.26), 0.014);
                    const ring = new THREE.TorusGeometry(0.17, 0.05, 6, 12); ring.rotateX(Math.PI / 2);
                    bt.add(ring, wood, mat4(cx + 0.2, t + 0.04, cz + 0.22, 1), 0.01);
                    bt.add(G_SPH, toon(0xfff0d0), mat4(cx + 0.2, t + 0.08, cz + 0.22, 0.06, 0.08, 0.06), 0.008);
                    this._flag(B, x, y, cx - 0.3, t, cz + 0.28, 0.75);
                    break;
                }
                case 'hq': {
                    bt.add(G_BOX, stone, mat4(cx, t + 0.18, cz - 0.05, 0.5, 0.36, 0.42), 0.016);
                    for (const [px, pz] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.2], [0.3, 0.2]]) {
                        bt.add(G_CYL, stoneD, mat4(cx + px, t + 0.27, cz + pz, 0.1, 0.54, 0.1), 0.014);
                        bt.add(G_CONE, roofs[0], mat4(cx + px, t + 0.62, cz + pz, 0.13, 0.18, 0.13), 0.012);
                    }
                    bt.add(G_BOX, toon(0x5a3a2a), mat4(cx, t + 0.08, cz + 0.17, 0.14, 0.16, 0.02), 0);
                    this._flag(B, x, y, cx, t + 0.36, cz - 0.05, 0.6);
                    break;
                }
                case 'ruins': for (const [px, pz, s] of [[-0.25, -0.2, 1], [0.22, -0.25, 0.6], [0.2, 0.22, 0.85]]) bt.add(G_CYL, stone, mat4(cx + px, t + 0.17 * s, cz + pz, 0.07, 0.34 * s, 0.07, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2), 0.012); bt.add(G_BOX, stoneD, mat4(cx - 0.1, t + 0.03, cz + 0.25, 0.3, 0.06, 0.12, 0, 0.4), 0.01); break;
                case 'crystal': for (const [px, pz, s] of [[-0.28, -0.25, 1], [0.27, -0.22, 0.8], [0.26, 0.26, 0.9], [-0.25, 0.26, 0.7]]) bt.add(G_OCTA, crystal, mat4(cx + px, t + 0.14 * s, cz + pz, 0.07 * s, 0.18 * s, 0.07 * s, (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4), 0.01); break;
                case 'swamp': for (let i = 0; i < 4; i++) { const px = cx + (r() - 0.5) * 0.8, pz = cz + (r() - 0.5) * 0.8; if (r() < 0.5) bt.add(G_CONE, reed, mat4(px, t + 0.12, pz, 0.02, 0.26, 0.02, (r() - 0.5) * 0.3), 0.006); else { bt.add(G_CYL, lily, mat4(px, t + 0.05, pz, 0.08, 0.01, 0.08), 0); if (r() < 0.4) bt.add(G_SPH, pink, mat4(px, t + 0.07, pz, 0.025), 0); } } break;
                case 'bridge': {
                    const horiz = (x > 0 && ['road', 'bridge', 'village'].includes(tiles[y * w + x - 1])) || (x < w - 1 && ['road', 'bridge', 'village'].includes(tiles[y * w + x + 1]));
                    for (let i = -2; i <= 2; i++) bt.add(G_BOX, wood, horiz ? mat4(cx + i * 0.19, 0.11, cz, 0.16, 0.04, 0.78) : mat4(cx, 0.11, cz + i * 0.19, 0.78, 0.04, 0.16), 0.008);
                    for (const s of [-1, 1]) bt.add(G_BOX, toon(0x6a4a2a), horiz ? mat4(cx, 0.2, cz + s * 0.38, 1, 0.04, 0.04) : mat4(cx + s * 0.38, 0.2, cz, 0.04, 0.04, 1), 0.006);
                    break;
                }
                case 'lava': if (r() < 0.5) bt.add(G_SPH, rubble, mat4(cx + (r() - 0.5) * 0.5, 0.06, cz + (r() - 0.5) * 0.5, 0.1, 0.06, 0.09), 0.01); break;
                case 'snow': if (r() < 0.5) bt.add(G_SPH, snow, mat4(cx + (r() - 0.5) * 0.6, t, cz + (r() - 0.5) * 0.6, 0.14, 0.06, 0.12), 0.008); break;
                case 'plains': if (r() < 0.12) tree(cx + (r() < 0.5 ? -0.34 : 0.34), cz + (r() < 0.5 ? -0.34 : 0.34), 0.55); else if (r() < 0.2) bt.add(G_SPH, rock2, mat4(cx + (r() - 0.5) * 0.7, t, cz + (r() - 0.5) * 0.7, 0.06, 0.04, 0.05), 0.008); break;
                case 'sea': if (r() < 0.06) bt.add(G_SPH, rock, mat4(cx + (r() - 0.5) * 0.4, -0.02, cz + (r() - 0.5) * 0.4, 0.14, 0.1, 0.12), 0.012); break;
            }
        }
        bt.build(this.board);
    }

    _flag(B, x, y, px, py, pz, hgt) {
        const g = new THREE.Group();
        g.position.set(px, py, pz);
        const pole = new THREE.Mesh(G_CYL, toon(0x6a4a2a));
        pole.scale.set(0.012, hgt, 0.012);
        pole.position.y = hgt / 2;
        g.add(pole);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14, 4, 1), toonOwn(0xd8d0c0, { side: THREE.DoubleSide }));
        cloth.position.set(0.11, hgt - 0.08, 0);
        g.add(cloth);
        g.userData.cloth = cloth;
        this.board.add(g);
        this.flags.set(y * B.w + x, g);
    }

    setOwner(i, team) {
        const f = this.flags.get(i);
        if (!f) return;
        f.userData.cloth.material.color.set(team === 'p' ? 0x3a8cff : team === 'e' ? 0xe8423a : 0xe0d8c8);
    }

    // ------------------------------------------------------------------ highlights
    setHighlights(list) {
        if (!this.hlGroup) return;
        const B = this.B;
        for (const hm of this.hl) hm.visible = false;
        list.forEach((it, i) => {
            let hm = this.hl[i];
            if (!hm) {
                hm = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ map: this.hlTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
                hm.rotation.x = -Math.PI / 2;
                hm.renderOrder = 5;
                this.hlGroup.add(hm);
                this.hl[i] = hm;
            }
            const p = this.tilePos(it.x, it.y);
            hm.position.set(p.x, Math.max(p.y, 0.05) + 0.02, p.z);
            hm.material.color.setHex(it.color);
            hm.userData.op = it.op ?? 0.85;
            hm.visible = true;
        });
        void B;
    }

    setPath(path) {
        this.clearGroup(this.pathGroup);
        if (!path || path.length < 2) return;
        const mat = new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, opacity: 0.95, depthWrite: false });
        for (let i = 1; i < path.length; i++) {
            const a = this.tilePos(path[i - 1][0], path[i - 1][1]), b = this.tilePos(path[i][0], path[i][1]);
            const seg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 1.0), mat);
            seg.position.set((a.x + b.x) / 2, Math.max(a.y, b.y, 0.06) + 0.05, (a.z + b.z) / 2);
            seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            seg.renderOrder = 6;
            this.pathGroup.add(seg);
        }
        const end = path[path.length - 1], prev = path[path.length - 2];
        const e = this.tilePos(end[0], end[1]), p = this.tilePos(prev[0], prev[1]);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), mat);
        head.rotation.x = Math.PI / 2;
        const holder = new THREE.Group();
        holder.add(head);
        holder.position.set(e.x, Math.max(e.y, 0.06) + 0.06, e.z);
        holder.rotation.y = Math.atan2(e.x - p.x, e.z - p.z);
        holder.renderOrder = 6;
        this.pathGroup.add(holder);
    }

    setCursor(pos) {
        if (!this.cursor) return;
        this.cursor.visible = !!pos;
        if (pos) { const p = this.tilePos(pos.x, pos.y); this.cursor.position.set(p.x, Math.max(p.y, 0.05) + 0.03, p.z); }
    }

    // ------------------------------------------------------------------ camera
    setPad(p) { this.pad = { top: 60, bottom: 0, left: 0, right: 0, ...p }; this.fit(); }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        for (const c of [this.camera, this.arenaCam, this.roostCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
        this.arenaCam.fov = w / h < 0.8 ? 50 : 34;
        this.arenaCam.updateProjectionMatrix();
        this.fit();
    }

    /** The camera distance at which the whole board fits in the padded rectangle. */
    fit() {
        const B = this.B;
        if (!B || !this.w) return;
        const cam = this.camera;
        const W = this.w, H = this.h, P = this.pad;
        const rw = Math.max(80, W - P.left - P.right), rh = Math.max(80, H - P.top - P.bottom);
        cam.clearViewOffset();
        cam.aspect = W / H;
        cam.updateProjectionMatrix();
        this.pitch = rw / rh < 0.8 ? 1.05 : 0.92;
        const pts = [];
        for (const [x, z] of [[-B.w / 2, -B.h / 2], [B.w / 2, -B.h / 2], [-B.w / 2, B.h / 2], [B.w / 2, B.h / 2]]) { pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.6, z)); }
        const ex = rw / W, ey = rh / H;
        let d = 6;
        for (let i = 0; i < 80; i++) {
            this._place(cam, d, new THREE.Vector3(0, 0, 0));
            cam.updateMatrixWorld();
            const ok = pts.every((p) => { const q = p.clone().project(cam); return Math.abs(q.x) <= ex && Math.abs(q.y) <= ey; });
            if (ok) break;
            d *= 1.05;
        }
        this.fitD = d;
        // shift the frame so the board is centred in the padded rectangle
        cam.setViewOffset(W, H, -(P.left - P.right) / 2, -(P.top - P.bottom) / 2, W, H);
        this._applyCam();
    }

    _place(cam, d, target) {
        cam.position.set(target.x, target.y + Math.sin(this.pitch) * d, target.z + Math.cos(this.pitch) * d);
        cam.lookAt(target);
    }

    _applyCam(shake = 0) {
        if (!this.B) return;
        const lim = { x: this.B.w / 2, z: this.B.h / 2 };
        this.pan.x = Math.max(-lim.x, Math.min(lim.x, this.pan.x));
        this.pan.y = Math.max(-lim.z, Math.min(lim.z, this.pan.y));
        const d = this.fitD / this.zoom;
        const t = new THREE.Vector3(this.pan.x + (shake ? (Math.random() - 0.5) * shake * 0.06 : 0), 0, this.pan.y + (shake ? (Math.random() - 0.5) * shake * 0.06 : 0));
        this._place(this.camera, d, t);
        this.camera.updateMatrixWorld();
    }

    /** Drag the view by screen pixels. */
    panBy(dx, dy) {
        if (!this.B) return;
        const k = (this.fitD / this.zoom) * 0.0016 * (900 / Math.max(this.h, 400));
        this.pan.x -= dx * k;
        this.pan.y -= dy * k / Math.sin(this.pitch);
        this._applyCam();
    }
    zoomBy(f) {
        this.zoom = Math.max(1, Math.min(3, this.zoom * f));
        if (this.zoom <= 1.001) this.pan.set(0, 0);
        this._applyCam();
    }
    /** Ease the view so a tile is on screen (only when zoomed in). */
    focus(x, y) {
        if (this.zoom <= 1.01 || !this.B) return;
        const p = this.tilePos(x, y);
        this.focusTo = new THREE.Vector2(p.x, p.z);
    }

    pick(clientX, clientY) {
        if (!this.B || this.mode !== 'board') return null;
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.ray.setFromCamera(ndc, this.camera);
        const hit = this.ray.intersectObject(this.tops, false)[0];
        let p = hit?.point;
        if (!p) {
            const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
            p = new THREE.Vector3();
            if (!this.ray.ray.intersectPlane(pl, p)) return null;
        }
        const x = Math.floor(p.x + this.B.w / 2), y = Math.floor(p.z + this.B.h / 2);
        if (x < 0 || y < 0 || x >= this.B.w || y >= this.B.h) return null;
        return { x, y };
    }

    /** World point → screen px. */
    project(v) {
        const cam = this.mode === 'arena' ? this.arenaCam : this.mode === 'roost' ? this.roostCam : this.camera;
        cam.updateMatrixWorld();
        const q = v.clone().project(cam);
        return { x: (q.x * 0.5 + 0.5) * this.w, y: (-q.y * 0.5 + 0.5) * this.h };
    }

    // ------------------------------------------------------------------ the arena (close-up battles)
    /**
     * Dress the arena for a fight: two terrain islands, a painted backdrop. Returns the two stand
     * points (left, right) in world space.
     */
    buildArena(themeName, leftTile, rightTile) {
        this.clearGroup(this.arena);
        const th = THEMES[themeName] || THEMES.meadow;
        const back = canvasTex(1024, 512, (g, w, h) => {
            const gr = g.createLinearGradient(0, 0, 0, h);
            gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.75, th.sky[1]); gr.addColorStop(1, th.sky[1]);
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
            const r = brushRand(themeName.length * 99);
            // painted clouds
            for (let i = 0; i < 18; i++) dab(g, r() * w, 40 + r() * 160, 40 + r() * 60, 12 + r() * 10, 0, 'rgba(255,255,255,0.9)', 0.35);
            // two ranges of hills, far and near
            for (const [base, col, amp] of [[330, shade(th.grass, 0.12, -0.25, 0.04), 60], [400, shade(th.grass, -0.05, -0.1), 40]]) {
                g.fillStyle = css(col);
                g.beginPath(); g.moveTo(0, h);
                for (let x = 0; x <= w; x += 16) g.lineTo(x, base - Math.sin(x * 0.008 + base) * amp - Math.sin(x * 0.021) * amp * 0.4);
                g.lineTo(w, h); g.fill();
            }
            for (let i = 0; i < 120; i++) dab(g, r() * w, 360 + r() * 150, 10 + r() * 10, 3, r() * 0.4, css(shade(th.grass, (r() - 0.5) * 0.2)), 0.4);
        });
        const bd = new THREE.Mesh(new THREE.PlaneGeometry(34, 17), new THREE.MeshBasicMaterial({ map: back, fog: false }));
        bd.position.set(0, 5.2, -9);
        this.arena.add(bd);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), toon(shade(th.grass, -0.06)));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -0.6, -2);
        this.arena.add(floor);
        const L = this._platform(themeName, leftTile, -2.2), R = this._platform(themeName, rightTile, 2.2);
        this.arena.add(L.g, R.g);
        this.arenaStand = [L.stand, R.stand];
        this.arenaTiles = [leftTile, rightTile];
        return this.arenaStand;
    }

    _platform(themeName, tile, x) {
        const th = THEMES[themeName] || THEMES.meadow;
        const g = new THREE.Group();
        g.position.set(x, 0, 0);
        const col = new THREE.Color(groundColor(tile, th)).getHex();
        const water = tile === 'sea' || tile === 'shoal' || tile === 'swamp' || tile === 'lava';
        const base = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.6, 0.6, 14), toon(water ? 0x6a5a4a : shade(col, -0.25)));
        base.position.y = -0.32;
        g.add(base);
        const topM = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.06, 14), water ? waterMaterial(new THREE.Color(groundColor(tile, th)).getHex(), tile === 'lava') : toon(col));
        if (water) this.waterMats.push(topM.material);
        topM.position.y = 0;
        g.add(topM);
        const bt = new Batch();
        const r = brushRand(tile.length * 13 + Math.round(x * 10));
        const ring = (n, f) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.3; f(Math.cos(a) * (1.3 + r() * 0.5), -0.6 - Math.abs(Math.sin(a)) * 0.8, r()); } };
        const leaves = th.tree.map((c) => toon(c));
        if (tile === 'forest') ring(6, (px, pz) => { bt.add(G_CYL, toon(0x7a4a2a), mat4(px, 0.3, pz, 0.08, 0.6, 0.08), 0.02); bt.add(G_SPH, leaves[Math.floor(r() * 3)], mat4(px, 0.85, pz, 0.45, 0.4, 0.45), 0.03); });
        if (tile === 'mount' || tile === 'cliff') ring(4, (px, pz, s) => bt.add(G_CONE, toon(0x8a7a6a), mat4(px, 0.6 + s * 0.3, pz - 0.4, 0.6, 1.4 + s, 0.6), 0.03));
        if (tile === 'hills') ring(3, (px, pz) => bt.add(G_SPH, leaves[1], mat4(px, 0, pz, 0.8, 0.4, 0.6), 0.02));
        if (tile === 'village' || tile === 'roost' || tile === 'hq') { bt.add(G_BOX, toon(0xf0e6d0), mat4(-0.9, 0.35, -1.2, 0.8, 0.7, 0.6), 0.02); bt.add(G_ROOF, toon(0xd84a3a), mat4(-0.9, 1.0, -1.2, 0.9, 0.8, 0.7), 0.02); }
        if (tile === 'crystal') ring(5, (px, pz) => bt.add(G_OCTA, toon(0x7af0e0, { emissive: 0x3ad8c8, ei: 0.7 }), mat4(px, 0.4, pz, 0.15, 0.4, 0.15), 0.02));
        if (tile === 'ruins') ring(3, (px, pz, s) => bt.add(G_CYL, toon(0xc8bca8), mat4(px, 0.5 * s + 0.2, pz, 0.16, 1 * s + 0.4, 0.16), 0.02));
        if (tile === 'plains' || tile === 'road') ring(5, (px, pz) => bt.add(G_SPH, leaves[1], mat4(px, 0.05, pz, 0.25, 0.12, 0.2), 0.015));
        if (tile === 'snow') ring(4, (px, pz) => bt.add(G_SPH, toon(0xffffff), mat4(px, 0.05, pz, 0.4, 0.15, 0.3), 0.015));
        bt.build(g);
        const stand = new THREE.Vector3(this.arena.position.x + x, water ? 0.05 : 0.03, 0.3);
        return { g, stand };
    }

    setMode(mode) {
        this.mode = mode;
        this.arena.visible = mode === 'arena';
        this.roost.visible = mode === 'roost';
        this.board.visible = mode === 'board';
        this.sea.visible = mode !== 'arena';
        this.clouds.visible = mode !== 'arena';
    }

    _arenaCamera() {
        const c = this.arenaCam;
        const s = this.calm ? 0 : this.shake;
        const portrait = this.w / this.h < 0.8;
        const ax = this.arena.position.x;
        c.position.set(ax + (Math.random() - 0.5) * s * 0.12, 2.0 + (Math.random() - 0.5) * s * 0.12, portrait ? 13.5 : 9.2);
        c.lookAt(ax, 1.0, 0);
        c.updateMatrixWorld();
    }

    // ------------------------------------------------------------------ the roost diorama
    buildRoost() {
        if (this.roostBuilt) return;
        this.roostBuilt = true;
        const g = this.roost;
        const th = THEMES.roost;
        const grass = canvasTex(512, 512, (cg, w, h) => {
            cg.fillStyle = th.grass; cg.fillRect(0, 0, w, h);
            const r = brushRand(5);
            for (let i = 0; i < 900; i++) dab(cg, r() * w, r() * h, 6 + r() * 8, 2 + r() * 2, r() * 3, css(shade(th.grass, (r() - 0.45) * 0.18)), 0.45);
            for (let i = 0; i < 160; i++) { cg.fillStyle = r() < 0.5 ? '#fff6c8' : '#ff9ac8'; cg.beginPath(); cg.arc(r() * w, r() * h, 2, 0, 7); cg.fill(); }
            cg.strokeStyle = '#e8d0a0'; cg.lineWidth = 40; cg.lineCap = 'round';
            cg.beginPath(); cg.moveTo(256, 512); cg.quadraticCurveTo(220, 330, 280, 220); cg.stroke();
        });
        const plateau = new THREE.Mesh(new THREE.CylinderGeometry(9, 7.5, 1.2, 28), [toon(0x8a6a44), new THREE.MeshToonMaterial({ map: grass, gradientMap: ramp() }), toon(0x8a6a44)]);
        plateau.position.y = -0.6;
        g.add(plateau);
        const under = new THREE.Mesh(new THREE.ConeGeometry(7.5, 6, 12), toon(0x7a5a3a));
        under.rotation.x = Math.PI; under.position.y = -4.2;
        g.add(under);
        const bt = new Batch();
        const r = brushRand(9);
        const leaves = th.tree.map((c) => toon(c));
        const tree = (x, z, s) => { bt.add(G_CYL, toon(0x7a4a2a), mat4(x, 0.4 * s, z, 0.1 * s, 0.8 * s, 0.1 * s), 0.02); bt.add(G_SPH, leaves[Math.floor(r() * 3)], mat4(x, 1.1 * s, z, 0.6 * s, 0.55 * s, 0.6 * s), 0.03); bt.add(G_SPH, leaves[Math.floor(r() * 3)], mat4(x + 0.25 * s, 1.5 * s, z, 0.38 * s), 0.025); };
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + r() * 0.2; if (Math.abs(a - Math.PI / 2) < 0.5) continue; tree(Math.cos(a) * (7.2 + r()), Math.sin(a) * (6.6 + r()), 0.8 + r() * 0.5); }
        // the roost tower and the keeper's house
        bt.add(G_CYL, toon(0xc8bca8), mat4(-3.6, 1.6, -3.4, 1.0, 3.2, 1.0), 0.04);
        bt.add(G_CONE, toon(0x3a7ad8), mat4(-3.6, 3.9, -3.4, 1.35, 1.5, 1.35), 0.04);
        for (let i = 0; i < 4; i++) bt.add(G_BOX, toon(0x5a3a2a), mat4(-3.6 + Math.cos(i * 1.57) * 1.0, 2.3, -3.4 + Math.sin(i * 1.57) * 1.0, 0.25, 0.45, 0.25, 0, -i * 1.57), 0);
        bt.add(G_BOX, toon(0xf0e6d0), mat4(3.4, 0.7, -3.8, 2.2, 1.4, 1.6), 0.04);
        bt.add(G_ROOF, toon(0xd84a3a), mat4(3.4, 1.9, -3.8, 2.5, 1.6, 1.9), 0.04);
        bt.add(G_BOX, toon(0x7a4a2a), mat4(3.4, 0.45, -2.99, 0.45, 0.9, 0.04), 0);
        // a pond
        const pond = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), waterMaterial(0x3a9ad8));
        pond.rotation.x = -Math.PI / 2; pond.position.set(4.4, 0.03, 2.2); pond.scale.set(1.3, 0.8, 1);
        g.add(pond);
        this.waterMats = this.waterMats || [];
        this.roostWater = pond.material;
        // fence posts round the edge
        for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.35) continue; bt.add(G_BOX, toon(0x9a6a3a), mat4(Math.cos(a) * 8.4, 0.25, Math.sin(a) * 8.4, 0.12, 0.5, 0.12, 0, -a), 0.012); }
        bt.build(g);
        // incubator hearths: a stone ring and a glow each, egg placed by the view
        this.hearths = [];
        for (let i = 0; i < 4; i++) {
            const h = new THREE.Group();
            h.position.set(-1.8 + i * 1.2, 0, 3.4 - Math.abs(i - 1.5) * 0.3);
            const ringG = new THREE.TorusGeometry(0.38, 0.12, 6, 12); ringG.rotateX(Math.PI / 2);
            const ringM = new THREE.Mesh(ringG, toon(0x9a8e7a));
            ringM.position.y = 0.1;
            h.add(ringM);
            const coal = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
            coal.rotation.x = -Math.PI / 2; coal.position.y = 0.08;
            h.add(coal);
            const light = new THREE.PointLight(0xff8a3a, 0, 2.5);
            light.position.y = 0.6;
            h.add(light);
            h.userData = { coal, light };
            g.add(h);
            this.hearths.push(h);
        }
        // training ring: a sandy circle with posts
        const sand = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), toon(0xe8d0a0));
        sand.rotation.x = -Math.PI / 2; sand.position.set(-4.4, 0.02, 1.2);
        g.add(sand);
        this.ringSpot = new THREE.Vector3(-4.4, 0, 1.2);
    }

    // ------------------------------------------------------------------ per frame
    update(dt, time) {
        this.time = time;
        for (const m of this.waterMats || []) m.uniforms.t.value = time;
        if (this.roostWater) this.roostWater.uniforms.t.value = time;
        this.seaMat.uniforms.t.value = time;
        for (const c of this.clouds.children) { c.userData.a += dt * 0.004; c.position.x = Math.cos(c.userData.a) * 60; c.position.z = Math.sin(c.userData.a) * 60 - 10; }
        // motes drift
        if (!this.calm) {
            const p = this.motes.geometry.attributes.position;
            const fall = this.themeName === 'frost' ? -0.5 : this.themeName === 'volcano' || this.themeName === 'forge' ? 0.4 : 0.05;
            for (let i = 0; i < p.count; i++) {
                let y = p.getY(i) + fall * dt;
                if (y < 0) y += 5; if (y > 5) y -= 5;
                p.setXYZ(i, p.getX(i) + Math.sin(time * 0.5 + i) * dt * 0.1, y, p.getZ(i));
            }
            p.needsUpdate = true;
        }
        this.motes.position.copy(this.mode === 'roost' ? this.roost.position : this.mode === 'arena' ? this.arena.position : new THREE.Vector3());
        for (const f of this.flags.values()) f.userData.cloth.rotation.y = Math.sin(time * 3 + f.position.x) * 0.25;
        const pulse = this.calm ? 0.9 : 0.75 + Math.sin(time * 4) * 0.25;
        for (const hm of this.hl || []) if (hm.visible) hm.material.opacity = hm.userData.op * pulse;
        if (this.cursor?.visible) this.cursor.rotation.z = this.calm ? 0 : time * 0.8;
        if (this.focusTo) {
            this.pan.lerp(this.focusTo, Math.min(1, dt * 6));
            if (this.pan.distanceTo(this.focusTo) < 0.02) this.focusTo = null;
            this._applyCam();
        }
        this.shake = Math.max(0, this.shake - dt * 3);
    }

    /** The sky, the sea and the clouds go wherever the camera is: the arena and roost are far away. */
    _follow(cam) {
        this.sky.position.copy(cam.position);
        this.sea.position.x = cam.position.x; this.sea.position.z = cam.position.z;
        const anchor = this.mode === 'roost' ? this.roost.position : this.mode === 'arena' ? this.arena.position : null;
        this.clouds.position.set(anchor ? anchor.x : 0, 0, anchor ? anchor.z : 0);
    }

    render() {
        if (this.mode === 'arena') {
            this._arenaCamera();
            this._follow(this.arenaCam);
            this.renderer.render(this.scene, this.arenaCam);
        } else if (this.mode === 'roost') {
            const c = this.roostCam, a = this.calm ? 0.3 : Math.sin(this.time * 0.08) * 0.45 + 0.2;
            const portrait = this.w / this.h < 0.8;
            const d = portrait ? 30 : 21;
            const rp = this.roost.position;
            c.position.set(rp.x + Math.sin(a) * d, 8.5 + (portrait ? 6 : 0), rp.z + Math.cos(a) * d);
            c.lookAt(rp.x, portrait ? -1.5 : 0.2, rp.z + (portrait ? 1.5 : 0.8));
            const P = this.pad;
            c.setViewOffset(this.w, this.h, -(P.left - P.right) / 2, -(P.top - P.bottom) / 2, this.w, this.h);
            c.updateMatrixWorld();
            this._follow(c);
            this.renderer.render(this.scene, c);
        } else {
            if (this.shake > 0 && !this.calm) this._applyCam(this.shake); else if (this._shook) this._applyCam();
            this._shook = this.shake > 0;
            this._follow(this.camera);
            this.renderer.render(this.scene, this.camera);
        }
    }
}
