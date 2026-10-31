// The stage: renderer, camera, the ink pipeline and the battlefield's ground and scenery.
//
// Each frame draws the scene twice: once in colour (the hatched ink materials) and once as normals
// into a target with a depth texture. The composite pass finds outlines in the depth and normals and
// draws them in pen over the colour, on a paper texture. Effects live on layer 1, so they are drawn in
// colour but leave no outline.
//
// Sim hex (c, r) sits at world (x, 0, z) from hexWorld. In landscape the camera looks north from the
// south edge (you on the left); on a portrait phone it looks east from the west edge, so your lines
// are at the bottom of the screen.

import * as THREE from 'three';
import { FIELD } from '../config.js';
import { hexWorld } from '../sim/hex.js';
import { SHARED, COMPOSITE, groundMaterial, PALETTE, rgb } from './ink.js';
import { tree, rock, standingStone, ruin, tent } from './models.js';
import { makeRng } from '../rng.js';

export const SQ3 = Math.sqrt(3);
export const FX_LAYER = 1;

export function hexPos(c, r, y = 0) { const [x, z] = hexWorld(c, r); return new THREE.Vector3(x, y, z); }
export const BOARD_CENTER = (() => { const a = hexWorld(0, 0), b = hexWorld(FIELD.cols - 1, FIELD.rows - 1); return new THREE.Vector3((a[0] + b[0] + SQ3 * 0.5) / 2, 0, (a[1] + b[1]) / 2); })();

export class Stage {
    constructor(canvas) {
        this.canvas = canvas;
        const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        r.outputColorSpace = THREE.LinearSRGBColorSpace;   // the ink shaders write sRGB straight through
        r.setClearColor(new THREE.Color().setRGB(...rgb(PALETTE.paper).toArray(), THREE.LinearSRGBColorSpace));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 80);
        this.camera.layers.enable(FX_LAYER);
        this.pad = { top: 60, bottom: 0, left: 0, right: 0 };
        this.calm = false;
        this.portrait = false;
        this.orbit = 0;           // radians of slow turn for the title backdrop (0 = none)
        this.shake = 0;
        this.target = BOARD_CENTER.clone();
        this.camDist = 20;

        // the ink pipeline
        this.rtColor = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
        this.rtNormal = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
        this.rtNormal.depthTexture = new THREE.DepthTexture(1, 1);
        this.rtNormal.depthTexture.type = THREE.UnsignedIntType;
        this.normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
        this.post = new THREE.ShaderMaterial({ ...COMPOSITE, uniforms: THREE.UniformsUtils.clone(COMPOSITE.uniforms), depthTest: false, depthWrite: false });
        for (const k of ['uPx', 'uBoil', 'uInk', 'uPaper']) this.post.uniforms[k] = SHARED[k];
        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));

        this.ground = null;
        this.decor = new THREE.Group();
        this.scene.add(this.decor);
        this.rocks = new THREE.Group();
        this.scene.add(this.rocks);
        this.buildGround(PALETTE.olive);
        this.resize();
    }

    setPad(p) { this.pad = { ...this.pad, ...p }; this.fit(); }

    buildGround(wash) {
        if (this.ground) { this.scene.remove(this.ground); this.ground.material.dispose(); }
        const g = new THREE.PlaneGeometry(90, 90);
        g.rotateX(-Math.PI / 2);
        this.ground = new THREE.Mesh(g, groundMaterial(FIELD.cols, FIELD.rows, wash));
        this.ground.position.set(BOARD_CENTER.x, 0, BOARD_CENTER.z);
        this.scene.add(this.ground);
    }

    /** Scenery round the field, seeded so a battle always has the same trees. */
    buildDecor(seed, act = 0) {
        for (const c of [...this.decor.children]) this.decor.remove(c);
        const rng = makeRng(seed ^ 0x5eed);
        const lo = new THREE.Vector3(-1.8, 0, -2.2), hi = new THREE.Vector3(SQ3 * FIELD.cols + 1.2, 0, 1.5 * FIELD.rows + 1.0);
        const outside = (x, z) => x < lo.x || x > hi.x || z < lo.z || z > hi.z;
        for (let i = 0; i < 70; i++) {
            const x = BOARD_CENTER.x + (rng() - 0.5) * 34, z = BOARD_CENTER.z + (rng() - 0.5) * 26;
            if (!outside(x, z)) continue;
            const kind = rng();
            let o;
            if (act === 2) o = kind < 0.5 ? rock(rng, 1 + rng() * 1.6) : kind < 0.7 ? standingStone(rng) : tree(rng, 0);
            else if (act === 1) o = kind < 0.55 ? tree(rng, 1) : kind < 0.75 ? rock(rng, 1 + rng()) : kind < 0.88 ? standingStone(rng) : tree(rng, 0);
            else o = kind < 0.6 ? tree(rng, kind < 0.35 ? 0 : 1) : kind < 0.85 ? rock(rng, 0.8 + rng()) : kind < 0.93 ? ruin(rng) : standingStone(rng);
            o.position.set(x, 0, z);
            o.rotation.y = rng() * Math.PI * 2;
            o.scale.setScalar(0.9 + rng() * 0.8);
            this.decor.add(o);
        }
        // a camp behind your lines and one behind theirs
        const t1 = tent('team'); t1.position.set(-3.2, 0, BOARD_CENTER.z - 2.5); this.decor.add(t1);
        const t2 = tent('ember'); t2.position.set(SQ3 * FIELD.cols + 2.6, 0, BOARD_CENTER.z + 2.2); this.decor.add(t2);
    }

    /** Rocks on the field itself (obstacles), rebuilt when they change. */
    setRocks(keys, seed = 1) {
        for (const c of [...this.rocks.children]) this.rocks.remove(c);
        this.rockMeshes = new Map();
        for (const k of keys) {
            const c = k >> 4, r = k & 15;
            const rng = makeRng(seed * 31 + k);
            const o = rock(rng, 1.05 + rng() * 0.35);
            o.position.copy(hexPos(c, r));
            o.rotation.y = rng() * 6;
            this.rocks.add(o);
            this.rockMeshes.set(k, o);
        }
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return false;
        this.w = w; this.h = h; this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);          // canvas CSS size in px: never 100vh
        const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
        this.rtColor.setSize(bw, bh);
        this.rtNormal.setSize(bw, bh);
        this.post.uniforms.uRes.value.set(bw, bh);
        SHARED.uPx.value = dpr;
        this.camera.aspect = w / h;
        this.portrait = h > w * 1.05;
        this.fit();
        return true;
    }

    /**
     * Place the camera so the whole field fits the space the HUD leaves (pad, in px). A binary search
     * on distance: project the board's corners and back off until they are all inside the window.
     */
    fit() {
        if (!this.w) return;
        const cam = this.camera;
        const yaw = this.portrait ? -Math.PI / 2 : 0;
        this.yaw = yaw;
        const pitch = this.portrait ? 0.92 : 0.9;   // radians down from the horizon
        const corners = [];
        const x0 = -SQ3 * 0.5 - 0.3, x1 = SQ3 * (FIELD.cols - 0.5) + SQ3 * 0.5 + 0.3, z0 = -1.3, z1 = 1.5 * (FIELD.rows - 1) + 1.3;
        for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, 0.9]) corners.push(new THREE.Vector3(x, y, z));
        const P = this.pad;
        const L = (P.left / this.w) * 2 - 1, R = 1 - (P.right / this.w) * 2, T = 1 - (P.top / this.h) * 2, Bm = (P.bottom / this.h) * 2 - 1;
        const cx = (L + R) / 2, cy = (T + Bm) / 2;
        const tgt = BOARD_CENTER.clone();
        const place = (d) => {
            const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
            cam.position.copy(tgt).addScaledVector(dir, d);
            cam.lookAt(tgt);
            // shift the view so the board's centre sits in the middle of the free area
            cam.setViewOffset(this.w, this.h, -cx * this.w / 2, cy * this.h / 2, this.w, this.h);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();
        };
        let lo = 4, hi = 80;
        for (let i = 0; i < 24; i++) {
            const d = (lo + hi) / 2;
            place(d);
            let okv = true;
            for (const c of corners) {
                const p = c.clone().project(cam);
                if (p.x < L || p.x > R || p.y > T || p.y < Bm || p.z > 1) { okv = false; break; }
            }
            if (okv) hi = d; else lo = d;
        }
        this.camDist = hi;
        this.camPitch = pitch;
        place(hi);
        cam.far = hi * 4; cam.near = Math.max(0.3, hi * 0.05);
        cam.updateProjectionMatrix();
        this.post.uniforms.uNear.value = cam.near;
        this.post.uniforms.uFar.value = cam.far;
        this.baseCam = cam.position.clone();
    }

    /** Where a world point lands on screen, in client px. */
    toScreen(v) {
        const p = v.clone().project(this.camera);
        return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, behind: p.z > 1 };
    }

    /** The hex under a client point, or null. */
    pick(clientX, clientY, cols = FIELD.cols, rows = FIELD.rows) {
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        const hit = new THREE.Vector3();
        if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), hit)) return null;
        let best = null, bd = Infinity;
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
            const p = hexPos(c, r);
            const d = (p.x - hit.x) ** 2 + (p.z - hit.z) ** 2;
            if (d < bd) { bd = d; best = [c, r]; }
        }
        return bd < 1.0 ? best : null;
    }

    /** Draw one miniature on its own with the full ink pipeline and return it as a PNG data URL. */
    renderPortrait(obj, scale = 0.45) {
        const S = 200;
        if (!this.pt) {
            const nrm = new THREE.WebGLRenderTarget(S, S);
            nrm.depthTexture = new THREE.DepthTexture(S, S);
            nrm.depthTexture.type = THREE.UnsignedIntType;
            this.pt = {
                col: new THREE.WebGLRenderTarget(S, S), nrm, out: new THREE.WebGLRenderTarget(S, S),
                scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(28, 1, 0.1, 40),
                buf: new Uint8Array(S * S * 4), canvas: document.createElement('canvas'),
            };
            this.pt.canvas.width = this.pt.canvas.height = S;
        }
        const P = this.pt;
        obj.rotation.y = 0.65;
        obj.position.set(0, 0, 0);
        obj.updateMatrixWorld(true);
        P.scene.add(obj);
        const box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
        const d = Math.max(sz.y * 1.15, sz.x, sz.z * 0.9) / (2 * Math.tan((P.cam.fov * Math.PI) / 360)) * 1.12;
        P.cam.position.set(c.x, c.y + d * 0.28, c.z + d);
        P.cam.lookAt(c.x, c.y * 0.92, c.z);
        P.cam.near = d * 0.2; P.cam.far = d * 4;
        P.cam.updateProjectionMatrix();
        const r = this.renderer, U = this.post.uniforms;
        const keep = { px: SHARED.uPx.value, res: U.uRes.value.clone(), n: U.uNear.value, f: U.uFar.value };
        SHARED.uPx.value = 1;
        r.setClearColor(new THREE.Color().setRGB(...rgb(PALETTE.paper).toArray(), THREE.LinearSRGBColorSpace));
        r.setRenderTarget(P.col); r.clear(); r.render(P.scene, P.cam);
        P.scene.overrideMaterial = this.normalMat;
        r.setClearColor(0x8080ff, 1);
        r.setRenderTarget(P.nrm); r.clear(); r.render(P.scene, P.cam);
        P.scene.overrideMaterial = null;
        U.tColor.value = P.col.texture; U.tNormal.value = P.nrm.texture; U.tDepth.value = P.nrm.depthTexture;
        U.uRes.value.set(S, S); U.uNear.value = P.cam.near; U.uFar.value = P.cam.far;
        r.setRenderTarget(P.out); r.render(this.postScene, this.postCam);
        r.readRenderTargetPixels(P.out, 0, 0, S, S, P.buf);
        r.setRenderTarget(null);
        SHARED.uPx.value = keep.px; U.uRes.value.copy(keep.res); U.uNear.value = keep.n; U.uFar.value = keep.f;
        r.setClearColor(new THREE.Color().setRGB(...rgb(PALETTE.paper).toArray(), THREE.LinearSRGBColorSpace));
        P.scene.remove(obj);
        const g = P.canvas.getContext('2d');
        const img = g.createImageData(S, S);
        for (let y = 0; y < S; y++) img.data.set(P.buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
        g.putImageData(img, 0, 0);
        void scale;
        return P.canvas.toDataURL('image/png');
    }

    render(time, dt) {
        this.resize();
        // the pen line boils: its wobble pattern changes a few times a second (held still in calm mode)
        SHARED.uBoil.value = this.calm ? 0 : Math.floor(time * 4) * 1.37 % 50;
        const cam = this.camera;
        if (this.orbit) {
            const a = this.yaw + Math.sin(time * this.orbit) * 0.32;
            const d = this.camDist * 0.92;
            const pitch = this.camPitch - 0.18;
            cam.position.set(BOARD_CENTER.x + Math.sin(a) * Math.cos(pitch) * d, Math.sin(pitch) * d, BOARD_CENTER.z + Math.cos(a) * Math.cos(pitch) * d);
            cam.lookAt(BOARD_CENTER);
        } else if (this.baseCam) {
            cam.position.copy(this.baseCam);
            cam.lookAt(BOARD_CENTER);
        }
        if (this.shake > 0 && !this.calm) {
            this.shake = Math.max(0, this.shake - dt * 2.5);
            cam.position.x += (Math.random() - 0.5) * this.shake * 0.25;
            cam.position.z += (Math.random() - 0.5) * this.shake * 0.25;
        }
        cam.updateMatrixWorld();
        const r = this.renderer;
        // colour
        r.setRenderTarget(this.rtColor);
        r.clear();
        r.render(this.scene, cam);
        // normals + depth, structure only (no effects)
        cam.layers.disable(FX_LAYER);
        this.scene.overrideMaterial = this.normalMat;
        r.setRenderTarget(this.rtNormal);
        r.setClearColor(0x8080ff, 1);
        r.clear();
        r.render(this.scene, cam);
        this.scene.overrideMaterial = null;
        cam.layers.enable(FX_LAYER);
        r.setClearColor(new THREE.Color().setRGB(...rgb(PALETTE.paper).toArray(), THREE.LinearSRGBColorSpace));
        // composite to the canvas
        this.post.uniforms.tColor.value = this.rtColor.texture;
        this.post.uniforms.tNormal.value = this.rtNormal.texture;
        this.post.uniforms.tDepth.value = this.rtNormal.depthTexture;
        r.setRenderTarget(null);
        r.render(this.postScene, this.postCam);
    }
}
