// Enemies: procedural models from primitives, all drawn with one hologram shader (fresnel rim,
// scanlines, a hit flash and a noise dissolve for deaths). Each model gets an idle animation.

import * as THREE from 'three';

const holoVert = /* glsl */`
varying vec3 vN;
varying vec3 vW;
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const holoFrag = /* glsl */`
precision highp float;
varying vec3 vN;
varying vec3 vW;
uniform vec3 uColor;
uniform float uTime, uHit, uDis, uGain;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
    float n = h3(floor(vW * 14.0));
    if (n < uDis) discard;
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vW);
    float fr = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.2);
    float lam = clamp(dot(N, normalize(vec3(0.4, 0.8, 0.6))), 0.0, 1.0);
    float scan = 0.5 + 0.5 * sin(vW.y * 34.0 - uTime * 4.0);
    vec3 col = uColor * (0.1 + 0.42 * lam) + uColor * fr * 1.5 * uGain + uColor * scan * 0.07;
    col += vec3(1.0) * uHit;
    col += uColor * 2.0 * step(n, uDis + 0.07) * step(0.001, uDis);
    gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

function holo(color) {
    return new THREE.ShaderMaterial({
        vertexShader: holoVert, fragmentShader: holoFrag, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHit: { value: 0 }, uDis: { value: 0 }, uGain: { value: 1 } },
    });
}

/** A brighter accent (eyes, visors): same shader, hotter colour. */
function accent(color, k = 2.2) {
    const m = holo(color);
    m.uniforms.uColor.value.multiplyScalar(k);
    return m;
}

const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

/** Build model `kind`. Returns { root, mats, anim(t), size } — size is the rough height. */
function build(kind, color) {
    const root = new THREE.Group();
    const body = holo(color);
    const hot = accent(color);
    const eye = accent(0xffffff, 1.6);
    const mats = [body, hot, eye];
    let anim = () => {};
    let size = 1.3;
    switch (kind) {
        case 'drone': {
            const core = M(new THREE.OctahedronGeometry(0.42), body);
            const ring = M(new THREE.TorusGeometry(0.66, 0.045, 8, 40), hot);
            const ring2 = M(new THREE.TorusGeometry(0.5, 0.03, 8, 32), body);
            root.add(core, ring, ring2, M(new THREE.SphereGeometry(0.1, 12, 8), eye, 0, 0.02, 0.38));
            anim = (t) => { ring.rotation.x = 1.2 + Math.sin(t) * 0.2; ring.rotation.y = t * 1.4; ring2.rotation.y = -t * 2; core.rotation.y = t * 0.8; };
            break;
        }
        case 'moth': {
            const b = M(new THREE.CylinderGeometry(0.1, 0.06, 0.8, 10), body);
            root.add(b, M(new THREE.SphereGeometry(0.14, 12, 10), body, 0, 0.45, 0));
            const wings = [];
            for (const s of [-1, 1]) for (const up of [1, -1]) {
                const w = new THREE.Group();
                const g = new THREE.CircleGeometry(0.5, 3);
                const m = M(g, up > 0 ? body : hot, s * 0.45, up * 0.12, 0);
                m.scale.set(1, up > 0 ? 1.1 : 0.7, 1);
                m.rotation.z = s > 0 ? 0 : Math.PI;
                w.add(m);
                root.add(w);
                wings.push([w, s]);
            }
            root.add(M(new THREE.SphereGeometry(0.05, 8, 6), eye, -0.06, 0.48, 0.12), M(new THREE.SphereGeometry(0.05, 8, 6), eye, 0.06, 0.48, 0.12));
            anim = (t) => { for (const [w, s] of wings) w.rotation.y = s * (0.3 + Math.sin(t * 7) * 0.5); };
            break;
        }
        case 'gunner': {
            root.add(M(new THREE.BoxGeometry(0.7, 0.62, 0.45), body, 0, -0.1, 0));
            root.add(M(new THREE.SphereGeometry(0.24, 16, 12), body, 0, 0.42, 0));
            root.add(M(new THREE.BoxGeometry(0.34, 0.08, 0.1), eye, 0, 0.45, 0.2));
            const hat = M(new THREE.ConeGeometry(0.34, 0.3, 3), hot, 0, 0.72, 0);
            hat.rotation.y = Math.PI / 6;
            root.add(hat);
            const gun = M(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 10), hot, 0.48, -0.1, 0.2);
            gun.rotation.x = Math.PI / 2.4;
            root.add(gun);
            anim = (t) => { gun.rotation.z = Math.sin(t * 2) * 0.15; };
            break;
        }
        case 'jackal': {
            const torso = M(new THREE.ConeGeometry(0.32, 1.0, 5), body, 0, 0, 0);
            torso.rotation.z = Math.PI / 2;
            const head = M(new THREE.ConeGeometry(0.22, 0.5, 4), body, 0.6, 0.18, 0);
            head.rotation.z = -Math.PI / 2;
            const tail = M(new THREE.ConeGeometry(0.16, 0.9, 6), hot, -0.85, 0.05, 0);
            tail.rotation.z = -Math.PI / 2.2;
            root.add(torso, head, tail, M(new THREE.SphereGeometry(0.05, 8, 6), eye, 0.62, 0.26, 0.12));
            for (const s of [-1, 1]) root.add(M(new THREE.ConeGeometry(0.06, 0.24, 4), hot, 0.52, 0.42, s * 0.08));
            anim = (t) => { tail.rotation.y = Math.sin(t * 5) * 0.5; root.children[0].rotation.x = Math.sin(t * 3) * 0.2; };
            break;
        }
        case 'squid': {
            const head = M(new THREE.SphereGeometry(0.45, 20, 14), body, 0, 0.3, 0);
            head.scale.set(1, 1.35, 1);
            root.add(head, M(new THREE.SphereGeometry(0.08, 10, 8), eye, -0.16, 0.25, 0.4), M(new THREE.SphereGeometry(0.08, 10, 8), eye, 0.16, 0.25, 0.4));
            const arms = [];
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const g = new THREE.Group();
                g.position.set(Math.cos(a) * 0.25, -0.15, Math.sin(a) * 0.25);
                const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.15, -0.35, Math.sin(a) * 0.15), new THREE.Vector3(Math.cos(a) * 0.05, -0.75, Math.sin(a) * 0.05)]);
                g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.05, 6), i % 2 ? hot : body));
                root.add(g);
                arms.push([g, i]);
            }
            anim = (t) => { for (const [g, i] of arms) g.rotation.z = Math.sin(t * 2.5 + i) * 0.3; };
            break;
        }
        case 'knight': {
            root.add(M(new THREE.ConeGeometry(0.42, 1.1, 6), body, 0, -0.15, 0));
            root.add(M(new THREE.OctahedronGeometry(0.24), body, 0, 0.6, 0));
            root.add(M(new THREE.BoxGeometry(0.3, 0.05, 0.05), eye, 0, 0.62, 0.17));
            const shield = M(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 6), hot, -0.5, 0.0, 0.25);
            shield.rotation.x = Math.PI / 2;
            const lance = M(new THREE.ConeGeometry(0.08, 1.5, 8), body, 0.5, 0.25, 0.1);
            root.add(shield, lance);
            anim = (t) => { shield.rotation.y = Math.sin(t) * 0.25; lance.rotation.z = -0.25 + Math.sin(t * 1.5) * 0.1; };
            break;
        }
        case 'dealer': {
            root.add(M(new THREE.BoxGeometry(0.6, 0.7, 0.4), body, 0, -0.05, 0));
            const head = M(new THREE.CylinderGeometry(0.22, 0.26, 0.32, 12), body, 0, 0.5, 0);
            root.add(head, M(new THREE.SphereGeometry(0.11, 14, 10), accent(0xff2244, 2.4), 0, 0.5, 0.2));
            mats.push(root.children[root.children.length - 1].material);
            const arms = [];
            for (let i = 0; i < 4; i++) {
                const g = new THREE.Group();
                g.position.set(i < 2 ? -0.32 : 0.32, i % 2 ? -0.2 : 0.15, 0);
                const arm = M(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), body, 0, -0.28, 0);
                const card = M(new THREE.PlaneGeometry(0.2, 0.28), hot, 0, -0.6, 0.05);
                g.add(arm, card);
                root.add(g);
                arms.push([g, i]);
            }
            anim = (t) => { for (const [g, i] of arms) g.rotation.z = (i < 2 ? -1 : 1) * (0.6 + Math.sin(t * 3 + i) * 0.35); };
            break;
        }
        case 'leech': {
            const k = M(new THREE.TorusKnotGeometry(0.34, 0.1, 80, 10, 2, 3), body);
            root.add(k, M(new THREE.SphereGeometry(0.12, 12, 10), eye));
            anim = (t) => { k.rotation.x = t * 0.7; k.rotation.y = t; };
            break;
        }
        case 'golem': {
            const chips = [];
            for (let i = 0; i < 6; i++) {
                const c = M(new THREE.CylinderGeometry(0.42, 0.42, 0.13, 20), i % 2 ? hot : body, Math.sin(i * 1.7) * 0.06, -0.55 + i * 0.16, 0);
                root.add(c);
                chips.push(c);
            }
            for (const s of [-1, 1]) {
                const arm = M(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), body, s * 0.62, 0.0, 0);
                arm.rotation.z = Math.PI / 2;
                root.add(arm);
            }
            root.add(M(new THREE.SphereGeometry(0.07, 8, 6), eye, -0.13, 0.32, 0.4), M(new THREE.SphereGeometry(0.07, 8, 6), eye, 0.13, 0.32, 0.4));
            anim = (t) => { chips.forEach((c, i) => { c.position.x = Math.sin(t * 2 + i) * 0.05; }); };
            size = 1.5;
            break;
        }
        case 'croupier': {
            const head = M(new THREE.IcosahedronGeometry(0.8, 1), body, 0, 0, 0);
            const visor = M(new THREE.BoxGeometry(0.95, 0.18, 0.2), eye, 0, 0.12, 0.66);
            const brim = M(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 24), hot, 0, 0.72, 0);
            const crown = M(new THREE.CylinderGeometry(0.42, 0.45, 0.6, 24), body, 0, 1.02, 0);
            const band = M(new THREE.CylinderGeometry(0.455, 0.455, 0.1, 24), hot, 0, 0.82, 0);
            const bow1 = M(new THREE.ConeGeometry(0.16, 0.3, 4), hot, -0.14, -0.86, 0.3);
            bow1.rotation.z = -Math.PI / 2;
            const bow2 = M(new THREE.ConeGeometry(0.16, 0.3, 4), hot, 0.14, -0.86, 0.3);
            bow2.rotation.z = Math.PI / 2;
            root.add(head, visor, brim, crown, band, bow1, bow2);
            const cards = [];
            for (let i = 0; i < 4; i++) {
                const c = M(new THREE.PlaneGeometry(0.34, 0.48), i % 2 ? hot : body);
                root.add(c);
                cards.push(c);
            }
            anim = (t) => {
                cards.forEach((c, i) => {
                    const a = t * 0.9 + (i * Math.PI) / 2;
                    c.position.set(Math.cos(a) * 1.25, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.6);
                    c.rotation.y = -a;
                });
                head.rotation.y = Math.sin(t * 0.6) * 0.2;
            };
            size = 2.5;
            break;
        }
        case 'wyrm': {
            const segs = [];
            for (let i = 0; i < 11; i++) {
                const r = 0.42 - i * 0.03;
                const s = M(new THREE.SphereGeometry(r, 16, 12), i % 3 === 0 ? hot : body);
                root.add(s);
                segs.push(s);
            }
            const head = segs[0];
            const jaw = M(new THREE.ConeGeometry(0.3, 0.6, 5), body, 0, -0.1, 0.4);
            jaw.rotation.x = Math.PI / 2;
            head.add(jaw);
            for (const s of [-1, 1]) {
                const horn = M(new THREE.ConeGeometry(0.07, 0.5, 6), hot, s * 0.22, 0.38, -0.05);
                horn.rotation.z = -s * 0.4;
                head.add(horn);
                head.add(M(new THREE.SphereGeometry(0.07, 8, 6), eye, s * 0.17, 0.1, 0.33));
            }
            anim = (t) => {
                segs.forEach((s, i) => {
                    const u = i * 0.42;
                    s.position.set(Math.sin(t * 1.3 - u) * (0.3 + i * 0.1) + (i - 5) * 0.12, 0.7 - i * 0.16 + Math.cos(t * 1.1 - u) * 0.25, -i * 0.12);
                });
            };
            size = 2.6;
            break;
        }
        case 'house': {
            const die = M(new RoundedBox(1.5), body, 0, 0, 0);
            root.add(die);
            const pip = new THREE.SphereGeometry(0.09, 10, 8);
            for (const [x, y] of [[-0.42, 0.42], [0.42, 0.42], [-0.42, -0.42], [0.42, -0.42]]) die.add(M(pip, hot, x, y, 0.76));
            die.add(M(new THREE.SphereGeometry(0.26, 20, 14), accent(0xffffff, 1.4), 0, 0, 0.7));
            die.add(M(new THREE.SphereGeometry(0.12, 14, 10), accent(0xff2244, 2.6), 0, 0, 0.92));
            mats.push(die.children[die.children.length - 1].material, die.children[die.children.length - 2].material);
            const crown = M(new THREE.TorusGeometry(0.8, 0.06, 8, 40), hot, 0, 1.05, 0);
            crown.rotation.x = Math.PI / 2;
            root.add(crown);
            const minis = [];
            for (let i = 0; i < 3; i++) {
                const d = M(new THREE.BoxGeometry(0.34, 0.34, 0.34), i === 1 ? hot : body);
                root.add(d);
                minis.push(d);
            }
            anim = (t) => {
                die.rotation.y = Math.sin(t * 0.5) * 0.35;
                die.rotation.x = Math.sin(t * 0.37) * 0.12;
                crown.rotation.z = t * 0.6;
                minis.forEach((d, i) => {
                    const a = t * 0.8 + (i * Math.PI * 2) / 3;
                    d.position.set(Math.cos(a) * 1.5, Math.sin(a * 1.5) * 0.4, Math.sin(a) * 0.6);
                    d.rotation.set(t + i, t * 1.3, 0);
                });
            };
            size = 2.6;
            break;
        }
        default:
            root.add(M(new THREE.IcosahedronGeometry(0.5), body));
    }
    return { root, mats, anim, size };
}

/** A box with bevelled edges, from a subdivided cube pushed toward a sphere at the corners. */
function RoundedBox(s) {
    const g = new THREE.BoxGeometry(s, s, s, 6, 6, 6);
    const p = g.attributes.position, v = new THREE.Vector3(), h = s / 2, r = s * 0.16;
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const c = new THREE.Vector3(Math.sign(v.x) * Math.min(Math.abs(v.x), h - r), Math.sign(v.y) * Math.min(Math.abs(v.y), h - r), Math.sign(v.z) * Math.min(Math.abs(v.z), h - r));
        const d = v.clone().sub(c);
        if (d.lengthSq() > 1e-9) v.copy(c.add(d.normalize().multiplyScalar(r)));
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

export class Foe {
    constructor(scene, id, def) {
        const b = build(def.model, def.color);
        this.id = id;
        this.root = b.root;
        this.mats = b.mats;
        this.anim = b.anim;
        this.size = b.size;
        this.boss = !!def.boss;
        this.color = new THREE.Color(def.color);
        this.group = new THREE.Group();
        this.group.add(this.root);
        // a flat ring that marks your target
        this.ring = new THREE.Mesh(new THREE.TorusGeometry(this.size * 0.42, 0.03, 6, 48),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.2, 1.5), toneMapped: false }));
        this.ring.rotation.x = Math.PI / 2;
        this.ring.position.y = -this.size * 0.55;
        this.group.add(this.ring);
        scene.add(this.group);
        this.home = new THREE.Vector3();
        this.hit = 0;
        this.lunge = 0;
        this.dis = 0;
        this.dying = false;
        this.dead = false;
        this.seed = Math.abs(id.length * 7.3) % 3;
        this.targeted = false;
    }

    flashHit() { this.hit = 1; }
    attack() { this.lunge = 1; }
    die() { this.dying = true; }

    frame(dt, time, calm) {
        const t = time + this.seed * 2;
        this.anim(calm ? t * 0.5 : t);
        this.hit = Math.max(0, this.hit - dt * 4);
        this.lunge = Math.max(0, this.lunge - dt * 3);
        if (this.dying) this.dis = Math.min(1.01, this.dis + dt * 1.3);
        this.dead = this.dis >= 1;
        this.group.visible = !this.dead;
        const shake = this.hit * 0.08;
        const l = Math.sin(this.lunge * Math.PI);
        this.group.position.set(
            this.home.x + Math.sin(time * 40) * shake,
            this.home.y + Math.sin(t * 1.6) * 0.08 - l * 0.25,
            this.home.z + l * 1.1,
        );
        for (const m of this.mats) {
            m.uniforms.uTime.value = calm ? 0 : time;
            m.uniforms.uHit.value = this.hit * 0.9;
            m.uniforms.uDis.value = this.dis;
        }
        this.ring.visible = this.targeted && !this.dying;
        this.ring.rotation.z = time * 0.8;
    }

    dispose() {
        this.group.parent?.remove(this.group);
        this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        for (const m of this.mats) m.dispose();
        this.ring.material.dispose();
    }
}
