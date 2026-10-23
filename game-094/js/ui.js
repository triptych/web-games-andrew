// The DOM layer around the transcript: screens, the status bar, the character sheet, the pack, the
// journal, settings and toasts. Reads the sim; never changes it (it calls back for use and drop).

import { VERSION, STATS, STAT_NAMES, MAX_ITEMS, HEALTH_MAX, CLARITY_MAX, UND_MAX, ARDENT_DAY } from './config.js';
import { clockText } from './sim/game.js';
import { NODES } from './sim/story.js';
import { ITEMS } from './sim/data/items.js';
import { CODEX } from './sim/data/codex.js';

const $ = (id) => document.getElementById(id);
const bar = (n, max, width = max) => {
    const k = Math.round((n / max) * width);
    return '█'.repeat(k) + '░'.repeat(width - k);
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onUse, onDrop }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.sig = '';
        this.sel = null;                   // the pack item whose detail is open
        this.onUse = onUse; this.onDrop = onDrop;
        $('version').textContent = 'V' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const els = { sfx: $('set-sfx'), hum: $('set-hum'), speed: $('set-speed'), phosphor: $('set-phosphor'), crt: $('set-crt') };
        for (const [k, el] of Object.entries(els)) el.value = settings[k];
        const changed = () => {
            Object.assign(settings, { sfx: +els.sfx.value, hum: +els.hum.value, speed: els.speed.value, phosphor: els.phosphor.value, crt: els.crt.value });
            onSettings(settings);
        };
        for (const el of Object.values(els)) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted'); });

        for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { audio.ui('click'); this.setTab(b.dataset.tab); });
        $('pk-use').addEventListener('click', () => { if (this.sel) this.onUse(this.sel); });
        $('pk-drop').addEventListener('click', () => { if (this.sel) this.onDrop(this.sel); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        if (id === 'journal') this.sig = '';
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // later-opened screens sit on top, whatever their order in the page
        this.stack.forEach((s, n) => { $(s).style.zIndex = 50 + n; });
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

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ panels
    setTab(tab) {
        $('game').dataset.tab = tab;
        for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    }

    setEndings(endings, total) {
        $('endings-line').textContent = endings.length ? `ENDINGS FOUND: ${endings.length} OF ${total}` : '';
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    /** Refresh the status bar, the sheet, the pack and the journal when something they show has changed. */
    sync(G) {
        const sig = [G.node, G.day, G.min, G.health, G.clarity, G.und, G.inv.join(), G.codex.join(), G.spec, Object.values(G.stats).join(), this.sel, this.top() === 'journal'].join('|');
        if (sig === this.sig) return;
        this.sig = sig;
        this.G = G;
        $('st-place').textContent = NODES[G.node].title;
        $('st-clock').textContent = `DAY ${G.day} ${clockText(G)}`;
        $('st-eta').textContent = `ARDENT: DAY ${ARDENT_DAY}`;

        $('sh-spec').textContent = G.spec || '—';
        const stats = $('sh-stats'), vit = $('sh-vitals');
        stats.textContent = ''; vit.textContent = '';
        const row = (dl, k, v, cls) => {
            const dt = document.createElement('dt'); dt.textContent = k;
            const dd = document.createElement('dd'); dd.textContent = v; if (cls) dd.className = cls;
            dl.append(dt, dd);
        };
        for (const s of STATS) row(stats, STAT_NAMES[s], `${G.stats[s]}  ${bar(G.stats[s], 5)}`, 'bar');
        row(vit, 'HEALTH', `${String(G.health).padStart(2)}/${HEALTH_MAX} ${bar(G.health, HEALTH_MAX)}`, 'bar');
        row(vit, 'CLARITY', `${String(G.clarity).padStart(2)}/${CLARITY_MAX} ${bar(G.clarity, CLARITY_MAX)}`, 'bar');
        row(vit, 'GENOME', `${String(G.und).padStart(3)}% ${bar(G.und, UND_MAX, 10)}`, 'bar');

        $('pk-count').textContent = `${G.inv.length}/${MAX_ITEMS}`;
        const list = $('pk-list');
        list.textContent = '';
        for (let n = 0; n < MAX_ITEMS; n++) {
            const id = G.inv[n];
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            if (id) {
                b.className = 'slot' + (this.sel === id ? ' sel' : '');
                b.dataset.id = id;
                b.textContent = `${ITEMS[id].glyph} ${ITEMS[id].name}`;
                b.addEventListener('click', () => { this.audio.ui('click'); this.sel = this.sel === id ? null : id; this.sig = ''; this.sync(this.G); });
            } else {
                b.className = 'slot empty';
                b.disabled = true;
                b.textContent = '· · · · ·';
            }
            li.append(b); list.append(li);
        }
        if (this.sel && !G.inv.includes(this.sel)) this.sel = null;
        const det = $('pk-detail');
        det.hidden = !this.sel;
        if (this.sel) {
            const it = ITEMS[this.sel];
            $('pk-desc').textContent = it.desc;
            $('pk-use').disabled = !it.use;
            $('pk-drop').disabled = !!it.keep;
        }

        if (this.top() === 'journal') this.renderJournal(G);
    }

    renderJournal(G) {
        const box = $('jn-list');
        box.textContent = '';
        const ids = Object.keys(CODEX);
        $('jn-count').textContent = `${G.codex.length}/${ids.length}`;
        for (const id of ids) {
            const d = document.createElement('div');
            const got = G.codex.includes(id);
            d.className = 'entry' + (got ? '' : ' locked');
            const b = document.createElement('b'); b.textContent = got ? CODEX[id].title : '? ? ?';
            const p = document.createElement('p'); p.textContent = got ? CODEX[id].text : 'Not yet discovered.';
            d.append(b, p);
            box.append(d);
        }
    }
}
