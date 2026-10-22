// The Fortune Engine: a chrome one-armed bandit with neon reels. Each reel is a flat quad whose
// shader wraps the strip texture round a drum (asin warp), blurs it while it spins, shades the
// edges and adds scanlines. The view moves `off` (in cells; the payline shows cell `off`).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { drawGlyph } from '../glyphs.js';

export const RW = 1.0;          // reel width
export const GAP = 0.14;        // between reels
export const CELL = 0.9;        // one symbol's height
export const RH = CELL * 3;     // the window shows three symbols

const reelVert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const reelFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uLen, uOff, uBlur, uTime, uFlash, uSel, uGain;
vec3 cellAt(float c, float x) {
    float f = fract((c + 0.5) / uLen);
    return texture2D(uTex, vec2(x, 1.0 - f)).rgb;
}
void main() {
    float y = (vUv.y - 0.5) * 2.0;                        // +1 at the top
    float a = asin(clamp(y * 0.96, -0.999, 0.999));
    float c = uOff - a / asin(0.96) * 1.5;                // the top shows the symbol before the payline
    vec3 col = vec3(0.0);
    for (int i = 0; i < 7; i++) col += cellAt(c + (float(i) / 6.0 - 0.5) * uBlur, vUv.x);
    col /= 7.0;
    float drum = sqrt(clamp(1.0 - y * y * 0.92, 0.0, 1.0));
    col *= uGain * (0.25 + 0.75 * drum);
    col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.7);         // scanlines
    col += vec3(1.0, 0.45, 0.85) * uFlash * exp(-y * y * 26.0) * 0.6;
    float edge = smoothstep(0.86, 1.0, abs(vUv.x - 0.5) * 2.0) + smoothstep(0.9, 1.0, abs(y));
    col += vec3(0.2, 0.95, 1.0) * uSel * clamp(edge, 0.0, 1.0) * 1.4;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

/** A strip of symbols as a canvas texture: one column, `px` px per cell. */
function stripTexture(strip) {
    const px = Math.max(48, Math.min(128, Math.floor(4096 / strip.length)));
    const c = document.createElement('canvas');
    c.width = px; c.height = px * strip.length;
    const g = c.getContext('2d');
    strip.forEach((s, i) => {
        const y = i * px;
        const grad = g.createLinearGradient(0, y, 0, y + px);
        grad.addColorStop(0, '#120a26'); grad.addColorStop(0.5, '#1c1240'); grad.addColorStop(1, '#120a26');
        g.fillStyle = grad;
        g.fillRect(0, y, px, px);
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(0, y, px, Math.max(1, px * 0.03));
        drawGlyph(g, s, px / 2, y + px / 2, px * 0.72);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

function marqueeTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#0d0620';
    g.fillRect(0, 0, c.width, c.height);
    g.font = '900 120px "Orbitron", "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const text = 'STARSPIN';
    // shrink to fit (a fixed size runs off a narrow sign)
    const wMax = c.width * 0.9;
    const m = g.measureText(text).width;
    if (m > wMax) g.font = `900 ${Math.floor(120 * wMax / m)}px "Orbitron", "Arial Black", Impact, sans-serif`;
    const grad = g.createLinearGradient(0, 40, 0, 150);
    grad.addColorStop(0, '#fff2a8'); grad.addColorStop(0.5, '#ff8ad8'); grad.addColorStop(1, '#7a5cff');
    g.shadowColor = '#ff4fd8'; g.shadowBlur = 26;
    g.fillStyle = grad;
    g.fillText(text, c.width / 2, c.height / 2 + 6);
    g.shadowBlur = 0;
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.strokeText(text, c.width / 2, c.height / 2 + 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class Machine {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.n = 0;
        this.reels = [];           // { mesh, mat, tex, key, len, off, anim }
        this.sel = -1;
        this.leverT = 0;
        this.flash = 0;
        this.marqueeTex = marqueeTexture();
        this.chrome = new THREE.MeshStandardMaterial({ color: 0x9098b4, metalness: 0.75, roughness: 0.5, envMapIntensity: 0.55 });
        this.trim = new THREE.MeshStandardMaterial({ color: 0x2a1a4a, metalness: 0.4, roughness: 0.6 });
        this.inset = new THREE.MeshBasicMaterial({ color: 0x05030c });
    }

    get width() { return this.n * RW + (this.n - 1) * GAP; }
    get cabW() { return this.width + 1.0; }

    /** Rebuild the cabinet for n reels. Reel textures are kept by strip contents. */
    build(n) {
        if (n === this.n) return;
        for (const c of [...this.group.children]) {
            this.group.remove(c);
            c.traverse?.((o) => { if (o.geometry) o.geometry.dispose(); });
        }
        for (const r of this.reels) { r.tex?.dispose(); r.mat.dispose(); }
        this.reels = [];
        this.n = n;
        const W = this.width, CW = this.cabW;

        const cab = new THREE.Mesh(new RoundedBoxGeometry(CW, 4.6, 1.0, 4, 0.2), this.chrome);
        cab.position.set(0, 0.32, 0);
        this.group.add(cab);
        // a dark violet face plate inside the chrome
        const face = new THREE.Mesh(new RoundedBoxGeometry(CW - 0.3, 4.3, 0.12, 3, 0.05), this.trim);
        face.position.set(0, 0.32, 0.47);
        this.group.add(face);
        const inset = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, RH + 0.2), this.inset);
        inset.position.set(0, 0, 0.54);
        this.group.add(inset);

        for (let i = 0; i < n; i++) {
            const mat = new THREE.ShaderMaterial({
                vertexShader: reelVert, fragmentShader: reelFrag,
                uniforms: {
                    uTex: { value: null }, uLen: { value: 1 }, uOff: { value: 0 }, uBlur: { value: 0 },
                    uTime: { value: 0 }, uFlash: { value: 0 }, uSel: { value: 0 }, uGain: { value: 1.35 },
                },
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RW, RH), mat);
            mesh.position.set(this.reelX(i), 0, 0.56);
            this.group.add(mesh);
            this.reels.push({ mesh, mat, tex: null, key: '', len: 1, off: 0, anim: null });
        }
        // chrome dividers between reels
        for (let i = 1; i < n; i++) {
            const d = new THREE.Mesh(new THREE.BoxGeometry(GAP * 0.6, RH + 0.1, 0.08), this.chrome);
            d.position.set(this.reelX(i) - (RW + GAP) / 2, 0, 0.58);
            this.group.add(d);
        }
        // the payline: a hot bar across the window, with an arrow at each end
        this.payMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 1.6), toneMapped: false, transparent: true, opacity: 0.55 });
        const pay = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.025, 0.02), this.payMat);
        pay.position.set(0, 0, 0.61);
        this.group.add(pay);
        for (const s of [-1, 1]) {
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 3), this.payMat);
            arrow.rotation.z = s * Math.PI / 2;
            arrow.position.set(s * (W / 2 + 0.24), 0, 0.6);
            this.group.add(arrow);
        }
        // marquee
        const mq = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.5, (CW - 0.5) * 0.19),
            new THREE.MeshBasicMaterial({ map: this.marqueeTex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
        mq.position.set(0, RH / 2 + 0.72, 0.56);
        this.group.add(mq);
        // chasing bulbs round the window
        const pts = [];
        const bx = W / 2 + 0.3, by = RH / 2 + 0.24;
        const per = 2 * (2 * bx + 2 * by);
        const count = Math.round(per / 0.3);
        for (let i = 0; i < count; i++) {
            let d = (i / count) * (4 * bx + 4 * by);
            let x, y;
            if (d < 2 * bx) { x = -bx + d; y = by; }
            else if ((d -= 2 * bx) < 2 * by) { x = bx; y = by - d; }
            else if ((d -= 2 * by) < 2 * bx) { x = bx - d; y = -by; }
            else { d -= 2 * bx; x = -bx; y = -by + d; }
            pts.push([x, y]);
        }
        this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6),
            new THREE.MeshBasicMaterial({ toneMapped: false }), pts.length);
        const m = new THREE.Matrix4();
        pts.forEach(([x, y], i) => { m.makeTranslation(x, y, 0.58); this.bulbs.setMatrixAt(i, m); this.bulbs.setColorAt(i, new THREE.Color(1, 1, 1)); });
        this.group.add(this.bulbs);
        this.bulbCol = new THREE.Color();
        // the lever
        this.lever = new THREE.Group();
        this.lever.position.set(CW / 2 + 0.12, 0.2, 0.1);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16), this.chrome);
        hub.rotation.z = Math.PI / 2;
        this.lever.add(hub);
        this.arm = new THREE.Group();
        this.arm.position.x = 0.14;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 10), this.chrome);
        rod.position.y = 0.65;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14),
            new THREE.MeshStandardMaterial({ color: 0xff2d6a, emissive: 0x80102a, metalness: 0.3, roughness: 0.35 }));
        ball.position.y = 1.35;
        this.arm.add(rod, ball);
        this.lever.add(this.arm);
        this.group.add(this.lever);
        // a selection frame (the reel nudge and respin act on)
        this.selMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 2.4), toneMapped: false });
        this.selFrame = new THREE.Group();
        for (const [w, h, x, y] of [[RW + 0.08, 0.04, 0, RH / 2 + 0.05], [RW + 0.08, 0.04, 0, -RH / 2 - 0.05], [0.04, RH + 0.1, -RW / 2 - 0.04, 0], [0.04, RH + 0.1, RW / 2 + 0.04, 0]]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), this.selMat);
            b.position.set(x, y, 0.6);
            this.selFrame.add(b);
        }
        this.selFrame.visible = false;
        this.group.add(this.selFrame);
    }

    reelX(i) { return -this.width / 2 + RW / 2 + i * (RW + GAP); }

    /** Make reel i show `strip`, re-baking its texture only when the contents changed. */
    setStrip(i, strip) {
        const r = this.reels[i];
        if (!r) return;
        const key = strip.join(',');
        if (key === r.key) return;
        r.tex?.dispose();
        r.tex = stripTexture(strip);
        r.key = key;
        r.len = strip.length;
        r.mat.uniforms.uTex.value = r.tex;
        r.mat.uniforms.uLen.value = strip.length;
    }

    /** Snap reel i to show `stop` on the payline. */
    snap(i, stop) {
        const r = this.reels[i];
        if (!r) return;
        r.anim = null;
        r.off = stop;
    }

    /** Spin reel i and land it on `stop` after `delay` seconds of spinning. */
    spin(i, stop, delay) {
        const r = this.reels[i];
        if (!r) return;
        r.anim = { kind: 'spin', t: 0, stopAt: delay, stop, from: 0, to: 0, speed: 16 };
    }

    nudge(i, dir, stop) {
        const r = this.reels[i];
        if (!r) return;
        // ease to the next cell in the nudge's direction, wherever the drum is now
        const from = r.off;
        let to = stop;
        while (to - from > r.len / 2) to -= r.len;
        while (from - to > r.len / 2) to += r.len;
        r.anim = { kind: 'ease', t: 0, dur: 0.2, from, to };
    }

    /** An inserted cell at or above the payline pushes the shown cell down one. */
    jam(i, at, strip) {
        const r = this.reels[i];
        if (!r) return;
        const cur = Math.round(((r.off % r.len) + r.len) % r.len);
        this.setStrip(i, strip);
        if (at <= cur) r.off += 1;
    }

    busy() { return this.reels.some((r) => r.anim); }

    pull() { this.leverT = 1; }

    fireFlash() { this.flash = 1; }

    setSel(i) { this.sel = i; }

    frame(dt, time, calm) {
        for (const [i, r] of this.reels.entries()) {
            const a = r.anim;
            let blur = 0;
            if (a?.kind === 'spin') {
                a.t += dt;
                if (a.t < a.stopAt) {
                    r.off -= a.speed * dt;
                    blur = Math.min(1.2, a.speed * 0.06);
                } else {
                    if (!a.landing) {
                        // land on `stop`, at least two cells further on
                        let to = a.stop;
                        while (to > r.off - 2) to -= r.len;
                        while (to < r.off - 2 - r.len) to += r.len;
                        Object.assign(a, { landing: true, from: r.off, to, t0: a.t });
                    }
                    const k = Math.min(1, (a.t - a.t0) / 0.32);
                    // ease out with a small overshoot, like a drum catching on its pawl
                    const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
                    r.off = a.from + (a.to - a.from) * e;
                    blur = (1 - k) * 0.6;
                    if (k >= 1) { r.off = a.stop; r.anim = null; }
                }
            } else if (a?.kind === 'ease') {
                a.t += dt;
                const k = Math.min(1, a.t / a.dur);
                r.off = a.from + (a.to - a.from) * (1 - Math.pow(1 - k, 3));
                if (k >= 1) { r.off = ((a.to % r.len) + r.len) % r.len; r.anim = null; }
            }
            const u = r.mat.uniforms;
            u.uOff.value = r.off;
            u.uBlur.value = blur;
            u.uTime.value = time;
            u.uFlash.value = this.flash;
            u.uSel.value = i === this.sel ? 1 : 0;
        }
        this.flash = Math.max(0, this.flash - dt * 1.6);
        if (this.payMat) this.payMat.opacity = 0.5 + this.flash * 0.5;
        if (this.selFrame) {
            this.selFrame.visible = this.sel >= 0 && this.sel < this.n;
            if (this.selFrame.visible) this.selFrame.position.x = this.reelX(this.sel);
        }
        // bulbs chase slowly (and hold still in calm mode)
        if (this.bulbs) {
            const n = this.bulbs.count;
            const step = calm ? 0 : Math.floor(time * 4);
            for (let i = 0; i < n; i++) {
                const on = (i + step) % 3 === 0;
                const h = (i / n + (calm ? 0 : time * 0.03)) % 1;
                this.bulbCol.setHSL(h, 1, on ? 0.62 : 0.3).multiplyScalar(on ? 1.6 : 0.7);
                this.bulbs.setColorAt(i, this.bulbCol);
            }
            this.bulbs.instanceColor.needsUpdate = true;
        }
        // lever: pulled down, springs back
        if (this.arm) {
            this.leverT = Math.max(0, this.leverT - dt * 2.2);
            const k = this.leverT > 0.6 ? (1 - this.leverT) / 0.4 : this.leverT / 0.6;
            this.arm.rotation.x = k * 1.1;
        }
    }
}
