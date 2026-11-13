// The DOM layer: screens, the HUD, Mother's speech bubble, the episode card, the report card,
// settings and the touch deck. Reads the sim; never changes it (choices go back to main as commands).

import { VERSION, UFO } from './config.js';
import { LEVELS, SPECIMENS, UPGRADES, LINES, PICKUPS } from './sim/data.js';
import { holdCap, hullMax } from './sim/game.js';
import { motherFace } from './view/sprites.js';
import { portrait } from './view/art.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Draw Mother into a small canvas. */
export function paintMother(canvas, t = 0, mood = 0) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = w * 0.03; ctx.strokeStyle = '#1b1030'; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); ctx.clip();
    const img = portrait(mood);
    if (img) {                       // her painted portrait: fit the width, keep the beehive in frame
        const dw = w * 0.98, dh = dw * img.height / img.width;
        ctx.drawImage(img, (w - dw) / 2, h * 0.04, dw, dh);
        ctx.restore();
        return true;
    }
    ctx.translate(w / 2, h * 0.62);
    ctx.scale(w / 6.2, w / 6.2);
    ctx.lineJoin = 'round';
    motherFace(ctx, t, mood);
    ctx.restore();
    if (!canvas._retry) {            // swap in the painting once it arrives
        canvas._retry = setTimeout(() => { canvas._retry = 0; if (portrait(mood)) paintMother(canvas, t, mood); }, 600);
    }
    return false;
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.sayT = 0;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count (game-071).
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

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), touch = $('set-touch'), crt = $('set-crt');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; touch.value = settings.touch; crt.value = settings.crt;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, touch: touch.value, crt: crt.value });
            document.body.classList.toggle('no-crt', settings.crt === 'off');
            onSettings(settings);
        };
        document.body.classList.toggle('no-crt', settings.crt === 'off');
        for (const el of [sfx, music, voice, touch, crt]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
        paintMother($('mother-mini'));
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another stacks on top of it (game-088)
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); if (!on) $('mother-say').hidden = true; }
    hud(G, dt) {
        const u = G.ufo, L = LEVELS[G.level];
        const tl = Math.max(0, Math.ceil(G.timeLeft));
        $('hud-time').textContent = tl;
        $('hud-time').classList.toggle('low', tl <= 15 && G.phase === 'play');
        const q = $('hud-quota');
        q.textContent = L.boss ? (G.bossDown ? 'Dock with Mother!' : 'Stop the Buzzkill!') : G.quotaMet ? `${G.stats.bankedN} / ${L.quota} · Dock!` : `${G.stats.bankedN} / ${L.quota}`;
        q.classList.toggle('met', G.quotaMet);
        $('hud-score').textContent = G.score.toLocaleString('en-US');
        $('hud-lives').textContent = '×' + Math.max(0, G.lives);
        const hm = hullMax(G), cap = holdCap(G);
        const hullHtml = Array.from({ length: hm }, (_, i) => `<i class="pip${i < u.hull ? '' : ' off'}"></i>`).join('');
        if (hullHtml !== this._hull) { $('hud-hull').innerHTML = hullHtml; this._hull = hullHtml; }
        const holdHtml = Array.from({ length: cap }, (_, i) => `<i class="pip${i < u.hold.length ? ' on' : ''}"></i>`).join('');
        if (holdHtml !== this._hold) { $('hud-hold').innerHTML = holdHtml; this._hold = holdHtml; }
        const en = $('hud-energy');
        en.style.width = `${u.energy}%`;
        en.classList.toggle('lock', u.lock);
        const chips = [];
        if (u.fx.turbo > 0) chips.push(['Turbo', u.fx.turbo]);
        if (u.fx.mega > 0) chips.push(['Mega Beam', u.fx.mega]);
        if (u.fx.shield > 0) chips.push(['Force Field', u.fx.shield]);
        if (u.fx.net > 0) chips.push(['Tangled', u.fx.net, true]);
        if (u.fx.dazzle > 0) chips.push(['Seeing spots', u.fx.dazzle, true]);
        if (u.lock) chips.push(['Beam cooling', 0, true]);
        if (u.defects) chips.push([`Defects ${'⚠'.repeat(u.defects)}`, 0, true]);
        const fx = chips.map(([n, t, bad]) => `<span class="chip${bad ? ' bad' : ''}">${n}${t ? ' ' + Math.ceil(t) : ''}</span>`).join('');
        if (fx !== this._fx) { $('hud-fx').innerHTML = fx; this._fx = fx; }
        if (this.sayT > 0) {
            this.sayT -= dt;
            if (this.sayT <= 0) $('mother-say').hidden = true;
        }
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    /** Mother pipes up over the radio. */
    say(text, mood = 0, secs = 2.8) {
        $('mother-text').textContent = text;
        const box = $('mother-say');
        box.hidden = false;
        box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
        paintMother($('mother-mini'), performance.now() / 1000, mood);
        this.sayT = secs;
        this.audio.mother(text, mood);
        window.A11Y?.announce?.(`Mother: ${text}`);
    }

    onEvents(G, events, pick) {
        for (const e of events) {
            if (e.type === 'quota') this.say(pick(LINES[G.level === LEVELS.length - 1 ? 'boss' : 'quota']), 1);
            else if (e.type === 'hurry') this.say(pick(LINES.hurry), 0);
            else if (e.type === 'crash' && e.lives > 0) { const line = pick(LINES.crash); setTimeout(() => this.say(line, -1), 1300); }
            else if (e.type === 'full' && this.sayT <= 0) this.say(pick(LINES.full), 0, 2);
            else if (e.type === 'bank' && this.sayT <= 0 && e.n >= 2) this.say(pick(LINES.bank), 1, 1.8);
            else if (e.type === 'pickup') window.A11Y?.announce?.(PICKUPS[e.kind].name);
        }
    }

    // ------------------------------------------------------------------ the episode card
    showBrief(G) {
        const L = LEVELS[G.level];
        $('brief-num').textContent = `Episode ${G.level + 1} of ${LEVELS.length}`;
        $('brief-name').textContent = L.title;
        $('brief-text').textContent = L.brief;
        const goals = L.boss
            ? ['Bonk the Buzzkill 9000 ×6', `${L.time} seconds`]
            : [`Quota: ${L.quota} specimens`, L.order ? `Special order: ${SPECIMENS[L.order].name}` : null, `${L.time} seconds`];
        $('brief-goals').innerHTML = goals.filter(Boolean).map((g) => `<span>${esc(g)}</span>`).join('');
        paintMother($('brief-mother'), 0, 1);
        this.openScreen('brief');
        this.audio.mother(L.brief, 1);
    }

    // ------------------------------------------------------------------ the report card
    showReport(G, onPick) {
        const r = G.report, L = LEVELS[r.level];
        $('report-sub').textContent = `Episode ${r.level + 1}: ${L.title}`;
        const rows = [];
        if (L.boss) rows.push(['Buzzkill 9000', r.success ? 'Scrapped!' : 'Still rolling']);
        else {
            rows.push(['Quota', `${r.bankedN} / ${r.quota}${r.success ? ' ✔' : ' ✘'}`]);
            rows.push(['Variety', `${r.variety} kind${r.variety === 1 ? '' : 's'}`]);
            if (r.order) rows.push(['Special order', `${SPECIMENS[r.order].name} ${r.orderMet ? '✔' : '✘'}`]);
            if (r.extras) rows.push(['Extras', `+${r.extras} (${r.extraBonus} pts)`]);
        }
        rows.push(['Dents', r.hits === 0 ? 'None! ✔' : `${r.hits} hit${r.hits === 1 ? '' : 's'}`]);
        if (r.bonks) rows.push(['Bonks', r.bonks]);
        if (r.success) rows.push(['Time bonus', `${r.timeLeft} s · ${r.timeBonus} pts`]);
        rows.push(['Grade bonus', `${r.gradeBonus} pts`]);
        rows.push(['Score', G.score.toLocaleString('en-US')]);
        $('report-table').innerHTML = rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="num">${esc(b)}</td></tr>`).join('');
        const stamp = $('report-grade');
        stamp.textContent = r.grade;
        stamp.classList.toggle('good', r.grade.startsWith('A'));
        stamp.style.animation = 'none'; void stamp.offsetWidth; stamp.style.animation = '';
        const mood = r.grade === 'F' || r.grade === 'D' ? -1 : r.grade.startsWith('A') ? 1 : 0;
        $('report-line').textContent = r.line;
        paintMother($('report-mother'), 0, mood);
        const ups = $('report-ups');
        const next = $('report-next');
        if (r.success && G.offers.length) {
            ups.innerHTML = '<h3>Pick a repair from Mother\'s workshop</h3>' + G.offers.map((id) =>
                `<button class="up" data-up="${id}"><b>${esc(UPGRADES[id].name)}</b>${esc(UPGRADES[id].blurb)}${G.up[id] ? ` (have ${G.up[id]})` : ''}</button>`).join('');
            for (const b of ups.querySelectorAll('[data-up]')) b.addEventListener('click', () => onPick({ t: 'upgrade', id: b.dataset.up }));
            next.hidden = true;
        } else {
            ups.innerHTML = '';
            next.hidden = false;
            next.textContent = r.last ? 'Roll the credits' : r.success ? 'Next episode' : r.gameOver ? 'Oh no…' : 'Try again';
            next.onclick = () => onPick({ t: 'next' });
        }
        this.openScreen('report');
        setTimeout(() => this.audio.ui('stamp'), 350);
        this.audio.mother(r.line, mood);
    }

    showOver(G) {
        $('over-text').textContent = `Zib's saucer warranty has run out on episode ${G.level + 1}. Final score: ${G.score.toLocaleString('en-US')}.`;
        $('over-continue').textContent = `Continue (score halves to ${Math.floor(G.score / 2).toLocaleString('en-US')})`;
        this.openScreen('over');
    }

    showWon(G) {
        const g = G.grades;
        const best = g.filter((x) => x.startsWith('A')).length;
        $('won-text').textContent = best >= g.length - 1 ? 'My little saucer, all grown up! Straight to the fridge with every one of these.' : 'You came home in one piece. Mostly. Mother is proud of you, dents and all.';
        $('won-score').innerHTML = `Final score <b>${G.score.toLocaleString('en-US')}</b><br>Report cards: ${g.map(esc).join(' · ')}`;
        paintMother($('won-mother'), 0, 1);
        this.audio.mother('Flawless! Mother is putting this on the fridge.', 1);
        this.openScreen('won');
    }
}

export { UFO };
