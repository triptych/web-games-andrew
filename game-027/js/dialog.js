/**
 * dialog.js — Character definitions, authored dialog scripts, and the
 * DialogRunner engine (game-plan §Phase 6).
 *
 * A "script" is an array of beats executed sequentially by DialogRunner.
 * Beat types:
 *   line    { speaker, portrait, text }         — advance on click/Space
 *   silent  { speaker, portrait, text: null }   — portrait-only, auto-advances
 *   choice  { choice: [{label, next}] }         — player picks a branch
 *   flag    { setFlag: key, value }             — stores a persistent flag
 *   end     { end: true }                       — closes VN panel
 *
 * DialogRunner emits events:
 *   dialogLineShown   { scriptId, speaker, text }
 *   dialogChoiceMade  { scriptId, choiceLabel, next }
 *   dialogEnded       { scriptId }
 */

import { events } from './events.js';
import { state }  from './state.js';

// ---------------------------------------------------------------------------
// Character definitions
// ---------------------------------------------------------------------------

export const CHARACTERS = {
    player: {
        id:      'player',
        name:    'The Apprentice',
        palette: { skin: [210, 175, 130], robe: [60, 80, 110], trim: [180, 150, 80] },
        states:  ['neutral', 'pleased', 'alarmed', 'determined'],
    },
    guildmaster: {
        id:      'guildmaster',
        name:    'Madame Voss',
        palette: { skin: [195, 155, 120], robe: [50, 40, 60], trim: [190, 160, 80], mono: [160, 130, 60] },
        states:  ['stern', 'pleased', 'alarmed', 'neutral'],
    },
    rival: {
        id:      'rival',
        name:    'Casimir',
        palette: { skin: [200, 165, 120], robe: [120, 50, 40], trim: [220, 180, 60] },
        states:  ['smug', 'neutral', 'alarmed', 'pleased'],
    },
    spirit: {
        id:      'spirit',
        name:    'The Lattice Spirit',
        palette: { body: [100, 160, 200], glow: [180, 220, 255], gem: [80, 200, 180] },
        states:  ['calm', 'curious', 'urgent', 'serene'],
    },
    vendor: {
        id:      'vendor',
        name:    'Pellerin',
        palette: { skin: [215, 175, 135], coat: [80, 110, 60], trim: [200, 160, 60] },
        states:  ['warm', 'pleased', 'curious', 'neutral'],
    },
};

// ---------------------------------------------------------------------------
// Authored dialog scripts
// ---------------------------------------------------------------------------

/**
 * Scripts are plain arrays of beat objects.
 * Use { id: 'label' } on a beat to make it a branch target.
 */
export const SCRIPTS = {

    // --- Chapter 1 intro (fires on a brand-new run, from SplashScene) --------
    'ch1-intro': [
        { speaker: 'guildmaster', portrait: 'stern',
          text: "So. You've finally arrived. I was beginning to think you'd gotten lost in the market." },
        { speaker: 'player', portrait: 'neutral', text: null },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "I am Madame Voss, Guild Master of the Alchemists' Assembly. You are here to earn your mark." },
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "This — " },
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "— is the Lattice. A working surface of extraordinary sensitivity. Elements placed upon it in the right formations will reveal what is hidden beneath." },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "Fill a complete row or column of the grid and it will *clear*, dissolving spent matter and stripping the cover from buried deposits." },
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "Harvest those deposits and bring the elements to your cauldron. It is how new tile-types are unlocked — and how you grow." },
        { choice: [
            { label: "Understood. I'm ready.", next: 'ready' },
            { label: "What if I run out of tiles?",  next: 'outoftime' },
        ]},
        { id: 'ready', speaker: 'guildmaster', portrait: 'pleased',
          text: "Good. Overconfidence and silence both serve you better than questions right now. Begin." },
        { end: true },

        { id: 'outoftime', speaker: 'guildmaster', portrait: 'alarmed',
          text: "Then the lattice is jammed, or the quest becomes impossible. The result is the same: failure. Try not to let it come to that." },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "Now. Begin." },
        { end: true },
    ],

    // --- First harvest (one-shot, fires from GameScene the first time you harvest) ---
    'ch1-first-harvest': [
        { speaker: 'spirit', portrait: 'calm',
          text: "..." },
        { speaker: 'spirit', portrait: 'curious',
          text: "You felt it, didn't you. The grid gave way." },
        { speaker: 'spirit', portrait: 'calm',
          text: "Every element buried here has waited. Patient. Unaware that the one who would finally clear the way would be..." },
        { speaker: 'spirit', portrait: 'curious',
          text: "Well. You." },
        { speaker: 'spirit', portrait: 'serene',
          text: "Take what you've found to your cauldron. It will know what to do with it." },
        { end: true },
    ],

    // --- Pre-boss (fires from ResultScene or map when approaching the boss) ---
    'ch1-boss-taunt': [
        { speaker: 'rival', portrait: 'smug',
          text: "Oh, still here? I assumed you'd quit. The guild does accept graceful withdrawals, you know." },
        { speaker: 'player', portrait: 'neutral', text: null },
        { speaker: 'rival', portrait: 'smug',
          text: "The Ember Warden. Lovely creature. Angry. Very much on fire." },
        { speaker: 'rival', portrait: 'neutral',
          text: "It occupies cells of the lattice. You will need to clear lines *over* it to deal damage. Your placement skill — such as it is — will be tested." },
        { choice: [
            { label: "Why are you helping me?", next: 'why' },
            { label: "I'll clear it in one run.",  next: 'confident' },
        ]},
        { id: 'why', speaker: 'rival', portrait: 'smug',
          text: "Helping? I'm observing. The guild keeps records. Someone has to document your embarrassment." },
        { speaker: 'rival', portrait: 'neutral',
          text: "Good luck." },
        { end: true },

        { id: 'confident', speaker: 'rival', portrait: 'alarmed',
          text: "...*One* run?" },
        { speaker: 'rival', portrait: 'smug',
          text: "Fine. Prove it. I'll be watching." },
        { end: true },
    ],

    // --- Boss cleared (fires after the Ember Warden is defeated) -------------
    'ch1-boss-clear': [
        { speaker: 'guildmaster', portrait: 'pleased',
          text: "The Ember Warden. Handled." },
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "I won't call it elegant. But it was *effective*, and the guild respects results." },
        { speaker: 'guildmaster', portrait: 'pleased',
          text: "Your cauldron is upgraded. A Tin crucible — it can now process uncommon elements. You'll find it opens new categories of tile-type entirely." },
        { speaker: 'player', portrait: 'pleased', text: null },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "Don't celebrate yet. There is a great deal more lattice between here and a guild mark." },
        { end: true },
    ],

    // --- Chapter 1 complete (brief chapter-end scene) ------------------------
    'ch1-complete': [
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "Chapter one. Complete." },
        { speaker: 'guildmaster', portrait: 'pleased',
          text: "The Assembly has noted your progress. You've moved from raw apprentice to... competent beginner. Progress." },
        { speaker: 'rival', portrait: 'smug',
          text: "Charming as always, Madame Voss." },
        { speaker: 'rival', portrait: 'neutral',
          text: "Don't look too pleased. I've already cleared Chapter Two." },
        { speaker: 'rival', portrait: 'smug',
          text: "See you at the top." },
        { speaker: 'guildmaster', portrait: 'alarmed',
          text: "...That boy." },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "Chapter Two awaits. The deposits run deeper there. Prepare your cauldron." },
        { end: true },
    ],

    // --- First shop visit ----------------------------------------------------
    'shop-pellerin-intro': [
        { speaker: 'vendor', portrait: 'warm',
          text: "Ah! A young alchemist. You have the look — slightly harried, slightly brilliant." },
        { speaker: 'vendor', portrait: 'pleased',
          text: "I'm Pellerin. I deal in the small but essential things — dissolvents, catalysts, the kind of emergency preparedness your guild master never teaches." },
        { speaker: 'vendor', portrait: 'warm',
          text: "Browse at your leisure. I don't rush alchemists. The grid will wait." },
        { choice: [
            { label: "What's a dissolvent do?", next: 'dissolvent' },
            { label: "I'll just browse, thanks.", next: 'browse' },
        ]},
        { id: 'dissolvent', speaker: 'vendor', portrait: 'pleased',
          text: "Clears a single filled cell of the lattice — clean off, gone, nothing left. Invaluable when you've painted yourself into a corner." },
        { speaker: 'vendor', portrait: 'warm',
          text: "I keep them in stock. The good alchemists buy three. The great ones buy five." },
        { end: true },

        { id: 'browse', speaker: 'vendor', portrait: 'warm',
          text: "Of course. I'll be here." },
        { end: true },
    ],

    // --- Cache/event flavor beats -------------------------------------------
    'cache-spirit-1': [
        { speaker: 'spirit', portrait: 'calm',
          text: "Between each placement, there is a breath." },
        { speaker: 'spirit', portrait: 'serene',
          text: "The lattice remembers every shape you have set upon it. So do I." },
        { speaker: 'spirit', portrait: 'calm',
          text: "A small cache of elements, for what lies ahead." },
        { setFlag: 'cache-spirit-1-seen', value: true },
        { end: true },
    ],

    'cache-rival-1': [
        { speaker: 'rival', portrait: 'neutral',
          text: "You again. I keep finding things you left behind." },
        { speaker: 'rival', portrait: 'smug',
          text: "A cache. Unopened. Consider it a professional courtesy." },
        { speaker: 'rival', portrait: 'neutral',
          text: "Don't read too much into it." },
        { setFlag: 'cache-rival-1-seen', value: true },
        { end: true },
    ],

    'cache-vendor-1': [
        { speaker: 'vendor', portrait: 'curious',
          text: "Funny thing — I packed an extra shipment and the order fell through." },
        { speaker: 'vendor', portrait: 'warm',
          text: "You look like someone who could use a bundle of essentials. Take it. On the house. Well — nearly on the house." },
        { speaker: 'vendor', portrait: 'pleased',
          text: "Consider it a down payment on your future business." },
        { setFlag: 'cache-vendor-1-seen', value: true },
        { end: true },
    ],

    'cache-spirit-2': [
        { speaker: 'spirit', portrait: 'curious',
          text: "The deposits here run deep." },
        { speaker: 'spirit', portrait: 'calm',
          text: "Many clears will be needed — but patience is also a kind of alchemy." },
        { end: true },
    ],

    // --- Chapter 2 intro stub ------------------------------------------------
    'ch2-intro': [
        { speaker: 'guildmaster', portrait: 'stern',
          text: "The second chapter. The lattice runs deeper; the deposits older." },
        { speaker: 'guildmaster', portrait: 'neutral',
          text: "Your Tin cauldron will prove its worth here. Elements you have only glimpsed before will now be workable." },
        { speaker: 'guildmaster', portrait: 'stern',
          text: "Stay focused. The difficulty is not an accident." },
        { end: true },
    ],
};

// ---------------------------------------------------------------------------
// DialogRunner
// ---------------------------------------------------------------------------

/**
 * DialogRunner loads and steps through a script, resolving branches and flags.
 * Constructed per-dialog; VNScene holds one instance.
 */
export class DialogRunner {
    /**
     * @param {string} scriptId
     */
    constructor(scriptId) {
        this.scriptId = scriptId;
        this._beats   = SCRIPTS[scriptId] || [];
        // Build an id→index lookup for branch navigation.
        this._index = new Map();
        this._beats.forEach((b, i) => { if (b.id) this._index.set(b.id, i); });
        this._cursor  = 0;
        this._done    = false;
        this._choices = null;   // pending choices (beat is a choice type)
    }

    get done()    { return this._done; }
    get choices() { return this._choices; }

    /** Current speaker, portrait, text for the VN panel to display. */
    get current() {
        const b = this._beats[this._cursor];
        if (!b || b.end || b.choice) return null;
        return {
            speaker:  b.speaker  || null,
            portrait: b.portrait || 'neutral',
            text:     b.text,
            silent:   b.text === null,
        };
    }

    /**
     * Advance one beat. If we land on a choice, store it and wait for
     * selectChoice(). Auto-advances through flag and silent beats.
     * Returns the new current beat (or null if done).
     */
    advance() {
        if (this._done) return null;
        this._cursor++;
        return this._step();
    }

    /**
     * Select a branch from a choice beat.
     * @param {number} choiceIndex — index into current choices array.
     */
    selectChoice(choiceIndex) {
        if (!this._choices) return;
        const chosen = this._choices[choiceIndex];
        if (!chosen) return;

        events.emit('dialogChoiceMade', {
            scriptId:    this.scriptId,
            choiceLabel: chosen.label,
            next:        chosen.next,
        });

        state.setDialogFlag(`choice:${this.scriptId}:${chosen.label}`, true);
        this._choices = null;

        // Navigate to the branch target (by id string).
        const target = this._index.get(chosen.next);
        if (target !== undefined) {
            this._cursor = target;
        } else {
            this._cursor++;
        }
        this._step();
    }

    // --- internal ---

    _step() {
        while (this._cursor < this._beats.length) {
            const b = this._beats[this._cursor];

            if (!b) { this._finish(); return null; }

            if (b.end) {
                this._finish(); return null;
            }
            if (b.setFlag) {
                state.setDialogFlag(b.setFlag, b.value !== undefined ? b.value : true);
                this._cursor++; continue;
            }
            if (b.choice) {
                this._choices = b.choice;
                events.emit('dialogLineShown', { scriptId: this.scriptId, speaker: null, text: null, isChoice: true });
                return b;
            }
            if (b.text === null) {
                // Silent beat — emit for portrait swap, then auto-advance.
                events.emit('dialogLineShown', { scriptId: this.scriptId, speaker: b.speaker, text: null });
                this._cursor++; continue;
            }
            // Normal line.
            events.emit('dialogLineShown', { scriptId: this.scriptId, speaker: b.speaker, text: b.text });
            return b;
        }
        this._finish(); return null;
    }

    _finish() {
        this._done = true;
        state.markScriptSeen(this.scriptId);
        events.emit('dialogEnded', { scriptId: this.scriptId });
    }

    /** Seek to the beginning (used when re-running a script on retry). */
    reset() {
        this._cursor = 0;
        this._done   = false;
        this._choices = null;
        this._step();
    }

    /** Start: process beat 0 immediately (may be a flag/choice). */
    start() {
        this._cursor = 0;
        this._step();
    }
}
