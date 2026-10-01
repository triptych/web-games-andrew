/**
 * gems.js — procedural gem models. Each type has a distinct silhouette as well as a
 * colour (ruby, raindrop, emerald, lightning bolt, skull, coin, star, prism) so the
 * board reads for colour-blind players and on small phones.
 *
 * makeGem(type, special) → THREE.Group (unit cell = 1). Geometries and materials are
 * shared per type; specials add overlay children.
 */

import * as THREE from 'three';
import { G, SP } from '../sim/data.js';

const geo = {}, mat = {};
let clipPlanes = [];
let ready = false;

export const GEM_COLORS = [0xff3b3b, 0x2f9bff, 0x35d86a, 0xffd23a, 0xf4efe6, 0xffb52e, 0xb46bff, 0xffffff];

function starShape(points, outer, inner) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 ? inner : outer;
        const a = Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    return s;
}

function boltShape() {
    const s = new THREE.Shape();
    const pts = [[0.12, 0.46], [-0.22, 0.02], [-0.02, 0.02], [-0.14, -0.46], [0.24, 0.06], [0.04, 0.06], [0.18, 0.46]];
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
}

function phys(color, emissive, extra = {}) {
    return new THREE.MeshPhysicalMaterial({
        color, emissive, emissiveIntensity: 1, roughness: 0.12, metalness: 0.0,
        clearcoat: 0.5, clearcoatRoughness: 0.15, flatShading: true, clippingPlanes: clipPlanes, ...extra,
    });
}

export function initGems(planes) {
    if (ready) return;
    ready = true;
    clipPlanes = planes;
    // Fire — a tall ruby
    geo.fire = new THREE.OctahedronGeometry(0.44, 0);
    geo.fire.scale(0.92, 1.12, 0.62);
    mat.fire = phys(0xff1a1a, 0x7a0505);
    // Water — a raindrop
    const drop = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); drop.push(new THREE.Vector2(Math.max(0.001, 0.36 * Math.cos(a)), -0.06 + 0.36 * Math.sin(a))); }
    for (let i = 1; i <= 8; i++) { const u = i / 8; drop.push(new THREE.Vector2(Math.max(0.001, 0.36 * Math.pow(1 - u, 1.35)), -0.06 + 0.52 * u)); }
    geo.water = new THREE.LatheGeometry(drop, 14);
    geo.water.scale(1, 1, 0.75);
    mat.water = phys(0x0a6cff, 0x062a7a, { flatShading: false, roughness: 0.08 });
    // Leaf — a hexagonal emerald seen from above
    const crown = [new THREE.Vector2(0.001, 0.2), new THREE.Vector2(0.27, 0.2), new THREE.Vector2(0.43, 0.04), new THREE.Vector2(0.4, -0.06), new THREE.Vector2(0.001, -0.28)];
    geo.leaf = new THREE.LatheGeometry(crown, 6);
    geo.leaf.rotateX(Math.PI / 2);
    geo.leaf.rotateZ(Math.PI / 6);
    mat.leaf = phys(0x0fc84a, 0x06501c);
    // Spark — a lightning bolt
    geo.spark = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
    geo.spark.center();
    geo.spark.scale(1.15, 1.05, 1);
    mat.spark = phys(0xffc400, 0x7a4a00, { roughness: 0.3 });
    // Skull
    geo.skullHead = new THREE.SphereGeometry(0.33, 16, 12);
    geo.skullHead.scale(1, 0.95, 0.85);
    geo.skullJaw = new THREE.BoxGeometry(0.36, 0.18, 0.3, 2, 1, 1);
    geo.skullEye = new THREE.SphereGeometry(0.085, 10, 8);
    geo.skullNose = new THREE.ConeGeometry(0.04, 0.08, 3);
    mat.skull = new THREE.MeshStandardMaterial({ color: 0xf2e8d6, emissive: 0x1a120a, roughness: 0.5, metalness: 0, clippingPlanes: clipPlanes });
    mat.skullDark = new THREE.MeshBasicMaterial({ color: 0x2a1028, clippingPlanes: clipPlanes });
    // Coin
    geo.coin = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 28);
    geo.coin.rotateX(Math.PI / 2);
    geo.coinRim = new THREE.TorusGeometry(0.3, 0.035, 8, 28);
    geo.coinStar = new THREE.ExtrudeGeometry(starShape(5, 0.17, 0.08), { depth: 0.04, bevelEnabled: false });
    geo.coinStar.translate(0, 0, 0.06);
    mat.coin = new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0x5a3000, metalness: 1, roughness: 0.22, clippingPlanes: clipPlanes });
    // Star (XP)
    geo.star = new THREE.ExtrudeGeometry(starShape(5, 0.46, 0.2), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 2 });
    geo.star.center();
    mat.star = phys(0x9a2bff, 0x40107a, { roughness: 0.25 });
    // Prism (wild)
    geo.prism = new THREE.IcosahedronGeometry(0.42, 0);
    mat.prism = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xff66ff, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, flatShading: true, clippingPlanes: clipPlanes });
    // Special overlays
    geo.arrow = new THREE.ConeGeometry(0.1, 0.2, 3);
    geo.bar = new THREE.BoxGeometry(0.9, 0.07, 0.07);
    geo.ring = new THREE.TorusGeometry(0.47, 0.045, 8, 32);
    geo.spike = new THREE.ConeGeometry(0.06, 0.16, 5);
    mat.glow = new THREE.MeshBasicMaterial({ color: 0xffffff, clippingPlanes: clipPlanes, toneMapped: false });
    mat.bombGlow = new THREE.MeshBasicMaterial({ color: 0xff8a2a, clippingPlanes: clipPlanes, toneMapped: false });
    mat.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, clippingPlanes: clipPlanes });
    geo.shadow = new THREE.CircleGeometry(0.36, 20);
}

export function gemMaterial(t) { return [mat.fire, mat.water, mat.leaf, mat.spark, mat.skull, mat.coin, mat.star, mat.prism][t]; }

export function makeGem(t, sp) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.name = 'body';
    g.add(body);
    const sh = new THREE.Mesh(geo.shadow, mat.shadow);
    sh.position.set(0.05, -0.06, -0.35);
    g.add(sh);
    switch (t) {
        case G.FIRE: body.add(new THREE.Mesh(geo.fire, mat.fire)); break;
        case G.WATER: { const m = new THREE.Mesh(geo.water, mat.water); m.position.y = -0.03; body.add(m); break; }
        case G.LEAF: body.add(new THREE.Mesh(geo.leaf, mat.leaf)); break;
        case G.SPARK: body.add(new THREE.Mesh(geo.spark, mat.spark)); break;
        case G.SKULL: {
            const h = new THREE.Mesh(geo.skullHead, mat.skull); h.position.y = 0.05; body.add(h);
            const j = new THREE.Mesh(geo.skullJaw, mat.skull); j.position.set(0, -0.24, 0.02); body.add(j);
            for (const s of [-1, 1]) { const e = new THREE.Mesh(geo.skullEye, mat.skullDark); e.position.set(0.12 * s, 0.05, 0.24); e.scale.set(1, 1.2, 0.6); body.add(e); }
            const n = new THREE.Mesh(geo.skullNose, mat.skullDark); n.position.set(0, -0.08, 0.27); n.rotation.x = Math.PI; body.add(n);
            break;
        }
        case G.COIN: {
            body.add(new THREE.Mesh(geo.coin, mat.coin));
            const r = new THREE.Mesh(geo.coinRim, mat.coin); r.position.z = 0.06; body.add(r);
            body.add(new THREE.Mesh(geo.coinStar, mat.coin));
            break;
        }
        case G.STAR: body.add(new THREE.Mesh(geo.star, mat.star)); break;
        case G.PRISM: body.add(new THREE.Mesh(geo.prism, mat.prism)); break;
        default: break;
    }
    for (const m of body.children) { m.castShadow = false; }
    if (sp) addSpecial(g, sp, t);
    g.userData = { t, sp, body };
    return g;
}

function addSpecial(g, sp, t) {
    const o = new THREE.Group();
    o.name = 'special';
    if (sp === SP.LINE_H || sp === SP.LINE_V) {
        const bar = new THREE.Mesh(geo.bar, mat.glow);
        bar.position.z = 0.32;
        o.add(bar);
        for (const s of [-1, 1]) {
            const a = new THREE.Mesh(geo.arrow, mat.glow);
            a.position.set(0.5 * s, 0, 0.3);
            a.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
            o.add(a);
        }
        if (sp === SP.LINE_V) o.rotation.z = Math.PI / 2;
    } else if (sp === SP.BOMB) {
        const ring = new THREE.Mesh(geo.ring, mat.bombGlow);
        ring.position.z = 0.1;
        o.add(ring);
        for (let i = 0; i < 8; i++) {
            const s = new THREE.Mesh(geo.spike, mat.bombGlow);
            const a = (i / 8) * Math.PI * 2;
            s.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.1);
            s.rotation.z = a - Math.PI / 2;
            o.add(s);
        }
        o.userData.spin = 1.2;
    }
    g.add(o);
}

/** Per-frame material animation (prism hue, bomb pulse). */
export function animateGemMaterials(time) {
    if (!ready) return;
    mat.prism.emissive.setHSL((time * 0.25) % 1, 1, 0.55);
    mat.bombGlow.color.setHSL(0.06 + Math.sin(time * 6) * 0.03, 1, 0.55 + Math.sin(time * 6) * 0.1);
}
