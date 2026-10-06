// Loot on the floor: small models that arc out of whatever dropped them, rarity beams, and
// clickable DOM name labels (Diablo-style, always on by default, or only while Alt is held).

import * as THREE from 'three';
import { makeWeapon, mat, mesh, disposeModel } from './fruitkit.js';
import { glowTex } from './textures.js';
import { RARITY } from '../config.js';
import { POTIONS } from '../sim/data/items.js';
import { displayName } from '../sim/items.js';

const BEAM = { magic: 0x4a8aff, rare: 0xffd84a, legendary: 0xff9a2e, quest: 0x7dffa6 };
const _v = new THREE.Vector3();

export class Loot {
    constructor(scene, layer) {
        this.scene = scene;
        this.root = new THREE.Group();
        scene.add(this.root);
        this.layer = layer;
        this.views = new Map();
        this.showAll = true;
        this.altHeld = false;
        this.onClick = null;
        this.hoverId = 0;
    }

    clear() {
        for (const v of this.views.values()) this.kill(v);
        this.views.clear();
    }
    kill(v) { this.root.remove(v.g); disposeModel(v.g); if (v.label) v.label.remove(); }

    build(gi) {
        const g = new THREE.Group();
        let label = null, color = '#ffffff', beam = null;
        if (gi.item) {
            const it = gi.item;
            const model = itemModel(it);
            model.position.y = 0.08;
            g.add(model);
            color = (RARITY[it.rarity] || RARITY.normal).color;
            if (BEAM[it.rarity]) beam = BEAM[it.rarity];
            label = `${displayName(it)}`;
        } else if (gi.sugar) {
            const sm = mat('white');
            for (let i = 0; i < Math.min(6, 2 + Math.floor(gi.sugar / 30)); i++) { const c = mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), sm, (Math.random() - 0.5) * 0.2, 0.05 + (i > 3 ? 0.09 : 0), (Math.random() - 0.5) * 0.2); c.rotation.y = Math.random() * 3; g.add(c); }
            color = '#f6f0e0'; label = `${gi.sugar} Sugar`;
        } else if (gi.potion) {
            g.add(potionModel(gi.potion));
            color = gi.potion === 'hp' ? '#ff7a8a' : gi.potion === 'juice' ? '#ffb84a' : '#e8c87a';
            label = POTIONS[gi.potion].name;
        } else if (gi.quest) {
            g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), mat('glow'), 0, 0.15, 0));
            beam = BEAM.quest; color = RARITY.quest.color; label = 'Quest item';
        }
        if (beam) {
            const tall = gi.item && gi.item.rarity === 'legendary' ? 4.5 : gi.item && gi.item.rarity === 'rare' ? 2.6 : 1.4;
            const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, tall, 10, 1, true).translate(0, tall / 2, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(beam).multiplyScalar(1.4), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            g.add(bm);
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: beam, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
            sp.scale.setScalar(0.9); sp.position.y = 0.15; g.add(sp);
            g.userData.beam = bm;
        }
        g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        let el = null;
        if (label) {
            el = document.createElement('div');
            el.className = 'loot-label';
            el.textContent = label;
            el.style.color = color;
            el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (this.onClick) this.onClick(gi.id); });
            el.addEventListener('pointerenter', () => { this.hoverId = gi.id; });
            el.addEventListener('pointerleave', () => { if (this.hoverId === gi.id) this.hoverId = 0; });
            this.layer.appendChild(el);
        }
        return { g, label: el, gi, spin: Math.random() * 6 };
    }

    sync(world, dt, time, camera, w, h, heroPos) {
        const live = new Set();
        const labels = [];
        for (const gi of world.items) {
            live.add(gi.id);
            let v = this.views.get(gi.id);
            if (!v) { v = this.build(gi); this.views.set(gi.id, v); this.root.add(v.g); }
            // Arc out of the source over 0.45 s.
            const k = Math.min(1, gi.t / 0.45);
            const x = gi.fromX + (gi.x - gi.fromX) * k, z = gi.fromY + (gi.y - gi.fromY) * k;
            const y = Math.sin(k * Math.PI) * 1.1 + (k >= 1 ? Math.abs(Math.sin(Math.min(1, (gi.t - 0.45) * 3) * Math.PI)) * 0.12 * (1 - Math.min(1, gi.t - 0.45)) : 0);
            v.g.position.set(x, y, z);
            if (k < 1) v.g.rotation.y += dt * 12; else v.g.rotation.y = v.spin;
            const vis = world.visibleTile(gi.x, gi.y) || world.town;
            v.g.visible = vis;
            if (v.g.userData.beam) v.g.userData.beam.material.opacity = 0.32 + Math.sin(time * 3 + v.spin) * 0.12;
            if (v.label) {
                const near = Math.hypot(gi.x - heroPos.x, gi.y - heroPos.y) < 13;
                const show = vis && k >= 1 && near && (this.showAll || this.altHeld || this.hoverId === gi.id);
                if (!show) { v.label.style.display = 'none'; continue; }
                _v.set(x, 0.55, z).project(camera);
                if (_v.z > 1) { v.label.style.display = 'none'; continue; }
                labels.push({ v, sx: (_v.x * 0.5 + 0.5) * w, sy: (-_v.y * 0.5 + 0.5) * h });
            }
        }
        // Stack overlapping labels upward.
        labels.sort((a, b) => b.sy - a.sy);
        const placed = [];
        for (const L of labels) {
            const el = L.v.label;
            el.style.display = 'block';
            const wid = el.offsetWidth || 80, hei = 20;
            let y = L.sy - 14;
            for (let guard = 0; guard < 12; guard++) {
                const hit = placed.find((p) => Math.abs(p.x - L.sx) < (p.w + wid) / 2 + 2 && Math.abs(p.y - y) < hei);
                if (!hit) break;
                y = hit.y - hei;
            }
            placed.push({ x: L.sx, y, w: wid });
            el.style.transform = `translate(${Math.round(L.sx - wid / 2)}px, ${Math.round(y - hei / 2)}px)`;
            el.classList.toggle('hover', this.hoverId === L.v.gi.id);
        }
        for (const [id, v] of this.views) if (!live.has(id)) { this.kill(v); this.views.delete(id); }
    }
}

export function itemModel(it) {
    const g = new THREE.Group();
    const R = it.rarity === 'legendary' ? mat('gold') : null;
    switch (it.slot) {
        case 'weapon': case 'offhand': {
            const w = makeWeapon(it);
            const fam = w.userData.family;
            if (['potlid', 'pietin', 'board', 'wok', 'pouch', 'gumball', 'globe'].includes(fam)) { w.rotation.set(fam === 'board' ? -Math.PI / 2 : 0, 0, 0); w.position.y = 0.05; }
            else { w.rotation.set(Math.PI / 2, 0, Math.PI / 4); w.position.set(0, 0.04, 0); }
            g.add(w);
            break;
        }
        case 'head': { const d = mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), R || mat('steel')); g.add(d); break; }
        case 'body': { g.add(mesh(new THREE.BoxGeometry(0.4, 0.08, 0.36), R || mat('cloth'))); g.add(mesh(new THREE.BoxGeometry(0.62, 0.07, 0.12), R || mat('cloth'), 0, 0, -0.12)); break; }
        case 'hands': { for (const sx of [-1, 1]) { const m = mesh(new THREE.SphereGeometry(0.1, 10, 8), R || mat('glove'), sx * 0.12, 0.05, 0); m.scale.set(1, 0.6, 1.3); g.add(m); } break; }
        case 'feet': { for (const sx of [-1, 1]) { const m = mesh(new THREE.SphereGeometry(0.1, 10, 8), R || mat('shoe'), sx * 0.12, 0.06, 0); m.scale.set(1, 0.75, 1.6); g.add(m); } break; }
        case 'ring': { const r = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), mat('gold'), 0, 0.03, 0); r.rotation.x = Math.PI / 2; g.add(r); g.add(mesh(new THREE.OctahedronGeometry(0.05), mat('glowPink'), 0, 0.06, 0.1)); break; }
        case 'neck': { const r = mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 20), mat('gold'), 0, 0.02, 0); r.rotation.x = Math.PI / 2; g.add(r); g.add(mesh(new THREE.OctahedronGeometry(0.06), mat('glowBlue'), 0, 0.04, 0.16)); break; }
    }
    return g;
}

export function potionModel(kind) {
    const g = new THREE.Group();
    if (kind === 'pie') {
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.08, 16), mat('bread'), 0, 0.05, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16), mat('red'), 0, 0.1, 0));
        return g;
    }
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.24, 12), mat('glass'), 0, 0.12, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.17, 12), new THREE.MeshStandardMaterial({ color: kind === 'hp' ? 0xd8102a : 0xff8a10, roughness: 0.2, emissive: kind === 'hp' ? 0x400008 : 0x401800 }), 0, 0.09, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), kind === 'hp' ? mat('red') : mat('white'), 0, 0.26, 0));
    return g;
}
