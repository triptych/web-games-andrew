// Speaks the announcer's lines with the browser's own speech synthesis (no audio files), and shows each one
// as a caption. Two voices: a reporter (a female English voice if the device has one, else a high pitch)
// and a military commander (a male voice if there is one, else a low pitch) with a radio squelch around it.
//
// One line is spoken at a time. A more important line interrupts a less important one; otherwise it waits
// in a single slot and is dropped if it is stale by the time the voice is free.

const FEMALE = /(female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|susan|hazel|aria|jenny|libby|sonia|serena|allison|ava|joanna|kendra|kimberly|salli|emma|amy|nicole|olivia|natasha|catherine|heather|linda|microsoft eva|google uk english female|google us english)/i;
const MALE = /(\bmale\b|daniel|\balex\b|fred|david|\bmark\b|george|james|\bguy\b|ryan|arthur|oliver|matthew|brian|joey|justin|russell|thomas|gordon|\blee\b|rishi|google uk english male|microsoft (david|mark|guy))/i;

/** Pick a reporter voice and a commander voice from what the device offers. Exported for the tests. */
export function pickVoices(list) {
    const en = list.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : list;
    const isF = (v) => FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, ''));
    const isM = (v) => MALE.test(v.name) && !FEMALE.test(v.name);
    const reporter = pool.find(isF) || null;
    const army = pool.find((v) => isM(v) && v !== reporter) || null;
    const fallback = pool.find((v) => v.default) || pool[0] || null;
    return {
        news: { voice: reporter || fallback, pitch: reporter ? 1.12 : 1.4, rate: 1.1 },
        army: { voice: army || (reporter ? pool.find((v) => v !== reporter) : fallback) || fallback, pitch: army ? 0.75 : 0.5, rate: 1.05 },
    };
}

export class Speaker {
    /**
     * opts.settings: the live settings object ({ voice: 'on' | 'captions' | 'off', voiceVol })
     * opts.caption(line, seconds): show a caption; opts.radio('open' | 'close'); opts.talking(bool): duck the music.
     */
    constructor({ settings, caption, radio, talking }) {
        this.settings = settings;
        this.caption = caption || (() => {});
        this.radio = radio || (() => {});
        this.talking = talking || (() => {});
        this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
        this.cfg = pickVoices([]);
        this.cur = null;         // the line being spoken
        this.pending = null;     // the line waiting its turn
        this.timer = null;
        this.log = [];           // the last lines, for the tests
        this.spoken = 0;
        if (this.synth) {
            const refresh = () => { try { this.cfg = pickVoices(this.synth.getVoices()); } catch { /* no voices */ } };
            refresh();
            this.synth.addEventListener?.('voiceschanged', refresh);
        }
    }

    get mode() { return this.settings.voice || 'on'; }
    get speaking() { return !!this.cur; }

    /** Offer a line. It may speak now, wait, or be dropped. */
    say(line) {
        if (this.mode === 'off') return;
        line.at = performance.now();
        this.log.push(line.ch + ': ' + line.text);
        if (this.log.length > 30) this.log.shift();
        if (!this.cur) { this.start(line); return; }
        const c = this.cur;
        const interrupts = line.pri > c.pri || (line.pri === c.pri && line.ch === 'army' && c.ch === 'news' && c.pri < 3);
        if (interrupts) { this.stop(false); this.start(line); return; }
        if (!this.pending || line.pri >= this.pending.pri) this.pending = line;
    }

    /** Time to say a line aloud, in seconds. */
    static estimate(text, rate = 1) { return Math.max(1.5, text.split(/\s+/).length / (2.7 * rate) + 0.7); }

    start(line) {
        this.cur = line;
        const cfg = this.cfg[line.ch] || this.cfg.news;
        const dur = Speaker.estimate(line.text, cfg.rate);
        this.caption(line, dur + 1.2);
        if (line.ch === 'army') this.radio('open');
        this.talking(true);
        // the caption and the music duck run whether or not a voice is available
        const finish = () => { if (this.cur === line) this.finish(); };
        this.timer = setTimeout(finish, (dur + 0.6) * 1000);
        if (this.mode !== 'on' || !this.synth || !(this.settings.voiceVol > 0)) return;
        try {
            const u = new SpeechSynthesisUtterance(line.text);
            if (cfg.voice) { u.voice = cfg.voice; u.lang = cfg.voice.lang; }
            u.pitch = cfg.pitch; u.rate = cfg.rate; u.volume = Math.max(0, Math.min(1, this.settings.voiceVol));
            u.onend = () => { if (this.cur === line) this.finish(); };
            u.onerror = () => { if (this.cur === line && !line.cancelled) this.finish(); };
            line.utter = u;
            setTimeout(() => { if (this.cur === line) { try { this.synth.speak(u); this.spoken++; } catch { /* blocked */ } } }, 25);
        } catch { /* speech not available: the caption and the timer still run */ }
    }

    /** A line has been said (or its time is up). */
    finish() {
        clearTimeout(this.timer);
        const line = this.cur;
        this.cur = null;
        if (line?.ch === 'army') this.radio('close');
        this.talking(false);
        const next = this.pending;
        this.pending = null;
        if (next && performance.now() - next.at < 3500) this.start(next);
    }

    /** Stop speaking. With drop true the waiting line goes too. */
    stop(drop = true) {
        clearTimeout(this.timer);
        if (this.cur) this.cur.cancelled = true;
        this.cur = null;
        if (drop) this.pending = null;
        try { this.synth?.cancel(); } catch { /* nothing to cancel */ }
        this.talking(false);
    }
}
