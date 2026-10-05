/**
 * actors.js — draws the sim's bodies: fighters (palette-indexed atlases),
 * their shadows and held weapons, pickups, props, projectiles and hazard
 * markers. Meshes are created when an id first appears and dropped when it
 * leaves, so the view never has to be told about spawns.
 */

import * as THREE from 'three';
import { bakeChar, frameFor, PAL_W } from '../art/bake.js';
import { buildObjectAtlas } from '../art/objects.js';
import { YS, ZS } from './scene.js';
import { WALL_Z } from './stages.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PAL_FS = `
uniform sampler2D map; uniform sampler2D pal; uniform vec4 frame; uniform float flip; uniform float row; uniform float rows;
uniform vec4 flash; uniform vec3 ambient; uniform float alpha;
varying vec2 vUv;
void main(){
  vec2 uv = vUv; if (flip > 0.5) uv.x = 1.0 - uv.x;
  vec4 t = texture2D(map, vec2(frame.x + uv.x * frame.z, frame.y + (1.0 - uv.y) * frame.w));
  if (t.a < 0.5) discard;
  float idx = floor(t.r * 255.0 + 0.5);
  vec4 pc = texture2D(pal, vec2((idx + 0.5) / 32.0, (row + 0.5) / rows));
  vec3 c = pc.a > 0.75 ? pc.rgb * 1.08 : pc.rgb * ambient;
  c = mix(c, flash.rgb, flash.a);
  gl_FragColor = vec4(c, alpha);
}`;
const OBJ_FS = `
uniform sampler2D map; uniform vec4 frame; uniform float flip; uniform vec4 flash; uniform vec3 ambient; uniform float alpha; uniform float glow;
varying vec2 vUv;
void main(){
  vec2 uv = vUv; if (flip > 0.5) uv.x = 1.0 - uv.x;
  vec4 t = texture2D(map, vec2(frame.x + uv.x * frame.z, frame.y + (1.0 - uv.y) * frame.w));
  if (t.a < 0.5) discard;
  vec3 c = mix(t.rgb * ambient, t.rgb, glow);
  c = mix(c, flash.rgb, flash.a);
  gl_FragColor = vec4(c, alpha * t.a);
}`;

const FLASH = [[1, 1, 1], [0.5, 0.8, 1], [1, 0.95, 0.6], [1, 0.25, 0.25]];
const unitPlane = new THREE.PlaneGeometry(1, 1);

export class Actors {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.charTex = new Map();
        this.meshes = new Map();
        this.ambient = new THREE.Vector3(1, 1, 1);
        // object atlas
        const oa = buildObjectAtlas();
        this.oa = oa;
        const otex = new THREE.DataTexture(new Uint8Array(oa.data.buffer), oa.W, oa.H, THREE.RGBAFormat);
        otex.magFilter = otex.minFilter = THREE.NearestFilter; otex.generateMipmaps = false; otex.needsUpdate = true;
        this.otex = otex;
        this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
        this.shadowGeo = new THREE.CircleGeometry(1, 16);
    }

    // ------------------------------------------------------------ textures
    charData(key) {
        if (this.charTex.has(key)) return this.charTex.get(key);
        const b = bakeChar(key);
        const map = new THREE.DataTexture(b.data, b.W, b.H, THREE.RGBAFormat);
        map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true;
        const pal = new THREE.DataTexture(b.palette, PAL_W, b.nRows, THREE.RGBAFormat);
        pal.magFilter = pal.minFilter = THREE.NearestFilter; pal.generateMipmaps = false; pal.needsUpdate = true;
        const d = { b, map, pal };
        this.charTex.set(key, d);
        return d;
    }

    preload(keys) { for (const k of keys) this.charData(k); }

    palMaterial(cd) {
        return new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: PAL_FS,
            uniforms: { map: { value: cd.map }, pal: { value: cd.pal }, frame: { value: new THREE.Vector4() }, flip: { value: 0 }, row: { value: 0 }, rows: { value: cd.b.nRows }, flash: { value: new THREE.Vector4(0, 0, 0, 0) }, ambient: { value: this.ambient }, alpha: { value: 1 } },
        });
    }

    objMaterial(opts = {}) {
        return new THREE.ShaderMaterial({
            vertexShader: VS, fragmentShader: OBJ_FS, transparent: !!opts.transparent, depthWrite: !opts.transparent, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: { map: { value: this.otex }, frame: { value: new THREE.Vector4() }, flip: { value: 0 }, flash: { value: new THREE.Vector4(0, 0, 0, 0) }, ambient: { value: this.ambient }, alpha: { value: 1 }, glow: { value: opts.glow ?? 0 } },
        });
    }

    /** Set an object sprite's frame and size; returns the frame record. */
    setObjFrame(mesh, name) {
        const f = this.oa.frames[name];
        if (!f) return null;
        const u = mesh.material.uniforms;
        u.frame.value.set(f.x / this.oa.W, f.y / this.oa.H, f.w / this.oa.W, f.h / this.oa.H);
        mesh.scale.set(f.w, f.h, 1);
        mesh.userData.f = f;
        return f;
    }

    makeObj(name, opts) {
        const m = new THREE.Mesh(unitPlane, this.objMaterial(opts));
        this.setObjFrame(m, name);
        return m;
    }

    // ------------------------------------------------------------ per frame
    sync(w, dt, t) {
        const seen = new Set();
        for (const f of w.fighters) { seen.add(f.id); this.syncFighter(f, t); }
        for (const it of w.items) { seen.add(it.id); this.syncItem(it, t); }
        for (const pr of w.props) { seen.add(pr.id); this.syncProp(pr, t); }
        for (const pj of w.projs) { seen.add(pj.id); this.syncProj(pj, t); }
        for (const h of w.hazards) { seen.add(h.id); this.syncHazard(w, h, t); }
        for (const [id, o] of this.meshes) {
            if (!seen.has(id)) { this.group.remove(o.root); if (o.shadow) this.group.remove(o.shadow); if (o.extra) this.group.remove(o.extra); o.root.traverse((n) => { if (n.material && n.material !== this.shadowMat) n.material.dispose(); }); this.meshes.delete(id); }
        }
    }

    syncFighter(f, t) {
        let o = this.meshes.get(f.id);
        if (!o) {
            const cd = this.charData(f.sprite);
            const root = new THREE.Group();
            const mesh = new THREE.Mesh(unitPlane, this.palMaterial(cd));
            mesh.scale.set(cd.b.cw, cd.b.ch * YS, 1);
            if (f.isGhost) { mesh.material.transparent = true; mesh.material.uniforms.alpha.value = 0.6; mesh.material.depthWrite = false; }
            const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
            shadow.rotation.x = -Math.PI / 2;
            root.add(mesh); this.group.add(shadow);
            const weapon = this.makeObj('pipe'); weapon.visible = false;
            const wpivot = new THREE.Group(); wpivot.add(weapon); root.add(wpivot);
            o = { root, mesh, shadow, cd, weapon, wpivot, wtype: null };
            this.group.add(root);
            this.meshes.set(f.id, o);
        }
        const { mesh, shadow, cd } = o;
        const b = cd.b;
        // frame
        let fi;
        if (f.state === 'attack' && f.phase && b.anims[f.anim] && b.anims[f.anim].phases) fi = frameFor(b, f.anim, 0, f.phase, f.phaseT);
        else if (f.anim === 'jump' && b.anims.jump) fi = b.anims.jump.start + (f.vy > 120 ? 0 : f.vy > -120 ? 1 : 2);
        else if (f.anim === 'jump' && !b.anims.jump) fi = frameFor(b, 'fall', f.animT);
        else fi = frameFor(b, f.anim, f.animT);
        const col = fi % b.cols, rowi = Math.floor(fi / b.cols);
        const u = mesh.material.uniforms;
        u.frame.value.set(col * b.cw / b.W, rowi * b.ch / b.H, b.cw / b.W, b.ch / b.H);
        u.flip.value = f.face < 0 ? 1 : 0;
        u.row.value = b.paletteRows[f.pal] ?? 0;
        if (f.flash > 0) { const c = FLASH[f.flashColor || 0]; u.flash.value.set(c[0], c[1], c[2], f.flashColor === 2 ? 0.45 : 0.75); }
        else if (f.od > 0) u.flash.value.set(0.7, 0.5, 1, 0.12 + Math.sin(t * 20) * 0.08);
        else if (f.vulnerable && f.state === 'stunned') u.flash.value.set(1, 0.4, 0.2, 0.2 + Math.sin(t * 16) * 0.15);
        else u.flash.value.w = 0;
        // position (pixel-snapped)
        const X = Math.round(f.x), Y = Math.round(f.y), Zs = -f.z * ZS + (f.id % 7) * 0.08;
        o.root.position.set(X, Y * YS, Zs);
        mesh.position.set(0, (b.ch / 2 - 3) * YS, 0);
        // blinking while invulnerable / dying
        let vis = true;
        if (f.invuln > 0 && f.team === 'player' && f.state !== 'attack') vis = Math.floor(t * 20) % 2 === 0;
        if (f.state === 'dead' && f.team !== 'player') vis = f.deadT < 0.5 || Math.floor(t * 16) % 2 === 0;
        if (f.intangible && !f.isGhost && !f.ally) vis = false;
        o.root.visible = vis;
        // shadow
        const sw = Math.max(8, f.w * 1.3) * (f.boss ? 1.3 : 1) / (1 + f.y / 160);
        shadow.visible = vis || f.intangible;
        shadow.position.set(X, 0.4, -f.z * ZS);
        shadow.scale.set(sw, sw * 0.42 * ZS / 2.2, 1);
        // held weapon
        if (f.weapon) {
            const meta = b.frames[fi];
            if (o.wtype !== f.weapon.type) { this.setObjFrame(o.weapon, f.weapon.type); o.wtype = f.weapon.type; }
            const fr = o.weapon.userData.f;
            o.weapon.visible = true;
            o.weapon.position.set(fr.w / 2 - fr.ax, (fr.ay - fr.h / 2), 0);
            const dir = f.face;
            o.wpivot.position.set(dir * meta.hand.x, meta.hand.y * YS, 1.5);
            // mirrored facing: flip x, then rotate by -angle (scale applies before rotation)
            o.wpivot.scale.set(dir, 1, 1);
            o.wpivot.rotation.z = dir > 0 ? meta.hand.ang : -meta.hand.ang;
        } else o.weapon.visible = false;
    }

    syncItem(it, t) {
        let o = this.meshes.get(it.id);
        if (!o) {
            const m = this.makeObj(it.type, { glow: 0.5 });
            const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat); shadow.rotation.x = -Math.PI / 2;
            const root = new THREE.Group(); root.add(m); this.group.add(root); this.group.add(shadow);
            o = { root, m, shadow };
            this.meshes.set(it.id, o);
            o.root.userData.extra = shadow;
        }
        const f = o.m.userData.f;
        const bob = it.y > 0 ? 0 : Math.round(Math.sin(t * 4 + it.id) * 1.5 + 1.5);
        o.root.position.set(Math.round(it.x), (it.y + bob) * YS, -it.z * ZS + 0.5);
        o.m.position.set(0, f.h / 2, 0);
        o.m.material.uniforms.flash.value.set(1, 1, 1, (Math.sin(t * 6 + it.id) > 0.85) ? 0.5 : 0);
        o.shadow.position.set(Math.round(it.x), 0.4, -it.z * ZS);
        o.shadow.scale.set(f.w * 0.5, f.w * 0.2, 1);
        // weapons lying on the ground lie flat-ish
        if (['pipe', 'katana', 'baton', 'knives'].includes(it.type)) { o.m.rotation.z = 0.15; o.m.position.y = f.h / 2 + 1; }
    }

    syncProp(pr, t) {
        let o = this.meshes.get(pr.id);
        if (!o) {
            const m = this.makeObj(pr.type);
            const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat); shadow.rotation.x = -Math.PI / 2;
            const root = new THREE.Group(); root.add(m); this.group.add(root); this.group.add(shadow);
            o = { root, m, shadow, broken: false };
            this.meshes.set(pr.id, o);
            shadow.position.set(pr.x, 0.4, -pr.z * ZS);
            const f = m.userData.f; shadow.scale.set(f.w * 0.55, f.w * 0.22, 1);
        }
        if (pr.broken && !o.broken) { o.broken = true; this.setObjFrame(o.m, pr.type + '_x'); }
        const f = o.m.userData.f;
        const sx = pr.shakeT > 0 ? Math.round(Math.sin(t * 80) * 2) : 0;
        o.root.position.set(Math.round(pr.x) + sx, 0, -pr.z * ZS + 0.3);
        o.m.position.set(0, f.h / 2 * YS, 0);
        o.m.scale.y = f.h * YS;
        o.m.material.uniforms.flash.value.set(1, 1, 1, pr.flash > 0 ? 0.7 : (pr.fuse > 0 ? (Math.floor(t * 20) % 2) * 0.6 : 0));
    }

    syncProj(pj, t) {
        let o = this.meshes.get(pj.id);
        const name = this.projFrame(pj, t);
        if (!o) {
            const glow = ['pulse', 'pulseR', 'laser', 'bullet', 'orb', 'flame', 'swordwave', 'swordwaveG'].includes(name.replace(/\d$/, '')) ? 1 : 0;
            const m = this.makeObj(name, { glow });
            const root = new THREE.Group(); root.add(m); this.group.add(root);
            o = { root, m, name };
            this.meshes.set(pj.id, o);
        }
        if (o.name !== name) { this.setObjFrame(o.m, name); o.name = name; }
        const f = o.m.userData.f;
        o.root.visible = !(pj.delay > 0);
        const ground = pj.type === 'wave' || pj.type === 'swordwave';
        o.root.position.set(Math.round(pj.x), (ground ? 0 : pj.y) * YS, -pj.z * ZS + 1);
        o.m.position.set(0, ground ? f.h / 2 : (f.h / 2 - f.ay), 0);
        o.m.material.uniforms.flip.value = pj.vx < 0 ? 1 : 0;
        if (pj.spin) o.m.rotation.z = -t * 20 * Math.sign(pj.vx || 1);
    }

    projFrame(pj, t) {
        switch (pj.type) {
            case 'shuriken': return 'shuriken' + (Math.floor(t * 16) % 2);
            case 'flame': return 'flame' + Math.min(3, Math.floor(pj.t / pj.ttl * 4));
            case 'wave': return pj.gold ? 'waveG' : 'wave';
            case 'swordwave': return pj.gold ? 'swordwaveG' : 'swordwave';
            case 'weapon': return pj.weaponType;
            default: return pj.type;
        }
    }

    syncHazard(w, h, t) {
        let o = this.meshes.get(h.id);
        if (!o) { o = this.makeHazard(w, h); this.meshes.set(h.id, o); }
        if (o.update) o.update(h, t);
    }

    makeHazard(w, h) {
        const root = new THREE.Group();
        this.group.add(root);
        const o = { root };
        const flat = (name, opts) => { const m = this.makeObj(name, opts); m.rotation.x = -Math.PI / 2; root.add(m); return m; };
        switch (h.type) {
            case 'reticle': {
                const m = flat('reticle', { glow: 1, transparent: true });
                o.update = (hz, t) => { root.position.set(hz.x, 0.7, -hz.z * ZS); const k = Math.max(0.4, 1 - hz.t / hz.delay); m.scale.set(40 * (0.8 + k * 0.6), 16 * ZS * (0.8 + k * 0.6), 1); m.material.uniforms.alpha.value = Math.floor(t * (6 + hz.t * 10)) % 2 ? 1 : 0.4; };
                break;
            }
            case 'shadow': {
                const m = flat(h.gold ? 'shadowG' : 'shadow', { transparent: true });
                m.material.uniforms.alpha.value = 0.55;
                o.update = (hz) => { root.position.set(hz.x, 0.7, -hz.z * ZS); m.scale.set(hz.r * 2, hz.r * 0.7 * ZS, 1); };
                break;
            }
            case 'slashmark': {
                const m = this.makeObj('sparkS2', { glow: 1, transparent: true }); root.add(m);
                o.update = (hz, t) => { root.position.set(hz.x, 40, -hz.z * ZS + 2); const k = Math.min(1, hz.t / hz.delay); m.material.uniforms.alpha.value = 0.3 + k * 0.7; m.scale.set(32 * (0.5 + k), 32 * (0.5 + k), 1); m.rotation.z = hz.id; };
                break;
            }
            case 'puddle': {
                const m = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x7aff3a, transparent: true, opacity: 0.55, depthWrite: false }));
                m.rotation.x = -Math.PI / 2; root.add(m);
                o.update = (hz, t) => { root.position.set(hz.x, 0.6, -hz.z * ZS); const k = Math.min(1, hz.t * 4) * (hz.t > hz.ttl - 0.6 ? (hz.ttl - hz.t) / 0.6 : 1); m.scale.set(hz.r * k, hz.r * 0.5 * ZS * k, 1); m.material.opacity = 0.45 + Math.sin(t * 8) * 0.1; };
                break;
            }
            case 'beam': {
                const L = w.viewW + 600;
                const warn = new THREE.Mesh(new THREE.PlaneGeometry(L, 6), new THREE.MeshBasicMaterial({ color: 0xff3a6a, transparent: true, opacity: 0.5, depthWrite: false })); warn.rotation.x = -Math.PI / 2; root.add(warn);
                const beam = new THREE.Mesh(new THREE.BoxGeometry(L, 70, 12), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 40; root.add(beam);
                const core = new THREE.Mesh(new THREE.BoxGeometry(L, 30, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); core.position.y = 40; root.add(core);
                o.update = (hz, t) => {
                    root.position.set(w.camX, 0.8, -hz.z * ZS);
                    const on = hz.t >= hz.delay;
                    warn.visible = !on; beam.visible = core.visible = on;
                    warn.material.opacity = 0.3 + (Math.floor(t * 12) % 2) * 0.4; warn.scale.y = 1 + hz.t * 2;
                    if (on) { const k = 1 - (hz.t - hz.delay) / hz.dur; beam.scale.set(1, 0.4 + k * 0.8, 1); }
                };
                break;
            }
            case 'laser': {
                const depth = (w.zMax - w.zMin) * ZS + 60;
                const beam = new THREE.Mesh(new THREE.PlaneGeometry(depth, 64), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
                beam.rotation.y = Math.PI / 2; beam.position.set(0, 32, -(w.zMin + w.zMax) / 2 * ZS); root.add(beam);
                const core = new THREE.Mesh(new THREE.BoxGeometry(2, 60, depth), new THREE.MeshBasicMaterial({ color: 0xffd0d8 })); core.position.copy(beam.position); root.add(core);
                const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, depth), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.4, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.6, beam.position.z); root.add(floor);
                root.position.set(h.x, 0, 0);
                o.update = (hz, t) => {
                    beam.visible = core.visible = !!hz.active;
                    beam.material.opacity = 0.6 + Math.sin(t * 40) * 0.25;
                    floor.visible = hz.active || (hz.warning && Math.floor(t * 10) % 2 === 0);
                };
                break;
            }
            case 'steam': {
                const vent = flat('vent'); vent.scale.set(32, 12 * ZS, 1); void vent;
                root.position.set(h.x, 0.6, -h.z * ZS);
                const puffs = [];
                for (let k = 0; k < 6; k++) { const p = this.makeObj('smoke1', { transparent: true }); p.visible = false; root.add(p); puffs.push(p); }
                o.update = (hz, t) => {
                    puffs.forEach((p, k) => {
                        p.visible = !!hz.active || (hz.warning && k < 2);
                        const ph = (t * 2.2 + k / 6) % 1;
                        this.setObjFrame(p, 'smoke' + Math.min(3, Math.floor(ph * 4)));
                        p.position.set(Math.sin(k * 3 + t) * 6, 10 + ph * (hz.active ? 90 : 20), 2);
                        p.material.uniforms.alpha.value = 1 - ph;
                    });
                };
                break;
            }
            case 'forklift': {
                const m = this.makeObj('forklift'); root.add(m);
                const warn = new THREE.Mesh(new THREE.PlaneGeometry(w.viewW + 200, 20), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.4, depthWrite: false })); warn.rotation.x = -Math.PI / 2; this.group.add(warn);
                o.extra = warn;
                o.update = (hz, t) => {
                    const f = m.userData.f;
                    root.visible = hz.started;
                    root.position.set(hz.x ?? -9999, 0, -hz.z * ZS + 1);
                    m.position.set(0, f.h / 2 * YS, 0); m.scale.y = f.h * YS;
                    m.material.uniforms.flip.value = hz.dir < 0 ? 1 : 0;
                    warn.visible = hz.started && hz.t < hz.warn + 0.5;
                    warn.position.set(w.camX, 0.7, -hz.z * ZS);
                    warn.material.opacity = (Math.floor(t * 8) % 2) * 0.35 + 0.1;
                };
                break;
            }
            case 'gantry': {
                const depth = (w.zMax - w.zMin) * ZS + 80;
                const g = new THREE.Mesh(new THREE.BoxGeometry(22, 26, depth), new THREE.MeshBasicMaterial({ color: 0x4a4e5a }));
                g.position.set(0, 13, -(w.zMin + w.zMax) / 2 * ZS); root.add(g);
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(23, 6, depth + 1), new THREE.MeshBasicMaterial({ color: 0xffd23a })); stripe.position.copy(g.position); stripe.position.y = 22; root.add(stripe);
                const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); lamp.position.set(0, 30, g.position.z + depth / 2 - 10); root.add(lamp);
                o.update = (hz, t) => { root.visible = hz.started; root.position.set(hz.x ?? -9999, 0, 0); lamp.visible = Math.floor(t * 10) % 2 === 0; };
                break;
            }
            default: break;
        }
        return o;
    }

    /** Afterimage helper: a frozen, tinted copy of a fighter's current frame. */
    ghostOf(f, tint) {
        const o = this.meshes.get(f.id);
        if (!o) return null;
        const mat = o.mesh.material.clone();
        mat.uniforms.frame.value = o.mesh.material.uniforms.frame.value.clone();
        mat.uniforms.flash.value = new THREE.Vector4(tint[0], tint[1], tint[2], 0.7);
        mat.uniforms.ambient.value = this.ambient;
        mat.transparent = true; mat.depthWrite = false;
        mat.uniforms.alpha.value = 0.6;
        const m = new THREE.Mesh(unitPlane, mat);
        m.scale.copy(o.mesh.scale);
        m.position.copy(o.root.position).add(o.mesh.position);
        m.position.z -= 0.5;
        return m;
    }

    clear() {
        for (const [, o] of this.meshes) { this.group.remove(o.root); if (o.shadow) this.group.remove(o.shadow); if (o.extra) this.group.remove(o.extra); }
        this.meshes.clear();
        // stray shadows
        for (let i = this.group.children.length - 1; i >= 0; i--) this.group.remove(this.group.children[i]);
    }
}

export { WALL_Z };
