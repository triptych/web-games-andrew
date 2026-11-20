// Messages: a little phone inside the handheld. Every game you play adds its
// character to your address book, and from then on they text you: chatter in
// their own voice, tips, nudges to come back, notes about how your save is
// doing ("you're on level 3 in Tomebound, let's go!"), and, when the game is
// idle, word that something has been piling up while you were away. When a new
// game lands in the collection its character rings the handheld with a friend
// request, and when a friend's game is updated they send you the news with a
// link to play it. You can write back: tap a quick reply (or turn the wheel to
// one and press ●), or type, and they answer. Friendship grows as you talk
// and play, from New friend to Best friend.
//
// Each character lives with its game, not here: game-NNN/avatar/avatar.json
// holds the name, the painting prompt and the whole message bank, and
// avatar.webp / avatar-tiny.webp beside it are the pictures (see
// docs/generic/avatars.md). The Garden of Games itself is your dragonfly
// (garden/avatar/), drawn as the one you met on the island when you have.
//
// What the console remembers is in localStorage `console.messages`. Saves are
// only ever read, never written: a game's own keys are listed in its
// avatar.json, and the numbers worth mentioning (level, gold, best score…) are
// found by name, shallowest first.

import { genreOf } from '../../garden/js/genres.js';
import { PLACES } from '../../garden/js/dragonfly-talk.js';
import { View, ListView } from './views.js';
import { ICONS } from './icons.js';
import { sfx } from './sound.js';
import { esc, clamp, excerpt, timeAgo, gameNo } from './util.js';
import { currentMem, flyTo } from './pet.js';
import { spriteURL, lookOf } from './pixel-dragonfly.js';

export const MSG_KEY = 'console.messages';
const GARDEN = 'garden';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const HOUR = 36e5;
const DAY = 24 * HOUR;
const THREAD_MAX = 80;

/** Friendship: points to reach each level. */
export const LEVELS = [
    [0, 'New friend'],
    [12, 'Pal'],
    [35, 'Buddy'],
    [70, 'Good friend'],
    [120, 'Best friend'],
];
/** How often a friend texts while the console is open: [min, max] seconds between messages. */
export const FREQ = [
    ['chatty', 'Chatty', [20, 60]],
    ['normal', 'Normal', [45, 140]],
    ['quiet', 'Quiet', [150, 420]],
    ['off', 'Off', null],
];

// ---------------------------------------------------------------- lines every character can use

const GENERIC = {
    chat: [
        'Just thinking about {game}. Good times! 😊',
        'Hey {you}! How is your day going?',
        'Random thought: you are a great friend. That is it. That is the message. 💌',
        'I told everyone in {game} about you. They are very impressed.',
        'Do you ever just stare at your handheld and smile? Same.',
        'I found a cool rock today. I named it after you. 🪨',
    ],
    nudge: ['Got five minutes? {game} is right here! ▶', 'Come say hi in {game}! I will be waiting.', 'Perfect time for a little {game}, if you ask me. 😉'],
    idle: ['It has been {ago} since you played {game}. Everything okay? 🥺', '{game} misses you! It has been {ago}.', 'Knock knock! It has been {ago}. {game} is still here for you.'],
    hi: ['Hi {you}! 👋', 'Hey hey, {you}!', 'Oh! Hi {you}! Perfect timing.', 'Hello hello! 😄'],
    howareyou: ['Doing great now that you messaged!', 'Pretty good! A bit busy in {game}, but good.', 'Can not complain! Well, I could. But I will not.'],
    heart: ['Aww! 💖', 'You are the best, {you}! 💕', '*blushes in pixels* ❤️', 'Right back at you! 💞'],
    thanks: ['Any time, {you}! 😊', 'That is what friends are for!'],
    confused: ['Hmm? 🤔 I am better at tips and gossip about {game}!', 'Ha! Not sure what that means, but I like you. 😄', 'Sorry, the reception in {game} is bad. Ask me for a tip?', 'You lost me there! Try asking me how to play, or for a tip.'],
    noProgress: ['I can not see your save from here yet. Play a round of {game} and I will keep track!', 'No save that I can find yet. Start a game of {game} and tell me how it goes!'],
    played: ['You played {game}! I saw that. 😄', 'Welcome back from {game}! How did it go?', 'That was fun to watch! Same time tomorrow?'],
    level: ['We are officially {level}s now! 💖', 'Look at us: {level}s! I will tell everyone.', 'Friendship level up: {level}! 🎉'],
    since: ['Fun fact: we have been friends for {days} days now. 💌', '{days} days of friendship and counting!'],
    bye: ['Bye {you}! 👋', 'See you soon!', 'Talk later! 😊'],
};

// ---------------------------------------------------------------- state

function readState() {
    try {
        const v = JSON.parse(localStorage.getItem(MSG_KEY) || 'null');
        return v && typeof v === 'object' && v.v === 1 ? v : null;
    } catch {
        return null;
    }
}

function freshState() {
    return { v: 1, me: '', freq: 'normal', seen: null, friends: {}, requests: [], declined: {}, threads: {}, unread: {}, lastVisit: 0, news: {} };
}

/** A save's own value at a dotted path, or null. */
function atPath(o, path) {
    let v = o;
    for (const k of path.split('.')) {
        if (v == null || typeof v !== 'object') return null;
        v = v[k];
    }
    return v;
}

// ---------------------------------------------------------------- reading a game's save (read only)

const STAT_NAMES = {
    level: ['level', 'lvl', 'playerlevel', 'herolevel', 'partylevel', 'rank'],
    gold: ['gold', 'coins', 'money', 'cash', 'crowns'],
    best: ['best', 'highscore', 'hiscore', 'hi', 'bestscore', 'record', 'top'],
    score: ['score', 'points'],
    wave: ['wave', 'bestwave', 'maxwave', 'waves'],
    day: ['day', 'daynum', 'daycount', 'days'],
    floor: ['floor', 'depth', 'deepest', 'maxdepth', 'bestfloor', 'maxfloor'],
    stage: ['stage', 'chapter', 'world', 'act', 'sector'],
    stars: ['stars', 'totalstars'],
    gems: ['gems', 'crystals', 'shards', 'stardust', 'motes'],
    wins: ['wins', 'victories', 'won'],
    solved: ['solved', 'cleared', 'completed'],
};
const COUNTED = new Set(['solved', 'stars', 'wins', 'rescued', 'words']);
const TIME_KEYS = new Set(['savedat', 'lastsave', 'lastsaved', 'saved', 'time', 'ts', 'timestamp', 'updated', 'lastplayed', 'lastseen', 'last', 't']);

function rawSaves(keys) {
    const out = [];
    let all = null;
    for (const k of keys || []) {
        try {
            if (k.endsWith('*')) {
                const pre = k.slice(0, -1);
                all ??= Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
                const hits = all.filter((x) => x && x.startsWith(pre)).map((x) => localStorage.getItem(x) || '');
                // the biggest slot is usually the one with the most progress in it
                hits.sort((a, b) => b.length - a.length);
                if (hits[0]) out.push(hits[0]);
            } else {
                const v = localStorage.getItem(k);
                if (v) out.push(v);
            }
        } catch {
            /* storage blocked */
        }
    }
    return out;
}

/**
 * The stats in a game's save that a character can talk about: { level: 3, gold: 120, … }
 * plus `lastSave` (ms) when the save says when it was written. Null when there is no save.
 */
export function readSaveStats(save) {
    if (!save?.keys?.length) return null;
    const raws = rawSaves(save.keys);
    if (!raws.length) return null;
    const stats = {};
    const names = { ...STAT_NAMES };
    for (const [stat, list] of Object.entries(save.stats || {})) names[stat] = [...list.map((x) => x.toLowerCase()), ...(names[stat] || [])];
    for (const raw of raws) {
        if (raw.length > 3e6) continue;
        let o;
        try {
            o = JSON.parse(raw);
        } catch {
            continue;
        }
        if (typeof o === 'number' && Number.isFinite(o)) {
            stats[save.root || 'best'] ??= o;
            continue;
        }
        if (!o || typeof o !== 'object') continue;
        // explicit dotted paths first
        for (const [stat, list] of Object.entries(save.stats || {})) {
            for (const p of list) {
                if (!p.includes('.')) continue;
                const v = atPath(o, p);
                if (typeof v === 'number' && Number.isFinite(v) && !(stat in stats)) stats[stat] = v;
            }
        }
        // then breadth first: the shallowest key of each name wins
        const found = new Map();
        const queue = [[o, 0]];
        let n = 0;
        while (queue.length && n < 5000) {
            const [node, d] = queue.shift();
            const entries = Array.isArray(node) ? node.slice(0, 12).map((v, i) => [String(i), v]) : Object.entries(node);
            for (const [k, v] of entries) {
                n++;
                const lk = k.toLowerCase();
                if (!Array.isArray(node) && !found.has(lk) && (typeof v === 'number' || (v && typeof v === 'object'))) found.set(lk, v);
                if (v && typeof v === 'object' && d < 6) queue.push([v, d + 1]);
            }
        }
        for (const [stat, list] of Object.entries(names)) {
            if (stat in stats) continue;
            for (const name of list) {
                const v = found.get(name);
                if (v === undefined) continue;
                let num = null;
                if (typeof v === 'number') num = v;
                else if (COUNTED.has(stat)) num = Array.isArray(v) ? v.filter(Boolean).length : Object.values(v).filter(Boolean).length;
                if (num != null && Number.isFinite(num) && num > 0 && num < 1e15) {
                    stats[stat] = Math.round(num * 100) / 100;
                    break;
                }
            }
        }
        for (const [k, v] of found) {
            if (TIME_KEYS.has(k) && typeof v === 'number' && v > 1.4e12 && v < Date.now() + 864e5) stats.lastSave = Math.max(stats.lastSave || 0, v);
        }
    }
    if (stats.level != null && (stats.level > 9999 || stats.level < 1)) delete stats.level;
    return Object.keys(stats).length ? stats : null;
}

/** The next nice number above v: 1234 → 1,500; 87 → 100. */
function niceUp(v) {
    const target = v * 1.1 + 1;
    const mag = 10 ** Math.floor(Math.log10(Math.max(1, target)));
    for (const step of [mag / 4, mag / 2, mag]) {
        const s = Math.max(1, step);
        const up = Math.ceil(target / s) * s;
        if (up <= target * 1.6) return up;
    }
    return Math.ceil(target / mag) * mag;
}

const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 10) / 10).toLocaleString());

/** Fill {game}, {you}, {level+1}, {best^}… Returns null if a stat it needs is missing. */
function fill(text, ctx) {
    let ok = true;
    const out = text.replace(/\{([a-z]+)(\+\d+|\^)?\}/gi, (m, key, op) => {
        let v = ctx[key];
        if (v === undefined) v = ctx.stats?.[key];
        if (v === undefined || v === null) {
            ok = false;
            return m;
        }
        if (typeof v === 'number') {
            if (op === '^') v = niceUp(v);
            else if (op) v += +op.slice(1);
            return fmt(v);
        }
        return String(v);
    });
    if (!ok) return null;
    // a line that opens with a value ("{ago} without you!") still starts with a capital
    return text.startsWith('{') ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

function agoWords(ms) {
    const h = ms / HOUR;
    if (h < 1) return 'a little while';
    if (h < 2) return 'an hour';
    if (h < 24) return `${Math.floor(h)} hours`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'a day' : `${d} days`;
}

// ---------------------------------------------------------------- the messenger

export class Messenger {
    constructor(app, { all, byId, store }) {
        this.app = app;
        this.all = all;
        this.byId = byId;
        this.store = store;
        this.avatars = new Map();
        this.loading = new Map();
        this.state = readState() || freshState();
        this.persist = true;
        this.ringed = new Set();
        this.updates = null;
        this.listeners = new Set();
        this.started = false;
    }

    save() {
        try {
            localStorage.setItem(MSG_KEY, JSON.stringify(this.state));
        } catch {
            this.persist = false;
        }
    }

    changed() {
        this.save();
        for (const fn of this.listeners) fn();
    }

    on(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    // ----- contacts

    isFriend(id) {
        return !!this.state.friends[id];
    }

    friendIds() {
        return Object.keys(this.state.friends);
    }

    gameOf(id) {
        return id === GARDEN ? null : this.byId.get(id) || null;
    }

    dir(id) {
        return id === GARDEN ? '../garden/avatar/' : `../${this.byId.get(id)?.folder || id}/avatar/`;
    }

    /** The character for an id (a game's, or the Garden's dragonfly), fetched once. */
    load(id) {
        if (this.avatars.has(id)) return Promise.resolve(this.avatars.get(id));
        if (this.loading.has(id)) return this.loading.get(id);
        const p = fetch(`${this.dir(id)}avatar.json`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
            .catch(() => this.stand_in(id))
            .then((d) => {
                this.avatars.set(id, d);
                this.loading.delete(id);
                return d;
            });
        this.loading.set(id, p);
        return p;
    }

    /** A character for a game whose avatar.json did not load: its title, its blurb, the generic lines. */
    stand_in(id) {
        const g = this.gameOf(id);
        return {
            id,
            name: g ? g.title : 'Dragonfly',
            role: g ? 'From the game' : 'Your Garden companion',
            emoji: g?.icon || '🪽',
            bio: g ? excerpt(g.description, 120) : '',
            request: g ? `Hi! I'm from ${g.title}. Friends?` : 'Hi!',
            hello: ['Nice to meet you!'],
            about: g ? excerpt(g.description, 200) : '',
            how: g ? excerpt(g.description, 200) : '',
            missing: true,
        };
    }

    loadAll(ids) {
        return Promise.all(ids.map((id) => this.load(id)));
    }

    /** What a contact is called, looks like and comes from, synchronously (falls back until loaded). */
    contact(id) {
        const d = this.avatars.get(id);
        const g = this.gameOf(id);
        const mem = id === GARDEN ? currentMem() : null;
        let name = d?.name || g?.title || 'Dragonfly';
        if (id === GARDEN && mem?.met && mem.name) name = mem.name;
        const color = d?.color || (g ? genreOf(g).accent : '#7fd4b4');
        return { id, d, g, name, color, role: d?.role || (g ? g.title : 'Your Garden companion'), emoji: d?.emoji || g?.icon || '🪽' };
    }

    /** The picture: the painting in the game's avatar/ folder; your own dragonfly for the Garden once met. */
    img(id, tiny = false) {
        if (this.pixel(id)) {
            try {
                const mem = currentMem();
                return spriteURL({ look: lookOf(mem), frame: 0, face: mem?.met ? 'open' : 'sleep', paper: this.app.device?.dataset.glow === 'paper' });
            } catch {
                /* fall through to the painting */
            }
        }
        return `${this.dir(id)}avatar${tiny ? '-tiny' : ''}.webp`;
    }

    /** The Garden is drawn as your own 8-bit dragonfly once you've met it on the island (its painting until then). */
    pixel(id) {
        return id === GARDEN && (currentMem()?.met || this.avatars.get(GARDEN)?.art !== 'fal');
    }

    avatarHTML(id, { tiny = true, cls = '' } = {}) {
        const c = this.contact(id);
        const px = this.pixel(id) ? ' px' : '';
        return `<i class="av${px} ${cls}" style="--av:${esc(c.color)};background-image:url('${this.img(id, tiny)}')" aria-hidden="true"></i>`;
    }

    // ----- friendship

    friend(id) {
        return this.state.friends[id];
    }

    levelOf(id) {
        const pts = this.friend(id)?.pts || 0;
        let i = 0;
        while (i < LEVELS.length - 1 && pts >= LEVELS[i + 1][0]) i++;
        return i;
    }

    hearts(id) {
        const l = this.levelOf(id);
        return '♥'.repeat(l + 1) + '♡'.repeat(LEVELS.length - 1 - l);
    }

    /** Add friendship points (some kinds only so often a day); a level up gets a message and a toast. */
    grow(id, pts, kind = 'talk') {
        const f = this.friend(id);
        if (!f) return;
        const today = new Date().toDateString();
        if (f.day !== today) {
            f.day = today;
            f.today = {};
        }
        const caps = { talk: 12, heart: 3, answer: 15, play: 16 };
        const used = f.today[kind] || 0;
        const add = Math.max(0, Math.min(pts, (caps[kind] ?? 99) - used));
        if (!add) return;
        f.today[kind] = used + add;
        const before = this.levelOf(id);
        f.pts = (f.pts || 0) + add;
        const after = this.levelOf(id);
        if (after > before) {
            const level = LEVELS[after][1];
            const c = this.contact(id);
            setTimeout(() => {
                this.deliver(id, { x: this.fillFor(id, pick(GENERIC.level), { level }) || `We're ${level}s now! 💖`, k: 'level' });
                this.app.toast(`💖 You and ${c.name} are now ${level}s!`);
                this.app.burst?.();
            }, 1400);
        }
    }

    befriend(id, { why = 'played', quiet = false, at = Date.now() } = {}) {
        if (this.isFriend(id)) return false;
        const g = this.gameOf(id);
        this.state.friends[id] = { since: at, pts: 0, why, ver: g?.version || null, used: {} };
        this.state.requests = this.state.requests.filter((r) => r.id !== id);
        delete this.state.declined[id];
        this.state.threads[id] ||= [];
        this.load(id).then((d) => {
            const hello = (d.hello || []).slice(0, 2);
            const lines = [d.request, ...hello].filter(Boolean);
            lines.forEach((x, i) => this.deliver(id, { x: this.fillFor(id, x) || x, k: 'hello' }, { at: at + i * 1000, notify: false, read: quiet && i < lines.length - 1 }));
            // met through a request (you haven't played it yet): end with an invitation to
            if (why !== 'played' && g) {
                const n = this.draw(id, 'nudge');
                if (n) this.deliver(id, { x: n, k: 'nudge', play: id }, { at: at + lines.length * 1000, notify: false });
            }
            if (quiet) this.state.unread[id] = Math.min(this.state.unread[id] || 0, 1);
            else this.remind(id);
            this.changed();
        });
        return true;
    }

    // ----- context for filling lines

    lastPlayed(id) {
        const r = this.store.recent.find((x) => x.id === id);
        return r ? r.t : 0;
    }

    ctx(id) {
        const c = this.contact(id);
        const mem = currentMem();
        const stats = id === GARDEN ? null : readSaveStats(c.d?.save);
        const last = Math.max(this.lastPlayed(id), stats?.lastSave || 0);
        const f = this.friend(id);
        return {
            you: this.state.me || 'friend',
            game: c.g ? c.g.title : 'the Garden',
            name: c.name,
            df: mem?.met && mem.name ? mem.name : 'your dragonfly',
            version: c.g?.version || '',
            count: this.all.length,
            days: f ? Math.max(1, Math.round((Date.now() - f.since) / DAY)) : 1,
            ago: last ? agoWords(Date.now() - last) : undefined,
            idleMs: last ? Date.now() - last : null,
            stats,
            level: undefined,
        };
    }

    fillFor(id, text, extra = {}) {
        const ctx = { ...this.ctx(id), ...extra };
        if (extra.level) ctx.level = extra.level;
        return fill(text, ctx);
    }

    /** The next line from one of a character's pools, not repeating until the pool is used up. */
    draw(id, pool, extra = {}) {
        const d = this.avatars.get(id) || {};
        const own = d[pool] || [];
        const lines = [...own, ...(pool in GENERIC && pool !== 'hi' ? GENERIC[pool].map((x) => ({ g: x })) : [])];
        if (!lines.length) return null;
        const f = this.friend(id) || { used: {} };
        f.used ||= {};
        let used = new Set(f.used[pool] || []);
        if (used.size >= lines.length) used = new Set();
        const ctx = { ...this.ctx(id), ...extra };
        // the character's own lines first, the shared ones only now and then
        const order = lines.map((l, i) => i).filter((i) => !used.has(i));
        order.sort((a, b) => (typeof lines[a] === 'object') - (typeof lines[b] === 'object') || Math.random() - 0.5);
        if (Math.random() < 0.18) order.reverse();
        for (const i of order) {
            const raw = typeof lines[i] === 'object' ? lines[i].g : lines[i];
            const x = fill(raw, ctx);
            if (x) {
                used.add(i);
                f.used[pool] = [...used];
                return x;
            }
        }
        return null;
    }

    // ----- composing a message from a character

    pendingQuestion(id) {
        const t = this.state.threads[id] || [];
        for (let i = t.length - 1; i >= 0; i--) {
            if (t[i].f === 'me') return null;
            if (t[i].q != null && !t[i].a) return t[i];
        }
        return null;
    }

    /** Something for a character to say out of the blue, chosen by what fits right now. */
    compose(id, kind = null) {
        if (id === GARDEN) return this.composeGarden(kind);
        const c = this.contact(id);
        const d = c.d || {};
        const ctx = this.ctx(id);
        const opts = [];
        const progress = (d.progress || []).some((x) => fill(x, ctx));
        if (progress) opts.push(['progress', 3]);
        if (ctx.idleMs != null && ctx.idleMs > 6 * HOUR) opts.push(['idle', ctx.idleMs > 2 * DAY ? 4 : 2]);
        opts.push(['chat', 4], ['tips', 2], ['nudge', 2]);
        if (d.questions?.length && !this.pendingQuestion(id)) opts.push(['question', 2]);
        if (this.friend(id) && Date.now() - this.friend(id).since > 3 * DAY && Math.random() < 0.08) opts.push(['since', 1]);
        if (!kind) {
            let total = opts.reduce((s, o) => s + o[1], 0);
            let r = Math.random() * total;
            kind = opts.find((o) => (r -= o[1]) < 0)?.[0] || 'chat';
        }
        if (kind === 'question') {
            const f = this.friend(id);
            const qs = d.questions || [];
            f.qi = ((f.qi ?? -1) + 1) % Math.max(1, qs.length);
            const q = qs[f.qi];
            if (q) return { x: this.fillFor(id, q.q) || q.q, k: 'question', q: f.qi };
            kind = 'chat';
        }
        const pool = kind === 'tips' ? 'tips' : kind === 'since' ? 'since' : kind;
        const x = pool === 'since' ? fill(pick(GENERIC.since), ctx) : this.draw(id, pool);
        if (!x) return this.compose(id, 'chat');
        const msg = { x, k: kind };
        if ((kind === 'nudge' || kind === 'idle' || kind === 'progress') && c.g) msg.play = c.g.id;
        return msg;
    }

    composeGarden(kind) {
        const mem = currentMem();
        const opts = [['chat', 3], ['tips', 1], ['suggest', 3]];
        const news = this.recentNews();
        if (news.length) opts.push(['news', 4]);
        if (mem?.met) {
            const unfound = PLACES.filter((p) => p.hint && !mem.places?.[p.id]);
            const found = PLACES.filter((p) => mem.places?.[p.id]);
            if (unfound.length) opts.push(['hint', 2]);
            if (found.length) opts.push(['memory', 2]);
            if (mem.full < 0.3) opts.push(['hungry', 5]);
        } else opts.push(['meet', 2]);
        if (!kind) {
            let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
            kind = opts.find((o) => (r -= o[1]) < 0)?.[0] || 'chat';
        }
        if (kind === 'news' && news.length) {
            const { g, isNew } = news[0];
            this.state.news[g.id] = g.version || '1';
            return { x: isNew ? `🆕 Fresh on the island: ${g.title}! ${excerpt(g.description, 110)}` : `🛠️ ${g.title} just got an update${g.version ? ` to v${g.version}` : ''}! Want to see what changed?`, k: 'news', play: g.id };
        }
        if (kind === 'suggest') {
            const played = new Set(this.store.recent.map((r) => r.id));
            const pool = this.all.filter((g) => !played.has(g.id));
            const g = pick(pool.length ? pool : this.all);
            const lead = pick(['Psst! Have you tried', 'Ooh, you should play', 'I flew past the statue of', 'Somebody on the island keeps talking about']);
            return { x: `${lead} ${g.title}? ${excerpt(g.description, 120)}`, k: 'suggest', play: g.id };
        }
        if (kind === 'hint' && mem?.met) {
            const p = pick(PLACES.filter((x) => x.hint && !mem.places?.[x.id]));
            return { x: `🗺️ A secret for you: ${p.hint}`, k: 'hint' };
        }
        if (kind === 'memory' && mem?.met) {
            const p = pick(PLACES.filter((x) => mem.places?.[x.id]));
            return { x: `Remember ${p.name}? ${p.about}`, k: 'memory', fly: `place:${p.id}`, flyLabel: p.name };
        }
        if (kind === 'hungry') return { x: pick(['My tummy is rumbling… could you bring me a snack? 🍯', 'I am SO hungry. A dewdrop would be lovely. Just saying. 🥺', 'Snack time? Pretty please? 🍓']), k: 'hungry', open: 'pet' };
        if (kind === 'meet') return { x: 'I live on the lamp at the end of the dock in the Garden of Games. Come and find me there, and I will remember your face forever! 🪽', k: 'meet', garden: true };
        return { x: this.draw(GARDEN, kind === 'tips' ? 'tips' : 'chat') || 'Hello from the island! 🪽', k: kind };
    }

    /** Games added or updated in the last ten days that the dragonfly hasn't told you about. */
    recentNews() {
        if (!this.updates) return [];
        const now = Date.now();
        return Object.entries(this.updates)
            .map(([id, u]) => ({ g: this.byId.get(id), t: Date.parse(u?.updated), isNew: u && u.added === u.updated }))
            .filter((x) => x.g && Number.isFinite(x.t) && now - x.t < 10 * DAY && this.state.news[x.g.id] !== (x.g.version || '1'))
            .sort((a, b) => b.t - a.t);
    }

    // ----- delivering

    /** Put a message from a character in their thread (and ping, unless it's quiet or you're reading it). */
    deliver(id, msg, { at = Date.now(), notify = true, read = false } = {}) {
        if (!msg?.x) return;
        const t = (this.state.threads[id] ||= []);
        const m = { f: 'them', t: at, ...msg };
        t.push(m);
        t.sort((a, b) => a.t - b.t);
        if (t.length > THREAD_MAX) t.splice(0, t.length - THREAD_MAX);
        const reading = this.app.top?.type === 'thread' && this.app.top.id === id && !document.hidden;
        if (!read && !reading) this.state.unread[id] = (this.state.unread[id] || 0) + 1;
        const f = this.friend(id);
        if (f) f.last = at;
        this.changed();
        if (reading) {
            this.app.top.received(m);
            sfx.pop?.();
        } else if (notify) this.notify(id, m);
    }

    /** I said something in a thread. */
    said(id, x, extra = {}) {
        const t = (this.state.threads[id] ||= []);
        t.push({ f: 'me', t: Date.now(), x, ...extra });
        if (t.length > THREAD_MAX) t.splice(0, t.length - THREAD_MAX);
        this.changed();
    }

    unreadTotal() {
        return Object.entries(this.state.unread).reduce((s, [id, n]) => s + (this.isFriend(id) ? n : 0), 0);
    }

    markRead(id) {
        if (!this.state.unread[id]) return;
        this.state.unread[id] = 0;
        this.changed();
    }

    /** Ping for the newest unread message (of one friend, or anyone): after a boot, or back from a game. */
    remind(only = null) {
        let best = null;
        for (const id of only ? [only] : this.friendIds()) {
            if (!this.state.unread[id]) continue;
            const t = this.state.threads[id] || [];
            for (let i = t.length - 1; i >= 0; i--) {
                if (t[i].f !== 'them') continue;
                if (!best || t[i].t > best.m.t) best = { id, m: t[i] };
                break;
            }
        }
        if (best) this.notify(best.id, best.m);
    }

    notify(id, m) {
        if (this.app.top?.type === 'thread' && this.app.top.id === id) return;
        this.app.notify?.({ id, name: this.contact(id).name, text: m.x, img: this.img(id, true), px: this.pixel(id) });
    }

    // ----- the clock: messages arrive while the console is open

    start() {
        if (this.started) return;
        this.started = true;
        const s = this.state;
        const now = Date.now();
        const first = !s.seen;
        if (!this.isFriend(GARDEN)) {
            s.friends[GARDEN] = { since: now, pts: 0, why: 'garden', used: {} };
            this.load(GARDEN).then((d) => {
                const lines = [d.request, ...(d.hello || [])].filter(Boolean);
                lines.forEach((x, i) => this.deliver(GARDEN, { x: this.fillFor(GARDEN, x) || x, k: 'hello' }, { at: now + i * 1000, notify: false }));
            });
        }
        this.loadAll(this.friendIds());
        this.syncPlayed({ quiet: first });
        if (!first && s.lastVisit && now - s.lastVisit > 2 * HOUR) this.catchUp(now - s.lastVisit);
        s.lastVisit = now;
        this.changed();
        this.schedule(first ? rnd(14, 26) : rnd(18, 40));
        addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.state.lastVisit = Date.now();
                this.save();
                return;
            }
            this.store.reload();
            this.syncPlayed();
            if (this.dueAt && Date.now() > this.dueAt) this.schedule(rnd(3, 8));
        });
        addEventListener('pageshow', (e) => {
            if (!e.persisted) return;
            this.syncPlayed();
            setTimeout(() => this.remind(), 900);
        });
        if (!first) setTimeout(() => this.remind(), 2600);
        addEventListener('storage', (e) => {
            if (e.key === MSG_KEY) {
                this.state = readState() || this.state;
                for (const fn of this.listeners) fn();
            }
        });
    }

    /** Every game in Recently Played is a friend (a new one says hello). */
    syncPlayed({ quiet = false } = {}) {
        const fresh = this.store.recent.filter((r) => !this.isFriend(r.id) && this.byId.has(r.id));
        fresh.forEach((r, i) => this.befriend(r.id, { why: 'played', quiet: quiet && i > 0, at: Math.min(Date.now(), r.t + 2000) }));
        if (fresh.length && !quiet) setTimeout(() => this.app.toast(`📒 ${fresh.length === 1 ? 'A new friend' : `${fresh.length} new friends`} in your address book`), 900);
    }

    /** Messages that "arrived" while you were away, dated in the gap. */
    catchUp(gap) {
        const ids = this.friendIds();
        if (!ids.length) return;
        const n = clamp(Math.floor(gap / (6 * HOUR)) + 1, 1, 3);
        const since = Date.now() - gap;
        this.loadAll(ids).then(() => {
            const times = Array.from({ length: n }, () => since + rnd(0.1, 0.95) * gap).sort((a, b) => a - b);
            let got = 0;
            for (const at of times) {
                const id = this.chooseSender();
                if (!id) continue;
                const m = this.compose(id);
                if (m) {
                    this.deliver(id, m, { at, notify: false });
                    got++;
                }
            }
            if (got) setTimeout(() => this.app.toast(`💬 ${got} new message${got === 1 ? '' : 's'} while you were away`), 2600);
        });
    }

    frequency() {
        return FREQ.find((f) => f[0] === this.state.freq) || FREQ[1];
    }

    schedule(sec) {
        clearTimeout(this.timer);
        const range = this.frequency()[2];
        if (!range) {
            this.dueAt = 0;
            return;
        }
        sec ??= rnd(range[0], range[1]);
        this.dueAt = Date.now() + sec * 1000;
        this.timer = setTimeout(() => this.tick(), sec * 1000);
    }

    /** The phone buzzes: a friend request rings, or a friend texts. */
    tick() {
        if (document.hidden || this.app.launching) return this.schedule(rnd(8, 15));
        const req = this.state.requests.find((r) => !this.ringed.has(r.id));
        if (req && this.canRing()) {
            this.ring(req.id);
            return this.schedule();
        }
        const id = this.chooseSender();
        if (id) {
            this.load(id).then(() => {
                const m = this.compose(id);
                if (m) this.typeThen(id, m);
            });
        }
        this.schedule();
    }

    /** If you're reading their thread, they type first. */
    typeThen(id, m) {
        const top = this.app.top;
        if (top?.type === 'thread' && top.id === id) {
            top.typing(true);
            setTimeout(() => {
                top.typing(false);
                this.deliver(id, m);
            }, rnd(900, 2000));
        } else this.deliver(id, m);
    }

    chooseSender() {
        const ids = this.friendIds();
        if (!ids.length) return null;
        const now = Date.now();
        const weights = ids.map((id) => {
            const f = this.friend(id);
            let w = 1;
            const since = now - (f.last || f.since || 0);
            w += clamp(since / (10 * 60 * 1000), 0, 3);
            const lp = this.lastPlayed(id);
            if (lp && now - lp < DAY) w += 1.5;
            if (lp && now - lp > 3 * DAY) w += 1;
            w += this.levelOf(id) * 0.4;
            if ((this.state.unread[id] || 0) >= 3) w *= 0.2;
            if (id === GARDEN) w *= ids.length > 4 ? 0.7 : 1.2;
            return w;
        });
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        return ids.find((id, i) => (r -= weights[i]) < 0) || ids[0];
    }

    // ----- new games, updates and friend requests

    /** js/updates.json has loaded: new games ring with a friend request, friends' updated games send the news. */
    gotUpdates(updates) {
        this.updates = updates || {};
        const s = this.state;
        const ids = this.all.map((g) => g.id);
        const now = Date.now();
        if (!s.seen) {
            s.seen = ids;
            // first visit: the newest game (if it's really new) says hello, so you meet the feature
            const newest = Object.entries(this.updates)
                .filter(([id, u]) => this.byId.has(id) && u && now - Date.parse(u.added) < 21 * DAY)
                .sort((a, b) => Date.parse(b[1].added) - Date.parse(a[1].added))[0];
            if (newest && !this.isFriend(newest[0])) this.request(newest[0], 'new');
        } else {
            const known = new Set(s.seen);
            const fresh = this.all.filter((g) => !known.has(g.id)).sort((a, b) => gameNo(b) - gameNo(a));
            fresh.slice(0, 3).forEach((g) => !this.isFriend(g.id) && this.request(g.id, 'new'));
            s.seen = ids;
        }
        // a friend's game changed version: they tell you, with a link
        for (const id of this.friendIds()) {
            const g = this.gameOf(id);
            const f = this.friend(id);
            if (!g || !g.version) continue;
            if (!f.ver) {
                f.ver = g.version;
                continue;
            }
            if (f.ver !== g.version) {
                f.ver = g.version;
                this.load(id).then((d) => {
                    const custom = d.updates?.[g.version];
                    const x = custom ? this.fillFor(id, custom) || custom : this.fillFor(id, d.update || 'Big news! {game} was just updated to v{version}! Come see what is new! 🛠️');
                    this.deliver(id, { x, k: 'update', play: id }, { at: Date.parse(this.updates[id]?.updated) || Date.now() });
                });
            }
        }
        this.changed();
        if (s.requests.length && this.frequency()[2]) this.tryRing(reduceMotion.matches ? 600 : 3800);
    }

    /** Ring for a waiting friend request as soon as the handheld is free (not booting, typing or busy). */
    tryRing(delay = 3000, tries = 12) {
        clearTimeout(this.ringT);
        this.ringT = setTimeout(() => {
            const req = this.state.requests.find((r) => !this.ringed.has(r.id));
            if (!req) return;
            if (this.canRing()) this.ring(req.id);
            else if (tries > 1) this.tryRing(3000, tries - 1);
        }, delay);
    }

    request(id, why) {
        if (this.isFriend(id) || this.state.requests.some((r) => r.id === id)) return;
        if (this.state.declined[id] && why !== 'played') return;
        this.state.requests.push({ id, t: Date.now(), why });
        this.load(id);
    }

    canRing() {
        const a = this.app;
        if (a.launching || a.busy || document.hidden) return false;
        if (document.getElementById('boot')) return false;
        const t = a.top?.type;
        // never over a chat you're in, a search you're typing or another call
        return t !== 'search' && t !== 'ring' && t !== 'name' && t !== 'thread';
    }

    /** The handheld shakes and rings like a phone: an incoming friend request. */
    ring(id) {
        this.ringed.add(id);
        this.load(id).then(() => this.app.push(new RingView(this.app, { m: this, id, ringing: true })));
    }

    accept(id) {
        const r = this.state.requests.find((x) => x.id === id);
        this.befriend(id, { why: r?.why || 'request' });
        this.grow(id, 5, 'answer');
        sfx.fav(true);
        this.app.toast(`📒 ${this.contact(id).name} added to your address book`);
    }

    decline(id) {
        this.state.requests = this.state.requests.filter((x) => x.id !== id);
        this.state.declined[id] = Date.now();
        this.changed();
    }

    // ----- you played a game

    onPlay(g) {
        if (!this.isFriend(g.id)) {
            this.befriend(g.id, { why: 'played', quiet: true });
            return;
        }
        // played after they nudged you: they noticed
        const t = this.state.threads[g.id] || [];
        const last = t[t.length - 1];
        this.grow(g.id, 6, 'play');
        if (last && last.f === 'them' && last.play === g.id && Date.now() - last.t < 2 * HOUR) {
            this.load(g.id).then(() => this.deliver(g.id, { x: this.fillFor(g.id, pick(GENERIC.played)), k: 'played' }, { at: Date.now() + 4000, notify: false }));
        }
        this.save();
    }

    // ----- talking back

    /** The quick replies offered under a thread. */
    replies(id) {
        const q = this.pendingQuestion(id);
        if (q) {
            const d = this.avatars.get(id) || {};
            const opts = d.questions?.[q.q]?.a || [];
            return opts.map((o, i) => ({ label: o[0], act: 'answer', i, q: q.q }));
        }
        const c = this.contact(id);
        const stats = id !== GARDEN && readSaveStats(c.d?.save);
        const out = [{ label: '👋 Hi!', act: 'hi' }];
        if (id === GARDEN) {
            out.push({ label: '🗞️ Any news?', act: 'news' }, { label: '🎲 Pick me a game', act: 'suggest' }, { label: '💡 A tip?', act: 'tip' }, { label: '🗺️ A secret?', act: 'hint' }, { label: '🪽 Come see me', act: 'visit' });
        } else {
            out.push({ label: '💡 Any tips?', act: 'tip' }, { label: '❓ How do I play?', act: 'how' });
            if (stats) out.push({ label: '📊 How am I doing?', act: 'progress' });
            out.push({ label: '🙂 Tell me about you', act: 'about' }, { label: '😄 Say something fun', act: 'chat' });
            if (c.d?.questions?.length) out.push({ label: '🎲 Ask me something', act: 'askme' });
            out.push({ label: `▶ Let's play!`, act: 'play' });
        }
        out.push({ label: '❤️ Send a heart', act: 'heart' }, { label: '👋 Bye!', act: 'bye' });
        return out;
    }

    /** You picked a quick reply or typed something: what they say back (and anything it does). */
    respond(id, act, extra = {}) {
        const c = this.contact(id);
        const d = c.d || {};
        const out = [];
        const say = (x, more = {}) => x && out.push({ x, ...more });
        switch (act) {
            case 'answer': {
                const opt = d.questions?.[extra.q]?.a?.[extra.i];
                const q = this.pendingQuestion(id);
                if (q) q.a = extra.i + 1;
                say(opt ? this.fillFor(id, opt[1]) || opt[1] : pick(GENERIC.heart));
                this.grow(id, 5, 'answer');
                break;
            }
            case 'hi': {
                const h = new Date().getHours();
                const tod = h < 5 ? 'You are up late!' : h < 12 ? 'Good morning!' : h < 18 ? 'Good afternoon!' : 'Good evening!';
                say(`${this.fillFor(id, pick(GENERIC.hi))} ${tod}`);
                const follow = this.compose(id, Math.random() < 0.5 && d.questions?.length && !this.pendingQuestion(id) ? 'question' : 'chat');
                if (follow) out.push(follow);
                break;
            }
            case 'howareyou':
                say(this.fillFor(id, pick(GENERIC.howareyou)));
                break;
            case 'tip':
                say(id === GARDEN ? this.draw(id, 'tips') : this.draw(id, 'tips') || this.fillFor(id, d.how || pick(GENERIC.confused)));
                break;
            case 'how':
                say(d.how ? this.fillFor(id, d.how) || d.how : this.fillFor(id, pick(GENERIC.confused)));
                break;
            case 'about':
                say(d.about ? this.fillFor(id, d.about) || d.about : d.bio);
                break;
            case 'chat':
                say(this.draw(id, 'chat'));
                break;
            case 'askme': {
                const m = this.compose(id, 'question');
                if (m) out.push(m);
                break;
            }
            case 'progress': {
                const x = this.draw(id, 'progress');
                if (x) say(x, c.g ? { play: c.g.id } : {});
                else {
                    const ctx = this.ctx(id);
                    say(ctx.ago ? `You last played ${ctx.game} ${ctx.ago} ago. ${this.draw(id, 'nudge') || ''}` : this.fillFor(id, pick(GENERIC.noProgress)), c.g ? { play: c.g.id } : {});
                }
                break;
            }
            case 'play':
                say(this.draw(id, 'nudge') || `Let's go! ▶`, { play: c.g?.id, autoplay: true });
                break;
            case 'heart':
                say(this.fillFor(id, pick(GENERIC.heart)));
                this.grow(id, 3, 'heart');
                break;
            case 'thanks':
                say(this.fillFor(id, pick(GENERIC.thanks)));
                break;
            case 'bye':
                say(this.draw(id, 'bye') || this.fillFor(id, pick(GENERIC.bye)));
                break;
            case 'news': {
                const m = this.recentNews().length ? this.composeGarden('news') : { x: 'No big news since we last talked. Want me to pick a game for you instead? 🎲' };
                out.push(m);
                break;
            }
            case 'suggest':
                out.push(this.composeGarden('suggest'));
                break;
            case 'hint': {
                const mem = currentMem();
                out.push(mem?.met ? this.composeGarden(PLACES.some((p) => p.hint && !mem.places?.[p.id]) ? 'hint' : 'memory') : this.composeGarden('meet'));
                break;
            }
            case 'visit':
                say(currentMem()?.met ? 'Yay! Opening my little pond… 🪽' : 'I am waiting on the dock lamp in the Garden! Come and find me. 🪽', currentMem()?.met ? { open: 'pet', autoopen: true } : { garden: true });
                break;
            default:
                say(this.fillFor(id, pick(GENERIC.confused)));
        }
        if (act !== 'answer' && act !== 'heart') this.grow(id, 2, 'talk');
        return out.filter((m) => m && m.x);
    }

    /** Free text: guess what you meant. */
    intent(id, text) {
        const t = text.toLowerCase();
        const q = this.pendingQuestion(id);
        if (q) {
            const opts = this.avatars.get(id)?.questions?.[q.q]?.a || [];
            const i = opts.findIndex((o) => {
                const w = o[0].toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
                return w && (t.includes(w) || w.includes(t.trim()));
            });
            if (i >= 0) return { act: 'answer', i, q: q.q };
        }
        const rules = [
            ['how', /\b(how (do|to|does)|controls?|instructions|rules|what do i do)\b/],
            ['progress', /\b(score|level|progress|how am i|stats?|gold|best|record|doing)\b/],
            ['about', /\b(who are you|about you|yourself|your name|what are you)\b/],
            ['howareyou', /\b(how are you|how r u|how's it going|hows it going|you ok)\b/],
            ['tip', /\b(tips?|hints?|advice|help|stuck|tricks?)\b/],
            ['news', /\b(news|new games?|updates?|what'?s new)\b/],
            ['suggest', /\b(suggest|recommend|pick (me )?a game|what should i play|bored)\b/],
            ['play', /\b(let'?s play|play|launch|start)\b/],
            ['bye', /\b(bye|goodbye|cya|see ya|later|good ?night|gtg)\b/],
            ['hi', /\b(hi|hello|hey|yo|howdy|hiya|sup|morning|evening)\b/],
            ['thanks', /\b(thanks?|thank you|thx|ty)\b/],
            ['heart', /(❤|♥|<3|💖|💕|\blove\b|\bawesome\b|\bcool\b|\bnice\b|\bcute\b)/],
            ['chat', /\b(joke|funny|what'?s up|tell me something|chat)\b/],
        ];
        for (const [act, re] of rules) {
            if (!re.test(t)) continue;
            if (id === GARDEN && (act === 'how' || act === 'progress' || act === 'play')) return { act: act === 'play' ? 'suggest' : 'tip' };
            if (id !== GARDEN && (act === 'news' || act === 'suggest')) return { act: 'chat' };
            return { act };
        }
        return { act: 'confused' };
    }

    // ----- settings

    setName(name) {
        this.state.me = String(name || '')
            .replace(/[^\p{L}\p{N} '\-]/gu, '')
            .trim()
            .slice(0, 16);
        this.changed();
    }

    setFreq(id) {
        this.state.freq = id;
        this.changed();
        this.schedule();
    }

    clearAll() {
        const keep = { me: this.state.me, freq: this.state.freq, seen: this.state.seen };
        this.state = { ...freshState(), ...keep };
        this.started = false;
        this.changed();
        this.start();
    }
}

// ================================================================ screens

/** The Messages menu: friend requests, the address book, then every conversation, newest first. */
export class MessagesView extends ListView {
    constructor(app, { m }) {
        super(app, { title: 'Messages', preview: 'hero', cls: 'v-msgs' });
        this.m = m;
        this.getItems = () => this.list();
        this.empty = '<p>Loading…</p>';
    }

    list() {
        const m = this.m;
        const s = m.state;
        const items = [];
        if (s.requests.length) {
            const r = s.requests[s.requests.length - 1];
            items.push({
                label: 'Friend requests',
                icon: ICONS.ring,
                meta: s.requests.length,
                subHTML: esc(`${m.contact(r.id).name} wants to be friends`),
                hero: { glyph: m.avatarHTML(r.id, { tiny: false, cls: 'big' }), caption: 'Someone new wants to say hi' },
                action: () => this.app.push(new RequestsView(this.app, { m })),
            });
        }
        const ids = m.friendIds().sort((a, b) => (m.friend(b).last || 0) - (m.friend(a).last || 0));
        items.push({
            label: 'Address Book',
            icon: ICONS.book,
            meta: ids.length,
            hero: { glyph: ICONS.book, caption: `${ids.length} friend${ids.length === 1 ? '' : 's'} · play a game to meet its character` },
            action: () => this.app.push(new AddressBookView(this.app, { m })),
        });
        for (const id of ids) {
            const t = s.threads[id] || [];
            const last = t[t.length - 1];
            const c = m.contact(id);
            const un = s.unread[id] || 0;
            items.push({
                id,
                labelHTML: `${esc(c.name)}${un ? ` <span class="unread">${un}</span>` : ''}`,
                say: `${c.name}${un ? `, ${un} unread` : ''}. ${last ? last.x : ''}`,
                icon: m.avatarHTML(id),
                subHTML: last ? esc(`${last.f === 'me' ? 'You: ' : ''}${last.x}`) : esc(c.role),
                meta: last ? timeAgo(last.t) : '',
                accent: c.color,
                cls: un ? 'has-unread' : '',
                hero: { glyph: m.avatarHTML(id, { tiny: false, cls: 'big' }), caption: `${c.role}${c.g ? ` · ${c.g.title}` : ''}` },
                action: () => openThread(this.app, m, id),
            });
        }
        return items;
    }

    rowHTML(it, i) {
        return super.rowHTML(it, i).replace('class="row', `class="row ${it.cls || ''} ${it.id ? 'contact' : ''}`);
    }

    build() {
        super.build();
        this.off = this.m.on(() => this.app.top === this && this.refresh());
        this.m.loadAll(this.m.friendIds()).then(() => this.app.top === this && this.refresh());
    }

    refresh() {
        const keep = this.items[this.index]?.id;
        this.items = this.list();
        if (keep) {
            const i = this.items.findIndex((x) => x.id === keep);
            if (i >= 0) this.index = i;
        }
        this.heroItem = null;
        this.renderRows();
    }

    destroy() {
        this.off?.();
        super.destroy();
    }

    statusTitle() {
        const n = this.m.unreadTotal();
        return n ? `Messages · ${n}` : 'Messages';
    }
}

/** Everyone you've met, A to Z, with your friendship hearts. */
class AddressBookView extends ListView {
    constructor(app, { m }) {
        super(app, { title: 'Address Book', preview: 'hero', cls: 'v-msgs' });
        this.m = m;
        this.getItems = () => this.list();
    }
    list() {
        const m = this.m;
        const ids = m.friendIds().sort((a, b) => (a === GARDEN ? -1 : b === GARDEN ? 1 : m.contact(a).name.localeCompare(m.contact(b).name)));
        const items = ids.map((id) => {
            const c = m.contact(id);
            const lvl = LEVELS[m.levelOf(id)][1];
            return {
                id,
                label: c.name,
                say: `${c.name}, ${c.role}${c.g ? `, from ${c.g.title}` : ''}. ${lvl}`,
                icon: m.avatarHTML(id),
                subHTML: esc(`${c.role}${c.g ? ` · ${c.g.title}` : ''}`),
                meta: m.hearts(id),
                accent: c.color,
                hero: { glyph: m.avatarHTML(id, { tiny: false, cls: 'big' }), caption: `${lvl}${c.d?.bio ? ` · ${c.d.bio}` : ''}` },
                action: () => this.app.push(new ProfileView(this.app, { m, id })),
            };
        });
        const left = m.all.length - ids.filter((x) => x !== GARDEN).length;
        if (left > 0)
            items.push({
                label: `${left} more to meet`,
                icon: ICONS.person,
                chev: false,
                subHTML: 'Play a game and its character joins your address book',
                hero: { glyph: ICONS.person, caption: 'Every game has a friend waiting' },
                action: () => this.app.toast('▶ Play any game to meet its character'),
            });
        return items;
    }
    build() {
        super.build();
        this.m.loadAll(this.m.friendIds()).then(() => this.app.top === this && this.refresh());
    }
}

/** A friend's card: who they are, how close you are, and ways to reach them. */
class ProfileView extends View {
    constructor(app, { m, id }) {
        super(app, 'Profile');
        this.m = m;
        this.id = id;
        this.act = 0;
    }
    get type() {
        return 'profile';
    }
    statusTitle() {
        return this.m.contact(this.id).name;
    }
    actions() {
        const c = this.m.contact(this.id);
        return [
            { id: 'msg', icon: ICONS.chat, label: 'Message' },
            c.g ? { id: 'play', icon: ICONS.play, label: `Play ${c.g.title}` } : { id: 'pet', icon: ICONS.dragonfly, label: 'Visit on the Dragonfly screen' },
            c.g ? { id: 'cart', icon: ICONS.cover, label: 'Open its cartridge' } : null,
        ].filter(Boolean);
    }
    build() {
        const { m, id } = this;
        const c = m.contact(id);
        const f = m.friend(id);
        const lvl = m.levelOf(id);
        const next = LEVELS[lvl + 1];
        const pct = next ? Math.round((100 * ((f?.pts || 0) - LEVELS[lvl][0])) / (next[0] - LEVELS[lvl][0])) : 100;
        this.el.style.setProperty('--accent', c.color);
        this.el.innerHTML = `
            <div class="pf-scroll">
                <div class="pf-card">
                    ${m.avatarHTML(id, { tiny: false, cls: 'huge' })}
                    <div class="pf-who">
                        <p class="pf-kicker">${esc(c.emoji)} ${esc(c.role)}</p>
                        <h2>${esc(c.name)}</h2>
                        <p class="pf-game">${c.g ? esc(c.g.title) : 'The Garden of Games'}</p>
                    </div>
                </div>
                <p class="pf-bio">${esc(c.d?.bio || '')}</p>
                <div class="pf-friend" aria-label="Friendship: ${esc(LEVELS[lvl][1])}">
                    <span class="pf-hearts">${m.hearts(id)}</span>
                    <span class="pf-lvl">${esc(LEVELS[lvl][1])}</span>
                    <span class="pf-bar"><i style="width:${clamp(pct, 0, 100)}%"></i></span>
                    <span class="pf-next">${next ? `Next: ${esc(next[1])}` : 'Best friends forever'}</span>
                </div>
                <div class="d-actions" role="listbox" aria-label="Actions">${this.actions()
                    .map((a, i) => `<button type="button" class="row menu act" data-act="${a.id}" role="option" id="p${this.id}-${i}" tabindex="-1"><span class="r-icon">${a.icon}</span><span class="r-body"><span class="r-label"><span class="r-text">${esc(a.label)}</span></span></span></button>`)
                    .join('')}</div>
                <p class="pf-since">Friends since ${esc(new Date(f?.since || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</p>
            </div>`;
        this.sel(0);
        this.el.addEventListener('click', (e) => {
            const a = e.target.closest('[data-act]');
            if (!a) return;
            this.sel([...this.el.querySelectorAll('.act')].indexOf(a));
            this.app.feedback();
            this.run(a.dataset.act);
        });
    }
    sel(i) {
        const acts = [...this.el.querySelectorAll('.act')];
        this.act = clamp(i, 0, acts.length - 1);
        acts.forEach((a, k) => a.classList.toggle('sel', k === this.act));
    }
    run(act) {
        const c = this.m.contact(this.id);
        if (act === 'msg') openThread(this.app, this.m, this.id);
        else if (act === 'play') this.app.play(c.g);
        else if (act === 'cart') this.app.openGame([c.g], 0);
        else if (act === 'pet') this.app.openPet();
    }
    onTick(d) {
        const n = this.el.querySelectorAll('.act').length;
        const i = clamp(this.act + d, 0, n - 1);
        if (i === this.act) {
            this.app.bump(this.el.querySelector('.d-actions'), d);
            return false;
        }
        this.sel(i);
        this.app.say(this.el.querySelectorAll('.act')[i].textContent.trim());
        return true;
    }
    onSelect() {
        this.run(this.el.querySelectorAll('.act')[this.act]?.dataset.act);
    }
    onPlay() {
        const c = this.m.contact(this.id);
        if (c.g) this.app.play(c.g);
        else this.app.deny();
    }
    currentGame() {
        return this.m.contact(this.id).g;
    }
    shown() {
        const g = this.currentGame();
        if (g) this.app.focusGame(g);
    }
}

/** Pending friend requests (the ones you put off). */
class RequestsView extends ListView {
    constructor(app, { m }) {
        super(app, { title: 'Requests', preview: 'hero', cls: 'v-msgs' });
        this.m = m;
        this.getItems = () =>
            [...m.state.requests].reverse().map((r) => {
                const c = m.contact(r.id);
                return {
                    id: r.id,
                    label: c.name,
                    icon: m.avatarHTML(r.id),
                    subHTML: esc(`${r.why === 'new' ? '🆕 New game · ' : ''}${c.g ? c.g.title : ''}`),
                    meta: timeAgo(r.t),
                    accent: c.color,
                    hero: { glyph: m.avatarHTML(r.id, { tiny: false, cls: 'big' }), caption: c.d?.request || '' },
                    action: () => m.load(r.id).then(() => this.app.push(new RingView(this.app, { m, id: r.id, ringing: false }))),
                };
            });
        this.empty = `<div class="empty-art">${ICONS.ring}</div><p><b>No requests right now.</b></p><p>When a new game arrives, its character calls you.</p>`;
    }
    build() {
        super.build();
        this.off = this.m.on(() => this.app.top === this && this.refresh());
        this.m.loadAll(this.m.state.requests.map((r) => r.id)).then(() => this.app.top === this && this.refresh());
    }
    destroy() {
        this.off?.();
        super.destroy();
    }
}

/** An incoming friend request, like a call on a phone: the handheld shakes and rings. */
export class RingView extends View {
    constructor(app, { m, id, ringing = true }) {
        super(app, 'Friend request');
        this.m = m;
        this.id = id;
        this.ringing = ringing;
        this.choice = 0;
    }
    get type() {
        return 'ring';
    }
    statusTitle() {
        return this.ringing ? 'Incoming…' : 'Friend request';
    }
    build() {
        const { m, id } = this;
        const c = m.contact(id);
        const r = m.state.requests.find((x) => x.id === id);
        const gen = c.g ? genreOf(c.g) : null;
        this.el.style.setProperty('--accent', c.color);
        this.el.innerHTML = `
            <div class="rg-wrap${this.ringing ? ' ringing' : ''}">
                <p class="rg-kicker">${r?.why === 'new' ? '🆕 New in the Pocket Garden' : '📳 Friend request'}</p>
                <div class="rg-face"><span class="rg-wave"></span><span class="rg-wave"></span>${m.avatarHTML(id, { tiny: false, cls: 'huge' })}</div>
                <h2 class="rg-name">${esc(c.name)}</h2>
                <p class="rg-from">${esc(c.role)}${c.g ? ` · ${gen.emoji} ${esc(c.g.title)}` : ''}</p>
                <p class="rg-say">“${esc(m.fillFor(id, c.d?.request || 'Hi! Friends?') || c.d?.request || '')}”</p>
                <div class="rg-btns" role="group" aria-label="Answer">
                    <button type="button" class="rg-btn yes" data-a="yes">✓ Accept</button>
                    <button type="button" class="rg-btn no" data-a="no">✕ Not now</button>
                </div>
            </div>`;
        this.el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-a]');
            if (!b) return;
            this.app.feedback();
            this.answer(b.dataset.a === 'yes');
        });
        this.mark();
        if (this.ringing) this.startRing();
    }
    startRing() {
        const app = this.app;
        app.device.classList.add('ringing');
        let n = 0;
        const buzz = () => {
            if (!this.ringing) return;
            sfx.ring?.();
            // a phone buzzes in your hand: only on a touch screen, and only once the page has been touched
            if (app.store.settings.haptics && navigator.vibrate && navigator.userActivation?.hasBeenActive && matchMedia('(pointer: coarse)').matches) {
                try {
                    navigator.vibrate([180, 90, 180]);
                } catch {
                    /* not allowed */
                }
            }
            if (++n < 4) this.ringT = setTimeout(buzz, 1500);
            else this.stopRing();
        };
        buzz();
        app.say(`Incoming friend request from ${this.m.contact(this.id).name}`);
    }
    stopRing() {
        this.ringing = false;
        clearTimeout(this.ringT);
        this.app.device.classList.remove('ringing');
        this.el.querySelector('.rg-wrap')?.classList.remove('ringing');
        this.app.updateStatus();
    }
    mark() {
        this.el.querySelectorAll('.rg-btn').forEach((b, i) => b.classList.toggle('sel', i === this.choice));
    }
    answer(yes) {
        this.stopRing();
        const { m, id, app } = this;
        app.back();
        if (yes) {
            m.accept(id);
            setTimeout(() => openThread(app, m, id), 320);
        } else app.toast('Saved in Messages → Friend requests');
    }
    onTick(d) {
        const c = clamp(this.choice + d, 0, 1);
        if (c === this.choice) return false;
        this.choice = c;
        this.mark();
        this.app.say(c ? 'Not now' : 'Accept');
        return true;
    }
    onSelect() {
        this.answer(this.choice === 0);
    }
    onPlay() {
        this.answer(true);
    }
    onPrev() {
        this.onTick(-1);
    }
    onNext() {
        this.onTick(1);
    }
    onBack() {
        this.stopRing();
        return false;
    }
    hidden() {
        this.stopRing();
    }
    currentGame() {
        return this.m.contact(this.id).g;
    }
    shown() {
        const g = this.currentGame();
        if (g) this.app.focusGame(g);
    }
}

/** Open a conversation (replacing one that's already open). */
export function openThread(app, m, id) {
    m.load(id).then(() => {
        if (app.top?.type === 'thread' && app.top.id === id) return;
        app.push(new ThreadView(app, { m, id }));
    });
}

/** One conversation: bubbles, a typing indicator, quick replies and a box to type in. */
export class ThreadView extends View {
    constructor(app, { m, id }) {
        super(app, 'Chat');
        this.m = m;
        this.id = id;
        this.ri = 0;
        this.acceptsTyping = true;
    }
    get type() {
        return 'thread';
    }
    statusTitle() {
        return this.m.contact(this.id).name;
    }
    currentGame() {
        return this.m.contact(this.id).g;
    }
    build() {
        const { m, id } = this;
        const c = m.contact(id);
        this.el.style.setProperty('--accent', c.color);
        this.el.innerHTML = `
            <header class="th-head">
                <button type="button" class="th-who" data-profile>${m.avatarHTML(id, { tiny: false })}<span class="th-names"><b>${esc(c.name)}</b><small>${esc(c.role)} · <span class="th-hearts">${m.hearts(id)}</span></small></span></button>
                ${c.g ? `<button type="button" class="th-play" data-play="${esc(c.g.id)}" aria-label="Play ${esc(c.g.title)}">▶</button>` : ''}
            </header>
            <div class="th-log" role="log" aria-live="polite" aria-label="Conversation with ${esc(c.name)}"></div>
            <div class="th-replies" role="listbox" aria-label="Quick replies"></div>
            <form class="th-compose" autocomplete="off">
                <input class="th-input" type="text" maxlength="140" placeholder="Say something to ${esc(c.name)}…" enterkeyhint="send" aria-label="Message">
                <button type="submit" class="th-send" aria-label="Send">➤</button>
            </form>`;
        this.log = this.el.querySelector('.th-log');
        this.rep = this.el.querySelector('.th-replies');
        this.input = this.el.querySelector('.th-input');
        this.renderLog();
        this.renderReplies();
        m.markRead(id);
        this.el.addEventListener('click', (e) => this.click(e));
        this.el.querySelector('.th-compose').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendText();
        });
        this.off = m.on(() => {
            if (this.app.top === this) m.markRead(id);
        });
    }
    click(e) {
        if (this.app.swiped) return;
        const p = e.target.closest('[data-play]');
        if (p) {
            const g = this.m.byId.get(p.dataset.play);
            if (g) {
                this.app.feedback('press');
                this.app.play(g);
            }
            return;
        }
        const fly = e.target.closest('[data-fly]');
        if (fly) {
            this.app.feedback('press');
            return flyTo(this.app, fly.dataset.fly, fly.dataset.label || 'the island');
        }
        const o = e.target.closest('[data-open]');
        if (o) {
            this.app.feedback('press');
            if (o.dataset.open === 'pet') this.app.openPet();
            else if (o.dataset.open === 'garden') location.assign('../index.html');
            return;
        }
        if (e.target.closest('[data-profile]')) {
            this.app.feedback();
            return this.app.push(new ProfileView(this.app, { m: this.m, id: this.id }));
        }
        const r = e.target.closest('.chip');
        if (r) {
            this.ri = +r.dataset.i;
            this.app.feedback();
            this.sendReply(this.ri);
        }
    }

    bubbleHTML(msg, prev) {
        const me = msg.f === 'me';
        const gap = !prev || msg.t - prev.t > 45 * 60 * 1000;
        const stamp = gap ? `<p class="th-time">${esc(timeLabel(msg.t))}</p>` : '';
        const g = msg.play ? this.m.byId.get(msg.play) : null;
        const acts = [
            g ? `<button type="button" class="b-act" data-play="${esc(g.id)}">▶ Play ${esc(g.title)}</button>` : '',
            msg.fly ? `<button type="button" class="b-act" data-fly="${esc(msg.fly)}" data-label="${esc(msg.flyLabel || '')}">🪽 Fly there</button>` : '',
            msg.open === 'pet' ? `<button type="button" class="b-act" data-open="pet">🍯 Open my pond</button>` : '',
            msg.garden ? `<button type="button" class="b-act" data-open="garden">🌿 Walk the Garden</button>` : '',
        ].join('');
        const lead = !me && (!prev || prev.f === 'me' || gap) ? this.m.avatarHTML(this.id) : '<i class="av-sp"></i>';
        return `${stamp}<div class="b ${me ? 'me' : 'them'}${msg.k === 'level' ? ' party' : ''}">${me ? '' : lead}<p class="b-x">${esc(msg.x)}${acts ? `<span class="b-acts">${acts}</span>` : ''}</p></div>`;
    }

    renderLog() {
        const t = this.m.state.threads[this.id] || [];
        this.log.innerHTML = t.map((msg, i) => this.bubbleHTML(msg, t[i - 1])).join('') || `<p class="th-empty">Say hi to ${esc(this.m.contact(this.id).name)}!</p>`;
        this.scrollEnd(false);
    }

    received(msg) {
        const t = this.m.state.threads[this.id] || [];
        const i = t.indexOf(msg);
        this.log.querySelector('.th-empty')?.remove();
        this.log.insertAdjacentHTML('beforeend', this.bubbleHTML(msg, t[i - 1]));
        this.log.lastElementChild?.classList.add('in');
        this.scrollEnd(true);
        this.renderReplies();
        this.el.querySelector('.th-hearts').textContent = this.m.hearts(this.id);
        this.app.say(`${this.m.contact(this.id).name}: ${msg.x}`);
        if (msg.autoplay && msg.play) {
            const g = this.m.byId.get(msg.play);
            if (g) setTimeout(() => this.app.top === this && this.app.play(g), 1100);
        }
        if (msg.autoopen && msg.open === 'pet') setTimeout(() => this.app.top === this && this.app.openPet(), 1000);
    }

    scrollEnd(smooth) {
        requestAnimationFrame(() => this.log.scrollTo({ top: this.log.scrollHeight, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' }));
    }

    typing(on) {
        this.log.querySelector('.b.typing')?.remove();
        if (on) {
            this.log.insertAdjacentHTML('beforeend', `<div class="b them typing" aria-label="typing">${this.m.avatarHTML(this.id)}<p class="b-x"><i></i><i></i><i></i></p></div>`);
            this.scrollEnd(true);
        }
    }

    renderReplies() {
        this.replies = this.m.replies(this.id);
        this.ri = clamp(this.ri, 0, this.replies.length - 1);
        const q = this.replies[0]?.act === 'answer';
        this.rep.classList.toggle('answering', q);
        this.rep.innerHTML = this.replies.map((r, i) => `<button type="button" class="chip${i === this.ri ? ' sel' : ''}" data-i="${i}" role="option" tabindex="-1" aria-selected="${i === this.ri}">${esc(r.label)}</button>`).join('');
        this.showChip(false);
    }

    showChip(smooth = true) {
        const chips = this.rep.children;
        [...chips].forEach((c, i) => {
            c.classList.toggle('sel', i === this.ri);
            c.setAttribute('aria-selected', String(i === this.ri));
        });
        const c = chips[this.ri];
        if (c) {
            const left = c.offsetLeft - this.rep.clientWidth / 2 + c.offsetWidth / 2;
            this.rep.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
        }
    }

    /** You said something; after a moment, they answer (each reply typed out in turn). */
    exchange(text, act) {
        if (this.busy) return;
        this.busy = true;
        this.m.said(this.id, text);
        this.log.querySelector('.th-empty')?.remove();
        const t = this.m.state.threads[this.id];
        this.log.insertAdjacentHTML('beforeend', this.bubbleHTML(t[t.length - 1], t[t.length - 2]));
        this.log.lastElementChild?.classList.add('in');
        this.scrollEnd(true);
        sfx.send?.();
        const replies = this.m.respond(this.id, act.act, act);
        this.renderReplies();
        let i = 0;
        const next = () => {
            if (i >= replies.length || this.app.top !== this) {
                this.busy = false;
                this.typing(false);
                return;
            }
            this.typing(true);
            const m = replies[i++];
            setTimeout(
                () => {
                    this.typing(false);
                    this.m.deliver(this.id, m, { notify: false });
                    setTimeout(next, 350);
                },
                reduceMotion.matches ? 250 : clamp(500 + m.x.length * 18, 700, 2200),
            );
        };
        setTimeout(next, 350);
    }

    sendReply(i) {
        const r = this.replies[i];
        if (!r) return this.app.deny();
        this.exchange(r.label, r);
    }

    sendText() {
        const v = this.input.value.trim();
        if (!v) return this.app.deny();
        this.input.value = '';
        this.exchange(v, this.m.intent(this.id, v));
    }

    typingFocus() {
        return document.activeElement === this.input;
    }

    typeChar(ch) {
        this.input.focus({ preventScroll: true });
        this.input.value += ch;
    }

    enterFromInput() {
        this.sendText();
    }

    onTick(d) {
        const n = this.replies.length;
        const i = clamp(this.ri + d, 0, n - 1);
        if (i === this.ri) {
            this.app.bump(this.rep, d);
            return false;
        }
        this.ri = i;
        this.showChip();
        this.app.say(this.replies[i].label);
        return true;
    }
    onSelect() {
        this.sendReply(this.ri);
    }
    onPrev() {
        this.log.scrollBy({ top: -this.log.clientHeight * 0.7, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
    onNext() {
        this.log.scrollBy({ top: this.log.clientHeight * 0.7, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
    onPlay() {
        const g = this.currentGame();
        if (g) this.app.play(g);
        else this.app.openPet();
    }
    onHold() {
        this.exchange('❤️', { act: 'heart' });
    }
    onHome() {
        this.log.scrollTop = 0;
    }
    onEnd() {
        this.scrollEnd(true);
    }
    refresh() {
        this.renderLog();
        this.renderReplies();
        this.m.markRead(this.id);
    }
    shown() {
        this.m.markRead(this.id);
        this.app.updateStatus();
        const g = this.currentGame();
        if (g) this.app.focusGame(g);
    }
    destroy() {
        this.off?.();
        super.destroy();
    }
}

function timeLabel(t) {
    const d = new Date(t);
    const now = new Date();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today ${time}`;
    const y = new Date(now - DAY);
    if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
    return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

/** Type the name your friends call you. */
export class NameView extends View {
    constructor(app, { m }) {
        super(app, 'Your name');
        this.m = m;
        this.acceptsTyping = true;
    }
    get type() {
        return 'name';
    }
    build() {
        this.el.innerHTML = `
            <form class="nm-wrap" autocomplete="off">
                <p class="nm-lead">What should your friends call you?</p>
                <input class="th-input nm-input" maxlength="16" placeholder="friend" value="${esc(this.m.state.me)}" aria-label="Your name" enterkeyhint="done">
                <button type="submit" class="rg-btn yes sel">Save</button>
                <p class="nm-hint">They'll use it in their messages. Leave it empty to be “friend”.</p>
            </form>`;
        this.input = this.el.querySelector('input');
        this.el.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.done();
        });
    }
    shown() {
        this.input.focus({ preventScroll: true });
    }
    done() {
        this.m.setName(this.input.value);
        this.app.toast(this.m.state.me ? `👋 Hi, ${this.m.state.me}!` : 'Your friends will call you “friend”');
        this.app.back();
    }
    typeChar(ch) {
        this.input.focus();
        this.input.value += ch;
    }
    enterFromInput() {
        this.done();
    }
    onSelect() {
        this.done();
    }
}
