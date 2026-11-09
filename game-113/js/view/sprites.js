// Textures for every person and monster, painted on demand and cached. Side views face right when painted; a `flip`
// mirrors them for facing left. Monsters are painted facing left; flip turns them right.

import * as THREE from 'three';
import { drawPerson, drawOtto, drawRobot, CHOIR } from './people.js';
import { drawMonster } from './monsters.js';
import { CHARS, NPCS } from '../sim/data/chars.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { mkTex, mkTexSmooth } from './tiles.js';
import { assetPx, assetCell, hasAsset } from './assets.js';

const INST = { lyra: 'drum', sera: 'harp', mari: 'voice', ingrid: 'horn' };
export function lookOf(id) {
    if (CHARS[id]) return { ...CHARS[id].look, inst: INST[id] };
    if (NPCS[id]?.look) return NPCS[id].look;
    if (CHOIR[id]) return CHOIR[id];
    return null;
}
// A person's generated sheet is 3 columns (idle, step, step) by 3 rows (front, back, side). Poses come from a second
// sheet (idle, play, hurt / ko, cheer); a character without one gets its pose made from the walk sprites.
const VIEW_ROW = { down: 0, up: 1, side: 2 };
const POSE_CELL = { idle: 0, play: 1, hurt: 2, ko: 3, down: 3, cheer: 4 };
function generatedPerson(id, view, f, pose, flip, opts) {
    if (!hasAsset('person/' + id)) return null;
    const dim = opts.lit === false ? 0.62 : 0;
    if (pose && POSE_CELL[pose] !== undefined) {
        const i = POSE_CELL[pose];
        if (hasAsset('pose/' + id)) return assetCell('pose/' + id, i % 3, Math.floor(i / 3), { flip, dim });
        const lying = pose === 'ko' || pose === 'down';
        const row = pose === 'cheer' ? 0 : 2;                                  // cheer faces the camera, the rest stand in profile
        return assetCell('person/' + id, 0, row, { flip, dim, lie: lying, tilt: pose === 'hurt' ? -0.18 : 0 });
    }
    return assetCell('person/' + id, f === 1 ? 1 : f === 3 ? 2 : 0, VIEW_ROW[view] ?? 0, { flip, dim });
}
export const isMech = (id) => id === 'otto' || id === 'archivist';

export class SpriteLib {
    constructor() { this.cache = new Map(); }
    _get(key, paint) {
        let e = this.cache.get(key);
        if (!e) { const P = paint(); e = { tex: (P.smooth ? mkTexSmooth : mkTex)(P.toCanvas()), w: P.w, h: P.h }; this.cache.set(key, e); }
        return e;
    }
    /** id: a character id ('lyra', 'bram', 'choir3', 'otto', 'archivist'). */
    person(id, view, f, pose, flip, opts = {}) {
        const key = `p|${id}|${view}|${f}|${pose || ''}|${flip ? 1 : 0}|${opts.lit === false ? 0 : 1}`;
        return this._get(key, () => {
            const G = generatedPerson(id, view, f, pose, flip, opts);        // generated art first, the painter as the fallback
            if (G) return G;
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
        return this._get(`m|${sprite}|${pal}|${flip ? 1 : 0}`, () => {
            const A = assetPx('monster/' + enemyId, flip);      // generated art first, the painter as the fallback
            if (A) return A;
            const P = drawMonster(sprite, pal); if (flip) P.flipX(); return P;
        });
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
