/**
 * bot.js — a competent-ish autoplayer for headless tests and balance runs.
 * It resolves every UI choice, fights what it sees, drinks when hurt, keeps
 * its lantern fed, equips upgrades, explores, and takes the stairs.
 */

import { CLASSES, SKILLS } from './classes.js';
import { cheb, T } from './tiles.js';
import { isGear } from './items.js';
import {
    act, blocker, storyNext, chooseEnding, choosePerk, closeDialog, acceptDialogQuest, autoExplore, travelStep,
    visibleHostiles, canTarget, skillState, pstats, distinctPages, buyOil, buy, price,
} from './game.js';

export function itemScore(run, it) {
    if (!it) return 0;
    let s = 0;
    if (it.dmg) {
        const style = it.style;
        const cls = run.p.cls;
        const fit = (cls === 'ranger' && style === 'ranged') || (cls === 'witch' && style === 'magic') || (cls === 'warden' && style === 'melee');
        s += (it.dmg[0] + it.dmg[1]) * (fit ? 2 : 0.6) + (it.acc || 0) * 0.3 + (it.crit || 0) * 0.3 + (it.spell || 0) * (cls === 'witch' ? 0.3 : 0);
    }
    if (it.arm !== undefined && it.k === 'armor') s += it.arm * 2.2 + (it.eva || 0) * 0.5 + (it.spell || 0) * (run.p.cls === 'witch' ? 0.25 : 0);
    const W = { dmg: 0.6, acc: 0.3, crit: 0.6, steal: 1.5, burn: 0.3, freeze: 0.5, poison: 0.3, hp: 0.35, arm: 2, eva: 0.6, regen: 2, light: 4, oil: 0.2, spell: run.p.cls === 'witch' ? 0.6 : 0.05, cdr: 6, thorns: 0.2, gold: 0.05, rFire: 0.1, rCold: 0.1, rPoison: 0.1, xp: 0.2, might: 1.5, agi: 1.5, will: 1.5 };
    for (const k in it.aff) s += (W[k] || 0.2) * it.aff[k];
    if (it.relic) s += 30;
    return s;
}

export function botStep(run) {
    const b = blocker(run);
    if (b === 'over') return false;
    if (b === 'story') {
        if (run.story[0].k === 'ending') return chooseEnding(run, distinctPages(run) >= 10 ? 'dawn' : 'vigil'), true;
        storyNext(run); return true;
    }
    if (b === 'perk') return choosePerk(run, pickPerk(run)), true;
    if (b === 'dialog') {
        const d = run.dialog;
        if (d.k === 'quest') acceptDialogQuest(run);
        else if (d.k === 'shop') {
            const o = run.objs.find((x) => x.id === d.obj);
            buyOil(run);
            for (const it of o.stock.slice()) if ((it.b === 'heal' || it.b === 'oil') && run.p.gold > price(it) + 40) buy(run, o.id, it.id);
            closeDialog(run);
        } else closeDialog(run);
        return true;
    }
    const p = run.p;
    const s = pstats(run);
    const inv = p.inv;
    const has = (b) => inv.find((it) => it.b === b);
    const foes = visibleHostiles(run).filter((m) => cheb(m.x, m.y, p.x, p.y) <= 1 || canTarget(run, m, Math.max(2, s.range)) || reachable(run, m));
    // Survival.
    if (p.hp < s.hpMax * (foes.length ? 0.4 : 0.25)) {
        const pot = has('heal2') && p.hp < s.hpMax * 0.25 ? has('heal2') : has('heal') || has('heal2');
        if (pot && act(run, { t: 'use', id: pot.id })) return true;
    }
    if ((p.st.poison || p.st.burn) && p.hp < s.hpMax * 0.5 && has('antidote') && act(run, { t: 'use', id: has('antidote').id })) return true;
    if (p.oil < 12 && has('oil') && act(run, { t: 'use', id: has('oil').id })) return true;
    // Upgrades.
    for (const it of inv) {
        if (!isGear(it)) continue;
        if (itemScore(run, it) > itemScore(run, p.eq[it.k]) + 0.5 && act(run, { t: 'equip', id: it.id })) return true;
    }
    // Drop junk when the pack is full.
    if (inv.length >= 19) {
        const junk = inv.filter((it) => isGear(it)).sort((a, b) => itemScore(run, a) - itemScore(run, b))[0];
        if (junk && act(run, { t: 'drop', id: junk.id })) return true;
    }
    // Remember who we were chasing, so a foe slipping out of sight doesn't cause dithering.
    const mem = run._bot || (Object.defineProperty(run, '_bot', { value: {}, enumerable: false, writable: true }), run._bot);
    if (foes.length) { mem.chase = { x: foes[0].x, y: foes[0].y, n: 25, floor: run.floor }; return fight(run, foes, s); }
    if (mem.chase && mem.chase.floor === run.floor && mem.chase.n-- > 0 && (p.x !== mem.chase.x || p.y !== mem.chase.y)) {
        const st = travelStep(run, mem.chase.x, mem.chase.y);
        if (st && act(run, st)) return true;
    }
    mem.chase = null;
    if (p.hp < s.hpMax * 0.6 && !run.lv.boss && run.turn % 10 !== 0 && p.oil > 30) return act(run, { t: 'wait' });
    // Explore, then the stairs.
    let e = autoExplore(run, true);
    if (e.stop === 'trap') e = autoExplore(run, true, true);
    if (e.t && act(run, e)) return true;
    const { down } = run.lv;
    if (run.lv.tiles[down.y * run.lv.w + down.x] !== T.STAIRS_DOWN) return act(run, { t: 'wait' });
    if (p.x === down.x && p.y === down.y) return act(run, { t: 'descend' });
    run.lv.seen[down.y * run.lv.w + down.x] = 1;
    const st = travelStep(run, down.x, down.y);
    if (st && act(run, st)) return true;
    return act(run, { t: 'wait' });
}

function reachable(run, m) {
    run.lv.seen[m.y * run.lv.w + m.x] = 1;
    return !!travelStep(run, m.x, m.y);
}

function fight(run, foes, s) {
    const p = run.p;
    foes.sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y));
    const near = foes[0];
    const d = cheb(near.x, near.y, p.x, p.y);
    // Step off a telegraphed tile if standing on one.
    const here = p.y * run.lv.w + p.x;
    if (run.hazards.some((h) => !h.friendly && h.tiles.includes(here))) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const i = (p.y + dy) * run.lv.w + p.x + dx;
            if (run.hazards.some((h) => !h.friendly && h.tiles.includes(i))) continue;
            if (act(run, { t: 'move', dx, dy })) return true;
        }
    }
    const adj = foes.filter((m) => cheb(m.x, m.y, p.x, p.y) <= 1);
    for (const sk of CLASSES[p.cls].skills) {
        if (!skillState(run, sk).ready) continue;
        if (sk === 'cleave' && adj.length >= 2 && act(run, { t: 'skill', s: sk })) return true;
        if (sk === 'bash' && adj.length && act(run, { t: 'skill', s: sk, id: adj[0].id })) return true;
        if (sk === 'warcry' && foes.filter((m) => cheb(m.x, m.y, p.x, p.y) <= 3).length >= 2 && act(run, { t: 'skill', s: sk })) return true;
        if (sk === 'bulwark' && (near.boss || p.hp < s.hpMax * 0.5) && d <= 2 && act(run, { t: 'skill', s: sk })) return true;
        if (sk === 'volley' && foes.length >= 2 && act(run, { t: 'skill', s: sk })) return true;
        if ((sk === 'pin' || sk === 'firebolt' || sk === 'mark') && canTarget(run, near, SKILLS[sk].range) && act(run, { t: 'skill', s: sk, id: near.id })) return true;
        if (sk === 'nova' && foes.filter((m) => cheb(m.x, m.y, p.x, p.y) <= 2).length >= 2 && act(run, { t: 'skill', s: sk })) return true;
        if (sk === 'meteor' && d >= 2 && act(run, { t: 'skill', s: sk, x: near.x, y: near.y })) return true;
    }
    if (d <= 1) return act(run, { t: 'move', dx: near.x - p.x, dy: near.y - p.y }) || act(run, { t: 'wait' });
    if (s.range > 1 && canTarget(run, near, s.range) && act(run, { t: 'fire', id: near.id })) return true;
    run.lv.seen[near.y * run.lv.w + near.x] = 1;
    const st = travelStep(run, near.x, near.y);
    if (st && act(run, st)) return true;
    return act(run, { t: 'wait' });
}

const PREF = { warden: ['tough', 'skin', 'brute', 'reaver', 'sentinel', 'vamp', 'regen', 'might'], ranger: ['hunter', 'brute', 'tough', 'fletcher', 'aim', 'agi', 'nimble', 'vamp'], witch: ['channel', 'pyro', 'tough', 'will', 'frostheart', 'regen', 'quick', 'vamp'] };
function pickPerk(run) {
    const opts = run.pending.opts;
    for (const k of PREF[run.p.cls]) if (opts.includes(k)) return k;
    return opts[0];
}
