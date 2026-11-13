/**
 * pwa.js — make a game installable.
 *
 * Each game's index.html links its own manifest.webmanifest (see
 * dev/add-pwa.mjs). This script does the rest, with no game code involved:
 *
 *  1. registers the shared service worker (../sw.js) scoped to the game's
 *     folder, so the game can be installed and reopened offline;
 *  2. when the browser says the game can be installed, shows a small
 *     "Install" pill (dismissible; a dismissal is remembered for 30 days).
 *     Browsers that never fire that event (Safari, Firefox) are unaffected:
 *     use Share > Add to Home Screen there; the page links an apple-touch-icon.
 *
 * It also fires `window` events a game can listen to if it wants its own
 * button: `pwa-installable` (and call `window.installGame()`), `pwa-installed`.
 *
 *   <script src="../lib/pwa.js" defer></script>
 */
(() => {
    'use strict';
    if (window.__pwa) return;
    window.__pwa = true;

    const script = document.currentScript;
    const DISMISS_KEY = 'pwa-install-dismissed';
    const DISMISS_MS = 30 * 24 * 3600 * 1000;
    const standalone = () => matchMedia('(display-mode: standalone)').matches
        || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

    // ---- 1. service worker --------------------------------------------------
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        const swUrl = script && script.src ? new URL('../sw.js', script.src).href : null;
        const scope = new URL('./', location.href).href;
        if (swUrl) {
            const register = () => navigator.serviceWorker.register(swUrl, { scope }).catch(() => {});
            if (document.readyState === 'complete') register();
            else addEventListener('load', register, { once: true });
        }
    }

    // ---- 2. install prompt --------------------------------------------------
    let deferred = null;
    const read = () => { try { return Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch (e) { return 0; } };
    const write = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) { /* blocked */ } };

    window.installGame = async () => {
        if (!deferred) return 'unavailable';
        const ev = deferred;
        deferred = null;
        ev.prompt();
        const { outcome } = await ev.userChoice;
        return outcome;
    };

    let pill = null;
    const hidePill = () => { if (pill) { pill.remove(); pill = null; } };

    function showPill() {
        if (pill || standalone() || Date.now() - read() < DISMISS_MS) return;
        pill = document.createElement('div');
        pill.setAttribute('role', 'group');
        pill.setAttribute('aria-label', 'Install this game');
        pill.style.cssText = 'position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);'
            + 'z-index:2147483000;display:flex;align-items:center;gap:4px;padding:4px 4px 4px 14px;border-radius:999px;'
            + 'background:rgba(20,20,28,.92);color:#fff;font:600 14px/1.2 system-ui,sans-serif;'
            + 'box-shadow:0 4px 18px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);transition:opacity .4s';
        const label = document.createElement('span');
        label.textContent = 'Install this game';
        const go = document.createElement('button');
        go.textContent = 'Install';
        go.style.cssText = 'font:inherit;border:0;border-radius:999px;padding:8px 14px;margin-left:8px;background:#ffd24a;color:#201800;cursor:pointer;min-height:36px';
        const no = document.createElement('button');
        no.textContent = '✕';
        no.setAttribute('aria-label', 'Dismiss');
        no.style.cssText = 'font:inherit;border:0;background:none;color:#fff;cursor:pointer;width:36px;height:36px;border-radius:50%';
        go.addEventListener('click', () => { hidePill(); window.installGame(); });
        no.addEventListener('click', () => { write(); hidePill(); });
        // keys and pointer taps on the pill must not reach the game underneath
        for (const type of ['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart']) pill.addEventListener(type, (e) => e.stopPropagation());
        pill.append(label, go, no);
        (document.body || document.documentElement).appendChild(pill);
        // it is an offer, not a banner: fade after a while (it comes back next visit)
        setTimeout(() => { if (pill) { pill.style.opacity = '0'; setTimeout(hidePill, 450); } }, 20000);
    }

    addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        dispatchEvent(new Event('pwa-installable'));
        if (document.body) showPill();
        else addEventListener('DOMContentLoaded', showPill, { once: true });
    });
    addEventListener('appinstalled', () => { deferred = null; hidePill(); dispatchEvent(new Event('pwa-installed')); });
})();
