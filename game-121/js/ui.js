// The DOM layer: dialogue, the visions, the hand of cards, the result, the evening and ending screens, the Codex,
// the HUD, settings and toasts. It reads the sim and sends commands through `act`; it never changes G.

import { VERSION, RANKS, STYLE_NAME, STYLES, CLUES, ROMANCE_MIN, ROMANCE_LOVE } from './config.js';
import { THEMES, THEME_IDS, SYMBOLS, SYMBOL_IDS, COLOURS, COLOUR_IDS, OMENS, CARDS, CARDS_OF, TIME_SHORT, TIME_NAMES } from './sim/data/lexicon.js';
import { DAY_NAMES, CLUE_TEXT, KINGDOM, PRINCE } from './sim/data/story.js';
import { CAND, CAND_IDS, SCENES } from './sim/data/romance.js';
import { labelOf, tierOf } from './sim/game.js';
import { cardElement, glyphElement, cloudElement } from './view/art.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hearts = (n, max) => '♥'.repeat(Math.min(max, Math.max(0, n))) + '♡'.repeat(Math.max(0, max - Math.max(0, n)));

const TIPS = {
    ready: 'Gaze into the ball. It shows three visions: what was, what is, what comes. Each is a SYMBOL in a COLOUR.',
    ball: 'The symbol names the matter; its colour gives the tone. Warm and bright colours bring a boon, dark ones a bane. A clouded vision hides its symbol: read the omen in the room, think of what the client said, or spend a Focus.',
    deal: 'Lay one card for each vision, in order. A card answers a matter if it carries it, and a boon wants it upright, a bane reversed. Right matter, wrong way up is half right.',
    style: 'Now say it aloud. Most guests have a favourite way to hear it: plain, gentle or grand. Listen to how they asked.',
    result: 'Every reading teaches you something: the symbols, colours and omens you met are written into the Codex (C) with their meaning.',
    dusk: 'An evening is yours: study the journal to learn more, or spend time with someone in the village. You cannot do both.',
};
const CLUE_HINT = {
    ledger: 'Someone who sells herbs may have noticed a strange sale.',
    orders: 'A courier, or a smith asked to make something odd, may know of secret orders.',
    rota: 'The Captain of the Guard, or a minstrel who hears tavern gossip.',
    cupbearer: 'Whoever pours the King’s wine.',
    envoy: 'A veiled lady who serves the First Prince.',
};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, act, getG }) {
        this.audio = audio; this.settings = settings; this.act = act; this.getG = getG;
        this.stack = [];
        this.sig = {};
        this.typing = null;            // { text, n, speaker }
        this.lastSkip = 0;
        this.tipsSeen = {};
        this.tipTimer = 0;
        this.codexTab = 'sym';
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it
        // lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const s of document.querySelectorAll('.screen')) {
            s.addEventListener('click', (e) => { if (e.detail && this.downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), text = $('set-text'), gfx = $('set-gfx');
        sfx.value = settings.sfx; music.value = settings.music; text.value = settings.text; gfx.value = settings.gfx;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, text: text.value, gfx: gfx.value }); onSettings(settings); };
        for (const e of [sfx, music, text, gfx]) e.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // dialogue: a click finishes the typing first, then goes on
        $('dlg').addEventListener('click', (e) => {
            if (e.target.closest('#dlg-choices')) return;
            this.advance();
        });
        $('hand').addEventListener('click', (e) => { const b = e.target.closest('.hcard'); if (b && !b.disabled) { this.audio.ui('click'); this.act({ t: 'place', h: +b.dataset.h }); } });
        $('slots').addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (b && b.classList.contains('filled')) { this.audio.ui('close'); this.act({ t: 'unplace', s: +b.dataset.s }); } });
        $('btn-lay').addEventListener('click', () => { this.audio.ui('open'); this.act({ t: 'lay' }); });
        $('ev-codex').addEventListener('click', () => { this.audio.ui('open'); this.openScreen('codex'); });
        $('tip-close').addEventListener('click', () => this.hideTip());
        $('codex-tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) { this.codexTab = b.dataset.tab; this.audio.ui('click'); this.renderCodex(); } });
    }

    /** Forget what is drawn, so the next sync rebuilds every panel (a new game, the title). */
    reset() {
        this.sig = {}; this.typing = null; this.tipsSeen = {};
        for (const id of ['hud', 'visions', 'daycard', 'tip', 'result', 'actions', 'styles', 'deal', 'dlg']) $(id).hidden = true;
        for (const id of ['vis-row', 'hand', 'slots', 'dlg-choices', 'toasts']) $(id).innerHTML = '';
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const e = $(id);
        e.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another screen appears on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        if (id === 'codex') this.renderCodex();
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top()); else this.focusPrimary();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    /** Screens that cannot be dismissed with Escape. */
    modal() { const t = this.top(); return t === 'title' || t === 'evening' || t === 'ending'; }

    ctrls(root) { return [...root.querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) { this.ctrls($(id))[0]?.focus({ preventScroll: true }); }

    /** The controls arrow keys move through: the top screen's, or the table's. */
    context() {
        if (this.top()) return this.ctrls($(this.top()));
        const q = ['#visions .focus', '#dlg-choices .btn', '#dlg-next', '#actions .btn', '#styles .btn', '#slots .slot.filled', '#hand .hcard', '#btn-lay'].join(',');
        return [...document.querySelectorAll(q)].filter((b) => !b.disabled && b.getClientRects().length > 0);
    }
    moveFocus(dir) {
        const list = this.context();
        if (!list.length) return false;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus({ preventScroll: true });
        return true;
    }
    focusPrimary() {
        if (this.top()) return;
        const G = this.getG();
        const pick = ['#dlg-choices .btn', '#dlg-next', '#actions .btn.primary', '#styles .btn', '#evening .evopt', '#btn-lay:not(:disabled)', '#hand .hcard:not(:disabled)'];
        for (const q of pick) {
            const b = [...document.querySelectorAll(q)].find((x) => !x.disabled && x.getClientRects().length > 0);
            if (b) { b.focus({ preventScroll: true }); return; }
        }
    }
    /** Enter or Space with no button focused: press the main thing on screen. */
    primary() {
        const q = this.top() ? ['.btn.primary', '.evopt'].map((s) => `#${this.top()} ${s}`) : ['#dlg-next', '#actions .btn.primary', '#actions .btn'];
        for (const s of q) { const b = [...document.querySelectorAll(s)].find((x) => !x.disabled && x.getClientRects().length > 0); if (b) { b.click(); return true; } }
        return false;
    }
    pressNumber(n) {
        // the number is the card's place in the hand (or the answer's place in the list), whether or not it is free
        const groups = this.top() ? [`#${this.top()} .evopt`, `#${this.top()} .menu .btn`] : ['#dlg-choices .btn', '#hand .hcard', '#styles .btn', '#actions .btn'];
        for (const s of groups) {
            const list = [...document.querySelectorAll(s)].filter((x) => x.getClientRects().length > 0);
            if (!list.length) continue;
            const b = list[n - 1];
            if (b && !b.disabled) { b.click(); return true; }
            return false;
        }
        return false;
    }
    focusClouded() { const b = document.querySelector('#visions .focus:not(:disabled)'); if (b) { b.click(); return true; } return false; }
    unplaceLast() {
        const G = this.getG();
        if (G.phase !== 'deal') return false;
        for (let s = 2; s >= 0; s--) if (G.reading.placed[s] !== null) return this.act({ t: 'unplace', s });
        return false;
    }

    // ------------------------------------------------------------------ the dialogue
    partnerName(G) {
        if (G.client) return G.client.name;
        const c = G.dlg?.ctx;
        if (c && (c.kind === 'cand' || c.kind === 'quiet')) return CAND[c.id].name;
        if (c && c.kind === 'prince') return 'Prince Caspian';
        if (G.phase === 'finale' && G.romance?.pick) return CAND[G.romance.pick].name;
        if (G.phase === 'scene') return 'Prince Caspian';
        return '';
    }
    speed() { return { slow: 12, normal: 60, fast: 160, instant: 1e9 }[this.settings.text] || 60; }   // 'slow' is for the tests

    advance() {
        const G = this.getG();
        if (!G.dlg) return;
        if (this.typing && this.typing.n < this.typing.text.length) { this.lastSkip = performance.now(); this.typing.n = this.typing.text.length; this.paintTyping(); return; }
        if (G.dlg.choices && G.dlg.i >= G.dlg.lines.length - 1) return;
        this.audio.ui('click');
        this.act({ t: 'next' });
        // draw the new line at once: a second click before the next frame must see this line's typewriter, not the old one's
        this.sync(this.getG(), 0, true);
    }

    paintTyping() {
        const t = this.typing; if (!t) return;
        $('dlg-text').textContent = t.text.slice(0, t.n);
        if (t.n >= t.text.length && !t.done) {
            t.done = true;
            const G = this.getG();
            if (G.dlg && G.dlg.choices && G.dlg.i >= G.dlg.lines.length - 1) this.showChoices(G);
            window.A11Y?.announce((t.name ? t.name + ': ' : '') + t.text);
        }
    }

    showChoices(G) {
        const box = $('dlg-choices');
        box.innerHTML = '';
        G.dlg.choices.forEach((c, i) => {
            const b = el('button', 'btn kb settling', `${i + 1}. ${c.t}`);
            b.dataset.i = i;
            b.addEventListener('click', () => { this.audio.ui('click'); this.act({ t: 'choose', i }); });
            box.appendChild(b);
        });
        $('dlg-next').hidden = true;
        // a tap that finished the typing must not also choose the answer that appears under the finger
        const delay = performance.now() - this.lastSkip < 600 ? 700 : 160;
        setTimeout(() => { box.querySelectorAll('.settling').forEach((b) => b.classList.remove('settling')); this.focusPrimary(); }, delay);
    }

    /** Which character's portrait goes with the speaker: the Meshy model's name, or '' (villagers have none). */
    partnerPortrait(G) {
        if (G.client) return G.client.look?.model || '';
        const c = G.dlg?.ctx;
        if (c && (c.kind === 'cand' || c.kind === 'quiet')) return CAND[c.id].look.model || '';
        if (c && c.kind === 'prince') return PRINCE.look.model;
        if (G.phase === 'finale' && G.romance?.pick) return CAND[G.romance.pick].look.model || '';
        if (G.phase === 'scene') return PRINCE.look.model;
        return '';
    }

    /** Show or hide an <img> for art that may be missing: it only appears once it has loaded. */
    setArt(img, src) {
        if (!src) { img.hidden = true; img.removeAttribute('src'); return; }
        if (img.dataset.src === src && !img.hidden) return;
        img.dataset.src = src;
        img.onload = () => { if (img.dataset.src === src) img.hidden = false; };
        img.onerror = () => { img.hidden = true; };
        img.src = src;
    }

    renderDlg(G) {
        const d = G.dlg;
        const dlg = $('dlg');
        if (!d) { dlg.hidden = true; this.typing = null; this.setArt($('dlg-portrait'), ''); return; }
        const line = d.lines[d.i];
        dlg.hidden = false;
        dlg.dataset.w = line.w;
        const name = line.w === 'c' ? this.partnerName(G) : line.w === 'y' ? 'You' : line.w === 'o' ? 'Orla’s journal' : '';
        $('dlg-name').textContent = name;
        const face = line.w === 'c' ? this.partnerPortrait(G) : '';
        this.setArt($('dlg-portrait'), face ? `art/portrait-${face}.webp` : '');
        $('dlg-choices').innerHTML = '';
        $('dlg-next').hidden = false;
        $('dlg-next').textContent = d.i >= d.lines.length - 1 && !d.choices ? 'Continue ▸' : '▸';
        this.typing = { text: line.t, n: 0, name, speaker: line.w, done: false };
        if (this.speed() > 1e8) { this.typing.n = line.t.length; this.paintTyping(); } else $('dlg-text').textContent = '';
        this.focusPrimary();
    }

    // ------------------------------------------------------------------ HUD
    renderHud(G, play) {
        $('hud').hidden = !play || G.phase === 'ending';
        if (!play) return;
        $('hud-day').textContent = `Day ${G.day} · ${DAY_NAMES[G.day]}`;
        $('rank-name').textContent = RANKS[G.rank].name;
        const cur = RANKS[G.rank].xp, nxt = RANKS[G.rank + 1]?.xp ?? cur + 1;
        $('xp-fill').style.width = (G.rank >= RANKS.length - 1 ? 100 : Math.min(100, ((G.xp - cur) / (nxt - cur)) * 100)) + '%';
        const total = RANKS[G.rank].focus;
        const pips = $('focus-pips');
        pips.title = `Focus: ${G.focus} left today`;
        pips.innerHTML = '';
        for (let i = 0; i < total; i++) pips.appendChild(el('i', i < G.focus ? '' : 'used'));
    }

    // ------------------------------------------------------------------ visions
    renderVisions(G) {
        const box = $('visions');
        const R = G.reading;
        const live = R && G.ball && ['ball', 'deal', 'flip', 'style'].includes(G.phase) && G.ball.shown > 0;
        box.hidden = !live;
        if (!live) return;
        const row = $('vis-row');
        row.innerHTML = '';
        const done = !!R.result;
        for (let i = 0; i < G.ball.shown; i++) {
            const v = R.visions[i];
            const cloudy = v.clouded && !done;
            const known = !!G.know.sym[v.sym], cknown = !!G.know.col[v.col];
            const hex = COLOURS[v.col].hex;
            const c = el('div', 'vis' + (cloudy ? ' cloudy' : ''));
            c.style.setProperty('--glow', hex);
            c.appendChild(el('div', 'when', TIME_SHORT[i]));
            c.appendChild(cloudy ? cloudElement(hex, 64) : glyphElement(v.sym, hex, 64));
            const name = cloudy ? 'Clouded' : known ? SYMBOLS[v.sym].name : 'Unknown symbol';
            c.appendChild(el('div', 'name', name));
            const tone = cknown ? COLOURS[v.col].tone : null;
            const theme = !cloudy && known ? THEMES[SYMBOLS[v.sym].theme].name : '?';
            const mean = `${theme} · ` + (tone ? `<span class="${tone === 'boon' ? 'boon' : 'bane'}">${tone}</span> <span class="mini">(${COLOURS[v.col].name})</span>` : '<span class="mini">unknown hue</span>');
            c.appendChild(el('div', 'mean', mean));
            if (cloudy && (G.phase === 'ball' || G.phase === 'deal')) {
                const b = el('button', 'btn small focus kb', '✦ Focus');
                b.disabled = G.focus <= 0;
                b.title = G.focus > 0 ? 'Spend a Focus to clear this vision (F)' : 'No Focus left today';
                b.addEventListener('click', () => { this.audio.ui('open'); this.act({ t: 'focus', i }); });
                c.appendChild(b);
            }
            row.appendChild(c);
        }
        const om = $('omen-line');
        if (G.ball.omen) {
            om.hidden = false;
            const th = R.omen.theme, kn = !!G.know.omen[th];
            om.innerHTML = `<b>Omen:</b> ${OMENS[th].text} <span class="mini">${kn ? '→ ' + THEMES[th].name : '→ ?'}</span>`;
        } else om.hidden = true;
    }

    // ------------------------------------------------------------------ cards
    renderDeal(G) {
        const box = $('deal');
        const on = G.phase === 'deal';
        box.hidden = !on;
        if (!on) return;
        const R = G.reading;
        const slots = $('slots'); slots.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const h = R.placed[i] !== null ? R.hand[R.placed[i]] : null;
            const s = el('button', 'slot' + (h ? ' filled' : ''), '');
            s.dataset.s = i;
            s.setAttribute('aria-label', h ? `${TIME_SHORT[i]}: ${CARDS[h.c].name}${h.r ? ', reversed' : ''}. Press to take it back.` : `${TIME_SHORT[i]}: empty`);
            if (h) { s.appendChild(cardElement(h.c, h.r, 60)); s.appendChild(el('div', 'nm', `${TIME_SHORT[i]}`)); } else s.textContent = TIME_SHORT[i];
            slots.appendChild(s);
        }
        const hand = $('hand'); hand.innerHTML = '';
        R.hand.forEach((h, i) => {
            const c = CARDS[h.c];
            const b = el('button', 'hcard kb');
            b.dataset.h = i; b.disabled = R.placed.includes(i);
            b.setAttribute('aria-label', `${i + 1}. ${c.name}, ${h.r ? 'reversed' : 'upright'}: ${c.themes.map((t) => THEMES[t].name).join(' and ')}`);
            b.appendChild(el('span', 'num', String(i + 1)));
            b.appendChild(cardElement(h.c, h.r, 100));
            b.appendChild(el('div', 'nm', c.name));
            b.appendChild(el('div', 'ori ' + (h.r ? 'rv' : 'up'), h.r ? '▼ reversed' : '▲ upright'));
            b.appendChild(el('div', 'th', c.themes.map((t) => THEMES[t].name).join(' · ')));
            b.title = `${c.name}\n${h.r ? c.rev : c.up}`;
            hand.appendChild(b);
        });
        const n = R.placed.filter((p) => p !== null).length;
        $('btn-lay').disabled = n < 3;
        $('deal-hint').textContent = n < 3 ? `Choose a card for ${TIME_NAMES[R.placed.indexOf(null)].toLowerCase()}.` : 'Ready when you are.';
    }

    renderStyles(G) {
        const box = $('styles');
        const on = G.phase === 'style';
        box.hidden = !on;
        if (!on) { box.innerHTML = ''; return; }
        box.innerHTML = '';
        box.appendChild(el('div', '', '')).id = 'styles-note';
        $('styles-note').textContent = 'The cards are turned. How will you tell it?';
        const desc = { truth: 'Say it as it is.', kind: 'Soften the sharp edges.', bold: 'Make it a marvel.' };
        STYLES.forEach((s, i) => {
            const b = el('button', 'btn kb', `${i + 1}. ${STYLE_NAME[s]}<small>${desc[s]}</small>`);
            b.addEventListener('click', () => { this.audio.ui('click'); this.act({ t: 'say', style: s }); });
            box.appendChild(b);
        });
    }

    renderActions(G) {
        const box = $('actions');
        box.innerHTML = '';
        const mk = (label, cls, fn) => { const b = el('button', 'btn kb ' + cls, label); b.addEventListener('click', fn); box.appendChild(b); return b; };
        const timed = !G.dlg && ['dayintro', 'arrive', 'leave'].includes(G.phase);
        if (!G.dlg && G.phase === 'ready') mk('✨ Gaze into the crystal ball', 'primary glow', () => { this.audio.ui('open'); this.act({ t: 'gaze' }); });
        else if (!G.dlg && G.phase === 'ball') {
            if (G.ball.done) mk('Draw the cards ▸', 'primary glow', () => { this.audio.ui('open'); this.act({ t: 'draw' }); });
            else mk('Skip ▸▸', 'small', () => this.act({ t: 'next' }));
        } else if (!G.dlg && G.phase === 'flip') mk('Skip ▸▸', 'small', () => this.act({ t: 'next' }));
        else if (timed) mk('Skip ▸▸', 'small', () => this.act({ t: 'next' }));
        box.hidden = !box.children.length;
    }

    renderResult(G) {
        const box = $('result');
        const R = G.reading, res = R?.result;
        const on = G.phase === 'react' && res;
        box.hidden = !on;
        if (!on) { box.innerHTML = ''; return; }
        box.className = 'glass';
        const verdict = ['The cards would not speak.', 'A faint echo of the truth.', 'Mostly true.', 'The universe nods.'][res.stars];
        let h = `<div class="stars">${'★'.repeat(res.stars)}<span class="off">${'★'.repeat(3 - res.stars)}</span></div><div class="verdict">${verdict}${res.styleMatch ? ' · told just as they hoped' : ''}</div><div class="beats">`;
        R.beats.forEach((b, i) => {
            const p = res.per[i];
            const cls = p.pts === 2 ? 'ok' : p.pts === 1 ? 'half' : 'no';
            const mark = p.pts === 2 ? '✓' : p.pts === 1 ? '≈' : '✗';
            h += `<div class="beat ${cls}"><div class="t">${TIME_SHORT[i]}</div><div class="mark">${mark}</div><div class="truth">${THEMES[b.theme].name} · ${b.tone}</div><div class="laid">${CARDS[p.card].name}${p.rev ? ' ▼' : ''}</div></div>`;
        });
        h += '</div><div class="chips">';
        h += `<span class="chip">+${res.xp} insight</span>`;
        for (const f of res.learned) h += `<span class="chip gain">learned: ${labelOf(f)}</span>`;
        if (res.clue) h += `<span class="chip clue">clue: ${CLUE_TEXT[res.clue].name}</span>`;
        if (res.aff) h += `<span class="chip">♥ +${res.aff}</span>`;
        if (res.rankUp) h += `<span class="chip rank">${RANKS[G.rank].name}!</span>`;
        h += '</div>';
        box.innerHTML = h;
    }

    // ------------------------------------------------------------------ evening, festival, ending
    renderEvening(G) {
        const on = G.phase === 'dusk' || G.phase === 'festival';
        if (!on) { if (this.stack.includes('evening')) this.closeScreen('evening'); return; }
        const fest = G.phase === 'festival';
        $('ev-kicker').textContent = fest ? 'Day 7 · Harvest Moon' : `Day ${G.day} · Dusk`;
        $('ev-head').textContent = fest ? 'The Harvest Moon Fair' : 'The lanterns come on in Hollowmere';
        $('ev-sub').textContent = fest ? 'The fireworks are about to start. Who will you watch them with?' : (G.day === 6 ? 'Tomorrow is the Fair. How will you spend this evening?' : 'How will you spend the evening?');
        const box = $('ev-options'); box.innerHTML = '';
        G.evening.forEach((o, i) => {
            let name, desc, color = '#f0c85a';
            if (o.kind === 'study') { name = 'Study Orla’s journal'; desc = 'Learn three meanings you do not yet know, and gain insight.'; color = '#35e0c0'; }
            else if (o.kind === 'alone') { name = 'Watch alone'; desc = 'A seer’s own fortune is hers to leave unread.'; color = '#b3a4d8'; }
            else {
                const c = CAND[o.id]; color = c.color; name = c.name;
                const sc = SCENES[o.id][o.stage];
                desc = fest ? `${c.role}. ${hearts(Math.floor(o.aff / 2), 7)}` : `${sc ? sc.title : 'A quiet evening'} · ${c.role}. ${hearts(Math.floor(o.aff / 2), 7)}`;
            }
            const b = el('button', 'evopt kb', `<span class="n">${i + 1}. ${name}</span><span class="d">${desc}</span>`);
            b.style.setProperty('--c', color);
            b.addEventListener('click', () => { this.audio.ui('click'); this.act({ t: 'evening', id: o.id }); });
            box.appendChild(b);
        });
        this.openScreen('evening');
    }

    renderEnding(G) {
        const on = G.phase === 'ending';
        if (!on) { if (this.stack.includes('ending')) this.closeScreen('ending'); return; }
        const E = G.ending;
        this.setArt($('end-art'), `art/end-${E.id}.webp`);
        $('end-head').textContent = E.title;
        $('end-text').innerHTML = E.text.map((t) => `<p>${t}</p>`).join('');
        const r = E.romance;
        let rom = '';
        if (r && r.pick) {
            const c = CAND[r.pick];
            rom = r.tier === 'love' ? `<b>♥ ${c.name}.</b> What began with a reading by candlelight becomes the great story of your life. They stay. So do you.`
                : r.tier === 'sweet' ? `<b>♥ ${c.name}.</b> You walk home together under the lanterns, and agree, very quietly, to see where the road goes.`
                    : `<b>${c.name}</b> remains a dear friend. Some fortunes take more than a season to read.`;
        } else rom = r ? '<b>You watched alone,</b> and found you were good company.' : '';
        $('end-romance').innerHTML = rom;
        const st = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
        $('end-stats').innerHTML = st(`${E.clues}/5`, 'clues found') + st('★'.repeat(E.grand) + '☆'.repeat(3 - E.grand), 'grand reading') + st(RANKS[E.rank].name, 'final rank') + st(E.stars[3] + ' · ' + E.stars[2] + ' · ' + E.stars[1], 'three / two / one-star readings') + st(`${E.trust}/8`, 'Caspian’s trust');
        this.openScreen('ending');
    }

    // ------------------------------------------------------------------ the Codex
    renderCodex() {
        const G = this.getG();
        const tabs = [['sym', 'Symbols'], ['col', 'Colours'], ['omen', 'Omens'], ['card', 'Cards'], ['clue', 'Clues'], ['ppl', 'People']];
        const tb = $('codex-tabs');
        tb.innerHTML = '';
        for (const [id, label] of tabs) { const b = el('button', '', label); b.dataset.tab = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', id === this.codexTab); tb.appendChild(b); }
        const body = $('codex-body'); body.innerHTML = '';
        const T = this.codexTab;
        if (T === 'sym') {
            const n = SYMBOL_IDS.filter((s) => G.know.sym[s]).length;
            body.appendChild(el('div', 'sec', `Symbols understood: ${n} / ${SYMBOL_IDS.length}`));
            const g = el('div', 'cx-grid');
            for (const s of SYMBOL_IDS) {
                const k = G.know.sym[s], th = SYMBOLS[s].theme;
                const c = el('div', 'cx' + (k ? '' : ' unk'));
                c.style.setProperty('--glow', '#f0c85a');
                c.appendChild(glyphElement(s, k ? '#f0c85a' : '#7a6a9a', 56));
                c.appendChild(el('div', 'nm', k ? SYMBOLS[s].name : '???'));
                c.appendChild(el('div', 'sub', k ? `${THEMES[th].name}<br><span class="mini">${CARDS_OF[th].map((id) => CARDS[id].name.replace('The ', '')).join(', ')}</span>` : 'not yet understood'));
                g.appendChild(c);
            }
            body.appendChild(g);
        } else if (T === 'col') {
            body.appendChild(el('div', 'sec', 'Colours: the tone of a vision'));
            const g = el('div', 'cx-grid');
            for (const id of COLOUR_IDS) {
                const k = G.know.col[id], C = COLOURS[id];
                const c = el('div', 'cx' + (k ? '' : ' unk'));
                const sw = el('div', 'sw'); sw.style.setProperty('--c', C.hex); c.appendChild(sw);
                c.appendChild(el('div', 'nm', k ? C.name : '???'));
                c.appendChild(el('div', 'sub', k ? `<span style="color:var(${C.tone === 'boon' ? '--boon' : '--bane'})">${C.tone}</span><br>${C.note}` : 'not yet understood'));
                g.appendChild(c);
            }
            body.appendChild(g);
        } else if (T === 'omen') {
            body.appendChild(el('div', 'sec', 'Omens: what the room says'));
            const l = el('div', 'cx-list');
            for (const th of THEME_IDS) {
                const k = G.know.omen[th];
                l.appendChild(el('div', 'cx-row' + (k ? '' : ' unk'), k ? `<div><div class="nm">${OMENS[th].name} → ${THEMES[th].name}</div><div class="sub">${OMENS[th].text}</div></div>` : '<div><div class="nm">???</div><div class="sub">You have not yet understood this omen.</div></div>'));
            }
            body.appendChild(l);
        } else if (T === 'card') {
            body.appendChild(el('div', 'sec', 'The deck: upright brings a boon, reversed a bane'));
            const g = el('div', 'cx-grid');
            for (const c of CARDS) {
                const d = el('div', 'cx card');
                d.appendChild(cardElement(c.id, false, 66));
                d.appendChild(el('div', '', `<div class="nm">${c.name}</div><div class="sub">${c.themes.map((t) => THEMES[t].name).join(' · ')}</div><div class="mini">▲ ${c.up}</div><div class="mini">▼ ${c.rev}</div>`));
                g.appendChild(d);
            }
            body.appendChild(g);
        } else if (T === 'clue') {
            const n = CLUES.filter((c) => G.clues[c]).length;
            body.appendChild(el('div', 'sec', `The plot against ${KINGDOM.king}: ${n} / ${CLUES.length}`));
            const l = el('div', 'cx-list');
            for (const id of CLUES) {
                const k = G.clues[id];
                l.appendChild(el('div', 'cx-row' + (k ? '' : ' unk'), k ? `<div><div class="nm">${CLUE_TEXT[id].name}</div><div class="sub">${CLUE_TEXT[id].text}</div><div class="mini">${G.clueHow[id] === 'romance' ? 'told to you in confidence' : 'seen in a reading'}</div></div>` : `<div><div class="nm">???</div><div class="sub">${CLUE_HINT[id]}</div></div>`));
            }
            body.appendChild(l);
        } else {
            body.appendChild(el('div', 'sec', 'People'));
            const l = el('div', 'cx-list');
            l.appendChild(el('div', 'cx-row' + (G.day >= 2 ? '' : ' unk'), G.day >= 2 ? `<div><div class="nm">Prince Caspian</div><div class="sub">The Second Prince. Trust: <span class="hearts">${hearts(G.trust, 8)}</span></div></div>` : '<div><div class="nm">???</div><div class="sub">Someone is coming who will change everything.</div></div>'));
            for (const id of CAND_IDS) {
                const c = CAND[id], met = G.met[id];
                l.appendChild(el('div', 'cx-row' + (met ? '' : ' unk'), met ? `<div><div class="nm" style="color:${c.color}">${c.name} · ${c.role}</div><div class="sub">${c.blurb}</div><div class="hearts">${hearts(Math.floor(G.aff[id] / 2), 7)}</div><div class="mini">Evenings together: ${G.stage[id]} / 4</div></div>` : '<div><div class="nm">???</div><div class="sub">Someone in the village you have yet to meet.</div></div>'));
            }
            body.appendChild(l);
            body.appendChild(el('p', 'mini', `Hearts grow with good readings, the way you tell them, and evenings spent together. ${ROMANCE_MIN / 2 | 0}+ hearts and a festival night could mean something.`));
        }
    }

    // ------------------------------------------------------------------ tips and toasts
    tip(key) {
        if (this.tipsSeen[key] || !TIPS[key]) return;
        this.tipsSeen[key] = true;
        $('tip-text').textContent = TIPS[key];
        $('tip').hidden = false;
        clearTimeout(this.tipTimer);
        this.tipTimer = setTimeout(() => this.hideTip(), 16000);
    }
    hideTip() { $('tip').hidden = true; }

    toast(text, cls = '') {
        const e = el('div', 'toast ' + cls);
        e.textContent = text;
        $('toasts').appendChild(e);
        setTimeout(() => e.remove(), 3300);
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'learn') for (const f of e.items.slice(0, 3)) this.toast('Learned: ' + labelOf(f));
            else if (e.type === 'clue') this.toast('New clue: ' + CLUE_TEXT[e.id].name);
            else if (e.type === 'rankup') this.toast(`Rank up: ${RANKS[e.rank].name}. ${RANKS[e.rank].perk}`, 'rank');
            else if (e.type === 'aff' && e.delta > 0) this.toast(`♥ ${CAND[e.id].short} +${e.delta}`);
            else if (e.type === 'trust' && e.delta !== 0) this.toast(`Caspian’s trust ${e.delta > 0 ? '+' : ''}${e.delta}`);
        }
    }

    // ------------------------------------------------------------------ the per-frame sync
    /** Rebuild only the parts whose state changed; run the typewriter. */
    sync(G, dt, play) {
        const sig = {
            hud: play ? `${G.day}|${G.rank}|${G.xp}|${G.focus}|${G.phase === 'ending'}` : 'off',
            dlg: G.dlg ? `${G.dlg.i}|${G.dlg.lines.length}|${G.dlg.then}|${G.dlg.lines[G.dlg.i].t}|${this.partnerName(G)}` : '',
            vis: G.reading && G.ball ? `${G.phase}|${G.ball.shown}|${G.ball.omen}|${G.reading.visions.map((v) => v.clouded).join()}|${G.focus}|${!!G.reading.result}|${Object.keys(G.know.sym).length}${Object.keys(G.know.col).length}${Object.keys(G.know.omen).length}` : '',
            deal: G.phase === 'deal' ? `${G.reading.placed.join()}|${G.reading.hand.length}|${G.client?.id}` : '',
            styles: G.phase === 'style' ? 'y' : '',
            act: `${G.phase}|${G.ball?.done}|${!!G.dlg}`,
            res: G.phase === 'react' && G.reading?.result ? `${G.reading.result.stars}|${G.client?.id}` : '',
            ev: `${G.phase}|${G.day}|${G.evening ? G.evening.map((o) => o.id + o.stage + o.aff).join() : ''}`,
            end: G.phase === 'ending' ? 'e' : '',
            day: G.phase === 'dayintro' && !G.dlg ? G.day : 0,
        };
        const S = this.sig;
        if (sig.hud !== S.hud) this.renderHud(G, play);
        if (sig.dlg !== S.dlg) this.renderDlg(G);
        if (sig.vis !== S.vis) this.renderVisions(G);
        if (sig.deal !== S.deal) this.renderDeal(G);
        if (sig.styles !== S.styles) this.renderStyles(G);
        if (sig.act !== S.act) this.renderActions(G);
        if (sig.res !== S.res) this.renderResult(G);
        if (sig.ev !== S.ev) this.renderEvening(G);
        if (sig.end !== S.end) this.renderEnding(G);
        if (sig.day !== S.day) {
            const dc = $('daycard');
            dc.hidden = !sig.day;
            if (sig.day) { dc.querySelector('.dc-day').textContent = 'Day ' + G.day; dc.querySelector('.dc-name').textContent = DAY_NAMES[G.day]; }
        }
        if (sig.deal !== S.deal || sig.styles !== S.styles || sig.act !== S.act || sig.res !== S.res || sig.ev !== S.ev) this.focusPrimary();
        // the first time a phase comes up, a tip from the journal
        if (play && !G.dlg) { if (G.phase === 'ready') this.tip('ready'); else if (G.phase === 'ball' && G.ball?.omen) this.tip('ball'); else if (G.phase === 'deal') this.tip('deal'); else if (G.phase === 'style') this.tip('style'); else if (G.phase === 'react') this.tip('result'); else if (G.phase === 'dusk') this.tip('dusk'); }
        this.sig = sig;

        // the typewriter
        const t = this.typing;
        if (t && t.n < t.text.length) {
            t.acc = (t.acc || 0) + dt * this.speed();
            const k = Math.floor(t.acc);
            if (k > 0) { t.acc -= k; t.n = Math.min(t.text.length, t.n + k); this.paintTyping(); }
        }
    }
    get isTyping() { return !!(this.typing && this.typing.n < this.typing.text.length); }
}
