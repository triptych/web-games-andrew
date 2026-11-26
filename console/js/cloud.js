// Cloud: sign in by email link and keep the Pocket Garden online, so it comes back on another phone or browser.
//
// The backup is one row in the shared table (lib/core/cloud.js, game `pocket-garden`, slot `main`): the console's
// settings (shell, screen tint, sound…), play history, Messages (friends, chats, your name), the Lounge, and the two
// keys it shares with the Garden: the stars (`garden.starred`) and the dragonfly (`garden.companion`). It is a
// snapshot of those localStorage keys, so restoring is "write them back and reload".
//
// Saved Games backs up each game's own save from here (the keys its avatar.json lists under save.keys), one row per
// game in slot `pocket-garden`, so it never touches the `main` row a game's own ☁️ Cloud Save writes.
//
// One sign-in covers every game on the site (the session is shared). A new device that signs in with nothing on it
// takes the cloud backup by itself; a device that already has its own data asks first. Once a device has matched
// the cloud (restored it or backed up over it), it backs up by itself every couple of minutes while something has
// changed, and as the page closes, when the shared "save to the cloud by itself" switch is on.

import { makeCloud, snapshot, restore, getSession } from '../../lib/core/cloud.js';
import { View, ListView, TextView } from './views.js';
import { ICONS } from './icons.js';
import { esc, timeAgo } from './util.js';
import { readSaveStats } from './messages.js';
import { sfx } from './sound.js';

/** What the Pocket Garden backup holds. */
export const BACKUP_KEYS = ['console.settings', 'console.recent', 'console.messages', 'console.lounge', 'garden.starred', 'garden.companion'];
const STATE_KEY = 'console.cloud';           // { user }: this device has matched that account's backup
const AUTO_KEY = 'web-games.cloud.auto';     // shared by every game: "save to the cloud by itself"
const NOTICE_KEY = 'web-games.cloud.notice'; // sessionStorage: a message to show after the reload
export const GAME_SLOT = 'pocket-garden';    // per-game backups made from the console
const AUTO_EVERY = 120000;
const MAX_BYTES = 900000;                    // a row's data must stay under 1 MB

const read = (k, sto = localStorage) => {
    try {
        return JSON.parse(sto.getItem(k) || 'null');
    } catch {
        return null;
    }
};
const write = (k, v) => {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch {
        /* blocked */
    }
};
const parse = (s) => {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
};
const autoOn = () => {
    try {
        return localStorage.getItem(AUTO_KEY) !== '0';
    } catch {
        return false;
    }
};
const when = (iso) => timeAgo(new Date(iso).getTime());
const cloudIcon = ICONS.cloud;

/** What a snapshot of the console holds, in numbers. */
function tally(snap) {
    const favs = parse(snap?.['garden.starred']);
    const recent = parse(snap?.['console.recent']);
    const msgs = parse(snap?.['console.messages']);
    const pet = parse(snap?.['garden.companion']);
    const settings = parse(snap?.['console.settings']);
    return {
        favs: Array.isArray(favs) ? favs.length : 0,
        played: Array.isArray(recent) ? recent.length : 0,
        // the Garden's dragonfly is everyone's friend from the start: count the others
        friends: msgs?.friends && typeof msgs.friends === 'object' ? Object.keys(msgs.friends).filter((id) => id !== 'garden').length : 0,
        pet: !!pet?.met,
        lounge: !!snap?.['console.lounge'],
        shell: settings?.shell || '',
    };
}

/** The Pocket Garden's cloud: the backup, the sign-in, and the per-game save backups. */
export class Cloud {
    constructor(app) {
        this.app = app;
        this.cloud = makeCloud({ game: 'pocket-garden' });
        /** The backup row: undefined while not known, null when there is none. */
        this.row = undefined;
        this.lastHash = '';
        this.lastUp = 0;
        this.busy = false;
    }

    get available() {
        return this.cloud.available;
    }
    get signedIn() {
        return this.cloud.signedIn;
    }
    get email() {
        return this.cloud.email;
    }
    get autoOn() {
        return autoOn();
    }
    setAuto(on) {
        try {
            localStorage.setItem(AUTO_KEY, on ? '1' : '0');
        } catch {
            /* blocked */
        }
    }

    local() {
        return snapshot(BACKUP_KEYS, { exclude: ['__probe'] });
    }

    /** Is there anything on this device worth keeping (beyond the settings)? */
    hasLocal(snap = this.local()) {
        const t = tally(snap);
        return t.favs > 0 || t.played > 0 || t.friends > 0 || t.pet || t.lounge;
    }

    summary(snap) {
        const t = tally(snap);
        const bits = [`★${t.favs}`, `${t.friends} friend${t.friends === 1 ? '' : 's'}`, `${t.played} played`];
        if (t.shell) bits.push(`${t.shell} shell`);
        return bits.join(' · ');
    }

    /** Has this device matched the signed-in account's backup (so it may back up over it)? */
    get synced() {
        const s = getSession();
        return !!s && read(STATE_KEY)?.user === s.user;
    }
    markSynced() {
        const s = getSession();
        if (s) write(STATE_KEY, { user: s.user });
    }

    /** At startup: back from the emailed link, or signed in from before. */
    boot() {
        if (!this.available) return;
        try {
            const n = sessionStorage.getItem(NOTICE_KEY);
            if (n) {
                sessionStorage.removeItem(NOTICE_KEY);
                setTimeout(() => this.app.toast(n), 600);
            }
        } catch {
            /* blocked */
        }
        const r = this.cloud.consumeRedirect();
        if (r === 'signed-in') {
            setTimeout(() => this.app.toast(`☁️ Signed in as ${this.email || 'you'}`), 700);
            this.check().then(() => this.app.openCloud());
        } else if (r) setTimeout(() => this.app.toast(`Sign-in didn't work: ${r}`), 700);
        else if (this.signedIn) this.check();

        this.cloud.onChange(() => {
            this.row = undefined;
            this.app.cloudChanged();
            if (this.signedIn) this.check();
        });
        setInterval(() => this.autosave(), 30000);
        addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.autosave({ keepalive: true }));
        addEventListener('pagehide', () => this.autosave({ keepalive: true }));
    }

    /**
     * Learn the backup. With none yet, this device's data becomes it. A device with nothing of its own takes the
     * backup by itself; one with its own data waits for the player to choose (Cloud → Restore or Back up now).
     */
    async check() {
        if (!this.signedIn) {
            this.row = undefined;
            return;
        }
        try {
            this.row = await this.cloud.download();
        } catch (e) {
            console.warn('[cloud]', e.message);
            this.app.cloudChanged();
            return;
        }
        if (!this.row) {
            if (this.local()) await this.backup();
            else this.markSynced();
        } else if (!this.synced) {
            if (!this.hasLocal()) return this.apply(this.row, '☁️ Your Pocket Garden is back from the cloud');
            this.app.toast('☁️ There is a backup in the cloud: see Cloud to restore it');
        } else this.lastHash = JSON.stringify(this.row.data);
        this.app.cloudChanged();
    }

    /** Put this device's Pocket Garden online, replacing the backup. */
    async backup({ keepalive = false } = {}) {
        const snap = this.local();
        if (!snap) throw new Error('Nothing to back up yet.');
        const summary = this.summary(snap);
        this.busy = true;
        try {
            await this.cloud.upload(snap, { version: this.app.version, summary, keepalive });
        } finally {
            this.busy = false;
        }
        this.lastHash = JSON.stringify(snap);
        this.lastUp = Date.now();
        this.row = { data: snap, summary, version: this.app.version, updated_at: new Date().toISOString() };
        this.markSynced();
        this.app.cloudChanged();
    }

    /** Replace this device's Pocket Garden with a backup, then start again from it. */
    apply(row, message = '☁️ Restored your Pocket Garden') {
        if (!row?.data) return;
        this.markSynced();
        restore(row.data);
        try {
            sessionStorage.setItem(NOTICE_KEY, message);
        } catch {
            /* blocked */
        }
        location.reload();
    }

    /** Quietly back up when something changed (at most every 2 minutes; keepalive as the page closes). */
    autosave({ keepalive = false } = {}) {
        if (!this.signedIn || !autoOn() || this.busy || !this.synced || this.row === undefined) return;
        if (!keepalive && Date.now() - this.lastUp < AUTO_EVERY) return;
        const snap = this.local();
        if (!snap || JSON.stringify(snap) === this.lastHash) return;
        this.backup({ keepalive }).catch((e) => console.warn('[cloud]', e.message));
    }

    async signOut() {
        await this.cloud.signOut();
        this.row = undefined;
        this.app.cloudChanged();
    }

    // ----- each game's own save

    /** The game's save on this device: { [key]: raw } from its avatar.json save keys, or null. */
    gameSnap(save) {
        const keys = save?.keys || [];
        const out = {};
        try {
            for (const k of keys) {
                if (k.endsWith('*')) {
                    const pre = k.slice(0, -1);
                    for (let i = 0; i < localStorage.length; i++) {
                        const x = localStorage.key(i);
                        if (x?.startsWith(pre)) out[x] = localStorage.getItem(x);
                    }
                } else Object.assign(out, snapshot(k) || {});
            }
        } catch {
            return null;
        }
        return Object.keys(out).length ? out : null;
    }

    gameSummary(save) {
        const st = readSaveStats(save) || {};
        const bits = Object.entries(st)
            .filter(([k, v]) => k !== 'lastSave' && (typeof v === 'number' || typeof v === 'string'))
            .slice(0, 3)
            .map(([k, v]) => `${k} ${v}`);
        return bits.join(' · ') || 'A saved game';
    }

    /** Back up one game's save (from the console, in its own slot). */
    async backupGame(g, save) {
        const snap = this.gameSnap(save);
        if (!snap) throw new Error(`No ${g.title} save on this device.`);
        if (JSON.stringify(snap).length > MAX_BYTES) throw new Error(`${g.title}'s save is too big for the cloud.`);
        const c = makeCloud({ game: g.id, slot: GAME_SLOT });
        const summary = this.gameSummary(save);
        await c.upload(snap, { version: g.version || '', summary });
        return { game: g.id, slot: GAME_SLOT, summary, version: g.version || '', updated_at: new Date().toISOString() };
    }

    async restoreGame(g) {
        const row = await makeCloud({ game: g.id, slot: GAME_SLOT }).download();
        if (!row?.data) throw new Error('That backup is gone.');
        // the game isn't running here, so nothing will write over these keys: no freeze
        if (!restore(row.data, { freeze: false })) throw new Error('This browser blocks storage.');
        return row;
    }

    /** Every cloud row of the player's: [{ game, slot, summary, version, updated_at }]. */
    listAll() {
        return this.cloud.listAll();
    }
}

// ------------------------------------------------------------------ screens

const WHAT = `
    <h3>What the backup keeps</h3>
    <ul>
        <li><b>Your look:</b> the shell, the screen tint, sound, haptics and how games open.</li>
        <li><b>Your stars</b> (shared with the Garden) and <b>Recently Played</b>.</li>
        <li><b>Messages:</b> your friends, every chat, friendship and your name.</li>
        <li><b>The Lounge</b> and <b>the dragonfly</b>: its name, look, meters and places.</li>
    </ul>
    <h3>Saved Games</h3>
    <p>Each game's own save can be backed up from here too, one by one or all at once, and restored on another device before you play. Games with their own ☁️ Cloud Save keep that one separately.</p>
    <h3>Signing in</h3>
    <p>Type your email and tap the link it sends: no password. One sign-in works here and in every game with a Cloud Save. With <b>Auto backup</b> on, the handheld backs itself up every few minutes while things change.</p>`;

/** The Cloud screen: sign in, back up, restore, Saved Games, sign out. */
export class CloudView extends ListView {
    constructor(app, { cloud }) {
        super(app, { title: 'Cloud', getItems: () => this.rows() });
        this.c = cloud;
        this.armed = 0;
        this.armedUp = 0;
        this.head = `<p class="cl-lead"></p>`;
    }

    build() {
        super.build();
        this.lead = this.el.querySelector('.cl-lead');
        this.paintLead();
    }

    paintLead(text) {
        if (!this.lead) return;
        const c = this.c;
        this.lead.textContent =
            text ??
            (!c.available
                ? 'Cloud backups work on the Pocket Garden website.'
                : !c.signedIn
                  ? 'Sign in to keep your Pocket Garden and your saves online.'
                  : c.row === undefined
                    ? 'Checking the cloud…'
                    : c.row
                      ? `Backed up ${when(c.row.updated_at)}: ${c.row.summary || ''}`
                      : 'Nothing in the cloud yet.');
    }

    refresh() {
        super.refresh();
        this.paintLead();
    }

    rows() {
        const c = this.c;
        const what = { label: 'What gets saved', icon: ICONS.about, action: () => this.app.push(new TextView(this.app, { title: 'Cloud', html: WHAT })) };
        if (!c.available) return [what];
        if (!c.signedIn) return [{ label: 'Sign in with email', icon: ICONS.person, action: () => this.app.push(new EmailView(this.app, { cloud: c })) }, what];
        const has = !!c.row;
        return [
            { label: c.email || 'Signed in', icon: ICONS.person, meta: 'Signed in', chev: false, action: () => this.app.toast(`☁️ ${c.email}`) },
            { label: 'Back up now', icon: cloudIcon, meta: has ? when(c.row.updated_at) : 'Never', chev: false, action: () => this.doBackup() },
            { label: Date.now() - this.armed < 5000 ? 'Press again to restore' : 'Restore backup', icon: ICONS.recent, meta: has ? '' : 'None', chev: false, action: () => this.doRestore() },
            {
                label: 'Auto backup',
                icon: ICONS.updated,
                meta: c.autoOn ? 'On' : 'Off',
                cycle: () => {
                    c.setAuto(!c.autoOn);
                    sfx.toggle();
                    this.refresh();
                    this.app.say(`Auto backup ${c.autoOn ? 'on' : 'off'}`);
                },
            },
            { label: 'Saved Games', icon: ICONS.all, action: () => this.app.push(new SavedGamesView(this.app, { cloud: c })) },
            what,
            { label: 'Sign out', icon: ICONS.trash, chev: false, action: () => this.doSignOut() },
        ];
    }

    async doBackup() {
        if (this.c.busy) return this.app.deny();
        // another device's backup that this one hasn't restored: replacing it takes a second press
        if (this.c.row && !this.c.synced && Date.now() - this.armedUp > 5000) {
            this.armedUp = Date.now();
            this.paintLead(`The cloud has a backup from ${when(this.c.row.updated_at)} (${this.c.row.summary || 'saved'}). Press again to replace it with this device.`);
            this.app.say('Press again to replace the cloud backup');
            return;
        }
        this.armedUp = 0;
        this.paintLead('Backing up…');
        try {
            await this.c.backup();
            this.app.toast('☁️ Backed up');
            this.app.say('Backed up to the cloud');
        } catch (e) {
            this.paintLead(e.message);
            this.app.deny();
        }
    }

    doRestore() {
        const row = this.c.row;
        if (!row) return this.app.deny();
        if (Date.now() - this.armed > 5000) {
            this.armed = Date.now();
            this.refresh();
            this.paintLead(`This replaces the Pocket Garden on this device with the backup from ${when(row.updated_at)} (${row.summary || 'saved'}). Press again to restore.`);
            this.app.say('Press again to restore');
            clearTimeout(this.armT);
            this.armT = setTimeout(() => this.refresh(), 5100);
            return;
        }
        this.armed = 0;
        this.c.apply(row);
    }

    async doSignOut() {
        await this.c.signOut();
        this.index = 0;
        this.refresh();
        this.app.toast('Signed out of every game');
    }

    hidden() {
        super.hidden();
        clearTimeout(this.armT);
    }
}

/** Type an email address and get a sign-in link. */
export class EmailView extends View {
    constructor(app, { cloud }) {
        super(app, 'Sign in');
        this.c = cloud;
        this.acceptsTyping = true;
    }
    get type() {
        return 'name';
    }
    build() {
        this.el.innerHTML = `
            <form class="nm-wrap cl-form" autocomplete="on">
                <p class="nm-lead">Back up your Pocket Garden</p>
                <input class="th-input nm-input" type="email" name="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" enterkeyhint="send" inputmode="email">
                <button type="submit" class="rg-btn yes sel">Email me a link</button>
                <p class="nm-hint" aria-live="polite">You'll get a link: tap it and you're back here, signed in. No password. One sign-in works for every game.</p>
            </form>`;
        this.input = this.el.querySelector('input');
        this.hint = this.el.querySelector('.nm-hint');
        this.el.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.send();
        });
    }
    shown() {
        this.input.focus({ preventScroll: true });
    }
    async send() {
        const email = this.input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.hint.textContent = 'Type your email address first.';
            return this.app.deny();
        }
        if (this.sending) return;
        this.sending = true;
        this.hint.textContent = 'Sending…';
        try {
            await this.c.cloud.signIn(email);
            this.hint.textContent = `Check your inbox at ${email} and tap the link. It can take a minute; look in spam too.`;
            this.app.say('Sign-in link sent');
        } catch (e) {
            this.hint.textContent = e.message;
            this.app.deny();
        } finally {
            this.sending = false;
        }
    }
    typeChar(ch) {
        this.input.focus();
        this.input.value += ch;
    }
    enterFromInput() {
        this.send();
    }
    onSelect() {
        this.send();
    }
}

/** Every game with a save on this device or in the cloud. */
export class SavedGamesView extends ListView {
    constructor(app, { cloud }) {
        super(app, { title: 'Saved Games', getItems: () => this.rows() });
        this.c = cloud;
        this.saves = null;     // game id → its avatar.json save block
        this.cloudRows = null; // game id → { mine: row in our slot, own: row from the game's own Cloud Save }
        this.empty = '<p>Looking for saves…</p>';
        this.head = `<p class="cl-lead">Loading…</p>`;
    }

    build() {
        super.build();
        this.lead = this.el.querySelector('.cl-lead');
        this.load();
    }

    async load() {
        const all = this.app.allGames;
        const m = this.app.messenger;
        const [avatars, rows] = await Promise.all([
            Promise.all(all.map((g) => m.load(g.id).then((a) => [g.id, a?.save || null]))),
            this.c.listAll().catch((e) => {
                this.err = e.message;
                return [];
            }),
        ]);
        this.saves = new Map(avatars);
        this.cloudRows = new Map();
        for (const r of rows) {
            const x = this.cloudRows.get(r.game) || {};
            if (r.slot === GAME_SLOT) x.mine = r;
            else x.own = x.own && x.own.updated_at > r.updated_at ? x.own : r;
            this.cloudRows.set(r.game, x);
        }
        this.empty = '<p><b>No saves yet.</b></p><p>Play a game and its save shows up here, ready to back up.</p>';
        this.refresh();
    }

    localSnap(g) {
        return this.c.gameSnap(this.saves?.get(g.id));
    }

    rows() {
        if (!this.saves) return [];
        const out = [];
        let onDevice = 0;
        for (const g of this.app.allGames) {
            const here = !!this.localSnap(g);
            const cr = this.cloudRows.get(g.id) || {};
            if (!here && !cr.mine && !cr.own) continue;
            if (here) onDevice++;
            const bits = [here ? 'On this device' : 'Not on this device'];
            if (cr.mine) bits.push(`☁️ ${when(cr.mine.updated_at)}`);
            if (cr.own) bits.push(`its Cloud Save ${when(cr.own.updated_at)}`);
            const t = Math.max(cr.mine ? Date.parse(cr.mine.updated_at) : 0, cr.own ? Date.parse(cr.own.updated_at) : 0);
            out.push({ game: g, t, here, subHTML: esc(bits.join(' · ')), say: `${g.title}, ${bits.join(', ')}`, action: () => this.app.push(new GameSaveView(this.app, { cloud: this.c, game: g, save: this.saves.get(g.id), rows: cr, parent: this })) });
        }
        out.sort((a, b) => b.here - a.here || b.t - a.t || a.game.title.localeCompare(b.game.title));
        if (this.lead) this.lead.textContent = this.err || `${onDevice} game${onDevice === 1 ? '' : 's'} saved on this device, ${[...this.cloudRows.values()].filter((x) => x.mine).length} backed up from here.`;
        if (onDevice) out.unshift({ label: `Back up all ${onDevice}`, icon: cloudIcon, chev: false, action: () => this.backupAll() });
        return out;
    }

    async backupAll() {
        if (this.running) return this.app.deny();
        this.running = true;
        const list = this.app.allGames.filter((g) => this.localSnap(g));
        let done = 0;
        const failed = [];
        for (const g of list) {
            if (this.lead) this.lead.textContent = `Backing up ${done + 1} of ${list.length}: ${g.title}…`;
            try {
                const row = await this.c.backupGame(g, this.saves.get(g.id));
                this.cloudRows.set(g.id, { ...(this.cloudRows.get(g.id) || {}), mine: row });
                done++;
            } catch (e) {
                failed.push(g.title);
                if (!this.c.signedIn) break;
            }
        }
        this.running = false;
        this.refresh();
        this.app.toast(failed.length ? `☁️ Backed up ${done}; ${failed.length} failed` : `☁️ Backed up ${done} game${done === 1 ? '' : 's'}`);
        if (failed.length && this.lead) this.lead.textContent = `Couldn't back up: ${failed.join(', ')}`;
    }
}

/** One game's save: back it up, restore it, open its cartridge. */
export class GameSaveView extends ListView {
    constructor(app, { cloud, game, save, rows, parent }) {
        super(app, { title: game.title, getItems: () => this.rowsFor() });
        Object.assign(this, { c: cloud, g: game, save, cr: rows, parent });
        this.armed = 0;
        this.head = `<p class="cl-lead"></p>`;
    }
    build() {
        super.build();
        this.lead = this.el.querySelector('.cl-lead');
        this.paintLead();
    }
    paintLead(text) {
        if (!this.lead) return;
        const here = this.c.gameSnap(this.save);
        this.lead.textContent = text ?? (here ? `On this device: ${this.c.gameSummary(this.save)}` : 'No save on this device.');
    }
    currentGame() {
        return this.g;
    }
    rowsFor() {
        const here = !!this.c.gameSnap(this.save);
        const mine = this.cr.mine;
        return [
            here ? { label: 'Back up to the cloud', icon: cloudIcon, meta: mine ? when(mine.updated_at) : '', chev: false, action: () => this.doBackup() } : null,
            mine ? { label: Date.now() - this.armed < 5000 ? 'Press again to restore' : 'Restore to this device', icon: ICONS.recent, subHTML: esc(mine.summary || ''), chev: false, action: () => this.doRestore() } : null,
            this.cr.own ? { label: 'Its own Cloud Save', icon: ICONS.about, subHTML: esc(`${this.cr.own.summary || 'Saved'} · ${when(this.cr.own.updated_at)}`), chev: false, action: () => this.app.toast(`Load it from ☁️ Cloud Save inside ${this.g.title}`) } : null,
            { label: 'Open the cartridge', icon: ICONS.play, action: () => this.app.openGame([this.g], 0) },
        ].filter(Boolean);
    }
    async doBackup() {
        this.paintLead('Backing up…');
        try {
            this.cr.mine = await this.c.backupGame(this.g, this.save);
            this.parent.cloudRows.set(this.g.id, this.cr);
            this.refresh();
            this.paintLead();
            this.app.toast(`☁️ ${this.g.title} backed up`);
        } catch (e) {
            this.paintLead(e.message);
            this.app.deny();
        }
    }
    async doRestore() {
        const here = !!this.c.gameSnap(this.save);
        if (here && Date.now() - this.armed > 5000) {
            this.armed = Date.now();
            this.refresh();
            this.paintLead(`This replaces the ${this.g.title} save on this device with the one from ${when(this.cr.mine.updated_at)}. Press again.`);
            clearTimeout(this.armT);
            this.armT = setTimeout(() => this.refresh(), 5100);
            return;
        }
        this.armed = 0;
        try {
            await this.c.restoreGame(this.g);
            this.refresh();
            this.paintLead();
            this.app.toast(`☁️ ${this.g.title} restored: play to carry on`);
        } catch (e) {
            this.paintLead(e.message);
            this.app.deny();
        }
    }
    hidden() {
        super.hidden();
        clearTimeout(this.armT);
    }
}
