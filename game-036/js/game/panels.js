/**
 * panels.js — the two full-screen DOM overlays added alongside the overmap: the
 * journal (pack contents + quest list, bound to Tab/I) and the pause menu
 * (save, load, new island, sound, bound to Esc).
 *
 * These follow mapui.js's conventions exactly, because they have the same two
 * problems it does:
 *
 *   1. Pointer lock. Any panel the player is meant to read has to give the
 *      cursor back, and releasing lock fires `pointerlockchange`, which main.js
 *      otherwise reads as "the player pressed Esc" and answers with a
 *      click-to-resume hint stacked on top of the panel. So an open panel sets
 *      `suppressLockHint`, which main.js consults.
 *   2. Pausing. An open panel freezes the frame loop's update phase — the
 *      cursor is gone, so mouse-look is dead anyway, and letting gravity keep
 *      running would drop the player off whatever ledge they stopped on.
 *
 * Only one panel is open at a time, including the map: opening any of them
 * closes the others, so there is never a stack of overlays to dismiss.
 *
 * Content is rebuilt from scratch on open rather than diffed on every change.
 * These lists are at most a couple of dozen rows and are only visible while the
 * game is paused, so there is nothing to be gained by being clever about it.
 */

import { events } from '../events.js';
import { state } from '../state.js';
import { inventory } from './inventory.js';
import { playUiClick } from '../sounds.js';
import { showToast } from '../ui.js';

const REGION_NAMES = {
    shore: 'The Shore', forest: 'The Forest', cave: 'The Cave',
    lighthouse: 'The Lighthouse', cemetery: 'The Cemetery', garden: 'The Garden',
    ruins: 'Ancient Ruins', library: 'The Library', museum: 'The Museum',
    meadow: 'The Meadow',
};

function prettyRegion(name) {
    return REGION_NAMES[name] || name || 'somewhere on the island';
}

export class Panels {
    /**
     * @param deps { camera, quests, save, mapUI } — mapUI so opening a panel can
     *        close the overmap, keeping "one overlay at a time" true.
     */
    constructor({ camera, quests, save, mapUI }) {
        this.camera = camera;
        this.quests = quests;
        this.save = save;
        this.mapUI = mapUI;

        this.open = null;   // 'journal' | 'pause' | null
        this.suppressLockHint = false;

        this.$journal = document.getElementById('journal-panel');
        this.$journalItems = document.getElementById('journal-items');
        this.$journalQuests = document.getElementById('journal-quests');
        this.$journalObjective = document.getElementById('journal-objective');
        this.$pause = document.getElementById('pause-panel');
        this.$saveStatus = document.getElementById('save-status');

        this._bindKeys();
        this._bindButtons();

        // Re-render only while visible; a closed panel is rebuilt on open anyway.
        const refresh = () => { if (this.open === 'journal') this._renderJournal(); };
        events.on('inventoryChanged', refresh);
        events.on('questsChanged', refresh);
        events.on('progressChanged', refresh);

        events.on('questCompleted', ({ title, track }) => {
            showToast(`${track === 'main' ? 'OBJECTIVE' : 'SIDE QUEST'} COMPLETE — ${title}`);
        });
        events.on('gameSaved', () => this._setSaveStatus('Progress saved.'));
        events.on('saveFailed', ({ message }) => {
            this._setSaveStatus(`Could not save: ${message}. Progress will not be kept.`);
            showToast('Save failed — this browser is blocking storage');
        });
    }

    get isOpen() { return this.open !== null; }

    _bindKeys() {
        document.addEventListener('keydown', (e) => {
            // Tab would otherwise move focus to the back-to-launcher link and the
            // buttons, which in a pointer-locked game looks like nothing happening.
            if (e.code === 'Tab' || e.code === 'KeyI') {
                e.preventDefault();
                this.toggle('journal');
            } else if (e.code === 'Escape') {
                // The map owns Escape while it is open (mapui.js closes itself), so
                // only claim it otherwise. Escape also cancels pointer lock at the
                // browser level, which is why the pause menu is the natural thing
                // to put here: the cursor is already back.
                if (this.mapUI && this.mapUI.isOpen) return;
                e.preventDefault();
                if (this.open === 'journal') this.close();
                else this.toggle('pause');
            }
        });
    }

    _bindButtons() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { playUiClick(); fn(); });
        };
        bind('pause-resume', () => this.close());
        bind('pause-save', () => {
            if (this.save.save()) this._setSaveStatus('Progress saved.');
        });
        bind('pause-load', () => this._confirmReload());
        bind('pause-new', () => this._newIsland());
        bind('journal-close', () => this.close());
    }

    /**
     * Loading mid-session means rebuilding the world, the item placement and the
     * map grid from the saved seed — which is exactly what a page load does, and
     * doing it by hand would mean a second, parallel construction path that only
     * runs on this button and would quietly rot. So the saved seed goes into the
     * session and the page reloads into it.
     */
    _confirmReload() {
        if (!this.save.hasSave()) {
            this._setSaveStatus('No saved walk to load.');
            return;
        }
        this.save.reloadIntoSave();
    }

    _newIsland() {
        // Deliberately destructive, so it asks. The saved walk is the only thing
        // in the game that cannot be regenerated from a seed.
        const ok = !this.save.hasSave()
            || window.confirm('Start a new island? Your saved walk on this one will be discarded.');
        if (!ok) return;
        this.save.startNewIsland();
    }

    toggle(which) {
        if (this.open === which) this.close();
        else this._openPanel(which);
    }

    _openPanel(which) {
        if (state.isComplete) return;
        // One overlay at a time.
        if (this.mapUI && this.mapUI.isOpen) this.mapUI.close();
        if (this.open) this._hide(this.open);

        this.open = which;
        this.suppressLockHint = true;
        if (which === 'journal') this._renderJournal();
        if (which === 'pause') this._renderPause();
        this._show(which);
        this.camera.exitLock();
    }

    close() {
        if (!this.open) return;
        this._hide(this.open);
        this.open = null;
        // Re-lock so the player walks on without an extra click. The flag stays
        // set across this call for the same reason mapui.js keeps it: exitLock and
        // requestLock both fire pointerlockchange, and clearing it first would
        // flash the resume hint for a frame.
        this.camera.requestLock();
        this.suppressLockHint = false;
    }

    _el(which) { return which === 'journal' ? this.$journal : this.$pause; }
    _show(which) { const el = this._el(which); if (el) el.classList.remove('hidden'); }
    _hide(which) { const el = this._el(which); if (el) el.classList.add('hidden'); }

    _setSaveStatus(text) {
        if (this.$saveStatus) this.$saveStatus.textContent = text;
    }

    // ---------- rendering ----------

    _renderJournal() {
        this._renderPack();
        this._renderQuests();
    }

    _renderPack() {
        const host = this.$journalItems;
        if (!host) return;
        host.textContent = '';

        const carried = inventory.list();
        if (carried.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'panel-empty';
            empty.textContent = inventory.log.length === 0
                ? 'Your pack is empty. Books and artifacts are scattered across the island — walk into one to pick it up.'
                : 'Your pack is empty. Everything you have found is already on the shelves.';
            host.appendChild(empty);
            return;
        }

        for (const entry of carried) {
            const row = document.createElement('div');
            row.className = 'pack-row';

            const head = document.createElement('div');
            head.className = 'pack-head';

            const tag = document.createElement('span');
            tag.className = `pack-tag pack-tag-${entry.kind}`;
            tag.textContent = entry.kind === 'book' ? 'BOOK' : 'ARTIFACT';
            head.appendChild(tag);

            const name = document.createElement('span');
            name.className = 'pack-name';
            name.textContent = entry.name;
            head.appendChild(name);

            const found = document.createElement('span');
            found.className = 'pack-found';
            found.textContent = `found in ${prettyRegion(entry.region)}`;
            head.appendChild(found);

            row.appendChild(head);

            if (entry.lore) {
                const lore = document.createElement('p');
                lore.className = 'pack-lore';
                lore.textContent = entry.lore;
                row.appendChild(lore);
            }

            const dest = document.createElement('p');
            dest.className = 'pack-dest';
            dest.textContent = entry.kind === 'book'
                ? 'Belongs on the Library shelves.'
                : 'Belongs on a Museum pedestal.';
            row.appendChild(dest);

            host.appendChild(row);
        }
    }

    _renderQuests() {
        const active = this.quests.activeMain;
        if (this.$journalObjective) {
            this.$journalObjective.textContent = active
                ? active.title
                : 'Everything is where it belongs.';
        }

        const host = this.$journalQuests;
        if (!host) return;
        host.textContent = '';

        for (const { def, done } of this.quests.visibleQuests()) {
            const row = document.createElement('div');
            row.className = `quest-row${done ? ' quest-done' : ''}`;

            const head = document.createElement('div');
            head.className = 'quest-head';

            const box = document.createElement('span');
            box.className = 'quest-box';
            // Text marks rather than an icon font: the HUD already uses two emoji
            // and they render at inconsistent sizes, so a bracketed tick reads more
            // predictably in a monospace panel.
            box.textContent = done ? '[x]' : '[ ]';
            head.appendChild(box);

            const title = document.createElement('span');
            title.className = 'quest-title';
            title.textContent = def.title;
            head.appendChild(title);

            if (def.track === 'side') {
                const badge = document.createElement('span');
                badge.className = 'quest-badge';
                badge.textContent = 'SIDE';
                head.appendChild(badge);
            }

            const prog = this.quests.progressFor(def);
            if (prog && !done) {
                const counter = document.createElement('span');
                counter.className = 'quest-progress';
                counter.textContent = `${prog[0]} / ${prog[1]}`;
                head.appendChild(counter);
            }

            row.appendChild(head);

            if (!done && def.detail) {
                const detail = document.createElement('p');
                detail.className = 'quest-detail';
                detail.textContent = def.detail;
                row.appendChild(detail);
            }

            host.appendChild(row);
        }
    }

    _renderPause() {
        const age = this.save.savedAgeText();
        this._setSaveStatus(age ? `Last saved ${age}.` : 'Not saved yet this walk.');
    }
}
