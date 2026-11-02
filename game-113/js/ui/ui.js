// The DOM layer: screens, the field and battle HUDs, the dialogue box, chapter cards, the band menu, Otto's route map,
// results, defeat and the credits. It reads the sim and calls back into main.js for anything that changes it.

import { VERSION } from '../config.js';
import { CHARS, NPCS, nameOf } from '../sim/data/chars.js';
import { ITEMS, CHARMS } from '../sim/data/items.js';
import { MAPS, WORLD } from '../sim/data/maps.js';
import { ENEMIES } from '../sim/data/enemies.js';
import { maxHp, power } from '../sim/party.js';
import { objective, unlockedNodes } from '../sim/story.js';
import { interactables } from '../sim/field.js';
import { xpToNext } from '../config.js';
import { portrait } from '../view/portraits.js';
import { LANE_COL } from './highway.js';

const $ = (id) => document.getElementById(id);
const KEYCAP = [['D', '←'], ['F', '↓'], ['J', '↑'], ['K', '→']];
const LOUD = new Set(['otto', 'colossus', 'warden', 'archivist']);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it when it lifts.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // ---- settings
        const S = settings;
        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), speed = $('set-speed'), off = $('set-offset'), diff = $('set-diff'), q = $('set-quality');
        sfx.value = S.sfx; music.value = S.music; touch.value = S.touch; speed.value = S.speed; off.value = S.offset; diff.value = S.difficulty; q.value = S.quality;
        const outOff = () => { $('set-offset-out').textContent = `${off.value > 0 ? '+' : ''}${off.value} ms`; };
        outOff();
        const changed = () => {
            Object.assign(S, { sfx: +sfx.value, music: +music.value, touch: touch.value, speed: +speed.value, offset: +off.value, difficulty: diff.value, quality: +q.value });
            outOff();
            onSettings(S);
        };
        for (const el of [sfx, music, touch, speed, off, diff, q]) { el.addEventListener('change', changed); el.addEventListener('input', changed); }
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // ---- dialogue
        this.dlg = { full: '', shown: 0, who: null, t: 0, active: false };
        this.partyKey = '';
        this.lastArea = null;
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // screens opened from screens stack on top of them, whatever their order in the page (game-088)
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
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
        this.audio.ui('move');
    }

    // ------------------------------------------------------------------ touch
    setTouch(on) { this.touchOn = on; }
    showTouchDeck(fieldPlaying) { $('touch').hidden = !(this.touchOn && fieldPlaying); }

    // ------------------------------------------------------------------ field HUD
    fieldHud(G, show) {
        $('hud').hidden = !show;
        if (!show) return;
        const m = MAPS[G.map];
        if (this.lastArea !== G.map) { this.lastArea = G.map; $('hud-area').textContent = m.name; if (G.mode === 'field') this.toast(m.name); }
        const o = objective(G);
        const goal = o ? o.text : G.flags.cleared ? 'The song goes on.' : '';
        if ($('hud-goal').textContent !== goal) $('hud-goal').textContent = goal;
        const it = G.mode === 'field' ? interactables(G)[0] : null;
        const pr = $('hud-prompt');
        if (it) {
            const verb = it.kind === 'npc' ? (it.n.travel ? 'Travel with Otto' : `Talk to ${nameOf(it.id) || 'them'}`) : it.kind === 'chest' ? 'Open the chest' : it.kind === 'crystal' ? 'Rest & save at the Song Crystal' : it.s.scene === 'lift' ? 'The Great Lift' : 'Look';
            const html = `<b>${this.touchOn ? 'A' : 'Space'}</b> ${verb}`;
            if (pr.innerHTML !== html) pr.innerHTML = html;
            pr.hidden = false;
        } else pr.hidden = true;
    }

    // ------------------------------------------------------------------ battle HUD
    battleHud(G, show, layout) {
        $('bhud').hidden = !show;
        if (!show || !G.battle) return;
        const B = G.battle;
        $('enemy-name').textContent = B.name;
        $('enemy-hp').style.width = `${Math.max(0, (B.hp / B.maxHp) * 100)}%`;
        const key = B.lanes.join(',');
        if (key !== this.partyKey) {
            this.partyKey = key;
            const pp = $('party-panel');
            pp.innerHTML = '';
            this.pm = {};
            for (const id of B.lanes) {
                if (!id) continue;
                const d = document.createElement('div');
                d.className = 'pm'; d.style.setProperty('--c', CHARS[id].color);
                const pc = portrait(id, 2);
                const cv = document.createElement('canvas'); cv.width = pc.width; cv.height = pc.height; cv.getContext('2d').drawImage(pc, 0, 0);
                const info = document.createElement('div');
                info.innerHTML = `<div class="nm">${CHARS[id].name}<span></span></div><div class="bar"><div class="fill"></div></div>`;
                d.append(cv, info);
                pp.appendChild(d);
                this.pm[id] = { d, hp: info.querySelector('.fill'), num: info.querySelector('.nm span') };
            }
            this.buildPads(B, layout);
        }
        for (const id of B.lanes) {
            if (!id) continue;
            const s = G.party.st[id], mx = maxHp(G, id), r = Math.max(0, s.hp / mx);
            const p = this.pm[id];
            p.hp.style.width = `${r * 100}%`;
            p.hp.classList.toggle('low', r < 0.3);
            p.num.textContent = `${Math.max(0, s.hp)}`;
            p.d.classList.toggle('ko', s.hp <= 0);
        }
        const ward = Math.round(B.ward);
        $('chip-ward').hidden = ward <= 0; $('chip-ward').textContent = `🛡 ${ward}`;
        $('chip-reso').hidden = B.reso <= 1.001; $('chip-reso').textContent = `✧ ×${B.reso.toFixed(2)}`;
        const cb = $('btn-cres');
        $('cres-fill').style.height = `${B.cres}%`;
        const gold = B.colossus;
        cb.classList.toggle('ready', B.cres >= 100 || gold);
        cb.classList.toggle('gold', gold);
        $('cres-label').textContent = gold ? 'COLOSSUS' : B.t < B.cresUntil ? 'CRESCENDO!' : 'CRESCENDO';
        if (layout && this.padsFor !== layout) this.buildPads(B, layout);
    }
    /** Touch pads under each lane of the highway; on a keyboard they show the keys and are still clickable. */
    buildPads(B, layout) {
        if (!layout) return;
        this.padsFor = layout;
        const el = $('lane-pads');
        el.innerHTML = '';
        document.documentElement.style.setProperty('--padH', `${layout.padH}px`);
        const pads = [null, null, null, null];
        for (const ln of layout.lanes) {
            const b = document.createElement('button');
            b.className = 'lane-pad';
            b.style.setProperty('--c', LANE_COL[ln.lane]);
            b.style.left = `${ln.x + 3}px`; b.style.width = `${ln.w - 6}px`;
            b.style.bottom = `calc(8px + var(--safe-b))`; b.style.height = `${layout.padH - 8}px`;
            b.innerHTML = `${this.touchOn ? '' : KEYCAP[ln.lane][0]}<small>${CHARS[B.lanes[ln.lane]].name}</small>`;
            b.setAttribute('aria-label', `Lane ${ln.lane + 1}`);
            b.dataset.lane = ln.lane;
            el.appendChild(b);
            pads[ln.lane] = b;
        }
        el.hidden = !this.touchOn;
        this.onPads?.(pads.filter(Boolean), pads);
    }

    // ------------------------------------------------------------------ dialogue
    say(who, text, inBattle = false) {
        const d = $('dialogue');
        d.hidden = false;
        d.classList.toggle('battle', inBattle);
        this.dlg = { full: text, shown: 0, who, t: 0, active: true };
        $('dlg-name').textContent = nameOf(who);
        const p = $('dlg-portrait');
        p.innerHTML = '';
        const pc = who !== 'narr' ? portrait(who, 4) : null;
        if (pc) p.appendChild(pc);
        const tx = $('dlg-text');
        tx.className = who === 'narr' ? 'narr' : LOUD.has(who) ? 'loud' : '';
        tx.textContent = '';
        window.A11Y?.announce?.(`${nameOf(who) ? nameOf(who) + ': ' : ''}${text}`);
    }
    dialogueTyping() { return this.dlg.active && this.dlg.shown < this.dlg.full.length; }
    completeDialogue() { this.dlg.shown = this.dlg.full.length; $('dlg-text').textContent = this.dlg.full; }
    hideDialogue() { $('dialogue').hidden = true; this.dlg.active = false; }
    tickDialogue(dt) {
        const D = this.dlg;
        if (!D.active || D.shown >= D.full.length) { $('dlg-next').hidden = !D.active; return; }
        $('dlg-next').hidden = true;
        D.t += dt * 55;
        const n = Math.min(D.full.length, Math.floor(D.t));
        if (n > D.shown) { D.shown = n; $('dlg-text').textContent = D.full.slice(0, n); if (D.full[n - 1] !== ' ') this.audio.blip(D.who); }
    }

    card(big, small) {
        const c = $('card');
        c.hidden = true; void c.offsetWidth; c.hidden = false;
        $('card-big').textContent = big; $('card-small').textContent = small || '';
        clearTimeout(this.cardT); this.cardT = setTimeout(() => { c.hidden = true; }, 2800);
    }

    // ------------------------------------------------------------------ the band menu
    renderBand(G, onCmd) {
        const list = $('band-list');
        list.innerHTML = '';
        for (const id of G.party.members) {
            const c = CHARS[id], s = G.party.st[id];
            const d = document.createElement('div');
            d.className = 'card'; d.style.setProperty('--c', c.color);
            const pc = portrait(id, 3);
            const cv = document.createElement('canvas'); cv.width = pc.width; cv.height = pc.height; cv.getContext('2d').drawImage(pc, 0, 0);
            const info = document.createElement('div');
            info.innerHTML = `<h4 style="color:${c.color}">${c.name}</h4><div class="sub">${c.title} · ${c.role.toUpperCase()}</div>
                <div class="stat"><span>Level</span><b>${s.lv}</b></div>
                <div class="stat"><span>HP</span><b>${Math.max(0, s.hp)} / ${maxHp(G, id)}</b></div>
                <div class="stat"><span>Power</span><b>${power(G, id).toFixed(1)}</b></div>
                <div class="stat"><span>Next level</span><b>${xpToNext(s.lv) - s.xp} xp</b></div>`;
            const blurb = document.createElement('div'); blurb.className = 'blurb'; blurb.textContent = `${c.blurb} Plays ${c.instrument}.`;
            const sel = document.createElement('select');
            sel.setAttribute('aria-label', `${c.name}'s charm`);
            sel.innerHTML = `<option value="">— no charm —</option>` + G.party.charms.map((k) => `<option value="${k}">${CHARMS[k].icon} ${CHARMS[k].name}${G.party.equip[id] !== k && Object.values(G.party.equip).includes(k) ? ' (worn)' : ''}</option>`).join('');
            sel.value = G.party.equip[id] || '';
            sel.disabled = !G.party.charms.length;
            sel.addEventListener('change', () => { onCmd({ t: 'equip', who: id, charm: sel.value || null }); this.renderBand(G, onCmd); });
            d.append(cv, info, blurb, sel);
            if (G.party.equip[id]) { const ch = document.createElement('div'); ch.className = 'blurb'; ch.textContent = `${CHARMS[G.party.equip[id]].icon} ${CHARMS[G.party.equip[id]].desc}`; d.appendChild(ch); }
            list.appendChild(d);
        }
        const il = $('item-list');
        il.innerHTML = '';
        const owned = Object.entries(G.party.items).filter(([, n]) => n > 0);
        if (!owned.length) il.innerHTML = '<p class="hint">Nothing in your pockets yet. Chests and duels have things.</p>';
        for (const [k, n] of owned) {
            const it = ITEMS[k];
            const row = document.createElement('div'); row.className = 'item';
            row.innerHTML = `<span class="ic">${it.icon}</span><span class="tx"><b>${it.name} ×${n}</b><br>${it.desc}</span>`;
            const use = document.createElement('div'); use.className = 'use';
            if (it.use?.heal) for (const id of G.party.members) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = CHARS[id].name; b.addEventListener('click', () => { if (!onCmd({ t: 'use', item: k, target: id })) this.toast('No need.'); this.renderBand(G, onCmd); }); use.appendChild(b); }
            else if (it.use?.healAllPct) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Use'; b.addEventListener('click', () => { if (!onCmd({ t: 'use', item: k })) this.toast('No need.'); this.renderBand(G, onCmd); }); use.appendChild(b); }
            row.appendChild(use);
            il.appendChild(row);
        }
    }

    // ------------------------------------------------------------------ Otto's route map
    renderWorldmap(G, onPick) {
        const board = $('map-board');
        board.querySelectorAll('.node').forEach((n) => n.remove());
        const open = unlockedNodes(G);
        const o = objective(G);
        const svg = $('map-roads');
        const ids = Object.keys(WORLD);
        svg.innerHTML = ids.slice(0, -1).map((k, i) => { const a = WORLD[k], b = WORLD[ids[i + 1]]; return `<line x1="${a.x * 100}" y1="${a.y * 100}" x2="${b.x * 100}" y2="${b.y * 100}" stroke="#6a4a2a" stroke-width="0.9" stroke-dasharray="2 1.4" vector-effect="non-scaling-stroke" style="stroke-width:3px"/>`; }).join('');
        for (const k of ids) {
            const n = WORLD[k];
            const b = document.createElement('button');
            b.className = 'node';
            b.style.left = `${n.x * 100}%`; b.style.top = `${n.y * 100}%`;
            b.textContent = open.includes(k) ? n.name : '???';
            b.disabled = !open.includes(k);
            b.dataset.node = k;
            if (n.map === G.map) b.classList.add('here');
            if (o && o.map === n.map && n.map !== G.map) b.classList.add('goal');
            b.addEventListener('mouseenter', () => { $('map-blurb').textContent = open.includes(k) ? n.blurb : 'Not yet.'; });
            b.addEventListener('focus', () => { $('map-blurb').textContent = open.includes(k) ? n.blurb : 'Not yet.'; });
            b.addEventListener('click', () => { if (open.includes(k)) onPick(k); });
            board.appendChild(b);
        }
        const here = Object.values(WORLD).find((n) => n.map === G.map) || WORLD.aurelune;
        this.placeOtto(here.x, here.y);
        $('map-blurb').textContent = 'Where to, passenger?';
    }
    placeOtto(x, y) { const o = $('map-otto'); o.style.left = `${x * 100}%`; o.style.top = `${y * 100}%`; }
    travelTick(G) {
        const T = G.travel;
        if (!T) return;
        const a = Object.values(WORLD).find((n) => n.map === T.from) || WORLD.aurelune, b = WORLD[T.to];
        const k = Math.min(1, T.t / T.dur), e = k * k * (3 - 2 * k);
        this.placeOtto(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e - Math.sin(k * Math.PI) * 0.06);
        $('map-blurb').textContent = `Travelling to ${b.name}… ${'.'.repeat(1 + (Math.floor(T.t * 4) % 3))}`;
    }

    // ------------------------------------------------------------------ results, defeat, ending
    showResults(G) {
        const R = G.results;
        $('res-title').textContent = R.final ? 'THE HUSH IS BROKEN' : R.boss ? 'SEAL BROKEN!' : 'VICTORY';
        const rk = $('res-rank'); rk.textContent = R.rank; rk.className = R.rank;
        const c = R.counts;
        $('res-stats').innerHTML = `<div><b>${c.perfect}</b>Perfect</div><div><b>${c.great}</b>Great</div><div><b>${c.good}</b>Good</div><div><b>${c.miss}</b>Miss</div><div><b>${R.maxCombo}</b>Best combo</div><div><b>${Math.round(R.acc * 100)}%</b>Accuracy</div>`;
        let g = `<div>+${R.xp} XP for the band</div>`;
        for (const u of R.ups) g += `<div class="lv">${CHARS[u.who].name} reached level ${u.lv}!</div>`;
        for (const d of R.drops) { const it = ITEMS[d] || CHARMS[d]; g += `<div>Found ${it.icon} ${it.name}${CHARMS[d] ? ' (a charm — wear it from the band menu)' : ''}</div>`; }
        $('res-gains').innerHTML = g;
        this.openScreen('results');
    }
    showEnding(G) {
        const s = G.stats;
        $('end-stats').innerHTML = `Duels won: ${s.won} · Perfect notes: ${s.perfects} · Best combo: ${s.bestCombo}`;
        const cr = $('credits'); cr.style.animation = 'none'; void cr.offsetWidth; cr.style.animation = '';
        this.openScreen('ending');
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast'; el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
        while ($('toasts').childElementCount > 3) $('toasts').firstChild.remove();
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'say') this.say(e.who, e.text, false);
            else if (e.type === 'talkLine') this.say(e.who, e.text, true);
            else if (e.type === 'talkEnd') this.hideDialogue();
            else if (e.type === 'title') this.card(e.big, e.small);
            else if (e.type === 'chest') { const it = ITEMS[e.item] || CHARMS[e.item]; this.toast(`Found ${it.icon} ${it.name}!`); }
            else if (e.type === 'crystal') this.toast('The band rests. Game saved.');
            else if (e.type === 'join') this.toast(`${CHARS[e.who].name} joined the band! ${CHARS[e.who].role.toUpperCase()} layer online.`);
            else if (e.type === 'levelUp' && G.mode !== 'results' && G.mode !== 'battle') this.toast(`${CHARS[e.who].name} reached level ${e.lv}!`);
            else if (e.type === 'useItem') this.toast(`Used ${ITEMS[e.item].name}.`);
            else if (e.type === 'encore') this.toast('🔔 The Encore Bell rings! The band rises!');
            else if (e.type === 'ko' && e.who && G.battle && !e.scripted) this.pm?.[e.who]?.d.classList.add('ko');
            else if (e.type === 'hurt' && this.pm?.[e.who]) { const d = this.pm[e.who].d; d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit'); }
        }
    }
}
void NPCS; void ENEMIES;
