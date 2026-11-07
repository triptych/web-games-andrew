// The DOM layer: menu screens, the HUD, toasts, settings, the deck viewer and the phase panels
// (rewards, the Army Surplus store, the diner, broadcasts, reel cards, deck picks). Reads the sim and
// hands commands to main.js; never changes G itself.

import { VERSION, GADGET_SLOTS, REST_HEAL } from './config.js';
import { CARDS, ENEMIES, EVENTS, GADGETS, RELICS, REELS } from './sim/data.js';
import { cardName, cardRank, cardText } from './sim/text.js';
import { canRemove, optionOk, upgradable } from './sim/run.js';
import { score } from './sim/game.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onCmd }) {
        this.audio = audio;
        this.settings = settings;
        this.onCmd = onCmd;
        this.stack = [];
        this.panelKey = '';
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
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

        const sfx = $('set-sfx'), music = $('set-music'), film = $('set-film'), speed = $('set-speed');
        sfx.value = settings.sfx; music.value = settings.music; film.value = settings.film; speed.value = settings.speed;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, film: film.value, speed: speed.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, film, speed]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved run deleted.'); });

        // the phase panel: one delegated listener for every button it ever holds
        $('panel-sheet').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-cmd]');
            if (!b || b.disabled) return;
            const cmd = JSON.parse(b.dataset.cmd);
            this.onCmd(cmd, b);
        });
        $('hud-relics').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-relic]');
            if (b) { const r = RELICS[b.dataset.relic]; this.toast(`${r.icon} ${r.name}: ${r.text}`); }
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another appears on top of it (game-088): z-index from the stack
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        else if (!$('panel').hidden) this.focusFirst('panel');
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    panelOpen() { return !$('panel').hidden; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's (or the panel's) controls. */
    moveFocus(dir) {
        const id = this.top() || (this.panelOpen() ? 'panel' : null);
        if (!id) return;
        const list = this.buttons(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; }
    hud(G, shown) {
        const s = shown || G;
        $('hud-hp').querySelector('b').textContent = s.hp;
        $('hud-hp').querySelector('span').textContent = s.maxHp;
        $('hud-bucks').querySelector('b').textContent = s.bucks ?? G.bucks;
        $('hud-reel').textContent = `Reel ${G.act + 1} · Stop ${G.trail.length}`;
        $('hud-deck').textContent = G.deck.length;
        const rk = G.relics.join(',');
        if (rk !== this.relicKey) {
            this.relicKey = rk;
            $('hud-relics').innerHTML = G.relics.map((k) => `<button class="relic" data-relic="${k}" aria-label="${esc(RELICS[k].name)}: ${esc(RELICS[k].text)}" title="${esc(RELICS[k].name)}: ${esc(RELICS[k].text)}">${RELICS[k].icon}</button>`).join('');
        }
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 2900);
        window.A11Y?.announce?.(text);
    }

    // ------------------------------------------------------------------ the deck viewer
    showDeck(G) {
        const cards = G.deck.slice().sort((a, b) => (CARDS[a.k].rarity === 'starter') - (CARDS[b.k].rarity === 'starter') || a.k.localeCompare(b.k) || (a.r || 0) - (b.r || 0));
        $('deck-body').innerHTML = `
            <div class="section-label">Stock · ${G.deck.length} cards</div>
            <div class="deck-list">${cards.map((c) => this._cardItem(c, null)).join('')}</div>
            <div class="section-label">Gadgets · ${G.gadgets.length}/${GADGET_SLOTS}</div>
            <div class="deck-list">${G.gadgets.map((k) => this._gadgetItem(k, null)).join('')}</div>
            <div class="section-label">Souvenirs</div>
            <div class="deck-list">${G.relics.map((k) => this._relicItem(k, null)).join('')}</div>`;
        this.openScreen('deck');
    }

    _cardItem(c, cmd, extra = '', disabled = false) {
        const d = CARDS[c.k];
        const tag = cmd ? 'button' : 'div';
        const attr = cmd ? ` data-cmd='${esc(JSON.stringify(cmd))}'${disabled ? ' disabled' : ''}` : '';
        return `<${tag} class="item card${c.up ? ' up' : ''}"${attr}><span class="nm">${esc(cardName(c))}<span class="rk">${esc(cardRank({ ...c, r: c.r ?? d.r }))}</span></span><span class="tx">${esc(cardText(c))}</span>${extra}</${tag}>`;
    }
    _gadgetItem(k, cmd, extra = '', disabled = false) {
        const g = GADGETS[k];
        const tag = cmd ? 'button' : 'div';
        const attr = cmd ? ` data-cmd='${esc(JSON.stringify(cmd))}'${disabled ? ' disabled' : ''}` : '';
        return `<${tag} class="item gadget"${attr}><span class="nm">${esc(g.name)} · ${g.cost}⚛</span><span class="tx">${esc(g.text)}</span>${extra}</${tag}>`;
    }
    _relicItem(k, cmd, extra = '', disabled = false) {
        const r = RELICS[k];
        const tag = cmd ? 'button' : 'div';
        const attr = cmd ? ` data-cmd='${esc(JSON.stringify(cmd))}'${disabled ? ' disabled' : ''}` : '';
        return `<${tag} class="item relic" data-icon="${r.icon}"${attr}><span class="nm">${esc(r.name)}</span><span class="tx">${esc(r.text)}</span>${extra}</${tag}>`;
    }
    _gadgetTake(G, k, base) {
        if (G.gadgets.length < GADGET_SLOTS) return this._gadgetItem(k, { ...base }, '<span class="px">Take it</span>');
        return `${this._gadgetItem(k, null)}<div class="slots" role="group" aria-label="Swap it for">${G.gadgets.map((g, i) => `<button class="btn" data-cmd='${esc(JSON.stringify({ ...base, slot: i }))}'>Swap for ${esc(GADGETS[g].name)}</button>`).join('')}</div>`;
    }

    // ------------------------------------------------------------------ the phase panel
    /** Show (or hide) the panel G.phase needs. Rebuilt only when what it shows changes. */
    syncPanel(G) {
        const want = !G.over && (G.pick || ['intro', 'reward', 'shop', 'rest', 'event'].includes(G.phase));
        if (!want) {
            if (!$('panel').hidden) { $('panel').hidden = true; this.panelKey = ''; }
            return;
        }
        const key = JSON.stringify([G.phase, G.offer, G.pick, G.bucks, G.gadgets, G.deck.length, G.act, G.hp]);
        if (key === this.panelKey && !$('panel').hidden) return;
        // keep the focused button's place, so a keyboard player isn't thrown back to the top
        const sheet = $('panel-sheet');
        const focusIdx = this.buttons('panel').indexOf(document.activeElement);
        this.panelKey = key;
        sheet.innerHTML = G.pick ? this._pickHtml(G) : this._phaseHtml(G);
        sheet.classList.toggle('wide', G.phase === 'shop' || G.phase === 'reward' || !!G.pick);
        const wasHidden = $('panel').hidden;
        $('panel').hidden = false;
        sheet.scrollTop = wasHidden ? 0 : sheet.scrollTop;
        if (!this.anyScreen()) {
            const list = this.buttons('panel');
            const pick = focusIdx >= 0 ? list[Math.min(focusIdx, list.length - 1)] : list[0];
            if (wasHidden || focusIdx >= 0) pick?.focus({ preventScroll: true });
        }
    }

    _phaseHtml(G) {
        const o = G.offer;
        switch (G.phase) {
            case 'intro': {
                const r = REELS[G.act];
                return `<div class="reelcard"><div class="reelno">REEL ${G.act + 1} OF 3</div><h2>${esc(r.title)}</h2>
                    <div class="where">${esc(r.place)} · ${r.year}</div><p>${esc(r.intro)}</p>
                    ${G.act > 0 ? `<p class="dim">${esc(REELS[G.act - 1].outro)}</p>` : ''}</div>
                    <div class="sheet-foot"><button class="btn primary" data-cmd='{"t":"done"}'>Roll the film</button></div>`;
            }
            case 'reward': {
                const head = o.kind === 'treasure' ? 'Buried Treasure' : o.tier === 'boss' ? 'The Monster Is Dead!' : o.tier === 'elite' ? 'An Elite Falls!' : 'Creature Destroyed!';
                let h = `<h2>${head}</h2>`;
                if (o.bucks) h += `<p>You find <b>$${o.bucks}</b> in the wreckage.</p>`;
                if (o.relics.length) {
                    h += `<div class="section-label">${o.relics.length > 1 ? 'Choose a souvenir' : 'A souvenir'}</div><div class="items">`;
                    h += o.relics.map((k, i) => this._relicItem(k, { t: 'take', what: 'relic', i }, o.relicTaken ? '<span class="px">—</span>' : '<span class="px">Take it</span>', o.relicTaken)).join('');
                    h += '</div>';
                }
                if (o.gadget && !o.gadgetTaken) h += `<div class="section-label">A gadget</div><div class="items">${this._gadgetTake(G, o.gadget, { t: 'take', what: 'gadget' })}</div>`;
                if (o.cards.length && !o.cardTaken) {
                    h += `<div class="section-label">Add a card to your deck (or don't)</div><div class="items">`;
                    h += o.cards.map((c, i) => this._cardItem(c, { t: 'take', what: 'card', i }, '<span class="px">Add it</span>')).join('');
                    h += '</div>';
                }
                const left = (!o.cardTaken && o.cards.length) || (!o.relicTaken && o.relics.length) || (o.gadget && !o.gadgetTaken);
                h += `<div class="sheet-foot"><button class="btn${left ? '' : ' primary'}" data-cmd='{"t":"done"}'>${left ? 'Skip the rest' : 'Onward'}</button></div>`;
                return h;
            }
            case 'shop': {
                let h = `<h2>Army Surplus</h2><p>A sergeant behind a counter of crates. "Cash only, Professor." You have <b>$${G.bucks}</b>.</p>`;
                h += '<div class="section-label">Cards</div><div class="items">';
                h += o.cards.map((c, i) => this._cardItem(c, { t: 'buy', what: 'card', i }, `<span class="px">${c.sold ? 'Sold' : '$' + c.price}</span>`, c.sold || G.bucks < c.price)).join('');
                h += '</div><div class="section-label">Gadget and souvenir</div><div class="items">';
                if (o.gadget) {
                    if (o.gadget.sold || G.gadgets.length < GADGET_SLOTS || G.bucks < o.gadget.price) h += this._gadgetItem(o.gadget.k, { t: 'buy', what: 'gadget' }, `<span class="px">${o.gadget.sold ? 'Sold' : '$' + o.gadget.price}</span>`, o.gadget.sold || G.bucks < o.gadget.price);
                    else h += `<div>${this._gadgetItem(o.gadget.k, null, `<span class="px">$${o.gadget.price}</span>`)}<div class="slots">${G.gadgets.map((g, i) => `<button class="btn" data-cmd='${esc(JSON.stringify({ t: 'buy', what: 'gadget', slot: i }))}'>Swap for ${esc(GADGETS[g].name)}</button>`).join('')}</div></div>`;
                }
                if (o.relic) h += this._relicItem(o.relic.k, { t: 'buy', what: 'relic' }, `<span class="px">${o.relic.sold ? 'Sold' : '$' + o.relic.price}</span>`, o.relic.sold || G.bucks < o.relic.price);
                const canRem = !o.removeUsed && G.bucks >= G.removePrice && canRemove(G);
                h += `<button class="item" data-cmd='{"t":"buy","what":"remove"}'${canRem ? '' : ' disabled'}><span class="nm">Card Disposal</span><span class="tx">Remove a card from your deck for good.${canRemove(G) ? '' : ' (Your deck is as small as it gets.)'}</span><span class="px">${o.removeUsed ? 'Used' : '$' + G.removePrice}</span></button>`;
                h += `</div><div class="sheet-foot"><button class="btn primary" data-cmd='{"t":"done"}'>Leave the store</button></div>`;
                return h;
            }
            case 'rest': {
                const heal = Math.min(G.maxHp - G.hp, Math.round(G.maxHp * REST_HEAL));
                const can = G.deck.some(upgradable);
                return `<h2>The Roadside Diner</h2><p>Neon in the window, pie under glass, a jukebox playing something about a Martian. You have <b>${G.hp}/${G.maxHp}</b> HP.</p>
                    <div class="items">
                        <button class="item" data-cmd='{"t":"rest","what":"heal"}'><span class="nm">Blue-Plate Special</span><span class="tx">Eat and rest: heal ${heal} HP.</span></button>
                        <button class="item" data-cmd='{"t":"rest","what":"upgrade"}'${can ? '' : ' disabled'}><span class="nm">Tinker in a Booth</span><span class="tx">Upgrade one card in your deck.</span></button>
                    </div>`;
            }
            case 'event': {
                const ev = EVENTS[o.k];
                let h = `<h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>`;
                if (o.chosen < 0) {
                    h += '<div class="menu">' + ev.options.map((opt, i) => `<button class="btn" data-cmd='${esc(JSON.stringify({ t: 'choose', i }))}'${optionOk(G, opt) ? '' : ' disabled'}>${esc(opt.label)}</button>`).join('') + '</div>';
                } else {
                    h += `<p class="result">${esc(o.result)}</p>`;
                    if (o.gadget && !o.gadgetTaken) h += `<div class="items">${this._gadgetTake(G, o.gadget, { t: 'take', what: 'gadget' })}</div>`;
                    h += `<div class="sheet-foot"><button class="btn primary" data-cmd='{"t":"done"}'>Drive on</button></div>`;
                }
                return h;
            }
        }
        return '';
    }

    _pickHtml(G) {
        const p = G.pick;
        const up = p.why === 'upgrade';
        const list = G.deck.filter((c) => (up ? upgradable(c) : true));
        let h = `<h2>${up ? 'Upgrade a card' : 'Remove a card'}</h2><p>${up ? 'Pick a card to improve. Its new text is shown.' : `Pick a card to take out of your deck for good${p.cost ? ` ($${p.cost})` : ''}.`}</p><div class="items">`;
        h += list.map((c) => this._cardItem(up ? { ...c, up: true } : c, { t: 'pick', uid: c.uid }, up ? `<span class="px">was: ${esc(cardText(c))}</span>` : '')).join('');
        h += '</div>';
        if (!p.locked) h += `<div class="sheet-foot"><button class="btn" data-cmd='{"t":"pick","uid":null}'>Never mind</button></div>`;
        return h;
    }

    // ------------------------------------------------------------------ the end
    showOver(G, best) {
        $('over-head').textContent = G.won ? 'THE END... OR IS IT?' : 'THE END';
        const foe = G.battle ? ENEMIES[G.battle.key].name : 'the aliens';
        $('over-text').textContent = G.won ? REELS[2].outro : `${foe} won the hand, and Earth with it. The projector clatters to a stop on Reel ${G.act + 1}.`;
        const s = G.stats;
        const rows = [['Score', score(G)], ['Best score', best.score], ['Stops travelled', s.floors], ['Creatures beaten', s.fights + s.elites + s.bosses], ['Longest chain', s.bestChain], ['Clean Sweeps', s.sweeps], ['Damage dealt', s.dmg], ['Cards in deck', G.deck.length]];
        $('over-stats').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
        this.openScreen('over');
    }
}
