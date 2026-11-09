// Meshy-made character models (assets/models/<name>.glb): rigged humanoids, loaded once and cloned for each visit.
//
// Pipeline (dev/assets/README.md): fal draws an A-pose reference, Meshy image-to-3D makes the textured mesh, the mesh
// is simplified to ~10,000 triangles, Meshy rigs it (24 bones: Hips, Spine, Spine01, Spine02, neck, Head, shoulders,
// arms, forearms, hands, legs), and optimise-rigged.mjs shrinks it (WebP colour map, meshopt). There are no baked
// animation clips: this file poses the bones itself, so a guest can sit, turn their head to you, gesture while
// talking, slump when sad, and walk in from the door.
//
// The code-built people in people.js stay as the fallback for the villagers, for a model that is still loading and
// for a browser that cannot load one.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Standing height in metres, so Pip is a boy and Elias a big man.
export const MODELS = {
    marta:     { height: 1.50 },
    pip:       { height: 1.42 },
    elias:     { height: 1.84 },
    mirabel:   { height: 1.66 },
    stranger:  { height: 1.80 },
    oswin:     { height: 1.72 },
    wren:      { height: 1.72 },
    hester:    { height: 1.76 },
    bram:      { height: 1.72 },
    seraphine: { height: 1.80 },
    caspian:   { height: 1.82 },
};

const SEAT_TOP = 0.60;               // where a seated pelvis sits: the cushion is at 0.515 and the hips are a hand above
const SEAT_BACK = 0.16;              // the guest stops at the front edge of the chair; the pelvis sits this far back
const BONES = ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'RightShoulder', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];

const BASE = new URL('../../assets/models/', import.meta.url).href;
const cache = new Map();             // name -> { state: 'loading' | 'ready' | 'failed', scene, norm, promise }
let loader = null;

function getLoader() {
    if (!loader) {
        loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
    }
    return loader;
}

/** Start loading one model (idempotent). Resolves when it is ready or has failed; never rejects. */
export function loadModel(name) {
    if (!MODELS[name]) return Promise.resolve(null);
    let e = cache.get(name);
    if (e) return e.promise;
    e = { state: 'loading', scene: null, norm: null };
    e.promise = getLoader().loadAsync(BASE + name + '.glb').then((gltf) => {
        const scene = gltf.scene;
        scene.traverse((o) => {
            if (!o.isMesh) return;
            const m = o.material;
            // Meshy's PBR defaults read as plastic under the wagon's candles: a matte cloth look suits it better.
            m.metalness = 0;
            m.roughness = 0.78;
            if (m.map) m.map.anisotropy = 4;
            o.castShadow = false; o.receiveShadow = false;
            o.frustumCulled = false;     // the figure is posed as a whole; its bounds are small and always near
        });
        // measure the rest pose once: how tall it is, where its feet are, how high its hips are
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene, true);
        const hips = scene.getObjectByName('Hips');
        const hipY = hips ? new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y : (box.max.y + box.min.y) * 0.53;
        const scale = MODELS[name].height / Math.max(0.1, box.max.y - box.min.y);
        e.norm = { scale, floor: box.min.y, hipY: (hipY - box.min.y) * scale };
        e.scene = scene; e.state = 'ready';
        return scene;
    }).catch((err) => {
        e.state = 'failed';
        console.warn('model', name, 'did not load, using the built-in person', err?.message || err);
        return null;
    });
    cache.set(name, e);
    return e.promise;
}

export const preloadModels = (names = Object.keys(MODELS)) => Promise.all(names.map(loadModel));
export const modelReady = (name) => cache.get(name)?.state === 'ready';

// Posture per mood: [lean forward (rad), fidget, height lift, head tilt (rad), head pitch (rad), arm lift (rad)]
const POSE = {
    n: [0.04, 1.0, 0.000, 0.00, 0.00, 0.00],
    h: [0.02, 1.4, 0.012, 0.07, -0.05, 0.10],     // happy: sits tall, head tilted, hands a little lively
    s: [0.17, 0.5, -0.025, -0.08, 0.20, -0.08],   // sad: slumps and looks down
    w: [0.10, 1.9, -0.005, 0.10, 0.08, 0.05],     // worried: fidgets
    a: [0.13, 0.9, 0.008, 0.00, 0.03, 0.05],      // angry: leans in
    l: [0.03, 1.2, 0.010, 0.06, -0.03, 0.04],     // light
    x: [-0.12, 1.0, 0.020, 0.00, -0.08, 0.28],    // startled: leans back, hands up
};

const qx = new THREE.Quaternion(), qy = new THREE.Quaternion(), qz = new THREE.Quaternion(), R = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const clamp = THREE.MathUtils.clamp;

/**
 * A person built from a rigged Meshy model, with the same surface as buildPerson(): { group, update(dt, t, st), dispose }.
 * Returns null if the model isn't ready, so the caller can fall back to the built-in person.
 */
export function buildModelPerson(look) {
    const name = look.model;
    const e = cache.get(name);
    if (!e || e.state !== 'ready') return null;
    const { scale, floor, hipY } = e.norm;

    const g = new THREE.Group();                       // placed and yawed by the view
    const rig = new THREE.Group();                     // seat offset and bob
    g.add(rig);
    const holder = new THREE.Group();                  // scale to the character's height, feet on y = 0
    holder.scale.setScalar(scale);
    holder.position.y = -floor * scale;
    rig.add(holder);
    const body = cloneSkinned(e.scene);
    holder.add(body);
    body.updateMatrixWorld(true);

    // Each bone we pose: its rest rotation, and its parent's rest rotation in the model's frame. A rotation R given in
    // the model's frame (x right-to-left, y up, z forward) becomes local = parent⁻¹ · R · parent · rest.
    const B = {};
    const tmp = new THREE.Quaternion();
    for (const n of BONES) {
        const bone = body.getObjectByName(n);
        if (!bone) continue;
        const pw = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
        B[n] = { bone, rest: bone.quaternion.clone(), pw, pwi: pw.clone().invert(), x: 0, y: 0, z: 0 };
    }
    // The model faces +z. Which arm is on +x? (The character's left, since it faces the viewer.) And how far out are
    // the arms in the A-pose? Measured from the rest pose, so every character is lowered by the right amount.
    const wp = (n) => (B[n] ? new THREE.Vector3().setFromMatrixPosition(B[n].bone.matrixWorld) : new THREE.Vector3());
    const arm = {};
    for (const side of ['Left', 'Right']) {
        const a = wp(side + 'Arm'), f = wp(side + 'ForeArm');
        const sign = a.x >= 0 ? 1 : -1;
        arm[side] = { sign, out: Math.atan2(Math.abs(f.x - a.x), Math.max(1e-3, a.y - f.y)) };
    }
    const set = (n, rx = 0, ry = 0, rz = 0) => { const b = B[n]; if (b) { b.x = rx; b.y = ry; b.z = rz; } };
    const apply = () => {
        for (const n in B) {
            const b = B[n];
            // z first (lower the arm), then x (swing it forward), then y (turn)
            qz.setFromAxisAngle(AZ, b.z); qx.setFromAxisAngle(AX, b.x); qy.setFromAxisAngle(AY, b.y);
            R.copy(qy).multiply(qx).multiply(qz);
            tmp.copy(b.pwi).multiply(R).multiply(b.pw).multiply(b.rest);
            b.bone.quaternion.copy(tmp);
        }
    };

    const st = {
        seat: 0, lean: 0.04, fidget: 1, lift: 0, tilt: 0, pitch: 0, armLift: 0, talk: 0, yaw: 0, headPitch: 0,
        phase: Math.random() * 6, tv: new THREE.Vector3(), head: new THREE.Vector3(), inv: new THREE.Matrix4(), walkT: 0,
    };

    function update(dt, t, s) {
        const k = Math.min(1, dt * 4);
        st.seat += (s.seat - st.seat) * Math.min(1, dt * 6);
        const m = POSE[s.mood] || POSE.n;
        st.lean += (m[0] - st.lean) * k; st.fidget += (m[1] - st.fidget) * k; st.lift += (m[2] - st.lift) * k;
        st.tilt += (m[3] - st.tilt) * k; st.pitch += (m[4] - st.pitch) * k; st.armLift += (m[5] - st.armLift) * k;
        const walk = s.walk || 0;
        st.talk += ((s.talking ? 1 : 0) - st.talk) * Math.min(1, dt * 6);
        st.walkT += dt * 7 * (walk ? 1 : 0);
        const seat = st.seat, stand = 1 - seat;
        const br = Math.sin(t * 1.7 + st.phase);
        const ph = st.phase;

        // the whole figure: sat down on the chair, a bob when walking
        const drop = Math.max(0, hipY - SEAT_TOP);
        rig.position.y = -drop * seat + st.lift * seat + Math.abs(Math.sin(st.walkT)) * 0.025 * walk + br * 0.003;
        rig.position.z = -SEAT_BACK * seat;

        // spine: breathing, a lean for the mood, a nod when talking, a sway while walking
        const talkNod = st.talk * (Math.abs(Math.sin(t * 9 + ph)) * 0.03 + Math.sin(t * 2.3 + ph) * 0.012);
        const leanTotal = st.lean * seat + 0.05 * walk + talkNod + br * 0.006;
        const sway = Math.sin(t * 0.8 + ph) * 0.012 * st.fidget * seat + Math.sin(st.walkT) * 0.04 * walk;
        set('Spine', leanTotal * 0.3, 0, sway * 0.3);
        set('Spine01', leanTotal * 0.35, Math.sin(st.walkT) * 0.07 * walk, sway * 0.4);
        set('Spine02', leanTotal * 0.35, -Math.sin(st.walkT) * 0.07 * walk, sway * 0.3);

        // head and neck: look at the seer when seated, a mood's tilt and nod on top
        let yaw = 0, pitch = 0;
        if (s.look && seat > 0.4 && B.Head) {
            // the direction from the head to the seer, in the figure's own frame (+z is the way it faces)
            g.updateWorldMatrix(true, false);
            st.tv.copy(s.look).sub(st.head.setFromMatrixPosition(B.Head.bone.matrixWorld));
            st.tv.transformDirection(st.inv.copy(g.matrixWorld).invert());
            yaw = clamp(Math.atan2(st.tv.x, st.tv.z) * 0.8, -0.7, 0.7);
            pitch = clamp(-Math.atan2(st.tv.y, Math.hypot(st.tv.x, st.tv.z)) * 0.6, -0.3, 0.35);
        }
        yaw += Math.sin(t * 0.6 + ph) * 0.03 * seat + st.talk * Math.sin(t * 3.1 + ph) * 0.05;
        st.yaw += (yaw - st.yaw) * Math.min(1, dt * 4);
        st.headPitch += (pitch + st.pitch - st.headPitch) * Math.min(1, dt * 4);
        const nodTalk = st.talk * Math.abs(Math.sin(t * 9 + ph)) * 0.05;
        const tilt = st.tilt * seat + Math.sin(t * 0.7 + ph) * 0.02 * st.fidget;
        // the spine leans forward, so the head tips back by part of it to keep looking ahead
        set('neck', st.headPitch * 0.35 - leanTotal * 0.35 + nodTalk * 0.4, st.yaw * 0.4, tilt * 0.4);
        set('Head', st.headPitch * 0.65 - leanTotal * 0.3 + nodTalk * 0.6, st.yaw * 0.6, tilt * 0.6);

        // arms: hang by the sides standing or walking; seated they come in and forward to the table, and gesture when talking
        for (const side of ['Left', 'Right']) {
            const a = arm[side], sg = a.sign;
            const swing = Math.sin(st.walkT + (side === 'Left' ? 0 : Math.PI)) * 0.5 * walk;
            const lower = -a.out * sg;                                         // from the A-pose to hanging
            const gest = st.talk * Math.max(0, Math.sin(t * 2.2 + (side === 'Left' ? 0 : 2) + ph));
            const fidgetArm = Math.sin(t * 1.3 + (side === 'Left' ? 0 : 1.7) + ph) * 0.03 * st.fidget;
            // seated: the upper arm comes forward 35°, the forearm bends up ~55° so the hands rest on the table's edge
            const fwd = -(0.45 * seat) - swing - gest * 0.35 - st.armLift * seat - fidgetArm;
            const inward = -sg * (0.1 * seat + gest * 0.08);
            set(side + 'Arm', fwd, 0, lower * (0.92) + inward);
            // the forearm still angles outward from the A-pose: turn it in so the hands come together over the table
            set(side + 'ForeArm', -(0.95 * seat + 0.12 * stand + gest * 0.55 + Math.max(0, swing) * 0.5), 0, -sg * (0.42 * seat + gest * 0.1));
        }

        // legs: straight when standing, thighs forward and knees bent when seated, a stride when walking
        for (const side of ['Left', 'Right']) {
            const stride = Math.sin(st.walkT + (side === 'Left' ? Math.PI : 0)) * 0.5 * walk;
            set(side + 'UpLeg', -1.45 * seat - stride, 0, 0);
            set(side + 'Leg', 1.45 * seat + Math.max(0, -stride) * 0.9, 0, 0);
        }
        apply();
    }

    return {
        group: g, update, model: true,
        setSeat(v) { st.seat = v; },
        // geometry, materials and textures belong to the cache; only this clone's skeleton and nodes go
        dispose() {
            g.removeFromParent();
            body.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose(); });
        },
    };
}
