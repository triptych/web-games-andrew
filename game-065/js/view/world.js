/**
 * world.js — builds the 3D grove and keeps it in step with the simulation.
 *
 * main.js calls sync(grove) every frame and feed(events) with new sim events;
 * the world turns those into growth, creatures, weather and effects. It never
 * changes the simulation.
 */

import * as THREE from 'three';
import { scene, camera, renderer, U, frameTree, kick, toScreen, rayFrom, getQuality, setInsets } from './stage.js';
import * as TX from './textures.js';
import { Sky } from './sky.js';
import { Ground } from './ground.js';
import { WorldTree } from './tree.js';
import { Creatures } from './creatures.js';
import { AmbientMotes, Bursts, SeasonFall, Wisp, Realms } from './particles.js';
import { REALMS, SEASON_LENGTH } from '../sim/data.js';

const REALM_COLORS = Object.fromEntries(REALMS.map((r) => [r.id, r.color]));

export class World {
    constructor() {
        const q = getQuality();
        this.tex = {
            glow: TX.glowTexture(), leaf: TX.leafAtlas(), bark: TX.barkTexture(), rune: TX.runeTexture(),
            critters: TX.critterAtlas(), fern: TX.fernTexture(), star: TX.starTexture(),
        };
        this.sky = new Sky(scene);
        this.ground = new Ground(scene, this.tex, q);
        this.tree = new WorldTree(scene, this.tex, q);
        this.creatures = new Creatures(scene, this.tex, q);
        this.motes = new AmbientMotes(scene, this.tex, [1400, 900, 450][q]);
        this.bursts = new Bursts(scene, this.tex);
        this.fall = new SeasonFall(scene, this.tex, [500, 320, 160][q]);
        this.wisp = new Wisp(scene, this.tex);
        this.realms = new Realms(scene, this.tex);

        this.hemi = new THREE.HemisphereLight(0x6a8ab0, 0x18220f, 1.6);
        this.moon = new THREE.DirectionalLight(0xa8c0ff, 1.5);
        this.moon.position.copy(U.uMoonDir.value).multiplyScalar(80);
        this.heart = new THREE.PointLight(0xffd27a, 2, 20, 1.6);
        scene.add(this.hemi, this.moon, this.heart);

        // canopy aura: a big soft glow behind the crown
        this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0x7affc8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
        scene.add(this.aura);
        // stage-up shockwave ring
        this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfffe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        this.ring.position.y = 0.05;
        scene.add(this.ring);
        this.ringT = 99;

        this.growth = -1;        // displayed tree level (smoothed)
        this.targetGrowth = 0;
        this.t = 0;
        this.glow = 0.3;
        this.surge = 0;          // brief brightening after big moments
        this.size = this.tree.size();
        this._tgt = new THREE.Vector3();
    }

    /** Snap everything to the sim (first frame, after a load or a rebirth). */
    snap(g) {
        this.growth = g.s.tree;
        this.targetGrowth = g.s.tree;
        this.tree.setGrowth(this.growth);
        this.size = this.tree.size();
        this.creatures.sync(g.s.gens, -10);
        this.realms.sync(g.s.realms, REALM_COLORS, -10);
        if (g.s.wisp.active) this.wisp.spawn(g.s.wisp.active.path, g.s.wisp.active.until - g.s.t, this.t - (g.s.t - g.s.wisp.active.born));
        else this.wisp.hide();
    }

    /** React to sim events. */
    feed(events, g) {
        for (const e of events) {
            switch (e.type) {
                case 'stage': {
                    this.ringT = 0;
                    this.surge = 1;
                    kick(0.6);
                    const h = Math.max(0.5, this.size.height);
                    for (let k = 0; k < 4; k++) this.bursts.emit(new THREE.Vector3(0, h * (0.2 + k * 0.25), 0), 30, { color: k % 2 ? 0xfff0a0 : 0x9fffd8, speed: 0.6 + h * 0.18, size: 0.02 + h * 0.025, life: 2.2, up: 0.2 + h * 0.05 });
                    break;
                }
                case 'nourish': this.surge = Math.max(this.surge, 0.4); break;
                case 'wispSpawn': this.wisp.spawn(e.path, e.life, this.t); break;
                case 'wispCatch': {
                    const p = this.wisp.active ? this.wisp.pos.clone() : new THREE.Vector3(0, this.size.height * 0.5, 0);
                    const h = Math.max(0.5, this.size.height);
                    this.bursts.emit(p, 50, { color: 0xffd060, speed: 0.8 + h * 0.08, size: 0.04 + h * 0.012, life: 1.6, up: 0.3 + h * 0.02 });
                    this.bursts.emit(p, 20, { color: 0xffffff, speed: 0.5 + h * 0.04, size: 0.03 + h * 0.008, life: 1, up: 0.2 });
                    this.wisp.hide();
                    this.surge = Math.max(this.surge, 0.8);
                    break;
                }
                case 'wispMiss': this.wisp.hide(); break;
                case 'rebirth': {
                    // the tree shrinks back to its seed in a great outpouring of light
                    const h = Math.max(0.5, this.size.height);
                    for (let k = 0; k < 6; k++) this.bursts.emit(new THREE.Vector3(0, h * k / 6, 0), 45, { color: 0xffe9a8, speed: 0.8 + h * 0.2, size: 0.04 + h * 0.025, life: 2.5, up: 0.3 + h * 0.05 });
                    this.ringT = 0;
                    this.surge = 2;
                    kick(1);
                    this.wisp.hide();
                    this.growth = Math.min(this.growth, g.s.tree + 6);
                    break;
                }
                case 'spell': {
                    const col = { surge: 0x7aff9a, hands: 0xaad4ff, lure: 0xffd060, quicken: 0xffe0a0, starfall: 0xfff6c0 }[e.id] ?? 0xffffff;
                    const h = Math.max(0.5, this.size.height);
                    this.bursts.emit(new THREE.Vector3(0, h * 0.6, 0), 60, { color: col, speed: 0.6 + h * 0.12, size: 0.03 + h * 0.018, life: 1.8, up: 0.2 + h * 0.03 });
                    if (e.id === 'starfall') kick(0.4);
                    break;
                }
                case 'realm': this.surge = 2.5; kick(1); break;
                default: break;
            }
        }
    }

    /** A click landed on the tree at world point p. */
    clickBurst(p, big) {
        const s = Math.max(0.08, this.size.height * 0.012);
        this.bursts.emit(p, big ? 18 : 8, { color: Math.random() < 0.5 ? 0xfff0a0 : 0xa8ffd8, speed: 0.8 + this.size.height * 0.05, size: s * 1.6, life: 1.1, up: 0.5 + this.size.height * 0.02 });
    }

    hitTree(clientX, clientY) { return this.tree.hit(rayFrom(clientX, clientY)); }

    /** Client-space position of the wisp, if one is showing. */
    wispScreen() {
        if (!this.wisp.active || !this.wisp.group.visible) return null;
        const s = toScreen(this.wisp.pos);
        return s.behind ? null : s;
    }

    screenOf(p) { return toScreen(p); }

    /** Client-space anchor above the tree (for floating text). */
    treeScreen(frac = 0.6) { return toScreen(new THREE.Vector3(0, this.size.height * frac, 0)); }

    update(dt, g) {
        this.t += dt;
        const t = this.t;
        U.uTime.value = t;
        const s = g.s;

        // growth eases toward the sim's tree level
        this.targetGrowth = s.tree;
        if (this.growth < 0) this.growth = this.targetGrowth;
        const diff = this.targetGrowth - this.growth;
        this.growth += diff * (1 - Math.exp(-dt * (Math.abs(diff) > 8 ? 1.2 : 2.2)));
        if (Math.abs(diff) < 0.002) this.growth = this.targetGrowth;
        this.tree.setGrowth(this.growth);
        const size = this.tree.size();
        this.size = size;
        U.uTreeH.value = size.height;
        frameTree(size.height, size.crown);

        // seasons, continuous so they blend
        const seasonF = (s.t / SEASON_LENGTH) % 4;
        const si = Math.floor(seasonF);
        this.tree.setSeason(seasonF);
        this.ground.setSeason(seasonF);
        this.sky.update(dt, camera.position, seasonF, U.uFogColor.value);
        scene.fog.color.copy(U.uFogColor.value);
        U.uWind.value = 0.5 + 0.3 * Math.sin(t * 0.13) + (si === 2 ? 0.25 : 0);

        // glow grows with the tree, flares on big moments
        this.surge = Math.max(0, this.surge - dt * 0.8);
        const stage = Math.min(10, Math.floor(s.tree / 10));
        const wantGlow = 0.35 + stage * 0.11 + Math.min(1, this.surge) * 0.5;
        this.glow += (wantGlow - this.glow) * (1 - Math.exp(-dt * 3));
        U.uGlow.value = this.glow;
        // fog follows the camera: the tree stays clear, the forest beyond fades
        const camDist = camera.position.distanceTo(this._tgt.set(0, size.height * 0.48, 0));
        U.uFogDensity.value = 0.5 / Math.max(8, camDist);
        this.ground.setPool(Math.max(0.7, size.crown * 0.6 + 0.5));
        this.ground.setCamera(camera.position, camera.position.distanceTo(new THREE.Vector3(0, camera.position.y, 0)));

        this.heart.position.set(0, size.height * 0.45, 0);
        this.heart.distance = Math.max(4, size.height * 1.4);
        this.heart.intensity = (1.5 + this.glow * 3) * Math.max(1, size.height * 0.2);
        this.aura.position.set(0, size.height * 0.68, 0);
        this.aura.scale.setScalar(Math.max(1.5, size.crown * 3.2));
        this.aura.material.opacity = 0.12 + this.glow * 0.12;

        const px = renderer.getPixelRatio() * window.innerHeight / 800;
        const mps = g.mps();
        const density = Math.min(1, Math.log10(1 + mps) / 18);
        const boost = s.buffs.some((b) => b.kind === 'prod') ? 1 : 0;
        this.motes.set(density, size.height, size.crown, px, boost);
        this.fall.set(si, size.height, size.crown, px, Math.min(1, 0.15 + s.tree / 60));
        this.tree.pxScale(px);
        this.ground.pxScale(px);
        this.bursts.update(dt, px);
        this.wisp.update(dt, t, size, px);
        if (!s.wisp.active && this.wisp.active) this.wisp.hide();

        const fresh = this.creatures.sync(s.gens, t);
        for (const p of fresh) this.bursts.emit(p, 18, { color: 0xc8ffe0, speed: 1, size: 0.1, life: 1.2 });
        this.creatures.update(dt, t, size, px);
        this.sky.setAurora(Math.max(this.creatures.aurora, stage >= 6 ? 0.25 + (stage - 6) * 0.1 : 0));
        this.realms.sync(s.realms, REALM_COLORS, t);
        this.realms.update(t, size);
        this.tree.update(dt, t);

        // shockwave ring
        this.ringT += dt;
        const rk = this.ringT / 2.2;
        if (rk < 1) {
            const R = Math.max(2, size.crown * 2.5) * (0.1 + rk);
            this.ring.scale.setScalar(R);
            this.ring.material.opacity = (1 - rk) * 0.45;
        } else this.ring.material.opacity = 0;
    }
}

export { setInsets };
