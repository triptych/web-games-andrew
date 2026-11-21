// Shared rules every system uses: events, scoring and chains, drops, cancelling bullets, damage and kills. Pure.

import { LIMITS, SCORE, BURST, WEAPON } from '../config.js';
import { ENEMIES } from './data/enemies.js';
import { POWERUPS, POWERUP_KEYS } from './data/powerups.js';
import { emit } from './patterns.js';

export function ev(G, type, data = {}) {
    if (G.events.length < LIMITS.events) G.events.push({ type, ...data });
}

/** Score multiplier tier from the current chain: 1 + one per 10 kills, up to ×9. */
export function chainTier(G) { return 1 + Math.min(8, Math.floor(G.chain.n / 10)); }

export function addScore(G, n) {
    const before = G.score;
    G.score += Math.round(n);
    // extends at fixed scores
    while (G.nextExtend < SCORE.extends.length && G.score >= SCORE.extends[G.nextExtend]) {
        G.nextExtend++;
        G.lives++;
        ev(G, 'extend', { lives: G.lives });
    }
    if (G.mode === 'endless' && G.nextExtend >= SCORE.extends.length && Math.floor(G.score / 5e6) > Math.floor(before / 5e6)) {
        G.lives++;
        ev(G, 'extend', { lives: G.lives });
    }
}

export function addBurst(G, n) {
    if (G.player.burstT > 0) return;
    const k = G.syn.golden ? 2 : 1;
    G.burst = Math.min(BURST.max, G.burst + n * k);
}

// ------------------------------------------------------------------ items
export function pickPowerup(G) {
    let total = 0;
    for (const k of POWERUP_KEYS) total += POWERUPS[k].weight;
    let r = G.rng() * total;
    for (const k of POWERUP_KEYS) { r -= POWERUPS[k].weight; if (r <= 0) return k; }
    return 'P';
}

export function dropItem(G, kind, x, y, vx = -2.2, vy = 0) {
    if (G.items.length >= LIMITS.items) return null;
    const it = { id: G.nextId++, kind, x: Math.min(31, x), y, vx, vy: vy || (G.rng() - 0.5) * 3, t: 0 };
    G.items.push(it);
    return it;
}

/** Stars: score items. auto = fly to the player after a moment (bullet cancels). */
export function dropGems(G, x, y, n, auto = false) {
    for (let i = 0; i < n && G.items.length < LIMITS.items; i++) {
        const a = G.rng() * Math.PI * 2, s = 2 + G.rng() * 4;
        G.items.push({ id: G.nextId++, kind: 'gem', x, y, vx: Math.cos(a) * s - 1, vy: Math.sin(a) * s, t: 0, auto });
    }
}

/** Remove enemy bullets matching pred; each becomes a star when asGems (up to a cap, so a bomb doesn't flood). */
export function cancelBullets(G, pred, asGems = true, cap = 120) {
    let n = 0;
    const keep = [];
    for (const b of G.bullets) {
        if (pred(b)) {
            if (asGems && n < cap && G.items.length < LIMITS.items) G.items.push({ id: G.nextId++, kind: 'gem', x: b.x, y: b.y, vx: -1, vy: 0, t: 0, auto: true });
            n++;
        } else keep.push(b);
    }
    G.bullets = keep;
    if (n) ev(G, 'cancel', { n });
    return n;
}

// ------------------------------------------------------------------ enemies
export function spawnEnemy(G, type, x, y, o = {}) {
    const d = ENEMIES[type];
    if (!d) throw new Error('unknown enemy ' + type);
    if (G.enemies.length >= LIMITS.enemies && !o.force) return null;
    const hp = d.hp * (G.ehp || 1) * (o.hpMul || 1);
    const e = {
        id: G.nextId++, type, x, y, y0: y, x0: x, vx: 0, vy: 0, hp, maxhp: hp, r: d.r * (o.scale || 1),
        t: 0, fi: 0, ft: (d.firstShot ?? 1.2) + (o.delay || 0), ang: o.ang || 0, c: o.c ?? G.stageColor ?? 0,
        mv: { ...(o.mv || {}) }, flash: 0, drop: o.drop ?? null, parent: o.parent ?? null, ox: o.ox || 0, oy: o.oy || 0,
        part: o.part || null, scale: o.scale || 1, noFire: !!o.noFire, fuse: d.fuse || 0, hatch: d.hatch || 0,
    };
    G.enemies.push(e);
    ev(G, 'spawn', { id: e.id, enemy: type });
    return e;
}

/** Deal damage. Returns true if it killed. `from` is the hit's x (shield bearers block shots from their front). */
export function damageEnemy(G, e, dmg, kind = 'shot', fromX = null) {
    if (e.hp <= 0 || e.inv > 0) return false;
    const d = ENEMIES[e.type];
    if (d.shield && kind === 'shot' && fromX != null && fromX < e.x - 0.2) { e.flash = 0.05; e.blocked = (e.blocked || 0) + 1; return false; }
    e.hp -= dmg;
    e.flash = 0.06;
    if (e.hp <= 0) { killEnemy(G, e, kind); return true; }
    return false;
}

export function killEnemy(G, e, by = 'shot') {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const d = ENEMIES[e.type];
    // chain
    G.chain.n = G.chain.t > 0 ? G.chain.n + 1 : 1;
    G.chain.t = SCORE.chainWindow;
    G.chain.best = Math.max(G.chain.best, G.chain.n);
    const mul = chainTier(G) * (G.player.burstT > 0 ? 2 : 1);
    addScore(G, d.score * mul);
    addBurst(G, d.big ? BURST.bigKill : BURST.kill);
    G.kills++;
    ev(G, 'kill', { id: e.id, enemy: e.type, x: e.x, y: e.y, big: !!d.big, r: e.r, by, score: d.score * mul });
    // big enemies cancel the bullets near them into stars (CAVE-style)
    if (d.big) cancelBullets(G, (b) => Math.hypot(b.x - e.x, b.y - e.y) < 5 + e.r, true, 60);
    dropGems(G, e.x, e.y, d.big ? 8 : 1);
    const dropChance = e.drop ?? d.drop ?? 0.025;
    if (dropChance > 0 && G.rng() < dropChance) dropItem(G, pickPowerup(G), e.x, e.y);
    if (d.death && !e.part) emit(G, d.death[0], e, d.death[1]);
    if (d.revenge && G.diff >= 2) emit(G, 'aimed', e, { n: d.revenge, spread: 0.3, speed: 6 });
    if (d.split) for (let i = 0; i < 3; i++) {
        const s = spawnEnemy(G, d.split, e.x, e.y, { force: true });
        if (s) { const a = (i / 3) * Math.PI * 2 + 0.5; s.vx = Math.cos(a) * 5 - 2; s.vy = Math.sin(a) * 5; }
    }
}

// ------------------------------------------------------------------ player damage
/** The player is hit. A shield charge absorbs it; otherwise a life is lost. */
export function hitPlayer(G, cause = 'bullet') {
    const p = G.player;
    if (p.inv > 0 || p.dead > 0 || G.phase !== 'play') return false;
    if (G.god) return false;
    if (p.shield > 0) {
        p.shield--;
        p.inv = WEAPON.shieldInv;
        cancelBullets(G, (b) => Math.hypot(b.x - p.x, b.y - p.y) < WEAPON.shieldClear, true, 40);
        ev(G, 'shieldHit', { x: p.x, y: p.y, left: p.shield });
        return false;
    }
    p.dead = 1.6;
    G.deaths++;
    G.lives--;
    G.chain.n = 0; G.chain.t = 0;
    ev(G, 'die', { x: p.x, y: p.y, cause });
    cancelBullets(G, () => true, false);
    G.beams.length = 0;
    // drop some power so a death costs something, but leave a few capsules to pick back up
    const lost = [];
    if (p.power > 2) { p.power--; lost.push('P'); }
    if (p.options > 0) { p.options--; lost.push('O'); }
    if (p.rockets > 0) { p.rockets--; lost.push('R'); }
    for (const k of lost) dropItem(G, k, p.x + 3, p.y, 1.5, (G.rng() - 0.5) * 4);
    p.overdriveT = p.chronoT = 0;
    return true;
}
