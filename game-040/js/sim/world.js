/**
 * world.js — the simulation. This is the actual game.
 *
 * HARD RULE: this module (and everything else in js/sim/) imports no three.js
 * and touches no DOM. The world is plain arrays of plain objects; the view
 * reads them once a frame and syncs meshes. That is what lets dev/simtest.mjs
 * and dev/playthrough.mjs run real levels, real bosses and a real full campaign
 * in Node with no browser at all.
 *
 * The world exposes a small API to the entities it owns (`fire`, `spawnEnemy`,
 * `spawnPod`, `fx`, ...) as methods, so enemies.js and bosses.js never have to
 * import this file — which keeps the dependency graph acyclic.
 */

import { ARENA, TICK, PLAYER, POD, PICKUP, DIFFICULTY, COLORS, WEAPON_IDS, SCORE } from '../core/config.js';
import { makeRng } from '../core/rng.js';
import { buildPattern, aimAt, angDiff } from './patterns.js';
import { ENEMIES, makeEnemy, updateEnemy, resetEnemyIds } from './enemies.js';
import { makeBoss, updateBoss, damageBoss, damageBossPart } from './bosses.js';
import { buildFormation } from './formations.js';
import { getLevel } from './levels.js';
import { makePlayer, updatePlayer, hitPlayer, killPlayer, grazeBullet, addPower,
         addFlare, switchWeapon, nearestEnemyTo } from './player.js';
import { resolveCollisions } from './collide.js';
import { cadetForLevel } from './story.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const MARGIN = ARENA.margin;

export function createWorld({ level = 1, run, seed = 'halcyon', autofire = true } = {}) {
    const lv = getLevel(level);
    const diff = DIFFICULTY[run?.difficulty] ?? DIFFICULTY.pilot;
    const rng = makeRng(`${seed}:${level}`);
    resetEnemyIds();

    const w = {
        level: lv,
        levelNum: lv.id,
        run: run ?? { cadets: [], wing: {}, difficulty: diff.id, rescued: 0 },
        diff,
        rng,
        autofire,
        t: 0,
        phase: 'wave',            // wave → boss → clear → failed
        clearT: 0,
        cueIndex: 0,
        pendingSpawns: [],        // formation members waiting out their stagger

        player: null,
        enemies: [],
        pBullets: [],
        eBullets: [],
        pods: [],
        pickups: [],
        hazards: [],
        beams: [],
        waves: [],
        fields: [],

        boss: null,
        midboss: null,

        // Chorus beat — patterns flagged onBeat fire on the downbeat, and the
        // audio layer plays to the same clock, so level 4 literally is music.
        bpm: lv.bpm ?? 110,
        beatInterval: 60 / (lv.bpm ?? 110),
        beatIndex: 0,
        beatT: 0,

        podsSpawned: 0,
        podBudget: lv.podBudget,
        cadetBudget: lv.cadetBudget,
        cadetsAssigned: 0,
        heartMercy: false,

        stats: {
            score: 0,
            rescued: 0, lost: 0, cadets: 0, cadetsLost: 0,
            kills: 0, shots: 0, graze: 0, deaths: 0,
            flaresUsed: 0, maxChain: 0,
        },
        chain: 0,
        chainT: 0,

        fxQueue: [],
        shakeRequest: 0,
    };

    w.player = makePlayer(run);
    w.player.flareCd = 0;
    attachApi(w);
    return w;
}

// ----------------------------------------------------------------- world API

function attachApi(w) {
    /** Queue a view/audio event. Bounded so a headless run can't grow forever. */
    w.fx = (type, data = {}) => {
        w.fxQueue.push({ type, ...data });
        if (w.fxQueue.length > 600) w.fxQueue.splice(0, w.fxQueue.length - 600);
    };

    w.comms = (id) => w.fx('comms', { id });

    w.addScore = (n) => {
        const mult = 1 + Math.min(w.chain, 40) * 0.02;
        w.stats.score += Math.round(n * mult * w.diff.scoreMult);
    };

    w.bumpChain = () => {
        w.chain++;
        w.chainT = 2.4;
        w.stats.maxChain = Math.max(w.stats.maxChain, w.chain);
    };

    /** Turn an attack spec into live bullets (or a beam). */
    w.fire = (emitter, attack) => {
        const px = w.player.x, py = w.player.y;
        const ctx = {
            x: emitter.x + (attack.dx ?? 0),
            y: emitter.y + (attack.dy ?? 0),
            aimAng: aimAt(emitter.x, emitter.y, px, py),
            phase: emitter.spiralPhase ?? emitter.phase ?? 0,
            rng: w.rng,
            bulletSpeed: w.diff.bulletSpeed,
            density: w.diff.density,
            time: w.t,
        };
        const specs = buildPattern(attack, ctx);
        for (const s of specs) {
            if (s.beam) { spawnBeam(w, s.beam, emitter); continue; }
            spawnEnemyBullet(w, s);
        }
        w.fx('enemyFire', { x: ctx.x, y: ctx.y, pattern: attack.pattern, count: specs.length });
        return specs.length;
    };

    w.spawnPlayerBullet = (spec) => {
        w.stats.shots++;
        w.pBullets.push({
            x: spec.x, y: spec.y,
            ang: spec.ang,
            speed: spec.speed,
            vx: Math.cos(spec.ang) * spec.speed,
            vy: Math.sin(spec.ang) * spec.speed,
            r: spec.r ?? 0.22,
            dmg: spec.dmg ?? 6,
            kind: spec.kind ?? 'dart',
            color: spec.color ?? COLORS.player,
            pierce: spec.pierce ?? 0,
            homing: spec.homing ?? 0,
            hits: null,
            life: 0,
            alive: true,
        });
    };

    w.spawnEnemy = (type, x, y, opts = {}) => {
        if (!ENEMIES[type]) throw new Error(`[world] unknown enemy "${type}"`);
        const e = makeEnemy(type, x, y, { ...opts, hpMult: (opts.hpMult ?? 1) * w.diff.enemyHp }, w);
        w.enemies.push(e);
        return e;
    };

    /**
     * Pods draw their passengers from the LEVEL'S cadet budget, so the cadets
     * a level can possibly yield is exactly its share of the Halcyon roll —
     * never more (dev/playthrough.mjs caught a version that could return 357
     * cadets out of a roll of 211). The last pod of a level takes whatever is
     * left over, so a full sweep is always the exact number.
     */
    w.spawnPod = (x, y, opts = {}) => {
        if (w.podsSpawned >= w.podBudget) return null;
        w.podsSpawned++;
        const podsAfterThis = w.podBudget - w.podsSpawned;
        const cadetsLeft = w.cadetBudget - w.cadetsAssigned;
        let cadets;
        if (podsAfterThis <= 0) {
            cadets = clamp(cadetsLeft, 1, 8);
        } else {
            const share = cadetsLeft / (podsAfterThis + 1);
            const ceiling = Math.max(1, Math.min(POD.maxCadets, cadetsLeft - podsAfterThis));
            cadets = clamp(Math.round(share + w.rng.range(-0.8, 0.8)), POD.minCadets, ceiling);
        }
        w.cadetsAssigned += cadets;
        const pod = {
            x: clamp(x, ARENA.left + 1, ARENA.right - 1),
            y: y ?? ARENA.top + 1.5,
            r: POD.radius,
            hp: POD.hp + (w.run?.wing?.patchwork ? 1 : 0),
            maxHp: POD.hp + (w.run?.wing?.patchwork ? 1 : 0),
            cadets,
            vx: opts.vx ?? w.rng.range(-0.6, 0.6),
            vy: -(opts.speed ?? POD.driftSpeed),
            burn: w.level.burn ? POD.burnTime : 0,
            spin: w.rng.range(-1.4, 1.4),
            alive: true,
            hitFlash: 0,
        };
        w.pods.push(pod);
        w.fx('podSpawn', { x: pod.x, y: pod.y, cadets });
        return pod;
    };

    w.spawnPickup = (x, y, type) => {
        const p = {
            x: clamp(x, ARENA.left + 0.8, ARENA.right - 0.8),
            y, type,
            r: PICKUP.radius,
            vx: 0, vy: -PICKUP.fallSpeed,
            life: PICKUP.life,
            alive: true,
        };
        w.pickups.push(p);
        return p;
    };

    w.spawnHazard = (h) => {
        w.hazards.push({ life: 4, damage: 1, alive: true, t: 0, ...h });
    };

    w.spawnWave = (spec) => {
        w.waves.push({ t: 0, alive: true, ...spec });
    };

    w.spawnField = (spec) => {
        w.fields.push({ t: 0, alive: true, ...spec });
    };

    /** Flare / boss-death bullet clear. Returns how many bullets were erased. */
    w.clearEnemyBullets = ({ x = 0, y = 0, radius = Infinity, score = false } = {}) => {
        let n = 0;
        for (const b of w.eBullets) {
            if (!b.alive) continue;
            if (radius !== Infinity && (b.x - x) ** 2 + (b.y - y) ** 2 > radius * radius) continue;
            b.alive = false;
            n++;
            if (score) w.addScore(12);
        }
        for (const bm of w.beams) if (radius === Infinity) bm.alive = false;
        if (n) w.fx('bulletsCleared', { x, y, count: n });
        return n;
    };

    /** Area damage (flares, flare fields, the Heart's shockwaves). */
    w.damageArea = (x, y, radius, amount, source = 'area') => {
        const r2 = radius * radius;
        for (const e of w.enemies) {
            if (!e.alive) continue;
            if ((e.x - x) ** 2 + (e.y - y) ** 2 > r2) continue;
            damageEnemy(w, e, amount, source);
        }
        if (w.boss && w.boss.alive) {
            if ((w.boss.x - x) ** 2 + (w.boss.y - y) ** 2 <= r2) {
                damageBoss(w.boss, w, amount);
            }
        }
    };

    w.onPlayerDeath = () => {
        w.stats.deaths++;
        w.chain = 0;
        w.shakeRequest = Math.max(w.shakeRequest, 1.4);
        if (w.player.lives < 0) {
            w.phase = 'failed';
            w.fx('runFailed', {});
        }
    };

    w.onBossDefeated = (b) => {
        w.addScore(b.def.score);
        w.fx('bossDefeated', { boss: b.id, x: b.x, y: b.y });
        w.shakeRequest = 1.8;
        // The boss was holding prisoners: everything left in the level's pod
        // budget is released here, so a full run always sees the whole roll.
        const remaining = w.podBudget - w.podsSpawned;
        for (let i = 0; i < remaining; i++) {
            const pod = w.spawnPod(
                w.rng.range(ARENA.left + 2, ARENA.right - 2),
                ARENA.top - w.rng.range(0, 3),
                { speed: POD.driftSpeed * 0.7 },
            );
            if (pod) pod.fromBoss = true;
        }
        const cadet = cadetForLevel(w.levelNum);
        if (cadet) w.fx('cadetRescued', { cadet: cadet.id });
        w.phase = 'clear';
        w.clearT = 0;
    };
}

// ------------------------------------------------------------ bullet spawning

function spawnEnemyBullet(w, s) {
    w.eBullets.push({
        x: s.x, y: s.y,
        ang: s.ang,
        speed: s.speed,
        r: s.r,
        kind: s.kind,
        color: s.color,
        turn: s.turn ?? 0,
        homing: s.homing ?? 0,
        homingUntil: s.homingUntil ?? 0,
        speedKeys: s.speedKeys ?? null,
        burstAt: s.burstAt ?? 0,
        burstSpec: s.burstSpec ?? null,
        life: 0,
        maxLife: s.maxLife ?? 12,
        grazed: false,
        alive: true,
    });
}

function spawnBeam(w, spec, owner) {
    w.beams.push({
        x: spec.x, y: spec.y,
        ang: spec.ang,
        width: spec.width,
        length: spec.length,
        warn: spec.warn,
        duration: spec.duration,
        sweep: spec.sweep ?? 0,
        color: spec.color,
        follow: spec.follow ? owner : null,
        t: 0,
        alive: true,
    });
    w.fx('beamWarn', { x: spec.x, y: spec.y, ang: spec.ang, warn: spec.warn });
}

// ------------------------------------------------------------------- damage

export function damageEnemy(w, e, amount, source = 'bullet') {
    if (!e.alive) return false;
    e.hp -= amount;
    e.hitFlash = 1;
    if (e.hp > 0) return false;

    e.alive = false;
    w.stats.kills++;
    w.bumpChain();
    w.addScore(e.score ?? 100);
    w.fx('enemyDeath', { x: e.x, y: e.y, enemy: e.type, big: !!e.def.elite || !!e.isMidboss });
    e.def.onDeath?.(e, w);
    if (e.isMidboss) {
        w.shakeRequest = Math.max(w.shakeRequest, 1.1);
        w.fx('midbossDefeated', { x: e.x, y: e.y });
        for (let i = 0; i < 2; i++) w.spawnPod(e.x + (i - 0.5) * 2, e.y);
        w.spawnPickup(e.x, e.y, 'flare');
        w.spawnPickup(e.x - 1.4, e.y, 'power');
    } else {
        rollDrop(w, e);
    }
    return true;
}

function rollDrop(w, e) {
    const roll = w.rng();
    const big = (e.def.hp ?? 5) >= 14;
    if (roll < (big ? 0.34 : 0.07)) w.spawnPickup(e.x, e.y, 'power');
    else if (roll < (big ? 0.42 : 0.1)) w.spawnPickup(e.x, e.y, 'weapon');
    else if (roll < (big ? 0.48 : 0.12)) w.spawnPickup(e.x, e.y, 'flare');
    else if (roll < (big ? 0.62 : 0.24)) w.spawnPickup(e.x, e.y, 'gem');
}

// --------------------------------------------------------------- cue handling

function runCues(w) {
    const cues = w.level.cues;
    while (w.cueIndex < cues.length && cues[w.cueIndex].t <= w.t) {
        const cue = cues[w.cueIndex++];
        switch (cue.kind) {
            case 'wave': {
                const members = buildFormation(cue.formation, cue.count, cue.opts ?? {}, w.rng);
                for (const mem of members) {
                    w.pendingSpawns.push({
                        at: w.t + (mem.delay ?? 0),
                        type: cue.enemy,
                        x: mem.x, y: mem.y,
                        opts: { ...(mem.opts ?? {}), ...(cue.opts?.each ?? {}) },
                    });
                }
                break;
            }
            case 'pods': {
                for (let i = 0; i < cue.count; i++) {
                    w.pendingSpawns.push({
                        at: w.t + i * 0.55,
                        pod: true,
                        x: w.rng.range(ARENA.left + 2, ARENA.right - 2),
                        y: ARENA.top + 1.4,
                        opts: cue.opts ?? {},
                    });
                }
                break;
            }
            case 'comms':
                w.comms(cue.id);
                break;
            case 'midboss': {
                const e = w.spawnEnemy(cue.enemy, 0, ARENA.top + 3, {
                    hp: cue.opts.hp, holdY: cue.opts.holdY, homeX: 0, hpMult: 1,
                });
                e.isMidboss = true;
                e.r *= 1.6;
                e.score *= 6;
                w.midboss = e;
                w.fx('midbossWarning', { name: ENEMIES[cue.enemy].name });
                for (const [i, type] of (cue.opts.escort ?? []).entries()) {
                    w.pendingSpawns.push({
                        at: w.t + 1.2 + i * 0.4,
                        type,
                        x: (i - (cue.opts.escort.length - 1) / 2) * 3.4,
                        y: ARENA.top + 2,
                        opts: { ...(cue.opts.escortOpts ?? {}) },
                    });
                }
                break;
            }
            case 'boss':
                startBoss(w, cue.id);
                break;
            default:
                throw new Error(`[world] unknown cue kind "${cue.kind}"`);
        }
    }

    for (let i = w.pendingSpawns.length - 1; i >= 0; i--) {
        const s = w.pendingSpawns[i];
        if (s.at > w.t) continue;
        w.pendingSpawns.splice(i, 1);
        if (s.pod) w.spawnPod(s.x, s.y, s.opts);
        else w.spawnEnemy(s.type, s.x, s.y, s.opts);
    }
}

function startBoss(w, id) {
    if (w.boss) return;
    w.boss = makeBoss(id, w);
    w.phase = 'boss';
    w.pendingSpawns.length = 0;
    w.fx('bossWarning', { boss: id, name: w.boss.def.name, title: w.boss.def.title });
}

// ---------------------------------------------------------------- entity step

function stepEnemyBullets(w, dt) {
    const px = w.player.x, py = w.player.y;
    for (const b of w.eBullets) {
        if (!b.alive) continue;
        b.life += dt;

        if (b.speedKeys) {
            const keys = b.speedKeys;
            let s = keys[keys.length - 1][1];
            for (let i = 0; i < keys.length - 1; i++) {
                const [t0, s0] = keys[i], [t1, s1] = keys[i + 1];
                if (b.life >= t0 && b.life < t1) {
                    const k = (b.life - t0) / Math.max(1e-5, t1 - t0);
                    s = s0 + (s1 - s0) * k;
                    break;
                }
                if (b.life < t0) { s = s0; break; }
            }
            b.speed = s;
        }

        if (b.turn) b.ang += b.turn * dt;

        if (b.homing && b.life < b.homingUntil) {
            const want = aimAt(b.x, b.y, px, py);
            const d = angDiff(b.ang, want);
            b.ang += clamp(d, -b.homing * dt, b.homing * dt);
        }

        if (b.burstSpec && b.burstAt && b.life >= b.burstAt) {
            b.alive = false;
            const specs = buildPattern(b.burstSpec, {
                x: b.x, y: b.y, aimAng: aimAt(b.x, b.y, px, py),
                phase: 0, rng: w.rng, bulletSpeed: w.diff.bulletSpeed, density: w.diff.density,
            });
            for (const s of specs) spawnEnemyBullet(w, s);
            w.fx('mineBurst', { x: b.x, y: b.y });
            continue;
        }

        b.x += Math.cos(b.ang) * b.speed * dt;
        b.y += Math.sin(b.ang) * b.speed * dt;

        if (b.life > b.maxLife
            || b.x < ARENA.left - MARGIN || b.x > ARENA.right + MARGIN
            || b.y < ARENA.bottom - MARGIN || b.y > ARENA.top + MARGIN * 3) {
            b.alive = false;
        }
    }
}

function stepPlayerBullets(w, dt) {
    for (const b of w.pBullets) {
        if (!b.alive) continue;
        b.life += dt;
        if (b.homing) {
            const target = b.target?.alive ? b.target : (b.target = nearestEnemyTo(w, b.x, b.y));
            if (target && target.alive) {
                const want = aimAt(b.x, b.y, target.x, target.y);
                const d = angDiff(b.ang, want);
                b.ang += clamp(d, -b.homing * dt, b.homing * dt);
            }
            b.vx = Math.cos(b.ang) * b.speed;
            b.vy = Math.sin(b.ang) * b.speed;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > ARENA.top + MARGIN || b.y < ARENA.bottom - MARGIN
            || b.x < ARENA.left - MARGIN || b.x > ARENA.right + MARGIN || b.life > 6) {
            b.alive = false;
        }
    }
}

function stepPods(w, dt) {
    for (const pod of w.pods) {
        if (!pod.alive) continue;
        pod.x += pod.vx * dt;
        pod.y += pod.vy * dt;
        if (pod.x < ARENA.left + 0.7 || pod.x > ARENA.right - 0.7) pod.vx *= -1;
        if (pod.hitFlash > 0) pod.hitFlash = Math.max(0, pod.hitFlash - dt * 4);

        if (pod.burn > 0) {
            pod.burn -= dt;
            if (pod.burn <= 0) { losePod(w, pod, 'burned'); continue; }
        }
        if (pod.y < ARENA.bottom - 1.2) losePod(w, pod, 'fell');
    }
}

export function losePod(w, pod, reason) {
    if (!pod.alive) return;
    pod.alive = false;
    w.stats.lost++;
    w.stats.cadetsLost += pod.cadets;
    w.chain = 0;
    w.fx('podLost', { x: pod.x, y: pod.y, reason, cadets: pod.cadets });
}

export function rescuePod(w, pod) {
    if (!pod.alive) return;
    pod.alive = false;
    pod.rescued = true;
    w.stats.rescued++;
    w.stats.cadets += pod.cadets;
    w.bumpChain();
    w.addScore(SCORE.podRescue + pod.cadets * SCORE.cadet);
    w.fx('podRescued', { x: pod.x, y: pod.y, cadets: pod.cadets, chain: w.chain });
    if (w.rng() < POD.powerChance) w.spawnPickup(pod.x, pod.y, 'power');
    if (w.stats.rescued > 0 && w.stats.rescued % 5 === 0) w.comms('pod_streak');
}

function stepPickups(w, dt) {
    const p = w.player;
    const magnetR = PLAYER.magnetRadius * (w.run?.wing?.magnet ? 3 : 1) * (p.odActive > 0 ? 3 : 1);
    for (const it of w.pickups) {
        if (!it.alive) continue;
        it.life -= dt;
        const d = Math.hypot(p.x - it.x, p.y - it.y);
        if (p.alive && d < magnetR) {
            const k = PICKUP.magnetSpeed * dt / Math.max(0.2, d);
            it.x += (p.x - it.x) * Math.min(1, k);
            it.y += (p.y - it.y) * Math.min(1, k);
        } else {
            it.y += it.vy * dt;
        }
        if (it.life <= 0 || it.y < ARENA.bottom - 1.5) it.alive = false;
    }
}

function stepHazards(w, dt) {
    for (const h of w.hazards) {
        if (!h.alive) continue;
        h.t += dt;
        h.life -= dt;
        h.x += (h.vx ?? 0) * dt;
        h.y += (h.vy ?? 0) * dt;
        if (h.life <= 0 || h.x < ARENA.left - 4 || h.x > ARENA.right + 4) h.alive = false;
    }
}

function stepBeams(w, dt) {
    for (const bm of w.beams) {
        if (!bm.alive) continue;
        bm.t += dt;
        if (bm.follow && bm.follow.alive !== false) { bm.x = bm.follow.x; bm.y = bm.follow.y; }
        if (bm.t > bm.warn && bm.sweep) bm.ang += bm.sweep * dt;
        if (bm.t > bm.warn + bm.duration) bm.alive = false;
    }
}

function stepWaves(w, dt) {
    for (const wv of w.waves) {
        if (!wv.alive) continue;
        wv.t += dt;
        wv.r += wv.speed * dt;
        if (wv.erasesPlayerBullets) {
            for (const b of w.pBullets) {
                if (!b.alive) continue;
                const d = Math.hypot(b.x - wv.x, b.y - wv.y);
                if (Math.abs(d - wv.r) < 1.2) b.alive = false;
            }
        }
        if (wv.r >= wv.maxR) wv.alive = false;
    }
}

function stepFields(w, dt) {
    for (const f of w.fields) {
        if (!f.alive) continue;
        f.t += dt;
        f.life -= dt;
        w.damageArea(f.x, f.y, f.r, f.dps * dt, 'field');
        if (f.life <= 0) f.alive = false;
    }
}

function compact(w) {
    w.enemies = w.enemies.filter((e) => e.alive);
    w.pBullets = w.pBullets.filter((b) => b.alive);
    w.eBullets = w.eBullets.filter((b) => b.alive);
    w.pods = w.pods.filter((p) => p.alive);
    w.pickups = w.pickups.filter((p) => p.alive);
    w.hazards = w.hazards.filter((h) => h.alive);
    w.beams = w.beams.filter((b) => b.alive);
    w.waves = w.waves.filter((x) => x.alive);
    w.fields = w.fields.filter((f) => f.alive);
    if (w.midboss && !w.midboss.alive) w.midboss = null;
}

// ------------------------------------------------------------------ main step

/** One fixed simulation tick. `input` is the snapshot from core/input.js. */
export function stepWorld(w, input, dt = TICK) {
    if (w.phase === 'failed' || w.phase === 'done') return;

    w.t += dt;

    // Chorus beat
    w.beatT += dt;
    while (w.beatT >= w.beatInterval) {
        w.beatT -= w.beatInterval;
        w.beatIndex++;
        w.fx('beat', { index: w.beatIndex });
    }

    if (w.chainT > 0) {
        w.chainT -= dt;
        if (w.chainT <= 0) w.chain = 0;
    }

    if (w.phase === 'wave') runCues(w);

    const p = w.player;
    if (p.flareCd > 0) p.flareCd = Math.max(0, p.flareCd - dt);
    updatePlayer(p, w, input, dt);

    for (const e of w.enemies) if (e.alive) updateEnemy(e, w, dt);
    if (w.boss && w.boss.alive) updateBoss(w.boss, w, dt);

    stepEnemyBullets(w, dt);
    stepPlayerBullets(w, dt);
    stepPods(w, dt);
    stepPickups(w, dt);
    stepHazards(w, dt);
    stepBeams(w, dt);
    stepWaves(w, dt);
    stepFields(w, dt);

    resolveCollisions(w, dt);
    compact(w);

    // The Heart's 45s mercy: if the final phase drags, open one more lane.
    if (w.boss?.id === 'heart' && w.boss.phaseIndex === 3 && w.boss.stateT > 45) w.heartMercy = true;

    if (w.phase === 'clear') {
        w.clearT += dt;
        if (w.clearT > 4.5 && w.pods.filter((x) => x.alive).length === 0) w.phase = 'done';
        if (w.clearT > 14) w.phase = 'done';
    }

    if (w.player.lives < 0 && w.player.respawnTimer <= 0 && !w.player.alive) {
        w.phase = 'failed';
    }
}

/** End-of-level summary used by the briefing screen and save.js. */
export function levelSummary(w) {
    const potential = w.podBudget;
    const ratio = potential ? w.stats.rescued / potential : 1;
    const rank = SCORE.ranks.find((r) => ratio >= r.ratio)?.rank ?? 'D';
    let bonus = 0;
    if (w.stats.lost === 0) bonus += SCORE.noLossBonus;
    bonus += w.player.flares * SCORE.flareUnused;
    return {
        level: w.levelNum,
        name: w.level.name,
        score: w.stats.score + bonus,
        bonus,
        rescued: w.stats.rescued,
        lost: w.stats.lost,
        cadets: w.stats.cadets,
        cadetsLost: w.stats.cadetsLost,
        budget: potential,
        kills: w.stats.kills,
        graze: w.player.graze,
        deaths: w.stats.deaths,
        maxChain: w.stats.maxChain,
        rank,
        cleared: w.phase === 'done' || w.phase === 'clear',
    };
}

export { damageBoss, damageBossPart, hitPlayer, killPlayer, grazeBullet, addPower, addFlare,
         switchWeapon, WEAPON_IDS };
