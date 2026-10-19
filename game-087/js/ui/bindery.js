// The Bindery: how the book should look (title page, dedication, epigraph, headings, ornaments, typeface,
// page size, appendices, the map plate), a live preview, and the bindings: a web page, an EPUB, a print
// proof to save as a PDF, a manuscript for agents, and Markdown.

import { h, fmt, toast, download, field, debounce, grow } from './dom.js';
import * as A from '../sim/actions.js';
import { hasTalent, roomOpen } from '../sim/progress.js';
import { bookModel, buildHtml, buildPrint, buildManuscript, buildMarkdown, buildEpub, TYPEFACES, PAGE_SIZES, FLEURONS, HEADINGS, fileStem } from '../book/book.js';
import { sigilSvg } from '../view/art.js';
import { drawMap } from '../view/map.js';
import { bookWords } from '../sim/state.js';
import { askThalion } from './hall.js';

/** Render the novel's map as PNG: { url, bytes }. */
async function mapPng(P) {
    const c = document.createElement('canvas');
    c.width = 1500; c.height = 1000;
    drawMap(c.getContext('2d'), 1500, 1000, { seed: P.map.seed, title: P.title, pins: P.map.pins.map((p) => ({ ...p, label: P.world.find((e) => e.id === p.id)?.name || '' })) });
    const url = c.toDataURL('image/png');
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { url, bytes };
}

export function binderyView(app, root) {
    const S = app.S, P = app.P();
    const b = P.book;
    const can = { illum: hasTalent(S, 'b_illum'), append: hasTalent(S, 'b_append'), map: hasTalent(S, 'b_map') && roomOpen(S, 'loft'), ms: hasTalent(S, 'b_manuscript') };
    const preview = h('iframe', { class: 'preview', id: 'book-preview', title: 'Preview of the bound book', sandbox: 'allow-same-origin' });

    const model = (opts = {}) => bookModel(P, { illum: can.illum, appendices: can.append, sigilSvg: sigilSvg(S.player.sigil, { label: '' }), today: app.ctx().today, ...opts });
    const repaint = debounce(() => {
        const m = model();
        // the preview shows the first chapters only: a long book would make it slow to type in the form
        const short = { ...m, chapters: m.chapters.slice(0, 2) };
        preview.srcdoc = buildHtml(short);
    }, 300);

    const set = (k, v) => { A.editBook(S, { [k]: v }, app.ctx()); app.after(); repaint(); };
    const text = (k, label, { long = false, ph = '' } = {}) => {
        const el = long ? grow(h('textarea', { rows: 2, id: `bk-${k}`, value: b[k] || '', placeholder: ph })) : h('input', { type: 'text', id: `bk-${k}`, value: b[k] || '', placeholder: ph, maxlength: 400 });
        el.addEventListener('input', () => set(k, el.value));
        return field(label, el);
    };
    const check = (k, label, enabled = true, why = '') => {
        const el = h('input', { type: 'checkbox', id: `bk-${k}`, checked: !!b[k] && enabled, disabled: !enabled });
        el.addEventListener('change', () => set(k, el.checked));
        return h('label', { class: `check${enabled ? '' : ' off'}`, title: enabled ? '' : why }, el, ` ${label}`, enabled ? null : h('span', { class: 'muted' }, ` (${why})`));
    };
    const select = (k, label, options) => {
        const el = h('select', { id: `bk-${k}` }, Object.entries(options).map(([v, n]) => h('option', { value: v, selected: b[k] === v }, n)));
        el.addEventListener('change', () => set(k, el.value));
        return field(label, el);
    };

    const exp = async (kind) => {
        app.flushWriting?.();
        const stem = fileStem(P.title);
        const wantMap = can.map && b.map;
        const map = wantMap ? await mapPng(P) : null;
        let name = '', size = 0;
        if (kind === 'html') { const out = buildHtml(model({ mapSrc: map?.url })); name = `${stem}.html`; size = out.length; download(name, out, 'text/html'); }
        else if (kind === 'epub') { const out = buildEpub(model({ mapFile: !!map }), { mapPng: map?.bytes || null, modified: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }); name = `${stem}.epub`; size = out.length; download(name, new Blob([out], { type: 'application/epub+zip' })); }
        else if (kind === 'md') { const out = buildMarkdown(model()); name = `${stem}.md`; size = out.length; download(name, out, 'text/markdown'); }
        else if (kind === 'pdf') { const out = buildPrint(model({ mapSrc: map?.url })); name = 'print'; size = out.length; app.printHtml(out); }
        else if (kind === 'manuscript') { const out = buildManuscript(model()); name = 'manuscript'; size = out.length; app.printHtml(out); }
        app.lastExport = { kind, name, size };
        A.noteExport(S, kind === 'md' ? 'md' : kind, app.ctx());
        app.after();
        app.sound.page();
        if (kind === 'pdf' || kind === 'manuscript') toast('The print dialog is opening. Choose “Save as PDF” as the printer.', { ms: 6000 });
        else toast(`Bound: ${name}`, { icon: '✦' });
    };

    const w = bookWords(P);
    root.append(h('div', { class: 'room-head' }, h('h1', {}, 'The Bindery'), h('button', { class: 'btn small ghost', onclick: () => askThalion(app, 'bindery') }, 'Ask Thalion')),
        h('p', { class: 'muted' }, `“${P.title}”, ${fmt(w)} words. ${P.status === 'complete' ? 'Finished.' : 'Unfinished books can be bound too: it is how you see what the finished one will look like.'}`),
        h('div', { class: 'bindery' },
            h('section', { class: 'card bind-form' },
                h('h2', {}, 'Bind it'),
                h('div', { class: 'bind-buttons' },
                    h('button', { class: 'btn primary', id: 'bind-html', onclick: () => exp('html') }, 'Web page (.html)'),
                    h('button', { class: 'btn primary', id: 'bind-epub', onclick: () => exp('epub') }, 'E-book (.epub)'),
                    h('button', { class: 'btn primary', id: 'bind-pdf', onclick: () => exp('pdf') }, 'Print / PDF'),
                    h('button', { class: 'btn', id: 'bind-ms', disabled: !can.ms, title: can.ms ? '' : 'Needs the Agent’s Format talent', onclick: () => exp('manuscript') }, 'Manuscript (for agents)'),
                    h('button', { class: 'btn', id: 'bind-md', onclick: () => exp('md') }, 'Markdown (.md)')),
                h('p', { class: 'hint' }, 'The web page is one file that opens anywhere. The EPUB works in Apple Books, Kobo, Calibre and most readers (send it to a Kindle with Send to Kindle). For a PDF, choose “Save as PDF” in the print dialog.'),
                h('h3', {}, 'The title page'),
                text('author', 'Author (pen name)'),
                text('dedication', 'Dedication', { long: true, ph: 'For …' }),
                text('epigraph', 'Epigraph', { long: true, ph: 'A line from an old song…' }),
                text('epigraphBy', 'Epigraph, from'),
                h('h3', {}, 'The pages'),
                select('headings', 'Chapter headings', HEADINGS),
                select('fleuron', 'Scene break', Object.fromEntries(FLEURONS.map((f) => [f, f]))),
                select('typeface', 'Typeface', Object.fromEntries(Object.entries(TYPEFACES).map(([k, v]) => [k, v.name]))),
                select('size', 'Page size (print)', Object.fromEntries(Object.entries(PAGE_SIZES).map(([k, v]) => [k, v.name]))),
                check('toc', 'Table of contents'),
                check('smart', 'Typographer’s quotes and dashes'),
                check('sceneTitles', 'Show scene titles'),
                check('dropcaps', 'Drop caps and ornaments', can.illum, 'Illuminator talent'),
                check('dramatis', 'Dramatis Personae', can.append, 'Appendices talent'),
                check('glossary', 'Glossary of the world', can.append, 'Appendices talent'),
                check('map', 'The map, as a plate', can.map, 'Map Plate talent')),
            h('section', { class: 'card bind-preview' }, h('h2', {}, 'Preview'), h('p', { class: 'hint' }, 'The first two chapters, as the web page will show them.'), preview)));
    repaint();
    repaint.flush();
    return null;
}
