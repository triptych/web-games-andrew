/**
 * heroes.js — the collection: filter, sort, batch-release fodder.
 */

import { h, app, btn, heroCard, icon, elIcon, clsIcon, num, confirmBox, toast, modal } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { gearLookup } from '../../sim/state.js';
import { heroPower } from '../../sim/stats.js';
import { releaseHeroes, inTeam, fodderOk } from '../../sim/actions.js';
import { releaseValue } from '../../sim/heroes.js';
import { heroBusy } from '../../sim/idle.js';
import { ELEMENTS } from '../../data/core.js';
import { CLASS_IDS, CLASSES } from '../../data/classes.js';

const F = { el: null, cls: null, star: 0, sort: 'power' };

export const heroesScreen = {
    id: 'heroes',
    tab: 'heroes',
    stage: 'citadel',
    enter(root) {
        this.root = root;
        this.releasing = null;
        this.render();
    },
    render() {
        const S = G.S;
        const root = this.root;
        root.innerHTML = '';
        const gl = gearLookup(S);
        const pw = new Map(S.heroes.map((x) => [x.id, heroPower(x, { gearOf: gl, talents: S.overlord.talents })]));
        let list = S.heroes.filter((x) => (!F.el || x.el === F.el) && (!F.cls || x.cls === F.cls) && (!F.star || x.star === F.star));
        const by = { power: (a, b) => pw.get(b.id) - pw.get(a.id), star: (a, b) => b.star - a.star || b.level - a.level, level: (a, b) => b.level - a.level || b.star - a.star, newest: (a, b) => b.id - a.id, grade: (a, b) => 'SABC'.indexOf(a.grade) - 'SABC'.indexOf(b.grade) || b.star - a.star };
        list.sort(by[F.sort]);
        const rel = this.releasing;
        const head = h('div.sheet-head', h('h1', `Heroes `, h('span.muted.small', `${S.heroes.length}`)),
            rel ? btn('Cancel', () => { this.releasing = null; this.render(); }, 'ghost small') : btn(`${icon('trash')} Release`, () => { this.releasing = new Set(); this.render(); }, 'ghost small'));
        const filters = h('div', { style: { padding: '8px 12px 0' } },
            h('div.chips', { style: { marginBottom: '6px' } },
                h('button.chip', { class: !F.el ? 'on' : '', onclick: () => { F.el = null; this.render(); } }, 'All'),
                ...ELEMENTS.map((e) => h('button.chip', { class: F.el === e ? 'on' : '', 'aria-label': e, html: elIcon(e), onclick: () => { F.el = F.el === e ? null : e; this.render(); } })),
                h('select.sel', { 'aria-label': 'Class', onchange: (e) => { F.cls = e.target.value || null; this.render(); } }, h('option', { value: '' }, 'All classes'), ...CLASS_IDS.map((c) => h('option', { value: c, selected: F.cls === c ? true : null }, CLASSES[c].name))),
                h('select.sel', { 'aria-label': 'Stars', onchange: (e) => { F.star = +e.target.value; this.render(); } }, h('option', { value: 0 }, 'All ★'), ...[1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: F.star === n ? true : null }, n + '★'))),
                h('select.sel', { 'aria-label': 'Sort', onchange: (e) => { F.sort = e.target.value; this.render(); } }, ...[['power', 'Power'], ['star', 'Stars'], ['level', 'Level'], ['grade', 'Grade'], ['newest', 'Newest']].map(([v, l]) => h('option', { value: v, selected: F.sort === v ? true : null }, l)))),
        );
        const grid = h('div.hero-grid');
        for (const hero of list) {
            const busy = heroBusy(S, hero.id);
            const tag = inTeam(S, hero.id) && S.teams.main.includes(hero.id) ? 'TEAM' : busy ? busy.toUpperCase() : null;
            if (rel) {
                const ok = fodderOk(S, hero);
                app(grid, heroCard(hero, { tag, selected: rel.has(hero.id), dim: !ok, onClick: () => { if (!ok) { toast(hero.locked ? 'Locked heroes cannot be released.' : 'Remove this hero from teams and jobs first.'); return; } if (rel.has(hero.id)) rel.delete(hero.id); else rel.add(hero.id); this.render(); } }));
            } else app(grid, heroCard(hero, { tag, onClick: () => go('hero', { id: hero.id, list: list.map((x) => x.id) }) }));
        }
        const body = h('div.sheet-body', list.length ? grid : h('div.empty', 'No heroes match. Visit the Summoning Circle!'));
        const sheet = h('div.sheet', head, filters, body);
        if (rel) {
            let dust = 0, gold = 0;
            for (const id of rel) { const v = releaseValue(S.heroes.find((x) => x.id === id)); dust += v.dust; gold += v.gold; }
            app(sheet, h('div.sheet-foot', h('div.row',
                h('div.grow.small', { html: `${rel.size} selected · ${icon('dust')} ${num(dust)} Soul Dust · ${icon('gold')} ${num(gold)}` }),
                btn('Quick: 1–2★', () => { for (const x of S.heroes) if (x.star <= 2 && fodderOk(S, x) && x.level === 1) rel.add(x.id); this.render(); }, 'ghost small'),
                btn('Release', async () => {
                    if (!rel.size) return;
                    if ([...rel].some((id) => S.heroes.find((x) => x.id === id).star >= 4) && !(await confirmBox('Some selected heroes are 4★ or higher. Release them anyway?', 'Release', 'Cancel', 'red'))) return;
                    const r = releaseHeroes(S, [...rel]);
                    toast(`Released ${r.n} heroes for ${num(r.dust)} Soul Dust and ${num(r.gold)} gold.`, 'good');
                    this.releasing = null;
                    changed('release');
                    this.render();
                }, 'red small', { disabled: !rel.size }))));
        }
        app(root, sheet);
        // clearing NEW flags once seen
        setTimeout(() => { let n = 0; for (const x of S.heroes) if (x.isNew) { x.isNew = false; n++; } if (n) changed('seen'); }, 1500);
    },
    refresh(what) { if (what !== 'seen' && what !== 'tick') this.render(); },
};
