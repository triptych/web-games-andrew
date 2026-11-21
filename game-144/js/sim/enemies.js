// Enemy movement and fire. Pure. Spawning and kills are in core.js; capital ships and bosses mount parts here too.

import { FIELD, SCROLL } from '../config.js';
import { ENEMIES } from './data/enemies.js';
import { emit, stepBurst, aimAngle } from './patterns.js';
import { spawnEnemy, killEnemy, hitPlayer, ev } from './core.js';

const onScreen = (e, m = 0.6) => e.x > m && e.x < FIELD.w - m && e.y > -0.5 && e.y < FIELD.h + 0.5;

function move(G, e, dt) {
    const m = e.mv;
    switch (ENEMIES[e.type].move) {
        case 'sine':
            e.vx = -(m.speed || 5.5);
            e.y = e.y0 + (m.amp ?? 1.6) * Math.sin((m.freq || 2.2) * e.t + (m.phase || 0));
            e.x += e.vx * dt;
            return;
        case 'swoop': {
            if (e.t < (m.enter || 0.7)) { e.vx = -(m.speed || 15); e.vy = 0; }
            else {
                if (m.ty == null) m.ty = G.player.y;
                e.vx += (-(m.out || 12) - e.vx) * Math.min(1, dt * 2);
                e.vy += ((m.ty - e.y) * 3 - e.vy) * Math.min(1, dt * 3);
            }
            break;
        }
        case 'drift':
            e.vx = -(m.speed ?? SCROLL); e.vy = m.vy || 0;
            break;
        case 'hover': {
            const hx = m.hx ?? 24, stay = m.stay ?? 9;
            if (e.t < stay) {
                e.vx = (hx - e.x) * 2.2;
                e.vy = ((m.hy ?? e.y0) + Math.sin(e.t * 1.3) * (m.bob ?? 0.8) - e.y) * 2;
            } else { e.vx -= 9 * dt; e.vy += (e.y < FIELD.h / 2 ? -3 : 3) * dt; }
            break;
        }
        case 'slow':
            e.vx = -(m.speed || 1.6);
            e.vy = Math.sin(e.t * 0.6) * 0.6;
            break;
        case 'glide':
            e.vx = -(m.speed || 4.2);
            e.y = e.y0 + (m.amp ?? 4) * Math.sin((m.freq || 0.9) * e.t + (m.phase || 0));
            e.x += e.vx * dt;
            return;
        case 'jet': {
            const ph = e.t % 1.3;
            if (ph < dt * 1.5) {
                const a = Math.atan2(G.player.y - e.y, -6) + (m.phase || 0) * 0.2;
                e.vx = Math.cos(a) * 9; e.vy = Math.sin(a) * 9;
            }
            e.vx *= Math.pow(0.12, dt); e.vy *= Math.pow(0.12, dt);
            e.vx -= 1.2 * dt;
            break;
        }
        case 'scatter':
            e.vx += (-3 - e.vx) * dt; e.vy *= Math.pow(0.4, dt);
            break;
        case 'ram': {
            if (e.t < 0.5) { e.vx = -6; e.vy = 0; m.a = aimAngle(G, e.x, e.y); }
            else { const s = Math.min(17, 6 + (e.t - 0.5) * 22); e.vx = Math.cos(m.a) * s; e.vy = Math.sin(m.a) * s; }
            break;
        }
        case 'serpent': {
            e.vx = -(m.speed || 3.2);
            e.y = e.y0 + (m.amp ?? 4.5) * Math.sin((m.freq || 1.1) * e.t);
            e.x += e.vx * dt;
            // a trail the body follows (kept short and in G so it saves)
            e.trail = e.trail || [];
            e.trailT = (e.trailT || 0) + dt;
            if (e.trailT >= 0.05) { e.trailT = 0; e.trail.unshift([e.x, e.y]); if (e.trail.length > 80) e.trail.pop(); }
            return;
        }
        case 'follow': {
            if (e.followBoss) return;              // the boss places its own body (bosses.js)
            const h = G.byId.get(e.parent);
            if (!h || h.dead) { e.vx = -3; e.x += e.vx * dt; return; }
            const tr = h.trail || [];
            const p = tr[Math.min(tr.length - 1, (e.ox | 0))];
            if (p) { e.x = p[0]; e.y = p[1]; } else { e.x = h.x + 1; e.y = h.y; }
            return;
        }
        case 'mounted': {
            const host = G.byId.get(e.parent) || (G.capital && G.capital.id === e.parent ? G.capital : null) || (G.boss && G.boss.id === e.parent ? G.boss : null);
            if (!host || host.dead) { if (!e.dead) killEnemy(G, e, 'host'); return; }
            e.x = host.x + e.ox; e.y = host.y + e.oy;
            return;
        }
        default:
            e.vx = -4;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
}

function fire(G, e, dt) {
    const d = ENEMIES[e.type];
    stepBurst(G, e, dt);
    if (e.noFire || !d.fire.length || !onScreen(e) || G.player.dead > 0) return;
    if (e.x < G.player.x + 1.2 && d.move !== 'mounted' && e.type !== 'carrier') return;   // never shoot from behind the player
    if (G.chill > 0) return;
    const [pat, every, prm] = d.fire[e.fi % d.fire.length];
    // no aimed shots point-blank: a bullet fired from two ships' lengths away can't be read, only guessed
    const close = Math.hypot(e.x - G.player.x, e.y - G.player.y) < 3.2 && (pat === 'aimed' || pat === 'stream' || pat === 'fan');
    if (prm.burst) {
        // fire continuously for `burst` seconds, then rest
        const period = prm.burst + 1.6 / G.erate;
        const ph = e.t % period;
        if (ph < prm.burst) {
            e.ft -= dt;
            if (e.ft <= 0) { e.ft += every; emit(G, pat, e, prm); }
        } else if (ph + dt >= period) e.fi++;
        return;
    }
    e.ft -= dt * G.erate;
    if (e.ft <= 0) {
        e.ft += every;
        if (close) return;
        if (d.chance != null && G.rng() > d.chance) return;
        emit(G, pat, e, prm);
        e.fi++;
    }
}

export function stepEnemies(G, dt) {
    const p = G.player;
    for (const e of G.enemies) {
        if (e.dead) continue;
        e.t += dt;
        if (e.flash > 0) e.flash -= dt;
        if (e.inv > 0) e.inv -= dt;
        move(G, e, dt);
        fire(G, e, dt);
        const d = ENEMIES[e.type];
        if (e.fuse && e.t > e.fuse && onScreen(e)) killEnemy(G, e, 'fuse');
        if (e.hatch && e.t > e.hatch && !e.dead) {
            e.dead = true;
            spawnEnemy(G, 'mote', e.x, e.y, { mv: { speed: 6, amp: 2 }, force: true });
            ev(G, 'hatch', { x: e.x, y: e.y });
        }
        // ramming: bodies hurt (mounted parts are part of a hull the walls code handles)
        if (!e.dead && d.move !== 'mounted' && p.dead <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r * 0.8 + p.hit) hitPlayer(G, 'ram');
    }
    // drop the dead and the gone
    G.enemies = G.enemies.filter((e) => !e.dead && (e.part || (e.x > -5 && e.x < 46 && e.y > -8 && e.y < 26)));
}

// ------------------------------------------------------------------ formations (used by stages and the endless director)
/** Spawn n enemies of a type entering from the right; `form` arranges them. Returns the spawned list. */
export function formation(G, type, form, o = {}) {
    const out = [];
    const n = o.n || 5;
    const y = o.y ?? 9;
    const add = (x, yy, extra = {}) => { const e = spawnEnemy(G, type, x, yy, { ...o, ...extra, mv: { ...(o.mv || {}), ...(extra.mv || {}) } }); if (e) out.push(e); return e; };
    switch (form) {
        case 'line':       // one after another, same height
            for (let i = 0; i < n; i++) add(FIELD.w + 1.5 + i * (o.gap || 1.6), y, { mv: { phase: i * 0.5 } });
            break;
        case 'column':     // a vertical wall entering together
            for (let i = 0; i < n; i++) add(FIELD.w + 1.5, (i + 0.5) * (FIELD.h / n) * (o.span || 1) + (o.top || 0), { mv: { phase: i * 0.7 } });
            break;
        case 'vee':
            for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; add(FIELD.w + 1.5 + Math.abs(k) * 1.4, y + k * 1.5); }
            break;
        case 'pair':       // top and bottom at once
            for (let i = 0; i < n; i++) { add(FIELD.w + 1.5 + i * 2.2, 3 + (o.inset || 0)); add(FIELD.w + 1.5 + i * 2.2, FIELD.h - 3 - (o.inset || 0)); }
            break;
        case 'rain':       // spread down the screen in sequence
            for (let i = 0; i < n; i++) add(FIELD.w + 1.5 + i * 1.2, 2 + ((i * 7) % 15), { mv: { phase: i } });
            break;
        case 'serpent': {
            const h = add(FIELD.w + 2, y);
            if (h) for (let i = 1; i <= (o.segments || ENEMIES.serpent.segments); i++) {
                const s = spawnEnemy(G, 'segment', h.x + i, y, { parent: h.id, ox: i * 4, force: true, delay: i * 0.3 });
                if (s) out.push(s);
            }
            break;
        }
        case 'single':
        default:
            add(o.x ?? FIELD.w + 2, y);
    }
    return out;
}
