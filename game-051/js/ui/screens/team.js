/**
 * team.js — battle preparation: pick up to five heroes, see the leader
 * skill and the enemy elements, then fight.
 */

import { h, app, btn, heroCard, icon, elIcon, toast, num, modal, costLine } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { heroById, gearLookup } from '../../sim/state.js';
import { heroPower, powerOf } from '../../sim/stats.js';
import { enemyUnit } from '../../sim/units.js';
import { Rng } from '../../core/rng.js';
import { setTeam } from '../../sim/actions.js';
import { stageInfo, stageWaves, riftInfo, riftWaves, spireInfo, spireWaves, staminaCost, teamPower, rivalPower } from '../../sim/content.js';
import { ELEMENT, ELEMENTS, advantage, STAT_NAME } from '../../data/core.js';
import { BOSSES, SPECIES } from '../../data/world.js';
import { heroBusy } from '../../sim/idle.js';
import { sfx } from '../../audio.js';

function enemyElements(mode, p) {
    let waves = [];
    if (mode === 'campaign') waves = stageWaves(p.idx);
    else if (mode === 'rift') waves = riftWaves(p.id, p.tier);
    else if (mode === 'spire') waves = spireWaves(p.floor);
    else if (mode === 'arena') return [];
    const els = new Set();
    for (const w of waves) for (const r of w) els.add(r.el || (r.boss && BOSSES[r.boss].element));
    return [...els].filter(Boolean);
}

/** Recommended team power: the strongest wave's total, so ~equal power is a fair fight. */
function recommended(mode, p) {
    let waves = [];
    if (mode === 'campaign') waves = stageWaves(p.idx);
    else if (mode === 'rift') waves = riftWaves(p.id, p.tier);
    else if (mode === 'spire') waves = spireWaves(p.floor);
    const rng = new Rng(1);
    let best = 0;
    for (const w of waves) best = Math.max(best, w.reduce((s, r) => s + powerOf(enemyUnit(rng, r).st), 0));
    return Math.round(best * 0.9 / 100) * 100;
}

export function leaderText(l) {
    if (!l) return 'No leader skill';
    const v = l.stat === 'spd' ? `+${l.v} SPD` : `+${Math.round(l.v * 100)}% ${STAT_NAME[l.stat.replace('P', '')] || l.stat}`;
    return `${v} for ${l.scope === 'all' ? 'all allies' : ELEMENT[l.scope].name + ' allies'}`;
}

export const teamScreen = {
    id: 'team',
    stage: 'showcase',
    chrome: 'normal',
    enter(root, params) {
        this.params = params;
        const key = params.mode === 'arena' ? 'arena' : params.mode === 'spire' ? 'spire' : params.mode === 'rift' ? 'rift' : 'main';
        this.key = key;
        if (!G.S.teams[key].length && G.S.teams.main.length) G.S.teams[key] = G.S.teams.main.slice();
        this.sel = G.S.teams[key].filter((id) => heroById(G.S, id));
        this.sort = 'power';
        this.root = root;
        this.render();
    },
    render() {
        const S = G.S, p = this.params;
        const root = this.root;
        root.innerHTML = '';
        const st = peekStage('showcase');
        st.showMany(this.sel.map((id) => heroById(S, id)), { sheet: 0.6 });
        st.setTheme(this.sel.length ? heroById(S, this.sel[0]).el : 'dark');
        const gl = gearLookup(S);
        const pw = (hh) => heroPower(hh, { gearOf: gl, talents: S.overlord.talents });
        const sheet = h('div.sheet', { style: { top: '42%' } });
        let title = '', info = '', recommend = 0;
        if (p.mode === 'campaign') { const s = stageInfo(p.idx); title = `Stage ${s.label}`; info = s.name; }
        if (p.mode === 'rift') { const r = riftInfo(p.id, p.tier); title = r.name; info = 'Rift'; }
        if (p.mode === 'spire') { title = `Spire Floor ${p.floor}`; info = spireInfo(p.floor).boss ? 'Guardian floor' : 'Endless Spire'; }
        if (p.mode === 'arena') { const rv = S.arena.rivals[p.rival]; title = rv.name; info = `Power ${num(rivalPower(rv))}`; }
        if (p.mode !== 'arena') recommend = recommended(p.mode, p);
        const cost = staminaCost(p.mode, p);
        const els = enemyElements(p.mode, p);
        const head = h('div.sheet-head', btn(icon('back'), () => back(), 'ghost small', { aria: 'Back' }), h('h1', title), h('div.muted.small', info));
        const lead = this.sel.length ? heroById(S, this.sel[0]) : null;
        const slots = h('div.team-slots');
        for (let i = 0; i < 5; i++) {
            const id = this.sel[i];
            const slot = h('div.team-slot', { class: i === 0 ? 'leader' : '' }, id ? null : `Slot ${i + 1}`);
            if (id) app(slot, heroCard(heroById(S, id), { compact: true, onClick: () => { this.sel.splice(i, 1); this.save(); } }));
            slots.append(slot);
        }
        const total = this.sel.reduce((s, id) => s + pw(heroById(S, id)), 0);
        const matchup = h('div.matchup');
        if (els.length) {
            matchup.append(h('span.muted', 'Enemies:'));
            for (const e of els) matchup.append(h('span', { html: elIcon(e), title: ELEMENT[e].name }));
            const strong = ELEMENTS.filter((x) => els.some((e) => advantage(x, e) > 0));
            if (strong.length) matchup.append(h('span.muted', '· Strong vs them:'), ...strong.map((x) => h('span', { html: elIcon(x) })));
        }
        const body = h('div.sheet-body',
            h('div.wrap',
                slots,
                h('div.row', { style: { marginTop: '24px', flexWrap: 'wrap' } },
                    h('div.chip', { html: `${icon('sword')} Team Power <b style="color:var(--gold-2)">${num(total)}</b>` }),
                    recommend ? h('div.chip', { html: `Recommended ${num(recommend)}` }) : null,
                    lead && lead.leader ? h('div.chip', { html: `${icon('crown')} ${leaderText(lead.leader)}` }) : null),
                h('div', { style: { marginTop: '8px' } }, matchup),
                h('h2.sec', 'Roster', h('span.aside',
                    h('select.sel', { onchange: (e) => { this.sort = e.target.value; this.render(); } },
                        ...[['power', 'Power'], ['star', 'Stars'], ['level', 'Level'], ['el', 'Element']].map(([v, l]) => h('option', { value: v, selected: this.sort === v ? true : null }, l))))),
                this.roster(pw),
            ));
        const canRepeat = p.mode === 'campaign' || p.mode === 'rift';
        this.repeat = this.repeat || 1;
        const rep = canRepeat ? h('div.chips', { style: { marginBottom: '8px', alignItems: 'center' } }, h('span.small.muted', 'Repeat on win:'), ...[1, 3, 5, 10].map((n) => h('button.chip', { class: this.repeat === n ? 'on' : '', onclick: () => { this.repeat = n; this.render(); } }, n === 1 ? 'Off' : `×${n}`))) : null;
        const foot = h('div.sheet-foot', rep, h('div.btn-row',
            btn('Auto-fill', () => { this.autofill(pw); }, 'ghost'),
            btn(`Battle!${cost ? ` <small>${icon('stamina')}${cost}</small>` : ''}`, () => this.fight(), 'gold', { disabled: !this.sel.length })));
        app(sheet, head, body, foot);
        app(root, sheet);
    },
    roster(pw) {
        const S = G.S;
        const list = S.heroes.slice();
        const by = { power: (a, b) => pw(b) - pw(a), star: (a, b) => b.star - a.star || b.level - a.level, level: (a, b) => b.level - a.level, el: (a, b) => a.el.localeCompare(b.el) || pw(b) - pw(a) };
        list.sort(by[this.sort]);
        const grid = h('div.hero-grid');
        for (const hero of list) {
            const busy = heroBusy(S, hero.id);
            const on = this.sel.includes(hero.id);
            app(grid, heroCard(hero, { selected: on, tag: busy && busy === 'Exploring' ? busy : null, onClick: () => {
                if (on) this.sel = this.sel.filter((x) => x !== hero.id);
                else if (this.sel.length >= 5) { toast('A team holds five heroes.'); return; } else this.sel.push(hero.id);
                this.save();
            } }));
        }
        return grid;
    },
    autofill(pw) {
        const S = G.S;
        this.sel = S.heroes.slice().sort((a, b) => pw(b) - pw(a)).slice(0, 5).map((x) => x.id);
        // put a support/defense leader first when one is strong
        this.save();
    },
    save() {
        setTeam(G.S, this.key, this.sel);
        if (this.key !== 'main' && !G.S.teams.main.length) setTeam(G.S, 'main', this.sel);
        changed('team');
        this.render();
    },
    fight() {
        const S = G.S, p = this.params;
        if (!this.sel.length) return;
        const cost = staminaCost(p.mode, p);
        if (S.res.stamina < cost) {
            sfx('error');
            modal({ title: 'Not enough stamina', body: h('p', `You need ${cost} stamina. It refills by 1 every 2 minutes, and fully when your Overlord levels up.`), buttons: [{ label: 'Buy Stamina', cls: 'gold', onClick: () => go('market', { tab: 'gems' }) }, { label: 'OK', cls: 'ghost' }] });
            return;
        }
        if (p.mode === 'arena' && S.arena.tickets < 1) { toast('No Arena tickets left — one returns every hour.'); return; }
        setTeam(S, this.key, this.sel);
        go('battle', { ...p, team: this.sel.slice(), repeat: (p.mode === 'campaign' || p.mode === 'rift') ? this.repeat || 1 : 1 }, { fade: true });
    },
    refresh() {},
};
