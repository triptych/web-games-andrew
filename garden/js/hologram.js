// The hub's holographic carousel: a pedestal with turning brass armillary
// rings and a projector lens, a head that slowly turns to face the visitor,
// a hologram panel that cycles through every game (newest first) with a
// glitchy cross-fade, and two physical brass arrows that press in.

import * as THREE from 'three';
import { lathe } from './architecture.js';
import { HUB_Y } from './terrain.js';
import { genreOf } from './genres.js';
import { canvas, glowSprite } from './textures.js';
import { TAU, damp, angleDiff, excerpt } from './util.js';
import { GLSL_NOISE } from './sky.js';

const W = 1024, H = 640;
const AUTO_MS = 8000;
const PANEL_Y = 3.35;
const POD_X = 2.78;

const panelVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  vNrm = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const panelFrag = /* glsl */ `
uniform sampler2D uTex, uPrev;
uniform float uMix, uTime, uPower, uHover;
uniform vec3 uTint;
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vView;
${GLSL_NOISE}
void main(){
  vec2 uv = vUv;
  // glitch: horizontal slices jump while the image changes
  float g = sin(uMix * 3.14159);
  float slice = floor(uv.y * 28.0);
  float jump = (hash12(vec2(slice, floor(uTime * 20.0))) - 0.5) * 0.12 * g * step(0.55, hash12(vec2(slice * 1.7, floor(uTime * 13.0))));
  vec2 uvA = uv + vec2(jump, 0.0);
  vec4 cur = texture2D(uTex, uvA);
  vec4 prev = texture2D(uPrev, uvA);
  float n = vnoise(uv * vec2(40.0, 25.0) + uTime);
  float m = smoothstep(n - 0.15, n + 0.15, uMix * 1.3 - 0.15);
  vec4 c = mix(prev, cur, m);
  // chromatic fringe
  float ca = 0.003 + g * 0.012;
  float r = mix(texture2D(uPrev, uvA + vec2(ca, 0.0)).r, texture2D(uTex, uvA + vec2(ca, 0.0)).r, m);
  float b = mix(texture2D(uPrev, uvA - vec2(ca, 0.0)).b, texture2D(uTex, uvA - vec2(ca, 0.0)).b, m);
  c.rgb = vec3(r, c.g, b);
  // scanlines, rolling band and flicker
  float scan = 0.82 + 0.18 * sin(uv.y * 640.0 + uTime * 8.0);
  float band = 1.0 + 0.35 * exp(-pow((fract(uv.y - uTime * 0.12) - 0.5) * 9.0, 2.0));
  float flick = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 13.0);
  vec3 col = c.rgb * mix(vec3(1.0), uTint, 0.22) * scan * band * flick;
  float edge = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
  float a = c.a * edge * uPower;
  // faint fill so the panel reads as a sheet of light
  col += uTint * 0.04 * edge;
  a = max(a, 0.15 * edge * uPower);
  float fres = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 2.0);
  col += uTint * fres * 0.4;
  col *= 1.0 + uHover * 0.35;
  // bright strokes glow (and bloom); the dark backing stays translucent
  float lum = dot(c.rgb, vec3(0.3, 0.6, 0.1));
  gl_FragColor = vec4(col * (1.0 + smoothstep(0.35, 0.9, lum) * 1.4), a);
  #include <colorspace_fragment>
}`;

const beamFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
varying vec2 vUv;
${GLSL_NOISE}
void main(){
  float n = vnoise(vec2(vUv.x * 30.0, vUv.y * 4.0 - uTime * 2.0));
  float a = (1.0 - vUv.y) * 0.18 * (0.6 + 0.4 * n) + pow(1.0 - vUv.y, 6.0) * 0.3;
  gl_FragColor = vec4(uTint * a * 2.0, 1.0);
  #include <colorspace_fragment>
}`;

function arrowShape(dir) {
    const s = new THREE.Shape();
    const p = [[-0.32, -0.09], [0.05, -0.09], [0.05, -0.22], [0.36, 0], [0.05, 0.22], [0.05, 0.09], [-0.32, 0.09]];
    const pts = dir > 0 ? p : p.map(([x, y]) => [-x, y]).reverse();
    s.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.03, bevelSegments: 3 });
}

function wrap(ctx, text, maxW, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) {
            lines.push(line);
            line = w;
            if (lines.length === maxLines) break;
        } else line = t;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/[,.;:]?\s*\S*$/, '…');
    return lines;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCard(c, game, index, total) {
    const ctx = c.getContext('2d');
    const g = genreOf(game);
    ctx.clearRect(0, 0, W, H);
    const cyan = '#8ff6ff';
    // frame with corner brackets
    ctx.fillStyle = 'rgba(4,22,38,0.62)';
    roundRect(ctx, 18, 18, W - 36, H - 36, 26);
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,246,255,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = cyan;
    ctx.lineWidth = 7;
    for (const [x, y, dx, dy] of [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * 70);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * 70, y);
        ctx.stroke();
    }
    // icon in a ring
    const cx = 200, cy = 250, R = 125;
    const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
    rg.addColorStop(0, g.accent + 'aa');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = g.accent;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(cx, cy, R - 6, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText(game.icon, cx, cy + 8);
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillStyle = g.accent;
    ctx.fillText(`${g.emoji} ${g.short}`.toUpperCase(), cx, cy + R + 40, 330);
    // text
    const tx = 370, tw = W - tx - 60;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = cyan;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    let size = 62;
    ctx.font = `700 ${size}px Georgia, serif`;
    while (ctx.measureText(game.title).width > tw && size > 36) {
        size -= 2;
        ctx.font = `700 ${size}px Georgia, serif`;
    }
    ctx.fillText(game.title, tx, 120, tw);
    ctx.shadowBlur = 0;
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillStyle = cyan;
    ctx.fillText(`${game.version ? 'v' + game.version + '  ·  ' : ''}${game.id}`, tx, 162);
    ctx.font = '27px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(225,250,255,0.95)';
    wrap(ctx, excerpt(game.description, 330), tw, 7).forEach((l, i) => ctx.fillText(l, tx, 214 + i * 37));
    // tags
    let x = tx;
    ctx.font = '600 22px system-ui, sans-serif';
    for (const t of game.tags) {
        const label = `${t.emoji} ${t.label}`;
        const w = ctx.measureText(label).width + 28;
        if (x + w > W - 50) break;
        ctx.fillStyle = 'rgba(143,246,255,0.18)';
        roundRect(ctx, x, 495, w, 40, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(143,246,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#e6fdff';
        ctx.fillText(label, x + 14, 523);
        x += w + 12;
    }
    // footer: counter and hint
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = cyan;
    ctx.textAlign = 'center';
    ctx.fillText(`◀   ${index + 1} / ${total}   ▶`, W / 2, H - 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200,250,255,0.8)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('touch the light to visit', W - 60, H - 46);
}

export class Hologram {
    constructor(world, games, { onSelect } = {}) {
        this.world = world;
        this.games = [...games].reverse();
        this.index = 0;
        this.onSelect = onSelect;
        this.lastInput = -1e9;
        this.timer = 0;
        this.hover = 0;
        this.pressed = { prev: 0, next: 0 };
        const y = HUB_Y + 0.65;
        this.y = y;
        const root = new THREE.Group();
        root.position.set(0, y, 0);
        world.root.add(root);
        const { mats } = world;

        // pedestal
        const ped = new THREE.Mesh(lathe([[0, 0], [1.2, 0], [1.25, 0.12], [1.05, 0.25], [0.7, 0.4], [0.55, 0.9], [0.5, 1.2], [0.75, 1.3], [0.8, 1.4], [0, 1.4]], 32), mats.granite);
        ped.castShadow = ped.receiveShadow = true;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 32).rotateX(Math.PI / 2), mats.brass);
        band.position.y = 0.95;
        const lensMat = new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x7ff0ff, emissiveIntensity: 2.2, roughness: 0.1 });
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 32), lensMat);
        lens.position.y = 1.46;
        const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32).rotateX(Math.PI / 2), mats.brass);
        lensRing.position.y = 1.46;
        root.add(ped, band, lens, lensRing);
        world.colliders.push({ x: 0, z: 0, r: 1.5 });

        // armillary rings that turn slowly round the pedestal
        this.rings = [];
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95 + i * 0.16, 0.035, 8, 64), mats.brass);
            ring.position.y = 1.05;
            ring.castShadow = true;
            root.add(ring);
            this.rings.push(ring);
        }

        // turning head: a collar, two arms carrying the arrow pods, the panel
        const head = new THREE.Group();
        root.add(head);
        this.head = head;
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 10, 40).rotateX(Math.PI / 2), mats.brass);
        collar.position.y = 1.3;
        head.add(collar);
        this.arrows = {};
        for (const dir of [-1, 1]) {
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(dir * 0.7, 1.3, 0), new THREE.Vector3(dir * 1.6, 1.25, 0.25), new THREE.Vector3(dir * (POD_X - 0.15), 1.38, 0.35)]);
            const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 8), mats.brass);
            arm.castShadow = true;
            head.add(arm);
            const pod = new THREE.Mesh(lathe([[0, 0], [0.42, 0], [0.46, 0.08], [0.46, 0.16], [0.36, 0.22], [0, 0.22]], 24).rotateX(Math.PI / 2), mats.granite);
            pod.position.set(dir * POD_X, 1.42, 0.25);
            pod.castShadow = true;
            head.add(pod);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 8, 32), mats.brass);
            ring.position.set(dir * POD_X, 1.42, 0.47);
            head.add(ring);
            const amat = new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 1, roughness: 0.25, emissive: 0x7ff0ff, emissiveIntensity: 0 });
            const arrow = new THREE.Mesh(arrowShape(dir), amat);
            arrow.position.set(dir * POD_X, 1.42, 0.44);
            arrow.castShadow = true;
            arrow.userData = { kind: 'arrow', dir, base: 0.44 };
            head.add(arrow);
            this.arrows[dir > 0 ? 'next' : 'prev'] = arrow;
        }

        // the panel and the beam that feeds it
        this.canvases = [canvas(W, H), canvas(W, H)];
        this.textures = this.canvases.map((c) => {
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            return t;
        });
        this.front = 0;
        this.uniforms = {
            uTex: { value: this.textures[0] }, uPrev: { value: this.textures[1] }, uMix: { value: 1 }, uTime: { value: 0 },
            uPower: { value: 1 }, uHover: { value: 0 }, uTint: { value: new THREE.Color('#8ff6ff') },
        };
        const pw = 4.4, ph = (pw * H) / W;
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 1, 1), new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: panelVert, fragmentShader: panelFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        }));
        panel.position.set(0, PANEL_Y, 0);
        panel.renderOrder = 6;
        panel.userData = { kind: 'panel' };
        head.add(panel);
        this.panel = panel;

        const beamH = PANEL_Y - ph / 2 - 1.5 + 0.05;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(pw * 0.42, 0.42, beamH, 32, 1, true), new THREE.ShaderMaterial({
            uniforms: { uTime: this.uniforms.uTime, uTint: this.uniforms.uTint }, vertexShader: panelVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        }));
        beam.scale.z = 0.12;
        beam.position.set(0, 1.5 + beamH / 2, 0);
        beam.renderOrder = 5;
        head.add(beam);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: 0x7ff0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.set(2.2, 2.2, 1);
        glow.position.y = 1.55;
        root.add(glow);
        this.light = new THREE.PointLight(0x8ff6ff, 1, 12, 1.8);
        this.light.position.y = 3.2;
        root.add(this.light);
        world.sparkSources.push({ x: 0, y: y + 1.5, z: 0, r: 0.45, h: 2.0, n: 60, color: '#8ff6ff' });

        this.pickables = [panel, this.arrows.prev, this.arrows.next];
        this.show(0, false);
    }

    get current() {
        return this.games[this.index];
    }

    show(i, animate = true) {
        const n = this.games.length;
        this.index = ((i % n) + n) % n;
        this.front = 1 - this.front;
        drawCard(this.canvases[this.front], this.current, this.index, n);
        this.textures[this.front].needsUpdate = true;
        this.uniforms.uTex.value = this.textures[this.front];
        this.uniforms.uPrev.value = this.textures[1 - this.front];
        this.uniforms.uMix.value = animate ? 0 : 1;
        this.uniforms.uTint.value.set(genreOf(this.current).accent).lerp(new THREE.Color('#8ff6ff'), 0.6);
        this.timer = 0;
    }

    step(dir, user = true) {
        if (user) {
            this.lastInput = performance.now();
            this.pressed[dir > 0 ? 'next' : 'prev'] = 1;
        }
        this.show(this.index + dir);
    }

    /** Point the carousel at a game (e.g. from the library list). */
    showGame(game) {
        const i = this.games.indexOf(game);
        if (i >= 0 && i !== this.index) this.show(i);
    }

    update(dt, t, player, night) {
        this.uniforms.uTime.value = t;
        this.uniforms.uMix.value = Math.min(1, this.uniforms.uMix.value + dt * 1.4);
        this.uniforms.uHover.value = damp(this.uniforms.uHover.value, this.hover, 10, dt);
        this.uniforms.uPower.value = 0.85 + 0.15 * night;
        this.light.intensity = 0.6 + 5 * night;
        // auto-advance, but wait longer after the visitor has touched it
        const idleFor = performance.now() - this.lastInput;
        if (this.hover < 0.5 && idleFor > 20000) {
            this.timer += dt * 1000;
            if (this.timer > AUTO_MS) this.step(1, false);
        }
        // turn to face the player when nearby, otherwise drift
        const d = Math.hypot(player.x, player.z);
        const want = d < 45 ? Math.atan2(player.x, player.z) : this.head.rotation.y + dt * 0.1;
        this.head.rotation.y += angleDiff(this.head.rotation.y, want) * (1 - Math.exp(-dt * 1.6));
        this.rings.forEach((r, i) => {
            r.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.6;
            r.rotation.y = t * (0.2 + i * 0.13);
        });
        for (const k of ['prev', 'next']) {
            const a = this.arrows[k];
            this.pressed[k] = Math.max(0, this.pressed[k] - dt * 3);
            const p = this.pressed[k];
            a.position.z = a.userData.base - p * 0.09;
            a.material.emissiveIntensity = p * 2 + (a.userData.hover ? 0.6 : 0.05 + night * 0.25);
        }
    }
}
