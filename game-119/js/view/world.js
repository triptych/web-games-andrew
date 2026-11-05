// The overworld diorama: the painted continent, towns of little painted buildings, the roads, and the
// merchant's wagon trundling along them. Town names and travel buttons are DOM (see ui.js); this positions them.

import * as THREE from 'three';
import { TOWNS, TOWN, REGIONS } from '../sim/data/towns.js';
import { REGION_LEVEL } from '../config.js';
import { EXT, PPU, paintWorld, heightAt, scatter, roadPoint, landField, SHORE } from './terrain.js';
import { building, tree, bush, rock, tuft, mountain, wagon, BIOME } from './props.js';
import { chibi, MERCHANT } from './chars.js';
import { canvas, ctx2, rad, alpha, cached as memo } from './paint.js';
import { hash3 } from '../rng.js';

const CLUSTER = {
    meadow: ['house', 'house', 'shop', 'house'], river: ['house', 'alchemist', 'house', 'house'], hills: ['smithy', 'house', 'house', 'stable'],
    hub: ['guild', 'shop', 'inn', 'smithy', 'house', 'house'], forest: ['elf', 'inn', 'house', 'stable'], port: ['shop', 'inn', 'tower', 'house'],
    forge: ['smithy', 'smithy', 'tower', 'house'], desert: ['dome', 'shop', 'dome', 'dome'], elven: ['elf', 'alchemist', 'elf', 'elf'],
    snow: ['long', 'tower', 'long', 'house'], ash: ['tower', 'smithy', 'house', 'long'], royal: ['guild', 'tower', 'inn', 'shop', 'house'], star: ['tower', 'alchemist', 'dome', 'tower'],
};
const OFFS = [[0, -0.8], [-3.9, 0.6], [3.9, 0.5], [-1.8, 2.3], [2.0, 2.4], [-6.2, -1.6], [6.2, -1.4]];

export class World {
    constructor(stage) {
        this.stage = stage;
        this.scene = new THREE.Scene();
        this.towns = {};          // id -> { group, mist, pos }
        this.ready = false;
        this.wagonGroup = null;
        this.wagonTier = -1;
        this.shimmer = null;
        this.mistLv = -1;
    }

    build() {
        const st = this.stage, scene = this.scene;
        // ---- terrain
        const cv = paintWorld();
        const tex = st.texture(cv);
        const segX = 174, segZ = 132;
        const geo = new THREE.PlaneGeometry(EXT.w, EXT.h, segX, segZ);
        geo.rotateX(-Math.PI / 2);
        geo.translate(EXT.x0 + EXT.w / 2, 0, EXT.z0 + EXT.h / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
        geo.computeVertexNormals();
        const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
        const L = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
        for (let i = 0; i < pos.count; i++) {
            const d = nrm.getX(i) * L.x + nrm.getY(i) * L.y + nrm.getZ(i) * L.z;
            const s = pos.getY(i) < -0.3 ? 1 : 0.78 + 0.34 * d;
            col[i * 3] = s * 1.02; col[i * 3 + 1] = s; col[i * 3 + 2] = s * 0.98;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
        st.litMats.add(mat);
        this.terrain = new THREE.Mesh(geo, mat);
        scene.add(this.terrain);
        // ---- sea shimmer: scrolling sparkle texture, additive, just above the sea floor
        const sh = canvas(256, 256), sc = ctx2(sh);
        for (let i = 0; i < 90; i++) { const x = hash3(i, 1, 3) * 256, y = hash3(i, 2, 3) * 256, w = 6 + hash3(i, 3, 3) * 18; sc.strokeStyle = `rgba(255,255,255,${0.25 + hash3(i, 4, 3) * 0.4})`; sc.lineWidth = 2; sc.lineCap = 'round'; sc.beginPath(); sc.moveTo(x - w, y); sc.quadraticCurveTo(x, y - 3, x + w, y); sc.stroke(); }
        const shTex = st.texture(sh); shTex.wrapS = shTex.wrapT = THREE.RepeatWrapping; shTex.repeat.set(EXT.w / 9, EXT.h / 9);
        const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
        this.shimmer = new THREE.Mesh(new THREE.PlaneGeometry(EXT.w, EXT.h), shMat);
        this.shimmer.rotation.x = -Math.PI / 2;
        this.shimmer.position.set(EXT.x0 + EXT.w / 2, -0.28, EXT.z0 + EXT.h / 2);
        scene.add(this.shimmer);
        // ---- scenery
        const mk = (cvs, key, wu, x, z, y = null) => {
            const m = st.sprite(cvs, wu, { key });
            m.position.set(x, y ?? Math.max(0, heightAt(x, z)), z);
            scene.add(m);
            return m;
        };
        const cache = {};
        const cached = (k, f) => (cache[k] ||= f());
        for (const d of scatter()) {
            if (d.kind === 'tree') mk(cached('t' + d.type + d.seed, () => tree(d.type, d.seed + 1)), `tree-${d.type}-${d.seed}`, 2.5 * d.s, d.x, d.z);
            else if (d.kind === 'bush') mk(cached('b' + d.seed + d.flower, () => bush(d.seed, '#5aa048', d.flower ? '#f08aa8' : null)), `bush-${d.seed}-${d.flower}`, 2.3 * d.s, d.x, d.z);
            else if (d.kind === 'rock') mk(cached('r' + d.seed, () => rock(d.seed)), `rock-${d.seed}`, 2.2 * d.s, d.x, d.z);
            else if (d.kind === 'tuft') mk(cached('u' + d.seed, () => tuft(d.seed)), `tuft-${d.seed}`, 1.6 * d.s, d.x, d.z);
            else if (d.kind === 'mountain') mk(cached('m' + d.seed + d.snow, () => mountain(d.seed, d.snow, d.snow ? '#8a8a9c' : '#8a7a68')), `mtn-${d.seed}-${d.snow}`, 11 * d.s / 8 * 1.25, d.x, d.z, -0.2);
        }
        // ---- towns
        for (const T of TOWNS) {
            const g = new THREE.Group();
            g.position.set(T.x, Math.max(0.3, heightAt(T.x, T.z)), T.z);
            const kinds = CLUSTER[T.biome];
            kinds.forEach((k, i) => {
                const b = building(k, T.biome, (T.x * 3 + i) | 0, null);
                const w = k === 'guild' ? 5.2 : k === 'tower' ? 3.4 : 4.2;
                const s = st.sprite(b.cv, w, { key: `b-${k}-${T.biome}-${i}` });
                const [ox, oz] = OFFS[i];
                s.position.set(ox, 0, oz);
                g.add(s);
                const gl = st.glowOf(b.gl, w, s);
                g.add(gl);
            });
            // a few trees and a banner pole
            const treeCv = cached('t' + BIOME[T.biome].tree + 1, () => tree(BIOME[T.biome].tree, 2));
            for (const [ox, oz] of [[-6.8, 1.2], [6.8, 1.6], [-3.2, 3.6]]) { const t = st.sprite(treeCv, 3, { key: `tree-${BIOME[T.biome].tree}-1` }); t.position.set(ox, 0, oz); g.add(t); }
            scene.add(g);
            // the mist that hides regions you cannot enter yet
            const mc = canvas(256, 256), mx = ctx2(mc);
            mx.fillStyle = rad(mx, 128, 128, 0, 124, [[0, 'rgba(240,244,250,0.96)'], [0.6, 'rgba(226,232,244,0.82)'], [1, 'rgba(226,232,244,0)']]);
            mx.fillRect(0, 0, 256, 256);
            for (let i = 0; i < 14; i++) { mx.fillStyle = `rgba(255,255,255,${0.12 + hash3(i, 1, 9) * 0.15})`; mx.beginPath(); mx.arc(40 + hash3(i, 2, 9) * 176, 60 + hash3(i, 3, 9) * 140, 18 + hash3(i, 4, 9) * 24, 0, 7); mx.fill(); }
            const mmat = new THREE.MeshBasicMaterial({ map: st.texture(mc), transparent: true, depthWrite: false, opacity: 0.94 });
            const mist = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), mmat);
            mist.rotation.x = -(Math.PI / 2 - 0.18);
            mist.position.set(T.x, 2.6, T.z + 0.8);
            mist.renderOrder = 50;
            scene.add(mist);
            // a flat disc to click
            this.towns[T.id] = { group: g, mist, pos: new THREE.Vector3(T.x, g.position.y, T.z) };
        }
        // ---- the wagon
        this.wagonGroup = new THREE.Group();
        this.merchantSprite = st.sprite(memo('merchant', () => chibi(MERCHANT)), 2.2, { key: 'merchant' });
        this.merchantSprite.position.set(-2.8, 0, 0.6);
        this.wagonGroup.add(this.merchantSprite);
        scene.add(this.wagonGroup);
        this.setWagonTier(0);
        this.ready = true;
    }

    setWagonTier(tier) {
        if (tier === this.wagonTier) return;
        this.wagonTier = tier;
        if (this.cartSprite) this.wagonGroup.remove(this.cartSprite);
        this.cartSprite = this.stage.sprite(memo(`wagon-${tier}`, () => wagon(tier)), 4.6 + tier * 0.4, { key: `wagon-${tier}` });
        this.cartSprite.position.set(0.2, 0, 0);
        this.wagonGroup.add(this.cartSprite);
    }

    /** Dim regions the merchant's level has not opened. */
    setLocks(lv) {
        if (lv === this.mistLv) return;
        this.mistLv = lv;
        for (const T of TOWNS) {
            const open = lv >= REGION_LEVEL[T.region];
            this.towns[T.id].mist.visible = !open;
        }
    }

    update(G, dt, time, showAll = false) {
        if (!this.ready) return;
        this.setLocks(showAll ? 99 : G.lv);
        this.setWagonTier(G.wagon);
        const wg = this.wagonGroup;
        if (G.travel) {
            const tr = G.travel;
            const f = Math.max(0, Math.min(1, tr.prog / tr.total));
            const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
            const p = roadPoint(tr.from, tr.to, e), p2 = roadPoint(tr.from, tr.to, Math.min(1, e + 0.02));
            const y = Math.max(0.1, heightAt(p.x, p.z));
            wg.position.set(p.x, y + Math.abs(Math.sin(time * 9)) * 0.09, p.z);
            const dir = p2.x - p.x;
            if (Math.abs(dir) > 0.0005) wg.scale.x += (Math.sign(dir) * -1 - wg.scale.x) * Math.min(1, dt * 8);
            this.moving = true;
        } else {
            const T = TOWN[G.loc];
            const y = Math.max(0.3, heightAt(T.x, T.z));
            wg.position.set(T.x - 0.4, y, T.z + 3.3);
            wg.scale.x += (-1 - wg.scale.x) * Math.min(1, dt * 8);
            this.moving = false;
        }
        this.shimmer.material.map.offset.set((time * 0.02) % 1, (time * 0.013) % 1);
        this.shimmer.material.opacity = 0.4 + Math.sin(time * 0.6) * 0.12;
    }
}
