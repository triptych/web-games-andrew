/**
 * worldview.js — owns the three.js scene and keeps it in step with the simulation.
 */
import * as THREE from 'three';
import { G } from './shaders.js';
import { Renderer } from './renderer.js';
import { Sky } from './sky.js';
import { TerrainView } from './terrain.js';
import { WaterView, makeHeightTexture } from './water.js';
import { CameraRig } from './camera.js';
import { VegetationView } from './vegetation.js';
import { GrassView } from './grass.js';
import { StructuresView } from './structures.js';
import { ActorsView } from './actorsview.js';
import { InteriorView } from './interiorview.js';
import { FxView } from './fx.js';
import { ViewModel } from './viewmodel.js';
import { CAM, IS_TOUCH } from '../config.js';

export class WorldView {
    constructor(canvas, world) {
        this.world = world;
        this.r = new Renderer(canvas);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x8899aa, 1, 1000);   // activates the (overridden) fog chunks
        this.camera = new THREE.PerspectiveCamera(IS_TOUCH ? CAM.fovPhone : CAM.fov, 1, CAM.near, CAM.far);
        this.vmScene = new THREE.Scene();
        this.vmCamera = new THREE.PerspectiveCamera(60, 1, 0.02, 10);
        this.rig = new CameraRig(this.camera);
        this.rig.baseFov = this.camera.fov;
        this.r.onResize = (w, h) => {
            this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
            this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
        };
        this.time = 0;
    }

    /** Heavy construction, split into steps so the loading bar can move. */
    *buildSteps() {
        const w = this.world;
        this.sky = new Sky(this.r, this.scene);
        yield 'sky';
        this.heightTex = makeHeightTexture(w.terrain);
        this.terrainView = new TerrainView(this.scene, w.terrain, this.r, G);
        yield 'terrain';
        this.water = new WaterView(this.scene, w.terrain, this.heightTex);
        yield 'water';
        this.veg = new VegetationView(this.scene, this.r, w.flora, this.terrainView);
        this.grass = new GrassView(this.scene, w.terrain, this.heightTex, this.terrainView.maps);
        yield 'forests';
        this.structures = new StructuresView(this.scene, this.r, w.settlements, w.terrain, this.terrainView.maps, this.veg);
        yield 'towns';
        this.actors = new ActorsView(this.scene, w);
        this.actors.syncAll();
        this.interior = new InteriorView(this.scene, this.r);
        this.extObjects = this.scene.children.filter((o) => o !== this.actors.root);
        this.fx = new FxView(this.scene, w, this.actors, this.r);
        this.vm = new ViewModel(this.vmScene, this.vmCamera);
        const tmpV = new THREE.Vector3();
        this.fx.vmHand = (h) => this.vm.handWorld(h, this.camera, tmpV);
        yield 'people';
    }

    onEvents(evs) {
        for (const e of evs) {
            this.actors.onEvent(e);
            this.fx.onEvent(e);
            if (e.type === 'cellChanged') this.enterCell(e.interior);
            if (e.type === 'hit' && e.target === this.world.player && !e.blocked) { this.rig.shake = Math.min(1, this.rig.shake + 0.35); this.r.grade.uDamage.value = Math.min(1, this.r.grade.uDamage.value + 0.5); }
            if (e.type === 'sigil' && e.actor === this.world.player) this.rig.shake = Math.min(1.2, this.rig.shake + 0.4 + (e.rings || 1) * 0.2);
            if (e.type === 'explode') { const p = this.world.player.pos; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < 25) this.rig.shake = Math.min(1.2, this.rig.shake + (1 - d / 25)); }
        }
    }

    /** Swap the drawn world between the open province and the current interior. */
    enterCell(interior) {
        const w = this.world;
        const open = interior && w.space.open;
        const skyParts = [this.sky.dome, this.sky.light, this.sky.light.target, this.sky.hemi];
        for (const o of this.extObjects) o.visible = !interior || (open && skyParts.includes(o));
        if (interior) this.interior.build(w.space, this.structures.tex);
        else this.interior.clear();
        this.scene.fog.color.set(interior ? (w.space.fog || 0x0b0b0c) : 0x8899aa);
        this.r.gl.shadowMap.needsUpdate = true;
        this.actors.syncAll();
    }

    setTier(t) {
        this.r.setTier(t, false);
        this.sky.setQuality(this.r.q, t);
        this.terrainView.setQuality(this.r.q);
        this.veg.dispose();
        this.veg.build(this.r.q, this.terrainView.maps.masks, this.terrainView.tex);
        this.grass.build(this.r.q);
        this.actors.setQuality(this.r.q);
        this.fx?.setQuality(this.r.q, t);
        this.r.build(this.scene, this.camera, this.vmScene, this.vmCamera);
    }

    update(dt, opts = {}) {
        const w = this.world, p = w.player;
        this.time += dt;
        G.uTime.value = this.time;
        G.uPlayer.value.set(p.pos.x, p.pos.y, p.pos.z);
        const ws = w.weather.state();
        const windA = this.time * 0.03;
        G.uWind.value.set(Math.cos(windA) * ws.wind, Math.sin(windA) * ws.wind);
        G.uWet.value += ((ws.rain > 0.3 ? 1 : 0) - G.uWet.value) * Math.min(1, dt * 0.05);
        G.uLightning.value = ws.lightning;
        this.rig.update(p, w.space, dt, opts);
        const interior = w.cellId !== 'ext';
        const open = interior && w.space.open;
        this.sky.update(dt, open ? { hour: 19.3, day: w.time.day, cover: 0.8, fog: 0.1, aurora: 1, interior: false } : { hour: w.time.hour, day: w.time.day, cover: ws.cover, fog: ws.fog, aurora: ws.aurora, interior }, this.camera);
        this.terrainView.update(this.camera.position);
        this.water.update(this.camera.position);
        this.veg.update(this.camera.position);
        this.grass.update(this.camera.position, !interior);
        this.structures.update(dt);
        if (interior) this.interior.update(dt, this.camera.position, this.time);
        this.camera.updateMatrixWorld();
        this.fx.update(dt, this.camera);
        this.vm.update(dt, p, w);
        const gr = this.r.grade;
        gr.uDamage.value = Math.max(0, gr.uDamage.value - dt * 1.5);
        gr.uLowHp && (gr.uLowHp.value = p.hp / p.hpMax < 0.3 ? 1 - p.hp / p.hpMax / 0.3 : 0);
        gr.uFrost.value += ((p.stats?.slowed ? 0.8 : 0) - gr.uFrost.value) * Math.min(1, dt * 3);
        this.actors.showPlayer = !!p.third;
        this.actors.update(dt, this.camera);
        // god rays
        const fx = this.r.fx;
        this.sky.sunScreen(this.camera, fx.uSun.value);
        fx.uRays.value = interior ? 0 : 0.55 * (1 - ws.cover * 0.8);
        fx.uTime.value = this.time;
        this.r.grade.uTime.value = this.time;
        const under = !interior && w.terrain.waterAt(this.camera.position.x, this.camera.position.z) > this.camera.position.y;
        fx.uUnder.value = under ? 1 : 0;
    }

    render(dt) { this.r.render(dt); }
}
