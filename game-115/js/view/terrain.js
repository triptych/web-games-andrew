// The ground: one big painted canvas for the whole map (grass, flowers, dirt roads, the edge of your
// land) with the river cut out of it, and a shader-animated water plane underneath.

import * as THREE from 'three';
import { MAP } from '../config.js';
import { BOUNDS } from '../config.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { T_WATER, T_BRIDGE, idx } from '../sim/world.js';
import { canvas, ctx2, rnd, rad, mix, lighten, darken, rr, INK, alpha } from './paint.js';
import { tex } from './stage.js';

const GRASS = [['#92c86c', '#7db85b', '#aedb84'], ['#7ab55a', '#68a34c', '#93c96e'], ['#b2ad58', '#a09a4a', '#cfc470'], ['#e2ebf1', '#cfdce6', '#f5fafc']];
const DIRT = ['#c9a878', '#bf9c6a', '#d9bd90'];
const SAND = '#e3d29c';

export class Terrain {
    constructor(stage, quality) {
        this.stage = stage;
        this.tpx = [40, 52, 64][quality];
        this.W = MAP.w * this.tpx;
        this.H = MAP.h * this.tpx;
        this.bases = {};
        this.comp = canvas(this.W, this.H);
        this.cg = ctx2(this.comp);
        this.texture = tex(this.comp, { mip: true });
        this.texture.anisotropy = 4;
        this.sig = '';
        const geo = new THREE.PlaneGeometry(MAP.w, MAP.h);
        geo.rotateX(-Math.PI / 2);
        this.mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: true, alphaTest: 0.02 });
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.position.set(MAP.w / 2, 0, MAP.h / 2);
        this.mesh.renderOrder = 1;
        // the river bed, with ripples
        const wgeo = new THREE.PlaneGeometry(MAP.w + 40, MAP.h + 40);
        wgeo.rotateX(-Math.PI / 2);
        this.water = new THREE.Mesh(wgeo, new THREE.ShaderMaterial({
            uniforms: { uTime: stage.shared.uTime, uLight: stage.shared.uLight, uNight: stage.shared.uNight, uSnow: { value: 0 } },
            vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.); }`,
            fragmentShader: `
                uniform float uTime, uNight, uSnow; uniform vec3 uLight; varying vec3 vP;
                float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
                void main(){
                    vec2 p = vP.xz;
                    float w = n(p * 1.6 + vec2(uTime * 0.25, uTime * 0.4)) * 0.6 + n(p * 3.4 - vec2(uTime * 0.3, uTime * 0.1)) * 0.4;
                    vec3 deep = vec3(0.16, 0.45, 0.58), shallow = vec3(0.36, 0.72, 0.78);
                    vec3 col = mix(deep, shallow, w);
                    float glint = smoothstep(0.82, 0.94, n(p * 5.0 + vec2(uTime * 0.7, -uTime * 0.5)));
                    col += glint * 0.28;
                    col = mix(col, vec3(0.85, 0.92, 0.96), uSnow * 0.55);
                    gl_FragColor = vec4(col * uLight, 1.0);
                    #include <colorspace_fragment>
                }`,
        }));
        this.water.position.set(MAP.w / 2, -0.04, MAP.h / 2);
        this.group = new THREE.Group();
        this.group.add(this.water, this.mesh);
    }

    // ---------------------------------------------------------------- the base layer (per season)
    base(season, G) {
        if (this.bases[season]) return this.bases[season];
        this.bases = {};                       // keep only the season on show: each one is a big canvas
        const c = canvas(this.W, this.H), g = ctx2(c), T = this.tpx;
        const rng = rnd(1234 + season);
        const [c0, c1, c2] = GRASS[season];
        g.fillStyle = c0; g.fillRect(0, 0, this.W, this.H);
        // soft broad patches
        for (let i = 0; i < 520; i++) {
            const x = rng() * this.W, y = rng() * this.H, r = T * (1.2 + rng() * 2.6);
            g.fillStyle = rad(g, x, y, 0, r, [[0, alpha(i % 2 ? c1 : c2, 0.33)], [1, alpha(i % 2 ? c1 : c2, 0)]]);
            g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // blades
        g.lineWidth = Math.max(1, T / 32);
        for (let i = 0; i < 9000; i++) {
            const x = rng() * this.W, y = rng() * this.H, l = T * (0.06 + rng() * 0.12);
            g.strokeStyle = rng() < 0.5 ? alpha(darken(c1, 0.12), 0.55) : alpha(lighten(c2, 0.18), 0.6);
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * l, y - l); g.stroke();
        }
        // flowers, fallen leaves or snow sparkles
        for (let i = 0; i < 520; i++) {
            const x = rng() * this.W, y = rng() * this.H;
            if (season <= 1) { g.fillStyle = ['#fff', '#ffe36b', '#ff9ac0', '#c7a6ff', '#ff8a5c'][Math.floor(rng() * 5)]; g.beginPath(); g.arc(x, y, T * 0.035, 0, 7); g.fill(); }
            else if (season === 2) { g.fillStyle = ['#d9822c', '#c0502a', '#e8b83a'][Math.floor(rng() * 3)]; g.beginPath(); g.ellipse(x, y, T * 0.05, T * 0.03, rng() * 3, 0, 7); g.fill(); }
            else { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x, y, T * 0.025, 0, 7); g.fill(); }
        }
        this.bases[season] = c;
        return c;
    }

    // ---------------------------------------------------------------- composing the current ground
    signature(G, roads, season) {
        return [season, G.bounds.x0, G.bounds.x1, G.buildings.map((b) => `${b.type}${b.x},${b.y},${b.lv}`).join(';'), roads.size].join('|');
    }

    update(G, roads, season) {
        const sig = this.signature(G, roads, season);
        if (sig === this.sig) return false;
        this.sig = sig;
        const g = this.cg, T = this.tpx;
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, this.W, this.H);
        g.drawImage(this.base(season, G), 0, 0);

        // sand around the water, then cut the water out with a soft edge
        const water = [];
        for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) { const t = G.terr[idx(x, y)]; if (t === T_WATER) water.push([x, y]); }
        g.fillStyle = SAND;
        for (let r = 0.55; r >= 0.2; r -= 0.07) {
            g.globalAlpha = r < 0.3 ? 0.9 : 0.35;
            for (const [x, y] of water) { rr(g, (x - r) * T, (y - r) * T, (1 + r * 2) * T, (1 + r * 2) * T, T * 0.5); g.fill(); }
        }
        g.globalAlpha = 1;
        // wet sand ring and foam line just outside the cut
        g.globalCompositeOperation = 'destination-out';
        for (let r = 0.12; r >= -0.04; r -= 0.04) {
            g.globalAlpha = r < 0 ? 1 : 0.3;
            for (const [x, y] of water) { rr(g, (x - r) * T, (y - r) * T, (1 + r * 2) * T, (1 + r * 2) * T, T * 0.45); g.fill(); }
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        // bridges
        for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) {
            if (G.terr[idx(x, y)] !== T_BRIDGE) continue;
            g.fillStyle = '#a97c4a'; g.fillRect(x * T, y * T + T * 0.1, T, T * 0.8);
            g.strokeStyle = 'rgba(60,34,16,.7)'; g.lineWidth = Math.max(1, T / 24);
            for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x * T + k * T / 6, y * T + T * 0.1); g.lineTo(x * T + k * T / 6, y * T + T * 0.9); g.stroke(); }
            g.fillStyle = '#6e4a2a'; g.fillRect(x * T, y * T + T * 0.06, T, T * 0.07); g.fillRect(x * T, y * T + T * 0.87, T, T * 0.07);
        }

        // building pads, then the roads over them
        const rng = rnd(77);
        for (const b of G.buildings) {
            const d = BUILDINGS[b.type];
            if (d.kind === 'deco' && d.w * d.h <= 1) continue;
            const x = b.x * T, y = b.y * T, w = d.w * T, h = d.h * T;
            g.fillStyle = season === 3 ? 'rgba(230,236,242,0.55)' : 'rgba(120,86,50,0.30)';
            rr(g, x - T * 0.12, y + h * 0.1, w + T * 0.24, h * 0.95, T * 0.3); g.fill();
        }
        for (const k of roads) {
            const [tx, ty] = k.split(',').map(Number);
            const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
            g.fillStyle = rad(g, cx, cy, 0, T * 0.78, [[0, alpha(DIRT[2], 0.93)], [0.7, alpha(DIRT[0], 0.86)], [1, alpha(DIRT[1], 0)]]);
            g.fillRect(cx - T, cy - T, T * 2, T * 2);
        }
        for (const k of roads) {
            const [tx, ty] = k.split(',').map(Number);
            for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(120,90,60,${0.2 + rng() * 0.3})`; g.beginPath(); g.arc((tx + rng()) * T, (ty + rng()) * T, T * (0.02 + rng() * 0.03), 0, 7); g.fill(); }
        }
        // the hearth's little square
        const hall = G.buildings.find((b) => b.type === 'hall');
        if (hall) {
            const px = (hall.x + 1.5) * T, py = (hall.y + 3.9) * T;
            g.fillStyle = rad(g, px, py, 0, T * 2.1, [[0, alpha('#d9c4a0', 1)], [0.75, alpha('#cdb48a', 0.93)], [1, alpha('#c9a878', 0)]]);
            g.beginPath(); g.ellipse(px, py, T * 2.2, T * 1.1, 0, 0, 7); g.fill();
            g.strokeStyle = 'rgba(110,84,56,.35)'; g.lineWidth = 1;
            for (let i = 0; i < 40; i++) { const a = rng() * 6.28, r = rng() * 0.9; g.beginPath(); g.arc(px + Math.cos(a) * r * T * 1.9, py + Math.sin(a) * r * T * 0.9, T * 0.07, 0, 7); g.stroke(); }
        }

        // the edge of your land: wild ground is darker, with a rope fence
        const b = G.bounds;
        g.fillStyle = 'rgba(14,30,18,0.42)';
        g.beginPath();
        g.rect(0, 0, this.W, this.H);
        g.rect(b.x0 * T, b.y0 * T, (b.x1 + 1 - b.x0) * T, (b.y1 + 1 - b.y0) * T);
        g.fill('evenodd');
        g.strokeStyle = '#7d5230'; g.lineWidth = Math.max(2, T / 10); g.setLineDash([T * 0.5, T * 0.3]);
        g.strokeRect(b.x0 * T, b.y0 * T, (b.x1 + 1 - b.x0) * T, (b.y1 + 1 - b.y0) * T);
        g.setLineDash([]);
        // the gate
        const gx = b.x0 * T, gy = 15 * T;
        g.fillStyle = '#6e4a2a'; g.fillRect(gx - T * 0.1, gy - T * 0.1, T * 0.2, T * 1.2);
        this.texture.needsUpdate = true;
        return true;
    }
}
