// The Hall of Faces: the cast. A list of characters, each with a heraldic device from their name, and an
// editor for every field (Thalion explains each one), their bonds to the others, and a web of the bonds.

import { h, rich, confirmBox, debounce, grow } from './dom.js';
import { sigilSvg, SIGIL_FIELDS, SIGIL_TINCTURES, SIGIL_SHAPES, CHARGES } from '../view/art.js';
import { CHAR_FIELDS, CHARACTER_ROLES, PEOPLES } from '../sim/data/guild.js';
import { charFleshed, charFill, roomOpen } from '../sim/progress.js';
import { countWords } from '../sim/text.js';
import { hashString } from '../rng.js';
import { FIELD } from '../config.js';
import * as A from '../sim/actions.js';
import { askThalion } from './hall.js';

export function deviceOf(c) {
    const k = hashString(c.id + ':' + (c.name || ''));
    const charges = Object.keys(CHARGES);
    return { shape: SIGIL_SHAPES[k % 4], field: SIGIL_FIELDS[(k >>> 3) % SIGIL_FIELDS.length], tincture: SIGIL_TINCTURES[(k >>> 7) % SIGIL_TINCTURES.length], charge: charges[(k >>> 11) % charges.length] };
}

export function facesView(app, root) {
    const S = app.S, P = app.P();
    let sel = P.characters.find((c) => c.id === app.faceSel)?.id || P.characters[0]?.id || null;
    const list = h('div', { class: 'cast', id: 'cast' });
    const editor = h('section', { class: 'card char-editor', id: 'char-editor' });

    function paintList() {
        list.innerHTML = '';
        list.append(h('div', { class: 'row-wrap' },
            h('button', { class: 'btn primary', id: 'char-new', onclick: () => { const c = A.addCharacter(S, {}, app.ctx()); app.after(); sel = c.id; app.faceSel = sel; paintList(); paintEditor(); editor.querySelector('#cf-name')?.select(); } }, '+ New character'),
            roomOpen(S, 'well') ? h('button', { class: 'btn', onclick: () => app.go('well') }, 'Draw a name') : null,
            h('button', { class: 'btn ghost', onclick: () => askThalion(app, 'faces') }, 'Ask Thalion')));
        if (!P.characters.length) list.append(h('p', { class: 'hint' }, 'No one here yet. Every story begins with someone who wants something.'));
        for (const c of P.characters) {
            const f = charFill(c);
            list.append(h('button', { class: `face-card${c.id === sel ? ' on' : ''}`, dataset: { char: c.id }, onclick: () => { sel = c.id; app.faceSel = sel; paintList(); paintEditor(); } },
                h('span', { class: 'face-sigil', html: sigilSvg(deviceOf(c), { label: '' }) }),
                h('span', { class: 'face-text' }, h('strong', {}, c.name || 'Unnamed'), h('span', { class: 'muted' }, [c.role, c.people].filter(Boolean).join(' · '))),
                h('span', { class: `flesh${charFleshed(c) ? ' done' : ''}`, title: `${Math.round(f * 100)}% fleshed out` }, h('i', { style: { width: `${f * 100}%` } }))));
        }
    }

    function paintEditor() {
        editor.innerHTML = '';
        const c = P.characters.find((x) => x.id === sel);
        if (!c) { editor.append(h('div', { class: 'empty' }, h('p', {}, 'Choose someone, or make someone new.'))); paintWeb(); return; }
        const save = debounce(() => { app.after(); paintList(); paintMeter(); }, 350);
        const meter = h('div', { class: 'flesh-meter' });
        const paintMeter = () => {
            const missing = CHAR_FIELDS.filter((f) => f.core && !(c[f.id] || '').trim()).map((f) => f.label);
            const bw = countWords(c.backstory);
            meter.innerHTML = '';
            meter.append(h('span', { class: `flesh big${charFleshed(c) ? ' done' : ''}` }, h('i', { style: { width: `${charFill(c) * 100}%` } })),
                h('span', { class: 'hint' }, charFleshed(c) ? 'Fleshed out. A real person.' : `To flesh them out: ${[...missing, bw < FIELD.fleshWords ? `a backstory of ${FIELD.fleshWords}+ words (${bw} so far)` : null].filter(Boolean).join(', ')}.`));
        };
        const fields = CHAR_FIELDS.map((f) => {
            let input;
            if (f.select === 'roles') input = h('select', { id: `cf-${f.id}` }, CHARACTER_ROLES.map((r) => h('option', { value: r, selected: c.role === r }, r)));
            else if (f.long) input = grow(h('textarea', { id: `cf-${f.id}`, rows: f.big ? 7 : 3, value: c[f.id] || '' }));
            else input = h('input', { type: 'text', id: `cf-${f.id}`, value: c[f.id] || '', maxlength: 200, list: f.list ? 'dl-peoples' : null });
            input.addEventListener('input', () => { A.editCharacter(S, c.id, { [f.id]: input.value }, app.ctx()); save(); });
            input.addEventListener('change', () => { A.editCharacter(S, c.id, { [f.id]: input.value }, app.ctx()); save.flush(); });
            const hint = h('p', { class: 'field-hint', hidden: true, html: rich(`Thalion: “${f.hint}”`) });
            const q = h('button', { class: 'q', type: 'button', 'aria-label': `What is ${f.label}?`, onclick: (e) => { e.preventDefault(); hint.hidden = !hint.hidden; } }, '?');
            return h('div', { class: `field${f.big ? ' wide' : ''}${f.core ? ' core' : ''}` }, h('div', { class: 'lbl-row' }, h('label', { class: 'lbl', for: `cf-${f.id}` }, f.label, f.core ? h('span', { class: 'req', title: 'Needed to flesh out' }, ' ✦') : null), q), hint, input);
        });

        // bonds
        const others = P.characters.filter((o) => o.id !== c.id);
        const bonds = h('div', { class: 'bonds' }, h('h3', {}, 'Bonds'),
            others.length ? others.map((o) => {
                const r = c.relations.find((x) => x.to === o.id);
                const inp = h('input', { type: 'text', value: r?.label || '', placeholder: 'sister, rival, owes a debt to…', maxlength: 80, 'aria-label': `Bond with ${o.name}`, dataset: { to: o.id } });
                inp.addEventListener('change', () => { A.setRelation(S, c.id, o.id, inp.value.trim(), app.ctx()); app.after(); paintWeb(); });
                return h('div', { class: 'bond' }, h('span', { class: 'bond-name' }, o.name), inp);
            }) : h('p', { class: 'hint' }, 'Bonds appear once there is someone else to be bound to.'));

        editor.append(
            h('div', { class: 'char-head' }, h('span', { class: 'big-sigil', html: sigilSvg(deviceOf(c), { label: `${c.name}’s device` }) }),
                h('div', {}, h('h2', {}, c.name || 'Unnamed'), meter),
                h('button', { class: 'btn ghost small', 'aria-label': 'Delete character', onclick: async () => {
                    if (!(await confirmBox(`Remove ${c.name}?`, 'Their page in the Hall of Faces, and every bond to them, will be gone.', { ok: 'Remove', danger: true }))) return;
                    A.deleteCharacter(S, c.id, app.ctx()); app.after();
                    sel = P.characters[0]?.id || null; paintList(); paintEditor();
                } }, 'Remove')),
            h('div', { class: 'char-grid' }, fields),
            bonds);
        paintMeter();
        paintWeb();
    }

    // a web of bonds: characters on a circle, bonds as labelled chords
    const web = h('section', { class: 'card web', id: 'web' });
    function paintWeb() {
        web.innerHTML = '';
        const cs = P.characters;
        web.append(h('h3', {}, 'The web of hearts'));
        if (cs.length < 2) { web.append(h('p', { class: 'hint' }, 'Two or more characters and a bond between them, and the web begins to spin.')); return; }
        const W = 420, H = 320, R = 120, cx = W / 2, cy = H / 2 + 4;
        const pos = Object.fromEntries(cs.map((c, i) => { const a = -Math.PI / 2 + (i / cs.length) * Math.PI * 2; return [c.id, [cx + Math.cos(a) * R, cy + Math.sin(a) * R]]; }));
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let svg = `<svg viewBox="0 0 ${W} ${H}" class="web-svg" role="img" aria-label="Bonds between characters">`;
        for (const c of cs) for (const r of c.relations) {
            if (!pos[r.to] || !r.label) continue;
            const [x1, y1] = pos[c.id], [x2, y2] = pos[r.to];
            const mx = (x1 + x2) / 2 + (cy - (y1 + y2) / 2) * 0.15, my = (y1 + y2) / 2 + ((x1 + x2) / 2 - cx) * 0.15;
            svg += `<path d="M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" class="chord"/><text x="${mx}" y="${my}" class="chord-lbl">${esc(r.label.slice(0, 22))}</text>`;
        }
        for (const c of cs) {
            const [x, y] = pos[c.id];
            svg += `<g class="node${c.id === sel ? ' on' : ''}"><circle cx="${x}" cy="${y}" r="16"/><text x="${x}" y="${y + 30}">${esc((c.name || '?').slice(0, 18))}</text><text x="${x}" y="${y + 5}" class="ini">${esc((c.name || '?').charAt(0))}</text></g>`;
        }
        web.insertAdjacentHTML('beforeend', svg + '</svg>');
    }

    root.append(h('datalist', { id: 'dl-peoples' }, PEOPLES.map((p) => h('option', { value: p }))),
        h('div', { class: 'room-head' }, h('h1', {}, 'The Hall of Faces'), h('p', { class: 'muted' }, `${P.characters.length} in the cast of “${P.title}”`)),
        h('div', { class: 'faces' }, h('div', { class: 'faces-side' }, list, web), editor));
    paintList();
    paintEditor();
    return null;
}
