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
    }

    setTier(t) {
        this.r.setTier(t, false);
        this.sky.setQuality(this.r.q, t);
        this.terrainView.setQuality(this.r.q);
        this.veg.dispose();
        this.veg.build(this.r.q, this.terrainView.maps.masks, this.terrainView.tex);
        this.grass.build(this.r.q);
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
        this.sky.update(dt, { hour: w.time.hour, day: w.time.day, cover: ws.cover, fog: ws.fog, aurora: ws.aurora, interior }, this.camera);
        this.terrainView.update(this.camera.position);
        this.water.update(this.camera.position);
        this.veg.update(this.camera.position);
        this.grass.update(this.camera.position, !interior);
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
