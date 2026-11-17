// The three.js view (adapted from NEON ARCANA, game-111): reads the level every frame and turns sim
// events into light. Never changes the game. The board group is tilted a little away from the camera;
// everything lives in its space, in cell coordinates (fx, fy) where cell (x, y) spans [x, x+1) × [y, y+1)
// from the top left.

import * as THREE from 'three';
import { N } from '../config.js';
import { Stage } from './stage.js';
import { Board, EL_COLOR, GOLD, cellX, cellY } from './board.js';
import { Fx } from './fx.js';

const WHITE = new THREE.Color(1, 1, 1);
const RED = new THREE.Color(1, 0.25, 0.15);
const STONE = new THREE.Color(0.75, 0.62, 0.48);
const H = (N - 1) / 2;

export class View {
    constructor(canvas, { margins, art } = {}) {
        this.canvas = canvas;
        this.art = art;
        this.margins = margins || (() => ({ top: 10, bottom: 10, left: 8, right: 8 }));
        this.stage = new Stage(canvas);
        this.scene = this.stage.scene;
        this.camera = this.stage.camera;
        this.group = new THREE.Group();
        this.group.rotation.x = -0.22;
        this.scene.add(this.group);
        this.board = new Board(this.group, art);
        this.fx = new Fx(this.group);
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.v = new THREE.Vector3();
        this.foeTex = {};
        this.dim = 0;
        this.dimTarget = 0;
        this.show = false;
        this.resize(true);
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        art?.onLoad((name, img) => this.onArt(name, img));
        for (const name of Object.keys(art?.imgs || {})) this.onArt(name, art.imgs[name]);
    }

    onArt(name, img) {
        if (name.startsWith('el-')) this.board.paintAtlas();
        else if (name === 'table') { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; this.board.setWood(t); }
        else if (name === 'workshop') this.stage.setBackdrop(img);
        else if (name.startsWith('foe-')) {
            const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
            this.foeTex[name.slice(4)] = t;
        }
    }
    texForFoe(kind) { return this.foeTex[kind === 'tail' ? 'serpent' : kind] || null; }

    setCalm(on) { this.stage.calm = on; this.fx.calm = on; }

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
        const P = { x0: -0.45, x1: N + 0.45, y0: -0.45, y1: N + 0.45 + 3.1 };
        const Lb = { x0: -0.45, x1: N + 0.45 + 3.6, y0: -0.45, y1: N + 0.45 };
        const ppc = (b) => Math.min(aw / (b.x1 - b.x0), ah / ((b.y1 - b.y0) * 0.98));
        this.portrait = ppc(P) >= ppc(Lb);
        const B = this.portrait ? P : Lb;
        let slots, hs;
        if (this.portrait) {
            const sw = N / 3 - 0.14;
            slots = [0, 1, 2].map((k) => ({ x: N / 6 + (k * N) / 3, y: N + 0.32 + 1.4, w: sw, h: 2.8 }));
            hs = Math.min(0.55, (sw - 0.3) / 5);
        } else {
            slots = [0, 1, 2].map((k) => ({ x: N + 0.45 + 1.6, y: N / 6 + (k * N) / 3, w: 3.2, h: N / 3 - 0.12 }));
            hs = 0.55;
        }
        this.board.layout(slots, hs);
        this.slots = slots;

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
        this.center = { x: cx, y: cy };
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
    cellPx() {
        const a = this.toScreen(0, 0), b = this.toScreen(N, 0);
        return (b.x - a.x) / N;
    }

    // ------------------------------------------------------------------ events

    onEvents(L, events, time) {
        const B = this.board, F = this.fx, S = this.stage;
        const at = (c) => [cellX(c % N), cellY(Math.floor(c / N))];
        for (const e of events) {
            if (e.type === 'place') {
                let sx = 0, sy = 0;
                for (const c of e.cells) { B.spawn[c] = time; const [x, y] = at(c); sx += x; sy += y; }
                sx /= e.cells.length; sy /= e.cells.length;
                const col = EL_COLOR[e.el];
                F.ring(sx, sy, col, 0.3, 2.2, 0.45);
                for (const c of e.cells) { const [x, y] = at(c); F.burst(x, y, 0.3, col, 4, { speed: 2, size: 0.15, life: 0.5, grav: 0 }); }
                S.shake(0.1);
            } else if (e.type === 'clear') {
                this.clearFx(L, e);
            } else if (e.type === 'strip') {
                for (const c of e.cells) {
                    B.flash[c] = 1;
                    const [x, y] = at(c);
                    F.burst(x, y, 0.1, STONE, 6, { speed: 2.5, size: 0.18, life: 0.7 });
                    F.shatter(x, y, STONE, 2, 0.6);
                }
            } else if (e.type === 'harvest') {
                const col = EL_COLOR[e.el];
                let sx = 0, sy = 0;
                for (const c of e.cells) { const [x, y] = at(c); sx += x; sy += y; F.gather(x, y, 0.3, col, 18, 1.2); }
                sx /= e.cells.length; sy /= e.cells.length;
                F.burst(sx, sy, 0.6, col, 60, { speed: 6, size: 0.3, life: 1.3, up: 1.5 });
                F.ring(sx, sy, col, 0.3, 4, 0.8);
                F.word(`+${e.qty} ${e.el.toUpperCase()}`, sx, sy + 0.9, col, { size: 0.6 });
                S.flash(col.r * 0.12, col.g * 0.12, col.b * 0.12);
                const [u, v] = this.toUv(sx, sy); S.ripple(u, v, 1);
            } else if (e.type === 'hit') {
                const f = L.battle.foes[e.foe];
                const tok = B.tokens[e.foe];
                if (tok) tok.userData.hurt = 1;
                for (const c of e.cut) { const [x, y] = at(c); F.shatter(x, y, B.foeColor(f.kind), 5, 1.2); F.burst(x, y, 0.3, RED, 10, { speed: 4 }); }
                const c0 = f.cells[0] ?? e.cut[0];
                if (c0 !== undefined) { const [x, y] = at(c0); F.word(`−${e.dmg}`, x, y + 1.1, RED, { size: 0.7 }); }
                S.shake(0.3);
            } else if (e.type === 'defeat') {
                const tok = B.tokens[e.foe];
                const p = tok?.position || new THREE.Vector3();
                F.burst(p.x, p.y, 0.8, B.foeColor(e.kind), 90, { speed: 8, size: 0.32, life: 1.4 });
                F.ring(p.x, p.y, GOLD, 0.4, 5, 0.8);
                F.word('VANQUISHED', p.x, p.y + 1, GOLD, { size: 0.65 });
                S.shake(0.7); S.flash(0.2, 0.12, 0.04);
            } else if (e.type === 'foe') {
                const f = L.battle.foes[e.foe];
                const tok = B.tokens[e.foe];
                const p = tok?.position || new THREE.Vector3();
                if (e.act === 'advance') { B.spawn[e.c] = time; const [x, y] = at(e.c); F.burst(x, y, 0.3, B.foeColor(f.kind), 16, { speed: 3, grav: 0 }); }
                else if (e.act === 'harden') { F.ring(p.x, p.y, STONE, 0.3, 1.6, 0.5); F.word(`ARMOUR ${e.armor}`, p.x, p.y + 1, STONE, { size: 0.45 }); }
                else { F.word(`−${e.dmg} ♥`, p.x, p.y - 0.9, RED, { size: 0.6, rise: -1 }); S.flash(0.3, 0.02, 0.0); S.shake(0.5); }
            } else if (e.type === 'cond') {
                F.word('✓ ' + (e.cond.type === 'lines' ? `${e.cond.el.toUpperCase()} LINES` : e.cond.type.toUpperCase()), cellX(H), cellY(1.6), GOLD, { size: 0.55 });
            } else if (e.type === 'violation') {
                F.word(`FORBIDDEN ${e.el.toUpperCase()}`, cellX(H), cellY(H), RED, { size: 0.6 });
                S.flash(0.25, 0.02, 0.02);
            } else if (e.type === 'item' || e.type === 'skill') {
                this.useFx(e);
            } else if (e.type === 'deal') {
                e.hand.forEach((_, k) => { B.dealT[k] = time + k * 0.08; });
            } else if (e.type === 'invalid') {
                S.shake(0.12);
            } else if (e.type === 'won') {
                for (let k = 0; k < 4; k++) F.ring(cellX(H), cellY(H), k % 2 ? GOLD : WHITE, 0.5, 6 + k * 1.5, 0.9 + k * 0.2);
                F.burst(cellX(H), cellY(H), 1, GOLD, 140, { speed: 9, size: 0.3, life: 1.6, grav: -1 });
                S.flash(0.25, 0.2, 0.08);
            } else if (e.type === 'failed') {
                this.dimTarget = 1;
                S.flash(0.2, 0.04, 0.02);
                S.shake(0.5);
            }
        }
    }

    clearFx(L, e) {
        const B = this.board, F = this.fx, S = this.stage;
        const n = e.rows.length + e.cols.length;
        const col = e.cleared.length ? EL_COLOR[e.cleared[0].el] : WHITE;
        e.rows.forEach((r, k) => F.beam(cellX(H), cellY(r), 0, col, k * 0.05));
        e.cols.forEach((c, k) => F.beam(cellX(c), cellY(H), Math.PI / 2, col, (e.rows.length + k) * 0.05));
        for (const { c, el } of e.cleared) {
            const x = cellX(c % N), y = cellY(Math.floor(c / N));
            const pc = EL_COLOR[el];
            F.shatter(x, y, pc, 3, 0.8 + n * 0.25);
            F.burst(x, y, 0.3, pc, 5 + n * 2, { speed: 3 + n, size: 0.18, life: 0.9 });
        }
        let sx = 0, sy = 0;
        for (const c of e.placed) { sx += cellX(c % N); sy += cellY(Math.floor(c / N)); }
        sx /= Math.max(1, e.placed.length); sy /= Math.max(1, e.placed.length);
        F.ring(sx, sy, col, 0.5, 5 + n * 1.5, 0.75);
        F.word(`+${e.points}`, sx, sy + 0.6, col, { size: 0.7 + Math.min(0.5, n * 0.12), rise: 1.4 });
        if (n >= 2) F.word(['', '', 'DOUBLE', 'TRIPLE', 'QUADRUPLE'][Math.min(4, n)] || `${n} LINES`, cellX(H), cellY(2.4), WHITE, { size: 0.8, dur: 1.4 });
        if (e.streak >= 3) F.word(`STREAK ${e.streak}`, cellX(H), cellY(6.8), GOLD, { size: 0.5, dur: 1.1, rise: 0.6 });
        S.shake(0.2 + n * 0.15);
        S.aberrate(0.2 + n * 0.2);
        S.flash(col.r * 0.05 * n, col.g * 0.05 * n, col.b * 0.05 * n);
        const [u, v] = this.toUv(sx, sy);
        S.ripple(u, v, 0.5 + n * 0.3);
        B.plateU.uPulse.value = 0.5 + n * 0.2;
    }

    useFx(e) {
        const F = this.fx, S = this.stage;
        const at = (c) => [cellX(c % N), cellY(Math.floor(c / N))];
        if (e.id === 'dissolvent') {
            const [x, y] = at(e.c);
            F.shatter(x, y, new THREE.Color(0.5, 1, 0.4), 8, 1.4);
            F.burst(x, y, 0.4, new THREE.Color(0.4, 1, 0.3), 30, { speed: 4, up: 1 });
        } else if (e.id === 'salts') {
            const [x, y] = at(e.c);
            F.gather(x, y, 0.3, WHITE, 30, 1.8);
        } else if (e.id === 'tonic') {
            F.word(`+${e.heal} ♥`, cellX(H), cellY(H), new THREE.Color(1, 0.4, 0.4), { size: 0.7 });
        } else if (e.slot >= 0 && this.slots[e.slot]) {
            const s = this.slots[e.slot];
            F.ring(cellX(s.x - 0.5), cellY(s.y - 0.5), GOLD, 0.4, 2.2, 0.5);
        } else {
            for (const s of this.slots) F.gather(cellX(s.x - 0.5), cellY(s.y - 0.5), 0.5, GOLD, 24, 1.6);
            S.aberrate(0.4);
        }
    }

    // ------------------------------------------------------------------ frame

    frame(L, dt, time, ui = {}) {
        this.resize();
        this.time = time;
        this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 2);
        this.board.blockU.uDim.value = 1 - this.dim * 0.55;
        this.group.visible = !!L && this.show;
        if (L && this.show) {
            ui.foeTex = (k) => this.texForFoe(k);
            this.board.update(L, ui, dt, time);
        }
        this.fx.update(dt);
        this.stage.render(dt, time);
    }

    /** A new level: forget the old one's dimming and animations. */
    reset() {
        this.dimTarget = 0;
        this.dim = 0;
        this.board.spawn.fill(-10);
        for (const t of this.board.tokens) t.userData.kind = null;
    }
}
