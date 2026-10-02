// The shared fight page. Each fight type registers how it starts, ends and
// where you go afterwards in FIGHTS.

import { h } from '../engine/ui.js';
import { colorize } from '../colors.js';
import { playRound, tryRun, useSkill } from '../engine/combat.js';
import * as S from '../engine/state.js';
import { SPECIALTIES } from '../data/classes.js';
import { fmt } from '../rng.js';

export const FIGHTS = {};

function bar(label, cur, max, cls, sub = '') {
    const pct = Math.max(0, Math.min(100, (cur / max) * 100));
    return h('div', { class: 'fbar ' + cls },
        h('div', { class: 'fbar-l', html: colorize(label) + (sub ? ` <small>${sub}</small>` : '') }),
        h('div', { class: 'vbar ' + cls + (pct < 30 ? ' low' : '') }, h('i', { style: { width: pct + '%' } }), h('span', {}, `${fmt(Math.max(0, cur))} / ${fmt(max)}`)));
}

export function fightPage(g) {
    const p = g.p, f = p.fight;
    if (!f) return g.goto(p.alive ? 'village' : 'shades');
    const T = FIGHTS[f.type];
    g.title(T.title(g, f), { view: T.view(g, f), area: T.area || 'fight', banner: T.banner?.(g, f), keepScroll: false });
    const foe = f.foe;
    if (!f.over && g.scene && !g.scene.foe && !g.scene.pendingFoe) g.scene.showFoe(foe);
    g.add(h('div', { class: 'fight-bars' },
        bar(`\`^${foe.name}`, foe.hp, foe.maxhp, 'foe', `level ${foe.level}`),
        bar(p.alive || f.type === 'soul' ? `\`%${f.type === 'soul' ? 'Your soul' : p.name}\`0` : 'You', p.hp, f.type === 'soul' ? f.soulMax : S.maxHp(p), 'hp')));
    if (f.intro && f.round === 0) g.text(f.intro);
    // log, newest at the bottom; the latest round highlighted
    const log = h('div', { class: 'fight-log', role: 'log' });
    let lastR = -1, idx = 0;
    const newest = f.log.length ? f.log[f.log.length - 1].r : 0;
    const startNew = f.newFrom ?? f.log.length;
    for (const [i, e] of f.log.entries()) {
        if (e.r !== lastR) { log.append(h('div', { class: 'round-sep' }, e.r === 0 ? '' : `Round ${e.r}`)); lastR = e.r; }
        const isNew = i >= startNew;
        const el = h('p', { class: (e.r === newest ? 'cur' : 'old') + (isNew ? ' fresh' : ''), html: colorize(e.l) });
        if (isNew) el.style.animationDelay = (idx++ * 45) + 'ms';
        log.append(el);
    }
    if (f.log.length) g.add(log);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });

    if (f.over) {
        if (!f.resolved) resolve(g);
        g.lines(f.endLines || [], 'endlog');
        for (const n of T.after(g, f)) g.nav(n.section || 'Onward', n.label, n.action, n);
        return;
    }
    // actions
    const act = (fn) => () => { f.newFrom = f.log.length; const r = fn(); g.scene?.combatEvents?.(r?.events || []); g.audio?.combat(r?.events || []); if (f.over) resolve(g); };
    g.nav('Combat', 'Fight', act(() => playRound(p)), { key: 'f' });
    g.nav('Combat', 'Auto-fight 5 rounds', act(() => auto(g, 5)), { key: '5' });
    g.nav('Combat', 'Auto-fight to the end', act(() => auto(g, 200)), { key: 'a', tip: g.prefs.autoStop ? 'Stops if your health falls below a quarter' : '' });
    if (T.canRun) g.nav('Combat', 'Run away', act(() => {
        const r = tryRun(p);
        if (r.ok) f.log.push(...r.lines.map((l) => ({ r: f.round, l })));
        else f.log.splice(Math.max(0, f.log.length - (r.lines.length - 1)), 0, { r: f.round, l: r.lines[0] });
        return r;
    }), { key: 'r' });
    if (f.type !== 'soul') {
        const sp = SPECIALTIES[p.spec];
        sp.skills.forEach((sk, i) => {
            if (p.specLevel < sk.need) return;
            g.nav(`${sp.name} · ${p.specUses} use${p.specUses === 1 ? '' : 's'} left`, `${sk.name} (${sk.cost})`, act(() => useSkill(p, sk.id)), { key: String(i + 1), disabled: p.specUses < sk.cost, tip: sk.desc });
        });
    }
}

function auto(g, n) {
    const p = g.p, f = p.fight;
    const all = [];
    const startHp = p.hp;
    for (let i = 0; i < n && !f.over; i++) {
        const r = playRound(p);
        all.push(...r.events);
        const max = f.type === 'soul' ? f.soulMax : S.maxHp(p);
        if (g.prefs.autoStop && n > 5 && p.hp < max * 0.25 && !f.over) {
            f.log.push({ r: f.round, l: '`Q(Auto-fight paused: you are badly hurt.)' });
            break;
        }
    }
    return { events: all };
}

function resolve(g) {
    const p = g.p, f = p.fight;
    f.resolved = true;
    const T = FIGHTS[f.type];
    f.endLines = [];
    if (f.result === 'win') {
        g.scene?.foeDie?.();
        f.endLines.push(`\`b\`&You have defeated ${f.foe.name}!\`b`);
        T.win(g, f);
    } else if (f.result === 'lose') {
        T.lose(g, f);
    } else if (f.result === 'fled') {
        g.scene?.hideFoe?.();
        T.fled?.(g, f);
    }
    g.endFight();
}

export function leaveFight(g, to) {
    g.p.fight = null;
    g.scene?.hideFoe?.();
    return to;
}
