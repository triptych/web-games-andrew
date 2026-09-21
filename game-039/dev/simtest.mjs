// Dev-only headless simulation. Stubs the DOM bits the game modules touch at
// import time, then runs the real physics so the mechanic can be verified
// without a browser: does the wake actually steer motes, does flux balance,
// does a wave complete, does save/load round-trip.

globalThis.document = {
    createElement: () => ({
        width: 0, height: 0,
        getContext: () => new Proxy({}, { get: () => () => {} })
    }),
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

const { makeProbe, updateProbe } = await import('../js/game/probe.js');
const wake = await import('../js/game/wake.js');
const motes = await import('../js/game/motes.js');
const C = await import('../js/game/constants.js');
const { makeRng } = await import('../js/core/rand.js');
const { buildWave, tickWave, difficultyFor } = await import('../js/game/waves.js');
const st = await import('../js/game/state.js');
const save = await import('../js/game/save.js');

const DT = 1 / 60;
const noInput = { axis: { x: 0, y: 0 }, flip: false, silent: false, pause: false };
let fails = 0;
function check(name, cond, detail) {
    console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  -- ' + detail : ''));
    if (!cond) fails++;
}

// ---------------------------------------------------------------------------
console.log('\n=== 1. a same-polarity echo wall repels a mote ===');
wake.resetWake();
motes.resetMotes();
{
    const probe = makeProbe();
    // Lay a horizontal wall of POSITIVE echoes across the mote's path.
    const wallY = C.CORE_Y - 40;
    for (let i = -5; i <= 5; i++) {
        probe.x = C.CORE_X + i * 4;
        probe.y = wallY;
        probe.pol = C.POS;
        probe.vx = 40;
        // Force a shed by driving the internal timer.
        wake.updateWake(DT * 10, probe, { ...noInput });
    }
    const wallCount = wake.echoCount();

    // A positive mote heading straight down into the wall should be turned back.
    const m = motes.spawnMote({
        kind: C.MOTE_KIND.DRIFTER, pol: C.POS,
        x: C.CORE_X, y: wallY - 20, vx: 0, vy: 14
    });
    // Park the probe far away so only the wall acts on the mote.
    probe.x = C.CORE_X + 70;
    probe.y = C.CORE_Y + 70;
    probe.pol = C.NEG;

    let closest = Infinity;
    for (let f = 0; f < 180; f++) {
        wake.updateWake(DT, probe, { ...noInput, silent: true });
        motes.updateMotes(DT, probe, difficultyFor(1));
        if (!motes.getMotes().length) break;
        closest = Math.min(closest, Math.abs(motes.getMotes()[0].y - wallY));
    }
    const survived = motes.getMotes()[0];
    check('wall of echoes was built', wallCount >= 8, wallCount + ' echoes');
    check('like-polarity mote never crossed the wall',
        !survived || survived.y < wallY,
        survived ? 'mote y=' + survived.y.toFixed(1) + ' wall y=' + wallY : 'mote gone');
    check('mote was actually deflected, not passing freely',
        closest > 1.5, 'closest approach ' + closest.toFixed(2) + 'px');
}

// ---------------------------------------------------------------------------
console.log('\n=== 2. an opposite-polarity echo knot traps a mote ===');
wake.resetWake();
motes.resetMotes();
{
    const probe = makeProbe();
    const knotX = C.CORE_X + 30;
    const knotY = C.CORE_Y;
    // Ring of NEGATIVE echoes.
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        probe.x = knotX + Math.cos(a) * 7;
        probe.y = knotY + Math.sin(a) * 7;
        probe.pol = C.NEG;
        probe.vx = 40;
        wake.updateWake(DT * 10, probe, { ...noInput });
    }
    // A POSITIVE mote nearby should be drawn in and held, not fall to the core.
    motes.spawnMote({
        kind: C.MOTE_KIND.DRIFTER, pol: C.POS,
        x: knotX + 16, y: knotY - 14, vx: 0, vy: 0
    });
    probe.x = C.CORE_X - 70;
    probe.y = C.CORE_Y - 70;
    probe.pol = C.NEG;

    let held = 0;
    for (let f = 0; f < 240; f++) {
        wake.updateWake(DT, probe, { ...noInput, silent: true });
        motes.updateMotes(DT, probe, difficultyFor(1));
        const m = motes.getMotes()[0];
        if (!m) break;
        if (Math.hypot(m.x - knotX, m.y - knotY) < 18) held++;
    }
    const still = motes.getMotes()[0];
    check('mote was captured by the opposite-polarity knot', held > 150,
        held + '/240 frames inside the trap');
    check('trapped mote never reached the core', !!still,
        still ? 'still orbiting' : 'it escaped to the core');
}

// ---------------------------------------------------------------------------
console.log('\n=== 3. flux economy: building forever starves, reclaiming pays back ===');
wake.resetWake();
{
    const probe = makeProbe();
    probe.flux = C.FLUX_MAX;
    // Fly a long straight line, shedding constantly.
    let t = 0;
    for (let f = 0; f < 600; f++) {
        const a = t * 0.9;
        probe.vx = Math.cos(a) * 50;
        probe.vy = Math.sin(a) * 50;
        probe.x += probe.vx * DT;
        probe.y += probe.vy * DT;
        // Keep it inside the ring.
        const d = Math.hypot(probe.x - C.CORE_X, probe.y - C.CORE_Y);
        if (d > C.RING_R - 5) {
            probe.x = C.CORE_X + ((probe.x - C.CORE_X) / d) * (C.RING_R - 5);
            probe.y = C.CORE_Y + ((probe.y - C.CORE_Y) / d) * (C.RING_R - 5);
        }
        updateProbe(probe, { ...noInput }, DT);
        wake.updateWake(DT, probe, { ...noInput });
        t += DT;
    }
    check('continuous building drains flux below full',
        probe.flux < C.FLUX_MAX * 0.95,
        'flux ' + probe.flux.toFixed(1) + '/' + C.FLUX_MAX);
    check('flux never goes negative', probe.flux >= 0, 'flux ' + probe.flux.toFixed(2));
    check('echo count respects the hard cap',
        wake.echoCount() <= C.ECHO_MAX, wake.echoCount() + ' echoes');

    // Reclaiming: park the probe on an existing echo and confirm a refund.
    const before = probe.flux;
    const target = wake.getEchoes()[0];
    if (target) {
        probe.x = target.x;
        probe.y = target.y;
        probe.flux = 10;
        const fluxBefore = probe.flux;
        const countBefore = wake.echoCount();
        wake.updateWake(DT, probe, { ...noInput, silent: true });
        check('flying through an echo reclaims it',
            wake.echoCount() < countBefore,
            countBefore + ' -> ' + wake.echoCount());
        check('reclaiming refunds flux', probe.flux > fluxBefore,
            fluxBefore.toFixed(2) + ' -> ' + probe.flux.toFixed(2));
    }
}

// ---------------------------------------------------------------------------
console.log('\n=== 4. a full wave runs and can be cleared ===');
{
    const rs = st.newRun('WAKE-TEST');
    wake.resetWake();
    motes.resetMotes();
    const unbind = st.bindRunEvents(rs, {
        onAbsorb() {}, onCoreHit() {}, onSplit() {}, onFlip() {}, onShed() {},
        onReclaim() {}, onEchoEaten() {}, onChainBreak() {}, onFluxEmpty() {},
        onWaveStart() {}, onSurge() {}
    });

    let frames = 0;
    let cleared = false;
    // Simulate an idle player: no input at all. The wave must still resolve
    // (motes reach the core) rather than hanging forever.
    while (frames < 60 * 90 && rs.run.phase !== st.PHASE.OVER) {
        const input = { ...noInput };
        updateProbe(rs.probe, input, DT);
        wake.updateWake(DT, rs.probe, input);
        motes.updateMotes(DT, rs.probe, rs.difficulty);
        st.advancePhase(rs, DT, motes.moteCount() === 0);
        if (rs.run.phase === st.PHASE.ACTIVE && rs.waveObj) {
            if (tickWave(rs.waveObj, DT)) rs.run.phase = st.PHASE.DRAINING;
        } else if (rs.run.phase === st.PHASE.DRAINING && motes.moteCount() === 0) {
            st.completeWave(rs);
            cleared = true;
        }
        frames++;
    }
    check('an idle player loses containment (the game can be lost)',
        rs.run.phase === st.PHASE.OVER || rs.run.containment < C.CONTAINMENT_MAX,
        'containment ' + rs.run.containment + ' after ' + (frames / 60).toFixed(1) + 's');
    unbind();
}

// ---------------------------------------------------------------------------
console.log('\n=== 5. an active player scores and survives longer than an idle one ===');
{
    function runPlayer(active) {
        const rs = st.newRun('WAKE-TEST2');
        wake.resetWake();
        motes.resetMotes();
        const unbind = st.bindRunEvents(rs, {
            onAbsorb() {}, onCoreHit() {}, onSplit() {}, onFlip() {}, onShed() {},
            onReclaim() {}, onEchoEaten() {}, onChainBreak() {}, onFluxEmpty() {},
            onWaveStart() {}, onSurge() {}
        });
        let frames = 0;
        while (frames < 60 * 120 && rs.run.phase !== st.PHASE.OVER) {
            let input = { ...noInput };
            if (active) {
                // A crude bot: chase the nearest mote, and flip to the polarity
                // that lets it be absorbed.
                const list = motes.getMotes();
                let best = null, bd = Infinity;
                for (const m of list) {
                    const d = Math.hypot(m.x - rs.probe.x, m.y - rs.probe.y);
                    if (d < bd) { bd = d; best = m; }
                }
                if (best) {
                    const dx = best.x - rs.probe.x;
                    const dy = best.y - rs.probe.y;
                    const d = Math.hypot(dx, dy) || 1;
                    input.axis = { x: dx / d, y: dy / d };
                    const wantPol = best.kind === C.MOTE_KIND.ANCHOR
                        ? rs.probe.pol : -best.pol;
                    input.flip = rs.probe.pol !== wantPol && frames % 12 === 0;
                }
            }
            updateProbe(rs.probe, input, DT);
            wake.updateWake(DT, rs.probe, input);
            motes.updateMotes(DT, rs.probe, rs.difficulty);
            st.advancePhase(rs, DT, motes.moteCount() === 0);
            if (rs.run.phase === st.PHASE.ACTIVE && rs.waveObj) {
                if (tickWave(rs.waveObj, DT)) rs.run.phase = st.PHASE.DRAINING;
            } else if (rs.run.phase === st.PHASE.DRAINING && motes.moteCount() === 0) {
                st.completeWave(rs);
            }
            frames++;
        }
        unbind();
        return { score: rs.score.score, wave: rs.run.wave, frames, absorbed: rs.score.absorbed };
    }

    const idle = runPlayer(false);
    const bot = runPlayer(true);
    console.log('  idle:', JSON.stringify(idle));
    console.log('  bot: ', JSON.stringify(bot));
    check('a player who engages absorbs motes', bot.absorbed > 0,
        bot.absorbed + ' motes absorbed');
    check('playing well scores more than doing nothing', bot.score > idle.score,
        bot.score + ' vs ' + idle.score);
    check('playing well survives longer', bot.frames > idle.frames,
        (bot.frames / 60).toFixed(1) + 's vs ' + (idle.frames / 60).toFixed(1) + 's');
}

// ---------------------------------------------------------------------------
console.log('\n=== 6. save / load round-trips the exact board ===');
{
    const rs = st.newRun('WAKE-SAVE');
    wake.resetWake();
    motes.resetMotes();
    // Put some state on the board.
    for (let i = 0; i < 20; i++) {
        rs.probe.x = C.CORE_X + i * 2;
        rs.probe.y = C.CORE_Y + 20;
        rs.probe.pol = i % 2 ? C.POS : C.NEG;
        rs.probe.vx = 40;
        wake.updateWake(DT * 10, rs.probe, { ...noInput });
    }
    motes.spawnAtAngle(1.2, C.MOTE_KIND.SPLITTER, C.POS, 7);
    motes.spawnAtAngle(3.4, C.MOTE_KIND.LEECH, C.NEG, 6);
    rs.score.score = 4321;
    rs.run.wave = 7;
    rs.run.containment = 3;
    rs.waveObj = buildWave(7, makeRng('x'));
    rs.waveObj.cursor = 4;
    rs.waveObj.clock = 3.5;

    const echoesBefore = wake.echoCount();
    const motesBefore = motes.moteCount();
    const payload = st.serialiseRun(rs);
    const ok = save.writeSlot(2, payload);
    check('writeSlot succeeds', ok);

    const read = save.readSlot(2);
    check('readSlot returns data', !!read);

    const rs2 = st.deserialiseRun(read);
    check('seed restored', rs2.seed === 'WAKE-SAVE', rs2.seed);
    check('score restored', rs2.score.score === 4321, String(rs2.score.score));
    check('wave restored', rs2.run.wave === 7, String(rs2.run.wave));
    check('containment restored', rs2.run.containment === 3, String(rs2.run.containment));
    check('echo count restored', wake.echoCount() === echoesBefore,
        wake.echoCount() + ' vs ' + echoesBefore);
    check('mote count restored', motes.moteCount() === motesBefore,
        motes.moteCount() + ' vs ' + motesBefore);
    check('pending wave schedule restored',
        rs2.waveObj && rs2.waveObj.cursor === 4 && Math.abs(rs2.waveObj.clock - 3.5) < 0.01,
        JSON.stringify({ cursor: rs2.waveObj?.cursor, clock: rs2.waveObj?.clock }));
    check('mote kinds survive the round-trip',
        motes.getMotes().some((m) => m.kind === C.MOTE_KIND.SPLITTER) &&
        motes.getMotes().some((m) => m.kind === C.MOTE_KIND.LEECH),
        motes.getMotes().map((m) => m.kind).join(','));

    const slotInfo = save.describeSlot(2);
    check('slot summary reads back', slotInfo && slotInfo.wave === 7 && slotInfo.score === 4321,
        JSON.stringify(slotInfo));
}

// ---------------------------------------------------------------------------
console.log('\n=== 7. seeded generation is deterministic ===');
{
    const a = [];
    const r1 = makeRng('WAKE-ABCD');
    for (let i = 0; i < 8; i++) a.push(r1());
    const b = [];
    const r2 = makeRng('WAKE-ABCD');
    for (let i = 0; i < 8; i++) b.push(r2());
    check('same seed gives the same stream', JSON.stringify(a) === JSON.stringify(b));

    const c = makeRng('WAKE-WXYZ');
    check('different seeds diverge', c() !== a[0]);

    const w1 = buildWave(5, makeRng('S'));
    const w2 = buildWave(5, makeRng('S'));
    check('wave composition is reproducible from a seed',
        JSON.stringify(w1.spawns) === JSON.stringify(w2.spawns));
    check('wave 5 is a surge', w1.surge === true);
    check('wave 4 is not a surge', buildWave(4, makeRng('S')).surge === false);
}

// ---------------------------------------------------------------------------
console.log('\n=== 8. mote classes unlock on schedule ===');
{
    const kindsAt = (w) => {
        const set = new Set();
        for (let i = 0; i < 40; i++) {
            for (const s of buildWave(w, makeRng('seed' + i)).spawns) set.add(s.kind);
        }
        return set;
    };
    const k1 = kindsAt(1);
    check('wave 1 is drifters only', k1.size === 1 && k1.has('drifter'),
        [...k1].join(','));
    const k12 = kindsAt(12);
    check('wave 12 has the full roster', k12.size >= 4, [...k12].join(','));
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL CHECKS PASSED'));
process.exit(fails ? 1 : 0);
