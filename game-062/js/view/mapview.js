// The world map: a floating-island diorama. The four ground realms sit round a central peak, the
// Royal Clubhouse at the south shore, and the Sky Citadel floats above the summit, reached by a beam
// once Cinder Caldera is cleared. Pip walks the path between flag nodes; tilt-shift sells the miniature.

import * as THREE from 'three';
import { toonMat, toonMesh, part, merge, sph, cyl, cone, box, tor, ico, paint, gradientMap, withOutline } from './toon.js';
import { treeGeo, windmillMesh, decorMesh } from './props.js';
import { buildHumanoid, buildWedgewick, heroLook } from './chars.js';
import { setPose, animate, animateWedge } from './anim.js';
import { PALETTES } from './palette.js';
import { HOLES } from '../sim/holes.js';
import { LOOKS, OUTFITS } from '../sim/rpg.js';
import { fbm } from '../rng.js';

const PI = Math.PI;
const SECT = [[0.55, 1.75], [1.85, 3.05], [3.2, 4.4], [4.55, 5.75]];   // realm angle ranges (radians from +z toward +x)
const R0 = 52;

// Node 0 is the clubhouse; nodes 1..20 are the holes in order.
export function nodeLayout() {
    const nodes = [{ kind: 'club', x: 0, y: 0, z: R0 + 8 }];
    for (const h of HOLES) {
        const i = +h.id.split('-')[1] - 1, r = h.realm;
        if (r < 4) {
            const [a0, a1] = SECT[r];
            const a = a0 + (a1 - a0) * (0.1 + 0.8 * (i / 3));
            const rad = R0 + (i % 2 ? -7 : 5);
            nodes.push({ kind: h.boss ? 'boss' : 'hole', hole: h, x: Math.sin(a) * rad, y: 0, z: Math.cos(a) * rad });
        } else {
            const a = PI * 0.6 + i * 1.2;
            nodes.push({ kind: h.boss ? 'boss' : 'hole', hole: h, x: Math.sin(a) * 15, y: 0, z: Math.cos(a) * 15, sky: true });
        }
    }
    return nodes;
}

function islandHeight(x, z) {
    const r = Math.hypot(x, z);
    const a = (Math.atan2(x, z) + PI * 2) % (PI * 2);
    let h = 2.2 + fbm(x * 0.05, z * 0.05, 3, 3) * 2.2;
    h += Math.max(0, 1 - r / 30) ** 1.6 * 26;                       // the central peak
    if (a > SECT[2][0] - 0.1 && a < SECT[2][1] + 0.1) h += Math.max(0, 1 - Math.abs(r - 64) / 22) * 7 * (0.6 + 0.4 * Math.sin(a * 9)); // frost hills
    const vx = Math.sin(5.1) * 70, vz = Math.cos(5.1) * 70;            // the volcano
    const dv = Math.hypot(x - vx, z - vz);
    h += Math.max(0, 1 - dv / 18) * 16 - Math.max(0, 1 - dv / 4) * 6;
    if (a > SECT[1][0] - 0.1 && a < SECT[1][1] + 0.1) h += Math.sin(x * 0.2) * Math.cos(z * 0.18) * 1.2; // dunes
    h *= Math.min(1, Math.max(0, (96 - r) / 10));                      // shore
    return h - Math.max(0, r - 90) * 0.8;
}

function regionColor(x, z, h, out) {
    const r = Math.hypot(x, z);
    const a = (Math.atan2(x, z) + PI * 2) % (PI * 2);
    let col = '#6cbd42';
    if (a > SECT[0][0] - 0.15 && a < SECT[0][1] + 0.1) col = '#78c84a';
    else if (a > SECT[1][0] - 0.1 && a < SECT[1][1] + 0.1) col = '#ecc47a';
    else if (a > SECT[2][0] - 0.1 && a < SECT[2][1] + 0.1) col = '#eef4fc';
    else if (a > SECT[3][0] - 0.1 && a < SECT[3][1] + 0.1) col = '#4a3a38';
    if (h > 14) col = h > 22 ? '#ffffff' : '#9a8a7a';
    if (r > 88) col = '#f2dca2';
    out.set(col);
    return out;
}

export class MapView {
    constructor(R, sky, fx) {
        this.R = R; this.sky = sky; this.fx = fx;
        this.root = new THREE.Group();
        this.nodes = nodeLayout();
        this.built = false;
        this.cur = 0;
        this.walk = null;
    }

    build(profile) {
        if (this.built) { this.root.visible = true; this.setHero(profile); return; }
        this.built = true;
        const root = this.root;
        this.R.scene.add(root);
        // ---- island
        const seg = 140, size = 220;
        const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-PI / 2);
        const pos = g.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const h = islandHeight(x, z);
            pos.setY(i, h);
            regionColor(x, z, h, c);
            const k = 0.94 + fbm(x * 0.3, z * 0.3, 9, 2) * 0.12;
            col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        const island = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3) }));
        island.receiveShadow = true;
        root.add(island);
        // underside of the floating island
        const under = new THREE.Mesh(new THREE.ConeGeometry(97, 70, 28, 4).rotateX(PI), new THREE.MeshToonMaterial({ color: '#8a7a6a', gradientMap: gradientMap(3) }));
        under.position.y = -36;
        root.add(under);
        // sea of cloud below, and a ring of water at the shore
        const water = new THREE.Mesh(new THREE.RingGeometry(84, 100, 64).rotateX(-PI / 2), new THREE.MeshToonMaterial({ color: '#4ab8e8', transparent: true, opacity: 0.85, gradientMap: gradientMap(2) }));
        water.position.y = 0.6;
        root.add(water);
        // ---- realm dressing
        const P = PALETTES;
        const trees = [];
        let s = 7;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        const styles = ['oak', 'palm', 'pine', 'spire'];
        for (let r = 0; r < 4; r++) {
            const [a0, a1] = SECT[r];
            for (let i = 0; i < 26; i++) {
                const a = a0 + rnd() * (a1 - a0), rad = 30 + rnd() * 54;
                if (Math.abs(rad - R0) < 9) continue;
                const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
                trees.push({ x, z, y: islandHeight(x, z), s: 0.9 + rnd() * 0.5, style: r === 1 && rnd() < 0.5 ? 'cactus' : styles[r], pal: r });
            }
        }
        const byStyle = new Map();
        for (const t of trees) { const k = t.style + t.pal; if (!byStyle.has(k)) byStyle.set(k, []); byStyle.get(k).push(t); }
        for (const [, list] of byStyle) {
            const geo = treeGeo(list[0].style, P[list[0].pal]);
            const im = new THREE.InstancedMesh(geo, toonMat({ vertexColors: true }), list.length);
            const m4 = new THREE.Matrix4();
            list.forEach((t, i) => { m4.compose(new THREE.Vector3(t.x, t.y - 0.2, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s)); im.setMatrixAt(i, m4); });
            im.castShadow = true;
            root.add(im);
        }
        const place = (m, a, rad, rot = 0, sc = 1) => { const x = Math.sin(a) * rad, z = Math.cos(a) * rad; m.position.set(x, islandHeight(x, z), z); m.rotation.y = rot; m.scale.setScalar(sc); root.add(m); return m; };
        this.mill = place(windmillMesh(), 1.15, 70, 2.5, 0.7);
        for (let i = 0; i < 4; i++) place(decorMesh('sheep', P[0]), 0.8 + i * 0.12, 34 + i * 2, i, 1.2);
        place(decorMesh('cottage', P[0]), 1.5, 72, 0.4, 1.1);
        // pyramid
        const pyr = toonMesh([part(new THREE.ConeGeometry(12, 13, 4), '#e8cf94', [0, 6.5, 0], [0, PI / 4, 0])], { outline: 0.1 });
        place(pyr, 2.45, 74);
        place(decorMesh('tent', P[1]), 2.1, 36, 1, 1.4);
        place(decorMesh('camel', P[1]), 2.2, 38, 2, 1.4);
        place(decorMesh('igloo', P[2]), 3.5, 72, 0.2, 1.4);
        place(decorMesh('snowman', P[2]), 3.9, 36, 0.4, 1.5);
        // volcano glow
        const lava = new THREE.Mesh(new THREE.CircleGeometry(3.6, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb040' }));
        lava.position.set(Math.sin(5.1) * 70, islandHeight(Math.sin(5.1) * 70, Math.cos(5.1) * 70) + 0.4, Math.cos(5.1) * 70);
        root.add(lava);
        this.volcano = lava.position.clone();
        place(decorMesh('forge', P[3]), 4.9, 38, 0.8, 1.4);
        // ---- the Royal Clubhouse with the Golden Tee
        const ch = toonMesh([
            part(box(12, 6, 8), '#fff2dc', [0, 3, 0]),
            part(new THREE.ConeGeometry(9, 4.5, 4), '#3a6ac8', [0, 8.2, 0], [0, PI / 4, 0], [1, 1, 0.75]),
            ...[-1, 1].map((sx) => part(cyl(2, 2.2, 10, 10), '#fff2dc', [sx * 6.5, 5, 0])),
            ...[-1, 1].map((sx) => part(cone(2.6, 4, 10), '#3a6ac8', [sx * 6.5, 12, 0])),
            part(box(2.4, 3.6, 0.3), '#7a4a2a', [0, 1.8, 4.1]),
            ...[-1, 1].map((sx) => part(box(1.6, 1.6, 0.3), '#8ad0ff', [sx * 3.5, 3.6, 4.1])),
        ], { outline: 0.12 });
        const cn = this.nodes[0];
        ch.position.set(cn.x, islandHeight(cn.x, cn.z - 13), cn.z - 13);
        ch.rotation.y = 0;
        root.add(ch);
        const tee = toonMesh([part(cyl(0.6, 0.25, 3, 10), '#ffd040', [0, 1.5, 0]), part(cyl(1.4, 1.4, 0.3, 14), '#ffd040', [0, 3.1, 0])], { outline: 0.06, emissive: '#a06000', emissiveIntensity: 0.6 });
        tee.position.set(cn.x + 7, islandHeight(cn.x + 7, cn.z - 3), cn.z - 3);
        root.add(tee);
        this.tee = tee;
        // ---- the Sky Citadel
        const cit = new THREE.Group();
        cit.position.set(0, 52, 0);
        const ci = toonMesh([
            part(new THREE.CylinderGeometry(22, 4, 14, 14, 1), '#8a7aa8', [0, -7, 0]),
            part(new THREE.CylinderGeometry(22.5, 22.5, 1.2, 24), '#7ad88a', [0, 0, 0]),
            part(cyl(3, 3.6, 16, 10), '#f4eefc', [0, 8, -4]),
            part(cone(4, 7, 10), '#8a4ae8', [0, 19.5, -4]),
            ...[0, 1, 2, 3, 4, 5].map((i) => part(cyl(0.7, 0.7, 6, 8), '#f4eefc', [Math.sin(i * 1.05) * 19, 3, Math.cos(i * 1.05) * 19])),
        ], { outline: 0.12 });
        cit.add(ci);
        // dressing: an arch over the path, statues, little gardens, cloud tufts round the rim
        const arch = decorMesh('arch', P[4]); arch.position.set(0, 0.6, 6); arch.scale.setScalar(1.1); cit.add(arch);
        for (const [x, z, r] of [[-12, -6, 0.6], [12, -6, -0.6], [-8, 12, 2.4], [8, 12, -2.4]]) { const st = decorMesh('statue', P[4]); st.position.set(x, 0.6, z); st.rotation.y = r; cit.add(st); }
        const tufts = [];
        for (let i = 0; i < 18; i++) { const a = (i / 18) * PI * 2; tufts.push(part(sph(2.2 + (i % 3) * 0.6, 10, 8), '#ffffff', [Math.sin(a) * 22, -1.6 - (i % 2), Math.cos(a) * 22])); }
        cit.add(toonMesh(tufts, { outline: 0.06, shadow: false, emissive: '#d8c8ff', emissiveIntensity: 0.25 }));
        const beds = [];
        for (let i = 0; i < 40; i++) { const a = i * 2.39, r = 4 + (i % 9) * 1.9; beds.push(part(sph(0.35, 6, 5), P[4].flowers[i % 3], [Math.sin(a) * r, 0.75, Math.cos(a) * r])); }
        cit.add(toonMesh(beds, { outline: false, shadow: false }));
        root.add(cit);
        this.citadel = cit;
        // ---- path stones and node flags
        for (const n of this.nodes) {
            if (n.sky) { n.y = 52.6; n.x += 0; }
            else n.y = islandHeight(n.x, n.z);
        }
        // a beam of light from the last Caldera hole up to the Citadel
        const a16 = this.nodes[16], a17 = this.nodes[17];
        const from = new THREE.Vector3(a16.x, a16.y, a16.z), to = new THREE.Vector3(a17.x, a17.y, a17.z);
        const len = from.distanceTo(to);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.6, len, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe8ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.copy(from).lerp(to, 0.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        root.add(beam);
        this.beam = beam;
        const stones = [];
        for (let i = 0; i < this.nodes.length - 1; i++) {
            const a = this.nodes[i], b = this.nodes[i + 1];
            if (a.sky !== b.sky) continue;
            const d = Math.hypot(b.x - a.x, b.z - a.z);
            const n = Math.floor(d / 2.4);
            for (let k = 1; k < n; k++) {
                const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
                const y = a.sky ? 52.7 : islandHeight(x, z) + 0.1;
                stones.push(part(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 7), '#f4ecd8', [x, y, z]));
            }
        }
        root.add(toonMesh(stones, { outline: 0.05, shadow: false }));
        this.flags = this.nodes.map((n, i) => {
            if (n.kind === 'club') return null;
            const grp = new THREE.Group();
            grp.add(toonMesh([part(cyl(0.12, 0.12, n.kind === 'boss' ? 6 : 4, 6), '#f4f4f4', [0, n.kind === 'boss' ? 3 : 2, 0]), part(cyl(1.2, 1.4, 0.4, 12), '#8a7a6a', [0, 0.2, 0])], { outline: 0.05 }));
            const flag = new THREE.Mesh(new THREE.PlaneGeometry(n.kind === 'boss' ? 2.6 : 1.8, n.kind === 'boss' ? 1.8 : 1.2), new THREE.MeshToonMaterial({ color: '#ffffff', side: THREE.DoubleSide, gradientMap: gradientMap(3) }));
            flag.position.set(n.kind === 'boss' ? 1.35 : 0.95, n.kind === 'boss' ? 5.0 : 3.3, 0);
            grp.add(flag);
            grp.userData.flag = flag;
            if (n.kind === 'boss') { const sk = toonMesh([part(sph(0.5, 10, 8), '#ffd040')], { outline: 0.05, emissive: '#806000' }); sk.position.y = 6.3; grp.add(sk); }
            grp.position.set(n.x, n.y, n.z);
            root.add(grp);
            return grp;
        });
        // marker over the selected node
        this.marker = toonMesh([part(cone(0.9, 1.6, 4), '#ffd040', [0, 0, 0], [PI, 0, 0])], { outline: 0.06, emissive: '#806000', emissiveIntensity: 0.6 });
        root.add(this.marker);
        this.heroRig = null;
        this.setHero(profile);
    }

    setHero(profile) {
        if (this.heroRig) { this.root.remove(this.heroRig.root); this.root.remove(this.wedge.root); }
        const look = LOOKS[profile.look] ?? LOOKS[0];
        this.heroRig = buildHumanoid(heroLook(look, OUTFITS[profile.outfit] ?? OUTFITS[0]));
        this.heroRig.root.scale.setScalar(2.6);
        setPose(this.heroRig, 'idle');
        this.root.add(this.heroRig.root);
        this.wedge = buildWedgewick();
        this.wedge.root.scale.setScalar(2.2);
        this.root.add(this.wedge.root);
        this.cur = Math.min(profile.node ?? 0, this.nodes.length - 1);
        const n = this.nodes[this.cur];
        this.heroRig.root.position.set(n.x, n.y, n.z + (n.kind === 'club' ? 0 : 2.2));
    }

    hide() { this.root.visible = false; }

    // node state: 0 locked, 1 open, 2 cleared
    refresh(profile, unlocked) {
        this.nodes.forEach((n, i) => {
            const f = this.flags[i];
            if (!f) return;
            const rec = profile.holes[n.hole.id];
            const col = !unlocked(i) ? '#8a8098' : rec ? (rec.stars >= 3 ? '#ffd040' : rec.stars === 2 ? '#7ad06a' : '#6ab0ff') : '#ff5a5a';
            f.userData.flag.material.color.set(col);
            f.visible = !n.sky || unlocked(i) || i === 17;
        });
        const skyOpen = unlocked(17);
        this.beam.visible = skyOpen;
    }

    walkTo(i, onArrive) {
        if (i === this.cur) { onArrive?.(); return; }
        const from = this.nodes[this.cur], to = this.nodes[i];
        // walk node by node along the path
        const pts = [];
        const step = i > this.cur ? 1 : -1;
        for (let k = this.cur; k !== i + step; k += step) pts.push(this.nodes[k]);
        this.walk = { pts, k: 0, t: 0, onArrive, target: i };
        setPose(this.heroRig, 'walk');
        void from; void to;
    }

    // screen-space pick: returns the node index under (px, py) or -1
    pick(px, py, w, h) {
        const v = new THREE.Vector3();
        let best = -1, bd = 46 * 46;
        this.nodes.forEach((n, i) => {
            v.set(n.x, n.y + 2, n.z).project(this.R.camera);
            if (v.z > 1) return;
            const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
            const d = (sx - px) ** 2 + (sy - py) ** 2;
            if (d < bd) { bd = d; best = i; }
        });
        return best;
    }

    update(dt, t, dir) {
        const H = this.heroRig;
        if (!H) return;
        if (this.mill) this.mill.userData.hub.rotation.z = -t * 0.8;
        this.tee.rotation.y = t * 0.8;
        this.citadel.position.y = 52 + Math.sin(t * 0.5) * 0.6;
        this.beam.material.opacity = 0.25 + Math.sin(t * 2) * 0.08;
        if (Math.random() < dt * 6) this.fx.burst('lava', this.volcano.x, this.volcano.y + 1, this.volcano.z, 1, { colors: ['#ffb040', '#ff6a2a'], speed: 2, up: 3, life: 1.5, size: 0.8, additive: true, g: 3 });
        // walking
        if (this.walk) {
            const W = this.walk;
            const a = W.pts[W.k], b = W.pts[W.k + 1];
            if (!b) {
                this.cur = W.target; this.walk = null; setPose(H, 'idle');
                W.onArrive?.();
            } else if (a.sky !== b.sky) {
                // ride the beam up (or down)
                W.t += dt * 0.9;
                const u = Math.min(1, W.t);
                H.root.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(u * PI) * 6, a.z + (b.z - a.z) * u);
                if (u >= 1) { W.k++; W.t = 0; }
            } else {
                const d = Math.hypot(b.x - a.x, b.z - a.z);
                W.t += (dt * 14) / Math.max(1, d);
                const u = Math.min(1, W.t);
                const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
                H.root.position.set(x, a.sky ? 52.6 + Math.sin(t * 0.5) * 0.6 : islandHeight(x, z), z);
                H.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
                if (u >= 1) { W.k++; W.t = 0; }
            }
        } else {
            const n = this.nodes[this.cur];
            if (n.sky) H.root.position.y = 52.6 + Math.sin(t * 0.5) * 0.6;
            H.root.rotation.y += (Math.atan2(dir.cam.position.x - H.root.position.x, dir.cam.position.z - H.root.position.z) - H.root.rotation.y) * Math.min(1, dt * 2);
        }
        animate(H, dt, t);
        const wr = this.wedge.root;
        wr.position.lerp(new THREE.Vector3(H.root.position.x + 2.6, H.root.position.y + 4.2, H.root.position.z + 1), Math.min(1, dt * 3));
        wr.rotation.y = Math.atan2(dir.cam.position.x - wr.position.x, dir.cam.position.z - wr.position.z);
        animateWedge(this.wedge, dt, t);
        const sel = this.nodes[this.sel ?? this.cur];
        this.marker.position.set(sel.x, sel.y + (sel.kind === 'boss' ? 8.6 : sel.kind === 'club' ? 16 : 6.2) + Math.sin(t * 4) * 0.4, sel.z);
        this.marker.rotation.y = t * 2;
        // camera: high and angled, looking at the hero from the outside of the island
        const hp = H.root.position;
        const out = Math.atan2(hp.x, hp.z);
        const r = 46;
        const sky = hp.y > 30;
        dir.mode = 'focus';
        dir.focusAt = new THREE.Vector3(hp.x, hp.y + 2, hp.z);
        const ox = sky ? Math.sin(0.4) : Math.sin(out), oz = sky ? Math.cos(0.4) : Math.cos(out);
        dir.focusFrom = new THREE.Vector3(hp.x + ox * r * (sky ? 1.25 : 1), hp.y + (sky ? 30 : 34), hp.z + oz * r * (sky ? 1.25 : 1));
        dir.k = 2.5;
    }
}
