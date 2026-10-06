/**
 * game.js — the Worldroot simulation.
 *
 * Pure: no DOM, no three.js, no Math.random (see rng.js), no clock. Time only
 * moves when tick(dt) is called, so offline progress is just tick() called in
 * chunks, and the balance bot (dev/simtest.mjs) drives the very same class.
 *
 * The state `s` is plain JSON and is the whole save. Everything else (`d`, the
 * derived multipliers) is recomputed from it whenever something changes.
 *
 * The view, HUD and audio learn what happened from the event queue: each event
 * carries a sequence number; read new ones with eventsSince(seq).
 */

import {
    SAVE_VERSION, COST_RATIO, MILESTONES, MILESTONE_MULT, TREE_LEVELS, TREE_LEVEL_BONUS, REALM_TREE_SCALE,
    HW_K, HW_G, HW_BONUS, REBIRTH_STAGE, OFFLINE_BASE_EFF, OFFLINE_BASE_HOURS, SEASON_LENGTH,
    SAP_BASE_MAX, SAP_PER_STAGE, SAP_REGEN, WISP_MIN, WISP_MAX, WISP_LIFE,
    GENERATORS, UPGRADES, UPGRADE_BY_ID, HEARTWOOD, HEARTWOOD_BY_ID, REALMS, REALM_BY_ID, TRIALS, TRIAL_BY_ID,
    ACHIEVEMENTS, SPELLS, WISP_KINDS, SEASONS, stageOf, treeCostRaw,
} from './data.js';
import { rand, randRange, pickWeighted } from './rng.js';
import { Wilds, wildState, WILD_STATS, migrateWilds } from './wilds.js';
import { KIN_BONUS } from './wilds-data.js';

const NG = GENERATORS.length;
const EVENT_CAP = 300;

export function newState(seed = 12345) {
    return {
        v: SAVE_VERSION,
        rng: seed >>> 0,
        t: 0,                       // game seconds since the very first seed
        runT: 0,                    // game seconds since the last rebirth
        motes: 0,
        runMotes: 0,                // earned this cycle
        totalMotes: 0,              // earned ever
        gens: new Array(NG).fill(0),
        seen: new Array(NG).fill(false),
        ups: {},
        tree: 0,
        bestStage: 0,
        sap: SAP_BASE_MAX,
        buffs: [],                  // { id, kind: 'prod'|'click'|'gen', mult, gen?, until, dur, name }
        wisp: { next: 40, active: null },
        ach: {},
        hw: 0,                      // unspent heartwood
        hwEarned: 0,                // heartwood ever earned (drives the production bonus)
        hwUps: {},
        rebirths: 0,
        realms: [],
        trial: null,
        trialsDone: {},
        auto: { gens: true, ups: true, tree: true },
        acc: { click: 0, buy: 0, ach: 0 },
        stats: {
            clicks: 0, clickMotes: 0, wisps: 0, spells: 0, longestAway: 0, seasonMask: 0, seasonsSeen: 0,
            bestMps: 0, offlineMotes: 0, nourished: 0, playTime: 0,
            ...structuredClone(WILD_STATS),
        },
        ...wildState(),             // kinship, expeditions, relics, garden, whispers, amber (wilds.js)
    };
}

/** Fill any fields a save from an older build lacks. */
export function migrate(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION || !Array.isArray(raw.gens)) return null;
    const base = newState(raw.rng ?? 1);
    const s = { ...base, ...raw };
    s.stats = { ...base.stats, ...(raw.stats || {}) };
    s.auto = { ...base.auto, ...(raw.auto || {}) };
    s.acc = { ...base.acc, ...(raw.acc || {}) };
    s.wisp = { ...base.wisp, ...(raw.wisp || {}) };
    while (s.gens.length < NG) s.gens.push(0);
    if (!Array.isArray(s.seen)) s.seen = base.seen;
    while (s.seen.length < NG) s.seen.push(false);
    for (const k of ['motes', 'runMotes', 'totalMotes', 'hw', 'hwEarned', 'sap', 't', 'runT']) {
        if (!Number.isFinite(s[k])) s[k] = 0;
    }
    migrateWilds(s);
    return s;
}

export class Grove {
    constructor(state) {
        this.s = state;
        this.events = [];
        this.seq = 0;
        this.quiet = false;          // offline catch-up: no per-event noise
        this.d = null;
        this.mark();
    }

    static fresh(seed) { return new Grove(newState(seed)); }

    // ------------------------------------------------------------ events
    emit(type, data = {}) {
        if (this.quiet) return;
        this.events.push({ ...data, type, seq: ++this.seq });
        if (this.events.length > EVENT_CAP) this.events.splice(0, this.events.length - EVENT_CAP);
    }
    eventsSince(seq) {
        const out = [];
        for (let i = this.events.length - 1; i >= 0 && this.events[i].seq > seq; i--) out.push(this.events[i]);
        return out.reverse();
    }

    // ------------------------------------------------------------ derived numbers
    mark() { this.d = null; }

    get stage() { return stageOf(this.s.tree); }
    hwLevel(id) { return this.s.hwUps[id] | 0; }
    hasRealm(id) { return this.s.realms.includes(id); }
    /** The grove's achievements (they feed Radiance). Feats (f_…) are counted apart: featCount(). */
    achCount() { let n = 0; for (const k in this.s.ach) if (this.s.ach[k] && !k.startsWith('f_')) n++; return n; }

    derive() {
        if (this.d) return this.d;
        const s = this.s;
        const trial = s.trial, done = s.trialsDone;
        const ach = this.achCount();
        const stage = this.stage;
        const w = this.wildFx();

        const genMult = new Array(NG).fill(1);
        let global = 1, click = 1, clickPct = 0;
        let wispFreq = 1, wispDur = 1, wispPower = 1, sapMax = 0, sapRegen = 1;
        for (const id in s.ups) {
            const u = UPGRADE_BY_ID[id];
            if (!u) continue;
            const f = u.fx;
            if (f.kind === 'gen') genMult[f.gen] *= f.mult;
            else if (f.kind === 'click') click *= f.mult;
            else if (f.kind === 'clickPct') clickPct += f.pct;
            else if (f.kind === 'global') global *= f.mult;
            else if (f.kind === 'synergy') genMult[f.gen] *= 1 + f.pct * s.gens[f.from];
            else if (f.kind === 'radiance') global *= 1 + f.k * ach;
            else if (f.kind === 'wisp') { wispFreq *= f.freq || 1; wispDur *= f.dur || 1; wispPower *= f.power || 1; }
            else if (f.kind === 'sap') { sapMax += f.max; sapRegen *= f.regen; }
        }
        for (let i = 0; i < NG; i++) {
            let m = 1;
            for (const ms of MILESTONES) if (s.gens[i] >= ms) m *= MILESTONE_MULT;
            genMult[i] *= m;
            if (this.hasRealm('midgard')) genMult[i] *= 3;
            if (done.silent) genMult[i] *= 1.5;
            if (done.lonely && i < 3) genMult[i] *= 10;
            if (trial === 'brief') genMult[i] *= 0.05;
            genMult[i] *= (1 + KIN_BONUS * (s.kinLv[i] | 0)) * (1 + w.gens[i]);
        }
        global *= 1 + w.prod;
        global *= Math.pow(TREE_LEVEL_BONUS, s.tree);
        global *= 1 + HW_BONUS * s.hwEarned;
        global *= Math.pow(1.25, this.hwLevel('heart'));

        const rates = new Array(NG);
        let baseMps = 0;
        for (let i = 0; i < NG; i++) {
            rates[i] = GENERATORS[i].mps * s.gens[i] * genMult[i] * global;
            baseMps += rates[i];
        }

        if (trial === 'brief') click *= 100;
        if (done.brief) click *= 5;
        if (this.hasRealm('jotunheim')) click *= 10;
        click *= 1 + w.click;

        const wells = this.hwLevel('wells');
        sapMax += SAP_BASE_MAX + SAP_PER_STAGE * stage + 20 * wells;
        sapRegen *= SAP_REGEN * (1 + 0.2 * wells);
        sapMax += w.sapMax; sapRegen *= 1 + w.sapRegen;
        if (this.hasRealm('niflheim')) { sapMax *= 2; sapRegen *= 2; }

        wispFreq *= 1 + 0.1 * this.hwLevel('kin');
        if (this.hasRealm('alfheim')) { wispFreq *= 2; wispPower *= 1.5; }
        if (done.starless) wispPower *= 1.5;
        wispFreq *= 1 + w.wispFreq; wispDur *= 1 + w.wispDur; wispPower *= 1 + w.wispPower;

        this.d = {
            genMult, global, rates, baseMps, click, clickPct, ach, w,
            costRatio: trial === 'withered' ? 1.25 : (done.withered ? 1.14 : COST_RATIO),
            genDiscount: (1 - 0.04 * this.hwLevel('bark')) * (this.hasRealm('svartalf') ? 0.75 : 1),
            treeScale: (trial === 'hungry' ? 1000 : 1) * (done.hungry ? 0.1 : 1) * (this.hasRealm('helheim') ? 0.01 : 1)
                * Math.pow(REALM_TREE_SCALE, s.realms.length),
            wispFreq, wispDur, wispPower, sapMax, sapRegen,
            spellCost: (done.starless ? 0.75 : 1) * (this.hasRealm('muspel') ? 0.5 : 1),
            spellPower: this.hasRealm('muspel') ? 2 : 1,
            seasonPower: this.hasRealm('vanaheim') ? 2 : 1,
            offlineEff: Math.min(1, OFFLINE_BASE_EFF + 0.1 * this.hwLevel('dream')) + (this.hasRealm('niflheim') ? 0.25 : 0) + w.offline,
            offlineHours: [OFFLINE_BASE_HOURS, 12, 24, 48, 72][this.hwLevel('sleep')] + (this.hasRealm('niflheim') ? 24 : 0),
            autoClicks: [0, 1, 2, 4, 6, 10][this.hwLevel('hands')] * (this.hasRealm('jotunheim') ? 2 : 1),
        };
        return this.d;
    }

    // ------------------------------------------------------------ seasons + buffs
    seasonIndex() { return Math.floor(this.s.t / SEASON_LENGTH) % 4; }
    season() { return SEASONS[this.seasonIndex()]; }
    seasonLeft() { return SEASON_LENGTH - (this.s.t % SEASON_LENGTH); }

    prodMult() {
        let m = 1;
        for (const b of this.s.buffs) if (b.kind === 'prod') m *= b.mult;
        if (this.seasonIndex() === 1) m *= 1 + 0.25 * this.derive().seasonPower;
        return m;
    }

    /** Motes per second right now, buffs and season included. */
    mps() {
        const d = this.derive();
        let total = d.baseMps;
        for (const b of this.s.buffs) if (b.kind === 'gen') total += d.rates[b.gen] * (b.mult - 1);
        return total * this.prodMult();
    }

    clickValue() {
        if (this.s.trial === 'silent') return 0;
        const d = this.derive();
        let v = d.click + d.clickPct * this.mps();
        for (const b of this.s.buffs) if (b.kind === 'click') v *= b.mult;
        if (this.seasonIndex() === 0) v *= 1 + this.derive().seasonPower;
        return v;
    }

    addBuff(b) {
        const s = this.s;
        s.buffs = s.buffs.filter((x) => x.id !== b.id);
        // the wick and the candle stretch herb blessings and bottles, never spells or wisp gifts
        const dur = b.dur * (b.id.startsWith('herb_') || b.id === 'bottle' ? 1 + this.derive().w.buffDur : 1);
        s.buffs.push({ ...b, dur, until: s.t + dur });
        this.emit('buff', { id: b.id, name: b.name, dur });
    }

    // ------------------------------------------------------------ income
    gain(n, src) {
        if (!(n > 0)) return;
        const s = this.s;
        s.motes += n; s.runMotes += n; s.totalMotes += n;
        if (src === 'click') s.stats.clickMotes += n;
    }

    click(n = 1, auto = false) {
        const v = this.clickValue();
        const total = v * n;
        this.s.stats.clicks += auto ? 0 : n;
        this.gain(total, 'click');
        if (!auto) this.emit('click', { value: total });
        return total;
    }

    // ------------------------------------------------------------ generators
    genUnlocked(i) {
        if (this.s.trial === 'lonely' && i >= 3) return false;
        return this.stage >= GENERATORS[i].stage;
    }
    genVisible(i) {
        return this.genUnlocked(i) && (i === 0 || this.s.seen[i]);
    }

    /** Cost of the next n of generator i. */
    genCost(i, n = 1) {
        const d = this.derive();
        const r = d.costRatio;
        const first = GENERATORS[i].cost * d.genDiscount * Math.pow(r, this.s.gens[i]);
        return n === 1 ? first : first * (Math.pow(r, n) - 1) / (r - 1);
    }

    /** How many of generator i the current motes can buy. */
    genMaxAffordable(i) {
        const d = this.derive();
        const r = d.costRatio;
        const first = this.genCost(i, 1);
        if (this.s.motes < first) return 0;
        return Math.max(1, Math.floor(Math.log(this.s.motes * (r - 1) / first + 1) / Math.log(r) + 1e-9));
    }

    buyGen(i, n = 1) {
        if (!this.genUnlocked(i)) return 0;
        if (n === 'max') n = this.genMaxAffordable(i);
        if (n <= 0) return 0;
        let cost = this.genCost(i, n);
        while (n > 1 && cost > this.s.motes) { n--; cost = this.genCost(i, n); }
        if (cost > this.s.motes) return 0;
        const before = this.s.gens[i];
        this.s.motes -= cost;
        this.s.gens[i] += n;
        this.s.stats.gensBought += n;
        this.mark();
        const ms = MILESTONES.find((m) => before < m && this.s.gens[i] >= m);
        this.emit('buyGen', { gen: i, n, count: this.s.gens[i], first: before === 0, milestone: ms || 0 });
        return n;
    }

    nextMilestone(i) { return MILESTONES.find((m) => this.s.gens[i] < m) || 0; }

    // ------------------------------------------------------------ upgrades
    upgradeReady(u) {
        const s = this.s, r = u.req;
        if (s.ups[u.id]) return false;
        if (r.gen !== undefined && s.gens[r.gen] < r.owned) return false;
        if (r.gen2 !== undefined && s.gens[r.gen2] < r.owned2) return false;
        if (r.clicks !== undefined && s.stats.clicks < r.clicks) return false;
        if (r.clickMotes !== undefined && s.stats.clickMotes < r.clickMotes) return false;
        if (r.ach !== undefined && this.achCount() < r.ach) return false;
        if (r.stage !== undefined && this.stage < r.stage) return false;
        if (r.wisps !== undefined && s.stats.wisps < r.wisps) return false;
        if (u.fx.kind === 'gen' && !this.genUnlocked(u.fx.gen)) return false;
        return true;
    }
    availableUpgrades() {
        return UPGRADES.filter((u) => this.upgradeReady(u)).sort((a, b) => a.cost - b.cost);
    }
    buyUpgrade(id) {
        const u = UPGRADE_BY_ID[id];
        if (!u || !this.upgradeReady(u) || this.s.motes < u.cost) return false;
        this.s.motes -= u.cost;
        this.s.ups[id] = true;
        this.s.stats.upsBought++;
        this.mark();
        this.emit('buyUpgrade', { id });
        return true;
    }

    // ------------------------------------------------------------ the tree
    treeCost() { return treeCostRaw(this.s.tree) * this.derive().treeScale; }
    treeMaxed() { return this.s.tree >= TREE_LEVELS; }

    nourish() {
        if (this.treeMaxed()) return false;
        const cost = this.treeCost();
        if (this.s.motes < cost) return false;
        const s = this.s;
        const before = this.stage;
        s.motes -= cost;
        s.tree++;
        s.stats.nourished++;
        this.mark();
        const after = this.stage;
        this.emit('nourish', { level: s.tree });
        if (after > before) {
            s.bestStage = Math.max(s.bestStage, after);
            s.sap = Math.min(s.sap + 20, this.derive().sapMax);
            this.emit('stage', { stage: after });
            const tr = s.trial && TRIAL_BY_ID[s.trial];
            if (tr && after >= tr.goal && !s.trialsDone[tr.id]) {
                s.trialsDone[tr.id] = true;
                this.mark();
                this.emit('trialDone', { id: tr.id });
            }
        }
        return true;
    }

    // ------------------------------------------------------------ spells
    spellCost(sp) { return Math.ceil(sp.cost * this.derive().spellCost); }
    spellsOpen() { return this.stage >= 2 && this.s.trial !== 'starless'; }
    canCast(id) {
        const sp = SPELLS.find((x) => x.id === id);
        if (!sp || !this.spellsOpen() || this.stage < sp.stage) return false;
        if (id === 'lure' && this.s.wisp.active) return false;
        if (this.s.buffs.some((b) => b.id === id)) return false;   // already running
        return this.s.sap >= this.spellCost(sp);
    }
    cast(id) {
        if (!this.canCast(id)) return false;
        const sp = SPELLS.find((x) => x.id === id);
        const p = this.derive().spellPower;
        this.s.sap -= this.spellCost(sp);
        this.s.stats.spells++;
        this.s.stats.spellCasts[id] = (this.s.stats.spellCasts[id] | 0) + 1;
        this.emit('spell', { id });
        if (id === 'surge') this.addBuff({ id: 'surge', kind: 'prod', mult: 3 * p, dur: 60, name: 'Verdant Surge' });
        else if (id === 'hands') this.addBuff({ id: 'hands', kind: 'click', mult: 20 * p, dur: 30, name: 'Moonlit Hands' });
        else if (id === 'starfall') this.addBuff({ id: 'starfall', kind: 'prod', mult: 10 * p, dur: 30, name: 'Starfall' });
        else if (id === 'quicken') {
            const got = this.mps() * 300 * p;
            this.gain(got, 'spell');
            this.emit('gift', { value: got, from: 'quicken' });
        } else if (id === 'lure') this.spawnWisp();
        return true;
    }

    // ------------------------------------------------------------ wisps
    wispsOpen() { return this.stage >= 1 && this.s.trial !== 'starless'; }
    scheduleWisp() {
        const d = this.derive();
        let f = d.wispFreq;
        if (this.seasonIndex() === 2) f *= 1 + d.seasonPower;
        this.s.wisp.next = this.s.t + randRange(this.s, WISP_MIN, WISP_MAX) / f;
    }
    spawnWisp() {
        const w = this.s.wisp;
        const life = WISP_LIFE * this.derive().wispDur;
        w.active = { born: this.s.t, until: this.s.t + life, path: Math.floor(rand(this.s) * 1e9) };
        this.emit('wispSpawn', { path: w.active.path, life });
    }
    catchWisp(auto = false) {
        const s = this.s, w = s.wisp;
        if (!w.active) return null;
        w.active = null;
        this.scheduleWisp();
        s.stats.wisps++;
        const d = this.derive();
        const kind = pickWeighted(s, WISP_KINDS.filter((k) => k.id !== 'spring' || this.spellsOpen()));
        s.stats.wispKinds[kind.id] = (s.stats.wispKinds[kind.id] | 0) + 1;
        let value = 0;
        if (kind.id === 'lucky') {
            value = (Math.min(s.motes * 0.15, this.mps() * 900) + 13) * d.wispPower;
            this.gain(value, 'wisp');
        } else if (kind.id === 'frenzy') {
            this.addBuff({ id: 'frenzy', kind: 'prod', mult: 7, dur: Math.round(77 * d.wispPower), name: 'Wild Bloom' });
        } else if (kind.id === 'kinship') {
            const owned = [];
            for (let i = 0; i < NG; i++) if (s.gens[i] > 0) owned.push(i);
            const gen = owned.length ? owned[Math.floor(rand(s) * owned.length)] : 0;
            const mult = 1 + 0.1 * s.gens[gen] * d.wispPower;
            this.addBuff({ id: 'kinship', kind: 'gen', gen, mult, dur: 30, name: `Kinship: ${GENERATORS[gen].plural}` });
        } else if (kind.id === 'storm') {
            this.addBuff({ id: 'storm', kind: 'click', mult: 777, dur: Math.round(13 * d.wispPower), name: 'Spark Storm' });
        } else if (kind.id === 'spring') {
            s.sap = d.sapMax;
        }
        this.emit('wispCatch', { kind: kind.id, name: kind.name, value, auto });
        return kind.id;
    }

    // ------------------------------------------------------------ prestige: rebirth
    /** Heartwood a rebirth at tree level L would give. */
    hwForLevel(L) {
        if (L < REBIRTH_STAGE * 10) return 0;
        return Math.floor(HW_K * Math.pow(HW_G, L - REBIRTH_STAGE * 10) * (this.hasRealm('asgard') ? 2 : 1));
    }
    hwGain() { return this.hwForLevel(this.s.tree); }
    canRebirth() { return this.stage >= REBIRTH_STAGE || !!this.s.trial; }

    rebirth(opts = {}) {
        if (!this.canRebirth() && !opts.force) return false;
        const s = this.s;
        const gain = this.hwGain();
        s.hw += gain;
        s.hwEarned += gain;
        s.rebirths++;
        const from = s.trial;
        s.motes = 0; s.runMotes = 0; s.runT = 0;
        const dowry = [0, 10, 25, 50][this.hwLevel('dowry')];
        s.gens = s.gens.map((_, i) => (i < 3 ? dowry : 0));
        s.seen = s.gens.map((n) => n > 0);
        s.ups = {};
        s.tree = 10 * this.hwLevel('roots');
        s.buffs = [];
        s.trial = opts.trial || null;
        this.mark();
        s.sap = this.derive().sapMax;
        s.wisp = { next: s.t + 30, active: null };
        this.emit('rebirth', { gain, trial: s.trial, fromTrial: from, realm: opts.realm || null });
        return gain;
    }

    buyHeartwood(id) {
        const h = HEARTWOOD_BY_ID[id];
        if (!h) return false;
        const l = this.hwLevel(id);
        if (l >= h.max) return false;
        const c = h.cost(l);
        if (this.s.hw < c) return false;
        this.s.hw -= c;
        this.s.hwUps[id] = l + 1;
        this.mark();
        this.emit('buyHeartwood', { id, level: l + 1 });
        return true;
    }

    // ------------------------------------------------------------ trials
    trialsOpen() { return this.s.rebirths > 0; }
    trialOpen(id) { const t = TRIAL_BY_ID[id]; return !!t && this.trialsOpen() && this.s.hwEarned >= t.needs; }
    startTrial(id) {
        if (!this.trialOpen(id) || this.s.trialsDone[id] || this.s.trial) return false;
        this.rebirth({ trial: id, force: true });
        this.emit('trialStart', { id });
        return true;
    }

    // ------------------------------------------------------------ prestige 2: realms
    canBindRealm(id) {
        return this.treeMaxed() && !this.s.trial && !!REALM_BY_ID[id] && !this.hasRealm(id);
    }
    bindRealm(id) {
        if (!this.canBindRealm(id)) return false;
        this.rebirth({ realm: id, force: true });
        this.s.realms.push(id);
        this.mark();
        this.emit('realm', { id, count: this.s.realms.length });
        return true;
    }

    // ------------------------------------------------------------ automation
    autoUnlocked(kind) {
        return this.hwLevel({ gens: 'keepers', ups: 'scribes', tree: 'gardener' }[kind]) > 0;
    }
    autoActive(kind) { return this.autoUnlocked(kind) && this.s.auto[kind]; }

    /** Buy the best motes/s per cost generator repeatedly. Also used by the bot. */
    autoBuyGens(limit = 400, reserve = 0) {
        let bought = 0;
        const d = this.derive();
        for (let k = 0; k < limit; k++) {
            let best = -1, bestScore = 0;
            for (let i = 0; i < NG; i++) {
                if (!this.genUnlocked(i)) continue;
                if (i > 0 && !this.s.seen[i] && this.s.gens[i - 1] === 0) continue;
                const cost = this.genCost(i);
                const gain = GENERATORS[i].mps * this.derive().genMult[i] * d.global;
                const score = gain / cost;
                if (score > bestScore) { bestScore = score; best = i; }
            }
            if (best < 0 || this.genCost(best) > this.s.motes - reserve) break;
            this.buyGen(best, 1);
            bought++;
        }
        return bought;
    }
    autoBuyUps() {
        let n = 0;
        for (const u of this.availableUpgrades()) {
            if (u.cost > this.s.motes) break;
            if (this.buyUpgrade(u.id)) n++;
        }
        return n;
    }
    autoNourish() {
        let n = 0;
        while (this.nourish()) n++;
        return n;
    }

    // ------------------------------------------------------------ achievements
    checkAchievements() {
        const s = this.s;
        let any = false;
        for (const a of ACHIEVEMENTS) {
            if (s.ach[a.id]) continue;
            if (a.test(s)) { s.ach[a.id] = true; any = true; this.emit('ach', { id: a.id }); }
        }
        if (any) this.mark();
        return any;
    }

    // ------------------------------------------------------------ time
    /**
     * Advance the world by dt seconds. `eff` scales production (offline).
     * Long dts should be chunked by the caller (offline() does).
     */
    tick(dt, eff = 1, offline = false) {
        if (!(dt > 0)) return;
        const s = this.s;
        const seasonBefore = this.seasonIndex();
        s.t += dt; s.runT += dt;
        if (!offline) s.stats.playTime += dt;

        // buffs expire on the game clock
        if (s.buffs.length) {
            const keep = s.buffs.filter((b) => b.until > s.t);
            if (keep.length !== s.buffs.length) {
                for (const b of s.buffs) if (b.until <= s.t) this.emit('buffEnd', { id: b.id });
                s.buffs = keep;
            }
        }

        // revealing generators: once you've held half its price, it stays listed
        for (let i = 1; i < NG; i++) {
            if (!s.seen[i] && this.genUnlocked(i) && (s.motes >= GENERATORS[i].cost * 0.5 || s.gens[i] > 0)) {
                s.seen[i] = true;
                this.emit('reveal', { gen: i });
            }
        }

        const m = this.mps();
        if (m > s.stats.bestMps) s.stats.bestMps = m;
        const got = m * dt * eff;
        this.gain(got, 'gen');
        if (offline) s.stats.offlineMotes += got;

        const d = this.derive();
        let regen = d.sapRegen;
        if (this.seasonIndex() === 3) regen *= 1 + d.seasonPower;
        s.sap = Math.min(d.sapMax, s.sap + regen * dt);

        // spirit hands
        if (d.autoClicks > 0 && s.trial !== 'silent') {
            s.acc.click += d.autoClicks * dt * eff;
            const n = Math.floor(s.acc.click);
            if (n > 0) { s.acc.click -= n; this.click(n, true); }
        }

        // wisps
        if (this.wispsOpen()) {
            const w = s.wisp;
            if (w.active && s.t >= w.active.until) {
                if (this.hwLevel('catcher')) this.catchWisp(true);
                else { w.active = null; this.scheduleWisp(); this.emit('wispMiss'); }
            }
            if (!w.active && s.t >= w.next) {
                if (offline) this.scheduleWisp();
                else this.spawnWisp();
            }
        }

        // automation, once a second
        s.acc.buy += dt;
        if (s.acc.buy >= 1) {
            s.acc.buy = 0;
            if (this.autoActive('ups')) this.autoBuyUps();
            if (this.autoActive('tree')) this.autoNourish();
            if (this.autoActive('gens')) this.autoBuyGens();
        }

        // the wilds: kinship grows, parties come home, herbs ripen
        this.tickKin(dt);
        this.tickWilds();

        s.acc.ach += dt;
        if (s.acc.ach >= 1) { s.acc.ach = 0; this.checkAchievements(); this.checkWilds(); }

        const si = this.seasonIndex();
        if (!(s.stats.seasonMask & (1 << si))) {
            s.stats.seasonMask |= 1 << si;
            s.stats.seasonsSeen = [0, 1, 2, 3].filter((k) => s.stats.seasonMask & (1 << k)).length;
        }
        if (si !== seasonBefore) { s.stats.seasonsPassed++; this.emit('season', { season: si }); }
    }

    /**
     * Offline catch-up after `seconds` away. Production runs at the offline
     * efficiency, capped at the offline hours; automation keeps working.
     * Returns a summary for the "while you were away" card.
     */
    offline(seconds) {
        const s = this.s;
        const d = this.derive();
        s.stats.longestAway = Math.max(s.stats.longestAway, seconds);
        s.stats.offlineTime += seconds;
        const cap = d.offlineHours * 3600;
        const sec = Math.min(seconds, cap);
        const before = { motes: s.totalMotes, tree: s.tree, gens: s.gens.reduce((a, b) => a + b, 0), ups: Object.keys(s.ups).length, ach: this.achCount(), sap: s.sap,
            kin: this.kinTotal(), amber: s.amberEver };
        const steps = Math.min(1500, Math.max(1, Math.ceil(sec / 20)));
        const dt = sec / steps;
        this.quiet = true;
        try {
            for (let i = 0; i < steps; i++) this.tick(dt, d.offlineEff, true);
            if (s.wisp.active) { s.wisp.active = null; this.scheduleWisp(); }
        } finally { this.quiet = false; }
        this.mark();
        const summary = {
            seconds, counted: sec, capped: seconds > cap, eff: d.offlineEff,
            motes: s.totalMotes - before.motes,
            tree: s.tree - before.tree,
            gens: s.gens.reduce((a, b) => a + b, 0) - before.gens,
            ups: Object.keys(s.ups).length - before.ups,
            ach: this.achCount() - before.ach,
            kin: this.kinTotal() - before.kin,
            amber: s.amberEver - before.amber,
            expsBack: s.exps.filter((p) => p.back).length,
            ripe: s.garden.filter((p) => p && p.ripe).length,
            whispers: s.quests.filter((q) => q.ready).length,
        };
        this.emit('offline', summary);
        return summary;
    }
}

Object.assign(Grove.prototype, Wilds);

export { GENERATORS, UPGRADES, HEARTWOOD, REALMS, TRIALS, ACHIEVEMENTS, SPELLS, SEASONS };
