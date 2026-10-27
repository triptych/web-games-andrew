// The DOM layer: the transcript with its typewriter, the status line, the tap-to-type chips,
// the screens, and the chapter cards. Reads the sim (through the helpers it is handed); never
// changes it.

import { VERSION, MAX_SCORE, LOG_KEEP } from './config.js';
import { suggestions, RECIPES, STOCK } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const CPS = { normal: 160, fast: 800, instant: Infinity };

const DIRECT = ['look', 'inventory', 'herbs', 'recipes', 'journal', 'spells', 'hint', 'hide', 'rest', 'wait'];
const ONE = ['take', 'talk', 'read', 'smell', 'study', 'search', 'open', 'knock', 'ring', 'wear', 'taste', 'look'];
const VERB_CHIPS = [['look', 'Look'], ['take', 'Take'], ['talk', 'Talk'], ['ask', 'Ask'], ['use', 'Use'], ['give', 'Give'], ['read', 'Read'], ['smell', 'Smell'], ['study', 'Study'], ['search', 'Search'], ['open', 'Open'], ['cast', 'Cast'], ['brew', 'Brew'], ['hide', 'Hide'], ['rest', 'Rest'], ['wait', 'Wait'], ['inventory', 'Satchel'], ['herbs', 'Herbs'], ['spells', 'Spells'], ['journal', 'Journal'], ['hint', 'Hint']];
const TOPICS = ['marga', 'governor', 'witches', 'infirmary', 'tonic', 'salt road', 'vesper', 'bryony', 'hint'];

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onCommand }) {
        this.audio = audio; this.settings = settings; this.onCommand = onCommand;
        this.stack = [];
        this.queue = [];          // paragraphs still typing
        this.lines = [];          // the transcript as { text, cls }, for saves
        this.speed = CPS[settings.speed] || CPS.normal;
        this.pending = null; this.first = null; this.G = null;
        this.log = $('log'); this.input = $('cmd');
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('click'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), speed = $('set-speed');
        sfx.value = settings.sfx; music.value = settings.music; speed.value = settings.speed;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, speed: speed.value }); this.speed = CPS[speed.value] || CPS.normal; onSettings(settings); };
        for (const el of [sfx, music, speed]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        $('verbs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.verbChip(b.dataset.v); });
        $('nouns').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.nounChip(b.dataset.n, b.dataset.k); });
        $('exits').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { this.reset(); this.onCommand('go ' + b.dataset.d); } });
    }

    // ------------------------------------------------------------------ the transcript
    print(text, cls = '') {
        if (cls === 'room') { /* a heading */ }
        this.lines.push({ text, cls });
        if (this.lines.length > LOG_KEEP * 2) this.lines.splice(0, this.lines.length - LOG_KEEP * 2);
        const p = document.createElement('p');
        if (cls) p.className = cls;
        this.log.appendChild(p);
        if (this.speed === Infinity || cls === 'cmd' || cls === 'room') { p.textContent = text; this.scroll(); } else { p.textContent = ''; this.queue.push({ p, text, n: 0 }); }
    }
    echo(cmd) { this.print('› ' + cmd, 'cmd'); }
    setLog(lines) { this.log.textContent = ''; this.queue = []; this.lines = []; for (const l of lines) { this.lines.push(l); const p = document.createElement('p'); if (l.cls) p.className = l.cls; p.textContent = l.text; this.log.appendChild(p); } this.scroll(); }
    clearLog() { this.log.textContent = ''; this.queue = []; this.lines = []; }
    scroll() { this.log.scrollTop = this.log.scrollHeight; }
    /** Finish typing everything at once. */
    flush() { for (const q of this.queue) q.p.textContent = q.text; this.queue = []; this.scroll(); }
    idle() { return this.queue.length === 0; }
    /** Advance the typewriter by dt seconds. */
    update(dt) {
        if (!this.queue.length) return;
        let budget = Math.max(1, Math.round(this.speed * dt));
        while (budget > 0 && this.queue.length) {
            const q = this.queue[0];
            const take = Math.min(budget, q.text.length - q.n);
            q.n += take; budget -= take;
            q.p.textContent = q.text.slice(0, q.n);
            if (q.n >= q.text.length) this.queue.shift();
        }
        this.scroll();
    }

    // ------------------------------------------------------------------ status
    status(G) {
        $('b-score').textContent = `Score ${G.score}/${MAX_SCORE}`;
        const mx = 2 + G.level;
        $('b-ember').innerHTML = `Ember <b>${'●'.repeat(Math.max(0, G.ember))}${'○'.repeat(Math.max(0, mx - G.ember))}</b>`;
        const pips = Math.round(G.dread / 20);
        $('b-dread').innerHTML = `Dread <b>${'◆'.repeat(pips)}${'◇'.repeat(5 - pips)}</b>`;
        $('b-dread').classList.toggle('hot', G.dread >= 60);
        $('b-silver').textContent = `${G.silver} silver`;
        const ck = $('b-clock'); ck.hidden = G.clock == null; if (G.clock != null) ck.innerHTML = `Wagons <b>${G.clock}</b>`;
    }
    roomName(name) { $('room-name').textContent = name; }
    card(e) {
        const c = $('card');
        c.hidden = true; void c.offsetWidth;
        c.innerHTML = `<div class="n">Chapter ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][e.n] || e.n}</div><div class="t"></div><div class="s"></div>`;
        c.querySelector('.t').textContent = e.title; c.querySelector('.s').textContent = e.sub;
        c.hidden = false;
        clearTimeout(this.cardT); this.cardT = setTimeout(() => { c.hidden = true; }, 3300);
        window.A11Y?.announce(`Chapter ${e.n}: ${e.title}`);
    }

    // ------------------------------------------------------------------ chips
    reset() { this.pending = null; this.first = null; this.input.value = ''; if (this.G) this.chips(this.G); }
    chips(G) {
        this.G = G;
        const s = suggestions(G);
        $('exits').innerHTML = s.exits.map((x) => `<button class="chip exit" type="button" data-d="${x.dir}" title="${x.to}">${x.label}</button>`).join('');
        $('verbs').innerHTML = VERB_CHIPS.map(([v, l]) => `<button class="chip${this.pending === v ? ' on' : ''}" type="button" data-v="${v}">${l}</button>`).join('');
        let nouns;
        const mk = (arr, k) => arr.map((n) => `<button class="chip${k === 'inv' ? ' item' : ''}" type="button" data-n="${esc(n.cmd)}" data-k="${k}">${esc(n.label)}</button>`).join('');
        if (this.pending === 'cast' && !this.first) nouns = s.spells.map((sp) => `<button class="chip" type="button" data-n="${sp.cmd}" data-k="spell">${sp.label} (${sp.cost})</button>`).join('');
        else if (this.pending === 'ask' && this.first) nouns = TOPICS.map((t) => `<button class="chip" type="button" data-n="${t}" data-k="topic">${t}</button>`).join('');
        else if (this.pending === 'brew') nouns = G.recipes.map((id) => `<button class="chip" type="button" data-n="${RECIPES[id].names[0]}" data-k="recipe">${RECIPES[id].name}</button>`).join('') + mk(s.inv.filter((i) => STOCK[Object.keys(STOCK).find((id) => STOCK[id].names[0] === i.cmd)]?.kind === 'herb'), 'herb');
        else nouns = mk(s.npcs, 'npc') + mk(s.things, 'thing') + mk(s.inv, 'inv');
        $('nouns').innerHTML = nouns;
    }
    verbChip(v) {
        this.audio.ui('click');
        if (DIRECT.includes(v)) { this.reset(); this.onCommand(v); return; }
        this.pending = v; this.first = null; this.input.value = v + ' ';
        this.chips(this.G);
    }
    nounChip(n, kind) {
        this.audio.ui('click');
        const v = this.pending;
        const run = (cmd) => { this.pending = null; this.first = null; this.input.value = ''; this.onCommand(cmd); };
        if (!v) return run('look ' + n);
        if (v === 'cast') {
            if (kind === 'spell') { this.first = n; this.input.value = `cast ${n}`; this.chips(this.G); return; }
            return run(`cast ${this.first || ''} on ${n}`);
        }
        if (v === 'ask') {
            if (!this.first) { this.first = n; this.input.value = `ask ${n} about `; this.chips(this.G); return; }
            return run(`ask ${this.first} about ${n}`);
        }
        if (v === 'brew') {
            if (kind === 'recipe') return run('brew ' + n);
            if (!this.first) { this.first = n; this.input.value = `brew ${n} and `; this.chips(this.G); return; }
            return run(`brew ${this.first} and ${n}`);
        }
        if (v === 'use' || v === 'give') {
            if (!this.first) { this.first = n; this.input.value = `${v} ${n} ${v === 'use' ? 'on' : 'to'} `; this.chips(this.G); return; }
            return run(`${v} ${this.first} ${v === 'use' ? 'on' : 'to'} ${n}`);
        }
        run(`${v} ${n}`);
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        if (id === 'dead' || id === 'over') { clearTimeout(this.cardT); $('card').hidden = true; }
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        for (const s of this.stack) $(s).style.zIndex = 50 + this.stack.indexOf(s);
        this.audio.ui('open');
        this.buttons(id)[0]?.focus({ preventScroll: true });
    }
    closeScreen(id) { $(id).hidden = true; this.stack = this.stack.filter((s) => s !== id); if (this.top()) this.buttons(this.top())[0]?.focus({ preventScroll: true }); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden); }
    toast(text) {
        const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
        $('toasts').appendChild(el); setTimeout(() => el.remove(), 2500);
    }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
