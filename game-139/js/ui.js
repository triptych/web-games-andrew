// The DOM layer: the phase screens (letters, after a night, the day, interludes, the endings), overlays (story,
// deck, pause, settings, how to play), the night's HUD and toasts. Reads the sim; changes it only by handing
// commands to main.js through onCmd.

import { VERSION, RUN } from './config.js';
import { CARDS, SUITS, RANK_LABEL, cardText } from './sim/data/cards.js';
import { RIVALS, ACTS } from './sim/data/rivals.js';
import { ROOMS, INTERLUDES, NARRATOR, ENDINGS } from './sim/data/inn.js';
import { priceOf, def } from './sim/game.js';
import { ROOT } from './media.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PHASE_SCREEN = { letters: 'letters', won: 'won', day: 'day', interlude: 'interlude', over: 'over', ending: 'ending' };

const INTENT_TEXT = {
    hit: (i) => `⚔ Strikes for ${i.n}`,
    grudge: (i) => `✶ Adds ${i.n} Grudge${i.n > 1 ? 's' : ''} to your deck`,
    lock: (i) => `⛓ Locks ${i.n} open card${i.n > 1 ? 's' : ''}`,
    muddle: (i) => `↻ Reshuffles ${i.n} open card${i.n > 1 ? 's' : ''}`,
    drain: (i) => `◆ Takes ${i.n} tips`,
    fluster: () => '✋ Flusters you: one card fewer',
    restock: (i) => `↩ Deals ${i.n} card${i.n > 1 ? 's' : ''} back`,
};
export const intentText = (i) => (i ? INTENT_TEXT[i.t](i) : '');

/** A small DOM card for lists (market, deck, offers). */
export function miniCard(id, up = false, { tag = 'div', extra = '', cls = '' } = {}) {
    const d = CARDS[id], S = SUITS[d.suit];
    const art = d.partner ? `art/rival-${d.partner}.webp` : `art/card-${d.id}.webp`;
    const label = d.trick ? '⚔' : d.junk ? '✶' : RANK_LABEL[d.rank];
    return `<${tag} class="mini ${up ? 'up' : ''} ${cls}" style="--c:${S.color}" ${tag === 'button' ? 'type="button"' : ''}>`
        + `<span class="rank">${label}</span><img src="${ROOT}${art}" alt="" loading="lazy">`
        + `<span class="nm">${esc(d.name)}${up ? ' +' : ''}</span><span class="tx">${esc(cardText(d, up))}</span>${extra}</${tag}>`;
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onCmd }) {
        this.audio = audio;
        this.settings = settings;
        this.onCmd = onCmd;
        this.stack = [];                   // open overlays, top last
        this.phaseShown = null;
        this.storyQ = [];
        this.deckMode = null;              // null | 'polish' | 'letgo'
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('click'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), nar = $('set-narrator');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; nar.value = settings.narrator;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, narrator: nar.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, nar]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved run deleted.'); });

        $('story-ok').addEventListener('click', () => { audio.ui('click'); this.nextStory(); });
        $('won-partner').addEventListener('click', () => this.onCmd({ t: 'partner' }));
        $('won-farewell').addEventListener('click', () => this.onCmd({ t: 'farewell' }));
        $('day-open').addEventListener('click', () => this.onCmd({ t: 'leave' }));
        $('day-deck').addEventListener('click', () => this.openDeck(this.G));
        $('letters-deck').addEventListener('click', () => this.openDeck(this.G));
        $('chores').addEventListener('click', (e) => {
            const b = e.target.closest('[data-chore]');
            if (!b || b.disabled) return;
            const kind = b.dataset.chore;
            if (kind === 'rest') this.onCmd({ t: 'chore', kind });
            else this.openDeck(this.G, kind);
        });
        $('market').addEventListener('click', (e) => {
            const b = e.target.closest('[data-i]');
            if (b) this.onCmd({ t: 'buy', i: +b.dataset.i });
        });
        $('room-offer').addEventListener('click', (e) => { if (e.target.closest('button')) this.onCmd({ t: 'room' }); });
        $('deck-list').addEventListener('click', (e) => {
            const b = e.target.closest('[data-uid]');
            if (!b || !this.deckMode) return;
            const kind = this.deckMode;
            this.deckMode = null;
            this.closeScreen('deck');
            this.onCmd({ t: 'chore', kind, uid: b.dataset.uid });
        });
        $('letters-list').addEventListener('click', (e) => {
            const b = e.target.closest('[data-rival]');
            if (b) this.onCmd({ t: 'host', id: b.dataset.rival });
        });
        $('interlude-menu').addEventListener('click', (e) => {
            const b = e.target.closest('[data-i]');
            if (b) this.onCmd({ t: 'choose', i: +b.dataset.i });
        });
    }

    // ------------------------------------------------------------------ overlays
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 70 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        else if (this.phaseShown) this.focusFirst(this.phaseShown);
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyOverlay() { return this.stack.length > 0; }
    /** The screen keys should go to: the top overlay, else the phase screen. */
    active() { return this.top() || this.phaseShown; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) {
        const list = this.buttons(id);
        (list.find((b) => b.classList.contains('primary')) || list[0])?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const id = this.active();
        if (!id) return;
        const list = this.buttons(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ story (who says what)
    story(items) { this.storyQ.push(...items); if (this.top() !== 'story') this.nextStory(); }
    nextStory() {
        const s = this.storyQ.shift();
        if (!s) { this.audio.shutUp(); this.closeScreen('story'); return; }
        $('story-portrait').src = s.portrait ? ROOT + s.portrait : ROOT + 'art/title.webp';
        $('story-who').innerHTML = s.who;
        $('story-text').textContent = s.text;
        $('story-ok').textContent = this.storyQ.length ? 'Go on' : (s.ok || 'Continue');
        this.openScreen('story');
        this.storyNow = s;
        // the clips decode after the first gesture: a line asked for before then plays once they're in
        if (s.voice && !this.audio.say(s.voice, { force: true })) this.audio.loading?.then(() => { if (this.storyNow === s && this.storyOpen()) this.audio.say(s.voice, { force: true }); });
    }
    storyOpen() { return this.top() === 'story'; }

    // ------------------------------------------------------------------ phases
    /** Show the screen for G's phase (and rebuild it when the state changed). */
    sync(G, dirty) {
        this.G = G;
        const want = G ? PHASE_SCREEN[G.phase] || null : null;
        if (want !== this.phaseShown) {
            if (this.phaseShown) $(this.phaseShown).hidden = true;
            this.phaseShown = want;
            dirty = true;
        }
        if (!want || !dirty) return;
        this['build_' + want](G);
        $(want).hidden = false;
        if (!this.anyOverlay()) this.focusFirst(want);
    }
    hidePhase() { if (this.phaseShown) $(this.phaseShown).hidden = true; this.phaseShown = null; }

    runStrip(G) {
        return `<span>♥ Resolve <b>${G.resolve}/${G.maxResolve}</b></span><span>◆ Tips <b>${G.tips}</b></span>`
            + `<span>⚔ Notoriety <b>${G.notoriety}</b></span><span>Deck <b>${G.deck.length}</b></span>`
            + `<span>Staff <b>${G.partners.length}</b></span>${G.rooms.length ? `<span>Rooms <b>${G.rooms.map((r) => ROOMS[r].name).join(', ')}</b></span>` : ''}`;
    }

    build_letters(G) {
        const A = ACTS[G.act];
        $('letters-head').textContent = G.night >= 3 ? `${A.name}: one letter, sealed in black` : `${A.name}, night ${G.night + 1}: tonight's letters`;
        $('letters-list').innerHTML = G.letters.map((id) => {
            const R = RIVALS[id];
            const tags = [];
            if (R.boss) tags.push('Boss');
            if (R.traits.taint) tags.push(`${R.traits.taint} tainted ☠`);
            if (R.traits.bounty) tags.push(`${R.traits.bounty} bounties ◆`);
            if (R.traits.warrant) tags.push('Blades cost Resolve');
            if (R.weights !== 'flat') tags.push({ high: 'High cards', low: 'Low cards', twins: 'Sixes and sevens' }[R.weights]);
            tags.push(R.final ? 'Will not stay' : `Trusts ${R.trust} blade${R.trust === 1 ? '' : 's'}`);
            return `<button class="letter" data-rival="${id}"><img src="${ROOT}art/rival-${id}.webp" alt="">`
                + `<span><b>${esc(R.name)}</b><span class="who">${esc(R.title)}</span>`
                + `<span class="txt">“${esc(R.letter)}”</span><span class="tags">${tags.join(' · ')}</span></span></button>`;
        }).join('');
        $('run-strip').innerHTML = this.runStrip(G);
    }

    build_won(G) {
        const W = G.won, R = RIVALS[W.rival];
        $('won-portrait').src = ROOT + `art/rival-${R.id}.webp`;
        $('won-who').innerHTML = `${esc(R.name)}<small>${esc(R.title)}</small>`;
        $('won-text').textContent = `“${R.lines.cleared}”`;
        const partner = $('won-partner');
        if (!R.partner) {
            $('won-offer').textContent = 'Some people only came to say goodbye.';
            $('won-card').innerHTML = '';
            partner.hidden = true;
        } else if (W.canPartner) {
            $('won-offer').textContent = `Won in ${W.rounds} round${W.rounds > 1 ? 's' : ''}, with ${W.blades ? W.blades + ' blade' + (W.blades > 1 ? 's' : '') : 'no blades'}. Offer them a room and they join your staff:`;
            $('won-card').innerHTML = miniCard(R.partner);
            partner.hidden = false; partner.disabled = false;
        } else {
            $('won-offer').textContent = `“${R.lines.refuse}” (You used ${W.blades} blade${W.blades > 1 ? 's' : ''}; they trust ${R.trust}.)`;
            $('won-card').innerHTML = '';
            partner.hidden = true;
        }
        $('won-farewell').innerHTML = `See them out <small>+${RUN.farewell.tips} tips, heal ${RUN.farewell.heal}</small>`;
    }

    build_day(G) {
        const D = G.day;
        $('day-head').textContent = `${ACTS[G.act].name}: morning at the inn`;
        $('day-stats').innerHTML = this.runStrip(G);
        $('market').innerHTML = D.offers.map((id, i) => {
            if (!id) return '<div class="mini sold"><span class="nm">Sold</span></div>';
            const p = priceOf(G, id);
            return miniCard(id, false, { tag: 'button', cls: G.tips < p ? 'cant' : '', extra: `<span class="price">◆ ${p}</span>` }).replace('<button', `<button data-i="${i}"`);
        }).join('');
        const R = D.room && ROOMS[D.room];
        $('room-offer').innerHTML = R ? `<div class="room"><span><b>${esc(R.name)}</b><br><small>${esc(R.text)}</small></span>`
            + `<button class="btn ${G.tips >= R.price ? 'primary' : ''}" ${G.tips >= R.price ? '' : 'disabled'}>Build ◆ ${R.price}</button></div>` : '';
        for (const b of document.querySelectorAll('#chores [data-chore]')) {
            b.disabled = !!D.chore || (b.dataset.chore === 'letgo' && G.deck.length <= RUN.minDeck);
            b.classList.toggle('done', D.chore === b.dataset.chore);
        }
    }

    build_interlude(G) {
        const X = INTERLUDES.find((x) => x.id === G.interlude);
        $('interlude-text').textContent = X.text;
        $('interlude-menu').innerHTML = X.options.map((o, i) => `<button class="btn" data-i="${i}">${esc(o.label)}</button>`).join('');
    }

    build_over(G) {
        $('over-text').textContent = NARRATOR.over;
        $('over-stats').innerHTML = this.runStrip(G) + `<span>Nights won <b>${G.stats.nights}</b></span>`;
    }

    build_ending(G) {
        const E = ENDINGS[G.ending];
        $('ending-head').textContent = E.title;
        $('ending-text').textContent = E.text;
        $('ending-narrator').textContent = NARRATOR[G.ending];
        $('ending-stats').innerHTML = this.runStrip(G) + `<span>Nights won <b>${G.stats.nights}</b></span><span>Blades used <b>${G.stats.blades}</b></span>`;
    }

    // ------------------------------------------------------------------ deck
    openDeck(G, mode = null) {
        if (!G) return;
        this.deckMode = mode;
        const F = G.fight && G.phase === 'night' ? G.fight : null;
        $('deck-head').textContent = mode === 'polish' ? 'Polish which card?' : mode === 'letgo' ? 'Let go of which card?' : 'Your deck';
        $('deck-note').textContent = mode === 'letgo' ? 'Gone for good. Letting go of a Blade also lowers Notoriety by 1.'
            : mode === 'polish' ? 'A polished card does a little more, for the rest of the run.'
                : F ? `Draw pile ${F.draw.length} · discard ${F.discard.length} · in hand ${F.hand.length}` : `${G.deck.length} cards`;
        const cards = [...G.deck].sort((a, b) => (def(a.id).suit + def(a.id).rank).localeCompare(def(b.id).suit + def(b.id).rank));
        $('deck-list').innerHTML = cards.map((c) => {
            const can = mode === 'polish' ? !c.up && !def(c.id).junk : mode === 'letgo';
            return mode && can ? miniCard(c.id, c.up, { tag: 'button' }).replace('<button', `<button data-uid="${c.uid}"`) : miniCard(c.id, c.up, { cls: mode ? 'sold' : '' });
        }).join('');
        this.openScreen('deck');
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; }
    hud(G, { hint = '', pour = false } = {}) {
        const F = G.fight;
        const r = $('hud-resolve');
        r.querySelector('b').textContent = G.resolve;
        r.querySelector('i').style.width = `${(100 * G.resolve) / G.maxResolve}%`;
        $('hud-composure').querySelector('b').textContent = F ? F.composure : 0;
        $('hud-tips').querySelector('b').textContent = G.tips;
        $('hud-notoriety').querySelector('b').textContent = G.notoriety;
        if (F) {
            const R = RIVALS[F.rival];
            $('rival-name').innerHTML = `${esc(R.name)} <small>· round ${F.round}</small>`;
            const it = F.intent;
            let t = intentText(it);
            if (it?.t === 'hit') {
                const net = Math.max(0, it.n - F.soothe);
                const soak = Math.min(F.composure, net);
                t = `⚔ Strikes for ${net}${soak ? ` (${soak} soaked)` : ''}`;
            }
            $('rival-intent').textContent = 'Next: ' + t;
            $('pile-count').textContent = `(${F.draw.length} left)`;
            $('btn-pour').classList.toggle('on', pour);
            $('btn-pour').disabled = F.pours >= RUN.pours + (G.rooms.includes('garden') ? 1 : 0);
        }
        if ($('hint').textContent !== hint) $('hint').textContent = hint;
    }
    flashHurt() {
        const f = $('hurt-flash');
        f.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    }
    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3300);
    }

    /** Events the DOM answers: toasts, the hurt flash, story beats. */
    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'intro': this.story([
                    { who: 'The Narrator', text: NARRATOR.intro, voice: 'narrator-intro', portrait: 'art/title.webp' },
                    { who: 'The Narrator', text: NARRATOR.tutorial, voice: 'narrator-tutorial', portrait: 'art/title.webp', ok: 'Read the letters' },
                ]); break;
                case 'arrive': {
                    const R = RIVALS[e.rival];
                    const items = [];
                    if (R.final) items.push({ who: 'The Narrator', text: NARRATOR.thorn, voice: 'narrator-thorn', portrait: 'art/title.webp' });
                    items.push({ who: `${esc(R.name)}<small>${esc(R.title)}</small>`, text: `“${R.lines.arrive}”`, voice: `${R.id}-arrive`, portrait: `art/rival-${R.id}.webp`, ok: 'Deal the cards' });
                    this.story(items);
                    break;
                }
                case 'hurt': if (e.why === 'hit') this.flashHurt(); else this.toast(e.why === 'taint' ? `Tainted! −${e.n} Resolve` : e.why === 'grudge' ? `You dwell on a grudge. −${e.n}` : `The Watch saw that. −${e.n}`); break;
                case 'clean': this.toast(`Clean pair! +${e.n} Composure`); break;
                case 'bounty': this.toast(`Bounty collected: +${RUN.bounty} tips`); break;
                case 'grudge': this.toast(`${e.n} Grudge${e.n > 1 ? 's' : ''} shuffled into your deck`); break;
                case 'drain': if (e.n) this.toast(`They pocket ${e.n} of your tips`); break;
                case 'fluster': this.toast('Flustered: one card fewer next round'); break;
                case 'muddle': this.toast('The cards shift…'); break;
                case 'restock': this.toast('More of their past comes back to the table'); break;
                case 'blade': if (e.first) this.toast(NARRATOR.blade, 'narrator'); break;
                case 'partner': this.toast(NARRATOR.partner, 'narrator'); break;
                case 'farewell': if (e.refused) this.toast(NARRATOR.refuse, 'narrator'); break;
                case 'act': this.story([{ who: 'The Narrator', text: NARRATOR['act' + e.act], portrait: 'art/title.webp' }]); break;
                case 'bought': this.toast(`${CARDS[e.card].name} joins the staff`); break;
                case 'built': this.toast(`${ROOMS[e.room].name} is open`); break;
                case 'polish': this.toast(`${CARDS[e.card].name} polished`); break;
                case 'letgo': this.toast(e.blade ? `You let ${CARDS[e.card].name} go. It feels lighter.` : `${CARDS[e.card].name} let go`); break;
                case 'chose': this.toast(e.result, 'narrator'); break;
                case 'gain': this.toast(`${CARDS[e.card].name} added to your deck`); break;
            }
        }
    }
}
