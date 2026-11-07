// Every model in the game, built from primitives in code. Local +Y is "up off the rock" and +Z is
// "forward"; the view orients each one on the sphere with orient().
//
// The look is the late-sixties idea of the future: white enamel and brushed metal, round pods with
// dark windows, a red lens watching you, and black slabs that reflect the stars.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
/** Place obj at unit position p (array), standing on radius r, facing tangent fwd (array). */
export function orient(obj, p, fwd, r) {
    _y.set(p[0], p[1], p[2]);
    _z.set(fwd[0], fwd[1], fwd[2]);
    _z.addScaledVector(_y, -_z.dot(_y));
    if (_z.lengthSq() < 1e-8) { _z.set(1, 0, 0).addScaledVector(_y, -_y.x); if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_y, -_y.z); }
    _z.normalize();
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z);
    obj.quaternion.setFromRotationMatrix(_m);
    obj.position.set(p[0] * r, p[1] * r, p[2] * r);
}

export function makeMaterials(envMap) {
    const std = (o) => new THREE.MeshStandardMaterial({ envMap, ...o });
    return {
        suit: std({ color: 0xf2efe8, roughness: 0.62, envMapIntensity: 0.35 }),
        suitDark: std({ color: 0x8b8a86, roughness: 0.7, envMapIntensity: 0.2 }),
        visor: std({ color: 0xd9a641, roughness: 0.08, metalness: 1.0, envMapIntensity: 1.3 }),
        metal: std({ color: 0xb9bcc2, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.9 }),
        white: std({ color: 0xebe8e2, roughness: 0.35, envMapIntensity: 0.45 }),
        black: std({ color: 0x050506, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.1 }),
        dark: std({ color: 0x1b1c20, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.5 }),
        window: std({ color: 0x0a0d12, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.4 }),
        redLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 0.25, 0.12) }),
        amberLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 1.6, 0.3) }),
        blueLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.6, 4.0) }),
        violetLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 4.0) }),
        whiteLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }),
    };
}

const shadow = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// ------------------------------------------------------------------ the commander
export function makePlayer(M) {
    const root = new THREE.Group();
    const body = new THREE.Group();          // turns to the aim
    root.add(body);
    const hips = new THREE.Group();
    hips.position.y = 0.55;
    body.add(hips);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.32, 6, 14), M.suit);
    torso.position.y = 0.32;
    hips.add(torso);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), M.white);
    pack.position.set(0, 0.36, -0.25);
    hips.add(pack);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), M.redLight);
    lamp.position.set(0.12, 0.52, -0.36);
    hips.add(lamp);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.06), M.suitDark);
    chest.position.set(0, 0.4, 0.22);
    hips.add(chest);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), M.suit);
    helmet.position.y = 0.78;
    hips.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.5), M.visor);
    visor.position.set(0, 0.79, 0.045);
    hips.add(visor);
    // legs and arms on pivots
    const limb = (len, r) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2 - r * 0.5, 0); return g; };
    const legs = [-1, 1].map((s) => {
        const piv = new THREE.Group();
        piv.position.set(0.11 * s, 0.05, 0);
        const leg = new THREE.Mesh(limb(0.36, 0.09), M.suit);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), M.suitDark);
        boot.position.set(0, -0.52, 0.04);
        piv.add(leg, boot);
        hips.add(piv);
        return piv;
    });
    const gun = new THREE.Group();
    gun.position.set(0.0, 0.33, 0.18);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 10), M.metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.28;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), M.dark);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.blueLight);
    muzzle.position.z = 0.6;
    gun.add(barrel, stock, muzzle);
    hips.add(gun);
    const arms = [-1, 1].map((s) => {
        const piv = new THREE.Group();
        piv.position.set(0.3 * s, 0.5, 0.02);
        const arm = new THREE.Mesh(limb(0.28, 0.075), M.suit);
        piv.add(arm);
        piv.rotation.x = -1.15;
        piv.rotation.z = -0.35 * s;
        hips.add(piv);
        return piv;
    });
    shadow(root);
    lamp.castShadow = false; muzzle.castShadow = false;
    return { root, body, hips, legs, arms, gun, muzzle };
}

// ------------------------------------------------------------------ enemies
export function makeDrone(M) {
    const root = new THREE.Group();
    const pod = new THREE.Group();
    pod.position.y = 0.95;
    root.add(pod);
    pod.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), M.white));
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), M.window);
    win.position.set(0, 0.06, 0.49);
    pod.add(win);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.redLight);
    eye.position.set(0, 0.06, 0.47);
    pod.add(eye);
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), M.metal);
        arm.position.set(0.22 * s, -0.24, 0.42);
        arm.rotation.x = 0.4;
        pod.add(arm);
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), M.metal);
        claw.position.set(0.22 * s, -0.33, 0.62);
        pod.add(claw);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), M.dark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.18;
    pod.add(ring);
    const jet = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), M.blueLight);
    jet.rotation.x = Math.PI / 2;
    jet.position.y = -0.49;
    pod.add(jet);
    shadow(root);
    return { root, pod, spin: null };
}

export function makeSeeker(M) {
    const root = new THREE.Group();
    const pod = new THREE.Group();
    pod.position.y = 0.7;
    root.add(pod);
    const g = new THREE.OctahedronGeometry(0.38, 0);
    g.scale(0.7, 0.55, 1.5);
    pod.add(new THREE.Mesh(g, M.dark));
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), M.amberLight);
    core.scale.set(1, 1, 1.8);
    pod.add(core);
    for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.2), M.metal);
        fin.position.set(0.3 * s, 0, -0.25);
        fin.rotation.y = 0.5 * s;
        pod.add(fin);
    }
    shadow(root);
    return { root, pod, spin: core };
}

export function makeShard(M) {
    const root = new THREE.Group();
    const pod = new THREE.Group();
    pod.position.y = 1.4;
    root.add(pod);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 0.12), M.black);
    pod.add(slab);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.6, 0.14), M.redLight);
    pod.add(seam);
    pod.rotation.z = 0.25;
    shadow(root);
    seam.castShadow = false;
    return { root, pod, spin: null };
}

// ------------------------------------------------------------------ beacons
export function makeTurret(M, kind) {
    const root = new THREE.Group();
    const light = kind === 'burst' ? M.amberLight : kind === 'ring' ? M.violetLight : M.redLight;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 0.5, 24), M.white);
    base.position.y = 0.25;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), M.metal);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.5;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 12), M.metal);
    neck.position.y = 0.66;
    root.add(base, collar, neck);
    const head = new THREE.Group();
    head.position.y = 1.18;
    root.add(head);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 20), M.white);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.12, 28), M.black);
    face.rotation.x = Math.PI / 2;
    face.position.z = 0.46;
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), light);
    iris.position.z = 0.525;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 2.4) }));
    pupil.position.z = 0.53;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 32), M.metal);
    rim.position.z = 0.52;
    head.add(shell, face, iris, pupil, rim);
    // health: a ring of light round the base that shrinks as it takes damage
    const hpMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uFrac: { value: 1 }, uCol: { value: light.color.clone().multiplyScalar(0.5) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uFrac; uniform vec3 uCol; varying vec2 vUv;
void main(){ float a = vUv.x; if (a > uFrac) discard; gl_FragColor = vec4(uCol * (0.6 + 0.4 * smoothstep(0.0, 0.5, vUv.y)), 1.0); }`,
    });
    const hpRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 48, 1), hpMat);
    hpRing.rotation.x = -Math.PI / 2;
    hpRing.position.y = 0.03;
    // RingGeometry's uv is planar; give it an angle-around coordinate instead
    const uv = hpRing.geometry.attributes.uv, pp = hpRing.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
        const a = Math.atan2(pp.getY(i), pp.getX(i));
        uv.setXY(i, (a + Math.PI) / (Math.PI * 2), Math.hypot(pp.getX(i), pp.getY(i)) > 1.06 ? 1 : 0);
    }
    root.add(hpRing);
    const wreck = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 0.35, 10), M.dark);
    w1.position.y = 0.17;
    wreck.add(w1);
    for (let i = 0; i < 5; i++) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.2 + (i % 2) * 0.15, 0.08, 0.3), M.dark);
        const a = i * 1.3;
        sh.position.set(Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9);
        sh.rotation.set(i, a, i * 0.5);
        wreck.add(sh);
    }
    wreck.visible = false;
    root.add(wreck);
    shadow(root);
    hpRing.castShadow = false; iris.castShadow = false; pupil.castShadow = false;
    return { root, head, iris, hpMat, wreck, alive: [base, collar, neck, head, hpRing] };
}

export function makePylon(M) {
    const root = new THREE.Group();
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, 3.0, 4), M.black);
    ob.rotation.y = Math.PI / 4;
    ob.position.y = 1.5;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), M.amberLight);
    core.position.y = 3.35;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 32), M.metal);
    halo.position.y = 3.35;
    root.add(ob, core, halo);
    const head = new THREE.Group();
    root.add(head);
    const wreck = new THREE.Group();
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.8, 4), M.dark);
    stump.position.y = 0.4;
    wreck.add(stump);
    wreck.visible = false;
    root.add(wreck);
    shadow(root);
    core.castShadow = false;
    return { root, head, iris: core, hpMat: null, wreck, alive: [ob, core, halo], halo };
}

// ------------------------------------------------------------------ slabs: the gate and the boss
/** A glossy black slab whose face holds a deep field of stars that brightens with uGlow. */
export function slabMaterial(envMap) {
    const m = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.05, metalness: 0.4, envMap, envMapIntensity: 1.2 });
    m.userData.uniforms = { uGlow: { value: 0 }, uTime: { value: 0 } };
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, m.userData.uniforms);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying vec3 vLoc;\nuniform float uGlow, uTime;\n${NOISE}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  // parallax: look "into" the slab, so the stars sit at different depths behind the surface
  vec3 vd = normalize(vViewPosition);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float dep = 1.0 + float(i) * 1.7;
    vec3 q = vLoc * (6.0 + float(i) * 5.0) + vd * dep + vec3(0.0, uTime * 0.05 * float(i + 1), 0.0);
    vec3 c = floor(q);
    vec3 r = h33(c);
    vec3 sp = c + 0.25 + h33(c + 1.3) * 0.5;
    float d = length(q - sp);
    acc += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.6), r.y) * smoothstep(0.12, 0.0, d) * step(r.x, 0.3) * (1.4 - float(i) * 0.35);
  }
  float neb = fbm3(vLoc * 2.0 + vec3(0.0, uTime * 0.03, 0.0), 3);
  acc += vec3(0.25, 0.3, 0.6) * neb * neb * 0.6;
  totalEmissiveRadiance += acc * (0.08 + uGlow * 1.6);
}`);
    };
    return m;
}

export function makeGate(M, envMap) {
    const root = new THREE.Group();
    const lift = new THREE.Group();
    root.add(lift);
    const mat = slabMaterial(envMap);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.4, 0.25), mat);   // 1 : 4 : 9, near enough
    slab.position.y = 2.2;
    lift.add(slab);
    // a column of pale light when the gate is open
    const beamMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float uA, uTime; varying vec2 vUv;
void main(){ float e = 1.0 - abs(vUv.x - 0.5) * 2.0; float f = clamp(1.0 - vUv.y, 0.0, 1.0);
  float wave = 0.75 + 0.25 * sin(vUv.y * 30.0 - uTime * 4.0);
  gl_FragColor = vec4(vec3(0.5, 0.75, 1.2) * pow(clamp(e, 0.0, 1.0), 2.0) * f * f * wave * uA, 1.0); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 24, 24, 1, true), beamMat);
    beam.position.y = 12;
    root.add(beam);
    shadow(lift);
    return { root, lift, slab, mat, beamMat, beam };
}

export function makeBoss(M, envMap) {
    const root = new THREE.Group();
    const float = new THREE.Group();
    float.position.y = 3.2;
    root.add(float);
    const mat = slabMaterial(envMap);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.2, 0.4), mat);
    float.add(slab);
    const seams = [];
    for (const y of [-1.6, 0, 1.6]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.04, 0.44), M.amberLight);
        s.position.y = y;
        float.add(s);
        seams.push(s);
    }
    const orbit = new THREE.Group();
    orbit.position.y = 2.6;
    root.add(orbit);
    const sats = [];
    for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.1), M.black);
        const a = (i / 4) * Math.PI * 2;
        s.position.set(Math.cos(a) * 2.6, Math.sin(a * 2) * 0.4, Math.sin(a) * 2.6);
        s.rotation.y = -a;
        orbit.add(s);
        sats.push(s);
    }
    const shieldMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 1 }, uTime: { value: 0 }, uHit: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uA, uTime, uHit; varying vec3 vN; varying vec3 vV; varying vec3 vP;
${NOISE}
void main(){
  float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.5);
  float hex = vn3(vP * 3.0 + uTime * 0.4);
  vec3 iri = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 0.8 + hex * 0.4 + uTime * 0.05));
  gl_FragColor = vec4(iri * (f * 1.4 + 0.05 + uHit * 0.6) * uA, 1.0);
}`,
    });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 40, 24), shieldMat);
    shield.position.y = 2.6;
    root.add(shield);
    shadow(float); shadow(orbit);
    for (const s of seams) s.castShadow = false;
    return { root, float, slab, mat, seams, orbit, sats, shield, shieldMat };
}

// ------------------------------------------------------------------ pickups
export function makePickup(M, kind) {
    const root = new THREE.Group();
    const spin = new THREE.Group();
    spin.position.y = 0.75;
    root.add(spin);
    if (kind === 'repair') {
        spin.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.white));
        for (const [w, h] of [[0.34, 0.1], [0.1, 0.34]]) {
            for (const z of [0.26, -0.26]) {
                const c = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.redLight);
                c.position.z = z;
                if (z < 0) c.rotation.y = Math.PI;
                spin.add(c);
            }
        }
    } else if (kind === 'power') {
        spin.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), M.amberLight));
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 32), M.metal);
        r.rotation.x = Math.PI / 2;
        spin.add(r);
    } else {
        spin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), M.violetLight));
    }
    return { root, spin };
}
