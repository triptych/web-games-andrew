/**
 * page-audio.js — silence a game while its tab is hidden.
 *
 * Every game from 037 on suspends its audio on `visibilitychange`; most early
 * games predate that and keep playing music in a background tab. This file
 * adds the behaviour to any game without touching its code: it notes every
 * AudioContext the page creates (Kaplay, Phaser, three.js and hand-written
 * Web Audio all use the standard constructor) and every media element that
 * starts playing, then suspends or pauses whichever were running when the tab
 * is hidden and resumes exactly those when it comes back.
 *
 * Include it in <head>, before the game's own scripts, so it is in place
 * before the game creates its first AudioContext:
 *
 *   <script src="../lib/page-audio.js"></script>
 */
(() => {
    'use strict';
    if (window.__pageAudio) return;

    // Weak references, so a game that makes a context per sound doesn't leak.
    const contexts = new Set();
    const media = new Set();
    const ref = (o) => (typeof WeakRef === 'function' ? new WeakRef(o) : { deref: () => o });
    const each = (set, fn) => {
        for (const r of set) {
            const o = r.deref();
            if (o) fn(o); else set.delete(r);
        }
    };

    for (const name of ['AudioContext', 'webkitAudioContext']) {
        const Native = window[name];
        if (typeof Native !== 'function') continue;
        // A subclass keeps `instanceof`, static members and the prototype chain intact.
        const Tracked = class extends Native {
            constructor(...args) {
                super(...args);
                contexts.add(ref(this));
            }
        };
        Object.defineProperty(Tracked, 'name', { value: name });
        window[name] = Tracked;
    }

    if (window.HTMLMediaElement) {
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
            if (!this.__pageAudioTracked) {
                this.__pageAudioTracked = true;
                media.add(ref(this));
            }
            return play.apply(this, args);
        };
    }

    const suspended = new Set();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            each(contexts, (ctx) => {
                if (ctx.state === 'running') {
                    suspended.add(ctx);
                    ctx.suspend().catch(() => {});
                }
            });
            each(media, (el) => {
                if (!el.paused) {
                    suspended.add(el);
                    el.pause();
                }
            });
        } else {
            for (const o of suspended) {
                if (o instanceof HTMLMediaElement) o.play().catch(() => {});
                else if (o.state === 'suspended') o.resume().catch(() => {});
            }
            suspended.clear();
        }
    });

    window.__pageAudio = { contexts, media };
})();
