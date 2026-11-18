// The dragonfly companion. It waits on the lamp at the end of the dock; the
// first time you come by it flies over, introduces itself and asks for a
// name, and from then on it goes everywhere you go: the island, every room
// and secret place, rides and all. It flies ahead to show you new things as
// you find them, drops hints, brings news of the games, flies you back to
// anywhere you have been together, eats snacks, plays, can be dressed up, and
// remembers your visits.
//
// dragonfly.js flies it, dragonfly-ui.js draws its corner of the screen, and
// dragonfly-talk.js holds its words. This file is its memory and its mind.
// main.js calls update() every frame with where you are, and gives it hooks
// to travel and to walk to games.
//
// ?dragonfly=0 leaves it out altogether.

import * as THREE from 'three';
import { Dragonfly } from './dragonfly.js';
import { DragonflyUI } from './dragonfly-ui.js';
import * as T from './dragonfly-talk.js';
import { store } from './util.js';
import { GENRES, genreOf } from './genres.js';
import { iconHTML } from './game-icons.js';
import { samplePath, projectOnPath } from './layout.js';

const KEY = 'companion';
const NEW_VISIT = 20 * 60e3;     // a page load after this long away counts as a new visit
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function freshMemory() {
    return {
        v: 1, met: false, name: '', look: { body: 'emerald', wings: 'glass', acc: 'none' },
        visits: 0, firstVisit: 0, prevSeen: 0, lastSeen: 0, metAt: 0, together: 0,
        full: 0.6, joy: 0.6, moodAt: 0,
        fed: {}, plays: 0, catchBest: 0, petted: 0,
        places: {}, games: {}, chat: 'chatty', hintIdx: 0, newsIdx: 0, secretIdx: 0,
    };
}

export class Companion {
    /**
     * @param {object} o  scene (the garden's), world, games, ui (the garden's UI), audio, canvas, camera,
     *                    hooks: { travel(dest) -> bool, walkTo(dest) -> bool, walkToGame(game), openGame(game), showCard(game), isStarred(game) }
     */
    constructor(o) {
        this.world = o.world;
        this.games = o.games;
        this.gui = o.ui;
        this.audio = o.audio;
        this.camera = o.camera;
        this.canvas = o.canvas;
        this.hooks = o.hooks;
        this.gardenScene = o.scene;
        this.rand = o.rand || Math.random;
        this.byId = new Map(this.games.map((g) => [g.id, g]));
        this.updates = null;
        this.news = T.buildNews(this.games, null, Date.now());

        const now = Date.now();
        const mem = Object.assign(freshMemory(), store.get(KEY, {}) || {});
        mem.look = Object.assign(freshMemory().look, mem.look);
        for (const k of ['fed', 'places', 'games']) if (typeof mem[k] !== 'object' || !mem[k]) mem[k] = {};
        if (!mem.lastSeen || now - mem.lastSeen > NEW_VISIT) {
            mem.prevSeen = mem.lastSeen;
            mem.visits++;
        }
        mem.lastSeen = now;
        mem.firstVisit ||= now;
        // hungrier and a little lonelier for the time you were away
        if (mem.moodAt) Object.assign(mem, T.decay(mem.full, mem.joy, Math.max(0, now - mem.moodAt) / 36e5));
        mem.moodAt = now;
        this.mem = mem;
        this.save();

        this.df = new Dragonfly();
        this.view = new DragonflyUI(this);
        this.log = [];
        this._applyLook();
        this.view.setName(this.name);

        this.perch = this._perchSpot();
        this.df.snapTo(this.perch);
        this.df.perched = true;
        this.df.heading.setFromAxisAngle(UP, Math.PI);   // looking up the dock, toward the island
        this.df.group.quaternion.copy(this.df.heading);
        this.gardenScene.add(this.df.group);
        this.queue = [];             // finds waiting to be told
        this.saidAt = -1e9;

        this.mode = 'perch';
        this.active = false;
        this.activeFor = 0;
        this.meetArmed = true;
        this.greeted = false;
        this.surveyTimer = 0;
        this.saveTimer = 0;
        this.moodTimer = 0;
        this.lastAuto = -1e9;        // when it last spoke on its own
        this.chatter = 120 + this.rand() * 60;
        this.lastScout = -1e9;
        this.lastStatue = -1;
        this.here = null;
        this.said = new Set();       // remarks made once a visit (nightfall, the weather...)
        this.clock = 0;
        this.aim = new THREE.Vector3();
        this.info = null;
        this.waitHint = false;

        fetch('js/updates.json')
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!j?.games) return;
                this.updates = j.games;
                this.news = T.buildNews(this.games, j.games, Date.now(), this.mem.prevSeen);
            })
            .catch(() => {});

        // click (or tap) the dragonfly itself: before the garden's own controls see it
        addEventListener('pointerdown', (e) => {
            if (e.target !== this.canvas || e.button > 0 || !this.active) return;
            if (!this.hit(e.clientX, e.clientY)) return;
            e.stopImmediatePropagation();
            e.preventDefault();
            this.tapped();
        }, { capture: true });
        addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            document.body.classList.toggle('df-hover', e.target === this.canvas && this.active && !!this.hit(e.clientX, e.clientY));
        });
        addEventListener('pagehide', () => this.save());
        // the Pocket Garden handheld (console/) feeds it, pets it and plays with it too: when it does so in
        // another tab, take its word for how full and happy it is now
        addEventListener('storage', (e) => {
            if (e.key !== 'garden.' + KEY || !e.newValue) return;
            let v;
            try {
                v = JSON.parse(e.newValue);
            } catch {
                return;
            }
            if (!v || typeof v !== 'object' || !this.mem.met) return;
            const m = this.mem;
            for (const k of ['full', 'joy']) if (Number.isFinite(v[k])) m[k] = Math.max(0, Math.min(1, v[k]));
            for (const k of ['plays', 'petted']) if (Number.isFinite(v[k])) m[k] = Math.max(m[k] || 0, v[k]);
            if (v.fed && typeof v.fed === 'object') for (const [id, n] of Object.entries(v.fed)) if (Number.isFinite(n)) m.fed[id] = Math.max(m.fed[id] || 0, n);
            this._mood();
            this.view.render();
        });
    }

    // ------------------------------------------------------------ memory

    get met() {
        return this.mem.met;
    }

    get name() {
        return this.mem.name || 'Dragonfly';
    }

    get busyPlaying() {
        return this.mode === 'catch' || !!this.df.trick;
    }

    save() {
        this.mem.moodAt = Date.now();
        store.set(KEY, this.mem);
    }

    gameById(id) {
        return this.byId.get(id) || null;
    }

    placeLabel(id) {
        if (id.startsWith('path:')) return GENRES.find((g) => g.id === id.slice(5))?.name || id;
        return T.PLACE_BY_ID[id]?.name || id;
    }

    placesFound() {
        return { n: Object.keys(this.mem.places).length, of: T.PLACES.length + this.world.layout.spokes.length };
    }

    _looks() {
        const L = this.mem.look;
        return {
            body: T.BODIES.find((b) => b.id === L.body) || T.BODIES[0],
            wings: T.WINGS.find((w) => w.id === L.wings) || T.WINGS[0],
            acc: T.ACCESSORIES.find((a) => a.id === L.acc && (!a.unlock || a.unlock(this.mem))) || T.ACCESSORIES[0],
        };
    }

    _applyLook() {
        const { body, wings, acc } = this._looks();
        this.df.setLook(body, wings, acc);
        this.view.setLook(body, wings, acc);
        this._mood();
    }

    _mood() {
        const m = this.mem;
        this.view.setMood(T.moodOf(m.full, m.joy), m.full, m.joy);
    }

    /** On top of the lamp at the end of the dock. */
    _perchSpot() {
        const d = this.world.layout.dock;
        const want = { x: 1.9, z: d.end - 0.6 };
        let best = null, bd = Infinity;
        for (const l of this.world.lampSpots) {
            const dd = Math.hypot(l.x - want.x, l.z - want.z);
            if (dd < bd) bd = dd, best = l;
        }
        if (best?.light && bd < 1 && best.light.y > d.y + 1) return new THREE.Vector3(best.x, best.light.y + 0.4, best.z);
        return new THREE.Vector3(want.x, d.y + 3.45, want.z);
    }

    // ------------------------------------------------------------ talking

    /** Say something in the bubble and keep it in the Talk log. */
    say(text, actions = [], { log = true, ms, chirp = 'talk' } = {}) {
        this.view.say(text, actions, ms);
        this.saidAt = this.clock;
        if (log) {
            this.log.push({ text, actions });
            if (this.log.length > 40) this.log.shift();
            if (this.view.panelOpen && this.view.tab === 'talk') this.view.render();
        }
        this.chirp(chirp);
    }

    /** It speaks up on its own: only when it isn't busy, and not too often. */
    _auto(text, actions, level = 'chatty') {
        const chat = this.mem.chat;
        if (chat === 'hush') return false;
        if (chat === 'quiet' && level === 'chatty') return false;
        if (this.view.meeting || this.mode === 'catch' || (this.view.talking && level !== 'found')) return false;
        if (level !== 'found' && this.clock - this.lastAuto < 25) return false;
        // something new found while it is still saying something else: it waits its turn
        if (level === 'found' && this.view.talking && this.clock - this.saidAt < 6) {
            if (this.queue.length < 3) this.queue.push([text, actions]);
            return true;
        }
        this.lastAuto = this.clock;
        this.say(text, actions);
        return true;
    }

    /** The Talk tab's questions. */
    talk(kind) {
        const q = { hint: 'Any hints?', news: 'What’s new?', game: 'Pick me a game!', here: 'Where are we?', secret: 'Tell me a secret.' }[kind];
        if (q) this.log.push({ me: true, text: q });
        const [text, actions] = this._answer(kind);
        this.say(text, actions);
        this.view.render();
    }

    _answer(kind) {
        const m = this.mem;
        if (kind === 'hint') {
            const open = T.PLACES.filter((p) => p.hint && !m.places[p.id]);
            if (!open.length) return [`You’ve found every place I know! Here’s a secret instead: ${this._secret()}`, []];
            const p = open[m.hintIdx++ % open.length];
            this.save();
            const acts = [];
            if (p.area === 'island' && this.info?.place === 'garden' && !this.info?.room) acts.push({ label: 'Lead the way', primary: true, fn: () => this._lead(p) });
            return [p.hint, acts];
        }
        if (kind === 'news') {
            const n = this.news[m.newsIdx++ % this.news.length];
            this.save();
            return [n.text, n.game ? this._gameActs(n.game) : []];
        }
        if (kind === 'game') {
            const starred = this.games.filter((g) => this.hooks.isStarred?.(g));
            let g, text;
            if (starred.length && this.rand() < 0.35) {
                g = pick(starred, this.rand);
                text = `You starred ${g.title}. Shall we go and see it again? ${g.description.split(/(?<=[.!?])\s+/)[0]}`;
            } else {
                const fresh = this.games.filter((x) => !m.games[x.id]);
                g = pick(fresh.length ? fresh : this.games, this.rand);
                const genre = genreOf(g);
                text = `${genre.emoji} How about ${g.title}? ${g.description.split(/(?<=[.!?])\s+/)[0]} It’s on ${genre.name}.`;
            }
            return [text, this._gameActs(g)];
        }
        if (kind === 'here') return [this._whereText(), []];
        return [this._secret(), []];
    }

    _secret() {
        const s = T.SECRETS[this.mem.secretIdx++ % T.SECRETS.length];
        this.save();
        return s;
    }

    _whereText() {
        const i = this.info;
        if (!i) return 'Somewhere lovely.';
        const room = i.room || (i.place !== 'garden' ? i.place : null);
        if (room) {
            const p = T.placeForRoom(room);
            return p ? `${p.name}. ${p.about}` : 'Somewhere strange. I’m not sure I’ve been here before!';
        }
        const sp = this._spokeAt(i.zone);
        if (sp) {
            const g = sp.genre;
            return `${g.emoji} ${g.name}, the path for ${g.short.toLowerCase()}. ${sp.games.length} game${sp.games.length === 1 ? '' : 's'} along it, newest nearest the Hub, and a pavilion at the end.`;
        }
        const p = T.placeForZone(i.zone);
        if (p) return `${p.name}. ${p.about}`;
        // out in the wilds: the nearest landmark
        let best = null, bd = Infinity;
        for (const lm of this.world.landmarks) {
            const d = Math.hypot(lm.x - i.pos.x, lm.z - i.pos.z);
            if (d < bd) bd = d, best = lm;
        }
        return best ? `Out in the wilds between the paths. The nearest landmark is ${best.name}, about ${Math.round(bd)} paces away.` : 'Out in the wilds.';
    }

    _gameActs(g) {
        const acts = [{ label: 'Show me', primary: true, fn: () => this.hooks.walkToGame(g) }];
        acts.push({ label: 'Play', fn: () => this.hooks.openGame(g) });
        return acts;
    }

    _lead(p) {
        if (this.hooks.walkTo({ place: p })) this.say('This way! Follow the path and I’ll keep up.', [], { log: false });
    }

    // ------------------------------------------------------------ care and play

    feed(id) {
        const s = T.SNACKS.find((x) => x.id === id);
        if (!s) return;
        const m = this.mem;
        if (m.full > 0.95) {
            this.say('I couldn’t eat another bite! Maybe later.', [], { chirp: 'sad' });
        } else {
            m.full = Math.min(1, m.full + s.full);
            m.joy = Math.min(1, m.joy + s.joy);
            m.fed[id] = (m.fed[id] || 0) + 1;
            this.df.wiggle = 0.9;
            this.say(`${s.icon} ${pick(s.lines, this.rand)}`, [], { chirp: 'happy' });
        }
        this._mood();
        this.save();
        this.view.render();
    }

    play(id) {
        const p = T.PLAYS.find((x) => x.id === id);
        if (this.mode === 'scout') {
            // it drops whatever it was showing you to come and play
            this.mode = 'follow';
            this.scout = null;
        }
        if (!p || this.busyPlaying || this.mode !== 'follow') return;
        this.mem.plays++;
        this.mem.joy = Math.min(1, this.mem.joy + p.joy);
        if (id === 'catch') this._startCatch();
        else {
            this.df.startTrick(id);
            this.say(p.line, [], { chirp: 'happy' });
        }
        this._mood();
        this.save();
        this.view.render();
    }

    restyle(body, wings, acc) {
        const L = this.mem.look;
        if (body) L.body = body;
        if (wings) L.wings = wings;
        if (acc) {
            const a = T.ACCESSORIES.find((x) => x.id === acc);
            if (a && (!a.unlock || a.unlock(this.mem))) L.acc = acc;
        }
        this._applyLook();
        this.df.wiggle = 0.6;
        this.chirp('happy');
        this.save();
        this.view.render();
    }

    rename(name) {
        const n = T.cleanName(name);
        if (!n || n === this.mem.name) return;
        this.mem.name = n;
        this.view.setName(n);
        this.save();
        this.say(`${n}! I like that even better.`, [], { chirp: 'happy' });
        this.view.render();
    }

    setChat(v) {
        if (!['chatty', 'quiet', 'hush'].includes(v)) return;
        this.mem.chat = v;
        this.save();
        this.view.render();
        this.say(v === 'chatty' ? 'Hooray, I love a natter.' : v === 'quiet' ? 'I’ll only pipe up when we find something.' : 'I’ll keep quiet until you ask me something.', [], { log: false });
    }

    onPanel(open) {
        if (open) this.chirp('talk');
    }

    _startCatch() {
        this.mode = 'catch';
        this.catch = { t: 20, caught: 0, next: 0, off: new THREE.Vector3(0.4, 0, 2.4) };
        this.view.closePanel();
        this.say(T.PLAYS.find((p) => p.id === 'catch').line, [], { ms: 0, chirp: 'happy' });
    }

    _endCatch() {
        const n = this.catch.caught;
        const best = n > this.mem.catchBest;
        if (best) this.mem.catchBest = n;
        this.mem.joy = Math.min(1, this.mem.joy + 0.05 + n * 0.02);
        this.catch = null;
        this.mode = 'follow';
        this.save();
        this._mood();
        this.say(n === 0 ? 'Too quick for you! Want another go?' : `You caught me ${n} time${n === 1 ? '' : 's'}!${best ? ' That’s your best ever!' : ''}`, [{ label: 'Again!', primary: true, fn: () => this.play('catch') }], { chirp: 'happy' });
    }

    /** Clicked or tapped. */
    tapped() {
        if (this.mode === 'catch') {
            this.catch.caught++;
            this.catch.next = 0;
            this.df.wiggle = 0.35;
            this.chirp('happy');
            return;
        }
        if (!this.met) {
            if (this.mode === 'perch' || this.mode === 'return') this._approach();
            return;
        }
        this.mem.petted++;
        this.mem.joy = Math.min(1, this.mem.joy + 0.02);
        this.df.wiggle = 0.7;
        this._mood();
        this.say(pick(T.CHATTER.pet, this.rand), [
            { label: 'Talk', fn: () => this.view.openPanel('talk') },
            { label: 'Travel', fn: () => this.view.openPanel('travel') },
            { label: 'Snack', fn: () => this.view.openPanel('care') },
        ], { log: false, chirp: 'happy' });
    }

    /** Is (x, y) on the dragonfly? */
    hit(x, y) {
        if (!this.info || this.df.group.parent !== this.info.scene || !this.df.group.visible) return false;
        const s = this.df.screen(this.camera, innerWidth, innerHeight);
        return !!s && Math.hypot(s.x - x, s.y - y) < s.r * (this.mode === 'catch' ? 1.4 : 1.15);
    }

    // ------------------------------------------------------------ sound

    chirp(kind = 'talk') {
        const a = this.audio;
        if (!a?.ctx || !a.sfx || a.muted) return;
        const ctx = a.ctx, t0 = ctx.currentTime + 0.01;
        const notes = kind === 'happy' ? [1700, 2300, 3100] : kind === 'sad' ? [1900, 1300] : [2100, 2700];
        notes.forEach((f, i) => {
            const t = t0 + i * 0.075;
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(f * 0.78, t);
            o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
            o.connect(g).connect(a.sfx);
            o.start(t);
            o.stop(t + 0.08);
        });
    }

    // ------------------------------------------------------------ meeting

    _approach() {
        this.mode = 'approach';
        this.modeT = 0;
        this.df.perched = false;
        this.chirp('talk');
    }

    _openMeeting() {
        this.mode = 'meeting';
        this.view.meet(T.introduction(this.mem.visits), (name) => this._joined(name), () => this.meetLater());
    }

    meetLater(quiet = false) {
        if (this.view.meeting) return this.view.meetLater?.();
        this.mode = 'return';
        this.meetArmed = false;
        if (!quiet) this.gui.hint('The dragonfly settles back on the lamp at the end of the dock · click it, or come back, when you want a guide', 7000);
    }

    _joined(name) {
        const m = this.mem;
        m.met = true;
        m.name = T.cleanName(name) || 'Zephyr';
        m.metAt = Date.now();
        m.joy = Math.max(m.joy, 0.75);
        this.view.setName(m.name);
        this.mode = 'follow';
        this.greeted = true;
        this._discover(T.PLACE_BY_ID.dock, false);
        this.save();
        this.df.startTrick('loop');
        const touch = matchMedia('(pointer: coarse)').matches;
        this.say(`${m.name}! What a lovely name. I’ll stay close and show you things as we find them. ${touch ? 'Tap me, or my picture in the corner,' : 'Click me, or my picture in the corner (or press K),'} for hints, news, snacks and a lift anywhere we’ve been.`, [
            { label: 'What’s new?', fn: () => this.talk('news') },
            { label: 'Any hints?', fn: () => this.talk('hint') },
        ], { chirp: 'happy', ms: 16000 });
    }

    _greet() {
        this.greeted = true;
        const sinceNews = this.news.find((n) => n.kind === 'since');
        const text = T.greeting(this.name, this.mem, Date.now(), { night: this.info?.night ?? 0, weather: this.info?.weather, news: sinceNews?.text });
        const acts = sinceNews?.game ? this._gameActs(sinceNews.game) : [{ label: 'What’s new?', fn: () => this.talk('news') }];
        this.df.startTrick('loop');
        if (this.mem.chat !== 'hush' || sinceNews) this.say(text, acts, { chirp: 'happy' });
    }

    // ------------------------------------------------------------ finding things

    _spokeAt(zone) {
        const m = /^g(\d+)$/.exec(zone || '');
        return m ? this.world.layout.spokes[Number(m[1])] : null;
    }

    _discover(p, speak = true) {
        if (!p || this.mem.places[p.id]) return false;
        this.mem.places[p.id] = Date.now();
        this.mem.joy = Math.min(1, this.mem.joy + 0.03);
        this.save();
        if (speak) {
            const n = Object.keys(this.mem.places).length;
            const acc = T.ACCESSORIES.find((a) => a.id === 'crown');
            const crown = n === 8 && acc ? ' Oh, and I’ve made myself a flower crown to celebrate. Look in my Look tab!' : '';
            this._auto(`${p.icon} ${p.about}${crown}`, [], 'found');
        }
        if (this.view.panelOpen) this.view.render();
        return true;
    }

    /** Fly ahead to a new landmark and point it out. */
    _scout(lm, p, info) {
        const toYou = tmpA.set(info.pos.x - lm.x, 0, info.pos.z - lm.z);
        const d = toYou.length() || 1;
        toYou.multiplyScalar(Math.min(6, d * 0.4) / d);
        const x = lm.x + toYou.x, z = lm.z + toYou.z;
        const y = Math.max(this.world.walkHeight(x, z), 0) + 2.6;
        this.scout = { target: new THREE.Vector3(x, y, z), t: 0, lm, p, from: { x: info.pos.x, z: info.pos.z } };
        this.mode = 'scout';
        this.lastScout = this.clock;
        this.mem.places[p.id] = Date.now();
        this.save();
        const n = Object.keys(this.mem.places).length;
        const crown = n === 8 ? ' And I’ve made myself a flower crown to celebrate. See my Look tab!' : '';
        this._auto(`Ooh, over here! ${p.icon} ${p.about}${crown}`, [], 'found');
    }

    _survey(info) {
        const m = this.mem;
        const room = info.room || (info.place !== 'garden' ? info.place : null);
        let here = null;
        if (room) {
            const p = T.placeForRoom(room);
            here = p?.id || null;
            if (p && !m.places[p.id]) {
                this._discover(p);
                this.df.startTrick('zip');
            }
        } else {
            const sp = this._spokeAt(info.zone);
            if (sp) {
                here = 'path:' + sp.genre.id;
                if (!m.places[here]) this._discoverPath(sp, info);
            } else {
                const p = T.placeForZone(info.zone);
                if (p) {
                    here = p.id;
                    this._discover(p);
                }
            }
            this._landmarks(info);
            this._statues(info);
        }
        this.here = here;
    }

    _discoverPath(sp, info) {
        const id = 'path:' + sp.genre.id;
        this.mem.places[id] = Date.now();
        this.save();
        const g = sp.genre, newest = sp.games[0];
        // dart ahead along it
        const pr = projectOnPath(sp.pts, info.pos.x, info.pos.z);
        const ahead = samplePath(sp.pts, pr.s + 9);
        const y = Math.max(this.world.walkHeight(ahead.x, ahead.z), 0) + 2.2;
        this.scout = { target: new THREE.Vector3(ahead.x, y, ahead.z), t: 0, lm: { x: ahead.x, z: ahead.z }, short: true, from: { x: info.pos.x, z: info.pos.z } };
        this.mode = 'scout';
        this.lastScout = this.clock;
        this._auto(`${g.emoji} This is ${g.name}: ${g.short.toLowerCase()}, ${sp.games.length} game${sp.games.length === 1 ? '' : 's'}. The newest here is ${newest.title}, nearest the Hub.`, this._gameActs(newest), 'found');
    }

    _landmarks(info) {
        if (this.mode !== 'follow' || this.df.trick || this.clock - this.lastScout < 10 || this.clock - this.saidAt < 6) return;
        for (const lm of this.world.landmarks) {
            const p = T.placeForZone(lm.name);
            if (!p || this.mem.places[p.id]) continue;
            const d = Math.hypot(info.pos.x - lm.x, info.pos.z - lm.z);
            if (d < 11) {
                this._discover(p);
                return;
            }
            if (d < 34) {
                this._scout(lm, p, info);
                return;
            }
        }
    }

    _statues(info) {
        let best = null, bd = Infinity;
        for (const st of this.world.statues || []) {
            const d = Math.hypot(st.x - info.pos.x, st.z - info.pos.z);
            if (d < bd) bd = d, best = st;
        }
        if (bd > 7) this.lastStatue = -1;
        if (!best || bd > 4.4 || best.id === this.lastStatue) return;
        this.lastStatue = best.id;
        const g = best.game, m = this.mem;
        const first = !m.games[g.id];
        m.games[g.id] = (m.games[g.id] || 0) + 1;
        this.save();
        const upd = T.recentUpdate(g, this.updates, Date.now());
        if (upd) this._auto(`\u{1F4F0} ${T.aboutGame(g, genreOf(g), upd)}`, this._gameActs(g).slice(1), 'quiet');
        else if (first && this.rand() < 0.4) this._auto(T.aboutGame(g, genreOf(g), null), this._gameActs(g).slice(1), 'chatty');
    }

    /** Things it might mention once a visit: nightfall, midnight, the weather. */
    _remarks(info) {
        const once = (key, lines, level = 'chatty') => {
            if (this.said.has(key)) return;
            if (this._auto(pick(lines, this.rand), [], level)) this.said.add(key);
        };
        if (info.night > 0.55 && this.prevNight !== undefined && this.prevNight <= 0.55) once('night', T.CHATTER.night);
        this.prevNight = info.night;
        if (info.time > 0.975 && info.time < 0.995) once('midnight', T.CHATTER.midnight);
        if (info.weather && T.CHATTER[info.weather] && info.weather !== this.prevWeather && this.prevWeather !== undefined) once('w-' + info.weather, T.CHATTER[info.weather]);
        this.prevWeather = info.weather;
    }

    /** Every few minutes, if it is in a chatty mood. */
    _idle(dt) {
        this.chatter -= dt;
        if (this.chatter > 0) return;
        this.chatter = 140 + this.rand() * 100;
        const m = this.mem;
        if (m.full < 0.2) return this._auto(pick(T.CHATTER.hungry, this.rand), [{ label: 'Give a snack', primary: true, fn: () => this.view.openPanel('care') }], 'quiet');
        if (m.joy < 0.32) return this._auto(pick(T.CHATTER.bored, this.rand), [{ label: 'Play', primary: true, fn: () => this.view.openPanel('care') }]);
        const r = this.rand();
        const kind = r < 0.35 ? 'hint' : r < 0.6 ? 'news' : r < 0.85 ? 'game' : 'secret';
        const [text, acts] = this._answer(kind);
        this._auto(text, acts);
    }

    // ------------------------------------------------------------ travel

    /** Everywhere it can take you, grouped for the Travel tab. */
    travelList() {
        const m = this.mem, now = Date.now();
        const item = (p) => ({ key: 'place:' + p.id, label: p.name, icon: p.icon, sub: `Found ${T.ago(m.places[p.id], now)}`, here: this.here === p.id });
        const island = T.PLACES.filter((p) => p.area === 'island' && m.places[p.id]).map(item);
        const hidden = T.PLACES.filter((p) => p.area === 'hidden' && m.places[p.id]).map(item);
        const paths = this.world.layout.spokes.filter((sp) => m.places['path:' + sp.genre.id]).map((sp) => ({
            key: 'path:' + sp.genre.id, label: sp.genre.name, icon: sp.genre.emoji, sub: `${sp.genre.short} · ${sp.games.length} games`, here: this.here === 'path:' + sp.genre.id,
        }));
        const games = Object.entries(m.games).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => this.byId.get(id)).filter(Boolean).map((g) => ({
            key: 'game:' + g.id, label: g.title, iconHTML: iconHTML(g), sub: `In front of its statue · visited ×${m.games[g.id]}`,
        }));
        return [
            { title: 'Around the island', items: island, empty: 'Nowhere yet!' },
            { title: 'Hidden places', items: hidden, empty: 'None yet. Ask me for a hint!' },
            { title: 'Paths', items: paths, empty: 'Walk up to the Hub and pick a path.' },
            { title: 'In front of a game', items: games, empty: 'Walk up to a statue and I’ll remember it.' },
        ];
    }

    /**
     * Sent from the Pocket Garden's Dragonfly menu (index.html?go=place:tree): as soon as you are on the
     * island it comes to you and flies you to `key`, one of travelList()'s keys.
     */
    summon(key) {
        if (!this.met) return false;
        this.greeted = true;
        if (this.mode === 'perch' || this.mode === 'greet') {
            this.mode = 'follow';
            this.df.perched = false;
        }
        return this.travel(key, { summoned: true });
    }

    travel(key, { summoned = false } = {}) {
        const [kind, id] = String(key).split(/:(.*)/s);
        let dest = null;
        if (kind === 'place' && T.PLACE_BY_ID[id] && this.mem.places[id]) dest = { place: T.PLACE_BY_ID[id] };
        else if (kind === 'path') {
            const sp = this.world.layout.spokes.find((s) => s.genre.id === id);
            if (sp && this.mem.places[key]) dest = { spoke: sp };
        } else if (kind === 'game' && this.byId.has(id)) dest = { game: this.byId.get(id) };
        if (!dest) {
            if (summoned) this.say('You called me from your Pocket Garden, but I don’t know the way there yet. Let’s find it together!', [], { chirp: 'sad' });
            return false;
        }
        if (!this.info?.canTravel) {
            this.say(T.CHATTER.cantTravel, [], { log: false, chirp: 'sad' });
            return false;
        }
        this.view.closePanel();
        if (!this.hooks.travel(dest)) {
            this.say(T.CHATTER.cantTravel, [], { log: false, chirp: 'sad' });
            return false;
        }
        this.df.startTrick('zip');
        const label = dest.game ? dest.game.title : dest.spoke ? dest.spoke.genre.name : dest.place.name;
        const hi = summoned ? 'You called me from your Pocket Garden! ' : '';
        this.say(`${hi}${pick(T.CHATTER.travel, this.rand)} To ${label}!`, [], { log: false, chirp: 'happy', ms: summoned ? 5000 : 3500 });
        return true;
    }

    // ------------------------------------------------------------ every frame

    /**
     * @param {object} info  scene (being drawn), active (walking about, no fly-in), hidden (no dragonfly: the
     *   telescope, the galaxy, the submarine), hudHidden, blocked (an overlay is open), place, room, zone,
     *   pos (yours), night, time (0..1), weather, canTravel
     */
    update(dt, t, info) {
        this.info = info;
        this.clock += dt;
        const df = this.df, cam = this.camera, m = this.mem;
        const wasActive = this.active;
        this.active = info.active;
        if (this.active) this.activeFor += dt;
        if (this.active && !wasActive) this.activeFor = 0;
        df.night = info.night;

        // memory: time together, mood that fades, saved now and then
        if (this.active && m.met) {
            m.together += dt;
            m.full = Math.max(0, m.full - dt / (6 * 3600));
            m.joy = Math.max(0.2, m.joy - dt / (18 * 3600));
        }
        this.saveTimer += dt;
        if (this.saveTimer > 15) {
            this.saveTimer = 0;
            m.lastSeen = Date.now();
            this.save();
        }
        this.moodTimer += dt;
        if (this.moodTimer > 2) {
            this.moodTimer = 0;
            this._mood();
        }
        this.view.showHud(m.met && this.active && !info.hudHidden && this.mode !== 'meeting');

        // which scene it flies in: before it has joined you it keeps to the dock
        const following = m.met && this.mode !== 'perch';
        const want = following ? info.scene : this.gardenScene;
        if (df.group.parent !== want) {
            want.add(df.group);
            if (following) this._snapBeside();
        }
        df.group.visible = !(following && info.hidden);
        df.setScale(info.room ? 1.15 : 1.5);

        switch (this.mode) {
            case 'perch': return this._perch(dt, t, info);
            case 'approach':
            case 'meeting': return this._toMeet(dt, t, info);
            case 'return': return this._return(dt, t, info);
            case 'greet': return this._toGreet(dt, t, info);
            case 'catch': return this._catch(dt, t, info);
            case 'scout': return this._scouting(dt, t, info);
            default: return this._follow(dt, t, info);
        }
    }

    _snapBeside() {
        this.df.beside(this.camera, 0, this.clock, this.rand, this.aim);
        this.df.snapTo(this.aim);
    }

    _perch(dt, t, info) {
        const df = this.df;
        df.perched = true;
        df.pos.copy(this.perch);
        df.body.rotation.set(0, 0, 0);
        df.animate(dt, t, 0);
        // now and then it stretches its wings
        if (Math.sin(t * 0.7) > 0.995) df.wiggle = 0.25;
        if (!info.active || info.blocked) return;
        const d = Math.hypot(info.pos.x - this.perch.x, info.pos.z - this.perch.z);
        if (this.mem.met) {
            // a returning friend: it comes to meet you on the dock (or catches you up, wherever you are)
            if (this.activeFor > 0.8) {
                this.mode = 'greet';
                this.modeT = 0;
                df.perched = false;
                if (info.scene !== this.gardenScene || d > 40) this._snapBeside();
            }
            return;
        }
        if (d > 14) this.meetArmed = true;
        if (this.meetArmed && d < 9 && this.activeFor > 1.6 && info.scene === this.gardenScene) this._approach();
        // gone off without meeting it: one nudge, a while later
        if (!this.waitHint && this.activeFor > 90 && d > 40 && !info.room && info.place === 'garden') {
            this.waitHint = true;
            this.gui.hint('Something glittered on the lamp at the end of the dock…', 7000);
        }
    }

    /** The spot just in front of you, slightly below the eye, where it hovers to talk. */
    _faceSpot(out, dist = 1.25, side = 0, up = -0.12) {
        this.camera.getWorldDirection(fwd);
        fwd.y = Math.max(-0.3, Math.min(0.3, fwd.y));
        fwd.normalize();
        rgt.crossVectors(fwd, UP).normalize();
        return out.copy(this.camera.position).addScaledVector(fwd, dist).addScaledVector(rgt, side).add(tmpB.set(0, up, 0));
    }

    _toMeet(dt, t, info) {
        const df = this.df;
        this.modeT = (this.modeT || 0) + dt;
        // while you talk it hovers clear of the meeting card: right of it on a wide screen, left of it on a
        // short landscape phone (the card is down the right), below it on a tall phone (the card is at the top)
        const landscape = innerWidth > innerHeight, wide = innerWidth >= 900 && innerWidth > innerHeight * 1.2;
        const talking = this.view.meeting;
        const side = !talking ? 0 : landscape && innerHeight <= 520 ? -0.4 : wide ? 0.42 : 0;
        const up = talking && !landscape ? -0.38 : -0.12;
        this._faceSpot(this.aim, 1.3, side, up);
        df.fly(dt, t, this.aim, this.camera.position, this.mode === 'meeting' ? 0.6 : 0.8);
        if (this.mode === 'approach' && (df.pos.distanceTo(this.aim) < 0.35 || this.modeT > 3)) {
            if (info.blocked) return;
            this._openMeeting();
        }
        // walked off without answering: it goes back to wait for you on the lamp
        const away = Math.hypot(info.pos.x - this.perch.x, info.pos.z - this.perch.z) > 22;
        if (!info.active || info.scene !== this.gardenScene || away) {
            if (this.view.meeting) this.view.meetLater?.();
            else this.meetLater(true);
        }
    }

    _return(dt, t, info) {
        const df = this.df;
        df.fly(dt, t, this.perch, null, 0.5);
        if (df.pos.distanceTo(this.perch) < 0.08) {
            this.mode = 'perch';
            df.heading.setFromAxisAngle(UP, Math.PI);
            df.group.quaternion.copy(df.heading);
        }
    }

    _toGreet(dt, t, info) {
        const df = this.df;
        this.modeT += dt;
        this._faceSpot(this.aim, 1.4, 0.35);
        df.fly(dt, t, this.aim, this.camera.position, 0.8);
        if (df.pos.distanceTo(this.aim) < 0.4 || this.modeT > 3.5) {
            this.mode = 'follow';
            if (!this.greeted) this._greet();
        }
    }

    _follow(dt, t, info) {
        const df = this.df;
        let aim = df.beside(this.camera, dt, t, this.rand, this.aim);
        tmpA.copy(aim);
        const tr = df.trick ? df.trickAim(dt, this.camera, tmpA, this.aim) : null;
        if (tr) aim = tr;
        // left behind (a door, a teleport, the lift): it catches you up at once
        if (df.pos.distanceTo(this.camera.position) > 16) this._snapBeside();
        df.fly(dt, t, aim, this.view.talking || this.view.panelOpen ? this.camera.position : null, tr ? 2.2 : 1);
        if (!info.active) return;
        this._notice(dt, info);
        if (!info.blocked) this._idle(dt);
    }

    /** Keep track of where you are (and tell what is waiting to be told), following or out ahead. */
    _notice(dt, info) {
        if (this.queue.length && (!this.view.talking || this.clock - this.saidAt > 6) && !this.view.meeting) {
            const [text, acts] = this.queue.shift();
            this.lastAuto = this.clock;
            this.say(text, acts);
        }
        this.surveyTimer -= dt;
        if (this.surveyTimer <= 0) {
            this.surveyTimer = 0.35;
            this._survey(info);
            this._remarks(info);
        }
    }

    _scouting(dt, t, info) {
        const df = this.df, s = this.scout;
        s.t += dt;
        const d = Math.hypot(info.pos.x - s.lm.x, info.pos.z - s.lm.z);
        df.fly(dt, t, s.target, this.camera.position, 0.55);
        // done once you've come up to it, or gone somewhere else, or after a while (it won't wait for ever)
        const moved = Math.hypot(info.pos.x - s.from.x, info.pos.z - s.from.z) > 25;
        if (s.t > (s.short ? 4 : 9) || (!s.short && d < 12) || moved || df.pos.distanceTo(this.camera.position) > 60 || info.room || info.place !== 'garden') {
            this.mode = 'follow';
            this.scout = null;
        }
        if (info.active) this._notice(dt, info);
    }

    _catch(dt, t, info) {
        const df = this.df, c = this.catch;
        c.t -= dt;
        c.next -= dt;
        if (c.next <= 0) {
            c.next = Math.max(0.5, 1.15 - c.caught * 0.05);
            c.off.set((this.rand() * 2 - 1) * 1.3, -0.45 + this.rand() * 0.95, 1.8 + this.rand() * 1.8);
        }
        this.camera.getWorldDirection(fwd);
        rgt.crossVectors(fwd, UP).normalize();
        const up = tmpB.crossVectors(rgt, fwd).normalize();
        this.aim.copy(this.camera.position).addScaledVector(rgt, c.off.x * c.off.z * 0.45).addScaledVector(up, c.off.y * c.off.z * 0.35).addScaledVector(fwd, c.off.z);
        df.fly(dt, t, this.aim, this.camera.position, 1.8);
        this.view.score(c.caught, Math.max(0, c.t));
        if (c.t <= 0 || !info.active) this._endCatch();
    }
}
