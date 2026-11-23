// The renderer, the two scenes (the inn and the battle arena) and their cameras. The painted ElevenLabs backdrop for
// the current place is a CSS background behind a transparent canvas, so the 3D diorama sits in front of it.
// The canvas is sized in px from visualViewport (never 100vh: taps would land below the finger on phones).

import * as THREE from 'three';

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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

    /** A scene with sunny toon lighting. */
    makeScene(name, { sun = 0xfff1d6, sky = 0xcfe8ff, ground = 0xb59a7a } = {}) {
        const s = new THREE.Scene();
        s.add(new THREE.HemisphereLight(sky, ground, 1.35));
        const d = new THREE.DirectionalLight(sun, 2.1);
        d.position.set(6, 12, 8);
        d.castShadow = true;
        d.shadow.mapSize.set(1024, 1024);
        d.shadow.camera.left = -14; d.shadow.camera.right = 14; d.shadow.camera.top = 14; d.shadow.camera.bottom = -14;
        d.shadow.camera.near = 1; d.shadow.camera.far = 40;
        d.shadow.bias = -0.0015;
        s.add(d); s.add(d.target);
        s.userData.sun = d;
        this.scenes[name] = s;
        return s;
    }

    /** An orthographic 3/4 camera looking at `at` from direction `dir`, fitting `span` world units across. */
    makeIso(name, { at = [0, 0, 0], dir = [1, 1.05, 1.25], span = 16, tall = 0.34 } = {}) {
        const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
        c.userData = { at: new THREE.Vector3(...at), dir: new THREE.Vector3(...dir).normalize(), span, tall, zoom: 1 };
        this.cams[name] = c;
        this.fitCam(c);
        return c;
    }

    fitCam(c) {
        const u = c.userData;
        const aspect = this.w / this.h;
        // the whole span always fits across; on wide screens at least `tall` × span fits top to bottom
        let halfW = u.span / 2 / u.zoom;
        let halfH = halfW / aspect;
        const minH = (u.tall || 0.34) * u.span / u.zoom;
        if (halfH < minH) { halfH = minH; halfW = halfH * aspect; }
        c.left = -halfW; c.right = halfW; c.top = halfH; c.bottom = -halfH;
        c.position.copy(u.at).addScaledVector(u.dir, 40);
        c.lookAt(u.at);
        c.updateProjectionMatrix();
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);
        for (const c of Object.values(this.cams)) this.fitCam(c);
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
