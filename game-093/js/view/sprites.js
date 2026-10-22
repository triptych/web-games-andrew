// Textures for every person and monster, made on demand from the pixel painters and cached.

import * as THREE from 'three';
import { drawHero, FW, FH } from './heroes.js';
import { drawMonster } from './monsters.js';
import { Px } from './pixel.js';
import { CHARS } from '../sim/data/classes.js';

const mkTex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
};
export { mkTex };

export class SpriteLib {
    constructor() { this.tex = new Map(); this.px = new Map(); }

    lookOf(ref) {
        if (ref.char) return CHARS[ref.char].look;
        return ref.look;
    }
    heroPx(look, view, f, pose) {
        const key = JSON.stringify(look) + `|${view}${f}${pose || ''}`;
        let p = this.px.get(key);
        if (!p) { p = drawHero(look, view, f, pose); this.px.set(key, p); }
        return p;
    }
    /** A frame of a person as a texture. frame: 'down1', 'up0', 'side2', 'b:idle' ... */
    hero(look, frame) {
        const key = JSON.stringify(look) + '|' + frame;
        let t = this.tex.get(key);
        if (!t) {
            let p;
            if (frame.startsWith('b:')) p = this.heroPx(look, 'side', 1, frame.slice(2));
            else p = this.heroPx(look, frame.replace(/\d$/, ''), +frame.slice(-1), null);
            t = mkTex(p.toCanvas()); this.tex.set(key, t);
        }
        return t;
    }
    monster(sprite, pal) {
        const key = `m|${sprite}|${pal}`;
        let e = this.tex.get(key);
        if (!e) {
            const p = drawMonster(sprite, pal || 'base');
            e = { tex: mkTex(p.toCanvas()), w: p.w, h: p.h };
            this.tex.set(key, e);
        }
        return e;
    }
    /** A head-and-shoulders crop for dialogue portraits. Returns a fresh canvas. */
    portrait(face, scale = 4) {
        let src, sx, sy, sw, sh;
        if (!face) return null;
        if (face.char || face.look) {
            src = this.heroPx(this.lookOf(face), 'down', 1, null).toCanvas(); sx = 5; sy = 1; sw = 22; sh = 24;
        } else {
            const p = drawMonster(face.enemy ? ENEMY_SPRITE[face.enemy]?.sprite || face.enemy : 'slime', face.pal || ENEMY_SPRITE[face.enemy]?.pal || 'base');
            src = p.toCanvas(); sx = 0; sy = 0; sw = p.w; sh = Math.min(p.h, p.w * 1.1);
        }
        const c = document.createElement('canvas'); c.width = sw * scale; c.height = sh * scale;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return c;
    }
}
export const ENEMY_SPRITE = {};
export function registerEnemies(E) { for (const [k, e] of Object.entries(E)) ENEMY_SPRITE[k] = { sprite: e.sprite, pal: e.pal }; }

/** A soft round shadow and a glow, as textures. */
export function blobTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(0,0,0,0.65)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
}
export function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}
export function iconTexture(kind) {
    const P = new Px(16, 16);
    if (kind === 'quest') { P.mrect(6, 1, 4, 9).paint('#ffd35c'); P.mrect(6, 12, 4, 3).paint('#ffd35c'); }
    else if (kind === 'ready') { P.mell(8, 5, 4, 4).mrect(6, 8, 4, 3).mrect(6, 13, 4, 2).paint('#7fe8ff'); P.mp(7, 4).mp(8, 3).mp(9, 4).mp(9, 5).mp(8, 6).fill('#1a2a4a'); }
    else if (kind === 'story') { P.mpoly([[8, 0], [14, 7], [8, 14], [2, 7]]).paint('#ff9a3a'); P.mpoly([[8, 3], [11, 7], [8, 11], [5, 7]]).paint('#fff0a0'); }
    else if (kind === 'alert') { P.mrect(6, 0, 4, 10).paint('#ff4a4a'); P.mrect(6, 12, 4, 3).paint('#ff4a4a'); }
    else if (kind === 'chest') { P.mpoly([[8, 0], [12, 5], [8, 10], [4, 5]]).paint('#ffd35c'); }
    P.outline('#2a1a10');
    return mkTex(P.toCanvas());
}
