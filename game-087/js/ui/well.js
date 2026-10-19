// The Muse's Well: lower the bucket for a name, a place, a story seed and (with talents) twists, quirks,
// magic, prophecies and titles. Keep a draw and it goes into the codex where it belongs.

import { h, rich, toast } from './dom.js';
import { DRAWS, drawOpen, PEOPLE_OF_NAMES } from '../sim/oracle.js';
import { TALENT_BY_ID } from '../sim/data/guild.js';
import * as A from '../sim/actions.js';
import { askThalion } from './hall.js';

const KEEP_LABEL = { character: 'Add to the Hall of Faces', place: 'Add to the Loft', premise: 'Use as the premise / keep in notes', magic: 'Add to the Loft as a magic', lore: 'Add to the Loft as lore', note: 'Keep in the novel’s notes' };

export function wellView(app, root) {
    const S = app.S;
    app.wellDraws ||= [];
    const people = h('select', { id: 'well-people', 'aria-label': 'Whose names' }, h('option', { value: '' }, 'Any people'), PEOPLE_OF_NAMES.map((p) => h('option', { value: p.id }, p.label)));
    const results = h('div', { class: 'draws', id: 'draws', 'aria-live': 'polite' });
    const bucket = h('div', { class: 'bucket', 'aria-hidden': 'true' }, h('span', { class: 'ripple' }), h('span', { class: 'ripple r2' }));

    const paintResults = () => {
        results.innerHTML = '';
        if (!app.wellDraws.length) results.append(h('p', { class: 'muted' }, 'The water is still. Lower the bucket.'));
        for (const d of app.wellDraws) {
            const keep = DRAWS.find((x) => x.id === d.kind).keep;
            results.append(h('article', { class: `draw${d.kept ? ' kept' : ''}`, dataset: { kind: d.kind } },
                h('p', { class: 'eyebrow' }, DRAWS.find((x) => x.id === d.kind).name), h('h3', {}, d.title),
                h('p', { class: 'draw-text', html: rich(d.text) }),
                d.kept ? h('p', { class: 'hint ok' }, 'Kept.') : h('button', { class: 'btn small primary', onclick: () => {
                    if (!app.P()) return;
                    A.keepDraw(S, d, app.ctx());
                    d.kept = true;
                    app.after();
                    toast(`Kept: ${d.title}`, { icon: '✦' });
                    paintResults();
                } }, KEEP_LABEL[keep])));
        }
    };

    const buttons = h('div', { class: 'well-buttons' }, DRAWS.map((d) => {
        const open = drawOpen(S, d.id);
        return h('button', { class: `well-btn${open ? '' : ' locked'}`, dataset: { draw: d.id }, disabled: !open, title: open ? d.blurb : `Needs the ${TALENT_BY_ID[d.talent].name} talent`, onclick: () => {
            const r = A.drawWell(S, d.id, { people: people.value }, app.ctx());
            app.after();
            if (!r) return;
            app.sound.pluck(app.sound.note(app.wellDraws.length % 8, 392), { vol: 0.08 });
            bucket.classList.remove('stir'); void bucket.offsetWidth; bucket.classList.add('stir');
            app.wellDraws.unshift(r);
            if (app.wellDraws.length > 14) app.wellDraws.length = 14;
            paintResults();
        } }, h('strong', {}, d.name), h('span', {}, open ? d.blurb : `Talent: ${TALENT_BY_ID[d.talent].name}`));
    }));

    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Muse’s Well'), h('button', { class: 'btn small ghost', onclick: () => askThalion(app, 'well') }, 'Ask Thalion')),
        h('section', { class: 'card well-card' }, bucket, h('div', {}, h('p', { class: 'muted', html: rich('Thalion: “Ideas are cheap. That is why the bucket is free. Take two and see what they make together.”') }),
            h('label', { class: 'field inline' }, h('span', { class: 'lbl' }, 'Names of'), people), buttons)),
        results);
    paintResults();
    return null;
}
