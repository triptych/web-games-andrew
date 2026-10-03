// Rotorstorm: boot, the screen flow, the fixed-step loop, and the glue
// between simulation events and the renderer, audio and HUD.

import { Renderer } from './gfx/renderer.js';
import { World } from './sim/world.js';
import { OPS, PROLOGUE, ENDING, ENDING_SURVIVORS, POST_CREDITS } from './sim/campaign.js';
import { computeLoadout, canBuy, SKILL_BY_ID } from './sim/skills.js';
import { DT, W } from './sim/config.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI, fmt } from './ui.js';
import { loadProfile, saveProfile, resetProfile } from './save.js';
import { makeBot } from './bot.js';

const VERSION = '1.0.0';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FIXED_SEED = params.has('seed') ? (+params.get('seed') >>> 0) : null;
// tests on software GL render a frame or two a second; fast=N runs N× more sim per frame
const FAST = DEBUG ? Math.max(1, Math.min(20, +(params.get('fast') || 1))) : 1;
const $ = (id) => document.getElementById(id);

const ENDLESS_OP = {
    id: 'stormfront', name: 'Stormfront', place: 'The open storm', biome: 'coast', weather: 'clear', boss: 'leviathan', bossName: '',
    length: 95, scroll: 46, music: { root: 47, bpm: 142, scale: 'phrygian', seed: 77 }, comms: [], victory: [], bossPhases: [],
};

let profile = loadProfile();
const audio = new Audio();
const ui = new UI(audio);
const input = new Input($('gl'));
let renderer = null;
let world = null;
let mode = 'boot';           // boot | title | menu | playing | paused | result
let attract = false;
let attractBot = null;
let currentOp = 0;
let endless = false;
let acc = 0;
let last = performance.now();
let frameTimes = [];
let quality = 1;
let isTouch = matchMedia('(pointer: coarse)').matches;
let missionStart = 0;

// ---------------------------------------------------------------- layout

function computeLayout() {
    const vv = window.visualViewport;
    const cw = Math.round(vv ? vv.width : innerWidth), ch = Math.round(vv ? vv.height : innerHeight);
    const portrait = ch > cw * 1.15;
    const touch = isTouch || input.touchUsed;
    const topRes = portrait ? 46 : 0;
    const botRes = portrait && touch ? 90 : portrait ? 30 : 0;
    const availH = ch - topRes - botRes;
    const H = world ? world.H : Math.max(760, Math.min(960, Math.round(W * availH / cw)));
    const s = Math.min(cw / W, availH / H);
    const fw = W * s, fh = H * s;
    const fx = (cw - fw) / 2, fy = topRes + (availH - fh) / 2;
    return { cw, ch, portrait, touch, H, s, fx, fy, fw, fh, overlayTop: topRes === 0 || fy < 46 };
}

function applyLayout() {
    if (!renderer) return;
    const L = computeLayout();
    const dpr = Math.min(2, devicePixelRatio || 1);
    renderer.quality = quality;
    renderer.setLayout(L.cw, L.ch, dpr, { fx: L.fx, fy: L.fy, s: L.s });
    const root = document.documentElement.style;
    root.setProperty('--fx', L.fx + 'px'); root.setProperty('--fy', L.fy + 'px');
    root.setProperty('--fw', L.fw + 'px'); root.setProperty('--fh', L.fh + 'px');
    $('hud').classList.toggle('overlay-top', L.overlayTop);
    $('touch').className = L.portrait ? 'portrait' : 'landscape';
    input.scale = L.s;
    return L;
}

function qualityFromSettings() {
    const q = profile.settings.quality;
    if (q === 'low') return 0.55;
    if (q === 'med') return 0.75;
    if (q === 'high') return 1;
    return isTouch ? 0.75 : 1;
}

function applySettings() {
    const s = profile.settings;
    audio.setVolumes(s.music, s.sfx);
    input.sens = s.sens;
    input.autofire = s.autofire;
    if (renderer) {
        renderer.opts.shake = s.shake;
        renderer.opts.flash = s.reduceFlash ? 0.3 : 1;
        renderer.opts.scan = s.scan;
        renderer.opts.hitbox = s.hitbox;
        renderer.fx.reduce = s.reduceFlash;
    }
    $('fps').hidden = !s.fps;
}

// ---------------------------------------------------------------- boot

async function boot() {
    $('title-ver').textContent = 'v' + VERSION;
    const fill = $('boot-fill');
    fill.style.width = '20%';
    await new Promise((r) => setTimeout(r, 30));
    try {
        renderer = new Renderer($('gl'));
    } catch (e) {
        console.warn(e);
        ui.show('glfail');
        return;
    }
    fill.style.width = '70%';
    $('boot-msg').textContent = 'Plotting the coast…';
    await new Promise((r) => setTimeout(r, 30));
    quality = qualityFromSettings();
    renderer.fx.quality = quality;
    applySettings();
    $('gl').addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.toast('Graphics reset. Reloading…', 4000); setTimeout(() => location.reload(), 1200); });
    fill.style.width = '100%';
    startAttract();
    applyLayout();
    toTitle();
    requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- attract mode (title background)

function startAttract(force = null) {
    const opIdx = force ?? Math.max(0, Math.min(OPS.length - 1, profile.cleared.length ? Math.floor(Math.random() * (profile.cleared.length + 1)) : 0));
    const op = OPS[opIdx];
    const L = computeLayout();
    world = new World({ op, opIndex: opIdx, seed: (Math.random() * 1e9) >>> 0, difficulty: 'pilot', loadout: computeLoadout({ g_dmg: 2, g_rof: 1, g_fan: 1, o_msl: 1, o_mslx: 1, o_rkt: 1, a_arm: 2 }), H: L.H, god: true });
    world.cloudCover = 0;
    attract = true;
    attractBot = makeBot(world, { bombs: false });
    renderer.setWorld(world);
}

// ---------------------------------------------------------------- flow

function toTitle() {
    mode = 'title';
    document.body.classList.remove('flying');
    if (!attract) startAttract();
    $('hud').hidden = true; $('touch').hidden = true;
    ui.title(profile, VERSION);
    ui.show('title');
    audio.playMusic('menu');
    audio.rotor(false);
}

function persist() { saveProfile(profile); }

function openBriefing(idx) {
    currentOp = Math.max(0, Math.min(OPS.length - 1, idx));
    endless = false;
    const op = OPS[currentOp];
    ui.briefing(op, currentOp, profile, (k) => { profile.difficulty = k; persist(); });
    ui.show('briefing', true);
    audio.playMusic('hangar');
}

function openHangar(push = true) {
    ui.hangar(profile, { canvas: renderer.atlasCanvas, sprites: renderer.batch.sprites[0] }, {
        buy(id) {
            const r = canBuy(profile.owned, id, profile.salvage);
            if (!r.ok) { audio.ui('deny'); ui.toast(r.why); return; }
            profile.salvage -= r.cost;
            profile.owned[id] = (profile.owned[id] | 0) + 1;
            persist();
            audio.ui('buy');
            ui.toast(`${SKILL_BY_ID[id].name} installed`);
            ui.renderTree();
        },
    });
    ui.show('hangar', push);
    audio.playMusic('hangar');
}

function launch({ checkpoint = false } = {}) {
    attract = false;
    const L = computeLayout();
    const op = endless ? ENDLESS_OP : OPS[currentOp];
    const seed = FIXED_SEED ?? ((Math.random() * 1e9) >>> 0);
    world = new World({
        op, opIndex: endless ? 0 : currentOp, seed, difficulty: profile.difficulty,
        loadout: computeLoadout(profile.owned), H: L.H, endless, startAtBoss: checkpoint,
    });
    if (DEBUG) console.log('seed', seed);
    renderer.setWorld(world);
    applyLayout();
    acc = 0;
    input.clear();
    input.enabled = true;
    input.focusToggle = false;
    $('t-focus').setAttribute('aria-pressed', 'false');
    ui.hudReset(world);
    ui.show(null);
    $('hud').hidden = false;
    $('touch').hidden = !(isTouch || input.touchUsed);
    $('touch-hint').hidden = !(isTouch || input.touchUsed);
    setTimeout(() => { $('touch-hint').hidden = true; }, 4000);
    mode = 'playing';
    document.body.classList.add('flying');
    missionStart = performance.now();
    audio.init();
    audio.playMusic(op.music, checkpoint ? 2 : 1);
    audio.rotor(true, 0.5);
    if (!checkpoint) {
        if (endless) ui.banner('STORMFRONT', 'SECTOR 1 · ' + world.terrain.biome.toUpperCase());
        else ui.banner(op.name.toUpperCase(), op.place.toUpperCase());
    }
}

function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    input.enabled = false;
    $('pause-info').textContent = endless ? `Stormfront · sector ${world.director.sector + 1}` : `${OPS[currentOp].name} · ${fmt(world.score)} pts`;
    ui.show('pause');
    document.body.classList.remove('flying');
    audio.rotor(false);
    if (audio.ctx) audio.mus.gain.setTargetAtTime(profile.settings.music * 0.2, audio.ctx.currentTime, 0.2);
}

function resume() {
    if (mode !== 'paused') return;
    ui.show(null);
    mode = 'playing';
    document.body.classList.add('flying');
    input.enabled = true;
    input.clear();
    last = performance.now();
    audio.rotor(true, 0.5);
    audio.setVolumes(profile.settings.music, profile.settings.sfx);
}

input.onPause = () => { if (mode === 'playing') pause(); else if (mode === 'paused' && ui.cur === 'pause') resume(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });

// ---------------------------------------------------------------- results

function rankFor(st, checkpoint) {
    const killPct = st.spawned ? st.kills / st.spawned : 1;
    const surv = st.survivorsTotal ? st.survivors / st.survivorsTotal : 1;
    let pts = killPct * 40 + surv * 25 + Math.max(0, 30 - st.hits * 10) + (st.bombs === 0 ? 5 : 0);
    let rank = pts >= 90 ? 'S' : pts >= 75 ? 'A' : pts >= 55 ? 'B' : pts >= 35 ? 'C' : 'D';
    if (checkpoint && 'SA'.includes(rank)) rank = 'B';
    return rank;
}

function mmss(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

function missionCleared() {
    mode = 'result';
    document.body.classList.remove('flying');
    input.enabled = false;
    audio.rotor(false);
    const st = world.stats;
    const op = OPS[currentOp];
    const rank = rankFor(st, st.checkpoint);
    const bonus = { S: 0.5, A: 0.3, B: 0.15, C: 0.05, D: 0 }[rank];
    const earned = Math.round(world.salvage * (1 + bonus));
    profile.salvage += earned;
    if (!profile.cleared.includes(op.id)) profile.cleared.push(op.id);
    profile.nextOp = Math.max(profile.nextOp, currentOp + 1);
    const prev = profile.best[op.id];
    if (!prev || world.score > prev.score) profile.best[op.id] = { score: world.score, rank };
    profile.survivors[op.id] = Math.max(profile.survivors[op.id] || 0, st.survivors);
    profile.survivorsTotal[op.id] = Math.max(profile.survivorsTotal[op.id] || 0, st.survivorsTotal);
    profile.kills += st.kills;
    persist();
    const last = currentOp === OPS.length - 1;
    ui.debrief({
        opLabel: `OP ${currentOp + 1} · ${op.name.toUpperCase()}`,
        title: 'OPERATION COMPLETE',
        rank,
        rows: [
            ['Hostiles destroyed', `${st.kills} / ${st.spawned}`],
            ['Survivors rescued', `${st.survivors} / ${st.survivorsTotal}`],
            ['Longest chain', st.maxChain],
            ['Bullets grazed', st.grazes],
            ['Hits taken', st.hits],
            ['EMPs fired', st.bombs],
            ['Flight time', mmss(st.time)],
            ['Score', fmt(world.score)],
            [`Rank bonus (${rank})`, '+' + Math.round(bonus * 100) + '%'],
        ],
        salvage: earned,
        story: op.debrief,
        nextLabel: last ? 'Epilogue ▸' : 'Next operation ▸',
    });
    ui.show('debrief');
    audio.playMusic('hangar');
    $('d-next').onclick = () => { audio.ui('click'); if (last) showEnding(); else openBriefing(currentOp + 1); };
    $('d-hangar').onclick = () => { audio.ui('click'); currentOp = Math.min(currentOp + 1, OPS.length - 1); openHangar(false); };
}

function missionFailed() {
    mode = 'result';
    document.body.classList.remove('flying');
    input.enabled = false;
    audio.rotor(false);
    const kept = Math.round(world.salvage * (endless ? 0.75 : 0.6));
    profile.salvage += kept;
    if (endless) profile.endlessBest = Math.max(profile.endlessBest, world.score);
    persist();
    const reachedBoss = !endless && !!world.boss;
    $('f-boss').hidden = !reachedBoss;
    $('f-info').textContent = endless
        ? `Stormfront ended in sector ${world.director.sector + 1} with ${fmt(world.score)} points. Kept ⚙ ${fmt(kept)} salvage. Best: ${fmt(profile.endlessBest)}.`
        : `${OPS[currentOp].name}: kept ⚙ ${fmt(kept)} salvage (60%). Spend it in the hangar, or go straight back in.`;
    ui.show('failed');
    audio.playMusic('hangar');
}

function showEnding() {
    mode = 'menu';
    const surv = OPS.reduce((a, o) => a + (profile.survivors[o.id] || 0), 0);
    const tot = OPS.reduce((a, o) => a + (profile.survivorsTotal[o.id] || 0), 0);
    const paras = ENDING.map((p) => (p === '{survivors}' ? ENDING_SURVIVORS(surv, Math.max(tot, surv)) : p));
    const credits = `<h4>ROTORSTORM</h4>Every pixel, voice and note generated in code<h4>FLOWN BY</h4>Kestrel<h4>WITH</h4>Cmdr. Rhea Castellan · Chief Ozzie Mbeki · Lt. Juno "Ash" Arden<h4>STORMFRONT UNLOCKED</h4>An endless run through every biome<p style="margin-top:22px;color:#ff8a9a;font-style:italic">${POST_CREDITS}</p>`;
    ui.ending(paras, credits, () => { profile.endingSeen = true; persist(); toTitle(); });
    // a quiet flight over the coast while the clouds part
    startAttract(0);
    world.director.step = () => {};
    world.cloudCover = 1;
    world.op = { ...world.op, weather: 'clear' };
    $('hud').hidden = true; $('touch').hidden = true;
    ui.show('ending');
    audio.playMusic('ending');
}

// ---------------------------------------------------------------- menus

$('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.init();
    audio.ui('click');
    switch (b.dataset.act) {
        case 'continue':
            if (profile.nextOp >= OPS.length) openBriefing(OPS.length - 1);
            else openBriefing(profile.nextOp);
            break;
        case 'new':
            if (profile.nextOp > 0 && !confirm('Start the campaign again from Operation 1? Your salvage, upgrades and unlocked operations are kept.')) return;
            ui.prologue(PROLOGUE, () => { profile.prologueSeen = true; persist(); openBriefing(0); });
            ui.show('prologue', true);
            break;
        case 'ops': ui.opsList(profile, (i) => openBriefing(i)); ui.show('ops', true); break;
        case 'hangar': openHangar(true); break;
        case 'endless': endless = true; launch(); break;
        case 'options': ui.options(profile.settings, onSetting); ui.show('options', true); break;
        case 'howto': ui.show('howto', true); break;
        case 'credits': ui.show('credits', true); break;
    }
});

function onSetting(key) {
    if (key === 'quality') { quality = qualityFromSettings(); renderer.fx.quality = quality; applyLayout(); }
    applySettings();
    persist();
}

$('b-launch').onclick = () => { audio.init(); audio.ui('click'); launch(); };
$('b-hangar').onclick = () => { audio.ui('click'); openHangar(true); };
$('h-go').onclick = () => { audio.ui('click'); openBriefing(Math.min(currentOp, OPS.length - 1)); };
$('h-respec').onclick = () => {
    let refund = 0;
    for (const id of Object.keys(profile.owned)) { const s = SKILL_BY_ID[id]; for (let i = 0; i < profile.owned[id]; i++) refund += s.cost[i]; }
    if (!refund) { ui.toast('Nothing to refund'); return; }
    profile.salvage += refund;
    profile.owned = {};
    persist();
    audio.ui('buy');
    ui.toast(`Refunded ⚙ ${fmt(refund)}`);
    ui.renderTree();
};
$('p-resume').onclick = () => { audio.ui('click'); resume(); };
$('p-options').onclick = () => { audio.ui('click'); ui.options(profile.settings, onSetting); ui.show('options', true); };
$('p-restart').onclick = () => { audio.ui('click'); launch(); };
$('p-quit').onclick = () => {
    audio.ui('click');
    const kept = Math.round(world.salvage * 0.6);
    profile.salvage += kept; persist();
    attract = false;
    mode = 'menu';
    $('hud').hidden = true; $('touch').hidden = true;
    audio.rotor(false);
    ui.toast(`Kept ⚙ ${fmt(kept)} salvage`);
    startAttract();
    openHangar(false);
};
$('f-boss').onclick = () => { audio.ui('click'); launch({ checkpoint: true }); };
$('f-retry').onclick = () => { audio.ui('click'); launch(); };
$('f-hangar').onclick = () => { audio.ui('click'); startAttract(); openHangar(false); };
$('o-reset').onclick = () => {
    if (!confirm('Erase all progress, salvage and upgrades?')) return;
    const keep = profile.settings;
    profile = resetProfile();
    profile.settings = keep;
    persist();
    ui.toast('Progress reset');
    toTitle();
};
$('pause-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); audio.ui('click'); pause(); });

ui.onShow = (id) => {
    if (id === 'title' && mode !== 'title') { mode = 'title'; }
    if (['briefing', 'hangar', 'ops', 'prologue'].includes(id)) { mode = 'menu'; if (!attract) startAttract(); $('hud').hidden = true; $('touch').hidden = true; }
};
ui.onBack = (cur, prev) => {
    if (cur === 'options' && world && !attract && (prev === 'pause')) { ui.show('pause'); return true; }
    if (!prev || prev === 'title') { toTitle(); return true; }
    if (prev === 'hangar') { openHangar(false); return true; }
    return false;
};

// touch buttons
const tb = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); input.touchUsed = true; fn(); }, { passive: false });
tb('t-focus', () => { input.focusToggle = !input.focusToggle; $('t-focus').setAttribute('aria-pressed', String(input.focusToggle)); });
tb('t-bomb', () => input.press('bomb'));
tb('t-od', () => input.press('od'));

input.onAny = (kind) => {
    audio.init();
    if (kind === 'touch' && !isTouch) { isTouch = true; if (mode === 'playing') { $('touch').hidden = false; applyLayout(); } }
};
addEventListener('pointerdown', () => audio.init(), { once: true });
addEventListener('resize', () => applyLayout());
if (window.visualViewport) visualViewport.addEventListener('resize', () => applyLayout());

// ---------------------------------------------------------------- events → audio / HUD

function handleEvents(evs) {
    if (attract) return;
    const p = world.player;
    for (const e of evs) {
        switch (e.type) {
            case 'pshot': audio.gun(e.x); break;
            case 'eshot': audio.eshot(e.x, e.k); break;
            case 'kill': if (e.kind !== 'beacon') audio.explosion(e.x, e.size === 'l' ? 'l' : e.size === 'm' ? 'm' : 's'); break;
            case 'partKill': audio.explosion(e.x, 'l'); break;
            case 'blast': audio.explosion(e.x, 'l'); break;
            case 'rocketHit': audio.explosion(e.x, 's'); break;
            case 'phit': audio.hit(); if (navigator.vibrate && isTouch) navigator.vibrate(60); break;
            case 'shieldBreak': audio.explosion(e.x, 's'); audio.ui('deny'); break;
            case 'graze': audio.graze(); break;
            case 'pickup': audio.pickup(e.kind, world.chain); break;
            case 'bomb': audio.bomb(); break;
            case 'od': audio.overdrive(); break;
            case 'odReady': audio.ready(); break;
            case 'laserWarm': audio.laser(false); break;
            case 'laserFire': audio.laser(true); break;
            case 'missile': case 'mslLaunch': audio.missile(e.x ?? p.x); break;
            case 'rescue': audio.rescue(); break;
            case 'repair': audio.pickup('repair'); break;
            case 'phoenix': audio.bomb(); ui.banner('PHOENIX PROTOCOL', 'AIRFRAME RESTORED'); break;
            case 'bombRefund': ui.toast('Storm Breaker: EMP recharged'); break;
            case 'warning': audio.warning(); ui.warning(e.name); break;
            case 'bossIntro': audio.setIntensity(2); break;
            case 'bossPhase': audio.explosion(e.x, 'xl'); break;
            case 'bossDeath': audio.bossBoom(e.final); audio.setIntensity(1); ui.banner(e.eject ? 'SERAPH GROUNDED' : 'TARGET DESTROYED', '+' + fmt(e.bonus) + ' PTS'); break;
            case 'pdead': audio.explosion(e.x, 'xl'); audio.rotor(false); break;
            case 'comms': ui.comms(e.who, e.text, !!e.bark, e.who === 'ash' && !endless && currentOp === 4); break;
            case 'banner': ui.banner(e.text, e.sub); break;
            case 'chain': ui.toast(`${e.n} chain!`, 900); break;
            case 'arc': audio.laser(true); break;
            case 'missed': break;
        }
    }
}

// ---------------------------------------------------------------- loop

function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05 * FAST, (now - last) / 1000 * (FAST > 1 ? FAST : 1));
    last = now;
    if (!renderer || !world) return;
    const fx = renderer.fx;
    let simDt = 0;
    if (mode === 'playing' || attract) {
        simDt = dt;
        if (!attract) {
            if (fx.hitstop > 0) { fx.hitstop -= dt; simDt = 0; }
            else if (fx.slowmo > 0) { fx.slowmo -= dt; simDt *= fx.slowmoScale; }
        }
        acc += simDt;
        const inp = attract ? attractBot() : input.sample();
        let steps = 0;
        while (acc >= DT && steps < 10 * FAST) {
            world.step(steps === 0 ? inp : { ...inp, dx: 0, dy: 0, bomb: false, od: false });
            acc -= DT;
            steps++;
        }
        if (steps === 10 * FAST) acc = 0;
        if (!steps && !attract) {
            input.drag.x += inp.dx; input.drag.y += inp.dy;
            if (inp.bomb) input.press('bomb');
            if (inp.od) input.press('od');
        }
        if (attract && world.player.alive && world.player.bombs < 1) world.player.bombs = 2;
        const evs = world.events;
        handleEvents(evs);
        renderer.consume(evs);
        world.events = [];
        if (attract) {
            if (world.state === 'cleared' || world.state === 'failed' || world.t > 200) startAttract();
        } else {
            if (world.state === 'cleared') missionCleared();
            else if (world.state === 'failed') missionFailed();
            else if (world.state === 'victory' && audio.music) audio.setIntensity(1);
            if (mode === 'playing') {
                ui.hud(world, dt);
                const p = world.player;
                audio.rotor(p.alive, 0.45 + Math.min(1, Math.hypot(p.vx, p.vy) / 400) * 0.5);
            }
        }
    }
    renderer.render(mode === 'paused' ? 0 : (simDt > 0 ? simDt : (attract ? dt : 0)), { cloudAmb: undefined });
    // perf
    frameTimes.push(dt);
    if (frameTimes.length >= 90) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        frameTimes = [];
        if (profile.settings.fps) $('fps').textContent = Math.round(1 / avg) + ' fps · q' + quality.toFixed(2);
        if (profile.settings.quality === 'auto' && avg > 0.024 && quality > 0.5 && mode === 'playing') {
            quality = Math.max(0.5, quality - 0.1);
            renderer.fx.quality = quality;
            applyLayout();
        }
    }
}

// ---------------------------------------------------------------- debug hooks (tests)

if (DEBUG) {
    window.__rs = {
        get world() { return world; }, get mode() { return mode; }, get ui() { return ui.cur; }, get renderer() { return renderer; },
        get profile() { return profile; }, quality: () => quality,
        god(on = true) { world.god = on; },
        skipToBoss() { world.director.skipToBoss(); world.scroll = world.director.t * world.op.scroll; for (const e of world.enemies) if (!e.boss) e.alive = false; },
        killBoss() {
            const b = world.boss;
            if (!b) return false;
            for (const p of b.parts) if (p.gate) p.hp = 0, p.alive = false;
            b.hp = 0;
            return true;
        },
        nextPhase() { const b = world.boss; if (!b || !b.phase) return; for (const p of b.parts) if (p.gate) p.alive = false; b.hp = 0; if (b.phase.gate === 'time') b.phaseT = 999; },
        giveSalvage(n) { profile.salvage += n; persist(); },
        startOp(i) { currentOp = i; endless = false; launch(); },
        endless() { endless = true; launch(); },
        die() { world.god = false; world.player.invuln = 0; world.player.shield = 0; world.player.phoenix = false; world.player.armor = 1; world.hitPlayer(world.player.x, world.player.y); },
        layout: () => computeLayout(),
        terrainProbe(n = 40) {
            // compare the GPU-baked material with the CPU classification at random points in the visible chunks
            const g = renderer.ground, gl = renderer.gl;
            let agree = 0, total = 0, mism = [];
            for (const [k, c] of g.chunks) {
                const fb = c.fb;
                gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
                gl.readBuffer(gl.COLOR_ATTACHMENT0);
                for (let i = 0; i < n; i++) {
                    const tx = Math.floor(Math.random() * c.tw), ty = Math.floor(Math.random() * c.th);
                    const px = new Uint8Array(4);
                    gl.readPixels(tx, ty, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    const wx = g.x0 + (tx + 0.5) / c.tw * g.cw, wy = k * 512 + (ty + 0.5) / c.th * 512;
                    if (wx < 20 || wx > 520) continue;
                    const a = px[3] / 255;
                    const gpu = a > 0.85 ? 2 : a > 0.25 ? 1 : 0;
                    const cpu = world.terrain.kind(wx, wy);
                    // the arctic paints ice floes over water; the GPU may call those land
                    const ok = gpu === cpu || (world.terrain.biome === 'arctic' && cpu === 1 && gpu === 0);
                    total++; if (ok) agree++; else if (mism.length < 5) mism.push([wx | 0, wy | 0, cpu, gpu]);
                }
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return { agree, total, mism };
        },
    };
}

boot();
