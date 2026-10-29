// The DOM layer: screens, the bench HUD and toolbar, dialogue, work orders, the case board, the shop.
// Reads the sim; never changes it (commands go back through `act`).

import { VERSION, TOOLS, UPGRADES, TIERS, TUNE, FAST } from './config.js';
import { KINDS } from './sim/kinds.js';
import { CLUES, DAYS, SPEAKERS } from './sim/story.js';
import { MODS } from './sim/modules.js';
import { drawPortrait } from './view/portraits.js';

const $ = (id) => document.getElementById(id);

const ICONS = {
    hand: 'M7 12V6a1.5 1.5 0 0 1 3 0v5M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1.3-5.2-3.2L3.5 14a1.4 1.4 0 0 1 2.2-1.7L7 14',
    driver: 'M3.5 20.5L10 14M12 12l7-7 2 2-7 7zM10 14l2-2',
    ratchet: 'M8.5 8.5m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M11.5 11.5L20 20M17.5 20.5h3.5v-3.5',
    pry: 'M4 20L14 10M14 10l2.5-2.5 3.5-1-1 3.5L16.5 13M12 12l3 3',
    tweezers: 'M6 21L10.5 4M18 21L13.5 4M10.5 4h3',
    solder: 'M4 20l6-6M10 14l4-4 5-5M17 3l4 4M15.5 17l1.5 1.5M19 15l1 1',
    brush: 'M4 20c0-3 2-4 4-4l8.5-8.5 3 3L11 19c-1.5 1-3 1-7 1zM14.5 9.5l3 3',
    oil: 'M5 12h10v8H5zM15 14h3l3-5M9 12V9h4l2-3M3 4l1.5 2M6 3v2.5',
    probe: 'M4 5h16v14H4zM12 16V9M12 16l4-3M8 8.5h.01M16 8.5h.01',
};
const ACTION_SVG = {};

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, act }) {
        this.audio = audio;
        this.settings = settings;
        this.act = act;
        this.stack = [];                   // open overlay screens, top last
        this.phase = null;
        this.hoverText = '';
        this.dl = null; this.dlKey = '';
        this.portraitT = 0;
        this.tipQ = []; this.tipT = 0;
        this.sig = '';
        this.touchOn = false;
        this.zStack = 50;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }
        for (const b of document.querySelectorAll('[data-close-drawer]')) b.addEventListener('click', () => this.closeSpares());

        // settings
        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), quality = $('set-quality'), manual = $('set-manual'), calm = $('set-calm'), guide = $('set-guide');
        guide.value = settings.guide;
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; quality.value = settings.quality; manual.checked = !!settings.manual; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, quality: quality.value, guide: guide.value, manual: manual.checked, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, quality, manual, calm, guide]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        this.buildTools();
        this.buildFreeBench();
        $('btn-spares').addEventListener('click', () => (this.spares ? this.closeSpares() : this.openSpares()));
    }

    // ------------------------------------------------------------------ overlay screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        el.style.zIndex = String(++this.zStack);
        this.stack = this.stack.filter((s) => s !== id).concat(id);
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
    /** Is a phase screen (title, work order, result...) up, so that keys go to it? */
    phaseScreen() { return ['title', 'brief', 'result', 'endday', 'credits', 'freeover'].includes(this.phase) ? this.phase : null; }

    buttons(root) { return [...root.querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.closest('[hidden]') === null); }
    focusFirst(id) { this.buttons($(id))[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir, rootId = null) {
        const id = rootId || this.top() || this.phaseScreen();
        if (!id) return;
        const list = this.buttons($(id));
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ toasts and tips
    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2900);
    }
    tip(text) { this.tipQ.push(text); }
    setHover(text) { this.hoverText = text || ''; }

    // ------------------------------------------------------------------ tools
    buildTools() {
        const bar = $('tools');
        bar.innerHTML = '';
        for (const t of TOOLS) {
            const b = document.createElement('button');
            b.className = 'tool'; b.dataset.tool = t.id; b.title = `${t.name}: ${t.blurb}`; b.setAttribute('aria-label', t.name);
            b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${ICONS[t.id]}"/></svg><span class="key">${t.key}</span><span class="bit"></span>`;
            // select on finger-down: a click waits for the lift and feels late
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.act({ t: 'tool', tool: t.id }); });
            b.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.act({ t: 'tool', tool: t.id }); });
            bar.appendChild(b);
        }
    }

    buildFreeBench() {
        const kinds = Object.keys(KINDS);
        const sel = $('fb-kind'), tier = $('fb-tier');
        sel.innerHTML = kinds.map((k) => `<option value="${k}">${KINDS[k].name}</option>`).join('');
        const fill = () => {
            const k = KINDS[sel.value];
            const cur = +tier.value || 2;
            tier.innerHTML = [1, 2, 3, 4, 5].filter((n) => (sel.value === 'spanner' ? n === 5 : n >= Math.min(k.minTier, 3))).map((n) => `<option value="${n}">${n} · ${TIERS[n].name}</option>`).join('');
            tier.value = [...tier.options].some((o) => +o.value === cur) ? cur : tier.options[0].value;
        };
        sel.addEventListener('change', fill);
        sel.value = 'blaster'; fill(); tier.value = '3';
        $('fb-dice').addEventListener('click', () => { $('fb-seed').value = 1 + Math.floor(Math.random() * 99999); });
    }
    freeBenchChoice() { return { kind: $('fb-kind').value, tier: +$('fb-tier').value, seed: Math.max(1, Math.min(999999, Math.floor(+$('fb-seed').value || 1))) }; }

    setTouch(on) {
        this.touchOn = on;
        document.body.classList.toggle('touch', on);
    }

    // ------------------------------------------------------------------ phases
    enterPhase(G) {
        const prev = this.phase;
        this.phase = G.phase;
        for (const id of ['title', 'shop', 'hud', 'dialogue', 'brief', 'result', 'endday', 'credits', 'freeover']) $(id).hidden = true;
        this.closeSpares();
        document.body.classList.toggle('bench', G.phase === 'bench');
        const show = (id) => { $(id).hidden = false; $(id).style.zIndex = id === 'dialogue' ? 40 : id === 'shop' || id === 'hud' ? 10 : 50; };
        switch (G.phase) {
            case 'title': show('title'); this.focusFirst('title'); break;
            case 'dialogue': show('dialogue'); this.dlKey = ''; break;
            case 'shop': show('shop'); this.syncShop(G); break;
            case 'brief': show('brief'); this.fillBrief(G); this.focusFirst('brief'); break;
            case 'bench': show('hud'); this.sig = ''; this.syncHud(G, true); break;
            case 'result': show('result'); this.fillResult(G); this.focusFirst('result'); break;
            case 'endday': show('endday'); this.fillEndDay(G); this.focusFirst('endday'); break;
            case 'credits': show('credits'); this.fillCredits(G); this.focusFirst('credits'); break;
            case 'freeover': show('freeover'); this.fillFreeOver(G); this.focusFirst('freeover'); break;
            default: break;
        }
        void prev;
    }

    sync(G, dt, t) {
        if (G.phase !== this.phase) this.enterPhase(G);
        if (G.phase === 'dialogue') this.syncDialogue(G, dt, t);
        else if (G.phase === 'bench') this.syncHud(G);
        else if (G.phase === 'shop') this.syncShop(G);
        // tips queue one at a time
        if (this.tipT > 0) { this.tipT -= dt; if (this.tipT <= 0) $('tip').hidden = true; }
        else if (this.tipQ.length) { const text = this.tipQ.shift(); $('tip-text').textContent = text; $('tip').hidden = false; this.tipT = 6.5; }
    }

    // ------------------------------------------------------------------ the shop between customers
    syncShop(G) {
        const s = G.story;
        const day = DAYS[s.day - 1];
        $('shop-day').textContent = `Day ${s.day} · ${day ? day.title : ''}`;
        $('shop-credits').textContent = `${s.credits} cr`;
        const more = s.idx < s.queue.length;
        const call = $('btn-call');
        call.textContent = more ? (s.idx === 0 ? 'Ring the bell' : 'Next customer') : 'Close up for the night';
        call.dataset.mode = more ? 'call' : 'close';
        $('btn-board').textContent = `Case board (${s.clues.length}/${Object.keys(CLUES).length})`;
    }

    // ------------------------------------------------------------------ dialogue
    syncDialogue(G, dt, t) {
        const d = G.dlg;
        if (!d) return;
        const key = `${d.id}:${d.i}:${d.lines.length}`;
        const line = d.lines[d.i];
        if (key !== this.dlKey) {
            this.dlKey = key;
            const sp = SPEAKERS[line.w] || SPEAKERS.walk;
            const narr = sp.style === 'narr', you = sp.style === 'you';
            this.dl = { text: line.t, n: 0, acc: 0, voice: sp.voice || 330, look: line.look || sp.look || 'walk', name: line.name || sp.name, narr, you, ask: line.ask || null, done: false };
            $('d-name').textContent = narr ? '' : this.dl.name;
            $('d-text').className = narr ? 'narr' : you ? 'you' : '';
            $('d-text').textContent = '';
            $('dialogue').classList.toggle('nop', narr || you);
            $('d-opts').innerHTML = '';
            $('d-next').hidden = true;
        }
        const dl = this.dl;
        if (!dl) return;
        if (!dl.done) {
            dl.acc += dt * 70;
            const before = dl.n;
            while (dl.acc >= 1 && dl.n < dl.text.length) { dl.acc -= 1; dl.n++; }
            if (dl.n !== before) {
                $('d-text').textContent = dl.text.slice(0, dl.n);
                if (!dl.narr && dl.n % 3 === 0) this.audio.blip(dl.voice, dl.n);
            }
            if (dl.n >= dl.text.length) this.finishTyping();
        }
        this.portraitT += dt;
        if (!dl.narr && !dl.you && this.portraitT > 0.06) {
            this.portraitT = 0;
            drawPortrait($('portrait'), dl.look, { t, talking: !dl.done, name: dl.name });
        }
    }

    finishTyping() {
        const dl = this.dl;
        dl.done = true; dl.n = dl.text.length;
        $('d-text').textContent = dl.text;
        if (dl.ask) {
            const box = $('d-opts');
            box.innerHTML = '';
            dl.ask.forEach((a, i) => {
                const b = document.createElement('button');
                b.className = 'btn'; b.textContent = a.t; b.dataset.i = i;
                b.addEventListener('click', (e) => { e.stopPropagation(); this.audio.ui('click'); this.act({ t: 'choose', i }); });
                box.appendChild(b);
            });
            box.querySelector('button')?.focus({ preventScroll: true });
        } else $('d-next').hidden = false;
    }

    /** Space, Enter or a click: finish the line, or move on. */
    advanceDialogue(G) {
        const dl = this.dl;
        if (!dl || G.phase !== 'dialogue') return;
        if (!dl.done) { this.finishTyping(); return; }
        if (dl.ask) return;
        this.act({ t: 'next' });
    }

    // ------------------------------------------------------------------ work order, result, end of day
    fillBrief(G) {
        const { spec, dev } = G.pending;
        const K = KINDS[spec.kind];
        const who = spec.walkin ? spec.walkin.name : (SPEAKERS[spec.who] || {}).name || '';
        const base = Math.round(TUNE.pay[spec.tier] * (spec.pay || 1));
        $('brief-title').textContent = K.name;
        const rows = [
            ['Customer', who], ['Difficulty', `${spec.tier} · ${TIERS[spec.tier].name}`], ['Fee', `${base} cr (3 stars: ${Math.round(base * TUNE.starMul[3])})`],
        ];
        let html = rows.map(([a, b]) => `<div class="kv"><span>${a}</span><b>${esc(b)}</b></div>`).join('');
        html += `<p>"${esc(dev.complaint || 'It just stopped.')}"</p>`;
        if (dev.extras.length) html += `<div class="kv"><span>Extra</span><b>${esc(dev.extras[0].text)}</b></div>`;
        html += `<p class="dim small">Spare parts are charged against the fee. A tidy bench earns a second star; the extras and no burns, a third.</p>`;
        $('brief-body').innerHTML = html;
    }

    fillResult(G) {
        const J = G.job, R = J.result;
        $('result-stars').innerHTML = [1, 2, 3].map((n) => (n <= R.stars ? '<b>★</b>' : '★')).join('');
        const found = J.dev.stash.filter((s) => s.taken).length;
        let html = `<div class="kv ok"><span>It works</span><b>✔</b></div>`;
        html += `<div class="kv ${R.tidy ? 'ok' : 'no'}"><span>Tidy bench</span><b>${R.tidy ? '✔' : `${R.loose} loose`}</b></div>`;
        if (J.extras.length) html += `<div class="kv ${R.extrasOk ? 'ok' : 'no'}"><span>${esc(J.extras[0].text)}</span><b>${R.extrasOk ? '✔' : '—'}</b></div>`;
        html += `<div class="kv ${R.burns ? 'no' : 'ok'}"><span>Burns / failed tests</span><b>${R.burns} / ${R.fails}</b></div>`;
        html += `<div class="kv"><span>Fee (${R.stars}★)</span><b>${R.gross} cr</b></div>`;
        html += `<div class="kv"><span>Spare parts</span><b>−${R.spent} cr</b></div>`;
        const tip = R.stars === 3 ? 10 : 0, bonus = found * 10;
        if (tip) html += `<div class="kv ok"><span>Tip</span><b>+${tip} cr</b></div>`;
        if (bonus) html += `<div class="kv ok"><span>Things you found</span><b>+${bonus} cr</b></div>`;
        if (R.govPulled) html += `<div class="kv"><span>Governor chip</span><b>pulled</b></div>`;
        html += `<div class="kv total"><span>Total</span><b>${R.net + tip + bonus} cr</b></div>`;
        $('result-body').innerHTML = html;
    }

    fillFreeOver(G) {
        const R = G.last;
        $('freeover-stars').innerHTML = [1, 2, 3].map((n) => (n <= (R ? R.stars : 0) ? '<b>★</b>' : '★')).join('');
        $('freeover-body').innerHTML = `<div class="kv"><span>Marks</span><b>${R ? R.stars : 0} of 3</b></div><div class="kv"><span>Practice fee</span><b>${R ? R.total : 0} cr</b></div>`;
    }

    fillEndDay(G) {
        const s = G.story;
        const day = DAYS[s.day - 1];
        $('endday-title').textContent = `Day ${s.day} · ${day.title}`;
        const t = s.today || { jobs: 0, earned: 0, stars: 0 };
        $('endday-body').textContent = `${t.jobs} job${t.jobs === 1 ? '' : 's'} done, ${t.stars} star${t.stars === 1 ? '' : 's'}, ${t.earned} credits earned. You have ${s.credits} cr.`;
        this.renderUpgrades($('endday-upgrades'), G);
        $('btn-nextday').textContent = s.day >= 6 ? 'Sleep' : 'Sleep. Open tomorrow';
    }

    renderUpgrades(box, G) {
        const s = G.story;
        box.innerHTML = '';
        for (const u of UPGRADES) {
            const own = !!s.upgrades[u.id];
            const el = document.createElement('div');
            el.className = 'up' + (own ? ' owned' : '');
            el.innerHTML = `<b>${esc(u.name)}</b><span>${esc(u.desc)}</span>`;
            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = own ? 'Owned' : `${u.cost} cr`; btn.disabled = own || s.credits < u.cost; btn.dataset.up = u.id;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.act({ t: 'buy', id: u.id }); });
            el.appendChild(btn);
            box.appendChild(el);
        }
    }

    openUpgrades(G) {
        $('upgrades-credits').textContent = `You have ${G.story.credits} cr.`;
        this.renderUpgrades($('upgrades-list'), G);
        this.openScreen('upgrades');
    }

    refreshUpgrades(G) {
        if (!$('upgrades').hidden) { $('upgrades-credits').textContent = `You have ${G.story.credits} cr.`; this.renderUpgrades($('upgrades-list'), G); }
        if (G.phase === 'endday') this.fillEndDay(G);
        if (G.phase === 'shop') this.syncShop(G);
    }

    openBoard(G) {
        const list = $('board-list');
        const s = G.story;
        const ids = Object.keys(CLUES);
        $('board-count').textContent = s ? `${s.clues.length} of ${ids.length} clues` : '';
        list.innerHTML = '';
        ids.forEach((id, i) => {
            const c = CLUES[id];
            const known = s && s.clues.includes(id);
            const el = document.createElement('div');
            el.className = 'clue' + (known ? '' : ' unknown');
            el.style.setProperty('--r', `${((i * 37) % 7 - 3) * 0.5}deg`);
            el.innerHTML = known ? `<h4>${esc(c.title)}</h4><p>${esc(c.text)}</p>` : `<h4>???</h4><p>Day ${c.day}. Keep looking.</p>`;
            list.appendChild(el);
        });
        this.openScreen('board');
    }

    fillCredits(G) {
        const s = G.story;
        const f = s.flags;
        const end = f.end_broadcast ? 'broadcast' : f.end_surrender ? 'surrender' : 'quiet';
        const titles = { broadcast: 'The Unhush', quiet: 'One Leash at a Time', surrender: 'Compliance' };
        const bodies = {
            broadcast: 'The Key sang, every governor on Perihelion Reach dissolved, and a salvage barge pulled up to Berth Nine with its lamp lit. FIX ANYTHING, and then some.',
            quiet: 'You hid the Key where nobody would sell it and kept fixing, a few leashes a week. Teo came home by the back door. The lamp stayed on.',
            surrender: 'You handed the Key over. The rain did not stop, and the Lantern was gone by morning. You kept the shop and the lamp, and nobody ever asked after a man in a long coat again.',
        };
        $('credits-title').textContent = titles[end];
        $('credits-body').textContent = bodies[end];
        $('credits-stats').innerHTML = `${s.jobs} jobs · ${s.stars} stars · ${s.freed} governors pulled · ${s.clues.length}/${Object.keys(CLUES).length} clues · ${s.credits} cr`;
    }

    // ------------------------------------------------------------------ spares drawer
    openSpares() {
        const G = this.G;
        if (!G || !G.job) return;
        const J = G.job;
        const list = $('spares-list');
        list.innerHTML = '';
        const disc = G.story && G.story.upgrades && G.story.upgrades.account;
        for (const sp of J.dev.spares) {
            const b = document.createElement('button');
            b.className = 'spare'; b.dataset.spec = sp.spec;
            const price = disc ? Math.ceil(sp.price / 2) : sp.price;
            b.innerHTML = `<em>${price} cr</em><b>${esc(sp.spec)}</b><span>${esc(MODS[sp.mod].name)}</span>`;
            b.addEventListener('click', () => { this.audio.ui('click'); this.act({ t: 'spare', spec: sp.spec }); this.closeSpares(); });
            list.appendChild(b);
        }
        $('spares').hidden = false;
        this.spares = true;
    }
    closeSpares() { $('spares').hidden = true; this.spares = false; }

    // ------------------------------------------------------------------ the guide line
    /** Show the next step (or hide the line). `spare` makes the Spares button glow. */
    setGuide(goal, on) {
        const el = $('guide');
        el.hidden = !(on && goal);
        if (on && goal) { const t = $('guide-text'); if (t.textContent !== goal.text) t.textContent = goal.text; }
        $('btn-spares').classList.toggle('guide', !!(on && goal && goal.k === 'spare'));
    }

    // ------------------------------------------------------------------ the bench HUD
    syncHud(G, force = false) {
        this.G = G;
        const J = G.job;
        if (!J) return;
        $('hud-job').innerHTML = `${esc(J.name)}<small>${esc(customerName(G, J))}</small>`;
        $('hud-credits').textContent = G.story ? `${G.story.credits} cr` : '';
        $('dish-n').textContent = Object.values(J.dish).reduce((a, b) => a + b, 0);
        for (const b of $('tools').children) {
            const id = b.dataset.tool;
            b.classList.toggle('sel', id === G.tool);
            const bit = b.querySelector('.bit');
            bit.textContent = id === 'driver' ? (G.bit === 'phil' ? 'Ph' : 'Fl') : id === 'ratchet' ? String(G.socket) : '';
        }
        $('btn-rev').classList.toggle('on', J.reverse);
        $('btn-test').disabled = !!J.test;
        // the work order
        const sig = [J.id, J.hint, J.notes.length, J.extras.map((e) => e.done).join(), J.stats.fails].join('|');
        if (sig !== this.sig || force) {
            this.sig = sig;
            let h = `<p>${esc(J.dev.complaint || 'It just stopped working.')}</p>`;
            h += `<h4>Customer</h4><p>${esc(customerName(G, J))}</p>`;
            if (J.extras.length) h += `<h4>Extra</h4><ul>${J.extras.map((e) => `<li class="${e.done ? 'ok' : ''}">${e.done ? '✔' : '·'} ${esc(e.text)}</li>`).join('')}</ul>`;
            if (J.notes.length) h += `<h4>Meter readings</h4><ul>${J.notes.slice(-8).map((n) => `<li class="${n.bad ? 'bad' : 'ok'}">${n.bad ? '✖' : '✔'} ${esc(n.text)}</li>`).join('')}</ul>`;
            if (J.hint) h += `<h4>Spanner says</h4><p>${esc(J.hint)}</p>`;
            $('task-body').innerHTML = h;
        }
        // status line: what just happened beats what you are pointing at
        const st = $('status');
        let text = '', say = false;
        if (J.say) { text = J.say; say = true; }
        else if (this.hoverText) text = this.hoverText;
        else text = '';
        if (st.textContent !== text) st.textContent = text;
        st.classList.toggle('say', say);
        // the test banner
        const tb = $('test-banner');
        if (J.test) {
            tb.hidden = false; tb.className = '';
            tb.textContent = J.test.t > 1.2 && !J.test.ok ? J.test.msg : 'Power test';
            if (J.test.t > 1.2 && !J.test.ok) tb.classList.add('bad');
            else if (J.test.ok && J.test.t > 2.4) { tb.textContent = 'All systems nominal'; tb.classList.add('ok'); }
        } else if (J.stage === 'work' && J.stats.fails && J.say && J.sayT > 3.5) { tb.hidden = false; tb.className = 'bad'; tb.textContent = J.say; }
        else tb.hidden = true;
    }

    // ------------------------------------------------------------------ events
    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'clue') { this.toast(`New clue: ${CLUES[e.id].title}`, 'clue-toast'); }
            else if (e.type === 'tip') this.tip(e.text);
            else if (e.type === 'stash') this.toast(`Found: ${e.label}`, 'clue-toast');
            else if (e.type === 'buy') { this.refreshUpgrades(G); }
            else if (e.type === 'credits') this.toast(`${e.n > 0 ? '+' : ''}${e.n} cr`);
            else if (e.type === 'gov_pulled') this.toast('Governor chip pulled.');
            else if (e.type === 'extra') this.toast('Extra done: spotless.');
            else if (e.type === 'paid') this.toast(`+${e.total} cr`);
        }
        if (events.some((e) => e.type === 'buy')) this.audio.ui('buy');
    }
}

function customerName(G, J) {
    const sp = J.spec;
    if (!sp) return '';
    if (sp.walkin) return sp.walkin.name;
    return (SPEAKERS[sp.who] || {}).name || '';
}

export function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
void FAST; void ACTION_SVG;
