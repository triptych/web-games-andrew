// The view: one renderer, two stages (the overworld and the battle), the gear-iris transition
// between them, and the title-screen flyover.

import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { Overworld } from './overworld.js';
import { BattleView } from './battleview.js';
import { Portraits } from './portrait.js';
import { biomeOf } from './sky.js';

export class View {
    constructor(canvas) {
        this.r = new Renderer(canvas);
        this.ow = new Overworld(this.r);
        this.bv = new BattleView(this.r);
        this.portraits = new Portraits(160);
        this.mode = 'world';
        this.frameNo = 0;
        this.iris = 0;            // 0 open … 1 closed
        this.irisDir = 0;
        this.irisCb = null;
        this.title = false;
        this.world = null;
        this.r.use(this.ow.scene, this.ow.camera);
    }

    resize(w, h) {
        this.r.resize(w, h);
        this.ow.camera.aspect = w / h; this.ow.camera.updateProjectionMatrix();
        this.bv.camera.aspect = w / h; this.bv.camera.updateProjectionMatrix();
        this.ow.fx.setScale(h * 0.9);
        this.bv.fx.setScale(h * 0.9);
        // Narrow screens see less sideways: pull the overworld camera back a little.
        this.ow.zoom = w / h < 0.8 ? 1.25 : 1;
    }

    loadWorld(world, game) {
        this.world = world;
        this.ow.load(world, game);
        if (this.mode === 'world') this.r.use(this.ow.scene, this.ow.camera);
    }

    /** Close the iris, run cb at the darkest point, open again. */
    transition(cb, speed = 2.6) {
        this.irisDir = 1; this.irisSpeed = speed; this.irisCb = cb;
    }

    startBattle(spec, world) {
        const map = world.map;
        const B = biomeOf(map);
        const biome = map.biome || (map.kind === 'interior' ? (map.style && /foundry|elite|crown|arena/.test(map.style) ? 'boiler' : 'interior') : 'scrapyard');
        this.bv.setup({ ...spec, biome: B.interior && map.kind === 'interior' ? (spec.leader ? 'boiler' : 'interior') : biome });
        this.mode = 'battle';
        this.r.use(this.bv.scene, this.bv.camera);
    }
    endBattle() {
        this.mode = 'world';
        this.r.use(this.ow.scene, this.ow.camera);
        this.r.grade.uniforms.uHaze.value = 0;
        this.r.grade.uniforms.uShadow.value.set(0.02, 0.06, 0.08);
    }

    frame(dt, game) {
        this.frameNo++;
        if (this.irisDir) {
            this.iris = Math.max(0, Math.min(1, this.iris + this.irisDir * dt * (this.irisSpeed || 2.6)));
            if (this.irisDir > 0 && this.iris >= 1) { const cb = this.irisCb; this.irisCb = null; this.irisDir = -1; if (cb) cb(); }
            else if (this.irisDir < 0 && this.iris <= 0) this.irisDir = 0;
        }
        this.r.iris.uniforms.uK.value = this.iris;
        if (this.mode === 'battle') this.bv.update(dt);
        else if (this.world) {
            if (this.title) this.titleCam(dt);
            this.ow.update(dt, game);
            if (this.title) this.titleCam(0);
        }
        this.r.render(dt);
        this.portraits.pump(this.mode === 'battle' ? 1 : 2);
    }

    titleCam() {
        const m = this.world.map;
        const t = performance.now() / 1000;
        const c = new THREE.Vector3(m.W / 2, 0, m.H / 2);
        const r = Math.max(m.W, m.H) * 0.42;
        const cam = this.ow.camera;
        cam.position.set(c.x + Math.cos(t * 0.05) * r, 7 + Math.sin(t * 0.1) * 1.2, c.z + Math.sin(t * 0.05) * r);
        cam.lookAt(c.x, 0, c.z);
    }

    project(x, y, h) { return this.ow.project(x, y, h); }
}
