// Textures for every sprite, painted on demand and cached; also small pixel icons for the DOM panels, so the shop
// shows the same minion that appears in the castle.

import * as THREE from 'three';
import { drawOverlord, drawMinion, drawVisitor, drawStation, drawHenchman } from './art.js';

function entryOf(px) {
    const c = px.toCanvas();
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    // empty rows under the feet, so sprites stand on the floor rather than hover
    let last = px.h - 1;
    outer: for (; last >= 0; last--) for (let x = 0; x < px.w; x++) if (px.d[(last * px.w + x) * 4 + 3]) break outer;
    return { tex: t, w: px.w, h: px.h, pad: (px.h - 1 - last) / px.h, px, canvas: c };
}

export class SpriteLib {
    constructor() { this.cache = new Map(); this.icons = new Map(); }
    get(key, paint) {
        let e = this.cache.get(key);
        if (!e) { e = entryOf(paint()); this.cache.set(key, e); }
        return e;
    }
    overlord(pose, tool) { return this.get(`o|${pose}|${tool}`, () => drawOverlord(pose, tool)); }
    minion(id) { return this.get(`m|${id}`, () => drawMinion(id)); }
    visitor(kind) { return this.get(`v|${kind}`, () => drawVisitor(kind)); }
    station(h, tier) { return this.get(`s|${h}|${tier}`, () => drawStation(h, tier)); }
    henchman() { return this.get('h', () => drawHenchman()); }

    /** A crisp data-URL icon for the DOM, scaled up by whole pixels. kind: minion | visitor | overlord | henchman | station */
    icon(kind, id, scale = 2) {
        const key = `${kind}|${id}|${scale}`;
        if (this.icons.has(key)) return this.icons.get(key);
        const e = kind === 'minion' ? this.minion(id) : kind === 'visitor' ? this.visitor(id) : kind === 'henchman' ? this.henchman()
            : kind === 'station' ? this.station(id, 1) : this.overlord('idle', id || 'cook');
        const c = document.createElement('canvas');
        c.width = e.w * scale; c.height = e.h * scale;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(e.canvas, 0, 0, c.width, c.height);
        const url = c.toDataURL();
        this.icons.set(key, url);
        return url;
    }
}
