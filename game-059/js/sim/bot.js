/**
 * bot.js — a competent-enough autoplayer. Drives the title-screen attract
 * demo and dev/simtest.mjs (which proves every stage and boss can be beaten).
 * It only produces input; it never touches world state directly.
 */

import { ITEMS } from './items.js';

export function makeBot(opts = {}) {
    const st = { propT: {}, t: 0, toggle: false, jumpCd: 0, specCd: 0, wander: 0, skill: opts.skill ?? 1 };
    return function botInput(w, dt) {
        st.t += dt; st.toggle = !st.toggle; st.jumpCd -= dt; st.specCd -= dt;
        const p = w.player;
        const inp = { x: 0, z: 0, atk: false, jump: false, spec: false, ovr: false, run: false, specHeld: false };
        if (!p || p.state === 'dead') return inp;

        // dodge sweeping hazards
        for (const h of w.hazards) {
            if (h.type === 'gantry' && h.moving && Math.abs(h.x - p.x) < 70 && st.jumpCd <= 0) { inp.jump = true; st.jumpCd = 0.8; return inp; }
            if (h.type === 'forklift' && h.started && Math.abs(h.z - p.z) < 16) { inp.z = h.z > p.z ? -1 : 1; if (p.z <= w.zMin + 2) inp.z = 1; if (p.z >= w.zMax - 2) inp.z = -1; }
            if (h.type === 'beam' && h.t < h.delay + h.dur && Math.abs(h.z - p.z) < 14) { inp.z = h.z > p.z ? -1 : 1; if (p.z <= w.zMin + 2) inp.z = 1; if (p.z >= w.zMax - 2) inp.z = -1; return inp; }
            if ((h.type === 'reticle' || h.type === 'shadow' || h.type === 'slashmark') && Math.abs(h.x - p.x) < 44 && Math.abs(h.z - p.z) < 24) { inp.x = h.x > p.x ? -1 : 1; inp.z = h.z > p.z ? -1 : 1; return inp; }
            if (h.type === 'laser' && (h.active || h.warning) && Math.abs(h.x - p.x) < 26) { inp.x = h.x > p.x ? -1 : 1; return inp; }
        }
        if (p.state === 'grabbed') { inp.atk = st.toggle; return inp; }
        if (w.player.meter >= 100 && st.toggle) inp.ovr = true;

        const foes = w.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead' && !f.intangible && f.x > w.camL - 10 && f.x < w.camR + 10);
        // grab food when hurt
        if (p.hp < p.maxHp * 0.55 || foes.length === 0) {
            const food = w.items.filter((it) => ITEMS[it.type].kind !== 'weapon' && it.x > w.camL + 14 && it.x < w.camR - 14).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
            if (food && Math.abs(food.x - p.x) < 260) {
                inp.x = Math.abs(food.x - p.x) > 4 ? Math.sign(food.x - p.x) : 0;
                inp.z = Math.abs(food.z - p.z) > 3 ? Math.sign(food.z - p.z) : 0;
                if (foes.length === 0 || Math.abs(food.x - p.x) < 80) return inp;
            }
        }
        if (foes.length === 0) {
            // break props in reach, then walk on
            const prop = w.props.find((pr) => !pr.broken && Math.abs(pr.x - p.x) < 140 && pr.x > p.x - 20 && pr.x > w.camL + 14 && (st.propT[pr.id] = (st.propT[pr.id] || 0) + dt) < 4);
            if (prop && !w.lock) {
                const dz = prop.z - p.z, dx = prop.x - p.x;
                if (Math.abs(dz) > 6) inp.z = Math.sign(dz);
                if (Math.abs(dx) > 26) inp.x = Math.sign(dx);
                else { if (Math.sign(dx) !== p.face) inp.x = Math.sign(dx); else inp.atk = st.toggle; }
                return inp;
            }
            inp.x = w.lock ? (p.x < w.camX ? 1 : 0) : 1;
            inp.z = Math.abs(p.z - (w.zMin + w.zMax) / 2) > 10 ? -Math.sign(p.z - (w.zMin + w.zMax) / 2) : 0;
            return inp;
        }
        foes.sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.z - p.z) * 2) - (Math.abs(b.x - p.x) + Math.abs(b.z - p.z) * 2));
        const e = foes[0];
        const dx = e.x - p.x, dz = e.z - p.z, adx = Math.abs(dx);
        const close = foes.filter((f) => Math.abs(f.x - p.x) < 60 && Math.abs(f.z - p.z) < 16).length;

        if (close >= 3 && p.energy >= 20 && st.specCd <= 0 && (p.state === 'idle' || p.state === 'walk' || p.state === 'hurt')) { inp.spec = true; st.specCd = 1.2; return inp; }
        // stay out of a boss's face when it's winding up a big one
        if (e.boss && e.state === 'attack' && e.phase === 'st' && adx < (e.def.range + 30)) {
            inp.x = -Math.sign(dx); inp.z = dz > 0 ? -1 : 1;
            if (p.z <= w.zMin + 3) inp.z = 1; if (p.z >= w.zMax - 3) inp.z = -1;
            return inp;
        }
        const reach = e.flying ? 22 : (e.boss ? e.w + 22 : 30);
        if (Math.abs(dz) > 4) inp.z = Math.sign(dz);
        if (adx > reach + 4) { inp.x = Math.sign(dx); if (adx > 160 && !e.flying) inp.run = true; }
        else if (adx < reach - 12) inp.x = -Math.sign(dx);
        if (adx <= reach + 8 && Math.abs(dz) <= 6) {
            if (Math.sign(dx) !== p.face && p.state !== 'attack') { inp.x = Math.sign(dx); }
            else {
                inp.atk = st.toggle;
                if (e.flying && st.jumpCd <= 0 && p.state !== 'attack') { inp.jump = true; st.jumpCd = 1.2; }
                if (p.state === 'attack' && p.hitLanded && p.move && p.move.chain === 2 && (st.t % 3) < 1) inp.jump = true;
                if (e.boss && p.energy > 60 && st.specCd <= 0 && p.hitLanded && p.move && p.move.chain === 3) { inp.spec = true; st.specCd = 2; }
            }
        }
        if (p.state === 'grabbing') { inp.atk = st.toggle; inp.x = (st.t % 2 < 1) ? p.face : 0; }
        return inp;
    };
}
