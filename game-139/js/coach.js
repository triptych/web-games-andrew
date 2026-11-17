// The tutorial and the one-time tips. Not a sim module: it reads G, never changes it, and remembers what the player
// has already been told in the (guarded) settings. Nothing here blocks play: the coach is a small panel at the top of
// the table, and every step that asks for an action moves on when the player does it, however they get there.
//
// The first night walks through five steps (the open cards, a suggested pair that glows on the table, the rival's
// intent, pouring out and ending the round, winning and Blades). After that, a short tip appears the first time
// something new shows up (a Blade in hand, a Grudge, taint, a bounty, a lock, your own King), and the letters, the
// partnership screen and the first day each carry one line of explanation the first time.

import { RIVALS } from './sim/data/rivals.js';
import { RANK_LABEL, CARDS } from './sim/data/cards.js';
import { suggestPair } from './sim/hints.js';
import { cardInfo, exposed } from './sim/game.js';
import { intentText } from './ui.js';

const $ = (id) => document.getElementById(id);
const R_ = (r) => RANK_LABEL[r];

const STEPS = [
    {
        id: 'table', next: true,
        text: (G) => `${RIVALS[G.fight.rival].name} has dealt their past onto your table. Only the open cards can be played: the lit front row. A card opens when both cards in front of it are gone.`,
    },
    { id: 'pair', wait: ['settle'], text: (G) => pairText(G) },
    {
        id: 'intent', next: true,
        text: (G) => `At the top: what they'll do when you end the round (${intentText(G.fight.intent).replace(/^\S+ /, '').toLowerCase()}). ⛨ Composure, from food and drink cards, soaks a blow. ♥ Resolve is your health for the whole run.`,
    },
    {
        id: 'end', wait: ['round', 'cleared'],
        text: () => 'Keep pairing: every settled card pays ◆ tips. When you run out, Pour one out swaps one card (once a round). Then press End round and they make their move.',
    },
    {
        id: 'win', next: true, last: true,
        text: () => 'Clear the whole pyramid to win the night. Kings go alone. The red ⚔ cards are Blades: fast, but each one raises Notoriety, and a rival who sees too many won\'t join you. That\'s everything. Good luck, innkeeper.',
    },
];

function pairText(G) {
    const s = suggestPair(G);
    const F = G.fight;
    if (!s) return 'No pair in this hand. That happens: Pour one out swaps a card, or End round to draw a fresh hand.';
    if (s.kind === 'king') return 'Their King settles on its own: tap it.';
    if (s.kind === 'rival') {
        const [a, b] = s.slots.map((id) => R_(F.slots[id].rank));
        return `Two of their open cards can pair, but only to exactly 13: tap their ${a}, then their ${b}.`;
    }
    const ci = cardInfo(F, s.hand);
    const r = F.slots[s.slots[0]].rank;
    if (ci.fx.wild) return `${ci.d.name} pairs with anything: tap it, then their ${R_(r)}.`;
    return `Tap your ${ci.d.name} (${R_(ci.rank)}), then their ${R_(r)}: ${ci.rank} + ${r} = ${s.sum}. With your own cards 12, 13 or 14 all count; an exact 13 is a Clean pair (+1 Composure).`;
}

/** Night tips: shown once each, the first time their condition holds (after the tutorial). */
const TIPS = [
    { id: 'blade', when: (G, F) => F.hand.some((u) => CARDS[F.cards[u].id].suit === 'blade' && !CARDS[F.cards[u].id].trick), text: 'A red ⚔ card is a Blade: your old life. It pairs like any card, but each one used adds 1 Notoriety (every 4 makes all blows 1 harder) and spends this rival\'s trust.' },
    { id: 'trick', when: (G, F) => F.hand.some((u) => CARDS[F.cards[u].id].trick), text: 'Old Habit (and Hidden Blade) settle any open card alone: tap it, then the card. Quick, and still a Blade.' },
    { id: 'grudge', when: (G, F) => F.hand.some((u) => CARDS[F.cards[u].id].junk), text: '✶ A Grudge pairs with nothing and hurts 1 if you still hold it when the round ends. Pour it out and it\'s gone for the night.' },
    { id: 'king', when: (G, F) => F.hand.some((u) => cardInfo(F, u).rank === 13 && !CARDS[F.cards[u].id].trick), text: 'Your own King plays alone: tap it twice for its effect.' },
    { id: 'taint', when: (G, F) => F.slots.some((s) => s.taint && !s.gone && s.up), text: '☠ A tainted card hurts 2 Resolve when you settle it, unless you pair it with a Hearth card (the orange ♥ ones).' },
    { id: 'bounty', when: (G, F) => F.slots.some((s) => s.bounty && !s.gone && s.up), text: '◆ A bounty card pays 3 extra tips when you settle it.' },
    { id: 'lock', when: (G, F) => F.slots.some((s) => s.lock), text: 'Locked cards (tinted blue) can\'t be used until the rival\'s next turn. A Skeleton Key unlocks them.' },
];

const PHASE_TIPS = {
    letters: 'Choose tonight\'s visitor. Each letter says what they bring (☠ taint, ◆ bounties…) and how many Blades they\'ll forgive: win within their trust and you can offer them a room.',
    won: 'Offer a room and their card joins your deck for the rest of the run. Or see them out for tips and a little Resolve.',
    day: 'Morning. Spend ◆ tips on new staff (cards) or a room (an upgrade for the whole run), then do one chore. Letting go of a weak card or a Blade makes your best cards come up more often.',
};

export class Coach {
    constructor({ settings, save, audio }) {
        this.settings = settings;
        this.save = save;
        this.audio = audio;
        this.step = -1;            // index into STEPS while the tutorial runs
        this.tip = null;           // the night tip on show
        this.guide = new Set();    // table cards to glow ('s<slot>', 'h<uid>')
        this.lastPhase = null;
        this.shown = '';
        settings.tips = Array.isArray(settings.tips) ? [...settings.tips] : [];   // never the shared default array
        $('coach-next').addEventListener('click', () => { audio.ui('click'); this.advance(); });
        $('coach-skip').addEventListener('click', () => { audio.ui('click'); this.finish(); });
    }

    get on() { return this.settings.tutorial !== 'off'; }
    get active() { return this.step >= 0; }
    seen(id) { return this.settings.tips.includes(id); }
    mark(id) { if (!this.seen(id)) { this.settings.tips.push(id); this.save(this.settings); } }

    /** Start the first-night walkthrough (once per player, unless replayed from Settings). */
    maybeStart(G) {
        if (!this.on || this.settings.tutorialDone || this.active || G?.phase !== 'night') return;
        this.step = 0;
    }
    advance() {
        if (this.tip) { this.mark(this.tip.id); this.tip = null; return; }
        if (!this.active) return;
        if (STEPS[this.step].last) { this.finish(); return; }
        this.step++;
    }
    finish() {
        this.step = -1; this.tip = null;
        this.settings.tutorialDone = true;
        this.save(this.settings);
    }
    replay() { this.settings.tutorialDone = false; this.settings.tips = []; this.save(this.settings); }

    onEvents(G, events) {
        if (!this.active) return;
        const s = STEPS[this.step];
        if (s.wait && events.some((e) => s.wait.includes(e.type))) this.step++;
        if (events.some((e) => e.type === 'cleared' || e.type === 'over')) this.finish();   // won the first night before the end
    }

    /** The one-line explanation for a phase screen the first time it shows (or ''). */
    phaseTip(phase) { return this.on && PHASE_TIPS[phase] && !this.seen('phase-' + phase) ? PHASE_TIPS[phase] : ''; }

    /** Every frame: which panel to show, and which cards to glow. night = the table is in play with nothing on top. */
    update(G, night) {
        const phase = G?.phase || null;
        if (phase !== this.lastPhase) {
            if (this.lastPhase && PHASE_TIPS[this.lastPhase] && this.on) this.mark('phase-' + this.lastPhase);
            this.lastPhase = phase;
        }
        this.guide.clear();
        let panel = null;
        if (night) {
            this.maybeStart(G);
            if (this.active) {
                const s = STEPS[this.step];
                panel = { label: `Tutorial ${this.step + 1}/${STEPS.length}`, text: s.text(G), next: !!s.next, nextLabel: s.last ? 'Got it' : 'Next', skip: true };
                if (s.id === 'pair') this.guideFor(G);
            } else if (this.on) {
                if (!this.tip) this.tip = TIPS.find((t) => !this.seen(t.id) && t.when(G, G.fight)) || null;
                if (this.tip) panel = { label: 'Tip', text: this.tip.text, next: true, nextLabel: 'Got it', skip: false };
            }
        }
        this.render(panel);
    }

    guideFor(G) {
        const s = suggestPair(G);
        if (!s) return;
        if (s.hand) this.guide.add('h' + s.hand);
        for (const id of s.slots) if (exposed(G.fight, id)) this.guide.add('s' + id);
    }

    render(panel) {
        const key = panel ? panel.label + panel.text + panel.next : '';
        if (key === this.shown) return;
        this.shown = key;
        const el = $('coach');
        el.hidden = !panel;
        if (!panel) return;
        $('coach-label').textContent = panel.label;
        $('coach-text').textContent = panel.text;
        $('coach-next').hidden = !panel.next;
        $('coach-next').textContent = panel.nextLabel;
        $('coach-skip').hidden = !panel.skip;
        $('coach-wait').hidden = panel.next;
    }
}
