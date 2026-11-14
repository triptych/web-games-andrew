// The DOM layer: screens, the brief card, the shelf, the clay bench's controls, the rating, the
// photo preview and the album. Reads the sim; never changes it (main.js turns clicks into commands).

import { VERSION } from './config.js';
import { KINDS, KIND_IDS, GROUPS, PALETTE, SIZES, costOf, defaultRecipe } from './sim/data/catalog.js';
import { LEVELS, LEVEL, STUDIO } from './sim/data/levels.js';
import { unlocked, totalStars, shelf } from './sim/game.js';
import { ROOT } from './media.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const face = (id) => (id && id !== 'studio' ? `${ROOT}art/por-${id}.webp` : `${ROOT}art/title.webp`);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        $('version').textContent = 'v' + VERSION + ' · art by fal, sound by ElevenLabs';

        // A press that began outside a screen (the finger that opened it) must not click inside it.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const s of document.querySelectorAll('.screen')) {
            s.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        // a missing portrait falls back to the title art, never a broken image
        document.addEventListener('error', (e) => { const t = e.target; if (t.tagName === 'IMG' && t.src.includes('/por-')) t.src = `${ROOT}art/title.webp`; }, true);

        const sfx = $('set-sfx'), music = $('set-music'), detail = $('set-detail');
        sfx.value = settings.sfx; music.value = settings.music; detail.value = settings.detail;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, detail: detail.value }); onSettings(settings); };
        for (const e of [sfx, music, detail]) e.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { if (confirm('Forget every room and star?')) { onDeleteSave(); this.toast('Your rooms are forgotten.'); } });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        $(id).hidden = false;
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });   // a screen opened from another goes on top
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input, summary')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary')) || list[0])?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    toast(text) {
        const t = el('div', 'toast');
        t.textContent = text;
        const box = $('toasts');
        box.appendChild(t);
        while (box.children.length > 2) box.firstChild.remove();   // never a wall of toasts over the room
        setTimeout(() => t.remove(), 2700);
        window.A11Y?.announce?.(text);
    }

    // ------------------------------------------------------------------ rooms and the brief
    renderRooms(G, onPick) {
        const grid = $('room-grid');
        grid.textContent = '';
        $('rooms-stars').textContent = `★ ${totalStars(G)} / ${LEVELS.length * 3}`;
        for (const L of [...LEVELS, STUDIO]) {
            const open = unlocked(G, L.id), st = G.progress[L.id]?.stars || 0;
            const b = el('button', 'room-card' + (open ? '' : ' locked') + (L.studio ? ' studio' : ''));
            b.dataset.room = L.id;
            b.innerHTML = `<img src="${face(L.id)}" alt=""><b>${esc(L.name)}</b>` +
                (L.studio ? '<span class="dim">No brief, lots of clay</span>' : open ? `<span class="st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span>` : '<span class="dim">🔒 Star the room before</span>');
            b.setAttribute('aria-label', `${L.name}${open ? `, ${st} stars` : ', locked'}`);
            b.addEventListener('click', () => { if (!open) { this.audio.play('nope'); this.toast('Earn a star in the room before this one.'); return; } this.audio.ui('click'); onPick(L.id); });
            grid.appendChild(b);
        }
    }
    showBrief(id) {
        const L = LEVEL[id];
        $('brief-face').src = face(id);
        $('brief-name').textContent = L.name;
        $('brief-who').textContent = L.studio ? 'Your own room' : `For ${L.who} · ${L.w} × ${L.d} tiles`;
        $('brief-blurb').textContent = L.blurb;
        const li = (g) => `<li><span class="tick">${g.req ? '!' : '♥'}</span><span>${esc(g.text)}</span></li>`;
        $('brief-req').innerHTML = L.goals.filter((g) => g.req).map(li).join('') || '<li><span class="tick">✦</span><span>Anything you like</span></li>';
        $('brief-bonus').innerHTML = L.goals.filter((g) => !g.req).map(li).join('');
        $('brief-bonus-h').hidden = !L.goals.some((g) => !g.req);
        $('brief-clay').textContent = L.studio ? 'Clay: plenty.' : `Clay: ${L.clay} lumps. Squish anything back for a full refund.`;
        this.openScreen('brief');
    }

    // ------------------------------------------------------------------ the HUD
    hud(G, ev) {
        const L = LEVEL[G.level];
        $('room-face').src = face(G.level);
        $('room-name').textContent = L.name;
        $('clay-n').textContent = G.room.studio ? '∞' : G.clay;
        $('clay-chip').classList.toggle('low', !G.room.studio && G.clay < 3);
        const list = $('goals-list');
        if (!G.room.goals.length) {
            $('goals-head').textContent = 'Free Studio';
            $('goals-count').textContent = `style ${ev.style.avg}`;
            list.innerHTML = `<li class="ok"><span class="tick">✦</span><span>Cosiness ${ev.cosy} · ${G.items.filter((i) => i.at).length} things</span></li>`;
            return;
        }
        $('goals-head').textContent = 'The brief';
        $('goals-count').textContent = `${ev.reqMet}/${ev.reqTotal} needs · ${ev.bonusMet}/${ev.bonusTotal} wishes`;
        const prev = this.prevGoals || [];
        list.innerHTML = '';
        ev.goals.forEach((g, i) => {
            const li = el('li', g.ok ? 'ok' : '');
            const count = g.need > 1 && !g.ok && g.text.indexOf('Save') !== 0 && g.text.indexOf('Cosi') !== 0 ? `<span class="have">${Math.min(g.have, g.need)}/${g.need}</span>` : (g.text.startsWith('Cosi') && !g.ok ? `<span class="have">${g.have}</span>` : '');
            li.innerHTML = `<span class="tick">${g.ok ? '✓' : g.req ? '!' : '♥'}</span><span>${esc(g.text)}</span>${count}`;
            if (g.ok && prev[i] === false) li.classList.add('pop');
            list.appendChild(li);
        });
        this.prevGoals = ev.goals.map((g) => g.ok);
    }
    resetGoals() { this.prevGoals = null; }

    renderShelf(G, icons, active, onPick, onSquish) {
        const box = $('shelf-items');
        const items = shelf(G);
        const keep = box.scrollLeft;
        box.textContent = '';
        if (!items.length) box.appendChild(el('div', 'shelf-empty', 'Your shelf is empty. Press ＋ to pinch something.'));
        for (const it of items) {
            const b = el('button', 'shelf-item' + (it.id === active ? ' on' : ''));
            b.dataset.id = it.id;
            b.setAttribute('role', 'listitem');
            b.setAttribute('aria-label', `${KINDS[it.kind].name}${it.gift ? ' (a gift)' : ''}`);
            const img = el('img'); img.alt = ''; img.src = icons.of(it);
            b.appendChild(img);
            b.appendChild(el('span', '', esc((it.gift ? '🎁 ' : '') + KINDS[it.kind].name)));
            const x = el('button', 'x', '✕');
            x.setAttribute('aria-label', 'Squish back into clay');
            x.addEventListener('click', (e) => { e.stopPropagation(); onSquish(it.id); });
            b.appendChild(x);
            b.addEventListener('click', () => onPick(it.id));
            box.appendChild(b);
        }
        box.scrollLeft = keep;
    }

    /** The bar of actions over the shelf: while holding a thing, or with a placed thing selected. */
    ctx(mode, label = '', touch = false) {
        const c = $('ctx');
        c.hidden = !mode;
        if (!mode) return;
        $('ctx-label').textContent = label;
        const show = { move: mode === 'selected', turn: true, put: mode === 'placing' && touch, stow: mode === 'selected', cancel: true };
        for (const b of c.querySelectorAll('[data-ctx]')) b.hidden = !show[b.dataset.ctx];
    }

    // ------------------------------------------------------------------ the clay bench
    buildBench({ onChange, onMake }) {
        this.recipe = defaultRecipe('bed');
        const kinds = $('bench-kinds');
        for (const g of GROUPS) {
            kinds.appendChild(el('h4', '', g));
            for (const k of KIND_IDS.filter((id) => KINDS[id].group === g)) {
                const b = el('button', 'kind-btn', `<span class="e">${KINDS[k].emoji}</span><span>${KINDS[k].name}</span>`);
                b.dataset.kind = k;
                b.setAttribute('role', 'option');
                b.addEventListener('click', () => { this.audio.ui('click'); this.pickKind(k); onChange(this.recipe); });
                kinds.appendChild(b);
            }
        }
        const sw = (box, slot) => {
            for (const c of PALETTE) {
                const b = el('button', 'sw');
                b.style.background = '#' + c.hex.toString(16).padStart(6, '0');
                b.dataset.c = c.id;
                b.title = c.name;
                b.setAttribute('aria-label', `${c.name}`);
                b.addEventListener('click', () => { this.recipe.colors[slot] = c.id; this.audio.play('click', { rate: 0.9 + slot * 0.2, vol: 0.6 }); this.syncBench(); onChange(this.recipe); });
                $(box).appendChild(b);
            }
        };
        sw('bench-c0', 0); sw('bench-c1', 1);
        $('bench-make').addEventListener('click', () => onMake(this.recipe));
        $('bench-dice').addEventListener('click', () => {
            const r = this.recipe, K = KINDS[r.kind];
            const pick = (n) => Math.floor(Math.random() * n);   // the UI's dice; the sim never rolls Math.random
            r.variant = pick(K.variants.length);
            r.colors = [PALETTE[pick(PALETTE.length)].id, PALETTE[pick(PALETTE.length)].id];
            if (K.motifs) r.motif = pick(K.motifs.length);
            this.audio.play('squish', { rate: 1.3, vol: 0.5 });
            this.syncBench(); onChange(r);
        });
        this.pickKind('bed');
    }
    pickKind(k) {
        const keep = this.recipe;
        this.recipe = defaultRecipe(k);
        if (keep && keep.kind !== k) this.recipe.size = Math.min(keep.size, 2);
        this.syncBench();
    }
    syncBench(clay = this.clay, studio = this.studio) {
        this.clay = clay; this.studio = studio;
        const r = this.recipe, K = KINDS[r.kind];
        for (const b of document.querySelectorAll('.kind-btn')) { b.classList.toggle('on', b.dataset.kind === r.kind); b.setAttribute('aria-selected', b.dataset.kind === r.kind); }
        $('bench-name').textContent = `${K.emoji} ${K.name}`;
        const chips = (box, labels, cur, set) => {
            const host = $(box);
            host.textContent = '';
            labels.forEach((name, i) => {
                const b = el('button', 'chip' + (i === cur ? ' on' : ''), esc(name));
                b.addEventListener('click', () => { set(i); this.audio.play('click', { vol: 0.6 }); this.syncBench(); this.onChange?.(this.recipe); });
                host.appendChild(b);
            });
        };
        const sizeLabel = (i) => {
            const [w, d] = K.fp[i];
            return `${SIZES[i]} · ${K.layer === 'wall' ? `${w}×${d}` : K.layer === 'small' ? Math.round(K.h[i] * 100) / 100 + ' tall' : `${w}×${d}`}`;
        };
        chips('bench-size', [0, 1, 2].map(sizeLabel), r.size, (i) => { r.size = i; });
        chips('bench-variant', K.variants, r.variant, (i) => { r.variant = i; });
        const motifs = K.motifs || K.glow;
        $('bench-motif-row').hidden = !motifs;
        if (motifs) {
            $('bench-motif-label').textContent = K.glow ? 'Glow' : K.kind === 'rug' || r.kind === 'rug' ? 'Pattern' : 'Picture';
            chips('bench-motif', motifs, r.motif | 0, (i) => { r.motif = i; });
        }
        $('bench-c0-label').textContent = K.slots[0];
        $('bench-c1-label').textContent = K.slots[1];
        for (const [box, slot] of [['bench-c0', 0], ['bench-c1', 1]]) for (const b of $(box).children) b.classList.toggle('on', b.dataset.c === r.colors[slot]);
        const cost = costOf(r.kind, r.size);
        const short = !studio && cost > clay;
        $('bench-cost').innerHTML = `<span class="lump"></span> ${cost} lump${cost > 1 ? 's' : ''}${studio ? '' : ` of ${clay}`}`;
        $('bench-cost').classList.toggle('short', short);
        $('bench-make').disabled = short;
        $('bench-make').textContent = short ? 'Not enough clay' : 'Pinch it!';
    }

    // ------------------------------------------------------------------ the rating
    showResults(G, ev, { onPhoto, onKeep, onNext, nextLabel }) {
        const L = LEVEL[G.level];
        $('res-face').src = face(G.level);
        const say = L.studio ? ['A fine room.', 'A lovely room!', 'A wonderful room!', 'A masterpiece!']
            : [`${L.who} still needs a few things.`, `${L.who} likes it!`, `${L.who} loves it!`, `${L.who} is over the moon!`];
        $('res-head').textContent = ['Not quite yet', 'Nice!', 'Lovely!', 'Masterpiece!'][ev.stars];
        $('res-say').textContent = say[ev.stars];
        const st = $('res-stars').children;
        for (const s of st) s.classList.remove('lit');
        $('res-score').textContent = `Score ${ev.score} / 100${G.progress[G.level]?.score > ev.score ? ` · best ${G.progress[G.level].score}` : ''}`;
        $('res-goals').innerHTML = ev.goals.map((g) => `<li class="${g.ok ? 'ok' : 'miss'}"><span class="tick">${g.ok ? '✓' : '✗'}</span><span>${esc(g.text)}</span>${g.req ? '<span class="req">NEED</span>' : ''}</li>`).join('');
        const s = ev.style;
        const bars = [['Colour harmony', s.harmony], ['Balance', s.balance], ['Fullness', s.fullness], ['Variety', s.variety], ['Cosiness', s.cosy]];
        $('res-style').innerHTML = bars.map(([n, v]) => `<span>${n}</span><span class="bar"><i style="width:${v}%"></i></span><b>${v}</b>`).join('');
        $('res-next').textContent = nextLabel;
        $('res-photo').onclick = onPhoto; $('res-keep').onclick = onKeep; $('res-next').onclick = onNext;
        this.openScreen('results');
        // stars light one by one, each chime a step higher
        for (let i = 0; i < ev.stars; i++) setTimeout(() => { st[i].classList.add('lit'); this.audio.play('star', { rate: 1 + i * 0.12, gap: 0 }); }, 450 + i * 420);
        setTimeout(() => { if (ev.stars) this.audio.play('fanfare'); if (ev.stars === 3) this.audio.play('cheer', { delay: 0.4 }); }, 450 + ev.stars * 420);
    }

    // ------------------------------------------------------------------ album
    renderAlbum(album, { onDownload, onDelete }) {
        const grid = $('album-grid');
        grid.textContent = '';
        $('album-empty').hidden = album.length > 0;
        album.forEach((p, i) => {
            const card = el('div', 'album-card');
            const img = el('img'); img.src = p.src; img.alt = p.caption || 'A diorama photo';
            card.appendChild(img);
            const acts = el('div', 'acts');
            const d = el('button', 'btn', '⬇'); d.setAttribute('aria-label', 'Save this photo'); d.addEventListener('click', () => onDownload(i));
            const x = el('button', 'btn danger', '🗑'); x.setAttribute('aria-label', 'Remove from album'); x.addEventListener('click', () => onDelete(i));
            acts.append(d, x);
            card.appendChild(acts);
            grid.appendChild(card);
        });
    }
}
