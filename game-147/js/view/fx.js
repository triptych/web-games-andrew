// Little effects: element bursts (flames, bubbles, leaves, breezes, sugar sparkles), dust poofs, coins, hearts and a
// chain-attack flash ring. One pool of sprite particles per scene; textures are drawn in code onto small canvases.

import * as THREE from 'three';

function tex(draw, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    draw(x, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const TEX = {
    dot: tex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
    star: tex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.18 : s * 0.48, a = i * Math.PI / 5 - Math.PI / 2; x.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } x.fill(); }),
    leaf: tex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(s / 2, s / 2, s * 0.2, s * 0.42, 0.6, 0, Math.PI * 2); x.fill(); }),
    ring: tex((x, s) => { x.strokeStyle = '#fff'; x.lineWidth = s * 0.08; x.beginPath(); x.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2); x.stroke(); }),
    heart: tex((x, s) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(s / 2, s * 0.8); x.bezierCurveTo(s * 0.05, s * 0.45, s * 0.25, s * 0.1, s / 2, s * 0.32); x.bezierCurveTo(s * 0.75, s * 0.1, s * 0.95, s * 0.45, s / 2, s * 0.8); x.fill(); }),
    coin: tex((x, s) => { x.fillStyle = '#ffd54a'; x.beginPath(); x.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#b8860b'; x.lineWidth = s * 0.07; x.stroke(); }),
};
export const ELEMENT_FX = {
    fire: { tex: 'dot', colors: [0xffb347, 0xff6b3d, 0xffe066], rise: 2.2, spread: 0.6, n: 18 },
    water: { tex: 'ring', colors: [0x9fe3ff, 0xffffff, 0x63c5ff], rise: 1.2, spread: 0.7, n: 16 },
    leaf: { tex: 'leaf', colors: [0x7bd67b, 0xb5f28a, 0xffb7d5], rise: 1.0, spread: 0.9, n: 16 },
    wind: { tex: 'leaf', colors: [0xd7fff4, 0x9be8d8, 0xffffff], rise: 0.4, spread: 1.4, n: 16 },
    star: { tex: 'star', colors: [0xffe66b, 0xffffff, 0xffb3e6], rise: 1.4, spread: 0.8, n: 18 },
    none: { tex: 'star', colors: [0xffffff, 0xffe8b0], rise: 0.8, spread: 0.5, n: 8 },
    dust: { tex: 'dot', colors: [0xd9d0e6, 0xbdb4cc, 0xf0eaf8], rise: 0.8, spread: 0.6, n: 12 },
    heal: { tex: 'heart', colors: [0xff9ec4, 0x9cf0b0, 0xffffff], rise: 1.6, spread: 0.5, n: 10 },
    coin: { tex: 'coin', colors: [0xffffff], rise: 2.0, spread: 0.5, n: 8 },
    buff: { tex: 'star', colors: [0x9fd8ff, 0xfff3a0], rise: 1.8, spread: 0.4, n: 10 },
};

export class FX {
    constructor(scene) {
        this.scene = scene;
        this.parts = [];
        this.pool = [];
        this.rings = [];
    }

    _sprite() {
        const s = this.pool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        this.scene.add(s);
        return s;
    }

    burst(pos, kind = 'none', scale = 1) {
        const F = ELEMENT_FX[kind] || ELEMENT_FX.none;
        for (let i = 0; i < F.n; i++) {
            const s = this._sprite();
            s.material.map = TEX[F.tex]; s.material.color.setHex(F.colors[i % F.colors.length]); s.material.opacity = 1;
            s.material.rotation = Math.random() * 6.28;
            s.material.needsUpdate = true;
            const a = Math.random() * Math.PI * 2, r = Math.random() * F.spread * scale;
            s.position.set(pos.x + Math.cos(a) * r * 0.3, pos.y + Math.random() * 0.3, pos.z + Math.sin(a) * r * 0.3);
            const sz = (0.18 + Math.random() * 0.22) * scale;
            s.scale.set(sz, sz, sz);
            this.parts.push({ s, vx: Math.cos(a) * r * 1.6, vy: F.rise * (0.5 + Math.random()) * scale, vz: Math.sin(a) * r * 1.6, life: 0.7 + Math.random() * 0.5, t: 0, spin: (Math.random() - 0.5) * 6 });
        }
    }

    ring(pos, color = 0xffffff, size = 2) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.copy(pos); m.position.y += 0.05;
        this.scene.add(m);
        this.rings.push({ m, t: 0, size });
    }

    update(dt) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.t += dt;
            p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
            p.vy -= 1.5 * dt; p.vx *= 0.97; p.vz *= 0.97;
            p.s.material.rotation += p.spin * dt;
            p.s.material.opacity = Math.max(0, 1 - p.t / p.life);
            if (p.t >= p.life) { this.scene.remove(p.s); this.pool.push(p.s); this.parts.splice(i, 1); }
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            const k = r.t / 0.6;
            r.m.scale.setScalar(0.2 + k * r.size);
            r.m.material.opacity = Math.max(0, 1 - k);
            if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
        }
    }
}
