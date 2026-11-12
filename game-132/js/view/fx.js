// Effects: projectiles, ground rings (red for monster telegraphs, the mastery colour for the player's), lightning
// arcs, beams, novas, sparks, loot on the floor with rarity beams, gold and health globes. Reads G; never writes it.

import * as THREE from 'three';
import { RARITIES } from '../sim/data/items.js';

const EL = { phys: 0xffe8c0, lightning: 0x8ad8ff, shadow: 0xb070ff, fire: 0xff8a30, cold: 0x7ae0ff };
const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class Fx {
    constructor(view) {
        this.view = view;
        this.scene = view.scene;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.shots = new Map(); this.zones = new Map(); this.drops = new Map();
        this.temp = [];            // { obj, t, life, update(k) }
        this.geo = {
            orb: new THREE.SphereGeometry(1, 10, 8), ring: new THREE.RingGeometry(0.86, 1, 40), disc: new THREE.CircleGeometry(1, 32),
            beam: new THREE.CylinderGeometry(0.12, 0.12, 6, 8, 1, true), gem: new THREE.OctahedronGeometry(0.22), coin: new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10),
        };
        this.whirl = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 6, 30), add(0xffb070, 0.6));
        this.whirl.rotation.x = -Math.PI / 2; this.whirl.position.y = 0.9; this.whirl.visible = false;
        this.tempest = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 30), add(0x5cc8ff, 0.25));
        this.tempest.rotation.x = -Math.PI / 2; this.tempest.position.y = 2.5; this.tempest.visible = false;
        this.root.add(this.whirl, this.tempest);
    }

    resetArea() {
        for (const m of [this.shots, this.zones, this.drops]) { for (const o of m.values()) this.root.remove(o); m.clear(); }
        for (const t of this.temp) this.root.remove(t.obj);
        this.temp.length = 0;
    }

    spawn(obj, life, update) { this.root.add(obj); this.temp.push({ obj, t: 0, life, update }); }

    ringAt(x, y, r, color, life = 0.4, grow = true) {
        const m = new THREE.Mesh(this.geo.ring, add(color, 0.8));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, y);
        this.spawn(m, life, (k) => { const s = grow ? r * (0.3 + 0.7 * k) : r; m.scale.setScalar(s); m.material.opacity = 0.8 * (1 - k); });
    }

    line(points, color, life = 0.18, width = 1) {
        const g = new THREE.BufferGeometry().setFromPoints(points);
        const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: width }));
        this.spawn(m, life, (k) => { m.material.opacity = 1 - k; if (k >= 1) g.dispose(); });
    }

    bolt(x0, y0, h0, x1, y1, h1, color) {
        const pts = [], n = 8;
        for (let i = 0; i <= n; i++) {
            const k = i / n, j = i && i < n ? 0.35 : 0;
            pts.push(new THREE.Vector3(x0 + (x1 - x0) * k + (Math.random() - 0.5) * j, h0 + (h1 - h0) * k + (Math.random() - 0.5) * j, y0 + (y1 - y0) * k + (Math.random() - 0.5) * j));
        }
        this.line(pts, color, 0.2);
        this.flash(x1, y1, color, 0.6);
    }

    flash(x, y, color, r = 0.8, h = 0.9) {
        const m = new THREE.Mesh(this.geo.orb, add(color, 0.9));
        m.position.set(x, h, y);
        this.spawn(m, 0.22, (k) => { m.scale.setScalar(r * (0.5 + k)); m.material.opacity = 0.9 * (1 - k); });
    }

    sparks(x, y, color, n = 6, h = 1) {
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(this.geo.orb, add(color, 1));
            const a = Math.random() * 6.28, sp = 2 + Math.random() * 3, up = 1 + Math.random() * 2;
            m.position.set(x, h, y); m.scale.setScalar(0.06);
            this.spawn(m, 0.35, (k) => { m.position.set(x + Math.cos(a) * sp * k, h + up * k - 4 * k * k, y + Math.sin(a) * sp * k); m.material.opacity = 1 - k; });
        }
    }

    onEvents(G, events) {
        const P = G.player;
        for (const e of events) {
            switch (e.type) {
                case 'hit': this.sparks(e.x, e.y, EL[e.el] ?? 0xffffff, e.crit ? 9 : 4); break;
                case 'arc': this.bolt(e.x0, e.y0, 1.0, e.x1, e.y1, 1.0, 0x9ae0ff); break;
                case 'beam': this.line([new THREE.Vector3(e.x0, 1.1, e.y0), new THREE.Vector3(e.x1, 1.0, e.y1)], 0xc890ff, 0.15); this.flash(e.x1, e.y1, 0xb070ff, 0.5); break;
                case 'bolt': this.bolt(e.x, e.y, 9, e.x, e.y, 0, 0xc8f0ff); this.ringAt(e.x, e.y, 1.2, 0x8ad8ff, 0.3); break;
                case 'nova': this.ringAt(e.x, e.y, e.r, EL[e.el] ?? 0xffd890, 0.45); this.flash(e.x, e.y, EL[e.el] ?? 0xffd890, Math.min(2, e.r * 0.4), 0.4); break;
                case 'leap': this.ringAt(e.x, e.y, 2.8, 0xffa060, 0.5); break;
                case 'blink': this.flash(e.x0, e.y0, 0x8a5aff, 1.0); this.flash(e.x, e.y, 0x8a5aff, 1.0); break;
                case 'zone': this.ringAt(e.x, e.y, e.r, e.from === 'mon' ? 0xff3a20 : (EL[e.el] ?? 0xffffff), 0.5, false); this.flash(e.x, e.y, e.from === 'mon' ? 0xff5020 : (EL[e.el] ?? 0xffffff), e.r * 0.6, 0.3); if (e.kind === 'thunderstrike') this.bolt(e.x, e.y, 12, e.x, e.y, 0, 0xe0f8ff); break;
                case 'curse': this.ringAt(e.x, e.y, e.r, 0xa040ff, 0.8, false); break;
                case 'kill': this.sparks(e.x, e.y, e.elite ? 0xffd84a : 0xc0a080, e.elite ? 14 : 6, 0.6); break;
                case 'levelup': { const m = new THREE.Mesh(this.geo.beam, add(0xffd870, 0.6)); m.position.set(P.x, 3, P.y); m.scale.set(5, 1, 5); this.spawn(m, 1.2, (k) => { m.material.opacity = 0.6 * (1 - k); m.position.set(P.x, 3, P.y); }); break; }
                case 'potion': this.ringAt(P.x, P.y, 1.2, 0xff6060, 0.6); break;
                case 'waystone': case 'portal': this.ringAt(P.x, P.y, 2, 0x5ab0ff, 0.7); break;
                case 'shade': this.flash(e.x, e.y, 0xa77bff, 1.0); break;
                case 'raise': this.flash(e.x, e.y, 0x7a50a0, 0.8, 0.3); break;
                case 'petSpell': if (e.spell === 'howl') this.ringAt(e.x, e.y, 5, 0xffb060, 0.6); else if (e.spell === 'mend') this.ringAt(P.x, P.y, 1.4, 0x60ff90, 0.6); break;
            }
        }
    }

    frame(G, dt, time) {
        const P = G.player;
        // transient effects
        for (let i = this.temp.length - 1; i >= 0; i--) {
            const t = this.temp[i];
            t.t += dt;
            const k = Math.min(1, t.t / t.life);
            t.update(k);
            if (k >= 1) { this.root.remove(t.obj); this.temp.splice(i, 1); }
        }
        // projectiles
        const seen = new Set();
        for (const b of G.shots) {
            seen.add(b.id);
            let o = this.shots.get(b.id);
            if (!o) {
                const c = b.from === 'mon' ? (b.kind === 'bone' ? 0xe0d0ff : b.el === 'shadow' ? 0xb050ff : b.el === 'fire' ? 0xff7a30 : b.el === 'cold' ? 0x60e0ff : 0xffb060) : EL[b.el];
                o = new THREE.Mesh(this.geo.orb, add(c, 0.95));
                o.scale.setScalar(b.kind === 'bonespear' ? 0.28 : b.r * 0.9);
                if (b.kind === 'bonespear') o.scale.z = 1.2;
                this.root.add(o); this.shots.set(b.id, o);
            }
            o.position.set(b.x, b.from === 'mon' ? 1.0 : 1.1, b.y);
            o.rotation.y = Math.PI / 2 - Math.atan2(b.vy, b.vx);
        }
        for (const [id, o] of this.shots) if (!seen.has(id)) { this.root.remove(o); this.shots.delete(id); }
        // ground rings
        seen.clear();
        for (const z of G.zones) {
            seen.add(z.id);
            let o = this.zones.get(z.id);
            if (!o) {
                o = new THREE.Group();
                const col = z.from === 'mon' ? 0xff2a10 : (EL[z.el] ?? 0xffffff);
                const edge = new THREE.Mesh(this.geo.ring, add(col, 0.8));
                const fill = new THREE.Mesh(this.geo.disc, add(col, 0.25));
                edge.rotation.x = fill.rotation.x = -Math.PI / 2;
                o.add(edge, fill);
                o.userData = { fill, t0: z.t };
                this.root.add(o); this.zones.set(z.id, o);
            }
            o.position.set(z.x, 0.05, z.y);
            o.children[0].scale.setScalar(z.r);
            const k = 1 - Math.max(0, z.t) / Math.max(0.01, o.userData.t0);
            o.userData.fill.scale.setScalar(Math.max(0.01, z.r * k));
        }
        for (const [id, o] of this.zones) if (!seen.has(id)) { this.root.remove(o); this.zones.delete(id); }
        // loot on the floor
        seen.clear();
        for (const d of G.drops) {
            seen.add(d.id);
            let o = this.drops.get(d.id);
            if (!o) {
                o = new THREE.Group();
                if (d.gold) { for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(this.geo.coin, new THREE.MeshStandardMaterial({ color: 0xffc840, emissive: 0x6a4a00, metalness: 0.6, roughness: 0.3 })); c.position.set((i - 1) * 0.12, 0.05 + i * 0.05, (i % 2) * 0.1); o.add(c); } }
                else if (d.globe) { const g = new THREE.Mesh(this.geo.orb, new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xc01020, emissiveIntensity: 1.2 })); g.scale.setScalar(0.25); g.position.y = 0.4; o.add(g); }
                else {
                    const it = G.items[d.item];
                    const r = RARITIES[it?.rarity] || RARITIES.common;
                    const gem = new THREE.Mesh(this.geo.gem, new THREE.MeshStandardMaterial({ color: r.hex, emissive: r.hex, emissiveIntensity: it?.rarity === 'common' ? 0.1 : 0.7 }));
                    gem.position.y = 0.3; o.add(gem);
                    o.userData.gem = gem;
                    if (r.beam) { const b = new THREE.Mesh(this.geo.beam, add(r.hex, 0.35)); b.position.y = 3; o.add(b); o.userData.beam = b; }
                }
                this.root.add(o); this.drops.set(d.id, o);
            }
            o.position.set(d.x, 0, d.y);
            if (o.userData.gem) { o.userData.gem.rotation.y = time * 2; o.userData.gem.position.y = 0.3 + Math.sin(time * 3 + d.id) * 0.06; }
            if (o.userData.beam) o.userData.beam.material.opacity = 0.22 + Math.sin(time * 4 + d.id) * 0.08;
        }
        for (const [id, o] of this.drops) if (!seen.has(id)) { this.root.remove(o); this.drops.delete(id); }
        // the player's channel and storm
        this.whirl.visible = !!P.channel;
        if (P.channel) { this.whirl.position.set(P.x, 0.9, P.y); this.whirl.rotation.z = time * 18; }
        const tp = P.buffs.find((b) => b.k === 'tempest');
        this.tempest.visible = !!tp;
        if (tp) { this.tempest.position.set(P.x, 2.6, P.y); this.tempest.rotation.z = time * 2; }
    }
}
