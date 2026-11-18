// Every sound the console makes is synthesised with Web Audio: the clicker
// under the wheel, blips for select and back, a sparkle for favorites, the
// thunk of a cartridge going in and a boot chime. Nothing is downloaded.
// The context starts on the first gesture and sleeps while the tab is hidden.

let ctx = null;
let noise = null;
let enabled = true;
let lastTick = 0;

function ac() {
    if (!enabled) return null;
    if (!ctx) {
        // wait for a gesture the browser counts (a touch counts on release, not on press)
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        try {
            ctx = new C();
        } catch {
            return null;
        }
        const len = Math.floor(ctx.sampleRate * 0.05);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    return ctx;
}

export function unlockAudio() {
    ac();
}
for (const t of ['pointerup', 'keydown', 'click']) addEventListener(t, unlockAudio, { capture: true, passive: true });

export function setSound(on) {
    enabled = on;
    if (!on && ctx) ctx.suspend().catch(() => {});
    if (on) ac();
}

document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (enabled) ctx.resume().catch(() => {});
});

function tone(freq, at, dur, { type = 'square', vol = 0.05, to = null, attack = 0.004 } = {}) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function click(at = 0, { freq = 3200, vol = 0.32, dur = 0.012 } = {}) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
    s.stop(t + dur + 0.01);
}

export const sfx = {
    tick() {
        const now = performance.now();
        if (now - lastTick < 22) return; // a fast spin would otherwise buzz
        lastTick = now;
        click(0);
    },
    bump() {
        click(0, { freq: 700, vol: 0.4, dur: 0.03 });
    },
    select() {
        tone(988, 0, 0.05, { vol: 0.035 });
        tone(1480, 0.045, 0.07, { vol: 0.03 });
    },
    back() {
        tone(880, 0, 0.05, { vol: 0.03 });
        tone(587, 0.045, 0.07, { vol: 0.03 });
    },
    press() {
        click(0, { freq: 1800, vol: 0.35, dur: 0.02 });
    },
    deny() {
        tone(196, 0, 0.09, { type: 'square', vol: 0.03 });
        tone(185, 0.08, 0.1, { type: 'square', vol: 0.03 });
    },
    fav(on) {
        const notes = on ? [1047, 1319, 1568, 2093] : [1568, 1175, 880];
        notes.forEach((f, i) => tone(f, i * 0.055, 0.12, { type: 'triangle', vol: 0.06 }));
    },
    toggle() {
        tone(1319, 0, 0.04, { vol: 0.03 });
    },
    insert() {
        tone(170, 0, 0.18, { type: 'sine', vol: 0.18, to: 55 });
        click(0.0, { freq: 900, vol: 0.5, dur: 0.05 });
        click(0.16, { freq: 2400, vol: 0.4, dur: 0.02 });
    },
    boot() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.05 + i * 0.07, 0.6 - i * 0.05, { type: 'triangle', vol: 0.05, attack: 0.01 }));
        tone(2093, 0.4, 0.5, { type: 'sine', vol: 0.03 });
    },
    reel(step) {
        tone(600 + (step % 6) * 90, 0, 0.03, { vol: 0.025 });
    },
    // the dragonfly pet: a happy trill, a bite, a sad little drop, and the whoosh of a trick
    chirp() {
        [1760, 2349, 3136].forEach((f, i) => tone(f * 0.8, i * 0.06, 0.06, { type: 'triangle', vol: 0.045, to: f }));
    },
    chomp() {
        click(0, { freq: 1100, vol: 0.45, dur: 0.035 });
        tone(330, 0, 0.05, { type: 'square', vol: 0.025, to: 220 });
    },
    sad() {
        tone(880, 0, 0.12, { type: 'triangle', vol: 0.04, to: 660 });
        tone(660, 0.12, 0.18, { type: 'triangle', vol: 0.035, to: 440 });
    },
    whoosh() {
        tone(320, 0, 0.35, { type: 'sine', vol: 0.06, to: 1400 });
        click(0.05, { freq: 2600, vol: 0.2, dur: 0.25 });
    },
};
