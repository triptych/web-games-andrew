// The DOM layer: screens, the HUD, the sack and tray buttons, the elf, callouts, the story player and the level map.
// Reads the sim; never changes it (presses go through Input like every other control).

import { VERSION, SPIRIT_MAX, SACK_MAX, COLOR_HEX, COLOR_NAMES, SHOOTER, FIELD } from './config.js';
import { LEVELS, CHAPTERS, POWERS, SPECIALS, CAST } from './sim/data/levels.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class UI {
    constructor({ audio, settings, onSettings, onErase }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.pose = 'elf'; this.poseUntil = 0;
        this.storyDone = null;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), guide = $('set-guide'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; guide.value = settings.guide; calm.checked = settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, guide: guide.value, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, guide, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => {
            if ($('set-delete').dataset.armed) { onErase(); this.toast('All progress erased.'); delete $('set-delete').dataset.armed; $('set-delete').textContent = 'Erase all progress'; return; }
            $('set-delete').dataset.armed = '1';
            $('set-delete').textContent = 'Tap again to erase everything';
        });
        this._buildHowto();
        // story player
        $('story-next').addEventListener('click', () => { audio.ui('click'); this._storyStep(1); });
        $('story-skip').addEventListener('click', () => { audio.ui('click'); this._storyStep(99); });
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
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text, ms = 2600) {
        const box = $('toasts');
        while (box.children.length >= 2) box.firstChild.remove();
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        el.style.animationDuration = ms + 'ms';
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), ms + 100);
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        for (const id of ['hud', 'elf', 'tray-hit', 'dock']) $(id).hidden = !on;
    }

    setBackdrop(name) { $('backdrop').style.backgroundImage = name ? `url('art/bg-${name}.webp')` : 'none'; }

    /** Lay the DOM pieces out around the board, from the view's world-to-screen mapping. */
    layout(view, G) {
        const s = view.s;
        const key = `${view.w}x${view.h}|${G.slots}`;
        if (key === this._layoutKey) return;
        this._layoutKey = key;
        const sideRoom = view.toScreen(0, 0).x / s;              // world units free left of the board
        // the elf: beside the board if there is room, else tucked into the bottom-left corner
        const elf = $('elf');
        const tall = sideRoom > 3.2 ? 5.2 : 3.0;
        const fx = sideRoom > 3.2 ? -sideRoom * 0.55 - 0.3 : 0.75;
        const foot = view.toScreen(fx, 16.55);
        elf.style.height = tall * s + 'px';
        elf.style.left = foot.x - tall * s * 0.3 + 'px';
        elf.style.top = foot.y - tall * s + 'px';
        // the sack and spirit meter: right of the launcher, or beside the board
        const dock = $('dock');
        const slot = Math.round(Math.max(44, Math.min(58, s * 1.45)));
        dock.style.setProperty('--slot', slot + 'px');
        for (const el of dock.querySelectorAll('.slot')) { el.style.width = el.style.height = slot + 'px'; }
        let p;
        if (sideRoom > 4.2) { p = view.toScreen(FIELD.w + 0.6, 12.2); dock.style.left = p.x + 'px'; dock.style.width = Math.min(3 * slot + 16, (sideRoom - 0.8) * s) + 'px'; }
        else { p = view.toScreen(SHOOTER.x + 1.25, 14.35); dock.style.left = p.x + 'px'; dock.style.width = (FIELD.w - SHOOTER.x - 1.3) * s + 'px'; }
        dock.style.top = p.y + 'px';
        // tray buttons over the 3D ornaments
        const hit = $('tray-hit');
        hit.innerHTML = '';
        const n = Math.max(G.slots, 1);
        for (let i = 0; i < n; i++) {
            const q = view.trayPos(i), sp = view.toScreen(q.x, q.y);
            const b = document.createElement('button');
            const size = Math.max(44, s * (i === 0 ? 1.1 : 1.0));
            b.style.left = sp.x + 'px'; b.style.top = sp.y + 'px'; b.style.width = b.style.height = size + 'px';
            b.dataset.slot = i;
            if (i > 0) b.classList.add('swap');
            b.setAttribute('aria-label', i === 0 ? 'Swap the loaded ornament' : `Load tray ornament ${i + 1}`);
            hit.appendChild(b);
        }
    }

    hud(G, levelName) {
        $('hud-level').textContent = levelName;
        const sc = String(G.score);
        if ($('hud-score').textContent !== sc) $('hud-score').textContent = sc;
        const left = Math.max(0, G.dropEvery - G.pressure);
        const dk = `${G.dropEvery}|${G.pressure}`;
        if (dk !== this._dk) {
            this._dk = dk;
            const dots = $('hud-drop-dots');
            dots.innerHTML = '';
            for (let i = 0; i < G.dropEvery; i++) { const d = document.createElement('span'); d.className = 'dot' + (i < G.pressure ? ' used' : ''); dots.appendChild(d); }
            $('hud-drop').classList.toggle('warn', left <= 2);
            $('hud-drop').title = `${left} more shot${left === 1 ? '' : 's'} (a miss counts double) until ${G.mode === 'level' ? 'the ceiling comes down' : 'a new row pushes in'}`;
        }
        $('spirit-fill').style.width = Math.round((G.spirit / SPIRIT_MAX) * 100) + '%';
        const sk = G.sack.join(',') + '|' + (G.loaded || '');
        if (sk !== this._sk) {
            const prev = this._sack || [];
            this._sk = sk; this._sack = G.sack.slice();
            const sack = $('sack');
            sack.innerHTML = '';
            for (let i = 0; i < SACK_MAX; i++) {
                const p = G.sack[i];
                const b = document.createElement('button');
                b.className = 'slot' + (p ? '' : ' empty') + (p && prev[i] !== p ? ' fresh' : '');
                b.dataset.use = i;
                const size = getComputedStyle($('dock')).getPropertyValue('--slot');
                if (size) b.style.width = b.style.height = size;
                if (p) {
                    b.style.backgroundImage = `url('art/icon-${p}.webp')`;
                    b.setAttribute('aria-label', `${POWERS[p].name}: ${POWERS[p].desc}`);
                    b.title = `${POWERS[p].name}: ${POWERS[p].desc}`;
                } else b.setAttribute('aria-label', 'Empty power-up slot');
                const k = document.createElement('kbd'); k.textContent = 'QER'[i]; b.appendChild(k);
                sack.appendChild(b);
            }
        }
    }

    setElf(pose, ms = 0) {
        const now = performance.now();
        if (ms) this.poseUntil = now + ms;
        else if (now < this.poseUntil) return;
        if (pose === this.pose) return;
        this.pose = pose;
        const el = $('elf');
        el.src = `art/${pose}.webp`;
        if (pose === 'elf-cheer') { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }
    }
    tickElf() { if (this.pose !== 'elf' && performance.now() > this.poseUntil) this.setElf('elf'); }

    callout(view, x, y, text, big = false, color = '') {
        if (this.settings.calm && !big) return;
        const p = view.toScreen(x, y);
        const el = document.createElement('div');
        el.className = 'callout' + (big ? ' big' : '');
        el.textContent = text;
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        if (!big) el.style.fontSize = Math.max(14, view.s * 0.6) + 'px';
        if (color) el.style.color = color;
        $('callouts').appendChild(el);
        setTimeout(() => el.remove(), big ? 1700 : 1200);
    }

    // ------------------------------------------------------------------ story
    story(lines, onDone) {
        this.storyLines = lines; this.storyI = -1; this.storyDone = onDone;
        this.openScreen('story');
        this._storyStep(1);
    }
    _storyStep(d) {
        if (!this.storyLines) return;
        this.storyI += d;
        if (this.storyI >= this.storyLines.length) {
            this.audio.hush();
            this.closeScreen('story');
            const done = this.storyDone;
            this.storyLines = null; this.storyDone = null;
            done?.();
            return;
        }
        const l = this.storyLines[this.storyI];
        const who = CAST[l.who];
        $('story-por').src = `art/${who.portrait}.webp`;
        $('story-por').alt = who.name;
        $('story-who').textContent = who.name;
        $('story-text').textContent = l.text;
        $('story-next').textContent = this.storyI === this.storyLines.length - 1 ? 'Play!' : 'Next';
        if (l.vo) this.audio.say(l.vo, { force: true }); else this.audio.hush();
        $('story-next').focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ level map
    buildMap(progress, onPick) {
        const list = $('map-list');
        list.innerHTML = '';
        let total = 0;
        CHAPTERS.forEach((ch, ci) => {
            const sec = document.createElement('section');
            sec.className = 'chap';
            const stars = LEVELS.filter((l) => l.ch === ci).reduce((a, l) => a + (progress.stars[l.id] || 0), 0);
            total += stars;
            sec.innerHTML = `<h3><span>${ci + 1}. ${ch.name}</span><span class="chip">★ ${stars}/18</span></h3>`;
            const row = document.createElement('div');
            row.className = 'chap-row';
            for (const l of LEVELS.filter((x) => x.ch === ci)) {
                const b = document.createElement('button');
                b.className = 'lvl' + (l.id === progress.unlocked && !progress.stars[l.id] ? ' next' : '');
                b.disabled = l.id > progress.unlocked;
                const st = progress.stars[l.id] || 0;
                b.innerHTML = `${l.id}<small>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small>`;
                b.title = `${l.name}${b.disabled ? ' (locked)' : ''}`;
                b.setAttribute('aria-label', `Level ${l.id}, ${l.name}, ${st} stars${b.disabled ? ', locked' : ''}`);
                b.addEventListener('click', () => { this.audio.ui('click'); onPick(l.id); });
                row.appendChild(b);
            }
            sec.appendChild(row);
            list.appendChild(sec);
        });
        $('map-stars').textContent = `★ ${total}/108` + (progress.endless ? ` · Blizzard best ${progress.endless}` : '');
    }

    _buildHowto() {
        const sp = $('howto-specials');
        const swatch = {
            gift: 'url(art/icon-gift.webp) center / contain no-repeat',
            coal: 'radial-gradient(circle at 35% 30%, #555, #111)',
            ice: 'radial-gradient(circle at 35% 30%, #fff, #9fd6ff 60%, #5aa0d0)',
            bell: 'url(art/icon-bell.webp) center / contain no-repeat',
            prism: 'conic-gradient(#ff4d6d, #ffb347, #fff275, #5ee87a, #4db8ff, #b07aff, #ff4d6d)',
        };
        sp.innerHTML = COLOR_HEX.map((c, i) => `<span class="sw" title="${COLOR_NAMES[i]}" style="display:inline-block;width:26px;height:26px;margin-right:4px;background:radial-gradient(circle at 35% 30%, #fff8, ${hex(c)} 55%)"></span>`).join('')
            + '<div class="dim" style="font-size:13px;margin:2px 0 6px">Six ornament colours, each with its own pattern: stripes, dots, zigzags, snowflakes, ribs and stars.</div>'
            + Object.entries(SPECIALS).map(([k, s]) => `<div class="gl"><span class="sw" style="background:${swatch[k]}"></span><span><b>${s.name}.</b> ${s.desc}</span></div>`).join('');
        $('howto-powers').innerHTML = Object.entries(POWERS).map(([k, p]) => `<div class="gl"><img src="art/icon-${k}.webp" alt=""><span><b>${p.name}.</b> ${p.desc}</span></div>`).join('');
    }

    clearToasts() { $('toasts').innerHTML = ''; $('callouts').innerHTML = ''; }

    // ------------------------------------------------------------------ results
    result({ won, endless, G, best, newBest, last }) {
        const stars = $('result-stars');
        if (endless) {
            $('result-head').textContent = 'Snowed In!';
            stars.innerHTML = '';
            $('result-text').innerHTML = `Score <b>${G.score}</b>${newBest ? ' — a new best!' : ` · best ${best}`}<br>${G.pushed} rows of blizzard weathered.`;
        } else if (won) {
            $('result-head').textContent = last ? 'Every Ornament Home!' : 'Ornaments Reclaimed!';
            stars.innerHTML = [0, 1, 2].map((i) => `<span class="${i < G.stars ? 'on' : ''}">★</span>`).join('');
            $('result-text').innerHTML = `Score <b>${G.score}</b> in ${G.shots} shots (par ${G.parShots})${newBest ? '<br>New best!' : ''}`;
        } else {
            $('result-head').textContent = 'Oh, tinsel-sticks!';
            stars.innerHTML = '';
            $('result-text').textContent = 'The ornaments reached the line. Try a different angle: bank shots off the walls, and aim for the ornaments holding the others up.';
        }
        $('result-next').hidden = !won || endless;
        $('result-next').textContent = last ? 'The Ending' : 'Next Level';
        $('result-again').textContent = won ? 'Replay' : 'Try Again';
        $('result-map').textContent = endless ? 'Title' : 'Map';
        this.clearToasts();
        this.openScreen('result');
        if (won && !endless) $('result-next').focus({ preventScroll: true }); else $('result-again').focus({ preventScroll: true });
    }
}
