// The DOM layer: title, HUD, dialogue, banners, toasts, settings and the screen stack. Reads the sim; changes it only through act().

import { $, h, moveFocus, focusables, visible, fmtTime } from './dom.js';
import { VERSION } from '../config.js';
import { CHARS, TYPE_INFO, STATUS_INFO } from '../sim/data/classes.js';
import { ITEMS } from '../sim/data/items.js';
import { LOCS } from '../sim/world/locations.js';
import { BEATS } from '../sim/data/story.js';
import { objective, curMap } from '../sim/game.js';
import { T } from '../sim/world/tiles.js';
import { PauseMenu, Shop, Board } from './menus.js';
import { BattleUI } from './battleui.js';

export class UI {
    constructor(env) {
        this.env = env;
        this.root = $('ui');
        this.stack = [];                 // open screens, top last
        this.line = null; this.typing = null; this.choicesEl = null;
        this.areaT = 0; this.hintT = 0; this.miniT = 0; this.objKey = '';
        this.downIn = null;
        this.menus = new PauseMenu(this); this.shop = new Shop(this); this.board = new Board(this);
        this.battle = new BattleUI(this);
        this.buildHud();
        // a press that began outside a screen (the finger that opened it) must not click inside it when it lifts
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen'); }, { capture: true });
        this.root.addEventListener('click', (e) => {
            const s = e.target.closest?.('.screen');
            if (s && e.detail && this.downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, { capture: true });
    }

    get G() { return this.env.G(); }
    get blocking() { return this.stack.length > 0; }

    // ------------------------------------------------------------------ screen stack
    open(el, { id = '', back = null, focus = true, cls = '' } = {}) {
        const scr = h('div', { class: `screen ${cls}`, id: id || null }, el);
        scr.style.zIndex = String(50 + this.stack.length * 2);
        scr._back = back;
        this.root.append(scr);
        this.stack.push(scr);
        this.env.audio.ui('open');
        if (focus) this.focusFirst(scr);
        return scr;
    }
    close(scr, silent = false) {
        const i = this.stack.indexOf(scr);
        if (i < 0) return;
        this.stack.splice(i, 1); scr.remove();
        if (!silent) this.env.audio.ui('close');
        if (this.top) this.focusFirst(this.top, true);
    }
    closeAll() { for (const s of [...this.stack]) this.close(s, true); }
    get top() { return this.stack[this.stack.length - 1] || null; }
    focusFirst(scr, keep = false) {
        if (keep && scr.contains(document.activeElement) && visible(document.activeElement)) return;
        const f = focusables(scr).find((b) => b.classList.contains('primary')) || focusables(scr)[0];
        f?.focus({ preventScroll: true });
    }
    back() { const t = this.top; if (!t) return false; if (t._back) { t._back(); return true; } this.close(t); return true; }

    /** One press from the input queue. Returns true if the UI used it. */
    press(p) {
        const key = p.key, audio = this.env.audio;
        if (this.battle.press(p)) return true;
        if (this.line && !this.top) {
            if (['Enter', 'Space', 'KeyZ'].includes(key) && !this.choicesEl) { this.advance(); return true; }
            if (this.choicesEl) {
                if (['ArrowUp', 'ArrowDown'].includes(key)) { moveFocus(this.choicesEl, key === 'ArrowUp' ? 'up' : 'down'); audio.ui('move'); return true; }
                if ((p.pad || p.touch) && (key === 'Enter')) { document.activeElement?.click?.(); return true; }
                return true;
            }
            return true;
        }
        if (this.top) {
            const t = this.top;
            const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[key];
            if (dir) { if (document.activeElement?.type === 'range' && (dir === 'left' || dir === 'right')) return false; moveFocus(t, dir); audio.ui('move'); return true; }
            if ((key === 'Enter' && (p.pad || p.touch)) || (key === 'Enter' && p.target !== 'BUTTON')) { const a = document.activeElement; if (a && t.contains(a)) a.click?.(); return true; }
            if (key === 'Escape' || key === 'KeyX' || key === 'Backspace') { this.back(); return true; }
            if (key === 'KeyP' && t.id === 'menu') { this.back(); return true; }
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ toasts and banners
    toast(text, cls = '') {
        const el = h('div', { class: `toast win ${cls}` }, text);
        $('toasts').append(el); setTimeout(() => el.remove(), 3100);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }
    banner(text, sub) {
        let b = $('banner'); if (!b) { b = h('div', { id: 'banner' }); this.root.append(b); }
        b.innerHTML = ''; b.append(h('h1', {}, text)); if (sub) b.append(h('p', {}, sub));
        b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    }

    // ------------------------------------------------------------------ HUD
    buildHud() {
        this.hud = h('div', { id: 'hud', hidden: true },
            h('div', { id: 'area' }),
            h('div', { id: 'objective', class: 'win' }, h('span', { id: 'arrow' }), h('div', {}, h('b', {}, 'OBJECTIVE'), h('span', { id: 'objtext' }))),
            h('div', { id: 'gold', class: 'win' }),
            h('canvas', { id: 'minimap', width: 108, height: 80 }),
            h('div', { id: 'hint', class: 'win' }),
        );
        this.root.append(this.hud);
        const arrow = $('arrow'); arrow.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2 L21 20 L12 15 L3 20 Z" fill="#ffd35c" stroke="#2a1a00" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        this.mini = $('minimap').getContext('2d');
    }
    showHud(on) { this.hud.hidden = !on; }
    area(map, e) {
        if (e.silent && !e.first) return;
        const el = $('area'); const L = LOCS[map.id];
        el.innerHTML = ''; el.append(map.name);
        if (L?.blurb && e.first) el.append(h('small', {}, L.blurb));
        el.classList.add('on'); clearTimeout(this.areaTO); this.areaTO = setTimeout(() => el.classList.remove('on'), 3600);
    }

    updateHud(G, dt, time) {
        if (this.hud.hidden) return;
        $('gold').textContent = `${G.gold} G`;
        // objective and its arrow
        const obj = objective(G);
        if (obj) {
            $('objtext').textContent = obj.text + (obj.rec ? `  (Lv ${obj.rec}+)` : '');
            const view = this.env.view, yaw = view.yaw;
            const dx = obj.x - G.px, dz = obj.y - G.py;
            const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
            const sx = dx * rx + dz * rz, sy = dx * fx + dz * fz;
            $('arrow').style.transform = `rotate(${Math.atan2(sx, sy)}rad)`;
            $('objective').style.display = '';
            this.objObj = obj;
        } else { $('objtext').textContent = 'Free roam'; this.objObj = null; }
        this.hintT -= dt; if (this.hintT <= 0) { this.hintT = 0.15; this.updateHint(G); }
        this.miniT -= dt; if (this.miniT <= 0) { this.miniT = 0.2; this.drawMini(G); }
    }
    updateHint(G) {
        const el = $('hint');
        const t = G.mode === 'field' && !G.pending && !G.warp && !this.blocking && this.env.nearest ? this.env.nearest(G) : null;
        const label = { npc: 'Talk', chest: 'Open', save: 'Rest at the crystal', crack: 'Inspect', spark: 'Take', board: 'Read the board', door: 'Enter', shrine: 'Examine' }[t?.kind];
        if (label) { el.textContent = `${this.env.confirmKey()}: ${label}`; el.classList.add('on'); } else el.classList.remove('on');
    }
    drawMini(G) {
        const ctx = this.mini, map = curMap(G), W = 108, Hh = 80;
        ctx.clearRect(0, 0, W, Hh);
        const colors = (t) => ({ [T.DEEP]: '#1a3a7a', [T.SHALLOW]: '#2a6aaa', [T.GRASS]: '#4a8a3a', [T.WOODS]: '#3a7a30', [T.FOREST]: '#1f5a24', [T.SAND]: '#d8c080', [T.SNOW]: '#e8f0fa', [T.ROCK]: '#6a6a78', [T.DIRT]: '#9a7a50', [T.STONE]: '#b0aca0', [T.WOOD]: '#9a6a38', [T.LAVA]: '#e0501a', [T.ICE]: '#a8e0fa', [T.WALL]: '#14121c', [T.BRIDGE]: '#8a5a2a', [T.SWAMP]: '#4a6a3a', [T.FLOWERS]: '#58a040', [T.ASH]: '#48424a', [T.BRICK]: '#a07a60', [T.CARPET]: '#a82a3a', [T.DARK]: '#3a384a', [T.MOSS]: '#3a5a34', [T.TEMPLE]: '#5aa0b0', [T.SANDSTONE]: '#d8b878', [T.ICEFLOOR]: '#c0e6fa' }[t] || '#444');
        if (map.kind === 'over') {
            if (!this._overImg) {
                const c = document.createElement('canvas'); c.width = map.w; c.height = map.h; const cc = c.getContext('2d');
                for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { cc.fillStyle = colors(map.tile[y * map.w + x]); cc.fillRect(x, y, 1, 1); }
                this._overImg = c;
            }
            ctx.imageSmoothingEnabled = false; ctx.drawImage(this._overImg, 0, 0, W, Hh);
            const sx = W / map.w, sy = Hh / map.h;
            ctx.fillStyle = '#ffffff'; for (const L of Object.values(LOCS)) { if (!G.visited[L.id]) continue; ctx.fillRect(L.x * sx - 1, L.y * sy - 1, 3, 3); }
            if (this.objObj && this.env.objMapTarget(G)) { const o = this.env.objMapTarget(G); ctx.fillStyle = '#ffd35c'; ctx.fillRect(o.x * sx - 2, o.y * sy - 2, 4, 4); }
            if (Math.floor(G.t * 3) % 2) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(G.px * sx - 1.5, G.py * sy - 1.5, 3, 3); }
        } else {
            const R = 18, x0 = Math.floor(G.px) - R, y0 = Math.floor(G.py) - R * 0.74;
            const cw = W / (R * 2), ch = Hh / (R * 1.48);
            for (let dy = 0; dy < R * 1.48; dy++) for (let dx = 0; dx < R * 2; dx++) {
                const x = x0 + dx, y = Math.floor(y0 + dy);
                if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
                ctx.fillStyle = colors(map.tile[y * map.w + x]); ctx.fillRect(dx * cw, dy * ch, cw + 0.6, ch + 0.6);
                if (map.blk[y * map.w + x]) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(dx * cw, dy * ch, cw + 0.6, ch + 0.6); }
            }
            const p = (x, y, c, s = 2.5) => { ctx.fillStyle = c; ctx.fillRect((x - x0) * cw - s / 2, (y - y0) * ch - s / 2, s, s); };
            for (const n of map.npcs) p(n.x, n.y, n.kind === 'boss' ? '#ff4a4a' : n.kind === 'story' ? '#ffd35c' : '#8ac8ff');
            for (const m of map.mobs) p(m.x, m.y, '#ff6a3a');
            if (this.objObj?.here) p(this.objObj.x, this.objObj.y, '#ffffff', 4);
            if (Math.floor(G.t * 3) % 2) p(G.px, G.py, '#ff3a3a', 3.5);
        }
    }

    // ------------------------------------------------------------------ dialogue
    showLine(ev) {
        this.hideChoices();
        let box = $('dialogue');
        if (!box) {
            box = h('div', { id: 'dialogue', class: 'win', onclick: () => { if (!this.choicesEl) this.advance(); } }, h('div', { class: 'face' }), h('div', { class: 'body' }, h('div', { class: 'who' }), h('div', { class: 'txt' })), h('div', { class: 'more' }, '▼'));
            this.root.append(box);
        }
        const narr = ev.who === '*';
        box.classList.toggle('narr', narr);
        const face = box.querySelector('.face'); face.innerHTML = '';
        const c = ev.face ? this.env.lib.portrait(ev.face) : null;
        if (c && !narr) face.append(c);
        face.style.display = c && !narr ? '' : 'none';
        box.querySelector('.who').textContent = narr ? '' : ev.who;
        box.querySelector('.who').style.display = narr ? 'none' : '';
        const txt = box.querySelector('.txt'); txt.textContent = '';
        box.querySelector('.more').style.visibility = 'hidden';
        box.hidden = false;
        // the face canvas should sit in the flex row
        face.style.cssText = c && !narr ? '' : 'display:none';
        this.line = ev;
        const speed = [0, 28, 55, 95, 9999][this.env.settings.textSpeed ?? 2];
        this.typing = { text: ev.text, i: 0, acc: 0, speed, el: txt };
        if (speed >= 9999) this.finishTyping();
    }
    finishTyping() {
        const t = this.typing; if (!t) return;
        t.el.textContent = t.text; this.typing = null;
        const box = $('dialogue'); if (box) box.querySelector('.more').style.visibility = '';
    }
    advance() {
        if (!this.line) return;
        if (this.typing) { this.finishTyping(); return; }
        this.env.act({ type: 'advance' });
    }
    endLine() { const box = $('dialogue'); this.line = null; this.typing = null; if (box) box.hidden = true; this.hideChoices(); }
    showChoices(options) {
        this.hideChoices();
        if (this.typing) this.finishTyping();
        this.choicesEl = h('div', { id: 'choices' }, options.map((o, i) => h('button', { class: 'btn win', onclick: () => { this.env.audio.ui('click'); this.hideChoices(); this.env.act({ type: 'choose', i }); } }, o)));
        this.root.append(this.choicesEl);
        focusables(this.choicesEl)[0]?.focus();
    }
    hideChoices() { this.choicesEl?.remove(); this.choicesEl = null; }
    updateDialogue(dt) {
        const t = this.typing; if (!t) return;
        t.acc += dt * t.speed;
        const n = Math.floor(t.acc);
        if (n > 0) {
            t.acc -= n; const before = t.i; t.i = Math.min(t.text.length, t.i + n);
            t.el.textContent = t.text.slice(0, t.i);
            if (t.i - before > 0 && t.i % 3 === 0) this.env.audio.voice?.();
            if (t.i >= t.text.length) this.finishTyping();
        }
    }

    // ------------------------------------------------------------------ settings, how to play, title
    howTo() {
        const key = (a, b) => h('tr', {}, h('td', {}, a), h('td', {}, b));
        const el = h('div', { class: 'sheet win' },
            h('h2', { class: 't' }, 'How to Play'),
            h('table', {}, key('Arrows / WASD', 'Move (hold Shift to hurry)'), key('Z / Enter / Space', 'Talk, open, confirm'), key('X / Esc', 'Cancel · open the menu'), key('Q / E', 'Turn the camera'), key('R', 'Boost in battle (spend BP)'), key('M', 'Quest log'), key('P', 'Pause menu')),
            h('p', {}, 'Touch: drag on the left half to walk, A confirms, B cancels or opens the menu, the arrows turn the camera. Gamepad: stick or d-pad, A / B, bumpers to turn the camera.'),
            h('p', {}, h('b', { style: 'color:var(--gold)' }, 'Battle. '), 'Every foe has a shield number and hidden weaknesses. Strike a weakness (a weapon or an element) to chip the shield; at zero the foe BREAKS: it loses its next turn and takes far more damage. Each hero gains 1 Boost Point per turn: spend up to three on one action to hit harder or more often. Watch for red warnings: a charged move can be cancelled by a Break.'),
            h('p', {}, 'Hunt the shards, recruit seven companions, and take the notice boards in every town for gold and rare seeds. Rest at inns and save crystals.'),
            h('div', { class: 'foot' }, h('button', { class: 'btn primary center', onclick: (e) => this.close(e.target.closest('.screen')) }, 'Got it')));
        this.open(el, { id: 'howto' });
    }
    settingsSheet(onClose) {
        const s = this.env.settings, save = () => this.env.saveSettings();
        const sfx = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.sfx, oninput: () => { s.sfx = +sfx.value; this.env.applySettings(); } });
        const mus = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.music, oninput: () => { s.music = +mus.value; this.env.applySettings(); } });
        const sel = (key, opts) => { const e = h('select', { onchange: () => { s[key] = e.value; this.env.applySettings(); } }, opts.map(([v, l]) => h('option', { value: v, selected: String(s[key]) === String(v) }, l))); return e; };
        const chk = (key) => { const e = h('input', { type: 'checkbox', checked: !!s[key], onchange: () => { s[key] = e.checked; this.env.applySettings(); } }); return e; };
        const el = h('div', { class: 'sheet win' },
            h('h2', { class: 't' }, 'Settings'),
            h('label', { class: 'row' }, 'Sound effects', sfx), h('label', { class: 'row' }, 'Music', mus),
            h('label', { class: 'row' }, 'Text speed', sel('textSpeed', [[1, 'Slow'], [2, 'Normal'], [3, 'Fast'], [4, 'Instant']])),
            h('label', { class: 'row' }, 'Touch controls', sel('touch', [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Never']])),
            h('label', { class: 'row' }, 'Screen shake', chk('shake')),
            h('label', { class: 'row' }, 'Reduced flashing', chk('reduced')),
            h('label', { class: 'row' }, 'Graphics (next launch)', sel('quality', [['auto', 'Automatic'], ['high', 'High'], ['low', 'Low']])),
            h('button', { class: 'btn', onclick: () => { this.env.deleteSave(); this.toast('Saved game deleted.'); } }, 'Delete saved game'),
            h('div', { class: 'foot' }, h('button', { class: 'btn primary center', onclick: (e) => { save(); this.close(e.target.closest('.screen')); onClose?.(); } }, 'Done')));
        const scr = this.open(el, { id: 'settings', back: () => { save(); this.close(scr); onClose?.(); } });
        return scr;
    }
    title(hasSave, info) {
        this.closeAll();
        const mk = (act, label, extra = {}) => h('button', { class: `btn center ${extra.primary ? 'primary' : ''} win`, onclick: () => { this.env.audio.init(); this.env.audio.ui('click'); this.env.titleAct(act); } }, label);
        const cont = hasSave ? mk('continue', info ? `Continue  ·  Lv ${info.lvl}  ${LOCS[info.map]?.name || 'the road'}  ·  ${fmtTime(info.playtime || 0)}` : 'Continue', { primary: true }) : null;
        const el = h('div', { id: 'titlebox', style: 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%' },
            h('h1', { class: 'logo' }, h('span', { class: 'a' }, 'DAWNSHARD'), h('span', { class: 'b' }, 'S A G A')),
            h('nav', { class: 'menu' }, cont, mk('new', 'New Game', { primary: !hasSave }), mk('howto', 'How to Play'), mk('settings', 'Settings')),
            h('div', { class: 'version' }, `v${VERSION}  ·  an HD-2D adventure in plain JavaScript, no asset files`));
        this.titleScr = this.open(el, { id: 'title', cls: '', back: null });
        this.titleScr.style.background = '';
    }
    closeTitle() { if (this.titleScr) { this.close(this.titleScr, true); this.titleScr = null; } }

    credits(G, onDone) {
        const names = Object.keys(G.party.members).map((id) => CHARS[id].name).join(', ');
        const share = G.ending?.choice !== 'sacrifice';
        const el = h('div', { class: 'screen', id: 'credits', style: 'z-index:90' },
            h('div', { class: 'roll' },
                h('h1', {}, 'DAWNSHARD SAGA'),
                h('p', {}, share ? 'The sun rose on nine hearts instead of one,\nand no one had to be the candle.' : 'One light was offered, and nine hands held it up.\nNo one carried it alone.'),
                h('h3', {}, 'THE PARTY'), h('p', {}, names),
                h('h3', {}, 'YOUR JOURNEY'), h('p', {}, `${fmtTime(G.stats.playtime)} played\n${G.stats.battles} battles · ${G.stats.kills} foes felled\n${G.stats.questsDone} quests completed · ${G.stats.chests} chests opened`),
                h('h3', {}, 'MADE WITH'), h('p', {}, 'three.js · Web Audio · plain JavaScript\nEvery sprite, tile, model and note is generated by code.\nNo image or audio files.'),
                h('h3', {}, 'THANK YOU FOR PLAYING'), h('p', {}, '✦'),
            ),
            h('button', { class: 'btn primary center', style: 'position:absolute;right:16px;bottom:16px', onclick: () => { clearTimeout(this._cto); el.remove(); onDone(); } }, 'Continue'));
        this.root.append(el); this.stack.push(el);
        el._back = () => { el.remove(); this.stack.splice(this.stack.indexOf(el), 1); onDone(); };
        el.querySelector('button').focus();
        this._cto = setTimeout(() => { if (el.isConnected) { el.remove(); this.stack.splice(this.stack.indexOf(el), 1); onDone(); } }, 72000);
    }
}
