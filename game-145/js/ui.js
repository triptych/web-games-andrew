// The DOM layer: screens, the HUD (compass, use prompt, where you are), the diary reader, the journal, the map,
// toasts, settings and the touch deck. Reads the sim; never changes it.

import { VERSION, ITEMS, TILE, LOCKS, DIARIES } from './config.js';
import { citizen, objective, reachable, progress } from './sim/game.js';
import { lockKind, tileAt } from './sim/world.js';
import { G_ROAD, G_WALK, G_GRASS, G_LOT, G_DIRT, G_PLAZA } from './sim/city.js';

const $ = (id) => document.getElementById(id);
const LEVER_CSS = { amber: '#e0961c', violet: '#9b4fd8', green: '#4fbf5e', white: '#e8e6dc' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.tab = 'diaries';
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { audio.ui('click'); this.tab = t.dataset.tab; this.renderJournal(this.G); });

        const sfx = $('set-sfx'), music = $('set-music'), sens = $('set-sens'), inv = $('set-invert'), q = $('set-quality'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; sens.value = settings.sens; inv.checked = settings.invert; q.value = settings.quality; touch.value = settings.touch;
        const changed = () => {
            const oldQ = settings.quality;
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, sens: +sens.value, invert: inv.checked, quality: q.value, touch: touch.value });
            if (settings.quality !== oldQ) $('quality-note').hidden = false;
            onSettings(settings);
        };
        for (const el of [sfx, music, sens, inv, q, touch]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved journey deleted.'); });
        this.compass = $('compass').getContext('2d');
        this.needle = 0;
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
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
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) { this.touchOn = on; $('touch').hidden = !(on && playing); }
    setLockHint(on) { $('lock-hint').hidden = !on; }

    hud(G, dt) {
        this.G = G;
        // the use prompt
        const r = reachable(G)[0];
        const pr = $('prompt');
        if (r) { pr.hidden = false; $('prompt-text').textContent = promptFor(G, r); $('prompt-key').textContent = this.touchOn ? 'USE' : 'E'; }
        else pr.hidden = true;
        // where you are
        const p = G.p;
        const t = tileAt(G.city, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE));
        const where = t?.b ? `${t.b.name ?? niceType(t.b.type)}${t.b.floors > 1 ? ` · ${floorName(p.L)}` : ''}` : 'Ashmere';
        if (where !== this.lastWhere) { this.lastWhere = where; $('hud-where').textContent = where; }
        this.drawCompass(G, dt);
    }

    drawCompass(G, dt) {
        const o = objective(G), p = G.p;
        const g = this.compass, S = 128, c = S / 2;
        const bearing = Math.atan2(o.x - p.x, -(o.z - p.z));
        let want = bearing - p.yaw;
        const dist = Math.hypot(o.x - p.x, o.z - p.z);
        // close by on the same floor the needle trembles
        if (dist < 6) want += Math.sin(performance.now() / 90) * 0.25;
        let d = want - this.needle;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        this.needle += d * Math.min(1, dt * 5);
        g.clearRect(0, 0, S, S);
        // the brass case
        const rg = g.createRadialGradient(c - 12, c - 14, 6, c, c, c);
        rg.addColorStop(0, '#e9cf86'); rg.addColorStop(0.55, '#a5813c'); rg.addColorStop(1, '#4a3618');
        g.fillStyle = rg; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e8e0c8'; g.beginPath(); g.arc(c, c, c - 12, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(60,45,20,0.6)'; g.lineWidth = 1;
        for (let i = 0; i < 32; i++) {
            const a = (i / 32) * Math.PI * 2 - this.needle * 0, l = i % 8 === 0 ? 9 : i % 2 ? 3 : 5;
            g.beginPath(); g.moveTo(c + Math.sin(a) * (c - 13), c - Math.cos(a) * (c - 13)); g.lineTo(c + Math.sin(a) * (c - 13 - l), c - Math.cos(a) * (c - 13 - l)); g.stroke();
        }
        // the needle
        g.save(); g.translate(c, c); g.rotate(this.needle);
        g.fillStyle = '#a2271c'; g.beginPath(); g.moveTo(0, -c + 18); g.lineTo(7, 0); g.lineTo(-7, 0); g.fill();
        g.fillStyle = '#2b2a26'; g.beginPath(); g.moveTo(0, c - 22); g.lineTo(6, 0); g.lineTo(-6, 0); g.fill();
        g.restore();
        g.fillStyle = '#6b5124'; g.beginPath(); g.arc(c, c, 5, 0, Math.PI * 2); g.fill();
        // glass glint
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(c - 16, c - 22, 22, 10, -0.6, 0, Math.PI * 2); g.fill();
        // the label: what it points at, and how many floors up or down
        const ob = G.city.buildings[o.b];
        const dy = o.b >= 0 && ob ? o.L - (tileAt(G.city, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE))?.b === ob ? p.L : 0) : -p.L;
        const lvl = o.b >= 0 && ob && tileAt(G.city, p.L, Math.floor(p.x / TILE), Math.floor(p.z / TILE))?.b === ob ? (o.L > p.L ? ` ▲${o.L - p.L}` : o.L < p.L ? ` ▼${p.L - o.L}` : '') : (o.L > 0 ? ` ▲${o.L}` : '');
        void dy;
        const label = `${o.label}${lvl}`;
        if (label !== this.lastLabel) { this.lastLabel = label; $('compass-label').textContent = label; }
    }

    toast(text, big = false) {
        const el = document.createElement('div');
        el.className = 'toast' + (big ? ' big' : '');
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 6200);
    }

    onEvents(G, events) {
        this.G = G;
        for (const e of events) {
            if (e.type === 'msg' || e.type === 'locked' || e.type === 'unlock' || e.type === 'vend' || e.type === 'fail' || e.type === 'leverReset' || e.type === 'power') this.toast(e.text, e.type === 'power');
            else if (e.type === 'fragment' || e.type === 'radio') this.toast(e.type === 'radio' ? `Through the static: "${e.text}"` : e.text);
            else if (e.type === 'item') this.toast(`${ITEMS[e.item].icon} ${e.name}. ${e.text}`, true);
            else if (e.type === 'enter' && e.name) this.toast(e.name);
            else if (e.type === 'fall') this.toast('The floor gives way.');
            else if (e.type === 'dial') this.toast(`Dial ${e.i + 1}: ${e.v}`);
            else if (e.type === 'lever') this.toast(`The ${e.color} conduit hums. (${e.n} of 4)`);
            else if (e.type === 'portal') this.toast('The ring opens. Somewhere very far down a long yellow corridor, a door swings wide.', true);
        }
    }

    // ------------------------------------------------------------------ the diary reader
    showDiary(G, k) {
        const d = G.story.diaries[k];
        const c = citizen(d.who);
        $('reader-photo').src = `art/p-${c.id}.webp`;
        $('reader-photo').alt = c.name;
        $('reader-name').textContent = c.name;
        $('reader-role').textContent = c.role;
        $('reader-count').textContent = `Diary ${G.read.length} of ${DIARIES}`;
        $('reader-text').innerHTML = c.text.map((p) => `<p>${esc(p)}</p>`).join('');
        const clue = G.story.clues[k];
        $('reader-clue').hidden = !clue;
        if (clue) $('reader-clue').textContent = clue.text;
        this.openScreen('reader');
        $('reader').querySelector('.sheet').scrollTop = 0;
    }

    // ------------------------------------------------------------------ the journal
    renderJournal(G) {
        if (!G) return;
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.tab === this.tab);
        const body = $('journal-body');
        const S = G.story;
        if (this.tab === 'diaries') {
            const rows = S.diaries.map((d) => {
                const c = citizen(d.who), got = G.gotSet.has(`diary${d.k}`);
                return got ? `<button class="btn jitem" data-k="${d.k}"><img src="art/p-${c.id}.webp" alt=""><span><span class="who">${esc(c.name)}</span><br><span class="role">${esc(c.role)}</span></span></button>`
                    : `<div class="btn jitem missing"><span><span class="who">? ? ?</span><br><span class="role">A diary not yet found</span></span></div>`;
            });
            body.innerHTML = `<p class="stats">${G.read.length} of ${DIARIES} diaries found. Read in order, they tell what happened.</p><div class="jlist">${rows.join('')}</div>`;
            for (const b of body.querySelectorAll('[data-k]')) b.addEventListener('click', () => { this.audio.ui('open'); this.showDiary(G, +b.dataset.k); });
        } else if (this.tab === 'clues') {
            const dials = [null, null, null], order = [null, null, null, null], lines = [];
            for (const k of G.read) { const c = S.clues[k]; if (!c) continue; lines.push(c.text); if (c.kind === 'dial') dials[c.i] = c.v; else order[c.i] = c.color; }
            body.innerHTML = `<div class="code"><span>Resonance dials</span><span>${dials.map((v) => v ?? '?').join(' · ')}</span><span>Conduit order</span><span>${order.map((c) => (c ? `<span class="swatch" style="background:${LEVER_CSS[c]}"></span>${c}` : '?')).join(' → ')}</span></div>`
                + (lines.length ? lines.map((l) => `<div class="clue">${esc(l)}</div>`).join('') : '<p class="stats">Nothing yet. The diaries hold pieces of something.</p>');
        } else if (this.tab === 'things') {
            body.innerHTML = '<div class="jlist">' + G.items.map((i) => `<div class="clue">${ITEMS[i].icon} <b>${esc(ITEMS[i].name)}</b> — ${esc(ITEMS[i].text)}</div>`).join('') + '</div>';
        } else {
            const P = progress(G);
            const notes = G.got.filter((id) => /^(f\d|nb|ph|r\d)/.test(id)).length;
            body.innerHTML = `<div class="stats">City seed <b>${G.seed}</b><br>Places entered: ${P.buildings} of ${P.total}<br>Notes, papers and broadcasts: ${notes}<br>Cans from machines that should not work: ${P.cans}<br>Walked: ${P.km.toFixed(2)} km · ${Math.floor(G.t / 60)} min<br>Floors fallen through: ${G.falls}</div>`;
        }
        body.parentElement.scrollTop = 0;
    }

    // ------------------------------------------------------------------ the map
    renderMap(G) {
        const cv = $('map-canvas'), g = cv.getContext('2d');
        const C = G.city, N = C.n, s = cv.width / N;
        if (!this.mapBase || this.mapSeed !== G.seed) {
            const base = document.createElement('canvas'); base.width = base.height = cv.width;
            const b = base.getContext('2d');
            const col = { [G_ROAD]: '#2a2b2a', [G_WALK]: '#3a3a36', [G_GRASS]: '#2d3424', [G_LOT]: '#33322e', [G_DIRT]: '#3a3226', [G_PLAZA]: '#3c3b36' };
            b.fillStyle = '#121312'; b.fillRect(0, 0, cv.width, cv.width);
            for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const t = C.ground[z * N + x]; if (col[t]) { b.fillStyle = col[t]; b.fillRect(x * s, z * s, s + 0.5, s + 0.5); } }
            this.mapBase = base; this.mapSeed = G.seed;
        }
        g.drawImage(this.mapBase, 0, 0);
        for (const b of C.buildings) {
            const seen = G.visitedSet.has(b.id);
            g.fillStyle = seen ? '#7d8b62' : '#4a4944';
            g.fillRect(b.x0 * s, b.z0 * s, b.w * s, b.d * s);
            g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeRect(b.x0 * s, b.z0 * s, b.w * s, b.d * s);
        }
        const lab = C.lab;
        if (G.read.length >= DIARIES || G.items.includes('labcard')) { g.strokeStyle = '#e64a57'; g.lineWidth = 2; g.strokeRect(lab.x0 * s, lab.z0 * s, lab.size * s, lab.size * s); g.lineWidth = 1; }
        const o = objective(G);
        g.strokeStyle = '#e64a57'; g.lineWidth = 2;
        g.beginPath(); g.arc(o.x / TILE * s, o.z / TILE * s, 7, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(o.x / TILE * s, o.z / TILE * s, 2, 0, Math.PI * 2); g.stroke();
        const p = G.p;
        g.save(); g.translate(p.x / TILE * s, p.z / TILE * s); g.rotate(p.yaw);
        g.fillStyle = '#f3e3a2'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.fill();
        g.restore();
    }

    showEnding(G) {
        document.getElementById('toasts').replaceChildren();
        const P = progress(G);
        $('over-text').textContent = 'The ring opens all the way, and they come back through it: in pyjamas and uniforms and coats, blinking, holding on to each other. Mrs. Lund. The Kovacs. Mr. Grey, checking his watch, which is running forwards. Somebody laughs. Somebody asks what day it is.\n\nIt is morning in Ashmere. The VACANCY sign has finally gone out.';
        $('over-stats').innerHTML = `<span class="stats">Seed ${G.seed} · ${Math.floor(G.t / 60)} minutes · ${P.km.toFixed(1)} km walked · ${P.buildings} of ${P.total} places entered · ${P.cans} cans</span>`;
        this.openScreen('over');
    }
}

function niceType(t) { return { house: 'A house', apartment: 'Apartments', office: 'Offices', hotel: 'Hotel', mall: 'The mall', hospital: 'Hospital', school: 'School', library: 'Library', shop: 'A shop', factory: 'Factory', warehouse: 'Warehouse', garage: 'Car park', lab: 'Threshold Laboratory', hall: 'Hall C' }[t] ?? t; }
function floorName(L) { return L === 0 ? 'ground floor' : `floor ${L}`; }

function promptFor(G, r) {
    switch (r.kind) {
        case 'diary': return `Read ${citizen(r.who).name}'s diary`;
        case 'item': return `Take the ${ITEMS[r.item].name.toLowerCase()}`;
        case 'fragment': return 'Read the note';
        case 'newsbox': return 'Read the newspaper';
        case 'phone': return 'Lift the receiver';
        case 'radio': return 'Listen to the radio';
        case 'vending': return 'Buy a can';
        case 'door': {
            const k = lockKind(G.city, r.lock), L = LOCKS[k];
            const have = G.items.includes(L.item);
            return have ? `Open (${ITEMS[L.item].name.toLowerCase()})` : `${r.lock === 'gate' ? 'Gate' : 'Door'}: ${L.name}`;
        }
        case 'breaker': return G.power ? 'Main breaker (on)' : 'Main breaker';
        case 'dial': return `Turn dial ${r.i + 1} (${G.dials[r.i] || '–'})`;
        case 'lever': return `Throw the ${G.story.leverColors[r.i]} conduit`;
        case 'master': return 'Master switch';
        default: return 'Use';
    }
}
