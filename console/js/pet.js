// The Dragonfly menu: your dragonfly from the Garden of Games as a pocket pet.
//
// It reads and writes the same memory the companion keeps on the island
// (localStorage `garden.companion`, see garden/js/companion.js): its name,
// its colours and what it wears, how full and how happy it is, the snacks
// you have given it, the places you have found together and the statues you
// have stood at. Feed it, pet it or play with it here and it remembers on the
// island, and the other way round (a Garden open in another tab hears about
// it at once).
//
// The screen: a little 8-bit stage where it hovers over a pond, flaps, blinks,
// eats what you give it a bite at a time, sends up hearts, sleeps on a reed
// late at night and droops when it is hungry; its name, mood and two meters;
// and a menu: Feed, Play, Pet, Places and Memories. Places lists everything
// you have found together (and what is still to find, with its hint); pick
// one and it flies you there: the island loads (index.html?go=…) and the
// dragonfly takes you the rest of the way, as its Travel tab does.

import { PLACES, SNACKS, PLAYS, CHATTER, BODIES, WINGS, ACCESSORIES, moodOf, decay, ago } from '../../garden/js/dragonfly-talk.js';
import { ListView, TextView, gameIconHTML } from './views.js';
import { sprite, spriteURL, icon, lookOf, W, H } from './pixel-dragonfly.js';
import { ICONS } from './icons.js';
import { sfx } from './sound.js';
import { esc, clamp } from './util.js';

export const MEM_KEY = 'garden.companion';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- memory

function readMem() {
    try {
        const v = JSON.parse(localStorage.getItem(MEM_KEY) || 'null');
        return v && typeof v === 'object' ? v : null;
    } catch {
        return null;
    }
}

/** Kept in memory when storage is blocked, so feeding still works until the page closes. */
let fallback = null;

/** The dragonfly's memory as it is now (hunger and joy faded for the time since), or null if never seen. */
export function currentMem() {
    const m = readMem() || fallback;
    if (!m) return null;
    for (const k of ['fed', 'places', 'games']) if (typeof m[k] !== 'object' || !m[k]) m[k] = {};
    m.look ||= {};
    if (!Number.isFinite(m.full)) m.full = 0.6;
    if (!Number.isFinite(m.joy)) m.joy = 0.6;
    if (m.met && m.moodAt) Object.assign(m, decay(m.full, m.joy, Math.max(0, Date.now() - m.moodAt) / 36e5));
    return m;
}

/** Change the memory and keep it, the way the island does (moodAt is now: the fading starts again from here). */
function update(fn) {
    const m = currentMem();
    if (!m?.met) return null;
    fn(m);
    m.moodAt = Date.now();
    fallback = m;
    try {
        localStorage.setItem(MEM_KEY, JSON.stringify(m));
    } catch {
        /* storage blocked: kept in memory */
    }
    return m;
}

const nameOf = (m) => m?.name || 'Dragonfly';
const paperOn = (app) => app.device.dataset.glow === 'paper';

/** Places found of how many there are: every place plus one path per genre (as the island counts them). */
function found(m, ctx) {
    return { n: Object.keys(m?.places || {}).length, of: PLACES.length + ctx.genreGroups.length };
}

// ---------------------------------------------------------------- flying you there

/** Off to the island: the launch screen with the dragonfly on it, then index.html?go=key. */
export function flyTo(app, key, label) {
    if (app.launching) return;
    const m = currentMem();
    if (!m?.met) return app.deny();
    const look = lookOf(m);
    const paper = paperOn(app);
    app.launching = true;
    sfx.whoosh();
    app.buzz([14, 70, 24]);
    const L = $('load');
    L.style.setProperty('--accent', look.body.a);
    L.querySelector('.ld-icon').innerHTML = `<span class="ld-df"><img src="${spriteURL({ look, frame: 0, paper })}" alt=""><img src="${spriteURL({ look, frame: 2, paper })}" alt=""></span>`;
    L.querySelector('.ld-title').textContent = label;
    L.querySelector('.ld-sub').textContent = `${nameOf(m)} is flying you there`;
    L.querySelector('.ld-word').textContent = 'Flying';
    L.hidden = false;
    L.classList.remove('go');
    void L.offsetWidth;
    L.classList.add('go');
    app.device.classList.add('busy');
    app.say(`${nameOf(m)} is flying you to ${label}`);
    app.launchT = setTimeout(() => location.assign(`../index.html?go=${encodeURIComponent(key)}`), reduceMotion.matches ? 450 : 1800);
}

// ---------------------------------------------------------------- the stage

/**
 * The pet's little world on the LCD, drawn at 1 canvas pixel per art pixel and scaled up by a whole
 * number. update() moves it, draw() paints it; the view runs both while it is on top.
 */
class Stage {
    constructor(view, box) {
        this.view = view;
        this.box = box;
        this.cv = box.querySelector('canvas');
        this.cx = this.cv.getContext('2d');
        this.sayEl = box.querySelector('.pet-say');
        this.parts = [];
        this.act = null;
        this.t = 0;
        this.idleFor = 0;
        this.blink = 2.5;
        this.wander = 0;
        this.thought = 9;
        this.p = { x: 40, y: 20, tx: 40, ty: 20, dir: 1 };
        this.size();
    }

    /** Fit the canvas to its box: a whole-number scale, about 120 art pixels across. */
    size() {
        // layout sizes, not getBoundingClientRect: the screen's power-on squashes it with a transform
        const r = { width: this.box.clientWidth, height: this.box.clientHeight };
        if (!r.width || !r.height) return false;
        const s = Math.max(2, Math.round(Math.min(r.width / 84, r.height / 44)));
        const w = Math.floor(r.width / s), h = Math.floor(r.height / s);
        if (w === this.w && h === this.h && s === this.s) return true;
        this.s = s;
        this.w = this.cv.width = w;
        this.h = this.cv.height = h;
        this.cv.style.width = `${w * s}px`;
        this.cv.style.height = `${h * s}px`;
        this.ground = h - 6;
        this.reed = { x: w - 12, top: Math.max(12, this.ground - 18) };
        if (!this.placed) {
            this.placed = true;
            this.p.x = this.p.tx = w * 0.42;
            this.p.y = this.p.ty = this.ground * 0.5;
        }
        this.p.x = clamp(this.p.x, 18, w - 18);
        this.p.y = clamp(this.p.y, 12, this.ground - 11);
        this.colours();
        return true;
    }

    /** The scenery is drawn in the screen's own ink, so it follows the screen tint. */
    colours() {
        const cs = getComputedStyle(this.box);
        this.ink = cs.getPropertyValue('--ink').trim() || '#a8f8d3';
        this.dim = cs.getPropertyValue('--ink-dim').trim() || 'rgba(168,248,211,.58)';
        this.faint = cs.getPropertyValue('--ink-faint').trim() || 'rgba(168,248,211,.16)';
        this.paper = paperOn(this.view.app);
    }

    say(text, ms = 3200) {
        const el = this.sayEl;
        el.textContent = text;
        // over the pond, unless that is where it is hanging about
        el.classList.toggle('top', this.p.y > this.h * 0.55);
        el.classList.remove('on');
        void el.offsetWidth;
        el.classList.add('on');
        clearTimeout(this.sayT);
        this.sayT = setTimeout(() => el.classList.remove('on'), ms);
        this.view.app.say(text);
    }

    get busy() {
        return !!this.act && this.act.kind !== 'sleep';
    }

    start(kind, o = {}) {
        this.act = { kind, t: 0, ...o };
        this.idleFor = 0;
    }

    heart(n = 3) {
        for (let i = 0; i < n; i++) this.parts.push({ kind: 'heart', x: this.p.x + (Math.random() - 0.5) * 14, y: this.p.y - 8, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, life: 1.3 + Math.random() * 0.5, age: -i * 0.18 });
    }

    // ----- every frame

    update(dt, m) {
        this.t += dt;
        this.idleFor += dt;
        const p = this.p, a = this.act;
        const hungry = m.met && m.full < 0.15;
        const hour = new Date().getHours();
        const night = hour >= 22 || hour < 6;
        const lo = 12, hi = this.ground - 11;

        if (!m.met) {
            // not met yet: it waits on its lamp (here, the reed), dozing
            this.perch(dt, this.t <= dt);
            this.zzz(dt);
            this.particles(dt);
            return;
        }
        if (a) a.t += dt;
        if (!a) {
            // drifting about, now and then somewhere new; a hungry dragonfly hangs low and slow
            this.wander -= dt;
            if (this.wander <= 0 || Math.hypot(p.tx - p.x, p.ty - p.y) < 1.5) {
                this.wander = 2 + Math.random() * 3;
                p.tx = 18 + Math.random() * (this.w - 36);
                p.ty = hungry ? hi - Math.random() * 6 : lo + Math.random() * (hi - lo);
            }
            this.move(dt, hungry ? 9 : 22);
            if (night && this.idleFor > 25 && !hungry) this.start('sleep');
            this.thought -= dt;
            if (this.thought <= 0) {
                this.thought = 8 + Math.random() * 8;
                if (hungry) {
                    this.parts.push({ kind: 'bang', x: p.x + p.dir * 8, y: p.y - 14, vx: 0, vy: -2, life: 1.6, age: 0 });
                    if (Math.random() < 0.4) this.say(pick(CHATTER.hungry));
                } else if (m.joy > 0.75 && Math.random() < 0.5) this.start('loop', { quiet: true });
            }
        } else if (a.kind === 'sleep') {
            this.perch(dt);
            this.zzz(dt);
        } else if (a.kind === 'eat') {
            const s = a.snack;
            // it drops in from the top and waits; the dragonfly comes for it
            s.y = Math.min(s.to, s.y + dt * 40);
            s.y = s.y >= s.to ? s.to + Math.sin(this.t * 4) * 0.6 : s.y;
            p.tx = s.x - p.dir * 12;
            p.ty = s.to;
            if (a.phase === 'fly') {
                p.dir = s.x >= p.x ? 1 : -1;
                this.move(dt, 34, false);
                if ((Math.hypot(p.tx - p.x, p.ty - p.y) < 1.2 && s.y >= s.to) || a.t > 3.5) {
                    a.phase = 'chomp';
                    a.t = 0;
                    p.x = p.tx;
                    p.y = p.ty;
                }
            } else if (a.phase === 'chomp') {
                const bites = Math.floor(a.t / 0.32);
                if (bites > s.bites && s.bites < 3) {
                    s.bites = bites;
                    sfx.chomp();
                    for (let i = 0; i < 3; i++) this.parts.push({ kind: 'crumb', x: s.x, y: s.y + 2, vx: (Math.random() - 0.5) * 18, vy: -6 - Math.random() * 6, life: 0.6, age: 0, c: a.crumb });
                }
                if (a.t > 1.15) {
                    this.say(a.line);
                    sfx.chirp();
                    this.heart(3);
                    this.start('happy', { dur: 1.3 });
                }
            }
        } else if (a.kind === 'refuse') {
            p.x += Math.sin(a.t * 40) * 0.5;
            if (a.t > 1) this.act = null;
        } else if (a.kind === 'happy') {
            p.y += Math.sin(a.t * 14) * 0.35;
            if (a.t > (a.dur || 1.3)) this.act = null;
        } else if (a.kind === 'loop' || a.kind === 'roll' || a.kind === 'circle') {
            this.trick(dt, a);
        }
        this.blink -= dt;
        if (this.blink < -0.14) this.blink = 2 + Math.random() * 3;
        this.particles(dt);
    }

    move(dt, speed, turn = true) {
        const p = this.p;
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d > 0.01) {
            const k = Math.min(1, (speed * dt) / d);
            p.x += dx * k;
            p.y += dy * k;
        }
        if (turn && Math.abs(dx) > 2) p.dir = dx > 0 ? 1 : -1;
    }

    /** On top of the tall reed at the right, facing left, wings flat (its feet are 3.5 px behind its middle). */
    perch(dt, snap = false) {
        const p = this.p;
        p.tx = this.reed.x + 3.5;
        p.ty = this.reed.top - 6;
        p.dir = -1;
        if (snap) {
            p.x = p.tx;
            p.y = p.ty;
        }
        this.move(dt, 18, false);
    }

    zzz(dt) {
        this.zt = (this.zt || 0) - dt;
        if (this.zt > 0 || Math.hypot(this.p.tx - this.p.x, this.p.ty - this.p.y) > 2) return;
        this.zt = 1.3;
        this.parts.push({ kind: 'z', x: this.p.x - 6, y: this.p.y - 10, vx: -3, vy: -6, life: 2.2, age: 0 });
    }

    trick(dt, a) {
        const p = this.p, T = 1.6;
        a.from ??= { x: p.x, y: clamp(p.y, 20, this.ground - 14) };
        const k = Math.min(1, a.t / T), ang = k * Math.PI * 2;
        if (a.kind === 'loop') {
            // a loop the loop: up and over, the right way round for the way it faces
            p.x = a.from.x + Math.sin(ang) * 10 * p.dir;
            p.y = a.from.y - (1 - Math.cos(ang)) * 9;
        } else if (a.kind === 'roll') {
            p.x = a.from.x + Math.sin(ang) * 4;
            p.y = a.from.y - Math.sin(ang * 0.5) * 6;
            if (Math.floor(a.t / 0.11) % 2 !== (a.flips || 0) % 2) {
                a.flips = (a.flips || 0) + 1;
                p.dir *= -1;
            }
        } else {
            // round the middle of the pond and back
            const cx = this.w / 2, rx = Math.min(this.w * 0.32, 44);
            const start = Math.atan2(0, a.from.x - cx) || 0;
            const nx = cx + Math.cos(start + ang) * rx;
            p.dir = Math.sin(start + ang) > 0 ? -1 : 1;
            p.x = nx;
            p.y = a.from.y + Math.sin(start + ang) * 5;
        }
        if (k >= 1) {
            this.heart(a.quiet ? 1 : 3);
            this.start('happy', { dur: 0.8 });
        }
    }

    particles(dt) {
        for (const q of this.parts) {
            q.age += dt;
            if (q.age < 0) continue;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            if (q.kind === 'crumb') q.vy += 60 * dt;
        }
        this.parts = this.parts.filter((q) => q.age < q.life);
    }

    // ----- painting

    face(m) {
        const a = this.act;
        if (!m.met || a?.kind === 'sleep') return 'sleep';
        if (a?.kind === 'eat' && a.phase === 'chomp') return Math.floor(a.t / 0.16) % 2 ? 'eat' : 'open';
        if (a?.kind === 'happy' || (a && ['loop', 'roll', 'circle'].includes(a.kind))) return 'happy';
        if (a?.kind === 'refuse' || m.full < 0.15) return 'sad';
        if (this.blink < 0) return 'sleep';
        return 'open';
    }

    draw(m) {
        const c = this.cx, w = this.w, h = this.h, g = this.ground;
        if (!w) return;
        c.clearRect(0, 0, w, h);
        c.imageSmoothingEnabled = false;
        const px = (x, y, ww = 1, hh = 1) => c.fillRect(Math.round(x), Math.round(y), ww, hh);

        // the sky: the sun by day, the moon and three stars by night
        const hour = new Date().getHours();
        c.fillStyle = this.dim;
        if (hour >= 6 && hour < 19) {
            const sx = 9, sy = 8;
            c.beginPath();
            for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) px(sx + x, sy + y);
            const ray = Math.floor(this.t * 2) % 2;
            for (const [x, y] of ray ? [[0, -6], [0, 6], [-6, 0], [6, 0]] : [[-4, -5], [4, -5], [-4, 5], [4, 5]]) px(sx + x, sy + y);
        } else {
            const sx = 9, sy = 8;
            for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10 && (x - 2) * (x - 2) + (y + 1) * (y + 1) > 6) px(sx + x, sy + y);
            for (const [x, y, k] of [[22, 5, 0], [33, 11, 1], [48, 4, 2]]) if ((Math.floor(this.t * 1.5) + k) % 3) px(x, y);
        }

        // the pond: its edge, ripples sliding along, a lily pad
        c.fillStyle = this.faint;
        c.fillRect(0, g, w, h - g);
        c.fillStyle = this.dim;
        px(0, g, w, 1);
        const off = Math.floor(this.t * 6) % 12;
        for (let x = -12 + off; x < w; x += 12) {
            px(x, g + 3, 4, 1);
            px(x + 6, g + 5, 3, 1);
        }
        const lx = Math.round(w * 0.62);
        c.fillStyle = this.ink;
        px(lx - 4, g + 1, 9, 1);
        px(lx - 3, g + 2, 7, 1);
        px(lx + 3, g + 1, 1, 1);
        // reeds and a cattail on the tall one
        c.fillStyle = this.dim;
        for (const [x, top] of [[5, g - 10], [8, g - 15], [w - 17, g - 12], [this.reed.x, this.reed.top]]) {
            px(x, top, 1, g - top);
        }
        c.fillStyle = this.ink;
        px(this.reed.x - 1, this.reed.top + 2, 3, 5);
        px(7, g - 17, 3, 4);

        // the snack, if one is on its way
        const a = this.act;
        if (a?.kind === 'eat') {
            const s = a.snack, ic = icon(s.id, { paper: this.paper });
            const left = 3 - Math.min(3, s.bites);
            if (left > 0) {
                const cw = Math.ceil((ic.width * left) / 3);
                // bites come out of the side facing the dragonfly
                const sx0 = this.p.dir > 0 ? ic.width - cw : 0;
                c.drawImage(ic, sx0, 0, cw, ic.height, Math.round(s.x - ic.width / 2) + sx0, Math.round(s.y - ic.height / 2), cw, ic.height);
            }
        }

        // the dragonfly, flapping (wings flat while it sleeps), bobbing as it hovers
        const p = this.p, look = lookOf(m);
        const sleeping = !m.met || a?.kind === 'sleep';
        const settled = sleeping && Math.hypot(p.tx - p.x, p.ty - p.y) < 2;
        const frame = settled ? 2 : [0, 1, 2, 1][Math.floor(this.t * 16) % 4];
        const bob = settled ? 0 : Math.sin(this.t * 4) * 1.2;
        const img = sprite({ look, frame, face: this.face(m), paper: this.paper });
        const dx = Math.round(p.x - W / 2), dy = Math.round(p.y + bob - H / 2);
        if (p.dir < 0) {
            c.save();
            c.scale(-1, 1);
            c.drawImage(img, -dx - W, dy);
            c.restore();
        } else c.drawImage(img, dx, dy);

        // hearts, Zs, the hungry "!", crumbs
        for (const q of this.parts) {
            if (q.age < 0) continue;
            const fade = q.age > q.life - 0.35 && Math.floor(q.age * 12) % 2;
            if (fade) continue;
            if (q.kind === 'crumb') {
                c.fillStyle = q.c || this.ink;
                px(q.x, q.y);
                continue;
            }
            const ic = icon(q.kind, { paper: this.paper, ink: q.kind === 'heart' ? (this.paper ? '#1f2c17' : null) : this.ink });
            c.drawImage(ic, Math.round(q.x - ic.width / 2), Math.round(q.y - ic.height / 2));
        }
    }
}

// ---------------------------------------------------------------- the Dragonfly screen

export class PetView extends ListView {
    /** ctx: { genreGroups, byId } from the console. */
    constructor(app, ctx) {
        super(app, { title: 'Dragonfly', preview: 'pet', cls: 'v-pet' });
        this.ctx = ctx;
        this.getItems = () => this.menu();
        this.playFallback = () => this.pet();
        this.queue = [];
    }

    get mem() {
        return currentMem() || { met: false };
    }

    statusTitle() {
        const m = this.mem;
        return m.met ? nameOf(m) : 'Dragonfly';
    }

    menu() {
        const m = this.mem;
        if (!m.met) {
            return [
                { label: 'Meet it on the island', icon: ICONS.garden, href: '../index.html', say: 'Meet it on the island: walk the Garden' },
                { label: 'How to meet it', icon: ICONS.about, action: () => this.app.push(meetHelp(this.app)) },
            ];
        }
        const f = found(m, this.ctx);
        return [
            { label: 'Feed', icon: ICONS.feed, meta: m.full < 0.15 ? '!' : '', action: () => this.app.push(feedView(this.app, this)) },
            { label: 'Play', icon: ICONS.play2, action: () => this.app.push(playView(this.app, this)) },
            { label: 'Pet', icon: ICONS.heart, chev: false, action: () => this.pet() },
            { label: 'Places', icon: ICONS.pin, meta: `${f.n}/${f.of}`, say: `Places, ${f.n} of ${f.of} found`, action: () => this.app.push(placesView(this.app, this.ctx)) },
            { label: 'Memories', icon: ICONS.book, action: () => this.app.push(memoriesView(this.app, this.ctx)) },
        ];
    }

    build() {
        super.build();
        this.el.classList.add('v-pet');
        this.pvEl.removeAttribute('aria-hidden');
        this.pvEl.innerHTML = `
            <div class="pet-stage"><canvas class="pet-cv" aria-hidden="true"></canvas><p class="pet-say"></p></div>
            <div class="pet-card">
                <p class="pet-name"><b class="pet-n"></b><span class="pet-mood"></span></p>
                <div class="pet-meters">
                    <div class="pet-meter"><span>Full</span><i><b class="pet-full"></b></i></div>
                    <div class="pet-meter"><span>Happy</span><i><b class="pet-joy"></b></i></div>
                </div>
            </div>`;
        this.stage = new Stage(this, this.pvEl.querySelector('.pet-stage'));
        this.pvEl.querySelector('.pet-cv').addEventListener('click', () => {
            this.app.feedback('press');
            this.pet();
        });
        this.ro = new ResizeObserver(() => this.stage.size() && this.stage.draw(this.mem));
        this.ro.observe(this.stage.box);
        this.onStorage = (e) => {
            if (e.key === MEM_KEY || e.key === null) this.memChanged();
        };
        addEventListener('storage', this.onStorage);
        this.card();
        const m = this.mem;
        if (m.met) {
            const greet = m.full < 0.15 ? pick(CHATTER.hungry) : m.joy < 0.32 ? pick(CHATTER.bored) : `Hello! It’s me, ${nameOf(m)}. ${pick(['Bzzz!', 'I was hoping you’d come by.', 'Shall we go somewhere?', 'What shall we do?'])}`;
            setTimeout(() => this.stage.say(greet, 3800), 350);
        } else setTimeout(() => this.stage.say('…zzz…', 2600), 350);
    }

    /** Name, mood and the two meters. */
    card() {
        const m = this.mem;
        const el = this.pvEl;
        el.querySelector('.pet-n').textContent = m.met ? nameOf(m) : 'A dragonfly';
        if (m.met) {
            const mood = moodOf(m.full, m.joy);
            el.querySelector('.pet-mood').textContent = `${mood.face} ${mood.word}`;
        } else el.querySelector('.pet-mood').textContent = 'Waiting on the dock';
        el.querySelector('.pet-full').style.width = `${Math.round((m.met ? m.full : 0) * 100)}%`;
        el.querySelector('.pet-joy').style.width = `${Math.round((m.met ? m.joy : 0) * 100)}%`;
        el.querySelector('.pet-meters').hidden = !m.met;
        el.classList.toggle('hungry', !!m.met && m.full < 0.15);
        this.app.updateStatus();
    }

    memChanged() {
        this.card();
        this.refresh();
    }

    // ----- what you can do with it

    feed(id) {
        const s = SNACKS.find((x) => x.id === id);
        if (!s) return;
        if (this.app.top !== this) return this.queue.push(() => this.feed(id));
        const st = this.stage;
        if (st.busy) return this.app.deny();
        if (this.mem.full > 0.95) {
            st.start('refuse');
            st.say('I couldn’t eat another bite! Maybe later.');
            sfx.sad();
            return;
        }
        update((m) => {
            m.full = Math.min(1, m.full + s.full);
            m.joy = Math.min(1, m.joy + s.joy);
            m.fed[id] = (m.fed[id] || 0) + 1;
        });
        const x = clamp(st.p.x + st.p.dir * 26, 14, st.w - 14);
        const crumb = { midge: '#2a2a2a', dew: '#5ab8ff', pollen: '#ffe14a', honey: '#e89a1a', moonberry: '#8b5bd6' }[id];
        st.start('eat', { phase: 'fly', snack: { id, x, y: -6, to: clamp(st.p.y, 14, st.ground - 11), bites: 0 }, line: `${s.icon} ${pick(s.lines)}`, crumb });
        this.card();
        this.refresh();
    }

    pet() {
        const m = this.mem;
        const st = this.stage;
        if (!m.met) {
            st.say('…zzz… (it’s waiting for you on the dock)', 3000);
            return;
        }
        if (st.act?.kind === 'sleep') {
            st.act = null;
            st.idleFor = 0;
            st.say('*yawn* Oh! Hello!');
            sfx.chirp();
            return;
        }
        if (st.busy) return;
        update((mm) => {
            mm.petted = (mm.petted || 0) + 1;
            mm.joy = Math.min(1, mm.joy + 0.02);
        });
        st.heart(3);
        st.start('happy', { dur: 1.3 });
        st.say(pick(CHATTER.pet), 2400);
        sfx.chirp();
        this.app.buzz([8, 40, 8]);
        this.card();
    }

    play(id) {
        const p = PLAYS.find((x) => x.id === id);
        if (!p) return;
        if (this.app.top !== this) return this.queue.push(() => this.play(id));
        const st = this.stage;
        if (st.busy) return this.app.deny();
        if (st.act?.kind === 'sleep') st.act = null;
        update((m) => {
            m.plays = (m.plays || 0) + 1;
            m.joy = Math.min(1, m.joy + p.joy);
        });
        st.start(id);
        st.say(p.line, 2400);
        sfx.whoosh();
        this.card();
    }

    // ----- lifecycle

    shown() {
        super.shown();
        this.stage.colours();
        this.stage.size();
        this.card();
        const run = this.queue.shift();
        this.queue = [];
        if (run) setTimeout(run, 120);
        cancelAnimationFrame(this.raf);
        let last = performance.now();
        const loop = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const m = this.mem;
            this.stage.update(reduceMotion.matches ? dt * 0.6 : dt, m);
            this.stage.draw(m);
            // the meters fade slowly: freshen the card now and then
            this.cardT = (this.cardT || 0) + dt;
            if (this.cardT > 20) {
                this.cardT = 0;
                this.card();
            }
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    }

    hidden() {
        super.hidden();
        cancelAnimationFrame(this.raf);
    }

    destroy() {
        super.destroy();
        this.ro?.disconnect();
        removeEventListener('storage', this.onStorage);
    }

    onHold() {
        this.pet();
    }
}

// ---------------------------------------------------------------- the menus under it

function feedView(app, pet) {
    return new ListView(app, {
        title: 'Feed',
        getItems: () => {
            const m = currentMem() || {};
            return SNACKS.map((s) => ({
                label: s.name,
                icon: `<img class="px-ico" src="${icon(s.id, { paper: paperOn(app) }).toDataURL()}" alt="">`,
                meta: m.fed?.[s.id] ? `×${m.fed[s.id]}` : '',
                chev: false,
                say: `${s.name}${m.fed?.[s.id] ? `, given ${m.fed[s.id]} times` : ''}`,
                action: () => {
                    pet.feed(s.id);
                    app.back();
                },
            }));
        },
    });
}

function playView(app, pet) {
    return new ListView(app, {
        title: 'Play',
        items: PLAYS.filter((p) => p.id !== 'catch').map((p) => ({
            label: p.name,
            icon: `<span class="emo">${p.icon}</span>`,
            chev: false,
            action: () => {
                pet.play(p.id);
                app.back();
            },
        })),
    });
}

function placeItems(app, list, m) {
    const now = Date.now();
    return list.map((p) => {
        const when = m.places[p.id];
        if (when) {
            return {
                label: p.name,
                icon: `<span class="emo">${p.icon}</span>`,
                subHTML: esc(`Found ${ago(when, now)}`),
                say: `${p.name}, found ${ago(when, now)}. Select to fly there`,
                action: () => flyTo(app, `place:${p.id}`, p.name),
            };
        }
        return {
            label: '? ? ?',
            icon: `<span class="emo lock">\u{1F512}</span>`,
            subHTML: esc(p.hint ? 'Not found yet · select for a hint' : 'Not found yet'),
            say: 'A place not found yet. Select for a hint',
            action: () => app.push(hintView(app, m, p.hint || 'Keep exploring the island, and I’ll show you when we find it.')),
        };
    });
}

function placesView(app, ctx) {
    const m = currentMem();
    const island = PLACES.filter((p) => p.area === 'island');
    const hidden = PLACES.filter((p) => p.area === 'hidden');
    const n = (list) => list.filter((p) => m.places[p.id]).length;
    const paths = ctx.genreGroups;
    const pathsFound = paths.filter((x) => m.places['path:' + x.genre.id]).length;
    const statues = Object.entries(m.games).filter(([id]) => ctx.byId.has(id)).sort((a, b) => b[1] - a[1]);
    const f = found(m, ctx);
    const sub = (title, items) => () => app.push(new ListView(app, { title, getItems: items, head: `<p class="pet-lead">${esc(`Pick somewhere and ${nameOf(m)} will fly you there.`)}</p>` }));
    return new ListView(app, {
        title: 'Places',
        head: `<p class="pet-lead">${esc(`We’ve found ${f.n} of ${f.of} places together.`)}</p>`,
        items: [
            { label: 'Around the island', icon: `<span class="emo">\u{1F3DD}️</span>`, meta: `${n(island)}/${island.length}`, action: sub('Around the island', () => placeItems(app, island, currentMem())) },
            { label: 'Hidden places', icon: `<span class="emo">\u{1F5DD}️</span>`, meta: `${n(hidden)}/${hidden.length}`, action: sub('Hidden places', () => placeItems(app, hidden, currentMem())) },
            {
                label: 'Paths',
                icon: `<span class="emo">\u{1F9ED}</span>`,
                meta: `${pathsFound}/${paths.length}`,
                action: sub('Paths', () => {
                    const mm = currentMem(), now = Date.now();
                    return paths.map(({ genre, games }) => {
                        const when = mm.places['path:' + genre.id];
                        return when
                            ? { label: genre.name, icon: `<span class="emo">${genre.emoji}</span>`, accent: genre.accent, subHTML: esc(`${genre.short} · ${games.length} games · found ${ago(when, now)}`), action: () => flyTo(app, `path:${genre.id}`, genre.name) }
                            : { label: '? ? ?', icon: `<span class="emo lock">\u{1F512}</span>`, subHTML: 'Not walked yet · select for a hint', action: () => app.push(hintView(app, mm, 'Walk up to the Hub: every path in the garden starts there, one for each kind of game.')) };
                    });
                }),
            },
            {
                label: 'Statues we stood at',
                icon: `<span class="emo">\u{1F5FF}</span>`,
                meta: statues.length,
                action: sub('Statues', () => {
                    const mm = currentMem();
                    const list = Object.entries(mm.games).filter(([id]) => ctx.byId.has(id)).sort((a, b) => b[1] - a[1]);
                    return list.map(([id, k]) => {
                        const g = ctx.byId.get(id);
                        return { label: g.title, icon: gameIconHTML(g), meta: `×${k}`, say: `${g.title}, visited ${k} times. Select to fly to its statue`, action: () => flyTo(app, `game:${g.id}`, g.title) };
                    });
                }),
            },
        ],
    });
}

function hintView(app, m, hint) {
    const look = lookOf(m);
    return new TextView(app, {
        title: 'Hint',
        html: `<div class="pet-hint"><img class="px-df" src="${spriteURL({ look, frame: 1, face: m?.met ? 'happy' : 'sleep', paper: paperOn(app) })}" alt=""><blockquote>“${esc(hint)}”</blockquote><p class="pet-hint-by">${esc(nameOf(m))}</p></div>`,
    });
}

function meetHelp(app) {
    return new TextView(app, {
        title: 'Meet it',
        html: `
            <div class="pet-hint"><img class="px-df" src="${spriteURL({ look: lookOf(null), frame: 2, face: 'sleep', paper: paperOn(app) })}" alt=""></div>
            <h3>A dragonfly on the dock</h3>
            <p>A dragonfly waits on the lamp at the end of the dock in the Garden of Games. Walk down the dock and it flies over to say hello and asks you for a name.</p>
            <h3>After that</h3>
            <p>It goes everywhere you go on the island, and lives in your Pocket Garden too: feed it, pet it and play with it here, see the places you have found together, and pick one for it to fly you there.</p>`,
    });
}

function memoriesView(app, ctx) {
    const m = currentMem();
    const now = Date.now();
    const look = lookOf(m);
    const mood = moodOf(m.full, m.joy);
    const mins = Math.round((m.together || 0) / 60);
    const fav = Object.entries(m.fed).sort((a, b) => b[1] - a[1])[0];
    const favSnack = fav ? SNACKS.find((s) => s.id === fav[0]) : null;
    const f = found(m, ctx);
    const top = Object.entries(m.games).filter(([id]) => ctx.byId.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const accName = ACCESSORIES.find((a) => a.id === look.acc)?.name;
    const stat = (label, meta, ico, say) => ({ label, meta: String(meta), icon: `<span class="emo">${ico}</span>`, chev: false, say: say || `${label}, ${meta}` });
    const items = [
        stat('Mood', `${mood.face} ${mood.word}`, '\u{1F49A}', `Mood, ${mood.word}`),
        stat('Visits', m.visits || 0, '\u{1F6B6}'),
        stat('Time together', mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h`, '⏳'),
        stat('Places found', `${f.n}/${f.of}`, '\u{1F5FA}️'),
        stat('Games visited', Object.keys(m.games).length, '\u{1F5FF}'),
        stat('Snacks shared', Object.values(m.fed).reduce((a, b) => a + b, 0), '\u{1F36F}'),
        favSnack ? stat('Favourite snack', `${favSnack.icon} ×${fav[1]}`, '⭐', `Favourite snack, ${favSnack.name}, ${fav[1]} given`) : null,
        stat('Games played', m.plays || 0, '➰'),
        m.catchBest ? stat('Best at Catch me!', m.catchBest, '\u{1F3AF}') : null,
        stat('Pets', m.petted || 0, '\u{1F44B}'),
        stat('Looks', [BODIES.find((b) => b.id === look.body.id)?.name, WINGS.find((w) => w.id === look.wings.id)?.name, look.acc !== 'none' ? accName : null].filter(Boolean).join(' · '), '\u{1F3A8}'),
        ...top.map(([id, k], i) => {
            const g = ctx.byId.get(id);
            return { label: g.title, icon: gameIconHTML(g), meta: `×${k}`, subHTML: i === 0 ? 'The game we visit most' : '', say: `${g.title}, visited ${k} times. Select to fly to its statue`, action: () => flyTo(app, `game:${g.id}`, g.title) };
        }),
    ].filter(Boolean);
    return new ListView(app, {
        title: 'Memories',
        head: `<p class="pet-lead">${esc(`We met ${ago(m.metAt || now, now)}. I remember everything. Well, nearly everything.`)}</p>`,
        items,
    });
}

/** The dragonfly for the home menu's picture: still, in its own colours. */
export function petGlyph(app) {
    const m = currentMem();
    const look = lookOf(m);
    return `<img class="ico px-df" src="${spriteURL({ look, frame: 0, face: m?.met ? 'open' : 'sleep', paper: paperOn(app) })}" alt="">`;
}

/** The home menu's caption: its name and mood, or where it waits. */
export function petCaption() {
    const m = currentMem();
    if (!m?.met) return 'Waiting on the dock';
    const mood = moodOf(m.full, m.joy);
    return `${nameOf(m)} · ${mood.word}`;
}
