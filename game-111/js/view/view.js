// The three.js view: reads G every frame and turns sim events into light. Never changes G.
// The board group is tilted a little away from the camera; everything game-related lives in its
// space, in cell coordinates (fx, fy) where cell (x, y) spans [x, x+1) × [y, y+1) from the top left.

import * as THREE from 'three';
import { N } from '../config.js';
import { ARCANA } from '../sim/arcana.js';
import { Stage } from './stage.js';
import { Board, PALETTE, cellX, cellY } from './board.js';
import { Fx } from './fx.js';
import { Backdrop } from './backdrop.js';
import { paintCard, paintBack, CARD_W, CARD_H } from './cardart.js';

const GOLD = new THREE.Color(1, 0.72, 0.25);
const VOID = new THREE.Color(0.55, 0.15, 0.85);
const SICK = new THREE.Color(0.35, 1, 0.25);
const WHITE = new THREE.Color(1, 1, 1);

const RAYS_FS = /* glsl */`
    uniform float uT, uA;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float a = atan(c.y, c.x);
        float rays = pow(clamp(0.5 + 0.5 * sin(a * 14.0 + uT * 1.6), 0.0, 1.0), 6.0) + pow(clamp(0.5 + 0.5 * sin(a * 9.0 - uT * 1.1), 0.0, 1.0), 10.0) * 0.6;
        float fall = smoothstep(1.0, 0.15, r) * smoothstep(0.0, 0.25, r);
        float core = exp(-r * r * 9.0) * 1.5;
        gl_FragColor = vec4(uColor * (rays * fall * 0.32 + core * 0.5) * uA, 1.0);
    }`;
const UV_VS = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class View {
    constructor(canvas, { margins } = {}) {
        this.canvas = canvas;
        this.margins = margins || (() => ({ top: 10, bottom: 10, left: 8, right: 8 }));
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;

        this.group = new THREE.Group();
        this.group.rotation.x = -0.2;
        this.scene.add(this.group);
        this.backdrop = new Backdrop(this.scene, this.group);
        this.board = new Board(this.group);
        this.fx = new Fx(this.group);

        // the rekindling card
        this.cineGroup = new THREE.Group();
        this.cineGroup.visible = false;
        this.group.add(this.cineGroup);
        this.cineFront = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: new THREE.Color(0.95, 0.95, 0.95) }));
        this.cineBack = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ map: this.cardTex(-1), transparent: true, depthWrite: false }));
        this.cineBack.rotation.y = Math.PI;
        this.cineCard = new THREE.Group();
        this.cineCard.add(this.cineFront, this.cineBack);
        this.raysU = { uT: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color(1, 0.7, 0.3) } };
        this.rays = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShaderMaterial({ uniforms: this.raysU, vertexShader: UV_VS, fragmentShader: RAYS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.rays.position.z = -0.5;
        this.cineGroup.add(this.rays, this.cineCard);
        this.cine = null;
        this.cineQueue = [];

        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.v = new THREE.Vector3();
        this.restoredSet = new Set();
        this.current = 0;
        this.hue = 0.75;
        this.resonance = 0;
        this.dim = 0;
        this.dimTarget = 0;
        this.ui = {};
        this.lastG = null;

        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    cardTex(i) {
        const cv = document.createElement('canvas');
        cv.width = CARD_W; cv.height = CARD_H;
        const g = cv.getContext('2d');
        if (i < 0) paintBack(g, CARD_W, CARD_H); else paintCard(g, i, CARD_W, CARD_H, { lit: true });
        const t = new THREE.CanvasTexture(cv);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    }

    /** Fonts arrived after the first paint: redraw every card texture. */
    repaint() {
        this.backdrop.repaint();
        this.cineBack.material.map.dispose();
        this.cineBack.material.map = this.cardTex(-1);
    }

    setCalm(on) { this.stage.calm = on; this.fx.calm = on; }

    /** The arcana the world has back, and which one is being worked on. */
    setWorld(restored, current) {
        this.restoredSet = new Set(restored);
        this.current = current;
        this.backdrop.target = this.restoredSet.size / ARCANA.length;
        this.hue = ARCANA[Math.min(current, ARCANA.length - 1)]?.hue ?? 0.75;
    }

    get busy() { return !!this.cine && this.cine.t < 1.25; }

    // ------------------------------------------------------------------ layout

    resize(force = false) {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const M = this.margins();
        const key = `${w}x${h}:${M.top}:${M.bottom}:${M.left}:${M.right}`;
        if (!force && key === this.key) return;
        this.key = key;
        this.w = w; this.h = h;
        this.stage.setSize(w, h);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        const aw = Math.max(50, w - M.left - M.right), ah = Math.max(50, h - M.top - M.bottom);
        const P = { x0: -0.45, x1: N + 0.45, y0: -0.45, y1: N + 0.45 + 2.95 };
        const Lb = { x0: -0.45, x1: N + 0.45 + 3.4, y0: -0.45, y1: N + 0.45 };
        const ppc = (b) => Math.min(aw / (b.x1 - b.x0), ah / ((b.y1 - b.y0) * 0.98));
        this.portrait = ppc(P) >= ppc(Lb);
        const B = this.portrait ? P : Lb;
        let slots, hs;
        if (this.portrait) {
            const sw = N / 3 - 0.14;
            slots = [0, 1, 2].map((k) => ({ x: N / 6 + (k * N) / 3, y: N + 0.32 + 1.3, w: sw, h: 2.6 }));
            hs = Math.min(0.5, (sw - 0.3) / 5);
        } else {
            slots = [0, 1, 2].map((k) => ({ x: N + 0.45 + 1.5, y: N / 6 + (k * N) / 3, w: 3.0, h: N / 3 - 0.12 }));
            hs = 0.5;
        }
        this.board.layout(slots, hs);
        this.slots = slots;

        // fit the content into the free rectangle and slide it there with a view offset
        const cw = B.x1 - B.x0, ch = (B.y1 - B.y0) * 0.98;
        const tan = Math.tan((this.camera.fov * Math.PI) / 360);
        const dist = (Math.max(ch / ah, cw / aw) * h) / (2 * tan) * 1.03;
        const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
        const target = new THREE.Vector3(cellX(cx - 0.5), cellY(cy - 0.5), 0);
        this.group.updateMatrixWorld(true);
        target.applyMatrix4(this.group.matrixWorld);
        this.stage.base.set(target.x, target.y, target.z + dist);
        this.camera.position.copy(this.stage.base);
        this.camera.lookAt(target);
        this.camera.far = dist + 140;
        const acx = M.left + aw / 2, acy = M.top + ah / 2;
        this.camera.setViewOffset(w, h, w / 2 - acx, h / 2 - acy, w, h);
        this.camera.updateProjectionMatrix();
        this.dist = dist;
        this.center = { x: cx, y: cy };

        // the wheel of cards: just inside the edge of the screen, at its depth behind the board
        const visH = 2 * tan * (dist + 6), visW = visH * (w / h);
        this.backdrop.placeWheel(Math.max(6.2, visW * 0.43), Math.max(6.2, visH * 0.43));
        this.backdrop.wheel.position.x = cellX(cx - 0.5);
        this.backdrop.wheel.position.y = cellY(cy - 0.5);
    }

    /** Client px → cell coordinates on the board plane, and the hand slot under it (or -1). */
    pick(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        this.group.updateMatrixWorld(true);
        const hit = this.raycaster.intersectObject(this.board.pickPlane, false)[0];
        if (!hit) return { fx: -99, fy: -99, slot: -1 };
        const p = this.group.worldToLocal(hit.point.clone());
        const fx = p.x + N / 2, fy = N / 2 - p.y;
        let slot = -1;
        (this.slots || []).forEach((s, k) => {
            if (Math.abs(fx - s.x) <= s.w / 2 + 0.1 && Math.abs(fy - s.y) <= s.h / 2 + 0.15) slot = k;
        });
        return { fx, fy, slot };
    }

    /** Cell coords → client px (for tests and for placing DOM callouts). */
    toScreen(fx, fy, z = 0.21) {
        this.group.updateMatrixWorld(true);
        const v = this.v.set(cellX(fx - 0.5), cellY(fy - 0.5), z).applyMatrix4(this.group.matrixWorld).project(this.camera);
        const r = this.canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    }
    toUv(x, y, z = 0.3) {
        const v = this.v.set(x, y, z).applyMatrix4(this.group.matrixWorld).project(this.camera);
        return [(v.x + 1) / 2, (v.y + 1) / 2];
    }

    // ------------------------------------------------------------------ events

    onEvents(G, events, time) {
        const B = this.board, F = this.fx, S = this.stage;
        for (const e of events) {
            if (e.type === 'place') {
                let sx = 0, sy = 0;
                for (const c of e.cells) {
                    B.spawn[c] = time;
                    sx += cellX(c % N); sy += cellY(Math.floor(c / N));
                }
                sx /= e.cells.length; sy /= e.cells.length;
                const col = PALETTE[e.color];
                F.ring(sx, sy, col, 0.3, 2.2, 0.45);
                for (const c of e.cells) F.burst(cellX(c % N), cellY(Math.floor(c / N)), 0.3, col, 4, { speed: 2.2, size: 0.16, life: 0.5, grav: 0 });
                S.shake(0.12);
            } else if (e.type === 'clear') {
                this.clearFx(e, time);
            } else if (e.type === 'restore') {
                this.cineQueue.push({ arc: e.arc, power: e.power });
                this.restoredSet.add(e.arc);
            } else if (e.type === 'ascend') {
                F.word(`OMEN ${ARCANA[Math.min(G.arc, 21)].numeral}`, cellX(3.5), cellY(3.5), GOLD, { size: 1.1, font: 'serif' });
                S.flash(0.2, 0.15, 0.05);
                this.backdrop.pulse = 1;
            } else if (e.type === 'arrive') {
                if (!e.fresh || time > 0.5) {
                    for (const c of e.sigils) { B.flash[c] = 1; F.gather(cellX(c % N), cellY(Math.floor(c / N)), 0.2, GOLD, 18, 1.4); }
                    for (const c of e.blight) { B.spawn[c] = time + 0.3; F.burst(cellX(c % N), cellY(Math.floor(c / N)), 0.4, VOID, 16, { speed: 3, grav: 0 }); }
                }
                this.current = e.arc;
                this.hue = ARCANA[Math.min(e.arc, 21)].hue;
            } else if (e.type === 'creep') {
                const x = cellX(e.c % N), y = cellY(Math.floor(e.c / N));
                B.spawn[e.c] = time;
                F.burst(x, y, 0.4, VOID, 26, { speed: 3.5, grav: 0 });
                F.ring(x, y, VOID, 0.2, 3, 0.7);
                F.word('THE VOID CREEPS', x, y + 0.8, VOID, { size: 0.6, font: 'serif' });
                S.shake(0.3);
            } else if (e.type === 'power') {
                this.powerFx(G, e, time);
            } else if (e.type === 'spark') {
                F.word(`+${e.n} ✦ SPARK`, cellX(3.5), cellY(1.2), GOLD, { size: 0.6, rise: 1.6 });
            } else if (e.type === 'deal') {
                e.hand.forEach((_, k) => { B.dealT[k] = time + k * 0.08; });
            } else if (e.type === 'invalid') {
                S.shake(0.15);
            } else if (e.type === 'over') {
                this.dimTarget = 1;
                S.flash(0.25, 0.02, 0.15);
                S.shake(0.5);
            } else if (e.type === 'ending') {
                this.ending = time;
            }
        }
    }

    clearFx(e, time) {
        const B = this.board, F = this.fx, S = this.stage;
        const L = e.rows.length + e.cols.length;
        const col = e.cleared.length ? PALETTE[e.cleared[0].color] || WHITE : WHITE;
        e.rows.forEach((r, k) => F.beam(cellX(3.5), cellY(r), 0, PALETTE[e.cleared.find((c) => Math.floor(c.c / N) === r)?.color] || col, k * 0.05));
        e.cols.forEach((c, k) => F.beam(cellX(c), cellY(3.5), Math.PI / 2, PALETTE[e.cleared.find((x) => x.c % N === c)?.color] || col, (e.rows.length + k) * 0.05));
        for (const { c, color } of e.cleared) {
            const x = cellX(c % N), y = cellY(Math.floor(c / N));
            const pc = PALETTE[color] || WHITE;
            F.shatter(x, y, pc, color === 8 ? 7 : 4, 0.8 + L * 0.25);
            F.burst(x, y, 0.3, pc, 6 + L * 2, { speed: 3 + L, size: 0.2, life: 0.9 });
        }
        for (const { c } of e.cracked) {
            B.flash[c] = 1;
            F.burst(cellX(c % N), cellY(Math.floor(c / N)), 0.4, SICK, 12, { speed: 2.5 });
        }
        for (const c of e.sigils) {
            const x = cellX(c % N), y = cellY(Math.floor(c / N));
            F.burst(x, y, 0.5, GOLD, 40, { speed: 6, size: 0.3, life: 1.2, up: 1.5 });
            F.ring(x, y, GOLD, 0.3, 3.2, 0.8);
            F.word('SIGIL', x, y + 0.9, GOLD, { size: 0.55, font: 'serif' });
        }
        // where the light was released, for the ring, the lens ripple and the words
        let sx = 0, sy = 0;
        for (const c of e.placed) { sx += cellX(c % N); sy += cellY(Math.floor(c / N)); }
        sx /= Math.max(1, e.placed.length); sy /= Math.max(1, e.placed.length);
        F.ring(sx, sy, col, 0.5, 5 + L * 1.5, 0.75);
        F.word(`+${e.points}`, sx, sy + 0.6, col, { size: 0.75 + Math.min(0.6, L * 0.12), rise: 1.4 });
        const names = ['', '', 'DOUBLE', 'TRIPLE', 'QUADRUPLE', 'QUINTUPLE', 'SEXTUPLE'];
        if (L >= 2) F.word(names[Math.min(6, L)] || `${L} LINES`, cellX(3.5), cellY(2.4), WHITE, { size: 0.85, font: 'serif', dur: 1.4 });
        if (e.harmony) F.word('HARMONY', cellX(3.5), cellY(5.2), new THREE.Color(1, 0.5, 0.9), { size: 0.6, font: 'serif' });
        if (e.resonance >= 2) F.word(`RESONANCE ×${(1 + 0.5 * e.resonance).toFixed(1)}`, cellX(3.5), cellY(6.6), new THREE.Color(0.4, 0.9, 1), { size: 0.5, dur: 1.1, rise: 0.6 });
        if (e.empty) {
            F.word('CLEAR SKY', cellX(3.5), cellY(3.5), GOLD, { size: 1.2, font: 'serif', dur: 1.8 });
            for (let k = 0; k < 3; k++) F.ring(cellX(3.5), cellY(3.5), k % 2 ? GOLD : col, 0.5, 5 + k * 1.5, 0.8 + k * 0.2);
            S.flash(0.35, 0.3, 0.15);
        }
        S.shake(0.25 + L * 0.18);
        S.aberrate(0.3 + L * 0.25);
        S.flash(col.r * 0.06 * L, col.g * 0.06 * L, col.b * 0.06 * L);
        const [u, v] = this.toUv(sx, sy);
        S.ripple(u, v, 0.6 + L * 0.3);
        this.backdrop.pulse = Math.min(1.5, 0.4 + L * 0.3);
        this.board.plateU.uPulse.value = 0.6 + L * 0.2;
    }

    powerFx(G, e, time) {
        const F = this.fx, S = this.stage;
        if (e.p === 'transmute') {
            for (const s of this.slots) F.gather(cellX(s.x - 0.5), cellY(s.y - 0.5), 0.5, new THREE.Color(1, 0.4, 0.2), 30, 1.8);
            F.word('TRANSMUTE', cellX(this.center.x - 0.5), cellY(this.slots[1].y - 0.5) + 1.2, new THREE.Color(1, 0.5, 0.3), { size: 0.6, font: 'serif' });
            S.aberrate(0.6);
        } else if (e.p === 'turn') {
            const s = this.slots[e.slot];
            F.ring(cellX(s.x - 0.5), cellY(s.y - 0.5), new THREE.Color(0.7, 0.5, 1), 0.4, 2.2, 0.5);
        } else if (e.p === 'lantern') {
            const x = cellX(e.x), y = cellY(e.y);
            F.gather(x, y, 0.4, GOLD, 30, 2);
            F.ring(x, y, GOLD, 0.2, 2.5, 0.6);
        } else if (e.p === 'strike') {
            const x = cellX(e.x), y = cellY(e.y);
            for (const h of e.hit) F.shatter(cellX(h.c % N), cellY(Math.floor(h.c / N)), PALETTE[h.color] || WHITE, 8, 2);
            F.burst(x, y, 0.5, new THREE.Color(0.6, 0.8, 1), 40, { speed: 10, size: 0.2, life: 1.0 });
            F.beam(x, y, 0.9, new THREE.Color(0.7, 0.85, 1));
            F.beam(x, y, -0.7, new THREE.Color(0.7, 0.85, 1), 0.04);
            F.ring(x, y, new THREE.Color(0.6, 0.75, 1), 0.4, 6, 0.6);
            F.word('THE TOWER FALLS', x, y + 1.2, new THREE.Color(0.7, 0.85, 1), { size: 0.6, font: 'serif' });
            S.shake(1); S.flash(0.2, 0.24, 0.32); S.aberrate(0.9);
            const [u, v] = this.toUv(x, y); S.ripple(u, v, 1.6);
        } else if (e.p === 'starfall') {
            for (const c of e.hit) {
                const x = cellX(c % N), y = cellY(Math.floor(c / N));
                F.shatter(x, y, VOID, 6, 1.4);
                F.burst(x, y + 0.5, 0.5, new THREE.Color(0.5, 0.95, 1), 24, { speed: 3, up: -3, grav: -6 });
            }
            F.word('STARFALL', cellX(3.5), cellY(3.5), new THREE.Color(0.5, 0.95, 1), { size: 1, font: 'serif' });
            S.flash(0.25, 0.45, 0.6);
        }
    }

    // ------------------------------------------------------------------ the rekindling

    startCine(c, time) {
        this.cine = { ...c, t0: time, t: 0 };
        this.cineFront.material.map?.dispose();
        this.cineFront.material.map = this.cardTex(c.arc);
        this.cineFront.material.needsUpdate = true;
        this.cineGroup.visible = true;
        this.raysU.uColor.value.setHSL(ARCANA[c.arc].hue, 1, 0.6);
        const cx = cellX(this.center.x - 0.5), cy = cellY(this.center.y - 0.5);
        this.cineGroup.position.set(cx, cy, 5);
        this.fx.gather(cx, cy, 5, this.raysU.uColor.value, 80, 5);
        this.stage.flash(0.12, 0.1, 0.04);
    }

    updateCine(dt, time) {
        if (!this.cine && this.cineQueue.length) this.startCine(this.cineQueue.shift(), time);
        const c = this.cine;
        if (!c) return;
        c.t = time - c.t0;
        const t = c.t;
        const cardH = Math.min(this.portrait ? 7.5 : 6.5, 7);
        const base = cardH / 5;
        const flip = Math.min(1, Math.max(0, (t - 0.25) / 0.6));
        const e = flip * flip * (3 - 2 * flip);
        this.cineCard.rotation.y = Math.PI * (1 - e) + Math.sin(time * 1.4) * 0.06 * e;
        let s = base * (0.4 + 0.6 * Math.min(1, t / 0.4));
        this.raysU.uT.value = time;
        this.raysU.uA.value = Math.min(1, t * 2) * (t > 2.3 ? Math.max(0, 1 - (t - 2.3) / 0.5) : 1);
        this.rays.rotation.z = time * 0.1;
        this.rays.scale.setScalar(base * 0.8);
        if (!c.burst && flip > 0.5) {
            c.burst = true;
            const col = this.raysU.uColor.value;
            const p = this.cineGroup.position;
            this.fx.burst(p.x, p.y, p.z, col, 140, { speed: 10, size: 0.35, life: 1.5, grav: -1 });
            this.fx.burst(p.x, p.y, p.z, GOLD, 60, { speed: 6, size: 0.25, life: 1.8, grav: -2 });
            this.fx.ring(p.x, p.y, col, 1, 11, 1.1);
            this.stage.flash(col.r * 0.12, col.g * 0.12, col.b * 0.12);
            this.stage.shake(0.6);
            this.stage.aberrate(1);
            this.backdrop.pulse = 1.5;
            const [u, v] = this.toUv(p.x, p.y, p.z); this.stage.ripple(u, v, 2);
        }
        // then fly home into the wheel
        if (t > 2.3) {
            const k = Math.min(1, (t - 2.3) / 0.6);
            const ek = k * k;
            const home = this.backdrop.cardHome(c.arc, this.v);
            const cx = cellX(this.center.x - 0.5), cy = cellY(this.center.y - 0.5);
            this.cineGroup.position.set(cx + (home.x - cx) * ek, cy + (home.y - cy) * ek, 5 + (home.z - 5) * ek);
            s *= 1 - ek * 0.8;
            this.cineFront.material.opacity = 1 - Math.max(0, (k - 0.7) / 0.3);
            if (k >= 1) {
                this.backdrop.cards[c.arc].userData.pulse = 1.5;
                this.cine = null;
                this.cineGroup.visible = false;
                this.cineFront.material.opacity = 1;
                this.backdrop.target = this.restoredSet.size / ARCANA.length;
            }
        }
        this.cineCard.scale.setScalar(s);
    }

    /** Skip to the end of the rekindling (a tap or a key during it). */
    skipCine() {
        if (this.cine && this.cine.t > 0.9) this.cine.t0 = Math.min(this.cine.t0, this.time - 2.3);
    }

    // ------------------------------------------------------------------ frame

    /**
     * ui: what the controller wants shown, { drag, sel, hide, ghost, lines, fits }
     */
    frame(G, dt, time, ui = {}) {
        this.resize();
        this.lastG = G;
        this.resonance += ((G.resonance || 0) - this.resonance) * Math.min(1, dt * 4);
        this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 2);
        this.time = time;
        this.board.blockU.uDim.value = 1 - this.dim * 0.65;
        this.updateCine(dt, time);
        this.board.update(G, ui, dt, time);
        this.board.plateU.uTint.value.setHSL(this.hue, 0.9, 0.5 - this.dim * 0.3);
        this.fx.update(dt);
        this.backdrop.update(dt, time, this.restoredSet, this.current, this.resonance, this.hue);
        if (this.ending) {
            const k = time - this.ending;
            if (k < 4 && Math.floor(k * 6) !== this.endTick) {
                this.endTick = Math.floor(k * 6);
                const i = this.endTick % 22;
                this.backdrop.cards[i].userData.pulse = 2;
                this.fx.burst(cellX(Math.random() * 8), cellY(Math.random() * 8), 1, PALETTE[1 + (i % 7)], 30, { speed: 7, life: 1.4 });
            }
        }
        this.stage.render(dt, time);
    }

    /** A new game: forget the old one's dimming and animations. */
    reset() {
        this.dimTarget = 0;
        this.dim = 0;
        this.cine = null;
        this.cineQueue.length = 0;
        this.cineGroup.visible = false;
        this.ending = null;
        this.board.spawn.fill(-10);
    }

    /** The world-space size of one cell in px right now (for tests). */
    cellPx() {
        const a = this.toScreen(0, 0), b = this.toScreen(N, 0);
        return (b.x - a.x) / N;
    }
}

