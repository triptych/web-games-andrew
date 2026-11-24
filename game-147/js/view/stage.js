// The renderer, the two scenes (the inn and the battle arena) and their cameras. The painted ElevenLabs backdrop for
// the current place is a CSS background behind a transparent canvas, so the 3D diorama sits in front of it.
// The canvas is sized in px from visualViewport (never 100vh: taps would land below the finger on phones).
//
// Cameras are orthographic 3/4 views. Each has a home framing (the whole diorama) and can ease toward a goal: a point
// and a zoom (focus on a room, wheel and pinch zoom toward the pointer, drag to pan). The goal is kept inside the
// camera's bounds, so a pan never wanders off into the sky.

import * as THREE from 'three';

const ZOOM_MAX = 3.6;

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scenes = {};
        this.cams = {};
        this.active = null;
        this.bgEl = document.getElementById('backdrop');
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    /** A scene with sunny toon lighting. The sun's shadow box is `shadow` world units across, centred on `at`. */
    makeScene(name, { sun = 0xfff1d6, sky = 0xcfe8ff, ground = 0xb59a7a, sunPos = [6, 12, 8], shadow = 14, at = [0, 0, 0] } = {}) {
        const s = new THREE.Scene();
        const hemi = new THREE.HemisphereLight(sky, ground, 1.5);
        s.add(hemi);
        s.userData.hemi = hemi;
        const d = new THREE.DirectionalLight(sun, 2.3);
        d.position.set(at[0] + sunPos[0], at[1] + sunPos[1], at[2] + sunPos[2]);
        d.target.position.set(...at);
        d.castShadow = true;
        d.shadow.mapSize.set(2048, 2048);
        d.shadow.camera.left = -shadow; d.shadow.camera.right = shadow; d.shadow.camera.top = shadow; d.shadow.camera.bottom = -shadow;
        d.shadow.camera.near = 1; d.shadow.camera.far = 60;
        d.shadow.bias = -0.0008;
        d.shadow.normalBias = 0.02;
        d.shadow.radius = 3;
        s.add(d); s.add(d.target);
        s.userData.sun = d;
        this.scenes[name] = s;
        return s;
    }

    /**
     * An orthographic 3/4 camera looking at `at` from direction `dir`, fitting `span` world units across (`narrow` on a
     * portrait screen). `bounds` [x0, x1, y0, y1] is the part of the world a pan or zoom may show.
     */
    makeIso(name, { at = [0, 0, 0], dir = [1, 1.05, 1.25], span = 16, tall = 0.34, narrow = null, bounds = null } = {}) {
        const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
        const d = new THREE.Vector3(...dir).normalize();
        c.userData = {
            home: new THREE.Vector3(...at), at: new THREE.Vector3(...at), goal: new THREE.Vector3(...at),
            dir: d, cosE: Math.sqrt(1 - d.y * d.y), span, tall, narrow, bounds,
            zoom: 1, goalZoom: 1,
        };
        this.cams[name] = c;
        this.fitCam(c);
        return c;
    }

    /** Half the frustum's width and height (world units) at a zoom. */
    half(u, zoom) {
        const aspect = this.w / this.h;
        // the whole span fits across; on wide screens at least `tall` × span fits top to bottom; portrait screens may
        // use a closer span and pan sideways instead of showing everything tiny
        const span = aspect < 0.8 && u.narrow ? u.narrow : u.span;
        let hw = span / 2 / zoom, hh = hw / aspect;
        const minH = (u.tall || 0.34) * span / zoom;
        if (hh < minH) { hh = minH; hw = hh * aspect; }
        return { hw, hh };
    }

    /** Keep a camera's goal inside its bounds (centred where the bounds fit on screen). */
    clampGoal(u) {
        const b = u.bounds;
        if (!b) { if (u.goalZoom <= 1.001) u.goal.copy(u.home); return; }
        const { hw, hh } = this.half(u, u.goalZoom);
        const vh = hh / u.cosE;        // a vertical world length L shows L·cos(elevation) tall
        const fit = (v, lo, hi, h, mid) => (hi - lo <= 2 * h ? mid : Math.max(lo + h, Math.min(hi - h, v)));
        u.goal.x = fit(u.goal.x, b[0], b[1], hw, u.home.x);
        u.goal.y = fit(u.goal.y, b[2], b[3], vh, u.home.y);
    }

    fitCam(c) {
        const u = c.userData;
        const { hw, hh } = this.half(u, u.zoom);
        c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
        c.position.copy(u.at).addScaledVector(u.dir, 40);
        c.lookAt(u.at);
        c.updateProjectionMatrix();
    }

    /** Ease a camera toward its goal. Returns true while it is still moving. */
    ease(name, dt) {
        const c = this.cams[name], u = c.userData;
        const k = 1 - Math.exp(-dt * 7);
        const far = u.at.distanceTo(u.goal) > 0.002 || Math.abs(u.zoom - u.goalZoom) > 0.0005;
        if (!far) return false;
        u.at.lerp(u.goal, k);
        u.zoom += (u.goalZoom - u.zoom) * k;
        this.fitCam(c);
        return true;
    }

    /** Frame a box of world size w × h around `center`, zoomed in as far as it fits. */
    focus(name, center, w, h) {
        const u = this.cams[name].userData;
        const { hw, hh } = this.half(u, 1);
        u.goalZoom = Math.max(1, Math.min(ZOOM_MAX, hw / (w / 2), hh / u.cosE / (h / 2)));
        u.goal.copy(center);
        this.clampGoal(u);
    }

    /** Back to the whole diorama. */
    home(name) {
        const u = this.cams[name].userData;
        u.goalZoom = 1;
        u.goal.copy(u.home);
        this.clampGoal(u);
    }

    zoomed(name) { return this.cams[name].userData.goalZoom > 1.02; }

    /** Zoom by a factor, keeping the world point under the pointer where it is. */
    zoomAt(name, factor, clientX, clientY) {
        const c = this.cams[name], u = c.userData;
        const nz = Math.max(1, Math.min(ZOOM_MAX, u.goalZoom * factor));
        const r = this.canvas.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -(((clientY - r.top) / r.height) * 2 - 1);
        const a = this.half(u, u.goalZoom), b = this.half(u, nz);
        u.goal.x += nx * (a.hw - b.hw);
        u.goal.y += ny * (a.hh - b.hh) / u.cosE;
        u.goalZoom = nz;
        this.clampGoal(u);
    }

    /** Pan by a drag of (dx, dy) client px; follows the finger at once. */
    panBy(name, dx, dy = 0) {
        const c = this.cams[name], u = c.userData;
        const wpp = (c.right - c.left) / this.w;
        u.goal.x -= dx * wpp;
        u.goal.y += dy * wpp / u.cosE;
        this.clampGoal(u);
        u.at.x = u.goal.x; u.at.y = u.goal.y;
        this.fitCam(c);
    }

    /** Sideways only (kept for callers from before zoom). */
    pan(name, dxPx) { this.panBy(name, dxPx, 0); }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        for (const c of Object.values(this.cams)) { this.clampGoal(c.userData); this.fitCam(c); }
    }

    setBackdrop(name) {
        if (this.bgName === name) return;
        this.bgName = name;
        this.bgEl.style.backgroundImage = name ? `url(art/bg-${name}.webp)` : 'none';
    }

    /** World position → client px (for damage numbers and labels). */
    toScreen(v, camName) {
        const c = this.cams[camName];
        const p = v.clone().project(c);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    }

    /** Client px → a ray into the scene. */
    ray(clientX, clientY, camName) {
        const r = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(ndc, this.cams[camName]);
        return rc;
    }

    render(sceneName, camName) {
        this.resize();
        this.renderer.render(this.scenes[sceneName], this.cams[camName]);
    }
}
