// The DOM layer: screens, the HUD and toolbar, the glade map, the creature journal, story cards, captions and
// toasts. Reads the sim and the progress; changes neither (main does, through callbacks).

import { VERSION, CHAPTERS, WISPS, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from './config.js';
import { starsFor } from './sim/game.js';
import { LINES } from './audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
    constructor({ audio, settings, onSettings, onDelete, onLevel }) {
        this.audio = audio;
        this.settings = settings;
        this.onLevel = onLevel;
        this.stack = [];
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        // Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = ['sfx', 'music', 'voice'];
        for (const k of ids) $('set-' + k).value = settings[k];
        $('set-glyphs').checked = settings.glyphs;
        $('set-calm').checked = settings.calm;
        const changed = () => {
            for (const k of ids) settings[k] = +$('set-' + k).value;
            settings.glyphs = $('set-glyphs').checked;
            settings.calm = $('set-calm').checked;
            onSettings(settings);
        };
        for (const k of ids) $('set-' + k).addEventListener('input', changed);
        $('set-glyphs').addEventListener('change', changed);
        $('set-calm').addEventListener('change', changed);
        let armed = 0;
        $('set-delete').addEventListener('click', () => {
            if (Date.now() - armed > 3000) { armed = Date.now(); this.toast('Tap again to forget everything'); return; }
            armed = 0; onDelete(); this.toast('All progress forgotten.');
        });
        audio.onSay = (name) => this.caption(name);
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // same-z screens stack in page order; give each a z-index from the open stack instead
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.onClose?.(id);
    }
    closeTop() { const t = this.top(); if (t && t !== 'title') this.closeScreen(t); }
    closeAll() { for (const id of [...this.stack]) { $(id).hidden = true; } this.stack = []; }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) {
        // a primary button is the natural first stop; otherwise the first control
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('lvl') && b.classList.contains('next')) || list.find((b) => b.classList.contains('primary') && !b.closest('.sheet-foot')) || list[0])?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const el = list[(i + dir + list.length) % list.length];
        el.focus();
        el.scrollIntoView({ block: 'nearest' });
    }

    // ------------------------------------------------------------------ backdrop
    setBackdrop(chapterId) {
        const url = `url('art/bg-${chapterId}.webp')`;
        if (this.bgNow === url) return;
        this.bgNow = url;
        this.bgFlip = !this.bgFlip;
        const on = $(this.bgFlip ? 'bg-a' : 'bg-b'), off = $(this.bgFlip ? 'bg-b' : 'bg-a');
        on.style.backgroundImage = url;
        on.classList.add('on'); off.classList.remove('on');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on; $('toolbar').hidden = !on; $('companion').hidden = !on;
        if (!on) { $('banner').hidden = true; }
    }
    /** Pixels the board must keep clear at the top and bottom. */
    reserved() {
        const hud = $('hud').getBoundingClientRect(), tb = $('toolbar').getBoundingClientRect();
        const rail = tb.height > tb.width;            // the landscape-phone toolbar runs down the right edge
        return rail
            ? { top: Math.max(60, hud.bottom + 10), bottom: 16, right: innerWidth - tb.left + 8 }
            : { top: Math.max(60, hud.bottom + 14), bottom: Math.max(90, innerHeight - tb.top + 12), right: 0 };
    }
    hud(G, label) {
        $('hud-level').textContent = label.num;
        $('hud-chapter').textContent = label.name;
        $('hud-mv').textContent = G.moves;
        const s = G.won ? G.stars : starsFor(G);
        [...$('hud-stars').children].forEach((el, i) => el.classList.toggle('on', i < s));
        $('hint-count').textContent = G.hints;
        $('tool-hint').disabled = G.hints <= 0 || G.won;
        $('tool-undo').disabled = !G.hist.length || G.won;
        $('tool-sprout').disabled = G.sprout || G.won;
        $('tool-restart').disabled = G.won || G.moves === 0;
    }
    pulseTools(on) {
        for (const id of ['tool-undo', 'tool-sprout', 'tool-restart']) $(id).classList.toggle('pulse', on && !$(id).disabled);
    }
    banner(text, ms = 3500) {
        const el = $('banner');
        el.textContent = text; el.hidden = false;
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => { el.hidden = true; }, ms);
    }
    companion(pose) {
        const el = $('companion');
        el.src = `art/${pose === 'cheer' ? 'lumi-cheer' : pose === 'think' ? 'lumi-think' : 'lumi'}.webp`;
        clearTimeout(this.poseT);
        if (pose !== 'idle') this.poseT = setTimeout(() => { el.src = 'art/lumi.webp'; }, 2600);
    }
    caption(name) {
        const text = LINES[name];
        if (!text || (this.top() === 'story')) return;
        $('caption-face').src = name.startsWith('willow') ? 'art/por-willow.webp' : 'art/por-lumi.webp';
        $('caption-text').textContent = text;
        $('caption').hidden = false;
        clearTimeout(this.capT);
        this.capT = setTimeout(() => { $('caption').hidden = true; }, 2600);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ title
    title(P) {
        const today = dayKey();
        $('daily-note').textContent = P.daily.last === today ? '✓ done today' : P.daily.streak ? `🔥 ${P.daily.streak}` : 'new!';
        $('btn-play').textContent = P.cur ? 'Continue' : P.unlocked === 0 && !P.stars[0] ? 'Begin' : 'Play';
    }

    // ------------------------------------------------------------------ map
    map(P) {
        const box = $('chapters');
        box.textContent = '';
        let total = 0;
        CHAPTERS.forEach((ch, c) => {
            const first = c * LEVELS_PER_CHAPTER;
            const stars = P.stars.slice(first, first + LEVELS_PER_CHAPTER).reduce((a, s) => a + s, 0);
            total += stars;
            const card = document.createElement('section');
            card.className = 'chapter' + (P.unlocked < first ? ' locked' : '');
            card.style.backgroundImage = `url('art/bg-${ch.id}.webp')`;
            const h = document.createElement('h3'); h.textContent = ch.name;
            const sub = document.createElement('div'); sub.className = 'ch-sub';
            sub.textContent = `${stars} / ${LEVELS_PER_CHAPTER * 3} ★` + (ch.teach ? ` · new: ${{ mist: 'mist', bramble: 'brambles', cup: 'acorn cups' }[ch.teach]}` : '');
            const grid = document.createElement('div'); grid.className = 'levels';
            for (let i = 0; i < LEVELS_PER_CHAPTER; i++) {
                const n = first + i;
                const b = document.createElement('button');
                b.className = 'lvl' + (n === P.unlocked && !P.stars[n] ? ' next' : '');
                b.dataset.level = n;
                b.disabled = n > P.unlocked;
                b.setAttribute('aria-label', `Level ${n + 1}${P.stars[n] ? `, ${P.stars[n]} stars` : ''}${b.disabled ? ', locked' : ''}`);
                const num = document.createElement('span'); num.textContent = b.disabled ? '🔒' : String(n + 1);
                const st = document.createElement('span'); st.className = 'st';
                for (let k = 0; k < 3; k++) { const i2 = document.createElement('i'); if (k < P.stars[n]) i2.className = 'on'; st.appendChild(i2); }
                b.append(num, st);
                b.addEventListener('click', () => { this.audio.ui('click'); this.onLevel(n); });
                grid.appendChild(b);
            }
            card.append(h, sub, grid);
            box.appendChild(card);
        });
        $('map-total').textContent = `${total} of ${TOTAL_LEVELS * 3} stars gathered`;
        const dreams = P.unlocked >= LEVELS_PER_CHAPTER;
        $('dream-row').hidden = !dreams;
        $('dream-note').textContent = P.dreams ? `${P.dreams} dreamt` : '';
    }

    // ------------------------------------------------------------------ journal
    journal(P) {
        const box = $('creatures');
        box.textContent = '';
        const add = (src, name, colour, blurb, awake, count) => {
            const c = document.createElement('div');
            c.className = 'creature' + (awake ? '' : ' asleep');
            const im = document.createElement('img'); im.src = src; im.alt = awake ? name : 'Still asleep';
            const b = document.createElement('b');
            if (colour) { const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = colour; sw.style.color = colour; b.appendChild(sw); }
            b.append(awake ? name : '???');
            const p = document.createElement('p');
            p.textContent = awake ? blurb + (count ? ` Woken ${count}×.` : '') : 'Still asleep somewhere in the glade.';
            c.append(im, b, p);
            box.appendChild(c);
        };
        add('art/creature-bramble.webp', 'Bramble', null, "Lumi's best friend, a hedgehog with berries in his spines. He keeps the firefly jars.", true, 0);
        WISPS.forEach((w, i) => add(`art/creature-${w.id}.webp`, w.creature, w.hex, w.blurb, P.woke[i] > 0, P.woke[i]));
        const awake = P.woke.filter((x) => x > 0).length;
        $('journal-note').textContent = `${awake} of ${WISPS.length} creatures awake. Every bloom wakes the creature whose heart-light filled it.`;
    }

    // ------------------------------------------------------------------ win
    win(G, info) {
        $('toasts').textContent = '';
        [...$('win-stars').children].forEach((el, i) => { el.classList.remove('on'); void el.offsetWidth; el.classList.toggle('on', i < G.stars); });
        $('win-head').textContent = G.stars === 3 ? 'Glorious!' : G.stars === 2 ? 'Bloomed!' : 'All home!';
        $('win-text').textContent = `${G.moves} pours · Willow did it in ${G.par}` + (G.sprout ? ' · with a sprout' : '') + (info.best ? ' · new best!' : '');
        const box = $('win-creatures');
        box.textContent = '';
        for (const c of [...new Set(G.bloomed)]) {
            const im = document.createElement('img');
            im.src = `art/creature-${WISPS[c].id}.webp`; im.alt = WISPS[c].creature; im.title = WISPS[c].creature;
            box.appendChild(im);
        }
        $('win-next').textContent = info.nextLabel;
        $('win-again').hidden = !info.replay;
    }

    // ------------------------------------------------------------------ story
    story(lines, done) {
        let i = 0;
        const show = () => {
            const L = lines[i];
            $('story-face').src = L.who === 'willow' ? 'art/por-willow.webp' : 'art/por-lumi.webp';
            $('story-name').textContent = L.who === 'willow' ? 'Grandmother Willow' : 'Lumi';
            $('story-text').textContent = L.text;
            $('story-next').textContent = i === lines.length - 1 ? 'Begin' : 'Next';
            if (L.vo) this.audio.say(L.vo, { force: true });
        };
        this.storyNext = () => {
            this.audio.ui('click');
            i++;
            if (i >= lines.length) { this.audio.hush(); this.storyNext = null; this.closeScreen('story'); done(); return; }
            show();
        };
        this.openScreen('story');
        show();
    }
}

export function dayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
