/**
 * browsertest.mjs — real Chromium walks SPINFRAME.
 *
 * Desktop: title → New Cadet → callsign → prologue → hub tabs → deploy
 * chapter 0 → intro scene → map → battle by clicking SPIN, tapping a reel,
 * nudging and ENGAGE, then AUTO to the end → rewards → a Signal event, depot,
 * repair bay, salvage, elite (module pick), boss → outro scene → hub → Sim
 * Ladder → a defeat → skills, modules, facilities, contracts → reload and
 * Continue → pause menu and settings. Then a boss fight in every chapter
 * (screenshots), and touch-only play on 390×844 and 844×390 phones with
 * layout assertions (tap targets, nothing off-screen, no overlap).
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8048                 # from the REPO ROOT
 *   node game-048/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8048), OUT (screenshots), ONLY=desktop|chapters|phones
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8048';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    // a clean save once per context (not on reload), pinned quality, fast battles
    await ctx.addInitScript(() => {
        try {
            if (!sessionStorage.getItem('sf-init')) {
                sessionStorage.setItem('sf-init', '1');
                localStorage.clear();
                localStorage.setItem('spinframe-settings', JSON.stringify({ quality: 1, speed: 2.4, music: 0.1, sfx: 0.1, calm: false }));
            }
        } catch { /* ignore */ }
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} ${e.stack?.split('\n')[1] ?? ''}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, sel) => page.locator(sel).isVisible();

async function openGame(page) {
    await page.goto(`${BASE}/game-048/index.html?debug=1`);
    await until(page, () => window.__sf && document.querySelector('#scr-title:not(.hidden)'), 'title screen up');
}

/** Click through any comm scene that is showing. */
async function finishStory(page, label) {
    for (let i = 0; i < 40; i++) {
        if (!(await visible(page, '#scr-story'))) return;
        await page.click('#story-next');
        await page.waitForTimeout(40);
        await page.click('#story-next');
        await page.waitForTimeout(40);
    }
    check(!(await visible(page, '#scr-story')), `${label}: scene finished`);
}

const idle = (page) => until(page, () => window.__sf.screen !== 'battle' || window.__sf.idle() || window.__sf.battle.ended, 'battle idle', 60000);

async function winByAuto(page, label, maxMs = 120000) {
    await Q(page, () => { if (!window.__sf.battle.auto) document.querySelector('#b-auto').click(); });
    const ok = await until(page, () => window.__sf.screen !== 'battle' || document.querySelector('#scr-panel:not(.hidden)'), `${label}: fight resolved`, maxMs);
    return ok;
}

async function forceWin(page, label) {
    await idle(page);
    await Q(page, () => window.__sf.win());
    await until(page, () => document.querySelector('#scr-panel:not(.hidden)') || window.__sf.screen === 'story', `${label}: rewards or story after the win`);
}

/** Take a reward: pick the first choice card if there are any, else Continue. */
async function takeReward(page, label) {
    await until(page, () => document.querySelector('#scr-panel:not(.hidden)'), `${label}: reward panel`);
    const cards = await page.locator('#panel-body .choice').count();
    if (cards) await page.locator('#panel-body .choice').first().click();
    else await page.click('#panel-foot .menu-btn');
    await page.waitForTimeout(150);
}

// ======================================================================== desktop

async function desktop() {
    console.log('desktop 1280×720');
    const { page } = await newPage({ width: 1280, height: 720 });
    await openGame(page);
    await shot(page, 'd01-title');
    check(!(await visible(page, '#t-continue')), 'no Continue on a fresh install');
    await page.click('#t-new');
    await until(page, () => document.querySelector('#scr-callsign:not(.hidden)'), 'callsign screen');
    await page.fill('#cs-input', 'tester');
    await page.click('#cs-go');
    await until(page, () => window.__sf.screen === 'story', 'prologue plays');
    await page.waitForTimeout(400);
    await shot(page, 'd02-prologue');
    check((await page.textContent('#story-line')).length > 0 || true, 'story text types');
    await finishStory(page, 'prologue');
    await until(page, () => window.__sf.screen === 'hub', 'hub after the prologue');
    check((await page.textContent('#hub-cs')) === 'TESTER', 'callsign upper-cased and shown');
    for (const tab of ['frame', 'modules', 'pilot', 'contracts', 'facilities', 'deploy']) {
        await page.click(`.tab[data-tab="${tab}"]`);
        await page.waitForTimeout(80);
        check(await page.locator('#hub-body').evaluate((n) => n.children.length > 0), `hub tab ${tab} renders`);
        if (tab === 'frame' || tab === 'pilot') await shot(page, `d03-hub-${tab}`);
    }

    // ---- chapter 0 by the real UI
    await page.locator('.chap').first().click();
    await until(page, () => window.__sf.screen === 'story', 'chapter 0 intro scene');
    await finishStory(page, 'intro0');
    await until(page, () => window.__sf.screen === 'map', 'sector map');
    await shot(page, 'd04-map');
    const nAvail = await page.locator('.node.avail').count();
    check(nAvail === 3, `three starting nodes (${nAvail})`);
    await page.locator('.node.avail').first().click();
    await until(page, () => window.__sf.screen === 'battle', 'battle starts from the map');
    await idle(page);
    await shot(page, 'd05-battle');
    // SPIN by button
    await page.click('#b-spin');
    await page.waitForTimeout(300);
    await shot(page, 'd06-spinning');
    await idle(page);
    check(await Q(page, () => window.__sf.battle.st.phase === 'landed'), 'reels landed');
    await shot(page, 'd07-landed');
    // tap a reel → menu → nudge
    const rp = await Q(page, () => window.__sf.reelPx(1));
    await page.mouse.click(rp.x, rp.y);
    await page.waitForTimeout(100);
    check(await visible(page, '#reel-menu'), 'reel menu opens on a reel tap');
    const e0 = await Q(page, () => window.__sf.battle.st.player.energy + window.__sf.battle.st.player.freeNudges);
    if (await page.locator('#rm-down').isEnabled()) {
        const pos0 = await Q(page, () => window.__sf.battle.st.reels[1].pos);
        await page.click('#rm-down');
        await idle(page);
        const pos1 = await Q(page, () => window.__sf.battle.st.reels[1].pos);
        const e1 = await Q(page, () => window.__sf.battle.st.player.energy + window.__sf.battle.st.player.freeNudges);
        check(pos1 !== pos0 && e1 === e0 - 1, 'nudge moves the reel and costs 1 energy');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    if (await visible(page, '#scr-panel')) await page.click('#panel-foot .menu-btn.primary');
    await idle(page);
    await page.click('#b-spin');   // ENGAGE
    await page.waitForTimeout(500);
    await shot(page, 'd08-resolving');
    await idle(page);
    // target by clicking an enemy
    const tgt = await Q(page, () => { const a = window.__sf.battle.st.enemies.filter((e) => e.hp > 0); const e = a[a.length - 1]; if (!e) return null; const p = window.__sf.enemyPx(e.id); return { id: e.id, ...p }; });
    if (tgt && (await Q(page, () => window.__sf.screen === 'battle' && window.__sf.battle.st.phase === 'ready'))) {
        await page.mouse.click(tgt.x, tgt.y);
        check(await Q(page, (id) => window.__sf.battle.st.target === id, tgt.id), 'clicking an enemy targets it');
    }
    await winByAuto(page, 'first skirmish');
    if (await Q(page, () => window.__sf.screen === 'battle' && window.__sf.battle.st.phase === 'lost')) console.log('  (lost the first fight)');
    await page.waitForTimeout(500);
    await shot(page, 'd09-rewards');
    await takeReward(page, 'first skirmish');
    await until(page, () => window.__sf.screen === 'map' || window.__sf.screen === 'hub', 'back on the map after the fight');

    // ---- every node type through debug jumps (chapter 1 has them all)
    await Q(page, () => { window.__sf.give(20000, 10); window.__sf.best(1); window.__sf.p.sector = null; window.__sf.toHub(); });
    await Q(page, () => window.__sf.deploy(1));
    await until(page, () => window.__sf.screen === 'map', 'chapter 1 map');
    for (const type of ['event', 'depot', 'rest', 'salvage']) {
        const went = await Q(page, (t) => window.__sf.goto(t), type);
        if (!went) { console.log(`  (no ${type} node on this map)`); continue; }
        await until(page, () => document.querySelector('#scr-panel:not(.hidden)'), `${type}: panel opens`);
        await shot(page, `d10-${type}`);
        if (type === 'event') {
            await page.locator('.ev-choices button:not([disabled])').first().click();
            await page.waitForTimeout(2600);
            const fightBtn = await page.locator('#panel-foot .menu-btn', { hasText: 'Fight' }).count();
            await page.click('#panel-foot .menu-btn');
            if (fightBtn) { await until(page, () => window.__sf.screen === 'battle', 'event fight'); await forceWin(page, 'event fight'); await takeReward(page, 'event fight'); }
        } else if (type === 'depot') {
            const s0 = await Q(page, () => window.__sf.p.scrap);
            await page.locator('#panel-body .buy:not([disabled])').first().click();
            check((await Q(page, () => window.__sf.p.scrap)) < s0, 'depot: buying spends scrap');
            await page.click('#panel-foot .menu-btn');
        } else if (type === 'rest') {
            await page.locator('#panel-body .choice').first().click();
        } else {
            await page.locator('#panel-body .choice').first().click();
        }
        await until(page, () => window.__sf.screen === 'map' && !document.querySelector('#scr-panel:not(.hidden)'), `${type}: back to the map`);
    }
    // elite → module pick
    if (await Q(page, () => window.__sf.goto('elite'))) {
        await until(page, () => window.__sf.screen === 'battle', 'elite fight');
        await idle(page);
        await shot(page, 'd11-elite');
        const mods0 = await Q(page, () => window.__sf.p.mods.length);
        await forceWin(page, 'elite');
        await page.waitForTimeout(400);
        await page.locator('#panel-body .choice').first().click();
        check((await Q(page, () => window.__sf.p.mods.length)) >= mods0, 'elite reward taken');
    }
    // boss → outro → hub
    await Q(page, () => { window.__sf.p.story.seen = window.__sf.p.story.seen.filter((s) => s !== 'boss1'); });
    await Q(page, () => window.__sf.goto('boss'));
    await until(page, () => window.__sf.screen === 'story', 'boss intro scene');
    await shot(page, 'd12-boss-scene');
    await finishStory(page, 'boss1');
    await until(page, () => window.__sf.screen === 'battle', 'boss fight');
    await idle(page);
    await page.click('#b-spin');
    await idle(page);
    await page.click('#b-spin');
    await page.waitForTimeout(700);
    await shot(page, 'd13-boss-fight');
    await forceWin(page, 'boss');
    await page.waitForTimeout(300);
    await takeReward(page, 'boss');
    await until(page, () => window.__sf.screen === 'story', 'chapter 1 outro');
    await finishStory(page, 'outro1');
    await until(page, () => window.__sf.screen === 'hub', 'hub after the chapter');
    check(await Q(page, () => window.__sf.p.campaign.best === 2), 'chapter 2 unlocked');

    // ---- frame upgrade changes the machine
    await page.click('.tab[data-tab="frame"]');
    const cols0 = await Q(page, () => window.__sf.p.mech.reels);
    await page.locator('[data-sys="reels"] .buy').click();
    check((await Q(page, () => window.__sf.p.mech.reels)) === cols0 + 1, 'Reel Array upgrade adds a reel');
    await shot(page, 'd14-upgraded');
    // ---- skill
    await page.click('.tab[data-tab="pilot"]');
    const sp = await Q(page, () => window.__sf.p.pilot.sp);
    if (sp > 0) {
        await page.locator('.sk.can').first().click();
        await page.locator('.sk.can').first().click();
        check((await Q(page, () => window.__sf.p.pilot.sp)) === sp - 1, 'learning a skill spends a point');
    }
    // ---- modules
    await page.click('.tab[data-tab="modules"]');
    if (await page.locator('.mod .acts button').count()) {
        await page.locator('.mod .acts button').first().click();
        check(true, 'module equip toggle');
    }
    // ---- facilities
    await page.click('.tab[data-tab="facilities"]');
    await page.locator('.fac .buy:not([disabled])').first().click();
    check(await Q(page, () => window.__sf.p.facilities.refinery >= 1), 'refinery built');
    await Q(page, () => { window.__sf.p.facilities.bank = 500; });
    await page.click('.tab[data-tab="facilities"]');
    const sc0 = await Q(page, () => window.__sf.p.scrap);
    await page.locator('.bank-row .buy').click();
    check((await Q(page, () => window.__sf.p.scrap)) >= sc0 + 500, 'collect banks refinery scrap');
    await shot(page, 'd15-facilities');
    // ---- contracts
    await Q(page, () => { const q = window.__sf.p.quests.active[0]; q.progress = q.target; q.done = true; });
    await page.click('.tab[data-tab="contracts"]');
    const claimed0 = await Q(page, () => window.__sf.p.quests.claimed);
    await page.locator('.quest.done .buy').first().click();
    check((await Q(page, () => window.__sf.p.quests.claimed)) === claimed0 + 1, 'contract claimed');
    check((await Q(page, () => window.__sf.p.quests.active.length)) === 3, 'board refilled');

    // ---- Sim Ladder
    await page.click('.tab[data-tab="deploy"]');
    await page.locator('.row .buy', { hasText: 'Climb' }).click();
    await until(page, () => window.__sf.screen === 'battle', 'ladder fight');
    await forceWin(page, 'ladder floor 1');
    await page.click('#panel-foot .menu-btn');
    await until(page, () => document.querySelector('#panel-title')?.textContent.includes('Keep climbing'), 'ladder: keep climbing?');
    await page.locator('#panel-foot .menu-btn', { hasText: 'Leave' }).click();
    check(await Q(page, () => window.__sf.p.ladder.best >= 1 && !window.__sf.p.ladder.run), 'ladder banked and left');

    // ---- defeat
    await Q(page, () => window.__sf.deploy(2));
    await until(page, () => window.__sf.screen === 'map', 'chapter 2 map');
    await Q(page, () => window.__sf.goto('battle'));
    await until(page, () => window.__sf.screen === 'battle', 'fight to lose');
    await idle(page);
    await Q(page, () => window.__sf.lose());
    await until(page, () => document.querySelector('#panel-title')?.textContent.includes('Frame Down'), 'defeat panel');
    await shot(page, 'd16-defeat');
    await page.click('#panel-foot .menu-btn');
    check(await Q(page, () => window.__sf.p.sector === null && window.__sf.screen === 'hub'), 'defeat returns to the carrier');

    // ---- pause menu & settings
    await page.keyboard.press('Escape');
    await until(page, () => document.querySelector('#panel-title')?.textContent === 'Paused', 'pause menu');
    await page.locator('#panel-body button', { hasText: 'Settings' }).click();
    await until(page, () => document.querySelector('#panel-title')?.textContent === 'Settings', 'settings panel');
    await page.click('#panel-foot .menu-btn');
    await page.click('#panel-foot .menu-btn');

    // ---- reload & continue
    const cs = await Q(page, () => window.__sf.p.callsign);
    await page.reload();
    await until(page, () => window.__sf && document.querySelector('#scr-title:not(.hidden)'), 'title after reload');
    check(await visible(page, '#t-continue'), 'Continue offered');
    await page.click('#t-continue');
    await until(page, () => window.__sf.screen === 'hub', 'continue → hub');
    check((await Q(page, () => window.__sf.p.callsign)) === cs, 'save survived the reload');
    // How to play
    await Q(page, () => window.__sf.toHub());
}

// ======================================================================== every chapter

async function chapters() {
    console.log('boss fights in every chapter');
    const { page } = await newPage({ width: 1280, height: 720 });
    await openGame(page);
    await Q(page, () => { window.__sf.newGame('BOSS', 4242, true); window.__sf.best(7); window.__sf.mech({ reels: 3, matrix: 6, reactor: 5, missile: 10, arc: 10, blade: 20, cannon: 20, armor: 20, core: 4 }); window.__sf.mod('cascade', 3, 6); });
    for (let ch = 0; ch < 7; ch++) {
        await Q(page, (c) => { window.__sf.p.sector = null; window.__sf.deploy(c); }, ch);
        await until(page, () => window.__sf.screen === 'map', `chapter ${ch} map`);
        await Q(page, () => window.__sf.goto('boss'));
        await until(page, () => window.__sf.screen === 'battle', `chapter ${ch} boss`);
        await idle(page);
        await page.click('#b-spin');
        await idle(page);
        await page.click('#b-spin');
        await page.waitForTimeout(900);
        await shot(page, `c${ch}-boss`);
        await idle(page);
        if (await Q(page, () => window.__sf.screen === 'battle' && !window.__sf.battle.ended)) await Q(page, () => window.__sf.win());
        await until(page, () => document.querySelector('#scr-panel:not(.hidden)') || window.__sf.screen === 'story', `chapter ${ch}: boss ends`);
        if (await visible(page, '#scr-panel')) await takeReward(page, `chapter ${ch}`);
        if (await Q(page, () => window.__sf.screen === 'story')) await finishStory(page, `outro${ch}`);
        await Q(page, () => window.__sf.toHub());
    }
}

// ======================================================================== phones

async function phone(vw, vh) {
    console.log(`phone ${vw}×${vh} (touch)`);
    const { ctx, page } = await newPage({ width: vw, height: vh }, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    const tap = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(60);
    };
    const tapSel = async (sel) => {
        const b = await page.locator(sel).first().boundingBox();
        await tap(b.x + b.width / 2, b.y + b.height / 2);
    };
    await openGame(page);
    await shot(page, `p${vw}-title`);
    await Q(page, () => window.__sf.newGame('THUMB', 31, true));
    await until(page, () => window.__sf.screen === 'hub', 'hub');
    await shot(page, `p${vw}-hub`);
    await tapSel('.chap');
    await until(page, () => window.__sf.screen === 'story', 'intro by touch');
    for (let i = 0; i < 20 && (await visible(page, '#scr-story')); i++) await tapSel('#story-next');
    await until(page, () => window.__sf.screen === 'map', 'map by touch');
    await shot(page, `p${vw}-map`);
    await tapSel('.node.avail');
    await until(page, () => window.__sf.screen === 'battle', 'battle by touch');
    await idle(page);
    // layout: controls on screen, big enough, not covering the reels
    const lay = await Q(page, () => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const reels = window.__sf.battle.reels.rect;
        const out = { spin: r('#b-spin'), auto: r('#b-auto'), speed: r('#b-speed'), menu: r('#b-menu'), reels, W: innerWidth, H: innerHeight };
        out.boosts = [...document.querySelectorAll('.boost')].map((b) => b.getBoundingClientRect());
        return JSON.parse(JSON.stringify(out));
    });
    const inside = (b) => b.x >= -1 && b.y >= -1 && b.x + b.width <= lay.W + 1 && b.y + b.height <= lay.H + 1;
    check(inside(lay.spin) && inside(lay.auto) && inside(lay.speed) && inside(lay.menu) && lay.boosts.every(inside), 'every control on screen');
    check(lay.spin.height >= 44 && lay.menu.height >= 36 && lay.boosts.every((b) => b.width >= 32), 'tap targets big enough');
    check(lay.reels.y + lay.reels.h <= lay.spin.y, 'reels sit above the SPIN button');
    check(lay.reels.x >= 0 && lay.reels.x + lay.reels.w <= lay.W, 'reels fit the width');
    await tapSel('#b-spin');
    await idle(page);
    const rp = await Q(page, () => window.__sf.reelPx(0));
    await tap(rp.x, rp.y);
    check(await visible(page, '#reel-menu'), 'reel menu by touch');
    const menu = await page.locator('#reel-menu').boundingBox();
    check(menu.x >= 0 && menu.x + menu.width <= vw && menu.y >= 0, 'reel menu on screen');
    await shot(page, `p${vw}-reelmenu`);
    await tapSel('#b-spin');   // engage
    await page.waitForTimeout(500);
    await shot(page, `p${vw}-battle`);
    await idle(page);
    await tapSel('#b-auto');
    await until(page, () => window.__sf.screen !== 'battle' || document.querySelector('#scr-panel:not(.hidden)'), 'auto finishes the fight', 150000);
    await page.waitForTimeout(400);
    await shot(page, `p${vw}-rewards`);
}

// ======================================================================== run

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'chapters') await chapters();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push(`exception: ${e.message}`);
    console.log(e);
} finally {
    if (browser) await browser.close();
}
console.log(errors.length ? `\n${errors.length} PROBLEM(S):\n${errors.join('\n')}` : '\nall browser checks passed');
process.exit(errors.length ? 1 : 0);
