// Dev-only balance probe. Runs scripted bots of different skill levels through
// real runs and reports how far each gets, so the difficulty curve can be tuned
// against numbers instead of vibes.

globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {} }) }),
    addEventListener: () => {}
};
globalThis.window = { addEventListener: () => {}, devicePixelRatio: 1 };
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
};

const { updateProbe } = await import('../js/game/probe.js');
const wake = await import('../js/game/wake.js');
const motes = await import('../js/game/motes.js');
const C = await import('../js/game/constants.js');
const { tickWave } = await import('../js/game/waves.js');
const st = await import('../js/game/state.js');

const DT = 1 / 60;

/** Mirrors the wave state machine in main.js stepGame, so the probe measures
 *  the real game rather than a divergent copy of it. */
function advance(rs) {
    const res = st.advancePhase(rs, DT, motes.moteCount() === 0);
    if (rs.run.phase === st.PHASE.ACTIVE && rs.waveObj) {
        if (tickWave(rs.waveObj, DT)) rs.run.phase = st.PHASE.DRAINING;
    } else if (rs.run.phase === st.PHASE.DRAINING) {
        if (motes.moteCount() === 0) st.completeWave(rs);
        else if (res && res.forceNextWave) st.completeWave(rs, false);
    }
}
const NOOP_FX = {
    onAbsorb() {}, onCoreHit() {}, onSplit() {}, onFlip() {}, onShed() {},
    onReclaim() {}, onEchoEaten() {}, onChainBreak() {}, onFluxEmpty() {},
    onWaveStart() {}, onSurge() {}
};

/**
 * Bot skill levels:
 *  idle     does nothing (floor)
 *  chaser   flies at the nearest mote and flips to absorb it (a new player)
 *  builder  chaser, but lays a same-polarity arc inside the ring when idle,
 *           which is roughly what a player who has read the instructions does
 */
function runBot(skill, seed, maxSeconds = 300) {
    const rs = st.newRun(seed);
    wake.resetWake();
    motes.resetMotes();
    const unbind = st.bindRunEvents(rs, NOOP_FX);

    let frames = 0;
    const maxFrames = maxSeconds * 60;

    while (frames < maxFrames && rs.run.phase !== st.PHASE.OVER) {
        const input = { axis: { x: 0, y: 0 }, flip: false, silent: false, pause: false };
        const p = rs.probe;

        if (skill !== 'idle') {
            const list = motes.getMotes();
            let best = null;
            let bd = Infinity;
            for (const m of list) {
                // Prioritise whatever is closest to the core: that is the threat.
                const dCore = Math.hypot(m.x - C.CORE_X, m.y - C.CORE_Y);
                const dMe = Math.hypot(m.x - p.x, m.y - p.y);
                const rank = dCore * 1.4 + dMe;
                if (rank < bd) { bd = rank; best = m; }
            }

            if (best) {
                const dx = best.x - p.x;
                const dy = best.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                input.axis = { x: dx / d, y: dy / d };
                const want = best.kind === C.MOTE_KIND.ANCHOR ? p.pol : -best.pol;
                if (p.pol !== want && p.flux > C.FLUX_PER_FLIP * 2) input.flip = true;
            } else if (skill === 'builder') {
                // Nothing to chase: patrol a mid-radius circle laying a wall.
                const a = frames * 0.02;
                const tx = C.CORE_X + Math.cos(a) * 46;
                const ty = C.CORE_Y + Math.sin(a) * 46;
                const dx = tx - p.x;
                const dy = ty - p.y;
                const d = Math.hypot(dx, dy) || 1;
                input.axis = { x: dx / d, y: dy / d };
            } else {
                input.silent = true;
            }
            // Stop building when flux runs low, so the bot does not starve.
            if (p.flux < 18) input.silent = true;
        }

        updateProbe(p, input, DT);
        wake.updateWake(DT, p, input);
        motes.updateMotes(DT, p, rs.difficulty);
        const sc = rs.score;
        if (sc.chainT > 0) sc.chainT -= DT;
        advance(rs);
        frames++;
    }
    unbind();
    return {
        wave: rs.run.wave,
        score: rs.score.score,
        absorbed: rs.score.absorbed,
        seconds: +(frames / 60).toFixed(1),
        died: rs.run.phase === st.PHASE.OVER,
        containment: rs.run.containment,
        best: rs.score.best
    };
}

const seeds = ['WAKE-AAAA', 'WAKE-BBBB', 'WAKE-CCCC', 'WAKE-DDDD', 'WAKE-EEEE'];

/**
 * A "trapper" bot: it pre-builds a ring of negative echoes at a fixed radius
 * BEFORE motes arrive, then only intervenes to harvest what the ring catches.
 * This is the strategy the game is designed to reward; if it does not beat the
 * naive chaser, the core mechanic is not actually paying for itself.
 */
function runTrapper(seed, maxSeconds = 300) {
    const rs = st.newRun(seed);
    wake.resetWake();
    motes.resetMotes();
    const unbind = st.bindRunEvents(rs, NOOP_FX);
    let frames = 0;
    const maxFrames = maxSeconds * 60;

    // One fixed trap site: a knot the bot maintains and periodically harvests.
    const TRAP_A = 0.9;
    const TRAP_R = 52;
    const trapX = C.CORE_X + Math.cos(TRAP_A) * TRAP_R;
    const trapY = C.CORE_Y + Math.sin(TRAP_A) * TRAP_R;
    let mode = 'build';

    while (frames < maxFrames && rs.run.phase !== st.PHASE.OVER) {
        const input = { axis: { x: 0, y: 0 }, flip: false, silent: false, pause: false };
        const p = rs.probe;
        const list = motes.getMotes();

        // How many motes are currently held near the trap?
        let caught = 0;
        for (const m of list) {
            if (Math.hypot(m.x - trapX, m.y - trapY) < 20) caught++;
        }
        // Anything nearly at the core has to be dealt with immediately.
        let urgent = null, ud = Infinity;
        for (const m of list) {
            const dc = Math.hypot(m.x - C.CORE_X, m.y - C.CORE_Y);
            if (dc < 30 && dc < ud) { ud = dc; urgent = m; }
        }

        // Harvest once the trap is worth a chain, and keep harvesting until it
        // is empty; otherwise maintain the trap.
        if (mode === 'harvest' && caught === 0) mode = 'build';
        else if (mode === 'build' && caught >= 4) mode = 'harvest';

        const seek = (tx, ty) => {
            const dx = tx - p.x, dy = ty - p.y;
            const d = Math.hypot(dx, dy) || 1;
            input.axis = { x: dx / d, y: dy / d };
            return d;
        };
        const flipTo = (pol) => {
            if (p.pol !== pol && p.flux > C.FLUX_PER_FLIP * 2) input.flip = true;
        };

        if (urgent) {
            seek(urgent.x, urgent.y);
            flipTo(urgent.kind === C.MOTE_KIND.ANCHOR ? p.pol : -urgent.pol);
            input.silent = true;
        } else if (mode === 'harvest') {
            // Fly into the knot flipped to absorb whatever it holds.
            let target = null, td = Infinity;
            for (const m of list) {
                const d = Math.hypot(m.x - p.x, m.y - p.y);
                if (Math.hypot(m.x - trapX, m.y - trapY) < 22 && d < td) { td = d; target = m; }
            }
            if (target) {
                seek(target.x, target.y);
                flipTo(target.kind === C.MOTE_KIND.ANCHOR ? p.pol : -target.pol);
            } else {
                seek(trapX, trapY);
            }
            input.silent = true;   // harvesting must not overwrite the trap
        } else {
            // Build/maintain: orbit the trap site laying NEGATIVE echoes, which
            // attract the POSITIVE motes and hold them there.
            const a = frames * 0.05;
            seek(trapX + Math.cos(a) * 8, trapY + Math.sin(a) * 8);
            flipTo(C.NEG);
            if (p.flux < 22) input.silent = true;
        }

        updateProbe(p, input, DT);
        wake.updateWake(DT, p, input);
        motes.updateMotes(DT, p, rs.difficulty);
        if (rs.score.chainT > 0) rs.score.chainT -= DT;
        advance(rs);
        frames++;
    }
    unbind();
    return {
        wave: rs.run.wave, score: rs.score.score, absorbed: rs.score.absorbed,
        seconds: +(frames / 60).toFixed(1), died: rs.run.phase === st.PHASE.OVER,
        containment: rs.run.containment, best: rs.score.best
    };
}

/**
 * The "shepherd": the strategy the design actually intends. It intercepts like
 * a chaser, but instead of flying straight at a mote it approaches from the
 * core side at the SAME polarity, so its own field shoves the mote outward
 * while the echoes it sheds on the way leave a standing wall behind it. Then it
 * flips to collect. Wake as a tool, not as a static fortress.
 */
function runShepherd(seed, maxSeconds = 300) {
    const rs = st.newRun(seed);
    wake.resetWake();
    motes.resetMotes();
    const unbind = st.bindRunEvents(rs, NOOP_FX);
    let frames = 0;
    const maxFrames = maxSeconds * 60;

    while (frames < maxFrames && rs.run.phase !== st.PHASE.OVER) {
        const input = { axis: { x: 0, y: 0 }, flip: false, silent: false, pause: false };
        const p = rs.probe;
        const list = motes.getMotes();

        let best = null, bd = Infinity;
        for (const m of list) {
            const dCore = Math.hypot(m.x - C.CORE_X, m.y - C.CORE_Y);
            const dMe = Math.hypot(m.x - p.x, m.y - p.y);
            const rank = dCore * 1.5 + dMe * 0.8;
            if (rank < bd) { bd = rank; best = m; }
        }

        if (best) {
            const dMe = Math.hypot(best.x - p.x, best.y - p.y);
            const anchor = best.kind === C.MOTE_KIND.ANCHOR;
            // Close enough to collect: flip opposite and take it.
            if (dMe < 14 || anchor) {
                const dx = best.x - p.x, dy = best.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                input.axis = { x: dx / d, y: dy / d };
                if (!anchor && p.pol !== -best.pol && p.flux > C.FLUX_PER_FLIP * 2) {
                    input.flip = true;
                }
                input.silent = true;
            } else {
                // Approach from the core side, same polarity, shedding a wall.
                const ang = Math.atan2(best.y - C.CORE_Y, best.x - C.CORE_X);
                const rMote = Math.hypot(best.y - C.CORE_Y, best.x - C.CORE_X);
                const tx = C.CORE_X + Math.cos(ang) * Math.max(16, rMote - 16);
                const ty = C.CORE_Y + Math.sin(ang) * Math.max(16, rMote - 16);
                const dx = tx - p.x, dy = ty - p.y;
                const d = Math.hypot(dx, dy) || 1;
                input.axis = { x: dx / d, y: dy / d };
                if (p.pol !== best.pol && p.flux > C.FLUX_PER_FLIP * 2) input.flip = true;
                if (p.flux < 20) input.silent = true;
            }
        }

        updateProbe(p, input, DT);
        wake.updateWake(DT, p, input);
        motes.updateMotes(DT, p, rs.difficulty);
        if (rs.score.chainT > 0) rs.score.chainT -= DT;
        advance(rs);
        frames++;
    }
    unbind();
    return {
        wave: rs.run.wave, score: rs.score.score, absorbed: rs.score.absorbed,
        seconds: +(frames / 60).toFixed(1), died: rs.run.phase === st.PHASE.OVER,
        containment: rs.run.containment, best: rs.score.best
    };
}

for (const skill of ['idle', 'chaser', 'builder']) {
    const rows = seeds.map((s) => runBot(skill, s));
    const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
    console.log(
        skill.padEnd(8),
        'wave', avg((r) => r.wave).padStart(5),
        '| score', avg((r) => r.score).padStart(7),
        '| motes', avg((r) => r.absorbed).padStart(5),
        '| secs', avg((r) => r.seconds).padStart(6),
        '| died', rows.filter((r) => r.died).length + '/' + rows.length
    );
}

{
    const rows = seeds.map((s) => runTrapper(s));
    const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
    console.log(
        'trapper'.padEnd(8),
        'wave', avg((r) => r.wave).padStart(5),
        '| score', avg((r) => r.score).padStart(7),
        '| motes', avg((r) => r.absorbed).padStart(5),
        '| secs', avg((r) => r.seconds).padStart(6),
        '| bestchain', avg((r) => r.best).padStart(4),
        '| died', rows.filter((r) => r.died).length + '/' + rows.length
    );
}

{
    const rows = seeds.map((s) => runShepherd(s));
    const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
    console.log(
        'shepherd'.padEnd(8),
        'wave', avg((r) => r.wave).padStart(5),
        '| score', avg((r) => r.score).padStart(7),
        '| motes', avg((r) => r.absorbed).padStart(5),
        '| secs', avg((r) => r.seconds).padStart(6),
        '| bestchain', avg((r) => r.best).padStart(4),
        '| died', rows.filter((r) => r.died).length + '/' + rows.length
    );
}

// How long does wave 1 give a brand-new player before the first breach?
const first = runBot('idle', 'WAKE-AAAA', 60);
console.log('\nidle player loses containment after', first.seconds, 'seconds');
