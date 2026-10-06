// Portraits rendered from the real 3D models: a small second WebGLRenderer on an offscreen canvas
// draws a COM-bot (or a person's head and shoulders), and the image is cached as a data URL.
// The registry, the team screen, the battle HUD and the dialogue box all use these, so every
// picture in the UI matches the model in the world, with no art files.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBot } from './botgen.js';
import { buildPerson } from './people.js';

export class Portraits {
    constructor(size = 160) {
        this.size = size;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;
        this.gl = null;
        this.cache = new Map();
        this.queue = [];
        this.waiting = new Map();
    }
    init() {
        if (this.gl) return true;
        try {
            this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
        } catch { return false; }
        this.gl.setSize(this.size, this.size, false);
        this.gl.setPixelRatio(1);
        this.gl.toneMapping = THREE.ACESFilmicToneMapping;
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene();
        this.scene.environment = new THREE.PMREMGenerator(this.gl).fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.add(new THREE.HemisphereLight('#fff0dc', '#40302a', 1.0));
        const key = new THREE.DirectionalLight('#ffe8c8', 2.4); key.position.set(-2, 3, 4); this.scene.add(key);
        const rim = new THREE.DirectionalLight('#8ac8ff', 1.6); rim.position.set(3, 2, -3); this.scene.add(rim);
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
        return true;
    }

    key(kind, a, b) { return `${kind}|${a}|${b || ''}`; }

    /** A cached portrait, or null (and it is queued; cb gets the URL when ready). */
    bot(sp, gilded = false, cb = null) { return this.get(this.key('bot', sp, gilded), { kind: 'bot', sp, gilded }, cb); }
    person(look, seed = 'x', cb = null) { return this.get(this.key('person', typeof look === 'string' ? look : JSON.stringify(look), seed), { kind: 'person', look, seed }, cb); }

    get(k, job, cb) {
        if (this.cache.has(k)) return this.cache.get(k);
        if (cb) { if (!this.waiting.has(k)) this.waiting.set(k, []); this.waiting.get(k).push(cb); }
        if (!this.queue.some((q) => q.k === k)) this.queue.push({ k, ...job });
        return null;
    }

    /** Render up to n queued portraits (call once per frame). */
    pump(n = 2) {
        if (!this.queue.length) return;
        if (!this.init()) { this.queue.length = 0; return; }
        for (let i = 0; i < n && this.queue.length; i++) {
            const job = this.queue.shift();
            let url = '';
            try { url = this.render(job); } catch (e) { console.warn('portrait', e); }
            this.cache.set(job.k, url);
            for (const cb of this.waiting.get(job.k) || []) cb(url);
            this.waiting.delete(job.k);
        }
    }

    render(job) {
        const obj = job.kind === 'bot' ? buildBot(job.sp, { gilded: job.gilded }) : buildPerson(job.look, job.seed);
        const root = obj.root;
        if (job.kind === 'bot') obj.update(0.016, 0);
        this.scene.add(root);
        root.rotation.y = job.kind === 'bot' ? 0.55 : 0.25;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        if (job.kind === 'person') {
            // Head and shoulders.
            const top = box.max.y;
            c.y = top - s.y * 0.2;
            s.set(s.x, s.y * 0.45, s.z);
        }
        const r = Math.max(s.x, s.y, s.z) * 0.62;
        const dist = r / Math.tan((this.camera.fov * Math.PI) / 360);
        this.camera.position.set(c.x + dist * 0.25, c.y + dist * 0.18, c.z + dist);
        this.camera.lookAt(c);
        this.gl.setClearColor(0x000000, 0);
        this.gl.render(this.scene, this.camera);
        const url = this.canvas.toDataURL('image/png');
        this.scene.remove(root);
        return url;
    }
}
