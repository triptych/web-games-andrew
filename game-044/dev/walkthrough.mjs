/**
 * walkthrough.mjs — plays The Story Thief of Greymantle start to finish
 * through the real UI: verb buttons, clicks on the scene, satchel clicks and
 * dialogue choices. Nothing is teleported; Rowan walks everywhere.
 *
 *   1. The full route to the best ending, checking every point is earned.
 *   2. "Continue" from the autosave, then the Broken Loom ending.
 *   3. "Continue" again, then the Gift of Rowan ending.
 *   4. A tour of deaths, each followed by "Turn back a page", checking the
 *      state really is restored.
 *
 * Needs a static server on the repo root (python3 -m http.server 8044).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8044';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

let checks = 0, failed = 0;
function check(cond, label) {
    checks++;
    if (!cond) { failed++; console.log('  ✗ ' + label); } else if (process.env.VERBOSE) console.log('  ✓ ' + label);
}

await page.addInitScript(() => {
    try {
        if (!sessionStorage.getItem('wt-init')) {
            localStorage.clear();
            localStorage.setItem('game-044-prefs', JSON.stringify({ sound: false, textSpeed: 0 }));
            sessionStorage.setItem('wt-init', '1');
        }
    } catch { /* ignore */ }
});
await page.goto(`${BASE}/game-044/index.html`);
await page.waitForTimeout(500);

const S = (expr) => page.evaluate(expr);
const story = () => S(() => ({ scene: __story.scene, busy: __story.busy, running: __story.running, moving: __story.player.moving, score: __story.score, inv: __story.inv }));

let choiceQueue = [];
const seenText = [];

/** Advance any messages, answer choices from the queue, until the game is idle. */
async function settle(maxMs = 60000) {
    const t0 = Date.now();
    let idleSince = 0;
    while (Date.now() - t0 < maxMs) {
        const ui = await page.evaluate(() => ({
            msg: !document.getElementById('msg').hidden,
            text: document.getElementById('msg-text').innerText,
            choices: [...document.querySelectorAll('#msg-choices .choice')].map(b => b.innerText.replace(/^\d+\s*/, '')),
            pages: !document.getElementById('pages').hidden,
            pageTitle: document.getElementById('pg-title').innerText,
            pageBtns: [...document.querySelectorAll('#pg-btns button')].map(b => b.innerText),
        }));
        if (ui.pages) return { pages: true, ...ui };
        if (ui.msg && ui.choices.length) {
            const want = choiceQueue.shift();
            if (want === undefined) throw new Error('Unexpected choice: ' + JSON.stringify(ui.choices) + '\n  prompt: ' + ui.text);
            const idx = ui.choices.findIndex(c => c.includes(want));
            if (idx < 0) throw new Error(`Choice "${want}" not in ${JSON.stringify(ui.choices)}`);
            await page.click(`#msg-choices .choice:nth-child(${idx + 1})`);
            idleSince = 0;
            continue;
        }
        if (ui.msg) {
            seenText.push(ui.text);
            await page.click('#msg-box');
            await page.waitForTimeout(20);
            idleSince = 0;
            continue;
        }
        const st = await story();
        if (!st.busy && !st.moving) {
            if (!idleSince) idleSince = Date.now();
            if (Date.now() - idleSince > 250) return { idle: true };
        } else idleSince = 0;
        await page.waitForTimeout(40);
    }
    throw new Error('settle() timed out in ' + (await story()).scene);
}

async function clickGame(x, y) {
    const r = await page.evaluate(() => { const b = document.getElementById('screen').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await page.mouse.click(r.x + x / 320 * r.w, r.y + y / 200 * r.h);
}

/** A point inside `spot` whose topmost hotspot really is `spot` (not Rowan, not something in front). */
async function pointFor(id) {
    return page.evaluate((id) => {
        const s = __story.spots().find(h => h.id === id);
        if (!s) return null;
        let pts = [];
        const sh = s.shape;
        if (sh.rect) { const [x, y, w, h] = sh.rect; for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) pts.push([x + w * i / 8, y + h * j / 8]); }
        else if (sh.circle) { const [cx, cy, r] = sh.circle; pts.push([cx, cy], [cx + r / 2, cy], [cx - r / 2, cy]); }
        else if (sh.poly) {
            const xs = sh.poly.map(p => p[0]), ys = sh.poly.map(p => p[1]);
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) pts.push([x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * j / 10]);
        }
        // prefer points near the middle
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        pts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
        return pts.find(([x, y]) => __story.spotAt(x, y) === id) || null;
    }, id);
}

async function setVerb(v) { await page.click('#v-' + v); }

/** Do `verb` to hotspot `id` (optionally with an item), answering `choices` as they come. */
async function act(verb, id, { item = null, choices = [] } = {}) {
    await settle();
    const p = await pointFor(id);
    if (!p) throw new Error(`No clickable point for hotspot "${id}" in ${(await story()).scene}. Spots: ${JSON.stringify((await S(() => __story.spots())).map(s => s.id))}`);
    if (item) {
        await setVerb('walk');
        await page.click(`.slot[data-item="${item}"]`);
    } else await setVerb(verb);
    choiceQueue = choices.slice();
    await clickGame(p[0], p[1]);
    const r = await settle();
    if (choiceQueue.length) throw new Error(`Unused choices ${JSON.stringify(choiceQueue)} after ${verb} ${id}`);
    return r;
}

async function combine(a, b) {
    await settle();
    await setVerb('walk');
    await page.click(`.slot[data-item="${a}"]`);
    await page.click(`.slot[data-item="${b}"]`);
    return settle();
}

async function lookItem(id) {
    await settle();
    await setVerb('look');
    await page.click(`.slot[data-item="${id}"]`);
    return settle();
}

async function go(id, expectScene) {
    await act('walk', id);
    const sc = (await story()).scene;
    check(sc === expectScene, `walked to ${expectScene} (in ${sc})`);
}

/**
 * Playwright's click happily clicks through #fade (pointer-events:none) and
 * never notices a page hidden under the title, so check what a player would
 * actually see: the button is topmost at its centre and the fade has lifted.
 */
async function assertSeen(sel, label) {
    let why = null;
    for (let n = 0; n < 15; n++) {
        why = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'missing';
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            if (!top || !(top === el || el.contains(top))) return 'covered by ' + (top?.closest('[id]')?.id || top?.tagName);
            const f = +getComputedStyle(document.getElementById('fade')).opacity;
            return f > 0.05 ? 'under the fade' : null;
        }, sel);
        if (!why) break;
        await page.waitForTimeout(60);
    }
    check(!why, `${label} is visible${why ? ' — ' + why : ''}`);
}

async function clickPageButton(label) {
    const btns = await page.$$eval('#pg-btns button', bs => bs.map(b => b.innerText));
    const i = btns.findIndex(b => b.includes(label));
    if (i < 0) throw new Error(`No page button "${label}" in ${JSON.stringify(btns)}`);
    await assertSeen(`#pg-btns button:nth-child(${i + 1})`, `page button "${label}"`);
    await page.click(`#pg-btns button:nth-child(${i + 1})`);
}

/** Turn every storybook page until a page offering `finalLabel` appears. */
async function turnPagesUntil(finalLabel) {
    for (let n = 0; n < 20; n++) {
        await page.waitForSelector('#pages:not([hidden])', { timeout: 30000 });
        const btns = await page.$$eval('#pg-btns button', bs => bs.map(b => b.innerText));
        if (btns.some(b => b.includes(finalLabel))) return btns;
        await assertSeen('#pg-btns button:first-child', `page button "${btns[0]}"`);
        await page.click('#pg-btns button:first-child');
        await page.waitForTimeout(60);
    }
    throw new Error('Never reached a page with ' + finalLabel);
}

const has = async (id) => (await story()).inv.includes(id);

// =====================================================================
// 1. The whole game, best ending
// =====================================================================
console.log('Route 1: the Keeper\'s Daughter');
await assertSeen('#t-howto', 'How to Play button');
await page.click('#t-howto');
await clickPageButton('Continue');
await assertSeen('#t-new', 'Begin a New Tale button');
await page.click('#t-new');
await turnPagesUntil('Begin');
await clickPageButton('Begin');
await settle();
check((await story()).scene === 'cottage', 'new game starts in the cottage');

// leaving before talking to Gran is refused
await act('walk', 'door');
check((await story()).scene === 'cottage', 'cannot leave before saying goodbye to Gran');

await act('talk', 'mab', { choices: ["What's happening", 'Who lives up', "I'm going up the mountain"] });
check(await has('book') && await has('penny'), 'Gran gives the Book and the penny');
await act('use', 'cake');
await act('use', 'rope');
await act('use', 'poker');
check(await has('cake') && await has('rope') && await has('poker'), 'took cake, rope, poker');
await act('look', 'window');
await go('door', 'green');

await act('talk', 'pell', { choices: ['anything strange', 'rescues herself'] });
await act('look', 'board');
await act('use', 'well', { item: 'rope' });
check(await has('brasskey'), 'rope + well = brass key');
check(await has('rope'), 'rope comes back after the well');
await go('road', 'bridge');

await act('walk', 'on');
check((await story()).scene === 'bridge', 'troll blocks the bridge');
await act('talk', 'troll', { choices: ['Rowan Ashby', 'Once upon a time', 'Why do you want', 'Never mind'] });
await act('use', 'troll', { item: 'penny' });
check(await has('penny'), 'troll refuses the penny');
await act('use', 'troll', { item: 'cake' });
check(await S(() => __story.flag('trollMoved')), 'cake moves the troll');
await go('on', 'pines');

await act('use', 'moonbells');
await act('talk', 'magpie', { choices: ['What have you got', 'feather', 'Goodbye'] });
await act('use', 'magpie', { item: 'brasskey' });
check(await has('brasskey'), 'magpie refuses the brass key');
await act('use', 'magpie', { item: 'penny' });
check(await has('quill') && await has('button') && !(await has('penny')), 'penny traded for quill + button');

// take Pell her button back
await go('west', 'bridge');
await go('back', 'green');
await act('use', 'pell', { item: 'button' });
check(!(await has('button')), 'button returned to Pell');
await go('road', 'bridge');
await go('on', 'pines');
await go('east', 'hut');

await act('talk', 'wenna', { choices: ['Do you know the Warlock', 'What happened to Elsie', 'How do I get inside', 'sleeping draught', 'Goodbye'] });
check(await has('draught'), 'Wenna brews the draught from moonbells');
await act('use', 'bone');
await act('use', 'wenna', { item: 'quill' });
await act('use', 'wenna', { item: 'brasskey' });
await combine('bone', 'draught');
check(await has('drowsybone'), 'bone + draught = drowsy bone');
await go('door', 'pines');
await go('north', 'gate');

await act('walk', 'door');
check((await story()).scene === 'gate', 'door shut before the riddles');
// one wrong answer, then all three
await act('talk', 'face', { choices: ['Ask me your riddles', 'A ghost', 'Goodbye'] });
check(!(await S(() => __story.flag('doorOpen'))), 'a wrong answer keeps the door shut');
await act('talk', 'face', { choices: ['Ask me your riddles', 'A book', 'Sleep', 'A story'] });
check(await S(() => __story.flag('doorOpen')), 'three riddles open the door');
await go('door', 'cavern');

await act('walk', 'stair', { choices: ['Back away slowly'] });
check((await story()).scene === 'cavern', 'Brimble blocks the stair while awake');
await act('use', 'hound', { item: 'drowsybone' });
check(await S(() => __story.flag('houndAsleep')), 'drowsy bone puts Brimble to sleep');
await go('stair', 'library');

await act('use', 'mabbottle');
check(!(await has('bottle')), 'bottle out of reach without the ladder');
await act('use', 'ladder', { item: 'poker' });
check(await S(() => __story.flag('ladderMoved')), 'poker frees the ladder');
await act('use', 'mabbottle');
check(await has('bottle'), 'climbed for Gran\'s bottle');
await combine('book', 'bottle');
check(await S(() => __story.flag('pouredBottle')), 'poured Gran\'s stories into the Book');
await act('use', 'journal');
check(await has('silverkey'), 'journal gives the silver key');
await act('use', 'towerdoor', { item: 'silverkey' });
await go('towerdoor', 'tower');

await act('talk', 'elsie');
await act('use', 'diary');
await act('use', 'box', { item: 'brasskey' });
check(await has('tale'), 'music box gives the Unfinished Tale');
await lookItem('tale');
await combine('quill', 'tale');
await go('down', 'library');
await go('sanctum', 'sanctum');

await act('talk', 'corvin', { choices: ['Why are you doing this', 'finishing *her* story', 'Goodbye'].map(s => s.replace(/\*/g, '')) });
await act('use', 'corvin', { item: 'tale' });
check(!(await has('tale')), 'Corvin takes the tale');
// the finale runs on through the tower and into the storybook pages
await act('use', 'corvin', { item: 'quill', choices: ["You don't have to know"] });
const endBtns = await turnPagesUntil('Begin a new tale');
const endText = await page.$eval('#pg-text', e => e.innerText);
check(endText.includes("The Keeper's Daughter"), 'reached The Keeper\'s Daughter');
const fin = await story();
check(fin.score === 200, `perfect score (got ${fin.score})`);
check(endText.includes('200 of 200'), 'end page reports 200 of 200');
const earned = await S(() => __story.earned);
console.log(`  score ${fin.score}; ${Object.keys(earned).length} awards`);
void endBtns;

// read the Book from the end page, then go back to the title
await clickPageButton('Read the Book of Tales');
await page.waitForSelector('#book:not([hidden])');
const entries = await page.$$eval('#book-body .entry', es => es.length);
check(entries >= 15, `the Book of Tales has the whole story (${entries} entries)`);
await page.click('#book-close');
await turnPagesUntil('Back to the title');
await clickPageButton('Back to the title');
await page.waitForSelector('#title:not([hidden])');
check(!(await page.$eval('#t-continue', b => b.hidden)), 'title offers Continue after an ending');

// =====================================================================
// 2. Continue from the autosave (entering the sanctum) → the Broken Loom
// =====================================================================
console.log('Route 2: the Broken Loom');
await page.click('#t-continue');
await settle();
check((await story()).scene === 'sanctum', 'Continue resumes at the sanctum');
check(await has('tale') && await has('quill') && await has('poker'), 'autosave kept the tale, quill and poker');
await act('use', 'loom', { item: 'poker', choices: ['Not yet'] });
check(!(await S(() => __story.flag('loomBroken'))), '"Not yet" spares the Loom');
await act('use', 'loom', { item: 'poker', choices: ['Smash the Loom'] }).catch(() => {});
await turnPagesUntil('Begin a new tale');
check((await page.$eval('#pg-text', e => e.innerText)).includes('The Broken Loom'), 'reached The Broken Loom');
check((await page.$eval('#pg-text', e => e.innerText)).includes('Endings found: 2 of 3'), 'two endings recorded');
await clickPageButton('Back to the title');

// =====================================================================
// 3. Continue again → the Gift of Rowan
// =====================================================================
console.log('Route 3: the Gift of Rowan');
await page.click('#t-continue');
await settle();
await act('talk', 'corvin', { choices: ['Why are you doing this', 'Take my story', 'Wait', 'Take my story', 'Do it'] }).catch(() => {});
await turnPagesUntil('Begin a new tale');
check((await page.$eval('#pg-text', e => e.innerText)).includes('The Gift of Rowan'), 'reached The Gift of Rowan');
check((await page.$eval('#pg-text', e => e.innerText)).includes('Endings found: 3 of 3'), 'all three endings recorded');
await clickPageButton('Begin a new tale');

// =====================================================================
// 4. Deaths, and turning back a page
// =====================================================================
console.log('Route 4: deaths');
await turnPagesUntil('Begin');
await clickPageButton('Begin');
await settle();
await act('talk', 'mab', { choices: ["I'm going up the mountain"] });
await act('use', 'poker');
await go('door', 'green');

async function dieAndRetry(verb, id, opts, title) {
    const before = await story();
    await act(verb, id, opts);
    const t = await page.$eval('#pg-title', e => e.innerText);
    check(t.toLowerCase().includes(title.toLowerCase()), `death: ${title} (got "${t}")`);
    await clickPageButton('Turn back a page');
    await settle();
    const after = await story();
    check(after.scene === before.scene && JSON.stringify(after.inv) === JSON.stringify(before.inv) && after.score === before.score, `turning back a page restores ${before.scene}`);
}
await dieAndRetry('use', 'well', { choices: ['Climb down anyway'] }, 'A Well-Deserved End');
await go('road', 'bridge');
await dieAndRetry('use', 'troll', { item: 'poker', choices: ['Poke the troll'] }, 'Troll Toll');
await dieAndRetry('use', 'river', { choices: ['Swim across'] }, 'Swept Away');
check(await S(() => __story.deaths) === 3, 'death counter survives restores');

console.log(`\n${checks - failed}/${checks} checks passed`);
if (errors.length) console.log('Console errors:\n' + errors.join('\n'));
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
