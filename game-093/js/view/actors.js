// Billboard actors: every person and monster is a flat pixel sprite standing upright in the 3D world. They cast shadows
// shaped like themselves (alpha-tested depth), take light from the scene, and can flash, dissolve and tint.

import * as THREE from 'three';
import { LEVEL_H } from '../config.js';
import { CHARS } from '../sim/data/classes.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { blobTexture, iconTexture } from './sprites.js';

const PX = 1 / 32;                        // world units per sprite pixel on the field
const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
let blobTex = null;
/** Fraction of a sprite's height that is empty below its lowest opaque pixel (cached on the texture). */
function footPad(tex) {
    if (!tex) return 0;
    const ud = tex.userData || (tex.userData = {});
    if (ud.pad !== undefined) return ud.pad;
    const c = tex.image;
    let pad = 0;
    try {
        if (c && c.getContext) {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let last = -1;
            for (let y = c.height - 1; y >= 0 && last < 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { last = y; break; }
            pad = last < 0 ? 0 : (c.height - 1 - last) / c.height;
        }
    } catch { /* tainted or unreadable: leave as is */ }
    return (ud.pad = pad);
}
const _dir = new THREE.Vector3();
const icons = {};

export class Billboard {
    constructor(opts = {}) {
        this.w = opts.w || 1; this.h = opts.h || 1.5;
        this.uniforms = { uDissolve: { value: 0 }, uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uTint: { value: new THREE.Color(1, 1, 1) } };
        const mat = new THREE.MeshLambertMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color(0x303038) });
        const u = this.uniforms;
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uDissolve = u.uDissolve; sh.uniforms.uFlash = u.uFlash; sh.uniforms.uTint = u.uTint;
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDissolve; uniform vec4 uFlash; uniform vec3 uTint;')
                .replace('#include <map_fragment>', `#include <map_fragment>
if (uDissolve > 0.0) {
  float nz = fract(sin(dot(floor(vMapUv * vec2(48.0, 64.0)), vec2(12.9898, 78.233))) * 43758.5453);
  float edge = nz - uDissolve * 1.15;
  if (edge < 0.0) discard;
  diffuseColor.rgb += smoothstep(0.1, 0.0, edge) * vec3(2.4, 1.1, 0.35);
}
diffuseColor.rgb *= uTint;`)
                .replace('#include <opaque_fragment>', `outgoingLight = mix(outgoingLight, uFlash.rgb * 1.6, uFlash.a);
#include <opaque_fragment>`);
        };
        this.mat = mat;
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = opts.shadow !== false; this.mesh.receiveShadow = false;
        this.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
        this.mesh.customDepthMaterial = this.depth;
        this.group = new THREE.Group();
        this.group.add(this.mesh);
        if (!blobTex) blobTex = blobTexture();
        this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: opts.blob ?? 0.9 }));
        this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.03; this.blob.renderOrder = 1;
        this.group.add(this.blob);
        this.flip = 1;
        this.set(opts.tex, opts.w, opts.h);
    }
    set(tex, w, h) {
        if (w) this.w = w; if (h) this.h = h;
        if (tex && tex !== this.tex) {
            this.tex = tex; this.mat.map = tex; this.mat.emissiveMap = tex; this.depth.map = tex; this.mat.needsUpdate = true; this.depth.needsUpdate = true;
        }
        this.mesh.scale.set(this.w * this.flip, this.h, 1);
        // sink the mesh by the transparent rows under the feet, so the sprite stands on the ground instead of hovering
        this.mesh.position.y = -footPad(this.tex) * this.h;
        const b = Math.max(0.7, this.w * 0.8);
        this.blob.scale.set(b, b * 0.7, 1);
    }
    setFlip(f) { this.flip = f; this.mesh.scale.x = this.w * f; }
    /** Stand at (x, y, z) facing the camera. The plane leans back by the camera's pitch so it is parallel to the screen: upright
     *  on the picture, not just upright in the world (a world-vertical plane splays outward at the top when seen from above). */
    place(x, y, z, yaw) {
        this.group.position.set(x, y, z);
        const cam = Billboard.cam;
        let pitch = 0;
        if (cam) { cam.getWorldDirection(_dir); pitch = Math.asin(Math.max(-1, Math.min(1, -_dir.y))); }
        this.mesh.rotation.set(-pitch * Billboard.lean, yaw, 0, 'YXZ');
    }
    flash(a, r = 1, g = 1, b = 1) { this.uniforms.uFlash.value.set(r, g, b, a); }
    dispose() { this.mat.dispose(); this.depth.dispose(); this.blob.geometry.dispose(); this.blob.material.dispose(); }
}

Billboard.cam = null; Billboard.lean = 1;

/** Ground height under a point, blended between tile centres so walking up a step is a ramp, not a pop. */
export function groundY(map, x, z) {
    const W = map.w, H = map.h, hg = map.hgt;
    const fx = x - 0.5, fz = z - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const g = (a, b) => hg[Math.max(0, Math.min(H - 1, b)) * W + Math.max(0, Math.min(W - 1, a))];
    const c = Math.floor(z) * W + Math.floor(x), h0 = hg[Math.max(0, Math.min(W * H - 1, c))];
    const sm = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    const a = [g(x0, z0), g(x0 + 1, z0), g(x0, z0 + 1), g(x0 + 1, z0 + 1)].map((v) => (Math.abs(v - h0) > 1 ? h0 : v));
    return sm(sm(a[0], a[1], tx), sm(a[2], a[3], tx), tz) * LEVEL_H;
}

export function icon(kind) { return icons[kind] || (icons[kind] = iconTexture(kind)); }

const HERO_W = 1.0, HERO_H = 1.5;

/** The people and monsters of the field scene. */
export class Actors {
    constructor(scene, lib) {
        this.scene = scene; this.lib = lib;
        this.group = new THREE.Group(); scene.add(this.group);
        this.bills = new Map();     // key → { bill, kind, ... }
        this.marks = new Map();
        this.alerts = new Map();
    }
    clear() { for (const b of this.bills.values()) { this.group.remove(b.bill.group); b.bill.dispose(); } this.bills.clear(); for (const m of this.marks.values()) this.group.remove(m); this.marks.clear(); }

    get(key, make) {
        let e = this.bills.get(key);
        if (!e) { e = make(); this.bills.set(key, e); this.group.add(e.bill.group); }
        e.seen = true;
        return e;
    }

    markSprite(key, kind, x, y, z, time) {
        let m = this.marks.get(key + kind);
        if (!m) {
            m = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(kind), depthTest: false, transparent: true })); m.scale.set(0.5, 0.5, 1); m.renderOrder = 5;
            this.group.add(m); this.marks.set(key + kind, m);
        }
        m.visible = true; m.position.set(x, y + Math.sin(time * 4 + x) * 0.07, z); m.userData.seen = true;
    }

    /** facing frame for a world direction seen from a camera at yaw `yaw` */
    frameFor(dir, yaw, f) {
        const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dz = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
        const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const sx = dx * rx + dz * rz, sy = dx * fx + dz * fz;
        if (Math.abs(sx) > Math.abs(sy)) return { name: 'side' + f, flip: sx < 0 ? -1 : 1 };
        return { name: (sy > 0 ? 'up' : 'down') + f, flip: 1 };
    }

    sync(G, map, st) {
        const { yaw, time, marks } = st;
        for (const e of this.bills.values()) e.seen = false;
        for (const m of this.marks.values()) m.userData.seen = false;
        const walkF = [0, 1, 2, 1];
        const frameIdx = (anim, moving) => (moving ? walkF[Math.floor(anim / 0.34) % 4] : 1);
        const placeHero = (key, look, x, z, dir, anim, moving, scale = 1, extra = {}) => {
            const e = this.get(key, () => ({ bill: new Billboard({ w: HERO_W, h: HERO_H }), look }));
            const fr = this.frameFor(dir, yaw, frameIdx(anim, moving));
            const bob = moving ? Math.abs(Math.sin(anim * 9)) * 0.04 : Math.sin(time * 2 + x) * 0.012;
            e.bill.set(this.lib.hero(look, fr.name), HERO_W * scale, HERO_H * scale);
            e.bill.setFlip(fr.flip);
            const gy = groundY(map, x, z);
            e.bill.place(x, gy + bob - 0.06, z, yaw);
            e.bill.group.visible = true;
            return e;
        };
        // the party in a line behind the leader, following the trail
        const party = G.party.active;
        party.forEach((id, i) => {
            const look = CHARS[id].look;
            let x = G.px, z = G.py, dir = G.dir;
            if (i > 0) {
                const t = G.trail[Math.min(G.trail.length - 1, i * 7)];
                if (t) { x = t[0]; z = t[1]; dir = t[2]; } else { x = G.px; z = G.py + 0.0001 * i; }
            }
            const moving = i === 0 ? G.moving : G.moving || Math.hypot(G.px - x, G.py - z) > 0.4;
            if (i > 0 && !G.trail.length) { x = G.px; z = G.py; }
            placeHero('p:' + id, look, x, z, dir, G.anim - i * 0.3, moving);
        });
        // villagers and story characters
        for (const n of map.npcs) {
            if (n.kind === 'boss') {
                const spr = ENEMIES[n.enemy];
                const m = this.lib.monster(spr.sprite, n.pal || spr.pal);
                const e = this.get('n:' + n.id, () => ({ bill: new Billboard({ w: 2, h: 2 }) }));
                const s = (1 + (spr.scale - 1) * 0.3) * PX * 1.1;
                e.bill.set(m.tex, m.w * s, m.h * s);
                e.bill.setFlip(-1);
                e.bill.place(n.x, groundY(map, n.x, n.y) + Math.sin(time * 1.6) * 0.05, n.y, yaw);
                e.bill.group.visible = true;
                if (spr.boss) this.markSprite('n:' + n.id, 'alert', n.x, groundY(map, n.x, n.y) + m.h * s + 0.4, n.y, time);
                continue;
            }
            const look = n.char ? CHARS[n.char].look : n.look;
            if (!look) continue;
            const sc = look.build === 'child' ? 0.78 : look.build === 'old' ? 0.95 : 1;
            placeHero('n:' + n.id, look, n.x, n.y, n.dir || 'down', (G.t * 1.2 + n.hx), !!n.moving, sc);
            const mk = marks?.[n.id];
            if (mk) this.markSprite('n:' + n.id, mk, n.x, groundY(map, n.x, n.y) + HERO_H * sc + 0.3, n.y, time);
        }
        // wandering monsters: a shadow of the party they are about to fight
        for (const m of map.mobs) {
            const first = ENEMIES[m.form[0].kind];
            const mono = this.lib.monster(first.sprite, first.pal);
            const e = this.get('m:' + m.id, () => ({ bill: new Billboard({ w: 1, h: 1 }) }));
            const s = PX * (0.8 + (first.scale - 1) * 0.3) * 0.95;
            e.bill.set(mono.tex, mono.w * s, mono.h * s);
            const rx = Math.cos(yaw), rz = -Math.sin(yaw);
            const dxs = (m.dir === 'left' ? -1 : m.dir === 'right' ? 1 : 0) * rx + (m.dir === 'up' ? -1 : m.dir === 'down' ? 1 : 0) * rz;
            e.bill.setFlip(m.state === 'chase' ? (G.px > m.x ? 1 : -1) * Math.sign(rx || 1) : (dxs < 0 ? -1 : 1));
            e.bill.place(m.x, groundY(map, m.x, m.y) + 0.05 + Math.abs(Math.sin(time * (m.state === 'chase' ? 12 : 4) + m.hx)) * (m.state === 'chase' ? 0.12 : 0.05), m.y, yaw);
            e.bill.uniforms.uTint.value.setScalar(m.state === 'chase' ? 1.15 : 1);
            e.bill.group.visible = true;
            if (m.alert > 0) this.markSprite('m:' + m.id, 'alert', m.x, groundY(map, m.x, m.y) + mono.h * s + 0.35, m.y, time);
        }
        for (const [k, e] of this.bills) if (!e.seen) { this.group.remove(e.bill.group); e.bill.dispose(); this.bills.delete(k); }
        for (const [k, m] of this.marks) if (!m.userData.seen) m.visible = false;
    }
}
