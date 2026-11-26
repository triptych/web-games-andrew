// lib/core/cloud-ui.js — the Cloud Save screen for any game, on top of lib/core/cloud.js.
//
//   import { makeCloud } from '../lib/core/cloud.js';
//   import { makeCloudUI } from '../lib/core/cloud-ui.js';
//   const cloud = makeCloud({ game: 'game-031' });
//   const cloudUI = makeCloudUI(cloud, {
//       getSave: () => readMySave(),                    // the game's save as stored locally (any JSON), or null
//       applySave: (data) => { writeMySave(data); continueGame(); },
//       summary: (data) => `Floor ${data.floor} · ${data.gold} G`,
//       hasGame: () => playing || !!readMySave(),        // loading would replace something: ask for a second tap
//       version: VERSION, onOpen: pause, onClose: resume,
//   });
//   cloudUI.boot();                                     // at startup: back from the emailed link → opens itself
//   button.onclick = () => cloudUI.open();               // a modal <dialog>; or cloudUI.mount(el) inside your own screen
//   // while playing: cloudUI.autosave() every so often, cloudUI.autosave({ keepalive: true }) on pagehide
//
// Signed out it asks for an email and sends a sign-in link (one sign-in for every game on the site). Signed in it shows
// the cloud save (summary, when), Save to cloud, Load from cloud (a second tap if it would replace a game here), a
// switch for saving by itself (shared by all games) and Sign out (of every game). Plain DOM, styles injected once
// under .wg-cloud; a game can pass its own button classes to blend in.

const AUTO_KEY = 'web-games.cloud.auto';
const AUTO_EVERY = 120000;          // quiet uploads at most every 2 minutes

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
};
function autoOn() { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch { return false; } }
function setAuto(on) { try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* blocked */ } }

const CSS = `
dialog.wg-cloud { border: 0; padding: 0; background: transparent; max-width: none; max-height: none; color: inherit; font: inherit; }
dialog.wg-cloud::backdrop { background: rgba(20, 16, 28, 0.55); }
.wg-cloud .wg-sheet { box-sizing: border-box; width: min(440px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto;
    background: var(--wg-cloud-bg, #fffaf2); color: var(--wg-cloud-ink, #3b2f36); border: 2px solid var(--wg-cloud-edge, #8d5d35);
    border-radius: 18px; padding: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); font-family: var(--wg-cloud-font, inherit); }
.wg-cloud .wg-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.wg-cloud .wg-head h2 { margin: 0; font-size: 22px; }
.wg-cloud p { margin: 6px 0; line-height: 1.4; }
.wg-cloud .wg-note { font-size: 14px; opacity: 0.85; }
.wg-cloud .wg-msg { font-size: 14px; font-weight: 700; min-height: 1em; }
.wg-cloud .wg-msg:empty { display: none; }
.wg-cloud .wg-msg.bad { color: #b0303f; } .wg-cloud .wg-msg.good { color: #2f7d52; }
.wg-cloud input[type=email] { box-sizing: border-box; width: 100%; min-height: 44px; padding: 6px 12px; margin: 8px 0; border-radius: 12px;
    border: 2px solid var(--wg-cloud-edge, #8d5d35); font: 600 16px/1.2 inherit; color: inherit; background: #fff; }
.wg-cloud .wg-save { display: flex; gap: 10px; align-items: center; margin: 10px 0; padding: 10px; border-radius: 12px; background: rgba(0, 0, 0, 0.05); }
.wg-cloud .wg-save b { display: block; } .wg-cloud .wg-save small { opacity: 0.8; }
.wg-cloud .wg-acts { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.wg-cloud .wg-acts > * { flex: 1 1 140px; }
.wg-cloud .wg-check { display: flex; gap: 8px; align-items: center; font-weight: 700; min-height: 44px; }
.wg-cloud .wg-check input { width: 22px; height: 22px; }
.wg-cloud .wg-btn { min-height: 44px; padding: 8px 14px; border-radius: 12px; border: 2px solid var(--wg-cloud-edge, #8d5d35); cursor: pointer;
    background: #fff; color: inherit; font: 700 15px/1.2 inherit; }
.wg-cloud .wg-btn.primary { background: var(--wg-cloud-accent, #e8546a); border-color: var(--wg-cloud-accent-edge, #a8344a); color: #fff; }
.wg-cloud .wg-btn:disabled { opacity: 0.5; cursor: default; }
.wg-cloud .wg-btn:focus-visible, .wg-cloud input:focus-visible { outline: 3px solid #ffc94d; outline-offset: 2px; }
.wg-cloud .wg-x { min-width: 44px; }`;

function injectCSS() {
    if (document.getElementById('wg-cloud-style')) return;
    const st = document.createElement('style');
    st.id = 'wg-cloud-style';
    st.textContent = CSS;
    document.head.appendChild(st);
}

export function makeCloudUI(cloud, {
    getSave, applySave, summary = () => '', hasGame = () => !!getSave(), version = '', title = 'Cloud Save',
    onOpen = () => {}, onClose = () => {}, toast = null, classes = {},
} = {}) {
    const cls = { btn: 'wg-btn', primary: 'wg-btn primary', ...classes };
    let info;                 // the online save row, null if none, undefined if not known yet
    let busy = false, armed = 0, lastAuto = 0;
    let host = null;          // the element we render into
    let dialog = null;

    const msg = (text, kind = '') => { const m = host?.querySelector('.wg-msg'); if (m) { m.textContent = text; m.className = 'wg-msg ' + kind; } };
    const sum = (data) => { try { return String(summary(data) || ''); } catch { return ''; } };

    function render() {
        if (!host) return;
        const body = host.querySelector('.wg-body');
        if (!cloud.signedIn) {
            const v = body.querySelector('input[type=email]')?.value || '';
            body.innerHTML = `<p class="wg-note">Sign in to keep a copy of your game online and carry on from another device or browser. You'll get an email with a sign-in link: no password. One sign-in works for every game here.</p>
                <form class="wg-form"><input type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email" value="${esc(v)}"></form>
                <div class="wg-acts"><button type="button" class="${cls.primary}" data-wgc="signin">✉️ Email me a sign-in link</button></div>`;
            return;
        }
        const has = !!info, local = !!hasGame();
        body.innerHTML = `<p>Signed in as <b>${esc(cloud.email || 'you')}</b></p>
            <div class="wg-save"><span style="font-size:28px" aria-hidden="true">☁️</span><div>${info === undefined ? '<b>Checking the cloud…</b>'
                : has ? `<b>${esc(info.summary || 'A saved game')}</b><small>Saved ${ago(info.updated_at)}${info.version ? ` · v${esc(info.version)}` : ''}</small>` : '<b>No cloud save yet</b>'}</div></div>
            <div class="wg-acts">
                <button type="button" class="${cls.primary}" data-wgc="up" ${local ? '' : 'disabled'}>⬆️ Save to cloud</button>
                <button type="button" class="${cls.btn}" data-wgc="down" ${has ? '' : 'disabled'}>⬇️ Load from cloud</button>
            </div>
            <label class="wg-check"><input type="checkbox" data-wgc="auto" ${autoOn() ? 'checked' : ''}> Save to the cloud by itself while I play</label>
            <button type="button" class="${cls.btn}" data-wgc="signout">Sign out (of every game)</button>`;
    }

    async function fetchInfo() {
        if (!cloud.signedIn) { info = undefined; return; }
        try { info = await cloud.download(); }
        catch (e) { msg(e.message, 'bad'); if (!cloud.signedIn) info = undefined; }
        render();
        ui.onInfo?.(info);
    }

    async function action(what, el) {
        if (what === 'auto') { setAuto(el.checked); return; }
        if (busy && what !== 'signout') return;
        busy = true;
        try {
            if (what === 'signin') {
                const email = host.querySelector('input[type=email]').value.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg('Type your email address first.', 'bad'); return; }
                msg('Sending…');
                await cloud.signIn(email);
                msg(`Check your inbox at ${email} and tap the link: it brings you back here, signed in. (It can take a minute; look in spam too.)`, 'good');
            } else if (what === 'up') {
                const save = getSave();
                if (!save) { msg('There is no game to save yet.', 'bad'); return; }
                msg('Saving…');
                const s = sum(save);
                await cloud.upload(save, { version, summary: s });
                lastAuto = Date.now();
                info = { data: save, version: String(version), summary: s, updated_at: new Date().toISOString() };
                render(); ui.onInfo?.(info);
                msg('Saved to the cloud. ☁️', 'good');
            } else if (what === 'down') {
                if (info?.data == null) return;
                if (hasGame() && Date.now() - armed > 5000) {
                    armed = Date.now();
                    el.textContent = '⚠️ Tap again to replace this game';
                    msg(`This replaces your game on this device with the cloud save (${info.summary || 'saved ' + ago(info.updated_at)}).`);
                    return;
                }
                armed = 0;
                const data = info.data;
                ui.close();
                await applySave(data);
                toast?.('☁️ Loaded your cloud save', 'good');
            } else if (what === 'signout') {
                await cloud.signOut();
                info = undefined;
                render(); ui.onInfo?.(info);
                msg('Signed out of every game. Your game on this device is still here.');
            }
        } catch (e) {
            msg(e.message || 'Something went wrong.', 'bad');
            if (!cloud.signedIn) { info = undefined; render(); }
        } finally { busy = false; }
    }

    function wire(el) {
        el.addEventListener('click', (e) => { const b = e.target.closest('button[data-wgc]'); if (b && !b.disabled) action(b.dataset.wgc, b); });
        el.addEventListener('change', (e) => { if (e.target.dataset?.wgc === 'auto') action('auto', e.target); });
        el.addEventListener('submit', (e) => { e.preventDefault(); action('signin'); });
    }

    const ui = {
        get info() { return info; },
        get autoOn() { return autoOn(); },
        onInfo: null,             // (info) => {} when the online save is learned or changes (e.g. a title-screen label)

        /** Render inside an element the game owns (its own screen); adds a message line under it. */
        mount(el) {
            injectCSS();
            el.classList.add('wg-cloud');
            el.innerHTML = '<div class="wg-body"></div><p class="wg-msg" aria-live="polite"></p>';
            if (!el.__wgWired) { wire(el); el.__wgWired = true; }
            host = el;
            armed = 0;
            render();
            if (cloud.signedIn) fetchInfo();
        },

        /** A modal dialog of its own. */
        open() {
            injectCSS();
            if (!dialog) {
                dialog = document.createElement('dialog');
                dialog.className = 'wg-cloud';
                dialog.setAttribute('aria-label', title);
                dialog.innerHTML = `<div class="wg-sheet"><div class="wg-head"><h2>☁️ ${esc(title)}</h2><button type="button" class="${cls.btn} wg-x" data-wgclose aria-label="Close">✕</button></div>
                    <div class="wg-body"></div><p class="wg-msg" aria-live="polite"></p>
                    <div class="wg-acts"><button type="button" class="${cls.primary}" data-wgclose>Done</button></div></div>`;
                wire(dialog);
                dialog.addEventListener('click', (e) => { if (e.target.closest('[data-wgclose]') || e.target === dialog) ui.close(); });
                // keep the game's own key handling out of the dialog (Escape still closes it)
                dialog.addEventListener('keydown', (e) => e.stopPropagation());
                dialog.addEventListener('close', () => { host = null; onClose(); });
                document.body.appendChild(dialog);
            }
            host = dialog;
            armed = 0;
            msg('');
            render();
            if (!dialog.open) { dialog.showModal(); onOpen(); }
            if (cloud.signedIn) fetchInfo();
        },

        close() { if (dialog?.open) dialog.close(); },

        /** Re-render (after the game's state changed under an open screen). */
        refresh() { render(); },

        /** Learn the online save without showing anything (e.g. for a title-screen label). */
        check() { return cloud.signedIn ? fetchInfo() : Promise.resolve(); },

        /**
         * At startup: if the page was opened from the emailed link, keep the sign-in and open the dialog (or call
         * onSignedIn to show your own screen). Returns what cloud.consumeRedirect() returned.
         */
        boot({ onSignedIn = () => ui.open() } = {}) {
            const r = cloud.consumeRedirect();
            if (r === 'signed-in') { toast?.(`☁️ Signed in as ${cloud.email || 'you'}`, 'good'); setTimeout(onSignedIn); }
            else if (r) toast?.(`Sign-in didn't work: ${r}`, 'bad');
            else if (cloud.signedIn) setTimeout(() => ui.check());
            return r;
        },

        /**
         * Quietly upload the current save if signed in and the switch is on, at most every 2 minutes (keepalive, for
         * pagehide, ignores the timer). Errors are logged, never shown.
         */
        autosave({ keepalive = false, force = false } = {}) {
            if (!cloud.signedIn || !autoOn() || busy) return;
            if (!keepalive && !force && Date.now() - lastAuto < AUTO_EVERY) return;
            const save = getSave();
            if (!save) return;
            lastAuto = Date.now();
            busy = true;
            const s = sum(save);
            cloud.upload(save, { version, summary: s, keepalive })
                .then(() => { info = { data: save, version: String(version), summary: s, updated_at: new Date().toISOString() }; ui.onInfo?.(info); })
                .catch((e) => console.warn('[cloud]', e.message))
                .finally(() => { busy = false; });
        },
    };
    cloud.onChange(() => { info = undefined; render(); if (cloud.signedIn) fetchInfo(); else ui.onInfo?.(info); });
    return ui;
}
