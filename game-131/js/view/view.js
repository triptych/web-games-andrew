// The three.js view: first person. Reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, z) is world (x, ·, z); yaw 0 looks north (−z).

import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { GEMS } from '../sim/data/story.js';
import { zone, groundY } from '../sim/world.js';
import { LOOKS, buildIsle, buildGrid, faceOpen } from './build.js';
import { makeProp, makeGem, modelState } from './props.js';
import { icon, glow } from './tex.js';

const ITEM_TINT = { moonmint: '#cfeee0', rune: '#ffd28a', pipe: '#9fe0c8', pearl: '#f4f0ff' };
const KIND_TINT = { seaglass: '#7fe0d0', feather: '#ffffff', shard: '#ffc46b', crown: '#ffd95a', starseed: '#fff6a8', songshell: '#ffc0d0', button: '#d9a066' };

export class View {
    constructor(canvas, { low = false } = {}) {
        this.canvas = canvas;
        this.low = low;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0xbfd9e6, 60, 300);
        this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
        this.camera.rotation.order = 'YXZ';
        this.scene.add(this.camera);

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.position.set(60, 120, 40);
        this.lamp = new THREE.PointLight(0xffe0b0, 0, 24, 1.6);     // the glow you carry underground
        this.camera.add(this.lamp);
        this.scene.add(this.hemi, this.sun);

        this.zones = {};            // zone id → { group, things: {id → prop}, doors, chimes }
        this.zoneId = null;
        this.G = null;
        this.pitch = 0;
        this.bob = 0;
        this.eyeY = null;
        this.dyn = new THREE.Group();        // this game's pickups and items in the current zone
        this.scene.add(this.dyn);

        // Thimble: one figure for the whole game
        this.thimble = makeProp('thimble', (root, gltf) => {
            if (gltf.animations?.length) {
                this.mixer = new THREE.AnimationMixer(root);
                this.walk = this.mixer.clipAction(gltf.animations[0]);
                this.walk.play();
                this.walk.paused = true;
            }
        });
        this.thimbleYaw = 0;
        this.tPrev = { x: 0, z: 0 };
        this.scene.add(this.thimble);

        // drifting motes: pollen, cave-light, bubbles
        const n = low ? 60 : 220, pos = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++) pos[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: glow(), size: 0.16, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        this.motes.frustumCulled = false;
        this.moteSeed = pos.slice();
        this.scene.add(this.motes);

        // sparkles for pickups and gems
        this.sparks = [];
        for (let i = 0; i < 28; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
            s.visible = false; this.scene.add(s); this.sparks.push({ s, life: 0, v: new THREE.Vector3() });
        }
        this.pulse = {};            // thing id → seconds of bounce left
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
        this.renderer.setPixelRatio(this.low ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
        this.renderer.setSize(w, h);          // sets the canvas CSS size in px (never 100vh)
        this.camera.aspect = w / h;
        this.camera.fov = w < h ? 82 : 70;    // a portrait phone sees a little wider
        this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------------ zones
    _zone(id) {
        if (this.zones[id]) return this.zones[id];
        const Z = zone(id), group = id === 'isle' ? buildIsle(this.low) : buildGrid(id, this.low);
        const things = {}, doors = [];
        for (const t of Z.things) {
            if (t.type === 'item' || (t.type === 'npc' && t.npc === 'thimble')) continue;
            if (!t.look) continue;
            const p = makeProp(t.look);
            p.position.set(t.x, groundY(id, t.x, t.z), t.z);
            p.rotation.y = Z.kind === 'grid' ? faceOpen(Z, t) : t.id.startsWith('ring') || t.id === 'rootDoor' ? Math.atan2(t.x - Z.byId.leafPedestal.x, t.z - Z.byId.leafPedestal.z) : 0;
            if (t.type === 'door') { doors.push({ t, p, y: p.position.y }); if (Z.kind === 'grid') p.scale.set(1.25, 1.2, 1.25); }
            if (t.type === 'pedestal') { const gem = makeGem(GEMS.find((g) => g.id === t.gem).color); gem.position.y = t.look === 'cistern' ? 1.3 : 1.75; p.add(gem); p.userData.gem = gem; }
            if (t.id === 'caveMouth') { const b = makeProp('boulder'); b.position.z = 0.8; p.add(b); p.userData.boulder = b; }
            group.add(p);
            things[t.id] = p;
        }
        this.zones[id] = { group, things, doors, Z };
        return this.zones[id];
    }

    _enter(G) {
        if (this.zoneId) this.scene.remove(this.zones[this.zoneId].group);
        const id = G.zone, zv = this._zone(id), L = LOOKS[zv.Z.def.look || 'isle'];
        this.zoneId = id; this.G = G; this.L = L;
        this.scene.add(zv.group);
        this.scene.fog.color.set(L.fog[0]); this.scene.fog.near = L.fog[1]; this.scene.fog.far = L.fog[2];
        this.renderer.setClearColor(L.bg ?? L.fog[0]);
        this.hemi.color.set(L.amb[0]); this.hemi.groundColor.set(L.amb[1]); this.hemi.intensity = L.amb[2];
        this.sun.visible = !!L.sun;
        if (L.sun) { this.sun.color.set(L.sun[0]); this.sun.intensity = L.sun[1]; }
        this.lamp.color.set(L.lamp ? L.lamp[0] : 0xffffff); this.lamp.intensity = L.lamp ? L.lamp[1] : 0; this.lamp.distance = L.lamp ? L.lamp[2] : 1;
        this.motes.material.color.set(L.motes);
        this.eyeY = null;

        // this game's small things here
        while (this.dyn.children.length) this.dyn.remove(this.dyn.children[0]);
        this.picks = G.pickups[id].map((c) => this._sprite(icon(c.k, KIND_TINT[c.k]), c.x, c.z, 0.5));
        this.items = zv.Z.things.filter((t) => t.type === 'item').map((t) => ({ t, s: this._sprite(icon(t.item, ITEM_TINT[t.item]), t.x, t.z, 0.75, true) }));
    }

    _sprite(map, x, z, size, halo) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
        s.scale.setScalar(size);
        s.position.set(x, groundY(this.zoneId, x, z) + 0.7, z);
        s.userData.y = s.position.y;
        if (halo) {
            const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
            h.scale.setScalar(2.6); s.add(h);
        }
        this.dyn.add(s);
        return s;
    }

    burst(x, y, z, color, n = 8) {
        for (const sp of this.sparks) {
            if (n <= 0) break;
            if (sp.life > 0) continue;
            sp.life = 0.9; sp.s.visible = true; sp.s.position.set(x, y, z); sp.s.material.color.set(color);
            sp.v.set((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 1.8, (Math.random() - 0.5) * 2.4);
            n--;
        }
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'pickup' && e.x !== undefined) this.burst(e.x, groundY(G.zone, e.x, e.z) + 0.7, e.z, KIND_TINT[e.kind] || '#ffffff');
            else if (e.type === 'item') this.burst(G.player.x, groundY(G.zone, G.player.x, G.player.z) + 0.8, G.player.z, ITEM_TINT[e.item] || '#ffffff', 10);
            else if (e.type === 'gem') { this.flash = 1; this.flashColor = GEMS.find((g) => g.id === e.gem).color; }
            else if (e.type === 'chime') { this.pulse[e.id] = 0.7; const p = this.zones[G.zone]?.things[e.id]; if (p) this.burst(p.position.x, p.position.y + 1.4, p.position.z, '#bfe9ff', 6); }
            else if (e.type === 'seqDone' || e.type === 'offered' || e.type === 'hearthSet' || e.type === 'ending') this.flash = 0.8;
            else if (e.type === 'travel') this.eyeY = null;
        }
    }

    /** Screen position of a world point, in CSS px, or null when it is behind the camera (the tests use it). */
    screenOf(x, y, z) {
        const v = new THREE.Vector3(x, y, z).project(this.camera);
        return v.z > 1 ? null : { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
    }
    get info() { return { tris: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls, models: { ...modelState } }; }

    // ------------------------------------------------------------------ every frame
    frame(G, dt, time) {
        this.resize();
        if (G !== this.G || G.zone !== this.zoneId) this._enter(G);
        const zv = this.zones[this.zoneId], p = G.player;

        // camera: follow the ground smoothly, bob a little while walking
        const gy = groundY(G.zone, p.x, p.z) + PLAYER.eye;
        this.eyeY = this.eyeY === null ? gy : this.eyeY + (gy - this.eyeY) * Math.min(1, dt * 10);
        const moving = this.lastX !== undefined && Math.hypot(p.x - this.lastX, p.z - this.lastZ) > 0.001;
        this.lastX = p.x; this.lastZ = p.z;
        if (moving) this.bob += dt * 9;
        this.camera.position.set(p.x, this.eyeY + (moving ? Math.sin(this.bob) * 0.035 : 0), p.z);
        this.camera.rotation.set(this.pitch, -p.yaw, 0);
        if (this.L.rise || this.zoneId === 'sea') this.camera.position.y += Math.sin(time * 0.8) * 0.04;      // a slow swell under the sea

        // Thimble
        const th = G.thimble, T = this.thimble;
        T.visible = th.state === 'follow' || (th.state === 'hurt' && G.zone === 'isle');
        if (th.state === 'hurt') {
            const n = zone('isle').byId.thimble;
            T.position.set(n.x, groundY('isle', n.x, n.z) + 0.22, n.z); T.rotation.set(0, 0.6, Math.PI / 2);
        } else if (th.state === 'follow') {
            const dx = th.x - this.tPrev.x, dz = th.z - this.tPrev.z, d = Math.hypot(dx, dz);
            if (d > 0.002 && d < 2) this.thimbleYaw = Math.atan2(dx, dz);
            else if (d <= 0.002) { const a = Math.atan2(p.x - th.x, p.z - th.z); let k = a - this.thimbleYaw; while (k > Math.PI) k -= Math.PI * 2; while (k < -Math.PI) k += Math.PI * 2; this.thimbleYaw += k * Math.min(1, dt * 3); }
            T.position.set(th.x, groundY(G.zone, th.x, th.z), th.z); T.rotation.set(0, this.thimbleYaw, 0);
            if (this.walk) this.walk.paused = d <= 0.002;
            else T.position.y += d > 0.002 ? Math.abs(Math.sin(time * 9)) * 0.06 : 0;
            this.tPrev.x = th.x; this.tPrev.z = th.z;
        }
        this.mixer?.update(dt);

        // small things: bob, turn, vanish when taken
        G.pickups[this.zoneId].forEach((c, i) => { const s = this.picks[i]; if (!s) return; s.visible = !c.g; s.position.y = s.userData.y + Math.sin(time * 2 + i) * 0.1; });
        for (const it of this.items) { it.s.visible = !G.taken[it.t.id]; it.s.position.y = it.s.userData.y + Math.sin(time * 2.4) * 0.12; }

        // doors sink, gems wait, chimes ring, vines grow, the boulder rolls off
        for (const d of zv.doors) { const open = !!G.flags[d.t.flag]; const target = d.y - (open ? 5.2 : 0); d.p.position.y += (target - d.p.position.y) * Math.min(1, dt * 1.6); d.p.visible = d.p.position.y > d.y - 5; }
        for (const id in zv.things) {
            const o = zv.things[id];
            if (o.userData.gem) { const t = zv.Z.byId[id]; const ready = (t.needs || []).every((f) => G.flags[f]); o.userData.gem.visible = !G.gems.includes(t.gem) && ready; o.userData.gem.rotation.y = time * 1.2; o.userData.gem.position.y += Math.sin(time * 2) * 0.0015; }
            if (o.userData.boulder) o.userData.boulder.visible = !G.gems.includes('stone');
            if (this.pulse[id] > 0) { this.pulse[id] -= dt; const k = 1 + Math.max(0, this.pulse[id]) * 0.35 * Math.sin(this.pulse[id] * 30); o.scale.setScalar(k); }
        }
        if (this.zoneId === 'isle') { const v = zv.things.vineFoot; if (v) v.visible = G.gems.includes('leaf'); }

        // the sea breathes, clouds drift, light shafts sway, the whale goes by
        zv.group.traverse((o) => {
            const u = o.userData;
            if (u.sea) o.position.y = 0.12 + Math.sin(time * 0.6) * 0.06;
            else if (u.clouds) o.rotation.y = time * 0.004;
            else if (u.sky) o.position.copy(this.camera.position);
            else if (u.shaft !== undefined) o.material.opacity = 0.05 + 0.03 * Math.sin(time * 0.7 + u.shaft);
            else if (u.whale) { const a = time * 0.03; o.position.set(36 + Math.cos(a) * 150, 14 + Math.sin(time * 0.1) * 3, 18 + Math.sin(a) * 150); o.rotation.y = -a; }
        });

        // motes wrap round the camera in a box
        const mp = this.motes.geometry.attributes.position, B = 18, rise = this.L.rise ? 0.6 : 0.05;
        for (let i = 0; i < mp.count; i++) {
            const sx = this.moteSeed[i * 3], sy = this.moteSeed[i * 3 + 1], sz = this.moteSeed[i * 3 + 2];
            const wrap = (v, c) => ((((v - c) % B) + B * 1.5) % B) - B / 2 + c;
            mp.setXYZ(i, wrap(sx * 400 + Math.sin(time * 0.3 + i) * 0.6, p.x), wrap(sy * 400 + time * rise, this.camera.position.y) * 0.6 + this.camera.position.y * 0.4, wrap(sz * 400 + Math.cos(time * 0.27 + i) * 0.6, p.z));
        }
        mp.needsUpdate = true;

        for (const sp of this.sparks) {
            if (sp.life <= 0) continue;
            sp.life -= dt;
            sp.s.position.addScaledVector(sp.v, dt); sp.v.y -= dt * 2.2;
            sp.s.material.opacity = Math.max(0, sp.life); sp.s.scale.setScalar(0.25 + sp.life * 0.3);
            if (sp.life <= 0) sp.s.visible = false;
        }
        // a gem's light washes over everything for a moment
        if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.7); this.renderer.toneMappingExposure = 1 + this.flash * 0.6; } else this.renderer.toneMappingExposure = 1;

        this.renderer.render(this.scene, this.camera);
    }
}
