// The adventure view: a pseudo-3D road in Canvas 2D, the way 1980s racers drew theirs. The road is a list of
// short segments projected with a pinhole camera that rides behind the last cart; curves bend the road by
// accumulating a sideways offset segment by segment, hills by a height per segment. Everything — road
// quads, roadside props, town houses, carts, travellers and monsters — is painted far to near.
//
// Reads G, answers events, never writes G.

import { TOWN, REGIONS, CLASSES } from '../sim/data.js';
import { DAY } from '../config.js';
import { speed } from '../sim/world.js';
import { hash3 } from '../rng.js';
import { drawProp, drawHouse, drawCart, drawOx, drawWalker, drawCampfire, mix, shade } from './sprites.js';
import { drawCreature, creatureHeight } from './creatures.js';
import { scatter, sizeOf, drawScenery, Birds } from './scenery.js';
import { drawSparkle } from './sprites.js';

const SEG = 200;              // world units per road segment
const MILE = 2000;            // world units per mile of road
const DRAW = 150;             // segments drawn ahead
const ROADW = 1100;           // half the road's width
const CAMH = 1700;            // camera height over the road
const CAMBACK = 3300;         // camera distance behind the last cart
const CAMX = 260;             // and a little to the right, so the train shows its side
const FIGHT_X = 1750;         // fights happen on the verge to the right of the train
const GATE_BACK = 2600;       // the town gate stops just behind the camera, so the train stands among the houses
const NEAR = 120;
const PAN = 0.003;             // how far the mountains slide per segment of curve, in screen widths
const CART = { w: 460, h: 640, len: 620, gap: 300 };

const BIOMES = {
    meadow: { sky: ['#5aa8ff', '#d4ecff'], grass: ['#6aab4a', '#5f9c43'], road: '#a08c68', rumble: ['#d8c49a', '#8a7656'], far: '#9db8d0', near: '#6f9a6a', props: ['tree', 'tree', 'bush', 'fence', 'rock'], density: 0.5, hills: 900, curves: 2.2, walls: ['#e8dcc0', '#d8c8a8', '#f0e8d8'], roofs: ['#a84a3a', '#7a4a3a', '#5a6a8a'], weather: 'rain' },
    desert: { sky: ['#5a9ae8', '#f4e2b8'], grass: ['#e2b56a', '#d8aa5e'], road: '#b89a72', rumble: ['#f0d8a8', '#a07a50'], far: '#d8a878', near: '#c48858', props: ['cactus', 'rock', 'dune', 'dune', 'cactus'], density: 0.35, hills: 1300, curves: 1.6, walls: ['#e8c898', '#f0d8b0', '#d8b080'], roofs: ['#c88a50', '#a86a40', '#e8d0a0'], weather: 'sand' },
    mire: { sky: ['#6a9a98', '#c8dcc8'], grass: ['#3f7a5e', '#3a7058'], road: '#6e6a4e', rumble: ['#8a8a5e', '#4a4a34'], far: '#6a8a84', near: '#3c5a52', props: ['willow', 'mushroom', 'reeds', 'reeds', 'willow'], density: 0.6, hills: 500, curves: 2.8, walls: ['#8a7a5a', '#7a6a4a', '#9a8a6a'], roofs: ['#4a6a4a', '#3a4a3a', '#6a5a3a'], weather: 'drizzle' },
    frost: { sky: ['#7aa8e0', '#eef4ff'], grass: ['#e8f0f8', '#dce6f2'], road: '#9aa6b4', rumble: ['#ffffff', '#7a8aa0'], far: '#b8cce4', near: '#8ea8c4', props: ['pine', 'pine', 'rock', 'pine'], density: 0.55, hills: 1800, curves: 2.4, walls: ['#d8d0c4', '#c8bca8', '#e8e0d4'], roofs: ['#f4f8ff', '#5a6a7a', '#7a4a3a'], weather: 'snow' },
    ember: { sky: ['#4a2a3a', '#d8704a'], grass: ['#4a2a24', '#432520'], road: '#5a4440', rumble: ['#8a5040', '#2a1a18'], far: '#6a3a32', near: '#3a2220', props: ['deadtree', 'lavarock', 'vent', 'rock'], density: 0.45, hills: 1400, curves: 2.0, walls: ['#3a3034', '#4a3a3a', '#2a2228'], roofs: ['#8a2a1a', '#2a1a18', '#5a3a2a'], weather: 'ash' },
    star: { sky: ['#1e1a40', '#7a5aa8'], grass: ['#3a3466', '#352f5e'], road: '#5a5480', rumble: ['#9a8ad8', '#2a2450'], far: '#4a3a7a', near: '#2e2858', props: ['crystal', 'obelisk', 'crystal', 'rock'], density: 0.4, hills: 1100, curves: 2.6, walls: ['#4a4470', '#3a3460', '#5a5480'], roofs: ['#9a86ff', '#2a2450', '#6a5ab0'], weather: 'motes' },
};
const BIOME_OF = REGIONS.map((r) => r.biome);
const NIGHT_TINT = '#141a34';

// smooth 1D value noise from the integer hash, so a segment's curve and hill never depend on the past
function noise1(x, salt) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = hash3(i, salt, 7) * 2 - 1, b = hash3(i + 1, salt, 7) * 2 - 1;
    return a + (b - a) * u;
}

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.frameRect = null;            // the part of the screen the scene may use (CSS px); null = all of it
        this.fight = null;
        this.texts = [];                  // floating numbers and words, in world coordinates
        this.parts = [];                  // weather
        this.town = null;                 // { id, z }: where the houses of the nearest town stand
        this.biome = 'meadow';
        this.biomeFrom = 'meadow';
        this.biomeK = 1;
        this.shakeT = 0;
        this.birds = new Birds();
        this.motes = [];             // sparkle bursts, in screen px
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        // CSS size in px, never 100vw/100vh; backing store at device pixels
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
    }

    /** The UI tells the view which rectangle the dock leaves free. */
    setFrame(r) { this.frameRect = r; }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'battle') this.startFight(G, e);
            else if (e.type === 'rally') this.say(G, 'Hup!', '#ffe08a', 0);
            else if (e.type === 'levelup') this.say(G, `Caravan level ${e.level}!`, '#ffe08a', 0, 1.4);
            else if (e.type === 'craft') this.say(G, e.cls === 'cook' ? '+rations' : e.cls === 'smith' ? 'forged!' : '+potion', '#b8f0a0', G.party.findIndex((m) => m.id === e.id));
            else if (e.type === 'event' && e.kind === 'cache') this.say(G, `+${e.gold}g`, '#ffd36a', 0);
            else if (e.type === 'sparkleGot') this.burstSparkle(e);
            else if (e.type === 'rareLoot') this.say(G, e.name, ['#fff', '#8f8', '#6af', '#c8f', '#fb4'][e.rarity], 0, 1.2);
        }
    }

    /** Float a word over a cart (index into the party, 0 = the lead wagon). */
    say(G, text, color, cartIx = 0, size = 1) {
        const L = this.layout(G);
        const c = L.carts[Math.max(0, cartIx)] || L.carts[0];
        if (!c) return;
        this.texts.push({ text, color, x: c.x, y: CART.h + 300, z: c.z + CART.len / 2, age: 0, life: 1.8, size });
    }

    startFight(G, e) {
        const n = e.foes.length;
        this.fight = {
            e, age: 0, dur: Math.max(3, e.dur * 0.95),
            foes: e.foes.map((f, i) => ({ ...f, show: f.hp, dead: 0, flash: 0, lunge: 0, x: (i - (n - 1) / 2) * Math.min(520, 1500 / Math.max(1, n - 1 || 1)), dz: (i % 2) * 380 })),
            party: G.party.map(() => ({ flash: 0, lunge: 0, down: false })),
            next: 0,
        };
    }

    // ------------------------------------------------------------------ layout
    /** Where everything is along the road this frame, in world units. */
    layout(G) {
        const moving = !G.at && G.road && !G.camp && !G.busy;
        const odo = G.odo + (moving ? speed(G) * G.acc : 0);
        const caravanZ = odo * MILE;
        const camZ = caravanZ - CAMBACK;
        const n = G.party.length;
        const carts = G.party.map((m, i) => {
            const k = n - 1 - i;                    // 0 = rearmost
            const c = CLASSES[m.cls];
            return { m, cls: m.cls, color: m.cls === 'captain' ? '#8a5a34' : shade(c.color, -0.35), cloth: c.cloth === '#a8452e' ? '#e8dcc0' : c.cloth, x: Math.sin(i * 1.7) * 60, z: caravanZ + k * (CART.len + CART.gap), lead: i === 0, ...CART, wheel: (odo * MILE) / 110 };
        });
        const leadZ = carts.length ? carts[0].z : caravanZ;
        return { odo, caravanZ, camZ, carts, leadZ, frontZ: leadZ + CART.len, moving };
    }

    biomeAt(G) {
        if (G.at) return BIOME_OF[TOWN[G.at].region];
        const r = G.road;
        if (!r) return 'meadow';
        return BIOME_OF[TOWN[r.done < r.miles * 0.5 ? r.from : r.to].region];
    }

    // ------------------------------------------------------------------ frame
    frame(G, dt, time) {
        this.resize();
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        const R = this.frameRect || { x: 0, y: 0, w: this.w, h: this.h };
        ctx.fillStyle = '#0b0d14';
        ctx.fillRect(0, 0, this.w, this.h);
        if (R.w < 10 || R.h < 10) return;

        // biome cross-fade
        const b = this.biomeAt(G);
        if (b !== this.biome) { this.biomeFrom = this.biome; this.biome = b; this.biomeK = 0; }
        this.biomeK = Math.min(1, this.biomeK + dt / 3);
        const P0 = BIOMES[this.biomeFrom], P1 = BIOMES[this.biome];
        const k = this.biomeK;
        const day = this.daylight(G);
        const night = day < 0.4;
        const col = (a, bb) => mix(mix(a, bb, k), NIGHT_TINT, (1 - day) * 0.72);
        const pal = {
            fog: col(P0.sky[1], P1.sky[1]),
            skyTop: col(P0.sky[0], P1.sky[0]), skyBot: col(P0.sky[1], P1.sky[1]),
            grass: [col(P0.grass[0], P1.grass[0]), col(P0.grass[1], P1.grass[1])],
            road: col(P0.road, P1.road), rumble: [col(P0.rumble[0], P1.rumble[0]), col(P0.rumble[1], P1.rumble[1])],
            far: col(P0.far, P1.far), near: col(P0.near, P1.near), lane: mix('#f4ead0', NIGHT_TINT, (1 - day) * 0.6),
        };
        const B = P1;

        ctx.save();
        ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
        if (this.shakeT > 0) { this.shakeT -= dt; ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4); }

        const L = this.layout(G);
        // the camera dollies up the train to watch a fight, and drifts back after
        this.camK = (this.camK || 0) + ((this.fight ? 1 : 0) - (this.camK || 0)) * Math.min(1, dt * 2.5);
        const ck = this.camK * this.camK * (3 - 2 * this.camK);
        L.camZ += ck * (L.frontZ - 3900 - L.camZ);
        const camH = CAMH - ck * 420, camX = CAMX + ck * (FIGHT_X - CAMX);
        this.updateTown(G, L);
        const f = Math.min(R.h * 1.3, R.w * 1.15);
        const cx = R.x + R.w / 2;
        const horizon = R.y + R.h * 0.4;

        // the road's shape from the camera forward
        const base = Math.floor(L.camZ / SEG);
        const frac = (L.camZ - base * SEG) / SEG;
        const curve = (kk) => noise1(kk / 37, 11) * B.curves + noise1(kk / 9, 12) * 0.4;
        const hill = (kk) => (noise1(kk / 53, 21) * 0.8 + noise1(kk / 17, 22) * 0.2) * B.hills;
        const hillAt = (z) => { const kk = z / SEG, i = Math.floor(kk); return hill(i) + (hill(i + 1) - hill(i)) * (kk - i); };
        const camY = hillAt(L.camZ) + camH;
        const segs = [];
        let x = 0, dx = -curve(base) * frac;
        for (let n = 0; n <= DRAW; n++) {
            const kk = base + n;
            segs.push({ k: kk, x, y: hill(kk), z: kk * SEG - L.camZ });
            x += dx; dx += curve(kk);
        }
        // The mountains pan as the road bends under the caravan: by the distance actually travelled this frame
        // (not speed × time, which kept turning while the caravan stood still), in screen widths per segment.
        // A jump (time away, a new game) moves nothing.
        const dOdo = this.lastOdo === undefined ? 0 : L.odo - this.lastOdo;
        this.lastOdo = L.odo;
        if (dOdo > 0 && dOdo < 2) this.bgShift = (this.bgShift || 0) + curve(base) * ((dOdo * MILE) / SEG) * PAN;
        // project a world point; x is across the road relative to its centre line
        const roadX = (z) => {
            const kk = (z + L.camZ) / SEG - base, i = Math.max(0, Math.min(DRAW - 1, Math.floor(kk))), t = kk - i;
            const a = segs[i], c = segs[i + 1];
            return a.x + (c.x - a.x) * t;
        };
        const P = (wx, wy, wz) => {
            const z = Math.max(NEAR, wz - L.camZ);
            const s = f / z;
            return { X: cx + (roadX(wz - L.camZ) + wx - camX) * s, Y: horizon + (camY - (hillAt(wz) + wy)) * s, s };
        };

        this.drawSky(ctx, R, horizon, pal, G, time, day);
        ctx.fillStyle = mix(pal.grass[0], pal.fog, 0.7);
        ctx.fillRect(R.x, horizon, R.w, R.y + R.h - horizon);
        this.birds.update(dt, this.biome, night);
        this.birds.draw(ctx, R, horizon, time);

        // the world, far to near: road quad, then whatever stands on that segment
        const items = [];
        const farZ = L.camZ + DRAW * SEG;
        const nearZ = L.camZ + NEAR;
        // the countryside: verge, middle ground and far band, from the segment's own hash (see scenery.js).
        // Where the road crosses into a new region, the scenery changes at the road's midpoint, ahead of you.
        let split = null;
        if (G.road) {
            const a = BIOME_OF[TOWN[G.road.from].region], b = BIOME_OF[TOWN[G.road.to].region];
            if (a !== b) split = { z: L.caravanZ + (G.road.miles / 2 - G.road.done) * MILE, a, b };
        }
        const here = this.biome;
        const townZ0 = this.town ? this.town.z - 400 : Infinity, townZ1 = this.town ? this.town.z + 16 * 650 : -Infinity;
        const fogAt = (z) => Math.pow(Math.min(1, Math.max(0, (z - L.camZ) / (DRAW * SEG))), 1.6) * 0.75;
        for (let n = DRAW - 1; n >= 1; n--) {
            const kk = base + n, zSeg = kk * SEG;
            const biome = split ? (zSeg < split.z ? split.a : split.b) : here;
            for (const it of scatter(biome, kk)) {
                if (it.band === 0 && n > 70) continue;                            // grass far off is too small to see
                const z = zSeg + it.dz, half = sizeOf(it.kind) / 2;
                // keep the verge clear where a fight is staged, and the houses' frontage clear in town
                if (ck > 0.05 && it.side > 0 && it.dist - half < FIGHT_X + 1800 && z > L.camZ && z < L.frontZ + 4000) continue;
                if (it.band > 0 && z > townZ0 && z < townZ1 && it.dist - half < ROADW + 2600) continue;
                const fog = it.band > 0 ? fogAt(z) : 0;
                items.push({ z, draw: () => {
                    const p = P(it.side * it.dist, 0, z);
                    if (p.s * sizeOf(it.kind) < 1.5) return;
                    if (fog > 0.05) ctx.globalAlpha = 1 - fog;
                    drawScenery(ctx, it.kind, p.X, p.Y, p.s, it.v, night, time);
                    ctx.globalAlpha = 1;
                } });
            }
        }
        // the town
        if (this.town) {
            const T = TOWN[this.town.id];
            const tp = { walls: BIOMES[BIOME_OF[T.region]].walls, roofs: BIOMES[BIOME_OF[T.region]].roofs };
            for (let i = 0; i < 16; i++) {
                const z = this.town.z + 300 + i * 650;
                for (const side of [-1, 1]) {
                    if (ck > 0.05 && side > 0 && z > L.camZ && z < L.frontZ + 4000) continue;   // the fight's verge
                    const v = (hash3(i, side + 5, T.x) * 64) | 0;
                    items.push({ z, draw: () => { const p = P(side * (ROADW + 650 + (v % 3) * 120), 0, z); drawHouse(ctx, p.X, p.Y, p.s, v, tp, night); } });
                }
            }
            const gz = this.town.z;
            if (gz - L.camZ > 1600) items.push({ z: gz, draw: () => this.drawGate(ctx, P, gz, T, night) });
            if (T.capital) {
                const lit = G.lit[T.region];
                items.push({ z: gz + 5200, draw: () => { const p = P(ROADW + 1400, 0, gz + 5200); drawProp(ctx, 'waystone', p.X, p.Y, p.s * 1.6, lit ? 1 : 0, night); } });
            }
        }
        // carts, oxen and walkers
        const step = (L.odo * MILE) / 140;
        const fight = this.fight;
        L.carts.forEach((c, i) => {
            items.push({ z: c.z, draw: () => drawCart(ctx, P, c, night, time) });
            if (c.m.down) return;
            const fp = fight && fight.party[i];
            let wx = CART.w / 2 + 220, wz = c.z + CART.len * 0.45;
            let pose = 0;
            if (fight) {
                // step out in front of the lead wagon to fight
                const into = Math.min(1, fight.age / 0.5) * Math.min(1, Math.max(0, (fight.dur - fight.age) / 0.6));
                const bx = FIGHT_X + (i - (L.carts.length - 1) / 2) * 300, bz = L.frontZ - 500 + (i % 2) * 220;
                wx += (bx - wx) * into; wz += (bz - wz) * into;
                wz += fp.lunge * 260;
                pose = fp.lunge > 0.1 ? 1 : 0;
            }
            if (G.camp && !fight) { wx = CART.w / 2 + 900 + Math.cos(i * 2.1) * 360; wz = L.caravanZ + 1400 + Math.sin(i * 2.1) * 300; }
            const walking = L.moving && !fight;
            const st = walking ? step + i * 1.3 : 0;
            const cl = CLASSES[c.cls];
            items.push({ z: wz, draw: () => { const p = P(wx, 0, wz); if (fp && fp.flash > 0) { ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 40); } drawWalker(ctx, p.X, p.Y, p.s, c.cls, cl.color, cl.cloth, st, night, pose); if (fp && fp.flash > 0) ctx.restore(); } });
        });
        if (L.carts.length) {
            for (const side of [-1, 1]) {
                const oz = L.frontZ + 260;
                items.push({ z: oz, draw: () => drawOx(ctx, P, side * 140, oz, L.moving ? step * 1.2 + (side > 0 ? Math.PI : 0) : 0, night) });
            }
        }
        if (G.camp && !fight) {
            const z = L.caravanZ + 1400;
            items.push({ z, draw: () => { const p = P(CART.w / 2 + 900, 0, z); drawCampfire(ctx, p.X, p.Y, p.s, time); } });
        }
        // a sparkle on the road ahead, for someone watching to tap
        this.sparkleHit = null;
        const sp = G.sparkle;
        if (sp && G.road) {
            const z = L.frontZ + (sp.at - L.odo) * MILE;
            items.push({ z, draw: () => {
                const p = P(sp.x * ROADW, 0, z);
                const r = Math.max(9, 230 * p.s);
                const y = p.Y - Math.max(14, 330 * p.s) - Math.sin(time * 3) * r * 0.25;
                drawSparkle(ctx, p.X, y, r, time);
                this.sparkleHit = { X: p.X, Y: y, r: Math.max(30, r * 1.6), id: sp.id };
            } });
        }
        // monsters
        if (fight) {
            this.stepFight(G, fight, dt);
            for (const fo of fight.foes) {
                const arrive = Math.min(1, fight.age / 0.6);
                const z = L.frontZ + 1300 + fo.dz + (1 - arrive) * 2500 - fo.lunge * 500;
                const scale = fo.warden ? 2.3 : fo.elite ? 1.55 : 1.25;
                items.push({ z, draw: () => { const p = P(FIGHT_X + fo.x, 0, z); drawCreature(ctx, fo, p.X, p.Y, p.s * scale, { t: time + fo.x, flash: fo.flash, dead: fo.dead }, night); fo.screen = { X: p.X, Y: p.Y - creatureHeight(fo) * p.s * scale, s: p.s }; } });
            }
        }

        // paint: road far to near with items between
        items.sort((a, b) => b.z - a.z);
        let ii = 0;
        for (let n = DRAW - 1; n >= 0; n--) {
            const a = segs[n], c = segs[n + 1];
            const za = a.z, zb = c.z;
            if (zb <= NEAR) continue;
            const pa = this.projRoad(cx, horizon, f, camY, camX, a, Math.max(NEAR, za));
            const pb = this.projRoad(cx, horizon, f, camY, camX, c, zb);
            if (pa.Y > pb.Y) this.drawSegment(ctx, R, pa, pb, a.k, pal, Math.pow(n / DRAW, 1.6) * 0.75);
            const segFarZ = L.camZ + zb, segNearZ = L.camZ + za;
            while (ii < items.length && items[ii].z >= segNearZ) {
                if (items[ii].z < farZ && items[ii].z > nearZ) items[ii].draw();
                ii++;
            }
            void segFarZ;
        }
        while (ii < items.length) { if (items[ii].z > nearZ) items[ii].draw(); ii++; }

        if (this.sparkleHit) this.lastSparkle = this.sparkleHit;
        this.drawMotes(ctx, dt);
        this.drawTexts(ctx, P, dt);
        this.drawWeather(ctx, R, dt, G, night);
        if (night) {
            // a soft vignette at night
            const g = ctx.createRadialGradient(cx, R.y + R.h * 0.7, R.h * 0.2, cx, R.y + R.h * 0.6, R.h);
            g.addColorStop(0, 'rgba(10,12,30,0)'); g.addColorStop(1, `rgba(10,12,30,${0.5 * (1 - day)})`);
            ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, R.h);
        }
        ctx.restore();
    }

    projRoad(cx, horizon, f, camY, camX, seg, z) {
        const s = f / z;
        return { X: cx + (seg.x - camX) * s, Y: horizon + (camY - seg.y) * s, W: ROADW * s, s };
    }

    /** One slice of road and verge; fog (0..1) fades it into the sky's haze with distance. */
    drawSegment(ctx, R, a, b, kk, pal, fog) {
        const stripe = ((Math.floor(kk / 3) % 2) + 2) % 2;      // kk is negative behind mile 0
        const F = (c) => (fog > 0.02 ? mix(c, pal.fog, fog) : c);
        const quad = (x1, w1, x2, w2, fill) => {
            ctx.beginPath();
            ctx.moveTo(x1 - w1, a.Y); ctx.lineTo(x1 + w1, a.Y); ctx.lineTo(x2 + w2, b.Y); ctx.lineTo(x2 - w2, b.Y); ctx.closePath();
            ctx.fillStyle = fill; ctx.fill();
        };
        ctx.fillStyle = F(pal.grass[stripe]);
        ctx.fillRect(R.x, b.Y, R.w, a.Y - b.Y + 1);
        quad(a.X, a.W * 1.12, b.X, b.W * 1.12, F(pal.rumble[stripe]));
        quad(a.X, a.W, b.X, b.W, F(pal.road));
        if (stripe) {
            // ruts: two worn tracks rather than painted lanes, it's a cart road
            const rut = F(shade(pal.road, -0.12));
            quad(a.X - a.W * 0.42, a.W * 0.05, b.X - b.W * 0.42, b.W * 0.05, rut);
            quad(a.X + a.W * 0.42, a.W * 0.05, b.X + b.W * 0.42, b.W * 0.05, rut);
        }
    }

    daylight(G) {
        const d = (G.t + G.acc) % DAY / DAY;               // 0 = midnight
        const v = 0.5 - 0.5 * Math.cos(d * Math.PI * 2);   // 0 at midnight, 1 at noon
        return Math.max(0, Math.min(1, (v - 0.12) / 0.5));
    }

    drawSky(ctx, R, horizon, pal, G, time, day) {
        const g = ctx.createLinearGradient(0, R.y, 0, horizon);
        g.addColorStop(0, pal.skyTop); g.addColorStop(1, pal.skyBot);
        ctx.fillStyle = g;
        ctx.fillRect(R.x, R.y, R.w, horizon - R.y + 2);
        // stars
        if (day < 0.6) {
            ctx.fillStyle = `rgba(255,255,255,${(0.6 - day) * 1.4})`;
            for (let i = 0; i < 70; i++) {
                const sx = R.x + hash3(i, 1, 99) * R.w, sy = R.y + hash3(i, 2, 99) * (horizon - R.y) * 0.9;
                const tw = 0.6 + 0.4 * Math.sin(time * 2 + i);
                ctx.fillRect(sx, sy, 1.5 * tw, 1.5 * tw);
            }
        }
        // sun and moon on an arc
        const d = (G.t + G.acc) % DAY / DAY;
        const arc = (ph, r, fill, glow) => {
            const a = (ph - 0.25) * Math.PI * 2;
            const x = R.x + R.w / 2 - Math.cos(a) * R.w * 0.42, y = horizon - Math.sin(a) * (horizon - R.y) * 0.85;
            if (y > horizon + r) return;
            const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
            gg.addColorStop(0, glow); gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
        };
        arc(d, Math.max(8, R.h * 0.04), '#fff4c8', 'rgba(255,230,160,0.45)');
        arc((d + 0.5) % 1, Math.max(6, R.h * 0.03), '#e8ecff', 'rgba(200,210,255,0.25)');
        // two ranges of mountains, sliding with the curves
        const shift = this.bgShift || 0;
        for (const [layer, colr, amp, par] of [[0, pal.far, 0.22, 0.25], [1, pal.near, 0.13, 0.6]]) {
            ctx.fillStyle = colr;
            ctx.beginPath();
            ctx.moveTo(R.x, horizon + 2);
            for (let i = 0; i <= 48; i++) {
                const sx = R.x + (i / 48) * R.w;
                const u = ((sx - R.x) / R.w + shift * par) / 0.18 + layer * 50;
                const hgt = (0.55 + 0.45 * noise1(u, 40 + layer)) * (horizon - R.y) * amp;
                ctx.lineTo(sx, horizon - hgt);
            }
            ctx.lineTo(R.x + R.w, horizon + 2);
            ctx.closePath(); ctx.fill();
        }
    }

    drawGate(ctx, P, z, T, night) {
        const l = P(-ROADW - 200, 0, z), r = P(ROADW + 200, 0, z);
        const top = P(0, 1500, z);
        const s = l.s;
        const wood = shade('#6a4a30', night ? -0.4 : 0);
        ctx.fillStyle = wood;
        ctx.fillRect(l.X - 60 * s, top.Y, 120 * s, l.Y - top.Y);
        ctx.fillRect(r.X - 60 * s, top.Y, 120 * s, r.Y - top.Y);
        ctx.fillRect(l.X - 100 * s, top.Y - 40 * s, r.X - l.X + 200 * s, 120 * s);
        // the sign
        const w = (r.X - l.X) * 0.7, h = 260 * s;
        ctx.fillStyle = shade('#e8d8b0', night ? -0.35 : 0);
        ctx.fillRect(top.X - w / 2, top.Y + 100 * s, w, h);
        ctx.fillStyle = '#3a2a1a';
        const fs = Math.max(6, Math.min(h * 0.6, (w / Math.max(6, T.name.length)) * 1.5));
        ctx.font = `700 ${fs}px Georgia, 'Times New Roman', serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (fs > 7) ctx.fillText(T.name, top.X, top.Y + 100 * s + h / 2);
    }

    updateTown(G, L) {
        if (G.at) {
            if (!this.town || this.town.id !== G.at) this.town = { id: G.at, z: L.caravanZ - GATE_BACK };
        } else if (G.road) {
            const left = G.road.miles - G.road.done;
            if (left * MILE < DRAW * SEG) {
                const z = L.caravanZ - GATE_BACK + left * MILE;
                if (!this.town || this.town.id !== G.road.to) this.town = { id: G.road.to, z };
                else this.town.z = z;
            } else if (this.town && this.town.id !== G.road.from) this.town = null;
            if (this.town && this.town.z + 14 * 650 < L.camZ) this.town = null;
        }
    }

    // ------------------------------------------------------------------ battles
    stepFight(G, F, dt) {
        F.age += dt;
        const hits = F.e.hits;
        const play = Math.max(1, F.dur - 1.6);
        const gap = hits.length ? play / hits.length : 1;
        while (F.next < hits.length && F.age >= 0.7 + F.next * gap) {
            const h = hits[F.next++];
            const fo = h.d === 'f' ? F.foes[h.di] : null;
            if (h.a === 'p' && F.party[h.ai]) F.party[h.ai].lunge = h.heal ? 0 : 1;
            if (h.a === 'f' && F.foes[h.ai]) F.foes[h.ai].lunge = 1;
            if (fo) {
                fo.flash = 1;
                fo.show -= h.dmg;
                if (fo.show <= 0 && !fo.dead) fo.dead = 0.01;
                this.floatAt(fo, h.crit ? `${h.dmg}!` : `${h.dmg}`, h.aoe ? '#d8a0ff' : h.crit ? '#ffd040' : '#ffffff', h.crit ? 1.4 : 1);
            } else if (h.d === 'p' && F.party[h.di]) {
                if (h.heal) this.floatParty(G, h.di, `+${h.heal}`, h.potion ? '#80d0ff' : '#80ff90');
                else { F.party[h.di].flash = 0.4; this.floatParty(G, h.di, `-${h.dmg}`, '#ff6a5a'); this.shakeT = Math.max(this.shakeT, 0.08); }
            }
        }
        for (const fo of F.foes) {
            fo.flash = Math.max(0, fo.flash - dt * 4);
            fo.lunge = Math.max(0, fo.lunge - dt * 4);
            if (fo.dead > 0) fo.dead = Math.min(1, fo.dead + dt * 1.5);
        }
        for (const p of F.party) { p.flash = Math.max(0, p.flash - dt * 2); p.lunge = Math.max(0, p.lunge - dt * 4); }
        if (F.age > F.dur - 0.9 && !F.ended) {
            F.ended = true;
            if (F.e.won) {
                for (const fo of F.foes) if (!fo.dead) fo.dead = 0.01;
                this.say(G, `Victory! +${F.e.gold}g`, '#ffe08a', 0, 1.3);
                if (F.e.item) this.say(G, F.e.item.name, ['#fff', '#8f8', '#6af', '#c8f', '#fb4'][F.e.item.rarity], Math.min(1, G.party.length - 1));
            } else if (F.e.lost) this.say(G, 'Routed!', '#ff7060', 0, 1.3);
            else this.say(G, 'They slink away…', '#c0c8d8', 0);
        }
        if (F.age >= F.dur) this.fight = null;
    }

    floatAt(fo, text, color, size = 1) {
        if (!fo.screen) return;
        this.texts.push({ text, color, screen: { X: fo.screen.X + (Math.random() - 0.5) * 20, Y: fo.screen.Y }, age: 0, life: 1, size });
    }
    floatParty(G, i, text, color) {
        const L = this.layout(G);
        const c = L.carts[i];
        if (!c) return;
        this.texts.push({ text, color, x: FIGHT_X + (i - (L.carts.length - 1) / 2) * 300, y: 700, z: L.frontZ - 500 + (i % 2) * 220, age: 0, life: 1, size: 0.9 });
    }

/** A tap or click in client px: is it on the sparkle? (mapped through the canvas's own rect) */
    hitSparkle(clientX, clientY) {
        const h = this.sparkleHit;
        if (!h) return null;
        const r = this.canvas.getBoundingClientRect();
        const x = clientX - r.left, y = clientY - r.top;
        return Math.hypot(x - h.X, y - h.Y) <= h.r ? h.id : null;
    }

    burstSparkle(e) {
        const h = this.lastSparkle || this.sparkleHit;
        if (!h) return;
        const text = e.kind === 'gold' ? `+${e.gold}g` : e.kind === 'item' ? e.name : e.kind === 'lore' ? 'Lore!' : '';
        const col = e.kind === 'item' ? ['#fff', '#8f8', '#6af', '#c8f', '#fb4'][e.rarity] : '#ffe08a';
        if (text) this.texts.push({ text, color: col, screen: { X: h.X, Y: h.Y }, age: 0, life: 2, size: 1.3 });
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
            this.motes.push({ x: h.X, y: h.Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6 + Math.random() * 0.6, age: 0 });
        }
    }

    drawMotes(ctx, dt) {
        for (const m of this.motes) {
            m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 120 * dt;
            const a = Math.max(0, 1 - m.age / m.life);
            ctx.fillStyle = `rgba(255,236,150,${a})`;
            ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
        }
        this.motes = this.motes.filter((m) => m.age < m.life);
    }

    drawTexts(ctx, P, dt) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const t of this.texts) {
            t.age += dt;
            const a = Math.max(0, 1 - t.age / t.life);
            let X, Y, s = 1;
            if (t.screen) { X = t.screen.X; Y = t.screen.Y - t.age * 40; }
            else { const p = P(t.x, t.y + t.age * 300, t.z); X = p.X; Y = p.Y; s = Math.max(0.6, Math.min(1.6, p.s * 300)); }
            const size = Math.round(15 * t.size * s);
            ctx.font = `800 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
            ctx.globalAlpha = a;
            ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeText(t.text, X, Y);
            ctx.fillStyle = t.color; ctx.fillText(t.text, X, Y);
        }
        ctx.globalAlpha = 1;
        this.texts = this.texts.filter((t) => t.age < t.life);
    }

    drawWeather(ctx, R, dt, G, night) {
        const B = BIOMES[this.biome];
        const storm = G.buffs.storm > G.t;
        let kind = B.weather, want = 0;
        if (kind === 'rain' || kind === 'drizzle') want = storm ? 140 : kind === 'drizzle' ? 30 : 0;
        else if (kind === 'sand') want = storm ? 160 : 20;
        else if (kind === 'snow') want = storm ? 220 : 60;
        else if (kind === 'ash') want = storm ? 160 : 50;
        else want = 40;
        if (kind === 'drizzle' && night) kind = 'motes';
        while (this.parts.length < want) this.parts.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random(), k: kind });
        if (this.parts.length > want) this.parts.length = want;
        for (const p of this.parts) {
            p.k = kind;
            if (kind === 'rain' || kind === 'drizzle') { p.y += dt * 1.6 * p.v; p.x -= dt * 0.15; }
            else if (kind === 'sand') { p.x -= dt * 0.9 * p.v; p.y += Math.sin(p.x * 30) * dt * 0.05; }
            else if (kind === 'snow') { p.y += dt * 0.12 * p.v; p.x += Math.sin(p.y * 12 + p.v) * dt * 0.03; }
            else if (kind === 'ash') { p.y -= dt * 0.08 * p.v; p.x += Math.sin(p.y * 9) * dt * 0.02; }
            else { p.y -= dt * 0.03 * p.v; p.x += Math.sin(p.y * 7 + p.v * 3) * dt * 0.02; }
            if (p.y > 1) p.y -= 1; if (p.y < 0) p.y += 1; if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1;
            const X = R.x + p.x * R.w, Y = R.y + p.y * R.h;
            if (kind === 'rain' || kind === 'drizzle') { ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - 3, Y + 12); ctx.stroke(); }
            else if (kind === 'sand') { ctx.fillStyle = 'rgba(240,210,150,0.5)'; ctx.fillRect(X, Y, 10 * p.v, 1.5); }
            else if (kind === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(X, Y, 2.5 * p.v, 2.5 * p.v); }
            else if (kind === 'ash') { ctx.fillStyle = p.v > 1.2 ? 'rgba(255,140,60,0.8)' : 'rgba(80,70,70,0.6)'; ctx.fillRect(X, Y, 2.5, 2.5); }
            else { ctx.fillStyle = this.biome === 'star' ? 'rgba(200,190,255,0.7)' : 'rgba(200,255,160,0.8)'; ctx.beginPath(); ctx.arc(X, Y, 1.6 * p.v, 0, Math.PI * 2); ctx.fill(); }
        }
        if (storm && (kind === 'sand' || kind === 'ash' || kind === 'snow')) {
            ctx.fillStyle = kind === 'sand' ? 'rgba(220,180,120,0.18)' : kind === 'ash' ? 'rgba(60,40,40,0.2)' : 'rgba(240,245,255,0.22)';
            ctx.fillRect(R.x, R.y, R.w, R.h);
        }
    }
}
