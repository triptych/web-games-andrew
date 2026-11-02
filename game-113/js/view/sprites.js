// Textures for every person and monster, painted on demand and cached. Side views face right when painted; a `flip`
// mirrors them for facing left. Monsters are painted facing left; flip turns them right.

import * as THREE from 'three';
import { drawPerson, drawOtto, drawRobot, CHOIR } from './people.js';
import { drawMonster } from './monsters.js';
import { CHARS, NPCS } from '../sim/data/chars.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { mkTex } from './tiles.js';

const INST = { lyra: 'drum', sera: 'harp', mari: 'voice', ingrid: 'horn' };
export function lookOf(id) {
    if (CHARS[id]) return { ...CHARS[id].look, inst: INST[id] };
    if (NPCS[id]?.look) return NPCS[id].look;
    if (CHOIR[id]) return CHOIR[id];
    return null;
}
export const isMech = (id) => id === 'otto' || id === 'archivist';

export class SpriteLib {
    constructor() { this.cache = new Map(); }
    _get(key, paint) {
        let e = this.cache.get(key);
        if (!e) { const P = paint(); e = { tex: mkTex(P.toCanvas()), w: P.w, h: P.h }; this.cache.set(key, e); }
        return e;
    }
    /** id: a character id ('lyra', 'bram', 'choir3', 'otto', 'archivist'). */
    person(id, view, f, pose, flip, opts = {}) {
        const key = `p|${id}|${view}|${f}|${pose || ''}|${flip ? 1 : 0}|${opts.lit === false ? 0 : 1}`;
        return this._get(key, () => {
            let P;
            if (id === 'otto') P = drawOtto(view, f, opts);
            else if (id === 'archivist') P = drawRobot(view, f);
            else P = drawPerson(lookOf(id) || {}, view, f, pose);
            if (flip) P.flipX();
            return P;
        });
    }
    monster(enemyId, flip = false) {
        const e = ENEMIES[enemyId];
        const sprite = e ? e.sprite : enemyId, pal = e ? e.pal : 'crystal';
        return this._get(`m|${sprite}|${pal}|${flip ? 1 : 0}`, () => { const P = drawMonster(sprite, pal); if (flip) P.flipX(); return P; });
    }
    raw(key, paint) { return this._get(key, paint); }
}

export function radialTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)', outer = 'rgba(255,255,255,0)', size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner); g.addColorStop(0.3, mid); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
export const shadowTexture = () => radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)');

/** A music note glyph, white, for the flying-note effects. */
export function noteTexture(glyph = '♪') {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.font = 'bold 50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(255,255,255,0.9)'; x.shadowBlur = 10; x.fillStyle = '#ffffff';
    x.fillText(glyph, 32, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
