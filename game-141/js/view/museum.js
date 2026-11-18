// The museum's 3D viewer: the one place the game shows real models. Each artifact is a Meshy GLB (models/,
// see dev/models/README.md) on a marble plinth under a warm spotlight, turning slowly; drag to turn it yourself.
// It has its own small renderer and only runs while the viewer is open. A model that fails to load is replaced
// by the artifact's painted picture on a card, so the case is never empty.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODEL, ROOT, ART } from '../media.js';
import { ARTIFACTS } from '../sim/data/artifacts.js';

export class Museum {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = null;
        this.cache = {};
        this.loader = new GLTFLoader();
        this.open = false;
        this.yaw = 0; this.spin = 0.5; this.drag = null; this.pitch = 0.12;
    }

    init() {
        if (this.renderer) return;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.15;
        r.shadowMap.enabled = true;
        this.scene = new THREE.Scene();
        const pm = new THREE.PMREMGenerator(r);
        this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
        this.camera.position.set(0, 1.0, 3.1);
        this.camera.lookAt(0, 0.42, 0);
        const spot = new THREE.SpotLight(0xfff0d0, 40, 10, 0.5, 0.6, 1.4);
        spot.position.set(0.6, 4, 1.6);
        spot.target.position.set(0, 0.6, 0);
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        this.scene.add(spot, spot.target);
        const rim = new THREE.DirectionalLight(0x8ab8ff, 1.4);
        rim.position.set(-3, 2, -3);
        this.scene.add(rim, new THREE.HemisphereLight(0xffeedd, 0x302040, 0.6));
        // plinth
        const marble = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.35, metalness: 0.05 });
        const gold = new THREE.MeshStandardMaterial({ color: 0xd9a940, roughness: 0.3, metalness: 0.9 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.12, 48), marble);
        base.position.y = -0.06; base.receiveShadow = true;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 48), gold);
        top.position.y = 0.02; top.receiveShadow = true;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1.4, 48), marble);
        col.position.y = -0.82;
        this.scene.add(base, top, col);
        // dust motes in the beam
        const g = new THREE.BufferGeometry();
        const n = 120, pos = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { pos[k * 3] = (Math.random() - 0.5) * 1.6; pos[k * 3 + 1] = Math.random() * 2.2; pos[k * 3 + 2] = (Math.random() - 0.5) * 1.6; }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe8b0, size: 0.018, transparent: true, opacity: 0.6, depthWrite: false }));
        this.scene.add(this.motes);
        this.holder = new THREE.Group();
        this.holder.position.y = 0.04;
        this.scene.add(this.holder);

        const c = this.canvas;
        c.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; try { c.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
        c.addEventListener('pointermove', (e) => {
            if (!this.drag) return;
            this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012;
            this.pitch = Math.max(-0.3, Math.min(0.6, this.drag.pitch + (e.clientY - this.drag.y) * 0.006));
            this.spin = 0;
        });
        const end = () => { this.drag = null; this.spin = 0.35; };
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
    }

    /** Load (once) and return the artifact's model, normalised to stand on y = 0 and fit a 1-unit box. */
    async model(id) {
        if (this.cache[id]) return this.cache[id];
        const p = new Promise((res) => {
            this.loader.load(ROOT + MODEL(id), (gltf) => {
                const m = gltf.scene;
                m.traverse((o) => {
                    if (!o.isMesh) return;
                    o.castShadow = true;
                    const mat = o.material;
                    if (mat && mat.isMeshStandardMaterial) { mat.roughness = 0.5; mat.metalness = 0.15; mat.envMapIntensity = 0.9; }
                });
                const box = new THREE.Box3().setFromObject(m);
                const size = box.getSize(new THREE.Vector3());
                const s = 1.05 / Math.max(size.x, size.y, size.z);
                m.scale.setScalar(s);
                const b2 = new THREE.Box3().setFromObject(m);
                const c = b2.getCenter(new THREE.Vector3());
                m.position.set(-c.x, -b2.min.y, -c.z);
                const g = new THREE.Group();
                g.add(m);
                res(g);
            }, undefined, () => res(this.card(id)));
        });
        this.cache[id] = p;
        return p;
    }

    /** Fallback: the painted picture on a little standing card. */
    card(id) {
        const k = ARTIFACTS.findIndex((a) => a.id === id);
        const t = new THREE.TextureLoader().load(ROOT + ART.arts);
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(0.25, 0.25);
        t.offset.set((k % 4) * 0.25, 1 - (Math.floor(k / 4) + 1) * 0.25);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
        m.position.y = 0.5;
        const g = new THREE.Group();
        g.add(m);
        g.userData.card = true;
        return g;
    }

    async show(id) {
        this.init();
        this.open = true;
        this.current = id;
        this.yaw = -0.5; this.spin = 0.5; this.intro = 1;
        const m = await this.model(id);
        if (this.current !== id) return;
        this.holder.clear();
        this.holder.add(m);
        this.loaded = id;
    }

    hide() { this.open = false; }

    frame(dt, time) {
        if (!this.open || !this.renderer) return;
        const c = this.canvas;
        const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
        if (w !== this.w || h !== this.h) {
            this.w = w; this.h = h;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.camera.position.z = w / h < 0.9 ? 3.9 : 3.1;
            this.camera.lookAt(0, 0.42, 0);
            this.camera.updateProjectionMatrix();
        }
        this.yaw += this.spin * dt;
        this.intro = Math.max(0, (this.intro || 0) - dt * 1.5);
        const e = 1 - this.intro;
        this.holder.rotation.set(this.pitch * 0.6, this.yaw, 0);
        this.holder.position.y = 0.04 + (1 - e) * 0.4 + Math.sin(time * 1.4) * 0.025;
        this.holder.scale.setScalar(0.6 + 0.4 * e * e);
        const pos = this.motes.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            let y = pos.getY(k) + dt * 0.08;
            if (y > 2.2) y = 0;
            pos.setY(k, y);
        }
        pos.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
