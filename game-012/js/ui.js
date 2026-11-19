// DOM screens: the parlour (hub), the Well and its reveal, the Grimoire and a card's page, charms, the battle result,
// the Reading, the endings, subtitles and toasts. It reads G and calls cmd(); it never changes G itself.

import { CARDS, CARD_IDS, SUIT_INFO, ELEMENTS, RARITIES, RARITY_ORDER } from './sim/data/cards.js';
import { ENEMIES } from './sim/data/enemies.js';
import { ITEMS } from './sim/data/omens.js';
import { LINES, speaker } from './sim/data/lines.js';
import { cardStats } from './sim/battle.js';
import { trialOf, battleMods, canStarUp, starCost, omenFor, legendaryRate } from './sim/game.js';
import { PITY, PULL_COST, TEN_COST, MAX_STAR, PARTY_SIZE, TRIAL_COUNT, LIVES } from './config.js';
import { cardEl, foeEl, backEl, elGlyph } from './view/cards.js';
import { ART, ROOT } from './media.js';

const $ = (id) => document.getElementById(id);
const SLOT_NAMES = ['Front', 'Second', 'Third', 'Back'];
const WHO = { oracle: 'The Oracle', world: 'The World' };

export class UI {
    constructor({ audio, cmd, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.cmd = cmd;
        this.settings = settings;
        this.onSettings = onSettings;
        this.onDeleteSave = onDeleteSave;
        this.G = null;
        this.stack = [];
        this.grimFilter = 'owned';
        this.pickSlot = -1;
        this.detailId = null;
        this.reveal = null;
        this.subT = null;
        this.wire();
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        const el = $(id);
        if (!el) return;
        el.hidden = false;
        if (!this.stack.includes(id)) this.stack.push(id);
        if (id === 'settings') this.fillSettings();
    }
    closeScreen(id) {
        const el = $(id);
        if (el) el.hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'grimoire') this.setPick(-1);
    }
    /** Close the topmost closable sheet; false if there is none. */
    closeTop() {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const id = this.stack[i];
            if (['grimoire', 'detail', 'charms', 'howto', 'settings', 'pause', 'well'].includes(id)) {
                if (id === 'well' && !$('reveal').hidden) return true;
                this.audio.ui('close');
                this.closeScreen(id);
                if (id === 'well' || id === 'grimoire' || id === 'detail' || id === 'charms') this.renderHub();
                return true;
            }
        }
        return false;
    }
    isOpen(id) { return !$(id).hidden; }
    anySheet() { return this.stack.some((s) => ['grimoire', 'detail', 'charms', 'howto', 'settings', 'pause', 'well', 'result'].includes(s)); }

    toast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        $('toasts').append(t);
        setTimeout(() => t.remove(), 2700);
        window.A11Y?.announce?.(msg);
    }

    /** Show a spoken line as a subtitle for as long as it plays (at least 3 s). */
    subtitle(id, secs) {
        if (this.settings.subtitles === 'off') return;
        const el = $('subtitle');
        const who = speaker(id);
        el.className = who;
        el.innerHTML = `<b>${WHO[who]}</b>${LINES[id]}`;
        el.hidden = false;
        clearTimeout(this.subT);
        this.subT = setTimeout(() => { el.hidden = true; }, Math.max(3, secs + 0.6) * 1000);
    }

    wire() {
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => {
                const s = b.closest('.screen');
                this.audio.ui('close');
                this.closeScreen(s.id);
                if (['well', 'grimoire', 'detail', 'charms'].includes(s.id)) this.renderHub();
                if (s.id === 'detail' && this.isOpen('grimoire')) this.renderGrimoire();
            });
        }
        $('grim-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-f]');
            if (!b) return;
            this.audio.ui();
            this.grimFilter = b.dataset.f;
            this.renderGrimoire();
        });
        $('btn-starup').addEventListener('click', () => { if (this.detailId) this.cmd({ t: 'starUp', id: this.detailId }); });
        $('btn-reveal-all').addEventListener('click', () => this.revealAll());
        $('btn-reveal-done').addEventListener('click', () => this.closeReveal());
        // settings
        const set = (k, v) => { this.settings[k] = v; this.onSettings(this.settings); };
        $('set-sfx').addEventListener('input', (e) => set('sfx', +e.target.value));
        $('set-music').addEventListener('input', (e) => set('music', +e.target.value));
        $('set-voice').addEventListener('input', (e) => set('voice', +e.target.value));
        $('set-subs').addEventListener('change', (e) => set('subtitles', e.target.value));
        $('set-motion').addEventListener('change', (e) => set('motion', e.target.value));
        $('set-delete').addEventListener('click', () => { this.onDeleteSave(); this.toast('Saved game deleted.'); });
    }
    fillSettings() {
        $('set-sfx').value = this.settings.sfx;
        $('set-music').value = this.settings.music;
        $('set-voice').value = this.settings.voice;
        $('set-subs').value = this.settings.subtitles;
        $('set-motion').value = this.settings.motion;
    }

    // ------------------------------------------------------------------ the parlour
    renderHub() {
        const G = this.G;
        if (!G) return;
        const tr = trialOf(G);
        $('hud-trial').textContent = `Threshold ${G.trial} / ${TRIAL_COUNT}`;
        $('hud-lives').textContent = '♥'.repeat(G.lives) + '♡'.repeat(Math.max(0, LIVES - G.lives));
        $('hud-lives').setAttribute('aria-label', `${G.lives} lives`);
        $('hud-asc').hidden = !G.asc;
        $('hud-asc').textContent = `Ascension ${G.asc}`;
        $('hud-dust').textContent = G.dust;
        $('hub-title').textContent = tr.name;
        $('hub-arcanum').textContent = `${tr.arcanum} reversed`;
        $('hub-blurb').textContent = tr.blurb;
        const foes = $('hub-foes');
        foes.innerHTML = '';
        for (const f of tr.foes) foes.append(foeEl(f));
        $('hub-hint').innerHTML = this.hint(tr);
        const om = $('hub-omen');
        om.hidden = !G.omen;
        if (G.omen) {
            om.className = 'omen-chip' + (G.omen.reversed ? ' curse' : '');
            om.innerHTML = `<b>${G.omen.reversed ? 'Curse' : 'Blessing'}: ${G.omen.name}</b> · ${G.omen.text} <span class="sub">(${G.omen.left} battle${G.omen.left === 1 ? '' : 's'} left)</span>`;
        }
        const party = $('hub-party');
        party.innerHTML = '';
        for (let s = 0; s < PARTY_SIZE; s++) {
            const id = G.party[s];
            const b = document.createElement('button');
            b.className = 'slot' + (this.pickSlot === s ? ' picking' : '');
            b.dataset.slot = s;
            b.setAttribute('aria-label', id ? `${SLOT_NAMES[s]}: ${CARDS[id].name}. Open its page.` : `${SLOT_NAMES[s]}: empty. Choose a card.`);
            if (id) b.append(cardEl(id, { star: G.owned[id].star, small: true }));
            else b.append(Object.assign(document.createElement('span'), { textContent: Object.keys(G.owned).length ? 'Tap to choose' : 'Draw at the Well' }));
            b.append(Object.assign(document.createElement('span'), { className: 'slot-label', textContent: SLOT_NAMES[s] }));
            b.addEventListener('click', () => this.slotClicked(s));
            party.append(b);
        }
        const res = battleMods(G).res;
        $('hub-reso').innerHTML = res.list.length
            ? res.list.map((r) => `<span style="border-color:${SUIT_INFO[r.suit].color}">${SUIT_INFO[r.suit].glyph} ${SUIT_INFO[r.suit].name}: ${r.text}</span>`).join('')
            : '<span class="sub">Two or more of one suit lend the whole spread a bonus.</span>';
        const stars = Object.keys(G.owned).filter((id) => canStarUp(G, id)).length;
        $('grim-badge').hidden = !stars;
        $('grim-badge').textContent = stars;
        $('charm-badge').hidden = !G.items.length;
        $('charm-badge').textContent = G.armed.length ? `${G.armed.length}/${G.items.length}` : G.items.length;
        $('btn-fight').disabled = !G.party.some(Boolean);
        // a new player's next step glows: the Well before the first draw, then the fight
        const fresh = !Object.keys(G.owned).length;
        $('btn-well').classList.toggle('pulse', fresh);
        $('btn-fight').classList.toggle('pulse', !fresh && G.stats.fights === 0);
        $('btn-auto').disabled = !Object.keys(G.owned).length;
    }

    hint(tr) {
        if (tr.el === 'spirit') return 'The World takes a new element as it weakens: <b>Fire</b>, then <b>Water</b>, then <b>Air</b>. A spread of mixed elements answers each.';
        const beater = Object.keys(ELEMENTS).find((e) => ELEMENTS[e].beats === tr.el);
        const weak = ELEMENTS[tr.el].beats;
        const suitOf = { fire: 'Wands', water: 'Cups', air: 'Swords', earth: 'Pentacles' };
        return `Their element is ${elGlyph(tr.el)} <b>${ELEMENTS[tr.el].name}</b>. ${ELEMENTS[beater].name} (${suitOf[beater]}) strikes them 35% harder; `
            + `${ELEMENTS[weak].name} (${suitOf[weak]}) takes more from them.`;
    }

    slotClicked(s) {
        const G = this.G;
        this.audio.ui();
        if (G.party[s]) { this.openDetail(G.party[s]); return; }
        if (!Object.keys(G.owned).length) { this.openWell(); return; }
        this.setPick(s);
        this.grimFilter = 'owned';
        this.openGrimoire();
    }
    setPick(s) {
        this.pickSlot = s;
        document.querySelectorAll('#hub-party .slot').forEach((el) => el.classList.toggle('picking', +el.dataset.slot === s));
    }

    // ------------------------------------------------------------------ the Well
    openWell() {
        this.renderWell();
        this.openScreen('well');
    }
    renderWell() {
        const G = this.G;
        const f = $('well-featured');
        f.innerHTML = '';
        f.append(cardEl(G.featured, { star: G.owned[G.featured]?.star }));
        const c = CARDS[G.featured];
        $('well-feat-text').textContent = `Half of all Legendary draws at this Threshold are ${c.name} (${ELEMENTS[c.el].name}). ${c.skill.name}: ${c.skill.text}`;
        const left = PITY - G.pity;
        $('well-pity').textContent = left;
        $('well-pity-bar').style.width = (100 * G.pity / PITY) + '%';
        $('well-dust').textContent = G.dust;
        $('btn-pull1').disabled = G.dust < PULL_COST;
        $('btn-pull10').disabled = G.dust < TEN_COST;
        const lr = legendaryRate(G);
        document.querySelector('#well .rates').innerHTML = `Common 52% · Uncommon 28% · Rare 13% · Epic 5% · <b class="legend-txt">Legendary ${lr >= 100 ? 'guaranteed' : lr + '%'}</b>`;
        if (G.omen?.pityFrozen) this.toast('Cursed: the Well forgets you. Pulls do not count toward the guarantee.');
    }

    /** The reveal: backs dealt face down, glowing by rarity; tap to turn, or Reveal all. */
    showReveal(cards) {
        const grid = $('reveal-grid');
        grid.innerHTML = '';
        grid.classList.toggle('one', cards.length === 1);
        this.reveal = { cards, open: 0, voiced: false };
        cards.forEach((g, k) => {
            const rv = document.createElement('button');
            rv.className = `rv glow-${g.rarity} r-${g.rarity}`;
            rv.style.animationDelay = (k * 0.06) + 's';
            rv.setAttribute('aria-label', 'A card, face down. Turn it over.');
            const inner = document.createElement('div');
            inner.className = 'rv-in';
            const bk = document.createElement('div'); bk.className = 'bk'; bk.append(backEl());
            const face = document.createElement('div'); face.className = 'face';
            face.append(cardEl(g.id, { star: this.G.owned[g.id]?.star }));
            inner.append(bk, face);
            rv.append(inner);
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.textContent = g.spare ? `+${g.spare} ✦` : g.dup ? '+1 copy' : 'New!';
            tag.style.color = RARITIES[g.rarity].color;
            rv.append(tag);
            rv.addEventListener('click', () => this.turn(rv, g));
            grid.append(rv);
        });
        $('reveal').hidden = false;
        $('btn-reveal-done').hidden = true;
        $('btn-reveal-all').hidden = false;
        this.audio.play('pull');
        setTimeout(() => grid.querySelector('.rv')?.focus(), 50);
    }
    turn(rv, g) {
        if (rv.classList.contains('open')) return;
        rv.classList.add('open');
        rv.setAttribute('aria-label', `${CARDS[g.id].name}, ${RARITIES[g.rarity].name}. ${rv.querySelector('.tag').textContent}`);
        this.audio.play('flip', { rate: 0.9 + Math.random() * 0.2 });
        const big = RARITY_ORDER.indexOf(g.rarity);
        this.audio.play(big >= 4 ? 'legend' : big >= 2 ? 'rare' : 'reveal', { delay: 0.15, gap: 0.12 });
        if (g.rarity === 'L' && !this.reveal.voiced) { this.reveal.voiced = true; setTimeout(() => this.audio.say('legendary'), 500); }
        this.reveal.open++;
        if (this.reveal.open >= this.reveal.cards.length) {
            $('btn-reveal-done').hidden = false;
            $('btn-reveal-all').hidden = true;
            setTimeout(() => $('btn-reveal-done').focus(), 300);
        }
    }
    revealAll() {
        const rvs = [...document.querySelectorAll('#reveal-grid .rv:not(.open)')];
        rvs.forEach((rv, k) => setTimeout(() => {
            const i = [...rv.parentNode.children].indexOf(rv);
            this.turn(rv, this.reveal.cards[i]);
        }, k * 110));
    }
    closeReveal() {
        $('reveal').hidden = true;
        this.audio.ui();
        this.renderWell();
        this.renderHub();
    }

    // ------------------------------------------------------------------ the Grimoire
    openGrimoire() {
        this.renderGrimoire();
        this.openScreen('grimoire');
    }
    renderGrimoire() {
        const G = this.G;
        const f = this.grimFilter;
        document.querySelectorAll('#grim-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.f === f ? 'true' : 'false'));
        $('grim-count').textContent = `${Object.keys(G.owned).length} / ${CARD_IDS.length}`;
        let ids = f === 'owned' ? Object.keys(G.owned) : CARD_IDS.filter((id) => CARDS[id].suit === f);
        if (f === 'owned') ids.sort((a, b) => RARITY_ORDER.indexOf(CARDS[b].rarity) - RARITY_ORDER.indexOf(CARDS[a].rarity) || CARD_IDS.indexOf(a) - CARD_IDS.indexOf(b));
        const grid = $('grim-grid');
        grid.innerHTML = '';
        if (!ids.length) grid.innerHTML = '<p class="note">No cards yet. Draw from the Well.</p>';
        for (const id of ids) {
            const o = G.owned[id];
            const b = document.createElement('button');
            b.className = 'gcell';
            b.dataset.id = id;
            b.append(cardEl(id, o ? { star: o.star } : { unknown: true }));
            if (o) {
                const at = G.party.indexOf(id);
                if (at >= 0) b.insertAdjacentHTML('beforeend', `<span class="inparty">${SLOT_NAMES[at]}</span>`);
                if (o.copies) b.insertAdjacentHTML('beforeend', `<span class="copies">×${o.copies}</span>`);
                if (canStarUp(G, id)) b.insertAdjacentHTML('beforeend', '<span class="canstar">★ up</span>');
                b.setAttribute('aria-label', `${CARDS[id].name}, ${o.star} stars${at >= 0 ? `, in the spread (${SLOT_NAMES[at]})` : ''}`);
                b.addEventListener('click', () => {
                    this.audio.ui();
                    if (this.pickSlot >= 0) {
                        const s = this.pickSlot;
                        this.cmd({ t: 'place', slot: s, id });
                        this.closeScreen('grimoire');
                        this.renderHub();
                        return;
                    }
                    this.openDetail(id);
                });
            } else {
                b.disabled = true;
                b.setAttribute('aria-label', 'Not yet drawn');
            }
            grid.append(b);
        }
    }

    openDetail(id) {
        this.detailId = id;
        this.renderDetail();
        this.openScreen('detail');
    }
    renderDetail() {
        const G = this.G, id = this.detailId;
        if (!id || !G.owned[id]) return;
        const c = CARDS[id], o = G.owned[id], st = cardStats(id, o.star);
        $('det-name').textContent = c.name;
        const dc = $('det-card');
        dc.innerHTML = '';
        dc.append(cardEl(id, { star: o.star }));
        $('det-tags').innerHTML = `<span style="color:${RARITIES[c.rarity].color}">${RARITIES[c.rarity].name}</span>`
            + `<span>${SUIT_INFO[c.suit].name} · ${SUIT_INFO[c.suit].role}</span>`
            + `<span style="color:${ELEMENTS[c.el].color}">${elGlyph(c.el)} ${ELEMENTS[c.el].name}</span>`;
        $('det-stats').innerHTML = `<div><b>${st.hp}</b>HP</div><div><b>${st.atk}</b>ATK</div><div><b>${st.spd}</b>SPD</div><div><b>${Math.round(st.def * 100)}</b>DEF</div>`;
        $('det-skill').textContent = c.skill.name;
        $('det-cost').textContent = `casts every ${c.skill.cost} actions`;
        $('det-skill-text').textContent = c.skill.text;
        const need = o.star < MAX_STAR ? starCost(G, id) : 0;
        $('det-starline').textContent = '★'.repeat(o.star) + '☆'.repeat(MAX_STAR - o.star) + (o.star < MAX_STAR ? `  · copies ${o.copies} / ${need}` : '  · fully risen');
        $('btn-starup').disabled = !canStarUp(G, id);
        const slots = $('det-slots');
        slots.innerHTML = '';
        for (let s = 0; s < PARTY_SIZE; s++) {
            const b = document.createElement('button');
            b.textContent = s + 1;
            b.title = SLOT_NAMES[s];
            b.setAttribute('aria-label', `Place in the ${SLOT_NAMES[s].toLowerCase()} slot`);
            if (G.party[s] === id) b.className = 'here';
            b.addEventListener('click', () => {
                this.audio.ui();
                this.cmd(G.party[s] === id ? { t: 'place', slot: s, id: null } : { t: 'place', slot: s, id });
                this.renderDetail();
                this.renderHub();
            });
            slots.append(b);
        }
    }

    // ------------------------------------------------------------------ charms
    openCharms() { this.renderCharms(); this.openScreen('charms'); }
    renderCharms() {
        const G = this.G;
        const list = $('charm-list');
        list.innerHTML = '';
        if (!G.items.length) list.innerHTML = '<p class="note">You hold no charms.</p>';
        G.items.forEach((it) => {
            const d = ITEMS[it];
            const armed = G.armed.includes(it);
            const row = document.createElement('div');
            row.className = 'charm';
            row.innerHTML = `<span class="g">${d.glyph}</span><span class="t"><b>${d.name}</b>${d.text}</span>`;
            const b = document.createElement('button');
            b.className = 'btn small' + (armed ? '' : ' gold');
            b.textContent = it === 'wheel_token' ? 'Use' : armed ? 'Disarm' : 'Arm';
            b.addEventListener('click', () => { this.audio.ui(); this.cmd({ t: armed ? 'disarm' : 'arm', item: it }); this.renderCharms(); this.renderHub(); });
            row.append(b);
            list.append(row);
        });
    }

    // ------------------------------------------------------------------ result
    showResult(r, G) {
        const s = document.querySelector('.result-sheet');
        s.classList.toggle('won', r.won);
        s.classList.toggle('lost', !r.won);
        $('res-title').textContent = r.won ? (r.trial === TRIAL_COUNT ? 'The World Falls' : 'Victory') : G.phase === 'over' ? 'The Last Candle' : 'Defeat';
        $('res-text').textContent = r.won
            ? `${trialOf(G).name} is yours, with ${r.survivors} card${r.survivors === 1 ? '' : 's'} standing.`
            : (r.timeout ? 'The candle burned out before either side fell. ' : 'Your spread has fallen. ') + (G.phase === 'over' ? 'It was your last life.' : `${r.lives} ${r.lives === 1 ? 'life remains' : 'lives remain'}; your cards are all still yours. Draw again, change the spread, try again.`);
        $('res-gain').innerHTML = `<span>✦ +${r.dust}</span>` + (r.won ? `<span>Score +${r.score}</span>` : `<span>♥ ${r.lives}</span>`);
        $('btn-res-next').textContent = r.won ? (r.trial === TRIAL_COUNT ? 'Onward' : 'Onward') : G.phase === 'over' ? 'Continue' : 'Back to the parlour';
        this.openScreen('result');
        setTimeout(() => $('btn-res-next').focus(), 60);
    }

    // ------------------------------------------------------------------ the Reading
    showReading(cards) {
        const row = $('reading-row');
        row.innerHTML = '';
        $('btn-reading-done').hidden = true;
        $('reading-note').textContent = 'Three cards wait upon the cloth. Choose one: upright it blesses the next three battles; reversed (three times in ten) it curses them.';
        cards.forEach((id, i) => {
            const o = omenFor(id);
            const b = document.createElement('button');
            b.className = 'rcard';
            b.dataset.i = i;
            b.append(cardEl(id, {}));
            b.insertAdjacentHTML('beforeend', `<div class="om up"><b>Upright · ${o.up.name}</b><br>${o.up.text}</div><div class="om down"><b>Reversed · ${o.down.name}</b><br>${o.down.text}</div>`);
            b.setAttribute('aria-label', `${CARDS[id].name}. Upright: ${o.up.name}, ${o.up.text} Reversed: ${o.down.name}, ${o.down.text}`);
            b.addEventListener('click', () => { this.audio.play('flip'); this.cmd({ t: 'pick', i }); });
            row.append(b);
        });
        this.openScreen('reading');
    }
    readingResult(e) {
        const row = $('reading-row');
        [...row.children].forEach((b) => {
            b.disabled = true;
            const chosen = b.querySelector('.card')?.dataset.id === e.card;
            b.classList.toggle('chosen', chosen);
            b.classList.toggle('faded', !chosen);
            if (chosen && e.reversed) b.classList.add('reversed');
        });
        $('reading-note').innerHTML = `<span class="reading-verdict">${e.reversed ? 'Reversed' : 'Upright'}: ${e.name}.</span><br>${e.text}${e.item ? ` You receive a ${ITEMS[e.item].name}.` : ''}`;
        $('btn-reading-done').hidden = false;
        setTimeout(() => $('btn-reading-done').focus(), 400);
    }

    // ------------------------------------------------------------------ endings
    showEnding(G) {
        $('end-title').textContent = G.asc ? `The World Is Whole (Ascension ${G.asc})` : 'The World Is Whole';
        $('end-stats').textContent = `Score ${G.score} · ${Object.keys(G.owned).length} of 78 cards drawn · ${G.stats.pulls} draws · ${G.stats.legendaries} Legendary · ${G.stats.losses} battle${G.stats.losses === 1 ? '' : 's'} lost.`;
        this.openScreen('ending');
    }
    showOver(G) {
        $('over-stats').textContent = `You reached Threshold ${G.trial} (${trialOf(G).name}). Score ${G.score} · ${Object.keys(G.owned).length} of 78 cards drawn · ${G.stats.pulls} draws.`;
        this.openScreen('over');
    }
}

export { ART, ROOT, ENEMIES };
