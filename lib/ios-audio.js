/**
 * ios-audio.js — make a game's sound work on iPhones and iPads.
 *
 * iOS plays Web Audio through the "ambient" audio session, so with the ringer switch on
 * silent a game is mute, however loud its own volume is. Playing any media element moves the
 * page to the "playback" session, which the switch does not silence. So on the first touch
 * or key this starts a looping silent <audio> (and, where Safari has it, sets
 * navigator.audioSession.type = 'playback'). The loop is paused while the tab is hidden and
 * started again when it comes back.
 *
 * A phone call, Siri or an alarm can leave an AudioContext 'interrupted', and nothing
 * resumes it, so the game stays silent afterwards. This resumes interrupted contexts when
 * they report it, when the tab is shown again, and on the next touch or key.
 *
 * Everywhere else it does nothing. It is a single classic script, so the itch exporter
 * copies it like any other /lib file. Include it in <head>, before the game's own scripts
 * (so it sees every AudioContext the game creates), next to page-audio.js:
 *
 *   <script src="../lib/ios-audio.js"></script>
 *
 * The same fix first shipped in game-100 (Glitterball Groove). `?ios-audio=1` forces it on
 * for tests on other platforms.
 */
(() => {
    'use strict';
    if (window.__iosAudio) return;

    const ua = navigator.userAgent || '';
    const forced = /[?&]ios-audio=1\b/.test(location.search);
    // iPadOS reports itself as a Mac; a Mac with touch points is an iPad.
    const isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const state = (window.__iosAudio = { active: isIOS || forced, contexts: new Set(), media: null, resumed: 0 });
    if (!state.active) return;

    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
    const ref = (o) => (typeof WeakRef === 'function' ? new WeakRef(o) : { deref: () => o });

    function resumeInterrupted() {
        for (const r of state.contexts) {
            const ctx = r.deref();
            if (!ctx) { state.contexts.delete(r); continue; }
            if (ctx.state === 'interrupted') {
                state.resumed++;
                Promise.resolve(ctx.resume?.()).catch(() => {});
            }
        }
    }

    // Track every AudioContext (a subclass keeps instanceof and statics; page-audio.js does the same).
    for (const name of ['AudioContext', 'webkitAudioContext']) {
        const Native = window[name];
        if (typeof Native !== 'function') continue;
        const Tracked = class extends Native {
            constructor(...args) {
                super(...args);
                state.contexts.add(ref(this));
                this.addEventListener?.('statechange', () => {
                    if (this.state === 'interrupted' && !document.hidden) resumeInterrupted();
                });
            }
        };
        Object.defineProperty(Tracked, 'name', { value: name });
        window[name] = Tracked;
    }

    function startSilentLoop() {
        if (state.media) {
            if (state.media.paused && !document.hidden) state.media.play()?.catch?.(() => {});
            return;
        }
        try {
            if (navigator.audioSession) navigator.audioSession.type = 'playback';
            const a = document.createElement('audio');
            a.loop = true;
            a.setAttribute('playsinline', '');
            a.setAttribute('aria-hidden', 'true');
            a.preload = 'auto';
            a.volume = 0.01;
            a.src = SILENT_WAV;
            state.media = a;
            const p = a.play();
            if (p && p.catch) p.catch(() => { state.media = null; });   // not a gesture yet: try again on the next one
        } catch {
            state.media = null;
        }
    }

    const onGesture = () => { startSilentLoop(); resumeInterrupted(); };
    for (const ev of ['touchend', 'pointerdown', 'keydown', 'click']) {
        window.addEventListener(ev, onGesture, { capture: true, passive: true });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.media && !state.media.paused) state.media.pause();
        } else {
            if (state.media && state.media.paused) state.media.play()?.catch?.(() => {});
            resumeInterrupted();
        }
    });
})();
