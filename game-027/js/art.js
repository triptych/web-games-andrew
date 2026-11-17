// The fal paintings in art/: loaded in the background, so the game never waits on them. The DOM
// uses their URLs directly; the view asks for decoded images (and three.js textures) once they are in.
// ?art=0 skips them all (the code-drawn stand-ins are used), for tests of the fallbacks.

export const ART = 'art/';
const off = new URLSearchParams(location.search).get('art') === '0';

export class Art {
    constructor() {
        this.imgs = {};
        this.waiting = {};
        this.listeners = [];
        this.failed = [];
    }
    url(name) { return off ? '' : `${ART}${name}.webp`; }
    /** Start loading; calls back (and every onLoad listener) when it arrives. */
    load(name) {
        if (off || this.imgs[name] || this.waiting[name]) return this.waiting[name] || Promise.resolve(this.imgs[name]);
        const img = new Image();
        img.decoding = 'async';
        const p = new Promise((res) => {
            img.onload = () => { this.imgs[name] = img; delete this.waiting[name]; for (const f of this.listeners) f(name, img); res(img); };
            img.onerror = () => { delete this.waiting[name]; this.failed.push(name); res(null); };
        });
        img.src = this.url(name);
        this.waiting[name] = p;
        return p;
    }
    loadAll(names) { return Promise.all(names.map((n) => this.load(n))); }
    img(name) { return this.imgs[name] || null; }
    onLoad(f) { this.listeners.push(f); }
}
