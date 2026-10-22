// The DOM layer: screens, the HUD and bottom bar, enemy tags, reward cards, the Constellation
// map, toasts and floating numbers. Reads the sim (or a snapshot of it); never changes it —
// everything the player does goes out through `request(action)`.

import { VERSION } from './config.js';
import { SYMBOLS, ENEMIES, NODES, SECTORS, COURSE, TREE } from './sim/data.js';
import { evaluate, line, hitOf } from './sim/battle.js';
import { available, nodeById } from './sim/tree.js';
import { can, purgeable } from './sim/game.js';
import { glyphURL, glyphImg } from './glyphs.js';
import { REST_HEAL } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KIND_COL = { blade: SYMBOLS.blade.color, comet: SYMBOLS.comet.color, burn: SYMBOLS.hex.color };

export class UI {
    constructor({ audio, settings, input, onSettings, onDeleteSave, request }) {
        this.audio = audio;
        this.settings = settings;
        this.request = request;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        this.sel = 0;                      // the selected reel
        this.foeEls = [];
        this.reelEls = [];
        this.cache = new Map();            // element → last html, so we only touch what changed
        this.treeSel = null;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
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

        // settings
        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), calm = $('set-calm'), speed = $('set-speed');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; calm.checked = !!settings.calm; speed.value = String(settings.speed);
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, calm: calm.checked, speed: +speed.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch, calm, speed]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved run deleted.'); });

        // the bar: buttons act on finger-down
        input.bindButton($('btn-go'), () => this.request(this.goAction));
        input.bindButton($('btn-up'), () => this.request({ t: 'nudge', reel: this.sel, dir: 1 }));
        input.bindButton($('btn-down'), () => this.request({ t: 'nudge', reel: this.sel, dir: -1 }));
        input.bindButton($('btn-respin'), () => this.request({ t: 'respin', reel: this.sel }));
        this.goAction = { t: 'spin' };

        // reward, tree, waystation
        $('reward-skip').addEventListener('click', () => this.request({ t: 'pick', i: -1 }));
        $('tree-light').addEventListener('click', () => { if (this.treeSel) this.request({ t: 'light', id: this.treeSel }); });
        $('tree-leave').addEventListener('click', () => this.request({ t: 'leave' }));
        $('way-rest').addEventListener('click', () => this.request({ t: 'rest' }));

        // the How to Play legend
        $('legend').innerHTML = Object.entries(SYMBOLS).map(([k, d]) =>
            `<div>${glyphImg(k)}<span><b>${esc(d.name)}</b>${d.base ? ' ' + d.base : ''}</span></div>`).join('');
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // screens share a z-index; give each one its place in the open stack (game-088)
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
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
    isOpen(id) { return this.stack.includes(id); }

    buttons(id) {
        return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length);
    }
    focusFirst(id) {
        const list = this.buttons(id);
        const pick = list.find((b) => b.classList.contains('primary') || b.classList.contains('open')) || list[0];
        pick?.focus({ preventScroll: true });
    }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ helpers
    set(el, html) {
        if (this.cache.get(el) === html) return;
        this.cache.set(el, html);
        el.innerHTML = html;
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    banner(text, small = '') {
        const b = $('banner');
        b.innerHTML = `<span class="bn">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</span>`;
        clearTimeout(this.bannerT);
        this.bannerT = setTimeout(() => { b.innerHTML = ''; }, 1700);
    }

    float(x, y, text, color) {
        const el = document.createElement('div');
        el.className = 'float';
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.color = color;
        $('floats').appendChild(el);
        setTimeout(() => el.remove(), 1150);
    }

    setTouch(on) { this.touchOn = on; }

    // ------------------------------------------------------------------ play HUD
    showPlay(on) {
        for (const id of ['hud', 'bar', 'foes', 'reels']) $(id).hidden = !on;
    }

    /** Build the enemy tags and reel zones for a battle. */
    buildBattle(G, ids, nReels) {
        const foes = $('foes');
        foes.innerHTML = '';
        this.cache.clear();
        this.foeEls = ids.map((id, i) => {
            const b = document.createElement('button');
            b.className = 'foe';
            b.innerHTML = `<div class="foe-name">${esc(ENEMIES[id].name)}</div><div class="foe-intent"></div><div class="foe-hp"><i></i><b></b></div><div class="foe-chips"></div>`;
            b.addEventListener('click', () => this.request({ t: 'target', i }));
            foes.appendChild(b);
            return b;
        });
        this.buildReels(nReels);
    }

    buildReels(n) {
        const reels = $('reels');
        reels.innerHTML = '';
        this.reelEls = [];
        for (let i = 0; i < n; i++) {
            const b = document.createElement('button');
            b.className = 'reel-hit';
            b.setAttribute('aria-label', `Reel ${i + 1}: tap to select, swipe up or down to nudge`);
            let y0 = null, id = null;
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                y0 = e.clientY; id = e.pointerId;
                this.select(i);
                try { b.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
            });
            const end = (e) => {
                if (e.pointerId !== id || y0 == null) return;
                const dy = e.clientY - y0;
                y0 = null;
                if (Math.abs(dy) > 24) this.request({ t: 'nudge', reel: i, dir: dy < 0 ? 1 : -1 });
            };
            b.addEventListener('pointerup', end);
            b.addEventListener('pointercancel', () => { y0 = null; });
            b.addEventListener('click', (e) => { if (e.detail === 0) this.select(i); });
            reels.appendChild(b);
            this.reelEls.push(b);
        }
        this.sel = Math.min(this.sel, n - 1);
    }

    select(i) {
        if (i < 0 || i >= this.reelEls.length) return;
        if (i !== this.sel) this.audio.ui('select');
        this.sel = i;
    }

    intentHTML(e, m) {
        if (m.k === 'atk') return `<span class="atk">${glyphImg('i_atk')}${hitOf(e, m)}${m.n > 1 ? '×' + m.n : ''}${m.b ? ' ' + glyphImg('i_block') + m.b : ''}</span>`;
        if (m.k === 'block') return `${glyphImg('i_block')}${m.v}`;
        if (m.k === 'buff') return `${glyphImg('i_buff')}+${m.v}`;
        if (m.k === 'heal') return `${glyphImg('i_heal')}${m.v}`;
        if (m.k === 'jam') return `${glyphImg('i_jam')}Jam ${m.n}`;
        return '';
    }

    /** Draw the HUD from D, a snapshot (the event being shown) or the live state. */
    hud(G, D, anchors, idle) {
        // where you are
        this.set($('hud-sector'), esc(`${G.sector + 1} · ${SECTORS[Math.min(G.sector, SECTORS.length - 1)].name}`));
        this.set($('hud-pips'), COURSE.map((k, i) => `<span class="pip ${k} ${i < G.stop ? 'done' : i === G.stop ? 'now' : ''}"></span>`).join(''));
        // hull
        const hp = $('hp');
        hp.querySelector('.hp-fill').style.width = `${Math.max(0, (D.hp / D.maxHp) * 100)}%`;
        this.set(hp.querySelector('.hp-text'), `${D.hp} / ${D.maxHp}`);
        hp.setAttribute('aria-valuenow', D.hp);
        hp.setAttribute('aria-valuemax', D.maxHp);
        const blk = $('hp-block');
        blk.hidden = !D.block;
        this.set(blk, glyphImg('shield', 'gl') + D.block);
        // energy
        const free = G.b && G.phase === 'battle' && G.b.free && idle;
        const pips = Math.max(D.energy, 0);
        this.set($('energy'), (free ? '<span class="epip free" title="Free action"></span>' : '') +
            Array.from({ length: Math.max(pips, 2) }, (_, i) => `<span class="epip ${i < pips ? 'on' : ''}"></span>`).join(''));
        $('energy').setAttribute('aria-label', `Energy ${pips}${free ? ' plus one free action' : ''}`);

        const B = G.b;
        const inBattle = G.phase === 'battle' && B;
        // the go button and reel controls
        const go = $('btn-go');
        this.goAction = inBattle && B.spun ? { t: 'fire' } : { t: 'spin' };
        go.textContent = this.goAction.t === 'fire' ? 'FIRE' : 'SPIN';
        go.classList.toggle('fire', this.goAction.t === 'fire');
        go.disabled = !inBattle;
        const canOp = inBattle && can(G, { t: 'nudge', reel: this.sel, dir: 1 });
        for (const id of ['btn-up', 'btn-down', 'btn-respin']) $(id).disabled = !canOp;
        // preview what the payline will do
        let pv = '';
        if (inBattle && B.spun && idle) {
            const r = evaluate(G, line(G));
            pv = r.groups.map((g) => `<span class="pv">${glyphImg(g.sym)}${g.total}${g.n >= 2 && g.sym !== 'charge' ? `<span class="mult">×${g.n}</span>` : ''}</span>`).join('') || '<span class="dim">nothing</span>';
        } else if (inBattle && !B.spun && idle) pv = '<span class="dim">Spin the reels</span>';
        this.set($('preview'), pv);

        // enemy tags
        if (B && anchors) {
            this.foeEls.forEach((el, i) => {
                const a = anchors.foes[i], s = D.e[i], e = B.enemies[i];
                if (!a || !s || !e) return;
                el.style.left = `${a.x}px`;
                el.style.top = `${a.y}px`;
                el.classList.toggle('dead', !s.alive);
                el.classList.toggle('target', i === B.target && s.alive && G.phase === 'battle');
                const m = ENEMIES[e.id].moves[s.move];
                this.set(el.querySelector('.foe-intent'), this.intentHTML({ str: s.str }, m));
                el.querySelector('.foe-hp i').style.width = `${(s.hp / s.maxHp) * 100}%`;
                this.set(el.querySelector('.foe-hp b'), `${s.hp}/${s.maxHp}`);
                this.set(el.querySelector('.foe-chips'),
                    (s.block ? `<span class="chip b">${s.block}</span>` : '') + (s.burn ? `<span class="chip burn">🔥${s.burn}</span>` : '') + (s.str ? `<span class="chip str">+${s.str}</span>` : ''));
                el.setAttribute('aria-label', `${ENEMIES[e.id].name}, ${s.hp} of ${s.maxHp} HP${i === B.target ? ', your target' : ''}`);
            });
            anchors.reels.forEach((r, i) => {
                const el = this.reelEls[i];
                if (!el) return;
                el.style.left = `${r.x}px`; el.style.top = `${r.y}px`;
                el.style.width = `${Math.max(44, r.w)}px`; el.style.height = `${r.h}px`;
            });
        }
    }

    // ------------------------------------------------------------------ events
    onEvent(G, e, anchors) {
        const foe = (i) => anchors?.foes[i];
        const mid = anchors?.reels.length ? anchors.reels[Math.floor(anchors.reels.length / 2)] : null;
        const mx = mid ? mid.x + mid.w / 2 : innerWidth / 2, my = mid ? mid.y + mid.h / 2 : innerHeight / 2;
        switch (e.type) {
            case 'battle':
                this.buildBattle(G, e.ids, e.reels.length);
                if (e.boss) this.banner(ENEMIES[e.ids[0]].name, 'boss');
                break;
            case 'sector':
                this.banner(SECTORS[e.sector].name, `sector ${e.sector + 1}`);
                break;
            case 'fire':
                if (e.top >= 3) this.banner(e.top >= 5 ? 'SUPERNOVA' : 'JACKPOT', `${e.top} of a kind`);
                break;
            case 'hit': {
                const a = foe(e.i);
                if (a) this.float(a.cx, a.cy, e.dmg ? `-${e.dmg}` : 'BLOCKED', KIND_COL[e.kind]);
                break;
            }
            case 'burn': { const a = foe(e.i); if (a) this.float(a.cx, a.cy + 24, `+${e.amount} burn`, SYMBOLS.hex.color); break; }
            case 'phit': this.float(mx, my - 20, e.dmg ? `-${e.dmg}` : 'BLOCKED', e.dmg ? '#ff4d6d' : SYMBOLS.shield.color); break;
            case 'pheal': if (e.amount) this.float(mx, my, `+${e.amount}`, SYMBOLS.mend.color); break;
            case 'pblock': this.float(mx - 50, my, `+${e.amount} block`, SYMBOLS.shield.color); break;
            case 'charge': this.float(mx + 50, my, `+${e.amount} energy`, SYMBOLS.charge.color); break;
            case 'eheal': { const a = foe(e.j); if (a && e.amount) this.float(a.cx, a.cy, `+${e.amount}`, SYMBOLS.mend.color); break; }
            case 'eact': {
                const a = foe(e.i);
                if (a && e.k === 'buff') this.float(a.cx, a.cy, 'POWER UP', '#ffb347');
                if (a && e.k === 'block') this.float(a.cx, a.cy, 'SHIELDS', SYMBOLS.shield.color);
                break;
            }
            case 'jam': this.float(mx, my + 30, 'JAMMED!', '#c0c4d8'); break;
            case 'light': this.toast(`${e.name} lit.`); break;
            case 'rest': this.toast(`Repaired ${e.amount}.`); break;
            case 'purge': this.toast(`${SYMBOLS[e.sym].name} stripped from your reels.`); break;
            case 'pick': if (e.sym) this.toast(`${SYMBOLS[e.sym].name} added to every reel.`); break;
        }
    }

    // ------------------------------------------------------------------ phase screens
    reelSummary(G) {
        const counts = {};
        for (const s of G.p.reels[0]) counts[s] = (counts[s] || 0) + 1;
        return `<span>${G.p.reels.length} reels × ${G.p.reels[0].length}:</span>` +
            Object.keys(SYMBOLS).filter((k) => counts[k]).map((k) => `<span>${glyphImg(k)}${counts[k]}</span>`).join('');
    }

    showReward(G) {
        const counts = {};
        for (const s of G.p.reels[0]) counts[s] = (counts[s] || 0) + 1;
        const box = $('reward-cards');
        box.innerHTML = '';
        G.reward.choices.forEach((s, i) => {
            const d = SYMBOLS[s];
            const b = document.createElement('button');
            b.className = 'card';
            b.innerHTML = `<img src="${glyphURL(s, 96)}" alt=""><div><b>${esc(d.name)}</b><br><span>${esc(d.text)}${d.base && s !== 'charge' ? ` Base ${d.base}.` : ''}</span><br><em>Each reel: ${counts[s] || 0} → ${(counts[s] || 0) + 1}</em></div>`;
            b.setAttribute('aria-label', `Add ${d.name} to every reel`);
            b.addEventListener('click', () => this.request({ t: 'pick', i }));
            box.appendChild(b);
        });
        $('reward-reels').innerHTML = this.reelSummary(G);
        this.openScreen('reward');
    }

    showWay(G) {
        const heal = Math.min(G.p.maxHp - G.p.hp, Math.round(G.p.maxHp * REST_HEAL));
        $('way-rest').textContent = `Repair +${heal} (${G.p.hp}/${G.p.maxHp})`;
        const box = $('way-purge');
        box.innerHTML = '';
        const counts = {};
        for (const s of G.p.reels[0]) counts[s] = (counts[s] || 0) + 1;
        for (const s of purgeable(G)) {
            const b = document.createElement('button');
            b.className = 'btn';
            b.innerHTML = `${glyphImg(s)} ${esc(SYMBOLS[s].name)} (${counts[s] || 0})`;
            b.setAttribute('aria-label', `Strip one ${SYMBOLS[s].name} from every reel`);
            b.addEventListener('click', () => this.request({ t: 'purge', sym: s }));
            box.appendChild(b);
        }
        $('way-reels').innerHTML = this.reelSummary(G);
        this.openScreen('way');
    }

    /** The Constellation. `view` = true when opened from the HUD just to look. */
    showTree(G, view = false) {
        this.treeView = view;
        const T = G.tree;
        const av = new Set(view ? [] : available(T));
        const lit = new Set(T.lit);
        const scroll = $('tree-scroll');
        const map = $('tree-map');
        const W = Math.min(560, Math.max(260, (scroll.clientWidth || 300) - 8));
        const RS = 66, top = TREE.rows - 1;
        const H = TREE.rows * RS + 30;
        map.style.width = W + 'px';
        map.style.height = H + 'px';
        const jit = (n) => (((n.r * 73 + n.c * 151) % 17) / 17 - 0.5) * 18;
        const pos = (n) => ({
            x: n.r === top ? W / 2 : ((n.c + 0.5) * W) / TREE.cols + jit(n),
            y: H - 40 - n.r * RS + (n.r === top ? 0 : jit(n) * 0.5),
        });
        const last = T.lit[T.lit.length - 1];
        let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
        for (const e of T.edges) {
            const [a, b] = e.split('>');
            const A = pos(nodeById(T, a)), Bp = pos(nodeById(T, b));
            const litEdge = lit.has(a) && lit.has(b) && T.lit.indexOf(b) === T.lit.indexOf(a) + 1;
            const openEdge = a === last && av.has(b);
            const col = litEdge ? '#ff8ad8' : openEdge ? '#3cf0ff' : 'rgba(160,140,255,0.28)';
            svg += `<line x1="${A.x}" y1="${A.y}" x2="${Bp.x}" y2="${Bp.y}" stroke="${col}" stroke-width="${litEdge || openEdge ? 3 : 2}" ${litEdge || openEdge ? '' : 'stroke-dasharray="4 5"'}/>`;
        }
        svg += '</svg>';
        map.innerHTML = svg;
        for (const n of T.nodes) {
            const d = NODES[n.kind];
            const p = pos(n);
            const b = document.createElement('button');
            b.className = `node ${d.tier}${lit.has(n.id) ? ' lit' : ''}${av.has(n.id) && G.points > 0 ? ' open' : ''}`;
            b.style.left = p.x + 'px';
            b.style.top = p.y + 'px';
            b.dataset.id = n.id;
            b.innerHTML = `<img src="${glyphURL(d.icon, 64)}" alt="">`;
            b.setAttribute('aria-label', `${d.name}: ${d.text}${lit.has(n.id) ? ' (lit)' : av.has(n.id) ? ' (open)' : ''}`);
            b.addEventListener('click', () => {
                if (this.treeSel === n.id && av.has(n.id) && G.points > 0) this.request({ t: 'light', id: n.id });
                else this.selectNode(G, n.id);
            });
            map.appendChild(b);
        }
        $('tree-points').textContent = view ? `${T.lit.length} lit` : `${G.points} point${G.points === 1 ? '' : 's'} to spend`;
        $('tree-leave').textContent = view ? 'Close' : 'Continue';
        $('tree-light').hidden = view;
        const first = [...av][0] || last || T.nodes[0].id;
        this.selectNode(G, first);
        this.openScreen('tree');
        // scroll the tree box (only) so the open stars are in view
        const sb = map.querySelector(`[data-id="${first}"]`);
        if (sb) scroll.scrollTop = Math.max(0, parseFloat(sb.style.top) - scroll.clientHeight / 2);
        if (!view) map.querySelector('.node.open')?.focus({ preventScroll: true });
    }

    selectNode(G, nid) {
        this.treeSel = nid;
        const T = G.tree;
        const n = nodeById(T, nid);
        if (!n) return;
        const d = NODES[n.kind];
        const reach = available(T).includes(nid);
        const isOpen = !this.treeView && reach && G.points > 0;
        const state = T.lit.includes(nid) ? 'Lit.' : isOpen ? 'Open: you can light this.'
            : reach ? 'Next on your path: light it with your next point.' : 'Not reachable from your last star.';
        $('tree-detail').innerHTML = `<b>${esc(d.name)}</b>${d.tier === 'key' ? ' <span class="dim">keystone</span>' : ''}<br>${esc(d.text)}<br><span class="dim">${state}</span>`;
        for (const b of $('tree-map').querySelectorAll('.node')) b.classList.toggle('sel', b.dataset.id === nid);
        $('tree-light').disabled = !isOpen;
    }

    showOver(G) {
        const won = G.phase === 'won';
        $('over-title').textContent = won ? 'The Stars Return' : 'Ship Lost';
        $('over-text').textContent = won
            ? 'The House is broken and every stolen star rolls back into the sky. The Fortune Engine cools, still humming.'
            : `Lost in ${SECTORS[G.sector].name}. The reels go dark... until the next pilot pulls the lever.`;
        const S = G.stats;
        $('over-stats').innerHTML = [
            ['Fights won', S.fights], ['Damage dealt', S.dmg], ['Jackpots (3+ of a kind)', S.jackpots],
            ['Best single spin', S.best], ['Stars lit', G.tree.lit.length], ['Reels', G.p.reels.length],
        ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
        this.openScreen('over');
    }
}

