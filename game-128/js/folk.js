// Gemheart Saga — Briarwick's villagers (v1.2.2): small sprites that walk the lanes of the village backdrop, stop at
// the well, the stalls, the bridge and the forge to do things, and chat. Pure decoration: it never reads or changes G.
//
// The backdrop (art/bg/village.webp, 1280x720) is drawn with background-size: cover, so the walkers use the same
// transform: image pixels -> screen. Each walker is one absolutely placed element moved only with transform, so the
// compositor moves it and nothing repaints (the village once crawled under software rendering because of repaints).

import { ART } from './assets.js';

const IMG_W = 1280, IMG_H = 720;
const PERSON_H = 36;              // a person's height in backdrop pixels: a little taller than the doorways read best
const FOLK_PX = 96;               // the exported sprites' person height (dev/art/export.py FOLK_PX)
// the exported sizes (art/sprites.json "folk-*"; simtest checks they match), and how much smaller than drawn on the
// sheet each animal walks (the model drew them nearly as tall as people)
export const FOLK_SIZE = { applewife: [47, 88], baker: [57, 91], cat: [54, 53], dog: [71, 57], elder: [51, 86], farmer: [69, 90],
    fisherboy: [64, 88], flowergirl: [44, 82], goose: [49, 61], guard: [61, 96], hen: [55, 51], hoopchild: [48, 63],
    milkmaid: [69, 89], monk: [60, 87], traveller: [61, 87], washerwoman: [50, 91] };
const SHRINK = { dog: 0.62, goose: 0.55, hen: 0.42, cat: 0.5 };

// The lanes: nodes in backdrop pixels, and which nodes join. Stations are where someone stops to do something.
const NODES = {
    bridgeW: [205, 606], bridge: [290, 568], bridgeE: [372, 528], plazaL: [430, 505], mid: [470, 468], mill: [412, 456],
    lane: [482, 430], inn: [522, 372], upper: [648, 336], upperR: [860, 305], right: [920, 372], well: [598, 458],
    stalls: [758, 420], plaza: [650, 470], center: [790, 505], forge: [842, 568], yard: [900, 575], temple: [985, 620],
    steps: [1068, 690],
};
const EDGES = [['bridgeW', 'bridge'], ['bridge', 'bridgeE'], ['bridgeE', 'plazaL'], ['plazaL', 'mid'], ['mid', 'mill'],
    ['mid', 'lane'], ['lane', 'inn'], ['inn', 'upper'], ['upperR', 'right'], ['right', 'center'],
    ['mid', 'well'], ['lane', 'well'], ['well', 'plaza'], ['well', 'stalls'], ['stalls', 'plaza'], ['plaza', 'center'],
    ['center', 'forge'], ['forge', 'yard'], ['yard', 'temple'], ['temple', 'steps']];
const LINKS = {};
for (const [a, b] of EDGES) { (LINKS[a] ||= []).push(b); (LINKS[b] ||= []).push(a); }
// what people do at a station: [action, seconds, face (+1 right, -1 left)]
const STATION = {
    well: [['draw', 4, 1], ['chat', 3, -1]],
    stalls: [['browse', 4, 1], ['chat', 3, -1]],
    bridge: [['gaze', 4, -1]],
    forge: [['warm', 3, 1]],
    steps: [['pray', 4, 1]],
    inn: [['chat', 3, 1]],
    temple: [['gaze', 3, 1]],
};
// who walks: [sprite, kind, speed in backdrop px/s]
const CAST = [['farmer', 'person', 16], ['applewife', 'person', 14], ['milkmaid', 'person', 12], ['hoopchild', 'child', 26],
    ['elder', 'elder', 8], ['washerwoman', 'person', 13], ['guard', 'guard', 14], ['fisherboy', 'fisher', 17],
    ['flowergirl', 'child', 18], ['monk', 'person', 11], ['baker', 'person', 15],
    ['dog', 'dog', 34], ['goose', 'goose', 12], ['hen', 'hen', 9], ['cat', 'cat', 20]];
const BUBBLES = { chat: ['…', '♪', 'Ha!', '♥', '?'], draw: ['~'], browse: ['$', '?'], pray: ['✦'], warm: ['♨'], gaze: ['…'], sniff: ['?'], sit: ['z'] };

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Folk {
    constructor(layer) {
        this.layer = layer;
        this.walkers = [];
        this.calm = false;
        this.box = { s: 1, ox: 0, oy: 0 };
        this.built = false;
    }

    build() {
        if (this.built) return;
        this.built = true;
        const names = Object.keys(NODES);
        CAST.forEach(([id, kind, speed], i) => {
            const el = document.createElement('div');
            el.className = 'walker';
            const im = document.createElement('i');
            im.style.backgroundImage = `url(${ART.folk(id)})`;
            const bub = document.createElement('b');
            bub.className = 'bub';
            el.append(im, bub);
            this.layer.append(el);
            const at = names[(i * 5) % names.length];
            const [x, y] = NODES[at];
            const w = { id, kind, speed, el, im, bub, at, from: at, to: null, x: x + rnd(-6, 6), y: y + rnd(-3, 3), dir: Math.random() < 0.5 ? 1 : -1,
                state: 'idle', t: rnd(0.5, 4), phase: Math.random() * 6, act: null, ox: rnd(-8, 8), oy: rnd(-4, 4) };
            this.walkers.push(w);
        });
        this.resize();
    }

    /** The backdrop's cover transform for the current village size. */
    resize() {
        const r = this.layer.getBoundingClientRect();
        const s = Math.max(r.width / IMG_W, r.height / IMG_H);
        this.box = { s, ox: (r.width - IMG_W * s) / 2, oy: (r.height - IMG_H * s) / 2 };
        const k = (PERSON_H / FOLK_PX) * s;
        for (const w of this.walkers) {
            const [sw, sh] = FOLK_SIZE[w.id];
            const kk = k * (SHRINK[w.id] || 1);
            w.im.style.width = `${Math.round(sw * kk)}px`;
            w.im.style.height = `${Math.round(sh * kk)}px`;
            w.bub.style.bottom = `${Math.round(sh * kk) + 2}px`;
        }
    }

    next(w) {
        const opts = (LINKS[w.at] || []).filter((n) => n !== w.from);
        return pickOf(opts.length ? opts : LINKS[w.at]);
    }

    /** Arrived at a node: maybe stop and do something, else walk on. */
    arrive(w) {
        const animal = ['dog', 'goose', 'hen', 'cat'].includes(w.kind);
        const st = STATION[w.at];
        if (w.kind === 'fisher' && w.at === 'bridge') return this.idle(w, 'fish', rnd(6, 10), -1);
        if (w.kind === 'guard' && Math.random() < 0.4) return this.idle(w, 'watch', rnd(3, 6), w.dir);
        if (animal) {
            if (w.kind === 'hen') return this.idle(w, 'peck', rnd(2, 5), w.dir);
            if (w.kind === 'cat' && Math.random() < 0.5) return this.idle(w, 'sit', rnd(4, 9), w.dir);
            if (w.kind === 'dog' && Math.random() < 0.4) return this.idle(w, 'sniff', rnd(1.5, 3), w.dir);
            if (w.kind === 'goose' && Math.random() < 0.5) return this.idle(w, 'peck', rnd(2, 4), w.dir);
        } else if (st && Math.random() < 0.65) {
            const [act, secs, face] = pickOf(st);
            return this.idle(w, act, rnd(secs * 0.7, secs * 1.5), face);
        } else if (Math.random() < 0.25) return this.idle(w, Math.random() < 0.5 ? 'chat' : 'gaze', rnd(1.5, 3.5), w.dir);
        this.walk(w);
    }

    idle(w, act, secs, face) {
        w.state = 'idle'; w.act = act; w.t = secs; w.dir = face;
        const b = BUBBLES[act];
        if (b && Math.random() < 0.7) { w.bub.textContent = pickOf(b); w.bub.classList.add('on'); }
    }

    walk(w) {
        w.state = 'walk'; w.act = null;
        w.bub.classList.remove('on');
        w.to = this.next(w);
        w.ox = rnd(-8, 8); w.oy = rnd(-4, 4);         // not everyone on the same line down a lane
    }

    frame(dt) {
        if (!this.built) return;
        dt = Math.min(dt, 0.1);
        const { s, ox, oy } = this.box;
        for (const w of this.walkers) {
            w.phase += dt;
            if (w.state === 'idle') {
                w.t -= dt;
                if (w.t <= 0) this.walk(w);
            } else {
                const [tx, ty] = NODES[w.to];
                const gx = tx + w.ox, gy = ty + w.oy;
                const dx = gx - w.x, dy = gy - w.y, d = Math.hypot(dx, dy);
                const v = w.speed * (this.calm ? 0.6 : 1) * dt;
                if (Math.abs(dx) > 0.5) w.dir = dx > 0 ? 1 : -1;
                if (d <= v) { w.x = gx; w.y = gy; w.from = w.at; w.at = w.to; this.arrive(w); }
                else { w.x += dx / d * v; w.y += dy / d * v; }
            }
            // the little animations: a step bob while walking; a dip for pecking and drawing water; a sway while chatting
            let bob = 0, rot = 0, sy = 1;
            if (!this.calm) {
                if (w.state === 'walk') {
                    const f = w.kind === 'dog' || w.kind === 'child' ? 14 : w.kind === 'elder' ? 6 : 10;
                    bob = -Math.abs(Math.sin(w.phase * f / 2)) * (w.kind === 'goose' ? 1.2 : 2);
                    rot = Math.sin(w.phase * f / 2) * (w.kind === 'goose' ? 7 : 3);
                } else if (w.act === 'peck' || w.act === 'draw' || w.act === 'sniff') {
                    const p = Math.max(0, Math.sin(w.phase * (w.act === 'peck' ? 7 : 2.5)));
                    rot = p * (w.act === 'peck' ? 18 : 6); sy = 1 - p * 0.06;
                } else if (w.act === 'chat' || w.act === 'browse') rot = Math.sin(w.phase * 3) * 2.5;
                else if (w.act === 'fish') rot = Math.sin(w.phase * 1.3) * 3;
                else if (w.act === 'sit') sy = 0.9;
            }
            const px = ox + w.x * s, py = oy + w.y * s + bob * s;
            w.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
            w.im.style.transform = `translateX(-50%) scaleX(${w.dir}) rotate(${rot.toFixed(1)}deg) scaleY(${sy})`;
            const z = Math.round(w.y);
            if (z !== w.z) { w.z = z; w.el.style.zIndex = String(z); }
        }
    }
}
