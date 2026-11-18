// The DOM layer: screens, the HUD, the item belt, Zahra's shop, the skill tree, quests, the museum and its 3D viewer,
// the chest lock, dialogue, floating numbers, coins that fly to the purse, and toasts. It reads the sim and asks
// for changes only through cmd(), which goes through act() like everything else.

import { VERSION, SHOP, INV_MAX } from './config.js';
import { cell, ART } from './media.js';
import { ITEMS, ITEM_ORDER } from './sim/data/items.js';
import { SKILLS, BRANCHES, SKILL_BY_ID } from './sim/data/skills.js';
import { ARTIFACTS, ART_BY_ID, KINDS } from './sim/data/artifacts.js';
import { QUESTS } from './sim/data/quests.js';
import { LINES, floorName } from './sim/data/story.js';
import { maxHp, maxSt, rank, canLearn, questProgress, questDone } from './sim/game.js';
import { xpToNext, STORY_FLOORS } from './config.js';

const $ = (id) => document.getElementById(id);
const PORTRAIT = { sela: 'sela', quill: 'quill', zahra: 'zahra' };
const NAMES = { sela: 'Sela', quill: 'Quill', zahra: 'Madame Zahra' };
const icoHtml = (kind, i, cls = '') => `<span class="ico ico-${kind} ${cls}" style="background-position:${cell(i)}"></span>`;

export class UI {
    constructor({ audio, view, museum, settings, cmd, onSettings, onDeleteSave }) {
        this.audio = audio; this.view = view; this.museum = museum; this.settings = settings; this.cmd = cmd;
        this.stack = [];
        this.talkQ = [];
        this.talkT = 0;
        this.armed = null;          // an item waiting for a target cell (the blast charge)
        $('version').textContent = 'v' + VERSION;
        this.fixIcons(document);

        // A press that began outside a screen must not click inside it when it lifts (game-071).
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest?.('.screen') || null; }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeScreen(b.closest('.screen').id); });
        }

        // settings
        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), shake = $('set-shake');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; shake.value = settings.shake;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, shake: shake.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, shake]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the belt
        const belt = $('belt');
        ITEM_ORDER.forEach((id, k) => {
            const b = document.createElement('button');
            b.className = 'slot';
            b.dataset.item = id;
            b.setAttribute('aria-label', ITEMS[id].name);
            b.title = `${ITEMS[id].name}: ${ITEMS[id].text}`;
            b.innerHTML = `<kbd>${k + 1}</kbd>${icoHtml('item', ITEMS[id].icon)}<b>0</b>`;
            b.addEventListener('click', () => this.useItem(id));
            belt.appendChild(b);
        });
        $('talk').addEventListener('click', () => this.nextTalk());
    }

    /** Static icons in the markup carry --i; set their atlas cell explicitly (no CSS math needed). */
    fixIcons(root) {
        for (const el of root.querySelectorAll('.ico[style*="--i"]')) {
            const i = parseInt(getComputedStyle(el).getPropertyValue('--i') || el.style.getPropertyValue('--i'), 10);
            if (Number.isFinite(i)) el.style.backgroundPosition = cell(i);
        }
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, k) => { $(s).style.zIndex = String(50 + k * 2); });
        this.focusFirst(id);
        if (id === 'viewer') this.museum.init();
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'viewer') this.museum.hide();
        if (id === 'chestui') this.chestAt = -1;
        if (this.top()) this.focusFirst(this.top());
        else document.activeElement?.blur?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { clearTimeout(this.viewerT); for (const id of [...this.stack]) this.closeScreen(id); }
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

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        for (const id of ['hud', 'actions', 'floorbar', 'buffs']) $(id).hidden = !on;
        if (!on) { $('talk').hidden = true; }
    }

    /** Space the HUD and action bar take, for the view to fit the floor between them. */
    insets() {
        if ($('hud').hidden) return { top: 20, bottom: 20, right: 0 };
        const vh = window.visualViewport?.height || innerHeight, vw = window.visualViewport?.width || innerWidth;
        let top = 0;
        for (const el of document.querySelectorAll('#hud .hud-row, .pill')) { const r = el.getBoundingClientRect(); if (r.height) top = Math.max(top, r.bottom); }
        const a = $('actions').getBoundingClientRect(), f = $('floorbar').getBoundingClientRect();
        const side = a.width < vw * 0.4 && a.height > vh * 0.4;     // landscape phone: the bar is a column on the right
        if (side) return { top: top + 6, bottom: 12, right: vw - a.left + 4, left: 228 };
        return { top: top + 6, bottom: Math.max(vh - a.top, vh - f.top) + 6, right: 0 };
    }

    hud(G) {
        const mh = maxHp(G), ms = maxSt(G);
        $('hud-lv').textContent = `Lv ${G.lv}`;
        $('hud-xp').style.width = `${Math.min(100, (G.xp / xpToNext(G.lv)) * 100)}%`;
        $('hud-hp').textContent = `${G.hp}/${mh}`;
        $('hud-hpbar').style.width = `${(G.hp / mh) * 100}%`;
        $('hud-st').textContent = `${G.st}/${ms}`;
        $('hud-stbar').style.width = `${(G.st / ms) * 100}%`;
        this.setNum('hud-gold', G.gold);
        this.setNum('hud-gems', G.gems);
        $('hud-hp').parentElement.classList.toggle('low', G.mode === 'dig' && G.hp <= mh * 0.3);
        $('hud-st').parentElement.classList.toggle('low', G.mode === 'dig' && G.st <= Math.min(6, ms * 0.15));
        $('sp-badge').hidden = !G.sp; $('sp-badge').textContent = G.sp;
        const ready = G.quests.some((q) => questDone(G, q));
        $('quest-badge').hidden = !ready;
        $('camp-sp').hidden = !G.sp; $('camp-sp').textContent = G.sp;
        $('camp-q').hidden = !ready;
        for (const b of $('belt').children) {
            const id = b.dataset.item, n = G.inv[id] || 0;
            b.querySelector('b').textContent = n;
            b.classList.toggle('empty', !n);
            b.classList.toggle('armed', this.armed === id);
        }
        const F = G.F;
        $('floor-depth').textContent = G.n > STORY_FLOORS ? `Deep ${G.n - STORY_FLOORS}` : `Floor ${G.n}`;
        $('floor-name').textContent = floorName(G.n);
        let left = 0;
        for (const c of F.cells) if (c.k === 'b') left++;
        $('floor-status').textContent = F.cleared ? 'Cleared! Take the hatch down' : `${left} blocks left`;
        $('btn-descend').hidden = !(F.cleared && G.mode === 'dig');
        // buffs
        const buffs = [];
        if (G.hyper) buffs.push(`<div class="buff">${icoHtml('item', 7)}×3 for ${G.hyper}</div>`);
        if (G.ward) buffs.push(`<div class="buff">${icoHtml('item', 10)}${G.ward} ward${G.ward > 1 ? 's' : ''}</div>`);
        if (G.keys) buffs.push(`<div class="buff">${icoHtml('item', 11)}${G.keys} key${G.keys > 1 ? 's' : ''}</div>`);
        const html = buffs.join('');
        if (html !== this.buffHtml) { $('buffs').innerHTML = html; this.buffHtml = html; }
    }
    setNum(id, n) {
        const el = $(id);
        if (el.textContent !== String(n)) {
            el.textContent = n;
            const pill = el.closest('.pill');
            pill.classList.remove('pulse'); void pill.offsetWidth; pill.classList.add('pulse');
        }
    }

    useItem(id) {
        this.audio.ui('click');
        if (ITEMS[id].target) {
            this.armed = this.armed === id ? null : id;
            if (this.armed) this.toast('Tap a block to place the blast charge.');
            this.onArm?.();
            return;
        }
        this.cmd({ t: 'use', id });
    }

    // ------------------------------------------------------------------ shop
    renderShop(G) {
        $('shop-gold').textContent = G.gold; $('shop-gems').textContent = G.gems;
        const list = $('shop-list');
        list.innerHTML = '';
        for (const id of ITEM_ORDER) {
            const it = ITEMS[id], s = SHOP[id];
            const cost = s.gold ? `${icoHtml('item', 0)}${s.gold}` : `${icoHtml('item', 1)}${s.gems}`;
            const afford = s.gold ? G.gold >= s.gold : G.gems >= s.gems;
            const full = G.inv[id] >= s.max;
            const row = document.createElement('div');
            row.className = 'ware';
            row.innerHTML = `${icoHtml('item', it.icon)}<div class="info"><h3>${it.name}</h3><p>${it.text}</p><span class="own">Carrying ${G.inv[id]} / ${s.max}</span></div>`;
            const b = document.createElement('button');
            b.className = 'btn orange small';
            b.innerHTML = `<span class="price">${cost}</span>`;
            b.disabled = !afford || full || G.mode !== 'camp';
            b.addEventListener('click', () => { this.cmd({ t: 'buy', id }); });
            row.appendChild(b);
            list.appendChild(row);
        }
    }

    // ------------------------------------------------------------------ skills
    renderSkills(G) {
        $('skills-sp').textContent = G.sp;
        const tree = $('skill-tree');
        tree.innerHTML = '';
        for (const br of BRANCHES) {
            const col = document.createElement('div');
            col.className = 'branch';
            col.innerHTML = `<h3>${br.name}</h3>`;
            for (const s of SKILLS.filter((q) => q.branch === br.id)) {
                const r = rank(G, s.id);
                const can = canLearn(G, s.id);
                const b = document.createElement('button');
                b.className = 'skill' + (can === true ? ' can' : '') + (can === 'locked' ? ' locked' : '') + (r >= s.max ? ' max' : '');
                const need = Object.entries(s.needs || {}).map(([k, v]) => `${SKILL_BY_ID[k].name} ${v}`).join(', ');
                b.innerHTML = `${icoHtml('skill', s.icon)}<span class="name">${s.name}</span><span class="pips">${[...Array(s.max)].map((_, k) => `<i class="${k < r ? 'on' : ''}"></i>`).join('')}</span><span class="desc">${s.text(Math.max(1, Math.min(s.max, r + (r < s.max ? 1 : 0))))}</span>${can === 'locked' ? `<span class="lock">Needs ${need}</span>` : ''}`;
                b.setAttribute('aria-label', `${s.name}, rank ${r} of ${s.max}`);
                b.addEventListener('click', () => {
                    if (canLearn(G, s.id) === true) this.cmd({ t: 'learn', id: s.id });
                    else { this.audio.ui('deny'); if (G.sp <= 0) this.toast('No skill points. Level up by digging!'); }
                });
                col.appendChild(b);
            }
            tree.appendChild(col);
        }
    }

    // ------------------------------------------------------------------ quests
    renderQuests(G) {
        const list = $('quest-list');
        list.innerHTML = '';
        G.quests.forEach((q, k) => {
            const Q = QUESTS[q.kind];
            const p = questProgress(G, q), done = questDone(G, q);
            const row = document.createElement('div');
            row.className = 'quest';
            row.innerHTML = `${icoHtml('item', 14)}<div class="info"><h3>${Q.text(q.need, q.art)}</h3><div class="bar"><i style="width:${(p / q.need) * 100}%"></i></div><p>${p} / ${q.need}</p></div><div class="reward">${icoHtml('item', 0)}${q.gold}${q.gems ? ` ${icoHtml('item', 1)}${q.gems}` : ''}</div>`;
            const b = document.createElement('button');
            b.className = 'btn small ' + (done ? 'green' : 'grey');
            b.textContent = done ? 'Claim' : '…';
            b.disabled = !done;
            b.addEventListener('click', () => this.cmd({ t: 'claim', q: k }));
            row.appendChild(b);
            list.appendChild(row);
        });
    }

    // ------------------------------------------------------------------ museum
    renderMuseum(G) {
        const grid = $('museum-grid');
        grid.innerHTML = '';
        $('museum-count').textContent = `${G.artOrder.length} / ${ARTIFACTS.length}`;
        ARTIFACTS.forEach((a, k) => {
            const got = !!G.arts[a.id];
            const b = document.createElement('button');
            b.className = 'case' + (got ? '' : ' missing');
            b.innerHTML = `<span class="k" style="color:${KINDS[a.kind].color}">${got ? KINDS[a.kind].name.slice(0, -1) : '?'}</span><span class="art" style="background-position:${cell(k)}"></span><span class="label">${got ? a.name : `Floor ${a.floor}`}</span>`;
            b.setAttribute('aria-label', got ? a.name : `Undiscovered artifact, floor ${a.floor}`);
            b.addEventListener('click', () => {
                if (got) this.openViewer(G, a.id, false);
                else { this.audio.ui('deny'); this.toast(`Still buried somewhere around floor ${a.floor}.`); }
            });
            grid.appendChild(b);
        });
    }

    openViewer(G, id, found) {
        const a = ART_BY_ID[id];
        this.viewing = id;
        this.viewG = G;
        $('viewer-found').hidden = !found;
        $('viewer-name').textContent = a.name;
        $('viewer-kind').textContent = `${KINDS[a.kind].name.slice(0, -1)} · from floor ${a.floor}`;
        $('viewer-kind').style.color = KINDS[a.kind].color;
        $('viewer-effect').textContent = a.effect;
        $('viewer-lore').textContent = a.lore;
        const owned = ARTIFACTS.filter((q) => G.arts[q.id]);
        $('viewer-prev').hidden = $('viewer-next').hidden = found || owned.length < 2;
        this.openScreen('viewer');
        this.museum.show(id);
    }
    stepViewer(dir) {
        const G = this.viewG;
        const owned = ARTIFACTS.filter((q) => G.arts[q.id]);
        const k = owned.findIndex((q) => q.id === this.viewing);
        const next = owned[(k + dir + owned.length) % owned.length];
        if (next) this.openViewer(G, next.id, false);
    }

    // ------------------------------------------------------------------ chest lock
    openChest(G, i) {
        this.chestAt = i;
        $('ring-chest').src = '';
        $('ring-chest').style.background = `url(${ART.items}) ${cell(12)} / 400% 400% no-repeat`;
        this.renderChest(G);
        this.openScreen('chestui');
    }
    renderChest(G) {
        const i = this.chestAt;
        const ch = G.F.cells[i]?.o;
        const ring = $('ring');
        for (const r of ring.querySelectorAll('.rune')) r.remove();
        if (!ch || ch.t !== 'chest') return;
        const glyphs = ['☉', '☾', '✦', '♁', '♆'];
        ch.lock.forEach((on, k) => {
            const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
            const b = document.createElement('button');
            b.className = 'rune' + (on ? ' on' : '');
            b.style.left = `${50 + Math.cos(a) * 38}%`;
            b.style.top = `${50 + Math.sin(a) * 38}%`;
            b.textContent = glyphs[k];
            b.setAttribute('aria-label', `Rune ${k + 1}, ${on ? 'lit' : 'dark'}`);
            b.addEventListener('click', () => this.cmd({ t: 'press', i, k }));
            ring.appendChild(b);
        });
    }

    // ------------------------------------------------------------------ talk
    talk(id) {
        if (!LINES[id]) return;
        if (this.talkQ.some((q) => q === id)) return;
        this.talkQ.push(id);
        if ($('talk').hidden) this.nextTalk();
    }
    nextTalk() {
        const id = this.talkQ.shift();
        if (!id) { $('talk').hidden = true; this.talkT = 0; return; }
        const L = LINES[id];
        $('talk-por').src = ART.por(PORTRAIT[L.who]);
        $('talk-name').textContent = NAMES[L.who];
        $('talk-text').textContent = L.text;
        $('talk').hidden = false;
        const dur = this.audio.say(id);
        this.talkT = Math.max(dur + 0.6, 2.2 + L.text.length * 0.045);
    }
    tick(dt) {
        if (this.talkT > 0) { this.talkT -= dt; if (this.talkT <= 0) this.nextTalk(); }
    }

    // ------------------------------------------------------------------ juice in the DOM
    float(at, text, cls = '') {
        const el = document.createElement('div');
        el.className = 'float ' + cls;
        el.textContent = text;
        el.style.left = `${at.x + (Math.random() - 0.5) * 16}px`;
        el.style.top = `${at.y}px`;
        $('floaters').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }
    fly(kind, from) {
        const target = $(kind === 'gem' ? 'hud-gems' : 'hud-gold');
        if (!target || $('hud').hidden) return;
        const to = target.getBoundingClientRect();
        const n = kind === 'gem' ? 2 : 4;
        for (let k = 0; k < n; k++) {
            const el = document.createElement('div');
            el.className = 'flyer';
            el.style.background = `url(${ART.items}) ${cell(kind === 'gem' ? 1 : 0)} / 400% 400% no-repeat`;
            el.style.left = `${from.x - 14 + (Math.random() - 0.5) * 30}px`;
            el.style.top = `${from.y - 14 + (Math.random() - 0.5) * 30}px`;
            document.body.appendChild(el);
            setTimeout(() => { el.style.left = `${to.left - 10}px`; el.style.top = `${to.top - 4}px`; el.style.opacity = '0.2'; }, 30 + k * 60);
            setTimeout(() => el.remove(), 750 + k * 60);
        }
    }
    hurtFlash() {
        const el = $('hurtflash');
        el.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
    }
    toast(text, big = false) {
        const el = document.createElement('div');
        el.className = 'toast' + (big ? ' big' : '');
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
    }

    onEvents(G, events) {
        const at = (i, lift) => this.view.project(i, lift);
        for (const e of events) {
            switch (e.type) {
                case 'strike': this.float(at(e.i, 0.9), e.crit ? `${e.dmg}!` : `-${e.dmg}`, e.crit ? 'crit' : 'dmg'); break;
                case 'mhit': case 'ambush': this.float(at(e.i, 1.2), `-${e.dmg}`, 'crit'); if (e.type === 'ambush') this.float(at(e.i, 1.6), 'Ambush!', 'big gem'); break;
                case 'hurt': this.float(at(e.i >= 0 ? e.i : G.F.start, 1), `-${e.dmg} HP`, 'hurt'); this.hurtFlash(); break;
                case 'warded': this.float(at(e.i >= 0 ? e.i : G.F.start, 1), 'Warded!', 'gem'); break;
                case 'disarm': this.float(at(e.i, 1), 'Disarmed!', 'gem'); break;
                case 'falseAlarm': this.float(at(e.i, 1), `False alarm -${e.cost}`, 'xp'); break;
                case 'loot': {
                    const p = at(e.i >= 0 ? e.i : G.F.start, 0.8);
                    if (e.kind === 'gem') { this.float(p, `+${e.n} gem`, 'gem'); this.fly('gem', p); }
                    else if (e.kind === 'food') this.float(p, `+${e.n} stamina`, 'food');
                    else if (e.kind === 'key') this.float(p, 'Bronze key!', 'gold big');
                    else if (e.kind === 'potion') this.float(p, '+1 potion', 'hurt');
                    else { this.float(p, `+${e.n}g`, 'gold'); this.fly('gold', p); }
                    break;
                }
                case 'levelup': this.toast(`Level ${e.lv}!`, true); break;
                case 'artifact': clearTimeout(this.viewerT); this.viewerT = setTimeout(() => { if (G.arts[e.id]) this.openViewer(G, e.id, true); }, 650); break;
                case 'chestUi': this.openChest(G, e.i); break;
                case 'chestOpen': setTimeout(() => { if (this.top() === 'chestui') this.closeScreen('chestui'); }, 500); break;
                case 'press': if (this.top() === 'chestui') this.renderChest(G); break;
                case 'runeReset': this.float(at(e.i, 1), 'Wrong order!', 'hurt'); break;
                case 'runeFizzle': this.float(at(e.i, 1), 'Fizzle', 'xp'); break;
                case 'runeSolved': this.toast('Rune puzzle solved!', true); break;
                case 'panelOpen': this.toast('The sun panel opens!', true); break;
                case 'clear': this.toast('Floor cleared!', true); break;
                case 'sealed': this.float(at(e.i, 1), 'Sealed by sunlight', 'xp'); break;
                case 'locked': this.float(at(e.i, 1), 'Needs a key', 'xp'); break;
                case 'questReady': break;
                case 'claim': this.toast(`Quest reward: ${e.gold} gold${e.gems ? ` and ${e.gems} gem` : ''}`); break;
                case 'learn': this.toast(`${SKILL_BY_ID[e.id].name} rank ${e.rank}`); break;
                case 'buy': this.toast(`Bought ${ITEMS[e.id].name}`); break;
                case 'use': if (e.id === 'hyper') this.toast('Hyper Gauntlet! Triple strikes', true); break;
                case 'dowsed': this.toast(e.n ? `The rod twitches: ${e.n} danger${e.n > 1 ? 's' : ''} shown` : 'The rod is still. Nothing hidden.'); break;
                case 'faint': this.toast(`Fainted! The rescue cost ${e.lost} gold`, true); break;
                case 'revive': this.toast('The Phoenix Feather blazes!', true); break;
                case 'exhausted': this.toast('Out of stamina', true); break;
                case 'deny':
                    if (e.why === 'full' && e.cmd === 'use') this.toast('Already full.');
                    else if (e.why === 'gold') this.toast('Not enough gold.');
                    else if (e.why === 'gems') this.toast('Not enough gems.');
                    break;
                case 'say': this.talk(e.id); break;
                default: break;
            }
        }
        if (this.top() === 'shop') this.renderShop(G);
        if (this.top() === 'skills') this.renderSkills(G);
        if (this.top() === 'quests') this.renderQuests(G);
    }
}

export { INV_MAX };
