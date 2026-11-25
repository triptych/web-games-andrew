// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x, 0, y): the camera looks down at the field from the south.

import * as THREE from 'three';
import { FIELD, PLAYER, PICKUP } from '../config.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x0b0d14);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0b0d14, 30, 70);   // near and far are set in resize()
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

        this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20182a, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(8, 20, 10);
        this.scene.add(sun);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(FIELD.w, FIELD.h),
            new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.9 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(FIELD.w / 2, 0, FIELD.h / 2);
        this.scene.add(floor);

        this.player = new THREE.Mesh(
            new THREE.SphereGeometry(PLAYER.radius, 24, 16),
            new THREE.MeshStandardMaterial({ color: 0x6fe0ff, emissive: 0x0a3040 }),
        );
        this.scene.add(this.player);

        // One draw call for every pickup; the matrix of each instance follows G.pickups.
        this.pickups = new THREE.InstancedMesh(
            new THREE.OctahedronGeometry(PICKUP.radius),
            new THREE.MeshStandardMaterial({ color: 0xffcc4d, emissive: 0x664400 }),
            32,
        );
        this.scene.add(this.pickups);
        this.tmp = new THREE.Object3D();
        this.flash = 0;

        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.camera.aspect = w / h;
        // Fit the whole field at any aspect, portrait phones included.
        const fitH = Math.max(FIELD.h, FIELD.w / this.camera.aspect) * 0.62;
        const dist = fitH / Math.tan((this.camera.fov * Math.PI) / 360);
        this.camera.position.set(FIELD.w / 2, dist * 0.9, FIELD.h / 2 + dist * 0.45);
        this.camera.lookAt(FIELD.w / 2, 0, FIELD.h / 2);
        // Fog and the far plane follow the fitted distance: a portrait phone backs the camera off
        // far enough that fixed fog would hide the whole field.
        this.camera.far = dist * 4;
        this.scene.fog.near = dist * 1.2;
        this.scene.fog.far = dist * 3;
        this.camera.updateProjectionMatrix();
    }

    onEvents(G, events) {
        for (const e of events) if (e.type === 'pickup') this.flash = 1;
    }

    frame(G, dt, time) {
        this.resize();
        const p = G.player;
        this.player.position.set(p.x, PLAYER.radius, p.y);
        this.flash = Math.max(0, this.flash - dt * 4);
        this.player.scale.setScalar(1 + this.flash * 0.3);
        G.pickups.forEach((c, i) => {
            this.tmp.position.set(c.x, 0.6 + Math.sin(time * 3 + i) * 0.15, c.y);
            this.tmp.rotation.y = time * 2 + i;
            this.tmp.updateMatrix();
            this.pickups.setMatrixAt(i, this.tmp.matrix);
        });
        this.pickups.count = G.pickups.length;
        this.pickups.instanceMatrix.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
