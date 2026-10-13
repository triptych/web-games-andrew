// The meta-game's save: mode, chapter, quests, achievements, Ink, rank,
// Emporium purchases, lifetime stats and Atelier settings, plus has(feature):
// what the apprentice may use right now.
import { bus } from '../editor/bus.js';

const KEY = 'talewright.meta.v1';

// What each chapter restores. A feature not listed here is always available.
export const GRANTS = [
    /* 0 The Blank Page */ ['tool.pencil', 'tool.eraser', 'layer.decor', 'start', 'playtest', 'tileset.meadow'],
    /* 1 Words */          ['events', 'cmd.text', 'cmd.comment', 'tpl.npc', 'tpl.sign', 'sprites.villagers'],
    /* 2 Things */         ['db', 'db.items', 'cmd.item', 'cmd.gold', 'cmd.self', 'pages', 'tool.rect', 'tool.fill', 'tileset.village', 'tpl.chest', 'objects'],
    /* 3 Places */         ['maps.many', 'cmd.transfer', 'cmd.erase', 'tpl.door', 'mapprops', 'layer.over', 'tool.picker', 'tileset.interior'],
    /* 4 Choices */        ['cmd.choice', 'cmd.switch', 'cmd.var', 'cmd.if', 'cmd.wait', 'conditions', 'db.switches'],
    /* 5 Conflict */       ['db.actors', 'db.enemies', 'db.skills', 'db.troops', 'cmd.battle', 'cmd.heal', 'encounters', 'tileset.dungeon', 'tpl.monster', 'tpl.spring'],
    /* 6 Commerce */       ['cmd.shop', 'cmd.party', 'cmd.exp', 'tpl.shop', 'tpl.inn', 'tpl.save', 'equipment', 'tileset.castle'],
    /* 7 Living World */   ['trigger.auto', 'movement', 'cmd.route', 'cmd.fadeout', 'cmd.fadein', 'cmd.flash', 'cmd.shake', 'cmd.tint', 'cmd.sfx', 'cmd.bgm', 'mapmusic', 'forge', 'tileset.snow'],
    /* 8 Worldbook */      ['export', 'db.system', 'cmd.gameover', 'cmd.end', 'tileset.desert'],
    /* 9 Epilogue */       ['tileset.sky'],
];
export const FEATURE_CHAPTER = {};
GRANTS.forEach((list, ch) => list.forEach((f) => { FEATURE_CHAPTER[f] = ch; }));

export const RANKS = [
    [0, 'Blank Page'], [30, 'Doodler'], [80, 'Scribbler'], [150, 'Sketcher'], [250, 'Drafter'], [380, 'Storyteller'], [550, 'Mapmaker'],
    [760, 'Tilesmith'], [1000, 'Eventsmith'], [1300, 'Lorekeeper'], [1650, 'Questgiver'], [2050, 'Dungeonwright'], [2500, 'Worldweaver'],
    [3000, 'Bard'], [3600, 'Chronicler'], [4300, 'Mythmaker'], [5100, 'Loremaster'], [6000, 'Archmage of Ink'], [7200, 'Grand Talewright'], [9000, 'Worldsmith'],
];

export function defaults() {
    return {
        v: 1, mode: null, chapter: 0, done: false,
        seen: [], quests: {}, achievements: {}, ink: 0, inkEarned: 0, owned: {},
        stats: { painted: 0, erased: 0, fills: 0, events: 0, commands: 0, playtests: 0, maps: 0, db: 0, forged: 0, undos: 0, exports: 0, downloads: 0, imports: 0, bought: 0, texts: 0, battlesWon: 0, battlesLost: 0, shopBuys: 0, levelUps: 0, endings: 0, chests: 0, transfers: 0, choices: 0, saves: 0, minutes: 0 },
        flags: {},
        settings: { theme: 'default', sound: true, music: true, volume: 0.6, reduceMotion: false, mentor: true },
        lastProject: null,
        inkClock: { t: 0, painted: 0 },
    };
}

export const meta = {
    data: defaults(),
    storageOk: true,

    load() {
        const d = defaults();
        let raw = null;
        try { const s = localStorage.getItem(KEY); raw = s ? JSON.parse(s) : null; } catch { this.storageOk = false; }
        if (raw && typeof raw === 'object') {
            d.mode = raw.mode === 'free' || raw.mode === 'story' ? raw.mode : null;
            d.chapter = Math.max(0, Math.min(GRANTS.length, raw.chapter | 0));
            d.done = !!raw.done;
            d.seen = Array.isArray(raw.seen) ? raw.seen.filter((s) => typeof s === 'string').slice(0, 200) : [];
            for (const k of ['quests', 'achievements', 'owned', 'flags']) if (raw[k] && typeof raw[k] === 'object') d[k] = raw[k];
            d.ink = Math.max(0, raw.ink | 0); d.inkEarned = Math.max(d.ink, raw.inkEarned | 0);
            if (raw.stats) for (const k of Object.keys(d.stats)) d.stats[k] = Math.max(0, +raw.stats[k] || 0);
            if (raw.settings) Object.assign(d.settings, raw.settings);
            d.lastProject = typeof raw.lastProject === 'string' ? raw.lastProject : null;
        }
        this.data = d;
        return d;
    },
    save() {
        try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch { this.storageOk = false; return false; }
    },
    reset() {
        const keep = this.data.settings;
        this.data = defaults();
        this.data.settings = keep;
        this.save();
        bus.emit('meta', this.data);
    },

    get free() { return this.data.mode === 'free'; },
    get chapter() { return this.data.chapter; },

    /** May the apprentice use this feature (to add new things) right now? */
    has(f) {
        if (!f) return true;
        if (this.free) return true;
        if (this.data.owned[f]) return true;
        const ch = FEATURE_CHAPTER[f];
        if (ch === undefined) return !f.startsWith('pack.') && !isPack(f);
        return ch <= this.data.chapter;
    },
    /** Why a feature is locked, for a tooltip. */
    why(f) {
        const ch = FEATURE_CHAPTER[f];
        if (ch !== undefined) return 'Restored in Chapter ' + ch + (CHAPTER_NAMES[ch] ? ': ' + CHAPTER_NAMES[ch] : '');
        return 'Available at the Inkwell Emporium 🛍';
    },

    addInk(n, why) {
        n = Math.round(n);
        if (n <= 0) return;
        const before = this.rank().i;
        this.data.ink += n;
        this.data.inkEarned += n;
        const after = this.rank().i;
        bus.emit('ink', { n, why, total: this.data.ink });
        if (after > before) bus.emit('rank', this.rank());
        this.save();
    },
    spend(n) {
        if (this.data.ink < n) return false;
        this.data.ink -= n;
        this.save();
        bus.emit('ink', { n: -n, total: this.data.ink });
        return true;
    },
    rank() {
        let i = 0;
        for (let k = 0; k < RANKS.length; k++) if (this.data.inkEarned >= RANKS[k][0]) i = k;
        const next = RANKS[i + 1];
        return { i, title: RANKS[i][1], level: i + 1, next: next ? next[0] : null, prev: RANKS[i][0], earned: this.data.inkEarned };
    },
    stat(k, n) {
        this.data.stats[k] = (this.data.stats[k] || 0) + (n === undefined ? 1 : n);
        bus.emit('stat', { k, v: this.data.stats[k] });
    },
    flag(k, v) { if (v === undefined) return this.data.flags[k]; this.data.flags[k] = v; this.save(); },
};

export const CHAPTER_NAMES = ['The Blank Page', 'Words', 'Things', 'Places', 'Choices', 'Conflict', 'Commerce & Care', 'The Living World', 'The Worldbook', 'Worldsmith'];

// Emporium packs are registered by shop.js so has() knows they are locked until bought.
const PACKS = new Set();
export function registerPacks(ids) { for (const id of ids) PACKS.add(id); }
function isPack(f) { return PACKS.has(f); }
