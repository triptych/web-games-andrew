/**
 * wilds.js — the systems around the core loop, mixed into Grove (game.js):
 * spirit kinship, expeditions and relics, the moonpetal garden, whispers,
 * the amber peddler, badges, titles and feats. Numbers live in wilds-data.js.
 *
 * Same rules as the rest of js/sim: pure, seeded (rng.js), game-clock only,
 * so all of it keeps running in offline catch-up.
 */

import { GENERATORS } from './data.js';
import {
    KIN_MAX, kinCost, EXP_SITES, EXP_SITE_BY_ID, EXP_TIMES, RELICS, RELIC_SETS, RELIC_DUP_AMBER,
    HERBS, HERB_BY_ID, GARDEN_BASE_PLOTS, GLIMMER_CHANCE, WHISPERS, WHISPER_BY_ID, WHISPER_SLOTS, WHISPER_REROLL,
    SHOP_BY_ID, BADGES, TITLE_BY_ID, FEATS, FEAT_AMBER,
} from './wilds-data.js';
import { rand, randRange } from './rng.js';

const NG = GENERATORS.length;

export function wildState() {
    return {
        amber: 0, amberEver: 0,
        kin: new Array(NG).fill(0),        // xp toward the next level
        kinLv: new Array(NG).fill(0),
        exps: [],                          // { site, ti, start, end, back }
        relics: {},                        // id -> times found
        garden: new Array(GARDEN_BASE_PLOTS).fill(null),   // plot: null | { herb, start, end, ripe }
        herbs: {},                         // id -> harvested
        herbGlim: {},                      // id -> a glimmering one was harvested
        quests: [],                        // { id, from, n, amber, ready }
        shop: {},                          // id -> level (cosmetics: 1 = owned)
        badges: {},                        // id -> tier 1..4
        title: null,
        spark: null,
    };
}
export const WILD_STATS = {
    gensBought: 0, upsBought: 0, expeditions: 0, harvests: 0, quests: 0, glimmers: 0, bottles: 0, odysseys: 0,
    offlineTime: 0, seasonsPassed: 0, amberSpent: 0, wispKinds: {}, spellCasts: {}, sites: {},
};

/** Fill wild fields an older save lacks (called from migrate). */
export function migrateWilds(s) {
    const base = wildState();
    for (const k in base) if (s[k] === undefined || s[k] === null && k !== 'title' && k !== 'spark') s[k] = base[k];
    for (const k of ['kin', 'kinLv']) {
        if (!Array.isArray(s[k])) s[k] = base[k];
        while (s[k].length < NG) s[k].push(0);
    }
    for (const k of ['exps', 'garden', 'quests']) if (!Array.isArray(s[k])) s[k] = base[k];
    for (const k of ['wispKinds', 'spellCasts', 'sites']) if (!s.stats[k] || typeof s.stats[k] !== 'object') s.stats[k] = {};
    if (!Number.isFinite(s.amber)) s.amber = 0;
    if (!Number.isFinite(s.amberEver)) s.amberEver = 0;
}

export const Wilds = {
    // ------------------------------------------------------------ opening
    wildsOpen() { return this.s.bestStage >= 1 || this.s.rebirths > 0; },
    shopLevel(id) { return this.s.shop[id] | 0; },

    /** Every small lasting bonus from relics, sets and the peddler. Part of derive(). */
    wildFx() {
        const s = this.s;
        const w = { prod: 0, gens: new Array(NG).fill(0), click: 0, wispFreq: 0, wispDur: 0, wispPower: 0, sapMax: 0, sapRegen: 0,
            offline: 0, amber: 0, kin: 0, buffDur: 0, expSpeed: 0, garden: 0 };
        const add = (fx) => {
            for (const k in fx) {
                if (k === 'gens') { for (const i of fx.gens) w.gens[i] += fx.v; } else if (k !== 'v') w[k] += fx[k];
            }
        };
        for (const r of RELICS) if (s.relics[r.id]) add(r.fx);
        for (const st of this.relicSets()) add(RELIC_SETS.find((x) => x.site === st).fx);
        w.buffDur += 0.25 * this.shopLevel('wick');
        w.garden += 0.1 * this.shopLevel('loam');
        w.expSpeed += 0.1 * this.shopLevel('compass');
        return w;
    },

    addAmber(n) {
        const v = n * (1 + this.derive().w.amber);
        this.s.amber += v;
        this.s.amberEver += v;
        return v;
    },

    // ------------------------------------------------------------ kinship
    kinTotal() { let n = 0; for (const l of this.s.kinLv) n += l; return n; },
    tickKin(dt) {
        const s = this.s;
        const mult = 1 + this.derive().w.kin;
        for (let i = 0; i < NG; i++) {
            if (!s.gens[i] || s.kinLv[i] >= KIN_MAX) continue;
            s.kin[i] += Math.sqrt(s.gens[i]) * dt * mult;
            let c;
            while (s.kinLv[i] < KIN_MAX && s.kin[i] >= (c = kinCost(s.kinLv[i]))) {
                s.kin[i] -= c;
                s.kinLv[i]++;
                this.mark();
                this.emit('kin', { gen: i, level: s.kinLv[i] });
            }
            if (s.kinLv[i] >= KIN_MAX) s.kin[i] = 0;
        }
    },

    // ------------------------------------------------------------ expeditions
    expSlots() { return 1 + this.shopLevel('party'); },
    siteOpen(id) { const x = EXP_SITE_BY_ID[id]; return !!x && this.wildsOpen() && this.s.bestStage >= x.stage; },
    expDuration(ti) { return EXP_TIMES[ti].secs / (1 + this.derive().w.expSpeed); },
    canSend(site, ti) { return this.siteOpen(site) && !!EXP_TIMES[ti] && this.s.exps.length < this.expSlots(); },
    sendExpedition(site, ti) {
        if (!this.canSend(site, ti)) return false;
        const s = this.s;
        s.exps.push({ site, ti, start: s.t, end: s.t + this.expDuration(ti), back: false });
        this.emit('expSend', { site, ti });
        return true;
    },
    claimExpedition(idx) {
        const s = this.s, p = s.exps[idx];
        if (!p || s.t < p.end) return null;
        s.exps.splice(idx, 1);
        const site = EXP_SITE_BY_ID[p.site], T = EXP_TIMES[p.ti];
        let amber = this.addAmber(T.amber * site.amber);
        const light = this.mps() * 60 * T.light * (T.secs / 3600);
        this.gain(light, 'exp');
        let relic = null;
        if (rand(s) < T.relic) {
            relic = this.findRelic(p.site);
            amber += relic.amber;
        }
        s.stats.expeditions++;
        s.stats.sites[p.site] = (s.stats.sites[p.site] | 0) + 1;
        if (T.id === 'odyssey') s.stats.odysseys++;
        const out = { site: p.site, ti: p.ti, amber, light, relic: relic?.id || null, dup: !!relic?.dup };
        this.emit('expClaim', out);
        return out;
    },
    claimAllExpeditions() {
        const got = [];
        for (let i = this.s.exps.length - 1; i >= 0; i--) { const r = this.claimExpedition(i); if (r) got.push(r); }
        return got;
    },

    // ------------------------------------------------------------ relics
    relicCount() { let n = 0; for (const r of RELICS) if (this.s.relics[r.id]) n++; return n; },
    relicSets() { return RELIC_SETS.filter((st) => RELICS.every((r) => r.site !== st.site || this.s.relics[r.id])).map((st) => st.site); },
    /** A relic from `siteId`'s six, leaning toward ones not yet found. Duplicates turn into amber. */
    findRelic(siteId) {
        const s = this.s;
        const pool = RELICS.filter((r) => r.site === siteId);
        const missing = pool.filter((r) => !s.relics[r.id]);
        const from = missing.length && rand(s) < 0.6 ? missing : pool;
        const r = from[Math.floor(rand(s) * from.length) % from.length];
        const dup = !!s.relics[r.id];
        s.relics[r.id] = (s.relics[r.id] | 0) + 1;
        let amber = 0;
        if (dup) amber = this.addAmber(RELIC_DUP_AMBER * EXP_SITE_BY_ID[siteId].amber);
        else this.mark();
        this.emit('relic', { id: r.id, dup, amber });
        return { id: r.id, dup, amber };
    },

    // ------------------------------------------------------------ the garden
    gardenPlots() { return GARDEN_BASE_PLOTS + this.shopLevel('plots'); },
    fitGarden() { const g = this.s.garden; while (g.length < this.gardenPlots()) g.push(null); },
    herbOpen(id) { const h = HERB_BY_ID[id]; return !!h && this.wildsOpen() && this.s.bestStage >= h.stage && this.s.stats.harvests >= h.harvests; },
    herbTime(id) { return HERB_BY_ID[id].secs / (1 + this.derive().w.garden); },
    plant(plot, id) {
        const s = this.s;
        this.fitGarden();
        if (plot < 0 || plot >= this.gardenPlots() || s.garden[plot] || !this.herbOpen(id)) return false;
        s.garden[plot] = { herb: id, start: s.t, end: s.t + this.herbTime(id), ripe: false };
        this.emit('plant', { plot, herb: id });
        return true;
    },
    harvest(plot) {
        const s = this.s, p = s.garden[plot];
        if (!p || s.t < p.end) return null;
        s.garden[plot] = null;
        const h = HERB_BY_ID[p.herb], g = h.gift;
        const glim = rand(s) < GLIMMER_CHANCE;
        const k = glim ? 2 : 1;
        let amber = this.addAmber(h.amber * k), light = 0, relic = null;
        if (g.light) { light = this.mps() * 60 * g.light * k; this.gain(light, 'herb'); }
        if (g.buff) this.addBuff({ id: `herb_${h.id}`, kind: g.buff, mult: g.mult, dur: g.dur * k, name: h.name });
        if (g.sap) { const d = this.derive(); s.sap = Math.min(d.sapMax, s.sap + g.sap * k); }
        if (g.wisp) {
            if (this.wispsOpen() && !s.wisp.active) this.spawnWisp();
            else amber += this.addAmber(3 * k);
        }
        if (g.relic && rand(s) < g.relic * k) {
            const open = EXP_SITES.filter((x) => this.siteOpen(x.id));
            if (open.length) { relic = this.findRelic(open[Math.floor(rand(s) * open.length) % open.length].id); amber += relic.amber; }
        }
        s.herbs[h.id] = (s.herbs[h.id] | 0) + 1;
        s.stats.harvests++;
        if (glim) { s.stats.glimmers++; s.herbGlim[h.id] = true; }
        const out = { plot, herb: h.id, glim, amber, light, relic: relic?.id || null };
        this.emit('harvest', out);
        return out;
    },
    harvestAll() {
        const got = [];
        for (let i = 0; i < this.s.garden.length; i++) { const r = this.harvest(i); if (r) got.push(r); }
        return got;
    },
    /** Plant `id` in every empty plot it can. */
    plantAll(id) {
        let n = 0;
        this.fitGarden();
        for (let i = 0; i < this.gardenPlots(); i++) if (!this.s.garden[i] && this.plant(i, id)) n++;
        return n;
    },

    // ------------------------------------------------------------ whispers
    whisperSlots() { return WHISPER_SLOTS + this.shopLevel('satchel'); },
    statOf(stat) { return stat === 'motes' ? this.s.totalMotes : (this.s.stats[stat] || 0); },
    whisperOpen(w) { return !(w.stage > this.s.bestStage) && !(w.stage && this.s.trial === 'starless' && (w.id === 'wisp' || w.id === 'spell')); },
    newWhisper(exclude = []) {
        const s = this.s;
        const pool = WHISPERS.filter((w) => this.whisperOpen(w) && !exclude.includes(w.id));
        const w = pool[Math.floor(rand(s) * pool.length) % pool.length];
        const scale = 1 + 0.35 * s.bestStage, jitter = randRange(s, 0.8, 1.3);
        let n;
        if (w.id === 'motes') n = Math.max(100, this.mps() * randRange(s, 300, 900));
        else if (w.id === 'tend') n = 60 * Math.round((w.base * jitter) / 60);
        else n = Math.max(1, Math.round(w.base * scale * jitter));
        const amber = 2 + Math.floor(s.bestStage / 3) + (rand(s) < 0.15 ? 2 : 0);
        return { id: w.id, from: this.statOf(w.stat), n, amber, ready: false };
    },
    fillWhispers() {
        const q = this.s.quests;
        while (q.length < this.whisperSlots()) q.push(this.newWhisper(q.map((x) => x.id)));
    },
    whisperProgress(q) { return Math.max(0, Math.min(q.n, this.statOf(WHISPER_BY_ID[q.id].stat) - q.from)); },
    claimWhisper(i) {
        const s = this.s, q = s.quests[i];
        if (!q || this.whisperProgress(q) < q.n) return null;
        s.quests.splice(i, 1);
        const amber = this.addAmber(q.amber);
        s.stats.quests++;
        this.emit('whisper', { id: q.id, amber });
        this.fillWhispers();
        return { id: q.id, amber };
    },
    rerollWhisper(i) {
        const s = this.s, q = s.quests[i];
        if (!q || s.amber < WHISPER_REROLL) return false;
        s.amber -= WHISPER_REROLL;
        s.stats.amberSpent += WHISPER_REROLL;
        s.quests[i] = this.newWhisper(s.quests.map((x) => x.id));
        return true;
    },

    // ------------------------------------------------------------ the peddler
    shopCost(id) { const it = SHOP_BY_ID[id]; return it.cost(this.shopLevel(id)); },
    canBuyShop(id) {
        const it = SHOP_BY_ID[id];
        if (!it || !this.wildsOpen()) return false;
        if (it.kind === 'up' && this.shopLevel(id) >= it.max) return false;
        if (it.kind === 'look' && this.shopLevel(id)) return true;          // owned: wearing it is free
        if (it.kind === 'use' && this.s.buffs.some((b) => b.id === id)) return false;
        return this.s.amber >= this.shopCost(id);
    },
    buyShop(id) {
        if (!this.canBuyShop(id)) return false;
        const s = this.s, it = SHOP_BY_ID[id];
        if (it.kind === 'look' && this.shopLevel(id)) { s.spark = s.spark === id ? null : id; this.emit('shop', { id, wear: true }); return true; }
        const c = this.shopCost(id);
        s.amber -= c;
        s.stats.amberSpent += c;
        if (it.kind === 'up') { s.shop[id] = this.shopLevel(id) + 1; this.mark(); this.fitGarden(); }
        else if (it.kind === 'use') { s.stats.bottles++; this.addBuff({ id, kind: 'prod', mult: 2, dur: 900, name: it.name }); }
        else { s.shop[id] = 1; s.spark = id; }
        this.emit('shop', { id });
        return true;
    },

    // ------------------------------------------------------------ badges, titles, feats
    wildKeys() {
        const s = this.s;
        let glimmerKinds = 0; for (const h of HERBS) if (s.herbGlim[h.id]) glimmerKinds++;
        let badgeTiers = 0; for (const k in s.badges) badgeTiers += s.badges[k];
        return {
            kin: this.kinTotal(), kinMax: Math.max(...s.kinLv), relics: this.relicCount(), sets: this.relicSets(),
            glimmerKinds, badgeTiers, ach: this.achCount() + this.featCount(),
        };
    },
    featCount() { let n = 0; for (const f of FEATS) if (this.s.ach[f.id]) n++; return n; },
    badgeTier(b, k) { const v = b.value(this.s, k); let t = 0; for (const a of b.at) if (v >= a) t++; return t; },
    titleOpen(id) { const t = TITLE_BY_ID[id]; return !!t && (this.s.badges[t[2]] | 0) >= t[3]; },
    setTitle(id) {
        if (id !== null && !this.titleOpen(id)) return false;
        this.s.title = id;
        this.emit('title', { id });
        return true;
    },
    /** Called once a second with the achievements. */
    checkWilds() {
        const s = this.s;
        if (!this.wildsOpen()) return;
        this.fitGarden();
        this.fillWhispers();
        for (const q of s.quests) if (!q.ready && this.whisperProgress(q) >= q.n) { q.ready = true; this.emit('whisperReady', { id: q.id }); }
        let k = this.wildKeys();
        for (const f of FEATS) {
            if (s.ach[f.id] || !f.test(s, k)) continue;
            s.ach[f.id] = true;
            this.addAmber(FEAT_AMBER);
            this.emit('ach', { id: f.id, feat: true });
            k = this.wildKeys();
        }
        for (const b of BADGES) {
            const t = this.badgeTier(b, k);
            if (t > (s.badges[b.id] | 0)) {
                s.badges[b.id] = t;
                this.emit('badge', { id: b.id, tier: t });
                k = this.wildKeys();
            }
        }
    },
    /** Parties that came home and herbs that ripened, on the game clock. */
    tickWilds() {
        const s = this.s;
        for (const p of s.exps) if (!p.back && s.t >= p.end) { p.back = true; this.emit('expBack', { site: p.site }); }
        for (const p of s.garden) if (p && !p.ripe && s.t >= p.end) { p.ripe = true; this.emit('ripe', { herb: p.herb }); }
    },
};

export { KIN_MAX };
