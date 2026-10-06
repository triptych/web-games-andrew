/**
 * kit.js — shared building blocks for the creature models.
 *
 * Every creature is built from a few primitives with per-vertex colour:
 *   tube()   a smooth tapered tube along a Catmull-Rom curve (bodies, limbs, tails, branches)
 *   blob()   a scaled sphere coloured from its normal (heads, crowns, chests)
 *   lathe()  a surface of revolution coloured by height (mushroom caps, dresses, basins)
 *   rock()   a noisy, flattened boulder
 * and one material per look made by spiritMat(): vertex colours, optional sheen
 * or transmission, and an emissive term multiplied by the vertex colour so a
 * creature glows faintly in its own colours (it still reads in fog and away
 * from the tree's light).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const mix = (a, b, t, out) => out.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
export const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const C = (hex) => new THREE.Color(hex);

export function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const mats = new Map();
/**
 * A vertex-coloured material that glows `glow` × its own colour.
 * opts: { glow, roughness, sheen, sheenColor, transparent, opacity, metalness, key }
 */
export function spiritMat(opts = {}) {
    const key = opts.key ?? JSON.stringify(opts);
    if (mats.has(key)) return mats.get(key);
    const m = new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0,
        sheen: opts.sheen ?? 0, sheenRoughness: 0.5, sheenColor: new THREE.Color(opts.sheenColor ?? 0xffffff),
        emissive: 0xffffff, emissiveIntensity: opts.glow ?? 0.15,
        transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide,
        clearcoat: opts.clearcoat ?? 0, clearcoatRoughness: 0.3, depthWrite: opts.depthWrite ?? true,
    });
    m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
            'vec3 totalEmissiveRadiance = emissive;',
            'vec3 totalEmissiveRadiance = emissive * vColor.rgb;');
    };
    mats.set(key, m);
    return m;
}

/**
 * A tube along a smooth curve through `pts`, radius radiusAt(t) (t 0..1, let the
 * ends go to ~0 so they close), colour colorAt(t, normal, out, angle).
 * squash(t, angle) scales the radius around the ring (flattened muzzles, leaves).
 */
export function tube(pts, radiusAt, colorAt, seg = 24, radial = 14, squash = null) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [], col = [], idx = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        curve.getPointAt(t, p);
        const r = radiusAt(t);
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
            const k = squash ? squash(t, a) : 1;
            pos.push(p.x + n.x * r * k, p.y + n.y * r * k, p.z + n.z * r * k);
            colorAt(t, n, c, a);
            col.push(c.r, c.g, c.b);
        }
    }
    for (let i = 0; i < seg; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * (radial + 1) + j, b = a + radial + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    outward(g, curve, seg, radial);
    return g;
}

/** Frenet frames can flip handedness: make sure a tube's faces point away from its curve. */
function outward(g, curve, seg, radial) {
    const pos = g.attributes.position, nor = g.attributes.normal;
    let out = 0;
    const v = new THREE.Vector3(), nn = new THREE.Vector3(), on = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
        const ring = Math.floor(i / (radial + 1));
        if (ring === 0 || ring === seg) continue;          // closed ends are degenerate
        v.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nor, i);
        curve.getPointAt(ring / seg, on);
        out += Math.sign(nn.dot(v.sub(on)));
    }
    if (out < 0) {
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        g.index.needsUpdate = true;
        g.computeVertexNormals();
    }
}

/** A scaled sphere with colour from its (unscaled) normal: colorAt(normal, out, position). */
export function blob(r, sx, sy, sz, colorAt, w = 20, h = 14, jitter = 0, seed = 1) {
    const g = new THREE.SphereGeometry(r, w, h);
    if (jitter) {
        const rr = mulberry(seed), p = g.attributes.position, v = new THREE.Vector3();
        const bumps = [0, 1, 2, 3, 4].map(() => new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize());
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            const d = v.clone().normalize();
            let k = 1;
            for (const b of bumps) k += Math.max(0, d.dot(b)) ** 3 * jitter;
            v.multiplyScalar(k);
            p.setXYZ(i, v.x, v.y, v.z);
        }
    }
    g.scale(sx, sy, sz);
    g.computeVertexNormals();
    const n = g.attributes.normal, p = g.attributes.position, col = [];
    const c = new THREE.Color(), v = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) { colorAt(v.fromBufferAttribute(n, i), c, q.fromBufferAttribute(p, i)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

/** Surface of revolution through profile [[r, y], …] (bottom to top), colour colorAt(y, normal, out). */
export function lathe(profile, colorAt, segs = 24) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, col = [];
    const c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { colorAt(p.getY(i), v.fromBufferAttribute(n, i), c); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

/** A boulder: a jittered, flattened icosphere, mossy on top. */
export function rock(r, seed, base = 0x7d857c, moss = 0x3f7a3a, flat = 0.7) {
    const rr = mulberry(seed);
    const g = new THREE.IcosahedronGeometry(r, 2);
    const p = g.attributes.position, v = new THREE.Vector3();
    const bumps = [0, 1, 2, 3, 4, 5].map(() => [new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize(), (rr() - 0.4) * 0.35]);
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const d = v.clone().normalize();
        let k = 1;
        for (const [b, s] of bumps) k += Math.max(0, d.dot(b)) ** 2 * s;
        v.multiplyScalar(k);
        v.y *= v.y > 0 ? flat : flat * 0.6;
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const n = g.attributes.normal, col = [];
    const cb = new THREE.Color(base), cm = new THREE.Color(moss), c = new THREE.Color();
    for (let i = 0; i < n.count; i++) {
        const shade = 0.85 + rr() * 0.3;
        mix(cb, cm, smooth(0.45, 0.8, n.getY(i)), c).multiplyScalar(shade);
        col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
}

export function colorize(geo, color) {
    const n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

export function colorByHeight(geo, fn) {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(p.getY(i), c, i); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

/** Point a flattened ellipsoid (thin along local z) out along `dir`, long axis level, tilted by `tilt`. */
export function faceOut(obj, dir, tilt = 0) {
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    return obj;
}

/** A glowing eye: dark almond rim, coloured iris, slit pupil, a glint; sits on a sphere at `centre`. */
/** One unlit, vertex-coloured material for eyes, pupils, glints and noses, so bake() merges them all. */
export function featureMat() { return cachedMat('features', () => new THREE.MeshBasicMaterial({ vertexColors: true })); }
const DARK = new THREE.Color(0x120a08);
export const featureDark = DARK;

export function eye(parent, centre, dir, radius, size, color = 0x8ff6ff, tilt = 0, pupil = true) {
    const mat = featureMat();
    const at = (k) => centre.clone().addScaledVector(dir, k);
    const rim = faceOut(new THREE.Mesh(colorize(new THREE.SphereGeometry(size * 1.35, 16, 10).scale(1.3, 0.75, 0.35), DARK), mat), dir, tilt);
    rim.position.copy(at(radius * 0.97));
    const iris = faceOut(new THREE.Mesh(colorize(new THREE.SphereGeometry(size, 16, 10).scale(1.3, 0.72, 0.35), new THREE.Color(color)), mat), dir, tilt);
    iris.position.copy(at(radius * 1.02));
    parent.add(rim, iris);
    if (pupil) {
        const pu = faceOut(new THREE.Mesh(colorize(new THREE.SphereGeometry(size * 0.45, 10, 8).scale(0.55, 1.2, 0.3), DARK), mat), dir, tilt);
        pu.position.copy(at(radius * 1.055));
        parent.add(pu);
    }
    const glint = new THREE.Mesh(colorize(new THREE.SphereGeometry(size * 0.22, 8, 6), new THREE.Color(1, 1, 1)), mat);
    glint.position.copy(at(radius * 1.075)).add(new THREE.Vector3(size * 0.15, size * 0.3, 0));
    parent.add(glint);
}

/** A soft additive glow sprite. */
export function glowSprite(textures, color, scale, opacity = 0.8) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(scale);
    return s;
}

const cache = new Map();
/** One shared material per key, so parts that use it can be merged by bake(). */
export function cachedMat(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
}

const WHITE = new THREE.Color(1, 1, 1);
/**
 * Merge the rigid parts of a model: in every group, child meshes that share a
 * material become one mesh. Animated joints are groups, so they keep moving;
 * a creature drops from dozens of draw calls to a handful.
 * Meshes with userData.keep stay as they are.
 */
export function bake(root) {
    const groups = [];
    root.traverse((o) => { if (o.isGroup || o === root) groups.push(o); });
    for (const g of groups) {
        const byMat = new Map();
        for (const ch of g.children) {
            if (!ch.isMesh || ch.isInstancedMesh || ch.userData.keep) continue;
            if (!byMat.has(ch.material)) byMat.set(ch.material, []);
            byMat.get(ch.material).push(ch);
        }
        for (const [mat, list] of byMat) {
            if (list.length < 2) continue;
            let geos = list.map((m) => {
                m.updateMatrix();
                const geo = m.geometry.clone().applyMatrix4(m.matrix);
                for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') geo.deleteAttribute(k);
                if (!geo.attributes.normal) geo.computeVertexNormals();
                if (!geo.attributes.color) colorize(geo, WHITE);
                return geo;
            });
            if (geos.some((x) => !x.index)) geos = geos.map((x) => (x.index ? x.toNonIndexed() : x));
            const merged = mergeGeometries(geos, false);
            if (!merged) continue;
            for (const m of list) { g.remove(m); m.geometry.dispose(); }
            g.add(new THREE.Mesh(merged, mat));
        }
    }
    return root;
}
