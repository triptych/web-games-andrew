// ============================================================
// Sprite cache: paints on first use, keeps the canvas forever.
// ============================================================

import { ITEM } from '../data/items.js';
import { CROP } from '../data/crops.js';
import { paintItem } from '../gen/art/items.js';
import { paintGround, paintObject, paintBuilding, paintHeartwood, paintFacade, paintCrop, paintSoil, paintGlimmer } from '../gen/art/world.js';
import { paintPerson, paintMonster, paintGlim, paintAnimal } from '../gen/art/people.js';

export class Sprites {
    constructor(game) {
        this.game = game;
        this.c = new Map();
        this.urls = new Map();
    }
    get(key, make) {
        let v = this.c.get(key);
        if (!v) { v = make(); this.c.set(key, v); }
        return v;
    }
    hue(rg) { const w = this.game.world; return rg === 0 ? w.glen.hue : (w.regions[rg - 1]?.hue ?? 0); }
    ground(g, rg, season, v) { return this.get(`g${g}:${rg}:${season}:${v}`, () => paintGround(g, rg, season, v, this.hue(rg)).toCanvas()); }
    obj(o, v, rg, season, extra = {}, key = '') {
        return this.get(`o${o}:${v}:${rg}:${season}:${key}`, () => { const r = paintObject(o, v, rg, season, extra); return r ? { c: r.p.toCanvas(), ox: r.ox, oy: r.oy } : null; });
    }
    glimmer(kind, awake, used) { return this.get(`gl:${kind}:${awake}:${used}`, () => { const r = paintGlimmer(kind, awake, used); return { c: r.p.toCanvas(), ox: r.ox, oy: r.oy }; }); }
    item(id) { return this.get('i:' + id, () => paintItem(ITEM[id] ?? ITEM.stone).toCanvas()); }
    itemURL(id) {
        let u = this.urls.get(id);
        if (!u) { const c = this.item(id); u = c.toDataURL ? c.toDataURL() : ''; this.urls.set(id, u); }
        return u;
    }
    lookKey(look, opt) { return `${look.skin}${look.hair}${look.hairColor}${look.eyes}${look.top}${look.bottom}${look.acc}${opt?.crown ? 'c' : ''}`; }
    person(look, dir, frame, opt) { return this.get(`p:${this.lookKey(look, opt)}:${dir}:${frame}`, () => paintPerson(look, dir, frame, opt).toCanvas()); }
    monster(sp, frame) { const size = sp.boss ? 32 : 16; return this.get(`m:${sp.id}:${frame}`, () => paintMonster(sp, frame, size).toCanvas()); }
    animal(kind, frame, flip) { return this.get(`a:${kind}:${frame}:${flip}`, () => { const p = paintAnimal(kind, frame); return (flip ? p.flipped() : p).toCanvas(); }); }
    glim(frame) { return this.get('glim' + frame, () => paintGlim(frame).toCanvas()); }
    building(type, opt = {}) { return this.get(`b:${type}:${JSON.stringify(opt)}`, () => paintBuilding(type, opt).toCanvas()); }
    heart(stage, season) { return this.get(`h:${stage}:${season}`, () => paintHeartwood(stage, season).toCanvas()); }
    facade(kind, rg) { return this.get(`f:${kind}:${rg}`, () => paintFacade(kind, rg).toCanvas()); }
    crop(id, stage) { return this.get(`c:${id}:${stage}`, () => paintCrop(CROP[id], stage).toCanvas()); }
    soil(w) { return this.get('soil' + w, () => paintSoil(w).toCanvas()); }
}
