// The dragonfly companion's body and flight: a jewel-bright dragonfly, about
// a hand long, built in code (segmented abdomen, huge eyes, four veined glass
// wings beating out of phase), and the way it flies: hovering beside your
// shoulder, darting to a new spot every few seconds, flying ahead to show you
// things, perching on the lamp at the end of the dock, and doing tricks.
// companion.js decides what it does; this file only flies it.
//
// It flies in whichever scene is being drawn (the garden, the Hut, the
// Springwood...), so everything here is in the camera's world space.

import * as THREE from 'three';
import { glowSprite } from './textures.js';
import { damp, clamp } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
const qa = new THREE.Quaternion(), mtx = new THREE.Matrix4();

// ---------------------------------------------------------------- wings

const wingVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// u runs from the root (0) to the tip (1), v across the chord. The outline, the
// veins and a hue that slides with the viewing angle (thin-film iridescence) are
// all worked out here, so the wing is a single quad.
const wingFrag = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uTip;
uniform float uIri;
uniform float uStars;
uniform float uGlow;
uniform float uHind;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
    float u = vUv.x, v = vUv.y * 2.0 - 1.0;
    // chord: narrow at the root, widest a third of the way out, rounded tip; the hind wing is broader at the root
    float w = mix(0.32, 0.62, uHind) + 0.6 * sin(min(u * 1.25, 1.0) * 3.14159) * (1.0 - 0.25 * u);
    w *= sqrt(max(0.0, 1.0 - pow(u, 6.0)));
    float edge = w - abs(v - 0.12 * u);
    if (edge < 0.0 || u < 0.0) discard;
    float rim = smoothstep(0.0, 0.06, edge);
    // veins: a few long ones along the span, a net of cross veins between them
    float along = abs(fract((v - 0.12 * u) * 3.0 / max(w, 0.05) + 0.5) - 0.5);
    float cross = abs(fract(u * 18.0 + hash(vec2(floor((v + 1.0) * 6.0), 1.0)) * 0.6) - 0.5);
    float veins = max(1.0 - smoothstep(0.0, 0.06, along), (1.0 - smoothstep(0.0, 0.05, cross)) * 0.5);
    float stig = smoothstep(0.86, 0.9, u) * (1.0 - smoothstep(0.93, 0.97, u)) * step(0.0, v - 0.12 * u) * step(abs(v - 0.12 * u - w * 0.6), w * 0.35);
    float facing = abs(dot(normalize(vN), vView));
    vec3 film = hue(fract(facing * 1.6 + u * 0.7 + 0.15));
    vec3 col = mix(uTint, uTip, smoothstep(0.55, 1.0, u));
    col = mix(col, col * (0.55 + film * 0.9), uIri);
    col = mix(col, vec3(0.08, 0.06, 0.05), veins * 0.55);
    col = mix(col, vec3(0.1, 0.05, 0.02), stig);
    if (uStars > 0.5) {
        vec2 g = floor(vec2(u * 26.0, v * 10.0));
        float s = step(0.93, hash(g));
        col += vec3(1.0, 0.95, 0.8) * s * (1.0 - smoothstep(0.0, 0.35, length(fract(vec2(u * 26.0, v * 10.0)) - 0.5)));
    }
    float a = (0.26 + veins * 0.45 + stig * 0.6 + (1.0 - rim) * 0.4) * (0.7 + 0.3 * (1.0 - facing));
    gl_FragColor = vec4(col * (1.0 + uGlow), clamp(a, 0.0, 0.92));
    #include <colorspace_fragment>
}`;

function wingMaterial(hind) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTint: { value: new THREE.Color('#dff4ff') },
            uTip: { value: new THREE.Color('#ffffff') },
            uIri: { value: 0.4 },
            uStars: { value: 0 },
            uGlow: { value: 0 },
            uHind: { value: hind ? 1 : 0 },
        },
        vertexShader: wingVert,
        fragmentShader: wingFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
}

// ---------------------------------------------------------------- the body

/** Lay a quad from the root (x = 0) out to `len` along +x, `chord` deep. */
function wingGeo(len, chord) {
    const g = new THREE.PlaneGeometry(len, chord, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(len / 2, 0, 0);
    return g;
}

export class Dragonfly {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'dragonfly';
        this.body = new THREE.Group();     // tilts and rolls inside the group, which only turns
        this.group.add(this.body);
        this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x33d67e, roughness: 0.32, metalness: 0.35, emissive: 0x33d67e, emissiveIntensity: 0.18 });
        this.bandMat = new THREE.MeshStandardMaterial({ color: 0x0d6e4a, roughness: 0.4, metalness: 0.3, emissive: 0x0d6e4a, emissiveIntensity: 0.12 });
        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a7cff, roughness: 0.12, metalness: 0.1, emissive: 0x2a7cff, emissiveIntensity: 0.35 });
        this.legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        const b = this.body;
        const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
            m.position.set(x, y, z);
            m.scale.set(sx, sy, sz);
            b.add(m);
            return m;
        };
        // thorax, head and the two great eyes (the body points along +z)
        sph(0.034, this.bodyMat, 0, 0, 0, 0.95, 1.05, 1.35);
        sph(0.026, this.bandMat, 0, 0.006, 0.05, 1.2, 0.95, 0.85);
        sph(0.022, this.eyeMat, -0.017, 0.012, 0.062);
        sph(0.022, this.eyeMat, 0.017, 0.012, 0.062);
        const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (const s of [-1, 1]) sph(0.005, shine, s * 0.024, 0.026, 0.074);
        // the abdomen: ten tapering segments, banded, with a gentle droop toward the tip
        this.tail = new THREE.Group();
        this.tail.position.set(0, 0, -0.035);
        b.add(this.tail);
        let z = 0;
        for (let i = 0; i < 10; i++) {
            const r = 0.017 - i * 0.0009;
            const len = 0.021;
            const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10).rotateX(Math.PI / 2), i % 2 ? this.bandMat : this.bodyMat);
            seg.position.set(0, -i * i * 0.0004, z - len / 2 - r * 0.4);
            this.tail.add(seg);
            z -= len + r * 0.35;
        }
        for (const s of [-1, 1]) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.022, 5).rotateX(-Math.PI / 2), this.legMat);
            c.position.set(s * 0.005, -0.04, z - 0.008);
            c.rotation.y = s * 0.25;
            this.tail.add(c);
        }
        // six legs folded under the thorax, like a basket for catching midges
        for (let i = 0; i < 3; i++) {
            for (const s of [-1, 1]) {
                const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0016, 0.045, 4), this.legMat);
                l.position.set(s * 0.016, -0.03, 0.022 - i * 0.02);
                l.rotation.set(0.5 - i * 0.35, 0, s * 0.7);
                b.add(l);
            }
        }
        // four wings, each on a pivot at its root
        this.wings = [];
        this.wingMats = [wingMaterial(false), wingMaterial(true)];
        for (const hind of [0, 1]) {
            for (const s of [-1, 1]) {
                const pivot = new THREE.Group();
                pivot.position.set(s * 0.012, 0.026, hind ? -0.014 : 0.016);
                const w = new THREE.Mesh(wingGeo(hind ? 0.15 : 0.158, 0.075), this.wingMats[hind]);
                w.renderOrder = 2;
                if (s < 0) w.scale.x = -1;
                // swept a little back
                pivot.rotation.y = s * (hind ? -0.18 : 0.12) * -1;
                pivot.add(w);
                b.add(pivot);
                this.wings.push({ pivot, side: s, hind });
            }
        }
        // a soft glow, stronger at night and with the lantern
        this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x9fffd0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
        this.glow.scale.setScalar(0.5);
        this.glow.renderOrder = 3;
        this.group.add(this.glow);
        // accessories hang off the head (or, for the lantern, below)
        this.acc = new THREE.Group();
        b.add(this.acc);
        this.accId = 'none';
        this.group.traverse((o) => {
            o.frustumCulled = false;
        });

        // flight state
        this.pos = this.group.position;
        this.vel = new THREE.Vector3();
        this.heading = new THREE.Quaternion();
        this.flap = 0;
        this.bank = 0;
        this.pitch = 0;
        this.offset = new THREE.Vector3(0.75, -0.22, 1.7);  // right, up, forward of the eye
        this.nextDart = 1.5;
        this.trick = null;
        this.wiggle = 0;
        this.perched = false;
        this.night = 0;
        this.scaleK = 1;
        this.extraRoll = 0;    // a trick's own turn on top of the banking
        this.extraPitch = 0;
    }

    /** Colours, wings and an accessory: ({ body, wings, acc } from dragonfly-talk.js). */
    setLook(body, wings, acc) {
        this.bodyMat.color.set(body.a);
        this.bodyMat.emissive.set(body.a);
        this.bandMat.color.set(body.b);
        this.bandMat.emissive.set(body.b);
        this.eyeMat.color.set(body.eye);
        this.eyeMat.emissive.set(body.eye);
        this.glow.material.color.set(body.a).lerp(new THREE.Color(0xffffff), 0.35);
        for (const m of this.wingMats) {
            m.uniforms.uTint.value.set(wings.tint);
            m.uniforms.uTip.value.set(wings.tip);
            m.uniforms.uIri.value = wings.iri;
            m.uniforms.uStars.value = wings.stars ? 1 : 0;
        }
        this._accessory(acc.id, body);
    }

    _accessory(id, body) {
        for (const c of [...this.acc.children]) {
            this.acc.remove(c);
            c.traverse((o) => {
                o.geometry?.dispose();
                if (o.material && o.material !== this.bodyMat && o.material !== this.bandMat) o.material.dispose?.();
            });
        }
        this.accId = id;
        const add = (geo, color, x, y, z, opts = {}) => {
            const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.5, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 }));
            m.position.set(x, y, z);
            m.frustumCulled = false;
            this.acc.add(m);
            return m;
        };
        if (id === 'tophat') {
            add(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 20), 0x16161c, 0, 0.034, 0.048);
            add(new THREE.CylinderGeometry(0.016, 0.017, 0.032, 20), 0x16161c, 0, 0.052, 0.048);
            add(new THREE.CylinderGeometry(0.0172, 0.0172, 0.007, 20), body.b, 0, 0.041, 0.048);
            this.acc.rotation.x = -0.15;
        } else if (id === 'crown') {
            add(new THREE.TorusGeometry(0.022, 0.0035, 6, 20).rotateX(Math.PI / 2), 0x3f9a3a, 0, 0.034, 0.05);
            const cols = [0xff8fc8, 0xfff27a, 0xffffff, 0xb79bff, 0xff9a5a];
            cols.forEach((c, i) => {
                const a = (i / cols.length) * Math.PI * 2;
                add(new THREE.SphereGeometry(0.0062, 8, 6), c, Math.sin(a) * 0.022, 0.037, 0.05 + Math.cos(a) * 0.022, { emissive: c, ei: 0.25 });
            });
            this.acc.rotation.x = -0.12;
        } else if (id === 'scarf') {
            add(new THREE.TorusGeometry(0.024, 0.0075, 8, 18), 0xd8344a, 0, 0.004, 0.032);
            const tail = add(new THREE.BoxGeometry(0.012, 0.004, 0.05), 0xd8344a, 0.016, 0.02, 0.008);
            tail.rotation.set(0.3, 0.4, 0);
            this.scarfTail = tail;
            this.acc.rotation.x = 0;
        } else if (id === 'bowtie') {
            for (const s of [-1, 1]) {
                const c = add(new THREE.ConeGeometry(0.009, 0.018, 4), 0xc8203a, s * 0.009, -0.018, 0.058);
                c.rotation.z = s * Math.PI / 2;
            }
            add(new THREE.SphereGeometry(0.004, 6, 5), 0xa01830, 0, -0.018, 0.058);
            this.acc.rotation.x = 0;
        } else if (id === 'glasses') {
            for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.012, 0.0018, 5, 16), 0x2a1a0a, s * 0.018, 0.014, 0.084, { metal: 0.6, rough: 0.3 });
            add(new THREE.BoxGeometry(0.01, 0.002, 0.002), 0x2a1a0a, 0, 0.016, 0.085);
            this.acc.rotation.x = 0;
        } else if (id === 'lantern') {
            add(new THREE.CylinderGeometry(0.0008, 0.0008, 0.05, 3), 0x333333, 0, -0.05, 0.0);
            add(new THREE.SphereGeometry(0.011, 10, 8), 0xffd48a, 0, -0.078, 0.0, { emissive: 0xffc060, ei: 2.2 });
            add(new THREE.CylinderGeometry(0.008, 0.009, 0.005, 8), 0x3a2a12, 0, -0.066, 0.0, { metal: 0.5 });
            this.acc.rotation.x = 0;
        }
    }

    /** Bigger in the open (so you can see it among the trees), smaller indoors. */
    setScale(k) {
        this.scaleK = k;
    }

    /** Put it somewhere at once (after a teleport, or on its perch). */
    snapTo(p) {
        this.pos.copy(p);
        this.vel.set(0, 0, 0);
    }

    /**
     * Fly one frame. `aim` is where it wants to be, `look` what it faces when hovering
     * (null: the way it is going). `agile` is how hard it chases its spot (darting is quick,
     * drifting about a perch is gentle).
     */
    fly(dt, t, aim, look, agile = 1) {
        // a critically damped spring toward the spot, with a top speed (in small steps, so a long frame can't overshoot)
        const k = 26 * agile, c = 2 * Math.sqrt(k) * 0.9, max = 14;
        const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
        for (let i = 0; i < n; i++) {
            tmp.copy(aim).sub(this.pos).multiplyScalar(k).addScaledVector(this.vel, -c);
            this.vel.addScaledVector(tmp, h);
            if (this.vel.length() > max) this.vel.setLength(max);
            this.pos.addScaledVector(this.vel, h);
        }
        // facing: along the flight when moving fast, else toward `look`
        const sp = this.vel.length();
        const dir = tmp2;
        if (sp > 1.2 || !look) dir.copy(this.vel).setY(this.vel.y * 0.3);
        else dir.copy(look).sub(this.pos).setY(0);
        if (dir.lengthSq() > 1e-6) {
            mtx.lookAt(tmp.set(0, 0, 0), dir.normalize().negate(), UP);
            qa.setFromRotationMatrix(mtx);
            this.heading.slerp(qa, 1 - Math.exp(-dt * (sp > 1.2 ? 10 : 5)));
        }
        this.group.quaternion.copy(this.heading);
        // bank into turns and pitch with climbs, like a little helicopter
        const local = tmp.copy(this.vel).applyQuaternion(qa.copy(this.heading).invert());
        this.bank = damp(this.bank, clamp(-local.x * 0.25, -0.7, 0.7), 6, dt);
        this.pitch = damp(this.pitch, clamp(local.z * 0.05 - local.y * 0.12, -0.5, 0.5), 6, dt);
        this.body.rotation.set(this.pitch + this.extraPitch, 0, this.bank + this.extraRoll);
        this.animate(dt, t, sp);
    }

    /** Wings, tail, glow and the happy wiggle. */
    animate(dt, t, speed = 0) {
        // the wings beat far too fast to see, so they are drawn at a slow, readable beat with a wide sweep
        this.flap += dt * (this.perched ? 0 : 34 + speed * 2);
        for (const w of this.wings) {
            const ph = this.flap + (w.hind ? 0 : 1.6);
            const sweep = this.perched ? -0.08 : Math.sin(ph) * 0.55 + 0.1;
            w.pivot.rotation.z = w.side * sweep;
            w.pivot.rotation.x = this.perched ? 0 : Math.cos(ph) * 0.15;
        }
        this.tail.rotation.x = Math.sin(t * 2.1) * 0.06 + (this.perched ? 0.08 : 0);
        if (this.wiggle > 0) {
            this.wiggle = Math.max(0, this.wiggle - dt);
            this.body.rotation.z += Math.sin(this.wiggle * 40) * 0.5 * this.wiggle;
            this.body.position.y = Math.abs(Math.sin(this.wiggle * 14)) * 0.05;
        } else this.body.position.y = 0;
        if (this.scarfTail) this.scarfTail.rotation.y = 0.4 + Math.sin(t * 9) * 0.25;
        const s = this.scaleK * (1 + (this.wiggle > 0 ? Math.sin(this.wiggle * 20) * 0.05 : 0));
        this.body.scale.setScalar(s);
        const lantern = this.accId === 'lantern';
        this.glow.material.opacity = (lantern ? 0.45 : 0.1) + this.night * (lantern ? 0.55 : 0.35);
        this.glow.scale.setScalar(s * (lantern ? 0.7 : 0.45) * (1 + this.night * 0.6));
        this.glow.position.y = lantern ? -0.078 * s : 0;
        for (const m of this.wingMats) m.uniforms.uGlow.value = this.night * 0.35;
    }

    /** Where it hovers beside you: the camera's frame, plus an offset that changes every few seconds. */
    beside(camera, dt, t, rand, out) {
        this.nextDart -= dt;
        if (this.nextDart <= 0) {
            this.nextDart = 1.8 + rand() * 3.5;
            // most darts stay on the right of your view, sometimes it nips across to the left
            const side = rand() < 0.22 ? -1 : 1;
            this.offset.set(side * (0.45 + rand() * 0.6), -0.38 + rand() * 0.42, 1.25 + rand() * 0.95);
        }
        camera.getWorldDirection(fwd);
        fwd.y = clamp(fwd.y, -0.5, 0.5);
        fwd.normalize();
        right.crossVectors(fwd, UP).normalize();
        const o = this.offset;
        out.copy(camera.position).addScaledVector(right, o.x).addScaledVector(fwd, o.z);
        out.y += o.y;
        // a hover is never still: little figure-of-eight drifts
        out.x += Math.sin(t * 1.7) * 0.05;
        out.y += Math.sin(t * 2.3) * 0.04;
        out.z += Math.cos(t * 1.3) * 0.05;
        return out;
    }

    /** Begin a trick: 'loop' | 'roll' | 'circle' | 'zip'. */
    startTrick(kind) {
        this.trick = { kind, t: 0, dur: kind === 'circle' ? 3.2 : kind === 'zip' ? 0.9 : 1.6 };
    }

    /**
     * The spot for the current trick, around `anchor` (seen from the camera), or null
     * once it is done.
     */
    trickAim(dt, camera, anchor, out) {
        const tr = this.trick;
        if (!tr) return null;
        tr.t += dt;
        const k = tr.t / tr.dur;
        if (k >= 1) {
            this.trick = null;
            this.extraRoll = this.extraPitch = 0;
            return null;
        }
        camera.getWorldDirection(fwd).setY(0).normalize();
        right.crossVectors(fwd, UP).normalize();
        const a = k * Math.PI * 2;
        out.copy(anchor);
        if (tr.kind === 'loop') {
            // a vertical circle in the plane facing you
            out.addScaledVector(UP, (1 - Math.cos(a)) * 0.45).addScaledVector(fwd, Math.sin(a) * 0.45);
            this.extraPitch = -a;
        } else if (tr.kind === 'roll') {
            out.addScaledVector(right, Math.sin(a) * 0.25).addScaledVector(UP, (1 - Math.cos(a)) * 0.2);
            this.extraRoll = a;
        } else if (tr.kind === 'circle') {
            const r = 1.4;
            out.copy(camera.position).addScaledVector(fwd, Math.cos(a * 2) * r).addScaledVector(right, Math.sin(a * 2) * r);
            out.y -= 0.25;
        } else if (tr.kind === 'zip') {
            out.addScaledVector(UP, Math.sin(a) * 0.3).addScaledVector(right, Math.sin(a * 2) * 0.3);
        }
        return out;
    }

    /** On screen? Where, and how big (pixels): { x, y, r } or null. */
    screen(camera, w, h) {
        if (!this.group.visible || !this.group.parent) return null;
        tmp.copy(this.pos);
        const d = tmp.distanceTo(camera.position);
        tmp.project(camera);
        if (tmp.z > 1 || tmp.z < -1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) return null;
        const r = Math.max(30, (0.16 * this.scaleK / Math.max(0.2, d)) * (h / 2) / Math.tan((camera.fov * Math.PI) / 360));
        return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, r, d };
    }
}
