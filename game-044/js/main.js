/**
 * main.js — The Story Thief of Greymantle.
 *
 * A Sierra-style point-and-click adventure in vanilla JS. The engine here is
 * small; the game lives in js/scenes/*.js, which describe each location
 * (painting, floor, hotspots) and script every interaction as async code
 * against the `G` API defined below.
 *
 *   click → pick hotspot under cursor → Rowan walks to it → handler runs
 *
 * Walking can be interrupted by another click; handlers can't (they're the
 * story). A death restores the snapshot taken just before the fatal action.
 */

import { W, H, makeCanvas, rng } from './paint.js';
import { quantize } from './palette.js';
import { WalkMap, inShape } from './walk.js';
import { rowanFrame, drawShadow, SPR_W, SPR_H } from './sprites.js';
import { ITEMS, itemIcon, verbIcon, cursorFor } from './items.js';
import { state, readSave, latestSave, recordEnding, ENDINGS, ENDING_SCORE, MAX_SCORE, endingsFound } from './state.js';
import { events } from './events.js';
import * as ui from './ui.js';
import { initAudio, sfx, ambience, setSound, playLullaby, stopLullaby } from './sounds.js';
import { SCENES } from './scenes/index.js';
import { COMBOS, SELF, ITEM_LOOK, genericFail } from './scenes/common.js';
import { paintTitle, tombstone } from './art.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

const screen = document.getElementById('screen');
const g = screen.getContext('2d');
screen.width = W; screen.height = H;

const E = {
    scene: null, bg: null, fg: null, key: null, walk: null,
    busy: false, token: 0, anims: {}, t: 0, hover: null, running: false,
    snap: null, speaker: null,
};

const player = { x: 160, y: 170, dir: 'down', path: [], phase: -1, pose: 'stand', hidden: false, resolve: null, poseUntil: 0 };

const ABORT = Symbol('abort');

// ============================================================
// Scene loading & painting
// ============================================================

function sceneScale(y) {
    const [y0, s0, y1, s1] = E.scene.scale || [100, 0.7, 195, 1];
    const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    return s0 + (s1 - s0) * t;
}

/** Repaint the background/foreground/floor if the scene's picture changed. */
function refresh(force = false) {
    const def = E.scene;
    const key = (def.bgKey ? def.bgKey(state) : '') + '';
    if (!force && key === E.key) return;
    E.key = key;
    const seed = [...def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    E.bg = makeCanvas();
    const bg = E.bg.getContext('2d');
    def.paint(bg, state, rng(seed));
    quantize(E.bg, def.dither ?? 26);
    E.fg = null;
    if (def.paintFg) {
        E.fg = makeCanvas();
        def.paintFg(E.fg.getContext('2d'), state, rng(seed + 1));
        quantize(E.fg, def.dither ?? 26);
    }
    const w = def.walk(state);
    E.walk = new WalkMap(w.areas, w.blockers || []);
}

async function enterScene(id, { from = null, pos = null, runEnter = true } = {}) {
    const def = SCENES[id];
    if (!def) throw new Error('No scene ' + id);
    E.scene = def;
    E.key = null;
    E.anims = {};
    state.scene = id;
    refresh(true);
    const p = pos || (from && def.entries[from]) || def.entries.default;
    player.x = p[0]; player.y = p[1]; player.dir = p[2] || 'down';
    player.path = []; player.phase = -1; player.hidden = false; player.pose = 'stand';
    ambience(def.ambience || 'none');
    const first = !state.visited[id];
    state.visited[id] = true;
    state.pos = null;
    // Never autosave mid-finale: that save would have the tale and quill
    // already handed over, with no way left to finish.
    if (!state.flag('finale')) state.save(true);
    events.emit('scene', id);
    await ui.fade(0, 350);
    if (runEnter && def.enter) await def.enter(G, first);
}

// ============================================================
// Player movement
// ============================================================

/** Walk to (x, y). Resolves true on arrival, false if another order replaced it. */
function walkTo(x, y) {
    if (player.resolve) { player.resolve(false); player.resolve = null; }
    player.path = E.walk.path([player.x, player.y], [x, y]);
    return new Promise((resolve) => {
        if (!player.path.length) { resolve(true); return; }
        player.resolve = resolve;
    });
}

function updatePlayer(dt) {
    if (!player.path.length) {
        player.phase = -1;
        if (player.resolve) { const r = player.resolve; player.resolve = null; r(true); }
        return;
    }
    const s = sceneScale(player.y);
    let move = 52 * s * dt;
    while (move > 0 && player.path.length) {
        const [tx, ty] = player.path[0];
        const dx = tx - player.x, dy = ty - player.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.3) {
            // Vertical movement reads slower in perspective; favour side views.
            player.dir = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        }
        if (d <= move) {
            player.x = tx; player.y = ty;
            player.path.shift();
            move -= d;
        } else {
            player.x += dx / d * move;
            player.y += dy / d * move;
            player.phase = ((player.phase < 0 ? 0 : player.phase) + move / (22 * s)) % 1;
            move = 0;
        }
    }
    if (!player.path.length) player.phase = -1;
}

function faceToward(x, y) {
    const dx = x - player.x, dy = y - player.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    player.dir = Math.abs(dx) > Math.abs(dy) * 0.6 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

function playerBox() {
    const s = sceneScale(player.y);
    return { rect: [player.x - 7 * s, player.y - 34 * s, 14 * s, 34 * s] };
}

// ============================================================
// Drawing
// ============================================================

/** Progress 0..1 of a scripted animation, or 0 if it hasn't started. */
function A(key) {
    const a = E.anims[key];
    if (!a) return 0;
    return Math.min(1, (E.t - a.t0) / a.dur);
}

function drawPlayer(ctx) {
    if (player.hidden) return;
    const s = sceneScale(player.y);
    const pose = player.pose !== 'stand' && E.t < player.poseUntil ? player.pose : 'stand';
    const spr = rowanFrame(player.dir, player.phase, pose);
    const w = Math.round(SPR_W * s), h = Math.round(SPR_H * s);
    drawShadow(ctx, player.x, player.y, s);
    ctx.drawImage(spr, Math.round(player.x - w / 2), Math.round(player.y - h + 2 * s), w, h);
}

function draw() {
    g.imageSmoothingEnabled = false;
    g.drawImage(E.bg, 0, 0);
    const def = E.scene;
    const list = def.actors ? def.actors(state, E.t, A, E.speaker).slice() : [];
    list.push({ y: player.y, draw: drawPlayer });
    list.sort((a, b) => a.y - b.y);
    for (const a of list) a.draw(g, E.t);
    if (E.fg) g.drawImage(E.fg, 0, 0);
    if (def.overlay) def.overlay(g, state, E.t, A);
    if (DEBUG && E.hover) {
        g.strokeStyle = '#f4c542';
        const s = E.hover.shape;
        if (s.rect) g.strokeRect(s.rect[0] + 0.5, s.rect[1] + 0.5, s.rect[2], s.rect[3]);
    }
}

let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!E.running || !E.scene) return;
    E.t += dt;
    refresh();
    updatePlayer(dt);
    draw();
}

// ============================================================
// Hotspots & input
// ============================================================

function spots() {
    const def = E.scene;
    const list = typeof def.hotspots === 'function' ? def.hotspots(state) : def.hotspots;
    return list.filter(h => !h.when || h.when(state));
}

function spotAt(x, y) {
    if (!player.hidden && inShape(x, y, playerBox())) return SELF_SPOT;
    for (const h of spots()) if (inShape(x, y, h.shape)) return h;
    return null;
}

const SELF_SPOT = { id: 'self', name: 'yourself', self: true, shape: {} };

function label(spot) {
    const v = ui.verb(), it = ui.item();
    if (it) return `Use ${ITEMS[it].name} on ${spot ? spot.name : '…'}`;
    if (!spot) return v === 'walk' ? '' : { look: 'Look around', use: 'Use…', talk: 'Talk to…' }[v];
    if (spot.self) return { walk: 'Rowan', look: 'Look at yourself', use: 'Rowan', talk: 'Talk to yourself' }[v];
    if (spot.exit && (v === 'walk' || v === 'use')) return `Go ${spot.name}`;
    return { walk: `Walk to ${spot.name}`, look: `Look at ${spot.name}`, use: `Use ${spot.name}`, talk: `Talk to ${spot.name}` }[v];
}

function toGame(e) {
    const r = screen.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H, e.clientX - r.left, e.clientY - r.top];
}

function onMove(e) {
    if (!E.running || E.busy || ui.anyModalOpen()) { ui.hoverLabel(null); return; }
    const [x, y, cx, cy] = toGame(e);
    const s = spotAt(x, y);
    E.hover = s;
    const text = label(s);
    if (e.pointerType === 'mouse') ui.hoverLabel(text, cx, cy);
}

function onDown(e) {
    if (!E.running || ui.anyModalOpen()) return;
    if (e.button === 2) { cycleVerb(); e.preventDefault(); return; }
    if (e.button !== 0) return;
    initAudio();
    if (E.busy) return;
    const [x, y, cx, cy] = toGame(e);
    const s = spotAt(x, y);
    // Touch has no hover, so flash the label on tap instead.
    if (e.pointerType !== 'mouse') {
        const t = label(s);
        ui.hoverLabel(t, cx, cy);
        clearTimeout(onDown._t);
        onDown._t = setTimeout(() => ui.hoverLabel(null), 1200);
    }
    interact(s, x, y);
}

function cycleVerb() {
    const order = ['walk', 'look', 'use', 'talk'];
    if (ui.item()) { ui.setVerb('walk'); return; }
    ui.setVerb(order[(order.indexOf(ui.verb()) + 1) % order.length]);
    sfx.verb();
}

async function interact(spot, x, y) {
    const v = ui.verb(), it = ui.item();
    const token = ++E.token;

    // Plain walking, or clicking empty ground with an item in hand.
    if (!spot && (v === 'walk' || it)) { walkTo(x, y); return; }
    if (spot && !spot.self && v === 'walk' && !spot.exit && !it) { walkTo(...(spot.at || [x, y])); return; }

    if (spot && !spot.self && !spot.far) {
        const tgt = spot.at || [x, y];
        const ok = await walkTo(tgt[0], tgt[1]);
        if (!ok || token !== E.token) return;
    }
    if (spot && !spot.self) {
        if (spot.face) player.dir = spot.face;
        else faceToward(...centerOf(spot.shape));
    }

    await runScript(async () => {
        if (spot?.exit && (v === 'walk' || v === 'use') && !it) {
            if (spot.exitIf && !spot.exitIf(state)) {
                if (spot.blocked) await run(spot.blocked);
                return;
            }
            sfx.door && spot.door && sfx.door();
            await G.go(spot.exit);
            return;
        }
        if (it) {
            if (spot?.self) return await run(SELF[it] || genericFail(it, spot));
            const fn = spot?.items?.[it] ?? spot?.items?.default ?? genericFail(it, spot);
            if (v !== 'look') reach();
            return await run(fn);
        }
        if (!spot) {
            if (v === 'look') return await run(E.scene.look);
            if (v === 'use') return await G.say('There is nothing there to use.');
            if (v === 'talk') return await G.say('You mutter to the empty air. The empty air, as usual, has nothing to add.');
            return;
        }
        if (spot.self) return await run(SELF['@' + v] || 'You are Rowan Ashby.');
        const h = spot[v] ?? FALLBACK[v](spot);
        if (v === 'use') reach();
        await run(h);
    });
}

const FALLBACK = {
    look: (s) => `It's ${s.name}.`,
    use: (s) => `You can't think of anything useful to do with ${s.name}.`,
    talk: (s) => `You try making conversation with ${s.name}. It's a short conversation.`,
    walk: () => null,
};

function centerOf(sh) {
    if (sh.rect) return [sh.rect[0] + sh.rect[2] / 2, sh.rect[1] + sh.rect[3] / 2];
    if (sh.circle) return [sh.circle[0], sh.circle[1]];
    if (sh.poly) {
        const xs = sh.poly.map(p => p[0]), ys = sh.poly.map(p => p[1]);
        return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    }
    return [player.x, player.y];
}

function reach() {
    player.pose = 'reach';
    player.poseUntil = E.t + 0.45;
}

async function run(h) {
    if (!h) return;
    if (typeof h === 'string') return G.say(h);
    return h(G);
}

/** Run a story script with input locked; deaths unwind via ABORT. */
async function runScript(fn) {
    E.busy = true;
    ui.hoverLabel(null);
    state.pos = [player.x, player.y, player.dir];
    E.snap = state.snapshot();
    try {
        await fn();
    } catch (err) {
        if (err !== ABORT) console.error(err);
    } finally {
        E.busy = false;
        state.pos = null;
    }
}

// ============================================================
// Inventory clicks
// ============================================================

async function itemClicked(id) {
    if (E.busy || !E.running) return;
    initAudio();
    const v = ui.verb(), held = ui.item();
    if (held && held !== id) {
        ui.setVerb('walk');
        const key = [held, id].sort().join('+');
        await runScript(() => run(COMBOS[key] || `You can't see how the ${ITEMS[held].name.toLowerCase()} and the ${ITEMS[id].name.toLowerCase()} go together.`));
        return;
    }
    if (held === id) { ui.setVerb('walk'); return; }
    if (v === 'look') {
        await runScript(() => run(ITEM_LOOK[id] || ITEMS[id].desc));
        return;
    }
    sfx.verb();
    ui.setVerb(v, id);
    ui.toast(`Using: ${ITEMS[id].name}`);
}

// ============================================================
// The script API
// ============================================================

const G = {
    S: state,
    say: (text) => ui.say({ text }),
    async line(who, text) {
        E.speaker = who;
        try { await ui.say({ who, text }); } finally { E.speaker = null; }
    },
    choose: (opts, prompt = null, who = null) => ui.choose(opts, prompt, who),
    has: (id) => state.has(id),
    flag: (k) => state.flag(k),
    set: (k, v = true) => state.set(k, v),
    give(id) {
        state.give(id);
        sfx.pickup();
        ui.toast(`<b>${ITEMS[id].name}</b> added to your satchel`);
    },
    take(id) {
        state.take(id);
        if (ui.item() === id) ui.setVerb('walk');
    },
    award(key) { state.award(key); },
    chron(id, text) {
        if (state.chron(id, text)) {
            setTimeout(() => { sfx.chronicle(); ui.toast('✎ The Book of Tales writes a new line', 'ink'); }, 500);
        }
    },
    walk: (x, y) => walkTo(x, y),
    face(dir) { player.dir = dir; },
    reach,
    hide(h = true) { player.hidden = h; },
    place(x, y, dir) { player.x = x; player.y = y; player.path = []; if (dir) player.dir = dir; },
    wait: (ms) => new Promise(r => setTimeout(r, ms)),
    sfx: (name) => sfx[name]?.(),
    lullaby: (loop = false) => playLullaby(0.36, loop),
    stopLullaby,
    animate(key, ms) {
        E.anims[key] = { t0: E.t, dur: ms / 1000 };
        return new Promise(r => setTimeout(r, ms));
    },
    async flash(color = '#ffffff', ms = 400) {
        await ui.fade(1, ms / 2, color);
        await ui.fade(0, ms / 2, color);
    },
    async go(id) {
        await ui.fade(1, 300);
        await enterScene(id, { from: state.scene });
    },
    pages: (list, buttons) => ui.pages(list, buttons),
    openBook: () => ui.openBook(),
    async die(title, text) {
        sfx.death();
        const deaths = state.deaths + 1;
        await G.wait(300);
        const pick = await ui.pages([{
            title, text: text + '\n\n*Thank you for playing The Story Thief of Greymantle. Luckily, this is the kind of book you can turn back a page in.*',
            art: tombstone(), cls: 'death',
        }], ['Turn back a page', 'Restore saved game', 'Begin a new tale']);
        if (pick === 0) {
            state.restore(E.snap);
            state.deaths = deaths;
            const [x, y, dir] = state.pos || [];
            await enterScene(state.scene, { pos: state.pos ? [x, y, dir] : null, runEnter: false });
        } else if (pick === 1) {
            await loadGame(latestSave());
        } else {
            await newGame();
        }
        throw ABORT;
    },
    async ending(id) {
        state.award(id, ENDING_SCORE[id]);
        state.set('ending', id);
        const found = recordEnding(id);
        stopLullaby();
        await G.wait(400);
        await ui.fade(1, 900);
        E.running = false;
        ambience('none');
        const art = endingArt(id);
        await ui.fade(0, 10);
        const e = ENDINGS[id];
        const total = Object.keys(ENDINGS).length;
        const deaths = state.deaths === 0 ? 'not once — Gran would be proud'
            : state.deaths === 1 ? 'once, which is traditional' : `${state.deaths} times, each of them educational`;
        let pick;
        for (;;) {
            pick = await ui.pages([{
                title: 'The End',
                text: `*${e.title}*\n\nYou finished with ${state.score} of ${MAX_SCORE} points, having died ${deaths}.\n\nEndings found: ${found.length} of ${total}\n${ui.endingsList()}`,
                art, cls: 'ending',
            }], ['Read the Book of Tales', 'Begin a new tale', 'Back to the title']);
            if (pick !== 0) break;
            await ui.openBookAndWait();
        }
        if (pick === 1) await newGame();
        else await showTitle();
        throw ABORT;
    },
    endingArt: (id) => endingArt(id),
    sceneArt,
};

/** The closing illustration for each ending. */
function endingArt(id) {
    if (id === 'keeper') return sceneArt('tower', { elsieAwake: true, corvinHere: true, released: true }, [152, 184, 'right']);
    if (id === 'gift') return sceneArt('cottage', { giftEnding: true }, [150, 172, 'left']);
    return sceneArt('sanctum', { loomBroken: true, released: true });
}

/** Paint any scene with an override state — used for storybook illustrations. */
function sceneArt(id, flags = {}, withPlayer = null) {
    const def = SCENES[id];
    const fake = Object.create(state);
    fake.flags = { ...state.flags, ...flags };
    fake.flag = (k) => !!fake.flags[k];
    const c = makeCanvas();
    const cg = c.getContext('2d');
    const seed = [...def.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    def.paint(cg, fake, rng(seed));
    quantize(c, def.dither ?? 26);
    const list = def.actors ? def.actors(fake, 2, () => 0, null).slice() : [];
    if (withPlayer) {
        const [x, y, dir] = withPlayer;
        list.push({
            y, draw: (ctx) => {
                const saved = E.scene; E.scene = def;
                const s = sceneScale(y);
                E.scene = saved;
                const spr = rowanFrame(dir, -1);
                ctx.drawImage(spr, Math.round(x - SPR_W * s / 2), Math.round(y - SPR_H * s), Math.round(SPR_W * s), Math.round(SPR_H * s));
            },
        });
    }
    list.sort((a, b) => a.y - b.y);
    for (const a of list) a.draw(cg, 2);
    if (def.paintFg) {
        const f = makeCanvas();
        def.paintFg(f.getContext('2d'), fake, rng(seed + 1));
        quantize(f, def.dither ?? 26);
        cg.drawImage(f, 0, 0);
    }
    return c;
}

// ============================================================
// Game flow: title, new game, load
// ============================================================

async function newGame() {
    state.reset();
    ui.setVerb('walk');
    document.getElementById('title').hidden = true;
    E.running = false;
    await ui.fade(1, 10);
    const pick = await ui.pages([
        { title: 'The Story Thief of Greymantle', text: 'On the longest night of the year, the stories began to go out — one by one, like candles in a draughty house.', art: sceneArt('green'), cls: 'prologue' },
        { text: 'In the village of Brackenford, at the foot of the mountain called Greymantle, old Mab Ashby had told stories for sixty winters. There was not a child in the valley who hadn\'t fallen asleep to one of them, and not a grown-up who didn\'t still know the words.\n\nTonight, by her own fire, Mab opened her mouth to tell one — and found nothing there at all.', cls: 'prologue' },
        { text: 'You are Rowan, her grandchild. You have heard every one of her stories a hundred times, and tonight you cannot remember a single one either.\n\nUp on Greymantle, in the Warlock\'s tower, a light is burning.\n\nYou have decided to do something about it.', cls: 'prologue' },
    ], ['Begin']);
    void pick;
    E.running = true;
    await runScript(() => enterScene('cottage', {}));
}

async function loadGame(data) {
    if (!data) { ui.toast('No saved game found.'); return showTitle(); }
    state.load(data);
    ui.setVerb('walk');
    document.getElementById('title').hidden = true;
    E.running = true;
    await runScript(() => enterScene(state.scene, { pos: data.pos || null, runEnter: false }));
    ui.toast('Your tale resumes.');
}

async function showTitle() {
    E.running = false;
    ambience('none');
    const t = document.getElementById('title');
    t.hidden = false;
    const art = document.getElementById('title-art');
    art.innerHTML = '';
    art.appendChild(paintTitle());
    const hasSave = !!latestSave();
    document.getElementById('t-continue').hidden = !hasSave;
    const found = endingsFound();
    document.getElementById('t-endings').textContent = found.length
        ? `Endings found: ${found.length} of ${Object.keys(ENDINGS).length}`
        : '';
    await ui.fade(0, 400);
    setTimeout(() => document.getElementById(hasSave ? 't-continue' : 't-new').focus(), 0);
}

function saveGame() {
    state.pos = [player.x, player.y, player.dir];
    const ok = state.save(false);
    state.pos = null;
    ui.toast(ok ? 'Your tale has been saved.' : 'Saving is not available in this browser.');
}

// ============================================================
// Boot
// ============================================================

function fitScreen() {
    const vp = document.getElementById('viewport');
    const bar = document.getElementById('bar');
    const availW = Math.min(window.innerWidth, 1280);
    const top = parseFloat(getComputedStyle(document.getElementById('app')).paddingTop) || 0;
    const availH = window.innerHeight - bar.offsetHeight - top - 4;
    let s = Math.min(availW / W, availH / H);
    if (s >= 2) s = Math.floor(s * 2) / 2;          // prefer clean half-steps
    vp.style.width = Math.floor(W * s) + 'px';
    vp.style.height = Math.floor(H * s) + 'px';
    document.getElementById('app').style.setProperty('--gw', Math.floor(W * s) + 'px');
}

function boot() {
    const P = ui.getPrefs();
    setSound(P.sound !== false);

    ui.initBar({
        verbChanged(v, it) {
            screen.style.cursor = cursorFor(it ? itemIcon(it) : verbIcon(v), v === 'walk' && !it ? 'crosshair' : 'pointer');
        },
        itemClicked,
    });
    ui.setVerb('walk');
    ui.initKeys({
        key(k, e) {
            if (!E.running) return;
            if (k === '1') ui.setVerb('walk');
            else if (k === '2') ui.setVerb('look');
            else if (k === '3') ui.setVerb('use');
            else if (k === '4') ui.setVerb('talk');
            else if (k === 'b' || k === 'B') ui.openBook();
            else if (k === 'Escape') { if (ui.item()) ui.setVerb('walk'); else openMenu(); }
            else return;
            e.preventDefault();
        },
    });

    screen.addEventListener('pointermove', onMove);
    screen.addEventListener('pointerdown', onDown);
    screen.addEventListener('pointerleave', () => ui.hoverLabel(null));
    screen.addEventListener('contextmenu', (e) => e.preventDefault());

    document.getElementById('b-book').addEventListener('click', () => { if (!E.busy) { sfx.click(); ui.openBook(); } });
    document.getElementById('b-menu').addEventListener('click', () => { sfx.click(); openMenu(); });
    document.getElementById('t-new').addEventListener('click', () => { initAudio(); sfx.click(); newGame(); });
    document.getElementById('t-continue').addEventListener('click', () => { initAudio(); sfx.click(); loadGame(latestSave()); });
    document.getElementById('t-howto').addEventListener('click', () => { initAudio(); sfx.click(); howTo(); });

    window.addEventListener('resize', fitScreen);
    fitScreen();
    requestAnimationFrame(frame);
    showTitle();
}

function openMenu() {
    if (E.busy) return;
    ui.openMenu({
        save: saveGame,
        load: () => loadGame(readSave(false)),
        help: howTo,
        title: () => showTitle(),
        restart: () => newGame(),
    });
}

async function howTo() {
    const wasRunning = E.running;
    E.running = false;
    await ui.pages([{
        title: 'How to Play',
        text: 'Choose what to do from the bar beneath the picture, then click (or tap) on the scene:\n\n' +
            '**Walk** — go somewhere. Click the edges of a scene to travel.\n**Look** — examine anything. Look at everything; that is where the story hides.\n**Use** — take, push, open, climb, pull.\n**Talk** — speak to people (and to things that might turn out to be people).\n\n' +
            'To use something you carry, click it in your satchel, then click where you want to use it. Click one item on another to combine them. Look at an item to examine it.\n\n' +
            'Right-click cycles the verbs. Keys 1–4 pick them, B opens the Book of Tales, Esc opens the menu.\n\n' +
            'You can die. It is a Sierra tradition. You can always turn back a page.',
        cls: 'help',
    }]);
    E.running = wasRunning;
}

boot();

if (DEBUG) {
    window.__game = { E, G, state, player, enterScene, runScript, SCENES, spots, sceneArt, walkTo };
}
// Test hook: always exposed read-only so harnesses can drive the real UI.
window.__story = {
    get scene() { return state.scene; },
    get busy() { return E.busy; },
    get running() { return E.running; },
    get player() { return { x: player.x, y: player.y, moving: player.path.length > 0 }; },
    get score() { return state.score; },
    get inv() { return state.inv.slice(); },
    flag: (k) => state.flag(k),
    spots: () => spots().map(h => ({ id: h.id, name: h.name, shape: h.shape, at: h.at || null, exit: h.exit || null })),
    spotAt: (x, y) => spotAt(x, y)?.id ?? null,
    get earned() { return { ...state.earned }; },
    get deaths() { return state.deaths; },
};
