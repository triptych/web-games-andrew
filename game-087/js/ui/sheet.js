// Your Sheet: who you are in the guild. Sigil and pen name, calling, level and rank, the five attributes,
// the talent tree (spend points), and the relics you carry (wear one of each kind).

import { h, fmt, modal } from './dom.js';
import { sigilSvg } from '../view/art.js';
import { sigilDesigner } from './dialogue.js';
import { ATTRS, TALENTS, TALENT_BRANCHES, RELICS, RELIC_SLOTS, CALLING_BY_ID, RANKS } from '../sim/data/guild.js';
import { levelProgress, rankName, attrCounts, attrLevel, talentStatus, pointsFree } from '../sim/progress.js';
import * as A from '../sim/actions.js';

const SLOT_NAME = { quill: 'Quill', inkwell: 'Inkwell', charm: 'Charm' };

export function sheetView(app, root) {
    const S = app.S, p = S.player;
    const lp = levelProgress(S);
    const calling = CALLING_BY_ID[p.calling];
    const counts = attrCounts(S, app.ctx().today);
    const nextRank = RANKS.find((r) => r.level > p.level);

    const id = h('section', { class: 'card sheet-id' },
        h('button', { class: 'sheet-sigil', 'aria-label': 'Change your sigil', title: 'Change your sigil', html: sigilSvg(p.sigil, { label: 'Your sigil' }), onclick: () => editSigil() }),
        h('div', {}, h('p', { class: 'eyebrow' }, calling ? calling.title : 'Apprentice'), h('h1', {}, p.name),
            h('p', {}, h('strong', {}, rankName(S)), ` · Level ${lp.level}`, nextRank ? h('span', { class: 'muted' }, ` · ${nextRank.name} at level ${nextRank.level}`) : null),
            h('div', { class: 'xpbar big' }, h('i', { style: { width: `${lp.frac * 100}%` } })),
            h('p', { class: 'hint' }, `${fmt(lp.xp)} XP · ${fmt(lp.hi - lp.xp)} to level ${lp.level + 1}`),
            calling ? h('p', { class: 'hint' }, calling.perk) : null,
            h('button', { class: 'btn small', onclick: async () => {
                const { promptBox } = await import('./dom.js');
                const n = await promptBox('Your pen name', { value: p.name });
                if (n) { A.setIdentity(S, { name: n }, app.ctx()); app.after(); app.refresh(); }
            } }, 'Change pen name')));

    const attrs = h('section', { class: 'card' }, h('h2', {}, 'Attributes'), h('div', { class: 'attrs' }, ATTRS.map((a) => {
        const L = attrLevel(a.steps, counts[a.id]);
        const next = a.steps[L];
        const lo = a.steps[L - 1];
        const f = next === undefined ? 1 : (counts[a.id] - lo) / (next - lo);
        return h('div', { class: 'attr', dataset: { attr: a.id } }, h('div', { class: 'attr-head' }, h('strong', {}, a.name), h('span', { class: 'attr-lv' }, String(L))),
            h('span', { class: 'meter' }, h('i', { style: { width: `${Math.max(0, Math.min(1, f)) * 100}%` } })),
            h('span', { class: 'hint' }, `${a.blurb} ${next === undefined ? 'Mastered.' : `${fmt(counts[a.id])} / ${fmt(next)}`}`));
    })));

    const free = pointsFree(S);
    const talents = h('section', { class: 'card talents-card', id: 'talents' }, h('div', { class: 'card-head' }, h('h2', {}, 'Talents'), h('span', { class: `chip${free > 0 ? ' gold' : ''}`, id: 'points' }, `${free} point${free === 1 ? '' : 's'} to spend`)),
        p.freePen ? h('p', { class: 'hint' }, 'Free Pen is on: every talent is yours to use. Turn it off in Settings to earn them.') : h('p', { class: 'hint' }, 'One point each level, and a few from the guild’s road.'),
        h('div', { class: 'branches' }, TALENT_BRANCHES.map((br) => h('div', { class: 'branch' }, h('h3', {}, br.name), h('p', { class: 'muted' }, br.blurb),
            TALENTS.filter((t) => t.branch === br.id).map((t) => {
                const st = talentStatus(S, t.id);
                const why = { level: `Level ${t.level}`, req: `After ${TALENTS.find((x) => x.id === t.req)?.name}`, points: 'No points', open: 'Learn', owned: p.freeTalent === t.id ? 'Your calling’s gift' : 'Learned' }[st];
                return h('div', { class: `talent ${st}`, dataset: { talent: t.id } }, h('strong', {}, t.name), h('span', { class: 'muted' }, t.blurb),
                    st === 'open' ? h('button', { class: 'btn small primary', onclick: () => { A.buyTalent(S, t.id, app.ctx()); app.after(); app.refresh(); } }, 'Learn')
                        : h('span', { class: `chip${st === 'owned' ? ' ok' : ''}` }, why));
            })))));

    const relics = h('section', { class: 'card', id: 'relics' }, h('h2', {}, 'Relics'), h('p', { class: 'hint' }, 'Wear one quill, one inkwell and one charm. The inkwell colours your writing desk.'),
        h('div', { class: 'slots' }, RELIC_SLOTS.map((slot) => h('div', { class: 'slot' }, h('h3', {}, SLOT_NAME[slot]),
            RELICS.filter((r) => r.slot === slot).map((r) => {
                const has = p.relics.includes(r.id);
                const on = p.equipped[slot] === r.id;
                return h('button', { class: `relic${on ? ' on' : ''}${has ? '' : ' locked'}`, disabled: !has, dataset: { relic: r.id }, 'aria-pressed': String(on), onclick: () => { A.wear(S, r.id, app.ctx()); app.after(); app.refresh(); } },
                    h('strong', {}, has ? r.name : '? ? ?'), h('span', { class: 'muted' }, has ? r.blurb : 'Not yet found.'));
            })))));

    root.append(h('div', { class: 'sheet' }, id, attrs, talents, relics));

    function editSigil() {
        modal((card, close) => {
            const d = sigilDesigner(p.sigil);
            card.append(h('h2', {}, 'Your sigil'), d, h('div', { class: 'row-end' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { A.setIdentity(S, { sigil: d.value() }, app.ctx()); app.after(); close(); app.refresh(); } }, 'Seal it')));
        }, { wide: true, label: 'Your sigil' });
    }
    return null;
}
