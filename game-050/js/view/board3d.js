/**
 * board3d.js — the 3D gem board in the battle scene.
 *
 * Follows the simulation's event stream (swap, clear, make, fall, shuffle, morph): each
 * play() starts the animation and returns how long the director should wait. sync(board)
 * snaps every gem to the true board afterwards, so a flourish can never desync the game.
 * Local coordinates: one unit per cell, cell (x, y) centred at (x − 3.5, 3.5 − y).
 */

import * as THREE from 'three';
import { initGems, makeGem, animateGemMaterials, GEM_COLORS } from './gems.js';
import { W, H } from '../sim/board.js';
import { G, SP } from '../sim/data.js';

const GRAV = 46;        // cells / s²

export class BoardView {
    constructor(scene, fx) {
        this.scene = scene;
        this.fx = fx;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
        initGems([this.clip]);
        this.gems = new Map();        // id → gem record
        this.selected = null;
        this.hintCells = null;
        this.hintT = 0;
        this.time = 0;
        this._buildTray();
        this.scale = 1;
    }

    _buildTray() {
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const g = c.getContext('2d');
        const cs = 512 / 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            g.fillStyle = (x + y) % 2 ? 'rgba(70,40,140,0.92)' : 'rgba(96,60,180,0.92)';
            g.fillRect(x * cs, y * cs, cs, cs);
            g.fillStyle = 'rgba(255,255,255,0.05)';
            g.fillRect(x * cs + 3, y * cs + 3, cs - 6, cs * 0.4);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const tray = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false }));
        tray.position.z = -0.5;
        tray.renderOrder = -1;
        this.group.add(tray);
        // Gold frame
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.28, emissive: 0x3a2000 });
        const t = 0.28;
        const parts = [[8 + t * 2, t, 0, 4 + t / 2], [8 + t * 2, t, 0, -4 - t / 2], [t, 8, -4 - t / 2, 0], [t, 8, 4 + t / 2, 0]];
        for (const [w, h, x, y] of parts) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMat);
            m.position.set(x, y, -0.3);
            this.group.add(m);
        }
        for (const [x, y] of [[-4.14, 4.14], [4.14, 4.14], [-4.14, -4.14], [4.14, -4.14]]) {
            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: 0xff5fa8, emissive: 0x8a1050, metalness: 0.2, roughness: 0.2 }));
            gem.position.set(x, y, 0);
            this.group.add(gem);
        }
        // Selection ring + hint glow
        this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
        this.selRing.visible = false;
        this.group.add(this.selRing);
        const hm = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
        this.hintMeshes = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), hm); m.position.z = -0.4; m.visible = false; this.group.add(m); return m; });
    }

    /** Fit the board to a battle-plane rectangle. */
    layout(rect) {
        const s = Math.min(rect.w, rect.h) / 8.7;
        this.scale = s;
        this.group.position.set(rect.cx, rect.cy, 0);
        this.group.scale.setScalar(s);
        this.clip.constant = rect.cy + 4.02 * s;    // plane: -y + c >= 0 keeps y <= c
    }

    cellPos(x, y) { return new THREE.Vector3(x - 3.5, 3.5 - y, 0); }
    /** World position of a cell's centre (for fx). */
    cellWorld(x, y, z = 0.6) { return this.group.localToWorld(new THREE.Vector3(x - 3.5, 3.5 - y, z)); }

    /** Screen-plane point → cell, or null. */
    pick(planeX, planeY) {
        const lx = (planeX - this.group.position.x) / this.scale;
        const ly = (planeY - this.group.position.y) / this.scale;
        const x = Math.floor(lx + 4), y = Math.floor(4 - ly);
        if (x < 0 || y < 0 || x >= W || y >= H) return null;
        return { x, y, fx: lx + 4 - x, fy: 4 - ly - y };
    }

    _new(id, t, sp, x, y) {
        const obj = makeGem(t, sp);
        obj.position.copy(this.cellPos(x, y));
        this.group.add(obj);
        const rec = { id, t, sp, obj, x, y, tx: x, ty: y, vy: 0, tween: null, dying: 0, pop: 0, seed: Math.random() * 10, spin: 0 };
        this.gems.set(id, rec);
        return rec;
    }

    _remove(rec) {
        this.group.remove(rec.obj);
        this.gems.delete(rec.id);
    }

    _retype(rec, t, sp) {
        if (rec.t === t && rec.sp === sp) return;
        const pos = rec.obj.position.clone();
        this.group.remove(rec.obj);
        rec.obj = makeGem(t, sp);
        rec.obj.position.copy(pos);
        this.group.add(rec.obj);
        rec.t = t; rec.sp = sp;
        rec.pop = 1;
    }

    /** Make the view match the board exactly. */
    sync(board) {
        const seen = new Set();
        board.cells.forEach((c, i) => {
            if (!c) return;
            const x = i % W, y = (i / W) | 0;
            seen.add(c.id);
            let rec = this.gems.get(c.id);
            if (!rec) rec = this._new(c.id, c.t, c.sp, x, y);
            this._retype(rec, c.t, c.sp);
            rec.x = rec.tx = x; rec.y = rec.ty = y; rec.vy = 0; rec.tween = null; rec.dying = 0;
            rec.obj.position.copy(this.cellPos(x, y));
            rec.obj.scale.setScalar(1);
            rec.obj.visible = true;
        });
        for (const rec of [...this.gems.values()]) if (!seen.has(rec.id)) this._remove(rec);
        this.select(null);
    }

    reset(board) {
        for (const rec of [...this.gems.values()]) this._remove(rec);
        this.sync(board);
    }

    select(cell) {
        this.selected = cell;
        this.selRing.visible = !!cell;
        if (cell) this.selRing.position.copy(this.cellPos(cell.x, cell.y)).setZ(0.45);
    }

    hint(move) {
        this.hintCells = move ? [move.a, move.b] : null;
        this.hintT = 0;
        this.hintMeshes.forEach((m, i) => {
            m.visible = !!move;
            if (move) m.position.copy(this.cellPos(this.hintCells[i].x, this.hintCells[i].y)).setZ(-0.4);
        });
    }

    // ------------------------------------------------------------------ Event playback

    play(e) {
        switch (e.k) {
            case 'swap': {
                const a = this.gems.get(e.ids[0]), b = this.gems.get(e.ids[1]);
                if (a) this._tween(a, e.b.x, e.b.y, 0.17);
                if (b) this._tween(b, e.a.x, e.a.y, 0.17);
                return 0.17;
            }
            case 'clear': {
                let blastTime = 0;
                for (const bl of e.blasts) {
                    const p = this.cellWorld(bl.x, bl.y, 1);
                    if (bl.kind === 'lineH') this.fx.beam(this.cellWorld(3.5, bl.y, 1), 0, 8.6 * this.scale, 0.55 * this.scale, 0xfff2a0);
                    else if (bl.kind === 'lineV') this.fx.beam(this.cellWorld(bl.x, 3.5, 1), Math.PI / 2, 8.6 * this.scale, 0.55 * this.scale, 0xfff2a0);
                    else if (bl.kind === 'bomb') { this.fx.ring(p, 0xff8a2a, 2.2 * this.scale); this.fx.burst(p, 0xffb040, 26, { speed: 9 * this.scale, size: 0.5 * this.scale }); }
                    else if (bl.kind === 'prism') this.fx.ring(p, 0xff66ff, 4 * this.scale);
                    blastTime = 0.12;
                }
                if (e.prism) {
                    const p = this.cellWorld(e.prism.x, e.prism.y, 1);
                    this.fx.ring(p, 0xffffff, 6 * this.scale, { dur: 0.6 });
                    for (const c of e.cells) this.fx.beam(p.clone().lerp(this.cellWorld(c.x, c.y, 1), 0.5), Math.atan2(this.cellWorld(c.x, c.y).y - p.y, this.cellWorld(c.x, c.y).x - p.x), p.distanceTo(this.cellWorld(c.x, c.y, 1)), 0.12 * this.scale, GEM_COLORS[c.t] ?? 0xffffff, 0.3);
                    blastTime = 0.18;
                }
                for (const c of e.cells) {
                    const rec = this.gems.get(c.id);
                    if (!rec) continue;
                    rec.dying = 0.001;
                    const p = this.cellWorld(c.x, c.y, 0.8);
                    this.fx.burst(p, GEM_COLORS[c.t] ?? 0xffffff, 7, { speed: 5 * this.scale, size: 0.42 * this.scale, life: 0.5, gravity: -8 * this.scale });
                }
                return 0.2 + blastTime;
            }
            case 'make': {
                const rec = this.gems.get(e.id);
                if (rec) {
                    this._retype(rec, e.t, e.sp);
                    const p = this.cellWorld(e.x, e.y, 1);
                    this.fx.ring(p, e.t === G.PRISM ? 0xff66ff : 0xffffff, 1.4 * this.scale);
                    this.fx.burst(p, 0xffffff, 10, { speed: 4 * this.scale, size: 0.35 * this.scale, star: true });
                }
                return 0.12;
            }
            case 'fall': {
                let maxD = 0;
                for (const mv of e.moves) {
                    const rec = this.gems.get(mv.id);
                    if (!rec) continue;
                    rec.ty = mv.y1; rec.tx = mv.x; rec.vy = 0;
                    maxD = Math.max(maxD, mv.y1 - rec.y);
                }
                for (const s of e.spawns) {
                    const rec = this._new(s.id, s.t, s.sp, s.x, s.from - 0.6);
                    rec.ty = s.y; rec.vy = 2;
                    maxD = Math.max(maxD, s.y - rec.y);
                }
                return Math.sqrt((2 * Math.max(0.5, maxD)) / GRAV) + 0.07;
            }
            case 'shuffle': {
                for (const c of e.cells) {
                    let rec = this.gems.get(c.id);
                    if (!rec) rec = this._new(c.id, c.t, c.sp, c.x, c.y);
                    this._retype(rec, c.t, c.sp);
                    this._tween(rec, c.x, c.y, 0.55, true);
                }
                return 0.6;
            }
            case 'morph': {
                for (const c of e.cells) {
                    const rec = this.gems.get(c.id);
                    if (!rec) continue;
                    this._retype(rec, c.t, c.sp);
                    this.fx.burst(this.cellWorld(c.x, c.y, 0.8), GEM_COLORS[c.t] ?? 0xffffff, 6, { speed: 3 * this.scale, size: 0.35 * this.scale, star: true });
                }
                return 0.3;
            }
            default: return 0;
        }
    }

    /** A rejected swap: slide over and back. */
    bounce(a, b) {
        const ra = this._at(a.x, a.y), rb = this._at(b.x, b.y);
        if (ra) { ra.tween = { fx: a.x, fy: a.y, tx: b.x, ty: b.y, t: 0, dur: 0.28, back: true }; }
        if (rb) { rb.tween = { fx: b.x, fy: b.y, tx: a.x, ty: a.y, t: 0, dur: 0.28, back: true }; }
    }

    _at(x, y) {
        for (const r of this.gems.values()) if (!r.dying && Math.round(r.tx) === x && Math.round(r.ty) === y) return r;
        return null;
    }

    _tween(rec, x, y, dur, spin) {
        rec.tween = { fx: rec.x, fy: rec.y, tx: x, ty: y, t: 0, dur, spin };
        rec.tx = x; rec.ty = y;
    }

    update(dt) {
        this.time += dt;
        animateGemMaterials(this.time);
        const tm = this.time;
        for (const rec of [...this.gems.values()]) {
            const o = rec.obj;
            if (rec.dying) {
                rec.dying += dt;
                const k = rec.dying / 0.2;
                if (k >= 1) { this._remove(rec); continue; }
                o.scale.setScalar(k < 0.35 ? 1 + k * 0.9 : (1 - k) * 1.5);
                o.rotation.z += dt * 10;
                continue;
            }
            if (rec.tween) {
                const tw = rec.tween;
                tw.t += dt;
                let k = Math.min(1, tw.t / tw.dur);
                let e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                if (tw.back) e = Math.sin(k * Math.PI) * 0.45;
                rec.x = tw.fx + (tw.tx - tw.fx) * e;
                rec.y = tw.fy + (tw.ty - tw.fy) * e;
                if (tw.spin) o.rotation.z = (1 - k) * Math.PI * 2;
                if (k >= 1) { rec.tween = null; if (!tw.back) { rec.x = tw.tx; rec.y = tw.ty; } else { rec.x = tw.fx; rec.y = tw.fy; } o.rotation.z = 0; }
            } else if (rec.y < rec.ty) {
                rec.vy += GRAV * dt;
                rec.y += rec.vy * dt;
                if (rec.y >= rec.ty) { rec.y = rec.ty; rec.land = 1; rec.vy = 0; }
            } else {
                rec.y = rec.ty; rec.x = rec.tx;
            }
            o.position.x = rec.x - 3.5;
            o.position.y = 3.5 - rec.y;
            // Idle life: gentle bob and tilt; specials spin; a squash when landing.
            const body = o.userData.body;
            let sc = 1, squash = 1;
            if (rec.land) { rec.land = Math.max(0, rec.land - dt * 6); squash = 1 - Math.sin(rec.land * Math.PI) * 0.16; }
            if (rec.pop) { rec.pop = Math.max(0, rec.pop - dt * 4); sc *= 1 + Math.sin(rec.pop * Math.PI) * 0.35; }
            const hinted = this.hintCells && this.hintCells.some((c) => c.x === Math.round(rec.tx) && c.y === Math.round(rec.ty));
            if (hinted) sc *= 1 + Math.max(0, Math.sin(tm * 7)) * 0.15;
            if (this.selected && this.selected.x === rec.tx && this.selected.y === rec.ty) sc *= 1.12 + Math.sin(tm * 10) * 0.04;
            o.scale.set(sc * (2 - squash), sc * squash, sc);
            body.rotation.y = Math.sin(tm * 1.3 + rec.seed) * 0.25 + (rec.t === G.COIN ? tm * 1.8 : 0);
            body.rotation.x = Math.sin(tm * 1.1 + rec.seed * 2) * 0.12;
            body.position.z = Math.sin(tm * 2 + rec.seed) * 0.03;
            const spc = o.getObjectByName('special');
            if (spc) {
                if (rec.sp === SP.BOMB) spc.rotation.z += dt * 1.6;
                else spc.scale.setScalar(1 + Math.sin(tm * 8) * 0.08);
            }
        }
        if (this.hintCells) {
            this.hintT += dt;
            const m = this.hintMeshes[0].material;
            m.opacity = 0.25 + Math.max(0, Math.sin(tm * 6)) * 0.35;
        }
        if (this.selRing.visible) this.selRing.rotation.z += dt * 2;
    }

    busy() {
        for (const r of this.gems.values()) if (r.dying || r.tween || r.y < r.ty) return true;
        return false;
    }
}
