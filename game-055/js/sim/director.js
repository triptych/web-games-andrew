// The director writes each operation as it flies: a seeded sequence of
// waves drawn from biome-weighted templates, ramping in "heat" towards the
// boss, with rescues, salvage caches and a mid-boss placed along the way.
// Ground waves look at the terrain ahead before committing: tanks need land,
// gunboats need water, convoys need the highway. A template that can't find
// its ground is swapped for an air wave.

import { LAND, WATER, findSpot, BIOME_IDS } from './terrain.js';
import { BARKS } from './campaign.js';
import { spawnBoss } from './bosses.js';

const TAU = Math.PI * 2;

// --------------------------------------------------------------- templates

const ALL = { coast: 1, jungle: 1, desert: 1, arctic: 1, city: 1, volcano: 1 };

const TEMPLATES = [
    { id: 'vee', w: 3, minHeat: 0, biomes: ALL, run(d, w, r, h) {
        const n = 5 + Math.round(h * 4);
        const cx = r.range(140, 400);
        for (let i = 0; i < n; i++) {
            const k = i - (n - 1) / 2;
            const sx = cx + k * 38, sy = 110 + Math.abs(k) * 30;
            w.spawn('hornet', sx, -30 - Math.abs(k) * 22, { mv: { type: 'formation', sx, sy, vy: 38 + h * 20 } });
        }
        return 3.4;
    } },
    { id: 'snake', w: 3, minHeat: 0, biomes: ALL, run(d, w, r, h) {
        const side = r.sign();
        const n = 6 + Math.round(h * 4);
        const x0 = side < 0 ? -30 : w.W + 30;
        for (let i = 0; i < n; i++) {
            w.spawn('hornet', x0, -20, { delay: i * 0.28, mv: { type: 'bez', dur: 3.4, face: true, p: [[w.W / 2 - side * 330, 60], [w.W / 2 + side * 160, 120], [w.W / 2 + side * 260, w.H * 0.55], [w.W / 2 - side * 340, w.H * 0.7]] } });
        }
        return 3.2;
    } },
    { id: 'swoop', w: 2, minHeat: 0.1, biomes: ALL, run(d, w, r, h) {
        const n = 4 + Math.round(h * 3);
        for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            const x0 = w.W / 2 + side * 320;
            w.spawn('hornet', x0, 60, { delay: i * 0.35, mv: { type: 'bez', dur: 3, face: true, p: [[x0, 40 + i * 10], [w.W / 2 - side * 40, 80], [w.W / 2 - side * 60, w.H * 0.4], [w.W / 2 + side * 330, w.H * 0.35]] } });
        }
        return 3;
    } },
    { id: 'divers', w: 2, minHeat: 0.15, biomes: ALL, run(d, w, r, h) {
        const n = 2 + Math.round(h * 3);
        for (let i = 0; i < n; i++) {
            const x = r.range(60, w.W - 60);
            w.spawn('jet', x, -40, { delay: i * 0.55, data: { dropY: r.range(w.H * 0.18, w.H * 0.38) }, mv: { type: 'dive', x0: x, vy: 330 + h * 80 }, rot: Math.PI });
        }
        return 3;
    } },
    { id: 'crossjets', w: 1.5, minHeat: 0.3, biomes: ALL, run(d, w, r, h) {
        const side = r.sign();
        const y0 = r.range(50, 150);
        for (let i = 0; i < 3; i++) {
            w.spawn('jet', side < 0 ? -40 : w.W + 40, y0 + i * 26, { delay: i * 0.4, mv: { type: 'cross', vx: -side * 260, y0: y0 + i * 26 }, rot: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
        }
        return 2.6;
    } },
    { id: 'gunship', w: 2, minHeat: 0.2, biomes: ALL, run(d, w, r, h) {
        const n = h > 0.65 && r.chance(0.5) ? 2 : 1;
        for (let i = 0; i < n; i++) {
            const tx = n === 1 ? r.range(160, 380) : (i ? 390 : 150);
            w.spawn('gunship', tx, -50, { mv: { type: 'hover', tx, ty: r.range(110, 210), hold: 10 + h * 3, sway: 70, ldx: r.sign() * 0.6, ldy: -1 } });
        }
        return n === 2 ? 7 : 5;
    } },
    { id: 'bomber', w: 1, minHeat: 0.45, biomes: ALL, run(d, w, r, h) {
        const x = r.range(170, 370);
        w.spawn('bomber', x, -70, { mv: { type: 'dive', x0: x, vy: 34, amp: 40, freq: 0.4 } });
        for (const s of [-1, 1]) w.spawn('hornet', x + s * 90, -60, { mv: { type: 'formation', sx: x + s * 90, sy: 90, vy: 30 } });
        return 7;
    } },
    { id: 'carrier', w: 0.8, minHeat: 0.55, biomes: ALL, run(d, w, r, h) {
        const tx = r.range(180, 360);
        w.spawn('carrier', tx, -80, { mv: { type: 'hover', tx, ty: 130, hold: 16, sway: 40, ldy: -1 } });
        return 8;
    } },
    { id: 'mines', w: 1.2, minHeat: 0.25, biomes: ALL, run(d, w, r, h) {
        const n = 5 + Math.round(h * 5);
        for (let i = 0; i < n; i++) {
            const x = r.range(40, w.W - 40);
            w.spawn('mine', x, -20, { delay: i * 0.3, mv: { type: 'dive', x0: x, vy: 70 + r.range(0, 30), amp: 20, freq: 1.5, ph: r.range(0, 6) } });
        }
        return 3;
    } },
    // ---- ground
    { id: 'tanks', w: 3, minHeat: 0, biomes: { coast: 1, jungle: 0.8, desert: 1.4, arctic: 1, city: 1, volcano: 1 }, ground: true, run(d, w, r, h) {
        const n = 2 + Math.round(h * 3);
        let made = 0;
        for (let i = 0; i < n; i++) {
            const e = d.ground('tank', r.range(60, w.W - 60), LAND, -30 - i * 34, { mv: { spd: r.range(14, 30), turn: r.sign() }, dir: Math.PI / 2 + r.range(-0.6, 0.6) });
            if (e) made++;
        }
        return made ? 3 : 0;
    } },
    { id: 'aa', w: 2.2, minHeat: 0.1, biomes: ALL, ground: true, run(d, w, r, h) {
        const n = 2 + (h > 0.5 ? 1 : 0);
        let made = 0;
        for (let i = 0; i < n; i++) if (d.ground('aa', 80 + (i / Math.max(1, n - 1)) * (w.W - 160) + r.range(-30, 30), LAND, -30 - r.range(0, 60))) made++;
        return made ? 3 : 0;
    } },
    { id: 'sam', w: 1.4, minHeat: 0.3, biomes: ALL, ground: true, run(d, w, r, h) {
        return d.ground('sam', r.range(80, w.W - 80), LAND, -30) ? 2.6 : 0;
    } },
    { id: 'bunkers', w: 1.6, minHeat: 0.2, biomes: { coast: 1, jungle: 1, desert: 1.3, arctic: 1.3, city: 0.5, volcano: 1.4 }, ground: true, run(d, w, r, h) {
        let made = 0;
        const n = h > 0.6 ? 3 : 2;
        for (let i = 0; i < n; i++) if (d.ground('bunker', r.range(70, w.W - 70), LAND, -40 - i * 70)) made++;
        return made ? 4 : 0;
    } },
    { id: 'boats', w: 3, minHeat: 0, biomes: { coast: 2.2, jungle: 1.6, desert: 0, arctic: 1.2, city: 1.0, volcano: 0 }, ground: true, run(d, w, r, h) {
        const n = 2 + Math.round(h * 2);
        let made = 0;
        for (let i = 0; i < n; i++) if (d.ground('boat', r.range(60, w.W - 60), WATER, -30 - i * 40, { mv: { spd: r.range(30, 50), on: WATER, turn: r.sign() }, dir: Math.PI / 2 + r.range(-1, 1) })) made++;
        return made ? 3.2 : 0;
    } },
    { id: 'icebreaker', w: 1, minHeat: 0.35, biomes: { coast: 0.8, arctic: 1.6 }, ground: true, run(d, w, r, h) {
        return d.ground('icebreaker', r.range(100, w.W - 100), WATER, -50, { mv: { spd: 20, on: WATER, turn: r.sign() }, dir: Math.PI / 2 }) ? 5 : 0;
    } },
    { id: 'convoy', w: 3, minHeat: 0, biomes: { desert: 1 }, ground: true, run(d, w, r, h) {
        const n = 4 + Math.round(h * 3);
        const ty = w.scroll + w.H + 40;
        const rx = w.terrain.roadX(ty);
        if (rx < 40 || rx > w.W - 40) return 0;
        const down = r.chance(0.6);
        for (let i = 0; i < n; i++) {
            const kind = i === 2 && h > 0.3 ? 'tank' : 'truck';
            w.spawn(kind, rx, -40 - i * 44, { mv: { spd: down ? 40 : 0, road: true, lane: down ? 6 : -6, roadDir: down ? Math.PI / 2 : -Math.PI / 2 }, dir: down ? Math.PI / 2 : -Math.PI / 2 });
        }
        return 3.4;
    } },
    { id: 'fuel', w: 1.5, minHeat: 0, biomes: { desert: 2, city: 0.6, coast: 0.6, arctic: 0.5, volcano: 0.4 }, ground: true, run(d, w, r, h) {
        const x = r.range(90, w.W - 90);
        let made = 0;
        for (let i = 0; i < 3; i++) if (d.ground('fueltank', x + (i - 1) * 42, LAND, -40 - (i % 2) * 36)) made++;
        if (made && h > 0.2) d.ground('aa', x + r.sign() * 110, LAND, -60);
        return made ? 2.5 : 0;
    } },
    { id: 'radar', w: 0.8, minHeat: 0.1, biomes: ALL, ground: true, run(d, w, r, h) {
        return d.ground('radar', r.range(80, w.W - 80), LAND, -30) ? 2 : 0;
    } },
    { id: 'turrets', w: 2.5, minHeat: 0, biomes: { city: 1.6, volcano: 0.7, arctic: 0.4 }, ground: true, run(d, w, r, h) {
        const n = 2 + Math.round(h * 2);
        let made = 0;
        for (let i = 0; i < n; i++) if (d.ground('turret', r.range(60, w.W - 60), LAND, -30 - i * 50)) made++;
        return made ? 3.2 : 0;
    } },
    { id: 'walkers', w: 2, minHeat: 0.15, biomes: { jungle: 1.6, volcano: 1.4, arctic: 0.5 }, ground: true, run(d, w, r, h) {
        const n = 1 + Math.round(h * 2);
        let made = 0;
        for (let i = 0; i < n; i++) if (d.ground('walker', r.range(70, w.W - 70), LAND, -30 - i * 50, { mv: { spd: 22, turn: r.sign() }, dir: Math.PI / 2 + r.range(-0.5, 0.5) })) made++;
        return made ? 3.4 : 0;
    } },
];

const ENDLESS_ORDER = ['coast', 'jungle', 'desert', 'arctic', 'city', 'volcano'];
const BOSS_OF = { coast: 'leviathan', jungle: 'mantis', desert: 'sandwyrm', arctic: 'bastion', city: 'seraph', volcano: 'meridian' };

// --------------------------------------------------------------- director

export function makeDirector(w) {
    const op = w.op;
    const r = w.rng.fork(77);
    const d = {
        t: 0, next: 3, heat: 0, commsIdx: 0, phase: 'waves', length: op.length,
        rescues: [], caches: [], midboss: null, barkT: 0, lastTemplate: null, sector: 0,
        bossAt: op.length, warned: false, preBossSaid: false, bossSpawned: false,
    };
    w.stats.survivorsTotal = 0;

    function plan(len, offset) {
        d.rescues = [0.2, 0.47, 0.76].map((f) => offset + len * f + r.range(-4, 4));
        d.caches = [0.33, 0.62].map((f) => offset + len * f + r.range(-5, 5));
        d.midboss = w.opIndex >= 1 || w.endless ? offset + len * 0.55 : null;
    }
    plan(op.length, 0);

    /** Spawn a ground unit on `want` terrain near x; returns the entity or null. */
    d.ground = (kind, x, want, y = -30, opts = {}) => {
        const ty = w.scroll + w.H - y;
        const px = findSpot(w.terrain, x, ty, want);
        if (px === null) return null;
        for (const e of w.enemies) { // don't stack units
            if (e.ground && Math.abs(e.x - px) < 36 && Math.abs(e.y - y) < 36) return null;
        }
        return w.spawn(kind, px, y, opts);
    };

    function pickTemplate(heat) {
        const biome = w.terrain.biome;
        const pool = [];
        for (const t of TEMPLATES) {
            if (heat < t.minHeat) continue;
            const bw = t.biomes[biome] || 0;
            if (!bw) continue;
            let wt = t.w * bw;
            if (t.id === d.lastTemplate) wt *= 0.3;
            pool.push({ t, w: wt });
        }
        return r.weighted(pool).t;
    }

    function bark(kind) {
        if (d.barkT > 0) return;
        let lines = BARKS[kind];
        if (!lines) return;
        if (w.opIndex < 5 && !w.endless) lines = lines.filter((l) => l[0] !== 'ash');
        if (!lines.length) return;
        const [who, text] = r.pick(lines);
        w.ev('comms', { who, text, bark: true });
        d.barkT = 14;
    }
    d.bark = bark;

    function spawnSpecials() {
        if (d.rescues.length && d.t >= d.rescues[0]) {
            const x = r.range(80, w.W - 80);
            const e = d.ground('beacon', x, LAND, -30);
            if (e) {
                d.rescues.shift();
                e.data.people = r.int(2, 5);
                w.stats.survivorsTotal += e.data.people;
            } else d.rescues[0] += 1.5;
        }
        if (d.caches.length && d.t >= d.caches[0]) {
            const e = d.ground('depot', r.range(80, w.W - 80), LAND, -40);
            if (e) d.caches.shift(); else d.caches[0] += 1.5;
        }
        if (d.midboss !== null && d.t >= d.midboss) {
            d.midboss = null;
            const tx = r.range(200, 340);
            w.spawn('warhawk', tx, -60, { mv: { type: 'hover', tx, ty: 150, hold: 26, sway: 120, sfreq: 0.5, ldy: -1 } });
            d.next = Math.max(d.next, d.t + 9);
        }
    }

    function waves(dt) {
        if (d.t < d.next) return;
        const heat = Math.min(1, w.endless ? 0.3 + d.sector * 0.12 + (d.t - d.sectorStart) / d.length * 0.3 : d.t / d.length);
        d.heat = heat;
        let gap = 0, tries = 0;
        while (!gap && tries++ < 5) {
            const t = pickTemplate(heat);
            const before = w.enemies.length;
            gap = t.run(d, w, r, heat);
            if (gap) {
                d.lastTemplate = t.id;
                if (heat > 0.38 && r.chance(0.18 + heat * 0.12)) {
                    let any = false;
                    for (let i = before; i < w.enemies.length; i++) {
                        const e = w.enemies[i];
                        if (!e.def.structure && !e.def.midboss && e.kind !== 'missile') { w.makeElite(e); any = true; }
                    }
                    if (any) bark('elite');
                }
            }
        }
        if (!gap) gap = 1.5;
        d.next = d.t + gap * (1.05 - heat * 0.3) * r.range(0.85, 1.15);
    }

    d.step = (dt) => {
        d.t += dt;
        d.barkT -= dt;
        if (!w.endless) {
            const comms = op.comms;
            while (d.commsIdx < comms.length && d.t >= comms[d.commsIdx][0]) {
                const [, who, text] = comms[d.commsIdx++];
                w.ev('comms', { who, text });
                d.barkT = 8;
            }
        }
        if (d.phase === 'waves') {
            if (d.t < d.bossAt - 9) { spawnSpecials(); waves(dt); }
            if (!d.preBossSaid && d.t >= d.bossAt - 7) {
                d.preBossSaid = true;
                const [who, text] = w.endless ? ['meridian', 'Sector ' + (d.sector + 1) + '. Adjusting the forecast.'] : op.preBoss;
                w.ev('comms', { who, text });
                d.barkT = 12;
            }
            if (!d.warned && d.t >= d.bossAt - 3.2) { d.warned = true; w.ev('warning', { name: d.bossName() }); }
            if (d.t >= d.bossAt && !d.bossSpawned) {
                d.bossSpawned = true;
                d.phase = 'boss';
                w.boss = spawnBoss(w, d.bossId());
                w.bossStartT = w.t;
                if (!w.endless) { const [who, text] = op.bossIntro; w.ev('comms', { who, text }); }
                d.barkT = 10;
            }
        } else if (d.phase === 'boss') {
            if (w.boss && !w.boss.alive && w.endless && w.state === 'play') {
                // next sector: new biome behind a cloud bank
                d.sector++;
                d.phase = 'transition';
                d.transT = 0;
            }
        } else if (d.phase === 'transition') {
            d.transT += dt;
            w.cloudCover = Math.min(1, d.transT / 2.5);
            if (d.transT > 3 && !d.swapped) {
                d.swapped = true;
                for (const e of w.enemies) if (e.ground) e.alive = false;
                const biome = ENDLESS_ORDER[d.sector % ENDLESS_ORDER.length];
                w.setBiome(biome, (w.seed + d.sector * 7919) >>> 0);
            }
            if (d.transT > 4.5) {
                w.cloudCover = Math.max(0, 1 - (d.transT - 4.5) / 2.5);
                if (d.transT > 7) {
                    w.cloudCover = 0;
                    d.swapped = false;
                    d.phase = 'waves';
                    d.sectorStart = d.t;
                    d.length = 95;
                    d.bossAt = d.t + d.length;
                    d.next = d.t + 2;
                    d.warned = d.preBossSaid = d.bossSpawned = false;
                    w.boss = null;
                    w.scrollTarget = w.op.scroll;
                    w.endlessLevel = d.sector;
                    plan(d.length, d.t);
                    w.ev('banner', { text: 'SECTOR ' + (d.sector + 1), sub: w.terrain.biome.toUpperCase() });
                }
            }
        }
    };

    d.bossId = () => (w.endless ? BOSS_OF[w.terrain.biome] : op.boss);
    d.bossName = () => (w.endless ? BOSS_OF[w.terrain.biome].toUpperCase() : op.bossName);

    d.skipToBoss = () => {
        d.t = d.bossAt - 3.5;
        d.preBossSaid = true;
        d.commsIdx = op.comms.length;
        d.rescues = []; d.caches = []; d.midboss = null;
    };

    if (w.endless) {
        d.sectorStart = 0;
        d.length = 95;
        d.bossAt = 95;
        plan(95, 0);
    }
    return d;
}

export { TEMPLATES, BOSS_OF, ENDLESS_ORDER };
