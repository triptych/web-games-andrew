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
import { codexGrid, codexCount, codexTotal, codexClaimable, claimCodex, CODEX_STEP } from '../../sim/codex.js';
import { ELEMENT } from '../../data/core.js';
import { showRewards } from '../dom.js';
import { sfx } from '../../audio.js';

const F = { el: null, cls: null, star: 0, sort: 'power' };

export const heroesScreen = {
    id: 'heroes',
    tab: 'heroes',
    stage: 'citadel',
    enter(root, params) {
        this.root = root;
        this.releasing = null;
        this.view = params.view || this.view || 'roster';
        this.render();
    },
    codex() {
        const S = G.S, root = this.root;
        const grid = codexGrid(S);
        const n = codexCount(S), total = codexTotal();
        const table = h('div', { style: { display: 'grid', gridTemplateColumns: `minmax(92px, 1.4fr) repeat(5, 1fr)`, gap: '4px', alignItems: 'center' } });
        table.append(h('div'), ...ELEMENTS.map((e) => h('div.center', { html: elIcon(e) })));
        for (const c of CLASS_IDS) {
            table.append(h('div.small', { html: `${clsIcon(c)} ${CLASSES[c].name}` }));
            for (const e of ELEMENTS) {
                const st = grid[c][e];
                const seen = S.codex.seen.includes(`${c}:${e}`);
                table.append(h('div.center', { style: { height: '36px', borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 900, background: st ? `color-mix(in srgb, ${ELEMENT[e].color} 35%, #1a1236)` : seen ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.35)', border: `1px solid ${st ? ELEMENT[e].color : 'var(--line-soft)'}`, color: st >= 5 ? '#ffe08a' : '#fff' } }, st ? `${st}★` : seen ? '·' : '?'));
            }
        }
        const claim = codexClaimable(S);
        const body = h('div.sheet-body', h('div.wrap',
            h('p.muted.small', `Collect every class in every element. Each ${CODEX_STEP} new pairs earn gems; every fourth reward adds a Mystic Sigil. Pairs stay discovered even after a release.`),
            h('div.row', { style: { margin: '6px 0 10px' } }, h('div.grow', { html: `<b style="color:var(--gold-2)">${n}</b> / ${total} discovered` }),
                btn(claim ? `Claim (${claim})` : `Next at ${(S.codex.claimed + 1) * CODEX_STEP}`, () => { const r = claimCodex(S); if (!r) return; sfx('reward'); changed('codex'); showRewards('Codex Reward', r); this.render(); }, claim ? 'gold small' : 'ghost small', { disabled: !claim })),
            table));
        return body;
    },
    render() {
        const S = G.S;
        const root = this.root;
        root.innerHTML = '';
        const viewTabs = h('div.tabs', ...[['roster', 'Roster'], ['codex', `Codex${codexClaimable(S) ? ' •' : ''}`]].map(([k, l]) => h('button.tbtn', { class: this.view === k ? 'on' : '', onclick: () => { this.view = k; this.releasing = null; this.render(); } }, l)));
        if (this.view === 'codex') { root.append(h('div.sheet', h('div.sheet-head', h('h1', 'Heroes')), viewTabs, this.codex())); return; }
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
        const sheet = h('div.sheet', head, viewTabs, filters, body);
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
