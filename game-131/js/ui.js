// The DOM layer: screens, the HUD, story cards, the tunnel panel, the journal, toasts and the touch deck.
// Reads the sim; never changes it. Buttons that act in the game go through the Input (pressA, command).

import { VERSION } from './config.js';
import { GEMS, CARDS, KINDS, ITEMS, HINTS, BAUBLES } from './sim/data/story.js';
import { zone, zoneIds, findThing, tunnel } from './sim/world.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = (name) => `art/icon-${name}.webp`;

export class UI {
    constructor({ audio, input, settings, onSettings, onDeleteSave }) {
        this.audio = audio; this.input = input; this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.cardKey = ''; this.tunKey = ''; this.hudKey = '';
        this.subUntil = 0; this.placeUntil = 0;
        this.tab = 'pendant';
        $('version').textContent = 'v' + VERSION;
        for (const img of document.querySelectorAll('#sub-face, #tunnel-head img')) img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
        $('card-img').addEventListener('error', () => { $('card-img').hidden = true; });

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = { sfx: 'set-sfx', music: 'set-music', voice: 'set-voice', look: 'set-look', touch: 'set-touch' };
        for (const k in ids) $(ids[k]).value = settings[k];
        $('set-invert').checked = !!settings.invert;
        const changed = () => {
            for (const k in ids) settings[k] = k === 'touch' ? $(ids[k]).value : +$(ids[k]).value;
            settings.invert = $('set-invert').checked;
            onSettings(settings);
        };
        for (const k in ids) { $(ids[k]).addEventListener('change', changed); $(ids[k]).addEventListener('input', changed); }
        $('set-invert').addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved journey deleted.'); });

        // game buttons
        $('card-next').addEventListener('click', () => input.pressA());
        for (const b of document.querySelectorAll('#dpad [data-d]')) b.addEventListener('click', () => input.command({ t: 'go', d: b.dataset.d }));
        $('tun-feel').addEventListener('click', () => input.command({ t: 'feel' }));
        $('tun-back').addEventListener('click', () => input.command({ t: 'back' }));
        $('journal-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; audio.ui('click'); this.tab = b.dataset.tab; this.renderJournal(); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });      // a screen opened from another sits on top of it
        if (id === 'journal') this.renderJournal();
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { (this.buttons(id).find((b) => b.classList.contains('primary')) || this.buttons(id)[0])?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); if (!on) { $('card').hidden = true; $('tunnel').hidden = true; this.cardKey = this.tunKey = ''; } }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
        document.body.classList.toggle('touching', on && playing);
    }

    hud(G, now) {
        // pendant and pockets (only rebuilt when they change)
        const key = G.gems.join() + '|' + JSON.stringify(G.items) + '|' + G.zone;
        if (key !== this.hudKey) {
            this.hudKey = key;
            $('pendant').innerHTML = GEMS.map((g) => `<i class="${G.gems.includes(g.id) ? 'on' : ''}" style="color:${g.color}" title="${esc(g.name)}"></i>`).join('');
            $('hud-items').innerHTML = Object.entries(G.items).filter(([, n]) => n > 0).map(([k, n]) => `<span>${esc(ITEMS[k].name)} × ${n}</span>`).join('');
        }
        const p = G.prompt, pk = p ? p.id + p.label : '';
        if (pk !== this.promptKey) {
            this.promptKey = pk;
            $('prompt').hidden = !p;
            if (p) $('prompt-text').textContent = p.label;
            $('btn-a').classList.toggle('ready', !!p);
        }
        const dev = this.touchOn ? 'touch' : this.input.lastDevice;
        if (dev !== this.dev) { this.dev = dev; $('prompt-key').textContent = dev === 'pad' ? 'A' : dev === 'touch' ? '✋' : 'E'; $('tunnel-keys').textContent = dev === 'pad' ? 'D-pad to guide her · A to feel about · B to call her back' : 'Arrows to guide her · Space to feel about'; }
        if (this.subUntil && now > this.subUntil) { $('subtitle').hidden = true; this.subUntil = 0; }
        if (this.placeUntil && now > this.placeUntil) { $('place').classList.remove('on'); this.placeUntil = 0; }
        this.card(G);
        this.tunnel(G);
    }

    place(name, now) { const el = $('place'); el.textContent = name; el.classList.add('on'); this.placeUntil = now + 4200; }

    subtitle(who, text, now) {
        $('sub-who').textContent = who; $('sub-text').textContent = text;
        $('sub-face').style.display = who === 'Fray' ? '' : 'none';
        $('subtitle').hidden = false;
        this.subUntil = now + Math.max(3200, text.length * 62);
    }

    toast(text, iconName) {
        const el = document.createElement('div');
        el.className = 'toast';
        if (iconName) { const im = document.createElement('img'); im.src = ICON(iconName); im.alt = ''; im.onerror = () => im.remove(); el.appendChild(im); }
        el.appendChild(document.createTextNode(text));
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3100);
    }

    // ------------------------------------------------------------------ cards
    card(G) {
        const c = G.cards[0], key = c ? `${c.k}:${c.id || c.title}:${G.cards.length}:${c.text?.length || 0}` : '';
        if (key === this.cardKey) return;
        this.cardKey = key;
        const el = $('card');
        el.hidden = !c;
        if (!c) return;
        let kicker = '', title = '', text = '', img = null, voice = null;
        if (c.k === 'card') { const d = CARDS[c.id]; title = d.title; text = d.text; img = `art/card-${c.id}.webp`; voice = 'card-' + c.id; kicker = GEMS.some((g) => g.id === c.id) ? 'A gem for the spiral' : 'The story'; }
        else if (c.k === 'lore') { const t = findThing(c.id).thing; title = t.title; text = t.text; kicker = 'You read'; }
        else { title = c.title; text = c.text; kicker = ''; voice = c.who || null; }
        el.className = c.k;
        $('card-kicker').textContent = kicker; $('card-kicker').hidden = !kicker;
        $('card-head').textContent = title; $('card-text').textContent = text;
        const im = $('card-img');
        im.hidden = !img;
        if (img) im.src = img;
        $('card-box').scrollTop = 0;
        if (voice) this.audio.say(voice);
        this.onCard?.(c);
    }

    // ------------------------------------------------------------------ the tunnel panel
    tunnel(G) {
        const s = G.tun, key = s ? `${s.id}:${s.x},${s.y}:${s.seen.length}` : '';
        if (key === this.tunKey) return;
        const opening = !this.tunKey && s;
        this.tunKey = key;
        $('tunnel').hidden = !s;
        if (!s) return;
        const T = tunnel(s.id);
        if (opening) { $('tunnel-name').textContent = T.def.name; }
        const cv = $('echo'), g = cv.getContext('2d'), W = cv.width, cell = Math.floor(Math.min(W / T.w, W / T.h));
        const ox = (W - cell * T.w) / 2, oy = (W - cell * T.h) / 2;
        g.clearRect(0, 0, W, W);
        for (const k of s.seen) {
            const [x, y] = k.split(',').map(Number);
            g.fillStyle = 'rgba(150, 220, 200, 0.28)';
            g.beginPath(); g.roundRect(ox + x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, 6); g.fill();
            const ch = T.rows[y][x];
            if (ch === 'S') { g.fillStyle = 'rgba(255, 244, 208, 0.7)'; g.fillRect(ox + x * cell + cell * 0.3, oy + (y + 1) * cell - 5, cell * 0.4, 4); }
            if ((ch === 'L' || ch === 'I' || ch === 'H') && !(x === s.x && y === s.y)) { g.fillStyle = '#f0c96a'; g.beginPath(); g.arc(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, cell * 0.16, 0, 7); g.fill(); }
        }
        g.fillStyle = '#9fe08a';
        g.beginPath(); g.arc(ox + (s.x + 0.5) * cell, oy + (s.y + 0.5) * cell, cell * 0.28, 0, 7); g.fill();
        g.strokeStyle = 'rgba(159, 224, 138, 0.5)'; g.lineWidth = 2;
        g.beginPath(); g.arc(ox + (s.x + 0.5) * cell, oy + (s.y + 0.5) * cell, cell * 0.45, 0, 7); g.stroke();
    }

    // ------------------------------------------------------------------ the journal
    renderJournal() {
        const G = this.G;
        if (!G) return;
        for (const b of document.querySelectorAll('#journal-tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === this.tab);
        let html = '';
        if (this.tab === 'pendant') {
            html = GEMS.map((g) => {
                const on = G.gems.includes(g.id);
                return `<div class="gem-row ${on ? '' : 'off'}">${on ? `<img src="${ICON('gem-' + g.id)}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="dot"></span>'}<div><b>${esc(g.name)} · ${esc(g.virtue)}</b>${on ? esc(g.opens) : `Waiting in ${esc(g.place)}.`}</div></div>`;
            }).join('');
        } else if (this.tab === 'stories') {
            let read = 0, all = 0;
            for (const id of zoneIds()) {
                const lore = zone(id).things.filter((t) => t.type === 'lore');
                if (!lore.length) continue;
                const got = lore.filter((t) => G.lore.includes(t.id));
                read += got.length; all += lore.length;
                if (!G.seen[id] && !got.length) continue;
                html += `<div class="zone-head">${esc(zone(id).def.name)} · ${got.length} of ${lore.length}</div>`;
                html += lore.map((t) => (G.lore.includes(t.id) ? `<div class="story"><b>${esc(t.title)}</b><span>${esc(t.text)}</span></div>` : '<div class="story unread"><span>An inscription you have not found yet.</span></div>')).join('');
            }
            html = `<p class="dim">${read} of ${all} inscriptions read.</p>` + html;
        } else {
            html = Object.entries(KINDS).map(([k, d]) => {
                const of = k === 'bauble' ? BAUBLES.length : Object.values(G.pickups).reduce((n, list) => n + list.filter((c) => c.k === k).length, 0);
                const n = G.counts[k] || 0, done = G.keepsakes.includes(k);
                return `<div class="keep ${done ? 'done' : ''}"><img src="${ICON(k)}" alt="" onerror="this.style.visibility='hidden'"><div style="flex:1"><b>${esc(done ? d.keepsake : d.name)}</b><div class="bar"><i style="width:${(n / of) * 100}%"></i></div></div><span>${n} / ${of}</span></div>`;
            }).join('');
        }
        $('journal-body').innerHTML = html;
    }

    // ------------------------------------------------------------------ the sim's events
    onEvents(G, events, now) {
        this.G = G;
        for (const e of events) {
            if (e.type === 'pickup') this.toast(e.kind === 'bauble' ? `Fray found ${e.what} · ${e.n} / ${e.of}` : `${KINDS[e.kind].name} · ${e.n} / ${e.of}`, e.kind);
            else if (e.type === 'item') this.toast(`${ITEMS[e.item].name} · ${e.n}`, e.item);
            else if (e.type === 'keepsake') this.toast(`Keepsake: ${e.name}`, e.kind);
            else if (e.type === 'gem') this.toast(`${GEMS.find((g) => g.id === e.gem).name} · ${e.n} of 7`, 'gem-' + e.gem);
            else if (e.type === 'lore') this.toast(`Journal: ${e.n} inscription${e.n === 1 ? '' : 's'}`);
            else if (e.type === 'say') { if (G.tun) $('tunnel-say').textContent = e.text; else this.subtitle('Fray', e.text, now); }
            else if (e.type === 'tunnelIn') $('tunnel-say').textContent = '';
            else if (e.type === 'hint') this.subtitle(G.fray.state === 'follow' ? 'Fray' : 'A thought', HINTS[e.id], now);
            else if (e.type === 'travel') {
                const f = $('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 380);
                if (e.to !== e.from) this.place(zone(e.to).def.name, now);
                else this.place(e.via === 'vineFoot' ? 'The Golem Fields' : 'The Mosswood', now);
            }
        }
    }
}
