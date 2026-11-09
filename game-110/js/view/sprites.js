// Textures for every sprite, painted on demand and cached; also small pixel icons for the DOM panels, so the shop
// shows the same minion that appears in the castle.

import * as THREE from 'three';
import { drawOverlord, drawMinion, drawVisitor, drawStation, drawHenchman, drawPet, drawGraveIcon, PET_GEOM } from './art.js';
import { assetPx, petAssetPx } from './assets.js';

function entryOf(px) {
    const c = px.toCanvas();
    const t = new THREE.CanvasTexture(c);
    if (px.smooth) {                           // generated art: filtered, with mipmaps, so it stays clean at any size
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    } else { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    t.colorSpace = THREE.SRGBColorSpace;
    // empty rows under the feet, so sprites stand on the floor rather than hover
    let last = px.h - 1;
    outer: for (; last >= 0; last--) for (let x = 0; x < px.w; x++) if (px.d[(last * px.w + x) * 4 + 3] > 40) break outer;
    return { tex: t, w: px.w, h: px.h, pad: (px.h - 1 - last) / px.h, px, canvas: c };
}

export class SpriteLib {
    constructor() { this.cache = new Map(); this.icons = new Map(); }
    get(key, paint) {
        let e = this.cache.get(key);
        if (!e) { e = entryOf(paint()); this.cache.set(key, e); }
        return e;
    }
    // generated art first (assets.js), the sprite painted in code as the fallback
    overlord(pose, tool) { return this.get(`o|${pose}|${tool}`, () => assetPx('overlord/' + tool, { idle: 0, craft: 1, cackle: 2 }[pose] ?? 0) || drawOverlord(pose, tool)); }
    minion(id) { return this.get(`m|${id}`, () => assetPx('minion/' + id) || drawMinion(id)); }
    visitor(kind) { return this.get(`v|${kind}`, () => assetPx('visitor/' + kind) || drawVisitor(kind)); }
    station(h, tier) { return this.get(`s|${h}|${tier}`, () => assetPx('station/' + h, tier) || drawStation(h, tier)); }
    henchman() { return this.get('h', () => assetPx('henchman') || drawHenchman()); }
    pet(id, o = {}) { return this.get(`p|${id}|${o.mood || 'idle'}|${o.acc || ''}|${o.frame || 0}`, () => petAssetPx(id, o, PET_GEOM[id]) || drawPet(id, o)); }
    grave(id) { return this.get(`g|${id}`, () => assetPx(id === 'salon' ? 'icon/scissors' : id === 'pets' ? 'icon/paw' : 'token/skull') || drawGraveIcon(id)); }

    /** A crisp data-URL icon for the DOM, scaled up by whole pixels. kind: minion | visitor | overlord | henchman | station | pet */
    icon(kind, id, scale = 2) {
        const key = `${kind}|${id}|${scale}`;
        if (this.icons.has(key)) return this.icons.get(key);
        const e = kind === 'minion' ? this.minion(id) : kind === 'visitor' ? this.visitor(id) : kind === 'henchman' ? this.henchman() : kind === 'pet' ? this.pet(id)
            : kind === 'station' ? this.station(id, 1) : this.overlord('idle', id || 'cook');
        const c = document.createElement('canvas');
        c.width = e.w * scale; c.height = e.h * scale;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = !!e.px.smooth;
        x.imageSmoothingQuality = 'high';
        x.drawImage(e.canvas, 0, 0, c.width, c.height);
        const url = c.toDataURL();
        this.icons.set(key, url);
        return url;
    }
}
