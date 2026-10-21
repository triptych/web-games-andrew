/**
 * main.js — boot, screens and the story flow.
 *
 *   title → (prologue) → star chart → (before-scene) → painting → reveal → rewards
 *         → (after-scene) → next page, or back to the chart when a chapter closes
 *
 * ?debug=1 exposes window.__cv for the browser tests; &fasttext shows dialogue lines at once.
 */
import { VERSION } from './config.js';
import { ARTWORKS, ART_BY_ID } from './artworks.js';
import { CHAPTERS, EXTRAS, BOOKS, BOOK_ONE_END, FINAL_PAGE, SCENES, STORY_PAGES, chapterOf } from './story.js';
import { SKILLS, SKILL_BY_ID, BRANCHES, SKY_TOP, skillStatus, canBuy, buySkill, has } from './skills.js';
import { newGame, isPageUnlocked, chapterDone, nextPage, fraction, storyDone, studioPalette } from './progress.js';
import { loadGame, saveGame, eraseGame } from './save.js';
import { Sound } from './audio.js';
import { PaintScreen } from './paint.js';
import { $, el, toast, drawArt, exportPng, sharePng, openModal, closeModal, modalOpen, playScene, dialogueOpen } from './ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const app = {
    state: loadGame(ART_BY_ID),
    hasSave: false,
    sound: new Sound(),
    screen: 'title',
    save() { return saveGame(this.state); },
    updateGlimmer,
    onPageComplete,
    onPaintExit,
};
app.hasSave = !!app.state;
if (!app.state) app.state = newGame();
app.sound.enabled = app.state.settings.sound;

const paint = new PaintScreen(app);

/* ───────────── screens ───────────── */

function show(name) {
    if (app.screen === 'paint' && name !== 'paint') paint.close();
    app.screen = name;
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === `scr-${name}`);
    if (name === 'title') startTitleSky(); else stopTitleSky();
    updateGlimmer();
}

let lastGlim = -1;
function updateGlimmer() {
    const g = Math.floor(app.state.glimmer);
    for (const n of document.querySelectorAll('.glim-n')) n.textContent = g.toLocaleString();
    if (g > lastGlim && lastGlim >= 0) for (const n of document.querySelectorAll('.screen.active .glim')) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
    lastGlim = g;
    const affordable = SKILLS.some((s) => canBuy(app.state, s.id));
    document.querySelector('#chart-skills .badge').hidden = !affordable;
}

async function scene(key) {
    if (!SCENES[key]) return;
    const once = key !== 'epilogue';
    if (once && app.state.seen.includes(key)) return;
    await playScene(SCENES[key], app.state, app.sound);
    if (once && !app.state.seen.includes(key)) app.state.seen.push(key);
    app.save();
}

/* ───────────── title ───────────── */

let skyRAF = 0;
function startTitleSky() {
    const c = $('title-sky');
    const ctx = c.getContext('2d');
    const tiles = ARTWORKS.slice(0, 14).map((art, k) => ({
        img: drawArt(document.createElement('canvas'), art, app.state.pages[art.id]?.done ? null : new Uint8Array(art.total), { grey: 'dark' }),
        x: ((k * 0.37) % 1), y: ((k * 0.61) % 1), size: 40 + ((k * 23) % 50), speed: 0.006 + ((k * 7) % 5) * 0.002, rot: ((k % 5) - 2) * 0.06,
    }));
    cancelAnimationFrame(skyRAF);
    let last = performance.now();
    const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = c.clientWidth, H = c.clientHeight;
        if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        for (const t of tiles) {
            t.y -= t.speed * dt;
            if (t.y < -0.2) t.y = 1.15;
            const s = t.size * Math.min(1.4, Math.max(0.8, W / 900));
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.translate(t.x * W, t.y * H);
            ctx.rotate(t.rot);
            ctx.drawImage(t.img, -s / 2, -s / 2, s, s);
            ctx.restore();
        }
        skyRAF = requestAnimationFrame(step);
    };
    skyRAF = requestAnimationFrame(step);
}
function stopTitleSky() { cancelAnimationFrame(skyRAF); }

function refreshTitle() {
    const cont = $('btn-continue'), fresh = $('btn-new');
    cont.hidden = !app.hasSave;
    fresh.classList.toggle('primary', !app.hasSave);
    fresh.textContent = app.hasSave ? 'New journey' : 'Begin';
}

$('btn-continue').addEventListener('click', () => { app.sound.unlock(); app.sound.click(); openChart(); });
$('btn-new').addEventListener('click', () => {
    app.sound.unlock();
    app.sound.click();
    if (!app.hasSave) { beginJourney(); return; }
    openModal((card) => card.append(
        el('h3', {}, 'Start a new journey?'),
        el('p', {}, 'Your restored mosaics, Glimmer and skills will all be cleared.'),
        el('div', { class: 'modal-actions' },
            el('button', { class: 'btn', type: 'button', onclick: closeModal }, 'Keep playing'),
            el('button', { class: 'btn primary', type: 'button', onclick: () => { closeModal(); eraseGame(); beginJourney(); } }, 'Start over')),
    ));
});

async function beginJourney() {
    const settings = app.state.settings;
    app.state = newGame();
    app.state.settings = settings;
    app.hasSave = true;
    app.save();
    lastGlim = -1;
    await scene('prologue');
    startPage('wick');
}

/* ───────────── star chart ───────────── */

function thumb(art, ps) {
    return drawArt(el('canvas', { 'aria-hidden': 'true' }), art, ps?.cells ?? new Uint8Array(art.total));
}

function openChart() {
    show('chart');
    renderChart();
}

function renderChart() {
    const s = app.state;
    const next = nextPage(s);
    const nc = $('chart-next');
    nc.replaceChildren();
    if (next) {
        const art = ART_BY_ID[next], ch = chapterOf(next), ps = s.pages[next];
        nc.hidden = false;
        nc.append(thumb(art, ps), el('div', {},
            el('div', { class: 'nc-k' }, ps?.correct ? 'Keep painting' : ch.n ? `Chapter ${ch.n} · ${ch.title}` : ch.title),
            el('div', { class: 'nc-t' }, art.title)), el('span', { class: 'nc-go', 'aria-hidden': 'true' }, '›'));
        nc.onclick = () => { app.sound.click(); startPage(next); };
    } else nc.hidden = true;

    const list = $('chart-list');
    list.replaceChildren();
    const chapters = [...CHAPTERS, ...EXTRAS.filter((e) => has(s, e.skill))];
    chapters.forEach((ch, idx) => {
        if (ch.book && ch.book !== chapters[idx - 1]?.book) list.append(el('h2', { class: 'book-head' }, BOOKS[ch.book]));
        const unlocked = isPageUnlocked(s, ch.pages[0]);
        const doneN = ch.pages.filter((id) => s.pages[id]?.done).length;
        const card = el('section', { class: `chapter${unlocked ? '' : ' locked'}`, style: { '--hue': ch.hue } },
            el('div', { class: 'ch-head' },
                el('span', { class: 'ch-n' }, ch.n ? `Chapter ${ch.n}` : 'Bonus'),
                el('h3', { class: 'ch-title' }, ch.title),
                el('span', { class: 'ch-count' }, `${doneN} / ${ch.pages.length}${doneN === ch.pages.length ? ' ✦' : ''}`),
                el('span', { class: 'ch-world' }, ch.world)));
        if (!unlocked && idx > 0) card.append(el('p', { class: 'ch-locknote' }, `Restore ${chapters[idx - 1].title} to sail here.`));
        const pages = el('div', { class: 'pages' });
        for (const id of ch.pages) {
            const art = ART_BY_ID[id], ps = s.pages[id], open = isPageUnlocked(s, id);
            const pct = Math.floor(fraction(art, ps) * 100);
            const tile = el('button', {
                class: `page-tile${ps?.done ? ' done' : ''}${id === next ? ' current' : ''}`, type: 'button', disabled: !open,
                'aria-label': open ? `${art.title}, ${ps?.done ? 'restored' : `${pct}% restored`}` : `${art.title}, locked`,
                onclick: () => { app.sound.click(); startPage(id); },
            }, thumb(art, ps),
            el('span', { class: 'pt-name' }, open ? art.title : '???'),
            el('span', { class: 'pt-sub' }, !open ? 'Locked' : ps?.done ? '✦ Restored' : `${art.w}×${art.h} · ${pct}%`));
            if (!open) tile.append(el('span', { class: 'pt-lock', 'aria-hidden': 'true' }, '🔒'));
            pages.append(tile);
        }
        card.append(pages);
        list.append(card);
    });
}

$('chart-skills').addEventListener('click', () => { app.sound.click(); openSkills(); });
$('chart-gallery').addEventListener('click', () => { app.sound.click(); openGallery(); });
$('chart-settings').addEventListener('click', () => { app.sound.click(); openSettings(); });

/* ───────────── pages and the story ───────────── */

async function startPage(id) {
    if (!isPageUnlocked(app.state, id)) return;
    show('paint');
    paint.open(id, 'number');
    if (!app.state.pages[id]?.done) await scene(`before:${id}`);
}

function onPaintExit(mode) {
    if (mode === 'free') openGallery();
    else openChart();
}

function onPageComplete(art, r) {
    const rows = [
        ['Pixels restored', r.earned],
        ['Mosaic complete', r.complete],
        r.flawless && ['Flawless, no mistakes', r.flawless],
        r.chapter && [`${r.chapterTitle} restored`, r.chapter],
    ].filter(Boolean);
    openModal((card) => {
        const big = drawArt(el('canvas', { class: 'modal-art' }), art);
        card.append(
            el('div', { class: 'eyebrow' }, 'Mosaic restored'),
            el('h3', {}, art.title),
            big,
            el('p', {}, art.blurb),
            el('ul', { class: 'rewards' },
                ...rows.map(([k, v]) => el('li', {}, el('span', {}, k), el('b', {}, `✦ ${v.toLocaleString()}`))),
                el('li', { class: 'total' }, el('span', {}, 'Glimmer'), el('b', {}, `✦ ${r.total.toLocaleString()}`))),
            el('div', { class: 'modal-actions' },
                el('button', { class: 'btn', type: 'button', onclick: () => shareArt(art) }, 'Share ↗'),
                el('button', { class: 'btn primary', type: 'button', id: 'reward-continue', onclick: () => { closeModal(); afterPage(art.id); } }, 'Continue')),
        );
    }, { dismissable: false });
}

async function afterPage(id) {
    await scene(`after:${id}`);
    const ch = chapterOf(id);
    if (id === FINAL_PAGE) {
        openChart();
        toast('The Far Shore is bright again ✦ Thank you for playing!', 4000);
        return;
    }
    if (id === BOOK_ONE_END) {
        openChart();
        toast('The Colorverse is bright again ✦ Book Two, The Far Shore, is on the chart', 4200);
        return;
    }
    const nxt = nextPage(app.state);
    // a chapter just closed: back to the chart to see the new world open up
    if (!nxt || !ch.pages.includes(nxt) || chapterDone(app.state, ch)) {
        openChart();
        if (ch.n && chapterDone(app.state, ch) && CHAPTERS[ch.n]) toast(`New world on the chart: ${CHAPTERS[ch.n].title}`, 3200);
        return;
    }
    startPage(nxt);
}

async function shareArt(art, free = null) {
    try {
        const blob = await exportPng(art, free, free ? studioPalette(art) : null);
        const how = await sharePng(blob, art.title);
        if (how === 'downloaded') toast('Saved as a PNG ✦');
        else if (how === 'shared') toast('Shared ✦');
    } catch { toast('This browser could not make a PNG.'); }
}

/* ───────────── constellation ───────────── */

let selectedSkill = null;

function openSkills() {
    show('skills');
    if (!selectedSkill) selectedSkill = SKILLS.find((s) => canBuy(app.state, s.id))?.id ?? SKILLS.find((s) => skillStatus(app.state, s.id) === 'available')?.id ?? 'spark';
    renderSkills();
}

function renderSkills() {
    const svg = $('sky-svg'), NS = 'http://www.w3.org/2000/svg';
    // stretch the chart to fill tall phone screens
    const span = 100 - SKY_TOP;
    const sky = $('sky'), ys = Math.max(1, Math.min(1.7, ((sky.clientHeight - 16) / Math.max(1, sky.clientWidth - 16)) * (100 / span)));
    svg.setAttribute('viewBox', `-4 ${(SKY_TOP * ys - 4).toFixed(1)} 108 ${(span * ys + 8).toFixed(1)}`);
    const Y = (s) => s.y * ys;
    const mk = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    svg.replaceChildren();
    for (const s of SKILLS) for (const r of s.req) {
        const a = SKILL_BY_ID[r];
        svg.append(mk('line', { x1: a.x, y1: Y(a), x2: s.x, y2: Y(s), class: `sk-line${has(app.state, s.id) ? ' lit' : ''}` }));
    }
    for (const s of SKILLS) {
        const status = skillStatus(app.state, s.id);
        const color = s.branch ? BRANCHES[s.branch].color : '#ffffff';
        const g = mk('g', {
            class: `sk-node ${status}${canBuy(app.state, s.id) ? ' afford' : ''}${selectedSkill === s.id ? ' sel' : ''}`,
            transform: `translate(${s.x} ${Y(s)})`, tabindex: '0', role: 'button', 'aria-label': `${s.name}, ${status}`, 'data-skill': s.id,
        });
        g.style.setProperty('--c', color);
        g.append(mk('circle', { class: 'halo', r: 6.4 }), mk('circle', { class: 'core', r: 4.6 }));
        const ic = mk('text', { class: 'ic' }); ic.textContent = s.icon; g.append(ic);
        const lbl = mk('text', { class: 'lbl', y: 8.2 }); lbl.textContent = s.name; g.append(lbl);
        const pick = () => { app.sound.click(); selectedSkill = s.id; renderSkills(); };
        g.addEventListener('click', pick);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        svg.append(g);
    }
    renderSkillCard();
}

function renderSkillCard() {
    const s = SKILL_BY_ID[selectedSkill], st = app.state, status = skillStatus(st, s.id);
    const color = s.branch ? BRANCHES[s.branch].color : '#ffffff';
    const card = $('skill-card');
    card.style.setProperty('--c', color);
    card.replaceChildren(
        el('div', { class: 'sc-top' },
            el('div', { class: 'sc-icon', 'aria-hidden': 'true' }, s.icon),
            el('div', {}, el('div', { class: 'sc-branch' }, s.branch ? BRANCHES[s.branch].name : 'Origin'), el('div', { class: 'sc-name' }, s.name))),
        el('p', { class: 'sc-desc' }, s.desc),
        el('p', { class: 'sc-wick' }, `Wick: “${s.wick}”`),
    );
    const row = el('div', { class: 'sc-buy' });
    if (status === 'owned') row.append(el('span', { class: 'sc-owned' }, '✦ Learned'));
    else {
        const btn = el('button', {
            class: 'btn primary small', type: 'button', id: 'skill-buy', disabled: !canBuy(st, s.id),
            onclick: () => {
                if (!buySkill(st, s.id)) return;
                app.sound.buy();
                app.save();
                toast(`Learned ${s.name} ✦`);
                updateGlimmer();
                renderSkills();
            },
        }, `Learn · ✦ ${s.cost.toLocaleString()}`);
        row.append(btn);
        if (status === 'locked') row.append(el('span', { class: 'sc-note' }, `Needs ${s.req.map((r) => SKILL_BY_ID[r].name).join(' and ')} first`));
        else if (!canBuy(st, s.id)) row.append(el('span', { class: 'sc-note' }, `${Math.ceil(s.cost - st.glimmer).toLocaleString()} more Glimmer`));
    }
    card.append(row);
}

window.addEventListener('resize', () => { if (app.screen === 'skills') renderSkills(); });
$('skills-back').addEventListener('click', () => { app.sound.click(); openChart(); });

/* ───────────── gallery ───────────── */

function openGallery() {
    show('gallery');
    const grid = $('gallery-grid');
    grid.replaceChildren();
    const open = [...STORY_PAGES, ...EXTRAS.filter((e) => has(app.state, e.skill)).flatMap((e) => e.pages)];
    const done = open.filter((id) => app.state.pages[id]?.done);
    $('gallery-count').textContent = `${done.length} / ${open.length}`;
    if (!done.length) {
        grid.append(el('div', { class: 'g-empty' }, 'Your gallery is waiting for its first mosaic.', el('br'), 'Restore every pixel of a page to hang it here.'));
        return;
    }
    const sparkly = has(app.state, 'prismheart');
    for (const id of done) {
        const art = ART_BY_ID[id];
        grid.append(el('button', {
            class: `g-tile${sparkly ? ' sparkly' : ''}`, type: 'button', 'aria-label': `View ${art.title}`,
            onclick: () => { app.sound.click(); viewArt(art); },
        }, drawArt(el('canvas', { 'aria-hidden': 'true' }), art), el('b', {}, art.title)));
    }
}

function viewArt(art) {
    const st = app.state, free = st.free[art.id];
    let showFree = false, lapse = 0;
    openModal((card) => {
        const canvas = el('canvas', { class: 'modal-art' });
        const draw = () => drawArt(canvas, art, showFree ? free : null, { freePalette: showFree ? studioPalette(art) : null });
        draw();
        const actions = el('div', { class: 'modal-actions' });
        actions.append(el('button', { class: 'btn', type: 'button', onclick: () => shareArt(art, showFree ? free : null) }, 'Share ↗'));
        if (has(st, 'timelapse')) {
            actions.append(el('button', {
                class: 'btn', type: 'button', onclick: () => {
                    showFree = false;
                    const ps = st.pages[art.id], cells = new Uint8Array(art.total);
                    const order = ps.order.length ? ps.order : Array.from({ length: art.total }, (_, i) => i);
                    const rest = Array.from({ length: art.total }, (_, i) => i).filter((i) => !order.includes(i));
                    const seq = [...order, ...rest];
                    let k = 0;
                    cancelAnimationFrame(lapse);
                    const per = Math.max(1, Math.ceil(seq.length / 240));
                    const tick = () => {
                        for (let n = 0; n < per && k < seq.length; n++, k++) cells[seq[k]] = art.cells[seq[k]] + 1;
                        drawArt(canvas, art, cells);
                        if (k < seq.length && !$('modal').hidden) lapse = requestAnimationFrame(tick);
                    };
                    tick();
                },
            }, 'Time-lapse ◷'));
        }
        if (has(st, 'studio')) {
            actions.append(el('button', { class: 'btn primary', type: 'button', onclick: () => { closeModal(); show('paint'); paint.open(art.id, 'free'); } }, 'Freestyle ✎'));
        }
        card.append(el('div', { class: 'eyebrow' }, chapterOf(art.id).title), el('h3', {}, art.title), canvas, el('p', {}, art.blurb));
        if (free) {
            const toggle = el('button', {
                class: 'btn small', type: 'button', onclick: () => { showFree = !showFree; toggle.textContent = showFree ? 'Show original' : 'Show my remix'; draw(); },
            }, 'Show my remix');
            card.append(el('div', { class: 'modal-actions' }, toggle));
        }
        card.append(actions, el('div', { class: 'modal-actions' }, el('button', { class: 'btn small', type: 'button', onclick: closeModal }, 'Close')));
    }, { onClose: () => cancelAnimationFrame(lapse) });
}

$('gallery-back').addEventListener('click', () => { app.sound.click(); openChart(); });

/* ───────────── settings ───────────── */

function openSettings() {
    const st = app.state;
    const toggle = (label, get, set) => {
        const b = el('button', { class: 'toggle', type: 'button', 'aria-pressed': String(get()), onclick: () => { set(!get()); b.setAttribute('aria-pressed', String(get())); b.textContent = get() ? 'On' : 'Off'; app.save(); } }, get() ? 'On' : 'Off');
        return el('div', { class: 'setting-row' }, el('span', {}, label), b);
    };
    openModal((card) => card.append(
        el('h3', {}, 'Settings'),
        toggle('Sound', () => st.settings.sound, (v) => { st.settings.sound = v; app.sound.enabled = v; if (v) { app.sound.unlock(); app.sound.click(); } }),
        toggle('Grid lines when zoomed in', () => st.settings.grid, (v) => { st.settings.grid = v; paint.painter.showGrid = v; }),
        el('div', { class: 'setting-row' }, el('span', {}, 'How to play')),
        el('ul', { class: 'howto' },
            el('li', {}, 'Pick a colour, then tap or drag over pixels with its number.'),
            el('li', {}, 'Pinch with two fingers, or scroll, to zoom. Two fingers (or right-drag, or Space + drag) to move around.'),
            el('li', {}, 'The ✥ Move tool lets one finger pan.'),
            el('li', {}, 'Mistakes can be painted over, but each one is a slip for the colour you used. Too many slips (✕ on the swatch counts down) and that colour smudges and starts over.'),
            el('li', {}, 'Keys: 1–9 colours, [ ] next colour, + − zoom, F fit, Z undo, arrows pan.'),
            el('li', {}, 'Spend Glimmer in the Constellation to learn new skills.')),
        el('div', { class: 'modal-actions' },
            el('button', { class: 'btn small', type: 'button', onclick: () => { closeModal(); show('title'); refreshTitle(); } }, 'Title screen'),
            el('button', { class: 'btn primary small', type: 'button', onclick: closeModal }, 'Done')),
        el('p', { style: { fontSize: '12px', marginTop: '14px' } }, `Colorverse v${VERSION} · ${st.stats.pixels.toLocaleString()} pixels restored`),
    ));
}

/* ───────────── lifecycle ───────────── */

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen() && !dialogueOpen()) {
        if (!document.getElementById('reward-continue')) closeModal();
    }
});
window.addEventListener('pagehide', () => app.save());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.save(); });

if (DEBUG) {
    window.__cv = {
        app, paint, ART_BY_ID, show, openChart, openSkills, openGallery, startPage, beginJourney, storyDone,
        get state() { return app.state; },
        /** Paint every pixel of a page except `leave`, without rewards (for tests). */
        nearlyDone(id, leave = 1) {
            const art = ART_BY_ID[id];
            const ps = app.state.pages[id] ?? (app.state.pages[id] = { cells: new Uint8Array(art.total), mistakes: 0, done: false, correct: 0, earned: 0, order: [] });
            ps.correct = 0;
            for (let i = 0; i < art.total; i++) {
                ps.cells[i] = i >= art.total - leave ? 0 : art.cells[i] + 1;
                if (ps.cells[i]) ps.correct++;
            }
            app.save();
        },
        finish(id) {
            const art = ART_BY_ID[id];
            app.state.pages[id] = { cells: Uint8Array.from(art.cells, (c) => c + 1), mistakes: 0, done: true, correct: art.total, earned: art.total, order: [] };
            app.save();
        },
        give(n) { app.state.glimmer += n; updateGlimmer(); app.save(); },
    };
}

refreshTitle();
show('title');
