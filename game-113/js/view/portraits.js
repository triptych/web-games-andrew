// Dialogue portraits: a head-and-shoulders crop of the front view, scaled up with hard pixels. No three.js, so the UI can use it.

import { drawPerson, drawOtto, drawRobot } from './people.js';
import { drawMonster } from './monsters.js';
import { scaledCanvas } from './pixel.js';
import { CHARS, NPCS } from '../sim/data/chars.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { CHOIR } from './people.js';
import { assetCanvas } from './assets.js';

const cache = new Map();
const MONSTER_OF = { vorthrax: 'vorthrax', warden: 'warden', maelstra: 'maelstra', hollowhay: 'hollowhay', rimefang: 'rimefang' };

export function portrait(who, scale = 4) {
    const key = who + '|' + scale;
    if (cache.has(key)) return cache.get(key);
    let c = fromAsset(who, scale);
    if (c) { cache.set(key, c); return c; }
    if (who === 'otto') c = scaledCanvas(drawOtto('down', 0), 4, 0, 32, 28, scale * 0.75);
    else if (who === 'archivist') c = scaledCanvas(drawRobot('down', 0), 2, 1, 20, 22, scale);
    else if (who === 'colossus') c = scaledCanvas(drawMonster('colossus'), 30, 0, 52, 64, scale * 0.42);
    else if (MONSTER_OF[who]) {
        const e = ENEMIES[MONSTER_OF[who]], P = drawMonster(e.sprite, e.pal);
        const w = Math.min(P.w, 64), h = Math.min(P.h, 60);
        c = scaledCanvas(P, 0, 0, w, h, scale * (P.w > 64 ? 0.42 : 0.6));
    } else {
        const look = CHARS[who]?.look || NPCS[who]?.look || CHOIR[who];
        if (look) c = scaledCanvas(drawPerson(look, 'down', 0), 4, 1, 16, 20, scale);
    }
    cache.set(key, c);
    return c;
}

/**
 * Generated art first: a portrait asset, or for the dragon, the wardens and the Colossus their monster art fitted into the
 * same 4:5 frame. The canvas is flagged (data-art) so the CSS draws it smoothly instead of as hard pixels.
 */
function fromAsset(who, scale) {
    const src = assetCanvas('portrait/' + who) || assetCanvas('monster/' + who);
    if (!src) return null;
    const W = 16 * scale * 2, H = 20 * scale * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    const k = Math.min(W / src.width, H / src.height);
    const w = src.width * k, h = src.height * k;
    x.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    c.dataset.art = '1';
    return c;
}
