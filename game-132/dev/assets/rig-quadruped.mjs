// rig-quadruped.mjs NAME IN.glb OUT.glb — rig a static four-legged Meshy model (Meshy's auto-rigger is humanoid only).
//
// Builds a dog-shaped skeleton at hand-measured landmarks (RIGS below, in the model's own units: the static models
// from opt.mjs stand on y = 0, 1 unit tall, head toward +Z), skins every vertex to its nearest bones, and bakes two
// clips: 'walk' (a looping trot) and 'attack' (a lunge and a bite). The game plays them like any rigged model
// (js/view/models.js takes the clip named 'walk' to walk and 'attack' to attack).
//   node rig-quadruped.mjs pet WORK/static-pet.glb game-132/assets/models/pet.glb
// IN is the static model from opt.mjs (never a rigged one: the script refuses). Ember's static model is the
// assets/models/pet.glb of game-132 v1.1.1 in git history.
//
// Needs @gltf-transform/core, functions, extensions (see README.md). Landmarks come from a side profile of the mesh:
// for each slice along Z, its top, its lowest point, and where the feet touch the ground (`profile` mode prints it):
//   node rig-quadruped.mjs profile IN.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize, prune, dedup } from '@gltf-transform/functions';

// ---------------------------------------------------------------------------------------------- the skeletons
// Joint heads in model space. Each bone runs from its head to `to` (its child's head, or an end point).
// legs: which side and end each leg is on, and below what height (and in what Z band) a vertex counts as leg.
const RIGS = {
    pet: {                                        // Ember the lynx-wolf: 1.62 long, back at 0.68, ears at 1.0
        joints: {
            hips: { at: [0, 0.52, -0.30], to: 'spine' },
            spine: { parent: 'hips', at: [0, 0.55, 0.04], to: 'chest' },
            chest: { parent: 'spine', at: [0, 0.58, 0.36], to: 'neck' },
            neck: { parent: 'chest', at: [0, 0.66, 0.50], to: 'head' },
            head: { parent: 'neck', at: [0, 0.80, 0.60], end: [0, 0.74, 0.84] },
            tail1: { parent: 'hips', at: [0, 0.50, -0.50], to: 'tail2' },
            tail2: { parent: 'tail1', at: [0, 0.38, -0.66], end: [0, 0.27, -0.88] },
            thighL: { parent: 'hips', at: [-0.13, 0.46, -0.30], to: 'shinL', leg: 'BL' },
            shinL: { parent: 'thighL', at: [-0.15, 0.22, -0.33], end: [-0.15, 0.0, -0.30], leg: 'BL' },
            thighR: { parent: 'hips', at: [0.13, 0.46, -0.30], to: 'shinR', leg: 'BR' },
            shinR: { parent: 'thighR', at: [0.15, 0.22, -0.33], end: [0.15, 0.0, -0.30], leg: 'BR' },
            armL: { parent: 'chest', at: [-0.10, 0.46, 0.37], to: 'forearmL', leg: 'FL' },
            forearmL: { parent: 'armL', at: [-0.09, 0.22, 0.39], end: [-0.085, 0.0, 0.40], leg: 'FL' },
            armR: { parent: 'chest', at: [0.10, 0.46, 0.37], to: 'forearmR', leg: 'FR' },
            forearmR: { parent: 'armR', at: [0.09, 0.22, 0.39], end: [0.085, 0.0, 0.40], leg: 'FR' },
        },
        legs: { back: { z: [-0.50, -0.12], below: 0.34 }, front: { z: [0.14, 0.55], below: 0.30 } },
        walk: { len: 1.1, swing: 0.5, knee: 0.55, bob: 0.025 },
    },
};

// ---------------------------------------------------------------------------------------------- small maths
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function segDist(p, a, b) {
    const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
const qAxis = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
// pitch: + tips a downward bone's lower end toward -Z (back); a leg swings forward with a negative pitch
const pitch = (a) => qAxis(X, a), yaw = (a) => qAxis(Y, a), roll = (a) => qAxis(Z, a);

// ---------------------------------------------------------------------------------------------- the clips
// Each returns, for time t in [0, len], { joint: quaternion } and a hips offset. Pairs of diagonal legs move together
// (a trot): left-front with right-back, right-front with left-back.
function walkPose(R, t) {
    const W = R.walk, ph = (t / W.len) * Math.PI * 2;
    const leg = (p) => {                          // p: the leg's phase; the knee folds while the foot swings forward
        const s = Math.sin(p);
        return { up: pitch(-W.swing * s), low: Math.cos(p) > 0 ? W.knee * Math.cos(p) : 0 };
    };
    const a = leg(ph), b = leg(ph + Math.PI);
    return {
        rot: {
            armL: a.up, forearmL: pitch(-a.low), thighR: a.up, shinR: pitch(a.low * 0.8),
            armR: b.up, forearmR: pitch(-b.low), thighL: b.up, shinL: pitch(b.low * 0.8),
            spine: roll(Math.sin(ph) * 0.04), chest: roll(-Math.sin(ph) * 0.05),
            neck: pitch(Math.sin(ph * 2) * 0.05), head: pitch(-Math.sin(ph * 2) * 0.05),
            tail1: yaw(Math.sin(ph) * 0.18), tail2: qMul(yaw(Math.sin(ph - 0.8) * 0.45), pitch(-0.15)),
        },
        hips: [0, -Math.abs(Math.cos(ph)) * W.bob + W.bob * 0.5, 0],
    };
}
function attackPose(R, t, len) {
    // 0 → 0.35: crouch and spring forward, jaws reaching; 0.35 → 0.5: the snap; then settle back
    const k = t / len, ease = (x) => x * x * (3 - 2 * x);
    const lunge = k < 0.45 ? ease(k / 0.45) : 1 - ease((k - 0.45) / 0.55);
    const crouch = k < 0.2 ? ease(k / 0.2) * (1 - lunge) : 0;
    const snap = Math.max(0, 1 - Math.abs(k - 0.42) / 0.1);
    return {
        rot: {
            spine: pitch(0.15 * lunge - 0.1 * crouch), chest: pitch(0.12 * lunge),
            neck: pitch(-0.35 * lunge), head: pitch(0.25 * lunge - 0.45 * snap),
            armL: pitch(-0.75 * lunge), armR: pitch(-0.65 * lunge), forearmL: pitch(-0.4 * lunge), forearmR: pitch(-0.5 * lunge),
            thighL: pitch(0.35 * lunge - 0.2 * crouch), thighR: pitch(0.3 * lunge - 0.2 * crouch),
            shinL: pitch(0.3 * crouch), shinR: pitch(0.3 * crouch),
            tail1: pitch(-0.15 * lunge), tail2: qMul(pitch(-0.4 * lunge), yaw(Math.sin(k * 20) * 0.3 * lunge)),
        },
        hips: [0, 0.06 * lunge - 0.06 * crouch, 0.18 * lunge],
    };
}

// ---------------------------------------------------------------------------------------------- read the mesh
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [name, src, out] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
const meshNode = root.listNodes().find((n) => n.getMesh());
if (meshNode.getSkin()) throw new Error(`${src} is already rigged`);
await doc.transform(dequantize());
// bake the node's transform into the vertices (a skinned mesh's own transform is ignored by the glTF spec)
const nT = meshNode.getTranslation(), nS = meshNode.getScale();
const prims = meshNode.getMesh().listPrimitives();
const P = [];
for (const prim of prims) {
    const pos = prim.getAttribute('POSITION'), v = [];
    const arr = new Float32Array(pos.getCount() * 3);
    for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const p = [v[0] * nS[0] + nT[0], v[1] * nS[1] + nT[1], v[2] * nS[2] + nT[2]];
        arr.set(p, i * 3); P.push(p);
    }
    pos.setArray(arr);
}
meshNode.setTranslation([0, 0, 0]).setScale([1, 1, 1]);

if (name === 'profile') {
    for (let z = -0.9; z < 0.9; z += 0.08) {
        const s = P.filter((p) => p[2] >= z && p[2] < z + 0.08);
        if (s.length) console.log(`z ${z.toFixed(2)}  top ${Math.max(...s.map((p) => p[1])).toFixed(2)}  low ${Math.min(...s.map((p) => p[1])).toFixed(2)}  on the ground ${s.filter((p) => p[1] < 0.05).length}`);
    }
    process.exit(0);
}
const R = RIGS[name];
if (!R) throw new Error(`no rig for ${name}: add it to RIGS`);

// ---------------------------------------------------------------------------------------------- the skeleton
const names = Object.keys(R.joints), J = R.joints;
const nodes = {};
for (const j of names) {
    const d = J[j], parent = d.parent ? J[d.parent].at : [0, 0, 0];
    nodes[j] = doc.createNode(`${name}_${j}`).setTranslation(sub(d.at, parent));
}
for (const j of names) if (J[j].parent) nodes[J[j].parent].addChild(nodes[j]);
root.listScenes()[0].addChild(nodes.hips);
const buf = root.listBuffers()[0] || doc.createBuffer();
const skin = doc.createSkin('rig').setSkeleton(nodes.hips);
const ibm = new Float32Array(names.length * 16);
names.forEach((j, i) => {
    skin.addJoint(nodes[j]);
    const a = J[j].at;                            // bind pose: no rotation, so the inverse is a translation
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -a[0], -a[1], -a[2], 1], i * 16);
});
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buf));
meshNode.setSkin(skin);

// ---------------------------------------------------------------------------------------------- skin weights
// A vertex in a leg band (low, in that leg's Z range, on that leg's side) takes only that leg's bones and the body
// bone it hangs from; everything else takes the body, neck, head, tail and the upper leg bones. Within its set, a
// bone's weight falls off with distance to the bone (the fourth power in a leg, the third, softer, in the body, so
// the rump stretches instead of tearing where the tail joins); the best four are kept.
const seg = (j) => [J[j].at, J[j].end || J[J[j].to].at];
const legOf = (p) => {
    const L = R.legs, side = p[0] < 0 ? 'L' : 'R';
    if (p[1] < L.back.below && p[2] > L.back.z[0] && p[2] < L.back.z[1]) return 'B' + side;
    if (p[1] < L.front.below && p[2] > L.front.z[0] && p[2] < L.front.z[1]) return 'F' + side;
    return null;
};
const body = names.filter((j) => !J[j].leg || !J[j].end);   // body bones plus the upper leg bones
let nLeg = 0;
for (const prim of prims) {
    const n = prim.getAttribute('POSITION').getCount();
    const joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
        const p = P[i];
        const leg = legOf(p);
        if (leg) nLeg++;
        const set = leg ? [...names.filter((j) => J[j].leg === leg), leg[0] === 'B' ? 'hips' : 'chest'] : body;
        const e = leg ? 4 : 3, pad = leg ? 0.02 : 0.05;
        const w = set.map((j) => ({ j, w: 1 / (segDist(p, ...seg(j)) + pad) ** e })).sort((a, b) => b.w - a.w).slice(0, 4);
        const sum = w.reduce((s, x) => s + x.w, 0);
        w.forEach((x, k) => { joints[i * 4 + k] = names.indexOf(x.j); weights[i * 4 + k] = x.w / sum; });
    }
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(joints).setBuffer(buf));
    prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(buf));
}

// ---------------------------------------------------------------------------------------------- bake the clips
function bake(clip, len, pose, fps = 30) {
    const anim = doc.createAnimation(clip);
    const frames = Math.round(len * fps) + 1;
    const times = new Float32Array(frames).map((_, f) => (f / (frames - 1)) * len);
    const track = (node, path, vals) => {
        const s = doc.createAnimationSampler().setInterpolation('LINEAR')
            .setInput(doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buf))
            .setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(vals).setBuffer(buf));
        anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
    };
    const poses = [...times].map((t) => pose(R, t, len));
    for (const j of names) {
        const v = new Float32Array(frames * 4);
        poses.forEach((ps, f) => v.set(ps.rot[j] || [0, 0, 0, 1], f * 4));
        track(nodes[j], 'rotation', v);
    }
    const hv = new Float32Array(frames * 3), h0 = J.hips.at;
    poses.forEach((ps, f) => hv.set([h0[0] + ps.hips[0], h0[1] + ps.hips[1], h0[2] + ps.hips[2]], f * 3));
    track(nodes.hips, 'translation', hv);
}
bake('walk', R.walk.len, walkPose);              // first: the game falls back to the first clip as the walk
bake('attack', 0.6, attackPose);

// quantised like the other models (positions 14 bits, normals 10, UVs 12, weights 8): 732 KB → 471 KB
await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }));
await io.write(out, doc);
console.log(`${out}: ${names.length} bones, ${P.length} vertices (${nLeg} in legs), clips walk ${R.walk.len}s and attack 0.6s`);
