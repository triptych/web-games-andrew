// A town street: painted buildings standing in a lit diorama, villagers and visiting heroes idling in front of them.
// Each venue (market, workshop, notice board, inn, guild, the Hero's tent, the road out) is a clickable place;
// the buttons themselves are DOM (ui.js) and are positioned from the points this scene reports.

import * as THREE from 'three';
import { TOWN, HERO_CLASSES } from '../sim/data/towns.js';
import { heroTownFor } from '../sim/quest.js';
import { building, tree, bush, rock, tuft, mountain, barrel, crate, lamp, well, fountain, signpost, BIOME } from './props.js';
import { chibi, npcLook, heroLook, KAELEN, MERCHANT } from './chars.js';
import { wagon } from './props.js';
import { canvas, ctx2, rad, alpha, lighten, darken, mix, hex, rnd, brush, P, paint, cached } from './paint.js';
import { hash3 } from '../rng.js';
import { fbm } from './terrain.js';

const WIDE = {
    market: [-4.5, -3.0, 4.3], workshop: [4.5, -3.0, 4.3], board: [0, -3.5, 2.9], inn: [-9, -2.6, 4.5], guild: [9, -2.6, 4.6],
    hero: [-7.6, 2.4, 4.3], travel: [7.0, 2.1, 1.8],
};
const NARROW = {
    market: [-2.5, -7.0, 4.5], workshop: [2.6, -7.0, 4.5], inn: [-2.5, -2.4, 4.7], guild: [2.7, -2.4, 4.8],
    board: [-2.6, 2.6, 3.1], hero: [2.9, 2.6, 4.4], travel: [0.2, 6.6, 1.9],
};

function paintGround(biome, seed) {
    const B = BIOME[biome] || BIOME.meadow;
    const W = 1400, H = 900;
    const cv = canvas(W, H), c = ctx2(cv);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, B.ground2); g.addColorStop(1, B.ground);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = rnd(seed + 5);
    c.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
        const x = r() * W, y = r() * H, a = -0.8 + (r() - 0.5) * 0.9, len = 8 + r() * 26;
        c.strokeStyle = r() < 0.5 ? alpha(lighten(B.ground, 0.25), 0.08 + r() * 0.1) : alpha(darken(B.ground2, 0.2), 0.07 + r() * 0.08);
        c.lineWidth = 3 + r() * 6;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
    }
    // a paved street and plaza
    const stone = hex(B.stone);
    const plaza = new Path2D();
    plaza.ellipse(W / 2, H * 0.5, W * 0.36, H * 0.22, 0, 0, Math.PI * 2);
    c.fillStyle = `rgb(${stone[0]},${stone[1]},${stone[2]})`; c.globalAlpha = 0.55; c.fill(plaza); c.globalAlpha = 1;
    c.save(); c.clip(plaza);
    for (let i = 0; i < 7200; i++) {
        const x = r() * W, y = H * 0.2 + r() * H * 0.6, w = 9 + r() * 9, h = 6 + r() * 4;
        const t = r();
        c.fillStyle = t < 0.5 ? alpha(lighten(B.stone, 0.15 + r() * 0.2), 0.8) : alpha(darken(B.stone, 0.05 + r() * 0.2), 0.8);
        c.beginPath(); c.roundRect(x, y, w, h, 3); c.fill();
        c.strokeStyle = alpha('#3b2417', 0.2); c.lineWidth = 1.2; c.stroke();
    }
    c.restore();
    // the road out, running to the south edge
    c.fillStyle = alpha('#d8bc86', 0.9);
    c.beginPath(); c.moveTo(W * 0.42, H * 0.62); c.quadraticCurveTo(W * 0.46, H * 0.85, W * 0.38, H); c.lineTo(W * 0.62, H); c.quadraticCurveTo(W * 0.56, H * 0.85, W * 0.58, H * 0.62); c.closePath(); c.fill();
    c.strokeStyle = alpha('#3b2417', 0.3); c.lineWidth = 3; c.stroke();
    return cv;
}
function glowDot() {
    const cv = canvas(128, 128), c = ctx2(cv);
    c.fillStyle = rad(c, 64, 64, 0, 62, [[0, 'rgba(255,214,130,0.95)'], [0.35, 'rgba(255,180,80,0.45)'], [1, 'rgba(255,160,60,0)']]);
    c.fillRect(0, 0, 128, 128);
    return cv;
}

export class TownScene {
    constructor(stage) {
        this.stage = stage;
        this.scene = null;
        this.venues = [];
        this.npcs = [];
        this.wide = true;
        this.townId = null;
        this.hover = null;
        this.owned = [];
    }

    dispose() {
        if (!this.scene) return;
        for (const o of this.owned) o.dispose?.();
        this.owned = [];
        this.scene = null;
    }

    /** Build the street for G.loc. */
    build(G, aspect) {
        this.dispose();
        const st = this.stage;
        const T = TOWN[G.loc];
        this.townId = T.id;
        this.wide = aspect >= 1.1;
        const L = this.wide ? WIDE : NARROW;
        const scene = this.scene = new THREE.Scene();
        const B = BIOME[T.biome];
        const seed = (T.x * 11 + T.z) | 0;
        // ---- ground
        const gtex = st.texture(cached(`ground-${T.id}`, () => paintGround(T.biome, seed)));
        this.owned.push(gtex);
        const gmat = new THREE.MeshBasicMaterial({ map: gtex });
        st.litMats.add(gmat);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 41.6), gmat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, 0, -2);
        scene.add(ground);
        this.owned.push(gmat, ground.geometry);
        // ---- backdrop: a tree line and distant mountains
        const put = (cvs, key, w, x, z, y = 0) => { const m = st.sprite(cvs, w, { key }); m.position.set(x, y, z); scene.add(m); return m; };
        const tkey = B.tree === 'dead' ? 'dead' : B.tree;
        const far = this.wide ? [-26, 26] : [-12, 12];
        for (let i = 0; i < (this.wide ? 22 : 12); i++) {
            const x = far[0] + (i / (this.wide ? 21 : 11)) * (far[1] - far[0]) + (hash3(i, 1, 3) - 0.5) * 1.5;
            put(cached(`tree-${tkey}-${i % 5}`, () => tree(tkey, i % 5 + 1)), `tree-${tkey}-${i % 5}`, 4.4 + hash3(i, 2, 3) * 1.6, x, -13.5 - hash3(i, 4, 3) * 1.5);
        }
        for (let i = 0; i < 4; i++) put(cached(`mtn-${i}-${T.biome}`, () => mountain(i + 1, T.region >= 3 || T.biome === 'snow', T.biome === 'ash' ? '#6a5a58' : '#8a8a9c')), `mtn-${i}-${T.biome}`, 22, -24 + i * 16, -19, -0.5);
        // ---- venues
        const venues = [];
        const add = (id, kind, label, icon, extra = {}) => {
            const [x, z, w] = L[id];
            const b = cached(`tb-${kind}-${T.biome}-${seed}-${id}`, () => building(kind, T.biome, seed + id.length, icon));
            const s = st.sprite(b.cv, w, { key: `tb-${kind}-${T.biome}-${seed}-${id}` });
            s.position.set(x, 0, z);
            scene.add(s);
            const gl = st.glowOf(b.gl, w, s);
            scene.add(gl);
            venues.push({ id, label, icon, x, z, w, sprite: s, h: s.userData.h, ...extra });
            return s;
        };
        const shops = T.shops.length;
        add('market', T.biome === 'desert' || T.biome === 'port' ? 'stall' : 'shop', 'Market', 'basket');
        const st0 = Object.keys(T.stations);
        const wkind = T.stations.smithy ? 'smithy' : T.stations.alchemist ? 'alchemist' : 'house';
        add('workshop', wkind, 'Workshops', st0.length ? 'anvil' : 'pot');
        add('board', 'board', 'Notice Board', 'scroll');
        add('inn', 'inn', 'Inn & Heroes', 'mug');
        if (T.guild) add('guild', 'guild', 'Guild House', 'coins');
        else { const [x, z, w] = L.guild; const h = st.sprite(cached(`house-${T.biome}-${seed}`, () => building('house', T.biome, seed + 3)).cv, w * 0.8, { key: `house-${T.biome}-${seed}` }); h.position.set(x, 0, z); scene.add(h); }
        const heroHere = heroTownFor(G) === T.id && !G.ending;
        if (heroHere) add('hero', 'tent', "Hero's Tent", 'star');
        // the road out
        {
            const [x, z, w] = L.travel;
            const s = st.sprite(cached('signpost', () => signpost(1)), w, { key: 'signpost' });
            s.position.set(x, 0, z);
            scene.add(s);
            venues.push({ id: 'travel', label: 'Leave Town', icon: 'pack', x, z, w, sprite: s, h: s.userData.h });
        }
        // ---- props: lamps, barrels, crates, a well or fountain
        const lampMat = new THREE.MeshBasicMaterial({ map: st.texture(cached('glowdot', glowDot)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
        st.glowMats.add(lampMat); this.owned.push(lampMat);
        const lamps = this.wide ? [[-2.3, -0.6], [2.3, -0.6], [-11, 0.6], [11, 0.6]] : [[-4.6, 1.0], [4.6, 1.0], [-4.8, -4.8], [4.8, -4.8]];
        for (const [x, z] of lamps) {
            put(cached('lamp', () => lamp(1)), 'lamp', 0.9, x, z);
            const gm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), lampMat);
            gm.position.set(x, 2.55, z + 0.1); gm.rotation.x = -0.45; scene.add(gm);
        }
        const mk = venues.find((v) => v.id === 'market'), wk = venues.find((v) => v.id === 'workshop');
        put(cached('barrel', () => barrel(1)), 'barrel', 0.9, mk.x + 2.4, mk.z + 1.1); put(cached('crate', () => crate(1)), 'crate', 0.95, mk.x - 2.3, mk.z + 1.2);
        put(cached('barrel', () => barrel(1)), 'barrel', 0.9, wk.x - 2.4, wk.z + 1.2); put(cached('crate', () => crate(1)), 'crate', 0.95, wk.x + 2.4, wk.z + 1.0);
        if (this.wide) { const fnt = ['hub', 'royal', 'desert'].includes(T.biome); put(cached(fnt ? 'fountain' : 'well', () => (fnt ? fountain(1) : well(1))), fnt ? 'fountain' : 'well', 2.5, 0, 1.3); }
        const bc = cached('bush-town', () => bush(2, '#5aa048', '#f08aa8'));
        for (const [x, z] of (this.wide ? [[-12.5, 2.2], [12.4, 2.6], [-14, -1], [14.5, -0.6]] : [[-5, 7.8], [5, 7.6], [-5.2, 1.8], [5.2, -6.8]])) put(bc, 'bush-town', 2.2, x, z);
        for (const [x, z] of (this.wide ? [[-13.5, -3], [13.8, -2.8], [-12, 5], [12, 5.2]] : [[-5.4, -9], [5.4, -9], [-5.5, 4.6], [5.5, 5]])) put(cached(`tree-${tkey}-2`, () => tree(tkey, 3)), `tree-${tkey}-2`, 3.4, x, z);
        // ---- people
        const npcs = [];
        const person = (key, look, x, z, w = 1.75, phase = 0) => {
            const s = st.sprite(cached(key, () => chibi(look)), w, { key });
            s.position.set(x, 0, z);
            scene.add(s);
            npcs.push({ s, x, z, phase, base: w });
            return s;
        };
        const bd = venues.find((v) => v.id === 'board');
        person(`npc-${T.id}-0`, npcLook(T.npcs[0][1], T.npcs[0][0]), bd.x + 1.9, bd.z + 1.6, 1.75, 0.3);
        person(`npc-${T.id}-1`, npcLook(T.npcs[1][1], T.npcs[1][0]), mk.x - 0.4, mk.z + 2.0, 1.75, 1.1);
        person(`npc-${T.id}-2`, npcLook(T.npcs[2][1], T.npcs[2][0]), wk.x + 0.6, wk.z + 2.1, 1.75, 2.0);
        const inn = venues.find((v) => v.id === 'inn');
        G.towns[T.id].heroes.filter((h) => h.wants.some((w) => !w.done)).slice(0, 3).forEach((h, i) => {
            person(`hero-${h.cls}-${h.look}`, heroLook(h.cls, h.look), inn.x + 1.4 + i * 1.5, inn.z + 2.3 + (i % 2) * 0.35, 1.95, i);
        });
        if (heroHere) {
            const t = venues.find((v) => v.id === 'hero');
            const k = person('kaelen', KAELEN, t.x + 1.7, t.z + 2.1, 2.15, 0.5);
            const gl = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: st.texture(cached('glowdot', glowDot)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
            gl.position.set(k.position.x, 1.4, k.position.z - 0.05); gl.rotation.x = -0.5; scene.add(gl);
            this.owned.push(gl.material);
        }
        // the player's wagon, parked
        const wg = new THREE.Group();
        wg.position.set(this.wide ? -2.6 : -3.2, 0, this.wide ? 3.6 : 7.4);
        const cart = st.sprite(cached(`wagon-${G.wagon}`, () => wagon(G.wagon)), 3.5 + G.wagon * 0.3, { key: `wagon-${G.wagon}` });
        const me = st.sprite(cached('merchant', () => chibi(MERCHANT)), 1.75, { key: 'merchant' });
        me.position.set(-2.0, 0, 0.5);
        wg.add(cart); wg.add(me);
        wg.scale.x = -1;
        scene.add(wg);
        this.wagon = wg; this.wagonTier = G.wagon;
        this.venues = venues;
        this.npcs = npcs;
        this.G = G;
        return venues;
    }

    setHover(id) {
        this.hover = id;
    }

    update(G, dt, time) {
        if (!this.scene) return;
        for (const n of this.npcs) {
            const b = Math.sin(time * 2.1 + n.phase * 2.3);
            n.s.position.y = Math.max(0, b) * 0.05;
            n.s.scale.y = 1 + b * 0.012;
        }
        for (const v of this.venues) {
            const target = this.hover === v.id ? 1.045 : 1;
            v.sprite.scale.x += (target - v.sprite.scale.x) * Math.min(1, dt * 12);
            v.sprite.scale.y = v.sprite.scale.x;
        }
    }

    /** Where each venue's button goes: world points to project. */
    points() {
        return this.venues.map((v) => ({ id: v.id, label: v.label, icon: v.icon, x: v.x, y: 0.15, z: v.z + 0.4 }));
    }
    /** The camera framing for this layout. */
    framing() {
        return this.wide ? { x: 0, z: -0.4, dist: 27 } : { x: 0, z: -0.6, dist: 33 };
    }
}
