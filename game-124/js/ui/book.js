// The book: write spells into your Focus, keep the deduction grid, read what every reagent carries,
// what the laws have shown, Elowen's pages, the map, and your satchel. Reads G; changes it only
// through act().

import { ESSENCES, FORMS, ESSENCE_INFO, FORM_INFO, MAGIC, PHASES } from '../config.js';
import { REAGENTS, ITEMS } from '../sim/data/reagents.js';
import { PAGES, PAGE_IDS, ECHOES } from '../sim/data/text.js';
import { textCtx } from '../sim/story.js';
import { SITES, REGION_NAMES } from '../sim/world.js';
import { getWorld } from '../sim/world.js';
import { glyphURL, icon, ESSENCE_ICON, FORM_ICON } from '../glyphart.js';
import { md, esc } from './ui.js';

const $ = (id) => document.getElementById(id);
const phaseName = (id) => PHASES.find((p) => p.id === id)?.name || id;

export class Book {
    constructor(ui, act) {
        this.ui = ui;
        this.act = act;
        this.tab = 'focus';
        this.edit = 0;              // which slot the writer is editing
        this.draft = null;          // [{ g, feed }]
        this.n = 1;
        $('book-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-tab]');
            if (!b) return;
            this.ui.audio.ui('page');
            this.show(b.dataset.tab);
        });
        $('book-body').addEventListener('click', (e) => this.click(e));
        $('book-body').addEventListener('change', (e) => this.change(e));
    }

    open(G, tab) {
        this.G = G;
        if (tab) this.tab = tab;
        if (!this.draft) this.loadDraft();
        this.ui.openScreen('book');
        this.render();
    }
    show(tab) { this.tab = tab; this.render(); $('book-body').scrollTop = 0; }
    refresh(G) { this.G = G; if (!$('book').hidden) this.render(); }

    glyph(id) { return this.G.laws.glyphs.find((g) => g.id === id); }
    img(id, size = 64) { return `<img alt="" src="${glyphURL(this.glyph(id), size)}">`; }
    /** What the notebook says a glyph is: known for certain, the player's own guess, or nothing. */
    meaning(id) {
        const N = this.G.notes, g = this.glyph(id);
        const known = g.kind === 'shape' ? N.shapes[id]?.form : N.glyphs[id]?.essence;
        if (known) return { known, name: g.kind === 'shape' ? FORM_INFO[known].name : ESSENCE_INFO[known].name };
        const pen = N.pencil[id] || {};
        const q = Object.keys(pen).find((k) => pen[k] === '?');
        if (q) return { guess: q, name: (FORM_INFO[q] || ESSENCE_INFO[q]).name + '?' };
        return null;
    }
    ess(e, withName = true) {
        const c = this.G.notes.colors[e];
        return `<span class="chip">${c ? `<span class="swatch" style="background:${c}"></span>` : ''}${icon(ESSENCE_ICON[e])}${withName ? ' ' + ESSENCE_INFO[e].name : ''}</span>`;
    }

    loadDraft() {
        const s = this.G.wand[this.edit];
        this.draft = s.glyphs.map((g, i) => ({ g, feed: s.feed[i] || null }));
    }

    render() {
        const G = this.G;
        for (const b of document.querySelectorAll('#book-tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === this.tab));
        const body = $('book-body');
        body.innerHTML = this[this.tab]?.(G) || '';
        if (this.tab === 'map') this.drawMap(G);
    }

    // ------------------------------------------------------------------ focus: writing spells
    focus(G) {
        if (!G.hasWand) return '<h3>Your Focus</h3><p>You have nothing to cast with yet. Elowen mentions a Focus on her desk.</p>';
        const slots = G.wand.map((s, i) => `<button class="wslot ${i === this.edit ? 'sel' : ''}" data-edit="${i}">
            <div class="marks">${s.glyphs.length ? s.glyphs.map((g) => this.img(g, 48)).join('') : '<i>blank</i>'}</div>
            <div class="meta">Slot ${i + 1}${s.glyphs.length ? ` · ${s.charges} cast${s.charges === 1 ? '' : 's'} ready` : ''}${i === G.sel ? ' · in hand' : ''}</div></button>`).join('');
        const d = this.draft;
        const bag = Object.keys(G.bag).filter((r) => REAGENTS[r] && G.bag[r] > 0);
        const words = d.map((w, i) => {
            const g = this.glyph(w.g), m = this.meaning(w.g);
            const feed = g.kind === 'essence'
                ? `<select class="feed ${w.feed ? '' : 'need'}" data-feed="${i}" aria-label="Feed this word"><option value="">feed…</option>${bag.map((r) => {
                    const n = G.notes.reagents[r];
                    return `<option value="${r}" ${w.feed === r ? 'selected' : ''}>${esc(REAGENTS[r].name)} (${G.bag[r]})${n?.essence ? ' · ' + ESSENCE_INFO[n.essence].name : ''}</option>`;
                }).join('')}</select>`
                : '<span class="note">shape</span>';
            return `<div class="word"><div class="gl">${this.img(w.g)}<button class="btn x" data-del="${i}" aria-label="Remove">✕</button></div>
                <small>${esc(g.name)}${m ? ` · <span class="${m.known ? 'known' : 'guess'}">${esc(m.name)}</span>` : ''}</small>${feed}</div>`;
        }).join('') + (d.length < 3 ? '<div class="ghost">tap a mark below</div>' : '');
        const palette = G.glyphs.map((id) => {
            const g = this.glyph(id), m = this.meaning(id);
            return `<button data-add="${id}" aria-label="Add the mark ${esc(g.name)}">${this.img(id, 64)}<small>${esc(g.name)}</small>${m ? `<small class="${m.known ? 'known' : 'guess'}">${esc(m.name)}</small>` : ''}</button>`;
        }).join('');
        const ready = d.length && d.every((w) => this.glyph(w.g).kind === 'shape' || w.feed);
        return `<h3>Your Focus</h3>
            <p class="note">Elowen's hazel wand holds three spells. Choose a slot, lay out its marks in order, feed each bare word a reagent, and write it. Writing takes the reagents now; each cast spends one set.</p>
            <div class="wslots">${slots}</div>
            <div class="composer">
                <div class="line">${words}</div>
                <div class="compose-foot">
                    <span><button class="btn" data-act="reverse" ${d.length < 2 ? 'disabled' : ''}>⇄ Reverse</button> <button class="btn" data-act="clear" ${d.length ? '' : 'disabled'}>Clear</button></span>
                    <span class="charges">Casts <button class="btn" data-act="n-">−</button><b>${this.n}</b><button class="btn" data-act="n+">+</button>
                    <button class="btn primary" data-act="write" ${ready ? '' : 'disabled'}>Write into slot ${this.edit + 1}</button></span>
                </div>
                <div class="compose-foot">
                    <span class="note">${G.wand[this.edit].glyphs.length ? `Slot ${this.edit + 1} holds ${G.wand[this.edit].charges} cast${G.wand[this.edit].charges === 1 ? '' : 's'}.` : ''}</span>
                    <span><button class="btn" data-act="refill" ${G.wand[this.edit].glyphs.length ? '' : 'disabled'}>Feed again (+1)</button>
                    <button class="btn" data-act="erase" ${G.wand[this.edit].glyphs.length ? '' : 'disabled'}>Erase slot</button>
                    <button class="btn" data-act="hold" ${this.edit === G.sel ? 'disabled' : ''}>Hold this slot</button></span>
                </div>
            </div>
            <h4>Marks you know</h4>
            <div class="palette">${palette || '<p class="note">None yet. Look for carvings.</p>'}</div>
            <p class="legend">Ringed marks are shapes; bare marks are words. <span class="known">Green</span>: shown by experiment. <span class="guess">Brown?</span>: your own guess, from the Marks page.</p>`;
    }

    // ------------------------------------------------------------------ marks: the deduction grid
    marks(G) {
        const N = G.notes;
        const words = G.glyphs.filter((id) => this.glyph(id).kind === 'essence');
        const shapes = G.glyphs.filter((id) => this.glyph(id).kind === 'shape');
        const cell = (id, key, yes, no) => {
            const pen = N.pencil[id]?.[key];
            const cls = yes ? 'yes' : no ? 'no' : pen === '?' ? 'p-q' : pen === 'x' ? 'p-x' : '';
            const txt = yes ? '✓' : no ? '✗' : pen === '?' ? '?' : pen === 'x' ? '×' : '';
            return `<td><button class="gcell ${cls}" data-pen="${id}" data-key="${key}" ${yes || no ? 'disabled' : ''} aria-label="${esc(this.glyph(id).name)}: ${key}">${txt}</button></td>`;
        };
        const row = (id, keys, known, not) => `<tr><td><span class="gname">${this.img(id, 48)}${esc(this.glyph(id).name)}</span></td>${keys.map((k) => cell(id, k, known === k, not.includes(k) || (known && known !== k))).join('')}</tr>`;
        const wordGrid = words.length ? `<div class="scroll-x"><table class="grid"><tr><th></th>${ESSENCES.map((e) => `<th>${this.ess(e)}</th>`).join('')}</tr>
            ${words.map((id) => row(id, ESSENCES, N.glyphs[id]?.essence, N.glyphs[id]?.not || [])).join('')}</table></div>` : '<p class="note">No words copied yet.</p>';
        const shapeGrid = shapes.length ? `<div class="scroll-x"><table class="grid"><tr><th></th>${FORMS.map((f) => `<th><span class="chip">${icon(FORM_ICON[f])} ${FORM_INFO[f].name}</span></th>`).join('')}</tr>
            ${shapes.map((id) => row(id, FORMS, N.shapes[id]?.form, N.shapes[id]?.not || [])).join('')}</table></div>` : '';
        return `<h3>Marks</h3>
            <p class="note">What each mark means. ✓ and ✗ are what experiments have shown. Tap an empty square to pencil in your own guess (?), or to cross it off (×). Six words, three shapes; each meaning belongs to exactly one mark.</p>
            <h4>Words</h4>${wordGrid}
            <h4>Shapes</h4>${shapeGrid}
            <p class="legend">${ESSENCES.map((e) => `<b>${ESSENCE_INFO[e].name}</b>: ${ESSENCE_INFO[e].does}`).join(' · ')}<br>${FORMS.map((f) => `<b>${FORM_INFO[f].name}</b>: ${FORM_INFO[f].does}`).join(' · ')}</p>`;
    }

    // ------------------------------------------------------------------ reagents
    reagents(G) {
        const N = G.notes;
        const ids = Object.keys(N.reagents);
        if (!ids.length) return '<h3>Reagents</h3><p>You haven\'t gathered anything yet. Look for things that glow faintly: on the beach, in the woods, in the fen, on the moor.</p>';
        const rel = (r) => {
            const out = [];
            for (const [a, b] of N.oppR) if (a === r || b === r) out.push(`clashes with ${REAGENTS[a === r ? b : a].name}`);
            for (const [a, b] of N.sameR) if (a === r || b === r) out.push(`rings the same as ${REAGENTS[a === r ? b : a].name}`);
            for (const [a, b] of N.apartR) if (a === r || b === r) out.push(`rings apart from ${REAGENTS[a === r ? b : a].name}`);
            return out;
        };
        return `<h3>Reagents</h3><div class="rlist">${ids.map((r) => {
            const n = N.reagents[r];
            const facts = [
                n.essence ? `carries ${this.ess(n.essence)}` : '<span class="note">carries ? (try the alembic)</span>',
                n.potency ? (n.potency >= 2 ? '<b>strong</b>' : 'mild') : '',
                n.wax ? `strongest at <b>${phaseName(n.wax)}</b>` : '',
                ...rel(r).map(esc),
            ].filter(Boolean).join(' · ');
            return `<div class="ritem"><div><b>${esc(REAGENTS[r].name)}</b><br><span class="note">${esc(REAGENTS[r].blurb)}</span><br>${facts}</div><div>×${G.bag[r] || 0}</div></div>`;
        }).join('')}</div>`;
    }

    // ------------------------------------------------------------------ laws and the log
    laws(G) {
        const N = G.notes;
        const items = [];
        items.push(N.order ? `<b>Word order:</b> the shape goes ${N.order === 'shape-first' ? '<b>first</b>, before the words' : '<b>last</b>, after the words'}.` : '<b>Word order:</b> unknown. The shape goes at one end. A tangle means the wrong one.');
        items.push('<b>Feeding:</b> every bare word needs a reagent that carries it. A word fed the wrong thing starves.');
        items.push('<b>Strength:</b> a strong reagent, the same word twice, or a word spoken at its waxing hour, each make a spell stronger.');
        if (N.opp.length) items.push(`<b>Opposed:</b> ${N.opp.map(([a, b]) => `${this.ess(a)} and ${this.ess(b)}`).join('; ')}. Spoken together, they unmake.`);
        if (N.oppR.length && !N.opp.length) items.push(`<b>Clashing reagents:</b> ${N.oppR.map(([a, b]) => `${REAGENTS[a].name} and ${REAGENTS[b].name}`).join('; ')}.`);
        const wax = ESSENCES.filter((e) => N.wax[e]);
        if (wax.length) items.push(`<b>Waxing hours:</b> ${wax.map((e) => `${this.ess(e)} at ${phaseName(N.wax[e])}`).join(', ')}.`);
        const log = [...N.log].reverse().map((l) => `<div><span class="when">Day ${l.day}, ${l.clock}</span>${esc(l.text)}</div>`).join('');
        return `<h3>Laws of Hum</h3>${items.map((i) => `<div class="lawbox">${i}</div>`).join('')}
            <h4>Observations</h4><div class="log">${log || '<p class="note">Nothing yet.</p>'}</div>`;
    }

    // ------------------------------------------------------------------ pages
    pages(G) {
        const list = PAGE_IDS.map((id) => G.pages.includes(id)
            ? `<button data-page="${id}"><b>${esc(PAGES[id].title)}</b><br><small>${esc(PAGES[id].where)}</small></button>`
            : '<button class="missing" disabled>A page you haven\'t found</button>').join('');
        const echoes = Object.keys(ECHOES).filter((id) => G.echoes[id] === 'heard');
        return `<h3>Elowen's Pages</h3><div class="plist">${list}</div>
            ${echoes.length ? `<h4>Echoes</h4><div class="plist">${echoes.map((id) => `<button data-echo="${id}"><i>${esc(ECHOES[id].text(textCtx(G)).slice(0, 80))}…</i></button>`).join('')}</div>` : ''}
            <p class="note">${4 - echoes.length} of Elowen's echoes still unheard. They only show in the dark, and only to light.</p>`;
    }
    openPage(G, id) {
        $('pv-where').textContent = PAGES[id].where;
        $('pv-title').textContent = PAGES[id].title;
        $('pv-text').innerHTML = md(PAGES[id].text(textCtx(G)));
        this.ui.openScreen('pageview');
    }

    // ------------------------------------------------------------------ map
    map() { return '<h3>Map of Hum</h3><canvas id="map-canvas" width="560" height="560"></canvas><p class="note" id="map-note"></p>'; }
    drawMap(G) {
        const c = $('map-canvas'); if (!c) return;
        const x = c.getContext('2d'), W = getWorld(G.seed), S = 560, R = 215;
        if (!this.mapImg || this.mapSeed !== G.seed) {
            const img = x.createImageData(S, S);
            for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
                const wx = (i / S - 0.5) * 2 * R, wz = (j / S - 0.5) * 2 * R;
                const h = W.height(wx, wz), w = W.water(wx, wz, h);
                let col;
                if (w) col = w.kind === 'moat' ? [40, 24, 50] : w.kind === 'sea' ? [120 + h * 4, 150 + h * 4, 150 + h * 3] : [110, 150, 140];
                else { const reg = W.regionAt(wx, wz); const base = { shore: [214, 196, 150], wood: [120, 140, 90], fen: [170, 160, 100], moor: [160, 130, 140], castle: [120, 104, 120], heath: [176, 180, 120], hut: [190, 170, 120] }[reg]; const sh = Math.max(0.65, Math.min(1.15, 0.85 + (W.height(wx + 2, wz - 2) - h) * 0.12)); col = base.map((v) => v * sh); }
                const k = (j * S + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
            }
            this.mapImg = img; this.mapSeed = G.seed;
        }
        x.putImageData(this.mapImg, 0, 0);
        const P = (wx, wz) => [(wx / (2 * R) + 0.5) * S, (wz / (2 * R) + 0.5) * S];
        x.font = 'italic 15px Alegreya, Georgia, serif'; x.textAlign = 'center';
        const label = (t, wx, wz, on) => { const [a, b] = P(wx, wz); x.fillStyle = on ? '#2a1d10' : 'rgba(42,29,16,0.35)'; x.fillText(on ? t : '?', a, b); };
        const v = (r) => G.regions.includes(r);
        label(REGION_NAMES.wood, SITES.wood.x, SITES.wood.z - 30, v('wood'));
        label(REGION_NAMES.fen, SITES.fen.x, SITES.fen.z - 46, v('fen'));
        label(REGION_NAMES.moor, 0, -170, v('moor'));
        label(REGION_NAMES.castle, 0, -26, true);
        label(REGION_NAMES.shore, 0, 200, true);
        label('Hut', SITES.hut.x, SITES.hut.z - 10, G.flags.hutFound);
        const dot = (wx, wz, c, r = 5) => { const [a, b] = P(wx, wz); x.fillStyle = c; x.beginPath(); x.arc(a, b, r, 0, 6.3); x.fill(); x.strokeStyle = '#2a1d10'; x.stroke(); };
        dot(SITES.mere.x, SITES.mere.z, G.flags.stoneWood ? '#fff2a0' : '#777');
        dot(SITES.pool.x, SITES.pool.z, G.flags.stoneFen ? '#fff2a0' : '#777');
        dot(SITES.storm.x, SITES.storm.z, G.flags.stoneMoor ? '#fff2a0' : '#777');
        if (G.nib.mode !== 'caged') dot(G.nib.x, G.nib.z, '#7f9a6a', 3.5);
        const [px, pz] = P(G.p.x, G.p.z);
        x.save(); x.translate(px, pz); x.rotate(G.p.yaw); x.fillStyle = '#b0301e';
        x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.restore();
        $('map-note').textContent = 'Grey stones are asleep; bright ones are awake. The red arrow is you.';
    }

    // ------------------------------------------------------------------ satchel
    satchel(G) {
        const food = Object.keys(G.bag).filter((k) => ITEMS[k]?.food);
        const other = Object.keys(G.bag).filter((k) => ITEMS[k] && !ITEMS[k].food);
        return `<h3>Satchel</h3>
            <p>Food ${Math.round(G.p.vigor)} · Warmth ${Math.round(G.p.warmth)} · Health ${Math.round(G.p.health)}</p>
            <div class="rlist">${food.map((k) => `<div class="ritem"><div><b>${esc(ITEMS[k].name)}</b> ×${G.bag[k]}<br><span class="note">${esc(ITEMS[k].blurb)} (+${ITEMS[k].food} food)</span></div><div><button class="btn primary" data-eat="${k}">Eat</button></div></div>`).join('') || '<p class="note">No food. Bramble bushes, clams on the beach and chanterelles in the woods. Cook the last two by a fire.</p>'}
            ${other.map((k) => `<div class="ritem"><div><b>${esc(ITEMS[k].name)}</b> ×${G.bag[k]}<br><span class="note">${esc(ITEMS[k].blurb)}</span></div></div>`).join('')}</div>
            <p class="note">Reagents are listed on the Reagents page. You can't drown in pockets: carry as much as you like.</p>`;
    }

    // ------------------------------------------------------------------ input
    click(e) {
        const G = this.G;
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        this.ui.audio.ui('click');
        const d = b.dataset;
        if (d.edit != null) { this.edit = +d.edit; this.loadDraft(); }
        else if (d.add) { if (this.draft.length < 3) this.draft.push({ g: d.add, feed: this.autoFeed(d.add) }); }
        else if (d.del != null) this.draft.splice(+d.del, 1);
        else if (d.pen) {
            const cur = G.notes.pencil[d.pen]?.[d.key];
            const next = !cur ? '?' : cur === '?' ? 'x' : null;
            // one guess per mark
            if (next === '?') for (const k of [...ESSENCES, ...FORMS]) if (G.notes.pencil[d.pen]?.[k] === '?') this.act({ t: 'pencil', g: d.pen, key: k, mark: null });
            this.act({ t: 'pencil', g: d.pen, key: d.key, mark: next });
        }
        else if (d.page) { this.openPage(G, d.page); return; }
        else if (d.echo) { $('pv-where').textContent = 'Heard by night'; $('pv-title').textContent = 'An Echo'; $('pv-text').innerHTML = md(ECHOES[d.echo].text(textCtx(G))); this.ui.openScreen('pageview'); return; }
        else if (d.eat) this.act({ t: 'eat', item: d.eat });
        else if (d.act === 'reverse') this.draft.reverse();
        else if (d.act === 'clear') this.draft = [];
        else if (d.act === 'n-') this.n = Math.max(1, this.n - 1);
        else if (d.act === 'n+') this.n = Math.min(MAGIC.charges, this.n + 1);
        else if (d.act === 'write') {
            const r = this.act({ t: 'inscribe', slot: this.edit, glyphs: this.draft.map((w) => w.g), feed: this.draft.map((w) => w.feed), n: this.n });
            if (r?.ok) { this.act({ t: 'select', slot: this.edit }); this.ui.toast(r.charges ? `Written into slot ${this.edit + 1}: ${r.charges} cast${r.charges === 1 ? '' : 's'} ready. Close the book and cast.` : 'Written, but you had nothing to feed it.', r.charges ? 'good' : 'info'); }
            else this.ui.toast(r?.text || 'Could not write that.');
        }
        else if (d.act === 'refill') { const r = this.act({ t: 'refill', slot: this.edit, n: 1 }); if (!r?.ok) this.ui.toast('Not enough reagents to feed it again.'); }
        else if (d.act === 'erase') { this.act({ t: 'clearSlot', slot: this.edit }); this.draft = []; }
        else if (d.act === 'hold') this.act({ t: 'select', slot: this.edit });
        this.render();
    }
    change(e) {
        const s = e.target.closest('select[data-feed]');
        if (!s) return;
        this.draft[+s.dataset.feed].feed = s.value || null;
        this.render();
    }
    /** Feed a newly placed word with a reagent the notebook says carries it, if there is one. */
    autoFeed(id) {
        const G = this.G, g = this.glyph(id);
        if (g.kind !== 'essence') return null;
        const e = G.notes.glyphs[id]?.essence;
        if (!e) return null;
        return Object.keys(G.bag).find((r) => REAGENTS[r] && G.bag[r] > 0 && G.notes.reagents[r]?.essence === e) || null;
    }
}
