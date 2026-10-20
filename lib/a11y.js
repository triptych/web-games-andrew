/**
 * a11y.js — baseline accessibility for any game, without touching its code.
 *
 * Include it in <head> next to page-audio.js:
 *
 *   <script src="../lib/a11y.js"></script>
 *
 * It is a single file (the CSS is injected) so the itch exporter copies it
 * like any other /lib script. What it does:
 *
 *   - a visible :focus-visible ring everywhere (games that wrote `outline:none`
 *     lose their ring otherwise) and a 44px "← Games" back link
 *   - honours prefers-reduced-motion for CSS animation/transition
 *   - a polite live region and `window.A11Y.announce(msg)` for game events
 *   - a visually hidden <h1> and a <main> landmark when the page has none
 *   - canvases get role="img" + a label; icon-only buttons are labelled from
 *     their title; tablists get tab roles and aria-selected
 *   - overlay screens/panels (`.screen`, `.panel`, `[role=dialog]`) get dialog
 *     semantics, and focus moves into one when it opens
 *   - `window.A11Y.reducedMotion` for games that want to skip shake/flash
 */
(() => {
    'use strict';
    if (window.A11Y) return;

    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const A11Y = (window.A11Y = {
        reducedMotion: !!(mq && mq.matches),
        announce(msg) {
            const live = ensureLive();
            // Clearing first makes a repeated message get re-read.
            live.textContent = '';
            setTimeout(() => { live.textContent = String(msg); }, 30);
        },
    });
    if (mq) {
        const upd = () => {
            A11Y.reducedMotion = mq.matches;
            document.documentElement.classList.toggle('a11y-reduced-motion', mq.matches);
        };
        upd();
        if (mq.addEventListener) mq.addEventListener('change', upd);
    }

    const css = `
.a11y-sr{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
:focus-visible{outline:3px solid #ffd54a!important;outline-offset:2px!important;box-shadow:0 0 0 5px rgba(0,0,0,.65)}
canvas{touch-action:none}
canvas:focus-visible{outline-offset:-3px!important;box-shadow:none}
a[href="../index.html"][style*="position:fixed"]{display:inline-flex!important;align-items:center;min-height:44px;min-width:44px;box-sizing:border-box;font-size:14px!important;background:rgba(0,0,0,.78)!important;color:#fff!important}
@media (prefers-reduced-motion:reduce){
*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
`;
    const style = document.createElement('style');
    style.id = 'a11y-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    let liveEl = null;
    function ensureLive() {
        if (liveEl && liveEl.isConnected) return liveEl;
        liveEl = document.getElementById('a11y-live');
        if (!liveEl) {
            liveEl = document.createElement('div');
            liveEl.id = 'a11y-live';
            liveEl.className = 'a11y-sr';
            liveEl.setAttribute('role', 'status');
            liveEl.setAttribute('aria-live', 'polite');
            liveEl.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveEl);
        }
        return liveEl;
    }

    const gameName = () => (document.title || 'Game').replace(/\s+[-–—|].*$/, '').trim();

    function labelCanvas(c) {
        if (c.hasAttribute('aria-label') || c.hasAttribute('aria-labelledby') || c.hasAttribute('role')) return;
        if (c.closest('[aria-hidden="true"]') || c.hidden) return;
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', `${gameName()} game view. The game is drawn on a canvas; see the page text for controls.`);
    }

    function labelButton(b) {
        if (b.hasAttribute('aria-label') || b.hasAttribute('aria-labelledby')) return;
        const text = (b.textContent || '').replace(/\s+/g, ' ').trim();
        const hasWord = /[A-Za-z0-9]{2,}/.test(text);
        if (hasWord) return;
        const t = b.getAttribute('title') || b.dataset.label || b.dataset.act || b.id.replace(/^[a-z]-|^(b|btn)-/, '').replace(/[-_]/g, ' ');
        if (t) b.setAttribute('aria-label', t);
    }

    function wireTabs(list) {
        const tabs = [...list.querySelectorAll(':scope > button, :scope > [data-tab]')];
        const sync = () => tabs.forEach((t) => {
            const on = t.classList.contains('on') || t.classList.contains('active') || t.classList.contains('selected') || t.getAttribute('aria-current') === 'true';
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
        });
        tabs.forEach((t) => t.setAttribute('role', 'tab'));
        sync();
        if (list.dataset.a11yTabs) return;
        list.dataset.a11yTabs = '1';
        new MutationObserver(sync).observe(list, { attributes: true, subtree: true, attributeFilter: ['class'] });
        list.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const cur = tabs.indexOf(document.activeElement);
            if (cur < 0) return;
            const next = tabs[(cur + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            next.focus();
            next.click();
            e.preventDefault();
        });
    }

    const OVERLAY = '.screen, [role="dialog"]';
    function enhance(root) {
        root.querySelectorAll('canvas').forEach(labelCanvas);
        root.querySelectorAll('button').forEach(labelButton);
        root.querySelectorAll('[role="tablist"]').forEach(wireTabs);
        root.querySelectorAll('input[type="range"],input[type="checkbox"],select').forEach((el) => {
            if (el.labels && el.labels.length) return;
            if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && el.title) el.setAttribute('aria-label', el.title);
        });
        // Overlay screens with a heading are dialogs.
        root.querySelectorAll(OVERLAY).forEach((el) => {
            if (el.hasAttribute('role') || !el.id) return;
            const h = el.querySelector('h1,h2,h3');
            if (!h) return;
            if (!h.id) h.id = `${el.id}-title`;
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            el.setAttribute('aria-labelledby', h.id);
        });
    }

    // Move focus into an overlay when it is shown, and back out when it closes.
    let opener = null;
    function visible(el) { return !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
    function overlayOpened(el) {
        if (el.getAttribute('role') !== 'dialog' || el.contains(document.activeElement)) return;
        opener = document.activeElement;
        const target = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (target) target.focus({ preventScroll: true });
    }
    function overlayClosed(el) {
        if (el.getAttribute('role') !== 'dialog') return;
        const stillOpen = [...document.querySelectorAll('[role="dialog"]')].some(visible);
        if (!stillOpen && opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
        else if (!stillOpen && document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    }

    function init() {
        const body = document.body;
        ensureLive();
        if (!document.querySelector('h1')) {
            const h = document.createElement('h1');
            h.className = 'a11y-sr';
            h.textContent = gameName();
            body.insertBefore(h, body.firstChild);
        }
        if (!document.querySelector('main, [role="main"]')) {
            const target = document.querySelector('#game-frame, #game, #app, #stage, #wrap, #container, canvas');
            const host = target && (target.tagName === 'CANVAS' ? target.parentElement : target);
            if (host && host !== body && host !== document.documentElement) host.setAttribute('role', 'main');
        }
        enhance(document);

        const known = new WeakMap();
        new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach((n) => { if (n.nodeType === 1) { enhance(n); if (n.matches && n.matches('canvas')) labelCanvas(n); if (n.matches && n.matches('button')) labelButton(n); } });
                } else if (m.type === 'attributes') {
                    const el = m.target;
                    if (!el.matches || !el.matches(OVERLAY)) continue;
                    const now = visible(el);
                    if (known.get(el) === now) continue;
                    known.set(el, now);
                    if (now) overlayOpened(el); else overlayClosed(el);
                }
            }
        }).observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    }

    if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
