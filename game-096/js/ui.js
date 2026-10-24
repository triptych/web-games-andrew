// The DOM layer: title, map, workshop, HUD, dialogue, results. Reads the sim and the progress; never changes the sim.

import { VERSION } from './config.js';
import { SHELLS, PARTS, INVENTIONS, WORLDS, LEVELS, LEVELS_IN, CAST, MAX_EQUIPPED, levelMeta } from './sim/data.js';
import { isUnlocked, isCleared, badgesOf, canBuild, totals, invById } from './sim/progress.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HEART = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onShell }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.onShell = onShell;
        this.dlg = null;            // the dialogue being told
        this.tally = null;
        this.lastHearts = -1;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it
        // lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), shadows = $('set-shadows'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; shadows.value = settings.shadows; calm.value = settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, shadows: shadows.value, calm: calm.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, shadows, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the shell dock
        const dock = $('hud-shells');
        SHELLS.forEach((s, i) => {
            const b = document.createElement('button');
            b.className = 'shellbtn locked'; b.dataset.i = i; b.innerHTML = `${s.icon}<small>${i + 1}</small>`;
            b.setAttribute('aria-label', `${s.name}: ${s.power}`); b.title = `${s.name}: ${s.power}`;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onShell?.(i); });
            dock.appendChild(b);
        });
        this.dockBtns = [...dock.children];

        // dialogue clicks
        $('d-next').addEventListener('click', (e) => { e.stopPropagation(); this.dlgAdvance(); });
        $('d-skip').addEventListener('click', (e) => { e.stopPropagation(); this.dlgSkip(); });
        $('dialogue').querySelector('.dbox').addEventListener('click', () => this.dlgAdvance());

        // how-to shell list
        $('howto-shells').innerHTML = SHELLS.map((s) => `<li><b>${s.icon} ${esc(s.name)}</b>: ${esc(s.how)}</li>`).join('');
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another stacks above it
        $(id).style.zIndex = 50 + this.stack.length;
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
    buttons(id) { return [...$(id).querySelectorAll('button:not(:disabled), select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary')) || list.find((b) => b.tagName === 'BUTTON' && !b.matches('.xbtn')) || list[0])?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const el = list[(i + dir + list.length) % list.length];
        el.focus(); el.scrollIntoView?.({ block: 'nearest' });
    }

    // ------------------------------------------------------------------ toasts
    toast(text) {
        for (const old of $('toasts').children) if (old.textContent === text) old.remove();      // the same news twice is one toast
        const el = document.createElement('div');
        el.className = 'toast'; el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 2900);
        window.A11Y?.announce?.(text);
    }

    // ------------------------------------------------------------------ title
    refreshTitle(P, hasSave) {
        $('btn-continue').hidden = !hasSave;
        $('btn-new').textContent = hasSave ? 'New Journey' : 'Start the Journey';
        $('btn-new').classList.toggle('primary', !hasSave);
        $('btn-workshop').hidden = !hasSave;
    }

    // ------------------------------------------------------------------ the map
    buildMap(P, onPlay) {
        const body = $('map-body');
        body.innerHTML = '';
        for (const w of WORLDS) {
            const lv = LEVELS_IN(w.id);
            const locked = !isUnlocked(P, lv[0].id);
            const card = document.createElement('section');
            card.className = 'world' + (locked ? ' locked' : '');
            card.dataset.theme = w.theme;
            const done = lv.filter((l) => isCleared(P, l.id)).length;
            card.innerHTML = `<h3><span>${w.icon}</span>${esc(w.name)}<small>${locked ? 'locked' : `${done}/${lv.length} · ${esc(w.blurb)}`}</small></h3>`;
            const list = document.createElement('div'); list.className = 'lvls';
            lv.forEach((l, i) => {
                const unlocked = isUnlocked(P, l.id), rec = P.cleared[l.id];
                const b = document.createElement('button');
                b.className = 'lvl' + (l.boss || l.final ? ' boss' : '') + (rec ? ' done' : '');
                b.disabled = !unlocked; b.dataset.level = l.id;
                const bd = rec ? badgesOf(l, rec) : {};
                b.innerHTML = `<span class="num">${rec ? '✓' : `${w.id}-${i + 1}`}</span>
                    <span class="nm">${esc(l.name)}<small>${l.boss ? 'Boss!' : l.final ? 'The last hop' : rec ? `${fmtTime(rec.time)} · ⚪ ${rec.pearls}/${rec.pearlTotal}` : unlocked ? 'New' : 'Locked'}</small></span>
                    <span class="st"><i class="${bd.curios ? 'on' : ''}" title="All found things">🧩</i><i class="${bd.pearls ? 'on' : ''}" title="90% of the pearls">⚪</i><i class="${bd.flawless ? 'on' : ''}" title="No oopsies">✨</i><i class="${bd.speed ? 'on' : ''}" title="Under par time">⏱️</i></span>
                    <span class="go">${unlocked ? '▶' : '🔒'}</span>`;
                b.addEventListener('click', () => { this.audio.ui('click'); onPlay(l.id); });
                list.appendChild(b);
            });
            card.appendChild(list);
            body.appendChild(card);
        }
        const t = totals(P);
        $('map-totals').innerHTML = `${t.cleared}/${t.levels} levels<br>⚪ ${t.pearls} · 🧩 ${t.curios}/${t.levels * 3}`;
    }

    focusLevel(id) { $('map-body').querySelector(`[data-level="${id}"]`)?.focus({ preventScroll: false }); $('map-body').querySelector(`[data-level="${id}"]`)?.scrollIntoView({ block: 'center' }); }

    // ------------------------------------------------------------------ the workshop
    buildWorkshop(P, { onBuild, onEquip }) {
        const slots = $('ws-slots');
        slots.innerHTML = '';
        for (let i = 0; i < MAX_EQUIPPED; i++) {
            const id = P.equipped[i], inv = id && invById(id);
            const b = document.createElement('button');
            b.className = 'slot' + (inv ? ' full' : '');
            b.innerHTML = inv ? `${inv.icon}<small>${esc(inv.name)}</small>` : '<span style="opacity:.3">➕</span>';
            b.setAttribute('aria-label', inv ? `${inv.name}, equipped. Press to take off.` : 'Empty slot');
            if (inv) b.addEventListener('click', () => onEquip(id)); else b.disabled = true;
            slots.appendChild(b);
        }
        $('ws-parts').innerHTML = Object.entries(PARTS).map(([k, p]) => `<div class="part ${P.parts[k] ? '' : 'zero'}" title="${esc(p.name)}"><span>${p.icon}</span>${P.parts[k] || 0}</div>`).join('');
        const list = $('ws-list');
        list.innerHTML = '';
        for (const inv of INVENTIONS) {
            const built = !!P.built[inv.id], eq = P.equipped.includes(inv.id);
            const el = document.createElement('div');
            el.className = 'inv' + (built ? ' built' : '') + (eq ? ' equipped' : '');
            el.dataset.inv = inv.id;
            const cost = Object.entries(inv.cost).map(([k, n]) => `<em class="${(P.parts[k] || 0) >= n || built ? '' : 'lack'}">${PARTS[k].icon} ${n}${built ? '' : ` (${P.parts[k] || 0})`}</em>`).join('');
            el.innerHTML = `<div class="ih"><span>${inv.icon}</span>${esc(inv.name)}</div><p>${esc(inv.blurb)}</p>${built ? '' : `<div class="cost">${cost}</div>`}`;
            const b = document.createElement('button');
            b.className = 'btn small' + (built && !eq ? '' : !built && canBuild(P, inv.id) ? ' primary' : '');
            if (!built) { b.textContent = canBuild(P, inv.id) ? '🔧 Build it!' : 'Need more parts'; b.disabled = !canBuild(P, inv.id); b.addEventListener('click', () => onBuild(inv.id)); }
            else { b.textContent = eq ? 'Take off' : 'Put on'; b.addEventListener('click', () => onEquip(inv.id)); }
            el.appendChild(b);
            list.appendChild(el);
        }
    }
    craftFx(id) {
        const el = $('ws-list').querySelector(`[data-inv="${id}"]`);
        if (!el) return;
        el.classList.add('crafting');
        setTimeout(() => el.classList.remove('crafting'), 1000);
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); if (!on) { $('hud-banner').hidden = true; $('hud-hint').hidden = true; } }
    setTouch(on, playing = !$('hud').hidden) { this.touchOn = on; $('touch').hidden = !(on && playing); }

    startLevel(G, meta, world) {
        this.lastHearts = -1;
        $('hud-curios').querySelectorAll('span').forEach((s, i) => { s.className = ''; s.textContent = PARTS[meta.curios[i]].icon; s.title = PARTS[meta.curios[i]].name; });
        this.dockBtns.forEach((b, i) => b.classList.toggle('locked', i >= G.shells));
        this.banner(`${meta.id.slice(1).replace('_', '-')}  ${meta.name}`, world.name);
        this.hint(meta.hint);
        const boss = $('hud-boss');
        boss.hidden = !G.boss;
        if (G.boss) { boss.querySelector('b').textContent = ''; boss.querySelector('.bossbar').innerHTML = '<i class="on"></i>'.repeat(G.boss.maxHp); }
        $('hud-wave').hidden = !G.level.chase;
        this.curiosSeen = 0;
    }
    banner(text, sub) {
        const el = $('hud-banner');
        el.hidden = true; void el.offsetWidth;
        el.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
        el.hidden = false;
    }
    hint(text) {
        const el = $('hud-hint');
        el.hidden = true; void el.offsetWidth;
        if (!text) return;
        el.textContent = text; el.hidden = false;
    }
    hud(G, view) {
        const total = Math.max(G.maxHearts, G.hearts);
        if (this.lastHearts !== G.hearts || $('hud-hearts').children.length !== total) {
            const el = $('hud-hearts'), prev = this.lastHearts;
            el.innerHTML = Array.from({ length: total }, (_, i) => HEART.replace('class="heart"', `class="heart${i < G.hearts ? '' : ' empty'}"`)).join('');
            if (prev >= 0 && G.hearts > prev) el.children[G.hearts - 1]?.classList.add('pop');
            this.lastHearts = G.hearts;
        }
        const pc = $('hud-pearls').querySelector('b');
        if (pc.textContent !== String(G.pearls)) pc.textContent = G.pearls;
        const spans = $('hud-curios').children;
        G.curioL.forEach((c, i) => { if (c.got && !spans[i].classList.contains('got')) spans[i].classList.add('got'); });
        this.dockBtns.forEach((b, i) => b.classList.toggle('cur', i === G.p.shell));
        if (G.boss) {
            const B = G.boss, bar = $('hud-boss').querySelector('.bossbar');
            if (B.state !== 'intro' && !$('hud-boss').querySelector('b').textContent) $('hud-boss').querySelector('b').textContent = { coco: 'Big Coco', sandy: 'Sir Sandy', squawk: 'Captain Squawk' }[B.kind];
            [...bar.children].forEach((s, i) => { const on = i < B.hp; if (s.classList.contains('on') && !on) s.classList.add('hit'); s.classList.toggle('on', on); });
        }
        if (G.level.chase) {
            const d = G.waveZ - G.p.z;
            $('hud-wave').querySelector('i').style.width = `${Math.max(0, Math.min(100, (d / 20) * 100))}%`;
        }
        // the Sea-Glass Specs point at the nearest hidden thing
        const ar = $('hud-arrow');
        if (G.perks.curioSense && view) {
            let best = null, bd = 1e9;
            for (const c of G.curioL) if (!c.got) { const d = Math.hypot(c.x - G.p.x, c.z - G.p.z); if (d < bd) { bd = d; best = c; } }
            if (best && bd > 5) {
                const q = view.project(best.x, best.y + 1.2, best.z), W = innerWidth, H = innerHeight;
                const cx = W / 2, cy = H / 2;
                let x = q.x, y = q.y, rot = 90;
                const inside = !q.behind && x > 40 && x < W - 40 && y > 80 && y < H - 120;
                if (!inside) {
                    let dx = q.x - cx, dy = q.y - cy;
                    if (q.behind) { dx = -dx; dy = -dy; }
                    const k = Math.min((W / 2 - 50) / Math.max(1, Math.abs(dx)), (H / 2 - 110) / Math.max(1, Math.abs(dy)));
                    x = cx + dx * k; y = cy + dy * k; rot = Math.atan2(dy, dx) * 180 / Math.PI;
                }
                ar.hidden = false; ar.style.left = `${x}px`; ar.style.top = `${y}px`; ar.style.transform = `rotate(${rot}deg)`;
            } else ar.hidden = true;
        } else ar.hidden = true;
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'swap') this.toast(`${SHELLS[e.shell].icon} ${SHELLS[e.shell].name}: ${SHELLS[e.shell].power}`);
            else if (e.type === 'checkpoint') this.toast('Checkpoint!');
            else if (e.type === 'oopsie') this.toast('Oopsie! Back to the last flag.');
            else if (e.type === 'rescue') this.toast('Cork Lifebuoy to the rescue!');
            else if (e.type === 'heart' && e.why === 'pearls') this.toast('50 pearls: a heart!');
            else if (e.type === 'curio') this.toast(`Found: ${PARTS[e.kind].name} ${PARTS[e.kind].icon}`);
            else if (e.type === 'switch') this.toast('Click! The gate is open.');
            else if (e.type === 'bossStart') this.hint(null);
        }
    }

    // ------------------------------------------------------------------ dialogue
    say(lines, onDone) {
        this.dlg = { lines: [...lines], i: -1, t: 0, shown: 0, text: '', done: false, onDone };
        $('dialogue').hidden = false;
        this.dlgNext();
    }
    get talking() { return !!this.dlg; }
    dlgNext() {
        const d = this.dlg;
        d.i++;
        if (d.i >= d.lines.length) { this.dlgEnd(); return; }
        const l = d.lines[d.i], c = CAST[l.who] || CAST.narr;
        $('d-face').textContent = c.face || '';
        $('d-face').style.borderColor = c.color; $('d-face').style.visibility = c.face ? 'visible' : 'hidden';
        $('d-name').textContent = c.name; $('d-name').style.color = c.color;
        d.text = l.text; d.shown = 0; d.t = 0; d.done = false;
        $('d-text').textContent = '';
        $('d-next').textContent = d.i === d.lines.length - 1 ? 'OK ▸' : 'Next ▸';
    }
    dlgAdvance() {
        const d = this.dlg;
        if (!d) return;
        if (!d.done) { d.shown = d.text.length; d.done = true; $('d-text').textContent = d.text; return; }
        this.audio.ui('click');
        this.dlgNext();
    }
    dlgSkip() { if (this.dlg) this.dlgEnd(); }
    dlgEnd() {
        const d = this.dlg;
        this.dlg = null;
        $('dialogue').hidden = true;
        d?.onDone?.();
    }

    // ------------------------------------------------------------------ results
    showComplete({ meta, run, res, hasNext, final, world }) {
        $('cl-title').textContent = meta.boss ? 'You did it!' : final ? 'HOME!' : 'Level clear!';
        $('cl-name').textContent = `${meta.id.slice(1).replace('_', '-')}  ${meta.name}`;
        const rows = [];
        const parts = meta.curios.map((k, i) => `<span class="${run.curios[i] || res.rec.curios[i] ? 'got' : ''} ${res.newCurios.includes(i) ? 'new' : ''}" title="${esc(PARTS[k].name)}">${PARTS[k].icon}</span>`).join('');
        rows.push({ icon: '⚪', label: 'Pearls', html: `<b data-count="${run.pearls}" data-of="${run.pearlTotal}">0</b>` });
        rows.push({ icon: '🧩', label: 'Found things', html: `<div class="parts-row">${parts}</div>` });
        rows.push({ icon: '⏱️', label: `Time <small>(par ${fmtTime(meta.par)})</small>`, html: `<b>${fmtTime(run.time)}</b>` });
        rows.push({ icon: '💫', label: 'Oopsies', html: `<b>${run.oopsies}</b>` });
        $('cl-tally').innerHTML = rows.map((r, i) => `<div class="tr" style="animation-delay:${0.15 + i * 0.35}s"><span class="ti">${r.icon}</span><span>${r.label}</span>${r.html}</div>`).join('');
        const names = { curios: ['🧩', 'All found things'], pearls: ['⚪', '90% of pearls'], flawless: ['✨', 'No oopsies'], speed: ['⏱️', 'Under par'] };
        $('cl-badges').innerHTML = Object.entries(names).map(([k, [ic, nm]]) => `<div class="badge ${res.badges[k] ? 'on' : ''} ${res.newBadges.includes(k) ? 'new' : ''}"><i>${ic}</i>${nm}</div>`).join('');
        const ns = $('cl-shell');
        ns.hidden = res.newShell < 0;
        if (res.newShell >= 0) ns.textContent = `New shell for the toolbox: ${SHELLS[res.newShell].icon} ${SHELLS[res.newShell].name}!`;
        const bottle = $('cl-bottle');
        bottle.hidden = !res.firstClear || !meta.note || meta.boss === 'squawk';
        $('cl-note').hidden = true; $('cl-note').textContent = meta.note;
        $('cl-bottle-btn').onclick = () => { this.audio.ui('open'); $('cl-note').hidden = !$('cl-note').hidden; };
        $('cl-next').hidden = !hasNext; $('cl-next').textContent = final ? 'The end ▸' : 'Next ▸';
        this.openScreen('complete');
        this.tally = { t: 0, counted: false };
        this.audio.ui('star');
        // animate the pearl counter
        const num = $('cl-tally').querySelector('[data-count]');
        const total = +num.dataset.count, of = num.dataset.of;
        let n = 0;
        clearInterval(this.tallyTimer);
        this.tallyTimer = setInterval(() => {
            n = Math.min(total, n + Math.max(1, Math.ceil(total / 24)));
            num.textContent = `${n} / ${of}`;
            if (n % 3 === 0) this.audio.ui('tally');
            if (n >= total) clearInterval(this.tallyTimer);
        }, 45);
    }

    showCredits(P) {
        const t = totals(P);
        $('credits-stats').textContent = `Levels ${t.cleared}/${t.levels} · pearls ${t.pearls} · found things ${t.curios}/${t.levels * 3} · badges ${t.badges}/${t.levels * 4}`;
        this.openScreen('credits');
    }

    // ------------------------------------------------------------------ every frame
    update(dt) {
        const d = this.dlg;
        if (d && !d.done) {
            d.t += dt;
            const n = Math.min(d.text.length, Math.floor(d.t * 52));
            if (n !== d.shown) {
                if (n % 3 === 0) this.audio.ui('type');
                d.shown = n; $('d-text').textContent = d.text.slice(0, n);
            }
            if (n >= d.text.length) d.done = true;
        }
    }
}
