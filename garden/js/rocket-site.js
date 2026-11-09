// The crashed rocket on its headland past the grove between the Puzzle and
// Dungeon paths: the Silver Comet, a bullet-nosed chrome rocket out of an old
// Saturday-morning serial, red-nosed and red-finned, lying on its belly in the
// crater it dug. Its nose is buried in a bank of thrown-up earth, one fin is
// crumpled under it and another lies snapped off in the grass, and smoke still
// rolls out of the engine bell at the back. A hatch in its side has fallen open
// into a ramp, and something inside is still sparking.
// Walk up the ramp, or click the ship, and you go aboard (rocket.js).
// Registers itself on `world` as `rocket`.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { signMesh, signTexture, lathe } from './architecture.js';
import { glowSprite, canvas, toTexture } from './textures.js';
import { CRASH } from './terrain.js';
import { rng, TAU, clamp, smoothstep, lerp, fbm2 } from './util.js';

export const ROCKET_ACCENT = '#ff7a4a';
export const SHIP_NAME = 'Silver Comet';
const L = CRASH.len, R = CRASH.r;
const AXIS_Y = 1.95;        // the hull's axis above the crater floor, amidships
const HATCH_X = 1.2;        // the hatch, a little forward of amidships, on the +z side
const NOSE_DIP = 0.065;     // the nose ploughed in
const ROLL = 0.1;           // and she rolled a little onto her crumpled fin

/** The hull's radius at distance y from the tail (0) to the tip of the nose (L). */
export function hullR(y) {
    if (y < 0) return 0;
    if (y < 1.4) return lerp(1.55, 2.25, smoothstep(0, 1.4, y));
    if (y < 4.2) return lerp(2.25, R, smoothstep(1.4, 4.2, y));
    if (y < 11.5) return R;
    if (y >= L) return 0;
    const k = (y - 11.5) / (L - 11.5);
    return R * Math.pow(1 - k * k, 0.62);
}

/** Where the player stands to go aboard: on the ramp, in front of the hatch. */
export function atHatch(rk, x, z) {
    const l = rk.toLocal(x, z);
    return Math.abs(l.x - HATCH_X) < 1.05 && l.z > 3.0 && l.z < 5.4;
}

// ---------------------------------------------------------------- textures

/** The hull's skin: chrome panels with seams and rivets, a red nose, a red band, soot at the tail, the name. */
function hullTexture() {
    const W = 1024, H = 1024;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const r = rng('silver-comet-hull');
    const row = (v) => (1 - v) * H;
    // brushed chrome, brighter along the top (u = 0.5) where the sky catches it
    const sheen = g.createLinearGradient(0, 0, W, 0);
    sheen.addColorStop(0, '#8d9298');
    sheen.addColorStop(0.3, '#c9ced4');
    sheen.addColorStop(0.5, '#eef1f4');
    sheen.addColorStop(0.7, '#c9ced4');
    sheen.addColorStop(1, '#8d9298');
    g.fillStyle = sheen;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,44,50'},${r() * 0.05})`;
        g.fillRect(r() * W, r() * H, 1 + r() * 2, 8 + r() * 40);
    }
    // the red nose, with a cream pinstripe, and a red band round the waist
    const nose0 = 0.8;
    g.fillStyle = '#b8231b';
    g.fillRect(0, 0, W, row(nose0));
    g.fillStyle = '#f4e6c4';
    g.fillRect(0, row(nose0) - 2, W, 10);
    g.fillStyle = '#b8231b';
    g.fillRect(0, row(0.245), W, row(0.2) - row(0.245));
    g.fillStyle = '#f4e6c4';
    g.fillRect(0, row(0.245) - 8, W, 5);
    g.fillRect(0, row(0.2) + 3, W, 5);
    // panel seams: rings along the length, seams round it, rivets along both
    g.strokeStyle = 'rgba(40, 42, 48, 0.55)';
    g.lineWidth = 2;
    for (let v = 0.06; v < 0.97; v += 0.068) {
        g.beginPath();
        g.moveTo(0, row(v));
        g.lineTo(W, row(v));
        g.stroke();
        g.fillStyle = 'rgba(30, 32, 36, 0.6)';
        for (let x = 6; x < W; x += 16) g.fillRect(x, row(v) - 6, 3, 3);
    }
    for (let k = 0; k < 16; k++) {
        const x = (k / 16) * W + 2;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
        g.fillStyle = 'rgba(30, 32, 36, 0.55)';
        for (let y = 4; y < H; y += 18) g.fillRect(x + 5, y, 3, 3);
    }
    // soot: black from the tail, and streaks blown forward along the hull
    const soot = g.createLinearGradient(0, H, 0, row(0.42));
    soot.addColorStop(0, 'rgba(14, 12, 10, 0.92)');
    soot.addColorStop(0.25, 'rgba(24, 20, 16, 0.6)');
    soot.addColorStop(1, 'rgba(24, 20, 16, 0)');
    g.fillStyle = soot;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
        const x = r() * W, len = 60 + r() * 380;
        const st = g.createLinearGradient(0, H, 0, H - len);
        st.addColorStop(0, `rgba(10, 8, 6, ${0.3 + r() * 0.4})`);
        st.addColorStop(1, 'rgba(10, 8, 6, 0)');
        g.fillStyle = st;
        g.fillRect(x, H - len, 3 + r() * 10, len);
    }
    // scrapes along the belly (u = 0 and 1) from sliding through the grove
    for (let i = 0; i < 90; i++) {
        const x = (r() < 0.5 ? r() * 0.16 : 1 - r() * 0.16) * W;
        const y0 = r() * H;
        g.strokeStyle = `rgba(${r() < 0.5 ? '230,230,230' : '50,40,30'},${0.2 + r() * 0.4})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x + (r() - 0.5) * 12, y0 + 30 + r() * 120);
        g.stroke();
    }
    // the name, running nose-ward high on the +z side (above the hatch, which is at u = 0.75),
    // upright to someone standing there; squeezed along the hull, whose texels are longer that way
    g.save();
    g.translate(0.625 * W, row(0.535));
    g.rotate(-Math.PI / 2);
    g.scale(49 / 63, 1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 900 56px "Trebuchet MS", "Arial Black", sans-serif';
    g.fillStyle = '#b8231b';
    g.strokeStyle = '#f4e6c4';
    g.lineWidth = 6;
    g.strokeText(SHIP_NAME.toUpperCase(), 0, 0);
    g.fillText(SHIP_NAME.toUpperCase(), 0, 0);
    g.font = 'bold 26px "Trebuchet MS", sans-serif';
    g.fillStyle = '#2a2c32';
    g.fillText('INTERPLANETARY  ·  SC-7', 0, 46);
    g.restore();
    const t = toTexture(c, { repeat: 1 });
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
}

/** A puff of smoke: a lumpy grey blob with soft edges. */
function smokeTexture() {
    const n = 128;
    const c = canvas(n);
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const dx = x / n - 0.5, dy = y / n - 0.5;
            const d = Math.hypot(dx, dy) * 2;
            const lump = fbm2(x * 0.07, y * 0.07, 4) * 0.5 + 0.5;
            const a = clamp((1 - d) * 1.6 - 0.25 + (lump - 0.5) * 0.9, 0, 1);
            const k = (y * n + x) * 4;
            const v = 200 + lump * 55;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
            img.data[k + 3] = a * a * 255;
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Scorched earth: black at the heart, ragged brown at the rim, fading into the grass. */
function scorchTexture() {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const dx = x / n - 0.5, dy = y / n - 0.5;
            const d = Math.hypot(dx, dy) * 2 + fbm2(x * 0.02, y * 0.02, 4) * 0.28;
            const grit = fbm2(x * 0.15 + 9, y * 0.15, 2) * 0.5 + 0.5;
            const a = clamp(1.15 - d, 0, 1);
            const k = (y * n + x) * 4;
            const burnt = smoothstep(0.35, 0.9, a);
            img.data[k] = lerp(92, 22, burnt) + grit * 18;
            img.data[k + 1] = lerp(70, 18, burnt) + grit * 14;
            img.data[k + 2] = lerp(48, 14, burnt) + grit * 10;
            img.data[k + 3] = smoothstep(0, 0.35, a) * 235;
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** The long gouge behind her: dark turned earth along the middle, torn turf at the edges. */
function furrowTexture() {
    const w = 128, h = 512;
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = Math.abs(x / w - 0.5) * 2 + fbm2(x * 0.05, y * 0.03, 3) * 0.3;
            const along = y / h;
            const a = clamp(1 - u, 0, 1) * smoothstep(0, 0.4, 1 - along) * 1.2;
            const k = (y * w + x) * 4;
            const grit = fbm2(x * 0.2, y * 0.2, 2) * 0.5 + 0.5;
            img.data[k] = 58 + grit * 30;
            img.data[k + 1] = 42 + grit * 22;
            img.data[k + 2] = 28 + grit * 14;
            img.data[k + 3] = clamp(a, 0, 1) * 230;
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// ---------------------------------------------------------------- the ship

/** A Buck Rogers fin in the (along, out) plane: swept back past the tail, with a rounded tip. */
function finGeometry(scale = 1) {
    const s = new THREE.Shape();
    s.moveTo(6.2, 0);
    s.bezierCurveTo(4.6, 0.9, 2.2, 2.4, -0.6, 3.2);
    s.bezierCurveTo(-1.5, 3.45, -2.2, 3.1, -1.9, 2.4);
    s.bezierCurveTo(-1.4, 1.5, -0.3, 0.6, 0.4, 0);
    s.lineTo(6.2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 14 });
    g.translate(0, 0, -0.07);
    g.scale(scale, scale, 1);
    return g;
}

export function buildRocketSite(world) {
    const site = world.layout.crash;
    if (!site) return null;
    const { mats } = world;
    const Rn = rng('silver-comet');
    const y0 = world.groundAt(site.x, site.z);
    const yaw = site.yaw;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const toWorld = (lx, lz) => ({ x: site.x + lx * cosY + lz * sinY, z: site.z - lx * sinY + lz * cosY });
    const toLocal = (x, z) => {
        const dx = x - site.x, dz = z - site.z;
        return { x: dx * cosY - dz * sinY, z: dx * sinY + dz * cosY };
    };

    const root = new THREE.Group();
    root.position.set(site.x, y0, site.z);
    root.rotation.y = yaw;
    world.root.add(root);

    // the hull rests nose-down and rolled, its axis through (0, AXIS_Y, 0)
    const body = new THREE.Group();
    body.position.set(0, AXIS_Y, 0);
    body.rotation.set(ROLL, 0, -NOSE_DIP, 'XYZ');
    root.add(body);

    const chrome = new THREE.MeshStandardMaterial({ map: hullTexture(), roughness: 0.32, metalness: 0.55, color: 0xffffff });
    const red = new THREE.MeshStandardMaterial({ color: 0xb8231b, roughness: 0.42, metalness: 0.25 });
    const sooty = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.75, metalness: 0.5 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1824, emissive: 0x3ad8ff, emissiveIntensity: 0.15, roughness: 0.08, metalness: 0.4 });
    const engineGlow = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff2a1a, emissiveIntensity: 0.4, roughness: 0.4 });
    const hatchGlow = new THREE.MeshBasicMaterial({ color: 0xffb070 });
    world.glowMats.push({ mat: glassMat, day: 0.12, night: 0.9 });
    const M = { chrome, red, sooty, steel, glass: glassMat, iron: mats.iron, brass: mats.brass, darkWood: mats.darkWood, granite: mats.granite };

    // ---- the hull: one lathe from the tail ring to the tip of the nose
    const prof = [];
    for (let y = 0; y <= L + 1e-6; y += L / 70) prof.push([Math.max(hullR(y), 0.001), y]);
    const hullGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48, Math.PI / 2, TAU);
    hullGeo.rotateZ(-Math.PI / 2).translate(-L / 2, 0, 0);
    const hull = new THREE.Mesh(hullGeo, chrome);
    hull.castShadow = hull.receiveShadow = true;
    body.add(hull);
    // (the hull in body coordinates: axial position ax in [-L/2, L/2])
    const rAt = (ax) => hullR(ax + L / 2);
    // a point on the skin at axial ax, angle a round from +z toward +y
    const skin = (ax, a, out = 0) => new THREE.Vector3(ax, (rAt(ax) + out) * Math.sin(a), (rAt(ax) + out) * Math.cos(a));

    const batch = new Batch();
    // a tail ring, and the engine bell coming out of it
    batch.add('steel', new THREE.TorusGeometry(1.58, 0.12, 8, 32).rotateY(Math.PI / 2), xf(-L / 2 + 0.05, 0, 0));
    batch.add('sooty', lathe([[1.15, 0], [1.3, -0.5], [1.65, -1.5], [1.75, -1.75], [1.6, -1.8], [1.18, -0.9], [0.95, -0.1]], 32).rotateZ(Math.PI / 2), xf(-L / 2 + 0.1, 0, 0));
    // two small steering jets beside it
    for (const s of [-1, 1]) {
        batch.add('sooty', lathe([[0.32, 0], [0.42, -0.5], [0.5, -0.8], [0.36, -0.82], [0.25, -0.1]], 16).rotateZ(Math.PI / 2), xf(-L / 2 + 1.0, 1.2 * s * 0.7, 1.2 * (s > 0 ? 0.8 : -0.8)));
    }
    // ribs round the waist, and a raised dorsal spine with an antenna mast
    for (const ax of [-5.4, -0.9, 3.6]) batch.add('steel', new THREE.TorusGeometry(R + 0.03, 0.07, 6, 48).rotateY(Math.PI / 2), xf(ax, 0, 0));
    batch.add('steel', new THREE.BoxGeometry(9.5, 0.22, 0.42), xf(-1.2, R + 0.05, 0));
    batch.add('steel', new THREE.CylinderGeometry(0.035, 0.05, 2.2, 6), xf(2.6, R + 1.15, 0, 0, 1, 1, 1, 0, -0.25));
    batch.add('steel', new THREE.SphereGeometry(0.11, 10, 8), xf(2.32, R + 2.22, 0));
    for (const ry of [0, 1.1, 2.2]) batch.add('steel', new THREE.TorusGeometry(0.22, 0.015, 4, 16), xf(2.5, R + 1.6, 0, ry));

    // ---- the fins: three, Buck Rogers style; the top one stands, one is crumpled under her, one lies in the grass
    const finTop = finGeometry(1);
    const finAt = (a, geo, key = 'red', extraRot = 0) => {
        const m = new THREE.Matrix4().makeRotationX(-a + Math.PI / 2);
        const pos = new THREE.Matrix4().makeTranslation(-L / 2 + 0.6, 0, 0);
        // the shape is in x (along) and y (out): rotate it round the axis to angle a (from +z toward +y)
        const bend = new THREE.Matrix4().makeRotationY(extraRot);
        const lift = new THREE.Matrix4().makeTranslation(0, 1.6, 0);
        batch.add(key, geo, pos.multiply(m).multiply(bend).multiply(lift));
    };
    finAt(Math.PI / 2, finTop);                       // straight up
    finAt(Math.PI / 2 + (TAU / 3), finTop.clone().scale(1, 0.62, 1), 'red', 0.35); // crumpled under her, on the -z side
    // chrome balls on the fin tips, and a red beacon on the top fin's
    batch.add('chrome', new THREE.SphereGeometry(0.22, 12, 10), xf(-L / 2 + 0.6 - 1.75, 1.6 + 3.05, 0));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lampMat);
    beacon.position.set(-L / 2 + 0.6 - 1.75, 1.6 + 3.32, 0);
    body.add(beacon);
    const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff3a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    beaconHalo.scale.setScalar(2.4);
    beaconHalo.position.copy(beacon.position);
    body.add(beaconHalo);

    // orient a part whose face looks along `from` so that it looks along `n`, at p
    const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const facing = (p, n, from, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(from, n), new THREE.Vector3(sx, sy, sz));
    // ---- the cockpit: a band of windows round the base of the nose
    for (let k = -2; k <= 2; k++) {
        const a = 0.55 + k * 0.3;
        const ax = 9.0;
        const p = skin(ax, a, -0.02);
        const n = new THREE.Vector3(0.3, Math.sin(a), Math.cos(a)).normalize();
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, TAU, 0, Math.PI / 2), glassMat);
        w.applyMatrix4(facing(p, n, Y, 1.25, 0.3, 0.7));
        body.add(w);
        batch.add('steel', new THREE.TorusGeometry(0.52, 0.06, 6, 20), facing(p, n, Z, 1.22, 0.7, 1));
    }
    // ---- portholes down the +z side: brass rings round round glass, lit from inside
    const portGlow = new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: 0xffa040, emissiveIntensity: 0.3, roughness: 0.1 });
    const flickerPorts = [];
    for (const ax of [-6.8, -4.6, 4.0, 6.1]) {
        const a = 0.42;
        const p = skin(ax, a, 0.03);
        const n = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
        batch.add('brass', new THREE.TorusGeometry(0.36, 0.08, 8, 22), facing(p, n, Z));
        const pmat = ax === -4.6 ? portGlow.clone() : portGlow;
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), pmat);
        glass.applyMatrix4(facing(p.clone().addScaledVector(n, -0.01), n, Z));
        body.add(glass);
        if (pmat !== portGlow) flickerPorts.push(pmat);
    }
    world.glowMats.push({ mat: portGlow, day: 0.25, night: 1.6 });

    // ---- the hatch: a dark doorway in the side, lit by sparks, and its door fallen open into a ramp
    const hp = skin(HATCH_X, 0.0, -0.02);
    const doorway = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    doorway.position.set(HATCH_X, 0.05, hp.z + 0.04);
    body.add(doorway);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.0), hatchGlow);
    inner.material.transparent = true;
    inner.material.opacity = 0.25;
    inner.material.blending = THREE.AdditiveBlending;
    inner.material.depthWrite = false;
    inner.position.set(HATCH_X, 0.05, hp.z + 0.06);
    body.add(inner);
    batch.add('steel', new THREE.BoxGeometry(1.8, 0.14, 0.2), xf(HATCH_X, 1.12, hp.z + 0.06));
    batch.add('steel', new THREE.BoxGeometry(1.8, 0.14, 0.2), xf(HATCH_X, -1.02, hp.z + 0.06));
    for (const s of [-1, 1]) batch.add('steel', new THREE.BoxGeometry(0.14, 2.3, 0.2), xf(HATCH_X + s * 0.86, 0.05, hp.z + 0.06));
    body.add(batch.build(M));

    // the ramp is in root (level) coordinates: from the sill down to the crater floor
    body.updateMatrix();
    const toRoot = (v) => v.clone().applyMatrix4(body.matrix);
    const sillL = toRoot(new THREE.Vector3(HATCH_X, -1.0, hp.z + 0.1));
    const foot = new THREE.Vector3(HATCH_X, 0.06, 5.3);
    const rampLen = sillL.distanceTo(foot);
    const ramp = new Batch();
    const rampMid = sillL.clone().add(foot).multiplyScalar(0.5);
    const rampPitch = Math.atan2(sillL.y - foot.y, foot.z - sillL.z);
    const rm = new THREE.Matrix4().makeRotationX(rampPitch).setPosition(rampMid);
    ramp.add('steel', new THREE.BoxGeometry(1.4, 0.1, rampLen), rm);
    for (let k = 0; k < 7; k++) ramp.add('iron', new THREE.BoxGeometry(1.3, 0.04, 0.06), rm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.07, -rampLen / 2 + 0.3 + k * ((rampLen - 0.5) / 6))));
    for (const s of [-1, 1]) ramp.add('chrome', new THREE.CylinderGeometry(0.06, 0.06, rampLen, 8).rotateX(Math.PI / 2), rm.clone().multiply(new THREE.Matrix4().makeTranslation(s * 0.7, 0.04, 0)));
    // the hinge struts
    for (const s of [-1, 1]) ramp.add('iron', new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), xf(HATCH_X + s * 0.75, sillL.y * 0.55, sillL.z + 0.55, 0, 1, 1, 1, 0.9));
    root.add(ramp.build(M));

    // ---- the ground: a scorched crater, a long gouge behind her, earth heaped round the nose
    const groundMesh = (geo, mat) => {
        // drape a flat (x, z) mesh in root coordinates over the real ground
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const w = toWorld(p.getX(i), p.getZ(i));
            p.setY(i, world.groundAt(w.x, w.z) - y0 + 0.07);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        m.receiveShadow = true;
        m.renderOrder = 1;
        root.add(m);
        return m;
    };
    const decal = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    groundMesh(new THREE.PlaneGeometry(CRASH.crater * 2.6, CRASH.crater * 2.2, 40, 34).rotateX(-Math.PI / 2), decal(scorchTexture()));
    const furrow = new THREE.PlaneGeometry(5.2, 15, 8, 30).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(-L / 2 - 6.5, 0, 0.3);
    groundMesh(furrow, decal(furrowTexture()));
    // turned earth piled against the nose, and clods thrown out along the gouge
    const soil = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1, flatShading: true });
    const turf = new THREE.MeshStandardMaterial({ color: 0x4b6a2c, roughness: 1, flatShading: true });
    const lump = (r0, seed) => {
        const g = new THREE.IcosahedronGeometry(r0, 2);
        const p = g.attributes.position;
        const rr = rng(seed);
        const off = rr() * 50;
        for (let i = 0; i < p.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(p, i);
            const k = 1 + fbm2(v.x * 1.3 + off, v.z * 1.3 + v.y, 3) * 0.35;
            v.multiplyScalar(k);
            if (v.y < 0) v.y *= 0.3;
            p.setXYZ(i, v.x, v.y * 0.62, v.z);
        }
        g.computeVertexNormals();
        return g;
    };
    const earth = new Batch();
    const noseTip = L / 2 * Math.cos(NOSE_DIP);
    const piles = [[noseTip - 1.0, 0, 2.6], [noseTip + 0.6, -1.6, 1.9], [noseTip + 0.4, 1.8, 2.0], [noseTip - 2.6, -2.9, 1.4], [noseTip - 2.4, 3.0, 1.5], [noseTip + 1.8, 0.2, 1.5]];
    piles.forEach(([lx, lz, r0], i) => {
        const w = toWorld(lx, lz);
        earth.add(i % 3 === 2 ? 'turf' : 'soil', lump(r0, 'pile' + i), xf(lx, world.groundAt(w.x, w.z) - y0 - 0.2, lz, Rn() * TAU));
    });
    for (let i = 0; i < 26; i++) {
        const lx = -L / 2 - 2 - Rn() * 11, lz = (Rn() < 0.5 ? -1 : 1) * (2.4 + Rn() * 2.4);
        const w = toWorld(lx, lz);
        earth.add(Rn() < 0.4 ? 'turf' : 'soil', lump(0.25 + Rn() * 0.45, 'clod' + i), xf(lx, world.groundAt(w.x, w.z) - y0, lz, Rn() * TAU));
    }
    root.add(earth.build({ soil, turf }));

    // ---- wreckage: the fin that snapped off, panels torn from the hull, a tree she took down on the way in
    const wreck = new Batch();
    const lostFin = { lx: -L / 2 - 6.5, lz: -4.8 };
    {
        const w = toWorld(lostFin.lx, lostFin.lz);
        const gy = world.groundAt(w.x, w.z) - y0;
        wreck.add('red', finTop, xf(lostFin.lx, gy + 0.15, lostFin.lz, 0.6, 0.9, 0.9, 0.9, -Math.PI / 2 + 0.06, 0.1));
        wreck.add('chrome', new THREE.SphereGeometry(0.2, 10, 8), xf(lostFin.lx - 1.6, gy + 0.2, lostFin.lz - 2.8));
    }
    for (let i = 0; i < 9; i++) {
        const lx = -L / 2 + 4 - Rn() * 16, lz = (Rn() < 0.5 ? -1 : 1) * (3.5 + Rn() * 4);
        const w = toWorld(lx, lz);
        const g = new THREE.BoxGeometry(0.8 + Rn() * 1.2, 0.04, 0.5 + Rn() * 0.8, 4, 1, 1);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + Math.sin(p.getX(k) * 2.2) * 0.12);
        g.computeVertexNormals();
        wreck.add(i % 4 === 0 ? 'red' : 'chrome', g, xf(lx, world.groundAt(w.x, w.z) - y0 + 0.08, lz, Rn() * TAU, 1, 1, 1, Rn() * 0.3, Rn() * 0.3));
    }
    const tree = { lx: -L / 2 - 2.2, lz: 5.4 };
    {
        const w = toWorld(tree.lx, tree.lz);
        const gy = world.groundAt(w.x, w.z) - y0;
        wreck.add('bark', new THREE.CylinderGeometry(0.28, 0.4, 7, 9).rotateZ(Math.PI / 2), xf(tree.lx - 3.2, gy + 0.33, tree.lz + 0.5, 0.35));
        wreck.add('bark', new THREE.CylinderGeometry(0.42, 0.5, 0.7, 9), xf(tree.lx + 0.2, gy + 0.3, tree.lz - 0.6));
        for (let k = 0; k < 3; k++) wreck.add('bark', new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5), xf(tree.lx - 2 - k * 1.6, gy + 0.6, tree.lz + 0.6 + (k - 1) * 0.5, k, 1, 1, 1, 0.9, 0.5));
    }
    root.add(wreck.build({ ...M, bark: mats.bark }));

    // ---- the engine still glowing, deep in the bell
    const tailP = new THREE.Vector3(-L / 2 - 1.3, 0, 0);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24).rotateY(-Math.PI / 2), engineGlow);
    ember.position.set(-L / 2 - 0.25, 0, 0);
    body.add(ember);
    const emberHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0xff6a20, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    emberHalo.scale.setScalar(4.2);
    emberHalo.position.copy(tailP);
    body.add(emberHalo);

    // ---- smoke rolling out of the engine bell, rising and drifting off downwind
    const smokeOrigin = toRoot(tailP);
    const smokeMap = smokeTexture();
    const N = world.quality?.tier === 'low' ? 22 : 34;
    const puffs = [];
    for (let i = 0; i < N; i++) {
        const m = new THREE.SpriteMaterial({ map: smokeMap, color: 0x8a8682, transparent: true, opacity: 0, depthWrite: false, rotation: Rn() * TAU });
        const s = new THREE.Sprite(m);
        root.add(s);
        puffs.push({ s, m, t: i / N, life: 7 + Rn() * 3, spin: (Rn() - 0.5) * 0.4, sway: Rn() * TAU, side: (Rn() - 0.5) * 2 });
    }
    // a few sparks spitting from the hatch now and then
    const SP = 24;
    const spPos = new Float32Array(SP * 3), spCol = new Float32Array(SP * 3);
    const sparks = Array.from({ length: SP }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
    const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: glowSprite(), size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    spPts.frustumCulled = false;
    root.add(spPts);
    const hatchL = toRoot(new THREE.Vector3(HATCH_X, 0.6, hp.z + 0.1));

    // ---- the sign, on a post at the foot of the ramp
    const sign = signMesh(signTexture('\u{1F680}', `The ${SHIP_NAME}`, 'crashed · still smoking · hatch open', ROCKET_ACCENT, 1024, 256), 2.0, 0.5, 0.3);
    const post = new Batch();
    const sp0 = { lx: HATCH_X + 2.9, lz: 6.6 };
    const spw = toWorld(sp0.lx, sp0.lz);
    const sgy = world.groundAt(spw.x, spw.z) - y0;
    post.add('darkWood', new THREE.BoxGeometry(0.12, 1.6, 0.12), xf(sp0.lx, sgy + 0.8, sp0.lz));
    post.add('darkWood', new THREE.BoxGeometry(2.15, 0.62, 0.06), xf(sp0.lx, sgy + 1.55, sp0.lz - 0.05));
    root.add(post.build(mats));
    sign.position.set(sp0.lx, sgy + 1.55, sp0.lz - 0.01);
    root.add(sign);
    world.nightSigns.push(sign.userData.nightGlow);

    // ---- solid: the hull as a row of circles, the fins, the heaped earth, the wreckage
    root.updateMatrixWorld(true);
    for (let ax = -L / 2 + 0.6; ax <= L / 2 - 0.8; ax += 1.4) {
        const r0 = Math.max(0.6, rAt(ax) - 0.15);
        const w = toWorld(ax, 0);
        world.colliders.push({ x: w.x, z: w.z, r: r0 });
    }
    const addCol = (lx, lz, r0) => {
        const w = toWorld(lx, lz);
        world.colliders.push({ x: w.x, z: w.z, r: r0 });
    };
    addCol(-L / 2 - 1.0, 0, 1.6);            // the engine bell
    addCol(-L / 2 - 0.8, -2.6, 1.0);         // the crumpled fin
    addCol(-L / 2 - 1.8, -3.4, 0.8);
    for (const [lx, lz, r0] of piles) addCol(lx, lz, r0 * 0.85);
    addCol(lostFin.lx - 0.6, lostFin.lz - 0.4, 1.0);
    addCol(lostFin.lx - 1.6, lostFin.lz - 1.6, 0.8);
    addCol(tree.lx + 0.2, tree.lz - 0.6, 0.55);
    for (let k = 0; k < 4; k++) addCol(tree.lx - 0.6 - k * 1.7, tree.lz + 0.5 - k * 0.55, 0.42);
    addCol(sp0.lx, sp0.lz, 0.25);
    // the ramp's rails, so you walk up it from the front
    addCol(HATCH_X - 1.05, 3.5, 0.25);
    addCol(HATCH_X + 1.05, 3.5, 0.25);

    // ---- the pointer's target: the whole ship
    const hit = new THREE.Mesh(new THREE.BoxGeometry(L + 2.5, R * 2 + 1.5, R * 2 + 3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(-0.5, 0, 0.6);
    hit.userData.kind = 'rocket';
    body.add(hit);
    root.updateMatrixWorld(true);

    const at = (lx, lz) => toWorld(lx, lz);
    const outW = at(HATCH_X + 1.4, 7.4);
    const lookTo = at(-L / 2 - 6, 11);       // back along her, toward the smoke
    const rocket = {
        x: site.x, z: site.z, y: y0, yaw, group: root, hit, near: 0, toLocal, toWorld,
        cx: site.x, cz: site.z,
        front: at(HATCH_X, 8.6),
        stand: at(HATCH_X, 4.4),
        out: { x: outW.x, z: outW.z, yaw: Math.atan2(-(lookTo.x - outW.x), -(lookTo.z - outW.z)) },
        hatch: at(HATCH_X, 4.2),
    };

    // ---- the life of the wreck
    const c = new THREE.Color(), PALE = new THREE.Color(0.72, 0.71, 0.7), FIRE = new THREE.Color(1, 0.5, 0.2);
    let last = 0, nextSpark = 0;
    const wind = new THREE.Vector3(0.45, 0, 0.25);
    world.updaters.push((t, sky) => {
        const dt = Math.min(0.1, Math.max(0, t - last));
        last = t;
        const night = sky?.state?.night ?? 0;
        // the beacon blinks: twice, then a rest
        const ph = t % 2.2;
        const on = ph < 0.12 || (ph > 0.32 && ph < 0.44);
        lampMat.emissiveIntensity = on ? 3.2 : 0.15;
        beaconHalo.material.opacity = on ? 0.35 + night * 0.6 : 0;
        // the engine breathes
        const breathe = 0.65 + 0.2 * Math.sin(t * 1.7) + 0.12 * Math.sin(t * 5.3 + 1.1);
        engineGlow.color.setRGB(1, 0.42 + 0.12 * breathe, 0.12).multiplyScalar(0.6 + 0.4 * breathe);
        emberHalo.material.opacity = (0.22 + 0.45 * night) * breathe;
        // the cabin light behind the second porthole fails and catches, fails and catches
        const fl = Math.sin(t * 13) > 0.6 || Math.sin(t * 3.1) > 0.85 ? 0.08 : 1;
        for (const m of flickerPorts) m.emissiveIntensity = (0.3 + night * 1.3) * fl;
        inner.material.opacity = (0.18 + 0.3 * night) * (0.6 + 0.4 * Math.sin(t * 9.0) * Math.sin(t * 2.3));
        // smoke
        for (const p of puffs) {
            const u = (p.t + t / p.life) % 1;
            const k = u * p.life;
            const sway = Math.sin(t * 0.4 + p.sway) * 0.6 * u;
            p.s.position.set(
                smokeOrigin.x - 1.2 * Math.min(k, 1.5) + wind.x * k * k * 0.18 + sway,
                smokeOrigin.y + 0.3 + k * 1.05 + k * k * 0.04,
                smokeOrigin.z + p.side * 0.6 * u + wind.z * k * k * 0.18,
            );
            const size = 1.1 + u * 7.5;
            p.s.scale.set(size, size, 1);
            p.m.rotation += p.spin * dt;
            const fade = smoothstep(0, 0.08, u) * (1 - smoothstep(0.45, 1, u));
            p.m.opacity = fade * (0.55 - u * 0.15);
            // dark and warm at the bell, pale grey as it rises; lit from below at night
            c.setRGB(0.28, 0.25, 0.23).lerp(PALE, smoothstep(0, 0.4, u));
            if (u < 0.15) c.lerp(FIRE, (1 - u / 0.15) * 0.35 * (0.4 + night));
            c.multiplyScalar(1 - night * 0.6);
            p.m.color.copy(c);
        }
        // sparks from the hatch
        if (t > nextSpark) {
            nextSpark = t + 0.6 + Math.random() * 2.4;
            const n = 4 + Math.floor(Math.random() * 6);
            for (let i = 0, made = 0; i < SP && made < n; i++) {
                const s = sparks[i];
                if (s.life > 0) continue;
                made++;
                s.life = 0.5 + Math.random() * 0.5;
                s.x = hatchL.x + (Math.random() - 0.5) * 0.8;
                s.y = hatchL.y + Math.random() * 0.6;
                s.z = hatchL.z + 0.1;
                s.vx = (Math.random() - 0.5) * 2;
                s.vy = 0.5 + Math.random() * 2;
                s.vz = 0.8 + Math.random() * 1.6;
            }
        }
        for (let i = 0; i < SP; i++) {
            const s = sparks[i];
            if (s.life > 0) {
                s.life -= dt;
                s.vy -= 9 * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.z += s.vz * dt;
            }
            const a = Math.max(0, s.life) * 2;
            spPos[i * 3] = s.x;
            spPos[i * 3 + 1] = s.life > 0 ? s.y : -100;
            spPos[i * 3 + 2] = s.z;
            spCol[i * 3] = a;
            spCol[i * 3 + 1] = a * 0.75;
            spCol[i * 3 + 2] = a * 0.35;
        }
        spGeo.attributes.position.needsUpdate = true;
        spGeo.attributes.color.needsUpdate = true;
    });

    world.landmarks.push({ name: `The ${SHIP_NAME}`, x: site.x, z: site.z, stand: { x: rocket.front.x, z: rocket.front.z, yaw: Math.atan2(-(rocket.stand.x - rocket.front.x), -(rocket.stand.z - rocket.front.z)) } });
    world.rocket = rocket;
    return rocket;
}
