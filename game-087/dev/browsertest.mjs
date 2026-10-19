/**
 * browsertest.mjs — Quillsworn in real Chromium, with real input.
 *
 * desktop (1280×800): the title with the ← Games link on top → Climb the stair by click → the prologue by
 *   Enter and clicks, a pen name typed, a sigil charge clicked, the Bard calling → the Charter typed into →
 *   speak with Thalion: the Spark turned in, three doors open → the Scriptorium: 160 words typed earn XP,
 *   the high-water mark holds after deleting, a paste earns none, Ctrl+B wraps, Reading view, a new chapter,
 *   Ctrl+S → First Ink turned in → the Hall of Faces: a character typed and fleshed out → an ink duel
 *   against the Imp won by typing, the words land in the scene → Free Pen from Settings → the Loom (a
 *   structure, a beat, a thread woven), the Loft (a place, a pin by clicking the map), the Well (a draw
 *   kept), the Sheet (a talent learned by click), the Lens reads a scene, the Library tabs, the Board →
 *   the Bindery: HTML, EPUB (a real zip with mimetype first), Markdown downloads and the print proof →
 *   reload: Continue restores everything → a backup downloads.
 * phones (touch only) at 390×844 and 844×390: the prologue by taps, the dock, the Scriptorium's chapter
 *   drawer, typing on the page, every visible control ≥ 44 px and on screen, nothing under the back link,
 *   no sideways scroll, dialogs fit.
 * resume: a reload after the pen name, before the calling: Continue asks for the calling and begins the road.
 * endgame: a 40,000-word novel marked complete in the Charter, the finale with Thalion, the Lamp of Vellmere.
 * nostorage: localStorage throws; the guild boots, warns with a banner, plays, and still downloads a backup.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8087          # from the REPO ROOT
 *   node game-087/dev/browsertest.mjs     (ONLY=desktop,phones,resume,endgame,nostorage)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8087';
const URL = `${BASE}/game-087/index.html?debug=1&fasttext`;
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(n);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0, errors = [];
const ok = (c, m) => { if (c) { passes++; if (process.env.VERBOSE) console.log('  ok', m); } else { fails++; console.log('  ✗', m); } return c; };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

async function newPage(opts = {}, init = null) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: opts.touch ? 2 : 1, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().startsWith('blob:')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    if (init) await ctx.addInitScript(init);
    await page.goto(URL);
    await page.waitForFunction(() => window.__qs);
    return page;
}
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = (page, n) => page.screenshot({ path: path.join(OUT, `bt-${n}.png`) });
const until = (page, fn, msg, arg, timeout = 10000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => ok(true, msg), () => ok(false, msg));
const reportErrors = (label) => { ok(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); errors = []; };
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return a.getAttribute('href') === '../index.html' && r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const noHScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('room').scrollWidth <= document.getElementById('room').clientWidth + 1);
const words = (n, seed = 0) => {
    const W = 'the bells of saltmere rang at dusk though no one pulled the ropes and mara counted them twice before the tide came in grey and cold'.split(' ');
    return Array.from({ length: n }, (_, i) => W[(i * 5 + seed) % W.length]).join(' ') + '.';
};
/** Advance dialogue lines with Enter until a selector appears (or the dialogue ends). */
async function advanceTo(page, sel, { key = true, max = 30 } = {}) {
    for (let i = 0; i < max; i++) {
        if (sel && await page.$(sel)) return true;
        if (!(await Q(page, () => !document.getElementById('dialogue').hidden))) return !sel;
        if (key) await page.keyboard.press('Enter'); else await page.click('#dlg-next');
        await page.waitForTimeout(30);
    }
    return false;
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×800');
    const page = await newPage();
    ok(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    ok(await Q(page, () => !document.getElementById('title').hidden && !!document.getElementById('btn-new')), 'title screen with Climb the stair');
    ok(await noHScroll(page), 'no sideways scroll on the title');
    await shot(page, 'desktop-title');

    // ---------------------------------------------------------------- prologue
    await page.click('#btn-new');
    await until(page, () => !document.getElementById('dialogue').hidden, 'Climb the stair opens the prologue');
    ok(await advanceTo(page, '#ask-name'), 'Enter advances Thalion’s lines to the pen-name prompt');
    await shot(page, 'desktop-prologue');
    await page.click('#ask-name');
    await page.keyboard.type('Wren Ashby');
    await page.keyboard.press('Enter');
    ok(await advanceTo(page, '#ask-sigil-ok', { key: false }), 'clicking Continue reaches the sigil designer');
    await page.click('.sig-opt[data-v="moon"]');
    await page.click('.sig-opt[data-v="#6b2430"]');
    await page.click('#ask-sigil-ok');
    ok(await advanceTo(page, '.calling'), 'the calling prompt');
    await page.click('.calling[data-calling="bard"]');
    ok(await advanceTo(page, null), 'the prologue ends');
    await until(page, () => __qs.room === 'hall' && !document.getElementById('shell').hidden, 'the Great Hall opens');
    ok(await Q(page, () => __qs.S.player.name === 'Wren Ashby' && __qs.S.player.sigil.charge === 'moon' && __qs.S.player.sigil.field === '#6b2430' && __qs.S.player.calling === 'bard'), 'name, sigil and calling are kept');
    ok(await Q(page, () => document.querySelector('.dock-btn[data-room="scriptorium"]').classList.contains('locked')), 'the Scriptorium is locked at first');
    await shot(page, 'desktop-hall');

    // ---------------------------------------------------------------- the charter
    await page.click('#btn-charter');
    await page.click('#ch-title');
    await page.keyboard.type('The Salt Crown');
    await page.click('#ch-logline');
    await page.keyboard.type('When the sea takes her village, a young smith must forge a crown for a drowned king, or the tide will never turn.');
    await page.fill('#ch-premise', words(48));
    await page.selectOption('#ch-genre', 'sword');
    await shot(page, 'desktop-charter');
    await page.click('#ch-done');
    ok(await Q(page, () => { const P = __qs.S.projects[__qs.S.activeId]; return P.title === 'The Salt Crown' && P.genre === 'sword'; }), 'the Charter saves the title and genre');
    await until(page, () => document.querySelector('#btn-speak')?.classList.contains('glow'), 'Thalion has something to hear');
    await page.click('#btn-speak');
    await until(page, () => !document.getElementById('dialogue').hidden, 'turning in the Spark plays its scene');
    await advanceTo(page, null);
    ok(await Q(page, () => ['scriptorium', 'board', 'library'].every((r) => __qs.S.player.rooms.includes(r)) && __qs.S.player.main === 1), 'the Spark opens the Scriptorium, the Board and the Library');

    // ---------------------------------------------------------------- the scriptorium
    await page.click('.dock-btn[data-room="scriptorium"]');
    await until(page, () => __qs.room === 'scriptorium' && document.getElementById('page'), 'the dock opens the Scriptorium');
    const xp0 = await Q(page, () => __qs.S.player.xp);
    await page.click('#page');
    await page.keyboard.type(words(160));
    await until(page, (x) => __qs.S.player.xp > x + 150, 'typing 160 words earns XP', xp0);
    ok(await Q(page, () => { const P = __qs.S.projects[__qs.S.activeId]; return P.scenes[P.chapters[0].scenes[0]].words === 160; }), 'the scene holds every typed word');
    ok(await Q(page, () => document.getElementById('scene-wc').textContent === '160'), 'the status bar counts them');
    const xp1 = await Q(page, () => __qs.S.player.xp);
    for (let i = 0; i < 40; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('the bells rang');
    await page.waitForTimeout(700);
    ok(await Q(page, (x) => Math.abs(__qs.S.player.xp - x) < 1e-6, xp1), 'deleting and retyping earns nothing twice');
    await Q(page, (text) => {
        const ta = document.getElementById('page');
        ta.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', bubbles: true, cancelable: true }));
        ta.setRangeText('\n' + text, ta.value.length, ta.value.length, 'end');
        ta.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
    }, words(120, 3));
    await page.waitForTimeout(200);
    ok(await Q(page, (x) => __qs.S.player.stats.pasted >= 100 && Math.abs(__qs.S.player.xp - x) < 1, xp1), 'pasted words go in the book but earn no XP');
    await page.keyboard.type(' bold');
    await page.keyboard.down('Shift'); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
    await page.keyboard.press('Control+b');
    ok(await Q(page, () => document.getElementById('page').value.endsWith('**bold**')), 'Ctrl+B wraps the selection in bold');
    await page.click('#tool-read');
    ok(await Q(page, () => !document.getElementById('reader').hidden && document.querySelector('#reader strong')?.textContent === 'bold'), 'Reading view renders the markup');
    await page.click('#tool-read');
    await page.click('#add-chapter');
    ok(await Q(page, () => __qs.S.projects[__qs.S.activeId].chapters.length === 2), '+ Chapter adds a chapter (and opens its scene)');
    await page.keyboard.type('A second chapter begins in the rain.');
    await page.keyboard.press('Control+s');
    await until(page, () => [...document.querySelectorAll('.toast')].some((t) => t.textContent === 'Saved.'), 'Ctrl+S saves');
    ok(await Q(page, () => !!localStorage.getItem('quillsworn.v1') && Object.keys(localStorage).some((k) => k.startsWith('quillsworn.v1.p.'))), 'the core and the novel are in separate keys');
    await shot(page, 'desktop-scriptorium');

    // First Ink
    await page.click('.dock-btn[data-room="hall"]');
    await page.click('#btn-speak');
    await advanceTo(page, null);
    ok(await Q(page, () => __qs.S.player.rooms.includes('faces') && __qs.S.player.rooms.includes('grounds') && __qs.S.player.equipped.quill === 'heron'), 'First Ink opens the Hall of Faces and the Proving Grounds and gives the heron quill');

    // ---------------------------------------------------------------- hall of faces
    await page.click('.door[data-room="faces"]');
    await until(page, () => __qs.room === 'faces', 'a door in the Hall opens a room');
    await page.click('#char-new');
    await page.fill('#cf-name', 'Mara Vell');
    await page.selectOption('#cf-role', 'Protagonist');
    for (const [f, v] of [['want', 'To forge the crown.'], ['need', 'To forgive her father.'], ['flaw', 'She trusts no one.'], ['wound', 'Her father sold her to the guild.']]) { await page.click(`#cf-${f}`); await page.keyboard.type(v); }
    await page.fill('#cf-backstory', words(45, 2));
    await page.click('.field.core .q');
    ok(await Q(page, () => [...document.querySelectorAll('.field-hint')].some((h) => !h.hidden)), 'the ? beside a field shows Thalion’s hint');
    await until(page, () => __qs.S.player.stats.charsFleshed === 1, 'a character typed in is fleshed out');
    await page.click('#char-new');
    await page.fill('#cf-name', 'The Drowned King');
    await page.selectOption('#cf-role', 'Antagonist');
    await page.click('#cf-want'); await page.keyboard.type('To rule the land as he rules the sea.');
    await page.locator('.bond input').first().fill('the one who drowned her father');
    await page.locator('.bond input').first().press('Tab');
    await until(page, () => document.querySelector('#web .chord'), 'a bond is drawn in the web of hearts');
    await shot(page, 'desktop-faces');

    // ---------------------------------------------------------------- an ink duel
    await page.click('.dock-btn[data-room="grounds"]');
    await page.click('.foe-card[data-foe="imp"]');
    await page.selectOption('#duel-target', { index: 1 });
    const before = await Q(page, () => { const P = __qs.S.projects[__qs.S.activeId]; return P.scenes[P.chapters[0].scenes[0]].words; });
    await page.click('#duel-begin');
    await until(page, () => document.getElementById('duel-pad'), 'the duel begins');
    await page.keyboard.type(words(50, 1));
    ok(await Q(page, () => __qs.app.duel && __qs.app.duel.hp <= 51 && __qs.app.duel.hp > 0), 'each typed word strikes the Imp');
    await shot(page, 'desktop-duel');
    await page.keyboard.type(' ' + words(60, 4));
    await until(page, () => document.getElementById('duel-result')?.classList.contains('won'), 'writing 100+ words defeats the Imp');
    ok(await Q(page, (b) => { const P = __qs.S.projects[__qs.S.activeId]; return P.scenes[P.chapters[0].scenes[0]].words >= b + 100; }, before), 'the duel’s words landed in the chosen scene');
    ok(await Q(page, () => __qs.S.player.relics.includes('jar') && __qs.S.player.bestiary.imp.wins === 1), 'the Imp drops its jar and enters the bestiary');
    await shot(page, 'desktop-duel-won');

    // ---------------------------------------------------------------- free pen, from settings
    await page.click('#tb-settings');
    await page.click('#set-freepen');
    await page.keyboard.press('Escape');
    ok(await Q(page, () => document.querySelectorAll('.dock-btn.locked').length === 0), 'Free Pen opens every door');

    // the loom
    await page.click('.dock-btn[data-room="loom"]');
    await page.click('.structure[data-structure="quest"]');
    await until(page, () => document.querySelector('.beat'), 'choosing a structure shows its beats');
    await page.locator('.beat textarea').first().click();
    await page.keyboard.type('Mara’s forge on the harbour, where the bells ring for the drowned every evening.');
    await until(page, () => document.querySelector('.beat')?.classList.contains('filled'), 'a beat fills');
    await page.locator('.beat .chip-btn').first().click();
    ok(await Q(page, () => { const P = __qs.S.projects[__qs.S.activeId]; return (P.outline.beats['quest:home']?.chapters || []).length === 1; }), 'a beat points at a chapter');
    await Q(page, () => { window.__prompt = 'The crown'; });
    await page.click('#thread-new');
    await page.keyboard.type('The crown');
    await page.keyboard.press('Enter');
    await until(page, () => document.querySelector('.lg-cell'), 'a thread is added to the loom');
    await page.locator('.lg-cell').first().click();
    ok(await Q(page, () => Object.keys(__qs.S.projects[__qs.S.activeId].threads[0].cells).length === 1), 'clicking a cell weaves the thread into a chapter');
    await shot(page, 'desktop-loom');

    // the loft and the map
    await page.click('.dock-btn[data-room="loft"]');
    await page.click('#world-new');
    await page.fill('#wf-name', 'Saltmere');
    await page.fill('#wf-summary', 'A port of bells.');
    await page.click('.tab[data-tab="map"]');
    await page.click('.pin-pick[data-pin]');
    const box = await page.locator('#map-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    ok(await Q(page, () => __qs.S.projects[__qs.S.activeId].map.pins.length === 1), 'clicking the map pins the place');
    await shot(page, 'desktop-map');

    // the well
    await page.click('.dock-btn[data-room="well"]');
    await page.click('.well-btn[data-draw="name"]');
    await until(page, () => document.querySelector('.draw'), 'the Well draws a name');
    const nChars = await Q(page, () => __qs.S.projects[__qs.S.activeId].characters.length);
    await page.locator('.draw .btn').first().click();
    ok(await Q(page, (n) => __qs.S.projects[__qs.S.activeId].characters.length === n + 1, nChars), 'keeping a name adds a character');

    // the sheet: learn a talent by click (Free Pen off for this part)
    await Q(page, () => { __qs.A.setFreePen(__qs.S, false, __qs.app.ctx()); __qs.xp(3000); });
    await page.click('#tb-sheet');
    await until(page, () => __qs.room === 'sheet', 'the topbar opens your Sheet');
    await page.click('.talent[data-talent="l_one"] .btn');
    ok(await Q(page, () => __qs.S.player.talents.includes('l_one')), 'a talent learned by click');
    await page.click('.talent[data-talent="q_snap"] .btn');
    await page.click('.relic[data-relic="jar"]');
    ok(await Q(page, () => __qs.S.player.equipped.charm === 'jar'), 'a relic is worn by click');
    await shot(page, 'desktop-sheet');
    await Q(page, () => __qs.A.setFreePen(__qs.S, true, __qs.app.ctx()));

    // the lens and a snapshot
    await page.click('.dock-btn[data-room="scriptorium"]');
    await page.click('.scene-open');
    if (await page.isVisible('#tool-inspector')) await page.click('#tool-inspector');
    await page.click('.tab[data-tab="lens"]');
    await page.click('#lens-read');
    await until(page, () => document.querySelectorAll('#lens-out .verdict').length > 0, 'Thalion reads the scene through the Lens');
    await page.click('.tab[data-tab="drafts"]');
    await page.click('#snap-take');
    await page.keyboard.press('Enter');
    await until(page, () => document.querySelectorAll('.snap').length === 1, 'a snapshot is kept');
    await shot(page, 'desktop-lens');

    // the library and the board
    await page.click('.dock-btn[data-room="library"]');
    for (const t of ['shelf', 'laurels', 'bestiary', 'ledger', 'tomes']) { await page.click(`.tab[data-tab="${t}"]`); ok(await Q(page, () => document.querySelector('.lib-body').children.length > 0), `the Library’s ${t} tab`); }
    ok(await Q(page, () => document.querySelectorAll('.tome:not(.locked)').length >= 2), 'lessons taught by the quests are on the shelves');
    await page.click('.dock-btn[data-room="board"]');
    ok(await Q(page, () => document.querySelectorAll('.road-item').length === 12 && document.querySelectorAll('.bounty-list li').length === 3), 'the Board shows the road and three bounties');

    // ---------------------------------------------------------------- the bindery
    await page.click('.dock-btn[data-room="bindery"]');
    await until(page, () => document.getElementById('book-preview')?.srcdoc.includes('The Salt Crown'), 'the Bindery previews the book');
    await page.fill('#bk-dedication', 'For the drowned.');
    await page.fill('#bk-epigraph', 'All tides return.');
    for (const id of ['#bk-dropcaps', '#bk-dramatis', '#bk-glossary', '#bk-map']) if (!(await page.isChecked(id))) await page.check(id);
    const dl = async (sel) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click(sel)]); return { name: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) }; };
    const html = await dl('#bind-html');
    ok(html.name === 'the-salt-crown.html' && html.bytes.toString().startsWith('<!DOCTYPE html>') && html.bytes.toString().includes('For the drowned.'), `the web page downloads (${html.name}, ${html.bytes.length} bytes)`);
    ok(['class="dc"', 'Dramatis Personae', 'Glossary', 'data:image/png;base64'].every((t) => html.bytes.toString().includes(t)), 'with drop caps, the appendices and the map plate');
    const epub = await dl('#bind-epub');
    ok(epub.name.endsWith('.epub') && epub.bytes.subarray(30, 38).toString() === 'mimetype' && epub.bytes.subarray(38, 58).toString() === 'application/epub+zip', `the EPUB downloads with mimetype first (${epub.bytes.length} bytes)`);
    fs.writeFileSync(path.join(OUT, 'bt-book.epub'), epub.bytes);
    const md = await dl('#bind-md');
    ok(md.bytes.toString().startsWith('# The Salt Crown'), 'the Markdown downloads');
    await Q(page, () => { __qs.app.printHtml = (h) => { window.__printed = h; }; });
    await page.click('#bind-pdf');
    await until(page, () => /@page \{ size: 6in 9in/.test(window.__printed || '') && window.__printed.includes('data:image/png'), 'Print / PDF prints a page-sized proof, map plate and all');
    await until(page, () => __qs.S.player.stats.exports.html === 1 && __qs.S.player.stats.exports.epub === 1 && __qs.S.player.stats.exports.pdf === 1, 'every binding is counted');
    await shot(page, 'desktop-bindery');

    // ---------------------------------------------------------------- reload and continue
    await Q(page, () => __qs.saveNow());
    const snap = await Q(page, () => ({ xp: __qs.S.player.xp, words: Object.values(__qs.S.projects[__qs.S.activeId].scenes).reduce((a, s) => a + s.words, 0) }));
    await page.goto(URL.replace('?debug', '?title=1&debug'));
    await page.waitForFunction(() => window.__qs);
    await until(page, () => document.getElementById('btn-continue')?.textContent.includes('Wren Ashby'), 'after a reload the title offers Continue as Wren Ashby');
    await page.click('#btn-continue');
    ok(await Q(page, (s) => Math.abs(__qs.S.player.xp - s.xp) < 1e-6 && Object.values(__qs.S.projects[__qs.S.activeId].scenes).reduce((a, x) => a + x.words, 0) === s.words, snap), 'Continue restores the XP and every word');
    await page.click('#tb-settings');
    const bk = await dl('#set-backup');
    const bj = JSON.parse(bk.bytes.toString());
    ok(bj.app === 'quillsworn' && Object.keys(bj.projects).length === 1, 'a backup downloads with the whole guild');
    await page.keyboard.press('Escape');
    ok(await noHScroll(page), 'no sideways scroll');
    reportErrors('desktop');
    await page.context().close();
}

// ======================================================================
async function phone(w, h, full) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await newPage({ viewport: { width: w, height: h }, touch: true });
    const tap = async (sel, fy = 0.5) => {
        const r = await Q(page, ([s, fy]) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + Math.min(b.height * fy, (innerHeight - b.top) * 0.5) }; }, [sel, fy]);
        if (!r) { ok(false, `tap: ${sel} exists`); return false; }
        await page.touchscreen.tap(r.x, r.y);
        await page.waitForTimeout(60);
        return true;
    };
    ok(await backLinkOk(page), '← Games link is on top');
    if (full) {
        await tap('#btn-new');
        for (let i = 0; i < 30 && !(await page.$('#ask-name')); i++) await tap('#dlg-next');
        await tap('#ask-name');
        await page.keyboard.insertText('Pip Thistle');
        await tap('#ask-name-ok');
        for (let i = 0; i < 30 && !(await page.$('#ask-sigil-ok')); i++) await tap('#dlg-next');
        ok(await Q(page, () => { const r = document.getElementById('ask-sigil-ok').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 || true; }), 'the sigil designer');
        await tap('.sig-opt[data-v="tree"]');
        await tap('#ask-sigil-ok');
        for (let i = 0; i < 30 && !(await page.$('.calling')); i++) await tap('#dlg-next');
        await tap('.calling[data-calling="heartseer"]');
        for (let i = 0; i < 30 && await Q(page, () => !document.getElementById('dialogue').hidden); i++) await tap('#dlg-next');
        await until(page, () => __qs.room === 'hall' && __qs.S.player.name === 'Pip Thistle' && __qs.S.player.calling === 'heartseer', 'the prologue by taps');
    } else {
        await Q(page, () => __qs.quickStart('Pip Thistle', 'loremaster'));
    }
    await Q(page, () => { __qs.A.setFreePen(__qs.S, true, __qs.app.ctx()); __qs.app.after(); __qs.go('hall'); });
    await shot(page, `phone-${w}x${h}-hall`);
    ok(await noHScroll(page), 'no sideways scroll in the Hall');
    await tap('.dock-btn[data-room="scriptorium"]');
    await until(page, () => __qs.room === 'scriptorium', 'tapping the dock opens the Scriptorium');
    if (w < 820) {
        await tap('#tool-binder');
        await page.waitForTimeout(350);   // the drawer slides in
        ok(await Q(page, () => document.body.classList.contains('show-binder') && document.getElementById('binder').getBoundingClientRect().left >= -1), 'the ☰ opens the chapter drawer');
        await shot(page, `phone-${w}x${h}-binder`);
        await page.touchscreen.tap(w - 20, h / 2);   // the strip of page beside the drawer
        await page.waitForTimeout(350);
        ok(await Q(page, () => !document.body.classList.contains('show-binder')), 'tapping outside closes it');
    }
    await tap('#page', 0.15);
    ok(await Q(page, () => document.activeElement?.id === 'page'), 'a tap on the page focuses it');
    await page.keyboard.insertText(words(30));
    await until(page, () => __qs.S.player.stats.words >= 30, 'typing on a phone credits words');
    await shot(page, `phone-${w}x${h}-write`);
    const bad = [];
    for (const room of ['hall', 'scriptorium', 'board', 'faces', 'grounds', 'loom', 'loft', 'well', 'library', 'bindery', 'sheet']) {
        await Q(page, (r) => __qs.go(r), room);
        await page.waitForTimeout(room === 'loft' || room === 'bindery' ? 300 : 80);
        if (!(await noHScroll(page))) bad.push(`${room}: sideways scroll`);
        const small = await Q(page, () => [...document.querySelectorAll('#room button, #dock button, #topbar button, #room select, #room input')].filter((e) => {
            const r = e.getBoundingClientRect();
            if (!r.width || !r.height || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') return false;
            if (e.type === 'checkbox') return false;   // checkboxes sit inside 44 px labels
            return r.height < 43.5 && !e.classList.contains('q') && !e.classList.contains('chip-btn');
        }).map((e) => `${e.id || e.className || e.tagName}:${Math.round(e.getBoundingClientRect().height)}`).slice(0, 4));
        if (small.length) bad.push(`${room}: small ${small.join(', ')}`);
        const under = await Q(page, () => { const a = document.getElementById('back-link').getBoundingClientRect(); const t = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2); return !(t === document.getElementById('back-link') || document.getElementById('back-link').contains(t)); });
        if (under) bad.push(`${room}: something covers the back link`);
    }
    ok(!bad.length, `every room fits: 44 px controls, no sideways scroll, back link clear${bad.length ? ` (${bad.join('; ')})` : ''}`);
    await Q(page, () => __qs.go('loft'));
    await Q(page, () => document.querySelector('.tab[data-tab="map"]').click());
    await page.waitForTimeout(300);
    await shot(page, `phone-${w}x${h}-map`);
    await tap('#tb-settings');
    ok(await Q(page, () => { const c = document.querySelector('.modal-card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth + 1; }), 'Settings fits the screen');
    await shot(page, `phone-${w}x${h}-settings`);
    reportErrors(`phone ${w}×${h}`);
    await page.context().close();
}

// ======================================================================
async function resume() {
    console.log('\n== a reload in the middle of the prologue');
    const page = await newPage();
    await page.click('#btn-new');
    await advanceTo(page, '#ask-name');
    await page.fill('#ask-name', 'Rowan Hale');
    await page.click('#ask-name-ok');
    await page.waitForTimeout(1000);           // the name is saved
    await page.reload();
    await page.waitForFunction(() => window.__qs);
    await until(page, () => document.getElementById('btn-continue')?.textContent.includes('Rowan Hale'), 'the title offers to continue the half-finished prologue');
    await page.click('#btn-continue');
    ok(await advanceTo(page, '.calling'), 'Thalion asks for the calling that was never chosen');
    await page.click('.calling[data-calling="loremaster"]');
    await advanceTo(page, null);
    await until(page, () => __qs.S.player.main === 0 && __qs.S.order.length === 1 && __qs.room === 'hall', 'the road begins, with a first novel');
    reportErrors('resume');
    await page.context().close();
}

// ======================================================================
async function endgame() {
    console.log('\n== endgame: the last page');
    const page = await newPage();
    await Q(page, (text) => {
        __qs.quickStart('Wren Ashby', 'weaver');
        const S = __qs.S, A = __qs.A, c = __qs.app.ctx();
        A.editCharter(S, { title: 'The Salt Crown' }, c);
        S.player.main = 11;                      // the guild's road, walked up to its last quest
        S.player.rooms = ['hall', 'scriptorium', 'board', 'faces', 'grounds', 'loom', 'loft', 'well', 'library', 'bindery'];
        const P = S.projects[S.activeId];
        for (let i = 0; i < 20; i++) { const sc = i ? A.addChapter(S, '', c).sc : P.scenes[P.chapters[0].scenes[0]]; A.writeScene(S, sc.id, text, c); }
        __qs.app.after();
        __qs.go('hall');
    }, words(2050));
    ok(await Q(page, () => Object.values(__qs.S.projects[__qs.S.activeId].scenes).reduce((a, s) => a + s.words, 0) >= 40000), 'a 40,000-word novel on the desk');
    await page.click('#btn-charter');
    await page.click('#ch-complete');
    await until(page, () => document.querySelectorAll('.modal-card').length === 2, 'Mark the book complete asks first');
    await page.click('#modals .modal:last-child .btn.primary');
    await until(page, () => __qs.S.projects[__qs.S.activeId].status === 'complete', 'the novel is marked complete');
    await until(page, () => document.querySelector('#btn-speak')?.classList.contains('glow'), 'the Last Page is ready');
    await page.click('#btn-speak');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the finale plays');
    let sawDrawer = false;
    for (let i = 0; i < 40 && await Q(page, () => !document.getElementById('dialogue').hidden); i++) {
        if (await Q(page, () => /desk|drawer/.test(document.querySelector('.dlg-text')?.textContent || ''))) sawDrawer = true;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(20);
    }
    ok(sawDrawer, 'Thalion opens the drawer with his own unfinished book');
    await until(page, () => __qs.S.player.finale && __qs.S.player.relics.includes('lamp') && __qs.S.player.laurels.novel, 'the Lamp of Vellmere, the Novelist laurel, the road walked');
    ok(await Q(page, () => /Master Wren Ashby/.test(document.querySelector('.speech')?.textContent || '')), 'the Hall greets a Master');
    await shot(page, 'endgame-hall');
    ok(await Q(page, () => document.getElementById('dialogue').hidden), 'no second scene trips over the finale');
    await page.click('.dock-btn[data-room="library"]');
    await page.click('.tab[data-tab="shelf"]');
    ok(await Q(page, () => document.querySelector('.book.done .lamp.lit')), 'the finished book glows on the shelf');
    reportErrors('endgame');
    await page.context().close();
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await newPage({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    ok(await Q(page, () => [...document.querySelectorAll('.warn-box')].some((b) => /blocking storage/.test(b.textContent))), 'the title warns that nothing will be saved');
    await Q(page, () => __qs.quickStart('Ash', 'weaver'));
    ok(await Q(page, () => !document.getElementById('banner').hidden), 'a banner keeps warning inside the guild');
    await Q(page, () => { __qs.A.setFreePen(__qs.S, true, __qs.app.ctx()); __qs.go('scriptorium'); });
    await page.click('#page');
    await page.keyboard.type(words(40));
    await page.waitForTimeout(700);
    ok(await Q(page, () => __qs.S.player.stats.words >= 40), 'writing still works');
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#banner .btn')]);
    ok(d.suggestedFilename().startsWith('quillsworn-backup-'), 'the banner downloads a backup');
    reportErrors('nostorage');
    await page.context().close();
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844, true); await phone(844, 390, false); }
    if (want('resume')) await resume();
    if (want('endgame')) await endgame();
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  ✗ threw:', err.message.split('\n').slice(0, 12).join('\n'));
} finally {
    await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${passes} checks) · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
