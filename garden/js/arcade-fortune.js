// Madame Meridian, the Lighthouse Arcade's fortune teller: a mechanical seer in a
// glass booth by the way in. Click her (or her brass button) and she wakes: the
// bulbs chase, her eyes light, her hand circles the crystal ball, her jaw clacks
// out a prophecy, and a ticket is pushed out of the brass slot. The ticket is
// then read like a fish from the pier: a card with the fortune, a lucky number,
// colour and place, and a lucky game from the garden (a link to its card).
// Fortunes read are kept in the log.

import * as THREE from 'three';
import { rng, store, esc, clamp, damp, TAU } from './util.js';

export const FORTUNES = [
    'A fish you have not yet caught is already thinking about you.',
    'The lamp you leave on tonight will guide someone home.',
    'Somewhere below the fountain, a small submarine is rooting for you.',
    'You will find what you lost in the second place you look, not the first.',
    'The next train on the Violet Line is running exactly on your time.',
    'A strike is coming. Keep your arm straight and your heart loose.',
    'Before the week is out, a door you thought was painted on will open.',
    'The stars in the glass sphere have learned your name. Go and visit them.',
    'Someone will laugh at your joke a full minute after you tell it.',
    'Your patience is a fishing line: long, quiet, and stronger than it looks.',
    'The high score you chase is chasing you back.',
    'A small kindness of yours will be told as a big story later.',
    'When the clock tower strikes, make a wish. It is listening.',
    'Do not fear the dark corridor. The lantern is already in your hand.',
    'You will win something soft and unreasonably cute.',
    'The dragon you are afraid of only wants someone to play with.',
    'Two paths will meet in front of you. Take the one with more flowers.',
    'A song on the jukebox is about you. You will know which one.',
    'Your next good idea is hiding along a path you have not walked yet.',
    'Even the lighthouse needs a quiet night now and then. Rest well.',
    "Something you made will brighten a stranger's afternoon.",
    'The carousel creature with the starry hide will remember your ride.',
    'Lucky dice favour the hand that rolls them gently.',
    'An old game will feel new again. Play it with fresh eyes.',
    'A message in a bottle is drifting your way. Check the tide line.',
    'You are one level away from the part where it all clicks.',
    'The moon has agreed to keep your secret.',
    'Your plants will forgive you. Water them anyway.',
    'A friend will ask for help with something only you can do.',
    'Under Cinder Peak, something glitters with your initials on it.',
    'Today the claw is merciful. Tomorrow, who can say?',
    'What you build slowly will stand the longest.',
    'The mirror ball sees you dancing when you think no one is watching. It approves.',
    'Read the plaque. The answer was on the plaque all along.',
    'Your rival is only a mirror. Wave.',
    'Trust the map, but trust your feet more.',
    'A bright idea will arrive at an inconvenient hour. Write it down.',
    'The fog will lift by noon, and your worry with it.',
    'Not every treasure is buried. Some are just behind the bookcase.',
    'Fortune favours the curious. Click the strange thing.',
    'You will hear a whale sing. Listen all the way to the end.',
    'A cozy evening lies ahead, with tea, and very possibly a cat.',
    'The pins fall for those who keep on rolling.',
    'Someone you admire is quietly admiring you.',
    'Every ending you reach unlocks a beginning somewhere else.',
    'Your luck is a lighthouse beam: it always comes back around.',
    'The garden grows a statue for every good story. Yours is on its way.',
    'Madame Meridian sees... a snack. Soon. Possibly crumpets.',
];

const COLOURS = [
    ['Lighthouse Gold', '#ffd23f'], ['Fountain Blue', '#5fd0ff'], ['Velvet Plum', '#8a3fbf'], ['Neon Rose', '#ff3fd0'],
    ['Moss Green', '#6faf4f'], ['Ember Orange', '#ff7a33'], ['Moonbeam Silver', '#c8d4e8'], ['Coral Pink', '#ff8f8f'],
    ['Deep Sea Teal', '#1fa39a'], ['Starlight Cream', '#fff1c8'], ['Cinder Red', '#d0302a'], ['Synthwave Violet', '#b06bff'],
];
const PLACES = [
    'the end of the Fishing Pier', 'the rim of the Moon Fountain', 'the Violet Line platform', 'the galaxy in the glass',
    'the Observatory dome', 'the Works under the clock tower', 'the Starlight Carousel', 'lane one at the Bowl-O-Rama',
    'the middle of the disco floor', 'the Hut by the dock', 'the Standing Stones', 'the roots of the Great Tree',
];

// the booth, in metres (local: the front faces +z)
const W = 1.1, D = 0.78, BASE_H = 0.92, CASE_H = 1.12, TOP = BASE_H + CASE_H;

const BALL_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vView;
void main() {
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
}`;
const BALL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uGlow;
varying vec3 vN; varying vec3 vP; varying vec3 vView;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
    vec3 p = normalize(vP);
    float t = uTime * (0.25 + uGlow * 0.9);
    vec2 q = p.xy * 2.2 + vec2(sin(t + p.z * 3.0), cos(t * 0.8)) * 0.6;
    float m = fbm(q + fbm(q * 1.7 - t * 0.6) * 1.6);
    vec3 col = mix(vec3(0.18, 0.05, 0.35), vec3(0.35, 0.85, 1.0), smoothstep(0.35, 0.8, m));
    col = mix(col, vec3(1.0, 0.55, 0.95), smoothstep(0.62, 0.9, fbm(q * 2.4 + t)) * 0.6);
    float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0), 2.2);
    col += vec3(0.6, 0.5, 1.0) * fres * 0.8;
    col *= 0.45 + uGlow * 1.6;
    gl_FragColor = vec4(col, 1.0);
}`;

const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const ctex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
};

/** The crown of the booth: her name in gold on plum, under a row of stars. */
function marqueeCanvas() {
    const c = canvas(1024, 384);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#2a0838');
    g.addColorStop(1, '#4a1050');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 384);
    const r = rng('meridian-stars');
    for (let k = 0; k < 120; k++) {
        x.fillStyle = `rgba(255,240,200,${0.2 + r() * 0.6})`;
        x.fillRect(r() * 1024, r() * 384, 2, 2);
    }
    x.strokeStyle = '#e8c070';
    x.lineWidth = 8;
    x.strokeRect(14, 14, 996, 356);
    x.lineWidth = 2;
    x.strokeRect(30, 30, 964, 324);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = '#ffb040';
    x.shadowBlur = 18;
    x.fillStyle = '#ffd98a';
    x.font = '700 96px Cinzel, Georgia, serif';
    x.fillText('MADAME', 512, 120);
    x.font = '700 104px Cinzel, Georgia, serif';
    x.fillText('MERIDIAN', 512, 230);
    x.shadowBlur = 0;
    x.fillStyle = '#c8a8ff';
    x.font = 'italic 34px "EB Garamond", Georgia, serif';
    x.fillText('~ Seer of the Lighthouse ~', 512, 318);
    return c;
}

/** The painted front of the cabinet: a pointing hand and the offer. */
function frontCanvas() {
    const c = canvas(512, 384);
    const x = c.getContext('2d');
    x.fillStyle = '#3a0a18';
    x.fillRect(0, 0, 512, 384);
    x.strokeStyle = '#e8c070';
    x.lineWidth = 6;
    x.strokeRect(12, 12, 488, 360);
    x.textAlign = 'center';
    x.fillStyle = '#ffd98a';
    x.font = '700 50px Cinzel, Georgia, serif';
    x.fillText('YOUR FORTUNE', 256, 88);
    x.font = '700 40px Cinzel, Georgia, serif';
    x.fillText('TOLD', 256, 140);
    x.fillStyle = '#f2dcff';
    x.font = 'italic 30px "EB Garamond", Georgia, serif';
    x.fillText('press the button · take your ticket', 256, 196);
    // a little eye in a sunburst
    x.translate(256, 290);
    x.strokeStyle = '#e8c070';
    x.lineWidth = 3;
    for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        x.beginPath();
        x.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
        x.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
        x.stroke();
    }
    x.beginPath();
    x.ellipse(0, 0, 40, 22, 0, 0, TAU);
    x.fillStyle = '#fff1c8';
    x.fill();
    x.stroke();
    x.beginPath();
    x.arc(0, 0, 14, 0, TAU);
    x.fillStyle = '#2a7a9a';
    x.fill();
    x.beginPath();
    x.arc(0, 0, 6, 0, TAU);
    x.fillStyle = '#05030c';
    x.fill();
    return c;
}

/** The velvet curtain behind her. */
function curtainCanvas() {
    const c = canvas(256, 256);
    const x = c.getContext('2d');
    for (let i = 0; i < 256; i++) {
        const v = 0.55 + 0.45 * Math.sin((i / 256) * TAU * 6);
        x.fillStyle = `rgb(${Math.round(70 + 90 * v)},${Math.round(8 + 10 * v)},${Math.round(30 + 20 * v)})`;
        x.fillRect(i, 0, 1, 256);
    }
    x.fillStyle = '#e8c070';
    for (let i = 8; i < 256; i += 24) x.fillRect(i, 238, 10, 18);
    return c;
}

export class FortuneTeller {
    /** @param {object} env { plan, scene, audio, games, showCard } */
    constructor(env) {
        this.env = env;
        this.spot = env.plan.fortune;
        this.state = 'idle';
        this.t = 0;
        this.time = 0;
        this.glow = 0;
        this.read = new Set(store.get('fortunesRead', []));
        this.group = new THREE.Group();
        this.group.position.set(this.spot.x, 0, this.spot.z);
        this.group.rotation.y = this.spot.rot;
        env.scene.add(this.group);
        this._booth();
        this._figure();
        this._ticket();
        this._dom();
    }

    _booth() {
        const g = this.group;
        const lacquer = new THREE.MeshStandardMaterial({ color: 0x4a0f1e, roughness: 0.35, metalness: 0.15 });
        const gold = new THREE.MeshStandardMaterial({ color: 0xd9a84a, roughness: 0.3, metalness: 1 });
        this.gold = gold;
        const box = (w, h, d, x, y, z, m) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(x, y, z);
            g.add(mesh);
            return mesh;
        };
        // the base cabinet with gold mouldings and a painted front
        box(W, BASE_H, D, 0, BASE_H / 2, 0, lacquer);
        box(W + 0.06, 0.05, D + 0.06, 0, 0.025, 0, gold);
        box(W + 0.06, 0.05, D + 0.06, 0, BASE_H, 0, gold);
        const front = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.585), new THREE.MeshStandardMaterial({ map: ctex(frontCanvas()), roughness: 0.6, emissive: 0xffffff, emissiveMap: ctex(frontCanvas()), emissiveIntensity: 0.22 }));
        front.position.set(0, 0.42, D / 2 + 0.002);
        g.add(front);
        // the brass ticket slot and the big brass button
        box(0.22, 0.06, 0.05, 0, 0.8, D / 2 + 0.02, gold);
        box(0.15, 0.012, 0.052, 0, 0.8, D / 2 + 0.021, new THREE.MeshBasicMaterial({ color: 0x050205 }));
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc0203a, emissive: 0xff2040, emissiveIntensity: 0.4, roughness: 0.3 }));
        btn.position.set(0.33, 0.8, D / 2 + 0.02);
        g.add(btn);
        this.button = btn;
        box(0.13, 0.13, 0.012, 0.33, 0.8, D / 2 + 0.003, gold);
        // the glass case: gold corner posts, a velvet back, glass on three sides
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, CASE_H, 0.05, sx * (W / 2 - 0.025), BASE_H + CASE_H / 2, sz * (D / 2 - 0.025), gold);
        const curtain = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, CASE_H), new THREE.MeshStandardMaterial({ map: ctex(curtainCanvas()), roughness: 0.95, emissive: 0x401020, emissiveIntensity: 0.4 }));
        curtain.position.set(0, BASE_H + CASE_H / 2, -D / 2 + 0.04);
        g.add(curtain);
        const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false });
        const pane = (w, x, z, ry) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, CASE_H - 0.04), glass);
            m.position.set(x, BASE_H + CASE_H / 2, z);
            m.rotation.y = ry;
            m.renderOrder = 2;
            g.add(m);
        };
        pane(W - 0.08, 0, D / 2 - 0.025, 0);
        pane(D - 0.08, -W / 2 + 0.025, 0, Math.PI / 2);
        pane(D - 0.08, W / 2 - 0.025, 0, -Math.PI / 2);
        // the crown: a sign with her name and a ring of bulbs
        box(W + 0.06, 0.05, D + 0.06, 0, TOP + 0.025, 0, gold);
        box(W, 0.5, 0.16, 0, TOP + 0.3, -0.05, lacquer);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, (W - 0.12) * 0.375), new THREE.MeshBasicMaterial({ map: ctex(marqueeCanvas()), toneMapped: false, color: 0xcccccc }));
        sign.position.set(0, TOP + 0.3, 0.032);
        g.add(sign);
        const bulbs = [];
        for (let k = 0; k < 9; k++) bulbs.push([-W / 2 + 0.04 + (k / 8) * (W - 0.08), TOP + 0.56]);
        for (let k = 1; k < 4; k++) bulbs.push([W / 2 - 0.02, TOP + 0.56 - (k / 4) * 0.5], [-W / 2 + 0.02, TOP + 0.56 - (k / 4) * 0.5]);
        for (let k = 0; k < 9; k++) bulbs.push([-W / 2 + 0.04 + (k / 8) * (W - 0.08), TOP + 0.06]);
        this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length);
        const m = new THREE.Matrix4();
        bulbs.forEach(([x, y], i) => {
            this.bulbs.setMatrixAt(i, m.makeTranslation(x, y, 0.04));
            this.bulbs.setColorAt(i, new THREE.Color(0xffd070));
        });
        g.add(this.bulbs);
        this.bulbN = bulbs.length;
        // inside: a warm light on her, and a cool one from the ball
        const key = new THREE.PointLight(0xffb070, 2.2, 2.4, 1.5);
        key.position.set(0.25, TOP - 0.1, 0.25);
        g.add(key);
        this.ballLight = new THREE.PointLight(0x9a7aff, 1.2, 1.6, 1.6);
        this.ballLight.position.set(0, BASE_H + 0.32, 0.18);
        g.add(this.ballLight);
        // an invisible box over the whole booth, for the pointer
        const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, TOP + 0.6, D + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.y = (TOP + 0.6) / 2;
        hit.userData.kind = 'fortune';
        g.add(hit);
        this.pickables = [hit];
    }

    _figure() {
        const skin = new THREE.MeshStandardMaterial({ color: 0xd9a080, roughness: 0.45, metalness: 0.05 });
        const robe = new THREE.MeshStandardMaterial({ color: 0x3a1a6a, roughness: 0.75 });
        const sash = new THREE.MeshStandardMaterial({ color: 0x1f8f8a, roughness: 0.6 });
        const hair = new THREE.MeshStandardMaterial({ color: 0x1a0d10, roughness: 0.6 });
        const cloth = new THREE.MeshStandardMaterial({ color: 0x23103a, roughness: 0.9 });
        const gold = this.gold;
        this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: 0x6fe8ff, emissiveIntensity: 0.4, roughness: 0.2 });
        const M = (geo, mat, x = 0, y = 0, z = 0, parent = this.fig) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            parent.add(m);
            return m;
        };
        const fig = new THREE.Group();
        this.fig = fig;
        fig.position.set(0, BASE_H, -0.12);
        this.group.add(fig);
        // a little table with a fringed cloth, the crystal ball, and three cards
        const tz = 0.26;
        M(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 24), cloth, 0, 0.12, tz);
        M(new THREE.TorusGeometry(0.235, 0.008, 6, 32).rotateX(Math.PI / 2), gold, 0, 0.02, tz);
        M(new THREE.CylinderGeometry(0.045, 0.06, 0.03, 16), gold, 0, 0.255, tz);
        this.ballU = { uTime: { value: 0 }, uGlow: { value: 0 } };
        this.ball = M(new THREE.SphereGeometry(0.085, 32, 24), new THREE.ShaderMaterial({ uniforms: this.ballU, vertexShader: BALL_VERT, fragmentShader: BALL_FRAG }), 0, 0.345, tz);
        const cardCols = [0xe8d4a8, 0xd8c0f0, 0xa8e0e8];
        [-0.15, -0.12, 0.13].forEach((x, i) => {
            const c = M(new THREE.BoxGeometry(0.05, 0.003, 0.08), new THREE.MeshStandardMaterial({ color: cardCols[i], roughness: 0.6 }), x, 0.242, tz + 0.06);
            c.rotation.y = [0.5, 0.2, -0.4][i];
        });
        // her body: a robe, a sash, shoulders, a gold collar
        M(new THREE.CylinderGeometry(0.15, 0.24, 0.5, 24), robe, 0, 0.25, -0.05);
        M(new THREE.TorusGeometry(0.17, 0.035, 8, 24).rotateX(Math.PI / 2.4), sash, 0, 0.22, -0.03);
        this.chest = M(new THREE.SphereGeometry(0.17, 20, 14), robe, 0, 0.5, -0.05);
        this.chest.scale.set(1.15, 0.75, 0.8);
        M(new THREE.TorusGeometry(0.075, 0.018, 8, 24).rotateX(Math.PI / 2), gold, 0, 0.6, -0.04);
        M(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 12), skin, 0, 0.63, -0.04);
        // the head on its pivot, so it can turn and nod
        const head = new THREE.Group();
        head.position.set(0, 0.67, -0.04);
        fig.add(head);
        this.head = head;
        const face = M(new THREE.SphereGeometry(0.1, 24, 18), skin, 0, 0.1, 0, head);
        face.scale.set(0.92, 1.08, 0.95);
        // hair either side, under the turban
        for (const sx of [-1, 1]) M(new THREE.SphereGeometry(0.06, 12, 10), hair, sx * 0.075, 0.06, -0.035, head).scale.set(0.7, 1.4, 1);
        M(new THREE.SphereGeometry(0.1, 16, 12), hair, 0, 0.07, -0.05, head).scale.set(1, 0.9, 0.7);
        // the turban, its jewel and its feather
        const tur = M(new THREE.TorusGeometry(0.085, 0.045, 12, 28).rotateX(Math.PI / 2), sash, 0, 0.18, -0.005, head);
        tur.scale.set(1.08, 1, 1.05);
        M(new THREE.SphereGeometry(0.095, 20, 14), sash, 0, 0.215, -0.01, head).scale.set(1, 0.85, 1);
        M(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshStandardMaterial({ color: 0x600010, emissive: 0xff2050, emissiveIntensity: 1.4, roughness: 0.1 }), 0, 0.19, 0.12, head);
        M(new THREE.TorusGeometry(0.026, 0.006, 6, 16), gold, 0, 0.19, 0.115, head);
        const plume = M(new THREE.ConeGeometry(0.018, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xf2e8ff, roughness: 0.8 }), 0.0, 0.32, 0.08, head);
        plume.rotation.x = 0.35;
        // eyes that glow, brows, a nose, painted lips and a hinged jaw
        for (const sx of [-1, 1]) {
            M(new THREE.SphereGeometry(0.016, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.3 }), sx * 0.036, 0.115, 0.078, head);
            M(new THREE.SphereGeometry(0.01, 10, 8), this.eyeMat, sx * 0.036, 0.115, 0.091, head);
            const brow = M(new THREE.BoxGeometry(0.04, 0.007, 0.01), hair, sx * 0.038, 0.145, 0.088, head);
            brow.rotation.z = sx * -0.25;
            M(new THREE.TorusGeometry(0.014, 0.004, 6, 14), gold, sx * 0.097, 0.05, 0.0, head).rotation.y = Math.PI / 2;
            M(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe88aa0, roughness: 0.8 }), sx * 0.055, 0.075, 0.07, head).scale.set(1.3, 0.8, 0.5);
        }
        M(new THREE.ConeGeometry(0.012, 0.035, 8).rotateX(Math.PI / 2), skin, 0, 0.095, 0.1, head);
        M(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshStandardMaterial({ color: 0xa01030, roughness: 0.35 }), 0, 0.058, 0.086, head).scale.set(1.3, 0.45, 0.6);
        const jaw = new THREE.Group();
        jaw.position.set(0, 0.06, 0.0);
        head.add(jaw);
        this.jaw = jaw;
        M(new THREE.SphereGeometry(0.05, 14, 10), skin, 0, -0.025, 0.045, jaw).scale.set(1.2, 0.7, 1);
        M(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a0a28, roughness: 0.35 }), 0, -0.008, 0.088, jaw).scale.set(1.2, 0.4, 0.5);
        // two arms: the right hand circles over the ball, the left is raised to the crowd
        const arm = (side) => {
            const sh = new THREE.Group();
            sh.position.set(side * 0.19, 0.53, -0.04);
            fig.add(sh);
            M(new THREE.SphereGeometry(0.055, 14, 10), robe, 0, 0, 0, sh);
            M(new THREE.CylinderGeometry(0.042, 0.05, 0.2, 12), robe, 0, -0.1, 0, sh);
            const el = new THREE.Group();
            el.position.set(0, -0.2, 0);
            sh.add(el);
            M(new THREE.CylinderGeometry(0.04, 0.035, 0.18, 12), robe, 0, -0.09, 0, el);
            M(new THREE.TorusGeometry(0.036, 0.008, 6, 16).rotateX(Math.PI / 2), gold, 0, -0.165, 0, el);
            const hand = M(new THREE.SphereGeometry(0.035, 14, 10), skin, 0, -0.21, 0, el);
            hand.scale.set(1, 1.2, 0.55);
            for (let f = 0; f < 4; f++) M(new THREE.CapsuleGeometry(0.008, 0.03, 4, 6), skin, -0.018 + f * 0.012, -0.25, 0, el);
            return { sh, el };
        };
        this.armR = arm(1);
        this.armL = arm(-1);
    }

    _ticket() {
        const c = canvas(256, 160);
        const x = c.getContext('2d');
        x.fillStyle = '#f3e6c4';
        x.fillRect(0, 0, 256, 160);
        x.strokeStyle = '#8a1030';
        x.lineWidth = 6;
        x.strokeRect(8, 8, 240, 144);
        x.fillStyle = '#8a1030';
        x.textAlign = 'center';
        x.font = '700 30px Cinzel, Georgia, serif';
        x.fillText('FORTUNE', 128, 70);
        x.font = 'italic 22px Georgia, serif';
        x.fillText('Madame Meridian', 128, 110);
        const t = ctex(c);
        const edge = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.9 });
        const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 });
        this.ticket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.003, 0.085), [edge, edge, face, edge, edge, edge]);
        this.ticket.visible = false;
        this.group.add(this.ticket);
        this.ticketOut = 0;
    }

    _dom() {
        const $ = (id) => document.getElementById(id);
        this.card = $('fortune-card');
        if (!this.card) return;
        $('fortune-done')?.addEventListener('click', () => this.closeCard());
        $('fortune-again')?.addEventListener('click', () => this.ask());
        $('fortune-game')?.addEventListener('click', () => {
            const g = this.lucky?.game;
            this.closeCard();
            if (g) this.env.showCard?.(g);
        });
        addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.cardOpen) this.closeCard();
        });
    }

    get cardOpen() {
        return !!this.card && !this.card.hidden;
    }

    get busy() {
        return this.state === 'telling';
    }

    /** Wake her up. */
    ask() {
        if (this.state === 'telling') return;
        if (this.card) this.card.hidden = true;
        this.state = 'telling';
        this.t = 0;
        this.said = false;
        this.printed = false;
        this.ticket.visible = false;
        this.ticketOut = 0;
        this.env.audio?.coin();
        setTimeout(() => this.env.audio?.oracle(), 120);
        // choose the fortune now: one not yet read, when there are any left
        const unread = FORTUNES.map((_, i) => i).filter((i) => !this.read.has(i));
        const pool = unread.length ? unread : FORTUNES.map((_, i) => i);
        const i = pool[Math.floor(Math.random() * pool.length)];
        const games = this.env.games || [];
        this.lucky = {
            i,
            text: FORTUNES[i],
            number: 1 + Math.floor(Math.random() * 99),
            colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
            place: PLACES[Math.floor(Math.random() * PLACES.length)],
            game: games.length ? games[Math.floor(Math.random() * games.length)] : null,
        };
    }

    _showCard() {
        const L = this.lucky;
        const isNew = !this.read.has(L.i);
        this.read.add(L.i);
        store.set('fortunesRead', [...this.read]);
        if (!this.card) return;
        const $ = (id) => document.getElementById(id);
        $('fortune-kicker').textContent = `${isNew ? 'A new fortune' : 'Your fortune'} · No. ${L.i + 1}`;
        $('fortune-text').textContent = L.text;
        $('fortune-lucky').innerHTML = [
            `<span><b>Lucky number</b> ${L.number}</span>`,
            `<span><b>Lucky colour</b> <i class="ft-swatch" style="background:${L.colour[1]}"></i>${esc(L.colour[0])}</span>`,
            `<span><b>Lucky place</b> ${esc(L.place)}</span>`,
        ].join('');
        const gb = $('fortune-game');
        if (L.game) {
            gb.hidden = false;
            gb.innerHTML = `<span aria-hidden="true">${esc(L.game.icon || '🎮')}</span> Your lucky game: <b>${esc(L.game.title)}</b>`;
        } else gb.hidden = true;
        $('fortune-log').textContent = `${this.read.size} of ${FORTUNES.length} fortunes read`;
        this.card.hidden = false;
    }

    /** Take the ticket and put the card away. */
    closeCard() {
        if (this.card) this.card.hidden = true;
        if (this.state === 'done') this.state = 'taking';
        this.t = 0;
    }

    /** Every frame. `p` is where the player is (to be looked at), or null. */
    update(dt, t, p) {
        this.time = t;
        this.t += dt;
        const telling = this.state === 'telling';
        const k = this.t;
        // the glow comes up while she reads, and fades after
        this.glow = damp(this.glow, telling ? 1 : this.state === 'done' ? 0.5 : 0, telling ? 2.5 : 1.2, dt);
        this.ballU.uTime.value = t;
        this.ballU.uGlow.value = 0.2 + this.glow * 0.8;
        this.ballLight.intensity = 0.8 + this.glow * 3 + Math.sin(t * 3) * 0.2;
        this.eyeMat.emissiveIntensity = 0.35 + this.glow * 3.5 + (telling ? Math.sin(t * 18) * 0.4 : 0);
        this.button.material.emissiveIntensity = telling ? 1.4 : 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3));
        // the bulbs chase, fast while she is busy
        const speed = telling ? 14 : 3;
        const c = new THREE.Color();
        for (let i = 0; i < this.bulbN; i++) {
            const on = Math.floor(t * speed + i) % 3 === 0;
            c.set(on ? 0xffe39a : 0x5a3a10);
            if (telling && on) c.multiplyScalar(1.6);
            this.bulbs.setColorAt(i, c);
        }
        this.bulbs.instanceColor.needsUpdate = true;

        // where the player is, in the booth's frame, to turn her head to them
        let look = Math.sin(t * 0.31) * 0.35, nod = Math.sin(t * 0.47) * 0.05;
        if (p) {
            const dx = p.x - this.spot.x, dz = p.z - this.spot.z;
            const lx = dx * Math.cos(-this.spot.rot) - dz * Math.sin(-this.spot.rot);
            const lz = dx * Math.sin(-this.spot.rot) + dz * Math.cos(-this.spot.rot);
            if (lz > 0 && Math.hypot(lx, lz) < 6) {
                look = clamp(Math.atan2(lx, lz), -0.6, 0.6) + Math.sin(t * 0.7) * 0.05;
                nod = 0.12 + Math.sin(t * 0.9) * 0.03;
            }
        }
        // a mechanical figure moves in little ticks
        const tick = (v, n = 24) => Math.round(v * n) / n;
        this.head.rotation.y = damp(this.head.rotation.y, tick(look), 5, dt);
        this.head.rotation.x = damp(this.head.rotation.x, telling ? 0.25 + Math.sin(k * 2.2) * 0.05 : nod, 4, dt);
        this.head.rotation.z = telling ? Math.sin(k * 1.3) * 0.08 : Math.sin(t * 0.4) * 0.03;
        this.chest.scale.y = 0.75 + Math.sin(t * 1.6) * 0.012;
        // the jaw talks from 0.9 s to 2.8 s
        const talking = telling && k > 0.9 && k < 2.8;
        if (talking && !this.said) {
            this.said = true;
            this.env.audio?.murmur(1.8);
        }
        this.jaw.rotation.x = talking ? Math.max(0, Math.sin(k * 21) * 0.3 + Math.sin(k * 7) * 0.1) : damp(this.jaw.rotation.x, 0, 10, dt);
        // the right hand circles over the ball; faster while she reads
        const sp = telling ? 3.2 : 0.9, amp = telling ? 1 : 0.4;
        const a = (telling ? k : t) * sp;
        this.armR.sh.rotation.set(-0.95 + Math.sin(a) * 0.12 * amp, 0, 0.35 + Math.cos(a) * 0.15 * amp);
        this.armR.el.rotation.set(-0.9 + Math.cos(a) * 0.1 * amp, 0, -0.2);
        // the left arm lifts to the crowd when she speaks
        const lift = telling ? Math.min(1, k / 0.6) * (k < 3.4 ? 1 : Math.max(0, 1 - (k - 3.4) / 0.8)) : 0;
        this.armL.sh.rotation.set(-0.3 - lift * 0.9 + Math.sin(t * 0.8) * 0.03, 0, -0.25 - lift * 0.5);
        this.armL.el.rotation.set(-0.6 - lift * 0.6, 0, 0.1);
        // the ticket: printed at 3.0 s, out by 4.2 s, then the card
        const slotZ = D / 2;
        if (telling && k > 3.0 && !this.printed) {
            this.printed = true;
            this.ticket.visible = true;
            this.env.audio?.printer(1.2);
        }
        if (telling && this.printed) this.ticketOut = clamp((k - 3.0) / 1.2, 0, 1);
        if (telling && k > 4.4) {
            this.state = 'done';
            this.t = 0;
            this._showCard();
        }
        if (this.state === 'taking') {
            // the ticket is pulled free
            this.ticketOut = 1 + this.t * 4;
            if (this.t > 0.3) {
                this.ticket.visible = false;
                this.state = 'idle';
            }
        }
        const out = Math.min(this.ticketOut, 1);
        this.ticket.position.set(0, 0.8 - (this.ticketOut > 1 ? (this.ticketOut - 1) * 0.02 : 0), slotZ - 0.04 + out * 0.085 + Math.max(0, this.ticketOut - 1) * 0.05);
        this.ticket.rotation.x = 0.05 + (this.state === 'done' ? Math.sin(t * 2) * 0.03 : 0);
    }

    /** A note for the pointer. */
    info() {
        return { icon: '🔮', kicker: 'Lighthouse Arcade', title: 'Madame Meridian', desc: 'A mechanical seer in a glass booth. She knows a little about everything in the garden.', cta: 'Click to have your fortune told →', accent: '#e8c070' };
    }

    leave() {
        if (this.card) this.card.hidden = true;
        if (this.state !== 'idle') {
            this.state = 'idle';
            this.ticket.visible = false;
        }
    }
}

