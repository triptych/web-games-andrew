// Every bubble in one instanced draw: a thin-film shader (fresnel rim, rainbow interference that
// drifts, a specular glint) tinted per bubble. Letters, zaps and novas carry an icon sprite.
// The trapped crew are drawn by the view inside them.

import * as THREE from 'three';
import { H, BUBBLE, LETTERS } from '../config.js';

const MAX = 80;

const VERT = /* glsl */`
attribute vec3 aTint;
attribute float aGlow;
varying vec3 vN;
varying vec3 vV;
varying vec3 vTint;
varying float vGlow;
varying vec3 vLocal;
void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    vTint = aTint;
    vGlow = aGlow;
    vLocal = position;
    gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vTint;
varying float vGlow;
varying vec3 vLocal;
void main() {
    vec3 n = normalize(vN);
    float ndv = clamp(dot(n, normalize(vV)), 0.0, 1.0);
    float rim = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.2);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (rim * 1.3 + vLocal.y * 0.35 + uTime * 0.08 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(vTint, film, 0.45) * (rim * 1.7 + 0.08);
    // a glint from the upper left
    vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
    float spec = pow(clamp(dot(reflect(-L, n), normalize(vV)), 0.0, 1.0), 48.0);
    col += vec3(1.0) * spec * 1.6;
    col *= 1.0 + vGlow;
    float a = clamp(rim * 0.9 + 0.07 + spec, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
}`;

const TINT = {
    plain: new THREE.Color(0x7fe8ff),
    trapped: new THREE.Color(0x9ff4ff),
    warn: new THREE.Color(0xff4060),
    zap: new THREE.Color(0xffe85a),
    nova: new THREE.Color(0xff8a3a),
    letter: new THREE.Color(0xff6ad8),
    boss: new THREE.Color(0xc89aff),
};

function iconTexture(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function letterTex(ch) {
    return iconTexture((g) => {
        g.font = '900 96px system-ui, Arial Black, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 12; g.strokeStyle = '#5a0a48';
        g.strokeText(ch, 64, 70);
        g.fillStyle = '#fff4fb';
        g.fillText(ch, 64, 70);
    });
}
const zapTex = () => iconTexture((g) => {
    g.beginPath();
    g.moveTo(72, 8); g.lineTo(30, 70); g.lineTo(60, 70); g.lineTo(46, 120); g.lineTo(98, 50); g.lineTo(66, 50); g.lineTo(86, 8); g.closePath();
    g.fillStyle = '#fff6a0'; g.strokeStyle = '#7a5a00'; g.lineWidth = 6;
    g.stroke(); g.fill();
});
const novaTex = () => iconTexture((g) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grd.addColorStop(0, '#fffbe0'); grd.addColorStop(0.35, '#ffb040'); grd.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 26 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.fill();
});

export class Bubbles {
    constructor(scene) {
        const geo = new THREE.SphereGeometry(1, 32, 18);
        this.tint = new Float32Array(MAX * 3);
        this.glow = new Float32Array(MAX);
        geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(this.tint, 3));
        geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(this.glow, 1));
        this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false });
        this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
        this.mesh.count = 0;
        this.mesh.renderOrder = 5;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.tex = { letters: LETTERS.map(letterTex), zap: zapTex(), nova: novaTex() };
        this.icons = [];
        this.iconGroup = new THREE.Group();
        scene.add(this.iconGroup);
        this.tmp = new THREE.Object3D();
        this.col = new THREE.Color();
    }

    icon(i) {
        while (this.icons.length <= i) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
            s.renderOrder = 4;
            this.iconGroup.add(s);
            this.icons.push(s);
        }
        return this.icons[i];
    }

    update(G, time) {
        this.mat.uniforms.uTime.value = time;
        let n = 0, k = 0;
        for (const b of G.bubbles) {
            if (n >= MAX) break;
            const wob = b.mode === 'shot' ? 0.12 : 0.04;
            const sx = 1 + Math.sin(time * 7 + b.id) * wob, sy = 1 + Math.cos(time * 7 + b.id) * wob;
            const grow = b.mode === 'shot' ? Math.min(1, 0.35 + b.dist / 1.5) : 1;
            this.tmp.position.set(b.x, H - b.y, 0.2);
            this.tmp.scale.set(b.r * sx * grow, b.r * sy * grow, b.r * grow);
            this.tmp.updateMatrix();
            this.mesh.setMatrixAt(n, this.tmp.matrix);
            let c = TINT.plain, gl = 0;
            if (b.enemy != null) {
                c = TINT.trapped;
                if (b.trapT > BUBBLE.warnTime) { const k2 = Math.sin(time * 20) > 0 ? 1 : 0; c = k2 ? TINT.warn : TINT.trapped; gl = 0.6; }
            } else if (b.kind !== 'plain') { c = TINT[b.kind] || TINT.plain; gl = 0.35; }
            else if (b.t > BUBBLE.emptyLife - 2) gl = Math.sin(time * 18) > 0 ? -0.6 : 0;
            this.col.copy(c);
            this.tint[n * 3] = this.col.r; this.tint[n * 3 + 1] = this.col.g; this.tint[n * 3 + 2] = this.col.b;
            this.glow[n] = gl;
            n++;
            const tex = b.kind === 'letter' ? this.tex.letters[b.letter] : b.kind === 'zap' ? this.tex.zap : b.kind === 'nova' ? this.tex.nova : null;
            if (tex) {
                const s = this.icon(k++);
                s.visible = true;
                if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
                s.position.set(b.x, H - b.y, 0.2);
                s.scale.setScalar(b.r * 1.25 * (1 + Math.sin(time * 5 + b.id) * 0.06));
            }
        }
        for (let i = k; i < this.icons.length; i++) this.icons[i].visible = false;
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.geometry.attributes.aTint.needsUpdate = true;
        this.mesh.geometry.attributes.aGlow.needsUpdate = true;
    }
}
