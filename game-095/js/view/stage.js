// The three.js stage: renderer, a fixed camera that fits the room to any screen, the lights,
// picking, hover, the four friends, and the effects that answer sim events. It reads G; it never
// writes G. Rooms are built the first time they are visited.

import * as THREE from 'three';
import { BUILDERS, ROOM_BG } from './rooms.js';
import { ROOM } from './props.js';
import { makeTeens, animateTeens } from './characters.js';
import { Sparkles, Dust, Glint } from './fx.js';
import { hotspotShown, HOTSPOTS } from '../sim/world.js';
import { glowSprite } from './kit.js';

const TOP_UI = 58, BOTTOM_UI = 112;      // px kept clear for the HUD and the pack
const SPEAKER_KEY = { Maya: 'maya', Theo: 'theo', June: 'june', Dev: 'dev' };

export class Stage {
    constructor(canvas, { quality = 'high' } = {}) {
        this.canvas = canvas;
        this.maxDpr = { low: 1, medium: 1.5, high: 2 }[quality] || 2;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x120a20);
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 120);
        this.hemi = new THREE.HemisphereLight(0x7a6ac8, 0x2a1a30, 0.55);
        this.moon = new THREE.DirectionalLight(0xa8b8ff, 0.55);
        this.moon.position.set(-6, 9, 12);
        this.lamps = [new THREE.PointLight(0xffb066, 2, 14, 1.6), new THREE.PointLight(0xffd9a0, 1, 9, 1.6)];
        this.pointer = new THREE.PointLight(0xfff0c8, 0.9, 7, 1.6);          // a flashlight that follows the pointer
        this.scene.add(this.hemi, this.moon, ...this.lamps, this.pointer);
        this.rooms = {};
        this.cur = null;
        this.curId = null;
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2(9, 9);
        this.hoverId = null;
        this.pointerHit = new THREE.Vector3(0, 2, 2);
        this.teens = makeTeens();
        this.scene.add(this.teens.group);
        this.sparks = new Sparkles(this.scene);
        this.dust = new Dust(this.scene);
        this.glint = new Glint(this.scene);
        this.glints = Array.from({ length: 16 }, () => { const g = new Glint(this.scene); g.size = 0.7; return g; });   // ✨ shows every hotspot
        this.showAll = false;
        this.speaker = null;
        this.flicker = 0;
        this.flickerMax = 1;
        this.shake = 0;
        this.sheet = null;
        this.time = 0;
        this.calm = false;
        this.shakeOn = true;
        this.nudgeId = null;
        this.fade = 0;
        this.w = this.h = 0;
        this.sway = 0;
        this.fit();
        const onResize = () => this.fit();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        this.makeSheet();
    }

    /** A little ghost sheet that swoops across the back wall now and then. */
    makeSheet() {
        const s = glowSprite('#dfe8ff', 2.4, 0);
        s.position.set(-7, 3.5, -3.5);
        this.scene.add(s);
        this.sheet = { s, t: -1 };
    }

    // ------------------------------------------------------------------ size and camera
    fit() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        const topUI = h > 520 ? TOP_UI : 44, botUI = h > 520 ? BOTTOM_UI : 84;
        const availH = Math.max(160, h - topUI - botUI), availW = w;
        const aspect = availW / availH;
        const cam = this.camera;
        cam.aspect = aspect;
        // fit the whole cut-away room into the free area at any aspect, portrait phones included
        const roomW = ROOM.W + 0.2, roomH = 7.6;
        const tanV = Math.tan((cam.fov * Math.PI) / 360);
        const dist = Math.max(roomH / 2 / tanV, roomW / 2 / (tanV * aspect)) * 1.02;
        const target = new THREE.Vector3(0, 2.55, -0.2);
        const pitch = 0.27;
        cam.position.set(0, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
        cam.far = dist * 3;
        this.target = target;
        this.baseCam = cam.position.clone();
        cam.lookAt(target);
        // the picture sits between the HUD and the pack; the rest of the canvas is background
        cam.setViewOffset(availW, availH, 0, -topUI, w, h);
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    }

    setQuality(q) { this.maxDpr = { low: 1, medium: 1.5, high: 2 }[q] || 2; this.dpr = 0; this.fit(); }

    // ------------------------------------------------------------------ rooms
    ensure(id, G) {
        if (this.rooms[id]) return this.rooms[id];
        const r = BUILDERS[id](G.layout);
        r.group.visible = false;
        this.scene.add(r.group);
        this.rooms[id] = r;
        return r;
    }

    setRoom(id, G, instant = true) {
        const r = this.ensure(id, G);
        if (this.cur) this.cur.group.visible = false;
        this.cur = r; this.curId = id;
        r.group.visible = true;
        r.group.updateMatrixWorld(true);          // so a tap before the first frame still finds its boxes
        this.scene.background.setHex(ROOM_BG[id]);
        this.hemi.color.setHex(r.hemi[0]); this.hemi.groundColor.setHex(r.hemi[1]); this.hemi.intensity = r.hemi[2];
        r.lights.forEach((l, i) => { const p = this.lamps[i]; p.position.set(...l.p); p.color.setHex(l.c); p.intensity = l.i; p.distance = l.d; p.userData.base = l.i; });
        this.glint.hide();
        this.hoverId = null;
        // the party room gets a warmer, more crowded feeling: the friends turn to the middle
        this.teens.group.visible = true;
        if (!instant) this.fade = 1;
    }

    // ------------------------------------------------------------------ picking
    setPointer(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    }
    clearPointer() { this.ndc.set(9, 9); }

    pick(G, ndc = this.ndc) {
        if (!this.cur) return null;
        this.raycaster.setFromCamera(ndc, this.camera);
        const proxies = [];
        for (const h of Object.values(this.cur.hot)) if (hotspotShown(G, h.id)) proxies.push(h.proxy);
        const hits = this.raycaster.intersectObjects(proxies, false);
        if (!hits.length) return null;
        // What is nearest is what the eye sees, so it wins; among boxes at nearly the same depth the
        // smallest does, so a book beats the shelf it stands in.
        hits.sort((a, b) => a.distance - b.distance);
        const near = hits.filter((h) => h.distance - hits[0].distance < 0.6);
        const best = near.sort((a, b) => volume(a.object) - volume(b.object))[0];
        this.pointerHit.copy(best.point);
        return best.object.userData.hid;
    }

    /** The screen point (client px) of a hotspot, for tests and for keyboard focus rings. */
    screenOf(id) {
        const h = this.cur?.hot[id];
        if (!h) return null;
        const p = h.proxy.position.clone().project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'spook') this.spook(e.kind);
            else if (e.type === 'give' || e.type === 'clue' || e.type === 'unlock' || e.type === 'wisp' || e.type === 'solved' || e.type === 'place') {
                const h = this.cur?.hot[e.id];
                const pos = (h?.anchor || this.pointerHit).clone();
                const col = e.type === 'clue' ? 0x9fd8ff : e.type === 'give' ? 0xffe9a0 : e.type === 'wisp' ? 0xc8d8ff : 0xffd0f0;
                this.sparks.burst(e.type === 'give' || e.type === 'clue' ? this.pointerHit.clone() : pos, { n: e.type === 'solved' ? 40 : 16, color: col });
            } else if (e.type === 'party') { this.sparks.burst(new THREE.Vector3(0.6, 2, 0.5), { n: 60, color: 0xffd0f0, speed: 4 }); }
            else if (e.type === 'ding') this.sparks.burst(new THREE.Vector3(1.2, 2.6, -2.5), { n: 10, color: 0xffd8a0 });
            else if (e.type === 'ending') { this.sparks.burst(new THREE.Vector3(0.6, 2, 0.5), { n: 80, color: 0xffe9a0, speed: 5 }); }
            else if (e.type === 'room') this.setRoom(e.room, G, false);
            else if (e.type === 'say') this.speaker = SPEAKER_KEY[e.who] || (e.who === 'Winnie' ? 'winnie' : null);
        }
    }

    spook(kind) {
        if (this.calm) return;
        // the lights dim once, slowly, and come back: never a strobe (no more than one swing every 0.8 s)
        if (kind === 'candle') this.flicker = this.flickerMax = 1.8;
        else if (kind === 'sheet') this.sheet.t = 0;
        else if (kind === 'creak') this.shake = 0.5;
        else if (kind === 'breeze') this.flicker = this.flickerMax = 1.2;
        else if (kind === 'giggle') this.sparks.burst(new THREE.Vector3((Math.random() - 0.5) * 8, 2.5 + Math.random() * 2, -2), { n: 8, color: 0xc8d8ff, speed: 1.2, life: 1.4 });
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time, ui = {}) {
        this.fit();
        this.time = time;
        if (!this.cur || this.curId !== G.room) this.setRoom(G.room, G, true);
        const r = this.cur;
        // each hotspot's model follows the rules (taken items vanish); hover swells the one under the pointer
        for (const h of Object.values(r.hot)) {
            const on = hotspotShown(G, h.id);
            if (h.obj && h.toggle) h.obj.visible = on;
            if (h.obj && h.base) {
                const hov = this.hoverId === h.id && on ? 1.035 : 1;
                h.obj.scale.set(h.base.x * lerpTo(h.obj.scale.x / h.base.x, hov, dt * 14), h.base.y * lerpTo(h.obj.scale.y / h.base.y, hov, dt * 14), h.base.z * lerpTo(h.obj.scale.z / h.base.z, hov, dt * 14));
            }
        }
        for (const u of r.ups) u(G, dt, time);
        // the friends: bob, look about, and the speaker hops
        animateTeens(time, this.teens, this.speaker, dt);
        // lamps flicker; a spook makes them gutter
        this.flicker = Math.max(0, this.flicker - dt);
        this.lamps.forEach((l, i) => {
            const b = l.userData.base || 1;
            const f = 1 + Math.sin(time * (7 + i * 3)) * 0.05 + Math.sin(time * 19 + i) * 0.03;
            const dip = this.flicker > 0 ? 1 - 0.55 * Math.sin(Math.PI * (1 - this.flicker / this.flickerMax)) : 1;
            l.intensity = b * f * dip;
        });
        // flashlight follows the pointer, a little in front of what it touches
        if (ui.pointerOn) { this.pointer.position.set(this.pointerHit.x, this.pointerHit.y + 0.6, this.pointerHit.z + 1.6); this.pointer.intensity = 1.1; }
        else this.pointer.intensity = 0.3;
        // the camera drifts a hair towards the pointer, and shakes on a creak
        const px = this.ndc.x > 5 ? 0 : this.ndc.x, py = this.ndc.y > 5 ? 0 : this.ndc.y;
        this.shake = Math.max(0, this.shake - dt);
        const sh = this.shakeOn && !this.calm ? this.shake : 0;
        const drift = this.calm ? 0 : 1;
        this.camera.position.set(this.baseCam.x + px * 0.35 * drift + (Math.random() - 0.5) * sh * 0.12, this.baseCam.y + py * 0.18 * drift, this.baseCam.z);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
        this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
        // the sheet swoops across
        if (this.sheet.t >= 0) {
            this.sheet.t += dt;
            const k = this.sheet.t / 3.2;
            this.sheet.s.position.set(-7 + k * 14, 4.2 + Math.sin(k * 6) * 0.5, -3.3);
            this.sheet.s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.7;
            if (k >= 1) { this.sheet.t = -1; this.sheet.s.material.opacity = 0; }
        }
        // the glint: hover target, then a hinted or idle target
        const hov = this.hoverId && r.hot[this.hoverId];
        const nud = this.nudgeId && r.hot[this.nudgeId] && hotspotShown(G, this.nudgeId) ? r.hot[this.nudgeId] : null;
        if (hov && hotspotShown(G, this.hoverId)) this.glint.show(hov.anchor, 0.9);
        else if (nud) this.glint.show(nud.anchor, 1.3);
        else this.glint.hide();
        this.glint.update(time, dt);
        const all = this.showAll ? Object.values(r.hot).filter((h) => hotspotShown(G, h.id) && !h.id.startsWith('peek_')) : [];
        this.glints.forEach((g, i) => { if (all[i]) g.show(all[i].anchor, 0.8); else g.hide(); g.update(time, dt); });
        this.sparks.update(dt);
        this.dust.update(time, dt, this.calm);
        this.renderer.render(this.scene, this.camera);
    }
}

const lerpTo = (a, b, k) => a + (b - a) * Math.min(1, k);
const volume = (o) => { const g = o.geometry.parameters; return g.width * g.height * g.depth; };
